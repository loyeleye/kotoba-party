# 0001: Authoritative server, thin clients

**Status:** Accepted (Oct 26, 2026)

## Context

Kotoba Party is played on one shared screen (the stage) and up to 8 phones. Phones sleep, lose
signal and get reloaded mid-round. Scores, timers and votes have to agree everywhere, and one
player's flaky phone must never break the round for everyone else (pillar: "One room, one truth").

## Options considered

1. **Authoritative server, thin clients.** The server owns phase, timer, answers, votes and
   scores. Clients send intents and render whatever the server last said.
2. **Stage as host.** The stage browser tab runs the game and relays to phones (peer-to-peer or
   through a relay). Cheap to host, but the game dies if the TV tab sleeps or reloads, and the
   stage would be trusted with hidden answers.
3. **Shared state with client-side prediction.** Clients apply their own actions locally and
   reconcile. Makes sense for twitch games, not for a turn-based party game at 8 players.

## Decision

Option 1. Each room is one in-memory `GameState` on the server (`server/src/room.ts`), changed
only through `Room.dispatch`, which runs synchronously. Node runs one callback at a time, so the
room has exactly one writer: two votes in the same millisecond are applied one after the other,
each exactly once. The rules themselves are a pure state machine in `shared/src/game.ts` (no
sockets, no clocks), which takes the current time as an argument.

Phase timers live on the server. A timer only fires a `timeout` for the phase it was set for
(`phaseSeq`), so a stale timer can never skip a phase. Clients show a countdown from the
server's deadline, corrected by the server clock sent with each state.

## Consequences

- A phone that drops, sleeps or cheats cannot change anyone else's view. A reconnect is just
  "send me the latest state".
- Every rule is testable without a network (`tests/game.test.ts`), and the whole system is
  testable with headless bots (`tests/gate.test.ts`).
- Rooms live in one process's memory. A crash loses the current game (acceptable for a 15-minute
  party game); phrasebooks and profiles will live in a database (Phase 5).
- Any slow work (LLM, TTS, speech-to-text) must happen outside `dispatch` and come back as an
  action, so the room never waits on it.

## Revisit when

- One process cannot hold the rooms we need. Rooms are a natural shard key, so routing by room
  code to several processes comes first.
- We add a mode with real-time movement where server round trips feel laggy.
