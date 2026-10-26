import type { ModeId } from '../protocol.js';
import { moveError, type Mode, type ModeInfo } from './mode.js';

/** A mode that only shows its intro and ends. Lets the menu list a mode before it is built. */
export function stubMode<V extends { mode: ModeId }>(id: V['mode'], info: Omit<ModeInfo, 'id'>): Mode<unknown, V> {
  return {
    info: { id, ...info },
    setup: () => ({}),
    next: () => 'recap',
    enter: () => {},
    duration: () => 5_000,
    move: () => moveError('not-built'),
    progress: () => ({ round: 0, totalRounds: 0 }),
    view: () => ({ mode: id }) as V,
  };
}
