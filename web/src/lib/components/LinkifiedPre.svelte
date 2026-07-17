<script lang="ts">
  import { openPath, splitPaths } from "$lib/linkify-paths";

  type Props = {
    text: string;
    class?: string;
  };

  let { text, class: className = "" }: Props = $props();

  const segs = $derived(splitPaths(text));

  async function onPath(e: MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    const r = await openPath(path);
    // brief title feedback via title attr swap
    const el = e.currentTarget as HTMLElement;
    const prev = el.title;
    el.title = r === "copied" ? "Copied path" : "Opened";
    setTimeout(() => {
      el.title = prev;
    }, 1000);
  }
</script>

<pre class={className}>{#each segs as s, i (i)}{#if s.type === "path"}<button
      type="button"
      class="path-link inline break-all rounded-sm px-0.5 font-mono text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      title="Open in editor"
      onclick={(e) => onPath(e, s.value)}>{s.value}</button
    >{:else}{s.value}{/if}{/each}</pre>
