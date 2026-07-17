# Recipe: new REST capability

## Read

- `docs/boundaries.md`
- `docs/extend/server-api.md`
- `docs/reference/api.md`
- Existing similar method in `server/hub.js` + route in `server/http.js` + helper in `web/src/lib/api.ts`

## Edit (all four if UI needs it)

1. `hub.js` — method on the hub, session-scoped, no new global locks unless required
2. `http.js` — route → hub; JSON in/out
3. `api.ts` — typed-ish helper
4. Component or palette — call site

## Don’t touch

- SSE seq / ring / `chat-stream.ts` unless the feature is streaming-related (then stop and re-scope)
- Session open/close path locks “for convenience”

## Done when

- `curl` or UI proves the route
- `npm test` still passes
- No new HTTP framework
