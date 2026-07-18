---
title: Repository layout
description: Locate the extension, server, Svelte client, generated UI, and documentation site.
---

```text
pi-gui/
  extensions/gui.ts         # pi: /gui · /gui stop (in-process + live attach)
  server/
    cli.js                  # repository-only local development harness
    http.js                 # REST + SSE + static dist/
    hub.js                  # multi-session AgentSession manager  [red]
    sse-protocol.js         # connected / resume policy           [red]
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
          ChatComposer · StatusBar · ModelPicker · GitDiffSidebar
          SkillWorkspaceDialog · ToolCallCard · TreeNavigateDialog
        kit/                # vendored agentic-ui-kit            [yellow]
  dist/                     # production UI (npm run build)
  docs/                     # Astro Starlight documentation site
    src/content/docs/       # canonical documentation content
  AGENTS.md                 # always-on agent map
```

`[green]` / `[yellow]` / `[red]` → [Change boundaries](/contributing/boundaries/).
