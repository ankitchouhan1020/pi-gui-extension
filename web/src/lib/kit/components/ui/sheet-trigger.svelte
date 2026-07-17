<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";

  let {
    ref = $bindable(null),
    children,
    ...restProps
  }: SheetPrimitive.TriggerProps = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...restProps}>
  {@render children?.()}
</SheetPrimitive.Trigger>
