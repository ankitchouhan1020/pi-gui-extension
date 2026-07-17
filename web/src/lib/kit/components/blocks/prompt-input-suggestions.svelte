<script lang="ts">
  import PromptInput from "$lib/components/prompt-kit/prompt-input.svelte";
  import PromptInputActions from "$lib/components/prompt-kit/prompt-input-actions.svelte";
  import PromptInputTextarea from "$lib/components/prompt-kit/prompt-input-textarea.svelte";
  import PromptSuggestion from "$lib/components/prompt-kit/prompt-suggestion.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import BrainIcon from "@lucide/svelte/icons/brain";

  const suggestionGroups = [
    {
      label: "Summary",
      highlight: "Summarize",
      items: [
        "Summarize a document",
        "Summarize a video",
        "Summarize a podcast",
        "Summarize a book",
      ],
    },
    {
      label: "Code",
      highlight: "Help me",
      items: [
        "Help me write React components",
        "Help me debug code",
        "Help me learn Python",
        "Help me learn SQL",
      ],
    },
    {
      label: "Design",
      highlight: "Design",
      items: [
        "Design a small logo",
        "Design a hero section",
        "Design a landing page",
        "Design a social media post",
      ],
    },
    {
      label: "Research",
      highlight: "Research",
      items: [
        "Research the best practices for SEO",
        "Research the best running shoes",
        "Research the best restaurants in Paris",
        "Research the best AI tools",
      ],
    },
  ];

  let inputValue = $state("");
  let activeCategory = $state("");

  function handleSend() {
    if (inputValue.trim()) {
      console.log("Sending:", inputValue);
      inputValue = "";
      activeCategory = "";
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePromptInputValueChange(value: string) {
    inputValue = value;
    if (value.trim() === "") {
      activeCategory = "";
    }
  }

  const activeCategoryData = $derived(
    suggestionGroups.find((group) => group.label === activeCategory)
  );
  const showCategorySuggestions = $derived(activeCategory !== "");
</script>

<div
  class="absolute inset-x-0 top-1/2 mx-auto flex max-w-3xl -translate-y-1/2 flex-col items-center justify-center gap-4 px-3 pb-3 md:px-5 md:pb-5"
>
  <PromptInput
    class="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
    bind:value={inputValue}
    onValueChange={handlePromptInputValueChange}
    onSubmit={handleSend}
  >
    <PromptInputTextarea
      placeholder="Ask anything..."
      class="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
      onkeydown={handleKeyDown}
    />
    <PromptInputActions class="mt-5 flex w-full items-end justify-end gap-2 px-3 pb-3">
      <button
        type="button"
        class={buttonVariants({ size: "sm", className: "h-9 w-9 rounded-full" })}
        onclick={handleSend}
        disabled={!inputValue.trim()}
      >
        <ArrowUpIcon class="h-4 w-4" />
      </button>
    </PromptInputActions>
  </PromptInput>

  <div class="relative flex w-full flex-col items-center justify-center space-y-2">
    <div class="absolute top-0 left-0 h-[70px] w-full">
      {#if showCategorySuggestions}
        <div class="flex w-full flex-col space-y-1">
          {#each activeCategoryData?.items ?? [] as suggestion (suggestion)}
            <PromptSuggestion
              highlight={activeCategoryData?.highlight}
              onclick={() => {
                inputValue = suggestion;
              }}
            >
              {suggestion}
            </PromptSuggestion>
          {/each}
        </div>
      {:else}
        <div class="relative flex w-full flex-wrap items-stretch justify-start gap-2">
          {#each suggestionGroups as suggestion (suggestion.label)}
            <PromptSuggestion
              onclick={() => {
                activeCategory = suggestion.label;
                inputValue = "";
              }}
              class="capitalize"
            >
              {#snippet children()}
                <BrainIcon class="mr-2 h-4 w-4" />
                {suggestion.label}
              {/snippet}
            </PromptSuggestion>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
