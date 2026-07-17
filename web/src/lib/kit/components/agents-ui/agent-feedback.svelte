<script lang="ts" module>
	export type FeedbackType = "positive" | "negative" | "neutral";
	export type FeedbackCategory = "accuracy" | "helpfulness" | "speed" | "clarity" | "other";

	export interface FeedbackData {
		type: FeedbackType;
		rating?: number;
		categories?: FeedbackCategory[];
		comment?: string;
		timestamp?: Date;
	}

	export interface AgentFeedbackProps {
		onSubmit?: (feedback: FeedbackData) => void;
		onThumbsUp?: () => void;
		onThumbsDown?: () => void;
		onReport?: (reason: string) => void;
		showDetailedFeedback?: boolean;
		showQuickActions?: boolean;
		defaultExpanded?: boolean;
		class?: string;
	}

	const categoryLabels: Record<FeedbackCategory, string> = {
		accuracy: "Accuracy",
		helpfulness: "Helpfulness",
		speed: "Response Speed",
		clarity: "Clarity",
		other: "Other",
	};

	const categoryDescriptions: Record<FeedbackCategory, string> = {
		accuracy: "Information was correct and factual",
		helpfulness: "Response addressed my needs",
		speed: "Got a response quickly",
		clarity: "Easy to understand",
		other: "Other feedback",
	};
</script>

<script lang="ts">
	import AlertCircle from "@lucide/svelte/icons/alert-circle";
	import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import Flag from "@lucide/svelte/icons/flag";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
	import { cn } from "$lib/utils.js";
	import { textareaClass } from "./_btn.js";
	import { Button, Tooltip } from "./_ui/index.js";

	let {
		onSubmit,
		onThumbsUp,
		onThumbsDown,
		onReport,
		showDetailedFeedback = true,
		showQuickActions = true,
		defaultExpanded = false,
		class: className,
	}: AgentFeedbackProps = $props();

	let feedbackType = $state<FeedbackType | null>(null);
	// intentional: uncontrolled initial
	// svelte-ignore state_referenced_locally
	let isExpanded = $state(defaultExpanded);
	let selectedCategories = $state<FeedbackCategory[]>([]);
	let comment = $state("");
	let isSubmitted = $state(false);
	let showReportDialog = $state(false);
	let reportReason = $state("");

	function handleThumbsUp() {
		feedbackType = "positive";
		onThumbsUp?.();
		if (!showDetailedFeedback) {
			handleSubmit("positive");
		} else {
			isExpanded = true;
		}
	}

	function handleThumbsDown() {
		feedbackType = "negative";
		onThumbsDown?.();
		if (!showDetailedFeedback) {
			handleSubmit("negative");
		} else {
			isExpanded = true;
		}
	}

	function toggleCategory(category: FeedbackCategory) {
		selectedCategories = selectedCategories.includes(category)
			? selectedCategories.filter((c) => c !== category)
			: [...selectedCategories, category];
	}

	function handleSubmit(type?: FeedbackType) {
		const feedback: FeedbackData = {
			type: type || feedbackType || "neutral",
			categories: selectedCategories,
			comment: comment.trim(),
			timestamp: new Date(),
		};

		onSubmit?.(feedback);
		isSubmitted = true;

		setTimeout(() => {
			isSubmitted = false;
			isExpanded = false;
			feedbackType = null;
			selectedCategories = [];
			comment = "";
		}, 2000);
	}

	function handleReport() {
		if (reportReason.trim()) {
			onReport?.(reportReason);
			showReportDialog = false;
			reportReason = "";
		}
	}

	const categoryEntries = Object.entries(categoryLabels) as [FeedbackCategory, string][];
</script>

{#if isSubmitted}
	<div class={cn("rounded-lg border bg-card p-4 text-center", className)}>
		<CheckCircle2 class="h-8 w-8 text-green-500 mx-auto mb-2" />
		<p class="font-medium">Thank you for your feedback!</p>
		<p class="text-sm text-muted-foreground mt-1">Your input helps us improve</p>
	</div>
{:else}
	<div class={cn("rounded-lg border bg-card", className)}>
		{#if showQuickActions}
			<div class="p-4 border-b">
				<div class="flex items-center justify-between">
					<p class="text-sm font-medium">Was this response helpful?</p>

					<div class="flex items-center gap-2">
						<Tooltip content="Helpful">
							<Button
								size="sm"
								variant={feedbackType === "positive" ? "default" : "outline"}
								onclick={handleThumbsUp}
								class="h-8"
							>
								<ThumbsUp class="h-4 w-4" />
							</Button>
						</Tooltip>

						<Tooltip content="Not helpful">
							<Button
								size="sm"
								variant={feedbackType === "negative" ? "default" : "outline"}
								onclick={handleThumbsDown}
								class="h-8"
							>
								<ThumbsDown class="h-4 w-4" />
							</Button>
						</Tooltip>

						{#if showDetailedFeedback}
							<Tooltip content={isExpanded ? "Hide details" : "More feedback options"}>
								<Button
									size="sm"
									variant="ghost"
									onclick={() => (isExpanded = !isExpanded)}
									class="h-8"
								>
									{#if isExpanded}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</Button>
							</Tooltip>
						{/if}

						{#if onReport}
							<Tooltip content="Report issue">
								<Button
									size="sm"
									variant="ghost"
									onclick={() => (showReportDialog = true)}
									class="h-8 text-red-600 hover:text-red-700"
								>
									<Flag class="h-4 w-4" />
								</Button>
							</Tooltip>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if showDetailedFeedback && isExpanded}
			<div class="p-4 space-y-4">
				<div>
					<p class="text-sm font-medium mb-3">
						What aspects were {feedbackType === "positive" ? "good" : "problematic"}?
					</p>
					<div class="flex flex-wrap gap-2">
						{#each categoryEntries as [category, label] (category)}
							{@const isSelected = selectedCategories.includes(category)}
							<Tooltip content={categoryDescriptions[category]}>
								<Button
									size="sm"
									variant={isSelected ? "default" : "outline"}
									onclick={() => toggleCategory(category)}
									class="h-8"
								>
									{#if isSelected}
										<CheckCircle2 class="h-3 w-3 mr-1" />
									{/if}
									{label}
								</Button>
							</Tooltip>
						{/each}
					</div>
				</div>

				<div>
					<label class="text-sm font-medium mb-2 block" for="agent-feedback-comment">
						Additional comments (optional)
					</label>
					<textarea
						id="agent-feedback-comment"
						value={comment}
						oninput={(e) => (comment = (e.currentTarget as HTMLTextAreaElement).value)}
						placeholder="Share more details about your experience..."
						class={cn(textareaClass, "min-h-[80px] resize-none")}
						rows={3}
					></textarea>
				</div>

				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={() => {
							isExpanded = false;
							selectedCategories = [];
							comment = "";
						}}
					>
						Cancel
					</Button>
					<Button
						onclick={() => handleSubmit()}
						disabled={!feedbackType && selectedCategories.length === 0 && !comment}
					>
						<MessageSquare class="h-4 w-4 mr-2" />
						Submit Feedback
					</Button>
				</div>
			</div>
		{/if}

		{#if showReportDialog}
			<div class="p-4 border-t bg-red-50 dark:bg-red-950/20">
				<div class="flex items-start gap-3">
					<AlertCircle class="h-5 w-5 text-red-600 mt-0.5" />
					<div class="flex-1 space-y-3">
						<div>
							<h4 class="font-medium text-sm">Report an issue</h4>
							<p class="text-sm text-muted-foreground mt-1">
								Help us understand what went wrong
							</p>
						</div>

						<textarea
							value={reportReason}
							oninput={(e) =>
								(reportReason = (e.currentTarget as HTMLTextAreaElement).value)}
							placeholder="Describe the issue (e.g., harmful content, incorrect information, etc.)"
							class={cn(textareaClass, "min-h-[80px] resize-none")}
							rows={3}
						></textarea>

						<div class="flex justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									showReportDialog = false;
									reportReason = "";
								}}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onclick={handleReport}
								disabled={!reportReason.trim()}
							>
								Submit Report
							</Button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
