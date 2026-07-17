<script lang="ts">
  import ChatContainerRoot from "$lib/components/prompt-kit/chat-container.svelte";
  import ChatContainerContent from "$lib/components/prompt-kit/chat-container-content.svelte";
  import ChatContainerScrollAnchor from "$lib/components/prompt-kit/chat-container-scroll-anchor.svelte";
  import Message from "$lib/components/prompt-kit/message.svelte";
  import MessageContent from "$lib/components/prompt-kit/message-content.svelte";
  import ScrollButton from "$lib/components/prompt-kit/scroll-button.svelte";
  import { cn } from "$lib/utils.js";
  import { scrollBottomMessages } from "./_deps/messages.js";
</script>

<div class="relative flex h-screen flex-1 flex-col overflow-hidden">
  <ChatContainerRoot class="h-full overflow-y-auto">
    <ChatContainerContent class="space-y-12 px-4 py-12">
      {#each scrollBottomMessages as message (message.id)}
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
      <ChatContainerScrollAnchor />
    </ChatContainerContent>

    <div class="absolute right-7 bottom-4 z-10">
      <ScrollButton
        class="bg-primary hover:bg-primary/90 shadow-sm"
        variant="default"
        size="icon"
      />
    </div>
  </ChatContainerRoot>
</div>
