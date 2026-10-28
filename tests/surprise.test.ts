// Surprise Me!: the VIP lets the room roll a random menu game that fits tonight's player count.

import { describe, expect, it } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room } from '../server/src/room.js';
import { MENU, MODES, surprisePool } from '../shared/src/modes/registry.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { wedgeAt, wheelTurn } from '../shared/src/roulette.js';
import { content } from './helpers.js';

const NAMES = ['Aki', 'Ben', 'Chie', 'Dai', 'Emi', 'Fumi', 'Gen', 'Hana'];

function setup(players: number, random: () => number = Math.random) {
  const room = new Room({ code: 'TEST', clock: new ManualClock(), content, random });
  const stage = room.createStageToken();
  const seats = NAMES.slice(0, players).map((name) => room.join({ name }) as JoinResponse);
  return { room, stage, vip: seats[0]! };
}

describe('Surprise Me!', () => {
  it('only ever rolls a menu game that fits the room', () => {
    for (let n = 1; n <= 8; n++) {
      const pool = surprisePool(n);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every((m) => n >= m.minPlayers && n <= m.maxPlayers && m.id !== 'debug')).toBe(true);
      expect(pool.length).toBe(MENU.filter((m) => n >= m.minPlayers && n <= m.maxPlayers).length);
      // Every game in the pool comes up for some roll.
      const seen = new Set<string>();
      pool.forEach((_, i) => {
        const { room, vip } = setup(n, () => (i + 0.5) / pool.length);
        expect(room.command(vip.token, { id: 's', type: 'start', mode: 'surprise' })).toMatchObject({ ok: true });
        const mode = MODES[room.state.mode!].info;
        expect(n).toBeGreaterThanOrEqual(mode.minPlayers);
        expect(n).toBeLessThanOrEqual(mode.maxPlayers);
        seen.add(mode.id);
      });
      expect([...seen].sort()).toEqual(pool.map((m) => m.id).sort());
    }
  });

  it('keeps Bento Haus VS out of a room too small for two kitchens', () => {
    expect(surprisePool(3).map((m) => m.id)).not.toContain('bento-haus-vs');
    expect(surprisePool(4).map((m) => m.id)).toContain('bento-haus-vs');
  });

  it('tells every screen what it rolled between, until the room is back in the lobby', () => {
    const { room, stage, vip } = setup(3, () => 0);
    room.command(vip.token, { id: 's', type: 'start', mode: 'surprise', rounds: 99, packId: 'nope' });
    const view = room.viewFor({ kind: 'stage' });
    expect(view.phase).toBe('intro');
    expect(view.surprise).toEqual(surprisePool(3).map((m) => m.id));
    expect(view.mode).toBe(surprisePool(3)[0]!.id);
    // The other game's length and topic don't carry over.
    expect(room.state.packId).toBeNull();
    room.command(stage, { id: 'e', type: 'endGame' });
    expect(room.viewFor({ kind: 'stage' }).surprise).toBeNull();
    // A game the VIP picked themselves is not a surprise.
    room.command(vip.token, { id: 's2', type: 'start', mode: 'debug' });
    expect(room.viewFor({ kind: 'stage' }).surprise).toBeNull();
  });

  it('the wheel stops with the pointer on the pick, wherever in its wedge', () => {
    for (const n of [1, 3, 4, 8]) {
      const pool = surprisePool(n);
      pool.forEach((pick, i) => {
        for (const jitter of [0, 0.5, 1]) {
          const turn = wheelTurn(pool, pick, jitter);
          // Whole turns first, so it always spins.
          expect(turn).toBeGreaterThanOrEqual(5 * 360);
          expect(wedgeAt(pool.length, turn)).toBe(i);
        }
      });
    }
  });
});
