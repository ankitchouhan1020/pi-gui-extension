<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLAttributes<HTMLSpanElement> & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<span
  data-slot="dropdown-menu-shortcut"
  class={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
  {...restProps}
>
  {@render children?.()}
</span>
