<script lang="ts">
  import { listFs } from "$lib/api";
  import Folder from "@lucide/svelte/icons/folder";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Home from "@lucide/svelte/icons/home";
  import { onDestroy } from "svelte";

  type Props = {
    value?: string;
    /** Fallback when value is empty */
    defaultPath?: string;
    disabled?: boolean;
    onChange?: (path: string) => void;
  };

  let { value = "", defaultPath = "", disabled = false, onChange }: Props = $props();

  let open = $state(false);
  let browsePath = $state("");
  let parent = $state<string | null>(null);
  let home = $state<string | undefined>(undefined);
  let entries = $state<{ name: string; path: string }[]>([]);
  let loading = $state(false);
  let err = $state<string | null>(null);
  let root: HTMLDivElement | undefined = $state();

  function shortFolder(p: string) {
    const segs = p.split("/").filter(Boolean);
    return segs.slice(-2).join("/") || p || "Pick folder";
  }

  async function load(p?: string) {
    loading = true;
    err = null;
    try {
      const res = await listFs(p || undefined);
      browsePath = res.path;
      parent = res.parent;
      home = res.home;
      entries = res.entries;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
      entries = [];
    } finally {
      loading = false;
    }
  }

  async function toggle() {
    if (disabled) return;
    open = !open;
    if (open) {
      await load(value || defaultPath || undefined);
    }
  }

  function selectHere() {
    if (!browsePath) return;
    onChange?.(browsePath);
    open = false;
  }

  function onDocClick(e: MouseEvent) {
    if (!open || !root) return;
    if (!root.contains(e.target as Node)) open = false;
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  });

  onDestroy(() => {
    document.removeEventListener("mousedown", onDocClick);
  });
</script>

<div class="relative" bind:this={root}>
  <button
    type="button"
    class="flex h-7 max-w-[16rem] items-center gap-1 rounded-full bg-muted/70 px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50 dark:bg-muted/40"
    title={value || defaultPath || "Pick working folder"}
    onclick={toggle}
    {disabled}
  >
    <Folder class="size-3 shrink-0 opacity-70" />
    <span class="min-w-0 truncate">{shortFolder(value || defaultPath)}</span>
  </button>

  {#if open}
    <div
      class="absolute bottom-full left-0 z-50 mb-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      role="dialog"
      aria-label="Choose folder"
    >
      <div class="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <button
          type="button"
          class="rounded p-1 hover:bg-muted disabled:opacity-40"
          title="Parent folder"
          disabled={!parent || loading}
          onclick={() => parent && load(parent)}
        >
          <ChevronUp class="size-3.5" />
        </button>
        {#if home}
          <button
            type="button"
            class="rounded p-1 hover:bg-muted disabled:opacity-40"
            title="Home"
            disabled={loading}
            onclick={() => load(home)}
          >
            <Home class="size-3.5" />
          </button>
        {/if}
        <span class="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={browsePath}>
          {browsePath || "…"}
        </span>
        <button
          type="button"
          class="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:opacity-90"
          onclick={selectHere}
          disabled={!browsePath || loading}
        >
          Select
        </button>
      </div>
      <div class="max-h-48 overflow-y-auto py-1">
        {#if loading}
          <div class="px-3 py-2 text-[11px] text-muted-foreground">Loading</div>
        {:else if err}
          <div class="px-3 py-2 text-[11px] text-destructive">{err}</div>
        {:else if entries.length === 0}
          <div class="px-3 py-2 text-[11px] text-muted-foreground">No subfolders</div>
        {:else}
          {#each entries as e (e.path)}
            <button
              type="button"
              class="flex w-full items-center gap-1.5 px-3 py-1 text-left text-[11px] hover:bg-muted"
              onclick={() => load(e.path)}
            >
              <Folder class="size-3 shrink-0 opacity-60" />
              <span class="min-w-0 truncate">{e.name}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
