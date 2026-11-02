import { describe, expect, it } from 'vitest';
import { allN4Up, greenCarFor } from '../shared/src/greenCar.js';

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
