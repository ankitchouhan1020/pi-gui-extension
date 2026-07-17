<script lang="ts">
	import { cn } from "$lib/utils";

	export type LoaderProps = {
		variant?:
			| "circular"
			| "classic"
			| "pulse"
			| "pulse-dot"
			| "dots"
			| "typing"
			| "wave"
			| "bars"
			| "terminal"
			| "text-blink"
			| "text-shimmer"
			| "loading-dots";
		size?: "sm" | "md" | "lg";
		text?: string;
		class?: string;
	};

	let {
		variant = "circular",
		size = "md",
		text,
		class: className,
	}: LoaderProps = $props();

	const sizeClasses = {
		sm: "size-4",
		md: "size-5",
		lg: "size-6",
	} as const;

	const barSizes = {
		sm: { height: "6px", width: "1.5px" },
		md: { height: "8px", width: "2px" },
		lg: { height: "10px", width: "2.5px" },
	} as const;

	const pulseDotSizes = {
		sm: "size-1",
		md: "size-2",
		lg: "size-3",
	} as const;

	const dotsDotSizes = {
		sm: "h-1.5 w-1.5",
		md: "h-2 w-2",
		lg: "h-2.5 w-2.5",
	} as const;

	const containerSizes = {
		sm: "h-4",
		md: "h-5",
		lg: "h-6",
	} as const;

	const typingDotSizes = {
		sm: "h-1 w-1",
		md: "h-1.5 w-1.5",
		lg: "h-2 w-2",
	} as const;

	const barWidthsWave = {
		sm: "w-0.5",
		md: "w-0.5",
		lg: "w-1",
	} as const;

	const heights = {
		sm: ["6px", "9px", "12px", "9px", "6px"],
		md: ["8px", "12px", "16px", "12px", "8px"],
		lg: ["10px", "15px", "20px", "15px", "10px"],
	} as const;

	const barWidthsBars = {
		sm: "w-1",
		md: "w-1.5",
		lg: "w-2",
	} as const;

	const barsContainerSizes = {
		sm: "h-4 gap-1",
		md: "h-5 gap-1.5",
		lg: "h-6 gap-2",
	} as const;

	const cursorSizes = {
		sm: "h-3 w-1.5",
		md: "h-4 w-2",
		lg: "h-5 w-2.5",
	} as const;

	const textSizes = {
		sm: "text-xs",
		md: "text-sm",
		lg: "text-base",
	} as const;

	const classicMargin = $derived(
		size === "sm" ? "-0.75px" : size === "lg" ? "-1.25px" : "-1px"
	);
	const classicOriginX = $derived(
		size === "sm" ? "0.75px" : size === "lg" ? "1.25px" : "1px"
	);
	const classicOriginY = $derived(
		size === "sm" ? "10px" : size === "lg" ? "14px" : "12px"
	);
</script>

{#if variant === "circular"}
	<div
		class={cn(
			"border-primary animate-spin rounded-full border-2 border-t-transparent",
			sizeClasses[size],
			className
		)}
	>
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "classic"}
	<div class={cn("relative", sizeClasses[size], className)}>
		<div class="absolute h-full w-full">
			{#each Array(12) as _, i}
				<div
					class="bg-primary absolute animate-[spinner-fade_1.2s_linear_infinite] rounded-full"
					style="top: 0; left: 50%; margin-left: {classicMargin}; transform-origin: {classicOriginX} {classicOriginY}; transform: rotate({i *
						30}deg); opacity: 0; animation-delay: {i *
						0.1}s; height: {barSizes[size].height}; width: {barSizes[size]
						.width};"
				></div>
			{/each}
		</div>
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "pulse"}
	<div class={cn("relative", sizeClasses[size], className)}>
		<div
			class="border-primary absolute inset-0 animate-[thin-pulse_1.5s_ease-in-out_infinite] rounded-full border-2"
		></div>
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "pulse-dot"}
	<div
		class={cn(
			"bg-primary animate-[pulse-dot_1.2s_ease-in-out_infinite] rounded-full",
			pulseDotSizes[size],
			className
		)}
	>
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "dots"}
	<div
		class={cn("flex items-center space-x-1", containerSizes[size], className)}
	>
		{#each Array(3) as _, i}
			<div
				class={cn(
					"bg-primary animate-[bounce-dots_1.4s_ease-in-out_infinite] rounded-full",
					dotsDotSizes[size]
				)}
				style="animation-delay: {i * 160}ms;"
			></div>
		{/each}
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "typing"}
	<div
		class={cn("flex items-center space-x-1", containerSizes[size], className)}
	>
		{#each Array(3) as _, i}
			<div
				class={cn(
					"bg-primary animate-[typing_1s_infinite] rounded-full",
					typingDotSizes[size]
				)}
				style="animation-delay: {i * 250}ms;"
			></div>
		{/each}
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "wave"}
	<div
		class={cn("flex items-center gap-0.5", containerSizes[size], className)}
	>
		{#each Array(5) as _, i}
			<div
				class={cn(
					"bg-primary animate-[wave_1s_ease-in-out_infinite] rounded-full",
					barWidthsWave[size]
				)}
				style="animation-delay: {i * 100}ms; height: {heights[size][i]};"
			></div>
		{/each}
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "bars"}
	<div class={cn("flex", barsContainerSizes[size], className)}>
		{#each Array(3) as _, i}
			<div
				class={cn(
					"bg-primary h-full animate-[wave-bars_1.2s_ease-in-out_infinite]",
					barWidthsBars[size]
				)}
				style="animation-delay: {i * 0.2}s;"
			></div>
		{/each}
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "terminal"}
	<div
		class={cn("flex items-center space-x-1", containerSizes[size], className)}
	>
		<span class={cn("text-primary font-mono", textSizes[size])}>{">"}</span>
		<div
			class={cn(
				"bg-primary animate-[blink_1s_step-end_infinite]",
				cursorSizes[size]
			)}
		></div>
		<span class="sr-only">Loading</span>
	</div>
{:else if variant === "text-blink"}
	<div
		class={cn(
			"animate-[text-blink_2s_ease-in-out_infinite] font-medium",
			textSizes[size],
			className
		)}
	>
		{text ?? "Thinking"}
	</div>
{:else if variant === "text-shimmer"}
	<div
		class={cn(
			"bg-[linear-gradient(to_right,var(--muted-foreground)_40%,var(--foreground)_60%,var(--muted-foreground)_80%)]",
			"bg-size-[200%_auto] bg-clip-text font-medium text-transparent",
			"animate-[shimmer_4s_infinite_linear]",
			textSizes[size],
			className
		)}
	>
		{text ?? "Thinking"}
	</div>
{:else if variant === "loading-dots"}
	<div class={cn("inline-flex items-center", className)}>
		<span class={cn("text-primary font-medium", textSizes[size])}
			>{text ?? "Thinking"}</span
		>
		<span class="inline-flex">
			<span class="text-primary animate-[loading-dots_1.4s_infinite_0.2s]"
				>.</span
			>
			<span class="text-primary animate-[loading-dots_1.4s_infinite_0.4s]"
				>.</span
			>
			<span class="text-primary animate-[loading-dots_1.4s_infinite_0.6s]"
				>.</span
			>
		</span>
	</div>
{:else}
	<div
		class={cn(
			"border-primary animate-spin rounded-full border-2 border-t-transparent",
			sizeClasses[size],
			className
		)}
	>
		<span class="sr-only">Loading</span>
	</div>
{/if}
