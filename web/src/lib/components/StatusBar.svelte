<script lang="ts">
  /** Session header — title / cwd / status. Near-limit shows Compact. */
  import type { SessionRow } from "$lib/api";
  import { compactSession, renameSession } from "$lib/api";
  import Badge from "agentic-ui-kit/components/ui/badge.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Input from "agentic-ui-kit/components/ui/input.svelte";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import ChevronsDownUp from "@lucide/svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";

  type Props = {
    session: SessionRow;
    onError?: (msg: string) => void;
    onUpdate?: (patch: Partial<SessionRow>) => void;
    showExpandSidebar?: boolean;
    showExpandGit?: boolean;
    onExpandSidebar?: () => void;
    onExpandGit?: () => void;
    /** Thinking + tool cards expanded (default true). */
    foldOpen?: boolean;
    onToggleFold?: () => void;
  };

  let {
    session,
    onError,
    onUpdate,
    showExpandSidebar = false,
    showExpandGit = false,
    onExpandSidebar,
    onExpandGit,
    foldOpen = true,
    onToggleFold,
  }: Props = $props();

  let renaming = $state(false);
  let nameDraft = $state("");
  /** Local name override after rename (until parent catches up). */
  let nameOverride = $state<string | null>(null);
  let compactingLocal = $state(false);

  const title = $derived(
    nameOverride ||
      session.sessionName ||
      session.name ||
      session.firstMessage?.slice(0, 60) ||
      session.id.slice(0, 8),
  );

  const isCompacting = $derived(
    Boolean(session.isCompacting || session.compacting || compactingLocal),
  );

  const ctxPct = $derived.by(() => {
    const cu = session.contextUsage ?? session.stats?.contextUsage;
    return cu?.percent != null && !Number.isNaN(cu.percent) ? cu.percent : null;
  });
  /** Surface compact CTA when context is getting tight. */
  const nearLimit = $derived(ctxPct != null && ctxPct >= 80);

  /** Token / cost / ctx chips for header (e.g. `48.4k↑ · 237↓ · $0.0000 · 5% ctx`). */
  const metaParts = $derived.by(() => {
    const parts: string[] = [];
    const tokens = session.stats?.tokens;
    if (tokens?.input) parts.push(`${fmtN(tokens.input)}↑`);
    if (tokens?.output) parts.push(`${fmtN(tokens.output)}↓`);
    const raw = session.stats?.cost;
    const cost =
      typeof raw === "number"
        ? raw
        : raw && typeof raw === "object" && typeof raw.total === "number"
          ? raw.total
          : null;
    if (cost != null && !Number.isNaN(cost)) {
      parts.push(cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(3)}`);
    }
    if (ctxPct != null) parts.push(`${Math.round(ctxPct)}% ctx`);
    return parts;
  });

  async function doCompact() {
    if (!session.id || isCompacting) return;
    compactingLocal = true;
    onUpdate?.({ isCompacting: true });
    try {
      await compactSession(session.id);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
      onUpdate?.({ isCompacting: false });
    } finally {
      compactingLocal = false;
    }
  }

  function fmtN(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  // Clear rename override when switching sessions (id change only — no detail loop)
  let lastId = $state<string | null>(null);
  $effect(() => {
    const id = session.id;
    if (id === lastId) return;
    lastId = id;
    nameOverride = null;
    renaming = false;
  });

  function startRename() {
    nameDraft =
      nameOverride || session.sessionName || session.name || "";
    renaming = true;
  }

  async function commitRename() {
    if (!renaming) return;
    const name = nameDraft.trim();
    renaming = false;
    const prev = nameOverride || session.sessionName || session.name || "";
    if (!name || name === prev) return;
    try {
      await renameSession(session.id, name);
      nameOverride = name;
      onUpdate?.({ name, sessionName: name });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }

  function onRenameKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      renaming = false;
    }
  }
</script>

<header
  class="flex h-11 shrink-0 items-center gap-2 border-b border-black/[0.06] bg-[var(--pi-canvas)] px-2 dark:border-white/10 sm:gap-3 sm:px-3"
>
  {#if showExpandSidebar && onExpandSidebar}
    <button
      type="button"
      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Expand sidebar"
      aria-label="Expand sidebar"
      onclick={onExpandSidebar}
    >
      <PanelLeft class="size-4" />
    </button>
  {/if}

  <div class="min-w-0 flex-1">
    {#if renaming}
      <Input
        class="h-7 max-w-sm text-sm font-semibold"
        bind:value={nameDraft}
        onkeydown={onRenameKey}
        onblur={commitRename}
      />
    {:else}
      <button
        type="button"
        class="flex min-w-0 max-w-full items-baseline gap-2 text-left"
        title="Double-click to rename"
        ondblclick={startRename}
      >
        <span class="truncate text-sm font-semibold">{title}</span>
        {#if session.cwd}
          <span class="hidden truncate text-[11px] text-muted-foreground sm:inline">
            {session.cwd.split("/").filter(Boolean).slice(-2).join("/") || session.cwd}
          </span>
        {/if}
      </button>
    {/if}
  </div>

  <div class="flex shrink-0 items-center gap-2">
    {#if metaParts.length}
      <span
        class="font-mono text-[11px] tabular-nums tracking-tight {nearLimit
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-muted-foreground'}"
        title={metaParts.join(" · ")}
      >
        {metaParts.join(" · ")}
      </span>
    {/if}
    {#if nearLimit && !isCompacting}
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-6 px-2 text-[10px] {ctxPct != null && ctxPct >= 95
          ? 'border-amber-500/60 text-amber-700 dark:text-amber-400'
          : ''}"
        title="Compact context"
        onclick={doCompact}
      >
        Compact
      </Button>
    {/if}
    {#if isCompacting}
      <Badge variant="secondary" class="h-6 text-[10px]">compacting</Badge>
    {/if}
    {#if onToggleFold}
      <button
        type="button"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={foldOpen ? "Collapse all thinking & tools" : "Expand all thinking & tools"}
        aria-label={foldOpen ? "Collapse all thinking and tools" : "Expand all thinking and tools"}
        onclick={onToggleFold}
      >
        {#if foldOpen}
          <ChevronsDownUp class="size-4" />
        {:else}
          <ChevronsUpDown class="size-4" />
        {/if}
      </button>
    {/if}
    {#if showExpandGit && onExpandGit}
      <button
        type="button"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Show changes"
        aria-label="Show git changes sidebar"
        onclick={onExpandGit}
      >
        <PanelRight class="size-4" />
      </button>
    {/if}
  </div>
</header>
