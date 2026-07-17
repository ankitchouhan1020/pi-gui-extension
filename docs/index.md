# pi-gui docs (for humans and agents)

pi-gui is a **localhost web shell** over pi’s coding-agent SDK. Same idea as pi itself: stay small at the core, change behavior at the edges.

## How to use these docs

| You want to… | Read first |
|--------------|------------|
| Change anything | [boundaries.md](./boundaries.md) |
| Understand the system | [architecture.md](./architecture.md) |
| Customize UI / plugins / theme / API the supported way | [extend/](./extend/index.md) |
| Look up routes or SSE shapes | [reference/](./reference/index.md) |
| Do one concrete task | [recipes/](./recipes/index.md) |
| Run / install | [../README.md](../README.md) |
| Publish to npm | [release.md](./release.md) |
| Always-on agent map | [../AGENTS.md](../AGENTS.md) |

## Agent read order (default)

1. `AGENTS.md` (already in context when present)
2. `docs/boundaries.md` — **before any edit**
3. Only the **one** extend or recipe page that matches the task
4. `docs/architecture.md` or `reference/*` only if the task touches transport, hub, or streaming

Do **not** load every doc for a theme tweak or message renderer.

## Mental model

```text
Browser (Svelte)  ──REST + SSE──►  server (node:http)  ──►  pi AgentSession
     ↑ thin UI                         ↑ multi-session hub      ↑ real agent
```

Power lives in **pi**. This repo is a hub + a browser. Prefer plugins and thin UI changes over rewriting the hub.
