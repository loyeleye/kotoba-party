import type { GameView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';

/** How one mode draws the main area of the stage. */
export interface StageMode<G extends GameView = GameView> {
  /** The main stage area for the current phase. */
  render(view: RoomView, game: G): HTMLElement;
  /** A small badge next to a player's name (answered, ghost, HP …): text, or an element for a pixel icon. */
  badge?(game: G, playerId: string): string | HTMLElement | null;
  /**
   * Hold the score ribbon's totals until this server time (ms), so a mode whose reveal lands the points later
   * than the score phase starts doesn't have the ribbon give the result away first. 0 or null: no hold.
   */
  holdScoresUntil?(view: RoomView, game: G): number | null;
  /** While the ribbon is held: the points this player gets at the hold's end, for a TV that joins mid-hold. */
  heldPoints?(game: G, playerId: string): number;
  /** Team games: which team a player is on (0 or 1), so their tile carries the team and sits with it. */
  team?(game: G, playerId: string): number | null;
  /**
   * Keep the host row up even while the host is quiet: `host` idles in it with no bubble, and `side`
   * (if any) sits at the row's right end. Null leaves the row to come and go with the host's lines.
   */
  hostRow?(view: RoomView, game: G): { host: string; side: HTMLElement | null } | null;
  /** How long the host's new line should wait, in ms (a reveal still running would be spoiled). */
  hostHoldMs?(view: RoomView, game: G): number;
}
