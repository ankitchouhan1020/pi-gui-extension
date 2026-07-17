<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import { cn } from "$lib/utils.js";

  type Props = HTMLAttributes<HTMLSpanElement> & {
    class?: string;
  };

  let { class: className, ...restProps }: Props = $props();
</script>

<span
  data-slot="breadcrumb-ellipsis"
  role="presentation"
  aria-hidden="true"
  class={cn("flex size-9 items-center justify-center", className)}
  {...restProps}
>
  <MoreHorizontal class="size-4" />
  <span class="sr-only">More</span>
</span>
