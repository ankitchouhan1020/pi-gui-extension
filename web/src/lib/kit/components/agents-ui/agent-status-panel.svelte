<script lang="ts" module>
	export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";
	export type ModelCapability = "chat" | "code" | "vision" | "function-calling" | "embedding";

	export interface ModelInfo {
		name: string;
		provider: string;
		contextLength: number;
		capabilities: ModelCapability[];
		costPer1kTokens?: {
			input: number;
			output: number;
		};
	}

	export interface SystemResources {
		cpu: number;
		memory: number;
		latency: number;
		uptime: string;
	}

	export interface AgentStatusPanelProps {
		connectionStatus?: ConnectionStatus;
		modelInfo?: ModelInfo;
		systemResources?: SystemResources;
		version?: string;
		onReconnect?: () => void;
		onRefresh?: () => void;
		onSettings?: () => void;
		class?: string;
		compact?: boolean;
	}

	const capabilityLabels: Record<ModelCapability, string> = {
		chat: "Chat Conversations",
		code: "Code Generation",
		vision: "Image Understanding",
		"function-calling": "Tool Usage",
		embedding: "Text Embeddings",
	};

	const connectionMeta: Record<ConnectionStatus, { color: string; label: string }> = {
		connected: { color: "text-green-500", label: "Connected" },
		connecting: { color: "text-blue-500", label: "Connecting" },
		disconnected: { color: "text-muted-foreground", label: "Disconnected" },
		error: { color: "text-red-500", label: "Connection Error" },
	};
</script>

<script lang="ts">
	import AlertCircle from "@lucide/svelte/icons/alert-circle";
	import Bot from "@lucide/svelte/icons/bot";
	import Brain from "@lucide/svelte/icons/brain";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import CircleDot from "@lucide/svelte/icons/circle-dot";
	import Cloud from "@lucide/svelte/icons/cloud";
	import Cpu from "@lucide/svelte/icons/cpu";
	import Loader2 from "@lucide/svelte/icons/loader-2";
	import MemoryStick from "@lucide/svelte/icons/memory-stick";
	import Power from "@lucide/svelte/icons/power";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Settings from "@lucide/svelte/icons/settings";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import WifiOff from "@lucide/svelte/icons/wifi-off";
	import Zap from "@lucide/svelte/icons/zap";
	import { cn } from "$lib/utils.js";
	import { Button, Separator, Tooltip } from "./_ui/index.js";

	let {
		connectionStatus = "connected",
		modelInfo,
		systemResources,
		version = "1.0.0",
		onReconnect,
		onRefresh,
		onSettings,
		class: className,
		compact = false,
	}: AgentStatusPanelProps = $props();

	let isRefreshing = $state(false);

	function handleRefresh() {
		isRefreshing = true;
		onRefresh?.();
		setTimeout(() => {
			isRefreshing = false;
		}, 1000);
	}

	const conn = $derived(connectionMeta[connectionStatus]);
</script>

{#snippet statusIndicator()}
	<div class={cn("flex items-center gap-2", conn.color)}>
		{#if connectionStatus === "connected"}
			<CheckCircle2 class="h-4 w-4" />
		{:else if connectionStatus === "connecting"}
			<Loader2 class="h-4 w-4 animate-spin" />
		{:else if connectionStatus === "disconnected"}
			<WifiOff class="h-4 w-4" />
		{:else}
			<AlertCircle class="h-4 w-4" />
		{/if}
		<span class="text-sm font-medium">{conn.label}</span>
	</div>
{/snippet}

{#snippet resourceMeter(label: string, value: number, unit: string, threshold: number)}
	{@const isHigh = value > threshold}
	<div class="space-y-1">
		<div class="flex items-center justify-between text-sm">
			<div class="flex items-center gap-1 text-muted-foreground">
				{#if label === "CPU"}
					<Cpu class="h-3 w-3" />
				{:else}
					<MemoryStick class="h-3 w-3" />
				{/if}
				<span>{label}</span>
			</div>
			<span class={cn("font-medium", isHigh && "text-orange-500")}>
				{value}{unit}
			</span>
		</div>
		<div class="h-1.5 bg-secondary rounded-full overflow-hidden">
			<div
				class={cn("h-full transition-all", isHigh ? "bg-orange-500" : "bg-primary")}
				style="width: {Math.min(value, 100)}%"
			></div>
		</div>
	</div>
{/snippet}

{#if compact}
	<div class={cn("rounded-lg border bg-card p-3", className)}>
		<div class="flex items-center justify-between">
			{@render statusIndicator()}
			<div class="flex items-center gap-1">
				{#if connectionStatus === "disconnected" && onReconnect}
					<Button size="icon" variant="ghost" class="h-7 w-7" onclick={onReconnect}>
						<Power class="h-3 w-3" />
					</Button>
				{/if}
				<Button size="icon" variant="ghost" class="h-7 w-7" onclick={handleRefresh}>
					<RefreshCw class={cn("h-3 w-3", isRefreshing && "animate-spin")} />
				</Button>
				{#if onSettings}
					<Button size="icon" variant="ghost" class="h-7 w-7" onclick={onSettings}>
						<Settings class="h-3 w-3" />
					</Button>
				{/if}
			</div>
		</div>

		{#if modelInfo}
			<div class="mt-3 text-xs">
				<p class="font-medium">{modelInfo.name}</p>
				<p class="text-muted-foreground">{modelInfo.provider}</p>
			</div>
		{/if}
	</div>
{:else}
	<div class={cn("rounded-lg border bg-card", className)}>
		<div class="p-4 border-b">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="rounded-full bg-primary/10 p-2">
						<Bot class="h-5 w-5 text-primary" />
					</div>
					<div>
						<h3 class="font-semibold">Agent Status</h3>
						<p class="text-xs text-muted-foreground">Version {version}</p>
					</div>
				</div>

				<div class="flex items-center gap-1">
					{#if connectionStatus === "disconnected" && onReconnect}
						<Tooltip content="Reconnect">
							<Button size="icon" variant="ghost" onclick={onReconnect}>
								<Power class="h-4 w-4" />
							</Button>
						</Tooltip>
					{/if}

					<Tooltip content="Refresh status">
						<Button size="icon" variant="ghost" onclick={handleRefresh}>
							<RefreshCw class={cn("h-4 w-4", isRefreshing && "animate-spin")} />
						</Button>
					</Tooltip>

					{#if onSettings}
						<Tooltip content="Settings">
							<Button size="icon" variant="ghost" onclick={onSettings}>
								<Settings class="h-4 w-4" />
							</Button>
						</Tooltip>
					{/if}
				</div>
			</div>
		</div>

		<div class="p-4 space-y-4">
			<div>
				<p class="text-sm font-medium mb-2">Connection</p>
				{@render statusIndicator()}
			</div>

			{#if modelInfo}
				<Separator />
				<div>
					<p class="text-sm font-medium mb-3">Model Information</p>
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Model</span>
							<span class="font-medium">{modelInfo.name}</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Provider</span>
							<span class="font-medium">{modelInfo.provider}</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<span class="text-muted-foreground">Context</span>
							<span class="font-medium"
								>{modelInfo.contextLength.toLocaleString()} tokens</span
							>
						</div>
						{#if modelInfo.costPer1kTokens}
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Cost/1k tokens</span>
								<span class="font-medium">
									${modelInfo.costPer1kTokens.input} / ${modelInfo.costPer1kTokens
										.output}
								</span>
							</div>
						{/if}
					</div>

					<div class="mt-3">
						<p class="text-xs font-medium text-muted-foreground mb-2">Capabilities</p>
						<div class="flex flex-wrap gap-1">
							{#each modelInfo.capabilities as capability (capability)}
								<Tooltip content={capabilityLabels[capability]}>
									<div
										class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
									>
										{#if capability === "chat"}
											<Bot class="h-3 w-3" />
										{:else if capability === "code"}
											<Brain class="h-3 w-3" />
										{:else if capability === "vision"}
											<Sparkles class="h-3 w-3" />
										{:else if capability === "function-calling"}
											<Zap class="h-3 w-3" />
										{:else}
											<MemoryStick class="h-3 w-3" />
										{/if}
										<span class="capitalize"
											>{capability.replace("-", " ")}</span
										>
									</div>
								</Tooltip>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if systemResources}
				<Separator />
				<div>
					<p class="text-sm font-medium mb-3">System Resources</p>
					<div class="space-y-3">
						{@render resourceMeter("CPU", systemResources.cpu, "%", 80)}
						{@render resourceMeter("Memory", systemResources.memory, "%", 80)}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-1 text-muted-foreground">
								<Cloud class="h-3 w-3" />
								<span>Latency</span>
							</div>
							<span
								class={cn(
									"font-medium",
									systemResources.latency > 300 && "text-orange-500"
								)}
							>
								{systemResources.latency}ms
							</span>
						</div>
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-1 text-muted-foreground">
								<CircleDot class="h-3 w-3" />
								<span>Uptime</span>
							</div>
							<span class="font-medium">{systemResources.uptime}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
