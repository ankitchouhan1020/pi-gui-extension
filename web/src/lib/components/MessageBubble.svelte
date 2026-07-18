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
  import {
    formatTokenCount,
    parseSkillCommand,
    parseSkillInvocation,
  } from "$lib/special-message";
  import {
    bashOutputPresentation,
    builtinToolPresentation,
  } from "$lib/tool-presentation";
  import SpecialMessageCard from "$lib/components/SpecialMessageCard.svelte";
  import ToolCallCard from "$lib/components/ToolCallCard.svelte";
  import { langFromPath } from "agentic-ui-kit/components/prompt-kit/md-highlighter";
  import Markdown from "agentic-ui-kit/components/prompt-kit/markdown.svelte";
  import Message from "agentic-ui-kit/components/prompt-kit/message.svelte";
  import MessageContent from "agentic-ui-kit/components/prompt-kit/message-content.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import GitFork from "@lucide/svelte/icons/git-fork";

  type Props = {
    message: ChatMessage;
    streaming?: boolean;
    /** Full list + index for tool pairing */
    messages?: ChatMessage[];
    index?: number;
    /** Edit user msg → navigate tree + draft (ChatPanel). */
    onEditUser?: (message: ChatMessage) => void;
    /** Fork session from this user msg. */
    onForkUser?: (message: ChatMessage) => void;
    /** Pin under chat header while this turn's reply scrolls. */
    sticky?: boolean;
    /** Split the terminal assistant message into hidden work and visible final text. */
    assistantMode?: "all" | "work-only" | "final-only";
  };

  let {
    message,
    streaming = false,
    messages = [],
    index = -1,
    onEditUser,
    onForkUser,
    sticky = false,
    assistantMode = "all",
  }: Props = $props();

  let bubbleEl: HTMLDivElement | undefined = $state();
  let stuck = $state(false);

  $effect(() => {
    if (!sticky || !bubbleEl) {
      stuck = false;
      return;
    }
    const el = bubbleEl;
    const root = el.closest(".overflow-y-auto") as HTMLElement | null;
    if (!root) {
      stuck = false;
      return;
    }
    const measure = () => {
      stuck = el.getBoundingClientRect().top <= root.getBoundingClientRect().top + 1;
    };
    measure();
    root.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      root.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  });

  const plugin = $derived(findMessagePlugin(message));
  const role = $derived(message.role || "unknown");
  const parts = $derived(getParts(message));
  const text = $derived(messageText(message));
  const msgStreamId = $derived(
    String(message._key ?? message.id ?? message.timestamp ?? message.role ?? "msg"),
  );

  const isUser = $derived(role === "user");
  const isAssistant = $derived(role === "assistant");
  const skillInvocation = $derived(isUser ? parseSkillInvocation(text) : null);
  const skillCommand = $derived.by(() => {
    if (!isUser) return null;
    const parsed = parseSkillCommand(text);
    if (parsed) return parsed;
    return typeof message._skillName === "string"
      ? { name: message._skillName, userMessage: undefined }
      : null;
  });
  const special = $derived(
    role === "compactionSummary" || role === "branchSummary" || role === "skillInvocation",
  );

  function isThinkPart(p: ContentPart | undefined): boolean {
    return p?.type === "thinking" || p?.type === "reasoning";
  }

  function partThinkingText(p: ContentPart): string {
    if (typeof p.thinking === "string" && p.thinking) return p.thinking;
    if (typeof p.text === "string" && p.text) return p.text;
    return "";
  }

  const hasThinkingParts = $derived(parts.some((p) => isThinkPart(p)));
  const orphanThinking = $derived(
    !hasThinkingParts && typeof message.thinking === "string" && message.thinking.trim()
      ? message.thinking.trim()
      : "",
  );
  const showAssistantCopy = $derived(
    isAssistant && assistantMode !== "work-only" && Boolean(text.trim()),
  );
  const lastToolIdx = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
      const t = parts[i]?.type;
      if (t === "toolCall" || t === "tool_use") idx = i;
    }
    return idx;
  });

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

  function toolStatus(p: ContentPart, i: number): "running" | "done" | "error" {
    const callId = typeof p.id === "string" ? p.id : "";
    const res =
      callId && index >= 0 ? findToolResultForCall(messages, index, callId) : undefined;
    if (res?.isError) return "error";
    if (res) return "done";
    if (streaming && i === lastToolIdx) return "running";
    return streaming ? "running" : "done";
  }

  function pairedResultMessage(p: ContentPart): ChatMessage | undefined {
    const callId = typeof p.id === "string" ? p.id : "";
    if (!callId || index < 0) return undefined;
    return findToolResultForCall(messages, index, callId);
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

  function forkMessage(e: MouseEvent) {
    e.stopPropagation();
    onForkUser?.(message);
  }

  function editUser(e: MouseEvent | KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.closest("button,a")) return;
    onEditUser?.(message);
  }
</script>

<div bind:this={bubbleEl} class="group/msg relative {sticky ? 'sticky top-0 z-20 bg-[var(--pi-canvas)] py-1' : ''}">
  {#if plugin?.Message}
    {@const Comp = plugin.Message}
    <Comp message={message} text={text} />
  {:else if role === "bashExecution"}
    {@const command = typeof message.command === "string" ? message.command : ""}
    {@const bashOutput = bashOutputPresentation(command)}
    <Message class="justify-start">
      <ToolCallCard
        name={`$ ${command}`}
        result={typeof message.output === "string" ? message.output : ""}
        resultLabel={bashOutput.label}
        resultLang={bashOutput.lang}
        status={streaming
          ? "running"
          : message.cancelled
            ? "error"
            : typeof message.exitCode === "number" && message.exitCode !== 0
              ? "error"
              : "done"}
      />
    </Message>
  {:else if role === "toolResult"}
    <Message class="justify-start">
      <ToolCallCard
        name={typeof message.toolName === "string" ? message.toolName : "tool"}
        result={text || "—"}
        status={message.isError ? "error" : "done"}
      />
    </Message>
  {:else if role === "command"}
    {@const commandStatus =
      message._commandStatus === "error" || message._commandLevel === "error"
        ? "error"
        : message._commandLevel === "warning"
          ? "warning"
          : message._commandStatus === "running"
            ? "running"
            : "done"}
    <Message class="justify-start">
      <SpecialMessageCard
        kind="command"
        title={`Command · ${typeof message.command === "string" ? message.command : `/${typeof message._commandName === "string" ? message._commandName : "command"}`}`}
        body={typeof message._commandOutput === "string" ? message._commandOutput : ""}
        meta={commandStatus}
        status={commandStatus}
        bodyStyle="pre"
      />
    </Message>
  {:else if special}
    <Message class="justify-start">
      {#if role === "compactionSummary"}
        {@const tokenCount = formatTokenCount(message.tokensBefore)}
        <SpecialMessageCard
          kind="compaction"
          title="Context compacted"
          body={typeof message.summary === "string" ? message.summary : text}
          meta={tokenCount ? `${tokenCount} tokens` : ""}
        />
      {:else if role === "branchSummary"}
        <SpecialMessageCard
          kind="branch"
          title="Branch context restored"
          body={typeof message.summary === "string" ? message.summary : text}
          meta="summary"
        />
      {:else}
        <SpecialMessageCard
          kind="skill"
          title={`Skill · ${typeof message.name === "string" ? message.name : "invoked"}`}
          body={typeof message.summary === "string" ? message.summary : text}
          meta={typeof message.location === "string" ? message.location : ""}
          metaTitle={typeof message.location === "string" ? message.location : ""}
        />
      {/if}
    </Message>
  {:else if isUser && (skillInvocation || skillCommand)}
    {@const skill = skillInvocation ?? skillCommand!}
    {@const userMessage = skill.userMessage}
    <Message class="justify-start">
      <div class="flex w-full min-w-0 flex-col gap-2">
        <SpecialMessageCard
          kind="skill"
          title={`Skill · ${skill.name}`}
          body={skillInvocation?.content ?? ""}
          meta={skillInvocation?.location ?? ""}
          metaTitle={skillInvocation?.location ?? ""}
        />
        {#if userMessage}
          <div
            class="relative min-w-0 {onEditUser ? 'cursor-text' : ''}"
            role={onEditUser ? "button" : undefined}
            tabindex={onEditUser ? 0 : undefined}
            title={onEditUser ? "Edit from here" : undefined}
            onclick={editUser}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") editUser(e);
            }}
          >
            <MessageContent
              variant="card"
              class="w-full max-w-full border-border/80"
              content={userMessage}
            />
          </div>
        {/if}
      </div>
    </Message>
  {:else if isUser}
    <Message class="justify-start">
      <div class="flex w-full min-w-0 flex-col gap-1.5">
        {#if parts.some((p) => p.type === "image")}
          <div class="flex max-w-full flex-wrap justify-end gap-1">
            {#each parts as p, pi (`img-${pi}`)}
              {#if p.type === "image"}
                {@const src = imagePartSrc(p)}
                {#if src}
                  <img
                    src={src}
                    alt="attachment"
                    class="size-10 rounded-md border border-border/60 object-cover"
                    title="Image attachment"
                  />
                {/if}
              {/if}
            {/each}
          </div>
        {/if}
        {#if text.trim() || typeof message.content === "string"}
          <div
            class="relative min-w-0 flex-1 {onEditUser ? 'cursor-text' : ''}"
            role={onEditUser ? "button" : undefined}
            tabindex={onEditUser ? 0 : undefined}
            title={onEditUser ? "Edit from here" : undefined}
            onclick={editUser}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") editUser(e);
            }}
          >
            {#if !stuck}
              <div class="absolute right-2 top-0 z-10 flex -translate-y-1/2 gap-1 rounded-full border border-border/70 bg-[var(--pi-canvas)] px-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  class="size-7 text-muted-foreground"
                  title="Copy message"
                  onclick={copyMessage}
                >
                  {#if copied}
                    <Check class="size-3.5 text-muted-foreground" />
                  {:else}
                    <Copy class="size-3.5 text-muted-foreground" />
                  {/if}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  class="size-7 text-muted-foreground"
                  title="Fork from here"
                  onclick={forkMessage}
                >
                  <GitFork class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            {/if}
            <div class="{sticky ? 'max-h-[40vh] overflow-y-auto' : ''}">
              <MessageContent
                variant="card"
                class="w-full max-w-full border-border/80"
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
        {#if showAssistantCopy}
          <div
            class="absolute right-0 top-0 z-10 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100"
          >
            <Button
              variant="ghost"
              size="icon"
              type="button"
              class="size-7"
              title="Copy response"
              aria-label="Copy assistant response"
              onclick={copyMessage}
            >
              {#if copied}
                <Check class="size-3.5 text-muted-foreground" />
              {:else}
                <Copy class="size-3.5 text-muted-foreground" />
              {/if}
            </Button>
          </div>
        {/if}
        <div class="flex min-w-0 w-full flex-col gap-2 {showAssistantCopy ? 'pr-8' : ''}">
          {#if orphanThinking && assistantMode !== "final-only"}
            <div class="min-w-0 text-muted-foreground">
              <Markdown content={orphanThinking} compact={true} />
            </div>
          {/if}

          {#each parts as p, i (`${p.type}-${p.id ?? p.name ?? i}`)}
            {#if isThinkPart(p) && assistantMode !== "final-only"}
              {@const body = partThinkingText(p)}
              {#if body.trim()}
                <div class="min-w-0 text-muted-foreground">
                  <Markdown content={body} compact={true} />
                </div>
              {/if}
            {:else if (p.type === "toolCall" || p.type === "tool_use") && assistantMode !== "final-only"}
              {@const resultMessage = pairedResultMessage(p)}
              {@const resultText = resultMessage ? toolResultText(resultMessage) : ""}
              {@const builtin = builtinToolPresentation(p, resultMessage, resultText)}
              <ToolCallCard
                name={builtin?.title ?? p.name ?? "tool"}
                meta={builtin?.meta ?? ""}
                args={builtin?.args ?? toolArgs(p)}
                argsLabel={builtin?.argsLabel ?? "args"}
                argsLang={builtin?.argsKind
                  ? builtin.argsKind === "diff"
                    ? "diff"
                    : langFromPath(builtin.path)
                  : ""}
                result={builtin?.result ?? resultText}
                resultLabel={builtin?.resultLabel ?? "result"}
                resultLang={builtin?.resultLang ?? (builtin
                  ? builtin.resultKind === "diff"
                    ? "diff"
                    : langFromPath(builtin.path)
                  : "")}
                status={toolStatus(p, i)}
              />
            {:else if (p.type === "text" || p.text) && assistantMode !== "work-only"}
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

          {#if parts.length === 0 && text && !orphanThinking && assistantMode !== "work-only"}
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
