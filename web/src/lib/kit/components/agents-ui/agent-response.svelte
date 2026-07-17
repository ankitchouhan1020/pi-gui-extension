<script lang="ts" module>
	export type ToolCall = {
		id: string;
		name: string;
		input: unknown;
		output?: unknown;
		status: "pending" | "running" | "completed" | "failed";
		duration?: number;
	};

	export type Artifact = {
		id: string;
		type: "code" | "file" | "image" | "data";
		name: string;
		content: string;
		language?: string;
		size?: string;
	};

	export interface AgentResponseProps {
		message: string;
		thinking?: string;
		toolCalls?: ToolCall[];
		artifacts?: Artifact[];
		isStreaming?: boolean;
		class?: string;
		onRegenerate?: () => void;
		onCopy?: () => void;
	}
</script>

<script lang="ts">
	import Bot from "@lucide/svelte/icons/bot";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import Copy from "@lucide/svelte/icons/copy";
	import Download from "@lucide/svelte/icons/download";
	import FileCode from "@lucide/svelte/icons/file-code";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Terminal from "@lucide/svelte/icons/terminal";
	import Wrench from "@lucide/svelte/icons/wrench";
	import { Collapsible } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import CodeBlockCode from "$lib/components/prompt-kit/code-block-code.svelte";
	import Markdown from "$lib/components/prompt-kit/markdown.svelte";
	import { Button } from "./_ui/index.js";

	let {
		message,
		thinking,
		toolCalls = [],
		artifacts = [],
		isStreaming = false,
		class: className,
		onRegenerate,
		onCopy,
	}: AgentResponseProps = $props();

	let showThinking = $state(false);
	let expandedTools = $state<Record<string, boolean>>({});

	const statusColors = {
		pending: "text-muted-foreground",
		running: "text-blue-500",
		completed: "text-green-500",
		failed: "text-red-500",
	} as const;

	function toggleTool(id: string) {
		expandedTools = { ...expandedTools, [id]: !expandedTools[id] };
	}
</script>

<div class={cn("space-y-4 p-4", className)}>
	<div class="flex items-start gap-3">
		<div class="rounded-full bg-primary/10 p-2">
			<Bot class="h-5 w-5 text-primary" />
		</div>
		<div class="flex-1 space-y-3">
			{#if thinking}
				<Collapsible.Root bind:open={showThinking}>
					<Collapsible.Trigger
						class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ChevronRight
							class={cn("h-3 w-3 transition-transform", showThinking && "rotate-90")}
						/>
						View thinking process
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-2">
						<div class="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
							{thinking}
						</div>
					</Collapsible.Content>
				</Collapsible.Root>
			{/if}

			{#if toolCalls.length > 0}
				<div class="space-y-2">
					<p class="text-sm font-medium">Tool Usage:</p>
					{#each toolCalls as toolCall (toolCall.id)}
						{@const isExpanded = !!expandedTools[toolCall.id]}
						<div class="rounded-lg border bg-muted/30 p-3">
							<button
								type="button"
								onclick={() => toggleTool(toolCall.id)}
								class="flex w-full items-center justify-between text-left"
							>
								<div class="flex items-center gap-2">
									<Wrench class={cn("h-4 w-4", statusColors[toolCall.status])} />
									<span class="font-medium text-sm">{toolCall.name}</span>
									{#if toolCall.duration}
										<span class="text-xs text-muted-foreground">
											({toolCall.duration}ms)
										</span>
									{/if}
								</div>
								{#if isExpanded}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
							</button>

							{#if isExpanded}
								<div class="mt-3 space-y-2">
									<div>
										<p class="text-xs font-medium text-muted-foreground mb-1">Input:</p>
										<pre class="rounded bg-background p-2 text-xs overflow-x-auto">
{JSON.stringify(toolCall.input, null, 2)}</pre>
									</div>
									{#if toolCall.output}
										<div>
											<p class="text-xs font-medium text-muted-foreground mb-1">
												Output:
											</p>
											<pre class="rounded bg-background p-2 text-xs overflow-x-auto">
{JSON.stringify(toolCall.output, null, 2)}</pre>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="prose prose-sm dark:prose-invert max-w-none">
				<Markdown children={message} />
				{#if isStreaming}
					<span class="inline-block w-1 h-4 bg-foreground animate-pulse ml-1"></span>
				{/if}
			</div>

			{#if artifacts.length > 0}
				<div class="space-y-2">
					<p class="text-sm font-medium">Generated Artifacts:</p>
					{#each artifacts as artifact (artifact.id)}
						<div class="rounded-lg border bg-card overflow-hidden">
							<div class="flex items-center justify-between p-3 border-b bg-muted/30">
								<div class="flex items-center gap-2">
									{#if artifact.type === "code"}
										<FileCode class="h-4 w-4" />
									{:else}
										<Terminal class="h-4 w-4" />
									{/if}
									<span class="font-medium text-sm">{artifact.name}</span>
									{#if artifact.size}
										<span class="text-xs text-muted-foreground">({artifact.size})</span>
									{/if}
								</div>
								<Button size="icon" variant="ghost" class="h-8 w-8">
									<Download class="h-4 w-4" />
								</Button>
							</div>
							<div class="max-h-96 overflow-auto">
								{#if artifact.type === "code"}
									<CodeBlockCode
										code={artifact.content}
										language={artifact.language || "plaintext"}
										class="rounded-none border-0"
									/>
								{:else}
									<pre class="p-4 text-sm font-mono">{artifact.content}</pre>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if !isStreaming && (onRegenerate || onCopy)}
				<div class="flex items-center gap-2 pt-2">
					{#if onRegenerate}
						<Button size="sm" variant="ghost" onclick={onRegenerate} class="h-8 text-xs">
							<RefreshCw class="h-3 w-3 mr-1" />
							Regenerate
						</Button>
					{/if}
					{#if onCopy}
						<Button size="sm" variant="ghost" onclick={onCopy} class="h-8 text-xs">
							<Copy class="h-3 w-3 mr-1" />
							Copy
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
