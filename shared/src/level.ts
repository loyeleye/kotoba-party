// Level helpers. N3 (the Limited Express Line) sits above N4: until a game has its own N3 script, an N3
// player gets the N4 one, so every check for "an N4 player" means N4 or N3.
import type { Level } from '../../content/src/types.js';

export const LEVEL_RANK: Readonly<Record<Level, number>> = { kana: 0, n5: 1, n4: 2, n3: 3 };

/** An N4 or N3 player: the N4 hard roles, decks and hints are theirs. */
export const n4Up = (level: Level | undefined | null): boolean => level === 'n4' || level === 'n3';
