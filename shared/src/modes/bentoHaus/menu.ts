// Bento Haus's kitchen: the foods (who holds them, how they're counted), the riddles round 2 asks
// with, and the yōkai customers. All Japanese is kana and draft until the fluent check.
// Pictures are emoji placeholders until the pixel food atlas is drawn (docs/modes/bento-haus.md).

import type { Audience } from '../../protocol.js';

export type Station = 'okazu' | 'yasai' | 'gohan' | 'dessert';
/** How a food is counted: ひとつ, いっぽん (long things), いちまい (flat things), いっこ (small round things). */
export type Counter = 'tsu' | 'hon' | 'mai' | 'ko';

export interface Food {
  id: string;
  kana: string;
  en: string;
  emoji: string;
  station: Station;
  counter: Counter;
  /** Hot food: the snow woman won't take it. */
  hot?: boolean;
}

export const FOODS: readonly Food[] = [
  { id: 'karaage', kana: 'からあげ', en: 'fried chicken', emoji: '🍗', station: 'okazu', counter: 'tsu', hot: true },
  { id: 'tamagoyaki', kana: 'たまごやき', en: 'rolled omelette', emoji: '🍳', station: 'okazu', counter: 'tsu', hot: true },
  { id: 'sakana', kana: 'さかな', en: 'grilled fish', emoji: '🐟', station: 'okazu', counter: 'tsu', hot: true },
  { id: 'tako', kana: 'たこさんウインナー', en: 'octopus sausage', emoji: '🐙', station: 'okazu', counter: 'ko', hot: true },
  { id: 'ebi', kana: 'えびフライ', en: 'fried prawn', emoji: '🍤', station: 'okazu', counter: 'hon', hot: true },
  { id: 'hamba', kana: 'ハンバーグ', en: 'hamburg steak', emoji: '🍖', station: 'okazu', counter: 'tsu', hot: true },
  { id: 'tomato', kana: 'ミニトマト', en: 'cherry tomato', emoji: '🍅', station: 'yasai', counter: 'ko' },
  { id: 'broccoli', kana: 'ブロッコリー', en: 'broccoli', emoji: '🥦', station: 'yasai', counter: 'tsu' },
  { id: 'kyuuri', kana: 'きゅうり', en: 'cucumber', emoji: '🥒', station: 'yasai', counter: 'hon' },
  { id: 'ninjin', kana: 'にんじん', en: 'carrot', emoji: '🥕', station: 'yasai', counter: 'hon' },
  { id: 'onigiri', kana: 'おにぎり', en: 'rice ball', emoji: '🍙', station: 'gohan', counter: 'tsu' },
  { id: 'inari', kana: 'いなり', en: 'inari sushi', emoji: '🍣', station: 'gohan', counter: 'tsu' },
  { id: 'umeboshi', kana: 'うめぼし', en: 'pickled plum', emoji: '🔴', station: 'gohan', counter: 'tsu' },
  { id: 'nori', kana: 'のり', en: 'seaweed sheet', emoji: '🟩', station: 'gohan', counter: 'mai' },
  { id: 'ichigo', kana: 'いちご', en: 'strawberry', emoji: '🍓', station: 'dessert', counter: 'ko' },
  { id: 'ringo', kana: 'うさぎりんご', en: 'bunny-cut apple', emoji: '🍎', station: 'dessert', counter: 'tsu' },
];

export const foodOf = (id: string): Food | undefined => FOODS.find((f) => f.id === id);

/** Counts 1–4 in each counter. Index 0 is 1. */
export const COUNTS: Record<Counter, readonly string[]> = {
  tsu: ['ひとつ', 'ふたつ', 'みっつ', 'よっつ'],
  hon: ['いっぽん', 'にほん', 'さんぼん', 'よんほん'],
  mai: ['いちまい', 'にまい', 'さんまい', 'よんまい'],
  ko: ['いっこ', 'にこ', 'さんこ', 'よんこ'],
};
export const MAX_COUNT = 4;

/** How to say n of a food: round 1 counts everything with ひとつ, ふたつ; later rounds use its own counter. */
export function countWord(food: Food, n: number, ownCounter: boolean): string {
  return COUNTS[ownCounter ? food.counter : 'tsu'][n - 1] ?? String(n);
}

/**
 * How a recogniser may write each food in kanji. Matched before the reader's kana, which can misread
 * them (唐揚げ comes back as とうあげ).
 */
export const KANJI_SPELLINGS: Record<string, readonly string[]> = {
  karaage: ['唐揚げ', '唐揚', 'から揚げ'],
  tamagoyaki: ['卵焼き', '玉子焼き', '玉子焼', '卵焼'],
  sakana: ['魚'],
  tako: ['タコさんウインナー', 'たこさんウィンナー', 'タコさんウィンナー'],
  ebi: ['海老フライ', 'エビフライ', '海老'],
  tomato: ['ミニトマト'],
  kyuuri: ['胡瓜'],
  ninjin: ['人参', '人じん'],
  onigiri: ['お握り', '御握り', 'お結び'],
  inari: ['稲荷', 'いなり寿司', '稲荷寿司'],
  umeboshi: ['梅干し', '梅干'],
  nori: ['海苔'],
  ichigo: ['苺'],
  ringo: ['うさぎ林檎', '林檎', 'ウサギリンゴ'],
};

/** Round 2 describes some foods instead of naming them. */
export const RIDDLES: Record<string, string> = {
  tomato: 'あかくて まるい、ちいさな やさい',
  tako: 'あかくて あしが いっぱい ある おかず',
  ebi: 'うみから きた ながい フライ',
  tamagoyaki: 'きいろくて あまい、たまごの おかず',
  kyuuri: 'かっぱが だいすきな みどりの やさい',
  inari: 'きつねが だいすきな ごはん',
  ringo: 'みみが ある くだもの',
  broccoli: 'ちいさな き みたいな やさい',
  nori: 'くろくて うすい、ぱりぱりの もの',
  umeboshi: 'とても すっぱくて あかい もの',
  onigiri: 'さんかくの ごはん',
  karaage: 'とりにくの あげもの',
};
export const RIDDLE_EN: Record<string, string> = {
  tomato: 'a red, round, little vegetable',
  tako: 'a red side dish with lots of legs',
  ebi: 'a long fried thing from the sea',
  tamagoyaki: 'a yellow, sweet egg side dish',
  kyuuri: 'a green vegetable kappa love',
  inari: 'rice that foxes love',
  ringo: 'a fruit with ears',
  broccoli: 'a vegetable like a little tree',
  nori: 'a black, thin, crispy thing',
  umeboshi: 'a very sour red thing',
  onigiri: 'triangle rice',
  karaage: 'fried chicken pieces',
};

export interface JpLine {
  text: string;
  en: string;
}

export interface Customer {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  audiences: readonly Audience[];
  hello: JpLine;
  perfect: JpLine;
  /** Said when one thing is off; the box is named, never the player. */
  wrong?: JpLine;
  leave: JpLine;
  /** Ways this customer bends their order. */
  rule?: 'all-one' | 'kyuuri' | 'cold' | 'inari-three' | 'onigiri-two';
}

export const CUSTOMERS: readonly Customer[] = [
  {
    id: 'hitotsume',
    name: 'ひとつめこぞう',
    nameEn: 'One-Eyed Boy',
    emoji: '👁️',
    audiences: ['kids', 'family', 'cheeky'],
    hello: { text: 'めが ひとつだから、ぜんぶ ひとつずつ！', en: 'I have one eye, so one of everything!' },
    perfect: { text: 'ひとつずつ！　かんぺき！', en: 'One of each! Perfect!' },
    leave: { text: 'もう いいよ… ほかで たべる…', en: "Never mind… I'll eat somewhere else…" },
    rule: 'all-one',
  },
  {
    id: 'kappa',
    name: 'かっぱ',
    nameEn: 'Kappa',
    emoji: '🐢',
    audiences: ['kids', 'family', 'cheeky'],
    hello: { text: 'きゅうり、ありますか？', en: 'Got any cucumber?' },
    perfect: { text: 'きゅうり、さいこう！', en: 'Cucumber is the best!' },
    leave: { text: 'かわに かえります…', en: "I'm going back to the river…" },
    rule: 'kyuuri',
  },
  {
    id: 'kodanuki',
    name: 'こだぬき',
    nameEn: 'Tanuki cub',
    emoji: '🦝',
    audiences: ['kids', 'family'],
    hello: { text: 'おなか すいた〜', en: "I'm hungry~" },
    perfect: { text: 'おいしそう！　ありがとう！', en: 'Looks yummy! Thank you!' },
    leave: { text: 'ねむく なっちゃった…', en: 'I got sleepy…' },
  },
  {
    id: 'yukionna',
    name: 'ゆきおんな',
    nameEn: 'Snow woman',
    emoji: '❄️',
    audiences: ['family', 'cheeky'],
    hello: { text: 'あつい ものは だめなの。とけちゃうから。', en: 'Nothing hot, please. I melt.' },
    perfect: { text: 'つめたくて、おいしそう。', en: 'Nice and cold. Lovely.' },
    leave: { text: 'さむい ところへ かえります。', en: "I'm going somewhere cold." },
    rule: 'cold',
  },
  {
    id: 'baku',
    name: 'ばく',
    nameEn: 'Baku (dream eater)',
    emoji: '🐘',
    audiences: ['kids', 'family', 'cheeky'],
    hello: { text: 'ゆめを ふたつ… ない？　じゃあ、おにぎり ふたつで いいです。', en: 'Two dreams… none? Then two rice balls is fine.' },
    perfect: { text: 'いい ゆめが みられそう。', en: 'I can feel sweet dreams coming.' },
    leave: { text: 'ねむって きます…', en: "I'm off to sleep…" },
    rule: 'onigiri-two',
  },
  {
    id: 'obaachan',
    name: 'おばあちゃんの ゆうれい',
    nameEn: 'Grandma ghost',
    emoji: '👻',
    audiences: ['kids', 'family', 'cheeky'],
    hello: { text: 'ちゃんと やさいも たべなさいね。', en: 'Eat your vegetables too, dear.' },
    perfect: { text: 'まあ、じょうずね。', en: 'My, how skilful.' },
    leave: { text: 'また こんど くるわね。', en: "I'll come again another time." },
  },
  {
    id: 'zangyou',
    name: 'ざんぎょうの ゆうれい',
    nameEn: 'Overtime ghost',
    emoji: '👔',
    audiences: ['cheeky'],
    hello: { text: 'きょうも ざんぎょうです… はやく おねがいします…', en: 'Overtime again… quickly, please…' },
    perfect: { text: 'これで あさまで がんばれます…', en: 'Now I can work till morning…' },
    leave: { text: '…かいしゃに もどります。', en: '…Back to the office.' },
  },
  {
    id: 'kitsune',
    name: 'デートちゅうの きつね',
    nameEn: 'Fox on a date',
    emoji: '🦊',
    audiences: ['family', 'cheeky'],
    hello: { text: 'かれには にんげんって いって あるの。いなりは みっつだけね。', en: "I told him I'm human. Only three inari, OK?" },
    perfect: { text: 'これなら ばれない！', en: "He'll never know!" },
    leave: { text: 'しっぽが でちゃう… かえります！', en: 'My tail is showing… I have to go!' },
    rule: 'inari-three',
  },
  {
    id: 'influencer',
    name: 'インフルエンサー',
    nameEn: 'Influencer',
    emoji: '📱',
    audiences: ['cheeky'],
    hello: { text: 'しゃしん とるから、かわいく してね！', en: "I'm taking photos, so make it cute!" },
    perfect: { text: 'いいね！　ばえる〜！', en: 'Love it! So photogenic!' },
    wrong: { text: '…これは のせられない。', en: "…I can't post this." },
    leave: { text: 'つぎの おみせ いこっと。', en: "Let's try the next shop." },
  },
  {
    id: 'buchou',
    name: 'のっぺらぼうの ぶちょう',
    nameEn: 'Faceless boss',
    emoji: '🧔',
    audiences: ['cheeky'],
    hello: { text: 'つまの ははの ぶんです。まちがえないで ください。', en: "It's for my mother-in-law. Don't get it wrong." },
    perfect: { text: 'たすかった… ありがとう。', en: "You've saved me… thank you." },
    leave: { text: 'おこられる…', en: "I'm going to get told off…" },
  },
];

export const customersFor = (audience: Audience): Customer[] => CUSTOMERS.filter((c) => c.audiences.includes(audience));
export const customerOf = (id: string): Customer | undefined => CUSTOMERS.find((c) => c.id === id);
