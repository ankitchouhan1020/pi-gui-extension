<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { setStickToBottomContext } from "./stick-to-bottom-context.js";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();

	let rootEl = $state<HTMLDivElement | null>(null);
	let isAtBottom = $state(true);
	let wasAtBottom = true;

	const THRESHOLD = 40;

	function measureAtBottom() {
		const el = rootEl;
		if (!el) return true;
		return el.scrollHeight - el.scrollTop - el.clientHeight <= THRESHOLD;
	}

	function scrollToBottom(behavior: ScrollBehavior = "smooth") {
		const el = rootEl;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior });
		isAtBottom = true;
		wasAtBottom = true;
	}

	function onScroll() {
		isAtBottom = measureAtBottom();
		wasAtBottom = isAtBottom;
	}

	setStickToBottomContext({
		get isAtBottom() {
			return isAtBottom;
		},
		scrollToBottom,
	});

	$effect(() => {
		const el = rootEl;
		if (!el) return;

		const ro = new ResizeObserver(() => {
			if (wasAtBottom) {
				// initial="instant", resize="smooth"
				scrollToBottom("smooth");
			} else {
				isAtBottom = measureAtBottom();
			}
		});
		ro.observe(el);

		const mo = new MutationObserver(() => {
			if (wasAtBottom) {
				scrollToBottom("smooth");
			}
		});
		mo.observe(el, { childList: true, subtree: true, characterData: true });

		// initial instant stick
		scrollToBottom("instant" as ScrollBehavior);

		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	});
</script>

<div
	bind:this={rootEl}
	class={cn("flex overflow-y-auto", className)}
	role="log"
	onscroll={onScroll}
	{...rest}
>
	{@render children?.()}
</div>
