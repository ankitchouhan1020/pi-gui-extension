<script lang="ts" module>
  export type ResearchDepth = "quick" | "standard" | "deep";
  export type ThreatLevel = "low" | "medium" | "high";

  export interface Competitor {
    name: string;
    description: string;
    category: string;
    strengths: string[];
    weaknesses: string[];
    threatLevel: ThreatLevel;
    marketPosition: string;
  }

  export interface ComparisonFeature {
    feature: string;
    competitorScores: Record<string, boolean>;
  }

  export interface AgentCompetitorResearchProps {
    query?: string;
    researchDepth?: ResearchDepth;
    competitors?: Competitor[];
    comparisonFeatures?: ComparisonFeature[];
    keyFindings?: string[];
    sourcesCount?: number;
    lastUpdated?: string;
    isResearching?: boolean;
    onExport?: () => void;
    onDeepenResearch?: () => void;
    onRefresh?: () => void;
    onCompareFeature?: (feature: string) => void;
    class?: string;
  }

  interface RadarDimension {
    label: string;
    key: string;
  }

  const RADAR_DIMS: RadarDimension[] = [
    { label: "Features", key: "features" },
    { label: "Pricing", key: "pricing" },
    { label: "UX", key: "ux" },
    { label: "Market Share", key: "marketShare" },
    { label: "Innovation", key: "innovation" },
  ];

  const COMPETITOR_COLORS = [
    {
      stroke: "#6366f1",
      fill: "rgba(99,102,241,0.15)",
      ring: "ring-indigo-500",
      bg: "bg-indigo-500",
      text: "text-indigo-600 dark:text-indigo-400",
      label: "indigo",
    },
    {
      stroke: "#f59e0b",
      fill: "rgba(245,158,11,0.13)",
      ring: "ring-amber-500",
      bg: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      label: "amber",
    },
    {
      stroke: "#10b981",
      fill: "rgba(16,185,129,0.13)",
      ring: "ring-emerald-500",
      bg: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "emerald",
    },
    {
      stroke: "#ef4444",
      fill: "rgba(239,68,68,0.13)",
      ring: "ring-red-500",
      bg: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
      label: "red",
    },
    {
      stroke: "#64748b",
      fill: "rgba(100,116,139,0.13)",
      ring: "ring-slate-500",
      bg: "bg-slate-500",
      text: "text-slate-600 dark:text-slate-400",
      label: "slate",
    },
  ];

  const DEFAULT_RADAR_SCORES: Record<string, number[]> = {
    Asana: [0.85, 0.55, 0.8, 0.9, 0.65],
    "Monday.com": [0.8, 0.5, 0.9, 0.75, 0.7],
    ClickUp: [0.92, 0.85, 0.6, 0.55, 0.9],
  };

  const defaultCompetitors: Competitor[] = [
    {
      name: "Asana",
      description: "Work management platform focused on team coordination and project tracking.",
      category: "Project Management",
      strengths: [
        "Intuitive timeline views",
        "Strong integrations ecosystem",
        "Enterprise-grade permissions",
      ],
      weaknesses: [
        "Steep pricing at scale",
        "Limited native time tracking",
        "Complex onboarding for large teams",
      ],
      threatLevel: "high",
      marketPosition: "Market leader",
    },
    {
      name: "Monday.com",
      description: "Visual work OS enabling teams to build custom workflows without code.",
      category: "Work Management",
      strengths: [
        "Highly customizable boards",
        "No-code automations",
        "Attractive visual interface",
      ],
      weaknesses: [
        "Can feel overwhelming for simple use cases",
        "Expensive per-seat pricing",
        "Reporting limitations",
      ],
      threatLevel: "medium",
      marketPosition: "Strong challenger",
    },
    {
      name: "ClickUp",
      description: "All-in-one productivity platform combining docs, tasks, and goals.",
      category: "Productivity Suite",
      strengths: [
        "Feature-rich free tier",
        "Built-in docs and whiteboards",
        "Aggressive product velocity",
      ],
      weaknesses: [
        "Performance issues on large workspaces",
        "Inconsistent UX across features",
        "Notification overload",
      ],
      threatLevel: "medium",
      marketPosition: "Fast mover",
    },
  ];

  const defaultFeatures: ComparisonFeature[] = [
    {
      feature: "Custom workflows",
      competitorScores: { Asana: true, "Monday.com": true, ClickUp: true },
    },
    {
      feature: "Native time tracking",
      competitorScores: { Asana: false, "Monday.com": true, ClickUp: true },
    },
    {
      feature: "Built-in docs",
      competitorScores: { Asana: false, "Monday.com": false, ClickUp: true },
    },
    {
      feature: "Gantt charts",
      competitorScores: { Asana: true, "Monday.com": true, ClickUp: true },
    },
    {
      feature: "Free tier available",
      competitorScores: { Asana: true, "Monday.com": false, ClickUp: true },
    },
  ];

  const defaultFindings: string[] = [
    "Asana dominates enterprise adoption with superior permission controls and SSO integrations.",
    "Monday.com is winning mid-market deals through no-code automation and visual appeal.",
    "ClickUp threatens incumbents with aggressive free-tier strategy and rapid feature shipping.",
    "All three competitors lack native AI-powered task prioritization, representing a key differentiator opportunity.",
  ];

  const swotData: Record<string, { opportunities: string[]; threats: string[] }> = {
    Asana: {
      opportunities: ["Enterprise AI integrations", "Government / compliance verticals"],
      threats: ["Feature-rich free competitors", "Market saturation in PM space"],
    },
    "Monday.com": {
      opportunities: ["Expanding CRM adjacency", "Vertical-specific templates"],
      threats: ["ClickUp undercutting on price", "Notion expanding into PM"],
    },
    ClickUp: {
      opportunities: ["All-in-one platform consolidation", "Developer workflow capture"],
      threats: ["Quality perception issues", "Enterprise trust gap"],
    },
  };

  const numberColors = ["bg-blue-500", "bg-slate-500", "bg-amber-500", "bg-emerald-500"];

  const btnBase =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 ring-ring/10 dark:ring-ring/20 dark:outline-ring/40 outline-ring/50 focus-visible:ring-4 focus-visible:outline-1";

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function radarPoints(cx: number, cy: number, maxR: number, values: number[]): string {
    const step = 360 / values.length;
    return values
      .map((v, i) => {
        const { x, y } = polarToCartesian(cx, cy, maxR * v, step * i);
        return `${x},${y}`;
      })
      .join(" ");
  }
</script>

<script lang="ts">
  import { Tooltip } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import Loader2 from "@lucide/svelte/icons/loader-circle";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShieldAlert from "@lucide/svelte/icons/shield-alert";
  import Telescope from "@lucide/svelte/icons/telescope";
  import X from "@lucide/svelte/icons/x";
  import Zap from "@lucide/svelte/icons/zap";
  import { cn } from "$lib/utils.js";

  let {
    query: queryProp,
    researchDepth: depthProp,
    competitors: competitorsProp,
    comparisonFeatures: featuresProp,
    keyFindings: findingsProp,
    sourcesCount: sourcesProp,
    lastUpdated: updatedProp,
    isResearching = false,
    onExport,
    onDeepenResearch,
    onRefresh,
    onCompareFeature,
    class: className,
  }: AgentCompetitorResearchProps = $props();

  const query = $derived(queryProp ?? "Project management tools");
  const researchDepth = $derived(depthProp ?? "standard");
  const competitors = $derived(competitorsProp ?? defaultCompetitors);
  const comparisonFeatures = $derived(featuresProp ?? defaultFeatures);
  const keyFindings = $derived(findingsProp ?? defaultFindings);
  const sourcesCount = $derived(sourcesProp ?? 42);
  const lastUpdated = $derived(updatedProp ?? "Updated 5 min ago");
  const competitorNames = $derived(competitors.map((c) => c.name));

  let selectedIdx = $state(0);
  const selected = $derived(competitors[selectedIdx] ?? competitors[0]);

  const depthPct = $derived(
    researchDepth === "quick" ? 33 : researchDepth === "standard" ? 66 : 100
  );
  const depthR = 20;
  const depthCirc = 2 * Math.PI * depthR;
  const depthOffset = $derived(depthCirc - (depthPct / 100) * depthCirc);
  const depthColorClass = $derived(
    researchDepth === "quick"
      ? "stroke-zinc-400"
      : researchDepth === "standard"
        ? "stroke-blue-500"
        : "stroke-indigo-500"
  );

  const threatPosition = $derived(
    selected.threatLevel === "low" ? 15 : selected.threatLevel === "medium" ? 50 : 85
  );

  const radarSize = 280;
  const radarCx = radarSize / 2;
  const radarCy = radarSize / 2;
  const radarMaxR = radarSize / 2 - 36;
  const radarLevels = 4;
  const radarStep = 360 / RADAR_DIMS.length;

  const tooltipContentClass =
    "bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900 z-50 max-w-sm rounded-md px-3 py-1.5 text-xs";
</script>

<Tooltip.Provider delayDuration={0}>
  <div class={cn("space-y-5 p-4", className)}>
    <div class="relative overflow-hidden rounded-2xl border bg-card dark:bg-zinc-900 p-5 shadow-sm">
      <div
        class="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl"
      ></div>

      <div
        class="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div class="space-y-1">
          <div
            class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            <Telescope class="h-3.5 w-3.5" />
            Competitor Intelligence
            {#if isResearching}
              <Loader2 class="h-3.5 w-3.5 animate-spin text-indigo-500" />
            {/if}
          </div>
          <h2 class="text-lg font-semibold tracking-tight">&ldquo;{query}&rdquo;</h2>
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span class="flex items-center gap-1">
              <Search class="h-3 w-3" />
              {sourcesCount} sources
            </span>
            <span>{lastUpdated}</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="relative flex items-center justify-center" style="width: 52px; height: 52px">
            <svg width={52} height={52} class="-rotate-90">
              <circle
                cx={26}
                cy={26}
                r={depthR}
                fill="none"
                stroke-width={4}
                class="stroke-zinc-100 dark:stroke-zinc-800"
              />
              <circle
                cx={26}
                cy={26}
                r={depthR}
                fill="none"
                stroke-width={4}
                stroke-linecap="round"
                stroke-dasharray={depthCirc}
                stroke-dashoffset={depthOffset}
                class={cn(depthColorClass, "transition-all duration-700")}
              />
            </svg>
            <span class="absolute text-[10px] font-bold text-zinc-700 dark:text-zinc-300"
              >{depthPct}%</span
            >
          </div>
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight"
          >
            {researchDepth}
            <br />
            depth
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-center gap-3">
      {#each competitors as c, i (c.name)}
        {@const color = COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}
        {@const isActive = i === selectedIdx}
        <Tooltip.Root>
          <Tooltip.Trigger
            onclick={() => (selectedIdx = i)}
            class={cn(
              "relative flex items-center justify-center rounded-full font-bold transition-all duration-300 select-none",
              isActive
                ? "h-14 w-14 text-base ring-[3px] shadow-lg scale-110"
                : "h-10 w-10 text-xs ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-2 opacity-70 hover:opacity-100",
              isActive && color.ring,
              color.bg,
              "text-white"
            )}
          >
            {c.name.charAt(0)}
            {#if isActive}
              <span
                class="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-zinc-400 dark:bg-zinc-500"
              ></span>
            {/if}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
              {c.name} · {c.marketPosition}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      {/each}
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <div class="rounded-2xl border bg-background p-5 shadow-sm">
        <h3 class="text-sm font-semibold mb-1">Competitive Radar</h3>
        <p class="text-[11px] text-muted-foreground mb-3">
          Multi-dimensional comparison across all competitors
        </p>

        <svg viewBox={`0 0 ${radarSize} ${radarSize}`} class="w-full max-w-[280px] mx-auto">
          {#each Array.from({ length: radarLevels }, (_, i) => i) as i (i)}
            {@const r = (radarMaxR / radarLevels) * (i + 1)}
            {@const pts = RADAR_DIMS.map((_, di) => {
              const { x, y } = polarToCartesian(radarCx, radarCy, r, radarStep * di);
              return `${x},${y}`;
            }).join(" ")}
            <polygon
              points={pts}
              fill="none"
              stroke="currentColor"
              class="text-zinc-200 dark:text-zinc-700/60"
              stroke-width={i === radarLevels - 1 ? 1.2 : 0.6}
            />
          {/each}

          {#each RADAR_DIMS as _, i (i)}
            {@const { x, y } = polarToCartesian(radarCx, radarCy, radarMaxR, radarStep * i)}
            <line
              x1={radarCx}
              y1={radarCy}
              x2={x}
              y2={y}
              stroke="currentColor"
              class="text-zinc-200 dark:text-zinc-700/60"
              stroke-width={0.6}
            />
          {/each}

          {#each competitors as c, ci (c.name)}
            {@const vals = DEFAULT_RADAR_SCORES[c.name] ?? RADAR_DIMS.map(() => 0.5)}
            {@const color = COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length]}
            <polygon
              points={radarPoints(radarCx, radarCy, radarMaxR, vals)}
              fill={color.fill}
              stroke={color.stroke}
              stroke-width={2}
              stroke-linejoin="round"
            />
          {/each}

          {#each competitors as c, ci (c.name + "-dots")}
            {@const vals = DEFAULT_RADAR_SCORES[c.name] ?? RADAR_DIMS.map(() => 0.5)}
            {@const color = COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length]}
            {#each vals as v, di (`${c.name}-${di}`)}
              {@const { x, y } = polarToCartesian(
                radarCx,
                radarCy,
                radarMaxR * v,
                radarStep * di
              )}
              <circle cx={x} cy={y} r={3} fill={color.stroke} />
            {/each}
          {/each}

          {#each RADAR_DIMS as d, i (d.key)}
            {@const { x, y } = polarToCartesian(radarCx, radarCy, radarMaxR + 22, radarStep * i)}
            <text
              x={x}
              y={y}
              text-anchor="middle"
              dominant-baseline="central"
              class="fill-zinc-500 dark:fill-zinc-400 text-[9px] font-medium"
            >
              {d.label}
            </text>
          {/each}
        </svg>

        <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
          {#each competitors as c, i (c.name)}
            {@const color = COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}
            <span
              class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
            >
              <span
                class="inline-block h-2 w-2 rounded-full"
                style="background: {color.stroke}"
              ></span>
              {c.name}
            </span>
          {/each}
        </div>
      </div>

      <div class="rounded-2xl border bg-background p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold">SWOT Analysis</h3>
            <p class="text-[11px] text-muted-foreground">
              {selected.name} · {selected.category}
            </p>
          </div>
          <div class="w-full max-w-[180px]">
            <div class="relative h-2.5 rounded-full overflow-hidden">
              <div
                class="absolute inset-0 rounded-full"
                style="background: linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)"
              ></div>
              <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-900 shadow-md transition-all duration-500"
                style="left: {threatPosition}%; background: {selected.threatLevel === 'low'
                  ? '#22c55e'
                  : selected.threatLevel === 'medium'
                    ? '#eab308'
                    : '#ef4444'}"
              ></div>
            </div>
            <div class="flex justify-between mt-1 text-[9px] text-muted-foreground font-medium">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div
            class="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 p-3"
          >
            <div
              class="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 uppercase tracking-wider"
            >
              <Check class="h-3 w-3" /> Strengths
            </div>
            <ul class="space-y-1">
              {#each selected.strengths.slice(0, 3) as s (s)}
                <li class="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-tight">
                  {s}
                </li>
              {/each}
            </ul>
          </div>

          <div
            class="rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 p-3"
          >
            <div
              class="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-400 mb-1.5 uppercase tracking-wider"
            >
              <X class="h-3 w-3" /> Weaknesses
            </div>
            <ul class="space-y-1">
              {#each selected.weaknesses.slice(0, 3) as w (w)}
                <li class="text-[11px] text-red-900/80 dark:text-red-200/80 leading-tight">{w}</li>
              {/each}
            </ul>
          </div>

          <div
            class="rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 p-3"
          >
            <div
              class="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-1.5 uppercase tracking-wider"
            >
              <Zap class="h-3 w-3" /> Opportunities
            </div>
            <ul class="space-y-1">
              {#each swotData[selected.name]?.opportunities ?? [
                "Emerging market segments",
                "Product differentiation",
              ] as o (o)}
                <li class="text-[11px] text-blue-900/80 dark:text-blue-200/80 leading-tight">{o}</li>
              {/each}
            </ul>
          </div>

          <div
            class="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-3"
          >
            <div
              class="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1.5 uppercase tracking-wider"
            >
              <ShieldAlert class="h-3 w-3" /> Threats
            </div>
            <ul class="space-y-1">
              {#each swotData[selected.name]?.threats ?? [
                "Increasing competition",
                "Market consolidation",
              ] as t (t)}
                <li class="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-tight">
                  {t}
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border bg-background p-5 shadow-sm">
      <h3 class="text-sm font-semibold">Feature Comparison</h3>
      <p class="text-[11px] text-muted-foreground mb-4">
        Capability dot matrix across competitors
      </p>

      <div class="max-h-[260px] overflow-auto">
        <div class="space-y-0">
          <div
            class="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2"
          >
            <div class="w-36 shrink-0 text-[11px] font-medium text-muted-foreground">Feature</div>
            {#each competitorNames as name, ci (name)}
              {@const color = COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length]}
              <div class="flex-1 text-center">
                <span class="text-[10px] font-semibold" style="color: {color.stroke}">{name}</span>
              </div>
            {/each}
          </div>

          {#each comparisonFeatures as row (row.feature)}
            <div
              class="flex items-center gap-2 py-2 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 rounded-lg transition-colors px-1"
            >
              <div class="w-36 shrink-0">
                <button
                  type="button"
                  class="text-[11px] font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                  onclick={() => onCompareFeature?.(row.feature)}
                >
                  {row.feature}
                </button>
              </div>
              {#each competitorNames as name, ci (name)}
                {@const color = COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length]}
                {@const has = row.competitorScores[name]}
                <div class="flex-1 flex justify-center">
                  <span
                    class={cn(
                      "h-3.5 w-3.5 rounded-full border-2 transition-all duration-300",
                      has ? "scale-100" : "scale-75 opacity-30"
                    )}
                    style="border-color: {color.stroke}; background: {has
                      ? color.stroke
                      : 'transparent'}"
                  ></span>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>

      <div
        class="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800"
      >
        <span class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span class="h-2.5 w-2.5 rounded-full bg-zinc-400"></span> Has feature
        </span>
        <span class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            class="h-2.5 w-2.5 rounded-full border-2 border-zinc-300 dark:border-zinc-600"
          ></span> Missing
        </span>
      </div>
    </div>

    <div>
      <h3 class="text-sm font-semibold flex items-center gap-2 mb-3">
        <Zap class="h-4 w-4 text-indigo-500" />
        Key Findings
      </h3>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each keyFindings as finding, index (index)}
          <div
            class="group relative overflow-hidden rounded-xl border bg-background p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            <span
              class="absolute -top-2 -left-1 text-5xl font-black text-zinc-300 dark:text-zinc-700 opacity-20 group-hover:opacity-30 transition-opacity select-none"
            >
              {index + 1}
            </span>
            <div class="relative">
              <span
                class={cn(
                  "inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold text-white mb-2",
                  numberColors[index % numberColors.length]
                )}
              >
                {index + 1}
              </span>
              <p class="text-xs text-muted-foreground leading-relaxed">{finding}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(btnBase, "h-8 bg-indigo-600 hover:bg-indigo-700 text-white px-3")}
          onclick={() => onExport?.()}
        >
          <Download class="mr-1.5 h-3.5 w-3.5" />
          Export report
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Download the full competitive analysis as PDF
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          class={cn(
            btnBase,
            "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3"
          )}
          onclick={() => onDeepenResearch?.()}
        >
          <Telescope class="mr-1.5 h-3.5 w-3.5" />
          Deepen research
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={4} class={tooltipContentClass}>
            Run a deeper pass with more sources and analysis
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <button
        type="button"
        class={cn(
          btnBase,
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 px-3"
        )}
        onclick={() => onCompareFeature?.("")}
      >
        <Search class="mr-1.5 h-3.5 w-3.5" />
        Compare features
      </button>
      <button
        type="button"
        class={cn(btnBase, "hover:bg-accent hover:text-accent-foreground h-8 px-3")}
        onclick={() => onRefresh?.()}
      >
        <RefreshCw class={cn("mr-1.5 h-3.5 w-3.5", isResearching && "animate-spin")} />
        Refresh data
      </button>
    </div>
  </div>
</Tooltip.Provider>
