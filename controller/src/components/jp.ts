// One way to show a line of Japanese on a phone, by the player's level (the art panel's script
// policy):
//
//   かな  kana is the hero line (as written, with its word spaces), romaji under it in gold, then
//         English; the kanji spelling, if any, is small grey print ("written 待ちます").
//   N5/N4 the written text, with furigana above the kanji where the content has it; without
//         furigana the kana reading is a small line under it.

import { h, ruby } from '../../../shared/src/dom.js';
import { hasKanji } from '../../../shared/src/japanese/kana.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { Level } from '../../../content/src/types.js';

export interface JpLike {
  text: string;
  kana?: string | null;
  en?: string | null;
  furigana?: readonly (readonly [string, string])[];
  /** Romaji worked out by the server; made here for かな players when missing. */
  romaji?: string;
}

export interface JpViewOptions {
  /** 'line' (default) is a block of paragraphs; 'tile' is spans inside a button. */
  as?: 'line' | 'tile';
  en?: boolean;
  romaji?: boolean;
  cls?: string;
}

export function jpView(t: JpLike, level: Level | null | undefined, opts: JpViewOptions = {}): HTMLElement {
  const tile = opts.as === 'tile';
  const part = (cls: string, ...kids: (Node | string | null)[]) => h(tile ? 'span' : 'p', { class: cls }, ...kids);
  const kana = t.kana || t.text;
  const en = opts.en !== false && t.en ? part('jpv-en', t.en) : null;
  if (level === 'kana') {
    const romaji = opts.romaji !== false ? (t.romaji ?? toRomaji(kana)) : '';
    return h(
      tile ? 'span' : 'div',
      { class: `jpv kana ${opts.cls ?? ''}` },
      part('jpv-main', h('span', { lang: 'ja' }, kana)),
      romaji ? part('jpv-romaji', romaji) : null,
      en,
      hasKanji(t.text) ? part('jpv-written', 'written ', h('span', { lang: 'ja' }, t.text)) : null,
    );
  }
  const withRuby = !!t.furigana?.length;
  return h(
    tile ? 'span' : 'div',
    { class: `jpv ${opts.cls ?? ''}` },
    part('jpv-main', ruby(t)),
    !withRuby && t.kana && t.kana !== t.text ? part('jpv-kana', h('span', { lang: 'ja' }, t.kana)) : null,
    en,
  );
}
