// Bento Haus (おべんとうハウス), Co-op Shift: Overcooked in Japanese. Yōkai customers phone in bento
// orders; the kitchen is split across everyone's phones, so the team has to call out to each other in
// Japanese to fill each box before the customer gives up. See docs/modes/bento-haus.md.
//
// One customer at a time phones their order to one player, the order-taker (ちゅうもんがかり), and the
// job rotates with every customer. The TV never shows or plays the order. The food is spread across every
// phone, the order-taker's too, and a station can only send food someone has called:
//
//   call       anyone says 「からあげ ふたつ、おねがいします！」 (or taps it). The call is matched against this
//              round's menu, and a ticket lands on the phone that holds that food, with the right reading
//              printed over the number. A call that doesn't come through is 📻 ザザッ… on the TV, with no name.
//   read-back  the station can say it back (「はい、からあげ ふたつですね！」) for a bonus,
//   send       then sends it (できました！): the food goes into the box.
//   serve      the order-taker checks the box and serves it (おまたせしました！). 3 tips for a perfect box,
//              2 with one thing off (the customer names it), 1 if it's at least food.
//
// Three rounds, each one shift (`answer`) with customers arriving and leaving on the mode's own clock
// (`wakeAt` / `wake`, so the phase never changes mid-shift): ① ランチラッシュ plain orders, ② なぞなぞ
// ちゅうもん customers describe food and change their minds, ③ ラッシュアワー two at once, some in a hurry.
// Co-op: every tip pays the whole team, and the round ends with 1–3 ★.

import type { Level } from '../../../../content/src/types.js';
import { isUtterance, normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { isObject, moveError, MOVE_OK, pick, shuffled, type Award, type Mode, type ModeContext, type ModePlayer, type MoveResult } from '../mode.js';
import { COUNTS, countWord, KANJI_SPELLINGS, customerOf, customersFor, FOODS, foodOf, MAX_COUNT, RIDDLE_EN, RIDDLES, type Customer, type Food, type JpLine } from './menu.js';

// ---- tuning ----

export const TOTAL_ROUNDS = 3;
/** Each tip pays everyone (co-op). */
export const TIP_POINTS = 50;
/** Tips per box: perfect, one thing off, at least it's food. A rush order doubles them. */
export const TIPS = { perfect: 3, close: 2, meh: 1, wakeari: 1, steal: 5 } as const;
/** Speaking bonuses: per step, from one pool capped at 30% of the round's team points. */
export const BONUS_POOL_SHARE = 0.3;
export const BONUS = { callSpoken: 30, callTyped: 12, readback: 15, ask: 10, serve: 15 } as const;

export const SHIFT_MS = [90_000, 100_000, 110_000] as const;
/** How long a customer waits: a base, more for each thing ordered and for a riddle; a rush order half. */
export const PATIENCE = { base: 40_000, perLine: 10_000, riddle: 12_000, solo: 1.4 } as const;
/** A free counter is filled after this; customers stop coming in the shift's last seconds. */
export const ARRIVE_GAP_MS = 3_000;
export const FIRST_ARRIVAL_MS = 1_500;
export const LAST_ORDER_MS = 20_000;
/** A finished customer stays on the TV this long with their reaction. */
export const LINGER_MS = 2_600;
/** Pon's taste-test banner stays up this long. */
export const AJIMI_MS = 6_000;

export const DURATIONS = { intro: 14_000, prompt: 8_000, score: 12_000 } as const;

export const ROUND_INFO = [
  { ja: 'ランチラッシュ', en: 'Lunch Rush', what: 'Plain orders: a food and how many.' },
  { ja: 'なぞなぞ ちゅうもん', en: 'Riddle Orders', what: 'Some customers describe the food instead of naming it, or change their minds. Each food takes its own counter now: 〜ほん, 〜まい, 〜こ.' },
  { ja: 'ラッシュアワー', en: 'Rush Hour', what: 'Two customers at once, and some are in a hurry (いそいで！): double tips.' },
] as const;

// ---- state ----

export interface OrderLine {
  foodId: string;
  n: number;
  /** Round 2: described, not named. */
  riddle: boolean;
}

export interface Visit {
  id: string;
  customerId: string;
  takerId: string;
  lines: OrderLine[];
  text: string;
  en: string;
  rush: boolean;
  arriveAt: number;
  leaveAt: number;
  box: Record<string, number>;
  /** VS: 'offered' is a sent-back order the other kitchen hasn't accepted yet. */
  state: 'waiting' | 'served' | 'left' | 'offered';
  endedAt: number | null;
  tips: number;
  /** VS: a sent-back order offered to the other kitchen (perfect or nothing). */
  steal?: boolean;
  /** VS: served, then sent back for a refund when the kitchen's mistake meter filled. */
  sentBack?: boolean;
  /** The customer's line as they go. */
  reaction: JpLine | null;
  /** Pon shape-shifted into this missing food (once a round). */
  baked: string | null;
}

export interface Ticket {
  id: string;
  /** null: nothing on the menu came through (📻). */
  foodId: string | null;
  /** null: the food came through but the number didn't. */
  n: number | null;
  by: string;
  via: Utterance['via'];
  heard: string;
  at: number;
  visitId: string | null;
  /** Who holds the food. */
  stationId: string | null;
  state: 'open' | 'sent' | 'void';
  readback: boolean;
  asked: boolean;
}

export interface Round {
  index: number;
  menu: string[];
  /** food id → the player whose phone holds it. */
  holders: Record<string, string>;
  visits: Visit[];
  tickets: Ticket[];
  started: boolean;
  shiftStart: number;
  shiftEnd: number;
  nextArriveAt: number | null;
  tips: number;
  maxTips: number;
  bakeUsed: boolean;
  ajimi: { visitId: string; foodId: string; at: number } | null;
  sends: number;
  bonus: Record<string, number>;
  stars: number | null;
  teamPoints: number;
  paid: Record<string, number>;
}

export interface PlayerStats {
  calls: number;
  readbacks: number;
  perfect: number;
}

export interface BentoState {
  round: number;
  totalRounds: number;
  current: Round | null;
  takerTurn: number;
  stats: Record<string, PlayerStats>;
  usedCustomers: string[];
  lastCueAt: number;
}

// ---- view ----

export interface VisitView {
  id: string;
  customerId: string;
  name: string;
  nameEn: string;
  emoji: string;
  takerId: string;
  hello: JpLine;
  rush: boolean;
  arriveAt: number;
  leaveAt: number;
  state: Visit['state'];
  endedAt: number | null;
  box: { foodId: string; n: number }[];
  tips: number;
  reaction: JpLine | null;
  baked: string | null;
  /** How many different foods were ordered: the box's compartments. */
  slots: number;
  steal?: boolean;
  sentBack?: boolean;
  /** Score phase only: what was ordered. */
  order?: { text: string; en: string };
}

export interface FeedItem {
  id: string;
  foodId: string | null;
  n: number | null;
  state: Ticket['state'];
  readback: boolean;
  at: number;
}

export interface TicketView {
  id: string;
  foodId: string | null;
  n: number | null;
  /** The number as it should be said with this food's counter (ふたつ, にほん …). */
  reading: string | null;
  state: Ticket['state'];
  readback: boolean;
  asked: boolean;
  at: number;
  /** For the caller's own list: what was heard. */
  heard?: string;
}

export interface TakingView {
  visitId: string;
  text: string;
  en: string;
  /** Kana players see the order as pictures; riddle lines stay words. */
  lines: { foodId: string | null; riddle: string | null; n: number }[];
  at: number;
  /** N5 and N4: the words fade after a few seconds, so the order is mostly heard. */
  fades: boolean;
  /** VS: a sent-back order on offer, until this time: accept (うけます) or refuse (ことわります). */
  offer?: number;
  /** VS: a sent-back order this kitchen took on: perfect or nothing. */
  steal?: boolean;
}

/** Bento Haus VS: one of the two kitchens, as the TV sees it. */
export interface VsTeamView {
  id: number;
  ja: string;
  en: string;
  /** Player ids, by seat. */
  members: string[];
  /** Tips this shift, and over the whole game so far. */
  tips: number;
  total: number;
  /** Shifts this kitchen won. */
  wins: number;
  /** The mistake meter, 0–100: sloppy boxes fill it, and at 100 the customer sends one back. */
  meter: number;
  /** This kitchen's copy of each customer at the counter (the same ids in both kitchens). */
  visits: VisitView[];
  feed: FeedItem[];
  ajimi: { foodId: string; at: number } | null;
}

export interface BentoView {
  mode: 'bento-haus' | 'bento-haus-vs';
  round: number;
  totalRounds: number;
  /** ctx.now when this view was made, to line the phone's and TV's clocks up with the server's. */
  at: number;
  info: { ja: string; en: string; what: string } | null;
  shift: { start: number; end: number } | null;
  ownCounter: boolean;
  /** Seats at the counter this shift. */
  seats: number;
  menu: string[];
  tips: number;
  maxTips: number;
  stars: number | null;
  teamPoints: number;
  visits: VisitView[];
  feed: FeedItem[];
  ajimi: { foodId: string; at: number } | null;
  me: { level: Level; taking: TakingView[]; shelf: string[]; tickets: TicketView[]; calls: TicketView[]; bonus: number } | null;
  /** VS only: both kitchens, and which one this phone cooks in. The fields above are that kitchen's (the red one's on the TV). */
  vs?: { myTeam: number | null; teams: VsTeamView[]; winner: number | null };
}

export type BentoMove =
  | { kind: 'call'; utterance: Utterance }
  | { kind: 'call'; foodId: string; n: number }
  | { kind: 'readback'; ticketId: string; utterance: Utterance }
  | { kind: 'send'; ticketId: string }
  | { kind: 'ask'; ticketId: string; utterance?: Utterance }
  | { kind: 'toss'; visitId: string; foodId: string }
  | { kind: 'serve'; visitId: string; utterance?: Utterance };

// ---- helpers ----

/** What a shop keeps across its kitchens: who did what, and when Pon last spoke. */
export type Shop = Pick<BentoState, 'stats' | 'lastCueAt'>;

export const blankStats = (): PlayerStats => ({ calls: 0, readbacks: 0, perfect: 0 });
const stats = (s: Shop, id: string) => (s.stats[id] ??= blankStats());
/** Round 1 counts everything with ひとつ, ふたつ; later rounds use each food's own counter. */
export const ownCounter = (round: number): boolean => round >= 2;
// Pon keeps quiet for a while after each line, so he doesn't talk over the kitchen calls.
const CUE_GAP_MS = 7_000;

/** How many customers can be at the counter at once. */
export function counterSlots(round: number, players: number): number {
  if (players >= 6) return round >= 3 ? 3 : 2;
  if (players >= 3) return 2;
  return round >= 3 && players >= 2 ? 2 : 1;
}

/** The round's menu: enough food for every phone to hold some, never more than the kitchen has. */
export function menuSize(players: number): number {
  return Math.min(FOODS.length, Math.max(6, 4 + players * 2));
}

// Number words in every counter, by count. Whisper writes numbers as digits, and the reader may turn
// kanji numbers to kana, so digits and 一二三四 count too.
const NUMBER_WORDS: [number, string[]][] = [1, 2, 3, 4].map((n) => [
  n,
  [...new Set([...Object.values(COUNTS).map((c) => normalizeReading(c[n - 1]!)), ...(n === 3 ? ['みつ', 'さんほん'] : []), ...(n === 4 ? ['よつ', 'よんぽん'] : [])])],
]);
const KANJI_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, '1': 1, '2': 2, '3': 3, '4': 4 };

/** The first count said in a stretch of a call (kana words, then digits or kanji). */
export function countIn(segment: string): number | null {
  let best: { n: number; at: number } | null = null;
  for (const [n, words] of NUMBER_WORDS) {
    for (const w of words) {
      const at = segment.indexOf(w);
      if (at >= 0 && (!best || at < best.at)) best = { n, at };
    }
  }
  const digit = /[1-4一二三四]/.exec(segment);
  if (digit && (!best || digit.index < best.at)) best = { n: KANJI_NUM[digit[0]]!, at: digit.index };
  return best?.n ?? null;
}

/**
 * What a call asked for: each menu food named in it, with the count said after it (or before it, as in
 * ふたつの からあげ). Matched on the reading, so 唐揚げ二つ and からあげ ふたつ are the same call.
 */
export function parseCall(u: Utterance, menu: readonly string[]): { foodId: string; n: number | null }[] {
  let spelled = u.text;
  for (const [id, forms] of Object.entries(KANJI_SPELLINGS)) for (const k of [...forms].sort((a, b) => b.length - a.length)) spelled = spelled.split(k).join(foodOf(id)!.kana);
  const readings = [...new Set([normalizeReading(spelled), utteranceReading(u), normalizeReading(u.text)])];
  for (const r of readings) {
    const hits: { foodId: string; at: number; end: number }[] = [];
    for (const id of menu) {
      const food = foodOf(id);
      if (!food) continue;
      const k = normalizeReading(food.kana);
      // うさぎりんご is often just りんご; たこさんウインナー just たこさん or ウインナー.
      const keys = [k, ...(id === 'ringo' ? ['りんご'] : []), ...(id === 'tako' ? ['たこさん', 'ういんなあ', 'たこ'] : []), ...(id === 'ebi' ? ['えび'] : [])];
      for (const key of keys) {
        const at = r.indexOf(key);
        if (at >= 0 && !hits.some((h) => at < h.end && at + key.length > h.at)) {
          hits.push({ foodId: id, at, end: at + key.length });
          break;
        }
      }
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a.at - b.at);
    return hits.map((h, i) => {
      const after = r.slice(h.end, hits[i + 1]?.at ?? r.length);
      const before = r.slice(hits[i - 1]?.end ?? 0, h.at);
      return { foodId: h.foodId, n: countIn(after) ?? countIn(before) };
    });
  }
  return [];
}

/** Does a read-back name the food and the number? */
export function readbackOk(u: Utterance, foodId: string, n: number): boolean {
  const call = parseCall(u, [foodId]);
  return call.length > 0 && call[0]!.n === n;
}

/** How a box compares with its order: each food that's off, and how. */
export function compareBox(lines: readonly OrderLine[], box: Record<string, number>): { foodId: string; how: 'missing' | 'few' | 'many' | 'extra' }[] {
  const want: Record<string, number> = {};
  for (const l of lines) want[l.foodId] = (want[l.foodId] ?? 0) + l.n;
  const off: { foodId: string; how: 'missing' | 'few' | 'many' | 'extra' }[] = [];
  for (const id of new Set([...Object.keys(want), ...Object.keys(box)])) {
    const w = want[id] ?? 0;
    const got = box[id] ?? 0;
    if (w === got) continue;
    off.push({ foodId: id, how: w === 0 ? 'extra' : got === 0 ? 'missing' : got < w ? 'few' : 'many' });
  }
  return off;
}

/** The customer's one-thing-off line: the box is named, never the player. */
export function offLine(foodId: string, how: 'missing' | 'few' | 'many' | 'extra'): JpLine {
  const f = foodOf(foodId)!;
  switch (how) {
    case 'missing':
      return { text: `あれ？　${f.kana}が ありません。`, en: `Hm? There's no ${f.en}.` };
    case 'few':
      return { text: `${f.kana}が たりません。`, en: `Not enough ${f.en}.` };
    case 'many':
      return { text: `${f.kana}が おおすぎます。`, en: `Too much ${f.en}.` };
    case 'extra':
      return { text: `${f.kana}は たのんで いません。`, en: `I didn't order ${f.en}.` };
  }
}

const MEH: JpLine = { text: 'うーん… これで いいです。', en: 'Hmm… this will do.' };
const WAKEARI: JpLine = { text: 'わけありで いいです。もらって いきます。', en: "A bit off, but fine. I'll take it." };

/** An order as the customer says it: 「からあげを ふたつと、ミニトマトを みっつ ください。」 */
export function orderText(lines: readonly OrderLine[], own: boolean, opts: { rush?: boolean; changeOfMind?: number } = {}): { text: string; en: string } {
  const parts: string[] = [];
  const en: string[] = [];
  lines.forEach((l, i) => {
    const f = foodOf(l.foodId)!;
    const name = l.riddle ? RIDDLES[l.foodId]! : f.kana;
    const nameEn = l.riddle ? `"${RIDDLE_EN[l.foodId]}"` : f.en;
    if (opts.changeOfMind === i) {
      parts.push(`${name}を ${countWord(f, Math.min(MAX_COUNT, l.n + 1), own)}… やっぱり ${countWord(f, l.n, own)}`);
      en.push(`${l.n + 1}… no, ${l.n} ${nameEn}`);
    } else {
      parts.push(`${name}を ${countWord(f, l.n, own)}`);
      en.push(`${l.n} ${nameEn}`);
    }
  });
  const text = `${opts.rush ? 'いそぎで おねがいします！　' : ''}${parts.join('と、')} ください。`;
  return { text, en: `${opts.rush ? 'Hurry, please! ' : ''}${en.join(' and ')}, please.` };
}

/** Builds one customer's order for this round, by the order-taker's level. */
export function makeOrder(round: number, menu: readonly string[], customer: Customer, takerLevel: Level, random: () => number): { lines: OrderLine[]; text: string; en: string; rush: boolean } {
  const kana = takerLevel === 'kana';
  let pool = [...menu];
  if (customer.rule === 'cold') pool = pool.filter((id) => !foodOf(id)!.hot);
  const want = round === 1 ? (kana ? 1 : 1 + Math.floor(random() * 2)) : round === 2 ? 2 : kana ? 2 : 2 + Math.floor(random() * 2);
  const lines: OrderLine[] = [];
  const add = (foodId: string, n: number) => {
    if (!lines.some((l) => l.foodId === foodId) && menu.includes(foodId)) lines.push({ foodId, n, riddle: false });
  };
  if (customer.rule === 'kyuuri') add('kyuuri', 1 + Math.floor(random() * 2));
  if (customer.rule === 'inari-three') add('inari', 3);
  if (customer.rule === 'onigiri-two') add('onigiri', 2);
  for (const id of shuffled(pool, random)) {
    if (lines.length >= want) break;
    add(id, 1 + Math.floor(random() * (kana ? 2 : 3)));
  }
  if (customer.rule === 'all-one') for (const l of lines) l.n = 1;
  const own = ownCounter(round);
  let changeOfMind: number | undefined;
  if (round === 2 && !kana) {
    // One line is a riddle, or the customer changes their mind about how many.
    const riddleable = lines.findIndex((l) => RIDDLES[l.foodId] && !(customer.rule === 'kyuuri' && l.foodId === 'kyuuri'));
    if (riddleable >= 0 && random() < 0.6) lines[riddleable]!.riddle = true;
    else if (customer.rule !== 'all-one') {
      const i = lines.findIndex((l) => l.n < MAX_COUNT);
      if (i >= 0) changeOfMind = i;
    }
  }
  const rush = round >= 3 && random() < 0.3;
  return { lines, rush, ...orderText(lines, own, { rush, changeOfMind }) };
}

export function patienceFor(lines: readonly OrderLine[], rush: boolean, players: number): number {
  let ms = PATIENCE.base + lines.length * PATIENCE.perLine + (lines.some((l) => l.riddle) ? PATIENCE.riddle : 0);
  if (players <= 1) ms *= PATIENCE.solo;
  return Math.round(rush ? ms / 2 : ms);
}

/** Stars for a round: how many of the tips on offer the team earned. */
export function starsFor(tips: number, maxTips: number): number {
  if (tips <= 0 || maxTips <= 0) return 0;
  const r = tips / maxTips;
  return r >= 0.75 ? 3 : r >= 0.45 ? 2 : 1;
}

export function cue(s: Shop, ctx: ModeContext, event: Parameters<ModeContext['cue']>[0]['event'], slots?: Record<string, string>, force = false): void {
  if (!force && ctx.now - s.lastCueAt < CUE_GAP_MS) return;
  s.lastCueAt = ctx.now;
  ctx.cue({ host: 'pon', event, slots });
}

export const waiting = (r: Round) => r.visits.filter((v) => v.state === 'waiting');
export const lastOrderAt = (r: Round) => r.shiftEnd - LAST_ORDER_MS;

/** A new round's kitchen: the menu, spread across these players' phones. */
export function setupRound(s: Pick<BentoState, 'round'>, ctx: ModeContext, players: readonly ModePlayer[] = ctx.players(), menu?: string[]): Round {
  menu ??= shuffled(
    FOODS.map((f) => f.id),
    ctx.random,
  ).slice(0, menuSize(players.length));
  // Spread the food across every phone, round-robin from a shuffled seat order.
  const order = shuffled(players, ctx.random);
  const holders: Record<string, string> = {};
  if (order.length) menu.forEach((id, i) => (holders[id] = order[i % order.length]!.id));
  return {
    index: s.round,
    menu,
    holders,
    visits: [],
    tickets: [],
    started: false,
    shiftStart: 0,
    shiftEnd: 0,
    nextArriveAt: null,
    tips: 0,
    maxTips: 0,
    bakeUsed: false,
    ajimi: null,
    sends: 0,
    bonus: {},
    stars: null,
    teamPoints: 0,
    paid: {},
  };
}

/** The next order-taker: everyone in turn, skipping whoever is already taking an order if anyone else is free. */
export function nextTaker(s: { takerTurn: number }, r: Round, players: readonly ModePlayer[]): ModePlayer {
  const busy = new Set(waiting(r).map((v) => v.takerId));
  for (let i = 0; i < players.length; i++) {
    const p = players[(s.takerTurn + i) % players.length]!;
    if (!busy.has(p.id)) {
      s.takerTurn = (s.takerTurn + i + 1) % players.length;
      return p;
    }
  }
  const p = players[s.takerTurn % players.length]!;
  s.takerTurn = (s.takerTurn + 1) % players.length;
  return p;
}

/** The next customer through the door: one whose rule fits tonight's menu, not one already waiting. */
export function pickCustomer(s: Pick<BentoState, 'usedCustomers'>, r: Round, ctx: ModeContext): Customer {
  const audience = ctx.audience ?? 'family';
  // A customer whose rule needs food that isn't on tonight's menu stays home.
  const fits = customersFor(audience).filter((c) =>
    c.rule === 'kyuuri'
      ? r.menu.includes('kyuuri')
      : c.rule === 'inari-three'
        ? r.menu.includes('inari')
        : c.rule === 'onigiri-two'
          ? r.menu.includes('onigiri')
          : c.rule === 'cold'
            ? r.menu.some((id) => !foodOf(id)!.hot)
            : true,
  );
  const fresh = fits.filter((c) => !s.usedCustomers.includes(c.id) && !waiting(r).some((v) => v.customerId === c.id));
  const customer = pick(fresh.length ? fresh : fits.filter((c) => !waiting(r).some((v) => v.customerId === c.id)), ctx.random) ?? fits[0]!;
  if (!fresh.length) s.usedCustomers = [];
  s.usedCustomers.push(customer.id);
  return customer;
}

function arrive(s: BentoState, r: Round, at: number, ctx: ModeContext): void {
  const players = ctx.players();
  if (!players.length) return;
  const customer = pickCustomer(s, r, ctx);
  const taker = nextTaker(s, r, players);
  const order = makeOrder(r.index, r.menu, customer, taker.level, ctx.random);
  const patience = patienceFor(order.lines, order.rush, players.length);
  r.visits.push({
    id: ctx.newId(),
    customerId: customer.id,
    takerId: taker.id,
    lines: order.lines,
    text: order.text,
    en: order.en,
    rush: order.rush,
    arriveAt: at,
    leaveAt: at + patience,
    box: {},
    state: 'waiting',
    endedAt: null,
    tips: 0,
    reaction: null,
    baked: null,
  });
  r.maxTips += TIPS.perfect * (order.rush ? 2 : 1);
  cue(s, ctx, 'bento_customer', { name: taker.name });
}

/** Fills free counter places: the next customer comes a little after a place frees up. */
export function planArrival(r: Round, from: number, players: number): void {
  if (r.nextArriveAt !== null) return;
  if (waiting(r).length >= counterSlots(r.index, players)) return;
  const at = from + ARRIVE_GAP_MS;
  if (at < lastOrderAt(r)) r.nextArriveAt = at;
}

export function giveUp(s: Shop, r: Round, v: Visit, at: number, ctx: ModeContext, quiet = false): void {
  v.state = 'left';
  v.endedAt = at;
  // A half-made box still sells, as a わけあり (slightly flawed) bento to a thrifty grandma ghost. A VS
  // sent-back order is perfect or nothing.
  const any = !v.steal && Object.values(v.box).some((n) => n > 0);
  v.tips = any ? TIPS.wakeari : 0;
  v.reaction = any ? WAKEARI : customerOf(v.customerId)!.leave;
  r.tips += v.tips;
  for (const t of r.tickets) if (t.visitId === v.id && t.state === 'open') t.state = 'void';
  if (!quiet) cue(s, ctx, 'bento_leave');
}

/** Runs the shift's clock up to `now`: customers who gave up leave, and new ones come in, in time order. */
function runClock(s: BentoState, r: Round, now: number, ctx: ModeContext): void {
  const players = ctx.players().length;
  for (let guard = 0; guard < 64; guard++) {
    const due = waiting(r)
      .filter((v) => v.leaveAt <= now)
      .sort((a, b) => a.leaveAt - b.leaveAt)[0];
    const arrival = r.nextArriveAt !== null && r.nextArriveAt <= now ? r.nextArriveAt : null;
    if (due && (arrival === null || due.leaveAt <= arrival)) {
      giveUp(s, r, due, due.leaveAt, ctx);
      planArrival(r, due.leaveAt, players);
    } else if (arrival !== null) {
      r.nextArriveAt = null;
      arrive(s, r, arrival, ctx);
      // Another free place fills a beat later.
      if (waiting(r).length < counterSlots(r.index, players) && arrival + ARRIVE_GAP_MS * 2 < lastOrderAt(r)) r.nextArriveAt = arrival + ARRIVE_GAP_MS * 2;
    } else return;
  }
}

/** The shift is over early: nobody waiting and no one else coming. */
export const shiftDone = (r: Round, now: number) => r.started && waiting(r).length === 0 && (r.nextArriveAt === null || r.nextArriveAt >= lastOrderAt(r)) && now >= r.shiftStart + FIRST_ARRIVAL_MS;

function openTicket(s: Shop, r: Round, by: string, via: Utterance['via'], heard: string, foodId: string | null, n: number | null, ctx: ModeContext): Ticket {
  const mine = waiting(r).find((v) => v.takerId === by);
  const visit = mine ?? waiting(r).sort((a, b) => a.arriveAt - b.arriveAt)[0] ?? null;
  const t: Ticket = {
    id: ctx.newId(),
    foodId,
    n,
    by,
    via,
    heard,
    at: ctx.now,
    visitId: visit?.id ?? null,
    stationId: foodId ? (r.holders[foodId] ?? null) : null,
    state: 'open',
    readback: false,
    asked: false,
  };
  r.tickets.push(t);
  return t;
}

const addBonus = (r: Round, id: string, points: number) => (r.bonus[id] = (r.bonus[id] ?? 0) + points);

export function serve(s: Shop, r: Round, v: Visit, by: string, ctx: ModeContext): void {
  const off = compareBox(v.lines, v.box);
  const customer = customerOf(v.customerId)!;
  const any = Object.values(v.box).some((n) => n > 0);
  let tips = 0;
  if (off.length === 0) {
    tips = TIPS.perfect;
    v.reaction = customer.perfect;
    stats(s, by).perfect += 1;
    cue(s, ctx, 'bento_perfect');
  } else if (!r.bakeUsed && off.length === 1 && off[0]!.how === 'missing' && any) {
    // ばけた！ Pon turns into the missing food. Once a round. The customer notices the tail.
    r.bakeUsed = true;
    v.baked = off[0]!.foodId;
    tips = TIPS.perfect;
    v.reaction = { text: `この ${foodOf(v.baked)!.kana}… しっぽが ある。`, en: `This ${foodOf(v.baked)!.en}… has a tail.` };
    cue(s, ctx, 'bento_bake', { food: foodOf(v.baked)!.kana }, true);
  } else if (off.length === 1 && any) {
    tips = TIPS.close;
    v.reaction = customer.wrong ?? offLine(off[0]!.foodId, off[0]!.how);
    cue(s, ctx, 'bento_close');
  } else if (any) {
    tips = TIPS.meh;
    v.reaction = MEH;
    cue(s, ctx, 'bento_meh');
  } else {
    v.reaction = customer.leave;
  }
  if (v.rush) tips *= 2;
  v.tips = tips;
  v.state = 'served';
  v.endedAt = ctx.now;
  r.tips += tips;
  for (const t of r.tickets) if (t.visitId === v.id && t.state === 'open') t.state = 'void';
}

/** Pays a kitchen's round: every tip to each of its players, plus their speaking bonus up to the cap. */
export function payRound(r: Round, ctx: ModeContext, players: readonly ModePlayer[] = ctx.players()): void {
  r.stars = starsFor(r.tips, r.maxTips);
  r.teamPoints = r.tips * TIP_POINTS;
  const cap = Math.round(r.teamPoints * BONUS_POOL_SHARE);
  for (const p of players) {
    const bonus = Math.min(cap, r.bonus[p.id] ?? 0);
    r.paid[p.id] = r.teamPoints + bonus;
    ctx.award(p.id, r.teamPoints + bonus);
  }
}

export function utteranceOk(raw: unknown): raw is Utterance {
  return isUtterance(raw) && raw.text.trim().length > 0;
}

/** A kitchen move other than serving: calling, reading back, asking how many, sending, tossing. */
export function kitchenMove(s: Shop, r: Round, playerId: string, raw: Record<string, unknown>, ctx: ModeContext): MoveResult {
  switch (raw.kind) {
    case 'call': {
      if (!waiting(r).length) return moveError('no-customer');
      if (typeof raw.foodId === 'string') {
        const n = raw.n;
        if (!r.menu.includes(raw.foodId) || typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_COUNT) return moveError('bad-move');
        openTicket(s, r, playerId, 'tap', '', raw.foodId, n, ctx);
        return MOVE_OK;
      }
      if (!utteranceOk(raw.utterance)) return moveError('bad-move');
      const u = raw.utterance;
      const heard = u.text.slice(0, 80);
      const asked = parseCall(u, r.menu);
      if (!asked.length) {
        // Nothing on the menu came through: radio static, with no name on the TV.
        openTicket(s, r, playerId, u.via, heard, null, null, ctx);
        cue(s, ctx, 'bento_static');
        return MOVE_OK;
      }
      for (const a of asked) {
        openTicket(s, r, playerId, u.via, heard, a.foodId, a.n, ctx);
        if (a.n !== null) {
          addBonus(r, playerId, u.via === 'speech' ? BONUS.callSpoken : BONUS.callTyped);
          if (u.via === 'speech') stats(s, playerId).calls += 1;
          const f = foodOf(a.foodId)!;
          const say = `${f.kana} ${countWord(f, a.n, ownCounter(r.index))}、おねがいします`;
          ctx.phrase(playerId, { itemId: `bento:${a.foodId}:${a.n}`, text: say, kana: say, en: `${a.n} ${f.en}, please`, outcome: u.via === 'speech' ? 'said' : 'seen' });
        } else cue(s, ctx, 'bento_static');
      }
      return MOVE_OK;
    }
    case 'readback': {
      const t = r.tickets.find((x) => x.id === raw.ticketId);
      if (t && t.state !== 'open') return moveError('too-late');
      if (!t || t.stationId !== playerId || t.state !== 'open' || t.foodId === null || t.n === null) return moveError('bad-move');
      if (!utteranceOk(raw.utterance)) return moveError('bad-move');
      if (t.readback) return MOVE_OK;
      if (!readbackOk(raw.utterance, t.foodId, t.n)) return moveError('readback-mismatch');
      t.readback = true;
      if (raw.utterance.via === 'speech') {
        addBonus(r, playerId, BONUS.readback);
        stats(s, playerId).readbacks += 1;
      }
      return MOVE_OK;
    }
    case 'ask': {
      const t = r.tickets.find((x) => x.id === raw.ticketId);
      if (t && t.state !== 'open') return moveError('too-late');
      if (!t || t.state !== 'open' || t.foodId === null || t.stationId !== playerId) return moveError('bad-move');
      if (!t.asked && utteranceOk(raw.utterance) && raw.utterance.via === 'speech') addBonus(r, playerId, BONUS.ask);
      t.asked = true;
      return MOVE_OK;
    }
    case 'send': {
      const t = r.tickets.find((x) => x.id === raw.ticketId);
      if (t && t.state !== 'open') return moveError('too-late');
      if (!t || t.stationId !== playerId || t.state !== 'open' || t.foodId === null || t.n === null) return moveError('bad-move');
      const visit = r.visits.find((v) => v.id === t.visitId && v.state === 'waiting') ?? waiting(r).sort((a, b) => a.arriveAt - b.arriveAt)[0];
      if (!visit) {
        t.state = 'void';
        return MOVE_OK;
      }
      t.state = 'sent';
      t.visitId = visit.id;
      visit.box[t.foodId] = (visit.box[t.foodId] ?? 0) + t.n;
      r.sends += 1;
      // あじみ: once a round, Pon "tastes" one of the third thing sent. It has to be called again.
      if (!r.ajimi && r.sends === 3 && visit.box[t.foodId]! > 0) {
        visit.box[t.foodId]! -= 1;
        if (!visit.box[t.foodId]) delete visit.box[t.foodId];
        r.ajimi = { visitId: visit.id, foodId: t.foodId, at: ctx.now };
        cue(s, ctx, 'bento_ajimi', { food: foodOf(t.foodId)!.kana }, true);
      }
      return MOVE_OK;
    }
    case 'toss': {
      const v = r.visits.find((x) => x.id === raw.visitId);
      if (v && v.state !== 'waiting') return moveError('too-late');
      if (!v || v.takerId !== playerId || typeof raw.foodId !== 'string' || !v.box[raw.foodId]) return moveError('bad-move');
      delete v.box[raw.foodId];
      return MOVE_OK;
    }
    default:
      return moveError('bad-move');
  }
}

/** Speaking bonus for saying おまたせしました！ out loud when serving. */
export function serveBonus(r: Round, playerId: string, utterance: unknown): void {
  if (utteranceOk(utterance) && utterance.via === 'speech') addBonus(r, playerId, BONUS.serve);
}

/** The customers at a kitchen's counter: everyone waiting, and whoever just left, for a moment. */
export function visitsView(r: Round | null, scoring: boolean, ctx: ModeContext): VisitView[] {
  return (r?.visits ?? [])
    .filter((v) => scoring || v.state === 'waiting' || v.state === 'offered' || (v.endedAt !== null && ctx.now - v.endedAt < LINGER_MS))
    .map((v) => {
      const c = customerOf(v.customerId)!;
      return {
        id: v.id,
        customerId: v.customerId,
        name: c.name,
        nameEn: c.nameEn,
        emoji: c.emoji,
        takerId: v.takerId,
        hello: c.hello,
        rush: v.rush,
        arriveAt: v.arriveAt,
        leaveAt: v.leaveAt,
        state: v.state,
        endedAt: v.endedAt,
        box: Object.entries(v.box).map(([foodId, n]) => ({ foodId, n })),
        tips: v.tips,
        reaction: v.reaction,
        baked: v.baked,
        ...(v.steal ? { steal: true } : {}),
        ...(v.sentBack ? { sentBack: true } : {}),
        slots: new Set(v.lines.map((l) => l.foodId)).size,
        ...(scoring ? { order: { text: v.text, en: v.en } } : {}),
      };
    });
}

/** The last few kitchen calls, for the TV. */
export const feedView = (r: Round | null): FeedItem[] => (r?.tickets ?? []).slice(-5).map((t) => ({ id: t.id, foodId: t.foodId, n: t.n, state: t.state, readback: t.readback, at: t.at }));

export const ajimiView = (r: Round | null, ctx: ModeContext): BentoView['ajimi'] => (r?.ajimi && ctx.now - r.ajimi.at < AJIMI_MS ? { foodId: r.ajimi.foodId, at: r.ajimi.at } : null);

/** One phone's part of a kitchen: the orders it's taking, its shelf, its tickets and its calls. */
export function meView(r: Round | null, me: ModePlayer | undefined, own: boolean, ctx: ModeContext): BentoView['me'] {
  if (!me) return null;
  if (!r) return { level: me.level, taking: [], shelf: [], tickets: [], calls: [], bonus: 0 };
  const reading = (t: Ticket): string | null => (t.foodId && t.n ? countWord(foodOf(t.foodId)!, t.n, own) : null);
  const ticketView = (t: Ticket, withHeard = false): TicketView => ({
    id: t.id,
    foodId: t.foodId,
    n: t.n,
    reading: reading(t),
    state: t.state,
    readback: t.readback,
    asked: t.asked,
    at: t.at,
    ...(withHeard ? { heard: t.heard } : {}),
  });
  return {
    level: me.level,
    taking: r.visits
      .filter((v) => (v.state === 'waiting' || v.state === 'offered') && v.takerId === me.id)
      .map((v) =>
        v.state === 'offered'
          ? // A sent-back order on offer: the order itself comes once it's accepted.
            { visitId: v.id, text: '', en: '', lines: [], at: v.arriveAt, fades: false, offer: v.leaveAt, steal: true }
          : {
              visitId: v.id,
              text: v.text,
              en: v.en,
              lines: v.lines.map((l) => ({ foodId: l.riddle ? null : l.foodId, riddle: l.riddle ? RIDDLES[l.foodId]! : null, n: l.n })),
              at: v.arriveAt,
              fades: me.level !== 'kana',
              ...(v.steal ? { steal: true } : {}),
            },
      ),
    shelf: r.menu.filter((id) => r.holders[id] === me.id),
    tickets: r.tickets.filter((t) => t.stationId === me.id && (t.state === 'open' || ctx.now - t.at < 4_000)).map((t) => ticketView(t)),
    calls: r.tickets
      .filter((t) => t.by === me.id)
      .slice(-3)
      .map((t) => ticketView(t, true)),
    bonus: r.paid[me.id] !== undefined ? Math.max(0, r.paid[me.id]! - r.teamPoints) : Math.min(r.bonus[me.id] ?? 0, Math.round(r.tips * TIP_POINTS * BONUS_POOL_SHARE)),
  };
}

/** The kitchen's awards: most calls said out loud, most read-backs, most perfect boxes. */
export function shopAwards(s: Shop, ctx: ModeContext): Award[] {
  const out: Award[] = [];
  const best = (key: keyof PlayerStats): ModePlayer | undefined => {
    const ps = ctx.players().filter((p) => (s.stats[p.id]?.[key] ?? 0) > 0);
    return ps.sort((a, b) => (s.stats[b.id]![key] ?? 0) - (s.stats[a.id]![key] ?? 0) || a.seat - b.seat)[0];
  };
  const caller = best('calls');
  if (caller) out.push({ playerId: caller.id, name: caller.name, title: 'こえかけ賞', en: 'Best Caller (most calls said out loud)' });
  const reader = best('readbacks');
  if (reader) out.push({ playerId: reader.id, name: reader.name, title: 'おへんじ賞', en: 'Best Reply (most read-backs)' });
  const packer = best('perfect');
  if (packer) out.push({ playerId: packer.id, name: packer.name, title: 'かんぺき賞', en: 'Perfect Boxes (most served without a slip)' });
  return out;
}

// ---- the mode ----

export const bentoHausMode: Mode<BentoState, BentoView> = {
  info: {
    id: 'bento-haus',
    title: 'Bento Haus',
    titleJa: 'おべんとうハウス',
    blurb: 'Run a yōkai bento shop as one kitchen. The food is on your phones, so call the orders out in Japanese.',
    host: 'pon',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Kitchen calls',
    coop: true,
    phaseLabels: { prompt: 'Next shift', answer: 'Open!', score: 'Closing time' },
  },

  setup(ctx) {
    const all: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) all[p.id] = blankStats();
    return { round: 0, totalRounds: TOTAL_ROUNDS, current: null, takerTurn: 0, stats: all, usedCustomers: [], lastCueAt: -Infinity };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    if (phase === 'intro') {
      ctx.cue({ host: 'pon', event: 'bento_intro', waitMs: 4_000 });
      return;
    }
    if (phase === 'prompt') {
      s.round += 1;
      s.current = setupRound(s, ctx);
      const info = ROUND_INFO[s.round - 1]!;
      ctx.cue({ host: 'pon', event: 'bento_round', slots: { round: info.ja } });
      return;
    }
    const r = s.current;
    if (!r) return;
    if (phase === 'answer' && !r.started) {
      r.started = true;
      r.shiftStart = ctx.now;
      r.shiftEnd = ctx.now + (SHIFT_MS[r.index - 1] ?? SHIFT_MS[0]);
      r.nextArriveAt = ctx.now + FIRST_ARRIVAL_MS;
    }
    if (phase === 'score') {
      payRound(r, ctx);
      cue(s, ctx, 'bento_stars', { stars: ['ゼロ', 'ひとつ', 'ふたつ', 'みっつ'][r.stars ?? 0]!, stars_en: String(r.stars ?? 0) }, true);
    }
  },

  leave(s, phase, ctx) {
    const r = s.current;
    if (!r || phase !== 'answer') return;
    runClock(s, r, ctx.now, ctx);
    // Closing time: whoever is still waiting takes their box as it is.
    for (const v of waiting(r)) giveUp(s, r, v, ctx.now, ctx);
    r.nextArriveAt = null;
  },

  duration(s, phase) {
    if (phase === 'answer') return s.current ? s.current.shiftEnd - s.current.shiftStart : SHIFT_MS[0];
    if (phase === 'intro') return DURATIONS.intro;
    if (phase === 'prompt') return DURATIONS.prompt;
    if (phase === 'score') return DURATIONS.score;
    return 5_000;
  },

  done(s, phase, ctx) {
    const r = s.current;
    if (phase === 'answer' && r) return shiftDone(r, ctx.now);
    return false;
  },

  wakeAt(s, phase, ctx) {
    const r = s.current;
    const now = ctx.now;
    if (phase !== 'answer' || !r?.started) return null;
    const times = [...waiting(r).map((v) => v.leaveAt), ...(r.nextArriveAt !== null ? [r.nextArriveAt] : [])];
    // Also wake when a served or walked-out customer has lingered long enough to leave the counter.
    for (const v of r.visits) if (v.endedAt !== null && v.endedAt + LINGER_MS > now) times.push(v.endedAt + LINGER_MS);
    if (r.ajimi && r.ajimi.at + AJIMI_MS > now) times.push(r.ajimi.at + AJIMI_MS);
    return times.length ? Math.min(...times) : null;
  },

  wake(s, phase, ctx) {
    const r = s.current;
    if (phase === 'answer' && r) runClock(s, r, ctx.now, ctx);
  },

  move(s, phase, playerId, raw, ctx) {
    const r = s.current;
    if (!r || phase !== 'answer' || !r.started) return moveError('wrong-phase');
    if (!isObject(raw)) return moveError('bad-move');
    runClock(s, r, ctx.now, ctx);
    const player = ctx.player(playerId);
    if (!player) return moveError('not-allowed');

    if (raw.kind === 'serve') {
      const v = r.visits.find((x) => x.id === raw.visitId);
      if (v && v.state !== 'waiting') return moveError('too-late');
      if (!v || v.takerId !== playerId) return moveError('bad-move');
      serveBonus(r, playerId, raw.utterance);
      serve(s, r, v, playerId, ctx);
      planArrival(r, ctx.now, ctx.players().length);
      return MOVE_OK;
    }
    return kitchenMove(s, r, playerId, raw, ctx);
  },

  release(s, playerId, ctx) {
    const r = s.current;
    if (!r) return;
    const left = ctx.players().filter((p) => p.id !== playerId);
    if (!left.length) return;
    // Their shelf and their orders go to the others.
    let i = 0;
    for (const id of Object.keys(r.holders)) if (r.holders[id] === playerId) r.holders[id] = left[i++ % left.length]!.id;
    for (const t of r.tickets) if (t.stationId === playerId && t.foodId) t.stationId = r.holders[t.foodId] ?? null;
    for (const v of waiting(r)) if (v.takerId === playerId) v.takerId = left[i++ % left.length]!.id;
  },

  progress(s) {
    return { round: Math.max(1, s.round), totalRounds: s.totalRounds };
  },

  view(s, phase, viewer, ctx) {
    const r = s.current;
    const info = s.round ? ROUND_INFO[s.round - 1]! : null;
    const own = ownCounter(s.round);
    const scoring = phase === 'score';
    const visits = visitsView(r, scoring, ctx);
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    return {
      mode: 'bento-haus',
      round: s.round,
      totalRounds: s.totalRounds,
      at: ctx.now,
      info: info ? { ...info } : null,
      shift: r?.started ? { start: r.shiftStart, end: r.shiftEnd } : null,
      ownCounter: own,
      seats: r ? counterSlots(r.index, ctx.players().length) : 1,
      menu: r?.menu ?? [],
      tips: r?.tips ?? 0,
      maxTips: r?.maxTips ?? 0,
      stars: r?.stars ?? null,
      teamPoints: r?.teamPoints ?? 0,
      visits,
      feed: feedView(r),
      ajimi: ajimiView(r, ctx),
      me: meView(r, me, own, ctx),
    };
  },

  awards(s, ctx) {
    return shopAwards(s, ctx);
  },
};
