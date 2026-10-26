// Cross-checks every kana reading in content/ against the kuromoji dictionary.
//
//   npm run content:readings
//
// Prints each JpText whose dictionary reading differs from the hand-written
// one. A mismatch is a prompt to look, not proof of an error: the tokenizer
// reads numbers digit by digit (三百 → さんひゃく) and can't know context
// (一日 is ついたち in a date), so a human decides each case.

import { createRequire } from 'node:module';
import path from 'node:path';
import kuromoji from 'kuromoji';
import * as content from '../content/src/index.js';
import { collectJpTexts, stripForCompare, toHiragana } from '../content/lint.js';

const require = createRequire(import.meta.url);
const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');

const hasKanji = (s: string) => /[一-鿿々]/.test(s);

const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) =>
  kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))),
);

const seen = new Set<string>();
let checked = 0;
const mismatches: string[] = [];
for (const { path: where, jp } of collectJpTexts(content)) {
  if (!hasKanji(jp.text)) continue;
  const key = `${jp.text}|${jp.kana}`;
  if (seen.has(key)) continue;
  seen.add(key);
  checked++;
  const text = stripForCompare(jp.text);
  const dict = tokenizer
    .tokenize(text)
    .map((t) => (t.reading && t.reading !== '*' ? t.reading : t.surface_form))
    .join('');
  const ours = toHiragana(stripForCompare(jp.kana));
  if (toHiragana(dict) !== ours) mismatches.push(`${where}\n    text: ${jp.text}\n    ours: ${ours}\n    dict: ${toHiragana(dict)}`);
}

console.log(mismatches.join('\n'));
console.log(`\n${checked} kanji texts checked, ${mismatches.length} to review by hand.`);
