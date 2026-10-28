// Bento Haus on the phone: your part of the kitchen.
//
//   📞 order   when the phone rings, the order is yours: hear it (🔊), call the kitchen, check the box,
//              toss anything wrong, and serve it (おまたせしました！). From N5 the words fade after a few
//              seconds, so the order is mostly heard; Kana players see it in pictures.
//   📣 call    hold and say what's needed (「からあげ ふたつ、おねがいします！」), or tap it. It sits right
//              under the order while you have one; otherwise it folds away ("Help call the kitchen").
//   🎫 tickets the food on your shelf that someone has called: read it back (はい、〜ですね！) and send
//              it (できました！). A call whose number didn't come through asks 「いくつですか？」.
//   🧺 shelf   the food your phone holds this shift, at the bottom.
//
// The phone buzzes when it rings (a new order) and when a ticket lands. Typed calls and read-backs
// keep their half-typed text across redraws (draftKey).

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { TicketView } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import { COUNTS, countWord, foodOf, MAX_COUNT } from '../../../shared/src/modes/bentoHaus/menu.js';
import type { BentoView } from '../../../shared/src/modes/views.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { hearButton } from '../components/voice.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<BentoView>;
type Me = NonNullable<BentoView['me']>;

/** How long the order's words stay up before they fade (N5 and N4). */
const ORDER_SHOWN_MS = 6_000;
/** How long the last call's echo stays under the call box. */
const ECHO_MS = 8_000;

const COUNTER_KANA = { tsu: 'つ', hon: 'ほん', mai: 'まい', ko: 'こ' } as const;

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
const buzz = (ms: number | number[] = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

// What this phone has already rung or buzzed for, so each new order and ticket buzzes once.
let felt = { round: -1, orders: new Set<string>(), tickets: new Set<string>() };
function feel(game: BentoView, me: Me): Set<string> {
  if (felt.round !== game.round) felt = { round: game.round, orders: new Set(), tickets: new Set() };
  const ringing = new Set<string>();
  for (const t of me.taking)
    if (!felt.orders.has(t.visitId)) {
      felt.orders.add(t.visitId);
      ringing.add(t.visitId);
    }
  const newTicket = me.tickets.some((t) => t.state === 'open' && !felt.tickets.has(t.id));
  for (const t of me.tickets) felt.tickets.add(t.id);
  if (ringing.size) buzz([90, 70, 90, 70, 90]);
  else if (newTicket) buzz([40, 40, 40]);
  return ringing;
}

function foodLabel(id: string | null, level: Me['level']): HTMLElement {
  const f = id ? foodOf(id) : null;
  if (!f) return h('span', { class: 'bh-fl' }, '📻 ?');
  return h(
    'span',
    { class: 'bh-fl' },
    foodPic(f.id, f.emoji, 'bh-fe'),
    h('span', { lang: 'ja' }, f.kana),
    level === 'kana' ? h('small', {}, ` ${toRomaji(f.kana)}`) : h('small', {}, ` ${f.en}`),
  );
}

function orderCard(ctx: Ctx, me: Me, t: Me['taking'][number], ringing: boolean): HTMLElement {
  const { game, send } = ctx;
  const visit = game.visits.find((v) => v.id === t.visitId);
  const now = serverNow(game);
  const shownFor = Math.max(0, now - t.at);
  const total = visit ? visit.leaveAt - visit.arriveAt : 1;
  const gone = visit ? Math.min(total, Math.max(0, now - visit.arriveAt)) : 0;
  const words = h('p', { class: `bh-order-words${t.fades ? ' fades' : ''}`, lang: 'ja', style: `--shown: ${ORDER_SHOWN_MS}ms; --since-delay: -${Math.round(shownFor)}ms;` }, t.text);
  const empty = !visit?.box.length;
  return h(
    'section',
    { class: `bh-taking${ringing ? ' ring' : ''}`, 'data-key': t.visitId },
    h(
      'div',
      { class: 'bh-taking-head' },
      visit ? customerPic(visit.customerId, 'waiting', visit.emoji, 'bh-cust-p') : null,
      h('span', { class: 'bh-who-p', lang: 'ja' }, visit ? `📞 ${visit.name}` : '📞 Order'),
      visit?.rush ? h('span', { class: 'bh-rush-p', lang: 'ja' }, 'いそいで！') : null,
      hearButton(t.text, '🔊', 'secondary bh-hear'),
    ),
    visit ? h('div', { class: 'bh-patience-p', style: `--total: ${total}ms; --gone-delay: -${gone}ms;` }, h('span', {})) : null,
    words,
    // The fade is explained on the first shift; after that it's known.
    t.fades ? (game.round === 1 ? h('p', { class: 'hint bh-fade-hint' }, 'The words fade: 🔊 hears it again.') : null) : h('p', { class: 'hint' }, t.en),
    me.level === 'kana'
      ? h(
          'div',
          { class: 'bh-pics' },
          t.lines.map((l) =>
            l.foodId
              ? h('span', { class: 'bh-pic' }, foodPic(l.foodId, foodOf(l.foodId)!.emoji, 'bh-fe'), h('span', { lang: 'ja' }, countWord(foodOf(l.foodId)!, l.n, game.ownCounter)))
              : h('span', { class: 'bh-pic', lang: 'ja' }, `${l.riddle} ×${l.n}`),
          ),
        )
      : null,
    h(
      'div',
      { class: 'bh-box-p', 'aria-label': 'In the box' },
      empty
        ? h('span', { class: 'hint' }, 'The box is empty: call the kitchen!')
        : visit!.box.map((b) =>
            h(
              'span',
              { class: 'bh-boxed' },
              foodPic(b.foodId, foodOf(b.foodId)!.emoji, 'bh-fe'),
              h('span', { lang: 'ja' }, foodOf(b.foodId)!.kana),
              h('b', { lang: 'ja' }, countWord(foodOf(b.foodId)!, b.n, game.ownCounter)),
              h(
                'button',
                { type: 'button', class: 'bh-toss', 'aria-label': `Take the ${foodOf(b.foodId)?.en} out`, onclick: () => void send({ kind: 'toss', visitId: t.visitId, foodId: b.foodId }) },
                '🗑',
              ),
            ),
          ),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'bh-serve',
        disabled: empty || undefined,
        onclick: () => {
          buzz(120);
          void send({ kind: 'serve', visitId: t.visitId });
        },
      },
      h('span', { lang: 'ja' }, '🛎️ おまたせしました！'),
      h('small', {}, empty ? ' Serve when it’s full' : ' Serve it'),
    ),
  );
}

function ticketCard(ctx: Ctx, me: Me, t: TicketView, readback: boolean): HTMLElement {
  const { send } = ctx;
  const f = t.foodId ? foodOf(t.foodId) : null;
  if (t.state !== 'open')
    return h(
      'p',
      { class: `bh-ticket-done ${t.state}`, 'data-key': t.id },
      h('span', { lang: 'ja' }, `${f?.emoji ?? ''} ${f?.kana ?? ''} ${t.reading ?? ''}`),
      t.state === 'sent' ? ' ✓ できました' : ' ✗ not needed',
    );
  if (t.n === null)
    return h(
      'div',
      { class: 'bh-ticket static', 'data-key': t.id },
      foodLabel(t.foodId, me.level),
      h('b', { lang: 'ja' }, '📻 ザザッ…？'),
      t.asked
        ? h('small', {}, 'Asked. Waiting for a new call…')
        : h(
            'button',
            { type: 'button', class: 'secondary bh-ask', onclick: () => void send({ kind: 'ask', ticketId: t.id }) },
            h('span', { lang: 'ja' }, '「いくつですか？」'),
            h('small', {}, ' How many?'),
          ),
    );
  return h(
    'div',
    { class: `bh-ticket open${t.readback ? ' heard' : ''}`, 'data-key': t.id },
    foodLabel(t.foodId, me.level),
    h('b', { class: 'bh-reading', lang: 'ja' }, t.reading ?? '', h('small', {}, ` (${t.n})`)),
    t.readback
      ? h('small', { class: 'bh-rb' }, '👂 read back ✓')
      : readback && f
        ? h(
            'div',
            { class: 'bh-rb-box' },
            h('p', { class: 'bh-steps-p' }, '① Read it back (bonus) ② できました！'),
            speakBox({
              label: 'Hold and read it back',
              placeholder: `はい、${f.kana} ${t.reading}ですね！`,
              maxLength: MAX_ANSWER_LENGTH,
              autoSend: true,
              draftKey: `rb-${t.id}`,
              onSend: (utterance) => void send({ kind: 'readback', ticketId: t.id, utterance }),
            }),
          )
        : null,
    h(
      'button',
      {
        type: 'button',
        class: 'primary bh-send',
        onclick: () => {
          buzz();
          void send({ kind: 'send', ticketId: t.id });
        },
      },
      h('span', { lang: 'ja' }, 'できました！'),
      h('small', {}, ' Send'),
    ),
  );
}

function tickets(ctx: Ctx, me: Me): HTMLElement | null {
  const open = me.tickets.filter((t) => t.state === 'open');
  const done = me.tickets.filter((t) => t.state !== 'open').at(-1);
  if (!open.length && !done) return null;
  // Only the first ticket still to read back gets a speak box: one mic on the screen at a time.
  const rb = open.find((t) => t.n !== null && !t.readback);
  return h(
    'section',
    { class: 'bh-tickets' },
    h('p', { class: 'bh-section' }, '🎫 Called for your shelf'),
    open.map((t) => ticketCard(ctx, me, t, t === rb)),
    done ? ticketCard(ctx, me, done, false) : null,
  );
}

let picked: string | null = null;
let tapOpen: boolean | null = null;

function callBox(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  // The last call's echo, while it's fresh and there's still an order to fill.
  const last = me.calls.at(-1);
  const fresh = last && me.taking.length && serverNow(game) - last.at < ECHO_MS ? last : null;
  const pickedFood = picked && game.menu.includes(picked) ? foodOf(picked) : null;
  const tap = h(
    'details',
    { class: 'bh-tap', open: (tapOpen ?? me.level === 'kana') || undefined },
    h('summary', {}, 'Tap a call instead'),
    h(
      'div',
      { class: 'bh-tap-foods' },
      game.menu.map((id) =>
        h(
          'button',
          {
            type: 'button',
            class: `option bh-tap-food${picked === id ? ' on' : ''}`,
            onclick: () => {
              picked = id;
              ctx.redraw();
            },
          },
          foodLabel(id, me.level),
        ),
      ),
    ),
    pickedFood
      ? h(
          'div',
          { class: 'bh-tap-counts' },
          Array.from({ length: MAX_COUNT }, (_, i) =>
            h(
              'button',
              {
                type: 'button',
                class: 'secondary',
                onclick: () => {
                  picked = null;
                  void send({ kind: 'call', foodId: pickedFood.id, n: i + 1 });
                },
              },
              h('span', { lang: 'ja' }, COUNTS[game.ownCounter ? pickedFood.counter : 'tsu'][i]!),
              h('small', {}, ` ${i + 1}`),
            ),
          ),
        )
      : null,
  );
  tap.addEventListener('toggle', () => (tapOpen = (tap as HTMLDetailsElement).open));
  const body = [
    speakBox({
      label: 'Hold and call it',
      placeholder: '〜 ふたつ、おねがいします',
      maxLength: MAX_ANSWER_LENGTH,
      kanaPadOpen: me.level === 'kana',
      autoSend: true,
      draftKey: 'call',
      onSend: (utterance) => {
        buzz();
        void send({ kind: 'call', utterance });
      },
    }),
    fresh
      ? h(
          'p',
          { class: `bh-last ${fresh.foodId && fresh.n ? 'ok' : 'static'}` },
          fresh.foodId && fresh.n ? h('span', { lang: 'ja' }, `✓ ${foodOf(fresh.foodId)!.kana} ${fresh.reading}`) : h('span', { lang: 'ja' }, '📻 ザザッ… Say the food and how many.'),
          fresh.heard ? h('small', { lang: 'ja' }, ` 「${fresh.heard}」`) : null,
        )
      : null,
    tap,
  ];
  // With an order, calling is your job, right under the box. Without one, it folds away.
  if (me.taking.length) return h('section', { class: 'bh-call-p' }, h('p', { class: 'bh-section' }, '📣 Call the kitchen'), body);
  return h('details', { class: 'bh-call-p bh-help' }, h('summary', {}, '📣 Help call the kitchen'), body);
}

function shelf(me: Me, own: boolean): HTMLElement {
  return h(
    'section',
    { class: 'bh-shelf' },
    h('p', { class: 'bh-section' }, '🧺 Your shelf'),
    h(
      'div',
      { class: 'bh-shelf-items' },
      me.shelf.map((id) => h('span', { class: 'bh-shelf-item' }, foodLabel(id, me.level), own ? h('b', { lang: 'ja' }, ` 〜${COUNTER_KANA[foodOf(id)!.counter]}`) : null)),
    ),
  );
}

const TEAM_MARK = ['🔴', '🔵'] as const;

/** VS: whose kitchen this phone is in, and the race so far. */
function teamBar(game: BentoView): HTMLElement | null {
  const vs = game.vs;
  if (!vs || vs.myTeam === null) return null;
  const mine = vs.teams[vs.myTeam]!;
  return h(
    'p',
    { class: `bh-team-p team-${mine.id}` },
    h('b', { lang: 'ja' }, `${TEAM_MARK[mine.id]} ${mine.ja}`),
    vs.teams.map((t) => h('span', { class: `bh-team-score team-${t.id}` }, `${TEAM_MARK[t.id]} 💰${t.tips}`)),
  );
}

function kitchen(ctx: Ctx): HTMLElement {
  const me = ctx.game.me!;
  const ringing = feel(ctx.game, me);
  const idle = !me.taking.length && !me.tickets.some((t) => t.state === 'open');
  return h(
    'div',
    { class: 'screen bh-kitchen' },
    teamBar(ctx.game),
    me.taking.map((t) => orderCard(ctx, me, t, ringing.has(t.visitId))),
    me.taking.length ? callBox(ctx, me) : null,
    tickets(ctx, me),
    idle
      ? h(
          'section',
          { class: 'bh-idle' },
          h('p', { class: 'bh-idle-big', lang: 'ja' }, 'まってね…'),
          h('p', { class: 'hint' }, 'When your phone rings 📞, the order is yours. When someone calls for your food, a ticket 🎫 pops up here.'),
        )
      : null,
    me.taking.length ? null : callBox(ctx, me),
    shelf(me, ctx.game.ownCounter),
  );
}

function closing(ctx: Ctx): HTMLElement {
  const { game } = ctx;
  const me = game.me;
  const vs = game.vs;
  if (vs) {
    const mine = vs.myTeam;
    const won = vs.winner !== null && vs.winner === mine;
    return h(
      'div',
      { class: 'screen bh-closing' },
      h('p', { class: `bh-vs-p${won ? ' won' : ''}`, lang: 'ja' }, vs.winner === null ? 'ひきわけ！' : `${TEAM_MARK[vs.winner]} ${vs.teams[vs.winner]!.ja}の かち！`),
      h('p', { class: 'bh-vs-tips' }, vs.teams.map((t) => h('span', { class: `team-${t.id}` }, `${TEAM_MARK[t.id]} ${t.tips} tips`))),
      h('p', { class: 'bh-points' }, `+${game.teamPoints} each`, me && me.bonus ? ` · +${me.bonus} for speaking` : ''),
      h('p', { class: 'hint' }, 'Look at the TV!'),
    );
  }
  const n = game.stars ?? 0;
  return h(
    'div',
    { class: 'screen bh-closing' },
    h(
      'p',
      { class: 'bh-stars-p', 'aria-label': `${n} of 3 stars` },
      Array.from({ length: 3 }, (_, i) => h('span', { class: i < n ? 'on' : 'off', style: `--i: ${i}` }, '★')),
    ),
    h('p', { class: 'bh-points' }, `+${game.teamPoints} team`, me && me.bonus ? ` · +${me.bonus} for speaking` : ''),
    h('p', { class: 'hint' }, `${game.tips} of ${game.maxTips} tips this shift. Look at the TV!`),
  );
}

export const bentoHausPhone: PhoneMode<BentoView> = {
  key(view, game) {
    const me = game.me;
    const boxes = game.visits.filter((v) => me?.taking.some((t) => t.visitId === v.id)).map((v) => [v.id, v.box, v.state]);
    return JSON.stringify([
      view.phase,
      game.round,
      me?.taking.map((t) => t.visitId),
      boxes,
      me?.tickets.map((t) => [t.id, t.state, t.readback, t.asked]),
      me?.calls.map((c) => [c.id, c.state]),
      me?.shelf,
      game.stars,
      game.vs?.teams.map((t) => t.tips),
      game.vs?.winner,
      me?.bonus,
      picked,
    ]);
  },

  render(ctx) {
    const { view, game } = ctx;
    if (!game.me) return waiting('Watch the TV!');
    switch (view.phase) {
      case 'intro':
        return waiting('Pon’s bento shop is opening. Watch the TV!');
      case 'prompt':
        return h(
          'div',
          { class: 'screen' },
          h('h2', { class: 'big', lang: 'ja' }, game.info?.ja ?? ''),
          h('p', {}, game.info?.en ?? '', ': ', game.info?.what ?? ''),
          teamBar(game),
          game.vs && game.vs.myTeam !== null ? h('p', { class: 'hint' }, 'Call your own team only: the other kitchen can’t hear your phone. Serve first to win the customer.') : null,
          game.me.shelf.length ? shelf(game.me, game.ownCounter) : null,
          h('p', { class: 'hint' }, '📞 Phone rings? Call each food: ', h('span', { lang: 'ja' }, '「いなり みっつ、おねがいします！」')),
          h('p', { class: 'hint' }, '🎫 Ticket? Read it back ', h('span', { lang: 'ja' }, '「はい、いなり みっつですね！」'), ' and send it.'),
        );
      case 'answer':
        return kitchen(ctx);
      case 'score':
        return closing(ctx);
      default:
        return waiting('Watch the TV!');
    }
  },
};

/** VS is the same kitchen on the phone, with a team bar and a race result. */
export const bentoHausVsPhone: PhoneMode<BentoView> = {
  key: bentoHausPhone.key,
  render(ctx) {
    if (ctx.view.phase === 'intro' && ctx.game.vs) {
      const vs = ctx.game.vs;
      return h('div', { class: 'screen' }, h('h2', { class: 'big', lang: 'ja' }, 'おべんとうハウス VS'), teamBar(ctx.game), vs.myTeam === null ? null : h('p', {}, 'Two kitchens, the same customers. Watch the TV!'));
    }
    return bentoHausPhone.render(ctx);
  },
};
