<script lang="ts">
  import { cn } from "$lib/utils";
  import { btn } from "./_btn.js";
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Sliders from "@lucide/svelte/icons/sliders";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Plus from "@lucide/svelte/icons/plus";

  export interface ImageVariation {
    id: string;
    url: string;
    label: string;
    timestamp: string;
  }

  export interface AgentImageEditorProps {
    imageUrl?: string;
    variations?: ImageVariation[];
    currentVariation?: string;
    isGenerating?: boolean;
    onExport?: (format?: "png" | "jpg" | "webp") => void;
    onCopy?: () => void;
    onCreateVariation?: () => void;
    onAdjust?: () => void;
    onEnhance?: () => void;
    onRegenerateResponse?: () => void;
    class?: string;
    agentAvatar?: string;
    timestamp?: string;
  }

  let {
    imageUrl,
    variations = [],
    currentVariation,
    isGenerating = false,
    onExport,
    onCopy,
    onCreateVariation,
    onAdjust,
    onEnhance,
    onRegenerateResponse,
    class: className,
    timestamp = "Just now",
  }: AgentImageEditorProps = $props();

  let isExporting = $state(false);
  let isCreatingVariation = $state(false);

  const currentVariationData = $derived(
    variations.find((v) => v.id === currentVariation) || variations[0]
  );

  async function handleExport() {
    isExporting = true;
    await onExport?.();
    setTimeout(() => {
      isExporting = false;
    }, 1000);
  }

  async function handleCreateVariation() {
    isCreatingVariation = true;
    await onCreateVariation?.();
    setTimeout(() => {
      isCreatingVariation = false;
    }, 2000);
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  {#if currentVariationData}
    <div class="text-sm font-medium text-foreground">
      {currentVariationData.label}
    </div>
  {/if}

  <div class="relative group">
    <div class="rounded-xl border bg-muted overflow-hidden">
      {#if imageUrl}
        <img
          src={imageUrl}
          alt={currentVariationData?.label || "Generated image"}
          class="w-full h-auto max-h-96 object-cover"
        />
      {:else}
        <div class="aspect-video flex items-center justify-center bg-muted">
          <div class="text-center space-y-2">
            <ImageIcon class="h-12 w-12 mx-auto text-muted-foreground" />
            <p class="text-muted-foreground">
              {isGenerating ? "Generating image..." : "No image generated yet"}
            </p>
          </div>
        </div>
      {/if}

      {#if isGenerating}
        <div class="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div class="bg-white rounded-lg p-3 shadow-lg">
            <div class="flex items-center gap-2">
              <RefreshCw class="h-4 w-4 animate-spin" />
              <span class="text-sm">Generating...</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    {#if imageUrl && !isGenerating}
      <div class="absolute bottom-4 left-4 right-4">
        <div class="bg-white/90 backdrop-blur-sm border rounded-lg p-2">
          <div class="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              class={btn("default", "sm", "bg-black text-white hover:bg-black/90 flex-shrink-0")}
              onclick={handleExport}
              disabled={isExporting}
              title="Export image"
            >
              <Download class="h-4 w-4 mr-2" />
              Export
              {#if isExporting}
                <RefreshCw class="h-3 w-3 ml-1 animate-spin" />
              {/if}
            </button>

            <button
              type="button"
              class={btn("outline", "sm", "flex-shrink-0")}
              onclick={handleCreateVariation}
              disabled={isCreatingVariation}
              title="Create a new variation"
            >
              <Plus class="h-4 w-4 mr-2" />
              Create variation
              {#if isCreatingVariation}
                <RefreshCw class="h-3 w-3 ml-1 animate-spin" />
              {/if}
            </button>

            <button
              type="button"
              class={btn("outline", "sm", "flex-shrink-0")}
              onclick={() => onAdjust?.()}
              title="Adjust image parameters"
            >
              <Sliders class="h-4 w-4 mr-2" />
              Adjust
            </button>

            <button
              type="button"
              class={btn("outline", "sm", "flex-shrink-0")}
              onclick={() => onEnhance?.()}
              title="Enhance image quality"
            >
              <Sparkles class="h-4 w-4 mr-2" />
              Enhance
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div
        class="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full"
        data-slot="avatar"
      >
        <div
          class="bg-muted flex size-full items-center justify-center rounded-full bg-blue-100 text-blue-600"
          data-slot="avatar-fallback"
        >
          <Settings2 class="h-4 w-4" />
        </div>
      </div>
      <span class="text-sm text-muted-foreground">{timestamp}</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onCopy?.()}
        title="Copy image"
      >
        Copy
      </button>

      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onRegenerateResponse?.()}
        title="Generate a new image"
      >
        Regenerate response
      </button>

      <div class="flex gap-1">
        <span class="text-lg">😊</span>
        <span class="text-lg">😔</span>
      </div>
    </div>
  </div>

  {#if variations.length > 1}
    <div class="space-y-2">
      <p class="text-sm font-medium">Variations</p>
      <div class="flex gap-2 overflow-x-auto pb-2">
        {#each variations as variation (variation.id)}
          <button
            type="button"
            class={cn(
              "flex-shrink-0 rounded-lg border p-2 text-xs hover:border-primary transition-colors",
              currentVariation === variation.id && "border-primary bg-primary/5"
            )}
          >
            <div class="w-16 h-12 bg-muted rounded mb-1"></div>
            <p class="truncate w-16">{variation.label}</p>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
