<script lang="ts" module>
	import type { Component } from "svelte";
	import Check from "@lucide/svelte/icons/check";
	import Clock from "@lucide/svelte/icons/clock";
	import FastForward from "@lucide/svelte/icons/fast-forward";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import X from "@lucide/svelte/icons/x";

	export type WorkflowStepStatus = "waiting" | "running" | "completed" | "failed" | "skipped";

	export interface WorkflowStep {
		id: string;
		number: number;
		title: string;
		agentName: string;
		inputSummary: string;
		outputSummary: string;
		status: WorkflowStepStatus;
		duration?: string;
		tokens?: number;
	}

	export interface AgentSequentialWorkflowProps {
		workflowName?: string;
		description?: string;
		steps?: WorkflowStep[];
		currentStepId?: string;
		totalDuration?: string;
		totalTokens?: number;
		isRunning?: boolean;
		onStart?: () => void;
		onPause?: () => void;
		onRetryStep?: (stepId: string) => void;
		onSkipStep?: (stepId: string) => void;
		onReset?: () => void;
		class?: string;
	}

	const defaultSteps: WorkflowStep[] = [
		{
			id: "s1",
			number: 1,
			title: "Research",
			agentName: "Research Agent",
			inputSummary: "Topic: AI trends 2026",
			outputSummary: "12 sources, 3,200-word brief",
			status: "completed",
			duration: "1m 42s",
			tokens: 4820,
		},
		{
			id: "s2",
			number: 2,
			title: "Draft",
			agentName: "Writer Agent",
			inputSummary: "Research brief (3,200 words)",
			outputSummary: "1,800-word blog draft",
			status: "completed",
			duration: "2m 18s",
			tokens: 6140,
		},
		{
			id: "s3",
			number: 3,
			title: "Edit",
			agentName: "Editor Agent",
			inputSummary: "Blog draft (1,800 words)",
			outputSummary: "",
			status: "running",
			tokens: 2300,
		},
		{
			id: "s4",
			number: 4,
			title: "SEO Optimize",
			agentName: "SEO Agent",
			inputSummary: "Edited draft",
			outputSummary: "",
			status: "waiting",
		},
		{
			id: "s5",
			number: 5,
			title: "Publish",
			agentName: "Publisher Agent",
			inputSummary: "SEO-optimized article",
			outputSummary: "",
			status: "waiting",
		},
	];

	const statusConfig: Record<
		WorkflowStepStatus,
		{ label: string; badge: string; icon: Component }
	> = {
		waiting: {
			label: "Waiting",
			badge:
				"bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700",
			icon: Clock,
		},
		running: {
			label: "Running",
			badge:
				"bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
			icon: Loader2,
		},
		completed: {
			label: "Done",
			badge:
				"bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
			icon: Check,
		},
		failed: {
			label: "Failed",
			badge:
				"bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
			icon: X,
		},
		skipped: {
			label: "Skipped",
			badge:
				"bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
			icon: FastForward,
		},
	};

	function segmentColor(fromStatus: WorkflowStepStatus, toStatus: WorkflowStepStatus): string {
		if (fromStatus === "completed" && toStatus === "completed") return "#10b981";
		if (fromStatus === "completed" && toStatus === "running") return "#3b82f6";
		return "#d1d5db";
	}

	function segmentColorDark(fromStatus: WorkflowStepStatus, toStatus: WorkflowStepStatus): string {
		if (fromStatus === "completed" && toStatus === "completed") return "#34d399";
		if (fromStatus === "completed" && toStatus === "running") return "#60a5fa";
		return "#4b5563";
	}
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, ScrollArea, Tooltip } from "./_ui/index.js";
	import Cpu from "@lucide/svelte/icons/cpu";
	import Pause from "@lucide/svelte/icons/pause";
	import Play from "@lucide/svelte/icons/play";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Train from "@lucide/svelte/icons/train";
	import Zap from "@lucide/svelte/icons/zap";

	let {
		workflowName = "Content Publishing Pipeline",
		description = "Sequential agent chain where each step feeds into the next.",
		steps,
		currentStepId = "s3",
		totalDuration = "4m 00s",
		totalTokens = 13260,
		isRunning = true,
		onStart,
		onPause,
		onRetryStep,
		onSkipStep,
		onReset,
		class: className,
	}: AgentSequentialWorkflowProps = $props();

	let selectedStepId = $state<string | null>(null);

	const displaySteps = $derived(steps && steps.length > 0 ? steps : defaultSteps);
	const completedCount = $derived(displaySteps.filter((s) => s.status === "completed").length);
	const runningCount = $derived(displaySteps.filter((s) => s.status === "running").length);
	const failedCount = $derived(displaySteps.filter((s) => s.status === "failed").length);
	const progressPercent = $derived(
		Math.round(((completedCount + runningCount * 0.5) / displaySteps.length) * 100)
	);
	const activeDetailId = $derived(selectedStepId ?? currentStepId);

	const stationWidth = 180;
	const gap = 80;
	const nodeAreaWidth = $derived(
		displaySteps.length * stationWidth + (displaySteps.length - 1) * gap
	);

	const avgTokens = $derived.by(() => {
		const stepsWithTokens = displaySteps.filter((s) => s.tokens != null);
		if (stepsWithTokens.length === 0) return 0;
		return Math.round(
			stepsWithTokens.reduce((sum, s) => sum + (s.tokens ?? 0), 0) / stepsWithTokens.length
		);
	});

	function toggleSelected(stepId: string) {
		selectedStepId = stepId === selectedStepId ? null : stepId;
	}
</script>

{#snippet stationNode(status: WorkflowStepStatus)}
	{@const size = status === "running" ? 40 : 28}
	{@const half = size / 2}
	{#if status === "completed"}
		<div class="relative shrink-0" style="width: {size}px; height: {size}px">
			<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0">
				<circle
					cx={half}
					cy={half}
					r={half - 2}
					fill="#10b981"
					stroke="#059669"
					stroke-width={2}
				/>
			</svg>
			<Check
				size={12}
				class="pointer-events-none absolute text-white"
				style="left: {half - 6}px; top: {half - 6}px"
			/>
		</div>
	{:else if status === "running"}
		<div class="relative shrink-0" style="width: {size}px; height: {size}px">
			<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0">
				<!-- outer pulse ring -->
				<circle
					cx={half}
					cy={half}
					r={half - 2}
					fill="none"
					stroke="#3b82f6"
					stroke-width={2}
					opacity={0.4}
				>
					<animate
						attributeName="r"
						from={String(half - 6)}
						to={String(half - 2)}
						dur="1.5s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						from="0.6"
						to="0"
						dur="1.5s"
						repeatCount="indefinite"
					/>
				</circle>
				<!-- solid inner -->
				<circle
					cx={half}
					cy={half}
					r={half - 6}
					fill="#3b82f6"
					stroke="#2563eb"
					stroke-width={2}
				/>
			</svg>
			<Loader2
				size={14}
				class="pointer-events-none absolute animate-spin text-white"
				style="left: {half - 7}px; top: {half - 7}px"
			/>
		</div>
	{:else if status === "failed"}
		<div class="relative shrink-0" style="width: {size}px; height: {size}px">
			<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0">
				<circle
					cx={half}
					cy={half}
					r={half - 2}
					fill="#ef4444"
					stroke="#dc2626"
					stroke-width={2}
				/>
			</svg>
			<X
				size={12}
				class="pointer-events-none absolute text-white"
				style="left: {half - 6}px; top: {half - 6}px"
			/>
		</div>
	{:else if status === "skipped"}
		<div class="relative shrink-0" style="width: {size}px; height: {size}px">
			<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0">
				<circle
					cx={half}
					cy={half}
					r={half - 3}
					fill="none"
					stroke="#9ca3af"
					stroke-width={2}
					stroke-dasharray="4 3"
				/>
			</svg>
			<FastForward
				size={12}
				class="pointer-events-none absolute text-gray-400"
				style="left: {half - 6}px; top: {half - 6}px"
			/>
		</div>
	{:else}
		<!-- waiting -->
		<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0">
			<circle
				cx={half}
				cy={half}
				r={half - 3}
				fill="none"
				stroke="#d1d5db"
				stroke-width={2}
				class="dark:stroke-slate-600"
			/>
			<circle cx={half} cy={half} r={3} fill="#d1d5db" class="dark:fill-slate-600" />
		</svg>
	{/if}
{/snippet}

<div
	class={cn(
		"w-full space-y-0 overflow-hidden rounded-2xl border bg-background shadow-lg",
		className
	)}
>
	<!-- ── Gradient progress bar at top ── -->
	<div class="relative h-1.5 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
		<div
			class="h-full transition-all duration-700 ease-out"
			style="width: {progressPercent}%; background: #3b82f6"
		></div>
		{#if isRunning}
			<div
				class="absolute top-0 h-full w-24 animate-[shimmer_2s_infinite]"
				style="left: {progressPercent - 4}%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
			></div>
		{/if}
	</div>

	<!-- ── Header ── -->
	<div
		class="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
			>
				<Train class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-lg font-semibold tracking-tight">{workflowName}</h2>
				<p class="text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Badge variant="outline" class="gap-1 font-mono text-xs tabular-nums">
				<Clock class="h-3 w-3" />
				{totalDuration}
			</Badge>
			<Badge variant="outline" class="gap-1 font-mono text-xs tabular-nums">
				<Zap class="h-3 w-3" />
				{totalTokens.toLocaleString()} tok
			</Badge>
			<Badge
				class={cn(
					"gap-1 text-xs",
					isRunning
						? "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800"
						: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
				)}
			>
				<span
					class={cn(
						"inline-block h-1.5 w-1.5 rounded-full",
						isRunning ? "bg-blue-500 animate-pulse" : "bg-slate-400"
					)}
				></span>
				{isRunning ? "Running" : "Idle"}
			</Badge>
			<div class="flex items-center gap-1 ml-1">
				{#if isRunning}
					<Button size="sm" variant="secondary" class="h-8 gap-1" onclick={onPause}>
						<Pause class="h-3.5 w-3.5" /> Pause
					</Button>
				{:else}
					<Button
						size="sm"
						class="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
						onclick={onStart}
					>
						<Play class="h-3.5 w-3.5" /> Start
					</Button>
				{/if}
				<Tooltip content="Reset pipeline">
					<Button size="sm" variant="ghost" class="h-8 w-8 p-0" onclick={onReset}>
						<RefreshCw class="h-3.5 w-3.5" />
					</Button>
				</Tooltip>
			</div>
		</div>
	</div>

	<!-- ── Metro map ── -->
	<div class="px-5 pt-6 pb-2">
		<ScrollArea class="w-full" orientation="horizontal">
			<div class="relative" style="min-width: {nodeAreaWidth}px; height: 280px">
				<!-- --- SVG rail lines + arrows --- -->
				<svg
					class="absolute inset-0 pointer-events-none"
					width={nodeAreaWidth}
					height={280}
					viewBox="0 0 {nodeAreaWidth} 280"
				>
					<defs>
						<!-- Glow filter for active segments -->
						<filter id="rail-glow">
							<feGaussianBlur stdDeviation="3" result="blur" />
							<feMerge>
								<feMergeNode in="blur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
						<!-- Arrow marker -->
						<marker
							id="flow-arrow-green"
							markerWidth="8"
							markerHeight="6"
							refX="8"
							refY="3"
							orient="auto"
						>
							<path d="M0,0 L8,3 L0,6" fill="#10b981" />
						</marker>
						<marker
							id="flow-arrow-blue"
							markerWidth="8"
							markerHeight="6"
							refX="8"
							refY="3"
							orient="auto"
						>
							<path d="M0,0 L8,3 L0,6" fill="#3b82f6" />
						</marker>
						<marker
							id="flow-arrow-gray"
							markerWidth="8"
							markerHeight="6"
							refX="8"
							refY="3"
							orient="auto"
						>
							<path d="M0,0 L8,3 L0,6" fill="#d1d5db" />
						</marker>
					</defs>

					{#each displaySteps as step, i (step.id)}
						{#if i < displaySteps.length - 1}
							{@const nextStep = displaySteps[i + 1]}
							{@const x1 =
								i * (stationWidth + gap) +
								stationWidth / 2 +
								(step.status === "running" ? 6 : 0)}
							{@const x2 =
								(i + 1) * (stationWidth + gap) +
								stationWidth / 2 -
								(nextStep.status === "running" ? 6 : 0)}
							{@const railY = 40}
							{@const color = segmentColor(step.status, nextStep.status)}
							{@const colorDark = segmentColorDark(step.status, nextStep.status)}
							{@const isActive =
								step.status === "completed" && nextStep.status === "running"}
							{@const arrowColor =
								color === "#10b981" ? "green" : color === "#3b82f6" ? "blue" : "gray"}

							<g>
								<!-- light mode rail -->
								<line
									x1={x1 + 18}
									y1={railY}
									x2={x2 - 18}
									y2={railY}
									stroke={color}
									stroke-width={isActive ? 4 : 3}
									stroke-linecap="round"
									class="dark:hidden"
									filter={isActive ? "url(#rail-glow)" : undefined}
									marker-end="url(#flow-arrow-{arrowColor})"
								/>
								<!-- dark mode rail -->
								<line
									x1={x1 + 18}
									y1={railY}
									x2={x2 - 18}
									y2={railY}
									stroke={colorDark}
									stroke-width={isActive ? 4 : 3}
									stroke-linecap="round"
									class="hidden dark:block"
									filter={isActive ? "url(#rail-glow)" : undefined}
								/>
								<!-- data flow pulse for active -->
								{#if isActive}
									<circle r="4" fill="#3b82f6">
										<animateMotion
											dur="1.8s"
											repeatCount="indefinite"
											path="M{x1 + 18},{railY} L{x2 - 18},{railY}"
										/>
										<animate
											attributeName="opacity"
											values="0.9;0.3;0.9"
											dur="1.8s"
											repeatCount="indefinite"
										/>
									</circle>
								{/if}
							</g>
						{/if}
					{/each}
				</svg>

				<!-- --- Station nodes + cards --- -->
				<div class="relative flex" style="height: 280px">
					{#each displaySteps as step, i (step.id)}
						{@const isCurrent = step.id === currentStepId}
						{@const isSelected = step.id === activeDetailId}
						{@const config = statusConfig[step.status]}
						{@const StatusIcon = config.icon}
						{@const xPos = i * (stationWidth + gap)}

						<div
							class="absolute flex flex-col items-center"
							style="left: {xPos}px; width: {stationWidth}px; top: 0"
						>
							<!-- Station circle -->
							<button
								onclick={() => toggleSelected(step.id)}
								class={cn(
									"relative z-10 flex items-center justify-center transition-transform hover:scale-110",
									step.status === "running" ? "h-10 w-10" : "h-7 w-7"
								)}
								style="margin-top: {step.status === 'running' ? 20 : 26}px"
							>
								{@render stationNode(step.status)}
							</button>

							<!-- Station label -->
							<p
								class={cn(
									"mt-2 text-center text-xs font-semibold leading-tight",
									step.status === "running"
										? "text-blue-600 dark:text-blue-400"
										: step.status === "completed"
											? "text-emerald-600 dark:text-emerald-400"
											: step.status === "failed"
												? "text-red-600 dark:text-red-400"
												: "text-muted-foreground"
								)}
							>
								{step.title}
							</p>
							<p class="text-[10px] text-muted-foreground/70 text-center">
								{step.agentName}
							</p>

							<!-- Floating detail card -->
							<div
								class={cn(
									"mt-2 w-full rounded-lg border p-3 text-left transition-all duration-300",
									isSelected
										? "bg-background shadow-md ring-1 scale-[1.02]"
										: "bg-muted/40 shadow-sm opacity-80 hover:opacity-100",
									isCurrent && step.status === "running"
										? "ring-blue-400/50 dark:ring-blue-500/40 border-blue-200 dark:border-blue-800"
										: step.status === "completed"
											? "ring-emerald-300/40 dark:ring-emerald-600/30 border-emerald-200 dark:border-emerald-800"
											: step.status === "failed"
												? "ring-red-300/40 dark:ring-red-600/30 border-red-200 dark:border-red-800"
												: "ring-transparent"
								)}
							>
								<!-- Status badge -->
								<div class="mb-2 flex items-center justify-between">
									<Badge class={cn("text-[10px] px-1.5 py-0 h-4 gap-0.5", config.badge)}>
										{#if StatusIcon}
											<StatusIcon
												class={cn(
													"h-2.5 w-2.5",
													step.status === "running" && "animate-spin"
												)}
											/>
										{/if}
										{config.label}
									</Badge>
									{#if step.duration}
										<span
											class="text-[10px] text-muted-foreground font-mono tabular-nums"
											>{step.duration}</span
										>
									{/if}
								</div>

								<!-- I/O summary -->
								{#if step.inputSummary}
									<div class="mb-1 flex items-start gap-1">
										<span
											class="mt-px inline-block h-3 w-3 shrink-0 rounded-sm bg-blue-100 dark:bg-blue-900/40 text-center text-[8px] font-bold leading-3 text-blue-700 dark:text-blue-300"
											>I</span
										>
										<p class="text-[10px] leading-tight text-muted-foreground truncate">
											{step.inputSummary}
										</p>
									</div>
								{/if}
								{#if step.outputSummary}
									<div class="mb-1 flex items-start gap-1">
										<span
											class="mt-px inline-block h-3 w-3 shrink-0 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 text-center text-[8px] font-bold leading-3 text-emerald-700 dark:text-emerald-300"
											>O</span
										>
										<p class="text-[10px] leading-tight text-muted-foreground truncate">
											{step.outputSummary}
										</p>
									</div>
								{/if}

								<!-- Tokens -->
								{#if step.tokens != null}
									<div
										class="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground"
									>
										<Zap class="h-2.5 w-2.5" />
										<span class="font-mono tabular-nums"
											>{step.tokens.toLocaleString()} tokens</span
										>
									</div>
								{/if}

								<!-- Running indicator -->
								{#if isCurrent && step.status === "running"}
									<div
										class="mt-2 flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-1 text-[10px] text-blue-600 dark:text-blue-400"
									>
										<span
											class="inline-block h-1 w-1 rounded-full bg-blue-500 animate-pulse"
										></span>
										Processing...
									</div>
								{/if}

								<!-- Actions -->
								{#if step.status === "failed"}
									<Button
										size="sm"
										variant="outline"
										class="mt-2 h-6 text-[10px] w-full"
										onclick={() => onRetryStep?.(step.id)}
									>
										<RefreshCw class="mr-1 h-2.5 w-2.5" /> Retry
									</Button>
								{/if}
								{#if step.status === "waiting"}
									<Tooltip content="Skip this step">
										<Button
											size="sm"
											variant="ghost"
											class="mt-2 h-6 text-[10px] w-full gap-1"
											onclick={() => onSkipStep?.(step.id)}
										>
											<SkipForward class="h-2.5 w-2.5" /> Skip
										</Button>
									</Tooltip>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</ScrollArea>
	</div>

	<!-- ── Metrics dashboard ── -->
	<div class="grid grid-cols-2 gap-3 border-t px-5 py-4 sm:grid-cols-4">
		<!-- Progress -->
		<div class="rounded-xl border bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
			<div
				class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
			>
				<Check class="h-3 w-3" />
				Progress
			</div>
			<p class="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
				{completedCount}<span class="text-sm font-normal text-muted-foreground"
					>/{displaySteps.length}</span
				>
			</p>
			<div
				class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-800/40"
			>
				<div
					class="h-full rounded-full bg-emerald-500 transition-all duration-700"
					style="width: {Math.round((completedCount / displaySteps.length) * 100)}%"
				></div>
			</div>
		</div>

		<!-- Duration -->
		<div class="rounded-xl border bg-blue-50/60 dark:bg-blue-950/20 p-3">
			<div
				class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400"
			>
				<Clock class="h-3 w-3" />
				Duration
			</div>
			<p class="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
				{totalDuration}
			</p>
			<p class="mt-0.5 text-[10px] text-muted-foreground">Total elapsed time</p>
		</div>

		<!-- Tokens -->
		<div class="rounded-xl border bg-zinc-50/80 dark:bg-zinc-900/30 p-3">
			<div
				class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
			>
				<Zap class="h-3 w-3" />
				Tokens
			</div>
			<p class="mt-1 text-xl font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
				{totalTokens.toLocaleString()}
			</p>
			<p class="mt-0.5 text-[10px] text-muted-foreground">
				~{avgTokens.toLocaleString()} avg/step
			</p>
		</div>

		<!-- Status -->
		<div class="rounded-xl border bg-amber-50/60 dark:bg-amber-950/20 p-3">
			<div
				class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400"
			>
				<Cpu class="h-3 w-3" />
				Status
			</div>
			<div class="mt-1 flex items-baseline gap-2">
				<p class="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
					{progressPercent}%
				</p>
			</div>
			<div class="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
				{#if runningCount > 0}
					<span class="flex items-center gap-0.5"
						><span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>{runningCount} active</span
					>
				{/if}
				{#if failedCount > 0}
					<span class="flex items-center gap-0.5"
						><span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>{failedCount} failed</span
					>
				{/if}
				{#if failedCount === 0 && runningCount === 0}
					<span>Pipeline idle</span>
				{/if}
				{#if failedCount === 0 && runningCount > 0}
					<span>On track</span>
				{/if}
			</div>
		</div>
	</div>
</div>
