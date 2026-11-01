// Late Again! (また ちこく！): Pon's office of hopeless latecomers. Each round one player is late (again),
// phones the boss and blames one of three causes; the witness backs the story up without hearing it; the
// room spends Pon's leaves on "Safe"; the acting chief (ぶちょうだいり, Pon's sash) calls セーフ！ or アウト！
// and scores by reading the room. See docs/modes/late-again.md.
//
// A round, by phase (each stepped by `wake` where it has beats):
//   prompt  scene (5 s: what they're late for, the cast, everyone's leaves; the latecomer may already pick)
//           → plan (8 s: the latecomer taps one of the witness's three causes to blame; the witness picks
//           blind; the gallery bets; Ready ends it early once the witness is in). Picks, the alibi and the
//           bets lock here, before the room hears a word.
//   answer  record: the latecomer's excuse (Kana 6 s of tiles, N5 9 s and N4 12 s of voice, then time for the
//           clip to upload).
//   reveal  play (the clip, the tiles, or Pon on a mic pass; the TV shows only who is talking, the N4 gallery
//           answers a listening check, Kana and N5 players catch words) → gist (4 s: the subtitle, the picture
//           gist and the alibi card; the chief's phone gets the gist now).
//   encore  vote (6 s): voters give a leaf or keep it, the chief calls Safe or Out. Hidden until the ruling.
//   score   ruling (5 s: the call, the leaves, Pon's reaction to this cause, points) → booth (7 s, only when the
//           excuse used its grammar chunk: the chunk, a line of colour commentary and its train-line tag) →
//           truth (4 s: "the real story", a cause nobody was dealt this game, so every round ends on a laugh;
//           Pon himself after a tanuki curveball, and "the boss was Pon" in the last round).
//
// Every move echoes `round`; one for an earlier round is a harmless `wrong-phase` race.

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { ASK_CHANCE, callbackLine, CAUSES, causeOf, dealOptions, kanaLine, latenessFor, lineFor, PREMISE, sceneOf, scenesFor, SORRY_TILE, SOUND_TILE_ID, TANUKI_TILE, truthFor, truthLine, type Cause, type Chunk } from './causes.js';
import { n4Up } from '../../level.js';

// ---- tuning ----

export const MIN_ROUNDS = 6;
export const SCENE_MS = 5_000;
export const PLAN_MS = 8_000;
/** How long the latecomer may record, by level (N4 lines run about 12 s at a learner's pace; N3 joins at 12 s too). */
export const RECORD_MS: Record<Level, number> = { kana: 6_000, n5: 9_000, n4: 12_000, n3: 12_000 };
/** After the record limit: time for the clip to upload before Pon stands in. */
export const UPLOAD_MS = 3_500;
/** Late moves still count this long after a timer runs out. */
export const GRACE_MS = 1_500;
export const MIN_CLIP_MS = 300;
/** A Kana excuse is at most this many tiles. */
export const MAX_TILES = 3;
export const TILE_MS = 1_100;
export const TYPED_PLAY_MS = 3_000;
/** Pon reading a line (mic pass, stand-in, hidden clip). */
export const PON_PLAY_MS = 4_500;
export const PLAY_TAIL_MS = 500;
export const GIST_MS = 4_000;
/** A missed alibi or the curveball gets a beat more: the card flips, Pon gasps. */
export const GIST_MISS_MS = 5_000;
export const VOTE_MS = 6_000;
export const RULING_MS = 5_000;
export const BOOTH_MS = 7_000;
/** The real story: the round's last beat ("What really happened…", a pause, then the reveal). */
export const TRUTH_MS = 4_000;
export const TRUTH_PAUSE_MS = 800;
/** The gist beat: the alibi card flips over this long in (the TV's animation matches). */
export const ALIBI_FLIP_MS = 1_300;
/** Pon's reaction lands just after the stamp. */
export const RULING_LINE_AT_MS = 700;
/** "Can't read the room!": after Pon's reaction, when the chief's call went against the room. */
export const MISREAD_AT_MS = 3_200;
export const DURATIONS = { intro: 12_000 } as const;

export const POINTS = {
  /** To the latecomer, for each leaf given. */
  leaf: 100,
  /** To the latecomer and the witness each, when the witness backed the right cause. */
  alibi: 50,
  /** To the chief, for a call that matches the room (half when the room is split exactly). */
  chief: 100,
  chiefHalf: 50,
  bet: 20,
  check: 30,
  catchWord: 10,
  catchMax: 30,
  /** Per leaf when Pon read the excuse on a mic pass (a stand-in earns none: Pon keeps those leaves). */
  leafPass: 50,
  /** To the latecomer, when speech-to-text heard the excuse name its cause or use its chunk. */
  spoke: 50,
  /** To each voter who gave a leaf, when the room ruled Safe. */
  stake: 20,
  /** To the witness, when their tanuki curveball didn't stop the room saying Safe. */
  curve: 100,
  /** Two players, co-op: the chief named the cause. */
  coopPick: 100,
} as const;

/** Leaves: everyone starts with two, gets one more at the start of rounds 3, 5, 7 …, and holds at most two. */
export const START_LEAVES = 2;
export const MAX_LEAVES = 2;

/** Two players: Pon's score to beat, per player, per round (a good team names the cause four times in five). */
export const PON_RECORD_PER_ROUND = 110;
/** The team's target: both players' scores together. */
export const ponRecord = (s: Pick<LateState, 'totalRounds'>): number => PON_RECORD_PER_ROUND * 2 * s.totalRounds;

// ---- state ----

export type Role = 'latecomer' | 'witness' | 'chief' | 'gallery';
export type ExcuseKind = 'clip' | 'tiles' | 'typed' | 'pon';

export interface Excuse {
  kind: ExcuseKind;
  clipId: string | null;
  /** The clip stays on the latecomer's phone, which plays it itself. */
  local: boolean;
  durMs: number;
  /** Kana tiles, in order (cause ids, 'sorry', 'tanuki'). */
  tiles: string[];
  /** Typed excuse (quiet mode). */
  text: string | null;
  /** What the recogniser heard in the clip. */
  heard: Utterance | null;
  /** The server had speech-to-text for the clip. */
  checked: boolean;
  /** Pon read it: the latecomer's mic pass. */
  micPass: boolean;
  /** Pon stood in: nothing came from the latecomer in time. */
  standIn: boolean;
}

export type Step = 'scene' | 'plan' | 'record' | 'play' | 'gist' | 'vote' | 'ruling' | 'booth' | 'truth';

export interface LedgerEntry {
  round: number;
  playerId: string;
  points: number;
  why: 'leaf' | 'alibi' | 'chief' | 'bet' | 'check' | 'catch' | 'coop' | 'spoke' | 'stake' | 'curve';
}

export interface Ruling {
  call: 'safe' | 'out' | null;
  voters: number;
  /** Voters who held a leaf when the vote opened: the room is them (every voter with free votes). */
  holders: number;
  gave: number;
  /** The room's verdict: more than half the leaf holders gave a leaf. Null on an exact split (the chief's call stands). */
  roomSafe: boolean | null;
  /** The chief's call went against the room: the room's verdict stands on the stamp. */
  overruled: boolean;
  tier: 'flop' | 'good' | 'ippon';
  /** Co-op: the cause the chief named. */
  coopPick: string | null;
}

export interface LateRound {
  index: number;
  sceneId: string;
  options: [string, string, string];
  latecomer: string;
  /** Null: Pon is the witness (two players). */
  witness: string | null;
  chief: string | null;
  gallery: string[];
  level: Level;
  cause: string;
  /** The latecomer chose the cause (or it was dealt: the blind variant, or the plan beat ran out). */
  picked: boolean;
  ready: boolean;
  /** Kana tiles tapped so far; they go in by themselves if the timer runs out. */
  draft: string[];
  excuse: Excuse | null;
  alibi: string | null;
  bets: Record<string, string>;
  checks: Record<string, number>;
  /** The check's options for this round, in shown order: index 0 of the cause's list is right. */
  checkOrder: number[];
  catchTiles: string[];
  catches: Record<string, string[]>;
  leaves: Record<string, boolean>;
  /** Voters holding a leaf when the vote opened. */
  held: string[];
  call: 'safe' | 'out' | null;
  coopPick: string | null;
  hidden: boolean;
  /** The latecomer can't see the witness's options: their cause is dealt (the blindLatecomer setting). */
  blind: boolean;
  step: Step;
  stepAt: number;
  ruling: Ruling | null;
  /** The chunk heard in the excuse, for the booth; null skips it. */
  chunk: Chunk | null;
  /** The real story: a cause nobody was dealt this game, or null for Pon himself. */
  truth: string | null;
  /** The latecomer opened "Need a hint?": the excuse counts as read, not said from memory. */
  hinted: boolean;
  /** The game's last round. */
  finale: boolean;
  /** N4 and up: the excuse is the cause's ask line (N4_ASKS), when it has one. */
  ask?: boolean;
}

export interface PlayerStats {
  leaves: number;
  alibis: number;
  chiefRight: number;
  listen: number;
  late: number;
}

export interface LateState {
  round: number;
  totalRounds: number;
  audience: Audience;
  /** Seat order, from a random start: the latecomer order. */
  order: string[];
  rounds: LateRound[];
  /** Leaves each player holds now. */
  leaves: Record<string, number>;
  micPassUsed: Record<string, boolean>;
  /** Witnesses who have played their curveball (once a game). */
  curveUsed: Record<string, boolean>;
  chiefTurns: Record<string, number>;
  lastChief: Record<string, number>;
  /** Causes already used as a round's real story: never twice in a game. */
  truths: string[];
  ledger: LedgerEntry[];
  stats: Record<string, PlayerStats>;
  settings: { leafBudget: boolean; witnessSeesOptions: boolean };
  coop: boolean;
  phaseAt: number;
}

// ---- view ----

export interface TileView {
  id: string;
  word: JpText;
  picture: string;
  emoji: string;
  romaji?: string;
}

export interface LateView {
  mode: 'late-again';
  round: number;
  totalRounds: number;
  phaseAt: number;
  step: Step | null;
  stepAt: number;
  coop: boolean;
  /** Two players: Pon's record for the team (both scores together), and the team's score so far. */
  ponRecord: number | null;
  teamScore: number | null;
  /** late: how late, climbing from ごふん to いちねん over the game. */
  scene: { id: string; place: JpText; emoji: string; late: JpText } | null;
  cast: { latecomer: string; witness: string | null; chief: string | null; gallery: string[] } | null;
  /** The witness's three causes: everyone sees them (they are the bet tiles too). Each phone gets its own order. */
  options: TileView[];
  /** Each voter's leaves held (the chief reads the room from these), and whether they've voted (never how). */
  voters: { playerId: string; leaves: number; voted: boolean }[];
  /** Voters holding a leaf: how many can say Safe this round. */
  holders: number;
  /** Lock-ins for the TV's seat chips: what's in, never what was chosen. */
  locked: { ready: boolean; excuse: boolean; alibi: boolean; bets: string[]; called: boolean };
  /** From the play beat. */
  play: { kind: ExcuseKind; clipId: string | null; local: boolean; durMs: number; at: number; tiles: TileView[]; micPass: boolean; standIn: boolean; hidden: boolean } | null;
  /** From the gist beat. */
  gist: {
    cause: TileView;
    gist: JpText & { romaji?: string };
    /** What was said or typed, as heard (untrusted player text). */
    subtitle: string | null;
    alibi: { pick: TileView | null; match: boolean; curveball: boolean; pon: boolean };
  } | null;
  /** From the ruling beat. */
  ruling: (Ruling & { points: { playerId: string; points: number }[] }) | null;
  booth: { line: string; chunk: string; note: string; tag: string } | null;
  /** The real story, at the round's last beat: the cause's picture (none for Pon) and Pon's line, after a pause. */
  truth: { picture: string | null; emoji: string; line: JpText; pauseMs: number } | null;
  ledger: LedgerEntry[];
  me: LateMe | null;
}

export interface LateMe {
  role: Role | null;
  level: Level;
  /** The latecomer's own cause pick (never anyone else's). */
  cause: string | null;
  /** The latecomer may choose which of the witness's causes to blame (off in the blind variant). */
  canPick: boolean;
  /** This round's pick, alibi and bets are locked: the call has started. */
  lockedIn: boolean;
  /** A typed excuse is accepted now (quiet mode, or the mic won't open). */
  canType: boolean;
  /** frame: N5's fill-in sentence frame, the first step behind "Need a hint?" (Pon's version is the second). */
  mission: { text: string; model: JpText & { romaji?: string }; frame?: JpText & { romaji?: string } } | null;
  /** Kana latecomer: the tiles to build the excuse from, and what's been tapped. */
  tiles: TileView[];
  draft: string[];
  ready: boolean;
  sent: boolean;
  limitMs: number;
  micPassLeft: boolean;
  /** Witness: the tiles to pick from (the three causes and the curveball), and the pick. */
  alibiTiles: TileView[];
  alibi: string | null;
  bet: string | null;
  check: { q: string; options: string[]; picked: number | null; right: number | null } | null;
  catchTiles: (TileView & { tapped: boolean })[];
  leaves: number;
  canVote: boolean;
  /** A voter with no leaf to give this round: they count as voted. */
  noLeaf: boolean;
  gave: boolean | null;
  call: 'safe' | 'out' | null;
  coopPick: string | null;
  /** The gist at this phone's level, once allowed. */
  gist: (JpText & { romaji?: string }) | null;
  /** This round's points so far (after the ruling). */
  points: number | null;
  /** This round's points by reason (after the ruling). */
  breakdown: { why: LedgerEntry['why']; points: number }[];
  /** The chief: their call matched the room (null on a split, in co-op, or before the ruling). */
  readRoom: boolean | null;
  /**
   * The latecomer's private note at the ruling: Pon's version, whether their own excuse used it, whether it
   * came from memory or with the hint open, and what was heard (untrusted player text).
   */
  note: { model: JpText; used: boolean; hinted: boolean; fromMemory: boolean; said: string | null } | null;
}

export type LateMove =
  | { kind: 'cause'; round: number; causeId: string }
  | { kind: 'ready'; round: number }
  | { kind: 'tiles'; round: number; tiles: string[] }
  | { kind: 'excuse'; round: number; type: ExcuseKind; clipId?: string | null; local?: boolean; durMs?: number; heard?: Utterance | null; checked?: boolean; text?: string; tiles?: string[] }
  | { kind: 'micPass'; round: number }
  | { kind: 'hint'; round: number }
  | { kind: 'alibi'; round: number; tileId: string }
  | { kind: 'bet'; round: number; causeId: string }
  | { kind: 'check'; round: number; option: number }
  | { kind: 'catch'; round: number; wordId: string }
  | { kind: 'leaf'; round: number; give: boolean }
  | { kind: 'rule'; round: number; call: 'safe' | 'out' }
  | { kind: 'pick'; round: number; causeId: string }
  | { kind: 'hide'; round: number };

// ---- helpers ----

const blankStats = (): PlayerStats => ({ leaves: 0, alibis: 0, chiefRight: 0, listen: 0, late: 0 });
const statsOf = (s: LateState, id: string) => (s.stats[id] ??= blankStats());
export const current = (s: LateState): LateRound | null => s.rounds[s.round - 1] ?? null;
const causeOfRound = (r: LateRound): Cause => causeOf(r.cause) ?? CAUSES[0]!;
/** The latecomer's line: the last round (a year late) opens with the deepest apology. */
const lineOf = (r: LateRound) => lineFor(causeOfRound(r), r.level, { finale: r.finale, ask: r.ask });
/** The line the round's latecomer works from (their mission and Pon's version), for the cause they blame. */
export const roundLine = (r: LateRound) => lineOf(r);

/** Rounds for `n` players: the smallest multiple of n that is 6 or more (one lap with `oneLap`). */
export function roundsFor(n: number, oneLap = false): number {
  const p = Math.max(1, n);
  if (oneLap) return Math.max(p, 2);
  return Math.ceil(MIN_ROUNDS / p) * p;
}

/**
 * Does the reading of what was heard contain any of these kana? Plain normalised readings: the lenient
 * sound key would merge sounds across word boundaries (もって いきました would "say" えき).
 */
export function heardAny(reading: string, keys: readonly string[]): boolean {
  const said = normalizeReading(reading);
  return keys.some((k) => {
    const key = normalizeReading(k);
    return key.length > 0 && said.includes(key);
  });
}

/** What the excuse "said", as a reading, for checking words and chunks: null when nobody can tell (no speech-to-text). */
export function excuseReading(r: LateRound): string | null {
  const x = r.excuse;
  if (!x) return null;
  if (x.kind === 'pon') {
    const c = causeOfRound(r);
    return (r.level === 'kana' ? kanaLine(c) : lineOf(r).model).kana;
  }
  if (x.kind === 'tiles') return x.tiles.map((t) => tileWord(t, r)?.kana ?? '').join(' ');
  if (x.kind === 'typed') return x.text;
  return x.heard ? utteranceReading(x.heard) : null;
}

function tileWord(id: string, r?: LateRound): JpText | null {
  if (id === SORRY_TILE.id) return SORRY_TILE.word;
  if (id === SOUND_TILE_ID) return r ? causeOfRound(r).sound : null;
  if (id === TANUKI_TILE.id) return TANUKI_TILE.word;
  return causeOf(id)?.word ?? null;
}

/** A tile for the screens. Pictures named 'sorry' and 'sound' have no art: the screens show the emoji. */
export function tileView(id: string, level: Level, r?: LateRound): TileView {
  const c = causeOf(id);
  const word = tileWord(id, r) ?? { text: id, kana: id, en: id };
  const picture = c ? c.picture : id === TANUKI_TILE.id ? TANUKI_TILE.picture : id === SOUND_TILE_ID ? 'sound' : 'sorry';
  const emoji = c ? c.emoji : id === TANUKI_TILE.id ? TANUKI_TILE.emoji : id === SOUND_TILE_ID ? '💬' : '🙇';
  return { id, word, picture, emoji, ...(level === 'kana' ? { romaji: toRomaji(word.kana) } : {}) };
}

const withRomaji = (t: JpText, level: Level): JpText & { romaji?: string } => (level === 'kana' ? { ...t, romaji: toRomaji(t.kana) } : t);

/** Who votes this round: the witness and the gallery. */
export const votersOf = (r: LateRound): string[] => [...(r.witness ? [r.witness] : []), ...r.gallery];

/** The play beat's length for this excuse. */
export function playMs(x: Excuse | null): number {
  if (!x) return PON_PLAY_MS;
  switch (x.kind) {
    case 'clip':
      return x.durMs + PLAY_TAIL_MS;
    case 'tiles':
      return Math.max(1, x.tiles.length) * TILE_MS + PLAY_TAIL_MS;
    case 'typed':
      return TYPED_PLAY_MS;
    case 'pon':
      return PON_PLAY_MS;
  }
}

const alibiMatch = (r: LateRound): boolean => !!r.alibi && r.alibi === r.cause;
const gistMs = (r: LateRound): number => (r.witness && !alibiMatch(r) ? GIST_MISS_MS : GIST_MS);

/** The listening check counts only when the excuse can be heard and named its cause (or nobody could tell). */
export function checkable(r: LateRound): boolean {
  const x = r.excuse;
  if (!x || r.hidden) return false;
  if (x.kind === 'tiles' || x.kind === 'typed') return false;
  if (x.kind === 'pon') return true;
  if (!x.checked) return true;
  const reading = excuseReading(r);
  return !!reading && heardAny(reading, causeOfRound(r).keys);
}

/** Which word-catch tiles were really in the excuse. Without speech-to-text, the cause's word and the apology count. */
export function wordsInExcuse(r: LateRound): Set<string> {
  const out = new Set<string>();
  const reading = excuseReading(r);
  const x = r.excuse;
  if (!x || r.hidden) return out;
  if (reading === null) {
    out.add(r.cause);
    out.add(SORRY_TILE.id);
    return out;
  }
  for (const id of r.catchTiles) {
    const keys = id === SORRY_TILE.id ? SORRY_TILE.keys : (causeOf(id)?.keys ?? []);
    if (heardAny(reading, keys)) out.add(id);
  }
  return out;
}

/** The chunk the booth can call out: the latecomer's line has one and their own excuse used it (never Pon's reading). */
export function chunkHeard(r: LateRound): Chunk | null {
  if (r.level === 'kana' || r.hidden || !r.excuse || r.excuse.kind === 'pon') return null;
  const chunk = lineOf(r).chunk;
  if (!chunk) return null;
  const reading = excuseReading(r);
  return reading && heardAny(reading, chunk.keys) ? chunk : null;
}

/** The latecomer's own clip named its cause, as speech-to-text heard it. */
export function causeNamed(r: LateRound): boolean {
  if (r.excuse?.kind !== 'clip' || !r.excuse.checked) return false;
  const reading = excuseReading(r);
  return !!reading && heardAny(reading, causeOfRound(r).keys);
}

/** The excuse counts as said out loud: the latecomer's own clip, and (where speech-to-text could tell) it named the cause or used the chunk. */
export function saidAloud(r: LateRound): boolean {
  const x = r.excuse;
  if (!x || x.kind !== 'clip') return false;
  if (!x.checked || r.level === 'kana') return true;
  return causeNamed(r) || !!chunkHeard(r);
}

/** Voters who can say Safe this round: everyone with free votes, else those holding a leaf when the vote opened. */
const holdersOf = (s: LateState, r: LateRound): string[] => (s.settings.leafBudget ? r.held : votersOf(r));

function pay(s: LateState, ctx: ModeContext, playerId: string, points: number, why: LedgerEntry['why']): void {
  if (!points || !ctx.player(playerId)) return;
  ctx.award(playerId, points);
  s.ledger.push({ round: s.round, playerId, points, why });
}

/** Deals this round's roles. */
export function dealRoles(s: LateState, ctx: ModeContext): Pick<LateRound, 'latecomer' | 'witness' | 'chief' | 'gallery'> {
  const here = new Set(ctx.connected().map((p) => p.id));
  const seated = s.order.filter((id) => ctx.player(id));
  const lateCount = (id: string) => statsOf(s, id).late;
  // The lap order, from this round's slot; a player away now is skipped (they're owed the turn while it lasts).
  const n = seated.length;
  const start = n ? (s.round - 1) % n : 0;
  const lap = [...seated.slice(start), ...seated.slice(0, start)];
  const fewest = Math.min(...seated.map(lateCount));
  const latecomer = lap.find((id) => here.has(id) && lateCount(id) === fewest) ?? lap.find((id) => here.has(id)) ?? lap[0]!;
  const after = (id: string) => {
    const i = seated.indexOf(id);
    return [...seated.slice(i + 1), ...seated.slice(0, i)];
  };
  const others = after(latecomer).filter((id) => here.has(id));
  if (others.length <= 1) return { latecomer, witness: null, chief: others[0] ?? null, gallery: [] };
  const witness = others[0]!;
  const rest = others.slice(1);
  const prev = current(s)?.chief ?? s.rounds.at(-1)?.chief ?? null;
  const rank: Record<Level, number> = { kana: 0, n5: 1, n4: 2, n3: 3 };
  const candidates = rest.filter((id) => rest.length < 2 || id !== prev);
  const pool = candidates.length ? candidates : rest;
  const chief = [...pool].sort(
    (a, b) =>
      (s.chiefTurns[a] ?? 0) - (s.chiefTurns[b] ?? 0) ||
      rank[ctx.player(a)?.level ?? 'n5'] - rank[ctx.player(b)?.level ?? 'n5'] ||
      (s.lastChief[a] ?? 0) - (s.lastChief[b] ?? 0),
  )[0]!;
  return { latecomer, witness, chief, gallery: rest.filter((id) => id !== chief) };
}

function startRound(s: LateState, ctx: ModeContext): LateRound {
  s.round += 1;
  // Pon's leaves: one more for everyone at the start of rounds 3, 5, 7 …
  if (s.round >= 3 && s.round % 2 === 1) for (const p of ctx.players()) s.leaves[p.id] = Math.min(MAX_LEAVES, (s.leaves[p.id] ?? START_LEAVES) + 1);
  const roles = dealRoles(s, ctx);
  // The finale scene is saved for the last round, where the room has one.
  const usedScenes = new Set(s.rounds.map((r) => r.sceneId));
  const last = s.round === s.totalRounds;
  const all = scenesFor(s.audience);
  const finale = all.filter((x) => x.finale);
  const pool = last && finale.length ? finale : all.filter((x) => !x.finale);
  const fresh = pool.filter((x) => !usedScenes.has(x.id));
  const scenes = fresh.length ? fresh : pool;
  const scene = scenes[Math.floor(ctx.random() * scenes.length)]!;
  const recent = new Set(s.rounds.slice(-2).flatMap((r) => r.options));
  const options = dealOptions(() => ctx.random(), recent, s.audience, scene.id);
  const level = ctx.player(roles.latecomer)?.level ?? 'n5';
  const blind = !s.settings.witnessSeesOptions && !!roles.witness;
  const truth = truthFor(() => ctx.random(), options, s.audience, new Set([...s.truths, ...s.rounds.map((x) => x.cause)]));
  if (truth) s.truths.push(truth);
  const r: LateRound = {
    index: s.round,
    sceneId: scene.id,
    options,
    ...roles,
    level,
    cause: options[Math.floor(ctx.random() * 3)]!,
    picked: blind,
    ready: false,
    draft: [],
    excuse: null,
    alibi: null,
    bets: {},
    checks: {},
    checkOrder: shuffled([0, 1, 2], () => ctx.random()),
    catchTiles: shuffled([...options, SORRY_TILE.id], () => ctx.random()),
    catches: {},
    leaves: {},
    held: [],
    call: null,
    coopPick: null,
    hidden: false,
    blind,
    step: 'scene',
    stepAt: ctx.now,
    ruling: null,
    chunk: null,
    truth,
    hinted: false,
    finale: last,
  };
  // Two players: Pon is the witness, and he "probably saw it".
  if (s.coop && !r.witness) r.alibi = options[Math.floor(ctx.random() * 3)]!;
  // Drawn last, so the deal above stays as it was.
  if (n4Up(level)) r.ask = ctx.random() < ASK_CHANCE;
  s.rounds.push(r);
  statsOf(s, r.latecomer).late += 1;
  if (r.chief) {
    s.chiefTurns[r.chief] = (s.chiefTurns[r.chief] ?? 0) + 1;
    s.lastChief[r.chief] = s.round;
  }
  return r;
}

/** Locks the excuse in when the record beat ends: Kana tiles tapped so far, else Pon stands in. */
function lockExcuse(r: LateRound): void {
  if (r.excuse) return;
  if (r.draft.length) r.excuse = blankExcuse('tiles', { tiles: [...r.draft] });
  else r.excuse = blankExcuse('pon', { standIn: true });
}

const blankExcuse = (kind: ExcuseKind, extra: Partial<Excuse> = {}): Excuse => ({ kind, clipId: null, local: false, durMs: 0, tiles: [], text: null, heard: null, checked: false, micPass: false, standIn: false, ...extra });

/** The Kana excuse's cause is the first cause tile in it. */
function causeFromTiles(r: LateRound, tiles: readonly string[]): void {
  const first = tiles.find((t) => r.options.includes(t));
  if (first) r.cause = first;
}

function settle(s: LateState, r: LateRound, ctx: ModeContext): void {
  if (r.ruling) return;
  const voters = votersOf(r).filter((id) => ctx.player(id));
  // The room is the voters who could say Safe: a voter with no leaf left has no say this round.
  const holders = holdersOf(s, r).filter((id) => ctx.player(id));
  const giving = holders.filter((id) => r.leaves[id] === true && (!s.settings.leafBudget || (s.leaves[id] ?? 0) > 0));
  const gave = giving.length;
  const n = holders.length;
  const roomSafe = n === 0 ? null : gave * 2 > n ? true : gave * 2 === n ? null : false;
  const right = s.coop && !!r.coopPick && r.coopPick === r.cause;
  // Tiers follow the leaves: fewer than half is a flop; IPPON is every holder giving, with at least three of
  // them, or (a small room) the chief backing them with Safe. In co-op the chief's pick decides it.
  const tier: Ruling['tier'] = s.coop
    ? right ? (alibiMatch(r) ? 'ippon' : 'good') : 'flop'
    : n > 0 && gave === n && (n >= 3 || r.call === 'safe') ? 'ippon' : n === 0 || gave * 2 < n ? 'flop' : 'good';
  const overruled = !s.coop && !!r.call && roomSafe !== null && (r.call === 'safe') !== roomSafe;
  r.ruling = { call: s.coop ? null : r.call, voters: voters.length, holders: n, gave, roomSafe, overruled, tier, coopPick: r.coopPick };
  if (s.settings.leafBudget) for (const id of giving) s.leaves[id] = Math.max(0, (s.leaves[id] ?? 0) - 1);
  r.chunk = chunkHeard(r);
  const c = causeOfRound(r);
  const line = r.level === 'kana' ? kanaLine(c) : lineOf(r).model;
  const said = saidAloud(r);
  // Said from memory unless the hint was opened. Tiles, typing and Pon's reading are seen, not said; Pon's is read.
  const read = r.hinted || r.excuse?.kind === 'pon';
  ctx.phrase(r.latecomer, { itemId: `late:${c.id}:${r.level}`, text: line.text, kana: line.kana, en: line.en, outcome: said ? 'said' : 'seen', recall: read ? 'read' : 'memory' });
  if (r.hidden) return;

  if (s.coop) {
    const team = ctx.players().map((p) => p.id);
    if (right) for (const id of team) pay(s, ctx, id, POINTS.coopPick, 'coop');
    if (alibiMatch(r)) for (const id of team) pay(s, ctx, id, POINTS.alibi, 'alibi');
  } else {
    // A mic pass earns half a leaf's worth; a stand-in nothing (Pon pockets those leaves).
    const x = r.excuse;
    const perLeaf = x?.standIn ? 0 : x?.micPass ? POINTS.leafPass : POINTS.leaf;
    pay(s, ctx, r.latecomer, gave * perLeaf, 'leaf');
    statsOf(s, r.latecomer).leaves += gave;
    if (causeNamed(r) || (x?.kind === 'clip' && x.checked && !!r.chunk)) pay(s, ctx, r.latecomer, POINTS.spoke, 'spoke');
    // The curveball takes the blame: the latecomer still gets the alibi points, and the witness wins big if the room says Safe anyway.
    if (r.witness && r.alibi === TANUKI_TILE.id) {
      s.curveUsed[r.witness] = true;
      pay(s, ctx, r.latecomer, POINTS.alibi, 'alibi');
      if (roomSafe === true) pay(s, ctx, r.witness, POINTS.curve, 'curve');
    }
    if (r.witness && alibiMatch(r)) {
      pay(s, ctx, r.latecomer, POINTS.alibi, 'alibi');
      pay(s, ctx, r.witness, POINTS.alibi, 'alibi');
      statsOf(s, r.latecomer).alibis += 1;
      statsOf(s, r.witness).alibis += 1;
    }
    if (roomSafe === true) for (const id of giving) pay(s, ctx, id, POINTS.stake, 'stake');
    if (r.chief && r.call && n) {
      const pts = roomSafe === null ? POINTS.chiefHalf : (r.call === 'safe') === roomSafe ? POINTS.chief : 0;
      pay(s, ctx, r.chief, pts, 'chief');
      if (pts === POINTS.chief) statsOf(s, r.chief).chiefRight += 1;
    }
    for (const [id, causeId] of Object.entries(r.bets)) if (causeId === r.cause && r.gallery.includes(id)) pay(s, ctx, id, POINTS.bet, 'bet');
  }
  // Listening: checks for N4 phones, word catch for Kana and N5. Misses are never shown or charged.
  if (checkable(r)) {
    for (const [id, opt] of Object.entries(r.checks)) {
      if (r.checkOrder[opt] === 0) {
        pay(s, ctx, id, POINTS.check, 'check');
        statsOf(s, id).listen += POINTS.check;
      }
    }
  }
  const inExcuse = wordsInExcuse(r);
  for (const [id, words] of Object.entries(r.catches)) {
    const hit = words.filter((w) => inExcuse.has(w)).length;
    const wrong = words.length - hit;
    const pts = Math.min(POINTS.catchMax, Math.max(0, hit - wrong) * POINTS.catchWord);
    pay(s, ctx, id, pts, 'catch');
    statsOf(s, id).listen += pts;
  }
}

/**
 * The cause is what was said: when speech-to-text heard exactly one of the other options and not the one
 * tapped, the excuse blamed that one.
 */
function causeFromHeard(r: LateRound): void {
  if (r.excuse?.kind !== 'clip' || !r.excuse.checked || r.blind) return;
  const reading = excuseReading(r);
  if (!reading) return;
  const heard = r.options.filter((id) => heardAny(reading, causeOf(id)?.keys ?? []));
  if (heard.length === 1 && heard[0] !== r.cause) r.cause = heard[0]!;
}

function parseHeard(raw: unknown): Utterance | null {
  if (raw === null || raw === undefined || !isUtterance(raw) || raw.via !== 'speech') return null;
  return { via: 'speech', text: raw.text.slice(0, 160), ...(raw.reading !== undefined ? { reading: String(raw.reading).slice(0, 320) } : {}) };
}

/** The latecomer may still build or send the excuse until the record beat ends. */
const choosing = (phase: Phase, r: LateRound): boolean => (phase === 'prompt' && r.step === 'plan') || phase === 'answer';
/** Picks, the alibi and the bets lock when the call starts: before the room hears a word. */
const planning = (phase: Phase): boolean => phase === 'prompt';

// ---- the mode ----

export const lateAgainMode: Mode<LateState, LateView> = {
  info: {
    id: 'late-again',
    title: 'Late Again!',
    titleJa: 'また ちこく！',
    blurb: 'Late for work again: phone the boss with an excuse. The room decides if you’re Safe or Out.',
    host: 'pon',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your excuses',
    phaseLabels: { prompt: 'Late!', answer: 'The call', reveal: 'The excuse', encore: 'Safe or Out?', score: 'Ruling' },
    extras: [
      { key: 'oneLap', label: 'One turn each (shorter game)' },
      { key: 'freeVotes', label: 'Votes are free (no leaves)' },
      { key: 'blindLatecomer', label: 'The latecomer can’t see the witness’s options' },
    ],
  },

  setup(ctx, opts) {
    const players = ctx.players();
    const extra = opts.extra ?? {};
    const start = Math.floor(ctx.random() * Math.max(1, players.length));
    const ids = players.map((p) => p.id);
    const order = [...ids.slice(start), ...ids.slice(0, start)];
    const leaves: Record<string, number> = {};
    const stats: Record<string, PlayerStats> = {};
    for (const id of ids) {
      leaves[id] = START_LEAVES;
      stats[id] = blankStats();
    }
    return {
      round: 0,
      totalRounds: roundsFor(players.length, extra.oneLap === true),
      audience: ctx.audience ?? 'family',
      order,
      rounds: [],
      leaves,
      micPassUsed: {},
      curveUsed: {},
      chiefTurns: {},
      lastChief: {},
      truths: [],
      ledger: [],
      stats,
      settings: { leafBudget: extra.freeVotes !== true, witnessSeesOptions: extra.blindLatecomer !== true },
      coop: players.length <= 2,
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
    const step = (r: LateRound, st: Step) => {
      r.step = st;
      r.stepAt = ctx.now;
    };
    switch (phase) {
      case 'intro':
        // The premise is told the same way every game; the co-op welcome is Pon's to vary.
        if (s.coop) ctx.cue({ host: 'pon', event: 'late_coop' });
        else ctx.cue({ host: 'pon', event: 'late_line', slots: quip(PREMISE) });
        break;
      case 'prompt': {
        const r = startRound(s, ctx);
        step(r, 'scene');
        const scene = sceneOf(r.sceneId)!;
        const late = latenessFor(r.index, s.totalRounds);
        const name = ctx.player(r.latecomer)?.name ?? '';
        // The first rung has its own gag; the rest read the scene's opener.
        const tail = late.quip ?? scene.opener;
        ctx.cue({ host: 'pon', event: 'late_line', slots: quip({ text: `${name}さん、${late.text}の ちこく！？ ${tail.text}`, kana: `${name}さん、${late.kana}の ちこく！？ ${tail.kana}`, en: `${name}, ${late.en} late?! ${tail.en}` }) });
        break;
      }
      case 'answer': {
        const r = current(s)!;
        step(r, 'record');
        // Nothing tapped in time: the dealt cause stands.
        r.picked = true;
        break;
      }
      case 'reveal': {
        const r = current(s)!;
        step(r, 'play');
        const x = r.excuse!;
        if (x.kind === 'pon') {
          const c = causeOfRound(r);
          const line = r.level === 'kana' ? kanaLine(c) : lineOf(r).model;
          ctx.cue({ host: 'pon', event: x.micPass ? 'late_mic_pass' : 'late_stand_in', slots: { name: ctx.player(r.latecomer)?.name ?? '', line: line.kana } });
        }
        break;
      }
      case 'encore': {
        const r = current(s)!;
        step(r, 'vote');
        r.held = votersOf(r).filter((id) => (s.leaves[id] ?? 0) > 0);
        if (!r.hidden) ctx.cue({ host: 'pon', event: 'late_vote', slots: { name: r.chief ? (ctx.player(r.chief)?.name ?? '') : '' } });
        break;
      }
      case 'score': {
        const r = current(s)!;
        step(r, 'ruling');
        settle(s, r, ctx);
        if (r.hidden) ctx.cue({ host: 'pon', event: 'late_hidden' });
        else {
          const tier = r.ruling?.tier;
          ctx.cue({ host: 'pon', event: 'late_line', ...(tier ? { tier } : {}), slots: quip(reactionOf(s, r)), atMs: RULING_LINE_AT_MS });
          if (r.ruling?.overruled && r.chief) ctx.cue({ host: 'pon', event: 'late_misread', slots: { name: ctx.player(r.chief)?.name ?? '' }, atMs: MISREAD_AT_MS });
        }
        // The real story is the round's last line: start writing it now.
        ctx.cue({ host: 'pon', event: 'late_truth', slots: quip(truthOf(s, r).line), ahead: true });
        break;
      }
    }
  },

  leave(s, phase) {
    const r = current(s);
    if (!r) return;
    if (phase === 'answer') {
      lockExcuse(r);
      causeFromHeard(r);
    }
    if (phase === 'prompt' && r.step === 'scene') r.step = 'plan';
  },

  duration(s, phase) {
    const r = current(s);
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return SCENE_MS + PLAN_MS;
      case 'answer':
        return (r ? RECORD_MS[r.level] : RECORD_MS.n5) + UPLOAD_MS + GRACE_MS;
      case 'reveal':
        return r ? playMs(r.excuse) + gistMs(r) : PON_PLAY_MS + GIST_MS;
      case 'encore':
        return VOTE_MS;
      case 'score':
        return RULING_MS + (r && chunkHeard(r) ? BOOTH_MS : 0) + TRUTH_MS;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const r = current(s);
    if (!r) return false;
    const here = (id: string | null) => !!id && ctx.connected().some((p) => p.id === id);
    if (phase === 'prompt') {
      // Ready (or an early excuse) ends the plan beat, once the witness has backed a cause.
      const witnessIn = !r.witness || !here(r.witness) || !!r.alibi;
      return r.step === 'plan' && witnessIn && (r.ready || !!r.excuse || !here(r.latecomer));
    }
    if (phase === 'answer') return !!r.excuse || !here(r.latecomer);
    if (phase === 'encore') {
      if (r.hidden) return true;
      const holders = new Set(holdersOf(s, r));
      // A voter with no leaf has nothing to decide.
      const voted = votersOf(r).every((id) => !here(id) || !holders.has(id) || id in r.leaves);
      const called = !r.chief || !here(r.chief) || (s.coop ? !!r.coopPick : !!r.call);
      return voted && called;
    }
    return false;
  },

  wakeAt(s, phase) {
    const r = current(s);
    if (!r) return null;
    if (phase === 'prompt' && r.step === 'scene') return r.stepAt + SCENE_MS;
    if (phase === 'reveal' && r.step === 'play') return r.stepAt + playMs(r.excuse);
    if (phase === 'score' && r.step === 'ruling') return r.stepAt + RULING_MS;
    if (phase === 'score' && r.step === 'booth') return r.stepAt + BOOTH_MS;
    return null;
  },

  wake(s, phase, ctx) {
    const r = current(s);
    if (!r) return;
    if (phase === 'prompt' && r.step === 'scene') {
      r.step = 'plan';
      r.stepAt = ctx.now;
    } else if (phase === 'reveal' && r.step === 'play') {
      r.step = 'gist';
      r.stepAt = ctx.now;
      if (r.hidden) return;
      // Pon reacts as the alibi card flips over on the TV.
      if (r.witness && r.alibi === TANUKI_TILE.id) ctx.cue({ host: 'pon', event: 'late_curveball', slots: { name: ctx.player(r.witness)?.name ?? '' }, atMs: ALIBI_FLIP_MS });
      else if (r.witness && !alibiMatch(r)) ctx.cue({ host: 'pon', event: 'late_alibi_miss', atMs: ALIBI_FLIP_MS });
      else if (r.witness) ctx.cue({ host: 'pon', event: 'late_alibi_match', atMs: ALIBI_FLIP_MS });
    } else if (phase === 'score' && (r.step === 'ruling' || r.step === 'booth')) {
      r.step = r.step === 'ruling' && r.chunk ? 'booth' : 'truth';
      r.stepAt = ctx.now;
      if (r.step === 'booth') ctx.cue({ host: 'pon', event: 'late_booth' });
      else ctx.cue({ host: 'pon', event: 'late_truth', slots: quip(truthOf(s, r).line), atMs: TRUTH_PAUSE_MS });
    }
  },

  clipsInUse(s, phase) {
    const r = current(s);
    if (!r?.excuse?.clipId || r.hidden) return [];
    return phase === 'answer' || phase === 'reveal' || phase === 'encore' ? [r.excuse.clipId] : [];
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== s.round) return moveError('wrong-phase');
    const r = current(s);
    if (!r) return moveError('wrong-phase');
    const isLate = playerId === r.latecomer;
    switch (raw.kind) {
      case 'cause': {
        if (!isLate) return moveError('not-yours');
        if (!planning(phase) || r.excuse) return moveError('wrong-phase');
        if (r.blind) return moveError('blind');
        if (typeof raw.causeId !== 'string' || !r.options.includes(raw.causeId)) return moveError('bad-move');
        r.cause = raw.causeId;
        r.picked = true;
        return MOVE_OK;
      }
      case 'ready': {
        if (!isLate) return moveError('not-yours');
        if (phase !== 'prompt' || r.step !== 'plan') return moveError('wrong-phase');
        r.ready = true;
        return MOVE_OK;
      }
      case 'tiles': {
        if (!isLate || r.level !== 'kana') return moveError('not-yours');
        if (!choosing(phase, r) || r.excuse) return moveError('wrong-phase');
        const tiles = parseTiles(r, raw.tiles);
        if (!tiles) return moveError('bad-move');
        r.draft = tiles;
        causeFromTiles(r, tiles);
        if (tiles.some((t) => r.options.includes(t))) r.picked = true;
        return MOVE_OK;
      }
      case 'excuse': {
        if (!isLate) return moveError('not-yours');
        if (!choosing(phase, r)) return moveError('wrong-phase');
        if (r.excuse) return moveError('already-sent');
        if (raw.type === 'tiles') {
          const tiles = parseTiles(r, raw.tiles);
          if (!tiles || !tiles.length) return moveError('bad-move');
          causeFromTiles(r, tiles);
          r.picked = true;
          r.excuse = blankExcuse('tiles', { tiles });
          return MOVE_OK;
        }
        // Typing (quiet mode, or no mic) is open from the plan beat; a clip only once the call starts.
        if (raw.type === 'typed') {
          if (r.level === 'kana') return moveError('bad-move');
          const text = cleanText(raw.text, 80);
          if (!text) return moveError('empty');
          r.picked = true;
          r.excuse = blankExcuse('typed', { text });
          return MOVE_OK;
        }
        if (phase !== 'answer') return moveError('wrong-phase');
        if (raw.type !== 'clip') return moveError('bad-move');
        const clipId = typeof raw.clipId === 'string' && raw.clipId.length <= 64 ? raw.clipId : null;
        const local = raw.local === true;
        if (!clipId && !local) return moveError('no-clip');
        const dur = typeof raw.durMs === 'number' && Number.isFinite(raw.durMs) ? raw.durMs : RECORD_MS[r.level];
        r.excuse = blankExcuse('clip', {
          clipId: local ? null : clipId,
          local,
          durMs: Math.max(MIN_CLIP_MS, Math.min(RECORD_MS[r.level] + 500, Math.round(dur))),
          heard: parseHeard(raw.heard),
          checked: raw.checked === true,
        });
        return MOVE_OK;
      }
      case 'micPass': {
        if (!isLate) return moveError('not-yours');
        if (!choosing(phase, r)) return moveError('wrong-phase');
        if (r.excuse) return moveError('already-sent');
        if (s.micPassUsed[playerId]) return moveError('no-pass-left');
        s.micPassUsed[playerId] = true;
        r.excuse = blankExcuse('pon', { micPass: true });
        return MOVE_OK;
      }
      case 'hint': {
        if (!isLate) return moveError('not-yours');
        r.hinted = true;
        return MOVE_OK;
      }
      case 'alibi': {
        if (playerId !== r.witness) return moveError('not-yours');
        if (!planning(phase)) return moveError('wrong-phase');
        if (typeof raw.tileId !== 'string' || (!r.options.includes(raw.tileId) && raw.tileId !== TANUKI_TILE.id)) return moveError('bad-move');
        if (raw.tileId === TANUKI_TILE.id && s.curveUsed[playerId]) return moveError('no-curveball-left');
        r.alibi = raw.tileId;
        return MOVE_OK;
      }
      case 'bet': {
        if (!r.gallery.includes(playerId)) return moveError('not-yours');
        if (!planning(phase)) return moveError('wrong-phase');
        if (typeof raw.causeId !== 'string' || !r.options.includes(raw.causeId)) return moveError('bad-move');
        r.bets[playerId] = raw.causeId;
        return MOVE_OK;
      }
      case 'check': {
        if (isLate) return moveError('not-yours');
        if (!n4Up(ctx.player(playerId)?.level)) return moveError('not-yours');
        if (phase !== 'reveal' || r.step !== 'play') return moveError('wrong-phase');
        if (playerId in r.checks) return moveError('already-sent');
        const opt = raw.option;
        if (typeof opt !== 'number' || !Number.isInteger(opt) || opt < 0 || opt > 2) return moveError('bad-move');
        r.checks[playerId] = opt;
        return MOVE_OK;
      }
      case 'catch': {
        if (isLate) return moveError('not-yours');
        const lvl = ctx.player(playerId)?.level;
        if (lvl !== 'kana' && lvl !== 'n5') return moveError('not-yours');
        if (phase !== 'reveal' || r.step !== 'play') return moveError('wrong-phase');
        if (typeof raw.wordId !== 'string' || !r.catchTiles.includes(raw.wordId)) return moveError('bad-move');
        const mine = (r.catches[playerId] ??= []);
        if (!mine.includes(raw.wordId)) mine.push(raw.wordId);
        return MOVE_OK;
      }
      case 'leaf': {
        if (!votersOf(r).includes(playerId)) return moveError('not-yours');
        if (phase !== 'encore') return moveError('wrong-phase');
        if (typeof raw.give !== 'boolean') return moveError('bad-move');
        if (raw.give && s.settings.leafBudget && ((s.leaves[playerId] ?? 0) <= 0 || !r.held.includes(playerId))) return moveError('no-leaf');
        r.leaves[playerId] = raw.give;
        return MOVE_OK;
      }
      case 'rule': {
        if (playerId !== r.chief) return moveError('not-yours');
        // Co-op has no Safe or Out: naming the cause is the chief's whole call.
        if (s.coop) return moveError('coop');
        if (phase !== 'encore') return moveError('wrong-phase');
        if (raw.call !== 'safe' && raw.call !== 'out') return moveError('bad-move');
        r.call = raw.call;
        return MOVE_OK;
      }
      case 'pick': {
        if (playerId !== r.chief || !s.coop) return moveError('not-yours');
        if (phase !== 'encore' && !(phase === 'reveal' && r.step === 'gist')) return moveError('wrong-phase');
        if (r.coopPick) return moveError('already-sent');
        if (typeof raw.causeId !== 'string' || !r.options.includes(raw.causeId)) return moveError('bad-move');
        r.coopPick = raw.causeId;
        return MOVE_OK;
      }
      case 'hide': {
        if (ctx.vipId !== playerId) return moveError('not-vip');
        if (phase !== 'reveal' && phase !== 'encore') return moveError('wrong-phase');
        if (!r.excuse || r.excuse.kind === 'pon') return moveError('nothing-to-hide');
        r.hidden = true;
        // The clip is replaced by Pon: if it's playing, cut to the gist now.
        if (phase === 'reveal' && r.step === 'play') r.stepAt = ctx.now - playMs(r.excuse);
        ctx.cue({ host: 'pon', event: 'late_hidden' });
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const r = current(s);
    s.order = s.order.filter((id) => id !== playerId);
    if (!r || r.ruling) return;
    r.gallery = r.gallery.filter((id) => id !== playerId);
    delete r.bets[playerId];
    delete r.checks[playerId];
    delete r.catches[playerId];
    delete r.leaves[playerId];
    if (r.witness === playerId) r.witness = null;
    if (r.chief === playerId) r.chief = null;
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  isCoop: (s) => s.coop,

  view(s, phase, viewer, ctx) {
    const r = current(s);
    const player = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const level: Level = player?.level ?? 'n5';
    const inRound = phase !== 'intro' && phase !== 'recap' && !!r;
    const pastPlay = !!r && inRound && (phase === 'encore' || phase === 'score' || (phase === 'reveal' && r.step !== 'play'));
    const playing = !!r && inRound && (phase === 'reveal' || phase === 'encore' || phase === 'score');
    const c = r ? causeOfRound(r) : null;
    const scene = r ? sceneOf(r.sceneId) : null;
    const x = r?.excuse ?? null;
    // Each phone gets its own order of the three causes, so "tap the leftmost" can't fake an alibi.
    const order = r ? (player ? phoneOrder(r, player.id) : r.options) : [];
    // Co-op: the cause stays hidden until the chief has named it.
    const coopHidden = !!r && s.coop && !r.coopPick && phase !== 'score';

    const view: LateView = {
      mode: 'late-again',
      round: s.round,
      totalRounds: s.totalRounds,
      phaseAt: s.phaseAt,
      step: inRound ? r!.step : null,
      stepAt: r?.stepAt ?? 0,
      coop: s.coop,
      ponRecord: s.coop ? ponRecord(s) : null,
      teamScore: s.coop ? s.ledger.reduce((a, e) => a + e.points, 0) : null,
      scene: inRound && scene ? { id: scene.id, place: scene.place, emoji: scene.emoji, late: latenessFor(r!.index, s.totalRounds) } : null,
      cast: inRound ? { latecomer: r!.latecomer, witness: r!.witness, chief: r!.chief, gallery: r!.gallery } : null,
      options: inRound ? order.map((id) => tileView(id, level)) : [],
      voters: inRound ? votersOf(r!).map((id) => ({ playerId: id, leaves: s.settings.leafBudget ? (s.leaves[id] ?? 0) : MAX_LEAVES, voted: id in r!.leaves || (phase === 'encore' && !holdersOf(s, r!).includes(id)) })) : [],
      holders: inRound ? (phase === 'encore' || phase === 'score' ? holdersOf(s, r!).length : votersOf(r!).filter((id) => !s.settings.leafBudget || (s.leaves[id] ?? 0) > 0).length) : 0,
      locked: inRound ? { ready: r!.ready, excuse: !!x, alibi: !!r!.alibi, bets: Object.keys(r!.bets), called: !!r!.call } : { ready: false, excuse: false, alibi: false, bets: [], called: false },
      play:
        playing && x
          ? {
              kind: r!.hidden ? 'pon' : x.kind,
              clipId: r!.hidden ? null : x.clipId,
              local: !r!.hidden && x.local,
              durMs: x.durMs,
              at: phase === 'reveal' && r!.step === 'play' ? r!.stepAt : 0,
              tiles: r!.hidden ? [] : x.tiles.map((t) => tileView(t, level, r!)),
              micPass: x.micPass,
              standIn: x.standIn,
              hidden: r!.hidden,
            }
          : null,
      gist:
        pastPlay && c && !coopHidden
          ? {
              cause: tileView(c.id, level),
              gist: withRomaji(c.gist, level),
              subtitle: r!.hidden ? null : subtitleOf(r!),
              alibi: { pick: r!.alibi ? tileView(r!.alibi, level) : null, match: alibiMatch(r!), curveball: r!.alibi === TANUKI_TILE.id, pon: !r!.witness },
            }
          : null,
      ruling: inRound && phase === 'score' && r!.ruling ? { ...r!.ruling, points: pointsOfRound(s, r!.index) } : null,
      booth: inRound && phase === 'score' && r!.step === 'booth' ? boothOf(r!) : null,
      truth: inRound && phase === 'score' && r!.step === 'truth' ? truthOf(s, r!) : null,
      ledger: phase === 'score' || phase === 'recap' ? s.ledger : [],
      me: null,
    };
    if (player && r && inRound) view.me = meView(s, r, phase, player, level);
    return view;
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: PlayerStats) => number): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = 0;
      for (const p of players) {
        const v = f(statsOf(s, p.id));
        if (v > val) [top, val] = [p, v];
      }
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best((st) => st.leaves), 'いいわけ王', 'Excuse King: most leaves won');
    add(best((st) => st.chiefRight), '見る目 大賞', 'The Boss’s Eye: read the room best');
    add(best((st) => st.alibis), 'アリバイ名人', 'Alibi Master: most alibis that matched');
    add(best((st) => st.listen), 'じごくみみ', 'Big Ears: best listener');
    if (s.coop && s.ledger.reduce((a, e) => a + e.points, 0) >= ponRecord(s)) for (const p of players) add(p, 'ポンに かった！', 'Beat Pon’s record together');
    return out;
  },
};

function parseTiles(r: LateRound, raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TILES) return null;
  const allowed = new Set([...r.options, SORRY_TILE.id, TANUKI_TILE.id]);
  // The blind variant: the latecomer's tiles hold only their own cause.
  if (r.blind) for (const id of r.options) if (id !== r.cause) allowed.delete(id);
  // The sound tile is the tapped cause's sound: it needs a cause tile with it.
  if (raw.some((t) => typeof t === 'string' && r.options.includes(t))) allowed.add(SOUND_TILE_ID);
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string' || !allowed.has(t) || out.includes(t)) return null;
    out.push(t);
  }
  return out;
}

function subtitleOf(r: LateRound): string | null {
  const x = r.excuse;
  if (!x) return null;
  if (x.kind === 'typed') return x.text;
  if (x.kind === 'clip') return x.heard?.text ?? null;
  if (x.kind === 'tiles') return x.tiles.map((t) => tileWord(t, r)?.text ?? '').join(' ');
  const c = causeOfRound(r);
  return (r.level === 'kana' ? kanaLine(c) : lineOf(r).model).text;
}

function boothOf(r: LateRound): LateView['booth'] {
  if (r.hidden || !r.chunk) return null;
  const said = r.excuse?.kind === 'clip' ? (r.excuse.heard?.text ?? null) : null;
  const model = lineOf(r).model.text;
  return { line: said ?? model, chunk: r.chunk.text, note: r.chunk.note, tag: r.chunk.tag };
}

/** The real story: the last round's is always "the boss was Pon"; after a tanuki curveball it was Pon; else the dealt truth. */
function truthOf(s: LateState, r: LateRound): NonNullable<LateView['truth']> {
  if (r.index === s.totalRounds && s.totalRounds > 1) return { picture: null, emoji: '🦝', line: truthLine(null, { finale: true }), pauseMs: TRUTH_PAUSE_MS };
  const c = r.alibi === TANUKI_TILE.id || !r.truth ? null : (causeOf(r.truth) ?? null);
  return { picture: c?.picture ?? null, emoji: c?.emoji ?? '🦝', line: truthLine(c), pauseMs: TRUTH_PAUSE_MS };
}

/** A stable per-phone order of the round's three causes. */
function phoneOrder(r: LateRound, playerId: string): string[] {
  let h = 2166136261;
  for (const ch of `${playerId}|${r.index}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...r.options];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 2654435761);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A scripted line for Pon to say as is (the bank's late_line is just its slot). */
const quip = (t: JpText): Record<string, string> => ({ quip: t.text, quip_kana: t.kana, quip_en: t.en });

/** Pon's reaction at the ruling: this cause's line for the tier, or a callback when the cause was blamed before. */
function reactionOf(s: LateState, r: LateRound): JpText {
  const c = causeOfRound(r);
  const before = s.rounds.some((x) => x.index < r.index && x.cause === r.cause && !x.hidden);
  if (before) return callbackLine(c);
  return c.pon[r.ruling?.tier ?? 'good'];
}

function pointsOfRound(s: LateState, round: number): { playerId: string; points: number }[] {
  const by = new Map<string, number>();
  for (const e of s.ledger) if (e.round === round) by.set(e.playerId, (by.get(e.playerId) ?? 0) + e.points);
  return [...by.entries()].map(([playerId, points]) => ({ playerId, points }));
}

function roleOf(r: LateRound, id: string): Role | null {
  if (r.latecomer === id) return 'latecomer';
  if (r.witness === id) return 'witness';
  if (r.chief === id) return 'chief';
  if (r.gallery.includes(id)) return 'gallery';
  return null;
}

function meView(s: LateState, r: LateRound, phase: Phase, player: ModePlayer, level: Level): LateMe {
  const role = roleOf(r, player.id);
  const c = causeOfRound(r);
  const isLate = role === 'latecomer';
  const pastPlay = phase === 'encore' || phase === 'score' || (phase === 'reveal' && r.step !== 'play');
  const listening = phase === 'reveal' && r.step === 'play';
  // The mission shows once a cause is chosen: no pre-ticked random cause.
  const line = isLate && r.level !== 'kana' && r.picked ? lineOf(r) : null;
  const myCheck = r.checks[player.id];
  const check =
    !isLate && n4Up(level) && checkable(r) && (listening || pastPlay)
      ? {
          q: c.check.q,
          options: r.checkOrder.map((i) => (i === 0 ? c.check.right : c.check.wrong[i - 1]!)),
          picked: myCheck ?? null,
          // The answer shows only after the gist, and only to this phone.
          right: pastPlay ? r.checkOrder.indexOf(0) : null,
        }
      : null;
  const myCatches = r.catches[player.id] ?? [];
  const mine = phase === 'score' ? s.ledger.filter((e) => e.round === r.index && e.playerId === player.id) : [];
  const breakdown: LateMe['breakdown'] = [];
  for (const e of mine) {
    const b = breakdown.find((x) => x.why === e.why);
    if (b) b.points += e.points;
    else breakdown.push({ why: e.why, points: e.points });
  }
  const order = phoneOrder(r, player.id);
  const isVoter = votersOf(r).includes(player.id);
  const holds = holdersOf(s, r).includes(player.id);
  const ruling = r.ruling;
  const coopHidden = s.coop && !r.coopPick && phase !== 'score';
  const own = !!r.excuse && r.excuse.kind !== 'pon';
  return {
    role,
    level,
    cause: isLate && r.picked ? r.cause : null,
    canPick: isLate && !r.blind && !r.excuse && planning(phase),
    lockedIn: !planning(phase),
    canType: isLate && r.level !== 'kana' && !r.excuse && choosing(phase, r),
    mission: line ? { text: line.mission, model: withRomaji(line.model, level), ...(line.frame ? { frame: withRomaji(line.frame, level) } : {}) } : isLate && r.level === 'kana' ? { text: 'Say sorry, blame something, then add its sound! Tap up to three tiles.', model: withRomaji(kanaLine(c), level) } : null,
    // The sound tile joins once a cause is tapped, and sounds like that cause.
    tiles: isLate && r.level === 'kana' ? [SORRY_TILE.id, ...(r.blind ? [r.cause] : order), TANUKI_TILE.id, ...(r.draft.some((t) => r.options.includes(t)) ? [SOUND_TILE_ID] : [])].map((id) => tileView(id, level, r)) : [],
    draft: isLate ? r.draft : [],
    ready: isLate && r.ready,
    sent: isLate && !!r.excuse,
    limitMs: isLate ? RECORD_MS[r.level] : 0,
    micPassLeft: isLate && !s.micPassUsed[player.id],
    alibiTiles: role === 'witness' ? [...order, ...(s.curveUsed[player.id] ? [] : [TANUKI_TILE.id])].map((id) => tileView(id, level)) : [],
    alibi: role === 'witness' ? r.alibi : null,
    bet: role === 'gallery' ? (r.bets[player.id] ?? null) : null,
    check,
    catchTiles: !isLate && (level === 'kana' || level === 'n5') && (listening || pastPlay) && !r.hidden && r.excuse?.kind !== 'typed' ? r.catchTiles.map((id) => ({ ...tileView(id, level), tapped: myCatches.includes(id) })) : [],
    leaves: s.settings.leafBudget ? (s.leaves[player.id] ?? 0) : MAX_LEAVES,
    canVote: phase === 'encore' && !r.hidden && isVoter && holds,
    noLeaf: phase === 'encore' && !r.hidden && isVoter && !holds,
    gave: player.id in r.leaves ? r.leaves[player.id]! : null,
    call: role === 'chief' ? r.call : null,
    coopPick: role === 'chief' ? r.coopPick : null,
    gist: isLate || (pastPlay && !coopHidden) ? withRomaji(c.gist, level) : null,
    points: phase === 'score' ? mine.reduce((a, e) => a + e.points, 0) : null,
    breakdown,
    readRoom: role === 'chief' && phase === 'score' && ruling && !s.coop && ruling.call && ruling.roomSafe !== null ? !ruling.overruled : null,
    note:
      isLate && phase === 'score'
        ? {
            model: r.level === 'kana' ? kanaLine(c) : lineOf(r).model,
            used: r.level === 'kana' ? own : !!r.chunk,
            hinted: r.hinted,
            fromMemory: own && !r.hinted,
            said: own && !r.hidden ? subtitleOf(r) : null,
          }
        : null,
  };
}

/** For bots and tests: the cause a dealt option id names. */
export const causeById = causeOf;
