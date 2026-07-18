<script lang="ts">
  import type { SessionRow } from "$lib/api";
  import Separator from "agentic-ui-kit/components/ui/separator.svelte";
  import ThemeToggle from "agentic-ui-kit/components/ui/theme-toggle.svelte";
  import SoundToggle from "$lib/components/SoundToggle.svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import MessageSquarePlus from "@lucide/svelte/icons/message-square-plus";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Archive from "@lucide/svelte/icons/archive";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import Command from "@lucide/svelte/icons/command";

  type Props = {
    sessions: SessionRow[];
    selectedId?: string;
    /** First /api/sessions attempt finished (success or fail). */
    listReady?: boolean;
    onSelect: (s: SessionRow) => void;
    /** Optional cwd — new session in that folder. */
    onNew: (cwd?: string) => void;
    onCollapse?: () => void;
    /** Open command palette (⌘K / Ctrl+K). */
    onOpenPalette?: () => void;
  };

  let {
    sessions,
    selectedId,
    listReady = false,
    onSelect,
    onNew,
    onCollapse,
    onOpenPalette,
  }: Props = $props();

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  /** Folder keys the user collapsed. Absent = open (default expanded). */
  let collapsed = $state(new Set<string>());

  const FOLDER_ORDER_KEY = "pi-gui-sidebar-folder-order";
  const SESSION_ORDER_KEY = "pi-gui-sidebar-session-order";
  /** Demoted from Active → Recent (not hidden). Legacy key name kept. */
  const ARCHIVED_KEY = "pi-gui-sidebar-archived";
  const WIDTH_KEY = "pi-gui-sidebar-width";
  const WIDTH_MIN = 200;
  const WIDTH_MAX = 480;
  const WIDTH_DEFAULT = 360;
  const ACTIVE_MS = 24 * 60 * 60 * 1000;
  const RECENT_PAGE = 5;

  function clampWidth(n: number) {
    return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(n)));
  }

  function loadWidth(): number {
    try {
      const raw = localStorage.getItem(WIDTH_KEY);
      if (raw === null) return WIDTH_DEFAULT;
      const n = Number(raw);
      return Number.isFinite(n) ? clampWidth(n) : WIDTH_DEFAULT;
    } catch {
      return WIDTH_DEFAULT;
    }
  }

  let width = $state(loadWidth());
  let resizing = $state(false);

  function onResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    resizing = true;
    const startX = e.clientX;
    const startW = width;

    function onMove(ev: PointerEvent) {
      width = clampWidth(startW + (ev.clientX - startX));
    }
    function onUp(ev: PointerEvent) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      resizing = false;
      try {
        localStorage.setItem(WIDTH_KEY, String(width));
      } catch {
        /* ignore */
      }
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  function loadJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }

  let folderOrder = $state<string[]>(loadJson(FOLDER_ORDER_KEY, []));
  let sessionOrder = $state<string[]>(loadJson(SESSION_ORDER_KEY, []));
  /** User moved these out of Active into Recent (still visible). */
  let demoted = $state(new Set<string>(loadJson<string[]>(ARCHIVED_KEY, [])));
  /** How many Recent rows to show (grows by RECENT_PAGE via Show more). */
  let recentShown = $state(RECENT_PAGE);

  type Drag =
    | { kind: "folder"; key: string }
    | { kind: "session"; key: string; folder: string }
    | null;
  let drag = $state<Drag>(null);

  function saveFolderOrder(keys: string[]) {
    folderOrder = keys;
    saveJson(FOLDER_ORDER_KEY, keys);
  }

  function saveSessionOrder(keys: string[]) {
    sessionOrder = keys;
    saveJson(SESSION_ORDER_KEY, keys);
  }

  function sk(s: SessionRow) {
    return s.path || s.id;
  }

  function demoteKeys(s: SessionRow): string[] {
    return [...new Set([sk(s), s.path, s.id].filter(Boolean) as string[])];
  }

  function isDemoted(s: SessionRow) {
    return demoteKeys(s).some((k) => demoted.has(k));
  }

  /** Move from Active → Recent (still listed; not hidden). */
  function moveToRecent(s: SessionRow, e: MouseEvent) {
    e.stopPropagation();
    const next = new Set(demoted);
    next.add(sk(s));
    demoted = next;
    saveJson(ARCHIVED_KEY, [...next]);
  }

  /** Opening a session clears demotion so it can sit in Active again if eligible. */
  function clearDemotion(s: SessionRow) {
    const next = new Set(demoted);
    let hit = false;
    for (const k of demoteKeys(s)) {
      if (next.delete(k)) hit = true;
    }
    if (!hit) return;
    demoted = next;
    saveJson(ARCHIVED_KEY, [...next]);
  }

  function selectSession(s: SessionRow) {
    clearDemotion(s);
    onSelect(s);
  }

  // Palette / URL resume updates selectedId without going through selectSession
  $effect(() => {
    if (!selectedId) return;
    const s = sessions.find(
      (x) => x.id === selectedId || x.path === selectedId,
    );
    if (s && isDemoted(s)) clearDemotion(s);
  });

  function activityMs(s: SessionRow): number {
    if (s.modified) {
      const t = new Date(s.modified).getTime();
      if (Number.isFinite(t)) return t;
    }
    if (s.created) {
      const t = new Date(s.created).getTime();
      if (Number.isFinite(t)) return t;
    }
    // Hub-open with no timestamps — treat as active now
    return s.running ? Date.now() : 0;
  }

  /** Active: hub-running or activity within 24h, unless user moved to Recent. */
  function isActive(s: SessionRow): boolean {
    if (isDemoted(s)) return false;
    if (s.running) return true;
    const t = activityMs(s);
    return t > 0 && Date.now() - t < ACTIVE_MS;
  }

  const openSessions = $derived(sessions.filter(isActive));

  const pastSessionsAll = $derived.by(() => {
    const out = sessions.filter((s) => !isActive(s));
    out.sort((a, b) => activityMs(b) - activityMs(a));
    return out;
  });

  const pastSessions = $derived(pastSessionsAll.slice(0, recentShown));
  const recentHasMore = $derived(pastSessionsAll.length > recentShown);

  function showMoreRecent() {
    recentShown += RECENT_PAGE;
  }

  function label(s: SessionRow) {
    if (s.name) return s.name;
    if (s.sessionName) return s.sessionName;
    if (s.firstMessage?.trim()) {
      return s.firstMessage.trim().replace(/\s+/g, " ");
    }
    return s.id.slice(0, 8);
  }

  function folderLabel(cwd: string) {
    if (!cwd) return "Other";
    const segs = cwd.split("/").filter(Boolean);
    return segs.at(-1) || cwd;
  }

  function toggle(key: string) {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsed = next;
  }

  function isOpen(key: string) {
    return !collapsed.has(key);
  }

  function rankSort<T>(items: T[], keyOf: (t: T) => string, order: string[]): T[] {
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...items].sort((a, b) => {
      const ra = rank.has(keyOf(a)) ? rank.get(keyOf(a))! : Number.POSITIVE_INFINITY;
      const rb = rank.has(keyOf(b)) ? rank.get(keyOf(b))! : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }

  function groupByFolder(list: SessionRow[]) {
    const map = new Map<string, SessionRow[]>();
    for (const s of list) {
      const key = s.cwd || "";
      let items = map.get(key);
      if (!items) map.set(key, (items = []));
      items.push(s);
    }
    const entries = [...map.entries()].map(([cwd, items]) => ({
      key: cwd || "__other__",
      cwd,
      name: folderLabel(cwd),
      items: rankSort(items, sk, sessionOrder),
    }));
    return rankSort(entries, (g) => g.key, folderOrder);
  }

  const groups = $derived(groupByFolder(openSessions));

  function reorder(keys: string[], fromKey: string, toKey: string): string[] | null {
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0 || from === to) return null;
    const next = [...keys];
    next.splice(from, 1);
    next.splice(to, 0, fromKey);
    return next;
  }

  function onFolderDragStart(e: DragEvent, key: string) {
    drag = { kind: "folder", key };
    e.dataTransfer?.setData("text/plain", `folder:${key}`);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function onFolderDragOver(e: DragEvent, key: string) {
    if (!drag || drag.kind !== "folder" || drag.key === key) return;
    e.preventDefault();
    const vis = groups.map((g) => g.key);
    const reordered = reorder(vis, drag.key, key);
    if (!reordered) return;
    const rest = folderOrder.filter((k) => !reordered.includes(k));
    const next = [...reordered, ...rest];
    if (next.join("\0") !== folderOrder.join("\0")) saveFolderOrder(next);
  }

  function onSessionDragStart(e: DragEvent, s: SessionRow, folder: string) {
    e.stopPropagation();
    const key = sk(s);
    drag = { kind: "session", key, folder };
    e.dataTransfer?.setData("text/plain", `session:${key}`);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function onSessionDragOver(e: DragEvent, s: SessionRow, folder: string) {
    if (!drag || drag.kind !== "session" || drag.folder !== folder) return;
    e.preventDefault();
    e.stopPropagation();
    const toKey = sk(s);
    if (drag.key === toKey) return;
    const g = groups.find((x) => x.key === folder);
    if (!g) return;
    const vis = g.items.map(sk);
    const reordered = reorder(vis, drag.key, toKey);
    if (!reordered) return;
    const rest = sessionOrder.filter((k) => !reordered.includes(k));
    const next = [...reordered, ...rest];
    if (next.join("\0") !== sessionOrder.join("\0")) saveSessionOrder(next);
  }

  function onDragEnd() {
    drag = null;
  }
</script>

<aside
  class="relative flex h-full shrink-0 flex-col border-r border-border bg-card"
  class:select-none={resizing}
  style="width: {width}px"
>
  <div
    class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
  >
    <div class="flex min-w-0 items-center gap-2">
      <img src="/favicon.svg" alt="" width="22" height="22" class="size-[22px] shrink-0 rounded-[5px]" />
      <div class="min-w-0 whitespace-nowrap text-sm font-semibold tracking-tight">pi-gui</div>
    </div>
    <div class="flex shrink-0 items-center gap-0.5">
      <SoundToggle />
      <ThemeToggle mode="toggle" />
      {#if onCollapse}
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
          onclick={onCollapse}
        >
          <PanelLeftClose class="size-4" />
        </button>
      {/if}
    </div>
  </div>
  <!-- min-h-0 so flex child can shrink and scroll when sessions overflow -->
  <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
    <div class="flex flex-col gap-0.5 p-2">
      <button
        type="button"
        class="pi-tactile mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-[background-color,transform] hover:bg-muted/80
          {!selectedId ? 'bg-muted' : ''}"
        onclick={() => onNew()}
      >
        <MessageSquarePlus class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate">New session</span>
      </button>

      <Separator class="my-1.5" />
      <div class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sessions
      </div>

      {#if openSessions.length === 0}
        <div class="px-2 py-6 text-center text-xs text-muted-foreground">
          {listReady ? "No open sessions" : "Loading"}
        </div>
      {:else}
        {#each groups as g (g.key)}
          {@const open = isOpen(g.key)}
          <div
            class={drag?.kind === "folder" && drag.key === g.key ? "opacity-50" : ""}
            ondragover={(e) => onFolderDragOver(e, g.key)}
          >
            <div
              class="sidebar-row group flex w-full items-center rounded-md text-xs font-medium text-foreground hover:bg-muted/80"
              class:has-two-actions={Boolean(g.cwd)}
            >
              <button
                type="button"
                class="sidebar-row-main flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left"
                title={g.cwd || undefined}
                onclick={() => toggle(g.key)}
              >
                <ChevronRight
                  class="size-3.5 shrink-0 text-muted-foreground transition-transform {open
                    ? 'rotate-90'
                    : ''}"
                />
                {#if open}
                  <FolderOpen class="size-3.5 shrink-0 text-muted-foreground" />
                {:else}
                  <Folder class="size-3.5 shrink-0 text-muted-foreground" />
                {/if}
                <span class="min-w-0 flex-1 truncate">{g.name}</span>
              </button>
              <div class="sidebar-row-actions">
                <button
                  type="button"
                  class="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-label="Drag to reorder {g.name}"
                  draggable="true"
                  ondragstart={(e) => onFolderDragStart(e, g.key)}
                  ondragend={onDragEnd}
                >
                  <GripVertical class="size-3.5" />
                </button>
                {#if g.cwd}
                  <button
                    type="button"
                    class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="New session in {g.name}"
                    aria-label="New session in {g.name}"
                    onclick={() => onNew(g.cwd)}
                  >
                    <Plus class="size-3.5" />
                  </button>
                {/if}
              </div>
            </div>
            {#if open}
              <ul class="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                {#each g.items as s (s.id + (s.path ?? ""))}
                  {@const key = sk(s)}
                  <li
                    class={drag?.kind === "session" && drag.key === key ? "opacity-50" : ""}
                    ondragover={(e) => onSessionDragOver(e, s, g.key)}
                  >
                    <div
                      class="sidebar-row has-two-actions group/item flex items-center rounded-lg transition-colors hover:bg-muted/80
                        {selectedId === s.id ? 'bg-muted' : ''}"
                    >
                      <button
                        type="button"
                        class="sidebar-row-main pi-tactile min-w-0 rounded-lg px-2 py-1.5 text-left"
                        onclick={() => selectSession(s)}
                      >
                        <div class="flex min-w-0 items-center gap-1.5">
                          {#if s.streaming}
                            <span
                              class="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500"
                              title="Streaming"
                              aria-label="Streaming"
                            ></span>
                          {:else if s.bound}
                            <span
                              class="size-1.5 shrink-0 rounded-full bg-sky-500"
                              title="Live TUI session"
                              aria-label="Live TUI session"
                            ></span>
                          {/if}
                          <span class="min-w-0 flex-1 truncate text-xs font-medium">{label(s)}</span>
                          {#if s.bound}
                            <span
                              class="shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400"
                              title="Attached from pi TUI"
                            >tui</span>
                          {/if}
                        </div>
                      </button>
                      <div class="sidebar-row-actions">
                        <button
                          type="button"
                          class="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                          title="Drag to reorder"
                          aria-label="Drag to reorder session"
                          draggable="true"
                          ondragstart={(e) => onSessionDragStart(e, s, g.key)}
                          ondragend={onDragEnd}
                        >
                          <GripVertical class="size-3.5" />
                        </button>
                        <button
                          type="button"
                          class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Move to Recent"
                          aria-label="Move to Recent"
                          onclick={(e) => moveToRecent(s, e)}
                        >
                          <Archive class="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      {/if}

      {#if pastSessionsAll.length > 0}
        {@const recentOpen = isOpen("__recent__")}
        <Separator class="my-2" />
        <button
          type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          onclick={() => toggle("__recent__")}
        >
          <ChevronRight
            class="size-3.5 shrink-0 transition-transform {recentOpen
              ? 'rotate-90'
              : ''}"
          />
          <span class="min-w-0 flex-1">Recent</span>
        </button>
        {#if recentOpen}
          <ul class="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
            {#each pastSessions as s (s.id + (s.path ?? ""))}
              <li>
                <div
                  class="group/item flex items-center gap-0.5 rounded-lg transition-colors hover:bg-muted/80
                    {selectedId === s.id ? 'bg-muted' : ''}"
                >
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                    title="Resume session"
                    onclick={() => selectSession(s)}
                  >
                    <span class="block min-w-0 truncate text-xs font-medium text-muted-foreground">
                      {label(s)}
                    </span>
                  </button>
                </div>
              </li>
            {/each}
          </ul>
          {#if recentHasMore}
            <button
              type="button"
              class="mt-1 ml-3 w-[calc(100%-0.75rem)] rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              onclick={showMoreRecent}
            >
              Show more
            </button>
          {/if}
        {/if}
      {/if}
    </div>
  </div>
  {#if onOpenPalette}
    <div class="shrink-0 border-t border-border p-2">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        title="Command palette"
        onclick={onOpenPalette}
      >
        <Command class="size-3.5 shrink-0" />
        <span class="min-w-0 flex-1 truncate">Commands</span>
        <kbd
          class="pointer-events-none hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline"
        >
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>
    </div>
  {/if}
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    aria-valuemin={WIDTH_MIN}
    aria-valuemax={WIDTH_MAX}
    aria-valuenow={width}
    tabindex="0"
    class="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none
      hover:bg-primary/20 active:bg-primary/30 {resizing ? 'bg-primary/30' : ''}"
    onpointerdown={onResizePointerDown}
    onkeydown={(e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        width = clampWidth(width - 16);
        try {
          localStorage.setItem(WIDTH_KEY, String(width));
        } catch {
          /* ignore */
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        width = clampWidth(width + 16);
        try {
          localStorage.setItem(WIDTH_KEY, String(width));
        } catch {
          /* ignore */
        }
      }
    }}
  ></div>
</aside>

<style>
  .sidebar-row {
    position: relative;
  }

  .sidebar-row-main {
    width: 100%;
  }

  .sidebar-row-actions {
    position: absolute;
    top: 50%;
    right: 0.125rem;
    display: flex;
    align-items: center;
    gap: 0.125rem;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%);
    transition: opacity 140ms cubic-bezier(0.2, 0, 0, 1);
  }

  .sidebar-row:hover .sidebar-row-main,
  .sidebar-row:focus-within .sidebar-row-main {
    padding-right: 2.25rem;
  }

  .sidebar-row.has-two-actions:hover .sidebar-row-main,
  .sidebar-row.has-two-actions:focus-within .sidebar-row-main {
    padding-right: 3.75rem;
  }

  .sidebar-row:hover .sidebar-row-actions,
  .sidebar-row:focus-within .sidebar-row-actions {
    opacity: 1;
    pointer-events: auto;
  }
</style>
