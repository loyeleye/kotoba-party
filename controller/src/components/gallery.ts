// The phone side of mixed rooms (shared/src/modes/mixedRoom.ts): the Gallery tile for players without the N4
// seat, and the commentary booth's gist for Kana and N5 phones. The same in every game.

import { h } from '../../../shared/src/dom.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { CURVEBALL_POINTS, SAY_PICK, SPOKEN_REACTION_POINTS, type GalleryTileView } from '../../../shared/src/modes/mixedRoom.js';
import { canSpeak, speakBox } from './speak.js';

/**
 * One Gallery tile: four reactions, or the once-a-game curveball. `onPick` gets a reaction id or the kana picked,
 * or SAY_PICK and what was heard for a reaction said out loud (`spokenReaction`: a small 🎤 under the tiles on
 * phones with a mic on, once the line has landed; quiet phones just tap). Send the utterance along with the pick.
 * Each reaction shows its English under the kana (romaji too at Kana level); an answered curveball says what the
 * word means.
 */
export function galleryTile(view: GalleryTileView | null, onPick: (pick: string, utterance?: Utterance) => void): HTMLElement | null {
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
            { type: 'button', class: `secondary${view.picked === o.kana ? ' picked' : ''}${view.answer === o.kana ? ' right' : ''}`, disabled: view.picked != null, onclick: pick(o.kana) },
            h('span', { lang: 'ja' }, o.kana),
            o.romaji ? h('small', {}, o.romaji) : null,
          ),
        ),
      ),
      view.right == null ? null : h('p', { class: 'hint' }, ...curveballHint(view)),
    );
  }
  const canSay = !!view.say && canSpeak();
  return h(
    'div',
    { class: 'gallery' },
    h('p', { class: 'gallery-kicker' }, canSay ? '🎭 React: tap one or say it. It pops up on the TV' : '🎭 React: your tap pops up on the TV'),
    h(
      'div',
      { class: 'gallery-btns' },
      view.tiles.map((t) =>
        h(
          'button',
          { type: 'button', class: `secondary${view.picked === t.id ? ' picked' : ''}`, disabled: view.picked != null, onclick: pick(t.id), 'aria-label': t.en },
          h('span', { 'aria-hidden': 'true' }, t.emoji),
          h('span', { lang: 'ja' }, ` ${t.kana}`),
          h('small', {}, t.romaji ? `${t.romaji} · ${t.en}` : t.en),
        ),
      ),
    ),
    view.say && !view.picked && canSay
      ? h(
          'div',
          { class: 'gallery-say' },
          // A miss sends nothing back but this hint: the tiles are still there to tap.
          view.say.missed ? h('p', { class: 'hint' }, 'Didn’t catch that. Say it again, or just tap.') : null,
          // "Hold" becomes "Tap" on a tap-to-talk phone (speakLabels.ts tapWording); the table has no level wording for it.
          speakBox({ label: `Hold and say it 🎤 (+${SPOKEN_REACTION_POINTS})`, speechOnly: true, autoSend: true, mini: true, onSend: (u) => !sent && onPick(SAY_PICK, u) }),
        )
      : null,
    view.picked ? h('p', { class: 'hint' }, view.say?.said ? `Said it! +${SPOKEN_REACTION_POINTS}. On the TV now.` : 'On the TV now.') : null,
  );
}

/** An answered curveball's line: right or not, the word, its romaji and (when there's a gloss) what it means. */
function curveballHint(view: Extract<GalleryTileView, { kind: 'curveball' }>): (HTMLElement | string)[] {
  const word = h('span', { lang: 'ja' }, view.answer ?? '');
  const romaji = view.answerRomaji ? ` (${view.answerRomaji})` : '';
  const paid = `Yes! +${view.paid ?? CURVEBALL_POINTS}`;
  if (view.gloss) return view.right ? [`${paid}. `, word, `${romaji} means “${view.gloss}”.`] : ['It was ', word, `${romaji}: “${view.gloss}”. Listen for it next time!`];
  return view.right ? [paid] : ['It was ', word, `${romaji}. Nice try!`];
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
