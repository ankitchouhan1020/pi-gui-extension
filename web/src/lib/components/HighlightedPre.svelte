<script lang="ts">
  import { mdHighlighter } from "agentic-ui-kit/components/prompt-kit/md-highlighter";

  type Props = {
    text: string;
    lang: string;
    class?: string;
  };

  let { text, lang, class: className = "" }: Props = $props();
  const html = $derived(mdHighlighter.highlight(text, lang));
</script>

<div class="highlighted-pre {className}">{@html html}</div>

<style>
  .highlighted-pre :global(pre) {
    margin: 0;
    min-width: max-content;
    padding: 0.5rem;
    background: transparent !important;
    font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
    font-size: 11px;
    line-height: 1.625;
  }
  .highlighted-pre :global(.shiki),
  .highlighted-pre :global(.shiki span) {
    color: var(--shiki-light);
    background-color: transparent !important;
  }
  :global(.dark) .highlighted-pre :global(.shiki),
  :global(.dark) .highlighted-pre :global(.shiki span) {
    color: var(--shiki-dark);
  }
  .highlighted-pre :global(.shiki-fallback) {
    color: var(--foreground, inherit);
  }
</style>
