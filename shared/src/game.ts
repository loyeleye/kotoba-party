// The room state machine. Pure game rules: no sockets, no timers, no clocks.
// The server owns one GameState per room and feeds it actions one at a time (ADR 0001),
// passing the current time in. The room runs the shared loop (lobby → game → recap) and
// hands everything inside the game to the chosen mode (shared/src/modes).

import { allN4Up, greenCarFor } from './greenCar.js';
import type { Level } from '../../content/src/types.js';
import { MAX_NAME_LENGTH, MAX_PLAYERS, SURPRISE_REVEAL_MS, SURPRISE_SPIN_MS } from './constants.js';
import type { Award, ContentLibrary, HostCue, Mode, ModeContext, ModePlayer, PhraseEntry, RecapTeam, ModeInfo } from './modes/mode.js';
import { EXPERIMENTS } from './modes/experiments.js';
import { MODES, noFit, speakersIn, surprisePool } from './modes/registry.js';
import type { GameResult } from './progress.js';
import type { Audience, Command, CommandError, HostSay, JoinError, ModeId, Phase, Viewer, WaitAnswer } from './protocol.js';
import { isAudience, LEVELS, MODE_IDS, SURPRISE, WAIT_ANSWERS } from './protocol.js';
import { awardKana, hasKanji, isUtterance, matchesAccepted, utteranceReading, type Utterance } from './japanese/kana.js';
import { isRomaji, romajiToHiragana } from './japanese/toKana.js';
import { n4Up } from './level.js';

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  level: Level;
  connected: boolean;
  score: number;
  /** Party points across the night: earned by where they finished each game (see PARTY_POINTS). */
  total: number;
  mic: 'ok' | 'quiet' | null;
  /** Sound off: this phone plays no sound, and shows what it would have said as text instead. */
  soundOff?: boolean;
  /** The game this player wished for in the lobby (the learning path's "♡ Wish for it"). Cleared when a game starts. */
  wish?: ModeId;
  /** Mic lines the host has already said for this player, so spamming the mic switch gets each one once. */
  micCued?: { ok?: boolean; quiet?: boolean };
}

export interface GameState {
  code: string;
  phase: Phase;
  phaseSeq: number;
  deadline: number | null;
  players: PlayerState[];
  vipId: string | null;
  /** The mode being played (or last played, in the lobby and recap). */
  mode: ModeId | null;
  modeState: unknown;
  packId: string | null;
  host: HostSay | null;
  /** The VIP's Calm motion switch. Kept across games. */
  calmMotion: boolean;
  /** Host cues raised by the last action; the server drains them after each dispatch. */
  cues: HostCue[];
  phrasebook: Record<string, PhraseEntry[]>;
  recap: { standings: { playerId: string; name: string; score: number; earned: number; total: number }[]; awards: Award[]; coop?: boolean; teams?: RecapTeam[]; mixed?: MixedRoomCheck } | null;
  /** When the current phase began (server clock), and how long each of this game's phases ran so far. */
  phaseAt?: number;
  phaseLog?: { phase: Phase; ms: number }[];
  /** Watching stage screens may run the game too (start, skip, play again). */
  remoteControl: boolean;
  /** The host's Audience setting: kids, family (default) or cheeky. Kept across games. */
  audience: Audience;
  /**
   * The Green Car switch (shared/src/greenCar.ts), main stage only. null until the room is first all N4+,
   * when it turns on by itself; after that whatever the stage last set. Kept across games.
   */
  greenCar?: boolean | null;
  /** This game (or the last one, in the lobby and recap) rides in the Green Car. Fixed at game start. */
  greenCarOn?: boolean;
  /** Scores and phrasebooks as they were just before this game started, so ending it early can put them back. */
  beforeGame: { scores: Record<string, number>; phrasebook: Record<string, PhraseEntry[]> } | null;
  /** This game came from Surprise Me!: the games it rolled between, so the screens can show the roll. */
  surprise: ModeId[] | null;
  /** The room's phrasebook from every game finished tonight, for the stage's Phrasebook (newest first). */
  tonight: TonightPhrase[];
  /** How many recaps tonight qualified for the mixed-room waiting check (asked or not). Kept across games; a new room starts at 0. */
  mixedChecks?: number;
}

/**
 * Mixed rooms (docs/n4-hard-roles.md): the playtest check that N4 roles don't make anyone else wait. How long
 * each phase ran, and the one-tap "Did anything feel like waiting?" asked of each player below N4 on the recap.
 */
export interface MixedRoomCheck {
  phases: { phase: Phase; ms: number }[];
  ask: string[];
  answers: Record<string, WaitAnswer>;
  /** Everyone's level, so the log can say whose answer is whose level (no names). */
  levels: Record<string, Level>;
  /** The game's hard-role offers, by answer. */
  offers: { accepted: number; declined: number; timeout: number };
  /** Which qualifying recap of the night this is (1 = the first). */
  nth: number;
}

/**
 * With `waitCheckFirstTwo` on, the qualifying recaps of a night that ask the waiting check (1 = the first): the 1st
 * and the 3rd, so the answers aren't all from the night's opening games. Others still log, with nobody asked.
 */
export const WAIT_CHECK_RECAPS: readonly number[] = [1, 3];

/**
 * The waiting check, asked only after a game in a mixed room that offered a hard role. With the
 * `waitCheckFirstTwo` experiment on (the name is kept), only the 1st and 3rd such recaps of a night ask it; the
 * others still log their phases, with nobody asked (for Ladi to confirm).
 */
function mixedCheck(state: GameState, mode: Mode<unknown, { mode: ModeId }> | null): { mixed?: MixedRoomCheck } {
  if (!mode?.offers || !isMixedRoom(state.players.map((p) => p.level))) return {};
  const offers = { accepted: 0, declined: 0, timeout: 0 };
  for (const p of state.players) for (const o of mode.offers(state.modeState, p.id)) if (o.answer !== 'away') offers[o.answer] += 1;
  if (!offers.accepted && !offers.declined && !offers.timeout) return {};
  const nth = (state.mixedChecks ?? 0) + 1;
  state.mixedChecks = nth;
  const asking = !EXPERIMENTS.waitCheckFirstTwo || WAIT_CHECK_RECAPS.includes(nth);
  return {
    mixed: {
      phases: state.phaseLog ?? [],
      ask: asking ? state.players.filter((p) => !n4Up(p.level) && p.connected).map((p) => p.id) : [],
      answers: {},
      levels: Object.fromEntries(state.players.map((p) => [p.id, p.level])),
      offers,
      nth,
    },
  };
}

/** A mixed room: at least one N4 (or N3) player and at least one below N4. */
export function isMixedRoom(levels: readonly Level[]): boolean {
  return levels.some(n4Up) && levels.some((l) => !n4Up(l));
}

/** One phrase from tonight's games, with who said it and who missed it. */
export interface TonightPhrase {
  itemId: string;
  text: string;
  kana: string;
  en: string;
  mode: ModeId;
  /** Player names. */
  said: string[];
  missed: string[];
}

/** Tonight's phrasebook keeps this many phrases. */
export const MAX_TONIGHT = 300;

export interface GameContext {
  now: number;
  content: ContentLibrary;
  newId: () => string;
  random: () => number;
  /** Fixed phase lengths that override every mode's own (tests and bot runs). */
  durations?: Partial<Record<Phase, number>>;
}

export type GameAction =
  | { type: 'join'; playerId: string; name: string; level?: Level }
  | { type: 'release'; playerId: string }
  | { type: 'connection'; playerId: string; connected: boolean }
  | { type: 'command'; actor: Viewer; command: Command }
  | { type: 'timeout'; phaseSeq: number }
  /** A mode's timed event inside a phase (see `wakeAt`). */
  | { type: 'wake'; phaseSeq: number }
  | { type: 'host'; say: HostSay };

export type Outcome = { changed: boolean; error?: string };

const OK: Outcome = { changed: true };
const fail = (error: CommandError | JoinError | string): Outcome => ({ changed: false, error });

export function createGame(code: string): GameState {
  return {
    code,
    phase: 'lobby',
    phaseSeq: 0,
    deadline: null,
    players: [],
    vipId: null,
    mode: null,
    modeState: null,
    packId: null,
    host: null,
    calmMotion: false,
    cues: [],
    phrasebook: {},
    recap: null,
    remoteControl: false,
    audience: 'family',
    greenCar: null,
    greenCarOn: false,
    beforeGame: null,
    surprise: null,
    tonight: [],
    mixedChecks: 0,
  };
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);

/** Can a brand-new player take a seat right now? (Rejoining a held seat skips this.) */
export function canJoin(state: GameState, name: string): JoinError | null {
  if (state.phase !== 'lobby' && state.phase !== 'recap') return 'game-in-progress';
  if (state.players.length >= MAX_PLAYERS) return 'room-full';
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return 'name-taken';
  return null;
}

export function activeMode(state: GameState): Mode<unknown, { mode: ModeId }> | null {
  return state.mode ? (MODES[state.mode] as Mode<unknown, { mode: ModeId }>) : null;
}

export const inGame = (state: GameState): boolean => state.phase !== 'lobby' && state.phase !== 'recap';

/** The context a mode gets for one call. */
export function modeContext(state: GameState, ctx: GameContext): ModeContext {
  const asModePlayer = (p: PlayerState): ModePlayer => p;
  return {
    now: ctx.now,
    content: ctx.content,
    vipId: state.vipId,
    audience: state.audience,
    greenCar: state.greenCarOn === true,
    random: ctx.random,
    newId: ctx.newId,
    players: () => state.players.map(asModePlayer),
    player: (id) => state.players.find((p) => p.id === id),
    connected: () => state.players.filter((p) => p.connected),
    award(playerId, points) {
      const p = state.players.find((x) => x.id === playerId);
      if (p) p.score = Math.max(0, p.score + Math.round(points));
    },
    cue(cue) {
      state.cues.push(cue);
    },
    phrase(playerId, entry) {
      const list = (state.phrasebook[playerId] ??= []);
      const existing = list.findIndex((e) => e.itemId === entry.itemId);
      // Keep the most telling outcome: a miss stays a miss even if seen again later.
      if (existing >= 0) {
        const rank = { missed: 3, retry: 2, said: 1, seen: 0 } as const;
        const was = list[existing]!;
        // Said from memory once tonight stays from memory, even if read out again later.
        if (rank[entry.outcome] >= rank[was.outcome]) list[existing] = entry.outcome === 'said' && was.outcome === 'said' && was.recall !== 'read' ? { ...entry, recall: was.recall } : entry;
      } else list.push(entry);
    },
  };
}

/** Applies one action. Mutates `state` in place and reports whether anything changed. */
export function apply(state: GameState, action: GameAction, ctx: GameContext): Outcome {
  const outcome = applyOne(state, action, ctx);
  if (outcome.changed) settle(state, ctx);
  return outcome;
}

function applyOne(state: GameState, action: GameAction, ctx: GameContext): Outcome {
  switch (action.type) {
    case 'join': {
      const name = cleanName(action.name);
      if (!name) return fail('bad-name');
      const err = canJoin(state, name);
      if (err) return fail(err);
      const level = isLevel(action.level) ? action.level : 'n5';
      state.players.push({ id: action.playerId, name, seat: lowestFreeSeat(state), level, connected: false, score: 0, total: 0, mic: null });
      state.players.sort((a, b) => a.seat - b.seat);
      state.vipId ??= action.playerId;
      return OK;
    }
    case 'release': {
      const idx = state.players.findIndex((p) => p.id === action.playerId);
      if (idx < 0) return { changed: false };
      state.players.splice(idx, 1);
      if (state.vipId === action.playerId) state.vipId = state.players[0]?.id ?? null;
      if (inGame(state)) activeMode(state)?.release?.(state.modeState, action.playerId, modeContext(state, ctx));
      if (state.players.length === 0 && state.phase !== 'lobby') resetToLobby(state);
      return OK;
    }
    case 'connection': {
      const p = state.players.find((x) => x.id === action.playerId);
      if (!p || p.connected === action.connected) return { changed: false };
      p.connected = action.connected;
      return OK;
    }
    case 'timeout': {
      if (action.phaseSeq !== state.phaseSeq || state.deadline === null) return { changed: false };
      advance(state, ctx);
      return OK;
    }
    case 'wake': {
      const mode = activeMode(state);
      if (action.phaseSeq !== state.phaseSeq || !mode?.wake || !inGame(state)) return { changed: false };
      mode.wake(state.modeState, state.phase, modeContext(state, ctx));
      return OK;
    }
    case 'host': {
      if (action.say.phaseSeq !== state.phaseSeq) return { changed: false };
      state.host = action.say;
      return OK;
    }
    case 'command':
      return applyCommand(state, action.actor, action.command, ctx);
  }
}

function applyCommand(state: GameState, actor: Viewer, cmd: Command, ctx: GameContext): Outcome {
  const isStage = actor.kind === 'stage';
  const me = actor.kind === 'player' ? state.players.find((p) => p.id === actor.playerId) : undefined;
  if (!isStage && !me) return fail('not-allowed');
  const isVip = !!me && me.id === state.vipId;

  switch (cmd.type) {
    case 'start': {
      if (state.phase !== 'lobby') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      // Surprise Me!: roll one of the menu's games that fits the room, with its default length and any topic.
      const surprise = cmd.mode === SURPRISE ? surprisePool(state.players.length, speakersIn(state.players)).map((m) => m.id) : null;
      if (surprise && !surprise.length) return fail('not-enough-players');
      const id = surprise ? surprise[Math.floor(ctx.random() * surprise.length)]! : cmd.mode;
      if (!(MODE_IDS as readonly string[]).includes(id)) return fail('unknown-mode');
      const mode = MODES[id as ModeId];
      const why = noFit(mode.info, state.players.length, speakersIn(state.players));
      if (why) return fail(why);
      state.mode = id as ModeId;
      state.surprise = surprise;
      // Green Car: on by default the first time the room is all N4+; decided now for the whole game.
      if ((state.greenCar ?? null) === null && allN4Up(state.players)) state.greenCar = true;
      state.greenCarOn = greenCarFor(state.greenCar ?? null, state.players);
      state.packId = !surprise && typeof cmd.packId === 'string' ? cmd.packId : null;
      state.beforeGame = { scores: Object.fromEntries(state.players.map((p) => [p.id, p.score])), phrasebook: state.phrasebook };
      for (const p of state.players) {
        p.score = 0;
        delete p.wish;
      }
      state.phrasebook = {};
      state.recap = null;
      const rounds = !surprise && Number.isInteger(cmd.rounds) ? cmd.rounds : undefined;
      state.modeState = mode.setup(modeContext(state, ctx), {
        rounds: rounds !== undefined && rounds > 0 && rounds <= 20 ? rounds : mode.info.roundChoices[0],
        packId: state.packId ?? undefined,
        extra: !surprise && cmd.extra && typeof cmd.extra === 'object' ? cmd.extra : undefined,
      });
      const raised = state.cues.length;
      enter(state, 'intro', ctx);
      if (surprise) spinCues(state, mode.info, raised);
      return OK;
    }
    case 'play': {
      if (!me) return fail('not-allowed');
      const mode = activeMode(state);
      if (!mode || !inGame(state)) return fail('wrong-phase');
      const result = mode.move(state.modeState, state.phase, me.id, cmd.move, modeContext(state, ctx));
      return result.ok ? OK : fail(result.error);
    }
    case 'setLevel': {
      if (!me) return fail('not-allowed');
      if (!isLevel(cmd.level)) return fail('bad-level');
      if (inGame(state)) return fail('wrong-phase');
      if (me.level === cmd.level) return { changed: false };
      me.level = cmd.level;
      return OK;
    }
    case 'micCheck': {
      if (!me) return fail('not-allowed');
      const host = activeMode(state)?.info.host ?? 'pon';
      // null turns the mic back on (in the lobby the check shows again). Only the "I can't talk right now"
      // tap is the quiet path: a miss, said or typed, leaves the mic on to try again, so typing never locks
      // it out. The phone's header mic switch sends null or the tap at any time, mid-game too.
      const game = inGame(state);
      if (cmd.utterance === null) {
        if (me.mic === null) return { changed: false };
        me.mic = null;
        return OK;
      }
      if (!isUtterance(cmd.utterance)) return fail('bad-command');
      const quiet = cmd.utterance.via === 'tap';
      if (game && !quiet) return fail('wrong-phase');
      if (game) {
        // Mid-game the host doesn't stop the round to comment.
        if (me.mic === 'quiet') return { changed: false };
        me.mic = 'quiet';
        return OK;
      }
      if (!quiet && !saidKonnichiwa(cmd.utterance)) return fail('not-konnichiwa');
      me.mic = quiet ? 'quiet' : 'ok';
      // The host says each mic line once per player: flipping the switch on and off doesn't repeat it.
      const cued = (me.micCued ??= {});
      if (!cued[me.mic]) {
        cued[me.mic] = true;
        state.cues.push({ host, event: quiet ? 'mic_check_quiet' : 'mic_check_ok', slots: { name: me.name } });
      }
      return OK;
    }
    case 'setSound': {
      // The phone's 🎧 switch, in the lobby or mid-game: its own speaker only (the TV keeps playing).
      if (!me) return fail('not-allowed');
      if (typeof cmd.on !== 'boolean') return fail('bad-command');
      if (!me.soundOff === cmd.on) return { changed: false };
      if (cmd.on) delete me.soundOff;
      else me.soundOff = true;
      return OK;
    }
    case 'waitCheck': {
      const mixed = state.recap?.mixed;
      if (!me || state.phase !== 'recap' || !mixed?.ask.includes(me.id)) return fail('wrong-phase');
      if (!WAIT_ANSWERS.includes(cmd.answer)) return fail('bad-command');
      if (mixed.answers[me.id] === cmd.answer) return { changed: false };
      mixed.answers[me.id] = cmd.answer;
      return OK;
    }
    case 'wish': {
      if (!me) return fail('not-allowed');
      if (state.phase !== 'lobby') return fail('wrong-phase');
      const want = cmd.mode === null ? undefined : (MODE_IDS as readonly string[]).includes(cmd.mode) && cmd.mode !== 'debug' ? cmd.mode : null;
      if (want === null) return fail('unknown-mode');
      if (me.wish === want) return { changed: false };
      if (want) me.wish = want;
      else delete me.wish;
      return OK;
    }
    case 'skip': {
      if (!isVip && !isStage) return fail('not-vip');
      if (cmd.phaseSeq !== state.phaseSeq) return fail('stale-phase');
      if (state.deadline === null) return fail('wrong-phase');
      advance(state, ctx);
      return OK;
    }
    case 'setMotion': {
      if (!isVip && !isStage) return fail('not-vip');
      if (typeof cmd.calm !== 'boolean') return fail('bad-command');
      if (state.calmMotion === cmd.calm) return { changed: false };
      state.calmMotion = cmd.calm;
      return OK;
    }
    case 'passVip': {
      if (!isVip && !isStage) return fail('not-vip');
      if (typeof cmd.playerId !== 'string' || !state.players.some((p) => p.id === cmd.playerId)) return fail('bad-command');
      if (state.vipId === cmd.playerId) return { changed: false };
      state.vipId = cmd.playerId;
      return OK;
    }
    case 'playAgain': {
      if (state.phase !== 'recap') return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      resetToLobby(state);
      return OK;
    }
    case 'endGame': {
      // Back to the game picker mid-game (the wrong game was picked): same room, same players,
      // and everyone's score goes back to what it was when this game started.
      if (!inGame(state)) return fail('wrong-phase');
      if (!isVip && !isStage) return fail('not-vip');
      if (state.beforeGame) {
        for (const p of state.players) p.score = state.beforeGame.scores[p.id] ?? 0;
        state.phrasebook = state.beforeGame.phrasebook;
      }
      resetToLobby(state);
      return OK;
    }
    case 'settings': {
      if (!isStage || actor.watch) return fail('not-allowed');
      const { remoteControl, audience, greenCar } = cmd;
      if (
        (remoteControl === undefined && audience === undefined && greenCar === undefined) ||
        (remoteControl !== undefined && typeof remoteControl !== 'boolean') ||
        (audience !== undefined && !isAudience(audience)) ||
        (greenCar !== undefined && typeof greenCar !== 'boolean')
      )
        return fail('bad-command');
      if ((remoteControl ?? state.remoteControl) === state.remoteControl && (audience ?? state.audience) === state.audience && (greenCar ?? state.greenCar ?? null) === (state.greenCar ?? null)) return { changed: false };
      state.remoteControl = remoteControl ?? state.remoteControl;
      state.audience = audience ?? state.audience;
      if (greenCar !== undefined) state.greenCar = greenCar;
      return OK;
    }
    default:
      return fail('bad-command');
  }
}

/** Ends the current phase and moves to whatever the mode says comes next. */
function advance(state: GameState, ctx: GameContext): void {
  const mode = activeMode(state);
  if (!mode || !inGame(state)) return;
  const mctx = modeContext(state, ctx);
  mode.leave?.(state.modeState, state.phase, mctx);
  const next = mode.next(state.modeState, state.phase, mctx);
  if (next === 'recap' || next === 'lobby') finish(state, ctx);
  else enter(state, next, ctx);
}

/**
 * When the mode next needs a `wake` action inside the current phase (a customer arriving or giving
 * up), or null. The server asks after every change and sets a timer for it.
 */
export function wakeAt(state: GameState, ctx: GameContext): number | null {
  const mode = activeMode(state);
  if (!mode?.wakeAt || !inGame(state)) return null;
  return mode.wakeAt(state.modeState, state.phase, modeContext(state, ctx));
}

/**
 * The recorded clips the mode still plays (Dub Club), or null when no game that plays clips is on. The
 * server keeps clips in memory only while they are in this set.
 */
export function clipsInUse(state: GameState): Set<string> | null {
  const mode = activeMode(state);
  if (!mode?.clipsInUse || !inGame(state)) return null;
  return new Set(mode.clipsInUse(state.modeState, state.phase));
}

/** Ends phases early while the mode says everyone is in. */
function settle(state: GameState, ctx: GameContext): void {
  for (let guard = 0; guard < 32; guard++) {
    const mode = activeMode(state);
    if (!mode || !inGame(state) || !mode.done?.(state.modeState, state.phase, modeContext(state, ctx))) return;
    advance(state, ctx);
  }
}

/**
 * Surprise Me!: the wheel covers the stage for the first few seconds of the intro, so the intro runs that much
 * longer. Pon calls the spin, names the pick as the wheel stops, and the game's own intro lines (raised from
 * `from` on) wait until the wheel has gone.
 */
function spinCues(state: GameState, info: ModeInfo, from: number): void {
  if (state.deadline !== null) state.deadline += SURPRISE_REVEAL_MS;
  const intro = state.cues.slice(from).filter((c) => !c.ahead).at(-1);
  if (intro) intro.atMs = SURPRISE_REVEAL_MS;
  const game = { game: info.titleJa, game_kana: info.titleKana ?? info.titleJa, game_en: info.title };
  state.cues.push({ host: 'pon', event: 'surprise_pick', slots: game, atMs: SURPRISE_SPIN_MS + 100, waitMs: SURPRISE_SPIN_MS });
  state.cues.push({ host: 'pon', event: 'surprise_spin' });
}

function enter(state: GameState, phase: Phase, ctx: GameContext): void {
  const mode = activeMode(state)!;
  logPhase(state, ctx.now);
  state.phase = phase;
  state.phaseSeq += 1;
  state.host = null;
  const mctx = modeContext(state, ctx);
  mode.enter(state.modeState, phase, mctx);
  const ms = ctx.durations?.[phase] ?? mode.duration(state.modeState, phase, mctx);
  state.deadline = ctx.now + Math.max(0, ms);
}

/** Closes the phase that's ending in this game's phase log (a fresh log when the game is just starting). */
function logPhase(state: GameState, now: number): void {
  const playing = state.phase !== 'lobby' && state.phase !== 'recap';
  if (playing && state.phaseAt != null) (state.phaseLog ??= []).push({ phase: state.phase, ms: Math.max(0, now - state.phaseAt) });
  else state.phaseLog = [];
  state.phaseAt = now;
}

function finish(state: GameState, ctx: GameContext): void {
  const mode = activeMode(state);
  logPhase(state, ctx.now);
  state.phase = 'recap';
  state.phaseSeq += 1;
  state.deadline = null;
  state.host = null;
  const ranked = [...state.players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const coop = !!mode && (mode.isCoop?.(state.modeState) ?? !!mode.info.coop);
  state.recap = {
    standings: ranked.map((p) => {
      const earned = partyPoints(p.score, ranked.filter((o) => o.score > p.score).length + 1, coop);
      p.total += earned;
      return { playerId: p.id, name: p.name, score: p.score, earned, total: p.total };
    }),
    awards: mode?.awards?.(state.modeState, modeContext(state, ctx)) ?? [],
    ...(coop ? { coop: true } : {}),
    ...(mode?.recapTeams ? { teams: mode.recapTeams(state.modeState, modeContext(state, ctx)) } : {}),
    ...mixedCheck(state, mode),
  };
  if (mode) state.cues.push({ host: mode.info.host, event: 'recap_award', slots: awardSlots(state.recap.awards[0]) });
  if (state.mode) addTonight(state, state.mode);
}

/** Adds the finished game's phrasebooks to tonight's: one row per phrase, with who said and who missed it. */
function addTonight(state: GameState, mode: ModeId): void {
  const rows = new Map<string, TonightPhrase>();
  for (const p of state.players) {
    for (const e of state.phrasebook[p.id] ?? []) {
      const row = rows.get(e.itemId) ?? { itemId: e.itemId, text: e.text, kana: e.kana, en: e.en, mode, said: [], missed: [] };
      if (e.outcome === 'said' || e.outcome === 'retry') row.said.push(p.name);
      else if (e.outcome === 'missed') row.missed.push(p.name);
      rows.set(e.itemId, row);
    }
  }
  // A phrase met again tonight moves to the top with this game's names.
  const fresh = new Set(rows.keys());
  state.tonight = [...rows.values(), ...state.tonight.filter((t) => !fresh.has(t.itemId))].slice(0, MAX_TONIGHT);
}

/**
 * The first award, for the host to present: every recap_award line names {award} and {name}, so
 * a cue without them has no bank line to fall back on when the LLM is slow, and the host says nothing.
 */
function awardSlots(a: Award | undefined): Record<string, string> | undefined {
  if (!a) return undefined;
  const kana = awardKana(a.title);
  return { award: a.title, ...(hasKanji(kana) ? {} : { award_kana: kana }), award_en: a.en.replace(/\s*\(.*\)$/, ''), name: a.spoken ?? a.name, ...(a.spoken ? { name_en: a.name } : {}) };
}

/**
 * Each player's result from the game that just finished (in the recap), for the saved progress of
 * players who are signed in: score, place, awards and what the mode says they practised.
 */
export function gameResults(state: GameState, now: number): Map<string, GameResult> {
  const out = new Map<string, GameResult>();
  const mode = activeMode(state);
  if (state.phase !== 'recap' || !state.recap || !mode || !state.mode) return out;
  const { standings, awards } = state.recap;
  const coop = mode.isCoop?.(state.modeState) ?? !!mode.info.coop;
  for (const s of standings) {
    out.set(s.playerId, {
      mode: state.mode,
      at: now,
      score: s.score,
      // As the phone's recap counts it: ties share a place, and a 0 isn't one.
      place: s.score > 0 ? standings.filter((o) => o.score > s.score).length + 1 : 0,
      players: standings.length,
      coop,
      awards: awards.filter((a) => a.playerId === s.playerId).map((a) => ({ title: a.title, en: a.en })),
      cards: mode.practice?.(state.modeState, s.playerId) ?? [],
      phrases: state.phrasebook[s.playerId] ?? [],
      offers: mode.offers?.(state.modeState, s.playerId) ?? [],
    });
  }
  return out;
}

function resetToLobby(state: GameState): void {
  state.phase = 'lobby';
  state.phaseSeq += 1;
  state.deadline = null;
  state.modeState = null;
  state.host = null;
  state.recap = null;
  state.beforeGame = null;
  state.surprise = null;
}

/**
 * Every game scores on its own scale (hundreds in Kana Raid, a handful in Oogiri), so the night's
 * running total counts places, not points: 1st 5, 2nd 3, 3rd 2, anyone else who scored 1. Ties
 * share the place. A team game is won or lost together, so everyone gets the same.
 */
export const PARTY_POINTS = { places: [5, 3, 2], scored: 1, coop: 2 } as const;

export function partyPoints(score: number, place: number, coop: boolean): number {
  if (coop) return PARTY_POINTS.coop;
  if (score <= 0) return 0;
  return PARTY_POINTS.places[place - 1] ?? PARTY_POINTS.scored;
}

function lowestFreeSeat(state: GameState): number {
  for (let seat = 1; ; seat++) if (!state.players.some((p) => p.seat === seat)) return seat;
}

/**
 * The mic check passes on こんにちは however the recogniser spells it: the speech model sometimes writes what it
 * heard in romaji ("Konnichiwa", "konnichi wa"), and the single-n "konichiwa" is a common spelling of the same word.
 */
function saidKonnichiwa(u: Utterance): boolean {
  const latin = u.text.replace(/[.,!?。、！？]/g, '');
  const reading = isRomaji(latin) ? romajiToHiragana(latin) : utteranceReading(u);
  return matchesAccepted(reading, ['こんにちは', 'こんにちわ', 'こにちは', 'こにちわ']);
}
