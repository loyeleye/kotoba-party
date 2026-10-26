// Every kana in Kana Yōkai Raid: 46 basic pairs, 25 voiced pairs, small っ/ッ,
// ヴ, 33 combination pairs, the long-vowel mark and 19 special katakana
// (231 yōkai). Chapters follow ToKini Andy's "Learn Hiragana and Katakana in
// PAIRS" course order.
//
// Rows are written compactly and expanded below so the twin, homophone and
// difficulty rules live in one place. Ids are stable: `h-<romaji>` for
// hiragana, `k-<romaji>` for katakana.

import type { Kana, KanaKind } from '../types.js';

/** [hiragana, katakana, romaji, sound (hiragana), chapter, kind] */
type Row = [hira: string | null, kata: string | null, romaji: string, sound: string, chapter: number, kind: KanaKind];

const rows: Row[] = [
  // 1. Vowels
  ['あ', 'ア', 'a', 'あ', 1, 'basic'],
  ['い', 'イ', 'i', 'い', 1, 'basic'],
  ['う', 'ウ', 'u', 'う', 1, 'basic'],
  ['え', 'エ', 'e', 'え', 1, 'basic'],
  ['お', 'オ', 'o', 'お', 1, 'basic'],
  // 2. K row
  ['か', 'カ', 'ka', 'か', 2, 'basic'],
  ['き', 'キ', 'ki', 'き', 2, 'basic'],
  ['く', 'ク', 'ku', 'く', 2, 'basic'],
  ['け', 'ケ', 'ke', 'け', 2, 'basic'],
  ['こ', 'コ', 'ko', 'こ', 2, 'basic'],
  // 3. S row
  ['さ', 'サ', 'sa', 'さ', 3, 'basic'],
  ['し', 'シ', 'shi', 'し', 3, 'basic'],
  ['す', 'ス', 'su', 'す', 3, 'basic'],
  ['せ', 'セ', 'se', 'せ', 3, 'basic'],
  ['そ', 'ソ', 'so', 'そ', 3, 'basic'],
  // 4. T row
  ['た', 'タ', 'ta', 'た', 4, 'basic'],
  ['ち', 'チ', 'chi', 'ち', 4, 'basic'],
  ['つ', 'ツ', 'tsu', 'つ', 4, 'basic'],
  ['て', 'テ', 'te', 'て', 4, 'basic'],
  ['と', 'ト', 'to', 'と', 4, 'basic'],
  // 5. N row
  ['な', 'ナ', 'na', 'な', 5, 'basic'],
  ['に', 'ニ', 'ni', 'に', 5, 'basic'],
  ['ぬ', 'ヌ', 'nu', 'ぬ', 5, 'basic'],
  ['ね', 'ネ', 'ne', 'ね', 5, 'basic'],
  ['の', 'ノ', 'no', 'の', 5, 'basic'],
  // 6. H row
  ['は', 'ハ', 'ha', 'は', 6, 'basic'],
  ['ひ', 'ヒ', 'hi', 'ひ', 6, 'basic'],
  ['ふ', 'フ', 'fu', 'ふ', 6, 'basic'],
  ['へ', 'ヘ', 'he', 'へ', 6, 'basic'],
  ['ほ', 'ホ', 'ho', 'ほ', 6, 'basic'],
  // 7. M row
  ['ま', 'マ', 'ma', 'ま', 7, 'basic'],
  ['み', 'ミ', 'mi', 'み', 7, 'basic'],
  ['む', 'ム', 'mu', 'む', 7, 'basic'],
  ['め', 'メ', 'me', 'め', 7, 'basic'],
  ['も', 'モ', 'mo', 'も', 7, 'basic'],
  // 8. Y row
  ['や', 'ヤ', 'ya', 'や', 8, 'basic'],
  ['ゆ', 'ユ', 'yu', 'ゆ', 8, 'basic'],
  ['よ', 'ヨ', 'yo', 'よ', 8, 'basic'],
  // 9. R row
  ['ら', 'ラ', 'ra', 'ら', 9, 'basic'],
  ['り', 'リ', 'ri', 'り', 9, 'basic'],
  ['る', 'ル', 'ru', 'る', 9, 'basic'],
  ['れ', 'レ', 're', 'れ', 9, 'basic'],
  ['ろ', 'ロ', 'ro', 'ろ', 9, 'basic'],
  // 10. W row and ん. を is said お, so it shares お's sound.
  ['わ', 'ワ', 'wa', 'わ', 10, 'basic'],
  ['を', 'ヲ', 'wo', 'お', 10, 'basic'],
  ['ん', 'ン', 'n', 'ん', 10, 'basic'],
  // 11. Voiced sounds, small っ and ヴ. ぢ/づ are said じ/ず.
  ['が', 'ガ', 'ga', 'が', 11, 'voiced'],
  ['ぎ', 'ギ', 'gi', 'ぎ', 11, 'voiced'],
  ['ぐ', 'グ', 'gu', 'ぐ', 11, 'voiced'],
  ['げ', 'ゲ', 'ge', 'げ', 11, 'voiced'],
  ['ご', 'ゴ', 'go', 'ご', 11, 'voiced'],
  ['ざ', 'ザ', 'za', 'ざ', 11, 'voiced'],
  ['じ', 'ジ', 'ji', 'じ', 11, 'voiced'],
  ['ず', 'ズ', 'zu', 'ず', 11, 'voiced'],
  ['ぜ', 'ゼ', 'ze', 'ぜ', 11, 'voiced'],
  ['ぞ', 'ゾ', 'zo', 'ぞ', 11, 'voiced'],
  ['だ', 'ダ', 'da', 'だ', 11, 'voiced'],
  ['ぢ', 'ヂ', 'dji', 'じ', 11, 'voiced'],
  ['づ', 'ヅ', 'dzu', 'ず', 11, 'voiced'],
  ['で', 'デ', 'de', 'で', 11, 'voiced'],
  ['ど', 'ド', 'do', 'ど', 11, 'voiced'],
  ['ば', 'バ', 'ba', 'ば', 11, 'voiced'],
  ['び', 'ビ', 'bi', 'び', 11, 'voiced'],
  ['ぶ', 'ブ', 'bu', 'ぶ', 11, 'voiced'],
  ['べ', 'ベ', 'be', 'べ', 11, 'voiced'],
  ['ぼ', 'ボ', 'bo', 'ぼ', 11, 'voiced'],
  ['ぱ', 'パ', 'pa', 'ぱ', 11, 'voiced'],
  ['ぴ', 'ピ', 'pi', 'ぴ', 11, 'voiced'],
  ['ぷ', 'プ', 'pu', 'ぷ', 11, 'voiced'],
  ['ぺ', 'ペ', 'pe', 'ぺ', 11, 'voiced'],
  ['ぽ', 'ポ', 'po', 'ぽ', 11, 'voiced'],
  // Small っ has no sound of its own: it's a one-beat pause before the next consonant.
  ['っ', 'ッ', 'small-tsu', 'っ', 11, 'small'],
  [null, 'ヴ', 'vu', 'ゔ', 11, 'voiced'],
  // 12. Combinations (yōon)
  ['きゃ', 'キャ', 'kya', 'きゃ', 12, 'combo'],
  ['きゅ', 'キュ', 'kyu', 'きゅ', 12, 'combo'],
  ['きょ', 'キョ', 'kyo', 'きょ', 12, 'combo'],
  ['しゃ', 'シャ', 'sha', 'しゃ', 12, 'combo'],
  ['しゅ', 'シュ', 'shu', 'しゅ', 12, 'combo'],
  ['しょ', 'ショ', 'sho', 'しょ', 12, 'combo'],
  ['ちゃ', 'チャ', 'cha', 'ちゃ', 12, 'combo'],
  ['ちゅ', 'チュ', 'chu', 'ちゅ', 12, 'combo'],
  ['ちょ', 'チョ', 'cho', 'ちょ', 12, 'combo'],
  ['にゃ', 'ニャ', 'nya', 'にゃ', 12, 'combo'],
  ['にゅ', 'ニュ', 'nyu', 'にゅ', 12, 'combo'],
  ['にょ', 'ニョ', 'nyo', 'にょ', 12, 'combo'],
  ['ひゃ', 'ヒャ', 'hya', 'ひゃ', 12, 'combo'],
  ['ひゅ', 'ヒュ', 'hyu', 'ひゅ', 12, 'combo'],
  ['ひょ', 'ヒョ', 'hyo', 'ひょ', 12, 'combo'],
  ['みゃ', 'ミャ', 'mya', 'みゃ', 12, 'combo'],
  ['みゅ', 'ミュ', 'myu', 'みゅ', 12, 'combo'],
  ['みょ', 'ミョ', 'myo', 'みょ', 12, 'combo'],
  ['りゃ', 'リャ', 'rya', 'りゃ', 12, 'combo'],
  ['りゅ', 'リュ', 'ryu', 'りゅ', 12, 'combo'],
  ['りょ', 'リョ', 'ryo', 'りょ', 12, 'combo'],
  ['ぎゃ', 'ギャ', 'gya', 'ぎゃ', 12, 'combo'],
  ['ぎゅ', 'ギュ', 'gyu', 'ぎゅ', 12, 'combo'],
  ['ぎょ', 'ギョ', 'gyo', 'ぎょ', 12, 'combo'],
  ['じゃ', 'ジャ', 'ja', 'じゃ', 12, 'combo'],
  ['じゅ', 'ジュ', 'ju', 'じゅ', 12, 'combo'],
  ['じょ', 'ジョ', 'jo', 'じょ', 12, 'combo'],
  ['びゃ', 'ビャ', 'bya', 'びゃ', 12, 'combo'],
  ['びゅ', 'ビュ', 'byu', 'びゅ', 12, 'combo'],
  ['びょ', 'ビョ', 'byo', 'びょ', 12, 'combo'],
  ['ぴゃ', 'ピャ', 'pya', 'ぴゃ', 12, 'combo'],
  ['ぴゅ', 'ピュ', 'pyu', 'ぴゅ', 12, 'combo'],
  ['ぴょ', 'ピョ', 'pyo', 'ぴょ', 12, 'combo'],
  // The long-vowel mark stretches the vowel before it by one beat.
  [null, 'ー', 'long-mark', 'ー', 12, 'mark'],
  // 13. Special katakana (loanword sounds)
  [null, 'ファ', 'fa', 'ふぁ', 13, 'special'],
  [null, 'フィ', 'fi', 'ふぃ', 13, 'special'],
  [null, 'フェ', 'fe', 'ふぇ', 13, 'special'],
  [null, 'フォ', 'fo', 'ふぉ', 13, 'special'],
  [null, 'ティ', 'ti', 'てぃ', 13, 'special'],
  [null, 'ディ', 'di', 'でぃ', 13, 'special'],
  [null, 'トゥ', 'tu', 'とぅ', 13, 'special'],
  [null, 'デュ', 'dyu', 'でゅ', 13, 'special'],
  [null, 'ウィ', 'wi', 'うぃ', 13, 'special'],
  [null, 'ウェ', 'we', 'うぇ', 13, 'special'],
  [null, 'ウォ', 'who', 'うぉ', 13, 'special'],
  [null, 'シェ', 'she', 'しぇ', 13, 'special'],
  [null, 'ジェ', 'je', 'じぇ', 13, 'special'],
  [null, 'チェ', 'che', 'ちぇ', 13, 'special'],
  [null, 'ツァ', 'tsa', 'つぁ', 13, 'special'],
  [null, 'ヴァ', 'va', 'ゔぁ', 13, 'special'],
  [null, 'ヴィ', 'vi', 'ゔぃ', 13, 'special'],
  [null, 'ヴェ', 've', 'ゔぇ', 13, 'special'],
  [null, 'ヴォ', 'vo', 'ゔぉ', 13, 'special'],
];

/**
 * Sounds a beginner's attempt is most often heard as (or that a recogniser
 * mixes up). The closed-set kana check listens for the target plus these.
 * Pulled from the language panel review: つ/す, ふ/ほ, the ら row, ん.
 */
const confusions: Record<string, string[]> = {
  つ: ['す', 'ちゅ'],
  す: ['つ'],
  ふ: ['ほ', 'ひゅ'],
  ほ: ['ふ'],
  ら: ['だ', 'な'],
  り: ['で', 'に'],
  る: ['どぅ', 'ぬ'],
  れ: ['で', 'ね'],
  ろ: ['ど', 'の'],
  ん: ['む', 'ぬ'],
  し: ['す', 'ひ'],
  ち: ['し', 'つ'],
  ひ: ['し', 'ふぃ'],
  ず: ['す', 'つ'],
  じ: ['し', 'ち'],
  ゔ: ['ぶ'],
  ゔぁ: ['ば'],
  ゔぃ: ['び'],
  ゔぇ: ['べ'],
  ゔぉ: ['ぼ'],
  てぃ: ['ち'],
  でぃ: ['じ'],
  とぅ: ['つ'],
  ふぁ: ['は'],
  ふぃ: ['ひ'],
  ふぇ: ['へ'],
  ふぉ: ['ほ'],
  きゃ: ['きや'],
  きゅ: ['きゆ'],
  きょ: ['きよ'],
  りゃ: ['りや'],
  りゅ: ['りゆ'],
  りょ: ['りよ'],
};

/** Kana pairs that sound the same in standard Japanese (one sound in the kana check). */
const homophoneSounds = new Set(['お', 'じ', 'ず']);

const difficultyByChapter = (chapter: number): Kana['difficulty'] =>
  chapter === 1 ? 1 : chapter <= 10 ? 2 : chapter === 11 ? 3 : chapter === 12 ? 4 : 5;

function expand(): Kana[] {
  const out: Kana[] = [];
  for (const [hira, kata, romaji, sound, chapter, kind] of rows) {
    const base = {
      kind,
      chapter,
      romaji,
      sound,
      difficulty: difficultyByChapter(chapter),
      ...(confusions[sound] ? { confusableSounds: confusions[sound] } : {}),
    };
    const hId = hira ? `h-${romaji}` : undefined;
    const kId = kata ? `k-${romaji}` : undefined;
    if (hira && hId)
      out.push({ id: hId, char: hira, script: 'hiragana', ...base, ...(kId ? { twinId: kId } : {}) });
    if (kata && kId)
      out.push({ id: kId, char: kata, script: 'katakana', ...base, ...(hId ? { twinId: hId } : {}) });
  }
  // Same-sound groups (お/を, じ/ぢ, ず/づ), within one script.
  for (const k of out) {
    if (!homophoneSounds.has(k.sound)) continue;
    const others = out.filter((o) => o.sound === k.sound && o.script === k.script && o.id !== k.id).map((o) => o.id);
    if (others.length) k.homophoneIds = others;
  }
  return out;
}

export const kana: Kana[] = expand();

export const kanaById: ReadonlyMap<string, Kana> = new Map(kana.map((k) => [k.id, k]));
