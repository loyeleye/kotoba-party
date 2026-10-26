# Kotoba Party!

A Jackbox-style party game where 1 to 8 friends learn to **speak** Japanese by laughing at each
other's answers. A shared screen is the stage, phones are the controllers, and the server runs
the show. Design doc: [Kotoba Party! Game Design Document](https://claude.ai/artifact/FpDS7hXjcg4dfPSY9fu1AL).

## Status: v1 modes playable (draft content)

Five modes run end to end on the stage and phones, each with bots and full-server tests:

| Mode | Host | What you practise |
| --- | --- | --- |
| Kana Yōkai Raid (かな妖怪レイド) | Fude | Saying and reading kana against a horde of yōkai |
| Oogiri Night (大喜利ナイト) | Pon | Funny answers in Japanese from word tiles, voted by the room |
| Last Train (終電) | Chōchin-san | Spoken survival phrases on a trip across Japan |
| Word Gauntlet (v1.1) | Pon | Fake kanji meanings, translation telephone, shiritori |
| Kotoba Concentration (v1.1) | Fude | Memory pairs you keep by saying the word |

All content is `draft` until a fluent speaker checks it. Decisions and questions for Ladi:
[docs/open-questions.md](docs/open-questions.md).

Phase 0 built the multiplayer skeleton: rooms with 4-letter codes, QR join, WebSocket push plus
HTTP commands, reconnect with a 90 s seat hold, and headless bot players.

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
- Watch bots play on their own: `npm run bots -- --mode oogiri --bots 5`, then open the stage it
  prints (any mode id works; without `--mode` bots play the debug round).

Optional keys, from the environment only (never commit them): `ANTHROPIC_API_KEY` for live host
lines, `VOICEVOX_URL` for host voices, and `GEMINI_API_KEY` / `PIXELLAB_API_KEY` for art
generation (see [docs/graphics.md](docs/graphics.md)). Everything runs without them.

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
| `stage/` | The shared-screen page; one renderer per mode in `stage/src/modes/` |
| `controller/` | The phone page; one screen set per mode in `controller/src/modes/` |
| `shared/` | Protocol types, the room machine, the modes' pure rules (`shared/src/modes/`), Japanese helpers, the client |
| `content/` | Topic packs, kana, Oogiri prompts, Last Train scenarios, host lines (all draft) |
| `docs/` | ADRs, protocol notes, one doc per mode, open questions |
| `tools/` | Headless bots and per-mode bot policies, page build, art generation |
| `tests/` | Rules, reconnect and gate tests, and a full-server bot game per mode |

Decisions: [ADR 0001](docs/decisions/0001-authoritative-server-thin-clients.md),
[ADR 0002](docs/decisions/0002-websocket-push-http-commands.md). Questions waiting on Ladi:
[docs/open-questions.md](docs/open-questions.md).
