<script lang="ts">
  import ChatContainerRoot from "$lib/components/prompt-kit/chat-container.svelte";
  import ChatContainerContent from "$lib/components/prompt-kit/chat-container-content.svelte";
  import Message from "$lib/components/prompt-kit/message.svelte";
  import MessageContent from "$lib/components/prompt-kit/message-content.svelte";
  import { cn } from "$lib/utils.js";
  import { conversationMessages } from "./_deps/messages.js";
</script>

<ChatContainerRoot class="w-full">
  <ChatContainerContent class="space-y-12 overflow-y-auto px-4 py-12">
    {#each conversationMessages as message (message.id)}
      {@const isAssistant = message.role === "assistant"}
      <Message
        class={cn(
          "mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 md:px-6",
          isAssistant ? "items-start" : "items-end"
        )}
      >
        {#if isAssistant}
          <MessageContent
            class="text-foreground prose w-full flex-1 rounded-lg bg-transparent p-2"
            markdown
            content={message.content}
          />
        {:else}
          <MessageContent
            class="bg-primary text-primary-foreground max-w-[85%] sm:max-w-[75%]"
            content={message.content}
          />
        {/if}
      </Message>
    {/each}
  </ChatContainerContent>
</ChatContainerRoot>
