# HTTP API

Base: `http://127.0.0.1:$PI_GUI_PORT` (default `3847`). Dev Vite proxies `/api`.

Source of truth: `server/http.js`. Client wrappers: `web/src/lib/api.ts`.

## Global

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | liveness (`ok`, open count, cwd) |
| POST | `/api/shutdown` | close host (standalone exits; in-process stays alive) |
| GET | `/api/changelog` | pi package CHANGELOG (Cmd+K) |
| GET | `/api/models?sessionId=` | models (optional warmed session) |
| GET | `/api/fs?path=` | list subdirs (folder picker) |
| GET | `/api/sessions?cwd=` | open + disk sessions |
| POST | `/api/sessions` | open/create (`path?`, `cwd?`, `fresh?`, `content?`, `filename?`) |

## Session

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sessions/:id` | detail + stats |
| PATCH | `/api/sessions/:id` | rename (`{ name }`) |
| DELETE | `/api/sessions/:id` | close hub session |
| GET | `/api/sessions/:id/messages` | history snapshot |
| POST | `/api/sessions/:id/prompt` | send turn (`{ message, images? }`) → **202** |
| POST | `/api/sessions/:id/steer` | interrupt while streaming → **202** |
| POST | `/api/sessions/:id/follow-up` | queue after current turn |
| POST | `/api/sessions/:id/abort` | stop agent turn |
| POST | `/api/sessions/:id/bash` | `!command` (`{ command, excludeFromContext? }`) → **202** |
| POST | `/api/sessions/:id/abort-bash` | stop bash |
| POST | `/api/sessions/:id/model` | set / cycle model |
| GET/POST | `/api/sessions/:id/thinking` | get / set / cycle thinking |
| POST | `/api/sessions/:id/compact` | compact (`{ instructions? }`) |
| GET/POST | `/api/sessions/:id/tree` | tree / navigate (`{ targetId, summarize?, … }`) |
| GET/POST | `/api/sessions/:id/fork` | candidates / fork (`{ entryId, position? }`) |
| GET/POST | `/api/sessions/:id/tools` | list / set active tools |
| GET | `/api/sessions/:id/skills` | skills |
| GET | `/api/sessions/:id/extensions` | loaded extensions |
| GET | `/api/sessions/:id/git` | working-tree status; `?path=` → file diff |
| GET | `/api/sessions/:id/events` | **SSE** stream (`?after=` / `Last-Event-ID`) |

Static UI: non-`/api` paths from package-root `dist/`.
