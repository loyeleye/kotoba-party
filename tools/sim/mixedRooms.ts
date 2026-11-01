// Playtest sims for mixed rooms (docs/n4-hard-roles.md, "Playtest sims"). Plays whole games of the six hard-role
// modes in process, the way the tests do: shared/src/game.ts `apply`, a fake clock, a seeded random, and the bot
// policies in tools/bots/policies/ for everyone's ordinary play, with a mixed-room layer on top (offers, the N4
// lines, Gallery taps, curveballs, the manager's 📋 requests). No server, no sockets, no real time.
//
//   npm run sim:mixed                                   every mode × setup, 20 seeds
//   npm run sim:mixed -- --seeds 5 --modes omiai,narabete --setups a,c
//   npm run sim:mixed -- --on standInSetup --off scaledCurveball
//   npm run sim:mixed -- --ab spokenReaction --out /tmp/ab.json
//   npm run sim:mixed -- --ab all --out /tmp/ab-all.json            (every switch in turn)
//   npm run sim:mixed -- --modes last-train --rounds last-train=6     (a 6-stop line has the announcer)
//
// Each seed plays one night per setup: the chosen modes back to back in one room (playAgain between), the order
// rotated by the seed, so the recap's waiting check can be counted per night as well as per game.

import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import type { Level } from '../../content/src/types.js';
import type { CommandBody } from '../../shared/src/client.js';
import { apply, createGame, wakeAt, type GameContext, type GameState } from '../../shared/src/game.js';
import { EXPERIMENTS, withExperiments, type MixedExperiments } from '../../shared/src/modes/experiments.js';
import type { ContentLibrary } from '../../shared/src/modes/mode.js';
import { curveballPoints, REACTIONS, SAY_PICK, SPOKEN_REACTION_POINTS } from '../../shared/src/modes/mixedRoom.js';
import { adlibOf, type DubState } from '../../shared/src/modes/dubClub/dubClub.js';
import { itemIndex } from '../../shared/src/modes/lastTrain/lastTrain.js';
import { MODES, noFit } from '../../shared/src/modes/registry.js';
import { recallOf } from '../../shared/src/progress.js';
import type { Command, ModeId, RoomView } from '../../shared/src/protocol.js';
import { viewFor } from '../../shared/src/view.js';
import type { ModePolicy } from '../bots/bot.js';
import { bentoHausPolicy } from '../bots/policies/bentoHaus.js';
import { dubClubPolicy } from '../bots/policies/dubClub.js';
import { lastTrainPolicy } from '../bots/policies/lastTrain.js';
import { narabetePolicy } from '../bots/policies/narabete.js';
import { omiaiPolicy } from '../bots/policies/omiai.js';
import { onsenMurderPolicy } from '../bots/policies/onsenMurder.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export const SIM_MODES = ['bento-haus', 'last-train', 'onsen-murder', 'omiai', 'dub-club', 'narabete'] as const satisfies readonly ModeId[];
export type SimMode = (typeof SIM_MODES)[number];

/** The room setups the panel asked about. `quiet`: seats (0-based) whose phone has no mic (the lobby's tap/type). */
export const SETUPS: Record<string, { label: string; levels: Level[]; quiet?: number[] }> = {
  a: { label: '3p N4+N5+Kana', levels: ['n4', 'n5', 'kana'] },
  b: { label: '5p 1×N4+2N5+2Kana (2nd Kana quiet)', levels: ['n4', 'n5', 'kana', 'n5', 'kana'], quiet: [4] },
  c: { label: '2p N5+Kana (stand-in)', levels: ['n5', 'kana'] },
  d: { label: '3p all N5 (control)', levels: ['n5', 'n5', 'n5'] },
  e: { label: '4p 2×N4+N5+Kana', levels: ['n4', 'n4', 'n5', 'kana'] },
};

/** How simulated people behave on top of the bot policies (the brief's numbers). */
export const PERSONA = {
  /** N4: share of hard-role offers taken. */
  accept: 0.7,
  /** N4: share of hard-role lines said right on the first try; later tries are right this often. */
  firstTry: 0.6,
  retry: 0.85,
  /** Gallery: share of reaction tiles tapped; share of curveballs answered right, by level (only Kana and N5 get one). */
  tap: 0.8,
  curveRight: { kana: 0.45, n5: 0.7, n4: 0.85 } as Record<Level, number>,
  /** A station sees to the deputy manager's 📋 request this often. */
  request: 0.9,
  /** spokenReaction: a Gallery player with a mic says the reaction instead of tapping this often, matched this often. */
  sayReaction: 0.5,
  sayMatched: 0.75,
};

// ---------------------------------------------------------------- randomness

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roll(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const between = (lo: number, hi: number, r: number) => Math.round(lo + (hi - lo) * r);

// ---------------------------------------------------------------- views

type Move = { key: string; move: unknown; delayMs?: number; tag?: 'tap' | 'curve' | 'say'; /** Called once the game takes the move. */ onSent?: () => void; /** A curveball pick: was it the right word. */ right?: boolean };

/** The player's own part of a mode's view (`me` in most modes, `mine` in Onsen). */
const meOf = (view: RoomView): Any => {
  const g = view.game as Any;
  return g?.me ?? g?.mine ?? null;
};

/** The player's Gallery tile, wherever the mode keeps it on the view. */
export function galleryTile(view: RoomView): Any {
  const me = meOf(view);
  // The round's Gallery is on the player's own part of the view; the stand-in's (standInCurveball) may sit
  // elsewhere in the game's view (Bento puts it on `standIn`), so look for a tile's shape.
  return me?.gallery ?? me?.hard?.gallery ?? findTile(view.game, 0);
}

const isTile = (n: Any): boolean => !!n && typeof n === 'object' && ((n.kind === 'react' && Array.isArray(n.tiles)) || (n.kind === 'curveball' && Array.isArray(n.options) && 'right' in n));

function findTile(node: Any, depth: number): Any {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  if (isTile(node)) return node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = findTile(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** The host stand-in's Gallery in the game state (standInCurveball), if one is open. */
function findStandIn(node: Any, depth = 0): Any {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  if (typeof node.dealAt === 'number' && typeof node.until === 'number' && node.g && typeof node.maybe === 'boolean') return node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = findStandIn(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** The open curveball for a player, from the game state (the sim plays a person who heard the line). */
function findCurveball(node: Any, playerId: string, depth = 0): Any {
  if (!node || typeof node !== 'object' || depth > 7) return null;
  if (node.playerId === playerId && typeof node.word === 'string' && Array.isArray(node.options) && node.pick == null) return node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = findCurveball(v, playerId, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * Does this player's view offer them a move right now? This is the sim's definition of "something to do"
 * (docs/n4-hard-roles.md, "Playtest sims"): an input, tile or button on their phone that they haven't used yet.
 * Everything else (watching the TV, waiting for someone else's turn, a phase with nothing for them) is idle.
 */
export function hasInput(mode: SimMode, view: RoomView, countTiles = true): boolean {
  const g = view.game as Any;
  const me = meOf(view);
  if (!g || !me) return false;
  const tile = galleryTile(view);
  // countTiles false: an untapped reaction tile isn't a move (the "no tiles" idle column); a curveball still is.
  if (tile && tile.picked == null && (tile.kind === 'curveball' || countTiles)) return true;
  const phase = view.phase;
  switch (mode) {
    case 'bento-haus': {
      if (phase !== 'answer') return !!me.hard?.offer;
      const h = me.hard;
      return (
        me.taking.length > 0 ||
        me.tickets.some((t: Any) => t.state === 'open') ||
        !!h?.offer ||
        (h?.desk?.length ?? 0) > 0 ||
        (h?.requests?.length ?? 0) > 0 ||
        Object.values(h?.guests ?? {}).some((x: Any) => x.steps?.some((s: Any) => !s.ok && !s.skipped))
      );
    }
    case 'last-train':
      return !!me.task || !!me.offer || (me.canHaunt && me.hauntTargets.length > 0) || !!me.canEcho || (g.overrules ?? []).some((w: Any) => w.canVote);
    case 'onsen-murder':
      return (
        (phase === 'answer' && me.isTurn) ||
        (phase === 'encore' && !me.accusation?.said) ||
        me.deputy?.status === 'offered' ||
        !!me.deputy?.canReport
      );
    case 'omiai':
      return !!me.slot || !!me.canVote || !!me.encore?.canEncore || me.nakodo?.status === 'offered' || (!!me.nakodo?.canSay && !me.nakodo.ok && me.nakodo.triesLeft > 0);
    case 'dub-club':
      return (
        ((phase === 'prompt' || phase === 'answer') && me.acting && !me.sent && !me.passed) ||
        me.adlib?.state === 'offered' ||
        (phase === 'reveal' && ((me.canGuess && !me.guess) || (!me.heart && me.heartable.length > 0)))
      );
    case 'narabete':
      return (
        (phase === 'answer' && !!me.cardId && !me.said?.ok) ||
        (phase === 'reveal' && !!me.cardId && !me.locked) ||
        (phase === 'encore' && !!me.defending) ||
        (phase === 'score' && !!me.canVote) ||
        (phase === 'finale' && !!me.performing) ||
        me.hard?.answer === 'offered'
      );
  }
}

// ---------------------------------------------------------------- the mixed-room layer

interface Persona {
  seed: number;
  /** Tries so far per hard line, by key. */
  tries: Map<string, number>;
}

const WRONG = 'えっと… あの…';

/** Say a hard line: right on the first try at PERSONA.firstTry, later tries at PERSONA.retry. */
function lineTry(p: Persona, pid: string, key: string, model: string): { text: string; n: number } {
  const n = p.tries.get(key) ?? 0;
  const right = roll(p.seed, pid, key, n, 'line') < (n === 0 ? PERSONA.firstTry : PERSONA.retry);
  return { text: right ? model : WRONG, n };
}

/** Count a try once the game has taken it, so the next view can plan the retry. */
const counted = (p: Persona, key: string) => () => p.tries.set(key, (p.tries.get(key) ?? 0) + 1);

/** Gallery taps and curveballs, the same in every mode. */
function galleryMoves(p: Persona, view: RoomView, pid: string, state: GameState): Move[] {
  const tile = galleryTile(view);
  if (!tile || tile.picked != null) return [];
  // A stand-in tile carried out of its phase (Narabete's, standInCurveball) is the same tile: the persona decides
  // once whether to tap it, not again in each phase it is shown in.
  const sg = state.mode === 'narabete' ? findStandIn(state.modeState) : null;
  const k = sg?.g?.players?.includes(pid) && sg.g.picks?.[pid] == null && !sg.g.curveball ? `sg:${sg.dealAt}` : `${view.phaseSeq}`;
  if (tile.kind === 'curveball') {
    const c = findCurveball(state.modeState, pid);
    const options: string[] = tile.options.map((o: Any) => o.kana);
    const level = view.players.find((x) => x.id === pid)?.level ?? 'n5';
    const right = roll(p.seed, pid, k, 'curve') < PERSONA.curveRight[level];
    const wrong = options.filter((o) => o !== c?.word);
    const pick = right && c ? c.word : wrong[Math.floor(roll(p.seed, pid, k, 'curve-pick') * wrong.length)] ?? options[0];
    return [{ key: `curve:${options.join(',')}`, move: { kind: 'gallery', pick }, delayMs: between(2_000, 5_000, roll(p.seed, pid, k, 'cd')), tag: 'curve', right: !!c && pick === c.word }];
  }
  if (roll(p.seed, pid, k, 'tap?') >= PERSONA.tap) return [];
  const r = REACTIONS[Math.floor(roll(p.seed, pid, k, 'tap') * REACTIONS.length)]!;
  const tap: Move = { key: 'tap', move: { kind: 'gallery', pick: r.id }, delayMs: between(1_000, 4_000, roll(p.seed, pid, k, 'td')), tag: 'tap' };
  // spokenReaction: the tile offers a 🎤 (`say`). Say it instead of tapping about half the time; a miss taps after.
  const mic = view.players.find((x) => x.id === pid)?.mic !== 'quiet';
  if (tile.say && mic) {
    if (tile.say.missed) return [{ ...tap, key: 'tap-after-miss', delayMs: between(800, 2_000, roll(p.seed, pid, k, 'tm')) }];
    if (!tile.say.said && roll(p.seed, pid, k, 'say?') < PERSONA.sayReaction) {
      const text = roll(p.seed, pid, k, 'say-ok') < PERSONA.sayMatched ? r.kana : 'あー… えっと';
      return [{ key: 'say', move: { kind: 'gallery', pick: SAY_PICK, utterance: { via: 'speech', text } }, delayMs: between(1_500, 4_000, roll(p.seed, pid, k, 'sd')), tag: 'say' }];
    }
  }
  return [tap];
}

const offerDelay = (p: Persona, pid: string, k: string) => between(1_500, 4_000, roll(p.seed, pid, k, 'od'));
const lineDelay = (p: Persona, pid: string, k: string) => between(2_500, 6_000, roll(p.seed, pid, k, 'ld'));
const takes = (p: Persona, pid: string, k: string) => roll(p.seed, pid, k, 'accept') < PERSONA.accept;

/**
 * Each mode's hard role, played as a person would: `base` is the bot policy's moves, which this may filter (the
 * policy's own take on a hard part is replaced by the persona's numbers).
 */
function hardMoves(mode: SimMode, p: Persona, view: RoomView, pid: string, state: GameState, base: Move[]): Move[] {
  const me = meOf(view);
  const g = view.game as Any;
  if (!me || !g) return base;
  const out: Move[] = [];
  const push = (m: Move) => out.push(m);
  switch (mode) {
    case 'bento-haus': {
      const h = me.hard;
      if (!h) return base;
      if (h.offer) push({ key: `role:${g.round}`, move: { kind: 'role', accept: takes(p, pid, `bento:${g.round}:${h.offer.role}`) }, delayMs: offerDelay(p, pid, `${g.round}`) });
      for (const inc of h.desk ?? []) {
        const step = inc.steps[inc.step];
        if (!step || step.ok || step.skipped) continue;
        const key = `mgr:${inc.id}:${inc.step}`;
        const n = p.tries.get(key) ?? 0;
        if (n >= 3) {
          push({ key: `${key}:skip`, move: { kind: 'manager', incidentId: inc.id, skip: true }, delayMs: 1_000 });
          continue;
        }
        const t = lineTry(p, pid, key, step.model.kana ?? step.model.text);
        push({ key: `${key}:${t.n}`, move: { kind: 'manager', incidentId: inc.id, utterance: { via: 'speech', text: t.text } }, delayMs: lineDelay(p, pid, `${key}:${t.n}`), onSent: counted(p, key) });
      }
      for (const [visitId, gv] of Object.entries<Any>(h.guests ?? {})) {
        const step = gv.steps?.[gv.step];
        if (!step || step.ok || step.skipped) continue;
        const key = `omo:${visitId}:${gv.step}`;
        const n = p.tries.get(key) ?? 0;
        if (n >= 3) {
          push({ key: `${key}:skip`, move: { kind: 'omotenashi', visitId, skip: true }, delayMs: 1_000 });
          continue;
        }
        const t = lineTry(p, pid, key, step.model.kana ?? step.model.text);
        push({ key: `${key}:${t.n}`, move: { kind: 'omotenashi', visitId, utterance: { via: 'speech', text: t.text } }, delayMs: lineDelay(p, pid, `${key}:${t.n}`), onSent: counted(p, key) });
      }
      for (const req of h.requests ?? []) {
        if (roll(p.seed, pid, req.incidentId, 'req') < PERSONA.request) push({ key: `req:${req.incidentId}`, move: { kind: 'request-done', incidentId: req.incidentId }, delayMs: between(1_500, 3_500, roll(p.seed, pid, req.incidentId, 'rd')) });
      }
      return [...base, ...out];
    }
    case 'last-train': {
      const kept = base.filter((m) => !m.key.startsWith('role:') && !(me.task?.role && m.key === `answer:${me.task.key}`));
      if (me.offer) push({ key: `role:${me.offer.key}`, move: { kind: 'role', key: me.offer.key, accept: takes(p, pid, `lt:${me.offer.key}`) }, delayMs: offerDelay(p, pid, me.offer.key) });
      if (me.task?.role) {
        const task = me.task;
        const key = `lt:${task.key}`;
        const n = task.attempt - 1;
        p.tries.set(key, n);
        const right = roll(p.seed, pid, key, n, 'line') < (n === 0 ? PERSONA.firstTry : PERSONA.retry);
        const item = ltItems().get(task.itemId);
        const text = right && item ? item.accepted[0]! : WRONG;
        push({ key: `answer:${task.key}:${task.attempt}`, move: { kind: 'answer', key: task.key, utterance: { via: 'speech', text } }, delayMs: Math.min(task.limitMs - 500, lineDelay(p, pid, key)) });
      }
      return [...kept, ...out];
    }
    case 'onsen-murder': {
      const d = me.deputy;
      if (!d) return base;
      if (d.status === 'offered') push({ key: `deputy:${view.phaseSeq}`, move: { kind: 'deputy', accept: takes(p, pid, `onsen:${view.phaseSeq}:${view.round}`) }, delayMs: offerDelay(p, pid, `${view.phaseSeq}`) });
      if (d.canReport && d.triesLeft > 0) {
        const s = state.modeState as Any;
        const ask = s.asks?.find((a: Any) => a.no === s.deputy?.askNo);
        const key = `report:${s.deputy?.askNo}`;
        const tryNo = (s.deputy?.tries as number) ?? 0;
        p.tries.set(key, tryNo);
        const t = lineTry(p, pid, key, ask?.report?.jp?.kana?.replace(/ /g, '') ?? WRONG);
        push({ key: `${key}:${tryNo}`, move: { kind: 'report', utterance: { via: 'speech', text: t.text } }, delayMs: lineDelay(p, pid, `${key}:${tryNo}`) });
      }
      return [...base, ...out];
    }
    case 'omiai': {
      const n = me.nakodo;
      if (!n) return base;
      if (n.status === 'offered') push({ key: `nakodo:${g.round}`, move: { kind: 'nakodo', accept: takes(p, pid, `omiai:${g.round}`) }, delayMs: offerDelay(p, pid, `${g.round}`) });
      if (n.status !== 'declined' && n.status !== 'timeout' && n.canSay && !n.ok && n.triesLeft > 0 && n.line) {
        const key = `nakodo:${g.round}:${n.slot}`;
        const tryNo = NAKODO_TRIES(n);
        p.tries.set(key, tryNo);
        const t = lineTry(p, pid, key, n.line.kana);
        push({ key: `${key}:${tryNo}`, move: { kind: 'nakodo', utterance: { via: 'speech', text: t.text } }, delayMs: lineDelay(p, pid, `${key}:${tryNo}`) });
      }
      return [...base, ...out];
    }
    case 'dub-club': {
      const a = me.adlib;
      if (!a) return base;
      const round = g.round;
      if (a.state === 'offered') push({ key: `adlib:${round}`, move: { kind: 'adlib', accept: takes(p, pid, `dub:${round}`), round }, delayMs: offerDelay(p, pid, `${round}`) });
      if (a.state !== 'accepted') return [...base, ...out];
      // The ad-lib: the persona's own rehearsal (the bot's script read doesn't apply), then the bot's take.
      const kept = base.filter((m) => !m.key.startsWith('rehearse'));
      const model = adlibModel(state);
      if (view.phase === 'answer' && !me.sent && !me.passed && model) {
        const key = `adlib-line:${round}`;
        const reh = me.rehearsal;
        const tryNo = reh?.tries ?? 0;
        p.tries.set(key, tryNo);
        const needs = !reh || (reh.left > 0 && reh.similarity < 0.8 && tryNo < 2);
        if (needs) {
          const t = lineTry(p, pid, key, model);
          return [...out, { key: `rehearse:${tryNo}`, move: { kind: 'rehearse', utterance: { via: 'speech', text: t.text }, round }, delayMs: lineDelay(p, pid, `${key}:${tryNo}`) }];
        }
      }
      // The take: the phone's recogniser hears the ad-lib (right if the rehearsal was, else another try at it).
      const heardText = !model ? WRONG : (me.rehearsal?.similarity ?? 0) >= 0.8 || roll(p.seed, pid, `dub-take:${round}`) < PERSONA.retry ? model : WRONG;
      const withHeard = kept.map((m) => (m.key === 'take' ? { ...m, move: { ...(m.move as Any), heard: { via: 'speech', text: heardText } } } : m));
      return [...withHeard, ...out];
    }
    case 'narabete': {
      const h = me.hard;
      if (!h) return base;
      if (h.answer === 'offered' && view.phase === 'reveal') push({ key: `hard:${g.round}`, move: { kind: 'hard', accept: takes(p, pid, `nara:${g.round}`), round: g.round }, delayMs: offerDelay(p, pid, `${g.round}`) });
      const kept = base.filter((m) => m.key !== 'defend');
      if (view.phase === 'encore' && me.defending && h.answer === 'accepted' && h.script) {
        // One try: the model reason in the frame, or a line without ので.
        const right = roll(p.seed, pid, `nara:${g.round}`, 'line') < PERSONA.firstTry;
        const text = right ? h.script.lines[0].kana : 'これが いちばん さきです。';
        push({ key: 'defend:hard', move: { kind: 'defend', utterance: { via: 'speech', text }, round: g.round }, delayMs: lineDelay(p, pid, `nara:${g.round}`) });
        return [...kept, ...out];
      }
      return [...(view.phase === 'encore' && me.defending && h ? kept : base), ...out];
    }
  }
}

/** Omiai's tries so far on the current line (its view counts tries left of 2). */
const NAKODO_TRIES = (n: Any): number => Math.max(0, 2 - n.triesLeft);

/** The ad-lib's model line, from the game state (a person would say it their own way; the sim says the model). */
function adlibModel(state: GameState): string | null {
  const s = state.modeState as DubState;
  const r = s.rounds[s.round - 1];
  return r ? adlibOf(s, r).model.kana : null;
}

let ltIndex: Map<string, { accepted: readonly string[] }> | null = null;
const ltItems = (): Map<string, { accepted: readonly string[] }> => ltIndex!;

// ---------------------------------------------------------------- one night

export interface PlayerResult {
  id: string;
  level: Level;
  score: number;
  idleMs: number;
  longestIdleMs: number;
  /** Idle with untapped reaction tiles not counted as a move (curveballs still are). */
  idleNoTilesMs: number;
  spoken: number;
  /** Phrasebook rows: said from memory, said but read (progress.ts recallOf), retried, seen. */
  saidMem: number;
  saidRead: number;
  retry: number;
  seen: number;
  taps: number;
  /** spokenReaction: reactions said out loud, and those that matched a tile. */
  sayTried: number;
  sayMatched: number;
  /** Points from right curveballs and said reactions this game. */
  bonus: number;
}

export interface GameResult {
  mode: SimMode;
  setup: string;
  seed: number;
  lengthMs: number;
  players: PlayerResult[];
  curveDealt: number;
  curveRight: number;
  /** Host stand-in lines voiced (its cue events), and every host line cued. */
  standIns: number;
  hostLines: number;
  /**
   * standInCurveball: stand-in phases that ran past their own end waiting on the curveball, the seconds they
   * added, and how many hit the full STAND_IN_CURVEBALL_MS wait unanswered.
   */
  sgHeld: number;
  sgHeldMs: number;
  sgTimedOut: number;
  offers: { accepted: number; declined: number; timeout: number };
  waitPrompts: number;
  /** Would anyone's place in this game change without the curveball and said-reaction points (night totals are rank-based)? */
  rankFlip: boolean;
  /** Something went wrong (a stuck game): the sim stopped it. */
  stuck?: string;
}

export interface NightResult {
  setup: string;
  seed: number;
  games: GameResult[];
  waitPrompts: number;
}

function basePolicy(mode: SimMode, content: ContentLibrary, seed: number): ModePolicy {
  switch (mode) {
    case 'bento-haus':
      return bentoHausPolicy({ thinkMs: 1_500 });
    case 'last-train':
      return lastTrainPolicy({ content, seed, thinkMs: [1_000, 3_000] });
    case 'onsen-murder':
      return onsenMurderPolicy({ delayMs: [1_500, 4_000] });
    case 'omiai':
      return omiaiPolicy({ thinkMs: 2_500 });
    case 'dub-club':
      return dubClubPolicy({ thinkMs: 2_000 });
    case 'narabete':
      return narabetePolicy({ thinkMs: 2_000 });
  }
}

const MAX_GAME_MS = 60 * 60_000;
/** SIM_TRACE=1 prints every move the sim makes and what the game said. */
const TRACE = !!process.env.SIM_TRACE;
const MAX_STEPS = 200_000;

function playGame(state: GameState, mode: SimMode, setup: string, seed: number, clock: { now: number }, content: ContentLibrary, rnd: () => number, newId: () => string, rounds?: number): GameResult | null {
  const ctx = (): GameContext => ({ now: clock.now, content, newId, random: rnd });
  let cmdNo = 0;
  const stage = (command: CommandBody) => apply(state, { type: 'command', actor: { kind: 'stage' }, command: { ...command, id: `s${++cmdNo}` } as Command }, ctx());
  if (noFit(MODES[mode].info, state.players.length)) return null;
  const started = stage({ type: 'start', mode, ...(rounds ? { rounds } : {}) });
  if (started.error) throw new Error(`${mode} would not start: ${started.error}`);
  const startAt = clock.now;
  const base = basePolicy(mode, content, seed);
  const personas = new Map(state.players.map((p) => [p.id, { seed, tries: new Map() } as Persona]));
  const level = new Map(state.players.map((p) => [p.id, p.level]));
  const res = new Map<string, PlayerResult>(state.players.map((p) => [p.id, { id: p.id, level: p.level, score: 0, idleMs: 0, longestIdleMs: 0, idleNoTilesMs: 0, spoken: 0, saidMem: 0, saidRead: 0, retry: 0, seen: 0, taps: 0, sayTried: 0, sayMatched: 0, bonus: 0 }]));
  const idleSince = new Map<string, number | null>(state.players.map((p) => [p.id, null]));
  const quiet = (pid: string) => state.players.find((x) => x.id === pid)?.mic === 'quiet';
  const sent = new Set<string>();
  const curveSeen = new Set<string>();
  let curveDealt = 0;
  let curveRight = 0;
  let planned: { at: number; seq: number; pid: string; key: string; move: unknown; tag?: Move['tag']; onSent?: () => void; right?: boolean }[] = [];
  let standIns = 0;
  let hostLines = 0;
  /** The server drains host cues after each change; the sim counts them (stand-in lines by their event name). */
  const drain = () => {
    for (const c of state.cues) {
      hostLines += 1;
      if (/stand_?in/.test(c.event)) standIns += 1;
    }
    state.cues.length = 0;
  };
  drain();
  let lastWake = -1;
  let wakeRepeats = 0;
  // The stand-in's Gallery seen in the current phase, and those already weighed.
  let sgSeq = -1;
  let sgNow: Any = null;
  const sgDone = new Set<Any>();
  let sgHeld = 0;
  let sgHeldMs = 0;
  let sgTimedOut = 0;
  const weighStandIn = () => {
    if (!sgNow || sgDone.has(sgNow) || !sgNow.dealt) return;
    sgDone.add(sgNow);
    const c = sgNow.g?.curveball;
    if (!c) return;
    const over = clock.now - sgNow.until;
    if (over > 0) {
      sgHeld += 1;
      sgHeldMs += over;
    }
    if (c.pick == null) sgTimedOut += 1;
  };
  const standInRoom = state.players.length <= 2;
  let stuck: string | undefined;

  for (let step = 0; state.phase !== 'recap' && state.phase !== 'lobby'; step++) {
    if (step > MAX_STEPS || clock.now - startAt > MAX_GAME_MS) {
      stuck = `stopped at ${state.phase} after ${Math.round((clock.now - startAt) / 1000)} s`;
      break;
    }
    if (standInRoom) {
      if (state.phaseSeq !== sgSeq) {
        weighStandIn();
        sgSeq = state.phaseSeq;
        sgNow = null;
      }
      sgNow = findStandIn(state.modeState) ?? sgNow;
    }
    // 1. Every phone looks at its view: what it may do, what the persona will do.
    const busy = new Map<string, boolean>();
    const busyNoTiles = new Map<string, boolean>();
    for (const p of state.players) {
      const view = viewFor(state, { kind: 'player', playerId: p.id }, content);
      busy.set(p.id, hasInput(mode, view));
      busyNoTiles.set(p.id, hasInput(mode, view, false));
      const tile = galleryTile(view);
      if (tile?.kind === 'curveball') {
        const id = `${p.id}:${tile.options.map((o: Any) => o.kana).join(',')}`;
        if (!curveSeen.has(id)) {
          curveSeen.add(id);
          curveDealt += 1;
        }
      }
      const persona = personas.get(p.id)!;
      let moves: Move[] = base.act(view, p.id);
      moves = hardMoves(mode, persona, view, p.id, state, moves);
      moves = [...moves, ...galleryMoves(persona, view, p.id, state)];
      for (const m of moves) {
        const full = `${view.phaseSeq}:${p.id}:${m.key}`;
        if (sent.has(full)) continue;
        sent.add(full);
        // A quiet phone (no mic) types what a policy would have said.
        const u = (m.move as Any)?.utterance;
        const move = quiet(p.id) && u?.via === 'speech' ? { ...(m.move as Any), utterance: { ...u, via: 'typed' } } : m.move;
        planned.push({ at: clock.now + Math.max(1, m.delayMs ?? 0), seq: view.phaseSeq, pid: p.id, key: m.key, move, tag: m.tag, onSent: m.onSent, right: m.right });
      }
    }
    // A move planned in a phase that has ended is dropped (the phone re-renders).
    planned = planned.filter((x) => x.seq === state.phaseSeq);
    planned.sort((a, b) => a.at - b.at);

    // 2. The next thing that happens: a move, a mode's wake, or the phase timer.
    const wake = wakeAt(state, ctx());
    const deadline = state.deadline ?? Infinity;
    const nextMove = planned[0]?.at ?? Infinity;
    let next = Math.min(nextMove, wake ?? Infinity, deadline);
    if (!Number.isFinite(next)) {
      stuck = `nothing left to happen in ${state.phase}`;
      break;
    }
    next = Math.max(next, clock.now);

    // Idle bookkeeping for the stretch [now, next).
    for (const p of state.players) {
      if (level.get(p.id) === 'n4') continue;
      const r = res.get(p.id)!;
      const since = idleSince.get(p.id)!;
      if (busy.get(p.id)) {
        if (since !== null) r.longestIdleMs = Math.max(r.longestIdleMs, clock.now - since);
        idleSince.set(p.id, null);
      } else {
        r.idleMs += next - clock.now;
        if (since === null) idleSince.set(p.id, clock.now);
      }
      if (!busyNoTiles.get(p.id)) r.idleNoTilesMs += next - clock.now;
    }
    clock.now = next;

    // 3. Make it happen.
    if (nextMove <= Math.min(wake ?? Infinity, deadline)) {
      const m = planned.shift()!;
      const before = state.players.find((x) => x.id === m.pid)?.score ?? 0;
      const out = apply(state, { type: 'command', actor: { kind: 'player', playerId: m.pid }, command: { type: 'play', move: m.move, id: `m${++cmdNo}` } as Command }, ctx());
      if (TRACE) console.log(`${((clock.now - startAt) / 1000).toFixed(1)}s ${state.phase} ${m.pid} ${JSON.stringify(m.move).slice(0, 140)} ${out.error ?? 'ok'}`);
      if (!out.error) {
        m.onSent?.();
        const r = res.get(m.pid)!;
        const u = (m.move as Any).utterance;
        if (u?.via === 'speech') r.spoken += 1;
        if (m.tag === 'tap') r.taps += 1;
        // Counted when the game takes the pick: a stand-in phase may end at once, before the tile shows it.
        if (m.tag === 'curve' && m.right) curveRight += 1;
        // The bonus this pick paid, capped at what a curveball or a said reaction pays (in case the pick also ended a phase).
        if (m.tag === 'curve' || m.tag === 'say') {
          const gained = (state.players.find((x) => x.id === m.pid)?.score ?? 0) - before;
          r.bonus += Math.max(0, Math.min(gained, m.tag === 'curve' ? curveballPoints(mode) : SPOKEN_REACTION_POINTS));
        }
        if (m.tag === 'say') {
          r.sayTried += 1;
          const after = galleryTile(viewFor(state, { kind: 'player', playerId: m.pid }, content));
          if (after?.say?.said || (after?.picked != null && !after?.say?.missed)) r.sayMatched += 1;
        }
      }
    } else if (wake !== null && wake <= deadline) {
      if (wake === lastWake) wakeRepeats += 1;
      else wakeRepeats = 0;
      lastWake = wake;
      apply(state, { type: 'wake', phaseSeq: state.phaseSeq }, ctx());
      // A wake that keeps asking for the same moment and changes nothing: nudge the clock.
      if (wakeRepeats > 20) clock.now += 50;
    } else apply(state, { type: 'timeout', phaseSeq: state.phaseSeq }, ctx());
    drain();
  }

  if (standInRoom) weighStandIn();
  for (const p of state.players) {
    const r = res.get(p.id)!;
    const since = idleSince.get(p.id);
    if (since != null) r.longestIdleMs = Math.max(r.longestIdleMs, clock.now - since);
    r.score = p.score;
    for (const e of state.phrasebook[p.id] ?? []) {
      if (e.outcome === 'said') {
        if (recallOf(e, mode) === 'memory') r.saidMem += 1;
        else r.saidRead += 1;
      } else if (e.outcome === 'retry') r.retry += 1;
      else if (e.outcome === 'seen') r.seen += 1;
    }
  }
  // Places as the recap gives them (1 + players strictly ahead), with and without the bonus points.
  const players = [...res.values()];
  const place = (score: (p: PlayerResult) => number) => players.map((p) => 1 + players.filter((o) => score(o) > score(p)).length);
  const withBonus = place((p) => p.score);
  const without = place((p) => p.score - p.bonus);
  const rankFlip = withBonus.some((x, i) => x !== without[i]);
  const offers = { accepted: 0, declined: 0, timeout: 0 };
  const m = MODES[mode] as Any;
  if (m.offers && state.modeState) for (const p of state.players) for (const o of m.offers(state.modeState, p.id)) if (o.answer !== 'away') offers[o.answer as keyof typeof offers] += 1;
  return {
    mode,
    setup,
    seed,
    lengthMs: clock.now - startAt,
    players: [...res.values()],
    curveDealt,
    curveRight,
    standIns,
    hostLines,
    sgHeld,
    sgHeldMs,
    sgTimedOut,
    offers,
    waitPrompts: state.recap?.mixed?.ask.length ?? 0,
    rankFlip,
    ...(stuck ? { stuck } : {}),
  };
}

/** One night in one room: the modes back to back, the order rotated by the seed. */
export function playNight(setup: string, seed: number, modes: readonly SimMode[], content: ContentLibrary, rounds: Partial<Record<SimMode, number>> = {}): NightResult {
  ltIndex ??= itemIndex(content);
  const { levels, quiet = [] } = SETUPS[setup]!;
  const state = createGame('SIMR');
  const clock = { now: 1_000_000 };
  // Joining draws nothing; each game gets its own random stream (seed, room, game), so a switch that changes how
  // many draws one game makes doesn't reshuffle the games after it in the night (A/B stays like for like).
  let rnd = mulberry(seed * 7919 + setup.charCodeAt(0));
  let ids = 0;
  let gameNo = 0;
  const newId = () => `g${gameNo}x${++ids}`;
  const ctx = (): GameContext => ({ now: clock.now, content, newId, random: () => rnd() });
  levels.forEach((level, i) => {
    // Player ids carry the seed, so the bot policies (which hash the player's id) differ seed to seed.
    const playerId = `s${seed}p${i + 1}`;
    apply(state, { type: 'join', playerId, name: `P${i + 1}`, level }, ctx());
    apply(state, { type: 'connection', playerId, connected: true }, ctx());
    // A quiet phone: the lobby mic check's "I can't talk right now" tap.
    if (quiet.includes(i)) apply(state, { type: 'command', actor: { kind: 'player', playerId }, command: { type: 'micCheck', utterance: { via: 'tap', text: '' }, id: `q${i}` } as Command }, ctx());
  });
  const order = modes.map((_, i) => modes[(i + seed) % modes.length]!);
  const games: GameResult[] = [];
  let cmdNo = 0;
  for (const mode of order) {
    // Ids, the clock and the phase count restart per game too (the clock on a fresh hour), for the same reason.
    gameNo += 1;
    ids = 0;
    clock.now = gameNo * 10_000_000;
    // The bot policies hash the phase number: start each game on a round one, so earlier games don't shift it.
    state.phaseSeq = gameNo * 100_000;
    rnd = mulberry(seed * 7919 + setup.charCodeAt(0) * 131 + SIM_MODES.indexOf(mode) * 1_000_003);
    const g = playGame(state, mode, setup, seed, clock, content, (() => rnd()), newId, rounds[mode]);
    if (!g) continue;
    games.push(g);
    if (state.phase === 'recap') {
      clock.now += 15_000;
      apply(state, { type: 'command', actor: { kind: 'stage' }, command: { type: 'playAgain', id: `n${++cmdNo}` } as Command }, ctx());
    } else if (state.phase !== 'lobby') {
      apply(state, { type: 'command', actor: { kind: 'stage' }, command: { type: 'endGame', id: `n${++cmdNo}` } as Command }, ctx());
    }
  }
  return { setup, seed, games, waitPrompts: games.reduce((n, g) => n + g.waitPrompts, 0) };
}

// ---------------------------------------------------------------- metrics

export interface Stat {
  mean: number;
  sd: number;
  n: number;
}

const stat = (xs: number[]): Stat => {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return { mean: NaN, sd: NaN, n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return { mean, sd, n: v.length };
};

export interface CellMetrics {
  mode: SimMode;
  setup: string;
  games: number;
  stuck: number;
  /** Game length, seconds. */
  lengthS: Stat;
  /** Per player below N4: seconds their view offered no move, its share of the game, the longest such stretch. */
  idleS: Stat;
  idleShare: Stat;
  longestIdleS: Stat;
  /** The same idle time with untapped reaction tiles not counted as a move (curveballs still are). */
  idleNoTilesS: Stat;
  /** Per game: Gallery reaction taps (all players). */
  taps: Stat;
  /** Per game: curveballs dealt and answered right. */
  curveDealt: Stat;
  curveRight: Stat;
  /** Per game: host stand-in lines, and all host lines cued. */
  standIns: Stat;
  hostLines: Stat;
  /** Per player below N4: accepted moves said by voice. */
  spokenLow: Stat;
  /** Per player, from the phrasebook: said from memory, said but read (recallOf), retried, seen; below N4 and at N4. */
  saidMemLow: Stat;
  saidReadLow: Stat;
  retryLow: Stat;
  seenLow: Stat;
  saidMemN4: Stat;
  saidReadN4: Stat;
  retryN4: Stat;
  seenN4: Stat;
  /** Share of games where taking away the curveball and said-reaction points changes someone's place. */
  rankFlips: number;
  /** Share of the game's points that went to players below N4 (rooms with an N4 player and some points). */
  lowScoreShare: Stat;
  /** Their share of the seats, for comparison. */
  lowSeatShare: number;
  /** N4 offers taken: accepted ÷ (accepted + declined + timeout), pooled over the games. */
  n4AcceptRate: number | null;
  offersPerGame: Stat;
  /** The recap's waiting-check prompts this game. */
  waitPrompts: Stat;
  /** spokenReaction, per player below N4: reactions said, and matched. */
  sayTried: Stat;
  sayMatched: Stat;
  /** Share of games that dealt a curveball; right ÷ dealt, pooled. */
  curveRate: number;
  curveHit: number | null;
  /** standInCurveball: per game, stand-in phases held past their end by the curveball, seconds added, full 5 s waits. */
  sgHeld: Stat;
  sgHeldS: Stat;
  sgTimedOut: Stat;
  /** By level: mean share of the game's points, and share of games won (ties split), for levels in the room. */
  byLevel: Partial<Record<Level, { seats: number; scoreShare: number; winShare: number }>>;
}

export function cellMetrics(games: GameResult[], mode: SimMode, setup: string): CellMetrics {
  const low = (g: GameResult) => g.players.filter((p) => p.level !== 'n4');
  const n4 = (g: GameResult) => g.players.filter((p) => p.level === 'n4');
  const per = (f: (p: PlayerResult, g: GameResult) => number, pick = low) => stat(games.flatMap((g) => pick(g).map((p) => f(p, g))));
  const offers = games.reduce((o, g) => ({ a: o.a + g.offers.accepted, all: o.all + g.offers.accepted + g.offers.declined + g.offers.timeout }), { a: 0, all: 0 });
  const levels = SETUPS[setup]!.levels;
  return {
    mode,
    setup,
    games: games.length,
    stuck: games.filter((g) => g.stuck).length,
    lengthS: stat(games.map((g) => g.lengthMs / 1000)),
    idleS: per((p) => p.idleMs / 1000),
    idleShare: per((p, g) => (g.lengthMs ? p.idleMs / g.lengthMs : 0)),
    longestIdleS: per((p) => p.longestIdleMs / 1000),
    idleNoTilesS: per((p) => p.idleNoTilesMs / 1000),
    taps: stat(games.map((g) => g.players.reduce((n, p) => n + p.taps, 0))),
    curveDealt: stat(games.map((g) => g.curveDealt)),
    curveRight: stat(games.map((g) => g.curveRight)),
    standIns: stat(games.map((g) => g.standIns)),
    hostLines: stat(games.map((g) => g.hostLines)),
    spokenLow: per((p) => p.spoken),
    saidMemLow: per((p) => p.saidMem),
    saidReadLow: per((p) => p.saidRead),
    retryLow: per((p) => p.retry),
    seenLow: per((p) => p.seen),
    saidMemN4: per((p) => p.saidMem, n4),
    saidReadN4: per((p) => p.saidRead, n4),
    retryN4: per((p) => p.retry, n4),
    seenN4: per((p) => p.seen, n4),
    rankFlips: games.length ? games.filter((g) => g.rankFlip).length / games.length : 0,
    lowScoreShare: stat(
      games.map((g) => {
        const all = g.players.reduce((n, p) => n + p.score, 0);
        return n4(g).length && all > 0 ? low(g).reduce((n, p) => n + p.score, 0) / all : NaN;
      }),
    ),
    lowSeatShare: levels.filter((l) => l !== 'n4').length / levels.length,
    n4AcceptRate: offers.all ? offers.a / offers.all : null,
    offersPerGame: stat(games.map((g) => g.offers.accepted + g.offers.declined + g.offers.timeout)),
    waitPrompts: stat(games.map((g) => g.waitPrompts)),
    sayTried: per((p) => p.sayTried),
    sayMatched: per((p) => p.sayMatched),
    curveRate: games.length ? games.filter((g) => g.curveDealt > 0).length / games.length : 0,
    curveHit: (() => {
      const dealt = games.reduce((n, g) => n + g.curveDealt, 0);
      return dealt ? games.reduce((n, g) => n + g.curveRight, 0) / dealt : null;
    })(),
    sgHeld: stat(games.map((g) => g.sgHeld)),
    sgHeldS: stat(games.map((g) => g.sgHeldMs / 1000)),
    sgTimedOut: stat(games.map((g) => g.sgTimedOut)),
    byLevel: byLevel(games, levels),
  };
}

function byLevel(games: GameResult[], levels: readonly Level[]): CellMetrics['byLevel'] {
  const out: CellMetrics['byLevel'] = {};
  for (const lv of [...new Set(levels)]) {
    const shares: number[] = [];
    let wins = 0;
    for (const g of games) {
      const all = g.players.reduce((n, p) => n + p.score, 0);
      if (all > 0) shares.push(g.players.filter((p) => p.level === lv).reduce((n, p) => n + p.score, 0) / all);
      const top = Math.max(...g.players.map((p) => p.score));
      const winners = g.players.filter((p) => p.score === top);
      wins += winners.filter((p) => p.level === lv).length / winners.length;
    }
    out[lv] = { seats: levels.filter((l) => l === lv).length / levels.length, scoreShare: stat(shares).mean, winShare: games.length ? wins / games.length : NaN };
  }
  return out;
}

// ---------------------------------------------------------------- running

export interface SimOptions {
  seeds: number;
  modes: readonly SimMode[];
  setups: readonly string[];
  /** Experiment switches to set for the run. */
  experiments?: Partial<MixedExperiments>;
  /** Rounds (stops, shifts) per mode, where a mode lets the host choose; left out, the mode's default. */
  rounds?: Partial<Record<SimMode, number>>;
  content: ContentLibrary;
}

export interface SimRun {
  experiments: MixedExperiments;
  options: { seeds: number; modes: readonly SimMode[]; setups: readonly string[]; rounds: Partial<Record<SimMode, number>> };
  cells: CellMetrics[];
  /** Per setup: waiting-check prompts over a night of the chosen modes. */
  nights: { setup: string; games: number; waitPrompts: Stat }[];
  ms: number;
}

export function runSim(opts: SimOptions): SimRun {
  const t0 = Date.now();
  const restore = withExperiments(opts.experiments ?? {});
  try {
    const nights: NightResult[] = [];
    for (const setup of opts.setups) for (let seed = 1; seed <= opts.seeds; seed++) nights.push(playNight(setup, seed, opts.modes, opts.content, opts.rounds));
    const cells: CellMetrics[] = [];
    for (const mode of opts.modes)
      for (const setup of opts.setups) {
        const games = nights.filter((n) => n.setup === setup).flatMap((n) => n.games.filter((g) => g.mode === mode));
        if (games.length) cells.push(cellMetrics(games, mode, setup));
      }
    return {
      experiments: { ...EXPERIMENTS },
      options: { seeds: opts.seeds, modes: opts.modes, setups: opts.setups, rounds: opts.rounds ?? {} },
      cells,
      nights: opts.setups.map((setup) => {
        const ns = nights.filter((n) => n.setup === setup);
        return { setup, games: ns[0]?.games.length ?? 0, waitPrompts: stat(ns.map((n) => n.waitPrompts)) };
      }),
      ms: Date.now() - t0,
    };
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------- printing

const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '–');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const pct = (x: number | null) => (x !== null && Number.isFinite(x) ? `${Math.round(x * 100)}%` : '–');
const ms = (s: Stat, f = f0) => (s.n ? `${f(s.mean)}±${f(s.sd)}` : '–');

const SHORT: Record<SimMode, string> = { 'bento-haus': 'bento', 'last-train': 'train', 'onsen-murder': 'onsen', omiai: 'omiai', 'dub-club': 'dub', narabete: 'narabete' };

const COLUMNS: { head: string; cell: (c: CellMetrics) => string }[] = [
  { head: 'mode', cell: (c) => SHORT[c.mode] },
  { head: 'set', cell: (c) => c.setup + (c.stuck ? `!${c.stuck}` : '') },
  { head: 'len s', cell: (c) => ms(c.lengthS) },
  { head: 'idle s/p', cell: (c) => ms(c.idleS) },
  { head: 'idle s/p (no tiles)', cell: (c) => ms(c.idleNoTilesS) },
  { head: 'idle%', cell: (c) => pct(c.idleShare.mean) },
  { head: 'max idle s', cell: (c) => ms(c.longestIdleS) },
  { head: 'taps', cell: (c) => ms(c.taps, f1) },
  { head: 'curve games/hit', cell: (c) => `${pct(c.curveRate)}/${pct(c.curveHit)}` },
  { head: 'stand-in cues', cell: (c) => f1(c.standIns.mean) },
  { head: 'sg held/s/5s', cell: (c) => (c.setup === 'c' ? `${f1(c.sgHeld.mean)}/${f1(c.sgHeldS.mean)}/${f1(c.sgTimedOut.mean)}` : '–') },
  { head: 'spoken/p<N4', cell: (c) => ms(c.spokenLow, f1) },
  { head: 'say/match <N4', cell: (c) => `${f1(c.sayTried.mean)}/${f1(c.sayMatched.mean)}` },
  { head: 'said mem/read/retry/seen <N4', cell: (c) => `${f1(c.saidMemLow.mean)}/${f1(c.saidReadLow.mean)}/${f1(c.retryLow.mean)}/${f1(c.seenLow.mean)}` },
  { head: 'said mem/read/retry/seen N4', cell: (c) => (c.saidMemN4.n ? `${f1(c.saidMemN4.mean)}/${f1(c.saidReadN4.mean)}/${f1(c.retryN4.mean)}/${f1(c.seenN4.mean)}` : '–') },
  { head: 'rank flips', cell: (c) => pct(c.rankFlips) },
  { head: 'pts <N4 (seats)', cell: (c) => (c.lowScoreShare.n ? `${pct(c.lowScoreShare.mean)} (${pct(c.lowSeatShare)})` : '–') },
  { head: 'N4 accept', cell: (c) => (c.n4AcceptRate === null ? '–' : `${pct(c.n4AcceptRate)} of ${f1(c.offersPerGame.mean)}`) },
  { head: 'wait?', cell: (c) => f1(c.waitPrompts.mean) },
];

function table(rows: string[][]): string {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  return rows.map((r) => r.map((x, i) => x.padEnd(widths[i]!)).join('  ').trimEnd()).join('\n');
}

export function formatRun(run: SimRun): string {
  const on = Object.entries(run.experiments)
    .map(([k, v]) => `${k}=${v ? 'on' : 'off'}`)
    .join(' ');
  const rounds = Object.entries(run.options.rounds).map(([m, n]) => `${m}=${n}`).join(', ');
  const lines = [`Experiments: ${on}`, `Seeds: ${run.options.seeds}${rounds ? `  Rounds: ${rounds}` : ''}  (${(run.ms / 1000).toFixed(1)} s)`, ''];
  lines.push(table([COLUMNS.map((c) => c.head), ...run.cells.map((c) => COLUMNS.map((col) => col.cell(c)))]));
  lines.push('', 'By level: share of points / share of wins (share of seats)');
  const lv = (c: CellMetrics, l: Level) => {
    const x = c.byLevel[l];
    return x ? `${pct(x.scoreShare)}/${pct(x.winShare)} (${pct(x.seats)})` : '–';
  };
  lines.push(table([['mode', 'set', 'kana', 'n5', 'n4'], ...run.cells.map((c) => [SHORT[c.mode], c.setup, lv(c, 'kana'), lv(c, 'n5'), lv(c, 'n4')])]));
  lines.push('', 'Waiting-check prompts per night:');
  for (const n of run.nights) lines.push(`  ${n.setup} ${SETUPS[n.setup]!.label}: ${ms(n.waitPrompts, f1)} over ${n.games} games`);
  lines.push('', 'Setups: ' + Object.entries(SETUPS).map(([k, s]) => `${k} = ${s.label}`).join('; '));
  return lines.join('\n');
}

/** The A/B difference: on minus off, per cell, for the metrics a switch is likely to move. */
export function formatAb(name: string, off: SimRun, on: SimRun): string {
  const d = (a: Stat, b: Stat, f = f1) => (a.n && b.n ? `${b.mean - a.mean >= 0 ? '+' : ''}${f(b.mean - a.mean)}` : '–');
  const rows = [['mode', 'set', 'Δlen s', 'Δidle s/p', 'Δidle (no tiles)', 'Δmax idle', 'Δtaps', 'Δcurve', 'Δcurve right', 'Δstand-in', 'Δsg held s', 'Δspoken/p', 'Δsay/p', 'Δsaid mem <N4', 'Δsaid read <N4', 'Δretry <N4', 'Δseen <N4', 'Δpts <N4', 'Δwin <N4', 'Δrank flips', 'Δwait?']];
  for (const b of on.cells) {
    const a = off.cells.find((c) => c.mode === b.mode && c.setup === b.setup);
    if (!a) continue;
    const share = a.lowScoreShare.n && b.lowScoreShare.n ? `${Math.round((b.lowScoreShare.mean - a.lowScoreShare.mean) * 100)}pt` : '–';
    const win = (c: CellMetrics) => (c.byLevel.n4 ? 1 - c.byLevel.n4.winShare : NaN);
    const dw = Number.isFinite(win(a)) && Number.isFinite(win(b)) ? `${Math.round((win(b) - win(a)) * 100)}pt` : '–';
    rows.push([SHORT[b.mode], b.setup, d(a.lengthS, b.lengthS), d(a.idleS, b.idleS), d(a.idleNoTilesS, b.idleNoTilesS), d(a.longestIdleS, b.longestIdleS), d(a.taps, b.taps), d(a.curveDealt, b.curveDealt), d(a.curveRight, b.curveRight), d(a.standIns, b.standIns), d(a.sgHeldS, b.sgHeldS), d(a.spokenLow, b.spokenLow), d(a.sayTried, b.sayTried), d(a.saidMemLow, b.saidMemLow), d(a.saidReadLow, b.saidReadLow), d(a.retryLow, b.retryLow), d(a.seenLow, b.seenLow), share, dw, `${Math.round((b.rankFlips - a.rankFlips) * 100)}pt`, d(a.waitPrompts, b.waitPrompts)]);
  }
  const lines = [`A/B ${name}: on minus off (${on.options.seeds} seeds each)`, '', table(rows), '', 'Waiting-check prompts per night:'];
  for (const n of on.nights) {
    const o = off.nights.find((x) => x.setup === n.setup)!;
    lines.push(`  ${n.setup}: off ${ms(o.waitPrompts, f1)}, on ${ms(n.waitPrompts, f1)}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv: string[]): { seeds: number; modes: SimMode[]; setups: string[]; rounds: Partial<Record<SimMode, number>>; on: string[]; off: string[]; ab: string | null; out: string | null } {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const list = (name: string) => (get(name) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const modes = list('modes');
  for (const m of modes) if (!(SIM_MODES as readonly string[]).includes(m)) throw new Error(`unknown mode ${m} (one of ${SIM_MODES.join(', ')})`);
  const setups = list('setups');
  for (const s of setups) if (!SETUPS[s]) throw new Error(`unknown setup ${s} (one of ${Object.keys(SETUPS).join(', ')})`);
  const rounds: Partial<Record<SimMode, number>> = {};
  for (const r of list('rounds')) {
    const [m, n] = r.split('=');
    if (!(SIM_MODES as readonly string[]).includes(m!) || !Number(n)) throw new Error(`bad --rounds ${r} (mode=number, e.g. last-train=6)`);
    rounds[m as SimMode] = Number(n);
  }
  const on = list('on');
  const off = list('off');
  const ab = get('ab') ?? null;
  for (const k of [...on, ...off, ...(ab && ab !== 'all' ? [ab] : [])]) if (!(k in EXPERIMENTS)) throw new Error(`unknown switch ${k} (one of ${Object.keys(EXPERIMENTS).join(', ')})`);
  return {
    seeds: Number(get('seeds') ?? 20),
    modes: modes.length ? (modes as SimMode[]) : [...SIM_MODES],
    setups: setups.length ? setups : Object.keys(SETUPS),
    rounds,
    on,
    off,
    ab,
    out: get('out') ?? null,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { loadContent } = await import('../../server/src/content.js');
  const content = loadContent(fileURLToPath(new URL('../../', import.meta.url)));
  const experiments: Partial<MixedExperiments> = {};
  for (const k of args.on) experiments[k as keyof MixedExperiments] = true;
  for (const k of args.off) experiments[k as keyof MixedExperiments] = false;
  const base = { seeds: args.seeds, modes: args.modes, setups: args.setups, rounds: args.rounds, content };
  if (args.ab === 'all') {
    // Every switch, each played off and on with the others as set.
    const out: Record<string, { off: SimRun; on: SimRun }> = {};
    for (const sw of Object.keys(EXPERIMENTS) as (keyof MixedExperiments)[]) {
      const off = runSim({ ...base, experiments: { ...experiments, [sw]: false } });
      const on = runSim({ ...base, experiments: { ...experiments, [sw]: true } });
      out[sw] = { off, on };
      console.log(formatAb(sw, off, on), '\n');
    }
    if (args.out) writeFileSync(args.out, JSON.stringify({ ab: 'all', switches: out }, null, 2));
  } else if (args.ab) {
    const sw = args.ab as keyof MixedExperiments;
    const off = runSim({ ...base, experiments: { ...experiments, [sw]: false } });
    const on = runSim({ ...base, experiments: { ...experiments, [sw]: true } });
    console.log(formatRun(off), '\n');
    console.log(formatRun(on), '\n');
    console.log(formatAb(sw, off, on));
    if (args.out) writeFileSync(args.out, JSON.stringify({ ab: sw, off, on }, null, 2));
  } else {
    const run = runSim({ ...base, experiments });
    console.log(formatRun(run));
    if (args.out) writeFileSync(args.out, JSON.stringify(run, null, 2));
  }
  if (args.out) console.log(`\nWrote ${args.out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
