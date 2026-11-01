// The TV side of mixed rooms (shared/src/modes/mixedRoom.ts): the commentary booth's replay strip and the
// Gallery's reaction bubbles. The same in every game.

import { h } from '../../../shared/src/dom.js';
import type { Commentary, GalleryBubble } from '../../../shared/src/modes/mixedRoom.js';

/** Where a held key word goes: a gap the same for every word, so its length gives nothing away either. */
export const BOOTH_GAP = '＿＿';

/**
 * The booth: 📺 REPLAY · name, the line with its key word lit, and one line of colour. `holdKey`: a curveball on
 * that word is still open (`keyHeld` in shared/src/modes/mixedRoom.ts), so the word is a gap, in the line and in
 * the note, and the answer can't be read off the TV.
 */
export function boothStrip(c: Pick<Commentary, 'lit' | 'note'>, who: string | null, holdKey = false): HTMLElement {
  const held = holdKey && !!c.lit.key;
  return h(
    'div',
    { class: 'booth' },
    h('p', { class: 'booth-tag' }, who ? `📺 REPLAY · ${who}` : '📺 REPLAY'),
    h('p', { class: 'booth-line', lang: 'ja' }, '「', c.lit.before, c.lit.key ? (held ? h('span', { class: 'booth-gap', 'aria-label': 'missing word' }, BOOTH_GAP) : h('mark', {}, c.lit.key)) : null, c.lit.after, '」'),
    h('p', { class: 'booth-note' }, held ? c.note.split(c.lit.key).join(BOOTH_GAP) : c.note),
  );
}

/** The Gallery's bubbles, in tap order (nothing when nobody has reacted yet). A said one wears a 🎤. */
export function galleryBubbles(tiles: readonly GalleryBubble[]): HTMLElement | null {
  if (!tiles.length) return null;
  return h(
    'div',
    { class: 'gallery-bubbles', 'aria-label': 'Reactions from the Gallery' },
    tiles.map((t, i) =>
      h('span', { class: `gallery-bubble${t.said ? ' said' : ''}`, style: `animation-delay:${i * 120}ms` }, t.emoji, h('span', { lang: 'ja' }, ` ${t.kana}`), t.said ? h('span', { class: 'gallery-said', 'aria-label': 'said out loud' }, ' 🎤') : null),
    ),
  );
}
