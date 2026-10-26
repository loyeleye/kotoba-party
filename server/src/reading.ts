// Works out kana readings for spoken or typed answers that contain kanji, so the game
// rules can compare readings (三百円 → さんびゃくえん). Runs before a command reaches the room,
// because the room's rules are synchronous and this needs a dictionary.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import kuromoji from 'kuromoji';
import { readNumbers } from '../ai/kana.js';
import { hasKanji, isUtterance, toHiragana } from '../../shared/src/japanese/kana.js';

import type { UtteranceToken } from '../../shared/src/japanese/kana.js';

export interface Reader {
  (text: string): string;
  tokens(text: string): UtteranceToken[];
}

/** Loads the morphological dictionary (about half a second). Resolves to null if it fails. */
export async function createReader(): Promise<Reader | null> {
  try {
    const require = createRequire(import.meta.url);
    const dicPath = join(dirname(require.resolve('kuromoji/package.json')), 'dict');
    const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) =>
      kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))),
    );
    const tokens = (text: string): UtteranceToken[] =>
      tokenizer.tokenize(text).map((t) => ({
        surface: t.surface_form,
        reading: toHiragana(t.reading && t.reading !== '*' ? t.reading : t.surface_form),
        pos: t.pos,
        known: t.word_type === 'KNOWN',
      }));
    // Numbers first (三百五十円 → さんびゃくごじゅうえん, with sound changes), then the dictionary.
    const reader = ((text: string) =>
      tokens(readNumbers(text))
        .map((t) => t.reading)
        .join('')) as Reader;
    reader.tokens = tokens;
    return reader;
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
      delete value.tokens;
      if (reader && (hasKanji(value.text) || /[0-9０-９]/.test(value.text))) value.reading = reader(value.text);
      if (reader && value.text) value.tokens = reader.tokens(value.text);
    } else addReadings(value, reader, depth + 1);
  }
}
