// Green Car, aim the deal across the night (shared/src/modes/aim.ts): the games built in wave 1 weigh each item by
// ctx.frameNeed (frames a path goal requires weigh double, divided by tonight's earlier says) over their own counts.
import { describe, expect, it } from 'vitest';
import { frameNeed } from '../shared/src/greenCar.js';
import type { ModeContext } from '../shared/src/modes/mode.js';
import { pickGreenCard, greenFrameOf, type HajimeState } from '../shared/src/modes/hajimemashite/hajimemashite.js';
import { aimAsk } from '../shared/src/modes/bentoHaus/hardRoles.js';
import { aimWeight } from '../shared/src/modes/aim.js';
import { backupLine, bareWord, CAUSES, dealOptions, lineFor, lineFrames } from '../shared/src/modes/lateAgain/causes.js';
import { buildGreenBoard, planGreenBoard } from '../shared/src/modes/concentration/greenBoard.js';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A context whose room has heard these says tonight (per player), as game.ts builds ctx.frameNeed. */
const tonight = (said: Record<string, Record<string, number>> = {}): Pick<ModeContext, 'frameNeed'> => ({
  frameNeed: (id, frames) => frameNeed(said[id] ?? {}, frames),
});

describe('Green Car aim the deal: the whole night', () => {
  it('Nice to Meet You!: an N4 guest gets the required ＿た ことが ある first, ＿て みる once it was said tonight', () => {
    const state = { usedCards: [], gcSaid: {} } as unknown as HajimeState;
    for (let seed = 1; seed <= 10; seed++) {
      expect(greenFrameOf(pickGreenCard(state, 'family', 'p1', 'n4', mulberry(seed), tonight())), `seed ${seed}`).toBe('ta-koto');
      expect(greenFrameOf(pickGreenCard(state, 'family', 'p1', 'n4', mulberry(seed), tonight({ p1: { 'ta-koto': 3 } }))), `seed ${seed}`).toBe('te-miru');
    }
  });

  it('Bento Haus: the guest’s question carries a required frame first, and steps aside once said tonight', () => {
    const h = () => ({ offers: [], specialTurn: 0, askTurn: 0, greenCar: true as const, said: {} as Record<string, Record<string, number>> });
    // ＿お します is the only N4 guest line with a frame a goal requires.
    expect(aimAsk(h(), 'p1', false, 'n4', tonight()).id).toBe('bags');
    expect(aimAsk(h(), 'p1', false, 'n4', tonight({ p1: { 'o-suru': 2 } })).id).not.toBe('bags');
    // This game's says count too.
    expect(aimAsk({ ...h(), said: { p1: { 'o-suru': 2 } } }, 'p1', false, 'n4', tonight()).id).not.toBe('bags');
  });

  it('Late Again!: the deal weighs tonight’s says, not just this game’s', () => {
    const deck = ['train', 'rain', 'station', 'oversleep', 'breakfast', 'game', 'kappa', 'fox'];
    const lineOf = (id: string) => lineFrames(lineFor(CAUSES.find((c) => c.id === id)!, 'n4'), 'n4');
    // Tonight p1 has said the frames of train's and station's lines many times (and nothing else).
    const said: Record<string, number> = {};
    for (const id of ['train', 'station']) for (const f of lineOf(id)) said[f] = 9;
    const ctx = tonight({ p1: said });
    const weight = (c: (typeof CAUSES)[number]) => aimWeight(ctx, 'p1', lineOf(c.id));
    const believable = ['train', 'rain', 'station'];
    const w = (id: string) => weight(CAUSES.find((c) => c.id === id)!);
    const top = Math.max(...believable.map(w));
    expect(w('train')).toBeLessThan(top);
    for (let seed = 1; seed <= 8; seed++) {
      const dealt = dealOptions(mulberry(seed), new Set(), 'family', 'meeting', { deck, weight }).find((id) => believable.includes(id))!;
      expect(w(dealt), `seed ${seed}`).toBe(top);
    }
  });

  it('Frame Concentration: the board picks the frames the room needs most tonight', () => {
    const ctx = tonight({ p1: { 'ta-koto': 9, potential: 9 }, p2: { 'ta-koto': 9, potential: 9 } });
    const need = (f: string) => ['p1', 'p2'].reduce((n, id) => n + aimWeight(ctx, id, [f]), 0);
    for (let seed = 1; seed <= 5; seed++) {
      const b = buildGreenBoard(planGreenBoard(2, mulberry(seed)), 'family', need, mulberry(seed), (() => { let i = 0; return () => `id${i++}`; })());
      expect(b.pairs.some((p) => p.gist!.frame === 'ta-koto' || p.gist!.frame === 'potential'), `seed ${seed}`).toBe(false);
    }
  });
});

describe('Late Again!: the witness’s backup', () => {
  it('every cause has its own hearsay line, not 「〈tile〉だった」', () => {
    const seen = new Set<string>();
    for (const c of CAUSES) {
      for (const lv of ['n4', 'n3'] as const) {
        const b = backupLine(c.id, lv);
        expect(b.kana.startsWith(`${bareWord(c).kana}だった`), `${c.id} ${lv}`).toBe(false);
        expect(b.kana.endsWith(lv === 'n3' ? ' らしいです。' : ' そうです。'), `${c.id} ${lv}`).toBe(true);
        expect(seen.has(b.kana), b.kana).toBe(false);
        seen.add(b.kana);
      }
    }
    expect(backupLine('tanuki', 'n3').kana).toBe('たぬきの しわざだった らしいです。');
  });
});
