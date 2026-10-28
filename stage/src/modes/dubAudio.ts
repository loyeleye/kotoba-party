// Dub Club's voices on the TV: fetches each recorded take from the room (the main TV's token only),
// levels it, and plays it on the voices bus; the character's mouth follows the clip's loudness.
//
// Levelling (the music panel): phones record raw, so a whisper and a shout arrive far apart. Each
// clip is brought to one loudness, clamped to −6…+15 dB so a whisper stays a whisper, then through a
// 100 Hz high-pass (handling noise, table thumps) and the master limiter.

import { audioReady, getSound } from '../sound.js';

export interface ClipSource {
  base: string;
  code: string;
  token: string;
  /** A watching screen: the room never gives it the clips. */
  watch: boolean;
  /** The server's clock now, in epoch ms. */
  serverNow(): number;
}

let source: ClipSource | null = null;
/** Set by main.ts when the stage joins a room. */
export function setClipSource(s: ClipSource | null): void {
  source = s;
  cache.clear();
}

export const clipsHere = (): boolean => !!source && !source.watch;
export const serverNow = (): number => source?.serverNow() ?? Date.now();

interface Clip {
  buffer: AudioBuffer;
  gain: number;
  /** Loudness every FRAME seconds, 0–1, for the lip sync. */
  env: Float32Array;
}

const FRAME = 0.02;
const TARGET_RMS = 0.12;
const cache = new Map<string, Promise<Clip | null>>();

/** Loads a clip once (later calls share the same promise). */
export function loadClip(id: string): Promise<Clip | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetchClip(id);
    cache.set(id, p);
    // Only a handful are ever needed at once: the dub on now and the episode's three.
    while (cache.size > 12) cache.delete(cache.keys().next().value!);
  }
  return p;
}

async function fetchClip(id: string): Promise<Clip | null> {
  const sound = getSound();
  if (!sound || !source || source.watch) return null;
  try {
    const res = await fetch(`${source.base}/api/rooms/${source.code}/clip/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${source.token}` } });
    if (!res.ok) return null;
    const buffer = await sound.ctx.decodeAudioData(await res.arrayBuffer());
    return analyse(buffer);
  } catch {
    return null;
  }
}

/** The envelope, and the gain that brings the voiced part of the clip to the target loudness. */
export function analyse(buffer: AudioBuffer): Clip {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.round(buffer.sampleRate * FRAME));
  const frames = Math.ceil(data.length / step);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const end = Math.min(data.length, (f + 1) * step);
    for (let i = f * step; i < end; i++) sum += data[i]! * data[i]!;
    rms[f] = Math.sqrt(sum / Math.max(1, end - f * step));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  // The voiced frames: louder than a fifth of the loud ones.
  const voiced = sorted.filter((x) => x > loud * 0.2);
  const level = voiced.length ? Math.sqrt(voiced.reduce((t, x) => t + x * x, 0) / voiced.length) : 0;
  const db = level > 0 ? 20 * Math.log10(TARGET_RMS / level) : 0;
  const gain = 10 ** (Math.max(-6, Math.min(15, db)) / 20);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) env[f] = loud > 0 ? Math.min(1, rms[f]! / loud) : 0;
  return { buffer, gain, env };
}

interface Playing {
  key: string;
  node: AudioBufferSourceNode;
  /** AudioContext time the clip's first sample plays. */
  start: number;
  clip: Clip;
}
let playing: Playing | null = null;
const started = new Set<string>();

/**
 * Plays clip `id` once for `key` (a dub's play step), `offsetMs` into it: a screen that redraws, or
 * loads late, joins the clip where the room is rather than starting it again. A negative offset starts
 * it that much later.
 */
export function playClip(id: string, key: string, offsetMs: number): void {
  if (started.has(key)) return;
  started.add(key);
  void loadClip(id).then((clip) => {
    const sound = getSound();
    if (!clip || !sound || !audioReady()) return;
    // Negative: the clip starts that much later (the episode's lead-in).
    const late = offsetMs / 1000;
    if (late >= clip.buffer.duration) return;
    stopClip();
    const ctx = sound.ctx;
    const node = ctx.createBufferSource();
    node.buffer = clip.buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 100;
    const g = ctx.createGain();
    g.gain.value = clip.gain;
    node.connect(hp).connect(g).connect(sound.voices);
    const at = ctx.currentTime + 0.03 + Math.max(0, -late);
    node.start(at, Math.max(0, late));
    playing = { key, node, start: at - Math.max(0, late), clip };
    node.onended = () => {
      if (playing?.node === node) playing = null;
    };
  });
}

export function stopClip(): void {
  try {
    playing?.node.stop();
  } catch {
    // already stopped
  }
  playing = null;
}

/** Forgets which dubs have played (a new phase), so a replay or the episode plays them again. */
export function resetPlayed(keep: (key: string) => boolean = () => false): void {
  for (const k of [...started]) if (!keep(k)) started.delete(k);
}

/** Seconds of the clip on now still to play, or 0. */
export function clipLeft(): number {
  const sound = getSound();
  if (!playing || !sound) return 0;
  return Math.max(0, playing.start + playing.clip.buffer.duration - sound.ctx.currentTime);
}

/**
 * The mouth for the clip on now: 0 closed, 1 half open, 2 open. Read against what the speakers are
 * playing, so the output latency is taken off.
 */
export function mouth(): 0 | 1 | 2 {
  const sound = getSound();
  if (!playing || !sound) return 0;
  const ctx = sound.ctx;
  const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
  const t = ctx.currentTime - latency - playing.start;
  const f = Math.floor(t / FRAME);
  const v = f >= 0 ? (playing.clip.env[f] ?? 0) : 0;
  return v > 0.5 ? 2 : v > 0.18 ? 1 : 0;
}

// The lip sync runs on its own frame loop: the stage redraws only on updates.
let looping = false;
export function startLipSync(): void {
  if (looping || typeof requestAnimationFrame === 'undefined') return;
  looping = true;
  const tick = () => {
    const els = document.querySelectorAll<HTMLElement>('.dub-mouth');
    if (!els.length) {
      looping = false;
      return;
    }
    const m = String(mouth());
    for (const el of els) if (el.dataset.m !== m) el.dataset.m = m;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
