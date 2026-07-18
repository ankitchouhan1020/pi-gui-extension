import type { SlashCommandInfo } from "$lib/api";

/** Pi `BUILTIN_SLASH_COMMANDS` + how GUI runs them. */
export type BuiltinSlash = SlashCommandInfo & {
  /** false = works on home (no hub session). Default true. */
  needsSession?: boolean;
  /**
   * - `action:*` — App handles (new, compact, copy, quit, clone)
   * - `palette` / `palette:<view>` — open command palette
   * - `na` — not in GUI yet
   */
  go: string;
};

export const BUILTIN_SLASH_COMMANDS: readonly BuiltinSlash[] = [
  { name: "settings", description: "Open settings menu", source: "builtin", needsSession: false, go: "palette:settings" },
  { name: "model", description: "Select model", argumentHint: "<provider/model>", source: "builtin", go: "palette:models" },
  { name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling", source: "builtin", go: "palette:scoped-models" },
  { name: "export", description: "Export session (HTML or JSONL)", source: "builtin", go: "palette:export" },
  { name: "import", description: "Import and resume a session from a JSONL file", source: "builtin", needsSession: false, go: "palette:import" },
  { name: "share", description: "Share session as a secret GitHub gist", source: "builtin", go: "action:share" },
  { name: "copy", description: "Copy last agent message to clipboard", source: "builtin", go: "action:copy" },
  { name: "name", description: "Set session display name", source: "builtin", go: "palette:rename" },
  { name: "session", description: "Show session info and stats", source: "builtin", go: "palette:info" },
  { name: "changelog", description: "Show changelog entries", source: "builtin", needsSession: false, go: "palette:changelog" },
  { name: "hotkeys", description: "Show all keyboard shortcuts", source: "builtin", needsSession: false, go: "palette:hotkeys" },
  { name: "fork", description: "Create a new fork from a previous user message", source: "builtin", go: "palette:fork" },
  { name: "clone", description: "Duplicate the current session at the current position", source: "builtin", go: "action:clone" },
  { name: "tree", description: "Navigate session tree (switch branches)", source: "builtin", go: "palette:tree" },
  { name: "trust", description: "Save project trust decision for future sessions", source: "builtin", go: "palette:trust" },
  { name: "login", description: "Configure provider authentication", argumentHint: "<provider>", source: "builtin", go: "na" },
  { name: "logout", description: "Remove provider authentication", source: "builtin", go: "na" },
  { name: "new", description: "Start a new session", source: "builtin", needsSession: false, go: "action:new" },
  { name: "compact", description: "Manually compact the session context", source: "builtin", go: "action:compact" },
  { name: "resume", description: "Resume a different session", source: "builtin", needsSession: false, go: "palette:resume" },
  { name: "reload", description: "Reload keybindings, extensions, skills, prompts, themes, and context files", source: "builtin", go: "na" },
  { name: "quit", description: "Quit pi-gui", source: "builtin", needsSession: false, go: "action:quit" },
];

export function builtinByName(name: string): BuiltinSlash | undefined {
  return BUILTIN_SLASH_COMMANDS.find((c) => c.name === name);
}
