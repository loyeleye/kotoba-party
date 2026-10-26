/** How long a dropped player's seat is held before it is released (design doc: 90 s). */
export const SEAT_HOLD_MS = 90_000;

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 1;
export const MAX_NAME_LENGTH = 12;
export const MAX_ANSWER_LENGTH = 80;

export const DEFAULT_ROUNDS = 3;
export const MAX_ROUNDS = 20;

export const POINTS_PER_VOTE = 100;
/** IPPON needs every voter but the author on one answer, with at least this many voters. */
export const IPPON_MIN_VOTERS = 3;
export const IPPON_BONUS = 200;

/** Phase lengths in ms. null means the phase waits for the VIP. */
export interface PhaseDurations {
  intro: number;
  prompt: number;
  answer: number;
  reveal: number;
  encore: number;
  score: number;
}

export const DEFAULT_DURATIONS: PhaseDurations = {
  intro: 8_000,
  prompt: 4_000,
  answer: 60_000,
  reveal: 30_000,
  encore: 6_000,
  score: 6_000,
};
