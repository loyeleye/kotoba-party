// Pitch tracking for the phone, kept pure so it can be tested without a browser: an
// autocorrelation pitch detector for one buffer of mic samples, and the step that turns a
// take's samples into what the phone sends (a capped contour, onset and duration).

import { FRAME_MS, MAX_FRAMES, MIDI_RANGE } from './scoring.js';

/** Singing voices sit roughly here (a low bass to a high soprano). */
export const MIN_HZ = 70;
export const MAX_HZ = 1_100;
/** A buffer quieter than this (RMS of −1…1 samples) is silence. */
export const SILENCE_RMS = 0.01;

export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export function rms(buf: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
  return Math.sqrt(sum / Math.max(1, buf.length));
}

/**
 * The fundamental frequency of one buffer by normalised autocorrelation, or null for silence
 * or noise. `clarity` is the correlation at the chosen lag (1 = a perfectly periodic signal).
 */
export function detectPitch(buf: ArrayLike<number>, sampleRate: number, minClarity = 0.8): { hz: number; clarity: number } | null {
  const n = buf.length;
  if (n < 64 || rms(buf) < SILENCE_RMS) return null;
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(n >> 1, Math.ceil(sampleRate / MIN_HZ));
  const corr = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1 && lag < n; lag++) {
    let sum = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = buf[i]!;
      const b = buf[i + lag]!;
      sum += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    corr[lag] = e1 && e2 ? sum / Math.sqrt(e1 * e2) : 0;
  }
  // The first peak that comes close to the best one: picks the fundamental, not a multiple of it.
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) best = Math.max(best, corr[lag]!);
  if (best < minClarity) return null;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const c = corr[lag]!;
    if (c >= best * 0.9 && c >= corr[lag - 1]! && c >= corr[lag + 1]!) {
      // Parabolic interpolation around the peak for sub-sample accuracy.
      const a = corr[lag - 1]!;
      const b = c;
      const d = corr[lag + 1]!;
      const denom = a - 2 * b + d;
      const shift = denom ? (0.5 * (a - d)) / denom : 0;
      const hz = sampleRate / (lag + Math.max(-0.5, Math.min(0.5, shift)));
      return hz >= MIN_HZ && hz <= MAX_HZ ? { hz, clarity: c } : null;
    }
  }
  return null;
}

/** One reading from the mic while the button is held, `t` in ms from the line's first beat. */
export interface PitchSample {
  t: number;
  rms: number;
  /** MIDI value, or null when unvoiced. */
  midi: number | null;
}

/**
 * Turns a take's samples into the contour, onset and duration the phone sends. Loudness above
 * the room's noise floor marks singing; the contour has one MIDI value (the median of voiced
 * samples) per frame from the line's first beat, capped at MAX_FRAMES, rounded to 0.1.
 */
export function summarise(samples: readonly PitchSample[]): { pitch: (number | null)[]; onsetMs: number | null; durMs: number | null } {
  const ordered = [...samples].filter((s) => Number.isFinite(s.t) && Number.isFinite(s.rms)).sort((a, b) => a.t - b.t);
  if (!ordered.length) return { pitch: [], onsetMs: null, durMs: null };
  const levels = ordered.map((s) => s.rms).sort((a, b) => a - b);
  const floor = levels[Math.floor(levels.length * 0.2)] ?? 0;
  const loud = Math.max(SILENCE_RMS * 1.5, floor * 2.5);
  const voiced = ordered.filter((s) => s.rms >= loud);
  const onsetMs = voiced.length ? Math.round(voiced[0]!.t) : null;
  const durMs = voiced.length ? Math.round(voiced[voiced.length - 1]!.t - voiced[0]!.t) : null;

  const last = ordered[ordered.length - 1]!.t;
  const frames = Math.max(0, Math.min(MAX_FRAMES, Math.ceil((last + 1) / FRAME_MS)));
  const pitch: (number | null)[] = [];
  for (let f = 0; f < frames; f++) {
    const inFrame = ordered.filter((s) => s.t >= f * FRAME_MS && s.t < (f + 1) * FRAME_MS && s.midi !== null && s.rms >= loud).map((s) => s.midi!);
    if (!inFrame.length) {
      pitch.push(null);
      continue;
    }
    inFrame.sort((a, b) => a - b);
    const m = inFrame[inFrame.length >> 1]!;
    pitch.push(m >= MIDI_RANGE[0] && m <= MIDI_RANGE[1] ? Math.round(m * 10) / 10 : null);
  }
  return { pitch, onsetMs, durMs };
}
