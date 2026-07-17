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
  import ScrollButton from "$lib/components/prompt-kit/scroll-button.svelte";
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import { cn } from "$lib/utils.js";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Copy from "@lucide/svelte/icons/copy";
  import Globe from "@lucide/svelte/icons/globe";
  import Mic from "@lucide/svelte/icons/mic";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
  import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
  import Trash from "@lucide/svelte/icons/trash";
  import type { ChatMessage } from "./_deps/messages.js";

  const conversationHistory = [
    {
      period: "Today",
      conversations: [
        {
          id: "t1",
          title: "Project roadmap discussion",
          lastMessage:
            "Let's prioritize the authentication features for the next sprint.",
          timestamp: new Date().setHours(new Date().getHours() - 2),
        },
        {
          id: "t2",
          title: "API Documentation Review",
          lastMessage:
            "The endpoint descriptions need more detail about rate limiting.",
          timestamp: new Date().setHours(new Date().getHours() - 5),
        },
        {
          id: "t3",
          title: "Frontend Bug Analysis",
          lastMessage:
            "I found the issue - we need to handle the null state in the user profile component.",
          timestamp: new Date().setHours(new Date().getHours() - 8),
        },
      ],
    },
    {
      period: "Yesterday",
      conversations: [
        {
          id: "y1",
          title: "Database Schema Design",
          lastMessage:
            "Let's add indexes to improve query performance on these tables.",
          timestamp: new Date().setDate(new Date().getDate() - 1),
        },
        {
          id: "y2",
          title: "Performance Optimization",
          lastMessage:
            "The lazy loading implementation reduced initial load time by 40%.",
          timestamp: new Date().setDate(new Date().getDate() - 1),
        },
      ],
    },
    {
      period: "Last 7 days",
      conversations: [
        {
          id: "w1",
          title: "Authentication Flow",
          lastMessage: "We should implement the OAuth2 flow with refresh tokens.",
          timestamp: new Date().setDate(new Date().getDate() - 3),
        },
        {
          id: "w2",
          title: "Component Library",
          lastMessage:
            "These new UI components follow the design system guidelines perfectly.",
          timestamp: new Date().setDate(new Date().getDate() - 5),
        },
        {
          id: "w3",
          title: "UI/UX Feedback",
          lastMessage:
            "The navigation redesign received positive feedback from the test group.",
          timestamp: new Date().setDate(new Date().getDate() - 6),
        },
      ],
    },
    {
      period: "Last month",
      conversations: [
        {
          id: "m1",
          title: "Initial Project Setup",
          lastMessage:
            "All the development environments are now configured consistently.",
          timestamp: new Date().setDate(new Date().getDate() - 15),
        },
      ],
    },
  ];

  const initialMessages: ChatMessage[] = [
    {
      id: 1,
      role: "user",
      content: "Hello! Can you help me with a coding question?",
    },
    {
      id: 2,
      role: "assistant",
      content:
        "Of course! I'd be happy to help with your coding question. What would you like to know?",
    },
    {
      id: 3,
      role: "user",
      content: "How do I create a responsive layout with CSS Grid?",
    },
    {
      id: 4,
      role: "assistant",
      content:
        "Creating a responsive layout with CSS Grid is straightforward. Here's a basic example:\n\n```css\n.container {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));\n  gap: 1rem;\n}\n```\n\nThis creates a grid where:\n- Columns automatically fit as many as possible\n- Each column is at least 250px wide\n- Columns expand to fill available space\n- There's a 1rem gap between items\n\nWould you like me to explain more about how this works?",
    },
  ];

  let open = $state(true);
  let prompt = $state("");
  let isLoading = $state(false);
  let chatMessages = $state<ChatMessage[]>([...initialMessages]);

  function toggleSidebar() {
    open = !open;
  }

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

<!-- ponytail: local sidebar until kit-ui/sidebar lands -->
<div
  data-slot="sidebar-wrapper"
  style="--sidebar-width: 16rem; --sidebar-width-icon: 3rem;"
  class="group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full"
>
  <div
    class="group peer text-sidebar-foreground hidden md:block"
    data-state={open ? "expanded" : "collapsed"}
    data-collapsible={open ? "" : "offcanvas"}
    data-variant="sidebar"
    data-side="left"
    data-slot="sidebar"
  >
    <div
      data-slot="sidebar-gap"
      class="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear {open
        ? ''
        : 'w-0'}"
    ></div>
    <div
      data-slot="sidebar-container"
      class="fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex left-0 {open
        ? ''
        : 'left-[calc(var(--sidebar-width)*-1)]'} border-r"
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="bg-sidebar flex h-full w-full flex-col"
      >
        <div
          data-slot="sidebar-header"
          data-sidebar="header"
          class="flex flex-row items-center justify-between gap-2 px-2 py-4"
        >
          <div class="flex flex-row items-center gap-2 px-2">
            <div class="bg-primary/10 size-8 rounded-md"></div>
            <div class="text-md font-base text-primary tracking-tight">
              zola.chat
            </div>
          </div>
          <button
            type="button"
            class={buttonVariants({ variant: "ghost", className: "size-8" })}
          >
            <Search class="size-4" />
          </button>
        </div>
        <div
          data-slot="sidebar-content"
          data-sidebar="content"
          class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pt-4"
        >
          <div class="px-4">
            <button
              type="button"
              class={buttonVariants({
                variant: "outline",
                className: "mb-4 flex w-full items-center gap-2",
              })}
            >
              <PlusIcon class="size-4" />
              <span>New Chat</span>
            </button>
          </div>
          {#each conversationHistory as group (group.period)}
            <div
              data-slot="sidebar-group"
              data-sidebar="group"
              class="relative flex w-full min-w-0 flex-col p-2"
            >
              <div
                data-slot="sidebar-group-label"
                data-sidebar="group-label"
                class="text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium"
              >
                {group.period}
              </div>
              <ul
                data-slot="sidebar-menu"
                data-sidebar="menu"
                class="flex w-full min-w-0 flex-col gap-1"
              >
                {#each group.conversations as conversation (conversation.id)}
                  <li>
                    <button
                      type="button"
                      data-slot="sidebar-menu-button"
                      data-sidebar="menu-button"
                      class="peer/menu-button flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>span:last-child]:truncate"
                    >
                      <span>{conversation.title}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <main
    data-slot="sidebar-inset"
    class="bg-background relative flex w-full flex-1 flex-col"
  >
    <div class="flex h-screen flex-col overflow-hidden">
      <header
        class="bg-background z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b px-4"
      >
        <button
          type="button"
          data-sidebar="trigger"
          data-slot="sidebar-trigger"
          class={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "size-7 -ml-1",
          })}
          onclick={toggleSidebar}
        >
          <PanelLeftIcon />
          <span class="sr-only">Toggle Sidebar</span>
        </button>
        <div class="text-foreground">Project roadmap discussion</div>
      </header>

      <div class="relative flex-1 overflow-y-auto">
        <ChatContainerRoot class="h-full">
          <ChatContainerContent class="space-y-0 px-5 py-12">
            {#each chatMessages as message, index (message.id)}
              {@const isAssistant = message.role === "assistant"}
              {@const isLastMessage = index === chatMessages.length - 1}
              <Message
                class={cn(
                  "mx-auto flex w-full max-w-3xl flex-col gap-2 px-6",
                  isAssistant ? "items-start" : "items-end"
                )}
              >
                {#if isAssistant}
                  <div class="group flex w-full flex-col gap-0">
                    <MessageContent
                      class="text-foreground prose flex-1 rounded-lg bg-transparent p-0"
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
          <div
            class="absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5"
          >
            <ScrollButton class="shadow-sm" />
          </div>
        </ChatContainerRoot>
      </div>

      <div class="bg-background z-10 shrink-0 px-3 pb-3 md:px-5 md:pb-5">
        <div class="mx-auto max-w-3xl">
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
    </div>
  </main>
</div>
