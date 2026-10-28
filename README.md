# Kotoba Party!

A Jackbox-style party game where 1 to 8 friends learn to **speak** Japanese by laughing at each
other's answers. A shared screen is the stage, phones are the controllers, and the server runs
the show. Design doc: [Kotoba Party! Game Design Document](https://claude.ai/artifact/FpDS7hXjcg4dfPSY9fu1AL).

## Status: all modes playable (draft content)

Eleven modes run end to end on the stage and phones, each with bots and full-server tests:

| Mode | Host | What you practise |
| --- | --- | --- |
| Kana Yōkai Raid (かな妖怪レイド) | Fude | Saying and reading kana against a horde of yōkai |
| Oogiri Night (大喜利ナイト) | Pon | Funny answers in Japanese from word tiles, voted by the room |
| Last Train (終電) | Chōchin-san | Spoken survival phrases on a trip across Japan |
| Word Gauntlet (v1.1) | Pon | Fake kanji meanings, translation telephone, shiritori |
| Kotoba Concentration (v1.1) | Fude | Memory pairs you keep by saying the word |
| Murder at the Onsen (backlog) | Chōchin-san | Asking suspects questions, then naming the culprit |
| Phrase Bingo Theater (backlog) | Pon | Slipping secret phrases into an improv scene |
| Karaoke Duel (backlog) | Nobiko-san | Singing original beginner songs, scored on words, pitch and timing |
| Who's the Tourist? (backlog) | Chōchin-san | Asking and answering questions to find who doesn't know the place |
| Oekaki (backlog) | Fude | Drawing a word, then writing fake Japanese titles |
| Omiai Matchmaker (backlog) | Nobiko-san | Polite Japanese (です/ます, keigo) on a parody matchmaking show |
| Shodō Taikai (backlog) | Fude | Handwriting: tracing and writing kana and kanji with stroke order, said aloud first |

All content is `draft` until a fluent speaker checks it. Decisions and questions for Ladi:
[docs/open-questions.md](docs/open-questions.md).
Anything that would stop the game being sold is logged in
[docs/commercial-blockers.md](docs/commercial-blockers.md).

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
- Fill seats with bots: `npm run bots -- --code ABCD --bots 3`; they play whatever game the VIP picks.
- Watch bots play on their own: `npm run bots -- --mode oogiri --bots 5`, then open the stage it
  prints (any mode id works; without `--mode` bots play the debug round).

Optional keys, from the environment only (never commit them): `ANTHROPIC_API_KEY` (or `KOTOBA_ANTHROPIC_API_KEY`, which
wins when both are set and works in Claude Code cloud sessions) for live host
lines, `VOICEVOX_URL` for host voices, `STT_URL` for spoken answers (a Whisper server, see
[docs/speech.md](docs/speech.md); without it players type), and `GEMINI_API_KEY` / `PIXELLAB_API_KEY` for art
generation (see [docs/graphics.md](docs/graphics.md)). Everything runs without them.

Set `PUBLIC_URL` when deploying so the QR code points at the public address.

### On Cloudflare (always on)

```sh
npm run cf:deploy         # needs a Cloudflare account; see docs/cloudflare.md
```

Same game, hosted as a Worker with one Durable Object per room. Settings, the optional reader
service for kanji answers, and custom domains: [docs/cloudflare.md](docs/cloudflare.md).

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
| `cloudflare/` | The same server as a Cloudflare Worker, one Durable Object per room |
| `stage/` | The shared-screen page; one renderer per mode in `stage/src/modes/`, music in `stage/src/music/` ([docs/music.md](docs/music.md)) |
| `controller/` | The phone page; one screen set per mode in `controller/src/modes/` |
| `shared/` | Protocol types, the room machine, the modes' pure rules (`shared/src/modes/`), Japanese helpers, the client |
| `content/` | Topic packs, kana, Oogiri prompts, Last Train scenarios, host lines (all draft) |
| `docs/` | ADRs, protocol notes, one doc per mode, open questions |
| `tools/` | Headless bots and per-mode bot policies, page build, art generation |
| `tests/` | Rules, reconnect and gate tests, and a full-server bot game per mode |

Decisions: [ADR 0001](docs/decisions/0001-authoritative-server-thin-clients.md),
[ADR 0002](docs/decisions/0002-websocket-push-http-commands.md),
[ADR 0003](docs/decisions/0003-cloudflare-workers-durable-objects.md). Questions waiting on Ladi:
[docs/open-questions.md](docs/open-questions.md).
