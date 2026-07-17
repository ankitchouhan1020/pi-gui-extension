<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { getReasoningContext } from "./reasoning-context.js";
	import Markdown from "./markdown.svelte";

	type Props = {
		children?: Snippet;
		content?: string;
		class?: string;
		markdown?: boolean;
		contentClassName?: string;
		streaming?: boolean;
		streamId?: string | number;
		[key: string]: unknown;
	};

	let {
		children,
		content,
		class: className,
		contentClassName,
		markdown = false,
		streaming = false,
		streamId,
		...rest
	}: Props = $props();

	const ctx = getReasoningContext();
	let contentEl = $state<HTMLDivElement | null>(null);
	let innerEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const outer = contentEl;
		const inner = innerEl;
		if (!outer || !inner) return;

		const observer = new ResizeObserver(() => {
			if (contentEl && innerEl && ctx.isOpen) {
				contentEl.style.maxHeight = `${innerEl.scrollHeight}px`;
			}
		});

		observer.observe(inner);

		if (ctx.isOpen) {
			outer.style.maxHeight = `${inner.scrollHeight}px`;
		} else {
			outer.style.maxHeight = "0px";
		}

		return () => observer.disconnect();
	});

	const text = $derived(content ?? "");
</script>

<div
	bind:this={contentEl}
	class={cn(
		"overflow-hidden transition-[max-height] duration-150 ease-out",
		className
	)}
	style="max-height: {ctx.isOpen
		? contentEl?.scrollHeight
			? `${contentEl.scrollHeight}px`
			: 'none'
		: '0px'};"
	{...rest}
>
	<div
		bind:this={innerEl}
		class={cn(
			"w-full min-w-0 max-w-none text-muted-foreground",
			// prose only for plain text — fights @humanspeak code/pre when markdown
			!markdown && "prose prose-sm dark:prose-invert",
			contentClassName
		)}
	>
		{#if markdown}
			<Markdown
				content={text}
				class="text-muted-foreground"
				{streaming}
				{streamId}
			/>
		{:else if content !== undefined}
			{content}
		{:else}
			{@render children?.()}
		{/if}
	</div>
</div>
