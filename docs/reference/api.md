# HTTP API

Base: `http://127.0.0.1:$PI_GUI_PORT` (default `3847`). Dev Vite proxies `/api`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | liveness |
| GET | `/api/sessions` | list open + disk |
| POST | `/api/sessions` | open / create |
| GET | `/api/sessions/:id` | detail + stats |
| PATCH | `/api/sessions/:id` | rename |
| GET | `/api/sessions/:id/messages` | history snapshot |
| POST | `/api/sessions/:id/prompt` | send user turn |
| POST | `/api/sessions/:id/steer` | interrupt while streaming |
| POST | `/api/sessions/:id/abort` | stop |
| POST | `/api/sessions/:id/model` | set / cycle model |
| POST | `/api/sessions/:id/thinking` | set / cycle thinking |
| POST | `/api/sessions/:id/compact` | compact |
| GET/POST | `/api/sessions/:id/tree` | session tree / navigate |
| GET | `/api/sessions/:id/skills` | list skills |
| GET | `/api/sessions/:id/extensions` | list extensions |
| GET | `/api/sessions/:id/events` | **SSE** stream |
| GET | `/api/models` | models (needs warmed session) |

Static UI: non-`/api` paths from package-root `dist/`.

Client wrappers: `web/src/lib/api.ts`.
