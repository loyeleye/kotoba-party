// Which music plays when: a pure function of the mode and phase, so it can be tested.

import type { ModeId, Phase, RoomView } from '../../../shared/src/protocol.js';
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
  'phrase-bingo': 'carefree',
  oekaki: 'heps',
  tourist: 'trip',
  // Omiai's first date: Love Love Love (Ladi, 2026-10-27).
  omiai: 'love',
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
  // The calligraphy contest is quiet: the soft synth tune throughout (shodoCue).
  shodo: 'gentle',
};

/** Each mode's second theme: games alternate between the two, so a long night doesn't loop one tune. */
export const MODE_ALT_THEMES: Partial<Record<ModeId, MusicId>> = {
  oogiri: 'quirky-dog',
  'phrase-bingo': 'life-of-riley',
  oekaki: 'wallpaper',
  tourist: 'off-to-osaka',
  omiai: 'local-forecast',
  'word-gauntlet': 'cipher',
  concentration: 'kool-kats',
  'onsen-murder': 'ishikari-lore',
  'kana-raid': 'ouroboros',
};

/** The theme for the `game`th game of `mode` on this screen (0, 1, 2 …). */
export function themeFor(mode: ModeId, game = 0): MusicId | null {
  const alt = MODE_ALT_THEMES[mode];
  return alt && game % 2 === 1 ? alt : MODE_THEMES[mode];
}

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
  // Say each target before tracing it, then read the scroll together.
  shodo: ['prompt', 'score'],
};

/**
 * Modes whose reveal gets the drum roll. Not where the reveal is a speaking window (Concentration's
 * "say it", Last Train's re-say) or comes round every few seconds (Onsen's answer turns, Shiritori votes).
 */
const REVEAL_ROLL: ReadonlySet<ModeId> = new Set(['oogiri', 'phrase-bingo', 'oekaki', 'tourist', 'omiai', 'kana-raid', 'debug']);

export const speaks = (mode: ModeId | null, phase: Phase): boolean => TALKING.has(phase) || (!!mode && !!SPEAKING_PHASES[mode]?.includes(phase));

/**
 * Kana Raid's listening waves (2 Echo, 3 Long and Short): players hear a kana or a word from a
 * small phone speaker and pick what they heard, so the music drops further than for speaking.
 */
export const listening = (view: Pick<RoomView, 'mode' | 'phase' | 'game'>): boolean =>
  (view.mode === 'kana-raid' && view.phase === 'answer' && !!view.game && 'wave' in view.game && (view.game.wave === 2 || view.game.wave === 3)) ||
  // Shodō Taikai's dictation: each phone voices its own word.
  (view.mode === 'shodo' && view.phase === 'answer' && !!view.game && 'itemKind' in view.game && view.game.itemKind === 'dictation');

/**
 * Shodō Taikai's big sheet: once the first sheet is in, players start saying their sentence into
 * the phone, so the gallery track drops under (the music panel).
 */
export const saying = (view: Pick<RoomView, 'mode' | 'phase' | 'game'>): boolean =>
  view.mode === 'shodo' && view.phase === 'encore' && view.game?.mode === 'shodo' && view.game.finished > 0;

export function cueFor(mode: ModeId | null, phase: Phase, game = 0, listen = false, say = false): Cue {
  if (phase === 'lobby') return { song: 'bouncing', mix: 'full' };
  // Curtain Call, then the recap tune.
  if (phase === 'recap') return { song: 'happy-dance', mix: 'full', leadIn: 'fanfare' };
  if (mode === 'karaoke-duel') return karaokeCue(phase);
  if (mode === 'shodo') return shodoCue(phase, listen, say);
  const theme = mode ? themeFor(mode, game) : 'bouncing';
  if (theme === null) return { song: null, mix: 'full' };
  const mix = listen ? 'listen' : speaks(mode, phase) ? 'under' : 'full';
  // A recorded theme plays on through scores and finales; restarting it every round would grate.
  let song: MusicId = theme;
  if (!isTrack(theme) && phase === 'score') song = 'score';
  if (!isTrack(theme) && phase === 'finale') song = 'finale';
  // The culprit banner in Onsen's finale gets the roll; it isn't a speaking moment.
  if (mode === 'onsen-murder' && phase === 'finale') return { song, mix, sting: 'reveal' };
  if (phase === 'reveal' && mode && REVEAL_ROLL.has(mode)) return { song, mix, sting: 'reveal' };
  // Encores are short and some modes slot them between scores: don't restart the music for one.
  if (phase === 'encore') return { song, mix, keep: true };
  // Every game opens with the house ident.
  if (phase === 'intro') return { song, mix, leadIn: 'ident' };
  return { song, mix };
}

/**
 * Karaoke Duel plays its own backing track while someone sings (karaokeAudio.ts), so the music
 * stops for `answer`. Between songs a soft synth tune keeps the room from going quiet: under
 * through the vote and the result (the result has its own fanfare), the showdown tune at the end.
 */
function karaokeCue(phase: Phase): Cue {
  if (phase === 'answer') return { song: null, mix: 'full' };
  if (phase === 'intro') return { song: 'gentle', mix: 'full', leadIn: 'ident' };
  if (phase === 'finale') return { song: 'finale', mix: 'full' };
  return { song: 'gentle', mix: phase === 'prompt' ? 'full' : 'under' };
}

/** Shodō Taikai's gallery track (encore → finale → penalty), Ladi's pick. */
export const SHODO_GALLERY: TrackId = 'japanese-lofi';

/**
 * Shodō Taikai is calm throughout (the music panel): no drum roll, no score or finale tunes. The
 * writing rounds keep the soft synth tune, under while players write, say or read (a recorded koto
 * track turns to a dull hum in the under mix). The gallery switches to a recorded koto lo-fi track: full
 * while the big sheets are written, under once the first is in (players say their sentence), full
 * again for the stamps, under for the claim and the read-aloud send-off.
 */
function shodoCue(phase: Phase, listen: boolean, say: boolean): Cue {
  const song = MODE_THEMES.shodo ?? 'gentle';
  if (phase === 'intro') return { song, mix: 'full', leadIn: 'ident' };
  if (phase === 'encore') return { song: SHODO_GALLERY, mix: say ? 'under' : 'full' };
  if (phase === 'finale') return { song: SHODO_GALLERY, mix: 'full', keep: true };
  if (phase === 'penalty') return { song: SHODO_GALLERY, mix: 'under', keep: true };
  return { song, mix: listen ? 'listen' : 'under', keep: true };
}
