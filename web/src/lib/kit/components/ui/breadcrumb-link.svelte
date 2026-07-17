<script lang="ts">
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  type Props = HTMLAnchorAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, href, ...restProps }: Props = $props();
</script>

<a
  data-slot="breadcrumb-link"
  {href}
  class={cn("hover:text-foreground transition-colors", className)}
  {...restProps}
>
  {@render children?.()}
</a>
