// Mixed rooms (docs/n4-hard-roles.md, "How mixed rooms work"): what the players without the N4 seat get while
// it runs, the same way in every game.
//
//   Gallery           one reaction tile per round for each player without the seat: tap a reaction to the
//                     line (shown on the TV as a bubble), never scored. Once per game, after the line has
//                     landed, a Kana or N5 player who hasn't reacted yet gets a curveball instead (`armCurveball`):
//                     "Which word did you hear?", 3 options, +5 if right (with `scaledCurveball` on, about a
//                     tenth of the game's basic right answer: `curveballPoints`). Who gets it rotates with the seed.
//                     With `spokenReaction` on, a player may say their reaction instead of tapping it: a match
//                     picks that tile and pays SPOKEN_REACTION_POINTS; a miss leaves the tiles to tap.
//   Commentary booth  once the N4 line lands, a short instant replay on the TV: the line with its key word
//                     lit, one line of English colour, and the gist on Kana and N5 phones (Narabete's replay).
//   Host stand-in     in a 1–2-player room with no N4 player, the host plays the role once per game: the
//                     model line, voiced, with the gist on the phones. Nobody is asked to say it.
//
// None of it changes anyone's points, turns or tiles, except the curveball's small bonus (and a said reaction's).

import type { JpText, Level } from '../../../content/src/types.js';
import { isUtterance, normalizeReading, soundKey, type Utterance } from '../japanese/kana.js';
import { toRomaji } from '../japanese/romaji.js';
import { EXPERIMENTS } from './experiments.js';
import type { PhraseEntry } from './mode.js';

export interface ReactionTile {
  id: string;
  emoji: string;
  /** Kana, so every level can read it. */
  kana: string;
  en: string;
  /** On a TV bubble only (`spokenReaction`): it was said out loud, not tapped. */
  said?: true;
}

/** The Gallery's reactions, the same four in every game. */
export const REACTIONS: readonly ReactionTile[] = [
  { id: 'sugoi', emoji: '👏', kana: 'すごい！', en: 'Amazing!' },
  { id: 'naruhodo', emoji: '💡', kana: 'なるほど', en: 'I see' },
  { id: 'e', emoji: '😮', kana: 'へえ！', en: 'Oh, really!' },
  { id: 'warai', emoji: '📣', kana: 'がんばれ！', en: 'Go for it!' },
];

/** The flat curveball bonus (and what `curveballPoints` pays with `scaledCurveball` off). */
export const CURVEBALL_POINTS = 5;

/** The six games with a Gallery. */
export type GalleryGame = 'bento-haus' | 'last-train' | 'onsen-murder' | 'omiai' | 'dub-club' | 'narabete';

/**
 * Each game's basic right answer, which the scaled curveball pays a tenth of (rounded to 5). Copied here, not
 * imported, since the games import this file; tests/mixedRoom.test.ts checks they still match the games' own.
 *   Bento Haus    a perfect box: TIPS.perfect (3) × TIP_POINTS (50) = 150
 *   Last Train    a stop's item right first try: RULES.pointsFirstTry = 100
 *   Onsen         naming the culprit: POINTS.accuse = 300
 *   Omiai         one vote for your answer: POINTS_PER_VOTE = 100
 *   Dub Club      a right guess: GUESS_POINTS = 50
 *   Narabete      one pair in order: PAIR_POINTS = 100
 * (for Ladi to confirm: Onsen's is the culprit, the game's big answer, so its curveball is the richest at 30.)
 */
export const BASIC_POINTS: Readonly<Record<GalleryGame, number>> = {
  'bento-haus': 150,
  'last-train': 100,
  'onsen-murder': 300,
  omiai: 100,
  'dub-club': 50,
  narabete: 100,
};

/** What a right curveball pays in this game: about a tenth of its basic right answer, or a flat +5. */
export function curveballPoints(game?: GalleryGame): number {
  if (!EXPERIMENTS.scaledCurveball || !game) return CURVEBALL_POINTS;
  return Math.max(5, Math.round(BASIC_POINTS[game] / 10 / 5) * 5);
}

/** A said reaction's bonus (`spokenReaction`): small, so tapping is never far behind (for Ladi to confirm). */
export const SPOKEN_REACTION_POINTS = 2;
/** The pick a phone sends with an utterance for a said reaction. */
export const SAY_PICK = 'say';

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
  /** What a right pick paid (`scaledCurveball` only), for the phone's "+N". */
  paid?: number;
}

/** One round's Gallery: who may react, what they picked. */
export interface Gallery {
  /** Players without the seat who get a tile this round. */
  players: string[];
  picks: Record<string, string>;
  curveball: Curveball | null;
  /** `spokenReaction`: players whose pick was said out loud. */
  said?: Record<string, true>;
  /** `spokenReaction`: players whose last try at saying one matched no tile (they tap instead). */
  missed?: Record<string, true>;
}

/**
 * Distractors for a curveball: words from the pool that aren't the key word and don't contain it, in a stable
 * order picked by `seed` (so a replay of a game is the same).
 */
function distractors(word: string, pool: readonly string[], seed: number, heard = ''): string[] {
  const flat = (w: string) => w.replace(/[\s　]/g, '');
  const h = flat(heard);
  const k = flat(word);
  // Never a word the line also contains (it was heard too), and options of about the same length.
  const other = [...new Set(pool)].filter((w) => {
    const f = flat(w);
    return f !== k && !f.includes(k) && !k.includes(f) && !h.includes(f) && !h.includes(f.slice(0, 4));
  });
  const near = other.filter((w) => Math.abs(flat(w).length - k.length) <= 2);
  const from = near.length >= 2 ? near : other;
  const out: string[] = [];
  // Start at a seed-picked word and walk on, so two different words always come out when there are two.
  const start = Math.abs(seed * 7) % Math.max(1, from.length);
  for (let i = 0; out.length < 2 && i < from.length; i++) out.push(from[(start + i) % from.length]!);
  return out;
}

/** Common N4 key words to draw curveball distractors from when a game has none of its own. */
export const KEY_WORDS: readonly string[] = ['ので', 'のに', 'から', 'けど', 'そう', 'らしい', 'かも', 'ように', 'ために', 'ながら', 'すぎる', 'いただけますか', 'もらえますか', 'いっていました', 'みられました', 'ございます'];

/**
 * Open a round's Gallery. `others` are the players without the seat (connected, not bots); `kanaOrN5` the
 * subset at Kana or N5. Pass a key only when the line has already been heard; otherwise pass null and call
 * `armCurveball` once it lands. The curveball goes to a Kana or N5 player picked by `seed`, once per game.
 */
export function openGallery(
  others: readonly string[],
  kanaOrN5: readonly string[],
  key: { word: string; pool?: readonly string[]; heard?: string } | null,
  curveballUsed: boolean,
  seed: number,
): Gallery {
  const low = others.filter((p) => kanaOrN5.includes(p));
  const target = !curveballUsed && key && low.length ? low[Math.abs(seed) % low.length] : undefined;
  let curveball: Curveball | null = null;
  if (target && key) {
    const wrong = distractors(key.word, key.pool ?? KEY_WORDS, seed, key.heard);
    if (wrong.length === 2) {
      const all = [key.word, ...wrong];
      const order = all.map((_, i) => all[(i + seed) % all.length]!);
      curveball = { playerId: target, word: key.word, options: order.map((w) => ({ kana: w, romaji: toRomaji(w), correct: w === key.word })) };
    }
  }
  return { players: [...others], picks: {}, curveball };
}

/**
 * Deals the once-a-game curveball after the line has been heard (accepted, or voiced by the host): a Kana or N5
 * player who hasn't reacted yet gets it in place of their reaction tile, picked by `seed`. True when dealt, so the
 * game can mark its curveball used. A line that never lands deals none.
 */
export function armCurveball(g: Gallery | null | undefined, kanaOrN5: readonly string[], key: { word: string; pool?: readonly string[]; heard?: string } | null, used: boolean, seed: number): boolean {
  if (!g || used || !key || g.curveball) return false;
  const free = g.players.filter((p) => kanaOrN5.includes(p) && !g.picks[p]);
  if (!free.length) return false;
  const c = openGallery(free, free, key, false, seed).curveball;
  if (!c) return false;
  g.curveball = c;
  return true;
}

/** The booth holds back lighting its key word while a curveball on that word is still unanswered. */
export function keyHeld(g: Gallery | null | undefined): boolean {
  return !!g?.curveball && g.curveball.pick == null;
}

/** For a Gallery pick: which game it is (for the curveball's points) and, for a said reaction, the move's utterance. */
export interface GalleryPickOptions {
  game?: GalleryGame;
  /** The move's utterance, when `pick` is SAY_PICK. */
  utterance?: unknown;
  /** Logs a matched said reaction to the player's phrasebook (ctx.phrase for this player). */
  phrase?: (entry: PhraseEntry) => void;
}

// Little endings a reaction is often said with (すごいね, がんばれー, へえー).
const TAIL = /^[ねよなあえおっー]{0,2}$/;

/** The reaction tile an utterance says, if any: its kana, said once or twice, with a little ending at most. */
export function reactionSaid(u: Utterance): ReactionTile | null {
  const heard = normalizeReading(u.reading ?? u.text).replace(/[ぁぃぅぇぉ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
  if (!heard) return null;
  for (const t of REACTIONS) {
    const k = normalizeReading(t.kana);
    let rest = heard;
    if (soundKey(rest) === soundKey(k)) return t;
    if (!rest.startsWith(k)) continue;
    rest = rest.slice(k.length);
    if (rest.startsWith(k)) rest = rest.slice(k.length);
    if (TAIL.test(rest)) return t;
  }
  return null;
}

/**
 * A tap on a Gallery tile, or (`spokenReaction`) a reaction said out loud: pick SAY_PICK with the utterance. Returns
 * the points to award (0, the curveball's, or SPOKEN_REACTION_POINTS), or null if the pick is refused. A said
 * reaction that matches no tile returns 0 and changes nothing but the phone's hint: the player taps instead.
 */
export function pickGallery(g: Gallery, playerId: string, pick: string, opts: GalleryPickOptions = {}): number | null {
  if (!g.players.includes(playerId)) return null;
  if (g.curveball?.playerId === playerId) {
    if (g.curveball.pick != null) return null;
    const opt = g.curveball.options.find((o) => o.kana === pick);
    if (!opt) return null;
    g.curveball.pick = pick;
    const points = opt.correct ? curveballPoints(opts.game) : 0;
    if (points && EXPERIMENTS.scaledCurveball) g.curveball.paid = points;
    return points;
  }
  if (g.picks[playerId]) return null;
  if (pick === SAY_PICK) {
    const u = opts.utterance;
    if (!EXPERIMENTS.spokenReaction || !isUtterance(u) || u.via !== 'speech') return null;
    const tile = reactionSaid(u);
    if (!tile) {
      (g.missed ??= {})[playerId] = true;
      return 0;
    }
    g.picks[playerId] = tile.id;
    (g.said ??= {})[playerId] = true;
    if (g.missed) delete g.missed[playerId];
    // Said, but read: the tile shows the kana while they say it (for Ladi to confirm).
    opts.phrase?.({ itemId: `gallery-${tile.id}`, text: tile.kana, kana: tile.kana, en: tile.en, outcome: 'said', recall: 'read' });
    return SPOKEN_REACTION_POINTS;
  }
  if (!REACTIONS.some((r) => r.id === pick)) return null;
  g.picks[playerId] = pick;
  return 0;
}

/** A TV bubble: the reaction, and (`spokenReaction`) whether it was said out loud. */
export type GalleryBubble = ReactionTile;

/** What the TV shows: a bubble per reaction (emoji and kana), in tap order. */
export function galleryBubbles(g: Gallery): GalleryBubble[] {
  return Object.entries(g.picks)
    .map(([p, id]) => {
      const t = REACTIONS.find((r) => r.id === id);
      return t && g.said?.[p] ? { ...t, said: true as const } : t;
    })
    .filter((t): t is GalleryBubble => !!t);
}

/** A player's Gallery tile, for their phone (null when they have none this round). */
export type GalleryTileView =
  | {
      kind: 'react';
      picked: string | null;
      tiles: readonly ReactionTile[];
      /** `spokenReaction` only: the reaction may be said (phones with a mic show a small 🎤), was said, missed. */
      say?: { said: boolean; missed: boolean };
    }
  | {
      kind: 'curveball';
      picked: string | null;
      options: { kana: string; romaji: string | null }[];
      right: boolean | null;
      answer: string | null;
      /** `scaledCurveball` only: what the right pick paid. */
      paid?: number;
    };

export function galleryTileFor(g: Gallery | null | undefined, playerId: string, level: Level): GalleryTileView | null {
  if (!g || !g.players.includes(playerId)) return null;
  if (g.curveball?.playerId === playerId) {
    const c = g.curveball;
    const picked = c.pick ?? null;
    const view: GalleryTileView = { kind: 'curveball', picked, options: c.options.map((o) => ({ kana: o.kana, romaji: level === 'kana' ? o.romaji : null })), right: picked == null ? null : picked === c.word, answer: picked == null ? null : c.word };
    if (c.paid) view.paid = c.paid;
    return view;
  }
  const view: GalleryTileView = { kind: 'react', picked: g.picks[playerId] ?? null, tiles: REACTIONS };
  if (EXPERIMENTS.spokenReaction) view.say = { said: !!g.said?.[playerId], missed: !!g.missed?.[playerId] };
  return view;
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
