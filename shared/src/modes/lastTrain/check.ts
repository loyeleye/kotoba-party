// Answer checking and reading help for Last Train.
//
// Every answer is compared as a kana reading (the server adds `reading` for kanji and digits:
// 三百円 / 300円 → さんびゃくえん). The check is lenient (matchesAccepted's default). Particle
// Panic, and any fill-particle minigame, also accepts は / へ / を said as わ / え / お.

import { matchesAccepted, normalizeReading, soundKey, toHiragana, utteranceReading, type Utterance } from '../../japanese/kana.js';

/** は→わ, へ→え, を→お, on top of the lenient sound key. Only used for particle minigames. */
export function particleKey(text: string): string {
  return soundKey(text).replace(/は/g, 'わ').replace(/へ/g, 'え').replace(/を/g, 'お');
}

/** Is this answer right? `particles` turns on the は/へ/を leniency. */
export function isAccepted(answer: string, accepted: readonly string[], particles = false): boolean {
  if (matchesAccepted(answer, accepted)) return true;
  if (!particles) return false;
  const key = particleKey(answer);
  return key.length > 0 && accepted.some((a) => particleKey(a) === key);
}

/** Checks an utterance: the server's reading first, then the raw text (kana typed or heard). */
export function checkUtterance(u: Utterance, accepted: readonly string[], particles = false): boolean {
  const candidates = new Set([utteranceReading(u), normalizeReading(u.text)]);
  for (const c of candidates) if (c && isAccepted(c, accepted, particles)) return true;
  return false;
}

// ---- romaji, for Kana-level players (the design doc: romaji only at the Kana level) ----

const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', しゃ: 'sha', しゅ: 'shu', しょ: 'sho', ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', てぃ: 'ti', でぃ: 'di', うぃ: 'wi', うぇ: 'we', うぉ: 'wo', しぇ: 'she', じぇ: 'je', ちぇ: 'che',
};

const SINGLE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
};

const PUNCT: Record<string, string> = { '、': ', ', '。': '. ', '？': '? ', '！': '! ', '「': '"', '」': '"', '…': '…', '＿': '_', '・': ' ', '　': ' ' };

/** Hepburn romaji for a kana string (katakana too). Anything else passes through. */
export function toRomaji(kana: string): string {
  const s = toHiragana(kana);
  let out = '';
  let geminate = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === 'っ') {
      geminate = true;
      continue;
    }
    if (ch === 'ー') {
      const last = out.at(-1);
      if (last && 'aeiou'.includes(last)) out += last;
      continue;
    }
    const pair = s.slice(i, i + 2);
    let roman = DIGRAPHS[pair];
    if (roman) i++;
    else roman = SINGLE[ch];
    if (roman === undefined) {
      out += PUNCT[ch] ?? ch;
      geminate = false;
      continue;
    }
    if (geminate) out += roman.startsWith('ch') ? 't' : roman[0]!;
    geminate = false;
    // ん before a vowel or y reads n' (kin'en), so it is not mistaken for な-row.
    if (ch === 'ん' && i + 1 < s.length && /^[あいうえおやゆよ]/.test(s[i + 1]!)) roman = "n'";
    out += roman;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** The first mora of a reading (with a small kana or っ attached), for a Kana-level retry. */
export function firstMora(kana: string): string {
  const s = toHiragana(normalizeReading(kana));
  let i = 0;
  let out = '';
  if (s[i] === 'っ') out += s[i++];
  if (s[i]) out += s[i++];
  if (s[i] && 'ゃゅょぁぃぅぇぉ'.includes(s[i]!)) out += s[i];
  return out;
}
