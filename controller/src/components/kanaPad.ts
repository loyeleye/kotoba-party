// A built-in kana keyboard, so players without a Japanese keyboard can still type kana.

import { h } from '../../../shared/src/dom.js';
import { toKatakana } from '../../../shared/src/japanese/kana.js';

const ROWS = [
  'あいうえお',
  'かきくけこ',
  'さしすせそ',
  'たちつてと',
  'なにぬねの',
  'はひふへほ',
  'まみむめも',
  'や ゆ よ',
  'らりるれろ',
  'わ を ん',
];

const DAKUTEN: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  ば: 'ぱ', び: 'ぴ', ぶ: 'ぷ', べ: 'ぺ', ぼ: 'ぽ',
  う: 'ゔ',
};
const SMALL: Record<string, string> = { あ: 'ぁ', い: 'ぃ', う: 'ぅ', え: 'ぇ', お: 'ぉ', つ: 'っ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ', わ: 'ゎ' };

/** Builds a kana pad that types into `input`. */
export function kanaPad(input: HTMLInputElement): HTMLElement {
  let katakana = false;
  const insert = (text: string) => {
    input.value += katakana ? toKatakana(text) : text;
    input.dispatchEvent(new Event('input'));
  };
  const replaceLast = (map: Record<string, string>) => {
    const chars = [...input.value];
    const last = chars.pop();
    if (!last) return;
    const hira = String.fromCodePoint(last.codePointAt(0)! - (last >= 'ァ' && last <= 'ヶ' ? 0x60 : 0));
    // Tapping ゛ again on a voiced kana moves on to ゜ (は → ば → ぱ) or back.
    const next = map[hira] ?? Object.entries(map).find(([, v]) => v === hira)?.[0];
    if (!next) return;
    chars.push(katakana || (last >= 'ァ' && last <= 'ヶ') ? toKatakana(next) : next);
    input.value = chars.join('');
    input.dispatchEvent(new Event('input'));
  };

  const pad = h('div', { class: 'kana-pad' });
  const draw = () => {
    pad.replaceChildren(
      ...ROWS.map((row) =>
        h(
          'div',
          { class: 'kana-row' },
          [...row].map((ch) =>
            ch === ' '
              ? h('span', { class: 'kana-gap' })
              : h('button', { type: 'button', class: 'kana-key', onclick: () => insert(ch) }, katakana ? toKatakana(ch) : ch),
          ),
        ),
      ),
      h(
        'div',
        { class: 'kana-row tools' },
        h('button', { type: 'button', class: 'kana-key', onclick: () => replaceLast(DAKUTEN) }, '゛゜'),
        h('button', { type: 'button', class: 'kana-key', onclick: () => replaceLast(SMALL) }, '小'),
        h('button', { type: 'button', class: 'kana-key', onclick: () => insert('ー') }, 'ー'),
        h(
          'button',
          {
            type: 'button',
            class: 'kana-key',
            onclick: () => {
              katakana = !katakana;
              draw();
            },
          },
          katakana ? 'あ' : 'ア',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'kana-key wide',
            onclick: () => {
              input.value = [...input.value].slice(0, -1).join('');
              input.dispatchEvent(new Event('input'));
            },
          },
          '⌫',
        ),
      ),
    );
  };
  draw();
  return pad;
}
