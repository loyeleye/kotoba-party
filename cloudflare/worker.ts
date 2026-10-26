// Kotoba Party on Cloudflare (ADR 0003). The same HTTP and WebSocket API as the Node server
// (server/src/server.ts, docs/protocol.md), split in two:
//
// - this Worker: static pages, room-code allocation, readings for kanji answers, routing;
// - one RoomObject (a Durable Object) per room code, which runs the room itself.

import { CLOSE } from '../shared/src/protocol.js';
import { isRoomCode, normalizeRoomCode, randomRoomCode } from '../shared/src/roomCode.js';
import { addReadingsRemote } from './reading.js';
import type { Env } from './env.js';

export { RoomObject } from './roomObject.js';

const MAX_BODY = 16 * 1024;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const base = (env.PUBLIC_URL || url.origin).replace(/\/$/, '');

    if (path === '/healthz') return json(200, { ok: true });

    if (path === '/ws') {
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json(426, { error: 'websocket-only' });
      const code = normalizeRoomCode(url.searchParams.get('code') ?? '');
      if (!isRoomCode(code)) {
        const { 0: client, 1: server } = new WebSocketPair();
        server.accept();
        server.close(CLOSE.roomGone, 'room-not-found');
        return new Response(null, { status: 101, webSocket: client });
      }
      return toRoom(env, code, 'ws', { token: url.searchParams.get('token') ?? '' }, req);
    }

    if (path === '/api/rooms' && req.method === 'POST') {
      // Room codes are picked here; the code's object says whether it is free.
      for (let tries = 0; tries < 20; tries++) {
        const code = randomRoomCode();
        const res = await toRoom(env, code, 'create', { base }, new Request('https://room/', { method: 'POST' }));
        if (res.status !== 409) return res;
      }
      return json(503, { error: 'too-many-rooms' });
    }

    const m = /^\/api\/rooms\/([^/]+)(?:\/([a-z.]+)(?:\/([^/]+))?)?$/.exec(path);
    if (m) {
      const code = normalizeRoomCode(decodeURIComponent(m[1]!));
      if (!isRoomCode(code)) return json(404, { error: 'room-not-found' });
      const action = m[2];
      if (!action && req.method === 'GET') return toRoom(env, code, 'info', {}, req);
      if (action === 'join' && req.method === 'POST') return toRoom(env, code, 'join', {}, await limited(req));
      if (action === 'qr.svg' && req.method === 'GET') return toRoom(env, code, 'qr.svg', { base }, req);
      if (action === 'audio' && m[3] && req.method === 'GET') return toRoom(env, code, 'audio', { id: decodeURIComponent(m[3]) }, req);
      if (action === 'commands' && req.method === 'POST') {
        const auth = req.headers.get('authorization');
        const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
        const text = await req.text();
        let body: unknown = null;
        try {
          body = text.length <= MAX_BODY ? JSON.parse(text) : null;
        } catch {
          // The room answers bad-command.
        }
        if (body && typeof body === 'object' && ['play', 'micCheck'].includes(String((body as { type?: unknown }).type))) {
          await addReadingsRemote(body, env.READER_URL ? { url: env.READER_URL, token: env.READER_TOKEN } : null);
        }
        return toRoom(env, code, 'commands', { token }, new Request('https://room/', { method: 'POST', body: JSON.stringify(body) }));
      }
      return json(404, { error: 'not-found' });
    }

    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(env, url);
    return json(404, { error: 'not-found' });
  },
} satisfies ExportedHandler<Env>;

function toRoom(env: Env, code: string, action: string, params: Record<string, string>, req: Request): Promise<Response> {
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  const target = new URL(`https://room/${action}`);
  target.searchParams.set('code', code);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return stub.fetch(new Request(target, req));
}

async function limited(req: Request): Promise<Request> {
  const text = await req.text();
  return new Request('https://room/', { method: 'POST', body: text.length <= MAX_BODY ? text : '' });
}

/** /stage and /stage/* come from the stage build; everything else is the phone controller (as in server.ts). */
function serveStatic(env: Env, url: URL): Promise<Response> {
  let path = url.pathname;
  if (!(path === '/stage' || path.startsWith('/stage/'))) path = `/controller${path}`;
  if (path.endsWith('/')) path += 'index.html';
  else if (path === '/stage' || path === '/controller') path += '/index.html';
  return env.ASSETS.fetch(new Request(new URL(path, url.origin)));
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
