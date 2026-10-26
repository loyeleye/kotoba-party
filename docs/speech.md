# Speech to text

Spoken answers are turned into text by a Whisper server **we run**. A phone records a short clip
while the hold-to-talk button is held (16 kHz mono WAV, at most 6 s, 12 s in Karaoke Duel) and
posts it to the game server, which checks the player's seat and passes the clip on to the Whisper
server. No audio goes to Google, OpenAI or anyone else, and no clip is stored: it lives in memory
for the one request. Why: [ADR 0004](decisions/0004-self-hosted-speech-to-text.md).

Without a Whisper server, phones don't show the hold-to-talk button at all: every spoken step is
typed or tapped on the kana pad, as in quiet mode. There is no browser recogniser fallback.

```
phone ──clip──▶ game server (Node, or the room's Durable Object) ──clip──▶ Whisper server
      ◀─text──                                                    ◀─text──
```

## Run a Whisper server

Any server that takes a multipart `file` upload and answers `{ "text": "…" }` works. Two that do:

**whisper.cpp** (C++, no Python, good on CPU). Build it or use its Docker image, download a model
and start `whisper-server`:

```sh
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build && cmake --build build -j --config Release --target whisper-server
sh ./models/download-ggml-model.sh large-v3-turbo        # 1.5 GB; `small` (466 MB) for weak machines
./build/bin/whisper-server -m models/ggml-large-v3-turbo.bin -l ja --host 127.0.0.1 --port 8080
```

Then `STT_URL=http://127.0.0.1:8080/inference`.

**speaches** (formerly faster-whisper-server; Python, OpenAI-style API, GPU or CPU). Its
endpoint is `/v1/audio/transcriptions`, and it needs the model named in each request:
`STT_URL=http://127.0.0.1:8000/v1/audio/transcriptions` and
`STT_MODEL=deepdml/faster-whisper-large-v3-turbo-ct2` (or another CTranslate2 Whisper model).

Pick a model from **OpenAI's own Whisper weights** (MIT, fine to sell with: see
[commercial-blockers.md](commercial-blockers.md) row 20). `large-v3-turbo` is the best fit for
short Japanese clips; `small` and `base` are much faster and noticeably worse on beginner speech.
Japanese-tuned models (kotoba-whisper and others trained on ReazonSpeech) may do better but have
unclear data terms; check row 20 before switching.

The Whisper server can sit on the same machine as VOICEVOX and the reader service.

## Settings

| Setting | Node | Cloudflare | What it does |
| --- | --- | --- | --- |
| `STT_URL` | environment | `vars` in `wrangler.jsonc` | The transcription endpoint. Unset or empty: no speech, phones type or tap. |
| `STT_MODEL` | environment | `vars` | The `model` field, for servers that host several (speaches). whisper.cpp ignores it. |
| `STT_TOKEN` | environment | `npx wrangler secret put STT_TOKEN` | Sent as `Authorization: Bearer …`, for a Whisper server behind a proxy that checks one. |

On Cloudflare the Whisper server must be reachable from the internet over https, for example
through a Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8080`). whisper.cpp and
speaches don't check tokens themselves, so put the tunnel behind Cloudflare Access or a proxy
that checks `STT_TOKEN`; otherwise anyone who finds the address can use the machine.

## Limits and behaviour

- Only seated players can send clips (the stage and unknown tokens get 401), one clip at a time
  per player (429 while one is in flight), at most 512 KB, WAV only.
- The game server gives the Whisper server 8 s, then tells the phone to try again or type.
- Near-silent clips are dropped on the phone and never sent.
- Whisper fills silence with stock subtitle lines (ご視聴ありがとうございました and similar) and
  noise tags ([音楽]); those are removed, so they count as nothing heard.
- Transcripts often come back in kanji; the reader works out the kana as before
  (`server/src/reading.ts`, or the reader service on Cloudflare).

## Privacy

Players' voices are personal data, and some players may be children. What the game does today:

- Audio is only recorded while the button is held, and the phone's mic is released on let-go.
- Clips go only to our own Whisper server and are not saved by the game. whisper.cpp and speaches
  don't save them either, but check the logging of any proxy in front of them.
- Only the text is kept, like a typed answer, for the length of the game.

Before a public or paid release: say this in a privacy notice, and decide what to do for players
under 13/16 (parental consent rules such as COPPA and GDPR-K), even though no audio is kept.
