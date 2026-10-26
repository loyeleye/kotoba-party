// Works out kana readings for spoken or typed answers that contain kanji, so the game
// rules can compare readings (三百円 → さんびゃくえん). Runs before a command reaches the room,
// because the room's rules are synchronous and this needs a dictionary.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import kuromoji from 'kuromoji';
import { hasKanji, isUtterance, toHiragana } from '../../shared/src/japanese/kana.js';

export type Reader = (text: string) => string;

/** Loads the morphological dictionary (about half a second). Resolves to null if it fails. */
export async function createReader(): Promise<Reader | null> {
  try {
    const require = createRequire(import.meta.url);
    const dicPath = join(dirname(require.resolve('kuromoji/package.json')), 'dict');
    const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) =>
      kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))),
    );
    return (text) =>
      tokenizer
        .tokenize(text)
        .map((t) => toHiragana(t.reading && t.reading !== '*' ? t.reading : t.surface_form))
        .join('');
  } catch (err) {
    console.warn('kana reader unavailable; kanji answers will be compared as written', err);
    return null;
  }
}

/**
 * Adds `reading` to every utterance inside a play command's move (any field holding
 * `{ via, text }`). Clients may not set `reading` themselves.
 */
export function addReadings(move: unknown, reader: Reader | null, depth = 0): void {
  if (depth > 4 || typeof move !== 'object' || move === null) return;
  for (const value of Object.values(move as Record<string, unknown>)) {
    if (isUtterance(value)) {
      delete value.reading;
      if (reader && hasKanji(value.text)) value.reading = reader(value.text);
    } else addReadings(value, reader, depth + 1);
  }
}
