<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";
  import {
    useSidebar,
    SIDEBAR_WIDTH_MOBILE,
  } from "./sidebar-context.svelte.js";
  import Sheet from "./sheet.svelte";
  import SheetContent from "./sheet-content.svelte";
  import SheetHeader from "./sheet-header.svelte";
  import SheetTitle from "./sheet-title.svelte";
  import SheetDescription from "./sheet-description.svelte";

  type Props = HTMLAttributes<HTMLDivElement> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
    class?: string;
    children?: Snippet;
  };

  let {
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    class: className,
    children,
    ...restProps
  }: Props = $props();

  const sidebar = useSidebar();
</script>

{#if collapsible === "none"}
  <div
    data-slot="sidebar"
    class={cn(
      "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </div>
{:else if sidebar.isMobile}
  <Sheet
    open={sidebar.openMobile}
    onOpenChange={sidebar.setOpenMobile}
    {...restProps}
  >
    <SheetContent
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      class={cn(
        "bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden",
        className
      )}
      style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE}"
      {side}
    >
      <SheetHeader class="sr-only">
        <SheetTitle>Sidebar</SheetTitle>
        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
      </SheetHeader>
      <div class="flex h-full w-full flex-col">
        {@render children?.()}
      </div>
    </SheetContent>
  </Sheet>
{:else}
  <div
    class="group peer text-sidebar-foreground hidden md:block"
    data-state={sidebar.state}
    data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
    data-variant={variant}
    data-side={side}
    data-slot="sidebar"
  >
    <div
      data-slot="sidebar-gap"
      class={cn(
        "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
        "group-data-[collapsible=offcanvas]:w-0",
        "group-data-[side=right]:rotate-180",
        variant === "floating" || variant === "inset"
          ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
          : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
      )}
    ></div>
    <div
      data-slot="sidebar-container"
      class={cn(
        "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
        side === "left"
          ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
          : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
        variant === "floating" || variant === "inset"
          ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
          : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
        className
      )}
      {...restProps}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
      >
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
