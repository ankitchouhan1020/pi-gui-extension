---
title: Chat chrome and composer UX
description: Change presentation safely without disturbing stream and send behavior.
sidebar:
  order: 4
---

## Read

- `docs/src/content/docs/contributing/boundaries.md`
- `docs/src/content/docs/extend/ui.md`
- Relevant section of `ChatPanel.svelte` only (composer, header, empty state)
- Kit components you will reuse

## Edit

- Presentation: classes, copy, spacing, button placement
- Prefer kit `Button` / input patterns already used in-file

## Don’t touch

- SSE subscription / `ChatStream` wiring
- Optimistic send / steer / abort protocol
- Message list merge logic

## Done when

- Visual/UX change works in dev (`npm run dev:web` + `dev:server`)
- Sending a message and streaming still settle (`agent_settled` → idle)
