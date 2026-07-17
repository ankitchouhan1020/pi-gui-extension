<script lang="ts" module>
  import type { Component } from "svelte";
  import Globe from "@lucide/svelte/icons/globe";
  import FileText from "@lucide/svelte/icons/file-text";
  import Database from "@lucide/svelte/icons/database";
  import Zap from "@lucide/svelte/icons/zap";

  export type SourceType = "web" | "document" | "database" | "api";

  export interface CitationSource {
    id: string;
    number: number;
    title: string;
    url: string;
    type: SourceType;
    relevance: number;
    snippet: string;
    verified: boolean;
  }

  export interface AgentSourcesCitationsProps {
    content?: string;
    sources?: CitationSource[];
    activeCitationId?: string | null;
    class?: string;
    onCitationClick?: (sourceId: string) => void;
    onSourceClick?: (sourceId: string) => void;
    onVerifySource?: (sourceId: string) => void;
    onCopyWithCitations?: () => void;
    onExportSources?: () => void;
  }

  const sourceTypeConfig: Record<
    SourceType,
    {
      label: string;
      icon: Component;
      accentColor: string;
      accentBg: string;
      accentGradient: string;
      pillBg: string;
      pillText: string;
      iconBg: string;
    }
  > = {
    web: {
      label: "Web",
      icon: Globe,
      accentColor: "bg-blue-500",
      accentBg: "bg-blue-50 dark:bg-blue-950/40",
      accentGradient: "from-blue-500/20 via-blue-400/10 to-transparent",
      pillBg: "bg-blue-100 dark:bg-blue-900/40",
      pillText: "text-blue-700 dark:text-blue-300",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
    },
    document: {
      label: "Document",
      icon: FileText,
      accentColor: "bg-amber-500",
      accentBg: "bg-amber-50 dark:bg-amber-950/40",
      accentGradient: "from-amber-500/20 via-amber-400/10 to-transparent",
      pillBg: "bg-amber-100 dark:bg-amber-900/40",
      pillText: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
    },
    database: {
      label: "Database",
      icon: Database,
      accentColor: "bg-slate-500",
      accentBg: "bg-slate-50 dark:bg-slate-950/40",
      accentGradient: "from-slate-500/20 via-slate-400/10 to-transparent",
      pillBg: "bg-slate-100 dark:bg-slate-900/40",
      pillText: "text-slate-700 dark:text-slate-300",
      iconBg: "bg-slate-100 dark:bg-slate-800/50",
    },
    api: {
      label: "API",
      icon: Zap,
      accentColor: "bg-emerald-500",
      accentBg: "bg-emerald-50 dark:bg-emerald-950/40",
      accentGradient: "from-emerald-500/20 via-emerald-400/10 to-transparent",
      pillBg: "bg-emerald-100 dark:bg-emerald-900/40",
      pillText: "text-emerald-700 dark:text-emerald-300",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    },
  };

  const citationColors: Record<number, { bg: string; text: string; ring: string }> = {
    1: { bg: "bg-blue-500", text: "text-white", ring: "ring-blue-400" },
    2: { bg: "bg-amber-500", text: "text-white", ring: "ring-amber-400" },
    3: { bg: "bg-slate-500", text: "text-white", ring: "ring-slate-400" },
    4: { bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400" },
  };

  function getCitationColor(num: number) {
    return citationColors[num] ?? { bg: "bg-zinc-500", text: "text-white", ring: "ring-zinc-400" };
  }

  const defaultSources: CitationSource[] = [
    {
      id: "src-1",
      number: 1,
      title: "Microservices Best Practices — Martin Fowler",
      url: "https://martinfowler.com/articles/microservices.html",
      type: "web",
      relevance: 0.95,
      snippet:
        "Microservices enable independent deployment and scaling of individual components, reducing coordination overhead across teams.",
      verified: true,
    },
    {
      id: "src-2",
      number: 2,
      title: "Building Distributed Systems — O'Reilly",
      url: "https://oreilly.com/library/distributed-systems",
      type: "document",
      relevance: 0.88,
      snippet:
        "Fault isolation is a key advantage: a failure in one service does not cascade to the entire system when proper circuit-breaker patterns are used.",
      verified: true,
    },
    {
      id: "src-3",
      number: 3,
      title: "Cloud-native Architectures — CNCF Survey 2024",
      url: "https://cncf.io/reports/survey-2024",
      type: "web",
      relevance: 0.82,
      snippet:
        "78% of organizations running microservices reported faster release cycles compared to their previous monolithic deployments.",
      verified: false,
    },
    {
      id: "src-4",
      number: 4,
      title: "Internal Service Mesh Metrics — Platform DB",
      url: "internal://platform-db/mesh-metrics",
      type: "database",
      relevance: 0.76,
      snippet:
        "Average request latency dropped 34% after decomposing the billing monolith into four bounded-context services.",
      verified: true,
    },
  ];

  const defaultContent =
    "Microservices architecture offers several compelling benefits for modern software teams. First, it enables independent deployment, allowing teams to ship features without coordinating monolithic releases [1]. Each service can be scaled, tested, and deployed on its own cadence.\n\nFault isolation is another major advantage. When a single service encounters an error, circuit-breaker patterns prevent cascading failures across the platform [2]. This leads to higher overall system resilience.\n\nOrganizations adopting microservices consistently report faster release cycles. Industry surveys indicate that nearly four out of five teams experience measurably shorter time-to-production after migrating from a monolith [3].\n\nFinally, measurable performance gains are common. Internal benchmarks show significant latency reductions after decomposing tightly coupled modules into well-defined bounded contexts [4].";

  const badgeBase =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const btnBase =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 focus-visible:ring-4 focus-visible:outline-1";
  const tabsListClass =
    "inline-flex h-10 w-full items-center justify-start border-b border-zinc-200 bg-transparent text-zinc-900 dark:border-zinc-800 dark:text-zinc-50";
  const tabsTriggerClass =
    "ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white";
  const tooltipContentClass =
    "bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900 z-50 max-w-sm rounded-md px-3 py-1.5 text-xs";
</script>

<script lang="ts">
  import { Tabs, Tooltip } from "bits-ui";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Filter from "@lucide/svelte/icons/filter";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import { cn } from "$lib/utils.js";

  let {
    content,
    sources,
    activeCitationId = null,
    class: className,
    onCitationClick,
    onSourceClick,
    onVerifySource,
    onCopyWithCitations,
    onExportSources,
  }: AgentSourcesCitationsProps = $props();

  const displayContent = $derived(content ?? defaultContent);
  const displaySources = $derived(sources && sources.length > 0 ? sources : defaultSources);

  let activeId = $state<string | null>(null);
  let activeFilter = $state("all");

  $effect(() => {
    activeId = activeCitationId;
  });

  function handleCitationClick(sourceId: string) {
    activeId = activeId === sourceId ? null : sourceId;
    onCitationClick?.(sourceId);
  }

  const verifiedCount = $derived(displaySources.filter((s) => s.verified).length);

  const filteredSources = $derived(
    activeFilter === "all"
      ? displaySources
      : displaySources.filter((s) => s.type === activeFilter)
  );

  const sourceTypeCounts = $derived.by(() => {
    const counts: Record<string, number> = { all: displaySources.length };
    for (const s of displaySources) {
      counts[s.type] = (counts[s.type] ?? 0) + 1;
    }
    return counts;
  });

  type ContentPart =
    | { kind: "text"; text: string; key: number }
    | { kind: "cite"; num: number; source: CitationSource; key: number }
    | { kind: "raw"; text: string; key: number };

  const contentParts = $derived.by((): ContentPart[] => {
    const parts = displayContent.split(/(\[\d+\])/);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const source = displaySources.find((s) => s.number === num);
        if (!source) return { kind: "raw" as const, text: part, key: i };
        return { kind: "cite" as const, num, source, key: i };
      }
      return { kind: "text" as const, text: part, key: i };
    });
  });

  const col1 = $derived(filteredSources.filter((_, i) => i % 2 === 0));
  const col2 = $derived(filteredSources.filter((_, i) => i % 2 === 1));

  const filterTypes: SourceType[] = ["web", "document", "database", "api"];
</script>

<Tooltip.Provider delayDuration={0}>
  <div class={cn("space-y-5", className)}>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-1">
        <div
          class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          <BookOpen class="h-3.5 w-3.5" />
          Research Assistant
        </div>
        <h2 class="text-2xl font-bold tracking-tight">Sources & Citations</h2>
      </div>

      <div class="flex items-center gap-4">
        <div
          class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/30"
        >
          <div
            class="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400"
          >
            {verifiedCount}<span class="text-lg text-emerald-400 dark:text-emerald-600"
              >/{displaySources.length}</span
            >
          </div>
          <div
            class="text-[11px] font-medium leading-tight text-emerald-700 dark:text-emerald-300"
          >
            sources
            <br />
            verified
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class={cn(
          btnBase,
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 gap-1.5 text-xs px-3"
        )}
        onclick={() => onCopyWithCitations?.()}
      >
        <ClipboardCopy class="h-3.5 w-3.5" />
        Copy with citations
      </button>
      <button
        type="button"
        class={cn(
          btnBase,
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 gap-1.5 text-xs px-3"
        )}
        onclick={() => onExportSources?.()}
      >
        <Download class="h-3.5 w-3.5" />
        Export sources
      </button>
      <button
        type="button"
        class={cn(
          btnBase,
          "h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700 px-3"
        )}
        onclick={() => displaySources.forEach((s) => !s.verified && onVerifySource?.(s.id))}
      >
        <ShieldCheck class="h-3.5 w-3.5" />
        Verify all
      </button>
    </div>

    <div class="grid gap-5 lg:grid-cols-[1.4fr,1fr] overflow-hidden">
      <div class="relative rounded-2xl border bg-background shadow-sm overflow-hidden">
        <div class="h-1 bg-zinc-200 dark:bg-zinc-700"></div>

        <div class="p-5">
          <div class="mb-4 flex items-center gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800"
            >
              <BookOpen class="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            </div>
            <h3 class="text-sm font-semibold tracking-tight">Response</h3>
            <div class="ml-auto flex gap-1">
              {#each displaySources as s (s.id)}
                {@const colors = getCitationColor(s.number)}
                <span
                  class={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                    colors.bg,
                    colors.text,
                    "opacity-60"
                  )}
                >
                  {s.number}
                </span>
              {/each}
            </div>
          </div>

          <div class="text-sm leading-[1.8] text-foreground/90 whitespace-pre-line break-words">
            {#each contentParts as part (part.key)}
              {#if part.kind === "cite"}
                {@const isActive = activeId === part.source.id}
                {@const colors = getCitationColor(part.num)}
                <Tooltip.Root>
                  <Tooltip.Trigger
                    class={cn(
                      "relative -top-1 mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none transition-all duration-200 cursor-pointer",
                      colors.bg,
                      colors.text,
                      isActive
                        ? "ring-2 ring-offset-1 scale-125 shadow-lg " + colors.ring
                        : "opacity-90 hover:opacity-100 hover:scale-110"
                    )}
                    onclick={() => handleCitationClick(part.source.id)}
                  >
                    {part.num}
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content side="top" sideOffset={4} class={cn(tooltipContentClass, "max-w-[260px] text-xs")}>
                      <p class="font-semibold">{part.source.title}</p>
                      <p class="mt-1 text-muted-foreground">
                        {Math.round(part.source.relevance * 100)}% relevance
                      </p>
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              {:else}
                <span>{part.text}</span>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <div
        class="relative rounded-2xl border shadow-sm overflow-hidden backdrop-blur-sm bg-white/90 dark:bg-zinc-900/90"
      >
        <div class="border-b px-4 pt-4 pb-0">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40"
              >
                <Filter class="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 class="text-sm font-semibold tracking-tight">Sources</h3>
            </div>
            <div
              class={cn(
                badgeBase,
                "rounded-full bg-zinc-100 text-zinc-600 border-0 text-[11px] dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              {filteredSources.length} result{filteredSources.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Tabs.Root value={activeFilter} onValueChange={(v) => (activeFilter = v)}>
            <Tabs.List class={cn(tabsListClass, "h-9 border-b-0 gap-0")}>
              <Tabs.Trigger value="all" class={cn(tabsTriggerClass, "text-xs px-3 h-9")}>
                {#if activeFilter === "all"}
                  <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                    <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
                  </div>
                {/if}
                All
                <span
                  class="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-200/80 px-1 text-[10px] font-medium tabular-nums dark:bg-zinc-700"
                >
                  {sourceTypeCounts.all ?? 0}
                </span>
              </Tabs.Trigger>
              {#each filterTypes as type (type)}
                {@const config = sourceTypeConfig[type]}
                {@const count = sourceTypeCounts[type] ?? 0}
                {@const Icon = config.icon}
                {#if count > 0}
                  <Tabs.Trigger
                    value={type}
                    class={cn(tabsTriggerClass, "text-xs px-3 h-9 gap-1")}
                  >
                    {#if activeFilter === type}
                      <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                        <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
                      </div>
                    {/if}
                    <Icon class="h-3 w-3" />
                    {config.label}
                    <span
                      class="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-200/80 px-1 text-[10px] font-medium tabular-nums dark:bg-zinc-700"
                    >
                      {count}
                    </span>
                  </Tabs.Trigger>
                {/if}
              {/each}
            </Tabs.List>

            {#each ["all", "web", "document", "database", "api"] as tabValue (tabValue)}
              <Tabs.Content
                value={tabValue}
                class="focus-visible:ring-ring relative mt-0 rounded-md ring-offset-blue-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <div class="relative max-h-[480px] overflow-auto">
                  <div class="grid grid-cols-2 gap-2.5 p-3">
                    <div class="flex flex-col gap-2.5">
                      {#each col1 as source, i (source.id)}
                        {@const config = sourceTypeConfig[source.type]}
                        {@const Icon = config.icon}
                        {@const isActive = activeId === source.id}
                        {@const relevancePct = Math.round(source.relevance * 100)}
                        {@const isExpanded = source.snippet.length > 100 || i % 2 === 0}
                        <div
                          role="button"
                          tabindex={0}
                          onclick={() => {
                            handleCitationClick(source.id);
                            onSourceClick?.(source.id);
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter") {
                              handleCitationClick(source.id);
                              onSourceClick?.(source.id);
                            }
                          }}
                          class={cn(
                            "group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300",
                            isActive
                              ? "ring-2 ring-blue-400 shadow-lg shadow-black/5 border-blue-300 dark:border-blue-600"
                              : "border-zinc-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
                          )}
                        >
                          <div class={cn("h-1.5", config.accentColor)}></div>
                          {#if source.verified}
                            <div class="absolute top-3 right-2 z-10">
                              <div
                                class="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-900"
                              >
                                <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                            </div>
                          {/if}
                          <div class="relative p-3">
                            <div
                              class={cn(
                                "absolute inset-0 bg-gradient-to-b opacity-50",
                                config.accentGradient
                              )}
                            ></div>
                            <div class="relative">
                              <div class="mb-2.5 flex items-center gap-2">
                                <div
                                  class={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                    config.iconBg
                                  )}
                                >
                                  <Icon class={cn("h-4 w-4", config.pillText)} />
                                </div>
                                <div class="flex-1 min-w-0">
                                  <div
                                    class={cn(
                                      badgeBase,
                                      "rounded-full border-0 text-[10px] font-semibold",
                                      config.pillBg,
                                      config.pillText
                                    )}
                                  >
                                    {config.label}
                                  </div>
                                </div>
                                <span
                                  class={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                                    getCitationColor(source.number).bg,
                                    getCitationColor(source.number).text
                                  )}
                                >
                                  {source.number}
                                </span>
                              </div>
                              <p
                                class="text-[13px] font-semibold leading-snug text-foreground line-clamp-2"
                              >
                                {source.title}
                              </p>
                              <p
                                class={cn(
                                  "mt-1.5 text-[11px] leading-relaxed text-muted-foreground",
                                  isExpanded ? "line-clamp-4" : "line-clamp-2"
                                )}
                              >
                                {source.snippet}
                              </p>
                              <div
                                class="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70"
                              >
                                <ExternalLink class="h-2.5 w-2.5 shrink-0" />
                                <span class="truncate">{source.url}</span>
                              </div>
                              {#if !source.verified}
                                <Tooltip.Root>
                                  <Tooltip.Trigger
                                    class="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 cursor-pointer"
                                    onclick={(e: MouseEvent) => {
                                      e.stopPropagation();
                                      onVerifySource?.(source.id);
                                    }}
                                  >
                                    <ShieldCheck class="h-3 w-3" />
                                    Verify source
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
                                      Click to verify this source
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              {/if}
                            </div>
                          </div>
                          <div class="h-1 w-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              class={cn("h-full transition-all duration-500", config.accentColor)}
                              style="width: {relevancePct}%"
                            ></div>
                          </div>
                          <div
                            class="flex items-center justify-between px-3 py-1.5 text-[10px] bg-zinc-50/80 dark:bg-zinc-900/50"
                          >
                            <span class="text-muted-foreground">Relevance</span>
                            <span class="font-bold tabular-nums text-foreground"
                              >{relevancePct}%</span
                            >
                          </div>
                        </div>
                      {/each}
                    </div>
                    <div class="flex flex-col gap-2.5 pt-4">
                      {#each col2 as source, i (source.id)}
                        {@const config = sourceTypeConfig[source.type]}
                        {@const Icon = config.icon}
                        {@const isActive = activeId === source.id}
                        {@const relevancePct = Math.round(source.relevance * 100)}
                        {@const isExpanded = source.snippet.length > 100 || i % 2 === 0}
                        <div
                          role="button"
                          tabindex={0}
                          onclick={() => {
                            handleCitationClick(source.id);
                            onSourceClick?.(source.id);
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter") {
                              handleCitationClick(source.id);
                              onSourceClick?.(source.id);
                            }
                          }}
                          class={cn(
                            "group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300",
                            isActive
                              ? "ring-2 ring-blue-400 shadow-lg shadow-black/5 border-blue-300 dark:border-blue-600"
                              : "border-zinc-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
                          )}
                        >
                          <div class={cn("h-1.5", config.accentColor)}></div>
                          {#if source.verified}
                            <div class="absolute top-3 right-2 z-10">
                              <div
                                class="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-900"
                              >
                                <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
                              </div>
                            </div>
                          {/if}
                          <div class="relative p-3">
                            <div
                              class={cn(
                                "absolute inset-0 bg-gradient-to-b opacity-50",
                                config.accentGradient
                              )}
                            ></div>
                            <div class="relative">
                              <div class="mb-2.5 flex items-center gap-2">
                                <div
                                  class={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg",
                                    config.iconBg
                                  )}
                                >
                                  <Icon class={cn("h-4 w-4", config.pillText)} />
                                </div>
                                <div class="flex-1 min-w-0">
                                  <div
                                    class={cn(
                                      badgeBase,
                                      "rounded-full border-0 text-[10px] font-semibold",
                                      config.pillBg,
                                      config.pillText
                                    )}
                                  >
                                    {config.label}
                                  </div>
                                </div>
                                <span
                                  class={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                                    getCitationColor(source.number).bg,
                                    getCitationColor(source.number).text
                                  )}
                                >
                                  {source.number}
                                </span>
                              </div>
                              <p
                                class="text-[13px] font-semibold leading-snug text-foreground line-clamp-2"
                              >
                                {source.title}
                              </p>
                              <p
                                class={cn(
                                  "mt-1.5 text-[11px] leading-relaxed text-muted-foreground",
                                  isExpanded ? "line-clamp-4" : "line-clamp-2"
                                )}
                              >
                                {source.snippet}
                              </p>
                              <div
                                class="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70"
                              >
                                <ExternalLink class="h-2.5 w-2.5 shrink-0" />
                                <span class="truncate">{source.url}</span>
                              </div>
                              {#if !source.verified}
                                <Tooltip.Root>
                                  <Tooltip.Trigger
                                    class="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 cursor-pointer"
                                    onclick={(e: MouseEvent) => {
                                      e.stopPropagation();
                                      onVerifySource?.(source.id);
                                    }}
                                  >
                                    <ShieldCheck class="h-3 w-3" />
                                    Verify source
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
                                      Click to verify this source
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              {/if}
                            </div>
                          </div>
                          <div class="h-1 w-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              class={cn("h-full transition-all duration-500", config.accentColor)}
                              style="width: {relevancePct}%"
                            ></div>
                          </div>
                          <div
                            class="flex items-center justify-between px-3 py-1.5 text-[10px] bg-zinc-50/80 dark:bg-zinc-900/50"
                          >
                            <span class="text-muted-foreground">Relevance</span>
                            <span class="font-bold tabular-nums text-foreground"
                              >{relevancePct}%</span
                            >
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </Tabs.Content>
            {/each}
          </Tabs.Root>
        </div>
      </div>
    </div>
  </div>
</Tooltip.Provider>
