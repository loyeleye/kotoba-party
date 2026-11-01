// Building the board: picking words from the night's pack, turning each into a pair of two
// forms (kana ↔ meaning, kanji ↔ reading, picture ↔ word, audio ↔ word), and laying the
// cards out with the special tiles. Pure: randomness comes in.

import type { JpText, Level, PackWord, TopicPack } from '../../../../content/src/types.js';
import { n4Up } from '../../level.js';
import { hasKanji, normalizeReading } from '../../japanese/kana.js';
import { shuffled } from '../mode.js';
import { emojiFor } from './emoji.js';
import { FALLBACK_WORDS } from './fallback.js';

export type PairKind = 'meaning' | 'reading' | 'picture' | 'audio';
export type SpecialKind = 'yokai' | 'bonus' | 'fog';

/** What one side of a card shows. */
export interface Face {
  /**
   * kana: the word in kana · en: its English meaning · kanji: the written word, no furigana ·
   * emoji: a picture · audio: a speaker that plays `say` · word: the written word with its
   * reading under it · special: a special tile.
   */
  kind: 'kana' | 'en' | 'kanji' | 'emoji' | 'audio' | 'word' | 'special';
  text: string;
  /** The reading shown under the text (word cards with kanji). */
  sub?: string;
  /** What text-to-speech says when the card turns over (audio cards). */
  say?: string;
  special?: SpecialKind;
}

export interface Card {
  /** Opaque id of the pair (random per game), or null for a special tile. */
  pairId: string | null;
  /** 'cue' is the side that stays up while the word is said; 'word' carries the word itself. */
  role: 'cue' | 'word' | 'special';
  face: Face;
  state: 'down' | 'up' | 'cleared';
}

export interface Pair {
  id: string;
  kind: PairKind;
  word: { id: string; jp: JpText };
  /** Readings that count as saying the word. */
  accepted: string[];
  /** Times nobody managed to say it; on the second miss the pair is cleared with no owner. */
  misses: number;
  ownerId: string | null;
  cleared: boolean;
}

export interface BoardPlan {
  cols: number;
  rows: number;
  pairs: number;
  specials: SpecialKind[];
}

/** Board size by player count, a step smaller when most players are at the Kana level. */
export function planBoard(players: number, levels: readonly Level[], random: () => number): BoardPlan {
  let size = players <= 3 ? 4 : players <= 5 ? 5 : 6;
  const kana = levels.filter((l) => l === 'kana').length;
  if (levels.length > 0 && kana * 2 > levels.length && size > 4) size -= 1;
  return planForSize(size, random);
}

export function planForSize(size: number, random: () => number): BoardPlan {
  const cells = size * size;
  const specialCount = size === 4 ? 2 : size === 5 ? 3 : 4;
  const pool: SpecialKind[] = ['yokai', 'bonus', 'fog'];
  const specials = size === 4 ? shuffled(pool, random).slice(0, 2) : size === 5 ? pool : [...pool, 'bonus' as const];
  return { cols: size, rows: size, pairs: (cells - specialCount) / 2, specials: specials.slice(0, specialCount) };
}

/** Words that make good cards: short single words, not held back as the untaught baseline. */
export function usableWords(pack: TopicPack | undefined, levels: readonly Level[]): PackWord[] {
  if (!pack) return [];
  const baseline = new Set(pack.baselineWordIds);
  const kanaGame = levels.length > 0 && levels.every((l) => l === 'kana');
  return pack.words.filter((w) => {
    if (baseline.has(w.id) || w.swerve || w.stereotype) return false;
    if (n4Up(w.level)) return false;
    if (kanaGame && w.level !== 'kana' && !emojiFor(w.jp.kana)) return false;
    const reading = normalizeReading(w.jp.kana);
    if (!reading || [...reading].length > 7) return false;
    if (/\s/.test(w.jp.text.trim()) || /\s/.test(w.jp.kana.trim())) return false;
    return w.pos !== 'phrase';
  });
}

/** The English shown on a meaning card: the first sense only. */
export function shortEn(en: string): string {
  return en.split(/[;(]/)[0]!.trim() || en.trim();
}

/** Picks words with distinct readings, meanings and pictures, so no two cards can be mixed up. */
export function pickWords(candidates: readonly PackWord[], count: number, random: () => number): PackWord[] {
  const out: PackWord[] = [];
  const seen = new Set<string>();
  for (const w of shuffled(candidates, random)) {
    if (out.length >= count) break;
    const keys = [`r:${normalizeReading(w.jp.kana)}`, `t:${w.jp.text}`, `e:${shortEn(w.jp.en).toLowerCase()}`];
    const emoji = emojiFor(w.jp.kana);
    if (emoji) keys.push(`p:${emoji}`);
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    out.push(w);
  }
  return out;
}

/** Chooses each word's pair kind, aiming for a mix (pictures ~30%, kanji ~25% when N5+ play, audio ~20%). */
export function assignKinds(words: readonly PackWord[], levels: readonly Level[], random: () => number): PairKind[] {
  const readers = levels.some((l) => l !== 'kana');
  const target: Record<PairKind, number> = { picture: 0.3, reading: readers ? 0.25 : 0, audio: 0.2, meaning: 0.25 };
  const used: Record<PairKind, number> = { picture: 0, reading: 0, audio: 0, meaning: 0 };
  return words.map((w, i) => {
    const eligible: PairKind[] = ['meaning', 'audio'];
    if (emojiFor(w.jp.kana)) eligible.push('picture');
    if (readers && hasKanji(w.jp.text)) eligible.push('reading');
    // Largest shortfall against the target wins; ties broken at random.
    let best: PairKind = 'meaning';
    let bestGap = -Infinity;
    for (const k of shuffled(eligible, random)) {
      const gap = target[k] * (i + 1) - used[k];
      if (gap > bestGap) {
        best = k;
        bestGap = gap;
      }
    }
    used[best] += 1;
    return best;
  });
}

export function facesFor(kind: PairKind, jp: JpText): { cue: Face; word: Face } {
  const wordFace: Face = { kind: 'word', text: jp.text, ...(hasKanji(jp.text) ? { sub: jp.kana } : {}) };
  switch (kind) {
    case 'meaning':
      return { cue: { kind: 'en', text: shortEn(jp.en) }, word: { kind: 'kana', text: jp.kana } };
    case 'reading':
      return { cue: { kind: 'kanji', text: jp.text }, word: { kind: 'kana', text: jp.kana } };
    case 'picture':
      return { cue: { kind: 'emoji', text: emojiFor(jp.kana) ?? '❓' }, word: wordFace };
    case 'audio':
      return { cue: { kind: 'audio', text: '🔊', say: jp.kana }, word: wordFace };
  }
}

export const SPECIAL_FACES: Record<SpecialKind, Face> = {
  yokai: { kind: 'special', special: 'yokai', text: '👹' },
  bonus: { kind: 'special', special: 'bonus', text: '⭐' },
  fog: { kind: 'special', special: 'fog', text: '🌫️' },
};

export interface BuiltBoard {
  cols: number;
  rows: number;
  cards: Card[];
  pairs: Pair[];
  /** True when the board had to use the built-in placeholder words. */
  fallback: boolean;
}

/** Builds a whole board from the pack (falling back to the placeholder words when it is thin). */
export function buildBoard(
  pack: TopicPack | undefined,
  plan: BoardPlan,
  levels: readonly Level[],
  random: () => number,
  newId: () => string,
): BuiltBoard {
  let fallback = false;
  let words = pickWords(usableWords(pack, levels), plan.pairs, random);
  if (words.length < plan.pairs) {
    // Thin pack: top up from the placeholder set, then shrink the board if still short.
    const more = pickWords([...words, ...FALLBACK_WORDS], plan.pairs, random);
    fallback = more.length > words.length;
    words = more;
  }
  let cols = plan.cols;
  let rows = plan.rows;
  let specials = plan.specials;
  if (words.length < plan.pairs) {
    const size = words.length >= 11 ? 5 : 4;
    const smaller = planForSize(size, random);
    cols = smaller.cols;
    rows = smaller.rows;
    specials = smaller.specials;
    words = words.slice(0, smaller.pairs);
    // Even the fallback can't fill a 4×4: leave the rest of the cells as extra specials.
    while (words.length * 2 + specials.length < cols * rows) specials = [...specials, 'bonus'];
  }
  const kinds = assignKinds(words, levels, random);
  const pairs: Pair[] = [];
  const cards: Card[] = [];
  words.forEach((w, i) => {
    const id = newId();
    const kind = kinds[i]!;
    const faces = facesFor(kind, w.jp);
    pairs.push({ id, kind, word: { id: w.id, jp: w.jp }, accepted: [w.jp.kana, w.jp.text], misses: 0, ownerId: null, cleared: false });
    cards.push({ pairId: id, role: 'cue', face: faces.cue, state: 'down' }, { pairId: id, role: 'word', face: faces.word, state: 'down' });
  });
  for (const sp of specials) cards.push({ pairId: null, role: 'special', face: SPECIAL_FACES[sp], state: 'down' });
  return { cols, rows, cards: shuffled(cards, random), pairs, fallback };
}
