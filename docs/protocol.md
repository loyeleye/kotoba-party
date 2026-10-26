# Protocol (Phase 0)

Types live in `shared/src/protocol.ts`; this is the prose version. See ADR 0002 for why.

## HTTP

| Method & path | Who | Body | Returns |
| --- | --- | --- | --- |
| `POST /api/rooms` | stage | — | `{ code, stageToken, joinUrl }` |
| `GET /api/rooms/:code` | anyone | — | `{ code, phase, players, joinable }` or 404 |
| `POST /api/rooms/:code/join` | phone | `{ name, deviceId?, token? }` | `{ playerId, token, rejoined }`; 409 `room-full`, `game-in-progress`, `name-taken`; 400 `bad-name` |
| `POST /api/rooms/:code/commands` | stage or phone (Bearer token) | `{ id, type, … }` | `{ ok: true, v }` or `{ ok: false, error, v }`; 401 `bad-token` / `seat-released` |
| `GET /api/rooms/:code/qr.svg` | stage | — | QR code for the join URL |
| `GET /healthz` | ops | — | `{ ok, rooms }` |

Commands: `start { rounds? }` (VIP or stage, lobby only), `answer { text }`, `vote { answerId }`,
`skip { phaseSeq }` (VIP or stage, timed phases), `playAgain` (VIP or stage, recap).

A retried command with the same `id` returns the first result without applying it again.

## WebSocket

`GET /ws?code=XXXX&token=…`. Server → client only:

- `{ type: 'state', v, now, view }`: the whole `RoomView` for this viewer at version `v`. `now`
  is the server clock, for countdowns.
- `{ type: 'bye', reason }`: `replaced` (the same seat connected from another tab),
  `room-closed`.

Close codes: `4401` unknown token, `4404` room gone, `4410` seat released after 90 s.

## Round phases

`lobby → intro → prompt → answer → reveal → encore → score → (prompt … | recap)`, and
`recap → lobby` on play-again. Intro runs once per game. Every phase but lobby and recap has a
server deadline. The answer phase ends early when every connected player has answered; the
reveal (vote) phase ends early when every connected player who can vote has voted. A reveal
with no answers is skipped.

## Seats

Up to 8 seats, numbered from 1. The first player in is the VIP; if the VIP's seat is released,
the lowest seat becomes VIP. A seat is held for 90 s after its last socket closes (or after
joining, until the first socket opens). New players can join only in the lobby; held seats can
come back at any time.
