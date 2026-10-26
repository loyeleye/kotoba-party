// Finds the utterances inside a play command's move and fills in their readings. Kept apart from
// reading.ts (which loads the kuromoji dictionary) so the Cloudflare Worker can use it without
// bundling the dictionary; there the readings come from a remote reader instead (cloudflare/reading.ts).

import { hasKanji, isUtterance, type Utterance, type UtteranceToken } from '../../shared/src/japanese/kana.js';

/** Every utterance (any field holding `{ via, text }`) in a move, with any client-set reading removed. */
export function utterancesIn(move: unknown, depth = 0, out: Utterance[] = []): Utterance[] {
  if (depth > 4 || typeof move !== 'object' || move === null) return out;
  for (const value of Object.values(move as Record<string, unknown>)) {
    if (isUtterance(value)) {
      // Clients may not set these themselves.
      delete value.reading;
      delete value.tokens;
      out.push(value);
    } else utterancesIn(value, depth + 1, out);
  }
  return out;
}

/** Whether the rules need a reading for this text (it has kanji or digits). */
export function needsReading(text: string): boolean {
  return hasKanji(text) || /[0-9０-９]/.test(text);
}

/** Applies a reader's answer for one utterance. */
export function setReading(u: Utterance, reading: string, tokens: UtteranceToken[]): void {
  if (needsReading(u.text)) u.reading = reading;
  if (u.text) u.tokens = tokens;
}
