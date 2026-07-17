<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  type Props = Omit<ScrollAreaPrimitive.ScrollbarProps, "orientation"> & {
    orientation?: "vertical" | "horizontal";
  };

  let {
    ref = $bindable(null),
    class: className,
    orientation = "vertical",
    ...restProps
  }: Props = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  data-slot="scroll-area-scrollbar"
  {orientation}
  class={cn(
    "flex touch-none p-px transition-colors select-none",
    orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
    orientation === "horizontal" &&
      "h-2.5 flex-col border-t border-t-transparent",
    className
  )}
  {...restProps}
>
  <ScrollAreaPrimitive.Thumb
    data-slot="scroll-area-thumb"
    class="bg-border relative flex-1 rounded-full"
  />
</ScrollAreaPrimitive.Scrollbar>
