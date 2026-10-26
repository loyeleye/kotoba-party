// Last Train (spoken survival). Host: Chōchin-san, the lantern-ghost conductor.
// See docs/modes/last-train.md for the rules in prose.
//
// Phases: intro (departure) → for each stop: prompt (announcement) → answer (each phone its
// own item, one private retry with a hint) → reveal (everyone's answer and the model answer)
// → penalty (only if someone missed twice; failing it makes a ghost) → … → finale (Platform
// Dash) → score → recap.
//
// Personal timers: every item has its own time limit, so each player's attempt has its own
// deadline inside the answer phase. Modes have no timers, so expiry is lazy: any move first
// sweeps what is overdue, and phones send { kind: 'tick' } when their own clock runs out.

import type { HostAward, JpText, LastTrainMinigame, LastTrainScenario, Level, MinigameItem, PromptType, TrainStop } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, pick, shuffled, type Award, type Mode, type ModeContext, type MoveResult, type PhraseEntry } from '../mode.js';
import { checkUtterance, firstMora, toRomaji } from './check.js';
import { FALLBACK_MINIGAMES, FALLBACK_SCENARIO, SPARE_STOP_NAMES } from './fallback.js';

// ---- tuning ----

export const RULES = {
  /** How long the room has to thumbs-up a rejected answer. */
  overruleMs: 7_000,
  /** Answers that arrive this late after a personal deadline still count (network lag). */
  graceMs: 1_500,
  /** A phone's own "time's up" tick is believed this early (clock drift). */
  tickToleranceMs: 1_000,
  /** A haunt shaves this much off the target's next timer. */
  hauntMs: 2_000,
  minLimitMs: 4_000,
  pointsFirstTry: 100,
  pointsRetry: 60,
  /** Ghosts earn this share of a living player's points. */
  ghostShare: 0.5,
  /** From-memory speech bonus, as a share of the answer's points. */
  speechRate: 0.25,
  /** The cap: the bonus is at most 30% of base + bonus, i.e. 3/7 of base. Trailing players get the cap. */
  speechCapRate: 3 / 7,
  /** Correct answers in a row that bring a ghost back. */
  reviveStreak: 2,
  dashTrack: 6,
  ghostStartBack: 2,
  dashLimitMaxS: 8,
  dashPoints: [400, 250, 150] as readonly number[],
  dashPointsAboard: 100,
  dashPointsPerStep: 15,
  stopChoices: [4, 6] as readonly number[],
} as const;

const DURATIONS: Partial<Record<Phase, number>> = {
  intro: 14_000,
  prompt: 7_000,
  reveal: 12_000,
  finale: 75_000,
  score: 10_000,
};

// ---- state ----

export type Via = Utterance['via'];

interface Task {
  /** Unique per attempt: the phone restarts its clock and the bot answers once per key. */
  key: string;
  kind: 'stop' | 'penalty' | 'dash';
  minigameId: string;
  promptType: PromptType;
  item: MinigameItem;
  attempt: 1 | 2;
  startedAt: number;
  limitMs: number;
  deadline: number;
}

interface AttemptRec {
  via: Via | null;
  text: string | null;
  ok: boolean;
  overruled: boolean;
  timedOut: boolean;
}

type TurnStatus = 'answering' | 'retry' | 'correct' | 'missed' | 'away';

interface Turn {
  playerId: string;
  task: Task;
  status: TurnStatus;
  attempts: AttemptRec[];
  /** Which attempt ended correct (1 or 2), 0 if none. */
  correctOn: 0 | 1 | 2;
  ghostAtStart: boolean;
  points: number;
}

interface PenaltyTurn {
  playerId: string;
  task: Task;
  status: 'answering' | 'passed' | 'failed';
  attempt: AttemptRec | null;
}

interface Overrule {
  id: string;
  playerId: string;
  scope: 'stop' | 'penalty';
  attemptIndex: number;
  heard: string;
  prompt: JpText;
  closesAt: number;
  eligible: string[];
  votes: Record<string, boolean>;
  state: 'open' | 'overruled' | 'upheld';
}

interface Traveller {
  playerId: string;
  ghost: boolean;
  streak: number;
  pendingShaveMs: number;
  hauntedThisStop: boolean;
  misses: number;
  stopsPlayed: number;
  ghostCorrect: number;
  revivedAt: number;
  haunts: number;
}

interface Racer {
  playerId: string;
  pos: number;
  ghost: boolean;
  aboard: number | null;
  task: Task | null;
  n: number;
  queue: string[];
}

export interface DashResult {
  playerId: string;
  name: string;
  rank: number | null;
  pos: number;
  points: number;
}

interface LedgerEntry {
  playerId: string;
  points: number;
  reason: 'stop' | 'dash';
  stop: number;
}

export interface Stop {
  id: string;
  name: JpText;
  announcement: JpText;
  minigameId: string;
}

export interface LastTrainState {
  scenario: { id: string; title: JpText; departure: JpText; twist: JpText };
  stops: Stop[];
  stopIndex: number;
  minigames: Record<string, LastTrainMinigame>;
  penaltyIds: string[];
  dashPool: MinigameItem[];
  used: string[];
  travellers: Record<string, Traveller>;
  turns: Record<string, Turn>;
  penalties: Record<string, PenaltyTurn>;
  windows: Overrule[];
  haunts: { by: string; target: string }[];
  results: RevealRow[] | null;
  echoes: Record<string, { text: string; ok: boolean }>;
  racers: Record<string, Racer>;
  finishers: string[];
  dashResults: DashResult[] | null;
  ledger: LedgerEntry[];
  overruleLog: { stop: number; playerId: string; itemId: string; heard: string; up: number; eligible: number }[];
  rejects: number;
  seq: number;
}

// ---- view ----

export type TravellerStatus = 'waiting' | 'answering' | 'retry' | 'correct' | 'missed' | 'away' | 'penalty' | 'passed' | 'failed' | 'aboard' | 'racing';

export interface TravellerView {
  playerId: string;
  name: string;
  ghost: boolean;
  status: TravellerStatus;
  streak: number;
  /** Seconds a haunt will shave off this player's next timer. */
  shaveS: number;
}

export interface RevealRow {
  playerId: string;
  name: string;
  prompt: JpText;
  said: string | null;
  via: Via | null;
  outcome: 'first' | 'retry' | 'overruled' | 'missed' | 'away';
  model: JpText;
  points: number;
  ghost: boolean;
}

export interface OverruleView {
  id: string;
  playerId: string;
  name: string;
  scope: 'stop' | 'penalty';
  up: number;
  down: number;
  eligible: number;
  state: 'open' | 'overruled' | 'upheld';
  /** Only for players who may vote (never on the stage, never to the answerer). */
  heard?: string;
  prompt?: JpText;
  canVote?: boolean;
  myVote?: boolean | null;
  mine?: boolean;
}

export interface TaskView {
  key: string;
  kind: 'stop' | 'penalty' | 'dash';
  /** The content item's id (not its answers). */
  itemId: string;
  minigame: JpText | null;
  promptType: PromptType;
  prompt: JpText;
  visual: string | null;
  limitMs: number;
  attempt: 1 | 2;
  hint: string | null;
  /** Kana level only: romaji of the prompt's reading. */
  romaji: string | null;
  /** Kana level retry: the first sound of the answer. */
  firstKana: string | null;
  /** Listen-and-answer: play the prompt aloud first and hide its text until the retry. */
  listen: boolean;
  /** What the phone heard last time (on a retry). */
  lastHeard: string | null;
}

export interface LastTrainMe {
  ghost: boolean;
  streak: number;
  status: TravellerStatus;
  task: TaskView | null;
  canHaunt: boolean;
  hauntTargets: { playerId: string; name: string }[];
  shaveS: number;
  result: RevealRow | null;
  canEcho: boolean;
  echo: { text: string; ok: boolean } | null;
  inPenalty: boolean;
  dash: { pos: number; aboard: number | null } | null;
  level: Level;
}

export interface StopView {
  index: number;
  name: JpText;
  announcement: JpText;
  minigame: { id: string; title: JpText; intro: JpText; topic: string; promptType: PromptType };
  isLast: boolean;
}

export interface LastTrainView {
  mode: 'last-train';
  title: JpText;
  departure: JpText;
  /** Shown from the last stop on. */
  twist: JpText | null;
  stops: { name: JpText; minigame: JpText }[];
  stopIndex: number;
  stop: StopView | null;
  travellers: TravellerView[];
  overrules: OverruleView[];
  haunts: { by: string; target: string }[];
  results: RevealRow[] | null;
  penalty: { minigames: JpText[]; rows: { playerId: string; name: string; status: 'answering' | 'passed' | 'failed'; said: string | null; model: JpText | null }[] } | null;
  dash: { track: number; ghostStart: number; racers: { playerId: string; name: string; pos: number; ghost: boolean; aboard: number | null }[]; results: DashResult[] | null } | null;
  ledger: LedgerEntry[];
  overruled: number;
  me: LastTrainMe | null;
}

// ---- moves ----

export type LastTrainMove =
  | { kind: 'answer'; key: string; utterance: Utterance }
  | { kind: 'pass'; key: string }
  | { kind: 'tick' }
  | { kind: 'overrule'; windowId: string; up: boolean }
  | { kind: 'haunt'; targetId: string }
  | { kind: 'echo'; utterance: Utterance };

// ---- helpers ----

const LEVEL_ORDER: Record<Level, Level[]> = { kana: ['kana', 'n5'], n5: ['n5', 'kana'], n4: ['n4', 'n5', 'kana'] };
const itemKey = (mgId: string, itemId: string) => `${mgId}#${itemId}`;
const isParticle = (task: Task) => task.promptType === 'fill-particle' || task.minigameId === 'particle-panic';

/** Items from a pool at a player's level (nearest level first), unused ones preferred. */
function dealItem(s: LastTrainState, pool: readonly MinigameItem[], ns: string, level: Level, random: () => number): MinigameItem | undefined {
  for (const lv of LEVEL_ORDER[level]) {
    const atLevel = pool.filter((i) => i.level === lv);
    const fresh = atLevel.filter((i) => !s.used.includes(itemKey(ns, i.id)));
    const chosen = pick(fresh, random);
    if (chosen) {
      s.used.push(itemKey(ns, chosen.id));
      return chosen;
    }
  }
  // Everything at this level is used: repeat one rather than stall.
  const anyLevel = LEVEL_ORDER[level].flatMap((lv) => pool.filter((i) => i.level === lv));
  return pick(anyLevel.length ? anyLevel : pool, random);
}

function makeTask(s: LastTrainState, kind: Task['kind'], mg: { id: string; promptType: PromptType }, item: MinigameItem, attempt: 1 | 2, traveller: Traveller | undefined, now: number, capS?: number): Task {
  s.seq += 1;
  let limitMs = Math.max(1, item.timeLimit) * 1000;
  if (capS) limitMs = Math.min(limitMs, capS * 1000);
  if (traveller && traveller.pendingShaveMs > 0 && kind !== 'dash') {
    limitMs = Math.max(RULES.minLimitMs, limitMs - traveller.pendingShaveMs);
    traveller.pendingShaveMs = 0;
  }
  return { key: `${kind}:${s.stopIndex}:${s.seq}`, kind, minigameId: mg.id, promptType: mg.promptType, item, attempt, startedAt: now, limitMs, deadline: now + limitMs };
}

function traveller(s: LastTrainState, playerId: string): Traveller {
  return (s.travellers[playerId] ??= {
    playerId,
    ghost: false,
    streak: 0,
    pendingShaveMs: 0,
    hauntedThisStop: false,
    misses: 0,
    stopsPlayed: 0,
    ghostCorrect: 0,
    revivedAt: 0,
    haunts: 0,
  });
}

function readUtterance(raw: unknown): Utterance | null {
  if (!isUtterance(raw)) return null;
  const text = cleanText(raw.text, 80);
  if (!text) return null;
  return { via: raw.via, text, reading: typeof raw.reading === 'string' ? raw.reading : undefined };
}

function phraseOf(item: MinigameItem, outcome: PhraseEntry['outcome']): PhraseEntry {
  return { itemId: item.id, text: item.model.text, kana: item.model.kana, en: item.model.en, outcome };
}

const nameOf = (ctx: ModeContext, id: string) => ctx.player(id)?.name ?? '(left)';
const isConnected = (ctx: ModeContext, id: string) => ctx.player(id)?.connected ?? false;

// ---- building the line ----

function resolveLibrary(ctx: ModeContext): { minigames: Record<string, LastTrainMinigame>; penaltyIds: string[] } {
  const fromContent = ctx.content.lastTrainMinigames.filter((m) => m.items.length > 0);
  const list = fromContent.length ? fromContent : FALLBACK_MINIGAMES;
  const minigames: Record<string, LastTrainMinigame> = {};
  for (const m of list) minigames[m.id] = m;
  let penaltyIds = list.filter((m) => m.penalty).map((m) => m.id);
  if (!penaltyIds.length) {
    // No penalty minigame in content: borrow the placeholder one.
    for (const m of FALLBACK_MINIGAMES.filter((x) => x.penalty)) {
      const id = minigames[m.id] ? `fallback-${m.id}` : m.id;
      minigames[id] = { ...m, id };
      penaltyIds.push(id);
    }
  }
  return { minigames, penaltyIds };
}

function chooseScenario(ctx: ModeContext, want: number, minigames: Record<string, LastTrainMinigame>): LastTrainScenario {
  const usable = ctx.content.lastTrainScenarios.filter((sc) => sc.stops.length > 0 && sc.stops.every((st) => minigames[st.minigameId]));
  const exact = usable.filter((sc) => sc.stops.length === want);
  if (exact.length) return pick(exact, () => ctx.random())!;
  const longer = usable.filter((sc) => sc.stops.length > want).sort((a, b) => a.stops.length - b.stops.length);
  if (longer.length) return longer[0]!;
  const shorter = [...usable].sort((a, b) => b.stops.length - a.stops.length);
  return shorter[0] ?? FALLBACK_SCENARIO;
}

/** Trims or pads a scenario's stops to `want`, always keeping its last stop last (the twist). */
export function buildStops(scenario: LastTrainScenario, want: number, minigames: Record<string, LastTrainMinigame>, penaltyIds: readonly string[], random: () => number): Stop[] {
  const valid: TrainStop[] = scenario.stops.filter((st) => minigames[st.minigameId]);
  let stops: Stop[] = valid.map((st) => ({ id: st.id, name: st.name, announcement: st.announcement, minigameId: st.minigameId }));
  if (stops.length > want) stops = [...stops.slice(0, want - 1), stops.at(-1)!];
  // Borrowed placeholder penalty minigames never become stops.
  const regular = Object.values(minigames).filter((m) => !(penaltyIds.includes(m.id) && m.id.startsWith('fallback-')));
  const nonPenalty = regular.filter((m) => !m.penalty);
  const choices = shuffled(nonPenalty.length ? nonPenalty : regular, random);
  const names = shuffled(SPARE_STOP_NAMES, random);
  let n = 0;
  while (stops.length < want && choices.length) {
    const mg = choices[n % choices.length]!;
    const name = names[n % names.length]!;
    const extra: Stop = {
      id: `spare.${n}`,
      name,
      minigameId: mg.id,
      announcement: { text: `次は${name.text}です。`, kana: `つぎは${name.kana}です。`, en: `Next stop: ${name.en}.` },
    };
    // Spare stops go before the final stop, so the twist still comes last.
    if (stops.length) stops.splice(stops.length - 1, 0, extra);
    else stops.push(extra);
    n++;
  }
  return stops;
}

// ---- turns and attempts ----

function startTurns(s: LastTrainState, ctx: ModeContext): void {
  const stop = s.stops[s.stopIndex]!;
  const mg = s.minigames[stop.minigameId]!;
  s.turns = {};
  for (const p of ctx.players()) {
    const t = traveller(s, p.id);
    const item = dealItem(s, mg.items, mg.id, p.level, () => ctx.random());
    if (!item) continue;
    s.turns[p.id] = {
      playerId: p.id,
      task: makeTask(s, 'stop', mg, item, 1, t, ctx.now),
      status: 'answering',
      attempts: [],
      correctOn: 0,
      ghostAtStart: t.ghost,
      points: 0,
    };
  }
}

function openWindow(s: LastTrainState, ctx: ModeContext, playerId: string, scope: Overrule['scope'], attemptIndex: number, heard: string, prompt: JpText): void {
  const eligible = ctx
    .connected()
    .map((p) => p.id)
    .filter((id) => id !== playerId);
  if (!eligible.length) return;
  s.windows.push({ id: `ov${++s.seq}`, playerId, scope, attemptIndex, heard, prompt, closesAt: ctx.now + RULES.overruleMs, eligible, votes: {}, state: 'open' });
}

function recordStopMiss(s: LastTrainState, ctx: ModeContext, turn: Turn, rec: AttemptRec): void {
  turn.attempts.push(rec);
  s.rejects += 1;
  if (rec.text) openWindow(s, ctx, turn.playerId, 'stop', turn.attempts.length - 1, rec.text, turn.task.item.prompt);
  if (turn.task.attempt === 1) {
    const mg = s.minigames[turn.task.minigameId]!;
    turn.status = 'retry';
    turn.task = makeTask(s, 'stop', mg, turn.task.item, 2, traveller(s, turn.playerId), ctx.now);
  } else turn.status = 'missed';
}

function recordPenaltyMiss(s: LastTrainState, ctx: ModeContext, pt: PenaltyTurn, rec: AttemptRec): void {
  pt.attempt = rec;
  pt.status = 'failed';
  s.rejects += 1;
  if (rec.text) openWindow(s, ctx, pt.playerId, 'penalty', 0, rec.text, pt.task.item.prompt);
}

function nextDashTask(s: LastTrainState, ctx: ModeContext, r: Racer): void {
  if (r.aboard !== null) {
    r.task = null;
    return;
  }
  if (!r.queue.length) r.queue = shuffled(s.dashPool, () => ctx.random()).map((i) => i.id);
  const level = ctx.player(r.playerId)?.level ?? 'n5';
  // Prefer the next queued item at the player's level; any item if none is.
  const order = LEVEL_ORDER[level];
  let idx = -1;
  for (const lv of order) {
    idx = r.queue.findIndex((id) => s.dashPool.find((i) => i.id === id)?.level === lv);
    if (idx >= 0) break;
  }
  if (idx < 0) idx = 0;
  const id = r.queue.splice(idx, 1)[0]!;
  const item = s.dashPool.find((i) => i.id === id) ?? s.dashPool[0]!;
  r.n += 1;
  r.task = makeTask(s, 'dash', { id: 'platform-dash', promptType: 'spoken-question' }, item, 1, undefined, ctx.now, RULES.dashLimitMaxS);
}

function tally(w: Overrule): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const id of w.eligible) {
    if (w.votes[id] === true) up++;
    else if (w.votes[id] === false) down++;
  }
  return { up, down };
}

/** Re-checks a window after a vote: a majority of thumbs-up overrules at once. */
function evaluate(s: LastTrainState, ctx: ModeContext, w: Overrule, closing: boolean): void {
  if (w.state !== 'open') return;
  const { up, down } = tally(w);
  const n = w.eligible.length;
  if (up * 2 > n) applyOverrule(s, ctx, w, up);
  else if (closing || (n - down) * 2 <= n || up + down >= n) w.state = 'upheld';
}

function applyOverrule(s: LastTrainState, ctx: ModeContext, w: Overrule, up: number): void {
  w.state = 'overruled';
  let itemId = '';
  if (w.scope === 'stop') {
    const turn = s.turns[w.playerId];
    const rec = turn?.attempts[w.attemptIndex];
    if (!turn || !rec) return;
    rec.ok = true;
    rec.overruled = true;
    const on = (w.attemptIndex + 1) as 1 | 2;
    turn.correctOn = turn.correctOn === 0 ? on : (Math.min(turn.correctOn, on) as 1 | 2);
    turn.status = 'correct';
    itemId = turn.task.item.id;
  } else {
    const pt = s.penalties[w.playerId];
    if (!pt?.attempt) return;
    pt.attempt.ok = true;
    pt.attempt.overruled = true;
    pt.status = 'passed';
    itemId = pt.task.item.id;
  }
  s.overruleLog.push({ stop: s.stopIndex, playerId: w.playerId, itemId, heard: w.heard, up, eligible: w.eligible.length });
  ctx.cue({ host: 'chochin', event: 'room_overrule', slots: { name: nameOf(ctx, w.playerId) }, answer: w.heard, prompt: w.prompt });
}

/** Expires whatever is overdue. `force` ends everything (the phase is over). */
function sweep(s: LastTrainState, phase: Phase, ctx: ModeContext, actorId: string | null, force = false): void {
  const now = ctx.now;
  const due = (task: Task, pid: string) => force || now >= task.deadline + RULES.graceMs || (pid === actorId && now >= task.deadline - RULES.tickToleranceMs);
  const timedOut: AttemptRec = { via: null, text: null, ok: false, overruled: false, timedOut: true };
  if (phase === 'answer') {
    for (const turn of Object.values(s.turns)) {
      // A forced end can need two passes: attempt 1 expires into attempt 2, which then expires too.
      for (let i = 0; i < 2 && (turn.status === 'answering' || turn.status === 'retry') && due(turn.task, turn.playerId); i++) {
        if (force && !isConnected(ctx, turn.playerId) && turn.attempts.length === 0) {
          turn.status = 'away';
          break;
        }
        recordStopMiss(s, ctx, turn, { ...timedOut });
      }
    }
  }
  if (phase === 'penalty') {
    for (const pt of Object.values(s.penalties)) if (pt.status === 'answering' && due(pt.task, pt.playerId)) recordPenaltyMiss(s, ctx, pt, { ...timedOut });
  }
  if (phase === 'finale' && !force) {
    for (const r of Object.values(s.racers)) if (r.task && due(r.task, r.playerId)) nextDashTask(s, ctx, r);
  }
  for (const w of s.windows) if (w.state === 'open' && (force || now >= w.closesAt)) evaluate(s, ctx, w, true);
}

// ---- resolving a stop ----

function scoreStop(s: LastTrainState, ctx: ModeContext): void {
  const isLast = s.stopIndex === s.stops.length - 1;
  const mult = isLast ? 2 : 1;
  const players = ctx.players();
  const avg = players.length ? players.reduce((n, p) => n + p.score, 0) / players.length : 0;
  const rows: RevealRow[] = [];
  for (const p of players) {
    const turn = s.turns[p.id];
    if (!turn) continue;
    const t = traveller(s, p.id);
    const item = turn.task.item;
    let points = 0;
    if (turn.correctOn) {
      const rec = turn.attempts[turn.correctOn - 1];
      let base: number = turn.correctOn === 1 ? RULES.pointsFirstTry : RULES.pointsRetry;
      if (turn.ghostAtStart) base = Math.round(base * RULES.ghostShare);
      let bonus = 0;
      if (rec?.via === 'speech') {
        let rate = avg > 0 && p.score < avg ? RULES.speechCapRate : RULES.speechRate;
        if (turn.task.promptType === 'read-aloud') rate /= 2;
        bonus = Math.min(Math.round(base * rate), Math.floor(base * RULES.speechCapRate));
      }
      points = (base + bonus) * mult;
      ctx.award(p.id, points);
      s.ledger.push({ playerId: p.id, points, reason: 'stop', stop: s.stopIndex });
    }
    turn.points = points;
    if (turn.status !== 'away') {
      t.stopsPlayed += 1;
      if (turn.correctOn !== 1) t.misses += 1;
      ctx.phrase(p.id, phraseOf(item, turn.correctOn === 1 ? 'said' : turn.correctOn === 2 ? 'retry' : 'missed'));
    }
    if (turn.ghostAtStart && t.ghost && turn.status !== 'away') {
      if (turn.correctOn) {
        t.ghostCorrect += 1;
        t.streak += 1;
        if (t.streak >= RULES.reviveStreak) {
          t.ghost = false;
          t.streak = 0;
          t.revivedAt = ++s.seq;
          ctx.cue({ host: 'chochin', event: 'train_revive', slots: { name: p.name } });
        }
      } else t.streak = 0;
    }
    // Show what they actually said: the correct attempt, else the last one with words in it.
    const final = turn.correctOn ? turn.attempts[turn.correctOn - 1] : ([...turn.attempts].reverse().find((a) => a.text) ?? turn.attempts.at(-1));
    rows.push({
      playerId: p.id,
      name: p.name,
      prompt: item.prompt,
      said: final?.text ?? null,
      via: final?.via ?? null,
      outcome: turn.status === 'away' ? 'away' : turn.correctOn === 0 ? 'missed' : final?.overruled ? 'overruled' : turn.correctOn === 1 ? 'first' : 'retry',
      model: item.model,
      points,
      ghost: turn.ghostAtStart,
    });
  }
  s.results = rows;
}

function penaltyCandidates(s: LastTrainState): string[] {
  return Object.values(s.turns)
    .filter((t) => t.status === 'missed' && !traveller(s, t.playerId).ghost && !t.ghostAtStart)
    .map((t) => t.playerId);
}

function afterStop(s: LastTrainState): Phase {
  return s.stopIndex + 1 < s.stops.length ? 'prompt' : 'finale';
}

// ---- the mode ----

export const lastTrainMode: Mode<LastTrainState, LastTrainView> = {
  info: {
    id: 'last-train',
    title: 'Last Train',
    titleJa: '終電',
    blurb: 'Race for the last train: answer every stop out loud, or become a ghost.',
    host: 'chochin',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [...RULES.stopChoices],
    usesPack: false,
    phrasebookTitle: 'Your travel survival kit',
  },

  setup(ctx, opts) {
    const want = Math.min(6, Math.max(4, opts.rounds ?? 4));
    const { minigames, penaltyIds } = resolveLibrary(ctx);
    const scenario = chooseScenario(ctx, want, minigames);
    const stops = buildStops(scenario, want, minigames, penaltyIds, () => ctx.random());
    const dashPool = scenario.platformDash.length ? scenario.platformDash : FALLBACK_SCENARIO.platformDash;
    const s: LastTrainState = {
      scenario: { id: scenario.id, title: scenario.title, departure: scenario.departure, twist: scenario.twist },
      stops,
      stopIndex: -1,
      minigames,
      penaltyIds,
      dashPool,
      used: [],
      travellers: {},
      turns: {},
      penalties: {},
      windows: [],
      haunts: [],
      results: null,
      echoes: {},
      racers: {},
      finishers: [],
      dashResults: null,
      ledger: [],
      overruleLog: [],
      rejects: 0,
      seq: 0,
    };
    for (const p of ctx.players()) traveller(s, p.id);
    return s;
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return s.stops.length ? 'prompt' : 'finale';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return penaltyCandidates(s).length ? 'penalty' : afterStop(s);
      case 'penalty':
        return afterStop(s);
      case 'finale':
        return 'score';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        ctx.cue({
          host: 'chochin',
          event: 'train_departure',
          slots: { title: s.scenario.title.text, stops: s.stops.map((x) => x.name.text).join('、') },
          prompt: s.scenario.departure,
        });
        break;
      case 'prompt': {
        s.stopIndex += 1;
        s.turns = {};
        s.penalties = {};
        s.windows = [];
        s.haunts = [];
        s.results = null;
        s.echoes = {};
        for (const t of Object.values(s.travellers)) t.hauntedThisStop = false;
        const stop = s.stops[s.stopIndex]!;
        ctx.cue({ host: 'chochin', event: 'train_stop', slots: { stop: stop.name.text }, prompt: stop.announcement });
        if (s.stopIndex === s.stops.length - 1) ctx.cue({ host: 'chochin', event: 'train_last_stop_twist', prompt: s.scenario.twist });
        break;
      }
      case 'answer':
        startTurns(s, ctx);
        break;
      case 'reveal': {
        const rows = s.results ?? [];
        const played = rows.filter((r) => r.outcome !== 'away');
        const right = played.filter((r) => r.outcome !== 'missed').length;
        const tier = played.length && right === played.length ? 'ippon' : right * 2 >= played.length ? 'good' : 'flop';
        ctx.cue({ host: 'chochin', event: 'reveal_react', tier });
        break;
      }
      case 'penalty': {
        s.windows = [];
        for (const id of penaltyCandidates(s)) {
          const mgId = pick(s.penaltyIds, () => ctx.random());
          const mg = mgId ? s.minigames[mgId] : undefined;
          const level = ctx.player(id)?.level ?? 'n5';
          const item = mg ? dealItem(s, mg.items, mg.id, level, () => ctx.random()) : undefined;
          if (!mg || !item) continue;
          s.penalties[id] = { playerId: id, task: makeTask(s, 'penalty', mg, item, 1, traveller(s, id), ctx.now), status: 'answering', attempt: null };
        }
        ctx.cue({ host: 'chochin', event: 'miss_kind', slots: { name: Object.keys(s.penalties).map((id) => nameOf(ctx, id)).join('、') } });
        break;
      }
      case 'finale':
        s.windows = [];
        s.haunts = [];
        s.results = null;
        s.racers = {};
        s.finishers = [];
        for (const p of ctx.players()) {
          const ghost = traveller(s, p.id).ghost;
          const r: Racer = { playerId: p.id, pos: ghost ? -RULES.ghostStartBack : 0, ghost, aboard: null, task: null, n: 0, queue: [] };
          s.racers[p.id] = r;
          nextDashTask(s, ctx, r);
        }
        ctx.cue({ host: 'chochin', event: 'platform_dash' });
        break;
      default:
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'answer') {
      sweep(s, phase, ctx, null, true);
      scoreStop(s, ctx);
    }
    if (phase === 'penalty') {
      sweep(s, phase, ctx, null, true);
      const ghosted: string[] = [];
      for (const pt of Object.values(s.penalties)) {
        ctx.phrase(pt.playerId, phraseOf(pt.task.item, pt.status === 'passed' ? 'said' : 'missed'));
        if (pt.status !== 'passed') {
          const t = traveller(s, pt.playerId);
          t.ghost = true;
          t.streak = 0;
          ghosted.push(nameOf(ctx, pt.playerId));
        }
      }
      for (const name of ghosted) ctx.cue({ host: 'chochin', event: 'train_ghost', slots: { name } });
    }
    if (phase === 'finale') {
      const rows: DashResult[] = [];
      for (const p of ctx.players()) {
        const r = s.racers[p.id];
        if (!r) continue;
        const rank = r.aboard;
        const points = rank !== null ? (RULES.dashPoints[rank - 1] ?? RULES.dashPointsAboard) : Math.max(0, r.pos) * RULES.dashPointsPerStep;
        if (points > 0) {
          ctx.award(p.id, points);
          s.ledger.push({ playerId: p.id, points, reason: 'dash', stop: s.stops.length });
        }
        rows.push({ playerId: p.id, name: p.name, rank, pos: r.pos, points });
        r.task = null;
      }
      rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.pos - a.pos);
      s.dashResults = rows;
    }
  },

  duration(s, phase) {
    if (phase === 'answer') {
      const longest = Math.max(0, ...Object.values(s.turns).map((t) => t.task.limitMs));
      return Math.min(90_000, Math.max(20_000, longest * 2 + RULES.overruleMs + 4_000));
    }
    if (phase === 'penalty') {
      const longest = Math.max(0, ...Object.values(s.penalties).map((t) => t.task.limitMs));
      return Math.min(45_000, Math.max(12_000, longest + RULES.overruleMs + 4_000));
    }
    return DURATIONS[phase] ?? 5_000;
  },

  done(s, phase, ctx) {
    const openWindows = s.windows.some((w) => w.state === 'open' && ctx.now < w.closesAt);
    if (phase === 'answer') {
      const turns = Object.values(s.turns);
      if (!turns.length) return true;
      const resolved = turns.every((t) => t.status === 'correct' || t.status === 'missed' || t.status === 'away' || !isConnected(ctx, t.playerId));
      return resolved && !openWindows && ctx.connected().length > 0;
    }
    if (phase === 'penalty') {
      const rows = Object.values(s.penalties);
      return rows.every((p) => p.status !== 'answering' || !isConnected(ctx, p.playerId)) && !openWindows;
    }
    if (phase === 'finale') {
      const here = ctx.connected().filter((p) => s.racers[p.id]);
      return here.length > 0 && here.every((p) => s.racers[p.id]!.aboard !== null);
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx): MoveResult {
    if (!isObject(raw) || typeof raw.kind !== 'string') return moveError('bad-move');
    if (!ctx.player(playerId)) return moveError('not-allowed');
    const inStop = phase === 'prompt' || phase === 'answer' || phase === 'reveal' || phase === 'penalty';
    // Only a tick claims "my time is up"; answers are judged against the deadline plus grace.
    if (phase === 'answer' || phase === 'penalty' || phase === 'finale') sweep(s, phase, ctx, raw.kind === 'tick' ? playerId : null);

    switch (raw.kind) {
      case 'tick':
        // Lazy expiry already ran above. Always fine, even when nothing was due.
        return MOVE_OK;

      case 'answer':
      case 'pass': {
        if (typeof raw.key !== 'string') return moveError('bad-move');
        let u: Utterance | null = null;
        if (raw.kind === 'answer') {
          u = readUtterance(raw.utterance);
          if (!u) return moveError('empty-answer');
        }
        if (phase === 'answer') {
          const turn = s.turns[playerId];
          if (!turn) return moveError('not-playing');
          if (turn.status !== 'answering' && turn.status !== 'retry') {
            // Only a task the player has an attempt on is "already answered". A retry the room's overrule made
            // moot (the first try now counts) is a stale move, like any other that lands after its moment.
            const tried = turn.task.key === raw.key && turn.attempts.length >= turn.task.attempt;
            return moveError(tried ? 'already-answered' : 'wrong-phase');
          }
          if (turn.task.key !== raw.key) return moveError('wrong-phase');
          const ok = !!u && checkUtterance(u, turn.task.item.accepted, isParticle(turn.task));
          const rec: AttemptRec = { via: u?.via ?? null, text: u?.text ?? null, ok, overruled: false, timedOut: false };
          if (ok) {
            turn.attempts.push(rec);
            turn.status = 'correct';
            turn.correctOn = turn.task.attempt;
          } else recordStopMiss(s, ctx, turn, rec);
          return MOVE_OK;
        }
        if (phase === 'penalty') {
          const pt = s.penalties[playerId];
          if (!pt) return moveError('not-in-penalty');
          if (pt.task.key !== raw.key) return moveError('wrong-phase');
          if (pt.status !== 'answering') return moveError('already-answered');
          const ok = !!u && checkUtterance(u, pt.task.item.accepted, isParticle(pt.task));
          const rec: AttemptRec = { via: u?.via ?? null, text: u?.text ?? null, ok, overruled: false, timedOut: false };
          if (ok) {
            pt.attempt = rec;
            pt.status = 'passed';
          } else recordPenaltyMiss(s, ctx, pt, rec);
          return MOVE_OK;
        }
        if (phase === 'finale') {
          const r = s.racers[playerId];
          if (!r) return moveError('not-playing');
          if (!r.task || r.task.key !== raw.key) return moveError('wrong-phase');
          const item = r.task.item;
          const ok = !!u && checkUtterance(u, item.accepted, false);
          ctx.phrase(playerId, phraseOf(item, ok ? 'said' : 'missed'));
          if (ok) {
            r.pos += 1;
            if (r.pos >= RULES.dashTrack) {
              s.finishers.push(playerId);
              r.aboard = s.finishers.length;
            }
          }
          nextDashTask(s, ctx, r);
          return MOVE_OK;
        }
        return moveError('wrong-phase');
      }

      case 'overrule': {
        if (phase !== 'answer' && phase !== 'penalty') return moveError('wrong-phase');
        if (typeof raw.windowId !== 'string' || typeof raw.up !== 'boolean') return moveError('bad-move');
        const w = s.windows.find((x) => x.id === raw.windowId);
        if (!w) {
          // A window from an earlier phase (the stop moved on) is a race; anything else is bogus.
          const n = /^ov(\d+)$/.exec(raw.windowId);
          return n && Number(n[1]) <= s.seq ? moveError('wrong-phase') : moveError('unknown-window');
        }
        if (w.playerId === playerId) return moveError('own-answer');
        if (!w.eligible.includes(playerId)) return moveError('not-eligible');
        // A window that just closed (majority reached, time up) is a harmless race.
        if (w.state !== 'open') return moveError('wrong-phase');
        if (w.votes[playerId] !== undefined) return moveError('already-voted');
        w.votes[playerId] = raw.up;
        evaluate(s, ctx, w, false);
        return MOVE_OK;
      }

      case 'haunt': {
        if (!inStop) return moveError('wrong-phase');
        if (typeof raw.targetId !== 'string') return moveError('bad-move');
        const me = traveller(s, playerId);
        if (!me.ghost) return moveError('not-a-ghost');
        if (me.hauntedThisStop) return moveError('already-haunted');
        const target = s.travellers[raw.targetId];
        if (!target || raw.targetId === playerId || !ctx.player(raw.targetId)) return moveError('unknown-player');
        if (target.ghost) return moveError('target-is-ghost');
        target.pendingShaveMs += RULES.hauntMs;
        me.hauntedThisStop = true;
        me.haunts += 1;
        s.haunts.push({ by: playerId, target: raw.targetId });
        return MOVE_OK;
      }

      case 'echo': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        const turn = s.turns[playerId];
        if (!turn || turn.correctOn !== 0 || turn.status === 'away') return moveError('nothing-to-echo');
        if (s.echoes[playerId]) return moveError('already-answered');
        const u = readUtterance(raw.utterance);
        if (!u) return moveError('empty-answer');
        const item = turn.task.item;
        s.echoes[playerId] = { text: u.text, ok: checkUtterance(u, [item.model.kana, ...item.accepted], isParticle(turn.task)) };
        return MOVE_OK;
      }

      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId, ctx) {
    delete s.travellers[playerId];
    delete s.turns[playerId];
    delete s.penalties[playerId];
    delete s.racers[playerId];
    s.windows = s.windows.filter((w) => w.playerId !== playerId);
    for (const w of s.windows) {
      w.eligible = w.eligible.filter((id) => id !== playerId);
      delete w.votes[playerId];
      if (!w.eligible.length && w.state === 'open') w.state = 'upheld';
      else evaluate(s, ctx, w, false);
    }
    s.haunts = s.haunts.filter((h) => h.by !== playerId && h.target !== playerId);
  },

  progress(s) {
    return { round: Math.min(s.stops.length, Math.max(0, s.stopIndex + 1)), totalRounds: s.stops.length };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const players = ctx.players();
    const stop = s.stopIndex >= 0 && phase !== 'finale' && phase !== 'score' ? s.stops[s.stopIndex] : undefined;
    const mg = stop ? s.minigames[stop.minigameId] : undefined;
    const isLast = s.stopIndex === s.stops.length - 1;
    const stopResolved = phase === 'reveal' || phase === 'penalty';
    const me = viewer.kind === 'player' ? viewer.playerId : null;

    const statusOf = (id: string): TravellerStatus => {
      if (phase === 'finale' || phase === 'score') return s.racers[id]?.aboard != null ? 'aboard' : 'racing';
      if (phase === 'penalty' && s.penalties[id]) {
        const pt = s.penalties[id]!;
        // Not settled while the room may still overrule it.
        const voting = s.windows.some((w) => w.scope === 'penalty' && w.playerId === id && w.state === 'open');
        return pt.status === 'answering' || voting ? 'penalty' : pt.status;
      }
      const turn = s.turns[id];
      if ((phase === 'answer' || phase === 'reveal' || phase === 'penalty') && turn) return turn.status;
      return 'waiting';
    };

    const travellers: TravellerView[] = players.map((p) => {
      const t = s.travellers[p.id];
      return { playerId: p.id, name: p.name, ghost: t?.ghost ?? false, status: statusOf(p.id), streak: t?.streak ?? 0, shaveS: Math.round((t?.pendingShaveMs ?? 0) / 1000) };
    });

    const overrules: OverruleView[] =
      phase === 'answer' || phase === 'penalty'
        ? s.windows.map((w) => {
            const { up, down } = tally(w);
            const base: OverruleView = { id: w.id, playerId: w.playerId, name: nameOf(ctx, w.playerId), scope: w.scope, up, down, eligible: w.eligible.length, state: w.state };
            if (me && me === w.playerId) return { ...base, mine: true };
            if (me && w.eligible.includes(me)) return { ...base, heard: w.heard, prompt: w.prompt, canVote: w.state === 'open' && w.votes[me] === undefined, myVote: w.votes[me] ?? null };
            return base;
          })
        : [];

    const penalty: LastTrainView['penalty'] =
      phase === 'penalty'
        ? {
            minigames: [...new Set(Object.values(s.penalties).map((p) => p.task.minigameId))].map((id) => s.minigames[id]!.title),
            rows: Object.values(s.penalties).map((pt) => {
              const settled = pt.status !== 'answering' && !s.windows.some((w) => w.scope === 'penalty' && w.playerId === pt.playerId && w.state === 'open');
              return { playerId: pt.playerId, name: nameOf(ctx, pt.playerId), status: settled ? pt.status : 'answering', said: settled ? (pt.attempt?.text ?? null) : null, model: settled ? pt.task.item.model : null };
            }),
          }
        : null;

    const dash: LastTrainView['dash'] =
      phase === 'finale' || phase === 'score'
        ? {
            track: RULES.dashTrack,
            ghostStart: -RULES.ghostStartBack,
            racers: players.filter((p) => s.racers[p.id]).map((p) => ({ playerId: p.id, name: p.name, pos: s.racers[p.id]!.pos, ghost: s.racers[p.id]!.ghost, aboard: s.racers[p.id]!.aboard })),
            results: phase === 'score' ? s.dashResults : null,
          }
        : null;

    let mine: LastTrainMe | null = null;
    if (me) {
      const t = s.travellers[me];
      const level = ctx.player(me)?.level ?? 'n5';
      let task: Task | null = null;
      let lastHeard: string | null = null;
      if (phase === 'answer') {
        const turn = s.turns[me];
        if (turn && (turn.status === 'answering' || turn.status === 'retry')) {
          task = turn.task;
          lastHeard = turn.attempts.at(-1)?.text ?? null;
        }
      } else if (phase === 'penalty') {
        const pt = s.penalties[me];
        if (pt && pt.status === 'answering') task = pt.task;
      } else if (phase === 'finale') task = s.racers[me]?.task ?? null;
      const turn = s.turns[me];
      const result = stopResolved ? (s.results?.find((r) => r.playerId === me) ?? null) : null;
      const ghost = t?.ghost ?? false;
      mine = {
        ghost,
        streak: t?.streak ?? 0,
        status: statusOf(me),
        task: task ? taskView(s, task, level, lastHeard) : null,
        canHaunt: inStopPhase(phase) && ghost && !(t?.hauntedThisStop ?? true),
        hauntTargets: inStopPhase(phase) && ghost ? players.filter((p) => p.id !== me && s.travellers[p.id] && !s.travellers[p.id]!.ghost).map((p) => ({ playerId: p.id, name: p.name })) : [],
        shaveS: Math.round((t?.pendingShaveMs ?? 0) / 1000),
        result,
        canEcho: phase === 'reveal' && !!turn && turn.correctOn === 0 && turn.status !== 'away' && !s.echoes[me],
        echo: phase === 'reveal' ? (s.echoes[me] ?? null) : null,
        inPenalty: phase === 'penalty' && !!s.penalties[me],
        dash: s.racers[me] && (phase === 'finale' || phase === 'score') ? { pos: s.racers[me]!.pos, aboard: s.racers[me]!.aboard } : null,
        level,
      };
    }

    return {
      mode: 'last-train',
      title: s.scenario.title,
      departure: s.scenario.departure,
      twist: (isLast && phase !== 'intro') || phase === 'finale' || phase === 'score' ? s.scenario.twist : null,
      stops: s.stops.map((x) => ({ name: x.name, minigame: s.minigames[x.minigameId]?.title ?? x.name })),
      stopIndex: s.stopIndex,
      stop:
        stop && mg
          ? { index: s.stopIndex, name: stop.name, announcement: stop.announcement, minigame: { id: mg.id, title: mg.title, intro: mg.intro, topic: mg.topic, promptType: mg.promptType }, isLast }
          : null,
      travellers,
      overrules,
      haunts: inStopPhase(phase) ? s.haunts : [],
      results: stopResolved ? s.results : null,
      penalty,
      dash,
      ledger: s.ledger,
      overruled: s.overruleLog.length,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const bank = ctx.content.hostAwards.filter((a) => a.host === 'chochin');
    const give = (id: string, playerId: string | undefined, fallback: { text: string; en: string }) => {
      if (!playerId || !ctx.player(playerId)) return;
      const a: HostAward | undefined = bank.find((x) => x.id === `chochin.award.${id}`);
      out.push({ playerId, name: nameOf(ctx, playerId), title: a?.name.text ?? fallback.text, en: a?.name.en ?? fallback.en });
    };
    give('first-aboard', s.finishers[0], { text: 'いちばんのり', en: 'First Aboard' });
    const racers = Object.keys(s.racers).length;
    if (s.finishers.length >= 2 && s.finishers.length === racers) give('last-aboard', s.finishers.at(-1), { text: 'さいごの ごじょうしゃ', en: 'Last One Aboard' });
    const ts = Object.values(s.travellers);
    const bestGhost = [...ts].filter((t) => t.ghostCorrect > 0).sort((a, b) => b.ghostCorrect - a.ghostCorrect)[0];
    give('best-ghost', bestGhost?.playerId, { text: 'ベスト ゆうれい', en: 'Best Ghost' });
    const revived = [...ts].filter((t) => t.revivedAt > 0).sort((a, b) => b.revivedAt - a.revivedAt)[0];
    give('welcome-back', revived?.playerId, { text: 'おかえりなさいしょう', en: 'Welcome Back' });
    for (const t of ts) if (t.stopsPlayed === s.stops.length && s.stops.length > 0 && t.misses === 0) give('no-miss', t.playerId, { text: 'ノーミス じょうきゃく', en: 'Perfect Passenger' });
    return out;
  },
};

function inStopPhase(phase: Phase): boolean {
  return phase === 'prompt' || phase === 'answer' || phase === 'reveal' || phase === 'penalty';
}

function taskView(s: LastTrainState, task: Task, level: Level, lastHeard: string | null): TaskView {
  const retry = task.attempt === 2;
  const kanaHelp = level === 'kana';
  return {
    key: task.key,
    kind: task.kind,
    itemId: task.item.id,
    minigame: task.kind === 'dash' ? null : (s.minigames[task.minigameId]?.title ?? null),
    promptType: task.promptType,
    prompt: task.item.prompt,
    visual: task.item.visual ?? null,
    limitMs: task.limitMs,
    attempt: task.attempt,
    hint: retry ? task.item.hint : null,
    romaji: kanaHelp ? toRomaji(task.item.prompt.kana) : null,
    firstKana: kanaHelp && retry ? `${firstMora(task.item.accepted[0] ?? task.item.model.kana)} (${toRomaji(firstMora(task.item.accepted[0] ?? task.item.model.kana))})` : null,
    listen: task.promptType === 'listen-and-answer',
    lastHeard: retry ? lastHeard : null,
  };
}

/** Every item the mode could deal, by id, so a bot can look up its own answers (tests and bots only). */
export function itemIndex(content: { lastTrainMinigames: readonly LastTrainMinigame[]; lastTrainScenarios: readonly LastTrainScenario[] }): Map<string, MinigameItem> {
  const map = new Map<string, MinigameItem>();
  const add = (i: MinigameItem) => map.set(i.id, i);
  for (const m of [...FALLBACK_MINIGAMES, ...content.lastTrainMinigames]) m.items.forEach(add);
  for (const sc of [FALLBACK_SCENARIO, ...content.lastTrainScenarios]) sc.platformDash.forEach(add);
  return map;
}
