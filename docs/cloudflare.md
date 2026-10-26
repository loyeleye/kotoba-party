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

## Optional settings

| Setting | How | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `npx wrangler secret put ANTHROPIC_API_KEY` | Live host lines and the Ink Storm coach. Without it the host uses the written line bank. `KOTOBA_ANTHROPIC_API_KEY` works too. |
| `KOTOBA_HOST_MODEL`, `KOTOBA_JUDGE_MODEL` | `vars` in `wrangler.jsonc` | Override the Claude model, as on Node. |
| `VOICEVOX_URL` | `vars` in `wrangler.jsonc` | A VOICEVOX engine reachable from the internet, for host voices. Without it lines show as subtitles. |
| `READER_URL`, `READER_TOKEN` | `vars` for the URL, `wrangler secret put READER_TOKEN` | The reader service for kanji answers (below). Without it answers are compared as written. |
| `PUBLIC_URL` | `vars` in `wrangler.jsonc` | The address the QR code points at. Defaults to the address the stage was opened on. |

After changing `vars`, run `npm run cf:deploy` again. Secrets take effect at once.

### The reader service

Speech recognition often returns kanji (三百円), and the rules compare kana readings
(さんびゃくえん). The dictionary that works those out doesn't fit in a Worker, so it runs as a
small separate service on any machine with Node:

```sh
READER_TOKEN=pick-a-long-secret npm run reader      # listens on port 3100
```

Give it a public https address (for example with a Cloudflare Tunnel:
`cloudflared tunnel --url http://localhost:3100`), then set `READER_URL` to that address and
`READER_TOKEN` to the same secret. VOICEVOX can sit on the same machine
(`server/ai/docker-compose.voicevox.yml`).

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
