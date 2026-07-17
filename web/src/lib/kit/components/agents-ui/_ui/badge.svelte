<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type Variant = "default" | "secondary" | "destructive" | "outline";

	type Props = HTMLAttributes<HTMLDivElement> & {
		variant?: Variant;
		class?: string;
		children?: Snippet;
	};

	let { class: className, variant = "default", children, ...rest }: Props = $props();

	const variantClass: Record<Variant, string> = {
		default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
		secondary:
			"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
		destructive:
			"border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
		outline: "text-foreground",
	};
</script>

<div
	class={cn(
		"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variantClass[variant],
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
