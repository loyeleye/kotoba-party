// The natural version: the winning answer as a whole sentence the room can shout back. It is
// only the winner's line when that line is good Japanese and has the form the prompt's tip
// teaches; otherwise it is the prompt's model answer, which always matches its tip.

import type { JpText, OogiriPrompt } from '../../../../content/src/types.js';
import { fillBlank, sentenceFor } from './answer.js';
import { stageVersion } from './deal.js';

/**
 * What the answer is made of, as far as the natural version cares. `noun`: one noun tile.
 * `adj`: one adjective tile in its plain form (あつい). `pred`: one verb tile, or an adjective
 * in a polite form (あつかったです). `free`: said or typed with nothing else. `mixed`: several
 * pieces side by side. `phrase`: a set-phrase frame (Photo Caption).
 */
export type AnswerShape = 'noun' | 'adj' | 'pred' | 'free' | 'mixed' | 'phrase';

/** How a sentence ends, for matching the winner's form to the tip's. */
export type Ending = 'masu' | 'mashita' | 'masen' | 'masen-deshita' | 'mashou' | 'tai' | 'kudasai' | 'desu' | 'deshita' | 'adj-past' | 'adj-neg';

const ENDINGS: [Ending, RegExp][] = [
  ['masen-deshita', /ませんでした$/],
  ['masen', /ません(か)?$/],
  ['mashita', /ました$/],
  ['mashou', /ましょう$/],
  ['masu', /ます(か)?$/],
  ['tai', /たいです$/],
  ['kudasai', /ください$/],
  ['adj-past', /かったです$/],
  ['adj-neg', /くないです$/],
  ['deshita', /でした$/],
  ['desu', /です(か)?$/],
];

/** The marker a tip names when it teaches each ending. です is checked on its own (not たいです etc.). */
const MARKERS: Record<Ending, RegExp> = {
  // すみません is an apology, not the ません form: a prompt that opens with it doesn't already show a ません tip.
  'masen-deshita': /(?<!すみ)ませんでした/,
  masen: /(?<!すみ)ません/,
  mashita: /ました/,
  mashou: /ましょう/,
  masu: /ます/,
  tai: /たい/,
  kudasai: /ください/,
  'adj-past': /かった/,
  'adj-neg': /くない/,
  deshita: /でした/,
  desu: /(?<![たっいし])です/,
};

const TRAILING = /[\s　。、！？!?…」』）)]+$/u;
const strip = (s: string) => s.replace(TRAILING, '');

/** The polite ending a sentence (or a clause) ends in, or null for a bare noun or plain form. */
export function endingOf(text: string): Ending | null {
  const t = strip(text);
  for (const [e, re] of ENDINGS) if (re.test(t)) return e;
  return null;
}

const BLANK = /＿+/;
const squash = (s: string) => s.replace(/[\s　。、！？!?…]/gu, '');

/** True when the blank ends a clause (a verb or です goes in it), not a slot before a particle. */
export function blankIsPredicate(version: JpText): boolean {
  const after = version.text.split(BLANK)[1] ?? '';
  return /^[\s　]*([。！？!?」』…]|か[\s　]*([。！？!?」』]|$)|$)/u.test(after);
}

/** What the prompt's model answer puts in the blank, or null if it can't be lined up. */
export function exampleFill(prompt: OogiriPrompt): string | null {
  const [pre, post] = stageVersion(prompt).text.split(BLANK);
  if (pre === undefined || post === undefined) return null;
  // Line up ignoring spaces and punctuation, but cut the original so sentence breaks survive.
  const raw = [...prompt.exampleAnswer.text];
  const kept = raw.map((c, i) => [c, i] as const).filter(([c]) => squash(c) !== '');
  const ex = kept.map(([c]) => c).join('');
  const p = squash(pre);
  const q = squash(post);
  if (!ex.startsWith(p) || !ex.endsWith(q) || ex.length < p.length + q.length) return null;
  if (ex.length === p.length + q.length) return '';
  const from = kept[p.length]![1];
  const to = kept[ex.length - q.length - 1]![1];
  return raw.slice(from, to + 1).join('');
}

/** The tip is about an い-adjective in the blank (あついです), so a noun there doesn't show it. */
export const wantsAdjective = (pattern: string) => /adjective \+ です/i.test(pattern);

/** The endings a tip names (ました, ません, です …). */
const named = (pattern: string) => (Object.keys(MARKERS) as Ending[]).filter((e) => MARKERS[e].test(pattern));

/**
 * Whether a sentence ending in `got` shows the tip. A tip that names no ending is about
 * something else in the sentence (でも, で, の …), and one whose form is already in the prompt
 * (「…」と 言いました) is shown whatever goes in the blank; otherwise the blank must have it.
 */
function showsTip(prompt: OogiriPrompt, version: JpText, got: (Ending | null)[]): boolean {
  const forms = named(prompt.pattern);
  if (!forms.length) return true;
  const outside = version.text.replace(BLANK, '');
  if (forms.some((e) => MARKERS[e].test(outside))) return true;
  return got.some((e) => e !== null && forms.includes(e));
}

/** The ending of each sentence in an answer (待って ください。おかねが ありません → both). */
const endingsIn = (text: string) => text.split(/[。！？!?]/).filter((x) => x.trim()).map(endingOf);

/** The clause the blank sits in has a topic (父は ＿＿＿), so "N です/でした" reads as a sentence. */
const hasTopic = (version: JpText) => /は/.test((version.text.split(BLANK)[0] ?? '').split(/[。：:「、]/).pop() ?? '');

interface Winner {
  text: string;
  kana: string;
  /** English for the blank. */
  en: string;
  shape: AnswerShape;
}

const plus = (w: Winner, jp: string, en = w.en): Winner => ({ ...w, text: w.text + jp, kana: w.kana + jp, en });
const unquote = (en: string) => en.replace(/^“(.*)”$/s, '$1');

/**
 * The winner's whole sentence when it is natural and shows the tip's form, else null (use the
 * prompt's model answer). Small repairs make a fair answer whole: です after a plain adjective
 * or 〜たい, でした/です after a noun when that is the form taught, だ before a から of reason,
 * or the prompt's noun bridge (〜に なりました) for a noun dropped where a verb goes.
 */
export function naturalSentence(prompt: OogiriPrompt, winner: Winner): JpText | null {
  if (winner.shape === 'mixed') return null;
  const nounish = winner.shape === 'noun' || (winner.shape === 'free' && endingOf(winner.text) === null);
  const made = fit(prompt, winner, nounish);
  if (made || !nounish || !prompt.nounBridge) return made;
  const b = prompt.nounBridge;
  const bridged: Winner = { text: fillBlank(b.text, winner.text), kana: fillBlank(b.kana, winner.kana), en: fillBlank(b.en, unquote(winner.en), true), shape: 'phrase' };
  return fit(prompt, bridged, false);
}

function fit(prompt: OogiriPrompt, winner: Winner, nounish: boolean): JpText | null {
  const version = stageVersion(prompt);
  const adjTip = wantsAdjective(prompt.pattern);
  const after = version.text.split(BLANK)[1] ?? '';
  let w = winner;

  if (/^から/.test(after)) {
    // A reason (＿＿＿から): a clause, so a noun takes だ (タコだから).
    if (nounish) w = plus(w, 'だ');
    return showsTip(prompt, version, []) ? sentenceFor(version, w) : null;
  }

  if (!blankIsPredicate(version) || /^」/.test(after)) {
    // A slot before a particle or です takes a noun; an adjective only straight before です.
    // A whole quote (「＿＿＿」) takes either, or a sentence when the tip wants a form there.
    const quote = /^」/.test(after);
    const beforeCopula = /^(です|でした|じゃ)/.test(after);
    // The form the clause ends in once the answer is in (夏休みに タコです → です).
    const clause = endingOf((w.text + after).split(/[。！？!?」]/)[0] ?? '');
    if (/て-form/.test(prompt.pattern) && /^も/.test(after) && !/[てで]$/.test(w.text)) return null;
    if (adjTip) return w.shape === 'adj' && beforeCopula ? sentenceFor(version, w) : null;
    if (!quote && (nounish || (w.shape === 'adj' && beforeCopula) || w.shape === 'phrase'))
      return showsTip(prompt, version, [clause]) ? sentenceFor(version, w) : null;
    if (quote && nounish) return showsTip(prompt, version, []) ? sentenceFor(version, w) : null;
    if (!quote) return null;
  }

  // A blank that ends the clause needs a predicate: make one, or give up.
  const quoted = /「[^」]*＿/.test(version.text);
  const fill = exampleFill(prompt);
  if (fill !== null && endingOf(fill) === null && nounish && !adjTip) return sentenceFor(version, w);
  if (w.shape === 'adj') w = plus(w, 'です', quoted ? w.en : `is ${w.en}`);
  else if (/たい$/.test(w.text)) w = plus(w, 'です');
  else if (nounish) {
    const copula = named(prompt.pattern).find((e) => e === 'deshita' || e === 'desu');
    if (adjTip || !copula || !hasTopic(version)) return null;
    w = plus(w, copula === 'deshita' ? 'でした' : 'です', quoted ? w.en : `${copula === 'deshita' ? 'was' : 'is'} ${w.en}`);
  }
  if (endingOf(w.text) === null) return null;
  if (adjTip && !/いです$/.test(strip(w.text))) return null;
  return showsTip(prompt, version, endingsIn(w.text)) ? sentenceFor(version, w) : null;
}
