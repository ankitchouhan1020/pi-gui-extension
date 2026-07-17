<script lang="ts">
  import { cn } from "$lib/utils";
  import { btn } from "./_btn.js";
  import Download from "@lucide/svelte/icons/download";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Play from "@lucide/svelte/icons/play";
  import Pause from "@lucide/svelte/icons/pause";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import Edit2 from "@lucide/svelte/icons/edit-2";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Settings2 from "@lucide/svelte/icons/settings-2";

  export interface VoiceOption {
    id: string;
    name: string;
    gender: "Male" | "Female";
    accent?: string;
  }

  export interface AgentAudioGeneratorProps {
    audioUrl?: string;
    isGenerating?: boolean;
    isPlaying?: boolean;
    currentTime?: number;
    duration?: number;
    onPlay?: () => void;
    onPause?: () => void;
    onSeek?: (time: number) => void;
    onExport?: (format?: "mp3" | "wav" | "m4a") => void;
    onCopy?: () => void;
    onEdit?: () => void;
    onRegenerateResponse?: () => void;
    onLanguageChange?: (language: string) => void;
    onSpeedChange?: (speed: string) => void;
    onVoiceChange?: (voice: VoiceOption) => void;
    onToneChange?: (tone: string) => void;
    language?: string;
    speed?: string;
    voice?: VoiceOption;
    tone?: string;
    availableVoices?: VoiceOption[];
    class?: string;
    timestamp?: string;
  }

  const defaultVoices: VoiceOption[] = [
    { id: "jenny", name: "Jenny", gender: "Female", accent: "American" },
    { id: "alex", name: "Alex", gender: "Male", accent: "British" },
    { id: "sarah", name: "Sarah", gender: "Female", accent: "Australian" },
  ];

  let {
    audioUrl,
    isGenerating = false,
    isPlaying = false,
    currentTime = 21,
    duration = 62,
    onPlay,
    onPause,
    onExport,
    onCopy,
    onEdit,
    onRegenerateResponse,
    onVoiceChange,
    onToneChange,
    language = "English (US)",
    speed = "Normal",
    voice = defaultVoices[0],
    tone = "Friendly",
    availableVoices = defaultVoices,
    class: className,
    timestamp = "Just now",
  }: AgentAudioGeneratorProps = $props();

  let isExporting = $state(false);

  const progressPercentage = $derived(
    duration > 0 ? (currentTime / duration) * 100 : 0
  );

  const waveformHeights = Array.from({ length: 80 }, (_, i) => {
    const x = i / 80;
    const wave1 = Math.sin(x * Math.PI * 12) * 15;
    const wave2 = Math.sin(x * Math.PI * 24) * 8;
    const wave3 = Math.sin(x * Math.PI * 3) * 12;
    const noise1 = Math.sin(x * 137.5) * 6;
    const noise2 = Math.sin(x * 341.3) * 4;
    const noise3 = Math.sin(x * 523.7) * 3;
    const combined = wave1 + wave2 + wave3 + noise1 + noise2 + noise3;
    const height = Math.abs(combined) + 8;
    return Math.min(height, 48);
  });

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

  function cycleVoiceGender() {
    const newGender = voice.gender === "Female" ? "Male" : "Female";
    const newVoice = availableVoices.find((v) => v.gender === newGender) || voice;
    onVoiceChange?.(newVoice);
  }

  function cycleTone() {
    const tones = ["Professional", "Friendly", "Excited", "Calm"];
    const currentIndex = tones.indexOf(tone);
    const nextTone = tones[(currentIndex + 1) % tones.length];
    onToneChange?.(nextTone);
  }

  const toneLabel = $derived(
    tone === "Professional"
      ? "😐 Professional"
      : tone === "Friendly"
        ? "😊 Friendly"
        : tone === "Excited"
          ? "🤗 Excited"
          : tone === "Calm"
            ? "😌 Calm"
            : tone
  );
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div class="text-sm text-foreground">
    Your audio has been successfully generated. You may further customize it or simply download it
    for use.
  </div>

  <div class="relative bg-muted rounded-xl p-6">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class={btn(
          "secondary",
          "icon",
          "h-12 w-12 rounded-full bg-black text-white hover:bg-black/90"
        )}
        onclick={handlePlayPause}
        disabled={!audioUrl || isGenerating}
      >
        {#if isGenerating}
          <RefreshCw class="h-5 w-5 animate-spin" />
        {:else if isPlaying}
          <Pause class="h-5 w-5" />
        {:else}
          <Play class="h-5 w-5 ml-0.5" />
        {/if}
      </button>

      <div class="flex-1 relative min-w-0">
        <div class="flex items-center justify-center h-16 gap-0.5 overflow-hidden">
          {#each waveformHeights as height, i}
            {@const isPast = (i / 80) * 100 < progressPercentage}
            <div
              class={cn(
                "w-1 rounded-full transition-colors flex-shrink-0",
                isPast ? "bg-black" : "bg-gray-300"
              )}
              style="height: {height}px"
            ></div>
          {/each}
        </div>

        <div class="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>

    {#if isGenerating}
      <div class="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
        <div class="text-center space-y-2">
          <RefreshCw class="h-6 w-6 mx-auto animate-spin" />
          <p class="text-sm text-muted-foreground">Generating audio...</p>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex flex-wrap gap-3">
    <button
      type="button"
      class={btn("default", "default", "bg-black text-white hover:bg-black/90")}
      onclick={handleExport}
      disabled={isExporting || !audioUrl}
      title="Export audio file"
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
      title="Edit audio settings"
    >
      <Edit2 class="h-4 w-4 mr-2" />
      Edit
    </button>

    <button type="button" class={btn("outline", "default", "justify-between")} title="Select language">
      <span class="truncate">{language}</span>
      <ChevronDown class="h-4 w-4 ml-1" />
    </button>

    <button
      type="button"
      class={btn("outline", "default", "justify-between")}
      title="Adjust playback speed"
    >
      <span class="truncate">{speed}</span>
      <ChevronDown class="h-4 w-4 ml-1" />
    </button>
  </div>

  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2">
        <Volume2 class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">Voice</span>
      </div>

      <button
        type="button"
        class={btn("outline", "default", "justify-between")}
        onclick={cycleVoiceGender}
      >
        <span class="truncate">{voice.gender}</span>
        <ChevronDown class="h-4 w-4 ml-1" />
      </button>

      <button type="button" class={btn("outline", "default", "justify-between")}>
        <div class="flex items-center gap-1">
          <Volume2 class="h-3 w-3" />
          <span class="truncate">{voice.name}</span>
        </div>
        <ChevronDown class="h-4 w-4 ml-1" />
      </button>

      <button
        type="button"
        class={btn("outline", "default", "justify-between")}
        onclick={cycleTone}
      >
        <span class="truncate">{toneLabel}</span>
        <ChevronDown class="h-4 w-4 ml-1" />
      </button>
    </div>
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
        title="Copy audio"
      >
        Copy
      </button>

      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onRegenerateResponse?.()}
        title="Generate new audio"
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
