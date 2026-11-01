// Dub Club (アフレコ部): the voice cast of a terrible late-night anime. Fude-kantoku shows a silent scene
// and a line; each phone secretly says HOW to act it (sadly, like a robot, with your mouth full…). Everyone
// rehearses the line plainly (the words are checked privately), then records it in character; the TV
// screens every dub with the character lip-syncing to the real voice, the room guesses how each was
// directed, and the card flips straight away. The most-loved dub of each scene goes into tonight's
// episode, played at the end with credits. See docs/modes/dub-club.md.
//
// Each of the three scenes: prompt (scene card, your line, pick one of two secret cards) → answer
// (rehearse plainly, then record the acted take) → reveal (the screening: one dub at a time, stepped
// by `wake`: name card, the clip, guessing, an optional replay, the card flips) → score (cast notes).
// After scene 3, `finale` plays the episode a step at a time: the title, three scenes, the end card,
// the credits.
//
// Clips: a phone uploads its acted take to the room (Room.keepClip, in memory only) and sends the id
// here, or keeps it on the phone (`local`) and plays it itself when its turn comes. `clipsInUse` says
// which clips are still needed; the server drops the rest at once.

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { soundMorae } from '../karaokeDuel/scoring.js';
import { splitMorae } from '../karaokeDuel/songs.js';
import { isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { directionOf, directionsFor, episodeOf, episodesFor, sceneAdlib, sceneLines, takeLimitMs, type AdLib, type Direction, type Episode, type Scene } from './scenes.js';

// ---- tuning ----

export const TOTAL_SCENES = 3;
/** To the actor, for each player who guessed their card. */
export const ACT_POINTS = 100;
/** To each guesser who got it right. */
export const GUESS_POINTS = 50;
/** Each player has one heart a scene. */
export const HEART_POINTS = 100;
/** The dub that goes into the episode. */
export const EPISODE_POINTS = 150;
/**
 * The words, from the plain rehearsal take (never the acted one: crying and singing would lose). Capped
 * low so careful reading never beats bold acting (the panel).
 */
export const WORD_POINTS = { full: 50, close: 30, tried: 20, unchecked: 30 } as const;
/** Similarity that counts as the words being right, by level: a step easier than Karaoke Duel's. */
export const WORDS_FULL_AT: Record<Level, number> = { kana: 0.7, n5: 0.8, n4: 0.85 };
export const CLOSE_AT = 0.5;
/** Rehearsal tries: the first, and one retry after the feedback. */
export const REHEARSALS = 2;
/** The final scene counts double. */
export const FINAL_MULTIPLIER = 2;
/** Cards on each dub's guess grid: its own and five others. */
export const GRID = 6;
export const MAX_TAKE_MS = 12_000;
export const MIN_TAKE_MS = 300;
/** An ad-lib take may run to 9 s (the N4 clip length), half as long again for a slow card. */
export const ADLIB_TAKE_MS = 9_000;
/** The ad-lib's plain read, as a similarity for the word points: casual and on the mission / one of them / neither. */
export const ADLIB_SIM = { both: 1, one: 0.6, neither: 0.2 } as const;

/** One dub in the screening, in steps. */
export const STEP_MS = { lead: 1_600, guess: 4_500, regroup: 3_000, reveal: 3_400, start: 4_000 } as const;
/** The clip plays with a little air after it. */
export const playMs = (durMs: number): number => durMs + 400;
/** Episode steps. */
export const EPISODE = { title: 4_500, lead: 1_800, tail: 1_600, tableRead: 3_500, end: 2_600, credits: 9_000 } as const;

export const DURATIONS = {
  intro: 15_000,
  prompt: 12_000,
  answer: 65_000,
  answerKana: 75_000,
  score: 10_000,
} as const;

// ---- state ----

export interface Rehearsal {
  tries: number;
  /** The best try so far: what Whisper wrote, and its reading. */
  heard: string | null;
  reading: string;
  similarity: number;
  /** Ad-lib only: what the lenient check found in the best try. */
  adlib?: AdlibCheck;
}

/** The ad-lib check: was it casual (and which frames), and did one of the mission's key words come through. */
export interface AdlibCheck {
  casual: boolean;
  key: boolean;
  frames: string[];
}

export interface Take {
  clipId: string | null;
  /** The clip stays on the actor's phone, which plays it itself. */
  local: boolean;
  durMs: number;
  /** What Whisper heard in the acted take: only for the spoiler rule. */
  heard: Utterance | null;
  /** The server had speech-to-text. */
  checked: boolean;
  /** The take said its own card out loud. */
  spoiler: boolean;
  at: number;
}

export interface Actor {
  playerId: string;
  level: Level;
  /** The two cards offered; the actor picks one. */
  offered: [string, string];
  direction: string;
  rehearsal: Rehearsal | null;
  take: Take | null;
  /** No mic: guesses only this scene. */
  passed: boolean;
  /** Voided by the VIP during the screening. */
  skipped: boolean;
  /** This dub's guess grid. */
  grid: string[];
  /**
   * The N4 ad-lib role (hard role, goal 4.8), when this actor was offered it: no script, a mission. Offered
   * until they say yes (or rehearse or send a take, which counts as yes) or decline it for the script.
   */
  adlib?: 'offered' | 'accepted' | 'declined';
}

export type ScreenStep = 'lead' | 'play' | 'guess' | 'replay' | 'regroup' | 'reveal';

export interface Screening {
  index: number;
  step: ScreenStep;
  at: number;
  replayed: boolean;
  /** Who asked to hear the dub on now again. */
  again: string[];
}

export interface Result {
  playerId: string;
  direction: string;
  guessedBy: string[];
  hearts: number;
  act: number;
  guess: number;
  heart: number;
  words: number;
  episode: number;
  total: number;
}

export interface SceneRound {
  index: number;
  sceneId: string;
  actors: Actor[];
  /** Screening order: actors with a take. */
  order: string[];
  screening: Screening | null;
  /** guesserId → actorId → card id. */
  guesses: Record<string, Record<string, string>>;
  /** guesserId → the actor they gave their heart to. */
  hearts: Record<string, string>;
  results: Result[] | null;
  /** The dub that goes into the episode. */
  best: string | null;
}

export interface PlayerStats {
  hearts: number;
  guessed: number;
  rightGuesses: number;
  words: number;
  rehearsed: number;
}

export interface DubState {
  round: number;
  totalRounds: number;
  episodeId: string;
  audience: Audience;
  rounds: SceneRound[];
  stats: Record<string, PlayerStats>;
  phaseAt: number;
  /** The episode in the finale: which step is on, and since when. */
  episode: { step: number; at: number } | null;
}

// ---- view ----

export interface DubCard {
  id: string;
  jp: JpText;
  emoji: string;
  romaji?: string;
  tip?: string;
  root?: JpText | null;
}

export interface DubNow {
  playerId: string;
  clipId: string | null;
  local: boolean;
  durMs: number;
  step: ScreenStep;
  at: number;
  /** When the clip started playing (play or replay), for the lip sync. */
  playAt: number | null;
  index: number;
  count: number;
  line: JpText;
  skipped: boolean;
  guessed: number;
  guessers: number;
  again: number;
  /** From the reveal: the card, and who got it. */
  card: DubCard | null;
  guessedBy: string[];
  spoiler: boolean;
  /** An ad-lib dub: `line` is only the model, so the TV shows it at the reveal, not over the voice. */
  adlib: boolean;
}

export interface EpisodeStep {
  kind: 'title' | 'scene' | 'end' | 'credits';
  at: number;
  ms: number;
  scene?: { index: number; bg: string; char: string; who: JpText; line: JpText; playerId: string | null; clipId: string | null; local: boolean; durMs: number; card: DubCard | null; adlib: boolean };
}

export interface DubView {
  mode: 'dub-club';
  round: number;
  totalRounds: number;
  phaseAt: number;
  episode: { id: string; title: JpText };
  scene: { id: string; bg: string; char: string; who: JpText; setup: string; line: JpText } | null;
  /** Who has rehearsed and sent a take this scene (the TV ticks them off), who plays from their phone, who passed. */
  cast: { playerId: string; rehearsed: boolean; sent: boolean; local: boolean; passed: boolean; adlib: boolean }[];
  now: DubSlot | null;
  /** Dubs already revealed this scene, in screening order. */
  done: { playerId: string; card: DubCard; guessed: number; skipped: boolean }[];
  results: (Result & { card: DubCard })[] | null;
  best: string | null;
  step: EpisodeStep | null;
  credits: { playerId: string; who: JpText; card: DubCard | null; scene: number }[];
  me: {
    level: Level;
    line: (JpText & { romaji?: string }) | null;
    /** The two cards to pick from, until the take is sent. */
    offered: DubCard[];
    direction: DubCard | null;
    limitMs: number;
    rehearsal: { tries: number; left: number; heard: string | null; similarity: number; marks: { m: string; ok: boolean }[] } | null;
    sent: boolean;
    passed: boolean;
    acting: boolean;
    /** The dub on now (screening): the grid to guess from, my guess, whether I can still guess. */
    grid: DubCard[];
    guess: string | null;
    canGuess: boolean;
    askedAgain: boolean;
    /** My heart this scene, and the dubs I may give it to. */
    heart: string | null;
    heartable: string[];
    /** My own dub is on: this phone plays it if it kept the clip. */
    myTurn: boolean;
    /**
     * The ad-lib role, while it's mine (offered or accepted): the mission instead of a script (`line` is
     * null), the check of my plain read, and the model line once my take is sent.
     */
    adlib: { state: 'offered' | 'accepted'; mission: string; emoji: string; check: AdlibCheck | null; model: JpText | null } | null;
    /** Cast notes: how my scene went, privately. */
    notes: { words: number; similarity: number | null; checked: boolean; spoiler: boolean; total: number; guessedBy: number; hearts: number; best: boolean } | null;
  } | null;
}

export type DubSlot = DubNow;

export type DubMove =
  | { kind: 'pick'; direction: string }
  | { kind: 'rehearse'; utterance: Utterance }
  | { kind: 'take'; clipId: string | null; local: boolean; durMs: number; heard: Utterance | null; checked: boolean }
  | { kind: 'pass' }
  | { kind: 'adlib'; accept: boolean }
  | { kind: 'guess'; actorId: string; direction: string }
  | { kind: 'again'; actorId: string }
  | { kind: 'heart'; actorId: string | null }
  | { kind: 'skip'; actorId: string };

// ---- helpers ----

const blankStats = (): PlayerStats => ({ hearts: 0, guessed: 0, rightGuesses: 0, words: 0, rehearsed: 0 });
const stats = (s: DubState, id: string) => (s.stats[id] ??= blankStats());
export const episodeOfState = (s: DubState): Episode => episodeOf(s.episodeId) ?? episodesFor('family')[0]!;
export const sceneOf = (s: DubState, r: SceneRound): Scene => episodeOfState(s).scenes[r.index - 1]!;
export const lineOf = (s: DubState, r: SceneRound, level: Level): JpText => sceneLines(sceneOf(s, r), s.audience)[level];
export const adlibOf = (s: DubState, r: SceneRound): AdLib => sceneAdlib(sceneOf(s, r), s.audience);
/** Is this actor playing the ad-lib (offered and not declined)? */
export const isAdlib = (a: Actor | undefined | null): boolean => a?.adlib === 'offered' || a?.adlib === 'accepted';
/** An actor's line: the script at their level, or the ad-lib's model line. */
const lineFor = (s: DubState, r: SceneRound, a: Actor): JpText => (isAdlib(a) ? adlibOf(s, r).model : lineOf(s, r, a.level));
const current = (s: DubState): SceneRound | null => s.rounds[s.round - 1] ?? null;
const actorOf = (r: SceneRound, id: string) => r.actors.find((a) => a.playerId === id);

/**
 * Two cards for each player, from different sound families. Players get different cards where the deck
 * allows, so the screening isn't the same joke twice.
 */
export function dealCards(pool: readonly Direction[], n: number, random: () => number): [string, string][] {
  const out: [string, string][] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const fresh = shuffled(
      pool.filter((d) => !used.has(d.id)),
      random,
    );
    const from = fresh.length >= 2 ? fresh : shuffled(pool, random);
    const first = from[0]!;
    const second = from.find((d) => d.family !== first.family) ?? from[1] ?? first;
    used.add(first.id);
    used.add(second.id);
    out.push([first.id, second.id]);
  }
  return out;
}

/** A dub's guess grid: its own card and others from other sound families, so it can't be solved by elimination. */
export function gridFor(own: string, pool: readonly Direction[], random: () => number): string[] {
  const mine = directionOf(own);
  const families = new Set([mine?.family]);
  const out = [own];
  for (const d of shuffled(pool, random)) {
    if (out.length >= GRID) break;
    if (families.has(d.family)) continue;
    families.add(d.family);
    out.push(d.id);
  }
  for (const d of shuffled(pool, random)) {
    if (out.length >= GRID) break;
    if (!out.includes(d.id)) out.push(d.id);
  }
  return shuffled(out, random);
}

/**
 * How much of the line the plain read got, 0–1, mora by mora. Extra sounds are free (a にゃ, a laugh, a
 * もぐもぐ): only script morae that were changed or dropped count against it.
 */
export function wordsSimilarity(expectedKana: string, heardKana: string): number {
  return wordMarks(expectedKana, heardKana).similarity;
}

/** The line's morae, each marked heard or not, and the similarity: for the phone's private feedback. */
export function wordMarks(expectedKana: string, heardKana: string): { marks: { m: string; ok: boolean }[]; similarity: number } {
  const want = soundMorae(expectedKana);
  const got = soundMorae(heardKana);
  const shown = splitMorae(normalizeReading(expectedKana));
  if (!want.length) return { marks: [], similarity: 0 };
  // d[i][j]: cost of matching want[0..i) against got[0..j); inserting heard morae costs nothing.
  const d: number[][] = Array.from({ length: want.length + 1 }, () => new Array<number>(got.length + 1).fill(0));
  for (let i = 1; i <= want.length; i++) d[i]![0] = i;
  for (let i = 1; i <= want.length; i++)
    for (let j = 1; j <= got.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]!, d[i - 1]![j - 1]! + (want[i - 1] === got[j - 1] ? 0 : 1));
  const ok = new Array<boolean>(want.length).fill(false);
  let i = want.length;
  let j = got.length;
  while (i > 0) {
    if (j > 0 && want[i - 1] === got[j - 1] && d[i]![j] === d[i - 1]![j - 1]) {
      ok[i - 1] = true;
      i--;
      j--;
    } else if (j > 0 && d[i]![j] === d[i]![j - 1]) j--;
    else if (j > 0 && d[i]![j] === d[i - 1]![j - 1]! + 1) {
      i--;
      j--;
    } else i--;
  }
  const cost = got.length ? d[want.length]![got.length]! : want.length;
  // The shown morae can differ in count from the sound morae (ー folds into the vowel): mark by position.
  const marks = shown.map((m, k) => ({ m, ok: ok[Math.min(ok.length - 1, Math.round((k * ok.length) / Math.max(1, shown.length)))] ?? false }));
  return { marks, similarity: Math.max(0, 1 - cost / want.length) };
}

/** Did the acted take say its own card (「ロボットみたいに いいます！」)? Only the card's phrase, never words already in the line. */
export function saidDirection(heard: Utterance | null, d: Direction, lineKana: string): boolean {
  if (!heard) return false;
  const said = soundKey(normalizeReading(`${utteranceReading(heard)}`));
  const line = soundKey(normalizeReading(lineKana));
  return d.spoil.some((k) => {
    const key = soundKey(normalizeReading(k));
    return key.length >= 3 && said.includes(key) && !line.includes(key);
  });
}

// Casual speech (goal 4.8), checked leniently on the reading: any one sign counts. A clause that ends in
// です/ます (even with よ/ね) is polite, not casual.
const CONTRACTIONS = /(ちゃった|じゃった|ちゃう|じゃう|ちゃって|てる|でる|てた|てない|とく|といた|といて|どく|じゃん|でしょ)/;
const N_DA = /(んだ|なんだ)/;
const CASUAL_END = /(よ|ね|の|かな|だ|ぞ|ぜ|わ|さ|っけ|じゃん|でしょ)$/;
const POLITE_END = /(です|ます|ました|ません|でした|ましょう)(よ|ね|よね|か)?$/;

/**
 * The ad-lib's check: lenient on purpose (there is no script to match). Casual if a clause ends in a
 * casual particle or the copula (よ, ね, の？, だ…), or a contraction or 〜んだ turns up anywhere; on the
 * mission if one of its key words came through.
 */
export function adlibCheck(heard: Utterance | string, adlib: Pick<AdLib, 'keys'>): AdlibCheck {
  const raw = typeof heard === 'string' ? heard : (heard.reading ?? heard.text);
  const clauses = raw
    .normalize('NFKC')
    .split(/[\s、。,.!?！？…「」]+/)
    .map((c) => normalizeReading(c))
    .filter(Boolean);
  const all = normalizeReading(raw);
  const frames: string[] = [];
  if (clauses.some((c) => CASUAL_END.test(c) && !POLITE_END.test(c))) frames.push('plain');
  if (N_DA.test(all)) frames.push('n-da');
  if (CONTRACTIONS.test(all)) frames.push('teru');
  const said = soundKey(all);
  const key = adlib.keys.some((k) => said.includes(soundKey(k)));
  return { casual: frames.length > 0, key, frames };
}

/** The ad-lib check as a similarity, so the word points work the same as a scripted read. */
export const adlibSimilarity = (c: AdlibCheck): number => (c.casual && c.key ? ADLIB_SIM.both : c.casual || c.key ? ADLIB_SIM.one : ADLIB_SIM.neither);

/** Points for the words, from the plain rehearsal. */
export function wordPoints(a: Actor): number {
  if (a.rehearsal) {
    const sim = a.rehearsal.similarity;
    if (sim >= WORDS_FULL_AT[a.level]) return WORD_POINTS.full;
    if (sim >= CLOSE_AT) return WORD_POINTS.close;
    return WORD_POINTS.tried;
  }
  // No speech-to-text tonight: nobody could rehearse, so every take gets the unchecked share.
  return a.take && !a.take.checked ? WORD_POINTS.unchecked : 0;
}

/** How long a take may record: the line's limit, or the ad-lib's (no script to time it by). */
function limitFor(kana: string, slow: boolean, adlib: boolean): number {
  return adlib ? Math.min(MAX_TAKE_MS, Math.round(ADLIB_TAKE_MS * (slow ? 1.5 : 1))) : takeLimitMs(kana, slow);
}

/** The ad-lib offers so far and how many were taken (the step's gate: N4 players accept 60% or more). */
export function adlibTally(s: DubState): { offered: number; accepted: number } {
  const all = s.rounds.flatMap((r) => r.actors.filter((a) => a.adlib));
  return { offered: all.length, accepted: all.filter((a) => a.adlib === 'accepted').length };
}

function startScene(s: DubState, ctx: ModeContext): void {
  s.round += 1;
  const scene = episodeOfState(s).scenes[s.round - 1]!;
  const players = ctx.players();
  const dealt = dealCards(directionsFor(s.audience), players.length, () => ctx.random());
  const actors: Actor[] = players.map((p, i) => {
    const offered = dealt[i]!;
    return { playerId: p.id, level: p.level, offered, direction: offered[0], rehearsal: null, take: null, passed: false, skipped: false, grid: [] };
  });
  // The ad-lib hard role: offered to one N4 player a scene, in turn. No N4 player, no change.
  const n4 = actors.filter((a) => a.level === 'n4');
  const pick = n4[(s.round - 1) % Math.max(1, n4.length)];
  if (pick) pick.adlib = 'offered';
  s.rounds.push({ index: s.round, sceneId: scene.id, actors, order: [], screening: null, guesses: {}, hearts: {}, results: null, best: null });
}

/** The actor whose dub is on, or null before the first and after the last. */
export function onNow(r: SceneRound): Actor | null {
  if (!r.screening) return null;
  const id = r.order[r.screening.index];
  return id ? (actorOf(r, id) ?? null) : null;
}

/** How long a screening step lasts. */
export function stepMs(step: ScreenStep, a: Actor | null): number {
  const dur = a?.take?.durMs ?? 0;
  switch (step) {
    case 'lead':
      return STEP_MS.lead;
    case 'play':
    case 'replay':
      return playMs(dur);
    case 'guess':
      return STEP_MS.guess;
    case 'regroup':
      return STEP_MS.regroup;
    case 'reveal':
      return STEP_MS.reveal;
  }
}

/** Players who may guess the dub on now: everyone connected but its actor. */
const guessersFor = (r: SceneRound, a: Actor, ctx: ModeContext) => ctx.connected().filter((p) => p.id !== a.playerId && (actorOf(r, p.id) || true));
const guessedRight = (r: SceneRound, a: Actor) => Object.entries(r.guesses).filter(([g, m]) => g !== a.playerId && m[a.playerId] === a.direction).map(([g]) => g);

/** Moves the screening on one step (from `wake`, or at once for a skipped dub). */
function advance(s: DubState, r: SceneRound, ctx: ModeContext): void {
  const sc = r.screening!;
  const a = onNow(r);
  if (!a) return;
  const next = (step: ScreenStep) => {
    r.screening = { ...sc, step, at: ctx.now };
  };
  if (a.skipped) {
    r.screening = { index: sc.index + 1, step: 'lead', at: ctx.now, replayed: false, again: [] };
    return;
  }
  switch (sc.step) {
    case 'lead':
      return next('play');
    case 'play':
      return next('guess');
    case 'replay':
      return next('regroup');
    case 'guess':
    case 'regroup': {
      next('reveal');
      const right = guessedRight(r, a).length;
      const guessers = guessersFor(r, a, ctx).length;
      if (a.take?.spoiler) ctx.cue({ host: 'fude', event: 'dub_spoiler' });
      else if (guessers > 0 && right >= guessers) ctx.cue({ host: 'fude', event: 'dub_reveal_all', slots: { name: ctx.player(a.playerId)?.name ?? '' } });
      else if (right === 0) ctx.cue({ host: 'fude', event: 'dub_reveal_none', slots: { card: directionOf(a.direction)?.jp.kana ?? '' } });
      else ctx.cue({ host: 'fude', event: 'dub_reveal_some', slots: { name: ctx.player(a.playerId)?.name ?? '' } });
      return;
    }
    case 'reveal':
      r.screening = { index: sc.index + 1, step: 'lead', at: ctx.now, replayed: false, again: [] };
      return;
  }
}

/** Works out the scene's results and pays them. */
function settle(s: DubState, r: SceneRound, ctx: ModeContext): void {
  if (r.results) return;
  const scene = sceneOf(s, r);
  const mult = r.index === s.totalRounds ? FINAL_MULTIPLIER : 1;
  // The episode keeps the most-loved dub, then the most guessed, then the first sent.
  const heartsFor = (id: string) => Object.entries(r.hearts).filter(([g, to]) => g !== id && to === id).length;
  const candidates = r.actors.filter((a) => a.take && !a.skipped && ctx.player(a.playerId));
  candidates.sort((x, y) => heartsFor(y.playerId) - heartsFor(x.playerId) || guessedRight(r, y).length - guessedRight(r, x).length || x.take!.at - y.take!.at);
  r.best = candidates[0]?.playerId ?? null;

  const results: Result[] = [];
  for (const a of r.actors) {
    if (!ctx.player(a.playerId)) continue;
    const playable = !!a.take && !a.skipped;
    const guessedBy = playable ? guessedRight(r, a) : [];
    const hearts = playable ? heartsFor(a.playerId) : 0;
    const act = a.take?.spoiler ? 0 : guessedBy.length * ACT_POINTS;
    const right = Object.entries(r.guesses[a.playerId] ?? {}).filter(([actor, dir]) => {
      const other = actorOf(r, actor);
      return other && other.take && !other.skipped && other.direction === dir;
    }).length;
    const guess = right * GUESS_POINTS;
    const heart = hearts * HEART_POINTS;
    const words = wordPoints(a);
    const episode = r.best === a.playerId ? EPISODE_POINTS : 0;
    const total = (act + guess + heart + words + episode) * mult;
    results.push({ playerId: a.playerId, direction: a.direction, guessedBy, hearts, act: act * mult, guess: guess * mult, heart: heart * mult, words: words * mult, episode: episode * mult, total });
    if (total) ctx.award(a.playerId, total);
    const st = stats(s, a.playerId);
    st.hearts += hearts;
    st.guessed += guessedBy.length;
    st.rightGuesses += right;
    if (a.rehearsal) {
      st.rehearsed += 1;
      st.words += a.rehearsal.similarity;
    }
    phrases(s, r, a, scene, ctx);
  }
  r.results = results;
  ctx.cue({ host: 'fude', event: 'dub_notes', slots: { name: r.best ? (ctx.player(r.best)?.name ?? '') : '' } });
  // Every card guessed right goes in the guesser's phrasebook: the manner forms are the grammar here.
  for (const p of ctx.players()) {
    for (const [actor, dir] of Object.entries(r.guesses[p.id] ?? {})) {
      const a = actorOf(r, actor);
      const d = directionOf(dir);
      if (a && d && a.direction === dir) ctx.phrase(p.id, { itemId: `dub:card:${d.id}`, text: d.jp.text, kana: d.jp.kana, en: `${d.jp.en}${d.root ? ` (${d.root.text} → ${d.jp.text})` : ''}`, outcome: 'seen' });
    }
  }
}

function phrases(s: DubState, r: SceneRound, a: Actor, scene: Scene, ctx: ModeContext): void {
  const line = lineFor(s, r, a);
  const itemId = isAdlib(a) ? `dub:${scene.id}:adlib` : `dub:${scene.id}:${a.level}`;
  const reh = a.rehearsal;
  const outcome = !reh ? 'seen' : reh.similarity >= WORDS_FULL_AT[a.level] ? 'said' : reh.similarity >= CLOSE_AT ? 'retry' : 'missed';
  ctx.phrase(a.playerId, { itemId, text: line.text, kana: line.kana, en: line.en, outcome });
}

/** The episode's steps: the title, each scene, the end card, the credits. */
export function episodeSteps(s: DubState): { kind: EpisodeStep['kind']; round?: SceneRound; ms: number }[] {
  const out: { kind: EpisodeStep['kind']; round?: SceneRound; ms: number }[] = [{ kind: 'title', ms: EPISODE.title }];
  for (const r of s.rounds) {
    const best = r.best ? actorOf(r, r.best) : undefined;
    const ms = best?.take ? EPISODE.lead + best.take.durMs + EPISODE.tail : EPISODE.tableRead;
    out.push({ kind: 'scene', round: r, ms });
  }
  out.push({ kind: 'end', ms: EPISODE.end }, { kind: 'credits', ms: EPISODE.credits });
  return out;
}

export const cardView = (d: Direction, level: Level, extra = false): DubCard => ({
  id: d.id,
  jp: d.jp,
  emoji: d.emoji,
  ...(level === 'kana' ? { romaji: toRomaji(d.jp.kana) } : {}),
  ...(extra ? { tip: d.tip, root: d.root } : {}),
});

function parseHeard(raw: unknown): Utterance | null {
  if (raw === null || raw === undefined || !isUtterance(raw) || raw.via !== 'speech') return null;
  return { via: 'speech', text: raw.text.slice(0, 160), ...(raw.reading !== undefined ? { reading: String(raw.reading).slice(0, 320) } : {}) };
}

// ---- the mode ----

export const dubClubMode: Mode<DubState, DubView> = {
  info: {
    id: 'dub-club',
    title: 'Dub Club',
    titleJa: 'アフレコ部',
    titleKana: 'アフレコぶ',
    blurb: 'Voice-act an anime line the way your secret card says. The room guesses how each dub was directed.',
    host: 'fude',
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your script',
    phaseLabels: { prompt: 'Scene', answer: 'Record', reveal: 'Screening', score: 'Cast notes', finale: 'Tonight’s episode' },
  },

  setup(ctx) {
    const audience = ctx.audience ?? 'family';
    const pool = episodesFor(audience);
    const episode = pool[Math.floor(ctx.random() * pool.length)] ?? pool[0]!;
    const all: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) all[p.id] = blankStats();
    return { round: 0, totalRounds: TOTAL_SCENES, episodeId: episode.id, audience, rounds: [], stats: all, phaseAt: ctx.now, episode: null };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return current(s)?.order.length ? 'reveal' : 'score';
      case 'reveal':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'finale';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'fude', event: 'dub_intro', slots: { title: episodeOfState(s).title.text, title_en: episodeOfState(s).title.en } });
        break;
      case 'prompt': {
        startScene(s, ctx);
        const r = current(s)!;
        const line = lineOf(s, r, 'n5');
        // The table read: Fude reads the N5 line plainly, the model for the words (not the feeling).
        ctx.cue({ host: 'fude', event: 'dub_scene', slots: { line: line.kana, line_en: line.en }, prompt: { text: line.text, kana: line.kana, en: line.en } });
        break;
      }
      case 'answer':
        ctx.cue({ host: 'fude', event: 'dub_record' });
        break;
      case 'reveal': {
        const r = current(s)!;
        const pool = directionsFor(s.audience);
        for (const a of r.actors) a.grid = gridFor(a.direction, pool, () => ctx.random());
        // The first dub waits for Fude's opening line, so he never talks over a voice.
        r.screening = { index: 0, step: 'lead', at: ctx.now + STEP_MS.start, replayed: false, again: [] };
        ctx.cue({ host: 'fude', event: 'dub_screening' });
        break;
      }
      case 'score':
        settle(s, current(s)!, ctx);
        break;
      case 'finale':
        s.episode = { step: 0, at: ctx.now + 1_000 };
        ctx.cue({ host: 'fude', event: 'dub_episode', slots: { title: episodeOfState(s).title.text, title_en: episodeOfState(s).title.en } });
        break;
    }
  },

  leave(s, phase, ctx) {
    const r = current(s);
    if (phase === 'answer' && r) {
      r.order = shuffled(
        r.actors.filter((a) => a.take).map((a) => a.playerId),
        () => ctx.random(),
      );
    }
    if (phase === 'reveal' && r) r.screening = null;
  },

  duration(s, phase) {
    const r = current(s);
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.prompt;
      case 'answer':
        return r?.actors.some((a) => a.level === 'kana') ? DURATIONS.answerKana : DURATIONS.answer;
      case 'reveal': {
        // The screening ends itself (`done`) after the last dub; this is only a backstop.
        const per = (a: Actor | undefined) => STEP_MS.lead + 2 * playMs(a?.take?.durMs ?? MAX_TAKE_MS) + STEP_MS.guess + STEP_MS.regroup + STEP_MS.reveal;
        return STEP_MS.start + (r ? r.order.reduce((t, id) => t + per(actorOf(r, id)), 0) : 0) + 5_000;
      }
      case 'score':
        return DURATIONS.score;
      case 'finale':
        return 1_000 + episodeSteps(s).reduce((t, x) => t + x.ms, 0) + 2_000;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const r = current(s);
    if (!r) return false;
    if (phase === 'answer') {
      const here = ctx.connected();
      return here.length > 0 && here.every((p) => {
        const a = actorOf(r, p.id);
        return !a || !!a.take || a.passed;
      });
    }
    if (phase === 'reveal') return !!r.screening && r.screening.index >= r.order.length;
    if (phase === 'finale') return !!s.episode && s.episode.step >= episodeSteps(s).length;
    return false;
  },

  wakeAt(s, phase) {
    const r = current(s);
    if (phase === 'reveal' && r?.screening) {
      const a = onNow(r);
      if (!a) return null;
      return a.skipped ? r.screening.at : r.screening.at + stepMs(r.screening.step, a);
    }
    if (phase === 'finale' && s.episode) {
      const step = episodeSteps(s)[s.episode.step];
      return step ? s.episode.at + step.ms : null;
    }
    return null;
  },

  wake(s, phase, ctx) {
    const r = current(s);
    if (phase === 'reveal' && r?.screening) advance(s, r, ctx);
    else if (phase === 'finale' && s.episode) {
      s.episode = { step: s.episode.step + 1, at: ctx.now };
      const kind = episodeSteps(s)[s.episode.step]?.kind;
      if (kind === 'credits') ctx.cue({ host: 'fude', event: 'dub_sequel', slots: { title: episodeOfState(s).title.text, title_en: episodeOfState(s).title.en } });
    }
  },

  clipsInUse(s, phase) {
    const out: string[] = [];
    s.rounds.forEach((r, i) => {
      const live = i === s.round - 1 && (phase === 'prompt' || phase === 'answer' || phase === 'reveal');
      for (const a of r.actors) if (a.take?.clipId && (live || r.best === a.playerId)) out.push(a.take.clipId);
    });
    return out;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    const r = current(s);
    if (!r) return moveError('wrong-phase');
    const me = actorOf(r, playerId);
    switch (raw.kind) {
      case 'pick': {
        if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
        if (!me) return moveError('not-playing');
        if (me.take) return moveError('already-sent');
        if (typeof raw.direction !== 'string' || !me.offered.includes(raw.direction)) return moveError('bad-move');
        me.direction = raw.direction;
        return MOVE_OK;
      }
      case 'rehearse': {
        if (phase !== 'answer' && phase !== 'prompt') return moveError('wrong-phase');
        if (!me) return moveError('not-playing');
        if (!isUtterance(raw.utterance) || raw.utterance.via !== 'speech') return moveError('bad-utterance');
        const reh = (me.rehearsal ??= { tries: 0, heard: null, reading: '', similarity: 0 });
        if (reh.tries >= REHEARSALS) return moveError('no-more-tries');
        reh.tries += 1;
        const reading = utteranceReading(raw.utterance).slice(0, 320);
        // An ad-lib has no script to match: the lenient casual check stands in for the similarity.
        if (me.adlib === 'offered') me.adlib = 'accepted';
        const check = isAdlib(me) ? adlibCheck(raw.utterance, adlibOf(s, r)) : undefined;
        const sim = check ? adlibSimilarity(check) : wordsSimilarity(lineOf(s, r, me.level).kana, reading);
        // The best try counts.
        if (reh.heard === null || sim > reh.similarity) {
          reh.similarity = sim;
          reh.heard = String(raw.utterance.text).slice(0, 160);
          reh.reading = reading;
          if (check) reh.adlib = check;
        }
        return MOVE_OK;
      }
      case 'take': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!me) return moveError('not-playing');
        const clipId = typeof raw.clipId === 'string' && raw.clipId.length <= 64 ? raw.clipId : null;
        const local = raw.local === true;
        if (!clipId && !local) return moveError('no-clip');
        const dur = typeof raw.durMs === 'number' && Number.isFinite(raw.durMs) ? raw.durMs : MAX_TAKE_MS;
        const heard = parseHeard(raw.heard);
        if (me.adlib === 'offered') me.adlib = 'accepted';
        const line = lineFor(s, r, me);
        const d = directionOf(me.direction)!;
        const limit = limitFor(line.kana, !!d.slow, isAdlib(me));
        me.take = {
          clipId: local ? null : clipId,
          local,
          durMs: Math.max(MIN_TAKE_MS, Math.min(limit + 500, MAX_TAKE_MS, Math.round(dur))),
          heard,
          checked: raw.checked === true,
          spoiler: saidDirection(heard, d, line.kana),
          at: ctx.now,
        };
        me.passed = false;
        return MOVE_OK;
      }
      case 'adlib': {
        // Yes to the ad-lib, or "not this time": the scripted N4 line instead. Until the take is sent.
        if (phase !== 'prompt' && phase !== 'answer') return moveError('wrong-phase');
        if (!me) return moveError('not-playing');
        if (!me.adlib) return moveError('not-offered');
        if (me.take) return moveError('already-sent');
        const next = raw.accept === true ? 'accepted' : 'declined';
        // A plain read checked the other way doesn't carry over.
        if (isAdlib(me) !== (next === 'accepted')) me.rehearsal = null;
        me.adlib = next;
        return MOVE_OK;
      }
      case 'pass': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!me) return moveError('not-playing');
        if (!me.take) me.passed = true;
        return MOVE_OK;
      }
      case 'guess': {
        const sc = r.screening;
        if (phase !== 'reveal' || !sc) return moveError('wrong-phase');
        const a = onNow(r);
        if (!a || raw.actorId !== a.playerId) return moveError('not-now');
        if (sc.step !== 'play' && sc.step !== 'guess' && sc.step !== 'replay' && sc.step !== 'regroup') return moveError('wrong-phase');
        if (a.playerId === playerId) return moveError('own-dub');
        if (typeof raw.direction !== 'string' || !a.grid.includes(raw.direction)) return moveError('bad-move');
        (r.guesses[playerId] ??= {})[a.playerId] = raw.direction;
        return MOVE_OK;
      }
      case 'again': {
        const sc = r.screening;
        if (phase !== 'reveal' || !sc) return moveError('wrong-phase');
        const a = onNow(r);
        if (!a || raw.actorId !== a.playerId) return moveError('not-now');
        if (sc.step !== 'guess' || sc.replayed) return MOVE_OK;
        if (a.playerId === playerId) return moveError('own-dub');
        if (!sc.again.includes(playerId)) sc.again.push(playerId);
        // Half the room asks: もう いっかい！ The dub plays once more.
        if (sc.again.length >= Math.ceil(guessersFor(r, a, ctx).length / 2)) r.screening = { ...sc, step: 'replay', at: ctx.now, replayed: true };
        return MOVE_OK;
      }
      case 'heart': {
        if (phase !== 'reveal' || !r.screening) return moveError('wrong-phase');
        if (raw.actorId === null) {
          delete r.hearts[playerId];
          return MOVE_OK;
        }
        const actorId = typeof raw.actorId === 'string' ? raw.actorId : '';
        if (!heartable(r).includes(actorId)) return moveError('not-yet');
        if (actorId === playerId) return moveError('own-dub');
        r.hearts[playerId] = actorId;
        return MOVE_OK;
      }
      case 'skip': {
        if (phase !== 'reveal' || !r.screening) return moveError('wrong-phase');
        if (ctx.vipId !== playerId) return moveError('not-vip');
        const a = typeof raw.actorId === 'string' ? actorOf(r, raw.actorId) : undefined;
        if (!a || !a.take) return moveError('unknown-dub');
        a.skipped = true;
        for (const m of Object.values(r.guesses)) delete m[a.playerId];
        for (const [g, to] of Object.entries(r.hearts)) if (to === a.playerId) delete r.hearts[g];
        // Skipping the dub that's on ends it now (wakeAt answers at once).
        if (onNow(r) === a) {
          r.screening = { ...r.screening, at: ctx.now };
          ctx.cue({ host: 'fude', event: 'dub_skip' });
        }
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const r = current(s);
    if (!r || r.results) return;
    const a = actorOf(r, playerId);
    if (!a) return;
    if (r.screening) {
      // Keep the screening on the same dub: a dub still to come is dropped; the one on now is skipped.
      const pos = r.order.indexOf(playerId);
      if (pos > r.screening.index) r.order.splice(pos, 1);
      else if (pos === r.screening.index) a.skipped = true;
      if (pos >= 0 && pos < r.screening.index) a.skipped = true;
    } else {
      r.actors = r.actors.filter((x) => x !== a);
      r.order = r.order.filter((id) => id !== playerId);
    }
    delete r.guesses[playerId];
    delete r.hearts[playerId];
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase: Phase, viewer: Viewer, ctx) {
    const episode = episodeOfState(s);
    const r = current(s);
    const scene = r ? sceneOf(s, r) : null;
    const player = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const level = player?.level ?? 'n5';
    const a = r && phase === 'reveal' ? onNow(r) : null;
    const sc = r?.screening ?? null;
    const showResults = !!r?.results && phase === 'score';

    let now: DubNow | null = null;
    if (a && sc && r) {
      const revealed = sc.step === 'reveal';
      const d = directionOf(a.direction)!;
      const playing = sc.step === 'play' || sc.step === 'replay';
      now = {
        playerId: a.playerId,
        clipId: a.take?.clipId ?? null,
        local: !!a.take?.local,
        durMs: a.take?.durMs ?? 0,
        step: sc.step,
        at: sc.at,
        playAt: playing ? sc.at : null,
        index: sc.index,
        count: r.order.length,
        line: lineFor(s, r, a),
        skipped: a.skipped,
        guessed: Object.entries(r.guesses).filter(([g, m]) => g !== a.playerId && m[a.playerId]).length,
        guessers: guessersFor(r, a, ctx).length,
        again: sc.again.length,
        card: revealed ? cardView(d, level) : null,
        guessedBy: revealed ? guessedRight(r, a) : [],
        spoiler: revealed && !!a.take?.spoiler,
        adlib: isAdlib(a),
      };
    }
    const done =
      r && sc && phase === 'reveal'
        ? r.order.slice(0, sc.index).map((id) => {
            const x = actorOf(r, id)!;
            return { playerId: id, card: cardView(directionOf(x.direction)!, level), guessed: guessedRight(r, x).length, skipped: x.skipped };
          })
        : [];

    let step: EpisodeStep | null = null;
    if (phase === 'finale' && s.episode) {
      const cur = episodeSteps(s)[s.episode.step];
      if (cur) {
        step = { kind: cur.kind, at: s.episode.at, ms: cur.ms };
        if (cur.round) {
          const sc2 = sceneOf(s, cur.round);
          const best = cur.round.best ? actorOf(cur.round, cur.round.best) : undefined;
          const d = best ? directionOf(best.direction) : undefined;
          step.scene = {
            index: cur.round.index,
            bg: sc2.bg,
            char: sc2.char,
            who: sc2.who,
            line: best ? lineFor(s, cur.round, best) : lineOf(s, cur.round, 'n5'),
            playerId: best?.playerId ?? null,
            clipId: best?.take?.clipId ?? null,
            local: !!best?.take?.local,
            durMs: best?.take?.durMs ?? 0,
            card: d ? cardView(d, level) : null,
            adlib: isAdlib(best),
          };
        }
      }
    }

    const credits = s.rounds
      .filter((x) => x.best)
      .map((x) => {
        const b = actorOf(x, x.best!);
        const d = b ? directionOf(b.direction) : undefined;
        return { playerId: x.best!, who: sceneOf(s, x).who, card: d ? cardView(d, level) : null, scene: x.index };
      });

    let me: DubView['me'] = null;
    if (player && r && scene) {
      const mine = actorOf(r, player.id);
      const adlib = isAdlib(mine) ? adlibOf(s, r) : null;
      const line = mine ? lineFor(s, r, mine) : lineOf(s, r, level);
      const res = r.results?.find((x) => x.playerId === player.id);
      const d = mine ? directionOf(mine.direction) : undefined;
      const reh = mine?.rehearsal;
      const canGuess = !!a && a.playerId !== player.id && !!sc && ['play', 'guess', 'replay', 'regroup'].includes(sc.step);
      me = {
        level,
        // An ad-lib has no script showing: the mission stands in for it.
        line: mine && !adlib ? { ...line, ...(level === 'kana' ? { romaji: toRomaji(line.kana) } : {}) } : null,
        offered: mine && !mine.take && (phase === 'prompt' || phase === 'answer') ? mine.offered.map((id) => cardView(directionOf(id)!, level, true)) : [],
        direction: d ? cardView(d, level, true) : null,
        limitMs: mine ? limitFor(line.kana, !!d?.slow, !!adlib) : 0,
        rehearsal: reh ? { tries: reh.tries, left: REHEARSALS - reh.tries, heard: reh.heard, similarity: reh.similarity, marks: adlib ? [] : wordMarks(line.kana, reh.reading).marks } : null,
        sent: !!mine?.take,
        passed: !!mine?.passed,
        acting: !!mine,
        grid: a && a.playerId !== player.id ? a.grid.map((id) => cardView(directionOf(id)!, level)) : [],
        guess: a ? (r.guesses[player.id]?.[a.playerId] ?? null) : null,
        canGuess,
        askedAgain: !!sc && sc.again.includes(player.id),
        heart: r.hearts[player.id] ?? null,
        heartable: phase === 'reveal' ? heartable(r).filter((id) => id !== player.id) : [],
        myTurn: (!!a && a.playerId === player.id) || (step?.kind === 'scene' && step.scene?.playerId === player.id),
        adlib:
          mine && adlib
            ? { state: mine.adlib as 'offered' | 'accepted', mission: adlib.mission, emoji: adlib.emoji, check: reh?.adlib ?? null, model: mine.take || phase === 'reveal' || phase === 'score' ? adlib.model : null }
            : null,
        notes:
          showResults && mine?.take && res
            ? { words: res.words, similarity: reh?.similarity ?? null, checked: mine.take.checked, spoiler: mine.take.spoiler, total: res.total, guessedBy: res.guessedBy.length, hearts: res.hearts, best: r.best === player.id }
            : null,
      };
    }

    return {
      mode: 'dub-club',
      round: s.round,
      totalRounds: s.totalRounds,
      phaseAt: s.phaseAt,
      episode: { id: episode.id, title: episode.title },
      scene: scene && r ? { id: scene.id, bg: scene.bg, char: scene.char, who: scene.who, setup: scene.setup, line: lineOf(s, r, 'n5') } : null,
      cast: r ? r.actors.map((x) => ({ playerId: x.playerId, rehearsed: !!x.rehearsal, sent: !!x.take, local: !!x.take?.local, passed: x.passed, adlib: isAdlib(x) })) : [],
      now,
      done,
      results: showResults && r?.results ? r.results.map((x) => ({ ...x, card: cardView(directionOf(x.direction)!, level, true) })) : null,
      best: showResults ? (r?.best ?? null) : null,
      step,
      credits: phase === 'finale' ? credits : [],
      me,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: PlayerStats) => number): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = 0;
      for (const p of players) {
        const v = f(stats(s, p.id));
        if (v > val) [top, val] = [p, v];
      }
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best((st) => st.hearts), 'しゅえんしょう', 'Best Actor: most hearts');
    add(best((st) => st.guessed), 'めいえんぎしょう', 'Clearest Acting: card read most often');
    add(best((st) => st.rightGuesses), 'ききじょうずしょう', 'Good Listener: most cards guessed');
    add(best((st) => (st.rehearsed ? st.words / st.rehearsed : 0)), 'かつぜつしょう', 'Crisp Diction: clearest plain reads');
    return out;
  },
};

/** Dubs a heart can go to: those already played this scene, and the one on now once it has played. */
function heartable(r: SceneRound): string[] {
  const sc = r.screening;
  if (!sc) return [];
  const upTo = sc.step === 'lead' ? sc.index : sc.index + 1;
  return r.order.slice(0, upTo).filter((id) => !actorOf(r, id)?.skipped);
}
