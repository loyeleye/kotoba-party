// Oekaki drawings on the wire: Ink Storm's stroke format (shared/src/japanese/strokes.ts) with
// larger limits for free drawing, plus a palette index per stroke. Everything is checked hard
// on the server: a phone can send anything.

import { readInk, type InkLimits, type InkPoint } from '../../japanese/strokes.js';
import { isObject } from '../mode.js';

/**
 * Free-drawing limits. Sized so the biggest drawing fits a play command (the server takes 16 KB
 * bodies; 720 points at 3 decimals is about 10 KB) and stays small in the stage's view.
 */
export const OEKAKI_LIMITS: InkLimits = { strokes: 48, points: 96, total: 720 };

/** The phone's colours, by index. Ink first (the default). The server only ever sees indexes. */
export const PALETTE = ['#1b1712', '#d64541', '#2f6fd6', '#2e9e5b', '#f2a516', '#8e5bd6'] as const;

/** Less ink than this (total stroke length, as a share of the pad) is a tap, not a drawing. */
export const MIN_INK = 0.05;

export interface Drawing {
  strokes: InkPoint[][];
  /** Palette index per stroke. */
  colors: number[];
}

const inkLength = (strokes: readonly (readonly InkPoint[])[]): number => {
  let n = 0;
  for (const s of strokes) for (let i = 1; i < s.length; i++) n += Math.hypot(s[i]![0] - s[i - 1]![0], s[i]![1] - s[i - 1]![1]);
  return n;
};

/**
 * Reads `{ strokes, colors }` off the wire. Strokes go through `readInk` with the free-drawing
 * limits; `colors` (optional, all ink if left out) must hold one palette index per stroke.
 * Returns null for anything malformed, over the limits, or too small to be a drawing.
 */
export function readDrawing(raw: unknown): Drawing | null {
  if (!isObject(raw)) return null;
  const strokes = readInk(raw.strokes, OEKAKI_LIMITS);
  if (!strokes) return null;
  let colors: number[];
  if (raw.colors === undefined) colors = strokes.map(() => 0);
  else {
    if (!Array.isArray(raw.colors) || raw.colors.length !== strokes.length) return null;
    if (!raw.colors.every((c) => Number.isInteger(c) && c >= 0 && c < PALETTE.length)) return null;
    colors = raw.colors as number[];
  }
  if (inkLength(strokes) < MIN_INK) return null;
  return { strokes, colors: [...colors] };
}
