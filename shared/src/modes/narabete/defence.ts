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
  /** Each model line's reason (before 、), in the same order, and the second half: for the replay's gist. */
  reasons: JpText[];
  tail: JpText;
  /** The N4 frames it practises (by name: see shared/src/japanese/frames.ts). */
  frames: readonly string[];
  /** Green Car: the N3 script (n3DefenceScript); left out for the N4 ので script. */
  level?: 'n4' | 'n3';
  /** Green Car N3 script: the frames of each model line, in `lines` order. */
  lineFrames?: readonly (readonly string[])[];
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
 * The theme's word before ので and before a noun. A な-adjective (the theme's `na` flag: たいへん) takes な
 * (たいへんなので, たいへんな もの); an い-adjective or a verb (くさいので, びっくりするので) joins as it is.
 */
function moreForms(theme: Pick<FeelTheme, 'more' | 'na'>): { node: JpText; noun: JpText } {
  const { more, na } = theme;
  return {
    node: { text: `${more.text}${na ? 'なので' : 'ので'}`, kana: `${more.kana}${na ? 'なので' : 'ので'}`, en: more.en },
    noun: { text: `${more.text}${na ? 'な' : ''}`, kana: `${more.kana}${na ? 'な' : ''}`, en: more.en },
  };
}

/** Ready reasons (each already ending in ので), by round and spot. `n` is the neighbour before, for 'after'. */
function reasons(round: { unit: TimeSet['unit'] } | { theme: Pick<FeelTheme, 'more' | 'na'> }, spot: DefenceSpot, n: string): JpText[] {
  if ('theme' in round) {
    const { node, noun } = moreForms(round.theme);
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
      if (spot === 'first') return [jp('いちばん はやい ひなので', "it's the earliest day"), jp('これより まえの ひは ないので', 'no day comes before this')];
      if (spot === 'last') return [jp('いちばん おそい ひなので', "it's the latest day"), jp('これより あとの ひは ないので', 'no day comes after this')];
      return [jp(`${n}さんの ひより あとなので`, `it comes after ${n}'s day`), jp(`${n}さんのより あとの ひなので`, `it's a later day than ${n}'s`)];
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
export function defenceScript(round: { unit: TimeSet['unit'] } | { theme: Pick<FeelTheme, 'more' | 'na'> }, position: number, length: number, before: string): DefenceScript {
  const spot = spotOf(position, length);
  const t = tail(spot, before);
  const frame: JpText = { text: `＿ので、${t.text}`, kana: `＿ので、${t.kana}`, en: `Because ＿, ${t.en}.` };
  const why = reasons(round, spot, before);
  const lines = why.map((r) => ({ text: `${r.text}、${t.text}`, kana: `${r.kana}、${t.kana}`, en: `${cap(r.en)}, so ${t.en}.` }));
  return { spot, frame, lines, reasons: why, tail: t, frames: ['node'], status: 'draft' };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// ---- the Green Car's N3 defence (design: project files n3-coverage/green-car/design.md, "Narabete!") ----
//
// The same spots and tails, with an N3 frame on top of ので: ＿に きまって いる, ＿と いうより, ＿ような きが する
// (the low end); ＿に ちがいない, ＿ような きが する, ＿ほど ＿は ない (the high end); ＿に くらべて, ＿ような きが する
// (after a neighbour). Lines that need a theme's own words (`n3` in cards.ts) are left out for themes without them.
// ＿ほど ＿は ない can't take ので (it ends the thought), so that line says だから instead. All draft.

/** One N3 defence line with the frames it carries (by id: shared/src/japanese/frames.ts). */
export interface N3Line {
  jp: JpText;
  reason: JpText;
  frames: readonly string[];
  /** The frame as shown on the phone: ＿に ちがいない. */
  label: string;
}

/** Every N3 line that fits this spot and theme, before aiming. `n` is the neighbour before, for 'after'. */
export function n3Lines(theme: Pick<FeelTheme, 'more' | 'na' | 'n3'>, spot: DefenceSpot, n: string): N3Line[] {
  const t = tail(spot, n);
  const { node, noun } = moreForms(theme);
  const more = theme.more;
  const line = (reason: JpText, frames: string[], label: string, joiner = '、'): N3Line => ({
    jp: { text: `${reason.text}${joiner}${t.text}`, kana: `${reason.kana}${joiner}${t.kana}`, en: `${cap(reason.en)}, so ${t.en}.` },
    reason,
    frames: ['node', ...frames].filter((f) => joiner === '、' || f !== 'node'),
    label,
  });
  const seems = (before: string, en: string): N3Line =>
    line({ text: `${before}${noun.text} ような きが するので`, kana: `${before}${noun.kana} ような きが するので`, en }, ['you-na-ki'], '＿ような きが する');
  const out: N3Line[] = [];
  if (spot === 'first') {
    if (!theme.na) out.push(line({ text: `ほかの カードの ほうが ${more.text}に きまって いるので`, kana: `ほかの カードの ほうが ${more.kana}に きまって いるので`, en: `the other cards are bound to be ${more.en}` }, ['ni-kimatteiru'], '＿に きまって いる'));
    if (theme.n3) out.push(line({ text: `${more.text}と いうより ${theme.n3.rather.text}`, kana: `${more.kana}と いうより ${theme.n3.rather.kana}`, en: `it's ${theme.n3.rather.en} rather than ${more.en}` }, ['to-iu-yori'], '＿と いうより'));
    out.push(seems('ほかの カードの ほうが ', `I have a feeling the other cards are ${more.en}`));
  } else if (spot === 'last') {
    out.push(line({ text: `いちばん ${more.text}に ちがいないので`, kana: `いちばん ${more.kana}に ちがいないので`, en: `it must be the most of all` }, ['ni-chigainai'], '＿に ちがいない'));
    out.push(seems('いちばん ', `I have a feeling it's the most of all`));
    out.push(line({ text: `これほど ${noun.text} ものは ありません`, kana: `これほど ${noun.kana} ものは ありません`, en: `nothing beats this one` }, ['hodo-wa-nai'], '＿ほど ＿は ない', '。だから、'));
  } else {
    out.push(line({ text: `${n}さんのに くらべて ${node.text}`, kana: `${n}さんのに くらべて ${node.kana}`, en: `compared with ${n}'s, it's ${more.en}` }, ['ni-kurabete'], '＿に くらべて'));
    out.push(seems(`${n}さんのより `, `I have a feeling it's ${more.en} than ${n}'s`));
  }
  return out;
}

/**
 * The N3 defence script for a card: the frame line and two N3 model lines, chosen by `weight` (aim the deal: the
 * frames the defender needs most first; ties keep the order above).
 */
export function n3DefenceScript(theme: Pick<FeelTheme, 'more' | 'na' | 'n3'>, position: number, length: number, before: string, weight: (frames: readonly string[]) => number = () => 0): DefenceScript {
  const spot = spotOf(position, length);
  const t = tail(spot, before);
  const all = n3Lines(theme, spot, before);
  const picked = all
    .map((l, i) => ({ l, i, w: weight(l.frames.filter((f) => f !== 'node')) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, 2)
    .map((x) => x.l);
  const labels = picked.map((l) => l.label).join(' ／ ');
  return {
    spot,
    frame: { text: `${labels}（＋ので）、${t.text}`, kana: `${labels}（＋ので）、${t.kana}`, en: `An N3 reason, then: ${t.en}.` },
    lines: picked.map((l) => l.jp),
    reasons: picked.map((l) => l.reason),
    tail: t,
    frames: [...new Set(picked.flatMap((l) => l.frames))],
    lineFrames: picked.map((l) => l.frames),
    level: 'n3',
    status: 'draft',
  };
}
