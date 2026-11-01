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
// N4 hard roles (Co-op): the manager's desk under the counter shows a complaint or special order and the
// manager's lines that came out right (never a miss); an おもてなし guest wears a 🌸, shows their question
// once seated, and leaves with their stars.
//
// Timers run as CSS animations from the server's own times (negative delays). The delays are named
// `--*-delay` so patch() keeps them on a redraw, and a patience bar never jumps ahead. The shop's
// noises come from comparing each view with the last (listen()).

import { h, seatShape } from '../../../shared/src/dom.js';
import { LAST_ORDER_MS, LINGER_MS, starsFor, type FeedItem, type VisitView } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import type { DeskView } from '../../../shared/src/modes/bentoHaus/hardRoles.js';
import { countWord, foodOf } from '../../../shared/src/modes/bentoHaus/menu.js';
import type { BentoView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { bellTonic, jingle } from '../music/index.js';
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
const MOOD = { waiting: 'calm', offered: 'cross', served: 'happy', left: 'cross' } as const;
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

/** An example call from tonight's menu: 「からあげ みっつ」. */
function example(game: BentoView): string {
  const f = foodOf(game.menu[0] ?? 'karaage') ?? foodOf('karaage')!;
  return `${f.kana} ${countWord(f, 3, game.ownCounter)}`;
}

function prompt(game: BentoView): HTMLElement {
  return h(
    'div',
    { class: 'bh-stage bh-prompt' },
    h('p', { class: 'bh-tag' }, `Shift ${game.round} of ${game.totalRounds}`),
    h('p', { class: 'bh-title', lang: 'ja' }, game.info?.ja ?? '', h('small', {}, game.info?.en ?? '')),
    h('p', { class: 'bh-what' }, game.info?.what ?? ''),
    h('p', { class: 'bh-roles' }, '📞 Phone rings? Call each food: ', h('span', { lang: 'ja' }, `「${example(game)}、おねがいします！」`), ' · 🎫 Ticket? Read it back, then できました！'),
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
  const guest = game.hard?.guests[v.id];
  // An おもてなし guest asks their question once they've been seated.
  const line = done ? v.reaction : (guest?.ask ?? v.hello);
  // Waiting customers fidget for the last quarter of their patience; leaving ones slide out at the end.
  const timing = done
    ? `--exit-delay: ${Math.round((v.endedAt ?? now) + LINGER_MS - 450 - now)}ms;`
    : `--total: ${total}ms; --gone-delay: -${gone}ms; --fidget-delay: ${Math.round(total * 0.75 - gone)}ms;`;
  return h(
    'div',
    { class: `bh-customer ${v.state}${v.rush ? ' rush' : ''}`, 'data-key': v.id, style: timing },
    v.rush ? h('span', { class: 'bh-rush', lang: 'ja' }, 'いそいで！ ×2') : null,
    guest ? h('span', { class: 'bh-guest', lang: 'ja' }, '🌸 おもてなし', guest.stars !== null ? stars(guest.stars) : null) : null,
    h('div', { class: 'bh-who' }, customerPic(v.customerId, v.state, v.emoji, 'bh-yokai'), h('p', { class: 'bh-cname', lang: 'ja' }, h('span', {}, v.name), h('small', {}, v.nameEn))),
    line ? h('p', { class: 'bh-bubble', lang: 'ja' }, line.text, h('small', {}, line.en)) : null,
    !done && guest?.said.length ? h('p', { class: 'bh-staff', lang: 'ja' }, `🙇 ${guest.said.at(-1)}`) : null,
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

/** The manager's desk: a complaint or special order, and the manager's lines that came out right. */
function desk(view: RoomView, d: DeskView): HTMLElement {
  const last = d.said.at(-1);
  return h(
    'div',
    { class: `bh-desk ${d.state}`, 'data-key': `desk-${d.id}` },
    customerPic(d.customerId, d.state === 'resolved' ? 'served' : 'left', d.emoji, 'bh-yokai'),
    h('p', { class: 'bh-bubble', lang: 'ja' }, d.line.text, h('small', {}, d.line.en)),
    h(
      'p',
      { class: 'bh-desk-staff' },
      h('span', { class: 'bh-desk-tag', lang: 'ja' }, d.kind === 'complaint' ? '👔 クレーム' : '👔 とくべつ ちゅうもん'),
      seatChip(view, d.managerId),
      last ? h('span', { class: 'bh-staff', lang: 'ja' }, last.text) : null,
      d.stationId && d.state === 'asked' ? [' → ', seatChip(view, d.stationId)] : null,
      d.state === 'resolved' ? h('b', { lang: 'ja' }, ' ✓') : null,
    ),
  );
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
      game.hard?.manager ? h('p', { class: 'bh-manager', lang: 'ja' }, '👔 てんちょう ', seatChip(view, game.hard.manager)) : null,
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
    game.hard?.desk.length ? h('div', { class: 'bh-desks' }, game.hard.desk.slice(-1).map((d) => desk(view, d))) : null,
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
    hardLine(game),
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

/** Closing: how the manager and the おもてなし guests did, when anyone took those roles. */
function hardLine(game: BentoView): HTMLElement | null {
  const hd = game.hard;
  if (!hd || (!hd.handled.of && !hd.stars.of)) return null;
  return h(
    'p',
    { class: 'bh-hard-result', lang: 'ja' },
    hd.handled.of ? h('span', {}, `👔 ${hd.handled.done} / ${hd.handled.of}`, h('small', {}, ' sorted out')) : null,
    hd.stars.of ? h('span', {}, `🌸 おもてなし ★ ${hd.stars.got} / ${hd.stars.of}`) : null,
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
/** VS: where each sound sits, by visit or call id (red left, blue right), and which customers left a わけあり box. */
let pans = new Map<string, number>();
let wakeariPans = new Map<string, number>();
let lastOrderTimer: ReturnType<typeof setTimeout> | null = null;
/** VS: the latest tips, so last orders can tell a close race (rung twice) from a runaway. */
let tipsNow: number[] = [];
/** VS: fades out the neck-and-neck heartbeat if the shift ends before it does. */
let stopNeck: () => void = () => {};

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
    stopNeck();
    // VS: the shift's winner gets their jingle from their side as the result is stamped; a draw gets its own.
    if (view.phase === 'score' && game.vs) {
      const at = starsAt(game.visits.length) / 1000;
      const w = game.vs.winner;
      if (w === null) jingle('draw', at, { hush: true });
      else jingle(w === 0 ? 'win-red' : 'win-blue', at, { pan: TEAM_PAN[w] ?? 0, hush: true });
    }
    if (view.phase === 'score' && game.stars !== null) {
      const at = starsAt(game.visits.length) / 1000;
      if (game.stars >= 3) flipChord(at, bellTonic());
      else tipBells(game.stars, at, bellTonic());
    }
    if (view.phase === 'answer' && game.shift) {
      const wait = game.shift.end - LAST_ORDER_MS - serverNow(game);
      if (wait > 0)
        lastOrderTimer = setTimeout(() => {
          sfx('lastorder');
          // A close race: last orders rings twice, and a heartbeat runs under the last 20 seconds.
          if (tipsNow.length === 2 && Math.abs(tipsNow[0]! - tipsNow[1]!) <= 3) {
            sfx('lastorder', 0.9);
            stopNeck = jingle('neck', 0.9, { gain: 0.7 });
          }
        }, wait);
    }
    if (prev) return;
  }
  if (view.phase !== 'answer' || !prev) return;
  for (const v of game.visits) {
    const was = prev.visits.get(v.id);
    const items = v.box.reduce((a, b) => a + b.n, 0);
    const pan = pans.get(v.id) ?? 0;
    if (!was) {
      if (v.state === 'waiting' || v.state === 'offered') sfx('ring', 0, pan);
      continue;
    }
    if (was.state === 'waiting' && v.sentBack) {
      // VS: served, and straight back again (the kitchen's mistake meter filled).
      sfx('serve', 0, pan);
      sfx('sendback', 0.5, pan);
    } else if (was.state === 'waiting' && v.state === 'served') {
      sfx('serve', 0, pan);
      tipBells(Math.min(4, v.tips), 0.35, bellTonic());
      if (wakeariPans.has(v.id)) sfx('wakeari', 0.75, wakeariPans.get(v.id));
    } else if ((was.state === 'waiting' || was.state === 'offered') && v.state === 'left') sfx('leave', 0, pan);
    if (v.baked && !was.baked) sfx('poof', 0, pan);
    if (v.state === 'waiting' && items < was.items && game.ajimi?.at === prev.ajimiAt) sfx('toss', 0, pan);
  }
  for (const f of game.feed) {
    const was = prev.feed.get(f.id);
    const pan = pans.get(f.id) ?? 0;
    if (!was) sfx(f.foodId && f.n !== null ? 'ticket' : 'static', 0, pan);
    else if (was === 'open' && f.state === 'sent') sfx('send', 0, pan);
  }
  if (game.ajimi && game.ajimi.at !== prev.ajimiAt) sfx('munch');
}

export const bentoHausStage: StageMode<BentoView> = {
  badge(game, playerId) {
    return game.visits.some((v) => v.state === 'waiting' && v.takerId === playerId) ? '📞' : '';
  },

  render(view, game) {
    tipsNow = [];
    pans = new Map();
    wakeariPans = new Map();
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

// ---- Bento Haus VS: two kitchens, one counter ----
//
// The same customers phone both kitchens, so the counter shows each customer once with two boxes under
// them, あかチーム's and あおチーム's, filling side by side. The first box served gets the lid and the
// tips; the other is handed over as a わけあり bento (1 tip if it has anything in it).

type VsTeam = NonNullable<BentoView['vs']>['teams'][number];
/** Red sounds from the left, blue from the right, matching the boxes. */
const TEAM_PAN = [-0.6, 0.6] as const;

/** A team's badge: its colour in a shape of its own (red round, blue diamond), so it reads without colour. */
const pip = (t: { id: number }) => h('span', { class: `bh-pip team-${t.id}`, 'aria-hidden': 'true' });
const teamName = (t: VsTeam, cls = 'bh-vs-name') => h('span', { class: `${cls} team-${t.id}`, lang: 'ja' }, pip(t), t.ja);
const tipsWord = (n: number) => (n === 1 ? 'tip' : 'tips');

/** Every customer at either kitchen, in the order they came in: shared ones once, sent-back orders too. */
function visitIds(teams: readonly VsTeam[]): string[] {
  const seen = new Map<string, number>();
  for (const t of teams) for (const v of t.visits) if (!seen.has(v.id)) seen.set(v.id, v.arriveAt);
  return [...seen].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

/** One customer as both kitchens see them: the copy that was served (or sent back), if one was. */
function merged(teams: readonly VsTeam[], id: string): VisitView | undefined {
  const copies = teams.map((t) => t.visits.find((v) => v.id === id)).filter((v): v is VisitView => !!v);
  return copies.find((v) => v.state === 'served') ?? copies.find((v) => v.sentBack) ?? copies[0];
}

/** Which kitchen a customer is about: the one that served them, sent them back, or holds the sent-back order. */
const ownerOf = (teams: readonly VsTeam[], id: string): number | null =>
  teams.find((t) => t.visits.some((v) => v.id === id && (v.state === 'served' || v.sentBack || v.steal)))?.id ?? null;

function teamBox(view: RoomView, game: BentoView, t: VsTeam, id: string, winner: number | null): HTMLElement {
  const v = t.visits.find((x) => x.id === id);
  const lost = winner !== null && winner !== t.id;
  // A box handed over as a わけあり bento: the losing one, or both when nobody served in time.
  const wakeari = !!v && v.state === 'left' && v.tips > 0 && !v.steal;
  return h(
    'div',
    { class: `bh-vs-box team-${t.id}${winner === t.id ? ' won' : ''}${lost ? ' lost' : ''}${v?.sentBack ? ' sentback' : ''}`, 'data-key': `box-${t.id}` },
    h(
      'p',
      { class: 'bh-vs-boxhead', lang: 'ja' },
      pip(t),
      h('span', { class: 'bh-vs-boxname' }, t.ja),
      (v?.state === 'waiting' || v?.state === 'offered') && v.takerId ? h('span', { class: 'bh-taker' }, '📞 ', seatChip(view, v.takerId)) : null,
      v && v.state !== 'waiting' && v.state !== 'offered' ? h('b', { class: `bh-tips t${v.tips}` }, v.tips ? `+${v.tips} 💰` : v.sentBack ? '0 💰' : '') : null,
    ),
    v ? box(game, v) : h('div', { class: 'bh-box' }),
    wakeari ? h('span', { class: 'bh-wakeari', lang: 'ja' }, 'わけあり') : null,
    v?.sentBack ? h('span', { class: 'bh-wakeari bh-refund', lang: 'ja' }, 'へんきん') : null,
  );
}

function vsCustomer(view: RoomView, game: BentoView, teams: readonly VsTeam[], id: string, now: number): HTMLElement {
  const v = merged(teams, id)!;
  const done = v.state !== 'waiting' && v.state !== 'offered';
  const owner = ownerOf(teams, id);
  const winner = v.state === 'served' && !v.steal ? owner : null;
  const total = v.leaveAt - v.arriveAt;
  const gone = Math.min(total, Math.max(0, now - v.arriveAt));
  const line = done ? v.reaction : v.state === 'offered' ? { text: 'となりの おみせ、だめでした…', en: 'The shop next door got it wrong…' } : v.hello;
  const timing = done
    ? `--exit-delay: ${Math.round((v.endedAt ?? now) + LINGER_MS - 450 - now)}ms;`
    : `--total: ${total}ms; --gone-delay: -${gone}ms; --fidget-delay: ${Math.round(total * 0.75 - gone)}ms;`;
  const o = owner !== null ? teams[owner]! : null;
  // The headline: who served first, a box sent back, a sent-back order on offer, or nobody in time.
  const head = v.steal
    ? h(
        'p',
        { class: `bh-vs-steal team-${o?.id ?? 0}`, lang: 'ja' },
        '🔁 ',
        o ? teamName(o) : null,
        v.state === 'offered' ? ' うけますか？' : v.state === 'served' ? (v.tips ? ' ぴったり！' : ' ざんねん…') : v.state === 'waiting' ? ' ぴったりなら +5 💰' : ' ことわりました',
        h('small', {}, v.state === 'waiting' || v.state === 'offered' ? ' Sent back: perfect for 5 tips, anything else 0' : ''),
      )
    : v.sentBack && o
      ? h('p', { class: `bh-tips left bh-vs-head team-${o.id}`, lang: 'ja' }, '↩ ', teamName(o), 'の おべんとう、つきかえし！')
      : done
        ? h('p', { class: `bh-tips bh-vs-head ${v.state}${winner !== null ? ` team-${winner}` : ''}`, lang: 'ja' }, winner !== null ? [teamName(teams[winner]!), 'が さきに だした！'] : '💨 Gone')
        : null;
  return h(
    'div',
    { class: `bh-customer bh-vs-customer ${v.state}${v.rush ? ' rush' : ''}${v.steal ? ' steal' : ''}`, 'data-key': v.id, style: timing },
    v.rush ? h('span', { class: 'bh-rush', lang: 'ja' }, 'いそいで！ ×2') : null,
    h('div', { class: 'bh-who' }, customerPic(v.customerId, v.state, v.emoji, 'bh-yokai'), h('p', { class: 'bh-cname', lang: 'ja' }, h('span', {}, v.name), h('small', {}, v.nameEn))),
    line ? h('p', { class: 'bh-bubble', lang: 'ja' }, line.text, h('small', {}, line.en)) : null,
    head,
    done ? null : h('div', { class: 'bh-patience', role: 'img', 'aria-label': 'patience' }, h('span', {}), h('i', {})),
    h(
      'div',
      { class: `bh-vs-boxes${v.steal ? ' one' : ''}` },
      (v.steal && o ? [o] : teams).map((t) => teamBox(view, game, t, id, winner)),
    ),
  );
}

function vsCounter(view: RoomView, game: BentoView, teams: readonly VsTeam[], now: number): HTMLElement {
  // Same rule as Co-op: everyone waiting gets a seat; a finished customer keeps one only while it's free.
  const visits = visitIds(teams).map((id) => merged(teams, id)!);
  const isWaiting = (v: VisitView) => v.state === 'waiting' || v.state === 'offered';
  const waitingNow = visits.filter(isWaiting);
  const cols = Math.min(3, Math.max(1, game.seats, waitingNow.length));
  const leaving = visits
    .filter((v) => !isWaiting(v))
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, Math.max(0, cols - waitingNow.length));
  const shown = new Set([...waitingNow.slice(0, cols), ...leaving].map((v) => v.id));
  const live = visits.filter((v) => shown.has(v.id));
  return h(
    'div',
    { class: `bh-counter bh-vs-counter${cols === 1 ? ' bh-n1' : ''}${cols >= 3 ? ' bh-tight' : ''}`, style: `--n: ${cols}` },
    live.map((v) => vsCustomer(view, game, teams, v.id, now)),
    Array.from({ length: Math.max(0, cols - live.length) }, (_, i) =>
      h('div', { class: 'bh-customer empty', 'data-key': `seat-${i}` }, h('p', { class: 'bh-quiet', lang: 'ja' }, i === 0 && !live.length ? 'つぎの おきゃくさんを まって います…' : '')),
    ),
  );
}

/** A team's tip jar: this shift's tips (keyed so it bumps when they change), and the game's. */
function jar(t: VsTeam, shift: boolean): HTMLElement {
  const n = shift ? t.tips : t.total;
  return h(
    'p',
    { class: `bh-vs-jar team-${t.id}`, 'data-key': `jar-${t.id}-${n}` },
    teamName(t),
    h('b', {}, `💰 ${n}`),
    h('small', {}, shift ? `${tipsWord(n)} · ${t.total} in all` : `${tipsWord(n)} in all`),
  );
}

/** The mistake meter: sloppy boxes fill it; full, and the customer sends one back. */
function meter(t: VsTeam): HTMLElement {
  const hot = t.meter >= 60 ? ' hot' : '';
  return h(
    'p',
    { class: `bh-meter team-${t.id}${hot}`, role: 'img', 'aria-label': `Mistake meter ${t.meter}%`, style: `--m: ${t.meter}%` },
    h('span', { class: 'bh-meter-label', lang: 'ja' }, 'ミス'),
    h('span', { class: 'bh-meter-bar' }, h('i', {})),
  );
}

/** Each team's lane above the counter: tip jar, mistake meter and the last two kitchen calls. */
function vsLanes(game: BentoView, teams: readonly VsTeam[]): HTMLElement {
  return h(
    'div',
    { class: 'bh-vs-feeds' },
    teams.map((t) =>
      h(
        'div',
        { class: `bh-feed bh-vs-lane team-${t.id}`, 'data-key': `feed-${t.id}` },
        h('div', { class: 'bh-vs-lanehead' }, jar(t, true), meter(t)),
        h(
          'ol',
          {},
          t.feed.length
            ? [...t.feed]
                .reverse()
                .slice(0, 2)
                .map((f) => feedLine(game, f))
            : h('li', { class: 'bh-call idle' }, h('span', { lang: 'ja' }, '「〜 ふたつ、おねがいします！」')),
        ),
      ),
    ),
  );
}

function vsKitchen(view: RoomView, game: BentoView, teams: readonly VsTeam[]): HTMLElement {
  const now = serverNow(game);
  const tasting = [...teams].filter((t) => t.ajimi).sort((a, b) => b.ajimi!.at - a.ajimi!.at)[0];
  const food = tasting?.ajimi ? foodOf(tasting.ajimi.foodId) : null;
  return h(
    'div',
    { class: 'bh-stage bh-shift bh-vs' },
    h('div', { class: 'bh-head' }, h('p', { class: 'bh-tag' }, `Shift ${game.round} of ${game.totalRounds} · `, h('span', { lang: 'ja' }, game.info?.ja ?? ''), ` ${game.info?.en ?? ''}`)),
    vsLanes(game, teams),
    vsCounter(view, game, teams, now),
    tasting?.ajimi && food
      ? h(
          'p',
          { class: `bh-ajimi team-${tasting.id}`, lang: 'ja', 'data-key': `ajimi-${tasting.id}-${tasting.ajimi.at}` },
          h('img', { src: '/stage/assets/hosts/pon.png', alt: '', draggable: 'false' }),
          `もぐもぐ… ${tasting.ja}の ${food.kana}、${countWord(food, 1, game.ownCounter)} たべちゃった！`,
        )
      : null,
  );
}

const ponFlags = () => h('img', { class: 'bh-vs-pon', src: '/stage/assets/bento/vs/pon-flags.png', alt: '', draggable: 'false' });

function teamRoster(view: RoomView, t: VsTeam): HTMLElement {
  return h('div', { class: `bh-vs-roster team-${t.id}` }, h('p', {}, teamName(t), h('small', {}, ` ${t.en}`)), h('p', {}, t.members.map((id) => seatChip(view, id))));
}

function vsIntro(view: RoomView, game: BentoView): HTMLElement {
  const teams = game.vs?.teams ?? [];
  return h(
    'div',
    { class: 'bh-stage bh-intro bh-vs' },
    h('div', { class: 'bh-vs-logo' }, ponFlags(), h('p', { class: 'bh-logo', lang: 'ja' }, 'おべんとうハウス VS')),
    h('p', { class: 'bh-subtitle' }, 'Bento Haus VS · two kitchens, the same customers · red on the left, blue on the right'),
    h('div', { class: 'bh-vs-rosters' }, teams.map((t) => teamRoster(view, t))),
    h(
      'ol',
      { class: 'bh-steps' },
      h('li', {}, h('strong', {}, '📞 The phone rings in both kitchens.'), ' One of each team hears the same order.'),
      h('li', {}, h('strong', {}, '📣 Call your own team.'), ' The food is on your teammates’ phones: ', h('span', { lang: 'ja' }, '「からあげ ふたつ、おねがいします！」')),
      h('li', {}, h('strong', {}, '🛎️ Serve first'), ' and the customer’s tips are yours. The other box goes as a わけあり bento for 1 tip.'),
      h('li', {}, h('strong', {}, '⚠️ Sloppy boxes fill your ミス meter.'), ' When it’s full, a customer sends one back for a refund, and the other kitchen can take the order on: perfect for 5 tips, or nothing.'),
    ),
  );
}

function vsPrompt(view: RoomView, game: BentoView): HTMLElement {
  const el = prompt(game);
  el.classList.add('bh-vs');
  el.querySelector('.bh-menu-label')!.textContent = 'Tonight’s menu · both kitchens have all of it, spread across each team’s phones';
  el.insertBefore(h('div', { class: 'bh-vs-rosters' }, (game.vs?.teams ?? []).map((t) => teamRoster(view, t))), el.querySelector('.bh-menu-label'));
  return el;
}

function vsClosing(game: BentoView): HTMLElement {
  const vs = game.vs!;
  const teams = vs.teams;
  const visits = visitIds(teams);
  const w = vs.winner;
  return h(
    'div',
    { class: 'bh-stage bh-score bh-vs', style: `--stars-delay: ${starsAt(visits.length)}ms` },
    h('p', { class: 'bh-tag' }, `Closing time · shift ${game.round} of ${game.totalRounds}`),
    h(
      'div',
      { class: `bh-vs-result${w === null ? ' tie' : ` team-${w}`}` },
      ponFlags(),
      h('p', { class: 'bh-result-big', lang: 'ja' }, w === null ? 'ひきわけ！' : [teamName(teams[w]!, 'bh-vs-winner'), 'の かち！'], h('small', {}, w === null ? 'A draw' : `${teams[w]!.en} wins the shift`)),
      h(
        'div',
        { class: 'bh-vs-board' },
        teams.map((t) => {
          const el = jar(t, true);
          if (w === t.id) el.classList.add('won');
          return el;
        }),
      ),
    ),
    h(
      'ul',
      { class: 'bh-orders' },
      visits.map((id, i) => {
        const v = merged(teams, id)!;
        const owner = ownerOf(teams, id);
        return h(
          'li',
          { class: `bh-order ${v.state}`, 'data-key': id, style: `--row-delay: ${400 + i * 300}ms` },
          customerPic(v.customerId, v.state, v.emoji, 'bh-yokai'),
          h('div', {}, h('p', { class: 'bh-order-text', lang: 'ja' }, v.order?.text ?? ''), h('p', { class: 'bh-order-en' }, v.order?.en ?? '')),
          h(
            'p',
            { class: 'bh-vs-split' },
            teams
              .filter((t) => t.visits.some((x) => x.id === id))
              .map((t) => {
                const copy = t.visits.find((x) => x.id === id)!;
                return h('span', { class: `team-${t.id}${owner === t.id && copy.state === 'served' ? ' won' : ''}` }, pip(t), ` ${copy.sentBack ? '↩ 0' : copy.tips}`);
              }),
          ),
        );
      }),
    ),
  );
}

/** Both kitchens as one shop, for the shop's noises: each customer once, every call from both teams,
 *  and where each sound sits (red left, blue right). */
function vsHeard(game: BentoView): BentoView {
  const teams = game.vs?.teams ?? [];
  tipsNow = teams.map((t) => t.tips);
  pans = new Map();
  wakeariPans = new Map();
  for (const t of teams) {
    for (const f of t.feed) pans.set(f.id, TEAM_PAN[t.id] ?? 0);
    for (const v of t.visits) {
      if (v.state === 'served' || v.sentBack || v.steal) pans.set(v.id, TEAM_PAN[t.id] ?? 0);
      if (v.state === 'left' && v.tips > 0 && !v.steal) wakeariPans.set(v.id, TEAM_PAN[t.id] ?? 0);
    }
  }
  const tasting = [...teams].filter((t) => t.ajimi).sort((a, b) => b.ajimi!.at - a.ajimi!.at)[0];
  return {
    ...game,
    visits: visitIds(teams).map((id) => merged(teams, id)!),
    feed: teams.flatMap((t) => t.feed),
    ajimi: tasting?.ajimi ?? null,
  };
}

export const bentoHausVsStage: StageMode<BentoView> = {
  team(game, playerId) {
    return game.vs?.teams.find((t) => t.members.includes(playerId))?.id ?? null;
  },

  badge(game, playerId) {
    return (game.vs?.teams ?? []).some((t) => t.visits.some((v) => (v.state === 'waiting' || v.state === 'offered') && v.takerId === playerId)) ? '📞' : '';
  },

  render(view, game) {
    listen(view, vsHeard(game));
    const teams = game.vs?.teams ?? [];
    let el: HTMLElement;
    switch (view.phase) {
      case 'intro':
        el = vsIntro(view, game);
        break;
      case 'prompt':
        el = vsPrompt(view, game);
        break;
      case 'answer':
        el = vsKitchen(view, game, teams);
        break;
      case 'score':
        el = game.vs ? vsClosing(game) : h('div', { class: 'bh-stage' });
        break;
      default:
        el = h('div', { class: 'bh-stage' });
    }
    if (view.calmMotion) el.classList.add('bh-calm');
    return el;
  },
};
