<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		useTextStream,
		type Mode,
	} from "./use-text-stream.svelte.js";

	type Props = {
		textStream: string | AsyncIterable<string>;
		mode?: Mode;
		speed?: number;
		class?: string;
		onComplete?: () => void;
		as?: string;
		fadeDuration?: number;
		segmentDelay?: number;
		characterChunkSize?: number;
	};

	let {
		textStream,
		mode = "typewriter",
		speed = 20,
		class: className = "",
		onComplete,
		as = "div",
		fadeDuration,
		segmentDelay,
		characterChunkSize,
	}: Props = $props();

	const stream = useTextStream({
		getTextStream: () => textStream,
		getSpeed: () => speed,
		getMode: () => mode,
		getOnComplete: () => onComplete,
		getFadeDuration: () => fadeDuration,
		getSegmentDelay: () => segmentDelay,
		getCharacterChunkSize: () => characterChunkSize,
	});

	function handleLastSegmentAnimationEnd() {
		if (onComplete && stream.isComplete) {
			onComplete();
		}
	}

	const fadeStyle = $derived(`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .fade-segment {
      display: inline-block;
      opacity: 0;
      animation: fadeIn ${stream.getFadeDuration()}ms ease-out forwards;
    }

    .fade-segment-space {
      white-space: pre;
    }
  `);
</script>

{#if as === "span"}
	<span class={className}>
		{#if mode === "fade"}
			{@html `<style>${fadeStyle}</style>`}
			<span class="relative">
				{#each stream.segments as segment, idx (`${segment.text}-${idx}`)}
					{@const isWhitespace = /^\s+$/.test(segment.text)}
					{@const isLastSegment = idx === stream.segments.length - 1}
					<span
						class={cn(
							"fade-segment",
							isWhitespace && "fade-segment-space"
						)}
						style="animation-delay: {idx * stream.getSegmentDelay()}ms;"
						onanimationend={isLastSegment
							? handleLastSegmentAnimationEnd
							: undefined}
					>
						{segment.text}
					</span>
				{/each}
			</span>
		{:else}
			{stream.displayedText}
		{/if}
	</span>
{:else}
	<div class={className}>
		{#if mode === "fade"}
			{@html `<style>${fadeStyle}</style>`}
			<div class="relative">
				{#each stream.segments as segment, idx (`${segment.text}-${idx}`)}
					{@const isWhitespace = /^\s+$/.test(segment.text)}
					{@const isLastSegment = idx === stream.segments.length - 1}
					<span
						class={cn(
							"fade-segment",
							isWhitespace && "fade-segment-space"
						)}
						style="animation-delay: {idx * stream.getSegmentDelay()}ms;"
						onanimationend={isLastSegment
							? handleLastSegmentAnimationEnd
							: undefined}
					>
						{segment.text}
					</span>
				{/each}
			</div>
		{:else}
			{stream.displayedText}
		{/if}
	</div>
{/if}
