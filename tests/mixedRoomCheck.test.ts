// Mixed rooms: the recap's one-tap "did anything feel like waiting?" and the phase log (docs/n4-hard-roles.md).
import { describe, expect, it } from 'vitest';
import { apply, createGame, isMixedRoom, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import { EMPTY_CONTENT } from '../shared/src/modes/mode.js';
import type { Command } from '../shared/src/protocol.js';
import type { Level } from '../content/src/types.js';
import { viewFor } from '../shared/src/view.js';

let now = 0;
let ids = 0;
const ctx = (): GameContext => ({
  now,
  content: { ...EMPTY_CONTENT, debugPrompts: [{ id: 'p1', text: 'prompt one' }, { id: 'p2', text: 'prompt two' }] },
  newId: () => `a${++ids}`,
  random: () => 0.5,
});
let cmdId = 0;
const cmd = (s: GameState, actor: { kind: 'player'; playerId: string } | { kind: 'stage' }, command: CommandBody) =>
  apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, ctx());
const act = (s: GameState, a: GameAction) => apply(s, a, ctx());
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;

function playToRecap(levels: Level[]): GameState {
  now = 1_000;
  const s = createGame('BCDF');
  levels.forEach((level, i) => {
    act(s, { type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
    act(s, { type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  cmd(s, { kind: 'stage' }, { type: 'start', mode: 'debug', rounds: 1 });
  while (s.phase !== 'recap') {
    if (s.phase === 'answer') cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'hi' } });
    now += 2_000;
    act(s, { type: 'timeout', phaseSeq: s.phaseSeq });
  }
  return s;
}

describe('mixed-room check', () => {
  it('a mixed room is N4 plus anyone below it', () => {
    expect(isMixedRoom(['n4', 'kana'])).toBe(true);
    expect(isMixedRoom(['n4', 'n4'])).toBe(false);
    expect(isMixedRoom(['n5', 'kana'])).toBe(false);
  });

  it('logs each phase and asks players below N4 once, on the recap', () => {
    const s = playToRecap(['n4', 'n5', 'kana']);
    const mixed = s.recap!.mixed!;
    expect(mixed.phases.length).toBeGreaterThan(2);
    expect(mixed.phases.every((p) => p.ms === 2_000)).toBe(true);
    expect(mixed.ask).toEqual(['p2', 'p3']);
    expect(viewFor(s, as('p1'), ctx().content).recap!.waitCheck).toBeNull();
    expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: null });
    expect(cmd(s, as('p1'), { type: 'waitCheck', answer: 'yes' }).changed).toBe(false);
    expect(cmd(s, as('p2'), { type: 'waitCheck', answer: 'bit' }).changed).toBe(true);
    expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: 'bit' });
    expect(cmd(s, as('p3'), { type: 'waitCheck', answer: 'maybe' as never }).changed).toBe(false);
    // Nobody's answers or the phase log reach any screen.
    expect(JSON.stringify(viewFor(s, { kind: 'stage' }, ctx().content))).not.toContain('"mixed"');
  });

  it('asks nothing in a room without an N4 player', () => {
    const s = playToRecap(['n5', 'kana']);
    expect(s.recap!.mixed).toBeUndefined();
    expect(viewFor(s, as('p1'), ctx().content).recap!.waitCheck).toBeNull();
    expect(cmd(s, as('p1'), { type: 'waitCheck', answer: 'no' }).changed).toBe(false);
  });
});
