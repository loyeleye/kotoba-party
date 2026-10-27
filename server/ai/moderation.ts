// A minimal text filter for the host's LLM lines and for player text the host repeats. The design doc's full
// moderation layer (player text, VIP hide, family mode) is its own piece; this is the hook it plugs into, with a
// small built-in list so an LLM line never reaches the stage unchecked. A line that fails is replaced by a bank line.
// The lists live in shared/src/moderation.ts, so the modes can check typed text in Kids rooms with the same words.

import type { Audience } from '../../shared/src/protocol.js';
import { textAllowed } from '../../shared/src/moderation.js';

export type Moderator = (text: string) => boolean;

/** True when the text may be shown and voiced (the Family list). */
export const defaultModerator: Moderator = (text) => textAllowed(text, 'family');

/** The filter for a room's Audience: Kids is stricter; Family and Cheeky share the default list. */
export function moderatorFor(audience: Audience | undefined, base: Moderator = defaultModerator): Moderator {
  return audience === 'kids' ? (text) => base(text) && textAllowed(text, 'kids') : base;
}
