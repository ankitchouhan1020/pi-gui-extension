<script lang="ts">
	import { Tooltip } from "bits-ui";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { getPromptInputContext } from "./prompt-input-context.js";

	type Props = {
		class?: string;
		tooltip: string | Snippet;
		children?: Snippet;
		side?: "top" | "bottom" | "left" | "right";
	};

	let {
		tooltip,
		children,
		class: className,
		side = "top",
	}: Props = $props();

	const ctx = getPromptInputContext();
</script>

<Tooltip.Provider delayDuration={0}>
	<Tooltip.Root disabled={ctx.disabled}>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span {...props} class="inline-flex shrink-0 items-center leading-none">
					{@render children?.()}
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content
				{side}
				sideOffset={4}
				class={cn(
					"bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-w-sm rounded-md px-3 py-1.5 text-xs",
					className
				)}
			>
				{#if typeof tooltip === "string"}
					{tooltip}
				{:else}
					{@render tooltip()}
				{/if}
				<Tooltip.Arrow
					class="fill-gray-900 dark:fill-gray-50 z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]"
				/>
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>
