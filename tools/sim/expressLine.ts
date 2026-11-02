// How many game nights does an N4 player take to clear the Express Line (急行)? Step 5 of the N4/N3 plan:
// a simulation in place of the guessed "12–16 nights". With --line limited, the same for an N3 player on the
// Limited Express (特急, docs/n3-coverage.md): `npm run sim:limited`. N3 frames aren't credited until the line opens,
// so the simulation turns them on for itself (frames.ts SIM).
//
// It uses the real rules end to end. Bots play the real games in-process (tools/sim/play.ts, with the
// speaking options that make a bot say Pon's version from memory), and each N4 seat's phrasebook goes
// through the same addGame → markPath a saved game does, so the frame rule (3 says from memory, 2 fillers,
// 2 days at least 3 days apart, in a game), the goal stamps and the line clear are the shipped code.
//
// What it assumes (each is a flag):
//   --nights-every  days between game nights (7: a weekly game night)
//   --games         games a night (3)
//   --follow        chance the room plays the path's suggestion rather than any Express game (0.6)
//   --memory        chance an N4 line the bot said from memory really came from memory (0.7); the rest are
//                   logged as a retry, as a stumble or a peek at the hint would be
//   --rooms         rooms simulated (500); --library games played per mode to sample from (12)
//   --max           nights before a room gives up (60)
//   --goals         the goal set to time together (default: the goals half the rooms or more stamp), e.g.
//                   4.1,4.4,4.5,4.9 to compare runs on the same set
//   --reviews       phone review sittings between one game night and the next (0). A sitting reviews the due
//                   phrases (up to 12) and the player knows each with the --memory chance; a known review is a
//                   say from memory, as on the phone, so it counts toward a frame's says, fillers and spacing.
//   --line          express (default) or limited
//   --green-car     rooms ride in the Green Car (docs/path-simulation.md, "Green Car"): every seat N4+, the game
//                   state's greenCarOn true, so modes see ctx.greenCar. N3 frames are credited for the run. It adds
//                   each seat level's N4/N3 frame split and the items that repeat per player per month.
//   --room          the seat levels, e.g. n3,n4,n4,n4 (Green Car default: n3,n3,n4,n4). Without --green-car the
//                   room's Green Car switch is held off, whatever the levels.
//   --audience      kids, family (default), cheeky, or all (one run per audience, then a comparison)
//   --repeat-rooms  Green Car: rooms whose first month is replayed with fresh games to count repeats (50)
// A room is 4 players: 2 N4 and 2 N5 (Limited Express: 2 N3, an N4 and an N5), everyone speaking. Re-checks (21 and 60 days) don't affect a stamp,
// so phone reviews aren't simulated.
//
//   npx tsx tools/sim/expressLine.ts [--rooms 500] [--memory 0.7] [--json out.json]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Level } from '../../content/src/types.js';
import { loadContent } from '../../server/src/content.js';
import { FRAME_BY_ID, SIM } from '../../shared/src/japanese/frames.js';
import { n4Up } from '../../shared/src/level.js';
import type { ContentLibrary } from '../../shared/src/modes/mode.js';
import { GOALS, markPath, pathStatus, suggest, type Goal } from '../../shared/src/path.js';
import { AUDIENCES, isAudience, type Audience, type ModeId } from '../../shared/src/protocol.js';
import { addGame, DAY_MS, duePhrases, emptyProgress, phraseFrames, reviewPhrase, type GameResult, type Progress } from '../../shared/src/progress.js';
import { mulberry, playGame } from './play.js';

const { values } = parseArgs({
  options: {
    rooms: { type: 'string', default: '500' },
    library: { type: 'string', default: '12' },
    'nights-every': { type: 'string', default: '7' },
    games: { type: 'string', default: '3' },
    follow: { type: 'string', default: '0.6' },
    memory: { type: 'string', default: '0.7' },
    max: { type: 'string', default: '60' },
    reviews: { type: 'string', default: '0' },
    goals: { type: 'string' },
    seed: { type: 'string', default: '1' },
    json: { type: 'string' },
    line: { type: 'string', default: 'express' },
    'green-car': { type: 'boolean', default: false },
    room: { type: 'string' },
    audience: { type: 'string', default: 'family' },
    'repeat-rooms': { type: 'string', default: '50' },
  },
});

export interface SimOptions {
  rooms: number;
  library: number;
  nightsEvery: number;
  games: number;
  follow: number;
  memory: number;
  max: number;
  /** Phone review sittings between one game night and the next. */
  reviews: number;
  /** Goals to time together; empty: the ones half the rooms or more stamp. */
  goals?: readonly string[];
  seed: number;
  /** The room's Audience setting (family when left out). */
  audience?: Audience;
  /** Green Car: rooms whose first month is replayed with fresh games to count repeats (50). */
  repeatRooms?: number;
}

const LINE = values.line === 'limited' ? 'limited' : 'express';
/** Rooms ride in the Green Car. */
const GREEN = values['green-car'] === true;
if (LINE === 'limited' || GREEN) SIM.n3 = true;
/** The seats the path follows: N4 on the Express Line, N3 on the Limited Express. */
const SEAT: Level = LINE === 'limited' ? 'n3' : 'n4';
const LEVEL_IDS: readonly Level[] = ['kana', 'n5', 'n4', 'n3'];
const LEVELS: Level[] = values.room
  ? values.room.split(',').map((l) => l.trim().toLowerCase() as Level)
  : GREEN
    ? ['n3', 'n3', 'n4', 'n4']
    : LINE === 'limited'
      ? ['n3', 'n3', 'n4', 'n5']
      : ['n4', 'n4', 'n5', 'n5'];
if (LEVELS.some((l) => !LEVEL_IDS.includes(l))) throw new Error(`--room: levels are ${LEVEL_IDS.join(', ')} (got ${values.room})`);
if (!LEVELS.includes(SEAT)) throw new Error(`--room: the ${LINE === 'limited' ? 'Limited Express' : 'Express Line'} needs an ${SEAT.toUpperCase()} seat`);
if (GREEN && !LEVELS.every(n4Up)) throw new Error('--green-car: every seat must be N4 or N3');
const ROOM = { players: LEVELS.length, speakers: LEVELS.length, greenCar: GREEN };
const EXPRESS: readonly Goal[] = GOALS.filter((g) => g.line === LINE);
/** The games a room plays: every game on an Express goal (4.7's too, though it isn't counted yet), and Late
 *  Again!, which the plan puts on 4.2, 4.3, 4.11 and 4.13 but the path doesn't list yet. */
const MODES_ON_LINE: ModeId[] = [...new Set([...EXPRESS.flatMap((g) => g.games), 'late-again' as ModeId])];

/** Every seat of every game in the library, by mode: per game, each seat's level and result. */
export type RoomLibrary = Map<ModeId, { level: Level; result: GameResult }[][]>;

/** `n` real games of each mode: every followed seat's result (`lib`), and every seat of each game (`room`). A mode
 *  that can't be played in this room (no bot policy, a stall, no content for the audience) is left out, with a warning. */
export function buildLibraries(n: number, seed: number, audience: Audience = 'family'): { lib: Map<ModeId, GameResult[]>; room: RoomLibrary; content: ContentLibrary } {
  const content = loadContent(fileURLToPath(new URL('../../', import.meta.url)));
  const lib = new Map<ModeId, GameResult[]>();
  const room: RoomLibrary = new Map();
  for (const mode of MODES_ON_LINE) {
    const out: GameResult[] = [];
    const games: { level: Level; result: GameResult }[][] = [];
    try {
      for (let i = 0; i < n; i++) {
        const g = playGame(content, mode, LEVELS, seed * 1000 + i + 1, undefined, { audience, greenCar: GREEN });
        for (const s of g.seats) if (s.level === SEAT) out.push(s.result);
        games.push(g.seats.map((s) => ({ level: s.level, result: s.result })));
      }
    } catch (e) {
      console.warn(`${mode}: left out (${(e as Error).message})`);
      continue;
    }
    lib.set(mode, out);
    room.set(mode, games);
  }
  return { lib, room, content };
}

/** Every followed seat's result from `n` real games of each mode. */
export function buildLibrary(n: number, seed: number, audience: Audience = 'family'): Map<ModeId, GameResult[]> {
  return buildLibraries(n, seed, audience).lib;
}

/** One game's phrasebook as this player said it: a memory line holds with chance `memory`, else it's a retry. */
function asSaid(r: GameResult, at: number, memory: number, random: () => number): GameResult {
  return {
    ...r,
    at,
    phrases: r.phrases.map((e) => (e.outcome === 'said' && e.recall === 'memory' && random() >= memory ? { ...e, outcome: 'retry' as const, recall: 'read' as const } : e)),
  };
}

export interface RoomRun {
  /** Night each Express goal was stamped, by goal id (missing: never, within the cap). */
  stamped: Record<string, number>;
  /** Night the line cleared, or null. */
  cleared: number | null;
  /** Games played, by mode. */
  played: Record<string, number>;
  /** The mode of every game, in order (only when asked for: the Green Car's month of repeats replays them). */
  order?: ModeId[];
}

/** One player's phrasebook items over a month of nights. */
export interface MonthItems {
  /** Phrasebook entries (any outcome) and different items among them. */
  entries: number;
  distinct: number;
  /** Items that came up in two or more games, with how many games. */
  again: Record<string, number>;
}

/** Nights in a month (28 days) of game nights `every` days apart. */
export const monthNights = (every: number): number => Math.max(1, Math.round(28 / every));

export function runRoom(lib: Map<ModeId, GameResult[]>, o: SimOptions, roomSeed: number, keepOrder = false): RoomRun {
  const random = mulberry(roomSeed);
  const order: ModeId[] = [];
  const p: Progress = { ...emptyProgress(), path: true };
  const stamped: Record<string, number> = {};
  const played: Record<string, number> = {};
  let cleared: number | null = null;
  const modes = [...lib.keys()];
  // Nights start at 19:00 UTC on a fixed day, so day boundaries fall between nights, never inside one.
  const start = Date.UTC(2026, 0, 5, 19);
  for (let night = 1; night <= o.max && cleared === null; night++) {
    const nightAt = start + (night - 1) * o.nightsEvery * DAY_MS;
    for (let g = 0; g < o.games; g++) {
      const at = nightAt + g * 20 * 60_000;
      const tip = random() < o.follow ? suggest(pathStatus(p, at), SEAT, ROOM) : null;
      const mode = tip && lib.has(tip.mode) ? tip.mode : modes[Math.floor(random() * modes.length)]!;
      const pool = lib.get(mode)!;
      played[mode] = (played[mode] ?? 0) + 1;
      addGame(p, asSaid(pool[Math.floor(random() * pool.length)]!, at, o.memory, random), 0);
      for (const id of markPath(p, at)) if (EXPRESS.some((x) => x.id === id)) stamped[id] ??= night;
      if (keepOrder) order.push(mode);
    }
    // Review sittings in the mornings after the night, spread until the next one.
    for (let k = 0; k < o.reviews; k++) {
      const at = nightAt + (1 + Math.floor((k * o.nightsEvery) / o.reviews)) * DAY_MS - 11 * 3_600_000;
      for (const c of duePhrases(p, at)) reviewPhrase(p, c.itemId, random() < o.memory, at);
      for (const id of markPath(p, at)) if (EXPRESS.some((x) => x.id === id)) stamped[id] ??= night;
    }
    if (pathStatus(p, nightAt + DAY_MS / 2).lines.find((l) => l.id === LINE)!.cleared) cleared = night;
  }
  return keepOrder ? { stamped, cleared, played, order } : { stamped, cleared, played };
}

/** A quartile over every room. A room that never got there counts as Infinity, so a quartile it decides
 *  reads "more than the cap"; null when no room got there. */
const pct = (xs: number[], q: number): number | null => {
  if (!xs.some(Number.isFinite)) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};

export interface SimReport {
  options: SimOptions;
  /** Per goal: share of rooms that stamped it, and nights to stamp (quartiles, over the rooms that did). */
  goals: { id: string; title: string; counted: boolean; share: number; p25: number | null; median: number | null; p75: number | null }[];
  line: { share: number; p25: number | null; median: number | null; p75: number | null };
  /** The goals most rooms do stamp (half or more): nights until a room has all of them. Shows the pace where
   *  the games carry a goal, apart from the goals no game carries yet. */
  reachable: { goals: string[]; share: number; p25: number | null; median: number | null; p75: number | null };
  /** Per mode: Express frames an N4 seat says from memory per game (before the memory chance). */
  yields: { mode: ModeId; perGame: number; frames: Record<string, number> }[];
  /** Green Car only: per seat level, what its lines said from memory carry, and what repeats per month. */
  green?: GreenReport;
}

/** Lines said from memory (before the memory chance), and how many carry an N4 or an N3 frame. A line with both
 *  counts for both. `n4Share` is N4 / (N4 + N3): the Green Car aims at 0.5 for an N3 seat. */
export interface FrameMix {
  lines: number;
  n4: number;
  n3: number;
  n4Share: number | null;
}

export interface GreenReport {
  levels: Level[];
  /** Per level: over the games the rooms played (weighted by plays), per game. */
  mix: Partial<Record<Level, FrameMix>>;
  /** Per mode and level: per game. */
  mixByMode: { mode: ModeId; plays: number; byLevel: Partial<Record<Level, FrameMix>> }[];
  /** Per level: one player's first month (as many nights as fit 28 days), replayed with fresh games, averaged
   *  over the rooms sampled. `again`: items that came up in two or more of the month's games. */
  repeats: Partial<Record<Level, { months: number; nights: number; games: number; entries: number; distinct: number; again: number; top: { item: string; months: number; games: number }[] }>>;
}

const mixOf = (lines: number, n4: number, n3: number): FrameMix => ({ lines, n4, n3, n4Share: n4 + n3 ? n4 / (n4 + n3) : null });

/** One seat per level (the room's first seat of that level, the same player all month) over a month of games: the
 *  modes in `order`, each a fresh game (not a library draw, which would repeat the library's own deals). */
export function monthItems(content: ContentLibrary, order: readonly ModeId[], seed: number, audience: Audience): Partial<Record<Level, MonthItems>> {
  const out: Partial<Record<Level, MonthItems>> = {};
  const games: Partial<Record<Level, string[][]>> = {};
  order.forEach((mode, i) => {
    let g;
    try {
      g = playGame(content, mode, LEVELS, seed + i, undefined, { audience, greenCar: GREEN });
    } catch {
      return;
    }
    for (const lv of new Set(LEVELS)) {
      const seat = g.seats.find((x) => x.level === lv);
      if (seat) (games[lv] ??= []).push(seat.result.phrases.map((e) => e.itemId));
    }
  });
  for (const [lv, gs] of Object.entries(games) as [Level, string[][]][]) {
    const inGames = new Map<string, number>();
    for (const g of gs) for (const id of new Set(g)) inGames.set(id, (inGames.get(id) ?? 0) + 1);
    out[lv] = { entries: gs.reduce((n, g) => n + g.length, 0), distinct: inGames.size, again: Object.fromEntries([...inGames].filter(([, n]) => n > 1)) };
  }
  return out;
}

export function greenReport(room: RoomLibrary, runs: RoomRun[], o: SimOptions, content: ContentLibrary): GreenReport {
  const plays = new Map<ModeId, number>();
  for (const r of runs) for (const [m, n] of Object.entries(r.played)) plays.set(m as ModeId, (plays.get(m as ModeId) ?? 0) + n);
  const roomLevels = [...new Set([...room.values()].flatMap((gs) => gs.flatMap((g) => g.map((s) => s.level))))].sort((a, b) => LEVEL_IDS.indexOf(b) - LEVEL_IDS.indexOf(a));
  const mixByMode = [...room].map(([mode, games]) => {
    const byLevel: Partial<Record<Level, FrameMix>> = {};
    for (const lv of roomLevels) {
      let seats = 0;
      let lines = 0;
      let n4 = 0;
      let n3 = 0;
      for (const g of games)
        for (const s of g) {
          if (s.level !== lv) continue;
          seats += 1;
          for (const e of s.result.phrases) {
            if (e.outcome !== 'said' || e.recall !== 'memory') continue;
            const levels = new Set(phraseFrames(e).map((f) => FRAME_BY_ID[f]?.level));
            lines += 1;
            if (levels.has('n4')) n4 += 1;
            if (levels.has('n3')) n3 += 1;
          }
        }
      if (seats) byLevel[lv] = mixOf(lines / seats, n4 / seats, n3 / seats);
    }
    return { mode, plays: plays.get(mode) ?? 0, byLevel };
  });
  const mix: Partial<Record<Level, FrameMix>> = {};
  for (const lv of roomLevels) {
    const total = mixByMode.reduce((n, m) => n + (m.byLevel[lv] ? m.plays : 0), 0);
    if (!total) continue;
    const w = (k: 'lines' | 'n4' | 'n3') => mixByMode.reduce((n, m) => n + (m.byLevel[lv]?.[k] ?? 0) * m.plays, 0) / total;
    mix[lv] = mixOf(w('lines'), w('n4'), w('n3'));
  }
  const nights = monthNights(o.nightsEvery);
  const months = runs
    .filter((r) => r.order)
    .slice(0, o.repeatRooms ?? 50)
    .map((r, i) => monthItems(content, r.order!.slice(0, nights * o.games), o.seed * 7_000_003 + i * 1000 + 500, o.audience ?? 'family'));
  const repeats: GreenReport['repeats'] = {};
  for (const lv of roomLevels) {
    const ms = months.flatMap((m) => (m[lv] ? [m[lv]] : []));
    if (!ms.length) continue;
    const avg = (f: (m: MonthItems) => number) => Math.round((ms.reduce((n, m) => n + f(m), 0) / ms.length) * 10) / 10;
    const top = new Map<string, { months: number; games: number }>();
    for (const m of ms)
      for (const [item, n] of Object.entries(m.again)) {
        const t = top.get(item) ?? { months: 0, games: 0 };
        t.months += 1;
        t.games += n;
        top.set(item, t);
      }
    repeats[lv] = {
      months: ms.length,
      nights,
      games: nights * o.games,
      entries: avg((m) => m.entries),
      distinct: avg((m) => m.distinct),
      again: avg((m) => Object.keys(m.again).length),
      top: [...top]
        .sort(([, a], [, b]) => b.months - a.months)
        .slice(0, 5)
        .map(([item, t]) => ({ item, months: Math.round((t.months / ms.length) * 100) / 100, games: Math.round((t.games / t.months) * 10) / 10 })),
    };
  }
  return { levels: roomLevels, mix, mixByMode, repeats };
}

export function simulate(o: SimOptions): SimReport {
  const { lib, room, content } = buildLibraries(o.library, o.seed, o.audience);
  const runs = Array.from({ length: o.rooms }, (_, i) => runRoom(lib, o, o.seed * 100_003 + i, GREEN && i < (o.repeatRooms ?? 50)));
  const st = pathStatus({ ...emptyProgress(), path: true }, Date.UTC(2026, 0, 1));
  const counted = new Set(st.goals.filter((g) => !g.hidden && g.ready).map((g) => g.id));
  const goals = EXPRESS.map((g) => {
    const nights = runs.map((r) => r.stamped[g.id] ?? Infinity);
    const share = nights.filter(Number.isFinite).length / runs.length;
    return { id: g.id, title: g.title, counted: counted.has(g.id), share, p25: pct(nights, 0.25), median: pct(nights, 0.5), p75: pct(nights, 0.75) };
  });
  const clears = runs.map((r) => r.cleared ?? Infinity);
  const reach = o.goals?.length ? [...o.goals] : goals.filter((g) => g.counted && g.share >= 0.5).map((g) => g.id);
  const allReached = runs.map((r) => (reach.every((id) => r.stamped[id] !== undefined) ? Math.max(...reach.map((id) => r.stamped[id]!)) : Infinity));
  const expressFrames = new Set(EXPRESS.flatMap((g) => [...g.need.flatMap((n) => (typeof n === 'string' ? [n] : [...n])), ...g.also]));
  const yields = [...lib.keys()].map((mode) => {
    const games = lib.get(mode)!;
    const frames: Record<string, number> = {};
    let n = 0;
    for (const r of games)
      for (const e of r.phrases) {
        if (e.outcome !== 'said' || e.recall !== 'memory') continue;
        const fs = phraseFrames(e).filter((f) => expressFrames.has(f));
        if (fs.length) n += 1;
        for (const f of fs) frames[f] = (frames[f] ?? 0) + 1 / games.length;
      }
    return { mode, perGame: n / games.length, frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, Math.round(v * 10) / 10])) };
  });
  return {
    options: o,
    goals,
    line: { share: clears.filter(Number.isFinite).length / runs.length, p25: pct(clears, 0.25), median: pct(clears, 0.5), p75: pct(clears, 0.75) },
    reachable: { goals: reach, share: allReached.filter(Number.isFinite).length / runs.length, p25: pct(allReached, 0.25), median: pct(allReached, 0.5), p75: pct(allReached, 0.75) },
    yields,
    ...(GREEN ? { green: greenReport(room, runs, o, content) } : {}),
  };
}

/** Quartiles for printing: a quartile no room reached reads ">cap"; under 10% of rooms, no pace at all. */
const q3 = (x: { share: number; p25: number | null; median: number | null; p75: number | null }, cap: number): string => {
  if (x.median === null && x.p25 === null) return '-';
  if (x.share < 0.1) return 'too few rooms';
  const f = (n: number | null) => (n === null || !Number.isFinite(n) ? `>${cap}` : String(n));
  return `${f(x.p25)} / ${f(x.median)} / ${f(x.p75)}`;
};

const pc = (x: number | null): string => (x === null ? '-' : `${Math.round(x * 100)}%`);

function printGreen(g: GreenReport): void {
  console.log('\nGreen Car: lines each seat says from memory, per game (weighted by the games the rooms played; a line with both counts for both)');
  console.log('Seat  lines  with N4 frame  with N3 frame  N4 share of N4+N3 (aim: 50% for N3)');
  for (const lv of g.levels) {
    const m = g.mix[lv];
    if (m) console.log(`${lv.toUpperCase().padEnd(6)}${m.lines.toFixed(1).padStart(5)}  ${m.n4.toFixed(1).padStart(13)}  ${m.n3.toFixed(1).padStart(13)}  ${pc(m.n4Share)}`);
  }
  console.log('\nBy game, plays over all rooms, then per seat: lines / with N4 / with N3 per game, N4 share:');
  for (const m of g.mixByMode) {
    const cells = g.levels.map((lv) => {
      const x = m.byLevel[lv];
      return `${lv.toUpperCase()} ${x ? `${x.lines.toFixed(1)} / ${x.n4.toFixed(1)} / ${x.n3.toFixed(1)} ${pc(x.n4Share).padStart(4)}` : '-'}`.padEnd(30);
    });
    console.log(`  ${m.mode.padEnd(14)} ${String(m.plays).padStart(5)}  ${cells.join('')}`);
  }
  console.log('\nRepeats per player per month of nights (phrasebook items, any outcome; each game played fresh):');
  for (const lv of g.levels) {
    const r = g.repeats[lv];
    if (!r) continue;
    console.log(`  ${lv.toUpperCase()}: ${r.months} rooms' first month (${r.nights} nights, ${r.games} games). ${r.entries} phrasebook entries, ${r.distinct} different items, ${r.again} of them in two or more games.`);
    for (const t of r.top) console.log(`      ${t.item}: in 2+ games in ${pc(t.months)} of months (${t.games} games when it is)`);
  }
}

function print(r: SimReport): void {
  const o = r.options;
  const room = GREEN ? `Green Car (${LEVELS.join(',')}), ` : values.room ? `room ${LEVELS.join(',')}, ` : '';
  console.log(`${LINE === 'limited' ? 'Limited Express' : 'Express Line'}: ${room}audience ${o.audience ?? 'family'}, ${o.rooms} rooms, a game night every ${o.nightsEvery} days, ${o.games} games a night, follow ${o.follow}, memory ${o.memory}, ${o.reviews} review sittings between nights, cap ${o.max} nights.\n`);
  console.log('Goal                                   counted  stamped  nights p25 / median / p75 (over all rooms)');
  for (const g of r.goals) console.log(`${`${g.id} ${g.title}`.padEnd(40)}${(g.counted ? 'yes' : 'no').padEnd(9)}${`${Math.round(g.share * 100)}%`.padEnd(9)}${q3(g, o.max)}`);
  console.log(`\nLine cleared in ${Math.round(r.line.share * 100)}% of rooms${r.line.share === 0 ? '' : `: nights ${q3(r.line, o.max)}`}.\n`);
  const rc = r.reachable;
  console.log(`${o.goals?.length ? 'Goals' : 'Goals most rooms stamp'} (${rc.goals.join(', ')}): all of them in ${Math.round(rc.share * 100)}% of rooms${rc.share === 0 ? '' : `, nights ${q3(rc, o.max)}`}.\n`);
  console.log(`${LINE === 'limited' ? 'Limited Express' : 'Express'} frames an ${SEAT.toUpperCase()} seat says from memory, per game:`);
  for (const y of r.yields) console.log(`  ${y.mode.padEnd(14)} ${y.perGame.toFixed(1).padStart(4)}  ${Object.entries(y.frames).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (r.green) printGreen(r.green);
}

/** --audience all: the goals, the line and each seat's split side by side. */
function printCompare(rs: SimReport[]): void {
  const cap = rs[0]!.options.max;
  const aud = rs.map((r) => r.options.audience ?? 'family');
  const med = (m: number | null) => (m === null ? '' : Number.isFinite(m) ? String(m) : `>${cap}`);
  const cell = (x: { share: number; median: number | null }) => `${pc(x.share)} ${x.share >= 0.1 ? med(x.median) : ''}`.padEnd(18);
  console.log(`\n=== By audience: rooms that stamp, and median nights over all rooms ===`);
  console.log(`${'Goal'.padEnd(46)}${aud.map((a) => a.padEnd(18)).join('')}`);
  for (const g of rs[0]!.goals) console.log(`${`${g.id} ${g.title}`.padEnd(46)}${rs.map((r) => cell(r.goals.find((y) => y.id === g.id)!)).join('')}`);
  console.log(`${'Line cleared'.padEnd(46)}${rs.map((r) => cell(r.line)).join('')}`);
  const levels = rs[0]!.green?.levels ?? [];
  for (const lv of levels) {
    console.log(`${`${lv.toUpperCase()} seat: N4 share (memory lines a game)`.padEnd(46)}${rs.map((r) => { const m = r.green?.mix[lv]; return (m ? `${pc(m.n4Share)} (${m.lines.toFixed(1)})` : '-').padEnd(18); }).join('')}`);
    console.log(`${`${lv.toUpperCase()} seat: items in 2+ games a month`.padEnd(46)}${rs.map((r) => String(r.green?.repeats[lv]?.again ?? '-').padEnd(18)).join('')}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const audiences: Audience[] = values.audience === 'all' ? [...AUDIENCES] : isAudience(values.audience) ? [values.audience] : [];
  if (!audiences.length) throw new Error(`--audience: ${AUDIENCES.join(', ')} or all (got ${values.audience})`);
  const base: SimOptions = {
    rooms: Number(values.rooms),
    library: Number(values.library),
    nightsEvery: Number(values['nights-every']),
    games: Number(values.games),
    follow: Number(values.follow),
    memory: Number(values.memory),
    max: Number(values.max),
    reviews: Number(values.reviews),
    goals: values.goals ? values.goals.split(',') : undefined,
    seed: Number(values.seed),
    repeatRooms: Number(values['repeat-rooms']),
  };
  const reports = audiences.map((audience, i) => {
    if (i) console.log('\n');
    const r = simulate({ ...base, audience });
    print(r);
    return r;
  });
  if (reports.length > 1) printCompare(reports);
  const json = reports.length > 1 ? { audiences: Object.fromEntries(reports.map((r) => [r.options.audience, r])) } : reports[0];
  if (values.json) writeFileSync(values.json, `${JSON.stringify(json, null, 2)}\n`);
}
