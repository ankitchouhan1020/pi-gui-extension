# pi-gui

Localhost web UI for [pi](https://pi.dev) — multi-session chat over the same coding-agent SDK as the terminal.

Use it when you want a browser for sessions, streaming, tools, and models without leaving pi’s ecosystem.

**Requirements:** Node.js **≥ 20**, a working **pi** install (models / auth already set up).

---

## Install

```bash
pi install npm:pi-gui
```

Alternatives:

```bash
pi install https://github.com/ankitchouhan1020/pi-gui-extension
pi install /path/to/pi-gui   # local checkout (dist/ committed)
```

```bash
pi remove npm:pi-gui
```

Inside any pi session:

```text
/gui                 # start server + open browser (default port 3847)
/gui 4000            # custom port
/gui stop            # shut down
```

### Standalone

```bash
npx pi-gui
# → http://127.0.0.1:3847
```

```bash
PI_GUI_PORT=4000 npx pi-gui
# or
npx pi-gui --port 4000
```

### Development (hot reload)

```bash
git clone https://github.com/ankitchouhan1020/pi-gui-extension.git
cd pi-gui-extension
npm install && npm install --prefix web

# terminal 1 — API + hub
npm run dev:server     # :3847

# terminal 2 — Vite UI (proxies /api → :3847)
npm run dev:web        # :5173
```

Open **http://127.0.0.1:5173** in dev, or **http://127.0.0.1:3847** after `npm run build` + `npm start`.

> Localhost only (`127.0.0.1`). No auth — treat it like the TUI on your machine.

---

## Features

### Sessions

- **Open & recent** — disk sessions from pi’s session dir, plus currently running ones
- **New session** — pick a working folder and model, then send the first message
- **Rename, close, resume** — sidebar + command palette
- **Import / export** — import JSONL; export session as JSONL or HTML
- **Drafts** — composer text survives accidental refresh (per session)
- **URL routing** — `/sessions/:id` deep links

### Chat

- **Streaming** — assistant text, tools, and thinking over SSE
- **Reliable stream pipeline** — seq-gated events, REST snapshot on reconnect/gap, no duplicate messages after drops
- **Steer & follow-up** — send while the agent is working (Enter = steer, ⌥Enter = follow-up)
- **Abort** — stop the current turn or bash
- **Images** — paste or drop into the composer (multimodal when the model supports it)
- **Bash** — `!command` / `!!command` (exclude from context), streamed output
- **Interleaved thinking** — each reasoning step shows in order with text and tools (not one clubbed block)
- **Tool cards** — calls + results folded together
- **Edit & continue** — rework a user message via session tree navigation

### Models & agent controls

- **Model picker** — all providers registered in pi (including extension providers after warm)
- **Thinking level** — cycle / set from the status bar or palette
- **Compact** — context compaction from the palette
- **Session tree** — `/tree` navigator (branch / jump)
- **Skills** — list and invoke pi skills from the palette
- **Extensions** — inspect loaded extensions

### Workspace UI

- **Command palette** (⌘K / Ctrl+K) — new session, model, thinking, skills, tree, export, abort, hotkeys, changelog, quit server
- **Git Changes sidebar** — working-tree status and GitHub-style diffs for the session cwd
- **Theme** — light / dark (persisted)
- **Status bar** — model, thinking, tokens / cost / context when available
- **Multi-session** — several chats open at once; turns don’t block across sessions

---

## Everyday use

| Action | How |
|--------|-----|
| New chat | Empty home → pick folder + model → type; or palette **New session** |
| Switch session | Sidebar list, or palette resume |
| Stop generation | Stop button, or palette **Abort** |
| Change model | Status bar picker or palette |
| Skills | Palette → Skills → insert `/skill:name` |
| Jump in history | Palette → Session tree |
| Quit server | Palette **Quit**, or `/gui stop` in pi |

---

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `PI_GUI_PORT` | `3847` | HTTP port |
| `PI_GUI_SESSION_IDLE_MS` | `600000` (10 min) | Close hub session when no SSE clients (set `0` to disable) |

Models, auth, skills, and extensions are whatever **pi** already uses (`~/.pi/agent/`, project config, etc.). pi-gui does not invent a second config system.

---

## Project layout

```text
pi-gui/
  extensions/gui.ts     # pi: /gui · /gui stop
  server/               # cli, hub, http (REST+SSE)
  web/                  # Vite + Svelte 5 UI
  dist/                 # production UI after build
  docs/                 # boundaries · extend · recipes · reference
  AGENTS.md             # short agent map → docs/
```

---

## Scripts

```bash
npm run dev:server   # API with --watch
npm run dev:web      # Vite UI
npm run build        # production web → dist/ (served by server)
npm start            # production server
npm test             # server + stream unit tests
npm run check        # svelte-check / tsc (web)
```

---

## Docs (humans + agents)

Designed so you (or an LLM in a checkout) can **iterate at the edges** without forking the hub — same spirit as pi’s extensions model.

| Doc | Purpose |
|-----|---------|
| **[docs/index.md](./docs/index.md)** | Map / read order |
| **[docs/boundaries.md](./docs/boundaries.md)** | Green / yellow / red — what is safe to change |
| **[docs/extend/](./docs/extend/index.md)** | Plugins, theme, UI chrome, server API |
| **[docs/recipes/](./docs/recipes/index.md)** | Task-sized agent recipes |
| **[docs/architecture.md](./docs/architecture.md)** | System design (mermaid) |
| **[AGENTS.md](./AGENTS.md)** | Always-on short agent map |

### Stack

| Layer | Choice |
|-------|--------|
| Server | `node:http` + `@earendil-works/pi-coding-agent` |
| UI | Vite, Svelte 5, Tailwind 4, vendored kit under `web/src/lib/kit` |
| Transport | REST commands + SSE events (no WebSocket / Express) |

---

## License

[MIT](./LICENSE)
