// Narabete! (ならべて！, "line them up!"): every phone holds a secret card. Say yours out loud, listen to
// everyone else's, and line the cards up along Nobiko-san's neck. Co-op. See docs/modes/narabete.md.
//
// Three rounds:
//   1 Time Line      each card is a time, price or date from a tiny story (a ghost's day, Pon's diet).
//                    The phone shows a picture and a clock, not the sentence: say it from memory.
//   2 Feelings Line  a secret number 1–100 and an opinion theme (how smelly, how bad an excuse). Say
//                    something that fits your number; the team orders the answers without numbers.
//   3 Worst Day Ever a last Feelings Line, then the room performs it as a story, lowest to highest.
//
// Each round: prompt (deal) → answer (say your card) → reveal (order the line: each player moves only
// their own card, from their phone, then locks) → encore (Feelings rounds: the most-moved card's author
// gets one defence) → score (Nobiko-san flips the cards; neighbouring pairs in order score for everyone).
// After round 3, one `finale` phase per performer for the story.
//
// The N4 hard role, rank and defend (goal 4.11): in a room with N4 players, one of them each round (in
// turn) also defends their own card's place with ので (「＿ので、これが いちばん さきです。」), in any round,
// Time Line too. It's offered during the line-up, opt-in: it runs only when they tap Take it before the
// line-up ends (an offer still open then is 'timeout'). It runs as its own `encore` after the ordinary
// defence (or instead of it, when the same player would give both). Team points don't change.
// Spotlight (for Ladi to confirm): in a room of 4 or more, a lone eligible N4 player who gave it last round
// gets this round off.

import type { JpText, Level } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH } from '../../constants.js';
import { isUtterance, normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import { playerTextAllowed } from '../../moderation.js';
import { offerRate, type OfferAnswer } from '../hardRoleLog.js';
import type { Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { answerPicture, cardPicture, feelThemesFor, FEEL_THEMES, timeSetsFor, TIME_SETS, type FeelTheme, type TimeCard, type TimeSet } from './cards.js';
import { defenceScript, type DefenceScript } from './defence.js';

// ---- tuning ----

export const TOTAL_ROUNDS = 3;
/** Every neighbouring pair in order, for everyone (co-op). */
export const PAIR_POINTS = 100;
/** A whole line in order. */
export const PERFECT_POINTS = 300;
/** Speaking bonuses come from one pool: at most 30% of the team points at stake. */
export const BONUS_POOL_SHARE = 0.3;
/** Share of the bonus cap each way of saying your card earns. A Feelings defence (said) tops it up to the cap. */
export const SAY_SHARE = {
  /** Said out loud from memory (Time Line: no hint; Feelings: your own words). */
  memory: 0.7,
  /** Said out loud with help (the hint, or a ready answer read out). */
  helped: 0.5,
  typed: 0.35,
  /** A ready answer tapped. */
  tapped: 0.15,
  /** Said, but the time, price or date didn't come through. */
  tried: 0.2,
} as const;
export const DEFENCE_SHARE = 0.3;
export const VOTE_POINTS = 50;
export const PERFORM_POINTS = 50;
/** Ready answers offered on the phone: Kana players get one more. */
const OFFERS = { kana: 4, other: 3 } as const;

/** The flip on the TV: a lead-in, then one card every step. The stage animates from these. */
export const FLIP_LEAD_MS = 1_800;
export const FLIP_STEP_MS = 1_300;

export const DURATIONS = {
  intro: 15_000,
  prompt: 9_000,
  answer: 60_000,
  reveal: 90_000,
  encore: 12_000,
  /** The N4 defence: a little longer, to plan the ので line (the doc's 8 s to plan). */
  encoreN4: 15_000,
  /** After the flip: time to take it in (and, in Feelings rounds, vote for the funniest). */
  scoreTail: 9_000,
  scoreVoteTail: 14_000,
  finale: 14_000,
} as const;

// ---- state ----

export type RoundKind = 'time' | 'feel' | 'story';

export interface Said {
  text: string;
  via: Utterance['via'];
  /** Time Line: the time, price or date was in it. Feelings: it's Japanese. */
  ok: boolean;
  /** Feelings: it sounded like the secret number was said. */
  warn: boolean;
  /** Feelings: which ready answer, if one was used (tapped or read out). */
  ready: number | null;
}

export interface Card {
  id: string;
  ownerId: string;
  /** Sort value: the Time card's value, or the secret number. */
  value: number;
  /** Round 1. */
  timeId?: string;
  /** Feelings: the ready answers this player was offered (indices into the theme's list). */
  offers: number[];
  hinted: boolean;
  said: Said | null;
  hidden: boolean;
  moves: number;
  /** Names of players who asked for it again (Time Line). */
  again: string[];
}

export interface Flip {
  /** Card ids in the order the TV flips them: the line from the low end, the biggest surprise held for last. */
  order: string[];
  /** Indices i in the line where line[i] and line[i+1] are out of order. */
  knots: number[];
  pairs: number;
  maxPairs: number;
  perfect: boolean;
  /** The card furthest from its true place, flipped last (null when the line is perfect). */
  last: string | null;
  teamPoints: number;
  bonus: Record<string, number>;
}

/** The N4 defence (rank and defend): offered during the line-up, said in its own encore. */
export interface HardDefence {
  playerId: string;
  cardId: string;
  /** 'offered' until they answer; still open when the line-up ends, it's 'timeout' ('away' if they left). */
  answer: 'offered' | OfferAnswer;
  done: boolean;
  /** Said out loud, in Japanese: tops the bonus up, like the ordinary defence. */
  ok: boolean;
  /** It used ので (the frame). */
  framed: boolean;
  /** It was one of the model lines shown on the phone, read out (the phrasebook logs it as seen). */
  read?: boolean;
  text: string | null;
}

export interface Round {
  index: number;
  kind: RoundKind;
  setId: string;
  cards: Card[];
  /** Card ids, low end first. */
  line: string[];
  locks: Record<string, boolean>;
  defence: { playerId: string; cardId: string; done: boolean; ok: boolean; text: string | null } | null;
  /** The N4 defence this round, if the room has an N4 player (kept when declined, for the tally). */
  hard?: HardDefence | null;
  /** Which defence the encore is on now. */
  encore?: 'defence' | 'hard' | null;
  flip: Flip | null;
  votes: Record<string, string>;
}

export interface PlayerStats {
  spoken: number;
  poker: number;
  votes: number;
  again: number;
}

export interface Story {
  order: string[];
  index: number;
  done: Record<string, 'said' | 'passed'>;
}

export interface NarabeteState {
  round: number;
  totalRounds: number;
  current: Round | null;
  usedSets: string[];
  stats: Record<string, PlayerStats>;
  story: Story | null;
  phaseAt: number;
  /** Every N4 defence offered so far, and the answer (the step's gate: N4 players accept 60% or more). */
  hardLog: { round: number; playerId: string; answer: OfferAnswer }[];
}

// ---- view ----

export interface LineCard {
  id: string;
  ownerId: string;
  /** Feelings: the answer; Time Line: the sentence, once flipped (score). */
  text: string | null;
  en: string | null;
  emoji: string | null;
  /** The card's picture (a Time Line card's, or a Feelings ready answer's), shown with `emoji` as its fallback. */
  picture?: string;
  said: boolean;
  locked: boolean;
  again: number;
  hidden: boolean;
  /** From the flip on. */
  value?: number;
  label?: string;
  flip?: number;
  knotAfter?: boolean;
  last?: boolean;
  votes?: number;
  mine?: boolean;
}

export interface OfferView {
  key: number;
  text: string;
  en: string;
  emoji: string;
  picture: string;
  romaji?: string;
}

export interface NarabeteView {
  mode: 'narabete';
  round: number;
  totalRounds: number;
  kind: RoundKind | null;
  phaseAt: number;
  title: JpText | null;
  /** Feelings: the theme's adjective for arguing, 「Aさんの ほうが 〜！」. */
  more: JpText | null;
  low: JpText | null;
  high: JpText | null;
  unit: TimeSet['unit'] | 'feel' | null;
  line: LineCard[];
  said: string[];
  locked: string[];
  flip: { pairs: number; maxPairs: number; perfect: boolean; last: string | null; poker: string | null; teamPoints: number; steps: number } | null;
  /** The defence on now (encore), or the round's defence (score). `n4`: the rank-and-defend script, with its frame. */
  defence: { playerId: string; text: string | null; done: boolean; n4: boolean; frame: JpText | null } | null;
  story: { order: string[]; index: number; current: string | null } | null;
  me: {
    level: Level;
    cardId: string | null;
    time: { emoji: string; picture: string; label: string; en: string; jp: JpText | null; romaji?: string } | null;
    secret: number | null;
    offers: OfferView[];
    frames: string[];
    swerve: JpText[];
    said: { text: string; ok: boolean; warn: boolean } | null;
    locked: boolean;
    canMove: { left: boolean; right: boolean };
    position: number;
    againFrom: string[];
    canVote: boolean;
    votedFor: string | null;
    defending: boolean;
    /** The N4 defence, while it's mine: offered or taken (from the line-up), and the script while I defend. */
    hard: { answer: 'offered' | 'accepted'; script: DefenceScript | null } | null;
    performing: { text: string } | null;
    bonus: number;
  } | null;
}

export type NarabeteMove =
  | { kind: 'hint' }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'ready'; key: number }
  | { kind: 'move'; dir: -1 | 1 }
  | { kind: 'lock'; locked: boolean }
  | { kind: 'again'; cardId: string }
  | { kind: 'hide'; cardId: string }
  | { kind: 'defend'; utterance: Utterance }
  | { kind: 'defend'; pass: true }
  | { kind: 'hard'; accept: boolean }
  | { kind: 'vote'; cardId: string }
  | { kind: 'perform'; utterance: Utterance }
  | { kind: 'perform'; pass: true };

// ---- helpers ----

const round5 = (n: number) => Math.round(n / 5) * 5;
const blankStats = (): PlayerStats => ({ spoken: 0, poker: 0, votes: 0, again: 0 });
const stats = (s: NarabeteState, id: string) => (s.stats[id] ??= blankStats());
const hasJapanese = (t: string) => /[ぁ-ゖァ-ヺ一-鿿]/.test(t);

/**
 * A player's answer as the TV shows it: です, ます and final particles joined to the word before
 * (one bunsetsu, so です never falls onto a line of its own), and a 。 if a Japanese sentence lacks one.
 */
export function tidyJa(text: string): string {
  let t = text.trim().replace(/\s+(です|でした|ます|ました|ません|ませんでした|か|ね|よ)(?=[。！？!?、\s]|$)/g, '$1');
  if (/[ぁ-ゖァ-ヺー一-鿿]$/.test(t)) t += '。';
  return t;
}

export const roundKind = (round: number): RoundKind => (round <= 1 ? 'time' : round >= TOTAL_ROUNDS ? 'story' : 'feel');

export const timeSetOf = (id: string): TimeSet | undefined => TIME_SETS.find((x) => x.id === id);
export const themeOf = (id: string): FeelTheme | undefined => FEEL_THEMES.find((x) => x.id === id);
const timeCardOf = (c: Card): TimeCard | undefined => TIME_SETS.flatMap((x) => x.cards).find((x) => x.id === c.timeId);

/** 分 is read ふん, ぷん or っぷん, and 30分 さんじゅっぷん, さんじっぷん or (as a reader spells 30分) さんじゅうふん: one spelling. */
const minutes = (k: string): string => k.replace(/じゅっぷん|じっぷん|じゅうふん/g, 'じゅうふん').replace(/っぷん|ぷん/g, 'ふん');

/**
 * Did the utterance carry the time, price or date? Compared as kana (the server reads 4時半 → よじはん,
 * 300円 → さんびゃくえん), with spaces and long-vowel spellings evened out. Whisper writes numbers as
 * digits, so this checks the value came through, not the exact reading.
 */
export function saidTime(u: Utterance, keys: readonly string[]): boolean {
  const heard = new Set([minutes(soundKey(utteranceReading(u))), minutes(soundKey(normalizeReading(u.text)))]);
  return keys.some((k) => {
    const key = minutes(soundKey(k));
    return [...heard].some((h) => h.includes(key));
  });
}

/**
 * Feelings rounds: does it sound like the player said their number? Digits, number kanji, or the kana
 * for tens and hundreds. Only a warning: ふつかよい (二日酔い) and ひとりで have number words in them too.
 */
export function soundsLikeNumber(u: Utterance): boolean {
  const text = `${u.text} ${u.reading ?? ''}`.normalize('NFKC');
  return /[0-9]/.test(text) || /[〇一二三四五六七八九十百]/.test(u.text) || /(じゅう|ひゃく)/.test(u.reading ?? u.text);
}

/** Deals a Time Line: one card per player, always including the punchline (the highest value). */
export function dealTime(set: TimeSet, players: readonly ModePlayer[], random: () => number): TimeCard[] {
  const sorted = [...set.cards].sort((a, b) => a.value - b.value);
  const punch = sorted.at(-1)!;
  const rest = shuffled(sorted.slice(0, -1), random).slice(0, Math.max(0, Math.min(players.length, sorted.length) - 1));
  return shuffled([...rest, punch], random);
}

/** Distinct secret numbers from 1 to 100, spread out a little so two players rarely sit side by side. */
export function dealNumbers(n: number, random: () => number): number[] {
  const out = new Set<number>();
  while (out.size < n) out.add(1 + Math.floor(random() * 100));
  return [...out];
}

/** The ready answers a player is offered: the one nearest their number, and the rest at random. */
export function offersFor(theme: FeelTheme, secret: number, level: Level, random: () => number): number[] {
  const count = level === 'kana' ? OFFERS.kana : OFFERS.other;
  const idx = theme.ready.map((_, i) => i);
  const nearest = [...idx].sort((a, b) => Math.abs(theme.ready[a]!.score - secret) - Math.abs(theme.ready[b]!.score - secret))[0]!;
  const others = shuffled(
    idx.filter((i) => i !== nearest),
    random,
  ).slice(0, count - 1);
  return shuffled([nearest, ...others], random);
}

function pickSet<T extends { id: string }>(pool: T[], used: string[], random: () => number): T {
  const fresh = pool.filter((x) => !used.includes(x.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(random() * from.length)]!;
}

function startRound(s: NarabeteState, ctx: ModeContext): void {
  s.round += 1;
  const kind = roundKind(s.round);
  const audience = ctx.audience ?? 'family';
  const players = ctx.players();
  const random = () => ctx.random();
  const cards: Card[] = [];
  let setId: string;
  if (kind === 'time') {
    const set = pickSet(timeSetsFor(audience), s.usedSets, random);
    setId = set.id;
    const dealt = dealTime(set, players, random);
    players.forEach((p, i) => {
      const tc = dealt[i];
      if (tc) cards.push({ id: ctx.newId(), ownerId: p.id, value: tc.value, timeId: tc.id, offers: [], hinted: false, said: null, hidden: false, moves: 0, again: [] });
    });
  } else {
    const theme = pickSet(feelThemesFor(audience, kind === 'story'), s.usedSets, random);
    setId = theme.id;
    const numbers = dealNumbers(players.length, random);
    players.forEach((p, i) => {
      const secret = numbers[i]!;
      cards.push({ id: ctx.newId(), ownerId: p.id, value: secret, offers: offersFor(theme, secret, p.level, random), hinted: false, said: null, hidden: false, moves: 0, again: [] });
    });
  }
  s.usedSets.push(setId);
  s.current = { index: s.round, kind, setId, cards, line: cards.map((c) => c.id), locks: {}, defence: null, flip: null, votes: {} };
}

const cardOf = (r: Round, id: string) => r.cards.find((c) => c.id === id);
const cardOfPlayer = (r: Round, playerId: string) => r.cards.find((c) => c.ownerId === playerId);

function bonusCap(r: Round): number {
  return round5(BONUS_POOL_SHARE * (PAIR_POINTS * Math.max(1, r.cards.length - 1) + PERFECT_POINTS));
}

/** The share of the bonus a card's saying earned. */
export function sayShare(c: Card, kind: RoundKind, level: Level): number {
  const said = c.said;
  if (!said) return 0;
  if (kind === 'time') {
    if (!said.ok) return said.via === 'speech' ? SAY_SHARE.tried : 0;
    if (said.via === 'speech') return c.hinted && level !== 'kana' ? SAY_SHARE.helped : SAY_SHARE.memory;
    return SAY_SHARE.typed;
  }
  if (!said.ok) return 0;
  if (said.via === 'tap') return SAY_SHARE.tapped;
  if (said.via === 'speech') return said.ready === null ? SAY_SHARE.memory : SAY_SHARE.helped;
  return SAY_SHARE.typed;
}

/** Works out the flip: which pairs are in order, and which card to hold back for last. */
export function computeFlip(r: Round): Omit<Flip, 'teamPoints' | 'bonus'> {
  const cards = r.line.map((id) => cardOf(r, id)!).filter(Boolean);
  const knots: number[] = [];
  for (let i = 0; i < cards.length - 1; i++) if (cards[i]!.value > cards[i + 1]!.value) knots.push(i);
  const maxPairs = Math.max(0, cards.length - 1);
  const pairs = maxPairs - knots.length;
  const truth = [...cards].sort((a, b) => a.value - b.value).map((c) => c.id);
  let last: string | null = null;
  let worst = 0;
  cards.forEach((c, i) => {
    const off = Math.abs(truth.indexOf(c.id) - i);
    if (off > worst) [last, worst] = [c.id, off];
  });
  const order = cards.map((c) => c.id).filter((id) => id !== last);
  if (last) order.push(last);
  return { order, knots, pairs, maxPairs, perfect: knots.length === 0, last };
}

function score(s: NarabeteState, ctx: ModeContext): void {
  const r = s.current;
  if (!r || r.flip) return;
  const f = computeFlip(r);
  const teamPoints = f.pairs * PAIR_POINTS + (f.perfect && f.maxPairs > 0 ? PERFECT_POINTS : 0);
  const cap = bonusCap(r);
  const bonus: Record<string, number> = {};
  for (const p of ctx.players()) {
    const c = cardOfPlayer(r, p.id);
    let share = c ? sayShare(c, r.kind, p.level) : 0;
    if ((r.defence?.playerId === p.id && r.defence.ok) || (r.hard?.playerId === p.id && r.hard.ok)) share += DEFENCE_SHARE;
    bonus[p.id] = Math.min(cap, round5(cap * share));
    if (c?.said?.via === 'speech') stats(s, p.id).spoken += 1;
  }
  r.flip = { ...f, teamPoints, bonus };
  // The Poker Face: in a Feelings round, the author of the card that fooled the team the most.
  if (f.last && r.kind !== 'time') {
    const c = cardOf(r, f.last);
    if (c) stats(s, c.ownerId).poker += 1;
  }
  ctx.cue({ host: 'nobiko', event: f.perfect ? 'narabete_perfect' : 'narabete_knot' });
  phrases(s, r, ctx);
}

function phrases(s: NarabeteState, r: Round, ctx: ModeContext): void {
  for (const c of r.cards) {
    if (!ctx.player(c.ownerId)) continue;
    if (r.kind === 'time') {
      const tc = timeCardOf(c);
      if (!tc) continue;
      const outcome = c.said?.ok && c.said.via === 'speech' ? (c.hinted ? 'retry' : 'said') : c.said?.ok ? 'seen' : 'missed';
      ctx.phrase(c.ownerId, { itemId: `narabete:${tc.id}`, text: tc.jp.text, kana: tc.jp.kana, en: tc.jp.en, outcome, recall: 'memory' });
    } else {
      const theme = themeOf(r.setId);
      const ready = c.said?.ready;
      if (theme && ready !== null && ready !== undefined) {
        const a = theme.ready[ready]!;
        // A ready-made answer picked off the phone: said, but read.
        ctx.phrase(c.ownerId, { itemId: `narabete:${theme.id}:${ready}`, text: a.jp.text, kana: a.jp.kana, en: a.jp.en, outcome: c.said?.via === 'speech' ? 'said' : 'seen', recall: 'read' });
      }
    }
  }
  const hard = r.hard;
  if (hard && hard.answer === 'accepted' && hard.text && ctx.player(hard.playerId)) {
    const script = scriptFor(s, r, hard.cardId, ctx);
    const model = script?.lines[0];
    if (script && model)
      // Said only for their own spoken ので reason; a model line read off the phone (or typed) was seen.
      ctx.phrase(hard.playerId, { itemId: `narabete:defence:${script.spot}`, text: model.text, kana: model.kana, en: `${model.en} (〜ので: giving a reason)`, outcome: hard.ok && hard.framed && !hard.read ? 'said' : 'seen', recall: hard.read ? 'read' : 'memory' });
  }
  const more = r.kind !== 'time' ? themeOf(r.setId)?.more : undefined;
  if (more)
    for (const p of ctx.players()) {
      const line = `Aさんの ほうが ${more.text}！`;
      ctx.phrase(p.id, { itemId: `narabete:hou-ga:${more.text}`, text: line, kana: line, en: `A's is ${more.en}! (〜の ほうが: comparing two things)`, outcome: 'seen' });
    }
}

/** Pays the flip once the last card is over (at the end of `score`), so no score moves while cards are still face down. */
function payFlip(r: Round, ctx: ModeContext): void {
  const f = r.flip;
  if (!f) return;
  for (const p of ctx.players()) {
    const n = f.teamPoints + (f.bonus[p.id] ?? 0);
    if (n) ctx.award(p.id, n);
  }
}

function payVotes(s: NarabeteState, r: Round, ctx: ModeContext): void {
  const counts = new Map<string, number>();
  for (const id of Object.values(r.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [cardId, n] of counts) {
    const c = cardOf(r, cardId);
    if (!c || !ctx.player(c.ownerId)) continue;
    ctx.award(c.ownerId, n * VOTE_POINTS);
    stats(s, c.ownerId).votes += n;
  }
}

/** Who defends in a Feelings round: the author of the card that moved the most (and moved at all). */
function pickDefence(r: Round, ctx: ModeContext): Round['defence'] {
  if (r.kind === 'time') return null;
  const here = new Set(ctx.connected().map((p) => p.id));
  const best = r.cards.filter((c) => c.moves > 0 && c.said && !c.hidden && here.has(c.ownerId)).sort((a, b) => b.moves - a.moves)[0];
  return best ? { playerId: best.ownerId, cardId: best.id, done: false, ok: false, text: null } : null;
}

/**
 * The N4 defender this round: the room's N4 players in turn, skipping any without a card said out loud.
 * None in the room, none offered.
 */
function pickHard(s: NarabeteState, r: Round, ctx: ModeContext): HardDefence | null {
  const here = new Set(ctx.connected().map((p) => p.id));
  const n4 = ctx.players().filter((p) => p.level === 'n4');
  const eligible = (id: string) => {
    const c = cardOfPlayer(r, id);
    return c && c.said && !c.hidden && here.has(id) ? c : null;
  };
  // Spotlight (for Ladi to confirm): in a room of 4 or more, the only eligible N4 player gets a round off
  // after giving the defence.
  const only = n4.filter((p) => eligible(p.id));
  if (only.length === 1 && here.size >= 4 && s.hardLog.some((x) => x.round === s.round - 1 && x.playerId === only[0]!.id && x.answer === 'accepted')) return null;
  for (let k = 0; k < n4.length; k++) {
    const p = n4[(s.round - 1 + k) % n4.length]!;
    const c = eligible(p.id);
    if (c) return { playerId: p.id, cardId: c.id, answer: 'offered', done: false, ok: false, framed: false, text: null };
  }
  return null;
}

/** The N4 defence, if it is still to be said: only once they've taken it. */
const liveHard = (r: Round): HardDefence | null => (r.hard && r.hard.answer === 'accepted' && !r.hard.done ? r.hard : null);

/** The defence the encore is on now. */
function onStand(r: Round): { playerId: string; done: boolean; hard: boolean } | null {
  if (r.encore === 'hard' && r.hard) return { playerId: r.hard.playerId, done: r.hard.done, hard: true };
  if (r.encore === 'defence' && r.defence) return { playerId: r.defence.playerId, done: r.defence.done, hard: false };
  return null;
}

/** Was this defence one of the shown model lines read out? Its reason (before 、) came through whole. */
function readScript(script: DefenceScript | null, reading: string): boolean {
  if (!script) return false;
  const said = soundKey(normalizeReading(reading));
  return script.lines.some((l) => {
    const reason = soundKey(normalizeReading(l.kana.split('、')[0] ?? ''));
    return reason.length >= 3 && said.includes(reason);
  });
}

/** The N4 script for a card where it sits now. */
export function scriptFor(s: NarabeteState, r: Round, cardId: string, ctx: ModeContext): DefenceScript | null {
  const pos = r.line.indexOf(cardId);
  if (pos < 0) return null;
  const before = r.line[pos - 1];
  const name = before ? (ctx.player(cardOf(r, before)?.ownerId ?? '')?.name ?? '') : '';
  const set = r.kind === 'time' ? timeSetOf(r.setId) : undefined;
  const theme = r.kind !== 'time' ? themeOf(r.setId) : undefined;
  if (set) return defenceScript({ unit: set.unit }, pos, r.line.length, name);
  if (theme) return defenceScript({ theme }, pos, r.line.length, name);
  return null;
}

/** N4 defences offered and taken so far, and the rate (`offerRate`: away is left out of both). */
export function hardTally(s: NarabeteState): { offered: number; accepted: number; rate: number | null } {
  const answers = s.hardLog.map((x) => x.answer);
  const counted = answers.filter((a) => a !== 'away');
  return { offered: counted.length, accepted: counted.filter((a) => a === 'accepted').length, rate: offerRate(answers) };
}

const canVote = (r: Round, playerId: string) => r.kind !== 'time' && r.cards.some((c) => c.ownerId !== playerId && c.said && !c.hidden);

function flipSteps(r: Round): number {
  return r.line.length;
}

/** The Worst Day Ever's connectors, so the day gets worse and worse: そして… それから… しかも… さいごに… */
export const joiner = (i: number, n: number): string => (i === 0 ? '' : i === n - 1 ? 'さいごに… ' : (['そして… ', 'それから… ', 'しかも… '][(i - 1) % 3] ?? 'そして… '));

/** How long the TV takes to flip the line (the stage holds the host's line until it's done). */
export const flipMs = (cards: number): number => FLIP_LEAD_MS + FLIP_STEP_MS * cards;

// ---- the mode ----

export const narabeteMode: Mode<NarabeteState, NarabeteView> = {
  info: {
    id: 'narabete',
    title: 'Narabete!',
    titleJa: 'ならべて！',
    blurb: 'Everyone holds a secret card. Say yours, listen, and line them up along Nobiko-san’s neck.',
    host: 'nobiko',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your lines',
    coop: true,
    phaseLabels: { prompt: 'Secret cards', answer: 'Say it', reveal: 'Line up', encore: 'Defence', score: 'Cards over', finale: 'Worst day ever' },
  },

  setup(ctx) {
    const all: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) all[p.id] = blankStats();
    return { round: 0, totalRounds: TOTAL_ROUNDS, current: null, usedSets: [], stats: all, story: null, phaseAt: ctx.now, hardLog: [] };
  },

  next(s, from) {
    const r = s.current;
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return r?.defence || (r && liveHard(r)) ? 'encore' : 'score';
      case 'encore':
        // The ordinary defence first, then the N4 one.
        return r?.encore === 'defence' && liveHard(r) ? 'encore' : 'score';
      case 'score':
        if (s.round < s.totalRounds) return 'prompt';
        return s.story && s.story.order.length ? 'finale' : 'recap';
      case 'finale':
        return s.story && s.story.index < s.story.order.length ? 'finale' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    const r = s.current;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'nobiko', event: 'narabete_intro' });
        break;
      case 'prompt': {
        startRound(s, ctx);
        const cur = s.current!;
        const title = cur.kind === 'time' ? timeSetOf(cur.setId)!.title : themeOf(cur.setId)!.ask;
        ctx.cue({ host: 'nobiko', event: 'narabete_deal', prompt: { text: title.text, kana: title.kana, en: title.en } });
        break;
      }
      case 'answer':
        ctx.cue({ host: 'nobiko', event: 'narabete_say' });
        break;
      case 'reveal':
        if (r) {
          r.line = shuffled(r.line, () => ctx.random());
          r.hard = pickHard(s, r, ctx);
          r.encore = null;
        }
        ctx.cue({ host: 'nobiko', event: 'narabete_order' });
        break;
      case 'encore': {
        if (!r) break;
        r.encore = !r.encore && r.defence ? 'defence' : 'hard';
        const on = onStand(r);
        // The N4 defence is about the player's own card, wherever it sits: its own cue (not "it moved a lot").
        if (on) ctx.cue({ host: 'nobiko', event: on.hard ? 'narabete_hard' : 'narabete_defence', slots: { name: ctx.player(on.playerId)?.name ?? '' } });
        break;
      }
      case 'score':
        score(s, ctx);
        break;
      case 'finale':
        if (s.story?.index === 0) ctx.cue({ host: 'nobiko', event: 'narabete_story' });
        break;
    }
  },

  leave(s, phase, ctx) {
    const r = s.current;
    if (!r) return;
    if (phase === 'reveal') {
      r.defence = pickDefence(r, ctx);
      const hard = r.hard;
      const gone = !!hard && !ctx.connected().some((p) => p.id === hard.playerId);
      // The VIP hid it: no N4 defence. An offer still open as the line-up ends timed out (away if they left).
      if (hard && cardOf(r, hard.cardId)?.hidden) r.hard = null;
      else if (hard && hard.answer === 'offered') hard.answer = gone ? 'away' : 'timeout';
      else if (hard && gone) r.hard = null;
      // One defence each: the N4 player who also moved the most gives the N4 one.
      if (r.hard && liveHard(r) && r.defence?.playerId === r.hard.playerId) r.defence = null;
    }
    if (phase === 'score') {
      if (r.hard) s.hardLog.push({ round: r.index, playerId: r.hard.playerId, answer: r.hard.answer === 'offered' ? 'timeout' : r.hard.answer });
      payFlip(r, ctx);
      payVotes(s, r, ctx);
      if (r.kind === 'story') {
        const order = [...r.cards]
          .filter((c) => c.said && !c.hidden && ctx.player(c.ownerId))
          .sort((a, b) => a.value - b.value)
          .map((c) => c.id);
        s.story = { order, index: 0, done: {} };
      }
    }
    if (phase === 'finale' && s.story) s.story.index += 1;
  },

  duration(s, phase) {
    const r = s.current;
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.prompt;
      case 'answer':
        return DURATIONS.answer;
      case 'reveal':
        return DURATIONS.reveal;
      case 'encore':
        return r?.encore === 'hard' ? DURATIONS.encoreN4 : DURATIONS.encore;
      case 'score':
        return flipMs(r ? flipSteps(r) : 0) + (r && r.kind !== 'time' ? DURATIONS.scoreVoteTail : DURATIONS.scoreTail);
      case 'finale':
        return DURATIONS.finale;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    const r = s.current;
    if (!here.length || !r) return false;
    if (phase === 'answer') return here.every((p) => !cardOfPlayer(r, p.id) || cardOfPlayer(r, p.id)!.said);
    if (phase === 'reveal') return here.every((p) => !cardOfPlayer(r, p.id) || r.locks[p.id]);
    if (phase === 'encore') {
      const on = onStand(r);
      return !on || on.done || !here.some((p) => p.id === on.playerId);
    }
    if (phase === 'finale') {
      const st = s.story;
      const id = st?.order[st.index];
      if (!st || !id) return true;
      const c = cardOf(r, id);
      return !c || !!st.done[id] || !here.some((p) => p.id === c.ownerId);
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    const r = s.current;
    if (!r) return moveError('wrong-phase');
    const player = ctx.player(playerId)!;
    const mine = cardOfPlayer(r, playerId);
    switch (raw.kind) {
      case 'hint': {
        if (phase !== 'answer' || r.kind !== 'time') return moveError('wrong-phase');
        if (!mine) return moveError('not-playing');
        mine.hinted = true;
        return MOVE_OK;
      }
      case 'say': {
        if (phase !== 'answer' && !(phase === 'reveal' && r.kind === 'time')) return moveError('wrong-phase');
        if (!mine) return moveError('not-playing');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
        if (!text) return moveError('empty-answer');
        const u: Utterance = { ...raw.utterance, text };
        if (!playerTextAllowed(text, ctx.audience)) return moveError('kids-words');
        if (phase === 'reveal') {
          // Saying it again for someone who asked: it clears their request.
          mine.again = [];
          return MOVE_OK;
        }
        if (r.kind === 'time') {
          const tc = timeCardOf(mine);
          const ok = !!tc && saidTime(u, tc.keys);
          // A good saying is never replaced by a worse one.
          if (mine.said?.ok && !ok) return MOVE_OK;
          mine.said = { text, via: u.via, ok, warn: false, ready: null };
        } else {
          const theme = themeOf(r.setId)!;
          const ready = mine.offers.find((i) => normalizeReading(theme.ready[i]!.jp.kana) === normalizeReading(utteranceReading(u)) || normalizeReading(theme.ready[i]!.jp.kana) === normalizeReading(text));
          mine.said = { text: tidyJa(text), via: u.via, ok: hasJapanese(text), warn: soundsLikeNumber(u), ready: ready ?? null };
        }
        return MOVE_OK;
      }
      case 'ready': {
        if (phase !== 'answer' || r.kind === 'time') return moveError('wrong-phase');
        if (!mine) return moveError('not-playing');
        const key = raw.key;
        if (typeof key !== 'number' || !mine.offers.includes(key)) return moveError('bad-move');
        const a = themeOf(r.setId)!.ready[key]!;
        mine.said = { text: a.jp.text, via: 'tap', ok: true, warn: false, ready: key };
        return MOVE_OK;
      }
      case 'move': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        if (!mine) return moveError('not-playing');
        if (raw.dir !== -1 && raw.dir !== 1) return moveError('bad-move');
        const i = r.line.indexOf(mine.id);
        const j = i + raw.dir;
        // At an end, or a tap sent from a screen a step behind: nothing to do.
        if (i < 0 || j < 0 || j >= r.line.length) return MOVE_OK;
        const other = cardOf(r, r.line[j]!)!;
        [r.line[i], r.line[j]] = [r.line[j]!, r.line[i]!];
        mine.moves += 1;
        // Both cards moved, so both players look again.
        delete r.locks[playerId];
        delete r.locks[other.ownerId];
        return MOVE_OK;
      }
      case 'lock': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        if (!mine) return moveError('not-playing');
        if (raw.locked === false) delete r.locks[playerId];
        else r.locks[playerId] = true;
        return MOVE_OK;
      }
      case 'again': {
        if (phase !== 'reveal' || r.kind !== 'time') return moveError('wrong-phase');
        const c = typeof raw.cardId === 'string' ? cardOf(r, raw.cardId) : undefined;
        if (!c) return moveError('unknown-card');
        if (c.ownerId === playerId) return moveError('own-card');
        if (!c.again.includes(player.name)) c.again.push(player.name);
        stats(s, playerId).again += 1;
        return MOVE_OK;
      }
      case 'hide': {
        if (phase !== 'reveal' && phase !== 'score') return moveError('wrong-phase');
        if (ctx.vipId !== playerId) return moveError('not-vip');
        const c = typeof raw.cardId === 'string' ? cardOf(r, raw.cardId) : undefined;
        if (!c) return moveError('unknown-card');
        c.hidden = true;
        for (const [voter, id] of Object.entries(r.votes)) if (id === c.id) delete r.votes[voter];
        return MOVE_OK;
      }
      case 'hard': {
        // Yes to the N4 defence, or "not this time". Until it's said; a yes only during the line-up.
        if (phase !== 'reveal' && phase !== 'encore') return moveError('wrong-phase');
        const hard = r.hard;
        if (!hard || hard.playerId !== playerId) return moveError('not-offered');
        if (hard.done || hard.answer === 'timeout' || hard.answer === 'away') return MOVE_OK;
        if (phase === 'encore' && raw.accept === true && hard.answer !== 'accepted') return moveError('wrong-phase');
        hard.answer = raw.accept === true ? 'accepted' : 'declined';
        if (hard.answer === 'declined') hard.done = true;
        return MOVE_OK;
      }
      case 'defend': {
        if (phase !== 'encore') return moveError('wrong-phase');
        if (r.encore === 'hard' && r.hard) {
          const hard = r.hard;
          if (hard.playerId !== playerId) return moveError('not-yours');
          if (hard.done) return MOVE_OK;
          hard.done = true;
          if (raw.pass === true) {
            if (hard.answer === 'offered') hard.answer = 'declined';
            return MOVE_OK;
          }
          if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
          hard.answer = 'accepted';
          const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
          if (!text || !playerTextAllowed(text, ctx.audience)) return MOVE_OK;
          hard.text = tidyJa(text);
          hard.ok = raw.utterance.via === 'speech' && hasJapanese(text);
          hard.framed = /ので/.test(utteranceReading(raw.utterance)) || /ので/.test(text);
          hard.read = readScript(scriptFor(s, r, hard.cardId, ctx), utteranceReading(raw.utterance));
          return MOVE_OK;
        }
        if (!r.defence) return moveError('wrong-phase');
        if (r.defence.playerId !== playerId) return moveError('not-yours');
        if (r.defence.done) return MOVE_OK;
        r.defence.done = true;
        if (raw.pass === true) return MOVE_OK;
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
        if (!text || !playerTextAllowed(text, ctx.audience)) return MOVE_OK;
        r.defence.text = tidyJa(text);
        r.defence.ok = raw.utterance.via === 'speech' && hasJapanese(text);
        return MOVE_OK;
      }
      case 'vote': {
        if (phase !== 'score' || r.kind === 'time') return moveError('wrong-phase');
        if (r.votes[playerId]) return moveError('already-voted');
        const c = typeof raw.cardId === 'string' ? cardOf(r, raw.cardId) : undefined;
        if (!c || !c.said || c.hidden) return moveError('unknown-card');
        if (c.ownerId === playerId) return moveError('own-card');
        r.votes[playerId] = c.id;
        return MOVE_OK;
      }
      case 'perform': {
        if (phase !== 'finale' || !s.story) return moveError('wrong-phase');
        const id = s.story.order[s.story.index];
        const c = id ? cardOf(r, id) : undefined;
        if (!c || c.ownerId !== playerId) return moveError('not-your-turn');
        if (s.story.done[c.id]) return MOVE_OK;
        if (raw.pass === true) {
          s.story.done[c.id] = 'passed';
          return MOVE_OK;
        }
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        s.story.done[c.id] = 'said';
        if (raw.utterance.via === 'speech') ctx.award(playerId, PERFORM_POINTS);
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const r = s.current;
    if (!r) return;
    const c = cardOfPlayer(r, playerId);
    delete r.locks[playerId];
    delete r.votes[playerId];
    if (!c || r.flip) return;
    r.cards = r.cards.filter((x) => x !== c);
    r.line = r.line.filter((id) => id !== c.id);
    for (const [voter, id] of Object.entries(r.votes)) if (id === c.id) delete r.votes[voter];
    if (r.defence?.playerId === playerId) r.defence = null;
    if (r.hard?.playerId === playerId) r.hard = null;
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase: Phase, viewer: Viewer, ctx) {
    const r = s.current;
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const kind = r?.kind ?? null;
    const set = r && r.kind === 'time' ? timeSetOf(r.setId) : undefined;
    const theme = r && r.kind !== 'time' ? themeOf(r.setId) : undefined;
    const flipped = !!r?.flip && (phase === 'score' || phase === 'finale');
    const showTime = r?.kind === 'time' && flipped;
    const lineShown = phase === 'reveal' || phase === 'encore' || phase === 'score' || phase === 'finale';

    const lineOrder = r ? (lineShown ? r.line : r.cards.map((c) => c.id)) : [];
    const line: LineCard[] = r
      ? lineOrder
          .map((id) => cardOf(r, id))
          .filter((c): c is Card => !!c)
          .map((c, i) => {
            const tc = r.kind === 'time' ? timeCardOf(c) : undefined;
            const ready = theme && c.said?.ready !== null && c.said?.ready !== undefined ? theme.ready[c.said.ready] : undefined;
            const feelText = c.said && r.kind !== 'time' && lineShown ? (c.hidden ? '[hidden]' : c.said.text) : null;
            const card: LineCard = {
              id: c.id,
              ownerId: c.ownerId,
              text: tc ? (showTime ? tc.jp.text : null) : feelText,
              en: tc ? (showTime ? tc.jp.en : null) : ready && !c.hidden && flipped ? ready.jp.en : null,
              emoji: tc ? (lineShown ? tc.emoji : null) : ready && lineShown && !c.hidden ? ready.emoji : null,
              said: !!c.said,
              locked: !!r.locks[c.ownerId],
              again: c.again.length,
              hidden: c.hidden,
            };
            if (tc && lineShown) card.picture = cardPicture(tc.id);
            else if (ready && theme && lineShown && !c.hidden) card.picture = answerPicture(theme.id, c.said!.ready!);
            if (me && c.ownerId === me.id) card.mine = true;
            if (flipped && r.flip) {
              card.value = c.value;
              if (tc) card.label = tc.label;
              card.flip = r.flip.order.indexOf(c.id);
              card.knotAfter = r.flip.knots.includes(i);
              card.last = r.flip.last === c.id;
              if (phase === 'finale' || (phase === 'score' && r.kind !== 'time')) card.votes = Object.values(r.votes).filter((v) => v === c.id).length;
            }
            return card;
          })
      : [];

    const story = s.story && phase === 'finale' ? { order: s.story.order, index: s.story.index, current: s.story.order[s.story.index] ?? null } : null;
    const poker = r?.flip?.last && r.kind !== 'time' ? (cardOf(r, r.flip.last)?.ownerId ?? null) : null;

    const stand = r && phase === 'encore' ? onStand(r) : null;
    let defence: NarabeteView['defence'] = null;
    if (r && (phase === 'encore' || phase === 'score')) {
      // The encore shows the defence on now; the score, the round's defence (the ordinary one first).
      const hardOn = phase === 'encore' ? !!stand?.hard : !r.defence && !!r.hard?.text;
      if (hardOn && r.hard) defence = { playerId: r.hard.playerId, text: r.hard.text, done: r.hard.done, n4: true, frame: scriptFor(s, r, r.hard.cardId, ctx)?.frame ?? null };
      else if (r.defence && (phase === 'score' || stand)) defence = { playerId: r.defence.playerId, text: r.defence.text, done: r.defence.done, n4: false, frame: null };
    }

    let mine: NarabeteView['me'] = null;
    if (me && r) {
      const c = cardOfPlayer(r, me.id);
      const tc = c ? timeCardOf(c) : undefined;
      const romaji = me.level === 'kana';
      const pos = c ? r.line.indexOf(c.id) : -1;
      const showJp = !!tc && (c!.hinted || me.level === 'kana');
      const current = s.story && phase === 'finale' ? s.story.order[s.story.index] : undefined;
      mine = {
        level: me.level,
        cardId: c?.id ?? null,
        time: tc ? { emoji: tc.emoji, picture: cardPicture(tc.id), label: tc.label, en: tc.jp.en, jp: showJp ? tc.jp : null, ...(showJp && romaji ? { romaji: toRomaji(tc.jp.kana) } : {}) } : null,
        secret: c && r.kind !== 'time' ? c.value : null,
        offers:
          c && theme && phase === 'answer'
            ? c.offers.map((i) => {
                const a = theme.ready[i]!;
                return { key: i, text: a.jp.text, en: a.jp.en, emoji: a.emoji, picture: answerPicture(theme.id, i), ...(romaji ? { romaji: toRomaji(a.jp.kana) } : {}) };
              })
            : [],
        frames: theme && phase === 'answer' ? theme.frames : [],
        swerve: theme && phase === 'answer' ? theme.swerve : [],
        said: c?.said ? { text: c.said.text, ok: c.said.ok, warn: c.said.warn } : null,
        locked: !!r.locks[me.id],
        canMove: { left: phase === 'reveal' && pos > 0, right: phase === 'reveal' && pos >= 0 && pos < r.line.length - 1 },
        position: pos,
        againFrom: phase === 'reveal' && c ? c.again : [],
        canVote: phase === 'score' && !r.votes[me.id] && canVote(r, me.id),
        votedFor: (phase === 'score' && r.votes[me.id]) || null,
        defending: !!stand && stand.playerId === me.id && !stand.done,
        hard:
          r.hard && r.hard.playerId === me.id && (r.hard.answer === 'offered' || r.hard.answer === 'accepted') && !r.hard.done && (phase === 'reveal' || phase === 'encore')
            ? { answer: r.hard.answer, script: stand?.hard ? scriptFor(s, r, r.hard.cardId, ctx) : null }
            : null,
        performing: current && c && current === c.id && !s.story!.done[c.id] ? { text: c.said?.text ?? '' } : null,
        bonus: r.flip?.bonus[me.id] ?? 0,
      };
    }

    return {
      mode: 'narabete',
      round: s.round,
      totalRounds: s.totalRounds,
      kind,
      phaseAt: s.phaseAt,
      title: set?.title ?? theme?.ask ?? null,
      more: theme?.more ?? null,
      low: set?.low ?? theme?.low ?? null,
      high: set?.high ?? theme?.high ?? null,
      unit: set ? set.unit : theme ? 'feel' : null,
      line,
      said: r ? r.cards.filter((c) => c.said).map((c) => c.ownerId) : [],
      locked: r && phase === 'reveal' ? Object.keys(r.locks) : [],
      flip: r?.flip && flipped ? { pairs: r.flip.pairs, maxPairs: r.flip.maxPairs, perfect: r.flip.perfect, last: r.flip.last, poker, teamPoints: r.flip.teamPoints, steps: r.flip.order.length } : null,
      defence,
      story,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: PlayerStats) => number): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = 0;
      for (const p of players) {
        const v = f(stats(s, p.id));
        if (v > val) [top, val] = [p, v];
      }
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best((st) => st.poker), 'ポーカーフェイス賞', 'Poker Face: made a big number sound small');
    add(best((st) => st.votes), 'おもしろ賞', 'Funniest: most votes for an answer');
    add(best((st) => st.spoken), 'いいこえ賞', 'Best Voice: said the most cards out loud');
    add(best((st) => st.again), 'ききじょうず賞', 'Good Listener: asked to hear it again the most');
    return out;
  },
};
