import { randomBytes } from 'node:crypto';
import { SEAT_HOLD_MS } from '../../shared/src/constants.js';
import { apply, canJoin, cleanName, createGame, type GameAction, type GameState, type Outcome } from '../../shared/src/game.js';
import type { ContentLibrary, HostCue } from '../../shared/src/modes/mode.js';
import type {
  ByeReason,
  Command,
  CommandResult,
  HostSay,
  JoinError,
  JoinRequest,
  JoinResponse,
  Phase,
  ServerMessage,
  Viewer,
} from '../../shared/src/protocol.js';
import { CLOSE } from '../../shared/src/protocol.js';
import { viewFor } from '../../shared/src/view.js';
import type { Clock } from './clock.js';

/** The slice of a WebSocket a room needs. Keeps rooms testable without a network. */
export interface RoomSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
}

export interface RoomOptions {
  code: string;
  clock: Clock;
  content: ContentLibrary;
  /** Fixed phase lengths overriding every mode's own (tests, fast bot runs). */
  durations?: Partial<Record<Phase, number>>;
  seatHoldMs?: number;
  /** Close the room after this long with nobody connected. */
  idleMs?: number;
  random?: () => number;
  onClose?: (room: Room) => void;
  /** Called after every state change, with the new version. Tests use it to record what each viewer should see. */
  onCommit?: (room: Room, version: number) => void;
  /** Host cues raised by game rules, for the host pipeline to voice. It answers through `room.say`. */
  onCues?: (room: Room, cues: HostCue[], phaseSeq: number) => void;
  onPhase?: (room: Room) => void;
}

const COMMAND_TYPES = new Set<Command['type']>(['start', 'play', 'setLevel', 'micCheck', 'skip', 'playAgain']);
const COMMAND_MEMORY = 128;

export const newToken = (): string => randomBytes(18).toString('base64url');
const newId = (): string => randomBytes(6).toString('base64url');

/**
 * One room: the only writer of its game state (ADR 0001). Everything that changes the
 * state goes through `dispatch`, which runs synchronously, so two commands arriving in
 * the same millisecond are applied one after the other, each exactly once.
 */
export class Room {
  readonly code: string;
  readonly state: GameState;
  version = 0;
  closed = false;

  private readonly clock: Clock;
  private readonly opts: RoomOptions;
  private readonly seatHoldMs: number;
  private readonly tokens = new Map<string, Viewer>();
  private readonly playerTokens = new Map<string, string>();
  private readonly devices = new Map<string, string>();
  private readonly sockets = new Map<RoomSocket, Viewer>();
  private readonly holdTimers = new Map<string, unknown>();
  private readonly releasedTokens = new Set<string>();
  private readonly commandLog = new Map<string, Map<string, CommandResult>>();
  private phaseTimer: unknown = null;
  private timedPhaseSeq = -1;
  private idleTimer: unknown = null;

  constructor(opts: RoomOptions) {
    this.opts = opts;
    this.code = opts.code;
    this.clock = opts.clock;
    this.seatHoldMs = opts.seatHoldMs ?? SEAT_HOLD_MS;
    this.state = createGame(opts.code);
    this.armIdleTimer();
  }

  createStageToken(): string {
    const token = newToken();
    this.tokens.set(token, { kind: 'stage' });
    return token;
  }

  viewerFor(token: string): Viewer | undefined {
    return this.tokens.get(token);
  }

  /** True for a token whose seat was held for the full hold time and then given up. */
  wasReleased(token: string): boolean {
    return this.releasedTokens.has(token);
  }

  /** Joins a new player, or hands a held seat back to the phone that had it. */
  join(req: JoinRequest): JoinResponse | { error: JoinError } {
    const held = this.findHeldSeat(req);
    if (held) return { playerId: held, token: this.playerTokens.get(held)!, rejoined: true };

    const name = cleanName(req.name);
    if (!name) return { error: 'bad-name' };
    const err = canJoin(this.state, name);
    if (err) return { error: err };

    const playerId = newId();
    const outcome = this.dispatch({ type: 'join', playerId, name, level: req.level });
    if (!outcome.changed) return { error: (outcome.error as JoinError) ?? 'bad-name' };

    const token = newToken();
    this.tokens.set(token, { kind: 'player', playerId });
    this.playerTokens.set(playerId, token);
    if (req.deviceId) this.devices.set(req.deviceId, playerId);
    // The seat is held from the moment of joining until the phone's socket arrives.
    this.armHoldTimer(playerId);
    return { playerId, token, rejoined: false };
  }

  private findHeldSeat(req: JoinRequest): string | undefined {
    const byToken = req.token ? this.tokens.get(req.token) : undefined;
    if (byToken?.kind === 'player' && this.seated(byToken.playerId)) return byToken.playerId;
    const byDevice = req.deviceId ? this.devices.get(req.deviceId) : undefined;
    if (byDevice && this.seated(byDevice)) return byDevice;
    return undefined;
  }

  private seated(playerId: string): boolean {
    return this.state.players.some((p) => p.id === playerId);
  }

  /** A host line from the host pipeline. Ignored if the phase it was made for has passed. */
  say(line: HostSay): void {
    this.dispatch({ type: 'host', say: line });
  }

  /** Attaches a pushed-to socket. Returns false when the token does not belong to this room. */
  attach(token: string, socket: RoomSocket): boolean {
    const viewer = this.tokens.get(token);
    if (!viewer || this.closed) return false;

    if (viewer.kind === 'player') {
      // One phone per seat: a reloaded page replaces its older, possibly half-dead socket.
      for (const [other, v] of this.sockets) {
        if (v.kind === 'player' && v.playerId === viewer.playerId) {
          this.sockets.delete(other);
          bye(other, 'replaced', 1000);
        }
      }
      this.cancelHoldTimer(viewer.playerId);
    }
    this.sockets.set(socket, viewer);
    this.cancelIdleTimer();

    // A reconnecting phone just takes the latest state: that is the whole reconnect story (ADR 0002).
    // If marking the seat connected changed the state, the broadcast already sent it.
    const changed =
      viewer.kind === 'player' && this.dispatch({ type: 'connection', playerId: viewer.playerId, connected: true }).changed;
    if (!changed) this.sendState(socket, viewer);
    return true;
  }

  detach(socket: RoomSocket): void {
    const viewer = this.sockets.get(socket);
    if (!viewer) return;
    this.sockets.delete(socket);
    if (viewer.kind === 'player' && !this.hasSocket(viewer.playerId)) {
      this.armHoldTimer(viewer.playerId);
      this.dispatch({ type: 'connection', playerId: viewer.playerId, connected: false });
    }
    if (this.sockets.size === 0) this.armIdleTimer();
  }

  /** Runs one HTTP command. Returns null for a token this room does not know. */
  command(token: string, raw: unknown): CommandResult | null {
    const viewer = this.tokens.get(token);
    if (!viewer) return null;
    const cmd = parseCommand(raw);
    if (!cmd) return { ok: false, error: 'bad-command', v: this.version };

    const actorKey = viewer.kind === 'player' ? viewer.playerId : `stage:${token}`;
    let log = this.commandLog.get(actorKey);
    if (!log) this.commandLog.set(actorKey, (log = new Map()));
    const earlier = log.get(cmd.id);
    if (earlier) return earlier;

    const outcome = this.dispatch({ type: 'command', actor: viewer, command: cmd });
    const result: CommandResult = outcome.changed
      ? { ok: true, v: this.version }
      : { ok: false, error: outcome.error ?? 'bad-command', v: this.version };
    log.set(cmd.id, result);
    if (log.size > COMMAND_MEMORY) log.delete(log.keys().next().value!);
    return result;
  }

  get connectionCount(): number {
    return this.sockets.size;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const socket of this.sockets.keys()) bye(socket, 'room-closed', CLOSE.roomGone);
    this.sockets.clear();
    for (const t of this.holdTimers.values()) this.clock.clearTimeout(t);
    this.holdTimers.clear();
    this.clock.clearTimeout(this.phaseTimer);
    this.cancelIdleTimer();
    this.opts.onClose?.(this);
  }

  private dispatch(action: GameAction): Outcome {
    if (this.closed) return { changed: false };
    const outcome = apply(this.state, action, {
      now: this.clock.now(),
      durations: this.opts.durations,
      content: this.opts.content,
      newId,
      random: this.opts.random ?? Math.random,
    });
    const cues = this.state.cues.splice(0);
    const phaseBefore = this.timedPhaseSeq;
    if (outcome.changed) {
      this.version += 1;
      this.schedulePhaseTimer();
      this.opts.onCommit?.(this, this.version);
      this.broadcast();
    }
    if (outcome.changed && this.state.phaseSeq !== phaseBefore) this.opts.onPhase?.(this);
    if (cues.length) this.opts.onCues?.(this, cues, this.state.phaseSeq);
    return outcome;
  }

  private schedulePhaseTimer(): void {
    const { phaseSeq, deadline } = this.state;
    if (phaseSeq === this.timedPhaseSeq) return;
    this.clock.clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    this.timedPhaseSeq = phaseSeq;
    if (deadline === null) return;
    this.phaseTimer = this.clock.setTimeout(() => {
      this.phaseTimer = null;
      this.dispatch({ type: 'timeout', phaseSeq });
    }, deadline - this.clock.now());
  }

  private broadcast(): void {
    const cache = new Map<string, string>();
    for (const [socket, viewer] of this.sockets) {
      const key = viewer.kind === 'stage' ? 'stage' : viewer.playerId;
      let msg = cache.get(key);
      if (!msg) cache.set(key, (msg = this.stateMessage(viewer)));
      safeSend(socket, msg);
    }
  }

  private sendState(socket: RoomSocket, viewer: Viewer): void {
    safeSend(socket, this.stateMessage(viewer));
  }

  private stateMessage(viewer: Viewer): string {
    const msg: ServerMessage = { type: 'state', v: this.version, now: this.clock.now(), view: this.viewFor(viewer) };
    return JSON.stringify(msg);
  }

  viewFor(viewer: Viewer) {
    return viewFor(this.state, viewer, this.opts.content);
  }

  private hasSocket(playerId: string): boolean {
    for (const v of this.sockets.values()) if (v.kind === 'player' && v.playerId === playerId) return true;
    return false;
  }

  private armHoldTimer(playerId: string): void {
    this.cancelHoldTimer(playerId);
    this.holdTimers.set(
      playerId,
      this.clock.setTimeout(() => this.releaseSeat(playerId), this.seatHoldMs),
    );
  }

  private cancelHoldTimer(playerId: string): void {
    const t = this.holdTimers.get(playerId);
    if (t !== undefined) this.clock.clearTimeout(t);
    this.holdTimers.delete(playerId);
  }

  private releaseSeat(playerId: string): void {
    this.holdTimers.delete(playerId);
    const token = this.playerTokens.get(playerId);
    if (token) {
      this.tokens.delete(token);
      this.releasedTokens.add(token);
    }
    this.playerTokens.delete(playerId);
    for (const [device, id] of this.devices) if (id === playerId) this.devices.delete(device);
    this.commandLog.delete(playerId);
    this.dispatch({ type: 'release', playerId });
  }

  private armIdleTimer(): void {
    this.cancelIdleTimer();
    if (!this.opts.idleMs) return;
    this.idleTimer = this.clock.setTimeout(() => this.close(), this.opts.idleMs);
  }

  private cancelIdleTimer(): void {
    if (this.idleTimer !== null) this.clock.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }
}

function parseCommand(raw: unknown): Command | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || c.id.length === 0 || c.id.length > 64) return null;
  if (typeof c.type !== 'string' || !COMMAND_TYPES.has(c.type as Command['type'])) return null;
  return c as unknown as Command;
}

function safeSend(socket: RoomSocket, data: string): void {
  try {
    socket.send(data);
  } catch {
    // A dying socket; its close handler will detach it.
  }
}

function bye(socket: RoomSocket, reason: ByeReason, code: number): void {
  safeSend(socket, JSON.stringify({ type: 'bye', reason } satisfies ServerMessage));
  try {
    socket.close(code, reason);
  } catch {
    // already closed
  }
}
