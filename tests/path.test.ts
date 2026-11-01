// The learning path (shared/src/path.ts): the first step not yet done that tonight's room can play,
// then review picks once it's all done (docs/progressive-learning.md).

import { describe, expect, it } from 'vitest';
import { factsOf, KANA_GOAL, PATH, stepsFor, suggest, type PathFacts } from '../shared/src/path.js';
import { MODES } from '../shared/src/modes/registry.js';

const facts = (over: Partial<PathFacts> = {}): PathFacts => ({ level: 'kana', caught: 0, played: {}, said: {}, due: {}, ...over });
const room = (players: number, speakers = players) => ({ players, speakers });

describe('learning path', () => {
  it('names real games and frames', () => {
    for (const s of PATH) expect(MODES[s.mode], s.id).toBeDefined();
    expect(new Set(PATH.map((s) => s.id)).size).toBe(PATH.length);
  });

  it('starts at the kana for a Kana-level player and skips them for N5 and N4', () => {
    expect(suggest(facts(), room(4))).toMatchObject({ mode: 'kana-raid', done: 0, of: PATH.length, instead: false });
    expect(suggest(facts({ level: 'n5' }), room(4))).toMatchObject({ mode: 'hajimemashite', done: 0, of: PATH.length - 1 });
    expect(stepsFor('n4').some((s) => s.mode === 'kana-raid')).toBe(false);
  });

  it('moves on as the save shows each step done', () => {
    const f = facts({ caught: KANA_GOAL });
    expect(suggest(f, room(4))!.mode).toBe('hajimemashite');
    f.played.hajimemashite = 1;
    f.said['wa-desu'] = 3;
    expect(suggest(f, room(4))!.mode).toBe('last-train');
    f.played['last-train'] = 1;
    f.said.kudasai = 2;
    expect(suggest(f, room(4))!.mode).toBe('bento-haus');
    f.played['bento-haus-vs'] = 1; // the VS kitchen counts too
    expect(suggest(f, room(4))).toMatchObject({ mode: 'oogiri', done: 4 });
  });

  it('suggests the next step that fits when the first one doesn’t', () => {
    // Nice to Meet You! needs 3 players: a pair gets Last Train, marked as the stand-in.
    expect(suggest(facts({ level: 'n5' }), room(2))).toMatchObject({ mode: 'last-train', instead: true });
    // With no room (My progress), the path's own next step.
    expect(suggest(facts({ level: 'n5' }), null)).toMatchObject({ mode: 'hajimemashite', instead: false });
  });

  it('once the path is done, points at the game with the most phrases due', () => {
    const played = Object.fromEntries(PATH.map((s) => [s.mode, 5]));
    const done = facts({ level: 'n5', played, said: { 'wa-desu': 9, kudasai: 9 }, due: { oogiri: 2, 'last-train': 5 } });
    expect(suggest(done, room(4))).toMatchObject({ step: null, mode: 'last-train' });
    expect(suggest({ ...done, due: {} }, room(4))).toBeNull();
  });

  it('reads its facts from My progress', () => {
    const f = factsOf(
      {
        cards: [{ caughtAt: 1 }, { caughtAt: null }] as never,
        bests: [{ mode: 'oogiri', best: 9, played: 2, wins: 0 }],
        frames: [{ id: 'kudasai', phrases: 2, said: 3, examples: [] }],
        phrases: [],
        duePhrases: [{ mode: 'oogiri' }, { mode: 'oogiri' }] as never,
      },
      'n5',
    );
    expect(f).toEqual({ level: 'n5', caught: 1, played: { oogiri: 2 }, said: { kudasai: 3 }, due: { oogiri: 2 } });
  });
});
