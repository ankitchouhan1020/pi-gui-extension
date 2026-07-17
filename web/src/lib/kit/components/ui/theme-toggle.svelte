<script lang="ts">
  /**
   * Theme toggle — light / dark / system (cycles).
   * Matches agents-kit sun/moon control; adds system via cycle.
   */
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import Monitor from "@lucide/svelte/icons/monitor";
  import { cn } from "$lib/utils.js";
  import { setTheme, theme, type Theme } from "$lib/theme.svelte.js";
  import Button from "./button.svelte";

  type Props = {
    class?: string;
    /** `toggle` = light↔dark only; `cycle` = light → dark → system */
    mode?: "toggle" | "cycle";
    /** Controlled: if set, used instead of global theme store for display */
    value?: Theme;
    onValueChange?: (theme: Theme) => void;
  };

  let {
    class: className,
    mode = "cycle",
    value,
    onValueChange,
  }: Props = $props();

  const current = $derived(value ?? theme.value);

  function onClick() {
    const cur = value ?? theme.value;
    if (mode === "toggle") {
      const isDark =
        cur === "dark" ||
        (cur === "system" &&
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      const next: Theme = isDark ? "light" : "dark";
      if (value === undefined) setTheme(next);
      onValueChange?.(next);
      return;
    }
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    if (value === undefined) setTheme(next);
    onValueChange?.(next);
  }

  const label = $derived(
    current === "system" ? "System theme" : current === "dark" ? "Dark theme" : "Light theme",
  );
</script>

<Button
  variant="ghost"
  size="icon"
  class={cn("relative h-8 w-8", className)}
  onclick={onClick}
  title="{label} (click to change)"
  aria-label="{label}. Click to switch theme."
>
  {#if current === "system"}
    <Monitor class="h-4 w-4" />
  {:else}
    <Sun
      class="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
    />
    <Moon
      class="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
    />
  {/if}
  <span class="sr-only">{label}</span>
</Button>
