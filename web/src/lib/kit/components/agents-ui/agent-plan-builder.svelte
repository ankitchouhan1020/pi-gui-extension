<script lang="ts" module>
	export type PlanStepStatus = "pending" | "approved" | "rejected" | "modified";

	export interface PlanStep {
		id: string;
		title: string;
		description: string;
		tool: string;
		duration: string;
		dependencies: number[];
		status: PlanStepStatus;
	}

	export interface AgentPlanBuilderProps {
		planTitle?: string;
		objective?: string;
		totalEstimate?: string;
		estimatedCost?: string;
		steps?: PlanStep[];
		confidence?: number;
		onApproveAll?: () => void;
		onRejectPlan?: () => void;
		onRevise?: () => void;
		onApproveStep?: (stepId: string) => void;
		onRejectStep?: (stepId: string) => void;
		class?: string;
	}

	type ColumnKey = "pending" | "approved" | "rejected";

	interface ColumnDef {
		key: ColumnKey;
		label: string;
		bg: string;
		headerBg: string;
		headerText: string;
		dotColor: string;
		emptyText: string;
	}

	const columns: ColumnDef[] = [
		{
			key: "pending",
			label: "Pending Review",
			bg: "bg-amber-50/60 dark:bg-amber-950/10",
			headerBg: "bg-amber-100 dark:bg-amber-900/30",
			headerText: "text-amber-800 dark:text-amber-200",
			dotColor: "bg-amber-400",
			emptyText: "No pending steps",
		},
		{
			key: "approved",
			label: "Approved",
			bg: "bg-emerald-50/60 dark:bg-emerald-950/10",
			headerBg: "bg-emerald-100 dark:bg-emerald-900/30",
			headerText: "text-emerald-800 dark:text-emerald-200",
			dotColor: "bg-emerald-400",
			emptyText: "No approved steps",
		},
		{
			key: "rejected",
			label: "Rejected",
			bg: "bg-red-50/60 dark:bg-red-950/10",
			headerBg: "bg-red-100 dark:bg-red-900/30",
			headerText: "text-red-800 dark:text-red-200",
			dotColor: "bg-red-400",
			emptyText: "No rejected steps",
		},
	];
</script>

<script lang="ts">
	import type { Component } from "svelte";
	import Bot from "@lucide/svelte/icons/bot";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import Clock from "@lucide/svelte/icons/clock";
	import Database from "@lucide/svelte/icons/database";
	import Eye from "@lucide/svelte/icons/eye";
	import FileText from "@lucide/svelte/icons/file-text";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import Globe from "@lucide/svelte/icons/globe";
	import PenTool from "@lucide/svelte/icons/pen-tool";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Search from "@lucide/svelte/icons/search";
	import Send from "@lucide/svelte/icons/send";
	import ShieldCheck from "@lucide/svelte/icons/shield-check";
	import Target from "@lucide/svelte/icons/target";
	import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
	import XCircle from "@lucide/svelte/icons/x-circle";
	import Zap from "@lucide/svelte/icons/zap";
	import { cn } from "$lib/utils.js";
	import { Badge, Button, ScrollArea, Tooltip } from "./_ui/index.js";

	let {
		planTitle = "SEO Audit Pipeline",
		objective = "Run a full-site SEO audit, analyze content gaps, and deliver an actionable report to the marketing team.",
		totalEstimate = "~34 min",
		estimatedCost = "$1.20",
		steps: stepsProp,
		confidence = 87,
		onApproveAll,
		onRejectPlan,
		onRevise,
		onApproveStep,
		onRejectStep,
		class: className,
	}: AgentPlanBuilderProps = $props();

	const toolIconMap: Record<string, { icon: Component; color: string }> = {
		"Web Crawler": { icon: Globe, color: "text-sky-500" },
		"Content Analyzer": { icon: PenTool, color: "text-slate-500" },
		"Backlink Agent": { icon: Database, color: "text-orange-500" },
		"Report Builder": { icon: FileText, color: "text-emerald-500" },
		Notifier: { icon: Send, color: "text-sky-500" },
		researcher: { icon: Search, color: "text-sky-500" },
		writer: { icon: PenTool, color: "text-slate-500" },
		reviewer: { icon: Eye, color: "text-amber-500" },
		executor: { icon: Zap, color: "text-emerald-500" },
	};

	function getToolIcon(tool: string) {
		return toolIconMap[tool] ?? { icon: Bot, color: "text-muted-foreground" };
	}

	const defaultSteps: PlanStep[] = [
		{
			id: "s1",
			title: "Crawl site pages",
			description:
				"Spider all public URLs and collect metadata, status codes, and page-load times.",
			tool: "Web Crawler",
			duration: "~8 min",
			dependencies: [],
			status: "approved",
		},
		{
			id: "s2",
			title: "Analyze content quality",
			description:
				"Score each page for keyword density, readability, and internal linking coverage.",
			tool: "Content Analyzer",
			duration: "~10 min",
			dependencies: [1],
			status: "pending",
		},
		{
			id: "s3",
			title: "Check backlink profile",
			description:
				"Pull referring domains, anchor-text distribution, and spam-score flagging.",
			tool: "Backlink Agent",
			duration: "~6 min",
			dependencies: [1],
			status: "pending",
		},
		{
			id: "s4",
			title: "Generate audit report",
			description:
				"Compile findings into a structured report with priority-ranked recommendations.",
			tool: "Report Builder",
			duration: "~7 min",
			dependencies: [2, 3],
			status: "rejected",
		},
		{
			id: "s5",
			title: "Send notifications",
			description:
				"Deliver the report via email and post a summary to the team Slack channel.",
			tool: "Notifier",
			duration: "~3 min",
			dependencies: [4],
			status: "pending",
		},
	];

	const displaySteps = $derived(
		stepsProp && stepsProp.length > 0 ? stepsProp : defaultSteps
	);
	const confidenceClamped = $derived(
		Math.min(100, Math.max(0, Math.round(confidence)))
	);

	const stepIndexMap = $derived.by(() => {
		const map = new Map<string, number>();
		displaySteps.forEach((s, i) => map.set(s.id, i + 1));
		return map;
	});

	const buckets = $derived.by(() => {
		const pending: PlanStep[] = [];
		const approved: PlanStep[] = [];
		const rejected: PlanStep[] = [];
		displaySteps.forEach((step) => {
			if (step.status === "approved") approved.push(step);
			else if (step.status === "rejected") rejected.push(step);
			else pending.push(step);
		});
		return { pending, approved, rejected } as Record<ColumnKey, PlanStep[]>;
	});

	const counts = $derived({
		pending: buckets.pending.length,
		approved: buckets.approved.length,
		rejected: buckets.rejected.length,
		total: displaySteps.length,
	});

	const gaugeStroke = 8;
	const gaugeCircumference = Math.PI * 44;
	const gaugeFilled = $derived((confidenceClamped / 100) * gaugeCircumference);
	const gaugeGap = $derived(gaugeCircumference - gaugeFilled);
	const gaugeStrokeColor = $derived(
		confidenceClamped >= 70
			? "stroke-emerald-500"
			: confidenceClamped >= 40
				? "stroke-amber-400"
				: "stroke-red-400"
	);
</script>

<div class={cn("space-y-4", className)}>
	<div class="overflow-hidden rounded-2xl border bg-background shadow-sm">
		<div class="h-1 bg-zinc-200 dark:bg-zinc-700"></div>

		<div class="p-5">
			<div
				class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
			>
				<div class="min-w-0 flex-1 space-y-1.5">
					<div
						class="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
					>
						<Target class="h-3.5 w-3.5" />
						Plan Confirmation
					</div>
					<h2 class="truncate text-xl font-bold tracking-tight md:text-2xl">
						{planTitle}
					</h2>
					<p class="max-w-lg text-sm leading-relaxed text-muted-foreground">
						{objective}
					</p>

					<div class="flex flex-wrap items-center gap-1.5 pt-2">
						<Badge
							class="border-emerald-200 bg-emerald-100 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-300"
						>
							{counts.approved} approved
						</Badge>
						<Badge
							class="border-amber-200 bg-amber-100 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300"
						>
							{counts.pending} pending
						</Badge>
						<Badge
							class="border-red-200 bg-red-100 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-300"
						>
							{counts.rejected} rejected
						</Badge>
						<span class="mx-1 text-muted-foreground/40">|</span>
						<Badge variant="outline" class="gap-1 text-xs">
							<Clock class="h-3 w-3" />
							{totalEstimate}
						</Badge>
						<Badge variant="outline" class="text-xs">{estimatedCost}</Badge>
					</div>
				</div>

				<div class="flex shrink-0 flex-col items-center pt-1">
					<div
						class="relative flex flex-col items-center"
						style="width: 130px; height: {130 * 0.6}px"
					>
						<svg viewBox="0 0 100 55" class="h-full w-full overflow-visible">
							<path
								d="M 6 50 A 44 44 0 0 1 94 50"
								fill="none"
								class="stroke-muted/40"
								stroke-width={gaugeStroke}
								stroke-linecap="round"
							/>
							<path
								d="M 6 50 A 44 44 0 0 1 94 50"
								fill="none"
								class={cn(gaugeStrokeColor, "transition-all duration-700 ease-out")}
								stroke-width={gaugeStroke}
								stroke-linecap="round"
								stroke-dasharray="{gaugeFilled} {gaugeGap}"
							/>
						</svg>
						<div class="absolute bottom-0 flex flex-col items-center">
							<span class="text-2xl font-bold tracking-tight"
								>{confidenceClamped}%</span
							>
							<span class="-mt-0.5 text-[10px] text-muted-foreground"
								>confidence</span
							>
						</div>
					</div>
					<div
						class="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"
					>
						<ShieldCheck class="h-3 w-3" />
						Agent confidence score
					</div>
				</div>
			</div>
		</div>
	</div>

	<ScrollArea class="w-full" orientation="both">
		<div class="grid min-w-[640px] grid-cols-1 gap-4 pb-2 md:grid-cols-3">
			{#each columns as col (col.key)}
				{@const items = buckets[col.key]}
				<div class={cn("flex flex-col overflow-hidden rounded-xl border", col.bg)}>
					<div
						class={cn(
							"flex items-center justify-between px-3.5 py-2.5",
							col.headerBg
						)}
					>
						<div class="flex items-center gap-2">
							<span class={cn("h-2 w-2 rounded-full", col.dotColor)}></span>
							<span
								class={cn("text-xs font-semibold tracking-wide", col.headerText)}
							>
								{col.label}
							</span>
						</div>
						<span
							class={cn(
								"flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
								col.headerBg,
								col.headerText
							)}
						>
							{items.length}
						</span>
					</div>

					<div class="min-h-[120px] flex-1 space-y-2.5 p-2.5">
						{#if items.length === 0}
							<div
								class="flex h-full min-h-[100px] items-center justify-center"
							>
								<p class="text-xs text-muted-foreground/50 italic">
									{col.emptyText}
								</p>
							</div>
						{:else}
							{#each items as step (step.id)}
								{@const stepIndex = stepIndexMap.get(step.id) ?? 0}
								{@const toolMeta = getToolIcon(step.tool)}
								{@const ToolIcon = toolMeta.icon}
								<div
									class={cn(
										"group relative overflow-hidden rounded-lg border bg-white p-3.5",
										"shadow-sm hover:-translate-y-0.5 hover:shadow-md",
										"transition-all duration-200 ease-out",
										"dark:border-zinc-800 dark:bg-zinc-900"
									)}
								>
									<span
										class="pointer-events-none absolute -top-2 -right-1 select-none text-6xl font-black opacity-[0.04] dark:opacity-[0.06]"
										aria-hidden="true"
									>
										{stepIndex}
									</span>

									<div class="flex items-start justify-between gap-2">
										<div class="flex min-w-0 items-center gap-2">
											<div
												class={cn(
													"flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
													"bg-muted/60 dark:bg-zinc-800"
												)}
											>
												<ToolIcon
													class={cn("h-3.5 w-3.5", toolMeta.color)}
												/>
											</div>
											<div class="min-w-0">
												<p
													class="truncate text-sm leading-tight font-semibold text-foreground"
												>
													{step.title}
												</p>
											</div>
										</div>

										<span
											class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
										>
											{stepIndex}
										</span>
									</div>

									<p
										class="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
									>
										{step.description}
									</p>

									<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
										<Badge
											variant="outline"
											class="h-5 gap-1 px-1.5 py-0 text-[10px] font-medium"
										>
											<GitBranch class="h-2.5 w-2.5" />
											{step.tool}
										</Badge>
										<Badge
											variant="outline"
											class="h-5 gap-1 px-1.5 py-0 text-[10px] font-medium"
										>
											<Clock class="h-2.5 w-2.5" />
											{step.duration}
										</Badge>
									</div>

									{#if step.dependencies.length > 0}
										<div class="mt-2 flex items-center gap-1">
											<span class="mr-0.5 text-[10px] text-muted-foreground"
												>Depends on</span
											>
											{#each step.dependencies as dep (dep)}
												<span
													class="inline-flex h-4 w-4 items-center justify-center rounded border border-dashed border-muted-foreground/30 text-[9px] font-semibold text-muted-foreground"
												>
													{dep}
												</span>
											{/each}
											<span
												class="ml-1 flex-1 border-t border-dashed border-muted-foreground/20"
											></span>
										</div>
									{/if}

									{#if step.status === "pending" || step.status === "modified"}
										<div
											class="mt-3 flex items-center gap-1.5 border-t border-dashed pt-2.5"
										>
											<Tooltip content="Approve this step">
												<Button
													size="sm"
													variant="ghost"
													class="h-7 flex-1 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
													onclick={() => onApproveStep?.(step.id)}
												>
													<ThumbsUp class="h-3 w-3" />
													Approve
												</Button>
											</Tooltip>
											<Tooltip content="Reject this step">
												<Button
													size="sm"
													variant="ghost"
													class="h-7 flex-1 gap-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
													onclick={() => onRejectStep?.(step.id)}
												>
													<ThumbsDown class="h-3 w-3" />
													Reject
												</Button>
											</Tooltip>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</ScrollArea>

	<div class="flex flex-wrap items-center gap-2 pt-1">
		<Button class="bg-blue-600 shadow-sm hover:bg-blue-700" onclick={() => onApproveAll?.()}>
			<CheckCircle2 class="mr-2 h-4 w-4" />
			Approve all
		</Button>
		<Button variant="outline" onclick={() => onRevise?.()}>
			<RotateCcw class="mr-2 h-4 w-4" />
			Request revision
		</Button>
		<Button
			variant="outline"
			class="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
			onclick={() => onRejectPlan?.()}
		>
			<XCircle class="mr-2 h-4 w-4" />
			Reject plan
		</Button>
	</div>
</div>
