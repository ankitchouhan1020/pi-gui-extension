<script lang="ts">
	import type { Component } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Badge, Button, ScrollArea, Tooltip } from "./_ui/index.js";
	import ArrowRightLeft from "@lucide/svelte/icons/arrow-right-left";
	import Brain from "@lucide/svelte/icons/brain";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import Clock from "@lucide/svelte/icons/clock";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import MessageSquareText from "@lucide/svelte/icons/message-square-text";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Router from "@lucide/svelte/icons/router";
	import ShieldCheck from "@lucide/svelte/icons/shield-check";
	import XCircle from "@lucide/svelte/icons/x-circle";
	import Zap from "@lucide/svelte/icons/zap";

	export type RouteStatus = "selected" | "available" | "unavailable";

	export interface RouteClassification {
		intent: string;
		confidence: number;
		reasoning: string;
	}

	export interface AgentRoute {
		id: string;
		agentName: string;
		specialty: string;
		matchScore: number;
		status: RouteStatus;
		description: string;
	}

	export interface RoutingHistoryEntry {
		id: string;
		query: string;
		intent: string;
		agentName: string;
		timestamp: string;
	}

	export interface AgentRoutingHubProps {
		inputQuery?: string;
		classification?: RouteClassification;
		routes?: AgentRoute[];
		selectedRouteId?: string;
		routingHistory?: RoutingHistoryEntry[];
		isClassifying?: boolean;
		class?: string;
		onReclassify?: () => void;
		onOverrideRoute?: (routeId: string) => void;
		onViewHistory?: () => void;
	}

	const specialtyColors: Record<
		string,
		{ border: string; bg: string; text: string; fill: string; ring: string }
	> = {
		technical: {
			border: "border-l-cyan-500",
			bg: "bg-cyan-500/10",
			text: "text-cyan-600 dark:text-cyan-400",
			fill: "bg-cyan-500",
			ring: "ring-cyan-500/30",
		},
		billing: {
			border: "border-l-amber-500",
			bg: "bg-amber-500/10",
			text: "text-amber-600 dark:text-amber-400",
			fill: "bg-amber-500",
			ring: "ring-amber-500/30",
		},
		sales: {
			border: "border-l-slate-500",
			bg: "bg-slate-500/10",
			text: "text-slate-600 dark:text-slate-400",
			fill: "bg-slate-500",
			ring: "ring-slate-500/30",
		},
		pricing: {
			border: "border-l-slate-500",
			bg: "bg-slate-500/10",
			text: "text-slate-600 dark:text-slate-400",
			fill: "bg-slate-500",
			ring: "ring-slate-500/30",
		},
		general: {
			border: "border-l-slate-400",
			bg: "bg-slate-400/10",
			text: "text-slate-500 dark:text-slate-400",
			fill: "bg-slate-400",
			ring: "ring-slate-400/30",
		},
		default: {
			border: "border-l-blue-500",
			bg: "bg-blue-500/10",
			text: "text-blue-600 dark:text-blue-400",
			fill: "bg-blue-500",
			ring: "ring-blue-500/30",
		},
	};

	function getSpecialtyColor(specialty: string) {
		const lower = specialty.toLowerCase();
		for (const key of Object.keys(specialtyColors)) {
			if (key !== "default" && lower.includes(key)) return specialtyColors[key];
		}
		return specialtyColors.default;
	}

	const statusVisual: Record<
		RouteStatus,
		{ label: string; icon: Component; tone: string }
	> = {
		selected: {
			label: "Selected",
			icon: CheckCircle2,
			tone: "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-900/50",
		},
		available: {
			label: "Available",
			icon: ShieldCheck,
			tone: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900/40",
		},
		unavailable: {
			label: "Offline",
			icon: XCircle,
			tone: "bg-slate-200 text-slate-600 border border-slate-300 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800",
		},
	};

	const defaultRoutes: AgentRoute[] = [
		{
			id: "tech",
			agentName: "Tech Support Agent",
			specialty: "Technical issues",
			matchScore: 94,
			status: "selected",
			description:
				"Handles debugging, error resolution, and technical troubleshooting for product issues.",
		},
		{
			id: "billing",
			agentName: "Billing Agent",
			specialty: "Payments & invoices",
			matchScore: 42,
			status: "available",
			description:
				"Manages billing inquiries, payment failures, refund requests, and invoice generation.",
		},
		{
			id: "sales",
			agentName: "Sales Agent",
			specialty: "Pricing & plans",
			matchScore: 18,
			status: "available",
			description:
				"Assists with plan upgrades, feature comparisons, and enterprise pricing questions.",
		},
		{
			id: "general",
			agentName: "General Agent",
			specialty: "Broad Q&A",
			matchScore: 12,
			status: "unavailable",
			description: "Catches general queries that do not match a specialized agent category.",
		},
	];

	const defaultClassification: RouteClassification = {
		intent: "Technical Support",
		confidence: 96,
		reasoning:
			"Query mentions a specific product error related to payment processing, indicating a technical debugging need rather than a billing dispute.",
	};

	const defaultHistory: RoutingHistoryEntry[] = [
		{
			id: "h1",
			query: "How do I upgrade my plan?",
			intent: "Sales",
			agentName: "Sales Agent",
			timestamp: "2 min ago",
		},
		{
			id: "h2",
			query: "Invoice #4821 is incorrect",
			intent: "Billing",
			agentName: "Billing Agent",
			timestamp: "8 min ago",
		},
		{
			id: "h3",
			query: "API returns 500 on /auth",
			intent: "Technical Support",
			agentName: "Tech Support Agent",
			timestamp: "14 min ago",
		},
	];

	let {
		inputQuery,
		classification,
		routes,
		selectedRouteId,
		routingHistory,
		isClassifying = false,
		class: className,
		onReclassify,
		onOverrideRoute,
		onViewHistory,
	}: AgentRoutingHubProps = $props();

	const displayQuery = $derived(inputQuery ?? "How do I fix the payment processing error?");
	const cls = $derived(classification ?? defaultClassification);
	const displayRoutes = $derived(routes && routes.length > 0 ? routes : defaultRoutes);
	const selId = $derived(selectedRouteId ?? "tech");
	const history = $derived(
		routingHistory && routingHistory.length > 0 ? routingHistory : defaultHistory
	);
	const selectedRoute = $derived(displayRoutes.find((r) => r.id === selId));

	// Confidence gauge geometry (matches React ConfidenceGauge with size=140)
	const gaugeSize = 140;
	const gaugeStrokeWidth = 10;
	const gaugeRadius = (gaugeSize - gaugeStrokeWidth) / 2;
	const gaugeCx = gaugeSize / 2;
	const gaugeCy = gaugeSize / 2 + 4;
	const gaugeCircumference = Math.PI * gaugeRadius;

	const gaugeFilled = $derived((cls.confidence / 100) * gaugeCircumference);
	const gaugeGap = $derived(gaugeCircumference - gaugeFilled);
	const gaugeColor = $derived(
		cls.confidence >= 80
			? "stroke-emerald-500"
			: cls.confidence >= 50
				? "stroke-amber-500"
				: "stroke-red-500"
	);
	const gaugeTextColor = $derived(
		cls.confidence >= 80
			? "text-emerald-600 dark:text-emerald-400"
			: cls.confidence >= 50
				? "text-amber-600 dark:text-amber-400"
				: "text-red-600 dark:text-red-400"
	);
	const gaugeConfidenceLabel = $derived(
		cls.confidence >= 80
			? "High confidence routing. No manual review needed."
			: cls.confidence >= 50
				? "Moderate confidence. Consider reviewing the selection."
				: "Low confidence. Manual override recommended."
	);
	const gaugeArcPath = `M ${gaugeStrokeWidth / 2} ${gaugeCy} A ${gaugeRadius} ${gaugeRadius} 0 0 1 ${gaugeSize - gaugeStrokeWidth / 2} ${gaugeCy}`;
</script>

<div class={cn("w-full space-y-0", className)}>
	<!-- Header with network grid background -->
	<div
		class="relative overflow-hidden rounded-t-xl border border-b-0 bg-zinc-50 dark:bg-zinc-900 px-5 py-5"
	>
		<svg
			class="absolute inset-0 h-full w-full opacity-[0.04] dark:opacity-[0.06]"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<pattern id="routing-grid" width="32" height="32" patternUnits="userSpaceOnUse">
					<path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" stroke-width="0.8"
					></path>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#routing-grid)"></rect>
			<circle cx="0" cy="0" r="1.2" fill="currentColor" opacity="0.5"></circle>
			<circle cx="32" cy="0" r="1.2" fill="currentColor" opacity="0.5"></circle>
			<circle cx="0" cy="32" r="1.2" fill="currentColor" opacity="0.5"></circle>
			<circle cx="32" cy="32" r="1.2" fill="currentColor" opacity="0.5"></circle>
		</svg>
		<div
			class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
		>
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm"
					>
						<Router class="h-4 w-4" />
					</div>
					<div>
						<h2 class="text-lg font-semibold tracking-tight">Agent Routing Hub</h2>
						<p class="text-xs text-muted-foreground">
							Intelligent query classification and agent dispatch
						</p>
					</div>
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="h-8 text-xs"
					onclick={onReclassify}
					disabled={isClassifying}
				>
					<RefreshCw class={cn("mr-1.5 h-3.5 w-3.5", isClassifying && "animate-spin")} />
					Reclassify
				</Button>
				<Button variant="outline" size="sm" class="h-8 text-xs" onclick={onViewHistory}>
					<Clock class="mr-1.5 h-3.5 w-3.5" />
					History
				</Button>
			</div>
		</div>
	</div>

	<!-- Classification ticker bar -->
	<div class="border border-b-0 bg-background px-4 py-2.5">
		<div class="flex flex-wrap items-center gap-1.5 text-xs">
			<span
				class="flex items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 font-medium text-white shadow-sm"
			>
				<MessageSquareText class="h-3 w-3" />
				Query
			</span>
			<span class="text-muted-foreground/60">&rsaquo;</span>
			<span
				class="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-foreground"
			>
				<Brain class="h-3 w-3" />
				Intent: {cls.intent}
				{#if isClassifying}
					<Loader2 class="h-3 w-3 animate-spin text-blue-500" />
				{/if}
			</span>
			<span class="text-muted-foreground/60">&rsaquo;</span>
			<span
				class={cn(
					"rounded-full px-2.5 py-1 font-medium",
					cls.confidence >= 80
						? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
						: cls.confidence >= 50
							? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
							: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
				)}
			>
				Confidence: {cls.confidence}%
			</span>
			<span class="text-muted-foreground/60">&rsaquo;</span>
			<span
				class="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-foreground"
			>
				<Zap class="h-3 w-3 text-blue-500" />
				Route: {selectedRoute?.agentName ?? "Pending..."}
			</span>
		</div>
	</div>

	<!-- Main content area -->
	<div class="rounded-b-xl border bg-background">
		<div class="grid gap-0 lg:grid-cols-[1fr,260px]">
			<!-- LEFT: network visualization -->
			<div class="space-y-0 p-5 lg:border-r">
				<!-- Central query node with pulsing ring -->
				<div class="relative mx-auto max-w-lg">
					<div
						class={cn(
							"relative rounded-xl border-2 border-blue-500/70 bg-blue-50/50 p-4 shadow-sm",
							"dark:bg-blue-950/20 dark:border-blue-400/50",
							"before:absolute before:inset-0 before:rounded-xl before:border-2 before:border-blue-400/30 before:animate-ping before:pointer-events-none before:[animation-duration:2.5s]"
						)}
					>
						<div class="flex items-start gap-3">
							<div
								class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"
							>
								<MessageSquareText class="h-4 w-4" />
							</div>
							<div class="min-w-0 space-y-1">
								<p
									class="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400"
								>
									Incoming Query
								</p>
								<p class="text-sm font-medium leading-snug text-foreground">
									{displayQuery}
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- SVG arrow from query to routes -->
				<div class="flex items-center justify-center py-1">
					<svg
						width="24"
						height="40"
						viewBox="0 0 24 40"
						class="text-blue-500 dark:text-blue-400"
					>
						<defs>
							<marker
								id="arrowhead"
								markerWidth="8"
								markerHeight="6"
								refX="4"
								refY="3"
								orient="auto"
							>
								<polygon points="0 0, 8 3, 0 6" fill="currentColor"></polygon>
							</marker>
						</defs>
						<line
							x1="12"
							y1="2"
							x2="12"
							y2="34"
							stroke="currentColor"
							stroke-width="2"
							stroke-dasharray="4 3"
							marker-end="url(#arrowhead)"
						></line>
					</svg>
				</div>

				<!-- Route cards grid -->
				<div class="grid gap-3 sm:grid-cols-2">
					{#each displayRoutes as route (route.id)}
						{@const isSelected = route.id === selId}
						{@const visual = statusVisual[route.status]}
						{@const color = getSpecialtyColor(route.specialty)}
						{@const StatusIcon = visual.icon}
						<div
							class={cn(
								"relative rounded-xl border-l-4 border bg-background p-4 transition-all duration-200",
								color.border,
								isSelected &&
									"ring-2 ring-blue-500 shadow-sm dark:ring-blue-400 border-l-blue-500",
								!isSelected && route.status === "unavailable" && "opacity-50"
							)}
						>
							{#if isSelected}
								<div
									class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-md"
								>
									<CheckCircle2 class="h-3 w-3" />
								</div>
							{/if}

							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="text-sm font-bold truncate text-foreground">
										{route.agentName}
									</p>
									<p class={cn("text-xs font-medium truncate mt-0.5", color.text)}>
										{route.specialty}
									</p>
								</div>
								<Badge class={cn("shrink-0 text-[10px] px-1.5 py-0.5", visual.tone)}>
									<StatusIcon class="h-2.5 w-2.5 mr-0.5" />
									{visual.label}
								</Badge>
							</div>

							<p class="mt-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
								{route.description}
							</p>

							<!-- Match score bar INSIDE the card -->
							<div class="mt-3">
								<div class="flex items-center justify-between text-[10px] mb-1.5">
									<span class="font-medium text-muted-foreground uppercase tracking-wide"
										>Match</span
									>
									<span
										class={cn(
											"font-bold tabular-nums",
											route.matchScore >= 70
												? "text-emerald-600 dark:text-emerald-400"
												: route.matchScore >= 40
													? "text-amber-600 dark:text-amber-400"
													: "text-muted-foreground"
										)}
									>
										{route.matchScore}%
									</span>
								</div>
								<div class="h-2 w-full overflow-hidden rounded-full bg-muted/60">
									<div
										class={cn(
											"h-full rounded-full transition-all duration-500",
											route.matchScore >= 70
												? "bg-emerald-500"
												: route.matchScore >= 40
													? "bg-amber-500"
													: "bg-slate-400"
										)}
										style="width: {route.matchScore}%"
									></div>
								</div>
							</div>

							{#if !isSelected && route.status === "available"}
								<Button
									variant="ghost"
									size="sm"
									class="mt-3 h-7 w-full text-[11px] hover:bg-muted/60"
									onclick={() => onOverrideRoute?.(route.id)}
								>
									<ArrowRightLeft class="mr-1 h-3 w-3" />
									Override route
								</Button>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Routing reasoning callout -->
				{#if selectedRoute}
					<div
						class="mt-4 rounded-lg border border-blue-200/60 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-900/10"
					>
						<div class="flex items-start gap-2.5">
							<Brain class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
							<div class="space-y-0.5">
								<p class="text-xs font-semibold text-foreground">
									Routed to
									<span class="text-blue-700 dark:text-blue-300"
										>{selectedRoute.agentName}</span
									>
								</p>
								<p class="text-[11px] leading-relaxed text-muted-foreground">
									{cls.reasoning}
								</p>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- RIGHT: gauge + history -->
			<div class="flex flex-col divide-y">
				<!-- Confidence gauge -->
				<div class="flex flex-col items-center px-4 py-5">
					<p
						class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
					>
						Routing Confidence
					</p>
					<svg
						width={gaugeSize}
						height={gaugeSize / 2 + 16}
						viewBox="0 0 {gaugeSize} {gaugeSize / 2 + 16}"
						class="shrink-0"
					>
						<path
							d={gaugeArcPath}
							fill="none"
							stroke-width={gaugeStrokeWidth}
							class="stroke-muted"
							stroke-linecap="round"
						></path>
						<path
							d={gaugeArcPath}
							fill="none"
							stroke-width={gaugeStrokeWidth}
							class={cn(gaugeColor, "transition-all duration-700")}
							stroke-linecap="round"
							stroke-dasharray="{gaugeFilled} {gaugeGap}"
						></path>
						<text
							x={gaugeCx}
							y={gaugeCy - 6}
							text-anchor="middle"
							class={cn("text-xl font-bold fill-current", gaugeTextColor)}
						>
							{cls.confidence}%
						</text>
						<text
							x={gaugeCx}
							y={gaugeCy + 10}
							text-anchor="middle"
							class="text-[9px] fill-muted-foreground uppercase tracking-widest"
						>
							confidence
						</text>
					</svg>
					<p
						class="mt-1 text-[11px] text-muted-foreground text-center max-w-[200px] leading-relaxed"
					>
						{gaugeConfidenceLabel}
					</p>
				</div>

				<!-- Recent routes mini table -->
				<div class="flex-1 px-4 py-4">
					<div class="mb-3 flex items-center justify-between">
						<p class="text-xs font-semibold text-foreground">Recent Routes</p>
						<Badge variant="secondary" class="text-[10px] h-5 px-1.5"
							>{history.length}</Badge
						>
					</div>
					<ScrollArea class="h-[200px]">
						<table class="w-full text-[11px]">
							<thead>
								<tr class="border-b text-left text-muted-foreground">
									<th class="pb-1.5 font-medium">Query</th>
									<th class="pb-1.5 font-medium text-right">Route</th>
								</tr>
							</thead>
							<tbody>
								{#each history as entry, i (entry.id)}
									<tr
										class={cn(
											"border-b border-muted/40 transition-colors hover:bg-muted/30",
											i % 2 === 0 ? "bg-muted/10" : "bg-transparent"
										)}
										title="{entry.agentName} · Routed {entry.timestamp}"
									>
										<td class="py-2 pr-2">
											<Tooltip
												content="{entry.agentName} · Routed {entry.timestamp}"
												side="left"
											>
												<div>
													<p
														class="truncate max-w-[110px] font-medium text-foreground"
													>
														{entry.query}
													</p>
													<p class="text-[10px] text-muted-foreground">
														{entry.timestamp}
													</p>
												</div>
											</Tooltip>
										</td>
										<td class="py-2 text-right">
											<Badge
												variant="outline"
												class="text-[9px] px-1.5 py-0"
											>
												{entry.intent}
											</Badge>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</ScrollArea>
				</div>
			</div>
		</div>
	</div>
</div>
