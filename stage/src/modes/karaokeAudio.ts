// Karaoke Duel's backing track: a tiny Web Audio synth, so no audio files are needed. For each
// sing turn it schedules a one-bar count-in (woodblock clicks), a soft bass, light drums and a
// quiet guide melody, all on the server's clock. Each song's style (STYLES) sets the bass
// pattern, the swing, the drums and the guide's sound. Browsers only start audio after a click on
// the page, so the stage shows a "click for music" button until then.

import type { SongStyle } from '../../../shared/src/modes/karaokeDuel/songs.js';
import { getSound, isMuted, onMuteChange } from '../sound.js';

export interface TurnTrack {
  /** Unique per sing turn; scheduling the same key twice does nothing. */
  key: string;
  /** Local epoch ms of the line's first beat. */
  lineAt: number;
  beatMs: number;
  countInBeats: number;
  notes: { startMs: number; ms: number; midi: number }[];
  /** Morae that are rests (small っ). */
  rests: boolean[];
  style: SongStyle;
}

interface Style {
  guide: OscillatorType;
  /** Bass hits in each beat: when (in beats) and how far above the root (semitones). */
  bass: readonly (readonly [at: number, up: number])[];
  bassWave: OscillatorType;
  /** Where the off-beat falls: 0.5 straight, 2/3 swung. */
  swing: number;
  /** Kick on beats 1 and 3, snare (or claps) on 2 and 4, hi-hat on and off the beat. */
  drums: 'none' | 'soft' | 'rock' | 'claps';
  /** A slow wobble on long guide notes (enka's held notes). */
  vibrato: boolean;
}

const STYLES: Record<SongStyle, Style> = {
  nursery: { guide: 'triangle', bass: [[0, 0]], bassWave: 'sine', swing: 0.5, drums: 'none', vibrato: false },
  citypop: { guide: 'sine', bass: [[0, 0], [0.75, 12]], bassWave: 'triangle', swing: 0.5, drums: 'soft', vibrato: false },
  enka: { guide: 'sine', bass: [[0, 0]], bassWave: 'sine', swing: 0.5, drums: 'none', vibrato: true },
  rock: { guide: 'square', bass: [[0, 0], [0.5, 0]], bassWave: 'sawtooth', swing: 0.5, drums: 'rock', vibrato: false },
  izakaya: { guide: 'triangle', bass: [[0, 0], [2 / 3, 7]], bassWave: 'triangle', swing: 2 / 3, drums: 'claps', vibrato: false },
  blues: { guide: 'triangle', bass: [[0, 0], [2 / 3, 7]], bassWave: 'sine', swing: 2 / 3, drums: 'soft', vibrato: false },
};

let scheduledKey = '';
let live: AudioScheduledSourceNode[] = [];

/** Guide melody volume: quiet, so phone mics mostly hear the singer (see the doc's known gaps). */
const GUIDE_GAIN = 0.07;
const BASS_GAIN = 0.12;
const CLICK_GAIN = 0.25;
const DRUM_GAIN = 0.1;

// The context, unlocking and mute are shared with the music (../sound.ts).
export { audioReady, audioSupported, isMuted, setMuted, unlockAudio } from '../sound.js';

function context(): AudioContext | null {
  return getSound()?.ctx ?? null;
}

/** Where the backing track plays: with the music's volume, but never ducked. */
const out = (): AudioNode => getSound()!.backing;

/**
 * How late the speakers are behind the audio clock (TV soundbars can add 100 ms or more). The
 * backing track is scheduled this much early, so it is heard on the server's beat.
 */
export function outputLatencyMs(): number {
  const c = context();
  if (!c || c.state !== 'running') return 0;
  const s = (c as AudioContext & { outputLatency?: number }).outputLatency ?? c.baseLatency;
  return Number.isFinite(s) ? Math.min(500, Math.max(0, s * 1000)) : 0;
}

onMuteChange((muted) => {
  if (muted) stopAll();
});

export function stopAll(): void {
  for (const node of live) {
    try {
      node.stop();
    } catch {
      // already stopped
    }
  }
  live = [];
  scheduledKey = '';
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function tone(c: AudioContext, at: number, dur: number, freq: number, gain: number, type: OscillatorType, vibrato = false): void {
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (vibrato && dur > 0.6) {
    // Hold the note straight, then let it wobble (about a quarter-tone, 5.5 times a second).
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(freq * 0.015, start + Math.min(0.5, dur / 2));
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.1);
    live.push(lfo);
  }
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.015);
  amp.gain.setTargetAtTime(gain * 0.6, start + 0.05, 0.1);
  amp.gain.setTargetAtTime(0, start + Math.max(0.03, dur - 0.04), 0.02);
  osc.connect(amp).connect(out());
  osc.start(start);
  osc.stop(start + dur + 0.1);
  live.push(osc);
}

function click(c: AudioContext, at: number, accent: boolean): void {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1_600 : 1_100, at);
  amp.gain.setValueAtTime(CLICK_GAIN, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
  osc.connect(amp).connect(out());
  osc.start(at);
  osc.stop(at + 0.08);
  live.push(osc);
}

let noise: { ctx: AudioContext; buf: AudioBuffer } | null = null;

/** Half a second of white noise, made once, for the snare, claps and hi-hat. */
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise?.ctx === c) return noise.buf;
  const buf = c.createBuffer(1, Math.round(c.sampleRate / 2), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = { ctx: c, buf };
  return buf;
}

/** A filtered noise burst: hi-hat (high, short), snare or claps (lower, longer). */
function hiss(c: AudioContext, at: number, cutoff: number, len: number, gain: number): void {
  if (at < c.currentTime) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoff;
  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(filter).connect(amp).connect(out());
  src.start(at);
  src.stop(at + len + 0.02);
  live.push(src);
}

/** A short falling sine thump. */
function kick(c: AudioContext, at: number, gain: number): void {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
  osc.connect(amp).connect(out());
  osc.start(at);
  osc.stop(at + 0.17);
  live.push(osc);
}

/** One beat of drums; `n` is the beat's number from the line's first beat (0 = beat 1). */
function drums(c: AudioContext, at: number, n: number, beatS: number, style: Style): void {
  if (style.drums === 'none') return;
  const backbeat = n % 2 === 1;
  const loud = style.drums === 'rock' ? 1.4 : 1;
  if (!backbeat) kick(c, at, DRUM_GAIN * 1.5 * loud);
  else if (style.drums === 'claps') [0, 0.012, 0.025].forEach((d) => hiss(c, at + d, 1_200, 0.08, DRUM_GAIN * 0.7));
  else hiss(c, at, 1_500, style.drums === 'rock' ? 0.16 : 0.07, DRUM_GAIN * (style.drums === 'rock' ? 1.2 : 0.5));
  hiss(c, at, 7_000, 0.03, DRUM_GAIN * 0.35);
  hiss(c, at + style.swing * beatS, 7_000, 0.03, DRUM_GAIN * 0.25);
}

/** Schedules one sing turn's count-in, bass and guide melody. Safe to call on every redraw. */
export function playTurn(track: TurnTrack): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || scheduledKey === track.key) return;
  stopAll();
  scheduledKey = track.key;
  // Local wall-clock ms → AudioContext seconds, early by the speakers' delay, so each click and note
  // is heard on the server's beat (which the phones time the singers against), not scheduled on it.
  const lead = outputLatencyMs();
  const toAudio = (localMs: number) => c.currentTime + (localMs - lead - Date.now()) / 1000;
  const beat = track.beatMs;
  for (let k = 0; k < track.countInBeats; k++) click(c, toAudio(track.lineAt - (track.countInBeats - k) * beat), k === 0);

  const style = STYLES[track.style] ?? STYLES.nursery;
  const end = track.notes.reduce((n, x) => Math.max(n, x.startMs + x.ms), 0);
  // Bass: the melody note sounding on each beat, two octaves down, in the style's pattern. Bright
  // waves play quieter so they sit at the same loudness as a sine.
  const bassGain = style.bassWave === 'sine' ? BASS_GAIN : BASS_GAIN * 0.5;
  for (let t = 0, n = 0; t < end; t += beat, n++) {
    const note = track.notes.find((x) => t >= x.startMs && t < x.startMs + x.ms) ?? track.notes[0];
    style.bass.forEach(([at, up], i) => {
      const len = ((style.bass[i + 1]?.[0] ?? 1) - at) * 0.9;
      if (note) tone(c, toAudio(track.lineAt + t + at * beat), (beat / 1000) * len, hz(note.midi - 24 + up), bassGain, style.bassWave);
    });
    drums(c, toAudio(track.lineAt + t), n, beat / 1000, style);
  }
  const guideGain = style.guide === 'square' ? GUIDE_GAIN * 0.5 : GUIDE_GAIN;
  track.notes.forEach((n, i) => {
    if (track.rests[i]) return;
    tone(c, toAudio(track.lineAt + n.startMs), (n.ms / 1000) * 0.95, hz(n.midi), guideGain, style.guide, style.vibrato);
  });
}

/** A short "ta-da" for the duel result. */
export function fanfare(key: string): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || scheduledKey === key) return;
  stopAll();
  scheduledKey = key;
  const t = c.currentTime + 0.05;
  [60, 64, 67, 72].forEach((m, i) => tone(c, t + i * 0.12, i === 3 ? 0.6 : 0.14, hz(m), 0.12, 'triangle'));
}
