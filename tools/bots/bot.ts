// Headless bot players. They use the same RoomClient as the real phone controller,
// so a bot exercises exactly the code path a phone does: HTTP join, WebSocket push, HTTP commands.

import { RoomClient, joinRoom, newCommandId, type CommandBody } from '../../shared/src/client.js';
import type { DebugView } from '../../shared/src/modes/debug/debug.js';
import type { CommandResult, ModeId, RoomView } from '../../shared/src/protocol.js';

/**
 * What a bot does in each phase. `turn` is the room's phaseSeq when the bot acts: unique per
 * phase and the same on every run, so a scripted run is repeatable.
 */
export interface BotScript {
  /** Sit this answer phase out (forces the phase timer path). */
  skipAnswer(turn: number, seat: number): boolean;
  /** Sit this vote out. */
  skipVote(turn: number, seat: number): boolean;
  /** Fire the same command twice at once with one id (a retried request). */
  duplicate(turn: number, seat: number): boolean;
  /** Lose signal mid-answer and come back after this many ms, or 0 for no drop. */
  dropMs(turn: number, seat: number): number;
  /** Pick a vote from the answers this bot may vote for. */
  pickVote(turn: number, seat: number, options: string[]): string;
  /** Think time before acting. */
  delayMs(turn: number, seat: number): number;
}

export const politeScript: BotScript = {
  skipAnswer: () => false,
  skipVote: () => false,
  duplicate: () => false,
  dropMs: () => 0,
  pickVote: (turn, seat, options) => options[(turn * 31 + seat * 7) % options.length]!,
  delayMs: (turn, seat) => 300 + ((turn * 13 + seat * 29) % 1200),
};

/**
 * How a bot plays a real mode. Called on every state the bot receives; return the moves
 * to make now. Each move carries a key, and the bot sends a given key only once, so a
 * policy can be written as "what should I do in this state" without tracking history.
 */
export interface ModePolicy {
  act(view: RoomView, playerId: string): { key: string; move: unknown; delayMs?: number }[];
}

export interface VoteRecord {
  /** phaseSeq of the reveal phase the vote was cast in */
  revealSeq: number;
  answerId: string;
}

export interface BotOptions {
  baseUrl: string;
  code: string;
  name: string;
  script?: BotScript;
  /** Play a real mode with this policy instead of the debug script. */
  policy?: ModePolicy;
  level?: 'kana' | 'n5' | 'n4' | 'n3';
  deviceId?: string;
  /** Join in quiet mode (mic off), as the lobby's "I can't talk right now". */
  quiet?: boolean;
  /** Join with phone sound off. */
  soundOff?: boolean;
  /** Called for every state the bot accepts (after version filtering). */
  onState?: (bot: Bot, view: RoomView, v: number) => void;
}

export class Bot {
  readonly name: string;
  readonly playerId: string;
  readonly token: string;
  readonly client: RoomClient;
  /** Votes the server accepted, one per round at most. */
  readonly votes: VoteRecord[] = [];
  /** Commands that came back with an error we did not expect. */
  readonly unexpected: { turn: number; cmd: string; error: string }[] = [];
  answersSent = 0;
  drops = 0;

  private readonly script: BotScript;
  private readonly opts: BotOptions;
  private actedSeq = -1;
  private stopped = false;
  private readonly sentKeys = new Set<string>();
  /** Moves the server accepted / refused, for tests. */
  readonly moves: { key: string; ok: boolean; error?: string }[] = [];

  private constructor(opts: BotOptions, playerId: string, token: string) {
    this.opts = opts;
    this.name = opts.name;
    this.playerId = playerId;
    this.token = token;
    this.script = opts.script ?? politeScript;
    this.client = new RoomClient({
      baseUrl: opts.baseUrl,
      code: opts.code,
      token,
      onState: (view, v) => {
        opts.onState?.(this, view, v);
        this.react(view);
      },
    });
  }

  static async join(opts: BotOptions): Promise<Bot> {
    const res = await joinRoom(opts.baseUrl, opts.code, { name: opts.name, level: opts.level, deviceId: opts.deviceId ?? `bot-${opts.name}` });
    if ('error' in res) throw new Error(`${opts.name} could not join ${opts.code}: ${res.error}`);
    const bot = new Bot(opts, res.playerId, res.token);
    bot.client.connect();
    if (opts.quiet) await bot.client.send({ type: 'micCheck', utterance: { via: 'tap', text: '' } });
    if (opts.soundOff) await bot.client.send({ type: 'setSound', on: false });
    return bot;
  }

  get seat(): number {
    return this.client.view?.players.find((p) => p.id === this.playerId)?.seat ?? 0;
  }

  stop(): void {
    this.stopped = true;
    this.client.close();
  }

  private react(view: RoomView): void {
    if (this.stopped) return;
    if (this.opts.policy) return this.reactWithPolicy(view, this.opts.policy);
    if (view.phaseSeq === this.actedSeq) return;
    if (view.phase !== 'answer' && view.phase !== 'reveal') return;
    this.actedSeq = view.phaseSeq;
    const turn = view.phaseSeq;
    const seat = this.seat;
    setTimeout(() => void this.act(view.phase, turn, view.round, seat), this.script.delayMs(turn, seat));
  }

  private reactWithPolicy(view: RoomView, policy: ModePolicy): void {
    for (const { key, move, delayMs } of policy.act(view, this.playerId)) {
      const fullKey = `${view.phaseSeq}:${key}`;
      if (this.sentKeys.has(fullKey)) continue;
      this.sentKeys.add(fullKey);
      setTimeout(() => {
        if (this.stopped) return;
        void this.client.send({ type: 'play', move }).then(
          (r) => this.moves.push({ key: fullKey, ok: r.ok, error: r.ok ? undefined : r.error }),
          () => this.moves.push({ key: fullKey, ok: false, error: 'network' }),
        );
      }, delayMs ?? 0);
    }
  }

  private async act(phase: RoomView['phase'], phaseSeq: number, round: number, seat: number): Promise<void> {
    const turn = phaseSeq;
    if (this.stopped || this.client.view?.phaseSeq !== phaseSeq) return;

    if (phase === 'answer') {
      const drop = this.script.dropMs(turn, seat);
      if (drop > 0) {
        this.drops += 1;
        this.client.drop();
        setTimeout(() => !this.stopped && this.client.reconnectNow(), drop);
        return;
      }
      if (this.script.skipAnswer(turn, seat)) return;
      const result = await this.sendScripted({ type: 'play', move: { kind: 'answer', text: `${this.name}の答え ${round}` } }, turn, seat);
      if (result.ok) this.answersSent += 1;
      return;
    }

    if (phase === 'reveal') {
      if (this.script.skipVote(turn, seat)) return;
      const game = this.client.view?.game as DebugView | null;
      if (!game) return;
      const options = game.reveal.map((a) => a.id).filter((id) => id !== game.mine?.answerId);
      if (options.length === 0) return;
      const answerId = this.script.pickVote(turn, seat, options);
      const result = await this.sendScripted({ type: 'play', move: { kind: 'vote', answerId } }, turn, seat);
      if (result.ok) this.votes.push({ revealSeq: phaseSeq, answerId });
    }
  }

  private async sendScripted(body: CommandBody, turn: number, seat: number): Promise<CommandResult> {
    const id = newCommandId();
    const sends = this.script.duplicate(turn, seat) ? [this.client.send(body, id), this.client.send(body, id)] : [this.client.send(body, id)];
    const results = await Promise.all(sends);
    const first = results[0]!;
    // A retried id must get the very same answer back.
    if (results.some((r) => r.ok !== first.ok || r.v !== first.v)) {
      this.unexpected.push({ turn, cmd: body.type, error: 'duplicate-mismatch' });
    }
    // Losing a race with the phase timer is normal; anything else is a bug.
    if (!first.ok && first.error !== 'wrong-phase') this.unexpected.push({ turn, cmd: body.type, error: first.error });
    return first;
  }
}

/**
 * Runs the room from the stage seat: starts games and votes to play again, so bots can play
 * many games back to back.
 */
export class Director {
  roundsPlayed = 0;
  gamesStarted = 0;
  readonly client: RoomClient;
  private lastSeq = -1;
  private startedForSeq = -1;
  private readonly opts: { players: number; roundsPerGame: number; totalRounds: number; mode?: ModeId; packId?: string; games?: number; onDone?: () => void };

  constructor(
    baseUrl: string,
    code: string,
    stageToken: string,
    opts: {
      players: number;
      roundsPerGame: number;
      totalRounds: number;
      mode?: ModeId;
      packId?: string;
      /** Stop after this many whole games instead of counting rounds (for real modes). */
      games?: number;
      onDone?: () => void;
      onState?: (view: RoomView, v: number) => void;
    },
  ) {
    this.opts = opts;
    this.client = new RoomClient({
      baseUrl,
      code,
      token: stageToken,
      onState: (view, v) => {
        opts.onState?.(view, v);
        this.react(view);
      },
    });
  }

  start(): void {
    this.client.connect();
  }

  gamesPlayed = 0;

  get done(): boolean {
    if (this.opts.games !== undefined) return this.gamesPlayed >= this.opts.games;
    return this.roundsPlayed >= this.opts.totalRounds;
  }

  private react(view: RoomView): void {
    if (view.phaseSeq === this.lastSeq && view.phase !== 'lobby') return;
    const enteredPhase = view.phaseSeq !== this.lastSeq;
    this.lastSeq = view.phaseSeq;

    if (enteredPhase && view.phase === 'score') this.roundsPlayed += 1;

    if (view.phase === 'lobby') {
      const ready = view.players.filter((p) => p.connected).length >= this.opts.players;
      if (ready && !this.done && this.startedForSeq !== view.phaseSeq) {
        const seq = view.phaseSeq;
        this.startedForSeq = seq;
        const rounds = Math.min(this.opts.roundsPerGame, this.opts.totalRounds - this.roundsPlayed);
        void this.client.send({ type: 'start', mode: this.opts.mode ?? 'debug', rounds, packId: this.opts.packId }).then((r) => {
          if (r.ok) this.gamesStarted += 1;
          else if (this.startedForSeq === seq) this.startedForSeq = -1;
        });
      }
    } else if (enteredPhase && view.phase === 'recap') {
      this.gamesPlayed += 1;
      if (this.done) this.opts.onDone?.();
      else void this.client.send({ type: 'playAgain' });
    }
  }
}
