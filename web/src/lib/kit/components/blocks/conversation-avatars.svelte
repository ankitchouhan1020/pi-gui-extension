<script lang="ts">
  import ChatContainerRoot from "$lib/components/prompt-kit/chat-container.svelte";
  import ChatContainerContent from "$lib/components/prompt-kit/chat-container-content.svelte";
  import Message from "$lib/components/prompt-kit/message.svelte";
  import MessageAvatar from "$lib/components/prompt-kit/message-avatar.svelte";
  import MessageContent from "$lib/components/prompt-kit/message-content.svelte";
  import { cn } from "$lib/utils.js";
  import { conversationMessages } from "./_deps/messages.js";
</script>

<ChatContainerRoot class="px-1 py-12 md:px-4">
  <ChatContainerContent class="space-y-12 px-1 py-12 md:px-4">
    {#each conversationMessages as message (message.id)}
      {@const isAssistant = message.role === "assistant"}
      <Message
        class={cn(
          "mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 md:px-6",
          isAssistant ? "items-start" : "items-end"
        )}
      >
        <div
          class={cn(
            "flex w-full items-end gap-3",
            isAssistant ? "flex-row" : "flex-row-reverse"
          )}
        >
          {#if isAssistant}
            <MessageAvatar
              class="mb-0.5 h-6 w-6"
              src="https://prompt-kit.com/logo.png"
              alt="Avatar of the assistant"
            />
            <MessageContent
              class="prose text-primary w-full max-w-[85%] flex-1 overflow-x-auto rounded-lg bg-transparent p-0 py-0 sm:max-w-[75%]"
              markdown
              content={message.content}
            />
          {:else}
            <MessageAvatar
              class="h-6 w-6"
              src="https://github.com/ibelick.png"
              alt="Avatar of the user"
            />
            <MessageContent
              class="bg-secondary text-primary max-w-[85%] sm:max-w-[75%]"
              content={message.content}
            />
          {/if}
        </div>
      </Message>
    {/each}
  </ChatContainerContent>
</ChatContainerRoot>
