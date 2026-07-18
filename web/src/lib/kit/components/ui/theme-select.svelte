<script lang="ts">
  /** Segmented light / dark / system control. */
  import { cn } from "../../utils.js";
  import { setTheme, theme, type Theme } from "../../theme.svelte.js";

  type Props = {
    class?: string;
    value?: Theme;
    onValueChange?: (theme: Theme) => void;
  };

  let { class: className, value, onValueChange }: Props = $props();

  const current = $derived(value ?? theme.value);
  const options: { id: Theme; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "System" },
  ];

  function pick(id: Theme) {
    if (value !== undefined) onValueChange?.(id);
    else {
      setTheme(id);
      onValueChange?.(id);
    }
  }
</script>

<div
  class={cn(
    "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5 text-xs",
    className,
  )}
  role="group"
  aria-label="Theme"
>
  {#each options as opt (opt.id)}
    <button
      type="button"
      class={cn(
        "rounded-md px-2.5 py-1 font-medium transition-colors",
        current === opt.id
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={current === opt.id}
      onclick={() => pick(opt.id)}
    >
      {opt.label}
    </button>
  {/each}
</div>
