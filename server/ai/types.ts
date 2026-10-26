// Shared types for the AI layer: the host's voice and the typed-answer judge.
// Names match the Phase 0 skeleton (shared/src/protocol.ts) and the content thread's host line bank.
// This package imports nothing from server/src or shared/src, so it can be wired in from either side.

export type HostId = 'pon' | 'chochin' | 'fude';
export type Level = 'kana' | 'n5' | 'n4';
export type ReactionTier = 'flop' | 'good' | 'ippon';

/** Every event a host speaks on. The bank has written lines for each; the LLM writes fresh ones for some. */
export const HOST_EVENTS = [
  'lobby_welcome',
  'mic_check_ok',
  'intro',
  'prompt_read',
  'answer_hurry',
  'reveal_react',
  'encore_invite',
  'natural_version',
  'kakegoe_call',
  'cushion_steal',
  'retry_clue',
  'miss_kind',
  'ghost',
  'recap_award',
  'play_again',
  'raid_wave_start',
  'raid_combo',
  'raid_boss',
  'train_departure',
  'train_stop',
  'train_last_stop_twist',
  'platform_dash',
] as const;
export type HostEvent = (typeof HOST_EVENTS)[number];

/** Japanese with its reading and subtitle. Same shape as the content thread's JpText. */
export interface JpText {
  /** Japanese as shown on the stage (kanji allowed). */
  text: string;
  /** Full kana reading of `text`. This is what gets voiced, so the TTS never guesses a kanji reading. */
  kana: string;
  /** English subtitle. */
  en: string;
}

/**
 * A written line from the bank (content/src/hosts/). Slots such as {name} appear verbatim in text, kana and en,
 * and are listed in `slots`. Ids are stable (e.g. 'pon.reveal_react.good.03'), so audio is cached by id.
 */
export interface BankLine {
  id: string;
  host: HostId;
  event: HostEvent;
  tier?: ReactionTier;
  jp: JpText;
  slots?: string[];
}

/** Same shape as server/src/clock.ts, so the skeleton's ManualClock can be passed straight in. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** Where a line or a verdict came from, for logging and the cost and latency metrics. */
export type Source = 'llm' | 'bank' | 'offline' | 'pack';

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
}

export const silentLogger: Logger = { info: () => {}, warn: () => {} };
