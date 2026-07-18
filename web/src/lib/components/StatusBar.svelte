<script lang="ts">
  /** Session header — title / cwd / status. Near-limit shows Compact. */
  import type { SessionRow } from "$lib/api";
  import { compactSession, renameSession } from "$lib/api";
  import Badge from "agentic-ui-kit/components/ui/badge.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Input from "agentic-ui-kit/components/ui/input.svelte";
  import Tooltip from "agentic-ui-kit/components/ui/tooltip.svelte";
  import TooltipContent from "agentic-ui-kit/components/ui/tooltip-content.svelte";
  import TooltipTrigger from "agentic-ui-kit/components/ui/tooltip-trigger.svelte";
  import CircleDollarSign from "@lucide/svelte/icons/circle-dollar-sign";
  import Gauge from "@lucide/svelte/icons/gauge";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import PanelRight from "@lucide/svelte/icons/panel-right";

  type Props = {
    session: SessionRow;
    onError?: (msg: string) => void;
    onUpdate?: (patch: Partial<SessionRow>) => void;
    showExpandSidebar?: boolean;
    showExpandGit?: boolean;
    onExpandSidebar?: () => void;
    onExpandGit?: () => void;
  };

  let {
    session,
    onError,
    onUpdate,
    showExpandSidebar = false,
    showExpandGit = false,
    onExpandSidebar,
    onExpandGit,
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

  type MetaItem = {
    kind: "context" | "cost";
    value: string;
    label: string;
    warning?: boolean;
  };

  /** Keep the header focused on the two values that guide user decisions. */
  const metaItems = $derived.by(() => {
    const items: MetaItem[] = [];
    if (ctxPct != null) {
      const remaining = Math.max(0, Math.min(100, 100 - Math.round(ctxPct)));
      items.push({
        kind: "context",
        value: `${remaining}% left`,
        label: `${remaining}% of the context window remains before the conversation may need compacting.`,
        warning: nearLimit,
      });
    }
    const raw = session.stats?.cost;
    const cost =
      typeof raw === "number"
        ? raw
        : raw && typeof raw === "object" && typeof raw.total === "number"
          ? raw.total
          : null;
    if (cost != null && !Number.isNaN(cost)) {
      const value = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(3)}`;
      items.push({
        kind: "cost",
        value,
        label: `Estimated cost for this session so far: ${value}.`,
      });
    }
    return items;
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
    <Button
      variant="ghost"
      size="icon"
      class="size-8 shrink-0 text-muted-foreground"
      title="Expand sidebar"
      aria-label="Expand sidebar"
      onclick={onExpandSidebar}
    >
      <PanelLeft class="size-4" />
    </Button>
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
    {#if metaItems.length}
      <div class="flex items-center gap-1" aria-label="Session usage">
        {#each metaItems as item (item.kind)}
          <Tooltip>
            <TooltipTrigger>
              {#snippet child({ props })}
                <span {...props} class="inline-flex">
                  <Badge
                    variant="outline"
                    class="h-6 gap-1 border-border/70 bg-background/60 px-1.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground shadow-none {item.warning
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : ''}"
                    aria-label={item.label}
                  >
                    {#if item.kind === "cost"}
                      <CircleDollarSign class="size-3" />
                    {:else}
                      <Gauge class="size-3" />
                    {/if}
                    <span>{item.value}</span>
                  </Badge>
                </span>
              {/snippet}
            </TooltipTrigger>
            <TooltipContent side="bottom" class="max-w-64 text-center">
              {item.label}
            </TooltipContent>
          </Tooltip>
        {/each}
      </div>
    {/if}
    {#if nearLimit && !isCompacting}
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="h-6 px-2 text-[10px] {ctxPct != null && ctxPct >= 95
          ? 'border-amber-500/60 text-amber-700 dark:text-amber-400'
          : ''}"
        title="Compact"
        onclick={doCompact}
      >
        Compact
      </Button>
    {/if}
    {#if isCompacting}
      <Badge variant="secondary" class="h-6 text-[10px]">compacting</Badge>
    {/if}
    {#if showExpandGit && onExpandGit}
      <Button
        variant="ghost"
        size="icon"
        class="size-8 shrink-0 text-muted-foreground"
        title="Show changes"
        aria-label="Show git changes sidebar"
        onclick={onExpandGit}
      >
        <PanelRight class="size-4" />
      </Button>
    {/if}
  </div>
</header>
