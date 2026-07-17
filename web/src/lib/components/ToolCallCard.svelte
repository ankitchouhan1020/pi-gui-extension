<script lang="ts">
  /** Collapsible tool call / result row for chat. */
  import LinkifiedPre from "$lib/components/LinkifiedPre.svelte";

  type Status = "running" | "done" | "error";

  type Props = {
    name: string;
    args?: string;
    result?: string;
    status?: Status;
    /** Initial / bulk expand state (default open). */
    open?: boolean;
    /** Bump to force open ← bulk expand/collapse all. */
    foldEpoch?: number;
    /** Max lines of result before "show more". */
    maxResultLines?: number;
  };

  let {
    name,
    args = "",
    result = "",
    status = "done",
    open = true,
    foldEpoch = 0,
    maxResultLines = 20,
  }: Props = $props();

  let localOpen = $state(true);

  $effect(() => {
    void foldEpoch;
    localOpen = open;
  });

  const chip = $derived(
    status === "running"
      ? { label: "running", class: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }
      : status === "error"
        ? { label: "error", class: "bg-destructive/15 text-destructive" }
        : { label: "done", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  );

  const hasBody = $derived(Boolean(args.trim() || result.trim()));

  let resultOpen = $state(false);
  const resultLines = $derived(result ? result.split("\n") : []);
  const resultLong = $derived(resultLines.length > maxResultLines);
  const resultShown = $derived(
    !resultLong || resultOpen
      ? result
      : resultLines.slice(0, maxResultLines).join("\n") + "\n…",
  );

  const preClass =
    "m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background/80 p-2 font-mono text-[11px] leading-relaxed text-foreground/75";
</script>

<details
  class="group/tool w-full min-w-0 max-w-full rounded-lg border border-border/70 bg-muted/30 open:bg-muted/40"
  bind:open={localOpen}
>
  <summary
    class="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[12px] leading-none select-none [&::-webkit-details-marker]:hidden"
  >
    <span
      class="inline-block size-1.5 shrink-0 rounded-full {status === 'running'
        ? 'animate-pulse bg-amber-500'
        : status === 'error'
          ? 'bg-destructive'
          : 'bg-emerald-500/80'}"
      aria-hidden="true"
    ></span>
    <span class="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/90">{name}</span>
    <span
      class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide {chip.class}"
    >
      {chip.label}
    </span>
    {#if hasBody}
      <span
        class="shrink-0 text-muted-foreground transition-transform group-open/tool:rotate-90"
        aria-hidden="true"
      >▸</span>
    {/if}
  </summary>

  {#if hasBody}
    <div class="space-y-1.5 border-t border-border/50 px-2.5 py-2">
      {#if args.trim()}
        <div>
          <div class="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            args
          </div>
          <LinkifiedPre text={args} class="{preClass} max-h-48" />
        </div>
      {/if}
      {#if result.trim()}
        <div>
          <div class="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            result
          </div>
          <LinkifiedPre text={resultShown} class={preClass} />
          {#if resultLong}
            <button
              type="button"
              class="mt-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resultOpen = !resultOpen;
              }}
            >
              {resultOpen
                ? "Show less"
                : `Show more (${resultLines.length - maxResultLines} lines)`}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</details>
