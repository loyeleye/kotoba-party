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
 * Phases where players may be speaking into their phones, in every mode. The music goes "under":
 * low-passed, quieter and (for synth songs) without its lead, so it doesn't drown the room or
 * confuse speech recognition. Reveals are under too: they're where hosts and suspects talk.
 */
const TALKING: ReadonlySet<Phase> = new Set(['answer', 'reveal', 'encore', 'penalty', 'finale']);

/** Where a mode also asks players to speak, from its doc in docs/modes/. */
export const SPEAKING_PHASES: Partial<Record<ModeId, Phase[]>> = {
  // "Say it first": the first 5 s of a prompt are spoken only.
  oogiri: ['prompt'],
  omiai: ['prompt'],
  'onsen-murder': ['prompt'],
  // Peek (prompt) and result (score) are a few seconds each between spoken turns: stay under
  // rather than open and close the music every few seconds.
  concentration: ['prompt', 'score'],
  // "Say it together" and the golden word are spoken during score.
  oekaki: ['score'],
  'word-gauntlet': ['score'],
};

/**
 * Modes whose reveal gets the drum roll. Not where the reveal is a speaking window (Concentration's
 * "say it", Last Train's re-say) or comes round every few seconds (Onsen's answer turns, Shiritori votes).
 */
const REVEAL_ROLL: ReadonlySet<ModeId> = new Set(['oogiri', 'phrase-bingo', 'oekaki', 'tourist', 'omiai', 'kana-raid', 'debug']);

export const speaks = (mode: ModeId | null, phase: Phase): boolean => TALKING.has(phase) || (!!mode && !!SPEAKING_PHASES[mode]?.includes(phase));

export function cueFor(mode: ModeId | null, phase: Phase): Cue {
  if (phase === 'lobby') return { song: 'bouncing', mix: 'full' };
  // Curtain Call, then the recap tune.
  if (phase === 'recap') return { song: 'happy-dance', mix: 'full', leadIn: 'fanfare' };
  const theme = mode ? MODE_THEMES[mode] : 'bouncing';
  if (theme === null) return { song: null, mix: 'full' };
  const mix = speaks(mode, phase) ? 'under' : 'full';
  // A recorded theme plays on through scores and finales; restarting it every round would grate.
  let song: MusicId = theme;
  if (!isTrack(theme) && phase === 'score') song = 'score';
  if (!isTrack(theme) && phase === 'finale') song = 'finale';
  // The culprit banner in Onsen's finale gets the roll; it isn't a speaking moment.
  if (mode === 'onsen-murder' && phase === 'finale') return { song, mix, sting: 'reveal' };
  if (phase === 'reveal' && mode && REVEAL_ROLL.has(mode)) return { song, mix, sting: 'reveal' };
  // Encores are short and some modes slot them between scores: don't restart the music for one.
  if (phase === 'encore') return { song, mix, keep: true };
  return { song, mix };
}
