<script lang="ts">
	import type { Snippet } from "svelte";
	import { setReasoningContext } from "./reasoning-context.js";

	type Props = {
		children?: Snippet;
		class?: string;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		isStreaming?: boolean;
	};

	let {
		children,
		class: className,
		open = $bindable(),
		onOpenChange,
		isStreaming = false,
	}: Props = $props();

	// Default expanded (thinking stays open after stream ends).
	let internalOpen = $state(true);

	const isControlled = $derived(open !== undefined);
	const isOpen = $derived(isControlled ? (open as boolean) : internalOpen);

	function handleOpenChange(newOpen: boolean) {
		if (!isControlled) {
			internalOpen = newOpen;
		} else {
			open = newOpen;
		}
		onOpenChange?.(newOpen);
	}

	// Auto-open while streaming if the user had collapsed it (uncontrolled only).
	$effect(() => {
		if (isStreaming && !isControlled && !internalOpen) {
			internalOpen = true;
		}
	});

	setReasoningContext({
		get isOpen() {
			return isOpen;
		},
		onOpenChange: handleOpenChange,
	});
</script>

<div class={className}>
	{@render children?.()}
</div>
