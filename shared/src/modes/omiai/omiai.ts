// Omiai Matchmaker (おみあい マッチメーカー): a formal "meet the family" introduction show,
// scored on politeness. Host: Nobiko-san, as the matchmaker (なこうど). See docs/modes/omiai.md.
//
// One guest per game (a character card: a kappa cucumber farmer, a retired robot vacuum …).
// Each round the guest asks everyone one question, and everyone answers in Japanese:
//   prompt  the guest asks (N4 players hear the keigo version)
//   answer  say it first (N5/N4, 5 s), then answer tiles appear: polite and casual endings side
//           by side, so even a tile answer is a register choice. Speak, type or tap.
//   reveal  Nobiko-san reads every answer anonymously; everyone votes for the most charming one
//   encore  authors and manners meters revealed; the guest reacts to each register. Every phone
//           privately shows a more polite version of its own answer; say it for a bonus
//   score   points, and the winning answer's polite version on the stage
// After the last round (the closing appeal, ×2), the finale: the guest invites one contestant to
// tea, or to play for a Kids guest (most hearts: votes received plus a star for each round with good manners).
//
// The manners meter is the pure rule-based checker in manners.ts. Nothing here waits on an LLM.
//
// The go-between (なこうど, N4 hard role): when the room has an N4 player, each round one of them
// (in seat rotation) is offered Nobiko-san's keigo lines for that round: the opening as the guest
// asks (prompt: ごしょうかい いたします, おききに なります …) and the closing as the score comes up
// (つぎの しつもんに まいります, おかえりに なります). Said or typed from the phone's script; "not this
// time" leaves the lines to Nobiko-san. Everyone's answers, votes and points are unchanged.

import type { JpText, Level } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH, POINTS_PER_VOTE } from '../../constants.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { toRomaji } from '../../japanese/romaji.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { saidPhrase } from '../phraseBingo/check.js';
import { appealQuestion, CARDS, cardsFor, CLOSERS, introQuestion, keigoPair, NAKODO_KEYS, nakodoLines, OPENERS, withName, type CharacterCard, type KeigoPair, type NakodoLine, type OmiaiQuestion } from './cards.js';
import { analysisText, checkManners, type CasualHit, type MannersResult, type Register } from './manners.js';
import { playerTextAllowed } from '../../moderation.js';
import { nextOfferee, offerRate, type OfferAnswer } from '../hardRoleLog.js';
import { commentaryMs, galleryBubbles, galleryTileFor, gistFor, hostStandsIn, lightUp, openGallery, pickGallery, type Commentary, type Gallery, type GalleryTileView, type ReactionTile } from '../mixedRoom.js';

// ---- tuning ----

export const TOTAL_ROUNDS = 4;
/** The say-it-first window before tiles appear, from N5 up. */
export const SAY_FIRST_MS = 5_000;
const SAY_FIRST_SLACK_MS = 750;
/** All Japanese and speaking bonuses come from one pool: at most 30% of the vote points at stake. */
export const BONUS_POOL_SHARE = 0.3;
const COMEBACK = 1.5;
/** Share of the manners bonus each way of answering earns (times the meter). */
export const STYLE_SHARE = { 'memory-spoken': 1, 'memory-typed': 0.7, spoken: 0.85, typed: 0.55, tiles: 0.45 } as const;
export type AnswerStyle = keyof typeof STYLE_SHARE;
/** Saying your polite version back in the encore, as a share of the bonus cap. */
export const ENCORE_SHARE = { winner: { speech: 0.35, typed: 0.1 }, other: { speech: 0.25, typed: 0.1 } } as const;
export const ENCORE_TRIES = 2;
/** A round with at least this meter earns a manners star (a heart for the finale). */
export const STAR_METER = 70;
/** The guest's tea invitation at the finale. */
export const ACCEPT_POINTS = 200;
const MAX_TILES = 6;
/** The go-between's line, said aloud or typed. */
export const NAKODO_POINTS = { speech: 25, typed: 10 } as const;
export const NAKODO_TRIES = 2;

export const DURATIONS = {
  intro: 16_000,
  prompt: 8_000,
  answer: 55_000,
  revealBase: 10_000,
  revealPerAnswer: 3_500,
  revealMax: 40_000,
  encore: 15_000,
  score: 9_000,
  finale: 14_000,
  /** Extra prompt and score time while a go-between has a line to say. */
  nakodo: 12_000,
  /** Time Nobiko-san gets to read the question once it's cued, before the answer phase opens. */
  questionRead: 5_000,
  /** The most time Nobiko-san takes to say an accepted go-between line (see voiceMs); added to the go-between's prompt and score. */
  nakodoVoice: 7_000,
  /** The score's own line (the natural version) gets this long before she says the go-between's closing. */
  naturalRead: 5_000,
  /** Her あらまあ once she has said the go-between's opening, before she reads the question. */
  cheer: 2_500,
} as const;

/**
 * About how long Nobiko-san takes to say a line on the TV: her voice can land up to 1.5 s late (the bank voice
 * waits that long for its audio), then roughly 0.11 s a kana. Capped at DURATIONS.nakodoVoice.
 */
export const voiceMs = (kana: string): number => Math.min(DURATIONS.nakodoVoice, 1_500 + 110 * kana.replace(/\s/g, '').length);

// ---- state ----

export interface Tile {
  key: string;
  jp: JpText;
  role: 'opener' | 'lead' | 'fill' | 'ending' | 'closer';
  casual: boolean;
}

export interface Slot {
  openedAt: number;
  tilesShown: boolean;
  tiles: Tile[];
}

/** What the phone shows privately after the vote: the more polite version and the pattern. */
export interface Tip {
  kind: 'rewrite' | 'upgrade' | 'perfect' | 'stock';
  /** What to say back in the encore. */
  target: { text: string; kana: string };
  note: string;
  /** The question's stock polite answer at this player's level. */
  example: JpText;
  /** For a polite N5 answer: the N4 step up, shown as a bonus line. */
  next: { text: string; note: string } | null;
}

export interface Answer {
  id: string;
  authorId: string;
  text: string;
  via: Utterance['via'];
  style: AnswerStyle;
  english: boolean;
  manners: MannersResult;
  tip: Tip;
  hidden: boolean;
}

export interface Encore {
  tries: number;
  ok: boolean;
  passed: boolean;
  heard: string;
  via: Utterance['via'] | null;
}

export interface ResultLine {
  answerId: string;
  authorId: string;
  votes: number;
  votePoints: number;
  bonus: number;
  encoreBonus: number;
  cap: number;
  winner: boolean;
  star: boolean;
}

export interface Round {
  index: number;
  question: OmiaiQuestion;
  slots: Record<string, Slot>;
  answers: Answer[];
  /** Reveal order (shuffled, so it doesn't show who answered first). */
  order: string[];
  votes: Record<string, string>;
  encores: Record<string, Encore>;
  result: ResultLine[] | null;
  /** The answer Nobiko-san teases as the answers are revealed (Cheeky rooms only; see pickTease). */
  tease?: string;
  /** When Nobiko-san reads the question (once a round, go-between or not): later than the cue when she says the opening first. */
  cuedAt?: number;
  /** When Nobiko-san has finished saying the go-between's accepted closing, so the score waits for it. */
  voicedUntil?: number;
  /** The Gallery while the go-between gives the opening (players without the seat; mixedRoom.ts). */
  gallery?: Gallery | null;
  /** The commentary booth's replay of the go-between's landed opening. */
  booth?: Commentary | null;
  /** Nobiko-san giving the opening herself, in a 2-player room with nobody at N4 (once a game). */
  standIn?: Commentary | null;
}

export type NakodoSlot = 'open' | 'close';

export interface NakodoTry {
  tries: number;
  ok: boolean;
  via: Utterance['via'] | null;
  heard: string;
  /** The manners meter of what they said (rule-based, manners.ts). */
  meter: number | null;
  points: number;
}

/** This round's go-between (N4 hard role). */
export interface GoBetween {
  round: number;
  playerId: string;
  /** offered: not answered yet; accepted: tapped Take it or tried a line; timeout: the opening passed unanswered. */
  status: 'offered' | 'accepted' | 'declined' | 'timeout';
  lines: Record<NakodoSlot, NakodoTry>;
}

export interface PlayerStats {
  votes: number;
  stars: number;
  meterTotal: number;
  keigo: number;
  brave: number;
  echoes: number;
}

export interface OmiaiState {
  cardId: string;
  round: number;
  totalRounds: number;
  current: Round | null;
  stats: Record<string, PlayerStats>;
  accepted: string | null;
  phaseAt: number;
  /** Players Nobiko-san has teased this game: at most TEASE_MAX, never the same one twice. */
  teased?: string[];
  nakodo?: GoBetween | null;
  /** The last go-between's seat, for the rotation. */
  nakodoSeat?: number;
  /** Every go-between offer and what came of it. */
  nakodoLog?: { round: number; playerId: string; outcome: OfferAnswer }[];
  /** The once-a-game Gallery curveball has been dealt. */
  curveballUsed?: boolean;
  /** The once-a-game host stand-in has been played. */
  standInUsed?: boolean;
}

// ---- view ----

export interface CardView {
  id: string;
  emoji: string;
  name: JpText;
  job: JpText;
  hobbies: JpText[];
  quirk: string;
  /** Who the guest is for: a Kids guest invites someone to play, everyone else to tea. */
  audience: Audience;
}

/** How the finale's invitation reads on the stage and phones: tea, or for a Kids guest, play. */
export function invitation(card: Pick<CardView, 'audience'> | null | undefined) {
  return card?.audience === 'kids'
    ? { emoji: '🎈', to: 'to play', ask: 'will you come and play?', you: 'You’re invited to play!', all: 'Playtime for everyone! The guest made lots of friends.', award: { title: 'あそびの しょうたい', en: 'Invited to Play: the guest’s new friend' } }
    : { emoji: '🍵', to: 'to tea', ask: 'will you come to tea?', you: 'You’re invited to tea!', all: 'Tea for everyone! The guest enjoyed meeting you all.', award: { title: 'おちゃの しょうたい', en: 'Invited to Tea: the guest’s choice' } };
}

export interface QuestionView {
  text: string;
  kana: string;
  en: string;
  romaji?: string;
}

export interface TileView {
  key: string;
  text: string;
  en: string;
  role: Tile['role'];
  romaji?: string;
}

export interface Reaction {
  emoji: string;
  jp: JpText;
}

export interface AnswerCard {
  id: string;
  text: string;
  hidden: boolean;
  mine?: boolean;
  /** From the encore on. */
  authorId?: string;
  authorName?: string;
  meter?: number;
  register?: Register;
  reaction?: Reaction;
  votes?: number;
  points?: number;
  winner?: boolean;
  encore?: 'said' | 'typed' | 'tried' | 'passed' | null;
  /** While the answers are revealed: the one Nobiko-san cranes her neck over to tease. */
  tease?: boolean;
}

export interface TipView {
  kind: Tip['kind'];
  mine: string;
  target: { text: string; kana: string; romaji?: string };
  note: string;
  example: JpText;
  next: Tip['next'];
  meter: number;
  register: Register;
  casual: CasualHit[];
  /** Short labels for what earned the meter (はじめまして, です/ます, keigo …). */
  good: string[];
  keigo: KeigoPair | null;
  points: number;
  votes: number;
}

export interface OmiaiView {
  mode: 'omiai';
  round: number;
  totalRounds: number;
  multiplier: number;
  phaseAt: number;
  card: CardView | null;
  /** The guest's greeting (intro and round 1). */
  greeting: JpText | null;
  /** What the guest asks, as the stage shows it (N5 version). */
  question: QuestionView | null;
  roundKind: 'intro' | 'question' | 'appeal' | null;
  answered: string[];
  answers: AnswerCard[];
  voters: string[];
  voted: string[];
  /** Score phase: the winning answer said politely (or the stock answer when there was no winner). */
  natural: { text: string; kana: string; en: string; from: string | null } | null;
  hearts: Record<string, number>;
  finale: { accepted: string | null; line: JpText | null; ranking: { playerId: string; hearts: number }[] } | null;
  /** The round's go-between (prompt and score): their line once said. */
  /** pending: their line for this phase is still to come. */
  nakodo: { playerId: string; slot: NakodoSlot; declined: boolean; line: JpText | null; via: Utterance['via'] | null; points: number; pending: boolean } | null;
  /** Prompt: the commentary booth's replay of the go-between's opening, or Nobiko-san's own (the stand-in). */
  booth: { playerId: string | null; lit: Commentary['lit']; note: string; en: string; ms: number; standIn: boolean } | null;
  /** Prompt: the Gallery's reaction bubbles. */
  bubbles: ReactionTile[];
  me: {
    level: Level;
    slot: { question: QuestionView; sayFirst: boolean; sayFirstMs: number; tiles: TileView[] } | null;
    answer: string | null;
    canVote: boolean;
    votedFor: string | null;
    encore: { canEncore: boolean; ok: boolean; triesLeft: number; heard: string; winner: boolean; target: TipView['target'] } | null;
    tip: TipView | null;
    accepted: boolean;
    /** When you are this round's go-between. */
    nakodo: NakodoMe | null;
    /** Prompt: your Gallery tile while the go-between speaks (players without the seat). */
    gallery: GalleryTileView | null;
    /** Prompt, Kana and N5 phones: the gist of the keigo opening, in plain Japanese. */
    gist: ReturnType<typeof gistFor>;
  } | null;
}

export interface NakodoMe {
  status: GoBetween['status'];
  /** The line for this phase (the script to say), or null between them. */
  slot: NakodoSlot | null;
  line: JpText | null;
  frames: readonly string[];
  canSay: boolean;
  ok: boolean;
  triesLeft: number;
  heard: string;
  meter: number | null;
  points: number;
  /** Both lines, so the offer can show what's coming. */
  open: JpText;
  close: JpText;
}

export type OmiaiMove =
  | { kind: 'tiles' }
  | { kind: 'answer'; utterance: Utterance }
  | { kind: 'answer'; tiles: string[] }
  | { kind: 'vote'; answerId: string }
  | { kind: 'hide'; answerId: string }
  | { kind: 'encore'; utterance: Utterance }
  | { kind: 'encore'; pass: true }
  | { kind: 'nakodo'; accept: boolean }
  | { kind: 'nakodo'; utterance: Utterance }
  | { kind: 'gallery'; pick: string };

// ---- helpers ----

const round5 = (n: number) => Math.round(n / 5) * 5;
const blankStats = (): PlayerStats => ({ votes: 0, stars: 0, meterTotal: 0, keigo: 0, brave: 0, echoes: 0 });
const stats = (s: OmiaiState, id: string) => (s.stats[id] ??= blankStats());
const multiplierFor = (s: OmiaiState) => (s.round === s.totalRounds ? 2 : 1);
export const cardOf = (s: OmiaiState): CharacterCard => CARDS.find((c) => c.id === s.cardId) ?? CARDS[0]!;
const hasJapanese = (t: string) => /[ぁ-ゖァ-ヺ一-鿿]/.test(t);
const isKanaOnly = (t: string) => !/[一-鿿]/.test(t);

/** Which question a round asks: the self-introduction first, the closing appeal last, the card's own in between. */
export function questionFor(card: CharacterCard, round: number, total: number): OmiaiQuestion {
  if (round <= 1) return introQuestion(card);
  if (round >= total) return appealQuestion(card);
  return card.questions[(round - 2) % card.questions.length]!;
}

export function roundKind(round: number, total: number): 'intro' | 'question' | 'appeal' {
  return round <= 1 ? 'intro' : round >= total ? 'appeal' : 'question';
}

/** The guest's question at a player's level (Kana players see the N5 one with romaji). */
function questionView(q: OmiaiQuestion, level: Level | 'stage'): QuestionView {
  const jp = level === 'n4' ? q.ask.n4 : q.ask.n5;
  return { text: jp.text, kana: jp.kana, en: jp.en, ...(level === 'kana' ? { romaji: toRomaji(jp.kana) } : {}) };
}

const atLeast = (level: Level, min: Level | undefined) => !min || ['kana', 'n5', 'n4'].indexOf(level) >= ['kana', 'n5', 'n4'].indexOf(min);

/** Deals one player's answer tiles: polite and casual choices mixed together, shuffled within each part. */
export function dealTiles(q: OmiaiQuestion, kind: 'intro' | 'question' | 'appeal', player: ModePlayer, random: () => number): Tile[] {
  const kana = player.level === 'kana';
  const out: Tile[] = [];
  const add = (role: Tile['role'], items: { jp: JpText; casual: boolean }[]) => {
    for (const it of shuffled(items, random)) out.push({ key: `${role}${out.length}`, jp: it.jp, role, casual: it.casual });
  };
  const openers = kind === 'intro' ? OPENERS.intro : OPENERS[q.kind];
  add('opener', [...openers.polite.slice(0, kana ? 1 : 2).map((jp) => ({ jp, casual: false })), ...openers.casual.map((jp) => ({ jp, casual: true }))]);
  if (q.lead) add('lead', [{ jp: q.lead, casual: false }]);
  const fills = q.fills.map((f) => withName(f, player.name));
  add('fill', fills.slice(0, kana ? 3 : 4).map((jp) => ({ jp, casual: false })));
  add('ending', [
    ...q.endings.polite.filter((e) => atLeast(player.level, e.minLevel)).map((e) => ({ jp: e.jp, casual: false })),
    ...q.endings.casual.slice(0, kana ? 1 : 2).map((e) => ({ jp: e.jp, casual: true })),
  ]);
  if (kind !== 'question') add('closer', [...CLOSERS.polite.map((jp) => ({ jp, casual: false })), ...CLOSERS.casual.map((jp) => ({ jp, casual: true }))]);
  return out;
}

/** Joins tiles into an answer: a lead is followed by a space, everything else attaches. */
export function joinTiles(tiles: readonly Tile[]): string {
  let out = '';
  tiles.forEach((t, i) => {
    out += t.jp.text;
    if (t.role === 'lead' && i < tiles.length - 1) out += ' ';
  });
  return out;
}

/** The guest's reaction to an answer's register (shown on the stage after the vote). */
export function reactionFor(register: Register): Reaction {
  switch (register) {
    case 'keigo':
      return { emoji: '🫖', jp: { text: 'まあ、ごていねいに！', kana: 'まあ、ごていねいに！', en: 'Oh my, how very courteous!' } };
    case 'polite':
      return { emoji: '😊', jp: { text: 'すてきですね。', kana: 'すてきですね。', en: 'How lovely.' } };
    case 'mixed':
      return { emoji: '🙂', jp: { text: 'あら、おしい！', kana: 'あら、おしい！', en: 'Oh, so close!' } };
    case 'plain':
      return { emoji: '🤔', jp: { text: 'ふむふむ。', kana: 'ふむふむ。', en: 'I see, I see…' } };
    case 'casual':
      return { emoji: '😳', jp: { text: 'あらまあ…', kana: 'あらまあ…', en: 'Oh my… (a teacup rattles)' } };
    default:
      return { emoji: '🙃', jp: { text: '…にほんごで どうぞ！', kana: '…にほんごで どうぞ！', en: '…in Japanese, please!' } };
  }
}

const GOOD_LABELS: Record<string, string> = {
  'polite-end': 'です / ます endings',
  greeting: 'a proper greeting',
  closing: 'よろしく おねがいします',
  'name-intro': 'introduced yourself',
  honorific: 'honorific keigo',
  humble: 'humble keigo',
  teinei: 'extra-polite ございます',
  prefix: 'お / ご on a word',
  aizuchi: 'a friendly aizuchi',
  cushion: 'a cushion word',
};

/** Works out the private tip: the rule-made polite version, a keigo step up, or the stock answer. */
export function tipFor(m: MannersResult, u: Utterance | string, q: OmiaiQuestion, level: Level, name: string, english: boolean): Tip {
  const example = withName(q.example[level], name);
  const stock: Tip = { kind: 'stock', target: { text: example.text, kana: example.kana }, note: english ? 'Try it in Japanese: here is a polite answer.' : 'Here is one polite way to answer.', example, next: null };
  if (english) return stock;
  if (m.rewrite) {
    // A rewrite still holding kanji (no reading from the server) can't be checked by sound.
    if (!isKanaOnly(m.rewrite.kana)) return stock;
    return { kind: 'rewrite', target: m.rewrite, note: m.note ?? 'A little more polite, like this.', example, next: null };
  }
  const polite = m.register === 'polite' || m.register === 'keigo';
  if (!polite) return stock;
  if (m.upgrade && level === 'n4') return { kind: 'upgrade', target: { text: m.upgrade.text, kana: m.upgrade.kana }, note: m.upgrade.note, example, next: null };
  const own = analysisText(u);
  const said = typeof u === 'string' ? u : u.text;
  // When the answer is its own reading, keep its word spaces and katakana, so romaji splits into words.
  const kana = analysisText(said) === own ? said.normalize('NFKC') : own;
  const target = isKanaOnly(own) ? { text: said, kana } : { text: example.text, kana: example.kana };
  return {
    kind: 'perfect',
    target,
    note: m.register === 'keigo' ? 'Beautiful keigo. Say it once more, with a bow!' : 'Perfectly polite. Say it once more, with a bow!',
    example,
    next: m.upgrade && level !== 'kana' ? { text: m.upgrade.text, note: m.upgrade.note } : null,
  };
}

function startRound(s: OmiaiState, ctx: ModeContext): void {
  s.round += 1;
  const card = cardOf(s);
  const question = questionFor(card, s.round, s.totalRounds);
  const kind = roundKind(s.round, s.totalRounds);
  const slots: Record<string, Slot> = {};
  for (const p of ctx.players()) slots[p.id] = { openedAt: ctx.now, tilesShown: p.level === 'kana', tiles: dealTiles(question, kind, p, () => ctx.random()) };
  s.current = { index: s.round, question, slots, answers: [], order: [], votes: {}, encores: {}, result: null };
}

const visible = (r: Round) => r.answers.filter((a) => !a.hidden);
const byOrder = (r: Round) => (a: Answer, b: Answer) => r.order.indexOf(a.id) - r.order.indexOf(b.id);

/** Who may vote: everyone with a visible answer to vote for that isn't their own. */
function voters(r: Round, ctx: ModeContext): string[] {
  return ctx
    .players()
    .map((p) => p.id)
    .filter((id) => visible(r).some((a) => a.authorId !== id));
}

function bonusCap(s: OmiaiState, ctx: ModeContext): number {
  return round5(BONUS_POOL_SHARE * POINTS_PER_VOTE * multiplierFor(s) * Math.max(1, ctx.players().length - 1));
}

function pay(ctx: ModeContext, playerId: string, points: number): void {
  const p = Math.round(points);
  if (p && ctx.player(playerId)) ctx.award(playerId, p);
}

/** Nobiko-san teases at most this many players a game. */
export const TEASE_MAX = 2;
/** Registers casual enough for her to be scandalised by. */
const TEASABLE: ReadonlySet<Register> = new Set(['casual', 'plain']);

/**
 * Cheeky rooms only: as the answers are revealed, Nobiko-san may crane her neck over the most casual one and act
 * scandalised. She teases manners, never mistakes, and only players who can take it: N4 first, then N5, never a
 * kana player, an English answer, or anyone she has teased already, and at most TEASE_MAX times a game. The
 * answer is still anonymous then, so the room gets to guess whose it was.
 */
function pickTease(s: OmiaiState, shown: Answer[], ctx: ModeContext): Answer | undefined {
  if (ctx.audience !== 'cheeky' || (s.teased?.length ?? 0) >= TEASE_MAX) return undefined;
  const rank = { n4: 0, n5: 1 } as Partial<Record<string, number>>;
  return shown
    .filter((a) => !a.hidden && !a.english && TEASABLE.has(a.manners.register) && !s.teased?.includes(a.authorId))
    .filter((a) => rank[ctx.player(a.authorId)?.level ?? ''] !== undefined)
    .sort((a, b) => rank[ctx.player(a.authorId)!.level]! - rank[ctx.player(b.authorId)!.level]! || a.manners.meter - b.manners.meter)[0];
}

/**
 * Nobiko-san reads the question: once a round, whatever the go-between does. `afterMs` holds it back while she
 * says the go-between's opening first, so the two never overlap.
 */
function cueQuestion(s: OmiaiState, ctx: ModeContext, afterMs = 0): void {
  const r = s.current!;
  if (r.cuedAt !== undefined) return;
  r.cuedAt = ctx.now + afterMs;
  const q = r.question.ask.n5;
  ctx.cue({ host: 'nobiko', event: 'prompt_read', prompt: { text: q.text, kana: q.kana, en: q.en }, ...(afterMs ? { atMs: afterMs } : {}) });
}

/**
 * The go-between's line was accepted: Nobiko-san says it on the TV (the filled template, never their recording),
 * `afterMs` from now. Returns how long until she has finished.
 */
function voiceNakodo(line: NakodoLine, ctx: ModeContext, afterMs = 0): number {
  const { text, kana, en } = line.jp;
  ctx.cue({ host: 'nobiko', event: 'omiai_nakodo_read', slots: { line: text, line_kana: kana, line_en: en }, ...(afterMs ? { atMs: afterMs } : {}) });
  return afterMs + voiceMs(kana);
}

/** Votes and manners bonuses for the round. Paid as the encore starts. */
function scoreRound(s: OmiaiState, ctx: ModeContext): void {
  const r = s.current;
  if (!r || r.result) return;
  const mult = multiplierFor(s);
  const cap = bonusCap(s, ctx);
  const counts = new Map<string, number>();
  for (const id of Object.values(r.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const answers = visible(r).sort(byOrder(r));
  const top = Math.max(0, ...answers.map((a) => counts.get(a.id) ?? 0));
  const scores = ctx.players().map((p) => p.score);
  const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);

  r.result = answers.map((a) => {
    const votes = counts.get(a.id) ?? 0;
    const author = ctx.player(a.authorId);
    let share = a.english ? 0 : (a.manners.meter / 100) * STYLE_SHARE[a.style];
    if (author && author.score < mean) share *= COMEBACK;
    const bonus = Math.min(cap, round5(cap * share));
    const star = !a.english && a.manners.meter >= STAR_METER;
    return { answerId: a.id, authorId: a.authorId, votes, votePoints: votes * POINTS_PER_VOTE * mult, bonus, encoreBonus: 0, cap, winner: votes > 0 && votes === top, star };
  });
  for (const line of r.result) {
    pay(ctx, line.authorId, line.votePoints + line.bonus);
    const st = stats(s, line.authorId);
    st.votes += line.votes;
    if (line.star) st.stars += 1;
  }
  const star = r.result.find((l) => l.winner);
  const winner = star ? answers.find((a) => a.id === star.answerId) : undefined;
  const q = r.question.ask.n5;
  if (winner) ctx.cue({ host: 'nobiko', event: 'encore_invite', slots: { name: ctx.player(winner.authorId)?.name ?? '' }, prompt: { text: q.text, kana: q.kana, en: q.en }, answer: winner.text });
  else ctx.cue({ host: 'nobiko', event: 'miss_kind' });
}

/** Encore bonuses, paid as the score phase starts; and the phrasebook. */
function scoreEncores(s: OmiaiState, ctx: ModeContext): void {
  const r = s.current;
  if (!r?.result) return;
  for (const line of r.result) {
    const e = r.encores[line.authorId];
    const a = r.answers.find((x) => x.id === line.answerId)!;
    const entry = { itemId: `omiai:${r.question.id}:${line.authorId}`, text: a.tip.target.text, kana: a.tip.target.kana, en: a.tip.kind === 'stock' ? a.tip.example.en : 'Your answer, said politely' };
    // A polite answer in your own words, spoken: said from memory (the learning path counts it).
    const own = a.tip.kind === 'perfect' && a.via === 'speech' && !a.english;
    if (e?.ok && e.via) {
      const share = (line.winner ? ENCORE_SHARE.winner : ENCORE_SHARE.other)[e.via === 'speech' ? 'speech' : 'typed'];
      line.encoreBonus = Math.max(0, Math.min(line.cap - line.bonus, round5(line.cap * share)));
      pay(ctx, line.authorId, line.encoreBonus);
      // The encore says back the polite version shown on the phone: read, unless the answer was already yours.
      ctx.phrase(line.authorId, { ...entry, outcome: own || e.via === 'speech' ? 'said' : 'seen', recall: own ? 'memory' : 'read' });
    } else {
      // A correction that wasn't said back goes to review; a polite answer is just kept.
      ctx.phrase(line.authorId, { ...entry, outcome: own ? 'said' : a.tip.kind === 'rewrite' || a.tip.kind === 'stock' ? 'missed' : 'seen', recall: own ? 'memory' : 'read' });
    }
  }
}

/** The finale: the guest invites the contestant with the most hearts (votes plus manners stars). */
function decide(s: OmiaiState, ctx: ModeContext): void {
  if (s.accepted !== null) return;
  const ranked = rankHearts(s, ctx);
  const best = ranked[0];
  if (!best || best.hearts <= 0) {
    s.accepted = '';
    return;
  }
  const tied = ranked.filter((x) => x.hearts === best.hearts);
  const byMeter = Math.max(...tied.map((x) => stats(s, x.playerId).meterTotal));
  const finalists = tied.filter((x) => stats(s, x.playerId).meterTotal === byMeter);
  const pickIdx = Math.floor(ctx.random() * finalists.length);
  s.accepted = finalists[pickIdx]!.playerId;
  pay(ctx, s.accepted, ACCEPT_POINTS);
  ctx.cue({ host: 'nobiko', event: 'encore_cheer', slots: { name: ctx.player(s.accepted)?.name ?? '' } });
}

function rankHearts(s: OmiaiState, ctx: ModeContext): { playerId: string; hearts: number }[] {
  return ctx
    .players()
    .map((p) => ({ playerId: p.id, hearts: stats(s, p.id).votes + stats(s, p.id).stars, seat: p.seat }))
    .sort((a, b) => b.hearts - a.hearts || a.seat - b.seat)
    .map(({ playerId, hearts }) => ({ playerId, hearts }));
}

// ---- the go-between (N4 hard role) ----

const blankTry = (): NakodoTry => ({ tries: 0, ok: false, via: null, heard: '', meter: null, points: 0 });

/** Rooms this big or bigger rest a lone N4 player after a round as go-between (see offerNakodo). */
export const SPOTLIGHT_ROOM = 4;

/**
 * Offers the round's go-between lines to an N4 player by the shared rotation (hardRoleLog.ts nextOfferee):
 * fewest offers first, then longest ago; a "not this time" sits the next round out; in a room of SPOTLIGHT_ROOM
 * or more nobody is go-between two rounds running. Nobody at N4: Nobiko-san keeps them.
 */
function offerNakodo(s: OmiaiState, ctx: ModeContext): void {
  s.nakodo = null;
  const n4 = ctx
    .players()
    .filter((p) => p.level === 'n4' && p.connected)
    .sort((a, b) => a.seat - b.seat);
  const past = (s.nakodoLog ?? []).map((o) => ({ playerId: o.playerId, at: o.round, answer: o.outcome }));
  const id = nextOfferee(
    n4.map((p) => p.id),
    past,
    s.round,
    ctx.connected().length,
  );
  const p = n4.find((x) => x.id === id);
  if (!p) return;
  s.nakodoSeat = p.seat;
  s.nakodo = { round: s.round, playerId: p.id, status: 'offered', lines: { open: blankTry(), close: blankTry() } };
}

function closeNakodo(s: OmiaiState, ctx: ModeContext): void {
  const g = s.nakodo;
  s.nakodo = null;
  if (!g) return;
  const tried = g.lines.open.tries + g.lines.close.tries > 0;
  const outcome: OfferAnswer =
    tried || g.status === 'accepted' ? 'accepted' : g.status === 'declined' ? 'declined' : ctx.player(g.playerId)?.connected === false ? 'away' : 'timeout';
  (s.nakodoLog ??= []).push({ round: g.round, playerId: g.playerId, outcome });
}

// ---- mixed rooms: the Gallery, the commentary booth, the host stand-in (mixedRoom.ts) ----

/**
 * The booth's replay of the opening (the go-between's, or Nobiko-san's own): the line with its keigo word lit,
 * one line of colour about the play, and for Kana and N5 phones the same news in plain N5 Japanese.
 */
function boothFor(line: NakodoLine, playerId: string | null, who: string): Commentary {
  return {
    playerId,
    line: line.jp,
    voiced: true,
    lit: lightUp(line.jp.text, [line.key]),
    note: `${line.key}: ${who} said it the keigo way, lifting the guest up, as a matchmaker does.`,
    gist: { kana: line.gist.kana, en: line.gist.en, emoji: '🎎' },
    ms: commentaryMs(line.jp),
  };
}

/**
 * Opens the round's Gallery once the go-between has taken the opening (Take it, or a first try): one reaction
 * tile for every other connected player, and once a game a curveball for a Kana or N5 player ("Which word did
 * you hear?": the opening's keigo word).
 */
function openNakodoGallery(s: OmiaiState, ctx: ModeContext): void {
  const g = s.nakodo;
  const r = s.current;
  if (!g || !r || r.gallery || g.status !== 'accepted') return;
  const others = ctx.connected().filter((p) => p.id !== g.playerId);
  if (!others.length) return;
  const line = nakodoLines(cardOf(s), s.round, s.totalRounds).open;
  r.gallery = openGallery(
    others.map((p) => p.id),
    others.filter((p) => p.level === 'kana' || p.level === 'n5').map((p) => p.id),
    { word: line.key, pool: NAKODO_KEYS },
    !!s.curveballUsed,
    s.round,
  );
  if (r.gallery.curveball) s.curveballUsed = true;
}

/**
 * The host stand-in: a 2-player room with nobody at N4 never has a go-between, so once a game, in the first
 * round, Nobiko-san gives the keigo opening herself (voiced, with its subtitle; the gist on the phones), then
 * reads the question. Nobody is asked to say anything; no points. Returns true when she does.
 */
function standIn(s: OmiaiState, ctx: ModeContext): boolean {
  const r = s.current;
  if (!r || s.standInUsed || s.nakodo || !hostStandsIn(ctx.connected().map((p) => p.level))) return false;
  s.standInUsed = true;
  const line = nakodoLines(cardOf(s), s.round, s.totalRounds).open;
  r.standIn = boothFor(line, null, 'Nobiko-san');
  ctx.cue({ host: 'nobiko', event: 'omiai_standin', slots: { line: line.jp.text, line_kana: line.jp.kana, line_en: line.jp.en } });
  cueQuestion(s, ctx, voiceMs(line.jp.kana));
  return true;
}

/** Which line the phase is for. */
const slotFor =(phase: Phase): NakodoSlot | null => (phase === 'prompt' ? 'open' : phase === 'score' ? 'close' : null);

/**
 * The go-between still has this phase's line to say. The opening ends once Nobiko-san has read the
 * question; the closing is theirs only if they tried the opening.
 */
function nakodoOpen(s: OmiaiState, phase: Phase, ctx: ModeContext): boolean {
  const g = s.nakodo;
  const slot = slotFor(phase);
  if (!g || !slot || g.status === 'declined' || g.status === 'timeout' || !ctx.player(g.playerId)?.connected) return false;
  if (slot === 'open' && s.current?.cuedAt !== undefined) return false;
  if (slot === 'close' && g.lines.open.tries === 0) return false;
  const t = g.lines[slot];
  return !t.ok && t.tries < NAKODO_TRIES;
}

const phaseBase = (phase: Phase) => (phase === 'prompt' ? DURATIONS.prompt : DURATIONS.score);

/**
 * When Nobiko-san reads the question if the go-between hasn't finished the opening: at the prompt's usual
 * time, or, for a go-between who took it, late enough in the longer prompt that she still has time to read it.
 */
function questionDueAt(s: OmiaiState, ctx: ModeContext): number {
  const g = s.nakodo;
  const late = g?.status === 'accepted' && ctx.player(g.playerId)?.connected;
  return s.phaseAt + (late ? DURATIONS.prompt + DURATIONS.nakodo - DURATIONS.questionRead : DURATIONS.prompt);
}

export interface NakodoTally {
  offered: number;
  accepted: number;
  declined: number;
  timeout: number;
  /** offerRate: the step's gate is at least 60% accepted. */
  rate: number | null;
}

/** Go-between offers per N4 player and what came of them. */
export function nakodoOffers(s: Pick<OmiaiState, 'nakodoLog'>): Record<string, NakodoTally> {
  const out: Record<string, NakodoTally> = {};
  const answers: Record<string, OfferAnswer[]> = {};
  for (const e of s.nakodoLog ?? []) {
    const o = (out[e.playerId] ??= { offered: 0, accepted: 0, declined: 0, timeout: 0, rate: null });
    o.offered += 1;
    if (e.outcome === 'accepted') o.accepted += 1;
    if (e.outcome === 'declined') o.declined += 1;
    if (e.outcome === 'timeout') o.timeout += 1;
    (answers[e.playerId] ??= []).push(e.outcome);
  }
  for (const [id, o] of Object.entries(out)) o.rate = offerRate(answers[id]!);
  return out;
}

function parseTiles(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_TILES) return null;
  if (!raw.every((k) => typeof k === 'string' && k.length <= 16)) return null;
  return new Set(raw).size === raw.length ? (raw as string[]) : null;
}

// ---- the mode ----

export const omiaiMode: Mode<OmiaiState, OmiaiView> = {
  info: {
    id: 'omiai',
    title: 'Omiai Matchmaker',
    titleJa: 'おみあい マッチメーカー',
    blurb: 'Meet a very formal guest. Answer their questions politely, vote for the most charming, and see who gets invited to tea.',
    host: 'nobiko',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [TOTAL_ROUNDS, 5, 3],
    usesPack: false,
    phrasebookTitle: 'Your polite phrases',
    phaseLabels: { prompt: 'The guest asks', answer: 'Your answer', reveal: 'Charm vote', encore: 'Manners meter', score: 'Score', finale: 'The invitation' },
  },

  setup(ctx, opts) {
    const wanted = typeof opts.extra?.cardId === 'string' ? opts.extra.cardId : null;
    const pool = cardsFor(ctx.audience ?? 'family');
    const card = CARDS.find((c) => c.id === wanted) ?? pool[Math.floor(ctx.random() * pool.length)]!;
    const all: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) all[p.id] = blankStats();
    return {
      cardId: card.id,
      round: 0,
      totalRounds: Math.max(2, Math.min(5, opts.rounds ?? TOTAL_ROUNDS)),
      current: null,
      stats: all,
      accepted: null,
      phaseAt: ctx.now,
      nakodo: null,
      nakodoSeat: 0,
      nakodoLog: [],
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return s.current && s.current.answers.length ? 'reveal' : s.round < s.totalRounds ? 'prompt' : 'finale';
      case 'reveal':
        return 'encore';
      case 'encore':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'finale';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'nobiko', event: 'intro' });
        break;
      case 'prompt': {
        startRound(s, ctx);
        offerNakodo(s, ctx);
        // With a go-between, the opening is theirs; Nobiko-san reads the question once they've said it,
        // run out of tries, passed, or let it go by (see wake).
        if (!s.nakodo && !standIn(s, ctx)) cueQuestion(s, ctx);
        break;
      }
      case 'answer':
        for (const slot of Object.values(s.current?.slots ?? {})) slot.openedAt = ctx.now;
        if (ctx.players().some((p) => p.level !== 'kana')) ctx.cue({ host: 'nobiko', event: 'say_it_first' });
        break;
      case 'reveal': {
        const r = s.current!;
        r.order = shuffled(
          r.answers.map((a) => a.id),
          () => ctx.random(),
        );
        const shown = visible(r).sort(byOrder(r));
        const q = r.question.ask.n5;
        ctx.cue({ host: 'nobiko', event: 'reveal_react', tier: 'good', prompt: { text: q.text, kana: q.kana, en: q.en }, answer: shown.map((a) => a.text).join(' / ') });
        const tease = pickTease(s, shown, ctx);
        if (tease) {
          r.tease = tease.id;
          (s.teased ??= []).push(tease.authorId);
          // The last cue raised is the one she says, so this takes the place of the reveal reaction.
          ctx.cue({ host: 'nobiko', event: 'omiai_tease', answer: tease.text });
        }
        break;
      }
      case 'encore':
        scoreRound(s, ctx);
        break;
      case 'score': {
        scoreEncores(s, ctx);
        const r = s.current;
        if (r) {
          const ex = r.question.example.n5;
          for (const p of ctx.players()) {
            const e = withName(r.question.example[p.level], p.name);
            ctx.phrase(p.id, { itemId: `${r.question.id}:example`, text: e.text, kana: e.kana, en: e.en, outcome: 'seen' });
            const pair = keigoPair(r.question.keigo);
            if (pair && p.level === 'n4') ctx.phrase(p.id, { itemId: `keigo:${pair.id}`, text: `${pair.polite} → ${pair.honorific} / ${pair.humble}`, kana: `${pair.polite} ${pair.honorific} ${pair.humble}`, en: `${pair.en}: polite → honorific (them) / humble (you)`, outcome: 'seen' });
          }
          ctx.cue({ host: 'nobiko', event: 'natural_version', answer: ex.text, answerEn: ex.en });
        }
        break;
      }
      case 'finale':
        decide(s, ctx);
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'score' || (phase === 'answer' && !s.current?.answers.length)) closeNakodo(s, ctx);
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt': {
        // The stand-in's opening (once a game, at most 7 s) comes before the question, so the prompt is that much longer.
        const stood = s.current?.standIn;
        return DURATIONS.prompt + (nakodoOpen(s, phase, ctx) ? DURATIONS.nakodo + DURATIONS.nakodoVoice : 0) + (stood ? voiceMs(stood.line.kana) : 0);
      }
      case 'answer':
        return DURATIONS.answer;
      case 'reveal':
        return Math.min(DURATIONS.revealMax, DURATIONS.revealBase + DURATIONS.revealPerAnswer * (s.current?.answers.length ?? 0));
      case 'encore':
        return DURATIONS.encore;
      case 'score':
        return DURATIONS.score + (nakodoOpen(s, phase, ctx) ? DURATIONS.nakodo + DURATIONS.nakodoVoice : 0);
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
    // A go-between's prompt or score runs long: it ends once their line is done and the phase has had its usual
    // time (and, in the prompt, once Nobiko-san has had time to read the question).
    if (phase === 'prompt' && s.nakodo)
      return r.cuedAt !== undefined && !nakodoOpen(s, phase, ctx) && ctx.now >= Math.max(s.phaseAt + DURATIONS.prompt, r.cuedAt + DURATIONS.questionRead);
    if (phase === 'score' && s.nakodo) return !nakodoOpen(s, phase, ctx) && ctx.now >= Math.max(s.phaseAt + phaseBase(phase), r.voicedUntil ?? 0);
    if (phase === 'answer') return here.every((p) => r.answers.some((a) => a.authorId === p.id));
    if (phase === 'reveal') {
      const can = new Set(voters(r, ctx));
      return here.every((p) => !can.has(p.id) || r.votes[p.id] !== undefined);
    }
    if (phase === 'encore') {
      const authors = new Set(visible(r).map((a) => a.authorId));
      return authors.size > 0 && here.every((p) => !authors.has(p.id) || r.encores[p.id]?.ok || r.encores[p.id]?.passed || (r.encores[p.id]?.tries ?? 0) >= ENCORE_TRIES);
    }
    return false;
  },

  wakeAt(s, phase, ctx) {
    if ((phase !== 'prompt' && phase !== 'score') || !s.nakodo) return null;
    const cuedAt = s.current?.cuedAt;
    if (phase === 'prompt' && cuedAt === undefined) return Math.max(ctx.now, questionDueAt(s, ctx));
    if (nakodoOpen(s, phase, ctx)) return null;
    const at = phase === 'prompt' ? Math.max(s.phaseAt + DURATIONS.prompt, cuedAt! + DURATIONS.questionRead) : Math.max(s.phaseAt + phaseBase(phase), s.current?.voicedUntil ?? 0);
    return ctx.now < at ? at : null;
  },

  wake(s, phase, ctx) {
    // The go-between hasn't finished the opening in time: Nobiko-san reads the question anyway, and an
    // offer nobody answered times out. Otherwise the wake just lets done() end the phase.
    const g = s.nakodo;
    if (phase !== 'prompt' || !g || !s.current || s.current.cuedAt !== undefined || ctx.now < questionDueAt(s, ctx)) return;
    if (g.status === 'offered') g.status = 'timeout';
    cueQuestion(s, ctx);
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    const r = s.current;
    const player = ctx.player(playerId)!;
    switch (raw.kind) {
      case 'tiles': {
        if (phase !== 'answer' || !r) return moveError('wrong-phase');
        const slot = r.slots[playerId];
        if (!slot) return moveError('not-playing');
        if (slot.tilesShown) return MOVE_OK;
        if (ctx.now < slot.openedAt + SAY_FIRST_MS - SAY_FIRST_SLACK_MS) return moveError('say-it-first');
        slot.tilesShown = true;
        return MOVE_OK;
      }
      case 'answer': {
        if (phase !== 'answer' || !r) return moveError('wrong-phase');
        const slot = r.slots[playerId];
        if (!slot) return moveError('not-playing');
        if (r.answers.some((a) => a.authorId === playerId)) return moveError('already-answered');
        let u: Utterance;
        let style: AnswerStyle;
        if (raw.tiles !== undefined) {
          if (!slot.tilesShown) return moveError('say-it-first');
          const keys = parseTiles(raw.tiles);
          if (!keys) return moveError('bad-move');
          const picked = keys.map((k) => slot.tiles.find((t) => t.key === k));
          if (picked.some((t) => !t)) return moveError('bad-move');
          u = { via: 'tap', text: joinTiles(picked as Tile[]) };
          style = 'tiles';
        } else {
          if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
          const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
          if (!text) return moveError('empty-answer');
          u = { ...raw.utterance, text };
          const memory = !slot.tilesShown && player.level !== 'kana';
          const spoken = u.via === 'speech';
          style = memory ? (spoken ? 'memory-spoken' : 'memory-typed') : spoken ? 'spoken' : u.via === 'tap' ? 'tiles' : 'typed';
        }
        if (!playerTextAllowed(u.text, ctx.audience)) return moveError('kids-words');
        const english = !hasJapanese(u.text);
        const manners = checkManners(u, player.level, { name: player.name });
        const answer: Answer = {
          id: ctx.newId(),
          authorId: playerId,
          text: u.text,
          via: u.via,
          style,
          english,
          manners,
          tip: tipFor(manners, u, r.question, player.level, player.name, english),
          hidden: false,
        };
        r.answers.push(answer);
        const st = stats(s, playerId);
        st.meterTotal += manners.meter;
        if (manners.register === 'keigo') st.keigo += 1;
        if (style === 'memory-spoken' || style === 'memory-typed') st.brave += 1;
        return MOVE_OK;
      }
      case 'vote': {
        if (phase !== 'reveal' || !r) return moveError('wrong-phase');
        if (r.votes[playerId]) return moveError('already-voted');
        const answer = r.answers.find((a) => a.id === raw.answerId);
        if (!answer) return moveError('unknown-answer');
        if (answer.authorId === playerId) return moveError('own-answer');
        if (answer.hidden) return moveError('hidden');
        r.votes[playerId] = answer.id;
        return MOVE_OK;
      }
      case 'hide': {
        if (phase !== 'reveal' || !r) return moveError('wrong-phase');
        if (ctx.vipId !== playerId) return moveError('not-vip');
        const answer = r.answers.find((a) => a.id === raw.answerId);
        if (!answer) return moveError('unknown-answer');
        if (answer.hidden) return MOVE_OK;
        answer.hidden = true;
        for (const [voter, id] of Object.entries(r.votes)) if (id === answer.id) delete r.votes[voter];
        return MOVE_OK;
      }
      case 'encore': {
        if (phase !== 'encore' || !r) return moveError('wrong-phase');
        const mine = visible(r).find((a) => a.authorId === playerId);
        if (!mine) return moveError('not-yours');
        const e = (r.encores[playerId] ??= { tries: 0, ok: false, passed: false, heard: '', via: null });
        if (e.ok || e.passed) return MOVE_OK;
        if (raw.pass === true) {
          e.passed = true;
          return MOVE_OK;
        }
        if (e.tries >= ENCORE_TRIES) return moveError('no-tries-left');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const heard = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
        if (!heard) return moveError('empty-answer');
        e.tries += 1;
        e.heard = heard;
        if (!saidPhrase(raw.utterance, mine.tip.target.kana, undefined, player.level)) return MOVE_OK;
        e.ok = true;
        e.via = raw.utterance.via;
        const st = stats(s, playerId);
        st.echoes += 1;
        if (raw.utterance.via === 'speech') ctx.cue({ host: 'nobiko', event: 'encore_cheer', slots: { name: player.name } });
        return MOVE_OK;
      }
      case 'nakodo': {
        const g = s.nakodo;
        if (!g || g.playerId !== playerId) return moveError('not-go-between');
        if (g.status === 'declined' || g.status === 'timeout') return MOVE_OK;
        if (raw.accept === false) {
          // "Not this time": the rest of the round's lines go back to Nobiko-san.
          g.status = 'declined';
          if (phase === 'prompt') cueQuestion(s, ctx);
          return MOVE_OK;
        }
        if (raw.accept === true) {
          // "Take it": the lines are theirs (the speak box is open either way).
          g.status = 'accepted';
          if (phase === 'prompt') openNakodoGallery(s, ctx);
          return MOVE_OK;
        }
        const slot = slotFor(phase);
        if (!slot || !r) return moveError('wrong-phase');
        const t = g.lines[slot];
        if (t.ok) return MOVE_OK;
        if (t.tries >= NAKODO_TRIES) return moveError('no-tries-left');
        if (!nakodoOpen(s, phase, ctx)) return moveError('wrong-phase');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const heard = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH);
        if (!heard) return moveError('empty-answer');
        if (raw.utterance.via === 'tap') return moveError('bad-utterance');
        const u: Utterance = { ...raw.utterance, text: heard };
        const line = nakodoLines(cardOf(s), s.round, s.totalRounds)[slot];
        // A first try is a yes.
        g.status = 'accepted';
        if (slot === 'open') openNakodoGallery(s, ctx);
        t.tries += 1;
        t.heard = heard;
        t.meter = checkManners(u, 'n4', { name: player.name }).meter;
        const entry = { itemId: `omiai:nakodo:${cardOf(s).id}:${line.id}`, text: line.jp.text, kana: line.jp.kana, en: line.jp.en };
        if (saidPhrase(u, line.jp.kana, undefined, 'n4')) {
          t.ok = true;
          t.via = u.via;
          t.points = u.via === 'speech' ? NAKODO_POINTS.speech : NAKODO_POINTS.typed;
          pay(ctx, playerId, t.points);
          // Read off the phone's script, so it counts as seen, not said from memory.
          ctx.phrase(playerId, { ...entry, outcome: 'seen' });
          // Nobiko-san says the line on the TV: the opening straight away (the question waits for it), the
          // closing once the score's own line has had its time, and only if it still fits in the phase.
          if (slot === 'open') {
            // The commentary booth replays it on the TV while she says it, then her あらまあ, then the question.
            r.booth = boothFor(line, playerId, player.name);
            const said = voiceNakodo(line, ctx);
            // Only when it still leaves her time to read the question inside the go-between's longer prompt.
            const end = s.phaseAt + DURATIONS.prompt + DURATIONS.nakodo + DURATIONS.nakodoVoice;
            const cheer = ctx.now + said + DURATIONS.cheer + DURATIONS.questionRead <= end;
            if (cheer) ctx.cue({ host: 'nobiko', event: 'omiai_nakodo_cheer', slots: { name: player.name }, atMs: said });
            cueQuestion(s, ctx, said + (cheer ? DURATIONS.cheer : 0));
          } else {
            const after = Math.max(0, s.phaseAt + DURATIONS.naturalRead - ctx.now);
            const end = s.phaseAt + DURATIONS.score + DURATIONS.nakodo + DURATIONS.nakodoVoice;
            if (ctx.now + after + voiceMs(line.jp.kana) <= end) r.voicedUntil = ctx.now + voiceNakodo(line, ctx, after);
          }
        } else if (t.tries >= NAKODO_TRIES) ctx.phrase(playerId, { ...entry, outcome: 'missed' });
        // The opening is done (said, or out of tries): Nobiko-san reads the question.
        if (slot === 'open' && (t.ok || t.tries >= NAKODO_TRIES)) cueQuestion(s, ctx);
        return MOVE_OK;
      }
      case 'gallery': {
        // A reaction tile (or the curveball) from a player without the go-between's seat.
        if (phase !== 'prompt' || !r?.gallery || typeof raw.pick !== 'string') return moveError('wrong-phase');
        const points = pickGallery(r.gallery, playerId, raw.pick);
        if (points === null) return moveError('bad-move');
        pay(ctx, playerId, points);
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const r = s.current;
    if (!r) return;
    delete r.votes[playerId];
    delete r.encores[playerId];
    delete r.slots[playerId];
  },

  offers(s, playerId) {
    return (s.nakodoLog ?? []).filter((o) => o.playerId === playerId).map((o) => ({ role: 'omiai:nakodo', answer: o.outcome }));
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const card = cardOf(s);
    const r = s.current;
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const romaji = me?.level === 'kana';
    const kind = s.round ? roundKind(s.round, s.totalRounds) : null;
    const nameOf = (id: string) => ctx.player(id)?.name ?? '(left)';
    const hearts: Record<string, number> = {};
    for (const p of ctx.players()) hearts[p.id] = stats(s, p.id).votes + stats(s, p.id).stars;

    const onShow = phase === 'reveal' || phase === 'encore' || phase === 'score';
    const authorsShown = phase === 'encore' || phase === 'score';
    const lines = new Map((r?.result ?? []).map((l) => [l.answerId, l]));
    const answers: AnswerCard[] =
      onShow && r
        ? [...r.answers].sort(byOrder(r)).map((a) => {
            const c: AnswerCard = { id: a.id, text: a.hidden ? '[hidden]' : a.text, hidden: a.hidden };
            if (me && a.authorId === me.id) c.mine = true;
            if (phase === 'reveal' && r.tease === a.id) c.tease = true;
            if (authorsShown && !a.hidden) {
              const line = lines.get(a.id);
              const e = r.encores[a.authorId];
              c.authorId = a.authorId;
              c.authorName = nameOf(a.authorId);
              c.meter = a.manners.meter;
              c.register = a.english ? 'none' : a.manners.register;
              c.reaction = reactionFor(c.register);
              c.votes = line?.votes ?? 0;
              c.points = line ? line.votePoints + line.bonus + line.encoreBonus : 0;
              c.winner = line?.winner ?? false;
              c.encore = !e ? null : e.ok ? (e.via === 'speech' ? 'said' : 'typed') : e.passed ? 'passed' : 'tried';
            }
            return c;
          })
        : [];

    let natural: OmiaiView['natural'] = null;
    if (phase === 'score' && r) {
      const win = r.result?.find((l) => l.winner);
      const a = win ? r.answers.find((x) => x.id === win.answerId) : undefined;
      const ex = r.question.example.n5;
      natural = a && a.tip.kind !== 'stock' ? { text: a.tip.target.text, kana: a.tip.target.kana, en: '', from: a.authorId } : { ...withName(ex, a ? nameOf(a.authorId) : '…'), from: null };
    }

    let finale: OmiaiView['finale'] = null;
    if (phase === 'finale') {
      const accepted = s.accepted || null;
      finale = { accepted, line: accepted ? withName(card.accept, nameOf(accepted)) : null, ranking: rankHearts(s, ctx) };
    }

    const g = s.nakodo;
    const gSlot = slotFor(phase);
    const gLines = g ? nakodoLines(card, s.round, s.totalRounds) : null;

    let mine: OmiaiView['me'] = null;
    if (me) {
      const slot = r?.slots[me.id];
      const myAnswer = r?.answers.find((a) => a.authorId === me.id);
      const line = myAnswer ? lines.get(myAnswer.id) : undefined;
      const e = r?.encores[me.id];
      const target = (a: Answer) => ({ ...a.tip.target, ...(romaji ? { romaji: toRomaji(a.tip.target.kana) } : {}) });
      const tipView = (a: Answer): TipView => ({
        kind: a.tip.kind,
        mine: a.text,
        target: target(a),
        note: a.tip.note,
        example: a.tip.example,
        next: a.tip.next,
        meter: a.manners.meter,
        register: a.english ? 'none' : a.manners.register,
        casual: a.manners.casual.slice(0, 2),
        good: [...new Set(a.manners.hits.map((h) => GOOD_LABELS[h.kind]!).filter(Boolean))],
        keigo: me.level === 'kana' ? null : (keigoPair(r!.question.keigo) ?? null),
        points: line ? line.votePoints + line.bonus + line.encoreBonus : 0,
        votes: line?.votes ?? 0,
      });
      mine = {
        level: me.level,
        slot:
          phase === 'answer' && r && slot && !myAnswer
            ? {
                question: questionView(r.question, me.level),
                sayFirst: !slot.tilesShown,
                sayFirstMs: SAY_FIRST_MS,
                tiles: slot.tilesShown ? slot.tiles.map((t) => ({ key: t.key, text: t.jp.text, en: t.jp.en, role: t.role, ...(romaji ? { romaji: toRomaji(t.jp.kana) } : {}) })) : [],
              }
            : null,
        answer: myAnswer?.text ?? null,
        canVote: phase === 'reveal' && !!r && !r.votes[me.id] && voters(r, ctx).includes(me.id),
        votedFor: (phase === 'reveal' && r?.votes[me.id]) || null,
        encore:
          phase === 'encore' && myAnswer && !myAnswer.hidden
            ? {
                canEncore: !e?.ok && !e?.passed && (e?.tries ?? 0) < ENCORE_TRIES,
                ok: !!e?.ok,
                triesLeft: ENCORE_TRIES - (e?.tries ?? 0),
                heard: e?.heard ?? '',
                winner: !!line?.winner,
                target: target(myAnswer),
              }
            : null,
        tip: (phase === 'encore' || phase === 'score') && myAnswer ? tipView(myAnswer) : null,
        accepted: phase === 'finale' && s.accepted === me.id,
        nakodo:
          g && gLines && g.playerId === me.id && phase !== 'finale'
            ? {
                status: g.status,
                slot: gSlot,
                line: gSlot ? gLines[gSlot].jp : null,
                frames: gSlot ? gLines[gSlot].frames : [],
                canSay: !!gSlot && nakodoOpen(s, phase, ctx),
                ok: !!gSlot && g.lines[gSlot].ok,
                triesLeft: gSlot ? NAKODO_TRIES - g.lines[gSlot].tries : 0,
                heard: gSlot ? g.lines[gSlot].heard : '',
                meter: gSlot ? g.lines[gSlot].meter : null,
                points: gSlot ? g.lines[gSlot].points : 0,
                open: gLines.open.jp,
                close: gLines.close.jp,
              }
            : null,
        gallery: phase === 'prompt' ? galleryTileFor(r?.gallery, me.id, me.level) : null,
        gist: phase === 'prompt' && r && (r.booth?.playerId ?? null) !== me.id ? gistFor(r.booth ?? r.standIn, me.level) : null,
      };
    }
    const booth = phase === 'prompt' ? (r?.booth ?? r?.standIn ?? null) : null;

    return {
      mode: 'omiai',
      round: s.round,
      totalRounds: s.totalRounds,
      multiplier: multiplierFor(s),
      phaseAt: s.phaseAt,
      card: { id: card.id, emoji: card.emoji, name: card.name, job: card.job, hobbies: card.hobbies, quirk: card.quirk, audience: card.audience },
      greeting: phase === 'intro' || s.round <= 1 ? card.greeting : null,
      question: r && phase !== 'intro' && phase !== 'finale' ? questionView(r.question, 'stage') : null,
      roundKind: kind,
      answered: phase === 'answer' && r ? r.answers.map((a) => a.authorId) : [],
      answers,
      voters: phase === 'reveal' && r ? voters(r, ctx) : [],
      voted: phase === 'reveal' && r ? Object.keys(r.votes) : [],
      natural,
      hearts,
      finale,
      nakodo:
        g && gLines && gSlot
          ? {
              playerId: g.playerId,
              slot: gSlot,
              declined: g.status === 'declined' || g.status === 'timeout',
              line: g.lines[gSlot].ok ? gLines[gSlot].jp : null,
              via: g.lines[gSlot].via,
              points: g.lines[gSlot].points,
              pending: nakodoOpen(s, phase, ctx),
            }
          : null,
      booth: booth ? { playerId: booth.playerId, lit: booth.lit, note: booth.note, en: booth.line.en, ms: booth.ms, standIn: !booth.playerId } : null,
      bubbles: phase === 'prompt' && r?.gallery ? galleryBubbles(r.gallery) : [],
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
    const invite = invitation(cardOf(s)).award;
    if (s.accepted) add(ctx.player(s.accepted), invite.title, invite.en);
    add(best((st) => st.meterTotal), 'おもてなし賞', 'Best Manners: highest manners meter');
    add(best((st) => st.votes), 'にんきもの', 'Most Charming: most votes');
    add(best((st) => st.keigo), 'けいご マスター', 'Keigo Master: most keigo answers');
    add(best((st) => st.brave), 'ゆうき賞', 'Bravest: most answers from memory');
    return out;
  },
};
