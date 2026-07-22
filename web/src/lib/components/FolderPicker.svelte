<script lang="ts">
  import { listFs } from "$lib/api";
  import Folder from "@lucide/svelte/icons/folder";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Home from "@lucide/svelte/icons/home";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";

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
  let query = $state("");
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement | undefined = $state();

  function shortFolder(p: string) {
    const segs = p.split("/").filter(Boolean);
    return segs.slice(-2).join("/") || p || "Pick folder";
  }

  function normalizePath(path: string) {
    return path.replace(/\/+$/, "") || "/";
  }

  const filteredEntries = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  });

  function clampSelected() {
    selectedIndex = filteredEntries.length ? Math.min(selectedIndex, filteredEntries.length - 1) : 0;
  }

  async function load(p?: string) {
    loading = true;
    err = null;
    query = "";
    try {
      const res = await listFs(p || undefined);
      browsePath = res.path;
      parent = res.parent;
      home = res.home;
      entries = res.entries;
      selectedIndex = 0;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
      entries = [];
      selectedIndex = 0;
    } finally {
      loading = false;
    }
  }

  async function openModal() {
    if (disabled) return;
    open = true;
    await load(value || defaultPath || undefined);
    requestAnimationFrame(() => inputRef?.focus());
  }

  function closeModal() {
    open = false;
    query = "";
  }

  function selectHere() {
    if (!browsePath) return;
    onChange?.(normalizePath(browsePath));
    closeModal();
  }

  function enterEntry() {
    const entry = filteredEntries[selectedIndex];
    if (!entry) return;
    void load(entry.path);
    requestAnimationFrame(() => inputRef?.focus());
  }

  function moveSelection(delta: number) {
    if (!filteredEntries.length) return;
    selectedIndex = (selectedIndex + delta + filteredEntries.length) % filteredEntries.length;
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeModal();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredEntries.length) enterEntry();
      else selectHere();
    }
  }

  $effect(() => {
    if (!open) return;
    clampSelected();
  });

</script>

<svelte:window onkeydown={onKeydown} />

<button
  type="button"
  class="flex h-7 max-w-[16rem] items-center gap-1 rounded-full bg-muted/70 px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50 dark:bg-muted/40"
  title={value || defaultPath || "Pick working folder"}
  onclick={openModal}
  {disabled}
>
  <Folder class="size-3 shrink-0 opacity-70" />
  <span class="min-w-0 truncate">{shortFolder(value || defaultPath)}</span>
</button>

{#if open}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
    role="dialog"
    aria-modal="true"
    aria-label="Choose folder"
    onclick={onBackdropClick}
  >
    <div class="flex h-[min(34rem,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          class="rounded p-1 hover:bg-muted disabled:opacity-40"
          title="Parent folder"
          disabled={!parent || loading}
          onclick={() => parent && void load(parent)}
        >
          <ChevronUp class="size-4" />
        </button>
        {#if home}
          <button
            type="button"
            class="rounded p-1 hover:bg-muted disabled:opacity-40"
            title="Home"
            disabled={loading}
            onclick={() => void load(home)}
          >
            <Home class="size-4" />
          </button>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="truncate font-mono text-[10px] text-muted-foreground" title={browsePath}>
            {browsePath || "…"}
          </div>
          <div class="text-[10px] text-muted-foreground">
            {filteredEntries.length} folder{filteredEntries.length === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
          onclick={selectHere}
          disabled={!browsePath || loading}
        >
          Select this folder
        </button>
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Close"
          aria-label="Close folder picker"
          onclick={closeModal}
        >
          <X class="size-4" />
        </button>
      </div>

      <div class="border-b border-border px-4 py-3">
        <div class="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            bind:value={query}
            type="text"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Filter folders"
          />
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto py-2">
        {#if loading}
          <div class="px-4 py-8 text-sm text-muted-foreground">Loading folders…</div>
        {:else if err}
          <div class="px-4 py-8 text-sm text-destructive">{err}</div>
        {:else if filteredEntries.length === 0}
          <div class="px-4 py-8 text-sm text-muted-foreground">No subfolders</div>
        {:else}
          {#each filteredEntries as e, i (e.path)}
            <button
              type="button"
              class="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors {i === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-popover-foreground'}"
              onclick={() => void load(e.path)}
              onmouseenter={() => (selectedIndex = i)}
            >
              <Folder class="size-4 shrink-0 opacity-60" />
              <span class="min-w-0 truncate">{e.name}</span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span>↑↓ move · Enter open · Esc close</span>
        <span>Double-click Select is not needed</span>
      </div>
    </div>
  </div>
{/if}
