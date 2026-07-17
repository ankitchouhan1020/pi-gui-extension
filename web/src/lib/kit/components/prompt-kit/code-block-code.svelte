<script lang="ts">
	import { cn } from "$lib/utils.js";

	type Props = {
		code: string;
		language?: string;
		theme?: string;
		class?: string;
		/** Tighter padding + lang chip for chat bubbles */
		compact?: boolean;
		[key: string]: unknown;
	};

	let {
		code,
		language = "tsx",
		theme = "github-light",
		class: className,
		compact = false,
		...rest
	}: Props = $props();

	const lang = $derived(language?.trim() || "text");
</script>

<div
	class={cn("flex w-full flex-col", className)}
	data-language={lang}
	data-theme={theme}
	data-slot="code-block-code"
	{...rest}
>
	{#if lang && lang !== "text" && lang !== "plaintext"}
		<div
			class={cn(
				"flex items-center border-b border-border/60 bg-muted/40",
				compact ? "px-2.5 py-1" : "px-3 py-1.5",
			)}
		>
			<span
				class="font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
			>
				{lang}
			</span>
		</div>
	{/if}
	<pre
		class={cn(
			"m-0 overflow-x-auto font-mono leading-relaxed text-foreground/90",
			compact
				? "px-2.5 py-2 text-[11.5px]"
				: "px-4 py-3.5 text-[13px]",
		)}><code class="bg-transparent p-0 text-inherit">{code}</code></pre>
</div>
