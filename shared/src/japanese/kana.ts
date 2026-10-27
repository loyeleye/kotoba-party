// Kana helpers for checking answers. Answers are compared as hiragana readings after
// normalising: katakana → hiragana, the long mark ー → the vowel it stretches, and spaces
// and punctuation dropped. Particles said as they sound (は→わ, へ→え, を→お) are handled by
// listing both spellings in a content item's accepted answers, not here.

/** How a player gave an answer. */
export interface Utterance {
  via: 'speech' | 'typed' | 'tap';
  /** What the phone sent: the recogniser's transcript or the typed text. */
  text: string;
  /** Hiragana reading the server worked out for `text` (kanji → kana). Set by the server only. */
  reading?: string;
  /** The server's word split of `text`, with dictionary facts. Set by the server only. */
  tokens?: UtteranceToken[];
}

export interface UtteranceToken {
  surface: string;
  /** Hiragana reading. */
  reading: string;
  /** Part of speech from the dictionary (IPADIC: 名詞, 動詞, 形容詞, 助詞 …). */
  pos: string;
  /** False when the dictionary doesn't know the word (made-up words, typos). */
  known: boolean;
}

const KATA_START = 0x30a1;
const KATA_END = 0x30f6;

export function toHiragana(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out += code >= KATA_START && code <= KATA_END ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

export function toKatakana(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out += code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : ch;
  }
  return out;
}

const VOWEL_OF: Record<string, string> = {};
const ROWS: [string, string][] = [
  ['あかさたなはまやらわがざだばぱぁゃ', 'あ'],
  ['いきしちにひみりぎじぢびぴぃ', 'い'],
  ['うくすつぬふむゆるぐずづぶぷぅゅっ', 'う'],
  ['えけせてねへめれげぜでべぺぇ', 'え'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'お'],
];
for (const [chars, vowel] of ROWS) for (const ch of chars) VOWEL_OF[ch] = vowel;
VOWEL_OF['ん'] = 'ん';

/** True if the text has any kanji (CJK ideographs). */
export function hasKanji(text: string): boolean {
  return /[㐀-鿿豈-﫿]/.test(text);
}

/** True if the text is only kana (and the long mark), ignoring spaces and punctuation. */
export function isKana(text: string): boolean {
  return /^[ぁ-ゖァ-ーー]+$/.test(stripNoise(text));
}

function stripNoise(text: string): string {
  return text.normalize('NFKC').replace(/[\s、。，．,.!?！？「」『』（）()・〜~…"'“”‘’]/g, '');
}

/**
 * The reading used for comparisons: hiragana, no spaces or punctuation, ー replaced by
 * the vowel it lengthens (コーヒー → こおひい), so long vowels match however they are written.
 */
export function normalizeReading(text: string): string {
  const hira = toHiragana(stripNoise(text));
  let out = '';
  for (const ch of hira) {
    if (ch === 'ー') {
      const prev = out.at(-1);
      out += prev ? (VOWEL_OF[prev] ?? '') : '';
    } else out += ch;
  }
  return out;
}

/**
 * Collapses the spellings that sound the same in standard Japanese, for lenient checks:
 * long え/お sounds written えい/おう, and じ/ぢ, ず/づ, お/を.
 */
export function soundKey(text: string): string {
  return normalizeReading(text)
    .replace(/ぢ/g, 'じ')
    .replace(/づ/g, 'ず')
    .replace(/を/g, 'お')
    .replace(/([えけせてねへめれげぜでべぺ])い/g, '$1え')
    .replace(/([おこそとのほもよろごぞどぼぽょ])う/g, '$1お');
}

/** The reading to check an utterance by. */
export function utteranceReading(u: Utterance): string {
  return normalizeReading(u.reading ?? u.text);
}

/**
 * Does an answer match any accepted reading? Strict compares normalised readings; lenient
 * (the default, per the design doc's "forgiving by design") also accepts same-sounding spellings.
 */
export function matchesAccepted(answer: string, accepted: readonly string[], lenient = true): boolean {
  const a = normalizeReading(answer);
  if (!a) return false;
  if (accepted.some((x) => normalizeReading(x) === a)) return true;
  if (!lenient) return false;
  const key = soundKey(answer);
  return accepted.some((x) => soundKey(x) === key);
}

export function isUtterance(v: unknown): v is Utterance {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  return (u.via === 'speech' || u.via === 'typed' || u.via === 'tap') && typeof u.text === 'string' && u.text.length <= 200;
}

/** An award title's reading: its kana with 賞 / 王 / 大賞 / 名人 read out (the only kanji award titles use). */
export const awardKana = (title: string): string =>
  title.replace(/大賞/g, 'たいしょう').replace(/賞/g, 'しょう').replace(/王/g, 'おう').replace(/名人/g, 'めいじん');
