<script lang="ts" module>
	export type RiskLevel = "low" | "medium" | "high";

	export interface ToolApprovalRequest {
		toolName: string;
		description: string;
		parameters: Record<string, string>;
		riskLevel: RiskLevel;
		reasoning: string;
	}

	export interface ToolApprovalHistoryItem {
		id: string;
		toolName: string;
		decision: "approved" | "rejected";
		timestamp: string;
		actor?: string;
	}

	export interface ToolExecutionResult {
		success: boolean;
		output: string;
		duration?: string;
	}

	export interface AgentToolApprovalProps {
		pendingApproval?: ToolApprovalRequest | null;
		approvalHistory?: ToolApprovalHistoryItem[];
		executionResult?: ToolExecutionResult | null;
		onApprove?: () => void;
		onReject?: () => void;
		onAlwaysAllow?: (toolName: string) => void;
		class?: string;
	}

	const riskBannerConfig: Record<
		RiskLevel,
		{ label: string; bannerClass: string; iconColor: string; dotClass: string }
	> = {
		low: {
			label: "Low Risk",
			bannerClass: "bg-emerald-600 dark:bg-emerald-700",
			iconColor: "text-emerald-100",
			dotClass: "bg-emerald-400",
		},
		medium: {
			label: "Medium Risk",
			bannerClass: "bg-amber-500 dark:bg-amber-600",
			iconColor: "text-amber-100",
			dotClass: "bg-amber-400",
		},
		high: {
			label: "High Risk",
			bannerClass: "bg-red-600 dark:bg-red-700",
			iconColor: "text-red-100",
			dotClass: "bg-red-400",
		},
	};
</script>

<script lang="ts">
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Clock from "@lucide/svelte/icons/clock";
	import Database from "@lucide/svelte/icons/database";
	import Fingerprint from "@lucide/svelte/icons/fingerprint";
	import Lock from "@lucide/svelte/icons/lock";
	import ShieldAlert from "@lucide/svelte/icons/shield-alert";
	import ShieldCheck from "@lucide/svelte/icons/shield-check";
	import Terminal from "@lucide/svelte/icons/terminal";
	import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
	import XCircle from "@lucide/svelte/icons/x-circle";
	import { cn } from "$lib/utils.js";
	import { Badge, Button, ScrollArea, Tooltip } from "./_ui/index.js";

	let {
		pendingApproval,
		approvalHistory,
		executionResult,
		onApprove,
		onReject,
		onAlwaysAllow,
		class: className,
	}: AgentToolApprovalProps = $props();

	let alwaysAllow = $state(false);
	let resultOpen = $state(true);

	const defaultApproval: ToolApprovalRequest = {
		toolName: "database_query",
		description:
			"Execute a read-only SQL query against the analytics database",
		parameters: {
			query:
				"SELECT user_id, COUNT(*) AS sessions FROM events WHERE ts > NOW() - INTERVAL '7 days' GROUP BY user_id ORDER BY sessions DESC LIMIT 20",
			database: "analytics_prod",
			timeout: "30s",
		},
		riskLevel: "medium",
		reasoning:
			"The user asked for the most active users this week. This query fetches the top 20 users by session count from the production analytics database over the last 7 days.",
	};

	const defaultHistory: ToolApprovalHistoryItem[] = [
		{
			id: "h1",
			toolName: "web_search",
			decision: "approved",
			timestamp: "2 min ago",
			actor: "You",
		},
		{
			id: "h2",
			toolName: "send_email",
			decision: "rejected",
			timestamp: "8 min ago",
			actor: "You",
		},
		{
			id: "h3",
			toolName: "database_query",
			decision: "approved",
			timestamp: "14 min ago",
			actor: "You",
		},
	];

	const defaultResult: ToolExecutionResult = {
		success: true,
		output:
			'[\n  { "user_id": "u_38291", "sessions": 142 },\n  { "user_id": "u_10482", "sessions": 118 },\n  { "user_id": "u_92841", "sessions": 97 }\n]',
		duration: "230ms",
	};

	const approval = $derived(
		pendingApproval === undefined ? defaultApproval : pendingApproval
	);
	const history = $derived(
		approvalHistory && approvalHistory.length > 0
			? approvalHistory
			: defaultHistory
	);
	const result = $derived(
		executionResult === undefined ? defaultResult : executionResult
	);
	const riskConf = $derived(approval ? riskBannerConfig[approval.riskLevel] : null);
</script>

<div
	class={cn(
		"relative w-full overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60",
		className
	)}
>
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
		style="background-image: radial-gradient(circle, rgb(148 163 184 / 0.5) 1px, transparent 1px); background-size: 20px 20px;"
	></div>
	<div class="relative z-10 space-y-5 p-5 sm:p-6">
		<div class="flex items-start gap-3">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-sm"
			>
				<ShieldAlert class="h-5 w-5 text-white" />
			</div>
			<div class="space-y-0.5">
				<h2 class="text-lg font-semibold tracking-tight text-foreground">
					Tool Approval Required
				</h2>
				<p class="text-sm text-muted-foreground">
					The agent needs your permission before executing a tool.
				</p>
			</div>
		</div>

		{#if approval}
			<div class="grid gap-5 lg:grid-cols-[1fr,340px]">
				<div
					class="space-y-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
				>
					<div
						class={cn(
							"flex items-center justify-between gap-2 px-4 py-2.5 text-white",
							riskConf!.bannerClass
						)}
					>
						<div class="flex items-center gap-2 text-sm font-semibold">
							<span
								class={cn(
									"inline-block h-2 w-2 animate-pulse rounded-full",
									riskConf!.dotClass
								)}
							></span>
							{riskConf!.label}
						</div>
						<Fingerprint class={cn("h-4 w-4", riskConf!.iconColor)} />
					</div>

					<div class="space-y-4 bg-card p-5">
						<div class="space-y-1.5">
							<div class="flex items-center gap-2">
								<Database
									class="h-4.5 w-4.5 shrink-0 text-blue-600 dark:text-blue-400"
								/>
								<span class="font-mono text-sm font-bold text-foreground">
									{approval.toolName}
								</span>
							</div>
							<p class="text-sm leading-relaxed text-muted-foreground">
								{approval.description}
							</p>
						</div>

						<div class="space-y-2">
							<h4
								class="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
							>
								<Terminal class="h-3 w-3" />
								Parameters
							</h4>
							<div
								class="overflow-hidden rounded-lg bg-zinc-950 p-3 shadow-inner"
							>
								{#each Object.entries(approval.parameters) as [key, value] (key)}
									<div class="flex gap-2 py-1 font-mono text-xs">
										<span class="shrink-0 text-sky-400">
											{key}<span class="text-zinc-500">:</span>
										</span>
										<span class="break-all text-zinc-100">{value}</span>
									</div>
								{/each}
							</div>
						</div>

						<div class="space-y-2">
							<h4
								class="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
							>
								<Lock class="h-3 w-3" />
								Agent Reasoning
							</h4>
							<div
								class="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-3.5 text-sm leading-relaxed text-muted-foreground dark:border-zinc-700 dark:bg-zinc-800/50"
							>
								{approval.reasoning}
							</div>
						</div>

						<div
							class="flex flex-col gap-4 border-t border-zinc-200/80 pt-4 dark:border-zinc-700/60 sm:flex-row sm:items-center sm:justify-between"
						>
							<button
								type="button"
								onclick={() => (alwaysAllow = !alwaysAllow)}
								class="group flex items-center gap-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								<span
									class={cn(
										"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
										alwaysAllow
											? "bg-emerald-500"
											: "bg-zinc-300 dark:bg-zinc-600"
									)}
								>
									<span
										class={cn(
											"inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200",
											alwaysAllow ? "translate-x-[18px]" : "translate-x-[3px]"
										)}
									></span>
								</span>
								<span>
									Always allow{" "}
									<span class="font-semibold text-foreground">
										{approval.toolName}
									</span>
								</span>
							</button>

							<div class="flex items-center gap-2.5">
								<Button
									size="lg"
									class="h-10 rounded-lg bg-red-600 px-5 text-white shadow-sm transition-colors hover:bg-red-700"
									onclick={() => onReject?.()}
								>
									<XCircle class="mr-1.5 h-4 w-4" />
									Reject
								</Button>
								<Tooltip content="Allow the agent to execute this tool call">
									<Button
										size="lg"
										class="h-10 rounded-lg bg-emerald-600 px-5 text-white shadow-sm transition-colors hover:bg-emerald-700"
										onclick={() => {
											if (alwaysAllow) onAlwaysAllow?.(approval.toolName);
											onApprove?.();
										}}
									>
										<CheckCircle2 class="mr-1.5 h-4 w-4" />
										Approve
									</Button>
								</Tooltip>
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-5">
					{#if result}
						<div
							class="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
						>
							<button
								type="button"
								class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
								onclick={() => (resultOpen = !resultOpen)}
							>
								<div class="flex items-center gap-2">
									<Terminal class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm font-semibold text-foreground">
										Execution Result
									</span>
									<Badge
										class={cn(
											"ml-1 text-[10px]",
											result.success
												? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-300"
												: "border-red-200 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-300"
										)}
									>
										{result.success ? "Success" : "Failed"}{result.duration
											? ` · ${result.duration}`
											: ""}
									</Badge>
								</div>
								<ChevronDown
									class={cn(
										"h-4 w-4 text-muted-foreground transition-transform duration-200",
										resultOpen && "rotate-180"
									)}
								/>
							</button>
							{#if resultOpen}
								<div class="border-t border-zinc-200/60 dark:border-zinc-700/40">
									<div class="p-3">
										<div
											class="overflow-hidden rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 shadow-inner"
										>
											<pre class="whitespace-pre-wrap break-all">{result.output}</pre>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<div
						class="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
					>
						<div
							class="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700"
						>
							<div class="flex items-center gap-2">
								<ShieldCheck class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-semibold text-foreground">
									Approval Timeline
								</span>
							</div>
							<Badge
								class="border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300"
							>
								{history.length} decisions
							</Badge>
						</div>

						<ScrollArea class="max-h-[280px]">
							<div class="px-4 py-3">
								<div class="relative">
									<div
										class="absolute top-2.5 bottom-2.5 left-[7px] w-px bg-zinc-200 dark:bg-zinc-700"
									></div>

									<div class="space-y-0">
										{#each history as item (item.id)}
											{@const isApproved = item.decision === "approved"}
											<div class="relative flex items-start gap-3 py-2.5">
												<div class="relative z-10 mt-0.5">
													<div
														class={cn(
															"flex h-[15px] w-[15px] items-center justify-center rounded-full ring-2 ring-white dark:ring-zinc-900",
															isApproved ? "bg-emerald-500" : "bg-red-500"
														)}
													>
														{#if isApproved}
															<ThumbsUp class="h-2 w-2 text-white" />
														{:else}
															<ThumbsDown class="h-2 w-2 text-white" />
														{/if}
													</div>
												</div>

												<div
													class="flex min-w-0 flex-1 items-center justify-between gap-2"
												>
													<div class="min-w-0">
														<span
															class="block truncate font-mono text-xs font-semibold text-foreground"
														>
															{item.toolName}
														</span>
														<span class="text-[11px] text-muted-foreground">
															{isApproved ? "Approved" : "Rejected"}{item.actor
																? ` by ${item.actor}`
																: ""}
														</span>
													</div>
													<div
														class="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
													>
														<Clock class="h-3 w-3" />
														{item.timestamp}
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</ScrollArea>
					</div>
				</div>
			</div>
		{:else}
			<div
				class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-muted px-6 py-10 dark:border-zinc-700"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"
				>
					<ShieldCheck class="h-6 w-6 text-muted-foreground" />
				</div>
				<div class="space-y-1 text-center">
					<p class="text-sm font-medium text-foreground">No pending approvals</p>
					<p class="text-xs text-muted-foreground">
						The agent will request permission when it needs to execute a tool.
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
