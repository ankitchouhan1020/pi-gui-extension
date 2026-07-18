<script lang="ts">
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Loader from "agentic-ui-kit/components/prompt-kit/loader.svelte";
  import GitFork from "@lucide/svelte/icons/git-fork";

  type Props = {
    message: string;
    busy?: boolean;
    error?: string;
    onCancel?: () => void;
    onConfirm?: () => void;
  };

  let { message, busy = false, error = "", onCancel, onConfirm }: Props = $props();

  $effect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<div
  class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
  role="dialog"
  aria-modal="true"
  aria-labelledby="fork-confirm-title"
>
  <div class="w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-xl">
    <div class="flex items-center gap-2">
      <GitFork class="size-4 text-muted-foreground" />
      <h2 id="fork-confirm-title" class="text-sm font-semibold">Fork into a new thread?</h2>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
      A new thread will keep everything before this message. The original thread stays
      unchanged, and this message will open in the editor so you can edit it before
      continuing.
    </p>
    <div class="mt-3 max-h-40 overflow-auto rounded-lg border border-border/70 bg-[var(--pi-canvas)] p-3 text-sm whitespace-pre-wrap">
      {message}
    </div>
    {#if error}
      <p class="mt-3 text-sm text-destructive">{error}</p>
    {/if}
    <div class="mt-4 flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onclick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="button" size="sm" onclick={onConfirm} disabled={busy}>
        {#if busy}
          <Loader variant="circular" size="sm" class="mr-1.5 size-3.5" />
        {/if}
        Continue to editor
      </Button>
    </div>
  </div>
</div>
