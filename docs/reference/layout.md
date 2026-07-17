# Layout

```text
pi-gui/
  extensions/gui.ts       # pi: /gui · /gui stop
  server/
    cli.js                # bin entry
    http.js               # REST + SSE + static dist/
    hub.js                # multi-session AgentSession manager  [red]
    sse-protocol.js       # connected / resume policy           [red]
  web/
    src/
      main.ts             # initTheme, mount
      App.svelte          # shell / routing
      lib/
        api.ts            # fetch helpers
        chat-stream.ts    # seq gate + merge                    [red]
        plugins/registry.ts  # registerPlugin                   [green]
        components/       # app chrome                          [yellow]
        kit/              # vendored agentic-ui-kit             [yellow]
  dist/                   # production UI (npm run build)
  docs/                   # this tree
  AGENTS.md               # always-on agent map
```

`[green]` / `[yellow]` / `[red]` → [../boundaries.md](../boundaries.md).
