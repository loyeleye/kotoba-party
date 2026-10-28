// はじめまして！ on the TV: Pon's guest corner. A テロップ caption names tonight's guest; the turn's
// card sits under it as a banner, once (「アキさんは ＿＿が だいすきです」), and the cards themselves
// show only the blank's word, big, labelled Ａ–Ｄ, so they read from the sofa.
//
//   guest     the caption and the card; bubbles pop as the room answers こちらこそ.
//   write     everyone writes in silence: a ✍ on each player still writing.
//   intro     the cards face down (🔊); each turns face up as the introducer reads its line, or with
//             Pon's paw stamp when he reads it for them. The line being read glows.
//   rank      the cards, the room's argue bubbles, and who has locked their ranking.
//   truth     the cards turn from the least believed up: a lie puffs into its tanuki (ドロン！) with
//             its writer's name; the truth glows (ほんとう！). Then how many found it.
//   おぼえてる？ everyone says what's true about everyone; the TV shows the guests and the count.

import { h, seatShape } from '../../../shared/src/dom.js';
import { flipAt, flipMs, type FactView } from '../../../shared/src/modes/hajimemashite/hajimemashite.js';
import type { HajimeView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { sfx } from '../music/sfx.js';
import type { StageMode } from './types.js';

const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);
const nameOf = (view: RoomView, id: string | null | undefined): string => playerOf(view, id)?.name ?? '';
const seatStyle = (view: RoomView, id: string | null | undefined): string => {
  const seat = playerOf(view, id)?.seat;
  return seat ? `--seat: var(--seat-${seat});` : '';
};
const seatTag = (view: RoomView, id: string): HTMLElement => {
  const seat = playerOf(view, id)?.seat ?? 0;
  return h('span', { class: 'hj-who', style: seatStyle(view, id) }, seat ? h('span', { class: 'hj-seat' }, `${seatShape(seat)}${seat}`) : null, nameOf(view, id));
};

// The flip is timed from when this phase first showed, so a re-render picks it up where it was.
let shown = { seq: -1, at: 0 };
/** Long words step down a size, so a six-kana word stays on one line on its card. */
const sizeOf = (word: string): string => {
  const n = [...word].length;
  return n >= 10 ? ' hj-len10' : n >= 8 ? ' hj-len8' : n >= 6 ? ' hj-len6' : '';
};

function since(view: RoomView): number {
  if (shown.seq !== view.phaseSeq) shown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - shown.at;
}

// Each card's sound plays once per flip, however often the screen redraws.
let sounded = -1;
function playFlip(view: RoomView, game: HajimeView, elapsed: number): void {
  if (sounded === view.phaseSeq || !game.result) return;
  sounded = view.phaseSeq;
  for (const f of game.facts) {
    const at = flipAt(f.flip ?? 0, game.facts.length) - elapsed;
    // The puff lands as the face turns away, about 300 ms into the flip.
    if (at >= 0) sfx(f.kind === 'truth' ? 'right' : 'poof', (at + 300) / 1000);
  }
}

// The cards' words go up as they're read: one "stamp" sound each, once.
const stamped = new Set<string>();
function stampSounds(game: HajimeView): void {
  for (const f of game.facts) {
    if (f.word && !stamped.has(f.id)) {
      stamped.add(f.id);
      sfx('ticket');
    }
  }
}

/** The caption across the top: tonight's guest, and the turn's card as a banner in the third person. */
function head(view: RoomView, game: HajimeView): HTMLElement {
  const card = game.card;
  const blank = card ? card.third.split('＿') : [];
  return h(
    'div',
    { class: 'hj-head' },
    h(
      'div',
      { class: 'hj-telop', style: seatStyle(view, game.guestId) },
      h('span', { class: 'hj-telop-tag', lang: 'ja' }, 'こんやの ゲスト'),
      h('span', { class: 'hj-telop-name', lang: 'ja' }, `${game.guestName}さん`),
      h('span', { class: 'hj-telop-turn' }, `guest ${game.turn} of ${game.totalTurns}`),
    ),
    card
      ? h(
          'div',
          { class: 'hj-banner' },
          h('p', { class: 'hj-card-title' }, h('span', { lang: 'ja' }, card.title.text), h('small', {}, card.title.en)),
          h('p', { class: 'hj-frame', lang: 'ja' }, blank[0] ?? '', h('span', { class: 'hj-blank' }, '＿＿'), blank[1] ?? ''),
        )
      : null,
  );
}

function bubbles(view: RoomView, game: HajimeView): HTMLElement {
  return h(
    'div',
    { class: 'hj-bubbles', 'aria-live': 'polite' },
    game.bubbles.map((b, i) => h('p', { class: 'hj-bubble', style: `${seatStyle(view, b.playerId)} --i: ${i}`, 'data-key': `${b.playerId}:${b.text}` }, h('span', { class: 'hj-bubble-name' }, nameOf(view, b.playerId)), h('span', { lang: 'ja' }, b.text))),
  );
}

function card(view: RoomView, game: HajimeView, f: FactView, elapsed: number): HTMLElement {
  const reading = game.line?.factId === f.id;
  const flipped = f.flip !== undefined;
  const at = flipped ? flipAt(f.flip ?? 0, game.facts.length) - elapsed : 0;
  const face = h(
    'div',
    { class: 'hj-face' },
    h('span', { class: 'hj-label' }, f.label),
    f.word ? h('p', { class: `hj-word${sizeOf(f.word)}${f.hidden ? ' hj-hidden' : ''}`, lang: 'ja' }, f.word) : h('img', { class: 'hj-ear', src: '/stage/assets/icons/lt-mic.png', alt: 'not read yet' }),
    f.read === 'pon' && f.word ? h('span', { class: 'hj-paw', title: 'Pon read this one' }, '🐾') : null,
  );
  const back = flipped
    ? f.kind === 'truth'
      ? h('div', { class: 'hj-back hj-true' }, h('span', { class: 'hj-label' }, f.label), h('p', { class: `hj-word${sizeOf(f.word ?? '')}`, lang: 'ja' }, f.word ?? ''), h('p', { class: 'hj-verdict', lang: 'ja' }, 'ほんとう！'), f.en ? h('p', { class: 'hj-en' }, f.en) : null)
      : h(
          'div',
          { class: 'hj-back hj-lie', style: f.kind === 'pon' ? '' : seatStyle(view, f.authors?.[0] ?? null) },
          h('span', { class: 'hj-puff', 'aria-hidden': 'true' }),
          h('span', { class: 'hj-tanuki', 'aria-hidden': 'true' }, '🦝'),
          h('p', { class: 'hj-word hj-small', lang: 'ja' }, f.word ?? ''),
          h('p', { class: 'hj-verdict', lang: 'ja' }, 'ドロン！'),
          h('p', { class: 'hj-author' }, f.kind === 'pon' ? h('span', { lang: 'ja' }, 'ポンの たぬき') : (f.authors ?? []).map((a) => seatTag(view, a))),
          f.firsts ? h('p', { class: 'hj-firsts' }, `fooled ${f.firsts} first`) : null,
        )
    : null;
  return h(
    'li',
    {
      class: `hj-card${f.word ? ' hj-up' : ''}${reading ? ' hj-reading' : ''}${flipped ? ' hj-flipping' : ''}`,
      style: `${flipped ? `--d: ${Math.round(at)}ms;` : ''}`,
      'data-key': f.id,
    },
    h('div', { class: 'hj-inner' }, face, back),
  );
}

function cards(view: RoomView, game: HajimeView, elapsed: number): HTMLElement {
  return h('ol', { class: `hj-cards hj-n${game.facts.length}${view.phase === 'score' ? ' hj-flip-on' : ''}` }, game.facts.map((f) => card(view, game, f, elapsed)));
}

/** The line below the cards: what's happening now, and who's on. */
function foot(view: RoomView, game: HajimeView, elapsed: number): HTMLElement | null {
  switch (view.phase) {
    case 'prompt':
      return h('p', { class: 'hj-call' }, '👋 ', h('span', { lang: 'ja' }, 'こちらこそ、よろしく おねがいします！'), ' Say it to the guest, from your phone.');
    case 'answer':
      return h('p', { class: 'hj-call' }, '✍ Writing in silence: ', h('strong', {}, 'the guest one truth, the tanuki a lie each.'), game.waitingOn ? ` Waiting for ${game.waitingOn}…` : ' All in!');
    case 'reveal': {
      const line = game.line;
      const who = game.introducerId ? nameOf(view, game.introducerId) : 'Pon';
      const step = line ? (line.kind === 'open' ? 'opening' : line.kind === 'close' ? 'closing' : `card ${line.index} of ${line.total - 2}`) : 'done';
      return h('p', { class: 'hj-call' }, '🎤 ', h('strong', { style: seatStyle(view, game.introducerId) }, who), ` is introducing ${game.guestName}さん · ${step}`, line?.kind === 'open' ? h('span', { class: 'hj-script', lang: 'ja' }, ` 「こちらは ${game.guestName}さんです」`) : null);
    }
    case 'encore':
      return h('p', { class: 'hj-call' }, '📱 Rank them on your phone: ', h('span', { lang: 'ja' }, 'ぜったい ほんとう → ぜったい うそ'), ` · ${game.ready.length} locked`, game.waitingOn ? `, ${game.waitingOn} to go` : '');
    case 'score': {
      const r = game.result;
      if (!r) return null;
      const left = flipMs(r.steps) - elapsed;
      const wish = game.facts.find((f) => f.id === r.wish);
      return h(
        'div',
        { class: 'hj-result', style: `--d: ${Math.round(Math.max(0, left))}ms` },
        h('p', {}, r.ballots ? `${r.found} of ${r.ballots} picked the truth first.` : ''),
        wish ? h('p', {}, `${game.guestName}さん wishes `, h('strong', { lang: 'ja' }, wish.word), ' were true. ', h('span', { lang: 'ja' }, 'ほんとうだったら いいな！')) : null,
      );
    }
    default:
      return null;
  }
}

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'hj-stage hj-intro' },
    h('p', { class: 'hj-logo', lang: 'ja' }, 'はじめまして！'),
    h('p', { class: 'hj-subtitle' }, 'Pon’s guest corner. One card is true; the rest are tanuki in disguise.'),
    h(
      'ol',
      { class: 'hj-steps' },
      h('li', {}, h('strong', {}, '👋 Each turn, one of you is the guest.'), ' Write one true thing about yourself.'),
      h('li', {}, h('strong', {}, '🦝 Everyone else is a tanuki:'), ' write a lie about the guest. In silence!'),
      h('li', {}, h('strong', {}, '🎤 The last guest introduces them,'), ' reading every card aloud: ', h('span', { lang: 'ja' }, '「こちらは アキさんです…」')),
      h('li', {}, h('strong', {}, '📱 Rank the cards'), ' from surely true to surely a lie. Lies above the truth score for their tanuki.'),
    ),
  );
}

function recall(view: RoomView, game: HajimeView): HTMLElement {
  const r = game.recalled;
  return h(
    'div',
    { class: 'hj-stage hj-recall' },
    h('p', { class: 'hj-logo', lang: 'ja' }, 'おぼえてる？'),
    h('p', { class: 'hj-subtitle' }, 'Do you remember? Say what’s true about everyone, from your phone.'),
    r ? h('p', { class: 'hj-call' }, `${r.done} of ${r.total} remembered so far`) : null,
    h('ul', { class: 'hj-faces' }, view.players.map((p) => h('li', { style: seatStyle(view, p.id) }, h('span', { class: 'hj-seat' }, `${seatShape(p.seat)}${p.seat}`), p.name))),
  );
}

export const hajimemashiteStage: StageMode<HajimeView> = {
  badge(game, playerId) {
    if (game.guestId === playerId) return '👋';
    if (game.introducerId === playerId && game.line) return '🎤';
    return game.ready.includes(playerId) ? '✓' : '';
  },

  // Pon's line waits until the last card has turned.
  hostHoldMs(view, game) {
    if (view.phase !== 'score' || !game.result) return 0;
    return Math.max(0, flipMs(game.result.steps) - since(view));
  },

  render(view, game) {
    const elapsed = since(view);
    const calm = view.calmMotion ? ' hj-calm' : '';
    switch (view.phase) {
      case 'intro':
        return intro();
      case 'prompt':
      case 'answer':
        return h('div', { class: `hj-stage hj-turn${calm}` }, head(view, game), h('div', { class: 'hj-tag-row' }, h('div', { class: 'hj-nametag', style: seatStyle(view, game.guestId) }, h('p', { class: 'hj-nametag-top', lang: 'ja' }, 'はじめまして！'), h('p', { class: 'hj-nametag-name', lang: 'ja' }, game.guestName), h('p', { class: 'hj-nametag-en' }, nameOf(view, game.guestId))), bubbles(view, game)), foot(view, game, elapsed));
      case 'reveal':
      case 'encore':
      case 'score':
        if (view.phase === 'reveal') stampSounds(game);
        else stamped.clear();
        if (view.phase === 'score') playFlip(view, game, elapsed);
        return h('div', { class: `hj-stage hj-turn${calm}` }, head(view, game), cards(view, game, elapsed), bubbles(view, game), foot(view, game, elapsed));
      case 'finale':
        return recall(view, game);
      default:
        return h('div', { class: 'hj-stage' });
    }
  },
};
