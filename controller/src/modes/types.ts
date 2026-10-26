import type { GameView } from '../../../shared/src/modes/views.js';
import type { PlayerView, RoomView } from '../../../shared/src/protocol.js';

export interface PhoneContext<G extends GameView = GameView> {
  view: RoomView;
  game: G;
  me: PlayerView;
  isVip: boolean;
  /** Sends a move to the mode. Errors other than 'wrong-phase' flash on screen. */
  send(move: unknown): Promise<boolean>;
  flash(text: string): void;
}

/** How one mode draws the phone. */
export interface PhoneMode<G extends GameView = GameView> {
  /**
   * The phone redraws only when this key changes, so typing is never wiped out by an
   * unrelated update. Include everything the screen shows.
   */
  key(view: RoomView, game: G, playerId: string): string;
  render(ctx: PhoneContext<G>): HTMLElement;
}
