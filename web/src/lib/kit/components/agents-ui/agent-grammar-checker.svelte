<script lang="ts">
  import { cn } from "$lib/utils";
  import { badge, btn, textareaClass } from "./_btn.js";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Target from "@lucide/svelte/icons/target";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import FileText from "@lucide/svelte/icons/file-text";
  import Zap from "@lucide/svelte/icons/zap";
  import type { Component } from "svelte";

  export type GrammarIssueType =
    | "grammar"
    | "spelling"
    | "style"
    | "clarity"
    | "punctuation";

  export interface GrammarIssue {
    id: string;
    type: GrammarIssueType;
    message: string;
    suggestion: string;
    position: { start: number; end: number };
    severity: "error" | "warning" | "info";
  }

  export interface GrammarStats {
    wordsCount: number;
    readabilityScore: number;
    issuesFixed: number;
    totalIssues: number;
  }

  export interface AgentGrammarCheckerProps {
    text?: string;
    originalText?: string;
    issues?: GrammarIssue[];
    stats?: GrammarStats;
    isAnalyzing?: boolean;
    onTextChange?: (text: string) => void;
    onAcceptSuggestion?: (issueId: string) => void;
    onRejectSuggestion?: (issueId: string) => void;
    onCopy?: () => void;
    onReanalyze?: () => void;
    onRegenerateResponse?: () => void;
    class?: string;
    timestamp?: string;
  }

  const issueTypeConfig: Record<
    GrammarIssueType,
    { icon: Component; color: string; label: string }
  > = {
    grammar: { icon: BookOpen, color: "bg-red-100 text-red-800", label: "Grammar" },
    spelling: {
      icon: AlertCircle,
      color: "bg-orange-100 text-orange-800",
      label: "Spelling",
    },
    style: { icon: Lightbulb, color: "bg-blue-100 text-blue-800", label: "Style" },
    clarity: { icon: Target, color: "bg-blue-100 text-blue-800", label: "Clarity" },
    punctuation: {
      icon: FileText,
      color: "bg-green-100 text-green-800",
      label: "Punctuation",
    },
  };

  let {
    text = "",
    originalText = "",
    issues = [],
    stats,
    isAnalyzing = false,
    onTextChange,
    onAcceptSuggestion,
    onRejectSuggestion,
    onCopy,
    onReanalyze,
    onRegenerateResponse,
    class: className,
    timestamp = "Just now",
  }: AgentGrammarCheckerProps = $props();

  let selectedIssue = $state<string | null>(null);

  function handleAcceptSuggestion(issueId: string) {
    onAcceptSuggestion?.(issueId);
    selectedIssue = null;
  }

  function handleRejectSuggestion(issueId: string) {
    onRejectSuggestion?.(issueId);
    selectedIssue = null;
  }

  function highlightedText(source: string, issueList: GrammarIssue[]) {
    if (!issueList.length) return source;

    let result = source;
    const sortedIssues = [...issueList].sort(
      (a, b) => b.position.start - a.position.start
    );

    sortedIssues.forEach((issue) => {
      const beforeText = result.substring(0, issue.position.start);
      const highlightedPart = result.substring(
        issue.position.start,
        issue.position.end
      );
      const afterText = result.substring(issue.position.end);

      const colorClass =
        issue.severity === "error"
          ? "bg-red-200"
          : issue.severity === "warning"
            ? "bg-yellow-200"
            : "bg-blue-200";

      result = `${beforeText}<span class="${colorClass} cursor-pointer underline decoration-wavy" data-issue-id="${issue.id}">${highlightedPart}</span>${afterText}`;
    });

    return result;
  }
</script>

<div class={cn("space-y-4 p-4", className)}>
  {#if isAnalyzing}
    <div class="text-sm text-foreground flex items-center gap-2">
      <RefreshCw class="h-4 w-4 animate-spin" />
      Analyzing your text for grammar, style, and clarity...
    </div>
  {:else}
    <div class="text-sm text-foreground">
      Text analysis complete. {issues.length > 0
        ? `Found ${issues.length} suggestions for improvement.`
        : "No issues found - great writing!"}
    </div>
  {/if}

  {#if stats}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-muted rounded-lg p-3">
        <div class="text-lg font-semibold">{stats.wordsCount}</div>
        <div class="text-xs text-muted-foreground">Words</div>
      </div>
      <div class="bg-muted rounded-lg p-3">
        <div class="text-lg font-semibold">{stats.readabilityScore}/100</div>
        <div class="text-xs text-muted-foreground">Readability</div>
      </div>
      <div class="bg-muted rounded-lg p-3">
        <div class="text-lg font-semibold">{stats.issuesFixed}</div>
        <div class="text-xs text-muted-foreground">Fixed</div>
      </div>
      <div class="bg-muted rounded-lg p-3">
        <div class="text-lg font-semibold">{stats.totalIssues}</div>
        <div class="text-xs text-muted-foreground">Total Issues</div>
      </div>
    </div>
  {/if}

  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">Corrected Text</span>
      <div class="flex gap-2">
        <button
          type="button"
          class={btn("outline", "sm")}
          onclick={() => onReanalyze?.()}
          title="Re-analyze text"
        >
          <Zap class="h-4 w-4 mr-1" />
          Re-analyze
        </button>
      </div>
    </div>

    <div class="relative">
      <textarea
        value={text}
        oninput={(e) => onTextChange?.((e.currentTarget as HTMLTextAreaElement).value)}
        class={cn(textareaClass, "min-h-32 resize-y")}
        placeholder="Your corrected text will appear here..."
      ></textarea>

      {#if isAnalyzing}
        <div class="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md">
          <div class="flex items-center gap-2">
            <RefreshCw class="h-4 w-4 animate-spin" />
            <span class="text-sm">Analyzing...</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if issues.length > 0}
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">Suggestions ({issues.length})</span>
      </div>

      <div class="space-y-2 max-h-48 overflow-y-auto">
        {#each issues as issue (issue.id)}
          {@const config = issueTypeConfig[issue.type]}
          {@const Icon = config.icon}
          <div
            class={cn(
              "border rounded-lg p-3 space-y-2",
              selectedIssue === issue.id && "ring-2 ring-primary"
            )}
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <div class={badge("secondary", cn("text-xs", config.color))}>
                    <Icon class="h-3 w-3" />
                    {config.label}
                  </div>

                  {#if issue.severity === "error"}
                    <div class={badge("destructive", "text-xs")}>Error</div>
                  {/if}
                  {#if issue.severity === "warning"}
                    <div class={badge("outline", "text-xs")}>Warning</div>
                  {/if}
                </div>

                <p class="text-sm text-muted-foreground mb-1">{issue.message}</p>

                <div class="text-sm">
                  <span class="font-medium">Suggestion:</span>
                  {" "}
                  <span class="text-green-700">{issue.suggestion}</span>
                </div>
              </div>
            </div>

            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class={btn("default", "sm", "bg-green-600 hover:bg-green-700")}
                onclick={() => handleAcceptSuggestion(issue.id)}
              >
                <Check class="h-3 w-3 mr-1" />
                Accept
              </button>

              <button
                type="button"
                class={btn("outline", "sm")}
                onclick={() => handleRejectSuggestion(issue.id)}
              >
                Ignore
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if originalText && text !== originalText}
    <div class="space-y-2">
      <span class="text-sm font-medium">Original Text</span>
      <div class="bg-muted rounded-lg p-3 text-sm">
        {@html highlightedText(originalText, issues)}
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div
        class="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full"
        data-slot="avatar"
      >
        <div
          class="bg-muted flex size-full items-center justify-center rounded-full bg-blue-100 text-blue-600"
          data-slot="avatar-fallback"
        >
          <Settings2 class="h-4 w-4" />
        </div>
      </div>
      <span class="text-sm text-muted-foreground">{timestamp}</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onCopy?.()}
        title="Copy corrected text"
      >
        Copy
      </button>

      <button
        type="button"
        class={btn("ghost", "sm")}
        onclick={() => onRegenerateResponse?.()}
        title="Re-analyze with different approach"
      >
        Regenerate response
      </button>

      <div class="flex gap-1">
        <span class="text-lg">😊</span>
        <span class="text-lg">😔</span>
      </div>
    </div>
  </div>
</div>
