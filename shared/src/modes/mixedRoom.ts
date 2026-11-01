// Mixed rooms (docs/n4-hard-roles.md, "How mixed rooms work"): what the players without the N4 seat get while
// it runs, the same way in every game.
//
//   Gallery           one reaction tile per round for each player without the seat: tap a reaction to the
//                     line (shown on the TV as a bubble), never scored. Once per game, a Kana or N5 player's
//                     tile is a curveball instead: "Which word did you hear?", 3 options, +5 if right.
//   Commentary booth  once the N4 line lands, a short instant replay on the TV: the line with its key word
//                     lit, one line of English colour, and the gist on Kana and N5 phones (Narabete's replay).
//   Host stand-in     in a 1–2-player room with no N4 player, the host plays the role once per game: the
//                     model line, voiced, with the gist on the phones. Nobody is asked to say it.
//
// None of it changes anyone's points, turns or tiles, except the curveball's small +5.

import type { JpText, Level } from '../../../content/src/types.js';
import { toRomaji } from '../japanese/romaji.js';

export interface ReactionTile {
  id: string;
  emoji: string;
  /** Kana, so every level can read it. */
  kana: string;
  en: string;
}

/** The Gallery's reactions, the same four in every game. */
export const REACTIONS: readonly ReactionTile[] = [
  { id: 'sugoi', emoji: '👏', kana: 'すごい！', en: 'Amazing!' },
  { id: 'naruhodo', emoji: '💡', kana: 'なるほど', en: 'I see' },
  { id: 'e', emoji: '😮', kana: 'えっ？', en: 'Huh?' },
  { id: 'warai', emoji: '😂', kana: 'あはは', en: 'Ha ha' },
];

export const CURVEBALL_POINTS = 5;

export interface CurveballOption {
  kana: string;
  romaji: string;
  correct: boolean;
}

/** "Which word did you hear?": the key word of the line just said, and two others. */
export interface Curveball {
  playerId: string;
  /** The key word, in kana. */
  word: string;
  options: CurveballOption[];
  pick?: string | null;
}

/** One round's Gallery: who may react, what they picked. */
export interface Gallery {
  /** Players without the seat who get a tile this round. */
  players: string[];
  picks: Record<string, string>;
  curveball: Curveball | null;
}

/**
 * Distractors for a curveball: words from the pool that aren't the key word and don't contain it, in a stable
 * order picked by `seed` (so a replay of a game is the same).
 */
function distractors(word: string, pool: readonly string[], seed: number): string[] {
  const other = [...new Set(pool)].filter((w) => w !== word && !w.includes(word) && !word.includes(w));
  const out: string[] = [];
  for (let i = 0; out.length < 2 && i < other.length; i++) out.push(other[(seed + i * 7) % other.length]!);
  return [...new Set(out)];
}

/** Common N4 key words to draw curveball distractors from when a game has none of its own. */
export const KEY_WORDS: readonly string[] = ['ので', 'のに', 'から', 'けど', 'そう', 'らしい', 'かも', 'ように', 'ために', 'ながら', 'すぎる', 'いただけますか', 'もらえますか', 'いっていました', 'みられました', 'ございます'];

/**
 * Open a round's Gallery. `others` are the players without the seat (connected, not bots); `kanaOrN5` the
 * subset at Kana or N5. The curveball goes to the first Kana or N5 player, once per game (`curveballUsed`), and
 * only when the line has a key word.
 */
export function openGallery(
  others: readonly string[],
  kanaOrN5: readonly string[],
  key: { word: string; pool?: readonly string[] } | null,
  curveballUsed: boolean,
  seed: number,
): Gallery {
  const target = !curveballUsed && key ? others.find((p) => kanaOrN5.includes(p)) : undefined;
  let curveball: Curveball | null = null;
  if (target && key) {
    const wrong = distractors(key.word, key.pool ?? KEY_WORDS, seed);
    if (wrong.length === 2) {
      const all = [key.word, ...wrong];
      const order = all.map((_, i) => all[(i + seed) % all.length]!);
      curveball = { playerId: target, word: key.word, options: order.map((w) => ({ kana: w, romaji: toRomaji(w), correct: w === key.word })) };
    }
  }
  return { players: [...others], picks: {}, curveball };
}

/** A tap on a Gallery tile. Returns curveball points (0 or CURVEBALL_POINTS), or null if the tap is refused. */
export function pickGallery(g: Gallery, playerId: string, pick: string): number | null {
  if (!g.players.includes(playerId)) return null;
  if (g.curveball?.playerId === playerId) {
    if (g.curveball.pick != null) return null;
    const opt = g.curveball.options.find((o) => o.kana === pick);
    if (!opt) return null;
    g.curveball.pick = pick;
    return opt.correct ? CURVEBALL_POINTS : 0;
  }
  if (g.picks[playerId] || !REACTIONS.some((r) => r.id === pick)) return null;
  g.picks[playerId] = pick;
  return 0;
}

/** What the TV shows: a bubble per reaction (emoji and kana), in tap order. */
export function galleryBubbles(g: Gallery): ReactionTile[] {
  return Object.values(g.picks).map((id) => REACTIONS.find((r) => r.id === id)!).filter(Boolean);
}

/** A player's Gallery tile, for their phone (null when they have none this round). */
export type GalleryTileView =
  | { kind: 'react'; picked: string | null; tiles: readonly ReactionTile[] }
  | { kind: 'curveball'; picked: string | null; options: { kana: string; romaji: string | null }[]; right: boolean | null };

export function galleryTileFor(g: Gallery | null | undefined, playerId: string, level: Level): GalleryTileView | null {
  if (!g || !g.players.includes(playerId)) return null;
  if (g.curveball?.playerId === playerId) {
    const c = g.curveball;
    const picked = c.pick ?? null;
    return { kind: 'curveball', picked, options: c.options.map((o) => ({ kana: o.kana, romaji: level === 'kana' ? o.romaji : null })), right: picked == null ? null : picked === c.word };
  }
  return { kind: 'react', picked: g.picks[playerId] ?? null, tiles: REACTIONS };
}

/** The commentary booth's instant replay, the same shape in every game. */
export interface Commentary {
  playerId: string | null;
  /** The line as voiced: always a fixed model line (a player's own words are shown, never voiced). */
  line: JpText;
  voiced: boolean;
  /** The line split round its key word, for lighting it. */
  lit: { before: string; key: string; after: string };
  /** One line of English colour, about the play, never the player's mistakes. */
  note: string;
  /** For Kana and N5 phones: a kana line and plain English. */
  gist: { kana: string; en: string; emoji: string | null };
  ms: number;
}

/** Split a line round the first of its key words (the whole line in `before` when none is in it). */
export function lightUp(text: string, keys: readonly string[]): Commentary['lit'] {
  let best: { i: number; k: string } | null = null;
  for (const k of keys) {
    const i = text.indexOf(k);
    if (i >= 0 && (!best || i < best.i || (i === best.i && k.length > best.k.length))) best = { i, k };
  }
  return best ? { before: text.slice(0, best.i), key: best.k, after: text.slice(best.i + best.k.length) } : { before: text, key: '', after: '' };
}

/** Booth length: 5–7 s, about 0.15 s a kana. */
export function commentaryMs(line: JpText): number {
  return Math.max(5_000, Math.min(7_000, 2_500 + line.kana.length * 150));
}

/** The gist on a phone, at its level: romaji under the kana for Kana players. */
export function gistFor(c: Commentary | null | undefined, level: Level): (Commentary['gist'] & { romaji: string | null }) | null {
  if (!c || level === 'n4') return null;
  return { ...c.gist, romaji: level === 'kana' ? toRomaji(c.gist.kana) : null };
}

/**
 * The host stand-in: in a room of one or two players with nobody at N4, the host plays the hard role once per
 * game (Ladi, 2026-11-01, "Later" list). Bots don't count as players.
 */
export function hostStandsIn(levels: readonly Level[]): boolean {
  return levels.length >= 1 && levels.length <= 2 && !levels.includes('n4');
}
