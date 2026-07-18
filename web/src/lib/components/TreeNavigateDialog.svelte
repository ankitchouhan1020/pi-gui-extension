<script lang="ts">
  import type { TreeNode } from "$lib/api";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Loader from "agentic-ui-kit/components/prompt-kit/loader.svelte";
  import GitBranch from "@lucide/svelte/icons/git-branch";

  type Props = {
    node: TreeNode;
    busy?: boolean;
    error?: string;
    onCancel?: () => void;
    onNavigate?: (opts: { summarize: boolean; customInstructions?: string }) => void;
  };

  let { node, busy = false, error = "", onCancel, onNavigate }: Props = $props();
  let customOpen = $state(false);
  let customInstructions = $state("");
  let customTextarea: HTMLTextAreaElement | undefined = $state();

  function openCustomPrompt() {
    customOpen = true;
    requestAnimationFrame(() => customTextarea?.focus());
  }

  $effect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (busy) return;
      if (event.key === "Escape") {
        if (customOpen) customOpen = false;
        else onCancel?.();
        return;
      }
      if (customOpen) return;
      if (event.key === "1") onNavigate?.({ summarize: false });
      if (event.key === "2") onNavigate?.({ summarize: true });
      if (event.key === "3") openCustomPrompt();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<div
  class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
  role="dialog"
  aria-modal="true"
  aria-labelledby="tree-navigate-title"
>
  <div class="w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-xl">
    <div class="flex items-center gap-2">
      <GitBranch class="size-4 text-muted-foreground" />
      <h2 id="tree-navigate-title" class="text-sm font-semibold">Navigate session tree?</h2>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
      This switches the active branch inside the current thread. Choose whether Pi should
      preserve context from the branch you are leaving.
    </p>
    <div class="mt-3 max-h-32 overflow-auto rounded-lg border border-border/70 bg-[var(--pi-canvas)] p-3 text-sm">
      <span class="font-medium">{node.role || node.type || "entry"}</span>
      <span class="text-muted-foreground"> — {node.preview || "—"}</span>
    </div>

    {#if customOpen}
      <label class="mt-3 block text-xs font-medium text-muted-foreground" for="tree-summary-instructions">
        Custom summarization instructions
      </label>
      <textarea
        id="tree-summary-instructions"
        bind:this={customTextarea}
        bind:value={customInstructions}
        class="mt-1 min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        placeholder="Tell Pi what to preserve from the branch you are leaving"
        disabled={busy}
      ></textarea>
    {/if}

    {#if error}
      <p class="mt-3 text-sm text-destructive">{error}</p>
    {/if}

    {#if customOpen}
      <div class="mt-4 flex justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => (customOpen = false)}
          disabled={busy}
        >
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onclick={() => onNavigate?.({
            summarize: true,
            customInstructions: customInstructions.trim() || undefined,
          })}
          disabled={busy}
        >
          {#if busy}
            <Loader variant="circular" size="sm" class="mr-1.5 size-3.5" />
          {/if}
          Summarize & navigate
        </Button>
      </div>
    {:else}
      <div class="mt-4 space-y-1.5" role="group" aria-label="Summarize branch?">
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
          onclick={() => onNavigate?.({ summarize: false })}
          disabled={busy}
        >
          <span>
            <span class="block text-sm font-medium">No summary</span>
            <span class="block text-[11px] text-muted-foreground">Switch directly to the selected point</span>
          </span>
          <kbd class="text-[10px] text-muted-foreground">1</kbd>
        </button>
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
          onclick={() => onNavigate?.({ summarize: true })}
          disabled={busy}
        >
          <span>
            <span class="block text-sm font-medium">Summarize</span>
            <span class="block text-[11px] text-muted-foreground">Carry a Pi-generated summary into the new branch</span>
          </span>
          {#if busy}
            <Loader variant="circular" size="sm" class="size-3.5" />
          {:else}
            <kbd class="text-[10px] text-muted-foreground">2</kbd>
          {/if}
        </button>
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
          onclick={openCustomPrompt}
          disabled={busy}
        >
          <span>
            <span class="block text-sm font-medium">Summarize with custom prompt</span>
            <span class="block text-[11px] text-muted-foreground">Tell Pi what context should be preserved</span>
          </span>
          <kbd class="text-[10px] text-muted-foreground">3</kbd>
        </button>
      </div>
      <div class="mt-4 flex justify-end">
        <Button type="button" variant="outline" size="sm" onclick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    {/if}
  </div>
</div>
