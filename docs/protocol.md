# Protocol

Types live in `shared/src/protocol.ts`; this is the prose version. See ADR 0002 for why.

## HTTP

| Method & path | Who | Body | Returns |
| --- | --- | --- | --- |
| `POST /api/rooms` | stage | — | `{ code, stageToken, joinUrl }` |
| `GET /api/rooms/:code` | anyone | — | `{ code, phase, players, joinable }` or 404 |
| `POST /api/rooms/:code/watch` | another stage screen | — | `{ code, stageToken, joinUrl, watch: true }`: a watch-only stage token (up to 16 per room; closed screens are forgotten first); 404 `room-not-found`, 409 `too-many-screens` |
| `POST /api/rooms/:code/join` | phone | `{ name, level?, deviceId?, token?, account? }` (`account`: a signed-in phone's session, so the room saves its games; [accounts.md](accounts.md)) | `{ playerId, token, rejoined, speech }` (`speech`: the server can hear spoken answers); 409 `room-full`, `game-in-progress`, `name-taken`; 400 `bad-name` |
| `POST /api/rooms/:code/commands` | stage or phone (Bearer token) | `{ id, type, … }` | `{ ok: true, v }` or `{ ok: false, error, v }`; 401 `bad-token` / `seat-released` |
| `GET /api/rooms/:code/qr.svg` | stage | — | QR code for the join URL |
| `GET /api/rooms/:code/phrasebook` | main stage (Bearer stage token) or a phone (Bearer player token) | — | `{ tonight, saved }`: tonight's phrases with who said and missed each, and each seated signed-in player's saved phrases ([accounts.md](accounts.md#on-the-stage)). A phone gets only its own rows and save ([accounts.md](accounts.md#on-the-phone)); 401 `bad-token` |
| `POST /api/rooms/:code/speech` | phone (Bearer token) | 16 kHz mono WAV, ≤ 512 KB | `{ text }` from Whisper (Workers AI or our own server); 401 `bad-token`, 400 `bad-clip`, 429 `busy`, 502 `stt-failed`, 503 `no-speech` ([speech.md](speech.md)) |
| `GET /audio/:id` | stage | — | A host line's voice audio (only when VOICEVOX is set up) |
| `GET /healthz` | ops | — | `{ ok, rooms }` |
| `/api/account/*` | phone | — | Optional sign-in and saved progress: see [accounts.md](accounts.md#api) |

Commands:

- `start { mode, rounds?, packId?, extra? }`: VIP or stage, lobby only. `mode` is one of
  `kana-raid`, `oogiri`, `last-train`, `word-gauntlet`, `concentration` (or the hidden `debug`
  round). Each mode validates its own `extra`. `mode: 'surprise'` (Surprise Me!) rolls a random
  menu game that fits the room's player count, with its default length, any topic and no extras,
  and sets the view's `surprise` to the ids it rolled between (cleared back in the lobby) so the
  stage and phones can play the reveal.
- `play { move }`: a move in the current game. The mode validates the move's shape. Any
  utterance (`{ via: 'speech' | 'typed' | 'tap', text }`) inside the move gets a server-side
  `reading` (kana) and `tokens` (word split) before the mode sees it.
- `setLevel { level }`: `kana`, `n5` or `n4`, lobby only.
- `micCheck { utterance }`: the lobby's "say こんにちは" check.
- `skip { phaseSeq }`: VIP or stage, timed phases.
- `playAgain`: VIP or stage, recap.
- `endGame`: VIP or stage, mid-game (the stage's settings panel or the VIP's phone, after a
  confirm). Drops the game and goes back to the lobby in the same room; players stay seated and
  every score goes back to what it was when that game started.

Each player also carries `total`: party points across the night. A finished game adds them by
place (1st 5, 2nd 3, 3rd 2, anyone else who scored 1; ties share a place; a team game gives
everyone 2), and the recap's standings carry each player's `earned` and new `total`. A game ended
early adds nothing.
- `settings { remoteControl?, audience? }`: main stage only (its settings panel). `remoteControl: true` lets
  watching stages send `start`, `skip`, `playAgain` and `endGame` too; `audience` is `kids`, `family` (the
  default) or `cheeky`, and picks the lyric sets Karaoke Duel sings. Every view carries both.
- `closeRoom`: main stage only (its settings panel, after a confirm). Ends the room for everyone
  with `bye room-ended`; never allowed from a watching stage, even with remote control on.

Refusals are short codes (`wrong-phase`, `not-your-turn`, `say-it-first` …); the phone maps them
to wording in `controller/src/main.ts`. `wrong-phase` means the move lost a race with the clock
and is not shown.

A retried command with the same `id` returns the first result without applying it again.

A watching stage (`/stage/?code=XXXX`, for friends playing from somewhere else) gets the same view
as the main stage and plays its own music and host voice, but every command it sends is refused
with `watch-only` unless the main stage has turned on remote control (`settings`), which lets it
start, skip and replay. The VIP's phone (or the main stage) runs the game.

## WebSocket

`GET /ws?code=XXXX&token=…`. Server → client only:

- `{ type: 'state', v, now, view }`: the whole `RoomView` for this viewer at version `v`. `now`
  is the server clock, for countdowns.
- `{ type: 'bye', reason }`: `replaced` (the same seat connected from another tab),
  `room-closed`, `room-idle` (30 minutes with no joins or commands) or `room-ended` (the main
  stage closed it). The socket then closes with 4404; stages show a goodbye instead of opening a
  new room for the last two.

Close codes: `4401` unknown token, `4404` room gone, `4410` seat released after 90 s.

## Phases

The room owns `lobby → (game) → recap → lobby`. Inside the game the mode picks the order from
`intro, prompt, answer, reveal, encore, score, penalty, finale` (see `shared/src/modes/mode.ts`
and each mode's doc in `docs/modes/`). Every phase but lobby and recap has a server deadline,
and a mode can end a phase early when everyone is in. The view's `game` field holds the mode's
own view (`shared/src/modes/views.ts`), which can differ per phone.

The hidden debug mode keeps the Phase 0 round: `intro → prompt → answer → reveal → encore →
score`, repeated, used by the 100-round gate.

## Seats

Up to 8 seats, numbered from 1. The first player in is the VIP; if the VIP's seat is released,
the lowest seat becomes VIP. A seat is held for 90 s after its last socket closes (or after
joining, until the first socket opens). New players can join in the lobby or on the recap screen;
held seats can come back at any time.
