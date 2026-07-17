<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();
</script>

<div
	class={cn(
		"not-prose flex w-full flex-col overflow-hidden",
		"rounded-xl border border-border/80",
		"bg-background/80 text-foreground",
		"dark:bg-black/25",
		className,
	)}
	data-slot="code-block"
	{...rest}
>
	{@render children?.()}
</div>
