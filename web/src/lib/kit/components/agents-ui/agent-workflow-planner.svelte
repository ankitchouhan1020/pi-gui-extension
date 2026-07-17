<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Badge, Button, Separator, Tooltip } from "./_ui/index.js";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import CalendarDays from "@lucide/svelte/icons/calendar-days";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
	import Compass from "@lucide/svelte/icons/compass";
	import ListChecks from "@lucide/svelte/icons/list-checks";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Sparkles from "@lucide/svelte/icons/sparkles";

	export interface WorkflowCheckpoint {
		id: string;
		title: string;
		owner: string;
		eta: string;
		status: "upcoming" | "active" | "done";
		notes?: string;
	}

	export interface WorkflowPlaybook {
		label: string;
		description: string;
		tasks: string[];
		handoff?: string;
	}

	export interface ActionItem {
		id: string;
		label: string;
		detail: string;
		type: "agent" | "human";
	}

	export interface AgentWorkflowPlannerProps {
		programName?: string;
		timeframe?: string;
		checkpoints?: WorkflowCheckpoint[];
		playbooks?: WorkflowPlaybook[];
		nextActions?: ActionItem[];
		onReplan?: () => void;
		onAcknowledge?: (item: ActionItem) => void;
		class?: string;
	}

	const defaultCheckpoints: WorkflowCheckpoint[] = [
		{
			id: "cp-1",
			title: "Scope requirements",
			owner: "Agent Meridian",
			eta: "Due today",
			status: "done",
			notes: "Validated against sales requests",
		},
		{
			id: "cp-2",
			title: "Design handoff",
			owner: "Agent Relay",
			eta: "12:30 PM",
			status: "active",
			notes: "Upload updated figma annotations",
		},
		{
			id: "cp-3",
			title: "Ops enablement",
			owner: "Agent Orbit",
			eta: "Tomorrow",
			status: "upcoming",
			notes: "Prep Notion page + Loom walkthrough",
		},
	];

	const defaultPlaybooks: WorkflowPlaybook[] = [
		{
			label: "Agent onboarding",
			description: "Spin up new agent in under 45 min",
			tasks: ["Provision API keys", "Sync policies", "Validate prompt stack"],
			handoff: "Human QA review",
		},
		{
			label: "Lifecycle announcements",
			description: "Ship in-product tooltip campaign",
			tasks: ["Draft copy", "Localize", "Schedule rollout"],
		},
	];

	const defaultActions: ActionItem[] = [
		{
			id: "act-1",
			label: "Upload annotated design doc",
			detail: "Agent Relay awaiting updated callouts",
			type: "human",
		},
		{
			id: "act-2",
			label: "Approve pricing adjustments",
			detail: "Agent Ledger prepared 3 tiered options",
			type: "human",
		},
		{
			id: "act-3",
			label: "Generate onboarding email",
			detail: "Agent Author queued copy draft for review",
			type: "agent",
		},
	];

	let {
		programName = "Launch readiness",
		timeframe = "Week of March 17",
		checkpoints = defaultCheckpoints,
		playbooks = defaultPlaybooks,
		nextActions = defaultActions,
		onReplan,
		onAcknowledge,
		class: className,
	}: AgentWorkflowPlannerProps = $props();

	// ponytail: init from first playbook only; re-sync if parent remounts
	let expandedPlaybook = $state(defaultPlaybooks[0]?.label ?? "");

	const statusStyles: Record<WorkflowCheckpoint["status"], string> = {
		done: "border-emerald-200 bg-emerald-50 text-emerald-700",
		active: "border-blue-200 bg-blue-50 text-blue-700",
		upcoming: "border-slate-200 bg-slate-50 text-slate-600",
	};
</script>

<div class={cn("space-y-5 p-4", className)}>
	<div class="rounded-xl border bg-background p-4 shadow-sm">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="space-y-1">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<CalendarDays class="h-4 w-4" />
					{timeframe}
				</div>
				<div class="flex items-end gap-3">
					<h2 class="text-2xl font-semibold tracking-tight">{programName} workflow</h2>
					<Badge variant="secondary" class="flex items-center gap-1 text-xs">
						<Sparkles class="h-3.5 w-3.5" /> Agent-driven
					</Badge>
				</div>
				<p class="text-sm text-muted-foreground">
					Checkpoints, playbooks, and next steps orchestrated between agents and humans.
				</p>
			</div>
			<Button class="h-9" onclick={onReplan}>
				<RefreshCw class="mr-2 h-4 w-4" /> Re-plan the week
			</Button>
		</div>
	</div>

	<div class="grid gap-5 lg:grid-cols-[1.4fr,1fr]">
		<div class="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
			<div class="flex items-center justify-between text-sm">
				<p class="font-semibold flex items-center gap-2">
					<ListChecks class="h-4 w-4 text-blue-500" /> Checkpoints
				</p>
				<Badge variant="outline">{checkpoints.length} milestones</Badge>
			</div>
			<div class="space-y-4">
				{#each checkpoints as checkpoint, index (checkpoint.id)}
					<div class="space-y-3 rounded-lg border border-dashed p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div
									class={cn(
										"flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
										statusStyles[checkpoint.status]
									)}
								>
									{index + 1}
								</div>
								<div>
									<p class="text-sm font-medium text-foreground">{checkpoint.title}</p>
									<p class="text-xs text-muted-foreground">Owner · {checkpoint.owner}</p>
								</div>
							</div>
							<Badge variant="outline" class="text-xs">{checkpoint.eta}</Badge>
						</div>
						{#if checkpoint.notes}
							<p class="text-xs text-muted-foreground">{checkpoint.notes}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
		<div class="space-y-4">
			<div class="rounded-xl border bg-background p-4 shadow-sm">
				<div class="flex items-center justify-between text-sm">
					<p class="font-semibold flex items-center gap-2">
						<Compass class="h-4 w-4 text-indigo-500" /> Playbooks
					</p>
					<Badge variant="outline">{playbooks.length} templates</Badge>
				</div>
				<div class="mt-3 space-y-3">
					{#each playbooks as playbook (playbook.label)}
						{@const selected = expandedPlaybook === playbook.label}
						<div class="rounded-lg border p-3 transition-all">
							<button
								type="button"
								class="flex w-full items-center justify-between text-left"
								onclick={() => (expandedPlaybook = selected ? "" : playbook.label)}
							>
								<div>
									<p class="text-sm font-medium text-foreground">{playbook.label}</p>
									<p class="text-xs text-muted-foreground">{playbook.description}</p>
								</div>
								<ArrowRight
									class={cn("h-4 w-4 transition-transform", selected && "rotate-90")}
								/>
							</button>
							{#if selected}
								<div class="mt-3 space-y-2 text-xs text-muted-foreground">
									<p class="font-medium text-foreground">Steps</p>
									<ol class="list-decimal space-y-1 pl-4">
										{#each playbook.tasks as task (task)}
											<li>{task}</li>
										{/each}
									</ol>
									{#if playbook.handoff}
										<p class="rounded-md bg-muted/50 p-2 text-xs">
											<strong>Handoff:</strong>
											{playbook.handoff}
										</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-xl border bg-background p-4 shadow-sm">
				<div class="flex items-center justify-between text-sm">
					<p class="font-semibold flex items-center gap-2">
						<ClipboardCheck class="h-4 w-4 text-emerald-500" /> Next actions
					</p>
					<Badge variant="outline">{nextActions.length} queued</Badge>
				</div>
				<div class="mt-3 space-y-3">
					{#each nextActions as action (action.id)}
						<div class="rounded-lg border border-dashed p-3">
							<div class="flex items-center justify-between">
								<p class="text-sm font-medium text-foreground">{action.label}</p>
								<Badge
									class={cn(
										action.type === "agent"
											? "bg-blue-100 text-blue-700 border border-blue-200"
											: "bg-amber-100 text-amber-700 border border-amber-200"
									)}
								>
									{action.type === "agent" ? "Agent" : "Human"}
								</Badge>
							</div>
							<p class="mt-2 text-xs text-muted-foreground">{action.detail}</p>
							<div class="mt-3 flex items-center justify-end gap-2">
								<Tooltip content="Mark handoff complete">
									<Button
										size="sm"
										variant="outline"
										class="h-7"
										onclick={() => onAcknowledge?.(action)}
									>
										<CheckCircle2 class="mr-1 h-3.5 w-3.5" /> Mark done
									</Button>
								</Tooltip>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<Separator />

	<div
		class="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-2">
			<CheckCircle2 class="h-4 w-4 text-emerald-500" />
			Workflow auto-updates every hour
		</div>
		<div>*Playbook data and checkpoints are fully mockable for documentation*</div>
	</div>
</div>
