# 0004: Speech to text on our own Whisper server

**Status:** Accepted (Oct 26, 2026)

## Context

Spoken answers used the browser's recogniser (Web Speech API). In Chrome that sends the
player's audio to Google's servers, and it is missing in Firefox and some in-app browsers.
Ladi said no to audio going to Google (open question 21). The design doc already planned
server-side speech to text for Phase 3. It has to work with both the Node server and the
Cloudflare Worker, which can't run a speech model itself.

## Options considered

1. **A self-hosted Whisper server** (whisper.cpp or faster-whisper/speaches), called by URL like
   VOICEVOX and the reader service. Audio stays on machines we run. MIT-licensed weights.
2. **A cloud speech API** (Google Cloud, Azure, OpenAI). Easy and accurate, but the audio goes to
   another company, which is what Ladi ruled out, and it costs per minute.
3. **Whisper in the browser** (WebAssembly or WebGPU). No server, but a 75 MB+ download per phone,
   slow on cheap phones, and the small models are poor at beginner Japanese.
4. **Keep the browser recogniser as a fallback.** Rejected: it is the thing we are removing.

## Decision

Option 1. Phones record a 16 kHz mono WAV clip themselves (no codec needed on the Whisper side)
and post it to `POST /api/rooms/:code/speech`. The game server, or the room's Durable Object on
Cloudflare, checks the seat token and forwards the clip to `STT_URL`. Without `STT_URL`, phones
don't offer speech at all and players type or tap. Setup: [docs/speech.md](../speech.md).

## Consequences

- No player audio leaves machines we run, and no clip is stored.
- An always-on machine is needed for speech (the same one as VOICEVOX and the reader works).
  Without it the game still plays, typed.
- Speech has a round trip after let-go (about 0.5 to 2 s on a CPU with `large-v3-turbo`) instead of
  live words while talking. The phone shows "…" meanwhile.
- Karaoke Duel's pitch tracker reads the same recording, so the old "can't listen for words and
  pitch at once" fallback is gone.
- Live words while holding the button are gone; streaming could come back later over the
  WebSocket if it matters.
