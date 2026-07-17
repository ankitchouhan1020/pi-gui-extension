<script lang="ts">
  import { cn } from "$lib/utils";
  import { badge, btn, inputClass } from "./_btn.js";
  import Search from "@lucide/svelte/icons/search";
  import Globe from "@lucide/svelte/icons/globe";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Shield from "@lucide/svelte/icons/shield";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Copy from "@lucide/svelte/icons/copy";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Filter from "@lucide/svelte/icons/filter";

  export interface SearchResult {
    id: string;
    title: string;
    url: string;
    domain: string;
    snippet: string;
    aiSummary?: string;
    publishedDate?: string;
    credibilityScore?: number;
    relevanceScore?: number;
    imageUrl?: string;
  }

  export interface AgentWebSearchProps {
    query?: string;
    results?: SearchResult[];
    isSearching?: boolean;
    selectedDomains?: string[];
    dateFilter?: "all" | "day" | "week" | "month" | "year";
    onSearch?: (query: string) => void;
    onResultClick?: (result: SearchResult) => void;
    onCopyLink?: (url: string) => void;
    onDomainFilter?: (domains: string[]) => void;
    onDateFilter?: (filter: "all" | "day" | "week" | "month" | "year") => void;
    onRefresh?: () => void;
    showBottomActions?: boolean;
    class?: string;
    timestamp?: string;
  }

  let {
    query = "AI agent interfaces",
    results = [],
    isSearching = false,
    selectedDomains = [],
    dateFilter = "all",
    onSearch,
    onResultClick,
    onCopyLink,
    onDomainFilter,
    onDateFilter,
    onRefresh,
    showBottomActions = true,
    class: className,
    timestamp = "2:34 PM",
  }: AgentWebSearchProps = $props();

  let localQuery = $state("AI agent interfaces");
  let showFilters = $state(false);
  let openMenuId = $state<string | null>(null);

  $effect(() => {
    localQuery = query;
  });

  const defaultResults: SearchResult[] = [
    {
      id: "1",
      title: "Building AI Agent Interfaces with React",
      url: "https://example.com/ai-agents-react",
      domain: "example.com",
      snippet:
        "Learn how to create sophisticated AI agent interfaces using React and modern UI patterns...",
      aiSummary:
        "Comprehensive guide covering component architecture, state management, and real-time updates for AI agent UIs.",
      publishedDate: "2024-01-15",
      credibilityScore: 0.9,
      relevanceScore: 0.95,
    },
    {
      id: "2",
      title: "Best Practices for Agent UI Design",
      url: "https://uxdesign.cc/agent-ui-patterns",
      domain: "uxdesign.cc",
      snippet:
        "Explore the latest patterns and best practices for designing intuitive agent interfaces...",
      aiSummary:
        "Key insights on conversation flows, visual feedback, and user trust in AI agent interactions.",
      publishedDate: "2024-01-10",
      credibilityScore: 0.85,
      relevanceScore: 0.88,
    },
    {
      id: "3",
      title: "Open Source AI Agent Components",
      url: "https://github.com/ai-agents/ui-kit",
      domain: "github.com",
      snippet:
        "A collection of open source React components specifically designed for AI agent applications...",
      aiSummary:
        "Repository featuring 50+ components including chat interfaces, tool palettes, and status indicators.",
      publishedDate: "2024-01-20",
      credibilityScore: 0.95,
      relevanceScore: 0.92,
    },
  ];

  const displayResults = $derived(results.length > 0 ? results : defaultResults);
  const uniqueDomains = $derived(
    Array.from(new Set(displayResults.map((r) => r.domain)))
  );

  function handleSearch() {
    onSearch?.(localQuery);
  }

  function toggleDomain(domain: string) {
    const newDomains = selectedDomains.includes(domain)
      ? selectedDomains.filter((d) => d !== domain)
      : [...selectedDomains, domain];
    onDomainFilter?.(newDomains);
  }

  function getCredibilityColor(score?: number) {
    if (!score) return "text-muted-foreground";
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div class="flex items-center gap-3 text-sm text-muted-foreground">
    <div
      class="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full"
      data-slot="avatar"
    >
      <div
        class="bg-muted flex size-full items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
        data-slot="avatar-fallback"
      >
        <Search class="h-4 w-4" />
      </div>
    </div>
    <span>Web Search Agent</span>
    <span class="text-xs">{timestamp}</span>
  </div>

  <div class="space-y-4">
    <div class="flex gap-2">
      <div class="flex-1 relative">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10"
        />
        <input
          type="text"
          value={localQuery}
          oninput={(e) => (localQuery = (e.currentTarget as HTMLInputElement).value)}
          onkeydown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search..."
          class={cn(inputClass, "pl-10 focus:ring-2 focus:ring-blue-500")}
          disabled={isSearching}
        />
      </div>
      <button
        type="button"
        onclick={handleSearch}
        disabled={isSearching}
        class={btn("default", "default", "bg-blue-600 text-white hover:bg-blue-700 h-9")}
      >
        {#if isSearching}
          <RefreshCw class="h-4 w-4 animate-spin" />
        {:else}
          Search
        {/if}
      </button>
      <button
        type="button"
        class={btn("outline", "icon")}
        onclick={() => (showFilters = !showFilters)}
        title="Toggle filters"
      >
        <Filter class="h-4 w-4" />
      </button>
    </div>

    {#if showFilters}
      <div class="border rounded-lg p-4 space-y-3">
        <div>
          <h4 class="text-sm font-medium mb-2">Date Range</h4>
          <div class="flex flex-wrap gap-2">
            {#each ["all", "day", "week", "month", "year"] as filter}
              <button
                type="button"
                class={badge(dateFilter === filter ? "default" : "outline", "cursor-pointer")}
                onclick={() =>
                  onDateFilter?.(filter as "all" | "day" | "week" | "month" | "year")}
              >
                {filter === "all" ? "Any time" : `Past ${filter}`}
              </button>
            {/each}
          </div>
        </div>
        <div>
          <h4 class="text-sm font-medium mb-2">Domains</h4>
          <div class="flex flex-wrap gap-2">
            {#each uniqueDomains as domain}
              <button
                type="button"
                class={badge(
                  selectedDomains.includes(domain) ? "default" : "outline",
                  "cursor-pointer"
                )}
                onclick={() => toggleDomain(domain)}
              >
                {domain}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if isSearching}
      <div class="flex items-center justify-center py-12">
        <div class="text-center space-y-3">
          <RefreshCw class="h-8 w-8 mx-auto animate-spin text-blue-600" />
          <p class="text-sm text-muted-foreground">Searching the web...</p>
        </div>
      </div>
    {:else}
      <div class="space-y-4">
        {#each displayResults as result (result.id)}
          <div
            class="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
            role="button"
            tabindex="0"
            onclick={() => onResultClick?.(result)}
            onkeydown={(e) => e.key === "Enter" && onResultClick?.(result)}
          >
            <div class="space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-base line-clamp-1 text-foreground">
                    {result.title}
                  </h3>
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe class="h-3 w-3" />
                    <span>{result.domain}</span>
                    {#if result.publishedDate}
                      <span>•</span>
                      <Calendar class="h-3 w-3" />
                      <span>{new Date(result.publishedDate).toLocaleDateString()}</span>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  {#if result.credibilityScore}
                    <Shield
                      class={cn("h-4 w-4", getCredibilityColor(result.credibilityScore))}
                      title="Credibility: {Math.round(result.credibilityScore * 100)}%"
                    />
                  {/if}
                  <div class="relative">
                    <button
                      type="button"
                      class={btn("ghost", "icon", "h-8 w-8")}
                      onclick={(e) => {
                        e.stopPropagation();
                        openMenuId = openMenuId === result.id ? null : result.id;
                      }}
                    >
                      <ExternalLink class="h-4 w-4" />
                    </button>
                    {#if openMenuId === result.id}
                      <div
                        class="absolute right-0 z-50 mt-1 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground p-1 shadow-md"
                        role="menu"
                      >
                        <button
                          type="button"
                          class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent"
                          onclick={(e) => {
                            e.stopPropagation();
                            window.open(result.url, "_blank");
                            openMenuId = null;
                          }}
                        >
                          <ExternalLink class="h-4 w-4 mr-2" />
                          Open in new tab
                        </button>
                        <button
                          type="button"
                          class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent"
                          onclick={(e) => {
                            e.stopPropagation();
                            onCopyLink?.(result.url);
                            openMenuId = null;
                          }}
                        >
                          <Copy class="h-4 w-4 mr-2" />
                          Copy link
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <p class="text-sm text-muted-foreground line-clamp-2">
                {result.snippet}
              </p>

              {#if result.aiSummary}
                <div class="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
                  <p class="text-sm">
                    <span class="font-medium text-blue-600 dark:text-blue-400">AI Summary:</span>
                    {" "}
                    {result.aiSummary}
                  </p>
                </div>
              {/if}

              {#if result.relevanceScore}
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full transition-all"
                      style="width: {result.relevanceScore * 100}%"
                    ></div>
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {Math.round(result.relevanceScore * 100)}% relevant
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="border-t pt-4">
      <p class="text-sm font-medium mb-2">Related searches</p>
      <div class="flex flex-wrap gap-2">
        <div class={badge("secondary", "cursor-pointer")}>AI agent best practices</div>
        <div class={badge("secondary", "cursor-pointer")}>React AI components</div>
        <div class={badge("secondary", "cursor-pointer")}>Agent UI patterns</div>
        <div class={badge("secondary", "cursor-pointer")}>Conversational interfaces</div>
      </div>
    </div>
  </div>

  {#if showBottomActions && onRefresh}
    <div class="flex items-center justify-between pt-2">
      <div class="flex gap-2">
        <button
          type="button"
          class={btn("ghost", "sm")}
          onclick={() => onRefresh?.()}
          title="Search again with same query"
        >
          <RefreshCw class="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>
      <div class="flex gap-1">
        <button type="button" class={btn("ghost", "icon", "h-8 w-8")}>😊</button>
        <button type="button" class={btn("ghost", "icon", "h-8 w-8")}>😔</button>
      </div>
    </div>
  {/if}
</div>
