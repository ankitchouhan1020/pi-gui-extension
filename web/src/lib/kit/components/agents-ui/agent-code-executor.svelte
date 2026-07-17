<script lang="ts">
  import { cn } from "$lib/utils";
  import { badge } from "./_btn.js";
  import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Circle from "@lucide/svelte/icons/circle";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import Code2 from "@lucide/svelte/icons/code-2";
  import Cpu from "@lucide/svelte/icons/cpu";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import ShieldAlert from "@lucide/svelte/icons/shield-alert";
  import Square from "@lucide/svelte/icons/square";
  import Terminal from "@lucide/svelte/icons/terminal";
  import Timer from "@lucide/svelte/icons/timer";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import XCircle from "@lucide/svelte/icons/x-circle";

  export interface CodeExecutionOutput {
    stdout?: string;
    stderr?: string;
    exitCode: number;
    executionTime?: string;
    memoryUsage?: string;
  }

  export interface CodeExecutionHistoryItem {
    id: string;
    code: string;
    output: CodeExecutionOutput;
    timestamp: string;
    status: "success" | "error";
  }

  export interface AgentCodeExecutorProps {
    sandboxName?: string;
    language?: string;
    code?: string;
    output?: CodeExecutionOutput;
    executionHistory?: CodeExecutionHistoryItem[];
    isExecuting?: boolean;
    sandboxLevel?: "sandboxed" | "unrestricted";
    onRun?: () => void;
    onStop?: () => void;
    onClear?: () => void;
    onCopyCode?: () => void;
    onEditCode?: (editable: boolean) => void;
    class?: string;
  }

  const defaultCode = `import pandas as pd

df = pd.read_csv("sales_q4.csv")
summary = df.groupby("region").agg(
    total_revenue=("revenue", "sum"),
    avg_deal_size=("revenue", "mean"),
    num_deals=("revenue", "count"),
)
summary["avg_deal_size"] = summary["avg_deal_size"].round(2)
print(summary.to_markdown(tablefmt="grid"))`;

  const defaultOutput: CodeExecutionOutput = {
    stdout: `+-----------+-----------------+-----------------+------------+
| region    |   total_revenue |   avg_deal_size |   num_deals|
+===========+=================+=================+============+
| APAC      |          384200 |         12806.7 |         30 |
| EMEA      |          521800 |         14938.6 |         35 |
| NA        |          697500 |         15500.0 |         45 |
+-----------+-----------------+-----------------+------------+`,
    stderr: "",
    exitCode: 0,
    executionTime: "1.24s",
    memoryUsage: "48.2 MB",
  };

  const defaultHistory: CodeExecutionHistoryItem[] = [
    {
      id: "hist-1",
      code: 'df = pd.read_csv("sales_q4.csv")\nprint(df.shape)',
      output: {
        stdout: "(110, 8)",
        stderr: "",
        exitCode: 0,
        executionTime: "0.38s",
        memoryUsage: "22.1 MB",
      },
      timestamp: "2 min ago",
      status: "success",
    },
    {
      id: "hist-2",
      code: "print(df.columns.tolist())",
      output: {
        stdout:
          "['region', 'rep', 'revenue', 'date', 'product', 'channel', 'status', 'quarter']",
        stderr: "",
        exitCode: 0,
        executionTime: "0.05s",
        memoryUsage: "22.1 MB",
      },
      timestamp: "3 min ago",
      status: "success",
    },
  ];

  let {
    sandboxName = "python-sandbox-01",
    language = "Python",
    code,
    output,
    executionHistory,
    isExecuting = false,
    sandboxLevel = "sandboxed",
    onRun,
    onStop,
    onClear,
    onCopyCode,
    onEditCode,
    class: className,
  }: AgentCodeExecutorProps = $props();

  const displayCode = $derived(code ?? defaultCode);
  const displayOutput = $derived(output ?? defaultOutput);
  const displayHistory = $derived(executionHistory ?? defaultHistory);

  let isEditable = $state(false);
  let historyOpen = $state(false);

  const codeLines = $derived(displayCode.split("\n"));
  const isSandboxed = $derived(sandboxLevel === "sandboxed");
  const isSuccess = $derived(displayOutput.exitCode === 0);

  const outputLines = $derived.by(() => {
    const lines: { text: string; type: "stdout" | "stderr" | "prompt" }[] = [];
    if (displayOutput.stdout) {
      displayOutput.stdout.split("\n").forEach((l) => lines.push({ text: l, type: "stdout" }));
    }
    if (displayOutput.stderr) {
      displayOutput.stderr.split("\n").forEach((l) => lines.push({ text: l, type: "stderr" }));
    }
    lines.push({
      text: `$ Process exited with code ${displayOutput.exitCode}`,
      type: "prompt",
    });
    return lines;
  });

  const langBinary = $derived.by(() => {
    const map: Record<string, string> = {
      Python: "python3",
      JavaScript: "node",
      TypeScript: "ts-node",
      Go: "go run",
      Rust: "cargo run",
      Java: "java",
      Ruby: "ruby",
      Shell: "bash",
    };
    return map[language] ?? language.toLowerCase();
  });

  function handleToggleEdit() {
    const next = !isEditable;
    isEditable = next;
    onEditCode?.(next);
  }
</script>

<div class={cn("w-full", className)}>
  <div
    class="rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden"
  >
    <div
      class="flex items-center justify-between bg-zinc-900 px-4 py-2.5 border-b border-zinc-800 select-none"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
          ></span>
          <span class="h-3 w-3 rounded-full bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.4)]"
          ></span>
          <span class="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
          ></span>
        </div>
        <div class="ml-3 flex items-center gap-2">
          <Terminal class="h-3.5 w-3.5 text-zinc-500" />
          <span class="text-xs font-medium text-zinc-400">Terminal — {langBinary}</span>
          <span class="text-zinc-600 text-xs">—</span>
          <span class="text-xs text-zinc-500 truncate max-w-[180px]">{sandboxName}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if isExecuting}
          <div
            class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
          >
            <Loader2 class="h-3 w-3 text-amber-400 animate-spin" />
            <span
              class="text-[10px] font-semibold text-amber-400 uppercase tracking-wider"
              >Running</span
            >
          </div>
        {/if}
        <div
          class={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
            isSandboxed
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              : "bg-red-500/15 text-red-400 border border-red-500/25"
          )}
          title={isSandboxed
            ? "Code runs in an isolated sandbox"
            : "Code runs without sandbox restrictions"}
        >
          {#if isSandboxed}
            <ShieldCheck class="h-3 w-3" />
          {:else}
            <ShieldAlert class="h-3 w-3" />
          {/if}
          {isSandboxed ? "Sandboxed" : "Unrestricted"}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60">
      <button
        type="button"
        onclick={() => onRun?.()}
        disabled={isExecuting}
        class={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all",
          isExecuting
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-900/40 active:scale-95"
        )}
      >
        <Play class="h-3 w-3" />
        Run
      </button>
      <button
        type="button"
        onclick={() => onStop?.()}
        disabled={!isExecuting}
        class={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all",
          !isExecuting
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-900/40 active:scale-95"
        )}
      >
        <Square class="h-3 w-3" />
        Stop
      </button>
      <div class="w-px h-4 bg-zinc-700 mx-1"></div>
      <button
        type="button"
        onclick={() => onCopyCode?.()}
        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title="Copy code"
      >
        <ClipboardCopy class="h-3 w-3" />
      </button>
      <button
        type="button"
        onclick={handleToggleEdit}
        class={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
          isEditable
            ? "text-blue-400 bg-blue-500/15"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
        )}
        title={isEditable ? "Editing mode" : "Edit code"}
      >
        <Pencil class="h-3 w-3" />
      </button>
      <button
        type="button"
        onclick={() => onClear?.()}
        class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title="Clear output"
      >
        <Trash2 class="h-3 w-3" />
      </button>

      <div class="flex-1"></div>

      {#if displayHistory.length > 0}
        <button
          type="button"
          onclick={() => (historyOpen = !historyOpen)}
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors font-mono"
        >
          <span class="text-zinc-500">history</span>
          <span
            class={badge(
              "default",
              "bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px] px-1.5 py-0"
            )}
          >
            {displayHistory.length}
          </span>
          {#if historyOpen}
            <ChevronUp class="h-3 w-3" />
          {:else}
            <ChevronDown class="h-3 w-3" />
          {/if}
        </button>
      {/if}
    </div>

    {#if historyOpen && displayHistory.length > 0}
      <div class="border-b border-zinc-800 bg-zinc-900/40">
        <div class="px-4 py-2 border-b border-zinc-800/50">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            Command History
          </span>
        </div>
        <div class="max-h-[140px] overflow-auto">
          <div class="py-1">
            {#each displayHistory as item, idx (item.id)}
              <div
                class="flex items-start gap-3 px-4 py-2 hover:bg-zinc-800/40 transition-colors group"
              >
                <span
                  class="text-[11px] font-mono text-zinc-600 w-5 text-right shrink-0 pt-0.5"
                >
                  {displayHistory.length - idx}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    {#if item.status === "success"}
                      <CheckCircle2 class="h-3 w-3 text-emerald-500 shrink-0" />
                    {:else}
                      <XCircle class="h-3 w-3 text-red-400 shrink-0" />
                    {/if}
                    <pre class="text-xs font-mono text-zinc-300 truncate">
                      {item.code.split("\n")[0]}
                    </pre>
                  </div>
                  <div
                    class="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600 font-mono pl-5"
                  >
                    <span>{item.timestamp}</span>
                    <Circle class="h-1 w-1 fill-current" />
                    <span>{item.output.executionTime}</span>
                    {#if item.output.stdout}
                      <Circle class="h-1 w-1 fill-current" />
                      <span class="truncate max-w-[240px] text-zinc-500">
                        {item.output.stdout.split("\n")[0]}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <div class="relative">
      <div
        class="flex items-center justify-between px-4 py-1.5 bg-zinc-900/30 border-b border-zinc-800/40"
      >
        <div class="flex items-center gap-2">
          <Code2 class="h-3 w-3 text-zinc-600" />
          <span class="text-[11px] font-mono text-zinc-500">{language.toLowerCase()}</span>
        </div>
        <span class="text-[10px] font-mono text-zinc-600">
          {codeLines.length} line{codeLines.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div class="max-h-[300px] overflow-auto">
        <pre class="text-sm leading-6">
          {#each codeLines as line, i}
            <div
              class={cn("flex", isExecuting && i === codeLines.length - 1 && "bg-zinc-900/80")}
            >
              <span
                class={cn(
                  "sticky left-0 inline-flex items-center justify-end w-12 pr-4 text-right text-xs font-mono select-none shrink-0 border-r",
                  "bg-zinc-900 text-zinc-600 border-zinc-800"
                )}
              >
                {i + 1}
              </span>
              <code class="font-mono text-emerald-400 whitespace-pre pl-4 pr-4 flex-1">
                {line}{#if isExecuting && i === codeLines.length - 1}<span
                    class="inline-block w-2 h-4 bg-emerald-400 ml-0.5 align-middle animate-pulse"
                  ></span>{/if}
              </code>
            </div>
          {/each}
        </pre>
      </div>
    </div>

    <div
      class="relative flex items-center justify-center h-2 bg-zinc-900 border-y border-zinc-800 cursor-row-resize group"
    >
      <div class="flex gap-0.5">
        <span
          class="w-6 h-0.5 rounded-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors"
        ></span>
      </div>
    </div>

    <div>
      <div class="flex items-center gap-2 px-4 py-1.5 bg-zinc-900/30 border-b border-zinc-800/40">
        <Terminal class="h-3 w-3 text-zinc-600" />
        <span class="text-[11px] font-mono text-zinc-500">output</span>
        {#if !isExecuting}
          <span
            class={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0 text-[9px] font-mono font-semibold",
              isSuccess
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : "bg-red-500/15 text-red-400 border-red-500/25"
            )}
          >
            exit {displayOutput.exitCode}
          </span>
        {/if}
      </div>

      <div class="max-h-[220px] overflow-auto">
        <div class="p-4 font-mono text-sm leading-6">
          {#if isExecuting}
            <div class="flex items-center gap-2 text-amber-400">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              <span class="text-xs">Executing...</span>
              <span class="inline-block w-1.5 h-4 bg-amber-400 animate-pulse"></span>
            </div>
          {:else}
            {#each outputLines as line, i}
              <div>
                {#if line.type === "stdout"}
                  <span class="text-zinc-100 whitespace-pre">{line.text}</span>
                {:else if line.type === "stderr"}
                  <span class="text-red-400 whitespace-pre">{line.text}</span>
                {:else if line.type === "prompt"}
                  <div class="mt-2 pt-2 border-t border-zinc-800/50">
                    <span
                      class={cn(
                        "whitespace-pre",
                        isSuccess ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {line.text}
                    </span>
                    {#if isSuccess}
                      <CheckCircle2 class="inline h-3 w-3 ml-2 text-emerald-500" />
                    {:else}
                      <XCircle class="inline h-3 w-3 ml-2 text-red-400" />
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-between px-3 py-1 bg-blue-600 text-white text-[11px] font-medium select-none"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <Code2 class="h-3 w-3" />
          <span>{language}</span>
        </div>
        <div class="flex items-center gap-1">
          {#if isSandboxed}
            <ShieldCheck class="h-3 w-3" />
          {:else}
            <ShieldAlert class="h-3 w-3" />
          {/if}
          <span>{isSandboxed ? "Sandboxed" : "Unrestricted"}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1">
          <Timer class="h-3 w-3" />
          <span>{displayOutput.executionTime ?? "--"}</span>
        </div>
        <div class="flex items-center gap-1">
          <Cpu class="h-3 w-3" />
          <span>{displayOutput.memoryUsage ?? "--"}</span>
        </div>
        <span>Ln {codeLines.length}</span>
      </div>
    </div>
  </div>
</div>
