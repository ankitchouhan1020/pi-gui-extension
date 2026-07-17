<script lang="ts">
	/**
	 * Markdown — GFM via @humanspeak/svelte-markdown + Shiki + alerts + mermaid.
	 */
	import { setContext } from "svelte";
	import SvelteMarkdown from "@humanspeak/svelte-markdown";
	import type { Renderers } from "@humanspeak/svelte-markdown";
	import {
		AlertRenderer,
		markedAlert,
		MermaidRenderer,
		markedMermaid,
	} from "@humanspeak/svelte-markdown/extensions";
	import { SHIKI_CONTEXT_KEY } from "@humanspeak/svelte-markdown/extensions/shiki";
	import { cn } from "$lib/utils.js";
	import { mdHighlighter } from "./md-highlighter.js";
	import MdCode from "./md-code.svelte";

	type Props = {
		content?: string;
		children?: string;
		id?: string;
		class?: string;
		compact?: boolean;
		streaming?: boolean;
		streamId?: string | number;
	};

	let {
		content,
		children,
		id,
		class: className,
		compact = true,
		streaming = false,
		streamId,
	}: Props = $props();

	const source = $derived(
		typeof content === "string"
			? content
			: typeof children === "string"
				? children
				: "",
	);
	const blockId = $derived(id ?? "md");

	setContext(SHIKI_CONTEXT_KEY, mdHighlighter);

	const renderers: Partial<Renderers> & Record<string, unknown> = {
		code: MdCode as never,
		alert: AlertRenderer as never,
		mermaid: MermaidRenderer as never,
	};

	const extensions = [markedAlert(), markedMermaid()];

	const rootClass = $derived(
		cn(
			"md-root min-w-0 max-w-none break-words text-foreground",
			compact ? "text-[13px] leading-[1.55]" : "text-sm leading-relaxed",
			"[&>:first-child]:mt-0 [&>:last-child]:mb-0",
			"[&_p]:my-[0.45em] [&_p]:leading-[inherit]",
			"[&_ul]:my-[0.45em] [&_ul]:list-disc [&_ul]:pl-[1.25em]",
			"[&_ol]:my-[0.45em] [&_ol]:list-decimal [&_ol]:pl-[1.25em]",
			"[&_li]:my-[0.15em] [&_li]:leading-[inherit]",
			"[&_li>p]:my-0",
			"[&_strong]:font-semibold [&_em]:italic",
			"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary",
			"[&_blockquote]:my-[0.55em] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
			"[&_h1]:mb-[0.35em] [&_h1]:mt-[0.85em] [&_h1]:text-[1.15em] [&_h1]:font-semibold [&_h1]:leading-snug first:[&_h1]:mt-0",
			"[&_h2]:mb-[0.3em] [&_h2]:mt-[0.75em] [&_h2]:text-[1.08em] [&_h2]:font-semibold [&_h2]:leading-snug first:[&_h2]:mt-0",
			"[&_h3]:mb-[0.25em] [&_h3]:mt-[0.65em] [&_h3]:text-[1em] [&_h3]:font-semibold first:[&_h3]:mt-0",
			"[&_hr]:my-3 [&_hr]:border-border",
			"[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.92em]",
			"[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
			"[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
			"[&_:not(pre)>code]:rounded-[0.3rem] [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-muted/70 [&_:not(pre)>code]:px-[0.4em] [&_:not(pre)>code]:py-[0.12em] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-foreground",
			className,
		),
	);
</script>

<div class={rootClass} data-markdown={blockId}>
	{#if source.trim() || streaming}
		<SvelteMarkdown
			{source}
			{renderers}
			{extensions}
			{streaming}
			streamId={streamId}
			options={{ gfm: true, breaks: true }}
		/>
	{/if}
</div>

<style>
	:global(.md-root .shiki),
	:global(.md-root .shiki span) {
		color: var(--shiki-light);
		background-color: var(--shiki-light-bg);
	}
	:global(.dark .md-root .shiki),
	:global(.dark .md-root .shiki span) {
		color: var(--shiki-dark);
		background-color: var(--shiki-dark-bg);
	}

	:global(.md-root .md-code-body pre) {
		margin: 0;
		padding: 0.65rem 0.75rem;
		overflow-x: auto;
		background: transparent !important;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: inherit;
		line-height: inherit;
	}
	:global(.md-root .md-code-body pre code) {
		background: transparent;
		padding: 0;
		border: 0;
		font-size: inherit;
	}
	:global(.md-root .shiki-fallback) {
		color: var(--foreground, inherit);
		background: transparent;
	}

	/* GitHub alerts */
	:global(.md-root .markdown-alert) {
		margin: 0.55em 0;
		padding: 0.5em 0.75em;
		border-left: 3px solid var(--border);
		border-radius: 0.35rem;
		background: color-mix(in oklab, var(--muted) 55%, transparent);
	}
	:global(.md-root .markdown-alert-title) {
		margin: 0 0 0.2em;
		font-size: 0.78em;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	:global(.md-root .markdown-alert p) {
		margin: 0;
	}
	:global(.md-root .markdown-alert-note) {
		border-color: #2563eb;
	}
	:global(.md-root .markdown-alert-note .markdown-alert-title) {
		color: #2563eb;
	}
	:global(.md-root .markdown-alert-tip) {
		border-color: #16a34a;
	}
	:global(.md-root .markdown-alert-tip .markdown-alert-title) {
		color: #16a34a;
	}
	:global(.md-root .markdown-alert-important) {
		border-color: #9333ea;
	}
	:global(.md-root .markdown-alert-important .markdown-alert-title) {
		color: #9333ea;
	}
	:global(.md-root .markdown-alert-warning) {
		border-color: #d97706;
	}
	:global(.md-root .markdown-alert-warning .markdown-alert-title) {
		color: #d97706;
	}
	:global(.md-root .markdown-alert-caution) {
		border-color: #dc2626;
	}
	:global(.md-root .markdown-alert-caution .markdown-alert-title) {
		color: #dc2626;
	}

	:global(.md-root .mermaid-diagram) {
		margin: 0.55em 0;
		overflow-x: auto;
	}
	:global(.md-root .mermaid-diagram svg) {
		max-width: 100%;
		height: auto;
	}
	:global(.md-root .mermaid-loading),
	:global(.md-root .mermaid-error) {
		margin: 0.55em 0;
		font-size: 0.85em;
		color: var(--muted-foreground, inherit);
	}
	:global(.md-root .mermaid-error) {
		color: var(--destructive, #dc2626);
	}
</style>
