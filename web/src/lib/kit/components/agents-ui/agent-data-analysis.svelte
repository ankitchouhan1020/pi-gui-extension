<script lang="ts" module>
  export interface DataMetric {
    label: string;
    value: string;
    change: string;
    changeDirection: "up" | "down" | "neutral";
  }

  export interface DataPreview {
    headers: string[];
    rows: string[][];
  }

  export interface DataInsight {
    id: string;
    title: string;
    description: string;
    confidence: number;
    category: "trend" | "anomaly" | "correlation" | "recommendation";
  }

  export interface DistributionBar {
    label: string;
    value: number;
    maxValue: number;
    color: string;
  }

  export interface AgentDataAnalysisProps {
    datasetName?: string;
    description?: string;
    rowCount?: number;
    columnCount?: number;
    metrics?: DataMetric[];
    dataPreview?: DataPreview;
    insights?: DataInsight[];
    distribution?: DistributionBar[];
    isAnalyzing?: boolean;
    onExport?: () => void;
    onDeeperAnalysis?: () => void;
    onAskFollowUp?: () => void;
    onDownload?: () => void;
    class?: string;
  }

  const defaults = {
    datasetName: "E-commerce Sales Q4 2024",
    description: "Transactional data across all channels for Oct-Dec 2024",
    rowCount: 48572,
    columnCount: 23,
    metrics: [
      {
        label: "Revenue",
        value: "$2.4M",
        change: "+12.3%",
        changeDirection: "up" as const,
      },
      {
        label: "Orders",
        value: "18,429",
        change: "+8.1%",
        changeDirection: "up" as const,
      },
      {
        label: "AOV",
        value: "$130.22",
        change: "-2.4%",
        changeDirection: "down" as const,
      },
      {
        label: "Conversion",
        value: "3.8%",
        change: "+0.5%",
        changeDirection: "up" as const,
      },
    ],
    dataPreview: {
      headers: ["Order ID", "Date", "Channel", "Revenue", "Status"],
      rows: [
        ["#10421", "2024-12-01", "Web", "$142.50", "Completed"],
        ["#10422", "2024-12-01", "Mobile", "$89.00", "Completed"],
        ["#10423", "2024-12-02", "Web", "$215.30", "Refunded"],
        ["#10424", "2024-12-02", "In-store", "$67.80", "Completed"],
        ["#10425", "2024-12-03", "Mobile", "$178.90", "Completed"],
      ],
    },
    insights: [
      {
        id: "i1",
        title: "Revenue spike on weekends",
        description:
          "Weekend revenue is 34% higher than weekdays, driven by mobile channel promotions.",
        confidence: 92,
        category: "trend" as const,
      },
      {
        id: "i2",
        title: "Unusual refund cluster",
        description:
          "Refund rate jumped to 8.2% in the second week of December, concentrated in electronics category.",
        confidence: 87,
        category: "anomaly" as const,
      },
      {
        id: "i3",
        title: "AOV correlates with free shipping",
        description:
          "Orders with free shipping threshold have 22% higher AOV compared to standard orders.",
        confidence: 78,
        category: "correlation" as const,
      },
      {
        id: "i4",
        title: "Optimize mobile checkout",
        description:
          "Mobile cart abandonment is 18% higher than web. Simplifying checkout could recover ~$180K.",
        confidence: 84,
        category: "recommendation" as const,
      },
    ],
    distribution: [
      { label: "Electronics", value: 820000, maxValue: 1000000, color: "#2563eb" },
      { label: "Apparel", value: 640000, maxValue: 1000000, color: "#0ea5e9" },
      { label: "Home & Garden", value: 480000, maxValue: 1000000, color: "#71717a" },
      { label: "Sports", value: 310000, maxValue: 1000000, color: "#16a34a" },
      { label: "Books", value: 150000, maxValue: 1000000, color: "#eab308" },
    ],
  };

  const categoryStyle: Record<DataInsight["category"], string> = {
    trend:
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50",
    anomaly:
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
    correlation:
      "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-900/50",
    recommendation:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  };

  const distColors = [
    "bg-blue-500",
    "bg-sky-500",
    "bg-zinc-500",
    "bg-emerald-500",
    "bg-amber-500",
  ];

  const sparkData = [
    [32, 44, 38, 52, 48, 62, 58],
    [20, 28, 25, 35, 40, 38, 45],
    [55, 52, 48, 50, 46, 44, 42],
    [18, 22, 20, 26, 30, 28, 34],
  ];
  const sparkColors = ["#3b82f6", "#64748b", "#f59e0b", "#10b981"];
  const metricBgColors = [
    "bg-blue-50/50 dark:bg-blue-950/20",
    "bg-slate-50/50 dark:bg-slate-950/20",
    "bg-amber-50/50 dark:bg-amber-950/20",
    "bg-emerald-50/50 dark:bg-emerald-950/20",
  ];
  const metricRingColors = [
    "ring-blue-500/10",
    "ring-slate-500/10",
    "ring-amber-500/10",
    "ring-emerald-500/10",
  ];

  const badgeBase =
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const btnBase =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 focus-visible:ring-4 focus-visible:outline-1";

  function sparklinePoints(data: number[], w = 80, h = 28, pad = 2) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  function changeBadgeStyle(dir: DataMetric["changeDirection"]) {
    if (dir === "up")
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50";
    if (dir === "down")
      return "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
    return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700/50";
  }
</script>

<script lang="ts">
  import { Tooltip } from "bits-ui";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Database from "@lucide/svelte/icons/database";
  import Download from "@lucide/svelte/icons/download";
  import FileText from "@lucide/svelte/icons/file-text";
  import Loader2 from "@lucide/svelte/icons/loader-circle";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import Search from "@lucide/svelte/icons/search";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TrendingUp from "@lucide/svelte/icons/trending-up";
  import BarChart3 from "@lucide/svelte/icons/bar-chart-3";
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Zap from "@lucide/svelte/icons/zap";
  import { cn } from "$lib/utils.js";

  let {
    datasetName: nameProp,
    description: descProp,
    rowCount: rowsProp,
    columnCount: colsProp,
    metrics: metricsProp,
    dataPreview: previewProp,
    insights: insightsProp,
    distribution: distProp,
    isAnalyzing = false,
    onExport,
    onDeeperAnalysis,
    onAskFollowUp,
    onDownload,
    class: className,
  }: AgentDataAnalysisProps = $props();

  const datasetName = $derived(nameProp ?? defaults.datasetName);
  const description = $derived(descProp ?? defaults.description);
  const rowCount = $derived(rowsProp ?? defaults.rowCount);
  const columnCount = $derived(colsProp ?? defaults.columnCount);
  const metrics = $derived(metricsProp ?? defaults.metrics);
  const dataPreview = $derived(previewProp ?? defaults.dataPreview);
  const insights = $derived(insightsProp ?? defaults.insights);
  const distribution = $derived(distProp ?? defaults.distribution);
  const totalDist = $derived(distribution.reduce((s, d) => s + d.value, 0));
  const missingPct = 2.3;

  const donutR = 22;
  const donutCirc = 2 * Math.PI * donutR;
  const qualityPct = (100 - missingPct) / 100;
  const donutOffset = donutCirc * (1 - qualityPct);

  const tooltipContentClass =
    "bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900 z-50 max-w-sm rounded-md px-3 py-1.5 text-xs";
</script>

<Tooltip.Provider delayDuration={0}>
  <div class={cn("space-y-3 p-4", className)}>
    <div
      class="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      <div class="space-y-1.5 min-w-0">
        <div
          class="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
        >
          <div class="flex items-center justify-center h-5 w-5 rounded-md bg-blue-600 text-white">
            <Database class="h-3 w-3" />
          </div>
          Data Analysis Agent
        </div>
        <h2 class="text-lg font-semibold tracking-tight truncate">{datasetName}</h2>
        <p class="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <div class={cn(badgeBase, "text-foreground font-mono tabular-nums text-xs")}>
          {rowCount.toLocaleString()} rows
        </div>
        <div class={cn(badgeBase, "text-foreground font-mono tabular-nums text-xs")}>
          {columnCount} cols
        </div>
        <div
          class={cn(
            badgeBase,
            "text-xs",
            isAnalyzing
              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}
        >
          {#if isAnalyzing}
            <Loader2 class="mr-1.5 h-3 w-3 animate-spin" />
            Analyzing
          {:else}
            <Zap class="mr-1 h-3 w-3" />
            Complete
          {/if}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_auto_auto]">
      <div
        class={cn(
          "col-span-1 sm:col-span-2 rounded-2xl border p-5 shadow-sm ring-1",
          metricBgColors[0],
          metricRingColors[0]
        )}
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1 min-w-0">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {metrics[0]?.label ?? "Revenue"}
            </p>
            <p class="text-3xl font-bold tracking-tight tabular-nums">
              {metrics[0]?.value ?? "--"}
            </p>
            <div class="flex items-center gap-1.5 mt-1">
              <span
                class={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                  changeBadgeStyle(metrics[0]?.changeDirection ?? "neutral")
                )}
              >
                {#if (metrics[0]?.changeDirection ?? "neutral") === "up"}
                  <ArrowUp class="h-3 w-3 text-emerald-600" />
                {:else if (metrics[0]?.changeDirection ?? "neutral") === "down"}
                  <ArrowDown class="h-3 w-3 text-red-500" />
                {:else}
                  <ArrowRight class="h-3 w-3 text-muted-foreground" />
                {/if}
                {metrics[0]?.change ?? "--"}
              </span>
              <span class="text-[10px] text-muted-foreground">vs prev. period</span>
            </div>
          </div>
          <svg viewBox="0 0 80 28" fill="none" class="w-28 h-10 opacity-80">
            <polyline
              points={sparklinePoints(sparkData[0])}
              stroke={sparkColors[0]}
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
            <polyline
              points={`2,28 ${sparklinePoints(sparkData[0])} 78,28`}
              fill={sparkColors[0]}
              fill-opacity="0.08"
            />
          </svg>
        </div>
        {#if metrics.length > 1}
          <div class="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-3">
            {#each metrics.slice(1, 4) as m, idx (m.label)}
              {@const sData = sparkData[(idx + 1) % sparkData.length]}
              {@const sColor = sparkColors[(idx + 1) % sparkColors.length]}
              {@const sPts = sparklinePoints(sData)}
              <div class="space-y-0.5">
                <p
                  class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate"
                >
                  {m.label}
                </p>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-base font-semibold tabular-nums">{m.value}</span>
                  <span
                    class={cn(
                      "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
                      m.changeDirection === "up"
                        ? "text-emerald-600"
                        : m.changeDirection === "down"
                          ? "text-red-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {#if m.changeDirection === "up"}
                      <ArrowUp class="h-3 w-3 text-emerald-600" />
                    {:else if m.changeDirection === "down"}
                      <ArrowDown class="h-3 w-3 text-red-500" />
                    {:else}
                      <ArrowRight class="h-3 w-3 text-muted-foreground" />
                    {/if}
                    {m.change}
                  </span>
                </div>
                <svg viewBox="0 0 80 28" fill="none" class="w-full h-4 mt-0.5 opacity-60">
                  <polyline
                    points={sPts}
                    stroke={sColor}
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none"
                  />
                  <polyline points={`2,28 ${sPts} 78,28`} fill={sColor} fill-opacity="0.08" />
                </svg>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="col-span-1 sm:col-span-2 rounded-2xl border bg-background p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <FileText class="h-3.5 w-3.5" />
            Data Preview
          </div>
          <div class={cn(badgeBase, "text-foreground text-[10px] tabular-nums")}>
            {dataPreview.rows.length} of {rowCount.toLocaleString()}
          </div>
        </div>
        <div class="relative h-[156px] overflow-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 z-10">
              <tr class="border-b bg-muted/50 backdrop-blur-sm">
                {#each dataPreview.headers as h (h)}
                  <th
                    class="pb-2 pt-1 pr-4 text-left font-semibold text-muted-foreground text-[10px] uppercase tracking-wider"
                  >
                    {h}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each dataPreview.rows as row, ri (ri)}
                <tr
                  class="border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {#each row as cell, ci (ci)}
                    <td
                      class={cn(
                        "py-2 pr-4 tabular-nums",
                        ci === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {#if ci === row.length - 1}
                        <span
                          class={cn(
                            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border",
                            cell === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40"
                              : cell === "Refunded"
                                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40"
                                : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          )}
                        >
                          {cell}
                        </span>
                      {:else}
                        {cell}
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div
        class={cn(
          "col-span-1 rounded-2xl border p-4 shadow-sm ring-1 flex flex-col items-center justify-center gap-2",
          "bg-amber-50/50 dark:bg-amber-950/20 ring-amber-500/10"
        )}
      >
        <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Data Quality
        </p>
        <svg width={64} height={64} viewBox="0 0 56 56" class="shrink-0">
          <circle
            cx="28"
            cy="28"
            r={donutR}
            fill="none"
            stroke="currentColor"
            stroke-width="5"
            class="text-muted/40"
          />
          <circle
            cx="28"
            cy="28"
            r={donutR}
            fill="none"
            stroke="#f59e0b"
            stroke-width="5"
            stroke-linecap="round"
            stroke-dasharray={donutCirc}
            stroke-dashoffset={donutOffset}
            transform="rotate(-90 28 28)"
            class="transition-all duration-700"
          />
          <text
            x="28"
            y="30"
            text-anchor="middle"
            dominant-baseline="middle"
            class="fill-foreground text-[10px] font-semibold"
            style="font-family: var(--font-sans, system-ui)"
          >
            {Math.round(qualityPct * 100)}%
          </text>
        </svg>
        <div class="text-center space-y-0.5">
          <p class="text-xs font-semibold tabular-nums">{missingPct}% missing</p>
          <p class="text-[10px] text-muted-foreground">across {columnCount} columns</p>
        </div>
      </div>

      <div class="col-span-1 sm:col-span-2 rounded-2xl border bg-background p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <BarChart3 class="h-3.5 w-3.5 text-blue-500" />
            Revenue by Category
          </div>
          <span class="text-[10px] text-muted-foreground tabular-nums">
            Total ${(totalDist / 1000000).toFixed(1)}M
          </span>
        </div>
        <div class="space-y-2.5">
          {#each distribution as d, i (d.label)}
            {@const pct = (d.value / d.maxValue) * 100}
            <div class="group space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-foreground">{d.label}</span>
                <span
                  class="font-semibold tabular-nums text-muted-foreground group-hover:text-foreground transition-colors"
                >
                  ${(d.value / 1000).toFixed(0)}K
                  <span class="text-[10px] ml-1 text-muted-foreground">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  class={cn(
                    "h-full rounded-full transition-all duration-500",
                    distColors[i % distColors.length]
                  )}
                  style="width: {pct}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div
        class={cn(
          "col-span-1 rounded-2xl border p-4 shadow-sm ring-1 flex flex-col justify-between",
          "bg-emerald-50/50 dark:bg-emerald-950/20 ring-emerald-500/10"
        )}
      >
        <div class="space-y-1">
          <p class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Trend
          </p>
          <div class="flex items-center gap-1.5">
            <TrendingUp class="h-4 w-4 text-emerald-500" />
            <span class="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +12.3%
            </span>
          </div>
          <p class="text-[10px] text-muted-foreground leading-relaxed">
            Revenue trending upward over the last 7 periods
          </p>
        </div>
        <svg viewBox="0 0 80 28" fill="none" class="w-full h-8 mt-2 opacity-70">
          <polyline
            points={sparklinePoints([28, 35, 32, 42, 48, 45, 58])}
            stroke="#10b981"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
          <polyline
            points={`2,28 ${sparklinePoints([28, 35, 32, 42, 48, 45, 58])} 78,28`}
            fill="#10b981"
            fill-opacity="0.08"
          />
        </svg>
      </div>

      <div class="col-span-1 sm:col-span-2 lg:col-span-4 rounded-2xl border bg-background p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <Search class="h-3.5 w-3.5 text-zinc-500" />
            Insights
          </div>
          <div
            class={cn(
              badgeBase,
              "bg-zinc-50 text-zinc-700 border border-zinc-200 text-[10px] dark:bg-zinc-950/40 dark:text-zinc-300 dark:border-zinc-800/50"
            )}
          >
            {insights.length} findings
          </div>
        </div>
        <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {#each insights as insight (insight.id)}
            <div
              class="rounded-xl border p-3.5 space-y-2.5 transition-shadow hover:shadow-lg shadow-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <div
                  class={cn(
                    "flex items-center justify-center h-6 w-6 rounded-lg shrink-0",
                    categoryStyle[insight.category]
                  )}
                >
                  {#if insight.category === "trend"}
                    <TrendingUp class="h-3.5 w-3.5" />
                  {:else if insight.category === "anomaly"}
                    <AlertTriangle class="h-3.5 w-3.5" />
                  {:else if insight.category === "correlation"}
                    <GitBranch class="h-3.5 w-3.5" />
                  {:else}
                    <Lightbulb class="h-3.5 w-3.5" />
                  {/if}
                </div>
                <div
                  class={cn(
                    badgeBase,
                    "text-[10px] shrink-0 px-1.5 py-0",
                    categoryStyle[insight.category]
                  )}
                >
                  {insight.category}
                </div>
              </div>
              <div class="space-y-1">
                <p class="text-sm font-semibold leading-tight">{insight.title}</p>
                <p class="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  {insight.description}
                </p>
              </div>
              <div class="flex items-center gap-2 pt-0.5">
                <div class="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    class={cn(
                      "h-full rounded-full transition-all duration-500",
                      insight.confidence >= 85
                        ? "bg-blue-500"
                        : insight.confidence >= 70
                          ? "bg-sky-500"
                          : "bg-slate-400"
                    )}
                    style="width: {insight.confidence}%"
                  ></div>
                </div>
                <span class="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {insight.confidence}%
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(
            btnBase,
            "h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-primary-foreground px-3"
          )}
          onclick={() => onExport?.()}
        >
          <FileText class="mr-1.5 h-3.5 w-3.5" />
          Export insights
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Export all insights as a report
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(
            btnBase,
            "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-lg text-xs font-medium px-3"
          )}
          onclick={() => onDeeperAnalysis?.()}
        >
          <Sparkles class="mr-1.5 h-3.5 w-3.5" />
          Deeper analysis
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Perform advanced statistical analysis
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(
            btnBase,
            "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-lg text-xs font-medium px-3"
          )}
          onclick={() => onAskFollowUp?.()}
        >
          <MessageSquare class="mr-1.5 h-3.5 w-3.5" />
          Follow-up
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Ask the agent a follow-up question about the data
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(
            btnBase,
            "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 h-8 rounded-lg text-xs font-medium px-3"
          )}
          onclick={() => onDownload?.()}
        >
          <Download class="mr-1.5 h-3.5 w-3.5" />
          Download
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Download the analyzed dataset
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  </div>
</Tooltip.Provider>
