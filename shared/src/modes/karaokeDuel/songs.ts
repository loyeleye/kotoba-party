// Karaoke Duel songs: short ORIGINAL beginner songs (no borrowed lyrics or tunes), written for
// this game. The first five are simple sing-alongs (`kids: true`); the rest are grown-up songs in
// the styles a real karaoke box is full of (city pop, enka, an anime opening, an izakaya chant,
// salaryman blues, a Shōwa duet, a self-intro rap, idol pop, an R&B ballad), still with beginner words, and they
// come up first. Their melodies follow the words' pitch accent where they can. Each line carries its kana (what is scored), hyphenated romaji with one syllable
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
  /**
   * The backing's chords, spread evenly over the line ("Bbmaj7 Am7"); the bass plays their roots.
   * Without chords the bass follows the melody (the kids' songs).
   */
  chords?: string;
}

/** How the stage's backing track sounds (karaokeAudio.ts). */
export type SongStyle = 'nursery' | 'citypop' | 'enka' | 'rock' | 'izakaya' | 'blues' | 'kayou' | 'hiphop' | 'idol' | 'rnb';

/**
 * A produced instrumental the song is sung over. The file and its credit live with the stage's
 * recorded tracks (stage/src/music/tracks.ts, under this id); the licence is in
 * docs/commercial-blockers.md.
 */
export interface SongTrack {
  id: string;
  /** Seconds into the file where its bar 0 starts (the downbeat its bar grid counts from). */
  start: number;
  /**
   * The song as stretches of the file, in its bars ([from, to), 4 beats a bar at the song's tempo),
   * played back to back: e.g. the intro, then the main groove looped to the song's length. Beat 0 of
   * the song is the start of the first stretch. Cuts fall on the start of the file's chord loop, so
   * they are seamless.
   */
  segments: readonly (readonly [from: number, to: number])[];
}

/** A song's length in beats when it plays a track (the sum of its stretches). */
export const trackBeats = (track: SongTrack): number => track.segments.reduce((n, [a, b]) => n + 4 * (b - a), 0);

/** Where a line is sung in a continuous song: its first beat (from beat 0) and who sings it. */
export interface Placement {
  line: number;
  beat: number;
  /** The duelist who opens the song (A) or the other one (B). */
  by: 'A' | 'B';
}

/**
 * The usual shape of a continuous song: an intro, verse 1 (lines 0–3), the chorus (4–7), verse 2
 * (8–11) and the chorus again, one line every `every` beats, with `breakBeats` of instrumental
 * between the first chorus and verse 2. The duelists trade lines (A B A B), and swap for the second
 * half so that each sings every chorus line once.
 */
export function standardForm(introBeats: number, every = 8, breakBeats = 0): Placement[] {
  return songForm([introBeats, introBeats + 4 * every, introBeats + 8 * every + breakBeats, introBeats + 12 * every + breakBeats], every);
}

/**
 * The same shape with each section placed on its own beat (verse 1, chorus, verse 2, chorus), for a
 * track whose sections have instrumental bars between them.
 */
export function songForm(starts: readonly [verse1: number, chorus: number, verse2: number, chorus2: number], every = 8): Placement[] {
  const sections = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [4, 5, 6, 7]] as const;
  return sections.flatMap((lines, sec) =>
    lines.map((line, i) => {
      const k = sec * 4 + i;
      return { line, beat: starts[sec]! + i * every, by: (k + Math.floor(k / 8)) % 2 === 0 ? ('A' as const) : ('B' as const) };
    }),
  );
}

export interface Song {
  id: string;
  title: JpText;
  /** Beats per minute (the track's own tempo, when it has one). */
  bpm: number;
  style: SongStyle;
  /**
   * A continuous song: the whole song plays as one track and the duelists trade lines as placed
   * here. Without it the song is a short sing-along: every line sung by both duelists in turn,
   * each turn with its own count-in.
   */
  form?: readonly Placement[];
  /** The produced instrumental (continuous songs). Without one the synth plays the backing. */
  track?: SongTrack;
  /**
   * Versions of one song share a group (same title, different backing and lyrics); each game plays
   * one of them, picked at random.
   */
  group?: string;
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
    // Night Drive, version A, over an AI-made city-pop backing (Mureka, take 2; tracks.ts). The lines fit
    // the chords it really plays: verse D | D, Bm | Bm, Em | Gm (a minor iv), D | A7; chorus D | Em,
    // A7 | D, B7 | Em, Gm | A7. The title comes twice a chorus, the second time up to F♯5 on ラ. Verse 2
    // goes round in circles, and then the sat-nav is lost too, so the last chorus means "lost forever".
    id: 'yoru-no-drive',
    group: 'yoru-no-drive',
    title: { text: '夜の ドライブ', kana: 'よるの ドライブ', en: 'Night Drive' },
    bpm: 100,
    style: 'citypop',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'night-drive-satnav', start: 0, segments: [[0, 38]] },
    lines: [
      { text: '窓を 開けて', kana: 'まどを あけて', romaji: 'ma-do-o a-ke-te', en: 'Roll the window down', chords: 'Dmaj7 Dmaj7', melody: [[74, 1], [69, 0.5], [69, 0.5], [66, 1], [69, 0.5], [69, 2.5]] },
      { text: '君と 二人', kana: 'きみと ふたり', romaji: 'ki-mi-to fu-ta-ri', en: 'Just you and me', chords: 'Bm7 Bm7', melody: [[66, 0.5], [71, 0.5], [71, 1], [66, 0.5], [71, 0.5], [74, 3]] },
      { text: '街が きれいだね', kana: 'まちが きれいだね', romaji: 'ma-chi-ga ki-re-i-da-ne', en: 'The city is so pretty, isn’t it', chords: 'Em7 Gm', melody: [[67, 0.5], [71, 0.5], [67, 1], [74, 1], [71, 0.5], [71, 0.5], [67, 1], [67, 2]] },
      { text: '今から 海へ', kana: 'いまから うみへ', romaji: 'i-ma-ka-ra u-mi-e', en: 'Off to the sea, right now', chords: 'Dmaj7 A7', melody: [[74, 1], [69, 0.5], [69, 0.5], [66, 1], [74, 0.5], [73, 0.5], [73, 2]] },
      { text: '夜の ドライブ', kana: 'よるの ドライブ', romaji: 'yo-ru-no do-ra-i-bu', en: 'Night drive', chords: 'Dmaj7 Em7', melody: [[74, 1], [69, 0.5], [69, 0.5], [69, 1], [74, 1], [71, 0.5], [67, 2.5]] },
      { text: 'どこまでも 行こう', kana: 'どこまでも いこう', romaji: 'do-ko-ma-de-mo i-ko-u', en: 'Let’s go as far as the road goes', chords: 'A7 Dmaj7', melody: [[76, 1], [73, 0.5], [73, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [74, 0.5], [74, 2.5]] },
      { text: '夜の ドライブ', kana: 'よるの ドライブ', romaji: 'yo-ru-no do-ra-i-bu', en: 'Night drive', chords: 'B7 Em7', melody: [[71, 1], [66, 0.5], [66, 0.5], [71, 1], [78, 1], [76, 0.5], [71, 2.5]] },
      { text: '二人だけの 道', kana: 'ふたりだけの みち', romaji: 'fu-ta-ri-da-ke-no mi-chi', en: 'A road just for the two of us', chords: 'Gm A7', melody: [[67, 0.5], [69, 0.5], [74, 1.5], [69, 0.5], [69, 0.5], [67, 0.5], [69, 0.5], [73, 2.5]] },
      { text: 'あれ？ この 道', kana: 'あれ この みち', romaji: 'a-re ko-no mi-chi', en: 'Huh? This road…', chords: 'Dmaj7 Dmaj7', melody: [[66, 0.5], [69, 1.5], [66, 0.5], [69, 0.5], [69, 0.5], [74, 2.5]] },
      { text: '前にも 見た', kana: 'まえにも みた', romaji: 'ma-e-ni-mo mi-ta', en: 'I’ve seen it before', chords: 'Bm7 Bm7', melody: [[74, 1], [71, 0.5], [71, 0.5], [66, 1], [74, 1], [66, 2.5]] },
      { text: 'ナビも 聞く', kana: 'ナビも きく', romaji: 'na-bi-mo ki-ku', en: 'And the sat-nav asks:', chords: 'Em7 Gm', melody: [[74, 1], [71, 0.5], [67, 0.5], [67, 0.5], [74, 2.5]] },
      { text: '「ここは どこ？」', kana: 'ここは どこ', romaji: 'ko-ko-wa do-ko', en: '“Where am I?”', chords: 'Dmaj7 A7', melody: [[66, 1], [69, 0.5], [69, 0.5], [74, 1], [73, 3]] },
    ],
  },
  {
    // Night Drive, version B, over the other Mureka take: verse G | A7, D | Bm (the IV–V–I–vi of J-pop);
    // chorus D | B7, Em | A7. A smooth date song to a passenger who has fallen asleep: the gentle song
    // on the stereo was the lullaby. Each game plays one of the two versions.
    id: 'yoru-no-drive-b',
    group: 'yoru-no-drive',
    title: { text: '夜の ドライブ', kana: 'よるの ドライブ', en: 'Night Drive' },
    bpm: 100,
    style: 'citypop',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'night-drive-asleep', start: 0, segments: [[0, 39]] },
    lines: [
      { text: '金曜日の 夜', kana: 'きんようびの よる', romaji: 'ki-n-yo-u-bi-no yo-ru', en: 'Friday night', chords: 'Gmaj7 A7', melody: [[67, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], [67, 0.5], [67, 0.5], [74, 1], [69, 2]] },
      { text: '車で 行くよ', kana: 'くるまで いくよ', romaji: 'ku-ru-ma-de i-ku-yo', en: 'I’m coming by car', chords: 'Dmaj7 Bm7', melody: [[66, 0.5], [69, 0.5], [69, 1], [69, 1], [66, 0.5], [71, 0.5], [74, 3]] },
      { text: '星が きれいだね', kana: 'ほしが きれいだね', romaji: 'ho-shi-ga ki-re-i-da-ne', en: 'The stars are beautiful, aren’t they', chords: 'Gmaj7 A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [74, 1], [71, 0.5], [71, 0.5], [69, 1], [69, 2]] },
      { text: 'やさしい 歌を', kana: 'やさしい うたを', romaji: 'ya-sa-shi-i u-ta-o', en: 'Something gentle on the stereo', chords: 'Dmaj7 Bm7', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [69, 1], [74, 1], [71, 2]] },
      { text: '夜の ドライブ', kana: 'よるの ドライブ', romaji: 'yo-ru-no do-ra-i-bu', en: 'Night drive', chords: 'Dmaj7 B7', melody: [[74, 1], [69, 0.5], [69, 0.5], [69, 1], [74, 1], [71, 0.5], [66, 2.5]] },
      { text: '君と ドライブ', kana: 'きみと ドライブ', romaji: 'ki-mi-to do-ra-i-bu', en: 'A drive with you', chords: 'Em7 A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [67, 1], [74, 1], [73, 0.5], [69, 2.5]] },
      { text: '海まで 行こう', kana: 'うみまで いこう', romaji: 'u-mi-ma-de i-ko-u', en: 'Let’s go all the way to the sea', chords: 'Dmaj7 B7', melody: [[74, 1], [69, 0.5], [69, 0.5], [66, 1], [66, 0.5], [71, 0.5], [71, 2.5]] },
      { text: '夜の ドライブ', kana: 'よるの ドライブ', romaji: 'yo-ru-no do-ra-i-bu', en: 'Night drive', chords: 'Em7 A7', melody: [[76, 1], [71, 0.5], [71, 0.5], [71, 1], [76, 1], [73, 0.5], [69, 2.5]] },
      { text: 'ねえ 聞いてる？', kana: 'ねえ きいてる', romaji: 'ne-e ki-i-te-ru', en: 'Hey, are you listening?', chords: 'Gmaj7 A7', melody: [[74, 1], [71, 1], [67, 0.5], [71, 0.5], [74, 1], [76, 2]] },
      { text: '隣を 見たら', kana: 'となりを みたら', romaji: 'to-na-ri-o mi-ta-ra', en: 'I look over, and', chords: 'Dmaj7 Bm7', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [74, 1], [69, 0.5], [66, 2.5]] },
      { text: '星も 見ないで', kana: 'ほしも みないで', romaji: 'ho-shi-mo mi-na-i-de', en: 'Not even looking at the stars,', chords: 'Gmaj7 A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [74, 1], [71, 0.5], [71, 0.5], [69, 2]] },
      { text: 'もう 寝てた', kana: 'もう ねてた', romaji: 'mo-u ne-te-ta', en: 'you’d already fallen asleep.', chords: 'Dmaj7 Bm7', melody: [[74, 1], [69, 1], [66, 1], [69, 1], [71, 3]] },
    ],
  },
  {
    // Over "Past Sadness" (Kevin MacLeod, CC BY 4.0, Ladi's pick): slow piano on a Dm7–G–Am7–C
    // loop, so even lines sit on Dm7 G and odd ones on Am7 C. At 72 bpm each line stays under 5 s.
    // Two jokes: the umbrella at the end of each chorus, and what the last letter really said.
    id: 'ame-no-minato',
    title: { text: '雨の 港', kana: 'あめの みなと', en: 'Harbour in the Rain' },
    bpm: 72,
    style: 'enka',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'past-sadness', start: 0.044, segments: [[0, 38]] },
    lines: [
      { text: '雨の 港', kana: 'あめの みなと', romaji: 'a-me-no mi-na-to', en: 'The harbour in the rain', chords: 'Dm7 G', melody: [[64, 1], [60, 0.5], [60, 0.5], [60, 0.5], [65, 1], [64, 2]] },
      { text: '船が 出る', kana: 'ふねが でる', romaji: 'fu-ne-ga de-ru', en: 'A ship sets sail', chords: 'Am7 C', melody: [[62, 1], [65, 1], [64, 0.5], [62, 0.5], [64, 2.5]] },
      { text: 'あなたは 来ない', kana: 'あなたは こない', romaji: 'a-na-ta-wa ko-na-i', en: 'You aren’t coming, my love', chords: 'Dm7 G', melody: [[64, 0.5], [67, 1], [64, 0.5], [64, 0.5], [65, 1], [62, 0.5], [62, 1.5]] },
      { text: 'ああ 冷たい 雨', kana: 'ああ つめたい あめ', romaji: 'a-a tsu-me-ta-i a-me', en: 'Ah, the cold rain', chords: 'Am7 C', melody: [[69, 1], [67, 0.5], [64, 0.5], [64, 0.5], [65, 0.5], [65, 0.5], [64, 0.5], [64, 1.5]] },
      { text: '泣かないで', kana: 'なかないで', romaji: 'na-ka-na-i-de', en: 'Don’t cry', chords: 'Dm7 G', melody: [[64, 1], [69, 1], [67, 0.5], [64, 0.5], [64, 2.5]] },
      { text: 'もう 泣かない', kana: 'もう なかない', romaji: 'mo-u na-ka-na-i', en: 'I won’t cry any more', chords: 'Am7 C', melody: [[69, 1], [67, 0.5], [64, 0.5], [65, 1], [62, 0.5], [62, 2]] },
      { text: '一人で 飲む お酒', kana: 'ひとりで のむ おさけ', romaji: 'hi-to-ri-de no-mu o-sa-ke', en: 'Sake I drink alone', chords: 'Dm7 G', melody: [[57, 0.5], [60, 0.5], [64, 0.5], [64, 0.5], [64, 1], [62, 0.5], [59, 0.5], [59, 0.5], [64, 1]] },
      { text: '傘も 忘れた', kana: 'かさも わすれた', romaji: 'ka-sa-mo wa-su-re-ta', en: '…and I forgot my umbrella', chords: 'Am7 C', melody: [[64, 0.5], [64, 0.5], [60, 1], [62, 0.5], [65, 0.5], [64, 0.5], [57, 2]] },
      { text: 'あなたの 手紙', kana: 'あなたの てがみ', romaji: 'a-na-ta-no te-ga-mi', en: 'Your letter', chords: 'Dm7 G', melody: [[59, 0.5], [64, 1], [62, 0.5], [59, 0.5], [64, 0.5], [60, 0.5], [57, 2]] },
      { text: '何度も 読んだ', kana: 'なんども よんだ', romaji: 'na-n-do-mo yo-n-da', en: 'I read it again and again', chords: 'Am7 C', melody: [[57, 0.5], [60, 0.5], [60, 0.5], [60, 0.5], [62, 1], [65, 0.5], [64, 2]] },
      { text: '最後の 言葉', kana: 'さいごの ことば', romaji: 'sa-i-go-no ko-to-ba', en: 'Its last words:', chords: 'Dm7 G', melody: [[64, 1], [64, 0.5], [67, 0.5], [64, 0.5], [65, 1], [62, 0.5], [62, 1.5]] },
      { text: '「お金 返して」', kana: 'おかね かえして', romaji: 'o-ka-ne ka-e-shi-te', en: '“Pay me back.”', chords: 'Am7 C', melody: [[62, 0.5], [65, 0.5], [65, 1], [64, 0.5], [64, 0.5], [67, 0.5], [64, 2]] },
    ],
  },
  {
    // Over "JRPG Epic Rock Battle Theme" (HydroGene, CC0): verses on its F♯m riff, the chorus on its
    // A–B–G♯m climb. Every note is a beat or longer: at 152 bpm a half-beat is too short to score. The
    // hero’s big chorus ends "…starting tomorrow!", and verse 2 shows why.
    id: 'hashire',
    title: { text: '走れ！', kana: 'はしれ', en: 'Run!' },
    bpm: 152,
    style: 'rock',
    level: 'kana',
    status: 'draft',
    form: songForm([16, 64, 112, 160]),
    track: { id: 'jrpg-rock', start: 0.263, segments: [[0, 28], [40, 63]] },
    lines: [
      { text: '走れ 走れ！', kana: 'はしれ はしれ', romaji: 'ha-shi-re ha-shi-re', en: 'Run, run!', chords: 'F#m F#m', melody: [[73, 1], [73, 1], [69, 1], [73, 1], [73, 1], [76, 2]] },
      { text: '夢に 向かって', kana: 'ゆめに むかって', romaji: 'yu-me-ni mu-ka-t-te', en: 'Toward my dream', chords: 'F#m G#7', melody: [[69, 1], [71, 1], [73, 1], [73, 1], [71, 1], [71, 1], [68, 2]] },
      { text: '負けない 心', kana: 'まけない こころ', romaji: 'ma-ke-na-i ko-ko-ro', en: 'A heart that won’t give in', chords: 'F#m F#m', melody: [[69, 1], [71, 1], [73, 1], [73, 1], [76, 1], [73, 1], [71, 2]] },
      { text: 'もっと 速く！', kana: 'もっと はやく', romaji: 'mo-t-to ha-ya-ku', en: 'Faster!', chords: 'F#m F#m', melody: [[73, 1], [73, 1], [76, 1], [78, 1], [76, 1], [73, 2]] },
      { text: '空を 見て', kana: 'そらを みて', romaji: 'so-ra-o mi-te', en: 'Look up at the sky', chords: 'A B', melody: [[76, 1], [73, 1], [73, 1], [76, 1], [78, 3]] },
      { text: '手を のばせ', kana: 'てを のばせ', romaji: 'te-o no-ba-se', en: 'Reach for it', chords: 'G#m A', melody: [[75, 1], [71, 1], [71, 1], [73, 1], [76, 3]] },
      { text: '今だ 飛べ！', kana: 'いまだ とべ', romaji: 'i-ma-da to-be', en: 'Now — fly!', chords: 'A B', melody: [[76, 1], [78, 1], [76, 1], [78, 1], [81, 3]] },
      { text: '明日から！', kana: 'あしたから', romaji: 'a-shi-ta-ka-ra', en: '…starting tomorrow!', chords: 'F#m E D C#', melody: [[78, 1], [78, 1], [81, 1], [81, 1], [80, 3]] },
      { text: '六時に 起きて', kana: 'ろくじに おきて', romaji: 'ro-ku-ji-ni o-ki-te', en: 'Up at six', chords: 'F#m F#m', melody: [[73, 1], [73, 1], [69, 1], [69, 1], [71, 1], [73, 1], [76, 2]] },
      { text: 'ジムに 行って', kana: 'ジムに いって', romaji: 'ji-mu-ni i-t-te', en: 'Off to the gym', chords: 'F#m G#7', melody: [[73, 1], [71, 1], [69, 1], [75, 1], [75, 1], [72, 2]] },
      { text: 'ダイエット！', kana: 'ダイエット', romaji: 'da-i-e-t-to', en: 'On a diet!', chords: 'F#m F#m', melody: [[73, 1], [73, 1], [76, 1], [76, 1], [78, 3]] },
      { text: 'でも ケーキ', kana: 'でも ケーキ', romaji: 'de-mo ke-e-ki', en: '…but, cake.', chords: 'F#m F#m', melody: [[78, 1], [76, 1], [73, 1], [73, 1], [66, 3]] },
    ],
  },
  {
    // Over "Hot Springs Town" (Kistol, CC0): a festival tune whose 16-bar theme plays twice, verse then
    // chorus. Lines a learner will really say at an izakaya, then the bill.
    id: 'kanpai',
    title: { text: '乾杯！', kana: 'かんぱい', en: 'Cheers!' },
    bpm: 120,
    style: 'izakaya',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'hot-springs', start: 0.048, segments: [[12, 16], [0, 16], [0, 16], [0, 4]] },
    lines: [
      { text: '仕事が 終わった', kana: 'しごとが おわった', romaji: 'shi-go-to-ga o-wa-t-ta', en: 'Work is done!', chords: 'A A D D', melody: [[69, 0.5], [71, 0.5], [73, 0.5], [73, 0.5], [76, 1], [74, 0.5], [74, 0.5], [78, 2]] },
      { text: 'お疲れさま！', kana: 'おつかれさま', romaji: 'o-tsu-ka-re-sa-ma', en: 'Good work today!', chords: 'E C#m F#m F#m', melody: [[71, 0.5], [76, 0.5], [76, 0.5], [76, 0.5], [78, 1], [73, 2]] },
      { text: 'とりあえず ビール', kana: 'とりあえず ビール', romaji: 'to-ri-a-e-zu bi-i-ru', en: 'Beer. For starters. Obviously.', chords: 'D D A A', melody: [[74, 0.5], [74, 0.5], [78, 1], [76, 0.5], [74, 0.5], [73, 0.5], [73, 0.5], [69, 2]] },
      { text: '枝豆 ください', kana: 'えだまめ ください', romaji: 'e-da-ma-me ku-da-sa-i', en: 'Edamame, please!', chords: 'E E A C#m', melody: [[71, 0.5], [71, 0.5], [71, 0.5], [71, 0.5], [76, 0.5], [76, 0.5], [73, 1], [73, 2]] },
      { text: '乾杯 乾杯！', kana: 'かんぱい かんぱい', romaji: 'ka-n-pa-i ka-n-pa-i', en: 'Cheers! Cheers!', chords: 'A A D E7', melody: [[69, 0.5], [71, 0.5], [73, 0.5], [73, 0.5], [69, 0.5], [71, 0.5], [73, 0.5], [76, 1.5]] },
      { text: 'みんなで 乾杯！', kana: 'みんなで かんぱい', romaji: 'mi-n-na-de ka-n-pa-i', en: 'Cheers, everyone!', chords: 'A C#m F#m F#m', melody: [[73, 0.5], [73, 0.5], [73, 0.5], [71, 0.5], [73, 0.5], [76, 0.5], [78, 0.5], [78, 1.5]] },
      { text: 'グラスを 上げて', kana: 'グラスを あげて', romaji: 'gu-ra-su-o a-ge-te', en: 'Glasses up!', chords: 'D D D A', melody: [[78, 0.5], [78, 0.5], [76, 0.5], [74, 0.5], [76, 1], [78, 0.5], [81, 2]] },
      { text: 'もう 一杯！', kana: 'もう いっぱい', romaji: 'mo-u i-p-pa-i', en: 'One more glass!', chords: 'E C#m A A', melody: [[76, 0.5], [76, 0.5], [81, 1], [81, 0.5], [76, 1], [76, 2]] },
      { text: '焼き鳥 二本', kana: 'やきとり にほん', romaji: 'ya-ki-to-ri ni-ho-n', en: 'Two yakitori skewers', chords: 'A A D D', melody: [[69, 0.5], [73, 0.5], [73, 0.5], [73, 0.5], [74, 1], [74, 0.5], [78, 2]] },
      { text: 'からあげ 一つ', kana: 'からあげ ひとつ', romaji: 'ka-ra-a-ge hi-to-tsu', en: 'One fried chicken', chords: 'E C#m F#m F#m', melody: [[71, 0.5], [76, 0.5], [76, 0.5], [76, 0.5], [78, 1], [76, 0.5], [73, 2]] },
      { text: 'お会計は…', kana: 'おかいけいは', romaji: 'o-ka-i-ke-i-wa', en: 'And the bill is…', chords: 'D D A A', melody: [[74, 0.5], [78, 0.5], [78, 0.5], [78, 0.5], [78, 0.5], [76, 2]] },
      { text: '一万円！？', kana: 'いちまんえん', romaji: 'i-chi-ma-n-e-n', en: '…ten thousand yen!?', chords: 'E E A C#m', melody: [[81, 0.5], [81, 0.5], [81, 0.5], [81, 0.5], [80, 0.5], [76, 2.5]] },
    ],
  },
  {
    // Over "Hustle" (Kevin MacLeod, CC BY 4.0): a 12-bar minor blues, three two-line phrases a
    // chorus. It stops before the track changes key. The joke is how slowly the day goes.
    id: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 120,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'hustle', start: 0.796, segments: [[0, 4], [4, 28], [12, 20], [20, 24]] },
    lines: [
      { text: '月曜日の 朝', kana: 'げつようびの あさ', romaji: 'ge-tsu-yo-u-bi-no a-sa', en: 'Monday morning', chords: 'Em Em', melody: [[74, 1], [71, 0.5], [71, 0.5], [69, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 2]] },
      { text: '電車は いっぱい', kana: 'でんしゃは いっぱい', romaji: 'de-n-sha-wa i-p-pa-i', en: 'The train is packed', chords: 'Em Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [71, 1], [71, 2]] },
      { text: '部長は 怒ってる', kana: 'ぶちょうは おこってる', romaji: 'bu-cho-u-wa o-ko-t-te-ru', en: 'The boss is angry', chords: 'Am Am', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [69, 0.5], [72, 1], [74, 0.5], [74, 0.5], [72, 0.5], [69, 2]] },
      { text: 'コーヒー ください', kana: 'コーヒー ください', romaji: 'ko-o-hi-i ku-da-sa-i', en: 'Coffee, please', chords: 'Em Em', melody: [[71, 0.5], [71, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [69, 1], [64, 2]] },
      { text: 'ああ 月曜日', kana: 'ああ げつようび', romaji: 'a-a ge-tsu-yo-u-bi', en: 'Oh, Monday', chords: 'Bm Am', melody: [[78, 1.5], [76, 0.5], [74, 0.5], [71, 0.5], [71, 0.5], [69, 0.5], [69, 2]] },
      { text: '早く 帰りたい', kana: 'はやく かえりたい', romaji: 'ha-ya-ku ka-e-ri-ta-i', en: 'I just want to go home', chords: 'Em Em', melody: [[71, 0.5], [74, 0.5], [71, 0.5], [70, 0.5], [69, 0.5], [67, 0.5], [67, 0.5], [64, 2.5]] },
      { text: '眠い 眠い', kana: 'ねむい ねむい', romaji: 'ne-mu-i ne-mu-i', en: 'So sleepy, so sleepy', chords: 'Em Em', melody: [[71, 0.5], [74, 1], [71, 1], [71, 0.5], [74, 1], [71, 2]] },
      { text: 'まだ 月曜日', kana: 'まだ げつようび', romaji: 'ma-da ge-tsu-yo-u-bi', en: '…and it’s only Monday', chords: 'Em Em', melody: [[67, 0.5], [67, 0.5], [71, 1], [69, 0.5], [67, 0.5], [64, 0.5], [64, 2.5]] },
      { text: 'お昼は おにぎり', kana: 'おひるは おにぎり', romaji: 'o-hi-ru-wa o-ni-gi-ri', en: 'Lunch is a rice ball', chords: 'Am Am', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [69, 0.5], [72, 0.5], [74, 0.5], [72, 2]] },
      { text: '今日も 仕事だ', kana: 'きょうも しごとだ', romaji: 'kyo-u-mo shi-go-to-da', en: 'Work again today', chords: 'Em Em', melody: [[71, 0.5], [71, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], [69, 0.5], [67, 2]] },
      { text: '時計を 見たら', kana: 'とけいを みたら', romaji: 'to-ke-i-o mi-ta-ra', en: 'I look at the clock…', chords: 'Bm Am', melody: [[74, 0.5], [74, 0.5], [74, 0.5], [74, 0.5], [78, 1], [76, 0.5], [72, 2]] },
      { text: 'まだ 十時', kana: 'まだ じゅうじ', romaji: 'ma-da ju-u-ji', en: '…it’s only ten.', chords: 'Em Em', melody: [[71, 1], [71, 1], [67, 1], [67, 0.5], [64, 3]] },
    ],
  },
  {
    // Over "In Your Arms" (Kevin MacLeod, CC BY 4.0), a 1940s ballad: a lovers’ quarrel, each line
    // answering the last. Its 16-bar theme plays twice, so verse 2 and the last chorus sit on the same
    // chords as the first ones. The quarrel ends with a birthday cake.
    id: 'doko-itteta',
    title: { text: 'どこ 行ってたの？', kana: 'どこ いってたの', en: 'Where Were You?' },
    bpm: 98,
    style: 'kayou',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'in-your-arms', start: 0.412, segments: [[12, 16], [0, 32], [0, 4]] },
    lines: [
      { text: 'どこ 行ってたの？', kana: 'どこ いってたの', romaji: 'do-ko i-t-te-ta-no', en: 'Where were you?', chords: 'F F Am Dm', melody: [[72, 1], [69, 0.5], [69, 0.5], [72, 0.5], [72, 0.5], [74, 0.5], [74, 2]] },
      { text: 'コンビニ だよ', kana: 'コンビニ だよ', romaji: 'ko-n-bi-ni da-yo', en: 'Just the konbini', chords: 'C7 Gm Bb C7', melody: [[67, 0.5], [70, 0.5], [70, 0.5], [70, 0.5], [72, 1], [67, 2]] },
      { text: '三時間も？', kana: 'さんじかんも', romaji: 'sa-n-ji-ka-n-mo', en: 'For three hours?', chords: 'C7 Am Am D7', melody: [[72, 0.5], [76, 0.5], [76, 1], [72, 0.5], [72, 0.5], [74, 2]] },
      { text: '道に 迷った', kana: 'みちに まよった', romaji: 'mi-chi-ni ma-yo-t-ta', en: 'I got lost', chords: 'Bb Dm Dm C7', melody: [[70, 0.5], [74, 0.5], [74, 0.5], [72, 0.5], [70, 0.5], [70, 0.5], [67, 2]] },
      { text: 'ごめんね ダーリン', kana: 'ごめんね ダーリン', romaji: 'go-me-n-ne da-a-ri-n', en: 'Sorry, darling', chords: 'F F Am Dm', melody: [[72, 0.5], [77, 1], [76, 0.5], [74, 0.5], [77, 1], [74, 0.5], [72, 0.5], [74, 1.5]] },
      { text: '許して ダーリン', kana: 'ゆるして ダーリン', romaji: 'yu-ru-shi-te da-a-ri-n', en: 'Forgive me, darling', chords: 'C7 Bb Bb C7', melody: [[72, 0.5], [76, 1], [74, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5], [72, 1.5]] },
      { text: '愛してる', kana: 'あいしてる', romaji: 'a-i-shi-te-ru', en: 'I love you', chords: 'Am Am Am D7', melody: [[76, 1], [77, 0.5], [76, 0.5], [74, 0.5], [72, 3]] },
      { text: '…本当に？', kana: 'ほんとうに', romaji: 'ho-n-to-u-ni', en: '…Really?', chords: 'Bb Gm C7 F', melody: [[70, 1], [74, 0.5], [74, 0.5], [74, 0.5], [77, 3]] },
      { text: 'その 袋は？', kana: 'その ふくろは', romaji: 'so-no fu-ku-ro-wa', en: 'What’s in that bag?', chords: 'F F Am Dm', melody: [[72, 1], [72, 0.5], [74, 0.5], [72, 0.5], [72, 0.5], [74, 2]] },
      { text: 'ただの 牛乳', kana: 'ただの ぎゅうにゅう', romaji: 'ta-da-no gyu-u-nyu-u', en: 'Just milk', chords: 'C7 Gm Bb C7', melody: [[67, 0.5], [70, 0.5], [70, 0.5], [72, 1], [72, 0.5], [70, 0.5], [67, 2]] },
      { text: 'なぜ ケーキが？', kana: 'なぜ ケーキが', romaji: 'na-ze ke-e-ki-ga', en: 'Then why is there a cake?', chords: 'C7 Am Am D7', melody: [[72, 1], [76, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [74, 2]] },
      { text: '…君の 誕生日', kana: 'きみの たんじょうび', romaji: 'ki-mi-no ta-n-jo-u-bi', en: '…It’s your birthday.', chords: 'Bb Dm Dm C7', melody: [[70, 0.5], [74, 0.5], [74, 0.5], [72, 0.5], [72, 0.5], [70, 0.5], [70, 0.5], [67, 2]] },
    ],
  },
  {
    // Over "Lazy Saturday" (vandalorum, CC BY 4.0): a boom-bap beat whose four-bar loop runs under
    // the whole song. Rap is near-spoken, so the melodies keep close to two notes; every note is half a
    // beat or more. The chorus is the questions everyone asks in Japan, and the crowd shouts ラーメン！
    id: 'jikoshoukai-rap',
    title: { text: '自己紹介 ラップ', kana: 'じこしょうかい ラップ', en: 'Self-Intro Rap' },
    bpm: 92,
    style: 'hiphop',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'lazy-saturday', start: 0.566, segments: [[0, 4], [4, 8], [4, 8], [4, 8], [4, 8], [4, 8], [4, 8], [4, 8], [4, 8], [4, 8]] },
    lines: [
      { text: 'はじめまして', kana: 'はじめまして', romaji: 'ha-ji-me-ma-shi-te', en: 'Nice to meet you', chords: 'F Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 1], [64, 0.5], [64, 1.5]] },
      { text: '趣味は カラオケ', kana: 'しゅみは カラオケ', romaji: 'shu-mi-wa ka-ra-o-ke', en: 'My hobby is karaoke', chords: 'Dm Em', melody: [[67, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [64, 1.5]] },
      { text: '日本語 勉強中', kana: 'にほんご べんきょうちゅう', romaji: 'ni-ho-n-go be-n-kyo-u-chu-u', en: 'Studying Japanese right now', chords: 'F Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [69, 1.5]] },
      { text: 'よろしく！ よろしく！', kana: 'よろしく よろしく', romaji: 'yo-ro-shi-ku yo-ro-shi-ku', en: 'Nice to know you! Nice to know you!', chords: 'Dm Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [69, 0.5], [69, 0.5], [67, 1.5]] },
      { text: 'お名前は？', kana: 'おなまえは', romaji: 'o-na-ma-e-wa', en: 'What’s your name?', chords: 'F Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [72, 2]] },
      { text: '出身は？', kana: 'しゅっしんは', romaji: 'shu-s-shi-n-wa', en: 'Where are you from?', chords: 'Dm Em', melody: [[67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [72, 2]] },
      { text: '好きな 食べ物は？', kana: 'すきな たべものは', romaji: 'su-ki-na ta-be-mo-no-wa', en: 'Favourite food?', chords: 'F Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [72, 2]] },
      { text: 'ラーメン！', kana: 'ラーメン', romaji: 'ra-a-me-n', en: 'Ramen!', chords: 'Dm Em', melody: [[76, 1], [76, 1], [72, 1], [69, 2]] },
      { text: '好きな 色は 赤', kana: 'すきな いろは あか', romaji: 'su-ki-na i-ro-wa a-ka', en: 'My favourite colour is red', chords: 'F Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [69, 1.5]] },
      { text: '誕生日は 三月', kana: 'たんじょうびは さんがつ', romaji: 'ta-n-jo-u-bi-wa sa-n-ga-tsu', en: 'My birthday’s in March', chords: 'Dm Em', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [69, 0.5], [67, 0.5], [67, 0.5], [64, 1.5]] },
      { text: 'それから 年は', kana: 'それから としは', romaji: 'so-re-ka-ra to-shi-wa', en: 'And my age is…', chords: 'F Em', melody: [[67, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [67, 1], [67, 0.5], [69, 2]] },
      { text: 'ひみつ です！', kana: 'ひみつ です', romaji: 'hi-mi-tsu de-su', en: '…a secret!', chords: 'Dm Em', melody: [[69, 1], [72, 1], [69, 1], [67, 0.5], [64, 2]] },
    ],
  },
  {
    // Over "Cheers For Starlight" (Chloe Wolfe, CC BY 4.0): bright pop on a D–A–Bm–G loop; the
    // chorus uses its fullest section. Shout ハイ！ after each line. The idol’s sweet chorus is a sales
    // pitch, and verse 2 is the merch table.
    id: 'kirakira-idol',
    title: { text: 'キラキラ アイドル', kana: 'キラキラ アイドル', en: 'Sparkle Idol' },
    bpm: 130,
    style: 'idol',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'starlight', start: 0.433, segments: [[0, 12], [32, 40], [12, 20], [32, 40], [40, 43]] },
    lines: [
      { text: 'みんな 元気？', kana: 'みんな げんき', romaji: 'mi-n-na ge-n-ki', en: 'Everybody doing OK?', chords: 'D A', melody: [[74, 0.5], [74, 0.5], [76, 1], [78, 0.5], [76, 0.5], [76, 2]] },
      { text: '今日も ありがとう', kana: 'きょうも ありがとう', romaji: 'kyo-u-mo a-ri-ga-to-u', en: 'Thank you for coming!', chords: 'Bm G', melody: [[74, 0.5], [74, 0.5], [74, 0.5], [78, 0.5], [78, 0.5], [76, 0.5], [74, 1], [74, 2]] },
      { text: 'ペンライト 振って！', kana: 'ペンライト ふって', romaji: 'pe-n-ra-i-to fu-t-te', en: 'Wave your penlights!', chords: 'D A', melody: [[78, 0.5], [78, 0.5], [78, 1], [81, 0.5], [78, 0.5], [76, 1], [76, 0.5], [73, 1.5]] },
      { text: '声を 聞かせて！', kana: 'こえを きかせて', romaji: 'ko-e-o ki-ka-se-te', en: 'Let me hear you!', chords: 'Bm G', melody: [[71, 0.5], [74, 0.5], [74, 0.5], [78, 0.5], [78, 0.5], [79, 1], [78, 2]] },
      { text: '好き 好き 大好き', kana: 'すき すき だいすき', romaji: 'su-ki su-ki da-i-su-ki', en: 'I love you, love you, love you!', chords: 'D A', melody: [[78, 1], [81, 1], [78, 1], [81, 1], [83, 1], [81, 0.5], [78, 0.5], [76, 1.5]] },
      { text: 'ずっと 一緒', kana: 'ずっと いっしょ', romaji: 'zu-t-to i-s-sho', en: 'Together forever', chords: 'Bm G', melody: [[78, 0.5], [78, 0.5], [78, 1], [79, 0.5], [79, 0.5], [74, 2.5]] },
      { text: 'キラキラ ハート', kana: 'キラキラ ハート', romaji: 'ki-ra-ki-ra ha-a-to', en: 'A sparkly heart', chords: 'D A', melody: [[74, 0.5], [78, 0.5], [74, 0.5], [78, 0.5], [81, 1], [81, 0.5], [76, 2]] },
      { text: 'チケット 買ってね', kana: 'チケット かってね', romaji: 'chi-ke-t-to ka-t-te-ne', en: '…so buy a ticket!', chords: 'Bm G', melody: [[78, 0.5], [83, 0.5], [83, 0.5], [81, 0.5], [79, 0.5], [79, 0.5], [78, 1], [74, 2]] },
      { text: 'グッズも あるよ', kana: 'グッズも あるよ', romaji: 'gu-z-zu-mo a-ru-yo', en: 'There’s merch, too', chords: 'D A', melody: [[74, 0.5], [74, 0.5], [74, 0.5], [76, 0.5], [78, 0.5], [76, 0.5], [73, 2]] },
      { text: 'うちわ 千円', kana: 'うちわ せんえん', romaji: 'u-chi-wa se-n-e-n', en: 'Fans: a thousand yen', chords: 'Bm G', melody: [[71, 0.5], [74, 0.5], [74, 0.5], [78, 0.5], [78, 0.5], [76, 0.5], [74, 2]] },
      { text: 'CD 二千円', kana: 'シーディー にせんえん', romaji: 'shi-i-di-i ni-se-n-e-n', en: 'CDs: two thousand yen', chords: 'D A', melody: [[74, 0.5], [74, 0.5], [78, 0.5], [78, 0.5], [81, 0.5], [78, 0.5], [78, 0.5], [76, 0.5], [76, 1.5]] },
      { text: 'ぜんぶ 買って！', kana: 'ぜんぶ かって', romaji: 'ze-n-bu ka-t-te', en: 'Buy it all!', chords: 'Bm G', melody: [[83, 1], [81, 0.5], [78, 0.5], [79, 0.5], [79, 0.5], [79, 2.5]] },
    ],
  },
  {
    // Over "Slow Jam" (Kevin MacLeod, CC BY 4.0): verses on its quiet Cm–Fm groove, the chorus on
    // the full band. At 75 bpm two bars are 6.4 s, so each line stays under 5 s and leaves a breath.
    // The call finally comes in verse 2. It’s Mum.
    id: 'nemurenai-yoru',
    title: { text: '眠れない 夜', kana: 'ねむれない よる', en: 'Sleepless Night' },
    bpm: 75,
    style: 'rnb',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'slow-jam', start: 0.044, segments: [[0, 12], [16, 24], [4, 12], [16, 28]] },
    lines: [
      { text: '眠れない 夜', kana: 'ねむれない よる', romaji: 'ne-mu-re-na-i yo-ru', en: 'A night I can’t sleep', chords: 'Cm7 Fm', melody: [[63, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [65, 0.5], [70, 1], [67, 1.5]] },
      { text: '電話 待ってる', kana: 'でんわ まってる', romaji: 'de-n-wa ma-t-te-ru', en: 'I’m waiting for your call', chords: 'Cm7 Fm', melody: [[63, 0.5], [67, 0.5], [67, 0.75], [70, 0.75], [70, 0.5], [65, 0.5], [63, 1.5]] },
      { text: '時計の 音', kana: 'とけいの おと', romaji: 'to-ke-i-no o-to', en: 'The ticking of the clock', chords: 'Cm7 Fm', melody: [[67, 0.5], [70, 0.5], [70, 0.5], [68, 0.5], [67, 1], [63, 2]] },
      { text: '一人の 部屋', kana: 'ひとりの へや', romaji: 'hi-to-ri-no he-ya', en: 'My room, alone', chords: 'Cm7 Fm', melody: [[63, 0.5], [67, 0.5], [67, 0.5], [65, 0.5], [63, 1], [60, 2]] },
      { text: '会いたい 会いたい', kana: 'あいたい あいたい', romaji: 'a-i-ta-i a-i-ta-i', en: 'I miss you, I miss you', chords: 'Cm Abmaj7 Cm Abmaj7', melody: [[72, 0.5], [75, 0.5], [75, 0.5], [72, 0.5], [72, 0.5], [75, 0.5], [77, 0.5], [75, 1.5]] },
      { text: '今 すぐ 来て', kana: 'いま すぐ きて', romaji: 'i-ma su-gu ki-te', en: 'Come over right now', chords: 'Cm Abmaj7 Fm Fm', melody: [[72, 1], [67, 0.5], [70, 0.75], [65, 0.75], [67, 0.5], [60, 1.5]] },
      { text: '声が 聞きたい', kana: 'こえが ききたい', romaji: 'ko-e-ga ki-ki-ta-i', en: 'I want to hear your voice', chords: 'Cm Abmaj7 Cm Abmaj7', melody: [[72, 0.5], [75, 0.5], [75, 0.5], [77, 0.5], [75, 0.5], [72, 0.5], [75, 2]] },
      { text: 'ベイビー 好きだよ', kana: 'ベイビー すきだよ', romaji: 'be-i-bi-i su-ki-da-yo', en: 'Baby, I love you', chords: 'Cm Abmaj7 Fm Fm', melody: [[79, 0.5], [77, 0.5], [75, 0.5], [75, 0.5], [72, 0.5], [75, 0.5], [72, 0.5], [72, 1.5]] },
      { text: 'やっと 電話が', kana: 'やっと でんわが', romaji: 'ya-t-to de-n-wa-ga', en: 'At last, the phone…', chords: 'Cm7 Fm', melody: [[67, 0.5], [67, 0.5], [70, 0.5], [67, 0.5], [67, 0.5], [65, 0.5], [63, 1.5]] },
      { text: '鳴った！ もしもし？', kana: 'なった もしもし', romaji: 'na-t-ta mo-shi-mo-shi', en: '…rings! Hello?', chords: 'Cm7 Fm', melody: [[72, 0.5], [72, 0.5], [72, 1], [67, 0.5], [70, 0.5], [67, 0.5], [72, 1.5]] },
      { text: '「お母さん です」', kana: 'おかあさん です', romaji: 'o-ka-a-sa-n de-su', en: '“It’s Mum.”', chords: 'Cm7 Fm', melody: [[60, 0.5], [63, 0.5], [63, 0.5], [63, 0.5], [63, 0.5], [60, 0.5], [60, 1.5]] },
      { text: '「早く 寝なさい」', kana: 'はやく ねなさい', romaji: 'ha-ya-ku ne-na-sa-i', en: '“Go to sleep.”', chords: 'Cm7 Fm', melody: [[63, 0.5], [63, 0.5], [63, 0.5], [67, 0.5], [65, 0.5], [63, 0.5], [60, 2]] },
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
