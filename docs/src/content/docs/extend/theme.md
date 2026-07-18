---
title: Themes
description: Customize light and dark themes using the existing token system.
---

## Mechanism

- `initTheme()` in `web/src/main.ts` (from `agentic-ui-kit/theme.svelte.js`)
- FOUC script in `web/index.html`
- Toggle: `ThemeToggle` in `SessionList.svelte`
- Persistence key: **`agentic-ui-kit-theme`**

## Safe edits

- Token / CSS variables used by kit and app (`web/src/app.css`, kit styles)
- Default theme choice at init
- Toggle placement in chrome

## Avoid

- Replacing the theme system with a new library
- Renaming the storage key without a migration (breaks existing users)
- Hard-coding colors only in one bubble (prefer tokens)
