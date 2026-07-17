<script lang="ts">
  import type { HTMLLiAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLLiAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<li
  data-slot="sidebar-menu-item"
  data-sidebar="menu-item"
  class={cn("group/menu-item relative", className)}
  {...restProps}
>
  {@render children?.()}
</li>
