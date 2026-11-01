// What Shodō Taikai asks each player to write, by level: kana for Kana-level players, the N5
// kanji for N5, N4 kanji with one N5 kanji as review (and words with N4 kanji in dictation) for N4,
// and the same one level up for N3 with the 30 sign kanji (goal 3.12). Built from the content
// library, so tests can pass small fixtures. Every target carries its KanjiVG
// stroke references (one list per character) and the word players say for it.

import type { KanjiLevel } from '../../../../content/src/kanji/kanji.js';
import { atLevel, type ByLevel, type JpText, type Level } from '../../../../content/src/types.js';
import type { InkStroke } from '../../japanese/strokes.js';
import type { ContentLibrary } from '../mode.js';
import { shuffled } from '../mode.js';
import { LEVEL_RANK } from '../../level.js';

export type TargetKind = 'kana' | 'kanji' | 'word';


export interface Target {
  /** Content id (`h-ka`, `kj-山`, `kw-学生`), for the phrasebook and "already dealt". */
  id: string;
  kind: TargetKind;
  /** What is written: one character, or a two-kanji word. */
  text: string;
  /** Stroke references, one list per character. */
  cells: (readonly InkStroke[])[];
  /** What players say for it (a kana says its sound). */
  say: JpText;
  /** A short English meaning (romaji for a kana). */
  meaning: string;
  /** Dictation for kana: the twin from the other script shown as the clue (ヌ for ぬ). */
  mask?: string;
  /** Strokes in all, for the points scale. */
  strokes: number;
  /** A kanji's step in the writing order (content/src/kanji/kanji.ts). */
  step?: number;
  /** A kanji's level band; a word's is its highest kanji's. */
  level?: KanjiLevel;
  /** The gallery only: the word on its own, without the brief ("やま" in "ねむい やまです"). */
  word?: JpText;
}

/**
 * Look-alike kanji for Fude's misreading (comedy panel): when a drawing grades as one of its set
 * instead, Fude reads it as that one. Only characters with stroke data are used.
 */
export const KANJI_LOOKALIKES: readonly string[][] = [
  ['大', '犬', '天', '太'],
  ['日', '目', '白', '田', '百', '口'],
  ['木', '本', '休', '水'],
  ['人', '八', '入'],
  ['土', '上', '工', '士'],
  ['右', '左', '石'],
  ['九', '力'],
  ['千', '干', '十'],
  ['子', '字'],
  ['母', '毎'],
  ['見', '貝'],
  ['王', '玉', '主'],
  ['夕', '名'],
  ['牛', '午'],
];

/**
 * How Fude names a look-alike kanji aloud when he misreads a sheet as it ("フデには 犬に みえます"):
 * the voice reads only kana, and the kanji alone has no say word of its own to borrow. Draft:
 * the common name for the character on its own, until a fluent speaker checks it.
 */
export const LOOKALIKE_KANA: Readonly<Record<string, string>> = {
  大: 'だい', 犬: 'いぬ', 天: 'てん', 太: 'ふと',
  日: 'ひ', 目: 'め', 白: 'しろ', 田: 'た', 百: 'ひゃく', 口: 'くち',
  木: 'き', 本: 'ほん', 休: 'きゅう', 水: 'みず',
  人: 'ひと', 八: 'はち', 入: 'にゅう',
  土: 'つち', 上: 'うえ', 工: 'こう', 士: 'し',
  右: 'みぎ', 左: 'ひだり', 石: 'いし',
  九: 'きゅう', 力: 'ちから',
  千: 'せん', 干: 'かん', 十: 'じゅう',
  子: 'こ', 字: 'じ',
  母: 'はは', 毎: 'まい',
  見: 'けん', 貝: 'かい',
  王: 'おう', 玉: 'たま', 主: 'しゅ',
  夕: 'ゆう', 名: 'な',
  牛: 'うし', 午: 'ご',
};

/** The gallery's shared theme, "something I love", one glyph per level (the Japanese panel's picks). */
export const GALLERY: ByLevel<JpText[]> = {
  kana: [
    { text: 'ねこ', kana: 'ねこ', en: 'a cat' },
    { text: 'はな', kana: 'はな', en: 'a flower' },
    { text: 'そら', kana: 'そら', en: 'the sky' },
    { text: 'うみ', kana: 'うみ', en: 'the sea' },
    { text: 'やま', kana: 'やま', en: 'a mountain' },
  ],
  n5: [
    { text: '山', kana: 'やま', en: 'a mountain' },
    { text: '川', kana: 'かわ', en: 'a river' },
    { text: '木', kana: 'き', en: 'a tree' },
    { text: '雨', kana: 'あめ', en: 'rain' },
    { text: '車', kana: 'くるま', en: 'a car' },
    { text: '本', kana: 'ほん', en: 'a book' },
  ],
  n4: [
    { text: '春', kana: 'はる', en: 'spring' },
    { text: '冬', kana: 'ふゆ', en: 'winter' },
    { text: '秋', kana: 'あき', en: 'autumn' },
    { text: '花', kana: 'はな', en: 'a flower' },
    { text: '犬', kana: 'いぬ', en: 'a dog' },
    { text: '海', kana: 'うみ', en: 'the sea' },
  ],
  // Sign kanji that are words on their own (a sleepy window).
  n3: [
    { text: '窓', kana: 'まど', en: 'a window' },
    { text: '煙', kana: 'けむり', en: 'a puff of smoke' },
    { text: '席', kana: 'せき', en: 'a seat' },
    { text: '指', kana: 'ゆび', en: 'a finger' },
  ],
};

/**
 * The gallery's brief (humor review): one silly adjective for the whole room, so every sheet is
 * "a sleepy ___" and the gallery is a set of sleepy mountains and sleepy cats. Words that sit naturally
 * before a noun (feelings in the た form: おこった, not うれしい), kept in kana so every level reads them.
 */
export const BRIEFS: readonly JpText[] = [
  { text: 'ねむい', kana: 'ねむい', en: 'sleepy' },
  { text: 'おこった', kana: 'おこった', en: 'angry' },
  { text: 'つかれた', kana: 'つかれた', en: 'tired' },
  { text: 'こわい', kana: 'こわい', en: 'scary' },
  { text: 'げんきな', kana: 'げんきな', en: 'lively' },
  { text: 'おなかが すいた', kana: 'おなかが すいた', en: 'hungry' },
];

/** The gallery sentence: "It's a sleepy ___" (ねむい ＿です), said aloud after writing. */
export function gallerySentence(brief: JpText, word: JpText): JpText {
  const noun = word.en.replace(/^(a|an|the) /, '');
  const a = /^[aeiou]/.test(brief.en) ? 'an' : 'a';
  return { text: `${brief.text} ${word.text}です`, kana: `${brief.kana} ${word.kana}です`, en: `It's ${a} ${brief.en} ${noun}.` };
}

export interface ShodoDeck {
  kana: Target[];
  /** Kanji in writing order. */
  kanji: Target[];
  words: Target[];
  /** Any character's strokes, for look-alikes and multi-character targets. */
  strokesOf(char: string): readonly InkStroke[] | null;
  /** The look-alikes of a single-character target that have stroke data. */
  lookAlikes(t: Target): string[];
}

export function buildDeck(content: ContentLibrary): ShodoDeck {
  const strokes = new Map<string, readonly InkStroke[]>();
  for (const k of content.kanaStrokes) if (k.strokes.length) strokes.set(k.char, k.strokes);
  for (const k of content.kanjiStrokes) if (k.strokes.length) strokes.set(k.char, k.strokes);
  const count = (cells: (readonly InkStroke[])[]) => cells.reduce((n, c) => n + c.length, 0);
  const byId = new Map(content.kana.map((k) => [k.id, k]));
  const kana: Target[] = content.kana
    .filter((k) => k.kind === 'basic' && strokes.has(k.char))
    .map((k) => {
      const cells = [strokes.get(k.char)!];
      const twin = k.twinId ? byId.get(k.twinId)?.char : undefined;
      return { id: k.id, kind: 'kana' as const, text: k.char, cells, say: { text: k.char, kana: k.sound, en: k.romaji }, meaning: k.romaji, ...(twin ? { mask: twin } : {}), strokes: count(cells) };
    });
  const kanji: Target[] = content.writeKanji
    .filter((k) => strokes.has(k.char))
    .map((k) => {
      const cells = [strokes.get(k.char)!];
      return { id: k.id, kind: 'kanji' as const, text: k.char, cells, say: k.say, meaning: k.meaning, strokes: count(cells), step: k.step, level: k.level };
    });
  const bandOf = new Map(content.writeKanji.map((k) => [k.char, k.level]));
  const words: Target[] = content.writeWords
    .filter((w) => [...w.word.text].every((c) => strokes.has(c)))
    .map((w) => {
      const cells = [...w.word.text].map((c) => strokes.get(c)!);
      const bands = [...w.word.text].map((c) => bandOf.get(c)).filter((b): b is KanjiLevel => !!b);
      const level = bands.sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a])[0];
      return { id: w.id, kind: 'word' as const, text: w.word.text, cells, say: w.word, meaning: w.word.en, strokes: count(cells), ...(level ? { level } : {}) };
    });
  const kanaSets = content.lookAlikeSets.map((s) => s.kanaIds.map((id) => byId.get(id)?.char).filter((c): c is string => !!c));
  return {
    kana,
    kanji,
    words,
    strokesOf: (c) => strokes.get(c) ?? null,
    lookAlikes(t) {
      if (t.cells.length !== 1) return [];
      const sets = t.kind === 'kana' ? kanaSets : KANJI_LOOKALIKES;
      const out = new Set<string>();
      for (const set of sets) if (set.includes(t.text)) for (const c of set) if (c !== t.text && strokes.has(c)) out.add(c);
      return [...out];
    },
  };
}

const step = (t: Target) => t.step ?? 0;

/** Hiragana first: katakana join once the hiragana pool is mostly dealt. */
function kanaPool(deck: ShodoDeck, wide: boolean): Target[] {
  const hira = deck.kana.filter((t) => /[ぁ-ゖ]/.test(t.text));
  return wide ? deck.kana : hira.length ? hira : deck.kana;
}

/** The kanji band a level learns, and the band below it that comes back as review. */
const BANDS: Partial<Record<Level, { learn: KanjiLevel; review: KanjiLevel }>> = { n4: { learn: 'n4', review: 'n5' }, n3: { learn: 'n3', review: 'n4' } };

/**
 * Practice (お手本) targets: short ones, to trace, fade and write from memory. N5 players get steps 1–5.
 * N4 and N3 players get their own band (the PR #146 panel found Shodō dealt an N4 player about 0.4 N4
 * kanji a game); `reviewPool` has the band below.
 */
export function practicePool(deck: ShodoDeck, level: Level): Target[] {
  if (level === 'kana') return kanaPool(deck, false);
  const band = BANDS[level];
  const pool = band ? deck.kanji.filter((t) => t.level === band.learn) : deck.kanji.filter((t) => step(t) >= 1 && step(t) <= 5);
  return pool.length ? pool : deck.kanji.length ? deck.kanji : deck.kana;
}

/** Review targets for N4 and N3 practice: the band below (N5 steps 3–7 for N4, the N4 kanji for N3). */
export function reviewPool(deck: ShodoDeck, level: Level): Target[] {
  const band = BANDS[level];
  if (!band) return [];
  return deck.kanji.filter((t) => t.level === band.review && (band.review !== 'n5' || step(t) >= 3));
}

/** Practice targets, how many of them come from the band below (about a third: the Japanese seat). */
export const PRACTICE = { targets: 3, review: 1 };

/** Deals a player's practice targets: N4 and N3 get two of their own band and one review. */
export function dealPractice(deck: ShodoDeck, level: Level, used: ReadonlySet<string>, random: () => number): Target[] {
  const review = reviewPool(deck, level);
  const own = oneEachWord(deal(practicePool(deck, level), Infinity, used, random)).slice(0, review.length ? PRACTICE.targets - PRACTICE.review : PRACTICE.targets);
  const taken = new Set(own.map((t) => t.say.text));
  const more = review.length ? oneEachWord(deal(review, Infinity, used, random).filter((t) => !taken.has(t.say.text))).slice(0, PRACTICE.targets - own.length) : [];
  return [...own, ...more];
}

/** Keeps the first target of each say-word: 改 and 札 both say 改札, so one game deals only one of them. */
function oneEachWord(ts: Target[]): Target[] {
  const seen = new Set<string>();
  return ts.filter((t) => (seen.has(t.say.text) ? false : (seen.add(t.say.text), true)));
}

/**
 * Dictation (書き取り) targets: anything at the level. With `words`, N4 gets words with an N4 kanji in
 * them and N3 the sign words (改札, 非常口).
 */
export function dictationPool(deck: ShodoDeck, level: Level, words: boolean): Target[] {
  if (level === 'kana') return kanaPool(deck, true);
  const band = BANDS[level];
  if (band && words && deck.words.length) {
    const mine = deck.words.filter((w) => w.level === band.learn);
    return mine.length ? mine : deck.words;
  }
  const pool = band ? deck.kanji.filter((t) => t.level === band.learn || t.level === band.review) : deck.kanji.filter((t) => step(t) <= 7);
  return pool.length ? pool : deck.kanji.length ? deck.kanji : deck.kana;
}

/**
 * The last "say it, then write it" item at N4 and N3: a word with a practised kanji in it, so the kanji
 * comes back read inside a word (the JLPT seat: closest to what 漢字読み tests). Null when none has it.
 */
export function wordWith(deck: ShodoDeck, level: Level, t: Target, used: ReadonlySet<string>, random: () => number): Target | null {
  const band = BANDS[level];
  if (!band || t.kind !== 'kanji') return null;
  // Only words at or below the player's band: an N4 player never meets 割 through 割引 (UX seat, PR #147).
  const fits = (w: Target) => !w.level || LEVEL_RANK[w.level] <= LEVEL_RANK[band.learn];
  return deal(deck.words.filter((w) => w.text.includes(t.text) && fits(w)), 1, used, random)[0] ?? null;
}

/** Deals `n` targets from a pool, avoiding ones already dealt this game when it can. */
export function deal(pool: readonly Target[], n: number, used: ReadonlySet<string>, random: () => number): Target[] {
  const fresh = shuffled(pool.filter((t) => !used.has(t.id)), random);
  const stale = shuffled(pool.filter((t) => used.has(t.id)), random);
  return [...fresh, ...stale].slice(0, n);
}

/** The gallery target for a level and the room's brief: the theme glyph with strokes, or null without data. */
export function galleryTarget(deck: ShodoDeck, level: Level, brief: JpText, random: () => number): Target | null {
  const options = shuffled(atLevel(GALLERY, level), random);
  for (const word of options) {
    const cells = [...word.text].map((c) => deck.strokesOf(c));
    if (cells.every((c): c is readonly InkStroke[] => !!c)) {
      return { id: `gal-${word.text}`, kind: cells.length > 1 ? (level === 'kana' ? 'kana' : 'word') : level === 'kana' ? 'kana' : 'kanji', text: word.text, cells, say: gallerySentence(brief, word), meaning: word.en, strokes: cells.reduce((n, c) => n + c.length, 0), word };
    }
  }
  return null;
}
