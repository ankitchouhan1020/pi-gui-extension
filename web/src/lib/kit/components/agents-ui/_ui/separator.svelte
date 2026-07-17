<script lang="ts">
	import { cn } from "$lib/utils.js";

	type Props = {
		class?: string;
		orientation?: "horizontal" | "vertical";
		decorative?: boolean;
	};

	let {
		class: className,
		orientation = "horizontal",
		decorative = true,
	}: Props = $props();
</script>

<div
	data-slot="separator-root"
	role={decorative ? "none" : "separator"}
	aria-orientation={orientation}
	class={cn(
		"bg-border shrink-0",
		orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
		className
	)}
></div>
