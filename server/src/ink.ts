// Wires the Ink Storm coach (server/ai/inkCoach.ts) to rooms. After each commit it looks for
// drawings the Raid has queued for a second look, asks the coach in the background, and hands
// the line back to the mode as an { kind: 'ink-tip' } move on the player's behalf. Nothing
// waits on it: the drawing has already been graded, and a slow or missing line changes nothing.
//
// Only runs when an LLM is configured (main.ts); without ANTHROPIC_API_KEY the game keeps the
// offline stroke check's tips.

import type { InkCoach } from '../ai/index.js';
import type { LlmBudget } from '../ai/llm.js';
import { inkCoachRequests } from '../../shared/src/modes/kanaRaid/kanaRaid.js';
import type { Room } from './room.js';

export interface InkCoachDirectorOptions {
  /** The room's per-game LLM budget (shared with the host voice). */
  budget?: (roomCode: string) => LlmBudget | undefined;
  /** At most this many looks per game (default 12). */
  maxPerGame?: number;
  /** Drawings older than this are not worth a tip any more (default 15 s). */
  maxAgeMs?: number;
  now?: () => number;
}

export function inkCoachDirector(coach: InkCoach, opts: InkCoachDirectorOptions = {}) {
  const max = opts.maxPerGame ?? 12;
  const maxAge = opts.maxAgeMs ?? 15_000;
  const now = opts.now ?? Date.now;
  // Per game (the mode state object), so a new game starts afresh.
  const games = new WeakMap<object, { seen: Set<string>; calls: number }>();
  return (room: Room): void => {
    const state = room.state.modeState;
    if (room.state.mode !== 'kana-raid' || !state || typeof state !== 'object') return;
    let g = games.get(state);
    if (!g) games.set(state, (g = { seen: new Set(), calls: 0 }));
    for (const req of inkCoachRequests(state)) {
      if (g.seen.has(req.key)) continue;
      g.seen.add(req.key);
      if (g.calls >= max || now() - req.at > maxAge) continue;
      g.calls++;
      void coach
        .look({ char: req.char, candidates: req.candidates, strokes: req.strokes, passed: req.passed }, opts.budget?.(room.code))
        .then((tip) => {
          if (tip && !room.closed) room.inject(req.playerId, { kind: 'ink-tip', key: req.key, tip });
        })
        .catch(() => {});
    }
  };
}
