import { describe, expect, it } from 'vitest';
import { GOALS } from '../shared/src/path.js';
import { phraseFrames } from '../shared/src/progress.js';
import { playGame } from '../tools/sim/play.js';
import { runRoom } from '../tools/sim/expressLine.js';
import { content } from './helpers.js';

const EXPRESS_MODES = [...new Set(GOALS.filter((g) => g.line === 'express').flatMap((g) => g.games))];

describe('path simulation: bots play the real games in-process', () => {
  it.each(EXPRESS_MODES)('%s reaches its recap with a phrasebook for each N4 seat', (mode) => {
    const g = playGame(content, mode, ['n4', 'n4', 'n5', 'n5'], 1);
    expect(g.seats.filter((s) => s.level === 'n4').every((s) => s.result.mode === mode)).toBe(true);
  });

  it('a speaking N4 bot takes the Bento Haus hard roles and says their frames from memory', () => {
    const g = playGame(content, 'bento-haus', ['n4', 'n4', 'n5', 'n5'], 2);
    const said = g.seats.filter((s) => s.level === 'n4').flatMap((s) => s.result.phrases.filter((e) => e.outcome === 'said' && e.recall === 'memory'));
    expect(said.some((e) => phraseFrames(e).includes('te-itadakemasen'))).toBe(true);
  });

  it('a speaking Ghost Advice Hotline adviser is credited from memory', () => {
    const g = playGame(content, 'ghost-hotline', ['n4', 'n4', 'n5', 'n5'], 3);
    const lines = g.seats.flatMap((s) => s.result.phrases.filter((e) => e.itemId.startsWith('hotline:') && !e.itemId.endsWith(':call')));
    expect(lines.some((e) => e.outcome === 'said' && e.recall === 'memory')).toBe(true);
  });

  it('a room run is repeatable and stamps goals through the real path rules', () => {
    const lib = new Map(['bento-haus', 'phrase-bingo'].map((m) => [m as 'bento-haus', [1, 2].flatMap((seed) => playGame(content, m as 'bento-haus', ['n4', 'n4', 'n5', 'n5'], seed).seats.filter((s) => s.level === 'n4').map((s) => s.result))]));
    const o = { rooms: 1, library: 2, nightsEvery: 7, games: 3, follow: 0, memory: 1, max: 6, reviews: 0, seed: 1 };
    const a = runRoom(lib, o, 42);
    expect(runRoom(lib, o, 42)).toEqual(a);
    // Bento Haus's deputy manager asks ＿て いただけませんか every shift: 4.1 or 4.9 moves within six weekly nights.
    expect(Object.keys(a.stamped).length).toBeGreaterThan(0);
  });

  it('phone review sittings count toward a stamp, as they do on the phone', () => {
    const lib = new Map([['bento-haus' as const, playGame(content, 'bento-haus', ['n4', 'n4', 'n5', 'n5'], 5).seats.filter((s) => s.level === 'n4').map((s) => s.result)]]);
    const base = { rooms: 1, library: 1, nightsEvery: 7, games: 1, follow: 0, memory: 1, max: 8, reviews: 0, seed: 1 };
    const games = runRoom(lib, base, 7);
    const reviews = runRoom(lib, { ...base, reviews: 3 }, 7);
    const first = (r: typeof games) => Math.min(...Object.values(r.stamped), Infinity);
    expect(first(reviews)).toBeLessThanOrEqual(first(games));
    expect(Object.keys(reviews.stamped).length).toBeGreaterThanOrEqual(Object.keys(games.stamped).length);
  });
});
