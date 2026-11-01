// Word Gauntlet (v1.1): three escalating rounds hosted by Pon. See docs/modes/word-gauntlet.md.
//
//  1. Fake Kanji (Fibbage): a real but obscure word; everyone writes a fake meaning, then
//     everyone hunts for the real one. Points for finding it and for each player you fool.
//  2. Lost in Translation (telephone, double points): an N5 sentence passes around the room,
//     Japanese → English → Japanese …, each player seeing only the step before theirs.
//     The drift is revealed and everyone votes for their favourite step.
//  2b. The rumour round (うわさの でんごんゲーム, N4 and up): in a room with an N4 player, Nobiko-san takes
//     round 2. She whispers a rumour about a studio yōkai to one phone; it goes round the room, each
//     relay keeping who, where and what and adding one fin (うわさに おひれが つく), said in a reported-speech
//     frame. No player's voice leaves their phone: the next phone hears the words in Nobiko-san's voice.
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
import { toRomaji } from '../../japanese/romaji.js';
import { dictionaryNoun, endsInN, follows, lastKana, repeatKey, startOptions, wordReading } from './shiritori.js';
import { CHEEKY_WORDS, FALLBACK_STARTERS, OBSCURE_WORDS, SHIRITORI_NOUNS, fakeWordPool, type ObscureWord } from './words.js';
import { playerTextAllowed } from '../../moderation.js';
import { nameToKatakana } from '../../japanese/toKana.js';
import { toHiragana } from '../../japanese/kana.js';
import {
  finKept,
  keptParts,
  MAX_FINS,
  RUMOUR_FRAMES,
  rumourFin,
  rumourFins,
  rumourFrameOf,
  rumourLine,
  rumourOpener,
  rumourSeeds,
  type RumourFin,
  type RumourFrameId,
  type RumourSeed,
} from './rumours.js';

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

/** The rumour round: double points, like the telephone it stands in for. */
export const RUMOUR_RELAY_POINTS = 50;
export const RUMOUR_KEPT_POINTS = 50;
export const RUMOUR_FRAME_POINTS = 50;
export const RUMOUR_FINS_OFFERED = 3;
export const RUMOUR_REVEAL_STEP_MS = 6_500;
/** Nobiko-san starts reading a relay this long after it appears on the TV. */
export const RUMOUR_READ_LEAD_MS = 400;

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
  rumourPrompt: 9_000,
  rumourStep: { kana: 35_000, n5: 50_000, n4: 60_000 } as Record<Level, number>,
  rumourScore: 15_000,
  shiriScore: 14_000,
};

// ---- state ----

export type Segment = 'fake' | 'telephone' | 'rumour' | 'shiritori';
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

export interface RumourStep {
  playerId: string;
  level: Level;
  /** The frame an N4 relayer's first hint shows (each N4 relayer gets the next one along). */
  hintFrame: RumourFrameId | null;
  /** The fin cards this relayer was dealt. */
  offered: string[];
  /** The fin they added: a card's id, or their own words (N4). */
  fin: string | null;
  ownFin: string | null;
  /** What they passed on (null until sent). */
  text: string | null;
  reading: string | null;
  via: Via | null;
  frame: RumourFrameId | null;
  kept: { who: boolean; where: boolean; what: boolean } | null;
  /** Hints opened: N4 1 = the frame, 2 = Nobiko-san's line; N5 1 = Nobiko-san's line. */
  hint: number;
  /** Opened the words instead of only listening. */
  peeked: boolean;
  /** Picked a fin but sent nothing in time: Nobiko-san passed it on for them. */
  standIn: boolean;
  skipped: boolean;
}

export interface Rumour {
  seed: RumourSeed;
  /** The fins the rumour carries now, newest last (the newest MAX_FINS). */
  fins: RumourFin[];
  steps: RumourStep[];
  current: number;
  revealAt: number;
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
  rumour: Rumour | null;
  /** Seeds already told this game, so a replay hears a new one. */
  rumoursTold: string[];
  shiritori: Shiritori | null;
  /** One bonus pool per round: base points and bonus points awarded so far. */
  pool: { base: number; bonus: number };
  /** Every point this mode gave, per player (the room's scores should match). */
  earned: Record<string, number>;
  stats: { fooled: Record<string, number>; telVotes: Record<string, number>; rumourVotes: Record<string, number> };
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
  | { kind: 'judge'; accept: boolean }
  | { kind: 'fin'; fin?: string; own?: string }
  | { kind: 'peek' }
  | { kind: 'relay'; utterance?: Utterance };

export interface RumourHeard {
  text: string;
  kana: string;
  romaji: string | null;
  /** Nobiko-san's opener, not a player's relay. */
  opener: boolean;
}

// ---- view ----

export interface WordGauntletView {
  mode: 'word-gauntlet';
  segment: Segment | null;
  /** Gauntlet round 1–3 (0 at the intro). */
  round: number;
  /** Points per player from this mode so far (public, like the scoreboard). */
  earned: Record<string, number>;
  /** What round 2 will be with the room as it is: the rumour round needs an N4 player. */
  round2: 'telephone' | 'rumour';
  fake: {
    index: number;
    total: number;
    word: { text: string; kana: string; romaji: string; furigana?: JpText['furigana'] };
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
  rumour: {
    /** Who the rumour is about: public from the start (the TV shows them). */
    subject: { kana: string; en: string; sprite: string | null };
    order: { playerId: string; level: Level; done: boolean; skipped: boolean; standIn: boolean }[];
    current: number;
    /** The whole relay and the truth, from the reveal on. */
    reveal: {
      opener: JpText;
      steps: { index: number; playerId: string; text: string | null; kana: string | null; fin: { kana: string; en: string } | null; frame: { ja: string; en: string } | null; kept: RumourStep['kept']; standIn: boolean; skipped: boolean }[];
      final: JpText;
    } | null;
    /** The truth, at the score. */
    truth: JpText | null;
    revealStepMs: number;
    voted: string[];
    votes: number[] | null;
    points: Record<string, number> | null;
    mine: {
      step: number | null;
      level: Level;
      /** Only while it's this player's relay: what they heard. */
      heard: RumourHeard | null;
      fins: { id: string; kana: string; en: string; tile: string }[];
      fin: string | null;
      ownFin: string | null;
      hint: number;
      /** N4, from the first hint: the frame to try. */
      frame: { ja: string; en: string } | null;
      /** Nobiko-san's version: N4 from the second hint, N5 from the first; per fin card ('' = their own fin). */
      models: Record<string, JpText> | null;
      peeked: boolean;
      sent: string | null;
      /** At the score: how their relay did. */
      result: { kept: RumourStep['kept']; frame: { ja: string; en: string } | null; standIn: boolean } | null;
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
    for (const w of pack.words as PackWord[]) {
      // Oogiri swerves like うたう おにぎり are phrases, not words: never offer them as hints.
      const phrase = /\s/.test(w.jp.kana) || (!!w.swerve && w.jp.kana.includes('の'));
      add(w.jp.kana, w.jp.en, w.id, w.jp.text, 'pack', w.pos === 'noun' && !phrase);
    }
  }
  for (const n of SHIRITORI_NOUNS) add(n.kana, n.en, `wg.shiritori.${n.kana}`, n.kana, 'list', true);
  for (const w of [...OBSCURE_WORDS, ...CHEEKY_WORDS]) add(w.jp.kana, w.jp.en, `wg.golden.${w.id}`, w.jp.text, 'list', false);
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
    titleKana: 'ことばのかんもん',
    blurb: 'Fake meanings, a telephone of translations, then a spoken shiritori showdown.',
    host: 'pon',
    phaseLabels: { reveal: 'Vote' },
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
      fakeDeck: fakeWordPool(ctx.audience ?? 'family', () => ctx.random(), FAKE_WORDS_PER_GAME),
      fakeIndex: 0,
      fake: null,
      telephone: null,
      rumour: null,
      rumoursTold: [],
      shiritori: null,
      pool: { base: 0, bonus: 0 },
      earned: {},
      stats: { fooled: {}, telVotes: {}, rumourVotes: {} },
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
        if (s.segment === 'rumour') return nextRumourStep(s) >= 0 ? 'answer' : 'reveal';
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
    if (s.segment === 'rumour') return enterRumour(s, phase, ctx);
    if (s.segment === 'shiritori') return enterShiritori(s, phase, ctx);
  },

  leave(s, phase, ctx) {
    if (s.segment === 'telephone' && phase === 'answer') {
      const step = s.telephone?.steps[s.telephone.current];
      if (step && step.text === null) step.skipped = true;
    }
    if (s.segment === 'rumour' && phase === 'answer') closeRumourStep(s, ctx);
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
    if (s.segment === 'rumour') {
      const r = s.rumour!;
      if (phase === 'prompt') return DURATIONS.rumourPrompt;
      if (phase === 'answer') return DURATIONS.rumourStep[r.steps[r.current]?.level ?? 'n5'];
      if (phase === 'reveal') return 20_000 + RUMOUR_REVEAL_STEP_MS * (r.steps.length + 2);
      if (phase === 'score') return DURATIONS.rumourScore;
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
    if (s.segment === 'rumour' && s.rumour) {
      const r = s.rumour;
      if (phase === 'answer') {
        const step = r.steps[r.current];
        return !step || step.text !== null || !ctx.player(step.playerId)?.connected;
      }
      if (phase === 'reveal') {
        if (here.length === 0) return false;
        const voters = here.filter((p) => r.steps.some((st) => st.text !== null && st.playerId !== p.id));
        return voters.every((p) => r.votes[p.id] !== undefined) && ctx.now >= r.revealAt + RUMOUR_REVEAL_STEP_MS * (r.steps.length + 2);
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
        return s.segment === 'rumour' ? moveRumourVote(s, phase, playerId, raw.step) : moveVote(s, phase, playerId, raw.step);
      case 'word':
        return moveWord(s, phase, playerId, raw.utterance, ctx);
      case 'hint':
        return s.segment === 'rumour' ? moveRumourHint(s, phase, playerId) : moveHint(s, phase, playerId, ctx);
      case 'fin':
        return moveFin(s, phase, playerId, raw, ctx);
      case 'peek':
        return moveRumourPeek(s, phase, playerId);
      case 'relay':
        return moveRelay(s, phase, playerId, raw.utterance, ctx);
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
    if (s.rumour) delete s.rumour.votes[playerId];
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
      round2: ctx.players().length >= TELEPHONE_MIN_PLAYERS && rumourRoom(ctx) ? 'rumour' : 'telephone',
      fake: s.segment === 'fake' && phase !== 'intro' ? fakeView(s, phase, me) : null,
      telephone: s.segment === 'telephone' ? telephoneView(s, phase, me) : null,
      rumour: s.segment === 'rumour' ? rumourView(s, phase, me, ctx) : null,
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
    const finner = top(s.stats.rumourVotes);
    if (finner) out.push({ playerId: finner, name: name(ctx, finner), title: 'おひれ大賞', en: 'Biggest Fin (the room’s favourite rumour relay)' });
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
  if (s.segment === 'fake' && ctx.players().length >= TELEPHONE_MIN_PLAYERS && rumourRoom(ctx)) {
    startRumour(s, ctx);
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
    const prompt = { text: f.word.jp.text, kana: f.word.jp.kana, en: f.word.jp.en };
    const fooled = biggestFool(f, ctx);
    // Who fooled whom is the Fibbage laugh; those lines end on the same call to say the word.
    if (fooled) ctx.cue({ host: 'pon', event: 'fooled', prompt, slots: { author: name(ctx, fooled.author), fooled: name(ctx, fooled.victim) } });
    else ctx.cue({ host: 'pon', event: 'kakegoe_call', prompt });
  }
}

/** The fake that fooled the most players this word, and one player it fooled. */
function biggestFool(f: FakeRound, ctx: ModeContext): { author: string; victim: string } | null {
  let best: { author: string; victim: string; n: number } | null = null;
  for (const o of f.options) {
    if (o.real) continue;
    const victims = Object.entries(f.picks)
      .filter(([id, opt]) => opt === o.id && ctx.player(id))
      .map(([id]) => id);
    for (const author of o.authorIds.filter((id) => ctx.player(id))) {
      const fooled = victims.filter((v) => v !== author);
      if (fooled.length && (!best || fooled.length > best.n)) best = { author, victim: fooled[0]!, n: fooled.length };
    }
  }
  return best && { author: best.author, victim: best.victim };
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
  if (!playerTextAllowed(text, ctx.audience)) return moveError('kids-words');
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
  ctx.phrase(playerId, { itemId: `wg.golden.${f.word.id}`, text: f.word.jp.text, kana: f.word.jp.kana, en: f.word.jp.en, outcome: 'said', recall: 'read' });
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

// ---- The rumour round (うわさの でんごんゲーム) ----

/** The rumour round takes round 2 when anyone in the room plays at N4 (it's built on N4 frames). */
export function rumourRoom(ctx: ModeContext): boolean {
  return ctx.players().some((p) => p.level === 'n4');
}

function startRumour(s: WordGauntletState, ctx: ModeContext): void {
  s.segment = 'rumour';
  s.round = 2;
  s.pool = { base: 0, bonus: 0 };
  const audience = ctx.audience ?? 'family';
  const all = rumourSeeds(audience);
  const fresh = all.filter((x) => !s.rumoursTold.includes(x.id));
  // A Cheeky room hears a Cheeky rumour when one is left.
  const cheeky = fresh.filter((x) => x.audience === 'cheeky');
  const pool = audience === 'cheeky' && cheeky.length ? cheeky : fresh.length ? fresh : all;
  const seed = pool[Math.floor(ctx.random() * pool.length)]!;
  s.rumoursTold.push(seed.id);
  const seated = ctx.players();
  const startAt = Math.floor(ctx.random() * seated.length);
  const order = [...seated.slice(startAt), ...seated.slice(0, startAt)];
  const fins = shuffled(rumourFins(audience), () => ctx.random());
  let n4 = 0;
  let next = 0;
  const steps: RumourStep[] = order.map((p) => {
    // Each relayer gets their own fin cards; the deck wraps if the room is big.
    const offered: string[] = [];
    while (offered.length < Math.min(RUMOUR_FINS_OFFERED, fins.length)) {
      const f = fins[next++ % fins.length]!;
      if (!offered.includes(f.id)) offered.push(f.id);
    }
    const hintFrame = p.level === 'n4' ? RUMOUR_FRAMES[n4++ % RUMOUR_FRAMES.length]!.id : null;
    return { playerId: p.id, level: p.level, hintFrame, offered, fin: null, ownFin: null, text: null, reading: null, via: null, frame: null, kept: null, hint: 0, peeked: false, standIn: false, skipped: false };
  });
  s.rumour = { seed, fins: [], steps, current: -1, revealAt: 0, votes: {}, points: null };
  ctx.cue({ host: 'nobiko', event: 'rumour_intro' });
}

function nextRumourStep(s: WordGauntletState): number {
  const r = s.rumour;
  if (!r) return -1;
  const i = r.current + 1;
  return i < r.steps.length ? i : -1;
}

/** What the relayer at `index` hears: the last relay passed on before theirs, or Nobiko-san's opener. */
export function rumourHeard(r: Rumour, index: number): { text: string; kana: string; opener: boolean } {
  for (let i = index - 1; i >= 0; i--) {
    const step = r.steps[i]!;
    if (step.text !== null) return { text: step.text, kana: step.reading ?? step.text, opener: false };
  }
  const o = rumourOpener(r.seed);
  return { text: o.text, kana: o.kana, opener: true };
}

/** The fin a step added, as the rumour carries it. */
function stepFin(step: RumourStep, index: number): RumourFin | null {
  if (step.ownFin) return { id: `own-${index}`, kana: step.ownFin, en: `“${step.ownFin}”`, tile: step.ownFin, keys: [step.ownFin], kind: 'how' };
  return step.fin ? (rumourFin(step.fin) ?? null) : null;
}

/** The model line a step would say with a fin added (null: their own fin, or none yet). */
function modelFor(r: Rumour, step: RumourStep, fin: RumourFin | null): JpText {
  const fins = [...r.fins, ...(fin ? [fin] : [])].slice(-MAX_FINS);
  const frame = step.level === 'n4' ? (step.hintFrame ?? 'sou-hear') : step.level === 'n5' ? 'n5' : 'sou-hear';
  return rumourLine(r.seed, fins, frame);
}

function addFin(r: Rumour, step: RumourStep, index: number): void {
  const fin = stepFin(step, index);
  if (fin) r.fins = [...r.fins, fin].slice(-MAX_FINS);
}

function enterRumour(s: WordGauntletState, phase: Phase, ctx: ModeContext): void {
  const r = s.rumour!;
  if (phase === 'answer') {
    r.current = nextRumourStep(s);
    if (r.current < 0) r.current = r.steps.length;
  }
  if (phase === 'reveal') {
    r.current = r.steps.length;
    r.revealAt = ctx.now;
    const o = rumourOpener(r.seed);
    for (const p of ctx.players()) ctx.phrase(p.id, { itemId: `wg.rumour.${r.seed.id}`, text: o.text, kana: o.kana, en: o.en, outcome: 'seen' });
    // Nobiko-san reads the relay aloud, one step at a time, in time with the TV (VOICEVOX when the server has
    // it, else the TV's own voice). Players' words already passed the moderation filter (commercial-blockers row 36).
    ctx.cue({ host: 'nobiko', event: 'rumour_relay', slots: { quip: o.text, quip_kana: o.kana, quip_en: o.en }, atMs: RUMOUR_READ_LEAD_MS });
    r.steps.forEach((st, i) => {
      if (st.text === null) return;
      const kana = st.reading ?? st.text;
      ctx.cue({ host: 'nobiko', event: 'rumour_relay', slots: { quip: st.text, quip_kana: kana, quip_en: `${name(ctx, st.playerId)}'s relay` }, atMs: (i + 1) * RUMOUR_REVEAL_STEP_MS + RUMOUR_READ_LEAD_MS });
    });
  }
  if (phase === 'score') {
    scoreRumour(s, ctx);
    ctx.cue({ host: 'nobiko', event: 'rumour_line', slots: { quip: r.seed.truth.text, quip_kana: r.seed.truth.kana, quip_en: r.seed.truth.en } });
  }
}

/** The relay's turn ended: a relayer who picked a fin but sent nothing has Nobiko-san pass it on. */
function closeRumourStep(s: WordGauntletState, ctx: ModeContext): void {
  const r = s.rumour;
  const step = r?.steps[r.current];
  if (!r || !step || step.text !== null) return;
  if (step.fin || step.ownFin) {
    const line = modelFor(r, step, stepFin(step, r.current));
    step.text = line.text;
    step.reading = line.kana;
    step.standIn = true;
    step.kept = { who: true, where: true, what: true };
    addFin(r, step, r.current);
    return;
  }
  step.skipped = true;
  void ctx;
}

const myRumourStep = (s: WordGauntletState, phase: Phase, playerId: string): RumourStep | MoveResult => {
  if (s.segment !== 'rumour' || phase !== 'answer' || !s.rumour) return moveError('wrong-phase');
  const step = s.rumour.steps[s.rumour.current];
  if (!step || step.playerId !== playerId) return moveError('not-your-turn');
  if (step.text !== null) return moveError('already-answered');
  return step;
};
const isStep = (x: RumourStep | MoveResult): x is RumourStep => 'playerId' in x;

/**
 * Rumours are about the studio's yōkai, never about players: a relay that names one is refused. The name
 * counts as written (Aki), or in kana followed by さん, a particle or the end (so ダン in ダンスを doesn't count).
 */
function namesAPlayer(text: string, ctx: ModeContext): boolean {
  const t = toHiragana(text.normalize('NFKC'));
  const raw = text.toLowerCase();
  return ctx.players().some((p) => {
    const n = p.name.trim();
    if (n.length < 2) return false;
    if (/[a-z]/i.test(n) ? new RegExp(`(^|[^a-z])${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(raw) : raw.includes(n.toLowerCase())) return true;
    const kana = toHiragana(nameToKatakana(n).normalize('NFKC')).replace(/[\s\u3000]/g, '');
    if (kana.length < 2) return false;
    // A two-kana name (アキ) is also a word (あき, autumn): only with an honorific or on its own.
    const after = kana.length >= 3 ? '(さん|くん|ちゃん|さま|が|は|に|の|と|も|を|って|$|[^ぁ-ゖー])' : '(さん|くん|ちゃん|さま|$|[^ぁ-ゖー])';
    return new RegExp(`${kana}${after}`).test(t);
  });
}

function moveFin(s: WordGauntletState, phase: Phase, playerId: string, raw: Record<string, unknown>, ctx: ModeContext): MoveResult {
  const step = myRumourStep(s, phase, playerId);
  if (!isStep(step)) return step;
  if (typeof raw.own === 'string') {
    if (step.level !== 'n4') return moveError('bad-move');
    const own = cleanText(raw.own, 30);
    if (!own) return moveError('empty-answer');
    if (!hasJapanese(own)) return moveError('not-japanese');
    if (!playerTextAllowed(own, ctx.audience)) return moveError('kids-words');
    if (namesAPlayer(own, ctx)) return moveError('names-player');
    step.ownFin = own;
    step.fin = null;
    return MOVE_OK;
  }
  if (typeof raw.fin !== 'string' || !step.offered.includes(raw.fin)) return moveError('bad-move');
  step.fin = raw.fin;
  step.ownFin = null;
  return MOVE_OK;
}

function moveRumourHint(s: WordGauntletState, phase: Phase, playerId: string): MoveResult {
  const step = myRumourStep(s, phase, playerId);
  if (!isStep(step)) return step;
  const max = step.level === 'n4' ? 2 : step.level === 'n5' ? 1 : 0;
  if (step.hint >= max) return moveError('no-hint');
  step.hint += 1;
  return MOVE_OK;
}

function moveRumourPeek(s: WordGauntletState, phase: Phase, playerId: string): MoveResult {
  const step = myRumourStep(s, phase, playerId);
  if (!isStep(step)) return step;
  step.peeked = true;
  return MOVE_OK;
}

function moveRelay(s: WordGauntletState, phase: Phase, playerId: string, u: unknown, ctx: ModeContext): MoveResult {
  const step = myRumourStep(s, phase, playerId);
  if (!isStep(step)) return step;
  const r = s.rumour!;
  if (!step.fin && !step.ownFin) return moveError('pick-fin');
  const fin = stepFin(step, r.current);
  const model = modelFor(r, step, fin);
  const seenId = `wg.rumour.${r.seed.id}.${step.level}`;
  if (step.level === 'kana') {
    // Kana relayers add a fin by tile and say the tile; the rumour travels on in Nobiko-san's words.
    let via: Via | null = null;
    if (u !== undefined) {
      if (!isUtterance(u)) return moveError('bad-move');
      const text = cleanText(u.text, MAX_ANSWER_LENGTH);
      if (!text || !hasJapanese(text)) return moveError('not-japanese');
      via = u.via;
    }
    step.text = model.text;
    step.reading = model.kana;
    step.via = via;
    step.kept = { who: true, where: true, what: true };
    addFin(r, step, r.current);
    if (fin) ctx.phrase(playerId, { itemId: `wg.fin.${fin.id}`, text: fin.kana, kana: fin.kana, en: fin.en, outcome: via === 'speech' ? 'said' : 'seen', recall: 'read' });
    return MOVE_OK;
  }
  if (!isUtterance(u)) return moveError('bad-move');
  const text = cleanText(u.text, MAX_ANSWER_LENGTH);
  if (!text) return moveError('empty-answer');
  if (!hasJapanese(text)) return moveError('not-japanese');
  if (!playerTextAllowed(text, ctx.audience)) return moveError('kids-words');
  if (namesAPlayer(text, ctx)) return moveError('names-player');
  const reading = u.reading ?? (isKana(text) ? text : null);
  step.text = text;
  step.reading = reading;
  step.via = u.via;
  step.kept = keptParts(r.seed, reading ?? text);
  step.frame = rumourFrameOf({ text, reading: reading ?? undefined, tokens: u.tokens });
  addFin(r, step, r.current);
  const memory = !step.peeked && step.hint < (step.level === 'n4' ? 2 : 1);
  ctx.phrase(playerId, { itemId: seenId, text, kana: reading ?? text, en: model.en, outcome: u.via === 'speech' ? 'said' : 'seen', recall: memory ? 'memory' : 'read' });
  return MOVE_OK;
}

function moveRumourVote(s: WordGauntletState, phase: Phase, playerId: string, raw: unknown): MoveResult {
  if (s.segment !== 'rumour' || phase !== 'reveal' || !s.rumour) return moveError('wrong-phase');
  const r = s.rumour;
  if (r.votes[playerId] !== undefined) return moveError('already-voted');
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return moveError('bad-move');
  const step = r.steps[raw];
  if (!step || step.text === null) return moveError('unknown-answer');
  if (step.playerId === playerId) return moveError('own-answer');
  r.votes[playerId] = raw;
  return MOVE_OK;
}

const allKept = (k: RumourStep['kept']): boolean => !!k && k.who && k.where && k.what;

function scoreRumour(s: WordGauntletState, ctx: ModeContext): void {
  const r = s.rumour!;
  const points: Record<string, number> = {};
  const x = TELEPHONE_MULTIPLIER;
  for (const st of r.steps) {
    if (st.text === null || st.standIn || !ctx.player(st.playerId)) continue;
    giveBase(s, ctx, st.playerId, RUMOUR_RELAY_POINTS * x, points);
    if (st.level !== 'kana' && allKept(st.kept)) giveBase(s, ctx, st.playerId, RUMOUR_KEPT_POINTS * x, points);
    if (st.level === 'n4' && st.frame) giveBase(s, ctx, st.playerId, RUMOUR_FRAME_POINTS * x, points);
  }
  for (const [voter, index] of Object.entries(r.votes)) {
    const step = r.steps[index];
    if (!step || !ctx.player(voter)) continue;
    giveBase(s, ctx, step.playerId, POINTS_PER_TELEPHONE_VOTE * x, points);
    s.stats.rumourVotes[step.playerId] = (s.stats.rumourVotes[step.playerId] ?? 0) + 1;
  }
  const wants = r.steps
    .filter((st) => st.text !== null && !st.standIn && st.via && ctx.player(st.playerId))
    .map((st) => ({ id: st.playerId, want: (st.via === 'speech' ? TELEPHONE_SPOKEN_BONUS : TELEPHONE_TYPED_BONUS) * x }));
  const total = wants.reduce((n, w) => n + w.want, 0);
  const cap = Math.floor((s.pool.base * BONUS_SHARE) / (1 - BONUS_SHARE));
  const scale = total > cap ? cap / total : 1;
  for (const w of wants) giveBonus(s, ctx, w.id, Math.floor(w.want * scale), points);
  r.points = points;
}

const frameLabel = (id: RumourFrameId | null): { ja: string; en: string } | null => {
  const f = id ? RUMOUR_FRAMES.find((x) => x.id === id) : undefined;
  return f ? { ja: f.ja, en: f.en } : null;
};

function rumourView(s: WordGauntletState, phase: Phase, me: string | null, ctx: ModeContext): WordGauntletView['rumour'] {
  const r = s.rumour;
  if (!r) return null;
  const revealed = phase === 'reveal' || phase === 'score';
  const myIndex = me ? r.steps.findIndex((st) => st.playerId === me) : -1;
  const step = myIndex >= 0 ? r.steps[myIndex]! : null;
  const live = !!step && phase === 'answer' && myIndex === r.current && step.text === null;
  let mine: NonNullable<WordGauntletView['rumour']>['mine'] = null;
  if (me && step) {
    const heard = live ? rumourHeard(r, myIndex) : null;
    const showModels = live && ((step.level === 'n4' && step.hint >= 2) || (step.level === 'n5' && step.hint >= 1) || step.level === 'kana');
    const models: Record<string, JpText> | null = showModels
      ? Object.fromEntries([...step.offered.map((id) => [id, modelFor(r, step, rumourFin(id) ?? null)] as const), ['', modelFor(r, step, step.ownFin ? stepFin(step, myIndex) : null)] as const])
      : null;
    mine = {
      step: myIndex,
      level: step.level,
      heard: heard ? { ...heard, romaji: step.level === 'kana' ? toRomaji(heard.kana) : null } : null,
      fins: step.offered.map((id) => rumourFin(id)).filter((f): f is RumourFin => !!f).map((f) => ({ id: f.id, kana: f.kana, en: f.en, tile: f.tile })),
      fin: step.fin,
      ownFin: step.ownFin,
      hint: step.hint,
      frame: live && step.level === 'n4' && step.hint >= 1 ? frameLabel(step.hintFrame) : null,
      models,
      peeked: step.peeked,
      sent: step.text,
      result: phase === 'score' ? { kept: step.kept, frame: frameLabel(step.frame), standIn: step.standIn } : null,
      vote: r.votes[me] ?? null,
    };
  } else if (me) {
    mine = { step: null, level: ctx.player(me)?.level ?? 'n5', heard: null, fins: [], fin: null, ownFin: null, hint: 0, frame: null, models: null, peeked: false, sent: null, result: null, vote: r.votes[me] ?? null };
  }
  const votes = phase === 'score' ? r.steps.map((_, i) => Object.values(r.votes).filter((v) => v === i).length) : null;
  return {
    subject: { kana: r.seed.who.kana, en: r.seed.who.en, sprite: r.seed.who.sprite },
    order: r.steps.map((st) => ({ playerId: st.playerId, level: st.level, done: st.text !== null, skipped: st.skipped, standIn: st.standIn })),
    current: r.current,
    reveal: revealed
      ? {
          opener: rumourOpener(r.seed),
          steps: r.steps.map((st, i) => {
            const fin = stepFin(st, i);
            return { index: i, playerId: st.playerId, text: st.text, kana: st.reading, fin: fin ? { kana: fin.kana, en: fin.en } : null, frame: frameLabel(st.frame), kept: st.kept, standIn: st.standIn, skipped: st.skipped };
          }),
          final: rumourLine(r.seed, r.fins, 'sou-hear'),
        }
      : null,
    truth: phase === 'score' ? r.seed.truth : null,
    revealStepMs: RUMOUR_REVEAL_STEP_MS,
    voted: Object.keys(r.votes),
    votes,
    points: phase === 'score' ? r.points : null,
    mine,
  };
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
    ctx.phrase(id, { itemId: item.itemId, text: item.text, kana: item.kana, en: item.en, outcome: hinted ? 'seen' : 'said', recall: word.via === 'speech' ? 'memory' : 'read' });
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
    word: { text: f.word.jp.text, kana: f.word.jp.kana, romaji: toRomaji(f.word.jp.kana), furigana: f.word.jp.furigana },
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
