import { describe, expect, it } from 'vitest';
import { atLevel } from '../content/src/types.js';
import { isLevel, isMixedRoom } from '../shared/src/game.js';
import { LEVEL_RANK, n4Up } from '../shared/src/level.js';
import { lineOf } from '../shared/src/modes/ghostHotline/hotline.js';
import { PROBLEMS } from '../shared/src/modes/ghostHotline/problems.js';
import { currentLine, GOALS, LINES, missingFrames, pathStatus } from '../shared/src/path.js';
import { emptyProgress } from '../shared/src/progress.js';
import { LEVELS, N3_IN_PICKER, PICKER_LEVELS } from '../shared/src/protocol.js';

describe('the N3 level (step 6 of the N4/N3 plan)', () => {
  it('ranks above N4, and counts as N4 wherever a game checks for an N4 player', () => {
    expect(LEVEL_RANK.n3).toBeGreaterThan(LEVEL_RANK.n4);
    expect(['kana', 'n5', 'n4', 'n3'].map((l) => n4Up(l as 'n3'))).toEqual([false, false, true, true]);
    expect(isMixedRoom(['n3', 'n5'])).toBe(true);
    expect(isMixedRoom(['n3', 'n4'])).toBe(false);
  });

  it('is accepted from a saved account but stays out of the picker until the N3 decks are in', () => {
    expect(LEVELS).toContain('n3');
    expect(isLevel('n3')).toBe(true);
    expect(PICKER_LEVELS.includes('n3')).toBe(N3_IN_PICKER);
  });

  it('gets the N4 version where no N3 one is written', () => {
    expect(atLevel({ kana: 'a', n5: 'b', n4: 'c' }, 'n3')).toBe('c');
    expect(atLevel({ kana: 'a', n5: 'b', n4: 'c', n3: 'd' }, 'n3')).toBe('d');
    const p = PROBLEMS[0]!;
    expect(lineOf(p, 'n3')).toBe(p.advice.n4);
  });

  it('rides the Limited Express Line, the last one, whose goals wait for their frames', () => {
    const st = pathStatus({ ...emptyProgress(), path: true }, Date.UTC(2026, 10, 1));
    expect(currentLine(st, 'n3').id).toBe('limited');
    expect(LINES.at(-1)!.id).toBe('limited');
    expect(LINES.find((l) => l.id === 'express')!.up).toBe('n3');
    const limited = GOALS.filter((g) => g.line === 'limited');
    expect(limited.map((g) => g.id)).toEqual(['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12']);
    // A goal whose required frames have no matcher yet doesn't count toward clearing the line.
    for (const g of limited.filter((x) => x.kind === 'frames' && missingFrames(x).length)) expect(st.goals.find((x) => x.id === g.id)!.ready, g.id).toBe(false);
  });
});
