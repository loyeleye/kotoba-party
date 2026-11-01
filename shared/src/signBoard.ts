// Read the Signs: station boards for the phone and the TV. Only the kanji and an arrow go on a board, never
// its reading (reading it is the task). Exits are yellow and toilets blue and red, as at Japanese stations;
// the rest are the usual dark board. Styles: .lt-sign* in controller/ and stage/ lastTrain.css.

import type { StationSign } from '../../content/src/types.js';
import { h } from './dom.js';

/**
 * The boards, side by side (a pair always sits on one row, left sign on the left). The arrow is a drawn
 * shape, so a screen reader hears "Station sign" rather than the kanji, which is the answer.
 * `outline` marks the asked-about sign (TV reveal only).
 */
export function signBoard(signs: readonly StationSign[], opts: { small?: boolean; outline?: boolean } = {}): HTMLElement {
  return h(
    'div',
    { class: `lt-signs${signs.length > 1 ? ' pair' : ''}${signs.length > 1 && signs.some((s) => [...s.text].length >= 3) ? ' long' : ''}${opts.small ? ' small' : ''}`, role: 'img', 'aria-label': signs.length > 1 ? 'Station signs' : 'Station sign' },
    signs.map((s) =>
      h(
        'div',
        { class: `lt-sign${s.kind ? ` ${s.kind}` : ''}${opts.outline && s.target ? ' target' : ''}${opts.outline && !s.target && signs.length > 1 ? ' dim' : ''}`, 'aria-hidden': 'true' },
        s.arrow === 'left' || s.arrow === 'up' ? h('span', { class: `lt-sign-arrow ${s.arrow}` }) : null,
        h('span', { class: 'lt-sign-text', lang: 'ja' }, s.text),
        s.arrow === 'right' ? h('span', { class: 'lt-sign-arrow right' }) : null,
      ),
    ),
  );
}
