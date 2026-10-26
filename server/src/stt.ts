// Speech to text on our own machine. A phone records a short clip (16 kHz mono WAV, made on the phone) and posts
// it to the game server, which passes it to a self-hosted Whisper server and hands back the words. No audio goes
// to Google or any other outside service. Both the Node server and the Cloudflare Worker use this file; with no
// STT_URL set, phones get no hold-to-talk button and players type or tap kana instead.
//
// STT_URL is the Whisper server's transcription endpoint. Anything that takes a multipart `file` and answers
// { text } works, for example:
//   whisper.cpp's whisper-server   http://127.0.0.1:8080/inference
//   speaches (faster-whisper)      http://127.0.0.1:8000/v1/audio/transcriptions   (set STT_MODEL too)

export interface SttOptions {
  url: string;
  /** Sent as a Bearer token, for a Whisper server behind a proxy that checks one. */
  token?: string;
  /** The `model` field, for servers that host several (speaches). whisper.cpp ignores it. */
  model?: string;
  /** Give up after this long; the phone then offers the typed fallback. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** A 15 s clip at 16 kHz, 16-bit mono is 480 KB; anything bigger was not made by our phone page. */
export const MAX_CLIP_BYTES = 512 * 1024;

export function sttFromEnv(env: { STT_URL?: string; STT_TOKEN?: string; STT_MODEL?: string }): SttOptions | null {
  const url = env.STT_URL?.trim();
  return url ? { url, token: env.STT_TOKEN || undefined, model: env.STT_MODEL || undefined } : null;
}

/** True for a PCM WAV of a sane size: the only thing a phone sends. */
export function isClip(b: Uint8Array): boolean {
  if (b.length < 44 || b.length > MAX_CLIP_BYTES) return false;
  const tag = (at: number) => String.fromCharCode(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);
  return tag(0) === 'RIFF' && tag(8) === 'WAVE';
}

export type SttResult = { ok: true; text: string } | { ok: false; error: 'stt-failed' };

export async function transcribe(clip: Uint8Array, opts: SttOptions): Promise<SttResult> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(clip)], { type: 'audio/wav' }), 'clip.wav');
  form.append('language', 'ja');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (opts.model) form.append('model', opts.model);
  try {
    const res = await (opts.fetch ?? fetch)(opts.url, {
      method: 'POST',
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    if (!res.ok) return { ok: false, error: 'stt-failed' };
    const { text } = (await res.json()) as { text?: unknown };
    if (typeof text !== 'string') return { ok: false, error: 'stt-failed' };
    return { ok: true, text: cleanTranscript(text) };
  } catch {
    return { ok: false, error: 'stt-failed' };
  }
}

// Whisper fills silence and noise with lines from the video subtitles it learned on. On a 6 second clip these
// are never what a player said, so they count as nothing heard.
const HALLUCINATIONS = [/ご視聴ありがとうございました/g, /チャンネル登録(よろしくお願いします|をお願いします)?/g, /字幕(視聴)?ありがとうございました/g];

export function cleanTranscript(raw: string): string {
  let t = raw.replace(/[[(（【][^\])）】]*[\])）】]/g, ''); // [音楽] (拍手) and the like
  for (const re of HALLUCINATIONS) t = t.replace(re, '');
  return t.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** One clip in flight per player, so a stuck button can't queue up work on the Whisper server. */
export class SttGate {
  private readonly busy = new Set<string>();
  async run<T>(key: string, work: () => Promise<T>): Promise<T | 'busy'> {
    if (this.busy.has(key)) return 'busy';
    this.busy.add(key);
    try {
      return await work();
    } finally {
      this.busy.delete(key);
    }
  }
}
