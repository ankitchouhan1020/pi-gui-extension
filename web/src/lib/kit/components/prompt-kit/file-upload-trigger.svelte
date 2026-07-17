<script lang="ts">
	import type { Snippet } from "svelte";
	import { getFileUploadContext } from "./file-upload-context.js";

	type Props = {
		children?: Snippet;
		class?: string;
		asChild?: boolean;
		onclick?: (e: MouseEvent) => void;
		[key: string]: unknown;
	};

	let {
		children,
		class: className,
		asChild = false,
		onclick,
		...rest
	}: Props = $props();

	const context = getFileUploadContext();

	function handleClick(e: MouseEvent) {
		context?.openFileDialog();
		onclick?.(e);
	}
</script>

{#if asChild}
	<!-- Consumer wraps their own element; click on wrapper still opens dialog -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span
		role="button"
		tabindex="0"
		class={className}
		onclick={handleClick}
		onkeydown={(e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleClick(e as unknown as MouseEvent);
			}
		}}
		{...rest}
	>
		{@render children?.()}
	</span>
{:else}
	<button type="button" class={className} onclick={handleClick} {...rest}>
		{@render children?.()}
	</button>
{/if}
