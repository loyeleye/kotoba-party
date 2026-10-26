# 0005: Whisper on Cloudflare Workers AI for the live game

**Status:** Proposed (Oct 26, 2026), waiting for Ladi's OK. Amends [0004](0004-self-hosted-speech-to-text.md).

## Context

ADR 0004 moved speech to a Whisper server we run, but nobody runs one, so the live game on
Cloudflare had no speech at all: phones hid the mic check and players could only type or tap.
ADR 0004 assumed the Worker couldn't run a speech model itself. Cloudflare's Workers AI can: it
hosts OpenAI's `whisper-large-v3-turbo` and the Worker calls it through a binding, with no server
of our own. Audio would go to Cloudflare, which already runs the game, and still not to Google.

## Decision

On Cloudflare, `STT_URL` is `workers-ai` and the room's Durable Object sends each clip to
`@cf/openai/whisper-large-v3-turbo` through the Worker's `AI` binding (`language: ja`). A URL in
`STT_URL` still means a self-hosted Whisper server, on Node and on Cloudflare, so ADR 0004's setup
keeps working. The phone, the clip format and the API don't change.

## Consequences

- Speech works on the live game with nothing to keep running.
- Clips go to Cloudflare. Its Workers AI data-usage page says customer content isn't used for
  training and isn't stored unless we store it ourselves; we don't. See
  [commercial-blockers.md](../commercial-blockers.md) row 21.
- Cost: about $0.0005 per audio minute after a free daily allowance (around 200 audio minutes a
  day). A 3 s clip is a few hundredths of a cent.
- Round trip after let-go was 1 to 3 s in testing (one 6 s outlier), inside the 8 s limit.
- `wrangler dev` uses the real Workers AI, so local speech testing is billed (cheaply), and it
  needs a Cloudflare login that can create remote preview sessions.
