<script lang="ts">
  import type { SlashCommandInfo } from "$lib/api";

  type Props = {
    open?: boolean;
    items?: SlashCommandInfo[];
    active?: number;
    onPick?: (cmd: SlashCommandInfo) => void;
    onActive?: (i: number) => void;
  };

  let {
    open = false,
    items = [],
    active = 0,
    onPick,
    onActive,
  }: Props = $props();

  function sourceLabel(source: string) {
    if (source === "prompt") return "prompt";
    if (source === "skill") return "skill";
    if (source === "builtin") return "pi";
    return "ext";
  }
</script>

{#if open && items.length}
  <div
    class="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    role="listbox"
    aria-label="Slash commands"
  >
    {#each items as cmd, i (cmd.source + ":" + cmd.name)}
      <button
        type="button"
        role="option"
        aria-selected={i === active}
        class="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12px] transition-colors {i === active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted'}"
        onmouseenter={() => onActive?.(i)}
        onclick={() => onPick?.(cmd)}
      >
        <span class="shrink-0 font-mono font-medium">/{cmd.name}</span>
        {#if cmd.argumentHint}
          <span class="shrink-0 font-mono text-[11px] opacity-50"
            >{cmd.argumentHint}</span
          >
        {/if}
        <span class="min-w-0 flex-1 truncate text-[11px] opacity-60">
          {cmd.description || ""}
        </span>
        <span
          class="shrink-0 rounded bg-muted/80 px-1 py-0.5 text-[9px] uppercase tracking-wide opacity-70"
        >
          {sourceLabel(cmd.source)}
        </span>
      </button>
    {/each}
  </div>
{/if}
