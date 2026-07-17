<script lang="ts">
  import { cn } from "$lib/utils.js";
  import Separator from "./separator.svelte";
  import type { Separator as SeparatorPrimitive } from "bits-ui";

  let {
    class: className,
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
  data-slot="sidebar-separator"
  data-sidebar="separator"
  class={cn("bg-sidebar-border mx-2 w-auto", className)}
  {...restProps}
/>
