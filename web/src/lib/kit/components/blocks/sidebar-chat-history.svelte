<script lang="ts">
  import { buttonVariants } from "$lib/components/prompt-kit/button-variants.js";
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import Search from "@lucide/svelte/icons/search";

  const conversationHistory = [
    {
      period: "Today",
      conversations: [
        {
          id: "t1",
          title: "Project Roadmap Discussion",
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
        {
          id: "m2",
          title: "Requirements Gathering",
          lastMessage:
            "The stakeholders approved the feature specifications document.",
          timestamp: new Date().setDate(new Date().getDate() - 22),
        },
        {
          id: "m3",
          title: "Tech Stack Selection",
          lastMessage:
            "We decided on Next.js, Tailwind, and a serverless backend architecture.",
          timestamp: new Date().setDate(new Date().getDate() - 28),
        },
        {
          id: "m4",
          title: "Project Planning",
          lastMessage: "We need to create a project plan for the next sprint.",
          timestamp: new Date().setDate(new Date().getDate() - 30),
        },
        {
          id: "m5",
          title: "Code Review",
          lastMessage: "We need to review the code for the next sprint.",
          timestamp: new Date().setDate(new Date().getDate() - 35),
        },
        {
          id: "m6",
          title: "Bug Discussion",
          lastMessage: "We need to discuss the bugs for the next sprint.",
          timestamp: new Date().setDate(new Date().getDate() - 37),
        },
        {
          id: "m7",
          title: "Project Planning",
          lastMessage: "We need to create a project plan for the next sprint.",
          timestamp: new Date().setDate(new Date().getDate() - 30),
        },
      ],
    },
  ];

  let open = $state(true);

  function toggleSidebar() {
    open = !open;
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
        <div class="bg-muted/50 h-10 w-48 rounded-md"></div>
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto max-w-3xl space-y-4">
          <div class="flex w-full">
            <div class="bg-muted/50 h-12 w-[65%] rounded-xl"></div>
          </div>
          <div class="flex justify-end">
            <div class="bg-muted/50 h-10 w-[45%] rounded-xl"></div>
          </div>
          <div class="flex">
            <div class="bg-muted/50 h-10 w-[70%] rounded-xl"></div>
          </div>
          <div class="flex justify-end">
            <div class="bg-muted/50 h-10 w-[55%] rounded-xl"></div>
          </div>
          <div class="flex">
            <div class="bg-muted/50 h-16 w-[75%] rounded-xl"></div>
          </div>
          <div class="flex justify-end">
            <div class="bg-muted/50 h-10 w-[50%] rounded-xl"></div>
          </div>
          <div class="flex">
            <div class="bg-muted/50 h-16 w-[70%] rounded-xl"></div>
          </div>
          <div class="flex justify-end">
            <div class="bg-muted/50 h-10 w-[60%] rounded-xl"></div>
          </div>
          <div class="flex">
            <div class="bg-muted/50 h-20 w-[75%] rounded-xl"></div>
          </div>
          <div class="flex justify-end">
            <div class="bg-muted/50 h-10 w-[50%] rounded-xl"></div>
          </div>
        </div>
      </div>

      <div class="bg-background z-10 shrink-0 border-t p-4">
        <div class="mx-auto max-w-3xl">
          <div class="bg-muted/50 h-12 w-full rounded-xl"></div>
        </div>
      </div>
    </div>
  </main>
</div>
