// Plays one game of a real mode in-process, with the bot policies at every seat, and returns each seat's
// GameResult: the same phrasebook a real room saves to a player's profile. No server, no clock: the game's
// timers are stepped through as fast as they fire.

import type { Level } from '../../content/src/types.js';
import type { CommandBody } from '../../shared/src/client.js';
import { apply, createGame, gameResults, wakeAt, type GameAction, type GameContext, type GameState } from '../../shared/src/game.js';
import type { ContentLibrary } from '../../shared/src/modes/mode.js';
import type { Audience, Command, ModeId } from '../../shared/src/protocol.js';
import type { GameResult } from '../../shared/src/progress.js';
import { viewFor } from '../../shared/src/view.js';
import { policyMaker } from '../bots/policies/index.js';

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlayedGame {
  mode: ModeId;
  /** Seat id → its level and result. */
  seats: { id: string; level: Level; result: GameResult }[];
  /** How long the game ran on its own clock. */
  ms: number;
}

/** The room's settings for a game: the Audience (default family) and the Green Car switch (default: the game's
 *  own rule, on by itself when every seat is N4+). Asking for the Green Car in a room with a Kana or N5 seat throws. */
export interface PlayOptions {
  audience?: Audience;
  greenCar?: boolean;
}

/** Plays `mode` once with these seat levels. Throws if the game doesn't reach its recap. */
export function playGame(content: ContentLibrary, mode: ModeId, levels: readonly Level[], seed: number, at = 1_000_000, opts: PlayOptions = {}): PlayedGame {
  const random = mulberry(seed);
  const s: GameState = createGame('SIMS');
  if (opts.audience) s.audience = opts.audience;
  if (opts.greenCar !== undefined) s.greenCar = opts.greenCar;
  let now = at;
  let ids = 0;
  let cmdId = 0;
  const ctx = (): GameContext => ({ now, content, newId: () => `id${++ids}`, random });
  const act = (a: GameAction) => apply(s, a, ctx());
  const cmd = (actor: string | 'stage', command: CommandBody) =>
    act({ type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++cmdId}` } as Command });
  levels.forEach((level, i) => {
    act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  const make = policyMaker(() => content, { thinkMs: 0, speak: true });
  const policies = new Map(s.players.map((p, i) => [p.id, make(i + 1, mode)]));
  const started = cmd('stage', { type: 'start', mode });
  if (!started.changed) throw new Error(`${mode}: could not start (${JSON.stringify(started)})`);
  if (opts.greenCar !== undefined && s.greenCarOn !== opts.greenCar) throw new Error(`${mode}: the Green Car is ${s.greenCarOn ? 'on' : 'off'} in a ${levels.join(',')} room`);
  const t0 = now;
  for (let i = 0; i < 20_000 && (s.phase as string) !== 'recap'; i++) {
    // Bots move until nothing changes; a new phase gets its own turn at the bots before any timer fires.
    const seqAtStart = s.phaseSeq;
    for (let pass = 0; pass < 4; pass++) {
      const before = s.phaseSeq;
      let moved = false;
      for (const p of s.players) {
        const view = viewFor(s, { kind: 'player', playerId: p.id }, content);
        for (const a of policies.get(p.id)?.act(view, p.id) ?? []) {
          const r = cmd(p.id, { type: "play", move: a.move } as CommandBody);
          if (process.env.SIM_DEBUG && r.error) console.error(mode, p.id, s.phase, JSON.stringify(a.move).slice(0, 80), r.error);
          moved ||= !!r.changed;
        }
        if (s.phaseSeq !== before) break;
      }
      if (s.phaseSeq !== before || !moved) break;
    }
    if ((s.phase as string) === 'recap') break;
    if (s.phaseSeq !== seqAtStart) continue;
    const w = wakeAt(s, ctx());
    const d = s.deadline;
    if (w !== null && (d === null || w < d)) {
      now = Math.max(now, w);
      act({ type: 'wake', phaseSeq: s.phaseSeq });
    } else {
      now = Math.max(now, d ?? now + 1000);
      act({ type: 'timeout', phaseSeq: s.phaseSeq });
    }
  }
  if ((s.phase as string) !== 'recap') throw new Error(`${mode}: never reached the recap`);
  const results = gameResults(s, now);
  return { mode, ms: now - t0, seats: s.players.map((p) => ({ id: p.id, level: p.level as Level, result: results.get(p.id)! })) };
}
