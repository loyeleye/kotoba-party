// The room state machine. Pure game rules: no sockets, no timers, no clocks.
// The server owns one GameState per room and feeds it actions one at a time (ADR 0001),
// passing the current time in. The room runs the shared loop (lobby → game → recap) and
// hands everything inside the game to the chosen mode (shared/src/modes).

import type { Level } from '../../content/src/types.js';
import { MAX_NAME_LENGTH, MAX_PLAYERS } from './constants.js';
import type { Award, ContentLibrary, HostCue, Mode, ModeContext, ModePlayer, PhraseEntry } from './modes/mode.js';
import { MODES } from './modes/registry.js';
import type { Command, CommandError, HostSay, JoinError, ModeId, Phase, Viewer } from './protocol.js';
import { LEVELS, MODE_IDS } from './protocol.js';
import { isUtterance, matchesAccepted, utteranceReading } from './japanese/kana.js';

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  level: Level;
  connected: boolean;
  score: number;
  mic: 'ok' | 'quiet' | null;
}

export interface GameState {
  code: string;
  phase: Phase;
  phaseSeq: number;
  deadline: number | null;
  players: PlayerState[];
  vipId: string | null;
  /** The mode being played (or last played, in the lobby and recap). */
  mode: ModeId | null;
  modeState: unknown;
  packId: string | null;
  host: HostSay | null;
  /** The VIP's Calm motion switch. Kept across games. */
  calmMotion: boolean;
  /** Host cues raised by the last action; the server drains them after each dispatch. */
  cues: HostCue[];
  phrasebook: Record<string, PhraseEntry[]>;
  recap: { standings: { playerId: string; name: string; score: number }[]; awards: Award[] } | null;
  /** Watching stage screens may run the game too (start, skip, play again). */
  remoteControl: boolean;
}

export interface GameContext {
  now: number;
  content: ContentLibrary;
  newId: () => string;
  random: () => number;
  /** Fixed phase lengths that override every mode's own (tests and bot runs). */
  durations?: Partial<Record<Phase, number>>;
}

export type GameAction =
  | { type: 'join'; playerId: string; name: string; level?: Level }
  | { type: 'release'; playerId: string }
  | { type: 'connection'; playerId: string; connected: boolean }
  | { type: 'command'; actor: Viewer; command: Command }
  | { type: 'timeout'; phaseSeq: number }
  | { type: 'host'; say: HostSay };

export type Outcome = { changed: boolean; error?: string };

const OK: Outcome = { changed: true };
const fail = (error: CommandError | JoinError | string): Outcome => ({ changed: false, error });

export function createGame(code: string): GameState {
  return {
    code,
    phase: 'lobby',
    phaseSeq: 0,
    deadline: null,
    players: [],
    vipId: null,
    mode: null,
    modeState: null,
    packId: null,
    host: null,
    calmMotion: false,
    cues: [],
    phrasebook: {},
    recap: null,
    remoteControl: false,
  };
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);

/** Can a brand-new player take a seat right now? (Rejoining a held seat skips this.) */
export function canJoin(state: GameState, name: string): JoinError | null {
  if (state.phase !== 'lobby' && state.phase !== 'recap') return 'game-in-progress';
  if (state.players.length >= MAX_PLAYERS) return 'room-full';
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'name-taken';
  return null;
}

export function activeMode(state: GameState): Mode<unknown, { mode: ModeId }> | null {
  return state.mode ? (MODES[state.mode] as Mode<unknown, { mode: ModeId }>) : null;
}

export const inGame = (state: GameState): boolean => state.phase !== 'lobby' && state.phase !== 'recap';

/** The context a mode gets for one call. */
export function modeContext(state: GameState, ctx: GameContext): ModeContext {
  const asModePlayer = (p: PlayerState): ModePlayer => p;
  return {
    now: ctx.now,
    content: ctx.content,
    vipId: state.vipId,
    random: ctx.random,
    newId: ctx.newId,
    players: () => state.players.map(asModePlayer),
    player: (id) => state.players.find((p) => p.id === id),
    connected: () => state.players.filter((p) => p.connected),
    award(playerId, points) {
      const p = state.players.find((x) => x.id === playerId);
      if (p) p.score = Math.max(0, p.score + Math.round(points));
    },
    cue(cue) {
      state.cues.push(cue);
    },
    phrase(playerId, entry) {
      const list = (state.phrasebook[playerId] ??= []);
      const existing = list.findIndex((e) => e.itemId === entry.itemId);
      // Keep the most telling outcome: a miss stays a miss even if seen again later.
      if (existing >= 0) {
        const rank = { missed: 3, retry: 2, said: 1, seen: 0 } as const;
        if (rank[entry.outcome] >= rank[list[existing]!.outcome]) list[existing] = entry;
      } else list.push(entry);
    },
  };
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
      const level = isLevel(action.level) ? action.level : 'n5';
      state.players.push({ id: action.playerId, name, seat: lowestFreeSeat(state), level, connected: false, score: 0, mic: null });
      state.players.sort((a, b) => a.seat - b.seat);
      state.vipId ??= action.playerId;
      return OK;
    }
    case 'release': {
      const idx = state.players.findIndex((p) => p.id === action.playerId);
      if (idx < 0) return { changed: false };
      state.players.splice(idx, 1);
      if (state.vipId === action.playerId) state.vipId = state.players[0]?.id ?? null;
      if (inGame(state)) activeMode(state)?.release?.(state.modeState, action.playerId, modeContext(state, ctx));
      if (state.players.length === 0 && state.phase !== 'lobby') resetToLobby(state);
      return OK;
    }
    case 'connection': {
      const p = state.players.find((x) => x.id === action.playerId);
      if (!p || p.connected === action.connected) return { changed: false };
      p.connected = action.connected;
      return OK;
    }
    case 'timeout': {
      if (action.phaseSeq !== state.phaseSeq || state.deadline === null) return { changed: false };
      advance(state, ctx);
      return OK;
    }
    case 'host': {
      if (action.say.phaseSeq !== state.phaseSeq) return { changed: false };
      state.host = action.say;
      return OK;
    }
    case 'command':
      return applyCommand(state, action.actor, action.command, ctx);
  }
}

function applyCommand(state: GameState, actor: Viewer, cmd: Command, ctx: GameContext): Outcome {
  const isStage = actor.kind === 'stage';
  const me = actor.kind === 'player' ? state.players.find((p) => p.id === actor.playerId) : undefined;
  if (!isStage && !me) return fail('not-allowed');
  const isVip = !!me && me.id === state.vipId;

  switch (cmd.type) {
    case 'start': {
      if (state.phase !== 'lobby') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      if (!(MODE_IDS as readonly string[]).includes(cmd.mode)) return fail('unknown-mode');
      const mode = MODES[cmd.mode];
      if (state.players.length < mode.info.minPlayers) return fail('not-enough-players');
      if (state.players.length > mode.info.maxPlayers) return fail('too-many-players');
      state.mode = cmd.mode;
      state.packId = typeof cmd.packId === 'string' ? cmd.packId : null;
      for (const p of state.players) p.score = 0;
      state.phrasebook = {};
      state.recap = null;
      const rounds = Number.isInteger(cmd.rounds) ? cmd.rounds : undefined;
      state.modeState = mode.setup(modeContext(state, ctx), {
        rounds: rounds !== undefined && rounds > 0 && rounds <= 20 ? rounds : mode.info.roundChoices[0],
        packId: state.packId ?? undefined,
        extra: cmd.extra && typeof cmd.extra === 'object' ? cmd.extra : undefined,
      });
      enter(state, 'intro', ctx);
      return OK;
    }
    case 'play': {
      if (!me) return fail('not-allowed');
      const mode = activeMode(state);
      if (!mode || !inGame(state)) return fail('wrong-phase');
      const result = mode.move(state.modeState, state.phase, me.id, cmd.move, modeContext(state, ctx));
      return result.ok ? OK : fail(result.error);
    }
    case 'setLevel': {
      if (!me) return fail('not-allowed');
      if (!isLevel(cmd.level)) return fail('bad-level');
      if (inGame(state)) return fail('wrong-phase');
      if (me.level === cmd.level) return { changed: false };
      me.level = cmd.level;
      return OK;
    }
    case 'micCheck': {
      if (!me) return fail('not-allowed');
      if (inGame(state)) return fail('wrong-phase');
      const host = activeMode(state)?.info.host ?? 'pon';
      // A transcript that sounds like こんにちは passes; anything else, or { quiet: true }, is the quiet path.
      const said = isUtterance(cmd.utterance) && matchesAccepted(utteranceReading(cmd.utterance), ['こんにちは', 'こんにちわ']);
      me.mic = said ? 'ok' : 'quiet';
      state.cues.push({ host, event: said ? 'mic_check_ok' : 'mic_check_quiet', slots: { name: me.name } });
      return OK;
    }
    case 'skip': {
      if (!isVip && !isStage) return fail('not-vip');
      if (cmd.phaseSeq !== state.phaseSeq) return fail('stale-phase');
      if (state.deadline === null) return fail('wrong-phase');
      advance(state, ctx);
      return OK;
    }
    case 'setMotion': {
      if (!isVip && !isStage) return fail('not-vip');
      if (typeof cmd.calm !== 'boolean') return fail('bad-command');
      if (state.calmMotion === cmd.calm) return { changed: false };
      state.calmMotion = cmd.calm;
      return OK;
    }
    case 'playAgain': {
      if (state.phase !== 'recap') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      resetToLobby(state);
      return OK;
    }
    case 'settings': {
      if (!isStage || actor.watch) return fail('not-allowed');
      if (typeof cmd.remoteControl !== 'boolean') return fail('bad-command');
      if (state.remoteControl === cmd.remoteControl) return { changed: false };
      state.remoteControl = cmd.remoteControl;
      return OK;
    }
    default:
      return fail('bad-command');
  }
}

/** Ends the current phase and moves to whatever the mode says comes next. */
function advance(state: GameState, ctx: GameContext): void {
  const mode = activeMode(state);
  if (!mode || !inGame(state)) return;
  const mctx = modeContext(state, ctx);
  mode.leave?.(state.modeState, state.phase, mctx);
  const next = mode.next(state.modeState, state.phase, mctx);
  if (next === 'recap' || next === 'lobby') finish(state, ctx);
  else enter(state, next, ctx);
}

/** Ends phases early while the mode says everyone is in. */
function settle(state: GameState, ctx: GameContext): void {
  for (let guard = 0; guard < 32; guard++) {
    const mode = activeMode(state);
    if (!mode || !inGame(state) || !mode.done?.(state.modeState, state.phase, modeContext(state, ctx))) return;
    advance(state, ctx);
  }
}

function enter(state: GameState, phase: Phase, ctx: GameContext): void {
  const mode = activeMode(state)!;
  state.phase = phase;
  state.phaseSeq += 1;
  state.host = null;
  const mctx = modeContext(state, ctx);
  mode.enter(state.modeState, phase, mctx);
  const ms = ctx.durations?.[phase] ?? mode.duration(state.modeState, phase, mctx);
  state.deadline = ctx.now + Math.max(0, ms);
}

function finish(state: GameState, ctx: GameContext): void {
  const mode = activeMode(state);
  state.phase = 'recap';
  state.phaseSeq += 1;
  state.deadline = null;
  state.host = null;
  state.recap = {
    standings: [...state.players]
      .sort((a, b) => b.score - a.score || a.seat - b.seat)
      .map((p) => ({ playerId: p.id, name: p.name, score: p.score })),
    awards: mode?.awards?.(state.modeState, modeContext(state, ctx)) ?? [],
  };
  if (mode) state.cues.push({ host: mode.info.host, event: 'recap_award' });
}

function resetToLobby(state: GameState): void {
  state.phase = 'lobby';
  state.phaseSeq += 1;
  state.deadline = null;
  state.modeState = null;
  state.host = null;
  state.recap = null;
}

function lowestFreeSeat(state: GameState): number {
  for (let seat = 1; ; seat++) if (!state.players.some((p) => p.seat === seat)) return seat;
}
