<script lang="ts" module>
	export type InquiryType = "multipleChoice" | "text" | "confirmation" | "scale";

	export interface Inquiry {
		id: string;
		question: string;
		type: InquiryType;
		options?: string[];
		required?: boolean;
	}

	export interface InquiryHistoryItem {
		question: string;
		answer: string;
		timestamp: string;
	}

	export interface AgentInquiryProps {
		agentName?: string;
		taskContext?: string;
		inquiry?: Inquiry;
		inquiryHistory?: InquiryHistoryItem[];
		remainingInquiries?: number;
		class?: string;
		onSubmit?: (inquiryId: string, answer: string) => void;
		onSkip?: (inquiryId: string) => void;
	}
</script>

<script lang="ts">
	import Bot from "@lucide/svelte/icons/bot";
	import Check from "@lucide/svelte/icons/check";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import Send from "@lucide/svelte/icons/send";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Star from "@lucide/svelte/icons/star";
	import User from "@lucide/svelte/icons/user";
	import X from "@lucide/svelte/icons/x";
	import { cn } from "$lib/utils.js";
	import { inputClass } from "./_btn.js";
	import { Badge, Button, Progress, ScrollArea, Tooltip } from "./_ui/index.js";

	let {
		agentName,
		taskContext,
		inquiry,
		inquiryHistory,
		remainingInquiries,
		class: className,
		onSubmit,
		onSkip,
	}: AgentInquiryProps = $props();

	const defaultInquiry: Inquiry = {
		id: "inq-1",
		question: "Which migration strategy do you prefer?",
		type: "multipleChoice",
		options: ["Blue-green deployment", "Rolling migration", "Canary release"],
		required: true,
	};

	const defaultHistory: InquiryHistoryItem[] = [
		{
			question: "Should the migration include legacy tables?",
			answer: "Yes, include all legacy tables",
			timestamp: "2 min ago",
		},
		{
			question: "Preferred maintenance window?",
			answer: "Saturday 02:00-06:00 UTC",
			timestamp: "5 min ago",
		},
	];

	const activeInquiry = $derived(inquiry ?? defaultInquiry);
	const history = $derived(inquiryHistory ?? defaultHistory);
	const remaining = $derived(remainingInquiries ?? 2);
	const agent = $derived(agentName ?? "Migration Agent");
	const context = $derived(taskContext ?? "Database Migration Plan");

	let selected = $state("");
	let textValue = $state("");
	let scaleValue = $state<number | null>(null);
	let hoveredStar = $state<number | null>(null);

	const currentAnswer = $derived(
		activeInquiry.type === "multipleChoice" ||
			activeInquiry.type === "confirmation"
			? selected
			: activeInquiry.type === "scale"
				? scaleValue !== null
					? String(scaleValue)
					: ""
				: textValue
	);

	const canSubmit = $derived(
		activeInquiry.required ? currentAnswer.length > 0 : true
	);
	const totalDecisions = $derived(history.length + remaining + 1);
	const currentStep = $derived(history.length + 1);
	const progressPercent = $derived((currentStep / totalDecisions) * 100);

	function handleSubmit() {
		if (canSubmit) {
			onSubmit?.(activeInquiry.id, currentAnswer);
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && canSubmit) {
			handleSubmit();
		}
	}
</script>

<div
	class={cn(
		"mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-lg",
		className
	)}
>
	<div
		class="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3"
	>
		<div
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900"
		>
			<Bot class="h-4 w-4" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="truncate text-sm font-semibold">{agent}</span>
				<Badge
					class="border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
				>
					Active
				</Badge>
			</div>
			<p class="truncate text-[11px] text-muted-foreground">
				Working on: {context}
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1">
			<span class="text-[11px] font-medium text-muted-foreground">
				Question {currentStep} of {totalDecisions}
			</span>
			<Progress
				value={progressPercent}
				class="h-1.5 w-20 bg-muted [&>div]:bg-zinc-900 dark:[&>div]:bg-zinc-100"
			/>
		</div>
	</div>

	<ScrollArea class="max-h-[420px] min-h-[200px] flex-1">
		<div class="space-y-4 bg-muted/30 px-4 py-4">
			{#if history.length > 0}
				<div class="space-y-3">
					{#each history as item, i (i)}
						<div class="flex max-w-[85%] items-start gap-2.5">
							<div
								class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900"
							>
								<Bot class="h-3.5 w-3.5" />
							</div>
							<div class="relative">
								<div
									class="absolute -left-1.5 top-2.5 h-3 w-3 rotate-45 border-b border-l border-border/40 bg-white dark:bg-muted/60"
								></div>
								<div
									class="relative rounded-2xl rounded-tl-sm border border-border/40 bg-white px-3.5 py-2.5 shadow-sm dark:bg-muted/60"
								>
									<p class="text-sm leading-relaxed text-muted-foreground">
										{item.question}
									</p>
								</div>
								<span
									class="mt-0.5 ml-1 block text-[10px] text-muted-foreground/60"
								>
									{item.timestamp}
								</span>
							</div>
						</div>

						<div
							class="ml-auto flex max-w-[85%] flex-row-reverse items-start gap-2.5"
						>
							<div
								class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-white shadow-sm dark:bg-zinc-400"
							>
								<User class="h-3.5 w-3.5" />
							</div>
							<div class="relative">
								<div
									class="absolute -right-1.5 top-2.5 h-3 w-3 rotate-45 bg-zinc-900 dark:bg-zinc-100"
								></div>
								<div
									class="relative rounded-2xl rounded-tr-sm bg-zinc-900 px-3.5 py-2.5 shadow-sm dark:bg-zinc-100"
								>
									<p
										class="text-sm font-medium leading-relaxed text-white dark:text-zinc-900"
									>
										{item.answer}
									</p>
								</div>
							</div>
						</div>
					{/each}

					<div class="flex items-center gap-3 py-1">
						<div class="h-px flex-1 bg-border/40"></div>
						<span
							class="text-[10px] font-medium tracking-wider text-muted-foreground/50 uppercase"
						>
							Now
						</span>
						<div class="h-px flex-1 bg-border/40"></div>
					</div>
				</div>
			{/if}

			<div class="flex max-w-[85%] items-start gap-2.5">
				<div
					class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm dark:bg-zinc-200 dark:text-zinc-900"
				>
					<Bot class="h-3.5 w-3.5" />
				</div>
				<div class="relative">
					<div
						class="absolute -left-1.5 top-2.5 h-3 w-3 rotate-45 border-b border-l border-border/40 bg-white dark:bg-muted/60"
					></div>
					<div
						class="relative rounded-2xl rounded-tl-sm border border-border/40 bg-white px-3.5 py-2.5 shadow-sm dark:bg-muted/60"
					>
						<p class="text-sm font-medium leading-relaxed">
							{activeInquiry.question}
							{#if activeInquiry.required}
								<span
									class="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500 align-middle"
								></span>
							{/if}
						</p>
					</div>
				</div>
			</div>

			<div class="pl-9">
				{#if activeInquiry.type === "multipleChoice" && activeInquiry.options}
					<div class="flex flex-wrap gap-2">
						{#each activeInquiry.options as option (option)}
							<button
								type="button"
								onclick={() => (selected = option)}
								class={cn(
									"inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
									selected === option
										? "scale-[1.02] border-transparent bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
										: "border-border/60 bg-white text-foreground hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-sm dark:bg-muted/40 dark:hover:bg-zinc-800/50"
								)}
							>
								{#if selected === option}
									<Check class="h-3.5 w-3.5" />
								{/if}
								{option}
							</button>
						{/each}
					</div>
				{/if}

				{#if activeInquiry.type === "scale"}
					<div class="flex flex-col gap-2">
						<div class="flex items-center gap-1">
							{#each Array.from({ length: 5 }, (_, i) => i + 1) as n (n)}
								{@const filled =
									hoveredStar !== null
										? n <= hoveredStar
										: scaleValue !== null && n <= scaleValue}
								<Tooltip content="{n} of 5" side="bottom">
									<button
										type="button"
										onclick={() => (scaleValue = n)}
										onmouseenter={() => (hoveredStar = n)}
										onmouseleave={() => (hoveredStar = null)}
										class="p-1 transition-transform duration-150 hover:scale-110 focus:outline-none"
									>
										<Star
											class={cn(
												"h-7 w-7 transition-colors duration-150",
												filled
													? "fill-amber-400 text-amber-400 drop-shadow-sm"
													: "fill-none text-muted-foreground/30"
											)}
										/>
									</button>
								</Tooltip>
							{/each}
							{#if scaleValue !== null}
								<span class="ml-2 text-xs font-medium text-muted-foreground">
									{scaleValue}/5
								</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if activeInquiry.type === "confirmation"}
					<div class="grid grid-cols-2 gap-3">
						<button
							type="button"
							onclick={() => (selected = "Yes")}
							class={cn(
								"group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all duration-200",
								selected === "Yes"
									? "border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20"
									: "border-border/60 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 dark:bg-muted/30 dark:hover:bg-emerald-900/10"
							)}
						>
							<div
								class={cn(
									"flex h-11 w-11 items-center justify-center rounded-full transition-colors",
									selected === "Yes"
										? "bg-emerald-500 text-white"
										: "bg-muted text-muted-foreground group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:group-hover:bg-emerald-900/40"
								)}
							>
								<Check class="h-5 w-5" />
							</div>
							<span
								class={cn(
									"text-sm font-semibold transition-colors",
									selected === "Yes"
										? "text-emerald-700 dark:text-emerald-300"
										: "text-foreground"
								)}
							>
								Yes, proceed
							</span>
						</button>

						<button
							type="button"
							onclick={() => (selected = "No")}
							class={cn(
								"group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all duration-200",
								selected === "No"
									? "border-red-200 bg-red-50 shadow-sm dark:border-red-800 dark:bg-red-900/20"
									: "border-border/60 bg-white hover:border-red-300 hover:bg-red-50/50 dark:bg-muted/30 dark:hover:bg-red-900/10"
							)}
						>
							<div
								class={cn(
									"flex h-11 w-11 items-center justify-center rounded-full transition-colors",
									selected === "No"
										? "bg-red-500 text-white"
										: "bg-muted text-muted-foreground group-hover:bg-red-100 group-hover:text-red-600 dark:group-hover:bg-red-900/40"
								)}
							>
								<X class="h-5 w-5" />
							</div>
							<span
								class={cn(
									"text-sm font-semibold transition-colors",
									selected === "No"
										? "text-red-700 dark:text-red-300"
										: "text-foreground"
								)}
							>
								No, skip this
							</span>
						</button>
					</div>
				{/if}
			</div>
		</div>
	</ScrollArea>

	{#if activeInquiry.type === "text"}
		<div class="border-t border-border/50 bg-muted/20 px-3 py-3">
			<div
				class="flex items-center gap-2 rounded-full border border-border/60 bg-background py-1 pr-1.5 pl-4 shadow-sm transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-500/30"
			>
				<input
					placeholder="Type your response..."
					bind:value={textValue}
					onkeydown={handleKeyDown}
					class={cn(
						inputClass,
						"h-9 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
					)}
				/>
				<Button
					size="sm"
					disabled={!canSubmit}
					onclick={handleSubmit}
					class={cn(
						"h-8 w-8 shrink-0 rounded-full p-0 transition-all",
						canSubmit
							? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
							: "bg-muted"
					)}
				>
					<Send class="h-4 w-4" />
				</Button>
			</div>
			{#if !activeInquiry.required}
				<button
					type="button"
					onclick={() => onSkip?.(activeInquiry.id)}
					class="mt-2 ml-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<SkipForward class="h-3 w-3" />
					Skip this question
				</button>
			{/if}
		</div>
	{:else}
		<div class="border-t border-border/50 bg-muted/20 px-4 py-3">
			<div class="flex items-center gap-2">
				<Button
					size="sm"
					disabled={!canSubmit}
					onclick={handleSubmit}
					class={cn(
						"h-9 rounded-full px-5 font-medium transition-all",
						canSubmit
							? "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
							: ""
					)}
				>
					<Send class="mr-2 h-4 w-4" />
					Submit answer
				</Button>
				{#if !activeInquiry.required}
					<Button
						size="sm"
						variant="ghost"
						class="h-9 rounded-full text-muted-foreground hover:text-foreground"
						onclick={() => onSkip?.(activeInquiry.id)}
					>
						<SkipForward class="mr-1.5 h-3.5 w-3.5" />
						Skip
					</Button>
				{/if}
				{#if remaining > 0}
					<span
						class="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"
					>
						<ChevronRight class="h-3 w-3" />
						{remaining} more after this
					</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
