<script lang="ts">
  import type { SessionRow } from "$lib/api";
  import {
    listSessions,
    openSession,
    closeSession,
    patchSession,
    compactSession,
    getMessages,
    getSession,
    getHealth,
    setModel,
    setThinking,
    abort,
  } from "$lib/api";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import SessionList from "$lib/components/SessionList.svelte";
  import GitDiffSidebar from "$lib/components/GitDiffSidebar.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  const SIDEBAR_KEY = "pi-gui-sidebar-open";
  const GIT_SIDEBAR_KEY = "pi-gui-git-sidebar-open";

  let sessions = $state<SessionRow[]>([]);
  let selected = $state<SessionRow | undefined>(undefined);
  /** First successful (or failed) /api/sessions fetch — never re-block the sidebar. */
  let listReady = $state(false);
  let err = $state<string | null>(null);
  let sidebarOpen = $state(
    (() => {
      try {
        return localStorage.getItem(SIDEBAR_KEY) !== "0";
      } catch {
        return true;
      }
    })(),
  );
  let gitSidebarOpen = $state(
    (() => {
      try {
        return localStorage.getItem(GIT_SIDEBAR_KEY) === "1";
      } catch {
        return false;
      }
    })(),
  );

  function setSidebarOpen(open: boolean) {
    sidebarOpen = open;
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function setGitSidebarOpen(open: boolean) {
    gitSidebarOpen = open;
    try {
      localStorage.setItem(GIT_SIDEBAR_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  /** Non-fatal open note (e.g. model restore fallback) — dismissible */
  let warn = $state<string | null>(null);
  let cmdkOpen = $state(false);
  /** Server process.cwd() — fallback folder for new sessions */
  let defaultCwd = $state("");
  /** Prevent double-click open storms */
  let opening = false;
  /** Apply /sessions/:id once after first list load */
  let routedOnce = false;

  function sessionKey(s: SessionRow) {
    return s.path || s.id;
  }

  function pathSessionId(): string | null {
    const m = location.pathname.match(/^\/sessions\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setSessionUrl(id: string | undefined, mode: "push" | "replace" = "push") {
    const next = id ? `/sessions/${encodeURIComponent(id)}` : "/";
    if (location.pathname === next) return;
    if (mode === "replace") history.replaceState(null, "", next);
    else history.pushState(null, "", next);
  }

  /** Keep sidebar order stable across refresh (server sorts by modified). */
  function mergeSessions(prev: SessionRow[], next: SessionRow[]): SessionRow[] {
    if (prev.length === 0) return next;
    const byKey = new Map(next.map((s) => [sessionKey(s), s]));
    const used = new Set<string>();
    const out: SessionRow[] = [];
    for (const s of prev) {
      const k = sessionKey(s);
      const n = byKey.get(k);
      if (n) {
        out.push(n);
        used.add(k);
      }
    }
    for (const s of next) {
      const k = sessionKey(s);
      if (!used.has(k)) out.push(s);
    }
    return out;
  }

  function upsertSession(row: SessionRow) {
    const i = sessions.findIndex(
      (s) => s.id === row.id || (row.path && s.path === row.path),
    );
    if (i >= 0) {
      sessions = sessions.map((s, idx) =>
        idx === i ? { ...s, ...row, running: true } : s,
      );
    } else {
      // Append — don't jump the list to put new sessions on top
      sessions = [...sessions, { ...row, running: true }];
    }
  }

  function noteFallback(opened: { modelFallbackMessage?: string }) {
    if (opened.modelFallbackMessage) warn = opened.modelFallbackMessage;
  }

  async function refresh() {
    try {
      const { sessions: rows } = await listSessions();
      sessions = mergeSessions(sessions, rows);
      err = null;
      if (selected) {
        const row = rows.find(
          (r) =>
            r.id === selected?.id ||
            (selected?.path && r.path === selected.path),
        );
        if (row) {
          const nextId = row.running ? row.id : selected.id;
          selected = {
            ...selected,
            id: nextId,
            running: row.running,
            messageCount: row.messageCount,
            firstMessage: row.firstMessage,
            name: row.name ?? selected.name,
            sessionName: row.sessionName ?? selected.sessionName,
            modified: row.modified,
            path: row.path ?? selected.path,
          };
          if (pathSessionId() && pathSessionId() !== nextId) {
            setSessionUrl(nextId, "replace");
          }
        }
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      listReady = true;
    }
  }

  async function onSelect(s: SessionRow, opts?: { replaceUrl?: boolean }) {
    // Already focused — zero network
    if (
      selected &&
      (selected.id === s.id || (s.path && selected.path === s.path))
    ) {
      setSessionUrl(selected.id, opts?.replaceUrl ? "replace" : "push");
      return;
    }

    err = null;
    const urlMode = opts?.replaceUrl ? "replace" : "push";

    // Already open in hub — just switch UI (no POST /api/sessions)
    if (s.running) {
      selected = s;
      upsertSession(s); // e.g. /fork returns a mounted session not yet in the list
      setSessionUrl(s.id, urlMode);
      return;
    }

    if (opening) return;
    opening = true;
    try {
      if (s.path) {
        const opened = await openSession({
          path: s.path,
          cwd: s.cwd || undefined,
        });
        noteFallback(opened);
        const row = { ...s, ...opened, running: true };
        selected = row;
        upsertSession(row);
        // Hub id may differ from disk list id — replace keeps one history entry
        setSessionUrl(
          row.id,
          pathSessionId() && pathSessionId() !== row.id ? "replace" : urlMode,
        );
      } else {
        const opened = await openSession({ fresh: true });
        noteFallback(opened);
        const row = { ...opened, running: true, firstMessage: "" };
        selected = row;
        upsertSession(row);
        setSessionUrl(row.id, urlMode);
      }
      // Re-list so sidebar Open/Recent and palette match hub (id may change on resume)
      await refresh();
      // List can miss the open hub session (path/id mismatch) — keep local truth
      if (selected) upsertSession({ ...selected, running: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/Session not open/i.test(msg)) err = msg;
    } finally {
      opening = false;
    }
  }

  /** Home — no hub session until first prompt. Optional cwd seeds the folder picker. */
  let forceCwd = $state<string | null>(null);
  function onNew(cwd?: string) {
    err = null;
    forceCwd = cwd ?? null;
    selected = undefined;
    setSessionUrl(undefined);
  }

  async function ensureSession(opts?: {
    cwd?: string;
    model?: { provider?: string; id?: string };
  }): Promise<SessionRow> {
    const opened = await openSession({
      fresh: true,
      cwd: opts?.cwd || undefined,
    });
    noteFallback(opened);
    let row: SessionRow = { ...opened, running: true, firstMessage: "" };
    if (opts?.model?.provider && opts?.model?.id) {
      try {
        const updated = await setModel(row.id, {
          provider: opts.model.provider,
          id: opts.model.id,
        });
        row = { ...row, ...updated, running: true };
      } catch {
        /* keep default model from create */
      }
    }
    selected = row;
    upsertSession(row);
    setSessionUrl(row.id);
    return row;
  }

  function onSessionUpdate(id: string, patch: Partial<SessionRow>) {
    if (selected?.id === id) {
      selected = { ...selected, ...patch };
      if (patch.id && patch.id !== id) setSessionUrl(patch.id, "replace");
    }
    sessions = sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }

  async function onRename(name: string) {
    if (!selected?.id) return;
    try {
      await patchSession(selected.id, { name });
      onSessionUpdate(selected.id, { name });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  /** /import — browser file picker → upload JSONL → open session. */
  async function onImport(content: string, filename?: string) {
    err = null;
    if (opening) throw new Error("Already opening a session");
    opening = true;
    try {
      const opened = await openSession({ content, filename });
      noteFallback(opened);
      const row: SessionRow = { ...opened, running: true };
      selected = row;
      upsertSession(row);
      setSessionUrl(row.id);
      await refresh();
      if (selected) upsertSession({ ...selected, running: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      err = msg;
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      opening = false;
    }
  }

  async function onCompact() {
    if (!selected?.id) return;
    try {
      await compactSession(selected.id);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onCloseCurrent() {
    if (!selected?.id) return;
    try {
      await closeSession(selected.id);
      selected = undefined;
      setSessionUrl(undefined);
      await refresh();
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function routeFromUrl() {
    const id = pathSessionId();
    if (!id) {
      selected = undefined;
      return;
    }
    if (selected?.id === id) return;
    let row = sessions.find((s) => s.id === id || s.path === id);
    if (!row) {
      // Disk id / cold URL: GET ensures open, returns canonical hub id
      try {
        const detail = await getSession(id);
        row = { ...detail, running: true };
        upsertSession(row);
        if (detail.id !== id) setSessionUrl(detail.id, "replace");
      } catch {
        setSessionUrl(undefined, "replace");
        err = "Session not found";
        return;
      }
    }
    await onSelect(row, { replaceUrl: true });
  }

  async function onCopyLast() {
    if (!selected?.id) return;
    try {
      const { messages } = await getMessages(selected.id);
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          const text = messages[i].content;
          const copyText =
            typeof text === "string"
              ? text
              : Array.isArray(text)
                ? text
                    .filter((p) => p && typeof p === "object" && p.type === "text")
                    .map((p) => p.text)
                    .join("")
                : "";
          if (copyText) {
            await navigator.clipboard.writeText(copyText);
          }
          break;
        }
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onCycleModel(dir: "forward" | "backward") {
    if (!selected?.id) return;
    try {
      const row = await setModel(selected.id, { cycle: dir });
      onSessionUpdate(selected.id, {
        model: row.model,
        thinkingLevel: row.thinkingLevel ?? selected.thinkingLevel,
      });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onSetModel(provider: string, id: string) {
    if (!selected?.id) return;
    try {
      const row = await setModel(selected.id, { provider, id });
      onSessionUpdate(selected.id, {
        model: row.model ?? { provider, id },
        thinkingLevel: row.thinkingLevel ?? selected.thinkingLevel,
      });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onCycleThinking() {
    if (!selected?.id) return;
    try {
      const res = await setThinking(selected.id, { cycle: true });
      onSessionUpdate(selected.id, {
        thinkingLevel: res.level ?? res.thinkingLevel,
      });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onSetThinking(level: string) {
    if (!selected?.id) return;
    try {
      const res = await setThinking(selected.id, { level });
      onSessionUpdate(selected.id, {
        thinkingLevel: res.level ?? res.thinkingLevel ?? level,
      });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function onAbort() {
    if (!selected?.id) return;
    try {
      await abort(selected.id);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        cmdkOpen = !cmdkOpen;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  $effect(() => {
    const onPop = () => {
      void routeFromUrl();
    };
    window.addEventListener("popstate", onPop);

    void (async () => {
      await refresh();
      if (!routedOnce) {
        routedOnce = true;
        await routeFromUrl();
      }
      try {
        const h = await getHealth();
        if (h.cwd) defaultCwd = h.cwd;
      } catch {
        /* ignore */
      }
    })();

    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => {
      clearInterval(t);
      window.removeEventListener("popstate", onPop);
    };
  });
</script>

<div class="flex h-svh w-full overflow-hidden bg-background text-foreground">
  {#if sidebarOpen}
    <SessionList
      {sessions}
      selectedId={selected?.id}
      {listReady}
      onSelect={onSelect}
      onNew={onNew}
      onCollapse={() => setSidebarOpen(false)}
      onOpenPalette={() => (cmdkOpen = true)}
    />
  {/if}
  <div class="flex min-w-0 flex-1 flex-col">
    {#if err}
      <div
        class="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {err}
      </div>
    {/if}
    {#if warn}
      <div
        class="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
      >
        <span class="min-w-0">{warn}</span>
        <button
          type="button"
          class="shrink-0 text-xs underline opacity-80 hover:opacity-100"
          onclick={() => (warn = null)}
        >
          Dismiss
        </button>
      </div>
    {/if}
    <ChatPanel
      session={selected}
      {defaultCwd}
      {forceCwd}
      {onSessionUpdate}
      onEnsureSession={ensureSession}
      showExpandSidebar={!sidebarOpen}
      showExpandGit={!gitSidebarOpen}
      onExpandSidebar={() => setSidebarOpen(true)}
      onExpandGit={() => setGitSidebarOpen(true)}
    />
  </div>
  {#if gitSidebarOpen}
    <GitDiffSidebar
      sessionId={selected?.running ? selected.id : undefined}
      cwd={selected?.cwd}
      onCollapse={() => setGitSidebarOpen(false)}
    />
  {/if}
</div>

<CommandPalette
  open={cmdkOpen}
  onClose={() => (cmdkOpen = false)}
  session={selected}
  {sessions}
  onNew={onNew}
  onResume={onSelect}
  onRename={onRename}
  {onImport}
  onCompact={onCompact}
  onCloseSession={onCloseCurrent}
  onCopyLast={onCopyLast}
  {onCycleModel}
  {onSetModel}
  {onCycleThinking}
  {onSetThinking}
  {onAbort}
/>
