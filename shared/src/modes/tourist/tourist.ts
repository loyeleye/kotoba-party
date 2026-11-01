// Who's the Tourist? (かんこうきゃくは だれ？): Spyfall-style social deduction in simple Japanese.
// Host: Chōchin-san. See docs/modes/tourist.md for the rules in prose.
//
// Every player but one sees the secret place (駅, 温泉, コンビニ …) and a role there. The tourist
// sees only the list of possible places. Players take turns asking each other questions out loud,
// in simple Japanese; the answerer answers out loud and logs it on their phone. The stage shows the
// Q&A as text with English subtitles. Anyone may call a vote (once per round); the tourist may
// guess the place at any moment.
//
// Each round:
//   prompt  your card: the place and your role, or "you're the tourist" (tap Got it)
//   answer  one question turn: the asker picks someone and asks; they answer. Repeats.
//   reveal  the vote: called by a player (needs a majority) or at the end of the round (most votes)
//   encore  last chance: a caught tourist may still guess the place
//   score   who the tourist was, where we were, and the round's points

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { toRomaji } from '../../japanese/romaji.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { findLine, hasJapanese, matchLine, namesPlace } from './check.js';
import { ALL_LINES, BLUFFS, PLACES, QUESTIONS, SAFE_ANSWERS, TOURIST_ROLE, type Kind, type Line, type Place } from './places.js';

// ---- tuning ----

export const TOTAL_ROUNDS = 3;
/** Places shown each round (the secret one among them). */
export const CHOICES = 6;
/** Locals win: each local. */
export const WIN_POINTS = 100;
/** A local who voted for the tourist in the vote that decided the round. */
export const SHARP_EYE_POINTS = 100;
/** The local who called the vote that caught the tourist. */
export const CALLER_POINTS = 100;
/** The tourist survives the round (no catch, or the wrong person voted out). */
export const ESCAPE_POINTS = 300;
/** The tourist names the place mid-round. */
export const GUESS_POINTS = 400;
/** A caught tourist's right last-chance guess. */
export const LAST_CHANCE_POINTS = 150;
/** Speaking bonuses: asking, by how it was said. From the bonus pool. */
export const ASK_BONUS = { own: { speech: 40, typed: 20 }, frame: { speech: 20, typed: 10 } } as const;
/** Speaking bonuses: answering. From the bonus pool. */
export const ANSWER_BONUS = { own: { speech: 30, typed: 15 }, frame: { speech: 15, typed: 5 } } as const;
/** Saying the guess (ここは えきですか？) rather than only tapping it. From the bonus pool. */
export const GUESS_BONUS = { speech: 20, typed: 10 } as const;
/** Every speaking bonus comes from one pool per player per round: 30% of a round's top win. */
export const BONUS_POOL_SHARE = 0.3;
export const ROUND_STAKE = WIN_POINTS + SHARP_EYE_POINTS + CALLER_POINTS;
const COMEBACK = 1.5;
/** A round ends with a final vote after this long, whatever the turn count. */
export const ROUND_CAP_MS = 6 * 60_000;

export const DURATIONS = {
  intro: 18_000,
  card: 20_000,
  cardKana: 28_000,
  turn: 45_000,
  turnKana: 60_000,
  vote: 25_000,
  lastChance: 20_000,
  score: 14_000,
} as const;

/** Question turns per round: a few more than the players, 6–10. */
export function turnCap(players: number): number {
  return Math.max(6, Math.min(10, players + 3));
}

// ---- state ----

export type Tier = 'own' | 'frame' | 'tap';

/** A question or answer as logged. */
export interface Said {
  /** What the stage shows: the known frame's text when it matched, else what was heard. */
  text: string;
  /** Reading and subtitle, when it matched a known frame. */
  kana: string | null;
  en: string | null;
  furigana?: JpText['furigana'];
  lineId: string | null;
  via: Utterance['via'];
  tier: Tier;
  /** Close to a known frame but not exact: the heard text is shown, with the frame's subtitle as a guess. */
  approx?: boolean;
}

export interface Turn {
  /** Counts every turn started this game, so a late move from an old turn is told apart. */
  seq: number;
  askerId: string;
  targetId: string | null;
  /** The player who just asked the asker (no asking straight back). */
  noAskBack: string | null;
  question: Said | null;
  answer: Said | null;
  /** Line ids suggested to the asker, then to the answerer. */
  qSuggest: string[];
  aSuggest: string[];
  /** The VIP hid it. */
  hidden: boolean;
}

export interface Exchange {
  askerId: string;
  targetId: string;
  question: Said;
  answer: Said | null;
  hidden: boolean;
}

export interface Vote {
  kind: 'called' | 'final';
  callerId: string | null;
  voters: string[];
  ballots: Record<string, string>;
}

export type How = 'caught' | 'wrong-person' | 'escaped' | 'guessed' | 'wrong-guess' | 'left';

export interface Outcome {
  how: How;
  accusedId: string | null;
  /** The vote that decided it (none for a guess). */
  vote: Vote | null;
  guess: { placeId: string; right: boolean } | null;
  lastChance: { placeId: string; right: boolean } | null;
}

export interface PlayerStats {
  caught: number;
  escaped: number;
  sharpEyes: number;
  spoken: number;
  asked: number;
}

export interface TouristState {
  packId: string | null;
  order: string[];
  round: number;
  totalRounds: number;
  placeId: string;
  choices: string[];
  touristId: string;
  roles: Record<string, JpText>;
  ready: string[];
  turn: Turn | null;
  turnSeq: number;
  next: { askerId: string; noAskBack: string | null } | null;
  turnsDone: number;
  turnCap: number;
  roundStart: number;
  log: Exchange[];
  /** Players who have called their vote this round. */
  called: string[];
  pendingVote: { kind: Vote['kind']; callerId: string | null } | null;
  vote: Vote | null;
  /** The last called vote that failed (shown at the next turn). */
  failedVote: { callerId: string | null; tally: { playerId: string; votes: number }[] } | null;
  outcome: Outcome | null;
  resolved: boolean;
  aborted: boolean;
  roundPoints: Record<string, number>;
  bonusUsed: Record<string, number>;
  timesTourist: Record<string, number>;
  lastTourist: string | null;
  stats: Record<string, PlayerStats>;
  phaseAt: number;
}

export type TouristMove =
  | { kind: 'ready' }
  | { kind: 'pick'; targetId: string }
  | { kind: 'ask'; targetId?: string; utterance: Utterance; lineId?: string }
  | { kind: 'reply'; utterance: Utterance; lineId?: string }
  | { kind: 'call' }
  | { kind: 'vote'; suspectId: string }
  | { kind: 'guess'; placeId: string; utterance?: Utterance }
  | { kind: 'hide'; index: number };

// ---- view ----

export interface PlaceCard {
  id: string;
  emoji: string;
  text: string;
  kana: string;
  en: string;
  furigana?: JpText['furigana'];
  /** Kana level only. */
  romaji?: string;
}

export interface LineCard {
  id: string;
  text: string;
  kana: string;
  en: string;
  furigana?: JpText['furigana'];
  romaji?: string;
}

export interface SaidView {
  text: string;
  kana: string | null;
  en: string | null;
  furigana?: JpText['furigana'];
  romaji?: string;
  /** Said in the player's own words (not off a tile). */
  ownWords: boolean;
  /** The subtitle is a best guess (it sounded close to a known line). */
  approx: boolean;
  spoken: boolean;
}

export interface ExchangeView {
  index: number;
  askerId: string;
  targetId: string;
  question: SaidView;
  answer: SaidView | null;
  hidden: boolean;
}

export interface TouristView {
  mode: 'tourist';
  round: number;
  totalRounds: number;
  multiplier: number;
  phaseAt: number;
  places: PlaceCard[];
  ready: string[];
  turn: {
    seq: number;
    n: number;
    cap: number;
    askerId: string;
    targetId: string | null;
    noAskBack: string | null;
    question: SaidView | null;
    answer: SaidView | null;
  } | null;
  log: ExchangeView[];
  /** Players who may still call a vote this round. */
  canCall: string[];
  vote: { kind: Vote['kind']; callerId: string | null; voters: string[]; voted: string[] } | null;
  failedVote: TouristState['failedVote'];
  /** Encore: the caught tourist (the place stays secret). Score: everything. */
  outcome: {
    how: How;
    touristId: string;
    place: PlaceCard | null;
    accusedId: string | null;
    callerId: string | null;
    kind: Vote['kind'] | null;
    tally: { playerId: string; votes: number }[];
    ballots: { voterId: string; suspectId: string }[];
    guess: { place: PlaceCard; right: boolean } | null;
    lastChance: { place: PlaceCard; right: boolean } | null;
  } | null;
  roundPoints: { playerId: string; points: number }[] | null;
  me: {
    level: Level;
    tourist: boolean;
    /** Locals: the place and your role. The tourist: null. */
    card: { place: PlaceCard; role: JpText } | null;
    role: JpText;
    ready: boolean;
    canCall: boolean;
    canGuess: boolean;
    myVote: string | null;
    /** Question tiles when it's your turn to ask. */
    questions: LineCard[] | null;
    /** Answer tiles when someone asked you. */
    answers: LineCard[] | null;
    /** The tourist's cheat sheet. */
    bluffs: LineCard[] | null;
    points: number | null;
  } | null;
}

// ---- helpers ----

const LINES = new Map(ALL_LINES.map((l) => [l.id, l]));
const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
const BANDS: Record<Level, Level[]> = { kana: ['kana'], n5: ['n5', 'kana'], n4: ['n4', 'n5', 'kana'] };

const blankStats = (): PlayerStats => ({ caught: 0, escaped: 0, sharpEyes: 0, spoken: 0, asked: 0 });
const stats = (s: TouristState, id: string) => (s.stats[id] ??= blankStats());
const multiplierFor = (s: TouristState) => (s.round === s.totalRounds ? 2 : 1);
const placeOf = (s: TouristState) => PLACE_BY_ID.get(s.placeId)!;

export function placeCard(p: Place, romaji: boolean): PlaceCard {
  return { id: p.id, emoji: p.emoji, text: p.name.text, kana: p.name.kana, en: p.name.en, ...(p.name.furigana ? { furigana: p.name.furigana } : {}), ...(romaji ? { romaji: toRomaji(p.name.kana) } : {}) };
}

function lineCard(l: Line, romaji: boolean): LineCard {
  return { id: l.id, text: l.jp.text, kana: l.jp.kana, en: l.jp.en, ...(l.jp.furigana ? { furigana: l.jp.furigana } : {}), ...(romaji ? { romaji: toRomaji(l.jp.kana) } : {}) };
}

function saidView(x: Said, romaji: boolean, hidden: boolean): SaidView {
  if (hidden) return { text: '[hidden]', kana: null, en: null, ownWords: false, approx: false, spoken: false };
  return {
    text: x.text,
    kana: x.kana,
    en: x.en,
    ...(x.furigana ? { furigana: x.furigana } : {}),
    ...(romaji && x.kana ? { romaji: toRomaji(x.kana) } : {}),
    ownWords: x.tier === 'own',
    approx: !!x.approx,
    spoken: x.via === 'speech',
  };
}

/** Lines at a player's level, best band first, shuffled within each band. */
function byLevel(lines: readonly Line[], level: Level, random: () => number): Line[] {
  return BANDS[level].flatMap((band) => shuffled(lines.filter((l) => l.level === band), random));
}

function questionTiles(s: TouristState, playerId: string, level: Level, random: () => number): string[] {
  const generic = byLevel(QUESTIONS, level, random);
  if (playerId === s.touristId) return generic.slice(0, 5).map((l) => l.id);
  const local = byLevel(placeOf(s).questions, level, random).slice(0, 2);
  return [...local, ...generic.filter((l) => !local.includes(l))].slice(0, 5).map((l) => l.id);
}

function answerTiles(s: TouristState, playerId: string, level: Level, kind: Kind | null, random: () => number): string[] {
  const safe = byLevel(SAFE_ANSWERS, level, random);
  const bluffs = byLevel(BLUFFS, level, random);
  const fits = (l: Line) => kind === null || l.kind === kind || l.kind === 'any';
  let picks: Line[];
  if (playerId === s.touristId) {
    picks = [...safe.filter(fits).slice(0, 2), ...(kind === null || kind === 'yesno' ? [] : safe.filter((l) => l.kind === 'yesno').slice(0, 1)), ...bluffs];
  } else {
    const here = byLevel(placeOf(s).answers, level, random);
    const mine = kind === null ? here.slice(0, 2) : here.filter(fits).slice(0, 2);
    const extra = kind === 'yesno' ? here.filter((l) => l.kind === 'how' || l.kind === 'like').slice(0, 1) : [];
    picks = [...mine, ...extra, ...safe.filter(fits), ...safe.filter((l) => l.kind === 'yesno')];
  }
  return [...new Set(picks)].slice(0, 4).map((l) => l.id);
}

function pay(s: TouristState, ctx: ModeContext, playerId: string, points: number): void {
  const p = Math.round(points);
  if (!p || !ctx.player(playerId)) return;
  ctx.award(playerId, p);
  s.roundPoints[playerId] = (s.roundPoints[playerId] ?? 0) + p;
}

const meanScore = (ctx: ModeContext) => {
  const scores = ctx.players().map((p) => p.score);
  return scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
};

/** Pays a speaking bonus from the player's capped pool for this round (comebacks raise it, never past the cap). */
function payBonus(s: TouristState, ctx: ModeContext, playerId: string, points: number): number {
  const player = ctx.player(playerId);
  if (!player || points <= 0) return 0;
  const mult = multiplierFor(s);
  const raised = (player.score < meanScore(ctx) ? points * COMEBACK : points) * mult;
  const cap = BONUS_POOL_SHARE * ROUND_STAKE * mult;
  const room = Math.max(0, cap - (s.bonusUsed[playerId] ?? 0));
  const paid = Math.min(room, Math.round(raised / 5) * 5);
  if (paid <= 0) return 0;
  s.bonusUsed[playerId] = (s.bonusUsed[playerId] ?? 0) + paid;
  pay(s, ctx, playerId, paid);
  return paid;
}

/** Who plays the tourist: fewest times so far, not last round's, connected first. */
function pickTourist(s: TouristState, ctx: ModeContext): ModePlayer {
  const all = ctx.players();
  const here = all.filter((p) => p.connected);
  const pool = here.length ? here : all;
  const jitter = new Map(pool.map((p) => [p.id, ctx.random()]));
  return [...pool].sort(
    (a, b) =>
      (s.timesTourist[a.id] ?? 0) - (s.timesTourist[b.id] ?? 0) ||
      Number(s.lastTourist === a.id) - Number(s.lastTourist === b.id) ||
      jitter.get(a.id)! - jitter.get(b.id)!,
  )[0]!;
}

/** The next player by seat after `id` who is connected (or anyone, if nobody is). */
function nextBySeat(ctx: ModeContext, id: string | null): string | null {
  const all = ctx.players();
  if (!all.length) return null;
  const here = all.filter((p) => p.connected);
  const pool = here.length ? here : all;
  const seat = all.find((p) => p.id === id)?.seat ?? 0;
  return (pool.find((p) => p.seat > seat) ?? pool[0])!.id;
}

function startRound(s: TouristState, ctx: ModeContext): void {
  s.round += 1;
  const random = () => ctx.random();
  s.placeId = s.order[(s.round - 1) % s.order.length]!;
  const place = placeOf(s);
  const samePack = shuffled(PLACES.filter((p) => p.id !== place.id && p.packId === place.packId), random);
  const others = shuffled(PLACES.filter((p) => p.packId !== place.packId), random);
  s.choices = shuffled([place, ...[...samePack.slice(0, 3), ...others].slice(0, CHOICES - 1)], random).map((p) => p.id);

  const tourist = pickTourist(s, ctx);
  s.touristId = tourist.id;
  s.lastTourist = tourist.id;
  s.timesTourist[tourist.id] = (s.timesTourist[tourist.id] ?? 0) + 1;
  const roles = shuffled(place.roles, random);
  s.roles = {};
  let i = 0;
  for (const p of ctx.players()) s.roles[p.id] = p.id === tourist.id ? TOURIST_ROLE : roles[i++ % roles.length]!;

  s.ready = [];
  s.turn = null;
  const here = ctx.connected();
  const first = here[Math.floor(random() * here.length)] ?? ctx.players()[0];
  s.next = first ? { askerId: first.id, noAskBack: null } : null;
  s.turnsDone = 0;
  s.turnCap = turnCap(ctx.players().length);
  s.roundStart = ctx.now;
  s.log = [];
  s.called = [];
  s.pendingVote = null;
  s.vote = null;
  s.failedVote = null;
  s.outcome = null;
  s.resolved = false;
  s.aborted = false;
  s.roundPoints = {};
  s.bonusUsed = {};
}

function startTurn(s: TouristState, ctx: ModeContext): void {
  let next = s.next;
  const asker = next ? ctx.player(next.askerId) : undefined;
  if (!next || !asker || !asker.connected) {
    // The asker is gone: the next connected seat asks, free to ask anyone.
    const id = nextBySeat(ctx, next?.askerId ?? null);
    next = id ? { askerId: id, noAskBack: null } : null;
  }
  s.next = null;
  if (!next) {
    s.turn = null;
    return;
  }
  const level = ctx.player(next.askerId)?.level ?? 'n5';
  s.turnSeq += 1;
  s.turn = { seq: s.turnSeq, askerId: next.askerId, targetId: null, noAskBack: next.noAskBack, question: null, answer: null, qSuggest: questionTiles(s, next.askerId, level, () => ctx.random()), aSuggest: [], hidden: false };
}

/** Closes the current turn: logs it and decides who asks next. */
function finishTurn(s: TouristState, ctx: ModeContext): void {
  const turn = s.turn;
  s.turn = null;
  if (!turn) return;
  if (turn.question && turn.targetId) {
    s.log.push({ askerId: turn.askerId, targetId: turn.targetId, question: turn.question, answer: turn.answer, hidden: turn.hidden });
    s.turnsDone += 1;
    s.next = { askerId: turn.targetId, noAskBack: turn.askerId };
    return;
  }
  // Interrupted before the question (a vote or a guess): the same asker goes again.
  if (s.pendingVote || s.outcome) {
    s.next = { askerId: turn.askerId, noAskBack: turn.noAskBack };
    return;
  }
  // Nobody asked in time: skip to the next seat.
  s.turnsDone += 1;
  s.next = { askerId: nextBySeat(ctx, turn.askerId) ?? turn.askerId, noAskBack: null };
}

/** Who the asker may ask: anyone else seated, except whoever just asked them. Connected first. */
function targetsFor(s: TouristState, ctx: ModeContext, turn: Turn): ModePlayer[] {
  const all = ctx.players().filter((p) => p.id !== turn.askerId);
  const open = all.filter((p) => p.id !== turn.noAskBack);
  const pool = open.length ? open : all;
  const here = pool.filter((p) => p.connected);
  return here.length ? here : pool;
}

/** Turns an utterance into a log line, matched to a known frame where possible. */
function toSaid(u: Utterance, lineId: string | undefined, suggested: readonly string[], level: Level): Said | null {
  const tile = lineId && suggested.includes(lineId) ? LINES.get(lineId) : undefined;
  if (lineId !== undefined && !tile) return null;
  const fromLine = (l: Line, tier: Tier): Said => ({ text: l.jp.text, kana: l.jp.kana, en: l.jp.en, ...(l.jp.furigana ? { furigana: l.jp.furigana } : {}), lineId: l.id, via: u.via, tier });
  if (u.via === 'tap') return tile ? fromLine(tile, 'tap') : null;
  const heard = cleanText(u.text, 80);
  if (!heard) return null;
  if (tile && matchLine(u, [tile], level)) return fromLine(tile, 'frame');
  const found = findLine(u, ALL_LINES, level);
  if (found) {
    // Exact: show the tidy frame (read off a tile if it was one on screen). Close: show what was
    // heard, with the frame's meaning as a guess; changing a word of a tile counts as own words.
    if (found.exact) return fromLine(found.line, suggested.includes(found.line.id) ? 'frame' : 'own');
    return { text: heard, kana: null, en: found.line.jp.en, lineId: found.line.id, via: u.via, tier: 'own', approx: true };
  }
  return { text: heard, kana: null, en: null, lineId: null, via: u.via, tier: 'own' };
}

/** The speaking bonus a logged line earns. Own words only count when they hold some Japanese. */
function bonusFor(x: Said, table: typeof ASK_BONUS | typeof ANSWER_BONUS): number {
  if (x.via === 'tap') return 0;
  if (x.tier === 'own' && !x.kana && !hasJapanese(x.text)) return 0;
  return table[x.tier === 'own' ? 'own' : 'frame'][x.via];
}

function logPhrase(ctx: ModeContext, playerId: string, x: Said): void {
  const l = x.lineId ? LINES.get(x.lineId) : undefined;
  if (!l) return;
  ctx.phrase(playerId, { itemId: l.id, text: l.jp.text, kana: l.jp.kana, en: l.jp.en, outcome: x.tier === 'own' && !x.approx ? 'said' : 'seen', recall: x.tier === 'own' && !x.approx && x.via === 'speech' ? 'memory' : 'read' });
}

function tallyOf(v: Vote): { playerId: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const suspect of Object.values(v.ballots)) counts.set(suspect, (counts.get(suspect) ?? 0) + 1);
  return [...counts].map(([playerId, votes]) => ({ playerId, votes })).sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));
}

/** Counts the vote. A called vote needs a majority of the voters; the final vote, the most votes (no tie). */
function resolveVote(s: TouristState, ctx: ModeContext): void {
  const v = s.vote;
  s.vote = null;
  if (!v) return;
  const tally = tallyOf(v);
  const [top, second] = tally;
  const voters = v.voters.filter((id) => ctx.player(id)).length;
  const clear = !!top && (!second || second.votes < top.votes);
  const accused = clear && (v.kind === 'final' || top!.votes * 2 > voters) ? top!.playerId : null;
  if (!accused) {
    if (v.kind === 'called') {
      s.failedVote = { callerId: v.callerId, tally };
      return;
    }
    s.outcome = { how: 'escaped', accusedId: null, vote: v, guess: null, lastChance: null };
    return;
  }
  s.failedVote = null;
  s.outcome = { how: accused === s.touristId ? 'caught' : 'wrong-person', accusedId: accused, vote: v, guess: null, lastChance: null };
}

/** Pays the round and fills the phrasebook. */
function resolveRound(s: TouristState, ctx: ModeContext): void {
  if (s.resolved) return;
  s.resolved = true;
  s.outcome ??= { how: s.aborted ? 'left' : 'escaped', accusedId: null, vote: null, guess: null, lastChance: null };
  const o = s.outcome;
  const mult = multiplierFor(s);
  const place = placeOf(s);
  const locals = ctx.players().filter((p) => p.id !== s.touristId);
  const sharpEyes = o.vote ? locals.filter((p) => o.vote!.ballots[p.id] === s.touristId) : [];
  switch (o.how) {
    case 'caught':
      for (const p of locals) {
        pay(s, ctx, p.id, WIN_POINTS * mult);
        stats(s, p.id).caught += 1;
      }
      if (o.vote?.kind === 'called' && o.vote.callerId && o.vote.callerId !== s.touristId) pay(s, ctx, o.vote.callerId, CALLER_POINTS * mult);
      if (o.lastChance?.right) pay(s, ctx, s.touristId, LAST_CHANCE_POINTS * mult);
      break;
    case 'wrong-guess':
      for (const p of locals) {
        pay(s, ctx, p.id, WIN_POINTS * mult);
        stats(s, p.id).caught += 1;
      }
      break;
    case 'escaped':
    case 'wrong-person':
      pay(s, ctx, s.touristId, ESCAPE_POINTS * mult);
      stats(s, s.touristId).escaped += 1;
      break;
    case 'guessed':
      pay(s, ctx, s.touristId, GUESS_POINTS * mult);
      stats(s, s.touristId).escaped += 1;
      break;
    case 'left':
      break;
  }
  if (o.how !== 'left') {
    for (const p of sharpEyes) {
      pay(s, ctx, p.id, SHARP_EYE_POINTS * mult);
      stats(s, p.id).sharpEyes += 1;
    }
  }
  for (const p of ctx.players()) ctx.phrase(p.id, { itemId: `tourist.place.${place.id}`, text: place.name.text, kana: place.name.kana, en: place.name.en, outcome: 'seen' });

  // Chōchin-san's own lines for this mode: his reveal_react bank is about trains and votes on answers.
  if (o.how !== 'left') {
    const caught = (o.how === 'caught' && !o.lastChance?.right) || o.how === 'wrong-guess';
    ctx.cue({ host: 'chochin', event: caught ? 'tourist_caught' : 'tourist_escaped', slots: { name: ctx.player(s.touristId)?.name ?? '' } });
  }
}

// ---- the mode ----

export const touristMode: Mode<TouristState, TouristView> = {
  info: {
    id: 'tourist',
    title: "Who's the Tourist?",
    titleJa: 'かんこうきゃくは だれ？',
    blurb: 'Everyone knows where you are, except the tourist. Ask questions in Japanese and find them.',
    host: 'chochin',
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [TOTAL_ROUNDS, 4, 5],
    usesPack: true,
    phrasebookTitle: 'Your questions and answers',
    phaseLabels: { prompt: 'Your card', answer: 'Questions', reveal: 'Vote!', encore: 'Last chance', score: 'Who was it?' },
  },

  setup(ctx, opts) {
    const random = () => ctx.random();
    const packIds = [...new Set(PLACES.map((p) => p.packId))] as string[];
    const packId = opts.packId && packIds.includes(opts.packId) ? opts.packId : null;
    const mine = shuffled(PLACES.filter((p) => p.packId === packId), random);
    const rest = shuffled(PLACES.filter((p) => p.packId !== packId), random);
    const statsAll: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) statsAll[p.id] = blankStats();
    return {
      packId,
      order: [...mine, ...rest].map((p) => p.id),
      round: 0,
      totalRounds: Math.max(1, Math.min(20, opts.rounds ?? TOTAL_ROUNDS)),
      placeId: PLACES[0]!.id,
      choices: [],
      touristId: '',
      roles: {},
      ready: [],
      turn: null,
      turnSeq: 0,
      next: null,
      turnsDone: 0,
      turnCap: turnCap(ctx.players().length),
      roundStart: ctx.now,
      log: [],
      called: [],
      pendingVote: null,
      vote: null,
      failedVote: null,
      outcome: null,
      resolved: false,
      aborted: false,
      roundPoints: {},
      bonusUsed: {},
      timesTourist: {},
      lastTourist: null,
      stats: statsAll,
      phaseAt: ctx.now,
    };
  },

  next(s, from, ctx) {
    const roundOver = () => s.turnsDone >= s.turnCap || ctx.now - s.roundStart >= ROUND_CAP_MS;
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return s.aborted ? 'score' : 'answer';
      case 'answer':
        if (s.aborted || s.outcome) return 'score';
        if (s.pendingVote) return 'reveal';
        if (roundOver()) {
          s.pendingVote = { kind: 'final', callerId: null };
          return 'reveal';
        }
        return 'answer';
      case 'reveal':
        if (s.aborted) return 'score';
        if (s.outcome) return s.outcome.how === 'caught' ? 'encore' : 'score';
        if (roundOver()) {
          s.pendingVote = { kind: 'final', callerId: null };
          return 'reveal';
        }
        return 'answer';
      case 'encore':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'chochin', event: 'tourist_intro' });
        break;
      case 'prompt':
        startRound(s, ctx);
        // No place in the cue: the line is shown on the stage.
        ctx.cue({ host: 'chochin', event: 'tourist_deal' });
        break;
      case 'answer':
        startTurn(s, ctx);
        break;
      case 'reveal': {
        const pending = s.pendingVote ?? { kind: 'final' as const, callerId: null };
        s.pendingVote = null;
        const voters = ctx.players().filter((p) => p.connected);
        s.vote = { kind: pending.kind, callerId: pending.callerId, voters: (voters.length ? voters : ctx.players()).map((p) => p.id), ballots: {} };
        ctx.cue({ host: 'chochin', event: 'tourist_vote' });
        break;
      }
      case 'encore':
        ctx.cue({ host: 'chochin', event: 'tourist_last_chance', slots: { name: ctx.player(s.touristId)?.name ?? '' } });
        break;
      case 'score':
        resolveRound(s, ctx);
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'answer') finishTurn(s, ctx);
    if (phase === 'reveal') resolveVote(s, ctx);
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return ctx.players().some((p) => p.level === 'kana') ? DURATIONS.cardKana : DURATIONS.card;
      case 'answer':
        return s.turn && ctx.player(s.turn.askerId)?.level === 'kana' ? DURATIONS.turnKana : DURATIONS.turn;
      case 'reveal':
        return DURATIONS.vote;
      case 'encore':
        return DURATIONS.lastChance;
      case 'score':
        return DURATIONS.score;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (!here.length) return false;
    if (s.aborted && phase !== 'score') return true;
    switch (phase) {
      case 'prompt':
        return here.every((p) => s.ready.includes(p.id));
      case 'answer': {
        if (s.outcome || s.pendingVote) return true;
        const turn = s.turn;
        if (!turn) return true;
        if (!turn.question) return !ctx.player(turn.askerId)?.connected;
        if (turn.answer) return true;
        return !turn.targetId || !ctx.player(turn.targetId)?.connected;
      }
      case 'reveal': {
        const v = s.vote;
        if (!v) return true;
        return v.voters.every((id) => !ctx.player(id)?.connected || v.ballots[id] !== undefined);
      }
      case 'encore':
        return !!s.outcome?.lastChance || !ctx.player(s.touristId)?.connected;
      default:
        return false;
    }
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    const player = ctx.player(playerId)!;
    const turn = s.turn;
    // Turn moves may name the turn they were made in; one from an earlier turn is a race with the clock.
    if (raw.turn !== undefined && raw.turn !== turn?.seq && ['pick', 'ask', 'reply'].includes(String(raw.kind))) return moveError('wrong-phase');
    switch (raw.kind) {
      case 'ready': {
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!s.ready.includes(playerId)) s.ready.push(playerId);
        return MOVE_OK;
      }
      case 'pick': {
        if (phase !== 'answer' || !turn) return moveError('wrong-phase');
        if (turn.askerId !== playerId) return moveError('not-your-turn');
        if (turn.question) return moveError('already-asked');
        if (typeof raw.targetId !== 'string' || !targetsFor(s, ctx, turn).some((p) => p.id === raw.targetId)) return moveError('bad-target');
        turn.targetId = raw.targetId;
        return MOVE_OK;
      }
      case 'ask': {
        if (phase !== 'answer' || !turn) return moveError('wrong-phase');
        if (turn.askerId !== playerId) return moveError('not-your-turn');
        if (turn.question) return moveError('already-asked');
        if (raw.targetId !== undefined) {
          if (typeof raw.targetId !== 'string' || !targetsFor(s, ctx, turn).some((p) => p.id === raw.targetId)) return moveError('bad-target');
          turn.targetId = raw.targetId;
        }
        if (!turn.targetId) return moveError('pick-someone');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        if (raw.lineId !== undefined && typeof raw.lineId !== 'string') return moveError('bad-move');
        const said = toSaid(raw.utterance, raw.lineId as string | undefined, turn.qSuggest, player.level);
        if (!said) return moveError(raw.utterance.via === 'tap' || raw.lineId !== undefined ? 'bad-move' : 'empty-answer');
        turn.question = said;
        const q = said.lineId ? LINES.get(said.lineId) : undefined;
        const target = ctx.player(turn.targetId);
        turn.aSuggest = answerTiles(s, turn.targetId, target?.level ?? 'n5', q && q.kind !== 'any' ? q.kind : null, () => ctx.random());
        stats(s, playerId).asked += 1;
        if (said.via === 'speech') stats(s, playerId).spoken += 1;
        payBonus(s, ctx, playerId, bonusFor(said, ASK_BONUS));
        logPhrase(ctx, playerId, said);
        return MOVE_OK;
      }
      case 'reply': {
        if (phase !== 'answer' || !turn) return moveError('wrong-phase');
        if (turn.targetId !== playerId || !turn.question) return moveError('not-your-turn');
        if (turn.answer) return moveError('already-answered');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        if (raw.lineId !== undefined && typeof raw.lineId !== 'string') return moveError('bad-move');
        const said = toSaid(raw.utterance, raw.lineId as string | undefined, turn.aSuggest, player.level);
        if (!said) return moveError(raw.utterance.via === 'tap' || raw.lineId !== undefined ? 'bad-move' : 'empty-answer');
        turn.answer = said;
        if (said.via === 'speech') stats(s, playerId).spoken += 1;
        payBonus(s, ctx, playerId, bonusFor(said, ANSWER_BONUS));
        logPhrase(ctx, playerId, said);
        return MOVE_OK;
      }
      case 'call': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (s.called.includes(playerId)) return moveError('already-called');
        if (s.pendingVote || s.outcome) return MOVE_OK;
        s.called.push(playerId);
        s.pendingVote = { kind: 'called', callerId: playerId };
        return MOVE_OK;
      }
      case 'vote': {
        if (phase !== 'reveal' || !s.vote) return moveError('wrong-phase');
        if (!s.vote.voters.includes(playerId)) return moveError('not-eligible');
        if (s.vote.ballots[playerId] !== undefined) return moveError('already-voted');
        if (typeof raw.suspectId !== 'string' || raw.suspectId === playerId || !ctx.player(raw.suspectId)) return moveError('bad-target');
        s.vote.ballots[playerId] = raw.suspectId;
        return MOVE_OK;
      }
      case 'guess': {
        if (playerId !== s.touristId) return moveError('not-eligible');
        const lastChance = phase === 'encore' && s.outcome?.how === 'caught';
        if (phase !== 'answer' && !lastChance) return moveError('wrong-phase');
        if (lastChance ? s.outcome!.lastChance : s.outcome) return moveError('already-guessed');
        if (typeof raw.placeId !== 'string' || !s.choices.includes(raw.placeId)) return moveError('bad-place');
        const right = raw.placeId === s.placeId;
        const guessed = PLACE_BY_ID.get(raw.placeId)!;
        const u = raw.utterance;
        if (u !== undefined && isUtterance(u) && u.via !== 'tap' && namesPlace(u, guessed.name.kana, guessed.accepted)) {
          if (u.via === 'speech') stats(s, playerId).spoken += 1;
          payBonus(s, ctx, playerId, GUESS_BONUS[u.via]);
          if (right) ctx.phrase(playerId, { itemId: `tourist.place.${guessed.id}`, text: guessed.name.text, kana: guessed.name.kana, en: guessed.name.en, outcome: 'said', recall: 'read' });
        }
        if (lastChance) s.outcome!.lastChance = { placeId: raw.placeId, right };
        else s.outcome = { how: right ? 'guessed' : 'wrong-guess', accusedId: null, vote: null, guess: { placeId: raw.placeId, right }, lastChance: null };
        return MOVE_OK;
      }
      case 'hide': {
        if (playerId !== ctx.vipId) return moveError('not-vip');
        const i = raw.index;
        if (typeof i !== 'number' || !Number.isInteger(i)) return moveError('bad-move');
        const ex = s.log[i];
        if (ex) ex.hidden = true;
        else if (i === s.log.length && turn?.question) turn.hidden = true;
        else return moveError('bad-move');
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    if (playerId === s.touristId && !s.resolved) s.aborted = true;
    if (s.vote) {
      s.vote.voters = s.vote.voters.filter((id) => id !== playerId);
      delete s.vote.ballots[playerId];
      for (const [voter, suspect] of Object.entries(s.vote.ballots)) if (suspect === playerId) delete s.vote.ballots[voter];
    }
    s.ready = s.ready.filter((id) => id !== playerId);
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const romaji = me?.level === 'kana';
    const inRound = phase !== 'intro' && s.round > 0;
    const card = (id: string) => placeCard(PLACE_BY_ID.get(id)!, romaji);
    const turn = s.turn;
    const live = phase === 'answer' && turn ? turn : null;

    const log: ExchangeView[] = inRound
      ? s.log.map((x, index) => ({
          index,
          askerId: x.askerId,
          targetId: x.targetId,
          question: saidView(x.question, romaji, x.hidden),
          answer: x.answer ? saidView(x.answer, romaji, x.hidden) : null,
          hidden: x.hidden,
        }))
      : [];

    const o = s.outcome;
    const showAll = phase === 'score';
    const outcome: TouristView['outcome'] =
      o && (showAll || (phase === 'encore' && o.how === 'caught'))
        ? {
            how: o.how,
            touristId: s.touristId,
            place: showAll ? card(s.placeId) : null,
            accusedId: o.accusedId,
            callerId: o.vote?.callerId ?? null,
            kind: o.vote?.kind ?? null,
            tally: o.vote ? tallyOf(o.vote) : [],
            ballots: o.vote && showAll ? Object.entries(o.vote.ballots).map(([voterId, suspectId]) => ({ voterId, suspectId })) : [],
            guess: o.guess && showAll ? { place: card(o.guess.placeId), right: o.guess.right } : null,
            lastChance: o.lastChance && showAll ? { place: card(o.lastChance.placeId), right: o.lastChance.right } : null,
          }
        : null;

    let mine: TouristView['me'] = null;
    if (me && inRound) {
      const isTourist = me.id === s.touristId;
      const myTurnToAsk = !!live && live.askerId === me.id && !live.question;
      const myTurnToAnswer = !!live && live.targetId === me.id && !!live.question && !live.answer;
      const tiles = (ids: string[]) => ids.map((id) => lineCard(LINES.get(id)!, romaji));
      mine = {
        level: me.level,
        tourist: isTourist,
        card: isTourist ? null : { place: card(s.placeId), role: s.roles[me.id] ?? placeOf(s).roles[0]! },
        role: s.roles[me.id] ?? (isTourist ? TOURIST_ROLE : placeOf(s).roles[0]!),
        ready: s.ready.includes(me.id),
        canCall: phase === 'answer' && !s.called.includes(me.id) && !s.pendingVote && !s.outcome,
        canGuess: isTourist && ((phase === 'answer' && !s.outcome) || (phase === 'encore' && o?.how === 'caught' && !o.lastChance)),
        myVote: phase === 'reveal' ? (s.vote?.ballots[me.id] ?? null) : null,
        questions: myTurnToAsk ? tiles(live!.qSuggest) : null,
        answers: myTurnToAnswer ? tiles(live!.aSuggest) : null,
        bluffs: isTourist && phase !== 'score' ? BLUFFS.filter((l) => BANDS[me.level].includes(l.level)).map((l) => lineCard(l, romaji)) : null,
        points: phase === 'score' ? (s.roundPoints[me.id] ?? 0) : null,
      };
    }

    return {
      mode: 'tourist',
      round: s.round,
      totalRounds: s.totalRounds,
      multiplier: multiplierFor(s),
      phaseAt: s.phaseAt,
      places: inRound ? s.choices.map(card) : [],
      ready: phase === 'prompt' ? [...s.ready] : [],
      turn: live
        ? {
            seq: live.seq,
            n: s.turnsDone + 1,
            cap: s.turnCap,
            askerId: live.askerId,
            targetId: live.targetId,
            noAskBack: live.noAskBack,
            question: live.question ? saidView(live.question, romaji, live.hidden) : null,
            answer: live.answer ? saidView(live.answer, romaji, live.hidden) : null,
          }
        : null,
      log,
      canCall: phase === 'answer' ? ctx.players().filter((p) => !s.called.includes(p.id)).map((p) => p.id) : [],
      vote: phase === 'reveal' && s.vote ? { kind: s.vote.kind, callerId: s.vote.callerId, voters: [...s.vote.voters], voted: Object.keys(s.vote.ballots) } : null,
      failedVote: phase === 'answer' ? s.failedVote : null,
      outcome,
      roundPoints: showAll ? ctx.players().map((p) => ({ playerId: p.id, points: s.roundPoints[p.id] ?? 0 })) : null,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (key: keyof PlayerStats): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      for (const p of players) if ((s.stats[p.id]?.[key] ?? 0) > (top ? (s.stats[top.id]?.[key] ?? 0) : 0)) top = p;
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best('sharpEyes'), 'めいたんてい', 'Great Detective: most votes for the real tourist');
    add(best('escaped'), 'へんそうの たつじん', 'Master of Disguise: most rounds won as the tourist');
    add(best('spoken'), 'おしゃべり王', 'Chatterbox: most questions and answers said out loud');
    return out;
  },
};
