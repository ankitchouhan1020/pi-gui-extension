<script lang="ts">
  import ComposerPlus from "$lib/components/ComposerPlus.svelte";
  import FolderPicker from "$lib/components/FolderPicker.svelte";
  import ModelPicker from "$lib/components/ModelPicker.svelte";
  import Button from "agentic-ui-kit/components/ui/button.svelte";
  import {
    PromptInput,
    PromptInputTextarea,
    PromptInputActions,
    PromptInputAction,
  } from "agentic-ui-kit/components/prompt-kit/index.js";
  import Loader from "agentic-ui-kit/components/prompt-kit/loader.svelte";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Folder from "@lucide/svelte/icons/folder";
  import Square from "@lucide/svelte/icons/square";
  import X from "@lucide/svelte/icons/x";

  type Attachment = { preview: string };
  type Model = { provider?: string; id?: string; name?: string };

  type Props = {
    value?: string;
    attachments?: Attachment[];
    placeholder?: string;
    class?: string;
    textareaClass?: string;
    isLoading?: boolean;
    disabled?: boolean;
    canSend?: boolean;
    busy?: boolean;
    sendTooltip?: string;
    sessionId?: string;
    sessionCwd?: string;
    model?: Model;
    modelDisabled?: boolean;
    showModel?: boolean;
    showFolderContext?: boolean;
    folderValue?: string;
    defaultFolder?: string;
    cancelable?: boolean;
    onSubmit?: () => void;
    onCancel?: () => void;
    onStop?: () => void;
    onFiles?: (files: FileList | File[]) => void;
    onRemoveAttachment?: (index: number) => void;
    onPaste?: (event: ClipboardEvent) => void;
    onKeydown?: (event: KeyboardEvent) => void;
    onModelChange?: (model: Model) => void;
    onError?: (message: string) => void;
    onFolderChange?: (path: string) => void;
  };

  let {
    value = $bindable(""),
    attachments = [],
    placeholder = "Message pi",
    class: className = "",
    textareaClass = "min-h-[44px]",
    isLoading = false,
    disabled = false,
    canSend = false,
    busy = false,
    sendTooltip = "Send",
    sessionId = "",
    sessionCwd = "",
    model,
    modelDisabled = false,
    showModel = true,
    showFolderContext = false,
    folderValue = "",
    defaultFolder = "",
    cancelable = false,
    onSubmit,
    onCancel,
    onStop,
    onFiles,
    onRemoveAttachment,
    onPaste,
    onKeydown,
    onModelChange,
    onError,
    onFolderChange,
  }: Props = $props();

  function shortFolder(path: string) {
    const segments = path.split("/").filter(Boolean);
    return segments.slice(-2).join("/") || path;
  }
</script>

<PromptInput
  class={className}
  bind:value
  {isLoading}
  {disabled}
  {onSubmit}
>
  {#if attachments.length}
    <div class="flex flex-wrap items-center gap-1.5 px-3 pt-1.5">
      {#each attachments as attachment, index (`attachment-${index}`)}
        <div class="relative shrink-0">
          <img
            src={attachment.preview}
            alt=""
            class="size-8 rounded border border-border/60 object-cover"
          />
          <button
            type="button"
            class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            onclick={() => onRemoveAttachment?.(index)}
            aria-label="Remove attachment"
          >
            <X class="size-2.5" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <PromptInputTextarea
    {placeholder}
    class={textareaClass}
    onkeydown={onKeydown}
    onpaste={onPaste}
  />

  <PromptInputActions class="items-end justify-between gap-2 pt-1">
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <ComposerPlus {onFiles} {disabled} />
      {#if showFolderContext}
        {#if !sessionId}
          <FolderPicker
            value={folderValue}
            defaultPath={defaultFolder}
            {disabled}
            onChange={onFolderChange}
          />
        {:else if sessionCwd}
          <span
            class="flex h-7 max-w-[14rem] items-center gap-1 truncate rounded-full bg-muted/50 px-2 text-[11px] text-muted-foreground"
            title={sessionCwd}
          >
            <Folder class="size-3 shrink-0 opacity-70" />
            {shortFolder(sessionCwd)}
          </span>
        {/if}
      {/if}
      {#if showModel}
        <ModelPicker
          {sessionId}
          {model}
          disabled={disabled || modelDisabled}
          onChange={onModelChange}
          {onError}
        />
      {/if}
    </div>

    <div class="flex shrink-0 items-center gap-1 self-end">
      {#if cancelable}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs"
          onclick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      {/if}
      {#if busy && onStop}
        <PromptInputAction tooltip="Stop">
          <Button
            size="icon"
            class="size-8 shrink-0 rounded-full"
            onclick={onStop}
            type="button"
          >
            <Square class="size-3.5 fill-current" />
          </Button>
        </PromptInputAction>
      {:else}
        <PromptInputAction tooltip={sendTooltip}>
          <Button
            size="icon"
            class="size-8 shrink-0 rounded-full"
            onclick={onSubmit}
            disabled={!canSend}
            type="button"
          >
            {#if isLoading}
              <Loader variant="circular" size="sm" class="size-3.5" />
            {:else}
              <ArrowUp class="size-4" />
            {/if}
          </Button>
        </PromptInputAction>
      {/if}
    </div>
  </PromptInputActions>
</PromptInput>
