<script lang="ts" module>
  import type { ChatMessage } from "$lib/api";
  /** Per-session history so switching open sessions doesn't re-GET /messages */
  const historyCache = new Map<string, ChatMessage[]>();
</script>

<script lang="ts">
  import type {
    ChatMessage as ChatMsg,
    PromptImage,
    SessionRow,
  } from "$lib/api";
  import {
    abort,
    abortBash,
    bash,
    followUp,
    getMessages,
    getSession,
    isPairedToolResult,
    listForkCandidates,
    messageKey,
    messageText,
    navigateTree,
    prompt,
    registerChatPrompt,
    steer,
    subscribeEvents,
  } from "$lib/api";
  import {
    ChatStream,
    type ConnectedInfo,
    type StreamEffect,
  } from "$lib/chat-stream";
  import X from "@lucide/svelte/icons/x";
  import FolderPicker from "$lib/components/FolderPicker.svelte";
  import MessageBubble from "$lib/components/MessageBubble.svelte";
  import ModelPicker from "$lib/components/ModelPicker.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import {
    PromptInput,
    PromptInputTextarea,
    PromptInputActions,
    PromptInputAction,
  } from "agentic-ui-kit/components/prompt-kit/index.js";
  import Loader from "agentic-ui-kit/components/prompt-kit/loader.svelte";
  import { onDestroy, tick, untrack } from "svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Square from "@lucide/svelte/icons/square";
  import Folder from "@lucide/svelte/icons/folder";

  const LS_CWD = "pi-gui-last-cwd";
  const LS_MODEL = "pi-gui-last-model";
  /** Composer text survives accidental refresh (tab-scoped). */
  const SS_DRAFT = "pi-gui-draft:";

  function readLastCwd(): string {
    try {
      return localStorage.getItem(LS_CWD) || "";
    } catch {
      return "";
    }
  }

  function readLastModel(): SessionRow["model"] {
    try {
      const raw = localStorage.getItem(LS_MODEL);
      if (!raw) return undefined;
      const m = JSON.parse(raw) as SessionRow["model"];
      return m?.provider && m?.id ? m : undefined;
    } catch {
      return undefined;
    }
  }

  function saveLastCwd(cwd: string) {
    if (!cwd) return;
    try {
      localStorage.setItem(LS_CWD, cwd);
    } catch {
      /* ignore */
    }
  }

  function saveLastModel(m: SessionRow["model"]) {
    if (!m?.provider || !m?.id) return;
    try {
      localStorage.setItem(LS_MODEL, JSON.stringify(m));
    } catch {
      /* ignore */
    }
  }

  function draftStoreKey(id: string | null) {
    return SS_DRAFT + (id ?? "home");
  }

  function readDraft(id: string | null): string {
    try {
      return sessionStorage.getItem(draftStoreKey(id)) || "";
    } catch {
      return "";
    }
  }

  function writeDraft(id: string | null, text: string) {
    try {
      const k = draftStoreKey(id);
      if (text) sessionStorage.setItem(k, text);
      else sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }

  function pathDraftId(): string | null {
    try {
      const m = location.pathname.match(/^\/sessions\/([^/]+)\/?$/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch {
      return null;
    }
  }

  type Props = {
    session?: SessionRow;
    defaultCwd?: string;
    /** Sidebar folder “+” — set draft cwd on home. */
    forceCwd?: string | null;
    onSessionUpdate?: (id: string, patch: Partial<SessionRow>) => void;
    /** Create a fresh session on first send (cwd + optional model). */
    onEnsureSession?: (opts?: {
      cwd?: string;
      model?: { provider?: string; id?: string };
    }) => Promise<SessionRow>;
    /** Show expand controls in chat header when side panels are collapsed. */
    showExpandSidebar?: boolean;
    showExpandGit?: boolean;
    onExpandSidebar?: () => void;
    onExpandGit?: () => void;
  };

  let {
    session,
    defaultCwd = "",
    forceCwd = null,
    onSessionUpdate,
    onEnsureSession,
    showExpandSidebar = false,
    showExpandGit = false,
    onExpandSidebar,
    onExpandGit,
  }: Props = $props();

  let messages = $state<ChatMessage[]>([]);
  /** Session id the in-memory draft belongs to (for persist on switch/refresh). */
  let draftOwner: string | null = pathDraftId();
  let draft = $state(readDraft(draftOwner));
  let streaming = $state(false);
  let bashRunning = $state(false);
  let error = $state<string | null>(null);
  /** Last failed prompt — Retry re-sends without retyping. */
  let failedPrompt = $state<{ text: string; images: PromptImage[] } | null>(
    null,
  );
  /** Pending image attachments (paste / drop). */
  type Attach = PromptImage & { preview: string };
  let attachments = $state<Attach[]>([]);
  let closeEs: (() => void) | null = null;
  let scroller: HTMLDivElement | undefined = $state();
  let sending = $state(false);
  /** Follow tail unless user scrolls up (reactive for jump button) */
  let stickBottom = $state(true);
  let progScroll = false;
  /** Long sessions: only paint a tail until user expands. */
  const MSG_WINDOW = 120;
  let showAllMsgs = $state(false);

  /** Prefill from last session; overwritten when a live session loads. */
  let model = $state<SessionRow["model"]>(readLastModel());
  /** Folder for next new session (home only). */
  let draftCwd = $state(readLastCwd());

  function shortFolder(p: string) {
    const segs = p.split("/").filter(Boolean);
    return segs.slice(-2).join("/") || p;
  }

  // Fallback to server cwd only if we have no remembered path
  $effect(() => {
    if (!draftCwd && defaultCwd) draftCwd = defaultCwd;
  });

  // Keep composer text across accidental refresh (per session / home)
  $effect(() => {
    writeDraft(draftOwner, draft);
  });

  // Sidebar “new in folder” while on home (or after clearing selection)
  $effect(() => {
    if (forceCwd && !session) {
      draftCwd = forceCwd;
      saveLastCwd(forceCwd);
    }
  });

  // Remember last active session path + model
  $effect(() => {
    if (session?.cwd) saveLastCwd(session.cwd);
    if (session?.model?.provider && session?.model?.id) {
      saveLastModel(session.model);
    }
  });

  function onFolderChange(p: string) {
    draftCwd = p;
    saveLastCwd(p);
  }

  /** Queue display (pi-tui pending messages) */
  let queueSteer = $state<string[]>([]);
  let queueFollowUp = $state<string[]>([]);

  /** Coalesce stream paints to one commit per frame */
  let pending: ChatMessage[] | null = null;
  let raf = 0;
  let wiredId: string | null = null;
  /** Seq-gated SSE + id merge pipeline (one per panel). */
  const stream = new ChatStream();

  const bashMode = $derived(draft.trimStart().startsWith("!"));
  const canSend = $derived(
    (Boolean(draft.trim()) || attachments.length > 0) && !sending,
  );
  const busy = $derived(streaming || bashRunning);

  // pi-tui Loader frames — mutate DOM only (no $state → no chat re-render/scroll jump)
  const PI_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
  let spinEl: HTMLSpanElement | undefined = $state();
  $effect(() => {
    const el = spinEl;
    if (!busy || !el) return;
    let i = 0;
    el.textContent = PI_SPINNER[0];
    const id = setInterval(() => {
      i = (i + 1) % PI_SPINNER.length;
      el.textContent = PI_SPINNER[i];
    }, 80);
    return () => clearInterval(id);
  });
  /** Prefer local (live) model; fall back to session prop so picker never blanks. */
  const activeModel = $derived(model ?? session?.model);
  const hiddenMsgCount = $derived(
    showAllMsgs || messages.length <= MSG_WINDOW
      ? 0
      : messages.length - MSG_WINDOW,
  );

  function onComposerDragOver(e: DragEvent) {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  }

  function onComposerDrop(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) void addImageFiles(e.dataTransfer.files);
  }

  function onScroll() {
    if (!scroller || progScroll) return;
    const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stickBottom = gap < 100;
  }

  /** Open / switch session + jump button — never on stream/message updates. */
  async function scrollBottom() {
    stickBottom = true;
    await tick();
    if (!scroller) return;
    progScroll = true;
    scroller.scrollTop = scroller.scrollHeight;
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      progScroll = false;
    });
  }

  function measureStick() {
    if (!scroller || progScroll) return;
    stickBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;
  }

  function cacheHistory(id: string | null, list: ChatMessage[]) {
    if (id) historyCache.set(id, list);
  }

  /** Keep tail in view while stickBottom (submit re-enables stick). */
  function stickScroll() {
    if (!scroller || !stickBottom || progScroll) return;
    progScroll = true;
    scroller.scrollTop = scroller.scrollHeight;
    requestAnimationFrame(() => {
      if (scroller && stickBottom) scroller.scrollTop = scroller.scrollHeight;
      progScroll = false;
    });
  }

  /** Push stream.messages to UI (rAF-coalesced while streaming). */
  function paintMessages(coalesce = true) {
    const next = stream.messages.slice();
    if (coalesce) {
      pending = next;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!pending) return;
        messages = pending;
        pending = null;
        cacheHistory(wiredId, messages);
        if (stickBottom) stickScroll();
        else requestAnimationFrame(measureStick);
      });
      return;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    pending = null;
    messages = next;
    cacheHistory(wiredId, messages);
    if (stickBottom) stickScroll();
  }

  function flush() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (pending) {
      messages = pending;
      pending = null;
      cacheHistory(wiredId, messages);
    } else {
      // Ensure UI matches stream after non-coalesced mutations
      messages = stream.messages.slice();
      cacheHistory(wiredId, messages);
    }
  }

  function dropPending() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    pending = null;
  }

  function syncTurnFlags() {
    awaitingSettle = stream.phase !== "idle";
    streaming = stream.phase === "streaming" || stream.phase === "awaiting";
    sawServerStreaming = stream.sawServerStreaming;
  }

  function applyEffects(effects: StreamEffect[], id: string) {
    let paint = false;
    let paintNow = false;
    for (const ef of effects) {
      switch (ef.type) {
        case "need_snapshot":
          void runSnapshot(id, ef.info);
          break;
        case "resumed":
          void catchUp(id);
          break;
        case "messages":
          paint = true;
          break;
        case "turn":
          syncTurnFlags();
          break;
        case "settled":
          paintNow = true;
          clearTurnBusy();
          if (wiredId === id) {
            void load(id, { quiet: true });
            scheduleMeta(id);
          }
          break;
        case "error":
          error = ef.error;
          void catchUp(id);
          break;
        case "bash_running":
          bashRunning = ef.running;
          break;
        case "queues":
          queueSteer = ef.steer;
          queueFollowUp = ef.followUp;
          break;
        case "thinking":
          if (wiredId) onSessionUpdate?.(wiredId, { thinkingLevel: ef.level });
          break;
        case "session_name":
          if (wiredId) {
            onSessionUpdate?.(wiredId, {
              name: ef.name,
              sessionName: ef.name,
            });
          }
          break;
        case "compacting":
          if (wiredId) {
            onSessionUpdate?.(wiredId, { isCompacting: ef.active });
            if (ef.errorMessage) error = ef.errorMessage;
            if (!ef.active) {
              void load(wiredId, { force: true }).then(() =>
                loadMeta(wiredId!),
              );
            }
          }
          break;
        case "tree_navigated":
          if (ef.editorText) draft = ef.editorText;
          if (wiredId) {
            void load(wiredId, { force: true }).then(() => loadMeta(wiredId!));
          }
          break;
        case "retry":
          error = ef.message;
          syncTurnFlags();
          break;
        case "retry_end":
          if (!ef.success) {
            error = ef.finalError || "Auto-retry failed";
          } else {
            error = null;
          }
          break;
      }
    }
    if (paintNow) {
      paintMessages(false);
      requestAnimationFrame(measureStick);
    } else if (paint) {
      paintMessages(true);
    }
  }

  /** Edit user message: navigate tree to that entry, put text in draft. */
  async function editUserMessage(msg: ChatMsg) {
    if (!session?.id || busy) return;
    const body = messageText(msg).trim();
    if (!body) return;
    try {
      const { messages: forks } = await listForkCandidates(session.id);
      const hit =
        [...forks].reverse().find((f) => f.text === body) ??
        forks.find((f) => f.text.trim() === body);
      if (hit?.entryId) {
        await navigateTree(session.id, hit.entryId);
        // tree_navigated sets draft + reloads; ensure draft if SSE missed
        if (!draft.trim()) draft = body;
      } else {
        draft = body;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      draft = body;
    }
  }

  let metaTimer = 0;
  /** Safety net when SSE drops mid-turn */
  let turnWatch = 0;
  let lastSseAt = 0;
  let catchUpTimer = 0;
  /**
   * True from successful prompt until agent_settled (or failTurn).
   * catchUp must not clear streaming in the 202→agent_start race.
   */
  let awaitingSettle = false;
  /** Server reported streaming this turn — idle then means settle (SSE may have been missed). */
  let sawServerStreaming = false;
  let lastPromptAt = 0;

  function clearTurnBusy() {
    stream.clearTurn();
    awaitingSettle = false;
    sawServerStreaming = false;
    streaming = false;
    stopTurnWatch();
    queueSteer = [];
    queueFollowUp = [];
  }

  function stopTurnWatch() {
    if (turnWatch) {
      clearInterval(turnWatch);
      turnWatch = 0;
    }
  }

  /** Poll session until idle; reloads history if SSE missed events. */
  function startTurnWatch(id: string) {
    stopTurnWatch();
    lastSseAt = Date.now();
    turnWatch = window.setInterval(() => {
      if (wiredId !== id) {
        stopTurnWatch();
        return;
      }
      void catchUp(id);
    }, 2500);
  }

  /**
   * REST snapshot under the stream barrier (cold open / ring gap).
   * Live SSE frames buffer until commitSnapshot drains them.
   */
  async function runSnapshot(id: string, info: ConnectedInfo) {
    if (wiredId !== id) return;
    try {
      const [row, { messages: m }] = await Promise.all([
        getSession(id),
        getMessages(id),
      ]);
      if (wiredId !== id) return;
      const effects = stream.commitSnapshot(m, info.seq);
      bashRunning = Boolean(row.isBashRunning);
      stream.noteServerBusy(Boolean(row.streaming));
      syncTurnFlags();
      applyEffects(effects, id);
      paintMessages(false);
      scheduleMeta(id);
    } catch {
      /* transient — turnWatch / next connected will retry */
      if (wiredId === id && stream.phase !== "idle") {
        // Release barrier so live events are not stuck forever
        stream.commitSnapshot(stream.messages, info.seq);
        paintMessages(false);
      }
    }
  }

  /** Reload messages + streaming flag from REST (SSE gap / reconnect). */
  async function catchUp(id: string) {
    if (wiredId !== id) return;
    try {
      const [row] = await Promise.all([
        getSession(id),
        load(id, { quiet: true }),
      ]);
      if (wiredId !== id) return;
      bashRunning = Boolean(row.isBashRunning);
      const still = Boolean(row.streaming || row.isBashRunning);
      if (still) {
        stream.noteServerBusy(true);
        syncTurnFlags();
        return;
      }
      if (stream.shouldSettleFromIdle()) {
        clearTurnBusy();
        scheduleMeta(id);
      }
    } catch {
      /* ignore transient */
    }
  }

  /** One GET /sessions/:id for tokens/model/ctx — keep header stats fresh. */
  async function loadMeta(id: string) {
    try {
      const row = await getSession(id);
      model = row.model;
      bashRunning = Boolean(row.isBashRunning);
      // Always push stats (not only when idle) so header can show 48.4k↑ · $ · ctx
      onSessionUpdate?.(id, {
        model: row.model,
        thinkingLevel: row.thinkingLevel,
        stats: row.stats,
        contextUsage: row.contextUsage,
        isBashRunning: row.isBashRunning,
        isCompacting: row.isCompacting,
        compacting: row.compacting,
        streaming: row.streaming,
        messageCount: row.messageCount,
        name: row.name,
        sessionName: row.sessionName,
        pendingMessageCount: row.pendingMessageCount,
      });
    } catch {
      model = untrack(() => session?.model);
    }
  }

  function scheduleMeta(id: string) {
    if (metaTimer) clearTimeout(metaTimer);
    metaTimer = window.setTimeout(() => {
      metaTimer = 0;
      if (wiredId === id) loadMeta(id).catch(() => {});
    }, 200);
  }

  function isNotOpenErr(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /Session not open/i.test(msg);
  }

  async function load(
    id: string,
    opts?: { force?: boolean; quiet?: boolean },
  ) {
    // Snapshot barrier owns baseline; do not race REST over live drain
    if (stream.isSnapshotting && !opts?.force) return;
    if (!opts?.quiet) error = null;
    flush();
    // Stale-while-revalidate: paint cache, always refresh from server
    if (!opts?.force && historyCache.has(id) && stream.messages.length === 0) {
      const cached = historyCache.get(id)!;
      stream.messages = cached.slice();
      messages = cached;
      if (!opts?.quiet) scrollBottom();
    }
    try {
      const { messages: m } = await getMessages(id);
      if (wiredId !== id) return;
      if (stream.isSnapshotting && !opts?.force) return;
      stream.reconcileFromServer(m, { force: opts?.force });
      paintMessages(false);
      if (!opts?.quiet) scrollBottom();
      else requestAnimationFrame(measureStick);
    } catch (err) {
      if (wiredId !== id) return;
      // Expected: list row id not in hub yet — parent opens; stay quiet
      if (!opts?.quiet && !isNotOpenErr(err)) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  function wire(id: string) {
    closeEs?.();
    closeEs = subscribeEvents(
      id,
      (ev, meta) => {
        if (wiredId !== id) return;
        lastSseAt = Date.now();
        // Canonical hub id may differ from disk list id
        const raw = ev as { type?: string; id?: string };
        if (
          raw.type === "connected" &&
          typeof raw.id === "string" &&
          raw.id &&
          raw.id !== id
        ) {
          onSessionUpdate?.(id, { id: raw.id });
        }
        const effects = stream.handleFrame(meta.seq, ev);
        applyEffects(effects, id);
      },
      () => {
        // EventSource error / reconnect — browser resends Last-Event-ID;
        // also pass ?after= on next wire. Throttled REST catch-up as safety net.
        if (wiredId !== id) return;
        if (catchUpTimer) return;
        catchUpTimer = window.setTimeout(() => {
          catchUpTimer = 0;
          if (wiredId === id) void catchUp(id);
        }, 400);
      },
      { after: stream.lastSeq },
    );
  }

  // Only re-bind when session *id* changes — not on meta patches (flicker root cause)
  $effect(() => {
    const id = session?.id ?? null;

    // Already wired — keep SSE open (cleanup must not close on same-id re-entry)
    if (id && wiredId === id) {
      return () => {
        // Cache only; do not close EventSource while still on this session
        if (wiredId === id) {
          flush();
          cacheHistory(id, messages);
        }
      };
    }

    if (!id) {
      untrack(() => {
        dropPending();
        stopTurnWatch();
        stream.reset();
        awaitingSettle = false;
        writeDraft(draftOwner, draft);
        draftOwner = null;
        draft = readDraft(null);
        messages = [];
        streaming = false;
        bashRunning = false;
        showAllMsgs = false;
        failedPrompt = null;
        attachments = [];
        // Home: keep last session path + model prefilled
        model = readLastModel();
        draftCwd = readLastCwd() || defaultCwd || draftCwd;
        queueSteer = [];
        queueFollowUp = [];
        closeEs?.();
        closeEs = null;
        wiredId = null;
      });
      return;
    }

    untrack(() => {
      const prev = wiredId;
      if (prev) {
        flush();
        cacheHistory(prev, messages);
        stopTurnWatch();
        awaitingSettle = false;
      }
      writeDraft(draftOwner, draft);
      draftOwner = id;
      draft = readDraft(id);
      wiredId = id;
      dropPending();
      showAllMsgs = false;
      failedPrompt = null;
      attachments = [];
      const cached = historyCache.get(id);
      stream.bindSession(id, { messages: cached });
      messages = stream.messages.slice();
      streaming = false;
      bashRunning = false;
      awaitingSettle = false;
      sawServerStreaming = false;
      streaming = Boolean(session?.streaming) || streaming;
      bashRunning = Boolean(session?.isBashRunning) || bashRunning;
      if (streaming) {
        stream.markAwaiting();
        if (session?.streaming) stream.noteServerBusy(true);
        syncTurnFlags();
        lastPromptAt = Date.now();
      }
      model = session?.model;
      queueSteer = [];
      queueFollowUp = [];
      stickBottom = true;
      // SSE first: connected → need_snapshot → REST baseline, then live.
      // Resume (lastSeq > 0) also wires with ?after= for ring fill.
      wire(id);
      scheduleMeta(id);
      // Paint cache immediately; snapshot/resume will reconcile
      if (messages.length) void scrollBottom();
    });

    return () => {
      // Leaving this session id — cache + close SSE only if still owner
      if (wiredId === id) {
        flush();
        cacheHistory(id, messages);
        stopTurnWatch();
        closeEs?.();
        closeEs = null;
      }
    };
  });

  // Tab/window focus → revalidate active session history
  $effect(() => {
    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      const id = wiredId;
      if (id) void catchUp(id);
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  });

  onDestroy(() => {
    dropPending();
    stopTurnWatch();
    if (catchUpTimer) clearTimeout(catchUpTimer);
    if (metaTimer) clearTimeout(metaTimer);
    wiredId = null;
    closeEs?.();
    // Keep lastSeq in sessionStorage for resume; do not clearStoredSeq
  });

  async function resolveSessionId(): Promise<string | null> {
    if (session?.id) return session.id;
    if (!onEnsureSession) return null;
    const cwd = draftCwd.trim() || defaultCwd || undefined;
    const m = model;
    const row = await onEnsureSession({
      cwd,
      model:
        m?.provider && m?.id
          ? { provider: m.provider, id: m.id }
          : undefined,
    });
    return row.id;
  }

  function takeImages(): PromptImage[] {
    const imgs = attachments.map(({ type, data, mimeType }) => ({
      type,
      data,
      mimeType,
    }));
    attachments = [];
    return imgs;
  }

  async function fileToAttach(file: File): Promise<Attach | null> {
    if (!file.type.startsWith("image/")) return null;
    if (file.size > 8 * 1024 * 1024) {
      error = "Image too large (max 8MB)";
      return null;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return {
      type: "image",
      data,
      mimeType: file.type || "image/png",
      preview: dataUrl.startsWith("data:")
        ? dataUrl
        : `data:${file.type};base64,${data}`,
    };
  }

  async function addImageFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const next: Attach[] = [];
    for (const f of list) {
      const a = await fileToAttach(f);
      if (a) next.push(a);
    }
    if (next.length) attachments = [...attachments, ...next].slice(0, 8);
  }

  function onComposerPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (!files.length) return;
    e.preventDefault();
    void addImageFiles(files);
  }

  function removeAttach(i: number) {
    attachments = attachments.filter((_, j) => j !== i);
  }

  async function send(mode: "default" | "followUp" = "default") {
    if (sending) return;
    if (!draft.trim() && attachments.length === 0) return;
    const text = draft.trim();
    const imgs = takeImages();
    draft = "";
    await sendText(text, mode, imgs);
  }

  async function retryFailed() {
    if (!failedPrompt || sending) return;
    const { text, images } = failedPrompt;
    failedPrompt = null;
    error = null;
    await sendText(text, "default", images);
  }

  /** Shared by composer + palette (skills, etc.). */
  async function sendText(
    text: string,
    mode: "default" | "followUp" = "default",
    images: PromptImage[] = [],
  ) {
    const body = text.trim();
    if ((!body && images.length === 0) || sending) return;
    sending = true;
    error = null;
    failedPrompt = null;

    let id: string | null;
    try {
      id = await resolveSessionId();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      failedPrompt = { text: body, images };
      sending = false;
      return;
    }
    if (!id) {
      error = "Could not open session";
      failedPrompt = { text: body, images };
      sending = false;
      return;
    }

    // pi-tui: !cmd / !!cmd (exclude from context)
    if (body.startsWith("!")) {
      const exclude = body.startsWith("!!");
      const command = (exclude ? body.slice(2) : body.slice(1)).trim();
      if (!command) {
        sending = false;
        return;
      }
      if (bashRunning) {
        error = "Bash already running — stop it first";
        sending = false;
        return;
      }
      try {
        stream.upsertBash(command, "", { excludeFromContext: exclude });
        paintMessages(false);
        void scrollBottom();
        bashRunning = true;
        await bash(id, command, { excludeFromContext: exclude });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        bashRunning = false;
      } finally {
        sending = false;
      }
      return;
    }

    const imgPayload = images.length ? images : undefined;
    let startedTurn = false;
    try {
      // New session: effect may not have wired SSE yet — wire before prompt
      if (wiredId !== id) {
        const prev = wiredId;
        if (prev) {
          flush();
          cacheHistory(prev, messages);
          closeEs?.();
        }
        wiredId = id;
        stream.bindSession(id, { messages: stream.messages });
        wire(id);
      }
      if (streaming && mode === "followUp") {
        await followUp(id, body, imgPayload);
        queueFollowUp = [...queueFollowUp, body || "(image)"];
        void scrollBottom();
      } else if (streaming) {
        await steer(id, body, imgPayload);
        queueSteer = [...queueSteer, body || "(image)"];
        void scrollBottom();
      } else {
        flush();
        const content: unknown =
          images.length > 0
            ? [
                ...(body ? [{ type: "text", text: body }] : []),
                ...images.map((im) => ({
                  type: "image" as const,
                  data: im.data,
                  mimeType: im.mimeType,
                })),
              ]
            : body;
        stream.pushOptimisticUser(content);
        paintMessages(false);
        startedTurn = true;
        syncTurnFlags();
        lastPromptAt = stream.lastPromptAt;
        void scrollBottom();
        await prompt(id, body, imgPayload);
        // REST is 202 fire-and-forget — poll if SSE misses the turn
        startTurnWatch(id);
        // Safety net if connected/snapshot raced the prompt
        window.setTimeout(() => {
          if (wiredId === id) void catchUp(id);
        }, 600);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      failedPrompt = { text: body, images };
      if (startedTurn) clearTurnBusy();
    } finally {
      sending = false;
    }
  }

  // Palette / skills call chatPrompt() → same optimistic path as typing in the composer
  $effect(() => {
    registerChatPrompt((text) => sendText(text));
    return () => registerChatPrompt(null);
  });

  function onTextareaKey(e: KeyboardEvent) {
    if (e.key === "Enter" && e.altKey && !e.shiftKey) {
      e.preventDefault();
      void send("followUp");
    }
  }

  async function stop() {
    if (!session?.id) return;
    try {
      if (bashRunning) await abortBash(session.id);
      else await abort(session.id);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    clearTurnBusy();
    bashRunning = false;
  }

  function onModelChange(m: { provider?: string; id?: string; name?: string }) {
    model = m;
    saveLastModel(m);
    if (session?.id) onSessionUpdate?.(session.id, { model: m });
  }

  const placeholder = $derived(
    bashMode
      ? draft.trimStart().startsWith("!!")
        ? "Bash (no context)…"
        : "Bash…"
      : streaming
        ? "Steer (Enter) · follow-up (⌥Enter)…"
        : "Message pi…  (! for bash)",
  );

  /** Home / empty chat: centered prompt (Cursor-style). */
  const isHome = $derived(messages.length === 0 && !busy && !sending);

  const promptBoxClass = $derived(
    `border-black/[0.08] bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900 ${
      bashMode ? "ring-1 ring-amber-500/50" : ""
    }`,
  );
</script>

<section class="chat-canvas flex min-w-0 flex-1 flex-col">
  {#if isHome}
    {#if showExpandSidebar || showExpandGit}
      <header
        class="flex h-11 shrink-0 items-center gap-1 border-b border-black/[0.06] bg-[#f4f4f5] px-2 dark:border-white/10 dark:bg-[hsl(240_6%_8%)]"
      >
        {#if showExpandSidebar && onExpandSidebar}
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Expand sidebar"
            aria-label="Expand sidebar"
            onclick={onExpandSidebar}
          >
            <PanelLeft class="size-4" />
          </button>
        {/if}
        <div class="min-w-0 flex-1"></div>
        {#if showExpandGit && onExpandGit}
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Show changes"
            aria-label="Show git changes sidebar"
            onclick={onExpandGit}
          >
            <PanelRight class="size-4" />
          </button>
        {/if}
      </header>
    {/if}
    <!-- Cursor-style empty: greeting + centered composer -->
    <div class="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-[12vh] pt-8">
      <div class="mb-8 max-w-lg text-center">
        <h1 class="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          What can I help with?
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {#if session?.id}
            Empty session · type to continue
          {:else}
            New session · pick folder · submit to create
          {/if}
        </p>
      </div>
      <div
        class="w-full max-w-2xl"
        ondragover={onComposerDragOver}
        ondrop={onComposerDrop}
      >
        <PromptInput
          class={promptBoxClass}
          bind:value={draft}
          isLoading={sending}
          onSubmit={() => send("default")}
        >
          {#if attachments.length}
            <div class="flex flex-wrap gap-2 px-3 pt-2">
              {#each attachments as a, ai (`a${ai}`)}
                <div class="relative">
                  <img
                    src={a.preview}
                    alt=""
                    class="h-14 w-14 rounded-md border border-border/60 object-cover"
                  />
                  <button
                    type="button"
                    class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                    onclick={() => removeAttach(ai)}
                    aria-label="Remove attachment"
                  >
                    <X class="size-3" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <PromptInputTextarea
            placeholder="Ask anything…  (! for bash)"
            class="min-h-[56px] text-[15px]"
            onkeydown={onTextareaKey}
            onpaste={onComposerPaste}
          />
          <PromptInputActions class="items-end justify-between gap-2 pt-1">
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {#if !session?.id}
                <FolderPicker
                  value={draftCwd}
                  defaultPath={defaultCwd}
                  onChange={onFolderChange}
                />
              {:else if session.cwd}
                <span
                  class="flex h-7 max-w-[14rem] items-center gap-1 truncate rounded-full bg-muted/50 px-2 text-[11px] text-muted-foreground"
                  title={session.cwd}
                >
                  <Folder class="size-3 shrink-0 opacity-70" />
                  {shortFolder(session.cwd)}
                </span>
              {/if}
              <ModelPicker
                sessionId={session?.id}
                model={activeModel}
                onChange={onModelChange}
                onError={(m) => (error = m)}
              />
            </div>
            <div class="flex shrink-0 items-center self-end">
              <PromptInputAction tooltip="Send">
                <Button
                  size="icon"
                  class="size-8 shrink-0 rounded-full"
                  onclick={() => send("default")}
                  disabled={!canSend}
                  type="button"
                >
                  {#if sending}
                    <Loader variant="circular" size="sm" class="size-3.5" />
                  {:else}
                    <ArrowUp class="size-4" />
                  {/if}
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
        {#if error}
          <div
            class="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-destructive"
          >
            <span>{error}</span>
            {#if failedPrompt}
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 px-2 text-[11px]"
                onclick={retryFailed}
                disabled={sending}
              >
                Retry
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    {#if session}
      <StatusBar
        {session}
        onError={(m) => (error = m)}
        onUpdate={(patch) => onSessionUpdate?.(session.id, patch)}
        {showExpandSidebar}
        {showExpandGit}
        {onExpandSidebar}
        {onExpandGit}
      />
    {/if}

    <div class="relative min-h-0 flex-1">
      <div
        bind:this={scroller}
        class="absolute inset-0 overflow-y-auto px-4 sm:px-8 lg:px-12"
        onscroll={onScroll}
      >
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 py-6">
          {#if hiddenMsgCount > 0}
            <button
              type="button"
              class="mx-auto rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => (showAllMsgs = true)}
            >
              Show earlier {hiddenMsgCount} messages
            </button>
          {/if}
          {#each messages.slice(hiddenMsgCount) as m, j (messageKey(m, j + hiddenMsgCount))}
            {@const i = j + hiddenMsgCount}
            {#if m.role === "toolResult" && isPairedToolResult(messages, i)}
              <!-- result folded into matching tool call card -->
            {:else}
              {@const isLiveAssistant =
                busy &&
                m.role === "assistant" &&
                !messages
                  .slice(i + 1)
                  .some((x) => x.role === "assistant" || x.role === "user")}
              {@const isLiveBash =
                busy &&
                m.role === "bashExecution" &&
                i === messages.length - 1}
              <MessageBubble
                message={m}
                messages={messages}
                index={i}
                streaming={isLiveAssistant || isLiveBash}
                onEditUser={editUserMessage}
              />
            {/if}
          {/each}
          {#if queueSteer.length || queueFollowUp.length}
            <div class="rounded-md border border-dashed border-border/80 px-3 py-2 text-[12px] text-muted-foreground">
              {#each queueSteer as t, qi (`s${qi}`)}
                <div class="truncate">↗ steer: {t}</div>
              {/each}
              {#each queueFollowUp as t, qi (`f${qi}`)}
                <div class="truncate">↓ follow-up: {t}</div>
              {/each}
            </div>
          {/if}
          {#if busy}
            <div class="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
              <span bind:this={spinEl} class="font-mono text-primary" aria-hidden="true">⠋</span>
              <span>{bashRunning ? "bash…" : "Working"}</span>
            </div>
          {/if}
          {#if error}
            <div class="flex flex-wrap items-center gap-2 text-sm text-destructive">
              <span>{error}</span>
              {#if failedPrompt}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-[11px]"
                  onclick={retryFailed}
                  disabled={sending}
                >
                  Retry
                </Button>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      {#if !stickBottom}
        <button
          type="button"
          class="absolute bottom-3 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1 rounded-full border border-border/80 bg-background/95 px-3 text-[11px] font-medium text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
          onclick={() => scrollBottom()}
        >
          <ChevronDown class="size-3.5" />
          {busy ? "Jump to latest" : "Latest"}
        </button>
      {/if}
    </div>

    <footer class="chat-footer border-t border-black/[0.06] p-3 dark:border-white/10">
      <div
        class="mx-auto w-full max-w-5xl"
        ondragover={onComposerDragOver}
        ondrop={onComposerDrop}
      >
        <PromptInput
          class={promptBoxClass}
          bind:value={draft}
          isLoading={busy}
          onSubmit={() => send("default")}
          disabled={session ? !session.running && !session.id : false}
        >
          {#if attachments.length}
            <div class="flex flex-wrap gap-2 px-3 pt-2">
              {#each attachments as a, ai (`a${ai}`)}
                <div class="relative">
                  <img
                    src={a.preview}
                    alt=""
                    class="h-14 w-14 rounded-md border border-border/60 object-cover"
                  />
                  <button
                    type="button"
                    class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                    onclick={() => removeAttach(ai)}
                    aria-label="Remove attachment"
                  >
                    <X class="size-3" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <PromptInputTextarea
            {placeholder}
            class="min-h-[44px]"
            onkeydown={onTextareaKey}
            onpaste={onComposerPaste}
          />
          <PromptInputActions class="items-end justify-between gap-2 pt-1">
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {#if session?.id}
                <ModelPicker
                  sessionId={session.id}
                  model={activeModel}
                  disabled={!session.running && !session.id}
                  onChange={onModelChange}
                  onError={(m) => (error = m)}
                />
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-1 self-end">
              {#if busy}
                <PromptInputAction tooltip="Stop">
                  <Button
                    size="icon"
                    class="size-8 shrink-0 rounded-full"
                    onclick={stop}
                    type="button"
                  >
                    <Square class="size-3.5 fill-current" />
                  </Button>
                </PromptInputAction>
              {:else}
                <PromptInputAction tooltip={bashMode ? "Run bash" : "Send"}>
                  <Button
                    size="icon"
                    class="size-8 shrink-0 rounded-full"
                    onclick={() => send("default")}
                    disabled={!canSend}
                    type="button"
                  >
                    {#if sending}
                      <Loader variant="circular" size="sm" class="size-3.5" />
                    {:else}
                      <ArrowUp class="size-4" />
                    {/if}
                  </Button>
                </PromptInputAction>
              {/if}
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </footer>
  {/if}
</section>

<style>
  .chat-canvas {
    background: #f4f4f5;
    color: hsl(240 10% 3.9%);
  }
  :global(html.dark) .chat-canvas {
    background: hsl(240 6% 8%);
    color: hsl(0 0% 98%);
  }
  .chat-footer {
    background: color-mix(in oklab, #f4f4f5 92%, white);
  }
  :global(html.dark) .chat-footer {
    background: hsl(240 6% 9%);
  }
</style>
