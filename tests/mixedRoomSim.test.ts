// The playtest sim (tools/sim/mixedRooms.ts) still plays whole games: one seed, one mode, one mixed room.
import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, withExperiments } from '../shared/src/modes/experiments.js';
import { formatAb, formatRun, playNight, runSim } from '../tools/sim/mixedRooms.js';
import { content } from './helpers.js';

describe('mixed-room sim', () => {
  it('plays a game to the recap and measures it', () => {
    const before = { ...EXPERIMENTS };
    // Omiai's go-between is a Green Car move-out, so a mixed room's offers are measured on Bento Haus's おもてなし shift.
    const run = runSim({ seeds: 1, modes: ['bento-haus'], setups: ['a'], content, experiments: { spokenReaction: !before.spokenReaction } });
    // The switches are put back after the run.
    expect(EXPERIMENTS).toEqual(before);
    expect(run.experiments.spokenReaction).toBe(!before.spokenReaction);
    expect(run.cells).toHaveLength(1);
    const c = run.cells[0]!;
    expect(c).toMatchObject({ mode: 'bento-haus', setup: 'a', games: 1, stuck: 0 });
    expect(c.lengthS.mean).toBeGreaterThan(30);
    expect(c.idleS.mean).toBeGreaterThan(0);
    expect(c.idleS.mean).toBeLessThan(c.lengthS.mean);
    expect(c.offersPerGame.mean).toBeGreaterThan(0);
    expect(c.n4AcceptRate).not.toBeNull();
    expect(c.saidMemLow.mean + c.saidReadLow.mean + c.retryLow.mean + c.seenLow.mean).toBeGreaterThan(0);
    // Reaction tiles left out of "something to do" can only add idle time.
    expect(c.idleNoTilesS.mean).toBeGreaterThanOrEqual(c.idleS.mean);
    expect(c.rankFlips).toBeGreaterThanOrEqual(0);
    expect(c.rankFlips).toBeLessThanOrEqual(1);
    // Mixed room with an N4 offer: the recap asks the two players below N4.
    expect(c.waitPrompts.mean).toBe(2);
    expect(run.nights[0]!.waitPrompts.mean).toBe(2);
    expect(formatRun(run)).toContain('bento');
    expect(formatAb('spokenReaction', run, run)).toContain('+0.0');
  });

  it("gives room b's second Kana player a quiet phone and plays room e (two N4 players)", () => {
    const run = runSim({ seeds: 1, modes: ['omiai'], setups: ['b', 'e'], content });
    expect(run.cells.map((c) => [c.setup, c.stuck])).toEqual([
      ['b', 0],
      ['e', 0],
    ]);
    expect(formatRun(run)).toContain('2nd Kana quiet');
    expect(run.cells[1]!.saidMemN4.n).toBe(2);
    // The quiet phone (seat 5) never says a reaction or a line out loud.
    const restore = withExperiments({ spokenReaction: true });
    try {
      const quiet = playNight('b', 1, ['omiai'], content).games[0]!.players[4]!;
      expect(quiet.level).toBe('kana');
      expect(quiet.sayTried + quiet.spoken).toBe(0);
    } finally {
      restore();
    }
  });
});
