// The contract between the room and a game mode.
//
// The room (shared/src/game.ts) owns everything every mode shares: seats, levels, VIP,
// scores, the phase clock and the lobby → game → recap loop. A mode owns what happens
// inside the game: which phase comes next, what each phase shows, which moves players can
// make, and how points are earned. Modes are pure: no timers, no I/O, time comes in `ctx`.

import type {
  BossWord,
  CharStrokes,
  HostAward,
  HostId,
  HostLine,
  Kana,
  KanaChapter,
  KanaStrokes,
  LastTrainMinigame,
  LastTrainScenario,
  Level,
  LookAlikeSet,
  MinimalPair,
  OnsenCase,
  OogiriPrompt,
  SetPhraseTile,
  TopicPack,
} from '../../../content/src/types.js';
import type { WriteKanji, WriteWord } from '../../../content/src/kanji/kanji.js';
import type { Audience, ModeId, Phase, Viewer } from '../protocol.js';

/** All the content a mode may draw on. Plain arrays, so tests can pass small fixtures. */
export interface ContentLibrary {
  packs: readonly TopicPack[];
  oogiriPrompts: readonly OogiriPrompt[];
  setPhraseTiles: readonly SetPhraseTile[];
  kana: readonly Kana[];
  kanaChapters: readonly KanaChapter[];
  /** Stroke references for the Raid's Ink Storm wave (basic kana only). */
  kanaStrokes: readonly KanaStrokes[];
  /** Shodō Taikai's kanji (N5 and N4) and two-kanji words, with KanjiVG stroke references. */
  writeKanji: readonly WriteKanji[];
  writeWords: readonly WriteWord[];
  kanjiStrokes: readonly CharStrokes[];
  lookAlikeSets: readonly LookAlikeSet[];
  minimalPairs: readonly MinimalPair[];
  bossWords: readonly BossWord[];
  lastTrainMinigames: readonly LastTrainMinigame[];
  lastTrainScenarios: readonly LastTrainScenario[];
  hostLines: readonly HostLine[];
  hostAwards: readonly HostAward[];
  /** Murder at the Onsen's hand-written cases. */
  onsenCases: readonly OnsenCase[];
  /** Phase 0 placeholder prompts, used by the debug mode. */
  debugPrompts: readonly { id: string; text: string; subtitle?: string }[];
}

export const EMPTY_CONTENT: ContentLibrary = {
  packs: [],
  oogiriPrompts: [],
  setPhraseTiles: [],
  kana: [],
  kanaChapters: [],
  kanaStrokes: [],
  writeKanji: [],
  writeWords: [],
  kanjiStrokes: [],
  lookAlikeSets: [],
  minimalPairs: [],
  bossWords: [],
  lastTrainMinigames: [],
  lastTrainScenarios: [],
  hostLines: [],
  hostAwards: [],
  onsenCases: [],
  debugPrompts: [],
};

/** A seated player as modes see them. */
export interface ModePlayer {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
  readonly level: Level;
  readonly connected: boolean;
  readonly score: number;
}

/** Options the VIP picks when starting a game. */
export interface StartOptions {
  /** Number of rounds, stops or waves, where the mode supports choosing. */
  rounds?: number;
  /** Topic pack for the night (food, family, travel …). */
  packId?: string;
  /** Mode-specific extras, validated by the mode. */
  extra?: Record<string, unknown>;
}

/** What a mode can see and do while handling a call. */
export interface ModeContext {
  readonly now: number;
  /** The room's VIP (for VIP-only moves such as hiding an answer). Optional so test contexts can leave it out. */
  readonly vipId?: string | null;
  /** The host's Audience setting (family when left out). */
  readonly audience?: Audience;
  readonly content: ContentLibrary;
  random(): number;
  newId(): string;
  /** Seated players, by seat. */
  players(): readonly ModePlayer[];
  player(id: string): ModePlayer | undefined;
  /** Seated players with an open connection. */
  connected(): readonly ModePlayer[];
  /** Adds (or with a negative number, removes) points. Scores never go below 0. */
  award(playerId: string, points: number): void;
  /** Ask the host to say something. The server turns the cue into a line (bank or LLM) and voice. */
  cue(cue: HostCue): void;
  /** Add a phrase to a player's phrasebook for the recap. */
  phrase(playerId: string, entry: PhraseEntry): void;
}

/** A request for the host to speak, decided by game rules; the words come from the host pipeline. */
export interface HostCue {
  host: HostId;
  event: HostLine['event'];
  tier?: HostLine['tier'];
  /** Template values, e.g. { name: 'Aki' }. */
  slots?: Record<string, string>;
  /** The round's prompt, for an LLM reaction. */
  prompt?: { text: string; kana: string; en: string };
  /** The answer being reacted to (untrusted player text; the host pipeline fences it). */
  answer?: string;
  /** The answer's English meaning, when known. */
  answerEn?: string;
  /** Free context for an LLM reaction. Never shown as is. */
  context?: string;
  /** The room's Audience setting. Modes leave it out: the server fills it in from the room before the host speaks. */
  audience?: Audience;
  /**
   * Not said now: a cue the rules expect to raise soon, sent early so the host pipeline can start writing the
   * line. A later cue with the same content uses it. The bank voice ignores these.
   */
  ahead?: boolean;
}

/** One phrasebook entry for the recap. */
export interface PhraseEntry {
  /** Stable id of the content item, so repeats merge. */
  itemId: string;
  text: string;
  kana: string;
  en: string;
  /** How it went: said from memory, needed a retry, or missed. */
  outcome: 'said' | 'retry' | 'missed' | 'seen';
}

export interface Award {
  playerId: string;
  name: string;
  /** Award title, e.g. Pon's 座布団王. */
  title: string;
  en: string;
}

export type MoveResult = { ok: true } | { ok: false; error: string };

export const MOVE_OK: MoveResult = { ok: true };
export const moveError = (error: string): MoveResult => ({ ok: false, error });

export interface ModeInfo {
  id: ModeId;
  title: string;
  /** Japanese title for the menu. */
  titleJa: string;
  blurb: string;
  host: HostId;
  minPlayers: number;
  maxPlayers: number;
  /** Rounds the VIP can choose between; the first is the default. Empty if fixed. */
  roundChoices: number[];
  /** True if the mode uses a topic pack. */
  usesPack: boolean;
  /** What the recap calls the phrasebook (e.g. Last Train's "travel survival kit"). */
  phrasebookTitle?: string;
  /** Stage header names for phases this mode uses differently (Concentration's encore is a steal). */
  phaseLabels?: Partial<Record<Phase, string>>;
  /** On/off options the VIP can tick before starting, sent as `extra[key] = true`. */
  extras?: { key: string; label: string }[];
}

/**
 * A game mode. `S` is its state, `V` the view it sends to each client.
 *
 * Flow: on start the room calls `setup`, then enters `intro`. Each time a phase ends (its
 * deadline passes, `done` says so, or the VIP skips) the room calls `leave` on the old phase,
 * asks `next` for the new one, calls `enter` on it, and sets the deadline from `duration`.
 * Returning 'recap' from `next` ends the game.
 */
export interface Mode<S = unknown, V extends { mode: ModeId } = { mode: ModeId }> {
  info: ModeInfo;
  setup(ctx: ModeContext, opts: StartOptions): S;
  next(s: S, from: Phase, ctx: ModeContext): Phase;
  enter(s: S, phase: Phase, ctx: ModeContext): void;
  leave?(s: S, phase: Phase, ctx: ModeContext): void;
  /** Phase length in ms. */
  duration(s: S, phase: Phase, ctx: ModeContext): number;
  /** True when the current phase can end early (everyone is in). */
  done?(s: S, phase: Phase, ctx: ModeContext): boolean;
  /** A player's move. `move` comes off the wire: validate everything. */
  move(s: S, phase: Phase, playerId: string, move: unknown, ctx: ModeContext): MoveResult;
  /** A player's seat was released mid-game. */
  release?(s: S, playerId: string, ctx: ModeContext): void;
  progress(s: S): { round: number; totalRounds: number };
  view(s: S, phase: Phase, viewer: Viewer, ctx: ModeContext): V;
  /** Awards for the recap. */
  awards?(s: S, ctx: ModeContext): Award[];
}

// ---- small helpers modes share ----

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return [...text].slice(0, max).join('');
}

export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items.length ? items[Math.floor(random() * items.length)] : undefined;
}
