// Wire protocol shared by the server, the stage, the phone controller and the bots.
// See docs/protocol.md for the prose version and docs/decisions for the reasoning.

export const PHASES = ['lobby', 'intro', 'prompt', 'answer', 'reveal', 'encore', 'score', 'recap'] as const;
export type Phase = (typeof PHASES)[number];

/** Who a view is rendered for. */
export type Viewer = { kind: 'stage' } | { kind: 'player'; playerId: string };

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  isVip: boolean;
  score: number;
  /** Answered this round (shown as a tick, never the text). */
  answered: boolean;
  /** Voted this round. */
  voted: boolean;
}

export interface Prompt {
  id: string;
  text: string;
  /** Optional reading or translation line; topic packs fill this from Phase 1. */
  subtitle?: string;
}

/** An answer as shown during the vote: anonymous. */
export interface RevealAnswer {
  id: string;
  text: string;
}

/** One answer after the vote, with its author. */
export interface AnswerResult {
  answerId: string;
  authorId: string;
  authorName: string;
  text: string;
  votes: number;
  points: number;
  ippon: boolean;
}

export interface RoundResult {
  round: number;
  promptId: string;
  answers: AnswerResult[];
}

/**
 * The whole room as one viewer may see it. The server pushes a fresh one on every change
 * (ADR 0002), so a client never patches state: it replaces it.
 */
export interface RoomView {
  code: string;
  phase: Phase;
  /** Increments on every phase change; commands and timers are tied to it. */
  phaseSeq: number;
  round: number;
  totalRounds: number;
  /** Server-clock epoch ms when the current phase ends, or null if it waits for a person. */
  deadline: number | null;
  players: PlayerView[];
  prompt: Prompt | null;
  /** Anonymous answers, from the reveal phase on. */
  reveal: RevealAnswer[];
  /** Authors, votes and points, from the encore phase on. */
  results: RoundResult | null;
  /** Final standings in the recap phase. */
  standings: { playerId: string; name: string; score: number }[];
  /** Only in a player's own view. */
  me: { playerId: string; answerId: string | null; answerText: string | null; votedFor: string | null } | null;
}

/** Server → client WebSocket message. */
export type ServerMessage =
  | { type: 'state'; v: number; now: number; view: RoomView }
  | { type: 'bye'; reason: ByeReason };

export type ByeReason = 'seat-released' | 'room-closed' | 'replaced';

/** WebSocket close codes the server uses (4000–4999 is the application range). */
export const CLOSE = {
  badToken: 4401,
  roomGone: 4404,
  seatReleased: 4410,
} as const;

// ---- HTTP commands ----

/** Every command carries a client-made id; a retried id returns the first result (idempotent). */
export type Command =
  | { id: string; type: 'start'; rounds?: number }
  | { id: string; type: 'answer'; text: string }
  | { id: string; type: 'vote'; answerId: string }
  | { id: string; type: 'skip'; phaseSeq: number }
  | { id: string; type: 'playAgain' };

export type CommandType = Command['type'];

export type CommandResult = { ok: true; v: number } | { ok: false; error: CommandError; v: number };

export type CommandError =
  | 'bad-command'
  | 'wrong-phase'
  | 'not-vip'
  | 'not-allowed'
  | 'already-answered'
  | 'already-voted'
  | 'own-answer'
  | 'unknown-answer'
  | 'empty-answer'
  | 'stale-phase'
  | 'no-players';

export interface CreateRoomResponse {
  code: string;
  stageToken: string;
  joinUrl: string;
}

export interface JoinRequest {
  name: string;
  /** Anonymous id kept in the phone's storage; lets a reloaded page find its seat. */
  deviceId?: string;
  /** Token from an earlier join; the surest way back to a held seat. */
  token?: string;
}

export interface JoinResponse {
  playerId: string;
  token: string;
  rejoined: boolean;
}

export type JoinError = 'room-not-found' | 'room-full' | 'game-in-progress' | 'name-taken' | 'bad-name';

export interface RoomInfo {
  code: string;
  phase: Phase;
  players: number;
  joinable: boolean;
}
