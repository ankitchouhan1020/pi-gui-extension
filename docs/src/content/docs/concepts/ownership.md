---
title: How pi-gui relates to pi
description: Understand agent ownership, live sessions, disk sessions, and the /gui command.
---

Plain-language model of ownership and live sessions. For diagrams and wire
details, see [Architecture](/concepts/architecture/).

## One sentence

**pi owns the agent; pi-gui is a localhost multi-session web UI + hub that drives the same `AgentSession` (and session files) the TUI uses.**

## Picture

```text
                 pi core (SDK)
          AgentSession · tools · models
          session JSONL on disk
                    ▲
         ┌──────────┴──────────┐
         │                     │
    pi TUI                  pi-gui
  (terminal)            (browser + hub)
         │                     │
         └──── same package / same files ────┘
```

- **pi** — coding agent runtime (LLM, tools, skills, extensions, disk sessions)
- **pi-gui** — another frontend; does **not** reimplement the agent
- **`/gui`** — pi extension that starts (or takes over) the web host **in the TUI process** and **attaches** the current live session

## Two layers of “session”

| Layer | Shared across processes? | Role |
|-------|--------------------------|------|
| **Disk** (`~/.pi/agent/sessions/…`) | Yes | History list, resume, durable SOT |
| **Live `AgentSession`** | No — one process | Streaming turns, tools, active writer |

**Hard rule:** one live writer per session file. Opening the same path as two live agents = dual-write bugs.

## How the browser talks to pi

```text
Browser (Svelte)
    │  REST (prompt, model, tree, …)
    │  SSE  (tokens, tools, settle)
    ▼
pi-gui server (node:http)
    │  SessionHub — many open sessions
    ▼
AgentSession × N  (in this process)
```

`/gui` starts the hub inside Pi, attaches the TUI’s existing live session
(`bound: true`), and can create or resume additional sessions in that same process.

## `/gui` behavior

| Command | What happens |
|---------|----------------|
| `/gui` | Ensure host **here** (take over port if busy) → live-attach **current** session → open browser |
| `/gui <sessionId>` | Same host, then open that session: live-attach if in-process, else `hub.ensure` from disk |
| `/gui open <sessionId>` | Same as above |
| `/gui` again on another live session | Multi-bind that session; both stay in the hub |
| `/gui stop` | Stop the host |

Session id is the pi / hub id (UUID-like). Path to a `.jsonl` file also works via `ensure`.

## What shows up in the sidebar

| Source | Meaning |
|--------|---------|
| **Sessions** (sidebar) | Hub-running, or activity within 24h (unless demoted) |
| **`tui` badge / `bound`** | Live-attached from pi TUI (`/gui`) — close detaches only |
| **Recent** | Past sessions (same idea as `/resume`) |

A TUI that never ran `/gui` only appears via **disk** (if flushed) — not as live until attached or opened here.

## What we deliberately skip

- Cross-process “share this JS `AgentSession` object”
- Per-session RPC child processes (`PI_GUI_RPC` removed — cost without day-to-day value)
- Multi-user / public bind / auth (localhost only)

## Decision cheat sheet

```text
Multi chat in the browser?     → open / resume in hub
Live TUI chat in the browser?  → /gui
Resume by session ID?          → ⌘K → "pi --session" (path or id)
Port already in use?           → /gui takes it over, then opens
Past sessions?                 → ⌘K → "Resume session" or sidebar Recent
```

## Code map

| Piece | Path |
|-------|------|
| `/gui` attach, multi-bind, port takeover | `extensions/gui.ts` |
| Multi-session map, prompt, SSE fanout | `server/hub.js` |
| REST + static `dist/` | `server/http.js` |
| Browser API + stream merge | `web/src/lib/api.ts`, `chat-stream.ts` |

## Next

- [Install and use pi-gui](/getting-started/install/)
- [Explore the architecture](/concepts/architecture/)
