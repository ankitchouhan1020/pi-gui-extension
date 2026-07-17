# Boundaries — what you may change

pi lets users extend without forking the harness. pi-gui should feel the same: **stable core, open shell**.

Agents must respect these zones. Prefer the highest zone that works.

## Green — intended customization

Safe defaults. Documented hooks. Low merge pain.

| Area | Path | Notes |
|------|------|--------|
| Message plugins | `web/src/lib/plugins/` | `registerPlugin` / `match` / custom `Message` |
| App chrome components | `web/src/lib/components/*` | Layout, labels, palette entries, sidebar UI |
| Theme / FOUC | `web/index.html`, kit `theme.svelte.ts`, CSS tokens | Storage key `agentic-ui-kit-theme` |
| Client API helpers | `web/src/lib/api.ts` | Add wrappers for **existing** routes carefully |
| pi `/gui` command UX | `extensions/gui.ts` | Args, port messaging — keep spawn contract |
| Docs / README / AGENTS | `docs/`, root md | This tree |

**Rule:** one feature → fewest files; prefer a plugin over editing `MessageBubble` deeply.

## Yellow — change only with a clear need

Works, but couples you to internals. Read architecture + the file fully first. Keep diffs small.

| Area | Path | Risk |
|------|------|------|
| New REST surface | `server/http.js` + hub method + `api.ts` + UI | Must stay localhost; no new frameworks |
| Command palette actions | `CommandPalette.svelte` | Large file; add one command block, don’t restructure |
| Chat chrome / composer | `ChatPanel.svelte` | Streaming UX; easy to break optimistic UI |
| Session list / routing | `SessionList.svelte`, `App.svelte` | Deep links and open/recent semantics |
| Kit components you already use | `web/src/lib/kit/**` (vendored) | Treat as library; fork one component only if needed |
| Build entry | `web/vite.config.ts`, `server/cli.js` | Breaks install/dev if wrong |

**Rule:** if green can do it, don’t go yellow.

## Red — do not modify unless fixing a proven bug

Stability, multi-session correctness, and stream reliability live here. Wrong edits cause silent duplicates, stuck turns, or data loss.

| Area | Path | Why |
|------|------|-----|
| Session hub lifecycle | `server/hub.js` | Path locks, turn queues, activate mutex, failTurn, idle close |
| SSE wire protocol | `server/sse-protocol.js`, SSE branch in `http.js` | seq, ring, snapshot policy |
| Client stream pipeline | `web/src/lib/chat-stream.ts` | seq gate, snapshot barrier, message merge |
| Stream tests | `*.test.js`, `chat-stream.test.ts` | Contract locks; change **with** the code they guard |
| Trust boundary | bind host, CORS assumptions | Localhost only; no auth by design |

**Rule:** red zone bugs → minimal root-cause fix + keep/adjust the existing test. Not “while we’re here” refactors.

## Hard constraints (all zones)

- **Localhost only** (`127.0.0.1`). No public bind, no auth system unless explicitly requested.
- **No Express / socket.io / extra HTTP frameworks.** `node:http` + SSE.
- **Agent power stays in pi SDK** (`AgentSession`). GUI does not reimplement tools/models.
- **Full-width chat** — do not reintroduce a narrow max-width message column.
- **Ship UI as `dist/`** (package root). `npm run build` before prod / git install without dev server.

## Decision cheat sheet

```text
Custom bubble for a message kind?     → green: plugins
New palette command calling existing API? → yellow: CommandPalette only
New backend capability?               → yellow: hub → http → api.ts → UI
"Make streaming more reliable"?       → red: read chat-stream + sse-protocol first
"Add websockets / rewrite hub"?       → stop; out of scope unless user insists
```
