# pi-gui — agent instructions

Localhost web UI for pi. Thin Svelte client + multi-session hub over `@earendil-works/pi-coding-agent`.

## Docs map (read selectively)

| Task | Open |
|------|------|
| **Any code change** | [docs/boundaries.md](./docs/boundaries.md) first |
| Customize plugins / theme / UI / API | [docs/extend/](./docs/extend/index.md) |
| Concrete how-to | [docs/recipes/](./docs/recipes/index.md) |
| Routes / SSE / tree | [docs/reference/](./docs/reference/index.md) |
| System design | [docs/architecture.md](./docs/architecture.md) |
| Install / use | [README.md](./README.md) |
| Full index | [docs/index.md](./docs/index.md) |

Do **not** load every doc for a small UI change.

## Layout

```text
extensions/gui.ts     # pi: /gui (in-process + live attach)
server/               # cli, http, hub, sse-protocol, session-index
web/src/lib/
  api.ts · chat-stream.ts · plugins/ · components/ · kit/
dist/                 # production UI (npm run build)
docs/                 # LLM-oriented extend + boundaries
```

## Run

```bash
npm install && npm install --prefix web
npm run dev:server   # :3847
npm run dev:web      # :5173 proxies /api
# prod: npm run build && npm start
# pi: pi install <path> → /gui
```

Port: `PI_GUI_PORT` (default `3847`).

## Zones (summary)

- **Green:** `web/src/lib/plugins/`, theme, docs, presentation-only chrome
- **Yellow:** `components/*`, new `hub → http → api.ts` routes, kit fork of one component
- **Red:** `hub.js` lifecycle, `sse-protocol.js`, `chat-stream.ts` — bugfix only + tests

Details: [docs/boundaries.md](./docs/boundaries.md).

## Conventions

- Localhost only (`127.0.0.1`). No Express/socket.io.
- Full-width chat column.
- New backend capability: **hub → http → api.ts → UI**.
- Prefer message **plugins** over deep `MessageBubble` edits.
