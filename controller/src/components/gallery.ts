// The phone side of mixed rooms (shared/src/modes/mixedRoom.ts): the Gallery tile for players without the N4
// seat, and the commentary booth's gist for Kana and N5 phones. The same in every game.

import { h } from '../../../shared/src/dom.js';
import type { GalleryTileView } from '../../../shared/src/modes/mixedRoom.js';

/** One Gallery tile: four reactions, or the once-a-game curveball. `onPick` gets a reaction id or the kana picked. */
export function galleryTile(view: GalleryTileView | null, onPick: (pick: string) => void): HTMLElement | null {
  if (!view) return null;
  let sent = false;
  const pick = (p: string) => () => {
    if (sent) return;
    sent = true;
    onPick(p);
  };
  if (view.kind === 'curveball') {
    return h(
      'div',
      { class: 'gallery gallery-curveball' },
      h('p', { class: 'gallery-kicker' }, '🎯 Which word did you hear?'),
      h(
        'div',
        { class: 'gallery-btns' },
        view.options.map((o) =>
          h(
            'button',
            { type: 'button', class: `secondary${view.picked === o.kana ? ' picked' : ''}`, disabled: view.picked != null, onclick: pick(o.kana) },
            h('span', { lang: 'ja' }, o.kana),
            o.romaji ? h('small', {}, o.romaji) : null,
          ),
        ),
      ),
      view.right == null ? null : h('p', { class: 'hint' }, view.right ? 'Yes! +5' : 'Good try. Listen for it next time.'),
    );
  }
  return h(
    'div',
    { class: 'gallery' },
    h('p', { class: 'gallery-kicker' }, '🎭 React from the Gallery'),
    h(
      'div',
      { class: 'gallery-btns' },
      view.tiles.map((t) =>
        h(
          'button',
          { type: 'button', class: `secondary${view.picked === t.id ? ' picked' : ''}`, disabled: view.picked != null, onclick: pick(t.id), 'aria-label': t.en },
          h('span', { 'aria-hidden': 'true' }, t.emoji),
          h('span', { lang: 'ja' }, ` ${t.kana}`),
        ),
      ),
    ),
  );
}

/** The commentary booth's gist on a Kana or N5 phone: what was said, at their level (never a correction). */
export function boothGist(g: { kana: string; en: string; emoji: string | null; romaji: string | null } | null, kicker = '📺 Replay'): HTMLElement | null {
  if (!g) return null;
  return h(
    'div',
    { class: 'booth-gist' },
    h('p', { class: 'gallery-kicker' }, kicker),
    g.emoji ? h('p', { class: 'booth-gist-emoji', 'aria-hidden': 'true' }, g.emoji) : null,
    h('p', { class: 'booth-gist-ja', lang: 'ja' }, g.kana),
    g.romaji ? h('p', { class: 'booth-gist-romaji' }, g.romaji) : null,
    h('p', { class: 'booth-gist-en' }, g.en),
  );
}
