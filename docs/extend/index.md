# Extending pi-gui

Like pi’s extensions/skills/themes: **compose at the edges**. Do not fork the hub to change a bubble.

## Supported paths (prefer in order)

1. **Message plugins** — custom render for a role / custom type → [plugins.md](./plugins.md)
2. **Theme** — light/dark and tokens → [theme.md](./theme.md)
3. **UI chrome** — sidebar, status bar, palette labels, layout → [ui.md](./ui.md)
4. **New API capability** — hub method + route + client → [server-api.md](./server-api.md)

Always re-read [../boundaries.md](../boundaries.md) if unsure.

## Anti-patterns

- Replacing SSE with WebSockets “for simplicity”
- Adding Express / tRPC / socket.io
- Duplicating model/auth config outside pi
- Vendoring a second UI kit beside `web/src/lib/kit`
- Wide refactors of `hub.js` / `chat-stream.ts` for a feature request

## After you change code

```bash
npm test                 # stream + server contracts
npm run check --prefix web   # optional types
npm run build            # dist/ for prod / git install
```
