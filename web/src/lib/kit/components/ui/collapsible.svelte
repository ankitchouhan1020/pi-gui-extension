<script lang="ts">
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";

  let {
    open = $bindable(false),
    children,
    ...restProps
  }: CollapsiblePrimitive.RootProps = $props();
</script>

<CollapsiblePrimitive.Root bind:open data-slot="collapsible" {...restProps}>
  {@render children?.()}
</CollapsiblePrimitive.Root>
