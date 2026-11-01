// Mixed rooms (docs/n4-hard-roles.md, "How mixed rooms work"): what the players without the N4 seat get while
// it runs, the same way in every game.
//
//   Gallery           one reaction tile per round for each player without the seat: tap a reaction to the
//                     line (shown on the TV as a bubble), never scored. Once per game, after the line has
//                     landed, a Kana or N5 player who hasn't reacted yet gets a curveball instead (`armCurveball`):
//                     "Which word did you hear?", 3 options, +5 if right (with `scaledCurveball` on, about a
//                     tenth of the game's basic right answer: `curveballPoints`), then what the word means
//                     (`KEY_GLOSS`). Who gets it rotates with the seed.
//                     With `spokenReaction` on, a player may say their reaction instead of tapping it, once the
//                     line has landed (`Gallery.landed`): a match picks that tile and pays SPOKEN_REACTION_POINTS;
//                     a miss leaves the tiles to tap.
//   Commentary booth  once the N4 line lands, a short instant replay on the TV: the line with its key word
//                     lit, one line of English colour, and the gist on Kana and N5 phones (Narabete's replay).
//   Host stand-in     in a 1–2-player room with no N4 player, the host plays the role once per game: the
//                     model line, voiced, with the gist on the phones. Nobody is asked to say it. Two
//                     experiments (experiments.ts): a short setup line first (standInSetup), and a Gallery with
//                     the once-a-game curveball on the host's line (standInCurveball; the helpers at the end).
//
// None of it changes anyone's points, turns or tiles, except the curveball's small bonus (and a said reaction's).

import type { HostLine, JpText, Level } from '../../../content/src/types.js';
import { isUtterance, normalizeReading, soundKey, VOWEL_OF, type Utterance } from '../japanese/kana.js';
import { toRomaji } from '../japanese/romaji.js';
import { EXPERIMENTS } from './experiments.js';
import type { PhraseEntry } from './mode.js';

export interface ReactionTile {
  id: string;
  emoji: string;
  /** Kana, so every level can read it. */
  kana: string;
  en: string;
  /** On a Kana player's phone only: the kana in romaji, shown under it with the English. */
  romaji?: string;
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
 *   Onsen         a question that finds a clue: POINTS.clue = 100
 *   Omiai         one vote for your answer: POINTS_PER_VOTE = 100
 *   Dub Club      a right guess: GUESS_POINTS = 50
 *   Narabete      one pair in order: PAIR_POINTS = 100
 * (Onsen's is a clue, not the culprit, so a 1-in-3 tap never pays more than an understood question's 20; for Ladi
 * to confirm.)
 */
export const BASIC_POINTS: Readonly<Record<GalleryGame, number>> = {
  'bento-haus': 150,
  'last-train': 100,
  'onsen-murder': 100,
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
  /** What the key word means, in plain English (the key's own `en`, else `KEY_GLOSS`), shown once it's answered. */
  en?: string;
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
  /**
   * The line has landed (been accepted, or voiced by the host): only then may a reaction be said, so nobody talks
   * over it. Tapping works all along. Set by `armCurveball` (and `dealStandIn`), `landGallery`, or an `openGallery`
   * given a key.
   */
  landed?: true;
}

/** Marks a Gallery's line as landed, for a game whose line lands without `armCurveball` being called. */
export function landGallery(g: Gallery | null | undefined): void {
  if (g) g.landed = true;
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
 * What each curveball key word means, in plain English, for the phone once the curveball is answered and for the
 * phrasebook (the beginner seat's list, plus every other key the six games light; tests/mixedRoom.test.ts checks
 * each one has a gloss). For Ladi to confirm.
 */
export const KEY_GLOSS: Readonly<Record<string, string>> = {
  // Short N4 connectives and endings.
  ので: 'so, because',
  のに: 'even though',
  から: 'because',
  けど: 'but',
  まで: 'until',
  そう: 'looks like',
  そうな: 'looks like',
  らしい: 'apparently',
  かも: 'maybe',
  ように: 'so that',
  ために: 'in order to',
  ながら: 'while doing',
  すぎる: 'too much',
  // Asking politely (Bento Haus).
  いただけますか: 'could you please…? (very polite)',
  いただけませんか: 'could you please…? (very polite, softer)',
  もらえますか: 'could you…?',
  くれませんか: 'won’t you…?',
  おねがいします: 'please',
  あります: 'there is, we have',
  ください: 'please',
  おまちください: 'please wait',
  // Reports (Murder at the Onsen).
  いっていました: '(they) said',
  いいました: 'said',
  いっています: 'is saying',
  いきました: 'went',
  みられました: 'was seen',
  みました: 'saw',
  みせました: 'showed',
  みえました: 'could be seen',
  // The platform and the front desk (Last Train).
  ございます: 'there is (extra polite)',
  まいります: 'is coming (polite)',
  おさがりください: 'please step back',
  おきをつけください: 'please be careful',
  ございません: 'there isn’t (extra polite)',
  かもしれません: 'might be',
  だそうです: 'I hear that…',
  はずです: 'should be',
  てあります: 'has been done',
  // The go-between (Omiai).
  'おつきに なりました': 'has arrived (polite)',
  いらっしゃいます: 'is (polite, about a person)',
  'おききに なります': 'will ask (polite)',
  'おかえりに なります': 'will go home (polite)',
  // Dub Club's ad-lib words (a stem like たすけ is glossed as the word it starts).
  おにぎり: 'rice ball',
  しらない: 'don’t know',
  ちがう: 'that’s wrong',
  たべてない: 'haven’t eaten',
  ぼくじゃ: 'not me',
  おいし: 'tasty',
  ごめん: 'sorry',
  だいじょうぶ: 'it’s OK',
  まもる: 'protect',
  へんしん: 'transform',
  かてない: 'can’t win',
  まけない: 'won’t lose',
  よわい: 'weak',
  ごはん: 'meal, rice',
  はやく: 'quickly',
  たすけ: 'help',
  こわれ: 'broke',
  たいへん: 'oh no, terrible',
  ようこそ: 'welcome',
  こんにちは: 'hello',
  さかな: 'fish',
  ここに: 'here',
  かえらない: 'won’t go home',
  なにか: 'something',
  おばけ: 'ghost',
  さいん: 'autograph',
  ふぁん: 'fan',
  ほんとう: 'really, true',
  ゆうれい: 'ghost',
  じつは: 'actually, the truth is',
  けっこん: 'getting married',
  ざんぎょう: 'overtime',
  かえれない: 'can’t go home',
  どようび: 'Saturday',
  やすみ: 'day off, rest',
  なんで: 'why',
  どうして: 'why',
  きれい: 'pretty',
  かった: 'bought',
  かわいい: 'cute',
  いそがしい: 'busy',
  でーと: 'date',
  おかあさん: 'mum',
  あとで: 'later',
  さいふ: 'wallet',
  わすれ: 'forgot',
  おやすみ: 'good night',
  へんじ: 'reply',
  しゃしん: 'photo',
  ちがった: 'was different',
  おじさん: 'old guy',
  あいたい: 'want to see you',
  かんがえ: 'thinking',
  もしもし: 'hello (on the phone)',
  ありがとう: 'thank you',
  だいすき: 'love',
  みんな: 'everyone',
  うれしい: 'happy',
  まって: 'wait',
  つかれ: 'tired',
  らーめん: 'ramen',
  おなか: 'stomach',
};

/** A curveball's key: the word, where its distractors come from, what was heard, and (optionally) its English. */
export interface CurveballKey {
  word: string;
  pool?: readonly string[];
  heard?: string;
  en?: string;
}

/**
 * Open a round's Gallery. `others` are the players without the seat (connected, not bots); `kanaOrN5` the
 * subset at Kana or N5. Pass a key only when the line has already been heard; otherwise pass null and call
 * `armCurveball` once it lands. The curveball goes to a Kana or N5 player picked by `seed`, once per game.
 */
export function openGallery(
  others: readonly string[],
  kanaOrN5: readonly string[],
  key: CurveballKey | null,
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
      const en = key.en ?? KEY_GLOSS[key.word];
      if (en) curveball.en = en;
    }
  }
  const g: Gallery = { players: [...others], picks: {}, curveball };
  // A key means the line has already been heard.
  if (key) g.landed = true;
  return g;
}

/**
 * Deals the once-a-game curveball after the line has been heard (accepted, or voiced by the host): a Kana or N5
 * player who hasn't reacted yet gets it in place of their reaction tile, picked by `seed`. True when dealt, so the
 * game can mark its curveball used. A line that never lands deals none. Called once the line lands, so it marks
 * the Gallery landed whether or not a curveball comes of it. `evenIfReacted`: any Kana or N5 player may get it
 * (the stand-in's fallback, `dealStandIn`); their reaction stays on the TV.
 */
export function armCurveball(
  g: Gallery | null | undefined,
  kanaOrN5: readonly string[],
  key: CurveballKey | null,
  used: boolean,
  seed: number,
  opts: { evenIfReacted?: boolean } = {},
): boolean {
  if (!g) return false;
  g.landed = true;
  if (used || !key || g.curveball) return false;
  const free = g.players.filter((p) => kanaOrN5.includes(p) && (opts.evenIfReacted || !g.picks[p]));
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

// Little endings a reaction is often said with (すごいね, がんばれー, へえー), after a polite です or ください at most
// (すごいですね, がんばってください).
const TAIL = /^(?:です|ください)?[ねよなあえおっー]{0,2}$/;
// Other ways a reaction is said, beyond its tile's kana: the N5 がんばって for the N4 imperative がんばれ. Matched,
// they still log the tile's kana.
const SAID_ALSO: Readonly<Record<string, readonly string[]>> = { warai: ['がんばって'] };
// A reaction's kana, said with any vowel stretched or a small っ inside it (すごーい → すごおい, すっごい, なーるほど).
const stretchy = (k: string) => new RegExp('^' + [...k].map((c) => c + (VOWEL_OF[c] && VOWEL_OF[c] !== 'ん' ? `${VOWEL_OF[c]}*` : '') + 'っ?').join(''));

/**
 * The reaction tile an utterance says, if any: its kana (or a SAID_ALSO form), stretched or not, said once or twice,
 * with a little ending at most.
 */
export function reactionSaid(u: Utterance): ReactionTile | null {
  // Speech-to-text often writes a long vowel as 〜 (へ〜, すご〜い): read it as ー, not as punctuation.
  const raw = (u.reading ?? u.text).replace(/[〜～~]/g, 'ー');
  const heard = normalizeReading(raw).replace(/[ぁぃぅぇぉ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
  if (!heard) return null;
  for (const t of REACTIONS) {
    for (const k of [normalizeReading(t.kana), ...(SAID_ALSO[t.id] ?? [])]) {
      if (soundKey(heard) === soundKey(k)) return t;
      const re = stretchy(k);
      let m = heard.match(re);
      if (!m) continue;
      let rest = heard.slice(m[0].length);
      m = rest.match(re);
      if (m) rest = rest.slice(m[0].length);
      if (TAIL.test(rest)) return t;
    }
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
    // Right or wrong, the phone then shows what the word means: save it to the phrasebook as seen.
    const { word, en } = g.curveball;
    if (en) opts.phrase?.({ itemId: `curveball-${word}`, text: word, kana: word, en, outcome: 'seen' });
    return points;
  }
  if (g.picks[playerId]) return null;
  if (pick === SAY_PICK) {
    const u = opts.utterance;
    // Not before the line has landed: nobody talks over it.
    if (!EXPERIMENTS.spokenReaction || !g.landed || !isUtterance(u) || u.via !== 'speech') return null;
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
      /**
       * `spokenReaction` only, once the line has landed: the reaction may be said (phones with a mic show a small
       * 🎤), was said, missed.
       */
      say?: { said: boolean; missed: boolean };
    }
  | {
      kind: 'curveball';
      picked: string | null;
      options: { kana: string; romaji: string | null }[];
      right: boolean | null;
      answer: string | null;
      /** Once picked: the answer in romaji, for every level. */
      answerRomaji: string | null;
      /** Once picked: what the answer means, when there's a gloss. */
      gloss: string | null;
      /** `scaledCurveball` only: what the right pick paid. */
      paid?: number;
    };

export function galleryTileFor(g: Gallery | null | undefined, playerId: string, level: Level): GalleryTileView | null {
  if (!g || !g.players.includes(playerId)) return null;
  if (g.curveball?.playerId === playerId) {
    const c = g.curveball;
    const picked = c.pick ?? null;
    const done = picked != null;
    const view: GalleryTileView = {
      kind: 'curveball',
      picked,
      options: c.options.map((o) => ({ kana: o.kana, romaji: level === 'kana' ? o.romaji : null })),
      right: done ? picked === c.word : null,
      answer: done ? c.word : null,
      answerRomaji: done ? toRomaji(c.word) : null,
      gloss: done ? (c.en ?? null) : null,
    };
    if (c.paid) view.paid = c.paid;
    return view;
  }
  const tiles = level === 'kana' ? REACTIONS.map((t) => ({ ...t, romaji: toRomaji(t.kana) })) : REACTIONS;
  const view: GalleryTileView = { kind: 'react', picked: g.picks[playerId] ?? null, tiles };
  if (EXPERIMENTS.spokenReaction && g.landed) view.say = { said: !!g.said?.[playerId], missed: !!g.missed?.[playerId] };
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

// ---- experiments on the host stand-in (experiments.ts: standInSetup, standInCurveball) ----

/**
 * standInSetup: the host's short setup line (Pon's ドロン！) comes where the stand-in's model line used to, and the
 * model line follows it after `standInSetupMs` of the setup line: at least this long.
 */
export const STAND_IN_SETUP_MS = 2_500;

/**
 * About how long the host takes to say a stand-in line on the TV: the bank voice can land up to 1.5 s late, then
 * roughly 0.11 s a kana; at most 7 s (the estimate Omiai and Murder at the Onsen use).
 */
export const standInVoiceMs = (kana: string): number => Math.min(7_000, 1_500 + 110 * kana.replace(/[\s　。、！？…]/g, '').length);

/**
 * standInSetup: the gap between the setup line and the model line, from how long the setup line takes to say
 * (`standInVoiceMs`), never under STAND_IN_SETUP_MS. Setup lines are at most 16 kana, so about 2.5–3.3 s.
 */
export const standInSetupMs = (kana: string): number => Math.max(STAND_IN_SETUP_MS, standInVoiceMs(kana));

/**
 * The kana of a setup event's bank line, for `standInSetupMs`: the longest of them, so the model line never lands
 * on top of whichever the host says ('' when the bank has none, which gives the floor).
 */
export function setupKana(lines: readonly HostLine[], event: string): string {
  return lines.filter((l) => l.event === event).reduce((a, l) => (l.jp.kana.length > a.length ? l.jp.kana : a), '');
}

/** standInSetup: the gap after a game's setup event (`*_standin_setup`), from its bank line. */
export const standInSetupFor = (lines: readonly HostLine[], event: string): number => standInSetupMs(setupKana(lines, event));

/** standInCurveball: a curveball dealt on the stand-in's line stays up at least this long for its answer. */
export const STAND_IN_CURVEBALL_MS = 5_000;

/**
 * standInCurveball: in a stand-in room (nobody holds a seat), every connected player gets a Gallery tile while
 * the host says the line, and once it has been voiced (`dealAt`, server clock) the once-a-game curveball is dealt
 * on it to a Kana or N5 player who hasn't reacted yet.
 */
export interface StandInGallery {
  g: Gallery;
  /** When the host has said the line (server clock): the curveball is dealt then. */
  dealAt: number;
  /** When the phase would end without the curveball (server clock). */
  until: number;
  /** A curveball may come of it: a Kana or N5 player is here and the game's curveball is unused. */
  maybe: boolean;
  /** The deal has been tried (whether or not a curveball came of it). */
  dealt: boolean;
}

type Seat = { id: string; level: Level };
const lowIds = (players: readonly Seat[]) => players.filter((p) => p.level === 'kana' || p.level === 'n5').map((p) => p.id);

/** Opens the stand-in's Gallery (null when nobody's there). The curveball comes later, from `dealStandIn`. */
export function openStandInGallery(players: readonly Seat[], curveballUsed: boolean, seed: number, dealAt: number, until: number): StandInGallery | null {
  if (!players.length) return null;
  const g = openGallery(
    players.map((p) => p.id),
    lowIds(players),
    null,
    curveballUsed,
    seed,
  );
  return { g, dealAt, until, maybe: !curveballUsed && lowIds(players).length > 0, dealt: false };
}

/** When the stand-in's phase ends at the latest: its own end, or the curveball's time after the line. */
export const standInEnd = (sg: StandInGallery): number => Math.max(sg.until, sg.dealAt + (sg.maybe ? STAND_IN_CURVEBALL_MS : 0));

/** The TV and the gist hold back the key word while a curveball on it may still come, or is unanswered. */
export const standInHoldKey = (sg: StandInGallery | null | undefined): boolean => !!sg && sg.maybe && (!sg.dealt || keyHeld(sg.g));

/**
 * Once the line has been voiced: marks the Gallery landed and deals the curveball on its key word (`armCurveball`,
 * heard = the line's kana), to a Kana or N5 player who hasn't reacted, else to one who has. True when one was
 * dealt, so the game can mark its curveball used. Tried once.
 */
export function dealStandIn(
  sg: StandInGallery | null | undefined,
  players: readonly Seat[],
  key: CurveballKey | null,
  used: boolean,
  seed: number,
  now: number,
): boolean {
  if (!sg || sg.dealt || now < sg.dealAt) return false;
  sg.dealt = true;
  landGallery(sg.g);
  // Players react while the host is still talking, so a quick tap mustn't cost them the curveball: someone who
  // hasn't reacted first, then anyone at Kana or N5.
  const low = lowIds(players);
  return armCurveball(sg.g, low, key, used, seed) || armCurveball(sg.g, low, key, used, seed, { evenIfReacted: true });
}

/**
 * The stand-in's phase can end: the line has been said, any curveball has been answered or had its time, and
 * the phase has had its own time (`until`).
 */
export function standInDone(sg: StandInGallery, now: number): boolean {
  const holds = !sg.dealt || (keyHeld(sg.g) && now < sg.dealAt + STAND_IN_CURVEBALL_MS);
  return !holds && now >= sg.until;
}

/** When the stand-in's Gallery next needs a wake: to deal the curveball, when its time is up, at the phase's own end. */
export function standInWakeAt(sg: StandInGallery | null | undefined, now: number): number | null {
  if (!sg) return null;
  if (!sg.dealt) return sg.dealAt;
  const times = [sg.until, ...(keyHeld(sg.g) ? [sg.dealAt + STAND_IN_CURVEBALL_MS] : [])].filter((t) => t > now);
  return times.length ? Math.min(...times) : null;
}
