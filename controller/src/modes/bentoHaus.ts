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
//
// N4 hard roles (Co-op): an N4 phone is offered this shift's role (やります / こんかいは いいです, two equal
// buttons; mid-shift the offer sits below the order and call box). The deputy manager (ふくてんちょう) gets
// a desk card for each complaint or special order; the おもてなし order-taker gets a guest strip on each
// order card. The input shows the line's frame, not the line; the line itself is under "Need the words?",
// and opening it before the first try logs the line as seen (it opens by itself on the deputy manager's first
// incident of the game). A miss gets a private hint here, never on the TV. A station the deputy manager asks
// gets a 📋 request card and taps できました！.
//
// Mixed rooms: once a shift, when the deputy manager's line lands, every other phone gets a Gallery tile (four
// reactions, or the once-a-game curveball), and Kana and N5 phones get the booth's gist while the TV replays
// it. In a 1–2-player room with nobody at N4, Kana and N5 phones get the gist of Pon's stand-in line.

import { h } from '../../../shared/src/dom.js';
import { MAX_ANSWER_LENGTH } from '../../../shared/src/constants.js';
import type { TicketView } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import type { CheckKind, HardRole, MyHardView, StepView } from '../../../shared/src/modes/bentoHaus/hardRoles.js';
import { COUNTS, countWord, foodOf, MAX_COUNT } from '../../../shared/src/modes/bentoHaus/menu.js';
import type { BentoView } from '../../../shared/src/modes/views.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { boothGist, galleryTile } from '../components/gallery.js';
import { roleOffer as roleOfferCard } from '../components/roleOffer.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { hearButton, isSoundOff } from '../components/voice.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<BentoView>;
type Me = NonNullable<BentoView['me']>;

/** How long the order's words stay up before they fade (N5 and N4). */
const ORDER_SHOWN_MS = 6_000;
/** How long the last call's echo stays under the call box. */
const ECHO_MS = 8_000;
/** Sound off: how long a 👀 peek brings faded order words back (in place of 🔊 hearing it again). */
const PEEK_MS = 2_000;
/** When each order's last peek ends, by visit, so a redraw keeps it showing. */
const peeks = new Map<string, number>();

/** Sound off: 👀 shows the faded words again for a moment, so the order is still held in memory. */
function peekButton(words: HTMLElement, visitId: string): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'secondary bh-hear',
      'aria-label': 'Peek at the order again',
      onclick: () => {
        peeks.set(visitId, Date.now() + PEEK_MS);
        words.style.animation = 'none';
        void words.offsetWidth;
        words.style.removeProperty('animation');
        words.style.setProperty('--shown', `${PEEK_MS}ms`);
        words.style.setProperty('--since-delay', '0ms');
      },
    },
    '👀',
  );
}

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
const MOOD = { waiting: 'calm', offered: 'cross', served: 'happy', left: 'cross' } as const;
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

/** VS: a sent-back order from the other kitchen, on offer: take it on (perfect for 5 tips, or nothing) or not. */
function offerCard(ctx: Ctx, t: Me['taking'][number], ringing: boolean): HTMLElement {
  const { game, send } = ctx;
  const visit = game.visits.find((v) => v.id === t.visitId);
  const now = serverNow(game);
  const total = visit ? visit.leaveAt - visit.arriveAt : 1;
  const gone = visit ? Math.min(total, Math.max(0, now - visit.arriveAt)) : 0;
  return h(
    'section',
    { class: `bh-taking bh-offer${ringing ? ' ring' : ''}`, 'data-key': `offer-${t.visitId}` },
    h(
      'div',
      { class: 'bh-taking-head' },
      visit ? customerPic(visit.customerId, 'offered', visit.emoji, 'bh-cust-p') : null,
      h('span', { class: 'bh-who-p', lang: 'ja' }, `🔁 ${visit?.name ?? ''}`),
    ),
    h('div', { class: 'bh-patience-p', style: `--total: ${total}ms; --gone-delay: -${gone}ms;` }, h('span', {})),
    h('p', { class: 'bh-order-words', lang: 'ja' }, 'となりの おみせ、だめでした。　つくって くれますか？'),
    h('p', { class: 'hint' }, 'The other kitchen’s box was sent back. Take the order on? A perfect box earns 5 tips; anything else earns 0.'),
    h(
      'div',
      { class: 'bh-offer-btns' },
      h(
        'button',
        { type: 'button', class: 'bh-serve', onclick: () => (buzz(60), void send({ kind: 'accept', visitId: t.visitId })) },
        h('span', { lang: 'ja' }, '⭕ うけます'),
        h('small', {}, ' Take it on'),
      ),
      h(
        'button',
        { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'refuse', visitId: t.visitId }) },
        h('span', { lang: 'ja' }, '✕ ことわります'),
        h('small', {}, ' No thanks'),
      ),
    ),
  );
}

// ---- N4 hard roles ----

const ROLE_INFO: Record<HardRole, { icon: string; ja: string; en: string; what: string }> = {
  manager: {
    icon: '📋',
    ja: 'ふくてんちょう',
    en: 'Deputy manager',
    what: 'Pon is busy “tasting” (his words), so complaints and special orders come to you. To customers: もうしわけ ございません and 〜て いただけますか. To the kitchen: 〜て もらえますか.',
  },
  omotenashi: {
    icon: '🌸',
    ja: 'おもてなし',
    en: 'Hospitality shift',
    what: 'Look after each guest you take: お〜ください, ＿は ごえんりょ ください (never 〜ては いけません), ＿は よういして あります. Guests give stars.',
  },
};

/** This shift's hard-role offer (the shared offer card): take it on, or the ordinary part this time. */
function roleOffer(ctx: Ctx, hard: MyHardView | undefined): HTMLElement | null {
  if (!hard?.offer) return null;
  const info = ROLE_INFO[hard.offer.role];
  const answer = (accept: boolean) => {
    buzz(60);
    void ctx.send({ kind: 'role', accept });
  };
  return h(
    'section',
    { class: 'bh-taking bh-offer', 'data-key': `role-${hard.offer.role}` },
    roleOfferCard({
      kicker: `${info.icon} Hard role · N4`,
      role: { text: info.ja, kana: info.ja, en: info.en },
      pitch: info.what,
      takeGloss: 'やります',
      declineGloss: 'こんかいは いいです',
      onTake: () => answer(true),
      onDecline: () => answer(false),
    }),
  );
}

/** Mixed rooms: this phone's Gallery tile and the booth's gist, while they're out. */
function mixedRoom(ctx: Ctx, hard: MyHardView | undefined): (HTMLElement | null)[] {
  return [
    galleryTile(hard?.gallery ?? null, (pick) => {
      buzz(30);
      void ctx.send({ kind: 'gallery', pick });
    }),
    boothGist(hard?.booth ?? null),
  ];
}

const roleBadge = (hard: MyHardView | undefined) =>
  hard?.role ? h('p', { class: 'bh-role-p', lang: 'ja' }, `${ROLE_INFO[hard.role].icon} ${ROLE_INFO[hard.role].ja}`, h('small', {}, ` ${ROLE_INFO[hard.role].en}`)) : null;

/** What the input shows: the frame the line needs, so the player builds it rather than reads it. */
const FRAME_CUE: Record<CheckKind, string> = {
  'sorry-ask': 'もうしわけ ございません。〜て いただけますか',
  ask: '〜て いただけますか',
  kitchen: '〜を 〜て もらえますか',
  welcome: 'お〜ください',
  decline: '＿は ごえんりょ ください',
  ready: '＿は よういして あります',
};

// Lines whose "Need the words?" was opened before their first try: sent as peeked, logged as seen.
const peekedLines = new Set<string>();

/** One hard-role script: the lines said so far, then the next one to say, with a private hint after a miss. */
function lineBox(key: string, steps: StepView[], at: number, say: (u: Utterance | null, peeked: boolean) => void, firstHelp = false): HTMLElement {
  const step = steps[at];
  const lineKey = `${key}-${at}`;
  const send = (u: Utterance | null) => {
    const peeked = peekedLines.delete(lineKey);
    say(u, peeked);
  };
  return h(
    'div',
    { class: 'bh-lines' },
    steps.slice(0, at).map((x) => h('p', { class: `bh-line-done${x.ok ? '' : ' skipped'}`, lang: 'ja' }, x.ok ? `✓ ${x.model.text}` : '– skipped')),
    step
      ? [
          h('p', { class: 'bh-line-to' }, step.to === 'customer' ? '🙇 To the customer' : '🍳 To the kitchen'),
          step.hint ? h('p', { class: 'bh-hint-p' }, '💡 ', step.hint, step.said ? h('small', { lang: 'ja' }, ` 「${step.said}」`) : null) : null,
          h(
            'details',
            {
              class: 'bh-model',
              // Open after a miss, and by itself on the deputy manager's first incident of the game.
              open: !!step.hint || firstHelp || undefined,
              ontoggle: (e: Event) => {
                if ((e.currentTarget as HTMLDetailsElement).open && step.said === null) peekedLines.add(lineKey);
              },
            },
            h('summary', {}, 'Need the words?'),
            h('p', { lang: 'ja' }, step.model.text, h('small', {}, ` ${step.model.en}`)),
          ),
          speakBox({ label: 'Hold and say it', placeholder: FRAME_CUE[step.check], maxLength: MAX_ANSWER_LENGTH, autoSend: true, draftKey: lineKey, onSend: (u) => send(u) }),
          h('button', { type: 'button', class: 'secondary bh-skip', onclick: () => send(null) }, 'Skip this line'),
        ]
      : null,
  );
}

/** The manager's desk: a customer with a complaint or a special request. */
function managerDesk(ctx: Ctx, hard: MyHardView | undefined): HTMLElement[] {
  return (hard?.desk ?? []).map((d) =>
    h(
      'section',
      { class: 'bh-taking bh-desk', 'data-key': `desk-${d.id}` },
      h(
        'div',
        { class: 'bh-taking-head' },
        customerPic(d.customerId, 'left', d.emoji, 'bh-cust-p'),
        h('span', { class: 'bh-who-p', lang: 'ja' }, `📋 ${d.name}`),
        h('span', { class: 'bh-rush-p' }, d.kind === 'complaint' ? 'Complaint' : 'Special order'),
      ),
      h('div', { class: 'bh-patience-p', style: `--total: ${d.until - d.at}ms; --gone-delay: -${Math.max(0, serverNow(ctx.game) - d.at)}ms;` }, h('span', {})),
      h('p', { class: 'bh-order-words', lang: 'ja' }, `「${d.line.text}」`),
      h('p', { class: 'hint' }, d.line.en),
      lineBox(
        `desk-${d.id}`,
        d.steps,
        d.step,
        (u, peeked) => void ctx.send(u ? { kind: 'manager', incidentId: d.id, utterance: u, ...(peeked ? { peeked } : {}) } : { kind: 'manager', incidentId: d.id, skip: true }),
        d.firstHelp,
      ),
    ),
  );
}

/** What the deputy manager asked this station to do. */
function requests(ctx: Ctx, me: Me): HTMLElement | null {
  const list = me.hard?.requests ?? [];
  if (!list.length) return null;
  return h(
    'section',
    { class: 'bh-tickets' },
    h('p', { class: 'bh-section' }, '📋 From the deputy manager'),
    list.map((q) =>
      h(
        'div',
        { class: 'bh-ticket open bh-request', 'data-key': `req-${q.incidentId}` },
        h('span', { class: 'bh-ticket-for', lang: 'ja' }, `${q.customer.emoji} ${q.customer.name}`),
        q.foodId ? foodLabel(q.foodId, me.level) : null,
        h('p', { class: 'bh-request-words', lang: 'ja' }, `「${q.text}」`, h('small', {}, ` ${q.en}`)),
        h(
          'button',
          {
            type: 'button',
            class: 'primary bh-send',
            onclick: () => {
              buzz();
              void ctx.send({ kind: 'request-done', incidentId: q.incidentId });
            },
          },
          h('span', { lang: 'ja' }, 'はい、できました！'),
          h('small', {}, ' Done'),
        ),
      ),
    ),
  );
}

/** おもてなし: this order's guest, seated and answered in keigo. */
function guestStrip(ctx: Ctx, me: Me, visitId: string): HTMLElement | null {
  const g = me.hard?.guests[visitId];
  if (!g) return null;
  return h(
    'div',
    { class: 'bh-guest-p' },
    h('p', { class: 'bh-line-to', lang: 'ja' }, '🌸 おもてなし ', h('small', {}, `${'★'.repeat(g.said.length)}${'☆'.repeat(Math.max(0, 2 - g.said.length))} · one more ★ when it’s served`)),
    g.ask && g.step < g.steps.length ? h('p', { class: 'bh-guest-ask', lang: 'ja' }, `「${g.ask.text}」`, h('small', {}, ` ${g.ask.en}`)) : null,
    lineBox(`guest-${visitId}`, g.steps, g.step, (u, peeked) =>
      void ctx.send(u ? { kind: 'omotenashi', visitId, utterance: u, ...(peeked ? { peeked } : {}) } : { kind: 'omotenashi', visitId, skip: true }),
    ),
  );
}

function orderCard(ctx: Ctx, me: Me, t: Me['taking'][number], ringing: boolean): HTMLElement {
  const { game, send } = ctx;
  if (t.offer) return offerCard(ctx, t, ringing);
  const visit = game.visits.find((v) => v.id === t.visitId);
  const now = serverNow(game);
  const shownFor = Math.max(0, now - t.at);
  const total = visit ? visit.leaveAt - visit.arriveAt : 1;
  const gone = visit ? Math.min(total, Math.max(0, now - visit.arriveAt)) : 0;
  const peekLeft = (peeks.get(t.visitId) ?? 0) - Date.now();
  const fadeStyle = peekLeft > 0 ? `--shown: ${Math.round(peekLeft)}ms; --since-delay: 0ms;` : `--shown: ${ORDER_SHOWN_MS}ms; --since-delay: -${Math.round(shownFor)}ms;`;
  const words = h('p', { class: `bh-order-words${t.fades ? ' fades' : ''}`, lang: 'ja', style: fadeStyle }, t.text);
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
      isSoundOff() ? (t.fades ? peekButton(words, t.visitId) : null) : hearButton(t.text, '🔊', 'secondary bh-hear'),
    ),
    visit ? h('div', { class: 'bh-patience-p', style: `--total: ${total}ms; --gone-delay: -${gone}ms;` }, h('span', {})) : null,
    t.steal ? h('p', { class: 'bh-steal-p', lang: 'ja' }, '🔁 ぴったりなら +5 💰', h('small', {}, ' Perfect for 5 tips, anything else 0')) : null,
    guestStrip(ctx, me, t.visitId),
    words,
    // The fade is explained on the first shift; after that it's known.
    t.fades ? (game.round === 1 ? h('p', { class: 'hint bh-fade-hint' }, isSoundOff() ? 'The words fade: 👀 peeks for a moment.' : 'The words fade: 🔊 hears it again.') : null) : h('p', { class: 'hint' }, t.en),
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
    rivalBox(game, t.visitId, visit?.slots ?? 0),
    h(
      'div',
      { class: `bh-box-p${empty ? ' empty' : ''}`, 'aria-label': 'In the box' },
      empty
        ? h('span', { class: 'hint' }, '🍱 Empty for now: call your team for each food.')
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
      t.state === 'sent' ? ' ✓ できました' : lostRace(ctx.game, t.customer?.visitId) ? ' ✗ the other kitchen served first' : ' ✗ not needed',
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
    t.customer
      ? h(
          'span',
          { class: 'bh-ticket-for', lang: 'ja' },
          customerPic(t.customer.id, 'waiting', t.customer.emoji, 'bh-ticket-cust'),
          `${t.customer.name}`,
          t.customer.rush ? h('b', { class: 'bh-rush-p' }, 'いそいで！') : null,
        )
      : null,
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

/** VS: how full the other kitchen's box for this customer is, a slot per food ordered. */
function rivalBox(game: BentoView, visitId: string, slots: number): HTMLElement | null {
  const vs = game.vs;
  if (!vs || vs.myTeam === null || !slots) return null;
  const other = vs.teams.find((t) => t.id !== vs.myTeam);
  const v = other?.visits.find((x) => x.id === visitId);
  if (!other || !v) return null;
  const filled = Math.min(slots, v.box.length);
  return h(
    'p',
    { class: `bh-rival-p team-${other.id}`, 'aria-label': `${other.en}'s box: ${filled} of ${slots}` },
    pip(other.id),
    h('span', { lang: 'ja' }, `${SHORT[other.id]}の はこ`),
    h('span', { class: 'bh-rival-slots' }, Array.from({ length: slots }, (_, i) => h('i', { class: i < filled ? 'on' : '' }))),
  );
}

/** VS: the customer this kitchen lost because the other one served first. */
function lostRace(game: BentoView, visitId: string | undefined): boolean {
  const vs = game.vs;
  if (!vs || vs.myTeam === null || !visitId) return false;
  return vs.teams.some((t) => t.id !== vs.myTeam && t.visits.some((v) => v.id === visitId && (v.state === 'served' || v.sentBack)));
}

/** Tickets waiting below an order card: a pill that jumps down to them. */
function ticketPill(me: Me): HTMLElement | null {
  const n = me.tickets.filter((t) => t.state === 'open').length;
  if (!n || !me.taking.length) return null;
  return h(
    'button',
    { type: 'button', class: 'bh-ticket-pill', onclick: () => document.querySelector('.bh-tickets')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    `🎫 ${n} ${n === 1 ? 'ticket' : 'tickets'} ↓`,
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

type VsTeam = NonNullable<BentoView['vs']>['teams'][number];
/** A team's badge: red round, blue diamond, so they differ without colour too. */
const pip = (id: number) => h('span', { class: `bh-pip team-${id}`, 'aria-hidden': 'true' });
const tipsWord = (n: number) => (n === 1 ? 'tip' : 'tips');
const SHORT = ['あか', 'あお'] as const;

/** VS: whose kitchen this phone is in, the race this shift (your team first) and your mistake meter. */
function teamBar(game: BentoView): HTMLElement | null {
  const vs = game.vs;
  if (!vs || vs.myTeam === null) return null;
  const mine = vs.teams[vs.myTeam]!;
  const order = [mine, ...vs.teams.filter((t) => t !== mine)];
  return h(
    'div',
    { class: `bh-team-p team-${mine.id}` },
    h('b', { lang: 'ja' }, pip(mine.id), mine.ja),
    h(
      'span',
      { class: 'bh-team-race', 'data-key': `race-${order.map((t) => t.tips).join('-')}` },
      h('small', {}, 'this shift '),
      order.flatMap((t, i) => [i ? ' – ' : '', h('span', { class: `bh-team-score team-${t.id}`, lang: 'ja' }, pip(t.id), `${SHORT[t.id]} ${t.tips}`)]),
      game.round > 1 ? h('small', {}, ` · game ${order.map((t) => t.total).join('–')}`) : null,
    ),
    h(
      'span',
      { class: `bh-meter-p${mine.meter >= 60 ? ' hot' : ''}`, role: 'img', 'aria-label': `Mistake meter ${mine.meter}%`, style: `--m: ${mine.meter}%` },
      h('span', { lang: 'ja' }, 'ミス'),
      h('i', {}),
    ),
  );
}

/** VS: what just happened to an order this phone took: won, lost to the other kitchen, or sent back. */
function raceNote(game: BentoView, me: string): HTMLElement | null {
  const vs = game.vs;
  if (!vs || vs.myTeam === null) return null;
  const mine = vs.teams[vs.myTeam]!;
  const other: VsTeam | undefined = vs.teams.find((t) => t !== mine);
  const now = serverNow(game);
  const v = game.visits
    .filter((x) => x.takerId === me && x.state !== 'waiting' && x.state !== 'offered' && x.endedAt !== null && now - x.endedAt < 2_600)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
  if (!v) return null;
  // The other kitchen served first (even if its box then came straight back).
  const otherServed = !!other?.visits.some((x) => x.id === v.id && (x.state === 'served' || x.sentBack));
  let cls = 'lost';
  let text: (string | HTMLElement)[];
  if (v.sentBack) text = ['↩ つきかえし！ ', h('small', {}, 'Your ミス meter was full: refund, 0 tips')];
  else if (v.steal) [cls, text] = v.state === 'served' && v.tips ? ['won', ['🔁 ぴったり！ +5 💰']] : ['lost', [v.state === 'served' ? '🔁 ざんねん… 0 💰' : '🔁 ことわりました']];
  else if (v.state === 'served') [cls, text] = ['won', [pip(mine.id), `${mine.ja}が さきに だした！ +${v.tips} 💰`]];
  else if (otherServed && other) text = [pip(other.id), `${other.ja}が さきに だした…`, v.tips ? ` わけあり +${v.tips}` : ''];
  else text = ['💨 ', v.tips ? `わけあり +${v.tips}` : 'かえりました'];
  return h('p', { class: `bh-race-p ${cls}`, lang: 'ja', 'data-key': `race-${v.id}` }, text);
}

// Each order this phone took buzzes once when it ends: a long one if it was lost.
let ended = new Set<string>();
function feelEnd(game: BentoView, me: string): void {
  const v = game.visits.find((x) => x.takerId === me && x.endedAt !== null && !ended.has(x.id));
  if (!v || !game.vs) return;
  ended.add(v.id);
  buzz(v.state === 'served' && v.tips && !v.sentBack ? [60, 40, 60] : 300);
}

function kitchen(ctx: Ctx): HTMLElement {
  const me = ctx.game.me!;
  const ringing = feel(ctx.game, me);
  const idle = !me.taking.length && !me.tickets.some((t) => t.state === 'open') && !me.hard?.desk.length && !me.hard?.requests.length;
  feelEnd(ctx.game, ctx.me.id);
  return h(
    'div',
    { class: 'screen bh-kitchen' },
    teamBar(ctx.game),
    raceNote(ctx.game, ctx.me.id),
    roleBadge(me.hard),
    mixedRoom(ctx, me.hard),
    managerDesk(ctx, me.hard),
    requests(ctx, me),
    ticketPill(me),
    me.taking.map((t) => orderCard(ctx, me, t, ringing.has(t.visitId))),
    me.taking.length ? callBox(ctx, me) : null,
    // Mid-shift, a still-open offer waits below the order and the call box (it leads on the title card).
    roleOffer(ctx, me.hard),
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
    const w = vs.winner;
    const won = w !== null && w === mine;
    // The result waits for the TV to stamp it, then buzzes: won, lost or a draw.
    const reveal = 400 + Math.min(vs.teams[0]?.visits.length ?? 0, 8) * 300 + 300;
    if (closingBuzzed !== game.round) {
      closingBuzzed = game.round;
      setTimeout(() => buzz(w === null ? [100, 100, 100] : won ? [80, 60, 80, 60, 200] : 400), reveal);
    }
    const order = mine === null ? vs.teams : [vs.teams[mine]!, ...vs.teams.filter((t) => t.id !== mine)];
    return h(
      'div',
      { class: `screen bh-closing bh-vs-close${mine !== null ? ` team-${mine}` : ''}`, style: `--reveal: ${reveal}ms` },
      h(
        'p',
        { class: `bh-vs-p${won ? ' won' : ''}${w !== null ? ` team-${w}` : ''}`, lang: 'ja' },
        w === null ? 'ひきわけ！' : [pip(w), `${vs.teams[w]!.ja}の かち！`],
        h('small', {}, mine === null ? '' : w === null ? 'A draw' : won ? 'Your team wins the shift!' : 'The other team wins this one.'),
      ),
      h(
        'p',
        { class: 'bh-vs-tips' },
        order.map((t) => h('span', { class: `team-${t.id}` }, pip(t.id), `${t.ja}${t.id === mine ? ' (you)' : ''}: ${t.tips} ${tipsWord(t.tips)}`)),
      ),
      h('p', { class: 'bh-points' }, `+${game.teamPoints} points each on your team`, me && me.bonus ? ` · +${me.bonus} for speaking` : ''),
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

let closingBuzzed = -1;

/** An example call from tonight's menu: 「からあげ みっつ」. */
function example(game: BentoView): string {
  const f = foodOf(game.menu[0] ?? 'karaage') ?? foodOf('karaage')!;
  return `${f.kana} ${countWord(f, 3, game.ownCounter)}`;
}

export const bentoHausPhone: PhoneMode<BentoView> = {
  key(view, game, playerId) {
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
      game.vs?.teams.map((t) => [t.tips, t.meter, t.visits.filter((v) => me?.taking.some((x) => x.visitId === v.id)).map((v) => v.box.length)]),
      me?.taking.map((t) => t.offer ?? 0),
      game.visits.filter((v) => v.takerId === playerId && v.state !== 'waiting').map((v) => [v.id, v.state]),
      game.vs?.winner,
      me?.bonus,
      picked,
      me?.hard
        ? [
            me.hard.offer,
            me.hard.role,
            me.hard.desk.map((d) => [d.id, d.step, d.steps.map((x) => x.hint)]),
            me.hard.requests.map((q) => q.incidentId),
            Object.entries(me.hard.guests).map(([id, g]) => [id, g.step, g.steps.map((x) => x.hint)]),
            me.hard.gallery ? [me.hard.gallery.kind, me.hard.gallery.picked] : null,
            !!me.hard.booth,
          ]
        : null,
      !!game.standIn?.gist,
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
          roleOffer(ctx, game.me.hard),
          roleBadge(game.me.hard),
          // The host stand-in: Pon plays the deputy manager for one line; Kana and N5 phones get the gist.
          boothGist(game.standIn?.gist ?? null),
          game.vs && game.vs.myTeam !== null ? h('p', { class: 'hint' }, 'Call your own team only: the other kitchen can’t hear your phone. Serve first to win the customer.') : null,
          game.me.shelf.length ? shelf(game.me, game.ownCounter) : null,
          h('p', { class: 'hint' }, '📞 Phone rings? Call each food: ', h('span', { lang: 'ja' }, `「${example(game)}、おねがいします！」`)),
          h('p', { class: 'hint' }, '🎫 Ticket? Read it back ', h('span', { lang: 'ja' }, `「はい、${example(game)}ですね！」`), ' and send it.'),
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
