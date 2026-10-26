// Kana Yōkai Raid decks: chapters, Wave 2 look-alikes, Wave 3 minimal pairs
// and Boss word yōkai. The kana themselves are in kana.ts.

import type { BossWord, KanaChapter, LookAlikeSet, MinimalPair } from '../types.js';
import { kana } from './kana.js';

const COURSE = 'https://www.youtube.com/watch?v=PGJ7JWSgst0';
const idsIn = (chapter: number) => kana.filter((k) => k.chapter === chapter).map((k) => k.id);

export const kanaChapters: KanaChapter[] = [
  {
    number: 1,
    title: { text: '母音', kana: 'ぼいん', en: 'Vowels' },
    videoUrl: `${COURSE}&t=125s`,
    kanaIds: idsIn(1),
    leaderYokai: {
      name: { text: 'から傘小僧', kana: 'からかさこぞう', en: 'Karakasa-kozō, the umbrella spirit' },
      source: 'A one-eyed paper umbrella that hops on one leg; a tsukumogami from Edo-period picture scrolls and obake karuta cards.',
      bio: 'Fell out of the dictionary on page あ and has been shouting vowels ever since.',
    },
  },
  {
    number: 2,
    title: { text: 'か行', kana: 'かぎょう', en: 'K row' },
    videoUrl: `${COURSE}&t=901s`,
    kanaIds: idsIn(2),
    leaderYokai: {
      name: { text: '河童', kana: 'かっぱ', en: 'Kappa, the river imp' },
      source: 'A river yōkai with a water-filled dish on its head, found in folklore all over Japan; famously fond of cucumbers.',
      bio: 'Will trade any kana for a cucumber. Do not bow; its dish will spill.',
    },
  },
  {
    number: 3,
    title: { text: 'さ行', kana: 'さぎょう', en: 'S row' },
    videoUrl: `${COURSE}&t=1655s`,
    kanaIds: idsIn(3),
    leaderYokai: {
      name: { text: '猫又', kana: 'ねこまた', en: 'Nekomata, the forked-tail cat' },
      source: 'A cat that grows old and splits its tail in two; already mentioned in Yoshida Kenkō’s Tsurezuregusa (14th century).',
      bio: 'Two tails, so it writes シ and ツ at the same time to confuse you.',
    },
  },
  {
    number: 4,
    title: { text: 'た行', kana: 'たぎょう', en: 'T row' },
    videoUrl: `${COURSE}&t=2290s`,
    kanaIds: idsIn(4),
    leaderYokai: {
      name: { text: '天狗', kana: 'てんぐ', en: 'Tengu, the mountain goblin' },
      source: 'A mountain spirit with a long nose or a bird’s beak, from folklore, temple legends and Noh plays.',
      bio: 'Very proud of its nose. Very proud of つ. Less proud of ち.',
    },
  },
  {
    number: 5,
    title: { text: 'な行', kana: 'なぎょう', en: 'N row' },
    videoUrl: `${COURSE}&t=3012s`,
    kanaIds: idsIn(5),
    leaderYokai: {
      name: { text: 'ろくろ首', kana: 'ろくろくび', en: 'Rokurokubi, the long-necked one' },
      source: 'A person by day whose neck stretches at night; a favourite of Edo-period ghost stories.',
      bio: 'Stretches its neck to peek at your answer. Still can’t tell ぬ from め.',
    },
  },
  {
    number: 6,
    title: { text: 'は行', kana: 'はぎょう', en: 'H row' },
    videoUrl: `${COURSE}&t=3680s`,
    kanaIds: idsIn(6),
    leaderYokai: {
      name: { text: '一反木綿', kana: 'いったんもめん', en: 'Ittan-momen, the flying cloth' },
      source: 'A long strip of cotton that flies at night and wraps around people; from the folklore of Kagoshima.',
      bio: 'Flaps like ふ, flutters like へ, and has never once landed on time.',
    },
  },
  {
    number: 7,
    title: { text: 'ま行', kana: 'まぎょう', en: 'M row' },
    videoUrl: `${COURSE}&t=4479s`,
    kanaIds: idsIn(7),
    leaderYokai: {
      name: { text: 'のっぺらぼう', kana: 'のっぺらぼう', en: 'Noppera-bō, the faceless ghost' },
      source: 'A ghost with a smooth, featureless face; retold in English by Lafcadio Hearn in Kwaidan (1904).',
      bio: 'Has no mouth, so it needs you to say み for it.',
    },
  },
  {
    number: 8,
    title: { text: 'や行', kana: 'やぎょう', en: 'Y row' },
    videoUrl: `${COURSE}&t=5086s`,
    kanaIds: idsIn(8),
    leaderYokai: {
      name: { text: '雪女', kana: 'ゆきおんな', en: 'Yuki-onna, the snow woman' },
      source: 'A pale spirit of snowstorms in the mountains; another tale in Hearn’s Kwaidan.',
      bio: 'Only three kana in her row, and she likes it cold and quiet.',
    },
  },
  {
    number: 9,
    title: { text: 'ら行', kana: 'らぎょう', en: 'R row' },
    videoUrl: `${COURSE}&t=5597s`,
    kanaIds: idsIn(9),
    leaderYokai: {
      name: { text: '座敷童子', kana: 'ざしきわらし', en: 'Zashiki-warashi, the house child' },
      source: 'A child spirit that brings luck to the house it lives in; recorded in Yanagita Kunio’s Tōno Monogatari (1910).',
      bio: 'Rolls its ら like a ball across the tatami. Brings luck if you catch it.',
    },
  },
  {
    number: 10,
    title: { text: 'わ行とん', kana: 'わぎょうとん', en: 'W row and ん' },
    videoUrl: `${COURSE}&t=6220s`,
    kanaIds: idsIn(10),
    leaderYokai: {
      name: { text: '鬼', kana: 'おに', en: 'Oni, the horned ogre' },
      source: 'Horned ogres of folklore, chased out of homes with roasted beans every Setsubun.',
      bio: 'Ends every sentence with ん. Runs from beans.',
    },
  },
  {
    number: 11,
    title: { text: '濁音と半濁音', kana: 'だくおんとはんだくおん', en: 'Voiced sounds and small っ' },
    videoUrl: `${COURSE}&t=7001s`,
    kanaIds: idsIn(11),
    leaderYokai: {
      name: { text: '狐', kana: 'きつね', en: 'Kitsune, the shape-shifting fox' },
      source: 'A fox that gains magic and new tails with age; foxes are also the messengers of Inari shrines.',
      bio: 'Adds two little marks and か becomes が. Classic fox trick.',
    },
  },
  {
    number: 12,
    title: { text: '拗音', kana: 'ようおん', en: 'Combinations and the long-vowel mark' },
    videoUrl: `${COURSE}&t=7580s`,
    kanaIds: idsIn(12),
    leaderYokai: {
      name: { text: '鵺', kana: 'ぬえ', en: 'Nue, the chimera' },
      source: 'A beast with a monkey’s face, a tanuki’s body, a tiger’s legs and a snake for a tail; from the Tale of the Heike.',
      bio: 'Made of four animals, so of course it loves き + ゃ = きゃ.',
    },
  },
  {
    number: 13,
    title: { text: '特殊カタカナ', kana: 'とくしゅカタカナ', en: 'Special katakana' },
    videoUrl: `${COURSE}&t=7973s`,
    kanaIds: idsIn(13),
    leaderYokai: {
      name: { text: '雲外鏡', kana: 'うんがいきょう', en: 'Ungaikyō, the far-seeing mirror' },
      source: 'An old mirror spirit drawn by Toriyama Sekien in Hyakki Tsurezure Bukuro (1784).',
      bio: 'Reflects sounds from far away: ファ, ティ, ヴォ. Very fancy. Very shiny.',
    },
  },
];

/** Wave 2: Shapeshifters. Tips are original; don't copy published mnemonics. */
export const lookAlikeSets: LookAlikeSet[] = [
  {
    id: 'shi-tsu',
    kanaIds: ['k-shi', 'k-tsu'],
    tip: 'シ’s short strokes sit on the left and its long stroke sweeps up; ツ’s short strokes sit on top and its long stroke falls down.',
  },
  {
    id: 'so-n',
    kanaIds: ['k-so', 'k-n'],
    tip: 'ソ’s long stroke falls from the top; ン’s rises from the bottom-left.',
  },
  {
    id: 'shi-tsu-so-n',
    kanaIds: ['k-shi', 'k-tsu', 'k-so', 'k-n'],
    tip: 'Two dots: シ or ツ. One dot: ソ or ン. Then check which way the long stroke goes.',
  },
  { id: 'nu-me', kanaIds: ['h-nu', 'h-me'], tip: 'ぬ has a little loop at the end of its tail; め doesn’t.' },
  {
    id: 'wa-ne-re',
    kanaIds: ['h-wa', 'h-ne', 'h-re'],
    tip: 'They share a left stroke. わ curves round, ね ends in a loop, れ kicks out to the right.',
  },
  { id: 'ha-ho', kanaIds: ['h-ha', 'h-ho'], tip: 'ほ has a lid: one more line across the top than は.' },
  { id: 'ru-ro', kanaIds: ['h-ru', 'h-ro'], tip: 'る ends in a loop; ろ is open at the bottom.' },
  { id: 'sa-chi', kanaIds: ['h-sa', 'h-chi'], tip: 'さ opens to the left; ち opens to the right. They’re mirror images.' },
  { id: 'ki-sa', kanaIds: ['h-ki', 'h-sa'], tip: 'き has two lines across the top; さ has one.' },
  { id: 'i-ri', kanaIds: ['h-i', 'h-ri'], tip: 'い’s two strokes are the same height; り’s right stroke is long and drops down.' },
  { id: 'ku-ke-ta', kanaIds: ['k-ku', 'k-ke', 'k-ta'], tip: 'ク is the base. タ adds a stroke inside; ケ’s top stroke runs straight across.' },
  { id: 'u-wa-fu', kanaIds: ['k-u', 'k-wa', 'k-fu'], tip: 'ウ wears a hat (a dot on top); ワ is ウ without its hat; フ has only the top and side.' },
  { id: 'a-ma', kanaIds: ['k-a', 'k-ma'], tip: 'ア has a stroke dropping from the middle of its top; マ ends with a short tick.' },
  { id: 'ko-yu', kanaIds: ['k-ko', 'k-yu'], tip: 'コ is open on the left; ユ is open on the top, with a long base.' },
  { id: 'chi-te', kanaIds: ['k-chi', 'k-te'], tip: 'チ’s top stroke slants; テ’s top stroke is flat, like a table edge.' },
  { id: 'na-me', kanaIds: ['k-na', 'k-me'], tip: 'ナ is a plus with a tail; メ is a cross with no line across.' },
  { id: 'he-he', kanaIds: ['h-he', 'k-he'], tip: 'Trick yōkai: へ and ヘ look almost the same in both scripts. Both say へ.' },
  { id: 'ri-ri', kanaIds: ['h-ri', 'k-ri'], tip: 'り and リ are twins that look alike too; katakana リ is straighter.' },
  { id: 'ka-ka', kanaIds: ['h-ka', 'k-ka'], tip: 'か has an extra little stroke on the right; カ doesn’t.' },
];

/** Wave 3: Long and Short. Sounds that change meaning (language panel). */
export const minimalPairs: MinimalPair[] = [
  {
    id: 'obasan-obaasan',
    contrast: 'long-vowel',
    a: { text: 'おばさん', kana: 'おばさん', en: 'aunt; middle-aged woman' },
    b: { text: 'おばあさん', kana: 'おばあさん', en: 'grandmother; old woman' },
    minChapter: 11,
  },
  {
    id: 'ojisan-ojiisan',
    contrast: 'long-vowel',
    a: { text: 'おじさん', kana: 'おじさん', en: 'uncle; middle-aged man' },
    b: { text: 'おじいさん', kana: 'おじいさん', en: 'grandfather; old man' },
    minChapter: 11,
  },
  {
    id: 'koko-koukou',
    contrast: 'long-vowel',
    a: { text: 'ここ', kana: 'ここ', en: 'here' },
    b: { text: '高校', kana: 'こうこう', en: 'high school', furigana: [['高校', 'こうこう']] },
    minChapter: 2,
  },
  {
    id: 'ie-iie',
    contrast: 'long-vowel',
    a: { text: '家', kana: 'いえ', en: 'house', furigana: [['家', 'いえ']] },
    b: { text: 'いいえ', kana: 'いいえ', en: 'no' },
    minChapter: 1,
  },
  {
    id: 'yuki-yuuki',
    contrast: 'long-vowel',
    a: { text: '雪', kana: 'ゆき', en: 'snow', furigana: [['雪', 'ゆき']] },
    b: { text: '勇気', kana: 'ゆうき', en: 'courage', furigana: [['勇気', 'ゆうき']] },
    minChapter: 8,
  },
  {
    id: 'shujin-shuujin',
    contrast: 'long-vowel',
    a: { text: '主人', kana: 'しゅじん', en: 'husband; master of the house', furigana: [['主人', 'しゅじん']] },
    b: { text: '囚人', kana: 'しゅうじん', en: 'prisoner', furigana: [['囚人', 'しゅうじん']] },
    minChapter: 12,
  },
  {
    id: 'chizu-chiizu',
    contrast: 'long-mark',
    a: { text: '地図', kana: 'ちず', en: 'map', furigana: [['地図', 'ちず']] },
    b: { text: 'チーズ', kana: 'チーズ', en: 'cheese' },
    minChapter: 12,
  },
  {
    id: 'biru-biiru',
    contrast: 'long-mark',
    a: { text: 'ビル', kana: 'ビル', en: 'building' },
    b: { text: 'ビール', kana: 'ビール', en: 'beer' },
    minChapter: 12,
  },
  {
    id: 'kite-kitte',
    contrast: 'small-tsu',
    a: { text: '来て', kana: 'きて', en: 'come (please)', furigana: [['来', 'き'], ['て', '']] },
    b: { text: '切手', kana: 'きって', en: 'postage stamp', furigana: [['切手', 'きって']] },
    minChapter: 11,
  },
  {
    id: 'oto-otto',
    contrast: 'small-tsu',
    a: { text: '音', kana: 'おと', en: 'sound', furigana: [['音', 'おと']] },
    b: { text: '夫', kana: 'おっと', en: 'husband', furigana: [['夫', 'おっと']] },
    minChapter: 11,
  },
  {
    id: 'saka-sakka',
    contrast: 'small-tsu',
    a: { text: '坂', kana: 'さか', en: 'slope; hill', furigana: [['坂', 'さか']] },
    b: { text: '作家', kana: 'さっか', en: 'writer; author', furigana: [['作家', 'さっか']] },
    minChapter: 11,
  },
  {
    id: 'kinen-kinnen',
    contrast: 'n',
    a: { text: '記念', kana: 'きねん', en: 'commemoration; souvenir', furigana: [['記念', 'きねん']] },
    b: { text: '禁煙', kana: 'きんえん', en: 'no smoking', furigana: [['禁煙', 'きんえん']] },
    minChapter: 10,
  },
  {
    id: 'tenki-denki',
    contrast: 'voicing',
    a: { text: '天気', kana: 'てんき', en: 'weather', furigana: [['天気', 'てんき']] },
    b: { text: '電気', kana: 'でんき', en: 'electricity; the lights', furigana: [['電気', 'でんき']] },
    minChapter: 11,
  },
  {
    id: 'kaki-kagi',
    contrast: 'voicing',
    a: { text: '柿', kana: 'かき', en: 'persimmon', furigana: [['柿', 'かき']] },
    b: { text: '鍵', kana: 'かぎ', en: 'key', furigana: [['鍵', 'かぎ']] },
    minChapter: 11,
  },
];

/** Split a word into the pieces players break: small kana join the one before. */
const pieces = (word: string): string[] => {
  const out: string[] = [];
  for (const ch of word) {
    if (/[ゃゅょャュョァィゥェォ]/.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
};

const boss = (id: string, text: string, en: string, packId?: string): BossWord => {
  const p = pieces(text);
  const chapters = p.map((c) => kana.find((k) => k.char === c)?.chapter ?? 13);
  return {
    id,
    word: { text, kana: text, en },
    pieces: p,
    minChapter: Math.max(...chapters),
    ...(packId ? { packId } : {}),
  };
};

/** Boss: Word Yōkai. Real things you'll read on menus, stations and shop signs. */
export const bossWords: BossWord[] = [
  boss('kamera', 'カメラ', 'camera'),
  boss('hoteru', 'ホテル', 'hotel', 'travel'),
  boss('terebi', 'テレビ', 'TV'),
  boss('pan', 'パン', 'bread', 'food'),
  boss('keeki', 'ケーキ', 'cake', 'food'),
  boss('biiru', 'ビール', 'beer', 'food'),
  boss('takushii', 'タクシー', 'taxi', 'travel'),
  boss('koohii', 'コーヒー', 'coffee', 'travel'),
  boss('raamen', 'ラーメン', 'ramen', 'food'),
  boss('karaoke', 'カラオケ', 'karaoke'),
  boss('toire', 'トイレ', 'toilet', 'travel'),
  boss('konbini', 'コンビニ', 'convenience store', 'travel'),
  boss('sumaho', 'スマホ', 'smartphone'),
  boss('juusu', 'ジュース', 'juice', 'food'),
  boss('menyuu', 'メニュー', 'menu', 'food'),
  boss('chiketto', 'チケット', 'ticket', 'travel'),
  boss('sandoicchi', 'サンドイッチ', 'sandwich', 'travel'),
  boss('aisukuriimu', 'アイスクリーム', 'ice cream', 'travel'),
  boss('erebeetaa', 'エレベーター', 'elevator', 'travel'),
  boss('paatii', 'パーティー', 'party'),
  boss('tisshu', 'ティッシュ', 'tissues'),
  boss('fooku', 'フォーク', 'fork', 'food'),
  boss('famiresu', 'ファミレス', 'family restaurant', 'food'),
  boss('chekkuin', 'チェックイン', 'check-in', 'travel'),
  boss('waifai', 'ワイファイ', 'Wi-Fi', 'travel'),
];
