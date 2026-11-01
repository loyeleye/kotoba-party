// Bento Haus's N4 hard roles: harder scripts inside the same Co-op shift. They appear only when the room
// has an N4 player, and each shift offers them to the room's N4 players in turn (phone: やります, or
// こんかいは いいです for the ordinary part). Nobody else's part or pay changes.
//
//   manager (ふくてんちょう, deputy manager: Pon is busy "tasting")  one seat a shift. A customer who
//              complains about a box, or makes a special request, comes to the deputy manager's
//              phone: say sorry and ask the customer politely
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

import type { Level, ReviewStatus } from '../../../../content/src/types.js';
import { nextOfferee, offerRate, type OfferAnswer, type PastOffer } from '../hardRoleLog.js';
import { normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { armCurveball, commentaryMs, galleryBubbles, galleryTileFor, gistFor, keyHeld, lightUp, openGallery, type Commentary, type Gallery, type GalleryTileView, type ReactionTile } from '../mixedRoom.js';
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
  /** Another accepted form of a line that asks the customer to wait: しょうしょう おまちください (お〜ください). */
  alt?: HardLine;
}

const L =(text: string, en: string, frames: readonly string[]): HardLine => ({ text, kana: text, en, frames });

const SORRY_WAIT = L('もうしわけ ございません。すこし まって いただけますか。', "I'm terribly sorry. Could you wait a moment?", ['keigo', 'te-itadakemasen']);
const SURE_WAIT = L('かしこまりました。すこし まって いただけますか。', 'Certainly. Could you wait a moment?', ['te-itadakemasen']);
/** The other way to ask a customer to wait, accepted at the same steps: お〜ください. */
export const SORRY_OMACHI = L('もうしわけ ございません。しょうしょう おまちください。', "I'm terribly sorry. Please wait a moment.", ['keigo', 'o-kudasai']);
export const SURE_OMACHI = L('かしこまりました。しょうしょう おまちください。', 'Certainly. Please wait a moment.', ['o-kudasai']);
const SURE: StepScript = { to: 'customer', check: 'ask', model: SURE_WAIT, alt: SURE_OMACHI };

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
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['わさび'], model: L('わさびを いれないで もらえますか。', 'Could you leave the wasabi out?', ['te-moraeru']) },
    ],
  },
  {
    id: 'warm-up',
    status: 'draft',
    ask: { text: 'おべんとうを あたためて ください。', en: 'Please warm the bento up.' },
    steps: [
      { to: 'customer', check: 'ask', model: L('かしこまりました。こちらで すこし まって いただけますか。', 'Certainly. Could you wait here a moment?', ['te-itadakemasen']), alt: SURE_OMACHI },
      { to: 'kitchen', check: 'kitchen', keys: ['あたため'], model: L('おべんとうを あたためて もらえますか。', 'Could you warm the bento up?', ['te-moraeru']) },
    ],
  },
  {
    id: 'big-rice',
    status: 'draft',
    ask: { text: 'ごはんを おおもりに して ください。', en: 'A big helping of rice, please.' },
    steps: [
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['おおもり'], model: L('ごはんを おおもりに して もらえますか。', 'Could you make it a big helping of rice?', ['te-moraeru']) },
    ],
  },
  {
    id: 'chopsticks',
    status: 'draft',
    ask: { text: 'おはしを ふたつ いれて ください。', en: 'Two pairs of chopsticks, please.' },
    steps: [
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['はし'], model: L('おはしを ふたつ いれて もらえますか。', 'Could you put two pairs of chopsticks in?', ['te-moraeru']) },
    ],
  },
  {
    id: 'sauce-apart',
    status: 'draft',
    ask: { text: 'ソースは べつに して ください。', en: 'Sauce on the side, please.' },
    steps: [
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['ソース', 'べつ'], model: L('ソースを べつに して もらえますか。', 'Could you put the sauce on the side?', ['te-moraeru']) },
    ],
  },
  {
    id: 'cute-box',
    status: 'draft',
    customers: ['influencer'],
    ask: { text: 'はこを もっと かわいく して ください！', en: 'Make the box cuter!' },
    steps: [
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['かわいく'], model: L('はこを かわいく して もらえますか。', 'Could you make the box cute?', ['te-moraeru']) },
    ],
  },
  {
    id: 'ice',
    status: 'draft',
    customers: ['yukionna'],
    ask: { text: 'こおりを いっぱい いれて ください。', en: 'Lots of ice in it, please.' },
    steps: [
      SURE,
      { to: 'kitchen', check: 'kitchen', keys: ['こおり'], model: L('こおりを いれて もらえますか。', 'Could you put some ice in?', ['te-moraeru']) },
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
      { to: 'customer', check: 'sorry-ask', model: L('もうしわけ ございません。おにぎりに して いただけますか。', "I'm terribly sorry. Could you make it a rice ball instead?", ['keigo', 'te-itadakemasen']) },
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
      : { to: 'kitchen', check: 'kitchen', keys: ['もういちど', 'つくりなお'], model: L('おべんとうを もう いちど つくって もらえますか。', 'Could you make the bento again?', ['te-moraeru']) };
  return [{ to: 'customer', check: 'sorry-ask', model: SORRY_WAIT, alt: SORRY_OMACHI }, fix];
}

/** What a customer says once the manager has sorted it out. */
export const THANKS: JpLine = { text: 'ありがとう。たすかりました。', en: 'Thanks. You saved me.' };

export interface GuestAsk {
  id: string;
  status: ReviewStatus;
  customers?: readonly string[];
  /** decline: a house rule, turned down with ＿は ごえんりょ ください. ready: it's been made ready (てある). */
  kind: 'decline' | 'ready';
  ask: JpLine;
  model: HardLine;
  keys?: readonly string[];
  /** What the guest says once the line has landed: short and plain, for every level (draft, like the rest). */
  reply: JpLine;
}

const SORRY = 'もうしわけ ございません。';
const NO = (thing: string, en: string, ask: JpLine, id: string, keys: readonly string[], reply: JpLine, customers?: readonly string[]): GuestAsk => ({
  id,
  status: 'draft',
  kind: 'decline',
  ...(customers ? { customers } : {}),
  ask,
  keys,
  model: L(`${SORRY}${thing}は ごえんりょ ください。`, `I'm terribly sorry. Please refrain from ${en}.`, ['keigo']),
  reply,
});
const READY = (text: string, en: string, ask: JpLine, id: string, reply: JpLine, customers?: readonly string[]): GuestAsk => ({
  id,
  status: 'draft',
  kind: 'ready',
  ...(customers ? { customers } : {}),
  ask,
  model: L(text, en, ['te-aru']),
  reply,
});

/** What a guest asks the おもてなし order-taker, after they've been seated, and what they say back. */
export const GUEST_ASKS: readonly GuestAsk[] = [
  NO('おたばこ', 'smoking', { text: 'ここで たばこを すっても いいですか。', en: 'May I smoke here?' }, 'smoking', ['たばこ'], { text: 'はい… わたし、ぶちょう なのに…', en: "Yes… and I'm a section chief…" }, ['buchou']),
  READY('はい、おはしは よういして あります。', "Yes, chopsticks are ready for you.", { text: 'おはしは ありますか。', en: 'Are there chopsticks?' }, 'chopsticks', { text: 'よかった！　ありがとう。', en: 'Great! Thanks.' }),
  NO('おでんわ', 'phone calls', { text: 'みせの なかで でんわを しても いいですか。', en: 'May I make a phone call in the shop?' }, 'phone', ['でんわ'], { text: 'すみません。そとで かけます。', en: "Sorry. I'll call outside." }, ['zangyou']),
  READY('はい、おしぼりも よういして あります。', 'Yes, a hand towel is ready too.', { text: 'おしぼりは ありますか。', en: 'Is there a hand towel?' }, 'oshibori', { text: 'わあ、あったかい！　ありがとう ございます。', en: "Ooh, it's warm! Thank you." }),
  NO('ペット', 'pets', { text: 'ペットと いっしょに はいっても いいですか。', en: 'May I come in with my pet?' }, 'pet', ['ペット'], { text: 'わかりました。ポチ、そとで まっててね。', en: 'All right. Pochi, wait outside, OK?' }),
  READY('はい、おせきは よういして あります。', 'Yes, your seat is ready.', { text: 'よやくしたんですが…', en: 'I have a reservation…' }, 'booking', { text: 'わあ、ありがとう ございます！', en: 'Oh, thank you!' }),
  NO('しゃしん', 'photos', { text: 'ほかの おきゃくさんの しゃしんを とっても いいですか。', en: 'May I take photos of the other customers?' }, 'photos', ['しゃしん'], { text: 'えー… じゃあ、じぶんの しゃしんを とります！', en: 'Aww… selfies, then!' }, ['influencer']),
  READY('はい、つめたい おちゃも よういして あります。', 'Yes, cold tea is ready for you too.', { text: 'つめたい おちゃは ありますか。', en: 'Is there cold tea?' }, 'cold-tea', { text: 'わあ、つめたい！　だいすき！', en: 'Ooh, ice cold! I love it!' }, ['yukionna']),
  NO('おみせで ねるの', 'sleeping in the shop', { text: 'ここで ねても いいですか。', en: 'May I sleep here?' }, 'sleep', ['ねる'], { text: 'はーい… ねむいなあ。', en: 'Oka-ay… so sleepy.' }, ['baku', 'kodanuki']),
];

/** The first thing an おもてなし order-taker says: seat the guest, or ask them to wait. */
export const WELCOME: StepScript = {
  to: 'customer',
  check: 'welcome',
  model: L('いらっしゃいませ。どうぞ、おすわりください。', 'Welcome. Please, have a seat.', ['o-kudasai']),
};

// ---- checking a line ----

const APOLOGY = ['もうしわけございません', 'もうしわけありません'];
const ITADAKEMASEN = ['ていただけませんか', 'でいただけませんか'];
const ITADAKU = ['ていただけますか', 'でいただけますか', ...ITADAKEMASEN, 'おまちいただけますか', 'おまちいただけませんか'];
const MORAU = ['てもらえますか', 'でもらえますか', 'てもらえませんか', 'でもらえませんか'];
const O_KUDASAI = ['おすわりください', 'おまちください', 'おかけください', 'おはいりください'];
const OMACHI = ['おまちください'];
const KUREMASEN = ['てくれませんか', 'でくれませんか'];
const KURERU = ['てくれますか', 'でくれますか', ...KUREMASEN];
const GOENRYO = ['ごえんりょください', 'ごえんりょいただけますか', 'ごえんりょいただけませんか', 'ごえんりょねがいます', 'ごえんりょおねがいします'];
const TE_ARU = ['よういしてあります'];
const IKEMASEN = ['てはいけません', 'ではいけません', 'てはだめ', 'ちゃだめ', 'だめです'];

// Food written in kanji is spelled out first, as the kitchen's calls are (唐揚げ can come back as とうあげ).
function readingsOf(u: Utterance): string[] {
  let spelled = u.text;
  for (const [id, forms] of Object.entries(KANJI_SPELLINGS)) for (const k of [...forms].sort((a, b) => b.length - a.length)) spelled = spelled.split(k).join(foodOf(id)!.kana);
  return [...new Set([utteranceReading(u), normalizeReading(u.text), normalizeReading(spelled)])].map(soundKey);
}
const has = (rs: readonly string[], chunks: readonly string[]) => rs.some((r) => chunks.some((c) => r.includes(soundKey(c))));

/**
 * The form a line was accepted in, when it isn't the model's, so only the frames actually used are credited:
 * a kitchen line asked with 〜て くれますか / くれませんか (te-kuremasen) or 〜て いただけますか (te-itadakemasen)
 * instead of 〜て もらえますか, or a customer asked to wait with しょうしょう おまちください (o-kudasai).
 */
export type LineForm = 'kureru' | 'kuremasen' | 'itadaku' | 'itadakemasen' | 'omachi';

export interface LineCheck {
  ok: boolean;
  hint: string | null;
  /** The frames the accepted line used, when not the model's own. */
  frames?: readonly string[];
  form?: LineForm;
}

/**
 * Does a hard-role line use its frame (and name what it must)? If not, a private hint for the phone. A
 * kitchen line asked with 〜て くれませんか instead of 〜て もらえますか is fine too, tagged te-kuremasen. A
 * customer asked to wait with しょうしょう おまちください is fine at the ask step, and at a sorry step that asks
 * them to wait (one with an `alt`), tagged o-kudasai.
 */
export function checkLine(u: Utterance, step: Pick<StepScript, 'check' | 'keys' | 'alt'>): LineCheck {
  const rs = readingsOf(u);
  const keyed = !step.keys?.length || has(rs, step.keys);
  const miss = (hint: string) => ({ ok: false, hint });
  switch (step.check) {
    case 'sorry-ask':
    case 'ask': {
      const sorry = step.check === 'ask' || has(rs, APOLOGY);
      if (sorry && has(rs, ITADAKU)) return { ok: true, hint: null };
      if (sorry && (step.check === 'ask' || step.alt) && has(rs, OMACHI))
        return { ok: true, hint: null, frames: step.alt?.frames ?? (step.check === 'ask' ? SURE_OMACHI.frames : SORRY_OMACHI.frames), form: 'omachi' };
      if (!sorry) return miss('Start with もうしわけ ございません: the customer isn’t happy.');
      if (has(rs, MORAU)) return miss('To a customer, ask with 〜て いただけますか. 〜て もらえますか is for your own kitchen.');
      return miss('Ask the customer politely: 〜て いただけますか (すこし まって いただけますか).');
    }
    case 'kitchen':
      if (has(rs, MORAU) && keyed) return { ok: true, hint: null };
      if (has(rs, KURERU) && keyed) return { ok: true, hint: null, frames: ['te-kuremasen'], form: has(rs, KUREMASEN) ? 'kuremasen' : 'kureru' };
      if (has(rs, ITADAKU))
        return keyed ? { ok: true, hint: null, frames: ['te-itadakemasen'], form: has(rs, ITADAKEMASEN) ? 'itadakemasen' : 'itadaku' } : miss(`Say what you need: ${step.keys!.join(' / ')}.`);
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

const ENDING: Record<Exclude<LineForm, 'omachi'>, string> = { kureru: 'くれますか', kuremasen: 'くれませんか', itadaku: 'いただけますか', itadakemasen: 'いただけませんか' };

/**
 * The line a step is credited with in the phrasebook, shown on the TV and voiced in the booth: the model line in
 * the form it was accepted in, so the frames credited are the ones used. Always a fixed line, never the player's words.
 */
export function creditedLine(step: Pick<StepScript, 'check' | 'model' | 'alt'>, form: LineForm | undefined, frames?: readonly string[]): HardLine {
  if (!form) return step.model;
  if (form === 'omachi') return step.alt ?? (step.check === 'ask' ? SURE_OMACHI : SORRY_OMACHI);
  const text = step.model.text.replace('もらえますか', ENDING[form]);
  return { ...step.model, text, kana: text, frames: frames ?? step.model.frames };
}

// ---- state ----

export type HardRole = 'manager' | 'omotenashi';

export interface RoleOffer {
  round: number;
  playerId: string;
  role: HardRole;
  /** null: still open. At shift end an open offer is 'timeout'; a player who left with it open, 'away'. */
  answer: OfferAnswer | null;
}

export interface LineStep extends StepScript {
  /** What was last heard (the phone shows it), whether it came out right, and the private hint if not. */
  said: string | null;
  ok: boolean;
  tries: number;
  hint: string | null;
  skipped: boolean;
  /** The frames the accepted line used, when not the model's own (〜て くれませんか to the kitchen). */
  heardFrames?: readonly string[];
  /** The fixed line it was credited as, when accepted in another form than the model's (creditedLine). */
  credit?: HardLine;
  /** The model line was opened on the phone before the first try: the phrasebook logs it as seen. */
  peeked?: boolean;
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
  /** A complaint: the tips the box lost against a perfect one. Half of them (rounded up) come back if the fix lands. */
  lost?: number;
  /** The tips won back when the fix landed. */
  won?: number;
  /** This manager's first incident of the game: the phone opens "Need the words?" by itself. */
  firstHelp?: boolean;
}

export interface Guest {
  visitId: string;
  takerId: string;
  askId: string;
  steps: LineStep[];
  step: number;
}

/** The commentary booth's instant replay of the deputy manager's line (mixedRoom.ts), from `at`. */
export type Booth = Commentary & { at: number };

/** A Co-op shift's hard roles: who took which seat, and what came up. */
export interface HardRound {
  manager: string | null;
  omotenashi: string[];
  incidents: Incident[];
  guests: Guest[];
  arrivals: number;
  /** Once a shift, when the deputy manager's first line to a customer lands: the replay on the TV… */
  booth?: Booth | null;
  /** …and a Gallery tile on every other phone, open until `until`. */
  gallery?: { g: Gallery; at: number; until: number } | null;
}

/** The game's hard-role bookkeeping: every offer and its answer (the step's gate is N4 players accepting 60%). */
export interface HardState {
  offers: RoleOffer[];
  specialTurn: number;
  askTurn: number;
  /** The Gallery's curveball, once a game. */
  curveballUsed?: boolean;
  /** Deputy managers who have had their first incident ("Need the words?" opens by itself on that one). */
  helped?: string[];
}

// ---- tuning ----

/** How long a complaint or special order stays on the manager's desk. */
export const INCIDENT_MS = 30_000;
/** A special order every this many customers while the manager is free. */
export const SPECIAL_EVERY = 3;
export const HARD_BONUS = { spoken: 20, typed: 8 } as const;
/** A finished incident stays on the TV's desk this long. */
export const DESK_LINGER_MS = 3_000;
/** How long the Gallery's tiles stay on the phones after the deputy manager's line lands. */
export const GALLERY_MS = 12_000;

// ---- who is offered what ----

/** The deputy manager seat's offers so far, in the shared offer log's shape (hardRoleLog.ts). */
const seatLog = (offers: readonly RoleOffer[]): PastOffer[] => offers.filter((o) => o.role === 'manager').map((o) => ({ playerId: o.playerId, at: o.round, answer: o.answer }));

/**
 * This shift's offers: one deputy manager seat, for the N4 player nextOfferee picks (fewest offers of the seat,
 * then longest ago; a player who declined it last shift sits this one out; in a room of 4 or more, not the same
 * player two shifts running). Every other N4 player is offered the おもてなし shift.
 */
export function rolesFor(
  round: number,
  players: readonly Pick<ModePlayer, 'id' | 'level'>[],
  offers: readonly RoleOffer[] = [],
  roomSize = players.length,
): { playerId: string; role: HardRole }[] {
  const n4 = players.filter((p) => p.level === 'n4').map((p) => p.id);
  if (!n4.length) return [];
  const seat = nextOfferee(n4, seatLog(offers), round, roomSize);
  return n4.map((id) => ({ playerId: id, role: id === seat ? 'manager' : 'omotenashi' }));
}

export const blankHardRound = (): HardRound => ({ manager: null, omotenashi: [], incidents: [], guests: [], arrivals: 0 });

/** How the offers went. The gate is rate: accepted ÷ (accepted + declined + timeout); away and open offers are left out. */
export function offerStats(offers: readonly RoleOffer[]): { offered: number; accepted: number; declined: number; timeout: number; away: number; rate: number | null } {
  const count = (a: OfferAnswer) => offers.filter((o) => o.answer === a).length;
  return {
    offered: offers.length,
    accepted: count('accepted'),
    declined: count('declined'),
    timeout: count('timeout'),
    away: count('away'),
    rate: offerRate(offers.flatMap((o) => (o.answer ? [o.answer] : []))),
  };
}

/** The shift is over: an offer nobody answered timed out. */
export function closeOffers(h: HardState, round: number): void {
  for (const o of h.offers) if (o.round === round && o.answer === null) o.answer = 'timeout';
}

/** A player left with this shift's offer still open: it's left out of the rate. */
export function offerAway(h: HardState, round: number, playerId: string): void {
  for (const o of h.offers) if (o.round === round && o.playerId === playerId && o.answer === null) o.answer = 'away';
}

/** A player's offer this shift: the open one if there is one, else the last one they answered. */
function offerOf(h: HardState, round: number, playerId: string): RoleOffer | undefined {
  const mine = h.offers.filter((x) => x.round === round && x.playerId === playerId);
  return mine.find((x) => x.answer === null) ?? mine[mine.length - 1];
}

/**
 * A player answers this shift's offer. Accepting seats them at once. A declined deputy manager seat passes
 * to the next N4 player (passSeat).
 */
export function answerOffer(
  h: HardState,
  hr: HardRound,
  round: number,
  playerId: string,
  accept: boolean,
  players: readonly Pick<ModePlayer, 'id' | 'level'>[] = [],
  roomSize = players.length,
): boolean {
  const o = offerOf(h, round, playerId);
  if (!o || o.answer !== null) return false;
  o.answer = accept ? 'accepted' : 'declined';
  if (accept) {
    if (o.role === 'manager') hr.manager = playerId;
    else if (!hr.omotenashi.includes(playerId)) hr.omotenashi.push(playerId);
  } else if (o.role === 'manager') passSeat(h, hr, round, players, roomSize);
  return true;
}

/**
 * A declined deputy manager seat passes on for the shift (Ladi, 2026-11-01): a new logged offer to the N4
 * player nextOfferee picks among those not yet offered the seat this shift and not already on the おもてなし
 * shift. Their still-open おもてなし offer is withdrawn (never answered, so never counted): one choice on the
 * phone at a time. Once nobody is left to ask, the seat stays empty.
 */
export function passSeat(h: HardState, hr: HardRound, round: number, players: readonly Pick<ModePlayer, 'id' | 'level'>[], roomSize = players.length): RoleOffer | null {
  if (hr.manager) return null;
  const hadSeat = (id: string) => h.offers.some((o) => o.round === round && o.playerId === id && o.role === 'manager');
  const free = players.filter((p) => p.level === 'n4' && !hadSeat(p.id) && !hr.omotenashi.includes(p.id)).map((p) => p.id);
  const next = nextOfferee(free, seatLog(h.offers), round, roomSize);
  if (!next) return null;
  h.offers = h.offers.filter((o) => !(o.round === round && o.playerId === next && o.answer === null));
  const offer: RoleOffer = { round, playerId: next, role: 'manager', answer: null };
  h.offers.push(offer);
  return offer;
}

const lineStep = (s: StepScript): LineStep => ({ ...s, said: null, ok: false, tries: 0, hint: null, skipped: false });
const openIncident = (hr: HardRound) => hr.incidents.find((i) => i.state === 'open' || i.state === 'asked');

// ---- the manager ----

/** The manager's first incident of the game opens "Need the words?" by itself on their phone. */
function firstHelp(h: HardState, managerId: string): { firstHelp?: true } {
  const helped = (h.helped ??= []);
  if (helped.includes(managerId)) return {};
  helped.push(managerId);
  return { firstHelp: true };
}

/**
 * After a box is served with something off, the customer complains to the manager (if one is free). `lost`:
 * the tips the box lost against a perfect one (half of them, rounded up, come back if the fix lands).
 */
export function maybeComplaint(
  h: HardState,
  hr: HardRound,
  r: Round,
  v: Visit,
  off: readonly { foodId: string; how: 'missing' | 'few' | 'many' | 'extra' }[],
  lost: number,
  ctx: ModeContext,
): Incident | null {
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
    lost: Math.max(0, lost),
    ...firstHelp(h, hr.manager),
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
    ...firstHelp(h, hr.manager),
  };
  hr.incidents.push(inc);
  return inc;
}

// A line read off the phone's "Need the words?" before the first try counts as seen, not said.
const outcome = (u: Utterance | null, tries: number, peeked: boolean): 'said' | 'retry' | 'seen' =>
  u?.via === 'speech' && !peeked ? (tries <= 1 ? 'said' : 'retry') : 'seen';

/** Says (or skips) one line of a hard-role script. Returns the points earned, if any. */
function sayStep(step: LineStep, u: Utterance | null, playerId: string, itemId: string, ctx: ModeContext, peeked = false): number {
  if (!u) {
    step.skipped = true;
    step.hint = null;
    ctx.phrase(playerId, { itemId, text: step.model.text, kana: step.model.kana, en: step.model.en, outcome: 'missed' });
    return 0;
  }
  if (peeked && step.tries === 0) step.peeked = true;
  step.tries += 1;
  step.said = u.text.slice(0, 80);
  const res = checkLine(u, step);
  step.ok = res.ok;
  step.hint = res.hint;
  if (!res.ok) return 0;
  if (res.frames) step.heardFrames = res.frames;
  // Credit only the frames used: a line accepted in another form goes in the phrasebook in that form.
  const line = creditedLine(step, res.form, res.frames);
  if (res.form) step.credit = line;
  const id = res.form ? `${itemId}:${res.form}` : itemId;
  ctx.phrase(playerId, { itemId: id, text: line.text, kana: line.kana, en: line.en, outcome: outcome(u, step.tries, !!step.peeked), recall: step.peeked ? 'read' : 'memory' });
  return u.via === 'speech' ? HARD_BONUS.spoken : HARD_BONUS.typed;
}

/** The manager says the current line of an incident (or skips it). */
export function managerSays(hr: HardRound, inc: Incident, playerId: string, u: Utterance | null, players: readonly ModePlayer[], ctx: ModeContext, peeked = false): number {
  const step = inc.steps[inc.step];
  if (!step) return 0;
  const points = sayStep(step, u, playerId, `bento:hard:${inc.scriptId}:${inc.step}`, ctx, peeked);
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

/** A fix that lands wins back half the tips the box lost, rounded up (Ladi's later list, 2026-11-01). */
export const winBack = (lost: number): number => Math.ceil(Math.max(0, lost) / 2);

/**
 * The station did what the manager asked: the customer is looked after. A fix goes into the box, for the TV,
 * and a complaint's fix wins back half the tips the box lost (rounded up), for the whole team. Returns them.
 */
export function requestDone(inc: Incident, r: Round, ctx: ModeContext): number {
  inc.state = 'resolved';
  inc.endedAt = ctx.now;
  const v = r.visits.find((x) => x.id === inc.visitId);
  if (!v) return 0;
  if (inc.fix) v.box[inc.fix.foodId] = (v.box[inc.fix.foodId] ?? 0) + inc.fix.n;
  const back = inc.kind === 'complaint' ? winBack(inc.lost ?? 0) : 0;
  if (back) {
    inc.won = back;
    v.tips += back;
    r.tips += back;
  }
  return back;
}

/** The line a step was credited as (the model, or the form it was accepted in). */
export const lineOf = (s: LineStep): HardLine => s.credit ?? s.model;

const BOOTH_KEYS = ['いただけますか', 'いただけませんか', 'おまちください'];
/** Curveball distractors: other request endings the shop hears all night. */
const CURVE_POOL = ['もらえますか', 'くれませんか', 'おねがいします', 'あります', 'ください'];

/** The booth's colour line, one per kind of incident: about the play, never a slip. */
function boothNote(inc: Incident, line: HardLine): string {
  if (inc.scriptId === 'dream') return 'No dreams on the menu. Sorry first, then a polite ask for a rice ball. The baku can dream about it.';
  if (line.frames?.includes('o-kudasai')) return 'しょうしょう おまちください: the shop’s own polite “one moment, please”.';
  if (inc.kind === 'complaint') return 'Sorry first, then a polite いただけますか. Customer kept, tips back, and Pon is still taste-testing.';
  return 'かしこまりました, then a polite いただけますか. Pon is impressed, and a little worried for his job.';
}

/** The gist for Kana and N5 phones (draft, like the rest of the hard roles' Japanese). */
function boothGist(inc: Incident): Commentary['gist'] {
  if (inc.scriptId === 'dream') return { kana: 'ごめんなさい。おにぎりで いいですか。', en: '“Sorry! Would a rice ball do?”', emoji: '🍙' };
  if (inc.kind === 'complaint') return { kana: 'ごめんなさい。ちょっと まって ください。', en: '“So sorry! Please wait a moment.”', emoji: '🙇' };
  return { kana: 'はい、わかりました。ちょっと まって ください。', en: '“Certainly! Please wait a moment.”', emoji: '📋' };
}

/**
 * The deputy manager's first line to a customer this shift has landed: the commentary booth's instant replay
 * (the fixed line it was credited as, voiced by Pon; never the player's own words) and a Gallery tile for every
 * other connected phone. Once a shift; returns the booth, or null if this shift has had one.
 */
export function landed(h: HardState, hr: HardRound, inc: Incident, players: readonly ModePlayer[], ctx: ModeContext): Booth | null {
  if (hr.booth) return null;
  const step = inc.steps[0];
  if (!step?.ok) return null;
  const line = lineOf(step);
  const lit = lightUp(line.text, BOOTH_KEYS);
  const booth: Booth = {
    playerId: inc.managerId,
    line: { text: line.text, kana: line.kana, en: line.en },
    voiced: true,
    lit,
    note: boothNote(inc, line),
    gist: boothGist(inc),
    ms: commentaryMs(line),
    at: ctx.now,
  };
  hr.booth = booth;
  const others = players.filter((p) => p.connected && p.id !== inc.managerId);
  if (others.length) {
    const low = others.filter((p) => p.level === 'kana' || p.level === 'n5').map((p) => p.id);
    const seed = Math.floor(ctx.random() * 1000);
    // The tiles open with the booth; the curveball is dealt once the line has landed (it just has).
    const g = openGallery(others.map((p) => p.id), low, null, !!h.curveballUsed, seed);
    if (armCurveball(g, low, lit.key ? { word: lit.key, pool: CURVE_POOL, heard: line.kana } : null, !!h.curveballUsed, seed)) h.curveballUsed = true;
    hr.gallery = { g, at: ctx.now, until: ctx.now + GALLERY_MS };
  }
  return booth;
}

/**
 * The host stand-in (mixedRoom.ts hostStandsIn: 1–2 players, nobody at N4): Pon plays the deputy manager for one
 * line, a special order's polite ask, on the first shift's title card from `at`. Nobody says anything; no points.
 */
export function standInBooth(at: number): Booth & { ask: JpLine } {
  const warm = SPECIALS.find((x) => x.id === 'warm-up')!;
  const line = warm.steps[0].model;
  return {
    playerId: null,
    ask: warm.ask,
    line: { text: line.text, kana: line.kana, en: line.en },
    voiced: true,
    lit: lightUp(line.text, BOOTH_KEYS),
    note: 'Pon plays the deputy manager tonight (ドロン！): かしこまりました, then a polite いただけますか.',
    gist: { kana: 'はい、わかりました。ここで ちょっと まって ください。', en: '“Certainly! Please wait here a moment.”', emoji: '📋' },
    ms: commentaryMs(line),
    at,
  };
}

/** The booth's replay is on the TV until its few seconds are up. */
export const boothLive = (hr: HardRound, now: number): Booth | null => (hr.booth && now < hr.booth.at + hr.booth.ms ? hr.booth : null);
export const galleryOpen = (hr: HardRound, now: number): Gallery | null => (hr.gallery && now < hr.gallery.until ? hr.gallery.g : null);

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
export function hostSays(g: Guest, playerId: string, u: Utterance | null, ctx: ModeContext, peeked = false): number {
  const step = g.steps[g.step];
  if (!step) return 0;
  const points = sayStep(step, u, playerId, `bento:hard:${g.step === 0 ? 'welcome' : g.askId}`, ctx, peeked);
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
  // The booth's replay and the Gallery's tiles leave on time.
  if (hr.booth && hr.booth.at + hr.booth.ms > now) out.push(hr.booth.at + hr.booth.ms);
  if (hr.gallery && hr.gallery.until > now) out.push(hr.gallery.until);
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
  /** A complaint's fix that landed: the tips it won back. */
  won: number;
}

export interface StepView {
  to: 'customer' | 'kitchen';
  /** Which frame the line needs: the phone's input shows its cue. */
  check: CheckKind;
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
  /** The guest's reply, once the answer to their question has landed. */
  reply: JpLine | null;
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
  /** The commentary booth's instant replay of the deputy manager's line, while it runs. */
  booth: { playerId: string | null; lit: Commentary['lit']; note: string; holdKey: boolean } | null;
  /** The Gallery's reactions so far, while its tiles are out. */
  gallery: ReactionTile[];
}

export interface MyHardView {
  /** This shift's offer, until it's answered. */
  offer: { role: HardRole } | null;
  role: HardRole | null;
  /** The manager's own desk: the current incident with every line and its private hint. */
  desk: (DeskView & { steps: StepView[]; step: number; until: number; firstHelp: boolean })[];
  /** Requests from the manager on this station's phone. */
  requests: { incidentId: string; managerId: string; text: string; en: string; foodId: string | null; customer: { name: string; emoji: string } }[];
  /** By visit id: this order-taker's guests, with their lines and hints. */
  guests: Record<string, GuestView & { steps: StepView[]; step: number }>;
  /** Everyone but the deputy manager, once a shift: a Gallery tile (or the once-a-game curveball). */
  gallery: GalleryTileView | null;
  /** Kana and N5 phones, while the booth's replay runs: what the deputy manager said, at my level. */
  booth: (Commentary['gist'] & { romaji: string | null }) | null;
}

const stepView = (s: LineStep): StepView => ({ to: s.to, check: s.check, model: s.model, said: s.said, ok: s.ok, skipped: s.skipped, hint: s.hint });

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
    said: inc.steps.filter((s) => s.ok).map((s) => ({ to: s.to, text: lineOf(s).text })),
    stationId: inc.state === 'asked' || inc.state === 'resolved' ? inc.stationId : null,
    state: inc.state,
    endedAt: inc.endedAt,
    at: inc.at,
    won: inc.won ?? 0,
  };
}

function guestView(g: Guest, r: Round): GuestView {
  const v = r.visits.find((x) => x.id === g.visitId);
  const a = guestAsk(g);
  return {
    ask: g.step >= 1 ? a.ask : null,
    kind: a.kind,
    said: g.steps.filter((s) => s.ok).map((s) => lineOf(s).text),
    stars: guestStars(g, v),
    reply: g.steps[1]?.ok ? a.reply : null,
  };
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
    booth: (() => {
      const b = scoring ? null : boothLive(hr, now);
      return b ? { playerId: b.playerId, lit: b.lit, note: b.note, holdKey: keyHeld(galleryOpen(hr, now)) } : null;
    })(),
    gallery: (() => {
      const g = scoring ? null : galleryOpen(hr, now);
      return g ? galleryBubbles(g) : [];
    })(),
  };
}

export function myHardView(h: HardState, hr: HardRound | null, round: number, me: { id: string; level: Level }, r: Round | null, now: number): MyHardView | null {
  const meId = me.id;
  const offer = offerOf(h, round, meId);
  const role: HardRole | null = hr?.manager === meId ? 'manager' : hr?.omotenashi.includes(meId) ? 'omotenashi' : null;
  const booth = hr ? boothLive(hr, now) : null;
  const gallery = hr ? galleryTileFor(galleryOpen(hr, now), meId, me.level) : null;
  const gist = booth && booth.playerId !== meId ? gistFor(booth, me.level) : null;
  if (offer?.answer !== null && !role && !gallery && !gist && !hr?.incidents.some((i) => i.state === 'asked' && i.stationId === meId)) return null;
  const guests: MyHardView['guests'] = {};
  if (hr && r)
    for (const g of hr.guests)
      if (g.takerId === meId && r.visits.some((v) => v.id === g.visitId && v.state === 'waiting')) guests[g.visitId] = { ...guestView(g, r), steps: g.steps.map(stepView), step: g.step };
  return {
    offer: offer && offer.answer === null ? { role: offer.role } : null,
    role,
    desk: (hr?.incidents ?? [])
      .filter((i) => i.managerId === meId && i.state === 'open')
      .map((i) => ({ ...deskView(i), steps: i.steps.map(stepView), step: i.step, until: i.until, firstHelp: !!i.firstHelp })),
    requests: (hr?.incidents ?? [])
      .filter((i) => i.state === 'asked' && i.stationId === meId)
      .map((i) => {
        const c = customerOf(i.customerId)!;
        const k = i.steps[i.steps.length - 1]!;
        const said = lineOf(k);
        return { incidentId: i.id, managerId: i.managerId, text: said.text, en: said.en, foodId: i.fix?.foodId ?? null, customer: { name: c.name, emoji: c.emoji } };
      }),
    guests,
    gallery,
    booth: gist,
  };
}
