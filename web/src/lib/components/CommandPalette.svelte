<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import Terminal from "@lucide/svelte/icons/terminal";
  import Plus from "@lucide/svelte/icons/plus";
  import FileText from "@lucide/svelte/icons/file-text";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Tag from "@lucide/svelte/icons/tag";
  import Minimize2 from "@lucide/svelte/icons/minimize-2";
  import Brain from "@lucide/svelte/icons/brain";
  import Cpu from "@lucide/svelte/icons/cpu";
  import Square from "@lucide/svelte/icons/square";
  import Info from "@lucide/svelte/icons/info";
  import Check from "@lucide/svelte/icons/check";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Download from "@lucide/svelte/icons/download";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Power from "@lucide/svelte/icons/power";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Blocks from "@lucide/svelte/icons/blocks";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import GitFork from "@lucide/svelte/icons/git-fork";
  import Settings from "@lucide/svelte/icons/settings";
  import Sun from "@lucide/svelte/icons/sun";
  import {
    downloadText,
    formatModelLabel,
    getChangelog,
    getMessages,
    getSession,
    getSessionThinking,
    getTree,
    chatPrompt,
    listForkCandidates,
    listModels,
    listSkills,
    listExtensions,
    listCommands,
    getScopedModels,
    setScopedModels,
    messageText,
    setPendingEditorText,
    shutdown,
    type ForkCandidate,
    type ModelInfo,
    type SessionRow,
    type SkillInfo,
    type ExtensionInfo,
    type SlashCommandInfo,
    type TreeNode,
  } from "$lib/api";
  import { cycleTheme, theme } from "agentic-ui-kit/theme.svelte.js";
  import { clearModelPickerCache } from "$lib/components/ModelPicker.svelte";
  import { skillNameForSlashCommand } from "$lib/special-message";
  import { untrack } from "svelte";

  export type Command = {
    id: string;
    label: string;
    category: string;
    icon?: typeof Search;
    shortcut?: string;
    disabled?: boolean;
    /** Secondary line under label (e.g. session meta). */
    caption?: string;
    /** Extra text for search (not shown). */
    keywords?: string;
    action: () => void | Promise<void>;
  };

  type View =
    | "commands"
    | "settings"
    | "rename"
    | "open-by-id"
    | "info"
    | "models"
    | "scoped-models"
    | "thinking"
    | "skills"
    | "extensions"
    | "tree"
    | "fork"
    | "resume"
    | "export"
    | "hotkeys"
    | "changelog";

  /** Linear walk of the session tree; indent only grows at real branches. */
  type FlatTreeRow = {
    node: TreeNode;
    indent: number;
    /** True when this node has multiple children (fork). */
    forks: number;
    onPath: boolean;
  };

  const HOTKEYS: { keys: string; desc: string }[] = [
    { keys: "⌘K / Ctrl+K", desc: "Open command palette" },
    { keys: "Esc", desc: "Close palette / abort agent" },
    { keys: "↑ ↓", desc: "Navigate list" },
    { keys: "Enter", desc: "Run selected command" },
    { keys: "Alt+Enter", desc: "Queue follow-up (editor)" },
    { keys: "⇧Tab", desc: "Cycle thinking level" },
    { keys: "⌃P", desc: "Cycle model forward" },
    { keys: "⇧⌃P", desc: "Cycle model backward" },
  ];

  type Props = {
    open: boolean;
    onClose: () => void;
    session?: SessionRow;
    sessions?: SessionRow[];
    onNew?: () => void;
    onResume?: (s: SessionRow) => void;
    onRename?: (name: string) => void;
    onImport?: (content: string, filename?: string) => void | Promise<void>;
    onCompact?: () => void;
    onCloseSession?: () => void;
    onCopyLast?: () => void;
    onShare?: () => void;
    onOpenSkillsWorkspace?: () => void;
    onRequestFork?: (candidate: ForkCandidate) => void;
    onRequestTree?: (node: TreeNode) => void;
    initialTreeId?: string | null;
    onInitialTreeConsumed?: () => void;
    onCycleModel?: (dir: "forward" | "backward") => void;
    onSetModel?: (provider: string, id: string) => void | Promise<void>;
    onCycleThinking?: () => void;
    onSetThinking?: (level: string) => void | Promise<void>;
    onAbort?: () => void;
    /** One-shot: open a sub-view or run import/export when palette opens. */
    boot?: string | null;
    onBootConsumed?: () => void;
  };

  let {
    open,
    onClose,
    session,
    sessions = [],
    onNew,
    onResume,
    onRename,
    onImport,
    onCompact,
    onCloseSession,
    onCopyLast,
    onShare,
    onOpenSkillsWorkspace,
    onRequestFork,
    onRequestTree,
    initialTreeId = null,
    onInitialTreeConsumed,
    onCycleModel,
    onSetModel,
    onCycleThinking,
    onSetThinking,
    onAbort,
    boot = null,
    onBootConsumed,
  }: Props = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement | undefined = $state();
  let renameRef: HTMLInputElement | undefined = $state();
  let openByIdRef: HTMLInputElement | undefined = $state();
  let fileInputRef: HTMLInputElement | undefined = $state();
  let listRef: HTMLDivElement | undefined = $state();
  /** Inline sub-views inside the same modal (no window.alert/prompt). */
  let view = $state<View>("commands");
  let renameDraft = $state("");
  /** Session id or path for resume-by-id (pi `--session`). */
  let openByIdDraft = $state("");
  let openByIdError = $state("");
  let openByIdBusy = $state(false);
  let models = $state<ModelInfo[]>([]);
  let modelsLoading = $state(false);
  let modelsError = $state("");
  /** pi `/scoped-models` — local draft until Apply (no auto-save). */
  let scopedModels = $state<ModelInfo[]>([]);
  /** fullId → checked. Always concrete (no null tri-state). */
  let scopedOn = $state<Record<string, boolean>>({});
  /** Enabled ids in cycle order (shown at top, like pi). */
  let scopedOrder = $state<string[]>([]);
  /** Snapshot at load — dirty when differs from scopedOn. */
  let scopedBaseline = $state<Record<string, boolean>>({});
  /** Own filter — not shared `query` (avoids palette re-filter glitches). */
  let scopedFilter = $state("");
  let scopedLoading = $state(false);
  let scopedError = $state("");
  let scopedApplying = $state(false);
  let thinkingLevels = $state<string[]>([]);
  let thinkingLoading = $state(false);
  let thinkingError = $state("");
  let changelogText = $state("");
  let changelogVersion = $state("");
  let changelogLoading = $state(false);
  let changelogError = $state("");
  let skills = $state<SkillInfo[]>([]);
  let skillsLoading = $state(false);
  let skillsError = $state("");
  let extensions = $state<ExtensionInfo[]>([]);
  let extensionsLoading = $state(false);
  let extensionsError = $state("");
  let treeRoots = $state<TreeNode[]>([]);
  let treeLeafId = $state<string | null>(null);
  let treeLoading = $state(false);
  let treeError = $state("");
  let treeShowAll = $state(false);
  let forkCandidates = $state<ForkCandidate[]>([]);
  let forkLoading = $state(false);
  let forkError = $state("");
  /** Extension + prompt + skill slash commands (session.prompt `/name`). */
  let slashCommands = $state<SlashCommandInfo[]>([]);
  let continueCopied = $state(false);

  /** Shell-safe `pi --session <id>` for resuming this session in a terminal. */
  const continueCmd = $derived.by(() => {
    const id = session?.id;
    if (!id) return "";
    const q = /[\s'"\\$`]/.test(id) ? `'${id.replace(/'/g, `'\\''`)}'` : id;
    return `pi --session ${q}`;
  });

  const infoRows = $derived.by(() => {
    const s = session;
    if (!s) return [] as { label: string; value: string }[];
    const rows: { label: string; value: string }[] = [
      { label: "ID", value: s.id },
    ];
    const name = s.name || s.sessionName;
    if (name) rows.push({ label: "Name", value: name });
    if (s.cwd) rows.push({ label: "Cwd", value: s.cwd });
    if (s.path) rows.push({ label: "File", value: s.path });
    if (s.model) rows.push({ label: "Model", value: formatModelLabel(s.model) });
    if (s.thinkingLevel) rows.push({ label: "Thinking", value: s.thinkingLevel });
    if (s.messageCount != null) {
      rows.push({ label: "Messages", value: String(s.messageCount) });
    }
    return rows;
  });

  async function copyContinueCmd() {
    if (!continueCmd) return;
    try {
      await navigator.clipboard.writeText(continueCmd);
      continueCopied = true;
      setTimeout(() => {
        continueCopied = false;
      }, 1200);
    } catch {
      /* ignore */
    }
  }

  function run(fn?: () => void | Promise<void>) {
    void fn?.();
    onClose();
  }

  function backToCommands() {
    view = "commands";
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openRename() {
    renameDraft = session?.name || session?.sessionName || "";
    view = "rename";
    requestAnimationFrame(() => {
      renameRef?.focus();
      renameRef?.select();
    });
  }

  function openById() {
    openByIdDraft = "";
    openByIdError = "";
    openByIdBusy = false;
    view = "open-by-id";
    requestAnimationFrame(() => openByIdRef?.focus());
  }

  async function submitOpenById() {
    const ref = openByIdDraft.trim();
    if (!ref || openByIdBusy) return;
    openByIdBusy = true;
    openByIdError = "";
    try {
      // GET ensures hub open (live or disk) and returns canonical row
      const detail = await getSession(ref);
      onResume?.({ ...detail, running: true });
      onClose();
    } catch (e) {
      openByIdError = e instanceof Error ? e.message : String(e);
    } finally {
      openByIdBusy = false;
    }
  }

  function openImport() {
    // Browser file picker — real paths aren't available; we upload contents.
    // Close palette first so the dialog isn't buried under the modal.
    onClose();
    requestAnimationFrame(() => {
      if (!fileInputRef) return;
      fileInputRef.value = "";
      fileInputRef.click();
    });
  }

  async function onFilePicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      await onImport?.(content, file.name);
      onClose();
    } catch {
      /* App sets banner error; keep palette so user can retry */
    } finally {
      input.value = "";
    }
  }

  function openInfo() {
    view = "info";
  }

  function openModels() {
    query = "";
    selectedIndex = 0;
    view = "models";
    void loadModels();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openScopedModels() {
    query = "";
    scopedFilter = "";
    selectedIndex = 0;
    view = "scoped-models";
    void loadScopedModels();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openResume() {
    query = "";
    selectedIndex = 0;
    view = "resume";
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openExport() {
    query = "";
    selectedIndex = 0;
    view = "export";
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openThinking() {
    query = "";
    selectedIndex = 0;
    view = "thinking";
    void loadThinking();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openSkills() {
    if (onOpenSkillsWorkspace) {
      onClose();
      onOpenSkillsWorkspace();
      return;
    }
    query = "";
    selectedIndex = 0;
    view = "skills";
    void loadSkills();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openExtensions() {
    query = "";
    selectedIndex = 0;
    view = "extensions";
    void loadExtensions();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openTree() {
    query = "";
    selectedIndex = 0;
    view = "tree";
    void loadTree();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openFork() {
    query = "";
    selectedIndex = 0;
    view = "fork";
    void loadFork();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openHotkeys() {
    view = "hotkeys";
  }

  function openChangelog() {
    view = "changelog";
    void loadChangelog();
  }

  function openSettings() {
    query = "";
    selectedIndex = 0;
    view = "settings";
    requestAnimationFrame(() => inputRef?.focus());
  }

  /** GUI settings menu (pi `/settings` stand-in). Always list full set. */
  const settingsCommands = $derived.by((): Command[] => {
    const hasSession = Boolean(session?.id);
    const modelCap = hasSession
      ? session?.model
        ? formatModelLabel(session.model)
        : "Select model"
      : "Open a session first";
    const thinkCap = hasSession
      ? session?.thinkingLevel || session?.thinking || "Select level"
      : "Open a session first";

    return [
      {
        id: "set-theme",
        label: `Theme: ${theme.value}`,
        caption: "Cycle light → dark → system",
        category: "Display",
        icon: Sun,
        keywords: "settings appearance light dark system",
        action: () => cycleTheme(),
      },
      {
        id: "set-model",
        label: "Model",
        caption: modelCap,
        category: "Agent",
        icon: Cpu,
        keywords: "settings model provider llm",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openModels();
        },
      },
      {
        id: "set-scoped-models",
        label: "Scoped models",
        caption: hasSession
          ? "Enable/disable models for Ctrl+P cycling"
          : "Open a session first",
        category: "Agent",
        icon: Cpu,
        keywords: "settings scoped models cycle ctrl+p allowlist",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openScopedModels();
        },
      },
      {
        id: "set-thinking",
        label: "Thinking level",
        caption: thinkCap,
        category: "Agent",
        icon: Brain,
        keywords: "settings thinking reason effort level",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openThinking();
        },
      },
      {
        id: "set-skills",
        label: "Skills",
        caption: hasSession
          ? "Browse, create, edit, import, and run skills"
          : "Open a session first",
        category: "Agent",
        icon: Sparkles,
        keywords: "settings skills",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openSkills();
        },
      },
      {
        id: "set-extensions",
        label: "Extensions",
        caption: hasSession ? "Loaded extensions" : "Open a session first",
        category: "Agent",
        icon: Blocks,
        keywords: "settings extensions plugins",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openExtensions();
        },
      },
      {
        id: "set-info",
        label: "Session",
        caption: hasSession
          ? "Session file, ID, messages, tokens, cost"
          : "Open a session first",
        category: "Session",
        icon: Info,
        keywords: "settings session info stats id",
        disabled: !hasSession,
        action: () => {
          if (!session?.id) return;
          openInfo();
        },
      },
      {
        id: "set-hotkeys",
        label: "Hotkeys",
        category: "Help",
        icon: Keyboard,
        keywords: "settings hotkeys keys bindings shortcuts",
        action: openHotkeys,
      },
      {
        id: "set-changelog",
        label: "Changelog",
        category: "Help",
        icon: ScrollText,
        keywords: "settings changelog release notes version history",
        action: openChangelog,
      },
    ];
  });

  const filteredSettings = $derived.by(() => {
    const q = query.trim().toLowerCase();
    // Empty or residual from `/settings` → show everything
    if (!q || q === "settings" || q === "setting") return settingsCommands;
    return settingsCommands.filter((c) => {
      const hay =
        `${c.label} ${c.caption ?? ""} ${c.keywords ?? ""} ${c.category}`.toLowerCase();
      return hay.includes(q);
    });
  });

  function applyBoot(b: string) {
    switch (b) {
      case "settings":
        openSettings();
        break;
      case "models":
        openModels();
        break;
      case "scoped-models":
        openScopedModels();
        break;
      case "resume":
        openResume();
        break;
      case "export":
        openExport();
        break;
      case "rename":
        openRename();
        break;
      case "info":
        openInfo();
        break;
      case "tree":
        openTree();
        break;
      case "fork":
        openFork();
        break;
      case "hotkeys":
        openHotkeys();
        break;
      case "changelog":
        openChangelog();
        break;
      case "skills":
        openSkills();
        break;
      case "extensions":
        openExtensions();
        break;
      case "thinking":
        openThinking();
        break;
      case "import":
        openImport();
        break;
      case "export-html":
        void exportSession("html");
        break;
      case "export-jsonl":
        void exportSession("jsonl");
        break;
      default:
        view = "commands";
    }
  }

  async function loadModels() {
    if (!session?.id) return;
    modelsLoading = true;
    modelsError = "";
    try {
      const res = await listModels(session.id);
      models = res.models ?? [];
      // Prefer current model at top of selection
      const cur = session.model;
      if (cur?.provider && cur?.id) {
        const idx = models.findIndex(
          (m) => m.provider === cur.provider && m.id === cur.id,
        );
        if (idx >= 0) selectedIndex = idx;
      }
    } catch (e) {
      modelsError = e instanceof Error ? e.message : String(e);
      models = [];
    } finally {
      modelsLoading = false;
    }
  }

  function modelFullId(m: ModelInfo): string {
    return `${m.provider}/${m.id}`;
  }

  function scopedChecked(fullId: string): boolean {
    return scopedOn[fullId] === true;
  }

  const scopedOnCount = $derived(
    Object.values(scopedOn).filter(Boolean).length,
  );
  const scopedAllOn = $derived(
    scopedModels.length > 0 && scopedOnCount === scopedModels.length,
  );
  const scopedNoneOn = $derived(scopedOnCount === 0);
  const scopedDirty = $derived.by(() => {
    const ids = scopedModels.map(modelFullId);
    for (const id of ids) {
      if ((scopedOn[id] === true) !== (scopedBaseline[id] === true)) return true;
    }
    return false;
  });

  /** Map server enabled → checkbox map + order. null = all on (models order). */
  function scopedStateFromServer(
    models: ModelInfo[],
    enabled: string[] | null,
  ): { map: Record<string, boolean>; order: string[] } {
    const allIds = models.map(modelFullId);
    const map: Record<string, boolean> = {};
    if (enabled == null) {
      for (const id of allIds) map[id] = true;
      return { map, order: allIds };
    }
    const known = new Set(allIds);
    const order = enabled.filter((id) => known.has(id));
    for (const id of allIds) map[id] = order.includes(id);
    return { map, order };
  }

  /** Order of checked ids → API payload. all on → null (no scope). */
  function scopedPayloadFromOrder(
    models: ModelInfo[],
    order: string[],
    on: Record<string, boolean>,
  ): string[] | null {
    const allIds = models.map(modelFullId);
    const enabled = order.filter((id) => on[id] && allIds.includes(id));
    // append any checked missing from order (shouldn't happen)
    for (const id of allIds) {
      if (on[id] && !enabled.includes(id)) enabled.push(id);
    }
    if (enabled.length === allIds.length) return null;
    return enabled;
  }

  async function loadScopedModels() {
    if (!session?.id) return;
    scopedLoading = true;
    scopedError = "";
    try {
      const res = await getScopedModels(session.id);
      const models = res.models ?? [];
      const { map, order } = scopedStateFromServer(models, res.enabled);
      scopedModels = models;
      scopedOn = map;
      scopedOrder = order;
      scopedBaseline = { ...map };
    } catch (e) {
      scopedError = e instanceof Error ? e.message : String(e);
      scopedModels = [];
      scopedOn = {};
      scopedOrder = [];
      scopedBaseline = {};
    } finally {
      scopedLoading = false;
    }
  }

  function scopedSelectAll() {
    const next: Record<string, boolean> = {};
    const order: string[] = [];
    for (const m of scopedModels) {
      const id = modelFullId(m);
      next[id] = true;
      order.push(id);
    }
    scopedOn = next;
    scopedOrder = order;
    scopedError = "";
  }

  function scopedClearAll() {
    const next: Record<string, boolean> = {};
    for (const m of scopedModels) next[modelFullId(m)] = false;
    scopedOn = next;
    scopedOrder = [];
    scopedError = "";
  }

  function scopedToggle(fullId: string) {
    const wasOn = scopedChecked(fullId);
    if (wasOn) {
      scopedOn = { ...scopedOn, [fullId]: false };
      scopedOrder = scopedOrder.filter((id) => id !== fullId);
    } else {
      scopedOn = { ...scopedOn, [fullId]: true };
      // Newly enabled join end of cycle order (then stay at top of list)
      if (!scopedOrder.includes(fullId)) scopedOrder = [...scopedOrder, fullId];
    }
    scopedError = "";
  }

  function scopedReset() {
    scopedOn = { ...scopedBaseline };
    // rebuild order: previously-on ids first (models list order among baseline)
    const allIds = scopedModels.map(modelFullId);
    scopedOrder = allIds.filter((id) => scopedBaseline[id] === true);
    scopedError = "";
  }

  /** Push draft into session + settings. Closes on success. */
  async function scopedApply() {
    if (!session?.id || scopedApplying || !scopedDirty) return;
    scopedApplying = true;
    scopedError = "";
    try {
      const payload = scopedPayloadFromOrder(
        scopedModels,
        scopedOrder,
        scopedOn,
      );
      await setScopedModels(session.id, payload);
      scopedBaseline = { ...scopedOn };
      // Model picker / /model list must re-fetch scoped set
      clearModelPickerCache(session.id);
      onClose();
    } catch (e) {
      scopedError = e instanceof Error ? e.message : String(e);
    } finally {
      scopedApplying = false;
    }
  }

  async function loadThinking() {
    if (!session?.id) return;
    thinkingLoading = true;
    thinkingError = "";
    try {
      const res = await getSessionThinking(session.id);
      thinkingLevels = res.available ?? [];
      const cur = res.level ?? res.thinkingLevel ?? session.thinkingLevel;
      if (cur) {
        const idx = thinkingLevels.indexOf(cur);
        if (idx >= 0) selectedIndex = idx;
      }
    } catch (e) {
      thinkingError = e instanceof Error ? e.message : String(e);
      thinkingLevels = [];
    } finally {
      thinkingLoading = false;
    }
  }

  async function loadSkills() {
    if (!session?.id) return;
    skillsLoading = true;
    skillsError = "";
    try {
      const res = await listSkills(session.id);
      skills = res.skills ?? [];
    } catch (e) {
      skillsError = e instanceof Error ? e.message : String(e);
      skills = [];
    } finally {
      skillsLoading = false;
    }
  }

  async function loadSlashCommands() {
    if (!session?.id) {
      slashCommands = [];
      return;
    }
    try {
      const res = await listCommands(session.id);
      slashCommands = res.commands ?? [];
    } catch {
      slashCommands = [];
    }
  }

  async function loadExtensions() {
    if (!session?.id) return;
    extensionsLoading = true;
    extensionsError = "";
    try {
      const res = await listExtensions(session.id);
      extensions = res.extensions ?? [];
    } catch (e) {
      extensionsError = e instanceof Error ? e.message : String(e);
      extensions = [];
    } finally {
      extensionsLoading = false;
    }
  }

  /** Bookkeeping entries hidden in the default linear view (pi default filter). */
  function isTreeNoise(n: TreeNode): boolean {
    return (
      n.type === "label" ||
      n.type === "custom" ||
      n.type === "model_change" ||
      n.type === "thinking_level_change" ||
      n.type === "session_info"
    );
  }

  /** Walk leaf → root so the active branch can be sorted first and highlighted. */
  function activePathIds(roots: TreeNode[], leafId: string | null): Set<string> {
    const path = new Set<string>();
    if (!leafId) return path;
    const parent = new Map<string, string | null>();
    const walk = (nodes: TreeNode[], p: string | null) => {
      for (const n of nodes) {
        parent.set(n.id, p);
        if (n.children?.length) walk(n.children, n.id);
      }
    };
    walk(roots, null);
    let id: string | null = leafId;
    while (id) {
      path.add(id);
      id = parent.get(id) ?? null;
    }
    return path;
  }

  /**
   * Flatten like pi's tree-selector: single-child chains stay linear (same indent);
   * indent only when a node has multiple children. Active branch listed first.
   */
  function flattenTree(
    roots: TreeNode[],
    leafId: string | null,
  ): FlatTreeRow[] {
    const out: FlatTreeRow[] = [];
    const onPath = activePathIds(roots, leafId);

    const containsActive = new Map<TreeNode, boolean>();
    const mark = (n: TreeNode): boolean => {
      let has = leafId !== null && n.id === leafId;
      for (const c of n.children ?? []) {
        if (mark(c)) has = true;
      }
      containsActive.set(n, has);
      return has;
    };
    for (const r of roots) mark(r);

    const order = (kids: TreeNode[]) =>
      [...kids].sort(
        (a, b) =>
          Number(containsActive.get(b)) - Number(containsActive.get(a)),
      );

    const visit = (node: TreeNode, indent: number, justBranched: boolean) => {
      const kids = node.children ?? [];
      out.push({
        node,
        indent,
        forks: kids.length > 1 ? kids.length : 0,
        onPath: onPath.has(node.id),
      });
      const multi = kids.length > 1;
      // Stay flat on single-child chains; +1 only at real forks (or first gen after fork).
      const childIndent =
        multi || (justBranched && indent > 0) ? indent + 1 : indent;
      for (const child of order(kids)) {
        visit(child, childIndent, multi);
      }
    };

    for (const root of order(roots)) {
      visit(root, 0, roots.length > 1);
    }
    return out;
  }

  async function loadTree() {
    if (!session?.id) return;
    treeLoading = true;
    treeError = "";
    try {
      const res = await getTree(session.id);
      treeRoots = res.tree ?? [];
      treeLeafId = res.leafId ?? null;
      // Match default visible list (noise hidden) so selectedIndex lines up.
      const flat = flattenTree(treeRoots, treeLeafId).filter(
        (r) => treeShowAll || !isTreeNoise(r.node) || r.node.id === treeLeafId,
      );
      const selectedId = initialTreeId || treeLeafId;
      if (selectedId) {
        const idx = flat.findIndex((r) => r.node.id === selectedId);
        if (idx >= 0) selectedIndex = idx;
      }
      if (initialTreeId) onInitialTreeConsumed?.();
    } catch (e) {
      treeError = e instanceof Error ? e.message : String(e);
      treeRoots = [];
      treeLeafId = null;
    } finally {
      treeLoading = false;
    }
  }

  async function loadChangelog() {
    changelogLoading = true;
    changelogError = "";
    try {
      const res = await getChangelog();
      changelogText = res.text ?? "";
      changelogVersion = res.version ?? "";
    } catch (e) {
      changelogError = e instanceof Error ? e.message : String(e);
      changelogText = "";
    } finally {
      changelogLoading = false;
    }
  }

  function submitRename() {
    const name = renameDraft.trim();
    if (!name) return;
    onRename?.(name);
    onClose();
  }

  function pickModel(m: ModelInfo) {
    void onSetModel?.(m.provider, m.id);
    onClose();
  }

  function pickThinking(level: string) {
    void onSetThinking?.(level);
    onClose();
  }

  async function pickSkill(sk: SkillInfo) {
    if (!session?.id || !sk.name) return;
    try {
      // Via ChatPanel so the user bubble + streaming state show immediately
      await chatPrompt(`/skill:${sk.name}`, {
        skillName: sk.name,
        commandName: `skill:${sk.name}`,
        commandSource: "skill",
      });
      onClose();
    } catch {
      /* keep palette open so user can retry */
    }
  }

  /** Run `/name` via chat, or drop into the editor when args are expected. */
  async function pickSlash(cmd: SlashCommandInfo) {
    if (!session?.id || !cmd.name) return;
    const text = `/${cmd.name}`;
    if (cmd.argumentHint) {
      setPendingEditorText(`${text} `);
      onClose();
      return;
    }
    try {
      const skillName = skillNameForSlashCommand(cmd, slashCommands);
      await chatPrompt(text, {
        ...(skillName ? { skillName } : {}),
        commandName: cmd.name,
        commandSource: cmd.source,
      });
      onClose();
    } catch {
      /* keep palette open so user can retry */
    }
  }

  function slashCategory(source: string): string {
    if (source === "prompt") return "Prompt";
    if (source === "skill") return "Skill";
    return "Extension";
  }

  function slashIcon(source: string) {
    if (source === "prompt") return FileText;
    if (source === "skill") return Sparkles;
    return Terminal;
  }

  function pickTreeNode(node: TreeNode) {
    if (!session?.id || !node.id) return;
    // Match Pi: selecting the current leaf is a no-op.
    if (node.id !== treeLeafId) onRequestTree?.(node);
    onClose();
  }

  async function loadFork() {
    if (!session?.id) return;
    forkLoading = true;
    forkError = "";
    try {
      const res = await listForkCandidates(session.id);
      // Newest first — match pi selector UX for recent prompts.
      forkCandidates = [...(res.messages ?? [])].reverse();
    } catch (e) {
      forkError = e instanceof Error ? e.message : String(e);
      forkCandidates = [];
    } finally {
      forkLoading = false;
    }
  }

  function pickFork(c: ForkCandidate) {
    if (!session?.id || !c.entryId) return;
    onRequestFork?.(c);
    onClose();
  }

  async function exportSession(fmt: "jsonl" | "html") {
    if (!session?.id) return;
    try {
      const { messages } = await getMessages(session.id);
      const base =
        (session.name || session.sessionName || session.id)
          .replace(/[^\w.-]+/g, "_")
          .slice(0, 60) || "session";
      if (fmt === "jsonl") {
        const body = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
        downloadText(`${base}.jsonl`, body, "application/x-ndjson");
      } else {
        const parts = messages.map((m) => {
          const role = m.role || "unknown";
          const text = messageText(m).replace(/</g, "&lt;");
          return `<section class="msg"><h3>${role}</h3><pre>${text}</pre></section>`;
        });
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${base}</title>
<style>body{font-family:system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem}
pre{white-space:pre-wrap;word-break:break-word;background:var(--pi-canvas,#faf9f7);padding:1rem;border-radius:8px}
h3{margin:1.5rem 0 0.5rem;text-transform:capitalize}</style></head><body>
<h1>${base}</h1>${parts.join("\n")}</body></html>`;
        downloadText(`${base}.html`, html, "text/html");
      }
      onClose();
    } catch {
      /* keep palette open so user can retry */
    }
  }

  async function quitServer() {
    try {
      await shutdown();
    } catch {
      /* server dies mid-response */
    }
    onClose();
  }

  const filteredModels = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => {
      const hay = `${m.provider} ${m.id} ${m.name}`.toLowerCase();
      return hay.includes(q);
    });
  });

  /** pi getSortedIds: enabled (cycle order) first, then the rest. */
  const filteredScoped = $derived.by(() => {
    const q = scopedFilter.trim().toLowerCase();
    const byId = new Map(scopedModels.map((m) => [modelFullId(m), m]));
    const match = (m: ModelInfo) => {
      if (!q) return true;
      const hay = `${m.provider} ${m.id} ${m.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    };
    const onIds = scopedOrder.filter((id) => scopedOn[id] && byId.has(id));
    const onSet = new Set(onIds);
    const off = scopedModels.filter((m) => !onSet.has(modelFullId(m)));
    const ordered = [
      ...onIds.map((id) => byId.get(id)!),
      ...off,
    ];
    return ordered.filter(match);
  });

  /** Sessions for `/resume` — newest first, exclude current. */
  const resumeSessions = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = [...sessions]
      .filter((s) => s.id !== session?.id)
      .sort((a, b) => {
        const am = a.modified ? new Date(a.modified).getTime() : 0;
        const bm = b.modified ? new Date(b.modified).getTime() : 0;
        return bm - am;
      });
    if (!q) return list;
    return list.filter((s) => {
      const hay = [
        s.name,
        s.sessionName,
        s.firstMessage,
        s.cwd,
        s.path,
        s.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  });

  const exportOptions = [
    {
      id: "html" as const,
      label: "HTML",
      caption: "Export session to HTML",
    },
    {
      id: "jsonl" as const,
      label: "JSONL",
      caption: "Export session to JSONL (importable)",
    },
  ];
  const filteredExport = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === "export") return exportOptions;
    return exportOptions.filter((o) =>
      `${o.label} ${o.caption} ${o.id}`.toLowerCase().includes(q),
    );
  });

  const filteredThinking = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return thinkingLevels;
    return thinkingLevels.filter((l) => l.toLowerCase().includes(q));
  });

  const filteredSkills = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((sk) => {
      const hay =
        `${skillParent(sk)} ${sk.name} ${sk.description}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const filteredExtensions = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return extensions;
    return extensions.filter((ext) => {
      const hay =
        `${extName(ext)} ${ext.path} ${ext.resolvedPath ?? ""} ${ext.scope ?? ""} ${ext.source ?? ""} ${ext.commands.join(" ")} ${ext.tools.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  });

  /** Package / scope as the parent segment in the one-line skill row. */
  function skillParent(sk: SkillInfo): string {
    return (sk.scope || sk.source || "").trim();
  }

  function skillLine(sk: SkillInfo): string {
    const parent = skillParent(sk);
    const title = parent ? `${parent} › ${sk.name}` : sk.name;
    const desc = (sk.description || "").replace(/\s+/g, " ").trim();
    return desc ? `${title} — ${desc}` : title;
  }

  function extName(ext: ExtensionInfo): string {
    const p = ext.resolvedPath || ext.path || "";
    return p.split(/[/\\]/).filter(Boolean).pop() || p || "?";
  }

  function extParent(ext: ExtensionInfo): string {
    return (ext.scope || ext.source || "").trim();
  }

  function extLine(ext: ExtensionInfo): string {
    const parent = extParent(ext);
    const name = extName(ext);
    const title = parent ? `${parent} › ${name}` : name;
    const bits = [
      ext.commands.length ? `${ext.commands.length} cmd` : "",
      ext.tools.length ? `${ext.tools.length} tool` : "",
    ].filter(Boolean);
    return bits.length ? `${title} — ${bits.join(", ")}` : title;
  }

  const flatTree = $derived(flattenTree(treeRoots, treeLeafId));

  const filteredTree = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return flatTree.filter((row) => {
      const n = row.node;
      // Default: hide bookkeeping; search shows everything matching.
      if (!q && !treeShowAll && isTreeNoise(n) && n.id !== treeLeafId) return false;
      if (!q) return true;
      const hay =
        `${n.preview} ${n.type} ${n.role ?? ""} ${n.label ?? ""} ${n.id}`.toLowerCase();
      return hay.includes(q);
    });
  });

  const filteredFork = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forkCandidates;
    return forkCandidates.filter((c) => c.text.toLowerCase().includes(q));
  });

  function treeKind(n: TreeNode): string {
    return n.role || n.type || "entry";
  }

  function treeLine(n: TreeNode): string {
    const kind = treeKind(n);
    const label = n.label ? ` · ${n.label}` : "";
    const preview = (n.preview || "—").replace(/\s+/g, " ").trim();
    return `${kind}${label} — ${preview}`;
  }

  function buildCommands(): Command[] {
    const cmds: Command[] = [];

    // Labels/descriptions track pi BUILTIN_SLASH_COMMANDS / docs/usage.md
    cmds.push({
      id: "new",
      label: "New session",
      category: "Session",
      icon: Plus,
      keywords: "session new start /new",
      action: () => run(onNew),
    });

    cmds.push({
      id: "import",
      label: "Import",
      category: "Session",
      icon: FolderOpen,
      caption: "Import and resume a session from a JSONL file",
      keywords: "session import jsonl /import",
      action: openImport,
    });

    cmds.push({
      id: "resume",
      label: "Resume session",
      category: "Session",
      icon: FileText,
      caption: "Pick from previous sessions",
      keywords: "resume open recent switch session /resume",
      action: openResume,
    });

    cmds.push({
      id: "open-by-id",
      label: "Open session by ID",
      category: "Session",
      icon: Terminal,
      caption: "Paste a session ID, path, or pi --session …",
      keywords:
        "resume terminal session id path open by id pi --session /resume attach continue",
      action: openById,
    });

    if (session?.id) {
      cmds.push({
        id: "rename",
        label: "Name",
        category: "Session",
        icon: Tag,
        caption: "Set session display name",
        keywords: "rename name /name",
        action: openRename,
      });

      cmds.push({
        id: "compact",
        label: "Compact",
        category: "Session",
        icon: Minimize2,
        caption: "Manually compact the session context",
        keywords: "compact context summarize /compact",
        action: () => run(onCompact),
      });

      cmds.push({
        id: "copy-last",
        label: "Copy",
        category: "Session",
        icon: Copy,
        caption: "Copy last agent message to clipboard",
        keywords: "copy last assistant /copy",
        action: () => run(onCopyLast),
      });

      cmds.push({
        id: "share",
        label: "Share",
        category: "Session",
        icon: Share2,
        caption: "Share session as a secret GitHub gist",
        keywords: "share gist /share",
        disabled: !session?.id,
        action: () => run(onShare),
      });

      if (continueCmd) {
        cmds.push({
          id: "copy-terminal-session",
          label: "Copy pi --session",
          category: "Session",
          icon: Terminal,
          caption: continueCmd,
          keywords: "pi --session continue reconnect clipboard terminal resume",
          action: () => run(() => void copyContinueCmd()),
        });
      }

      cmds.push({
        id: "session-info",
        label: "Session",
        category: "Session",
        icon: Info,
        caption: "Session file, ID, messages, tokens, and cost",
        keywords: "session info stats id /session",
        action: openInfo,
      });

      cmds.push({
        id: "close-session",
        label: "Close session",
        category: "Session",
        icon: Trash2,
        action: () => run(onCloseSession),
      });

      cmds.push({
        id: "select-model",
        label: "Model",
        category: "Model",
        icon: Cpu,
        caption: "Select model",
        keywords: "/model",
        action: openModels,
      });

      cmds.push({
        id: "scoped-models",
        label: "Scoped models",
        category: "Model",
        icon: Cpu,
        caption: "Enable/disable models for Ctrl+P cycling",
        keywords: "cycle ctrl+p allowlist enable disable scoped /scoped-models",
        action: openScopedModels,
      });

      cmds.push({
        id: "cycle-model",
        label: "Cycle model forward",
        category: "Model",
        icon: Cpu,
        shortcut: "⌃P",
        action: () => run(() => onCycleModel?.("forward")),
      });

      cmds.push({
        id: "cycle-model-back",
        label: "Cycle model backward",
        category: "Model",
        icon: Cpu,
        shortcut: "⇧⌃P",
        action: () => run(() => onCycleModel?.("backward")),
      });

      cmds.push({
        id: "select-thinking",
        label: "Thinking level",
        category: "Model",
        icon: Brain,
        keywords: "thinking level /settings",
        action: openThinking,
      });

      cmds.push({
        id: "cycle-thinking",
        label: "Cycle thinking level",
        category: "Model",
        icon: Brain,
        shortcut: "⇧Tab",
        action: () => run(onCycleThinking),
      });

      cmds.push({
        id: "skills",
        label: "Skills",
        category: "Agent",
        icon: Sparkles,
        keywords: "skills /skill",
        action: openSkills,
      });

      cmds.push({
        id: "extensions",
        label: "Extensions",
        category: "Agent",
        icon: Blocks,
        keywords: "extensions",
        action: openExtensions,
      });

      // Invocable slash commands (extension / prompt / skill) — same as pi `/`
      for (const cmd of slashCommands) {
        if (!cmd.name) continue;
        const hint = cmd.argumentHint?.trim();
        const desc = (cmd.description || "").replace(/\s+/g, " ").trim();
        cmds.push({
          id: `slash-${cmd.source}-${cmd.name}`,
          label: `/${cmd.name}`,
          caption: [hint, desc].filter(Boolean).join(" — ") || undefined,
          category: slashCategory(cmd.source),
          icon: slashIcon(cmd.source),
          keywords: [cmd.source, cmd.scope, hint, desc, "slash", "command"]
            .filter(Boolean)
            .join(" "),
          action: () => void pickSlash(cmd),
        });
      }

      cmds.push({
        id: "tree",
        label: "Tree",
        category: "Session",
        icon: GitBranch,
        caption: "Navigate session tree (switch branches)",
        keywords: "tree branch navigate /tree",
        action: openTree,
      });

      cmds.push({
        id: "fork",
        label: "Fork",
        category: "Session",
        icon: GitFork,
        caption: "Create a new fork from a previous user message",
        keywords: "fork branch clone /fork",
        action: openFork,
      });

      cmds.push({
        id: "export",
        label: "Export",
        category: "Session",
        icon: Download,
        caption: "Export session (HTML or JSONL)",
        keywords: "html jsonl download export session /export",
        action: openExport,
      });

      cmds.push({
        id: "abort",
        label: "Abort",
        category: "Agent",
        icon: Square,
        shortcut: "Esc",
        caption: "Stop the agent turn",
        action: () => run(onAbort),
      });
    }

    cmds.push({
      id: "settings",
      label: "Settings",
      category: "App",
      icon: Settings,
      caption: "Open settings menu",
      keywords: "theme model thinking preferences /settings",
      action: openSettings,
    });

    cmds.push({
      id: "hotkeys",
      label: "Hotkeys",
      category: "Help",
      icon: Keyboard,
      caption: "Show all keyboard shortcuts",
      keywords: "keyboard shortcuts /hotkeys",
      action: openHotkeys,
    });

    cmds.push({
      id: "changelog",
      label: "Changelog",
      category: "Help",
      icon: ScrollText,
      caption: "Show changelog entries",
      keywords: "release notes version /changelog",
      action: openChangelog,
    });

    cmds.push({
      id: "quit",
      label: "Quit",
      category: "App",
      icon: Power,
      caption: "Quit pi-gui",
      keywords: "quit server exit stop /quit",
      action: () => void quitServer(),
    });

    // All sessions (open + closed) — searchable; empty query limited in filtered.
    // Server already sorts by modified-desc; keep that order for Recent.
    const byModified = [...sessions].sort((a, b) => {
      const am = a.modified ? new Date(a.modified).getTime() : 0;
      const bm = b.modified ? new Date(b.modified).getTime() : 0;
      return bm - am;
    });
    for (const s of byModified) {
      if (s.id === session?.id) continue;
      const name =
        s.name ||
        s.sessionName ||
        s.firstMessage?.slice(0, 40) ||
        "Untitled";
      const folder = s.cwd?.split("/").filter(Boolean).at(-1);
      const caption = [folder, formatModified(s.modified), s.running ? "open" : null]
        .filter(Boolean)
        .join(" · ");
      cmds.push({
        id: `resume-${s.id}`,
        label: name,
        caption: caption || undefined,
        category: "Recent",
        shortcut: s.running ? "Switch" : "Resume",
        keywords: [s.firstMessage, s.cwd, s.path, s.id, s.sessionName, s.name, caption]
          .filter(Boolean)
          .join(" "),
        icon: FileText,
        action: () => run(() => onResume?.(s)),
      });
    }

    return cmds;
  }

  function formatModified(d?: string | Date): string {
    if (!d) return "";
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) return "";
    const sec = Math.round((Date.now() - t) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
    return new Date(t).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  const commands = $derived(buildCommands());

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Don't dump every closed disk session / skill into the idle palette.
      let recent = 0;
      return commands.filter((c) => {
        if (c.category === "Skill") return false;
        if (c.category !== "Recent") return true;
        if (recent >= 8) return false;
        recent++;
        return true;
      });
    }
    return commands.filter((c) =>
      (c.label + " " + (c.caption ?? "") + " " + c.category + " " + (c.keywords ?? ""))
        .toLowerCase()
        .includes(q),
    );
  });

  const grouped = $derived(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  });

  const flatItems = $derived(
    Array.from(grouped().entries()).flatMap(([cat, items]) =>
      items.map((item) => ({ category: cat, ...item })),
    ),
  );

  // Open (or re-open) palette. Boot is read untracked so clearing it
  // doesn't re-run and reset view back to commands mid-settings.
  $effect(() => {
    if (!open) return;
    query = "";
    selectedIndex = 0;
    void loadSlashCommands();
    untrack(() => {
      const b = boot;
      if (b) {
        onBootConsumed?.();
        applyBoot(b);
      } else {
        view = "commands";
      }
    });
    requestAnimationFrame(() => inputRef?.focus());
  });

  $effect(() => {
    query;
    if (
      open &&
      (view === "commands" ||
        view === "settings" ||
        view === "models" ||
        view === "thinking" ||
        view === "skills" ||
        view === "extensions" ||
        view === "tree" ||
        view === "fork" ||
        view === "resume" ||
        view === "export")
    ) {
      selectedIndex = 0;
    }
  });

  // Reset list cursor when scoped filter changes (own state, not `query`)
  $effect(() => {
    void scopedFilter;
    if (open && view === "scoped-models") selectedIndex = 0;
  });

  function keyTargetIsField(t: EventTarget | null): boolean {
    return (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable)
    );
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (view !== "commands") {
        query = "";
        scopedFilter = "";
        backToCommands();
        return;
      }
      onClose();
      return;
    }

    const inField = keyTargetIsField(e.target);

    if (view === "rename") {
      if (e.key === "Enter") {
        e.preventDefault();
        submitRename();
      }
      return;
    }

    if (view === "open-by-id") {
      if (e.key === "Enter") {
        e.preventDefault();
        void submitOpenById();
      }
      return;
    }

    if (view === "info" || view === "hotkeys" || view === "changelog") {
      if (e.key === "Enter") {
        e.preventDefault();
        backToCommands();
      }
      return;
    }

    if (view === "settings") {
      const n = filteredSettings.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredSettings[selectedIndex];
        if (item && !item.disabled) void item.action();
        return;
      }
      return;
    }

    if (view === "models") {
      const n = filteredModels.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const m = filteredModels[selectedIndex];
        if (m) pickModel(m);
        return;
      }
      return;
    }

    if (view === "scoped-models") {
      const n = filteredScoped.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      // Typing in filter: leave Space/letters/⌘A to the input
      if (inField) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void scopedApply();
        }
        return;
      }
      if (e.key === " " && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const m = filteredScoped[selectedIndex];
        if (m) scopedToggle(modelFullId(m));
        return;
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void scopedApply();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const m = filteredScoped[selectedIndex];
        if (m) scopedToggle(modelFullId(m));
        return;
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        scopedSelectAll();
        return;
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault();
        scopedClearAll();
        return;
      }
      return;
    }

    if (view === "resume") {
      const n = resumeSessions.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const s = resumeSessions[selectedIndex];
        if (s) run(() => onResume?.(s));
        return;
      }
      return;
    }

    if (view === "export") {
      const n = filteredExport.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const o = filteredExport[selectedIndex];
        if (o) void exportSession(o.id);
        return;
      }
      return;
    }

    if (view === "thinking") {
      const n = filteredThinking.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const level = filteredThinking[selectedIndex];
        if (level) pickThinking(level);
        return;
      }
      return;
    }

    if (view === "skills") {
      const n = filteredSkills.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sk = filteredSkills[selectedIndex];
        if (sk) void pickSkill(sk);
        return;
      }
      return;
    }

    if (view === "extensions") {
      const n = filteredExtensions.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      // Inspect-only list — Enter just closes
      if (e.key === "Enter") {
        e.preventDefault();
        onClose();
        return;
      }
      return;
    }

    if (view === "tree") {
      const n = filteredTree.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const row = filteredTree[selectedIndex];
        if (row) pickTreeNode(row.node);
        return;
      }
      return;
    }

    if (view === "fork") {
      const n = filteredFork.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (n) selectedIndex = Math.min(selectedIndex + 1, n - 1);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollSelectedIntoView();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const c = filteredFork[selectedIndex];
        if (c) void pickFork(c);
        return;
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, flatItems.length - 1);
      scrollSelectedIntoView();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollSelectedIntoView();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item && !item.disabled) {
        void item.action();
      }
      return;
    }
  }

  function scrollSelectedIntoView() {
    requestAnimationFrame(() => {
      const el = listRef?.querySelector(`[data-index="${selectedIndex}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Keyboard toggle is handled by the parent (App.svelte) so it works
  // even when the palette is not mounted.
</script>

<svelte:window onkeydown={onKeydown} />

<input
  bind:this={fileInputRef}
  type="file"
  accept=".jsonl,application/x-ndjson,application/jsonl,text/plain"
  class="hidden"
  onchange={(e) => void onFilePicked(e)}
/>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-[2px]"
    onclick={onBackdropClick}
  >
    <div
      class="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      role="dialog"
      aria-modal="true"
    >
      {#if view === "rename"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Tag class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={renameRef}
            type="text"
            bind:value={renameDraft}
            placeholder="Session name"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div class="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
            onclick={backToCommands}
          >
            Back
          </button>
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-40"
            disabled={!renameDraft.trim()}
            onclick={submitRename}
          >
            Rename
          </button>
        </div>
        <div class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Enter to save · Esc to go back
        </div>
      {:else if view === "open-by-id"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Terminal class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={openByIdRef}
            type="text"
            bind:value={openByIdDraft}
            placeholder="Session file or session ID"
            class="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            disabled={openByIdBusy}
          />
        </div>
        {#if openByIdError}
          <div class="px-4 py-2 text-xs text-destructive">{openByIdError}</div>
        {/if}
        <div class="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
            onclick={backToCommands}
            disabled={openByIdBusy}
          >
            Back
          </button>
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-40"
            disabled={!openByIdDraft.trim() || openByIdBusy}
            onclick={() => void submitOpenById()}
          >
            {openByIdBusy ? "Opening" : "Resume"}
          </button>
        </div>
        <div class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Same as <span class="font-mono">pi --session &lt;path|id&gt;</span> ·
          <span class="font-medium">Copy pi --session</span> · Enter · Esc
        </div>
      {:else if view === "info"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Info class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-medium">Session</span>
        </div>
        <div class="max-h-[50vh] space-y-2 overflow-y-auto px-4 py-3">
          {#each infoRows as row}
            <div class="grid grid-cols-[5.5rem_1fr] gap-2 text-sm">
              <span class="text-muted-foreground">{row.label}</span>
              <span class="min-w-0 break-all font-mono text-xs">{row.value}</span>
            </div>
          {/each}
          {#if continueCmd}
            <div class="grid grid-cols-[5.5rem_1fr] gap-2 text-sm">
              <span class="text-muted-foreground">Session</span>
              <div class="flex min-w-0 items-start gap-1">
                <span class="min-w-0 flex-1 break-all font-mono text-xs">{continueCmd}</span>
                <button
                  type="button"
                  class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  title={continueCopied ? "Copied" : "Copy command"}
                  onclick={copyContinueCmd}
                >
                  {#if continueCopied}
                    <Check class="size-3.5" />
                  {:else}
                    <Copy class="size-3.5" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
        <div class="flex items-center justify-end border-t border-border px-4 py-3">
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground"
            onclick={backToCommands}
          >
            Done
          </button>
        </div>
        <div class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Enter or Esc to go back
        </div>
      {:else if view === "hotkeys"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Keyboard class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-medium">Keyboard shortcuts</span>
        </div>
        <div class="max-h-[50vh] space-y-2 overflow-y-auto px-4 py-3">
          {#each HOTKEYS as row}
            <div class="grid grid-cols-[8.5rem_1fr] gap-2 text-sm">
              <kbd class="font-mono text-xs text-muted-foreground">{row.keys}</kbd>
              <span>{row.desc}</span>
            </div>
          {/each}
        </div>
        <div class="flex items-center justify-end border-t border-border px-4 py-3">
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground"
            onclick={backToCommands}
          >
            Done
          </button>
        </div>
        <div class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Enter or Esc to go back
        </div>
      {:else if view === "changelog"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <ScrollText class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-medium">
            Changelog{changelogVersion ? ` · v${changelogVersion}` : ""}
          </span>
        </div>
        <div class="max-h-[50vh] overflow-y-auto px-4 py-3">
          {#if changelogLoading}
            <div class="py-6 text-center text-sm text-muted-foreground">Loading</div>
          {:else if changelogError}
            <div class="py-6 text-center text-sm text-destructive">{changelogError}</div>
          {:else}
            <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-popover-foreground">{changelogText}</pre>
          {/if}
        </div>
        <div class="flex items-center justify-end border-t border-border px-4 py-3">
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground"
            onclick={backToCommands}
          >
            Done
          </button>
        </div>
        <div class="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Enter or Esc to go back
        </div>
      {:else if view === "thinking"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Brain class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search thinking levels"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if thinkingLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading levels
            </div>
          {:else if thinkingError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {thinkingError}
            </div>
          {:else if filteredThinking.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No thinking levels for this model
            </div>
          {:else}
            {#each filteredThinking as level, i (level)}
              {@const active = i === selectedIndex}
              {@const current =
                (session?.thinkingLevel || session?.thinking) === level}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => pickThinking(level)}
                type="button"
              >
                <Brain class="size-4 shrink-0 opacity-70" />
                <span class="flex-1 truncate">{level}</span>
                {#if current}
                  <Check class="size-4 shrink-0 opacity-80" />
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Enter to select · Esc back</span>
          <span>{filteredThinking.length} level{filteredThinking.length === 1 ? "" : "s"}</span>
        </div>
      {:else if view === "skills"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search skills"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if skillsLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading skills
            </div>
          {:else if skillsError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {skillsError}
            </div>
          {:else if filteredSkills.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No skills loaded for this session
            </div>
          {:else}
            {#each filteredSkills as sk, i (sk.name)}
              {@const active = i === selectedIndex}
              {@const parent = skillParent(sk)}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors {active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => void pickSkill(sk)}
                type="button"
                title={skillLine(sk)}
              >
                <span class="min-w-0 flex-1 truncate">
                  {#if parent}
                    <span class="text-muted-foreground">{parent}</span>
                    <span class="text-muted-foreground"> › </span>
                  {/if}
                  <span class="font-medium">{sk.name}</span>
                  {#if sk.description}
                    <span class="text-muted-foreground">
                      — {sk.description.replace(/\s+/g, " ").trim()}</span
                    >
                  {/if}
                </span>
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Enter to run · Esc back</span>
          <span>{filteredSkills.length} skill{filteredSkills.length === 1 ? "" : "s"}</span>
        </div>
      {:else if view === "extensions"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Blocks class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search extensions"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if extensionsLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading extensions
            </div>
          {:else if extensionsError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {extensionsError}
            </div>
          {:else if filteredExtensions.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No extensions loaded for this session
            </div>
          {:else}
            {#each filteredExtensions as ext, i (`${ext.path}-${i}`)}
              {@const active = i === selectedIndex}
              {@const parent = extParent(ext)}
              {@const name = extName(ext)}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors {active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => onClose()}
                type="button"
                title={extLine(ext)}
              >
                <span class="min-w-0 flex-1 truncate">
                  {#if parent}
                    <span class="text-muted-foreground">{parent}</span>
                    <span class="text-muted-foreground"> › </span>
                  {/if}
                  <span class="font-medium">{name}</span>
                  {#if ext.commands.length || ext.tools.length}
                    <span class="text-muted-foreground">
                      — {[
                        ext.commands.length
                          ? `${ext.commands.length} cmd`
                          : "",
                        ext.tools.length ? `${ext.tools.length} tool` : "",
                      ]
                        .filter(Boolean)
                        .join(", ")}</span
                    >
                  {/if}
                </span>
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Esc back</span>
          <span
            >{filteredExtensions.length} extension{filteredExtensions.length ===
            1
              ? ""
              : "s"}</span
          >
        </div>
      {:else if view === "tree"}
        <div class="border-b border-border">
          <div class="flex items-center gap-2 px-4 pb-2 pt-3">
            <GitBranch class="size-4 shrink-0 text-muted-foreground" />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold">Session Tree</div>
              <div class="text-[10px] text-muted-foreground">Active branch is highlighted</div>
            </div>
            <button
              type="button"
              class="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={treeShowAll ? "Hide bookkeeping entries" : "Show all session entries"}
              onclick={() => {
                treeShowAll = !treeShowAll;
                selectedIndex = 0;
              }}
            >
              {treeShowAll ? "All entries" : "Relevant"}
            </button>
            <kbd
              class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
            >ESC</kbd>
          </div>
          <div class="flex items-center gap-2 border-t border-border/60 px-4 py-2">
            <Search class="size-3.5 shrink-0 text-muted-foreground" />
            <input
              bind:this={inputRef}
              type="text"
              bind:value={query}
              placeholder="Filter by message, role, label, or ID"
              class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if treeLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading tree
            </div>
          {:else if treeError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {treeError}
            </div>
          {:else if filteredTree.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Empty session tree
            </div>
          {:else}
            {#each filteredTree as row, i (row.node.id)}
              {@const active = i === selectedIndex}
              {@const current = row.node.id === treeLeafId}
              {@const kind = treeKind(row.node)}
              {@const roleTone = kind === "user"
                ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : kind === "assistant"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-transparent text-muted-foreground"}
              {@const preview = (row.node.preview || "—")
                .replace(/\s+/g, " ")
                .trim()}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors {active
                  ? 'border-primary/30 bg-primary/10 text-accent-foreground'
                  : row.onPath
                    ? 'border-transparent bg-accent/35 text-popover-foreground hover:bg-accent/60'
                    : 'border-transparent text-muted-foreground hover:bg-accent/50'}"
                style={row.indent
                  ? `padding-left: ${0.625 + row.indent * 0.75}rem`
                  : undefined}
                onclick={() => pickTreeNode(row.node)}
                type="button"
                title={treeLine(row.node)}
              >
                <span class="w-5 shrink-0 text-center font-mono text-[11px] {row.onPath ? 'text-primary' : 'text-border'}" aria-hidden="true">
                  {current ? "●" : row.indent ? "├─" : row.onPath ? "│" : "○"}
                </span>
                <span class="min-w-0 flex-1 truncate">
                  <span class="rounded border px-1 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide {roleTone}">{kind}</span>
                  {#if row.node.label}
                    <span class="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{row.node.label}</span>
                  {/if}
                  <span class="ml-1 text-[12px] text-muted-foreground">{preview}</span>
                </span>
                {#if row.forks > 0}
                  <span
                    class="shrink-0 font-mono text-[10px] opacity-60"
                    title="{row.forks} branches from here"
                  >
                    ⑂ {row.forks}
                  </span>
                {/if}
                {#if current}
                  <span class="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">current</span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ move · Enter select · Esc back</span>
          <span>{filteredTree.filter((row) => row.onPath).length} active · {filteredTree.length} total</span>
        </div>
      {:else if view === "fork"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <GitFork class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Fork from user message"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if forkLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading messages
            </div>
          {:else if forkError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {forkError}
            </div>
          {:else if filteredFork.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No user messages to fork from
            </div>
          {:else}
            {#each filteredFork as c, i (c.entryId)}
              {@const active = i === selectedIndex}
              {@const preview = (c.text || "—").replace(/\s+/g, " ").trim()}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors {active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => pickFork(c)}
                type="button"
                title={preview}
              >
                <span class="min-w-0 flex-1 truncate">{preview}</span>
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Enter to review fork · Esc back</span>
          <span
            >{filteredFork.length} message{filteredFork.length === 1
              ? ""
              : "s"}</span
          >
        </div>
      {:else if view === "settings"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Settings class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Settings"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if filteredSettings.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No settings match
            </div>
          {:else}
            {#each filteredSettings as item, i (item.id)}
              {@const active = i === selectedIndex}
              {@const Icon = item.icon ?? Settings}
              <button
                data-index={i}
                disabled={item.disabled}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 {active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => {
                  if (!item.disabled) void item.action();
                }}
                type="button"
              >
                <Icon class="size-4 shrink-0 opacity-70" />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{item.label}</span>
                  {#if item.caption}
                    <span class="truncate text-[10px] opacity-60"
                      >{item.caption}</span
                    >
                  {/if}
                </span>
              </button>
            {/each}
          {/if}
        </div>
        <div
          class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
        >
          <span>↑↓ · Enter · Esc back</span>
          <span>{filteredSettings.length}</span>
        </div>
      {:else if view === "scoped-models"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Cpu class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={scopedFilter}
            placeholder="Filter models"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-40"
            disabled={scopedLoading || scopedAllOn}
            onclick={scopedSelectAll}
          >
            Select all
          </button>
          <button
            type="button"
            class="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] hover:bg-muted disabled:opacity-40"
            disabled={scopedLoading || scopedNoneOn}
            onclick={scopedClearAll}
          >
            Clear all
          </button>
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div
          class="border-b border-border px-4 py-1.5 text-[10px] text-muted-foreground"
        >
          Draft · Apply sets session + settings.enabledModels (like pi)
          {#if scopedAllOn}
            · all ({scopedModels.length})
          {:else if scopedNoneOn}
            · none (⌃P uses all until you enable some)
          {:else}
            · {scopedOnCount}/{scopedModels.length}
          {/if}
          {#if scopedDirty}
            · unsaved
          {/if}
        </div>
        {#if scopedError}
          <div class="border-b border-border px-4 py-1.5 text-[11px] text-destructive">
            {scopedError}
          </div>
        {/if}
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if scopedLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading
            </div>
          {:else if filteredScoped.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No models found
            </div>
          {:else}
            {#each filteredScoped as m, i (modelFullId(m))}
              {@const fid = modelFullId(m)}
              {@const active = i === selectedIndex}
              {@const on = scopedChecked(fid)}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => scopedToggle(fid)}
                type="button"
              >
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded border {on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent opacity-60'}"
                  aria-hidden="true"
                >
                  {#if on}
                    <Check class="size-3" />
                  {/if}
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{formatModelLabel(m)}</span>
                  <span class="truncate text-[10px] opacity-60">{fid}</span>
                </span>
              </button>
            {/each}
          {/if}
        </div>
        <div
          class="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
        >
          <span class="min-w-0 truncate"
            >↑↓ · Space toggle · ⌘A all · ⌘⌫ clear · Esc discard</span
          >
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              class="rounded-md border border-border px-2 py-0.5 hover:bg-muted disabled:opacity-40"
              disabled={!scopedDirty || scopedApplying}
              onclick={scopedReset}
            >
              Reset
            </button>
            <button
              type="button"
              class="rounded-md bg-primary px-2 py-0.5 text-primary-foreground hover:opacity-90 disabled:opacity-40"
              disabled={!scopedDirty || scopedApplying || scopedLoading}
              onclick={() => void scopedApply()}
            >
              {scopedApplying ? "Applying" : "Apply"}
            </button>
          </div>
        </div>
      {:else if view === "resume"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileText class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Resume session"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if resumeSessions.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No other sessions
            </div>
          {:else}
            {#each resumeSessions as s, i (s.id)}
              {@const active = i === selectedIndex}
              {@const name =
                s.name ||
                s.sessionName ||
                s.firstMessage?.slice(0, 48) ||
                "Untitled"}
              {@const folder = s.cwd?.split("/").filter(Boolean).at(-1)}
              {@const caption = [
                folder,
                formatModified(s.modified),
                s.running ? "open" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => run(() => onResume?.(s))}
                type="button"
              >
                <FileText class="size-4 shrink-0 opacity-70" />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{name}</span>
                  {#if caption}
                    <span class="truncate text-[10px] opacity-60">{caption}</span>
                  {/if}
                </span>
                <span class="shrink-0 text-[10px] opacity-60"
                  >{s.running ? "Switch" : "Resume"}</span
                >
              </button>
            {/each}
          {/if}
        </div>
        <div
          class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
        >
          <span>↑↓ · Enter · Esc back</span>
          <span>{resumeSessions.length}</span>
        </div>
      {:else if view === "export"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Download class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Export format"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if !session?.id}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Open a session to export
            </div>
          {:else}
            {#each filteredExport as o, i (o.id)}
              {@const active = i === selectedIndex}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => void exportSession(o.id)}
                type="button"
              >
                <Download class="size-4 shrink-0 opacity-70" />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{o.label}</span>
                  <span class="truncate text-[10px] opacity-60">{o.caption}</span>
                </span>
              </button>
            {/each}
          {/if}
        </div>
        <div
          class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground"
        >
          <span>↑↓ · Enter · Esc back</span>
          <span>{filteredExport.length}</span>
        </div>
      {:else if view === "models"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Cpu class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search models"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if modelsLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading models
            </div>
          {:else if modelsError}
            <div class="px-4 py-6 text-center text-sm text-destructive">
              {modelsError}
            </div>
          {:else if filteredModels.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No models found
            </div>
          {:else}
            {#each filteredModels as m, i (`${m.provider}/${m.id}`)}
              {@const active = i === selectedIndex}
              {@const current =
                session?.model?.provider === m.provider &&
                session?.model?.id === m.id}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-popover-foreground'}"
                onclick={() => pickModel(m)}
                type="button"
              >
                <Cpu class="size-4 shrink-0 opacity-70" />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{formatModelLabel(m)}</span>
                  <span class="truncate text-[10px] opacity-60">{m.provider}/{m.id}</span>
                </span>
                {#if current}
                  <Check class="size-4 shrink-0 opacity-80" />
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Enter to select · Esc back</span>
          <span>{filteredModels.length} model{filteredModels.length === 1 ? "" : "s"}</span>
        </div>
      {:else}
        <!-- Search -->
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Type a command or search"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>

        <!-- List -->
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if flatItems.length === 0}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          {:else}
            {#each Array.from(grouped().entries()) as [category, items]}
              <div class="px-3 pb-1 pt-2">
                <div class="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </div>
              </div>
              {#each items as cmd}
                {@const flatIdx = flatItems.findIndex((f) => f.id === cmd.id)}
                {@const Icon = cmd.icon || Terminal}
                {@const active = flatIdx === selectedIndex}
                <button
                  data-index={flatIdx}
                  class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors {active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-popover-foreground'}"
                  onclick={() => {
                    if (!cmd.disabled) void cmd.action();
                  }}
                  type="button"
                >
                  <Icon class="size-4 shrink-0 opacity-70 {cmd.caption ? 'self-start mt-0.5' : ''}" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate">{cmd.label}</span>
                    {#if cmd.caption}
                      <span
                        class="mt-0.5 block truncate text-[11px] {active
                          ? 'text-accent-foreground/70'
                          : 'text-muted-foreground'}"
                      >
                        {cmd.caption}
                      </span>
                    {/if}
                  </span>
                  {#if cmd.shortcut}
                    <kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {cmd.shortcut}
                    </kbd>
                  {/if}
                </button>
              {/each}
            {/each}
          {/if}
        </div>

        <!-- Footer hint -->
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ to navigate · Enter to run</span>
          <span>{flatItems.length} command{flatItems.length === 1 ? "" : "s"}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
