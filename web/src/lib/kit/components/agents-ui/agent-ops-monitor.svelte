<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, ScrollArea, Tooltip } from "./_ui/index.js";
	import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import Cpu from "@lucide/svelte/icons/cpu";
	import Gauge from "@lucide/svelte/icons/gauge";
	import Network from "@lucide/svelte/icons/network";
	import ShieldCheck from "@lucide/svelte/icons/shield-check";
	import Signal from "@lucide/svelte/icons/signal";
	import WifiOff from "@lucide/svelte/icons/wifi-off";

	export interface OpsSignal {
		id: string;
		title: string;
		status: "healthy" | "warning" | "critical";
		detail: string;
		owner?: string;
		lastUpdated?: string;
	}

	export interface OpsServiceMetric {
		label: string;
		value: string;
		threshold: string;
		trend: "up" | "down" | "stable";
	}

	export interface IncidentEvent {
		id: string;
		timestamp: string;
		summary: string;
		actionNeeded?: string;
	}

	export interface AgentOpsMonitorProps {
		environment?: string;
		uptime?: string;
		signals?: OpsSignal[];
		metrics?: OpsServiceMetric[];
		incidents?: IncidentEvent[];
		onAcknowledge?: (signal: OpsSignal) => void;
		onEscalate?: (signal: OpsSignal) => void;
		onExportReport?: () => void;
		class?: string;
	}

	const defaultSignals: OpsSignal[] = [
		{
			id: "ops-1",
			title: "Latency spike in us-east",
			status: "critical",
			detail: "P95 latency increased from 410ms → 930ms over the last 5 minutes",
			owner: "Agent Atlas",
			lastUpdated: "2m ago",
		},
		{
			id: "ops-2",
			title: "Drift detected in embedding model",
			status: "warning",
			detail: "Sentiment accuracy decreased by 4.8 pts vs. reference dataset",
			owner: "Agent Mira",
			lastUpdated: "8m ago",
		},
		{
			id: "ops-3",
			title: "Backup pipeline",
			status: "healthy",
			detail: "Nightly backups completed · 0 errors",
			owner: "Agent Nova",
			lastUpdated: "Completed",
		},
	];

	const defaultMetrics: OpsServiceMetric[] = [
		{ label: "P95 latency", value: "930ms", threshold: "< 550ms", trend: "up" },
		{ label: "Error rate", value: "0.8%", threshold: "< 1%", trend: "down" },
		{ label: "Agent availability", value: "99.7%", threshold: "> 99.9%", trend: "stable" },
	];

	const defaultIncidents: IncidentEvent[] = [
		{
			id: "evt-1",
			timestamp: "06:42",
			summary: "Failover to eu-west orchestrator",
			actionNeeded: "Monitor",
		},
		{
			id: "evt-2",
			timestamp: "06:55",
			summary: "Customer impact flagged for tier-1 accounts",
			actionNeeded: "CS notified",
		},
	];

	let {
		environment = "Production",
		uptime = "99.97%",
		signals = defaultSignals,
		metrics = defaultMetrics,
		incidents = defaultIncidents,
		onAcknowledge,
		onEscalate,
		onExportReport,
		class: className,
	}: AgentOpsMonitorProps = $props();

	function statusBadgeClass(status: OpsSignal["status"]) {
		if (status === "critical") return "bg-red-100 text-red-700 border border-red-200";
		if (status === "warning") return "bg-amber-100 text-amber-700 border border-amber-200";
		return "bg-emerald-100 text-emerald-700 border border-emerald-200";
	}

	function statusLabel(status: OpsSignal["status"]) {
		if (status === "critical") return "Critical";
		if (status === "warning") return "Warning";
		return "Healthy";
	}

	function trendIconClass(trend: OpsServiceMetric["trend"]) {
		if (trend === "up") return "h-4 w-4 text-red-500";
		if (trend === "down") return "h-4 w-4 rotate-180 text-emerald-500";
		return "h-4 w-4 text-blue-500";
	}
</script>

<div class={cn("space-y-4 p-4", className)}>
	<div
		class="flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm md:flex-row md:items-center md:justify-between"
	>
		<div>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<ShieldCheck class="h-4 w-4" />
				{environment} infrastructure
			</div>
			<div class="flex items-end gap-3">
				<h2 class="text-2xl font-semibold tracking-tight">Operations command center</h2>
				<Badge variant="secondary" class="flex items-center gap-1 text-xs">
					<Gauge class="h-3 w-3" /> Uptime {uptime}
				</Badge>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button class="h-9" onclick={onExportReport}>Export report</Button>
			<Badge variant="outline" class="h-9 gap-1 text-sm">
				<Cpu class="h-4 w-4" />
				{signals.length} signals
			</Badge>
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
		<div class="space-y-3 rounded-xl border bg-background p-4 shadow-sm">
			<div class="flex items-center justify-between text-sm">
				<p class="font-semibold flex items-center gap-2">
					<WifiOff class="h-4 w-4 text-red-500" /> Live signals
				</p>
				<Badge variant="outline">Agent routed</Badge>
			</div>
			<ScrollArea class="max-h-[320px] pr-2">
				<div class="space-y-3">
					{#each signals as signal (signal.id)}
						<div class="space-y-2 rounded-lg border border-dashed p-3">
							<div class="flex items-center justify-between">
								<p class="text-sm font-medium text-foreground">{signal.title}</p>
								<Badge class={statusBadgeClass(signal.status)}>
									{statusLabel(signal.status)}
								</Badge>
							</div>
							<p class="text-xs text-muted-foreground">{signal.detail}</p>
							<div class="flex items-center justify-between text-xs text-muted-foreground">
								<span>Owner · {signal.owner ?? "Unassigned"}</span>
								<span>{signal.lastUpdated ?? "Just now"}</span>
							</div>
							<div class="flex items-center justify-end gap-2">
								<Tooltip content="Confirm agent is handling it">
									<Button
										size="sm"
										variant="outline"
										class="h-7"
										onclick={() => onAcknowledge?.(signal)}
									>
										<CheckCircle2 class="mr-1 h-3.5 w-3.5" /> Acknowledge
									</Button>
								</Tooltip>
								{#if signal.status !== "healthy"}
									<Tooltip content="Route to human on-call">
										<Button
											size="sm"
											class="h-7"
											onclick={() => onEscalate?.(signal)}
										>
											<AlertTriangle class="mr-1 h-3.5 w-3.5" /> Escalate
										</Button>
									</Tooltip>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</ScrollArea>
		</div>
		<div class="space-y-4">
			<div class="rounded-xl border bg-background p-4 shadow-sm">
				<div class="flex items-center justify-between text-sm">
					<p class="font-semibold flex items-center gap-2">
						<Network class="h-4 w-4 text-blue-500" /> Service metrics
					</p>
					<Badge variant="outline">Targets</Badge>
				</div>
				<div class="mt-3 space-y-3">
					{#each metrics as metric (metric.label)}
						<div class="rounded-lg border border-dashed p-3">
							<div class="flex items-center justify-between text-sm font-medium">
								{metric.label}
								<span class="flex items-center gap-2 text-xs text-muted-foreground">
									<Signal class={trendIconClass(metric.trend)} />
									Target {metric.threshold}
								</span>
							</div>
							<div class="mt-2 flex items-baseline gap-2">
								<span class="text-xl font-semibold text-foreground">{metric.value}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="rounded-xl border bg-background p-4 shadow-sm">
				<div class="flex items-center gap-2 text-sm font-semibold">
					<Signal class="h-4 w-4 text-emerald-500" /> Latest incidents
				</div>
				<div class="mt-3 space-y-2 text-xs">
					{#each incidents as incident (incident.id)}
						<div class="rounded-lg border border-dashed p-3">
							<div class="flex items-center justify-between font-medium text-foreground">
								{incident.summary}
								<span class="text-muted-foreground">{incident.timestamp}</span>
							</div>
							{#if incident.actionNeeded}
								<p class="mt-1 text-muted-foreground">Action · {incident.actionNeeded}</p>
							{/if}
						</div>
					{/each}
					{#if incidents.length === 0}
						<p class="rounded-lg border border-dashed p-4 text-muted-foreground">
							No recent incidents.
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
