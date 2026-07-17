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
  data-slot="sidebar-menu-sub"
  data-sidebar="menu-sub"
  class={cn(
    "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
    "group-data-[collapsible=icon]:hidden",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</ul>
