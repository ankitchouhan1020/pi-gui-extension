---
title: Message plugins
description: Add custom message rendering without changing the streaming core.
---

Web analogue of custom pi-tui message rendering.

## API

```ts
// web/src/lib/plugins/registry.ts
registerPlugin({
  id: "my-kind",
  priority: 10, // higher wins
  match: (msg) => msg.role === "myRole" || msg.customType === "…",
  Message: MyComponent, // props: { message, text }
});
```

`MessageBubble.svelte` calls `findMessagePlugin(message)` and renders `plugin.Message` when matched.

## Where to put code

| Piece | Location |
|-------|----------|
| `registerPlugin` call | import from app bootstrap or a small `web/src/lib/plugins/*.ts` imported by `main.ts` / `App.svelte` |
| Component | `web/src/lib/plugins/…` or `web/src/lib/components/…` |
| Styling | component-scoped / existing tokens — avoid global rewrites |

## Rules

- Match narrowly (`id` + `match`). Don’t swallow all assistant messages.
- Prefer kit `Message` / `Markdown` primitives over new markdown stacks.
- Don’t mutate hub events to “make plugins work” — adapt in the component.

## See also

- Recipe: [Custom message renderer](/recipes/message-plugin/)
