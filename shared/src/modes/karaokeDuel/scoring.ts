// Karaoke Duel scoring: pure functions, run on the server for every take.
//
//   pronunciation 60%  the recogniser's transcript (read into kana by the server) against the
//                      line's kana, mora by mora, leniently (same-sounding spellings match)
//   pitch         25%  the phone's pitch contour against the melody, by shape only: the
//                      singer's key and octave don't matter, only the ups and downs
//   timing        15%  when the singer came in and how long they sang, against the line
//
// When a phone can't measure pitch the take is scored on pronunciation and timing alone, in
// the same 60:15 proportion (80% / 20%). A take with no words recognised earns no pitch or
// timing credit either (the phone's mic can hear the TV's guide melody), so humming along
// or letting the TV sing never scores.

import type { Level } from '../../../../content/src/types.js';
import { isUtterance, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { noteTimes, splitMorae, type SongLine } from './songs.js';

// ---- tuning ----

export const WEIGHTS = { pron: 0.6, pitch: 0.25, timing: 0.15 } as const;
/** The quiet fallback (typed) earns this share of its pronunciation score, and nothing else. */
export const TYPED_SHARE = 0.5;
/** "I sang it" with no mic and no reading: the honour system, worth a little less than a perfect typed line. */
export const SANG_IT_QUALITY = 30;
/** Mora similarity that already counts as perfect pronunciation, by level (forgiving by design). */
export const PRON_FULL_AT: Record<Level, number> = { kana: 0.8, n5: 0.9, n4: 0.95 };
/** Below this pronunciation, pitch and timing credit shrink in proportion (no words, no tune). */
export const WORDS_GATE = 0.4;
/** Pitch frames are this long; the phone sends one value per frame from the line's first beat. */
export const FRAME_MS = 100;
/** At most this many frames (12 s), more than any line plus slack. */
export const MAX_FRAMES = 120;
/** Contour values are MIDI numbers in this range (about 33 Hz to 4.2 kHz); null is unvoiced. */
export const MIDI_RANGE = [24, 108] as const;
/** Timing numbers from the phone must sit in this window (ms from the line's first beat). */
export const ONSET_RANGE = [-5_000, 15_000] as const;
export const MAX_DUR_MS = 15_000;
/** Within this many semitones of the melody's shape is a perfect note; this far off is zero. */
export const PITCH_FULL_ST = 1;
export const PITCH_ZERO_ST = 4;
/** Fewer than this many sung notes and the pitch can't be judged (counted as not measured). */
export const MIN_PITCHED_NOTES = 2;
/** Coming in within this many ms of the first beat is perfect; this late (or early) is zero. */
export const ONSET_FULL_MS = 250;
export const ONSET_ZERO_MS = 1_500;

// ---- the take a phone sends ----

export interface Take {
  utterance: Utterance;
  /** One MIDI value (or null) per FRAME_MS from the line's first beat; null if pitch wasn't measured. */
  pitch: (number | null)[] | null;
  /** When the singing started, ms from the line's first beat (negative: early). */
  onsetMs: number | null;
  /** How long the singing lasted. */
  durMs: number | null;
  /** How the phone timed it: the mic's loudness, or (no mic analysis) the button hold. */
  timing: 'mic' | 'button' | null;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Checks a take off the wire. Anything malformed is refused outright (a real phone never sends
 * it); the score never has to guard against NaN, huge arrays or odd types.
 */
export function parseTake(raw: Record<string, unknown>): Take | { error: string } {
  const u = raw.utterance;
  if (!isUtterance(u)) return { error: 'bad-utterance' };
  const utterance: Utterance = { via: u.via, text: u.text.slice(0, 120), ...(u.reading !== undefined ? { reading: String(u.reading).slice(0, 240) } : {}) };
  if (u.via === 'tap') return { utterance: { via: 'tap', text: '' }, pitch: null, onsetMs: null, durMs: null, timing: null };
  if (u.via === 'typed') {
    if (!u.text.trim()) return { error: 'empty-answer' };
    return { utterance, pitch: null, onsetMs: null, durMs: null, timing: null };
  }

  let pitch: (number | null)[] | null = null;
  if (raw.pitch !== undefined && raw.pitch !== null) {
    if (!Array.isArray(raw.pitch) || raw.pitch.length > MAX_FRAMES) return { error: 'bad-pitch' };
    pitch = [];
    for (const v of raw.pitch) {
      if (v === null) pitch.push(null);
      else if (finite(v) && v >= MIDI_RANGE[0] && v <= MIDI_RANGE[1]) pitch.push(v);
      else return { error: 'bad-pitch' };
    }
  }
  const { onsetMs, durMs, timing } = raw;
  if (!finite(onsetMs) || onsetMs < ONSET_RANGE[0] || onsetMs > ONSET_RANGE[1]) return { error: 'bad-timing' };
  if (!finite(durMs) || durMs < 0 || durMs > MAX_DUR_MS) return { error: 'bad-timing' };
  if (timing !== 'mic' && timing !== 'button') return { error: 'bad-timing' };
  return { utterance, pitch, onsetMs, durMs, timing };
}

// ---- pronunciation ----

/** Edit distance between two mora lists. */
export function moraDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

/** Morae for comparing: same-sounding spellings collapsed (を/お, づ/ず, long えい/おう, ー). */
export const soundMorae = (kana: string): string[] => splitMorae(soundKey(kana));

/**
 * How much of the line the transcript got, 0–1: one minus the mora edit distance over the
 * line's length. Extra words cost too, but a transcript can't do worse than 0.
 */
export function moraSimilarity(expectedKana: string, heardKana: string): number {
  const want = soundMorae(expectedKana);
  if (!want.length) return 0;
  const got = soundMorae(heardKana);
  if (!got.length) return 0;
  return Math.max(0, 1 - moraDistance(want, got) / want.length);
}

/** Pronunciation score 0–1: similarity, stretched so "close enough for the level" is full marks. */
export function pronScore(line: SongLine, utterance: Utterance, level: Level): { score: number; similarity: number } {
  const similarity = moraSimilarity(line.kana, utteranceReading(utterance));
  return { score: Math.min(1, similarity / PRON_FULL_AT[level]), similarity };
}

// ---- pitch ----

/** Folds a semitone difference into −6…+6, so an octave slip (or a singer an octave down) is no error. */
export function foldOctave(st: number): number {
  const m = (((st % 12) + 12) % 12);
  return m > 6 ? m - 12 : m;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * The sung pitch for each note: the singer's voiced span [onset, onset + dur] is stretched over
 * the line (so a singer who is steady but a little slow or fast still lines up), then each
 * note takes the median of the frames in its share. null where nothing was voiced.
 */
export function sungNotes(line: SongLine, bpm: number, pitch: readonly (number | null)[], onsetMs: number, durMs: number): (number | null)[] {
  const notes = noteTimes(line, bpm);
  const total = notes.reduce((n, x) => Math.max(n, x.startMs + x.ms), 0) || 1;
  const span = durMs > FRAME_MS ? durMs : total;
  const start = Number.isFinite(onsetMs) ? onsetMs : 0;
  return notes.map((n) => {
    const from = start + (n.startMs / total) * span;
    const to = start + ((n.startMs + n.ms) / total) * span;
    const values: number[] = [];
    for (let f = Math.max(0, Math.floor(from / FRAME_MS)); f < pitch.length && f * FRAME_MS < to; f++) {
      const v = pitch[f];
      if (v !== null && v !== undefined) values.push(v);
    }
    return values.length ? median(values) : null;
  });
}

/**
 * Pitch score 0–1 by shape: each sung note minus its melody note, octave-folded; the singer's
 * own key is the median of those differences; each note scores by how far it strays from
 * that key. Notes nobody sang count as zero, so humming two notes of a line can't get full
 * marks. Returns null when there's too little to judge (fewer than 2 sung notes).
 */
export function pitchScore(line: SongLine, bpm: number, pitch: readonly (number | null)[], onsetMs: number, durMs: number): number | null {
  const sung = sungNotes(line, bpm, pitch, onsetMs, durMs);
  const morae = splitMorae(line.kana);
  const pairs: { d: number }[] = [];
  let scored = 0;
  sung.forEach((v, i) => {
    if (morae[i] === 'っ' || morae[i] === 'ッ') return; // a rest
    scored += 1;
    if (v !== null) pairs.push({ d: foldOctave(v - line.melody[i]![0]) });
  });
  if (pairs.length < MIN_PITCHED_NOTES || scored === 0) return null;
  // The singer's key: a circular median would be exact; the median of folded offsets is close
  // enough for melodies that span less than an octave (every v1 song does).
  const key = median(pairs.map((p) => p.d));
  let sum = 0;
  for (const { d } of pairs) {
    const off = Math.abs(foldOctave(d - key));
    sum += Math.max(0, Math.min(1, 1 - (off - PITCH_FULL_ST) / (PITCH_ZERO_ST - PITCH_FULL_ST)));
  }
  return sum / scored;
}

// ---- timing ----

/** Timing score 0–1: 60% coming in on the beat, 40% singing for about the line's length. */
export function timingScore(lineLength: number, onsetMs: number, durMs: number): number {
  const off = Math.abs(onsetMs);
  const start = off <= ONSET_FULL_MS ? 1 : Math.max(0, 1 - (off - ONSET_FULL_MS) / (ONSET_ZERO_MS - ONSET_FULL_MS));
  const r = durMs / Math.max(1, lineLength);
  const length = r >= 0.7 && r <= 1.35 ? 1 : r < 0.7 ? Math.max(0, (r - 0.3) / 0.4) : Math.max(0, 1 - (r - 1.35) / 0.85);
  return 0.6 * start + 0.4 * length;
}

// ---- the whole take ----

export interface TakeScore {
  /** 0–100, rounded. */
  quality: number;
  /** Each part 0–1 (pitch null when it wasn't measured). */
  pron: number;
  pitch: number | null;
  timing: number | null;
  /** Mora similarity before the level stretch (for the phrasebook outcome). */
  similarity: number;
  /** True when pitch counted (25%); false when the take was reweighted to words and timing. */
  pitchUsed: boolean;
}

export function scoreTake(line: SongLine, bpm: number, lineLength: number, take: Take, level: Level): TakeScore {
  if (take.utterance.via === 'tap') return { quality: SANG_IT_QUALITY, pron: 0, pitch: null, timing: null, similarity: 0, pitchUsed: false };
  const { score: pron, similarity } = pronScore(line, take.utterance, level);
  if (take.utterance.via === 'typed') {
    return { quality: Math.round(100 * TYPED_SHARE * pron), pron, pitch: null, timing: null, similarity, pitchUsed: false };
  }
  const gate = Math.min(1, pron / WORDS_GATE);
  const timing = take.onsetMs !== null && take.durMs !== null ? timingScore(lineLength, take.onsetMs, take.durMs) * gate : 0;
  const rawPitch = take.pitch && take.onsetMs !== null && take.durMs !== null ? pitchScore(line, bpm, take.pitch, take.onsetMs, take.durMs) : null;
  // The tracker ran but heard (almost) nothing in tune: that's a 0, not "not measured".
  const pitchMeasured = take.pitch !== null;
  const pitch = pitchMeasured ? (rawPitch ?? 0) * gate : null;
  const total =
    pitch !== null
      ? WEIGHTS.pron * pron + WEIGHTS.pitch * pitch + WEIGHTS.timing * timing
      : (WEIGHTS.pron * pron + WEIGHTS.timing * timing) / (WEIGHTS.pron + WEIGHTS.timing);
  return { quality: Math.round(100 * total), pron, pitch, timing, similarity, pitchUsed: pitch !== null };
}

/**
 * The melody as the frames a perfect singer's phone would send (for bots, tests and the
 * phone's own self-check), optionally shifted by `transpose` semitones.
 */
export function melodyFrames(line: SongLine, bpm: number, transpose = 0): (number | null)[] {
  const notes = noteTimes(line, bpm);
  const morae = splitMorae(line.kana);
  const end = notes.reduce((n, x) => Math.max(n, x.startMs + x.ms), 0);
  const frames: (number | null)[] = [];
  for (let t = 0; t < end && frames.length < MAX_FRAMES; t += FRAME_MS) {
    const mid = t + FRAME_MS / 2;
    const i = notes.findIndex((n) => mid >= n.startMs && mid < n.startMs + n.ms);
    const rest = i < 0 || morae[i] === 'っ' || morae[i] === 'ッ';
    frames.push(rest ? null : notes[i]!.midi + transpose);
  }
  return frames;
}
