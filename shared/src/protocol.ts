// Wire protocol shared by the server, the stage, the phone controller and the bots.
// See docs/protocol.md for the prose version and docs/decisions for the reasoning.

import type { HostId, Level } from '../../content/src/types.js';
import type { Award, ModeInfo, PhraseEntry } from './modes/mode.js';
import type { GameView } from './modes/views.js';

export type { Level, HostId };

/**
 * The shared round skeleton. Every mode moves through these; a mode can skip phases
 * and loop prompt → … → score as many times as it likes. `penalty` and `finale` are for
 * modes with an extra beat (Last Train's penalty minigame and Platform Dash, the Raid's boss).
 */
export const PHASES = ['lobby', 'intro', 'prompt', 'answer', 'reveal', 'encore', 'score', 'penalty', 'finale', 'recap'] as const;
export type Phase = (typeof PHASES)[number];

export const MODE_IDS = ['oogiri', 'last-train', 'kana-raid', 'word-gauntlet', 'concentration', 'phrase-bingo', 'karaoke-duel', 'oekaki', 'debug'] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const LEVELS: readonly Level[] = ['kana', 'n5', 'n4'];

/** Who a view is rendered for. */
export type Viewer = { kind: 'stage' } | { kind: 'player'; playerId: string };

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  level: Level;
  connected: boolean;
  isVip: boolean;
  score: number;
  /** Lobby mic check: 'ok' once they said こんにちは, 'quiet' if they chose tap/type. */
  mic: 'ok' | 'quiet' | null;
}

/** What the host is saying right now (shown as a subtitle, voiced if audio is ready). */
export interface HostSay {
  host: HostId;
  text: string;
  kana: string;
  en: string;
  audioUrl?: string;
  /** The phase this line belongs to; a line from an earlier phase is not shown. */
  phaseSeq: number;
}

export interface RecapView {
  standings: { playerId: string; name: string; score: number }[];
  awards: Award[];
  /** Only the viewer's own phrasebook (empty on the stage). */
  phrasebook: PhraseEntry[];
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
  /** Server-clock epoch ms when the current phase ends, or null if it waits for a person. */
  deadline: number | null;
  round: number;
  totalRounds: number;
  /** The mode being played, or the one last played while in the lobby. */
  mode: ModeId | null;
  /** Menu for the VIP (lobby only). */
  modes: ModeInfo[];
  /** Topic packs the VIP can pick (lobby only). */
  packs: { id: string; title: string; titleJa: string; blurb: string }[];
  players: PlayerView[];
  host: HostSay | null;
  /** The mode's own view, while a game runs. */
  game: GameView | null;
  recap: RecapView | null;
  /** Only in a player's own view. */
  me: { playerId: string; level: Level } | null;
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
  | { id: string; type: 'start'; mode: ModeId; rounds?: number; packId?: string; extra?: Record<string, unknown> }
  | { id: string; type: 'play'; move: unknown }
  | { id: string; type: 'setLevel'; level: Level }
  /** The lobby mic check: say こんにちは. A quiet result switches the phone to tap/type. */
  | { id: string; type: 'micCheck'; utterance: unknown }
  | { id: string; type: 'skip'; phaseSeq: number }
  | { id: string; type: 'playAgain' };

export type CommandType = Command['type'];

export type CommandResult = { ok: true; v: number } | { ok: false; error: string; v: number };

/** Room-level errors. Modes add their own (e.g. 'own-answer'), so results carry a plain string. */
export type CommandError =
  | 'bad-command'
  | 'wrong-phase'
  | 'not-vip'
  | 'not-allowed'
  | 'unknown-mode'
  | 'not-enough-players'
  | 'too-many-players'
  | 'stale-phase'
  | 'bad-level';

export interface CreateRoomResponse {
  code: string;
  stageToken: string;
  joinUrl: string;
}

export interface JoinRequest {
  name: string;
  level?: Level;
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
