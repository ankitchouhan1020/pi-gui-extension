<script lang="ts">
  import PromptInput from "$lib/components/prompt-kit/prompt-input.svelte";
  import PromptInputAction from "$lib/components/prompt-kit/prompt-input-action.svelte";
  import PromptInputActions from "$lib/components/prompt-kit/prompt-input-actions.svelte";
  import PromptInputTextarea from "$lib/components/prompt-kit/prompt-input-textarea.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Globe from "@lucide/svelte/icons/globe";
  import Mic from "@lucide/svelte/icons/mic";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import Plus from "@lucide/svelte/icons/plus";

  let prompt = $state("");
  let isLoading = $state(false);

  function handleSubmit() {
    if (!prompt.trim()) return;
    isLoading = true;
    console.log("Processing:", prompt);
    setTimeout(() => {
      prompt = "";
      isLoading = false;
    }, 1500);
  }
</script>

<div class="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-3 pb-3 md:px-5 md:pb-5">
  <PromptInput
    {isLoading}
    bind:value={prompt}
    onValueChange={(v) => (prompt = v)}
    onSubmit={handleSubmit}
    class="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
  >
    <div class="flex flex-col">
      <PromptInputTextarea
        placeholder="Ask anything"
        class="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
      />

      <PromptInputActions
        class="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3"
      >
        <div class="flex items-center gap-2">
          <PromptInputAction tooltip="Add a new action">
            <button
              type="button"
              class={buttonVariants({
                variant: "outline",
                size: "icon",
                className: "size-9 rounded-full",
              })}
            >
              <Plus size={18} />
            </button>
          </PromptInputAction>

          <PromptInputAction tooltip="Search">
            <button
              type="button"
              class={buttonVariants({
                variant: "outline",
                className: "rounded-full",
              })}
            >
              <Globe size={18} />
              Search
            </button>
          </PromptInputAction>

          <PromptInputAction tooltip="More actions">
            <button
              type="button"
              class={buttonVariants({
                variant: "outline",
                size: "icon",
                className: "size-9 rounded-full",
              })}
            >
              <MoreHorizontal size={18} />
            </button>
          </PromptInputAction>
        </div>
        <div class="flex items-center gap-2">
          <PromptInputAction tooltip="Voice input">
            <button
              type="button"
              class={buttonVariants({
                variant: "outline",
                size: "icon",
                className: "size-9 rounded-full",
              })}
            >
              <Mic size={18} />
            </button>
          </PromptInputAction>

          <button
            type="button"
            disabled={!prompt.trim() || isLoading}
            onclick={handleSubmit}
            class={buttonVariants({
              size: "icon",
              className: "size-9 rounded-full",
            })}
          >
            {#if !isLoading}
              <ArrowUp size={18} />
            {:else}
              <span class="size-3 rounded-xs bg-white"></span>
            {/if}
          </button>
        </div>
      </PromptInputActions>
    </div>
  </PromptInput>
</div>
