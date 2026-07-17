<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { getFileUploadContext } from "./file-upload-context.js";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();

	const context = getFileUploadContext();
	let mounted = $state(false);
	let contentEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		mounted = true;
		return () => {
			mounted = false;
		};
	});

	const visible = $derived(
		!!context?.isDragging && mounted && !context?.disabled
	);

	// Match React createPortal(content, document.body) so overlay escapes stacking contexts.
	$effect(() => {
		const el = contentEl;
		if (!el || !visible) return;
		if (el.parentElement !== document.body) {
			document.body.appendChild(el);
		}
		return () => {
			el.remove();
		};
	});
</script>

{#if visible}
	<div
		bind:this={contentEl}
		class={cn(
			"bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm",
			"animate-in fade-in-0 slide-in-from-bottom-10 zoom-in-90 duration-150",
			className
		)}
		{...rest}
	>
		{@render children?.()}
	</div>
{/if}
