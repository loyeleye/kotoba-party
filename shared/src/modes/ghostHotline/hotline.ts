// Ghost Advice Hotline (おばけの おなやみ相談室): Nobiko-san's late-night advice line. Each call, one player
// is a yōkai with a problem, and only they see the secret of what would really help. Up to three advisers
// record their advice at the same time; it plays in a random order and the caller answers each with
// ちがう！ / おしい！ / それだ！. Then the secret is shown, the room votes for the funniest advice, and the
// replay booth credits one grammar chunk. See docs/modes/ghost-hotline.md.
//
// A call, by phase (each stepped by `wake` where it has beats):
//   prompt  ring (6 s: the caller says the problem at their level; everyone's phone gets the gist) → plan
//           (8 s: speaking advisers plan their mission, a Kana adviser picks one of four tiles, the gallery
//           bets on the cure; ends when every adviser is ready).
//   answer  record: every speaking adviser at once (N5 and N4 9 s, then time for the clip to upload).
//   reveal  for each piece of advice, in a random order: play (the clip, the tile or Nobiko-san reading it;
//           the TV shows only who is talking) → react (3 s after it ends: the caller's ちがう / おしい / それだ,
//           then the words and the picture appear) … → secret (4 s: the secret card flips over).
//   encore  vote (6 s): which advice made you laugh? Never your own. Skipped with two players.
//   score   points (4 s: tally, top laugh, points) → booth (7 s, only when an adviser's own words used a
//           chunk: the line, the chunk lit, one line of colour, the train-line tag).
//
// Two players: a scripted yōkai calls and both advise; the game judges the advice by what it heard.
// Every move echoes `round`; one for an earlier call is a harmless `wrong-phase` race.

import { atLevel, type JpText, type Level } from '../../../../content/src/types.js';
import { isUtterance, normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import type { Audience, Phase } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { ADVICE, adviceOf, betTilesOf, CHUNKS, kanaTilesOf, problemOf, problemsFor, ROMAJI, type AdviceChunk, type AdviceLine, type Problem } from './problems.js';
import { LEVEL_RANK, n4Up } from '../../level.js';

// ---- tuning ----

export const MIN_CALLS = 5;
export const MAX_ADVISERS = 3;
export const RING_MS = 6_000;
/**
 * The ring beat when a player calls: long enough for Nobiko-san's ring line, a take of the caller's line
 * (8 s on the phone) and its upload. It closes before the advisers record, so the caller's voice never
 * gets into their clips.
 */
export const SAY_RING_MS: Record<Level, number> = { kana: 8_000, n5: 11_000, n4: 12_000, n3: 12_000 };
export const PLAN_MS = 8_000;
/** How long a speaking adviser may record, by level (Kana advisers pick a tile). N3 gets 12 s. */
export const RECORD_MS: Record<Level, number> = { kana: 0, n5: 9_000, n4: 9_000, n3: 12_000 };
/** After the record limit: time for the clips to upload. */
export const UPLOAD_MS = 3_500;
export const GRACE_MS = 1_500;
export const MIN_CLIP_MS = 300;
/** A Kana tile on the TV, a typed line, Nobiko-san reading one. */
export const TILE_PLAY_MS = 2_000;
export const TYPED_PLAY_MS = 4_000;
export const NOBIKO_PLAY_MS = 4_500;
export const PLAY_TAIL_MS = 500;
/** The caller's reaction locks this long after the advice ends. */
/** The caller may react until 3 s after the clip ends; the beat runs a little longer, so a last-second tap still gets
 *  its words-and-picture reveal (0.65 s on the TV) before the next clip starts. */
export const REACT_LOCK_MS = 3_000;
export const REACT_MS = REACT_LOCK_MS + 700;
export const SECRET_MS = 4_000;
export const VOTE_MS = 6_000;
export const SCORE_MS = 4_000;
export const BOOTH_MS = 7_000;
export const DURATIONS = { intro: 12_000 } as const;

export const POINTS = {
  /** To an adviser the caller answered それだ！ (more than one can get it). */
  soreda: 200,
  /** To an adviser the caller answered おしい！. */
  oshii: 50,
  /** Per laugh vote. */
  laugh: 50,
  /** Every vote to one adviser, with three voters or more (大ウケ！). */
  sweep: 100,
  /** The gallery, for betting on the cure. */
  bet: 20,
  /** The caller, for saying the problem out loud (a try counts). */
  line: 50,
  /** A speaking adviser whose own clip counted as said: speaking pays more than typing or a tap. */
  spoke: 50,
} as const;

export type Reaction = 'chigau' | 'oshii' | 'soreda';
export type Role = 'caller' | 'adviser' | 'gallery';
export type AdviceKind = 'clip' | 'tile' | 'typed' | 'nobiko';
export type Step = 'ring' | 'plan' | 'record' | 'play' | 'react' | 'secret' | 'vote' | 'points' | 'booth';

export interface Advice {
  playerId: string;
  level: Level;
  kind: AdviceKind;
  clipId: string | null;
  /** The clip stays on the adviser's phone, which plays it itself. */
  local: boolean;
  durMs: number;
  /** Kana adviser: the advice tile picked. */
  tile: string | null;
  /** Typed advice (quiet mode, or no mic). */
  text: string | null;
  heard: Utterance | null;
  /** The server had speech-to-text for the clip. */
  checked: boolean;
  /** Nobiko-san read it: a mic pass (half points), or a free read when the mic is blocked. */
  pass: boolean;
  /** A free read (the mic is blocked): it keeps the adviser in the call, but earns no reaction points. */
  free?: boolean;
}

export interface LedgerEntry {
  round: number;
  playerId: string;
  points: number;
  why: 'soreda' | 'oshii' | 'laugh' | 'sweep' | 'bet' | 'line' | 'spoke';
}

export interface Call {
  index: number;
  problemId: string;
  /** Null: a scripted yōkai calls (two players). */
  caller: string | null;
  advisers: string[];
  gallery: string[];
  /** The caller said the problem out loud (a clip came in). */
  callerSaid: boolean;
  callerClip: string | null;
  /** The caller started a take: Nobiko-san doesn't read over it while it uploads. */
  callerTaking: boolean;
  /** This call's ring beat (see SAY_RING_MS). */
  ringMs: number;
  /** Speaking advisers who pressed Ready in the plan beat. */
  ready: string[];
  hinted: string[];
  /** Kana advisers' tile pick (it sends when the plan ends; tapping another changes it). */
  picks: Record<string, string>;
  advice: Record<string, Advice>;
  /** The advice in play order: shuffled when the record beat ends. */
  order: string[];
  /** Index into `order` during the reveal. */
  at: number;
  reactions: Record<string, Reaction>;
  /** Reactions the game made (a Kana tile, a scripted caller, or the caller didn't tap). */
  auto: string[];
  bets: Record<string, string>;
  votes: Record<string, string>;
  /** The VIP hid this advice: it's skipped and earns nothing. */
  hidden: string[];
  /** The order the four tiles show in, for each Kana adviser and the gallery (index into kanaTilesOf / betTilesOf). */
  shuffle: Record<string, number[]>;
  step: Step;
  stepAt: number;
  booth: { playerId: string; chunk: string; line: string } | null;
  settled: boolean;
}

export interface PlayerStats {
  soreda: number;
  laughs: number;
  bets: number;
  calls: number;
  advised: number;
}

export interface HotlineState {
  round: number;
  totalRounds: number;
  audience: Audience;
  order: string[];
  calls: Call[];
  micPassUsed: Record<string, boolean>;
  ledger: LedgerEntry[];
  stats: Record<string, PlayerStats>;
  /** Two players: a scripted yōkai calls, both advise, and there's no laugh vote. */
  scripted: boolean;
  phaseAt: number;
}

// ---- view ----

export interface TileView {
  id: string;
  word: JpText;
  picture: string;
  emoji: string;
  romaji?: string;
  /** The absurd curveball among a Kana adviser's four (a leaf badge on the phone). */
  curve?: boolean;
}

export interface AdviceRow {
  playerId: string;
  level: Level;
  kind: AdviceKind;
  pass: boolean;
  /** Null until the caller has reacted (or it locked). */
  reaction: Reaction | null;
  /** The game made the reaction. */
  auto: boolean;
  /** What was said, as heard (untrusted player text), once reacted. */
  subtitle: string | null;
  /** The advice as a picture, once reacted: the tile it matched, if any. */
  tile: TileView | null;
  /** The VIP hid it. */
  hidden: boolean;
}

export interface HotlineView {
  mode: 'ghost-hotline';
  round: number;
  totalRounds: number;
  phaseAt: number;
  step: Step | null;
  stepAt: number;
  scripted: boolean;
  /** The caller and the problem, as said at the caller's level (kanji with a kana reading for furigana). */
  call: { caller: string | null; who: { name: JpText; picture: string; emoji: string }; line: JpText; said: boolean } | null;
  cast: { caller: string | null; advisers: string[]; gallery: string[] } | null;
  /** Lock-ins for the seat chips: who is in, never what they chose. */
  locked: { ready: string[]; sent: string[]; bets: string[]; votes: string[] };
  /** The advice playing now, and (with `reacting`) through its react beat. */
  /** text: typed advice, shown while it plays (it has no sound, so the caller reads it to judge it). */
  play: { index: number; total: number; playerId: string; kind: AdviceKind; clipId: string | null; local: boolean; durMs: number; at: number; tile: TileView | null; text: string | null; pass: boolean; hidden: boolean; reacting: boolean } | null;
  /** Players who may vote in the laugh vote now. */
  voters: number;
  /** Advice already played, in play order. */
  rows: AdviceRow[];
  /** From the secret beat. fair: every それだ！ went to advice the game heard naming the cure (null: it couldn't tell). */
  secret: { text: JpText; cure: TileView; fair: boolean | null } | null;
  /** From the score beat. */
  tally: { votes: Record<string, number>; top: string | null; sweep: string | null; points: { playerId: string; points: number }[] } | null;
  booth: { playerId: string; line: string; chunk: string; note: string; tag: string; level: 'n5' | 'n4' | 'n3' } | null;
  ledger: LedgerEntry[];
  me: HotlineMe | null;
}

export interface HotlineMe {
  role: Role | null;
  level: Level;
  /** The caller's secret: only they see it, until the secret beat. */
  secret: JpText | null;
  /** The caller's cure as a tile (picture, kana, romaji for Kana, English): what to listen for. */
  cure: TileView | null;
  /** The caller's line at their level, and whether they may still say it. */
  callerLine: (JpText & { romaji?: string }) | null;
  canSay: boolean;
  said: boolean;
  /** The problem's gist (every phone, once the call rings in). */
  gist: (JpText & { romaji?: string }) | null;
  /** A speaking adviser's mission; model and frame sit behind "Need a hint?". */
  mission: { text: string; model: JpText & { romaji?: string }; frame?: JpText & { romaji?: string } } | null;
  /** A Kana adviser's four tiles (this phone's order), and the pick. */
  tiles: TileView[];
  pick: string | null;
  ready: boolean;
  sent: boolean;
  limitMs: number;
  canRecord: boolean;
  canType: boolean;
  micPassLeft: boolean;
  /** The gallery's four bet pictures, and the bet (locks when the call's recording starts). */
  betTiles: TileView[];
  bet: string | null;
  lockedIn: boolean;
  /** The caller, during the reveal: the advice to react to now. */
  react: { index: number; playerId: string; canReact: boolean; picked: Reaction | null; auto: boolean } | null;
  /** The laugh vote: every adviser but me. */
  voteOptions: { playerId: string; tile: TileView | null; subtitle: string | null }[];
  vote: string | null;
  canVote: boolean;
  points: number | null;
  breakdown: { why: LedgerEntry['why']; points: number }[];
  /** A speaking adviser's private note at the score: Nobiko-san's way, what was said, the chunk if used. */
  /** credit: what the phrasebook logged for their line (see creditOf). */
  note: { model: JpText; said: string | null; hinted: boolean; chunk: string | null; credit: Credit } | null;
}

export type HotlineMove =
  | { kind: 'taking'; round: number }
  | { kind: 'say'; round: number; clipId?: string | null; heard?: Utterance | null; checked?: boolean; local?: boolean }
  | { kind: 'ready'; round: number }
  | { kind: 'hint'; round: number }
  | { kind: 'pick'; round: number; tileId: string }
  | { kind: 'advice'; round: number; type: 'clip' | 'typed'; clipId?: string | null; local?: boolean; durMs?: number; heard?: Utterance | null; checked?: boolean; text?: string }
  | { kind: 'pass'; round: number; free?: boolean }
  | { kind: 'bet'; round: number; tileId: string }
  | { kind: 'react'; round: number; index: number; reaction: Reaction }
  | { kind: 'vote'; round: number; playerId: string }
  | { kind: 'hide'; round: number; playerId: string };

// ---- helpers ----

const blankStats = (): PlayerStats => ({ soreda: 0, laughs: 0, bets: 0, calls: 0, advised: 0 });
const statsOf = (s: HotlineState, id: string) => (s.stats[id] ??= blankStats());
export const current = (s: HotlineState): Call | null => s.calls[s.round - 1] ?? null;
const problemOfCall = (c: Call): Problem => problemOf(c.problemId)!;

/** Calls for `n` players: one each, at least five; three and four players get two laps so turns stay even. */
export function callsFor(n: number): number {
  if (n <= 2) return MIN_CALLS;
  if (n < MIN_CALLS) return n * 2;
  return n;
}

/** Does the reading contain any of these kana? Normalised readings, so keys never match across sounds merged at word boundaries. */
export function heardAny(reading: string, keys: readonly string[]): boolean {
  const said = normalizeReading(reading);
  return keys.some((k) => {
    const key = normalizeReading(k);
    return key.length > 0 && said.includes(key);
  });
}

/** A tile for the screens, with romaji for Kana phones. */
export function tileView(id: string, level: Level): TileView {
  const a = adviceOf(id);
  const word = a?.word ?? { text: id, kana: id, en: id };
  return { id, word, picture: a?.picture ?? id, emoji: a?.emoji ?? '💬', ...(level === 'kana' ? { romaji: ROMAJI[word.kana] ?? toRomaji(word.kana) } : {}) };
}

const withRomaji = (t: JpText, level: Level): JpText & { romaji?: string } => (level === 'kana' ? { ...t, romaji: ROMAJI[t.kana] ?? toRomaji(t.kana) } : t);

/** The level line a speaking adviser works from (Kana and N5 use N5's). */
export const lineOf = (p: Problem, level: Level): AdviceLine => (level === 'n3' && p.advice.n3 ? p.advice.n3 : n4Up(level) ? p.advice.n4 : p.advice.n5);

/** What an advice said, as a reading, for matching keys: null when nobody can tell (no speech-to-text). */
export function adviceReading(c: Call, a: Advice): string | null {
  const p = problemOfCall(c);
  switch (a.kind) {
    case 'tile':
      return a.tile ? (adviceOf(a.tile)?.word.kana ?? null) : null;
    case 'typed':
      return a.text;
    case 'nobiko':
      return lineOf(p, a.level).model.kana;
    case 'clip':
      return a.heard ? utteranceReading(a.heard) : null;
  }
}

/** The advice tile an advice names: a Kana tile, or the first of the call's tiles (then any tile) whose keys were heard. */
export function tileOfAdvice(c: Call, a: Advice): string | null {
  if (a.kind === 'tile') return a.tile;
  const p = problemOfCall(c);
  if (a.kind === 'nobiko') return p.cure;
  const reading = adviceReading(c, a);
  if (!reading) return null;
  const mine = [p.cure, p.near, ...p.decoys, p.curve];
  const all = [...mine, ...ADVICE.map((t) => t.id).filter((id) => !mine.includes(id))];
  return all.find((id) => heardAny(reading, adviceOf(id)?.keys ?? [])) ?? null;
}

/** How the game judges advice when the caller can't (a Kana tile, a scripted caller, or no tap in time). */
export function judge(c: Call, a: Advice): Reaction {
  const p = problemOfCall(c);
  if (a.kind === 'clip' && !a.checked) return 'oshii';
  const tile = tileOfAdvice(c, a);
  return tile === p.cure ? 'soreda' : tile === p.near ? 'oshii' : 'chigau';
}

/** The chunk an advice used, from its own words (never Nobiko-san's reading), highest level first. */
export function chunkOf(c: Call, a: Advice): AdviceChunk | null {
  if (a.kind !== 'clip' && a.kind !== 'typed') return null;
  if (a.level === 'kana' || c.hidden.includes(a.playerId)) return null;
  const reading = adviceReading(c, a);
  if (!reading) return null;
  return CHUNKS.find((k) => heardAny(reading, k.keys)) ?? null;
}

/**
 * What the path credits a speaking adviser's level line with. The line's frame is only credited when their own
 * clip used that level's chunk: naming the cure alone ("みずを") doesn't say ＿た ほうが いいです.
 *   memory: their clip used the chunk, no hint · hint: the same, after opening the hint
 *   unchecked: a clip with no speech-to-text (said, but not counted as from memory)
 *   seen: anything else (typed, Nobiko-san's reading, a clip without the chunk, hidden by the VIP)
 */
export type Credit = 'memory' | 'hint' | 'unchecked' | 'seen';
export function creditOf(c: Call, a: Advice): Credit {
  if (a.kind !== 'clip' || c.hidden.includes(a.playerId)) return 'seen';
  if (!a.checked) return 'unchecked';
  const k = chunkOf(c, a);
  if (!k || k.level !== a.level) return 'seen';
  return c.hinted.includes(a.playerId) ? 'hint' : 'memory';
}

/** The speaking bonus: their own clip, not hidden, that gave some advice or used a chunk (or couldn't be checked). */
export function spokeOf(c: Call, a: Advice): boolean {
  if (a.kind !== 'clip' || c.hidden.includes(a.playerId)) return false;
  return !a.checked || !!tileOfAdvice(c, a) || !!chunkOf(c, a);
}

/** Play time for one advice. */
export function playMs(a: Advice | undefined): number {
  if (!a) return NOBIKO_PLAY_MS;
  switch (a.kind) {
    case 'clip':
      return a.durMs + PLAY_TAIL_MS;
    case 'tile':
      return TILE_PLAY_MS;
    case 'typed':
      return TYPED_PLAY_MS;
    case 'nobiko':
      return NOBIKO_PLAY_MS;
  }
}

function pay(s: HotlineState, ctx: ModeContext, playerId: string, points: number, why: LedgerEntry['why']): void {
  if (!points || !ctx.player(playerId)) return;
  ctx.award(playerId, points);
  s.ledger.push({ round: s.round, playerId, points, why });
}

const isSpeaker = (ctx: ModeContext, id: string): boolean => (ctx.player(id)?.level ?? 'n5') !== 'kana';
const blankAdvice = (playerId: string, level: Level, kind: AdviceKind, extra: Partial<Advice> = {}): Advice => ({ playerId, level, kind, clipId: null, local: false, durMs: 0, tile: null, text: null, heard: null, checked: false, pass: false, ...extra });

function parseHeard(raw: unknown): Utterance | null {
  if (raw === null || raw === undefined || !isUtterance(raw) || raw.via !== 'speech') return null;
  return { via: 'speech', text: raw.text.slice(0, 160), ...(raw.reading !== undefined ? { reading: String(raw.reading).slice(0, 320) } : {}) };
}

/** Deals this call's roles: the caller has called least (seat order breaks ties), advisers have advised least. */
export function dealRoles(s: HotlineState, ctx: ModeContext): Pick<Call, 'caller' | 'advisers' | 'gallery'> {
  const here = new Set(ctx.connected().map((p) => p.id));
  const seated = s.order.filter((id) => ctx.player(id));
  const present = seated.filter((id) => here.has(id));
  const pool = present.length ? present : seated;
  if (s.scripted) return { caller: null, advisers: pool.slice(0, MAX_ADVISERS), gallery: pool.slice(MAX_ADVISERS) };
  const n = pool.length;
  const start = n ? (s.round - 1) % n : 0;
  const lap = [...pool.slice(start), ...pool.slice(0, start)];
  const calls = (id: string) => statsOf(s, id).calls;
  const fewest = Math.min(...lap.map(calls));
  const caller = lap.find((id) => calls(id) === fewest) ?? lap[0]!;
  const i = lap.indexOf(caller);
  const after = [...lap.slice(i + 1), ...lap.slice(0, i)];
  const advisers = [...after].sort((a, b) => statsOf(s, a).advised - statsOf(s, b).advised || after.indexOf(a) - after.indexOf(b)).slice(0, MAX_ADVISERS);
  return { caller, advisers, gallery: after.filter((id) => !advisers.includes(id)) };
}

function startCall(s: HotlineState, ctx: ModeContext): Call {
  s.round += 1;
  const roles = dealRoles(s, ctx);
  const used = new Set(s.calls.map((c) => c.problemId));
  const all = problemsFor(s.audience);
  const fresh = all.filter((p) => !used.has(p.id));
  const pool = fresh.length ? fresh : all;
  const p = pool[Math.floor(ctx.random() * pool.length)]!;
  const shuffle: Record<string, number[]> = {};
  for (const id of [...roles.advisers, ...roles.gallery]) shuffle[id] = shuffled([0, 1, 2, 3], () => ctx.random());
  const c: Call = {
    index: s.round,
    problemId: p.id,
    ...roles,
    callerSaid: false,
    callerClip: null,
    callerTaking: false,
    ringMs: RING_MS,
    ready: [],
    hinted: [],
    picks: {},
    advice: {},
    order: [],
    at: 0,
    reactions: {},
    auto: [],
    bets: {},
    votes: {},
    hidden: [],
    shuffle,
    step: 'ring',
    stepAt: ctx.now,
    booth: null,
    settled: false,
  };
  s.calls.push(c);
  if (c.caller) statsOf(s, c.caller).calls += 1;
  for (const id of c.advisers) statsOf(s, id).advised += 1;
  return c;
}

/** When the plan ends, Kana advisers' picks go in as their advice. */
function lockPicks(c: Call, ctx: ModeContext): void {
  for (const id of c.advisers) {
    if (c.advice[id] || isSpeaker(ctx, id)) continue;
    const tile = c.picks[id];
    if (tile) c.advice[id] = blankAdvice(id, 'kana', 'tile', { tile });
  }
}

/** When the record beat ends: the advice that came in, in a random order. Advisers who sent nothing are skipped. */
function lockOrder(c: Call, ctx: ModeContext): void {
  lockPicks(c, ctx);
  c.order = shuffled(
    c.advisers.filter((id) => !!c.advice[id]),
    () => ctx.random(),
  );
  c.at = 0;
}

/** The game's reaction, where the caller didn't make one. */
function autoReact(c: Call, id: string): void {
  if (c.reactions[id]) return;
  const a = c.advice[id];
  if (!a) return;
  c.reactions[id] = judge(c, a);
  if (!c.auto.includes(id)) c.auto.push(id);
}

/** Kana tiles, Nobiko-san's reading for a scripted caller, and every reaction a scripted caller makes are the game's. */
const gameJudges = (c: Call, a: Advice): boolean => !c.caller || a.kind === 'tile';

function settle(s: HotlineState, c: Call, ctx: ModeContext): void {
  if (c.settled) return;
  c.settled = true;
  const p = problemOfCall(c);
  for (const id of c.order) autoReact(c, id);
  // The caller said the problem: a try counts.
  if (c.caller && c.callerSaid) pay(s, ctx, c.caller, POINTS.line, 'line');
  if (c.caller) {
    const line = atLevel(p.line, ctx.player(c.caller)?.level ?? 'n5');
    ctx.phrase(c.caller, { itemId: `hotline:${p.id}:call`, text: line.text, kana: line.kana, en: line.en, outcome: c.callerSaid ? 'said' : 'seen', recall: 'read' });
  }
  for (const id of c.order) {
    const a = c.advice[id]!;
    const hidden = c.hidden.includes(id);
    const r = c.reactions[id];
    // A mic pass earns half; a free read none (Nobiko-san always reads the cure, so it can't be a sure 100 a call).
    const half = a.free ? 0 : a.pass ? 0.5 : 1;
    if (!hidden && r === 'soreda' && half > 0) {
      pay(s, ctx, id, POINTS.soreda * half, 'soreda');
      statsOf(s, id).soreda += 1;
    } else if (!hidden && r === 'oshii' && half > 0) pay(s, ctx, id, POINTS.oshii * half, 'oshii');
    // The path: see creditOf. Kana tiles are seen.
    if (a.level === 'kana') {
      const t = a.tile ? adviceOf(a.tile) : null;
      if (t) ctx.phrase(id, { itemId: `hotline:tile:${t.id}`, text: t.word.text, kana: t.word.kana, en: t.word.en, outcome: 'seen', recall: 'read' });
      continue;
    }
    const line = lineOf(p, a.level).model;
    const credit = creditOf(c, a);
    ctx.phrase(id, { itemId: `hotline:${p.id}:${a.level}`, text: line.text, kana: line.kana, en: line.en, outcome: credit === 'memory' || credit === 'hint' || credit === 'unchecked' ? 'said' : 'seen', recall: credit === 'memory' ? 'memory' : 'read' });
    if (spokeOf(c, a)) pay(s, ctx, id, POINTS.spoke, 'spoke');
  }
  // Laughs: +50 a vote, and a sweep with three voters or more.
  const votes = tallyOf(c);
  for (const [id, n] of Object.entries(votes)) {
    pay(s, ctx, id, n * POINTS.laugh, 'laugh');
    statsOf(s, id).laughs += n;
  }
  const sweep = sweepOf(c);
  if (sweep && sweepVoters(c, sweep) >= 3) pay(s, ctx, sweep, POINTS.sweep, 'sweep');
  for (const [id, tile] of Object.entries(c.bets)) {
    if (tile === p.cure && c.gallery.includes(id)) {
      pay(s, ctx, id, POINTS.bet, 'bet');
      statsOf(s, id).bets += 1;
    }
  }
  // The booth: the first adviser in play order whose own words used a chunk, the higher level first.
  let best: { id: string; chunk: AdviceChunk; line: string } | null = null;
  for (const id of c.order) {
    const a = c.advice[id]!;
    const k = chunkOf(c, a);
    if (!k) continue;
    if (!best || LEVEL_RANK[k.level] > LEVEL_RANK[best.chunk.level]) best = { id, chunk: k, line: subtitleOf(a) ?? lineOf(p, a.level).model.text };
  }
  // Never two booths in a row: it's a treat, not a beat every call (and it keeps 8 players under 11.5 minutes).
  const prev = s.calls[s.calls.indexOf(c) - 1];
  c.booth = best && !prev?.booth ? { playerId: best.id, chunk: best.chunk.id, line: best.line } : null;
}

function tallyOf(c: Call): Record<string, number> {
  const out: Record<string, number> = {};
  for (const target of Object.values(c.votes)) if (!c.hidden.includes(target)) out[target] = (out[target] ?? 0) + 1;
  return out;
}

/** Every vote from everyone else went to one adviser (they can't vote for themselves, so their own vote doesn't count). */
function sweepOf(c: Call): string | null {
  const targets = Object.values(c.votes);
  if (!targets.length) return null;
  for (const t of new Set(targets)) {
    if (c.hidden.includes(t)) continue;
    const others = Object.entries(c.votes).filter(([voter]) => voter !== t);
    if (others.length && others.every(([, v]) => v === t)) return t;
  }
  return null;
}

/** Voters other than the sweep's target: three or more make a sweep. */
const sweepVoters = (c: Call, target: string): number => Object.keys(c.votes).filter((v) => v !== target).length;

function subtitleOf(a: Advice): string | null {
  if (a.kind === 'typed') return a.text;
  if (a.kind === 'clip') return a.heard?.text ?? null;
  if (a.kind === 'tile') return a.tile ? (adviceOf(a.tile)?.word.text ?? null) : null;
  return null;
}

/** Ready, a Kana pick, or advice already in. */
const adviserIn = (c: Call, id: string): boolean => c.ready.includes(id) || !!c.picks[id] || !!c.advice[id];

/** Three ちがう！ in a row from this call's caller ties Nobiko-san's neck in a knot. */
function chigauRun(c: Call): number {
  let n = 0;
  for (const id of c.order.slice(0, c.at + 1)) n = c.reactions[id] === 'chigau' ? n + 1 : 0;
  return n;
}

function cueReaction(c: Call, ctx: ModeContext, id: string): void {
  const r = c.reactions[id];
  if (!r) return;
  if (r === 'chigau' && chigauRun(c) >= 3) ctx.cue({ host: 'nobiko', event: 'hotline_knot' });
  else ctx.cue({ host: 'nobiko', event: r === 'soreda' ? 'hotline_soreda' : r === 'oshii' ? 'hotline_oshii' : 'hotline_chigau' });
}

const quip = (t: JpText): Record<string, string> => ({ quip: t.text, quip_kana: t.kana, quip_en: t.en });

/** When the secret card flips: what really helped, then the caller's own reveal line once the card is up. */
const SECRET_LINE_AT_MS = 1_600;
function cueSecret(c: Call, ctx: ModeContext): void {
  ctx.cue({ host: 'nobiko', event: 'hotline_secret' });
  ctx.cue({ host: 'nobiko', event: 'hotline_line', slots: quip(problemOfCall(c).reveal), atMs: SECRET_LINE_AT_MS });
}

/**
 * The chunk as the line says it. A chunk's text follows a plain verb (たら, て), but after ん the line
 * says だら / で (あそんで, さけんだら), so look for the voiced form when the plain one isn't there.
 */
export function chunkIn(line: string, text: string): string {
  if (line.includes(text)) return text;
  const voiced = text.replace(/^た/, 'だ').replace(/^て/, 'で');
  return line.includes(voiced) ? voiced : text;
}

// ---- the mode ----

export const ghostHotlineMode: Mode<HotlineState, HotlineView> = {
  info: {
    id: 'ghost-hotline',
    title: 'Ghost Advice Hotline',
    titleJa: 'おばけの おなやみ相談室',
    titleKana: 'おばけの おなやみ そうだんしつ',
    blurb: 'A yōkai phones Nobiko-san’s advice line. Only the caller knows what would really help: give advice, and make the room laugh.',
    host: 'nobiko',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your advice',
    phaseLabels: { prompt: 'The call', answer: 'Advice', reveal: 'Is that it?', encore: 'Laugh vote', score: 'Points' },
  },

  setup(ctx) {
    const players = ctx.players();
    const start = Math.floor(ctx.random() * Math.max(1, players.length));
    const ids = players.map((p) => p.id);
    const stats: Record<string, PlayerStats> = {};
    for (const id of ids) stats[id] = blankStats();
    return {
      round: 0,
      totalRounds: callsFor(players.length),
      audience: ctx.audience ?? 'family',
      order: [...ids.slice(start), ...ids.slice(0, start)],
      calls: [],
      micPassUsed: {},
      ledger: [],
      stats,
      scripted: players.length <= 2,
      phaseAt: ctx.now,
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return 'encore';
      case 'encore':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    const step = (c: Call, st: Step) => {
      c.step = st;
      c.stepAt = ctx.now;
    };
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'nobiko', event: s.scripted ? 'hotline_coop' : 'hotline_intro' });
        break;
      case 'prompt': {
        const c = startCall(s, ctx);
        step(c, 'ring');
        c.ringMs = c.caller ? SAY_RING_MS[ctx.player(c.caller)?.level ?? 'n5'] : RING_MS;
        const p = problemOfCall(c);
        // A scripted caller has no player name: leave the slot out, so only the lines without {name} can play.
        const who = c.caller ? ctx.player(c.caller)?.name : undefined;
        ctx.cue({ host: 'nobiko', event: 'hotline_ring', slots: { ...(who ? { name: who } : {}), caller: p.caller.name.text, caller_kana: p.caller.name.kana, caller_en: p.caller.name.en } });
        // A scripted caller: Nobiko-san reads the problem herself.
        if (!c.caller) ctx.cue({ host: 'nobiko', event: 'hotline_read', slots: { line: p.line.n5.kana, line_en: p.line.n5.en }, atMs: 1_500 });
        break;
      }
      case 'answer': {
        const c = current(s)!;
        step(c, 'record');
        lockPicks(c, ctx);
        break;
      }
      case 'reveal': {
        const c = current(s)!;
        step(c, c.order.length ? 'play' : 'secret');
        // Advice that didn't come in: the line is blamed, never the player (a mic pass or clip that plays wins).
        const missing = c.advisers.find((id) => !c.advice[id]);
        if (missing) ctx.cue({ host: 'nobiko', event: 'hotline_skip', slots: { name: ctx.player(missing)?.name ?? '' } });
        if (c.order.length) cuePlay(s, c, ctx);
        else cueSecret(c, ctx);
        break;
      }
      case 'encore': {
        const c = current(s)!;
        step(c, 'vote');
        if (!s.scripted && c.order.length) ctx.cue({ host: 'nobiko', event: 'hotline_vote' });
        break;
      }
      case 'score': {
        const c = current(s)!;
        step(c, 'points');
        settle(s, c, ctx);
        const sweep = sweepOf(c);
        if (sweep && sweepVoters(c, sweep) >= 3) ctx.cue({ host: 'nobiko', event: 'hotline_sweep', slots: { name: ctx.player(sweep)?.name ?? '' } });
        else ctx.cue({ host: 'nobiko', event: 'hotline_score' });
        break;
      }
    }
  },

  leave(s, phase, ctx) {
    const c = current(s);
    if (!c) return;
    if (phase === 'prompt') lockPicks(c, ctx);
    if (phase === 'answer') lockOrder(c, ctx);
    if (phase === 'reveal') for (const id of c.order) autoReact(c, id);
  },

  duration(s, phase, ctx) {
    const c = current(s);
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return (c?.ringMs ?? RING_MS) + PLAN_MS;
      case 'answer': {
        if (!c) return 0;
        const limits = c.advisers.filter((id) => !c.advice[id] && isSpeaker(ctx, id)).map((id) => RECORD_MS[ctx.player(id)?.level ?? 'n5']);
        return limits.length ? Math.max(...limits) + UPLOAD_MS + GRACE_MS : 1;
      }
      case 'reveal':
        return c ? c.order.reduce((t, id) => t + playMs(c.advice[id]) + REACT_MS, 0) + SECRET_MS : SECRET_MS;
      case 'encore':
        return s.scripted || !c?.order.length ? 1 : VOTE_MS;
      case 'score':
        return SCORE_MS + (c?.booth ? BOOTH_MS : 0);
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const c = current(s);
    if (!c) return false;
    const here = (id: string | null) => !!id && ctx.connected().some((p) => p.id === id);
    if (phase === 'prompt') return c.step === 'plan' && c.advisers.every((id) => !here(id) || adviserIn(c, id));
    if (phase === 'answer') return c.advisers.every((id) => !here(id) || !!c.advice[id]);
    if (phase === 'encore') {
      if (s.scripted || !c.order.length) return true;
      return ctx.connected().every((p) => p.id in c.votes || !voteTargets(c, p.id).length);
    }
    return false;
  },

  wakeAt(s, phase) {
    const c = current(s);
    if (!c) return null;
    if (phase === 'prompt' && c.step === 'ring') return c.stepAt + c.ringMs;
    if (phase === 'reveal' && c.step === 'play') return c.stepAt + playMs(c.advice[c.order[c.at]!]);
    if (phase === 'reveal' && c.step === 'react') return c.stepAt + REACT_MS;
    if (phase === 'score' && c.step === 'points' && c.booth) return c.stepAt + SCORE_MS;
    return null;
  },

  wake(s, phase, ctx) {
    const c = current(s);
    if (!c) return;
    if (phase === 'prompt' && c.step === 'ring') {
      c.step = 'plan';
      c.stepAt = ctx.now;
      const p = problemOfCall(c);
      // Nobody heard the caller (and no take is still uploading): Nobiko-san reads the problem for them.
      if (c.caller && !c.callerSaid && !c.callerTaking) ctx.cue({ host: 'nobiko', event: 'hotline_read', slots: { line: atLevel(p.line, ctx.player(c.caller)?.level ?? 'n5').kana, line_en: atLevel(p.line, ctx.player(c.caller)?.level ?? 'n5').en } });
    } else if (phase === 'reveal' && c.step === 'play') {
      c.step = 'react';
      c.stepAt = ctx.now;
      const id = c.order[c.at]!;
      const a = c.advice[id]!;
      if (gameJudges(c, a)) {
        autoReact(c, id);
        cueReaction(c, ctx, id);
      }
    } else if (phase === 'reveal' && c.step === 'react') {
      const id = c.order[c.at]!;
      if (!c.reactions[id]) {
        autoReact(c, id);
        cueReaction(c, ctx, id);
      }
      c.at += 1;
      c.stepAt = ctx.now;
      if (c.at < c.order.length) {
        c.step = 'play';
        cuePlay(s, c, ctx);
      } else {
        c.at = c.order.length - 1;
        c.step = 'secret';
        cueSecret(c, ctx);
      }
    } else if (phase === 'score' && c.step === 'points' && c.booth) {
      c.step = 'booth';
      c.stepAt = ctx.now;
      const k = CHUNKS.find((x) => x.id === c.booth!.chunk);
      ctx.cue({ host: 'nobiko', event: 'hotline_booth', ...(k ? { slots: { chunk: chunkIn(c.booth.line, k.text) } } : {}) });
    }
  },

  clipsInUse(s, phase) {
    const c = current(s);
    if (!c) return [];
    if (phase !== 'answer' && phase !== 'reveal') return [];
    return Object.values(c.advice).flatMap((a) => (a.clipId && !c.hidden.includes(a.playerId) ? [a.clipId] : []));
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== s.round) return moveError('wrong-phase');
    const c = current(s);
    if (!c) return moveError('wrong-phase');
    const p = problemOfCall(c);
    const level = ctx.player(playerId)?.level ?? 'n5';
    const adviser = c.advisers.includes(playerId);
    switch (raw.kind) {
      case 'say': {
        // The caller says the problem in the ring beat (a take started then may land in the plan beat). A try counts.
        if (playerId !== c.caller) return moveError('not-yours');
        if (phase !== 'prompt' || (c.step === 'plan' && !c.callerTaking)) return moveError('wrong-phase');
        if (c.callerSaid) return moveError('already-sent');
        c.callerSaid = true;
        c.callerClip = typeof raw.clipId === 'string' && raw.clipId.length <= 64 ? raw.clipId : null;
        return MOVE_OK;
      }
      case 'taking': {
        // The caller's take has started (the clip lands with 'say').
        if (playerId !== c.caller) return moveError('not-yours');
        if (phase !== 'prompt' || c.step !== 'ring') return moveError('wrong-phase');
        c.callerTaking = true;
        return MOVE_OK;
      }
      case 'ready': {
        if (!adviser || !isSpeaker(ctx, playerId)) return moveError('not-yours');
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!c.ready.includes(playerId)) c.ready.push(playerId);
        return MOVE_OK;
      }
      case 'hint': {
        if (!adviser) return moveError('not-yours');
        if (!c.hinted.includes(playerId)) c.hinted.push(playerId);
        return MOVE_OK;
      }
      case 'pick': {
        if (!adviser || isSpeaker(ctx, playerId)) return moveError('not-yours');
        if (phase !== 'prompt' || c.advice[playerId]) return moveError('wrong-phase');
        if (typeof raw.tileId !== 'string' || !kanaTilesOf(p).includes(raw.tileId)) return moveError('bad-move');
        c.picks[playerId] = raw.tileId;
        return MOVE_OK;
      }
      case 'advice': {
        if (!adviser || !isSpeaker(ctx, playerId)) return moveError('not-yours');
        if (c.advice[playerId]) return moveError('already-sent');
        if (raw.type === 'typed') {
          if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
          if (phase === 'prompt' && c.step !== 'plan') return moveError('wrong-phase');
          const text = cleanText(raw.text, 80);
          if (!text) return moveError('empty');
          c.advice[playerId] = blankAdvice(playerId, level, 'typed', { text });
          return MOVE_OK;
        }
        if (raw.type !== 'clip') return moveError('bad-move');
        if (phase !== 'answer') return moveError('wrong-phase');
        const clipId = typeof raw.clipId === 'string' && raw.clipId.length <= 64 ? raw.clipId : null;
        const local = raw.local === true;
        if (!clipId && !local) return moveError('no-clip');
        const limit = RECORD_MS[level];
        const dur = typeof raw.durMs === 'number' && Number.isFinite(raw.durMs) ? raw.durMs : limit;
        c.advice[playerId] = blankAdvice(playerId, level, 'clip', {
          clipId: local ? null : clipId,
          local,
          durMs: Math.max(MIN_CLIP_MS, Math.min(limit + 500, Math.round(dur))),
          heard: parseHeard(raw.heard),
          checked: raw.checked === true,
        });
        return MOVE_OK;
      }
      case 'pass': {
        // Nobiko-san reads the adviser's level line: once a game for half points, or free when the mic is blocked for none.
        if (!adviser || !isSpeaker(ctx, playerId)) return moveError('not-yours');
        if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
        if (c.advice[playerId]) return moveError('already-sent');
        const free = raw.free === true;
        if (!free && s.micPassUsed[playerId]) return moveError('no-pass-left');
        if (!free) s.micPassUsed[playerId] = true;
        c.advice[playerId] = blankAdvice(playerId, level, 'nobiko', { pass: true, ...(free ? { free: true } : {}) });
        return MOVE_OK;
      }
      case 'bet': {
        if (!c.gallery.includes(playerId)) return moveError('not-yours');
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (typeof raw.tileId !== 'string' || !betTilesOf(p).includes(raw.tileId)) return moveError('bad-move');
        c.bets[playerId] = raw.tileId;
        return MOVE_OK;
      }
      case 'react': {
        if (playerId !== c.caller) return moveError('not-yours');
        if (phase !== 'reveal' || (c.step !== 'play' && c.step !== 'react')) return moveError('wrong-phase');
        if (raw.index !== c.at) return moveError('wrong-phase');
        if (c.step === 'react' && ctx.now > c.stepAt + REACT_LOCK_MS) return moveError('too-late');
        if (raw.reaction !== 'chigau' && raw.reaction !== 'oshii' && raw.reaction !== 'soreda') return moveError('bad-move');
        const id = c.order[c.at]!;
        if (gameJudges(c, c.advice[id]!)) return moveError('game-marks-it');
        const first = !c.reactions[id];
        c.reactions[id] = raw.reaction;
        // Nobiko-san reacts as the tap lands (a change of mind doesn't repeat her).
        if (first) cueReaction(c, ctx, id);
        return MOVE_OK;
      }
      case 'vote': {
        if (phase !== 'encore' || s.scripted) return moveError('wrong-phase');
        if (typeof raw.playerId !== 'string' || !voteTargets(c, playerId).includes(raw.playerId)) return moveError('bad-move');
        c.votes[playerId] = raw.playerId;
        return MOVE_OK;
      }
      case 'hide': {
        if (ctx.vipId !== playerId) return moveError('not-vip');
        if (phase !== 'reveal' && phase !== 'encore') return moveError('wrong-phase');
        if (typeof raw.playerId !== 'string' || !c.advice[raw.playerId] || c.advice[raw.playerId]!.kind === 'nobiko') return moveError('nothing-to-hide');
        if (!c.hidden.includes(raw.playerId)) c.hidden.push(raw.playerId);
        for (const [v, t] of Object.entries(c.votes)) if (t === raw.playerId) delete c.votes[v];
        // Playing now: cut to the reaction.
        if (phase === 'reveal' && c.step === 'play' && c.order[c.at] === raw.playerId) c.stepAt = ctx.now - playMs(c.advice[raw.playerId]);
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const c = current(s);
    s.order = s.order.filter((id) => id !== playerId);
    if (!c || c.settled) return;
    c.gallery = c.gallery.filter((id) => id !== playerId);
    delete c.bets[playerId];
    delete c.votes[playerId];
    if (c.caller === playerId) c.caller = null;
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer, ctx) {
    const c = current(s);
    const player = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const level: Level = player?.level ?? 'n5';
    const inCall = phase !== 'intro' && phase !== 'recap' && !!c;
    const p = c ? problemOfCall(c) : null;
    const callerLevel: Level = c?.caller ? (ctx.player(c.caller)?.level ?? 'n5') : 'n5';
    const played = inCall ? playedOf(c!, phase) : [];
    const pastSecret = inCall && (phase === 'encore' || phase === 'score' || (phase === 'reveal' && c!.step === 'secret'));
    const view: HotlineView = {
      mode: 'ghost-hotline',
      round: s.round,
      totalRounds: s.totalRounds,
      phaseAt: s.phaseAt,
      step: inCall ? c!.step : null,
      stepAt: c?.stepAt ?? 0,
      scripted: s.scripted,
      call: inCall && p ? { caller: c!.caller, who: p.caller, line: withRomaji(atLevel(p.line, callerLevel), 'kana'), said: c!.callerSaid } : null,
      cast: inCall ? { caller: c!.caller, advisers: c!.advisers, gallery: c!.gallery } : null,
      locked: inCall
        ? { ready: c!.advisers.filter((id) => adviserIn(c!, id)), sent: c!.advisers.filter((id) => !!c!.advice[id]), bets: Object.keys(c!.bets), votes: Object.keys(c!.votes) }
        : { ready: [], sent: [], bets: [], votes: [] },
      play: inCall && phase === 'reveal' && (c!.step === 'play' || c!.step === 'react') ? playView(c!, level) : null,
      voters: inCall && phase === 'encore' && !s.scripted ? ctx.connected().filter((pl) => voteTargets(c!, pl.id).length > 0).length : 0,
      rows: played.map((id) => rowOf(c!, id, level)),
      secret: pastSecret && p ? { text: withRomaji(p.secret, 'kana'), cure: tileView(p.cure, level), fair: fairOf(c!) } : null,
      tally: inCall && phase === 'score' ? { votes: tallyOf(c!), top: topOf(c!), sweep: sweepOf(c!) && sweepVoters(c!, sweepOf(c!)!) >= 3 ? sweepOf(c!) : null, points: pointsOfCall(s, c!.index) } : null,
      booth: inCall && phase === 'score' && c!.step === 'booth' && c!.booth ? boothView(c!) : null,
      ledger: phase === 'score' || phase === 'recap' ? s.ledger : [],
      me: null,
    };
    if (player && c && inCall) view.me = meView(s, c, phase, player, level, view);
    return view;
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: PlayerStats) => number): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = 0;
      for (const pl of players) {
        const v = f(statsOf(s, pl.id));
        if (v > val) [top, val] = [pl, v];
      }
      return top;
    };
    const add = (pl: ModePlayer | undefined, title: string, en: string) => pl && out.push({ playerId: pl.id, name: pl.name, title, en });
    add(best((st) => st.soreda), 'それだ大賞', 'That’s It! Award: the most advice that really helped');
    add(best((st) => st.laughs), '大ウケ大賞', 'Big Laugh Award: the most laugh votes');
    add(best((st) => st.bets), '名探偵', 'Great Detective: the most right bets on the cure');
    return out;
  },
};

// ---- view helpers ----

function cuePlay(s: HotlineState, c: Call, ctx: ModeContext): void {
  const id = c.order[c.at]!;
  const a = c.advice[id]!;
  if (a.kind === 'nobiko') ctx.cue({ host: 'nobiko', event: 'hotline_mic_pass', slots: { name: ctx.player(id)?.name ?? '', line: lineOf(problemOfCall(c), a.level).model.kana, line_en: lineOf(problemOfCall(c), a.level).model.en } });
  void s;
}

/** Advice already shown with its reaction (the one playing now joins once the caller reacts or it locks). */
function playedOf(c: Call, phase: Phase): string[] {
  if (phase === 'encore' || phase === 'score') return c.order;
  if (phase !== 'reveal') return [];
  if (c.step === 'secret') return c.order;
  const done = c.order.slice(0, c.at);
  const now = c.order[c.at];
  if (c.step === 'react' && now && c.reactions[now]) done.push(now);
  return done;
}

function playView(c: Call, level: Level): HotlineView['play'] {
  const id = c.order[c.at];
  const a = id ? c.advice[id] : undefined;
  if (!id || !a) return null;
  const hidden = c.hidden.includes(id);
  return {
    index: c.at,
    total: c.order.length,
    playerId: id,
    kind: hidden ? 'nobiko' : a.kind,
    clipId: hidden ? null : a.clipId,
    local: !hidden && a.local,
    durMs: a.durMs,
    at: c.step === 'play' ? c.stepAt : 0,
    // A Kana tile and typed words show as they play; spoken advice never shows a picture until the caller reacts.
    tile: a.kind === 'tile' && a.tile && !hidden ? tileView(a.tile, level) : null,
    text: a.kind === 'typed' && !hidden ? a.text : null,
    pass: a.pass,
    hidden,
    reacting: c.step === 'react',
  };
}

function rowOf(c: Call, id: string, level: Level): AdviceRow {
  const a = c.advice[id]!;
  const r = c.reactions[id] ?? null;
  const hidden = c.hidden.includes(id);
  const tile = r && !hidden ? tileOfAdvice(c, a) : null;
  return {
    playerId: id,
    level: a.level,
    kind: a.kind,
    pass: a.pass,
    reaction: r,
    auto: c.auto.includes(id),
    subtitle: r && !hidden ? (a.kind === 'nobiko' ? lineOf(problemOfCall(c), a.level).model.text : subtitleOf(a)) : null,
    tile: tile ? tileView(tile, level) : null,
    hidden,
  };
}

/** Every それだ！ went to advice the game heard naming the cure; null when it couldn't hear any of it. */
function fairOf(c: Call): boolean | null {
  const p = problemOfCall(c);
  const judged = c.order.filter((id) => c.reactions[id] === 'soreda' && !c.auto.includes(id));
  const known = judged.filter((id) => {
    const a = c.advice[id]!;
    return a.kind !== 'clip' || a.checked;
  });
  if (!known.length) return null;
  return known.every((id) => tileOfAdvice(c, c.advice[id]!) === p.cure);
}

function topOf(c: Call): string | null {
  const t = tallyOf(c);
  let top: string | null = null;
  let n = 0;
  for (const [id, v] of Object.entries(t)) if (v > n) [top, n] = [id, v];
  return top;
}

function boothView(c: Call): HotlineView['booth'] {
  const b = c.booth;
  if (!b) return null;
  const k = CHUNKS.find((x) => x.id === b.chunk);
  return k ? { playerId: b.playerId, line: b.line, chunk: chunkIn(b.line, k.text), note: k.note, tag: k.tag, level: k.level } : null;
}

function pointsOfCall(s: HotlineState, round: number): { playerId: string; points: number }[] {
  const by = new Map<string, number>();
  for (const e of s.ledger) if (e.round === round) by.set(e.playerId, (by.get(e.playerId) ?? 0) + e.points);
  return [...by.entries()].map(([playerId, points]) => ({ playerId, points }));
}

/** Who this player may vote for: advice that was played and not hidden, never their own. */
function voteTargets(c: Call, playerId: string): string[] {
  // Nobiko-san's reading is her joke, not the adviser's: it isn't up for a laugh.
  return c.order.filter((id) => id !== playerId && !c.hidden.includes(id) && c.advice[id]?.kind !== 'nobiko');
}

function roleOf(c: Call, id: string): Role | null {
  if (c.caller === id) return 'caller';
  if (c.advisers.includes(id)) return 'adviser';
  if (c.gallery.includes(id)) return 'gallery';
  return null;
}

function meView(s: HotlineState, c: Call, phase: Phase, player: ModePlayer, level: Level, view: HotlineView): HotlineMe {
  const p = problemOfCall(c);
  const role = roleOf(c, player.id);
  const id = player.id;
  const speaker = level !== 'kana';
  const isCaller = role === 'caller';
  const isAdviser = role === 'adviser';
  const planning = phase === 'prompt';
  const mine = c.advice[id];
  const order = c.shuffle[id] ?? [0, 1, 2, 3];
  const line = isAdviser && speaker ? lineOf(p, level) : null;
  const ledger = phase === 'score' ? s.ledger.filter((e) => e.round === c.index && e.playerId === id) : [];
  const breakdown: HotlineMe['breakdown'] = [];
  for (const e of ledger) {
    const b = breakdown.find((x) => x.why === e.why);
    if (b) b.points += e.points;
    else breakdown.push({ why: e.why, points: e.points });
  }
  const playing = phase === 'reveal' && (c.step === 'play' || c.step === 'react') ? c.order[c.at] : undefined;
  const chunk = mine ? chunkOf(c, mine) : null;
  return {
    role,
    level,
    secret: isCaller ? withRomaji(p.secret, level) : null,
    cure: isCaller ? tileView(p.cure, level) : null,
    callerLine: isCaller ? withRomaji(atLevel(p.line, level), level) : null,
    canSay: isCaller && !c.callerSaid && phase === 'prompt' && c.step === 'ring',
    said: isCaller && c.callerSaid,
    gist: withRomaji(p.gist, level),
    mission: line ? { text: line.mission, model: withRomaji(line.model, level), ...(line.frame ? { frame: withRomaji(line.frame, level) } : {}) } : null,
    tiles: isAdviser && !speaker ? order.map((i) => kanaTilesOf(p)[i]!).map((id) => ({ ...tileView(id, level), ...(id === p.curve ? { curve: true } : {}) })) : [],
    pick: isAdviser && !speaker ? (c.picks[id] ?? mine?.tile ?? null) : null,
    ready: isAdviser && adviserIn(c, id),
    sent: isAdviser && !!mine,
    limitMs: isAdviser && speaker ? RECORD_MS[level] : 0,
    canRecord: isAdviser && speaker && !mine && phase === 'answer',
    canType: isAdviser && speaker && !mine && ((planning && c.step === 'plan') || phase === 'answer'),
    micPassLeft: isAdviser && speaker && !s.micPassUsed[id],
    betTiles: role === 'gallery' ? order.map((i) => tileView(betTilesOf(p)[i]!, level)) : [],
    bet: role === 'gallery' ? (c.bets[id] ?? null) : null,
    lockedIn: !planning,
    react:
      isCaller && playing
        ? { index: c.at, playerId: playing, canReact: !gameJudges(c, c.advice[playing]!), picked: c.reactions[playing] ?? null, auto: c.auto.includes(playing) }
        : null,
    voteOptions: phase === 'encore' && !s.scripted ? voteTargets(c, id).map((t) => ({ playerId: t, tile: view.rows.find((r) => r.playerId === t)?.tile ?? null, subtitle: view.rows.find((r) => r.playerId === t)?.subtitle ?? null })) : [],
    vote: c.votes[id] ?? null,
    canVote: phase === 'encore' && !s.scripted && voteTargets(c, id).length > 0,
    points: phase === 'score' ? ledger.reduce((t, e) => t + e.points, 0) : null,
    breakdown,
    note:
      phase === 'score' && isAdviser && speaker && mine
        ? { model: lineOf(p, level).model, said: mine.kind === 'nobiko' || c.hidden.includes(id) ? null : subtitleOf(mine), hinted: c.hinted.includes(id), chunk: chunk?.text ?? null, credit: creditOf(c, mine) }
        : null,
  };
}
