// Word Gauntlet (v1.1): three escalating rounds hosted by Pon. See docs/modes/word-gauntlet.md.
//
//  1. Fake Kanji (Fibbage): a real but obscure word; everyone writes a fake meaning, then
//     everyone hunts for the real one. Points for finding it and for each player you fool.
//  2. Lost in Translation (telephone, double points): an N5 sentence passes around the room,
//     Japanese → English → Japanese …, each player seeing only the step before theirs.
//     The drift is revealed and everyone votes for their favourite step.
//  3. Shiritori Showdown: a spoken word chain with a shrinking timer. ん knocks you out;
//     the last player standing takes the crown.
//
// Phases: intro, then per segment prompt → answer → reveal → score. Telephone steps are one
// 'answer' phase each; shiritori turns are one 'answer' phase each, with a 'reveal' phase
// between them only when the room has to judge a challenged word. Every turn is its own
// phase, so the room's phase clock is the turn clock and a dropped phone simply times out.

import type { JpText, Level, PackWord } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH } from '../../constants.js';
import { isKana, isUtterance, matchesAccepted, utteranceReading, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import {
  cleanText,
  isObject,
  moveError,
  MOVE_OK,
  shuffled,
  type Award,
  type ContentLibrary,
  type Mode,
  type ModeContext,
  type MoveResult,
} from '../mode.js';
import { toRomaji } from './romaji.js';
import { dictionaryNoun, endsInN, follows, lastKana, repeatKey, startOptions, wordReading } from './shiritori.js';
import { FALLBACK_STARTERS, OBSCURE_WORDS, SHIRITORI_NOUNS, type ObscureWord } from './words.js';

// ---- tuning ----

export const FAKE_WORDS_PER_GAME = 2;
export const POINTS_REAL_FOUND = 100;
export const POINTS_PER_FOOLED = 50;
/** Saying the golden word aloud at the score beat (typed earns less). */
export const GOLDEN_SAID_BONUS = 30;
export const GOLDEN_TYPED_BONUS = 10;

export const TELEPHONE_MIN_PLAYERS = 4;
export const TELEPHONE_MULTIPLIER = 2;
export const POINTS_PER_TELEPHONE_VOTE = 100;
export const TELEPHONE_SPOKEN_BONUS = 50;
export const TELEPHONE_TYPED_BONUS = 20;
/** The stage reveals one step this often (ms); the vote phase is long enough for all of them. */
export const TELEPHONE_REVEAL_STEP_MS = 2_500;

export const SHIRITORI_WORD_POINTS = 50;
export const SHIRITORI_SPOKEN_BONUS = 20;
export const SHOWDOWN_BONUS = 500;
/** If the crown alone would not top the board, it grows until the winner leads by this much. */
export const SHOWDOWN_LEAD = 100;
export const TURN_START_MS = 15_000;
export const TURN_SHRINK_PER_LAP_MS = 1_000;
export const TURN_FLOOR_MS: Record<Level, number> = { kana: 10_000, n5: 6_000, n4: 5_000 };
/** Earlier points become a time bank: 1 s per this many points, up to BANK_MAX_MS. */
export const BANK_POINTS_PER_SECOND = 100;
export const BANK_MAX_MS = 20_000;
export const BASE_TOKENS: Record<Level, number> = { kana: 3, n5: 1, n4: 0 };
export const POINTS_PER_TOKEN = 400;
export const MAX_TOKENS = 4;
export const HINT_WORDS = 3;
export const CHALLENGE_MS = 8_000;
/** A chain this long ends the showdown: most words (then most points) among survivors wins. */
export const MAX_TURNS = 60;
/** Speaking bonuses come from one pool: at most 30% of a round's points (design doc, Scoring). */
export const BONUS_SHARE = 0.3;

export const DURATIONS = {
  intro: 12_000,
  fakePrompt: 7_000,
  fakeAnswer: 60_000,
  fakeReveal: 30_000,
  fakeScore: 15_000,
  telPrompt: 8_000,
  telStep: 45_000,
  telStepKanaExtra: 15_000,
  telScore: 12_000,
  shiriPrompt: 9_000,
  shiriScore: 14_000,
};

// ---- state ----

export type Segment = 'fake' | 'telephone' | 'shiritori';
export type Via = Utterance['via'];

export interface FakeOption {
  id: string;
  text: string;
  /** Empty for the real meaning. Two players who wrote the same fake share one option. */
  authorIds: string[];
  real: boolean;
}

export interface FakeResult {
  optionId: string;
  text: string;
  real: boolean;
  authors: { id: string; name: string }[];
  pickedBy: { id: string; name: string }[];
}

export interface FakeRound {
  word: ObscureWord;
  options: FakeOption[];
  picks: Record<string, string>;
  said: Record<string, Via>;
  results: FakeResult[] | null;
  /** Points each player earned this word (picks + fooling + golden-word bonus). */
  points: Record<string, number>;
}

export interface TelStep {
  playerId: string;
  /** What this step turns the previous one into. */
  to: 'en' | 'jp';
  text: string | null;
  reading: string | null;
  via: Via | null;
  skipped: boolean;
}

export interface Telephone {
  starter: { id: string; jp: JpText };
  steps: TelStep[];
  current: number;
  /** When the reveal began, so the vote can end early once the stage has shown every step. */
  revealAt: number;
  /** voterId → step index */
  votes: Record<string, number>;
  points: Record<string, number> | null;
}

export interface TelPrev {
  text: string;
  reading: string | null;
  romaji: string | null;
  lang: 'jp' | 'en';
}

export interface ChainWord {
  playerId: string | null;
  text: string;
  reading: string;
  via: Via | null;
  /** How the word was accepted. */
  source: 'start' | 'pack' | 'list' | 'dictionary' | 'room';
  en: string | null;
}

export type OutReason = 'n' | 'timeout' | 'rejected' | 'left';

export interface Challenge {
  playerId: string;
  text: string;
  reading: string;
  via: Via;
  voters: string[];
  /** voterId → accept? */
  votes: Record<string, boolean>;
  result: 'accepted' | 'rejected' | null;
}

export interface Shiritori {
  chain: ChainWord[];
  /** Turn order, fixed at the start; knocked-out players keep their place in it. */
  rotation: string[];
  alive: string[];
  out: { playerId: string; reason: OutReason; word: string | null }[];
  turn: string | null;
  turnStart: number;
  turnBaseMs: number;
  turns: number;
  acted: boolean;
  bankMs: Record<string, number>;
  tokens: Record<string, number>;
  hint: { playerId: string; words: { kana: string; en: string }[] } | null;
  challenge: Challenge | null;
  /** The last thing that happened, for the stage's caption. */
  last: { kind: 'word' | 'out' | 'challenge'; playerId: string; text: string; reason?: OutReason; result?: 'accepted' | 'rejected' } | null;
  wordsBy: Record<string, number>;
  winnerId: string | null;
  crown: number;
  points: Record<string, number>;
}

export interface WordGauntletState {
  packId: string | null;
  round: number;
  segment: Segment | null;
  fakeDeck: ObscureWord[];
  fakeIndex: number;
  fake: FakeRound | null;
  telephone: Telephone | null;
  shiritori: Shiritori | null;
  /** One bonus pool per round: base points and bonus points awarded so far. */
  pool: { base: number; bonus: number };
  /** Every point this mode gave, per player (the room's scores should match). */
  earned: Record<string, number>;
  stats: { fooled: Record<string, number>; telVotes: Record<string, number> };
}

// ---- moves ----

export type WordGauntletMove =
  | { kind: 'fake'; text: string }
  | { kind: 'pick'; optionId: string }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'step'; utterance: Utterance }
  | { kind: 'vote'; step: number }
  | { kind: 'word'; utterance: Utterance }
  | { kind: 'hint' }
  | { kind: 'judge'; accept: boolean };

// ---- view ----

export interface WordGauntletView {
  mode: 'word-gauntlet';
  segment: Segment | null;
  /** Gauntlet round 1–3 (0 at the intro). */
  round: number;
  /** Points per player from this mode so far (public, like the scoreboard). */
  earned: Record<string, number>;
  fake: {
    index: number;
    total: number;
    word: { text: string; kana: string; romaji: string };
    submitted: string[];
    /** Anonymous options from the reveal on. */
    options: { id: string; text: string }[] | null;
    picked: string[];
    /** The real meaning and who wrote what, at the score beat. */
    golden: { jp: JpText; literal: string | null } | null;
    results: FakeResult[] | null;
    points: Record<string, number> | null;
    said: string[];
    mine: { fake: string | null; optionId: string | null; pick: string | null; said: Via | null } | null;
  } | null;
  telephone: {
    order: { playerId: string; to: 'en' | 'jp'; done: boolean; skipped: boolean }[];
    current: number;
    /** The whole chain, from the reveal on. */
    reveal: { starter: JpText; steps: { index: number; playerId: string; to: 'en' | 'jp'; text: string | null; reading: string | null; skipped: boolean }[] } | null;
    revealStepMs: number;
    voted: string[];
    votes: number[] | null;
    points: Record<string, number> | null;
    mine: {
      step: number | null;
      /** Only while it is this player's step: the one step they may see. */
      prev: TelPrev | null;
      to: 'en' | 'jp' | null;
      sent: string | null;
      vote: number | null;
    } | null;
  } | null;
  shiritori: {
    chain: ChainWord[];
    need: string;
    needOptions: string[];
    needRomaji: string;
    turn: string | null;
    turnBaseMs: number;
    alive: string[];
    out: Shiritori['out'];
    tokens: Record<string, number>;
    bankMs: Record<string, number>;
    challenge: { playerId: string; text: string; reading: string; voters: string[]; voted: string[]; result: Challenge['result'] } | null;
    last: Shiritori['last'];
    winnerId: string | null;
    crown: number;
    points: Record<string, number> | null;
    mine: { hint: { kana: string; en: string }[] | null; tokens: number; vote: boolean | null } | null;
  } | null;
}

// ---- content ----

/** Every word a shiritori word may be found in: topic packs, the built-in list, golden words. */
interface Lexicon {
  byKey: Map<string, { kana: string; en: string; itemId: string; text: string; source: 'pack' | 'list' }>;
  /** Hint and bot vocabulary: nouns only, never ending in ん. */
  nouns: { kana: string; en: string; text: string; itemId: string }[];
}

const lexicons = new WeakMap<ContentLibrary, Lexicon>();

export function lexiconFor(content: ContentLibrary): Lexicon {
  const cached = lexicons.get(content);
  if (cached) return cached;
  const byKey: Lexicon['byKey'] = new Map();
  const nouns: Lexicon['nouns'] = [];
  const add = (kana: string, en: string, itemId: string, text: string, source: 'pack' | 'list', noun: boolean) => {
    const reading = wordReading(kana);
    if (!reading) return;
    const key = repeatKey(reading);
    if (!byKey.has(key)) byKey.set(key, { kana: reading, en, itemId, text, source });
    if (noun && !endsInN(reading) && !nouns.some((n) => repeatKey(n.kana) === key)) nouns.push({ kana: reading, en, text, itemId });
  };
  for (const pack of content.packs) {
    for (const w of pack.words as PackWord[]) add(w.jp.kana, w.jp.en, w.id, w.jp.text, 'pack', w.pos === 'noun');
  }
  for (const n of SHIRITORI_NOUNS) add(n.kana, n.en, `wg.shiritori.${n.kana}`, n.kana, 'list', true);
  for (const w of OBSCURE_WORDS) add(w.jp.kana, w.jp.en, `wg.golden.${w.id}`, w.jp.text, 'list', false);
  const lex = { byKey, nouns };
  lexicons.set(content, lex);
  return lex;
}

function starterFor(ctx: ModeContext, packId: string | null): { id: string; jp: JpText } {
  const packs = ctx.content.packs;
  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  const phrases = pack?.phrases ?? [];
  const n5 = phrases.filter((p) => p.level === 'n5');
  const pool = n5.length ? n5 : phrases.length ? phrases : null;
  if (pool) {
    const p = pool[Math.floor(ctx.random() * pool.length)]!;
    return { id: p.id, jp: p.jp };
  }
  return FALLBACK_STARTERS[Math.floor(ctx.random() * FALLBACK_STARTERS.length)]!;
}

// ---- small helpers ----

const hasJapanese = (text: string): boolean => /[ぁ-ゖァ-ヺー㐀-鿿]/.test(text);
const hasLatin = (text: string): boolean => /[A-Za-z]/.test(text);
const normEn = (text: string): string => text.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

function give(s: WordGauntletState, ctx: ModeContext, playerId: string, points: number, bucket: Record<string, number>): void {
  if (points <= 0 || !ctx.player(playerId)) return;
  ctx.award(playerId, points);
  s.earned[playerId] = (s.earned[playerId] ?? 0) + points;
  bucket[playerId] = (bucket[playerId] ?? 0) + points;
}

function giveBase(s: WordGauntletState, ctx: ModeContext, playerId: string, points: number, bucket: Record<string, number>): void {
  if (!ctx.player(playerId)) return;
  s.pool.base += points;
  give(s, ctx, playerId, points, bucket);
}

/** A speaking bonus, trimmed to what is left in the round's 30% pool. Returns what was given. */
function giveBonus(s: WordGauntletState, ctx: ModeContext, playerId: string, want: number, bucket: Record<string, number>): number {
  if (!ctx.player(playerId)) return 0;
  const cap = Math.floor((s.pool.base * BONUS_SHARE) / (1 - BONUS_SHARE)) - s.pool.bonus;
  const points = Math.max(0, Math.min(want, cap));
  s.pool.bonus += points;
  give(s, ctx, playerId, points, bucket);
  return points;
}

function name(ctx: ModeContext, id: string): string {
  return ctx.player(id)?.name ?? '(left)';
}

/** Option ids are random, so sorting by id says nothing about who wrote what (or which is real). */
function anonymousOrder<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function readingOf(u: Utterance): string | null {
  return wordReading(u.reading ?? u.text);
}

// ---- the mode ----

export const wordGauntletMode: Mode<WordGauntletState, WordGauntletView> = {
  info: {
    id: 'word-gauntlet',
    title: 'Word Gauntlet',
    titleJa: 'ことばの関門',
    blurb: 'Fake meanings, a telephone of translations, then a spoken shiritori showdown.',
    host: 'pon',
    minPlayers: 4,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: true,
  },

  setup(ctx, opts) {
    const packId = opts.packId && ctx.content.packs.some((p) => p.id === opts.packId) ? opts.packId : (ctx.content.packs[0]?.id ?? null);
    return {
      packId,
      round: 0,
      segment: null,
      fakeDeck: shuffled(OBSCURE_WORDS, () => ctx.random()).slice(0, FAKE_WORDS_PER_GAME),
      fakeIndex: 0,
      fake: null,
      telephone: null,
      shiritori: null,
      pool: { base: 0, bonus: 0 },
      earned: {},
      stats: { fooled: {}, telVotes: {} },
    };
  },

  next(s, from, ctx) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        if (s.segment === 'fake') return 'reveal';
        if (s.segment === 'telephone') return nextTelStep(s, ctx) >= 0 ? 'answer' : 'reveal';
        if (s.segment === 'shiritori') return s.shiritori?.challenge ? 'reveal' : showdownOver(s) ? 'score' : 'answer';
        return 'recap';
      case 'reveal':
        if (s.segment === 'shiritori') return showdownOver(s) ? 'score' : 'answer';
        return 'score';
      case 'score':
        return s.segment === 'shiritori' ? 'recap' : 'prompt';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    if (phase === 'intro') {
      ctx.cue({ host: 'pon', event: 'intro' });
      return;
    }
    if (phase === 'prompt') return enterPrompt(s, ctx);
    if (s.segment === 'fake') return enterFake(s, phase, ctx);
    if (s.segment === 'telephone') return enterTelephone(s, phase, ctx);
    if (s.segment === 'shiritori') return enterShiritori(s, phase, ctx);
  },

  leave(s, phase, ctx) {
    if (s.segment === 'telephone' && phase === 'answer') {
      const step = s.telephone?.steps[s.telephone.current];
      if (step && step.text === null) step.skipped = true;
    }
    if (s.segment === 'shiritori') {
      const sh = s.shiritori!;
      if (phase === 'answer' && sh.turn && !sh.acted) {
        // Out of time (or gone): a dropped phone's turn simply times out.
        knockOut(s, ctx, sh.turn, ctx.player(sh.turn) ? 'timeout' : 'left', null);
        sh.bankMs[sh.turn] = 0;
      }
      if (phase === 'reveal' && sh.challenge) resolveChallenge(s, ctx);
    }
  },

  duration(s, phase, ctx) {
    if (phase === 'intro') return DURATIONS.intro;
    if (s.segment === 'fake') {
      return { prompt: DURATIONS.fakePrompt, answer: DURATIONS.fakeAnswer, reveal: DURATIONS.fakeReveal, score: DURATIONS.fakeScore }[phase as 'prompt'] ?? 0;
    }
    if (s.segment === 'telephone') {
      const t = s.telephone!;
      if (phase === 'prompt') return DURATIONS.telPrompt;
      if (phase === 'answer') {
        const p = ctx.player(t.steps[t.current]?.playerId ?? '');
        return DURATIONS.telStep + (p?.level === 'kana' ? DURATIONS.telStepKanaExtra : 0);
      }
      if (phase === 'reveal') return 20_000 + TELEPHONE_REVEAL_STEP_MS * (t.steps.length + 1);
      if (phase === 'score') return DURATIONS.telScore;
    }
    if (s.segment === 'shiritori') {
      const sh = s.shiritori!;
      if (phase === 'prompt') return DURATIONS.shiriPrompt;
      if (phase === 'answer') return sh.turnBaseMs + (sh.turn ? (sh.bankMs[sh.turn] ?? 0) : 0);
      if (phase === 'reveal') return CHALLENGE_MS;
      if (phase === 'score') return DURATIONS.shiriScore;
    }
    return 0;
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (s.segment === 'fake' && s.fake) {
      const f = s.fake;
      if (here.length === 0) return false;
      if (phase === 'answer') return here.every((p) => f.options.some((o) => o.authorIds.includes(p.id)));
      if (phase === 'reveal') return here.every((p) => f.picks[p.id] !== undefined);
      return false;
    }
    if (s.segment === 'telephone' && s.telephone) {
      const t = s.telephone;
      if (phase === 'answer') {
        const step = t.steps[t.current];
        // A stepper who has gone (or whose phone is away) is skipped rather than waited for.
        return !step || step.text !== null || !ctx.player(step.playerId)?.connected;
      }
      if (phase === 'reveal') {
        if (here.length === 0) return false;
        const voters = here.filter((p) => votableSteps(t, p.id).length > 0);
        return voters.every((p) => t.votes[p.id] !== undefined) && allStepsShown(t, ctx);
      }
      return false;
    }
    if (s.segment === 'shiritori' && s.shiritori) {
      const sh = s.shiritori;
      if (phase === 'answer') return sh.acted || !sh.turn || !ctx.player(sh.turn);
      if (phase === 'reveal') {
        const c = sh.challenge;
        if (!c) return true;
        const live = c.voters.filter((id) => ctx.player(id)?.connected);
        return live.every((id) => c.votes[id] !== undefined);
      }
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw) || typeof raw.kind !== 'string') return moveError('bad-move');
    switch (raw.kind) {
      case 'fake':
        return moveFake(s, phase, playerId, raw.text, ctx);
      case 'pick':
        return movePick(s, phase, playerId, raw.optionId);
      case 'say':
        return moveSay(s, phase, playerId, raw.utterance, ctx);
      case 'step':
        return moveStep(s, phase, playerId, raw.utterance);
      case 'vote':
        return moveVote(s, phase, playerId, raw.step);
      case 'word':
        return moveWord(s, phase, playerId, raw.utterance, ctx);
      case 'hint':
        return moveHint(s, phase, playerId, ctx);
      case 'judge':
        return moveJudge(s, phase, playerId, raw.accept);
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId, ctx) {
    if (s.fake) {
      delete s.fake.picks[playerId];
      // Their fake stays on the board (someone may already have picked it) but earns nothing.
    }
    if (s.telephone) delete s.telephone.votes[playerId];
    const sh = s.shiritori;
    if (sh) {
      if (sh.alive.includes(playerId) && sh.turn !== playerId) knockOut(s, ctx, playerId, 'left', null);
      if (sh.challenge) {
        sh.challenge.voters = sh.challenge.voters.filter((id) => id !== playerId);
        delete sh.challenge.votes[playerId];
      }
    }
  },

  progress(s) {
    return { round: s.round, totalRounds: 3 };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const me = viewer.kind === 'player' ? viewer.playerId : null;
    return {
      mode: 'word-gauntlet',
      segment: phase === 'intro' ? null : s.segment,
      round: s.round,
      earned: s.earned,
      fake: s.segment === 'fake' && phase !== 'intro' ? fakeView(s, phase, me) : null,
      telephone: s.segment === 'telephone' ? telephoneView(s, phase, me) : null,
      shiritori: s.segment === 'shiritori' ? shiritoriView(s, phase, me, ctx) : null,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const top = (rec: Record<string, number>) => {
      const best = Object.entries(rec)
        .filter(([id, n]) => n > 0 && ctx.player(id))
        .sort((a, b) => b[1] - a[1] || (ctx.player(a[0])!.seat - ctx.player(b[0])!.seat))[0];
      return best?.[0];
    };
    const winner = s.shiritori?.winnerId;
    if (winner && ctx.player(winner)) out.push({ playerId: winner, name: name(ctx, winner), title: 'しりとり王', en: 'Shiritori Champion' });
    const fibber = top(s.stats.fooled);
    if (fibber) out.push({ playerId: fibber, name: name(ctx, fibber), title: 'うそつき名人', en: 'Master Fibber (fooled the most players)' });
    const translator = top(s.stats.telVotes);
    if (translator) out.push({ playerId: translator, name: name(ctx, translator), title: 'ほんやく大賞', en: 'Translation Grand Prize (favourite step)' });
    return out;
  },
};

// ---- segments: entering ----

function enterPrompt(s: WordGauntletState, ctx: ModeContext): void {
  // Which segment does this prompt open? Fake words first, then telephone, then shiritori.
  if (s.segment === null || (s.segment === 'fake' && s.fakeIndex < s.fakeDeck.length)) {
    if (s.segment === null) s.pool = { base: 0, bonus: 0 };
    s.segment = 'fake';
    s.round = 1;
    const word = s.fakeDeck[s.fakeIndex] ?? OBSCURE_WORDS[0]!;
    s.fakeIndex += 1;
    s.fake = { word, options: [], picks: {}, said: {}, results: null, points: {} };
    ctx.cue({ host: 'pon', event: 'prompt_read', prompt: { text: word.jp.text, kana: word.jp.kana, en: 'What does this word mean?' } });
    return;
  }
  if (s.segment === 'fake' && ctx.players().length >= TELEPHONE_MIN_PLAYERS) {
    s.segment = 'telephone';
    s.round = 2;
    s.pool = { base: 0, bonus: 0 };
    const seated = ctx.players();
    const startAt = Math.floor(ctx.random() * seated.length);
    const order = [...seated.slice(startAt), ...seated.slice(0, startAt)];
    const starter = starterFor(ctx, s.packId);
    s.telephone = {
      starter,
      steps: order.map((p, i) => ({ playerId: p.id, to: i % 2 === 0 ? 'en' : 'jp', text: null, reading: null, via: null, skipped: false })),
      current: -1,
      revealAt: 0,
      votes: {},
      points: null,
    };
    ctx.cue({ host: 'pon', event: 'prompt_read' });
    return;
  }
  startShiritori(s, ctx);
}

function startShiritori(s: WordGauntletState, ctx: ModeContext): void {
  s.segment = 'shiritori';
  s.round = 3;
  s.pool = { base: 0, bonus: 0 };
  // Trailing players go first (design doc, Comebacks); ties by seat.
  const seated = [...ctx.players()].sort((a, b) => a.seat - b.seat);
  const bankMs: Record<string, number> = {};
  const tokens: Record<string, number> = {};
  for (const p of seated) {
    bankMs[p.id] = Math.min(BANK_MAX_MS, Math.floor(p.score / BANK_POINTS_PER_SECOND) * 1000);
    tokens[p.id] = Math.min(MAX_TOKENS, BASE_TOKENS[p.level] + Math.floor(p.score / POINTS_PER_TOKEN));
  }
  const first = [...seated].sort((a, b) => a.score - b.score || a.seat - b.seat)[0];
  const idx = first ? seated.indexOf(first) : 0;
  const alive = [...seated.slice(idx), ...seated.slice(0, idx)].map((p) => p.id);
  s.shiritori = {
    chain: [{ playerId: null, text: 'しりとり', reading: 'しりとり', via: null, source: 'start', en: 'shiritori (word chain)' }],
    rotation: [...alive],
    alive,
    out: [],
    turn: null,
    turnStart: ctx.now,
    turnBaseMs: TURN_START_MS,
    turns: 0,
    acted: false,
    bankMs,
    tokens,
    hint: null,
    challenge: null,
    last: null,
    wordsBy: {},
    winnerId: null,
    crown: 0,
    points: {},
  };
  ctx.cue({ host: 'pon', event: 'prompt_read', prompt: { text: 'しりとり', kana: 'しりとり', en: 'Word chain: start your word with the last kana' } });
}

function enterFake(s: WordGauntletState, phase: Phase, ctx: ModeContext): void {
  const f = s.fake!;
  if (phase === 'reveal') {
    f.options.push({ id: ctx.newId(), text: f.word.jp.en, authorIds: [], real: true });
    ctx.cue({ host: 'pon', event: 'reveal_react', tier: 'good' });
  }
  if (phase === 'score') {
    scoreFake(s, ctx);
    for (const p of ctx.players()) ctx.phrase(p.id, { itemId: `wg.golden.${f.word.id}`, text: f.word.jp.text, kana: f.word.jp.kana, en: f.word.jp.en, outcome: 'seen' });
    ctx.cue({ host: 'pon', event: 'kakegoe_call', prompt: { text: f.word.jp.text, kana: f.word.jp.kana, en: f.word.jp.en } });
  }
}

function enterTelephone(s: WordGauntletState, phase: Phase, ctx: ModeContext): void {
  const t = s.telephone!;
  if (phase === 'answer') {
    t.current = nextTelStep(s, ctx);
    if (t.current < 0) t.current = t.steps.length;
  }
  if (phase === 'reveal') {
    t.current = t.steps.length;
    t.revealAt = ctx.now;
    for (const p of ctx.players()) ctx.phrase(p.id, { itemId: t.starter.id, text: t.starter.jp.text, kana: t.starter.jp.kana, en: t.starter.jp.en, outcome: 'seen' });
    ctx.cue({ host: 'pon', event: 'reveal_react', tier: 'ippon' });
  }
  if (phase === 'score') scoreTelephone(s, ctx);
}

function enterShiritori(s: WordGauntletState, phase: Phase, ctx: ModeContext): void {
  const sh = s.shiritori!;
  if (phase === 'answer') {
    sh.challenge = null;
    sh.hint = null;
    sh.acted = false;
    sh.turn = nextTurn(sh, ctx);
    const p = sh.turn ? ctx.player(sh.turn) : undefined;
    const laps = Math.floor(sh.turns / Math.max(1, sh.alive.length));
    sh.turnBaseMs = Math.max(TURN_FLOOR_MS[p?.level ?? 'n5'], TURN_START_MS - TURN_SHRINK_PER_LAP_MS * laps);
    sh.turnStart = ctx.now;
    sh.turns += 1;
  }
  if (phase === 'reveal' && sh.challenge) {
    ctx.cue({ host: 'pon', event: 'answer_hurry' });
  }
  if (phase === 'score') crownWinner(s, ctx);
}

// ---- Fake Kanji ----

function moveFake(s: WordGauntletState, phase: Phase, playerId: string, raw: unknown, ctx: ModeContext): MoveResult {
  if (s.segment !== 'fake' || phase !== 'answer' || !s.fake) return moveError('wrong-phase');
  const f = s.fake;
  if (f.options.some((o) => o.authorIds.includes(playerId))) return moveError('already-answered');
  const text = cleanText(raw, MAX_ANSWER_LENGTH);
  if (!text) return moveError('empty-answer');
  const n = normEn(text);
  if (!n) return moveError('empty-answer');
  const real = normEn(f.word.jp.en);
  if (n === real || f.word.close.some((c) => ` ${n} `.includes(` ${normEn(c)} `))) return moveError('too-close');
  const same = f.options.find((o) => normEn(o.text) === n);
  if (same) same.authorIds.push(playerId);
  else f.options.push({ id: ctx.newId(), text, authorIds: [playerId], real: false });
  return MOVE_OK;
}

function movePick(s: WordGauntletState, phase: Phase, playerId: string, optionId: unknown): MoveResult {
  if (s.segment !== 'fake' || phase !== 'reveal' || !s.fake) return moveError('wrong-phase');
  const f = s.fake;
  if (f.picks[playerId]) return moveError('already-voted');
  const option = f.options.find((o) => o.id === optionId);
  if (!option) return moveError('unknown-answer');
  if (option.authorIds.includes(playerId)) return moveError('own-answer');
  f.picks[playerId] = option.id;
  return MOVE_OK;
}

function scoreFake(s: WordGauntletState, ctx: ModeContext): void {
  const f = s.fake!;
  const real = f.options.find((o) => o.real)!;
  for (const [voter, optionId] of Object.entries(f.picks)) {
    if (!ctx.player(voter)) continue;
    if (optionId === real.id) giveBase(s, ctx, voter, POINTS_REAL_FOUND, f.points);
    else {
      const option = f.options.find((o) => o.id === optionId);
      for (const author of option?.authorIds ?? []) {
        if (author === voter) continue;
        giveBase(s, ctx, author, POINTS_PER_FOOLED, f.points);
        s.stats.fooled[author] = (s.stats.fooled[author] ?? 0) + 1;
      }
    }
  }
  f.results = anonymousOrder(f.options).map((o) => ({
    optionId: o.id,
    text: o.text,
    real: o.real,
    authors: o.authorIds.map((id) => ({ id, name: name(ctx, id) })),
    pickedBy: Object.entries(f.picks)
      .filter(([, opt]) => opt === o.id)
      .map(([id]) => ({ id, name: name(ctx, id) })),
  }));
}

/** At the score beat everyone may say the golden word aloud (typed earns less). */
function moveSay(s: WordGauntletState, phase: Phase, playerId: string, u: unknown, ctx: ModeContext): MoveResult {
  if (s.segment !== 'fake' || phase !== 'score' || !s.fake) return moveError('wrong-phase');
  if (!isUtterance(u)) return moveError('bad-move');
  const f = s.fake;
  if (f.said[playerId]) return moveError('already-answered');
  if (!matchesAccepted(utteranceReading(u), [f.word.jp.kana])) return moveError('not-the-word');
  f.said[playerId] = u.via;
  const spoken = u.via === 'speech';
  giveBonus(s, ctx, playerId, spoken ? GOLDEN_SAID_BONUS : GOLDEN_TYPED_BONUS, f.points);
  ctx.phrase(playerId, { itemId: `wg.golden.${f.word.id}`, text: f.word.jp.text, kana: f.word.jp.kana, en: f.word.jp.en, outcome: 'said' });
  return MOVE_OK;
}

// ---- Lost in Translation ----

/** The next step index that still needs doing, or -1. */
function nextTelStep(s: WordGauntletState, _ctx: ModeContext): number {
  const t = s.telephone;
  if (!t) return -1;
  const i = t.current + 1;
  return i < t.steps.length ? i : -1;
}

/** What the step at `index` is translating: the last step that was done before it, or the starter. */
export function previousText(t: Telephone, index: number): { text: string; reading: string | null; lang: 'jp' | 'en' } {
  for (let i = index - 1; i >= 0; i--) {
    const step = t.steps[i]!;
    if (step.text !== null) return { text: step.text, reading: step.reading, lang: step.to };
  }
  return { text: t.starter.jp.text, reading: t.starter.jp.kana, lang: 'jp' };
}

function moveStep(s: WordGauntletState, phase: Phase, playerId: string, u: unknown): MoveResult {
  if (s.segment !== 'telephone' || phase !== 'answer' || !s.telephone) return moveError('wrong-phase');
  const t = s.telephone;
  const step = t.steps[t.current];
  if (!step || step.playerId !== playerId) return moveError('not-your-turn');
  if (step.text !== null) return moveError('already-answered');
  if (!isUtterance(u)) return moveError('bad-move');
  const text = cleanText(u.text, MAX_ANSWER_LENGTH);
  if (!text) return moveError('empty-answer');
  if (step.to === 'jp' && !hasJapanese(text)) return moveError('not-japanese');
  if (step.to === 'en' && !hasLatin(text)) return moveError('not-english');
  step.text = text;
  step.via = u.via;
  step.reading = step.to === 'jp' ? (u.reading ?? (isKana(text) ? text : null)) : null;
  return MOVE_OK;
}

function votableSteps(t: Telephone, playerId: string): number[] {
  return t.steps.flatMap((st, i) => (st.text !== null && st.playerId !== playerId ? [i] : []));
}

/** The stage reveals the drift one step at a time; the vote never ends before the last one shows. */
function allStepsShown(t: Telephone, ctx: ModeContext): boolean {
  return ctx.now >= t.revealAt + TELEPHONE_REVEAL_STEP_MS * (t.steps.length + 1);
}

function moveVote(s: WordGauntletState, phase: Phase, playerId: string, raw: unknown): MoveResult {
  if (s.segment !== 'telephone' || phase !== 'reveal' || !s.telephone) return moveError('wrong-phase');
  const t = s.telephone;
  if (t.votes[playerId] !== undefined) return moveError('already-voted');
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return moveError('bad-move');
  const step = t.steps[raw];
  if (!step || step.text === null) return moveError('unknown-answer');
  if (step.playerId === playerId) return moveError('own-answer');
  t.votes[playerId] = raw;
  return MOVE_OK;
}

function scoreTelephone(s: WordGauntletState, ctx: ModeContext): void {
  const t = s.telephone!;
  const points: Record<string, number> = {};
  for (const [voter, index] of Object.entries(t.votes)) {
    const step = t.steps[index];
    if (!step || !ctx.player(voter)) continue;
    giveBase(s, ctx, step.playerId, POINTS_PER_TELEPHONE_VOTE * TELEPHONE_MULTIPLIER, points);
    s.stats.telVotes[step.playerId] = (s.stats.telVotes[step.playerId] ?? 0) + 1;
  }
  // Speaking bonus for the Japanese steps, scaled down together if the pool can't cover it.
  const wants = t.steps
    .filter((st) => st.to === 'jp' && st.text !== null && ctx.player(st.playerId))
    .map((st) => ({ id: st.playerId, want: (st.via === 'speech' ? TELEPHONE_SPOKEN_BONUS : TELEPHONE_TYPED_BONUS) * TELEPHONE_MULTIPLIER }));
  const total = wants.reduce((n, w) => n + w.want, 0);
  const cap = Math.floor((s.pool.base * BONUS_SHARE) / (1 - BONUS_SHARE));
  const scale = total > cap ? cap / total : 1;
  for (const w of wants) giveBonus(s, ctx, w.id, Math.floor(w.want * scale), points);
  t.points = points;
  const best = Object.entries(points).sort((a, b) => b[1] - a[1])[0];
  if (best) ctx.cue({ host: 'pon', event: 'encore_cheer', slots: { name: name(ctx, best[0]) } });
}

// ---- Shiritori Showdown ----

function needKana(sh: Shiritori): string {
  return lastKana(sh.chain.at(-1)?.reading ?? 'しりとり');
}

function nextTurn(sh: Shiritori, ctx: ModeContext): string | null {
  const alive = sh.alive.filter((id) => ctx.player(id));
  if (!alive.length) return null;
  if (!sh.turn) return alive[0]!;
  // The player after the last one in the fixed rotation (the last one may be out now).
  const from = sh.rotation.indexOf(sh.turn);
  for (let k = 1; k <= sh.rotation.length; k++) {
    const id = sh.rotation[(from + k) % sh.rotation.length]!;
    if (alive.includes(id)) return id;
  }
  return alive[0]!;
}

function showdownOver(s: WordGauntletState): boolean {
  const sh = s.shiritori;
  if (!sh) return true;
  return sh.alive.length <= 1 || sh.turns >= MAX_TURNS;
}

function knockOut(s: WordGauntletState, ctx: ModeContext, playerId: string, reason: OutReason, word: string | null): void {
  const sh = s.shiritori!;
  if (!sh.alive.includes(playerId)) return;
  sh.alive = sh.alive.filter((id) => id !== playerId);
  sh.out.push({ playerId, reason, word });
  sh.last = { kind: 'out', playerId, text: word ?? '', reason };
  if (reason !== 'left') ctx.cue({ host: 'pon', event: 'miss_kind', slots: { name: name(ctx, playerId) } });
}

function moveWord(s: WordGauntletState, phase: Phase, playerId: string, u: unknown, ctx: ModeContext): MoveResult {
  if (s.segment !== 'shiritori' || phase !== 'answer' || !s.shiritori) return moveError('wrong-phase');
  const sh = s.shiritori;
  if (sh.turn !== playerId) return moveError('not-your-turn');
  if (sh.acted) return moveError('already-answered');
  if (!isUtterance(u)) return moveError('bad-move');
  const text = cleanText(u.text, 40);
  if (!text) return moveError('empty-answer');
  const reading = readingOf(u);
  if (!reading) return moveError('not-kana');
  if (!follows(needKana(sh), reading)) return moveError('wrong-start');
  const key = repeatKey(reading);
  if (sh.chain.some((w) => repeatKey(w.reading) === key)) return moveError('repeat');

  // A valid try: the turn is spent, and time over the base comes out of the bank.
  sh.acted = true;
  const over = Math.max(0, ctx.now - sh.turnStart - sh.turnBaseMs);
  sh.bankMs[playerId] = Math.max(0, (sh.bankMs[playerId] ?? 0) - over);

  if (endsInN(reading)) {
    // The word stays off the chain, so the next player carries on from the word before it.
    knockOut(s, ctx, playerId, 'n', text);
    return MOVE_OK;
  }
  const lex = lexiconFor(ctx.content);
  const known = lex.byKey.get(key);
  if (known) {
    acceptWord(s, ctx, { playerId, text, reading, via: u.via, source: known.source, en: known.en }, known);
    return MOVE_OK;
  }
  if (dictionaryNoun(u.tokens, reading)) {
    acceptWord(s, ctx, { playerId, text, reading, via: u.via, source: 'dictionary', en: null }, null);
    return MOVE_OK;
  }
  // Nobody vouches for it: the knocked-out players judge (or, if none yet, everyone else).
  const judges = sh.out.map((o) => o.playerId).filter((id) => ctx.player(id));
  const voters = judges.length ? judges : sh.alive.filter((id) => id !== playerId && ctx.player(id));
  sh.challenge = { playerId, text, reading, via: u.via, voters, votes: {}, result: null };
  sh.last = { kind: 'challenge', playerId, text };
  return MOVE_OK;
}

function acceptWord(s: WordGauntletState, ctx: ModeContext, word: ChainWord, item: { kana: string; en: string; itemId: string; text: string } | null): void {
  const sh = s.shiritori!;
  sh.chain.push(word);
  sh.last = { kind: 'word', playerId: word.playerId!, text: word.text };
  const id = word.playerId!;
  sh.wordsBy[id] = (sh.wordsBy[id] ?? 0) + 1;
  giveBase(s, ctx, id, SHIRITORI_WORD_POINTS, sh.points);
  if (word.via === 'speech') giveBonus(s, ctx, id, SHIRITORI_SPOKEN_BONUS, sh.points);
  if (item) {
    const hinted = sh.hint?.playerId === id && sh.hint.words.some((w) => repeatKey(w.kana) === repeatKey(word.reading));
    ctx.phrase(id, { itemId: item.itemId, text: item.text, kana: item.kana, en: item.en, outcome: hinted ? 'seen' : 'said' });
  }
}

function moveHint(s: WordGauntletState, phase: Phase, playerId: string, ctx: ModeContext): MoveResult {
  if (s.segment !== 'shiritori' || phase !== 'answer' || !s.shiritori) return moveError('wrong-phase');
  const sh = s.shiritori;
  if (sh.turn !== playerId || sh.acted) return moveError('not-your-turn');
  if (sh.hint?.playerId === playerId) return moveError('already-hinted');
  if ((sh.tokens[playerId] ?? 0) <= 0) return moveError('no-tokens');
  sh.tokens[playerId] = (sh.tokens[playerId] ?? 0) - 1;
  sh.hint = { playerId, words: hintWords(sh, ctx) };
  return MOVE_OK;
}

/** Up to three unused pack (or built-in) nouns that can follow the chain, pack words first. */
export function hintWords(sh: Shiritori, ctx: ModeContext): { kana: string; en: string }[] {
  const need = needKana(sh);
  const used = new Set(sh.chain.map((w) => repeatKey(w.reading)));
  const lex = lexiconFor(ctx.content);
  const fits = lex.nouns.filter((n) => follows(need, n.kana) && !used.has(repeatKey(n.kana)));
  const fromPacks = shuffled(fits.filter((n) => !n.itemId.startsWith('wg.')), () => ctx.random());
  const fromList = shuffled(fits.filter((n) => n.itemId.startsWith('wg.')), () => ctx.random());
  return [...fromPacks, ...fromList].slice(0, HINT_WORDS).map((n) => ({ kana: n.kana, en: n.en }));
}

function moveJudge(s: WordGauntletState, phase: Phase, playerId: string, accept: unknown): MoveResult {
  if (s.segment !== 'shiritori' || phase !== 'reveal' || !s.shiritori?.challenge) return moveError('wrong-phase');
  const c = s.shiritori.challenge;
  if (!c.voters.includes(playerId)) return moveError('not-a-judge');
  if (c.votes[playerId] !== undefined) return moveError('already-voted');
  if (typeof accept !== 'boolean') return moveError('bad-move');
  c.votes[playerId] = accept;
  return MOVE_OK;
}

/** Majority accepts; ties (and no votes at all) accept: forgiving by design. */
export function challengeAccepted(votes: Record<string, boolean>): boolean {
  const all = Object.values(votes);
  const yes = all.filter(Boolean).length;
  return all.length - yes <= yes;
}

function resolveChallenge(s: WordGauntletState, ctx: ModeContext): void {
  const sh = s.shiritori!;
  const c = sh.challenge!;
  const ok = challengeAccepted(c.votes);
  c.result = ok ? 'accepted' : 'rejected';
  if (!ctx.player(c.playerId)) {
    sh.challenge = null;
    return;
  }
  if (ok) {
    acceptWord(s, ctx, { playerId: c.playerId, text: c.text, reading: c.reading, via: c.via, source: 'room', en: null }, null);
    sh.last = { kind: 'challenge', playerId: c.playerId, text: c.text, result: 'accepted' };
    ctx.cue({ host: 'pon', event: 'room_overrule' });
  } else {
    knockOut(s, ctx, c.playerId, 'rejected', c.text);
    sh.last = { kind: 'challenge', playerId: c.playerId, text: c.text, result: 'rejected', reason: 'rejected' };
  }
  sh.challenge = null;
}

function crownWinner(s: WordGauntletState, ctx: ModeContext): void {
  const sh = s.shiritori!;
  sh.turn = null;
  const alive = sh.alive.filter((id) => ctx.player(id));
  const winner = [...alive].sort((a, b) => (sh.wordsBy[b] ?? 0) - (sh.wordsBy[a] ?? 0) || ctx.player(b)!.score - ctx.player(a)!.score)[0];
  if (!winner) return;
  sh.winnerId = winner;
  const mine = ctx.player(winner)!.score;
  const best = Math.max(0, ...ctx.players().filter((p) => p.id !== winner).map((p) => p.score));
  sh.crown = Math.max(SHOWDOWN_BONUS, best - mine + SHOWDOWN_LEAD);
  giveBase(s, ctx, winner, sh.crown, sh.points);
  ctx.cue({ host: 'pon', event: 'ippon', slots: { name: name(ctx, winner) } });
}

// ---- views ----

function fakeView(s: WordGauntletState, phase: Phase, me: string | null): WordGauntletView['fake'] {
  const f = s.fake;
  if (!f) return null;
  const showOptions = phase === 'reveal' || phase === 'score';
  const showResults = phase === 'score';
  const myOption = me ? f.options.find((o) => o.authorIds.includes(me)) : undefined;
  return {
    index: s.fakeIndex,
    total: s.fakeDeck.length,
    word: { text: f.word.jp.text, kana: f.word.jp.kana, romaji: toRomaji(f.word.jp.kana) },
    submitted: f.options.flatMap((o) => o.authorIds),
    options: showOptions ? anonymousOrder(f.options).map((o) => ({ id: o.id, text: o.text })) : null,
    picked: Object.keys(f.picks),
    golden: showResults ? { jp: f.word.jp, literal: f.word.literal ?? null } : null,
    results: showResults ? f.results : null,
    points: showResults ? f.points : null,
    said: showResults ? Object.keys(f.said) : [],
    mine: me
      ? { fake: myOption?.text ?? null, optionId: myOption?.id ?? null, pick: f.picks[me] ?? null, said: f.said[me] ?? null }
      : null,
  };
}

function telephoneView(s: WordGauntletState, phase: Phase, me: string | null): WordGauntletView['telephone'] {
  const t = s.telephone;
  if (!t) return null;
  const revealed = phase === 'reveal' || phase === 'score';
  const myIndex = me ? t.steps.findIndex((st) => st.playerId === me) : -1;
  const myStep = myIndex >= 0 ? t.steps[myIndex]! : null;
  const myTurn = phase === 'answer' && myIndex === t.current && myStep?.text === null;
  let prev: TelPrev | null = null;
  if (myTurn) {
    const p = previousText(t, myIndex);
    prev = { text: p.text, reading: p.lang === 'jp' ? p.reading : null, romaji: p.lang === 'jp' && p.reading ? toRomaji(p.reading) : null, lang: p.lang };
  }
  let votes: number[] | null = null;
  if (phase === 'score') {
    votes = t.steps.map(() => 0);
    for (const i of Object.values(t.votes)) votes[i] = (votes[i] ?? 0) + 1;
  }
  return {
    order: t.steps.map((st, i) => ({ playerId: st.playerId, to: st.to, done: st.text !== null, skipped: st.skipped || (i < t.current && st.text === null) })),
    current: t.current,
    reveal: revealed
      ? { starter: t.starter.jp, steps: t.steps.map((st, i) => ({ index: i, playerId: st.playerId, to: st.to, text: st.text, reading: st.reading, skipped: st.text === null })) }
      : null,
    revealStepMs: TELEPHONE_REVEAL_STEP_MS,
    voted: revealed ? Object.keys(t.votes) : [],
    votes,
    points: phase === 'score' ? t.points : null,
    mine: me
      ? { step: myIndex >= 0 ? myIndex : null, prev, to: myStep?.to ?? null, sent: myStep?.text ?? null, vote: revealed ? (t.votes[me] ?? null) : null }
      : null,
  };
}

function shiritoriView(s: WordGauntletState, phase: Phase, me: string | null, _ctx: ModeContext): WordGauntletView['shiritori'] {
  const sh = s.shiritori;
  if (!sh) return null;
  const need = needKana(sh);
  const c = sh.challenge;
  return {
    chain: sh.chain,
    need,
    needOptions: startOptions(need),
    needRomaji: toRomaji(need),
    turn: phase === 'answer' ? sh.turn : null,
    turnBaseMs: sh.turnBaseMs,
    alive: sh.alive,
    out: sh.out,
    tokens: sh.tokens,
    bankMs: sh.bankMs,
    challenge: c && phase === 'reveal' ? { playerId: c.playerId, text: c.text, reading: c.reading, voters: c.voters, voted: Object.keys(c.votes), result: c.result } : null,
    last: sh.last,
    winnerId: sh.winnerId,
    crown: sh.crown,
    points: phase === 'score' ? sh.points : null,
    mine: me
      ? {
          hint: phase === 'answer' && sh.hint?.playerId === me ? sh.hint.words : null,
          tokens: sh.tokens[me] ?? 0,
          vote: c && phase === 'reveal' ? (c.votes[me] ?? null) : null,
        }
      : null,
  };
}
