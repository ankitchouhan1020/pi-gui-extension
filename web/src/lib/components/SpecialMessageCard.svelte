<script lang="ts">
  import Markdown from "agentic-ui-kit/components/prompt-kit/markdown.svelte";
  import Archive from "@lucide/svelte/icons/archive";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Terminal from "@lucide/svelte/icons/terminal";

  type Props = {
    kind: "compaction" | "branch" | "skill" | "command";
    title: string;
    body: string;
    meta?: string;
    metaTitle?: string;
    bodyStyle?: "markdown" | "pre";
    status?: "running" | "done" | "warning" | "error";
  };

  let {
    kind,
    title,
    body,
    meta = "",
    metaTitle = "",
    bodyStyle = "markdown",
    status = "done",
  }: Props = $props();

  const tone = $derived(
    kind === "compaction"
      ? "border-violet-500/25 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300"
      : kind === "skill"
        ? "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-700 dark:text-cyan-300"
        : kind === "command" && status === "error"
          ? "border-red-500/25 bg-red-500/[0.06] text-red-700 dark:text-red-300"
          : kind === "command" && status === "warning"
            ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300"
            : kind === "command" && status === "done"
              ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"
              : kind === "command"
                ? "border-blue-500/25 bg-blue-500/[0.06] text-blue-700 dark:text-blue-300"
        : "border-amber-500/25 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
  );
</script>

{#snippet header(expandable: boolean)}
  <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-current/10">
    {#if kind === "compaction"}
      <Archive class="size-3.5" />
    {:else if kind === "skill"}
      <Sparkles class="size-3.5" />
    {:else if kind === "command"}
      <Terminal class="size-3.5" />
    {:else}
      <GitBranch class="size-3.5" />
    {/if}
  </span>
  <span class="min-w-0 flex-1 truncate font-medium text-foreground/90" title={title}>{title}</span>
  {#if meta}
    <span
      class="max-w-[45%] truncate rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      title={metaTitle || meta}
    >{meta}</span>
  {/if}
  {#if expandable}
    <ChevronRight
      class="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/special:rotate-90"
    />
  {/if}
{/snippet}

{#if body.trim()}
  <details class="group/special w-full min-w-0 rounded-lg border {tone}">
    <summary
      class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[12px] select-none [&::-webkit-details-marker]:hidden"
    >
      {@render header(true)}
    </summary>
    <div class="border-t border-current/15 px-3 py-2.5 text-foreground/85">
      {#if bodyStyle === "pre"}
        <pre class="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/85">{body}</pre>
      {:else}
        <Markdown content={body} compact={true} />
      {/if}
    </div>
  </details>
{:else}
  <div class="w-full min-w-0 rounded-lg border {tone}">
    <div class="flex items-center gap-2 px-3 py-2 text-[12px]">
      {@render header(false)}
    </div>
  </div>
{/if}
