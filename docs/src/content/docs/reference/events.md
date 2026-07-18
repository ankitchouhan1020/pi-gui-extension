---
title: SSE and client stream
description: Event sequencing, reconnect policy, snapshots, and client message merging.
---

## Endpoint

`GET /api/sessions/:id/events?after=<seq>`

- Server assigns monotonic **seq** per session.
- `connected` payload: `{ type, id, seq, ringStart }` (see `sse-protocol.js`).
- Live frames: slim agent events (`slimSseEvent` in hub/http).

## Resume policy

Implemented in `shouldReplayRing` / client `ChatStream`:

| Situation | Behavior |
|-----------|----------|
| Cold start, gap, or empty UI | No ring replay → client REST snapshot (`GET …/messages`) then drain buffer |
| Hot resume (`after` in ring) | Replay `seq > after`, then live |
| Duplicate / old seq | Client drops |

## Client merge (`chat-stream.ts`)

- Optimistic user ids `c:*` replaced when server user `message_start` arrives
- Streaming assistant updates one slot until stable id
- `toolResult` keyed by `toolCallId`
- `agent_settled` / errors clear turn phase

**Do not** invent “merge last message of same role”.

## Tests that lock this

- `server/sse-protocol.test.js`
- `web/src/lib/chat-stream.test.ts`
- `server/stabilize.test.js`

Change protocol only with these green.
