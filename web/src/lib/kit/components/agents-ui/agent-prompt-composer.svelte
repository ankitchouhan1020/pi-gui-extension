<script lang="ts" module>
	export type PromptTemplate = {
		id: string;
		name: string;
		prompt: string;
		description?: string;
	};

	export type Persona = {
		id: string;
		name: string;
		avatar?: string;
		systemPrompt: string;
		description?: string;
	};

	export interface AgentPromptComposerProps {
		value?: string;
		onChange?: (value: string) => void;
		onSubmit?: (
			value: string,
			options?: { persona?: Persona; template?: PromptTemplate }
		) => void;
		placeholder?: string;
		disabled?: boolean;
		isLoading?: boolean;
		templates?: PromptTemplate[];
		personas?: Persona[];
		showVoiceInput?: boolean;
		showFileAttachment?: boolean;
		showSettings?: boolean;
		class?: string;
	}
</script>

<script lang="ts">
	import BookTemplate from "@lucide/svelte/icons/book-template";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import FileText from "@lucide/svelte/icons/file-text";
	import Mic from "@lucide/svelte/icons/mic";
	import Paperclip from "@lucide/svelte/icons/paperclip";
	import Send from "@lucide/svelte/icons/send";
	import Settings from "@lucide/svelte/icons/settings";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import User from "@lucide/svelte/icons/user";
	import { DropdownMenu } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { Button, Tooltip } from "./_ui/index.js";

	let {
		value = "",
		onChange,
		onSubmit,
		placeholder = "Ask anything...",
		disabled = false,
		isLoading = false,
		templates = [],
		personas = [],
		showVoiceInput = true,
		showFileAttachment = true,
		showSettings = true,
		class: className,
	}: AgentPromptComposerProps = $props();

	let selectedPersona = $state<Persona | null>(null);
	let isRecording = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	const menuContentClass =
		"bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md";
	const menuItemClass =
		"focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
	const menuLabelClass = "px-2 py-1.5 text-sm font-semibold";
	const menuSepClass = "bg-border -mx-1 my-1 h-px";

	function handleSubmit() {
		if (value.trim() && !disabled && !isLoading) {
			onSubmit?.(value, {
				persona: selectedPersona || undefined,
			});
		}
	}

	function applyTemplate(template: PromptTemplate) {
		onChange?.(template.prompt);
	}

	function selectPersona(persona: Persona | null) {
		selectedPersona = persona;
	}

	function toggleRecording() {
		isRecording = !isRecording;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	$effect(() => {
		// autosize like prompt-input maxHeight 200
		void value;
		if (!textareaEl) return;
		textareaEl.style.height = "auto";
		textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 200)}px`;
	});
</script>

<div class={cn("space-y-3", className)}>
	{#if personas.length > 0}
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
							<User class="h-3 w-3 mr-1" />
							{selectedPersona ? selectedPersona.name : "Default"}
							<ChevronDown class="h-3 w-3 ml-1" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content align="start" class={cn(menuContentClass, "w-64")}>
						<div class={menuLabelClass}>Select Persona</div>
						<div class={menuSepClass}></div>
						<DropdownMenu.Item
							class={menuItemClass}
							onSelect={() => selectPersona(null)}
						>
							<User class="h-4 w-4 mr-2" />
							<div class="flex-1">
								<p class="font-medium">Default</p>
								<p class="text-xs text-muted-foreground">Standard AI assistant</p>
							</div>
						</DropdownMenu.Item>
						{#each personas as persona (persona.id)}
							<DropdownMenu.Item
								class={menuItemClass}
								onSelect={() => selectPersona(persona)}
							>
								<User class="h-4 w-4 mr-2" />
								<div class="flex-1">
									<p class="font-medium">{persona.name}</p>
									{#if persona.description}
										<p class="text-xs text-muted-foreground">
											{persona.description}
										</p>
									{/if}
								</div>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>

			{#if selectedPersona}
				<span class="text-xs text-muted-foreground">
					Using {selectedPersona.name} persona
				</span>
			{/if}
		</div>
	{/if}

	<!-- PromptInput shell (kit-prompt prompt-input not ready) -->
	<div class="border-input bg-background rounded-3xl border p-2 shadow-xs">
		<div class="flex items-end gap-2">
			<div class="flex-1">
				<textarea
					bind:this={textareaEl}
					{value}
					{placeholder}
					{disabled}
					rows={1}
					oninput={(e) => onChange?.((e.currentTarget as HTMLTextAreaElement).value)}
					onkeydown={onKeydown}
					class="text-primary min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-input placeholder:text-muted-foreground flex field-sizing-content rounded-md px-3 py-2 text-base md:text-sm"
				></textarea>
			</div>

			<div class="flex items-center gap-2">
				{#if templates.length > 0}
					<DropdownMenu.Root>
						<Tooltip content="Use template">
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										type="button"
										class={cn(
											"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground size-9 h-8 w-8"
										)}
									>
										<BookTemplate class="h-4 w-4" />
									</button>
								{/snippet}
							</DropdownMenu.Trigger>
						</Tooltip>
						<DropdownMenu.Portal>
							<DropdownMenu.Content align="end" class={cn(menuContentClass, "w-80")}>
								<div class={menuLabelClass}>Prompt Templates</div>
								<div class={menuSepClass}></div>
								{#each templates as template (template.id)}
									<DropdownMenu.Item
										class={menuItemClass}
										onSelect={() => applyTemplate(template)}
									>
										<FileText class="h-4 w-4 mr-2 flex-shrink-0" />
										<div class="flex-1">
											<p class="font-medium">{template.name}</p>
											{#if template.description}
												<p class="text-xs text-muted-foreground">
													{template.description}
												</p>
											{/if}
										</div>
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				{/if}

				{#if showFileAttachment}
					<Tooltip content="Attach file">
						<Button size="icon" variant="ghost" class="h-8 w-8">
							<Paperclip class="h-4 w-4" />
						</Button>
					</Tooltip>
				{/if}

				{#if showVoiceInput}
					<Tooltip content={isRecording ? "Stop recording" : "Start voice input"}>
						<Button
							size="icon"
							variant="ghost"
							class={cn("h-8 w-8", isRecording && "text-red-500")}
							onclick={toggleRecording}
						>
							<Mic class="h-4 w-4" />
						</Button>
					</Tooltip>
				{/if}

				<Tooltip content="Send message">
					<Button
						size="icon"
						disabled={!value.trim() || disabled || isLoading}
						onclick={handleSubmit}
						class="h-8 w-8"
					>
						{#if isLoading}
							<Sparkles class="h-4 w-4 animate-pulse" />
						{:else}
							<Send class="h-4 w-4" />
						{/if}
					</Button>
				</Tooltip>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Button
				size="sm"
				variant="ghost"
				class="h-7 text-xs"
				onclick={() => onChange?.("")}
				disabled={!value || disabled || isLoading}
			>
				Clear
			</Button>
			<Button
				size="sm"
				variant="ghost"
				class="h-7 text-xs"
				onclick={() => {
					const enhanced = `Please provide a detailed analysis of: ${value}`;
					onChange?.(enhanced);
				}}
				disabled={!value || disabled || isLoading}
			>
				<Sparkles class="h-3 w-3 mr-1" />
				Enhance
			</Button>
		</div>

		{#if showSettings}
			<Button size="sm" variant="ghost" class="h-7 text-xs">
				<Settings class="h-3 w-3 mr-1" />
				Settings
			</Button>
		{/if}
	</div>
</div>
