<script lang="ts">
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import VolumeX from "@lucide/svelte/icons/volume-x";
  import { isSoundEnabled, setSoundEnabled, subscribeSoundEnabled } from "$lib/feedback";

  let enabled = $state(isSoundEnabled());

  $effect(() => subscribeSoundEnabled((next) => (enabled = next)));

  function toggle() {
    setSoundEnabled(!enabled);
  }
</script>

<button
  type="button"
  class="pi-tactile relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
  aria-label={enabled ? "Mute interface sounds" : "Enable interface sounds"}
  aria-pressed={enabled}
  title={enabled ? "Interface sounds on" : "Interface sounds off"}
  onclick={toggle}
>
  <span class="relative size-4" aria-hidden="true">
    <Volume2 class="absolute inset-0 size-4 transition-[opacity,scale,filter] duration-200 {enabled ? 'scale-100 opacity-100 blur-0' : 'scale-25 opacity-0 blur-[4px]'}" />
    <VolumeX class="absolute inset-0 size-4 transition-[opacity,scale,filter] duration-200 {enabled ? 'scale-25 opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'}" />
  </span>
</button>
