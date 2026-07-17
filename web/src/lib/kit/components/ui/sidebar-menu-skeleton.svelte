<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";
  import Skeleton from "./skeleton.svelte";

  type Props = HTMLAttributes<HTMLDivElement> & {
    showIcon?: boolean;
    class?: string;
  };

  let {
    class: className,
    showIcon = false,
    ...restProps
  }: Props = $props();

  // ponytail: fixed mid-range width; random per-mount if visual variety needed
  const width = "70%";
</script>

<div
  data-slot="sidebar-menu-skeleton"
  data-sidebar="menu-skeleton"
  class={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
  {...restProps}
>
  {#if showIcon}
    <Skeleton class="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />
  {/if}
  <Skeleton
    class="h-4 max-w-(--skeleton-width) flex-1"
    data-sidebar="menu-skeleton-text"
    style="--skeleton-width: {width}"
  />
</div>
