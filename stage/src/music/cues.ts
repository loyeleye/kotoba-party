// Which music plays when: a pure function of the mode and phase, so it can be tested.

import type { ModeId, Phase } from '../../../shared/src/protocol.js';
import type { Mix } from './engine.js';
import type { SongId } from './songs.js';
import { isTrack, type TrackId } from './tracks.js';

/** A synth song or a recorded track. */
export type MusicId = SongId | TrackId;

export interface Cue {
  /** The loop to play, or null for silence. */
  song: MusicId | null;
  mix: Mix;
  /** A jingle that plays once before the loop starts. */
  leadIn?: SongId;
  /** A one-shot laid over the loop at the start of the phase. */
  sting?: SongId;
  /** Keep whatever loop is already playing (only the mix changes); `song` is for when none is. */
  keep?: boolean;
}

/** Each mode's theme for its rounds. */
export const MODE_THEMES: Record<ModeId, MusicId | null> = {
  // The social games: recorded pop, funk and swing.
  oogiri: 'monkeys',
  'phrase-bingo': 'love',
  oekaki: 'heps',
  tourist: 'trip',
  omiai: 'carefree',
  debug: 'bouncing',
  // The quiz games and the mystery.
  'word-gauntlet': 'investigations',
  concentration: 'funkorama',
  'onsen-murder': 'sneaky',
  // Adventure: an anime battle theme for the Raid; the synth's train rush for Last Train.
  'kana-raid': 'raid',
  'last-train': 'rush',
  // Karaoke Duel plays its own backing track (karaokeAudio.ts).
  'karaoke-duel': null,
};

/**
 * Phases where players may be speaking into their phones. The music goes "under": no lead,
 * low-passed and quieter, so it doesn't drown the room or confuse speech recognition.
 */
const TALKING: ReadonlySet<Phase> = new Set(['answer', 'encore', 'penalty', 'finale']);

export function cueFor(mode: ModeId | null, phase: Phase): Cue {
  if (phase === 'lobby') return { song: 'bouncing', mix: 'full' };
  if (phase === 'recap') return { song: 'happy-dance', mix: 'full' };
  const theme = mode ? MODE_THEMES[mode] : 'bouncing';
  if (theme === null) return { song: null, mix: 'full' };
  // A recorded theme plays on through scores and finales; restarting it every round would grate.
  if (isTrack(theme)) {
    if (phase === 'score') return { song: theme, mix: 'full' };
    if (phase === 'finale') return { song: theme, mix: 'under' };
  }
  if (phase === 'score') return { song: 'score', mix: 'full' };
  if (phase === 'finale') return { song: 'finale', mix: 'under' };
  const mix = TALKING.has(phase) ? 'under' : 'full';
  if (phase === 'reveal') return { song: theme, mix: 'under', sting: 'reveal' };
  // Encores are short and some modes slot them between scores: don't restart the music for one.
  if (phase === 'encore') return { song: theme, mix: 'under', keep: true };
  return { song: theme, mix };
}
