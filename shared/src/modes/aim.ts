// Green Car, aim the deal (docs: project files n3-coverage/green-car/design.md, "Content rules"). When a game picks a
// cause, problem, prompt or card for a player in the Green Car, it prefers the one whose frames that player needs
// most: frames a path goal requires, said least tonight. The room knows tonight's earlier games (ctx.frameNeed,
// shared/src/greenCar.ts frameNeed); the game adds its own counts so far. Kept apart from greenCar.ts, which reads
// the path's goals, so a mode can import it without a cycle.
import type { ModeContext } from './mode.js';

/**
 * How much a player needs an item's frames: the room's figure for tonight's earlier games (ctx.frameNeed), scaled
 * down by this game's own says of those frames (`thisGame`, kept in the mode's state). Higher is more needed.
 * Without ctx.frameNeed (test contexts) every frame weighs 1.
 */
export function aimWeight(ctx: Pick<ModeContext, 'frameNeed'>, playerId: string, frames: readonly string[], thisGame: Readonly<Record<string, number>> = {}): number {
  const tonight = ctx.frameNeed ? ctx.frameNeed(playerId, frames) : frames.length;
  const now = frames.reduce((sum, f) => sum + (thisGame[f] ?? 0), 0);
  return tonight / (1 + now);
}

/** The item with the highest aimWeight (the first on a tie, so callers can pre-shuffle for variety). */
export function aimPick<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
  let best: T | undefined;
  let top = -Infinity;
  for (const it of items) {
    const w = weight(it);
    if (w > top) (best = it), (top = w);
  }
  return best;
}
