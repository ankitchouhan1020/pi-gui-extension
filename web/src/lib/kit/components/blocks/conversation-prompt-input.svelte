<script lang="ts">
  import ChatContainerRoot from "$lib/components/prompt-kit/chat-container.svelte";
  import ChatContainerContent from "$lib/components/prompt-kit/chat-container-content.svelte";
  import Message from "$lib/components/prompt-kit/message.svelte";
  import MessageAction from "$lib/components/prompt-kit/message-action.svelte";
  import MessageActions from "$lib/components/prompt-kit/message-actions.svelte";
  import MessageContent from "$lib/components/prompt-kit/message-content.svelte";
  import PromptInput from "$lib/components/prompt-kit/prompt-input.svelte";
  import PromptInputAction from "$lib/components/prompt-kit/prompt-input-action.svelte";
  import PromptInputActions from "$lib/components/prompt-kit/prompt-input-actions.svelte";
  import PromptInputTextarea from "$lib/components/prompt-kit/prompt-input-textarea.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import { cn } from "$lib/utils.js";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Copy from "@lucide/svelte/icons/copy";
  import Globe from "@lucide/svelte/icons/globe";
  import Mic from "@lucide/svelte/icons/mic";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
  import Trash from "@lucide/svelte/icons/trash";
  import {
    conversationMessages,
    type ChatMessage,
  } from "./_deps/messages.js";

  let prompt = $state("");
  let isLoading = $state(false);
  let chatMessages = $state<ChatMessage[]>([...conversationMessages]);

  function handleSubmit() {
    if (!prompt.trim()) return;
    const text = prompt.trim();
    prompt = "";
    isLoading = true;

    const newUserMessage: ChatMessage = {
      id: chatMessages.length + 1,
      role: "user",
      content: text,
    };
    chatMessages = [...chatMessages, newUserMessage];

    setTimeout(() => {
      const assistantResponse: ChatMessage = {
        id: chatMessages.length + 2,
        role: "assistant",
        content: `This is a response to: "${text}"`,
      };
      chatMessages = [...chatMessages, assistantResponse];
      isLoading = false;
    }, 1500);
  }
</script>

<div class="flex h-screen flex-col overflow-hidden">
  <ChatContainerRoot class="relative flex-1 space-y-0 overflow-y-auto px-4 py-12">
    <ChatContainerContent class="space-y-12 px-4 py-12">
      {#each chatMessages as message, index (message.id)}
        {@const isAssistant = message.role === "assistant"}
        {@const isLastMessage = index === chatMessages.length - 1}
        <Message
          class={cn(
            "mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 md:px-6",
            isAssistant ? "items-start" : "items-end"
          )}
        >
          {#if isAssistant}
            <div class="group flex w-full flex-col gap-0">
              <MessageContent
                class="text-foreground prose w-full flex-1 rounded-lg bg-transparent p-0"
                markdown
                content={message.content}
              />
              <MessageActions
                class={cn(
                  "-ml-2.5 flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                  isLastMessage && "opacity-100"
                )}
              >
                <MessageAction tooltip="Edit">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <Copy />
                  </button>
                </MessageAction>
                <MessageAction tooltip="Upvote">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <ThumbsUp />
                  </button>
                </MessageAction>
                <MessageAction tooltip="Downvote">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <ThumbsDown />
                  </button>
                </MessageAction>
              </MessageActions>
            </div>
          {:else}
            <div class="group flex flex-col items-end gap-1">
              <MessageContent
                class="bg-muted text-primary max-w-[85%] rounded-3xl px-5 py-2.5 sm:max-w-[75%]"
                content={message.content}
              />
              <MessageActions
                class="flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              >
                <MessageAction tooltip="Edit">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <Pencil />
                  </button>
                </MessageAction>
                <MessageAction tooltip="Delete">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <Trash />
                  </button>
                </MessageAction>
                <MessageAction tooltip="Copy">
                  <button
                    type="button"
                    class={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                      className: "rounded-full",
                    })}
                  >
                    <Copy />
                  </button>
                </MessageAction>
              </MessageActions>
            </div>
          {/if}
        </Message>
      {/each}
    </ChatContainerContent>
  </ChatContainerRoot>
  <div
    class="inset-x-0 bottom-0 mx-auto w-full max-w-3xl shrink-0 px-3 pb-3 md:px-5 md:pb-5"
  >
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
</div>
