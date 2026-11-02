// Katsuyō Raid's answer checks (docs/modes/kana-raid.md, "Green Car").
//
// Forms (Waves 1–2, boss pieces): a closed-set check, like the kana raid's checkSound. What was heard must be
// the badge's form of the yōkai's verb, in any tense or politeness (のまされる, のまされた, のまされました). A
// sibling form of the same verb is refused with a named tip ("That's the causative, のませた…").
//
// Chunks (Wave 3) and the boss's finishing blow: framesOf on what was heard, with the server's tokens, must find
// the badge's frame, and the yōkai's verb must be in it. Everything else in the line is the player's own.

import type { BadgeId, KatsuyoVerb } from '../../../../content/src/katsuyo/verbs.js';
import { BADGE_BY_ID } from '../../../../content/src/katsuyo/verbs.js';
import { framesOf, type FrameId } from '../../japanese/frames.js';
import { normalizeReading, type Utterance } from '../../japanese/kana.js';

const squash = (text: string) => normalizeReading(text);

/** The shapes a form may be said in: tense and politeness, never another badge. */
export function formVariants(badge: BadgeId, kana: string): string[] {
  const k = squash(kana);
  const out = new Set<string>([k]);
  const add = (stem: string, ends: readonly string[]) => ends.forEach((e) => out.add(stem + e));
  if (badge === 'kiru') {
    if (k.endsWith('きれない')) add(k.slice(0, -4), ['きれない', 'きれなかった', 'きれません', 'きれませんでした', 'きれなくて', 'きれず']);
    else add(k.slice(0, -2), ['きる', 'きった', 'きります', 'きりました', 'きって', 'きれる', 'きれない', 'きれなかった', 'きれません']);
  } else if (badge === 'yasui-nikui') {
    // The badge is "easy or hard to": either word, in any shape an い-adjective takes.
    const stem = k.replace(/(やすい|にくい)$/, '');
    for (const w of ['やす', 'にく']) add(stem + w, ['い', 'かった', 'いです', 'かったです', 'く', 'くない', 'くて', 'そう']);
  } else if (badge === 'you-to-suru') {
    add(k.replace(/する$/, ''), ['する', 'した', 'します', 'しました', 'して', 'したら', 'したけど', 'しても']);
  } else if (badge === 'ppanashi' || badge === 'tate') {
    add(k, ['の', 'に', 'で', 'だ', 'です', 'だった', 'でした']);
  } else if (badge === 'zu-ni') {
    // Fixed.
  } else if (k.endsWith('る')) {
    // Passive, potential, causative, made to, suffering passive, ＿かける: all conjugate like ichidan verbs.
    const stem = k.slice(0, -1);
    add(stem, ['る', 'た', 'ます', 'ました', 'ません', 'ませんでした', 'ない', 'なかった', 'て', 'ちゃった']);
    if (badge === 'kakeru') add(stem, ['', 'の', 'だった']);
  }
  return [...out];
}

/** The part of a form that has to be heard in a chunk or a line (the verb, carrying its badge). */
export function formCore(badge: BadgeId, kana: string): string {
  const k = squash(kana);
  if (badge === 'kiru') return k.endsWith('きれない') ? k.slice(0, -3) : k.slice(0, -1);
  if (badge === 'yasui-nikui') return k.replace(/(やすい|にくい)$/, '');
  if (badge === 'you-to-suru') return k.replace(/と?する$/, '');
  if (badge === 'zu-ni' || badge === 'ppanashi' || badge === 'tate') return k.replace(/に$/, '');
  return k.endsWith('る') ? k.slice(0, -1) : k;
}

/** Every reading of an utterance to check: the server's kana reading of kanji, and the text itself. */
export const heard = (u: Utterance): string[] => [u.reading, u.text].filter((t): t is string => !!t).map(squash);

/** Said as a whole answer: the form alone, or at the end of what was said (あめに ふられた for ふられる). */
const says = (said: readonly string[], variants: readonly string[]) => said.some((h) => variants.some((v) => h === v || (h.endsWith(v) && h.length - v.length <= 8)));

export interface FormCheck {
  ok: boolean;
  /** The badge of the sibling form that was said instead, for a named tip. */
  sibling: BadgeId | null;
}

/** Waves 1–2 and boss pieces: was this the verb's form for the badge? */
export function checkForm(said: readonly string[], verb: KatsuyoVerb, badge: BadgeId): FormCheck {
  const form = verb.forms[badge];
  if (!form) return { ok: false, sibling: null };
  if (says(said, formVariants(badge, form.kana))) return { ok: true, sibling: null };
  for (const [other, f] of Object.entries(verb.forms) as [BadgeId, NonNullable<KatsuyoVerb['forms'][BadgeId]>][]) {
    if (other === badge || squash(f.kana) === squash(form.kana)) continue;
    if (says(said, formVariants(other, f.kana))) return { ok: false, sibling: other };
  }
  // The plain verb, said as itself.
  return { ok: false, sibling: null };
}

/** The tip after a wrong form: names the sibling when there was one. */
export function formTip(verb: KatsuyoVerb, badge: BadgeId, sibling: BadgeId | null): string {
  const want = BADGE_BY_ID[badge];
  const form = verb.forms[badge]!;
  if (sibling && verb.forms[sibling]) {
    const got = BADGE_BY_ID[sibling];
    return `That's the ${got.en} (${got.ja}), ${verb.forms[sibling]!.kana}. The badge wants ${want.en}: ${form.kana}.`;
  }
  return `${verb.verb.kana} with ${want.ja} (${want.en}) is ${form.kana}.`;
}

export interface LineCheck {
  ok: boolean;
  /** The badge's frame was heard. */
  frame: boolean;
  /** The yōkai's verb, in its badge form, was heard. */
  verb: boolean;
  /** Words beyond the verb: the player's own word in the gap. */
  ownWord: boolean;
  /** Every frame heard (with the server's tokens), for the phrasebook card. */
  frames: FrameId[];
}

/**
 * Waves 3 and the finishing blow: the badge's frame and the yōkai's verb, heard in what the player said.
 * Frames that need the dictionary (the passive's someone, the causative's suffix) are found from the server's
 * tokens. Where there are none (a typed answer on a server with no reader), the verb's badge form, said with
 * words of the player's own, stands in for them.
 */
export function checkLine(u: Utterance, verb: KatsuyoVerb, badge: BadgeId, minExtra = 2): LineCheck {
  const form = verb.forms[badge];
  const said = heard(u);
  const text = { text: u.text, kana: u.reading ?? u.text };
  const frames = framesOf(text, u.tokens, { keepHidden: true });
  if (!form) return { ok: false, frame: false, verb: false, ownWord: false, frames };
  const core = formCore(badge, form.kana);
  const verbHeard = said.some((h) => h.includes(core));
  // At least `minExtra` kana beyond the form itself: a word of the player's own (さいふを ぬすまれた).
  const ownWord = said.some((h) => h.includes(core) && h.length >= squash(form.kana).length + minExtra);
  const found = frames.includes(badge as FrameId);
  const noTokens = !u.tokens?.length;
  const variants = formVariants(badge, form.kana);
  const frame = found || (noTokens && NEEDS_TOKENS.has(badge) && said.some((h) => variants.some((v) => h.includes(v))));
  return { ok: frame && verbHeard && ownWord, frame, verb: verbHeard, ownWord, frames };
}

/** Frames whose matcher needs the dictionary's word split (shared/src/japanese/frames.ts `pos: 'need'`). */
const NEEDS_TOKENS: ReadonlySet<BadgeId> = new Set(['passive', 'causative', 'suffering-passive']);
