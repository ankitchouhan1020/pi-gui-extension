---
title: UI chrome
description: Safely customize application chrome while preserving streaming behavior.
---

## Prefer kit first

Import app-facing primitives from `agentic-ui-kit/...` (aliased to
`web/src/lib/kit`). Inside the vendored kit, use relative imports for kit-local
utilities and theme state; `$lib/*` points to the app's `web/src/lib` root.

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

- [Command palette action](/recipes/palette-command/)
- [Chat chrome and composer UX](/recipes/tweak-chat-chrome/)
