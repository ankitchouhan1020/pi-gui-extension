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

	let internalOpen = $state(false);
	let wasAutoOpened = $state(false);

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

	// Auto-open while streaming (uncontrolled only — matches React; controlled uses open prop).
	$effect(() => {
		if (isStreaming && !wasAutoOpened) {
			if (!isControlled) {
				internalOpen = true;
			}
			wasAutoOpened = true;
		}

		if (!isStreaming && wasAutoOpened) {
			if (!isControlled) {
				internalOpen = false;
			}
			wasAutoOpened = false;
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
