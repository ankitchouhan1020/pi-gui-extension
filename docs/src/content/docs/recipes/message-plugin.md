---
title: Custom message renderer
description: Add a narrowly matched Svelte renderer through the message plugin registry.
sidebar:
  order: 2
---

## Read

- `docs/src/content/docs/contributing/boundaries.md`
- `docs/src/content/docs/extend/plugins.md`
- `web/src/lib/plugins/registry.ts`
- `web/src/lib/components/MessageBubble.svelte` (plugin branch only)

## Edit

1. Add a Svelte component that accepts `{ message, text }`.
2. `registerPlugin({ id, match, Message, priority? })` from a module imported at app startup.
3. Keep `match` narrow.

## Don’t touch

- `server/hub.js`, `chat-stream.ts`, SSE routes
- Default paths in `MessageBubble` for user/assistant unless plugin can’t cover it

## Done when

- Matched messages render via the plugin; others unchanged
- `npm run check` passes without new errors
