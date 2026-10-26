// The phone's microphone: records a hold-to-talk clip as 16 kHz mono WAV and asks our server what was said.
// The server passes the clip to Whisper (Workers AI on Cloudflare, or our own server; server/src/stt.ts), so
// audio never reaches Google. There is no browser recogniser fallback: with no speech server, or no mic,
// every spoken step is typed or tapped instead.

const RATE = 16_000;
/** The server refuses longer clips (stt.ts MAX_CLIP_BYTES); the hold buttons let go before this. */
const MAX_SECONDS = 15;

interface SpeechService {
  base: string;
  code: string;
  token: string;
}
let service: SpeechService | null = null;

/** Set by main.ts after joining: the room's address and the seat token, or null when the server has no speech. */
export function setSpeechService(s: SpeechService | null): void {
  service = s;
}

const hasMic = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined';

/** Hold-to-talk works on this phone in this room. */
export const speechReady = (): boolean => !!service && hasMic();

export type Heard = { ok: true; text: string } | { ok: false; why: 'quiet' | 'blocked' | 'failed' | 'busy' };

/**
 * One hold of the button. Create it inside the press (so the browser lets audio start), call stop() on release.
 * Exposes its audio graph so the karaoke pitch tracker can listen to the same mic.
 */
export class MicClip {
  readonly audio: AudioContext;
  source: MediaStreamAudioSourceNode | null = null;
  /** Resolves once the mic is open (or fails: blocked, or no mic). */
  readonly ready: Promise<boolean>;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private length = 0;
  private stopped = false;
  blocked = false;

  constructor() {
    this.audio = new AudioContext();
    void this.audio.resume();
    this.ready = this.open();
  }

  private async open(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      if (this.stopped) {
        for (const t of stream.getTracks()) t.stop();
        return false;
      }
      this.stream = stream;
      this.source = this.audio.createMediaStreamSource(stream);
      // ScriptProcessor is deprecated but runs everywhere (an AudioWorklet needs a separate module file).
      const node = this.audio.createScriptProcessor(4096, 1, 1);
      const limit = MAX_SECONDS * this.audio.sampleRate;
      node.onaudioprocess = (e) => {
        if (this.stopped || this.length >= limit) return;
        const data = e.inputBuffer.getChannelData(0);
        this.chunks.push(new Float32Array(data));
        this.length += data.length;
      };
      this.source.connect(node);
      // Some browsers only run a processor that goes somewhere; it writes silence.
      node.connect(this.audio.destination);
      this.node = node;
      return true;
    } catch (e) {
      this.blocked = (e as Error)?.name === 'NotAllowedError';
      this.close();
      return false;
    }
  }

  /** Stops recording and returns the clip, or null if nothing was recorded. */
  stop(): Uint8Array<ArrayBuffer> | null {
    if (this.stopped) return null;
    this.stopped = true;
    const rate = this.audio.sampleRate;
    this.close();
    if (!this.length) return null;
    const all = new Float32Array(this.length);
    let at = 0;
    for (const c of this.chunks) {
      all.set(c, at);
      at += c.length;
    }
    this.chunks = [];
    if (loudness(all) < 0.008) return new Uint8Array(0); // only room noise: don't bother the server
    return wav(downsample(all, rate, RATE), RATE);
  }

  private close(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.node = null;
    this.stream = null;
    void this.audio.close().catch(() => {});
  }
}

/** Sends a clip to the server and returns what Whisper heard. */
export async function hear(clip: Uint8Array<ArrayBuffer> | null): Promise<Heard> {
  if (!clip || clip.length === 0) return { ok: false, why: 'quiet' };
  if (!service) return { ok: false, why: 'failed' };
  try {
    const res = await fetch(`${service.base}/api/rooms/${service.code}/speech`, {
      method: 'POST',
      headers: { 'content-type': 'audio/wav', authorization: `Bearer ${service.token}` },
      body: clip,
    });
    if (res.status === 429) return { ok: false, why: 'busy' };
    if (!res.ok) return { ok: false, why: 'failed' };
    const { text } = (await res.json()) as { text?: string };
    return text ? { ok: true, text } : { ok: false, why: 'quiet' };
  } catch {
    return { ok: false, why: 'failed' };
  }
}

function loudness(x: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / x.length);
}

/** Averages each output sample over its stretch of input: enough of a low-pass for speech. */
export function downsample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(x.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(x.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += x[j]!;
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** 16-bit PCM WAV. */
export function wav(samples: Float32Array, rate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}
