// Kana → Hepburn romaji, for the Kana-level training wheels only (never accepted as an answer).

import { toHiragana } from '../../japanese/kana.js';

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
/** Consonant heads for loanword combos (ファ → fa, ティ → ti, ウィ → wi). */
const COMBO_HEAD: Record<string, string> = { ふ: 'f', て: 't', で: 'd', う: 'w', ゔ: 'v', し: 'sh', ち: 'ch', じ: 'j', つ: 'ts', と: 't', ど: 'd' };

export function toRomaji(kana: string): string {
  const chars = [...toHiragana(kana)];
  let out = '';
  let double = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (ch === 'っ') {
      double = true;
      continue;
    }
    let syl: string;
    if (ch === 'ー') {
      syl = out.at(-1) ?? '';
    } else if (next && SMALL_Y[next] && BASE[ch] && ch !== 'い') {
      const stem = BASE[ch]!;
      const head = stem === 'shi' || stem === 'chi' || stem === 'ji' ? stem.slice(0, -1) : `${stem.slice(0, -1)}y`;
      syl = head + SMALL_Y[next]!;
      i++;
    } else if (next && SMALL_V[next] && COMBO_HEAD[ch]) {
      syl = COMBO_HEAD[ch]! + SMALL_V[next]!;
      i++;
    } else if (ch === 'ん' && next && /^[aiueoy]/.test(BASE[next] ?? '')) {
      syl = "n'";
    } else {
      syl = BASE[ch] ?? ch;
    }
    if (double && /^[a-z]/.test(syl)) syl = (syl.startsWith('ch') ? 't' : syl[0]) + syl;
    double = false;
    out += syl;
  }
  return out.replace(/\s+/g, ' ');
}
