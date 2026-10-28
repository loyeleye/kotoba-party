// Narabete! on the TV. The line runs along Nobiko-san's neck: her body at the low end, her neck along
// the bottom, her head at the high end. One layout for the whole round, so the neck never jumps:
//
//   deal     the round's title and the neck's two ends; an empty dashed slot per player.
//   say      a 🔊 on each slot whose player has said their card, never what it was.
//   order    the cards on the neck in the room's order, each in its owner's seat colour: Time Line
//            cards show their picture, Feelings cards their answer; きめた when locked, 🙋 when someone
//            asked to hear it again. A card that moves slides to its new place.
//   defence  the most-moved card lifts off the neck, and its author says why it belongs there.
//   flip     Nobiko-san turns the cards over from the low end, one per step, a bell a step up the
//            theme's scale as each face shows; a knot ties in her neck between two cards out of order;
//            the biggest surprise wobbles and turns last, on the scale's home note.
//   story    round 3's answers, low to high, read out in turn: そして… それから… しかも… さいごに…

import { h, ruby, seatShape } from '../../../shared/src/dom.js';
import { FLIP_LEAD_MS, FLIP_STEP_MS, flipMs, joiner, type LineCard } from '../../../shared/src/modes/narabete/narabete.js';
import type { NarabeteView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { bellTonic, hushFor } from '../music/index.js';
import { drawRuler, type Knot } from '../neck.js';
import { flipChord, flipNote } from '../music/sfx.js';
import type { StageMode } from './types.js';

/** What the round asks, in the words players say: なんじ？ for times, いくら？ for prices … */
const ASK: Record<string, string> = { time: 'なんじ？', price: 'いくら？', date: 'いつ？', feel: 'どのくらい？' };
const KIND = { time: 'Time Line', feel: 'Feelings Line', story: 'The Worst Day Ever' } as const;


const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);
const nameOf = (view: RoomView, id: string | null | undefined): string => playerOf(view, id)?.name ?? '(left)';

/** A player's seat shape, number and name: the same badge as their chip in the strip. */
function owner(view: RoomView, id: string): HTMLElement {
  const seat = playerOf(view, id)?.seat ?? 0;
  return h('p', { class: 'nb-name' }, seat ? h('span', { class: 'nb-seat' }, `${seatShape(seat)}${seat}`) : null, nameOf(view, id));
}
const seatStyle = (view: RoomView, id: string): string => {
  const seat = playerOf(view, id)?.seat;
  return seat ? `--seat: var(--seat-${seat});` : '';
};

// The stage redraws on every update, so the flip is timed from when this phase first showed: a
// re-render (a vote coming in) picks the animation up where it was rather than starting again.
let shown = { seq: -1, at: 0 };
function since(view: RoomView): number {
  if (shown.seq !== view.phaseSeq) shown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - shown.at;
}

/** When card `step` of the flip starts to turn, in ms from the phase start. */
const flipAt = (step: number): number => FLIP_LEAD_MS + step * FLIP_STEP_MS;
/** The card's face shows (and its bell rings) this long into its turn; a knot ties a little later. */
const FACE_MS = 300;
const KNOT_MS = 650;

// The bells and the hush play once per flip, however many times the screen redraws.
let scaled = -1;
function playFlip(view: RoomView, game: NarabeteView, elapsed: number): void {
  if (scaled === view.phaseSeq || !game.flip) return;
  scaled = view.phaseSeq;
  const total = flipMs(game.flip.steps);
  hushFor(Math.max(0, total - elapsed));
  const tonic = bellTonic();
  const byFlip = [...game.line].sort((a, b) => (a.flip ?? 0) - (b.flip ?? 0));
  byFlip.forEach((c, step) => {
    const at = flipAt(step) - elapsed;
    if (at >= 0) flipNote(step, byFlip.length, at / 1000, knotted(game, c), tonic);
  });
  if (game.flip.perfect && total - elapsed >= 0) flipChord((total - elapsed) / 1000, tonic);
}

/** Did this card's flip tie a knot (it sits out of order with a neighbour already turned)? */
function knotted(game: NarabeteView, c: LineCard): boolean {
  const i = game.line.indexOf(c);
  const left = game.line[i - 1];
  const right = game.line[i + 1];
  return (!!left?.knotAfter && (left.flip ?? 0) < (c.flip ?? 0)) || (!!c.knotAfter && !!right && (right.flip ?? 0) < (c.flip ?? 0));
}

// Cards slide to a new place instead of jumping: each render remembers where each card sat, and a
// card that moved starts from its old place.
const lastLeft = new Map<string, number>();
function slideCards(): void {
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.nb-card[data-key]')) {
      const key = el.dataset.key!;
      const left = el.offsetLeft;
      const before = lastLeft.get(key);
      lastLeft.set(key, left);
      if (before !== undefined && before !== left && document.body.dataset.motion !== 'calm') {
        el.animate([{ transform: `translateX(${before - left}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.2, 1.2, 0.4, 1)' });
      }
    }
  });
}

function head(game: NarabeteView, view: RoomView): HTMLElement {
  const ask = game.unit ? ASK[game.unit] : '';
  return h(
    'div',
    { class: 'nb-head' },
    h('p', { class: 'nb-tag' }, game.kind ? KIND[game.kind] : '', ask ? h('span', { lang: 'ja' }, ` · ${ask}`) : null, ` · round ${game.round} of ${game.totalRounds}`),
    game.title ? h('p', { class: 'nb-title' }, ruby(game.title), h('small', {}, game.title.en)) : null,
    view.phase === 'prompt' ? h('p', { class: 'nb-call' }, '🤫 Look at your phone: a secret card for you!') : null,
    view.phase === 'answer' ? h('p', { class: 'nb-call' }, game.kind === 'time' ? '🔊 Say your card out loud, from memory!' : '🔊 Say your answer out loud. Not the number!') : null,
    view.phase === 'reveal' ? h('p', { class: 'nb-call' }, `◀ ▶ Move your own card · きめた ${game.locked.length} of ${game.line.length}`) : null,
  );
}

/** A Time Line card's pixel picture at 2×, or its emoji if the picture can't load. */
function picture(src: string, emoji: string): HTMLElement {
  const box = h('span', { class: 'nb-pic', 'aria-hidden': 'true' });
  box.append(h('img', { src, alt: '', draggable: 'false', onerror: () => box.replaceChildren(h('span', { class: 'nb-emoji' }, emoji)) }));
  return box;
}

/** The value printed on a flipped card: the clock or price for a Time card, the secret number for Feelings. */
const valueOf = (c: LineCard): string => c.label ?? String(c.value ?? '');

function card(view: RoomView, game: NarabeteView, c: LineCard, i: number, elapsed: number): HTMLElement {
  const flipped = c.flip !== undefined;
  const at = flipped ? flipAt(c.flip ?? 0) - elapsed : 0;
  const slot = view.phase === 'prompt' || view.phase === 'answer';
  const defending = game.defence?.playerId === c.ownerId && view.phase === 'encore';
  const face = h(
    'div',
    { class: 'nb-face' },
    slot
      ? h('span', { class: 'nb-emoji nb-ear', 'aria-hidden': 'true' }, c.said ? '🔊' : '…')
      : c.picture
        ? picture(c.picture, c.emoji ?? '')
        : c.emoji
          ? h('span', { class: 'nb-emoji', 'aria-hidden': 'true' }, c.emoji)
          : game.kind === 'time'
            ? h('span', { class: 'nb-emoji nb-ear', 'aria-hidden': 'true' }, '🔊')
            : null,
    c.text && game.kind !== 'time' && !slot ? h('p', { class: `nb-text${c.hidden ? ' nb-hidden' : ''}`, lang: 'ja' }, c.text) : null,
    // Name and flags on one row, so the picture keeps its whole 2× size.
    h(
      'div',
      { class: 'nb-who' },
      owner(view, c.ownerId),
      view.phase === 'reveal'
        ? h(
            'p',
            { class: 'nb-flags' },
            c.locked ? h('span', { class: 'nb-lock', lang: 'ja', 'data-key': 'lock' }, '🔒', h('span', { class: 'nb-lock-word' }, ' きめた')) : null,
            c.again ? h('span', { class: 'nb-again', 'data-key': `again-${c.again}` }, `🙋 ${c.again}`) : null,
          )
        : null,
    ),
  );
  const back = flipped
    ? h(
        'div',
        { class: 'nb-back' },
        // Up to five cards there's room for the picture as a sticker in the corner.
        c.picture && game.line.length <= 5 ? picture(c.picture, c.emoji ?? '') : null,
        h('p', { class: 'nb-value' }, valueOf(c)),
        c.text && game.kind === 'time' ? h('p', { class: 'nb-sentence', lang: 'ja' }, c.text) : null,
        c.text && game.kind !== 'time' ? h('p', { class: `nb-sentence${c.hidden ? ' nb-hidden' : ''}`, lang: 'ja' }, c.text) : null,
        c.en && !c.hidden ? h('p', { class: 'nb-en' }, c.en) : null,
        h('div', { class: 'nb-back-foot' }, owner(view, c.ownerId), c.votes ? h('span', { class: 'nb-votes' }, `❤ ${c.votes}`) : null),
      )
    : null;
  return h(
    'li',
    {
      class: `nb-card${slot ? ' nb-slot' : ''}${slot && c.said ? ' nb-said' : ''}${c.locked && view.phase === 'reveal' ? ' nb-locked' : ''}${flipped ? ' nb-flipping' : ''}${c.last ? ' nb-last' : ''}${defending ? ' nb-defending' : ''}`,
      // --d only once flipping: patch() keeps a reused card's first --d, so a value set in reveal would stick at 0.
      style: `${seatStyle(view, c.ownerId)}${flipped ? ` --d: ${Math.round(at)}ms;` : ''} --i: ${i}`,
      'data-key': c.id,
    },
    h('div', { class: 'nb-inner' }, face, back),
  );
}

/** When the joint after card `i` shows, in ms from now: once both its cards have turned. */
function jointAt(game: NarabeteView, i: number, elapsed: number): number {
  const c = game.line[i]!;
  const next = game.line[i + 1]!;
  return flipAt(Math.max(c.flip ?? 0, next.flip ?? 0)) + KNOT_MS - elapsed;
}

/** Ticks between neighbours in order, on the neck. Knots, where they're out of order, are drawn into her neck (drawNeck). */
function joints(game: NarabeteView, elapsed: number): HTMLElement[] {
  if (!game.flip) return [];
  return game.line.slice(0, -1).flatMap((c, i) =>
    c.knotAfter ? [] : [h('span', { class: 'nb-joint nb-ok', style: `--d: ${Math.round(jointAt(game, i, elapsed))}ms`, 'data-after': String(i), 'aria-hidden': 'true' }, '✓')],
  );
}

// ---------- her neck, drawn ----------
// The ruler's neck is drawn on a canvas at her art-pixel size (2 CSS px each), from her collar to her chin,
// with a peg where each card hangs and a knot tied in it between two cards out of order. The stage
// redraws on every update, so each render gets a new canvas; it draws while cards slide or knots tie.

const KNOT_ART = '/stage/assets/anim/nobiko-knot.png';
const PEG_ART = '/stage/assets/fx/peg.png';
let neckArt: { knot: HTMLImageElement; peg: HTMLImageElement } | null = null;
const loaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;
function preloadNeck(): void {
  if (neckArt || typeof Image === 'undefined') return;
  const img = (src: string) => Object.assign(new Image(), { src });
  neckArt = { knot: img(KNOT_ART), peg: img(PEG_ART) };
}
/** Knot frames: a loose loop, cinching, then tied, this many ms apart. */
const KNOT_FRAME_MS = 110;
/** How long a fresh canvas keeps redrawing, for cards that slide into place. */
const SETTLE_MS = 700;

// The stage patches each render into the live page, so the canvas drawn on is the one on screen, found
// after the patch; a newer render's loop takes over from an older one. patch() drops the canvas's size
// attributes (the render doesn't know them), so each render passes the last size back in. A frame only
// repaints when something on the neck has changed.
let drawing = 0;
let neckSize = { w: 0, h: 0 };
let lastDraw: { knotsAt: { after: number; at: number }[]; calm: boolean; until: number } | null = null;
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `until`: keep drawing at least this long (ms), e.g. while her head hops at a perfect line. */
function drawNeck(knotsAt: { after: number; at: number }[], calm: boolean, until = 0): void {
  preloadNeck();
  lastDraw = { knotsAt, calm, until };
  const start = performance.now();
  const run = ++drawing;
  let drawn = '';
  const still = calm || reducedMotion();
  const frame = (now: number) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.nb-stage .nb-neck-art');
    if (run !== drawing || !canvas) return;
    const ruler = canvas.closest<HTMLElement>('.nb-ruler');
    const collar = ruler?.querySelector<HTMLElement>('.nb-collar');
    const head = ruler?.querySelector<HTMLElement>('.nb-nobiko');
    const box = canvas.parentElement;
    if (!ruler || !collar || !head || !box || !neckArt || !loaded(neckArt.knot) || !loaded(neckArt.peg)) {
      if (now - start < 3000) requestAnimationFrame(frame);
      return;
    }
    // Exactly 2 CSS px per art pixel, like her sprites (the box runs 60 px past the neck's box each way).
    const w = Math.ceil((box.offsetWidth + 120) / 2);
    const hgt = Math.ceil((box.offsetHeight + 120) / 2);
    if (canvas.width !== w || canvas.height !== hgt) {
      Object.assign(canvas, { width: w, height: hgt });
      Object.assign(canvas.style, { width: `${w * 2}px`, height: `${hgt * 2}px` });
      neckSize = { w, h: hgt };
      drawn = '';
    }
    const c = canvas.getBoundingClientRect();
    const a = c.width / w; // screen px per art pixel
    const at = (r: DOMRect, x: number, y: number) => ({ x: Math.round((r.left - c.left) / a + x), y: Math.round((r.top - c.top) / a + y) });
    // Where the neck leaves her collar (nobiko-reach.png frame 0) and meets her chin (frame 1, mirrored back by CSS).
    const base = at(collar.getBoundingClientRect(), 42, 88);
    const chin = at(head.getBoundingClientRect(), 68, 63);
    const line = base.y;
    const cards = [...ruler.querySelectorAll<HTMLElement>('.nb-line > .nb-card')].map((el) => {
      const r = el.getBoundingClientRect();
      return Math.round((r.left + r.width / 2 - c.left) / a);
    });
    const mid = (i: number) => Math.round(((cards[i] ?? 0) + (cards[i + 1] ?? 0)) / 2);
    const t = now - start;
    const knots: Knot[] = [];
    for (const k of knotsAt) {
      if (t < k.at) continue;
      const f = still ? 2 : Math.min(2, Math.floor((t - k.at) / KNOT_FRAME_MS));
      knots.push({ x: mid(k.after), frame: f as Knot['frame'] });
    }
    const key = JSON.stringify([base, chin, cards, knots]);
    if (key !== drawn) {
      drawn = key;
      // The ticks sit on the neck between their two cards.
      for (const tick of ruler.querySelectorAll<HTMLElement>('.nb-ok[data-after]')) tick.style.left = `${mid(Number(tick.dataset.after)) * 2 + canvas.offsetLeft}px`;
      drawRuler(canvas.getContext('2d')!, { collar: base, chin, line, pegs: cards, knots }, neckArt);
    }
    const pending = knotsAt.some((k) => t < k.at + 3 * KNOT_FRAME_MS);
    if (pending || t < Math.max(SETTLE_MS, until)) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
// A resize moves everything: draw again from the last render's state.
if (typeof addEventListener !== 'undefined')
  addEventListener('resize', () => {
    if (lastDraw) drawNeck(lastDraw.knotsAt, lastDraw.calm, 0);
  });

function ends(game: NarabeteView): HTMLElement {
  // Feelings rounds name the scale's anchors: your secret number sits between them.
  const feel = game.unit === 'feel';
  return h(
    'div',
    { class: 'nb-ends' },
    game.low ? h('p', { class: 'nb-low' }, '◀ ', ruby(game.low), feel ? h('b', { class: 'nb-anchor' }, ' (1)') : null, h('small', {}, game.low.en)) : h('p', {}),
    game.high ? h('p', { class: 'nb-high' }, ruby(game.high), feel ? h('b', { class: 'nb-anchor' }, ' (100)') : null, h('small', {}, game.high.en), ' ▶') : h('p', {}),
  );
}

function neck(view: RoomView, game: NarabeteView, elapsed: number): HTMLElement {
  const n = Math.max(1, game.line.length);
  const result = game.flip && view.phase === 'score' ? flipMs(game.flip.steps) - elapsed : null;
  const knots = game.flip ? game.line.slice(0, -1).flatMap((c, i) => (c.knotAfter ? [{ after: i, at: jointAt(game, i, elapsed) }] : [])) : [];
  // At a perfect line her head hops twice; the neck follows it.
  drawNeck(knots, !!view.calmMotion, result !== null && game.flip?.perfect ? result + 1200 : 0);
  return h(
    'div',
    { class: `nb-ruler nb-n${Math.min(n, 8)}${result !== null && game.flip?.perfect ? ' nb-hop' : ''}`, style: `--n: ${n}; --r: ${Math.round(result ?? 0)}ms` },
    h('ol', { class: 'nb-line' }, game.line.map((c, i) => card(view, game, c, i, elapsed))),
    h('div', { class: 'nb-neck' }, h('span', { class: 'nb-collar', 'aria-hidden': 'true' }), h('canvas', { class: 'nb-neck-art', 'aria-hidden': 'true', ...(neckSize.w ? { width: neckSize.w, height: neckSize.h, style: `width: ${neckSize.w * 2}px; height: ${neckSize.h * 2}px` } : {}) }), h('span', { class: 'nb-nobiko', 'aria-hidden': 'true' }), ...joints(game, elapsed)),
    ends(game),
  );
}

/** Under the neck: the defence, or the flip's result once the last card is over (space kept either way). */
function foot(view: RoomView, game: NarabeteView, elapsed: number): HTMLElement {
  const d = game.defence;
  if (view.phase === 'encore' && d)
    return h(
      'div',
      { class: 'nb-foot' },
      h('p', { class: 'nb-defence-call' }, `🎤 ${nameOf(view, d.playerId)}, your card moved the most. Why is it there?`, h('small', { lang: 'ja' }, ' 「〜からです。」')),
      d.text ? h('p', { class: 'nb-defence', lang: 'ja' }, `「${d.text}」`) : null,
    );
  const f = game.flip;
  if (view.phase === 'score' && f) {
    const at = flipMs(f.steps) - elapsed;
    return h(
      'div',
      { class: `nb-foot nb-result${f.perfect ? ' nb-perfect' : ''}`, style: `--d: ${Math.round(at)}ms` },
      f.perfect ? h('p', { class: 'nb-result-big' }, h('span', { lang: 'ja' }, 'ぴったり！'), ` Perfect line! +${f.teamPoints} each`) : h('p', { class: 'nb-result-big' }, `${f.pairs} of ${f.maxPairs} pairs in order · +${f.teamPoints} each`),
      f.poker || game.kind !== 'time'
        ? h(
            'p',
            { class: 'nb-poker' },
            f.poker ? `🃏 Poker face: ${nameOf(view, f.poker)}’s card fooled the room the most` : '',
            game.kind !== 'time' ? h('span', { class: 'nb-vote-call' }, `${f.poker ? ' · ' : ''}❤ Vote on your phone for the funniest answer`) : null,
          )
        : null,
    );
  }
  return h('div', { class: 'nb-foot' });
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
          { class: `nb-story-line${now ? ' nb-now' : ''}${i < st.index ? ' nb-done' : ''}${i > st.index ? ' nb-later' : ''}`, style: c ? seatStyle(view, c.ownerId) : '', 'data-key': `line-${id}` },
          h('span', { class: 'nb-soshite', lang: 'ja' }, joiner(i, st.order.length)),
          h('span', { class: 'nb-story-text', lang: 'ja', 'data-key': i <= st.index ? 'said' : 'later' }, i <= st.index ? (c?.text ?? '') : '・・・'),
          c ? owner(view, c.ownerId) : null,
        );
      }),
    ),
    h('p', { class: 'nb-call' }, st.current ? `🎤 ${nameOf(view, byId.get(st.current)?.ownerId)}, read your line!` : 'おしまい！ The end.'),
  );
}

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'nb-stage nb-intro' },
    h('p', { class: 'nb-logo', lang: 'ja' }, 'ならべて！'),
    h('p', { class: 'nb-subtitle' }, 'Line them up! One team, one secret card each.'),
    h(
      'ol',
      { class: 'nb-steps' },
      h('li', {}, h('strong', {}, '🤫 Your card is secret.'), ' Only your phone shows it.'),
      h('li', {}, h('strong', {}, '🔊 Say it out loud.'), ' Listen to everyone else’s.'),
      h('li', {}, h('strong', {}, '◀ ▶ Move your own card'), ' along Nobiko-san’s neck, low to high. Talk it over!'),
      h('li', {}, h('strong', {}, '🪢 Cards over:'), ' every pair in order scores for the whole team.'),
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
    const calm = view.calmMotion ? ' nb-calm' : '';
    switch (view.phase) {
      case 'intro':
        return intro();
      case 'prompt':
      case 'answer':
      case 'reveal':
      case 'encore':
      case 'score':
        if (view.phase === 'score') playFlip(view, game, elapsed);
        slideCards();
        return h('div', { class: `nb-stage nb-round${calm}` }, head(game, view), neck(view, game, elapsed), foot(view, game, elapsed));
      case 'finale':
        return game.story ? story(view, game) : h('div', { class: 'nb-stage' });
      default:
        return h('div', { class: 'nb-stage' });
    }
  },
};
