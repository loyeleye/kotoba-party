# 0003: Run on Cloudflare with one Durable Object per room

**Status:** Accepted (Oct 26, 2026)

## Context

The Node server (`server/`) keeps every room in memory in one process, so it is only up while
the machine running it is up. Ladi wants an always-on public link without running a server.
The game needs an authoritative writer per room (ADR 0001) and WebSocket push plus HTTP
commands (ADR 0002). Both must keep working on the Node server, which stays the way to play on
a LAN and the target of the tests.

## Options considered

1. **Cloudflare Workers + one Durable Object per room.** A Durable Object is a single instance
   per id, anywhere in the world, that can hold WebSockets. The room code names the object, so
   every request for a room reaches the one copy of its state. Free plan friendly.
2. **A container or VM running the Node server as is** (Cloudflare Containers, Fly.io, a VPS).
   No port, but one always-on machine to pay for and patch, and rooms die with it.
3. **Workers + a shared store (KV or D1) for room state.** Every command would read, change
   and write the whole room, with races between phones; timers would need a separate scheduler.

## Decision

Option 1, with the room logic shared, not ported:

- `cloudflare/roomObject.ts` holds the same `Room` class the Node server uses
  (`server/src/room.ts`), with the same game rules (`shared/`), content, host director and Ink
  Storm coach. The object is the room's only writer, as in ADR 0001.
- `cloudflare/worker.ts` serves the same HTTP and WebSocket API as `server/src/server.ts`: it
  picks room codes (the code's object answers 409 if taken), forwards each route to the room's
  object, and serves the built stage and phone pages from Workers Static Assets (one deploy,
  same origin, so no CORS), mapping paths the way `serveStatic` does.
- WebSockets are accepted by the object with the standard (non-hibernating) API. While anyone is
  connected the object stays in memory, and the room's timers run on plain `setTimeout`, exactly
  as on Node. The Room's state is not saved to storage.
- Host lines use Claude from the object when `ANTHROPIC_API_KEY` is set as a Worker secret.
  VOICEVOX stays a separate server named by `VOICEVOX_URL`; without it lines show as subtitles.
  Host audio is kept per room, so its URL is `/api/rooms/:code/audio/:id` there.
- The kuromoji dictionary needs about 290 MB once loaded and a Worker has 128 MB, so readings
  for kanji answers come from a small reader service (`npm run reader`) named by `READER_URL`.
  The Worker adds them before forwarding a command. Without it, answers are compared as written.

## Consequences

- One codebase, two hosts. Rule changes and new modes need nothing Cloudflare-specific; only a
  change to `Room`'s constructor options or the HTTP routes needs a matching change in
  `cloudflare/`.
- A deploy restarts every object, which ends every open game. Deploy between parties.
- If every socket in a room drops at once (the TV and every phone), Cloudflare may evict the
  object before the 90 s seat hold or the 10 minute idle close runs out, and the room is lost.
  The stage normally stays connected, so this should be rare.
- The Workers WebSocket API has no ping frames, so a phone that vanishes without closing is
  noticed when the connection times out at the edge, not after two missed 10 s pings. Its seat
  hold starts later, and early phase ends wait for it a little longer.
- Bank lines' audio is not pre-rendered (the Node server's `warmUp`), because each room would
  repeat it against VOICEVOX. Fallback bank lines are subtitles only on Cloudflare.
- No global room cap; Cloudflare's own limits and the per-game LLM budget bound the cost.

## Revisit when

- Rooms get lost to eviction in real play: save a snapshot of the Room (state, tokens, seat
  holds) to the object's storage on each commit and use the WebSocket Hibernation API, with an
  alarm per phase deadline.
- Dead phones linger too long: add a client heartbeat message, answered automatically with
  `setWebSocketAutoResponse`.
