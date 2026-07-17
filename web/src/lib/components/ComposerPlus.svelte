<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Upload from "@lucide/svelte/icons/upload";
  import { DropdownMenu } from "bits-ui";

  type Props = {
    onFiles?: (files: FileList | File[]) => void;
    disabled?: boolean;
  };

  let { onFiles, disabled = false }: Props = $props();

  let fileInput: HTMLInputElement | undefined = $state();

  function openUpload() {
    // Defer past menu close so the file picker isn't blocked.
    requestAnimationFrame(() => fileInput?.click());
  }

  function onFileChange(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    if (el.files?.length) onFiles?.(el.files);
    el.value = "";
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  multiple
  class="sr-only"
  tabindex="-1"
  onchange={onFileChange}
/>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        type="button"
        {disabled}
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        aria-label="Add"
        title="Add"
      >
        <Plus class="size-3.5" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      align="start"
      sideOffset={6}
      class="bg-popover text-popover-foreground z-50 min-w-[9.5rem] overflow-hidden rounded-md border p-1 shadow-md"
    >
      <!-- ponytail: flat menu; use DropdownMenu.Sub when a second group needs nesting -->
      <DropdownMenu.Item
        class="focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
        onSelect={openUpload}
      >
        <Upload class="size-3.5 shrink-0 opacity-70" />
        Upload
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
