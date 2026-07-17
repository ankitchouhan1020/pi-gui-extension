<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import { cn } from "$lib/utils.js";
  import Button from "./button.svelte";
  import { useSidebar } from "./sidebar-context.svelte.js";

  type Props = HTMLButtonAttributes & {
    class?: string;
  };

  let {
    class: className,
    onclick,
    ...restProps
  }: Props = $props();

  const sidebar = useSidebar();
</script>

<Button
  data-sidebar="trigger"
  data-slot="sidebar-trigger"
  variant="ghost"
  size="icon"
  class={cn("size-7", className)}
  onclick={(event) => {
    onclick?.(event);
    sidebar.toggleSidebar();
  }}
  {...restProps}
>
  <PanelLeftIcon />
  <span class="sr-only">Toggle Sidebar</span>
</Button>
