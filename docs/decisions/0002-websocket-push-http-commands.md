# 0002: WebSocket push, HTTP commands

**Status:** Accepted (Oct 26, 2026)

## Context

Phones on party Wi-Fi or mobile data drop connections often. We need state to reach every
client quickly, commands to be safe to retry, and reconnecting to be boring.

## Options considered

1. **Everything over one WebSocket** (state out, commands in). One connection, but a command sent
   while the socket is half-dead is lost or ambiguous, and every command needs its own ack and
   retry protocol.
2. **WebSocket push, HTTP commands.** State goes out over a WebSocket per client; actions go in
   as HTTP POSTs with a session token and a client-made command id.
3. **HTTP polling only.** Simplest, but laggy reveals and wasteful at a 250 ms poll.
4. **Server-sent events + HTTP.** Close to option 2; WebSocket ping/pong gives us faster
   dead-phone detection and the `ws` library is well trodden.

## Decision

Option 2.

- **Push:** `GET /ws?code=…&token=…`. On connect, and after every change, the server sends
  `{ type: 'state', v, now, view }` with the **whole** room view for that viewer (small at 8
  players). `v` is the room's version and only goes up; clients drop any message with `v` at or
  below the one they hold. Clients never send anything on the socket.
- **Commands:** `POST /api/rooms/:code/commands` with `Authorization: Bearer <token>` and
  `{ id, type, … }`. The server remembers the result for each command id per seat, so a retried
  request (same id) returns the first result and is never applied twice.
- **Reconnect:** a dropped phone keeps its seat for 90 s. It reconnects with the same token (or,
  after a reload, finds its seat with the saved token or its anonymous device id), and the
  server sends the latest state. There is no replay log to catch up on.
- **Liveness:** the server pings every 10 s and drops sockets that miss a pong, which starts the
  90 s seat hold.

## Consequences

- Reconnect logic is a few lines on each side, and the gate test shows it holds up under
  duplicates, drops and simultaneous votes.
- Sending full state costs a little bandwidth; at 8 players a view is a few KB.
- Two transports to keep in mind: a client may see a command's HTTP response before or after
  the state push that reflects it. Clients render from the push only.

## Revisit when

- Views grow large (drawings, audio metadata): send diffs keyed by version, keeping full state
  on connect.
- We need audience mode with hundreds of viewers: one shared stage-view broadcast is already
  cached per viewer kind, but fan-out would move to a pub/sub layer.
