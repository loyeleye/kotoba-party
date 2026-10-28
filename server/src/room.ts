import { randomBytes } from 'node:crypto';
import { SEAT_HOLD_MS } from '../../shared/src/constants.js';
import { apply, wakeAt, canJoin, clipsInUse, cleanName, createGame, gameResults, type GameAction, type GameState, type Outcome, type TonightPhrase } from '../../shared/src/game.js';
import type { GameResult } from '../../shared/src/progress.js';
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
  /**
   * Close the room after this long with no joins or commands, even with screens still
   * connected: a TV left on the stage, or a phone awake on a charger, would otherwise keep it open forever.
   */
  staleMs?: number;
  random?: () => number;
  onClose?: (room: Room) => void;
  /** Called after every state change, with the new version. Tests use it to record what each viewer should see. */
  onCommit?: (room: Room, version: number) => void;
  /** Host cues raised by game rules, for the host pipeline to voice. It answers through `room.say`. */
  onCues?: (room: Room, cues: HostCue[], phaseSeq: number) => void;
  onPhase?: (room: Room) => void;
  /** A game ended: the results of the players who joined signed in, for their saved progress (docs/accounts.md). */
  onResults?: (results: AccountResult[]) => void;
}

/** One signed-in player's finished game, with the account session they joined with. */
export interface AccountResult {
  account: string;
  result: GameResult;
}

const COMMAND_TYPES = new Set<Command['type']>(['start', 'play', 'setLevel', 'micCheck', 'skip', 'playAgain', 'endGame', 'setMotion', 'settings', 'closeRoom']);
/** What a watching screen may send once the main stage turns on remote control. */
const WATCH_COMMANDS = new Set<Command['type']>(['start', 'skip', 'playAgain', 'endGame']);
const COMMAND_MEMORY = 128;
/** Extra stage screens one room hands out: one per player's laptop and then some. */
export const MAX_WATCHERS = 16;

/**
 * Voice clips a mode plays on the TV (Dub Club). Kept in this room's memory only, never written anywhere,
 * served only to the room's own screens, and dropped as soon as the mode stops using them.
 */
export const MAX_KEPT_CLIP_BYTES = 8 * 1024 * 1024;
interface KeptClip {
  owner: string;
  bytes: Uint8Array;
  durMs: number;
}

/** A 16-bit PCM WAV's length in ms, from its header's byte rate. */
export function wavDurationMs(b: Uint8Array): number {
  if (b.length < 44) return 0;
  const byteRate = b[28]! | (b[29]! << 8) | (b[30]! << 16) | (b[31]! << 24);
  return byteRate > 0 ? Math.round(((b.length - 44) / byteRate) * 1000) : 0;
}

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
  /** Signed-in players' account sessions, by player id. Never shown to anyone; only passed back to the account service. */
  private readonly accounts = new Map<string, string>();
  private readonly sockets = new Map<RoomSocket, Viewer>();
  private readonly holdTimers = new Map<string, unknown>();
  private readonly releasedTokens = new Set<string>();
  private readonly commandLog = new Map<string, Map<string, CommandResult>>();
  private readonly clips = new Map<string, KeptClip>();
  private phaseTimer: unknown = null;
  private wakeTimer: unknown = null;
  private wakeAtMs: number | null = null;
  private timedPhaseSeq = -1;
  private idleTimer: unknown = null;
  private staleTimer: unknown = null;

  constructor(opts: RoomOptions) {
    this.opts = opts;
    this.code = opts.code;
    this.clock = opts.clock;
    this.seatHoldMs = opts.seatHoldMs ?? SEAT_HOLD_MS;
    this.state = createGame(opts.code);
    this.armIdleTimer();
    this.armStaleTimer();
  }

  createStageToken(): string {
    const token = newToken();
    this.tokens.set(token, { kind: 'stage' });
    return token;
  }

  /**
   * A token for another stage screen (a remote player's laptop). It gets the stage's view but
   * no say over the game. Null once the room has handed out MAX_WATCHERS of them.
   */
  createWatchToken(): string | null {
    const watching = (): string[] => [...this.tokens].filter(([, v]) => v.kind === 'stage' && v.watch).map(([t]) => t);
    if (watching().length >= MAX_WATCHERS) {
      // Make room by forgetting screens that have closed (their pages would ask again anyway).
      const live = new Set(this.sockets.values());
      for (const t of watching()) if (!live.has(this.tokens.get(t)!)) this.tokens.delete(t);
      if (watching().length >= MAX_WATCHERS) return null;
    }
    const token = newToken();
    this.tokens.set(token, { kind: 'stage', watch: true });
    return token;
  }

  viewerFor(token: string): Viewer | undefined {
    return this.tokens.get(token);
  }

  /** True for a token whose seat was held for the full hold time and then given up. */
  wasReleased(token: string): boolean {
    return this.releasedTokens.has(token);
  }

  /**
   * Keeps a player's recorded clip for the TV to play (Dub Club). Only while the game is on and the mode
   * plays clips; the mode's move then names it by id. Null when not allowed or the room's budget is full.
   */
  keepClip(token: string, bytes: Uint8Array): { clipId: string; durMs: number } | null {
    const viewer = this.tokens.get(token);
    if (viewer?.kind !== 'player' || this.closed || clipsInUse(this.state) === null) return null;
    let used = 0;
    for (const c of this.clips.values()) used += c.bytes.length;
    if (used + bytes.length > MAX_KEPT_CLIP_BYTES) return null;
    const clipId = newToken();
    const durMs = wavDurationMs(bytes);
    this.clips.set(clipId, { owner: viewer.playerId, bytes: new Uint8Array(bytes), durMs });
    return { clipId, durMs };
  }

  /** A kept clip, for the room's main TV only: never a watching screen, which can be anywhere. */
  clipFor(token: string, clipId: string): Uint8Array | null {
    const viewer = this.tokens.get(token);
    if (viewer?.kind !== 'stage' || viewer.watch) return null;
    return this.clips.get(clipId)?.bytes ?? null;
  }

  /** How many clips the room holds (tests). */
  get keptClips(): number {
    return this.clips.size;
  }

  /** Drops every clip the mode no longer plays (all of them once the game is over). */
  private pruneClips(): void {
    if (!this.clips.size) return;
    const keep = clipsInUse(this.state) ?? new Set<string>();
    for (const id of [...this.clips.keys()]) if (!keep.has(id)) this.clips.delete(id);
  }

  /**
   * A move naming a kept clip may only name the sender's own, and its length comes from the clip itself.
   * Anything else is passed on as it is: the mode validates the rest.
   */
  private withClip(viewer: Viewer, cmd: Command): Command {
    if (cmd.type !== 'play' || viewer.kind !== 'player') return cmd;
    const move = (cmd as { move?: unknown }).move;
    if (!move || typeof move !== 'object' || !('clipId' in move)) return cmd;
    const m = move as Record<string, unknown>;
    const clip = typeof m.clipId === 'string' ? this.clips.get(m.clipId) : undefined;
    const own = clip && clip.owner === viewer.playerId;
    return { ...cmd, move: { ...m, clipId: own ? m.clipId : null, ...(own ? { durMs: clip.durMs } : {}) } } as Command;
  }

  /** Joins a new player, or hands a held seat back to the phone that had it. */
  join(req: JoinRequest): JoinResponse | { error: JoinError } {
    this.armStaleTimer();
    const held = this.findHeldSeat(req);
    if (held) {
      this.setAccount(held, req.account);
      return { playerId: held, token: this.playerTokens.get(held)!, rejoined: true };
    }

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
    this.setAccount(playerId, req.account);
    // The seat is held from the moment of joining until the phone's socket arrives.
    this.armHoldTimer(playerId);
    return { playerId, token, rejoined: false };
  }

  /** The seated players who joined signed in, for the stage's Phrasebook. */
  signedIn(): { playerId: string; account: string }[] {
    return [...this.accounts].filter(([id]) => this.seated(id)).map(([playerId, account]) => ({ playerId, account }));
  }

  /**
   * What a screen's Phrasebook may show (GET /api/rooms/:code/phrasebook): the stage sees every phrase
   * tonight and every signed-in player; a phone sees only the phrases its player said or missed, and
   * only its own save. Null for a token that can't look.
   */
  phrasebookFor(token: string): { tonight: TonightPhrase[]; signedIn: { playerId: string; account: string }[] } | null {
    const viewer = this.viewerFor(token);
    if (viewer?.kind === 'stage') return { tonight: this.state.tonight, signedIn: this.signedIn() };
    if (viewer?.kind !== 'player') return null;
    const name = this.state.players.find((p) => p.id === viewer.playerId)?.name;
    if (name === undefined) return null;
    return {
      tonight: this.state.tonight.filter((t) => t.said.includes(name) || t.missed.includes(name)),
      signedIn: this.signedIn().filter((s) => s.playerId === viewer.playerId),
    };
  }

  /** Signing in (or out) between games takes effect from the next one. */
  private setAccount(playerId: string, account: unknown): void {
    if (typeof account === 'string' && account.length > 0 && account.length <= 200) this.accounts.set(playerId, account);
    else this.accounts.delete(playerId);
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

  /**
   * A move the server makes on a player's behalf (the Ink Storm coach's tip on their drawing).
   * Goes through the same dispatch as everything else; the mode decides whether to accept it.
   */
  inject(playerId: string, move: unknown): boolean {
    if (!this.seated(playerId)) return false;
    return this.dispatch({ type: 'command', actor: { kind: 'player', playerId }, command: { id: `server:${newId()}`, type: 'play', move } }).changed;
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
    this.armStaleTimer();
    if (viewer.kind === 'stage' && viewer.watch && !(this.state.remoteControl && WATCH_COMMANDS.has(cmd.type))) return { ok: false, error: 'watch-only', v: this.version };

    const actorKey = viewer.kind === 'player' ? viewer.playerId : `stage:${token}`;
    let log = this.commandLog.get(actorKey);
    if (!log) this.commandLog.set(actorKey, (log = new Map()));
    const earlier = log.get(cmd.id);
    if (earlier) return earlier;

    // Not game state: the room itself ends, so it never reaches the rules.
    if (cmd.type === 'closeRoom') {
      if (viewer.kind !== 'stage' || viewer.watch) return { ok: false, error: 'not-allowed', v: this.version };
      this.close('room-ended');
      return { ok: true, v: this.version };
    }
    const outcome = this.dispatch({ type: 'command', actor: viewer, command: this.withClip(viewer, cmd) });
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

  close(reason: ByeReason = 'room-closed'): void {
    if (this.closed) return;
    this.closed = true;
    for (const socket of this.sockets.keys()) bye(socket, reason, CLOSE.roomGone);
    this.sockets.clear();
    this.clips.clear();
    for (const t of this.holdTimers.values()) this.clock.clearTimeout(t);
    this.holdTimers.clear();
    this.clock.clearTimeout(this.phaseTimer);
    this.clock.clearTimeout(this.wakeTimer);
    this.cancelIdleTimer();
    this.clock.clearTimeout(this.staleTimer);
    this.staleTimer = null;
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
      this.scheduleWakeTimer();
      this.opts.onCommit?.(this, this.version);
      this.broadcast();
    }
    if (outcome.changed && this.state.phaseSeq !== phaseBefore) {
      this.pruneClips();
      this.opts.onPhase?.(this);
      if (this.state.phase === 'recap') this.saveResults();
    }
    if (cues.length) this.opts.onCues?.(this, cues, this.state.phaseSeq);
    return outcome;
  }

  private saveResults(): void {
    if (!this.accounts.size || !this.opts.onResults) return;
    const results: AccountResult[] = [];
    for (const [playerId, result] of gameResults(this.state, this.clock.now())) {
      const account = this.accounts.get(playerId);
      if (account) results.push({ account, result });
    }
    if (results.length) this.opts.onResults(results);
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

  /** A mode's own timed event inside the phase (a customer arriving), re-armed after every change. */
  private scheduleWakeTimer(): void {
    const at = wakeAt(this.state, { now: this.clock.now(), durations: this.opts.durations, content: this.opts.content, newId, random: this.opts.random ?? Math.random });
    if (at === this.wakeAtMs && (at === null || this.wakeTimer !== null)) return;
    this.clock.clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    this.wakeAtMs = at;
    if (at === null) return;
    const phaseSeq = this.state.phaseSeq;
    this.wakeTimer = this.clock.setTimeout(() => {
      this.wakeTimer = null;
      this.wakeAtMs = null;
      this.dispatch({ type: 'wake', phaseSeq });
      // Nothing changed (a stale wake): still look for the next one.
      this.scheduleWakeTimer();
    }, Math.max(0, at - this.clock.now()));
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
    this.accounts.delete(playerId);
    this.commandLog.delete(playerId);
    this.dispatch({ type: 'release', playerId });
  }

  private armIdleTimer(): void {
    this.cancelIdleTimer();
    if (!this.opts.idleMs) return;
    this.idleTimer = this.clock.setTimeout(() => this.close(), this.opts.idleMs);
  }

  private armStaleTimer(): void {
    if (!this.opts.staleMs || this.closed) return;
    if (this.staleTimer !== null) this.clock.clearTimeout(this.staleTimer);
    this.staleTimer = this.clock.setTimeout(() => this.close('room-idle'), this.opts.staleMs);
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
