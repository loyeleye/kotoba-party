// Hepburn romaji for kana: the かな level's way into a sentence (design doc: romaji only at the
// かな level, never accepted as an answer). One copy for every mode.
//
//   サンドイッチはよんひゃくえん、ジュースは… → "Sandoitchi wa yonhyaku-en, jūsu wa …"
//
// Words are spaced: where the content's kana came with a word split worked out from the
// dictionary at build time (WORD_BREAKS, `npm run content:romaji`) that is used; otherwise the
// kana's own spaces, with a trailing particle split off when it is clearly one. Particles read
// as they sound (は → wa, へ → e, を → o), long vowels get macrons (おう, おお, ー → ō), Japanese
// punctuation becomes English punctuation, and a sentence starts with a capital.

import { toHiragana } from './kana.js';
import { WORD_BREAKS } from './wordBreaks.js';

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
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
};
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
/** Consonant heads for loanword combos (ファ → fa, ティ → ti, ウィ → wi, シェ → she). */
const COMBO_HEAD: Record<string, string> = { ふ: 'f', て: 't', で: 'd', う: 'w', ゔ: 'v', し: 'sh', ち: 'ch', じ: 'j', つ: 'ts', と: 't', ど: 'd' };
const PUNCT: Record<string, string> = {
  '、': ',', '，': ',', '。': '.', '．': '.', '？': '?', '！': '!', '：': ':', '；': ';', '…': '…', '〜': '~', '・': ' ',
  '「': '"', '」': '"', '『': '"', '』': '"', '（': '(', '）': ')', '　': ' ',
};
const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };
const SOUNDS_AS: Record<string, string> = { は: 'wa', へ: 'e', を: 'o', には: 'ni wa', では: 'de wa', とは: 'to wa', へは: 'e wa' };
/** Greetings that end in a fused は, read わ: こんにちは → konnichiwa, こんばんは → konbanwa. */
const FUSED_WA = /(こんにち|こんばん|コンニチ|コンバン)[はハ]$/;

/** Particles a word may end in, longest first. */
const PARTICLES = ['から', 'まで', 'より', 'には', 'では', 'とは', 'へは', 'にも', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'の', 'や'];
const SAFE_AFTER_HIRAGANA = new Set(['は', 'を', 'へ', 'が', 'の', 'から', 'まで', 'には', 'では']);
/** Word endings that look like a particle but aren't (いつも, こども, もっと, たべもの, まんが). */
const NOT_PARTICLE = /(?:こんにちは|こんばんは|いつも|こども|ども|もの|まんが|っと|おとうと|いもうと|なに|やおや|へや|ほんや|けど|ので|のに|でも)$/;

/** FNV-1a of the kana, in base 36: the key of WORD_BREAKS. */
export function breakKey(kana: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < kana.length; i++) {
    h ^= kana.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * The kana with a space (or `-` before a suffix like さん or 円) at every word break.
 * Breaks come from WORD_BREAKS when the build saw this exact string, else from a guess.
 */
export function spaceWords(kana: string): string {
  const known = WORD_BREAKS[breakKey(kana)];
  if (known !== undefined) {
    const at = new Map(known.split(',').filter(Boolean).map((b) => [Number.parseInt(b, 36), b.endsWith('-') ? '-' : ' '] as const));
    let out = '';
    for (let i = 0; i < kana.length; i++) out += (at.get(i) ?? '') + kana[i];
    return out;
  }
  return kana
    .split(/([\s　、。！？「」『』：・（）]+)/)
    .map((chunk, i) => (i % 2 ? chunk : splitParticle(chunk)))
    .join('');
}

const HIRAGANA_ONLY = /^[\u3041-\u309f]+$/;
/** A copula a word may end in, split off as its own word (かみなりです → かみなり です). */
const COPULA = /^(.{2,}?)(でした|です)$/;

function splitParticle(word: string): string {
  // A katakana name with さん: アキさん → アキ-さん (Aki-san).
  const san = /^([\u30a1-\u30ff]+)さん(.*)$/.exec(word);
  if (san) return `${san[1]}-さん${san[2] ? ` ${san[2]}` : ''}`;
  const cop = COPULA.exec(word);
  if (cop && !/[\u3041-\u309f]$/.test(cop[1]!.slice(-1)) ) return `${splitParticle(cop[1]!)} ${cop[2]}`;
  if (cop && HIRAGANA_ONLY.test(word) && cop[1]!.length >= 3) return `${splitParticle(cop[1]!)} ${cop[2]}`;
  const hira = toHiragana(word);
  // The "not a particle" endings are hiragana words (ピーマンが is ピーマン + が, not まんが).
  if (HIRAGANA_ONLY.test(word) && NOT_PARTICLE.test(hira)) return word;
  for (const p of PARTICLES) {
    if (hira.length - p.length < 2 || !hira.endsWith(p)) continue;
    // A particle is written in hiragana: トマト, ピアノ and ペット don't end in と, の or と.
    if (!HIRAGANA_ONLY.test(word.slice(-p.length))) continue;
    // After katakana or kanji any particle is clear; an all-hiragana word only loses the ones
    // that rarely end a word (しごと, まど and こども end in と, で and も).
    const stem = word.slice(0, word.length - p.length);
    const mixed = /[^\u3041-\u309f]/.test(stem.slice(-1));
    if (mixed || SAFE_AFTER_HIRAGANA.has(p)) return `${stem} ${word.slice(-p.length)}`;
  }
  return word;
}

/** Hepburn romaji, spaced by word. Text that isn't kana passes through. */
export function toRomaji(kana: string): string {
  const spaced = spaceWords(kana.normalize('NFC'));
  const sentence = /[。！？.!?]/.test(kana);
  const words = spaced.split(/(\s+|-|[、，。．？！：；…〜・「」『』（）　]|＿+|_+)/);
  // A kana on its own is that kana, not a particle: へ alone is "he" (Shodō's practice sheets).
  const alone = words.filter((w) => /[\u3041-\u30ff]/.test(w)).length === 1;
  let out = '';
  for (const w of words) {
    if (!w) continue;
    if (/^\s+$/.test(w)) out += ' ';
    else if (w === '-') out += '-';
    else if (/^[＿_]+$/.test(w)) out += '___';
    else if (PUNCT[w] !== undefined) out += PUNCT[w];
    else out += (alone ? undefined : SOUNDS_AS[w]) ?? word(w.replace(FUSED_WA, '$1わ'));
  }
  out = out
    .replace(/\s*([,.!?:;)…])/g, '$1')
    .replace(/([,.!?:;…])(?=[A-Za-zāīūēō0-9_"(])/g, '$1 ')
    .replace(/"\s*([^"]*?)\s*"/g, '"$1"')
    .replace(/___(?=[A-Za-zāīūēō])/g, '___ ')
    .replace(/([A-Za-zāīūēō])___/g, '$1 ___')
    .replace(/\s+/g, ' ')
    .trim();
  return sentence ? out.replace(/(^"?|[.!?:]\s+"?)([a-zāīūēō])/g, (_, a: string, b: string) => a + b.toUpperCase()) : out;
}

/** One word: syllables, っ doubling, ん before a vowel as n', long vowels as macrons. */
function word(text: string): string {
  const chars = [...toHiragana(text)];
  const syllables: string[] = [];
  let double = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const next = chars[i + 1];
    if (ch === 'っ') {
      double = true;
      continue;
    }
    // を is only ever the particle: a word of its own, never half of a long vowel (ぼを is bo o).
    if (ch === 'を') {
      syllables.push(' o ');
      double = false;
      continue;
    }
    if (ch === 'ー') {
      const last = syllables.at(-1);
      if (last && MACRON[last.at(-1)!]) syllables[syllables.length - 1] = last.slice(0, -1) + MACRON[last.at(-1)!];
      continue;
    }
    let syl = BASE[ch];
    if (syl === undefined) {
      syllables.push(ch);
      double = false;
      continue;
    }
    if (next && SMALL_Y[next] && syl.length > 1 && syl.endsWith('i')) {
      const stem = syl.slice(0, -1);
      syl = (stem === 'sh' || stem === 'ch' || stem === 'j' ? stem : `${stem}y`) + SMALL_Y[next];
      i++;
    } else if (next && SMALL_V[next] && COMBO_HEAD[ch]) {
      syl = COMBO_HEAD[ch] + SMALL_V[next];
      i++;
    } else if (ch === 'ん' && next && /^[aiueoy]/.test(BASE[next] ?? '')) {
      syl = "n'";
    }
    if (double && /^[a-z]/.test(syl)) syl = (syl.startsWith('ch') ? 't' : syl[0]) + syl;
    double = false;
    // Long vowels: おう / おお → ō, うう → ū, ああ → ā, ええ → ē (えい and いい stay as written).
    const prev = syllables.at(-1);
    const v = prev?.at(-1);
    if (prev && v && ((syl === 'u' && (v === 'o' || v === 'u')) || (syl === v && 'aoue'.includes(v)))) {
      syllables[syllables.length - 1] = prev.slice(0, -1) + MACRON[v];
      continue;
    }
    syllables.push(syl);
  }
  return syllables.join('');
}
