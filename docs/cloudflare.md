# Running Kotoba Party on Cloudflare

The game runs on Cloudflare as one Worker: the stage and phone pages are static assets, and each
room is a Durable Object running the same room code as the Node server. Why and what's different:
[ADR 0003](decisions/0003-cloudflare-workers-durable-objects.md). Everything works on the free
Workers plan.

## Deploy

You need a Cloudflare account and Node 22+.

```sh
npm install
npx wrangler login            # or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
npm run cf:deploy             # builds the pages and deploys the Worker
```

The deploy prints the address, e.g. `https://kotoba-party.<your-subdomain>.workers.dev`. Open
`/stage` there on the TV; phones scan the QR code or open the address and type the code.

An API token needs these permissions: Account › Workers Scripts › Edit (plus Zone › Workers
Routes › Edit and Zone › DNS › Edit if you add a custom domain).

**A deploy ends every game in progress** (each room restarts), so deploy between parties.

### Deploy on every push to main

The live Worker is connected to this repo with Workers Builds (Worker › Settings › Builds): build
command `npm run build`, deploy command `npx wrangler deploy`, production branch `main`. Every merge
to `main` deploys. If merges stop deploying, check that the Cloudflare Workers and Pages GitHub app
can see this repo (GitHub › Settings › Applications › Cloudflare Workers and Pages › Repository
access). Without that access the dashboard still looks connected, but no build ever starts.

## Optional settings

| Setting | How | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `npx wrangler secret put ANTHROPIC_API_KEY` | Live host lines and the Ink Storm coach. Without it the host uses the written line bank. `KOTOBA_ANTHROPIC_API_KEY` works too. |
| `KOTOBA_HOST_MODEL`, `KOTOBA_JUDGE_MODEL` | `vars` in `wrangler.jsonc` | Override the Claude model, as on Node. |
| `VOICEVOX_URL`, `VOICEVOX_TOKEN` | `vars` for the URL, `wrangler secret put VOICEVOX_TOKEN` | A VOICEVOX engine reachable from the internet, for the hosts' own voices. The token is sent as `Authorization: Bearer`, for a proxy in front of the engine that checks it (VOICEVOX itself has no login). Without a URL the TV reads host lines with the browser's Japanese voice. |
| `READER_URL`, `READER_TOKEN` | `vars` for the URL, `wrangler secret put READER_TOKEN` | The reader service for kanji answers (below). Without it answers are compared as written. |
| `PUBLIC_URL` | `vars` in `wrangler.jsonc` | The address the QR code and the invite links (stage and phones) point at. Defaults to the address the stage was opened on. Set to `https://tanoshi.s.gy`, a short link that keeps the path and `?code=`, and the invite card adds its joke, 楽しすぎ！ For `npm run cf:dev`, put `PUBLIC_URL=` in `.dev.vars` so local rooms use the local address. |
| `STT_URL`, `STT_MODEL`, `STT_TOKEN` | `vars` for the URL and model, `wrangler secret put STT_TOKEN` | Spoken answers ([speech.md](speech.md)). `workers-ai` (the default here) runs Whisper on Workers AI through the `AI` binding; a URL uses a self-hosted Whisper server instead. Empty: phones type or tap. Audio never goes to Google. |

After changing `vars`, run `npm run cf:deploy` again. Secrets take effect at once.

### The reader service

Speech to text often returns kanji (三百円), and the rules compare kana readings
(さんびゃくえん). The dictionary that works those out doesn't fit in a Worker, so it runs as a
small separate service on any machine with Node:

```sh
READER_TOKEN=pick-a-long-secret npm run reader      # listens on port 3100
```

Give it a public https address (for example with a Cloudflare Tunnel:
`cloudflared tunnel --url http://localhost:3100`), then set `READER_URL` to that address and
`READER_TOKEN` to the same secret. VOICEVOX and a self-hosted Whisper server, if you use one instead of Workers AI
([speech.md](speech.md)), can sit on the same machine (`server/ai/docker-compose.voicevox.yml`).

## Custom domain

With a domain on Cloudflare, add it in `wrangler.jsonc` and deploy again:

```jsonc
"routes": [{ "pattern": "kotoba.example.com", "custom_domain": true }]
```

## Develop locally

```sh
npm run cf:dev                # http://localhost:8787, with rooms in a local Durable Object
npm run bots -- --url http://localhost:8787 --mode oogiri --bots 5
```

`wrangler dev` restarts the Worker when a file in `cloudflare/` or `server/` changes, which ends
any open rooms, just like a deploy.

## Logs

`npx wrangler tail` streams live logs; the Cloudflare dashboard keeps them under Workers ›
kotoba-party › Logs.
