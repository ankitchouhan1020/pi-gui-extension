---
title: Install and use
description: Install pi-gui as a Pi extension and open sessions in the browser.
---

## Requirements

- Node.js 20 or newer
- A working pi installation with model authentication already configured

## Install from npm

```bash
pi install npm:pi-gui-extension
```

In any pi session, run:

```text
/gui
```

The command starts the local host in the pi process, attaches the current live
session, and opens the browser.

## Commands

| Command | Result |
| --- | --- |
| `/gui` | Attach the current live session and open it |
| `/gui <sessionId>` | Open a specific session, live when available or from disk |
| `/gui open <sessionId>` | Same explicit form as above |
| `/gui open <sessionId> 4000` | Use a custom port |
| `/gui stop` | Stop the local host |

A path to a session `.jsonl` file can be used in place of a session ID.

## Local repository install

Package-root `dist/` is committed, so a Git or path install works without a
local frontend build. If you changed `web/`, rebuild before testing:

```bash
npm install --prefix web
npm run build
pi install <path-to-pi-gui>
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PI_GUI_PORT` | `3847` | HTTP port |
| `PI_GUI_SESSION_IDLE_MS` | `86400000` | Close a hub session after one day without SSE clients; `0` disables cleanup |

The server binds only to `127.0.0.1` and has no authentication. Treat it like
the pi terminal on your machine.

## Remove

```bash
pi remove npm:pi-gui-extension
```
