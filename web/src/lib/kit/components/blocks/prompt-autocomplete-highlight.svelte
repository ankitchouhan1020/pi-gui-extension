<script lang="ts">
  import PromptInput from "$lib/components/prompt-kit/prompt-input.svelte";
  import PromptInputActions from "$lib/components/prompt-kit/prompt-input-actions.svelte";
  import PromptInputTextarea from "$lib/components/prompt-kit/prompt-input-textarea.svelte";
  import PromptSuggestion from "$lib/components/prompt-kit/prompt-suggestion.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";

  const howToPrompts = [
    "How to create a React component",
    "How to optimize website performance",
    "How to implement dark mode in a web app",
    "How to use CSS Grid effectively",
    "How to fetch data from an API in JavaScript",
    "How to build a REST API with Node.js",
    "How to deploy a Next.js application",
    "How to implement authentication in a web app",
  ];

  let inputValue = $state("how to");

  function handlePromptInputValueChange(value: string) {
    inputValue = value;
  }

  function handleSend() {
    console.log("send");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleSend();
    }
  }

  const promptSuggestions = $derived(
    howToPrompts.filter((prompt) =>
      prompt.toLowerCase().includes(inputValue.toLowerCase())
    )
  );
</script>

<div
  class="absolute inset-x-0 mx-auto flex max-w-3xl flex-col items-start justify-center gap-4 p-3 md:p-5"
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
  <div class="w-full space-y-1">
    {#if inputValue.trim() && promptSuggestions.length > 0}
      {#each promptSuggestions as prompt (prompt)}
        <PromptSuggestion
          highlight={inputValue}
          class="flex h-auto flex-wrap text-left"
        >
          {prompt}
        </PromptSuggestion>
      {/each}
    {/if}
  </div>
</div>
