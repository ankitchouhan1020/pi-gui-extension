<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { setContext } from "svelte";

  let {
    value = $bindable(""),
    children,
    ...restProps
  }: TabsPrimitive.RootProps = $props();

  const uniqueId = $props.id();
  setContext("tabs-id", uniqueId);
</script>

<TabsPrimitive.Root bind:value data-slot="tabs" {...restProps}>
  {@render children?.()}
</TabsPrimitive.Root>
