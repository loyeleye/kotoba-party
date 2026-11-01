// How many game nights does an N4 player take to clear the Express Line (急行)? Step 5 of the N4/N3 plan:
// a simulation in place of the guessed "12–16 nights".
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
// A room is 4 players: 2 N4 and 2 N5, everyone speaking. Re-checks (21 and 60 days) don't affect a stamp,
// so phone reviews aren't simulated.
//
//   npx tsx tools/sim/expressLine.ts [--rooms 500] [--memory 0.7] [--json out.json]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Level } from '../../content/src/types.js';
import { loadContent } from '../../server/src/content.js';
import { GOALS, markPath, pathStatus, suggest, type Goal } from '../../shared/src/path.js';
import type { ModeId } from '../../shared/src/protocol.js';
import { addGame, DAY_MS, emptyProgress, phraseFrames, type GameResult, type Progress } from '../../shared/src/progress.js';
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
    seed: { type: 'string', default: '1' },
    json: { type: 'string' },
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
  seed: number;
}

const LEVELS: Level[] = ['n4', 'n4', 'n5', 'n5'];
const ROOM = { players: LEVELS.length, speakers: LEVELS.length };
const EXPRESS: readonly Goal[] = GOALS.filter((g) => g.line === 'express');
const MODES_ON_LINE: ModeId[] = [...new Set(EXPRESS.filter((g) => !g.gap).flatMap((g) => g.games))];

/** Every N4 seat's result from `n` real games of each mode. */
export function buildLibrary(n: number, seed: number): Map<ModeId, GameResult[]> {
  const content = loadContent(fileURLToPath(new URL('../../', import.meta.url)));
  const lib = new Map<ModeId, GameResult[]>();
  for (const mode of MODES_ON_LINE) {
    const out: GameResult[] = [];
    for (let i = 0; i < n; i++) {
      const g = playGame(content, mode, LEVELS, seed * 1000 + i + 1);
      for (const s of g.seats) if (s.level === 'n4') out.push(s.result);
    }
    lib.set(mode, out);
  }
  return lib;
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
}

export function runRoom(lib: Map<ModeId, GameResult[]>, o: SimOptions, roomSeed: number): RoomRun {
  const random = mulberry(roomSeed);
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
      const tip = random() < o.follow ? suggest(pathStatus(p, at), 'n4', ROOM) : null;
      const mode = tip && lib.has(tip.mode) ? tip.mode : modes[Math.floor(random() * modes.length)]!;
      const pool = lib.get(mode)!;
      played[mode] = (played[mode] ?? 0) + 1;
      addGame(p, asSaid(pool[Math.floor(random() * pool.length)]!, at, o.memory, random), 0);
      for (const id of markPath(p, at)) if (EXPRESS.some((x) => x.id === id)) stamped[id] ??= night;
    }
    if (pathStatus(p, nightAt + DAY_MS / 2).lines.find((l) => l.id === 'express')!.cleared) cleared = night;
  }
  return { stamped, cleared, played };
}

const pct = (xs: number[], q: number): number | null => {
  if (!xs.length) return null;
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
}

export function simulate(o: SimOptions): SimReport {
  const lib = buildLibrary(o.library, o.seed);
  const runs = Array.from({ length: o.rooms }, (_, i) => runRoom(lib, o, o.seed * 100_003 + i));
  const st = pathStatus({ ...emptyProgress(), path: true }, Date.UTC(2026, 0, 1));
  const counted = new Set(st.goals.filter((g) => !g.hidden && g.ready).map((g) => g.id));
  const goals = EXPRESS.map((g) => {
    const nights = runs.map((r) => r.stamped[g.id]).filter((n): n is number => n !== undefined);
    return { id: g.id, title: g.title, counted: counted.has(g.id), share: nights.length / runs.length, p25: pct(nights, 0.25), median: pct(nights, 0.5), p75: pct(nights, 0.75) };
  });
  const clears = runs.map((r) => r.cleared).filter((n): n is number => n !== null);
  const reach = goals.filter((g) => g.counted && g.share >= 0.5).map((g) => g.id);
  const allReached = runs.map((r) => (reach.every((id) => r.stamped[id] !== undefined) ? Math.max(...reach.map((id) => r.stamped[id]!)) : null)).filter((n): n is number => n !== null);
  const expressFrames = new Set(EXPRESS.flatMap((g) => [...g.need.flatMap((n) => (typeof n === 'string' ? [n] : [...n])), ...g.also]));
  const yields = MODES_ON_LINE.map((mode) => {
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
    line: { share: clears.length / runs.length, p25: pct(clears, 0.25), median: pct(clears, 0.5), p75: pct(clears, 0.75) },
    reachable: { goals: reach, share: allReached.length / runs.length, p25: pct(allReached, 0.25), median: pct(allReached, 0.5), p75: pct(allReached, 0.75) },
    yields,
  };
}

function print(r: SimReport): void {
  const o = r.options;
  console.log(`Express Line: ${o.rooms} rooms, a game night every ${o.nightsEvery} days, ${o.games} games a night, follow ${o.follow}, memory ${o.memory}, cap ${o.max} nights.\n`);
  console.log('Goal                                   counted  stamped  nights p25 / median / p75');
  for (const g of r.goals) console.log(`${`${g.id} ${g.title}`.padEnd(40)}${(g.counted ? 'yes' : 'no').padEnd(9)}${`${Math.round(g.share * 100)}%`.padEnd(9)}${g.median === null ? '-' : `${g.p25} / ${g.median} / ${g.p75}`}`);
  console.log(`\nLine cleared in ${Math.round(r.line.share * 100)}% of rooms${r.line.median === null ? '' : `: nights ${r.line.p25} / ${r.line.median} / ${r.line.p75}`}.\n`);
  const rc = r.reachable;
  console.log(`Goals most rooms stamp (${rc.goals.join(', ')}): all of them in ${Math.round(rc.share * 100)}% of rooms${rc.median === null ? '' : `, nights ${rc.p25} / ${rc.median} / ${rc.p75}`}.\n`);
  console.log('Express frames an N4 seat says from memory, per game:');
  for (const y of r.yields) console.log(`  ${y.mode.padEnd(14)} ${y.perGame.toFixed(1).padStart(4)}  ${Object.entries(y.frames).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = simulate({
    rooms: Number(values.rooms),
    library: Number(values.library),
    nightsEvery: Number(values['nights-every']),
    games: Number(values.games),
    follow: Number(values.follow),
    memory: Number(values.memory),
    max: Number(values.max),
    seed: Number(values.seed),
  });
  print(report);
  if (values.json) writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`);
}
