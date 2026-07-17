<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type RootProps = TooltipPrimitive.RootProps & {
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    children,
    ...restProps
  }: RootProps = $props();
</script>

<TooltipPrimitive.Provider delayDuration={0}>
  <TooltipPrimitive.Root bind:open {...restProps}>
    {@render children?.()}
  </TooltipPrimitive.Root>
</TooltipPrimitive.Provider>
