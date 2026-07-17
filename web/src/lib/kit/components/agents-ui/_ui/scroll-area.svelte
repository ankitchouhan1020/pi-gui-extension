<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type Props = HTMLAttributes<HTMLDivElement> & {
		class?: string;
		children?: Snippet;
		orientation?: "vertical" | "horizontal" | "both";
	};

	let {
		class: className,
		children,
		orientation = "vertical",
		...rest
	}: Props = $props();
</script>

<div
	data-slot="scroll-area"
	class={cn(
		"relative overflow-auto",
		orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
		orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
