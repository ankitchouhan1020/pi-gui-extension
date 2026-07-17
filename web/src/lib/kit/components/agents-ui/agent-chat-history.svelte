<script lang="ts" module>
	export type ChatMessage = {
		id: string;
		role: "user" | "assistant";
		content: string;
		timestamp: Date;
		tokens?: number;
		model?: string;
	};

	export type ChatSession = {
		id: string;
		title: string;
		messages: ChatMessage[];
		createdAt: Date;
		updatedAt: Date;
		starred?: boolean;
		archived?: boolean;
	};

	export interface AgentChatHistoryProps {
		sessions: ChatSession[];
		selectedSessionId?: string;
		onSelectSession?: (session: ChatSession) => void;
		onDeleteSession?: (sessionId: string) => void;
		onStarSession?: (sessionId: string) => void;
		onArchiveSession?: (sessionId: string) => void;
		onExportSession?: (sessionId: string) => void;
		class?: string;
	}

	function formatDate(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return "Today";
		} else if (days === 1) {
			return "Yesterday";
		} else if (days < 7) {
			return `${days} days ago`;
		} else {
			return date.toLocaleDateString();
		}
	}
</script>

<script lang="ts">
	import Archive from "@lucide/svelte/icons/archive";
	import Bot from "@lucide/svelte/icons/bot";
	import Download from "@lucide/svelte/icons/download";
	import Filter from "@lucide/svelte/icons/filter";
	import MoreVertical from "@lucide/svelte/icons/more-vertical";
	import Search from "@lucide/svelte/icons/search";
	import Star from "@lucide/svelte/icons/star";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import User from "@lucide/svelte/icons/user";
	import { DropdownMenu } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { inputClass } from "./_btn.js";
	import { Button, ScrollArea } from "./_ui/index.js";

	let {
		sessions,
		selectedSessionId,
		onSelectSession,
		onDeleteSession,
		onStarSession,
		onArchiveSession,
		onExportSession,
		class: className,
	}: AgentChatHistoryProps = $props();

	let searchQuery = $state("");
	let filter = $state<"all" | "starred" | "archived">("all");
	const showMessages = true;

	const menuContentClass =
		"bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md";
	const menuItemClass =
		"focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
	const menuLabelClass = "px-2 py-1.5 text-sm font-semibold";
	const menuSepClass = "bg-border -mx-1 my-1 h-px";

	const filteredSessions = $derived(
		sessions.filter((session) => {
			if (filter === "starred" && !session.starred) return false;
			if (filter === "archived" && !session.archived) return false;

			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const titleMatch = session.title.toLowerCase().includes(query);
				const messageMatch = session.messages.some((msg) =>
					msg.content.toLowerCase().includes(query)
				);
				return titleMatch || messageMatch;
			}

			return true;
		})
	);

	const selectedSession = $derived(sessions.find((s) => s.id === selectedSessionId));

	const filterLabel = $derived(
		filter === "all" ? "All" : filter === "starred" ? "Starred" : "Archived"
	);
</script>

<div class={cn("flex h-full", className)}>
	<div class="w-80 border-r flex flex-col">
		<div class="p-4 border-b space-y-3">
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
				/>
				<input
					placeholder="Search conversations..."
					value={searchQuery}
					oninput={(e) => (searchQuery = (e.currentTarget as HTMLInputElement).value)}
					class={cn(inputClass, "pl-9")}
				/>
			</div>

			<div class="flex items-center gap-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class={cn(
									"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 has-[>svg]:px-2.5"
								)}
							>
								<Filter class="h-3 w-3 mr-1" />
								{filterLabel}
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content class={menuContentClass}>
							<div class={menuLabelClass}>Filter by</div>
							<div class={menuSepClass}></div>
							<DropdownMenu.Item
								class={menuItemClass}
								onSelect={() => (filter = "all")}
							>
								All conversations
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={menuItemClass}
								onSelect={() => (filter = "starred")}
							>
								Starred only
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class={menuItemClass}
								onSelect={() => (filter = "archived")}
							>
								Archived only
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>

				<span class="text-xs text-muted-foreground">
					{filteredSessions.length} conversations
				</span>
			</div>
		</div>

		<ScrollArea class="flex-1">
			<div class="p-2 space-y-1">
				{#each filteredSessions as session (session.id)}
					{@const lastMessage = session.messages[session.messages.length - 1]}
					{@const preview =
						(lastMessage?.content.slice(0, 100) ?? "") +
						((lastMessage?.content.length ?? 0) > 100 ? "..." : "")}
					{@const isSelected = session.id === selectedSessionId}
					<div
						class={cn(
							"group relative p-3 cursor-pointer hover:bg-accent rounded-lg transition-colors",
							isSelected && "bg-accent"
						)}
						onclick={() => onSelectSession?.(session)}
						onkeydown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onSelectSession?.(session);
							}
						}}
						role="button"
						tabindex={0}
					>
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<h4 class="font-medium text-sm truncate">{session.title}</h4>
									{#if session.starred}
										<Star class="h-3 w-3 fill-yellow-500 text-yellow-500" />
									{/if}
								</div>
								<p class="text-xs text-muted-foreground mt-1 line-clamp-2">
									{preview}
								</p>
								<div
									class="flex items-center gap-3 mt-2 text-xs text-muted-foreground"
								>
									<span>{session.messages.length} messages</span>
									<span>{formatDate(session.updatedAt)}</span>
								</div>
							</div>

							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											class={cn(
												"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground size-9 h-8 w-8 opacity-0 group-hover:opacity-100"
											)}
											onclick={(e) => e.stopPropagation()}
										>
											<MoreVertical class="h-4 w-4" />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Portal>
									<DropdownMenu.Content align="end" class={menuContentClass}>
										<DropdownMenu.Item
											class={menuItemClass}
											onSelect={() => onStarSession?.(session.id)}
										>
											<Star class="h-4 w-4 mr-2" />
											{session.starred ? "Unstar" : "Star"}
										</DropdownMenu.Item>
										<DropdownMenu.Item
											class={menuItemClass}
											onSelect={() => onArchiveSession?.(session.id)}
										>
											<Archive class="h-4 w-4 mr-2" />
											{session.archived ? "Unarchive" : "Archive"}
										</DropdownMenu.Item>
										<DropdownMenu.Item
											class={menuItemClass}
											onSelect={() => onExportSession?.(session.id)}
										>
											<Download class="h-4 w-4 mr-2" />
											Export
										</DropdownMenu.Item>
										<div class={menuSepClass}></div>
										<DropdownMenu.Item
											class={cn(menuItemClass, "text-red-600")}
											onSelect={() => onDeleteSession?.(session.id)}
										>
											<Trash2 class="h-4 w-4 mr-2" />
											Delete
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Portal>
							</DropdownMenu.Root>
						</div>
					</div>
				{/each}
			</div>
		</ScrollArea>
	</div>

	{#if selectedSession && showMessages}
		<div class="flex-1 flex flex-col">
			<div class="p-4 border-b">
				<h3 class="font-semibold">{selectedSession.title}</h3>
				<p class="text-sm text-muted-foreground">
					{selectedSession.messages.length} messages • Last updated {formatDate(
						selectedSession.updatedAt
					)}
				</p>
			</div>

			<ScrollArea class="flex-1">
				<div class="p-4 space-y-2">
					{#each selectedSession.messages as message (message.id)}
						<div class="flex items-start gap-3 p-3 hover:bg-accent/50 rounded-lg">
							<div
								class={cn(
									"rounded-full p-1.5",
									message.role === "user" ? "bg-primary/10" : "bg-secondary"
								)}
							>
								{#if message.role === "user"}
									<User class="h-4 w-4" />
								{:else}
									<Bot class="h-4 w-4" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div
									class="flex items-center gap-2 text-xs text-muted-foreground mb-1"
								>
									<span class="font-medium capitalize">{message.role}</span>
									<span>•</span>
									<span>{message.timestamp.toLocaleTimeString()}</span>
									{#if message.tokens}
										<span>•</span>
										<span>{message.tokens} tokens</span>
									{/if}
								</div>
								<p class="text-sm line-clamp-3">{message.content}</p>
							</div>
						</div>
					{/each}
				</div>
			</ScrollArea>
		</div>
	{/if}
</div>
