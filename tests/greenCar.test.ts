import { describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, modeContext, type GameAction, type GameContext } from '../shared/src/game.js';
import { allN4Up, greenCarFor } from '../shared/src/greenCar.js';
import type { Command } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { content } from './helpers.js';

describe('Green Car switch', () => {
  it('is usable only when everyone is N4 or N3', () => {
    expect(allN4Up([])).toBe(false);
    expect(allN4Up([{ level: 'n4' }, { level: 'n3' }])).toBe(true);
    expect(allN4Up([{ level: 'n4' }, { level: 'n5' }])).toBe(false);
  });

  it('defaults on when never set, and stays off once switched off', () => {
    const n4 = [{ level: 'n4' as const }, { level: 'n3' as const }];
    expect(greenCarFor(null, n4)).toBe(true);
    expect(greenCarFor(true, n4)).toBe(true);
    expect(greenCarFor(false, n4)).toBe(false);
    expect(greenCarFor(true, [...n4, { level: 'kana' as const }])).toBe(false);
  });
});

describe('Green Car in a room', () => {
  let ids = 0;
  const gctx = (): GameContext => ({ now: 1_000_000, content, newId: () => `id${++ids}`, random: () => 0 });
  const stage = { kind: 'stage' } as const;

  function room(levels: Level[]) {
    const s = createGame('GRNC');
    const act = (a: GameAction) => apply(s, a, gctx());
    let n = 0;
    const cmd = (command: CommandBody) => apply(s, { type: 'command', actor: stage, command: { ...command, id: `c${++n}` } as Command }, gctx());
    levels.forEach((level, i) => {
      act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level });
      act({ type: 'connection', playerId: `p${i}`, connected: true });
    });
    return { s, cmd, end: () => cmd({ type: 'endGame' }) };
  }

  it('turns on by itself the first time everyone is N4+, and stays off once the stage turns it off', () => {
    const r = room(['n4', 'n3', 'n4']);
    expect(viewFor(r.s, stage, content).greenCar).toEqual({ setting: null, eligible: true, on: true });
    r.cmd({ type: 'start', mode: 'ghost-hotline' });
    expect(r.s.greenCar).toBe(true);
    expect(r.s.greenCarOn).toBe(true);
    expect(modeContext(r.s, gctx()).greenCar).toBe(true);
    r.end();
    expect(r.cmd({ type: 'settings', greenCar: false }).changed).toBe(true);
    r.cmd({ type: 'start', mode: 'ghost-hotline' });
    expect(r.s.greenCarOn).toBe(false);
  });

  it('stays off with a Kana or N5 player aboard, even when switched on', () => {
    const r = room(['n4', 'n5', 'n3']);
    r.cmd({ type: 'settings', greenCar: true });
    expect(viewFor(r.s, stage, content).greenCar).toEqual({ setting: true, eligible: false, on: false });
    r.cmd({ type: 'start', mode: 'ghost-hotline' });
    expect(r.s.greenCarOn).toBe(false);
    expect(modeContext(r.s, gctx()).greenCar).toBe(false);
  });

  it('changes only between games, and only from the main stage', () => {
    const r = room(['n4', 'n4', 'n3']);
    r.cmd({ type: 'start', mode: 'ghost-hotline' });
    expect(r.cmd({ type: 'settings', greenCar: false }).error).toBe('wrong-phase');
    const vip = apply(r.s, { type: 'command', actor: { kind: 'player', playerId: 'p0' }, command: { id: 'x1', type: 'settings', greenCar: false } as Command }, gctx());
    expect(vip.error).toBe('not-allowed');
  });
});
