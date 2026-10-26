// Did the actor say their secret phrase? A forgiving check, because the phrase is said in the
// middle of a scene: the transcript may carry extra words before or after it ("えっと、おいしい！
// ですね"), and the most fun-killing failure is marking a correct beginner wrong.
//
// Both sides are compared as sound keys (kana, long vowels and じ/ぢ, ず/づ, お/を folded, see
// soundKey) with は / へ / を also read as わ / え / お. A phrase counts when it appears in the
// transcript, or when some stretch of the transcript is within a few kana edits of it
// (about one edit per five kana, one per four at the Kana level; none for phrases of three kana
// or fewer). This leans towards accepting, as the design doc asks; a near miss is never a loss.

import type { Level } from '../../../../content/src/types.js';
import { normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';

/** The sound key with particles read as they sound (は→わ, へ→え, を→お). */
export function phraseKey(text: string): string {
  return soundKey(text).replace(/は/g, 'わ').replace(/へ/g, 'え').replace(/を/g, 'お');
}

/** Edits a phrase of this many kana may be off by. */
export function tolerance(length: number, level: Level): number {
  if (length <= 3) return 0;
  return Math.max(1, Math.floor(length / (level === 'kana' ? 4 : 5)));
}

/**
 * The fewest edits (insert, delete, substitute) that turn `needle` into some substring of
 * `hay`. Semi-global alignment: free to start and end anywhere in `hay`.
 */
export function substringDistance(needle: string, hay: string): number {
  const n = [...needle];
  const h = [...hay];
  if (!n.length) return 0;
  let prev = new Array<number>(h.length + 1).fill(0);
  for (let i = 1; i <= n.length; i++) {
    const cur = new Array<number>(h.length + 1);
    cur[0] = i;
    for (let j = 1; j <= h.length; j++) {
      const sub = prev[j - 1]! + (n[i - 1] === h[j - 1] ? 0 : 1);
      cur[j] = Math.min(sub, prev[j]! + 1, cur[j - 1]! + 1);
    }
    prev = cur;
  }
  return Math.min(...prev);
}

/**
 * How far `heard` (a reading or raw text) is from containing one of `targets` (kana readings),
 * as a share of the target's length: 0 when it is in there exactly. Null when no target is
 * within tolerance.
 */
export function heardScore(heard: string, targets: readonly string[], level: Level): number | null {
  const h = phraseKey(heard);
  if (!h) return null;
  let best: number | null = null;
  for (const target of targets) {
    const k = phraseKey(target);
    if (!k) continue;
    const len = [...k].length;
    const d = h.includes(k) ? 0 : substringDistance(k, h);
    if (d <= tolerance(len, level) && (best === null || d / len < best)) best = d / len;
  }
  return best;
}

/** Scores an utterance against one phrase: the server's reading and the raw text, best of both. */
export function phraseScore(u: Utterance, kana: string, accepted: readonly string[] | undefined, level: Level): number | null {
  const targets = [kana, ...(accepted ?? [])];
  let best: number | null = null;
  for (const c of new Set([utteranceReading(u), normalizeReading(u.text)])) {
    const s = c ? heardScore(c, targets, level) : null;
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

/** True if the utterance carries the phrase (see phraseScore). */
export function saidPhrase(u: Utterance, kana: string, accepted: readonly string[] | undefined, level: Level): boolean {
  return phraseScore(u, kana, accepted, level) !== null;
}
