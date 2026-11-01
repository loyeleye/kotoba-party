// Mixed rooms: the recap's one-tap "was there a part of that game where you were just waiting?" and the phase log
// (docs/n4-hard-roles.md). Asked only after a game that offered a hard role.
import { afterEach, describe, expect, it } from 'vitest';
import { MODES } from '../shared/src/modes/registry.js';
import { apply, createGame, isMixedRoom, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import { EMPTY_CONTENT } from '../shared/src/modes/mode.js';
import type { Command } from '../shared/src/protocol.js';
import type { Level } from '../content/src/types.js';
import { viewFor } from '../shared/src/view.js';
import { withExperiments } from '../shared/src/modes/experiments.js';

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

function playToRecap(levels: Level[], again?: GameState): GameState {
  now = 1_000;
  const s = again ?? createGame('BCDF');
  if (again) cmd(s, { kind: 'stage' }, { type: 'playAgain' });
  else
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

// The debug mode has no hard role; give it one offer to p1 so the check runs.
const withOffers = (on: boolean) => {
  (MODES.debug as { offers?: unknown }).offers = on ? (_s: unknown, id: string) => (id === 'p1' ? [{ role: 'debug:role', answer: 'accepted' }] : []) : undefined;
};

describe('mixed-room check', () => {
  afterEach(() => withOffers(false));

  it('a mixed room is N4 plus anyone below it', () => {
    expect(isMixedRoom(['n4', 'kana'])).toBe(true);
    expect(isMixedRoom(['n4', 'n4'])).toBe(false);
    expect(isMixedRoom(['n5', 'kana'])).toBe(false);
  });

  it('logs each phase and asks players below N4 once, on the recap', () => {
    withOffers(true);
    const s = playToRecap(['n4', 'n5', 'kana']);
    const mixed = s.recap!.mixed!;
    expect(mixed.phases.length).toBeGreaterThan(2);
    expect(mixed.phases.every((p) => p.ms === 2_000)).toBe(true);
    expect(mixed.ask).toEqual(['p2', 'p3']);
    expect(mixed.levels).toEqual({ p1: 'n4', p2: 'n5', p3: 'kana' });
    expect(mixed.offers).toEqual({ accepted: 1, declined: 0, timeout: 0 });
    expect(viewFor(s, as('p1'), ctx().content).recap!.waitCheck).toBeNull();
    expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: null });
    expect(cmd(s, as('p1'), { type: 'waitCheck', answer: 'yes' }).changed).toBe(false);
    expect(cmd(s, as('p2'), { type: 'waitCheck', answer: 'bit' }).changed).toBe(true);
    expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: 'bit' });
    expect(cmd(s, as('p3'), { type: 'waitCheck', answer: 'maybe' as never }).changed).toBe(false);
    // Nobody's answers or the phase log reach any screen.
    expect(JSON.stringify(viewFor(s, { kind: 'stage' }, ctx().content))).not.toContain('"mixed"');
  });

  it('asks nothing after a mixed-room game that offered no hard role', () => {
    expect(playToRecap(['n4', 'n5']).recap!.mixed).toBeUndefined();
  });

  it('asks nothing in a room without an N4 player', () => {
    withOffers(true);
    const s = playToRecap(['n5', 'kana']);
    expect(s.recap!.mixed).toBeUndefined();
    expect(viewFor(s, as('p1'), ctx().content).recap!.waitCheck).toBeNull();
    expect(cmd(s, as('p1'), { type: 'waitCheck', answer: 'no' }).changed).toBe(false);
  });

  describe('waitCheckFirstTwo', () => {
    it('on: asks on the 1st and 3rd qualifying recaps of a night; the others log phases with nobody asked', () => {
      const restore = withExperiments({ waitCheckFirstTwo: true });
      try {
        withOffers(true);
        const s = playToRecap(['n4', 'n5']);
        expect(s.recap!.mixed!.ask).toEqual(['p2']);
        expect(s.recap!.mixed!.nth).toBe(1);
        // A game that offered no role doesn't count.
        withOffers(false);
        playToRecap([], s);
        expect(s.recap!.mixed).toBeUndefined();
        withOffers(true);
        playToRecap([], s);
        const second = s.recap!.mixed!;
        expect(second.nth).toBe(2);
        expect(second.ask).toEqual([]);
        expect(second.phases.length).toBeGreaterThan(2);
        expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toBeNull();
        expect(cmd(s, as('p2'), { type: 'waitCheck', answer: 'no' }).changed).toBe(false);
        playToRecap([], s);
        expect(s.recap!.mixed!.nth).toBe(3);
        expect(s.recap!.mixed!.ask).toEqual(['p2']);
        expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: null });
        playToRecap([], s);
        expect(s.recap!.mixed!.nth).toBe(4);
        expect(s.recap!.mixed!.ask).toEqual([]);
        // A new room starts the count again.
        expect(playToRecap(['n4', 'n5']).recap!.mixed!.ask).toEqual(['p2']);
      } finally {
        restore();
      }
    });

    it('off: asks on every qualifying recap, as before', () => {
      const restore = withExperiments({ waitCheckFirstTwo: false });
      try {
        withOffers(true);
        const s = playToRecap(['n4', 'kana']);
        for (let i = 0; i < 3; i++) playToRecap([], s);
        expect(s.recap!.mixed!.nth).toBe(4);
        expect(s.recap!.mixed!.ask).toEqual(['p2']);
        expect(viewFor(s, as('p2'), ctx().content).recap!.waitCheck).toEqual({ answer: null });
      } finally {
        restore();
      }
    });
  });
});
