// The Phase 0 skeleton round, kept as a mode: write an answer, vote for the funniest.
// Bots and the gate tests play it; it is hidden from the VIP's menu.

import { IPPON_BONUS, IPPON_MIN_VOTERS, MAX_ANSWER_LENGTH, POINTS_PER_VOTE } from '../../constants.js';
import type { Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Mode, type ModeContext } from '../mode.js';

export interface DebugAnswer {
  id: string;
  authorId: string;
  text: string;
}

export interface DebugResult {
  answerId: string;
  authorId: string;
  authorName: string;
  text: string;
  votes: number;
  points: number;
  ippon: boolean;
}

export interface DebugState {
  round: number;
  totalRounds: number;
  deck: { id: string; text: string; subtitle?: string }[];
  prompt: { id: string; text: string; subtitle?: string } | null;
  answers: DebugAnswer[];
  /** voterId → answerId */
  votes: Record<string, string>;
  results: DebugResult[] | null;
}

export type DebugMove = { kind: 'answer'; text: string } | { kind: 'vote'; answerId: string };

export interface DebugView {
  mode: 'debug';
  prompt: { id: string; text: string; subtitle?: string } | null;
  /** playerIds that have answered / voted this round */
  answered: string[];
  voted: string[];
  /** Anonymous answers from the reveal on. */
  reveal: { id: string; text: string }[];
  /** Authors and points from the encore on. */
  results: DebugResult[] | null;
  /** The viewer's own answer and vote. */
  mine: { answerId: string | null; answerText: string | null; votedFor: string | null } | null;
}

export const DURATIONS: Record<Phase, number> = {
  lobby: 0,
  intro: 8_000,
  prompt: 4_000,
  answer: 60_000,
  reveal: 30_000,
  encore: 6_000,
  score: 6_000,
  penalty: 0,
  finale: 0,
  recap: 0,
};

/** Answer ids are random, so sorting by id gives an order that says nothing about who wrote what. */
export function revealOrder<T extends { id: string }>(answers: readonly T[]): T[] {
  return [...answers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export const debugMode: Mode<DebugState, DebugView> = {
  info: {
    id: 'debug',
    title: 'Debug round',
    titleJa: 'デバッグ',
    blurb: 'The Phase 0 skeleton: write an answer, vote for the funniest.',
    host: 'pon',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [3, 5, 10],
    usesPack: false,
  },

  setup(ctx, opts) {
    return {
      round: 0,
      totalRounds: opts.rounds ?? 3,
      deck: shuffled(ctx.content.debugPrompts, () => ctx.random()),
      prompt: null,
      answers: [],
      votes: {},
      results: null,
    };
  },

  next(s, from) {
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
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    if (phase === 'prompt') {
      s.round += 1;
      s.answers = [];
      s.votes = {};
      s.results = null;
      s.prompt = s.deck.length ? s.deck[(s.round - 1) % s.deck.length]! : { id: 'none', text: '…' };
    }
    if (phase === 'encore') s.results = score(s, ctx);
  },

  duration(_s, phase) {
    return DURATIONS[phase];
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (here.length === 0) return false;
    if (phase === 'answer') return here.every((p) => s.answers.some((a) => a.authorId === p.id));
    if (phase === 'reveal') {
      // No answers: nothing to vote on.
      const voters = here.filter((p) => s.answers.some((a) => a.authorId !== p.id));
      return voters.every((p) => s.votes[p.id] !== undefined);
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.kind === 'answer') {
      if (phase !== 'answer') return moveError('wrong-phase');
      if (s.answers.some((a) => a.authorId === playerId)) return moveError('already-answered');
      const text = cleanText(raw.text, MAX_ANSWER_LENGTH);
      if (!text) return moveError('empty-answer');
      s.answers.push({ id: ctx.newId(), authorId: playerId, text });
      return MOVE_OK;
    }
    if (raw.kind === 'vote') {
      if (phase !== 'reveal') return moveError('wrong-phase');
      if (s.votes[playerId]) return moveError('already-voted');
      const answer = s.answers.find((a) => a.id === raw.answerId);
      if (!answer) return moveError('unknown-answer');
      if (answer.authorId === playerId) return moveError('own-answer');
      s.votes[playerId] = answer.id;
      return MOVE_OK;
    }
    return moveError('bad-move');
  },

  release(s, playerId) {
    delete s.votes[playerId];
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer: Viewer) {
    const inRound = phase !== 'intro';
    const showAnswers = phase === 'reveal' || phase === 'encore' || phase === 'score';
    const showResults = phase === 'encore' || phase === 'score';
    let mine: DebugView['mine'] = null;
    if (viewer.kind === 'player') {
      const a = inRound ? s.answers.find((x) => x.authorId === viewer.playerId) : undefined;
      mine = { answerId: a?.id ?? null, answerText: a?.text ?? null, votedFor: (inRound && s.votes[viewer.playerId]) || null };
    }
    return {
      mode: 'debug',
      prompt: inRound ? s.prompt : null,
      answered: inRound ? s.answers.map((a) => a.authorId) : [],
      voted: inRound ? Object.keys(s.votes) : [],
      reveal: showAnswers ? revealOrder(s.answers).map((a) => ({ id: a.id, text: a.text })) : [],
      results: showResults ? s.results : null,
      mine,
    };
  },
};

function score(s: DebugState, ctx: ModeContext): DebugResult[] {
  const multiplier = s.round === s.totalRounds ? 2 : 1;
  const counts = new Map<string, number>();
  for (const answerId of Object.values(s.votes)) counts.set(answerId, (counts.get(answerId) ?? 0) + 1);
  const voters = Object.keys(s.votes);
  return revealOrder(s.answers).map((a) => {
    const votes = counts.get(a.id) ?? 0;
    // IPPON: every voter other than the author picked this answer, with enough voters.
    const otherVoters = voters.filter((v) => v !== a.authorId).length;
    const ippon = otherVoters >= IPPON_MIN_VOTERS && votes === otherVoters;
    const points = (votes * POINTS_PER_VOTE + (ippon ? IPPON_BONUS : 0)) * multiplier;
    const author = ctx.player(a.authorId);
    if (author) ctx.award(author.id, points);
    return { answerId: a.id, authorId: a.authorId, authorName: author?.name ?? '(left)', text: a.text, votes, points, ippon };
  });
}
