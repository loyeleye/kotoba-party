// Synthetic handwriting for bots and tests: a reference kana redrawn the way a hand on a
// phone might: moved, resized, slightly tilted, wobbly, with uneven point spacing.

import type { InkPoint, InkStroke } from '../../shared/src/japanese/strokes.js';
import { resample } from '../../shared/src/japanese/strokes.js';

export interface HandOptions {
  /** Point wobble, in canvas units (default 0.02). */
  wobble?: number;
  /** Reverse this stroke (0-based). */
  reverse?: number;
  /** Swap these two strokes' order. */
  swap?: [number, number];
}

const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;

/** Redraws `strokes` by "hand", deterministic for a given random source. */
export function handDraw(strokes: readonly InkStroke[], random: () => number, opts: HandOptions = {}): InkPoint[][] {
  const wobble = opts.wobble ?? 0.02;
  const scale = 0.65 + 0.3 * random();
  const tilt = (random() - 0.5) * 0.12;
  const [ox, oy] = [(1 - scale) * random(), (1 - scale) * random()];
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  let out = strokes.map((s, i) => {
    const pts = resample(s, 6 + Math.floor(random() * 14));
    const drawn = pts.map(([x, y]): InkPoint => {
      const [cx, cy] = [x - 0.5, y - 0.5];
      const [rx, ry] = [cx * cos - cy * sin + 0.5, cx * sin + cy * cos + 0.5];
      return [clamp(ox + rx * scale + (random() - 0.5) * 2 * wobble), clamp(oy + ry * scale + (random() - 0.5) * 2 * wobble)];
    });
    return i === opts.reverse ? drawn.reverse() : drawn;
  });
  if (opts.swap) {
    const [i, j] = opts.swap;
    out = [...out];
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A scribble: zigzags all over the box. */
export function scribble(random: () => number, strokes = 3): InkPoint[][] {
  return Array.from({ length: strokes }, () => Array.from({ length: 30 }, (): InkPoint => [clamp(random()), clamp(random())]));
}
