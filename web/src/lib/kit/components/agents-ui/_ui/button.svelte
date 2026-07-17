<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	type Size = "default" | "sm" | "lg" | "icon";

	type Props = HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	};

	let {
		class: className,
		variant = "default",
		size = "default",
		children,
		type = "button",
		...rest
	}: Props = $props();

	const variantClass: Record<Variant, string> = {
		default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
		destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
		outline:
			"border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
		secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		link: "text-primary underline-offset-4 hover:underline",
	};

	const sizeClass: Record<Size, string> = {
		default: "h-9 px-4 py-2 has-[>svg]:px-3",
		sm: "h-8 rounded-md px-3 has-[>svg]:px-2.5",
		lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
		icon: "size-9",
	};
</script>

<button
	data-slot="button"
	{type}
	class={cn(
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 focus-visible:ring-4 focus-visible:outline-1 aria-invalid:focus-visible:ring-0",
		variantClass[variant],
		sizeClass[size],
		className
	)}
	{...rest}
>
	{@render children?.()}
</button>
