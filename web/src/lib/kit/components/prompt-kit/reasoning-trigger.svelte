<script lang="ts">
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { getReasoningContext } from "./reasoning-context.js";

	type Props = {
		children?: Snippet;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		[key: string]: unknown;
	};

	let { children, class: className, onclick, ...rest }: Props = $props();

	const ctx = getReasoningContext();

	function handleClick(e: MouseEvent) {
		ctx.onOpenChange(!ctx.isOpen);
		onclick?.(e);
	}
</script>

<button
	type="button"
	class={cn("flex cursor-pointer items-center gap-2", className)}
	onclick={handleClick}
	{...rest}
>
	<span class="text-primary">{@render children?.()}</span>
	<div
		class={cn(
			"transform transition-transform",
			ctx.isOpen ? "rotate-180" : ""
		)}
	>
		<ChevronDownIcon class="size-4" />
	</div>
</button>
