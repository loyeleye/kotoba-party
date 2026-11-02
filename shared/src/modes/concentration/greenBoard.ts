// Frame Concentration (the Green Car Kotoba Concentration): dealing the board from the frame deck, checking a
// said sentence, and the tile tray. Pure: randomness comes in. See docs/modes/concentration.md, "Green Car".

import type { JpText } from '../../../../content/src/types.js';
import { FRAME_BY_ID, framesOf, type FrameId } from '../../japanese/frames.js';
import { normalizeReading, type UtteranceToken } from '../../japanese/kana.js';
import type { Audience } from '../../protocol.js';
import { shuffled } from '../mode.js';
import { planForSize, SPECIAL_FACES, type BoardPlan, type BuiltBoard, type Card, type Pair } from './board.js';
import { GISTS, N3_DECK_FRAMES, N4_DECK_FRAMES, type Gist } from './frameDeck.js';

export const GIST_BY_ID: ReadonlyMap<string, Gist> = new Map(GISTS.map((g) => [g.id, g]));
/** Pictures are unique in the deck, so a picture names its gist (the bots look their line up by it). */
export const GIST_BY_PIC: ReadonlyMap<string, Gist> = new Map(GISTS.map((g) => [g.pic, g]));

const N3_SET = new Set<string>(N3_DECK_FRAMES);
export const levelOfFrame = (frame: string): 'n4' | 'n3' => (N3_SET.has(frame) ? 'n3' : 'n4');

/** A step smaller than the regular board: sentences take longer than words, and the cap is still 12 minutes. */
export function planGreenBoard(players: number, random: () => number): BoardPlan {
  return planForSize(players <= 4 ? 4 : 5, random);
}

/** Cheeky pictures per board in a Cheeky room: a few, not all. */
export const cheekyCap = (size: number): number => (size <= 4 ? 2 : 3);
/** Hard pairs (picture only) per board: about a quarter, from N3 frames. */
export const hardCount = (pairs: number): number => Math.round(pairs / 4);

/** The gists an audience may be dealt: Kids sees Kids; Family adds Family; Cheeky adds Cheeky (capped per board). */
export function gistPool(audience: Audience | undefined): Gist[] {
  const a = audience ?? 'family';
  return GISTS.filter((g) => g.audience === 'kids' || (a !== 'kids' && g.audience === 'family') || (a === 'cheeky' && g.audience === 'cheeky'));
}

/**
 * Picks `count` frames from one side, most needed first ("aim the deal"): `need` is how much the seated players
 * need each frame tonight (aim.ts aimWeight summed over them: frames a path goal requires weigh double, said least
 * in tonight's earlier games). Ties break at random.
 */
export function pickFrames(frames: readonly FrameId[], count: number, need: (frame: FrameId) => number, random: () => number): FrameId[] {
  return shuffled(frames, random)
    .map((f, i) => ({ f, i, n: need(f) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, count)
    .map((x) => x.f);
}

export function chunkFace(frame: string): Card['face'] {
  return { kind: 'chunk', text: FRAME_BY_ID[frame as FrameId]?.ja ?? frame, tag: levelOfFrame(frame) === 'n3' ? 'N3' : 'N4', frame };
}

export function gistFace(g: Gist, hard: boolean): Card['face'] {
  return { kind: 'gist', text: g.en, pic: g.pic, ...(hard ? { hard: true } : {}) };
}

/**
 * Deals a Frame Concentration board: half N4 and half N3 frames (the odd pair goes either way), no frame twice,
 * no two gists with the same key word or picture, a few Cheeky gists in a Cheeky room, and about a quarter of
 * the pairs hard (N3 frames, picture only).
 */
export function buildGreenBoard(
  plan: BoardPlan,
  audience: Audience | undefined,
  need: (frame: FrameId) => number,
  random: () => number,
  newId: () => string,
): BuiltBoard {
  const pool = gistPool(audience);
  const n4 = Math.floor(plan.pairs / 2) + (plan.pairs % 2 && random() < 0.5 ? 1 : 0);
  const frames = shuffled([...pickFrames(N4_DECK_FRAMES, n4, need, random), ...pickFrames(N3_DECK_FRAMES, plan.pairs - n4, need, random)], random);
  const cap = audience === 'cheeky' ? cheekyCap(plan.cols) : 0;
  const usedKeys = new Set<string>();
  let cheeky = 0;
  const picked: Gist[] = [];
  for (const frame of frames) {
    const fits = pool.filter((g) => g.frame === frame && !usedKeys.has(`a:${g.anchorEn.toLowerCase()}`) && !usedKeys.has(`p:${g.pic}`));
    const spicy = fits.filter((g) => g.audience === 'cheeky');
    const tame = fits.filter((g) => g.audience !== 'cheeky');
    const choice = cheeky < cap && spicy.length ? spicy : tame.length ? tame : spicy;
    const g = choice[Math.floor(random() * choice.length)];
    if (!g) continue;
    if (g.audience === 'cheeky') cheeky += 1;
    usedKeys.add(`a:${g.anchorEn.toLowerCase()}`);
    usedKeys.add(`p:${g.pic}`);
    picked.push(g);
  }
  const n3 = picked.filter((g) => levelOfFrame(g.frame) === 'n3');
  const hard = new Set(shuffled(n3, random).slice(0, hardCount(plan.pairs)).map((g) => g.id));
  const pairs: Pair[] = [];
  const cards: Card[] = [];
  for (const g of picked) {
    const id = newId();
    const isHard = hard.has(g.id);
    pairs.push({
      id,
      kind: 'frame',
      word: { id: `concentration.gc.${g.id}`, jp: g.model },
      accepted: [],
      misses: 0,
      ownerId: null,
      cleared: false,
      gist: { id: g.id, frame: g.frame, level: levelOfFrame(g.frame), hard: isHard },
    });
    cards.push({ pairId: id, role: 'cue', face: gistFace(g, isHard), state: 'down' }, { pairId: id, role: 'word', face: chunkFace(g.frame), state: 'down' });
  }
  let specials = plan.specials;
  // The deck always fills a board; this only guards against a future pool too thin for one.
  while (pairs.length * 2 + specials.length < plan.cols * plan.rows) specials = [...specials, 'bonus'];
  for (const sp of specials) cards.push({ pairId: null, role: 'special', face: SPECIAL_FACES[sp], state: 'down' });
  return { cols: plan.cols, rows: plan.rows, cards: shuffled(cards, random), pairs, fallback: false };
}

// ---- checking a sentence ----

/** A reading with spaces and punctuation gone, for "is this word in there" and "is this the same sentence". */
export const compact = (s: string): string => normalizeReading(s).replace(/[\s　、。,.!?！？「」…ー~〜]/g, '');

export interface SayCheck {
  ok: boolean;
  /** framesOf found the pair's frame. */
  frame: boolean;
  /** The gist's key word was there, in any form. */
  anchor: boolean;
}

/**
 * The lenient check: right when framesOf (with the server's tokens) finds the pair's frame in what was heard AND
 * the gist's key word is there in any form. Everything else is the player's own (ねた ふりを した, ねて いる
 * ふりを しました and ずっと ねた ふりを して いた all count for "pretended to be asleep").
 */
export function checkFrameSay(u: { text: string; reading?: string; tokens?: readonly UtteranceToken[] }, gist: Pick<Gist, 'frame' | 'anchor'>): SayCheck {
  const kana = u.reading ?? u.text;
  const frame = framesOf({ text: u.text, kana }, u.tokens, { keepHidden: true }).includes(gist.frame);
  const heard = `${compact(kana)}|${compact(u.text)}`;
  const anchor = gist.anchor.some((a) => heard.includes(compact(a)));
  return { ok: frame && anchor, frame, anchor };
}

// ---- the tile tray ----

/** The model's words, as tiles (the last 。 dropped). */
export const modelWords = (model: JpText): string[] =>
  model.kana
    .replace(/。$/, '')
    .split(/\s+/)
    .filter(Boolean);

/** The tray: the model's words plus two words from other lines, shuffled. Tiles score but log `read`. */
export function tilesFor(gist: Gist, random: () => number): string[] {
  const own = modelWords(gist.model);
  const others = shuffled(
    GISTS.filter((g) => g.id !== gist.id).flatMap((g) => modelWords(g.model)),
    random,
  ).filter((w, i, all) => !own.includes(w) && all.indexOf(w) === i);
  return shuffled([...own, ...others.slice(0, 2)], random);
}
