// The round state machine. Pure game rules: no sockets, no timers, no clocks.
// The server owns one GameState per room and feeds it actions one at a time (ADR 0001),
// passing the current time in. That keeps every rule testable without a network.

import {
  DEFAULT_ROUNDS,
  IPPON_BONUS,
  IPPON_MIN_VOTERS,
  MAX_ANSWER_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  POINTS_PER_VOTE,
  type PhaseDurations,
} from './constants.js';
import type { Command, CommandError, JoinError, Phase, Prompt, RoundResult, Viewer } from './protocol.js';

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  score: number;
}

export interface AnswerState {
  id: string;
  authorId: string;
  text: string;
}

export interface GameState {
  code: string;
  phase: Phase;
  phaseSeq: number;
  round: number;
  totalRounds: number;
  deadline: number | null;
  players: PlayerState[];
  vipId: string | null;
  prompt: Prompt | null;
  answers: AnswerState[];
  /** voterId → answerId */
  votes: Record<string, string>;
  results: RoundResult | null;
  deck: Prompt[];
  deckPos: number;
}

export interface GameContext {
  now: number;
  durations: PhaseDurations;
  prompts: readonly Prompt[];
  newId: () => string;
  random: () => number;
}

export type GameAction =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'release'; playerId: string }
  | { type: 'connection'; playerId: string; connected: boolean }
  | { type: 'command'; actor: Viewer; command: Command }
  | { type: 'timeout'; phaseSeq: number };

export type Outcome = { changed: boolean; error?: CommandError | JoinError };

const OK: Outcome = { changed: true };
const fail = (error: CommandError | JoinError): Outcome => ({ changed: false, error });

export function createGame(code: string): GameState {
  return {
    code,
    phase: 'lobby',
    phaseSeq: 0,
    round: 0,
    totalRounds: DEFAULT_ROUNDS,
    deadline: null,
    players: [],
    vipId: null,
    prompt: null,
    answers: [],
    votes: {},
    results: null,
    deck: [],
    deckPos: 0,
  };
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

/** Can a brand-new player take a seat right now? (Rejoining a held seat skips this.) */
export function canJoin(state: GameState, name: string): JoinError | null {
  if (state.phase !== 'lobby') return 'game-in-progress';
  if (state.players.length >= MAX_PLAYERS) return 'room-full';
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'name-taken';
  return null;
}

/** Applies one action. Mutates `state` in place and reports whether anything changed. */
export function apply(state: GameState, action: GameAction, ctx: GameContext): Outcome {
  const outcome = applyOne(state, action, ctx);
  if (outcome.changed) settle(state, ctx);
  return outcome;
}

function applyOne(state: GameState, action: GameAction, ctx: GameContext): Outcome {
  switch (action.type) {
    case 'join': {
      const name = cleanName(action.name);
      if (!name) return fail('bad-name');
      const err = canJoin(state, name);
      if (err) return fail(err);
      state.players.push({ id: action.playerId, name, seat: lowestFreeSeat(state), connected: false, score: 0 });
      state.players.sort((a, b) => a.seat - b.seat);
      state.vipId ??= action.playerId;
      return OK;
    }
    case 'release': {
      const idx = state.players.findIndex((p) => p.id === action.playerId);
      if (idx < 0) return { changed: false };
      state.players.splice(idx, 1);
      delete state.votes[action.playerId];
      if (state.vipId === action.playerId) state.vipId = state.players[0]?.id ?? null;
      if (state.players.length === 0 && state.phase !== 'lobby') resetToLobby(state);
      return OK;
    }
    case 'connection': {
      const p = player(state, action.playerId);
      if (!p || p.connected === action.connected) return { changed: false };
      p.connected = action.connected;
      return OK;
    }
    case 'timeout': {
      if (action.phaseSeq !== state.phaseSeq || state.deadline === null) return { changed: false };
      advance(state, ctx);
      return OK;
    }
    case 'command':
      return applyCommand(state, action.actor, action.command, ctx);
  }
}

function applyCommand(state: GameState, actor: Viewer, cmd: Command, ctx: GameContext): Outcome {
  const isStage = actor.kind === 'stage';
  const me = actor.kind === 'player' ? player(state, actor.playerId) : undefined;
  if (!isStage && !me) return fail('not-allowed');
  const isVip = !!me && me.id === state.vipId;

  switch (cmd.type) {
    case 'start': {
      if (state.phase !== 'lobby') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      if (state.players.length < MIN_PLAYERS) return fail('no-players');
      const rounds = Number.isInteger(cmd.rounds) ? (cmd.rounds as number) : DEFAULT_ROUNDS;
      state.totalRounds = Math.min(MAX_ROUNDS, Math.max(1, rounds));
      state.round = 0;
      for (const p of state.players) p.score = 0;
      state.deck = shuffled(ctx.prompts, ctx.random);
      state.deckPos = 0;
      enter(state, 'intro', ctx);
      return OK;
    }
    case 'answer': {
      if (!me) return fail('not-allowed');
      if (state.phase !== 'answer') return fail('wrong-phase');
      if (state.answers.some((a) => a.authorId === me.id)) return fail('already-answered');
      const text = typeof cmd.text === 'string' ? cmd.text.replace(/\s+/g, ' ').trim() : '';
      if (!text) return fail('empty-answer');
      state.answers.push({ id: ctx.newId(), authorId: me.id, text: [...text].slice(0, MAX_ANSWER_LENGTH).join('') });
      return OK;
    }
    case 'vote': {
      if (!me) return fail('not-allowed');
      if (state.phase !== 'reveal') return fail('wrong-phase');
      if (state.votes[me.id]) return fail('already-voted');
      const answer = state.answers.find((a) => a.id === cmd.answerId);
      if (!answer) return fail('unknown-answer');
      if (answer.authorId === me.id) return fail('own-answer');
      state.votes[me.id] = answer.id;
      return OK;
    }
    case 'skip': {
      if (!isVip && !isStage) return fail('not-vip');
      if (cmd.phaseSeq !== state.phaseSeq) return fail('stale-phase');
      if (state.deadline === null) return fail('wrong-phase');
      advance(state, ctx);
      return OK;
    }
    case 'playAgain': {
      if (state.phase !== 'recap') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      resetToLobby(state);
      return OK;
    }
    default:
      return fail('bad-command');
  }
}

/** Moves the current phase forward by one step. */
function advance(state: GameState, ctx: GameContext): void {
  switch (state.phase) {
    case 'intro':
      beginRound(state, ctx);
      return;
    case 'prompt':
      enter(state, 'answer', ctx);
      return;
    case 'answer':
      enter(state, 'reveal', ctx);
      return;
    case 'reveal':
      state.results = scoreRound(state);
      enter(state, 'encore', ctx);
      return;
    case 'encore':
      enter(state, 'score', ctx);
      return;
    case 'score':
      if (state.round < state.totalRounds) beginRound(state, ctx);
      else enter(state, 'recap', ctx);
      return;
    case 'lobby':
    case 'recap':
      return;
  }
}

/** Ends answer and vote phases early once every connected player is in. */
function settle(state: GameState, ctx: GameContext): void {
  for (let guard = 0; guard < 8; guard++) {
    if (state.phase === 'answer' && everyoneAnswered(state)) advance(state, ctx);
    else if (state.phase === 'reveal' && everyoneVoted(state)) advance(state, ctx);
    else return;
  }
}

export function everyoneAnswered(state: GameState): boolean {
  const here = state.players.filter((p) => p.connected);
  return here.length > 0 && here.every((p) => state.answers.some((a) => a.authorId === p.id));
}

export function everyoneVoted(state: GameState): boolean {
  const here = state.players.filter((p) => p.connected);
  if (here.length === 0) return false;
  const voters = here.filter((p) => state.answers.some((a) => a.authorId !== p.id));
  return voters.every((p) => state.votes[p.id] !== undefined);
}

function beginRound(state: GameState, ctx: GameContext): void {
  state.round += 1;
  state.answers = [];
  state.votes = {};
  state.results = null;
  state.prompt = state.deck.length ? state.deck[state.deckPos % state.deck.length]! : { id: 'none', text: '…' };
  state.deckPos += 1;
  enter(state, 'prompt', ctx);
}

function enter(state: GameState, phase: Phase, ctx: GameContext): void {
  state.phase = phase;
  state.phaseSeq += 1;
  state.deadline = phase === 'lobby' || phase === 'recap' ? null : ctx.now + ctx.durations[phase];
}

function resetToLobby(state: GameState): void {
  state.phase = 'lobby';
  state.phaseSeq += 1;
  state.deadline = null;
  state.round = 0;
  state.prompt = null;
  state.answers = [];
  state.votes = {};
  state.results = null;
}

export function scoreRound(state: GameState): RoundResult {
  const multiplier = state.round === state.totalRounds ? 2 : 1;
  const counts = new Map<string, number>();
  for (const answerId of Object.values(state.votes)) counts.set(answerId, (counts.get(answerId) ?? 0) + 1);
  const voters = Object.keys(state.votes);

  const answers = revealOrder(state.answers).map((a) => {
    const votes = counts.get(a.id) ?? 0;
    // IPPON: every voter other than the author picked this answer, with enough voters.
    const otherVoters = voters.filter((v) => v !== a.authorId).length;
    const ippon = otherVoters >= IPPON_MIN_VOTERS && votes === otherVoters;
    const points = (votes * POINTS_PER_VOTE + (ippon ? IPPON_BONUS : 0)) * multiplier;
    const author = player(state, a.authorId);
    if (author) author.score += points;
    return { answerId: a.id, authorId: a.authorId, authorName: author?.name ?? '(left)', text: a.text, votes, points, ippon };
  });
  return { round: state.round, promptId: state.prompt?.id ?? 'none', answers };
}

/** Answer ids are random, so sorting by id gives an order that says nothing about who wrote what. */
export function revealOrder<T extends { id: string }>(answers: readonly T[]): T[] {
  return [...answers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function player(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function lowestFreeSeat(state: GameState): number {
  for (let seat = 1; ; seat++) if (!state.players.some((p) => p.seat === seat)) return seat;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
