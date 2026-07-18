# pi-gui-extension

Pi extension for a localhost multi-session web UI over the same coding-agent SDK as the terminal.

## Install

```bash
pi install npm:pi-gui-extension
```

Requires Node.js ≥ 20 and a working pi install (models / auth already set up).

Git and path installs work from the repository because package-root `dist/` is
committed. After changing `web/`, run `npm install --prefix web && npm run build`
before testing the local package with `pi install <path>`.

```bash
pi remove npm:pi-gui-extension
```

## Usage

In any pi session:

```text
/gui                          # live-attach current session + open browser
/gui <sessionId>              # open that session (live if in-process, else from disk)
/gui open <sessionId>         # same
/gui open <sessionId> 4000    # custom port
/gui stop                     # shut down
```

`/gui` ensures the host runs in this process (takes over the port if needed), then opens the browser on the session. Pass a **session id** (or path) to target a specific chat; omit it to use the current TUI session.

How this relates to pi (disk vs live, ownership): [ownership documentation](./docs/src/content/docs/concepts/ownership.md).

Localhost only (`127.0.0.1`). No auth — treat it like the TUI on your machine.

## Features

- **Multi-session** — open, resume, and switch chats; concurrent turns
- **Streaming** — assistant text, tools, and thinking over SSE
- **Steer & abort** — send while the agent works; stop a turn
- **Models & thinking** — picker and levels from the status bar / palette
- **Command palette** (⌘K) — `/new`, `/resume`, `/session`, models, skills, export, …
- **Skill workspace** — browse loaded skills, view or edit Markdown, and create/import project or user skills directly into pi
- **Git Changes** — working-tree status and diffs for the session cwd
- **Images & bash** — paste/drop images; `!command` in the composer
- **Theme** — light / dark

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `PI_GUI_PORT` | `3847` | HTTP port |
| `PI_GUI_SESSION_IDLE_MS` | `86400000` (1 day) | Close hub session when no SSE clients (`0` disables) |

Models, auth, skills, and extensions come from pi — this package does not add a second config system.

## License

[MIT](./LICENSE)

## Documentation

Read the published documentation at
[pi-gui.pages.dev](https://pi-gui.pages.dev/).

The documentation is an Astro Starlight site with canonical content in
`docs/src/content/docs/`.

```bash
npm install --prefix docs
npm run dev:docs       # local docs server
npm run build:docs     # static site in docs/dist/
```

Contributors should start with the [change boundaries](./docs/src/content/docs/contributing/boundaries.md)
and [extension paths](./docs/src/content/docs/extend/index.md).
