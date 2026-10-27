// Wires the Onsen suspects' LLM lead-ins (server/ai/suspect.ts) to rooms. After each commit it
// looks for a fresh answer in Murder at the Onsen, asks for a lead-in in the background, and
// hands it back to the mode as a { kind: 'suspect-line' } move on the asker's behalf. Nothing
// waits on it: the scripted answer is already in the state, the mode refuses a line that lands
// after the suspect's thinking beat, and the stage only shows the text once that beat is over.
//
// Only runs when an LLM is configured (main.ts).

import type { LlmBudget, SuspectVoice } from '../ai/index.js';
import { suspectLineRequests } from '../../shared/src/modes/onsenMurder/onsenMurder.js';
import type { Room } from './room.js';

export interface SuspectDirectorOptions {
  /** The room's per-game LLM budget (shared with the host voice). */
  budget?: (roomCode: string) => LlmBudget | undefined;
  /** At most this many lead-ins per game (default 16). */
  maxPerGame?: number;
  /** The room's clock, which the mode's deadlines use. */
  now?: () => number;
}

export function suspectDirector(voice: SuspectVoice, opts: SuspectDirectorOptions = {}) {
  const max = opts.maxPerGame ?? 16;
  const now = opts.now ?? Date.now;
  // Per game (the mode state object), so a new game starts afresh.
  const games = new WeakMap<object, { seen: Set<string>; calls: number }>();
  return (room: Room): void => {
    const state = room.state.modeState;
    if (room.state.mode !== 'onsen-murder' || !state || typeof state !== 'object') return;
    let g = games.get(state);
    if (!g) games.set(state, (g = { seen: new Set(), calls: 0 }));
    for (const req of suspectLineRequests(state)) {
      if (g.seen.has(req.key)) continue;
      g.seen.add(req.key);
      // Leave a little room for the move to land before the beat ends.
      const timeoutMs = req.lockAt - now() - 150;
      if (g.calls >= max || timeoutMs < 200) continue;
      g.calls++;
      void voice
        .lead({ caseTitle: req.caseTitle, suspect: req.suspect, question: req.question, answer: req.answer, audience: room.state.audience }, timeoutMs, opts.budget?.(room.code))
        .then((lead) => {
          if (lead && !room.closed) room.inject(req.playerId, { kind: 'suspect-line', key: req.key, lead });
        })
        .catch(() => {});
    }
  };
}
