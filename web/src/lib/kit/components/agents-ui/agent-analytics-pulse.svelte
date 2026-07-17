<script lang="ts" module>
  export interface PulseMetric {
    label: string;
    value: string;
    change: string;
    positive?: boolean;
  }

  export interface AttributionSlice {
    channel: string;
    value: number;
    color?: string;
  }

  export interface InsightHighlight {
    id: string;
    title: string;
    detail: string;
    impact: "high" | "medium" | "low";
  }

  export interface AgentAnalyticsPulseProps {
    title?: string;
    timeframe?: string;
    metrics?: PulseMetric[];
    trendSeries?: number[];
    attribution?: AttributionSlice[];
    highlights?: InsightHighlight[];
    segmentFilter?: string;
    onSegmentChange?: (segment: string) => void;
    onDrilldown?: () => void;
    class?: string;
  }

  const segmentOptions = ["All", "Enterprise", "Growth", "Self-serve"];

  const defaultMetrics: PulseMetric[] = [
    { label: "Active users", value: "148k", change: "+5.1%", positive: true },
    { label: "Activation rate", value: "42.7%", change: "+3.4%", positive: true },
    { label: "Churn", value: "3.2%", change: "-0.6%", positive: true },
  ];

  const defaultTrend = [62, 64, 66, 70, 74, 78, 81];

  const defaultAttribution: AttributionSlice[] = [
    { channel: "Agents", value: 38, color: "#2563eb" },
    { channel: "Lifecycle", value: 24, color: "#0ea5e9" },
    { channel: "Paid", value: 18, color: "#7c3aed" },
    { channel: "Organic", value: 14, color: "#16a34a" },
    { channel: "Other", value: 6, color: "#eab308" },
  ];

  const defaultHighlights: InsightHighlight[] = [
    {
      id: "insight-1",
      title: "Agents drive 38% of new ARR",
      detail: "Upsell agent closed 61 deals with 82% win rate vs control routes at 55%",
      impact: "high",
    },
    {
      id: "insight-2",
      title: "Activation spike from workflows",
      detail: "Workflow automation beta improved activation by +6.4 pts for Growth segment",
      impact: "medium",
    },
  ];

  const badgeBase =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const btnBase =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 focus-visible:ring-4 focus-visible:outline-1";
  const tabsListClass =
    "inline-flex h-10 w-full items-center justify-start border-b border-zinc-200 bg-transparent text-zinc-900 dark:border-zinc-800 dark:text-zinc-50";
  const tabsTriggerClass =
    "ring-offset-background focus-visible:ring-ring group relative inline-flex h-10 items-center justify-center rounded-none bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-medium whitespace-nowrap text-zinc-500 transition-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-zinc-950 dark:text-zinc-500 dark:data-[state=active]:text-white";
</script>

<script lang="ts">
  import { Tabs } from "bits-ui";
  import BarChart3 from "@lucide/svelte/icons/bar-chart-3";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import PieChart from "@lucide/svelte/icons/pie-chart";
  import { cn } from "$lib/utils.js";

  let {
    title = "Growth analytics pulse",
    timeframe = "Last 30 days",
    metrics = defaultMetrics,
    trendSeries = defaultTrend,
    attribution = defaultAttribution,
    highlights = defaultHighlights,
    segmentFilter = "All",
    onSegmentChange,
    onDrilldown,
    class: className,
  }: AgentAnalyticsPulseProps = $props();

  let activeSegment = $state("All");
  let hoveredTrendIndex = $state<number | null>(null);
  let hoveredSlice = $state<string | null>(null);

  $effect(() => {
    activeSegment = segmentFilter;
  });

  const totalAttribution = $derived(
    attribution.reduce((sum, slice) => sum + slice.value, 0) || 1
  );
  const trendMin = $derived(Math.min(...trendSeries));
  const trendMax = $derived(Math.max(...trendSeries));

  const pathD = $derived(
    trendSeries
      .map((value, index) => {
        const x = (index / (trendSeries.length - 1)) * 100;
        const y = 60 - ((value - trendMin) / (trendMax - trendMin || 1)) * 50;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ")
  );

  function handleSegmentChange(segment: string) {
    activeSegment = segment;
    onSegmentChange?.(segment);
  }

  function piePaths() {
    let cumulative = 0;
    return attribution.map((slice, index) => {
      const portion = slice.value / totalAttribution;
      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      cumulative += portion;
      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
      const largeArc = portion > 0.5 ? 1 : 0;
      const x1 = 60 + 42 * Math.cos(startAngle);
      const y1 = 60 + 42 * Math.sin(startAngle);
      const x2 = 60 + 42 * Math.cos(endAngle);
      const y2 = 60 + 42 * Math.sin(endAngle);
      return {
        slice,
        index,
        pathData: `M 60 60 L ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div
    class="flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm md:flex-row md:items-center md:justify-between"
  >
    <div>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <BarChart3 class="h-4 w-4" />
        {timeframe}
      </div>
      <div class="flex items-end gap-3">
        <h2 class="text-2xl font-semibold tracking-tight">{title}</h2>
        <div class={cn(badgeBase, "text-foreground")}>Segment · {activeSegment}</div>
      </div>
    </div>
    <Tabs.Root value={activeSegment} onValueChange={handleSegmentChange}>
      <Tabs.List class={cn(tabsListClass, "h-9 flex-nowrap overflow-x-auto")}>
        {#each segmentOptions as segment (segment)}
          <Tabs.Trigger value={segment} class={cn(tabsTriggerClass, "whitespace-nowrap")}>
            {#if activeSegment === segment}
              <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
              </div>
            {/if}
            {segment}
          </Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
  </div>

  <div class="grid gap-4 md:grid-cols-[1.5fr,1fr]">
    <div class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        {#each metrics as metric (metric.label)}
          <div class="rounded-lg border bg-background p-3 shadow-sm">
            <p class="text-xs text-muted-foreground">{metric.label}</p>
            <div class="mt-2 flex items-baseline gap-2">
              <span class="text-xl font-semibold">{metric.value}</span>
              <span
                class={cn(
                  "text-xs font-medium",
                  metric.positive === false ? "text-red-500" : "text-emerald-600"
                )}>{metric.change}</span
              >
            </div>
          </div>
        {/each}
      </div>
      <div class="rounded-xl border bg-background p-4 shadow-sm">
        <div class="flex items-center justify-between text-sm">
          <div>
            <p class="font-semibold">Engagement trend</p>
            <p class="text-muted-foreground">Agent-assisted outcomes vs. baseline</p>
          </div>
          <button
            type="button"
            class={cn(btnBase, "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3 has-[>svg]:px-2.5")}
            onclick={() => onDrilldown?.()}
          >
            Open drilldown
          </button>
        </div>
        <svg viewBox="0 0 100 60" class="mt-4 h-36 w-full">
          <path d={`${pathD} L 100 60 L 0 60 Z`} fill="rgba(99,102,241,0.16)" />
          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            stroke-width={2.5}
            stroke-linecap="round"
          />
          {#each trendSeries as value, index (index)}
            {@const x = (index / (trendSeries.length - 1)) * 100}
            {@const y = 60 - ((value - trendMin) / (trendMax - trendMin || 1)) * 50}
            {@const isActive = hoveredTrendIndex === index}
            <circle
              role="img"
              cx={x}
              cy={y}
              r={isActive ? 2.4 : 1.6}
              fill={isActive ? "#312e81" : "#4f46e5"}
              class="cursor-pointer"
              onmouseenter={() => (hoveredTrendIndex = index)}
              onmouseleave={() => (hoveredTrendIndex = null)}
            />
          {/each}
        </svg>
        <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {hoveredTrendIndex != null ? `Point ${hoveredTrendIndex + 1}` : "Lift vs. control"}
          </span>
          <span class="font-medium text-foreground">
            {hoveredTrendIndex != null ? `${trendSeries[hoveredTrendIndex]} pts` : "+9.3 pts"}
          </span>
        </div>
      </div>
    </div>
    <div class="space-y-4">
      <div class="rounded-xl border bg-background p-4 shadow-sm">
        <div class="flex items-center justify-between text-sm">
          <p class="font-semibold flex items-center gap-2">
            <PieChart class="h-4 w-4" /> Attribution
          </p>
          <span class="text-xs text-muted-foreground">Breakdown of lift drivers</span>
        </div>
        <div class="mt-4 flex items-center justify-center">
          <svg viewBox="0 0 120 120" class="h-32 w-32">
            <circle cx="60" cy="60" r="42" fill="#f4f4f5" />
            {#each piePaths() as { slice, index, pathData } (slice.channel + index)}
              {@const isHovered = hoveredSlice === slice.channel}
              <path
                role="img"
                d={pathData}
                fill={slice.color ?? "#2563eb"}
                opacity={isHovered ? 1 : 0.9 - index * 0.1}
                class="cursor-pointer transition-opacity"
                onmouseenter={() => (hoveredSlice = slice.channel)}
                onmouseleave={() => (hoveredSlice = null)}
              />
            {/each}
          </svg>
        </div>
        <div class="space-y-2 text-xs">
          {#each attribution as slice (slice.channel)}
            <div
              class={cn(
                "flex items-center justify-between rounded-md px-2 py-1 transition-colors",
                hoveredSlice === slice.channel && "bg-muted"
              )}
            >
              <span class="flex items-center gap-2">
                <span
                  class="inline-block h-2.5 w-2.5 rounded-full"
                  style="background-color: {slice.color ?? '#2563eb'}"
                ></span>
                {slice.channel}
              </span>
              <span class="font-medium text-foreground">{slice.value}%</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="rounded-xl border bg-background p-4 shadow-sm">
        <div class="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb class="h-4 w-4 text-amber-500" /> Highlights
        </div>
        <div class="mt-3 space-y-3">
          {#each highlights as insight (insight.id)}
            <div class="rounded-lg border border-dashed p-3">
              <div class="flex items-center justify-between text-sm font-medium text-foreground">
                {insight.title}
                <div
                  class={cn(
                    badgeBase,
                    "text-foreground",
                    insight.impact === "high" && "border-amber-400 text-amber-600",
                    insight.impact === "medium" && "border-blue-300 text-blue-500",
                    insight.impact === "low" && "border-slate-300 text-slate-500"
                  )}
                >
                  {insight.impact} impact
                </div>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">{insight.detail}</p>
            </div>
          {/each}
          {#if highlights.length === 0}
            <p class="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              No highlights generated yet.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
