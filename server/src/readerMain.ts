// A small HTTP service that works out kana readings, for servers that can't load the kuromoji
// dictionary themselves (the Cloudflare Worker: the dictionary needs about 290 MB, a Worker gets 128 MB).
//
//   READER_TOKEN=some-secret PORT=3100 npm run reader
//   POST /read  { texts: string[] }  →  { results: { reading: string, tokens: UtteranceToken[] }[] }
//
// Set READER_URL and READER_TOKEN on the Worker to use it (see docs/cloudflare.md).

import { createServer } from 'node:http';
import { createReader } from './reading.js';

const MAX_TEXTS = 16;
const MAX_CHARS = 200;
const token = process.env.READER_TOKEN;

const reader = await createReader();
if (!reader) {
  console.error('kuromoji dictionary failed to load');
  process.exit(1);
}

const server = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.url === '/healthz') return send(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/read') return send(404, { error: 'not-found' });
  if (token && req.headers.authorization !== `Bearer ${token}`) return send(401, { error: 'bad-token' });
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size <= 16 * 1024) chunks.push(c);
  });
  req.on('end', () => {
    let texts: unknown;
    try {
      texts = (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { texts?: unknown }).texts;
    } catch {
      return send(400, { error: 'bad-request' });
    }
    if (size > 16 * 1024 || !Array.isArray(texts) || texts.length > MAX_TEXTS || !texts.every((t) => typeof t === 'string' && t.length <= MAX_CHARS)) {
      return send(400, { error: 'bad-request' });
    }
    send(200, { results: (texts as string[]).map((t) => ({ reading: reader(t), tokens: reader.tokens(t) })) });
  });
});

const port = Number(process.env.PORT ?? 3100);
server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Kotoba reader on http://localhost:${port}/read${token ? '' : ' (no READER_TOKEN set: open to anyone who can reach it)'}`));
