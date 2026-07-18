<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "../../utils.js";
  import { useIsMobile } from "../../hooks/use-mobile.svelte.js";
  import TooltipProvider from "./tooltip-provider.svelte";
  import {
    setSidebarContext,
    setSidebarCookie,
    SIDEBAR_WIDTH,
    SIDEBAR_WIDTH_ICON,
    SIDEBAR_KEYBOARD_SHORTCUT,
    type SidebarContextProps,
  } from "./sidebar-context.svelte.js";

  type Props = HTMLAttributes<HTMLDivElement> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    class?: string;
    children?: Snippet;
  };

  let {
    defaultOpen = true,
    open: openControlled = $bindable(undefined as boolean | undefined),
    onOpenChange,
    class: className,
    style,
    children,
    ...restProps
  }: Props = $props();

  const mobile = useIsMobile();
  let openMobile = $state(false);
  // intentional: capture defaultOpen initial value like React useState(defaultOpen)
  let internalOpen = $state(defaultOpen);

  function getOpen(): boolean {
    return openControlled ?? internalOpen;
  }

  function setOpen(value: boolean) {
    if (openControlled !== undefined) {
      openControlled = value;
    } else {
      internalOpen = value;
    }
    onOpenChange?.(value);
    setSidebarCookie(value);
  }

  function setOpenMobile(value: boolean) {
    openMobile = value;
  }

  function toggleSidebar() {
    if (mobile.current) {
      setOpenMobile(!openMobile);
    } else {
      setOpen(!getOpen());
    }
  }

  $effect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const ctx: SidebarContextProps = {
    get state() {
      return getOpen() ? "expanded" : "collapsed";
    },
    get open() {
      return getOpen();
    },
    setOpen,
    get openMobile() {
      return openMobile;
    },
    setOpenMobile,
    get isMobile() {
      return mobile.current;
    },
    toggleSidebar,
  };

  setSidebarContext(ctx);
</script>

<TooltipProvider delayDuration={0}>
  <div
    data-slot="sidebar-wrapper"
    style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {typeof style === 'string' ? style : ''}"
    class={cn(
      "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </div>
</TooltipProvider>
