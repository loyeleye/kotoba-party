// Narabete! on the TV. The line runs along Nobiko-san's neck, low end on the left, her head at the
// high end. Nothing here shows a secret before the flip:
//
//   deal     the round's title and the neck's two ends; "look at your phone".
//   say      who has said their card (a 🔊 on their chip), never what it was.
//   order    the cards on the neck in the room's order: Time Line cards show their picture, Feelings
//            cards their answer; 🔒 when the owner is happy, 🙋 when someone asked to hear it again.
//   defence  the most-moved card lifts off the neck and its author says why it belongs there.
//   flip     Nobiko-san turns the cards over from the low end, one per step, a rising note each; a
//            knot ties in her neck between two cards out of order; the biggest surprise flips last.
//   story    round 3's answers, low to high, read out in turn with 「そして…」 between them.

import { h, ruby } from '../../../shared/src/dom.js';
import { FLIP_LEAD_MS, FLIP_STEP_MS, flipMs, type LineCard } from '../../../shared/src/modes/narabete/narabete.js';
import type { NarabeteView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { flipNote } from '../music/sfx.js';
import type { StageMode } from './types.js';

const KIND = { time: 'Time Line · じかんの ならび', feel: 'Feelings Line · きもちの ならび', story: 'The Worst Day Ever · さいあくの いちにち' } as const;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';

// The stage redraws on every update, so the flip is timed from when this phase first showed: a
// re-render (a vote coming in) picks the animation up where it was rather than starting again.
let shown = { seq: -1, at: 0 };
function since(view: RoomView): number {
  if (shown.seq !== view.phaseSeq) shown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - shown.at;
}

// The rising scale plays once per flip, however many times the screen redraws.
let scaled = -1;
function playScale(view: RoomView, game: NarabeteView, elapsed: number): void {
  if (scaled === view.phaseSeq || !game.flip) return;
  scaled = view.phaseSeq;
  const byFlip = [...game.line].sort((a, b) => (a.flip ?? 0) - (b.flip ?? 0));
  byFlip.forEach((c, step) => {
    const at = FLIP_LEAD_MS + step * FLIP_STEP_MS - elapsed;
    if (at >= 0) flipNote(step, at / 1000, knotted(game, c));
  });
}

/** Did this card's flip tie a knot (it sits out of order with a neighbour already turned)? */
function knotted(game: NarabeteView, c: LineCard): boolean {
  const i = game.line.indexOf(c);
  const left = game.line[i - 1];
  const right = game.line[i + 1];
  return (!!left?.knotAfter && (left.flip ?? 0) < (c.flip ?? 0)) || (!!c.knotAfter && !!right && (right.flip ?? 0) < (c.flip ?? 0));
}

function head(game: NarabeteView, view: RoomView): HTMLElement {
  return h(
    'div',
    { class: 'nb-head' },
    h('p', { class: 'nb-tag' }, `${game.kind ? KIND[game.kind] : ''} · round ${game.round} of ${game.totalRounds}`),
    game.title ? h('p', { class: 'nb-title' }, ruby(game.title), h('small', {}, game.title.en)) : null,
    view.phase === 'prompt' ? h('p', { class: 'nb-call' }, '🤫 Look at your phone: a secret card for you!') : null,
  );
}

/** The value printed on a flipped card: the clock or price for a Time card, the secret number for Feelings. */
const valueOf = (c: LineCard): string => c.label ?? String(c.value ?? '');

function card(view: RoomView, game: NarabeteView, c: LineCard, i: number, elapsed: number): HTMLElement {
  const flipped = c.flip !== undefined;
  const at = flipped ? FLIP_LEAD_MS + (c.flip ?? 0) * FLIP_STEP_MS - elapsed : 0;
  const defending = game.defence?.playerId === c.ownerId && view.phase === 'encore';
  const face = h(
    'div',
    { class: 'nb-face' },
    c.emoji ? h('span', { class: 'nb-emoji', 'aria-hidden': 'true' }, c.emoji) : game.kind === 'time' ? h('span', { class: 'nb-emoji nb-ear', 'aria-hidden': 'true' }, '🔊') : null,
    c.text && game.kind !== 'time' ? h('p', { class: `nb-text${c.hidden ? ' nb-hidden' : ''}`, lang: 'ja' }, c.text) : null,
    h('p', { class: 'nb-name' }, nameOf(view, c.ownerId)),
    view.phase === 'reveal'
      ? h('p', { class: 'nb-flags' }, c.locked ? h('span', { class: 'nb-lock' }, '🔒') : null, c.again ? h('span', { class: 'nb-again' }, `🙋 ${c.again}`) : null)
      : null,
  );
  const back = flipped
    ? h(
        'div',
        { class: 'nb-back' },
        h('p', { class: 'nb-value' }, valueOf(c)),
        c.text && game.kind === 'time' ? h('p', { class: 'nb-sentence', lang: 'ja' }, c.text) : null,
        c.text && game.kind !== 'time' ? h('p', { class: `nb-text${c.hidden ? ' nb-hidden' : ''}`, lang: 'ja' }, c.text) : null,
        c.en && !c.hidden ? h('p', { class: 'nb-en' }, c.en) : null,
        h('p', { class: 'nb-name' }, nameOf(view, c.ownerId), c.votes ? h('span', { class: 'nb-votes' }, ` ❤ ${c.votes}`) : null),
      )
    : null;
  return h(
    'li',
    {
      class: `nb-card${flipped ? ' nb-flipping' : ''}${c.last ? ' nb-last' : ''}${defending ? ' nb-defending host-target' : ''}`,
      style: `--d: ${Math.round(at)}ms; --i: ${i}`,
    },
    h('div', { class: 'nb-inner' }, face, back),
  );
}

/** Marks between neighbours, on the neck: a knot where they're out of order, a tick where they're fine. */
function joints(game: NarabeteView, elapsed: number): HTMLElement[] {
  if (!game.flip) return [];
  return game.line.slice(0, -1).map((c, i) => {
    const next = game.line[i + 1]!;
    const at = FLIP_LEAD_MS + Math.max(c.flip ?? 0, next.flip ?? 0) * FLIP_STEP_MS + 450 - elapsed;
    return h('span', { class: `nb-joint ${c.knotAfter ? 'nb-knot' : 'nb-ok'}`, style: `--d: ${Math.round(at)}ms; --x: ${i + 1}`, 'aria-hidden': 'true' }, c.knotAfter ? '' : '✓');
  });
}

function neck(view: RoomView, game: NarabeteView, elapsed: number): HTMLElement {
  const n = Math.max(1, game.line.length);
  return h(
    'div',
    { class: `nb-ruler nb-n${Math.min(n, 8)}`, style: `--n: ${n}` },
    h('ol', { class: 'nb-line' }, game.line.map((c, i) => card(view, game, c, i, elapsed))),
    h(
      'div',
      { class: 'nb-neck' },
      h('span', { class: 'nb-collar', 'aria-hidden': 'true' }),
      h('span', { class: 'nb-band', 'aria-hidden': 'true' }),
      h('span', { class: 'nb-nobiko', 'aria-hidden': 'true' }),
      ...joints(game, elapsed),
    ),
    h(
      'div',
      { class: 'nb-ends' },
      game.low ? h('p', { class: 'nb-low' }, '◀ ', ruby(game.low), h('small', {}, game.low.en)) : null,
      game.high ? h('p', { class: 'nb-high' }, ruby(game.high), h('small', {}, game.high.en), ' ▶') : null,
    ),
  );
}

function chips(view: RoomView, game: NarabeteView): HTMLElement {
  const playing = game.line.map((c) => c.ownerId);
  return h(
    'ul',
    { class: 'nb-chips' },
    playing.map((id) => h('li', { class: `nb-chip${game.said.includes(id) ? ' nb-said' : ''}` }, game.said.includes(id) ? '🔊 ' : '… ', nameOf(view, id))),
  );
}

function result(view: RoomView, game: NarabeteView, elapsed: number): HTMLElement | null {
  const f = game.flip;
  if (!f) return null;
  const at = flipMs(f.steps) - elapsed;
  return h(
    'div',
    { class: `nb-result${f.perfect ? ' nb-perfect' : ''}`, style: `--d: ${Math.round(at)}ms` },
    f.perfect
      ? h('p', { class: 'nb-result-big' }, h('span', { lang: 'ja' }, 'ぴったり！'), ` Perfect line! +${f.teamPoints} each`)
      : h('p', { class: 'nb-result-big' }, `${f.pairs} of ${f.maxPairs} pairs in order · +${f.teamPoints} each`),
    f.poker ? h('p', { class: 'nb-poker' }, `🃏 Poker face: ${nameOf(view, f.poker)}’s card fooled the room the most`) : null,
    game.kind !== 'time' ? h('p', { class: 'nb-vote-call' }, '❤ On your phone: vote for the funniest answer') : null,
  );
}

function story(view: RoomView, game: NarabeteView): HTMLElement {
  const st = game.story!;
  const byId = new Map(game.line.map((c) => [c.id, c]));
  return h(
    'div',
    { class: 'nb-stage nb-story' },
    h('p', { class: 'nb-tag' }, KIND.story),
    game.title ? h('p', { class: 'nb-title' }, ruby(game.title), h('small', {}, game.title.en)) : null,
    h(
      'ol',
      { class: 'nb-story-lines' },
      st.order.map((id, i) => {
        const c = byId.get(id);
        const now = i === st.index;
        return h(
          'li',
          { class: `nb-story-line${now ? ' nb-now host-target' : ''}${i < st.index ? ' nb-done' : ''}${i > st.index ? ' nb-later' : ''}` },
          i > 0 ? h('span', { class: 'nb-soshite', lang: 'ja' }, 'そして… ') : null,
          h('span', { class: 'nb-story-text', lang: 'ja' }, i <= st.index ? (c?.text ?? '') : '・・・'),
          h('span', { class: 'nb-story-who' }, nameOf(view, c?.ownerId)),
        );
      }),
    ),
    h('p', { class: 'nb-call' }, st.current ? `🎤 ${nameOf(view, byId.get(st.current)?.ownerId)}, read your line!` : 'おしまい! The end.'),
  );
}

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'nb-stage nb-intro' },
    h('p', { class: 'nb-logo', lang: 'ja' }, 'ならべて！'),
    h('p', { class: 'nb-subtitle' }, 'Line them up! Everyone holds a secret card.'),
    h(
      'ol',
      { class: 'nb-steps' },
      h('li', {}, h('strong', {}, '🤫 Your card is secret.'), ' Only your phone shows it.'),
      h('li', {}, h('strong', {}, '🔊 Say it out loud.'), ' Listen to everyone else’s.'),
      h('li', {}, h('strong', {}, '◀ ▶ Move your own card'), ' along Nobiko-san’s neck, low to high. Talk it over!'),
      h('li', {}, h('strong', {}, '🪢 The flip:'), ' every pair in order scores for the whole team.'),
    ),
  );
}

export const narabeteStage: StageMode<NarabeteView> = {
  badge(game, playerId) {
    if (game.locked.includes(playerId)) return '🔒';
    if (game.said.includes(playerId)) return '🔊';
    return '';
  },

  // Nobiko-san's reaction waits for the last card to turn over.
  hostHoldMs(view, game) {
    if (view.phase !== 'score' || !game.flip) return 0;
    return Math.max(0, flipMs(game.flip.steps) - since(view));
  },

  render(view, game) {
    const elapsed = since(view);
    switch (view.phase) {
      case 'intro':
        return intro();
      case 'prompt':
      case 'answer':
        return h(
          'div',
          { class: 'nb-stage' },
          head(game, view),
          view.phase === 'answer'
            ? h('div', { class: 'nb-say' }, h('p', { class: 'nb-call' }, game.kind === 'time' ? '🔊 Say your card out loud, from memory!' : '🔊 Say your answer out loud. Not the number!'), chips(view, game))
            : null,
          h('div', { class: 'nb-ruler nb-empty' }, h('div', { class: 'nb-neck' }, h('span', { class: 'nb-collar' }), h('span', { class: 'nb-band' }), h('span', { class: 'nb-nobiko' })), h('div', { class: 'nb-ends' }, game.low ? h('p', { class: 'nb-low' }, '◀ ', ruby(game.low), h('small', {}, game.low.en)) : null, game.high ? h('p', { class: 'nb-high' }, ruby(game.high), h('small', {}, game.high.en), ' ▶') : null)),
        );
      case 'reveal':
        return h(
          'div',
          { class: 'nb-stage' },
          head(game, view),
          h('p', { class: 'nb-call' }, `◀ ▶ Move your own card · 🔒 ${game.locked.length} of ${game.line.length} happy`, game.kind === 'time' ? h('small', {}, ' · Tap 🙋 on your phone to hear a card again') : null),
          neck(view, game, elapsed),
        );
      case 'encore': {
        const d = game.defence;
        return h(
          'div',
          { class: 'nb-stage' },
          head(game, view),
          d ? h('p', { class: 'nb-call' }, `🎤 ${nameOf(view, d.playerId)}, your card moved the most. Why is it there?`, h('small', { lang: 'ja' }, ' 「〜から です。」')) : null,
          d?.text ? h('p', { class: 'nb-defence', lang: 'ja' }, `「${d.text}」`) : null,
          neck(view, game, elapsed),
        );
      }
      case 'score':
        playScale(view, game, elapsed);
        return h('div', { class: `nb-stage${view.calmMotion ? ' nb-calm' : ''}` }, head(game, view), neck(view, game, elapsed), result(view, game, elapsed));
      case 'finale':
        return game.story ? story(view, game) : h('div', { class: 'nb-stage' });
      default:
        return h('div', { class: 'nb-stage' });
    }
  },
};
