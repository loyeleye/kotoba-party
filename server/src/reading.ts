// Works out kana readings for spoken or typed answers that contain kanji, so the game
// rules can compare readings (三百円 → さんびゃくえん). Runs before a command reaches the room,
// because the room's rules are synchronous and this needs a dictionary.

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import kuromoji from 'kuromoji';
import { readNumbers } from '../ai/kana.js';
import { toHiragana } from '../../shared/src/japanese/kana.js';
import { setReading, utterancesIn } from './utterances.js';

import type { UtteranceToken } from '../../shared/src/japanese/kana.js';

/** Words the dictionary reads wrong for us (IPADIC reads 出口 alone as いでぐち). */
const READING_FIXES: Record<string, string> = { 出口: 'でぐち' };

/**
 * IPADIC reads 行っ (te/ta form) as 行う, おこなっ: 一人で 行っても いいですか comes out ひとりで おこなっても.
 * In speech that is nearly always 行く, いっ. Keep おこなっ only where 行う really fits: after an object
 * (会議を 行った). 行います and 行われる are other forms and are left alone.
 */
function ikuNotOkonau(toks: UtteranceToken[]): UtteranceToken[] {
  let prev: UtteranceToken | undefined;
  for (const t of toks) {
    if (t.surface === '行っ' && t.base === '行う' && t.cform === '連用タ接続' && !(prev?.pos === '助詞' && prev.surface === 'を')) {
      Object.assign(t, { reading: 'いっ', base: '行く', ctype: '五段・カ行促音便' });
    }
    if (t.pos !== '記号' && t.surface.trim()) prev = t;
  }
  return toks;
}

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
      ikuNotOkonau(
        tokenizer.tokenize(text).map((t) => ({
          surface: t.surface_form,
          reading: READING_FIXES[t.surface_form] ?? toHiragana(t.reading && t.reading !== '*' ? t.reading : t.surface_form),
          pos: t.pos,
          known: t.word_type === 'KNOWN',
          detail: `${t.pos_detail_1},${t.pos_detail_2}`,
          base: t.basic_form,
          ctype: t.conjugated_type,
          cform: t.conjugated_form,
        })),
      );
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
export function addReadings(move: unknown, reader: Reader | null): void {
  for (const u of utterancesIn(move)) {
    if (reader && u.text) setReading(u, reader(u.text), reader.tokens(u.text));
  }
}
