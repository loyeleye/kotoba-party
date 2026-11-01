// はじめまして！ (Hajimemashite!, "nice to meet you!"): Pon's guest corner. Each turn one player is the
// guest: they write one true thing about themselves, a few tanuki write lies about them, the previous
// guest introduces them by reading every card aloud (他己紹介), and the room ranks the cards from
// "surely true" to "surely a lie". Lies ranked above the truth score for their tanuki.
// See docs/modes/hajimemashite.md.
//
// One turn per guest:
//   prompt  the guest greets the room (はじめまして…), writing their name in katakana the first time;
//           everyone else answers こちらこそ、よろしく おねがいします.
//   answer  everyone writes to the turn's card in silence (saying it would give the truth away): the
//           guest the truth, the tanuki a lie from a private hand of tiles (or typed), detectives a
//           hidden guess of the truth.
//   reveal  the introducer reads the lines one by one; a card's text reaches the TV only when its line
//           is read (or Pon reads it, for nothing, when the reader gives up or a line runs out of time).
//   encore  everyone but the guest ranks the cards (their own lie left off); the guest picks the lie
//           they wish were true.
//   score   the cards flip from the least believed up; each tanuki claims theirs (ドロン！), the guest
//           refutes each lie and says the truth.
// After the last turn, one `finale`: おぼえてる？ say (or tap) the true thing about everyone else.

import type { JpText, Level } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH } from '../../constants.js';
import { hasKanji, isUtterance, normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { isRomaji, nameToKatakana, romajiToHiragana } from '../../japanese/toKana.js';
import { playerTextAllowed } from '../../moderation.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { cardsFor, fillFrame, introCardOf, tileOf, tilesOnly, type IntroCard, type Tile } from './cards.js';

// ---- tuning ----

export const CARDS = 4;
export const CARDS_FIVE = 5;
/** Tiles in each tanuki's private hand. */
export const HAND = 4;
export const SHORT_GUESTS = 4;
/** Longest word a blank takes, in characters: a long, specific truth would stand out. */
export const MAX_WORD = 12;

export const POINTS = {
  /** Where the truth sits on your own ballot: first, second, third. */
  rank: [200, 100, 40],
  /** Per ballot (not the tanuki's own) that ranks your lie above the truth. */
  fooled: 60,
  /** Your lie got the most first places. */
  topLie: 100,
  /** The guest's ほんとうだったら いいな pick. */
  wish: 80,
  /** しってた！ Your lie or your guess was the truth. */
  knew: 120,
  /** わかるひとには わかる: some rankers, but not all, put the truth first. */
  guest: 250,
} as const;

/** Speaking bonuses, per item: out loud, or tapped or typed. */
export const SAY = {
  greet: { said: 40, tried: 20, tap: 12 },
  kochira: { said: 10, tap: 3 },
  line: { said: 20, tried: 10, tap: 6 },
  claim: { said: 20, tap: 6 },
  refute: { said: 25, tap: 8 },
  truth: { said: 45, tried: 25, tap: 14 },
  argue: { said: 10, max: 2 },
  recall: { said: 50, tap: 20, guest: 20 },
} as const;

/** How long a line of the introduction waits before Pon reads it, and how fast he reads when the introducer is away. */
export const LINE_MS = 12_000;
export const PON_LINE_MS = 3_500;

export const DURATIONS = {
  intro: 15_000,
  prompt: 12_000,
  /** The guest's first turn: time to write their name in katakana too. */
  promptName: 18_000,
  answer: 40_000,
  encore: 30_000,
  scoreLead: 1_200,
  scoreStep: 2_200,
  /** A held breath before the truth turns. */
  scoreHold: 1_000,
  scoreTail: 6_000,
  finale: 40_000,
} as const;

export const LABELS = ['Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ'] as const;

// ---- state ----

export type Role = 'guest' | 'tanuki' | 'detective';
export type Read = 'said' | 'tried' | 'tap' | 'pon';

export interface Fact {
  id: string;
  kind: 'truth' | 'lie' | 'pon';
  /** Who wrote it (two tanuki who wrote the same lie share it). */
  authors: string[];
  tileId: string | null;
  word: string;
  en: string | null;
  hidden: boolean;
}

export interface Written {
  tileId: string | null;
  word: string;
  en: string | null;
}

export interface Line {
  kind: 'open' | 'card' | 'close';
  factId: string | null;
  read: Read | null;
}

export interface Ranked {
  /** Fact ids, most believed first. */
  order: string[];
  /** Ballots that put the truth first, and how many ballots there were. */
  found: number;
  ballots: number;
  topLie: string | null;
  /** Points and why, per player; paid when the phase ends. */
  points: Record<string, { label: string; pts: number }[]>;
}

export interface Turn {
  index: number;
  guestId: string;
  introducerId: string | null;
  cardId: string;
  roles: Record<string, Role>;
  hands: Record<string, string[]>;
  writes: Record<string, Written>;
  facts: Fact[];
  knew: string[];
  lines: Line[];
  line: number;
  lineAt: number;
  ballots: Record<string, string[]>;
  wish: string | null;
  greet: Read | null;
  kochira: Record<string, Read>;
  argue: Record<string, number>;
  claims: Record<string, Read>;
  refutes: Record<string, Read>;
  truthSaid: Read | null;
  /** Speech bubbles for the TV, newest last. */
  bubbles: { playerId: string; text: string; at: number }[];
  result: Ranked | null;
}

export interface PastTurn {
  guestId: string;
  cardId: string;
  truthId: string;
  facts: { id: string; word: string }[];
}

export interface Stats {
  liePts: number;
  found: number;
  spoken: number;
  /** As a guest: the share of ballots that found them, and their truth's place from the top (0 = most believed). */
  knownShare: number | null;
  truthPlace: number | null;
}

export interface HajimeState {
  guests: string[];
  turnIndex: number;
  turn: Turn | null;
  past: PastTurn[];
  kana: Record<string, string>;
  lieCount: Record<string, number>;
  usedCards: string[];
  cards: number;
  ponJokeUsed: boolean;
  recall: Record<string, Record<number, Read>>;
  stats: Record<string, Stats>;
  phaseAt: number;
}

// ---- view ----

export interface FactView {
  id: string;
  label: string;
  /** The blank's word, once it's on the TV (read in the introduction, or later). */
  word: string | null;
  read: Read | null;
  hidden: boolean;
  /** From the flip on. */
  kind?: Fact['kind'];
  authors?: string[];
  en?: string | null;
  /** The room's place for it (0 = most believed), and when it turns (0 = first). */
  place?: number;
  flip?: number;
  /** Ballots that ranked it first. */
  firsts?: number;
  claimed?: boolean;
  refuted?: boolean;
}

export interface TileView {
  id: string;
  kana: string;
  en: string | null;
  emoji: string;
  romaji?: boolean;
}

export interface HajimeView {
  mode: 'hajimemashite';
  turn: number;
  totalTurns: number;
  phaseAt: number;
  guestId: string | null;
  introducerId: string | null;
  /** The guest's name in katakana (or as typed, before they've written it). */
  guestName: string;
  card: { title: JpText; first: string; third: string; en: string; enThird: string; level: 'n5' | 'n4' } | null;
  facts: FactView[];
  /** The introduction's line now being read. */
  line: { index: number; total: number; kind: Line['kind']; factId: string | null; at: number; ms: number } | null;
  /** Who has written (answer) or ranked (encore). */
  ready: string[];
  waitingOn: number;
  bubbles: { playerId: string; text: string }[];
  result: { order: string[]; found: number; ballots: number; topLie: string | null; wish: string | null; steps: number } | null;
  /** The finale: how many answers are in. */
  recalled: { done: number; total: number } | null;
  me: {
    level: Level;
    role: Role | null;
    name: string;
    nameSuggest: string;
    nameSet: boolean;
    greeted: boolean;
    kochira: boolean;
    hand: TileView[];
    canType: boolean;
    written: Written | null;
    /** The introducer's script, from the reveal on. */
    script: { kind: Line['kind']; text: string; frame: string; word: string; read: Read | null }[] | null;
    scriptAt: number;
    /** The guest's veto list in the reveal (lies not yet read). */
    vetoable: { id: string; word: string }[];
    rankable: { id: string; label: string; word: string }[];
    ballot: string[] | null;
    wishable: { id: string; label: string; word: string }[];
    wish: string | null;
    argued: number;
    /** Score: my lie to claim, the lies to refute (guest), the truth to say (guest). */
    claim: { factId: string; word: string; done: boolean } | null;
    refute: { factId: string; word: string; done: boolean }[];
    truth: { line: string; done: boolean } | null;
    points: { label: string; pts: number }[];
    recall: { turn: number; guestId: string; name: string; frame: string; options: { id: string; word: string }[]; done: Read | null }[];
  } | null;
}

export type HajimeMove =
  | { kind: 'name'; text: string }
  | { kind: 'greet'; utterance: Utterance }
  | { kind: 'kochira'; utterance: Utterance }
  | { kind: 'write'; tileId: string }
  | { kind: 'write'; utterance: Utterance }
  | { kind: 'read'; utterance: Utterance }
  | { kind: 'read'; pon: true }
  | { kind: 'veto'; factId: string }
  | { kind: 'hide'; factId: string }
  | { kind: 'rank'; order: string[] }
  | { kind: 'wish'; factId: string }
  | { kind: 'argue'; utterance: Utterance }
  | { kind: 'claim'; utterance: Utterance }
  | { kind: 'refute'; factId: string; utterance: Utterance }
  | { kind: 'truth'; utterance: Utterance }
  | { kind: 'recall'; turn: number; utterance: Utterance }
  | { kind: 'recall'; turn: number; factId: string };

// ---- helpers ----

const blankStats = (): Stats => ({ liePts: 0, found: 0, spoken: 0, knownShare: null, truthPlace: null });
const stats = (s: HajimeState, id: string) => (s.stats[id] ??= blankStats());
const hasJapanese = (t: string) => /[ぁ-ゖァ-ヺ一-鿿]/.test(t);
const heardOf = (u: Utterance): string => soundKey(utteranceReading(u));
/** Did the utterance carry these kana (compared as sounds)? */
const heardHas = (u: Utterance, kana: string): boolean => {
  const key = soundKey(kana);
  return !!key && (heardOf(u).includes(key) || soundKey(u.text).includes(key));
};

/** The name the TV and the script use: the katakana the player wrote, or a first guess from their name. */
export const nameFor = (s: HajimeState, p: ModePlayer | undefined): string => (p ? (s.kana[p.id] ?? nameToKatakana(p.name)) || p.name : '');

const cardOf = (t: Turn): IntroCard => introCardOf(t.cardId)!;
const factOf = (t: Turn, id: string) => t.facts.find((f) => f.id === id);
const truthOf = (t: Turn) => t.facts.find((f) => f.kind === 'truth');
const keyOf = (w: { tileId: string | null; word: string }): string => normalizeReading(w.word);

/**
 * A typed blank as the TV shows it: romaji to kana, kanji to the reading the server worked out, and the
 * frame's own words cut off if the player typed the whole sentence (「すしが だいすきです」 → すし).
 */
export function typedWord(u: Utterance, card: IntroCard): string | null {
  let text = cleanText(u.text, MAX_ANSWER_LENGTH);
  if (!text) return null;
  text = text.replace(/[。！？!?.、,]+$/g, '').trim();
  if (isRomaji(text)) text = romajiToHiragana(text);
  else if (hasKanji(text) && u.reading) text = u.reading;
  const [before, after] = card.first.split('＿').map((x) => normalizeReading(x));
  const flat = normalizeReading(text);
  if (after && flat.endsWith(after) && flat.length > after.length) text = cutSounds(text, flat.length - after.length);
  if (before && normalizeReading(text).startsWith(before) && normalizeReading(text).length > before.length) text = cutFront(text, before.length);
  text = text.replace(/^[\s、]+|[\s、]+$/g, '');
  return hasJapanese(text) ? text : null;
}

/** The first `n` characters of the reading kept from `text`, counting only the characters normalizeReading keeps. */
function cutSounds(text: string, n: number): string {
  let kept = 0;
  let i = 0;
  const chars = [...text];
  for (; i < chars.length && kept < n; i++) if (normalizeReading(chars[i]!)) kept++;
  return chars.slice(0, i).join('');
}
function cutFront(text: string, n: number): string {
  let kept = 0;
  let i = 0;
  const chars = [...text];
  for (; i < chars.length && kept < n; i++) if (normalizeReading(chars[i]!)) kept++;
  return chars.slice(i).join('');
}

/** Picks the turn's card: one the room hasn't had, that suits the guest's level and the room. */
function pickCard(s: HajimeState, audience: Audience, level: Level, random: () => number): IntroCard {
  const pool = cardsFor(audience, level);
  // N4 guests play the N4 deck first (in every room); Cheeky rooms play the cheeky cards next, then the rest.
  const n4 = level === 'n4' ? [pool.filter((c) => c.level === 'n4')] : [];
  const rest = pool.filter((c) => !(level === 'n4' && c.level === 'n4'));
  const ordered = [...n4, ...(audience === 'cheeky' ? [rest.filter((c) => c.audiences.length === 1), rest.filter((c) => c.audiences.length > 1)] : [rest])];
  for (const group of ordered) {
    const fresh = group.filter((c) => !s.usedCards.includes(c.id));
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)]!;
  }
  return pool[Math.floor(random() * pool.length)]!;
}

function startTurn(s: HajimeState, ctx: ModeContext): void {
  s.turnIndex += 1;
  const random = () => ctx.random();
  const players = ctx.players();
  const guestId = s.guests[s.turnIndex - 1]!;
  const guest = ctx.player(guestId);
  const card = pickCard(s, ctx.audience ?? 'family', guest?.level ?? 'n5', random);
  s.usedCards.push(card.id);
  // The previous guest introduces this one, so the introductions run round the room.
  const prev = s.guests[(s.turnIndex - 2 + s.guests.length) % s.guests.length];
  const introducerId = prev && prev !== guestId && ctx.player(prev) ? prev : (players.find((p) => p.id !== guestId)?.id ?? null);
  // Tanuki: the ones who've written the fewest lies, the rest detectives.
  const others = shuffled(
    players.filter((p) => p.id !== guestId),
    random,
  ).sort((a, b) => (s.lieCount[a.id] ?? 0) - (s.lieCount[b.id] ?? 0));
  const tanuki = others.slice(0, s.cards - 1).map((p) => p.id);
  const roles: Record<string, Role> = { [guestId]: 'guest' };
  for (const p of others) roles[p.id] = tanuki.includes(p.id) ? 'tanuki' : 'detective';
  const deck = shuffled(
    card.tiles.map((t) => t.id),
    random,
  );
  const hands: Record<string, string[]> = {};
  tanuki.forEach((id, i) => (hands[id] = deck.slice(i * HAND, (i + 1) * HAND)));
  s.turn = {
    index: s.turnIndex,
    guestId,
    introducerId,
    cardId: card.id,
    roles,
    hands,
    writes: {},
    facts: [],
    knew: [],
    lines: [],
    line: 0,
    lineAt: 0,
    ballots: {},
    wish: null,
    greet: null,
    kochira: {},
    argue: {},
    claims: {},
    refutes: {},
    truthSaid: null,
    bubbles: [],
    result: null,
  };
}

/** Builds the turn's cards from what was written: merges twin lies, spots lies that were the truth, fills in with Pon's. */
function buildFacts(s: HajimeState, t: Turn, ctx: ModeContext): void {
  const card = cardOf(t);
  const random = () => ctx.random();
  const facts: Fact[] = [];
  const guestWrote = t.writes[t.guestId];
  // A guest who wrote nothing: Pon picks a tile for them, so the turn still plays.
  const truthW: Written = guestWrote ?? (() => {
    const tile = card.tiles[Math.floor(random() * card.tiles.length)]!;
    return { tileId: tile.id, word: tile.kana, en: tile.en };
  })();
  const truthKey = keyOf(truthW);
  facts.push({ id: ctx.newId(), kind: 'truth', authors: [t.guestId], tileId: truthW.tileId, word: truthW.word, en: truthW.en, hidden: false });
  for (const [pid, w] of Object.entries(t.writes)) {
    const role = t.roles[pid];
    if (role === 'guest') continue;
    if (keyOf(w) === truthKey) {
      t.knew.push(pid);
      continue;
    }
    if (role !== 'tanuki') continue;
    const twin = facts.find((f) => f.kind === 'lie' && keyOf(f) === keyOf(w));
    if (twin) twin.authors.push(pid);
    else facts.push({ id: ctx.newId(), kind: 'lie', authors: [pid], tileId: w.tileId, word: w.word, en: w.en, hidden: false });
  }
  for (const pid of Object.keys(t.hands)) if (t.writes[pid]) s.lieCount[pid] = (s.lieCount[pid] ?? 0) + 1;
  // Short a lie or two: Pon's, from tiles nobody holds, so they look like any other card.
  while (facts.length < s.cards) {
    const fill = ponFill(s, t, facts, ctx);
    if (!fill) break;
    facts.push(fill);
  }
  t.facts = shuffled(facts, random);
  t.lines = [{ kind: 'open', factId: null, read: null }, ...t.facts.map((f) => ({ kind: 'card' as const, factId: f.id, read: null })), { kind: 'close', factId: null, read: null }];
  t.line = 0;
}

function ponFill(s: HajimeState, t: Turn, facts: readonly Fact[], ctx: ModeContext): Fact | null {
  const card = cardOf(t);
  const taken = new Set(facts.map((f) => keyOf(f)));
  const held = new Set(Object.values(t.hands).flat());
  // In a 3-player room, once a game, Pon's own joke lie (labelled his at the flip anyway).
  if (ctx.players().length <= 3 && !s.ponJokeUsed && !taken.has(keyOf({ tileId: null, word: card.pon.kana }))) {
    s.ponJokeUsed = true;
    return { id: ctx.newId(), kind: 'pon', authors: [], tileId: card.pon.id, word: card.pon.kana, en: card.pon.en, hidden: false };
  }
  const free = card.tiles.filter((x) => !taken.has(keyOf({ tileId: x.id, word: x.kana })));
  const pool = free.filter((x) => !held.has(x.id));
  const pickFrom = pool.length ? pool : free;
  const tile = pickFrom[Math.floor(ctx.random() * pickFrom.length)];
  return tile ? { id: ctx.newId(), kind: 'pon', authors: [], tileId: tile.id, word: tile.kana, en: tile.en, hidden: false } : null;
}

const bubble = (t: Turn, playerId: string, text: string, now: number) => {
  t.bubbles.push({ playerId, text, at: now });
  if (t.bubbles.length > 6) t.bubbles.shift();
};

const lineText = (s: HajimeState, t: Turn, line: Line, ctx: ModeContext): string => {
  const name = nameFor(s, ctx.player(t.guestId));
  if (line.kind === 'open') return `こちらは ${name}さんです。`;
  if (line.kind === 'close') return `${name}さんを どうぞ よろしく おねがいします！`;
  const f = line.factId ? factOf(t, line.factId) : undefined;
  return f ? fillFrame(cardOf(t).third, f.word, name) : '';
};

/** Pon reads the current line (the reader gave up, ran out of time, or isn't here), then the next one starts. */
function ponReads(s: HajimeState, t: Turn, ctx: ModeContext): void {
  const line = t.lines[t.line];
  if (!line) return;
  line.read = 'pon';
  ctx.cue({ host: 'pon', event: 'hajime_read', slots: { line: lineText(s, t, line, ctx) } });
  t.line += 1;
  t.lineAt = ctx.now;
}

const introducerHere = (t: Turn, ctx: ModeContext): boolean => !!t.introducerId && ctx.connected().some((p) => p.id === t.introducerId);

/** Who ranks this turn: everyone but the guest, each leaving their own lie off. */
const rankersOf = (t: Turn, ctx: ModeContext) => ctx.players().filter((p) => p.id !== t.guestId);
const rankableFor = (t: Turn, playerId: string): Fact[] => t.facts.filter((f) => !f.authors.includes(playerId) || f.kind === 'truth');

function rankTurn(s: HajimeState, t: Turn, ctx: ModeContext): Ranked {
  const points: Ranked['points'] = {};
  const add = (pid: string, label: string, pts: number) => {
    if (pts <= 0 || !ctx.player(pid)) return;
    (points[pid] ??= []).push({ label, pts });
  };
  const truth = truthOf(t)!;
  const ballots = Object.entries(t.ballots).filter(([pid]) => ctx.player(pid));
  // The room's order for the show: each card's average place across the ballots that hold it.
  const mean = new Map<string, number>();
  const firsts = new Map<string, number>();
  for (const f of t.facts) {
    const places = ballots.filter(([, b]) => b.includes(f.id)).map(([, b]) => b.indexOf(f.id) / Math.max(1, b.length - 1));
    mean.set(f.id, places.length ? places.reduce((a, b) => a + b, 0) / places.length : 0.5);
    firsts.set(f.id, ballots.filter(([, b]) => b[0] === f.id).length);
  }
  const order = [...t.facts].sort((a, b) => mean.get(a.id)! - mean.get(b.id)! || firsts.get(b.id)! - firsts.get(a.id)!).map((f) => f.id);
  let found = 0;
  for (const [pid, b] of ballots) {
    const at = b.indexOf(truth.id);
    if (at === 0) {
      found += 1;
      stats(s, pid).found += 1;
    }
    const pts = POINTS.rank[at] ?? 0;
    if (pts) add(pid, at === 0 ? 'You picked the truth first' : `The truth was your #${at + 1}`, pts);
    // Each lie above the truth on this ballot pays its tanuki.
    for (const id of b.slice(0, Math.max(0, at))) {
      const f = factOf(t, id);
      if (!f || f.kind !== 'lie' || f.hidden) continue;
      for (const a of f.authors) if (a !== pid) add(a, `Fooled ${ctx.player(pid)?.name ?? ''}`, POINTS.fooled);
    }
  }
  // The most believed lie: the most first places, then the best average.
  const top = [...t.facts].filter((f) => (firsts.get(f.id) ?? 0) > 0).sort((a, b) => firsts.get(b.id)! - firsts.get(a.id)! || mean.get(a.id)! - mean.get(b.id)!)[0];
  const topLie = top && top.kind !== 'truth' ? top.id : null;
  if (top && top.kind === 'lie' && !top.hidden) for (const a of top.authors) add(a, 'The room’s favourite card', POINTS.topLie);
  const wish = t.wish ? factOf(t, t.wish) : undefined;
  if (wish && wish.kind === 'lie' && !wish.hidden) for (const a of wish.authors) add(a, `${ctx.player(t.guestId)?.name ?? 'The guest'} wishes it were true`, POINTS.wish);
  for (const pid of t.knew) add(pid, 'しってた！ You knew the truth', POINTS.knew);
  if (ballots.length && found > 0 && found < ballots.length) add(t.guestId, 'わかるひとには わかる: some knew you', POINTS.guest);
  for (const [pid, list] of Object.entries(points)) {
    const fromLies = list.filter((x) => x.label.startsWith('Fooled') || x.label.startsWith('The room') || x.label.includes('wishes')).reduce((a, x) => a + x.pts, 0);
    stats(s, pid).liePts += fromLies;
  }
  const g = stats(s, t.guestId);
  g.knownShare = ballots.length ? found / ballots.length : null;
  g.truthPlace = order.indexOf(truth.id);
  return { order, found, ballots: ballots.length, topLie, points };
}

function phrases(s: HajimeState, t: Turn, ctx: ModeContext): void {
  const card = cardOf(t);
  const truth = truthOf(t);
  const name = nameFor(s, ctx.player(t.guestId));
  if (truth && ctx.player(t.guestId)) {
    const line = fillFrame(card.first, truth.word);
    ctx.phrase(t.guestId, { itemId: `hajime:${card.id}:first`, text: line, kana: line, en: card.en.replace('___', truth.en ?? '…'), outcome: t.truthSaid === 'said' ? 'said' : 'seen' });
  }
  for (const p of ctx.players()) {
    const greet = `はじめまして。${nameFor(s, p)}です。よろしく おねがいします。`;
    if (p.id === t.guestId) ctx.phrase(p.id, { itemId: 'hajime:greet', text: greet, kana: greet, en: "Nice to meet you. I'm …. Please treat me kindly.", outcome: t.greet === 'said' ? 'said' : 'seen' });
    else {
      const k = 'こちらこそ、よろしく おねがいします。';
      ctx.phrase(p.id, { itemId: 'hajime:kochira', text: k, kana: k, en: 'Likewise, nice to meet you (こちらこそ: "the same from me").', outcome: t.kochira[p.id] === 'said' ? 'said' : 'seen' });
    }
    if (p.id === t.introducerId && truth) {
      const line = fillFrame(card.third, truth.word, name);
      ctx.phrase(p.id, { itemId: `hajime:${card.id}:third`, text: line, kana: line, en: card.enThird.replace('{name}', ctx.player(t.guestId)?.name ?? 'They').replace('___', truth.en ?? '…'), outcome: t.lines.some((l) => l.read === 'said') ? 'said' : 'seen' });
    }
  }
}

const hostName = (s: HajimeState, ctx: ModeContext, id: string | null | undefined) => (id ? nameFor(s, ctx.player(id)) : '');

/** How long the flip takes on the TV: a lead-in, then one card every step. */
export const flipMs = (cards: number): number => DURATIONS.scoreLead + DURATIONS.scoreStep * cards + DURATIONS.scoreHold;
/** When card number `step` (0 first) of `cards` turns: the lies at a steady pace, then a held breath, then the truth. */
export const flipAt = (step: number, cards: number): number => DURATIONS.scoreLead + DURATIONS.scoreStep * step + (step >= cards - 1 ? DURATIONS.scoreHold : 0);

// ---- the mode ----

export const hajimemashiteMode: Mode<HajimeState, HajimeView> = {
  info: {
    id: 'hajimemashite',
    title: 'Nice to Meet You!',
    titleJa: 'はじめまして！',
    blurb: 'Write one true thing about yourself; the others write lies. Your neighbour introduces you, and the room ranks what’s true.',
    host: 'pon',
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your introductions',
    extras: [
      { key: 'short', label: 'みじかめ: 4 guests only' },
      { key: 'five', label: '5まい: five cards a turn' },
    ],
    phaseLabels: { prompt: 'Tonight’s guest', answer: 'Write', reveal: 'Introduction', encore: 'Rank it', score: 'The truth', finale: 'おぼえてる？' },
  },

  setup(ctx, opts) {
    const players = ctx.players();
    let guests = players.map((p) => p.id);
    if (opts.extra?.short === true && guests.length > SHORT_GUESTS) {
      const picked = new Set(shuffled(guests, () => ctx.random()).slice(0, SHORT_GUESTS));
      guests = guests.filter((id) => picked.has(id));
    }
    const all: Record<string, Stats> = {};
    for (const p of players) all[p.id] = blankStats();
    return {
      guests,
      turnIndex: 0,
      turn: null,
      past: [],
      kana: {},
      lieCount: {},
      usedCards: [],
      cards: opts.extra?.five === true ? CARDS_FIVE : CARDS,
      ponJokeUsed: false,
      recall: {},
      stats: all,
      phaseAt: ctx.now,
    };
  },

  next(s, from, ctx) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return 'encore';
      case 'encore':
        return 'score';
      case 'score':
        if (s.guests.slice(s.turnIndex).some((id) => ctx.player(id))) return 'prompt';
        return s.past.length > 1 ? 'finale' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    const t = s.turn;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'pon', event: 'hajime_intro' });
        break;
      case 'prompt': {
        // A guest who left: skip on to one who's here.
        while (s.turnIndex < s.guests.length - 1 && !ctx.player(s.guests[s.turnIndex]!)) s.turnIndex += 1;
        startTurn(s, ctx);
        ctx.cue({ host: 'pon', event: 'hajime_guest', slots: { name: hostName(s, ctx, s.turn!.guestId) } });
        break;
      }
      case 'answer':
        ctx.cue({ host: 'pon', event: 'hajime_write' });
        break;
      case 'reveal':
        if (!t) break;
        buildFacts(s, t, ctx);
        t.lineAt = ctx.now;
        if (introducerHere(t, ctx)) ctx.cue({ host: 'pon', event: 'hajime_introduce', slots: { name: hostName(s, ctx, t.introducerId) } });
        break;
      case 'encore':
        // Anything the introduction didn't reach goes up now.
        if (t) for (const l of t.lines) l.read ??= 'pon';
        ctx.cue({ host: 'pon', event: 'hajime_rank' });
        break;
      case 'score': {
        if (!t) break;
        t.result = rankTurn(s, t, ctx);
        const truthId = truthOf(t)!.id;
        const top = t.result.topLie ? factOf(t, t.result.topLie) : undefined;
        if (t.result.order[0] === truthId) ctx.cue({ host: 'pon', event: 'hajime_known', slots: { name: hostName(s, ctx, t.guestId) } });
        else if (top?.kind === 'lie') ctx.cue({ host: 'pon', event: 'hajime_top_lie', slots: { author: hostName(s, ctx, top.authors[0]) } });
        else if (top?.kind === 'pon') ctx.cue({ host: 'pon', event: 'hajime_pon_win' });
        else ctx.cue({ host: 'pon', event: 'hajime_truth' });
        phrases(s, t, ctx);
        break;
      }
      case 'finale':
        ctx.cue({ host: 'pon', event: 'hajime_recall' });
        break;
    }
  },

  leave(s, phase, ctx) {
    const t = s.turn;
    if (phase === 'score' && t?.result) {
      for (const [pid, list] of Object.entries(t.result.points)) {
        const n = list.reduce((a, x) => a + x.pts, 0);
        if (n) ctx.award(pid, n);
      }
      const truth = truthOf(t);
      if (truth) s.past.push({ guestId: t.guestId, cardId: t.cardId, truthId: truth.id, facts: t.facts.map((f) => ({ id: f.id, word: f.word })) });
    }
  },

  duration(s, phase, ctx) {
    const t = s.turn;
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt': {
        const guest = s.guests[s.turnIndex - 1];
        return guest && !s.kana[guest] ? DURATIONS.promptName : DURATIONS.prompt;
      }
      case 'answer':
        return DURATIONS.answer;
      case 'reveal':
        // Every line at its longest, plus a beat; it ends as soon as the last line is read.
        return 3_000 + (t ? t.lines.length : s.cards + 2) * (t && !introducerHere(t, ctx) ? PON_LINE_MS : LINE_MS);
      case 'encore':
        return DURATIONS.encore;
      case 'score':
        return flipMs(t ? t.facts.length : s.cards) + DURATIONS.scoreTail;
      case 'finale':
        return DURATIONS.finale;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const t = s.turn;
    const here = ctx.connected();
    if (!t || !here.length) return false;
    switch (phase) {
      case 'prompt': {
        // The guest has greeted and everyone here has answered こちらこそ.
        const guestHere = here.some((p) => p.id === t.guestId);
        return (!guestHere || !!t.greet) && here.every((p) => p.id === t.guestId || !!t.kochira[p.id]);
      }
      case 'answer':
        return here.every((p) => !!t.writes[p.id]);
      case 'reveal':
        return t.line >= t.lines.length;
      case 'encore': {
        const ranked = here.filter((p) => p.id !== t.guestId).every((p) => !!t.ballots[p.id]);
        const guestHere = here.some((p) => p.id === t.guestId);
        const lies = t.facts.some((f) => f.kind !== 'truth' && !f.hidden);
        return ranked && (!guestHere || !lies || !!t.wish);
      }
      case 'finale':
        return here.every((p) => s.past.every((pt, i) => pt.guestId === p.id || !ctx.player(pt.guestId) || !!s.recall[p.id]?.[i]));
      default:
        return false;
    }
  },

  wakeAt(s, phase, ctx) {
    const t = s.turn;
    if (phase !== 'reveal' || !t || t.line >= t.lines.length) return null;
    return t.lineAt + (introducerHere(t, ctx) ? LINE_MS : PON_LINE_MS);
  },

  wake(s, phase, ctx) {
    const t = s.turn;
    if (phase !== 'reveal' || !t || t.line >= t.lines.length) return;
    if (ctx.now < t.lineAt + (introducerHere(t, ctx) ? LINE_MS : PON_LINE_MS)) return;
    ponReads(s, t, ctx);
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.turn !== undefined && raw.kind !== 'recall' && raw.turn !== s.turnIndex) return moveError('wrong-phase');
    const t = s.turn;
    if (!t) return moveError('wrong-phase');
    const player = ctx.player(playerId)!;
    const role = t.roles[playerId] ?? null;
    const card = cardOf(t);
    const utter = (): Utterance | null => {
      if (!isUtterance(raw.utterance)) return null;
      const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
      return text ? { ...raw.utterance, text } : null;
    };
    const spoken = (u: Utterance) => {
      if (u.via === 'speech') stats(s, playerId).spoken += 1;
    };
    switch (raw.kind) {
      case 'name': {
        if (phase !== 'prompt' || playerId !== t.guestId) return moveError('wrong-phase');
        const text = cleanText(raw.text, 12);
        if (!text || !/^[ァ-ヺー・ぁ-ゖ]+$/.test(text)) return moveError('not-katakana');
        s.kana[playerId] = text.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
        return MOVE_OK;
      }
      case 'greet': {
        if (phase !== 'prompt' || playerId !== t.guestId) return moveError('wrong-phase');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (t.greet === 'said') return MOVE_OK;
        const read: Read = u.via !== 'speech' ? 'tap' : heardHas(u, 'はじめまして') || heardHas(u, 'よろしく') ? 'said' : 'tried';
        if (t.greet && read !== 'said') return MOVE_OK;
        const pts = SAY.greet[read === 'said' ? 'said' : read === 'tried' ? 'tried' : 'tap'] - (t.greet ? SAY.greet[t.greet === 'tried' ? 'tried' : 'tap'] : 0);
        t.greet = read;
        if (pts > 0) ctx.award(playerId, pts);
        spoken(u);
        bubble(t, playerId, 'はじめまして！', ctx.now);
        return MOVE_OK;
      }
      case 'kochira': {
        if (phase !== 'prompt' || playerId === t.guestId) return moveError('wrong-phase');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (t.kochira[playerId]) return MOVE_OK;
        const said = u.via === 'speech' && hasJapanese(u.reading ?? u.text);
        t.kochira[playerId] = said ? 'said' : 'tap';
        ctx.award(playerId, said ? SAY.kochira.said : SAY.kochira.tap);
        spoken(u);
        bubble(t, playerId, player.level === 'kana' ? 'よろしく！' : 'こちらこそ！', ctx.now);
        return MOVE_OK;
      }
      case 'write': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!role) return moveError('not-playing');
        if (typeof raw.tileId === 'string') {
          const allowed = role === 'tanuki' ? (t.hands[playerId] ?? []) : card.tiles.map((x) => x.id);
          if (!allowed.includes(raw.tileId)) return moveError('bad-tile');
          const tile = tileOf(raw.tileId)!;
          t.writes[playerId] = { tileId: tile.id, word: tile.kana, en: tile.en };
          return MOVE_OK;
        }
        if (role === 'tanuki' && tilesOnly(card, ctx.audience ?? 'family')) return moveError('tiles-only');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        const word = typedWord(u, card);
        if (!word) return moveError('not-japanese');
        if ([...word].length > MAX_WORD) return moveError('too-long');
        if (!playerTextAllowed(word, ctx.audience)) return moveError('kids-words');
        // A typed word that is one of the card's tiles is that tile (so twins and the truth match).
        const tile = card.tiles.find((x) => normalizeReading(x.kana) === normalizeReading(word));
        t.writes[playerId] = tile ? { tileId: tile.id, word: tile.kana, en: tile.en } : { tileId: null, word, en: null };
        return MOVE_OK;
      }
      case 'read': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        if (playerId !== t.introducerId) return moveError('not-yours');
        const line = t.lines[t.line];
        if (!line) return MOVE_OK;
        if (raw.pon === true) {
          ponReads(s, t, ctx);
          return MOVE_OK;
        }
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (!playerTextAllowed(u.text, ctx.audience)) return moveError('kids-words');
        const fact = line.factId ? factOf(t, line.factId) : undefined;
        const want = line.kind === 'open' ? 'こちら' : line.kind === 'close' ? 'よろしく' : (fact?.word ?? '');
        line.read = u.via !== 'speech' ? 'tap' : heardHas(u, want) ? 'said' : 'tried';
        ctx.award(playerId, SAY.line[line.read]);
        spoken(u);
        t.line += 1;
        t.lineAt = ctx.now;
        return MOVE_OK;
      }
      case 'veto':
      case 'hide': {
        if (phase !== 'reveal' && !(raw.kind === 'hide' && phase === 'encore')) return moveError('wrong-phase');
        if (raw.kind === 'veto' ? playerId !== t.guestId : ctx.vipId !== playerId) return moveError(raw.kind === 'veto' ? 'not-yours' : 'not-vip');
        const f = typeof raw.factId === 'string' ? factOf(t, raw.factId) : undefined;
        if (!f || f.kind === 'truth') return moveError('unknown-card');
        const at = t.lines.findIndex((l) => l.factId === f.id);
        if (phase === 'reveal' && at >= 0 && at < t.line && raw.kind === 'veto') return moveError('already-read');
        if (phase === 'reveal' && at >= t.line) {
          // Not read yet: swap it for one of Pon's, so the line-up still has its cards.
          const fill = ponFill(s, t, t.facts, ctx);
          if (fill) {
            fill.id = f.id;
            Object.assign(f, fill);
            return MOVE_OK;
          }
        }
        f.hidden = true;
        return MOVE_OK;
      }
      case 'rank': {
        if (phase !== 'encore') return moveError('wrong-phase');
        if (playerId === t.guestId || !role) return moveError('not-playing');
        const order = raw.order;
        const want = rankableFor(t, playerId).map((f) => f.id);
        if (!Array.isArray(order) || order.length !== want.length || new Set(order).size !== want.length || !order.every((id) => typeof id === 'string' && want.includes(id))) return moveError('bad-move');
        t.ballots[playerId] = order as string[];
        return MOVE_OK;
      }
      case 'wish': {
        if (phase !== 'encore' || playerId !== t.guestId) return moveError('wrong-phase');
        const f = typeof raw.factId === 'string' ? factOf(t, raw.factId) : undefined;
        if (!f || f.kind === 'truth') return moveError('unknown-card');
        t.wish = f.id;
        return MOVE_OK;
      }
      case 'argue': {
        if (phase !== 'encore') return moveError('wrong-phase');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (!playerTextAllowed(u.text, ctx.audience)) return moveError('kids-words');
        const n = t.argue[playerId] ?? 0;
        t.argue[playerId] = n + 1;
        if (u.via === 'speech' && n < SAY.argue.max && hasJapanese(u.reading ?? u.text)) {
          ctx.award(playerId, SAY.argue.said);
          spoken(u);
        }
        bubble(t, playerId, u.text, ctx.now);
        return MOVE_OK;
      }
      case 'claim': {
        if (phase !== 'score') return moveError('wrong-phase');
        const mine = t.facts.find((f) => f.kind === 'lie' && f.authors.includes(playerId) && !f.hidden);
        if (!mine) return moveError('not-yours');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (t.claims[playerId]) return MOVE_OK;
        const said = u.via === 'speech' && hasJapanese(u.reading ?? u.text);
        t.claims[playerId] = said ? 'said' : 'tap';
        ctx.award(playerId, said ? SAY.claim.said : SAY.claim.tap);
        spoken(u);
        bubble(t, playerId, 'ドロン！　わたしでした！', ctx.now);
        return MOVE_OK;
      }
      case 'refute': {
        if (phase !== 'score' || playerId !== t.guestId) return moveError('wrong-phase');
        const f = typeof raw.factId === 'string' ? factOf(t, raw.factId) : undefined;
        if (!f || f.kind === 'truth') return moveError('unknown-card');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (t.refutes[f.id]) return MOVE_OK;
        const said = u.via === 'speech' && hasJapanese(u.reading ?? u.text);
        t.refutes[f.id] = said ? 'said' : 'tap';
        ctx.award(playerId, said ? SAY.refute.said : SAY.refute.tap);
        spoken(u);
        bubble(t, playerId, `${f.word}？　ちがいます！`, ctx.now);
        return MOVE_OK;
      }
      case 'truth': {
        if (phase !== 'score' || playerId !== t.guestId) return moveError('wrong-phase');
        const u = utter();
        if (!u) return moveError('bad-utterance');
        if (t.truthSaid === 'said') return MOVE_OK;
        const truth = truthOf(t)!;
        const read: Read = u.via !== 'speech' ? 'tap' : heardHas(u, truth.word) ? 'said' : 'tried';
        const before = t.truthSaid ? SAY.truth[t.truthSaid === 'tried' ? 'tried' : 'tap'] : 0;
        const now = SAY.truth[read === 'said' ? 'said' : read === 'tried' ? 'tried' : 'tap'];
        if (now <= before) return MOVE_OK;
        t.truthSaid = read;
        ctx.award(playerId, now - before);
        spoken(u);
        bubble(t, playerId, `ほんとうです！ ${fillFrame(card.first, truth.word)}`, ctx.now);
        return MOVE_OK;
      }
      case 'recall': {
        if (phase !== 'finale') return moveError('wrong-phase');
        const i = raw.turn;
        const past = typeof i === 'number' ? s.past[i] : undefined;
        if (!past || past.guestId === playerId) return moveError('bad-move');
        const mine = (s.recall[playerId] ??= {});
        if (mine[i as number]) return MOVE_OK;
        let right = false;
        let read: Read;
        if (typeof raw.factId === 'string') {
          if (!past.facts.some((f) => f.id === raw.factId)) return moveError('unknown-card');
          right = raw.factId === past.truthId;
          read = 'tap';
        } else {
          const u = utter();
          if (!u) return moveError('bad-utterance');
          const truth = past.facts.find((f) => f.id === past.truthId)!;
          right = heardHas(u, truth.word);
          read = u.via === 'speech' ? 'said' : 'tap';
          spoken(u);
        }
        mine[i as number] = right ? read : 'tried';
        if (right) {
          ctx.award(playerId, read === 'said' ? SAY.recall.said : SAY.recall.tap);
          if (ctx.player(past.guestId)) ctx.award(past.guestId, SAY.recall.guest);
        }
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const t = s.turn;
    if (!t) return;
    delete t.ballots[playerId];
    delete t.writes[playerId];
    delete t.hands[playerId];
    if (t.introducerId === playerId) t.introducerId = null;
  },

  progress(s) {
    return { round: s.turnIndex, totalRounds: s.guests.length };
  },

  view(s, phase: Phase, viewer: Viewer, ctx) {
    const t = s.turn;
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const card = t ? cardOf(t) : undefined;
    const guest = t ? ctx.player(t.guestId) : undefined;
    const guestName = nameFor(s, guest);
    const flipped = !!t?.result && phase === 'score';
    const linesShown = phase === 'reveal' || phase === 'encore' || phase === 'score';
    const lineOf = (id: string) => t?.lines.find((l) => l.factId === id);

    const showOrder = t?.result ? [...t.result.order].reverse().filter((id) => factOf(t, id)?.kind !== 'truth') : [];
    const facts: FactView[] =
      t && linesShown
        ? t.facts.map((f, i) => {
            const read = lineOf(f.id)?.read ?? null;
            const v: FactView = { id: f.id, label: LABELS[i] ?? String(i + 1), word: read || phase !== 'reveal' ? (f.hidden ? '[hidden]' : f.word) : null, read, hidden: f.hidden };
            if (flipped && t.result) {
              const place = t.result.order.indexOf(f.id);
              v.kind = f.kind;
              v.authors = f.authors;
              v.en = f.en;
              v.place = place;
              // The lies from least to most believed, then the truth, always last.
              v.flip = f.kind === 'truth' ? t.facts.length - 1 : showOrder.indexOf(f.id);
              v.firsts = Object.values(t.ballots).filter((b) => b[0] === f.id).length;
              v.claimed = f.authors.some((a) => !!t.claims[a]);
              v.refuted = !!t.refutes[f.id];
            }
            return v;
          })
        : [];

    const here = ctx.connected();
    let ready: string[] = [];
    let waitingOn = 0;
    if (t && phase === 'answer') {
      ready = Object.keys(t.writes);
      waitingOn = here.filter((p) => !t.writes[p.id]).length;
    } else if (t && phase === 'encore') {
      ready = Object.keys(t.ballots);
      waitingOn = here.filter((p) => p.id !== t.guestId && !t.ballots[p.id]).length;
    }

    const recent = t ? t.bubbles.filter((b) => b.at >= s.phaseAt && ctx.now - b.at < 6_000).slice(-4).map((b) => ({ playerId: b.playerId, text: b.text })) : [];
    const recallTotal = s.past.length ? here.reduce((a, p) => a + s.past.filter((pt) => pt.guestId !== p.id && ctx.player(pt.guestId)).length, 0) : 0;
    const recallDone = here.reduce((a, p) => a + Object.keys(s.recall[p.id] ?? {}).length, 0);

    let mine: HajimeView['me'] = null;
    if (me) {
      const role = t?.roles[me.id] ?? null;
      const romaji = me.level === 'kana';
      const tile = (x: Tile): TileView => ({ id: x.id, kana: x.kana, en: me.level === 'n4' ? null : x.en, emoji: x.emoji, ...(romaji ? { romaji: true } : {}) });
      const handIds = t && card ? (role === 'tanuki' ? (t.hands[me.id] ?? []) : role ? card.tiles.map((x) => x.id) : []) : [];
      const isIntroducer = !!t && t.introducerId === me.id && phase === 'reveal';
      const myLie = t?.facts.find((f) => f.kind === 'lie' && f.authors.includes(me.id) && !f.hidden);
      const truth = t ? truthOf(t) : undefined;
      mine = {
        level: me.level,
        role,
        name: nameFor(s, me),
        nameSuggest: nameToKatakana(me.name),
        nameSet: !!s.kana[me.id],
        greeted: !!t?.greet,
        kochira: !!t?.kochira[me.id],
        hand: t && phase === 'answer' ? handIds.map((id) => tile(tileOf(id)!)) : [],
        canType: !!t && !!card && phase === 'answer' && !(role === 'tanuki' && tilesOnly(card, ctx.audience ?? 'family')),
        written: t?.writes[me.id] ?? null,
        script:
          isIntroducer && t && card
            ? t.lines.map((l) => {
                const f = l.factId ? factOf(t, l.factId) : undefined;
                return { kind: l.kind, text: lineText(s, t, l, ctx), frame: l.kind === 'card' ? card.third.replace('{name}', guestName) : '', word: f?.word ?? '', read: l.read };
              })
            : null,
        scriptAt: isIntroducer && t ? t.line : -1,
        vetoable:
          t && phase === 'reveal' && me.id === t.guestId
            ? t.facts.filter((f) => f.kind === 'lie' && !f.hidden && t.lines.findIndex((l) => l.factId === f.id) >= t.line).map((f) => ({ id: f.id, word: f.word }))
            : [],
        rankable:
          t && phase === 'encore' && role && me.id !== t.guestId
            ? rankableFor(t, me.id).map((f) => ({ id: f.id, label: LABELS[t.facts.indexOf(f)] ?? '', word: f.hidden ? '[hidden]' : f.word }))
            : [],
        ballot: t?.ballots[me.id] ?? null,
        wishable:
          t && phase === 'encore' && me.id === t.guestId ? t.facts.filter((f) => f.kind !== 'truth' && !f.hidden).map((f) => ({ id: f.id, label: LABELS[t.facts.indexOf(f)] ?? '', word: f.word })) : [],
        wish: t?.wish ?? null,
        argued: t?.argue[me.id] ?? 0,
        claim: t && flipped && myLie ? { factId: myLie.id, word: myLie.word, done: !!t.claims[me.id] } : null,
        refute: t && flipped && me.id === t.guestId ? t.facts.filter((f) => f.kind !== 'truth' && !f.hidden).map((f) => ({ factId: f.id, word: f.word, done: !!t.refutes[f.id] })) : [],
        truth: t && flipped && me.id === t.guestId && truth && card ? { line: `ほんとうです！ ${fillFrame(card.first, truth.word)}`, done: t.truthSaid === 'said' } : null,
        points: t?.result && flipped ? (t.result.points[me.id] ?? []) : [],
        recall:
          phase === 'finale'
            ? s.past
                .map((pt, i) => ({ pt, i }))
                .filter(({ pt }) => pt.guestId !== me.id && ctx.player(pt.guestId))
                .map(({ pt, i }) => {
                  const c = introCardOf(pt.cardId)!;
                  const name = nameFor(s, ctx.player(pt.guestId));
                  return { turn: i, guestId: pt.guestId, name, frame: c.third.replace('{name}', name), options: pt.facts, done: s.recall[me.id]?.[i] ?? null };
                })
            : [],
      };
    }

    return {
      mode: 'hajimemashite',
      turn: s.turnIndex,
      totalTurns: s.guests.length,
      phaseAt: s.phaseAt,
      guestId: t?.guestId ?? null,
      introducerId: t?.introducerId ?? null,
      guestName,
      card: card ? { title: card.title, first: card.first, third: card.third.replace('{name}', guestName), en: card.en, enThird: card.enThird.replace('{name}', guest?.name ?? guestName), level: card.level } : null,
      facts,
      line:
        t && phase === 'reveal' && t.line < t.lines.length
          ? { index: t.line, total: t.lines.length, kind: t.lines[t.line]!.kind, factId: t.lines[t.line]!.factId, at: t.lineAt, ms: introducerHere(t, ctx) ? LINE_MS : PON_LINE_MS }
          : null,
      ready,
      waitingOn,
      bubbles: recent,
      result: t?.result && flipped ? { order: t.result.order, found: t.result.found, ballots: t.result.ballots, topLie: t.result.topLie, wish: t.wish, steps: t.facts.length } : null,
      recalled: phase === 'finale' ? { done: recallDone, total: recallTotal } : null,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: Stats) => number | null, min = 0): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = min;
      for (const p of players) {
        const v = f(stats(s, p.id));
        if (v !== null && v > val) [top, val] = [p, v];
      }
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best((st) => st.liePts), 'たぬき賞', 'Best Tanuki: the most points from lies');
    add(best((st) => st.found), 'めいたんてい賞', 'Great Detective: picked the most truths first');
    add(best((st) => st.knownShare), 'らしさ賞', 'So You: the guest the room knew best');
    add(best((st) => st.truthPlace), 'なぞの ゲスト賞', 'Mystery Guest: the truth nobody believed');
    add(best((st) => st.spoken), 'いいこえ賞', 'Best Voice: the most lines said out loud');
    return out;
  },
};
