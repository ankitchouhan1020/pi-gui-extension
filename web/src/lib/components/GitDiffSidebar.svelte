<script lang="ts">
  import {
    getGitStatus,
    getGitDiff,
    type GitFile,
    type GitStatus,
  } from "$lib/api";
  import {
    highlightInline,
    langFromPath,
  } from "agentic-ui-kit/components/prompt-kit/md-highlighter";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import FileDiff from "@lucide/svelte/icons/file-diff";
  import FolderGit2 from "@lucide/svelte/icons/folder-git-2";
  import WrapText from "@lucide/svelte/icons/wrap-text";
  import X from "@lucide/svelte/icons/x";

  type Props = {
    sessionId?: string;
    cwd?: string;
    onCollapse?: () => void;
  };

  /** GitHub-style unified diff row */
  type DiffRow = {
    kind: "meta" | "hunk" | "add" | "del" | "ctx";
    oldLn: number | null;
    newLn: number | null;
    marker: string;
    text: string;
    /** Shiki-highlighted HTML for code lines */
    html: string;
  };

  function esc(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  let { sessionId, cwd, onCollapse }: Props = $props();

  const WIDTH_KEY = "pi-gui-git-sidebar-width";
  const WRAP_KEY = "pi-gui-git-diff-wrap";
  const WIDTH_MIN = 280;
  const WIDTH_MAX = 640;
  const WIDTH_DEFAULT = 380;

  function clampWidth(n: number) {
    return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(n)));
  }

  function loadWidth(): number {
    try {
      const n = Number(localStorage.getItem(WIDTH_KEY));
      return Number.isFinite(n) ? clampWidth(n) : WIDTH_DEFAULT;
    } catch {
      return WIDTH_DEFAULT;
    }
  }

  let width = $state(loadWidth());
  let resizing = $state(false);
  /** Soft-wrap long lines (persisted). */
  let wrap = $state(
    (() => {
      try {
        return localStorage.getItem(WRAP_KEY) !== "0";
      } catch {
        return true;
      }
    })(),
  );

  function setWrap(next: boolean) {
    wrap = next;
    try {
      localStorage.setItem(WRAP_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  let status = $state<GitStatus | null>(null);
  let loading = $state(false);
  let err = $state<string | null>(null);
  let selectedPath = $state<string | null>(null);
  let patch = $state<string>("");
  let patchLoading = $state(false);
  let patchErr = $state<string | null>(null);

  const folderName = $derived.by(() => {
    const p = cwd || status?.cwd || "";
    if (!p) return "";
    const segs = p.split("/").filter(Boolean);
    return segs.at(-1) || p;
  });

  const fileCount = $derived(status?.files.length ?? 0);

  const counts = $derived.by(() => {
    const c = { M: 0, A: 0, D: 0, U: 0, R: 0, other: 0 };
    for (const f of status?.files ?? []) {
      if (f.status in c) c[f.status as keyof typeof c]++;
      else c.other++;
    }
    return c;
  });

  /** Parse unified diff → GitHub-style rows with dual line numbers + syntax HTML. */
  function parseUnifiedDiff(raw: string, lang: string): DiffRow[] {
    const rows: DiffRow[] = [];
    let oldLn = 0;
    let newLn = 0;

    function codeRow(
      kind: "add" | "del" | "ctx",
      old: number | null,
      neu: number | null,
      marker: string,
      text: string,
    ): DiffRow {
      return {
        kind,
        oldLn: old,
        newLn: neu,
        marker,
        text,
        html: text ? (lang ? highlightInline(text, lang) : esc(text)) : " ",
      };
    }

    for (const line of raw.split("\n")) {
      if (
        line.startsWith("diff ") ||
        line.startsWith("index ") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("similarity ") ||
        line.startsWith("rename ") ||
        line.startsWith("old mode") ||
        line.startsWith("new mode")
      ) {
        rows.push({
          kind: "meta",
          oldLn: null,
          newLn: null,
          marker: "",
          text: line,
          html: esc(line),
        });
        continue;
      }
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
      if (hunk) {
        oldLn = Number(hunk[1]);
        newLn = Number(hunk[2]);
        rows.push({
          kind: "hunk",
          oldLn: null,
          newLn: null,
          marker: "",
          text: line,
          html: esc(line),
        });
        continue;
      }
      if (line.startsWith("+")) {
        rows.push(codeRow("add", null, newLn++, "+", line.slice(1)));
        continue;
      }
      if (line.startsWith("-")) {
        rows.push(codeRow("del", oldLn++, null, "-", line.slice(1)));
        continue;
      }
      if (line.startsWith("\\")) {
        rows.push({
          kind: "meta",
          oldLn: null,
          newLn: null,
          marker: "",
          text: line,
          html: esc(line),
        });
        continue;
      }
      const text = line.startsWith(" ") ? line.slice(1) : line;
      rows.push(codeRow("ctx", oldLn++, newLn++, " ", text));
    }
    if (rows.length && rows[rows.length - 1].text === "" && rows[rows.length - 1].kind === "ctx") {
      rows.pop();
    }
    return rows;
  }

  const codeLang = $derived(selectedPath ? langFromPath(selectedPath) : "");
  const diffRows = $derived(patch ? parseUnifiedDiff(patch, codeLang) : []);

  function onResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    resizing = true;
    const startX = e.clientX;
    const startW = width;

    function onMove(ev: PointerEvent) {
      // drag left edge → wider when moving left
      width = clampWidth(startW - (ev.clientX - startX));
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

  async function refresh() {
    if (!sessionId) {
      status = null;
      selectedPath = null;
      patch = "";
      patchErr = null;
      err = null;
      return;
    }
    loading = true;
    err = null;
    try {
      const s = await getGitStatus(sessionId);
      status = s;
      if (!s.ok) err = s.error || "Not a git repository";
      if (selectedPath && !s.files.some((f) => f.path === selectedPath)) {
        selectedPath = null;
        patch = "";
        patchErr = null;
      } else if (selectedPath) {
        // silent re-fetch selected diff after status refresh
        void loadDiff(selectedPath, true);
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
      status = null;
    } finally {
      loading = false;
    }
  }

  async function loadDiff(path: string, quiet = false) {
    if (!sessionId) return;
    if (!quiet) {
      patchLoading = true;
      patch = "";
      patchErr = null;
    }
    try {
      const d = await getGitDiff(sessionId, path);
      if (selectedPath === path) {
        patch = d.patch || "";
        patchErr = null;
      }
    } catch (e) {
      if (selectedPath === path) {
        patch = "";
        patchErr = e instanceof Error ? e.message : String(e);
      }
    } finally {
      if (!quiet) patchLoading = false;
    }
  }

  async function selectFile(f: GitFile) {
    if (!sessionId) return;
    if (selectedPath === f.path) {
      selectedPath = null;
      patch = "";
      patchErr = null;
      return;
    }
    selectedPath = f.path;
    await loadDiff(f.path);
  }

  function clearSelection() {
    selectedPath = null;
    patch = "";
    patchErr = null;
  }

  function statusClass(s: string) {
    if (s === "A" || s === "U") return "text-emerald-600 dark:text-emerald-400";
    if (s === "D") return "text-red-600 dark:text-red-400";
    if (s === "R") return "text-sky-600 dark:text-sky-400";
    return "text-amber-600 dark:text-amber-400";
  }

  function statusLabel(s: string) {
    if (s === "A") return "Added";
    if (s === "D") return "Deleted";
    if (s === "U") return "Untracked";
    if (s === "R") return "Renamed";
    if (s === "M") return "Modified";
    return s;
  }

  function fileParts(path: string) {
    const i = path.lastIndexOf("/");
    if (i < 0) return { dir: "", base: path };
    return { dir: path.slice(0, i + 1), base: path.slice(i + 1) };
  }

  $effect(() => {
    void sessionId;
    selectedPath = null;
    patch = "";
    patchErr = null;
    void refresh();
  });
</script>

<aside
  class="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
  class:select-none={resizing}
  style="width: {width}px"
>
  <!-- resize from left edge -->
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize git sidebar"
    class="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/40"
    onpointerdown={onResizePointerDown}
  ></div>

  <div
    class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
  >
    <div class="flex min-w-0 items-center gap-2">
      <FileDiff class="size-4 shrink-0 text-muted-foreground" />
      <span class="truncate text-sm font-semibold tracking-tight">Changes</span>
      {#if folderName}
        <span
          class="min-w-0 truncate text-[11px] text-muted-foreground"
          title={cwd || status?.cwd}
        >
          {folderName}
        </span>
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        title="Refresh"
        aria-label="Refresh git status"
        disabled={!sessionId || loading}
        onclick={() => refresh()}
      >
        <RefreshCw class="size-4 {loading ? 'animate-spin' : ''}" />
      </button>
      {#if onCollapse}
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Collapse git sidebar"
          aria-label="Collapse git sidebar"
          onclick={onCollapse}
        >
          <PanelRightClose class="size-4" />
        </button>
      {/if}
    </div>
  </div>

  {#if !sessionId}
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <FolderGit2 class="size-8 text-muted-foreground/50" />
      <p class="text-xs text-muted-foreground">
        Open a session to see git changes for its folder.
      </p>
    </div>
  {:else if err && !status?.ok}
    <div class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <FolderGit2 class="size-8 text-muted-foreground/50" />
      <p class="text-xs text-muted-foreground">{err}</p>
    </div>
  {:else}
    <div
      class="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2 text-[11px]"
    >
      <GitBranch class="size-3 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate font-medium">
        {status?.branch ?? (loading ? "…" : "—")}
      </span>
      {#if fileCount > 0}
        <span class="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
          {#if counts.M}<span class="text-amber-600 dark:text-amber-400">{counts.M}M</span>{/if}
          {#if counts.A}<span class="text-emerald-600 dark:text-emerald-400">{counts.A}A</span>{/if}
          {#if counts.U}<span class="text-emerald-600 dark:text-emerald-400">{counts.U}U</span>{/if}
          {#if counts.D}<span class="text-red-600 dark:text-red-400">{counts.D}D</span>{/if}
          {#if counts.R}<span class="text-sky-600 dark:text-sky-400">{counts.R}R</span>{/if}
        </span>
      {:else}
        <span class="shrink-0 text-muted-foreground">clean</span>
      {/if}
    </div>

    <div class="flex min-h-0 flex-1 flex-col">
      <!-- file list -->
      <div
        class="min-h-0 overflow-y-auto {selectedPath
          ? 'max-h-[38%] shrink-0 border-b border-border'
          : 'flex-1'}"
      >
        <div class="flex flex-col gap-0.5 p-1.5">
          {#if loading && !status}
            <div class="px-2 py-6 text-center text-xs text-muted-foreground">Loading…</div>
          {:else if fileCount === 0}
            <div class="flex flex-col items-center gap-1.5 px-2 py-10 text-center">
              <p class="text-xs font-medium text-foreground/80">No changes</p>
              <p class="text-[11px] text-muted-foreground">Working tree is clean</p>
            </div>
          {:else}
            <div
              class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Files · {fileCount}
            </div>
            {#each status?.files ?? [] as f (f.path)}
              {@const parts = fileParts(f.path)}
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/80
                  {selectedPath === f.path ? 'bg-muted' : ''}"
                title="{statusLabel(f.status)} — {f.path}"
                onclick={() => selectFile(f)}
              >
                <span
                  class="w-3.5 shrink-0 text-center font-mono text-[10px] font-bold leading-none {statusClass(
                    f.status,
                  )}">{f.status}</span
                >
                <span class="min-w-0 flex-1 truncate font-mono">
                  {#if parts.dir}
                    <span class="text-muted-foreground">{parts.dir}</span>
                  {/if}<span class="text-foreground">{parts.base}</span>
                </span>
              </button>
            {/each}
          {/if}
        </div>
      </div>

      <!-- diff pane -->
      {#if selectedPath}
        <div class="flex min-h-0 flex-1 flex-col">
          <div
            class="flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5"
          >
            <span
              class="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
              title={selectedPath}>{selectedPath}</span
            >
            <button
              type="button"
              class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground
                {wrap ? 'bg-muted text-foreground' : ''}"
              title={wrap ? "Unwrap lines" : "Wrap lines"}
              aria-label={wrap ? "Unwrap lines" : "Wrap lines"}
              aria-pressed={wrap}
              onclick={() => setWrap(!wrap)}
            >
              <WrapText class="size-3.5" />
            </button>
            <button
              type="button"
              class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Close diff"
              aria-label="Close diff"
              onclick={clearSelection}
            >
              <X class="size-3.5" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-auto">
            {#if patchLoading}
              <div class="px-3 py-8 text-center text-xs text-muted-foreground">
                Loading diff…
              </div>
            {:else if patchErr}
              <div class="px-3 py-6 text-center text-xs text-destructive">{patchErr}</div>
            {:else if !patch}
              <div class="px-3 py-8 text-center text-xs text-muted-foreground">
                Empty diff
              </div>
            {:else}
              <div
                class="gh-diff text-[11px] leading-[1.45]"
                class:gh-diff-wrap={wrap}
                class:gh-diff-nowrap={!wrap}
              >
                {#each diffRows as row, i (i)}
                  <div class="gh-diff-line gh-diff-{row.kind}">
                    {#if row.kind === "meta" || row.kind === "hunk"}
                      <span class="gh-diff-num"></span>
                      <span class="gh-diff-num"></span>
                      <span class="gh-diff-marker"></span>
                      <span class="gh-diff-code">{@html row.html || " "}</span>
                    {:else}
                      <span class="gh-diff-num select-none text-right tabular-nums"
                        >{row.oldLn ?? ""}</span
                      >
                      <span class="gh-diff-num select-none text-right tabular-nums"
                        >{row.newLn ?? ""}</span
                      >
                      <span class="gh-diff-marker select-none text-center">{row.marker}</span>
                      <span class="gh-diff-code">{@html row.html || " "}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else if fileCount > 0}
        <div
          class="flex shrink-0 items-center justify-center border-t border-border px-4 py-3"
        >
          <p class="text-[11px] text-muted-foreground">Select a file to view its diff</p>
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  /* Table layout: shared columns + full-width row paint (wrap & unwrap) */
  .gh-diff {
    display: table;
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
  }
  .gh-diff-nowrap {
    width: max-content;
    min-width: 100%;
  }
  .gh-diff-line {
    display: table-row;
  }
  .gh-diff-num,
  .gh-diff-marker,
  .gh-diff-code {
    display: table-cell;
    vertical-align: top;
  }
  .gh-diff-num {
    width: 1%;
    min-width: 2.25rem;
    padding: 0 0.4rem;
    border-right: 1px solid #d0d7de;
    color: #656d76;
    background: #f6f8fa;
    white-space: nowrap;
    user-select: none;
  }
  .gh-diff-marker {
    width: 1rem;
    color: #656d76;
    white-space: nowrap;
  }
  .gh-diff-code {
    padding: 0 0.5rem 0 0.25rem;
    color: #1f2328;
  }
  .gh-diff-wrap .gh-diff-code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .gh-diff-nowrap .gh-diff-code {
    white-space: pre;
  }
  /* Shiki dual-theme tokens; keep line add/del backgrounds visible */
  .gh-diff-code :global(span) {
    color: var(--shiki-light);
    background-color: transparent !important;
  }
  :global(.dark) .gh-diff-code :global(span) {
    color: var(--shiki-dark);
  }

  .gh-diff-add .gh-diff-num {
    background: #ccffd8;
    color: #1f2328;
    border-right-color: #b4f1c8;
  }
  .gh-diff-add .gh-diff-marker,
  .gh-diff-add .gh-diff-code {
    background: #e6ffec;
    color: #1f2328;
  }
  .gh-diff-add .gh-diff-marker {
    color: #1a7f37;
  }

  .gh-diff-del .gh-diff-num {
    background: #ffd7d5;
    color: #1f2328;
    border-right-color: #ffc1be;
  }
  .gh-diff-del .gh-diff-marker,
  .gh-diff-del .gh-diff-code {
    background: #ffebe9;
    color: #1f2328;
  }
  .gh-diff-del .gh-diff-marker {
    color: #cf222e;
  }

  .gh-diff-hunk .gh-diff-num {
    background: #ddf4ff;
    border-right-color: #b6e3ff;
  }
  .gh-diff-hunk .gh-diff-marker,
  .gh-diff-hunk .gh-diff-code {
    background: #ddf4ff;
    color: #0550ae;
  }

  .gh-diff-meta .gh-diff-num {
    background: transparent;
    border-right-color: transparent;
  }
  .gh-diff-meta .gh-diff-code {
    color: #656d76;
    padding-top: 0.15rem;
    padding-bottom: 0.15rem;
  }

  .gh-diff-ctx .gh-diff-num {
    background: #f6f8fa;
  }

  :global(.dark) .gh-diff-num {
    background: #161b22;
    border-right-color: #30363d;
    color: #7d8590;
  }
  :global(.dark) .gh-diff-marker {
    color: #7d8590;
  }
  :global(.dark) .gh-diff-code {
    color: #e6edf3;
  }

  :global(.dark) .gh-diff-add .gh-diff-num {
    background: rgba(46, 160, 67, 0.2);
    border-right-color: rgba(46, 160, 67, 0.3);
    color: #7ee787;
  }
  :global(.dark) .gh-diff-add .gh-diff-marker,
  :global(.dark) .gh-diff-add .gh-diff-code {
    background: rgba(46, 160, 67, 0.15);
    color: #e6edf3;
  }
  :global(.dark) .gh-diff-add .gh-diff-marker {
    color: #3fb950;
  }

  :global(.dark) .gh-diff-del .gh-diff-num {
    background: rgba(248, 81, 73, 0.2);
    border-right-color: rgba(248, 81, 73, 0.3);
    color: #ffa198;
  }
  :global(.dark) .gh-diff-del .gh-diff-marker,
  :global(.dark) .gh-diff-del .gh-diff-code {
    background: rgba(248, 81, 73, 0.15);
    color: #e6edf3;
  }
  :global(.dark) .gh-diff-del .gh-diff-marker {
    color: #f85149;
  }

  :global(.dark) .gh-diff-hunk .gh-diff-num {
    background: rgba(56, 139, 253, 0.15);
    border-right-color: rgba(56, 139, 253, 0.25);
  }
  :global(.dark) .gh-diff-hunk .gh-diff-marker,
  :global(.dark) .gh-diff-hunk .gh-diff-code {
    background: rgba(56, 139, 253, 0.1);
    color: #79c0ff;
  }

  :global(.dark) .gh-diff-meta .gh-diff-code {
    color: #7d8590;
  }

  :global(.dark) .gh-diff-ctx .gh-diff-num {
    background: #161b22;
  }
</style>
