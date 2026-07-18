<script lang="ts">
  import {
    chatPrompt,
    createSkill,
    getSkillFile,
    listSkills,
    saveSkillFile,
    type SkillInfo,
    type SkillWorkspace,
  } from "$lib/api";
  import Markdown from "agentic-ui-kit/components/prompt-kit/markdown.svelte";
  import Textarea from "agentic-ui-kit/components/ui/textarea.svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import Import from "@lucide/svelte/icons/import";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Play from "@lucide/svelte/icons/play";
  import Save from "@lucide/svelte/icons/save";
  import Search from "@lucide/svelte/icons/search";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import X from "@lucide/svelte/icons/x";

  type Props = {
    open: boolean;
    sessionId?: string;
    cwd?: string;
    onClose: () => void;
  };

  let { open, sessionId = "", cwd = "", onClose }: Props = $props();

  let workspace = $state<SkillWorkspace | null>(null);
  let selected = $state<SkillInfo | null>(null);
  let content = $state("");
  let savedContent = $state("");
  let query = $state("");
  let mode = $state<"view" | "edit">("view");
  let loading = $state(false);
  let saving = $state(false);
  let error = $state("");
  let loadedFor = "";
  let fileInput: HTMLInputElement | undefined = $state();
  let creating = $state<{
    scope: "user" | "project";
    name: string;
    imported: boolean;
  } | null>(null);
  let draftReturn = $state<SkillInfo | null>(null);

  const dirty = $derived(content !== savedContent);
  const previewContent = $derived(
    content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, ""),
  );
  const filteredSkills = $derived.by(() => {
    const skills = workspace?.skills ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((skill) =>
      `${skill.name} ${skill.description} ${skill.scope ?? ""} ${skill.source ?? ""} ${skill.filePath ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  });

  function libraryName(skill: SkillInfo) {
    const source = String(skill.source || "").replace(/^(npm|git):/i, "");
    if (source && source !== "local") return source.replace(/@[^/@]+$/, "");
    const marker = `${skill.filePath ?? ""}`.split("/node_modules/")[1];
    if (marker) {
      const parts = marker.split("/");
      return parts[0]?.startsWith("@")
        ? `${parts[0]}/${parts[1] || ""}`
        : parts[0] || "Extensions";
    }
    return "Extensions";
  }

  const skillGroups = $derived.by(() => {
    const groups = new Map<string, { label: string; skills: SkillInfo[] }>();
    for (const skill of filteredSkills) {
      const editableScope = skill.editableScope;
      const library = libraryName(skill);
      const key = editableScope ?? `library:${library}`;
      const label =
        editableScope === "project"
          ? "Project skills"
          : editableScope === "user"
            ? "User skills"
            : `Library · ${library}`;
      const group = groups.get(key) ?? { label, skills: [] };
      group.skills.push(skill);
      groups.set(key, group);
    }
    const rank = (key: string) =>
      key === "project" ? 0 : key === "user" ? 1 : 2;
    return [...groups.entries()]
      .sort(([a, ga], [b, gb]) => rank(a) - rank(b) || ga.label.localeCompare(gb.label))
      .map(([, group]) => group);
  });

  function scopeLabel(skill: SkillInfo) {
    if (skill.editableScope === "project") return "Project";
    if (skill.editableScope === "user") return "User";
    return "Library";
  }

  function skillTemplate(name: string) {
    return `---\nname: ${name}\ndescription: Describe when Pi should use this skill.\n---\n\n# ${name}\n\nAdd instructions for Pi here.\n`;
  }

  function slug(value: string) {
    return value
      .toLowerCase()
      .replace(/\.md$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "new-skill";
  }

  function frontmatterName(markdown: string, fallback: string) {
    const match = /^---\s*[\r\n]+[\s\S]*?^name:\s*["']?([^\r\n"']+)/m.exec(markdown);
    return slug(match?.[1]?.trim() || fallback);
  }

  async function loadWorkspace(preferredPath = "") {
    if (!sessionId) return;
    loading = true;
    error = "";
    try {
      workspace = await listSkills(sessionId);
      const next =
        workspace.skills.find((skill) => skill.filePath === preferredPath) ??
        workspace.skills[0] ??
        null;
      selected = null;
      content = "";
      savedContent = "";
      creating = null;
      draftReturn = null;
      if (next) await selectSkill(next, true);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function selectSkill(skill: SkillInfo, force = false) {
    if (!sessionId || !skill.filePath) return;
    if (dirty && !force) {
      error = "Save or discard your changes before opening another skill";
      return;
    }
    loading = true;
    error = "";
    try {
      const detail = await getSkillFile(sessionId, skill.filePath);
      selected = { ...skill, editable: detail.editable };
      content = detail.content;
      savedContent = detail.content;
      creating = null;
      draftReturn = null;
      mode = "view";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function startNew() {
    if (dirty) {
      error = "Save or discard your changes before creating another skill";
      return;
    }
    const name = "new-skill";
    draftReturn = selected;
    selected = null;
    creating = { scope: "project", name, imported: false };
    content = skillTemplate(name);
    savedContent = "";
    mode = "edit";
    error = "";
  }

  function updateCreatingName(event: Event) {
    if (!creating) return;
    const name = (event.currentTarget as HTMLInputElement).value;
    creating.name = name;
    if (/^name:\s*.*$/m.test(content)) {
      content = content.replace(/^name:\s*.*$/m, `name: ${name}`);
    }
  }

  function chooseImport() {
    if (dirty) {
      error = "Save or discard your changes before importing a skill";
      return;
    }
    if (!fileInput) return;
    fileInput.value = "";
    fileInput.click();
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const markdown = await file.text();
    const name = frontmatterName(markdown, file.name);
    draftReturn = selected;
    selected = null;
    creating = { scope: "project", name, imported: true };
    content = markdown;
    savedContent = "";
    mode = "edit";
    error = "";
    input.value = "";
  }

  async function save() {
    if (!sessionId || saving || !dirty) return;
    saving = true;
    error = "";
    try {
      if (creating) {
        const result = await createSkill(sessionId, {
          scope: creating.scope,
          name: creating.name,
          content,
        });
        workspace = result.workspace;
        const skill = workspace.skills.find((item) => item.filePath === result.filePath);
        if (skill) {
          selected = skill;
          creating = null;
          draftReturn = null;
        }
      } else if (selected?.filePath) {
        const result = await saveSkillFile(sessionId, selected.filePath, content);
        workspace = result.workspace;
        selected =
          workspace.skills.find((item) => item.filePath === result.filePath) ?? selected;
      }
      savedContent = content;
      mode = "view";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function discard() {
    if (!dirty || saving) return;
    error = "";
    if (!creating) {
      content = savedContent;
      mode = "view";
      return;
    }
    const next = draftReturn ?? workspace?.skills[0] ?? null;
    creating = null;
    draftReturn = null;
    content = "";
    savedContent = "";
    mode = "view";
    if (next) await selectSkill(next, true);
  }

  async function runSkill() {
    const name = selected?.name || creating?.name;
    if (!name || dirty) return;
    await chatPrompt(`/skill:${name}`);
    onClose();
  }

  function close() {
    if (dirty) {
      error = "Save or discard your changes before closing the skill workspace";
      return;
    }
    onClose();
  }

  function onKeydown(event: KeyboardEvent) {
    if (!open) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
      return;
    }
    if (event.key === "Escape" && !saving) {
      event.preventDefault();
      close();
    }
  }

  $effect(() => {
    const key = open && sessionId ? sessionId : "";
    if (!key) {
      loadedFor = "";
      return;
    }
    if (loadedFor === key) return;
    loadedFor = key;
    void loadWorkspace();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<input
  bind:this={fileInput}
  type="file"
  accept=".md,text/markdown,text/plain"
  class="hidden"
  onchange={(event) => void importFile(event)}
/>

{#if open}
  <div class="fixed inset-0 z-[60] flex bg-background" role="dialog" aria-modal="true" aria-label="Skill workspace">
    <aside class="flex w-80 shrink-0 flex-col border-r border-border bg-muted/20">
      <div class="border-b border-border p-3">
        <div class="mb-3 flex items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
            <Sparkles class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold">Pi skills</div>
            <div class="truncate text-[10px] text-muted-foreground" title={cwd}>{cwd}</div>
          </div>
        </div>
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            bind:value={query}
            placeholder="Search skills"
            class="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button type="button" class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background text-xs hover:bg-muted" onclick={startNew}>
            <FilePlus2 class="size-3.5" /> New
          </button>
          <button type="button" class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background text-xs hover:bg-muted" onclick={chooseImport}>
            <Import class="size-3.5" /> Import
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        {#if loading && !workspace}
          <div class="px-3 py-8 text-center text-xs text-muted-foreground">Loading skills</div>
        {:else if filteredSkills.length === 0}
          <div class="px-3 py-8 text-center text-xs text-muted-foreground">No skills found</div>
        {:else}
          {#each skillGroups as group (group.label)}
            <div class="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </div>
            {#each group.skills as skill (skill.filePath || skill.name)}
              <button
                type="button"
                class="mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors {selected?.filePath === skill.filePath ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}"
                onclick={() => void selectSkill(skill)}
              >
                <div class="flex items-center gap-2">
                  <span class="min-w-0 flex-1 truncate text-xs font-medium">{skill.name}</span>
                  <span class="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{scopeLabel(skill)}</span>
                </div>
                {#if skill.description}
                  <div class="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{skill.description}</div>
                {/if}
              </button>
            {/each}
          {/each}
        {/if}
      </div>

      {#if workspace}
        <div class="border-t border-border px-3 py-2 text-[9px] leading-4 text-muted-foreground">
          <div class="truncate" title={workspace.roots.project}>Project · {workspace.roots.project}</div>
          <div class="truncate" title={workspace.roots.user}>User · {workspace.roots.user}</div>
        </div>
      {/if}
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div class="min-w-0 flex-1">
          {#if creating}
            <div class="flex items-center gap-2">
              <input
                value={creating.name}
                oninput={updateCreatingName}
                class="h-8 min-w-0 max-w-xs rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
                aria-label="Skill name"
              />
              <select bind:value={creating.scope} class="h-8 rounded-md border border-border bg-background px-2 text-xs">
                <option value="project">Project skill</option>
                <option value="user">User skill</option>
              </select>
            </div>
          {:else if selected}
            <div class="truncate text-sm font-semibold">{selected.name}</div>
            <div class="truncate font-mono text-[10px] text-muted-foreground" title={selected.filePath}>{selected.filePath}</div>
          {:else}
            <div class="text-sm font-semibold">Choose a skill</div>
          {/if}
        </div>

        {#if selected || creating}
          <div class="flex items-center rounded-md border border-border p-0.5">
            <button type="button" class="flex h-7 items-center gap-1 rounded px-2 text-[11px] {mode === 'view' ? 'bg-muted font-medium' : 'text-muted-foreground'}" onclick={() => (mode = "view")}>
              <Eye class="size-3.5" /> View
            </button>
            <button type="button" class="flex h-7 items-center gap-1 rounded px-2 text-[11px] {mode === 'edit' ? 'bg-muted font-medium' : 'text-muted-foreground'} disabled:opacity-40" onclick={() => (mode = "edit")} disabled={!creating && !selected?.editable} title={!creating && !selected?.editable ? "Package skills are read-only" : "Edit Markdown"}>
              <Pencil class="size-3.5" /> Edit
            </button>
          </div>
          <button type="button" class="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-muted disabled:opacity-40" onclick={() => void runSkill()} disabled={dirty || Boolean(creating)} title="Run this skill in chat">
            <Play class="size-3.5" /> Use skill
          </button>
          {#if dirty}
            <button type="button" class="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs hover:bg-muted disabled:opacity-40" onclick={() => void discard()} disabled={saving} title="Discard unsaved changes">
              <Undo2 class="size-3.5" /> Discard
            </button>
          {/if}
          <button type="button" class="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs text-primary-foreground disabled:opacity-40" onclick={() => void save()} disabled={!dirty || saving || (!creating && !selected?.editable)}>
            <Save class="size-3.5" /> {saving ? "Saving" : "Save"}
          </button>
        {/if}
        <button type="button" class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onclick={close} aria-label="Close skill workspace">
          <X class="size-4" />
        </button>
      </header>

      {#if error}
        <div class="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>
      {/if}

      <div class="min-h-0 flex-1 overflow-auto">
        {#if !selected && !creating}
          <div class="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select a loaded skill, create one directly, or import a Markdown skill file.
          </div>
        {:else if mode === "edit"}
          <Textarea
            bind:value={content}
            spellcheck="false"
            class="block h-full min-h-[28rem] w-full resize-none rounded-none border-0 bg-[var(--pi-canvas)] p-6 font-mono text-[13px] leading-6 shadow-none outline-none focus-visible:ring-0 focus-visible:outline-none"
            aria-label="Skill Markdown editor"
          />
        {:else}
          <article class="mx-auto w-full max-w-4xl px-8 py-8">
            {#if previewContent.trim()}
              <Markdown content={previewContent} compact={false} />
            {:else}
              <div class="text-sm text-muted-foreground">This skill is empty.</div>
            {/if}
          </article>
        {/if}
      </div>

      <footer class="flex h-9 shrink-0 items-center justify-between border-t border-border px-4 text-[10px] text-muted-foreground">
        <span>{dirty ? "Unsaved changes" : selected || creating ? "Saved" : ""}</span>
        <span>⌘/Ctrl+S save · Discard restores the saved version · Esc close</span>
      </footer>
    </main>
  </div>
{/if}
