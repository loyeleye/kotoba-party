// Kotoba Concentration (v1.1): turn-based memory where each pair is two forms of one word.
// Flip two cards on your phone; a match is yours only if you say the word in time, and
// anyone else can steal it by saying it right. Cleared cards uncover a hidden picture that
// players can buzz in to guess. See docs/modes/concentration.md.
//
// Phases, one turn at a time:
//   answer  the turn: the player flips two cards (turn timer)
//   prompt  a match: both cards stay up for a moment (everyone sees the word)
//   reveal  say-it window: the word card turns away; the flipper says it from memory
//   encore  steal window: anyone else may say it, first correct wins
//   score   the result of the turn (or a mismatch, shown before the cards flip back)
//   finale  the board is clear (or time is up): the whole picture and the winners
//
// In a Green Car room (ctx.greenCar) it plays as Frame Concentration: each pair is a situation (picture +
// English gist) and the frame chunk that says it, and you keep it by saying the whole sentence in your own
// words. Everyone else may say their own sentence at the same time (the chorus). Outside the Green Car nothing
// here changes. See greenBoard.ts, frameDeck.ts and docs/modes/concentration.md, "Green Car".

import type { JpText } from '../../../../content/src/types.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { isUtterance, matchesAccepted, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { buildBoard, planBoard, type Card, type Face, type Pair, type SpecialKind } from './board.js';
import { toRomaji } from '../../japanese/romaji.js';
import { SCENES } from './scenes.js';
import { buildGreenBoard, checkFrameSay, compact, GIST_BY_ID, planGreenBoard, tilesFor } from './greenBoard.js';
import { FRAME_BY_ID, type FrameId } from '../../japanese/frames.js';
import { playerTextAllowed } from '../../moderation.js';
import { aimWeight } from '../aim.js';

// ---- tuning ----

export const PAIR_POINTS = 100;
/**
 * Extra for saying the word aloud rather than typing it. 40 of a spoken pair's 140 is 29%,
 * so the speaking bonus never passes the design doc's 30% pool cap.
 */
export const SPOKEN_BONUS = 40;
export const GUESS_MIN = 60;
export const GUESS_MAX = 240;
/** Tries each player gets at saying one pair (the flipper in the claim, others in the steal). */
export const SAY_ATTEMPTS = 2;
/** Pairs nobody says go back face down once; on the second miss they clear with no owner. */
export const MAX_MISSES = 2;
/** Guessing the picture opens once this many tiles are uncovered. */
export const GUESS_OPENS_AT = 2;
/** The game ends after this long even if the board isn't clear. */
export const GAME_CAP_MS = 12 * 60_000;

export const DURATIONS = {
  intro: 9_000,
  turn: 20_000,
  turnKana: 25_000,
  peek: 1_800,
  /** "Say it within 5 seconds", plus a second for the recogniser to hand back. */
  claim: 6_000,
  steal: 5_000,
  result: 3_000,
  mismatch: 2_200,
  finale: 10_000,
} as const;

/** Frame Concentration (Green Car) timings: two cards to read on a miss, and a sentence takes longer than a word. */
export const GREEN_DURATIONS = {
  ...DURATIONS,
  intro: 12_000,
  mismatch: 3_000,
  /** n3Points.ts: a speakable N3 point is a short line said in a 9–12 s turn. */
  claim: 10_000,
  steal: 8_000,
  result: 4_000,
} as const;

/** Frame Concentration scoring (on top of PAIR_POINTS and SPOKEN_BONUS). */
export const GREEN_POINTS = {
  /** A hard pair (picture only) kept or stolen. */
  hard: 130,
  /** An N3 frame said by an N4 seat (stretch), unless it was built from tiles. */
  stretch: 20,
  /** Saying your own right sentence in the chorus while the flipper says theirs. */
  chorus: 30,
  /** A pair kept with the tile tray: flat, no spoken bonus. */
  tiles: 100,
} as const;

// ---- state ----

export interface Turn {
  playerId: string | null;
  /** Cells of the pair cards flipped this turn (specials don't count). */
  flips: number[];
  outcome: 'match' | 'mismatch' | null;
  /** Specials flipped this turn. */
  specials: number;
  /** This is a bonus-tile extra turn. */
  extra: boolean;
}

export interface Claim {
  pairId: string;
  cells: [number, number];
  claimerId: string;
  /** playerId → tries used */
  attempts: Record<string, number>;
  /** playerId → their last try */
  last: Record<string, LastTry>;
  winnerId: string | null;
  winnerVia: Utterance['via'] | null;
  /** Green Car only: the chorus (everyone else's own sentence in the say-it window). */
  chorus?: { attempts: Record<string, number>; last: Record<string, LastTry>; right: string[] };
  /** Green Car only: every try so far, by whom (a steal that copies someone else's words logs `read`). */
  heardBy?: { by: string; key: string }[];
  /** Green Car only: the tile tray for this pair. */
  tiles?: string[];
}

export interface LastTry {
  ok: boolean;
  heard: string;
  /** Green Car, a miss: what the check found (the frame, the key word). */
  tip?: { frame: boolean; anchor: boolean };
}

/** Green Car: one sentence a player said this game. */
export interface GreenLine {
  gistId: string;
  heard: string;
  ok: boolean;
  /** Counted from memory (spoken, own words); false for typed, tiles or a copied steal. */
  memory: boolean;
  how: 'claim' | 'steal' | 'chorus';
  model: JpText;
}

export interface GreenState {
  audience: Audience;
  /** playerId → frame → right says this game ("aim the deal" reads these; mode state can't see earlier games). */
  said: Record<string, Record<string, number>>;
  lines: Record<string, GreenLine[]>;
}

export interface TurnResult {
  kind: 'claimed' | 'stolen' | 'missed' | 'cleared' | 'mismatch';
  playerId: string | null;
  word: JpText | null;
  points: number;
  spoken: boolean;
}

export interface Flash {
  seq: number;
  kind: SpecialKind | 'claimed' | 'stolen' | 'missed' | 'guess-right' | 'guess-wrong';
  playerId: string | null;
  row?: number;
}

export interface Tally {
  pairs: number;
  steals: number;
  points: number;
  spoken: number;
}

export interface SceneState {
  id: string;
  name: JpText;
  /** One clue per cell. */
  tiles: string[];
  options: { id: string; text: string; kana: string; en: string }[];
}

export interface ConcentrationState {
  cols: number;
  rows: number;
  cards: Card[];
  pairs: Pair[];
  fallback: boolean;
  startedAt: number;
  endsAt: number;
  maxTurns: number;
  turnNo: number;
  turn: Turn | null;
  lastSeat: number;
  extraTurnFor: string | null;
  fogRow: number | null;
  pendingFog: number | null;
  claim: Claim | null;
  result: TurnResult | null;
  /** Cells to turn face down when the result has been seen. */
  pendingFlipDown: number[];
  scene: SceneState;
  solvedBy: string | null;
  guesses: Record<string, { optionId: string; ok: boolean }>;
  tally: Record<string, Tally>;
  shuffleSeq: number;
  flash: Flash | null;
  finished: boolean;
  /** Set when the game rides in the Green Car (Frame Concentration). */
  green?: GreenState;
}

export type ConcentrationMove =
  | { kind: 'flip'; cell: number }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'guess'; optionId: string };

// ---- view ----

export interface CellView {
  state: 'down' | 'up' | 'cleared';
  /** The face, while the card is up (and not turned away during a say-it window). */
  face?: Face;
  /** Opaque pair id while the card is up, so a face-up pair can be recognised. */
  pair?: string;
  /** The word card of the pair being said: up, but turned away. */
  masked?: boolean;
  /** For a cleared pair: who owns it (null: nobody said it). */
  owner?: string | null;
  /** For a cleared special tile. */
  special?: SpecialKind;
}

export interface ConcentrationView {
  mode: 'concentration';
  cols: number;
  rows: number;
  cells: CellView[];
  /** A fogged row nobody can pick this turn. */
  fogRow: number | null;
  turn: { no: number; playerId: string | null; flips: number; specials: number; extra: boolean } | null;
  claim: {
    claimerId: string;
    cue: Face;
    /** 'claim' while the flipper says it, 'steal' while the others may. */
    stage: 'peek' | 'claim' | 'steal' | 'done';
    winnerId: string | null;
    /** Who has used tries (ids only). */
    tried: string[];
    /** The word, once it may be shown (peek and after; Green Car: the model, only once the result is up). */
    word: JpText | null;
    /** Green Car: who said a right sentence in the chorus (ids only). */
    chorus?: string[];
  } | null;
  result: TurnResult | null;
  picture: {
    /** One per cell: the clue under it once uncovered, else null. */
    tiles: (string | null)[];
    uncovered: number;
    options: { id: string; text: string; kana: string; en: string }[];
    guessed: { playerId: string; ok: boolean }[];
    solvedBy: string | null;
    /** The answer, once solved or the game is over. */
    answer: JpText | null;
    open: boolean;
    /** Points a right guess earns right now. */
    worth: number;
  };
  tally: ({ playerId: string } & Tally)[];
  pairsLeft: number;
  totalPairs: number;
  endsAt: number;
  shuffleSeq: number;
  flash: Flash | null;
  fallback: boolean;
  /** Green Car only: this is Frame Concentration. */
  green?: true;
  mine: {
    isTurn: boolean;
    canFlip: boolean;
    canSay: boolean;
    attemptsLeft: number;
    last: LastTry | null;
    /** Kana-level training wheels in your own say-it window. */
    hint: { kana: string; romaji: string } | null;
    guess: { optionId: string; ok: boolean } | null;
    /** Green Car only. */
    green?: {
      /** Your say now is the chorus (your own sentence while the flipper says theirs). */
      chorus: boolean;
      /** An N3 frame and you play at N4: the tiles open by default, +20 if you say it. */
      stretch: boolean;
      /** The tile tray while you can say it (model words plus two others). */
      tiles: string[] | null;
      /** For the miss tip: the frame chunk and the key word. */
      frameJa: string | null;
      anchorEn: string | null;
      /** At the finale: your sentences this game, and which counted. */
      lines: GreenLine[] | null;
    };
  } | null;
}

// ---- helpers ----

const rowOf = (s: ConcentrationState, cell: number) => Math.floor(cell / s.cols);
const pairOf = (s: ConcentrationState, id: string | null) => (id ? s.pairs.find((p) => p.id === id) : undefined);
const pairsLeft = (s: ConcentrationState) => s.pairs.filter((p) => !p.cleared).length;
const uncovered = (s: ConcentrationState) => s.cards.filter((c) => c.state === 'cleared').length;

function tallyFor(s: ConcentrationState, playerId: string): Tally {
  return (s.tally[playerId] ??= { pairs: 0, steals: 0, points: 0, spoken: 0 });
}

function give(s: ConcentrationState, ctx: ModeContext, playerId: string, points: number): void {
  const p = Math.round(points);
  tallyFor(s, playerId).points += p;
  ctx.award(playerId, p);
}

function flash(s: ConcentrationState, kind: Flash['kind'], playerId: string | null, row?: number): void {
  s.flash = { seq: (s.flash?.seq ?? 0) + 1, kind, playerId, ...(row !== undefined ? { row } : {}) };
}

export function guessWorth(s: ConcentrationState): number {
  const hidden = 1 - uncovered(s) / s.cards.length;
  return Math.round((GUESS_MIN + (GUESS_MAX - GUESS_MIN) * hidden) / 10) * 10;
}

function isOver(s: ConcentrationState, ctx: ModeContext): boolean {
  return pairsLeft(s) === 0 || s.turnNo >= s.maxTurns || ctx.now >= s.endsAt;
}

function nextTurnPlayer(s: ConcentrationState, ctx: ModeContext): ModePlayer | undefined {
  const players = [...ctx.players()].sort((a, b) => a.seat - b.seat);
  if (s.extraTurnFor) {
    const p = ctx.player(s.extraTurnFor);
    s.extraTurnFor = null;
    if (p?.connected) return p;
  }
  const after = [...players.filter((p) => p.seat > s.lastSeat), ...players.filter((p) => p.seat <= s.lastSeat)];
  return after.find((p) => p.connected) ?? after[0];
}

function clearPair(s: ConcentrationState, pair: Pair, ownerId: string | null): void {
  pair.cleared = true;
  pair.ownerId = ownerId;
  for (const c of s.cards) if (c.pairId === pair.id) c.state = 'cleared';
}

/** Moves the face-down cards around among their own cells (the yōkai tile). */
function shuffleFaceDown(s: ConcentrationState, ctx: ModeContext): void {
  const cells = s.cards.map((c, i) => (c.state === 'down' ? i : -1)).filter((i) => i >= 0);
  const moved = shuffled(
    cells.map((i) => s.cards[i]!),
    () => ctx.random(),
  );
  cells.forEach((cell, k) => (s.cards[cell] = moved[k]!));
  s.shuffleSeq += 1;
}

function pickFogRow(s: ConcentrationState, ctx: ModeContext): number | null {
  const counts = Array.from({ length: s.rows }, (_, r) => s.cards.filter((c, i) => c.state === 'down' && rowOf(s, i) === r).length);
  const rows = counts.map((n, r) => (n > 0 ? r : -1)).filter((r) => r >= 0);
  if (!rows.length) return null;
  return rows[Math.floor(ctx.random() * rows.length)]!;
}

/** Cells the turn player may flip right now. */
export function pickable(s: ConcentrationState): number[] {
  return s.cards.map((c, i) => (c.state === 'down' && rowOf(s, i) !== s.fogRow ? i : -1)).filter((i) => i >= 0);
}

function sayAttempt(s: ConcentrationState, ctx: ModeContext, phase: Phase, playerId: string, raw: unknown) {
  const claim = s.claim;
  if (!claim || claim.winnerId) return moveError('wrong-phase');
  const stealing = phase === 'encore';
  if (!stealing && playerId !== claim.claimerId) return moveError('not-your-pair');
  // The flipper's own try arriving after their window closed: a harmless race.
  if (stealing && playerId === claim.claimerId) return moveError('wrong-phase');
  if (!isUtterance(raw)) return moveError('bad-utterance');
  const heard = cleanText(raw.text, 60);
  if (!heard) return moveError('empty-answer');
  const used = claim.attempts[playerId] ?? 0;
  if (used >= SAY_ATTEMPTS) return moveError('no-tries-left');
  const pair = pairOf(s, claim.pairId)!;
  claim.attempts[playerId] = used + 1;
  const ok = matchesAccepted(utteranceReading(raw), pair.accepted);
  claim.last[playerId] = { ok, heard };
  const player = ctx.player(playerId);
  if (!ok) {
    if (used + 1 >= SAY_ATTEMPTS) ctx.phrase(playerId, { itemId: pair.word.id, text: pair.word.jp.text, kana: pair.word.jp.kana, en: pair.word.jp.en, outcome: 'missed' });
    return MOVE_OK;
  }
  claim.winnerId = playerId;
  claim.winnerVia = raw.via;
  const spoken = raw.via === 'speech';
  const points = PAIR_POINTS + (spoken ? SPOKEN_BONUS : 0);
  give(s, ctx, playerId, points);
  const t = tallyFor(s, playerId);
  t.pairs += 1;
  if (spoken) t.spoken += 1;
  if (stealing) t.steals += 1;
  clearPair(s, pair, playerId);
  s.result = { kind: stealing ? 'stolen' : 'claimed', playerId, word: pair.word.jp, points, spoken };
  ctx.phrase(playerId, { itemId: pair.word.id, text: pair.word.jp.text, kana: pair.word.jp.kana, en: pair.word.jp.en, outcome: used === 0 ? 'said' : 'retry', recall: spoken ? 'memory' : 'read' });
  flash(s, stealing ? 'stolen' : 'claimed', playerId);
  const slots = { name: player?.name ?? '' };
  ctx.cue({ host: 'fude', event: stealing ? 'concentration_stolen' : 'concentration_keep', slots, answer: heard, answerEn: pair.word.jp.en });
  return MOVE_OK;
}

// ---- Frame Concentration (Green Car) ----

const durations = (s: ConcentrationState) => (s.green ? GREEN_DURATIONS : DURATIONS);

/**
 * A say in Frame Concentration. In the say-it window (`reveal`) the flipper says their sentence and everyone
 * else may say their own at the same time (the chorus: +30, logged, never takes the pair). In the steal window
 * (`encore`) anyone but the flipper may say it to steal. Right = framesOf finds the pair's frame and the gist's key
 * word is there (greenBoard.ts, checkFrameSay). The heard text goes in the sayer's own phrasebook and on their
 * own phone only; the TV and Fude get the model line.
 */
function greenSay(s: ConcentrationState, ctx: ModeContext, phase: Phase, playerId: string, raw: unknown) {
  const claim = s.claim;
  const g = s.green!;
  if (!claim) return moveError('wrong-phase');
  // During the peek the chunk card is still up: saying it then would be reading it.
  if (phase === 'prompt') return moveError('wrong-phase');
  const isClaimer = playerId === claim.claimerId;
  const how: GreenLine['how'] = phase === 'reveal' ? (isClaimer ? 'claim' : 'chorus') : 'steal';
  if (how === 'steal' && (isClaimer || claim.winnerId)) return moveError('wrong-phase');
  if (how === 'claim' && claim.winnerId) return moveError('wrong-phase');
  const chorus = (claim.chorus ??= { attempts: {}, last: {}, right: [] });
  if (how === 'chorus' && chorus.right.includes(playerId)) return moveError('already-said');
  if (!isUtterance(raw)) return moveError('bad-utterance');
  const heard = cleanText(raw.text, 80);
  if (!heard) return moveError('empty-answer');
  if (!playerTextAllowed(heard, s.green!.audience)) return moveError('kids-words');
  const attempts = how === 'chorus' ? chorus.attempts : claim.attempts;
  const used = attempts[playerId] ?? 0;
  if (used >= SAY_ATTEMPTS) return moveError('no-tries-left');
  const pair = pairOf(s, claim.pairId)!;
  const gist = GIST_BY_ID.get(pair.gist!.id)!;
  attempts[playerId] = used + 1;
  const check = checkFrameSay(raw, gist);
  const last: LastTry = check.ok ? { ok: true, heard } : { ok: false, heard, tip: { frame: check.frame, anchor: check.anchor } };
  (how === 'chorus' ? chorus.last : claim.last)[playerId] = last;
  const key = compact(raw.reading ?? heard);
  const heardBy = (claim.heardBy ??= []);
  // Others in the room may have heard an earlier try: saying the same words back is not from memory.
  const copied = how !== 'claim' && heardBy.some((h) => h.by !== playerId && h.key === key);
  heardBy.push({ by: playerId, key });
  const spoken = raw.via === 'speech';
  const tiles = raw.via === 'tap';
  const memory = spoken && !copied;
  const lines = (g.lines[playerId] ??= []);
  if (!check.ok) {
    if (used + 1 >= SAY_ATTEMPTS) {
      lines.push({ gistId: gist.id, heard, ok: false, memory: false, how, model: gist.model });
      if (how === 'claim') ctx.phrase(playerId, { itemId: pair.word.id, text: gist.model.text, kana: gist.model.kana, en: gist.model.en, outcome: 'missed' });
    }
    return MOVE_OK;
  }
  lines.push({ gistId: gist.id, heard, ok: true, memory, how, model: gist.model });
  const mine = (g.said[playerId] ??= {});
  mine[gist.frame] = (mine[gist.frame] ?? 0) + 1;
  // The player's own sentence, not the model (Late Again!'s Pon line is the model; this is what was said).
  ctx.phrase(playerId, { itemId: pair.word.id, text: heard, kana: raw.reading ?? heard, en: gist.en, outcome: used === 0 ? 'said' : 'retry', recall: memory ? 'memory' : 'read' });
  if (how === 'chorus') {
    chorus.right.push(playerId);
    give(s, ctx, playerId, GREEN_POINTS.chorus);
    return MOVE_OK;
  }
  const player = ctx.player(playerId);
  const stretch = player?.level === 'n4' && pair.gist!.level === 'n3';
  const points = tiles ? GREEN_POINTS.tiles : (pair.gist!.hard ? GREEN_POINTS.hard : PAIR_POINTS) + (spoken ? SPOKEN_BONUS : 0) + (stretch ? GREEN_POINTS.stretch : 0);
  const stealing = how === 'steal';
  claim.winnerId = playerId;
  claim.winnerVia = raw.via;
  give(s, ctx, playerId, points);
  const t = tallyFor(s, playerId);
  t.pairs += 1;
  if (spoken) t.spoken += 1;
  if (stealing) t.steals += 1;
  clearPair(s, pair, playerId);
  s.result = { kind: stealing ? 'stolen' : 'claimed', playerId, word: gist.model, points, spoken };
  flash(s, stealing ? 'stolen' : 'claimed', playerId);
  // Fude reacts to our model line, never to the transcript (no free speech reaches the room's speakers).
  ctx.cue({ host: 'fude', event: stealing ? 'concentration_stolen' : 'concentration_keep', slots: { name: player?.name ?? '' }, answer: gist.model.text, answerEn: gist.model.en });
  return MOVE_OK;
}

/** Green Car: whether the English goes back on hard gist cards (the flipper plays at N4: stretch). */
function hardEnglish(s: ConcentrationState, ctx: ModeContext): boolean {
  const flipper = s.claim?.claimerId ?? s.turn?.playerId ?? null;
  return !!flipper && ctx.player(flipper)?.level === 'n4';
}

function viewFace(face: Face, english: boolean): Face {
  return face.kind === 'gist' && face.hard && !english ? { ...face, text: '' } : face;
}

// ---- the mode ----

export const concentrationMode: Mode<ConcentrationState, ConcentrationView> = {
  info: {
    id: 'concentration',
    title: 'Kotoba Concentration',
    titleJa: 'ことば神経衰弱',
    titleKana: 'ことばしんけいすいじゃく',
    blurb: 'Flip pairs, then say the word to keep them. Anyone can steal.',
    host: 'fude',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: true,
    phaseLabels: { answer: 'Turn', prompt: 'Peek', reveal: 'Say it', encore: 'Steal', score: 'Result' },
  },

  setup(ctx, opts) {
    const random = () => ctx.random();
    const players = ctx.players();
    const levels = players.map((p) => p.level);
    const packs = ctx.content.packs;
    const pack = packs.find((p) => p.id === opts.packId) ?? (packs.length ? packs[Math.floor(random() * packs.length)] : undefined);
    const green = !!ctx.greenCar;
    const said: GreenState['said'] = Object.fromEntries(players.map((p) => [p.id, {}]));
    // Aim the deal: frames the seated players need most tonight go first (aimWeight, summed over the seats: frames a
    // path goal requires weigh double, over tonight's earlier says; this game's own counts are 0 at its start).
    const need = (f: FrameId) => players.reduce((n, p) => n + aimWeight(ctx, p.id, [f], said[p.id]), 0);
    const board = green
      ? buildGreenBoard(planGreenBoard(players.length, random), ctx.audience, need, random, () => ctx.newId())
      : buildBoard(pack, planBoard(players.length, levels, random), levels, random, () => ctx.newId());
    const scene = SCENES[Math.floor(random() * SCENES.length)]!;
    const tiles = Array.from({ length: board.cards.length }, (_, i) => scene.clues[i % scene.clues.length]!);
    const others = shuffled(
      SCENES.filter((x) => x.id !== scene.id),
      random,
    ).slice(0, 3);
    return {
      cols: board.cols,
      rows: board.rows,
      cards: board.cards,
      pairs: board.pairs,
      fallback: board.fallback,
      startedAt: ctx.now,
      endsAt: ctx.now + GAME_CAP_MS,
      maxTurns: board.pairs.length * 6 + 12,
      turnNo: 0,
      turn: null,
      lastSeat: 0,
      extraTurnFor: null,
      fogRow: null,
      pendingFog: null,
      claim: null,
      result: null,
      pendingFlipDown: [],
      scene: {
        id: scene.id,
        name: scene.name,
        tiles: shuffled(tiles, random),
        options: shuffled([scene, ...others], random).map((x) => ({ id: x.id, text: x.name.text, kana: x.name.kana, en: x.name.en })),
      },
      solvedBy: null,
      guesses: {},
      tally: Object.fromEntries(players.map((p) => [p.id, { pairs: 0, steals: 0, points: 0, spoken: 0 }])),
      shuffleSeq: 0,
      flash: null,
      finished: false,
      ...(green ? { green: { audience: ctx.audience ?? 'family', said, lines: {} } } : {}),
    };
  },

  next(s, from, ctx) {
    const afterTurn = (): Phase => (isOver(s, ctx) ? 'finale' : 'answer');
    switch (from) {
      case 'intro':
        return 'answer';
      case 'answer':
        if (s.turn?.outcome === 'match') return 'prompt';
        if (s.turn?.outcome === 'mismatch') return 'score';
        return afterTurn();
      case 'prompt':
        return s.claim?.winnerId ? 'score' : 'reveal';
      case 'reveal':
        return s.claim?.winnerId ? 'score' : 'encore';
      case 'encore':
        return 'score';
      case 'score':
        return afterTurn();
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'fude', event: 'concentration_intro' });
        break;
      case 'answer': {
        s.turnNo += 1;
        s.claim = null;
        s.result = null;
        const extraFor = s.extraTurnFor;
        const p = nextTurnPlayer(s, ctx);
        const extra = !!p && p.id === extraFor;
        s.turn = { playerId: p?.id ?? null, flips: [], outcome: null, specials: 0, extra };
        if (p) s.lastSeat = p.seat;
        s.fogRow = s.pendingFog;
        s.pendingFog = null;
        // Fog never leaves the player without two cards to pick.
        if (s.fogRow !== null && pickable(s).length < 2) s.fogRow = null;
        break;
      }
      case 'prompt':
        ctx.cue({ host: 'fude', event: 'concentration_say_it', slots: { name: ctx.player(s.claim?.claimerId ?? '')?.name ?? '' } });
        break;
      case 'encore':
        ctx.cue({ host: 'fude', event: 'concentration_steal_open' });
        break;
      case 'finale':
        s.finished = true;
        s.claim = null;
        s.turn = null;
        s.fogRow = null;
        ctx.cue({ host: 'fude', event: pairsLeft(s) === 0 ? 'concentration_clear' : 'concentration_time' });
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'answer') {
      const turn = s.turn;
      // Out of time with one card up: it goes back down.
      if (turn && turn.outcome === null) for (const cell of turn.flips) if (s.cards[cell]?.state === 'up') s.cards[cell]!.state = 'down';
      if (turn?.outcome === 'mismatch') {
        s.pendingFlipDown = [...turn.flips];
        s.result = { kind: 'mismatch', playerId: turn.playerId, word: null, points: 0, spoken: false };
        ctx.cue({ host: 'fude', event: 'concentration_mismatch' });
      }
      s.fogRow = null;
    }
    if (phase === 'encore') {
      const claim = s.claim;
      if (claim && !claim.winnerId) {
        const pair = pairOf(s, claim.pairId)!;
        pair.misses += 1;
        if (pair.misses >= MAX_MISSES) {
          clearPair(s, pair, null);
          s.result = { kind: 'cleared', playerId: null, word: pair.word.jp, points: 0, spoken: false };
        } else {
          s.pendingFlipDown = [...claim.cells];
          s.result = { kind: 'missed', playerId: null, word: pair.word.jp, points: 0, spoken: false };
        }
        flash(s, 'missed', null);
        ctx.cue({ host: 'fude', event: 'concentration_missed' });
      }
    }
    if (phase === 'score') {
      for (const cell of s.pendingFlipDown) if (s.cards[cell]?.state === 'up') s.cards[cell]!.state = 'down';
      s.pendingFlipDown = [];
    }
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return durations(s).intro;
      case 'answer':
        return ctx.player(s.turn?.playerId ?? '')?.level === 'kana' ? durations(s).turnKana : durations(s).turn;
      case 'prompt':
        return durations(s).peek;
      case 'reveal':
        return durations(s).claim;
      case 'encore':
        return durations(s).steal;
      case 'score':
        return s.result?.kind === 'mismatch' ? durations(s).mismatch : durations(s).result;
      case 'finale':
        return durations(s).finale;
      default:
        return 5_000;
    }
  },

  done(s, phase, ctx) {
    const anyoneHere = ctx.connected().length > 0;
    switch (phase) {
      case 'answer': {
        if (!s.turn) return true;
        if (s.turn.outcome) return true;
        // Nothing left to flip (only specials were left, and they're gone).
        if (s.cards.every((c) => c.state !== 'down')) return true;
        const p = ctx.player(s.turn.playerId ?? '');
        return (!p || !p.connected) && anyoneHere;
      }
      case 'prompt':
        return !!s.claim?.winnerId;
      case 'reveal': {
        const claim = s.claim;
        if (claim && s.green) {
          // The chorus: the window stays open until the flipper and everyone else are done.
          const p = ctx.player(claim.claimerId);
          const flipperDone = !!claim.winnerId || (claim.attempts[claim.claimerId] ?? 0) >= SAY_ATTEMPTS || ((!p || !p.connected) && anyoneHere);
          const others = ctx.connected().filter((x) => x.id !== claim.claimerId);
          const ch = claim.chorus;
          return flipperDone && others.every((x) => !!ch?.right.includes(x.id) || (ch?.attempts[x.id] ?? 0) >= SAY_ATTEMPTS);
        }
        if (!claim || claim.winnerId) return true;
        if ((claim.attempts[claim.claimerId] ?? 0) >= SAY_ATTEMPTS) return true;
        const p = ctx.player(claim.claimerId);
        return (!p || !p.connected) && anyoneHere;
      }
      case 'encore': {
        const claim = s.claim;
        if (!claim || claim.winnerId) return true;
        const stealers = ctx.connected().filter((p) => p.id !== claim.claimerId);
        return stealers.every((p) => (claim.attempts[p.id] ?? 0) >= SAY_ATTEMPTS);
      }
      default:
        return false;
    }
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (s.finished) return moveError('wrong-phase');

    if (raw.kind === 'flip') {
      if (phase !== 'answer') return moveError('wrong-phase');
      const turn = s.turn;
      if (!turn || turn.playerId !== playerId) return moveError('not-your-turn');
      if (turn.outcome || turn.flips.length >= 2) return moveError('wrong-phase');
      const cell = raw.cell;
      if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= s.cards.length) return moveError('bad-cell');
      const card = s.cards[cell]!;
      if (card.state !== 'down') return moveError('not-face-down');
      if (s.fogRow !== null && rowOf(s, cell) === s.fogRow) return moveError('fogged');
      const name = ctx.player(playerId)?.name ?? '';

      if (card.role === 'special') {
        // Specials never count as one of your two flips.
        card.state = 'cleared';
        turn.specials += 1;
        const special = card.face.special!;
        if (special === 'yokai') {
          shuffleFaceDown(s, ctx);
          flash(s, 'yokai', playerId);
          ctx.cue({ host: 'fude', event: 'concentration_yokai', slots: { name } });
        } else if (special === 'bonus') {
          s.extraTurnFor = playerId;
          flash(s, 'bonus', playerId);
          ctx.cue({ host: 'fude', event: 'concentration_bonus', slots: { name } });
        } else {
          s.pendingFog = pickFogRow(s, ctx);
          flash(s, 'fog', playerId, s.pendingFog ?? undefined);
          ctx.cue({ host: 'fude', event: 'concentration_fog', slots: { name } });
        }
        if (pickable(s).length === 0) s.fogRow = null;
        return MOVE_OK;
      }

      card.state = 'up';
      turn.flips.push(cell);
      if (turn.flips.length === 2) {
        const [a, b] = turn.flips as [number, number];
        if (s.cards[a]!.pairId === s.cards[b]!.pairId) {
          turn.outcome = 'match';
          s.claim = { pairId: card.pairId!, cells: [a, b], claimerId: playerId, attempts: {}, last: {}, winnerId: null, winnerVia: null };
          if (s.green) {
            const gist = GIST_BY_ID.get(pairOf(s, card.pairId)!.gist!.id)!;
            Object.assign(s.claim, { chorus: { attempts: {}, last: {}, right: [] }, heardBy: [], tiles: tilesFor(gist, () => ctx.random()) });
          }
        } else turn.outcome = 'mismatch';
      } else if (pickable(s).length === 0) {
        // Only fogged cards are left to pair with: lift the fog.
        s.fogRow = null;
      }
      return MOVE_OK;
    }

    if (raw.kind === 'say') {
      if (phase !== 'prompt' && phase !== 'reveal' && phase !== 'encore') return moveError('wrong-phase');
      return s.green ? greenSay(s, ctx, phase, playerId, raw.utterance) : sayAttempt(s, ctx, phase, playerId, raw.utterance);
    }

    if (raw.kind === 'guess') {
      if (phase === 'intro' || phase === 'finale') return moveError('wrong-phase');
      if (s.solvedBy) return moveError('already-solved');
      if (s.guesses[playerId]) return moveError('already-guessed');
      if (uncovered(s) < GUESS_OPENS_AT) return moveError('too-early');
      const option = s.scene.options.find((o) => o.id === raw.optionId);
      if (!option) return moveError('bad-option');
      const ok = option.id === s.scene.id;
      s.guesses[playerId] = { optionId: option.id, ok };
      const name = ctx.player(playerId)?.name ?? '';
      if (ok) {
        give(s, ctx, playerId, guessWorth(s));
        s.solvedBy = playerId;
        flash(s, 'guess-right', playerId);
        ctx.cue({ host: 'fude', event: 'concentration_picture', slots: { name }, answer: s.scene.name.text, answerEn: s.scene.name.en });
      } else flash(s, 'guess-wrong', playerId);
      return MOVE_OK;
    }

    return moveError('bad-move');
  },

  release(s, playerId) {
    if (s.extraTurnFor === playerId) s.extraTurnFor = null;
  },

  progress() {
    return { round: 0, totalRounds: 0 };
  },

  view(s, phase, viewer, ctx) {
    const claim = s.claim;
    const green = s.green;
    // Green Car: the chunk stays turned away for the whole say-it window, while the chorus is still talking.
    const sayWindow = (phase === 'reveal' || phase === 'encore') && !!claim && (!claim.winnerId || !!green);
    const english = !!green && hardEnglish(s, ctx);
    const showAll = s.finished || !!s.solvedBy;
    const cells: CellView[] = s.cards.map((c, i) => {
      if (c.state === 'down') return { state: 'down' };
      if (c.state === 'cleared') {
        if (c.role === 'special') return { state: 'cleared', special: c.face.special! };
        return { state: 'cleared', owner: pairOf(s, c.pairId)?.ownerId ?? null };
      }
      const masked = sayWindow && claim!.cells.includes(i) && c.role === 'word';
      return masked ? { state: 'up', masked: true } : { state: 'up', face: green ? viewFace(c.face, english) : c.face, pair: c.pairId ?? undefined };
    });
    const pair = pairOf(s, claim?.pairId ?? null);
    const cueCard = claim ? s.cards[claim.cells.find((i) => s.cards[i]!.role === 'cue') ?? claim.cells[0]] : undefined;
    const stage: NonNullable<ConcentrationView['claim']>['stage'] = !claim
      ? 'done'
      : claim.winnerId || phase === 'score'
        ? 'done'
        : phase === 'prompt'
          ? 'peek'
          : phase === 'encore'
            ? 'steal'
            : 'claim';

    let mine: ConcentrationView['mine'] = null;
    if (viewer.kind === 'player') {
      const id = viewer.playerId;
      const me = ctx.player(id);
      const isTurn = phase === 'answer' && s.turn?.playerId === id;
      const used = claim?.attempts[id] ?? 0;
      const chorus = !!green && !!claim && phase === 'reveal' && claim.claimerId !== id;
      const chorusUsed = claim?.chorus?.attempts[id] ?? 0;
      const canSay = green
        ? !!claim &&
          (chorus
            ? chorusUsed < SAY_ATTEMPTS && !claim.chorus?.right.includes(id)
            : !claim.winnerId && used < SAY_ATTEMPTS && ((phase === 'reveal' && claim.claimerId === id) || (phase === 'encore' && claim.claimerId !== id)))
        : !!claim &&
          !claim.winnerId &&
          used < SAY_ATTEMPTS &&
          (((phase === 'prompt' || phase === 'reveal') && claim.claimerId === id) || (phase === 'encore' && claim.claimerId !== id));
      const hint = !green && canSay && claim!.claimerId === id && me?.level === 'kana' && pair ? { kana: pair.word.jp.kana, romaji: toRomaji(pair.word.jp.kana) } : null;
      mine = {
        isTurn,
        canFlip: isTurn && !s.turn?.outcome && (s.turn?.flips.length ?? 0) < 2,
        canSay,
        attemptsLeft: claim ? SAY_ATTEMPTS - (chorus ? chorusUsed : used) : 0,
        last: (chorus ? claim?.chorus?.last[id] : claim?.last[id]) ?? null,
        hint,
        guess: s.guesses[id] ?? null,
      };
      if (green) {
        const gist = pair?.gist ? GIST_BY_ID.get(pair.gist.id) : undefined;
        mine.green = {
          chorus,
          stretch: me?.level === 'n4' && pair?.gist?.level === 'n3',
          tiles: canSay ? (claim?.tiles ?? null) : null,
          frameJa: gist ? (FRAME_BY_ID[gist.frame]?.ja ?? null) : null,
          anchorEn: gist?.anchorEn ?? null,
          lines: s.finished ? (green.lines[id] ?? []) : null,
        };
      }
    }

    return {
      mode: 'concentration',
      cols: s.cols,
      rows: s.rows,
      cells,
      fogRow: phase === 'answer' ? s.fogRow : null,
      turn: s.turn && !s.finished ? { no: s.turnNo, playerId: s.turn.playerId, flips: s.turn.flips.length, specials: s.turn.specials, extra: s.turn.extra } : null,
      claim:
        claim && cueCard && pair && phase !== 'answer'
          ? {
              claimerId: claim.claimerId,
              cue: green ? viewFace(cueCard.face, english) : cueCard.face,
              stage,
              winnerId: claim.winnerId,
              tried: Object.keys(claim.attempts),
              word: green ? (phase === 'score' ? pair.word.jp : null) : sayWindow ? null : pair.word.jp,
              ...(green ? { chorus: [...(claim.chorus?.right ?? [])] } : {}),
            }
          : null,
      result: phase === 'score' ? s.result : null,
      picture: {
        tiles: s.cards.map((c, i) => (showAll || c.state === 'cleared' ? s.scene.tiles[i]! : null)),
        uncovered: uncovered(s),
        options: s.scene.options,
        guessed: Object.entries(s.guesses).map(([playerId, g]) => ({ playerId, ok: g.ok })),
        solvedBy: s.solvedBy,
        answer: showAll ? s.scene.name : null,
        open: !s.solvedBy && !s.finished && phase !== 'intro' && uncovered(s) >= GUESS_OPENS_AT,
        worth: guessWorth(s),
      },
      tally: ctx.players().map((p) => ({ playerId: p.id, ...tallyFor(s, p.id) })),
      pairsLeft: pairsLeft(s),
      totalPairs: s.pairs.length,
      endsAt: s.endsAt,
      shuffleSeq: s.shuffleSeq,
      flash: s.flash,
      fallback: s.fallback,
      ...(green ? { green: true as const } : {}),
      mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (key: keyof Tally) => {
      let top: ModePlayer | undefined;
      for (const p of players) if ((s.tally[p.id]?.[key] ?? 0) > (top ? (s.tally[top.id]?.[key] ?? 0) : 0)) top = p;
      return top;
    };
    const memory = best('pairs');
    if (memory) out.push({ playerId: memory.id, name: memory.name, title: 'きおく マスター', en: 'Memory Master: most pairs kept' });
    const thief = best('steals');
    if (thief) out.push({ playerId: thief.id, name: thief.name, title: 'よこどり キング', en: 'Steal King: most pairs stolen' });
    const voice = best('spoken');
    if (voice) out.push({ playerId: voice.id, name: voice.name, title: 'おおごえ賞', en: 'Big Voice: most pairs said aloud' });
    const sleuth = s.solvedBy ? ctx.player(s.solvedBy) : undefined;
    if (sleuth) out.push({ playerId: sleuth.id, name: sleuth.name, title: 'えの たんてい', en: 'Picture Detective: guessed the hidden picture' });
    if (s.green) {
      // じぶんの ことば賞: the most different sentences that counted.
      const own = (id: string) => new Set((s.green!.lines[id] ?? []).filter((l) => l.ok).map((l) => compact(l.heard))).size;
      let top: ModePlayer | undefined;
      for (const p of players) if (own(p.id) > (top ? own(top.id) : 0)) top = p;
      if (top) out.push({ playerId: top.id, name: top.name, title: 'じぶんの ことば賞', en: 'Own Words: the most different sentences that counted' });
    }
    return out;
  },
};
