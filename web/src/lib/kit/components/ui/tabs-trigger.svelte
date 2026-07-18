<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    value,
    ...restProps
  }: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
  bind:ref
  {value}
  data-slot="tabs-trigger"
  class={cn(
    "ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white",
    className
  )}
  {...restProps}
>
  <!-- The parent tabs list owns any shared active indicator. -->
  {@render children?.()}
</TabsPrimitive.Trigger>
