# Layout

```text
pi-gui/
  extensions/gui.ts         # pi: /gui · /gui stop (in-process + live attach)
  server/
    cli.js                  # bin: pi-gui / pi-gui-extension
    http.js                 # REST + SSE + static dist/
    hub.js                  # multi-session AgentSession manager  [red]
    sse-protocol.js         # connected / resume policy           [red]
    session-index.js        # AgentSession id index (standalone path)
  web/
    src/
      main.ts               # initTheme, mount
      App.svelte            # shell / routing
      lib/
        api.ts              # fetch helpers
        chat-stream.ts      # seq gate + merge                    [red]
        plugins/registry.ts # registerPlugin                     [green]
        components/         # app chrome                         [yellow]
          ChatPanel · SessionList · CommandPalette · MessageBubble
          StatusBar · ModelPicker · GitDiffSidebar · ToolCallCard
          ComposerPlus · FolderPicker · LinkifiedPre
        kit/                # vendored agentic-ui-kit            [yellow]
  dist/                     # production UI (npm run build)
  scripts/                  # e.g. validate-gui-rpc.mjs
  docs/                     # this tree
  AGENTS.md                 # always-on agent map
```

`[green]` / `[yellow]` / `[red]` → [../boundaries.md](../boundaries.md).
