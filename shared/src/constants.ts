/** How long a dropped player's seat is held before it is released (design doc: 90 s). */
export const SEAT_HOLD_MS = 90_000;
/** A room with no joins or commands for this long closes, even with screens still connected. */
export const ROOM_STALE_MS = 30 * 60_000;

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
