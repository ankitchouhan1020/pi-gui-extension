<script lang="ts" module>
	import type { Component } from "svelte";
	import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import Pause from "@lucide/svelte/icons/pause";

	export type ParallelLaneStatus = "waiting" | "processing" | "done" | "error";

	export interface ParallelLane {
		id: string;
		label: string;
		agentName: string;
		status: ParallelLaneStatus;
		progress: number;
		output?: string;
		tokens?: number;
	}

	export interface AgentParallelProcessorProps {
		taskDescription?: string;
		lanes?: ParallelLane[];
		mergeStatus?: "idle" | "merging" | "complete";
		mergedOutput?: string;
		totalTokens?: number;
		totalCost?: string;
		onStartAll?: () => void;
		onCancelAll?: () => void;
		onRetryFailed?: () => void;
		onRetryLane?: (laneId: string) => void;
		class?: string;
	}

	const LANE_COLORS = [
		{
			accent: "border-l-sky-500",
			ring: "#0ea5e9",
			bg: "bg-sky-50/60 dark:bg-sky-950/20",
			glow: "shadow-sm",
			badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
			dot: "bg-sky-500",
		},
		{
			accent: "border-l-amber-500",
			ring: "#f59e0b",
			bg: "bg-amber-50/60 dark:bg-amber-950/20",
			glow: "shadow-sm",
			badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
			dot: "bg-amber-500",
		},
		{
			accent: "border-l-rose-500",
			ring: "#f43f5e",
			bg: "bg-rose-50/60 dark:bg-rose-950/20",
			glow: "shadow-sm",
			badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
			dot: "bg-rose-500",
		},
		{
			accent: "border-l-cyan-500",
			ring: "#06b6d4",
			bg: "bg-cyan-50/60 dark:bg-cyan-950/20",
			glow: "shadow-sm",
			badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
			dot: "bg-cyan-500",
		},
		{
			accent: "border-l-emerald-500",
			ring: "#10b981",
			bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
			glow: "shadow-sm",
			badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
			dot: "bg-emerald-500",
		},
		{
			accent: "border-l-slate-500",
			ring: "#64748b",
			bg: "bg-slate-50/60 dark:bg-slate-950/20",
			glow: "shadow-sm",
			badge: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
			dot: "bg-slate-500",
		},
	];

	const laneStatusConfig: Record<
		ParallelLaneStatus,
		{ label: string; icon: Component; className: string }
	> = {
		waiting: {
			label: "Queued",
			icon: Pause,
			className:
				"bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700",
		},
		processing: {
			label: "Running",
			icon: Loader2,
			className:
				"bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
		},
		done: {
			label: "Complete",
			icon: CheckCircle2,
			className:
				"bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
		},
		error: {
			label: "Failed",
			icon: AlertTriangle,
			className:
				"bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
		},
	};

	const defaultLanes: ParallelLane[] = [
		{
			id: "lane-1",
			label: "Sentiment Analysis",
			agentName: "Agent Lyra",
			status: "done",
			progress: 100,
			output:
				"Overall positive (0.82). Key phrases: 'excellent quality', 'fast shipping'.",
			tokens: 1240,
		},
		{
			id: "lane-2",
			label: "Entity Extraction",
			agentName: "Agent Orion",
			status: "processing",
			progress: 64,
			tokens: 860,
		},
		{
			id: "lane-3",
			label: "Topic Classification",
			agentName: "Agent Nova",
			status: "processing",
			progress: 38,
			tokens: 520,
		},
		{
			id: "lane-4",
			label: "Summary Generation",
			agentName: "Agent Vega",
			status: "waiting",
			progress: 0,
			tokens: 0,
		},
	];
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, Tooltip } from "./_ui/index.js";
	import Bot from "@lucide/svelte/icons/bot";
	import CircleDot from "@lucide/svelte/icons/circle-dot";
	import Coins from "@lucide/svelte/icons/coins";
	import GitFork from "@lucide/svelte/icons/git-fork";
	import GitMerge from "@lucide/svelte/icons/git-merge";
	import Play from "@lucide/svelte/icons/play";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import XCircle from "@lucide/svelte/icons/x-circle";
	import Zap from "@lucide/svelte/icons/zap";

	let {
		taskDescription,
		lanes,
		mergeStatus = "idle",
		mergedOutput,
		totalTokens,
		totalCost,
		onStartAll,
		onCancelAll,
		onRetryFailed,
		onRetryLane,
		class: className,
	}: AgentParallelProcessorProps = $props();

	const displayTask = $derived(
		taskDescription ??
			"Analyze 2,400 product reviews from Q4 launch and generate a structured report with sentiment, entities, topics, and an executive summary."
	);
	const displayLanes = $derived(lanes && lanes.length > 0 ? lanes : defaultLanes);
	const doneCount = $derived(displayLanes.filter((l) => l.status === "done").length);
	const errorCount = $derived(displayLanes.filter((l) => l.status === "error").length);
	const overallProgress = $derived(
		displayLanes.length > 0
			? Math.round(displayLanes.reduce((sum, l) => sum + l.progress, 0) / displayLanes.length)
			: 0
	);
	const computedTokens = $derived(
		totalTokens ?? displayLanes.reduce((sum, l) => sum + (l.tokens ?? 0), 0)
	);
	const computedCost = $derived(totalCost ?? `$${(computedTokens * 0.00015).toFixed(2)}`);
	const activeLaneColors = $derived(
		displayLanes.map((_, i) => LANE_COLORS[i % LANE_COLORS.length])
	);
	const laneSpacing = $derived(100 / (displayLanes.length + 1));
</script>

{#snippet ringProgress(progress: number, color: string, size?: number, strokeWidth?: number)}
	{@const s = size ?? 40}
	{@const sw = strokeWidth ?? 3.5}
	{@const radius = (s - sw) / 2}
	{@const circumference = 2 * Math.PI * radius}
	{@const offset = circumference - (progress / 100) * circumference}
	<svg width={s} height={s} class="shrink-0 -rotate-90">
		<circle
			cx={s / 2}
			cy={s / 2}
			r={radius}
			fill="none"
			stroke="currentColor"
			stroke-width={sw}
			class="text-zinc-200 dark:text-zinc-700"
		/>
		<circle
			cx={s / 2}
			cy={s / 2}
			r={radius}
			fill="none"
			stroke={color}
			stroke-width={sw}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			class="transition-all duration-700 ease-out"
		/>
		<text
			x={s / 2}
			y={s / 2}
			text-anchor="middle"
			dominant-baseline="central"
			class="fill-foreground rotate-90 origin-center"
			style="font-size: {s * 0.26}px; font-weight: 600"
		>
			{progress}%
		</text>
	</svg>
{/snippet}

<div class={cn("w-full space-y-5 p-4", className)}>
	<!-- ── Header bar ─────────────────────────────────────── -->
	<div
		class="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 via-white to-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-900 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
			>
				<GitFork class="h-4.5 w-4.5" />
			</div>
			<div>
				<p class="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
					Fan-out / Fan-in
				</p>
				<h2 class="text-lg font-bold tracking-tight">Parallel Processor</h2>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Button
				size="sm"
				class="h-8 gap-1.5 rounded-lg bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
				onclick={onStartAll}
			>
				<Play class="h-3.5 w-3.5" />
				Start all
			</Button>
			<Button size="sm" variant="outline" class="h-8 gap-1.5 rounded-lg" onclick={onCancelAll}>
				<XCircle class="h-3.5 w-3.5" />
				Cancel
			</Button>
			{#if errorCount > 0}
				<Button size="sm" variant="secondary" class="h-8 gap-1.5 rounded-lg" onclick={onRetryFailed}>
					<RefreshCw class="h-3.5 w-3.5" />
					Retry failed
				</Button>
			{/if}
		</div>
	</div>

	<!-- ── Pipeline visualization ─────────────────────────── -->
	<div class="relative">
		<!-- SVG connection lines - only visible on md+ -->
		<div class="hidden md:block">
			<svg
				class="absolute inset-0 w-full h-full pointer-events-none"
				preserveAspectRatio="none"
				viewBox="0 0 100 100"
				aria-hidden="true"
			>
				<defs>
					{#each activeLaneColors as colorSet, i (i)}
						<linearGradient id="lane-grad-{i}" x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset="0%" stop-color={colorSet.ring} stop-opacity={0.3} />
							<stop offset="50%" stop-color={colorSet.ring} stop-opacity={0.5} />
							<stop offset="100%" stop-color={colorSet.ring} stop-opacity={0.3} />
						</linearGradient>
					{/each}
				</defs>
				<!-- Fan-out lines: left column (18%) → center lanes -->
				{#each displayLanes as _, i (i)}
					{@const yEnd = laneSpacing * (i + 1)}
					<path
						d="M 18 50 C 28 50, 30 {yEnd}, 38 {yEnd}"
						fill="none"
						stroke="url(#lane-grad-{i})"
						stroke-width={0.6}
						stroke-dasharray="2 1.5"
						opacity={0.6}
					/>
				{/each}
				<!-- Fan-in lines: center lanes → right column (82%) -->
				{#each displayLanes as _, i (i)}
					{@const yStart = laneSpacing * (i + 1)}
					<path
						d="M 62 {yStart} C 72 {yStart}, 74 50, 82 50"
						fill="none"
						stroke="url(#lane-grad-{i})"
						stroke-width={0.6}
						stroke-dasharray="2 1.5"
						opacity={0.6}
					/>
				{/each}
			</svg>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr_1fr] md:gap-0">
			<!-- ── LEFT: Input card ──────────────────────────── -->
			<div class="flex items-center justify-center md:pr-6 md:relative md:z-10">
				<div
					class="w-full rounded-xl border-l-4 border-l-transparent bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm"
					style="border-left-color: rgb(99 102 241)"
				>
					<div
						class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400"
					>
						<CircleDot class="h-3 w-3" />
						Input Task
					</div>
					<p class="mt-2.5 text-sm leading-relaxed text-foreground/90">
						{displayTask}
					</p>
					<div class="mt-3 flex items-center gap-1.5">
						<Badge
							class="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
						>
							<Zap class="mr-1 h-2.5 w-2.5" />
							{displayLanes.length} lanes
						</Badge>
					</div>

					<!-- Arrow indicator for mobile -->
					<div class="mt-3 flex justify-center text-muted-foreground md:hidden">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 5v14M19 12l-7 7-7-7" />
						</svg>
					</div>
				</div>
			</div>

			<!-- ── CENTER: Parallel lanes ────────────────────── -->
			<div class="space-y-3 md:px-2 md:relative md:z-10">
				{#each displayLanes as lane, index (lane.id)}
					{@const config = laneStatusConfig[lane.status]}
					{@const StatusIcon = config.icon}
					{@const colorSet = activeLaneColors[index]}
					{@const isActive = lane.status === "processing"}
					{@const laneTokenCost =
						lane.tokens != null ? `$${(lane.tokens * 0.00015).toFixed(3)}` : null}

					<div
						class={cn(
							"relative rounded-xl border border-zinc-200 p-3.5 shadow-sm transition-all duration-300 dark:border-zinc-800",
							colorSet.bg,
							"border-l-[3.5px]",
							colorSet.accent,
							isActive && "shadow-md animate-pulse"
						)}
						style={isActive ? "animation-duration: 2.5s" : undefined}
					>
						<div class="flex items-start gap-3">
							<!-- Ring progress -->
							{@render ringProgress(lane.progress, colorSet.ring, 44, 3.5)}

							<!-- Lane content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<h3 class="truncate text-sm font-semibold text-foreground">
										{lane.label}
									</h3>
									<Badge
										class={cn(
											"flex shrink-0 items-center gap-1 text-[10px]",
											config.className
										)}
									>
										<StatusIcon
											class={cn("h-2.5 w-2.5", isActive && "animate-spin")}
										/>
										{config.label}
									</Badge>
								</div>

								<div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
									<Bot class="h-3 w-3" />
									<span>{lane.agentName}</span>
								</div>

								{#if lane.status === "done" && lane.output}
									<p
										class="mt-2 rounded-md border border-dashed border-emerald-300/60 bg-emerald-50/50 p-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-2 dark:border-emerald-800/40 dark:bg-emerald-950/20"
									>
										{lane.output}
									</p>
								{/if}

								{#if lane.status === "error"}
									<div class="mt-2">
										<Tooltip content="Re-run this lane from the beginning">
											<Button
												size="sm"
												variant="outline"
												class="h-6 gap-1 rounded-md border-red-200 px-2 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
												onclick={() => onRetryLane?.(lane.id)}
											>
												<RefreshCw class="h-2.5 w-2.5" />
												Retry lane
											</Button>
										</Tooltip>
									</div>
								{/if}
							</div>
						</div>

						<!-- Floating metric badges -->
						{#if lane.tokens != null && lane.tokens > 0}
							<div class="absolute -right-1 -top-2 flex gap-1">
								<span
									class={cn(
										"inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shadow-sm border",
										colorSet.badge
									)}
								>
									{lane.tokens.toLocaleString()} tok
								</span>
								{#if laneTokenCost}
									<span
										class="inline-flex items-center rounded-full border bg-white px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700"
									>
										{laneTokenCost}
									</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- ── RIGHT: Merge / fan-in card ────────────────── -->
			<div class="flex items-center justify-center md:pl-6 md:relative md:z-10">
				<div class="flex flex-col items-center w-full">
					<!-- Arrow indicator for mobile -->
					<div class="mb-3 flex justify-center text-muted-foreground md:hidden">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 5v14M19 12l-7 7-7-7" />
						</svg>
					</div>

					<div
						class="w-full rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-800/30 dark:bg-emerald-950/20"
					>
						<div class="flex items-center gap-2">
							<div
								class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm"
							>
								<GitMerge class="h-3.5 w-3.5" />
							</div>
							<div>
								<p
									class="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
								>
									Merge
								</p>
							</div>
						</div>

						<!-- Progress ring for overall -->
						<div class="mt-3 flex items-center justify-center">
							{@render ringProgress(overallProgress, "#10b981", 56, 4)}
						</div>

						<div class="mt-3 flex flex-wrap justify-center gap-1.5">
							<Badge
								class="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
							>
								<CheckCircle2 class="mr-0.5 h-2.5 w-2.5" />
								{doneCount}/{displayLanes.length}
							</Badge>
							<Badge
								class="border bg-white text-zinc-600 text-[10px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700"
							>
								<Coins class="mr-0.5 h-2.5 w-2.5" />
								{computedTokens.toLocaleString()}
							</Badge>
						</div>

						<p class="mt-2 text-center text-[10px] font-medium text-muted-foreground">
							{computedCost}
						</p>

						<!-- Merge result content -->
						<div class="mt-3">
							{#if mergeStatus === "complete" && mergedOutput}
								<div
									class="rounded-lg border border-dashed border-emerald-300/70 bg-white/60 p-2.5 dark:border-emerald-800/40 dark:bg-zinc-900/40"
								>
									<p
										class="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
									>
										Result
									</p>
									<p class="mt-1 text-xs leading-relaxed text-foreground/80">
										{mergedOutput}
									</p>
								</div>
							{:else if mergeStatus === "merging"}
								<div
									class="flex items-center justify-center gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground"
								>
									<Loader2 class="h-3.5 w-3.5 animate-spin text-emerald-600" />
									<span>Merging...</span>
								</div>
							{:else}
								<p
									class="rounded-lg border border-dashed p-2.5 text-center text-[11px] text-muted-foreground"
								>
									Awaiting lane completion
								</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
