// Oekaki (お絵かき, backlog): Drawful-style drawing and fake titles in Japanese, hosted by Fude.
// See docs/modes/oekaki.md.
//
// Each round, every player privately gets a Japanese word or phrase from the night's pack and
// draws it on their phone. Then, drawing by drawing, the TV shows one; everyone but the artist
// writes a fake title in Japanese (typed, kana pad, said aloud, or word tiles); the real title
// is mixed in; everyone votes for the one they think is real. Points for finding the real title,
// for each player your fake fools, and for the artist when people find theirs. Then the room
// says the real title together (the say-it moment, a capped bonus) and it goes in everyone's
// phrasebook.
//
// Phases per round: prompt (draw) → per drawing: answer (fake titles) → reveal (vote) → score
// (results and say it together). A drawing the VIP hides skips straight to its score.

import type { Level } from '../../../../content/src/types.js';
import type { InkPoint } from '../../japanese/strokes.js';
import { isUtterance, matchesAccepted, utteranceReading, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type MoveResult } from '../mode.js';
import { toRomaji } from '../oogiri/romaji.js';
import { readDrawing } from './drawing.js';
import { buildTileFake, readUtteranceFake, sameFake, tooClose, type Fake, type FakeVia } from './fakes.js';
import { dealPrompt, dealTiles, decoyCandidates, markUsed, type Prompt, type Tile } from './prompts.js';

// ---- tuning ----

export const POINTS_REAL_FOUND = 100;
export const POINTS_PER_FOOLED = 50;
/** The artist, for each player who found their real title. */
export const POINTS_ARTIST_PER_FINDER = 50;
/** Sending a fake by voice (typed Japanese earns less; tiles earn nothing extra). */
export const FAKE_SPOKEN_BONUS = 20;
export const FAKE_TYPED_BONUS = 10;
/** Saying the real title with the room at the score beat (typed earns less). */
export const SAY_SPOKEN_BONUS = 30;
export const SAY_TYPED_BONUS = 10;
/** Speaking bonuses come from one pool: at most 30% of a drawing's points (design doc, Scoring). */
export const BONUS_SHARE = 0.3;
/** The last round is worth double when there is more than one. */
export const LAST_ROUND_MULTIPLIER = 2;
/** With fewer player fakes than this, Fude adds house decoys from the pack. */
export const MIN_FAKES = 2;

export const DURATIONS = {
  intro: 12_000,
  draw: 80_000,
  fakes: 50_000,
  fakesKanaExtra: 15_000,
  vote: 25_000,
  score: 16_000,
};

// ---- state ----

export type Via = Utterance['via'];

export interface Sketch {
  artistId: string;
  prompt: Prompt;
  strokes: InkPoint[][];
  colors: number[];
  hidden: boolean;
}

export interface Option {
  id: string;
  text: string;
  kana: string;
  en: string | null;
  /** Empty for the real title and house decoys. Two players who wrote the same fake share one. */
  authorIds: string[];
  real: boolean;
  /** One of Fude's decoys, added when too few fakes came in. */
  house: boolean;
  hidden: boolean;
}

export interface Turn {
  sketch: Sketch;
  options: Option[];
  /** How each author sent their fake (for the voice bonus). */
  via: Record<string, FakeVia>;
  /** Word tiles per writer, dealt when the drawing goes up. */
  tiles: Record<string, Tile[]>;
  picks: Record<string, string>;
  said: Record<string, Via>;
  scored: boolean;
  points: Record<string, number>;
  pool: { base: number; bonus: number };
}

export interface OekakiState {
  packId: string | null;
  rounds: number;
  round: number;
  /** This round's secret prompt per player. */
  prompts: Record<string, Prompt>;
  /** Prompt ids and readings dealt this game. */
  used: string[];
  /** This round's drawings as they came in, then in show order. */
  sketches: Sketch[];
  current: number;
  turn: Turn | null;
  earned: Record<string, number>;
  stats: { fooled: Record<string, number>; found: Record<string, number>; finders: Record<string, number> };
}

// ---- moves ----

export type OekakiMove =
  | { kind: 'draw'; strokes: InkPoint[][]; colors?: number[] }
  | { kind: 'fake'; utterance: Utterance }
  | { kind: 'fake'; tiles: number[] }
  | { kind: 'pick'; optionId: string }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'hide'; optionId: string }
  | { kind: 'hide'; drawing: true };

// ---- view ----

export interface TitleView {
  text: string;
  kana: string;
  en: string;
  /** Kana-level viewers only. */
  romaji: string | null;
}

export interface OptionView {
  id: string;
  /** The kana reading during the vote, the written title at the score; "[hidden]" once hidden. */
  text: string;
  kana: string;
  hidden: boolean;
}

export interface ResultView extends OptionView {
  en: string | null;
  real: boolean;
  house: boolean;
  authors: { id: string; name: string }[];
  pickedBy: { id: string; name: string }[];
}

export interface OekakiView {
  mode: 'oekaki';
  round: number;
  totalRounds: number;
  /** 1-based drawing number within the round (0 while drawing). */
  index: number;
  count: number;
  /** Points per player from this mode so far (public, like the scoreboard). */
  earned: Record<string, number>;
  /** Anyone at the table plays at Kana level (the stage shows romaji). */
  kanaAtTable: boolean;
  /** Who has sent a drawing (draw phase). */
  drawn: string[];
  /** The drawing on show. Stage only, and only while it's up, to keep phone views small. */
  drawing: { strokes: InkPoint[][]; colors: number[] } | null;
  hiddenDrawing: boolean;
  /** Who has written a fake so far (never what). */
  submitted: string[];
  /** Anonymous options from the vote on. */
  options: OptionView[] | null;
  picked: string[];
  /** At the score beat: the real title, who drew it, who wrote and picked what. */
  result: {
    real: TitleView;
    artistId: string;
    options: ResultView[];
    points: Record<string, number>;
    said: string[];
    double: boolean;
  } | null;
  mine: {
    /** This round's secret prompt, while drawing (and while your own drawing is up). */
    prompt: TitleView | null;
    drawn: boolean;
    isArtist: boolean;
    fake: string | null;
    optionId: string | null;
    tiles: (Tile & { romaji: string | null })[] | null;
    pick: string | null;
    said: Via | null;
  } | null;
}

// ---- helpers ----

const nameOf = (ctx: ModeContext, id: string): string => ctx.player(id)?.name ?? '(left)';

function give(s: OekakiState, ctx: ModeContext, playerId: string, points: number): number {
  const t = s.turn!;
  if (points <= 0 || !ctx.player(playerId)) return 0;
  ctx.award(playerId, points);
  s.earned[playerId] = (s.earned[playerId] ?? 0) + points;
  t.points[playerId] = (t.points[playerId] ?? 0) + points;
  return points;
}

function giveBase(s: OekakiState, ctx: ModeContext, playerId: string, points: number): void {
  if (!ctx.player(playerId)) return;
  s.turn!.pool.base += points;
  give(s, ctx, playerId, points);
}

/** What is left of this drawing's 30% speaking pool. */
function bonusRoom(t: Turn): number {
  return Math.max(0, Math.floor((t.pool.base * BONUS_SHARE) / (1 - BONUS_SHARE)) - t.pool.bonus);
}

function giveBonus(s: OekakiState, ctx: ModeContext, playerId: string, want: number): number {
  const t = s.turn!;
  if (!ctx.player(playerId)) return 0;
  const points = Math.max(0, Math.min(want, bonusRoom(t)));
  t.pool.bonus += points;
  return give(s, ctx, playerId, points);
}

/** Option ids are random, so sorting by id says nothing about who wrote what (or which is real). */
function anonymousOrder<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const multiplier = (s: OekakiState) => (s.rounds > 1 && s.round === s.rounds ? LAST_ROUND_MULTIPLIER : 1);

const isWriter = (s: OekakiState, id: string) => !!s.turn && s.turn.sketch.artistId !== id;

const title = (p: { text: string; kana: string; en: string }, level: Level | null): TitleView => ({
  text: p.text,
  kana: p.kana,
  en: p.en,
  romaji: level === 'kana' ? toRomaji(p.kana) : null,
});

// ---- the mode ----

export const oekakiMode: Mode<OekakiState, OekakiView> = {
  info: {
    id: 'oekaki',
    title: 'Oekaki',
    titleJa: 'お絵かき',
    blurb: 'Draw a secret Japanese word, write fake titles for the others’ drawings, then find the real one.',
    host: 'fude',
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [1, 2],
    usesPack: true,
    phrasebookTitle: 'Sketchbook',
    phaseLabels: { prompt: 'Draw!', answer: 'Fake titles', reveal: 'Find the real one', score: 'Say it together' },
  },

  setup(ctx, opts) {
    const packId = opts.packId && ctx.content.packs.some((p) => p.id === opts.packId) ? opts.packId : (ctx.content.packs[0]?.id ?? null);
    return {
      packId,
      rounds: Math.max(1, Math.min(2, opts.rounds ?? 1)),
      round: 0,
      prompts: {},
      used: [],
      sketches: [],
      current: -1,
      turn: null,
      earned: {},
      stats: { fooled: {}, found: {}, finders: {} },
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return s.sketches.length ? 'answer' : s.round < s.rounds ? 'prompt' : 'recap';
      case 'answer':
        return s.turn?.sketch.hidden ? 'score' : 'reveal';
      case 'reveal':
        return 'score';
      case 'score':
        if (s.current + 1 < s.sketches.length) return 'answer';
        return s.round < s.rounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    switch (phase) {
      case 'prompt':
        return enterDraw(s, ctx);
      case 'answer':
        return enterFakes(s, ctx);
      case 'reveal':
        return enterVote(s, ctx);
      case 'score':
        return enterScore(s, ctx);
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'prompt') {
      // Show order: shuffled, so the TV never gives away whose drawing is whose by seat.
      s.sketches = shuffled(s.sketches, () => ctx.random());
      s.current = -1;
    }
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.draw;
      case 'answer': {
        const kana = ctx.players().some((p) => p.level === 'kana' && isWriter(s, p.id));
        return DURATIONS.fakes + (kana ? DURATIONS.fakesKanaExtra : 0);
      }
      case 'reveal':
        return DURATIONS.vote;
      case 'score':
        return DURATIONS.score;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (!here.length) return false;
    if (phase === 'prompt') return here.every((p) => s.sketches.some((k) => k.artistId === p.id));
    const t = s.turn;
    if (!t) return false;
    if (phase === 'answer' || phase === 'reveal') {
      if (t.sketch.hidden) return true;
      const writers = here.filter((p) => isWriter(s, p.id));
      if (phase === 'answer') return writers.every((p) => t.options.some((o) => o.authorIds.includes(p.id)));
      return writers.every((p) => t.picks[p.id] !== undefined || !canPick(t, p.id));
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw) || typeof raw.kind !== 'string') return moveError('bad-move');
    switch (raw.kind) {
      case 'draw':
        return moveDraw(s, phase, playerId, raw);
      case 'fake':
        return moveFake(s, phase, playerId, raw, ctx);
      case 'pick':
        return movePick(s, phase, playerId, raw.optionId);
      case 'say':
        return moveSay(s, phase, playerId, raw.utterance, ctx);
      case 'hide':
        return moveHide(s, phase, playerId, raw, ctx);
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    // Their drawing stays in the show (it's still funny) but earns nothing; their fake stays
    // on the board (someone may have picked it) but earns nothing either.
    if (s.turn) delete s.turn.picks[playerId];
  },

  progress(s) {
    return { round: s.round, totalRounds: s.rounds };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const me = viewer.kind === 'player' ? viewer.playerId : null;
    const level = me ? (ctx.player(me)?.level ?? null) : null;
    const t = phase === 'answer' || phase === 'reveal' || phase === 'score' ? s.turn : null;
    const showOptions = !!t && (phase === 'reveal' || phase === 'score');
    const myOption = me && t ? t.options.find((o) => o.authorIds.includes(me)) : undefined;
    const isArtist = !!me && !!t && t.sketch.artistId === me;
    const myPrompt = me ? s.prompts[me] : undefined;
    return {
      mode: 'oekaki',
      round: s.round,
      totalRounds: s.rounds,
      index: t ? s.current + 1 : 0,
      count: s.sketches.length,
      earned: s.earned,
      kanaAtTable: ctx.players().some((p) => p.level === 'kana'),
      drawn: phase === 'prompt' ? s.sketches.map((k) => k.artistId) : [],
      drawing: t && viewer.kind === 'stage' && !t.sketch.hidden ? { strokes: t.sketch.strokes, colors: t.sketch.colors } : null,
      hiddenDrawing: !!t?.sketch.hidden,
      submitted: t && phase === 'answer' ? t.options.flatMap((o) => o.authorIds) : [],
      // During the vote every title is shown by its kana reading: the real title's kanji
      // (古い カレー) would otherwise give it away next to fakes typed in kana.
      options: showOptions ? anonymousOrder(t!.options).map((o) => optionView(o, phase === 'reveal')) : null,
      picked: t && phase === 'reveal' ? Object.keys(t.picks) : [],
      result: t && phase === 'score' ? resultView(s, t, ctx, level) : null,
      mine: me
        ? {
            prompt: myPrompt && (phase === 'prompt' || isArtist) ? title(myPrompt, level) : null,
            drawn: s.sketches.some((k) => k.artistId === me),
            isArtist,
            fake: myOption?.text ?? null,
            optionId: myOption?.id ?? null,
            tiles: t && phase === 'answer' && t.tiles[me] ? t.tiles[me]!.map((tile) => ({ ...tile, romaji: level === 'kana' ? toRomaji(tile.kana) : null })) : null,
            pick: t ? (t.picks[me] ?? null) : null,
            said: t && phase === 'score' ? (t.said[me] ?? null) : null,
          }
        : null,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const top = (rec: Record<string, number>) =>
      Object.entries(rec)
        .filter(([id, n]) => n > 0 && ctx.player(id))
        .sort((a, b) => b[1] - a[1] || ctx.player(a[0])!.seat - ctx.player(b[0])!.seat)[0]?.[0];
    const artist = top(s.stats.finders);
    if (artist) out.push({ playerId: artist, name: nameOf(ctx, artist), title: 'がはく', en: 'Master Painter (most people read your drawings)' });
    const fibber = top(s.stats.fooled);
    if (fibber) out.push({ playerId: fibber, name: nameOf(ctx, fibber), title: 'うそつき名人', en: 'Master Fibber (fooled the most players)' });
    const detective = top(s.stats.found);
    if (detective) out.push({ playerId: detective, name: nameOf(ctx, detective), title: 'めいたんてい', en: 'Great Detective (found the most real titles)' });
    return out;
  },
};

// ---- phases ----

function enterDraw(s: OekakiState, ctx: ModeContext): void {
  s.round += 1;
  s.sketches = [];
  s.current = -1;
  s.turn = null;
  s.prompts = {};
  const used = new Set(s.used);
  for (const p of ctx.players()) {
    const prompt = dealPrompt(ctx.content, s.packId, p.level, used, () => ctx.random());
    markUsed(used, prompt);
    s.prompts[p.id] = prompt;
  }
  s.used = [...used];
}

function enterFakes(s: OekakiState, ctx: ModeContext): void {
  s.current += 1;
  const sketch = s.sketches[s.current]!;
  const tiles: Record<string, Tile[]> = {};
  for (const p of ctx.players()) {
    if (p.id !== sketch.artistId) tiles[p.id] = dealTiles(ctx.content, s.packId, sketch.prompt, () => ctx.random());
  }
  s.turn = { sketch, options: [], via: {}, tiles, picks: {}, said: {}, scored: false, points: {}, pool: { base: 0, bonus: 0 } };
}

function enterVote(s: OekakiState, ctx: ModeContext): void {
  const t = s.turn!;
  const real = t.sketch.prompt;
  // Too few fakes (a quiet table, or phones away): Fude slips in decoys from the pack.
  let fakes = t.options.length;
  for (const d of decoyCandidates(ctx.content, s.packId, () => ctx.random())) {
    if (fakes >= MIN_FAKES) break;
    if (tooClose(d, real) || tooClose(real, d) || t.options.some((o) => sameFake(o, d))) continue;
    t.options.push({ id: ctx.newId(), text: d.text, kana: d.kana, en: d.en, authorIds: [], real: false, house: true, hidden: false });
    fakes += 1;
  }
  t.options.push({ id: ctx.newId(), text: real.text, kana: real.kana, en: real.en, authorIds: [], real: true, house: false, hidden: false });
}

function enterScore(s: OekakiState, ctx: ModeContext): void {
  const t = s.turn!;
  const real = t.sketch.prompt;
  scoreTurn(s, ctx);
  for (const p of ctx.players()) ctx.phrase(p.id, { itemId: real.id, text: real.text, kana: real.kana, en: real.en, outcome: 'seen' });
  // Fude's written bank is Raid-themed, so the only cue is the generic call-and-response
  // ("みんなで！ せーの！"); the LLM host gets the real title to call out.
  ctx.cue({ host: 'fude', event: 'kakegoe_call', prompt: { text: real.text, kana: real.kana, en: real.en } });
}

function scoreTurn(s: OekakiState, ctx: ModeContext): void {
  const t = s.turn!;
  if (t.scored) return;
  t.scored = true;
  if (t.sketch.hidden) return;
  const k = multiplier(s);
  const artist = t.sketch.artistId;
  for (const [voter, optionId] of Object.entries(t.picks)) {
    if (!ctx.player(voter)) continue;
    const option = t.options.find((o) => o.id === optionId);
    if (!option) continue;
    if (option.real) {
      giveBase(s, ctx, voter, POINTS_REAL_FOUND * k);
      giveBase(s, ctx, artist, POINTS_ARTIST_PER_FINDER * k);
      s.stats.found[voter] = (s.stats.found[voter] ?? 0) + 1;
      s.stats.finders[artist] = (s.stats.finders[artist] ?? 0) + 1;
    } else {
      for (const author of option.authorIds) {
        if (author === voter) continue;
        giveBase(s, ctx, author, POINTS_PER_FOOLED * k);
        s.stats.fooled[author] = (s.stats.fooled[author] ?? 0) + 1;
      }
    }
  }
  // Voice bonus for the fakes, scaled down together if the pool can't cover them all.
  const wants = Object.entries(t.via)
    .filter(([id, via]) => ctx.player(id) && (via === 'speech' || via === 'typed'))
    .map(([id, via]) => ({ id, want: via === 'speech' ? FAKE_SPOKEN_BONUS : FAKE_TYPED_BONUS }));
  const total = wants.reduce((n, w) => n + w.want, 0);
  const room = bonusRoom(t);
  const scale = total > room ? room / total : 1;
  for (const w of wants) giveBonus(s, ctx, w.id, Math.floor(w.want * scale));
}

// ---- moves ----

function moveDraw(s: OekakiState, phase: Phase, playerId: string, raw: Record<string, unknown>): MoveResult {
  if (phase !== 'prompt') return moveError('wrong-phase');
  const prompt = s.prompts[playerId];
  if (!prompt) return moveError('not-playing');
  if (s.sketches.some((k) => k.artistId === playerId)) return moveError('already-answered');
  const drawing = readDrawing(raw);
  if (!drawing) return moveError('bad-drawing');
  s.sketches.push({ artistId: playerId, prompt, strokes: drawing.strokes, colors: drawing.colors, hidden: false });
  return MOVE_OK;
}

function moveFake(s: OekakiState, phase: Phase, playerId: string, raw: Record<string, unknown>, ctx: ModeContext): MoveResult {
  const t = s.turn;
  if (phase !== 'answer' || !t) return moveError('wrong-phase');
  if (t.sketch.artistId === playerId) return moveError('your-drawing');
  if (t.sketch.hidden) return moveError('hidden');
  if (t.options.some((o) => o.authorIds.includes(playerId))) return moveError('already-answered');
  let read;
  if (raw.tiles !== undefined) {
    const hand = t.tiles[playerId];
    if (!hand) return moveError('not-playing');
    read = buildTileFake(raw.tiles, hand, ctx.player(playerId)?.level === 'kana');
  } else read = readUtteranceFake(raw.utterance);
  if (!read.ok) return moveError(read.error);
  const fake: Fake = read.fake;
  if (tooClose(fake, t.sketch.prompt)) return moveError('too-close');
  const same = t.options.find((o) => sameFake(o, fake));
  if (same) same.authorIds.push(playerId);
  else t.options.push({ id: ctx.newId(), text: fake.text, kana: fake.kana, en: fake.en, authorIds: [playerId], real: false, house: false, hidden: false });
  t.via[playerId] = fake.via;
  return MOVE_OK;
}

/** Can this player vote on anything (not their own fake, not hidden)? */
function canPick(t: Turn, playerId: string): boolean {
  return t.options.some((o) => !o.hidden && !o.authorIds.includes(playerId));
}

function movePick(s: OekakiState, phase: Phase, playerId: string, optionId: unknown): MoveResult {
  const t = s.turn;
  if (phase !== 'reveal' || !t) return moveError('wrong-phase');
  if (t.sketch.artistId === playerId) return moveError('your-drawing');
  if (t.picks[playerId]) return moveError('already-voted');
  const option = t.options.find((o) => o.id === optionId);
  if (!option) return moveError('unknown-answer');
  if (option.authorIds.includes(playerId)) return moveError('own-answer');
  if (option.hidden) return moveError('hidden');
  t.picks[playerId] = option.id;
  return MOVE_OK;
}

/** At the score beat everyone may say the real title aloud with the room (typed earns less). */
function moveSay(s: OekakiState, phase: Phase, playerId: string, u: unknown, ctx: ModeContext): MoveResult {
  const t = s.turn;
  if (phase !== 'score' || !t) return moveError('wrong-phase');
  if (!isUtterance(u)) return moveError('bad-move');
  if (t.said[playerId]) return moveError('already-answered');
  const real = t.sketch.prompt;
  if (!matchesAccepted(utteranceReading(u), [real.kana])) return moveError('not-the-word');
  t.said[playerId] = u.via;
  giveBonus(s, ctx, playerId, u.via === 'speech' ? SAY_SPOKEN_BONUS : SAY_TYPED_BONUS);
  ctx.phrase(playerId, { itemId: real.id, text: real.text, kana: real.kana, en: real.en, outcome: 'said' });
  return MOVE_OK;
}

/** The VIP's one-tap moderation: hide the drawing on show, or one title. */
function moveHide(s: OekakiState, phase: Phase, playerId: string, raw: Record<string, unknown>, ctx: ModeContext): MoveResult {
  const t = s.turn;
  if (!t || (phase !== 'answer' && phase !== 'reveal' && phase !== 'score')) return moveError('wrong-phase');
  if (ctx.vipId !== playerId) return moveError('not-vip');
  if (raw.drawing === true) {
    if (t.sketch.hidden) return MOVE_OK;
    t.sketch.hidden = true;
    // A hidden drawing scores nothing: the votes so far no longer count.
    if (!t.scored) t.picks = {};
    return MOVE_OK;
  }
  if (phase === 'answer') return moveError('wrong-phase');
  const option = t.options.find((o) => o.id === raw.optionId);
  if (!option) return moveError('unknown-answer');
  if (option.hidden) return MOVE_OK;
  option.hidden = true;
  // Hidden titles get no votes; anyone who picked it may pick again.
  if (phase === 'reveal') for (const [voter, id] of Object.entries(t.picks)) if (id === option.id) delete t.picks[voter];
  return MOVE_OK;
}

// ---- views ----

function optionView(o: Option, kanaOnly = false): OptionView {
  if (o.hidden) return { id: o.id, text: '[hidden]', kana: '', hidden: true };
  return { id: o.id, text: kanaOnly ? o.kana : o.text, kana: o.kana, hidden: false };
}

function resultView(s: OekakiState, t: Turn, ctx: ModeContext, level: Level | null): OekakiView['result'] {
  const real = t.sketch.prompt;
  const people = (ids: string[]) => ids.map((id) => ({ id, name: nameOf(ctx, id) }));
  return {
    real: title(real, level),
    artistId: t.sketch.artistId,
    options: anonymousOrder(t.options).map((o) => ({
      ...optionView(o),
      en: o.hidden ? null : o.en,
      real: o.real,
      house: o.house,
      authors: people(o.authorIds),
      pickedBy: people(Object.keys(t.picks).filter((id) => t.picks[id] === o.id)),
    })),
    points: t.points,
    said: Object.keys(t.said),
    double: multiplier(s) > 1,
  };
}
