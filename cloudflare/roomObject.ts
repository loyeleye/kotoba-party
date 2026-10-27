// One Durable Object per room (ADR 0003). It holds the same Room the Node server uses
// (server/src/room.ts), in memory, and is its only writer: Cloudflare runs one instance of
// each object at a time, so a room code always reaches the same Room. Phones' WebSockets end
// here too, which keeps the object in memory for as long as anyone is connected.

import { DurableObject } from 'cloudflare:workers';
import QRCode from 'qrcode';
import debugPrompts from '../content/debug/prompts.json';
import { HOST_EVENTS, SilentTts, VoicevoxTts, createHostVoice, createInkCoach, createSuspectVoice, llmFromEnv, type BankLine, type HostVoice as AiHostVoice } from '../server/ai/index.js';
import { buildContent } from '../server/src/content.js';
import { aiVoice, bankVoice, hostDirector, type HostVoice } from '../server/src/host.js';
import { inkCoachDirector } from '../server/src/ink.js';
import { suspectDirector } from '../server/src/onsen.js';
import { Room, type RoomSocket } from '../server/src/room.js';
import { systemClock } from '../server/src/clock.js';
import { SttGate, isClip, sttFromEnv, transcribe } from '../server/src/stt.js';
import { ROOM_STALE_MS } from '../shared/src/constants.js';
import { CLOSE, type CreateRoomResponse, type JoinRequest, type RoomInfo, type WatchRoomResponse } from '../shared/src/protocol.js';
import type { Env } from './env.js';

// Built once per isolate and shared by every room in it; the content is read-only.
const content = buildContent(debugPrompts.prompts);
const bankLines = content.hostLines.filter((l): l is typeof l & BankLine => (HOST_EVENTS as readonly string[]).includes(l.event));

export class RoomObject extends DurableObject<Env> {
  private room: Room | null = null;
  private ai: AiHostVoice | null = null;
  private readonly sttGate = new SttGate();

  /** Opens a room under this object's code. Answers 409 if one is already open here. */
  private open(code: string): Room | null {
    if (this.room) return null;
    const llm = llmFromEnv();
    const ai = createHostVoice({
      llm,
      tts: this.env.VOICEVOX_URL ? new VoicevoxTts({ baseUrl: this.env.VOICEVOX_URL }) : new SilentTts(),
      lines: bankLines,
    });
    this.ai = ai;
    const room: Room = new Room({
      code,
      clock: systemClock,
      content,
      idleMs: 10 * 60_000,
      staleMs: ROOM_STALE_MS,
      onClose: () => {
        ai.closeRoom(code);
        if (this.room === room) {
          this.room = null;
          this.ai = null;
        }
      },
      onPhase: (r) => r.state.phase === 'intro' && ai.newGame(r.code),
      onCues: hostDirector(roomAudio(aiVoice(ai, bankVoice(content)))),
      // As on Node: Ink Storm's second look and the Onsen suspects' lead-ins, only with an LLM.
      onCommit: llm
        ? (() => {
            const ink = inkCoachDirector(createInkCoach({ llm }), { budget: (c) => ai.budget(c) });
            const suspects = suspectDirector(createSuspectVoice({ llm }), { budget: (c) => ai.budget(c) });
            return (r: Room) => {
              ink(r);
              suspects(r);
            };
          })()
        : undefined,
    });
    this.room = room;
    return room;
  }

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') ?? '';
    const base = url.searchParams.get('base') ?? '';
    const action = url.pathname.slice(1);

    if (action === 'create') {
      const room = this.open(code);
      if (!room) return json(409, { error: 'code-taken' });
      const body: CreateRoomResponse = { code, stageToken: room.createStageToken(), joinUrl: `${base}/?code=${code}` };
      return json(201, body);
    }

    if (action === 'ws') return this.socket(url.searchParams.get('token') ?? '');

    const room = this.room;
    if (!room) return json(404, { error: 'room-not-found' });

    if (action === 'info') {
      const info: RoomInfo = {
        code: room.code,
        phase: room.state.phase,
        players: room.state.players.length,
        joinable: room.state.phase === 'lobby' && room.state.players.length < 8,
      };
      return json(200, info);
    }
    if (action === 'watch') {
      const stageToken = room.createWatchToken();
      if (!stageToken) return json(409, { error: 'too-many-screens' });
      const body: WatchRoomResponse = { code: room.code, stageToken, joinUrl: `${base}/?code=${room.code}`, watch: true };
      return json(201, body);
    }
    if (action === 'join') {
      const body = (await req.json().catch(() => null)) as JoinRequest | null;
      if (!body) return json(400, { error: 'bad-request' });
      const result = room.join(body);
      if ('error' in result) return json(result.error === 'room-full' || result.error === 'game-in-progress' || result.error === 'name-taken' ? 409 : 400, result);
      return json(200, { ...result, speech: !!sttFromEnv(this.env), site: base || undefined });
    }
    if (action === 'speech') {
      const token = url.searchParams.get('token') ?? '';
      if (room.viewerFor(token)?.kind !== 'player') return json(401, { error: 'bad-token' });
      const stt = sttFromEnv(this.env);
      if (!stt) return json(503, { error: 'no-speech' });
      const clip = new Uint8Array(await req.arrayBuffer());
      if (!isClip(clip)) return json(400, { error: 'bad-clip' });
      const result = await this.sttGate.run(token, () => transcribe(clip, stt));
      if (result === 'busy') return json(429, { error: 'busy' });
      return result.ok ? json(200, { via: 'speech', text: result.text }) : json(502, { error: result.error });
    }
    if (action === 'commands') {
      const token = url.searchParams.get('token');
      const body = await req.json().catch(() => null);
      const result = token ? room.command(token, body) : null;
      if (!result) return json(401, { error: token && room.wasReleased(token) ? 'seat-released' : 'bad-token' });
      return json(200, result);
    }
    if (action === 'qr.svg') {
      const svg = await QRCode.toString(`${base}/?code=${room.code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' } });
    }
    if (action === 'audio') {
      const clip = this.ai?.audio(url.searchParams.get('id') ?? '');
      if (!clip) return json(404, { error: 'not-found' });
      return new Response(clip.bytes, { headers: { 'content-type': clip.mime, 'cache-control': 'public, max-age=86400' } });
    }
    return json(404, { error: 'not-found' });
  }

  /** WebSocket push (ADR 0002). Clients never send anything; whatever they send is ignored. */
  private socket(token: string): Response {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    const room = this.room;
    if (!room) {
      server.close(CLOSE.roomGone, 'room-not-found');
      return new Response(null, { status: 101, webSocket: client });
    }
    const roomSocket: RoomSocket = {
      send: (data) => server.send(data),
      close: (c, reason) => server.close(c, reason),
    };
    server.addEventListener('close', () => room.detach(roomSocket));
    server.addEventListener('error', () => room.detach(roomSocket));
    if (!room.attach(token, roomSocket)) {
      server.close(room.wasReleased(token) ? CLOSE.seatReleased : CLOSE.badToken, 'unknown-token');
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}

/**
 * Host audio lives in each room's object, so its URL has to name the room
 * (/api/rooms/:code/audio/:id) rather than the Node server's /audio/:id.
 */
function roomAudio(voice: HostVoice): HostVoice {
  return {
    async speak(code, cue) {
      const line = await voice.speak(code, cue);
      return line?.audioUrl ? { ...line, audioUrl: `/api/rooms/${code}${line.audioUrl}` } : line;
    },
    ahead: voice.ahead?.bind(voice),
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
