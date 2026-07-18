---
title: Server API
description: Add a backend capability through the hub, HTTP route, client helper, and UI.
---

Only when the UI needs a capability the hub doesn’t expose.

## Pipeline (always this order)

```text
hub.js method  →  http.js route  →  web/src/lib/api.ts helper  →  component
```

Skip a layer → agents and future UIs diverge.

## Rules

1. **Localhost only** — no auth middleware projects; don’t bind `0.0.0.0` unless user demands it.
2. **REST for commands, SSE for streams** — don’t invent a second event channel.
3. **Hub owns AgentSession** — http.js should call hub, not construct sessions ad hoc.
4. **Keep responses JSON-small** — UI can refetch; don’t dump full SDK objects unless needed.
5. **Errors** — consistent status codes; never leave a turn without `agent_settled` if you started one (see hub `#failTurn`).

## Don’t

- Express / Fastify / socket.io
- Long-lived state outside `SessionHub` for session data
- Touch SSE seq/ring unless the feature is about resume (red zone)

## See also

- [HTTP API reference](/reference/api/)
- [New REST capability recipe](/recipes/new-api/)
