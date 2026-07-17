<script lang="ts" module>
	export type SubAgentStatus = "idle" | "running" | "completed" | "failed";

	export interface SubAgentMetrics {
		tokens?: number;
		cost?: string;
		latency?: string;
	}

	export interface SubAgent {
		id: string;
		name: string;
		role: string;
		status: SubAgentStatus;
		task: string;
		progress: number;
		metrics?: SubAgentMetrics;
	}

	export interface CommLogEntry {
		id: string;
		timestamp: string;
		from: string;
		to: string;
		message: string;
	}

	export interface AgentOrchestratorProps {
		orchestratorName?: string;
		description?: string;
		subAgents?: SubAgent[];
		communicationLog?: CommLogEntry[];
		aggregatedResult?: string;
		isProcessing?: boolean;
		timestamp?: string;
		class?: string;
		onStart?: () => void;
		onPauseAll?: () => void;
		onRedistribute?: () => void;
		onRetryAgent?: (agentId: string) => void;
	}
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, Progress, ScrollArea, Tooltip } from "./_ui/index.js";
	import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
	import ArrowDownUp from "@lucide/svelte/icons/arrow-down-up";
	import Bot from "@lucide/svelte/icons/bot";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import CirclePause from "@lucide/svelte/icons/circle-pause";
	import Clock from "@lucide/svelte/icons/clock";
	import Coins from "@lucide/svelte/icons/coins";
	import Layers from "@lucide/svelte/icons/layers";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Network from "@lucide/svelte/icons/network";
	import Play from "@lucide/svelte/icons/play";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Zap from "@lucide/svelte/icons/zap";

	/* ------------------------------------------------------------------ */
	/*  Status config with border colors                                  */
	/* ------------------------------------------------------------------ */
	const statusConfig: Record<
		SubAgentStatus,
		{
			label: string;
			dotCls: string;
			borderCls: string;
			accentText: string;
			progressCls: string;
		}
	> = {
		idle: {
			label: "Idle",
			dotCls: "bg-slate-400",
			borderCls: "border-l-amber-400",
			accentText: "text-amber-500",
			progressCls: "[&>div]:bg-amber-500",
		},
		running: {
			label: "Running",
			dotCls: "bg-blue-500 animate-pulse",
			borderCls: "border-l-blue-500",
			accentText: "text-blue-500",
			progressCls: "[&>div]:bg-blue-500",
		},
		completed: {
			label: "Completed",
			dotCls: "bg-emerald-500",
			borderCls: "border-l-emerald-500",
			accentText: "text-emerald-500",
			progressCls: "[&>div]:bg-emerald-500",
		},
		failed: {
			label: "Failed",
			dotCls: "bg-red-500",
			borderCls: "border-l-red-500",
			accentText: "text-red-500",
			progressCls: "[&>div]:bg-red-500",
		},
	};

	/* ------------------------------------------------------------------ */
	/*  Mini sparkline SVG path helpers                                   */
	/* ------------------------------------------------------------------ */
	function sparklineGeometry(data: number[]) {
		const max = Math.max(...data);
		const min = Math.min(...data);
		const range = max - min || 1;
		const w = 48;
		const h = 20;
		const points = data
			.map((v, i) => {
				const x = (i / (data.length - 1)) * w;
				const y = h - ((v - min) / range) * (h - 4) - 2;
				return `${x},${y}`;
			})
			.join(" ");

		return {
			w,
			h,
			points,
			areaPoints: `0,${h} ${points} ${w},${h}`,
		};
	}

	/* ------------------------------------------------------------------ */
	/*  Agent avatar color palette                                        */
	/* ------------------------------------------------------------------ */
	const agentColors: Record<string, { bg: string; text: string; ring: string }> = {
		Orchestrator: {
			bg: "bg-zinc-100 dark:bg-zinc-800",
			text: "text-zinc-700 dark:text-zinc-300",
			ring: "ring-zinc-300 dark:ring-zinc-700",
		},
		"Research Agent": {
			bg: "bg-blue-100 dark:bg-blue-900/40",
			text: "text-blue-700 dark:text-blue-300",
			ring: "ring-blue-300 dark:ring-blue-700",
		},
		"Analysis Agent": {
			bg: "bg-amber-100 dark:bg-amber-900/40",
			text: "text-amber-700 dark:text-amber-300",
			ring: "ring-amber-300 dark:ring-amber-700",
		},
		"Writer Agent": {
			bg: "bg-emerald-100 dark:bg-emerald-900/40",
			text: "text-emerald-700 dark:text-emerald-300",
			ring: "ring-emerald-300 dark:ring-emerald-700",
		},
	};

	const fallbackColor = {
		bg: "bg-slate-100 dark:bg-slate-800",
		text: "text-slate-700 dark:text-slate-300",
		ring: "ring-slate-300 dark:ring-slate-700",
	};

	function getAgentColor(name: string) {
		return agentColors[name] ?? fallbackColor;
	}

	/* ------------------------------------------------------------------ */
	/*  Demo data                                                         */
	/* ------------------------------------------------------------------ */
	const defaultSubAgents: SubAgent[] = [
		{
			id: "sa-1",
			name: "Research Agent",
			role: "Web search",
			status: "completed",
			task: "Gather top 20 sources on AI-driven content workflows",
			progress: 100,
			metrics: { tokens: 3420, cost: "$0.04", latency: "12s" },
		},
		{
			id: "sa-2",
			name: "Analysis Agent",
			role: "Data processing",
			status: "running",
			task: "Extract key themes and cluster by relevance",
			progress: 64,
			metrics: { tokens: 1860, cost: "$0.02", latency: "8s" },
		},
		{
			id: "sa-3",
			name: "Writer Agent",
			role: "Content synthesis",
			status: "idle",
			task: "Draft 1500-word brief from clustered findings",
			progress: 0,
			metrics: { tokens: 0, cost: "$0.00" },
		},
	];

	const defaultLog: CommLogEntry[] = [
		{
			id: "log-1",
			timestamp: "09:01",
			from: "Orchestrator",
			to: "Research Agent",
			message: "Begin source collection for AI content workflows",
		},
		{
			id: "log-2",
			timestamp: "09:13",
			from: "Research Agent",
			to: "Orchestrator",
			message: "20 sources collected, passing to analysis",
		},
		{
			id: "log-3",
			timestamp: "09:14",
			from: "Orchestrator",
			to: "Analysis Agent",
			message: "Cluster sources by theme and rank by relevance",
		},
		{
			id: "log-4",
			timestamp: "09:22",
			from: "Analysis Agent",
			to: "Orchestrator",
			message: "64% complete -- 4 clusters identified so far",
		},
	];

	/* ------------------------------------------------------------------ */
	/*  Sparkline demo data per metric type                               */
	/* ------------------------------------------------------------------ */
	const sparkTokens = [120, 580, 1340, 2100, 3420];
	const sparkCost = [0, 0.01, 0.02, 0.03, 0.04];
	const sparkLatency = [2, 5, 8, 11, 12];

	function tokenSparkData(tokens: number) {
		return sparkTokens.map((v) =>
			Math.round(v * (tokens / (sparkTokens[sparkTokens.length - 1] || 1)))
		);
	}

	function costSparkData(cost: string) {
		return sparkCost.map((v) =>
			Number(
				(
					v *
					(parseFloat(cost.replace("$", "")) / (sparkCost[sparkCost.length - 1] || 1))
				).toFixed(4)
			)
		);
	}

	function latencySparkData(latency: string) {
		return sparkLatency.map((v) =>
			Math.round(
				v *
					(parseFloat(latency.replace("s", "")) /
						(sparkLatency[sparkLatency.length - 1] || 1))
			)
		);
	}

	function initialsFromName(name: string) {
		return name
			.split(" ")
			.map((w) => w[0])
			.join("")
			.slice(0, 2);
	}

	let {
		orchestratorName = "Content Research Pipeline",
		description = "Orchestrates research, analysis, and writing sub-agents to produce a structured content brief.",
		subAgents = defaultSubAgents,
		communicationLog = defaultLog,
		aggregatedResult = "Research complete. Analysis in progress -- 4 thematic clusters identified across 20 sources. Writer Agent queued for final synthesis.",
		isProcessing = true,
		timestamp = "Updated moments ago",
		class: className,
		onStart,
		onPauseAll,
		onRedistribute,
		onRetryAgent,
	}: AgentOrchestratorProps = $props();

	const completedCount = $derived(subAgents.filter((a) => a.status === "completed").length);
	const overallProgress = $derived(
		subAgents.length > 0
			? Math.round(subAgents.reduce((s, a) => s + a.progress, 0) / subAgents.length)
			: 0
	);
	const totalTokens = $derived(
		subAgents.reduce((s, a) => s + (a.metrics?.tokens ?? 0), 0)
	);
	const totalCost = $derived(
		subAgents.reduce(
			(s, a) => s + parseFloat((a.metrics?.cost ?? "$0").replace("$", "")),
			0
		)
	);
</script>

<div class={cn("space-y-5 p-4", className)}>
	<!-- ============================================ -->
	<!--  HEADER                                       -->
	<!-- ============================================ -->
	<div
		class="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm dark:bg-card"
	>
		<div
			class="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
		>
			<div class="space-y-1.5">
				<div
					class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70"
				>
					<Network class="h-3.5 w-3.5" />
					Orchestrator-worker pattern
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<h2
						class="text-zinc-900 dark:text-zinc-100 text-2xl font-semibold tracking-tight"
					>
						{orchestratorName}
					</h2>
					<span
						class={cn(
							"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
							isProcessing
								? "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400"
								: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
						)}
					>
						<span
							class={cn(
								"h-1.5 w-1.5 rounded-full",
								isProcessing ? "animate-pulse bg-blue-500" : "bg-emerald-500"
							)}
						></span>
						{isProcessing ? "Processing" : "Complete"}
					</span>
				</div>
				<p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<span
					class="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-muted-foreground dark:bg-zinc-800"
				>
					{timestamp}
				</span>
				<Tooltip content="Launch orchestration pipeline">
					<Button
						size="sm"
						class="h-8 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 shadow-sm"
						onclick={onStart}
						disabled={isProcessing}
					>
						<Play class="mr-1 h-3.5 w-3.5" /> Start
					</Button>
				</Tooltip>
				<Tooltip content="Pause all running sub-agents">
					<Button
						size="sm"
						variant="outline"
						class="h-8 rounded-lg"
						onclick={onPauseAll}
					>
						<CirclePause class="mr-1 h-3.5 w-3.5" /> Pause all
					</Button>
				</Tooltip>
				<Tooltip content="Rebalance work across sub-agents">
					<Button
						size="sm"
						variant="outline"
						class="h-8 rounded-lg"
						onclick={onRedistribute}
					>
						<ArrowDownUp class="mr-1 h-3.5 w-3.5" /> Redistribute
					</Button>
				</Tooltip>
			</div>
		</div>

		<!-- Overall progress bar -->
		<div class="relative mt-5 space-y-2">
			<div class="flex items-center justify-between text-xs">
				<span class="font-medium text-muted-foreground">
					{completedCount}/{subAgents.length} agents completed
				</span>
				<span class="font-semibold text-foreground">
					{overallProgress}%
				</span>
			</div>
			<div
				class="relative h-2 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-zinc-800/60"
			>
				<div
					class="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
					style="width: {overallProgress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- ============================================ -->
	<!--  BENTO GRID -- Sub-agents                    -->
	<!-- ============================================ -->
	<div class="grid auto-rows-fr gap-4 md:grid-cols-3 md:grid-rows-[auto]">
		{#each subAgents as agent, idx (agent.id)}
			{@const cfg = statusConfig[agent.status]}
			{@const isFirst = idx === 0}
			{@const tokenSpark = sparklineGeometry(
				tokenSparkData(agent.metrics?.tokens ?? 0)
			)}
			{@const costSpark = sparklineGeometry(
				costSparkData(agent.metrics?.cost ?? "$0")
			)}
			{@const latencySpark = sparklineGeometry(
				latencySparkData(agent.metrics?.latency ?? "0s")
			)}
			<div
				class={cn(
					"group relative overflow-hidden rounded-lg border border-border border-l-4 bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
					cfg.borderCls,
					isFirst && "md:col-span-2 md:row-span-1"
				)}
			>
				<div class="relative space-y-3">
					<!-- Name + status dot -->
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<p class="truncate text-sm font-semibold text-foreground">
									{agent.name}
								</p>
								<Tooltip content={cfg.label}>
									<span
										class={cn(
											"inline-block h-2 w-2 shrink-0 rounded-full",
											cfg.dotCls
										)}
									></span>
								</Tooltip>
							</div>
							<p
								class="truncate text-[11px] uppercase tracking-wider text-muted-foreground/70"
							>
								{agent.role}
							</p>
						</div>
						{#if agent.status === "running"}
							<Loader2 class="h-4 w-4 shrink-0 animate-spin text-blue-500" />
						{:else if agent.status === "completed"}
							<CheckCircle2 class="h-4 w-4 shrink-0 text-emerald-500" />
						{:else if agent.status === "failed"}
							<AlertTriangle class="h-4 w-4 shrink-0 text-red-500" />
						{/if}
					</div>

					<!-- Task description -->
					<p class="text-xs leading-relaxed text-muted-foreground">
						{agent.task}
					</p>

					<!-- Animated progress -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between text-[11px]">
							<span class="text-muted-foreground">Progress</span>
							<span class="font-semibold text-foreground">
								{agent.progress}%
							</span>
						</div>
						<Progress
							value={agent.progress}
							class={cn(
								"h-1.5 bg-zinc-100 transition-all duration-700 dark:bg-zinc-800",
								cfg.progressCls
							)}
						/>
					</div>

					<!-- Metrics with sparklines -->
					{#if agent.metrics}
						<div
							class={cn(
								"grid gap-2 rounded-lg bg-muted/50 p-2.5",
								isFirst ? "grid-cols-3" : "grid-cols-3"
							)}
						>
							<!-- Tokens -->
							<div class="space-y-0.5">
								<div
									class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70"
								>
									<Zap class="h-2.5 w-2.5" /> Tokens
								</div>
								<p class="text-xs font-semibold text-foreground">
									{(agent.metrics.tokens ?? 0).toLocaleString()}
								</p>
								<svg
									viewBox="0 0 {tokenSpark.w} {tokenSpark.h}"
									class={cn("inline-block", "mt-0.5")}
									width={tokenSpark.w}
									height={tokenSpark.h}
									fill="none"
								>
									<polyline
										points={tokenSpark.points}
										stroke={agent.status === "completed" ? "#10b981" : "#3b82f6"}
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										fill="none"
									/>
									<polyline
										points={tokenSpark.areaPoints}
										fill={agent.status === "completed" ? "#10b981" : "#3b82f6"}
										opacity="0.08"
									/>
								</svg>
							</div>

							<!-- Cost -->
							<div class="space-y-0.5">
								<div
									class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70"
								>
									<Coins class="h-2.5 w-2.5" /> Cost
								</div>
								<p class="text-xs font-semibold text-foreground">
									{agent.metrics.cost ?? "--"}
								</p>
								<svg
									viewBox="0 0 {costSpark.w} {costSpark.h}"
									class={cn("inline-block", "mt-0.5")}
									width={costSpark.w}
									height={costSpark.h}
									fill="none"
								>
									<polyline
										points={costSpark.points}
										stroke="#3b82f6"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										fill="none"
									/>
									<polyline
										points={costSpark.areaPoints}
										fill="#3b82f6"
										opacity="0.08"
									/>
								</svg>
							</div>

							<!-- Latency -->
							<div class="space-y-0.5">
								<div
									class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground/70"
								>
									<Clock class="h-2.5 w-2.5" /> Latency
								</div>
								<p class="text-xs font-semibold text-foreground">
									{agent.metrics.latency ?? "--"}
								</p>
								<svg
									viewBox="0 0 {latencySpark.w} {latencySpark.h}"
									class={cn("inline-block", "mt-0.5")}
									width={latencySpark.w}
									height={latencySpark.h}
									fill="none"
								>
									<polyline
										points={latencySpark.points}
										stroke="#f59e0b"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										fill="none"
									/>
									<polyline
										points={latencySpark.areaPoints}
										fill="#f59e0b"
										opacity="0.08"
									/>
								</svg>
							</div>
						</div>
					{/if}

					<!-- Retry button for failed agents -->
					{#if agent.status === "failed"}
						<Button
							size="sm"
							variant="outline"
							class="h-7 w-full rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
							onclick={() => onRetryAgent?.(agent.id)}
						>
							<RefreshCw class="mr-1 h-3 w-3" /> Retry agent
						</Button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- ============================================ -->
	<!--  BOTTOM SECTION -- Chat log + Result         -->
	<!-- ============================================ -->
	<div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
		<!-- ---- Communication log as chat bubbles ---- -->
		<div class="overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-sm"
					>
						<MessageSquare class="h-3.5 w-3.5 text-white dark:text-zinc-900" />
					</div>
					<p class="text-sm font-semibold text-foreground">Communication Log</p>
				</div>
				<Badge variant="outline" class="rounded-full text-[10px] font-medium">
					{communicationLog.length} messages
				</Badge>
			</div>

			<ScrollArea class="max-h-[240px] pr-1">
				<div class="space-y-3">
					{#each communicationLog as entry (entry.id)}
						{@const isFromOrchestrator = entry.from === "Orchestrator"}
						{@const fromColor = getAgentColor(entry.from)}
						{@const initials = initialsFromName(entry.from)}
						<div
							class={cn(
								"flex gap-2.5",
								isFromOrchestrator ? "flex-row" : "flex-row-reverse"
							)}
						>
							<!-- Avatar -->
							<Tooltip content={entry.from}>
								<div
									class={cn(
										"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1",
										fromColor.bg,
										fromColor.text,
										fromColor.ring
									)}
								>
									{initials}
								</div>
							</Tooltip>

							<!-- Bubble -->
							<div
								class={cn(
									"max-w-[80%] space-y-1 rounded-lg px-3 py-2",
									isFromOrchestrator
										? "rounded-tl-sm bg-zinc-100 dark:bg-zinc-800"
										: "rounded-tr-sm bg-zinc-50 dark:bg-zinc-800/60"
								)}
							>
								<div
									class={cn(
										"flex items-center gap-2 text-[10px]",
										isFromOrchestrator ? "flex-row" : "flex-row-reverse"
									)}
								>
									<span class="font-semibold text-foreground/80">
										{entry.from}
									</span>
									<span class="text-muted-foreground/50">
										{entry.timestamp}
									</span>
								</div>
								<p class="text-xs leading-relaxed text-muted-foreground">
									{entry.message}
								</p>
							</div>
						</div>
					{/each}
					{#if communicationLog.length === 0}
						<div class="flex flex-col items-center gap-2 py-8 text-center">
							<MessageSquare class="h-8 w-8 text-muted-foreground/30" />
							<p class="text-xs text-muted-foreground">No messages yet.</p>
						</div>
					{/if}
				</div>
			</ScrollArea>
		</div>

		<!-- ---- Aggregated result + summary stats ---- -->
		<div class="overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
			<div class="mb-3 flex items-center gap-2">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-sm"
				>
					<Layers class="h-3.5 w-3.5 text-white dark:text-zinc-900" />
				</div>
				<p class="text-sm font-semibold text-foreground">Aggregated Result</p>
			</div>

			{#if aggregatedResult}
				<div class="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
					<p class="text-xs leading-relaxed text-muted-foreground">
						{aggregatedResult}
					</p>
				</div>
			{:else}
				<div
					class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center"
				>
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground/30" />
					<p class="text-xs text-muted-foreground">
						Waiting for sub-agents to complete before aggregating.
					</p>
				</div>
			{/if}

			<!-- Summary metrics -->
			<div class="mt-4 grid grid-cols-3 gap-2">
				<div
					class="flex flex-col items-center gap-1 rounded-lg p-3 text-center bg-muted/50"
				>
					<Bot class="h-3.5 w-3.5 text-blue-600" />
					<p class="text-lg font-bold text-foreground">{subAgents.length}</p>
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground/70">
						Agents
					</p>
				</div>
				<div
					class="flex flex-col items-center gap-1 rounded-lg p-3 text-center bg-muted/50"
				>
					<Zap class="h-3.5 w-3.5 text-amber-500" />
					<p class="text-lg font-bold text-foreground">
						{totalTokens.toLocaleString()}
					</p>
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground/70">
						Total tokens
					</p>
				</div>
				<div
					class="flex flex-col items-center gap-1 rounded-lg p-3 text-center bg-muted/50"
				>
					<Coins class="h-3.5 w-3.5 text-emerald-500" />
					<p class="text-lg font-bold text-foreground">
						${totalCost.toFixed(2)}
					</p>
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground/70">
						Total cost
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
