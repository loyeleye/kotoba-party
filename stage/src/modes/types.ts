import type { GameView } from '../../../shared/src/modes/views.js';
import type { RoomView } from '../../../shared/src/protocol.js';

/** How one mode draws the main area of the stage. */
export interface StageMode<G extends GameView = GameView> {
  /** The main stage area for the current phase. */
  render(view: RoomView, game: G): HTMLElement;
  /** A small badge next to a player's name (answered, ghost, HP …). */
  badge?(game: G, playerId: string): string;
}
