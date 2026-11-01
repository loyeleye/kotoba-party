// The N4 hard-role offer card (docs/n4-hard-roles.md), the same in every game: a kicker, the role, one line
// on what it asks, and two equal buttons, Take it and Not this time. An optional server deadline shows a
// countdown ("No answer means not this time"); when it runs out the card says so and calls onExpire once.

import { h } from '../../../shared/src/dom.js';
import type { JpText } from '../../../content/src/types.js';
import { jpView } from './jp.js';

export interface RoleOfferCard {
  /** The game's own framing, e.g. '⭐ Hard role' or '📋 ふくてんちょう'. */
  kicker: string;
  role?: JpText | null;
  pitch: string;
  /** Labels for the two buttons. Default: Take it / Not this time. */
  take?: string;
  decline?: string;
  /** Small glosses under the labels (Bento's やります / こんかいは いいです). */
  takeGloss?: string;
  declineGloss?: string;
  onTake: () => void;
  onDecline: () => void;
  /** A countdown to this many ms, measured by `now` (the server's clock as the phone knows it). */
  deadline?: { at: number; now: () => number; onExpire?: () => void; expired?: string };
  /** Extra content under the buttons (the scripted line shown while the offer is open, a hint). */
  extra?: (HTMLElement | null)[];
}

function button(label: string, gloss: string | undefined, onclick: () => void): HTMLElement {
  return h('button', { type: 'button', class: 'secondary', onclick }, label, gloss ? h('small', { class: 'role-offer-gloss' }, gloss) : null);
}

export function roleOffer(card: RoleOfferCard): HTMLElement {
  let answered = false;
  const once = (f: () => void) => () => {
    if (answered) return;
    answered = true;
    f();
  };
  const clock = card.deadline ? h('p', { class: 'hint role-offer-clock' }) : null;
  if (card.deadline && clock) {
    const d = card.deadline;
    let fired = false;
    const draw = () => {
      const left = Math.max(0, d.at - d.now());
      clock.textContent = left > 0 ? `${Math.ceil(left / 1000)}s to choose. No answer means not this time.` : (d.expired ?? 'Not this time, then.');
      if (left === 0 && !fired) {
        fired = true;
        d.onExpire?.();
      }
    };
    draw();
    const started = Date.now();
    const timer = setInterval(() => {
      if (!clock.isConnected && Date.now() - started > 1000) return clearInterval(timer);
      draw();
    }, 250);
  }
  return h(
    'div',
    { class: 'role-offer' },
    h('p', { class: 'role-offer-kicker' }, card.kicker),
    card.role ? jpView(card.role, 'n4', { cls: 'role-offer-role' }) : null,
    h('p', {}, card.pitch),
    h(
      'div',
      { class: 'role-offer-btns' },
      button(card.take ?? 'Take it', card.takeGloss, once(card.onTake)),
      button(card.decline ?? 'Not this time', card.declineGloss, once(card.onDecline)),
    ),
    clock,
    ...(card.extra ?? []),
  );
}
