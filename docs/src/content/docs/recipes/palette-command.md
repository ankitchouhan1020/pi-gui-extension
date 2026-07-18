---
title: Command palette action
description: Add a focused command to the existing command palette.
sidebar:
  order: 3
---

## Read

- `docs/src/content/docs/contributing/boundaries.md`
- `web/src/lib/components/CommandPalette.svelte` — how existing commands register and call `api.ts`
- `web/src/lib/api.ts` — only if you need a new client helper

## Edit

1. Add one command descriptor (label, keywords, run handler) next to similar commands.
2. Call an **existing** API helper if possible.
3. Close or keep palette consistent with sibling commands (see nearby handlers).

## Don’t touch

- Palette open/close infrastructure unless broken
- Hub/SSE
- Unrelated command blocks (no drive-by cleanup)

## Done when

- ⌘K finds the command; action works on a live session
- No new dependencies

## Related

- **pi --session** / **Resume session** — match pi `/resume` and `pi --session <path|id>`. Pair with **Copy pi --session**.
