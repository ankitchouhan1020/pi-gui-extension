<script lang="ts">
  import { cn } from "$lib/utils";
  import { btn } from "./_btn.js";
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Play from "@lucide/svelte/icons/play";
  import Pause from "@lucide/svelte/icons/pause";
  import SkipBack from "@lucide/svelte/icons/skip-back";
  import SkipForward from "@lucide/svelte/icons/skip-forward";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import Edit2 from "@lucide/svelte/icons/edit-2";
  import Scissors from "@lucide/svelte/icons/scissors";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Video from "@lucide/svelte/icons/video";
  import Clock from "@lucide/svelte/icons/clock";

  export interface VideoClip {
    id: string;
    name: string;
    duration: number;
    startTime: number;
    endTime: number;
    thumbnail?: string;
  }

  export interface AgentVideoEditorProps {
    videoUrl?: string;
    isGenerating?: boolean;
    isPlaying?: boolean;
    currentTime?: number;
    duration?: number;
    clips?: VideoClip[];
    onPlay?: () => void;
    onPause?: () => void;
    onSeek?: (time: number) => void;
    onSkipBack?: () => void;
    onSkipForward?: () => void;
    onExport?: (format?: "mp4" | "mov" | "avi") => void;
    onCopy?: () => void;
    onEdit?: () => void;
    onTrim?: () => void;
    onRegenerateResponse?: () => void;
    class?: string;
    timestamp?: string;
  }

  let {
    videoUrl,
    isGenerating = false,
    isPlaying = false,
    currentTime = 12,
    duration = 45,
    clips = [],
    onPlay,
    onPause,
    onSkipBack,
    onSkipForward,
    onExport,
    onCopy,
    onEdit,
    onTrim,
    onRegenerateResponse,
    class: className,
    timestamp = "Just now",
  }: AgentVideoEditorProps = $props();

  let isExporting = $state(false);

  const progressPercentage = $derived(
    duration > 0 ? (currentTime / duration) * 100 : 0
  );

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleExport() {
    isExporting = true;
    await onExport?.();
    setTimeout(() => {
      isExporting = false;
    }, 1000);
  }

  function handlePlayPause() {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div class="relative group">
    <div class="rounded-xl border bg-black overflow-hidden">
      {#if videoUrl}
        <div
          class="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"
        >
          <div class="text-white text-center">
            <Video class="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p class="text-sm opacity-75">Video Preview</p>
          </div>

          <div
            class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <div class="flex items-center gap-4">
              <button
                type="button"
                class={btn(
                  "secondary",
                  "icon",
                  "h-12 w-12 rounded-full bg-white/20 text-white hover:bg-white/30"
                )}
                onclick={() => onSkipBack?.()}
              >
                <SkipBack class="h-5 w-5" />
              </button>

              <button
                type="button"
                class={btn(
                  "secondary",
                  "icon",
                  "h-16 w-16 rounded-full bg-white text-black hover:bg-white/90"
                )}
                onclick={handlePlayPause}
                disabled={isGenerating}
              >
                {#if isGenerating}
                  <RefreshCw class="h-6 w-6 animate-spin" />
                {:else if isPlaying}
                  <Pause class="h-6 w-6" />
                {:else}
                  <Play class="h-6 w-6 ml-1" />
                {/if}
              </button>

              <button
                type="button"
                class={btn(
                  "secondary",
                  "icon",
                  "h-12 w-12 rounded-full bg-white/20 text-white hover:bg-white/30"
                )}
                onclick={() => onSkipForward?.()}
              >
                <SkipForward class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="aspect-video bg-muted flex items-center justify-center">
          <div class="text-center space-y-2">
            <Video class="h-12 w-12 mx-auto text-muted-foreground" />
            <p class="text-muted-foreground">
              {isGenerating ? "Generating video..." : "No video generated yet"}
            </p>
          </div>
        </div>
      {/if}

      {#if isGenerating}
        <div class="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div class="bg-white rounded-lg p-4 shadow-lg">
            <div class="flex items-center gap-3">
              <RefreshCw class="h-5 w-5 animate-spin" />
              <div>
                <p class="font-medium">Processing video...</p>
                <p class="text-sm text-muted-foreground">This may take a few minutes</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    {#if videoUrl && !isGenerating}
      <div class="absolute bottom-4 left-4 right-4">
        <div class="bg-white/90 backdrop-blur-sm border rounded-lg p-3">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium">{formatTime(currentTime)}</span>

            <div class="flex-1">
              <div
                class="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
                data-slot="progress"
              >
                <div
                  class="h-full w-full flex-1 bg-primary transition-all"
                  style="transform: translateX(-{100 - progressPercentage}%)"
                ></div>
              </div>
            </div>

            <span class="text-sm font-medium">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if clips.length > 0}
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">Timeline</span>
      </div>

      <div class="bg-muted rounded-lg p-3">
        <div class="flex gap-1 h-12 overflow-x-auto">
          {#each clips as clip (clip.id)}
            <div
              class="flex-shrink-0 bg-primary rounded h-full flex items-center justify-center min-w-16 px-2"
              style="width: {(clip.endTime - clip.startTime) / duration * 200}px; min-width: 48px"
            >
              <span class="text-xs text-primary-foreground font-medium truncate">
                {clip.name}
              </span>
            </div>
          {/each}
        </div>

        <div class="flex justify-between text-xs text-muted-foreground mt-2">
          <span>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="flex gap-3 flex-wrap">
    <button
      type="button"
      class={btn("default", "default", "bg-black text-white hover:bg-black/90")}
      onclick={handleExport}
      disabled={isExporting || !videoUrl}
      title="Export video file"
    >
      <Download class="h-4 w-4 mr-2" />
      Export
      {#if isExporting}
        <RefreshCw class="h-3 w-3 ml-1 animate-spin" />
      {/if}
    </button>

    <button
      type="button"
      class={btn("outline")}
      onclick={() => onEdit?.()}
      title="Edit video settings"
    >
      <Edit2 class="h-4 w-4 mr-2" />
      Edit
    </button>

    <button
      type="button"
      class={btn("outline")}
      onclick={() => onTrim?.()}
      title="Trim video clips"
    >
      <Scissors class="h-4 w-4 mr-2" />
      Trim
    </button>

    <button type="button" class={btn("outline")} title="Adjust audio settings">
      <Volume2 class="h-4 w-4 mr-2" />
      Audio
    </button>
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
        title="Copy video"
      >
        Copy
      </button>

      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onRegenerateResponse?.()}
        title="Generate new video"
      >
        Regenerate response
      </button>

      <div class="flex gap-1">
        <span class="text-lg">😊</span>
        <span class="text-lg">😔</span>
      </div>
    </div>
  </div>
</div>
