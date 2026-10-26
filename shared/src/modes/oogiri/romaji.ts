// Hepburn romaji for kana, shown only to Kana-level players as training wheels (design doc:
// "romaji is shown only at the Kana level"). Anything that isn't kana passes through.

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
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
};

const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };

export function toRomaji(text: string): string {
  const chars = [...toHiragana(text)];
  let out = '';
  let geminate = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (ch === 'っ') {
      geminate = true;
      continue;
    }
    if (ch === 'ー') {
      out += out.at(-1) && /[aeiou]/.test(out.at(-1)!) ? out.at(-1)! : '';
      continue;
    }
    let syl = BASE[ch];
    if (syl === undefined) {
      if (geminate) geminate = false;
      // Japanese punctuation and spacing become their plain equivalents.
      out += ch === '、' ? ', ' : ch === '。' ? '. ' : ch === '　' ? ' ' : ch;
      continue;
    }
    // Yōon: き + ゃ → kya, し + ゃ → sha, ち + ゃ → cha, じ + ゃ → ja.
    if (next && SMALL_Y[next] && syl.endsWith('i') && syl.length > 1) {
      const stem = syl.slice(0, -1);
      syl = (stem === 'sh' || stem === 'ch' || stem === 'j' ? stem : `${stem}y`) + SMALL_Y[next];
      i++;
    } else if (next && SMALL_V[next] && syl.length > 1 && ch !== 'ん') {
      // Loanword combos: フ + ァ → fa, テ + ィ → ti, ヴ + ォ → vo.
      syl = syl.slice(0, -1) + SMALL_V[next];
      i++;
    }
    if (geminate) {
      out += syl.startsWith('ch') ? 't' : syl[0];
      geminate = false;
    }
    // ん before a vowel or y is written n' so it reads right (ほんや → hon'ya).
    if (ch === 'ん' && next && /^[aeiouy]/.test(BASE[next] ?? '')) syl = "n'";
    out += syl;
  }
  return out.replace(/\s+/g, ' ').trim();
}
