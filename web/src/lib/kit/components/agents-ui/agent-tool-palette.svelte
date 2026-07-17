<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type ToolCategory = "all" | "data" | "creative" | "utility" | "communication";

	export interface AgentTool {
		id: string;
		name: string;
		description: string;
		category: ToolCategory;
		icon?: Snippet;
		enabled?: boolean;
		usageCount?: number;
		lastUsed?: Date;
		parameters?: {
			name: string;
			type: string;
			required: boolean;
			description?: string;
		}[];
	}

	export interface AgentToolPaletteProps {
		tools: AgentTool[];
		onToolClick?: (tool: AgentTool) => void;
		onToolToggle?: (toolId: string, enabled: boolean) => void;
		showUsageStats?: boolean;
		gridView?: boolean;
		class?: string;
	}

	function formatLastUsed(date: Date) {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));

		if (hours < 1) return "Just now";
		if (hours < 24) return `${hours}h ago`;

		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;

		return date.toLocaleDateString();
	}

	function iconKey(name: string): string {
		const nameLC = name.toLowerCase();
		for (const key of [
			"search",
			"code",
			"database",
			"image",
			"video",
			"music",
			"write",
			"web",
			"file",
			"terminal",
			"chat",
		]) {
			if (nameLC.includes(key)) return key;
		}
		return "default";
	}
</script>

<script lang="ts">
	import Code from "@lucide/svelte/icons/code";
	import Database from "@lucide/svelte/icons/database";
	import FileSearch from "@lucide/svelte/icons/file-search";
	import Globe from "@lucide/svelte/icons/globe";
	import Image from "@lucide/svelte/icons/image";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Music from "@lucide/svelte/icons/music";
	import PenTool from "@lucide/svelte/icons/pen-tool";
	import Search from "@lucide/svelte/icons/search";
	import Settings from "@lucide/svelte/icons/settings";
	import Terminal from "@lucide/svelte/icons/terminal";
	import Video from "@lucide/svelte/icons/video";
	import Zap from "@lucide/svelte/icons/zap";
	import { Tabs } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { inputClass } from "./_btn.js";
	import { Badge, Button, Tooltip } from "./_ui/index.js";

	let {
		tools,
		onToolClick,
		onToolToggle,
		showUsageStats = false,
		gridView = true,
		class: className,
	}: AgentToolPaletteProps = $props();

	let searchQuery = $state("");
	let selectedCategory = $state<ToolCategory>("all");

	const categories: { value: ToolCategory; label: string }[] = [
		{ value: "all", label: "All Tools" },
		{ value: "data", label: "Data" },
		{ value: "creative", label: "Creative" },
		{ value: "utility", label: "Utility" },
		{ value: "communication", label: "Communication" },
	];

	const filteredTools = $derived(
		tools.filter((tool) => {
			const matchesSearch =
				searchQuery === "" ||
				tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tool.description.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesCategory =
				selectedCategory === "all" || tool.category === selectedCategory;

			return matchesSearch && matchesCategory;
		})
	);

	const sortedTools = $derived(
		[...filteredTools].sort((a, b) => {
			if (a.enabled !== false && b.enabled === false) return -1;
			if (a.enabled === false && b.enabled !== false) return 1;

			if (
				showUsageStats &&
				a.usageCount !== undefined &&
				b.usageCount !== undefined
			) {
				return b.usageCount - a.usageCount;
			}

			return 0;
		})
	);

	const tabsListClass =
		"inline-flex h-10 w-full items-center justify-start border-b border-zinc-200 bg-transparent text-zinc-900 dark:border-zinc-800 dark:text-zinc-50";
	const tabsTriggerClass =
		"ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white";
</script>

{#snippet toolIcon(tool: AgentTool)}
	{#if tool.icon}
		{@render tool.icon()}
	{:else}
		{@const key = iconKey(tool.name)}
		{#if key === "search"}
			<Search class="h-5 w-5" />
		{:else if key === "code"}
			<Code class="h-5 w-5" />
		{:else if key === "database"}
			<Database class="h-5 w-5" />
		{:else if key === "image"}
			<Image class="h-5 w-5" />
		{:else if key === "video"}
			<Video class="h-5 w-5" />
		{:else if key === "music"}
			<Music class="h-5 w-5" />
		{:else if key === "write"}
			<PenTool class="h-5 w-5" />
		{:else if key === "web"}
			<Globe class="h-5 w-5" />
		{:else if key === "file"}
			<FileSearch class="h-5 w-5" />
		{:else if key === "terminal"}
			<Terminal class="h-5 w-5" />
		{:else if key === "chat"}
			<MessageSquare class="h-5 w-5" />
		{:else}
			<Zap class="h-5 w-5" />
		{/if}
	{/if}
{/snippet}

{#snippet toolCard(tool: AgentTool)}
	{#if !gridView}
		<div
			class={cn(
				"flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
				tool.enabled !== false ? "hover:bg-accent" : "opacity-50"
			)}
			onclick={tool.enabled !== false ? () => onToolClick?.(tool) : undefined}
			onkeydown={(e) => {
				if ((e.key === "Enter" || e.key === " ") && tool.enabled !== false) {
					e.preventDefault();
					onToolClick?.(tool);
				}
			}}
			role="button"
			tabindex={tool.enabled !== false ? 0 : -1}
		>
			<div
				class={cn(
					"rounded-lg p-2",
					tool.enabled !== false
						? "bg-primary/10 text-primary"
						: "bg-muted text-muted-foreground"
				)}
			>
				{@render toolIcon(tool)}
			</div>

			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<h4 class="font-medium text-sm">{tool.name}</h4>
					{#if tool.enabled === false}
						<Badge variant="secondary" class="text-xs">Disabled</Badge>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground line-clamp-1">{tool.description}</p>

				{#if showUsageStats}
					<div class="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
						{#if tool.usageCount !== undefined}
							<span>Used {tool.usageCount} times</span>
						{/if}
						{#if tool.lastUsed}
							<span>Last: {formatLastUsed(tool.lastUsed)}</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if onToolToggle}
				<Button
					size="sm"
					variant={tool.enabled !== false ? "ghost" : "outline"}
					onclick={(e) => {
						e.stopPropagation();
						onToolToggle(tool.id, tool.enabled !== false);
					}}
				>
					{tool.enabled !== false ? "Disable" : "Enable"}
				</Button>
			{/if}
		</div>
	{:else}
		{@const paramLines =
			tool.parameters && tool.parameters.length > 0
				? "\nParameters:\n" +
					tool.parameters
						.map(
							(p) =>
								`${p.name} (${p.type})${p.required ? " *" : ""}`
						)
						.join("\n")
				: ""}
		{@const tip = `${tool.name}\n${tool.description}${paramLines}`}
		<Tooltip content={tip} side="bottom" class="max-w-xs">
			<div
				class={cn(
					"relative group cursor-pointer rounded-lg border p-4 transition-all",
					tool.enabled !== false
						? "hover:border-primary hover:shadow-md"
						: "opacity-50 cursor-not-allowed"
				)}
				onclick={tool.enabled !== false ? () => onToolClick?.(tool) : undefined}
				onkeydown={(e) => {
					if ((e.key === "Enter" || e.key === " ") && tool.enabled !== false) {
						e.preventDefault();
						onToolClick?.(tool);
					}
				}}
				role="button"
				tabindex={tool.enabled !== false ? 0 : -1}
			>
				<div class="flex flex-col items-center text-center space-y-2">
					<div
						class={cn(
							"rounded-lg p-3",
							tool.enabled !== false
								? "bg-primary/10 text-primary"
								: "bg-muted text-muted-foreground"
						)}
					>
						{@render toolIcon(tool)}
					</div>

					<div>
						<h4 class="font-medium text-sm">{tool.name}</h4>
						{#if showUsageStats && tool.usageCount !== undefined}
							<p class="text-xs text-muted-foreground mt-1">
								{tool.usageCount} uses
							</p>
						{/if}
					</div>

					{#if tool.enabled === false}
						<Badge variant="secondary" class="absolute top-2 right-2 text-xs">
							Disabled
						</Badge>
					{/if}
				</div>

				{#if onToolToggle}
					<div
						class="absolute inset-x-0 bottom-0 p-2 bg-background/95 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg border-t"
					>
						<Button
							size="sm"
							variant={tool.enabled !== false ? "ghost" : "outline"}
							class="w-full h-7 text-xs"
							onclick={(e) => {
								e.stopPropagation();
								onToolToggle(tool.id, tool.enabled !== false);
							}}
						>
							{tool.enabled !== false ? "Disable" : "Enable"}
						</Button>
					</div>
				{/if}
			</div>
		</Tooltip>
	{/if}
{/snippet}

<div class={cn("space-y-4 p-4", className)}>
	<div class="flex items-center justify-between">
		<h3 class="font-semibold text-lg">Available Tools</h3>
		<div class="flex items-center gap-2">
			<Button size="icon" variant="ghost" class="h-8 w-8">
				<Settings class="h-4 w-4" />
			</Button>
		</div>
	</div>

	<div class="relative">
		<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
		<input
			placeholder="Search tools..."
			value={searchQuery}
			oninput={(e) => (searchQuery = (e.currentTarget as HTMLInputElement).value)}
			class={cn(inputClass, "pl-9")}
		/>
	</div>

	<Tabs.Root
		value={selectedCategory}
		onValueChange={(v) => {
			if (v) selectedCategory = v as ToolCategory;
		}}
	>
		<Tabs.List class={cn(tabsListClass, "grid grid-cols-5 w-full")}>
			{#each categories as category (category.value)}
				<Tabs.Trigger value={category.value} class={tabsTriggerClass}>
					{category.label}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		<Tabs.Content value={selectedCategory} class="mt-4">
			{#if sortedTools.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					<Zap class="h-12 w-12 mx-auto mb-3 opacity-20" />
					<p>No tools found</p>
					{#if searchQuery}
						<p class="text-sm mt-1">Try adjusting your search</p>
					{/if}
				</div>
			{:else if gridView}
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{#each sortedTools as tool (tool.id)}
						{@render toolCard(tool)}
					{/each}
				</div>
			{:else}
				<div class="space-y-2">
					{#each sortedTools as tool (tool.id)}
						{@render toolCard(tool)}
					{/each}
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>

	<div class="flex items-center justify-between text-sm text-muted-foreground">
		<span>{sortedTools.length} of {tools.length} tools</span>
		<span>{tools.filter((t) => t.enabled !== false).length} enabled</span>
	</div>
</div>
