# pi-gui-extension

Localhost web UI for [pi](https://pi.dev) — multi-session chat over the same coding-agent SDK as the terminal.

## Install

```bash
pi install npm:pi-gui-extension
```

Requires Node.js ≥ 20 and a working pi install (models / auth already set up).

```bash
pi remove npm:pi-gui-extension
```

## Usage

In any pi session:

```text
/gui                 # start server + open browser (default port 3847)
/gui 4000            # custom port
/gui stop            # shut down
```

Or standalone:

```bash
npx pi-gui-extension
# → http://127.0.0.1:3847
```

Localhost only (`127.0.0.1`). No auth — treat it like the TUI on your machine.

## Features

- **Multi-session** — open, resume, and switch chats; concurrent turns
- **Streaming** — assistant text, tools, and thinking over SSE
- **Steer & abort** — send while the agent works; stop a turn
- **Models & thinking** — picker and levels from the status bar / palette
- **Command palette** (⌘K) — sessions, skills, tree, compact, export, …
- **Git Changes** — working-tree status and diffs for the session cwd
- **Images & bash** — paste/drop images; `!command` in the composer
- **Theme** — light / dark

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `PI_GUI_PORT` | `3847` | HTTP port |
| `PI_GUI_SESSION_IDLE_MS` | `600000` (10 min) | Close hub session when no SSE clients (`0` disables) |

Models, auth, skills, and extensions come from pi — this package does not add a second config system.

## License

[MIT](./LICENSE)

Contributors and agents: see [docs/](./docs/index.md) and [AGENTS.md](./AGENTS.md).
