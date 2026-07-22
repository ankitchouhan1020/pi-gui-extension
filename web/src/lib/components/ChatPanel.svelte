<script lang="ts" module>
  import type { ChatMessage } from "$lib/api";
  /** Per-session history so switching open sessions doesn't re-GET /messages */
  const historyCache = new Map<string, ChatMessage[]>();
</script>

<script lang="ts">
  import type {
    ChatMessage as ChatMsg,
    ChatPromptOptions,
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
    listCommands,
    listForkCandidates,
    messageKey,
    messageText,
    navigateTree,
    prompt,
    registerChatPrompt,
    runCommand,
    steer,
    subscribeEvents,
    takePendingEditorText,
    type ForkCandidate,
    type SlashCommandInfo,
  } from "$lib/api";
  import {
    ChatStream,
    type ConnectedInfo,
    type StreamEffect,
  } from "$lib/chat-stream";
  import { BUILTIN_SLASH_COMMANDS } from "$lib/slash-builtins";
  import { skillNameForSlashCommand } from "$lib/special-message";
  import {
    formatWorkDuration,
    hasAssistantWork,
    isComposerCommand,
    isFinalAssistantResponse,
    messageTimestamp,
    startsTopLevelTurn,
  } from "$lib/work-section";
  import ChatComposer from "$lib/components/ChatComposer.svelte";
  import MessageBubble from "$lib/components/MessageBubble.svelte";
  import SlashMenu from "$lib/components/SlashMenu.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import { onDestroy, tick, untrack } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Bug from "@lucide/svelte/icons/bug";
  import MapIcon from "@lucide/svelte/icons/map";
  import Telescope from "@lucide/svelte/icons/telescope";
  import { playFeedback } from "$lib/feedback";

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
    /** pi builtin slash (`/model`, `/compact`, …). */
    onBuiltinSlash?: (name: string) => void;
    onRequestFork?: (candidate: ForkCandidate) => void;
    treeNavigation?: {
      token: number;
      sessionId: string;
      editorText?: string;
    } | null;
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
    onBuiltinSlash,
    onRequestFork,
    treeNavigation = null,
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
  let failedPrompt = $state<{
    text: string;
    images: PromptImage[];
    options?: ChatPromptOptions;
  } | null>(
    null,
  );
  /** Pending image attachments (paste / drop). */
  type Attach = PromptImage & { preview: string };
  let attachments = $state<Attach[]>([]);
  let editEpoch = 0;
  let inlineEditSubmitting = $state(false);
  let appliedTreeNavigationToken = 0;
  let editing = $state<{
    token: number;
    index: number;
    message: ChatMsg;
    entryId: string | null;
    restoreDraft: string;
    restoreAttachments: Attach[];
  } | null>(null);
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

  /** pi-style `/` menu: only while draft is `/query` (no args yet). */
  let slashRemote = $state<SlashCommandInfo[]>([]);
  let slashLoadedFor = $state<string | null>(null);
  let slashIdx = $state(0);
  let slashHide = $state(false);
  const slashQuery = $derived(
    /^\/(\S*)$/.test(draft) ? draft.slice(1).toLowerCase() : null,
  );
  const slashCmds = $derived.by(() => {
    const remote = slashRemote;
    const taken = new Set(remote.map((c) => c.name));
    const builtins = BUILTIN_SLASH_COMMANDS.filter((b) => {
      if (taken.has(b.name)) return false;
      if (b.needsSession === false) return true;
      return Boolean(session?.id);
    });
    return [...builtins, ...remote] as SlashCommandInfo[];
  });
  const slashFiltered = $derived.by(() => {
    if (slashQuery === null) return [] as SlashCommandInfo[];
    const q = slashQuery;
    const scored = slashCmds
      .filter((c) => c.name)
      .map((c) => {
        const n = c.name.toLowerCase();
        if (!q) return { c, s: 0 };
        if (n.startsWith(q)) return { c, s: 0 };
        if (n.includes(q)) return { c, s: 1 };
        if ((c.description || "").toLowerCase().includes(q)) return { c, s: 2 };
        return null;
      })
      .filter((x): x is { c: SlashCommandInfo; s: number } => x != null)
      .sort((a, b) => a.s - b.s || a.c.name.localeCompare(b.c.name));
    return scored.map((x) => x.c);
  });
  const slashOpen = $derived(
    slashQuery !== null && !slashHide && slashFiltered.length > 0,
  );

  $effect(() => {
    void draft;
    slashHide = false;
  });

  $effect(() => {
    const id = session?.id;
    if (!id || slashQuery === null) return;
    if (slashLoadedFor === id) return;
    slashRemote = [];
    let cancelled = false;
    void listCommands(id)
      .then((res) => {
        if (cancelled) return;
        slashRemote = res.commands ?? [];
        slashLoadedFor = id;
      })
      .catch(() => {
        if (cancelled) return;
        slashRemote = [];
        slashLoadedFor = id;
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    void slashFiltered;
    slashIdx = 0;
  });

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
    // Home ↔ thread swaps the scroller; wait one frame if still missing.
    if (!scroller) await new Promise<void>((r) => requestAnimationFrame(() => r()));
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
    if (!stickBottom || progScroll) return;
    if (!scroller) {
      // messages just painted; scroller may mount next tick (left home)
      void tick().then(() => {
        if (stickBottom && scroller) stickScroll();
      });
      return;
    }
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
          // Hot ring resume — still revalidate REST so disk/TUI progress is not missed
          void load(id, { force: true, quiet: true });
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
          clearTurnBusy(true);
          if (wiredId === id && ef.reload !== false) {
            void load(id, { quiet: true });
            scheduleMeta(id);
          }
          break;
        case "error":
          error = ef.error;
          turnHadError = true;
          playFeedback("error");
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
          // Match Pi: tree navigation never clobbers text already in the editor.
          if (ef.editorText && !inlineEditSubmitting && !draft.trim()) {
            draft = ef.editorText;
          }
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

  async function findForkEntry(msg: ChatMsg) {
    if (!session?.id) return null;
    const body = messageText(msg).trim();
    if (!body) return null;
    const { messages: forks } = await listForkCandidates(session.id);
    return (
      [...forks].reverse().find((f) => f.text === body) ??
      forks.find((f) => f.text.trim() === body) ??
      null
    );
  }

  /** Replace a user bubble with the composer; tree navigation happens on submit. */
  async function editUserMessage(msg: ChatMsg, index: number) {
    if (!session?.id || busy || sending) return;
    const body = messageText(msg).trim();
    if (!body) return;
    const token = {
      token: ++editEpoch,
      index,
      message: msg,
      entryId: null,
      restoreDraft: draft,
      restoreAttachments: attachments,
    };
    editing = token;
    draft = body;
    attachments = [];
    focusComposer();
    try {
      const hit = await findForkEntry(msg);
      if (editing?.token === token.token) editing.entryId = hit?.entryId ?? null;
    } catch (err) {
      if (editing?.token === token.token) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  function cancelInlineEdit() {
    const current = editing;
    if (!current || sending || inlineEditSubmitting) return;
    editing = null;
    draft = current.restoreDraft;
    attachments = current.restoreAttachments;
    focusComposer();
  }

  async function submitInlineEdit() {
    const current = editing;
    const id = session?.id;
    const editedText = draft.trim();
    if (
      !current ||
      !id ||
      sending ||
      inlineEditSubmitting ||
      (!editedText && attachments.length === 0)
    ) return;

    error = null;
    inlineEditSubmitting = true;
    let entryId = current.entryId;
    try {
      if (!entryId) {
        entryId = (await findForkEntry(current.message))?.entryId ?? null;
      }
      if (!entryId) throw new Error("Could not locate this message in the session tree");

      const result = await navigateTree(id, entryId);
      if (result.cancelled || result.aborted) return;

      // Reconcile the shortened branch before adding the edited optimistic message.
      await load(id, { force: true, quiet: true });
      draft = editedText;
      editing = null;
      await send("default");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      draft = editedText;
      focusComposer();
    } finally {
      window.setTimeout(() => {
        inlineEditSubmitting = false;
      }, 1000);
    }
  }

  async function forkUserMessage(msg: ChatMsg) {
    if (!session?.id || busy || !messageText(msg).trim()) return;
    try {
      const hit = await findForkEntry(msg);
      if (!hit?.entryId) throw new Error("Could not locate this message in the session tree");
      onRequestFork?.(hit);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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
  /** Suppress the completion chime when the active turn already reported an error. */
  let turnHadError = false;
  /** Server reported streaming this turn — idle then means settle (SSE may have been missed). */
  let sawServerStreaming = false;
  let lastPromptAt = 0;
  let workDurations = $state<Record<string, number>>({});

  function recordWorkDuration() {
    if (!(lastPromptAt > 0)) return;
    const list = stream.messages;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.role !== "user") continue;
      const key = messageKey(list[i]!, i);
      workDurations = {
        ...workDurations,
        [key]: Math.max(0, Date.now() - lastPromptAt),
      };
      break;
    }
    lastPromptAt = 0;
  }

  function clearTurnBusy(playCompletion = false) {
    if (playCompletion && lastPromptAt > 0 && !turnHadError) {
      playFeedback("success");
    }
    recordWorkDuration();
    stream.clearTurn();
    awaitingSettle = false;
    sawServerStreaming = false;
    streaming = false;
    stopTurnWatch();
    queueSteer = [];
    queueFollowUp = [];
    turnHadError = false;
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
      if (stickBottom) void scrollBottom();
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
        clearTurnBusy(true);
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
      if (!opts?.quiet) void scrollBottom();
      else if (stickBottom) stickScroll();
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

  /** Focus the inline editor first, otherwise the home/footer composer. */
  function focusComposer() {
    void tick().then(() => {
      const el = document.querySelector(
        "section.chat-canvas [data-inline-message-editor] [data-slot=textarea], section.chat-canvas [data-slot=textarea]",
      ) as HTMLTextAreaElement | null;
      el?.focus();
      if (editing) {
        el?.setSelectionRange(el.value.length, el.value.length);
      }
    });
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
        workDurations = {};
        lastPromptAt = 0;
        streaming = false;
        bashRunning = false;
        showAllMsgs = false;
        failedPrompt = null;
        attachments = [];
        editing = null;
        // Home: keep last session path + model prefilled
        model = readLastModel();
        draftCwd = readLastCwd() || defaultCwd || draftCwd;
        queueSteer = [];
        queueFollowUp = [];
        closeEs?.();
        closeEs = null;
        wiredId = null;
      });
      focusComposer();
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
      // /fork: selected prompt lands in editor (one-shot from CommandPalette).
      const pending = takePendingEditorText();
      if (pending) draft = pending;
      wiredId = id;
      dropPending();
      showAllMsgs = false;
      failedPrompt = null;
      attachments = [];
      editing = null;
      const cached = historyCache.get(id);
      stream.bindSession(id, { messages: cached });
      messages = stream.messages.slice();
      workDurations = {};
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
      // Always land on last message (cache or empty → snapshot will stick-scroll)
      void scrollBottom();
    });
    focusComposer();

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

  // The POST response is the reliable completion signal. SSE still updates live
  // clients, while this one-shot reconciliation prevents a successful tree jump
  // from appearing to do nothing when its echo is missed by the active stream.
  $effect(() => {
    const navigation = treeNavigation;
    if (
      !navigation ||
      navigation.token === appliedTreeNavigationToken ||
      navigation.sessionId !== wiredId
    ) return;

    appliedTreeNavigationToken = navigation.token;
    untrack(() => {
      if (
        navigation.editorText &&
        !inlineEditSubmitting &&
        !draft.trim()
      ) {
        draft = navigation.editorText;
      }
      void load(navigation.sessionId, { force: true }).then(() =>
        loadMeta(navigation.sessionId),
      );
      focusComposer();
    });
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
    await sendText(text, mode, imgs, chatOptionsForSlashText(text));
  }

  function chatOptionsForSlashText(
    text: string,
    commands: SlashCommandInfo[] = slashCmds,
  ): ChatPromptOptions | undefined {
    const name = text.trim().match(/^\/([^\s]+)/)?.[1];
    if (!name) return undefined;
    const command = commands.find((item) => item.name === name);
    if (!command) return undefined;
    const skillName = skillNameForSlashCommand(command, commands);
    return {
      ...(skillName ? { skillName } : {}),
      commandName: command.name,
      commandSource: command.source,
    };
  }

  async function retryFailed() {
    if (!failedPrompt || sending) return;
    const { text, images, options } = failedPrompt;
    failedPrompt = null;
    error = null;
    await sendText(text, "default", images, options);
  }

  /** Shared by composer + palette (skills, etc.). */
  async function sendText(
    text: string,
    mode: "default" | "followUp" = "default",
    images: PromptImage[] = [],
    options?: ChatPromptOptions,
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
      failedPrompt = { text: body, images, options };
      sending = false;
      return;
    }
    if (!id) {
      error = "Could not open session";
      failedPrompt = { text: body, images, options };
      sending = false;
      return;
    }

    // A command can be submitted before a new session's slash metadata has
    // loaded (or immediately after opening an existing session). Resolve it
    // against the session before falling through to the normal prompt path.
    if (body.startsWith("/") && !options?.commandSource) {
      try {
        const remote = (await listCommands(id)).commands ?? [];
        slashRemote = remote;
        slashLoadedFor = id;
        options = chatOptionsForSlashText(body, remote) ?? options;
      } catch {
        // Preserve pi's normal prompt handling if command discovery fails.
      }
    }

    if (options?.commandSource === "extension" && options.commandName) {
      // Match the normal prompt path: a just-created session must own its SSE
      // stream before the optimistic command row is added, otherwise the
      // parent session update can reset and erase it.
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
      if (options.skillName) stream.pushOptimisticUser(body, options);
      else stream.pushCommand(body, options.commandName);
      paintMessages(false);
      syncTurnFlags();
      void scrollBottom();
      try {
        const result = await runCommand(id, body);
        if (stream.completeCommand(result.notifications, true)) paintMessages(false);
        syncTurnFlags();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        if (stream.finishCommand(false, error)) paintMessages(false);
        syncTurnFlags();
      } finally {
        sending = false;
      }
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
        turnHadError = false;
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
        stream.pushOptimisticUser(content, options);
        paintMessages(false);
        startedTurn = true;
        syncTurnFlags();
        lastPromptAt = stream.lastPromptAt;
        void scrollBottom();
        playFeedback("send");
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
      playFeedback("error");
      failedPrompt = { text: body, images, options };
      if (startedTurn) clearTurnBusy();
    } finally {
      sending = false;
    }
  }

  // Palette / skills call chatPrompt() → same optimistic path as typing in the composer
  $effect(() => {
    registerChatPrompt((text, options) => sendText(text, "default", [], options));
    return () => registerChatPrompt(null);
  });

  function pickSlash(cmd: SlashCommandInfo) {
    if (!cmd.name) return;
    if (cmd.source === "builtin") {
      draft = "";
      onBuiltinSlash?.(cmd.name);
      return;
    }
    const text = `/${cmd.name}`;
    if (cmd.argumentHint) {
      draft = `${text} `;
      return;
    }
    draft = "";
    void sendText(text, "default", [], chatOptionsForSlashText(text));
  }

  function onComposerSubmit() {
    if (slashOpen) {
      const cmd = slashFiltered[slashIdx];
      if (cmd) {
        pickSlash(cmd);
        return;
      }
    }
    void send("default");
  }

  function seedPrompt(text: string) {
    draft = text;
    focusComposer();
  }

  function onTextareaKey(e: KeyboardEvent) {
    if (slashQuery !== null && !slashHide) {
      if (e.key === "Escape") {
        e.preventDefault();
        slashHide = true;
        return;
      }
      if (slashFiltered.length) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          slashIdx = (slashIdx + 1) % slashFiltered.length;
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          slashIdx =
            (slashIdx - 1 + slashFiltered.length) % slashFiltered.length;
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          pickSlash(slashFiltered[slashIdx]!);
          return;
        }
      }
    }
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
        ? "Bash (no context)"
        : "Bash"
      : streaming
        ? "Steer (Enter) · follow-up (⌥Enter)"
        : "Message pi  (/ commands · ! bash)",
  );

  /** Home / empty chat: centered prompt (Cursor-style). */
  const isHome = $derived(messages.length === 0 && !busy && !sending);

  let workTick = $state(0);
  $effect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      workTick += 1;
    }, 1000);
    return () => clearInterval(timer);
  });

  /**
   * Group into turns (user → until next user) so each user prompt can stick
   * while that turn's assistant/tool output scrolls.
   */
  const messageTurns = $derived.by(() => {
    void workTick;
    const slice = messages.slice(hiddenMsgCount);
    type Item = { m: ChatMsg; i: number };
    type RawTurn = { startIndex: number; items: Item[] };
    const rawTurns: RawTurn[] = [];
    let cur: RawTurn | null = null;
    for (let j = 0; j < slice.length; j++) {
      const i = j + hiddenMsgCount;
      const m = slice[j]!;
      const followsStandaloneCommand = Boolean(
        cur?.items[0] && isComposerCommand(cur.items[0].m),
      );
      if (startsTopLevelTurn(m) || followsStandaloneCommand || !cur) {
        cur = { startIndex: i, items: [] };
        rawTurns.push(cur);
      }
      cur.items.push({ m, i });
    }
    return rawTurns.map((turn, turnIndex) => {
      const finalItem = [...turn.items]
        .reverse()
        .find(({ m }) => isFinalAssistantResponse(m));
      const hasAgent = turn.items.some(({ m }) => m.role === "assistant");
      const active = hasAgent && busy && turnIndex === rawTurns.length - 1 && !finalItem;
      const userItems = turn.items.filter(({ m }) => m.role === "user");
      const directItems = hasAgent
        ? []
        : turn.items.filter(({ m }) => m.role !== "user");
      const workItems = hasAgent
        ? turn.items.filter(
            ({ m, i }) =>
              m.role !== "user" &&
              (i !== finalItem?.i || hasAssistantWork(m)),
          )
        : [];
      const start = messageTimestamp(userItems[0]?.m ?? turn.items[0]?.m);
      const end = finalItem
        ? messageTimestamp(finalItem.m)
        : active
          ? Date.now()
          : messageTimestamp(turn.items[turn.items.length - 1]?.m);
      const turnKey = userItems[0]
        ? messageKey(userItems[0].m, userItems[0].i)
        : "";
      const storedDuration = turnKey ? workDurations[turnKey] : undefined;
      const timestampDuration =
        start !== null && end !== null && end >= start ? end - start : null;
      const durationMs =
        storedDuration ??
        (active && lastPromptAt > 0 ? Date.now() - lastPromptAt : timestampDuration);
      const duration =
        durationMs !== null && (active || durationMs >= 1000)
          ? formatWorkDuration(durationMs)
          : "";
      return {
        ...turn,
        userItems,
        directItems,
        workItems,
        finalItem,
        completed: !active,
        workLabel: `${active ? "Working" : "Worked"}${duration ? ` for ${duration}` : ""}`,
      };
    });
  });

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
        class="flex h-11 shrink-0 items-center gap-1 border-b border-black/[0.06] bg-[var(--pi-canvas)] px-2 dark:border-white/10"
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
    <div class="home-stage relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-[8vh] pt-8">
      <div class="home-aurora" aria-hidden="true"></div>
      <div class="home-intro relative z-[1] mb-7 max-w-xl text-center">
        <h1 class="text-balance text-2xl font-semibold tracking-[-0.03em] sm:text-[2rem]">
          What will we build?
        </h1>
        <p class="mt-2.5 text-pretty text-sm leading-6 text-muted-foreground">
          {#if session?.id}
            This session is ready for its first task.
          {:else}
            Describe a task, choose a folder, and pi will take it from there.
          {/if}
        </p>
      </div>
      <div
        class="home-composer relative z-[2] w-full max-w-2xl"
        ondragover={onComposerDragOver}
        ondrop={onComposerDrop}
      >
        <SlashMenu
          open={slashOpen}
          items={slashFiltered}
          active={slashIdx}
          onPick={pickSlash}
          onActive={(i) => (slashIdx = i)}
        />
        <ChatComposer
          class={promptBoxClass}
          bind:value={draft}
          {attachments}
          placeholder="Describe a task · / commands · ! bash"
          textareaClass="min-h-[56px] text-[15px]"
          isLoading={sending}
          {canSend}
          sessionId={session?.id}
          sessionCwd={session?.cwd}
          model={activeModel}
          showFolderContext
          folderValue={draftCwd}
          defaultFolder={defaultCwd}
          onSubmit={onComposerSubmit}
          onFiles={(files) => void addImageFiles(files)}
          onRemoveAttachment={removeAttach}
          onPaste={onComposerPaste}
          onKeydown={onTextareaKey}
          onModelChange={onModelChange}
          onError={(message) => (error = message)}
          onFolderChange={onFolderChange}
        />
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
      <div class="home-suggestions relative z-[1] mt-4 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Prompt suggestions">
        <button type="button" class="pi-tactile prompt-seed" onclick={() => seedPrompt("Explore this codebase and explain how its main pieces fit together") }>
          <Telescope class="size-3.5" aria-hidden="true" />
          <span>Explore the codebase</span>
        </button>
        <button type="button" class="pi-tactile prompt-seed" onclick={() => seedPrompt("Find a meaningful bug in this codebase, explain the cause, and fix it") }>
          <Bug class="size-3.5" aria-hidden="true" />
          <span>Find and fix a bug</span>
        </button>
        <button type="button" class="pi-tactile prompt-seed" onclick={() => seedPrompt("Help me shape and plan a thoughtful new feature for this project") }>
          <MapIcon class="size-3.5" aria-hidden="true" />
          <span>Plan a feature</span>
        </button>
      </div>
      <div class="home-hint relative z-[1] mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
        <Sparkles class="size-3" aria-hidden="true" />
        Suggestions fill the prompt — nothing sends until you choose.
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
          {#each messageTurns as turn (turn.startIndex)}
            <div class="message-turn flex flex-col gap-5">
              {#each turn.userItems as { m, i } (messageKey(m, i))}
                {#if editing?.index === i}
                  <div
                    data-inline-message-editor
                    class="relative w-full"
                    ondragover={onComposerDragOver}
                    ondrop={onComposerDrop}
                  >
                    <div class="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">
                      Edit message · sending starts a new branch
                    </div>
                    <ChatComposer
                      class={`${promptBoxClass} ring-2 ring-primary/20`}
                      bind:value={draft}
                      {attachments}
                      placeholder="Edit message"
                      isLoading={sending || inlineEditSubmitting}
                      disabled={inlineEditSubmitting}
                      canSend={canSend && !inlineEditSubmitting}
                      sessionId={session?.id}
                      model={activeModel}
                      cancelable
                      sendTooltip="Send edited message"
                      onSubmit={submitInlineEdit}
                      onCancel={cancelInlineEdit}
                      onFiles={(files) => void addImageFiles(files)}
                      onRemoveAttachment={removeAttach}
                      onPaste={onComposerPaste}
                      onKeydown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelInlineEdit();
                        }
                      }}
                      onModelChange={onModelChange}
                      onError={(message) => (error = message)}
                    />
                  </div>
                {:else}
                  <MessageBubble
                    message={m}
                    messages={messages}
                    index={i}
                    onEditUser={() => editUserMessage(m, i)}
                    onForkUser={forkUserMessage}
                    sticky={true}
                  />
                {/if}
              {/each}

              {#if turn.workItems.length > 0}
                <details
                  class="group/work min-w-0"
                  open={!turn.completed}
                >
                  <summary
                    class="flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden"
                  >
                    {#if !turn.completed}
                      <span class="size-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true"></span>
                    {/if}
                    <span>{turn.workLabel}</span>
                    <ChevronDown
                      class="size-3.5 -rotate-90 transition-transform group-open/work:rotate-0"
                    />
                  </summary>
                  <div class="mt-2 flex min-w-0 flex-col gap-3">
                    {#each turn.workItems as { m, i } (messageKey(m, i))}
                      {#if !(m.role === "toolResult" && isPairedToolResult(messages, i))}
                        {@const isLiveAssistant =
                          busy &&
                          m.role === "assistant" &&
                          !messages
                            .slice(i + 1)
                            .some((x) => x.role === "assistant" || x.role === "user")}
                        <MessageBubble
                          message={m}
                          messages={messages}
                          index={i}
                          streaming={isLiveAssistant}
                          assistantMode={i === turn.finalItem?.i ? "work-only" : "all"}
                        />
                      {/if}
                    {/each}
                  </div>
                </details>
              {/if}

              {#if turn.finalItem}
                <MessageBubble
                  message={turn.finalItem.m}
                  messages={messages}
                  index={turn.finalItem.i}
                  assistantMode="final-only"
                />
              {/if}

              {#each turn.directItems as { m, i } (messageKey(m, i))}
                {#if !(m.role === "toolResult" && isPairedToolResult(messages, i))}
                  {@const isLiveBash =
                    busy && m.role === "bashExecution" && i === messages.length - 1}
                    <MessageBubble
                      message={m}
                      messages={messages}
                      index={i}
                      streaming={isLiveBash}
                    />
                {/if}
              {/each}
            </div>
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
          {#if busy && bashRunning}
            <div class="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
              <span bind:this={spinEl} class="font-mono text-primary" aria-hidden="true">⠋</span>
              <span>bash</span>
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

    {#if !editing}
      <footer class="chat-footer p-3">
        <div
          class="relative mx-auto w-full max-w-5xl"
          ondragover={onComposerDragOver}
          ondrop={onComposerDrop}
        >
          <SlashMenu
            open={slashOpen}
            items={slashFiltered}
            active={slashIdx}
            onPick={pickSlash}
            onActive={(i) => (slashIdx = i)}
          />
          <ChatComposer
            class={promptBoxClass}
            bind:value={draft}
            {attachments}
            {placeholder}
            isLoading={busy}
            disabled={session ? !session.running && !session.id : false}
            {canSend}
            {busy}
            sendTooltip={bashMode ? "Run bash" : "Send"}
            sessionId={session?.id}
            model={activeModel}
            showModel={Boolean(session?.id)}
            modelDisabled={session ? !session.running && !session.id : false}
            onSubmit={onComposerSubmit}
            onStop={stop}
            onFiles={(files) => void addImageFiles(files)}
            onRemoveAttachment={removeAttach}
            onPaste={onComposerPaste}
            onKeydown={onTextareaKey}
            onModelChange={onModelChange}
            onError={(message) => (error = message)}
          />
        </div>
      </footer>
    {/if}
  {/if}

</section>

<style>
  .chat-canvas {
    background: var(--pi-canvas);
    color: hsl(240 10% 3.9%);
  }
  :global(html.dark) .chat-canvas {
    color: hsl(0 0% 98%);
  }
  .chat-footer {
    background: var(--pi-canvas);
  }

  .home-aurora {
    position: absolute;
    top: 46%;
    left: 50%;
    width: min(780px, 86vw);
    height: min(520px, 62vh);
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background:
      radial-gradient(circle at 28% 42%, color-mix(in oklab, hsl(265 84% 72%) 20%, transparent) 0, transparent 43%),
      radial-gradient(circle at 72% 44%, color-mix(in oklab, hsl(190 82% 62%) 16%, transparent) 0, transparent 45%),
      radial-gradient(circle at 50% 72%, color-mix(in oklab, hsl(35 96% 65%) 11%, transparent) 0, transparent 48%);
    filter: blur(38px);
    opacity: 0.72;
    pointer-events: none;
  }

  .prompt-seed {
    display: inline-flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid color-mix(in oklab, currentColor 10%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--pi-canvas) 78%, transparent);
    padding: 0.55rem 0.75rem;
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
    font-weight: 500;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.5) inset;
    backdrop-filter: blur(12px);
    transition-property: color, background-color, border-color, transform, box-shadow;
    transition-duration: 180ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  .prompt-seed:hover {
    color: hsl(var(--foreground));
    background: color-mix(in oklab, var(--pi-canvas) 52%, white);
    border-color: color-mix(in oklab, currentColor 18%, transparent);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
    transform: translateY(-1px);
  }

  :global(html.dark) .prompt-seed:hover {
    background: color-mix(in oklab, var(--pi-canvas) 88%, white 12%);
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.2);
  }

  @media (prefers-reduced-motion: no-preference) {
    .home-aurora {
      animation: aurora-drift 12s ease-in-out infinite alternate;
    }

    .home-intro,
    .home-composer,
    .home-suggestions,
    .home-hint {
      animation: home-enter 460ms cubic-bezier(0.2, 0, 0, 1) both;
    }

    .home-composer { animation-delay: 60ms; }
    .home-suggestions { animation-delay: 120ms; }
    .home-hint { animation-delay: 180ms; }

    .message-turn {
      animation: turn-enter 300ms cubic-bezier(0.2, 0, 0, 1) both;
    }
  }

  @keyframes aurora-drift {
    from { transform: translate(-52%, -49%) scale(0.96) rotate(-2deg); }
    to { transform: translate(-48%, -51%) scale(1.04) rotate(2deg); }
  }

  @keyframes home-enter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes turn-enter {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
