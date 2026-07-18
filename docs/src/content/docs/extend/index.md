---
title: Extension paths
description: Choose the safest extension point for plugins, themes, UI changes, or API capabilities.
---

Like pi’s extensions/skills/themes: **compose at the edges**. Do not fork the hub to change a bubble.

## Supported paths (prefer in order)

1. **Message plugins** — custom render for a role or custom type → [Message plugins](/extend/plugins/)
2. **Theme** — light/dark and tokens → [Themes](/extend/theme/)
3. **UI chrome** — sidebar, status bar, palette labels, layout → [UI chrome](/extend/ui/)
4. **New API capability** — hub method + route + client → [Server API](/extend/server-api/)

Always re-read [Change boundaries](/contributing/boundaries/) if unsure.

## Local customization contract

Keep customization local and outside the installed `pi-gui` package so package
updates cannot overwrite it. This is intentionally **not** a public plugin or
package ecosystem.

Planned locations, applied in this order:

1. Built-in pi-gui defaults
2. `~/.pi/agent/pi-gui/` — personal defaults for every project
3. `.pi/pi-gui/` — project overrides, loaded only after Pi trusts the project

### Implementation scope

These are the required behaviors for the first pass:

- Versioned `config.json` with defaults and schema validation.
- Merge order: defaults → global → project.
- Project config only loads after the existing Pi trust decision allows it.
- Validated appearance tokens only: sidebar widths, density, accent color, radius.
- `motion.intensity`, but `prefers-reduced-motion` always wins.
- Local sound files, bounded volume, mute controls, and rate limiting.
- Asset serving only from the resolved customization directory.
- Non-blocking validation warnings, with safe fallback to defaults.
- Reload support so local edits do not require reinstalling the extension.
- Tests for trust gating and update-safe global customization.
- Documentation for the local customization and local-fork workflows.

### Current building blocks

These pieces already exist and should be reused rather than replaced:

- Theme toggle and storage key: `web/src/lib/kit/theme.svelte.ts`
- Reduced-motion and sound gating: `web/src/lib/feedback.ts`
- Sound toggle UI: `web/src/lib/components/SoundToggle.svelte`
- Existing sidebar width persistence: `web/src/lib/components/SessionList.svelte`
- Existing git sidebar width persistence: `web/src/lib/components/GitDiffSidebar.svelte`

### Example shape

The final schema may evolve, but the expected direction is:

```json
{
  "version": 1,
  "appearance": {
    "sidebarWidth": 320,
    "rightSidebarWidth": 360,
    "density": "comfortable"
  },
  "motion": {
    "intensity": "subtle"
  },
  "sound": {
    "enabled": true,
    "volume": 0.2,
    "turnComplete": "./sounds/complete.ogg"
  },
  "theme": {
    "accent": "#7c6cff",
    "radius": "10px"
  }
}
```

### Deferred / out of scope

- Arbitrary browser JavaScript or runtime-loaded Svelte components
- Runtime compilation when `/gui` starts
- Public plugin manifests, compatibility ranges, or publishing tools
- Pi core or package-manager changes
- Remote customization assets

Code-level customization remains a local-fork workflow: clone the repository,
build `dist/`, and install the clone with `pi install <local-path>`. Updating
that fork is an explicit merge rather than an automatic package replacement.

## Anti-patterns

- Replacing SSE with WebSockets “for simplicity”
- Adding Express / tRPC / socket.io
- Duplicating model/auth config outside pi
- Vendoring a second UI kit beside `web/src/lib/kit`
- Wide refactors of `hub.js` / `chat-stream.ts` for a feature request

## After you change code

```bash
npm test                 # stream + server contracts
npm run check            # Svelte and TypeScript checks
npm run build            # dist/ for prod / git install
```
