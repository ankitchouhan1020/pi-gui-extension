<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import { cn } from "$lib/utils";
	import {
		buttonVariants,
		type ButtonSize,
		type ButtonVariant,
	} from "./button-variants.js";
	import { tryGetStickToBottomContext } from "./stick-to-bottom-context.js";

	type Props = {
		class?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		onclick?: (e: MouseEvent) => void;
		[key: string]: unknown;
	};

	let {
		class: className,
		variant = "outline",
		size = "sm",
		onclick,
		...rest
	}: Props = $props();

	const ctx = tryGetStickToBottomContext();

	const isAtBottom = $derived(ctx?.isAtBottom ?? true);

	function handleClick(e: MouseEvent) {
		ctx?.scrollToBottom("smooth");
		onclick?.(e);
	}
</script>

<button
	type="button"
	data-slot="button"
	class={cn(
		buttonVariants({ variant, size }),
		"h-10 w-10 rounded-full transition-all duration-150 ease-out",
		!isAtBottom
			? "translate-y-0 scale-100 opacity-100"
			: "pointer-events-none translate-y-4 scale-95 opacity-0",
		className
	)}
	onclick={handleClick}
	{...rest}
>
	<ChevronDown class="h-5 w-5" />
</button>
