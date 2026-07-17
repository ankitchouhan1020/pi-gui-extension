# UI chrome

## Prefer kit first

Import from `agentic-ui-kit/...` (aliased to `web/src/lib/kit`). Kit files that use `$lib/*` resolve to the **kit** root via Vite dual-alias — don’t break that.

Useful: `Message`, `Markdown`, `Reasoning`, `Button`, `ThemeToggle`, scroll areas.

## App components (yellow)

| File | Role | Edit style |
|------|------|------------|
| `App.svelte` | routing, open session | minimal |
| `SessionList.svelte` | open/recent, theme toggle | local UI |
| `ChatPanel.svelte` | messages, composer, SSE wiring | careful — owns stream UX |
| `MessageBubble.svelte` | default bubbles + plugin hook | prefer plugins |
| `CommandPalette.svelte` | ⌘K actions | add one command entry |
| `StatusBar.svelte` / `ModelPicker.svelte` | model / think / tokens | local UI |
| `GitDiffSidebar.svelte` | workspace diffs | feature-local |
| `ToolCallCard.svelte` | tool call/result card | presentation |
| `ComposerPlus.svelte` | composer + menu (images, …) | presentation |
| `FolderPicker.svelte` | cwd browser (`/api/fs`) | local UI |
| `LinkifiedPre.svelte` | path-linkified pre blocks | presentation |

## Conventions

- Full-width chat column (no `max-w-3xl` on the message column)
- Localhost assumptions in copy and folder pickers
- Keep optimistic message keys (`c:*`) behavior if you touch send path

## See also

- [../recipes/palette-command.md](../recipes/palette-command.md)
- [../recipes/tweak-chat-chrome.md](../recipes/tweak-chat-chrome.md)
