<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  type Props = DropdownMenuPrimitive.GroupHeadingProps & {
    inset?: boolean;
  };

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: Props = $props();
</script>

<DropdownMenuPrimitive.GroupHeading
  bind:ref
  data-slot="dropdown-menu-label"
  data-inset={inset}
  class={cn("px-2 py-1.5 text-sm font-semibold data-inset:pl-8", className)}
  {...restProps}
>
  {@render children?.()}
</DropdownMenuPrimitive.GroupHeading>
