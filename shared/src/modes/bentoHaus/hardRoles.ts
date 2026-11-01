// Bento Haus's N4 hard roles: harder scripts inside the same Co-op shift. They appear only when the room
// has an N4 player, and each shift offers them to the room's N4 players in turn (phone: やります, or
// こんかいは いいです for the ordinary part). Nobody else's part or pay changes.
//
//   manager (てんちょう)  one seat a shift. A customer who complains about a box, or makes a special
//              request, comes to the manager's phone: say sorry and ask the customer politely
//              (もうしわけ ございません。すこし まって いただけますか。), then ask a station
//              (からあげを もう ひとつ つくって もらえますか。). The request lands on that station's phone
//              and they tap できました！. Goals 4.1 and 4.9.
//   おもてなし  the order-taker's job with a guest to look after (was Ryokan Front Desk): seat them
//              (おすわりください), then answer their question: turn it down with ＿は ごえんりょ ください
//              (never ＿ては いけません), or say it's ready (＿は よういして あります). Each guest gives
//              0–3 stars. Goals 4.7 and 4.9.
//
// Only lines said right reach the TV; keigo corrections stay on the player's own phone. Every line
// here is draft until the fluent check, and each is tagged by name with the N4 frames it practises.
// N3 (step 6): ＿で ございます, ＿て おります, ＿させて いただきます for the おもてなし shift.

import type { ReviewStatus } from '../../../../content/src/types.js';
import { normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import type { ModeContext, ModePlayer } from '../mode.js';
import type { Round, Visit } from './bentoHaus.js';
import { countWord, customerOf, foodOf, KANJI_SPELLINGS, type JpLine } from './menu.js';

// ---- the scripts ----

export const HARD_STATUS: ReviewStatus = 'draft';

/** A line a hard role says: kana reading and the N4 frames it practises, by name. */
export interface HardLine extends JpLine {
  kana: string;
  frames?: readonly string[];
}

/** How a line is checked: which frame it must use (and what the phone says when it doesn't). */
export type CheckKind = 'sorry-ask' | 'ask' | 'kitchen' | 'welcome' | 'decline' | 'ready';

export interface StepScript {
  to: 'customer' | 'kitchen';
  check: CheckKind;
  model: HardLine;
  /** Words the line must name (any one), so the station knows what's needed. */
  keys?: readonly string[];
}

const L = (text: string, en: string, frames: readonly string[]): HardLine => ({ text, kana: text, en, frames });

const SORRY_WAIT = L('もうしわけ ございません。すこし まって いただけますか。', "I'm terribly sorry. Could you wait a moment?", ['keigo-verb', 'te-itadakemasu-ka']);
const SURE_WAIT = L('かしこまりました。すこし まって いただけますか。', 'Certainly. Could you wait a moment?', ['keigo-verb', 'te-itadakemasu-ka']);

export interface SpecialScript {
  id: string;
  status: ReviewStatus;
  /** Only these customers ask it (left out: anyone). */
  customers?: readonly string[];
  /** The station that gets the request holds this food (left out: the first food ordered). */
  foodId?: string;
  ask: JpLine;
  steps: readonly [StepScript, StepScript];
}

/** Special orders: the customer asks for something off the menu card, and the manager sees to it. */
export const SPECIALS: readonly SpecialScript[] = [
  {
    id: 'no-wasabi',
    status: 'draft',
    ask: { text: 'わさびは いれないで ください。', en: 'No wasabi, please.' },
    steps: [
      { to: 'customer', check: 'ask', model: SURE_WAIT },
      { to: 'kitchen', check: 'kitchen', keys: ['わさび'], model: L('わさびを いれないで もらえますか。', 'Could you leave the wasabi out?', ['te-moraeru']) },
    ],
  },
  {
    id: 'warm-up',
    status: 'draft',
    ask: { text: 'おべんとうを あたためて ください。', en: 'Please warm the bento up.' },
    steps: [
      { to: 'customer', check: 'ask', model: L('はい。こちらで まって いただけますか。', 'Of course. Could you wait here?', ['te-itadakemasu-ka']) },
      { to: 'kitchen', check: 'kitchen', keys: ['あたため'], model: L('おべんとうを あたためて もらえますか。', 'Could you warm the bento up?', ['te-moraeru']) },
    ],
  },
  {
    id: 'big-rice',
    status: 'draft',
    ask: { text: 'ごはんを おおもりに して ください。', en: 'A big helping of rice, please.' },
    steps: [
      { to: 'customer', check: 'ask', model: SURE_WAIT },
      { to: 'kitchen', check: 'kitchen', keys: ['おおもり'], model: L('ごはんを おおもりに して もらえますか。', 'Could you make it a big helping of rice?', ['te-moraeru']) },
    ],
  },
  {
    id: 'chopsticks',
    status: 'draft',
    ask: { text: 'おはしを ふたつ いれて ください。', en: 'Two pairs of chopsticks, please.' },
    steps: [
      { to: 'customer', check: 'ask', model: SURE_WAIT },
      { to: 'kitchen', check: 'kitchen', keys: ['はし'], model: L('おはしを ふたつ いれて もらえますか。', 'Could you put two pairs of chopsticks in?', ['te-moraeru']) },
    ],
  },
  {
    id: 'sauce-apart',
    status: 'draft',
    ask: { text: 'ソースは べつに して ください。', en: 'Sauce on the side, please.' },
    steps: [
      { to: 'customer', check: 'ask', model: SURE_WAIT },
      { to: 'kitchen', check: 'kitchen', keys: ['ソース', 'べつ'], model: L('ソースを べつに して もらえますか。', 'Could you put the sauce on the side?', ['te-moraeru']) },
    ],
  },
  {
    id: 'cute-box',
    status: 'draft',
    customers: ['influencer'],
    ask: { text: 'はこを もっと かわいく して ください！', en: 'Make the box cuter!' },
    steps: [
      { to: 'customer', check: 'ask', model: SURE_WAIT },
      { to: 'kitchen', check: 'kitchen', keys: ['かわいく'], model: L('はこを かわいく して もらえますか。', 'Could you make the box cute?', ['te-moraeru']) },
    ],
  },
  {
    // The one request the shop can't meet: sorry, and a polite ask for something else.
    id: 'dream',
    status: 'draft',
    customers: ['baku'],
    foodId: 'onigiri',
    ask: { text: 'ゆめを ひとつ いれて ください。', en: 'Put a dream in, please.' },
    steps: [
      { to: 'customer', check: 'sorry-ask', model: L('もうしわけ ございません。おにぎりに して いただけますか。', "I'm terribly sorry. Could you make it a rice ball instead?", ['keigo-verb', 'te-itadakemasu-ka']) },
      { to: 'kitchen', check: 'kitchen', keys: ['おにぎり'], model: L('おにぎりを ひとつ つくって もらえますか。', 'Could you make one rice ball?', ['te-moraeru']) },
    ],
  },
];

/** A complaint about a served box: sorry and please wait, then the fix to the station. */
export function complaintSteps(off: { foodId: string; how: 'missing' | 'few' | 'many' | 'extra' }, short: number, own: boolean): [StepScript, StepScript] {
  const f = foodOf(off.foodId)!;
  const fix: StepScript =
    off.how === 'missing' || off.how === 'few'
      ? {
          to: 'kitchen',
          check: 'kitchen',
          keys: [f.kana],
          model: L(`${f.kana}を もう ${countWord(f, Math.max(1, short), own)} つくって もらえますか。`, `Could you make ${Math.max(1, short)} more ${f.en}?`, ['te-moraeru']),
        }
      : { to: 'kitchen', check: 'kitchen', keys: ['つくりなお'], model: L('おべんとうを つくりなおして もらえますか。', 'Could you make the bento again?', ['te-moraeru']) };
  return [{ to: 'customer', check: 'sorry-ask', model: SORRY_WAIT }, fix];
}

/** What a customer says once the manager has sorted it out. */
export const THANKS: JpLine = { text: 'ありがとう。たすかりました。', en: 'Thank you. That helps.' };

export interface GuestAsk {
  id: string;
  status: ReviewStatus;
  customers?: readonly string[];
  /** decline: a house rule, turned down with ＿は ごえんりょ ください. ready: it's been made ready (てある). */
  kind: 'decline' | 'ready';
  ask: JpLine;
  model: HardLine;
  keys?: readonly string[];
}

const SORRY = 'もうしわけ ございません。';
const NO = (thing: string, en: string, ask: JpLine, id: string, keys: readonly string[], customers?: readonly string[]): GuestAsk => ({
  id,
  status: 'draft',
  kind: 'decline',
  ...(customers ? { customers } : {}),
  ask,
  keys,
  model: L(`${SORRY}${thing}は ごえんりょ ください。`, `I'm terribly sorry. Please refrain from ${en}.`, ['keigo-verb']),
});
const READY = (text: string, en: string, ask: JpLine, id: string, customers?: readonly string[]): GuestAsk => ({
  id,
  status: 'draft',
  kind: 'ready',
  ...(customers ? { customers } : {}),
  ask,
  model: L(text, en, ['te-aru']),
});

/** What a guest asks the おもてなし order-taker, after they've been seated. */
export const GUEST_ASKS: readonly GuestAsk[] = [
  NO('おたばこ', 'smoking', { text: 'ここで たばこを すっても いいですか。', en: 'May I smoke here?' }, 'smoking', ['たばこ']),
  READY('はい、おはしは よういして あります。', "Yes, chopsticks are ready for you.", { text: 'おはしは ありますか。', en: 'Are there chopsticks?' }, 'chopsticks'),
  NO('おでんわ', 'phone calls', { text: 'みせの なかで でんわを しても いいですか。', en: 'May I make a phone call in the shop?' }, 'phone', ['でんわ']),
  READY('はい、おしぼりも よういして あります。', 'Yes, a hand towel is ready too.', { text: 'おしぼりは ありますか。', en: 'Is there a hand towel?' }, 'oshibori'),
  NO('ペット', 'pets', { text: 'ペットを いれても いいですか。', en: 'May I bring my pet in?' }, 'pet', ['ペット']),
  READY('はい、おせきを よういして あります。', 'Yes, your seat is ready.', { text: 'よやくした ものですが…', en: 'I have a reservation…' }, 'booking'),
  NO('しゃしん', 'photos', { text: 'ほかの おきゃくさんの しゃしんを とっても いいですか。', en: 'May I take photos of the other customers?' }, 'photos', ['しゃしん'], ['influencer']),
  READY('はい、つめたい おちゃを よういして あります。', 'Yes, cold tea is ready for you.', { text: 'つめたい おちゃは ありますか。', en: 'Is there cold tea?' }, 'cold-tea', ['yukionna']),
  NO('おみせで ねるの', 'sleeping in the shop', { text: 'ここで ねても いいですか。', en: 'May I sleep here?' }, 'sleep', ['ねる'], ['baku', 'kodanuki']),
];

/** The first thing an おもてなし order-taker says: seat the guest, or ask them to wait. */
export const WELCOME: StepScript = {
  to: 'customer',
  check: 'welcome',
  model: L('いらっしゃいませ。どうぞ、おすわりください。', 'Welcome. Please, have a seat.', ['o-kudasai']),
};

// ---- checking a line ----

const APOLOGY = ['もうしわけございません', 'もうしわけありません'];
const ITADAKU = ['ていただけますか', 'でいただけますか', 'ていただけませんか', 'でいただけませんか'];
const MORAU = ['てもらえますか', 'でもらえますか', 'てもらえませんか', 'でもらえませんか'];
const O_KUDASAI = ['おすわりください', 'おまちください', 'おかけください', 'おはいりください'];
const GOENRYO = ['ごえんりょください'];
const TE_ARU = ['よういしてあります'];
const IKEMASEN = ['てはいけません', 'ではいけません', 'てはだめ', 'ちゃだめ', 'だめです'];

// Food written in kanji is spelled out first, as the kitchen's calls are (唐揚げ can come back as とうあげ).
function readingsOf(u: Utterance): string[] {
  let spelled = u.text;
  for (const [id, forms] of Object.entries(KANJI_SPELLINGS)) for (const k of [...forms].sort((a, b) => b.length - a.length)) spelled = spelled.split(k).join(foodOf(id)!.kana);
  return [...new Set([utteranceReading(u), normalizeReading(u.text), normalizeReading(spelled)])].map(soundKey);
}
const has = (rs: readonly string[], chunks: readonly string[]) => rs.some((r) => chunks.some((c) => r.includes(soundKey(c))));

/** Does a hard-role line use its frame (and name what it must)? If not, a private hint for the phone. */
export function checkLine(u: Utterance, step: Pick<StepScript, 'check' | 'keys'>): { ok: boolean; hint: string | null } {
  const rs = readingsOf(u);
  const keyed = !step.keys?.length || has(rs, step.keys);
  const miss = (hint: string) => ({ ok: false, hint });
  switch (step.check) {
    case 'sorry-ask':
    case 'ask': {
      const sorry = step.check === 'ask' || has(rs, APOLOGY);
      if (sorry && has(rs, ITADAKU)) return { ok: true, hint: null };
      if (!sorry) return miss('Start with もうしわけ ございません: the customer isn’t happy.');
      if (has(rs, MORAU)) return miss('To a customer, ask with 〜て いただけますか. 〜て もらえますか is for your own kitchen.');
      return miss('Ask the customer politely: 〜て いただけますか (すこし まって いただけますか).');
    }
    case 'kitchen':
      if (has(rs, MORAU) && keyed) return { ok: true, hint: null };
      if (has(rs, ITADAKU)) return keyed ? { ok: true, hint: null } : miss(`Say what you need: ${step.keys!.join(' / ')}.`);
      if (!keyed) return miss(`Say what you need: ${step.keys!.join(' / ')}, then 〜て もらえますか.`);
      return miss('Ask the kitchen with 〜て もらえますか (〜を つくって もらえますか).');
    case 'welcome':
      if (has(rs, O_KUDASAI)) return { ok: true, hint: null };
      return miss('For a guest, use お〜ください: おすわりください or おまちください.');
    case 'decline':
      if (has(rs, IKEMASEN)) return miss('Staff never tell a guest 〜ては いけません. Say ＿は ごえんりょ ください.');
      if (has(rs, GOENRYO) && keyed) return { ok: true, hint: null };
      if (!keyed) return miss(`Say what you’re turning down (${step.keys!.join(' / ')}) and ＿は ごえんりょ ください.`);
      return miss('Turn it down politely: ＿は ごえんりょ ください.');
    case 'ready':
      if (has(rs, TE_ARU)) return { ok: true, hint: null };
      return miss('It’s already done for them: ＿は よういして あります.');
  }
}

// ---- state ----

export type HardRole = 'manager' | 'omotenashi';

export interface RoleOffer {
  round: number;
  playerId: string;
  role: HardRole;
  /** null: never answered (the ordinary part). */
  answer: 'accepted' | 'declined' | null;
}

export interface LineStep extends StepScript {
  /** What was last heard (the phone shows it), whether it came out right, and the private hint if not. */
  said: string | null;
  ok: boolean;
  tries: number;
  hint: string | null;
  skipped: boolean;
}

export interface Incident {
  id: string;
  kind: 'complaint' | 'special';
  scriptId: string;
  managerId: string;
  visitId: string;
  customerId: string;
  /** What the customer said. */
  line: JpLine;
  steps: LineStep[];
  /** The step the manager is on (2 when both are done or skipped). */
  step: number;
  /** Who gets the kitchen request. */
  stationId: string | null;
  /** A complaint about a missing food: what goes into the box when the station sends it. */
  fix: { foodId: string; n: number } | null;
  /** open: the manager is talking; asked: the request is on the station's phone. */
  state: 'open' | 'asked' | 'resolved' | 'missed';
  at: number;
  until: number;
  endedAt: number | null;
}

export interface Guest {
  visitId: string;
  takerId: string;
  askId: string;
  steps: LineStep[];
  step: number;
}

/** A Co-op shift's hard roles: who took which seat, and what came up. */
export interface HardRound {
  manager: string | null;
  omotenashi: string[];
  incidents: Incident[];
  guests: Guest[];
  arrivals: number;
}

/** The game's hard-role bookkeeping: every offer and its answer (the step's gate is N4 players accepting 60%). */
export interface HardState {
  offers: RoleOffer[];
  specialTurn: number;
  askTurn: number;
}

// ---- tuning ----

/** How long a complaint or special order stays on the manager's desk. */
export const INCIDENT_MS = 30_000;
/** A special order every this many customers while the manager is free. */
export const SPECIAL_EVERY = 2;
export const HARD_BONUS = { spoken: 20, typed: 8 } as const;
/** A finished incident stays on the TV's desk this long. */
export const DESK_LINGER_MS = 3_000;

// ---- who is offered what ----

/**
 * This shift's offers: one manager seat, rotating through the room's N4 players by shift; every other N4
 * player is offered the おもてなし shift. With one N4 player the two alternate (manager in shifts 1 and 3).
 */
export function rolesFor(round: number, players: readonly Pick<ModePlayer, 'id' | 'level'>[]): { playerId: string; role: HardRole }[] {
  const n4 = players.filter((p) => p.level === 'n4');
  if (!n4.length) return [];
  if (n4.length === 1) return [{ playerId: n4[0]!.id, role: round % 2 === 1 ? 'manager' : 'omotenashi' }];
  const m = (round - 1) % n4.length;
  return n4.map((p, i) => ({ playerId: p.id, role: i === m ? 'manager' : 'omotenashi' }));
}

export const blankHardRound = (): HardRound => ({ manager: null, omotenashi: [], incidents: [], guests: [], arrivals: 0 });

/** How the offers went: the gate counts answered offers accepted. */
export function offerStats(offers: readonly RoleOffer[]): { offered: number; accepted: number; declined: number; unanswered: number } {
  return {
    offered: offers.length,
    accepted: offers.filter((o) => o.answer === 'accepted').length,
    declined: offers.filter((o) => o.answer === 'declined').length,
    unanswered: offers.filter((o) => o.answer === null).length,
  };
}

/** A player answers this shift's offer. Accepting seats them at once. */
export function answerOffer(h: HardState, hr: HardRound, round: number, playerId: string, accept: boolean): boolean {
  const o = h.offers.find((x) => x.round === round && x.playerId === playerId);
  if (!o || o.answer !== null) return false;
  o.answer = accept ? 'accepted' : 'declined';
  if (accept) {
    if (o.role === 'manager') hr.manager = playerId;
    else if (!hr.omotenashi.includes(playerId)) hr.omotenashi.push(playerId);
  }
  return true;
}

const lineStep = (s: StepScript): LineStep => ({ ...s, said: null, ok: false, tries: 0, hint: null, skipped: false });
const openIncident = (hr: HardRound) => hr.incidents.find((i) => i.state === 'open' || i.state === 'asked');

// ---- the manager ----

/** After a box is served with something off, the customer complains to the manager (if one is free). */
export function maybeComplaint(hr: HardRound, r: Round, v: Visit, off: readonly { foodId: string; how: 'missing' | 'few' | 'many' | 'extra' }[], ctx: ModeContext): Incident | null {
  if (!hr.manager || openIncident(hr) || !off.length || v.baked) return null;
  // A missing or short food is the one to fix; otherwise the box is made again.
  const first = off.find((o) => o.how === 'missing' || o.how === 'few') ?? off[0]!;
  const want = v.lines.filter((l) => l.foodId === first.foodId).reduce((a, l) => a + l.n, 0);
  const short = Math.max(1, want - (v.box[first.foodId] ?? 0));
  const steps = complaintSteps(first, short, r.index >= 2);
  const fixes = first.how === 'missing' || first.how === 'few';
  const inc: Incident = {
    id: ctx.newId(),
    kind: 'complaint',
    scriptId: `complaint-${fixes ? 'fix' : 'redo'}`,
    managerId: hr.manager,
    visitId: v.id,
    customerId: v.customerId,
    line: v.reaction ?? { text: 'うーん…', en: 'Hmm…' },
    steps: steps.map(lineStep),
    step: 0,
    stationId: r.holders[first.foodId] ?? null,
    fix: fixes ? { foodId: first.foodId, n: short } : null,
    state: 'open',
    at: ctx.now,
    until: ctx.now + INCIDENT_MS,
    endedAt: null,
  };
  hr.incidents.push(inc);
  return inc;
}

/** Every few customers, one makes a special request of the manager (if one is free). */
export function maybeSpecial(h: HardState, hr: HardRound, r: Round, v: Visit, ctx: ModeContext): Incident | null {
  if (!hr.manager) return null;
  hr.arrivals += 1;
  if (openIncident(hr) || hr.arrivals % SPECIAL_EVERY !== 0) return null;
  // A customer's own request first; otherwise the next general one, in turn.
  const own = SPECIALS.find((x) => x.customers?.includes(v.customerId) && (!x.foodId || r.menu.includes(x.foodId)));
  const general = SPECIALS.filter((x) => !x.customers);
  const script = own ?? general[h.specialTurn++ % general.length]!;
  const foodId = script.foodId && r.menu.includes(script.foodId) ? script.foodId : v.lines[0]?.foodId;
  const inc: Incident = {
    id: ctx.newId(),
    kind: 'special',
    scriptId: script.id,
    managerId: hr.manager,
    visitId: v.id,
    customerId: v.customerId,
    line: script.ask,
    steps: script.steps.map(lineStep),
    step: 0,
    stationId: foodId ? (r.holders[foodId] ?? null) : null,
    fix: null,
    state: 'open',
    at: ctx.now,
    until: ctx.now + INCIDENT_MS,
    endedAt: null,
  };
  hr.incidents.push(inc);
  return inc;
}

const outcome = (u: Utterance | null, tries: number): 'said' | 'retry' | 'seen' => (u?.via === 'speech' ? (tries <= 1 ? 'said' : 'retry') : 'seen');

/** Says (or skips) one line of a hard-role script. Returns the points earned, if any. */
function sayStep(step: LineStep, u: Utterance | null, playerId: string, itemId: string, ctx: ModeContext): number {
  if (!u) {
    step.skipped = true;
    step.hint = null;
    ctx.phrase(playerId, { itemId, text: step.model.text, kana: step.model.kana, en: step.model.en, outcome: 'missed' });
    return 0;
  }
  step.tries += 1;
  step.said = u.text.slice(0, 80);
  const res = checkLine(u, step);
  step.ok = res.ok;
  step.hint = res.hint;
  if (!res.ok) return 0;
  ctx.phrase(playerId, { itemId, text: step.model.text, kana: step.model.kana, en: step.model.en, outcome: outcome(u, step.tries) });
  return u.via === 'speech' ? HARD_BONUS.spoken : HARD_BONUS.typed;
}

/** The manager says the current line of an incident (or skips it). */
export function managerSays(hr: HardRound, inc: Incident, playerId: string, u: Utterance | null, players: readonly ModePlayer[], ctx: ModeContext): number {
  const step = inc.steps[inc.step];
  if (!step) return 0;
  const points = sayStep(step, u, playerId, `bento:hard:${inc.scriptId}:${inc.step}`, ctx);
  if (!step.ok && !step.skipped) return points;
  inc.step += 1;
  if (inc.step < inc.steps.length) return points;
  // Both lines done: the request goes to the station, unless the kitchen line was skipped.
  if (step.skipped || !step.ok) {
    inc.state = 'missed';
    inc.endedAt = ctx.now;
  } else {
    inc.state = 'asked';
    if (!inc.stationId || !players.some((p) => p.id === inc.stationId)) inc.stationId = players.find((p) => p.id !== playerId)?.id ?? playerId;
  }
  return points;
}

/** The station did what the manager asked: the customer is looked after. A fix goes into the box, for the TV. */
export function requestDone(inc: Incident, r: Round, ctx: ModeContext): void {
  inc.state = 'resolved';
  inc.endedAt = ctx.now;
  const v = r.visits.find((x) => x.id === inc.visitId);
  if (!v) return;
  if (inc.fix) v.box[inc.fix.foodId] = (v.box[inc.fix.foodId] ?? 0) + inc.fix.n;
}

// ---- おもてなし ----

/** An おもてなし order-taker's guest: a welcome, then the guest's question. */
export function addGuest(h: HardState, hr: HardRound, v: Visit): Guest | null {
  if (!hr.omotenashi.includes(v.takerId)) return null;
  const own = GUEST_ASKS.find((a) => a.customers?.includes(v.customerId));
  const general = GUEST_ASKS.filter((a) => !a.customers);
  const ask = own ?? general[h.askTurn++ % general.length]!;
  const g: Guest = {
    visitId: v.id,
    takerId: v.takerId,
    askId: ask.id,
    steps: [lineStep(WELCOME), lineStep({ to: 'customer', check: ask.kind, model: ask.model, ...(ask.keys ? { keys: ask.keys } : {}) })],
    step: 0,
  };
  hr.guests.push(g);
  return g;
}

export const guestAsk = (g: Guest): GuestAsk => GUEST_ASKS.find((a) => a.id === g.askId)!;

/** The order-taker says (or skips) the guest's next line. */
export function hostSays(g: Guest, playerId: string, u: Utterance | null, ctx: ModeContext): number {
  const step = g.steps[g.step];
  if (!step) return 0;
  const points = sayStep(step, u, playerId, `bento:hard:${g.step === 0 ? 'welcome' : g.askId}`, ctx);
  if (step.ok || step.skipped) g.step += 1;
  return points;
}

/** A guest's stars once they've gone: one for each line said right, one for being served. */
export function guestStars(g: Guest, v: Visit | undefined): number | null {
  if (!v || v.state === 'waiting' || v.state === 'offered') return null;
  return g.steps.filter((s) => s.ok).length + (v.state === 'served' ? 1 : 0);
}

/** The clock: incidents nobody finished leave the desk. */
export function expireIncidents(hr: HardRound, now: number): void {
  for (const inc of hr.incidents)
    if ((inc.state === 'open' || inc.state === 'asked') && inc.until <= now) {
      inc.state = 'missed';
      inc.endedAt = inc.until;
    }
}

/** When the hard-role clock next needs to run: an incident running out, or leaving the TV. */
export function hardWakeTimes(hr: HardRound, now: number): number[] {
  const out: number[] = [];
  for (const inc of hr.incidents) {
    if (inc.state === 'open' || inc.state === 'asked') out.push(inc.until);
    else if (inc.endedAt !== null && inc.endedAt + DESK_LINGER_MS > now) out.push(inc.endedAt + DESK_LINGER_MS);
  }
  return out;
}

/** A player left: their seat empties, and requests on their phone go to someone else. */
export function releaseHard(hr: HardRound, playerId: string, left: readonly ModePlayer[], now: number): void {
  if (hr.manager === playerId) hr.manager = null;
  hr.omotenashi = hr.omotenashi.filter((id) => id !== playerId);
  for (const inc of hr.incidents) {
    if (inc.state === 'open' && inc.managerId === playerId) {
      inc.state = 'missed';
      inc.endedAt = now;
    }
    if (inc.state === 'asked' && inc.stationId === playerId) inc.stationId = left[0]?.id ?? null;
  }
  for (const g of hr.guests) if (g.takerId === playerId) g.step = g.steps.length;
}

// ---- views ----

export interface DeskView {
  id: string;
  kind: Incident['kind'];
  visitId: string;
  customerId: string;
  name: string;
  emoji: string;
  managerId: string;
  /** What the customer said. */
  line: JpLine;
  /** The manager's lines that came out right, in order. Misses and corrections never reach the TV. */
  said: { to: 'customer' | 'kitchen'; text: string }[];
  stationId: string | null;
  state: Incident['state'];
  endedAt: number | null;
  /** When it was taken over, for the TV's slide-in. */
  at: number;
}

export interface StepView {
  to: 'customer' | 'kitchen';
  model: HardLine;
  said: string | null;
  ok: boolean;
  skipped: boolean;
  /** Private: only the speaker's phone gets it. */
  hint: string | null;
}

export interface GuestView {
  ask: JpLine | null;
  kind: GuestAsk['kind'];
  /** The order-taker's lines that came out right. */
  said: string[];
  stars: number | null;
}

export interface HardView {
  manager: string | null;
  omotenashi: string[];
  desk: DeskView[];
  /** By visit id: the guests the おもてなし order-takers are looking after. */
  guests: Record<string, GuestView>;
  /** This shift so far: incidents sorted out of those that came up, and guests' stars of those on offer. */
  handled: { done: number; of: number };
  stars: { got: number; of: number };
}

export interface MyHardView {
  /** This shift's offer, until it's answered. */
  offer: { role: HardRole } | null;
  role: HardRole | null;
  /** The manager's own desk: the current incident with every line and its private hint. */
  desk: (DeskView & { steps: StepView[]; step: number; until: number })[];
  /** Requests from the manager on this station's phone. */
  requests: { incidentId: string; managerId: string; text: string; en: string; foodId: string | null; customer: { name: string; emoji: string } }[];
  /** By visit id: this order-taker's guests, with their lines and hints. */
  guests: Record<string, GuestView & { steps: StepView[]; step: number }>;
}

const stepView = (s: LineStep): StepView => ({ to: s.to, model: s.model, said: s.said, ok: s.ok, skipped: s.skipped, hint: s.hint });

function deskView(inc: Incident): DeskView {
  const c = customerOf(inc.customerId)!;
  return {
    id: inc.id,
    kind: inc.kind,
    visitId: inc.visitId,
    customerId: inc.customerId,
    name: c.name,
    emoji: c.emoji,
    managerId: inc.managerId,
    line: inc.state === 'resolved' ? THANKS : inc.line,
    said: inc.steps.filter((s) => s.ok).map((s) => ({ to: s.to, text: s.model.text })),
    stationId: inc.state === 'asked' || inc.state === 'resolved' ? inc.stationId : null,
    state: inc.state,
    endedAt: inc.endedAt,
    at: inc.at,
  };
}

function guestView(g: Guest, r: Round): GuestView {
  const v = r.visits.find((x) => x.id === g.visitId);
  const a = guestAsk(g);
  return { ask: g.step >= 1 ? a.ask : null, kind: a.kind, said: g.steps.filter((s) => s.ok).map((s) => s.model.text), stars: guestStars(g, v) };
}

const live = (inc: Incident, now: number) => inc.state === 'open' || inc.state === 'asked' || (inc.endedAt !== null && now - inc.endedAt < DESK_LINGER_MS);

export function hardView(hr: HardRound, r: Round, scoring: boolean, now: number): HardView {
  const guests: Record<string, GuestView> = {};
  let got = 0;
  let of = 0;
  for (const g of hr.guests) {
    const gv = guestView(g, r);
    guests[g.visitId] = gv;
    if (gv.stars !== null) {
      got += gv.stars;
      of += 3;
    }
  }
  const ended = hr.incidents.filter((i) => i.state === 'resolved' || i.state === 'missed');
  return {
    manager: hr.manager,
    omotenashi: [...hr.omotenashi],
    desk: scoring ? [] : hr.incidents.filter((i) => live(i, now)).map(deskView),
    guests,
    handled: { done: ended.filter((i) => i.state === 'resolved').length, of: ended.length },
    stars: { got, of },
  };
}

export function myHardView(h: HardState, hr: HardRound | null, round: number, meId: string, r: Round | null): MyHardView | null {
  const offer = h.offers.find((o) => o.round === round && o.playerId === meId);
  const role: HardRole | null = hr?.manager === meId ? 'manager' : hr?.omotenashi.includes(meId) ? 'omotenashi' : null;
  if (offer?.answer !== null && !role && !hr?.incidents.some((i) => i.state === 'asked' && i.stationId === meId)) return null;
  const guests: MyHardView['guests'] = {};
  if (hr && r)
    for (const g of hr.guests)
      if (g.takerId === meId && r.visits.some((v) => v.id === g.visitId && v.state === 'waiting')) guests[g.visitId] = { ...guestView(g, r), steps: g.steps.map(stepView), step: g.step };
  return {
    offer: offer && offer.answer === null ? { role: offer.role } : null,
    role,
    desk: (hr?.incidents ?? []).filter((i) => i.managerId === meId && i.state === 'open').map((i) => ({ ...deskView(i), steps: i.steps.map(stepView), step: i.step, until: i.until })),
    requests: (hr?.incidents ?? [])
      .filter((i) => i.state === 'asked' && i.stationId === meId)
      .map((i) => {
        const c = customerOf(i.customerId)!;
        const k = i.steps[i.steps.length - 1]!;
        return { incidentId: i.id, managerId: i.managerId, text: k.model.text, en: k.model.en, foodId: i.fix?.foodId ?? null, customer: { name: c.name, emoji: c.emoji } };
      }),
    guests,
  };
}
