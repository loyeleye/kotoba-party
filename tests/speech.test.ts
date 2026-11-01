import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { joinRoom } from '../shared/src/client.js';
import { downsample, peakLoudness, wav } from '../controller/src/components/mic.js';
import { cleanTranscript, isClip, sttFromEnv, transcribe } from '../server/src/stt.js';
import { startServer } from './helpers.js';

const clip = () => wav(new Float32Array(16_000).map((_, i) => Math.sin(i / 10) * 0.3), 16_000);

/** A stand-in Whisper server that records what it was sent. */
async function fakeWhisper(answer: (body: string) => { status: number; body: unknown }) {
  const seen: { auth?: string; body: string }[] = [];
  const http: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('latin1');
      seen.push({ auth: req.headers.authorization, body });
      const a = answer(body);
      res.writeHead(a.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(a.body));
    });
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(http.address() as AddressInfo).port}/inference`, seen, close: () => new Promise<void>((r) => http.close(() => r())) };
}

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c();
});

describe('the phone clip', () => {
  it('is a 16 kHz mono 16-bit WAV the server accepts', () => {
    const b = clip();
    expect(isClip(b)).toBe(true);
    const v = new DataView(b.buffer);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(b.length).toBe(44 + 32_000);
  });

  it('judges a clip by its loudest stretch, so a short vowel in a long hold still counts', () => {
    const clip = new Float32Array(48_000 * 2);
    for (let i = 0; i < 48_000 * 0.2; i++) clip[48_000 + i] = 0.03 * Math.sin(i / 10);
    expect(peakLoudness(clip, 48_000)).toBeGreaterThan(0.015);
    expect(peakLoudness(new Float32Array(48_000), 48_000)).toBe(0);
  });

  it('downsamples 48 kHz to a third of the samples', () => {
    expect(downsample(new Float32Array(48_000), 48_000, 16_000).length).toBe(16_000);
  });

  it('refuses anything that is not a WAV', () => {
    expect(isClip(new TextEncoder().encode('x'.repeat(100)))).toBe(false);
  });
});

describe('transcripts', () => {
  it('drops the lines Whisper invents for silence', () => {
    expect(cleanTranscript('ご視聴ありがとうございました')).toBe('');
    expect(cleanTranscript('[音楽] すしをください')).toBe('すしをください');
    expect(cleanTranscript(' こんにちは ')).toBe('こんにちは');
  });

  it('is off without STT_URL', () => {
    expect(sttFromEnv({})).toBeNull();
    expect(sttFromEnv({ STT_URL: ' ' })).toBeNull();
    expect(sttFromEnv({ STT_URL: 'http://w/inference', STT_MODEL: 'm' })).toEqual({ url: 'http://w/inference', model: 'm', token: undefined });
  });

  it('asks the Whisper server for Japanese and reads { text }', async () => {
    const w = await fakeWhisper(() => ({ status: 200, body: { text: 'さんびゃくえん' } }));
    cleanups.push(w.close);
    const r = await transcribe(clip(), { url: w.url, token: 's3cret', model: 'large-v3-turbo' });
    expect(r).toEqual({ ok: true, text: 'さんびゃくえん' });
    expect(w.seen[0]!.auth).toBe('Bearer s3cret');
    expect(w.seen[0]!.body).toMatch(/name="language"\r\n\r\nja/);
    expect(w.seen[0]!.body).toMatch(/name="model"\r\n\r\nlarge-v3-turbo/);
    expect(w.seen[0]!.body).toMatch(/filename="clip.wav"/);
  });

  it('runs Whisper on Workers AI when STT_URL is workers-ai', async () => {
    const calls: { model: string; inputs: Record<string, unknown> }[] = [];
    const AI = { run: async (model: string, inputs: Record<string, unknown>) => (calls.push({ model, inputs }), { text: 'ご視聴ありがとうございました すしをください。' }) };
    expect(sttFromEnv({ STT_URL: 'workers-ai' })).toBeNull(); // the Node server has no binding
    const opts = sttFromEnv({ STT_URL: 'workers-ai', AI })!;
    expect(opts.model).toBe('@cf/openai/whisper-large-v3-turbo');
    const c = clip();
    expect(await transcribe(c, opts)).toEqual({ ok: true, text: 'すしをください。' });
    expect(calls[0]!.model).toBe('@cf/openai/whisper-large-v3-turbo');
    expect(calls[0]!.inputs).toMatchObject({ language: 'ja', task: 'transcribe' });
    expect(Buffer.from(calls[0]!.inputs.audio as string, 'base64').equals(Buffer.from(c))).toBe(true);
  });

  it('reports a failure when Workers AI errors or stalls', async () => {
    const failing = { run: async () => Promise.reject(new Error('AiError')) };
    expect(await transcribe(clip(), { url: 'workers-ai', ai: failing })).toEqual({ ok: false, error: 'stt-failed' });
    const stalled = { run: () => new Promise<never>(() => {}) };
    expect(await transcribe(clip(), { url: 'workers-ai', ai: stalled, timeoutMs: 20 })).toEqual({ ok: false, error: 'stt-failed' });
  });

  it('reports a failure when the Whisper server errors', async () => {
    const w = await fakeWhisper(() => ({ status: 500, body: {} }));
    cleanups.push(w.close);
    expect(await transcribe(clip(), { url: w.url })).toEqual({ ok: false, error: 'stt-failed' });
  });
});

describe('POST /api/rooms/:code/speech', () => {
  async function room(stt: boolean) {
    const w = await fakeWhisper(() => ({ status: 200, body: { text: 'こんにちは' } }));
    const { server, baseUrl } = await startServer({ stt: stt ? { url: w.url } : null });
    cleanups.push(w.close, () => server.close());
    const created = (await (await fetch(`${baseUrl}/api/rooms`, { method: 'POST' })).json()) as { code: string; stageToken: string };
    const joined = await joinRoom(baseUrl, created.code, { name: 'Ana' });
    if ('error' in joined) throw new Error(joined.error);
    const post = (token: string, body: Uint8Array<ArrayBuffer>) =>
      fetch(`${baseUrl}/api/rooms/${created.code}/speech`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'audio/wav' }, body });
    return { joined, stageToken: created.stageToken, post, w };
  }

  it('tells phones whether speech is on when they join', async () => {
    expect((await room(true)).joined.speech).toBe(true);
    expect((await room(false)).joined.speech).toBe(false);
  });

  it('returns what Whisper heard for a seated player', async () => {
    const { joined, post, w } = await room(true);
    const res = await post(joined.token, clip());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ via: 'speech', text: 'こんにちは' });
    expect(w.seen).toHaveLength(1);
  });

  it('refuses the stage, strangers, and non-WAV bodies without calling Whisper', async () => {
    const { stageToken, joined, post, w } = await room(true);
    expect((await post(stageToken, clip())).status).toBe(401);
    expect((await post('nope', clip())).status).toBe(401);
    expect((await post(joined.token, new TextEncoder().encode('x'.repeat(100)))).status).toBe(400);
    expect(w.seen).toHaveLength(0);
  });

  it('answers 503 when no speech server is set up', async () => {
    const { joined, post } = await room(false);
    expect((await post(joined.token, clip())).status).toBe(503);
  });
});
