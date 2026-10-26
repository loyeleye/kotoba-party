// Text to speech: one fixed voice per host, run offline on our own server. The default engine is VOICEVOX
// (a separate process, usually the voicevox/voicevox_engine Docker image, on port 50021). Lines are voiced from
// their kana reading only, so a kanji is never misread. Audio is kept in an in-memory store the server serves
// to the stage by id; pack and bank lines are rendered once and cached on disk by tools/renderBank.ts.

import { createHash } from 'node:crypto';
import { HOSTS, type HostVoiceConfig } from './hosts.js';
import type { HostId, Logger, ReactionTier } from './types.js';
import { silentLogger } from './types.js';

export interface SpeechRequest {
  host: HostId;
  /** The kana to voice. */
  kana: string;
  tier?: ReactionTier;
  signal?: AbortSignal;
}

export interface Audio {
  id: string;
  mime: string;
  bytes: Uint8Array;
  /** Rough length, for pacing the reveal. */
  ms?: number;
  /** Lip sync: mouth shapes in order, each [shape, ms]. 0 is closed, 1 half open, 2 wide open. */
  mouth?: Mouth;
}

export type Mouth = [0 | 1 | 2, number][];

interface VoicevoxMora {
  consonant?: string | null;
  consonant_length?: number | null;
  vowel: string;
  vowel_length: number;
}
interface VoicevoxQuery {
  accent_phrases?: { moras: VoicevoxMora[]; pause_mora?: VoicevoxMora | null }[];
  speedScale?: number;
  prePhonemeLength?: number;
  postPhonemeLength?: number;
}

/**
 * The mouth track for a VOICEVOX query, from the length of every consonant and vowel it will speak:
 * あ and お open wide, い, う and え half, ん, っ and pauses close. Lips close for p, b and m.
 */
export function mouthTrack(query: VoicevoxQuery): Mouth {
  const speed = query.speedScale || 1;
  const ms = (s: number | null | undefined) => Math.round(((s ?? 0) * 1000) / speed);
  const track: Mouth = [];
  const push = (shape: 0 | 1 | 2, len: number) => {
    if (len <= 0) return;
    const last = track.at(-1);
    if (last && last[0] === shape) last[1] += len;
    else track.push([shape, len]);
  };
  const vowel = (v: string): 0 | 1 | 2 => (v === 'a' || v === 'o' ? 2 : v === 'i' || v === 'u' || v === 'e' ? 1 : 0);
  push(0, ms(query.prePhonemeLength));
  for (const phrase of query.accent_phrases ?? []) {
    for (const m of phrase.moras) {
      if (m.consonant) push(/^[pbm]/.test(m.consonant) ? 0 : 1, ms(m.consonant_length));
      push(vowel(m.vowel.toLowerCase()), ms(m.vowel_length));
    }
    if (phrase.pause_mora) push(0, ms(phrase.pause_mora.vowel_length));
  }
  push(0, ms(query.postPhonemeLength));
  return track;
}

export interface TtsEngine {
  readonly name: string;
  /** Whether the engine is reachable and has a voice for every host. */
  check(): Promise<{ ok: boolean; why?: string }>;
  speak(req: SpeechRequest): Promise<Audio>;
}

/** Same kana, same host, same style → same id, so a repeated line is never synthesised twice. */
export function audioId(engine: string, host: HostId, kana: string, tier?: ReactionTier): string {
  return createHash('sha256').update(`${engine}|${host}|${tier ?? ''}|${kana}`).digest('base64url').slice(0, 22);
}

/** Length of a PCM WAV from its header, or undefined. */
export function wavMs(b: Uint8Array): number | undefined {
  if (b.length < 44 || String.fromCharCode(...b.subarray(0, 4)) !== 'RIFF') return undefined;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const byteRate = v.getUint32(28, true);
  return byteRate ? Math.round(((b.length - 44) / byteRate) * 1000) : undefined;
}

// ---------- VOICEVOX ----------

interface VoicevoxSpeaker {
  name: string;
  styles: { name: string; id: number; type?: string }[];
}

export interface VoicevoxOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  hosts?: Partial<Record<HostId, HostVoiceConfig>>;
  /** 24000 is VOICEVOX's native rate; lower it to shrink files sent to the stage. */
  sampleRate?: number;
  logger?: Logger;
}

/**
 * VOICEVOX's HTTP API: POST /audio_query?text&speaker, then POST /synthesis?speaker with the query, which returns
 * a WAV. Speakers are resolved by name and style through GET /speakers once, then cached.
 */
export class VoicevoxTts implements TtsEngine {
  readonly name = 'voicevox';
  private readonly base: string;
  private readonly fetch: typeof fetch;
  private readonly hosts: Record<HostId, HostVoiceConfig>;
  private styles: Promise<Map<string, number>> | null = null;
  private readonly log: Logger;

  constructor(private readonly opts: VoicevoxOptions = {}) {
    this.base = (opts.baseUrl ?? process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021').replace(/\/$/, '');
    this.fetch = opts.fetch ?? fetch;
    this.hosts = {
      pon: opts.hosts?.pon ?? HOSTS.pon.voice,
      chochin: opts.hosts?.chochin ?? HOSTS.chochin.voice,
      fude: opts.hosts?.fude ?? HOSTS.fude.voice,
    };
    this.log = opts.logger ?? silentLogger;
  }

  private speakerTable(): Promise<Map<string, number>> {
    if (!this.styles) {
      this.styles = (async () => {
        const r = await this.fetch(`${this.base}/speakers`);
        if (!r.ok) throw new Error(`VOICEVOX /speakers: HTTP ${r.status}`);
        const list = (await r.json()) as VoicevoxSpeaker[];
        const map = new Map<string, number>();
        // Speaking styles only ('talk', or 'streaming_talk' on engine 0.2x); singing styles can't read a line.
        for (const s of list) for (const st of s.styles) if (!st.type || /talk$/.test(st.type)) map.set(`${s.name}/${st.name}`, st.id);
        return map;
      })();
      this.styles.catch(() => (this.styles = null));
    }
    return this.styles;
  }

  /** The style id for a host: its first installed voice, with the tier's style when that speaker has one. */
  async styleId(host: HostId, tier?: ReactionTier): Promise<number> {
    const table = await this.speakerTable();
    const cfg = this.hosts[host];
    for (const v of cfg.voices) {
      const tierStyle = tier && v.tierStyle?.[tier];
      const id = (tierStyle ? table.get(`${v.speaker}/${tierStyle}`) : undefined) ?? table.get(`${v.speaker}/${v.style}`);
      if (id !== undefined) return id;
    }
    throw new Error(`VOICEVOX has none of ${host}'s voices: ${cfg.voices.map((v) => v.speaker).join(', ')}`);
  }

  async check(): Promise<{ ok: boolean; why?: string }> {
    try {
      for (const h of Object.keys(this.hosts) as HostId[]) await this.styleId(h);
      return { ok: true };
    } catch (e) {
      return { ok: false, why: String((e as Error).message ?? e) };
    }
  }

  async speak(req: SpeechRequest): Promise<Audio> {
    const speaker = await this.styleId(req.host, req.tier);
    const cfg = this.hosts[req.host];
    const q = await this.fetch(`${this.base}/audio_query?${new URLSearchParams({ text: req.kana, speaker: String(speaker) })}`, {
      method: 'POST',
      signal: req.signal,
    });
    if (!q.ok) throw new Error(`VOICEVOX /audio_query: HTTP ${q.status}`);
    const query = (await q.json()) as Record<string, unknown> & VoicevoxQuery;
    Object.assign(query, {
      speedScale: cfg.speedScale,
      pitchScale: cfg.pitchScale,
      intonationScale: cfg.intonationScale,
      volumeScale: cfg.volumeScale,
      prePhonemeLength: 0.05,
      postPhonemeLength: 0.1,
      ...(this.opts.sampleRate ? { outputSamplingRate: this.opts.sampleRate } : {}),
    });
    const s = await this.fetch(`${this.base}/synthesis?speaker=${speaker}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/wav' },
      body: JSON.stringify(query),
      signal: req.signal,
    });
    if (!s.ok) throw new Error(`VOICEVOX /synthesis: HTTP ${s.status}`);
    const bytes = new Uint8Array(await s.arrayBuffer());
    this.log.info('tts', { host: req.host, chars: req.kana.length, bytes: bytes.length });
    return { id: audioId(this.name, req.host, req.kana, req.tier), mime: 'audio/wav', bytes, ms: wavMs(bytes), mouth: mouthTrack(query) };
  }
}

/** No engine: every line plays as subtitles only. For tests, and for running without VOICEVOX. */
export class SilentTts implements TtsEngine {
  readonly name = 'silent';
  spoken: SpeechRequest[] = [];

  constructor(
    private readonly delayMs = 0,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async check() {
    return { ok: true };
  }

  async speak(req: SpeechRequest): Promise<Audio> {
    this.spoken.push(req);
    if (this.delayMs) await this.wait(this.delayMs);
    if (req.signal?.aborted) throw new Error('aborted');
    return { id: audioId(this.name, req.host, req.kana, req.tier), mime: 'audio/wav', bytes: new Uint8Array(0), ms: 0 };
  }
}

// ---------- Audio store ----------

/**
 * Recent audio by id, for GET /audio/:id on the server. Bounded by total bytes; the oldest go first. Pinned
 * entries (the bank's pre-rendered lines) are never evicted.
 */
export class AudioStore {
  private readonly items = new Map<string, { audio: Audio; pinned: boolean }>();
  private bytes = 0;

  constructor(private readonly maxBytes = 64 * 1024 * 1024) {}

  get(id: string): Audio | undefined {
    const it = this.items.get(id);
    if (!it) return undefined;
    // Refresh recency.
    this.items.delete(id);
    this.items.set(id, it);
    return it.audio;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  put(audio: Audio, pinned = false): void {
    const old = this.items.get(audio.id);
    if (old) {
      this.bytes -= old.audio.bytes.length;
      this.items.delete(audio.id);
    }
    this.items.set(audio.id, { audio, pinned: pinned || !!old?.pinned });
    this.bytes += audio.bytes.length;
    for (const [id, it] of this.items) {
      if (this.bytes <= this.maxBytes) break;
      if (it.pinned) continue;
      this.items.delete(id);
      this.bytes -= it.audio.bytes.length;
    }
  }

  get size(): number {
    return this.items.size;
  }
}
