// Romaji to kana, for typed answers and for suggesting a player's name in katakana (Aki → アキ).
// Hepburn plus the common variants (si, ti, tu, hu, l for r). Letters that don't make a syllable
// get a vowel the way loanwords do (Siobhan → シオブハン): a starting point the
// player edits, not a transliteration.

import { toKatakana } from './kana.js';

const VOWELS: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };

// Consonant (or cluster) + vowel. Longest match first.
const SYLLABLES: Record<string, string> = {
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', sha: 'しゃ', shi: 'し', shu: 'しゅ', she: 'しぇ', sho: 'しょ',
  cha: 'ちゃ', chi: 'ち', chu: 'ちゅ', che: 'ちぇ', cho: 'ちょ', tsu: 'つ', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ', mya: 'みゃ', myu: 'みゅ', myo: 'みょ', rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ', ja: 'じゃ', ji: 'じ', ju: 'じゅ', je: 'じぇ', jo: 'じょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', sa: 'さ', si: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', ti: 'ち', tu: 'つ', te: 'て', to: 'と', na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', ye: 'いぇ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ', da: 'だ', di: 'でぃ', du: 'どぅ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ', ca: 'か', ci: 'し', cu: 'く', ce: 'せ', co: 'こ',
  qa: 'か', qi: 'き', qu: 'く', qe: 'け', qo: 'こ', xa: 'ざ', xi: 'じ', xu: 'ず', xe: 'ぜ', xo: 'ぞ',
};
// A consonant with no vowel after it, as loanwords say it.
const LONE: Record<string, string> = {
  b: 'ぶ', c: 'く', d: 'ど', f: 'ふ', g: 'ぐ', h: 'ふ', j: 'じ', k: 'く', l: 'る', m: 'む', p: 'ぷ', q: 'く', r: 'る',
  s: 'す', t: 'と', v: 'ゔ', w: 'う', x: 'くす', y: 'い', z: 'ず',
};

/** True when the text is romaji (Latin letters, spaces, hyphens and apostrophes only). */
export const isRomaji = (text: string): boolean => /^[A-Za-z' -]+$/.test(text.trim()) && /[A-Za-z]/.test(text);

/** Romaji as hiragana. n before a consonant or at the end is ん; a doubled consonant is っ; "n'" splits. */
export function romajiToHiragana(text: string): string {
  const s = text.toLowerCase().replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu').replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'ou');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === ' ' || ch === '-') {
      out += ch === ' ' ? ' ' : 'ー';
      i++;
      continue;
    }
    if (ch === "'") {
      i++;
      continue;
    }
    if (VOWELS[ch]) {
      out += VOWELS[ch];
      i++;
      continue;
    }
    if (ch === 'n') {
      const next = s[i + 1];
      if (next === "'" || next === undefined || next === ' ' || (!VOWELS[next] && next !== 'y')) {
        out += 'ん';
        i += next === 'n' && !VOWELS[s[i + 2] ?? ''] ? 2 : 1;
        continue;
      }
    }
    // っ: a doubled consonant (tt, kk, tch).
    if (ch === s[i + 1] && ch !== 'n' && !VOWELS[ch]) {
      out += 'っ';
      i++;
      continue;
    }
    if (ch === 't' && s.startsWith('tch', i)) {
      out += 'っ';
      i++;
      continue;
    }
    let hit = false;
    for (const len of [3, 2]) {
      const k = s.slice(i, i + len);
      const kana = SYLLABLES[k];
      if (kana) {
        out += kana;
        i += len;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    out += LONE[ch] ?? '';
    i++;
  }
  return out;
}

/**
 * A name as katakana. Already-Japanese names pass through (hiragana becomes katakana); romaji is
 * converted, with a doubled vowel written as a long mark (Lee → リー, Sakura → サクラ).
 */
export function nameToKatakana(name: string): string {
  const t = name.trim();
  if (!t) return '';
  if (/[ぁ-ゖァ-ヺー一-鿿]/.test(t)) return toKatakana(t);
  if (!isRomaji(t)) return t;
  const kata = toKatakana(romajiToHiragana(t.replace(/-/g, ' ').replace(/ee/gi, 'i-').replace(/(ii|aa|oo|uu)/gi, (m) => `${m[0]}-`)).replace(/\s+/g, '・'));
  return kata.replace(/(.)ー/g, '$1ー').replace(/ーー+/g, 'ー');
}
