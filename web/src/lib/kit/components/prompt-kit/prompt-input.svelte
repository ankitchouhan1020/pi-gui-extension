<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { setPromptInputContext } from "./prompt-input-context.js";

	type Props = {
		isLoading?: boolean;
		value?: string;
		onValueChange?: (value: string) => void;
		maxHeight?: number | string;
		onSubmit?: () => void;
		children?: Snippet;
		class?: string;
		disabled?: boolean;
	};

	let {
		class: className,
		isLoading = false,
		maxHeight = 240,
		value = $bindable(),
		onValueChange,
		onSubmit,
		children,
		disabled = false,
	}: Props = $props();

	let internalValue = $state("");

	const currentValue = $derived(value ?? internalValue);

	function setValue(newValue: string) {
		internalValue = newValue;
		if (value !== undefined) {
			value = newValue;
		}
		onValueChange?.(newValue);
	}

	setPromptInputContext({
		get isLoading() {
			return isLoading;
		},
		get value() {
			return currentValue;
		},
		setValue,
		get maxHeight() {
			return maxHeight;
		},
		get onSubmit() {
			return onSubmit;
		},
		get disabled() {
			return disabled;
		},
	});
</script>

<div
	class={cn(
		"border-input bg-background rounded-3xl border p-3 shadow-xs",
		className
	)}
>
	{@render children?.()}
</div>
