<script lang="ts">
  import type { HTMLLiAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLLiAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<li
  data-slot="breadcrumb-item"
  class={cn("inline-flex items-center gap-1.5", className)}
  {...restProps}
>
  {@render children?.()}
</li>
