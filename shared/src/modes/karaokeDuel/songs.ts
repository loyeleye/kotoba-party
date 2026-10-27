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
import type { Audience } from '../../protocol.js';

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

/** Who a room's lyrics are for: the host's Audience setting (room settings). Family is the default. */
export { AUDIENCES, type Audience } from '../../protocol.js';

/** One line of a lyric set: new words over the version's line. */
export interface LyricLine {
  text: string;
  kana: string;
  romaji: string;
  en: string;
  /**
   * Only when the words need a different rhythm: one note per mora, the same beats in total as the
   * version's line (so it fits the backing). Otherwise the version's own melody is sung.
   */
  melody?: readonly Note[];
}

/**
 * Another set of words for one version of a song, for one audience: kids, family (clean grown-up
 * jokes) or cheeky (Jackbox-style adult humour, never explicit). One line per line of the version,
 * sung over its track and chords. A version's own lines count as one of its family sets.
 */
export interface LyricSet {
  /** `<version id>:<audience>` (plus `-2`, `-3` … if a version has more than one for an audience). */
  id: string;
  audience: Audience;
  /** The joke in one line, for reviewers and the docs. */
  about: string;
  status: ReviewStatus;
  lines: readonly LyricLine[];
}

/** A version sung with a lyric set's words: the set's text and the version's chords and melody. */
export function withLyrics(song: Song, set: LyricSet | null | undefined): Song {
  if (!set) return song;
  return { ...song, lines: song.lines.map((line, i) => ({ ...line, ...set.lines[i]!, melody: set.lines[i]!.melody ?? line.melody, chords: line.chords })), status: set.status };
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
    // A7 | D, B7 | Em, Gm | A7. The chorus never sings the title; its peak is F♯5 on 月が きれい ("the moon is
    // beautiful", the old way to say "I love you"). Verse 2 goes round in circles, and then the sat-nav is lost too, so the last chorus means "lost forever".
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
      { text: 'ラジオ つけて', kana: 'ラジオ つけて', romaji: 'ra-ji-o tsu-ke-te', en: 'Turn the radio on', chords: 'Dmaj7 Em7', melody: [[74, 1], [69, 0.5], [69, 0.5], [69, 1], [74, 1], [67, 3]] },
      { text: 'どこまでも 行こう', kana: 'どこまでも いこう', romaji: 'do-ko-ma-de-mo i-ko-u', en: 'Let’s go as far as the road goes', chords: 'A7 Dmaj7', melody: [[76, 1], [73, 0.5], [73, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [74, 0.5], [74, 2.5]] },
      { text: '月が きれい', kana: 'つきが きれい', romaji: 'tsu-ki-ga ki-re-i', en: 'The moon is beautiful', chords: 'B7 Em7', melody: [[66, 1], [71, 0.5], [66, 0.5], [78, 2], [76, 0.5], [71, 2.5]] },
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
      { text: '二人の 夜', kana: 'ふたりの よる', romaji: 'fu-ta-ri-no yo-ru', en: 'Our night', chords: 'Dmaj7 B7', melody: [[69, 0.5], [74, 0.5], [74, 1], [69, 1], [74, 1], [66, 3]] },
      { text: '君と ドライブ', kana: 'きみと ドライブ', romaji: 'ki-mi-to do-ra-i-bu', en: 'A drive with you', chords: 'Em7 A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [67, 1], [74, 1], [73, 0.5], [69, 2.5]] },
      { text: '海まで 行こう', kana: 'うみまで いこう', romaji: 'u-mi-ma-de i-ko-u', en: 'Let’s go all the way to the sea', chords: 'Dmaj7 B7', melody: [[74, 1], [69, 0.5], [69, 0.5], [66, 1], [66, 0.5], [71, 0.5], [71, 2.5]] },
      { text: '朝まで ずっと', kana: 'あさまで ずっと', romaji: 'a-sa-ma-de zu-t-to', en: 'All the way till morning', chords: 'Em7 A7', melody: [[76, 1], [71, 0.5], [71, 0.5], [69, 1], [69, 0.75], [69, 0.25], [73, 2.5]] },
      { text: 'ねえ 聞いてる？', kana: 'ねえ きいてる', romaji: 'ne-e ki-i-te-ru', en: 'Hey, are you listening?', chords: 'Gmaj7 A7', melody: [[74, 1], [71, 1], [67, 0.5], [71, 0.5], [74, 1], [76, 2]] },
      { text: '隣を 見たら', kana: 'となりを みたら', romaji: 'to-na-ri-o mi-ta-ra', en: 'I look over, and', chords: 'Dmaj7 Bm7', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [74, 1], [69, 0.5], [66, 2.5]] },
      { text: '星も 見ないで', kana: 'ほしも みないで', romaji: 'ho-shi-mo mi-na-i-de', en: 'Not even looking at the stars,', chords: 'Gmaj7 A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [74, 1], [71, 0.5], [71, 0.5], [69, 2]] },
      { text: 'もう 寝てた', kana: 'もう ねてた', romaji: 'mo-u ne-te-ta', en: 'you’d already fallen asleep.', chords: 'Dmaj7 Bm7', melody: [[74, 1], [69, 1], [66, 1], [69, 1], [71, 3]] },
    ],
  },
  {
    // Harbour in the Rain, version A, over an AI-made enka backing (Mureka, take 1; tracks.ts): one
    // 8-bar loop throughout, Dm7 G7 | C Fmaj7 | G7 E7 | Am Am7, so verse and chorus share chords. She
    // swears she'll wait ten years for his ship; verse 2 it's already back, because the town next door
    // is five minutes away, so the last chorus is melodrama over a ferry.
    id: 'ame-no-minato',
    group: 'ame-no-minato',
    title: { text: '雨の 港', kana: 'あめの みなと', en: 'Harbour in the Rain' },
    bpm: 71,
    style: 'enka',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'harbour-ferry', start: 0, segments: [[0, 39]] },
    lines: [
      { text: 'さようなら あなた', kana: 'さようなら あなた', romaji: 'sa-yo-u-na-ra a-na-ta', en: 'Goodbye, my love', chords: 'Dm7 G7', melody: [[57, 0.5], [60, 0.5], [60, 0.5], [60, 0.5], [57, 2], [59, 0.5], [62, 1], [59, 1.5]] },
      { text: '船が 出て行く', kana: 'ふねが でていく', romaji: 'fu-ne-ga de-te-i-ku', en: 'Your ship is sailing away', chords: 'C Fmaj7', melody: [[64, 1], [60, 0.5], [60, 0.5], [64, 1.5], [60, 0.5], [60, 1], [57, 2]] },
      { text: '冷たい 雨に', kana: 'つめたい あめに', romaji: 'tsu-me-ta-i a-me-ni', en: 'In the cold rain', chords: 'G7 E7', melody: [[59, 0.5], [62, 0.5], [62, 2], [62, 1], [64, 1.5], [62, 0.5], [59, 1]] },
      { text: '一人 泣くの', kana: 'ひとり なくの', romaji: 'hi-to-ri na-ku-no', en: 'I cry alone', chords: 'Am Am7', melody: [[60, 0.5], [64, 1], [60, 0.5], [60, 1], [64, 1], [64, 3]] },
      { text: 'いつまでも ここで', kana: 'いつまでも ここで', romaji: 'i-tsu-ma-de-mo ko-ko-de', en: 'Here, forever', chords: 'Dm7 G7', melody: [[69, 1.5], [64, 0.5], [60, 0.5], [60, 0.5], [60, 1], [59, 0.5], [62, 0.5], [67, 2]] },
      { text: 'あなたを 待つわ', kana: 'あなたを まつわ', romaji: 'a-na-ta-o ma-tsu-wa', en: 'I’ll wait for you', chords: 'C Fmaj7', melody: [[67, 1.5], [69, 0.5], [67, 1], [64, 0.5], [67, 0.5], [64, 0.5], [64, 2.5]] },
      { text: '十年でも 待つわ', kana: 'じゅうねんでも まつわ', romaji: 'ju-u-ne-n-de-mo ma-tsu-wa', en: 'I’ll wait ten years if I must', chords: 'G7 E7', melody: [[71, 1], [71, 1], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1], [68, 0.5], [64, 1.5]] },
      { text: 'いつまでも ここで', kana: 'いつまでも ここで', romaji: 'i-tsu-ma-de-mo ko-ko-de', en: 'Here, forever', chords: 'Am Am7', melody: [[69, 1.5], [64, 0.5], [60, 0.5], [60, 0.5], [60, 1], [60, 0.5], [64, 0.5], [69, 2]] },
      { text: 'あれ？ あの 船', kana: 'あれ あの ふね', romaji: 'a-re a-no fu-ne', en: 'Huh? That ship…', chords: 'Dm7 G7', melody: [[57, 0.5], [60, 1.5], [57, 0.5], [60, 0.5], [62, 1], [59, 3]] },
      { text: 'おかえり あなた', kana: 'おかえり あなた', romaji: 'o-ka-e-ri a-na-ta', en: 'Welcome home, my love', chords: 'C Fmaj7', melody: [[60, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [60, 1], [64, 1], [60, 3]] },
      { text: 'となりの 町まで', kana: 'となりの まちまで', romaji: 'to-na-ri-no ma-chi-ma-de', en: 'To the town next door', chords: 'G7 E7', melody: [[59, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [59, 1], [62, 1], [59, 1], [59, 1]] },
      { text: '五分 だけ', kana: 'ごふん だけ', romaji: 'go-fu-n da-ke', en: 'is only five minutes', chords: 'Am Am7', melody: [[69, 1.5], [64, 0.5], [64, 2], [60, 0.5], [57, 2.5]] },
    ],
  },
  {
    // Harbour in the Rain, version B, over the other Mureka take: verse Dm7 G | C Fmaj7 | G7 | E E7,
    // ending on the dominant; chorus twice as fast, Dm7 G C Fmaj7 | G7 E Am7. She waves the nine
    // o'clock ship a tearful goodbye (いってらっしゃい), then finds its ticket in her pocket: it was her ship.
    id: 'ame-no-minato-b',
    group: 'ame-no-minato',
    title: { text: '雨の 港', kana: 'あめの みなと', en: 'Harbour in the Rain' },
    bpm: 71,
    style: 'enka',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'harbour-ticket', start: 0, segments: [[0, 40]] },
    lines: [
      { text: '雨が 降る 夜', kana: 'あめが ふる よる', romaji: 'a-me-ga fu-ru yo-ru', en: 'A rainy night', chords: 'Dm7 G', melody: [[65, 1], [62, 0.5], [62, 0.5], [65, 1], [62, 1], [62, 1], [59, 2]] },
      { text: '九時の 船が 出る', kana: 'くじの ふねが でる', romaji: 'ku-ji-no fu-ne-ga de-ru', en: 'The nine o’clock ship sets sail', chords: 'C Fmaj7', melody: [[64, 1], [60, 0.5], [60, 0.5], [64, 1], [60, 0.5], [60, 0.5], [64, 1], [60, 2]] },
      { text: 'ゆっくり 海へ', kana: 'ゆっくり うみへ', romaji: 'yu-k-ku-ri u-mi-e', en: 'Slowly out to sea', chords: 'G7 G7', melody: [[59, 0.5], [62, 0.5], [62, 0.5], [59, 0.5], [62, 1.5], [59, 1.5], [59, 2]] },
      { text: '私は 見てる', kana: 'わたしは みてる', romaji: 'wa-ta-shi-wa mi-te-ru', en: 'And I watch it go', chords: 'E E7', melody: [[59, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [68, 1.5], [64, 0.5], [59, 3]] },
      { text: 'いってらっしゃい', kana: 'いってらっしゃい', romaji: 'i-t-te-ra-s-sha-i', en: 'Have a good trip!', chords: 'Dm7 G C Fmaj7', melody: [[62, 0.5], [65, 0.5], [65, 1], [67, 1], [67, 0.5], [71, 1.5], [67, 2]] },
      { text: 'さようなら 船よ', kana: 'さようなら ふねよ', romaji: 'sa-yo-u-na-ra fu-ne-yo', en: 'Goodbye, ship', chords: 'G7 E Am7 Am7', melody: [[67, 1.5], [71, 0.5], [71, 1], [71, 0.5], [68, 0.5], [69, 0.5], [64, 0.5], [64, 2]] },
      { text: '遠くへ 行くのね', kana: 'とおくへ いくのね', romaji: 'to-o-ku-e i-ku-no-ne', en: 'You’re going far away', chords: 'Dm7 G C Fmaj7', melody: [[69, 0.5], [72, 1], [72, 0.5], [67, 1], [67, 0.5], [71, 0.5], [72, 1], [67, 2]] },
      { text: 'いってらっしゃい', kana: 'いってらっしゃい', romaji: 'i-t-te-ra-s-sha-i', en: 'Have a good trip!', chords: 'G7 E Am7 Am7', melody: [[59, 0.5], [62, 0.5], [62, 1], [64, 1], [64, 0.5], [71, 1.5], [69, 2]] },
      { text: 'ポケットに 切符', kana: 'ポケットに きっぷ', romaji: 'po-ke-t-to-ni ki-p-pu', en: 'There’s a ticket in my pocket', chords: 'Dm7 G', melody: [[62, 0.5], [65, 0.5], [65, 0.5], [62, 0.5], [62, 1], [60, 0.5], [62, 0.5], [62, 3]] },
      { text: '九時の 切符', kana: 'くじの きっぷ', romaji: 'ku-ji-no ki-p-pu', en: 'A ticket for nine o’clock', chords: 'C Fmaj7', melody: [[67, 1], [64, 1], [60, 1], [60, 0.5], [64, 0.5], [64, 3]] },
      { text: 'あれ？ 待って', kana: 'あれ まって', romaji: 'a-re ma-t-te', en: 'Huh? Wait…', chords: 'G7 G7', melody: [[59, 0.5], [62, 1.5], [65, 1], [65, 0.5], [62, 1.5]] },
      { text: '私の 船！', kana: 'わたしの ふね', romaji: 'wa-ta-shi-no fu-ne', en: 'That’s MY ship!', chords: 'E E7', melody: [[59, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [68, 2], [64, 2]] },
    ],
  },
  {
    // Run!, version A, over an AI-made anime-rock backing (Mureka; tracks.ts). The lines fit the chords it
    // really plays: verse D | D | C♯m | F♯m | Bm | C♯m | F♯m | E, ending open on V; chorus on the royal
    // road D–E | C♯m–F♯m, closing on A. Something is chasing the singer to school; verse 2 looks back and it
    // is Mom with the forgotten lunch, so the last chorus is Mom shouting her child out of the door. The
    // lyrics never sing the song's title (Ladi's rule); the chorus hook is いそげ いそげ instead.
    id: 'hashire',
    group: 'hashire',
    title: { text: '走れ！', kana: 'はしれ', en: 'Run!' },
    bpm: 132,
    style: 'rock',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'run-footsteps', start: 0, segments: [[0, 38]] },
    lines: [
      { text: '後ろから 来る', kana: 'うしろから くる', romaji: 'u-shi-ro-ka-ra ku-ru', en: 'Something’s coming from behind', chords: 'D D', melody: [[69, 0.5], [74, 0.5], [74, 0.5], [74, 0.5], [74, 1], [74, 1], [69, 2]] },
      { text: '大きな 足音', kana: 'おおきな あしおと', romaji: 'o-o-ki-na a-shi-o-to', en: 'Loud footsteps', chords: 'C#m F#m', melody: [[73, 0.5], [71, 0.5], [68, 0.5], [68, 0.5], [68, 0.5], [73, 0.5], [73, 1], [69, 2]] },
      { text: '後ろを 見ないで', kana: 'うしろを みないで', romaji: 'u-shi-ro-o mi-na-i-de', en: 'Don’t look back', chords: 'Bm C#m', melody: [[66, 0.5], [71, 0.5], [71, 0.5], [71, 0.5], [74, 1], [71, 0.5], [68, 0.5], [68, 1.5]] },
      { text: '誰だ 誰だ！？', kana: 'だれだ だれだ', romaji: 'da-re-da da-re-da', en: 'Who is it? Who is it!?', chords: 'F#m E', melody: [[73, 1], [69, 1], [69, 1], [71, 1], [68, 1], [68, 1]] },
      { text: '急げ 急げ！', kana: 'いそげ いそげ', romaji: 'i-so-ge i-so-ge', en: 'Hurry! Hurry!', chords: 'D E C#m F#m', melody: [[69, 1], [74, 1], [71, 1.5], [71, 0.5], [76, 1], [73, 1]] },
      { text: '学校まで', kana: 'がっこうまで', romaji: 'ga-k-ko-u-ma-de', en: 'All the way to school', chords: 'Bm F#m F#m E', melody: [[66, 1], [71, 1], [73, 1.5], [73, 0.5], [73, 1], [73, 1]] },
      { text: '止まらないで', kana: 'とまらないで', romaji: 'to-ma-ra-na-i-de', en: 'Don’t stop', chords: 'D E C#m F#m', melody: [[69, 1], [74, 0.5], [74, 0.5], [76, 1.5], [76, 0.5], [76, 1.5]] },
      { text: '急げ 急げ！', kana: 'いそげ いそげ', romaji: 'i-so-ge i-so-ge', en: 'Hurry! Hurry!', chords: 'Bm D A A', melody: [[69, 1], [74, 1], [69, 1.5], [71, 0.5], [76, 1], [73, 1]] },
      { text: 'はあ はあ 止まって', kana: 'はあ はあ とまって', romaji: 'ha-a ha-a to-ma-t-te', en: 'Huff, puff… I stop', chords: 'D D', melody: [[74, 0.5], [69, 0.5], [74, 0.5], [69, 0.5], [69, 1], [74, 1], [74, 0.5], [74, 1.5]] },
      { text: '後ろを 見たら', kana: 'うしろを みたら', romaji: 'u-shi-ro-o mi-ta-ra', en: 'I look behind me…', chords: 'C#m F#m', melody: [[68, 0.5], [73, 0.5], [73, 0.5], [73, 0.5], [76, 1], [73, 1], [69, 2]] },
      { text: 'お母さん！？', kana: 'おかあさん', romaji: 'o-ka-a-sa-n', en: 'Mom!?', chords: 'Bm C#m', melody: [[71, 1], [74, 1], [71, 1], [71, 1], [68, 2]] },
      { text: '「お弁当 忘れたよ！」', kana: 'おべんとう わすれたよ', romaji: 'o-be-n-to-u wa-su-re-ta-yo', en: '“You forgot your lunch!”', chords: 'F#m E', melody: [[69, 0.5], [73, 0.5], [73, 0.5], [73, 0.5], [73, 0.5], [69, 0.5], [71, 0.5], [71, 0.5], [71, 1], [71, 1]] },
    ],
  },
  {
    // Run!, version B, over the other Mureka take: verse A | D | C♯m F♯m | Bm E (I–IV–iii–vi–ii–V); chorus
    // D | F♯m | Bm | F♯m E, opening on IV. A lunchtime race for the school's one melon bread, which the
    // teacher is already eating. The いそげ hook peaks on F♯5. Each game plays one of the two versions.
    id: 'hashire-b',
    group: 'hashire',
    title: { text: '走れ！', kana: 'はしれ', en: 'Run!' },
    bpm: 134,
    style: 'rock',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'run-melonpan', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'お昼の チャイム', kana: 'おひるの チャイム', romaji: 'o-hi-ru-no cha-i-mu', en: 'The lunch bell', chords: 'A D', melody: [[69, 1], [74, 0.5], [69, 0.5], [69, 1], [73, 0.5], [69, 0.5], [69, 2]] },
      { text: 'メロンパンは 一つ', kana: 'メロンパンは ひとつ', romaji: 'me-ro-n-pa-n-wa hi-to-tsu', en: 'There’s only one melon bread', chords: 'C#m F#m Bm E7', melody: [[68, 0.5], [73, 0.5], [73, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [69, 1], [74, 1], [71, 1]] },
      { text: 'みんなが 走る', kana: 'みんなが はしる', romaji: 'mi-n-na-ga ha-shi-ru', en: 'Everyone is running', chords: 'A D', melody: [[69, 0.5], [73, 0.5], [73, 1], [69, 1], [69, 1], [74, 1], [69, 1]] },
      { text: 'よし、行くぞ！', kana: 'よし いくぞ', romaji: 'yo-shi i-ku-zo', en: 'Okay, let’s go!', chords: 'C#m Bm Bm E7', melody: [[73, 1.5], [68, 0.5], [69, 1], [73, 1], [74, 2]] },
      { text: '急げ 急げ！', kana: 'いそげ いそげ', romaji: 'i-so-ge i-so-ge', en: 'Hurry! Hurry!', chords: 'Dmaj7 C#m F#m C#m', melody: [[69, 1], [74, 1], [73, 1.5], [73, 0.5], [78, 1], [69, 1]] },
      { text: '風に なって', kana: 'かぜに なって', romaji: 'ka-ze-ni na-t-te', en: 'Become the wind', chords: 'Bm F#m F#m E', melody: [[66, 1], [71, 1], [73, 0.5], [73, 1.5], [73, 0.5], [69, 1.5]] },
      { text: 'パンは わたしの！', kana: 'パンは わたしの', romaji: 'pa-n-wa wa-ta-shi-no', en: 'The bread is mine!', chords: 'Dmaj7 C#m C#m F#m', melody: [[74, 1], [69, 0.5], [69, 0.5], [68, 1], [73, 0.5], [76, 0.5], [76, 2]] },
      { text: '急げ 急げ！', kana: 'いそげ いそげ', romaji: 'i-so-ge i-so-ge', en: 'Hurry! Hurry!', chords: 'Bm D D D', melody: [[69, 1], [74, 1], [73, 1.5], [73, 0.5], [78, 1], [69, 1]] },
      { text: '一番に 着いた', kana: 'いちばんに ついた', romaji: 'i-chi-ba-n-ni tsu-i-ta', en: 'I got there first', chords: 'A D', melody: [[69, 0.5], [73, 0.5], [69, 0.5], [69, 0.5], [69, 1], [73, 1], [69, 1], [69, 1]] },
      { text: 'あった！ メロンパン', kana: 'あった メロンパン', romaji: 'a-t-ta me-ro-n-pa-n', en: 'There it is! Melon bread!', chords: 'C#m F#m Bm E7', melody: [[73, 1], [69, 0.5], [69, 0.5], [69, 0.5], [73, 0.5], [73, 1], [71, 1], [71, 1]] },
      { text: '手を 出したら', kana: 'てを だしたら', romaji: 'te-o da-shi-ta-ra', en: 'I reached out, and…', chords: 'A D', melody: [[73, 1], [69, 1], [73, 1], [69, 0.5], [69, 0.5], [69, 2]] },
      { text: '先生が 食べてる', kana: 'せんせいが たべてる', romaji: 'se-n-se-i-ga ta-be-te-ru', en: '…the teacher is eating it.', chords: 'C#m Bm Bm E7', melody: [[68, 0.5], [73, 0.5], [73, 0.5], [71, 0.5], [71, 0.5], [71, 1], [74, 0.5], [71, 0.5], [71, 1]] },
    ],
  },
  {
    // Cheers!, version A, over an AI-made izakaya-pop backing (Mureka, take 1; tracks.ts). The lines fit the
    // chords it really plays, beat by beat: the I–iii–vi–IV–V loop A C♯m | F♯m E A | D C♯m F♯m D | D E, the
    // chorus closing on A. Friday night, four beers, glasses up; verse 2 toasts the company, the next table
    // and the moon, and nobody has had a sip yet. The lyrics never sing the title (Ladi's rule): the chorus
    // raises glasses (グラスを あげよう) and says のもうよ instead. Each game plays one of the two versions.
    id: 'kanpai',
    group: 'kanpai',
    title: { text: '乾杯！', kana: 'かんぱい', en: 'Cheers!' },
    bpm: 107,
    style: 'izakaya',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'cheers-toast', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'やっと 金よう日', kana: 'やっと きんようび', romaji: 'ya-t-to ki-n-yo-u-bi', en: 'Friday at last', chords: 'A A C#m C#m F#m F#m E A', melody: [[64, 0.5], [69, 0.5], [69, 1], [64, 0.5], [68, 0.5], [68, 1], [66, 1], [66, 1]] },
      { text: '「みんな いる？」「いるよ！」', kana: 'みんな いる いるよ', romaji: 'mi-n-na i-ru i-ru-yo', en: '“Everyone here?” “Yep!”', chords: 'D D C#m F#m D D E E', melody: [[66, 0.5], [69, 0.5], [69, 1], [64, 0.5], [68, 0.5], [66, 0.5], [69, 0.5], [69, 1]] },
      { text: 'ビール 四つ ください', kana: 'ビール よっつ ください', romaji: 'bi-i-ru yo-t-tsu ku-da-sa-i', en: 'Four beers, please', chords: 'A A C#m C#m F#m F#m Bm A', melody: [[69, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [68, 0.5], [68, 0.5], [64, 0.5], [68, 0.5], [69, 1], [66, 1]] },
      { text: 'グラスを もって', kana: 'グラスを もって', romaji: 'gu-ra-su-o mo-t-te', en: 'Glass in hand', chords: 'D D C#m D D D E E', melody: [[69, 0.5], [66, 0.5], [66, 0.5], [66, 0.5], [73, 1], [69, 0.5], [66, 2.5]] },
      { text: 'グラスを あげよう！', kana: 'グラスを あげよう', romaji: 'gu-ra-su-o a-ge-yo-u', en: 'Raise your glasses!', chords: 'A A C#m C#m F#m F#m E A', melody: [[76, 0.5], [73, 0.5], [73, 1.5], [73, 0.5], [68, 0.5], [73, 0.5], [73, 1.5], [73, 0.5]] },
      { text: 'みんなで のもうよ！', kana: 'みんなで のもうよ', romaji: 'mi-n-na-de no-mo-u-yo', en: 'Let’s all drink together!', chords: 'D D A A D A A A', melody: [[69, 0.5], [74, 1.5], [76, 1.5], [73, 0.5], [69, 0.5], [74, 0.5], [73, 1.5], [69, 0.5]] },
      { text: 'もう いっかい！', kana: 'もう いっかい', romaji: 'mo-u i-k-ka-i', en: 'One more time!', chords: 'A A C#m C#m F#m F#m E A', melody: [[76, 1], [73, 1.5], [73, 1], [76, 0.5], [78, 1.5], [78, 0.5]] },
      { text: 'せーの、のもうよ！', kana: 'せーの のもうよ', romaji: 'se-e-no no-mo-u-yo', en: 'One, two… let’s drink!', chords: 'D D A A D E A A', melody: [[74, 1], [74, 1], [69, 2], [69, 0.5], [74, 0.5], [71, 1.5], [69, 0.5]] },
      { text: '会社の ために！', kana: 'かいしゃの ために', romaji: 'ka-i-sha-no ta-me-ni', en: 'To the company!', chords: 'A A C#m C#m F#m F#m E A', melody: [[64, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [64, 0.5], [68, 1], [64, 1]] },
      { text: 'となりの ために！', kana: 'となりの ために', romaji: 'to-na-ri-no ta-me-ni', en: 'To the next table!', chords: 'D D C#m F#m D D E E', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [64, 0.5], [68, 1], [66, 1]] },
      { text: '月の ために！', kana: 'つきの ために', romaji: 'tsu-ki-no ta-me-ni', en: 'To the moon!', chords: 'A A C#m C#m F#m F#m Bm A', melody: [[69, 0.5], [73, 1], [69, 0.5], [68, 0.5], [73, 1], [68, 1]] },
      { text: '…まだ 飲んでない', kana: 'まだ のんでない', romaji: 'ma-da no-n-de-na-i', en: '…and we still haven’t had a sip', chords: 'D D C#m D D D E E', melody: [[74, 1], [69, 1], [73, 1], [69, 1], [66, 1], [66, 1], [64, 1]] },
    ],
  },
  {
    // Cheers!, version B, over the other Mureka take: the royal road D E | C♯m F♯m | Bm C♯ | F♯m E, closing
    // Bm E | A. After work at the usual place: "a beer, for starters!" Verse 2 waits on Tanaka, who reads
    // the whole menu… and has a beer too. The title is not sung.
    id: 'kanpai-b',
    group: 'kanpai',
    title: { text: '乾杯！', kana: 'かんぱい', en: 'Cheers!' },
    bpm: 108,
    style: 'izakaya',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'cheers-starters', start: 0, segments: [[0, 40]] },
    lines: [
      { text: 'しごとの あとは', kana: 'しごとの あとは', romaji: 'shi-go-to-no a-to-wa', en: 'After work', chords: 'D D D E E C#m C#m F#m', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [69, 1], [68, 1], [64, 1]] },
      { text: 'いつもの おみせ', kana: 'いつもの おみせ', romaji: 'i-tsu-mo-no o-mi-se', en: 'our usual place', chords: 'Bm Bm Bm C# F#m F#m E E', melody: [[71, 1], [66, 0.5], [66, 0.5], [66, 1], [68, 1], [69, 1], [66, 1]] },
      { text: '「何に する？」', kana: 'なにに する', romaji: 'na-ni-ni su-ru', en: '“What are you having?”', chords: 'D D D E E C#m C#m F#m', melody: [[69, 1], [66, 0.5], [66, 0.5], [66, 1], [71, 2]] },
      { text: '「とりあえず ビール！」', kana: 'とりあえず ビール', romaji: 'to-ri-a-e-zu bi-i-ru', en: '“A beer, for starters!”', chords: 'Bm Bm Bm E A A A A', melody: [[66, 0.5], [71, 0.5], [71, 1], [66, 0.5], [66, 0.5], [71, 1], [69, 0.5], [64, 2]] },
      { text: 'グラスを あげよう！', kana: 'グラスを あげよう', romaji: 'gu-ra-su-o a-ge-yo-u', en: 'Raise your glasses!', chords: 'D D D E E C#m C#m F#m', melody: [[74, 0.5], [69, 0.5], [69, 1.5], [69, 0.5], [71, 0.5], [76, 0.5], [76, 1.5], [76, 0.5]] },
      { text: 'ビールを のもうよ！', kana: 'ビールを のもうよ', romaji: 'bi-i-ru-o no-mo-u-yo', en: 'Let’s drink some beer!', chords: 'F#m Bm Bm C# F#m F#m A A', melody: [[73, 1], [71, 0.5], [71, 0.5], [66, 1], [68, 0.5], [73, 0.5], [69, 1.5], [69, 0.5]] },
      { text: '今日も おつかれさま！', kana: 'きょうも おつかれさま', romaji: 'kyo-u-mo o-tsu-ka-re-sa-ma', en: 'Good work again today!', chords: 'D D D E E C#m F#m F#m', melody: [[78, 1], [74, 0.5], [74, 0.5], [69, 0.5], [74, 0.5], [76, 0.5], [76, 0.5], [76, 1.5], [76, 0.5]] },
      { text: 'さあ、のもうよ！', kana: 'さあ のもうよ', romaji: 'sa-a no-mo-u-yo', en: 'Come on, let’s drink!', chords: 'F#m F#m D E A A A A', melody: [[73, 1], [69, 1], [69, 0.5], [74, 0.5], [71, 1], [69, 2]] },
      { text: '「たなかくんは？」', kana: 'たなかくんは', romaji: 'ta-na-ka-ku-n-wa', en: '“And you, Tanaka?”', chords: 'F#m D D E E C#m E F#m', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [69, 1], [71, 1.5]] },
      { text: 'メニューを 見てる', kana: 'メニューを みてる', romaji: 'me-nyu-u-o mi-te-ru', en: 'He’s reading the menu', chords: 'F#m Bm Bm C# F#m F#m A A', melody: [[73, 1], [66, 0.5], [66, 0.5], [66, 1], [68, 1], [66, 1], [66, 1]] },
      { text: 'ずっと 見てる', kana: 'ずっと みてる', romaji: 'zu-t-to mi-te-ru', en: 'still reading it…', chords: 'A D D E E C#m F#m F#m', melody: [[64, 0.5], [69, 0.5], [69, 1], [69, 1], [68, 1], [64, 2]] },
      { text: '「…ぼくも ビール」', kana: 'ぼくも ビール', romaji: 'bo-ku-mo bi-i-ru', en: '“…I’ll have a beer too.”', chords: 'Bm Bm Bm E A A A A', melody: [[74, 1], [71, 1], [66, 1], [71, 1], [69, 1], [69, 2]] },
    ],
  },

  {
    // Monday Blues, version A, over an AI-made blues backing (Mureka, take 2; tracks.ts): Em | Am,
    // Em | Am, Em | Am, C | B7 (an 8-bar minor blues) under every section.
    // He oversleeps, grabs only his bag and makes the train; everyone stares (どうしてかな？). Verse 2
    // answers the chorus: he's in his pyjamas. Each game plays one of the four versions.
    id: 'getsuyoubi',
    group: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 94,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'monday-blues-2', start: 0, segments: [[0, 37]] },
    lines: [
      { text: '時計が 止まってる', kana: 'とけいが とまってる', romaji: 'to-ke-i-ga to-ma-t-te-ru', en: 'My alarm clock has stopped', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [69, 2]] },
      { text: 'もう 八時半', kana: 'もう はちじはん', romaji: 'mo-u ha-chi-ji-ha-n', en: 'It’s already half past eight', chords: 'Em7 Am', melody: [[71, 1], [67, 0.5], [64, 0.5], [67, 1], [67, 0.5], [67, 0.5], [64, 2]] },
      { text: 'かばんだけ 持って', kana: 'かばんだけ もって', romaji: 'ka-ba-n-da-ke mo-t-te', en: 'I grab just my bag', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 1], [71, 1], [64, 0.5], [64, 1.5]] },
      { text: '電車に 乗った', kana: 'でんしゃに のった', romaji: 'de-n-sha-ni no-t-ta', en: 'and make the train', chords: 'C B7', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 1.5], [67, 0.5], [71, 2]] },
      { text: '早く 早く 早く', kana: 'はやく はやく はやく', romaji: 'ha-ya-ku ha-ya-ku ha-ya-ku', en: 'Hurry, hurry, hurry', chords: 'Em7 Am', melody: [[76, 1], [71, 0.5], [71, 0.5], [74, 1], [71, 0.5], [67, 0.5], [76, 1], [72, 1.5], [69, 0.5]] },
      { text: 'みんなが 見てる', kana: 'みんなが みてる', romaji: 'mi-n-na-ga mi-te-ru', en: 'Everyone’s looking at me', chords: 'Em7 Am', melody: [[71, 0.5], [76, 0.5], [76, 1], [74, 0.5], [76, 1], [72, 0.5], [69, 2]] },
      { text: 'どうしてかな', kana: 'どうしてかな', romaji: 'do-u-shi-te-ka-na', en: 'I wonder why', chords: 'Em7 Am', melody: [[76, 1.5], [72, 0.5], [71, 0.5], [67, 1], [72, 0.5], [69, 2]] },
      { text: '早く 早く 早く', kana: 'はやく はやく はやく', romaji: 'ha-ya-ku ha-ya-ku ha-ya-ku', en: 'Hurry, hurry, hurry', chords: 'C B7', melody: [[76, 1], [72, 0.5], [72, 0.5], [76, 1], [72, 0.5], [69, 0.5], [75, 1], [71, 1.5], [66, 0.5]] },
      { text: '会社に 着いたら', kana: 'かいしゃに ついたら', romaji: 'ka-i-sha-ni tsu-i-ta-ra', en: 'At the office', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1], [67, 0.5], [67, 0.5], [64, 2]] },
      { text: 'みんなが 笑う', kana: 'みんなが わらう', romaji: 'mi-n-na-ga wa-ra-u', en: 'everyone laughs', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 1], [64, 0.5], [64, 1], [67, 0.5], [69, 2]] },
      { text: '下を 見たら', kana: 'したを みたら', romaji: 'shi-ta-o mi-ta-ra', en: 'I look down…', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 1], [71, 1], [67, 0.5], [64, 1]] },
      { text: 'パジャマ だった！', kana: 'パジャマ だった', romaji: 'pa-ja-ma da-t-ta', en: '…I’m in my pyjamas!', chords: 'C B7', melody: [[76, 1], [72, 0.5], [72, 0.5], [72, 1.5], [72, 0.5], [71, 3]] },
    ],
  },
  {
    // Monday Blues, version B, over the other Mureka take: verse Em | Em, Am | D7 (a i–i–iv–♭VII
    // shuffle); chorus Em | Em, Am | B7.
    // The chorus asks for a day off (休みは まだかな); verse 2 finds the office empty, because it's a
    // holiday Monday.
    id: 'getsuyoubi-b',
    group: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 92,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'monday-blues-1', start: 0, segments: [[0, 39]] },
    lines: [
      { text: '時計が 鳴って', kana: 'とけいが なって', romaji: 'to-ke-i-ga na-t-te', en: 'The alarm clock rings', chords: 'Em7 Em7', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 1], [64, 0.5], [64, 2]] },
      { text: 'ネクタイ しめて', kana: 'ネクタイ しめて', romaji: 'ne-ku-ta-i shi-me-te', en: 'I put on my tie', chords: 'Am D7', melody: [[72, 1], [69, 0.5], [69, 0.5], [69, 1], [72, 0.5], [69, 0.5], [66, 2]] },
      { text: '駅まで 走る', kana: 'えきまで はしる', romaji: 'e-ki-ma-de ha-shi-ru', en: 'I run to the station', chords: 'Em7 Em7', melody: [[71, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [64, 1], [71, 1], [67, 2]] },
      { text: '今日も 会社', kana: 'きょうも かいしゃ', romaji: 'kyo-u-mo ka-i-sha', en: 'Work again today', chords: 'Am D7', melody: [[72, 1], [69, 0.5], [69, 0.5], [64, 1], [69, 1], [69, 2.5]] },
      { text: 'ああ 行きたくない', kana: 'ああ いきたくない', romaji: 'a-a i-ki-ta-ku-na-i', en: 'Oh, I don’t want to go', chords: 'Em7 Em7', melody: [[76, 1], [71, 0.5], [67, 0.5], [74, 1], [74, 0.5], [71, 0.5], [71, 1.5], [67, 1]] },
      { text: '休みは まだかな', kana: 'やすみは まだかな', romaji: 'ya-su-mi-wa ma-da-ka-na', en: 'Is my day off here yet?', chords: 'Am B7', melody: [[69, 0.5], [76, 0.5], [76, 1.5], [72, 0.5], [72, 0.5], [69, 0.5], [71, 0.5], [66, 2]] },
      { text: '眠いなあ', kana: 'ねむいなあ', romaji: 'ne-mu-i-na-a', en: 'I’m so sleepy', chords: 'Em7 Em7', melody: [[71, 0.5], [76, 1.5], [74, 1], [71, 1], [67, 2]] },
      { text: 'ああ 行きたくない', kana: 'ああ いきたくない', romaji: 'a-a i-ki-ta-ku-na-i', en: 'Oh, I don’t want to go', chords: 'Am B7', melody: [[76, 1], [72, 0.5], [69, 0.5], [76, 1], [76, 0.5], [72, 0.5], [71, 1.5], [66, 1]] },
      { text: '会社に 着いて', kana: 'かいしゃに ついて', romaji: 'ka-i-sha-ni tsu-i-te', en: 'I get to the office', chords: 'Em7 Em7', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 1], [64, 0.5], [64, 2]] },
      { text: 'だれも いない', kana: 'だれも いない', romaji: 'da-re-mo i-na-i', en: 'Nobody’s there', chords: 'Am D7', melody: [[72, 1], [69, 0.5], [69, 0.5], [69, 1], [72, 1.5], [72, 1]] },
      { text: 'カレンダーを 見たら', kana: 'カレンダーを みたら', romaji: 'ka-re-n-da-a-o mi-ta-ra', en: 'I check the calendar…', chords: 'Em7 Em7', melody: [[64, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [71, 1], [67, 0.5], [67, 1]] },
      { text: '今日は 休み！', kana: 'きょうは やすみ', romaji: 'kyo-u-wa ya-su-mi', en: '…today’s a holiday!', chords: 'Am D7', melody: [[76, 1], [72, 0.5], [72, 0.5], [69, 1], [72, 1], [74, 2]] },
    ],
  },
  {
    // Monday Blues, version C, a straight learning song over take 1 (no joke, at Ladi's request): a
    // working day in clock times (七時, 八時, 九時から 五時まで), and a chorus that walks through the weekdays.
    id: 'getsuyoubi-c',
    group: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 92,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'monday-blues-1', start: 0, segments: [[0, 39]] },
    lines: [
      { text: '朝 七時に 起きて', kana: 'あさ しちじに おきて', romaji: 'a-sa shi-chi-ji-ni o-ki-te', en: 'I get up at seven in the morning', chords: 'Em7 Em7', melody: [[71, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [71, 1], [67, 0.5], [67, 2]] },
      { text: 'パンと たまご', kana: 'パンと たまご', romaji: 'pa-n-to ta-ma-go', en: 'Bread and an egg', chords: 'Am D7', melody: [[72, 1], [69, 0.5], [69, 0.5], [64, 1], [69, 1], [66, 2.5]] },
      { text: '八時の 電車', kana: 'はちじの でんしゃ', romaji: 'ha-chi-ji-no de-n-sha', en: 'The eight o’clock train', chords: 'Em7 Em7', melody: [[64, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [64, 1], [67, 1], [71, 2]] },
      { text: '会社へ 行こう', kana: 'かいしゃへ いこう', romaji: 'ka-i-sha-e i-ko-u', en: 'Off to work', chords: 'Am D7', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [69, 1], [72, 1], [74, 2.5]] },
      { text: '月曜日 スタート', kana: 'げつようび スタート', romaji: 'ge-tsu-yo-u-bi su-ta-a-to', en: 'Monday: off we go', chords: 'Em7 Em7', melody: [[71, 0.5], [76, 0.5], [76, 1.5], [74, 0.5], [71, 0.5], [69, 0.5], [71, 0.5], [67, 1.5], [67, 0.5]] },
      { text: '火曜日 水曜日', kana: 'かようび すいようび', romaji: 'ka-yo-u-bi su-i-yo-u-bi', en: 'Tuesday, Wednesday', chords: 'Am B7', melody: [[69, 0.5], [76, 0.5], [72, 1], [69, 0.5], [69, 1], [71, 0.5], [71, 0.5], [66, 1.5], [66, 0.5]] },
      { text: '木曜日 金曜日', kana: 'もくようび きんようび', romaji: 'mo-ku-yo-u-bi ki-n-yo-u-bi', en: 'Thursday, Friday', chords: 'Em7 Em7', melody: [[71, 0.5], [76, 0.5], [76, 0.5], [74, 0.5], [71, 0.5], [71, 0.5], [76, 0.5], [76, 0.5], [74, 0.5], [71, 1.5]] },
      { text: '月曜日 スタート', kana: 'げつようび スタート', romaji: 'ge-tsu-yo-u-bi su-ta-a-to', en: 'Monday: off we go', chords: 'Am B7', melody: [[69, 0.5], [76, 0.5], [76, 1.5], [74, 0.5], [72, 0.5], [69, 0.5], [71, 0.5], [66, 1.5], [66, 0.5]] },
      { text: '九時から 五時まで', kana: 'くじから ごじまで', romaji: 'ku-ji-ka-ra go-ji-ma-de', en: 'From nine to five', chords: 'Em7 Em7', melody: [[71, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1.5], [67, 0.5], [67, 0.5], [64, 1]] },
      { text: '毎日 仕事', kana: 'まいにち しごと', romaji: 'ma-i-ni-chi shi-go-to', en: 'Work every day', chords: 'Am D7', melody: [[72, 1], [69, 0.5], [69, 0.5], [69, 0.5], [64, 0.5], [69, 1], [69, 2.5]] },
      { text: '五時に なったら', kana: 'ごじに なったら', romaji: 'go-ji-ni na-t-ta-ra', en: 'When it gets to five', chords: 'Em7 Em7', melody: [[71, 0.5], [67, 0.5], [67, 1], [71, 1], [67, 0.5], [67, 0.5], [67, 2]] },
      { text: 'うちへ 帰ろう', kana: 'うちへ かえろう', romaji: 'u-chi-e ka-e-ro-u', en: 'I’ll go home', chords: 'Am D7', melody: [[69, 0.5], [72, 0.5], [72, 1], [69, 1], [72, 0.5], [72, 0.5], [69, 2.5]] },
    ],
  },
  {
    // Monday Blues, version D, a straight learning song over take 2: a rainy Monday (ねむくて さむい),
    // then a friend at the office door and a shared おはよう.
    id: 'getsuyoubi-d',
    group: 'getsuyoubi',
    title: { text: '月曜日 ブルース', kana: 'げつようび ブルース', en: 'Monday Blues' },
    bpm: 94,
    style: 'blues',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'monday-blues-2', start: 0, segments: [[0, 37]] },
    lines: [
      { text: '雨の 月曜日', kana: 'あめの げつようび', romaji: 'a-me-no ge-tsu-yo-u-bi', en: 'A rainy Monday', chords: 'Em7 Am', melody: [[71, 1], [67, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [67, 1], [64, 0.5], [64, 1.5]] },
      { text: 'かさを さして', kana: 'かさを さして', romaji: 'ka-sa-o sa-shi-te', en: 'I put up my umbrella', chords: 'Em7 Am', melody: [[71, 1], [67, 0.5], [67, 0.5], [71, 1], [67, 0.5], [64, 2.5]] },
      { text: '駅まで 歩いて', kana: 'えきまで あるいて', romaji: 'e-ki-ma-de a-ru-i-te', en: 'walk to the station', chords: 'Em7 Am', melody: [[71, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [64, 1], [67, 0.5], [64, 0.5], [64, 2]] },
      { text: '電車に 乗った', kana: 'でんしゃに のった', romaji: 'de-n-sha-ni no-t-ta', en: 'and get on the train', chords: 'C B7', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 1.5], [67, 0.5], [71, 2]] },
      { text: 'ゆっくり 行こうよ', kana: 'ゆっくり いこうよ', romaji: 'yu-k-ku-ri i-ko-u-yo', en: 'Let’s take it slow', chords: 'Em7 Am', melody: [[71, 0.5], [76, 0.5], [76, 1.5], [74, 0.5], [71, 0.5], [72, 0.5], [72, 1.5], [69, 1]] },
      { text: '眠くて 寒い', kana: 'ねむくて さむい', romaji: 'ne-mu-ku-te sa-mu-i', en: 'Sleepy and cold', chords: 'Em7 Am', melody: [[71, 0.5], [76, 0.5], [71, 0.5], [71, 1], [71, 0.5], [76, 1], [69, 1.5]] },
      { text: 'でも 大丈夫', kana: 'でも だいじょうぶ', romaji: 'de-mo da-i-jo-u-bu', en: 'But I’m OK', chords: 'Em7 Am', melody: [[76, 1], [71, 0.5], [67, 0.5], [74, 0.5], [74, 1.5], [72, 0.5], [69, 1.5]] },
      { text: 'ゆっくり 行こうよ', kana: 'ゆっくり いこうよ', romaji: 'yu-k-ku-ri i-ko-u-yo', en: 'Let’s take it slow', chords: 'C B7', melody: [[72, 0.5], [76, 0.5], [76, 1.5], [74, 0.5], [67, 0.5], [72, 0.5], [71, 1.5], [66, 1]] },
      { text: '会社の 前で', kana: 'かいしゃの まえで', romaji: 'ka-i-sha-no ma-e-de', en: 'Outside the office', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1.5], [67, 0.5], [64, 1]] },
      { text: '友だちに 会った', kana: 'ともだちに あった', romaji: 'to-mo-da-chi-ni a-t-ta', en: 'I ran into a friend', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [71, 1], [67, 0.5], [69, 2]] },
      { text: '「おはよう」と 言って', kana: 'おはようと いって', romaji: 'o-ha-yo-u-to i-t-te', en: 'We say “good morning”', chords: 'Em7 Am', melody: [[64, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 1], [67, 0.5], [69, 2]] },
      { text: 'いっしょに 笑う', kana: 'いっしょに わらう', romaji: 'i-s-sho-ni wa-ra-u', en: 'and laugh together', chords: 'C B7', melody: [[67, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [67, 1], [72, 1], [71, 2.5]] },
    ],
  },
  {
    // Where Were You?, version A, over an AI-made Shōwa kayō duet backing (Mureka, take 1; tracks.ts), 88 bpm
    // in F major: one 8-bar loop under every section, | F | A7 | D7 | C7 F | B♭ B♭m | A7 Dm | Gm | C7 |, the
    // choruses louder than the verses. A couple each waited three hours at the same station; verse 2 finds
    // they were at opposite exits, and tomorrow's plan already splits them again (north and south). The
    // lyrics never sing the song's title (Ladi's rule). Each game plays one of the two versions.
    id: 'doko-itteta',
    group: 'doko-itteta',
    title: { text: 'どこ 行ってたの？', kana: 'どこ いってたの', en: 'Where Were You?' },
    bpm: 88,
    style: 'kayou',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'where-were-you-1', start: 0, segments: [[0, 37]] },
    lines: [
      { text: '駅で 待ってた', kana: 'えきで まってた', romaji: 'e-ki-de ma-t-te-ta', en: 'I waited at the station', chords: 'F A7', melody: [[69, 1], [65, 0.5], [65, 0.5], [69, 1], [69, 0.5], [64, 0.5], [64, 2]] },
      { text: '僕も 待ってた', kana: 'ぼくも まってた', romaji: 'bo-ku-mo ma-t-te-ta', en: 'I waited too', chords: 'D7 D7 C7 F', melody: [[72, 1], [69, 0.5], [69, 0.5], [72, 1], [72, 0.5], [70, 0.5], [67, 2]] },
      { text: '三時間も', kana: 'さんじかんも', romaji: 'sa-n-ji-ka-n-mo', en: 'For three whole hours', chords: 'Bb Bbm A7 Dm', melody: [[65, 0.5], [70, 0.5], [70, 1], [65, 1], [65, 1], [64, 2]] },
      { text: '僕も 三時間', kana: 'ぼくも さんじかん', romaji: 'bo-ku-mo sa-n-ji-ka-n', en: 'Me too, three hours', chords: 'Gm C7', melody: [[70, 1], [67, 0.5], [67, 0.5], [67, 0.5], [70, 0.5], [70, 1], [67, 0.5], [64, 1.5]] },
      { text: '会えない 二人', kana: 'あえない ふたり', romaji: 'a-e-na-i fu-ta-ri', en: 'Two who never meet', chords: 'F A7', melody: [[69, 1], [72, 1], [69, 0.5], [69, 0.5], [69, 0.5], [72, 0.5], [76, 2]] },
      { text: 'ここに いたよ', kana: 'ここに いたよ', romaji: 'ko-ko-ni i-ta-yo', en: 'I was right here!', chords: 'D7 D7 C7 F', melody: [[69, 1], [72, 0.5], [72, 0.5], [69, 1], [72, 1], [72, 2]] },
      { text: 'ずっと 待ってたのに', kana: 'ずっと まってたのに', romaji: 'zu-t-to ma-t-te-ta-no-ni', en: 'And I waited all that time', chords: 'Bb Bbm A7 Dm', melody: [[70, 0.5], [74, 0.5], [74, 1], [77, 1], [77, 0.5], [72, 0.5], [69, 0.5], [69, 0.5], [69, 1]] },
      { text: '会えない 二人', kana: 'あえない ふたり', romaji: 'a-e-na-i fu-ta-ri', en: 'Two who never meet', chords: 'Gm C7', melody: [[67, 1], [70, 1], [67, 0.5], [67, 0.5], [67, 0.5], [70, 0.5], [72, 2]] },
      { text: '僕は 西口', kana: 'ぼくは にしぐち', romaji: 'bo-ku-wa ni-shi-gu-chi', en: 'I was at the west exit', chords: 'F A7', melody: [[69, 1], [65, 0.5], [65, 0.5], [65, 0.5], [69, 0.5], [69, 1], [64, 2]] },
      { text: '私は 東口', kana: 'わたしは ひがしぐち', romaji: 'wa-ta-shi-wa hi-ga-shi-gu-chi', en: 'I was at the east exit', chords: 'D7 D7 C7 F', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [67, 2]] },
      { text: '明日は 北口', kana: 'あしたは きたぐち', romaji: 'a-shi-ta-wa ki-ta-gu-chi', en: 'Tomorrow, the north exit', chords: 'Bb Bbm A7 Dm', melody: [[65, 0.5], [70, 0.5], [70, 1], [65, 0.5], [65, 0.5], [70, 0.5], [70, 0.5], [69, 2]] },
      { text: '私は 南口', kana: 'わたしは みなみぐち', romaji: 'wa-ta-shi-wa mi-na-mi-gu-chi', en: '…I’ll be at the south exit.', chords: 'Gm C7', melody: [[67, 0.5], [70, 0.5], [70, 0.5], [70, 0.5], [67, 0.5], [70, 0.5], [70, 0.5], [70, 0.5], [72, 2.5]] },
    ],
  },
  {
    // Where Were You?, version B, over the other Mureka take, 89 bpm in D major: verse | D | A7 F♯7 | Bm |
    // A7 D7 | G Gm | F♯m E7 | Em | A7 |; the chorus turns to B7 Bm and closes on D; verse 2 runs D | A7 D7 |
    // B7 | Em D7 | G Gm | D E7 | Em | A7. He's out late every night with a hoarse voice and says it's work;
    // verse 2: he's been at karaoke alone, practising this song, and he's still bad.
    id: 'doko-itteta-b',
    group: 'doko-itteta',
    title: { text: 'どこ 行ってたの？', kana: 'どこ いってたの', en: 'Where Were You?' },
    bpm: 89,
    style: 'kayou',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'where-were-you-2', start: 0, segments: [[0, 37]] },
    lines: [
      { text: '毎晩 遅い', kana: 'まいばん おそい', romaji: 'ma-i-ba-n o-so-i', en: 'Late every night', chords: 'D D A7 F#7', melody: [[69, 1], [66, 0.5], [66, 0.5], [66, 0.5], [66, 0.5], [69, 1], [67, 2]] },
      { text: '仕事 だよ', kana: 'しごと だよ', romaji: 'shi-go-to da-yo', en: 'It’s work', chords: 'Bm Bm A7 D7', melody: [[66, 0.5], [71, 0.5], [71, 1], [71, 2], [69, 2]] },
      { text: 'でも 声が 変', kana: 'でも こえが へん', romaji: 'de-mo ko-e-ga he-n', en: 'But your voice sounds funny', chords: 'G Gm F#m E7', melody: [[74, 1.5], [71, 0.5], [74, 0.5], [67, 0.5], [67, 1], [69, 1], [66, 1]] },
      { text: '風邪を ひいた', kana: 'かぜを ひいた', romaji: 'ka-ze-o hi-i-ta', en: 'I caught a cold', chords: 'Em A7', melody: [[67, 0.5], [71, 0.5], [71, 1], [71, 1], [71, 1], [73, 2]] },
      { text: 'うそ ばっかり', kana: 'うそ ばっかり', romaji: 'u-so ba-k-ka-ri', en: 'Nothing but lies!', chords: 'D D A7 F#7', melody: [[74, 1.5], [69, 0.5], [69, 0.5], [69, 0.5], [66, 1], [64, 2]] },
      { text: '本当 だよ', kana: 'ほんとう だよ', romaji: 'ho-n-to-u da-yo', en: 'It’s true, honest!', chords: 'B7 Bm A7 D7', melody: [[66, 1.5], [71, 0.5], [71, 0.5], [71, 0.5], [71, 1], [69, 2]] },
      { text: '誰と いたの？', kana: 'だれと いたの', romaji: 'da-re-to i-ta-no', en: 'Who were you with?', chords: 'G Gm F#m E7', melody: [[74, 1], [71, 1], [67, 1], [67, 1], [73, 1], [73, 1]] },
      { text: 'うそ ばっかり', kana: 'うそ ばっかり', romaji: 'u-so ba-k-ka-ri', en: 'Nothing but lies!', chords: 'Em D', melody: [[71, 1.5], [67, 0.5], [67, 0.5], [67, 0.5], [64, 1], [62, 2]] },
      { text: '一人 カラオケ', kana: 'ひとり カラオケ', romaji: 'hi-to-ri ka-ra-o-ke', en: 'Karaoke, on my own', chords: 'D D A7 D7', melody: [[66, 0.5], [69, 1], [66, 0.5], [66, 0.5], [69, 0.5], [69, 1], [64, 2]] },
      { text: '毎晩 一人で？', kana: 'まいばん ひとりで', romaji: 'ma-i-ba-n hi-to-ri-de', en: 'Alone, every night?', chords: 'B7 B7 Em D7', melody: [[71, 1], [66, 0.5], [66, 0.5], [66, 0.5], [66, 0.5], [71, 1], [67, 0.5], [64, 1.5]] },
      { text: 'この 歌の 練習', kana: 'この うたの れんしゅう', romaji: 'ko-no u-ta-no re-n-shu-u', en: 'Practising this song', chords: 'G Gm D E7', melody: [[67, 0.5], [71, 0.5], [67, 0.5], [71, 0.5], [67, 0.5], [67, 0.5], [74, 1], [74, 0.5], [74, 1.5]] },
      { text: 'でも まだ 下手', kana: 'でも まだ へた', romaji: 'de-mo ma-da he-ta', en: '…and you’re still bad.', chords: 'Em A7', melody: [[71, 1], [67, 0.5], [71, 0.5], [67, 1], [64, 1], [69, 2]] },
    ],
  },
  {
    // Self-Intro Rap, version A: the challenge song, over an AI-made boom-bap backing (Mureka, take 1;
    // tracks.ts) on a two-bar loop, Dm7 G7 | Cmaj7 Am7, at 96 bpm in C major. The rap follows the
    // pitch accent on two notes a half-bar. Verse 1 is slow, after a rest on beat 1; the chorus is sung
    // and keeps shouting もっと 速く！; verse 2 is verse 1 in double time (eighth notes). B boasts of
    // rapping every day, A calls the bluff, and after a tacet B gasps …疲れた.
    id: 'jikoshoukai-rap',
    group: 'jikoshoukai-rap',
    title: { text: '自己紹介 ラップ', kana: 'じこしょうかい ラップ', en: 'Self-Intro Rap' },
    bpm: 96,
    style: 'hiphop',
    level: 'kana',
    status: 'draft',
    // Verse lines start after the beat (a rest, or half a beat in double time); the punchline waits two.
    form: standardForm(16, 8).map((p) => ({ ...p, beat: p.beat + [1, 1, 1, 1, 0, 0, 0, 0, 0.5, 0.5, 0.5, 2][p.line]! })),
    track: { id: 'self-intro-faster', start: 0, segments: [[0, 39]] },
    lines: [
      { text: 'はじめまして', kana: 'はじめまして', romaji: 'ha-ji-me-ma-shi-te', en: 'Nice to meet you', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 1], [65, 1], [65, 0.5], [65, 0.5], [64, 0.5], [64, 2]] },
      { text: '聞いて 聞いて', kana: 'きいて きいて', romaji: 'ki-i-te ki-i-te', en: 'Listen, listen', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [65, 1], [62, 0.5], [65, 0.5], [67, 1]] },
      { text: '趣味は ラップ', kana: 'しゅみは ラップ', romaji: 'shu-mi-wa ra-p-pu', en: 'My hobby is rap', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 1], [62, 0.5], [62, 0.5], [65, 1], [64, 0.5], [64, 0.5]] },
      { text: '毎日 ラップ', kana: 'まいにち ラップ', romaji: 'ma-i-ni-chi ra-p-pu', en: 'I rap every day', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [65, 1], [64, 0.5], [64, 0.5]] },
      { text: 'マイクを どうぞ', kana: 'マイクを どうぞ', romaji: 'ma-i-ku-o do-u-zo', en: 'Here’s the mic,', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[72, 1], [69, 0.5], [69, 0.5], [67, 0.5], [71, 1], [67, 0.5], [64, 2]] },
      { text: 'ラップで どうぞ', kana: 'ラップで どうぞ', romaji: 'ra-p-pu-de do-u-zo', en: 'in a rap, go on', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[72, 1], [69, 0.5], [69, 0.5], [67, 0.5], [71, 1], [67, 0.5], [64, 2]] },
      { text: 'もっと 速く！', kana: 'もっと はやく', romaji: 'mo-t-to ha-ya-ku', en: 'Faster!', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[72, 1], [72, 0.5], [69, 0.5], [74, 1], [71, 1.5], [67, 1]] },
      { text: 'みんなで ラップ', kana: 'みんなで ラップ', romaji: 'mi-n-na-de ra-p-pu', en: 'Everybody rap!', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[69, 0.5], [72, 1], [72, 0.5], [67, 2], [72, 1], [67, 0.5], [64, 0.5]] },
      { text: 'はじめまして 聞いて 聞いて', kana: 'はじめまして きいて きいて', romaji: 'ha-ji-me-ma-shi-te ki-i-te ki-i-te', en: 'Nice to meet you, listen, listen', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [65, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [67, 1]] },
      { text: '趣味は ラップ 毎日 ラップ', kana: 'しゅみは ラップ まいにち ラップ', romaji: 'shu-mi-wa ra-p-pu ma-i-ni-chi ra-p-pu', en: 'My hobby is rap, I rap every day', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [64, 1]] },
      { text: '毎日？ じゃあ もっと 速く！', kana: 'まいにち じゃあ もっと はやく', romaji: 'ma-i-ni-chi ja-a mo-t-to ha-ya-ku', en: 'Every day? Then go faster!', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [62, 0.5], [65, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [64, 1]] },
      { text: '…疲れた', kana: 'つかれた', romaji: 'tsu-ka-re-ta', en: '…I’m worn out.', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 1.5], [67, 1], [60, 2.5]] },
    ],
  },
  {
    // Self-Intro Rap, version B, over the other Mureka take: the same Dm7 G7 | Cmaj7 Am7 loop and
    // tempo. No joke: a plain self-introduction to learn by heart (name, where from, hobby, favourite
    // food). The chorus asks the questions the verses answer, verse 2 is verse 1 in double time, and
    // the last line hands the mic to the partner.
    id: 'jikoshoukai-rap-b',
    group: 'jikoshoukai-rap',
    title: { text: '自己紹介 ラップ', kana: 'じこしょうかい ラップ', en: 'Self-Intro Rap' },
    bpm: 96,
    style: 'hiphop',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8).map((p) => ({ ...p, beat: p.beat + [1, 1, 1, 1, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5][p.line]! })),
    track: { id: 'self-intro-questions', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'はじめまして', kana: 'はじめまして', romaji: 'ha-ji-me-ma-shi-te', en: 'Nice to meet you', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [65, 0.5], [65, 1], [62, 0.5], [60, 2.5]] },
      { text: 'カナダから 来た', kana: 'カナダから きた', romaji: 'ka-na-da-ka-ra ki-ta', en: 'I came from Canada', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [64, 2.5]] },
      { text: '趣味は ダンス', kana: 'しゅみは ダンス', romaji: 'shu-mi-wa da-n-su', en: 'My hobby is dancing', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 1], [62, 0.5], [62, 0.5], [65, 1], [64, 2], [64, 0.5]] },
      { text: 'すしが 一番', kana: 'すしが いちばん', romaji: 'su-shi-ga i-chi-ba-n', en: 'and sushi is my favourite', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 1], [62, 0.5], [62, 0.5], [65, 0.5], [64, 0.5], [64, 2]] },
      { text: '名前は 何？', kana: 'なまえは なに', romaji: 'na-ma-e-wa na-ni', en: 'What’s your name?', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [74, 1], [67, 2]] },
      { text: 'どこから 来たの？', kana: 'どこから きたの', romaji: 'do-ko-ka-ra ki-ta-no', en: 'Where are you from?', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[72, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [71, 0.5], [67, 0.5], [67, 1.5]] },
      { text: '趣味は 何？', kana: 'しゅみは なに', romaji: 'shu-mi-wa na-ni', en: 'What are your hobbies?', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[74, 1], [69, 0.5], [69, 0.5], [71, 1], [67, 1.5]] },
      { text: '教えて ください', kana: 'おしえて ください', romaji: 'o-shi-e-te ku-da-sa-i', en: 'Tell me, please', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[69, 0.5], [72, 0.5], [72, 0.5], [72, 0.5], [71, 0.5], [74, 1], [74, 0.5], [67, 2]] },
      { text: 'はじめまして カナダから 来た', kana: 'はじめまして カナダから きた', romaji: 'ha-ji-me-ma-shi-te ka-na-da-ka-ra ki-ta', en: 'Nice to meet you, I came from Canada', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [65, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5]] },
      { text: '趣味は ダンス すしが 大好き', kana: 'しゅみは ダンス すしが だいすき', romaji: 'shu-mi-wa da-n-su su-shi-ga da-i-su-ki', en: 'I dance, and I love sushi', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[65, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [64, 0.5]] },
      { text: '日本の アニメも よく 見ます', kana: 'にほんの アニメも よく みます', romaji: 'ni-ho-n-no a-ni-me-mo yo-ku mi-ma-su', en: 'I watch a lot of Japanese anime, too', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [65, 0.5], [67, 0.5], [67, 0.5], [64, 0.5], [64, 0.5], [67, 0.5], [64, 0.5]] },
      { text: 'あなたの ことも 教えて', kana: 'あなたの ことも おしえて', romaji: 'a-na-ta-no ko-to-mo o-shi-e-te', en: 'Now tell me about you', chords: 'Dm7 G7 Cmaj7 Am7', melody: [[62, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [62, 0.5], [65, 0.5], [62, 0.5], [60, 0.5], [67, 0.5], [67, 0.5], [67, 1]] },
    ],
  },
  {
    // Sparkle Idol, version A, over an AI-made idol-pop backing (Mureka; tracks.ts), A major: verse
    // Dmaj7 | F♯m7 | Bm7 | Amaj7, chorus on IV (D D C♯m F♯m Bm E–A A). The idol greets her fans and counts
    // the crowd in verse 2: one, two, three… Dad, Mum and the cat. The lyrics never sing the song's title
    // (Ladi's rule); the chorus hook is ニコニコ ハッピー instead.
    id: 'kirakira-idol',
    group: 'kirakira-idol',
    title: { text: 'キラキラ アイドル', kana: 'キラキラ アイドル', en: 'Sparkle Idol' },
    bpm: 128,
    style: 'idol',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'sparkle-idol-1', start: 0, segments: [[0, 40]] },
    lines: [
      { text: '今日は ライブ！', kana: 'きょうは ライブ', romaji: 'kyo-u-wa ra-i-bu', en: 'Today’s the big show!', chords: 'Dmaj7 Dmaj7 F#m7 F#m7', melody: [[69, 1], [66, 0.5], [66, 0.5], [73, 1], [69, 0.5], [69, 2.5]] },
      { text: 'みんなに 会いたい', kana: 'みんなに あいたい', romaji: 'mi-n-na-ni a-i-ta-i', en: 'I can’t wait to see you all', chords: 'Bm7 Amaj7 Amaj7 C#m7', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [66, 0.5], [68, 0.5], [73, 0.5], [73, 0.5], [69, 2.5]] },
      { text: '手を 振って', kana: 'てを ふって', romaji: 'te-o fu-t-te', en: 'Wave your hands', chords: 'Dmaj7 Dmaj7 F#m7 F#m7', melody: [[69, 1], [66, 1], [66, 0.5], [69, 0.5], [69, 3]] },
      { text: '大きな 声で', kana: 'おおきな こえで', romaji: 'o-o-ki-na ko-e-de', en: 'Nice and loud!', chords: 'Bm7 Amaj7 Amaj7 Amaj7', melody: [[71, 1], [66, 0.5], [66, 0.5], [66, 1], [73, 0.5], [68, 0.5], [68, 2]] },
      { text: 'ニコニコ ハッピー', kana: 'ニコニコ ハッピー', romaji: 'ni-ko-ni-ko ha-p-pi-i', en: 'All smiles, so happy', chords: 'Dmaj7 Dmaj7 Dmaj7 Dmaj7', melody: [[78, 1], [74, 0.5], [74, 0.5], [73, 1], [74, 1], [69, 0.5], [69, 0.5], [66, 2]] },
      { text: 'みんな 大好き', kana: 'みんな だいすき', romaji: 'mi-n-na da-i-su-ki', en: 'I love you all', chords: 'C#m7 C#m7 F#m7 F#m7', melody: [[68, 0.5], [73, 0.5], [73, 1], [76, 1], [73, 0.5], [73, 0.5], [69, 2]] },
      { text: 'いつも そばに いる', kana: 'いつも そばに いる', romaji: 'i-tsu-mo so-ba-ni i-ru', en: 'I’m always by your side', chords: 'Bm7 Bm7 E7 Amaj7', melody: [[74, 0.5], [71, 0.5], [71, 1], [78, 1], [74, 0.5], [74, 0.5], [71, 1], [76, 2]] },
      { text: 'ニコニコ ハッピー', kana: 'ニコニコ ハッピー', romaji: 'ni-ko-ni-ko ha-p-pi-i', en: 'All smiles, so happy', chords: 'Amaj7 Amaj7 E7 A7', melody: [[76, 1], [73, 0.5], [73, 0.5], [69, 1], [76, 1], [73, 0.5], [71, 0.5], [69, 2]] },
      { text: '今日の お客さん', kana: 'きょうの おきゃくさん', romaji: 'kyo-u-no o-kya-ku-sa-n', en: 'Today’s audience:', chords: 'Dmaj7 Dmaj7 F#m7 F#m7', melody: [[69, 1], [66, 0.5], [66, 0.5], [66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [69, 2]] },
      { text: '一人 二人 三人', kana: 'ひとり ふたり さんにん', romaji: 'hi-to-ri fu-ta-ri sa-n-ni-n', en: 'one, two, three people', chords: 'Bm7 Amaj7 Amaj7 E7', melody: [[66, 0.5], [69, 0.5], [66, 0.5], [66, 0.5], [73, 0.5], [69, 0.5], [69, 0.5], [73, 0.5], [73, 1], [71, 2]] },
      { text: 'パパと ママと', kana: 'パパと ママと', romaji: 'pa-pa-to ma-ma-to', en: 'Dad, and Mum, and…', chords: 'Dmaj7 Dmaj7 F#m7 F#m7', melody: [[69, 1], [66, 0.5], [66, 0.5], [73, 1.5], [69, 0.5], [69, 2]] },
      { text: 'うちの ねこ', kana: 'うちの ねこ', romaji: 'u-chi-no ne-ko', en: '…our cat.', chords: 'Bm7 Amaj7 Amaj7 Amaj7', melody: [[66, 1], [71, 1], [73, 1], [73, 1], [69, 3]] },
    ],
  },
  {
    // Sparkle Idol, version B, over the other Mureka take, D major: a royal-road loop (verse Gmaj7 F♯m7 |
    // F♯m7 Bm7 | Em7 F♯m7 | F♯m7 Dmaj7), the chorus on its slow 8-bar version, opening on IV. A duet: the lines alternate
    // between a sleepy idol who wants to go home and her manager; the encore lasts ten more years.
    // The chorus hook is がんばれ わたし. Each game plays one of the two versions.
    id: 'kirakira-idol-b',
    group: 'kirakira-idol',
    title: { text: 'キラキラ アイドル', kana: 'キラキラ アイドル', en: 'Sparkle Idol' },
    bpm: 129,
    style: 'idol',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'sparkle-idol-2', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'ねむい ねむい', kana: 'ねむい ねむい', romaji: 'ne-mu-i ne-mu-i', en: '(Idol) So sleepy, so sleepy', chords: 'Gmaj7 F#m7 F#m7 Bm7', melody: [[67, 0.5], [71, 0.5], [71, 1], [66, 0.5], [69, 0.5], [69, 2.5]] },
      { text: '起きて ください', kana: 'おきて ください', romaji: 'o-ki-te ku-da-sa-i', en: '(Manager) Please wake up', chords: 'Em7 F#m7 F#m7 Dmaj7', melody: [[71, 1], [67, 0.5], [67, 0.5], [64, 0.5], [69, 0.5], [69, 1], [66, 2]] },
      { text: 'おうちに 帰りたい', kana: 'おうちに かえりたい', romaji: 'o-u-chi-ni ka-e-ri-ta-i', en: '(Idol) I want to go home', chords: 'Gmaj7 F#m7 F#m7 E7', melody: [[67, 0.5], [71, 0.5], [71, 0.5], [71, 0.5], [66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [64, 2]] },
      { text: 'これから ライブ！', kana: 'これから ライブ', romaji: 'ko-re-ka-ra ra-i-bu', en: '(Manager) The show starts now!', chords: 'F#m7 Dmaj7 A7 F#m7', melody: [[66, 0.5], [69, 0.5], [69, 0.5], [69, 0.5], [74, 1], [69, 0.5], [69, 2.5]] },
      { text: 'がんばれ わたし', kana: 'がんばれ わたし', romaji: 'ga-n-ba-re wa-ta-shi', en: 'Hang in there, me', chords: 'Gmaj7 Gmaj7 Gmaj7 Gmaj7', melody: [[67, 0.5], [71, 0.5], [74, 1], [71, 1], [67, 1], [71, 1], [71, 2]] },
      { text: 'いつも 元気！', kana: 'いつも げんき', romaji: 'i-tsu-mo ge-n-ki', en: 'Always full of energy!', chords: 'F#m7 Dmaj7 Bm7 Bm7', melody: [[73, 1], [69, 0.5], [69, 0.5], [74, 1], [69, 1], [66, 2]] },
      { text: 'みんな 大好き', kana: 'みんな だいすき', romaji: 'mi-n-na da-i-su-ki', en: 'I love you all', chords: 'Em7 Em7 A7 F#m7', melody: [[71, 1], [76, 0.5], [76, 0.5], [76, 1], [73, 1], [73, 0.5], [69, 2]] },
      { text: 'がんばれ わたし', kana: 'がんばれ わたし', romaji: 'ga-n-ba-re wa-ta-shi', en: 'Hang in there, me', chords: 'Dmaj7 Dmaj7 Dmaj7 Bm7', melody: [[66, 0.5], [69, 0.5], [74, 1], [69, 1], [62, 1], [66, 1], [66, 2]] },
      { text: '終わった！ 帰ろう', kana: 'おわった かえろう', romaji: 'o-wa-t-ta ka-e-ro-u', en: '(Idol) It’s over! Let’s go home', chords: 'Gmaj7 A7 F#m7 Bm7', melody: [[67, 0.5], [71, 0.5], [71, 0.5], [71, 0.5], [64, 0.5], [69, 0.5], [69, 1], [66, 2]] },
      { text: 'アンコール！', kana: 'アンコール', romaji: 'a-n-ko-o-ru', en: '(Manager) Encore!', chords: 'Em7 F#m7 Bm7 Gmaj7', melody: [[64, 0.5], [71, 0.5], [71, 1], [69, 1], [66, 2.5]] },
      { text: 'あと 何回？', kana: 'あと なんかい', romaji: 'a-to na-n-ka-i', en: '(Idol) How many more?', chords: 'Gmaj7 F#m7 F#m7 E7', melody: [[71, 0.5], [67, 0.5], [69, 1], [66, 0.5], [66, 0.5], [69, 2]] },
      { text: 'あと 十年', kana: 'あと じゅうねん', romaji: 'a-to ju-u-ne-n', en: '(Manager) Ten more years.', chords: 'Em7 F#m7 A7 Bm7', melody: [[71, 1], [67, 1], [69, 1], [66, 1], [64, 1], [66, 2]] },
    ],
  },
  {
    // Sleepless Night, version A, over an AI-made slow-jam backing (Mureka; tracks.ts): one loop,
    // Cm7 | Cm7 C7 | Fm7 | G7, with the chorus cut to open on Fm7. Every word and kanji is N5, and the
    // title isn't sung (Ladi, 2026-10-27). She calls her crush, nobody picks up, and at
    // 4 a.m. they finally call back: “Sorry, who’s calling?”
    id: 'nemurenai-yoru',
    group: 'nemurenai-yoru',
    title: { text: 'ねられない よる', kana: 'ねられない よる', en: 'Sleepless Night' },
    bpm: 71,
    style: 'rnb',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'sleepless-caller', start: 0, segments: [[0, 39]] },
    lines: [
      { text: 'すきな 人に', kana: 'すきな ひとに', romaji: 'su-ki-na hi-to-ni', en: 'To the one I like', chords: 'Cm7 Cm7 Cm7 C7', melody: [[60, 0.5], [63, 0.5], [60, 1], [60, 0.5], [67, 1.5], [67, 1]] },
      { text: '電話を かけた', kana: 'でんわを かけた', romaji: 'de-n-wa-o ka-ke-ta', en: 'I made a call', chords: 'Fm7 Fm7 G7 G7', melody: [[60, 0.5], [63, 0.5], [63, 1], [63, 0.5], [68, 1], [65, 0.5], [62, 3]] },
      { text: 'でも 出なかった', kana: 'でも でなかった', romaji: 'de-mo de-na-ka-t-ta', en: 'But they didn’t pick up', chords: 'C7 Cm7 C7 Gb7', melody: [[70, 0.5], [67, 0.5], [70, 0.5], [67, 1], [63, 0.5], [63, 0.5], [60, 2]] },
      { text: 'まだ まってる', kana: 'まだ まってる', romaji: 'ma-da ma-t-te-ru', en: 'I’m still waiting', chords: 'Fm7 Fm7 G7 G7', melody: [[68, 1], [65, 0.5], [68, 1], [65, 0.5], [65, 1], [62, 3]] },
      { text: '電話 まってる', kana: 'でんわ まってる', romaji: 'de-n-wa ma-t-te-ru', en: 'Waiting for your call', chords: 'Fm7 Abmaj7 G7 Gm7', melody: [[68, 0.5], [72, 0.5], [72, 1], [72, 1], [68, 0.5], [68, 0.5], [67, 3]] },
      { text: '電話を 見てる', kana: 'でんわを みてる', romaji: 'de-n-wa-o mi-te-ru', en: 'Staring at the phone', chords: 'Cm7 Cm7 Cm7 Ebmaj7', melody: [[67, 0.5], [72, 1], [72, 1], [72, 0.5], [72, 0.5], [70, 1], [67, 2.5]] },
      { text: 'かけて かけて かけてよ', kana: 'かけて かけて かけてよ', romaji: 'ka-ke-te ka-ke-te ka-ke-te-yo', en: 'Call me, call me, call me back!', chords: 'Fm7 Fm7 G7 G7', melody: [[65, 0.5], [63, 0.5], [63, 0.5], [68, 0.5], [65, 0.5], [65, 0.5], [72, 0.5], [71, 0.5], [71, 0.5], [67, 2]] },
      { text: '電話 まってる', kana: 'でんわ まってる', romaji: 'de-n-wa ma-t-te-ru', en: 'Waiting for your call', chords: 'Cm7 Cm7 C7 Cm7', melody: [[67, 0.5], [70, 0.5], [70, 1], [70, 1], [67, 0.5], [67, 0.5], [60, 3]] },
      { text: 'もう あさの 四時', kana: 'もう あさの よじ', romaji: 'mo-u a-sa-no yo-ji', en: 'It’s four a.m. already', chords: 'Cm7 Cm7 Cm7 C7', melody: [[67, 0.5], [60, 0.5], [63, 1], [60, 0.5], [60, 0.5], [67, 1], [60, 1]] },
      { text: 'あっ、あの 人だ！', kana: 'あっ あの ひとだ', romaji: 'a-t a-no hi-to-da', en: 'Oh! It’s them!', chords: 'Fm7 Fm7 G7 G7', melody: [[72, 0.5], [72, 0.5], [65, 0.5], [68, 1], [68, 0.5], [72, 1], [71, 3]] },
      { text: 'はい、もしもし', kana: 'はい もしもし', romaji: 'ha-i mo-shi-mo-shi', en: 'Yes, hello?', chords: 'C7 Cm7 C7 Gb7', melody: [[70, 1], [67, 0.5], [70, 1], [67, 0.5], [67, 1], [67, 0.5]] },
      { text: '「どなた ですか？」', kana: 'どなた ですか', romaji: 'do-na-ta de-su-ka', en: '“Sorry, who’s calling?”', chords: 'Fm7 Fm7 G7 G7', melody: [[72, 1.5], [68, 0.5], [68, 1], [65, 0.5], [65, 0.5], [71, 3]] },
    ],
  },
  {
    // Sleepless Night, version B, over the other Mureka take (C major, neo-soul): verse Dm7 Em7 |
    // Fmaj7 Dm7 | Dm7 G7 | G7 Cmaj7; the chorus is the track's bridge, Fmaj7 Fm7 | C (IV–iv–I). All
    // N5. She can't sleep because she loves him… or because of the five coffees they drank.
    id: 'nemurenai-yoru-b',
    group: 'nemurenai-yoru',
    title: { text: 'ねられない よる', kana: 'ねられない よる', en: 'Sleepless Night' },
    bpm: 72,
    style: 'rnb',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'sleepless-coffee', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'よるの 一時', kana: 'よるの いちじ', romaji: 'yo-ru-no i-chi-ji', en: 'One in the morning', chords: 'Dm7 Em7 Fmaj7 Dm7', melody: [[65, 1], [62, 0.5], [62, 0.5], [64, 1], [67, 1], [65, 1]] },
      { text: 'あなたに 会いたい', kana: 'あなたに あいたい', romaji: 'a-na-ta-ni a-i-ta-i', en: 'I want to see you', chords: 'Dm7 G7 G7 Cmaj7', melody: [[62, 0.5], [65, 1], [62, 0.5], [62, 0.5], [62, 1], [67, 0.5], [67, 2], [64, 1]] },
      { text: 'ベッドの 中で', kana: 'ベッドの なかで', romaji: 'be-d-do-no na-ka-de', en: 'Lying in bed', chords: 'Dm7 Em7 G7 Cmaj7', melody: [[69, 0.5], [65, 0.5], [65, 0.5], [64, 0.5], [67, 1], [64, 1], [62, 1]] },
      { text: 'こんばんも また', kana: 'こんばんも また', romaji: 'ko-n-ba-n-mo ma-ta', en: 'Tonight, once again…', chords: 'Dm7 Em7 Fmaj7 Dm7', melody: [[69, 1], [65, 0.5], [65, 0.5], [64, 0.5], [64, 0.5], [64, 1], [65, 3]] },
      { text: 'あさまで おきてる', kana: 'あさまで おきてる', romaji: 'a-sa-ma-de o-ki-te-ru', en: 'Awake until morning', chords: 'Fmaj7 Fm7 C C', melody: [[72, 1], [69, 0.5], [69, 0.5], [65, 0.5], [72, 1], [65, 0.5], [67, 0.5], [64, 2.5]] },
      { text: 'あなたが すきで', kana: 'あなたが すきで', romaji: 'a-na-ta-ga su-ki-de', en: 'Because I love you', chords: 'C C C Dm7', melody: [[67, 0.5], [72, 1], [67, 0.5], [67, 0.5], [67, 0.5], [72, 0.5], [67, 2]] },
      { text: '一 二 三 四 五', kana: 'いち に さん し ご', romaji: 'i-chi ni sa-n shi go', en: 'One, two, three, four, five…', chords: 'Dm7 Fm7 Fm Fmaj7', melody: [[72, 0.5], [74, 0.5], [69, 1], [72, 0.5], [72, 0.5], [65, 1], [65, 3]] },
      { text: 'あさまで おきてる', kana: 'あさまで おきてる', romaji: 'a-sa-ma-de o-ki-te-ru', en: 'Awake until morning', chords: 'Em7 Fmaj7 G C', melody: [[71, 1], [67, 0.5], [67, 0.5], [65, 0.5], [72, 1], [69, 0.5], [67, 2], [60, 1.5]] },
      { text: 'よるの 三時', kana: 'よるの さんじ', romaji: 'yo-ru-no sa-n-ji', en: 'Three in the morning', chords: 'Dm7 Em7 Fmaj7 Dm7', melody: [[65, 1], [62, 0.5], [62, 0.5], [67, 1], [64, 1], [64, 1]] },
      { text: 'まだ おきてる', kana: 'まだ おきてる', romaji: 'ma-da o-ki-te-ru', en: 'I’m still awake', chords: 'Dm7 G7 G7 Cmaj7', melody: [[65, 1], [62, 0.5], [65, 1], [62, 0.5], [62, 1], [62, 3]] },
      { text: 'あなたと 飲んだ', kana: 'あなたと のんだ', romaji: 'a-na-ta-to no-n-da', en: 'What I drank with you:', chords: 'Dm7 Em7 G7 Cmaj7', melody: [[62, 0.5], [65, 0.5], [62, 0.5], [62, 0.5], [67, 1], [64, 1], [62, 2]] },
      { text: 'コーヒー 五はい', kana: 'コーヒー ごはい', romaji: 'ko-o-hi-i go-ha-i', en: 'five cups of coffee', chords: 'Dm7 Em7 Fmaj7 Dm7', melody: [[62, 0.5], [65, 0.5], [69, 0.5], [65, 0.5], [71, 2], [69, 2], [65, 1]] },
    ],
  },
  {
    // Save It!, version A, over an AI-made kawaii future-bass backing (Mureka; tracks.ts), 141 bpm in A:
    // verse D | C#m F#m | Bm | A C#m (twice, the second ending Bm C#m | A Bm, open), chorus the royal road
    // D C#m | F#m A three times, then Bm D | A. Mum calls the kid to dinner: "it's at a good part!" Verse 2 the
    // kid calls Mum, who answers with the kid's own line, so the last chorus is Mum's excuse. The title
    // is never sung (Ladi): the chorus hook is the gamer's excuse いま いい ところ.
    id: 'save-shite',
    group: 'save-shite',
    title: { text: 'セーブ して！', kana: 'セーブ して', en: 'Save It!' },
    bpm: 141,
    style: 'idol',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'save-dinner', start: 0, segments: [[0, 38]] },
    lines: [
      { text: 'ごはんよ！ はやく！', kana: 'ごはんよ はやく', romaji: 'go-ha-n-yo ha-ya-ku', en: 'Dinner! Hurry up!', chords: 'D D C#m F#m', melody: [[69, 1], [66, 0.5], [66, 0.5], [66, 1], [69, 1], [64, 1], [64, 1]] },
      { text: 'いま ボスの まえ', kana: 'いま ボスの まえ', romaji: 'i-ma bo-su-no ma-e', en: 'I’m at the boss right now', chords: 'Bm Bm A C#m', melody: [[66, 1], [62, 0.5], [66, 1], [62, 0.5], [62, 0.5], [66, 1], [64, 1.5]] },
      { text: 'みんな 待ってるよ', kana: 'みんな まってるよ', romaji: 'mi-n-na ma-t-te-ru-yo', en: 'Everyone’s waiting', chords: 'D D C#m F#m', melody: [[66, 0.5], [69, 0.5], [69, 1], [69, 1], [69, 0.5], [66, 0.5], [64, 0.5], [64, 1.5]] },
      { text: 'ちょっと 待って！', kana: 'ちょっと まって', romaji: 'cho-t-to ma-t-te', en: 'Wait a second!', chords: 'Bm C#m A Bm', melody: [[66, 1], [66, 0.5], [62, 0.5], [68, 1.5], [68, 0.5], [64, 2]] },
      { text: 'いま いい ところ？', kana: 'いま いい ところ', romaji: 'i-ma i-i to-ko-ro', en: 'It’s at a good part?', chords: 'D C#m F#m A', melody: [[74, 1], [69, 1], [73, 1], [68, 0.5], [66, 0.5], [69, 1], [69, 2]] },
      { text: 'あと ちょっと だけ', kana: 'あと ちょっと だけ', romaji: 'a-to cho-t-to da-ke', en: 'Just a little more', chords: 'D C#m F#m A', melody: [[74, 1], [69, 1], [73, 1], [68, 0.5], [68, 0.5], [66, 1], [66, 2]] },
      { text: 'ボスに 勝ったら？', kana: 'ボスに かったら', romaji: 'bo-su-ni ka-t-ta-ra', en: 'Once you beat the boss?', chords: 'D C#m F#m A', melody: [[69, 0.5], [66, 0.5], [66, 1], [73, 1.5], [73, 0.5], [69, 1], [69, 2]] },
      { text: 'いま いい ところ！', kana: 'いま いい ところ', romaji: 'i-ma i-i to-ko-ro', en: 'It’s at a good part!', chords: 'Bm D A A', melody: [[74, 1], [71, 1], [74, 1], [66, 0.5], [66, 0.5], [69, 1], [69, 2]] },
      { text: 'お母さん ごはん！', kana: 'おかあさん ごはん', romaji: 'o-ka-a-sa-n go-ha-n', en: 'Mum, dinner!', chords: 'D D C#m F#m', melody: [[62, 0.5], [69, 0.5], [66, 1], [66, 0.5], [66, 0.5], [69, 1], [64, 1], [64, 1]] },
      { text: 'はいはい 待って', kana: 'はいはい まって', romaji: 'ha-i-ha-i ma-t-te', en: 'Yeah, yeah, wait', chords: 'Bm Bm A C#m', melody: [[66, 1], [62, 0.5], [66, 1], [62, 0.5], [66, 1], [66, 0.5], [64, 1.5]] },
      { text: 'なに してるの？', kana: 'なに してるの', romaji: 'na-ni shi-te-ru-no', en: 'What are you doing?', chords: 'D D C#m F#m', melody: [[69, 1], [66, 0.5], [66, 0.5], [69, 1], [69, 1], [73, 1]] },
      { text: 'いま ボスの まえ！', kana: 'いま ボスの まえ', romaji: 'i-ma bo-su-no ma-e', en: 'I’m at the boss right now!', chords: 'Bm C#m A Bm', melody: [[66, 1], [62, 0.5], [66, 1], [62, 0.5], [61, 0.5], [64, 1], [61, 2.5]] },
    ],
  },
  {
    // Save It!, version B, over the other Mureka take, 140 bpm in E: one loop throughout, A G#m | C#m B |
    // F#m G#m | C#m B (IV iii | vi V | ii iii | vi V), so verse and chorus share chords. Two friends beat
    // the last boss after 100 hours ("hurry, hurry! press the button!"); verse 2 the screen goes black because
    // the cat was playing with the button: save data zero. The title is never sung; the hook is はやく はやく.
    id: 'save-shite-b',
    group: 'save-shite',
    title: { text: 'セーブ して！', kana: 'セーブ して', en: 'Save It!' },
    bpm: 140,
    style: 'idol',
    level: 'kana',
    status: 'draft',
    form: standardForm(16, 8),
    track: { id: 'save-cat', start: 0, segments: [[0, 37]] },
    lines: [
      { text: '夜の 三時', kana: 'よるの さんじ', romaji: 'yo-ru-no sa-n-ji', en: 'Three in the morning', chords: 'A G#m C#m B', melody: [[69, 1], [64, 0.5], [64, 0.5], [71, 1], [68, 1], [68, 2]] },
      { text: 'ボスの ステージ', kana: 'ボスの ステージ', romaji: 'bo-su-no su-te-e-ji', en: 'The boss’s stage', chords: 'F#m G#m C#m B', melody: [[69, 1], [66, 0.5], [66, 0.5], [63, 0.5], [68, 1.5], [64, 2], [63, 1]] },
      { text: '二人で 勝った', kana: 'ふたりで かった', romaji: 'fu-ta-ri-de ka-t-ta', en: 'We won it together', chords: 'A G#m C#m B', melody: [[64, 0.5], [69, 1], [69, 0.5], [68, 1], [71, 1], [71, 0.5], [68, 1.5]] },
      { text: 'あとは セーブ だけ', kana: 'あとは セーブ だけ', romaji: 'a-to-wa se-e-bu da-ke', en: 'All that’s left is to save', chords: 'F#m G#m C#m B', melody: [[69, 1], [66, 0.5], [66, 0.5], [71, 1], [68, 1], [68, 0.5], [64, 1.5], [66, 1]] },
      { text: 'はやく はやく！', kana: 'はやく はやく', romaji: 'ha-ya-ku ha-ya-ku', en: 'Hurry, hurry!', chords: 'A G#m C#m B', melody: [[73, 1], [69, 0.5], [69, 0.5], [71, 1.5], [68, 0.5], [68, 1]] },
      { text: 'ボタン おして', kana: 'ボタン おして', romaji: 'bo-ta-n o-shi-te', en: 'Press the button', chords: 'F#m G#m C#m B', melody: [[69, 1], [71, 1], [71, 1], [68, 1], [68, 0.5], [68, 1.5]] },
      { text: '百時間の ゲーム', kana: 'ひゃくじかんの ゲーム', romaji: 'hya-ku-ji-ka-n-no ge-e-mu', en: 'A hundred hours of game', chords: 'A G#m C#m B', melody: [[69, 0.5], [73, 1], [73, 0.5], [71, 1], [68, 0.5], [68, 0.5], [73, 1], [68, 1], [66, 1]] },
      { text: 'はやく はやく！', kana: 'はやく はやく', romaji: 'ha-ya-ku ha-ya-ku', en: 'Hurry, hurry!', chords: 'F#m G#m C#m E', melody: [[73, 1], [69, 0.5], [69, 0.5], [71, 1.5], [68, 0.5], [64, 1]] },
      { text: 'あっ！ まっくろ', kana: 'あっ まっくろ', romaji: 'a-t ma-k-ku-ro', en: 'Oh! It’s all black', chords: 'A G#m C#m B', melody: [[69, 1], [69, 0.5], [68, 0.5], [71, 0.5], [71, 1.5], [68, 2]] },
      { text: 'ねこが にこにこ', kana: 'ねこが にこにこ', romaji: 'ne-ko-ga ni-ko-ni-ko', en: 'The cat is all smiles', chords: 'F#m G#m C#m B', melody: [[69, 1], [66, 0.5], [66, 0.5], [68, 1], [63, 1], [64, 0.5], [64, 1.5]] },
      { text: 'ボタンで あそぶ', kana: 'ボタンで あそぶ', romaji: 'bo-ta-n-de a-so-bu', en: 'Playing with the button', chords: 'A G#m C#m B', melody: [[64, 0.5], [69, 1], [69, 0.5], [68, 1], [63, 0.5], [68, 0.5], [68, 1]] },
      { text: 'データ ゼロ！', kana: 'データ ゼロ', romaji: 'de-e-ta ze-ro', en: 'Save data: zero!', chords: 'F#m G#m C#m B', melody: [[73, 2], [71, 1], [71, 1], [68, 0.5], [64, 1.5]] },
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
