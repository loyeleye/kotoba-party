// Forgiving checks for Who's the Tourist? Questions and answers are free: the check never
// rejects anything. It only decides two kind things:
//   - which known frame (if any) an utterance is, so the stage can show the frame's tidy text
//     and English subtitle instead of a raw transcript, and the phrasebook can record it;
//   - whether the tourist's spoken guess named the place (for the speaking bonus only).
//
// Matching reuses Phrase Bingo's sound keys and tolerant substring distance. A frame only
// counts if it covers most of what was said (so はい！ isn't found inside はいります).

import type { Level } from '../../../../content/src/types.js';
import { normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { phraseKey, substringDistance, tolerance } from '../phraseBingo/check.js';
import type { Line } from './places.js';

/** A frame must cover at least this share (three quarters) of the utterance's sounds. */
export const COVER = 0.75;

/** The readings an utterance can be checked by: the server's reading, then the raw text. */
function readings(u: Utterance): string[] {
  return [...new Set([utteranceReading(u), normalizeReading(u.text)].map(phraseKey).filter(Boolean))];
}

/** How far a heard key is from a line (share of the line's length), or null if it isn't that line. */
function lineScore(heard: string, line: Line, level: Level): number | null {
  let best: number | null = null;
  for (const target of [line.jp.kana, ...(line.accepted ?? [])]) {
    const key = phraseKey(target);
    const len = [...key].length;
    if (!len || len < COVER * [...heard].length) continue;
    const d = heard.includes(key) ? 0 : substringDistance(key, heard);
    if (d <= tolerance(len, level) && (best === null || d / len < best)) best = d / len;
  }
  return best;
}

/** The known line an utterance says, best match first (ties go to the longer line); exact when no edits were needed. */
export function findLine(u: Utterance, lines: readonly Line[], level: Level): { line: Line; exact: boolean } | null {
  let best: { line: Line; score: number; len: number } | null = null;
  for (const heard of readings(u)) {
    for (const line of lines) {
      const score = lineScore(heard, line, level);
      if (score === null) continue;
      const len = [...phraseKey(line.jp.kana)].length;
      if (!best || score < best.score || (score === best.score && len > best.len)) best = { line, score, len };
    }
  }
  return best ? { line: best.line, exact: best.score === 0 } : null;
}

export function matchLine(u: Utterance, lines: readonly Line[], level: Level): Line | null {
  return findLine(u, lines, level)?.line ?? null;
}

/** True if the text has any Japanese in it (kana or kanji). */
export function hasJapanese(text: string): boolean {
  return /[ぁ-ゖァ-ヺ㐀-鿿]/.test(text);
}

/** True if the utterance names the place (anywhere in it: ここは えきですか counts for えき). */
export function namesPlace(u: Utterance, kana: string, accepted: readonly string[] = []): boolean {
  const targets = [kana, ...accepted].map(phraseKey).filter(Boolean);
  return readings(u).some((heard) => targets.some((t) => heard.includes(t) || ([...t].length > 3 && substringDistance(t, heard) <= 1)));
}
