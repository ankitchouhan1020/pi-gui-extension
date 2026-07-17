<script lang="ts">
  import type { HTMLLiAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { cn } from "$lib/utils.js";

  type Props = HTMLLiAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className, children, ...restProps }: Props = $props();
</script>

<li
  data-slot="breadcrumb-separator"
  role="presentation"
  aria-hidden="true"
  class={cn("[&>svg]:size-3.5", className)}
  {...restProps}
>
  {#if children}
    {@render children()}
  {:else}
    <ChevronRight />
  {/if}
</li>
