<script lang="ts">
	/**
	 * Fenced code renderer for markdown: Shiki + lang chip + copy.
	 * Drop-in for default `code` renderer (`lang`, `text`).
	 */
	import { getContext } from "svelte";
	import {
		escapeHtml,
		getShikiHighlighter,
		SHIKI_CONTEXT_KEY,
		type ShikiHighlighter,
	} from "@humanspeak/svelte-markdown/extensions/shiki";
	import Copy from "@lucide/svelte/icons/copy";
	import Check from "@lucide/svelte/icons/check";

	type Props = {
		lang: string;
		text: string;
		highlighter?: ShikiHighlighter;
	};

	let { lang, text, highlighter }: Props = $props();

	const contextHl = getContext<ShikiHighlighter | undefined>(SHIKI_CONTEXT_KEY);
	const resolved = $derived(highlighter ?? contextHl ?? getShikiHighlighter());

	const html = $derived(
		resolved
			? resolved.highlight(text, lang)
			: `<pre class="shiki-fallback"><code>${escapeHtml(text)}</code></pre>`,
	);

	const label = $derived((lang || "text").trim() || "text");
	let copied = $state(false);

	async function copy(e: MouseEvent) {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1200);
		} catch {
			/* ignore */
		}
	}
</script>

<div
	class="md-code group/mdcode relative my-2 min-w-0 max-w-full overflow-hidden rounded-lg border border-border/80 bg-muted/40"
	data-lang={label}
>
	<div
		class="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-2.5 py-1"
	>
		<span
			class="truncate font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
		>
			{label}
		</span>
		<button
			type="button"
			class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 group-hover/mdcode:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			title="Copy code"
			onclick={copy}
		>
			{#if copied}
				<Check class="size-3.5" />
			{:else}
				<Copy class="size-3.5" />
			{/if}
		</button>
	</div>
	<div class="md-code-body min-w-0 overflow-x-auto text-[12px] leading-relaxed">
		{@html html}
	</div>
</div>
