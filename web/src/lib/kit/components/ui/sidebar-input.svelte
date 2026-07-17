<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";
  import Input from "./input.svelte";

  type Props = HTMLInputAttributes & {
    class?: string;
  };

  let {
    class: className,
    value = $bindable(),
    ...restProps
  }: Props = $props();
</script>

<Input
  data-slot="sidebar-input"
  data-sidebar="input"
  class={cn("bg-background h-8 w-full shadow-none", className)}
  bind:value
  {...restProps}
/>
