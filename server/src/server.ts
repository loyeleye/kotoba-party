import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import QRCode from 'qrcode';
import { WebSocketServer, type WebSocket } from 'ws';
import { ROOM_STALE_MS } from '../../shared/src/constants.js';
import type { Utterance } from '../../shared/src/japanese/kana.js';
import type { ContentLibrary, HostCue } from '../../shared/src/modes/mode.js';
import { CLOSE, type CreateRoomResponse, type JoinRequest, type Phase, type PhrasebookResponse, type RoomInfo, type WatchRoomResponse } from '../../shared/src/protocol.js';
import { isRoomCode, normalizeRoomCode, randomRoomCode } from '../../shared/src/roomCode.js';
import { Accounts, MemoryAccountStorage } from './accounts.js';
import { systemClock, type Clock } from './clock.js';
import { addReadings, type Reader } from './reading.js';
import { Room, wavDurationMs, type RoomSocket } from './room.js';
import { MAX_CLIP_BYTES, SttGate, isClip, transcribe, type SttOptions } from './stt.js';

export interface ServerConfig {
  clock?: Clock;
  /** Fixed phase lengths overriding every mode's own (tests, fast bot runs). */
  durations?: Partial<Record<Phase, number>>;
  content: ContentLibrary;
  /** Kana reader for answers with kanji (see reading.ts). */
  reader?: Reader | null;
  seatHoldMs?: number;
  /** Close a room after this long with nobody connected. Default 10 minutes; 0 disables. */
  roomIdleMs?: number;
  /** Close a room after this long with no joins or commands, even with screens connected. Default 30 minutes; 0 disables. */
  roomStaleMs?: number;
  /** Base URL phones should open, e.g. https://kotoba.party. Derived from the request when unset. */
  publicUrl?: string;
  /** Folder holding the built stage/ and controller/ pages. */
  staticDir?: string;
  /** WebSocket ping interval; a phone that misses two pings is treated as dropped. 0 disables. */
  pingIntervalMs?: number;
  maxRooms?: number;
  onCommit?: (room: Room, version: number) => void;
  onCues?: (room: Room, cues: HostCue[], phaseSeq: number) => void;
  /** Called when a room enters a new phase (e.g. to reset the host's per-game budget on 'intro'). */
  onPhase?: (room: Room) => void;
  onRoomClosed?: (room: Room) => void;
  /** Self-hosted Whisper for spoken answers (see stt.ts). Unset: phones type or tap. */
  stt?: SttOptions | null;
  /** Optional sign-in and saved progress (docs/accounts.md). Default: kept in memory. Null turns sign-in off. */
  accounts?: Accounts | null;
  /** Host audio by id, served at GET /audio/:id. */
  audio?: (id: string) => { mime: string; bytes: Uint8Array } | undefined;
}

export interface KotobaServer {
  http: Server;
  rooms: Map<string, Room>;
  listen(port?: number, host?: string): Promise<string>;
  close(): Promise<void>;
}

const MAX_BODY = 16 * 1024;
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

export function createKotobaServer(config: ServerConfig): KotobaServer {
  const clock = config.clock ?? systemClock;
  const rooms = new Map<string, Room>();
  const maxRooms = config.maxRooms ?? 500;
  const staticDir = config.staticDir ? resolve(config.staticDir) : undefined;
  const sttGate = new SttGate();
  const accounts = config.accounts === undefined ? new Accounts(new MemoryAccountStorage()) : config.accounts;

  function createRoom(): Room | null {
    if (rooms.size >= maxRooms) return null;
    let code = randomRoomCode();
    for (let tries = 0; rooms.has(code); tries++) {
      if (tries > 50) return null;
      code = randomRoomCode();
    }
    const room = new Room({
      code,
      clock,
      durations: config.durations,
      content: config.content,
      seatHoldMs: config.seatHoldMs,
      idleMs: config.roomIdleMs ?? 10 * 60_000,
      staleMs: config.roomStaleMs ?? ROOM_STALE_MS,
      onClose: (r) => {
        rooms.delete(r.code);
        config.onRoomClosed?.(r);
      },
      onPhase: config.onPhase,
      onCommit: config.onCommit,
      onCues: config.onCues,
      onResults: accounts ? (results) => void accounts.recordResults(results).catch((err) => console.error('saving results failed', err)) : undefined,
    });
    rooms.set(code, room);
    return room;
  }

  function joinUrl(req: IncomingMessage, code: string): string {
    return `${baseUrl(req, config.publicUrl)}/?code=${code}`;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname;

    if (path === '/healthz') return send(res, 200, { ok: true, rooms: rooms.size });

    const audioMatch = /^\/audio\/([^/]+)$/.exec(path);
    if (audioMatch && req.method === 'GET') {
      const clip = config.audio?.(decodeURIComponent(audioMatch[1]!));
      if (!clip) return send(res, 404, { error: 'not-found' });
      res.writeHead(200, { 'content-type': clip.mime, 'cache-control': 'public, max-age=86400' });
      res.end(Buffer.from(clip.bytes));
      return;
    }

    const accountMatch = /^\/api\/account\/([a-z]+(?:\/[a-z]+)?)$/.exec(path);
    if (accountMatch) {
      if (!accounts) return send(res, 404, { error: 'no-accounts' });
      const body = req.method === 'POST' ? await readBytes(req, MAX_BODY) : null;
      if (req.method === 'POST' && !body) return send(res, 400, { error: 'bad-request' });
      const headers = new Headers();
      if (req.headers.authorization) headers.set('authorization', req.headers.authorization);
      const out = await accounts.handle(new Request(`http://local${req.url}`, { method: req.method, headers, body: body ? Buffer.from(body) : undefined }), accountMatch[1]!, pageOrigin(req));
      res.writeHead(out.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(await out.text());
      return;
    }

    if (path === '/api/rooms' && req.method === 'POST') {
      const room = createRoom();
      if (!room) return send(res, 503, { error: 'too-many-rooms' });
      const body: CreateRoomResponse = { code: room.code, stageToken: room.createStageToken(), joinUrl: joinUrl(req, room.code) };
      return send(res, 201, body);
    }

    const m = /^\/api\/rooms\/([^/]+)(?:\/([a-z.]+)(?:\/([^/]+))?)?$/.exec(path);
    if (m) {
      const code = normalizeRoomCode(decodeURIComponent(m[1]!));
      const room = isRoomCode(code) ? rooms.get(code) : undefined;
      if (!room) return send(res, 404, { error: 'room-not-found' });
      const action = m[2];

      if (!action && req.method === 'GET') {
        const info: RoomInfo = {
          code: room.code,
          phase: room.state.phase,
          players: room.state.players.length,
          joinable: room.state.phase === 'lobby' && room.state.players.length < 8,
        };
        return send(res, 200, info);
      }
      if (action === 'watch' && req.method === 'POST') {
        const stageToken = room.createWatchToken();
        if (!stageToken) return send(res, 409, { error: 'too-many-screens' });
        const body: WatchRoomResponse = { code: room.code, stageToken, joinUrl: joinUrl(req, room.code), watch: true };
        return send(res, 201, body);
      }
      if (action === 'join' && req.method === 'POST') {
        const body = (await readJson(req)) as JoinRequest | null;
        if (!body) return send(res, 400, { error: 'bad-request' });
        const result = room.join(body);
        if ('error' in result) return send(res, result.error === 'room-full' || result.error === 'game-in-progress' || result.error === 'name-taken' ? 409 : 400, result);
        return send(res, 200, { ...result, speech: !!config.stt, site: baseUrl(req, config.publicUrl) });
      }
      if (action === 'speech' && req.method === 'POST') {
        const token = bearer(req);
        if (!token || room.viewerFor(token)?.kind !== 'player') return send(res, 401, { error: 'bad-token' });
        if (!config.stt) return send(res, 503, { error: 'no-speech' });
        const clip = await readBytes(req, MAX_CLIP_BYTES);
        if (!clip || !isClip(clip)) return send(res, 400, { error: 'bad-clip' });
        const result = await sttGate.run(token, () => transcribe(clip, config.stt!));
        if (result === 'busy') return send(res, 429, { error: 'busy' });
        if (!result.ok) return send(res, 502, { error: result.error });
        // With the reading and word split, a かな phone can show what it heard in romaji.
        const heard: Utterance = { via: 'speech', text: result.text };
        addReadings({ heard }, config.reader ?? null);
        return send(res, 200, heard);
      }
      if (action === 'clip' && req.method === 'POST') {
        // Dub Club: a recorded line the TV will play. Kept in the room's memory (see Room.keepClip) unless the
        // player plays it from their own phone (?tv=0), and read by Whisper when the server has speech.
        const token = bearer(req);
        if (!token || room.viewerFor(token)?.kind !== 'player') return send(res, 401, { error: 'bad-token' });
        const clip = await readBytes(req, MAX_CLIP_BYTES);
        if (!clip || !isClip(clip)) return send(res, 400, { error: 'bad-clip' });
        const kept = url.searchParams.get('tv') === '0' ? null : room.keepClip(token, clip);
        if (url.searchParams.get('tv') !== '0' && !kept) return send(res, 409, { error: 'no-clips' });
        let heard: Utterance | null = null;
        if (config.stt) {
          const result = await sttGate.run(token, () => transcribe(clip, config.stt!));
          if (result !== 'busy' && result.ok) {
            heard = { via: 'speech', text: result.text };
            addReadings({ heard }, config.reader ?? null);
          }
        }
        return send(res, 200, { clipId: kept?.clipId ?? null, durMs: kept?.durMs ?? wavDurationMs(clip), heard, speech: !!config.stt });
      }
      if (action === 'clip' && m[3] && req.method === 'GET') {
        const bytes = room.clipFor(bearer(req) ?? '', decodeURIComponent(m[3]));
        if (!bytes) return send(res, 404, { error: 'not-found' });
        res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' });
        res.end(Buffer.from(bytes));
        return;
      }
      if (action === 'commands' && req.method === 'POST') {
        const token = bearer(req);
        const body = await readJson(req);
        if (body && typeof body === 'object' && ['play', 'micCheck'].includes(String((body as { type?: unknown }).type))) {
          addReadings(body, config.reader ?? null);
        }
        const result = token ? room.command(token, body) : null;
        if (!result) return send(res, 401, { error: token && room.wasReleased(token) ? 'seat-released' : 'bad-token' });
        return send(res, 200, result);
      }
      if (action === 'phrasebook' && req.method === 'GET') {
        // The Phrasebook: the stage's (tonight's phrases and every signed-in player's save), or a phone's own.
        const book = room.phrasebookFor(bearer(req) ?? '');
        if (!book) return send(res, 401, { error: 'bad-token' });
        const body: PhrasebookResponse = { tonight: book.tonight, saved: accounts && book.signedIn.length ? await accounts.phrasebooks(book.signedIn) : [] };
        return send(res, 200, body);
      }
      if (action === 'qr.svg' && req.method === 'GET') {
        const svg = await QRCode.toString(joinUrl(req, room.code), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
        res.writeHead(200, { 'content-type': MIME['.svg']!, 'cache-control': 'no-store' });
        res.end(svg);
        return;
      }
      return send(res, 404, { error: 'not-found' });
    }

    if (req.method === 'GET' && staticDir) return serveStatic(res, staticDir, path);
    return send(res, 404, { error: 'not-found' });
  }

  const http = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'server-error' });
      else res.end();
    });
  });

  // ---- WebSocket push (ADR 0002): the server talks, clients listen. ----
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const alive = new WeakMap<WebSocket, boolean>();

  http.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      const code = normalizeRoomCode(url.searchParams.get('code') ?? '');
      const token = url.searchParams.get('token') ?? '';
      const room = rooms.get(code);
      if (!room) return ws.close(CLOSE.roomGone, 'room-not-found');
      const roomSocket: RoomSocket = {
        send: (data) => ws.send(data),
        close: (c, reason) => ws.close(c, reason),
      };
      alive.set(ws, true);
      ws.on('pong', () => alive.set(ws, true));
      ws.on('close', () => room.detach(roomSocket));
      ws.on('error', () => ws.terminate());
      // Clients never need to send anything; ignore whatever they do send.
      ws.on('message', () => {});
      if (!room.attach(token, roomSocket)) {
        ws.close(room.wasReleased(token) ? CLOSE.seatReleased : CLOSE.badToken, 'unknown-token');
      }
    });
  });

  const pingMs = config.pingIntervalMs ?? 10_000;
  const pinger =
    pingMs > 0
      ? setInterval(() => {
          for (const ws of wss.clients) {
            if (!alive.get(ws)) {
              ws.terminate();
              continue;
            }
            alive.set(ws, false);
            ws.ping();
          }
        }, pingMs)
      : null;
  pinger?.unref();

  return {
    http,
    rooms,
    listen(port = 3000, host = '0.0.0.0') {
      return new Promise((resolveListen) => {
        http.listen(port, host, () => {
          const addr = http.address() as AddressInfo;
          resolveListen(`http://${host === '0.0.0.0' ? 'localhost' : host}:${addr.port}`);
        });
      });
    },
    async close() {
      if (pinger) clearInterval(pinger);
      for (const room of [...rooms.values()]) room.close();
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const body = await readBytes(req, MAX_BODY);
  if (!body) return null;
  try {
    return JSON.parse(Buffer.from(body).toString('utf8'));
  } catch {
    return null;
  }
}

async function readBytes(req: IncomingMessage, max: number): Promise<Uint8Array | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(res: ServerResponse, root: string, path: string): Promise<void> {
  // /stage and /stage/* come from the stage build; everything else is the phone controller.
  let app = 'controller';
  let rest = path;
  if (path === '/stage' || path.startsWith('/stage/')) {
    app = 'stage';
    rest = path.slice('/stage'.length);
  }
  if (rest === '' || rest === '/') rest = '/index.html';
  const base = join(root, app);
  const file = normalize(join(base, rest));
  if (!file.startsWith(base)) return send(res, 404, { error: 'not-found' });
  try {
    const data = await readFile(file);
    // Music files never change under the same name, and they're big: let the browser keep them.
    const cache = extname(file) === '.mp3' ? 'public, max-age=604800' : 'no-cache';
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': cache });
    res.end(data);
  } catch {
    send(res, 404, { error: 'not-found' });
  }
}

/** The origin the phone's page was loaded from, as the passkey sees it (not the LAN swap below). */
function pageOrigin(req: IncomingMessage): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http';
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? 'localhost';
  return `${proto}://${host}`;
}

/** The URL phones should open. On localhost, swap in this machine's LAN address so a QR scan works. */
function baseUrl(req: IncomingMessage, publicUrl: string | undefined): string {
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http';
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? 'localhost';
  const [hostname, port] = host.split(':');
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const lan = lanAddress();
    if (lan) return `${proto}://${lan}${port ? `:${port}` : ''}`;
  }
  return `${proto}://${host}`;
}

function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const addr of list ?? []) if (addr.family === 'IPv4' && !addr.internal) return addr.address;
  }
  return undefined;
}
