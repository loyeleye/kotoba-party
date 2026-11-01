// Murder at the Onsen (backlog): interrogate the suspects in simple Japanese, then name the
// culprit. Host: Chōchin-san, off duty at the inn. See docs/modes/onsen-murder.md.
//
// Phases:
//   intro    the case file: the victim, where it happened, the suspects, the evidence
//   answer   one player's turn: pick a suspect and ask a question (say it, type it, or build
//            it from tiles); a question the matcher can't place gets one retry with a hint
//   reveal   the suspect answers (scripted; the stage holds it back for a beat, then the
//            English); a new clue goes in the shared notebook
//   …        answer → reveal for every turn (players take turns by seat)
//   encore   the accusation: everyone picks a suspect and says 「はんにんは ○○さんです！」
//   finale   the culprit is revealed and confesses; the votes and the key clues
//
// The suspects' answers are all hand-written (content/src/onsen). With an LLM configured, the
// server may add a short in-character lead-in to an answer (server/src/onsen.ts): it arrives
// as a { kind: 'suspect-line' } move during the answer's opening beat or not at all, and it is
// checked here so it can never add a fact (no names, no numbers, no はんにん).
//
// The deputy (N4 hard role): when the room has an N4 player, each turn one of them (not the
// asker, in seat rotation) is offered the deputy's part. After the answer they tell the room
// what the suspect said, in reported speech or the passive, from the answer's scripted `report`
// (deputy.ts). They can say no ("not this time") and just watch, as everyone else does.

import type { JpText, OnsenCase, OnsenIntent, OnsenReport, OnsenSuspect } from '../../../../content/src/types.js';
import { hasKanji, isKana, isUtterance, soundKey, type Utterance } from '../../japanese/kana.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, pick, type Award, type Mode, type ModeContext, type ModePlayer, type PhraseEntry } from '../mode.js';
import { checkReport, joinReport, reportFrame, reportTiles, tilesInOrder, type ReportTile } from './deputy.js';
import { offerRate, type OfferAnswer } from '../hardRoleLog.js';
import { FALLBACK_CASE } from './fallback.js';
import { accusationLine, bareName, checkAccusation, INTENTS, matchQuestion, questionFor, tilesFor, type QuestionTile } from './questions.js';

// ---- tuning ----

export const POINTS = {
  /** A question the matcher understood (not a repeat, not a best guess). */
  question: 20,
  /** A question that put a new clue in the notebook. */
  clue: 100,
  /** Naming the culprit. */
  accuse: 300,
  /** Speaking bonus for a question asked aloud. */
  spokenQuestion: 40,
  /** Speaking bonus for saying the whole accusation aloud. */
  spokenAccuse: 60,
  /** The deputy's report, said or typed. */
  report: 30,
  /** The deputy's report, built from the tiles. */
  reportTiles: 10,
  /** Speaking bonus for the deputy's report said aloud. */
  spokenReport: 40,
} as const;

/**
 * Speaking bonuses go into a pool that pays out at most 3/7 of a player's other points, so the
 * bonus is never more than 30% of their score (the design doc's cap). The pool fills as points come in.
 */
export const BONUS_CAP = 3 / 7;
/** Tries at asking a question the matcher can place, and at saying the accusation. */
export const TRIES = 2;
/** Total turns: players × questions each, at least MIN so a small table has enough to go on. */
export const TURNS = { min: 6, max: 14 } as const;
/**
 * The suspect "thinks" for this long before the answer shows on the stage. The server's LLM
 * lead-in is only accepted inside this window, so the text never changes once it is visible.
 */
export const THINK_MS = 1_800;
/** The English subtitle follows the Japanese after this long. */
export const SUBTITLE_MS = 2_500;
/**
 * Chōchin-san voices an accepted report on the TV as one short beat: no sooner than `after` into the
 * answer (the suspect's own line has been said by then, and the report box only opens at think +
 * subtitle), and the answer stays up `beat` longer so the line isn't cut off by the next turn.
 */
export const REPORT_VOICE = { after: THINK_MS + SUBTITLE_MS + 1_500, beat: 5_000 } as const;

export const DURATIONS = {
  intro: 25_000,
  turn: 40_000,
  turnKana: 50_000,
  answer: 10_000,
  answerClue: 12_000,
  accuse: 50_000,
  confession: 30_000,
  /** Extra answer time when a deputy has a report to give. */
  deputy: 15_000,
} as const;

// ---- state ----

export type Via = Utterance['via'];

export interface Ask {
  no: number;
  playerId: string;
  suspectId: string;
  intent: OnsenIntent;
  /** What the phone sent (untrusted player text). */
  heard: string;
  via: Via;
  /** 1, or 2 if the first try wasn't understood. */
  tries: number;
  /** Not understood twice: the suspect answered the closest question. */
  guessed: boolean;
  /** This suspect had already answered this question. */
  repeat: boolean;
  answer: JpText;
  /** The LLM's in-character lead-in, if one arrived in time. */
  lead: JpText | null;
  clueId: string | null;
  newClue: boolean;
  points: number;
  /** The scripted report the deputy can give of this answer (null for a shrug or a case without reports). */
  report: OnsenReport | null;
}

export type DeputyStatus = 'offered' | 'ready' | 'declined' | 'reported' | 'missed';

/** This turn's deputy (N4 hard role). */
export interface Deputy {
  turnNo: number;
  playerId: string;
  status: DeputyStatus;
  /** The answer being reported, set when it comes in with a report. */
  askNo: number | null;
  tiles: ReportTile[];
  tries: number;
  heard: string;
  via: Via | null;
  points: number;
  /** Once the report is in, when Chōchin-san finishes voicing it: the answer stays up until then. */
  voicedUntil: number | null;
}

interface Turn {
  no: number;
  playerId: string | null;
  tries: number;
  asked: boolean;
  /** The last try nobody could place. */
  miss: { heard: string; suspectId: string; closest: OnsenIntent | null } | null;
}

interface Accusation {
  suspectId: string;
  /** Said the whole sentence (spoken or typed). */
  said: boolean;
  via: Via;
  order: number;
}

export interface Tally {
  clues: number;
  questions: number;
  spoken: number;
  /** Points other than the speaking bonus. */
  base: number;
  bonusEarned: number;
  bonusPaid: number;
  correct: boolean;
  /** Reports given as the deputy. */
  reports: number;
}

export interface OnsenState {
  case: OnsenCase;
  fallback: boolean;
  totalTurns: number;
  turnNo: number;
  turn: Turn | null;
  lastSeat: number;
  asks: Ask[];
  /** clueId → who found it, with which question. */
  found: Record<string, { by: string; askNo: number }>;
  accusations: Record<string, Accusation>;
  accuseTries: Record<string, { tries: number; heard: string; suspectId: string }>;
  /** The LLM lead-in window for the latest answer. The key never leaves the state. */
  line: { key: string; askNo: number; lockAt: number } | null;
  firstCorrect: string | null;
  tally: Record<string, Tally>;
  finished: boolean;
  /** When the current answer phase (reveal) began. */
  revealAt: number;
  deputy: Deputy | null;
  /** The last deputy's seat, for the rotation. */
  deputySeat: number;
  /** Every deputy offer and what came of it (an offer whose answer had nothing to report isn't counted). */
  deputyLog: { turnNo: number; playerId: string; outcome: OfferAnswer }[];
}

export type OnsenMove =
  | { kind: 'ask'; suspectId: string; utterance: Utterance }
  | { kind: 'accuse'; suspectId: string; utterance?: Utterance }
  | { kind: 'suspect-line'; key: string; lead: JpText }
  | { kind: 'deputy'; accept: boolean }
  | { kind: 'report'; utterance: Utterance }
  | { kind: 'report'; tiles: string[] };

// ---- view ----

export interface SuspectView {
  id: string;
  name: JpText;
  suffix?: string;
  role: JpText;
  emoji: string;
  voice: { pitch: number; rate: number };
  /** Questions this suspect has answered. */
  asked: OnsenIntent[];
}

export interface CurrentView {
  no: number;
  playerId: string;
  suspectId: string;
  heard: string;
  via: Via;
  intent: OnsenIntent;
  /** The natural version of the question. */
  natural: JpText;
  /** What the suspect says (lead-in + scripted answer). */
  answer: JpText;
  clue: JpText | null;
  newClue: boolean;
  points: number;
  guessed: boolean;
  repeat: boolean;
}

export interface NotebookEntry {
  id: string;
  jp: JpText;
  by: string;
  suspectId: string;
  /** Part of the solution; only shown at the reveal. */
  key?: boolean;
}

export interface OnsenResult {
  culpritId: string;
  confession: JpText[];
  solution: string;
  votes: { playerId: string; suspectId: string; said: boolean; correct: boolean }[];
  /** Key clues nobody found. */
  missed: JpText[];
}

export interface OnsenView {
  mode: 'onsen-murder';
  caseFile: { id: string; title: JpText; setting: JpText; victim: OnsenCase['victim']; item: { name: JpText; emoji: string } };
  suspects: SuspectView[];
  turn: { no: number; total: number; playerId: string | null; tries: number; miss: { suspectId: string; heard: string } | null } | null;
  current: CurrentView | null;
  notebook: NotebookEntry[];
  /** Who has asked what so far, oldest first. */
  log: { no: number; playerId: string; suspectId: string; intent: OnsenIntent; newClue: boolean }[];
  /** Players who have locked in an accusation (not whom). */
  accused: string[];
  result: OnsenResult | null;
  tally: ({ playerId: string } & Pick<Tally, 'clues' | 'questions' | 'spoken' | 'correct'>)[];
  fallback: boolean;
  thinkMs: number;
  subtitleMs: number;
  /** This turn's deputy; their line once they have reported. */
  deputy: { playerId: string; status: DeputyStatus; reporting: boolean; line: JpText | null; via: Via | null; points: number } | null;
  mine: OnsenMe | null;
}

export interface OnsenMe {
  isTurn: boolean;
  triesLeft: number;
  /** After a try nobody could place: what was heard, and the closest question's natural version. */
  miss: { heard: string; suspectId: string; hint: JpText | null } | null;
  /** The questions you could ask, in English (and, for Kana-level players, in Japanese too). */
  menu: { intent: OnsenIntent; en: string; jp: JpText | null }[];
  tiles: QuestionTile[];
  accusation: { suspectId: string; said: boolean } | null;
  accuseTry: { suspectId: string; heard: string; triesLeft: number } | null;
  /** The sentence to say, per suspect. */
  lines: { suspectId: string; line: JpText }[];
  /** When you are this turn's deputy. */
  deputy: DeputyMe | null;
}

export interface DeputyMe {
  status: DeputyStatus;
  /** The answer is in and has a report: build it or say it. */
  canReport: boolean;
  /** The frame over the tiles (＿は ＿と いっていました). */
  frame: string | null;
  tiles: ReportTile[];
  triesLeft: number;
  heard: string;
  /** The whole line, once you've had a try (or are done). */
  line: JpText | null;
  points: number;
}

// ---- helpers ----

const suspectOf = (s: OnsenState, id: unknown): OnsenSuspect | undefined => (typeof id === 'string' ? s.case.suspects.find((x) => x.id === id) : undefined);
const clueOf = (s: OnsenState, id: string | null) => (id ? s.case.clues.find((c) => c.id === id) : undefined);
const askedOf = (s: OnsenState, suspectId: string): OnsenIntent[] => [...new Set(s.asks.filter((a) => a.suspectId === suspectId).map((a) => a.intent))];

const blankTally = (): Tally => ({ clues: 0, questions: 0, spoken: 0, base: 0, bonusEarned: 0, bonusPaid: 0, correct: false, reports: 0 });

function tallyFor(s: OnsenState, playerId: string): Tally {
  return (s.tally[playerId] ??= blankTally());
}

/** Pays out whatever of the earned speaking bonus the player's other points now allow. */
function settleBonus(s: OnsenState, ctx: ModeContext, playerId: string): void {
  const t = tallyFor(s, playerId);
  const target = Math.min(t.bonusEarned, Math.floor(t.base * BONUS_CAP));
  if (target > t.bonusPaid) {
    ctx.award(playerId, target - t.bonusPaid);
    t.bonusPaid = target;
  }
}

function give(s: OnsenState, ctx: ModeContext, playerId: string, points: number, bonus = 0): void {
  const t = tallyFor(s, playerId);
  if (points > 0) {
    t.base += points;
    ctx.award(playerId, points);
  }
  t.bonusEarned += bonus;
  settleBonus(s, ctx, playerId);
}

function readUtterance(raw: unknown): Utterance | null {
  if (!isUtterance(raw)) return null;
  const text = cleanText(raw.text, 80);
  if (!text) return null;
  return { via: raw.via, text, reading: typeof raw.reading === 'string' ? raw.reading : undefined };
}

function nextTurnPlayer(s: OnsenState, ctx: ModeContext): ModePlayer | undefined {
  const players = [...ctx.players()].sort((a, b) => a.seat - b.seat);
  const after = [...players.filter((p) => p.seat > s.lastSeat), ...players.filter((p) => p.seat <= s.lastSeat)];
  return after.find((p) => p.connected) ?? after[0];
}

function chooseCase(ctx: ModeContext, opts: { extra?: Record<string, unknown> }): { c: OnsenCase; fallback: boolean } {
  const cases = ctx.content.onsenCases.filter((c) => c.suspects.length >= 2 && c.suspects.some((x) => x.id === c.culpritId));
  if (!cases.length) return { c: FALLBACK_CASE, fallback: true };
  const wanted = typeof opts.extra?.caseId === 'string' ? cases.find((c) => c.id === opts.extra!.caseId) : undefined;
  if (wanted) return { c: wanted, fallback: false };
  const c = caseFor(cases, ctx.audience ?? 'family', () => ctx.random());
  return c ? { c, fallback: false } : { c: FALLBACK_CASE, fallback: true };
}

/**
 * Picks a case for the room's Audience. Cases with no audience play in every room; a Kids or
 * Cheeky room also gets its own cases, and plays one of them half the time.
 */
export function caseFor(cases: readonly OnsenCase[], audience: Audience, random: () => number): OnsenCase | undefined {
  const shared = cases.filter((c) => !c.audience);
  const own = cases.filter((c) => c.audience && c.audience === audience);
  if (own.length && (!shared.length || random() < 0.5)) return pick(own, random);
  return pick(shared, random);
}

/** How long an answer shows, before any deputy time. */
const revealBase = (s: OnsenState) => (s.asks.at(-1)?.newClue ? DURATIONS.answerClue : DURATIONS.answer);

/** When a deputy who is done lets the answer go: its usual time, or once Chōchin-san has voiced the report. */
const revealEnd = (s: OnsenState, d: Deputy) => Math.max(s.revealAt + revealBase(s), d.voicedUntil ?? 0);

/** Joins a lead-in to an answer. */
const withLead = (lead: JpText | null, answer: JpText): JpText =>
  lead ? { text: `${lead.text} ${answer.text}`, kana: `${lead.kana} ${answer.kana}`, en: `${lead.en} ${answer.en}` } : answer;

/**
 * Checks an LLM lead-in: short, kana only, and free of anything that could be a fact
 * (names, numbers, the word はんにん). Returns the cleaned line or null.
 */
export function cleanLead(raw: unknown, c: OnsenCase): JpText | null {
  if (!isObject(raw)) return null;
  const text = cleanText(raw.text, 24);
  const kana = cleanText(raw.kana, 30);
  const en = cleanText(raw.en, 80);
  if (!text || !kana || !en) return null;
  if ([...text].length > 20 || [...kana].length > 24 || en.length > 60) return null;
  if (hasKanji(text) || !isKana(text) || !isKana(kana)) return null;
  // Kana only, so the text is its own reading: the two must say the same thing.
  const keyOf = soundKey(kana);
  if (soundKey(text) !== keyOf) return null;
  const banned = [...c.suspects.map((x) => bareName(x.name.kana)), bareName(c.victim.name.kana), 'はんにん', ...c.item.keys].map((x) => soundKey(x));
  if (banned.some((b) => b && keyOf.includes(b))) return null;
  const enLow = en.toLowerCase();
  const bannedEn = [...c.suspects.map((x) => x.name.en.toLowerCase()), 'culprit', 'did it', 'killer', 'murder'];
  if (bannedEn.some((b) => enLow.includes(b)) || /\d/.test(en)) return null;
  return { text, kana, en };
}

function recordAsk(s: OnsenState, ctx: ModeContext, playerId: string, suspect: OnsenSuspect, intent: OnsenIntent, u: Utterance, guessed: boolean): void {
  const turn = s.turn!;
  const repeat = s.asks.some((a) => a.suspectId === suspect.id && a.intent === intent);
  const scripted = suspect.answers[intent] ?? { jp: s.case.shrug };
  const clueId = scripted.clueId && clueOf(s, scripted.clueId) ? scripted.clueId : null;
  const newClue = !!clueId && !s.found[clueId];
  const understood = !guessed && !repeat;
  const points = (understood ? POINTS.question : 0) + (newClue ? POINTS.clue : 0);
  const spoken = u.via === 'speech' && understood;
  const no = s.asks.length + 1;
  s.asks.push({
    no,
    playerId,
    suspectId: suspect.id,
    intent,
    heard: u.text,
    via: u.via,
    tries: turn.tries,
    guessed,
    repeat,
    answer: scripted.jp,
    lead: null,
    clueId,
    newClue,
    points,
    report: suspect.answers[intent]?.report ?? null,
  });
  const t = tallyFor(s, playerId);
  if (newClue) {
    s.found[clueId!] = { by: playerId, askNo: no };
    t.clues += 1;
  }
  if (!guessed) t.questions += 1;
  if (spoken) t.spoken += 1;
  give(s, ctx, playerId, points, spoken ? POINTS.spokenQuestion : 0);

  // The phrasebook gets the natural version of the question: said from memory (spoken or
  // typed), on the retry, built from tiles (seen), or missed.
  const q = questionFor(s.case, intent);
  const itemId = intent === 'victim' || intent === 'item' ? `onsen.q.${intent}.${s.case.id}` : `onsen.q.${intent}`;
  const entry = (outcome: PhraseEntry['outcome']): PhraseEntry => ({ itemId, text: q.text, kana: q.kana, en: q.en, outcome, recall: u.via === 'speech' ? 'memory' : 'read' });
  const outcome: PhraseEntry['outcome'] = guessed ? 'missed' : u.via === 'tap' ? 'seen' : turn.tries > 1 ? 'retry' : 'said';
  ctx.phrase(playerId, entry(outcome));
  for (const p of ctx.players()) if (p.id !== playerId) ctx.phrase(p.id, entry('seen'));

  turn.asked = true;
  turn.miss = null;
  s.line = { key: `${ctx.newId()}${ctx.newId()}`, askNo: no, lockAt: ctx.now + THINK_MS };
}

// ---- the deputy (N4 hard role) ----

/** Rooms this big or bigger rest a lone N4 deputy after a turn in the part (see offerDeputy). */
export const SPOTLIGHT_ROOM = 4;

/**
 * Offers the deputy's part to the next N4 player by seat, never the asker. Nobody at N4: no deputy.
 * In a room of SPOTLIGHT_ROOM or more, a lone eligible N4 player who was deputy last turn sits this one out.
 */
function offerDeputy(s: OnsenState, ctx: ModeContext, askerId: string | null): void {
  s.deputy = null;
  const n4 = ctx
    .players()
    .filter((p) => p.level === 'n4' && p.connected && p.id !== askerId)
    .sort((a, b) => a.seat - b.seat);
  const p = n4.find((x) => x.seat > s.deputySeat) ?? n4[0];
  if (!p) return;
  const last = s.deputyLog.at(-1);
  if (n4.length === 1 && ctx.connected().length >= SPOTLIGHT_ROOM && last?.turnNo === s.turnNo - 1 && last.playerId === p.id && last.outcome === 'accepted') return;
  s.deputySeat = p.seat;
  s.deputy = { turnNo: s.turnNo, playerId: p.id, status: 'offered', askNo: null, tiles: [], tries: 0, heard: '', via: null, points: 0, voicedUntil: null };
}

/** A deputy with a report still to give (an unanswered offer can still report: a first try is a yes). */
const deputyOpen = (d: Deputy | null): d is Deputy => !!d && d.askNo !== null && (d.status === 'offered' || d.status === 'ready');

/** A deputy the answer waits for: open, and they took the part or have had a try. An untouched offer adds no time. */
const deputyHolds = (d: Deputy | null): d is Deputy => deputyOpen(d) && (d.status === 'ready' || d.tries > 0);

/** Logs how the turn's offer went and clears it. An offer whose answer had nothing to report isn't counted. */
function closeDeputy(s: OnsenState, ctx: ModeContext): void {
  const d = s.deputy;
  s.deputy = null;
  if (!d || (d.askNo === null && d.status !== 'declined')) return;
  const outcome: OfferAnswer =
    d.status === 'declined'
      ? 'declined'
      : d.status === 'ready' || d.tries > 0 || d.status === 'reported'
        ? 'accepted'
        : ctx.player(d.playerId)?.connected === false
          ? 'away'
          : 'timeout';
  s.deputyLog.push({ turnNo: d.turnNo, playerId: d.playerId, outcome });
}

export interface DeputyTally {
  offered: number;
  accepted: number;
  declined: number;
  timeout: number;
  /** offerRate: the step's gate is at least 60% accepted. */
  rate: number | null;
}

/** Deputy offers per N4 player and what came of them. */
export function deputyOffers(s: Pick<OnsenState, 'deputyLog'>): Record<string, DeputyTally> {
  const out: Record<string, DeputyTally> = {};
  const answers: Record<string, OfferAnswer[]> = {};
  for (const e of s.deputyLog) {
    const o = (out[e.playerId] ??= { offered: 0, accepted: 0, declined: 0, timeout: 0, rate: null });
    o.offered += 1;
    if (e.outcome === 'accepted') o.accepted += 1;
    if (e.outcome === 'declined') o.declined += 1;
    if (e.outcome === 'timeout') o.timeout += 1;
    (answers[e.playerId] ??= []).push(e.outcome);
  }
  for (const [id, o] of Object.entries(out)) o.rate = offerRate(answers[id]!);
  return out;
}

/**
 * Chōchin-san says the accepted report on the TV (Ladi: the host says the line; the player's recording
 * never plays there). Always the model line, which is fixed, fluent and safe for the voice, whatever the
 * deputy said or built. Held back until the suspect's answer has been said, so the two never overlap.
 */
function voiceReport(s: OnsenState, ctx: ModeContext, d: Deputy, r: OnsenReport): void {
  const atMs = Math.max(0, s.revealAt + REPORT_VOICE.after - ctx.now);
  d.voicedUntil = ctx.now + atMs + REPORT_VOICE.beat;
  ctx.cue({ host: 'chochin', event: 'onsen_report', slots: { line: r.jp.text, line_kana: r.jp.kana, line_en: r.jp.en }, ...(atMs ? { atMs } : {}) });
}

function reportEntry(s: OnsenState, ask: Ask, outcome: PhraseEntry['outcome']): PhraseEntry {
  const r = ask.report!;
  return { itemId: `onsen.report.${s.case.id}.${ask.suspectId}.${ask.intent}`, text: r.jp.text, kana: r.jp.kana, en: r.jp.en, outcome };
}

function lockAccusation(s: OnsenState, ctx: ModeContext, playerId: string, suspect: OnsenSuspect, said: boolean, via: Via, tries: number): void {
  s.accusations[playerId] = { suspectId: suspect.id, said, via, order: Object.keys(s.accusations).length + 1 };
  delete s.accuseTries[playerId];
  if (said && via === 'speech') tallyFor(s, playerId).bonusEarned += POINTS.spokenAccuse;
  const line = accusationLine(suspect);
  const outcome: PhraseEntry['outcome'] = via === 'tap' ? 'seen' : !said ? 'missed' : tries > 1 ? 'retry' : 'said';
  ctx.phrase(playerId, { itemId: `onsen.accuse.${s.case.id}.${suspect.id}`, text: line.text, kana: line.kana, en: line.en, outcome, recall: via === 'speech' ? 'memory' : 'read' });
}

// ---- the mode ----

export const onsenMurderMode: Mode<OnsenState, OnsenView> = {
  info: {
    id: 'onsen-murder',
    title: 'Murder at the Onsen',
    titleJa: '温泉殺人事件',
    titleKana: 'おんせんさつじんじけん',
    blurb: 'Question the suspects in Japanese, then name the culprit.',
    host: 'chochin',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [2, 3, 1],
    usesPack: false,
    phrasebookTitle: 'Detective notebook',
    phaseLabels: { intro: 'Case file', answer: 'Question', reveal: 'Answer', encore: 'Accuse', finale: 'Confession' },
  },

  setup(ctx, opts) {
    const { c, fallback } = chooseCase(ctx, opts);
    const players = ctx.players();
    const each = opts.rounds && opts.rounds > 0 ? opts.rounds : 2;
    return {
      case: c,
      fallback,
      totalTurns: Math.max(TURNS.min, Math.min(TURNS.max, players.length * each)),
      turnNo: 0,
      turn: null,
      lastSeat: 0,
      asks: [],
      found: {},
      accusations: {},
      accuseTries: {},
      line: null,
      firstCorrect: null,
      tally: Object.fromEntries(players.map((p) => [p.id, blankTally()])),
      finished: false,
      revealAt: 0,
      deputy: null,
      deputySeat: 0,
      deputyLog: [],
    };
  },

  next(s, from) {
    const afterTurn = (): Phase => (s.turnNo >= s.totalTurns ? 'encore' : 'answer');
    switch (from) {
      case 'intro':
        return 'answer';
      case 'answer':
        return s.turn?.asked ? 'reveal' : afterTurn();
      case 'reveal':
        return afterTurn();
      case 'encore':
        return 'finale';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'chochin', event: 'onsen_case', prompt: s.case.setting });
        break;
      case 'answer': {
        s.turnNo += 1;
        const p = nextTurnPlayer(s, ctx);
        s.turn = { no: s.turnNo, playerId: p?.id ?? null, tries: 0, asked: false, miss: null };
        if (p) {
          s.lastSeat = p.seat;
          ctx.cue({ host: 'chochin', event: 'onsen_turn', slots: { name: p.name } });
        }
        offerDeputy(s, ctx, p?.id ?? null);
        break;
      }
      case 'reveal': {
        const ask = s.asks.at(-1);
        s.revealAt = ctx.now;
        // The deputy gets the answer's report as tiles; an answer with nothing to report voids the offer.
        const d = s.deputy;
        if (d && ask?.report && d.status !== 'declined') {
          d.askNo = ask.no;
          d.tiles = reportTiles(ask.report, () => ctx.random());
        } else if (d && d.status !== 'declined') s.deputy = null;
        if (ask?.newClue) ctx.cue({ host: 'chochin', event: 'onsen_clue', answer: ask.answer.text, answerEn: ask.answer.en });
        break;
      }
      case 'encore':
        s.turn = null;
        ctx.cue({ host: 'chochin', event: 'onsen_accuse' });
        break;
      case 'finale':
        s.finished = true;
        ctx.cue({ host: 'chochin', event: 'onsen_reveal' });
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'reveal') {
      s.line = null;
      closeDeputy(s, ctx);
    }
    // No question landed this turn, so there is nothing to report.
    if (phase === 'answer' && !s.turn?.asked) closeDeputy(s, ctx);
    if (phase === 'encore') {
      // A player who picked a suspect but never got the sentence out still gets their vote.
      for (const [playerId, tr] of Object.entries(s.accuseTries)) {
        const suspect = suspectOf(s, tr.suspectId);
        if (suspect && !s.accusations[playerId]) lockAccusation(s, ctx, playerId, suspect, false, 'typed', tr.tries);
      }
      const order = Object.entries(s.accusations).sort((a, b) => a[1].order - b[1].order);
      for (const [playerId, acc] of order) {
        if (acc.suspectId !== s.case.culpritId) {
          settleBonus(s, ctx, playerId);
          continue;
        }
        tallyFor(s, playerId).correct = true;
        s.firstCorrect ??= playerId;
        give(s, ctx, playerId, POINTS.accuse);
      }
    }
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'answer':
        return ctx.player(s.turn?.playerId ?? '')?.level === 'kana' ? DURATIONS.turnKana : DURATIONS.turn;
      case 'reveal':
        return revealBase(s) + (deputyHolds(s.deputy) ? DURATIONS.deputy : 0);
      case 'encore':
        return DURATIONS.accuse;
      case 'finale':
        return DURATIONS.confession;
      default:
        return 5_000;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    switch (phase) {
      case 'answer': {
        if (!s.turn || s.turn.asked) return true;
        const p = ctx.player(s.turn.playerId ?? '');
        return (!p || !p.connected) && here.length > 0;
      }
      case 'reveal': {
        // Only a deputy's turn runs long: it ends once they're done and the answer has had its time.
        const d = s.deputy;
        if (!d || d.askNo === null) return false;
        const gone = !ctx.player(d.playerId)?.connected;
        return (gone || !deputyHolds(d)) && ctx.now >= revealEnd(s, d);
      }
      case 'encore':
        return here.length > 0 && here.every((p) => !!s.accusations[p.id]);
      default:
        return false;
    }
  },

  wakeAt(s, phase, ctx) {
    const d = s.deputy;
    if (phase !== 'reveal' || !d || d.askNo === null || deputyHolds(d)) return null;
    const at = revealEnd(s, d);
    return ctx.now < at ? at : null;
  },

  wake() {
    // Nothing to change: the wake lets done() end a deputy's turn once the answer has had its time.
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');

    if (raw.kind === 'ask') {
      if (phase !== 'answer') return moveError('wrong-phase');
      const turn = s.turn;
      if (!turn || turn.playerId !== playerId) return moveError('not-your-turn');
      if (turn.asked) return moveError('wrong-phase');
      const suspect = suspectOf(s, raw.suspectId);
      if (!suspect) return moveError('bad-suspect');
      const u = readUtterance(raw.utterance);
      if (!u) return moveError('empty-answer');
      const asked = askedOf(s, suspect.id);
      const m = matchQuestion(s.case, u, asked);
      turn.tries += 1;
      if (m.intent) {
        recordAsk(s, ctx, playerId, suspect, m.intent, u, false);
        return MOVE_OK;
      }
      if (turn.tries < TRIES) {
        turn.miss = { heard: u.text, suspectId: suspect.id, closest: m.closest };
        return MOVE_OK;
      }
      // Forgiving: after the second miss the suspect answers what you most likely meant.
      const guess = m.closest ?? turn.miss?.closest ?? INTENTS.find((i) => !asked.includes(i)) ?? 'where';
      recordAsk(s, ctx, playerId, suspect, guess, u, true);
      return MOVE_OK;
    }

    if (raw.kind === 'accuse') {
      if (phase !== 'encore') return moveError('wrong-phase');
      if (s.accusations[playerId]) return moveError('already-accused');
      const suspect = suspectOf(s, raw.suspectId);
      if (!suspect) return moveError('bad-suspect');
      const u = raw.utterance === undefined ? null : readUtterance(raw.utterance);
      if (raw.utterance !== undefined && !u) return moveError('empty-answer');
      const before = s.accuseTries[playerId];
      const tries = (before && before.suspectId === suspect.id ? before.tries : 0) + 1;
      if (!u || u.via === 'tap') {
        lockAccusation(s, ctx, playerId, suspect, false, 'tap', tries);
        return MOVE_OK;
      }
      if (checkAccusation(u, suspect)) lockAccusation(s, ctx, playerId, suspect, true, u.via, tries);
      else if (tries >= TRIES) lockAccusation(s, ctx, playerId, suspect, false, u.via, tries);
      else s.accuseTries[playerId] = { tries, heard: u.text, suspectId: suspect.id };
      return MOVE_OK;
    }

    if (raw.kind === 'deputy') {
      // Taking the offer, or "not this time" (only before a first try).
      const d = s.deputy;
      if (!d || d.playerId !== playerId) return moveError('not-deputy');
      if (phase !== 'answer' && phase !== 'reveal') return moveError('wrong-phase');
      if (d.status !== 'offered' && d.status !== 'ready') return MOVE_OK;
      if (raw.accept === true) d.status = 'ready';
      else if (raw.accept === false && d.tries === 0) d.status = 'declined';
      else return moveError('bad-move');
      return MOVE_OK;
    }

    if (raw.kind === 'report') {
      if (phase !== 'reveal') return moveError('wrong-phase');
      const d = s.deputy;
      if (!d || d.playerId !== playerId) return moveError('not-deputy');
      if (!deputyOpen(d)) return moveError('wrong-phase');
      const ask = s.asks.find((a) => a.no === d.askNo);
      if (!ask?.report) return moveError('wrong-phase');
      let ok: boolean;
      let via: Via;
      if (raw.tiles !== undefined) {
        if (!Array.isArray(raw.tiles) || raw.tiles.length > d.tiles.length || new Set(raw.tiles).size !== raw.tiles.length) return moveError('bad-move');
        const picked = raw.tiles.map((id) => d.tiles.find((t) => t.id === id));
        if (!picked.length || picked.some((t) => !t)) return moveError('bad-move');
        ok = tilesInOrder(ask.report, picked as ReportTile[]);
        via = 'tap';
        d.heard = joinReport(picked as ReportTile[]);
      } else {
        const u = readUtterance(raw.utterance);
        if (!u) return moveError('empty-answer');
        ok = checkReport(u, ask.report);
        via = u.via;
        d.heard = u.text;
      }
      d.tries += 1;
      if (ok) {
        d.status = 'reported';
        d.via = via;
        d.points = via === 'tap' ? POINTS.reportTiles : POINTS.report;
        tallyFor(s, playerId).reports += 1;
        give(s, ctx, playerId, d.points, via === 'speech' ? POINTS.spokenReport : 0);
        // Only a spoken report counts as from memory, as for the questions.
        ctx.phrase(playerId, { ...reportEntry(s, ask, via === 'tap' ? 'seen' : d.tries > 1 ? 'retry' : 'said'), recall: via === 'speech' ? 'memory' : 'read' });
        voiceReport(s, ctx, d, ask.report);
      } else if (d.tries >= TRIES) {
        d.status = 'missed';
        ctx.phrase(playerId, reportEntry(s, ask, 'missed'));
      }
      return MOVE_OK;
    }

    if (raw.kind === 'suspect-line') {
      // The server's LLM lead-in (server/src/onsen.ts). Only the server knows the key.
      const line = s.line;
      if (!line || typeof raw.key !== 'string' || raw.key !== line.key) return moveError('bad-move');
      if (phase !== 'reveal' || ctx.now > line.lockAt) return moveError('too-late');
      const lead = cleanLead(raw.lead, s.case);
      if (!lead) return moveError('bad-move');
      const ask = s.asks.find((a) => a.no === line.askNo);
      if (ask) ask.lead = lead;
      s.line = null;
      return MOVE_OK;
    }

    return moveError('bad-move');
  },

  offers(s, playerId) {
    return s.deputyLog.filter((o) => o.playerId === playerId).map((o) => ({ role: 'onsen-murder:deputy', answer: o.outcome }));
  },

  progress(s) {
    return { round: Math.min(s.turnNo, s.totalTurns), totalRounds: s.totalTurns };
  },

  view(s, phase, viewer, ctx) {
    const c = s.case;
    const last = s.asks.at(-1);
    const current: CurrentView | null =
      phase === 'reveal' && last
        ? {
            no: last.no,
            playerId: last.playerId,
            suspectId: last.suspectId,
            heard: last.heard,
            via: last.via,
            intent: last.intent,
            natural: questionFor(c, last.intent),
            answer: withLead(last.lead, last.answer),
            clue: clueOf(s, last.clueId)?.jp ?? null,
            newClue: last.newClue,
            points: last.points,
            guessed: last.guessed,
            repeat: last.repeat,
          }
        : null;

    const notebook: NotebookEntry[] = Object.entries(s.found)
      .sort((a, b) => a[1].askNo - b[1].askNo)
      .map(([id, f]) => {
        const clue = clueOf(s, id)!;
        const ask = s.asks.find((a) => a.no === f.askNo)!;
        return { id, jp: clue.jp, by: f.by, suspectId: ask.suspectId, ...(s.finished ? { key: !!clue.key } : {}) };
      });

    const result: OnsenResult | null = s.finished
      ? {
          culpritId: c.culpritId,
          confession: c.confession,
          solution: c.solution,
          votes: Object.entries(s.accusations)
            .sort((a, b) => a[1].order - b[1].order)
            .map(([playerId, a]) => ({ playerId, suspectId: a.suspectId, said: a.said, correct: a.suspectId === c.culpritId })),
          missed: c.clues.filter((x) => x.key && !s.found[x.id]).map((x) => x.jp),
        }
      : null;

    const d = s.deputy && (phase === 'answer' || phase === 'reveal') ? s.deputy : null;
    const dAsk = d?.askNo ? s.asks.find((a) => a.no === d.askNo) : undefined;

    let mine: OnsenMe | null = null;
    if (viewer.kind === 'player') {
      const id = viewer.playerId;
      const me = ctx.player(id);
      const turn = s.turn;
      const isTurn = phase === 'answer' && turn?.playerId === id && !turn.asked;
      const tr = s.accuseTries[id];
      const acc = s.accusations[id];
      mine = {
        isTurn,
        triesLeft: isTurn ? TRIES - (turn?.tries ?? 0) : 0,
        miss: isTurn && turn?.miss ? { heard: turn.miss.heard, suspectId: turn.miss.suspectId, hint: turn.miss.closest ? questionFor(c, turn.miss.closest) : null } : null,
        menu: INTENTS.map((intent) => ({ intent, en: questionFor(c, intent).en, jp: me?.level === 'kana' ? questionFor(c, intent) : null })),
        tiles: tilesFor(c),
        accusation: acc ? { suspectId: acc.suspectId, said: acc.said } : null,
        accuseTry: tr && !acc ? { suspectId: tr.suspectId, heard: tr.heard, triesLeft: TRIES - tr.tries } : null,
        lines: c.suspects.map((x) => ({ suspectId: x.id, line: accusationLine(x) })),
        deputy:
          d && d.playerId === id
            ? {
                status: d.status,
                canReport: phase === 'reveal' && deputyOpen(d),
                frame: dAsk?.report ? reportFrame(dAsk.report) : null,
                tiles: phase === 'reveal' && deputyOpen(d) ? d.tiles : [],
                triesLeft: TRIES - d.tries,
                heard: d.heard,
                line: dAsk?.report && (d.tries > 0 || !deputyOpen(d)) ? dAsk.report.jp : null,
                points: d.points,
              }
            : null,
      };
    }

    return {
      mode: 'onsen-murder',
      caseFile: { id: c.id, title: c.title, setting: c.setting, victim: c.victim, item: { name: c.item.name, emoji: c.item.emoji } },
      suspects: c.suspects.map((x) => ({ id: x.id, name: x.name, suffix: x.suffix, role: x.role, emoji: x.emoji, voice: x.voice, asked: askedOf(s, x.id) })),
      turn:
        s.turn && (phase === 'answer' || phase === 'reveal')
          ? { no: s.turn.no, total: s.totalTurns, playerId: s.turn.playerId, tries: s.turn.tries, miss: s.turn.miss ? { suspectId: s.turn.miss.suspectId, heard: s.turn.miss.heard } : null }
          : null,
      current,
      notebook,
      log: s.asks.map((a) => ({ no: a.no, playerId: a.playerId, suspectId: a.suspectId, intent: a.intent, newClue: a.newClue })),
      accused: Object.keys(s.accusations),
      result,
      tally: ctx.players().map((p) => {
        const t = tallyFor(s, p.id);
        return { playerId: p.id, clues: t.clues, questions: t.questions, spoken: t.spoken, correct: t.correct };
      }),
      fallback: s.fallback,
      thinkMs: THINK_MS,
      subtitleMs: SUBTITLE_MS,
      deputy: d
        ? {
            playerId: d.playerId,
            status: d.status,
            reporting: phase === 'reveal' && d.askNo !== null,
            line: d.status === 'reported' && dAsk?.report ? dAsk.report.jp : null,
            via: d.via,
            points: d.points,
          }
        : null,
      mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (key: 'clues' | 'spoken') => {
      let top: ModePlayer | undefined;
      for (const p of players) if ((s.tally[p.id]?.[key] ?? 0) > (top ? (s.tally[top.id]?.[key] ?? 0) : 0)) top = p;
      return top;
    };
    const ace = best('clues');
    if (ace) out.push({ playerId: ace.id, name: ace.name, title: 'めいたんてい', en: 'Ace Detective: most clues found' });
    const voice = best('spoken');
    if (voice) out.push({ playerId: voice.id, name: voice.name, title: 'こえの たんてい', en: 'Voice Detective: most questions asked aloud' });
    const first = s.firstCorrect ? ctx.player(s.firstCorrect) : undefined;
    if (first) out.push({ playerId: first.id, name: first.name, title: 'みぬいた！', en: 'Saw Right Through It: first to name the culprit' });
    return out;
  },
};

// ---- the server's LLM lead-in ----

export interface SuspectLineRequest {
  /** Echo this back in the { kind: 'suspect-line' } move. */
  key: string;
  /** The move is sent on this player's behalf (the one who asked). */
  playerId: string;
  /** Server-clock ms after which the line is refused. */
  lockAt: number;
  caseTitle: JpText;
  suspect: { name: JpText; role: JpText; persona: string };
  /** The player's question, untrusted. */
  question: string;
  intent: OnsenIntent;
  /** The scripted answer the lead-in goes in front of. */
  answer: JpText;
}

/** The answer waiting for the server's optional lead-in (read-only). */
export function suspectLineRequests(state: unknown): SuspectLineRequest[] {
  const s = state as Partial<OnsenState> | null;
  if (!s || typeof s !== 'object' || !s.line || !s.asks || !s.case) return [];
  const line = s.line;
  const ask = s.asks.find((a) => a.no === line.askNo);
  const suspect = ask ? s.case.suspects.find((x) => x.id === ask.suspectId) : undefined;
  if (!ask || !suspect) return [];
  return [
    {
      key: line.key,
      playerId: ask.playerId,
      lockAt: line.lockAt,
      caseTitle: s.case.title,
      suspect: { name: suspect.name, role: suspect.role, persona: suspect.persona },
      question: ask.heard,
      intent: ask.intent,
      answer: ask.answer,
    },
  ];
}
