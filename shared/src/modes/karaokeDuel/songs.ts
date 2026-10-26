// Karaoke Duel songs: short ORIGINAL beginner songs (no borrowed lyrics or tunes), written for
// this game. Each line carries its kana (what is scored), hyphenated romaji with one syllable
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

export interface Song {
  id: string;
  title: JpText;
  /** Beats per minute. */
  bpm: number;
  /** The lowest level the song suits. All v1 songs are Kana-level friendly. */
  level: Level;
  lines: readonly SongLine[];
  status: ReviewStatus;
}

export const SONGS: readonly Song[] = [
  {
    id: 'ohayou',
    title: { text: 'おはようソング', kana: 'おはようソング', en: 'Good Morning Song' },
    bpm: 104,
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
    level: 'kana',
    status: 'draft',
    lines: [
      { text: 'ありがとう ありがとう', kana: 'ありがとう ありがとう', romaji: 'a-ri-ga-to-u a-ri-ga-to-u', en: 'Thank you, thank you', melody: [[67, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [64, 1], [65, 0.5], [65, 0.5], [67, 0.5], [65, 0.5], [62, 1]] },
      { text: '今日も 楽しかった', kana: 'きょうも たのしかった', romaji: 'kyo-u-mo ta-no-shi-ka-t-ta', en: 'Today was fun again', melody: [[64, 0.5], [64, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [67, 0.5], [65, 0.5], [64, 0.25], [62, 1.75]] },
      { text: 'また あした 会いましょう', kana: 'また あした あいましょう', romaji: 'ma-ta a-shi-ta a-i-ma-sho-u', en: 'Let’s meet again tomorrow', melody: [[60, 0.5], [62, 0.5], [64, 0.5], [65, 0.5], [67, 1], [69, 0.5], [67, 0.5], [65, 0.5], [64, 0.5], [62, 1]] },
      { text: 'おやすみなさい', kana: 'おやすみなさい', romaji: 'o-ya-su-mi-na-sa-i', en: 'Good night', melody: [[64, 0.5], [62, 0.5], [60, 0.5], [62, 0.5], [64, 0.5], [62, 0.5], [60, 2]] },
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
