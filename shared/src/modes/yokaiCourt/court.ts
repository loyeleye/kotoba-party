// Yōkai Court (妖怪裁判): Fude-san presides over a studio mystery. Each case, a witness answers one question,
// two lawyers paired by the closest level argue on missions written for that answer, and everyone else (the
// witness too) answers one question about the arguments and then votes: who won you over? A tie is 無罪.
// See docs/modes/yokai-court.md.
//
// A case, by phase (each stepped by `wake` where it has beats):
//   prompt  case (7 s: Fude-san reads the case) → ask (6 s: なにか 見ましたか？ The witness taps one of four
//           answers, the curveball adds a second suspect) → testify (6 s: the answer on the TV; the lawyers'
//           missions and evidence arrive) → plan (8 s: lawyers plan in private, Kana lawyers pick tiles, judges
//           make a private hunch; ends when both lawyers are ready).
//   answer  record: both lawyers at once (Kana 6 s, N5 9 s, N4 and N3 12 s, then time to upload).
//   reveal  play (the prosecution, then the defence: only who is talking and a playhead) → check (4 s: one
//           question about one side's evidence, on the phones; ends when every judge has answered).
//   encore  gist (4 s: both arguments side by side, words and pictures, once every check has locked) → vote
//           (8 s: who won you over? Ends when every judge has voted).
//   score   verdict (8 s: tally, the scroll and the hanko, points) → booth (7 s, only when a lawyer's own
//           words used a chunk, never two cases running).
//
// Every move echoes `round`; one for an earlier case is a harmless `wrong-phase` race.

import type { JpText } from '../../../../content/src/types.js';
import { isUtterance, normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import type { Audience, Phase } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import {
  CASES,
  caseOf,
  casesFor as casesForAudience,
  CHECKS,
  CHUNKS,
  fill,
  GISTS,
  kanaTilesOf,
  LEVEL_RANK,
  LINES,
  MISSIONS,
  QUESTION,
  ROMAJI,
  slotsOf,
  suspectOf,
  TESTIMONIES,
  TESTIMONY_NOTE,
  thingOf,
  WITNESS,
  yokaiOf,
  type Case,
  type CourtChunk,
  type CourtLevel,
  type Side,
  type SpeakLevel,
  type Template,
  type Testimony,
  type Thing,
  type Yokai,
} from './cases.js';

// ---- tuning ----

export const MIN_PLAYERS = 4;
export const CASE_MS = 7_000;
export const ASK_MS = 6_000;
export const TESTIFY_MS = 6_000;
export const PLAN_MS = 8_000;
/** How long a lawyer may record, by level. A Kana lawyer says their tiles. */
export const RECORD_MS: Record<CourtLevel, number> = { kana: 6_000, n5: 9_000, n4: 12_000, n3: 12_000 };
/** After the record limit: time for the clips to upload. */
export const UPLOAD_MS = 3_500;
export const GRACE_MS = 1_500;
export const MIN_CLIP_MS = 300;
export const PLAY_TAIL_MS = 500;
/** Fude-san reading a Kana tile, typed words on the TV, Fude-san reading a level line. */
export const TILE_READ_MS = 2_200;
export const TYPED_PLAY_MS = 5_000;
export const FUDE_PLAY_MS: Record<CourtLevel, number> = { kana: 4_500, n5: 6_000, n4: 8_000, n3: 9_000 };
export const CHECK_MS = 4_000;
export const GIST_MS = 4_000;
export const VOTE_MS = 8_000;
export const VERDICT_MS = 8_000;
/** When the verdict beat's points land (the TV's tally and stamp run first; phones say "Watch the TV" until then). */
export const POINTS_AT_MS = 4_400;
export const BOOTH_MS = 7_000;
export const DURATIONS = { intro: 12_000 } as const;

export const POINTS = {
  /** The lawyer whose side the vote went to (a tie goes to the defence). */
  win: 200,
  /** Each lawyer, per vote for their side. */
  vote: 50,
  /** A judge who voted with the majority, with three voters or more (a tie has no majority). */
  majority: 100,
  /** A judge whose check was right. */
  check: 50,
} as const;

export type Role = Side | 'witness' | 'judge';
export type ArgKind = 'clip' | 'tiles' | 'typed' | 'fude';
export type Step = 'case' | 'ask' | 'testify' | 'plan' | 'record' | 'play' | 'check' | 'gist' | 'vote' | 'verdict' | 'booth';

export interface Argument {
  playerId: string;
  side: Side;
  level: CourtLevel;
  kind: ArgKind;
  clipId: string | null;
  /** The clip stays on the lawyer's phone, which plays it itself. */
  local: boolean;
  durMs: number;
  /** Kana lawyer: the tiles picked, in order (Fude-san reads them unless a clip came in). */
  tiles: string[];
  text: string | null;
  heard: Utterance | null;
  /** The server had speech-to-text for the clip. */
  checked: boolean;
  /** Fude-san read the level line: a mic pass (half points). */
  pass: boolean;
  /** Fude-san stood in (nothing came in, or a free read with the mic blocked): the case still runs, the seat scores nothing. */
  free?: boolean;
}

export interface LedgerEntry {
  round: number;
  playerId: string;
  points: number;
  why: 'win' | 'vote' | 'majority' | 'check';
}

export interface CaseState {
  index: number;
  caseId: string;
  pros: string;
  def: string;
  witness: string | null;
  /** Everyone who isn't a lawyer, the witness included. */
  judges: string[];
  testimony: Testimony | null;
  /** Nobody answered in time: the game took みていません. */
  testimonyAuto: boolean;
  /** The witness said their answer out loud too (a take came in). */
  witnessSaid: boolean;
  /** Which side's evidence the check asks about. */
  checkSide: Side;
  ready: string[];
  hinted: string[];
  /** Kana lawyers' tiles, in the order tapped (one or two). */
  picks: Record<string, string[]>;
  args: Record<string, Argument>;
  /** 0: the prosecution is on; 1: the defence. */
  at: number;
  hunches: Record<string, string>;
  checks: Record<string, string>;
  votes: Record<string, Side>;
  /** The VIP took this argument's words off the TV: it earns nothing (the vote still counts for the verdict). */
  hidden: string[];
  /** Each judge's order for the check's three pictures (indexes into checkOptions). */
  shuffle: Record<string, number[]>;
  step: Step;
  stepAt: number;
  booth: { playerId: string; chunk: string; line: string } | null;
  settled: boolean;
}

export interface PlayerStats {
  argued: number;
  pros: number;
  witnessed: number;
  wins: number;
  checks: number;
  majority: number;
}

export interface CourtState {
  round: number;
  totalRounds: number;
  audience: Audience;
  order: string[];
  cases: CaseState[];
  micPassUsed: Record<string, boolean>;
  ledger: LedgerEntry[];
  stats: Record<string, PlayerStats>;
  phaseAt: number;
}

// ---- view ----

export type JpR = JpText & { romaji?: string };

export interface ThingView {
  id: string;
  word: JpR;
  picture: string;
  emoji: string;
}

export interface ArgTileView {
  id: string;
  word: JpR;
  evidence: boolean;
}

/** One side's argument once it can be shown (the gist beat on). */
export interface ArgView {
  side: Side;
  playerId: string;
  level: CourtLevel;
  kind: ArgKind;
  pass: boolean;
  free: boolean;
  hidden: boolean;
  /** The side's pictures: the accused with the thing (prosecution), or with the alibi place (defence). */
  pics: ThingView[];
  /** What was said as heard, or typed (untrusted player text). */
  subtitle: string | null;
  /** The line as the game knows it: Fude-san's reading, or a Kana lawyer's tiles. */
  line: JpText | null;
  /** The main claim, at the viewer's level. */
  gist: JpR;
}

export interface CourtView {
  mode: 'yokai-court';
  round: number;
  totalRounds: number;
  phaseAt: number;
  step: Step | null;
  stepAt: number;
  case: { title: JpText; scene: JpText; accused: ThingView; object: ThingView; evidence: string } | null;
  cast: { pros: string; def: string; witness: string | null; judges: string[] } | null;
  /** Fude-san's question to the witness (from the ask beat). */
  question: JpText | null;
  /** The witness's answer (from the testify beat). */
  testimony: { kind: Testimony; line: JpR; note: string; suspect: ThingView | null; auto: boolean; said: boolean } | null;
  /** Lock-ins for the seat chips: who is in, never what they chose. */
  locked: { ready: string[]; sent: string[]; hunches: string[]; checks: string[]; votes: string[] };
  /** The argument playing now. Never the game's words for it (the check is about it); typed words are its sound. */
  play: {
    index: number;
    side: Side;
    playerId: string;
    kind: ArgKind;
    clipId: string | null;
    local: boolean;
    durMs: number;
    at: number;
    pass: boolean;
    free: boolean;
    hidden: boolean;
    level: CourtLevel;
    /** Typed words, shown while they "play" (they have no sound): untrusted player text. */
    text: string | null;
  } | null;
  /** Both arguments, from the gist beat (after every check has locked). */
  args: ArgView[];
  /** Judges who may still vote now. */
  voters: number;
  /** From the verdict. */
  verdict: {
    pros: number;
    def: number;
    winner: Side;
    tie: boolean;
    check: { side: Side; answer: ThingView; valid: boolean; right: string[] };
    points: { playerId: string; points: number }[];
    coda: JpText;
  } | null;
  booth: { playerId: string; line: string; chunk: string; note: string; tag: string; level: SpeakLevel } | null;
  ledger: LedgerEntry[];
  me: CourtMe | null;
}

export interface CourtMe {
  role: Role | null;
  level: CourtLevel;
  /** The witness's four answers (the curveball flagged), and whether they may still answer. */
  witnessTiles: { id: Testimony; word: JpR; curve: boolean }[];
  canTestify: boolean;
  testified: Testimony | null;
  /** A lawyer's mission and evidence (from the testify beat). The model line sits behind "Need a hint?". */
  mission: { text: string; model: JpR; evidence: ThingView; side: Side } | null;
  /** A Kana lawyer's three tiles and the picks, in order. */
  tiles: ArgTileView[];
  picks: string[];
  ready: boolean;
  sent: boolean;
  limitMs: number;
  canRecord: boolean;
  canType: boolean;
  micPassLeft: boolean;
  /** A judge's private hunch while the lawyers plan (no points). */
  hunchOptions: ThingView[];
  hunch: string | null;
  /** The Listening card: the argument on now, its main claim at this level. */
  listen: { side: Side; playerId: string; gist: JpR } | null;
  /** The one question about the arguments, in this phone's order. */
  check: { question: JpR; en: string; side: Side; options: ThingView[]; picked: string | null; open: boolean } | null;
  vote: Side | null;
  canVote: boolean;
  points: number | null;
  breakdown: { why: LedgerEntry['why']; points: number }[];
  /** A judge's result: the check and the vote. */
  result: { checkRight: boolean | null; checkValid: boolean; voted: Side | null; majority: boolean; hunch: ThingView | null } | null;
  /** A lawyer's private note at the verdict. */
  note: { model: JpText; said: string | null; hinted: boolean; chunk: string | null; credit: Credit } | null;
}

export type CourtMove =
  | { kind: 'testify'; round: number; testimony: Testimony }
  | { kind: 'said'; round: number; heard?: Utterance | null; checked?: boolean }
  | { kind: 'hunch'; round: number; yokaiId: string }
  | { kind: 'ready'; round: number }
  | { kind: 'hint'; round: number }
  | { kind: 'pick'; round: number; tiles: string[] }
  | { kind: 'argue'; round: number; type: 'clip' | 'typed'; clipId?: string | null; local?: boolean; durMs?: number; heard?: Utterance | null; checked?: boolean; text?: string }
  | { kind: 'fude'; round: number }
  | { kind: 'pass'; round: number; free?: boolean }
  | { kind: 'check'; round: number; thingId: string }
  | { kind: 'vote'; round: number; side: Side }
  | { kind: 'hide'; round: number; playerId: string };

// ---- helpers ----

const blankStats = (): PlayerStats => ({ argued: 0, pros: 0, witnessed: 0, wins: 0, checks: 0, majority: 0 });
const statsOf = (s: CourtState, id: string) => (s.stats[id] ??= blankStats());
export const current = (s: CourtState): CaseState | null => s.cases[s.round - 1] ?? null;
const caseOfState = (c: CaseState): Case => caseOf(c.caseId)!;
/** A player's level as the court sees it. TODO(n3): ModePlayer.level carries 'n3' once it's in Level. */
const levelOf = (ctx: ModeContext, id: string | null | undefined): CourtLevel => (id ? ((ctx.player(id)?.level as CourtLevel | undefined) ?? 'n5') : 'n5');
const speakLevel = (l: CourtLevel): SpeakLevel => (l === 'kana' ? 'n5' : l);
export const sideOf = (c: CaseState, id: string): Side | null => (c.pros === id ? 'pros' : c.def === id ? 'def' : null);
const lawyerOf = (c: CaseState, side: Side): string => (side === 'pros' ? c.pros : c.def);
const ORDER: readonly Side[] = ['pros', 'def'];

/** Cases for `n` players: 3 for 4–6, 4 for 7–8, so everyone argues at least once. */
export function roundsFor(n: number): number {
  return n >= 7 ? 4 : 3;
}

export const withRomaji = (t: JpText, level: CourtLevel): JpR => (level === 'kana' ? { ...t, romaji: ROMAJI[t.kana] ?? toRomaji(t.kana) } : t);

/** Does the reading contain any of these kana? Normalised readings, so keys never match across sounds merged at word boundaries. */
export function heardAny(reading: string, keys: readonly string[]): boolean {
  const said = normalizeReading(reading);
  return keys.some((k) => {
    const key = normalizeReading(k);
    return key.length > 0 && said.includes(key);
  });
}

export function thingView(t: Thing | Yokai, level: CourtLevel): ThingView {
  const word = 'word' in t ? t.word : t.name;
  return { id: t.id, word: withRomaji(word, level), picture: t.picture, emoji: t.emoji };
}

/** A template filled for this case, at a level: Kana and N5 lines are all kana. */
export function lineFor(cs: Case, t: Testimony, tpl: Template, level: CourtLevel): JpText {
  return fill(tpl, slotsOf(cs, t), level === 'kana' || level === 'n5');
}

/** The level line for a side, at a lawyer's level (Kana lawyers' "line" is their default tiles). */
export function modelOf(cs: Case, t: Testimony, side: Side, level: CourtLevel): JpText {
  if (level === 'kana') return tilesLine(cs, t, side, defaultTiles(side));
  return lineFor(cs, t, LINES[side][t][level], level);
}

/** A Kana lawyer's default argument: the claim and the evidence, the evidence first for the defence. */
export const defaultTiles = (side: Side): string[] => (side === 'pros' ? ['claim', 'evidence'] : ['evidence', 'claim']);

/** Kana tiles joined into one line, in the order picked. */
export function tilesLine(cs: Case, t: Testimony, side: Side, ids: readonly string[]): JpText {
  const all = kanaTilesOf(side, t);
  const parts = ids.map((id) => all.find((x) => x.id === id)).filter((x) => !!x).map((x) => lineFor(cs, t, x!.tpl, 'kana'));
  return { text: parts.map((p) => p.text).join(' '), kana: parts.map((p) => p.kana).join(' '), en: parts.map((p) => p.en).join(' ') };
}

/** The keys that show a side's evidence was said: the clue, or the alibi place. */
export function evidenceOf(cs: Case, side: Side): Thing {
  return thingOf(side === 'pros' ? cs.clue : cs.alibi)!;
}

/** The check's three pictures: the answer first, then its two decoys. */
export function checkOptions(cs: Case, side: Side): string[] {
  return side === 'pros' ? [cs.clue, ...cs.clueDecoys] : [cs.alibi, ...cs.alibiDecoys];
}

/** What an argument said, as a reading, for matching keys: null when nobody can tell (no speech-to-text). */
export function argReading(c: CaseState, a: Argument): string | null {
  const cs = caseOfState(c);
  const t = c.testimony ?? 'unseen';
  switch (a.kind) {
    case 'tiles':
      if (a.clipId || a.local) return a.checked && a.heard ? utteranceReading(a.heard) : tilesLine(cs, t, a.side, a.tiles).kana;
      return tilesLine(cs, t, a.side, a.tiles).kana;
    case 'typed':
      return a.text;
    case 'fude':
      return modelOf(cs, t, a.side, a.level).kana;
    case 'clip':
      return a.checked && a.heard ? utteranceReading(a.heard) : null;
  }
}

/** Did the argument say the side's evidence? null when nobody can tell. */
export function saidEvidence(c: CaseState, a: Argument): boolean | null {
  const cs = caseOfState(c);
  if (a.kind === 'tiles' && !(a.clipId || a.local)) return a.tiles.includes('evidence');
  const reading = argReading(c, a);
  if (reading === null) return null;
  return heardAny(reading, evidenceOf(cs, a.side).keys);
}

/** The chunk a lawyer's own words used, highest level first (never Fude-san's reading or Kana tiles). */
export function chunkOf(c: CaseState, a: Argument): CourtChunk | null {
  if (a.kind !== 'clip' && a.kind !== 'typed') return null;
  if (a.level === 'kana' || c.hidden.includes(a.playerId)) return null;
  const reading = argReading(c, a);
  if (!reading) return null;
  return CHUNKS.find((k) => heardAny(reading, k.keys)) ?? null;
}

/**
 * What the path credits a lawyer's level line with. The line's frame is only credited when their own clip used
 * one of their level's chunks: naming the alibi alone doesn't say ＿わけでは ありません.
 *   memory: their clip used the chunk, no hint · hint: the same, after opening the hint
 *   unchecked: a clip with no speech-to-text (said, but not counted as from memory)
 *   seen: anything else (typed, Fude-san's reading, a clip without the chunk, hidden by the VIP)
 */
export type Credit = 'memory' | 'hint' | 'unchecked' | 'seen';
export function creditOf(c: CaseState, a: Argument): Credit {
  if (a.kind !== 'clip' || c.hidden.includes(a.playerId)) return 'seen';
  if (!a.checked) return 'unchecked';
  const k = chunkOf(c, a);
  if (!k || k.level !== speakLevel(a.level)) return 'seen';
  return c.hinted.includes(a.playerId) ? 'hint' : 'memory';
}

/** Play time for one argument. */
export function playMs(a: Argument | undefined): number {
  if (!a) return FUDE_PLAY_MS.n5;
  switch (a.kind) {
    case 'clip':
      return a.durMs + PLAY_TAIL_MS;
    case 'tiles':
      return a.clipId || a.local ? a.durMs + PLAY_TAIL_MS : Math.max(1, a.tiles.length) * TILE_READ_MS + PLAY_TAIL_MS;
    case 'typed':
      return TYPED_PLAY_MS;
    case 'fude':
      return FUDE_PLAY_MS[a.level];
  }
}

function pay(s: CourtState, ctx: ModeContext, playerId: string, points: number, why: LedgerEntry['why']): void {
  if (!points || !ctx.player(playerId)) return;
  ctx.award(playerId, points);
  s.ledger.push({ round: s.round, playerId, points, why });
}

const blankArg = (playerId: string, side: Side, level: CourtLevel, kind: ArgKind, extra: Partial<Argument> = {}): Argument => ({
  playerId,
  side,
  level,
  kind,
  clipId: null,
  local: false,
  durMs: 0,
  tiles: [],
  text: null,
  heard: null,
  checked: false,
  pass: false,
  ...extra,
});

function parseHeard(raw: unknown): Utterance | null {
  if (raw === null || raw === undefined || !isUtterance(raw) || raw.via !== 'speech') return null;
  return { via: 'speech', text: raw.text.slice(0, 200), ...(raw.reading !== undefined ? { reading: String(raw.reading).slice(0, 400) } : {}) };
}

/**
 * Deals this case's roles. Lawyers: whoever has argued least, paired by the closest level (so the better idea wins,
 * not the bigger vocabulary); the one with fewer prosecutions prosecutes. Witness: whoever has been witness least.
 * Everyone who isn't a lawyer judges, the witness too.
 */
export function dealRoles(s: CourtState, ctx: ModeContext): Pick<CaseState, 'pros' | 'def' | 'witness' | 'judges'> {
  const here = new Set(ctx.connected().map((p) => p.id));
  const seated = s.order.filter((id) => ctx.player(id));
  const present = seated.filter((id) => here.has(id));
  const pool = present.length >= 2 ? present : seated;
  const n = pool.length;
  const start = n ? (s.round - 1) % n : 0;
  const lap = [...pool.slice(start), ...pool.slice(0, start)];
  const argued = (id: string) => statsOf(s, id).argued;
  const rank = (id: string) => LEVEL_RANK[levelOf(ctx, id)];
  const sorted = [...lap].sort((a, b) => argued(a) - argued(b) || lap.indexOf(a) - lap.indexOf(b));
  const low = argued(sorted[0]!);
  const tier = sorted.filter((id) => argued(id) === low);
  let pair: [string, string];
  const closest = (from: readonly string[], to: readonly string[]): [string, string] => {
    let best: [string, string] | null = null;
    let gap = Infinity;
    for (const a of from)
      for (const b of to) {
        if (a === b) continue;
        const g = Math.abs(rank(a) - rank(b));
        if (g < gap) [best, gap] = [[a, b], g];
      }
    return best ?? [sorted[0]!, sorted[1]!];
  };
  if (tier.length >= 2) pair = closest(tier, tier);
  else {
    const next = argued(sorted[1]!);
    pair = closest(tier, sorted.filter((id) => argued(id) === next));
  }
  const [a, b] = pair;
  const prosFirst = statsOf(s, a).pros !== statsOf(s, b).pros ? statsOf(s, a).pros < statsOf(s, b).pros : ctx.random() < 0.5;
  const [pros, def] = prosFirst ? [a, b] : [b, a];
  const rest = lap.filter((id) => id !== pros && id !== def);
  const witness = [...rest].sort((x, y) => statsOf(s, x).witnessed - statsOf(s, y).witnessed || rest.indexOf(x) - rest.indexOf(y))[0] ?? null;
  return { pros, def, witness, judges: rest };
}

function startCase(s: CourtState, ctx: ModeContext): CaseState {
  s.round += 1;
  const roles = dealRoles(s, ctx);
  const used = new Set(s.cases.map((c) => c.caseId));
  const all = casesForAudience(s.audience);
  const fresh = all.filter((c) => !used.has(c.id));
  const pool = fresh.length ? fresh : all.length ? all : [...CASES];
  const cs = pool[Math.floor(ctx.random() * pool.length)]!;
  const shuffle: Record<string, number[]> = {};
  for (const id of roles.judges) shuffle[id] = shuffled([0, 1, 2], () => ctx.random());
  // The check asks about each side in turn, the first side by chance.
  const first: Side = (s.cases[0]?.checkSide ?? (ctx.random() < 0.5 ? 'pros' : 'def'));
  const checkSide: Side = s.cases.length % 2 === 0 ? first : first === 'pros' ? 'def' : 'pros';
  const c: CaseState = {
    index: s.round,
    caseId: cs.id,
    ...roles,
    testimony: null,
    testimonyAuto: false,
    witnessSaid: false,
    checkSide,
    ready: [],
    hinted: [],
    picks: {},
    args: {},
    at: 0,
    hunches: {},
    checks: {},
    votes: {},
    hidden: [],
    shuffle,
    step: 'case',
    stepAt: ctx.now,
    booth: null,
    settled: false,
  };
  s.cases.push(c);
  statsOf(s, c.pros).argued += 1;
  statsOf(s, c.pros).pros += 1;
  statsOf(s, c.def).argued += 1;
  if (c.witness) statsOf(s, c.witness).witnessed += 1;
  return c;
}

/** At the end of the plan beat (and again when the record beat ends), Kana lawyers' picks become their argument. */
function lockKana(c: CaseState, ctx: ModeContext, final: boolean): void {
  for (const side of ORDER) {
    const id = lawyerOf(c, side);
    if (c.args[id] || levelOf(ctx, id) !== 'kana') continue;
    const tiles = c.picks[id];
    if (final) c.args[id] = tiles?.length ? blankArg(id, side, 'kana', 'tiles', { tiles: [...tiles] }) : blankArg(id, side, 'kana', 'fude', { free: true });
  }
}

/** When the record beat ends: anything missing gets Fude-san standing in (the seat scores nothing this case). */
function lockArgs(c: CaseState, ctx: ModeContext): void {
  lockKana(c, ctx, true);
  for (const side of ORDER) {
    const id = lawyerOf(c, side);
    if (!c.args[id]) c.args[id] = blankArg(id, side, levelOf(ctx, id), 'fude', { free: true });
  }
  c.at = 0;
}

/** A judge's argument is in: Ready, a Kana pick, or an argument. */
const lawyerIn = (c: CaseState, id: string): boolean => c.ready.includes(id) || !!c.picks[id]?.length || !!c.args[id];

function tallyOf(c: CaseState): { pros: number; def: number } {
  let pros = 0;
  let def = 0;
  for (const v of Object.values(c.votes)) v === 'pros' ? pros++ : def++;
  return { pros, def };
}

/** A tie is 無罪: the defence wins it (疑わしきは罰せず). */
export const winnerOf = (c: CaseState): Side => {
  const t = tallyOf(c);
  return t.pros > t.def ? 'pros' : 'def';
};

/** Points a lawyer's argument earns, as a share: half on a mic pass, none for a stand-in or a hidden argument. */
const shareOf = (c: CaseState, a: Argument | undefined): number => (!a || a.free || c.hidden.includes(a.playerId) ? 0 : a.pass ? 0.5 : 1);

/** Was the check fair: did the side say its evidence? Void only when the game knows it didn't. */
export function checkValid(c: CaseState): boolean {
  const a = c.args[lawyerOf(c, c.checkSide)];
  if (!a) return true;
  return saidEvidence(c, a) !== false;
}

function settle(s: CourtState, c: CaseState, ctx: ModeContext): void {
  if (c.settled) return;
  c.settled = true;
  const cs = caseOfState(c);
  const t = c.testimony ?? 'unseen';
  const tally = tallyOf(c);
  const winner = winnerOf(c);
  const voters = tally.pros + tally.def;
  // Lawyers: the win (when anyone voted) and each vote.
  for (const side of ORDER) {
    const id = lawyerOf(c, side);
    const share = shareOf(c, c.args[id]);
    if (side === winner && voters > 0) {
      pay(s, ctx, id, POINTS.win * share, 'win');
      if (share > 0) statsOf(s, id).wins += 1;
    }
    pay(s, ctx, id, (side === 'pros' ? tally.pros : tally.def) * POINTS.vote * share, 'vote');
  }
  // Judges: the majority (three voters or more, and no tie), and the check.
  const tie = tally.pros === tally.def;
  if (voters >= 3 && !tie)
    for (const [id, v] of Object.entries(c.votes))
      if (v === winner && c.judges.includes(id)) {
        pay(s, ctx, id, POINTS.majority, 'majority');
        statsOf(s, id).majority += 1;
      }
  if (checkValid(c)) {
    const answer = checkOptions(cs, c.checkSide)[0];
    for (const [id, pick] of Object.entries(c.checks))
      if (pick === answer && c.judges.includes(id)) {
        pay(s, ctx, id, POINTS.check, 'check');
        statsOf(s, id).checks += 1;
      }
  }
  // The path. The witness's answer: said (read: it's on their tile) when they said it too, else seen.
  if (c.witness && c.testimony && !c.testimonyAuto) {
    const line = lineFor(cs, t, WITNESS[t], 'kana');
    ctx.phrase(c.witness, { itemId: `court:witness:${cs.id}:${t}`, text: line.text, kana: line.kana, en: line.en, outcome: c.witnessSaid ? 'said' : 'seen', recall: 'read' });
  }
  for (const side of ORDER) {
    const id = lawyerOf(c, side);
    const a = c.args[id];
    if (!a || !ctx.player(id)) continue;
    if (a.level === 'kana') {
      // Kana tiles: said (read) when their own take used the tiles, else seen.
      const line = tilesLine(cs, t, side, a.tiles.length ? a.tiles : defaultTiles(side));
      const said = (a.clipId || a.local) && (!a.checked || (a.heard && heardAny(utteranceReading(a.heard), [normalizeReading(line.kana).slice(0, 4)])));
      ctx.phrase(id, { itemId: `court:${cs.id}:${t}:${side}:kana`, text: line.text, kana: line.kana, en: line.en, outcome: said ? 'said' : 'seen', recall: 'read' });
      continue;
    }
    const line = modelOf(cs, t, side, a.level);
    const credit = creditOf(c, a);
    ctx.phrase(id, { itemId: `court:${cs.id}:${t}:${side}:${a.level}`, text: line.text, kana: line.kana, en: line.en, outcome: credit === 'seen' ? 'seen' : 'said', recall: credit === 'memory' ? 'memory' : 'read' });
  }
  // The booth: the higher level first, then the prosecution.
  let best: { id: string; chunk: CourtChunk; line: string } | null = null;
  for (const side of ORDER) {
    const a = c.args[lawyerOf(c, side)];
    if (!a) continue;
    const k = chunkOf(c, a);
    if (!k) continue;
    const line = a.kind === 'typed' ? (a.text ?? '') : (a.heard?.text ?? '');
    if (!line) continue;
    if (!best || LEVEL_RANK[k.level] > LEVEL_RANK[best.chunk.level]) best = { id: a.playerId, chunk: k, line };
  }
  const prev = s.cases[s.cases.indexOf(c) - 1];
  c.booth = best && !prev?.booth ? { playerId: best.id, chunk: best.chunk.id, line: best.line } : null;
}

/** The chunk as the line says it, so the highlight can find it (the line is the player's own words). */
export function chunkIn(line: string, chunk: CourtChunk): string {
  const plain = chunk.text.replace(/\s+/g, '');
  if (line.includes(chunk.text)) return chunk.text;
  if (line.includes(plain)) return plain;
  return chunk.text;
}

function cueRead(c: CaseState, ctx: ModeContext): void {
  const id = lawyerOf(c, ORDER[c.at]!);
  const a = c.args[id];
  if (!a) return;
  const cs = caseOfState(c);
  const t = c.testimony ?? 'unseen';
  const name = ctx.player(id)?.name ?? '';
  if (a.kind === 'fude') {
    const line = modelOf(cs, t, a.side, a.level);
    ctx.cue({ host: 'fude', event: a.free ? 'court_stand_in' : 'court_mic_pass', slots: { name, line: line.kana, line_en: line.en } });
  } else if (a.kind === 'tiles' && !(a.clipId || a.local)) {
    const line = tilesLine(cs, t, a.side, a.tiles);
    ctx.cue({ host: 'fude', event: 'court_read', slots: { name, line: line.kana, line_en: line.en } });
  }
}

const quip = (t: JpText): Record<string, string> => ({ quip: t.text, quip_kana: t.kana, quip_en: t.en });

// ---- the mode ----

export const yokaiCourtMode: Mode<CourtState, CourtView> = {
  info: {
    id: 'yokai-court',
    title: 'Yōkai Court',
    titleJa: '妖怪裁判',
    titleKana: 'ようかい さいばん',
    blurb: 'Fude-san presides over a studio mystery. A witness answers one question, two lawyers argue, and the room decides: who won you over?',
    host: 'fude',
    minPlayers: MIN_PLAYERS,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your case',
    phaseLabels: { prompt: 'The case', answer: 'Arguments', reveal: 'Hear both sides', encore: 'Who won you over?', score: 'Verdict' },
  },

  setup(ctx) {
    const players = ctx.players();
    const start = Math.floor(ctx.random() * Math.max(1, players.length));
    const ids = players.map((p) => p.id);
    const stats: Record<string, PlayerStats> = {};
    for (const id of ids) stats[id] = blankStats();
    return {
      round: 0,
      totalRounds: roundsFor(players.length),
      audience: ctx.audience ?? 'family',
      order: [...ids.slice(start), ...ids.slice(0, start)],
      cases: [],
      micPassUsed: {},
      ledger: [],
      stats,
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
    const step = (c: CaseState, st: Step) => {
      c.step = st;
      c.stepAt = ctx.now;
    };
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'fude', event: 'court_intro' });
        break;
      case 'prompt': {
        const c = startCase(s, ctx);
        step(c, 'case');
        const cs = caseOfState(c);
        ctx.cue({ host: 'fude', event: 'court_case', slots: { line: cs.title.kana, line_en: cs.title.en, accused: yokaiOf(cs.accused).name.kana, accused_en: yokaiOf(cs.accused).name.en } });
        break;
      }
      case 'answer': {
        const c = current(s)!;
        step(c, 'record');
        break;
      }
      case 'reveal': {
        const c = current(s)!;
        step(c, 'play');
        c.at = 0;
        cueRead(c, ctx);
        break;
      }
      case 'encore': {
        const c = current(s)!;
        step(c, 'gist');
        ctx.cue({ host: 'fude', event: 'court_vote' });
        break;
      }
      case 'score': {
        const c = current(s)!;
        step(c, 'verdict');
        settle(s, c, ctx);
        const t = tallyOf(c);
        const cs = caseOfState(c);
        ctx.cue({ host: 'fude', event: t.pros === t.def ? 'court_tie' : winnerOf(c) === 'pros' ? 'court_guilty' : 'court_not_guilty', slots: { accused: yokaiOf(cs.accused).name.kana, accused_en: yokaiOf(cs.accused).name.en } });
        break;
      }
    }
  },

  leave(s, phase, ctx) {
    const c = current(s);
    if (!c) return;
    if (phase === 'prompt') {
      if (!c.testimony) {
        c.testimony = 'unseen';
        c.testimonyAuto = true;
      }
      lockKana(c, ctx, false);
    }
    if (phase === 'answer') lockArgs(c, ctx);
  },

  duration(s, phase, ctx) {
    const c = current(s);
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return CASE_MS + ASK_MS + TESTIFY_MS + PLAN_MS;
      case 'answer': {
        if (!c) return 0;
        const limits = ORDER.map((side) => lawyerOf(c, side))
          .filter((id) => !c.args[id])
          .map((id) => RECORD_MS[levelOf(ctx, id)]);
        return limits.length ? Math.max(...limits) + UPLOAD_MS + GRACE_MS : 1;
      }
      case 'reveal':
        return c ? ORDER.reduce((t, side) => t + playMs(c.args[lawyerOf(c, side)]), 0) + CHECK_MS : CHECK_MS;
      case 'encore':
        return GIST_MS + VOTE_MS;
      case 'score':
        return VERDICT_MS + (c?.booth ? BOOTH_MS : 0);
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const c = current(s);
    if (!c) return false;
    const here = (id: string | null) => !!id && ctx.connected().some((p) => p.id === id);
    if (phase === 'prompt') return c.step === 'plan' && ORDER.every((side) => !here(lawyerOf(c, side)) || lawyerIn(c, lawyerOf(c, side)));
    if (phase === 'answer') return ORDER.every((side) => !here(lawyerOf(c, side)) || !!c.args[lawyerOf(c, side)]);
    if (phase === 'reveal') return c.step === 'check' && c.judges.every((id) => !here(id) || id in c.checks);
    if (phase === 'encore') return c.step === 'vote' && c.judges.every((id) => !here(id) || id in c.votes);
    return false;
  },

  wakeAt(s, phase) {
    const c = current(s);
    if (!c) return null;
    if (phase === 'prompt' && c.step === 'case') return c.stepAt + CASE_MS;
    if (phase === 'prompt' && c.step === 'ask') return c.stepAt + ASK_MS;
    if (phase === 'prompt' && c.step === 'testify') return c.stepAt + TESTIFY_MS;
    if (phase === 'reveal' && c.step === 'play') return c.stepAt + playMs(c.args[lawyerOf(c, ORDER[c.at]!)]);
    if (phase === 'encore' && c.step === 'gist') return c.stepAt + GIST_MS;
    if (phase === 'score' && c.step === 'verdict' && c.booth) return c.stepAt + VERDICT_MS;
    return null;
  },

  wake(s, phase, ctx) {
    const c = current(s);
    if (!c) return;
    const go = (st: Step) => {
      c.step = st;
      c.stepAt = ctx.now;
    };
    const cs = caseOfState(c);
    if (phase === 'prompt' && c.step === 'case') {
      go('ask');
      ctx.cue({ host: 'fude', event: 'court_ask', slots: { name: c.witness ? (ctx.player(c.witness)?.name ?? '') : '' } });
    } else if (phase === 'prompt' && c.step === 'ask') {
      if (!c.testimony) {
        c.testimony = 'unseen';
        c.testimonyAuto = true;
      }
      go('testify');
      const line = lineFor(cs, c.testimony, WITNESS[c.testimony], 'kana');
      if (c.testimony === 'curve') ctx.cue({ host: 'fude', event: 'court_curveball', slots: { suspect: yokaiOf(cs.curve).name.kana, suspect_en: yokaiOf(cs.curve).name.en } });
      else if (!c.witnessSaid) ctx.cue({ host: 'fude', event: 'court_testimony', slots: { line: line.kana, line_en: line.en } });
    } else if (phase === 'prompt' && c.step === 'testify') {
      go('plan');
      ctx.cue({ host: 'fude', event: 'court_plan' });
    } else if (phase === 'reveal' && c.step === 'play') {
      if (c.at === 0) {
        c.at = 1;
        c.stepAt = ctx.now;
        cueRead(c, ctx);
      } else {
        go('check');
        ctx.cue({ host: 'fude', event: 'court_check' });
      }
    } else if (phase === 'encore' && c.step === 'gist') {
      go('vote');
    } else if (phase === 'score' && c.step === 'verdict' && c.booth) {
      go('booth');
      const k = CHUNKS.find((x) => x.id === c.booth!.chunk);
      ctx.cue({ host: 'fude', event: 'court_booth', ...(k ? { slots: { chunk: chunkIn(c.booth.line, k) } } : {}) });
    }
  },

  clipsInUse(s, phase) {
    const c = current(s);
    if (!c) return [];
    if (phase !== 'answer' && phase !== 'reveal') return [];
    return Object.values(c.args).flatMap((a) => (a.clipId && !c.hidden.includes(a.playerId) ? [a.clipId] : []));
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== s.round) return moveError('wrong-phase');
    const c = current(s);
    if (!c) return moveError('wrong-phase');
    const cs = caseOfState(c);
    const level = levelOf(ctx, playerId);
    const side = sideOf(c, playerId);
    const judge = c.judges.includes(playerId);
    switch (raw.kind) {
      case 'testify': {
        if (playerId !== c.witness) return moveError('not-yours');
        if (phase !== 'prompt' || c.step !== 'ask') return moveError('wrong-phase');
        if (c.testimony) return moveError('already-sent');
        if (typeof raw.testimony !== 'string' || !TESTIMONIES.includes(raw.testimony as Testimony)) return moveError('bad-move');
        c.testimony = raw.testimony as Testimony;
        return MOVE_OK;
      }
      case 'said': {
        // The witness said their answer out loud too (path credit only). A try counts.
        if (playerId !== c.witness) return moveError('not-yours');
        if (phase !== 'prompt' || !c.testimony || c.testimonyAuto) return moveError('wrong-phase');
        c.witnessSaid = true;
        return MOVE_OK;
      }
      case 'hunch': {
        if (!judge) return moveError('not-yours');
        if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
        if (typeof raw.yokaiId !== 'string' || !hunchIds(c).includes(raw.yokaiId)) return moveError('bad-move');
        c.hunches[playerId] = raw.yokaiId;
        return MOVE_OK;
      }
      case 'ready': {
        if (!side || level === 'kana') return moveError('not-yours');
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!c.ready.includes(playerId)) c.ready.push(playerId);
        return MOVE_OK;
      }
      case 'hint': {
        if (!side) return moveError('not-yours');
        if (!c.hinted.includes(playerId)) c.hinted.push(playerId);
        return MOVE_OK;
      }
      case 'pick': {
        if (!side || level !== 'kana') return moveError('not-yours');
        if (phase !== 'prompt' || (c.step !== 'testify' && c.step !== 'plan')) return moveError('wrong-phase');
        const ids = kanaTilesOf(side, c.testimony ?? 'unseen').map((x) => x.id);
        if (!Array.isArray(raw.tiles) || raw.tiles.length > 2 || raw.tiles.some((x) => typeof x !== 'string' || !ids.includes(x))) return moveError('bad-move');
        const tiles = [...new Set(raw.tiles as string[])];
        if (tiles.length) c.picks[playerId] = tiles;
        else delete c.picks[playerId];
        return MOVE_OK;
      }
      case 'argue': {
        if (!side) return moveError('not-yours');
        if (c.args[playerId]) return moveError('already-sent');
        if (raw.type === 'typed') {
          if (level === 'kana') return moveError('not-yours');
          if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
          if (phase === 'prompt' && c.step !== 'plan') return moveError('wrong-phase');
          const text = cleanText(raw.text, 120);
          if (!text) return moveError('empty');
          c.args[playerId] = blankArg(playerId, side, level, 'typed', { text });
          return MOVE_OK;
        }
        if (raw.type !== 'clip') return moveError('bad-move');
        if (phase !== 'answer') return moveError('wrong-phase');
        const clipId = typeof raw.clipId === 'string' && raw.clipId.length <= 64 ? raw.clipId : null;
        const local = raw.local === true;
        if (!clipId && !local) return moveError('no-clip');
        const limit = RECORD_MS[level];
        const dur = typeof raw.durMs === 'number' && Number.isFinite(raw.durMs) ? raw.durMs : limit;
        const tiles = level === 'kana' ? (c.picks[playerId]?.length ? [...c.picks[playerId]!] : defaultTiles(side)) : [];
        c.args[playerId] = blankArg(playerId, side, level, level === 'kana' ? 'tiles' : 'clip', {
          clipId: local ? null : clipId,
          local,
          durMs: Math.max(MIN_CLIP_MS, Math.min(limit + 500, Math.round(dur))),
          heard: parseHeard(raw.heard),
          checked: raw.checked === true,
          tiles,
        });
        return MOVE_OK;
      }
      case 'fude': {
        // A Kana lawyer leaves their tiles to Fude-san (no take): full points, it's their argument.
        if (!side || level !== 'kana') return moveError('not-yours');
        if (phase !== 'answer') return moveError('wrong-phase');
        if (c.args[playerId]) return moveError('already-sent');
        const tiles = c.picks[playerId]?.length ? [...c.picks[playerId]!] : defaultTiles(side);
        c.args[playerId] = blankArg(playerId, side, 'kana', 'tiles', { tiles });
        return MOVE_OK;
      }
      case 'pass': {
        // Fude-san reads the level line: once a game for half points, or free when the mic is blocked for none.
        if (!side || level === 'kana') return moveError('not-yours');
        if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
        if (phase === 'prompt' && c.step !== 'plan') return moveError('wrong-phase');
        if (c.args[playerId]) return moveError('already-sent');
        const free = raw.free === true;
        if (!free && s.micPassUsed[playerId]) return moveError('no-pass-left');
        if (!free) s.micPassUsed[playerId] = true;
        c.args[playerId] = blankArg(playerId, side, level, 'fude', free ? { free: true } : { pass: true });
        return MOVE_OK;
      }
      case 'check': {
        if (!judge) return moveError('not-yours');
        if (phase !== 'reveal' || c.step !== 'check') return moveError('wrong-phase');
        if (typeof raw.thingId !== 'string' || !checkOptions(cs, c.checkSide).includes(raw.thingId)) return moveError('bad-move');
        c.checks[playerId] = raw.thingId;
        return MOVE_OK;
      }
      case 'vote': {
        if (!judge) return moveError('not-yours');
        if (phase !== 'encore') return moveError('wrong-phase');
        if (raw.side !== 'pros' && raw.side !== 'def') return moveError('bad-move');
        c.votes[playerId] = raw.side;
        return MOVE_OK;
      }
      case 'hide': {
        if (ctx.vipId !== playerId) return moveError('not-vip');
        if (phase !== 'reveal' && phase !== 'encore') return moveError('wrong-phase');
        const a = typeof raw.playerId === 'string' ? c.args[raw.playerId] : undefined;
        if (!a || a.kind === 'fude' || (a.kind === 'tiles' && !(a.clipId || a.local))) return moveError('nothing-to-hide');
        if (!c.hidden.includes(a.playerId)) c.hidden.push(a.playerId);
        // Playing now: cut it short.
        if (phase === 'reveal' && c.step === 'play' && lawyerOf(c, ORDER[c.at]!) === a.playerId) c.stepAt = ctx.now - playMs(a);
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
    c.judges = c.judges.filter((id) => id !== playerId);
    delete c.hunches[playerId];
    delete c.checks[playerId];
    delete c.votes[playerId];
    if (c.witness === playerId) c.witness = null;
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer, ctx) {
    const c = current(s);
    const player = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const level: CourtLevel = player ? levelOf(ctx, player.id) : 'n5';
    const inCase = phase !== 'intro' && phase !== 'recap' && !!c;
    const cs = c ? caseOfState(c) : null;
    const t = c?.testimony ?? 'unseen';
    const pastAsk = inCase && (phase !== 'prompt' || c!.step !== 'case');
    const pastTestify = inCase && (phase !== 'prompt' || c!.step === 'testify' || c!.step === 'plan');
    const showArgs = inCase && (phase === 'encore' || phase === 'score');
    const view: CourtView = {
      mode: 'yokai-court',
      round: s.round,
      totalRounds: s.totalRounds,
      phaseAt: s.phaseAt,
      step: inCase ? c!.step : null,
      stepAt: c?.stepAt ?? 0,
      case: inCase && cs ? { title: cs.title, scene: cs.scene, accused: thingView(yokaiOf(cs.accused), 'n5'), object: thingView(cs.object, 'n5'), evidence: cs.evidence } : null,
      cast: inCase ? { pros: c!.pros, def: c!.def, witness: c!.witness, judges: c!.judges } : null,
      question: pastAsk ? QUESTION : null,
      testimony: pastTestify && cs && c!.testimony ? testimonyView(c!, cs, 'n5') : null,
      locked: inCase
        ? {
            ready: ORDER.map((x) => lawyerOf(c!, x)).filter((id) => lawyerIn(c!, id)),
            sent: ORDER.map((x) => lawyerOf(c!, x)).filter((id) => !!c!.args[id]),
            hunches: Object.keys(c!.hunches),
            checks: Object.keys(c!.checks),
            votes: Object.keys(c!.votes),
          }
        : { ready: [], sent: [], hunches: [], checks: [], votes: [] },
      play: inCase && phase === 'reveal' && c!.step === 'play' ? playView(c!) : null,
      args: showArgs && cs ? ORDER.map((x) => argView(c!, cs, x, level, ctx)) : [],
      voters: inCase && phase === 'encore' ? c!.judges.filter((id) => ctx.connected().some((p) => p.id === id)).length : 0,
      verdict: inCase && phase === 'score' && cs ? verdictView(s, c!, cs) : null,
      booth: inCase && phase === 'score' && c!.step === 'booth' && c!.booth ? boothView(c!) : null,
      ledger: phase === 'score' || phase === 'recap' ? s.ledger : [],
      me: null,
    };
    if (player && c && inCase && cs) view.me = meView(s, c, cs, t, phase, player, level, ctx);
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
    add(best((st) => st.wins), '名弁護士', 'Star Lawyer: the most cases won');
    add(best((st) => st.checks), '地獄耳', 'Ears Like a Hawk: the most checks right');
    add(best((st) => st.majority), '名裁判員', 'Voice of the Court: voted with the majority most');
    return out;
  },
};

// ---- view helpers ----

/** The hunch choices: the accused and whoever the testimony named, or "someone else". */
function hunchIds(c: CaseState): string[] {
  const cs = caseOfState(c);
  const s = c.testimony ? suspectOf(cs, c.testimony) : null;
  return [cs.accused, s ? s.id : 'someone'];
}
const SOMEONE: Yokai = { id: 'someone', name: { text: 'ほかの だれか', kana: 'ほかの だれか', en: 'someone else' }, picture: '', emoji: '❓', keys: [] };
const hunchThing = (id: string): Yokai => (id === 'someone' ? SOMEONE : yokaiOf(id));

function testimonyView(c: CaseState, cs: Case, level: CourtLevel): NonNullable<CourtView['testimony']> {
  const t = c.testimony!;
  const slots = slotsOf(cs, t);
  const s = suspectOf(cs, t);
  return {
    kind: t,
    line: withRomaji(lineFor(cs, t, WITNESS[t], 'kana'), level),
    note: TESTIMONY_NOTE[t].replace(/\{(\w+)\}/g, (all, k: string) => slots[k]?.en ?? all),
    suspect: s ? thingView(s, level) : null,
    auto: c.testimonyAuto,
    said: c.witnessSaid,
  };
}

function playView(c: CaseState): CourtView['play'] {
  const side = ORDER[c.at]!;
  const id = lawyerOf(c, side);
  const a = c.args[id];
  if (!a) return null;
  const hidden = c.hidden.includes(id);
  return {
    index: c.at,
    side,
    playerId: id,
    kind: hidden ? 'fude' : a.kind,
    clipId: hidden ? null : a.clipId,
    local: !hidden && a.local,
    durMs: a.durMs,
    at: c.stepAt,
    pass: a.pass,
    free: !!a.free,
    hidden,
    level: a.level,
    text: a.kind === 'typed' && !hidden ? a.text : null,
  };
}

/** The side's pictures: the accused with the thing (prosecution), or with the alibi place (defence). */
function sidePics(cs: Case, side: Side, level: CourtLevel): ThingView[] {
  return [thingView(yokaiOf(cs.accused), level), side === 'pros' ? thingView(cs.object, level) : thingView(thingOf(cs.alibi)!, level)];
}

function gistOf(cs: Case, t: Testimony, side: Side, level: CourtLevel): JpR {
  const g = GISTS[side];
  return withRomaji(lineFor(cs, t, level === 'kana' ? g.kana : g.n5, level), level);
}

function argView(c: CaseState, cs: Case, side: Side, level: CourtLevel, ctx: ModeContext): ArgView {
  const id = lawyerOf(c, side);
  const a = c.args[id];
  const t = c.testimony ?? 'unseen';
  const hidden = c.hidden.includes(id);
  const own = a && (a.kind === 'clip' || a.kind === 'typed' || (a.kind === 'tiles' && (a.clipId || a.local)));
  const subtitle = hidden || !a ? null : a.kind === 'typed' ? a.text : own ? (a.heard?.text ?? null) : null;
  const line = !a || hidden ? null : a.kind === 'fude' ? modelOf(cs, t, side, a.level) : a.kind === 'tiles' ? tilesLine(cs, t, side, a.tiles) : null;
  return {
    side,
    playerId: id,
    level: a?.level ?? levelOf(ctx, id),
    kind: a?.kind ?? 'fude',
    pass: !!a?.pass,
    free: !!a?.free,
    hidden,
    pics: sidePics(cs, side, level),
    subtitle,
    line,
    gist: gistOf(cs, t, side, level),
  };
}

function verdictView(s: CourtState, c: CaseState, cs: Case): CourtView['verdict'] {
  const t = tallyOf(c);
  const answer = thingView(thingOf(checkOptions(cs, c.checkSide)[0]!)!, 'n5');
  const valid = checkValid(c);
  return {
    pros: t.pros,
    def: t.def,
    winner: winnerOf(c),
    tie: t.pros === t.def,
    check: { side: c.checkSide, answer, valid, right: valid ? Object.entries(c.checks).filter(([, v]) => v === answer.id).map(([id]) => id) : [] },
    points: pointsOfCase(s, c.index),
    coda: cs.coda,
  };
}

function boothView(c: CaseState): CourtView['booth'] {
  const b = c.booth;
  if (!b) return null;
  const k = CHUNKS.find((x) => x.id === b.chunk);
  return k ? { playerId: b.playerId, line: b.line, chunk: chunkIn(b.line, k), note: k.note, tag: k.tag, level: k.level } : null;
}

function pointsOfCase(s: CourtState, round: number): { playerId: string; points: number }[] {
  const by = new Map<string, number>();
  for (const e of s.ledger) if (e.round === round) by.set(e.playerId, (by.get(e.playerId) ?? 0) + e.points);
  return [...by.entries()].map(([playerId, points]) => ({ playerId, points }));
}

function roleOf(c: CaseState, id: string): Role | null {
  if (c.pros === id) return 'pros';
  if (c.def === id) return 'def';
  if (c.witness === id) return 'witness';
  if (c.judges.includes(id)) return 'judge';
  return null;
}

function meView(s: CourtState, c: CaseState, cs: Case, t: Testimony, phase: Phase, player: ModePlayer, level: CourtLevel, ctx: ModeContext): CourtMe {
  const id = player.id;
  const role = roleOf(c, id);
  const side = sideOf(c, id);
  const judge = c.judges.includes(id);
  const mine = c.args[id];
  const speaker = level !== 'kana';
  const testified = phase !== 'prompt' || c.step === 'testify' || c.step === 'plan';
  const ledger = phase === 'score' ? s.ledger.filter((e) => e.round === c.index && e.playerId === id) : [];
  const breakdown: CourtMe['breakdown'] = [];
  for (const e of ledger) {
    const b = breakdown.find((x) => x.why === e.why);
    if (b) b.points += e.points;
    else breakdown.push({ why: e.why, points: e.points });
  }
  const evidence = side ? evidenceOf(cs, side) : null;
  const playing = phase === 'reveal' && c.step === 'play' ? ORDER[c.at]! : null;
  const checkOpts = checkOptions(cs, c.checkSide);
  const order = c.shuffle[id] ?? [0, 1, 2];
  const q = CHECKS[c.checkSide];
  const answer = checkOpts[0]!;
  const valid = phase === 'score' ? checkValid(c) : true;
  const winner = phase === 'score' ? winnerOf(c) : null;
  const tally = tallyOf(c);
  const chunk = mine ? chunkOf(c, mine) : null;
  return {
    role,
    level,
    witnessTiles: role === 'witness' && phase === 'prompt' && (c.step === 'case' || c.step === 'ask') ? TESTIMONIES.map((x) => ({ id: x, word: withRomaji(lineFor(cs, x, WITNESS[x], 'kana'), level), curve: x === 'curve' })) : [],
    canTestify: role === 'witness' && phase === 'prompt' && c.step === 'ask' && !c.testimony,
    testified: role === 'witness' ? c.testimony : null,
    mission:
      side && testified && evidence
        ? {
            text: MISSIONS[side][t].replace(/\{(\w+)\}/g, (all, k: string) => slotsOf(cs, t)[k]?.en ?? all),
            model: withRomaji(modelOf(cs, t, side, level), level),
            evidence: thingView(evidence, level),
            side,
          }
        : null,
    tiles: side && !speaker && testified ? kanaTilesOf(side, t).map((x) => ({ id: x.id, word: withRomaji(lineFor(cs, t, x.tpl, 'kana'), level), evidence: !!x.evidence })) : [],
    picks: side && !speaker ? (mine?.tiles.length ? mine.tiles : (c.picks[id] ?? [])) : [],
    ready: !!side && lawyerIn(c, id),
    sent: !!side && !!mine,
    limitMs: side ? RECORD_MS[level] : 0,
    canRecord: !!side && !mine && phase === 'answer',
    canType: !!side && speaker && !mine && ((phase === 'prompt' && c.step === 'plan') || phase === 'answer'),
    micPassLeft: !!side && speaker && !s.micPassUsed[id],
    hunchOptions: judge && testified ? hunchIds(c).map((x) => thingView(hunchThing(x), level)) : [],
    hunch: c.hunches[id] ?? null,
    listen: judge && playing ? { side: playing, playerId: lawyerOf(c, playing), gist: gistOf(cs, t, playing, level) } : null,
    check:
      judge && ((phase === 'reveal' && c.step === 'check') || phase === 'encore' || phase === 'score')
        ? {
            question: withRomaji(lineFor(cs, t, level === 'kana' ? q.ja.kana : q.ja.n5, level), level),
            en: q.en.replace('{A}', yokaiOf(cs.accused).name.en).replace('the defence', ctx.player(c.def)?.name ? `${ctx.player(c.def)!.name} (defence)` : 'the defence').replace('the prosecution', ctx.player(c.pros)?.name ? `${ctx.player(c.pros)!.name} (prosecution)` : 'the prosecution'),
            side: c.checkSide,
            options: order.map((i) => thingView(thingOf(checkOpts[i]!)!, level)),
            picked: c.checks[id] ?? null,
            open: phase === 'reveal' && c.step === 'check',
          }
        : null,
    vote: c.votes[id] ?? null,
    canVote: judge && phase === 'encore',
    points: phase === 'score' ? ledger.reduce((sum, e) => sum + e.points, 0) : null,
    breakdown,
    result:
      phase === 'score' && judge
        ? {
            checkRight: id in c.checks ? c.checks[id] === answer : null,
            checkValid: valid,
            voted: c.votes[id] ?? null,
            majority: !!winner && tally.pros + tally.def >= 3 && tally.pros !== tally.def && c.votes[id] === winner,
            hunch: c.hunches[id] ? thingView(hunchThing(c.hunches[id]!), level) : null,
          }
        : null,
    note:
      phase === 'score' && side && speaker && mine
        ? { model: modelOf(cs, t, side, level), said: mine.kind === 'fude' || c.hidden.includes(id) ? null : mine.kind === 'typed' ? mine.text : (mine.heard?.text ?? null), hinted: c.hinted.includes(id), chunk: chunk?.text ?? null, credit: creditOf(c, mine) }
        : null,
  };
}
