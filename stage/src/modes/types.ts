import type { GameView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';

/** How one mode draws the main area of the stage. */
export interface StageMode<G extends GameView = GameView> {
  /** The main stage area for the current phase. */
  render(view: RoomView, game: G): HTMLElement;
  /** A small badge next to a player's name (answered, ghost, HP …). */
  badge?(game: G, playerId: string): string;
  /** Team games: which team a player is on (0 or 1), so their tile carries the team and sits with it. */
  team?(game: G, playerId: string): number | null;
  /** How long the host's new line should wait, in ms (a reveal still running would be spoiled). */
  hostHoldMs?(view: RoomView, game: G): number;
}
