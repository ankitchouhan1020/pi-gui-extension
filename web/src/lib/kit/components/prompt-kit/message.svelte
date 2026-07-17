<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();
</script>

<div
	class={cn("flex w-full items-end gap-2.5", className)}
	data-slot="message"
	{...rest}
>
	{@render children?.()}
</div>
