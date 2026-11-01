// The N3 inventory (shared/src/japanese/n3Points.ts) against the frames and the Limited Express goals
// (docs/n3-coverage.md: Plan B, spoken N3).
import { describe, expect, it } from 'vitest';
import { ALL_FRAMES, FRAME_BY_ID } from '../shared/src/japanese/frames.js';
import { N3_COUNTS, N3_POINTS, listenPointsOf, passedPoints } from '../shared/src/japanese/n3Points.js';
import { GOALS, GOAL_BY_ID, needIds } from '../shared/src/path.js';

const LIMITED = GOALS.filter((g) => g.line === 'limited' && g.kind === 'frames');

describe('the N3 inventory', () => {
  it('has one entry per id', () => {
    expect(new Set(N3_POINTS.map((p) => p.id)).size).toBe(N3_POINTS.length);
  });

  it('lists every N3 frame once, on the goal frames.ts gives it', () => {
    for (const f of ALL_FRAMES.filter((x) => x.level === 'n3')) {
      const p = N3_POINTS.filter((x) => x.frame === f.id);
      expect([f.id, p.length]).toEqual([f.id, 1]);
      expect([f.id, p[0]!.goal]).toEqual([f.id, f.goal]);
      expect([f.id, p[0]!.fit]).toEqual([f.id, f.listening ? 'listen' : 'speak']);
    }
    for (const p of N3_POINTS.filter((x) => x.frame)) expect([p.id, FRAME_BY_ID[p.frame!]?.level]).toEqual([p.id, 'n3']);
  });

  it('puts every speakable point with a matcher on its goal, and no listening point on any', () => {
    for (const p of N3_POINTS.filter((x) => x.fit === 'speak' && x.frame)) {
      const g = GOAL_BY_ID[p.goal]!;
      expect([p.id, [...g.need.flatMap((n) => [...needIds(n)]), ...g.also].includes(p.frame!)]).toEqual([p.id, true]);
    }
    const onGoals = new Set(LIMITED.flatMap((g) => [...g.need.flatMap((n) => [...needIds(n)]), ...g.also]));
    for (const p of N3_POINTS.filter((x) => x.fit === 'listen' && x.frame)) expect([p.id, onGoals.has(p.frame!)]).toEqual([p.id, false]);
  });

  it('gives a goal to every speak and listen point, and none to the points the line passes by', () => {
    for (const p of N3_POINTS) {
      if (p.fit === 'speak' || p.fit === 'listen') expect([p.id, !!GOAL_BY_ID[p.goal] && GOAL_BY_ID[p.goal]!.line]).toEqual([p.id, 'limited']);
      else expect([p.id, p.goal]).toEqual([p.id, '']);
      if (p.fit !== 'speak') expect([p.id, !!p.why]).toEqual([p.id, true]);
    }
  });

  // Game design seat: optional frames must not quietly become a second gate. Each goal keeps the required frames
  // it had when Plan B was chosen; a change here is Ladi's call (open questions doc).
  it('keeps the Limited Express required frames as they were', () => {
    const need = Object.fromEntries(LIMITED.map((g) => [g.id, g.need.map((n) => [...needIds(n)].join('|'))]));
    expect(need).toEqual({
      '3.1': ['rashii'],
      '3.2': ['suffering-passive', 'saserareru'],
      '3.3': ['sei-de', 'okage-de'],
      '3.4': ['wari-ni', 'kuse-ni'],
      '3.5': ['to-shitara'],
      '3.6': ['you-to-suru', 'zu-ni'],
      '3.7': ['wake-dewa-nai', 'beki'],
      '3.8': ['sasete-itadaku', 'de-gozaimasu|te-orimasu'],
      '3.9': ['uchi-ni', 'tabi-ni'],
      '3.10': ['you-na-ki', 'ni-chigainai'],
      '3.11': ['ppoi', 'nante'],
    });
    for (const g of LIMITED) expect([g.id, g.need.length <= 3]).toEqual([g.id, true]);
  });

  it('counts only band N3 points', () => {
    const n3 = N3_POINTS.filter((p) => p.band === 'n3');
    expect(N3_COUNTS.all).toBe(n3.length);
    expect(N3_COUNTS.speak + N3_COUNTS.listen + N3_COUNTS.unchecked + N3_COUNTS.written).toBe(N3_COUNTS.all);
    expect(N3_COUNTS.passed).toBe(passedPoints().unchecked.length + passedPoints().written.length);
    expect(N3_COUNTS.said).toBeLessThanOrEqual(N3_COUNTS.speak);
    // Most of 3.8's keigo is N4 review, and stays out of the N3 count (JLPT seat).
    expect(N3_POINTS.find((p) => p.id === 'de-gozaimasu')!.band).toBe('n4');
  });

  it('gives each listening point to its goal’s station sheet', () => {
    expect(listenPointsOf('3.11').map((p) => p.id)).toContain('jan');
    expect(listenPointsOf('3.1').map((p) => p.id)).toEqual(['toka-hearsay']);
  });
});
