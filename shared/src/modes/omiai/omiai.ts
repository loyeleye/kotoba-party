// Omiai Matchmaker (おみあい マッチメーカー): a formal "meet the family" introduction show,
// scored on politeness. Host: Pon, as the matchmaker (なこうど). See docs/modes/omiai.md.
//
// One guest per game (a character card: a kappa cucumber farmer, a retired robot vacuum …).
// Each round the guest asks everyone one question, and everyone answers in Japanese:
//   prompt  the guest asks (N4 players hear the keigo version)
//   answer  say it first (N5/N4, 5 s), then answer tiles appear: polite and casual endings side
//           by side, so even a tile answer is a register choice. Speak, type or tap.
//   reveal  Pon reads every answer anonymously; everyone votes for the most charming one
//   encore  authors and manners meters revealed; the guest reacts to each register. Every phone
//           privately shows a more polite version of its own answer; say it for a bonus
//   score   points, and the winning answer's polite version on the stage
// After the last round (the closing appeal, ×2), the finale: the guest invites one contestant to
// tea (most hearts: votes received plus a star for each round with good manners).
//
// The manners meter is the pure rule-based checker in manners.ts. Nothing here waits on an LLM.

import type { JpText, Level } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH, POINTS_PER_VOTE } from '../../constants.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { toRomaji } from '../../japanese/romaji.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { saidPhrase } from '../phraseBingo/check.js';
import { appealQuestion, CARDS, CLOSERS, introQuestion, keigoPair, OPENERS, withName, type CharacterCard, type KeigoPair, type OmiaiQuestion } from './cards.js';
import { analysisText, checkManners, type CasualHit, type MannersResult, type Register } from './manners.js';
import { playerTextAllowed } from '../../moderation.js';

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
} as const;

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
}

// ---- view ----

export interface CardView {
  id: string;
  emoji: string;
  name: JpText;
  job: JpText;
  hobbies: JpText[];
  quirk: string;
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
  me: {
    level: Level;
    slot: { question: QuestionView; sayFirst: boolean; sayFirstMs: number; tiles: TileView[] } | null;
    answer: string | null;
    canVote: boolean;
    votedFor: string | null;
    encore: { canEncore: boolean; ok: boolean; triesLeft: number; heard: string; winner: boolean; target: TipView['target'] } | null;
    tip: TipView | null;
    accepted: boolean;
  } | null;
}

export type OmiaiMove =
  | { kind: 'tiles' }
  | { kind: 'answer'; utterance: Utterance }
  | { kind: 'answer'; tiles: string[] }
  | { kind: 'vote'; answerId: string }
  | { kind: 'hide'; answerId: string }
  | { kind: 'encore'; utterance: Utterance }
  | { kind: 'encore'; pass: true };

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
  const target = isKanaOnly(own) ? { text: typeof u === 'string' ? u : u.text, kana: own } : { text: example.text, kana: example.kana };
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
  if (winner) ctx.cue({ host: 'pon', event: 'encore_invite', slots: { name: ctx.player(winner.authorId)?.name ?? '' }, prompt: { text: q.text, kana: q.kana, en: q.en }, answer: winner.text });
  else ctx.cue({ host: 'pon', event: 'miss_kind' });
}

/** Encore bonuses, paid as the score phase starts; and the phrasebook. */
function scoreEncores(s: OmiaiState, ctx: ModeContext): void {
  const r = s.current;
  if (!r?.result) return;
  for (const line of r.result) {
    const e = r.encores[line.authorId];
    const a = r.answers.find((x) => x.id === line.answerId)!;
    const entry = { itemId: `omiai:${r.question.id}:${line.authorId}`, text: a.tip.target.text, kana: a.tip.target.kana, en: a.tip.kind === 'stock' ? a.tip.example.en : 'Your answer, said politely' };
    if (e?.ok && e.via) {
      const share = (line.winner ? ENCORE_SHARE.winner : ENCORE_SHARE.other)[e.via === 'speech' ? 'speech' : 'typed'];
      line.encoreBonus = Math.max(0, Math.min(line.cap - line.bonus, round5(line.cap * share)));
      pay(ctx, line.authorId, line.encoreBonus);
      ctx.phrase(line.authorId, { ...entry, outcome: e.via === 'speech' ? 'said' : 'seen' });
    } else {
      // A correction that wasn't said back goes to review; a polite answer is just kept.
      ctx.phrase(line.authorId, { ...entry, outcome: a.tip.kind === 'rewrite' || a.tip.kind === 'stock' ? 'missed' : 'seen' });
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
  ctx.cue({ host: 'pon', event: 'encore_cheer', slots: { name: ctx.player(s.accepted)?.name ?? '' } });
}

function rankHearts(s: OmiaiState, ctx: ModeContext): { playerId: string; hearts: number }[] {
  return ctx
    .players()
    .map((p) => ({ playerId: p.id, hearts: stats(s, p.id).votes + stats(s, p.id).stars, seat: p.seat }))
    .sort((a, b) => b.hearts - a.hearts || a.seat - b.seat)
    .map(({ playerId, hearts }) => ({ playerId, hearts }));
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
    host: 'pon',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [TOTAL_ROUNDS, 5, 3],
    usesPack: false,
    phrasebookTitle: 'Your polite phrases',
    phaseLabels: { prompt: 'The guest asks', answer: 'Your answer', reveal: 'Charm vote', encore: 'Manners meter', score: 'Score', finale: 'The invitation' },
  },

  setup(ctx, opts) {
    const wanted = typeof opts.extra?.cardId === 'string' ? opts.extra.cardId : null;
    const card = CARDS.find((c) => c.id === wanted) ?? CARDS[Math.floor(ctx.random() * CARDS.length)]!;
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
      case 'prompt': {
        startRound(s, ctx);
        const q = s.current!.question.ask.n5;
        ctx.cue({ host: 'pon', event: 'prompt_read', prompt: { text: q.text, kana: q.kana, en: q.en } });
        break;
      }
      case 'answer':
        for (const slot of Object.values(s.current?.slots ?? {})) slot.openedAt = ctx.now;
        if (ctx.players().some((p) => p.level !== 'kana')) ctx.cue({ host: 'pon', event: 'say_it_first' });
        break;
      case 'reveal': {
        const r = s.current!;
        r.order = shuffled(
          r.answers.map((a) => a.id),
          () => ctx.random(),
        );
        const shown = visible(r).sort(byOrder(r));
        const q = r.question.ask.n5;
        ctx.cue({ host: 'pon', event: 'reveal_react', tier: 'good', prompt: { text: q.text, kana: q.kana, en: q.en }, answer: shown.map((a) => a.text).join(' / ') });
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
          ctx.cue({ host: 'pon', event: 'natural_version', answer: ex.text, answerEn: ex.en });
        }
        break;
      }
      case 'finale':
        decide(s, ctx);
        break;
    }
  },

  duration(s, phase) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.prompt;
      case 'answer':
        return DURATIONS.answer;
      case 'reveal':
        return Math.min(DURATIONS.revealMax, DURATIONS.revealBase + DURATIONS.revealPerAnswer * (s.current?.answers.length ?? 0));
      case 'encore':
        return DURATIONS.encore;
      case 'score':
        return DURATIONS.score;
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
        if (raw.utterance.via === 'speech') ctx.cue({ host: 'pon', event: 'encore_cheer', slots: { name: player.name } });
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
      };
    }

    return {
      mode: 'omiai',
      round: s.round,
      totalRounds: s.totalRounds,
      multiplier: multiplierFor(s),
      phaseAt: s.phaseAt,
      card: { id: card.id, emoji: card.emoji, name: card.name, job: card.job, hobbies: card.hobbies, quirk: card.quirk },
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
    if (s.accepted) add(ctx.player(s.accepted), 'おちゃの しょうたい', 'Invited to Tea: the guest’s choice');
    add(best((st) => st.meterTotal), 'おもてなし賞', 'Best Manners: highest manners meter');
    add(best((st) => st.votes), 'にんきもの', 'Most Charming: most votes');
    add(best((st) => st.keigo), 'けいご マスター', 'Keigo Master: most keigo answers');
    add(best((st) => st.brave), 'ゆうき賞', 'Bravest: most answers from memory');
    return out;
  },
};
