// Hepburn romaji for kana, shown only to Kana-level players as training wheels.
import { toHiragana } from '../../japanese/kana.js';

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゎ: 'wa',
};

const YOON: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };

export function toRomaji(text: string): string {
  const hira = toHiragana(text);
  let out = '';
  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i]!;
    const nextCh = hira[i + 1];
    if (ch === 'っ') {
      const following = nextCh ? romajiOf(nextCh, hira[i + 2]) : '';
      out += following.startsWith('ch') ? 't' : (following[0] ?? '');
      continue;
    }
    if (ch === 'ー') {
      out += out.at(-1) ?? '';
      continue;
    }
    if (nextCh && YOON[nextCh]) {
      out += romajiOf(ch, nextCh);
      i += 1;
      continue;
    }
    out += BASE[ch] ?? (YOON[ch] ? `y${YOON[ch]}` : ch);
  }
  return out;
}

function romajiOf(ch: string, nextCh: string | undefined): string {
  const base = BASE[ch] ?? ch;
  if (!nextCh || !YOON[nextCh]) return base;
  const v = YOON[nextCh];
  if (base === 'shi') return `sh${v}`;
  if (base === 'chi') return `ch${v}`;
  if (base === 'ji') return `j${v}`;
  return `${base.slice(0, -1)}y${v}`;
}
