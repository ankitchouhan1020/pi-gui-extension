<script lang="ts">
  import type { HTMLOlAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLOlAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<ol
  data-slot="breadcrumb-list"
  class={cn(
    "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</ol>
