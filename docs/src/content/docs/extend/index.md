---
title: Extension paths
description: Choose the safest extension point for plugins, themes, UI changes, or API capabilities.
---

Like pi’s extensions/skills/themes: **compose at the edges**. Do not fork the hub to change a bubble.

## Supported paths (prefer in order)

1. **Message plugins** — custom render for a role or custom type → [Message plugins](/extend/plugins/)
2. **Theme** — light/dark and tokens → [Themes](/extend/theme/)
3. **UI chrome** — sidebar, status bar, palette labels, layout → [UI chrome](/extend/ui/)
4. **New API capability** — hub method + route + client → [Server API](/extend/server-api/)

Always re-read [Change boundaries](/contributing/boundaries/) if unsure.

## Anti-patterns

- Replacing SSE with WebSockets “for simplicity”
- Adding Express / tRPC / socket.io
- Duplicating model/auth config outside pi
- Vendoring a second UI kit beside `web/src/lib/kit`
- Wide refactors of `hub.js` / `chat-stream.ts` for a feature request

## After you change code

```bash
npm test                 # stream + server contracts
npm run check            # Svelte and TypeScript checks
npm run build            # dist/ for prod / git install
```
