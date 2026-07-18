<script lang="ts">
	/**
	 * Message body.
	 * - `card` (default): soft bubble — use for **user** messages
	 * - `plain`: no background — use for **assistant** (screenshot style)
	 */
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";
	import Markdown from "./markdown.svelte";

	type Props = {
		children?: Snippet;
		content?: string;
		markdown?: boolean;
		/** card = user bubble; plain = agent text on canvas */
		variant?: "card" | "plain";
		class?: string;
		id?: string;
		streaming?: boolean;
		streamId?: string | number;
		/** Collapse long card content behind a show-more toggle. */
		showMoreLines?: number;
		[key: string]: unknown;
	};

	let {
		children,
		content,
		markdown = false,
		variant = "card",
		class: className,
		id,
		streaming = false,
		streamId,
		showMoreLines = 4,
		...rest
	}: Props = $props();

	const shellClass = $derived(
		cn(
			"min-w-0 w-full max-w-full break-words whitespace-normal text-[14px] leading-[1.6] text-foreground",
			variant === "card" &&
				"overflow-hidden rounded-lg border border-border/70 bg-white px-4 py-3 text-foreground shadow-[0_18px_34px_-20px_var(--pi-canvas)] dark:border-white/10 dark:bg-zinc-800",
			variant === "plain" && "bg-transparent p-0 shadow-none",
			className,
		),
	);

	const text = $derived(typeof content === "string" ? content : "");
	const lineCount = $derived(text ? text.split(/\r?\n/).length : 0);
	// ponytail: heuristic cutoff; switch to measured height if prompts need pixel-perfect truncation.
	const shouldCollapse = $derived(
		variant === "card" && Boolean(text.trim()) && (lineCount > showMoreLines || text.length > 700),
	);

	let expanded = $state(false);
	let seenText = $state("");

	$effect(() => {
		if (!shouldCollapse) {
			expanded = true;
			seenText = text;
			return;
		}

		if (text !== seenText) {
			seenText = text;
			expanded = false;
		}
	});
</script>

{#if markdown}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		<div class={shouldCollapse && !expanded ? "relative max-h-20 overflow-hidden rounded-[inherit]" : "relative"}>
			<Markdown
				{id}
				content={text}
				compact={true}
				class="text-inherit"
				{streaming}
				streamId={streamId ?? id}
			/>
		</div>
		{#if shouldCollapse}
			<button
				type="button"
				class="mt-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? "Show less" : "Show more"}
			</button>
		{/if}
	</div>
{:else if content !== undefined && content !== null}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		<div class={shouldCollapse && !expanded ? "relative max-h-20 overflow-hidden rounded-[inherit]" : "relative"}>
			{content}
		</div>
		{#if shouldCollapse}
			<button
				type="button"
				class="mt-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? "Show less" : "Show more"}
			</button>
		{/if}
	</div>
{:else}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		{@render children?.()}
	</div>
{/if}
