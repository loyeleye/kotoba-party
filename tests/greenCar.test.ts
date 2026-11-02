import { describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, modeContext, type GameAction, type GameContext } from '../shared/src/game.js';
import { allN4Up, frameNeed, greenCarFor } from '../shared/src/greenCar.js';
import { aimPick, aimWeight } from '../shared/src/modes/aim.js';
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

describe('aim the deal', () => {
  it('favours required frames, and frames said least tonight', () => {
    // rashii is required on 3.1; mitai-casual is only "also counts" there.
    expect(frameNeed({}, ['rashii'])).toBeGreaterThan(frameNeed({}, ['mitai-casual']));
    expect(frameNeed({ rashii: 3 }, ['rashii'])).toBeLessThan(frameNeed({}, ['rashii']));
    const ctx = { frameNeed: (_p: string, f: readonly string[]) => frameNeed({ 'sei-de': 2 }, f) };
    expect(aimPick(['sei-de', 'okage-de'], (f) => aimWeight(ctx, 'p', [f]))).toBe('okage-de');
    expect(aimPick(['sei-de', 'okage-de'], (f) => aimWeight(ctx, 'p', [f], { 'okage-de': 3 }))).toBe('sei-de');
  });

  it('counts a finished game toward tonight, so the next game sees it', () => {
    const r = { s: createGame('AIMS') };
    r.s.saidTonight = { p0: { rashii: 2 } };
    expect(modeContext(r.s, { now: 0, content, newId: () => 'x', random: () => 0 }).frameNeed!('p0', ['rashii'])).toBeCloseTo(2 / 3);
  });
});

describe('Green Car names on the menu', () => {
  it('shows Katsuyō Raid and Frame Concentration only in a Green Car lobby', () => {
    const ctx: GameContext = { now: 0, content, newId: () => 'x', random: () => 0 };
    const mk = (levels: Level[]) => {
      const s = createGame('MENU');
      levels.forEach((level, i) => apply(s, { type: 'join', playerId: `p${i}`, name: `P${i}`, level }, ctx));
      return viewFor(s, { kind: 'stage' }, content).modes;
    };
    const title = (modes: { id: string; title: string }[], id: string) => modes.find((m) => m.id === id)?.title;
    expect(title(mk(['n4', 'n3']), 'kana-raid')).toBe('Katsuyō Raid');
    expect(title(mk(['n4', 'n3']), 'concentration')).toBe('Frame Concentration');
    expect(title(mk(['n4', 'n5']), 'kana-raid')).toBe('Kana Yōkai Raid');
  });
});
