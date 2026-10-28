// Bento Haus on the TV: Pon's bento shop at night. The TV never shows or plays an order (it's phoned to
// one player), so the room has to listen to the kitchen calls:
//
//   intro   how a kitchen works: the phone rings, call out, read back, send, serve.
//   prompt  the shift's name, what's new, and tonight's menu (spread across the phones).
//   answer  the counter: a seat per customer with their patience running out, a lacquer box with a
//           compartment for each food they ordered filling up as food is sent, and who is taking
//           their order. The kitchen-call feed is anonymous: a call that didn't come through is
//           📻 ザザッ…, never a name.
//   score   closing time: each customer's order next to what they got, then the stars.
//
// Timers run as CSS animations from the server's own times (negative delays). The delays are named
// `--*-delay` so patch() keeps them on a redraw, and a patience bar never jumps ahead. The shop's
// noises come from comparing each view with the last (listen()).

import { h, seatShape } from '../../../shared/src/dom.js';
import { LAST_ORDER_MS, LINGER_MS, starsFor, type FeedItem, type VisitView } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import { countWord, foodOf } from '../../../shared/src/modes/bentoHaus/menu.js';
import type { BentoView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { bellTonic } from '../music/index.js';
import { flipChord, sfx, tipBells } from '../music/sfx.js';
import type { StageMode } from './types.js';

// The view carries `at`, the server time it was made; the largest `at - Date.now()` is the best offset.
let clockOffset = Number.NEGATIVE_INFINITY;
let lastAt = -1;
function serverNow(game: BentoView): number {
  if (game.at !== lastAt) {
    lastAt = game.at;
    clockOffset = Math.max(clockOffset, game.at - Date.now());
  }
  return Date.now() + (Number.isFinite(clockOffset) ? clockOffset : 0);
}

/** A pixel sprite, or its emoji if the picture doesn't load. */
function pic(src: string, emoji: string, cls: string): HTMLElement {
  const img = h('img', { class: `${cls} bh-px`, src, alt: '', draggable: 'false', 'aria-hidden': 'true' });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: cls, 'aria-hidden': 'true' }, emoji)), { once: true });
  return img;
}
const foodPic = (id: string, emoji: string, cls: string) => pic(`/stage/assets/bento/food/${id}.png`, emoji, cls);
const MOOD = { waiting: 'calm', served: 'happy', left: 'cross' } as const;
const customerPic = (id: string, state: keyof typeof MOOD, emoji: string, cls: string) => pic(`/stage/assets/bento/customers/${id}-${MOOD[state]}.png`, emoji, cls);
const playerOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);

function seatChip(view: RoomView, id: string): HTMLElement | null {
  const p = playerOf(view, id);
  if (!p) return null;
  return h('span', { class: 'bh-chip', style: `--seat: var(--seat-${p.seat});` }, h('span', { class: 'bh-seat' }, `${seatShape(p.seat)}${p.seat}`), p.name);
}

const stars = (n: number, of = 3, stamp = false): HTMLElement =>
  h(
    'span',
    { class: `bh-stars${stamp ? ' stamp' : ''}`, 'aria-label': `${n} of ${of} stars` },
    Array.from({ length: of }, (_, i) => h('span', { class: i < n ? 'on' : 'off', style: `--i: ${i}` }, '★')),
  );

function foodTile(foodId: string, own: boolean): HTMLElement {
  const f = foodOf(foodId);
  if (!f) return h('span', {});
  return h(
    'span',
    { class: 'bh-food', 'data-key': foodId },
    foodPic(f.id, f.emoji, 'bh-emoji'),
    h('span', { class: 'bh-food-name', lang: 'ja' }, f.kana),
    own ? h('span', { class: 'bh-count', lang: 'ja' }, `〜${{ tsu: 'つ', hon: 'ほん', mai: 'まい', ko: 'こ' }[f.counter]}`) : null,
  );
}

function intro(): HTMLElement {
  return h(
    'div',
    { class: 'bh-stage bh-intro' },
    h('p', { class: 'bh-logo', lang: 'ja' }, 'おべんとうハウス'),
    h('p', { class: 'bh-subtitle' }, 'Bento Haus · one kitchen, split across your phones'),
    h(
      'ol',
      { class: 'bh-steps' },
      h('li', {}, h('strong', {}, '📞 The phone rings.'), ' A yōkai phones its order to one of you. Only that phone hears it.'),
      h('li', {}, h('strong', {}, '📣 Call the kitchen.'), ' The food is on everyone’s phones. Say it: ', h('span', { lang: 'ja' }, '「からあげ ふたつ、おねがいします！」')),
      h('li', {}, h('strong', {}, '🍱 Read it back and send it.'), ' ', h('span', { lang: 'ja' }, '「はい、からあげ ふたつですね！」'), ' then できました！'),
      h('li', {}, h('strong', {}, '🛎️ Serve it'), ' before they give up. Every tip pays the whole team.'),
    ),
  );
}

function prompt(game: BentoView): HTMLElement {
  return h(
    'div',
    { class: 'bh-stage bh-prompt' },
    h('p', { class: 'bh-tag' }, `Shift ${game.round} of ${game.totalRounds}`),
    h('p', { class: 'bh-title', lang: 'ja' }, game.info?.ja ?? '', h('small', {}, game.info?.en ?? '')),
    h('p', { class: 'bh-what' }, game.info?.what ?? ''),
    h('p', { class: 'bh-roles' }, '📞 Phone rings? Call each food: ', h('span', { lang: 'ja' }, '「いなり みっつ、おねがいします！」'), ' · 🎫 Ticket? Read it back, then できました！'),
    h('p', { class: 'bh-menu-label' }, 'Tonight’s menu · each phone holds some of it'),
    h(
      'div',
      { class: 'bh-menu' },
      game.menu.map((id) => foodTile(id, game.ownCounter)),
    ),
    game.ownCounter ? h('p', { class: 'bh-counter-tip', lang: 'ja' }, 'ほそながい もの: 〜ほん · うすい もの: 〜まい · ちいさい もの: 〜こ（〜つ でも OK）') : null,
  );
}

/** One compartment of the box: the food drawn as many times as there are (up to four), and the count. */
function compartment(foodId: string, n: number, own: boolean): HTMLElement {
  const f = foodOf(foodId)!;
  return h(
    'span',
    { class: 'bh-part in', 'data-key': foodId },
    h(
      'span',
      { class: 'bh-pieces', 'aria-hidden': 'true' },
      Array.from({ length: Math.min(4, n) }, () => foodPic(f.id, f.emoji, 'bh-piece')),
    ),
    h('span', { class: 'bh-part-label', lang: 'ja' }, f.kana, ' ', h('b', {}, countWord(f, n, own))),
  );
}

function box(game: BentoView, v: VisitView): HTMLElement {
  const empty = Math.max(0, v.slots - v.box.length - (v.baked ? 1 : 0));
  const baked = v.baked ? foodOf(v.baked) : null;
  return h(
    'div',
    { class: `bh-box${v.state === 'served' ? ' closed' : ''}`, style: `--parts: ${Math.max(1, v.slots, v.box.length)}` },
    v.box.map((b) => compartment(b.foodId, b.n, game.ownCounter)),
    // Pon in disguise: the missing food, drawn a little wrong, with his leaf on top.
    baked
      ? h(
          'span',
          { class: 'bh-part in baked', 'data-key': `baked-${baked.id}` },
          h('span', { class: 'bh-pieces', 'aria-hidden': 'true' }, foodPic(baked.id, baked.emoji, 'bh-piece')),
          h('span', { class: 'bh-leaf', 'aria-hidden': 'true' }, '🍃'),
          h('span', { class: 'bh-part-label', lang: 'ja' }, baked.kana, ' ', h('b', {}, '…？')),
        )
      : null,
    Array.from({ length: empty }, (_, i) => h('span', { class: 'bh-part empty', 'data-key': `empty-${i}` })),
  );
}

function customer(view: RoomView, game: BentoView, v: VisitView, now: number): HTMLElement {
  const done = v.state !== 'waiting';
  const total = v.leaveAt - v.arriveAt;
  const gone = Math.min(total, Math.max(0, now - v.arriveAt));
  const line = done ? v.reaction : v.hello;
  // Waiting customers fidget for the last quarter of their patience; leaving ones slide out at the end.
  const timing = done
    ? `--exit-delay: ${Math.round((v.endedAt ?? now) + LINGER_MS - 450 - now)}ms;`
    : `--total: ${total}ms; --gone-delay: -${gone}ms; --fidget-delay: ${Math.round(total * 0.75 - gone)}ms;`;
  return h(
    'div',
    { class: `bh-customer ${v.state}${v.rush ? ' rush' : ''}`, 'data-key': v.id, style: timing },
    v.rush ? h('span', { class: 'bh-rush', lang: 'ja' }, 'いそいで！ ×2') : null,
    h('div', { class: 'bh-who' }, customerPic(v.customerId, v.state, v.emoji, 'bh-yokai'), h('p', { class: 'bh-cname', lang: 'ja' }, h('span', {}, v.name), h('small', {}, v.nameEn))),
    line ? h('p', { class: 'bh-bubble', lang: 'ja' }, line.text, h('small', {}, line.en)) : null,
    done
      ? h('p', { class: `bh-tips t${v.tips} ${v.state}` }, v.tips ? `+${v.tips} 💰` : v.state === 'left' ? '💨 Gone' : '0 tips')
      : h('div', { class: 'bh-patience', role: 'img', 'aria-label': 'patience' }, h('span', {}), h('i', {})),
    box(game, v),
    h('p', { class: 'bh-taker' }, done ? null : ['📞 ', seatChip(view, v.takerId)]),
  );
}

function counter(view: RoomView, game: BentoView, now: number): HTMLElement {
  // A seat per customer the counter holds this shift. Everyone still waiting gets one; a customer who
  // was just served or walked out keeps theirs a moment longer, newest first, but only while a seat
  // is free, so a fast kitchen never spills the counter onto a second row.
  const waitingNow = game.visits.filter((v) => v.state === 'waiting');
  const cols = Math.min(4, Math.max(1, game.seats, waitingNow.length));
  const leaving = game.visits.filter((v) => v.state !== 'waiting').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, Math.max(0, cols - waitingNow.length));
  const shown = new Set([...waitingNow.slice(0, cols), ...leaving]);
  const live = game.visits.filter((v) => shown.has(v));
  return h(
    'div',
    { class: `bh-counter${cols === 1 ? ' bh-n1' : ''}${cols >= 3 ? ' bh-tight' : ''}`, style: `--n: ${cols}` },
    live.map((v) => customer(view, game, v, now)),
    Array.from({ length: Math.max(0, cols - live.length) }, (_, i) =>
      h('div', { class: 'bh-customer empty', 'data-key': `seat-${i}` }, h('p', { class: 'bh-quiet', lang: 'ja' }, i === 0 && !live.length ? 'つぎの おきゃくさんを まって います…' : '')),
    ),
  );
}

const CALL_STATE: Record<FeedItem['state'], string> = { open: '📣', sent: '✓ できた', void: '✗ なし' };

function feedLine(game: BentoView, f: FeedItem): HTMLElement {
  if (!f.foodId) return h('li', { class: 'bh-call static', 'data-key': f.id }, h('span', { lang: 'ja' }, '📻 ザザッ…'), h('small', {}, 'didn’t come through'));
  const food = foodOf(f.foodId)!;
  return h(
    'li',
    { class: `bh-call ${f.state}${f.n === null ? ' static' : ''}`, 'data-key': f.id },
    foodPic(food.id, food.emoji, 'bh-emoji'),
    h('span', { lang: 'ja' }, `${food.kana} ${f.n ? countWord(food, f.n, game.ownCounter) : '…ザザッ？'}`),
    h('small', { lang: 'ja' }, f.state === 'open' && f.readback ? '👂 はい！' : CALL_STATE[f.state]),
  );
}

// Pon's taste test, counted the way this shift counts (きゅうり いっぽん in shift 2).
function ajimiLine(foodId: string, own: boolean): string {
  const food = foodOf(foodId);
  return food ? `もぐもぐ… ${food.kana}、${countWord(food, 1, own)} たべちゃった！` : '';
}

function kitchen(view: RoomView, game: BentoView): HTMLElement {
  const now = serverNow(game);
  return h(
    'div',
    { class: 'bh-stage bh-shift' },
    h(
      'div',
      { class: 'bh-head' },
      h('p', { class: 'bh-tag' }, `Shift ${game.round} of ${game.totalRounds} · `, h('span', { lang: 'ja' }, game.info?.ja ?? ''), ` ${game.info?.en ?? ''}`),
      h('p', { class: 'bh-till' }, `💰 ${game.tips}`, h('small', {}, ' tips'), stars(starsFor(game.tips, game.maxTips))),
    ),
    h(
      'div',
      { class: 'bh-feed' },
      h('p', { class: 'bh-feed-title' }, '📣 Kitchen calls'),
      h(
        'ol',
        {},
        game.feed.length
          ? [...game.feed]
              .reverse()
              .slice(0, 5)
              .map((f) => feedLine(game, f))
          : h('li', { class: 'bh-call idle' }, 'Say what the customer wants: ', h('span', { lang: 'ja' }, '「〜 ふたつ、おねがいします！」')),
      ),
    ),
    counter(view, game, now),
    game.ajimi
      ? h(
          'p',
          { class: 'bh-ajimi', lang: 'ja', 'data-key': `ajimi-${game.ajimi.at}` },
          h('img', { src: '/stage/assets/hosts/pon.png', alt: '', draggable: 'false' }),
          ajimiLine(game.ajimi.foodId, game.ownCounter),
        )
      : null,
  );
}

function closing(game: BentoView): HTMLElement {
  const n = game.stars ?? 0;
  const rows = game.visits.length;
  // The orders come in one by one, then the stars are stamped (with their bells, from listen()).
  return h(
    'div',
    { class: 'bh-stage bh-score', style: `--stars-delay: ${starsAt(rows)}ms` },
    h('p', { class: 'bh-tag' }, `Closing time · shift ${game.round} of ${game.totalRounds}`),
    h('div', { class: 'bh-result' }, stars(n, 3, true), h('p', { class: 'bh-result-big' }, `${game.tips} of ${game.maxTips} tips · +${game.teamPoints} each`)),
    h(
      'ul',
      { class: 'bh-orders' },
      game.visits.map((v, i) =>
        h(
          'li',
          { class: `bh-order ${v.state}`, 'data-key': v.id, style: `--row-delay: ${400 + i * 300}ms` },
          customerPic(v.customerId, v.state, v.emoji, 'bh-yokai'),
          h('div', {}, h('p', { class: 'bh-order-text', lang: 'ja' }, v.order?.text ?? ''), h('p', { class: 'bh-order-en' }, v.order?.en ?? '')),
          h('p', { class: `bh-tips t${v.tips}` }, v.tips ? `+${v.tips} 💰` : '💨'),
        ),
      ),
    ),
  );
}

const starsAt = (rows: number) => 400 + Math.min(rows, 8) * 300 + 300;

// ---- the shop's noises, from comparing views ----

interface Heard {
  phaseSeq: number;
  visits: Map<string, { state: VisitView['state']; items: number; baked: string | null }>;
  feed: Map<string, FeedItem['state']>;
  ajimiAt: number | null;
}
let heard: Heard | null = null;
let lastOrderTimer: ReturnType<typeof setTimeout> | null = null;

function listen(view: RoomView, game: BentoView): void {
  const prev = heard;
  const fresh = !prev || prev.phaseSeq !== view.phaseSeq;
  heard = {
    phaseSeq: view.phaseSeq,
    visits: new Map(game.visits.map((v) => [v.id, { state: v.state, items: v.box.reduce((a, b) => a + b.n, 0), baked: v.baked }])),
    feed: new Map(game.feed.map((f) => [f.id, f.state])),
    ajimiAt: game.ajimi?.at ?? null,
  };
  if (fresh) {
    if (lastOrderTimer) clearTimeout(lastOrderTimer);
    lastOrderTimer = null;
    if (view.phase === 'score' && game.stars !== null) {
      const at = starsAt(game.visits.length) / 1000;
      if (game.stars >= 3) flipChord(at, bellTonic());
      else tipBells(game.stars, at, bellTonic());
    }
    if (view.phase === 'answer' && game.shift) {
      const wait = game.shift.end - LAST_ORDER_MS - serverNow(game);
      if (wait > 0) lastOrderTimer = setTimeout(() => sfx('lastorder'), wait);
    }
    if (prev) return;
  }
  if (view.phase !== 'answer' || !prev) return;
  for (const v of game.visits) {
    const was = prev.visits.get(v.id);
    const items = v.box.reduce((a, b) => a + b.n, 0);
    if (!was) {
      if (v.state === 'waiting') sfx('ring');
      continue;
    }
    if (was.state === 'waiting' && v.state === 'served') {
      sfx('serve');
      tipBells(Math.min(4, v.tips), 0.35, bellTonic());
    } else if (was.state === 'waiting' && v.state === 'left') sfx('leave');
    if (v.baked && !was.baked) sfx('poof');
    if (v.state === 'waiting' && items < was.items && game.ajimi?.at === prev.ajimiAt) sfx('toss');
  }
  for (const f of game.feed) {
    const was = prev.feed.get(f.id);
    if (!was) sfx(f.foodId && f.n !== null ? 'ticket' : 'static');
    else if (was === 'open' && f.state === 'sent') sfx('send');
  }
  if (game.ajimi && game.ajimi.at !== prev.ajimiAt) sfx('munch');
}

export const bentoHausStage: StageMode<BentoView> = {
  badge(game, playerId) {
    return game.visits.some((v) => v.state === 'waiting' && v.takerId === playerId) ? '📞' : '';
  },

  render(view, game) {
    listen(view, game);
    const calm = view.calmMotion ? ' bh-calm' : '';
    let el: HTMLElement;
    switch (view.phase) {
      case 'intro':
        el = intro();
        break;
      case 'prompt':
        el = prompt(game);
        break;
      case 'answer':
        el = kitchen(view, game);
        break;
      case 'score':
        el = closing(game);
        break;
      default:
        el = h('div', { class: 'bh-stage' });
    }
    if (calm) el.classList.add('bh-calm');
    return el;
  },
};
