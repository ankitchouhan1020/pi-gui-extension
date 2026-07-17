<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

  let {
    open = $bindable(false),
    children,
    ...restProps
  }: DropdownMenuPrimitive.SubProps = $props();
</script>

<DropdownMenuPrimitive.Sub bind:open {...restProps}>
  {@render children?.()}
</DropdownMenuPrimitive.Sub>
