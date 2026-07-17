<script lang="ts">
  import { cn } from "$lib/utils";
  import { badge, btn } from "./_btn.js";
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import Check from "@lucide/svelte/icons/check";
  import Code2 from "@lucide/svelte/icons/code-2";
  import Copy from "@lucide/svelte/icons/copy";
  import FileText from "@lucide/svelte/icons/file-text";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Pencil from "@lucide/svelte/icons/pencil";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Table2 from "@lucide/svelte/icons/table-2";
  import X from "@lucide/svelte/icons/x";
  import type { Component } from "svelte";

  export type ArtifactType = "code" | "table" | "document" | "chart";

  export interface ArtifactVersion {
    id: string;
    label: string;
    timestamp: string;
    content: string;
  }

  export interface ArtifactMetadata {
    generationTime?: string;
    model?: string;
    tokens?: number;
    size?: string;
  }

  export interface AgentArtifactProps {
    title?: string;
    artifactType?: ArtifactType;
    content?: string;
    language?: string;
    versions?: ArtifactVersion[];
    currentVersion?: string;
    isGenerating?: boolean;
    metadata?: ArtifactMetadata;
    class?: string;
    onCopy?: () => void;
    onDownload?: () => void;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onShare?: () => void;
    onVersionChange?: (versionId: string) => void;
  }

  const typeConfig: Record<
    ArtifactType,
    { label: string; icon: Component; ext: string }
  > = {
    code: { label: "Code", icon: Code2, ext: ".tsx" },
    table: { label: "Table", icon: Table2, ext: ".csv" },
    document: { label: "Document", icon: FileText, ext: ".md" },
    chart: { label: "Chart", icon: Sparkles, ext: ".svg" },
  };

  const defaultVersions: ArtifactVersion[] = [
    {
      id: "v1",
      label: "v1",
      timestamp: "10:02 AM",
      content:
        "Region,Revenue,Deals,Win Rate,Avg Deal\nNorth America,$1.24M,86,74%,$14.4k\nEurope,$980K,72,68%,$13.6k\nAPAC,$640K,54,71%,$11.8k\nLATAM,$310K,31,62%,$10.0k\nMEA,$185K,18,58%,$10.3k",
    },
    {
      id: "v2",
      label: "v2",
      timestamp: "10:14 AM",
      content:
        "Region,Revenue,Deals,Win Rate,Avg Deal,QoQ Growth\nNorth America,$1.24M,86,74%,$14.4k,+12%\nEurope,$980K,72,68%,$13.6k,+8%\nAPAC,$640K,54,71%,$11.8k,+18%\nLATAM,$310K,31,62%,$10.0k,+5%\nMEA,$185K,18,58%,$10.3k,+22%",
    },
  ];

  const defaultMetadata: ArtifactMetadata = {
    generationTime: "1.4s",
    model: "Claude Opus 4",
    tokens: 1240,
    size: "2.1 KB",
  };

  function parseCSV(csv: string): { headers: string[]; rows: string[][] } {
    const lines = csv.trim().split("\n");
    const headers = lines[0]?.split(",") ?? [];
    const rows = lines.slice(1).map((line) => line.split(","));
    return { headers, rows };
  }

  type Token = { text: string; className: string };

  function highlightLine(line: string): Token[] {
    const tokens: Token[] = [];
    let remaining = line;

    const rules: { regex: RegExp; className: string }[] = [
      { regex: /^(\/\/.*)/, className: "text-zinc-500 italic" },
      { regex: /^("[^"]*"|'[^']*'|`[^`]*`)/, className: "text-emerald-400" },
      { regex: /^(\b\d+\.?\d*\b)/, className: "text-amber-300" },
      {
        regex:
          /^(\b(?:import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|new|this|async|await|default|null|undefined|true|false)\b)/,
        className: "text-slate-400 font-medium",
      },
      { regex: /^(\b[A-Z][a-zA-Z0-9]*\b)/, className: "text-cyan-300" },
      { regex: /^([{}()\[\];:,.<>=!&|?+\-*/]+)/, className: "text-zinc-400" },
    ];

    while (remaining.length > 0) {
      let matched = false;
      for (const rule of rules) {
        const m = remaining.match(rule.regex);
        if (m) {
          tokens.push({ text: m[1], className: rule.className });
          remaining = remaining.slice(m[1].length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        const nextSpecial = remaining
          .slice(1)
          .search(/[/"'`\d\b{}()\[\];:,.<>=!&|?+\-*/A-Z]/);
        const end = nextSpecial === -1 ? remaining.length : nextSpecial + 1;
        tokens.push({ text: remaining.slice(0, end), className: "text-zinc-200" });
        remaining = remaining.slice(end);
      }
    }
    return tokens;
  }

  let {
    title = "Q4 Sales Performance",
    artifactType = "table",
    content,
    versions = defaultVersions,
    currentVersion = "v2",
    isGenerating = false,
    metadata = defaultMetadata,
    class: className,
    onCopy,
    onDownload,
    onEdit,
    onRegenerate,
    onShare,
    onVersionChange,
  }: AgentArtifactProps = $props();

  let activeTab = $state<"preview" | "code" | "raw">("preview");
  let activeVersion = $state("v2");
  let copied = $state(false);
  let showVersions = $state(false);

  $effect(() => {
    activeVersion = currentVersion;
  });

  const resolvedContent = $derived.by(() => {
    if (content) return content;
    const match = versions.find((v) => v.id === activeVersion);
    return match?.content ?? versions[versions.length - 1]?.content ?? "";
  });

  const config = $derived(typeConfig[artifactType]);
  const TypeIcon = $derived(config.icon);
  const tableData = $derived(
    artifactType === "table" ? parseCSV(resolvedContent) : null
  );
  const codeLines = $derived(resolvedContent.split("\n"));
  const docLines = $derived(resolvedContent.split("\n"));
  const tabs = [
    { id: "preview" as const, label: "Preview" },
    { id: "code" as const, label: "Code" },
    { id: "raw" as const, label: "Raw" },
  ];

  function handleVersionChange(id: string) {
    activeVersion = id;
    onVersionChange?.(id);
  }

  function handleCopy() {
    onCopy?.();
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  }
</script>

<div
  class={cn(
    "rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg bg-white dark:bg-zinc-950",
    className
  )}
>
  <div
    class="flex items-center h-10 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 select-none shrink-0"
  >
    <div class="flex items-center gap-[7px] mr-4">
      <div class="h-[11px] w-[11px] rounded-full bg-[#FF5F57] border border-[#E0443E]"></div>
      <div class="h-[11px] w-[11px] rounded-full bg-[#FEBC2E] border border-[#DEA123]"></div>
      <div class="h-[11px] w-[11px] rounded-full bg-[#28C840] border border-[#1AAB29]"></div>
    </div>

    <div class="flex-1 flex items-center justify-center gap-2 min-w-0">
      <TypeIcon class="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
      <span class="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
        {title}{config.ext}
      </span>
      {#if isGenerating}
        <span
          class="inline-flex items-center rounded-md border bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 text-[10px] py-0 px-1.5 animate-pulse font-semibold"
        >
          <Loader2 class="mr-1 h-2.5 w-2.5 animate-spin" />
          Generating
        </span>
      {/if}
    </div>

    <button
      type="button"
      class={btn(
        "ghost",
        "sm",
        cn(
          "h-6 px-2 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
          showVersions && "bg-zinc-200/80 dark:bg-zinc-700"
        )
      )}
      onclick={() => (showVersions = !showVersions)}
      title="Version history"
    >
      <GitBranch class="h-3 w-3 mr-1" />
      {activeVersion}
    </button>
  </div>

  <div class="flex items-end h-9 bg-zinc-100 dark:bg-zinc-800 px-2 gap-0 select-none shrink-0">
    {#each tabs as tab}
      {@const isActive = activeTab === tab.id}
      <button
        type="button"
        onclick={() => (activeTab = tab.id)}
        class={cn(
          "relative group flex items-center gap-1.5 px-4 h-[30px] text-[12px] font-medium rounded-t-lg transition-colors outline-none",
          isActive
            ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 z-10 border-t border-x border-zinc-200 dark:border-zinc-700 -mb-px"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
        )}
      >
        {tab.label}
        {#if isActive}
          <span class="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <X class="h-3 w-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
          </span>
        {/if}
      </button>
    {/each}
    <div class="flex-1 border-b border-zinc-200 dark:border-zinc-700"></div>
  </div>

  <div class="relative overflow-hidden">
    <div class="min-h-[200px]">
      {#if activeTab === "preview"}
        {#if artifactType === "table" && tableData}
          <div class="max-h-[420px] overflow-auto">
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse font-mono">
                <thead class="sticky top-0 z-10">
                  <tr class="bg-zinc-100 dark:bg-zinc-800">
                    <th
                      class="border-b border-r border-zinc-200 dark:border-zinc-700 px-1.5 py-2 text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500 w-[1%]"
                    >
                      #
                    </th>
                    {#each tableData.headers as h, i}
                      <th
                        class="border-b border-r border-zinc-200 dark:border-zinc-700 px-4 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 whitespace-nowrap"
                      >
                        {h.trim()}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each tableData.rows as row, i}
                    <tr
                      class={cn(
                        "transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-900/10",
                        i % 2 === 0
                          ? "bg-white dark:bg-zinc-950"
                          : "bg-zinc-50/80 dark:bg-zinc-900/50"
                      )}
                    >
                      <td
                        class="border-b border-r border-zinc-100 dark:border-zinc-800 px-1.5 py-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600"
                      >
                        {i + 1}
                      </td>
                      {#each row as cell}
                        <td
                          class="border-b border-r border-zinc-100 dark:border-zinc-800 px-4 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 whitespace-nowrap"
                        >
                          {cell.trim()}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if artifactType === "code"}
          <div class="bg-zinc-950 font-mono text-[13px] leading-6">
            <div class="max-h-[420px] overflow-auto">
              <table class="w-full border-collapse">
                <tbody>
                  {#each codeLines as line, i}
                    <tr class="hover:bg-white/[0.03]">
                      <td
                        class="select-none border-r border-zinc-800 px-4 py-0 text-right align-top text-zinc-600 w-[1%] whitespace-nowrap"
                      >
                        {i + 1}
                      </td>
                      <td class="px-4 py-0 whitespace-pre">
                        {#each highlightLine(line) as token, ti}
                          <span class={token.className}>{token.text}</span>
                        {/each}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          <div class="max-h-[420px] overflow-auto">
            <div class="bg-white dark:bg-zinc-950 px-8 py-6">
              <div class="mx-auto max-w-2xl space-y-1">
                {#each docLines as line, i}
                  {#if line.startsWith("# ")}
                    <h1
                      class="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-0 mb-3"
                    >
                      {line.slice(2)}
                    </h1>
                  {:else if line.startsWith("## ")}
                    <h2
                      class="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mt-6 mb-2"
                    >
                      {line.slice(3)}
                    </h2>
                  {:else if line.startsWith("### ")}
                    <h3
                      class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mt-4 mb-1"
                    >
                      {line.slice(4)}
                    </h3>
                  {:else if line.startsWith("- ")}
                    <li
                      class="text-sm text-zinc-600 dark:text-zinc-400 ml-5 list-disc leading-relaxed"
                    >
                      {line.slice(2)}
                    </li>
                  {:else if line.trim() === ""}
                    <div class="h-3"></div>
                  {:else}
                    <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {line}
                    </p>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
        {/if}
      {:else if activeTab === "code"}
        <div class="bg-zinc-950 font-mono text-[13px] leading-6">
          <div class="max-h-[420px] overflow-auto">
            <table class="w-full border-collapse">
              <tbody>
                {#each codeLines as line, i}
                  <tr class="hover:bg-white/[0.03]">
                    <td
                      class="select-none border-r border-zinc-800 px-4 py-0 text-right align-top text-zinc-600 w-[1%] whitespace-nowrap"
                    >
                      {i + 1}
                    </td>
                    <td class="px-4 py-0 whitespace-pre">
                      {#each highlightLine(line) as token}
                        <span class={token.className}>{token.text}</span>
                      {/each}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <div class="bg-zinc-950 font-mono text-[13px] leading-6">
          <div class="max-h-[420px] overflow-auto">
            <pre class="px-5 py-4 whitespace-pre-wrap text-zinc-400">{resolvedContent}</pre>
          </div>
        </div>
      {/if}
    </div>

    <div
      class={cn(
        "absolute right-0 top-0 bottom-0 z-20 w-64 border-l border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm transition-transform duration-200",
        showVersions ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div
        class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5"
      >
        <span
          class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
        >
          <GitBranch class="h-3 w-3" />
          Version History
        </span>
        <button
          type="button"
          class={btn("ghost", "sm", "h-6 w-6 p-0")}
          onclick={() => (showVersions = false)}
        >
          <X class="h-3 w-3" />
        </button>
      </div>
      <div class="p-4 space-y-0">
        {#each [...versions].reverse() as v, i}
          {@const isActive = v.id === activeVersion}
          {@const isLast = i === versions.length - 1}
          <div class="flex gap-3 relative">
            <div class="flex flex-col items-center">
              <div
                class={cn(
                  "h-3 w-3 rounded-full border-2 shrink-0 mt-0.5 transition-colors",
                  isActive
                    ? "bg-blue-500 border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                )}
              ></div>
              {#if !isLast}
                <div class="w-px flex-1 bg-zinc-200 dark:bg-zinc-700 min-h-[28px]"></div>
              {/if}
            </div>
            <button
              type="button"
              onclick={() => handleVersionChange(v.id)}
              class={cn(
                "flex-1 text-left rounded-md px-2.5 py-1.5 -mt-0.5 mb-2 transition-colors",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
            >
              <div class="flex items-center gap-2">
                <span
                  class={cn(
                    "inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-semibold",
                    isActive
                      ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                  )}
                >
                  {v.label}
                </span>
                {#if isActive}
                  <span
                    class="text-[9px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider"
                  >
                    current
                  </span>
                {/if}
              </div>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {v.timestamp}
              </p>
            </button>
          </div>
        {/each}
      </div>
    </div>

    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
      <div
        class="flex items-center gap-1 rounded-full border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-lg px-2 py-1"
      >
        <button
          type="button"
          class={btn("ghost", "sm", "h-7 w-7 p-0 rounded-full")}
          onclick={handleCopy}
          title={copied ? "Copied!" : "Copy"}
        >
          {#if copied}
            <Check class="h-3.5 w-3.5 text-emerald-500" />
          {:else}
            <Copy class="h-3.5 w-3.5" />
          {/if}
        </button>

        <button
          type="button"
          class={btn("ghost", "sm", "h-7 w-7 p-0 rounded-full")}
          onclick={() => onDownload?.()}
          title="Download"
        >
          <ArrowDownToLine class="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          class={btn("ghost", "sm", "h-7 w-7 p-0 rounded-full")}
          onclick={() => onEdit?.()}
          title="Edit"
        >
          <Pencil class="h-3.5 w-3.5" />
        </button>

        <div class="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>

        <button
          type="button"
          class={btn("ghost", "sm", "h-7 w-7 p-0 rounded-full")}
          onclick={() => onShare?.()}
          title="Share"
        >
          <Share2 class="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          class={btn(
            "default",
            "sm",
            "h-7 rounded-full px-3 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
          )}
          onclick={() => onRegenerate?.()}
          title="Generate new version"
        >
          <RefreshCw class="h-3 w-3 mr-1" />
          Regenerate
        </button>
      </div>
    </div>
  </div>

  <div
    class="flex items-center h-6 bg-blue-600 dark:bg-blue-700 text-white text-[11px] px-3 select-none shrink-0 overflow-hidden"
  >
    <div class="flex items-center gap-3 mr-auto">
      <span class="flex items-center gap-1">
        <GitBranch class="h-3 w-3" />
        {activeVersion}
      </span>
      {#if isGenerating}
        <span class="flex items-center gap-1 animate-pulse">
          <Loader2 class="h-3 w-3 animate-spin" />
          Generating...
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-4 text-blue-100">
      {#if metadata.model}
        <span>{metadata.model}</span>
      {/if}
      {#if typeof metadata.tokens === "number"}
        <span>{metadata.tokens.toLocaleString()} tokens</span>
      {/if}
      {#if metadata.size}
        <span>{metadata.size}</span>
      {/if}
      {#if metadata.generationTime}
        <span>{metadata.generationTime}</span>
      {/if}
      <span class="text-white font-medium">{config.label}</span>
    </div>
  </div>
</div>
