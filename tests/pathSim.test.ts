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

  it('Happyōkai! deals question cards to an N3 seat (the N4 ones, until N3 has its own)', () => {
    const g = playGame(content, 'happyokai', ['n3', 'n4', 'n5', 'kana'], 4);
    expect(g.seats.find((s) => s.level === 'n3')!.result.mode).toBe('happyokai');
  });

  it('a speaking N4 bot takes the Bento Haus hard roles and says their frames from memory', () => {
    const g = playGame(content, 'bento-haus', ['n4', 'n4', 'n5', 'n5'], 2);
    const said = g.seats.filter((s) => s.level === 'n4').flatMap((s) => s.result.phrases.filter((e) => e.outcome === 'said' && e.recall === 'memory'));
    expect(said.some((e) => phraseFrames(e).includes('te-itadakemasen'))).toBe(true);
  });

  it('a Then and now presenter who makes up a line in the deck’s frames is credited with the deck’s sentence, for the frames heard', () => {
    const credited = [1, 2, 3, 4, 5, 6].flatMap((seed) => playGame(content, 'happyokai', ['n4', 'n4', 'n5', 'n5'], seed).seats.flatMap((s) => s.result.phrases.filter((e) => e.itemId.startsWith('happyokai:then-now:'))));
    expect(credited.length).toBeGreaterThan(0);
    for (const e of credited) {
      // happyokai:<deck>:<slide>:<frames heard>:<level>. The card counts for the frames heard and no others,
      // its sentence carries them, and it has English to practise from.
      const parts = e.itemId.split(':');
      expect(parts).toHaveLength(5);
      const heard = parts[3]!.split('+');
      expect(e.frames).toEqual(heard);
      expect(heard).toEqual(expect.arrayContaining(phraseFrames(e)));
      expect(phraseFrames(e).some((f) => f === 'you-ni-naru' || f === 'koto-ni-suru')).toBe(true);
      expect(e).toMatchObject({ outcome: 'said', recall: 'memory' });
      expect(e.en).not.toBe('');
    }
    const frames = new Set(credited.flatMap((e) => phraseFrames(e)));
    expect(frames.has('koto-ni-suru')).toBe(true);
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

  it("following the path's suggestion is no slower than picking games at random", () => {
    const modes = ['bento-haus', 'phrase-bingo', 'ghost-hotline', 'late-again', 'tourist', 'omiai', 'hajimemashite', 'happyokai', 'dub-club'] as const;
    const lib = new Map(modes.map((m) => [m as (typeof modes)[number], [1, 2].flatMap((seed) => playGame(content, m, ['n4', 'n4', 'n5', 'n5'], seed).seats.filter((s) => s.level === 'n4').map((s) => s.result))]));
    const base = { rooms: 1, library: 2, nightsEvery: 7, games: 3, follow: 0, memory: 0.7, max: 10, reviews: 0, seed: 1 };
    // Stamps by night 10, summed over 24 rooms, and the nights they took (a goal never stamped counts as 11).
    // 24, not 12: in this small library 12 rooms is noise (new Tourist questions in step 5b-2 flipped it).
    // The library holds every game the suggestion sends a room to early: without Dub Club (4.8, the fastest goal
    // since 5b-2) the suggestion kept naming a game the room couldn't play, and "following" became random play
    // with extra Bento Haus and Hotline games (step 5c).
    const run = (follow: number) => {
      const rooms = Array.from({ length: 24 }, (_, i) => runRoom(lib, { ...base, follow }, 100 + i));
      const ids = GOALS.filter((g) => g.line === 'express').map((g) => g.id);
      return { stamps: rooms.reduce((n, r) => n + Object.keys(r.stamped).length, 0), nights: rooms.reduce((n, r) => n + ids.reduce((m, id) => m + (r.stamped[id] ?? 11), 0), 0) };
    };
    const random = run(0);
    const followed = run(0.9);
    expect(followed.stamps).toBeGreaterThanOrEqual(random.stamps);
    expect(followed.nights).toBeLessThanOrEqual(random.nights);
  });
});
