<script lang="ts">
  import type { ChatMessage, ContentPart } from "$lib/api";
  import {
    findToolResultForCall,
    formatJsonish,
    getParts,
    imagePartSrc,
    messageText,
    toolResultText,
  } from "$lib/api";
  import { findMessagePlugin } from "$lib/plugins/registry";
  import ToolCallCard from "$lib/components/ToolCallCard.svelte";
  import Markdown from "agentic-ui-kit/components/prompt-kit/markdown.svelte";
  import Message from "agentic-ui-kit/components/prompt-kit/message.svelte";
  import MessageContent from "agentic-ui-kit/components/prompt-kit/message-content.svelte";
  import Reasoning from "agentic-ui-kit/components/prompt-kit/reasoning.svelte";
  import ReasoningContent from "agentic-ui-kit/components/prompt-kit/reasoning-content.svelte";
  import ReasoningTrigger from "agentic-ui-kit/components/prompt-kit/reasoning-trigger.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";

  type Props = {
    message: ChatMessage;
    streaming?: boolean;
    /** Full list + index for tool pairing */
    messages?: ChatMessage[];
    index?: number;
    /** Edit user msg → navigate tree + draft (ChatPanel). */
    onEditUser?: (message: ChatMessage) => void;
    /** Bulk expand/collapse for thinking + tools (default open). */
    foldOpen?: boolean;
    foldEpoch?: number;
    /** Pin under chat header while this turn's reply scrolls. */
    sticky?: boolean;
  };
  let {
    message,
    streaming = false,
    messages = [],
    index = -1,
    onEditUser,
    foldOpen = true,
    foldEpoch = 0,
    sticky = false,
  }: Props = $props();

  // Per-block open state; bulk toggle resets via foldEpoch.
  let orphanOpen = $state(true);
  let thinkOpen = $state<Record<number, boolean>>({});

  $effect(() => {
    void foldEpoch;
    orphanOpen = foldOpen;
    thinkOpen = {};
  });

  function thinkIsOpen(i: number): boolean {
    return thinkOpen[i] ?? foldOpen;
  }

  function setThinkOpen(i: number, v: boolean) {
    thinkOpen = { ...thinkOpen, [i]: v };
  }

  const plugin = $derived(findMessagePlugin(message));
  const role = $derived(message.role || "unknown");
  const parts = $derived(getParts(message));
  const text = $derived(messageText(message));
  const msgStreamId = $derived(
    String(
      message._key ??
        message.id ??
        message.timestamp ??
        message.role ??
        "msg",
    ),
  );

  const isUser = $derived(role === "user");
  const isAssistant = $derived(role === "assistant");
  const special = $derived(
    role === "compactionSummary" ||
      role === "branchSummary" ||
      role === "skillInvocation",
  );

  function isThinkPart(p: ContentPart | undefined): boolean {
    return p?.type === "thinking" || p?.type === "reasoning";
  }

  /** Body of a thinking/reasoning content part. */
  function partThinkingText(p: ContentPart): string {
    if (typeof p.thinking === "string" && p.thinking) return p.thinking;
    if (typeof p.text === "string" && p.text) return p.text;
    return "";
  }

  /**
   * True if part i is followed by later progress (text / tools / more thinking).
   * Used so only the active trailing think segment shows as streaming.
   */
  function hasProgressAfter(i: number): boolean {
    for (let j = i + 1; j < parts.length; j++) {
      const q = parts[j];
      if (isThinkPart(q)) {
        if (partThinkingText(q).trim()) return true;
        continue;
      }
      if (q.type === "toolCall" || q.type === "tool_use") return true;
      if ((q.type === "text" || q.text) && (q.text ?? "").trim()) return true;
    }
    return false;
  }

  function isThinkingLive(i: number): boolean {
    if (!streaming || !isThinkPart(parts[i])) return false;
    return !hasProgressAfter(i);
  }

  const hasThinkingParts = $derived(parts.some((p) => isThinkPart(p)));
  /** Top-level msg.thinking when not already present as content parts. */
  const orphanThinking = $derived(
    !hasThinkingParts &&
      typeof message.thinking === "string" &&
      message.thinking.trim()
      ? message.thinking.trim()
      : "",
  );
  const orphanThinkingLive = $derived(
    streaming && Boolean(orphanThinking) && parts.length === 0,
  );

  const lastToolIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
      const t = parts[i]?.type;
      if (t === "toolCall" || t === "tool_use") idx = i;
    }
    return idx;
  });

  /** Index of the live trailing think part, or -1. */
  const liveThinkIdx = $derived.by(() => {
    if (!streaming) return -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isThinkPart(parts[i]) && !hasProgressAfter(i)) return i;
    }
    return -1;
  });
  const thinkingLive = $derived(liveThinkIdx >= 0 || orphanThinkingLive);

  let thinkStartedAt = $state<number | null>(null);
  let thinkEndedAt = $state<number | null>(null);
  let thinkTick = $state(0);
  let sawThinkingLive = $state(false);
  /** Which segment the open timer belongs to (resets between think steps). */
  let liveThinkSlot = $state<string | null>(null);

  $effect(() => {
    const slot =
      liveThinkIdx >= 0
        ? `p:${liveThinkIdx}`
        : orphanThinkingLive
          ? "orphan"
          : null;
    if (slot) {
      if (liveThinkSlot !== slot) {
        liveThinkSlot = slot;
        thinkStartedAt = Date.now();
        thinkEndedAt = null;
      }
      sawThinkingLive = true;
      return;
    }
    if (sawThinkingLive && thinkStartedAt != null && thinkEndedAt == null) {
      thinkEndedAt = Date.now();
    }
    liveThinkSlot = null;
  });

  $effect(() => {
    if (!streaming && !hasThinkingParts && !orphanThinking) {
      thinkStartedAt = null;
      thinkEndedAt = null;
      sawThinkingLive = false;
      liveThinkSlot = null;
    }
  });

  $effect(() => {
    if (!thinkingLive) return;
    const id = setInterval(() => {
      thinkTick++;
    }, 250);
    return () => clearInterval(id);
  });

  const thinkDurationLabel = $derived.by(() => {
    void thinkTick;
    if (!sawThinkingLive || thinkStartedAt == null) return null;
    const end = thinkEndedAt ?? Date.now();
    const sec = Math.max(0, (end - thinkStartedAt) / 1000);
    if (sec < 0.05 && !thinkingLive) return null;
    return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
  });

  /** Last non-empty text part — streaming caret only when there is text to attach to */
  const lastTextIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (isThinkPart(p)) continue;
      if (p.type === "toolCall" || p.type === "tool_use") continue;
      if ((p.type === "text" || p.text) && (p.text ?? "").length > 0) idx = i;
    }
    return idx;
  });

  let copied = $state(false);

  function toolArgs(p: ContentPart): string {
    return formatJsonish(p.arguments ?? p.input ?? p);
  }

  /** Label for a think segment; duration only on the live trailing one. */
  function thinkTriggerLabel(live: boolean): string {
    if (live) {
      return thinkDurationLabel
        ? `Thinking… ${thinkDurationLabel}`
        : "Thinking…";
    }
    return "Thinking";
  }

  function toolStatus(p: ContentPart, i: number): "running" | "done" | "error" {
    const callId = typeof p.id === "string" ? p.id : "";
    const res =
      callId && index >= 0
        ? findToolResultForCall(messages, index, callId)
        : undefined;
    if (res?.isError) return "error";
    if (res) return "done";
    if (streaming && i === lastToolIdx) return "running";
    return streaming ? "running" : "done";
  }

  function pairedResult(p: ContentPart): string {
    const callId = typeof p.id === "string" ? p.id : "";
    if (!callId || index < 0) return "";
    const res = findToolResultForCall(messages, index, callId);
    return res ? toolResultText(res) : "";
  }

  async function copyMessage(e: MouseEvent) {
    e.stopPropagation();
    const body = text.trim();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1200);
    } catch {
      /* ignore */
    }
  }

  function editUser(e: MouseEvent) {
    e.stopPropagation();
    onEditUser?.(message);
  }

  const showActions = $derived(Boolean(text.trim() || (isUser && onEditUser)));
</script>

{#snippet msgActions()}
  {#if isUser && onEditUser}
    <Button
      variant="ghost"
      size="icon"
      type="button"
      class="size-7"
      title="Edit & continue"
      onclick={editUser}
    >
      <Pencil class="size-3.5 text-muted-foreground" />
    </Button>
  {/if}
  {#if text.trim()}
    <Button
      variant="ghost"
      size="icon"
      type="button"
      class="size-7"
      title="Copy message"
      onclick={copyMessage}
    >
      {#if copied}
        <Check class="size-3.5 text-muted-foreground" />
      {:else}
        <Copy class="size-3.5 text-muted-foreground" />
      {/if}
    </Button>
  {/if}
{/snippet}

<div
  class="group/msg relative {sticky
    ? 'sticky top-0 z-20 bg-[var(--pi-canvas)] py-1'
    : ''}"
>
  {#if plugin?.Message}
    {@const Comp = plugin.Message}
    <Comp message={message} text={text} />
  {:else if role === "bashExecution"}
    <Message class="justify-start">
      <ToolCallCard
        name={`$ ${typeof message.command === "string" ? message.command : ""}`}
        result={typeof message.output === "string" ? message.output : ""}
        status={streaming
          ? "running"
          : message.cancelled
            ? "error"
            : typeof message.exitCode === "number" && message.exitCode !== 0
              ? "error"
              : "done"}
        open={foldOpen}
        {foldEpoch}
      />
    </Message>
  {:else if role === "toolResult"}
    <!-- unpaired results only (paired ones render inside assistant) -->
    <Message class="justify-start">
      <ToolCallCard
        name={typeof message.toolName === "string" ? message.toolName : "tool"}
        result={text || "—"}
        status={message.isError ? "error" : "done"}
        open={foldOpen}
        {foldEpoch}
      />
    </Message>
  {:else if special}
    <Message class="justify-start">
      <div class="w-full max-w-full text-[12px] leading-relaxed text-muted-foreground">
        <span class="text-[11px] font-medium uppercase tracking-wide opacity-60">{role}</span>
        <div class="mt-0.5 whitespace-pre-wrap">
          {typeof message.summary === "string" ? message.summary : text || "—"}
        </div>
      </div>
    </Message>
  {:else if isUser}
    <Message class="justify-end">
      <div class="flex max-w-[min(100%,48rem)] flex-col items-end gap-1.5">
        {#each parts as p, pi (`img-${pi}`)}
          {#if p.type === "image"}
            {@const src = imagePartSrc(p)}
            {#if src}
              <img
                src={src}
                alt="attachment"
                class="max-h-48 max-w-full rounded-lg border border-border/60 object-contain"
              />
            {/if}
          {/if}
        {/each}
        {#if text.trim() || typeof message.content === "string"}
          <!--
            Icons sit in-flow left of the bubble (same row, top-aligned).
            Avoid absolute + overflow — sticky max-height was clipping them.
          -->
          <div class="flex max-w-full items-start gap-0.5">
            {#if showActions}
              <div
                class="mt-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100"
              >
                {@render msgActions()}
              </div>
            {/if}
            <div class="min-w-0 max-w-full {sticky ? 'max-h-[40vh] overflow-y-auto' : ''}">
              <MessageContent
                variant="card"
                class="max-w-full"
                content={text || (typeof message.content === "string" ? message.content : "")}
              />
            </div>
          </div>
        {/if}
      </div>
    </Message>
  {:else if isAssistant}
    <Message class="justify-start">
      <div class="relative min-w-0 w-full max-w-full">
        {#if showActions}
          <div
            class="absolute top-0 right-0 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100"
          >
            {@render msgActions()}
          </div>
        {/if}
        <div class="flex min-w-0 w-full flex-col gap-2 {showActions ? 'pr-8' : ''}">
          {#if orphanThinking}
            {@const live = orphanThinkingLive}
            <Reasoning
              isStreaming={live}
              bind:open={orphanOpen}
              class="w-full min-w-0"
            >
              <ReasoningTrigger class="text-xs text-muted-foreground">
                {thinkTriggerLabel(live)}
              </ReasoningTrigger>
              <ReasoningContent
                class="w-full"
                contentClassName="max-w-none w-full"
                markdown={true}
                content={orphanThinking}
                streaming={live}
                streamId={`${msgStreamId}-think-orphan`}
              />
            </Reasoning>
          {/if}

          {#each parts as p, i (`${p.type}-${p.id ?? p.name ?? i}`)}
            {#if isThinkPart(p)}
              {@const body = partThinkingText(p)}
              {#if body.trim()}
                {@const live = isThinkingLive(i)}
                <Reasoning
                  isStreaming={live}
                  open={thinkIsOpen(i)}
                  onOpenChange={(v) => setThinkOpen(i, v)}
                  class="w-full min-w-0"
                >
                  <ReasoningTrigger class="text-xs text-muted-foreground">
                    {thinkTriggerLabel(live)}
                  </ReasoningTrigger>
                  <ReasoningContent
                    class="w-full"
                    contentClassName="max-w-none w-full"
                    markdown={true}
                    content={body}
                    streaming={live}
                    streamId={`${msgStreamId}-think-${i}`}
                  />
                </Reasoning>
              {/if}
            {:else if p.type === "toolCall" || p.type === "tool_use"}
              <ToolCallCard
                name={p.name ?? "tool"}
                args={toolArgs(p)}
                result={pairedResult(p)}
                status={toolStatus(p, i)}
                open={foldOpen}
                {foldEpoch}
              />
            {:else if p.type === "text" || p.text}
              {#if (p.text ?? "").length > 0}
                <div class="relative min-w-0">
                  <MessageContent
                    variant="plain"
                    markdown={true}
                    content={p.text ?? ""}
                    {streaming}
                    streamId={`${msgStreamId}-t${p.id ?? i}`}
                  />
                  {#if streaming && i === lastTextIdx}
                    <span
                      class="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-foreground/70 align-baseline"
                      aria-hidden="true"
                    ></span>
                  {/if}
                </div>
              {/if}
            {/if}
          {/each}

          {#if parts.length === 0 && text && !orphanThinking}
            <div class="relative min-w-0">
              <MessageContent
                variant="plain"
                markdown={true}
                content={text}
                {streaming}
                streamId={`${msgStreamId}-body`}
              />
              {#if streaming && text.length > 0}
                <span
                  class="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-foreground/70 align-baseline"
                  aria-hidden="true"
                ></span>
              {/if}
            </div>
          {/if}
          <!-- No text yet: "Working" spinner only — no empty cursor caret -->
        </div>
      </div>
    </Message>
  {:else}
    <Message class="justify-start">
      <div class="w-full text-[13px] text-muted-foreground">
        <Markdown content={text || "—"} compact={true} />
      </div>
    </Message>
  {/if}
</div>
