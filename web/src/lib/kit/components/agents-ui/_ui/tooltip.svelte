<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	type Props = {
		content: string;
		side?: "top" | "right" | "bottom" | "left";
		class?: string;
		children: Snippet;
	};

	let {
		content,
		side = "top",
		class: className,
		children,
	}: Props = $props();
</script>

<TooltipPrimitive.Provider delayDuration={0}>
	<TooltipPrimitive.Root>
		<TooltipPrimitive.Trigger>
			{#snippet child({ props })}
				<span {...props} class="inline-flex">
					{@render children()}
				</span>
			{/snippet}
		</TooltipPrimitive.Trigger>
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				{side}
				sideOffset={4}
				class={cn(
					"bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900 z-50 max-w-sm rounded-md px-3 py-1.5 text-xs",
					className
				)}
			>
				{content}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	</TooltipPrimitive.Root>
</TooltipPrimitive.Provider>
