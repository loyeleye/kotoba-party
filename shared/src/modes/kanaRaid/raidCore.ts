// The raid's battle engine, shared by Kana Yōkai Raid (kanaRaid.ts) and its Green Car version, Katsuyō Raid
// (katsuyoRaid.ts): yōkai with fixed spawn and escape times, the lazy escape sweep, team combos, the capped
// speaking bonus, option dealing, and the switch that plays the Green Car raid in a Green Car room.
//
// Time: the mode has no timers, so an escape is settled at the next move (or when the wave ends); the stage
// animates from the same times, so what people see matches what the rules settle.

import type { Mode, ModeContext } from '../mode.js';
import { shuffled } from '../mode.js';
import type { ModeId } from '../../protocol.js';

// ---------- tuning ----------

export const BASE_POINTS = 100;
/** A quiet (tapped or typed) hit lands at this share of a spoken one. */
export const QUIET_DAMAGE = 0.7;
/** The speaking bonus on top of a hit's points, from the capped pool. */
export const SPEAK_BONUS = 0.3;
/** Speaking bonuses are at most this share of a player's points in a wave (design doc). */
export const BONUS_CAP = 0.3;
export const COMBO_WINDOW_MS = 4_000;
export const BOSS_BONUS = 100;
export const CUE_GAP_MS = 2_500;
/** How long a recording the phone is still checking can come back for its bonus. */
export const SAY_LATER_MS = 20_000;

// ---------- shapes ----------

export interface RaidOption {
  id: string;
  label: string;
  sub?: string;
  /** Echo: the sound this choice plays (its label is just a number). */
  hear?: string;
}

export interface CoreYokai {
  id: string;
  itemId: string;
  char: string;
  hp: number;
  maxHp: number;
  spawnAt: number;
  escapeAt: number;
  state: 'alive' | 'defeated' | 'escaped';
  endedAt: number | null;
  hitAt: number | null;
  /** Who landed the last hit, and what that hit paid: the stage's catch chip. */
  caughtBy?: string;
  caughtPoints?: number;
}

export interface Combo {
  count: number;
  players: string[];
  lastAt: number;
  best: number;
}

/** What the engine needs of a raid's state. */
export interface CoreState<Y extends CoreYokai = CoreYokai> {
  horde: Y[];
  escaped: { itemId: string; char: string }[];
  waveEndsAt: number;
  lastCueAt: number;
  combo: Combo;
  defeatedTotal: number;
  bestCombo: number;
}

export const freshCombo = (): Combo => ({ count: 0, players: [], lastAt: 0, best: 0 });

// ---------- host ----------

export function cueRaid(s: { lastCueAt: number }, ctx: ModeContext, event: Parameters<ModeContext['cue']>[0]['event'], force = false, slots?: Record<string, string>): void {
  if (!force && ctx.now - s.lastCueAt < CUE_GAP_MS) return;
  s.lastCueAt = ctx.now;
  ctx.cue({ host: 'fude', event, ...(slots ? { slots } : {}) });
}

// ---------- the horde ----------

/** How far along its march a yōkai is (0 at the right edge, 1 at the gate): the TV's left-to-right order. */
export const along = (y: CoreYokai, now: number) => (now - y.spawnAt) / Math.max(1, y.escapeAt - y.spawnAt);

export const isAlive = (y: CoreYokai, now: number) => y.state === 'alive' && y.escapeAt > now;

/**
 * Walks `y` on now, and everything due after it that much sooner, keeping their spacing.
 * The stage keys each yōkai by its spawn time, so a moved one starts its march afresh.
 */
export function bringOn(s: CoreState, y: CoreYokai, now: number): void {
  const shift = y.spawnAt - now;
  if (shift <= 0) return;
  const from = y.spawnAt;
  for (const x of s.horde) {
    if (x.state !== 'alive' || x.spawnAt < from) continue;
    x.spawnAt -= shift;
    x.escapeAt -= shift;
  }
  s.waveEndsAt = Math.max(...s.horde.map((x) => x.escapeAt)) + 1_000;
}

/** Escapes whatever reached the gate by now. */
export function sweep(s: CoreState, ctx: ModeContext): void {
  let fled = 0;
  for (const y of s.horde) {
    if (y.state === 'alive' && y.escapeAt <= ctx.now) {
      y.state = 'escaped';
      y.endedAt = y.escapeAt;
      s.escaped.push({ itemId: y.itemId, char: y.char });
      fled++;
    }
  }
  if (fled) cueRaid(s, ctx, 'raid_escape');
}

/** The end of a wave: whoever is still on the stage slips away. */
export function escapeRest(s: CoreState, now: number): void {
  for (const y of s.horde) {
    if (y.state !== 'alive') continue;
    y.state = 'escaped';
    y.endedAt = Math.min(now, y.escapeAt);
    s.escaped.push({ itemId: y.itemId, char: y.char });
  }
}

export interface Strike<Y extends CoreYokai> {
  damage: number;
  /** Hits from two or more players inside the window. */
  teamCombo: boolean;
  combo: number;
  target: Y | undefined;
  /** The target had already gone, so the hit landed on another yōkai. */
  splash: boolean;
  /** This hit knocked the target out. */
  defeated: boolean;
}

/**
 * Lands a hit of `damage`: counts the team combo (hits from two or more players inside the window add 10% a
 * step), then strikes the aimed yōkai, or splashes onto the one closest to the gate.
 */
export function strike<Y extends CoreYokai>(s: CoreState<Y>, playerId: string, yokaiId: string | null, damage: number, ctx: ModeContext): Strike<Y> {
  const now = ctx.now;
  const c = s.combo;
  if (now - c.lastAt <= COMBO_WINDOW_MS) {
    c.count += 1;
    if (!c.players.includes(playerId)) c.players.push(playerId);
  } else {
    c.count = 1;
    c.players = [playerId];
  }
  c.lastAt = now;
  const teamCombo = c.players.length >= 2;
  if (teamCombo) {
    damage *= 1 + 0.1 * Math.min(5, c.count - 1);
    c.best = Math.max(c.best, c.count);
    if ([3, 6, 10, 15, 20].includes(c.count)) cueRaid(s, ctx, 'raid_combo', true);
  }
  damage = Math.round(damage);

  let target = yokaiId ? s.horde.find((y) => y.id === yokaiId && isAlive(y, now)) : undefined;
  let splash = false;
  if (!target) {
    // Only onto a yōkai on stage: never one that hasn't walked on yet.
    target = s.horde.filter((y) => isAlive(y, now) && y.spawnAt <= now).sort((x, y) => along(y, now) - along(x, now))[0];
    splash = !!target;
  }
  let defeated = false;
  if (target) {
    target.hp = Math.max(0, target.hp - damage);
    target.hitAt = now;
    if (target.hp === 0) {
      target.state = 'defeated';
      target.endedAt = now;
      target.caughtBy = playerId;
      s.defeatedTotal += 1;
      defeated = true;
      cueRaid(s, ctx, 'raid_hit');
    }
  }
  s.bestCombo = Math.max(s.bestCombo, c.best);
  return { damage, teamCombo, combo: c.count, target, splash, defeated };
}

// ---------- points ----------

/** Pays a speaking bonus from the capped pool (≤ 30% of the player's points this wave). */
export function payBonus(p: { wave: { base: number; bonus: number } }, ctx: ModeContext, playerId: string, want: number): number {
  const room = Math.floor((BONUS_CAP * p.wave.base - (1 - BONUS_CAP) * p.wave.bonus) / (1 - BONUS_CAP));
  const bonus = Math.max(0, Math.min(want, room));
  if (bonus > 0) {
    ctx.award(playerId, bonus);
    p.wave.bonus += bonus;
  }
  return bonus;
}

// ---------- options ----------

/** Shuffles options and gives them opaque ids; returns the id of the right one. */
export function dealOptions(right: Omit<RaidOption, 'id'>, wrong: Omit<RaidOption, 'id'>[], ctx: ModeContext): { options: RaidOption[]; answer: string } {
  const all = shuffled([{ ...right, right: true }, ...wrong.map((w) => ({ ...w, right: false }))], ctx.random);
  const options = all.map((o, i) => ({ id: String(i), label: o.label, ...(o.sub ? { sub: o.sub } : {}), ...(o.hear ? { hear: o.hear } : {}) }));
  return { options, answer: String(all.findIndex((o) => o.right)) };
}

/** Up to `n` distinct picks, preferred ones first. */
export function distinct<T>(preferred: readonly T[], rest: readonly T[], n: number, key: (t: T) => string, exclude: Set<string>, ctx: ModeContext): T[] {
  const out: T[] = [];
  const seen = new Set(exclude);
  for (const list of [shuffled(preferred, ctx.random), shuffled(rest, ctx.random)]) {
    for (const t of list) {
      if (out.length >= n) return out;
      const k = key(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

// ---------- the Green Car switch ----------

/** A Green Car raid's state carries this tag, so the switch knows which raid owns it. */
export interface GreenTagged {
  variant: 'katsuyo';
}

const isGreen = (s: unknown): boolean => typeof s === 'object' && s !== null && (s as Partial<GreenTagged>).variant === 'katsuyo';

/**
 * One mode id, two raids: `local` plays outside the Green Car exactly as it always has, and `green` plays when
 * the game starts in a Green Car room (ctx.greenCar, decided at game start and never changed mid-game). Every
 * later call goes to the raid that set the state up.
 */
export function greenCarSwitch<A, B extends GreenTagged, V extends { mode: ModeId }, W extends { mode: ModeId }>(local: Mode<A, V>, green: Mode<B, W>): Mode<A | B, V | W> {
  type S = A | B;
  const pick = (s: S): Mode<S, V | W> => (isGreen(s) ? green : local) as unknown as Mode<S, V | W>;
  return {
    info: local.info,
    setup: (ctx, opts) => (ctx.greenCar ? green.setup(ctx, opts) : local.setup(ctx, opts)),
    next: (s, from, ctx) => pick(s).next(s, from, ctx),
    enter: (s, phase, ctx) => pick(s).enter(s, phase, ctx),
    leave: (s, phase, ctx) => pick(s).leave?.(s, phase, ctx),
    duration: (s, phase, ctx) => pick(s).duration(s, phase, ctx),
    done: (s, phase, ctx) => pick(s).done?.(s, phase, ctx) ?? false,
    move: (s, phase, playerId, move, ctx) => pick(s).move(s, phase, playerId, move, ctx),
    release: (s, playerId, ctx) => pick(s).release?.(s, playerId, ctx),
    progress: (s) => pick(s).progress(s),
    view: (s, phase, viewer, ctx) => pick(s).view(s, phase, viewer, ctx),
    awards: (s, ctx) => pick(s).awards?.(s, ctx) ?? [],
    practice: (s, playerId) => pick(s).practice?.(s, playerId) ?? [],
  };
}
