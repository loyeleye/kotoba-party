// Which modes have their own Kids and Cheeky content. The hosts follow the Audience setting in every mode (their
// AI lines, their big-moment written lines and, in Kids rooms, a stricter filter on typed text); a mode listed
// here also swaps its own content. Every other mode plays its Family content. The stage's settings panel lists
// these, so add a mode here in the same PR that gives it Kids or Cheeky content.

import type { ModeId } from './protocol.js';

/** Mode → its name and what changes with the setting, as the settings panel says it. */
export const AUDIENCE_CONTENT: Partial<Record<ModeId, { name: string; what: string }>> = {
  'karaoke-duel': { name: 'Karaoke Duel', what: 'song lyrics' },
  oogiri: { name: 'Oogiri Night', what: 'prompts' },
  'phrase-bingo': { name: 'Phrase Bingo', what: 'scenes' },
  'word-gauntlet': { name: 'Word Gauntlet', what: 'Fake Kanji words' },
  'last-train': { name: 'Last Train', what: 'the line' },
  'onsen-murder': { name: 'Murder at the Onsen', what: 'cases' },
  omiai: { name: 'Omiai Matchmaker', what: 'guests' },
  narabete: { name: 'Narabete!', what: 'themes' },
  hajimemashite: { name: 'Nice to Meet You!', what: 'cards' },
  'bento-haus': { name: 'Bento Haus (Co-op and VS)', what: 'customers' },
  happyokai: { name: 'Happyōkai!', what: 'titles and slides' },
};

/** "Karaoke Duel (song lyrics), Oogiri Night (prompts)": for the settings panel. */
export function audienceContentList(): string {
  return Object.values(AUDIENCE_CONTENT)
    .map((m) => `${m.name} (${m.what})`)
    .join(', ');
}
