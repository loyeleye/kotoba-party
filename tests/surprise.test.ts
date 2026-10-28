// Surprise Me!: the VIP lets the room roll a random menu game that fits tonight's player count.

import { describe, expect, it } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room } from '../server/src/room.js';
import { MENU, MODES, surprisePool } from '../shared/src/modes/registry.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { wedgeAt, wheelTurn } from '../shared/src/roulette.js';
import { content } from './helpers.js';
import { SURPRISE_REVEAL_MS, SURPRISE_SPIN_MS } from '../shared/src/constants.js';
import type { HostCue } from '../shared/src/modes/mode.js';
import { hostDirector } from '../server/src/host.js';
import { vi } from 'vitest';

const NAMES = ['Aki', 'Ben', 'Chie', 'Dai', 'Emi', 'Fumi', 'Gen', 'Hana'];

function setup(players: number, random: () => number = Math.random) {
  const room = new Room({ code: 'TEST', clock: new ManualClock(), content, random });
  const stage = room.createStageToken();
  const seats = NAMES.slice(0, players).map((name) => room.join({ name }) as JoinResponse);
  return { room, stage, vip: seats[0]! };
}

describe('Surprise Me!', () => {
  it('lists the menu by fewest players needed, then A–Z by title', () => {
    const sorted = [...MENU].sort((a, b) => a.minPlayers - b.minPlayers || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
    expect(MENU.map((m) => m.id)).toEqual(sorted.map((m) => m.id));
  });

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
  it('Pon calls the spin, names the pick as the wheel stops, and the intro waits for the wheel', () => {
    const heard: HostCue[][] = [];
    const clock = new ManualClock();
    const room = new Room({ code: 'TEST', clock, content, random: () => 0, onCues: (_r, cues) => void heard.push(cues) });
    const vip = room.join({ name: 'Aki' }) as JoinResponse;
    room.join({ name: 'Ben' });
    room.join({ name: 'Chie' });
    heard.length = 0;
    const plain = new Room({ code: 'PLAN', clock, content });
    const pv = plain.join({ name: 'Aki' }) as JoinResponse;
    plain.join({ name: 'Ben' });
    plain.join({ name: 'Chie' });
    room.command(vip.token, { id: 's', type: 'start', mode: 'surprise' });
    const pick = MODES[room.state.mode!].info;
    plain.command(pv.token, { id: 's', type: 'start', mode: pick.id });
    // The wheel covers the stage for the reveal, so the intro runs that much longer.
    expect(room.state.deadline! - plain.state.deadline!).toBe(SURPRISE_REVEAL_MS);
    const cues = heard.flat().filter((c) => !c.ahead);
    const spin = cues.find((c) => c.event === 'surprise_spin');
    const named = cues.find((c) => c.event === 'surprise_pick');
    expect(spin).toMatchObject({ host: 'pon' });
    expect(spin!.atMs).toBeUndefined();
    expect(named).toMatchObject({ host: 'pon', atMs: SURPRISE_SPIN_MS + 100, slots: { game: pick.titleJa, game_en: pick.title } });
    // The game's own intro line is said once the wheel has gone.
    expect(cues.filter((c) => c.event !== 'surprise_spin' && c.event !== 'surprise_pick').at(-1)?.atMs).toBe(SURPRISE_REVEAL_MS);
  });

  it('every game title Pon may name has a kana reading for the voice', () => {
    const kana = /^[\u3041-\u309f\u30a0-\u30ff\u30fc・！？ 　A-Za-z]+$/;
    for (const m of MENU) expect(m.titleKana ?? m.titleJa, m.id).toMatch(kana);
  });

  it('the host says a timed cue at its time, after the phase line', async () => {
    vi.useFakeTimers();
    try {
      const said: string[] = [];
      const fake = { code: 'T', state: { audience: 'family', host: null }, say: (l: { text: string }) => void said.push(l.text) };
      const direct = hostDirector({ speak: async (_c, cue) => ({ host: cue.host, text: cue.event, kana: '', en: '' }) });
      direct(fake as never, [{ host: 'pon', event: 'surprise_pick', atMs: 4000 }, { host: 'pon', event: 'intro', atMs: 7000 }, { host: 'pon', event: 'surprise_spin' }], 1);
      await vi.advanceTimersByTimeAsync(10);
      expect(said).toEqual(['surprise_spin']);
      await vi.advanceTimersByTimeAsync(4000);
      expect(said).toEqual(['surprise_spin', 'surprise_pick']);
      await vi.advanceTimersByTimeAsync(3000);
      expect(said).toEqual(['surprise_spin', 'surprise_pick', 'intro']);
    } finally {
      vi.useRealTimers();
    }
  });
});
