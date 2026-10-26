// Helpers shared by the content test and the reading checker.

import type { JpText } from './src/types.js';

export interface FoundText {
  path: string;
  jp: JpText;
}

const isJpText = (v: unknown): v is JpText =>
  typeof v === 'object' && v !== null && typeof (v as JpText).text === 'string' && typeof (v as JpText).kana === 'string' && typeof (v as JpText).en === 'string';

/** Every JpText anywhere inside `root`, with a readable path for error messages. */
export function collectJpTexts(root: unknown, path = ''): FoundText[] {
  if (isJpText(root)) return [{ path, jp: root }];
  if (Array.isArray(root)) {
    return root.flatMap((v, i) => {
      const id = typeof v === 'object' && v && 'id' in v ? String((v as { id: unknown }).id) : String(i);
      return collectJpTexts(v, `${path}[${id}]`);
    });
  }
  if (typeof root === 'object' && root !== null) {
    return Object.entries(root).flatMap(([k, v]) => collectJpTexts(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** Punctuation, spaces, the blank and {slots} are ignored when comparing readings. */
export const stripForCompare = (s: string): string =>
  s.replace(/\{\w+\}/g, '').replace(/[\s、。！？!?「」『』（）()・…〜~＿,.\-—:：;；"'“”‘’]/g, '');

/** Kana (either script), the long-vowel mark, punctuation, spaces, the blank and {slots}. */
export const isKanaReading = (s: string): boolean => /^[ぁ-ゖァ-ヺー]*$/.test(stripForCompare(s));

export const toHiragana = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * Rough markers of N4 grammar in a kana reading (the language panel's flag:
 * potential, たら/ば, そう, giving and receiving, ては いけない; volitional is
 * too easy to confuse with ましょう and ありがとう to flag automatically).
 * Heuristic: it flags for a human, it doesn't prove anything.
 */
export function n4Markers(kana: string): string[] {
  const k = toHiragana(kana);
  const rules: Array<[string, RegExp]> = [
    ['〜たら', /[ただ]ら[、\s]/],
    ['〜ては いけない', /[てで]は\s?いけな/],
    ['〜ば', /(けれ|[えけげせてねべめれ])ば[、\s]/],
    ['potential/passive 〜られる', /られ(る|ます|ない|ません|た)/],
    ['〜そう', /[いきしちにみりぎびえけせてねべめれ]そう(です|だ|な|に)/],
    ['あげる/くれる/もらう', /(あげ|くれ|もらい|もらっ|もらう)(る|ます|た|て|[、。\s])/],
  ];
  return rules.filter(([, re]) => re.test(k)).map(([name]) => name);
}
