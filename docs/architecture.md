# Architecture

Localhost web UI over pi’s coding-agent SDK. Thin client + multi-session hub; no Express/socket.io.

## System context

```mermaid
flowchart LR
  User((User))
  Browser[Browser<br/>Vite :5173 or static dist]
  GUI[pi-gui server<br/>node:http :3847]
  SDK["@earendil-works/pi-coding-agent<br/>AgentSession"]
  Disk[(Session JSONL<br/>~/.pi/agent/sessions/)]
  LLM[Model providers<br/>via pi registry/extensions]
  PiCLI[pi CLI<br/>/gui extension]

  User --> Browser
  Browser -->|REST + SSE /api/*| GUI
  PiCLI -->|in-process listen + attach live| GUI
  GUI --> SDK
  SDK --> Disk
  SDK --> LLM
```

## Component view

```mermaid
flowchart TB
  subgraph Web["web/ — Svelte 5"]
    App[App.svelte<br/>list · route · open]
    SL[SessionList]
    CP[ChatPanel<br/>messages · prompt · SSE]
    SB[StatusBar / ModelPicker]
    CMD[CommandPalette]
    API[api.ts]
    Kit[lib/kit — agentic-ui-kit]
    Plug[plugins/registry]
    App --> SL & CP & CMD
    CP --> SB & Kit & Plug
    App & CP & CMD --> API
  end

  subgraph Server["server/"]
    CLI[cli.js]
    HTTP[http.js<br/>REST + SSE]
    Hub[hub.js<br/>SessionHub]
    ExtGui[extensions/gui.ts<br/>/gui attach]
    CLI --> HTTP --> Hub
    ExtGui --> HTTP
    ExtGui --> Hub
  end

  subgraph SDK_layer["pi SDK"]
    AS[AgentSession × N]
    SM[SessionManager]
    Ext[Extensions / providers]
  end

  API -->|proxy /api| HTTP
  Hub --> AS
  Hub --> SM
  AS --> Ext
```

## One turn

```mermaid
sequenceDiagram
  participant UI as ChatPanel
  participant API as api.ts
  participant H as http.js
  participant Hub as SessionHub
  participant S as AgentSession

  UI->>API: POST /sessions/:id/prompt
  API->>H: 202 fire-and-forget
  H->>Hub: ensure(id) · prompt()
  Note over Hub: path lock · per-session turn<br/>short activate mutex only
  Hub->>S: prompt / steer
  S-->>Hub: message_* · agent_* · tools
  Hub-->>UI: SSE /events (slimSseEvent)
  Note over Hub,UI: on failure: error + agent_settled
  UI->>API: GET messages / session<br/>(catch-up · turnWatch)
```

## SessionHub

| Concern | Approach |
|---------|----------|
| Identity | Prefer **hub id** after open; `ensure` reopens by disk id/path |
| Multi-session | Many open; **per-session** turn queues; activate mutex only for `session_start` |
| Live TUI attach | `/gui` indexes `AgentSession` (extension patch) → `hub.attach` / `detach` |
| Transport | REST for commands; **SSE** for stream; no WebSocket |
| Client truth | `ChatStream`: seq gate + snapshot barrier + id merge |
| SSE resume | Cold/gap → REST snapshot; hot → ring `seq > after` + live |
| Idle | `PI_GUI_SESSION_IDLE_MS` closes sessions with no SSE clients (`0` = off) |
| Process entry | `pi-gui` / `cli.js` (standalone), or pi **`/gui`** (in-process + live attach) |

## Chat stream pipeline (contract)

```mermaid
sequenceDiagram
  participant UI as ChatStream
  participant ES as EventSource
  participant H as http SSE
  participant REST as GET messages

  UI->>ES: open ?after=lastSeq
  ES->>H: GET /events
  H-->>ES: connected{seq, ringStart}
  alt cold OR gap OR empty UI
    ES-->>UI: connected → need_snapshot
    UI->>REST: GET /messages
    UI->>UI: commitSnapshot(seq) · drain buffer
  else resume
    ES-->>UI: missed frames then live
  end
  H-->>ES: message_* id: N
  ES-->>UI: merge by id/toolCallId
  H-->>ES: agent_settled
```

**Merge rules:** optimistic user → replaced on server `message_start`; assistant slot while streaming; `toolResult` by `toolCallId`. Never “last same role”.

## Deploy shapes

```text
dev:   Vite :5173  ──proxy /api──►  node server :3847
prod:  same process serves dist/ + API on PI_GUI_PORT (default 3847)
pi:    pi install <pi-gui>  →  /gui opens browser against hub
```

## Trust boundary

```text
127.0.0.1 only · no auth · CORS * OK on localhost
UI is a dumb shell; agent power lives in the SDK process
```

## Related

- [boundaries.md](./boundaries.md) — edit zones
- [reference/api.md](./reference/api.md) — routes
- [reference/events.md](./reference/events.md) — SSE / client merge
