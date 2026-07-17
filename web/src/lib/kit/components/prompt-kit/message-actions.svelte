<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
		[key: string]: unknown;
	};

	let { children, class: className, ...rest }: Props = $props();
</script>

<div
	class={cn("text-muted-foreground flex items-center gap-2", className)}
	{...rest}
>
	{@render children?.()}
</div>
