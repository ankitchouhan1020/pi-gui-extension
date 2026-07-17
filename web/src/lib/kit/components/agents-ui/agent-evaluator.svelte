<script lang="ts" module>
	export interface EvalCriterion {
		label: string;
		score: number;
		maxScore: number;
	}

	export interface EvalIteration {
		id: string;
		number: number;
		output: string;
		score: number;
		feedback: string;
		criteria: EvalCriterion[];
		status: "passed" | "failed" | "in-progress";
	}

	export interface AgentEvaluatorProps {
		taskDescription?: string;
		iterations?: EvalIteration[];
		currentIteration?: number;
		qualityThreshold?: number;
		maxIterations?: number;
		isRunning?: boolean;
		class?: string;
		onRunNext?: () => void;
		onAccept?: () => void;
		onReset?: () => void;
		onAdjustThreshold?: (value: number) => void;
	}
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, Tooltip } from "./_ui/index.js";
	import ArrowDown from "@lucide/svelte/icons/arrow-down";
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Play from "@lucide/svelte/icons/play";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import Target from "@lucide/svelte/icons/target";
	import TrendingDown from "@lucide/svelte/icons/trending-down";
	import TrendingUp from "@lucide/svelte/icons/trending-up";
	import XCircle from "@lucide/svelte/icons/x-circle";

	const statusConfig: Record<
		EvalIteration["status"],
		{ label: string; cls: string }
	> = {
		passed: {
			label: "Passed",
			cls: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900/40",
		},
		failed: {
			label: "Failed",
			cls: "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900/40",
		},
		"in-progress": {
			label: "In progress",
			cls: "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-900/50",
		},
	};

	const defaultIterations: EvalIteration[] = [
		{
			id: "iter-1",
			number: 1,
			output: "Check out our new product features!",
			score: 45,
			feedback:
				"Too generic. Lacks specificity, urgency, and personalization. High spam-score due to exclamation mark.",
			criteria: [
				{ label: "Clarity", score: 60, maxScore: 100 },
				{ label: "Engagement", score: 35, maxScore: 100 },
				{ label: "Length", score: 50, maxScore: 100 },
				{ label: "Spam-score", score: 35, maxScore: 100 },
			],
			status: "failed",
		},
		{
			id: "iter-2",
			number: 2,
			output: "3 workflow shortcuts your team hasn't tried yet",
			score: 72,
			feedback:
				"Better specificity and curiosity gap. Length is good. Reduce implied clickbait to improve spam-score.",
			criteria: [
				{ label: "Clarity", score: 78, maxScore: 100 },
				{ label: "Engagement", score: 82, maxScore: 100 },
				{ label: "Length", score: 70, maxScore: 100 },
				{ label: "Spam-score", score: 58, maxScore: 100 },
			],
			status: "failed",
		},
		{
			id: "iter-3",
			number: 3,
			output: "Your Monday just got 2 hours shorter — here's how",
			score: 91,
			feedback:
				"Strong personal benefit, concrete value proposition, clean of spam triggers. Meets quality threshold.",
			criteria: [
				{ label: "Clarity", score: 92, maxScore: 100 },
				{ label: "Engagement", score: 95, maxScore: 100 },
				{ label: "Length", score: 85, maxScore: 100 },
				{ label: "Spam-score", score: 90, maxScore: 100 },
			],
			status: "passed",
		},
	];

	function criterionBarColor(score: number) {
		if (score >= 80) return "from-emerald-400 to-emerald-500";
		if (score >= 60) return "from-blue-400 to-blue-500";
		if (score >= 40) return "from-amber-400 to-amber-500";
		return "from-red-400 to-red-500";
	}

	function criterionBarBg(score: number) {
		if (score >= 80) return "bg-emerald-500/10 dark:bg-emerald-500/5";
		if (score >= 60) return "bg-blue-500/10 dark:bg-blue-500/5";
		if (score >= 40) return "bg-amber-500/10 dark:bg-amber-500/5";
		return "bg-red-500/10 dark:bg-red-500/5";
	}

	function criterionTextColor(score: number) {
		if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
		if (score >= 60) return "text-blue-600 dark:text-blue-400";
		if (score >= 40) return "text-amber-600 dark:text-amber-400";
		return "text-red-600 dark:text-red-400";
	}

	/* ---- Radial Gauge geometry ---- */
	function buildRadialGauge(score: number, threshold: number, size = 220) {
		const cx = size / 2;
		const cy = size / 2 + 10;
		const radius = size / 2 - 20;
		const startAngle = Math.PI;
		const endAngle = 2 * Math.PI;
		const scoreAngle = startAngle + (score / 100) * (endAngle - startAngle);
		const thresholdAngle = startAngle + (threshold / 100) * (endAngle - startAngle);

		function polarToCartesian(angle: number) {
			return {
				x: cx + radius * Math.cos(angle),
				y: cy + radius * Math.sin(angle),
			};
		}

		function describeArc(from: number, to: number) {
			const start = polarToCartesian(from);
			const end = polarToCartesian(to);
			const largeArc = to - from > Math.PI ? 1 : 0;
			return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
		}

		const thresholdPos = polarToCartesian(thresholdAngle);

		const scoreLabel =
			score >= 80
				? "Excellent"
				: score >= 60
					? "Good"
					: score >= 40
						? "Fair"
						: "Poor";
		const scoreLabelColor =
			score >= 80
				? "text-emerald-500"
				: score >= 60
					? "text-blue-500"
					: score >= 40
						? "text-amber-500"
						: "text-red-500";

		const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
			const angle = startAngle + (tick / 100) * (endAngle - startAngle);
			const innerR = radius - 14;
			const outerR = radius + 14;
			const isMajor = tick % 20 === 0;
			return {
				tick,
				isMajor,
				inner: {
					x: cx + innerR * Math.cos(angle),
					y: cy + innerR * Math.sin(angle),
				},
				outer: {
					x: cx + outerR * Math.cos(angle),
					y: cy + outerR * Math.sin(angle),
				},
				label: {
					x: cx + (radius + 24) * Math.cos(angle),
					y: cy + (radius + 24) * Math.sin(angle),
				},
			};
		});

		return {
			size,
			svgHeight: size / 2 + 30,
			cx,
			cy,
			radius,
			trackPath: describeArc(startAngle, endAngle),
			scorePath: score > 0 ? describeArc(startAngle, scoreAngle) : null,
			thresholdAngle,
			thresholdPos,
			thresholdLine: {
				x1: cx + (radius - 16) * Math.cos(thresholdAngle),
				y1: cy + (radius - 16) * Math.sin(thresholdAngle),
				x2: cx + (radius + 16) * Math.cos(thresholdAngle),
				y2: cy + (radius + 16) * Math.sin(thresholdAngle),
			},
			thresholdLabel: {
				x: thresholdPos.x + 14 * Math.cos(thresholdAngle),
				y: thresholdPos.y + 14 * Math.sin(thresholdAngle) - 6,
			},
			ticks,
			scoreLabel,
			scoreLabelColor,
		};
	}

	/* ---- Convergence chart geometry ---- */
	function buildConvergenceChart(scores: number[], threshold: number) {
		const padding = { top: 12, right: 16, bottom: 20, left: 32 };
		const width = 400;
		const height = 140;
		const chartW = width - padding.left - padding.right;
		const chartH = height - padding.top - padding.bottom;

		const minVal = 0;
		const maxVal = 100;

		function toX(idx: number) {
			return (
				padding.left +
				(scores.length === 1 ? chartW / 2 : (idx / (scores.length - 1)) * chartW)
			);
		}

		function toY(val: number) {
			return padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
		}

		const linePath = scores
			.map(
				(s, i) =>
					`${i === 0 ? "M" : "L"}${toX(i).toFixed(1)} ${toY(s).toFixed(1)}`
			)
			.join(" ");

		const areaPath = `${linePath} L${toX(scores.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(1)} L${toX(0).toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

		const thresholdY = toY(threshold);
		const gridLines = [0, 20, 40, 60, 80, 100];

		return {
			width,
			height,
			padding,
			linePath,
			areaPath,
			thresholdY,
			gridLines: gridLines.map((val) => ({ val, y: toY(val) })),
			points: scores.map((s, i) => ({
				score: s,
				x: toX(i),
				y: toY(s),
				label: `#${i + 1}`,
			})),
		};
	}

	let {
		taskDescription = "Email Subject Line Optimization",
		iterations = defaultIterations,
		currentIteration = 3,
		qualityThreshold = 85,
		maxIterations = 5,
		isRunning = false,
		class: className,
		onRunNext,
		onAccept,
		onReset,
		onAdjustThreshold,
	}: AgentEvaluatorProps = $props();

	// ponytail: expand current iteration on mount only
	let expandedId = $state<string | null>(
		defaultIterations.find((i) => i.number === 3)?.id ?? null
	);

	const latestScore = $derived(
		iterations.length > 0 ? iterations[iterations.length - 1].score : 0
	);
	const hasPassed = $derived(iterations.some((i) => i.status === "passed"));
	const scores = $derived(iterations.map((i) => i.score));

	const deltas = $derived.by(() => {
		const d: Record<string, number> = {};
		for (let i = 1; i < iterations.length; i++) {
			d[iterations[i].id] = iterations[i].score - iterations[i - 1].score;
		}
		return d;
	});

	const totalDelta = $derived(
		iterations.length >= 2
			? iterations[iterations.length - 1].score - iterations[0].score
			: 0
	);

	const gauge = $derived(buildRadialGauge(latestScore, qualityThreshold, 200));
	const chart = $derived(
		scores.length > 0 ? buildConvergenceChart(scores, qualityThreshold) : null
	);

	function toggleExpanded(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<div class={cn("space-y-4 p-4", className)}>
	<!-- ===== Hero Section: Gauge + Meta ===== -->
	<div class="rounded-2xl border bg-background shadow-sm overflow-hidden">
		<div
			class="flex flex-col items-center gap-0 px-6 pt-6 pb-4 md:flex-row md:items-start md:gap-8"
		>
			<!-- Left: Radial Gauge -->
			<div class="shrink-0">
				<div class="relative flex flex-col items-center">
					<svg
						width={gauge.size}
						height={gauge.svgHeight}
						viewBox="0 0 {gauge.size} {gauge.svgHeight}"
					>
						<defs>
							<linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stop-color="#ef4444" />
								<stop offset="35%" stop-color="#f59e0b" />
								<stop offset="65%" stop-color="#3b82f6" />
								<stop offset="100%" stop-color="#10b981" />
							</linearGradient>
							<linearGradient id="gauge-track-bg" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stop-color="currentColor" stop-opacity="0.07" />
								<stop offset="100%" stop-color="currentColor" stop-opacity="0.07" />
							</linearGradient>
							<filter id="gauge-glow">
								<feGaussianBlur stdDeviation="3" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>

						<!-- Track background -->
						<path
							d={gauge.trackPath}
							fill="none"
							stroke="currentColor"
							stroke-opacity="0.1"
							stroke-width="18"
							stroke-linecap="round"
						/>

						<!-- Tick marks -->
						{#each gauge.ticks as tick (tick.tick)}
							<g>
								<line
									x1={tick.inner.x}
									y1={tick.inner.y}
									x2={tick.outer.x}
									y2={tick.outer.y}
									stroke="currentColor"
									stroke-opacity={tick.isMajor ? 0.2 : 0.08}
									stroke-width={tick.isMajor ? 1.5 : 0.8}
								/>
								{#if tick.isMajor}
									<text
										x={tick.label.x}
										y={tick.label.y}
										text-anchor="middle"
										dominant-baseline="central"
										font-size="9"
										fill="currentColor"
										fill-opacity="0.35"
										font-weight="500"
									>
										{tick.tick}
									</text>
								{/if}
							</g>
						{/each}

						<!-- Score arc -->
						{#if gauge.scorePath}
							<path
								d={gauge.scorePath}
								fill="none"
								stroke="url(#gauge-gradient)"
								stroke-width="18"
								stroke-linecap="round"
								filter="url(#gauge-glow)"
							/>
						{/if}

						<!-- Threshold marker -->
						<line
							x1={gauge.thresholdLine.x1}
							y1={gauge.thresholdLine.y1}
							x2={gauge.thresholdLine.x2}
							y2={gauge.thresholdLine.y2}
							stroke="#ef4444"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-dasharray="2 2"
						/>
						<text
							x={gauge.thresholdLabel.x}
							y={gauge.thresholdLabel.y}
							text-anchor="middle"
							font-size="8"
							fill="#ef4444"
							font-weight="600"
						>
							{qualityThreshold}
						</text>
					</svg>

					<!-- Central score display -->
					<div class="absolute inset-0 flex flex-col items-center justify-end pb-2">
						<span
							class="text-5xl font-bold tracking-tight"
							style="font-feature-settings: 'tnum'"
						>
							{latestScore}
						</span>
						<span
							class={cn(
								"text-xs font-semibold uppercase tracking-widest mt-0.5",
								gauge.scoreLabelColor
							)}
						>
							{gauge.scoreLabel}
						</span>
					</div>
				</div>
			</div>

			<!-- Right: Meta info + actions -->
			<div class="flex-1 min-w-0 flex flex-col gap-4 py-2 w-full">
				<div>
					<div class="flex items-center gap-2 text-xs text-muted-foreground mb-1">
						<Sparkles class="h-3.5 w-3.5" />
						<span class="uppercase tracking-widest font-medium"
							>Evaluator-Optimizer Loop</span
						>
					</div>
					<h2 class="text-xl font-bold tracking-tight truncate">{taskDescription}</h2>
					<div class="flex items-center gap-3 mt-2">
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Target class="h-3.5 w-3.5" />
							<span
								>Threshold: <span class="font-semibold text-foreground"
									>{qualityThreshold}</span
								></span
							>
						</div>
						<span class="text-muted-foreground/30">|</span>
						<span class="text-xs text-muted-foreground">
							Iteration <span class="font-semibold text-foreground"
								>{currentIteration}</span
							> of {maxIterations}
						</span>
						{#if latestScore >= qualityThreshold}
							<Badge
								class="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
							>
								<CheckCircle2 class="h-3 w-3 mr-1" />
								Threshold met
							</Badge>
						{:else}
							<Badge variant="outline" class="text-muted-foreground">
								{qualityThreshold - latestScore} pts to go
							</Badge>
						{/if}
					</div>
				</div>

				<!-- Score delta summary -->
				{#if iterations.length >= 2}
					{@const isUp = totalDelta >= 0}
					<div class="flex items-center gap-4">
						<div
							class={cn(
								"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold",
								isUp
									? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
									: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
							)}
						>
							{#if isUp}
								<TrendingUp class="h-4 w-4" />
							{:else}
								<TrendingDown class="h-4 w-4" />
							{/if}
							<span style="font-feature-settings: 'tnum'">
								{isUp ? "+" : ""}{totalDelta} pts
							</span>
							<span class="text-xs font-normal opacity-70">total improvement</span>
						</div>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="flex flex-wrap items-center gap-2">
					<Tooltip content="Generate and evaluate the next iteration">
						<Button
							size="sm"
							class="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
							onclick={onRunNext}
							disabled={isRunning || hasPassed || currentIteration >= maxIterations}
						>
							{#if isRunning}
								<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" />
							{:else}
								<Play class="mr-1.5 h-3.5 w-3.5" />
							{/if}
							Run next
						</Button>
					</Tooltip>
					<Button
						size="sm"
						variant="outline"
						class="h-8"
						onclick={onAccept}
						disabled={iterations.length === 0}
					>
						<CheckCircle2 class="mr-1.5 h-3.5 w-3.5" />
						Accept
					</Button>
					<Button size="sm" variant="ghost" class="h-8" onclick={onReset}>
						<RotateCcw class="mr-1.5 h-3.5 w-3.5" />
						Reset
					</Button>
					<button
						class="ml-auto text-xs text-blue-600 hover:underline dark:text-blue-400"
						onclick={() => onAdjustThreshold?.(qualityThreshold)}
					>
						Adjust threshold
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- ===== Convergence Chart ===== -->
	<div class="rounded-2xl border bg-background p-5 shadow-sm">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-sm font-semibold flex items-center gap-2">
				<TrendingUp class="h-4 w-4 text-blue-500" />
				Score Convergence
			</h3>
			<span
				class="text-[11px] text-muted-foreground uppercase tracking-wider font-medium"
			>
				{scores.length} iteration{scores.length !== 1 ? "s" : ""}
			</span>
		</div>
		<div class="h-36">
			{#if chart}
				<svg viewBox="0 0 {chart.width} {chart.height}" class="w-full h-full">
					<defs>
						<linearGradient id="convergence-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
							<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
						</linearGradient>
						<linearGradient
							id="convergence-line"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="0%"
						>
							<stop offset="0%" stop-color="#60a5fa" />
							<stop offset="100%" stop-color="#3b82f6" />
						</linearGradient>
						<filter id="dot-shadow">
							<feDropShadow
								dx="0"
								dy="0"
								stdDeviation="2"
								flood-color="#3b82f6"
								flood-opacity="0.4"
							/>
						</filter>
					</defs>

					<!-- Grid lines -->
					{#each chart.gridLines as line (line.val)}
						<g>
							<line
								x1={chart.padding.left}
								y1={line.y}
								x2={chart.width - chart.padding.right}
								y2={line.y}
								stroke="currentColor"
								stroke-opacity="0.06"
								stroke-width="1"
							/>
							<text
								x={chart.padding.left - 6}
								y={line.y}
								text-anchor="end"
								dominant-baseline="central"
								font-size="9"
								fill="currentColor"
								fill-opacity="0.3"
								font-weight="500"
							>
								{line.val}
							</text>
						</g>
					{/each}

					<!-- Threshold dashed line -->
					<line
						x1={chart.padding.left}
						y1={chart.thresholdY}
						x2={chart.width - chart.padding.right}
						y2={chart.thresholdY}
						stroke="#ef4444"
						stroke-width="1.2"
						stroke-dasharray="6 4"
						stroke-opacity="0.6"
					/>
					<text
						x={chart.width - chart.padding.right + 4}
						y={chart.thresholdY}
						dominant-baseline="central"
						font-size="9"
						fill="#ef4444"
						font-weight="600"
						fill-opacity="0.8"
					>
						{qualityThreshold}
					</text>

					<!-- Area fill -->
					<path d={chart.areaPath} fill="url(#convergence-fill)" />

					<!-- Line -->
					<path
						d={chart.linePath}
						fill="none"
						stroke="url(#convergence-line)"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>

					<!-- Data point dots -->
					{#each chart.points as point, i (i)}
						<g>
							<circle
								cx={point.x}
								cy={point.y}
								r="5"
								fill="white"
								stroke="#3b82f6"
								stroke-width="2.5"
								filter="url(#dot-shadow)"
								class="dark:fill-gray-900"
							/>
							<text
								x={point.x}
								y={point.y - 10}
								text-anchor="middle"
								font-size="9"
								fill="currentColor"
								fill-opacity="0.6"
								font-weight="600"
							>
								{point.score}
							</text>
						</g>
					{/each}

					<!-- X-axis labels -->
					{#each chart.points as point, i (i)}
						<text
							x={point.x}
							y={chart.height - 4}
							text-anchor="middle"
							font-size="9"
							fill="currentColor"
							fill-opacity="0.35"
							font-weight="500"
						>
							{point.label}
						</text>
					{/each}
				</svg>
			{:else}
				<div class="h-full flex items-center justify-center text-sm text-muted-foreground">
					No data yet
				</div>
			{/if}
		</div>
	</div>

	<!-- ===== Criteria Bar Chart (latest iteration) ===== -->
	{#if iterations.length > 0}
		<div class="rounded-2xl border bg-background p-5 shadow-sm">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-sm font-semibold">Evaluation Criteria</h3>
				<Badge variant="outline" class="text-[11px]">
					Iteration #{iterations[iterations.length - 1].number}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each iterations[iterations.length - 1].criteria as c (c.label)}
					{@const pct = (c.score / c.maxScore) * 100}
					<div class="flex items-center gap-3">
						<span
							class="text-xs font-medium text-muted-foreground w-24 text-right shrink-0 truncate"
						>
							{c.label}
						</span>
						<div
							class={cn(
								"relative h-7 flex-1 rounded-md overflow-hidden",
								criterionBarBg(c.score)
							)}
						>
							<div
								class={cn(
									"absolute inset-y-0 left-0 rounded-md bg-gradient-to-r transition-all duration-500",
									criterionBarColor(c.score)
								)}
								style="width: {pct}%"
							></div>
							<div class="absolute inset-0 flex items-center px-2">
								<span
									class={cn(
										"text-[11px] font-bold ml-auto drop-shadow-sm",
										pct > 20 ? "text-white" : criterionTextColor(c.score)
									)}
									style="font-feature-settings: 'tnum'"
								>
									{c.score}/{c.maxScore}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ===== Iteration Timeline (Stepper) ===== -->
	<div class="rounded-2xl border bg-background p-5 shadow-sm">
		<h3 class="text-sm font-semibold mb-4">Iteration Timeline</h3>

		{#if iterations.length === 0}
			<div
				class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"
			>
				No iterations yet. Click "Run next" to start the evaluator-optimizer loop.
			</div>
		{:else}
			<div class="relative">
				{#each iterations as iter, idx (iter.id)}
					{@const cfg = statusConfig[iter.status]}
					{@const isExpanded = expandedId === iter.id}
					{@const isLast = idx === iterations.length - 1}
					{@const delta = deltas[iter.id]}
					<div class="relative flex gap-4">
						<!-- Stepper line + circle -->
						<div class="flex flex-col items-center shrink-0 w-8">
							<button
								onclick={() => toggleExpanded(iter.id)}
								class={cn(
									"relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
									iter.status === "passed"
										? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
										: iter.status === "in-progress"
											? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
											: "border-muted-foreground/30 bg-muted/40",
									isExpanded && "ring-4 ring-blue-500/10"
								)}
							>
								{#if iter.status === "passed"}
									<CheckCircle2
										class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
									/>
								{:else if iter.status === "in-progress"}
									<Loader2
										class="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin"
									/>
								{:else}
									<XCircle class="h-4 w-4 text-muted-foreground" />
								{/if}
							</button>
							{#if !isLast}
								<div class="w-0.5 flex-1 bg-border"></div>
							{/if}
						</div>

						<!-- Content -->
						<div class={cn("flex-1 min-w-0 pb-6", isLast && "pb-0")}>
							<!-- Title row -->
							<button
								class="flex w-full items-center gap-2 text-left group"
								onclick={() => toggleExpanded(iter.id)}
							>
								<span class="text-xs font-bold text-muted-foreground">
									#{iter.number}
								</span>
								<span
									class="flex-1 min-w-0 truncate text-sm font-medium group-hover:text-blue-600 transition-colors"
								>
									{iter.output}
								</span>

								<!-- Score + delta -->
								<div class="flex items-center gap-2 shrink-0">
									<span
										class="text-sm font-bold"
										style="font-feature-settings: 'tnum'"
									>
										{iter.score}
									</span>
									{#if delta !== undefined}
										<span
											class={cn(
												"flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-1.5 py-0.5",
												delta > 0
													? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
													: delta < 0
														? "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
														: "text-muted-foreground bg-muted"
											)}
											style="font-feature-settings: 'tnum'"
										>
											{#if delta > 0}
												<ArrowUp class="h-3 w-3" />
											{:else if delta < 0}
												<ArrowDown class="h-3 w-3" />
											{/if}
											{delta > 0 ? "+" : ""}{delta}
										</span>
									{/if}
									<Badge class={cn("shrink-0", cfg.cls)}>
										{cfg.label}
									</Badge>
									{#if isExpanded}
										<ChevronDown class="h-4 w-4 text-muted-foreground" />
									{:else}
										<ChevronRight class="h-4 w-4 text-muted-foreground" />
									{/if}
								</div>
							</button>

							<!-- Expanded details -->
							{#if isExpanded}
								<div class="mt-3 space-y-4 rounded-xl border bg-muted/20 p-4">
									<!-- Generator output -->
									<div>
										<p
											class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5"
										>
											Generator output
										</p>
										<div
											class="rounded-lg border border-dashed bg-background px-3 py-2 text-sm font-medium"
										>
											{iter.output}
										</div>
									</div>

									<!-- Criteria bar chart -->
									<div>
										<p
											class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2"
										>
											Evaluation criteria
										</p>
										<div class="space-y-2">
											{#each iter.criteria as c (c.label)}
												{@const pct = (c.score / c.maxScore) * 100}
												<div class="flex items-center gap-3">
													<span
														class="text-xs font-medium text-muted-foreground w-24 text-right shrink-0 truncate"
													>
														{c.label}
													</span>
													<div
														class={cn(
															"relative h-7 flex-1 rounded-md overflow-hidden",
															criterionBarBg(c.score)
														)}
													>
														<div
															class={cn(
																"absolute inset-y-0 left-0 rounded-md bg-gradient-to-r transition-all duration-500",
																criterionBarColor(c.score)
															)}
															style="width: {pct}%"
														></div>
														<div
															class="absolute inset-0 flex items-center px-2"
														>
															<span
																class={cn(
																	"text-[11px] font-bold ml-auto drop-shadow-sm",
																	pct > 20
																		? "text-white"
																		: criterionTextColor(c.score)
																)}
																style="font-feature-settings: 'tnum'"
															>
																{c.score}/{c.maxScore}
															</span>
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>

									<!-- Feedback callout -->
									<div>
										<p
											class="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5"
										>
											Evaluator feedback
										</p>
										<div
											class={cn(
												"relative rounded-lg px-4 py-3 text-sm leading-relaxed",
												"border-l-4",
												iter.status === "passed"
													? "border-l-emerald-500 bg-emerald-50/50 text-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-200"
													: iter.status === "in-progress"
														? "border-l-blue-500 bg-blue-50/50 text-blue-900 dark:bg-blue-900/10 dark:text-blue-200"
														: "border-l-amber-500 bg-amber-50/50 text-amber-900 dark:bg-amber-900/10 dark:text-amber-200"
											)}
										>
											<MessageSquare
												class="absolute top-3 right-3 h-4 w-4 opacity-20"
											/>
											{iter.feedback}
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
