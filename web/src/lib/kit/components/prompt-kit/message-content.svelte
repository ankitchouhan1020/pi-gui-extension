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
		...rest
	}: Props = $props();

	const shellClass = $derived(
		cn(
			"min-w-0 max-w-full break-words whitespace-normal text-[13px] leading-relaxed text-foreground",
			variant === "card" &&
				"rounded-2xl border border-black/[0.06] bg-white px-4 py-2.5 text-foreground shadow-sm dark:border-white/10 dark:bg-zinc-800",
			variant === "plain" && "bg-transparent p-0 shadow-none",
			className,
		),
	);

	const text = $derived(typeof content === "string" ? content : "");
</script>

{#if markdown}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		<Markdown
			{id}
			content={text}
			compact={true}
			class="text-inherit"
			{streaming}
			streamId={streamId ?? id}
		/>
	</div>
{:else if content !== undefined && content !== null}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		{content}
	</div>
{:else}
	<div class={shellClass} data-slot="message-content" data-variant={variant} {...rest}>
		{@render children?.()}
	</div>
{/if}
