<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type AgentStatus = "idle" | "thinking" | "running" | "paused" | "error" | "completed";

	export interface AgentCapability {
		name: string;
		description: string;
		icon?: Snippet;
	}

	export interface AgentCardProps {
		name: string;
		description?: string;
		avatar?: string;
		status?: AgentStatus;
		capabilities?: AgentCapability[];
		class?: string;
		onAction?: (action: string) => void;
	}
</script>

<script lang="ts">
	import { Avatar } from "bits-ui";
	import Bot from "@lucide/svelte/icons/bot";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import Circle from "@lucide/svelte/icons/circle";
	import CircleDot from "@lucide/svelte/icons/circle-dot";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import PauseCircle from "@lucide/svelte/icons/pause-circle";
	import XCircle from "@lucide/svelte/icons/x-circle";
	import { cn } from "$lib/utils.js";
	import { Button, Tooltip } from "./_ui/index.js";

	let {
		name,
		description,
		avatar,
		status = "idle",
		capabilities = [],
		class: className,
		onAction,
	}: AgentCardProps = $props();

	const statusMeta: Record<
		AgentStatus,
		{ color: string; label: string }
	> = {
		idle: { color: "text-muted-foreground", label: "Idle" },
		thinking: { color: "text-yellow-500", label: "Thinking" },
		running: { color: "text-blue-500", label: "Running" },
		paused: { color: "text-orange-500", label: "Paused" },
		error: { color: "text-red-500", label: "Error" },
		completed: { color: "text-green-500", label: "Completed" },
	};

	const statusInfo = $derived(statusMeta[status]);
</script>

<div class={cn("rounded-lg p-4 bg-card border", className)}>
	<div class="flex items-start gap-3">
		<Avatar.Root class="relative flex shrink-0 overflow-hidden rounded-full h-10 w-10">
			{#if avatar}
				<Avatar.Image src={avatar} alt={name} class="aspect-square size-full" />
			{/if}
			<Avatar.Fallback
				class="bg-muted flex size-full items-center justify-center rounded-full"
			>
				<Bot class="h-5 w-5" />
			</Avatar.Fallback>
		</Avatar.Root>

		<div class="flex-1 space-y-1">
			<div class="flex items-center justify-between">
				<h3 class="font-semibold">{name}</h3>
				<Tooltip content={`Status: ${statusInfo.label}`}>
					<div class={cn("flex items-center gap-1", statusInfo.color)}>
						{#if status === "idle"}
							<Circle class="h-3 w-3" />
						{:else if status === "thinking"}
							<CircleDot class="h-3 w-3 animate-pulse" />
						{:else if status === "running"}
							<Loader2 class="h-3 w-3 animate-spin" />
						{:else if status === "paused"}
							<PauseCircle class="h-3 w-3" />
						{:else if status === "error"}
							<XCircle class="h-3 w-3" />
						{:else}
							<CheckCircle2 class="h-3 w-3" />
						{/if}
						<span class="text-xs">{statusInfo.label}</span>
					</div>
				</Tooltip>
			</div>

			{#if description}
				<p class="text-sm text-muted-foreground">{description}</p>
			{/if}

			{#if capabilities.length > 0}
				<div class="pt-2">
					<p class="text-xs font-medium text-muted-foreground mb-1">Capabilities:</p>
					<div class="flex flex-wrap gap-1">
						{#each capabilities as capability, index (index)}
							<Tooltip content={capability.description}>
								<span
									class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
								>
									{#if capability.icon}
										{@render capability.icon()}
									{/if}
									{capability.name}
								</span>
							</Tooltip>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if onAction}
		<div class="mt-3 flex gap-2">
			{#if status === "idle"}
				<Button size="sm" onclick={() => onAction("start")}>Start Agent</Button>
			{/if}
			{#if status === "running" || status === "thinking"}
				<Button size="sm" variant="outline" onclick={() => onAction("pause")}>Pause</Button>
				<Button size="sm" variant="destructive" onclick={() => onAction("stop")}>Stop</Button>
			{/if}
			{#if status === "paused"}
				<Button size="sm" onclick={() => onAction("resume")}>Resume</Button>
			{/if}
			{#if status === "completed" || status === "error"}
				<Button size="sm" onclick={() => onAction("restart")}>Restart</Button>
			{/if}
		</div>
	{/if}
</div>
