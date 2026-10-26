// Works out where the words are in every kana reading in content/, so the かな level's romaji
// can be spaced by word ("Sandoitchi wa yonhyaku-en", not "sandoitchihayonhyakuen").
//
//   npm run content:romaji             # rewrite the table
//   npm run content:romaji -- --check  # fail if the table is out of date (the tests run this)
//
// Writes shared/src/japanese/wordBreaks.ts. Run it after adding or changing content; a reading it
// doesn't know still gets romaji, spaced by a simpler guess (shared/src/japanese/romaji.ts).
//
// The dictionary (kuromoji) splits the written text (with kanji, where it is reliable) and the
// split is mapped onto the hand-written kana. Particles and です/だ become words of their own,
// endings (ます, た, ない, て) stay on their word, and さん, ちゃん, くん and 円 join with a
// hyphen. For text written all in kana the dictionary guesses less well, so only a particle or
// copula at the end of a spaced chunk (and a name suffix) is split off.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import kuromoji from 'kuromoji';
import * as content from '../content/src/index.js';
import { collectJpTexts } from '../content/lint.js';
import { breakKey } from '../shared/src/japanese/romaji.js';
import { hasKanji, toHiragana } from '../shared/src/japanese/kana.js';

type Token = kuromoji.IpadicFeatures;

const require = createRequire(import.meta.url);
const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
const tokenizer = await new Promise<kuromoji.Tokenizer<Token>>((resolve, reject) => kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))));

/** Characters that are never part of a word: spaces, punctuation, the blank. */
const SKIP = /[\s　、。，．！？!?「」『』（）()・…〜~＿_,.:：;；"'“”‘’\-—]/;
const HYPHEN = new Set(['さん', 'ちゃん', 'くん', 'さま', '様', '君', '円']);
const COPULA = new Set(['です', 'だ']);
const COMMON_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'の', 'から', 'まで', 'より', 'や', 'か', 'ね', 'よ']);

const isPunct = (t: Token) => t.pos === '記号' || SKIP.test(t.surface_form);
const readingOf = (t: Token) => toHiragana(t.reading && t.reading !== '*' ? t.reading : t.surface_form);

/** How a token joins the word before it: a new word, glued on, or glued with a hyphen. */
function joinOf(t: Token, prev: Token | undefined): 'new' | 'glue' | 'hyphen' {
  if (!prev || isPunct(prev)) return 'new';
  if (prev.pos === '接頭詞') return 'glue';
  switch (t.pos) {
    case '助詞':
      return t.pos_detail_1 === '接続助詞' && ['て', 'で', 'ば'].includes(t.surface_form) ? 'glue' : 'new';
    case '助動詞':
      return COPULA.has(t.basic_form) && !(prev.pos === '助動詞' && COPULA.has(prev.basic_form)) ? 'new' : 'glue';
    case '動詞':
      return t.pos_detail_1 === '接尾' ? 'glue' : 'new';
    case '形容詞':
      return t.pos_detail_1 === '接尾' || t.pos_detail_1 === '非自立' ? 'glue' : 'new';
    case '名詞':
      if (t.pos_detail_1 === '接尾') return HYPHEN.has(t.surface_form) ? 'hyphen' : 'glue';
      if (t.pos_detail_1 === '数' && prev.pos === '名詞' && prev.pos_detail_1 === '数') return 'glue';
      return 'new';
    default:
      return 'new';
  }
}

/** Maps each token onto the kana: [start, end) indices, or null if they can't be lined up. */
function align(tokens: Token[], kana: string): ([number, number] | null)[] | null {
  const spans: ([number, number] | null)[] = [];
  let p = 0;
  const skip = () => {
    while (p < kana.length && SKIP.test(kana[p]!)) p++;
  };
  /** Kana index after matching `r` from `from` (skipping spaces), or -1. */
  const match = (r: string, from: number): number => {
    let i = from;
    for (const ch of r) {
      while (i < kana.length && SKIP.test(kana[i]!) && !SKIP.test(ch)) i++;
      if (i >= kana.length || toHiragana(kana[i]!) !== ch) return -1;
      i++;
    }
    return i;
  };
  for (let j = 0; j < tokens.length; j++) {
    const t = tokens[j]!;
    if (isPunct(t)) {
      spans.push(null);
      continue;
    }
    skip();
    const end = match(readingOf(t), p);
    if (end >= 0) {
      spans.push([p, end]);
      p = end;
      continue;
    }
    // The reading differs (三百 → さんびゃく, IC → アイシー): find where the next token starts.
    const next = tokens.slice(j + 1).find((x) => !isPunct(x));
    if (!next) {
      spans.push([p, kana.length]);
      p = kana.length;
      continue;
    }
    const r = readingOf(next);
    let found = -1;
    for (let q = p + 1; q <= Math.min(kana.length, p + 12); q++) if (match(r, q) >= 0) {
      found = q;
      break;
    }
    if (found < 0) return null;
    let e = found;
    while (e > p && SKIP.test(kana[e - 1]!)) e--;
    spans.push([p, e]);
    p = found;
  }
  return spans;
}

/** Break positions in `kana`, as base-36 indices (`-` after one: a hyphen), or null if unsure. */
function breaksFor(text: string, kana: string): string[] | null {
  const tokens = tokenizer.tokenize(text.replace(/[_＿]+/g, '＿'));
  const spans = align(tokens, kana);
  if (!spans) return null;
  const trustAll = hasKanji(text);
  const known = (t: Token | undefined) => !t || isPunct(t) || t.word_type === 'KNOWN';
  /** A particle (or copula) worth splitting off in all-kana text. */
  const ok = (j: number): boolean => {
    const t = tokens[j];
    if (!t || j === 0) return false;
    const particle = (t.pos === '助詞' && COMMON_PARTICLES.has(t.surface_form)) || (t.pos === '助動詞' && COPULA.has(t.basic_form));
    return particle && known(tokens[j - 1]) && !isPunct(tokens[j - 1]!) && (tokens[j - 1]!.surface_form.length >= 2 || tokens[j - 1]!.pos === '助動詞') && known(tokens[j + 1]);
  };
  const out: string[] = [];
  const add = (i: number, how: 'new' | 'hyphen') => {
    if (i <= 0 || i >= kana.length || SKIP.test(kana[i - 1]!) || SKIP.test(kana[i]!)) return;
    out.push(i.toString(36) + (how === 'hyphen' ? '-' : ''));
  };
  for (let j = 1; j < tokens.length; j++) {
    const span = spans[j];
    if (!span) continue;
    const how = joinOf(tokens[j]!, tokens[j - 1]);
    if (how === 'glue') continue;
    if (trustAll || how === 'hyphen') {
      add(span[0], how);
      continue;
    }
    // All kana: only around common particles and です/だ, and only when the words on either
    // side are ones the dictionary knows (in kana it can mistake れいぞうこ for れい・ぞ・うこ).
    if ((ok(j) || (ok(j - 1) && tokens[j - 1]!.pos === '助詞')) && span[0] - chunkStart(kana, span[0]) >= 2) add(span[0], how);
  }
  return out;
}

function chunkStart(kana: string, i: number): number {
  while (i > 0 && !SKIP.test(kana[i - 1]!)) i--;
  return i;
}

const table = new Map<string, string>();
let unsure = 0;
for (const { jp } of collectJpTexts(content)) {
  if (jp.kana.includes('{') || table.has(breakKey(jp.kana))) continue;
  const breaks = breaksFor(jp.text, jp.kana);
  if (!breaks) {
    unsure++;
    continue;
  }
  table.set(breakKey(jp.kana), breaks.join(','));
}

const lines = [...table].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  ${/^[a-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: '${v}',`);
const OUT = 'shared/src/japanese/wordBreaks.ts';
const file =
  `// Generated by \`npm run content:romaji\` (tools/content-romaji.ts). Don't edit by hand.\n` +
  `// Word breaks in content kana, keyed by breakKey(kana): base-36 indices, \`-\` after one for a hyphen.\n\n` +
  `export const WORD_BREAKS: Record<string, string> = {\n${lines.join('\n')}\n};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== file) {
    console.error(`${OUT} is out of date: run npm run content:romaji`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
} else {
  writeFileSync(OUT, file);
  console.log(`${table.size} readings split into words; ${unsure} left to the simple guess.`);
}
