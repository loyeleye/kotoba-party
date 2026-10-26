// Which music plays when: a pure function of the mode and phase, so it can be tested.

import type { ModeId, Phase } from '../../../shared/src/protocol.js';
import type { Mix } from './engine.js';
import type { SongId } from './songs.js';

export interface Cue {
  /** The loop to play, or null for silence. */
  song: SongId | null;
  mix: Mix;
  /** A jingle that plays once before the loop starts. */
  leadIn?: SongId;
  /** A one-shot laid over the loop at the start of the phase. */
  sting?: SongId;
  /** Keep whatever loop is already playing (only the mix changes); `song` is for when none is. */
  keep?: boolean;
}

/** Each mode's theme for its rounds. */
export const MODE_THEMES: Record<ModeId, SongId | null> = {
  oogiri: 'festive',
  'phrase-bingo': 'festive',
  oekaki: 'festive',
  debug: 'festive',
  'word-gauntlet': 'quiz',
  concentration: 'quiz',
  tourist: 'stroll',
  'last-train': 'rush',
  'kana-raid': 'battle',
  'onsen-murder': 'mystery',
  omiai: 'gentle',
  // Karaoke Duel plays its own backing track (karaokeAudio.ts).
  'karaoke-duel': null,
};

/**
 * Phases where players may be speaking into their phones. The music goes "under": no lead,
 * low-passed and quieter, so it doesn't drown the room or confuse speech recognition.
 */
const TALKING: ReadonlySet<Phase> = new Set(['answer', 'encore', 'penalty', 'finale']);

export function cueFor(mode: ModeId | null, phase: Phase): Cue {
  if (phase === 'lobby') return { song: 'lobby', mix: 'full' };
  if (phase === 'recap') return { song: 'outro', mix: 'full', leadIn: 'fanfare' };
  const theme = mode ? MODE_THEMES[mode] : 'festive';
  if (theme === null) return { song: null, mix: 'full' };
  if (phase === 'score') return { song: 'score', mix: 'full' };
  if (phase === 'finale') return { song: 'finale', mix: 'under' };
  const mix = TALKING.has(phase) ? 'under' : 'full';
  if (phase === 'reveal') return { song: theme, mix: 'under', sting: 'reveal' };
  // Encores are short and some modes slot them between scores: don't restart the music for one.
  if (phase === 'encore') return { song: theme, mix: 'under', keep: true };
  return { song: theme, mix };
}
