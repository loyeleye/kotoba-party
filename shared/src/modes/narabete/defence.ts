// Narabete!'s N4 hard role, rank and defend (goal 4.11): an N4 player says why their card sits where it
// does, with ので. The frame depends on where the card ended up: the low end (いちばん さき), the high end
// (いちばん あと), or after a neighbour (＿さんの あと). Each comes with ready reasons that fit the round, so the
// phone can offer whole model lines to read out. All draft until the fluent check.

import type { JpText, ReviewStatus } from '../../../../content/src/types.js';
import type { FeelTheme, TimeSet } from './cards.js';

export type DefenceSpot = 'first' | 'last' | 'after';

export interface DefenceScript {
  spot: DefenceSpot;
  /** The frame, with ＿ for the reason: 「＿ので、これが いちばん さきです。」 */
  frame: JpText;
  /** Whole model lines (a ready reason in the frame), to read out. */
  lines: JpText[];
  /** The N4 frames it practises (by name: see shared/src/japanese/frames.ts). */
  frames: readonly string[];
  status: ReviewStatus;
}

// N3 (step 6): ＿ような きが します (I have a feeling it goes…).

const jp = (text: string, en: string): JpText => ({ text, kana: text, en });

/** The second half of the line, by spot: 「これが いちばん さきです」 and so on. */
function tail(spot: DefenceSpot, after: string): JpText {
  if (spot === 'first') return jp('これが いちばん さきです。', 'this one comes first');
  if (spot === 'last') return jp('これが いちばん あとです。', 'this one goes last');
  return jp(`これは ${after}さんの あとです。`, `this one goes after ${after}'s`);
}

/**
 * The theme's adjective before ので and before a noun. たいへん is a な-adjective (たいへんなので,
 * たいへんな もの); the rest are い-adjectives or verbs (くさいので, びっくりするので), which join as they are.
 */
function moreForms(more: JpText): { node: JpText; noun: JpText } {
  const na = !/[いうくすつぬふむゆるぐぶ]$/.test(more.kana);
  return {
    node: { text: `${more.text}${na ? 'なので' : 'ので'}`, kana: `${more.kana}${na ? 'なので' : 'ので'}`, en: more.en },
    noun: { text: `${more.text}${na ? 'な' : ''}`, kana: `${more.kana}${na ? 'な' : ''}`, en: more.en },
  };
}

/** Ready reasons (each already ending in ので), by round and spot. `n` is the neighbour before, for 'after'. */
function reasons(round: { unit: TimeSet['unit'] } | { theme: Pick<FeelTheme, 'more'> }, spot: DefenceSpot, n: string): JpText[] {
  if ('theme' in round) {
    const { node, noun } = moreForms(round.theme.more);
    if (spot === 'first')
      return [
        { text: `ちょっとだけ ${node.text}`, kana: `ちょっとだけ ${node.kana}`, en: "it's only a little that way" },
        jp('まだ だいじょうぶなので', "it's still OK"),
      ];
    if (spot === 'last')
      return [
        { text: `いちばん ${node.text}`, kana: `いちばん ${node.kana}`, en: "it's the most of all" },
        { text: `これより ${noun.text} ものは ないので`, kana: `これより ${noun.kana} ものは ないので`, en: `nothing is ${round.theme.more.en} than this` },
      ];
    return [
      { text: `${n}さんのより ${node.text}`, kana: `${n}さんのより ${node.kana}`, en: `it's ${round.theme.more.en} than ${n}'s` },
      { text: `${n}さんのより すこし ${node.text}`, kana: `${n}さんのより すこし ${node.kana}`, en: `it's a little ${round.theme.more.en} than ${n}'s` },
    ];
  }
  switch (round.unit) {
    case 'time':
      if (spot === 'first') return [jp('じかんが いちばん はやいので', "it's the earliest time"), jp('これより はやい じかんは ないので', 'no time is earlier than this')];
      if (spot === 'last') return [jp('じかんが いちばん おそいので', "it's the latest time"), jp('これより おそい じかんは ないので', 'no time is later than this')];
      return [jp(`${n}さんのより じかんが おそいので`, `it's later than ${n}'s`), jp(`${n}さんの じかんより あとなので`, `it comes after ${n}'s time`)];
    case 'price':
      if (spot === 'first') return [jp('いちばん やすいので', "it's the cheapest"), jp('これより やすい ものは ないので', 'nothing is cheaper than this')];
      if (spot === 'last') return [jp('いちばん たかいので', "it's the most expensive"), jp('これより たかい ものは ないので', 'nothing costs more than this')];
      return [jp(`${n}さんのより たかいので`, `it costs more than ${n}'s`), jp(`${n}さんのより すこし たかいので`, `it costs a little more than ${n}'s`)];
    case 'date':
      if (spot === 'first') return [jp('ひづけが いちばん はやいので', "it's the earliest date"), jp('これより まえの ひは ないので', 'no day comes before this')];
      if (spot === 'last') return [jp('ひづけが いちばん おそいので', "it's the latest date"), jp('これより あとの ひは ないので', 'no day comes after this')];
      return [jp(`${n}さんの ひより あとなので`, `it comes after ${n}'s day`), jp(`${n}さんのより ひづけが おそいので`, `the date is later than ${n}'s`)];
  }
}

/** Where a card sits: at the low end, the high end, or after the card before it. */
export function spotOf(position: number, length: number): DefenceSpot {
  if (position <= 0) return 'first';
  if (position >= length - 1) return 'last';
  return 'after';
}

/**
 * The N4 defence script for a card at `position` in a line of `length`: the frame and two model lines.
 * `before` is the name of the player whose card sits just before it (for 'after').
 */
export function defenceScript(round: { unit: TimeSet['unit'] } | { theme: Pick<FeelTheme, 'more'> }, position: number, length: number, before: string): DefenceScript {
  const spot = spotOf(position, length);
  const t = tail(spot, before);
  const frame: JpText = { text: `＿ので、${t.text}`, kana: `＿ので、${t.kana}`, en: `Because ＿, ${t.en}.` };
  const lines = reasons(round, spot, before).map((r) => ({ text: `${r.text}、${t.text}`, kana: `${r.kana}、${t.kana}`, en: `${cap(r.en)}, so ${t.en}.` }));
  return { spot, frame, lines, frames: ['node'], status: 'draft' };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
