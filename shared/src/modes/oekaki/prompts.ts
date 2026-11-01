// What players draw (the real titles) and the word tiles for writing fakes, built from the
// night's topic pack. Kana-level players draw one pack word (often one of the pack's funny
// "swerve" phrases, such as ねこの シェフ); N5 and N4 players sometimes get an adjective + noun
// pair (からい ケーキ, "spicy cake"). If there are no packs at all, a small built-in list keeps
// the game running (non-AI fallback, like every mode's).

import type { Level, PackWord, TopicPack } from '../../../../content/src/types.js';
import { normalizeReading } from '../../japanese/kana.js';
import type { ContentLibrary } from '../mode.js';

export interface Prompt {
  /** Phrasebook item id: the pack word's id, or `oekaki.<adj>+<noun>` for a pair. */
  id: string;
  text: string;
  kana: string;
  en: string;
  /** Readings of the words in it, so tiles never hand out a piece of the answer. */
  parts: string[];
}

export interface Tile {
  text: string;
  kana: string;
  en: string;
  /** The の particle joins the tiles either side ("X's Y"). */
  particle?: boolean;
}

/**
 * Drawable い-adjectives for N5+ pairs, with an English word that reads well before a noun.
 * Colours and feelings draw well. Draft: needs the fluent check like every pack.
 */
export const ADJECTIVES: readonly { id: string; text: string; kana: string; en: string }[] = [
  { id: 'ookii', text: '大きい', kana: 'おおきい', en: 'giant' },
  { id: 'chiisai', text: '小さい', kana: 'ちいさい', en: 'tiny' },
  { id: 'kowai', text: 'こわい', kana: 'こわい', en: 'scary' },
  { id: 'kawaii', text: 'かわいい', kana: 'かわいい', en: 'cute' },
  { id: 'karai', text: 'からい', kana: 'からい', en: 'spicy' },
  { id: 'atsui', text: 'あつい', kana: 'あつい', en: 'red-hot' },
  { id: 'tsumetai', text: 'つめたい', kana: 'つめたい', en: 'ice-cold' },
  { id: 'nemui', text: 'ねむい', kana: 'ねむい', en: 'sleepy' },
  { id: 'urusai', text: 'うるさい', kana: 'うるさい', en: 'noisy' },
  { id: 'akai', text: '赤い', kana: 'あかい', en: 'red' },
  { id: 'aoi', text: '青い', kana: 'あおい', en: 'blue' },
  { id: 'shiroi', text: '白い', kana: 'しろい', en: 'white' },
  { id: 'kuroi', text: '黒い', kana: 'くろい', en: 'black' },
  { id: 'furui', text: '古い', kana: 'ふるい', en: 'ancient' },
];

/** Used only when there are no topic packs at all. */
export const FALLBACK_WORDS: readonly PackWord[] = [
  { id: 'oekaki.fallback.neko', jp: { text: 'ねこ', kana: 'ねこ', en: 'cat' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.inu', jp: { text: 'いぬ', kana: 'いぬ', en: 'dog' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.sushi', jp: { text: 'すし', kana: 'すし', en: 'sushi' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.ramen', jp: { text: 'ラーメン', kana: 'ラーメン', en: 'ramen' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.robot', jp: { text: 'ロボット', kana: 'ロボット', en: 'robot' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.obake', jp: { text: 'おばけ', kana: 'おばけ', en: 'ghost' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.tako', jp: { text: 'たこ', kana: 'たこ', en: 'octopus' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.kasa', jp: { text: 'かさ', kana: 'かさ', en: 'umbrella' }, pos: 'noun', level: 'kana' },
  { id: 'oekaki.fallback.densha', jp: { text: '電車', kana: 'でんしゃ', en: 'train' }, pos: 'noun', level: 'n5' },
  { id: 'oekaki.fallback.yama', jp: { text: '山', kana: 'やま', en: 'mountain' }, pos: 'noun', level: 'n5' },
  { id: 'oekaki.fallback.neko-chef', jp: { text: 'ねこの シェフ', kana: 'ねこの シェフ', en: 'a cat chef' }, pos: 'noun', level: 'kana', swerve: true },
  { id: 'oekaki.fallback.ufo', jp: { text: 'ユーフォー', kana: 'ユーフォー', en: 'a UFO' }, pos: 'noun', level: 'kana' },
];

/** Tags for nouns that don't draw: directions, times, and family words that need context. */
const NOT_DRAWABLE = new Set(['directions', 'position', 'time', 'own-family', 'others-family']);

const RANK: Record<Level, number> = { kana: 0, n5: 1, n4: 2, n3: 3 };

/** A pack word's English as a short title: first sense, no notes in brackets. */
export function shortEn(en: string): string {
  return en.split(';')[0]!.replace(/\s*\([^)]*\)/g, '').trim();
}

const plainEn = (en: string) => shortEn(en).replace(/^(a|an|the)\s+/i, '');

const isDrawable = (w: PackWord, baseline: ReadonlySet<string>): boolean =>
  w.pos === 'noun' && !w.stereotype && !baseline.has(w.id) && !(w.tags ?? []).some((t) => NOT_DRAWABLE.has(t));

/** A single word (no spaces), which can be paired with an adjective. */
const isPlain = (w: PackWord) => !w.swerve && !/\s/.test(w.jp.text) && !/の/.test(w.jp.kana.slice(1, -1));

interface Pool {
  words: PackWord[];
  /** Plain nouns for adjective pairs and tiles. */
  plain: PackWord[];
}

const pools = new WeakMap<ContentLibrary, Map<string, Pool>>();

/** Drawable nouns of a pack (or every pack's, or the fallback list), deduplicated by reading. */
export function poolFor(content: ContentLibrary, packId: string | null): Pool {
  let byPack = pools.get(content);
  if (!byPack) pools.set(content, (byPack = new Map()));
  const key = packId ?? '';
  const cached = byPack.get(key);
  if (cached) return cached;
  const packs: readonly TopicPack[] = content.packs.filter((p) => p.id === packId);
  const source = packs.length ? packs : content.packs;
  const seen = new Set<string>();
  const words: PackWord[] = [];
  for (const pack of source) {
    const baseline = new Set(pack.baselineWordIds);
    for (const w of pack.words) {
      const k = normalizeReading(w.jp.kana);
      if (!k || seen.has(k) || !isDrawable(w, baseline)) continue;
      seen.add(k);
      words.push(w);
    }
  }
  const all = words.length >= 4 ? words : [...words, ...FALLBACK_WORDS.filter((w) => !seen.has(normalizeReading(w.jp.kana)))];
  const pool = { words: all, plain: all.filter(isPlain) };
  byPack.set(key, pool);
  return pool;
}

const fromWord = (w: PackWord): Prompt => ({ id: w.id, text: w.jp.text, kana: w.jp.kana, en: shortEn(w.jp.en), parts: [normalizeReading(w.jp.kana)] });

/** Share of N5/N4 prompts that are an adjective + noun pair. */
export const PAIR_SHARE = 0.5;

/**
 * Deals one prompt at `level`, avoiding ids in `used` (and readings already dealt) where it can.
 * Kana level: a kana-level pack word. N5 and N4: any kana or N5 word, or half the time a pair.
 */
export function dealPrompt(content: ContentLibrary, packId: string | null, level: Level, used: ReadonlySet<string>, random: () => number): Prompt {
  const pool = poolFor(content, packId);
  // N4 content comes after v1: N4 players draw N5 words (design doc, Level bands).
  const fits = (w: PackWord) => RANK[w.level] <= Math.min(RANK[level], RANK.n5);
  const fresh = (p: Prompt) => !used.has(p.id) && !p.parts.some((r) => used.has(`r:${r}`));
  const words = pool.words.filter(fits).map(fromWord).filter(fresh);
  if (level !== 'kana' && random() < PAIR_SHARE) {
    const nouns = pool.plain.filter(fits).map(fromWord).filter(fresh);
    const noun = nouns[Math.floor(random() * nouns.length)];
    const adj = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)]!;
    const id = noun && `oekaki.${adj.id}+${noun.id}`;
    if (noun && id && !used.has(id)) {
      return { id, text: `${adj.text} ${noun.text}`, kana: `${adj.kana} ${noun.kana}`, en: `${adj.en} ${plainEn(noun.en)}`, parts: [normalizeReading(adj.kana), ...noun.parts] };
    }
  }
  // A pack with no kana-level words (family) gives Kana players N5 words, read in kana.
  const easy = words.length ? words : pool.words.filter((w) => w.level !== 'n4').map(fromWord).filter(fresh);
  const pick = easy[Math.floor(random() * easy.length)];
  if (pick) return pick;
  // Everything has been drawn: allow repeats rather than stop the game.
  const again = pool.words[Math.floor(random() * pool.words.length)] ?? FALLBACK_WORDS[0]!;
  return fromWord(again);
}

/** Marks a prompt as dealt, so the rest of the game avoids it and its words. */
export function markUsed(used: Set<string>, p: Prompt): void {
  used.add(p.id);
  for (const r of p.parts) used.add(`r:${r}`);
}

export const TILE_NOUNS = 4;
export const TILE_ADJECTIVES = 2;
export const NO_TILE: Tile = { text: 'の', kana: 'の', en: "'s", particle: true };

/** Does a word share a reading with the real title (either inside the other)? */
const overlaps = (reading: string, parts: readonly string[], real: string) =>
  !reading || real.includes(reading) || parts.some((p) => p.includes(reading) || reading.includes(p));

/**
 * A hand of word tiles for writing a fake title: nouns, adjectives and の, none of which is a
 * piece of the real title (tiles must never give the answer away).
 */
export function dealTiles(content: ContentLibrary, packId: string | null, real: Prompt, random: () => number): Tile[] {
  const pool = poolFor(content, packId);
  const realKey = normalizeReading(real.kana);
  const nouns = pool.plain.filter((w) => w.level !== 'n4' && !overlaps(normalizeReading(w.jp.kana), real.parts, realKey));
  const adjs = ADJECTIVES.filter((a) => !overlaps(normalizeReading(a.kana), real.parts, realKey));
  const take = <T>(items: readonly T[], n: number): T[] => {
    const left = [...items];
    const out: T[] = [];
    while (out.length < n && left.length) out.push(left.splice(Math.floor(random() * left.length), 1)[0]!);
    return out;
  };
  return [
    ...take(nouns, TILE_NOUNS).map((w) => ({ text: w.jp.text, kana: w.jp.kana, en: plainEn(w.jp.en) })),
    ...take(adjs, TILE_ADJECTIVES).map((a) => ({ text: a.text, kana: a.kana, en: a.en })),
    NO_TILE,
  ];
}

/** House decoys when too few fakes come in: other drawable words from the pack. */
export function decoyCandidates(content: ContentLibrary, packId: string | null, random: () => number): Prompt[] {
  const words = poolFor(content, packId).words.filter((w) => w.level !== 'n4').map(fromWord);
  const out: Prompt[] = [];
  while (words.length) out.push(words.splice(Math.floor(random() * words.length), 1)[0]!);
  return out;
}
