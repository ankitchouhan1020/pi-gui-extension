<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import {
		buttonVariants,
		type ButtonSize,
		type ButtonVariant,
	} from "./button-variants.js";

	type Props = {
		children?: Snippet | string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		highlight?: string;
		onclick?: (e: MouseEvent) => void;
		[key: string]: unknown;
	};

	let {
		children,
		variant,
		size,
		class: className,
		highlight,
		onclick,
		...rest
	}: Props = $props();

	const isHighlightMode = $derived(
		highlight !== undefined && highlight.trim() !== ""
	);
	const content = $derived(typeof children === "string" ? children : "");

	const trimmedHighlight = $derived(highlight?.trim() ?? "");
	const contentLower = $derived(content.toLowerCase());
	const highlightLower = $derived(trimmedHighlight.toLowerCase());
	const shouldHighlight = $derived(contentLower.includes(highlightLower));

	const index = $derived(
		shouldHighlight ? contentLower.indexOf(highlightLower) : -1
	);
	const actualHighlightedText = $derived(
		index === -1 ? "" : content.substring(index, index + highlightLower.length)
	);
	const before = $derived(index === -1 ? "" : content.substring(0, index));
	const after = $derived(
		index === -1
			? ""
			: content.substring(index + actualHighlightedText.length)
	);
</script>

{#if !isHighlightMode}
	<button
		type="button"
		data-slot="button"
		class={cn(
			buttonVariants({
				variant: variant || "outline",
				size: size || "lg",
			}),
			"rounded-full",
			className
		)}
		{onclick}
		{...rest}
	>
		{#if typeof children === "string"}
			{children}
		{:else}
			{@render children?.()}
		{/if}
	</button>
{:else if !content}
	<button
		type="button"
		data-slot="button"
		class={cn(
			buttonVariants({
				variant: variant || "ghost",
				size: size || "sm",
			}),
			"w-full cursor-pointer justify-start rounded-xl py-2",
			"hover:bg-accent",
			className
		)}
		{onclick}
		{...rest}
	>
		{#if typeof children === "string"}
			{children}
		{:else}
			{@render children?.()}
		{/if}
	</button>
{:else}
	<button
		type="button"
		data-slot="button"
		class={cn(
			buttonVariants({
				variant: variant || "ghost",
				size: size || "sm",
			}),
			"w-full cursor-pointer justify-start gap-0 rounded-xl py-2",
			"hover:bg-accent",
			className
		)}
		{onclick}
		{...rest}
	>
		{#if shouldHighlight && index !== -1}
			{#if before}
				<span class="text-muted-foreground whitespace-pre-wrap">{before}</span>
			{/if}
			<span class="text-primary font-medium whitespace-pre-wrap"
				>{actualHighlightedText}</span
			>
			{#if after}
				<span class="text-muted-foreground whitespace-pre-wrap">{after}</span>
			{/if}
		{:else}
			<span class="text-muted-foreground whitespace-pre-wrap">{content}</span>
		{/if}
	</button>
{/if}
