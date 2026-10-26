# Kotoba Party!

A Jackbox-style party game where 1 to 8 friends learn to **speak** Japanese by laughing at each
other's answers. A shared screen is the stage, phones are the controllers, and the server runs
the show. Design doc: [Kotoba Party! Game Design Document](https://claude.ai/artifact/FpDS7hXjcg4dfPSY9fu1AL).

## Status: Phase 0 (skeleton)

Rooms with 4-letter codes, QR join, WebSocket push plus HTTP commands, reconnect with a 90 s
seat hold, the shared round state machine, a debug stage and headless bot players.

Gate: 8 bots play 100 scripted rounds with no desyncs, and a phone that drops for 30 s rejoins
its seat. Both run in `npm run gate`.

## Run it

Needs Node 22+.

```sh
npm install
npm start                 # builds the pages, serves on http://localhost:3000
```

- Stage (TV or laptop): http://localhost:3000/stage
- Phones: scan the QR on the stage, or open the server's address and type the code.
- Fill the room with bots: `npm run bots -- --code ABCD` (7 bots join the room on the stage).
- Watch bots play on their own: `npm run bots -- --rounds 20`, then open the stage it prints.

Set `PUBLIC_URL` when deploying so the QR code points at the public address.

## Develop

```sh
npm test                  # unit tests, reconnect tests and the 100-round gate (about 30 s)
npm run typecheck
npm run dev               # server restarts on change (rebuild pages with npm run build)
```

## Layout

| Folder | What's in it |
| --- | --- |
| `server/` | Node HTTP + WebSocket server; one in-memory `Room` per game |
| `stage/` | The shared-screen page (Phase 0: debug stage) |
| `controller/` | The phone page |
| `shared/` | Protocol types, the round state machine, views, the client used by pages and bots |
| `content/` | Topic packs, kana data (Phase 0: debug prompts) |
| `docs/` | ADRs, protocol notes, open questions |
| `tools/` | Headless bots, page build |
| `tests/` | Rules, reconnect and gate tests |

Decisions: [ADR 0001](docs/decisions/0001-authoritative-server-thin-clients.md),
[ADR 0002](docs/decisions/0002-websocket-push-http-commands.md). Questions waiting on Ladi:
[docs/open-questions.md](docs/open-questions.md).
