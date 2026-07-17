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
  import Power from "@lucide/svelte/icons/power";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Blocks from "@lucide/svelte/icons/blocks";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import {
    downloadText,
    formatModelLabel,
    getChangelog,
    getMessages,
    getSessionThinking,
    getTree,
    chatPrompt,
    listModels,
    listSkills,
    listExtensions,
    messageText,
    navigateTree,
    shutdown,
    type ModelInfo,
    type SessionRow,
    type SkillInfo,
    type ExtensionInfo,
    type TreeNode,
  } from "$lib/api";

  export type Command = {
    id: string;
    label: string;
    category: string;
    icon?: typeof Search;
    shortcut?: string;
    disabled?: boolean;
    /** Extra text for search (not shown). */
    keywords?: string;
    action: () => void | Promise<void>;
  };

  type View =
    | "commands"
    | "rename"
    | "info"
    | "models"
    | "thinking"
    | "skills"
    | "extensions"
    | "tree"
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
    { keys: "Esc", desc: "Close palette / stop generation" },
    { keys: "↑ ↓", desc: "Navigate list" },
    { keys: "Enter", desc: "Run selected command" },
    { keys: "Alt+Enter", desc: "Send message (chat input)" },
    { keys: "⇧Tab", desc: "Cycle thinking level (pi)" },
    { keys: "⌃P", desc: "Cycle model forward (pi)" },
    { keys: "⇧⌃P", desc: "Cycle model backward (pi)" },
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
    onCycleModel?: (dir: "forward" | "backward") => void;
    onSetModel?: (provider: string, id: string) => void | Promise<void>;
    onCycleThinking?: () => void;
    onSetThinking?: (level: string) => void | Promise<void>;
    onAbort?: () => void;
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
    onCycleModel,
    onSetModel,
    onCycleThinking,
    onSetThinking,
    onAbort,
  }: Props = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement | undefined = $state();
  let renameRef: HTMLInputElement | undefined = $state();
  let fileInputRef: HTMLInputElement | undefined = $state();
  let listRef: HTMLDivElement | undefined = $state();
  /** Inline sub-views inside the same modal (no window.alert/prompt). */
  let view = $state<View>("commands");
  let renameDraft = $state("");
  let models = $state<ModelInfo[]>([]);
  let modelsLoading = $state(false);
  let modelsError = $state("");
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

  function openThinking() {
    query = "";
    selectedIndex = 0;
    view = "thinking";
    void loadThinking();
    requestAnimationFrame(() => inputRef?.focus());
  }

  function openSkills() {
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

  function openHotkeys() {
    view = "hotkeys";
  }

  function openChangelog() {
    view = "changelog";
    void loadChangelog();
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
        (r) => !isTreeNoise(r.node) || r.node.id === treeLeafId,
      );
      if (treeLeafId) {
        const idx = flat.findIndex((r) => r.node.id === treeLeafId);
        if (idx >= 0) selectedIndex = idx;
      }
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
      await chatPrompt(`/skill:${sk.name}`);
      onClose();
    } catch {
      /* keep palette open so user can retry */
    }
  }

  async function pickTreeNode(node: TreeNode) {
    if (!session?.id || !node.id) return;
    try {
      await navigateTree(session.id, node.id);
      onClose();
    } catch {
      /* keep palette open so user can retry */
    }
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
pre{white-space:pre-wrap;word-break:break-word;background:#f4f4f5;padding:1rem;border-radius:8px}
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
      if (!q && isTreeNoise(n) && n.id !== treeLeafId) return false;
      if (!q) return true;
      const hay =
        `${n.preview} ${n.type} ${n.role ?? ""} ${n.label ?? ""} ${n.id}`.toLowerCase();
      return hay.includes(q);
    });
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

    cmds.push({
      id: "new",
      label: "New session",
      category: "Session",
      icon: Plus,
      action: () => run(onNew),
    });

    cmds.push({
      id: "import",
      label: "Import session…",
      category: "Session",
      icon: FolderOpen,
      action: openImport,
    });

    if (session?.id) {
      cmds.push({
        id: "rename",
        label: "Rename session",
        category: "Session",
        icon: Tag,
        action: openRename,
      });

      cmds.push({
        id: "compact",
        label: "Compact context",
        category: "Session",
        icon: Minimize2,
        action: () => run(onCompact),
      });

      cmds.push({
        id: "copy-last",
        label: "Copy last message",
        category: "Session",
        icon: Copy,
        action: () => run(onCopyLast),
      });

      if (continueCmd) {
        cmds.push({
          id: "copy-terminal-session",
          label: "Copy terminal session",
          category: "Session",
          icon: Terminal,
          keywords: "pi --session continue reconnect clipboard",
          action: () => run(() => void copyContinueCmd()),
        });
      }

      cmds.push({
        id: "session-info",
        label: "Session info",
        category: "Session",
        icon: Info,
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
        label: "Select model…",
        category: "Model",
        icon: Cpu,
        action: openModels,
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
        label: "Select thinking level…",
        category: "Model",
        icon: Brain,
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
        action: openSkills,
      });

      cmds.push({
        id: "extensions",
        label: "Extensions",
        category: "Agent",
        icon: Blocks,
        action: openExtensions,
      });

      cmds.push({
        id: "tree",
        label: "Tree",
        category: "Session",
        icon: GitBranch,
        action: openTree,
      });

      cmds.push({
        id: "export-jsonl",
        label: "Export session (JSONL)",
        category: "Session",
        icon: Download,
        action: () => void exportSession("jsonl"),
      });

      cmds.push({
        id: "export-html",
        label: "Export session (HTML)",
        category: "Session",
        icon: Download,
        action: () => void exportSession("html"),
      });

      cmds.push({
        id: "abort",
        label: "Stop generation",
        category: "Agent",
        icon: Square,
        shortcut: "Esc",
        action: () => run(onAbort),
      });
    }

    cmds.push({
      id: "hotkeys",
      label: "Keyboard shortcuts",
      category: "Help",
      icon: Keyboard,
      action: openHotkeys,
    });

    cmds.push({
      id: "changelog",
      label: "Changelog",
      category: "Help",
      icon: ScrollText,
      action: openChangelog,
    });

    cmds.push({
      id: "quit",
      label: "Quit server",
      category: "App",
      icon: Power,
      action: () => void quitServer(),
    });

    // All sessions (open + closed) — searchable; empty query limited in filtered.
    for (const s of sessions) {
      if (s.id === session?.id) continue;
      const name =
        s.name ||
        s.sessionName ||
        s.firstMessage?.slice(0, 40) ||
        "Untitled";
      const folder = s.cwd?.split("/").filter(Boolean).at(-1);
      cmds.push({
        id: `resume-${s.id}`,
        label: s.running
          ? `Switch: ${name}`
          : `Resume: ${name}${folder ? ` · ${folder}` : ""}`,
        category: "Recent",
        keywords: [s.firstMessage, s.cwd, s.path, s.id, s.sessionName, s.name]
          .filter(Boolean)
          .join(" "),
        icon: FileText,
        action: () => run(() => onResume?.(s)),
      });
    }

    return cmds;
  }

  const commands = $derived(buildCommands());

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Don't dump every closed disk session into the idle palette.
      let recent = 0;
      return commands.filter((c) => {
        if (c.category !== "Recent") return true;
        if (recent >= 8) return false;
        recent++;
        return true;
      });
    }
    return commands.filter((c) =>
      (c.label + " " + c.category + " " + (c.keywords ?? ""))
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

  $effect(() => {
    if (open) {
      query = "";
      selectedIndex = 0;
      view = "commands";
      requestAnimationFrame(() => inputRef?.focus());
    }
  });

  $effect(() => {
    query;
    if (
      open &&
      (view === "commands" ||
        view === "models" ||
        view === "thinking" ||
        view === "skills" ||
        view === "extensions" ||
        view === "tree")
    ) {
      selectedIndex = 0;
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (view !== "commands") {
        query = "";
        backToCommands();
        return;
      }
      onClose();
      return;
    }

    if (view === "rename") {
      if (e.key === "Enter") {
        e.preventDefault();
        submitRename();
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
        if (row) void pickTreeNode(row.node);
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
      {:else if view === "info"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Info class="size-4 shrink-0 text-muted-foreground" />
          <span class="text-sm font-medium">Session info</span>
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
            <div class="py-6 text-center text-sm text-muted-foreground">Loading…</div>
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
            placeholder="Search thinking levels…"
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
              Loading levels…
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
            placeholder="Search skills…"
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
              Loading skills…
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
            placeholder="Search extensions…"
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
              Loading extensions…
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
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <GitBranch class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search session tree…"
            class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd
            class="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block"
          >
            ESC
          </kbd>
        </div>
        <div bind:this={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {#if treeLoading}
            <div class="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading tree…
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
              {@const preview = (row.node.preview || "—")
                .replace(/\s+/g, " ")
                .trim()}
              <button
                data-index={i}
                class="mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors {active
                  ? 'bg-accent text-accent-foreground'
                  : row.onPath
                    ? 'hover:bg-accent/50 text-popover-foreground'
                    : 'hover:bg-accent/50 text-muted-foreground'}"
                style={row.indent
                  ? `padding-left: ${0.75 + row.indent * 0.5}rem`
                  : undefined}
                onclick={() => void pickTreeNode(row.node)}
                type="button"
                title={treeLine(row.node)}
              >
                <span
                  class="h-3.5 w-1 shrink-0 rounded-full {row.onPath
                    ? 'bg-primary/70'
                    : 'bg-border'}"
                  aria-hidden="true"
                ></span>
                <span class="min-w-0 flex-1 truncate">
                  <span class="font-medium">{kind}</span>
                  {#if row.node.label}
                    <span class="text-muted-foreground">
                      · {row.node.label}</span
                    >
                  {/if}
                  <span class="text-muted-foreground"> — {preview}</span>
                </span>
                {#if row.forks > 0}
                  <span
                    class="shrink-0 font-mono text-[10px] opacity-60"
                    title="{row.forks} branches from here"
                  >
                    ⑂{row.forks}
                  </span>
                {/if}
                {#if current}
                  <Check class="size-4 shrink-0 opacity-80" />
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ · Enter to jump · Esc back</span>
          <span>{filteredTree.length} entr{filteredTree.length === 1 ? "y" : "ies"}</span>
        </div>
      {:else if view === "models"}
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <Cpu class="size-4 shrink-0 text-muted-foreground" />
          <input
            bind:this={inputRef}
            type="text"
            bind:value={query}
            placeholder="Search models…"
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
              Loading models…
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
            placeholder="Type a command or search…"
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
                  <Icon class="size-4 shrink-0 opacity-70" />
                  <span class="flex-1 truncate">{cmd.label}</span>
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
