<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet;
  };

  let { children, ...restProps }: Props = $props();
</script>

<nav aria-label="breadcrumb" data-slot="breadcrumb" {...restProps}>
  {@render children?.()}
</nav>
