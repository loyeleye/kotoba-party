// Karaoke Duel songs: short ORIGINAL beginner songs (no borrowed lyrics or tunes), written for
// this game. The first five are simple sing-alongs (`kids: true`); the rest are grown-up songs in
// the styles a real karaoke box is full of (city pop, enka, an anime opening, an izakaya chant,
// salaryman blues), still with beginner words, and they come up first. Each line carries its kana (what is scored), hyphenated romaji with one syllable
// per mora (the Kana-level guide), English, and a melody of one note per mora.
//
// Melodies are MIDI note numbers (60 = middle C) with lengths in beats; the stage plays them
// with a small Web Audio synth, so no audio files are needed. A small っ gets a (short) note
// so every mora has a slot, but it is a rest for pitch scoring.
//
// Draft content: a fluent speaker should check the lyrics (natural, singable, correct kana)
// and a musician the melodies (do they sit well on the words' pitch accent?).

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';

/** One note: [MIDI number, length in beats]. */
export type Note = readonly [midi: number, beats: number];

export interface SongLine {
  /** As shown to N5+ players (kanji allowed). */
  text: string;
  /** Kana reading, words separated by spaces. This is what pronunciation is scored against. */
  kana: string;
  /** One romaji syllable per mora, hyphenated within a word, words split by spaces. */
  romaji: string;
  en: string;
  /** One note per mora of `kana`. */
  melody: readonly Note[];
}

/** How the stage's backing track sounds (karaokeAudio.ts). */
export type SongStyle = 'nursery' | 'citypop' | 'enka' | 'rock' | 'izakaya' | 'blues';

export interface Song {
  id: string;
  title: JpText;
  /** Beats per minute. */
  bpm: number;
  style: SongStyle;
  /** A children's-style sing-along: played only after the grown-up songs have all come up. */
  kids?: boolean;
  /** The lowest level the song suits. Every song so far is Kana-level friendly (romaji guide). */
  level: Level;
  lines: readonly SongLine[];
  status: ReviewStatus;
}

export const SONGS: readonly Song[] = [
  {
    id: 'ohayou',
    title: { text: 'おはようソング', kana: 'おはようソング', en: 'Good Morning Song' },
    bpm: 104,
    style: 'nursery',
    kids: true,
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'おはよう おはよう', kana: 'おはよう おはよう', romaji: 'o-ha-yo-u o-ha-yo-u', en: 'Good morning, good morning', melody: [[60, 0.5], [62, 0.5], [64, 1], [64, 1], [64, 0.5], [65, 0.5], [67, 1], [67, 1.5]] },
      { text: '朝ごはん 食べよう', kana: 'あさごはん たべよう', romaji: 'a-sa-go-ha-n ta-be-yo-u', en: 'Let’s eat breakfast', melody: [[67, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [64, 1], [65, 0.5], [64, 0.5], [62, 1], [60, 1.5]] },
      { text: 'パンと たまご', kana: 'パンと たまご', romaji: 'pa-n-to ta-ma-go', en: 'Bread and eggs', melody: [[64, 0.5], [64, 0.5], [67, 1], [65, 0.5], [64, 0.5], [62, 2]] },
      { text: 'いってきます！', kana: 'いってきます', romaji: 'i-t-te-ki-ma-su', en: 'I’m off! (said leaving home)', melody: [[67, 0.5], [67, 0.25], [69, 0.75], [71, 0.5], [72, 1], [72, 2]] },
    ],
  },
  {
    id: 'neko',
    title: { text: 'ねこの ひるね', kana: 'ねこの ひるね', en: 'The Cat’s Nap' },
    bpm: 92,
    style: 'nursery',
    kids: true,
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'ねこが ねてる', kana: 'ねこが ねてる', romaji: 'ne-ko-ga ne-te-ru', en: 'The cat is sleeping', melody: [[64, 1], [62, 0.5], [60, 0.5], [64, 1], [67, 1], [67, 2]] },
      { text: '窓の そばで', kana: 'まどの そばで', romaji: 'ma-do-no so-ba-de', en: 'By the window', melody: [[65, 1], [64, 0.5], [62, 0.5], [65, 1], [69, 1], [69, 2]] },
      { text: 'にゃあ にゃあ にゃあ', kana: 'にゃあ にゃあ にゃあ', romaji: 'nya-a nya-a nya-a', en: 'Meow, meow, meow', melody: [[72, 0.5], [69, 0.5], [72, 0.5], [69, 0.5], [67, 1], [64, 1.5]] },
      { text: 'お日さま ぽかぽか', kana: 'おひさま ぽかぽか', romaji: 'o-hi-sa-ma po-ka-po-ka', en: 'The sun is nice and warm', melody: [[62, 0.5], [64, 0.5], [65, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 1], [60, 2]] },
    ],
  },
  {
    id: 'densha',
    title: { text: 'でんしゃで ゴー', kana: 'でんしゃで ゴー', en: 'Go by Train' },
    bpm: 112,
    style: 'nursery',
    kids: true,
    level: 'kana',
    status: 'draft',
    lines: [
      { text: '電車に 乗って', kana: 'でんしゃに のって', romaji: 'de-n-sha-ni no-t-te', en: 'Get on the train', melody: [[60, 0.5], [60, 0.5], [64, 0.5], [67, 0.5], [69, 0.75], [69, 0.25], [67, 1.5]] },
      { text: 'つぎは 東京', kana: 'つぎは とうきょう', romaji: 'tsu-gi-wa to-u-kyo-u', en: 'Next stop, Tokyo', melody: [[67, 0.5], [65, 0.5], [64, 1], [62, 0.5], [62, 0.5], [64, 0.5], [60, 1.5]] },
      { text: '窓から 富士山', kana: 'まどから ふじさん', romaji: 'ma-do-ka-ra fu-ji-sa-n', en: 'Mount Fuji from the window', melody: [[64, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [72, 1], [71, 0.5], [69, 0.5], [67, 1.5]] },
      { text: 'ガタン ゴトン ゴー！', kana: 'ガタン ゴトン ゴー', romaji: 'ga-ta-n go-to-n go-o', en: 'Clickety-clack, let’s go!', melody: [[67, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [72, 1], [72, 1]] },
    ],
  },
  {
    id: 'ramen',
    title: { text: 'ラーメン ブルース', kana: 'ラーメン ブルース', en: 'Ramen Blues' },
    bpm: 84,
    style: 'blues',
    kids: true,
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'おなかが すいた', kana: 'おなかが すいた', romaji: 'o-na-ka-ga su-i-ta', en: 'I’m hungry', melody: [[57, 0.5], [60, 0.5], [62, 0.5], [63, 0.5], [62, 0.5], [60, 0.5], [57, 2]] },
      { text: 'ラーメン ください', kana: 'ラーメン ください', romaji: 'ra-a-me-n ku-da-sa-i', en: 'Ramen, please', melody: [[64, 0.5], [64, 0.5], [62, 0.5], [60, 0.5], [62, 0.5], [60, 0.5], [57, 0.5], [57, 1.5]] },
      { text: '熱い 熱い', kana: 'あつい あつい', romaji: 'a-tsu-i a-tsu-i', en: 'It’s hot, it’s hot', melody: [[69, 0.5], [67, 0.5], [64, 1], [67, 0.5], [64, 0.5], [62, 1]] },
      { text: 'でも おいしい！', kana: 'でも おいしい', romaji: 'de-mo o-i-shi-i', en: 'But it’s delicious!', melody: [[60, 0.5], [62, 0.5], [64, 0.5], [67, 0.5], [64, 1], [69, 2]] },
    ],
  },
  {
    id: 'mata-ashita',
    title: { text: 'また あした', kana: 'また あした', en: 'See You Tomorrow' },
    bpm: 96,
    style: 'nursery',
    kids: true,
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'ありがとう ありがとう', kana: 'ありがとう ありがとう', romaji: 'a-ri-ga-to-u a-ri-ga-to-u', en: 'Thank you, thank you', melody: [[67, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [64, 1], [65, 0.5], [65, 0.5], [67, 0.5], [65, 0.5], [62, 1]] },
      { text: '今日も 楽しかった', kana: 'きょうも たのしかった', romaji: 'kyo-u-mo ta-no-shi-ka-t-ta', en: 'Today was fun again', melody: [[64, 0.5], [64, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [64, 0.25], [62, 1.75]] },
      { text: 'また あした 会いましょう', kana: 'また あした あいましょう', romaji: 'ma-ta a-shi-ta a-i-ma-sho-u', en: 'Let’s meet again tomorrow', melody: [[60, 0.5], [62, 0.5], [64, 0.5], [65, 0.5], [67, 1], [69, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 1]] },
      { text: 'おやすみなさい', kana: 'おやすみなさい', romaji: 'o-ya-su-mi-na-sa-i', en: 'Good night', melody: [[64, 0.5], [62, 0.5], [60, 0.5], [62, 0.5], [64, 0.5], [62, 0.5], [60, 2]] },
    ],
  },
  {
    id: 'yoru-no-drive',
    title: { text: '夜の ドライブ', kana: 'よるの ドライブ', en: 'Night Drive' },
    bpm: 104,
    style: 'citypop',
    level: 'kana',
    status: 'draft',
    lines: [
      { text: '窓を 開けて', kana: 'まどを あけて', romaji: 'ma-do-o a-ke-te', en: 'Roll the window down', melody: [[69, 0.5], [67, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [72, 1.5]] },
      { text: '君の 好きな 歌', kana: 'きみの すきな うた', romaji: 'ki-mi-no su-ki-na u-ta', en: 'The song you love', melody: [[72, 0.5], [74, 0.5], [72, 0.5], [69, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [76, 2]] },
      { text: '街の 光 きれいだね', kana: 'まちの ひかり きれいだね', romaji: 'ma-chi-no hi-ka-ri ki-re-i-da-ne', en: 'The city lights are beautiful, aren’t they', melody: [[76, 0.5], [74, 0.5], [72, 0.5], [74, 0.5], [72, 0.5], [69, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [67, 0.5], [65, 1.5]] },
      { text: '海まで 行こう', kana: 'うみまで いこう', romaji: 'u-mi-ma-de i-ko-u', en: 'Let’s drive all the way to the sea', melody: [[65, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [74, 0.5], [72, 0.5], [77, 2]] },
    ],
  },
  {
    id: 'ame-no-minato',
    title: { text: '雨の 港', kana: 'あめの みなと', en: 'Harbour in the Rain' },
    bpm: 76,
    style: 'enka',
    level: 'kana',
    status: 'draft',
    lines: [
      { text: '雨の 港', kana: 'あめの みなと', romaji: 'a-me-no mi-na-to', en: 'The harbour in the rain', melody: [[65, 0.5], [64, 0.5], [64, 0.5], [69, 1], [71, 0.5], [69, 2]] },
      { text: 'あなたは 来ない', kana: 'あなたは こない', romaji: 'a-na-ta-wa ko-na-i', en: 'You aren’t coming', melody: [[72, 0.5], [71, 0.5], [69, 0.5], [65, 0.5], [64, 0.5], [65, 0.5], [64, 2]] },
      { text: '一人で 飲む お酒', kana: 'ひとりで のむ おさけ', romaji: 'hi-to-ri-de no-mu o-sa-ke', en: 'Sake I drink alone', melody: [[60, 0.5], [64, 0.5], [65, 0.5], [64, 0.5], [69, 0.5], [71, 0.5], [69, 0.5], [65, 0.5], [64, 1.25]] },
      { text: 'さよなら あなた', kana: 'さよなら あなた', romaji: 'sa-yo-na-ra a-na-ta', en: 'Goodbye, my love', melody: [[69, 0.5], [72, 0.5], [71, 0.5], [69, 0.5], [65, 0.5], [64, 0.5], [57, 2.5]] },
    ],
  },
  {
    id: 'hashire',
    title: { text: '走れ！', kana: 'はしれ', en: 'Run!' },
    bpm: 152,
    style: 'rock',
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'もっと 速く', kana: 'もっと はやく', romaji: 'mo-t-to ha-ya-ku', en: 'Faster, faster', melody: [[64, 0.5], [64, 0.5], [67, 0.5], [69, 0.5], [71, 0.5], [74, 1.5]] },
      { text: '夢に 向かって', kana: 'ゆめに むかって', romaji: 'yu-me-ni mu-ka-t-te', en: 'Toward my dream', melody: [[74, 0.5], [76, 0.5], [74, 0.5], [71, 0.5], [74, 0.75], [74, 0.25], [76, 2]] },
      { text: '負けない 心', kana: 'まけない こころ', romaji: 'ma-ke-na-i ko-ko-ro', en: 'A heart that won’t give in', melody: [[76, 0.5], [74, 0.5], [72, 0.5], [71, 0.5], [72, 0.5], [74, 0.5], [71, 2]] },
      { text: '今だ 飛べ！', kana: 'いまだ とべ', romaji: 'i-ma-da to-be', en: 'Now — fly!', melody: [[71, 0.5], [74, 0.5], [76, 1], [79, 1], [79, 3]] },
    ],
  },
  {
    id: 'kanpai',
    title: { text: '乾杯！', kana: 'かんぱい', en: 'Cheers!' },
    bpm: 120,
    style: 'izakaya',
    level: 'kana',
    status: 'draft',
    lines: [
      { text: '仕事が 終わった', kana: 'しごとが おわった', romaji: 'shi-go-to-ga o-wa-t-ta', en: 'Work is over', melody: [[67, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [62, 0.5], [62, 0.25], [60, 1.75]] },
      { text: 'とりあえず ビール', kana: 'とりあえず ビール', romaji: 'to-ri-a-e-zu bi-i-ru', en: 'A beer to start with', melody: [[64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [62, 0.5], [69, 1], [69, 0.5], [67, 1.5]] },
      { text: '乾杯 乾杯！', kana: 'かんぱい かんぱい', romaji: 'ka-n-pa-i ka-n-pa-i', en: 'Cheers, cheers!', melody: [[72, 0.5], [72, 0.5], [69, 0.5], [67, 0.5], [72, 0.5], [72, 0.5], [69, 0.5], [67, 1.5]] },
      { text: 'もう 一杯！', kana: 'もう いっぱい', romaji: 'mo-u i-p-pa-i', en: 'One more round!', melody: [[67, 0.5], [69, 0.5], [72, 0.75], [72, 0.25], [74, 1], [72, 2]] },
    ],
  },
  {
    id: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 88,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    lines: [
      { text: '朝の 満員電車', kana: 'あさの まんいんでんしゃ', romaji: 'a-sa-no ma-n-i-n-de-n-sha', en: 'The packed morning train', melody: [[57, 0.5], [60, 0.5], [62, 0.5], [63, 0.5], [64, 0.5], [64, 0.5], [62, 0.5], [60, 0.5], [60, 0.5], [57, 1.5]] },
      { text: '部長は 怒ってる', kana: 'ぶちょうは おこってる', romaji: 'bu-cho-u-wa o-ko-t-te-ru', en: 'The boss is angry', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [63, 0.5], [62, 0.5], [62, 0.25], [60, 0.75], [57, 1.5]] },
      { text: '残業 今日も', kana: 'ざんぎょう きょうも', romaji: 'za-n-gyo-u kyo-u-mo', en: 'Overtime again today', melody: [[69, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [62, 2]] },
      { text: '早く 帰りたい', kana: 'はやく かえりたい', romaji: 'ha-ya-ku ka-e-ri-ta-i', en: 'I just want to go home', melody: [[60, 0.5], [62, 0.5], [63, 0.5], [64, 1], [67, 0.5], [64, 0.5], [62, 0.5], [57, 2]] },
    ],
  },
];

/** Small kana that join the kana before them into one mora (きょ, ファ …). */
const JOINERS = new Set([...'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ']);

/**
 * Splits kana into morae: きょう → きょ・う, がっこう → が・っ・こ・う, ラーメン → ラ・ー・メ・ン.
 * Spaces and punctuation are dropped; anything that isn't kana counts as its own mora.
 */
export function splitMorae(kana: string): string[] {
  const out: string[] = [];
  for (const ch of kana.normalize('NFKC').replace(/[\s、。，．,.!?！？「」『』（）()・〜~…"'“”‘’]/g, '')) {
    if (JOINERS.has(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** The line's morae grouped by word (for display: words keep their spacing). */
export function wordsOf(line: SongLine): string[][] {
  return line.kana.split(/\s+/).filter(Boolean).map(splitMorae);
}

/** One romaji syllable per mora, in order. */
export function romajiMorae(line: SongLine): string[] {
  return line.romaji.split(/[\s-]+/).filter(Boolean);
}

/**
 * The romaji as it is sung, for display only (scoring keeps romajiMorae): a long-vowel う after an
 * o-sound is held as "o" (o-ha-yo-o), い after an e-sound as "e", and a small っ is a silent beat.
 */
export function sungRomaji(morae: readonly string[]): string[] {
  return morae.map((m, i) => {
    const prev = morae[i - 1] ?? '';
    if (m === 'u' && prev.endsWith('o')) return 'o';
    if (m === 'i' && prev.endsWith('e')) return 'e';
    if (/^[kstpcg]$/.test(m)) return '·';
    return m;
  });
}

/** ms per beat at a tempo. */
export const beatMs = (bpm: number): number => 60_000 / bpm;

/** Each note's start and length in ms from the line's first beat. */
export function noteTimes(line: SongLine, bpm: number): { startMs: number; ms: number; midi: number }[] {
  const beat = beatMs(bpm);
  let at = 0;
  return line.melody.map(([midi, beats]) => {
    const note = { startMs: Math.round(at), ms: Math.round(beats * beat), midi };
    at += beats * beat;
    return note;
  });
}

/** How long a line lasts, first beat to the end of its last note. */
export function lineMs(line: SongLine, bpm: number): number {
  return Math.round(line.melody.reduce((n, [, beats]) => n + beats, 0) * beatMs(bpm));
}
