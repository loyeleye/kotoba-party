// Sound effects: short synthesised cues on the stage's effects bus (the sound effects volume).
// No files: each one is a few oscillators or a burst of noise, so they load instantly and nobody
// else owns them. They stay short and mostly above or below the speech band, because phones may
// be listening while they play.
//
// The room-wide ones (a player joining, a new round, the last seconds ticking, points going up)
// come from watching the view (watchSfx); modes add their own right and wrong moments with sfx().

import type { RoomView } from '../../../shared/src/protocol.js';
import { audioReady, getSound, silent } from '../sound.js';
import { speaks } from './cues.js';

export type SfxId =
  | 'tap' | 'join' | 'round' | 'tick' | 'tock' | 'right' | 'wrong' | 'hit'
  // Bento Haus: the shop's own noises.
  | 'ring' | 'ticket' | 'send' | 'serve' | 'toss' | 'leave' | 'static' | 'poof' | 'munch' | 'lastorder';

/** The same effect twice within this many ms plays once (several screens of state arrive together). */
const MIN_GAP_MS: Partial<Record<SfxId, number>> = { right: 250, wrong: 250, hit: 70, tick: 500, join: 150, ring: 600, ticket: 150, send: 150, serve: 300, toss: 150, leave: 400, static: 400 };
const lastAt: Partial<Record<SfxId, number>> = {};

/** Plays one effect now (or `delay` seconds from now). Silent until audio is unlocked, and when muted. */
export function sfx(id: SfxId, delay = 0): void {
  const sound = getSound();
  if (!sound || !audioReady() || silent()) return;
  const nowMs = performance.now();
  if (nowMs - (lastAt[id] ?? -1e9) < (MIN_GAP_MS[id] ?? 0)) return;
  lastAt[id] = nowMs;
  const ctx = sound.ctx;
  const t = ctx.currentTime + 0.01 + delay;
  const out = sound.sfx;
  switch (id) {
    case 'tap':
      return blip(ctx, out, t, 'triangle', 1400, 1100, 0.05, 0.18);
    case 'join':
      // A bubbly two-note pop, rising.
      blip(ctx, out, t, 'sine', 660, 990, 0.09, 0.3);
      return blip(ctx, out, t + 0.07, 'sine', 990, 1320, 0.1, 0.25);
    case 'round':
      // A soft upward swish for a new round.
      return swish(ctx, out, t, 0.45, 600, 5000, 0.16);
    case 'tick':
      return woodblock(ctx, out, t, 1900, 0.16);
    case 'tock':
      return woodblock(ctx, out, t, 1250, 0.22);
    case 'right':
      // A bright major-third chime.
      bell(ctx, out, t, 1046.5, 0.5, 0.22);
      return bell(ctx, out, t + 0.09, 1318.5, 0.6, 0.2);
    case 'wrong':
      // A low, short "bwomp": below the speech band, so it never masks a word.
      return blip(ctx, out, t, 'sawtooth', 180, 110, 0.32, 0.16, 900);
    case 'hit':
      swish(ctx, out, t, 0.12, 3000, 800, 0.12);
      return blip(ctx, out, t, 'square', 520, 260, 0.08, 0.1, 2400);
    case 'ring':
      // A phone's trill, quiet: two short bursts alternating 940 and 1180 Hz.
      for (let i = 0; i < 8; i++) blip(ctx, out, t + i * 0.045 + (i >= 4 ? 0.12 : 0), 'square', i % 2 ? 1180 : 940, i % 2 ? 1180 : 940, 0.04, 0.05, 3000);
      return;
    case 'ticket':
      // A ticket printing: a quick paper tick.
      return woodblock(ctx, out, t, 2400, 0.12);
    case 'send':
      return blip(ctx, out, t, 'triangle', 700, 1400, 0.09, 0.14);
    case 'serve':
      // The counter bell.
      return bell(ctx, out, t, 2093, 0.9, 0.18);
    case 'toss':
      return swish(ctx, out, t, 0.18, 2500, 400, 0.1);
    case 'leave':
      // A customer gives up: a sigh downwards, under the speech band.
      return blip(ctx, out, t, 'sine', 330, 160, 0.45, 0.16, 1200);
    case 'static':
      return swish(ctx, out, t, 0.3, 6000, 5000, 0.06);
    case 'poof':
      // Pon's disguise: ドロン.
      swish(ctx, out, t, 0.35, 400, 3000, 0.14);
      return blip(ctx, out, t + 0.1, 'sine', 300, 600, 0.2, 0.12);
    case 'munch':
      for (let i = 0; i < 3; i++) blip(ctx, out, t + i * 0.13, 'square', 240, 160, 0.06, 0.08, 900);
      return;
    case 'lastorder':
      // ラストオーダー: a two-note chime, G5 then E5.
      bell(ctx, out, t, 784, 0.6, 0.18);
      return bell(ctx, out, t + 0.28, 659.3, 0.8, 0.18);
  }
}

/** Semitones of the major scale, an octave up to the tonic. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Narabete!'s flip, after the card starts to turn: the bell as its face shows, the bwomp as a knot ties. */
export const FLIP_FACE_MS = 300;
export const FLIP_KNOT_MS = 650;

/**
 * One card of Narabete!'s flip, `delay` seconds from now: a bell one step up the theme's major scale,
 * counted so the last of `cards` lands on the tonic (the playing track's key, `tonic` as MIDI). A
 * card that ties a knot bends its note down a semitone, with a "bwomp" as the knot appears.
 */
export function flipNote(step: number, cards: number, delay: number, knot: boolean, tonic: number): void {
  const sound = getSound();
  if (!sound || !audioReady() || silent()) return;
  const t = sound.ctx.currentTime + 0.01 + delay;
  const idx = Math.max(0, Math.min(MAJOR.length - 1, MAJOR.length - Math.min(cards, MAJOR.length) + step));
  const f = midiHz(tonic - 12 + MAJOR[idx]!);
  const at = t + FLIP_FACE_MS / 1000;
  if (knot) {
    blip(sound.ctx, sound.sfx, at, 'sine', f, f * 0.944, 0.45, 0.2);
    blip(sound.ctx, sound.sfx, t + FLIP_KNOT_MS / 1000, 'sawtooth', 330, 150, 0.3, 0.22, 1400);
  } else bell(sound.ctx, sound.sfx, at, f, 0.45, 0.2);
}

/** Bento Haus tips: one bell per tip, up the theme's major scale from its tonic. */
export function tipBells(tips: number, delay: number, tonic: number): void {
  const sound = getSound();
  if (!sound || !audioReady() || silent()) return;
  const t = sound.ctx.currentTime + 0.01 + delay;
  for (let i = 0; i < tips; i++) bell(sound.ctx, sound.sfx, t + i * 0.1, midiHz(tonic + [0, 4, 7, 12][Math.min(3, i)]!), 0.5, 0.16);
}

/** A perfect line: the tonic chord, strummed. */
export function flipChord(delay: number, tonic: number): void {
  const sound = getSound();
  if (!sound || !audioReady() || silent()) return;
  const t = sound.ctx.currentTime + 0.01 + delay;
  [0, 4, 7, 12].forEach((n, i) => bell(sound.ctx, sound.sfx, t + i * 0.06, midiHz(tonic - 12 + n), 1.1, 0.16));
}

function envGain(ctx: AudioContext, out: AudioNode, t: number, dur: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  return g;
}

function blip(ctx: AudioContext, out: AudioNode, t: number, type: OscillatorType, from: number, to: number, dur: number, peak: number, cutoff?: number): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = envGain(ctx, out, t, dur, peak);
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f).connect(g);
  } else o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function bell(ctx: AudioContext, out: AudioNode, t: number, freq: number, dur: number, peak: number): void {
  // A sine with a quiet inharmonic partial: reads as a small bell.
  blip(ctx, out, t, 'sine', freq, freq, dur, peak);
  blip(ctx, out, t, 'sine', freq * 2.76, freq * 2.76, dur * 0.4, peak * 0.25);
}

function woodblock(ctx: AudioContext, out: AudioNode, t: number, freq: number, peak: number): void {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 8;
  o.connect(f).connect(envGain(ctx, out, t, 0.06, peak));
  o.start(t);
  o.stop(t + 0.08);
}

let noise: AudioBuffer | null = null;
function swish(ctx: AudioContext, out: AudioNode, t: number, dur: number, from: number, to: number, peak: number): void {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// ---- the room-wide effects, from the view ----

let seen: { players: number; phaseSeq: number; phase: string; scores: Map<string, number> } | null = null;
let tickedSecond = -1;

/** Call on every render: plays the effects that any game shares. */
export function watchSfx(view: RoomView): void {
  const scores = new Map(view.players.map((p) => [p.id, p.score]));
  const prev = seen;
  seen = { players: view.players.length, phaseSeq: view.phaseSeq, phase: view.phase, scores };
  if (!prev) return;
  if (view.phase === 'lobby' && view.players.length > prev.players) sfx('join');
  if (view.phaseSeq !== prev.phaseSeq) {
    tickedSecond = -1;
    // (A game's start has the house ident in the music instead.)
    if (view.phase === 'prompt') sfx('round');
  }
  // Points going up: one chime, however many players scored at once.
  // (Bento Haus rings its own bells for the stars at closing time.)
  if (view.phase !== 'lobby' && view.mode !== 'bento-haus' && [...scores].some(([id, s]) => s > (prev.scores.get(id) ?? s))) sfx('right');
}

/** Call about once a second with the time left: ticks through the last five seconds. */
export function tickSfx(view: RoomView | null, leftMs: number | null): void {
  if (!view || leftMs === null || leftMs <= 0 || leftMs > 5_000) return;
  // Not while players are speaking into their phones.
  if (view.phase === 'lobby' || speaks(view.mode, view.phase)) return;
  const second = Math.ceil(leftMs / 1000);
  if (second === tickedSecond) return;
  tickedSecond = second;
  sfx(second === 1 ? 'tock' : 'tick');
}
