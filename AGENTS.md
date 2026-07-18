# pi-gui — agent instructions

Localhost web UI for pi. Thin Svelte client + multi-session hub over `@earendil-works/pi-coding-agent`.

Repository guidance for contributors and coding agents. The published npm package contains only the extension runtime and prebuilt UI.

## Docs map (read selectively)

| Task | Open |
|------|------|
| **Any code change** | [change boundaries](./docs/src/content/docs/contributing/boundaries.md) first |
| How pi-gui relates to pi / `/gui` | [ownership](./docs/src/content/docs/concepts/ownership.md) |
| Customize plugins / theme / UI / API | [extension paths](./docs/src/content/docs/extend/index.md) |
| Concrete how-to | [recipes](./docs/src/content/docs/recipes/index.md) |
| Routes / SSE / tree | [reference](./docs/src/content/docs/reference/) |
| System design | [architecture](./docs/src/content/docs/concepts/architecture.md) |
| Install / use | [README.md](./README.md) |
| Documentation home | [docs site source](./docs/src/content/docs/index.mdx) |

Do **not** load every doc for a small UI change.

## Layout

```text
extensions/gui.ts     # pi: /gui (in-process + live attach)
server/               # cli, http, hub, sse-protocol
web/src/lib/
  api.ts · chat-stream.ts · plugins/ · components/ · kit/
dist/                 # production UI (npm run build)
docs/                 # Astro Starlight site; content in src/content/docs/
```

UI source is `web/`; `dist/` is build output (what the server ships).

## Run

```bash
npm install && npm install --prefix web
npm run dev:server   # :3847
npm run dev:web      # :5173 proxies /api
# package UI: npm run build
# test extension: pi install <path> → /gui
```

Port: `PI_GUI_PORT` (default `3847`).

## Zones (summary)

- **Green:** `web/src/lib/plugins/`, theme, docs, presentation-only chrome
- **Yellow:** `components/*`, new `hub → http → api.ts` routes, kit fork of one component
- **Red:** `hub.js` lifecycle, `sse-protocol.js`, `chat-stream.ts` — bugfix only + tests

Details: [change boundaries](./docs/src/content/docs/contributing/boundaries.md).

## Conventions

- Localhost only (`127.0.0.1`). No Express/socket.io.
- Full-width chat column.
- New backend capability: **hub → http → api.ts → UI**.
- Prefer message **plugins** over deep `MessageBubble` edits.
