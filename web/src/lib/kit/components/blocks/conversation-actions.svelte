<script lang="ts">
  import ChatContainerRoot from "$lib/components/prompt-kit/chat-container.svelte";
  import ChatContainerContent from "$lib/components/prompt-kit/chat-container-content.svelte";
  import Message from "$lib/components/prompt-kit/message.svelte";
  import MessageAction from "$lib/components/prompt-kit/message-action.svelte";
  import MessageActions from "$lib/components/prompt-kit/message-actions.svelte";
  import MessageContent from "$lib/components/prompt-kit/message-content.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import { cn } from "$lib/utils.js";
  import Copy from "@lucide/svelte/icons/copy";
  import Pencil from "@lucide/svelte/icons/pencil";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
  import Trash from "@lucide/svelte/icons/trash";
  import { conversationMessages } from "./_deps/messages.js";
</script>

<ChatContainerRoot class="px-4 py-12">
  <ChatContainerContent>
    {#each conversationMessages as message, index (message.id)}
      {@const isAssistant = message.role === "assistant"}
      {@const isLastMessage = index === conversationMessages.length - 1}
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
