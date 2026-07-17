<script lang="ts" module>
  export interface RevenueForecastPoint {
    label: string;
    value: number;
  }

  export interface RevenueSegmentInsight {
    id: string;
    segment: string;
    arr: string;
    trend: "up" | "down" | "flat";
    change: string;
    confidence: number;
    owner?: string;
  }

  export type RevenueScenario = "base" | "stretch" | "conservative";

  export interface AgentRevenueInsightsProps {
    currentArr?: string;
    arrChange?: string;
    periodLabel?: string;
    forecastPoints?: RevenueForecastPoint[];
    segmentInsights?: RevenueSegmentInsight[];
    scenario?: RevenueScenario;
    onRefresh?: () => void;
    onScenarioChange?: (scenario: RevenueScenario) => void;
    onSegmentClick?: (segment: RevenueSegmentInsight) => void;
    class?: string;
  }

  const defaultPoints: RevenueForecastPoint[] = [
    { label: "Jan", value: 9.8 },
    { label: "Feb", value: 10.4 },
    { label: "Mar", value: 11.2 },
    { label: "Apr", value: 11.8 },
    { label: "May", value: 12.4 },
    { label: "Jun", value: 13.1 },
  ];

  const defaultSegments: RevenueSegmentInsight[] = [
    {
      id: "ent-apac",
      segment: "Enterprise · APAC",
      arr: "$4.2M",
      trend: "up",
      change: "+14% QoQ",
      confidence: 0.86,
      owner: "Ivy Chen",
    },
    {
      id: "smb-na",
      segment: "SMB · North America",
      arr: "$2.1M",
      trend: "flat",
      change: "+2% QoQ",
      confidence: 0.74,
      owner: "Miguel Santos",
    },
    {
      id: "partner-emea",
      segment: "Partner Channel · EMEA",
      arr: "$1.9M",
      trend: "up",
      change: "+11% QoQ",
      confidence: 0.81,
      owner: "Ada Mensah",
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
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import ArrowDownRight from "@lucide/svelte/icons/arrow-down-right";
  import TrendingUp from "@lucide/svelte/icons/trending-up";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import CalendarClock from "@lucide/svelte/icons/calendar-clock";
  import { cn } from "$lib/utils.js";

  let {
    currentArr = "$12.9M",
    arrChange = "+8.4%",
    periodLabel = "Trailing 6 months",
    forecastPoints,
    segmentInsights,
    scenario = "base",
    onRefresh,
    onScenarioChange,
    onSegmentClick,
    class: className,
  }: AgentRevenueInsightsProps = $props();

  let internalScenario = $state<RevenueScenario>("base");
  let hoveredPoint = $state<RevenueForecastPoint | null>(null);
  let hoveredSegment = $state<string | null>(null);

  $effect(() => {
    internalScenario = scenario;
  });

  const displayScenario = $derived(scenario ?? internalScenario);
  const points = $derived(
    forecastPoints && forecastPoints.length > 2 ? forecastPoints : defaultPoints
  );
  const segments = $derived(
    segmentInsights && segmentInsights.length > 0 ? segmentInsights : defaultSegments
  );
  const minValue = $derived(Math.min(...points.map((point) => point.value)));
  const maxValue = $derived(Math.max(...points.map((point) => point.value)));
  const pathD = $derived(
    points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 60 - ((point.value - minValue) / (maxValue - minValue || 1)) * 50;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ")
  );

  function handleScenarioChange(next: string) {
    const nextScenario = next as RevenueScenario;
    internalScenario = nextScenario;
    onScenarioChange?.(nextScenario);
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  <div
    class="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
  >
    <div class="space-y-1">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock class="h-4 w-4" />
        {periodLabel}
      </div>
      <div class="flex items-end gap-3">
        <h2 class="text-3xl font-semibold tracking-tight">{currentArr}</h2>
        <div class={cn(badgeBase, "bg-emerald-100 text-emerald-700 border border-emerald-200")}>
          {arrChange}
        </div>
      </div>
      <p class="text-sm text-muted-foreground">
        Projected annual recurring revenue with agent-led upsell programs.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <Tabs.Root value={displayScenario} onValueChange={handleScenarioChange}>
        <Tabs.List class={cn(tabsListClass, "h-9")}>
          {#each ["conservative", "base", "stretch"] as s (s)}
            <Tabs.Trigger value={s} class={tabsTriggerClass}>
              {#if displayScenario === s}
                <div class="absolute bottom-0 flex h-0.5 w-full justify-center">
                  <div class="h-0.5 w-4/5 bg-zinc-950 dark:bg-white"></div>
                </div>
              {/if}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Tabs.Trigger>
          {/each}
        </Tabs.List>
      </Tabs.Root>
      <button
        type="button"
        class={cn(
          btnBase,
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 has-[>svg]:px-3"
        )}
        onclick={() => onRefresh?.()}
      >
        <RefreshCw class="mr-2 h-4 w-4" />
        Refresh signals
      </button>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
    <div class="rounded-xl border bg-background p-4 shadow-sm">
      <div class="flex items-center justify-between text-sm">
        <div>
          <p class="font-semibold">Scenario forecast</p>
          <p class="text-muted-foreground">Agent upsell + retention gains</p>
        </div>
        <div class={cn(badgeBase, "text-foreground")}>
          {displayScenario.charAt(0).toUpperCase() + displayScenario.slice(1)} case
        </div>
      </div>
      <svg viewBox="0 0 100 60" class="mt-6 h-40 w-full">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L 100 60 L 0 60 Z`} fill="url(#revenueGradient)" />
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          stroke-width={2.5}
          stroke-linecap="round"
        />
        {#each points as point, index (point.label)}
          {@const x = (index / (points.length - 1)) * 100}
          {@const y = 60 - ((point.value - minValue) / (maxValue - minValue || 1)) * 50}
          <circle
            role="img"
            cx={x}
            cy={y}
            r={hoveredPoint?.label === point.label ? 2.6 : 1.8}
            fill={hoveredPoint?.label === point.label ? "#1d4ed8" : "#60a5fa"}
            class="cursor-pointer"
            onmouseenter={() => (hoveredPoint = point)}
            onmouseleave={() => (hoveredPoint = null)}
          />
        {/each}
      </svg>
      <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hoveredPoint ? `${hoveredPoint.label}` : "Hover points for detail"}</span>
        <span class="font-medium text-foreground">
          {hoveredPoint
            ? `${hoveredPoint.value.toFixed(1)}M ARR`
            : `${points[points.length - 1]?.value.toFixed(1)}M forecast`}
        </span>
      </div>
    </div>
    <div class="space-y-3 rounded-xl border bg-background p-4 shadow-sm">
      <div class="flex items-center justify-between text-sm">
        <p class="font-semibold">Segments to watch</p>
        <div class={cn(badgeBase, "text-foreground")}>Confidence ≥ 70%</div>
      </div>
      <div class="space-y-3">
        {#each segments as segment (segment.id)}
          <button
            type="button"
            onclick={() => onSegmentClick?.(segment)}
            onmouseenter={() => (hoveredSegment = segment.id)}
            onmouseleave={() => (hoveredSegment = null)}
            class={cn(
              "w-full rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary/60",
              hoveredSegment === segment.id && "border-primary/70 bg-primary/5"
            )}
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-foreground">{segment.segment}</p>
                <p class="text-xs text-muted-foreground">
                  Owner · {segment.owner ?? "Unassigned"}
                </p>
              </div>
              <div class="flex items-center gap-2 text-sm font-medium">
                {segment.arr}
                {#if segment.trend === "up"}
                  <ArrowUpRight class="h-4 w-4 text-emerald-500" />
                {:else if segment.trend === "down"}
                  <ArrowDownRight class="h-4 w-4 text-red-500" />
                {:else}
                  <TrendingUp class="h-4 w-4 text-blue-500" />
                {/if}
              </div>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{segment.change}</span>
              <span>Confidence: {Math.round(segment.confidence * 100)}%</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
