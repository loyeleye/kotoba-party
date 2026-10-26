// Shiritori rules, as pure functions on kana readings.
//
// House rules (design doc, "Word Gauntlet"):
//  - ー continues from the kana before it (コーヒー → ひ).
//  - Small kana count as full size (きしゃ → や).
//  - Dakuten and handakuten may be added or dropped (か ↔ が, は ↔ ば ↔ ぱ).
//  - A word that ends in ん knocks you out. No repeats in a game.

import { soundKey, toHiragana, type UtteranceToken } from '../../japanese/kana.js';

const SMALL_TO_FULL: Record<string, string> = {
  ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゕ: 'か', ゖ: 'け',
};

/**
 * The hiragana reading of a word as said or typed: katakana → hiragana, spaces and
 * punctuation dropped, a polite です tail dropped. Returns null when anything other than
 * kana is left (kanji the server could not read, latin letters …).
 */
export function wordReading(raw: string): string | null {
  let r = toHiragana(raw.normalize('NFKC'))
    .replace(/[\s、。，．,.!?！？「」『』（）()・〜~…"'“”‘’-]/g, '')
    .replace(/[ｰ－—―]/g, 'ー');
  if (r.length > 3 && r.endsWith('です')) r = r.slice(0, -2);
  if (!r || !/^[ぁ-ゖー]+$/.test(r) || r.startsWith('ー')) return null;
  return r;
}

/** A kana with its (han)dakuten removed and small kana made full size. */
export function baseKana(ch: string): string {
  const full = SMALL_TO_FULL[ch] ?? ch;
  if (full === 'ゔ') return 'う';
  return full.normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
}

/** The kana the next word must start with (before dakuten folding). */
export function lastKana(reading: string): string {
  const trimmed = reading.replace(/ー+$/, '');
  const ch = trimmed.at(-1) ?? '';
  return SMALL_TO_FULL[ch] ?? ch;
}

export function firstKana(reading: string): string {
  return reading[0] ?? '';
}

export const endsInN = (reading: string): boolean => lastKana(reading) === 'ん';

/** Does `next` legally follow a word whose needed kana is `need`? */
export function follows(need: string, next: string): boolean {
  return baseKana(firstKana(next)) === baseKana(need);
}

/** Every kana a word may start with to follow `need` (か → か, が). For hints and the phone. */
export function startOptions(need: string): string[] {
  const base = baseKana(need);
  const out = [base];
  const daku = String.fromCodePoint(base.codePointAt(0)! + 1);
  const handaku = String.fromCodePoint(base.codePointAt(0)! + 2);
  if (baseKana(daku) === base && daku !== base) out.push(daku);
  if ('はひふへほ'.includes(base)) out.push(handaku);
  if (base === 'う') out.push('ゔ');
  return out;
}

/** The key a repeat is checked by: same sound, however it is spelled. */
export const repeatKey = (reading: string): string => soundKey(reading);

/**
 * Does the dictionary (kuromoji, via the server) know this as one noun? Hiragana-only words
 * are often split into pieces (ごりら → ご + り + ら), so a split word is never trusted here:
 * it goes to the topic packs, then to the room's vote.
 */
export function dictionaryNoun(tokens: readonly UtteranceToken[] | undefined, reading: string): boolean {
  if (!tokens || reading.length < 2) return false;
  const content = tokens.filter((t) => t.pos !== '記号' && !(t.pos === '助動詞' && t.surface === 'です'));
  return content.length === 1 && content[0]!.known && content[0]!.pos === '名詞';
}
