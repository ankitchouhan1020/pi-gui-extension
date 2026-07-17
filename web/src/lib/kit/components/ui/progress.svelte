<script lang="ts">
  import { Progress as ProgressPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    value = 0,
    max = 100,
    ...restProps
  }: ProgressPrimitive.RootProps = $props();
</script>

<ProgressPrimitive.Root
  bind:ref
  {value}
  {max}
  data-slot="progress"
  class={cn(
    "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
    className
  )}
  {...restProps}
>
  <div
    data-slot="progress-indicator"
    class="h-full w-full flex-1 bg-primary transition-all"
    style="transform: translateX(-{100 - (value || 0)}%)"
  ></div>
</ProgressPrimitive.Root>
