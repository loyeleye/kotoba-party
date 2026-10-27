import { describe, expect, it } from 'vitest';
import { inviteLinks } from '../shared/src/share.js';

describe('invite links', () => {
  it('gives the phone link and the stage screen link for the room', () => {
    expect(inviteLinks('https://kotoba.party', 'ABCD')).toEqual({
      phone: 'https://kotoba.party/?code=ABCD',
      stage: 'https://kotoba.party/stage/?code=ABCD',
    });
  });

  it('ignores a trailing slash on the origin', () => {
    expect(inviteLinks('http://localhost:8787/', 'WXYZ').stage).toBe('http://localhost:8787/stage/?code=WXYZ');
  });

  it('builds the links on a short-link host the same way', () => {
    expect(inviteLinks('https://tanoshi.s.gy', 'ABCD').phone).toBe('https://tanoshi.s.gy/?code=ABCD');
  });
});
