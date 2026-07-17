<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();
</script>

<div class={cn("flex w-full flex-col", className)} {...rest}>
	{@render children?.()}
</div>
