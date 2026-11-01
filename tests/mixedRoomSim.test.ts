// The playtest sim (tools/sim/mixedRooms.ts) still plays whole games: one seed, one mode, one mixed room.
import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../shared/src/modes/experiments.js';
import { formatAb, formatRun, runSim } from '../tools/sim/mixedRooms.js';
import { content } from './helpers.js';

describe('mixed-room sim', () => {
  it('plays a game to the recap and measures it', () => {
    const before = { ...EXPERIMENTS };
    const run = runSim({ seeds: 1, modes: ['omiai'], setups: ['a'], content, experiments: { spokenReaction: !before.spokenReaction } });
    // The switches are put back after the run.
    expect(EXPERIMENTS).toEqual(before);
    expect(run.experiments.spokenReaction).toBe(!before.spokenReaction);
    expect(run.cells).toHaveLength(1);
    const c = run.cells[0]!;
    expect(c).toMatchObject({ mode: 'omiai', setup: 'a', games: 1, stuck: 0 });
    expect(c.lengthS.mean).toBeGreaterThan(30);
    expect(c.idleS.mean).toBeGreaterThan(0);
    expect(c.idleS.mean).toBeLessThan(c.lengthS.mean);
    expect(c.offersPerGame.mean).toBeGreaterThan(0);
    expect(c.n4AcceptRate).not.toBeNull();
    expect(c.saidLow.mean + c.seenLow.mean).toBeGreaterThan(0);
    // Mixed room with an N4 offer: the recap asks the two players below N4.
    expect(c.waitPrompts.mean).toBe(2);
    expect(run.nights[0]!.waitPrompts.mean).toBe(2);
    expect(formatRun(run)).toContain('omiai');
    expect(formatAb('spokenReaction', run, run)).toContain('+0.0');
  });
});
