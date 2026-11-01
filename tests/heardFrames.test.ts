import { describe, expect, it } from 'vitest';
import { framesHeard } from '../shared/src/japanese/frames.js';
import { phraseFrames } from '../shared/src/progress.js';
import { CAUSES, lineFor } from '../shared/src/modes/lateAgain/causes.js';
import { finKept, RUMOUR_FINS, RUMOUR_SEEDS, rumourLine } from '../shared/src/modes/wordGauntlet/rumours.js';
import { retell } from '../tools/bots/policies/wordGauntlet.js';

// Panel on #160: a model sentence logged for a line someone made up counts only for the frames heard in it.
describe('credit for the frames heard', () => {
  const fox = lineFor(CAUSES.find((c) => c.id === 'fox')!, 'n4').model;

  it("Pon's ので isn't earned by naming the cause", () => {
    expect(framesHeard(fox, fox)).toEqual(expect.arrayContaining(['node', 'passive']));
    const heard = framesHeard(fox, { text: '部長に 言われました。', kana: 'ぶちょうに いわれました。' });
    expect(heard).toContain('passive');
    expect(heard).not.toContain('node');
  });

  it('a card with frames counts only for those', () => {
    expect(phraseFrames(fox)).toContain('node');
    expect(phraseFrames({ ...fox, frames: ['passive'] })).not.toContain('node');
    expect(phraseFrames({ ...fox, frames: ['passive'] })).toContain('passive');
  });
});

describe('Word Gauntlet bots retelling a rumour', () => {
  it('keep the details an earlier player added, then add their own', () => {
    const seed = RUMOUR_SEEDS[0]!;
    // A time fin and a how fin: two time fins can't both stand (addFin keeps the newer).
    const earlier = RUMOUR_FINS.find((f) => f.id === 'every-night');
    const mine = RUMOUR_FINS.find((f) => f.id === 'alone');
    const heard = rumourLine(seed, [earlier!], 'sou-hear');
    const said = retell(seed.who.kana, heard, mine!.id, 1);
    expect(said).not.toBeNull();
    expect(finKept(earlier!, said!)).toBe(true);
    expect(finKept(mine!, said!)).toBe(true);
  });
});
