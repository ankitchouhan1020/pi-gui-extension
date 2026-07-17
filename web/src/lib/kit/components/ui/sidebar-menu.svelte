<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLAttributes<HTMLUListElement> & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<ul
  data-slot="sidebar-menu"
  data-sidebar="menu"
  class={cn("flex w-full min-w-0 flex-col gap-1", className)}
  {...restProps}
>
  {@render children?.()}
</ul>
