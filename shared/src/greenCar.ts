// Green Car (グリーン車): the N4+ room mode (design: project files n3-coverage/green-car/design.md).
// When every seated player plays at N4 or N3 the room may ride in the Green Car: games drop their Kana/N5
// content and run about half N4 and half N3 lines, and the N4/N3 pieces that change a beginner's turn
// (the "move-outs") play only here. The switch is a room setting on the main stage, on by default the
// first time the room is all N4+. It's decided at game start and never changes mid-game.
import type { Level } from '../../content/src/types.js';
import { n4Up } from './level.js';

/** Every seated player is N4 or N3 (and there is at least one). */
export function allN4Up(players: readonly { level: Level }[]): boolean {
  return players.length > 0 && players.every((p) => n4Up(p.level));
}

/**
 * Whether the next game rides in the Green Car. `setting` is the room's switch: null until it was first
 * offered (then it defaults on), true or false once set. A Kana or N5 player aboard keeps it off.
 */
export function greenCarFor(setting: boolean | null, players: readonly { level: Level }[]): boolean {
  return allN4Up(players) && setting !== false;
}

/** The TV's toast when the switch is on but a local passenger has boarded. */
export const GREEN_CAR_OFF_TOAST = 'A local passenger boarded: back to the regular train';
