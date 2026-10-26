// Recorded tracks: music files we play instead of a synth song where a real recording fits
// better. Each one's licence is logged in docs/commercial-blockers.md (row 22).

import type { SongId } from './songs.js';

export const TRACK_IDS = [
  'raid',
  'bouncing',
  'monkeys',
  'love',
  'heps',
  'trip',
  'carefree',
  'happy-dance',
  'investigations',
  'funkorama',
  'sneaky',
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface Track {
  title: string;
  author: string;
  licence: 'CC0' | 'CC BY 4.0';
  /** The track's own page, for the credits. */
  source: string;
  url: string;
  /** Loop between these points (seconds, on beats) so endings, fades and silent tails never play. */
  loop?: [number, number];
  /** Brings the file to about −16 LUFS, so every theme plays at the same loudness. */
  gainDb: number;
  /** The synth song to play if the file can't load. */
  fallback: SongId;
}

const OGA = 'https://opengameart.org/content/';
const HOLIZNA = `${OGA}happy-pop-electronic-collection`;
const macleod = (isrc: string) => `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`;
const file = (name: string) => `/stage/assets/music/${name}.mp3`;

// Loop points come from beat tracking (librosa) on each file: a whole number of bars, from just after
// the intro to just before the ending, picked where the music either side of the jump matches best.
// Gains are −16 − (integrated loudness measured with ffmpeg's ebur128 filter).
export const TRACKS: Record<TrackId, Track> = {
  // Kana Yōkai Raid: anime-style rock battle theme. The file is exactly 40 bars at 140 bpm, so it loops whole.
  raid: { title: 'Determination', author: 'HydroGene', licence: 'CC0', source: `${OGA}determination-anime-style-music`, url: file('determination'), gainDb: -7, fallback: 'battle' },
  // The lobby and the social games: bright pop, funk and swing.
  bouncing: { title: 'Bouncing', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('bouncing'), loop: [12.539, 76.556], gainDb: -6.5, fallback: 'lobby' },
  monkeys: {
    title: 'Monkeys Spinning Monkeys',
    author: 'Kevin MacLeod',
    licence: 'CC BY 4.0',
    source: macleod('USUAN1400011'),
    url: file('monkeys-spinning-monkeys'),
    loop: [8.406, 121.974],
    gainDb: 1.8,
    fallback: 'festive',
  },
  love: { title: 'Love Love Love', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('love-love-love'), loop: [21.432, 154.993], gainDb: -6.7, fallback: 'festive' },
  heps: { title: 'Hep Cats', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500022'), url: file('hep-cats'), loop: [3.738, 243.717], gainDb: 0.7, fallback: 'festive' },
  trip: { title: 'Take a Trip', author: 'genaralskar', licence: 'CC BY 4.0', source: `${OGA}take-a-trip`, url: file('take-a-trip'), loop: [6.85, 137.485], gainDb: -0.5, fallback: 'stroll' },
  carefree: { title: 'Carefree', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1400037'), url: file('carefree'), loop: [7.872, 198.182], gainDb: 4.6, fallback: 'gentle' },
  'happy-dance': { title: 'Happy Dance', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('happy-dance'), loop: [13.537, 149.537], gainDb: -2.6, fallback: 'outro' },
  // The quiz games and the mystery.
  investigations: {
    title: 'Investigations',
    author: 'Kevin MacLeod',
    licence: 'CC BY 4.0',
    source: macleod('USUAN1100646'),
    url: file('investigations'),
    loop: [5.759, 86.587],
    gainDb: 3.1,
    fallback: 'quiz',
  },
  funkorama: { title: 'Funkorama', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100474'), url: file('funkorama'), loop: [12.539, 193.724], gainDb: 0.7, fallback: 'quiz' },
  sneaky: { title: 'Sneaky Snitch', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100772'), url: file('sneaky-snitch'), loop: [6.293, 127.663], gainDb: 1.9, fallback: 'mystery' },
};

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

/**
 * The credit line for a track, in the form CC BY 4.0 and incompetech ask for: title, author, source,
 * licence with a link, and a note that the game loops and filters it. CC0 tracks are credited too.
 */
export function creditFor(id: TrackId): string {
  const t = TRACKS[id];
  const who = t.author === 'Kevin MacLeod' ? 'Kevin MacLeod (incompetech.com)' : t.author;
  if (t.licence === 'CC0') return `"${t.title}" by ${who} (CC0) · ${t.source}`;
  return `"${t.title}" by ${who} · ${t.source} · Licensed under Creative Commons: By Attribution 4.0 · ${CC_BY} · Looped and filtered for the game`;
}

/** Every track's full credit line, for docs/music.md and the tests. */
export const TRACK_CREDITS: string[] = TRACK_IDS.map(creditFor);

/**
 * The same credits grouped by author, short enough to read on the recap screen: titles, author,
 * where they're from and the licence with its link.
 */
export function creditSummary(): string[] {
  const by = new Map<string, TrackId[]>();
  for (const id of TRACK_IDS) by.set(TRACKS[id].author, [...(by.get(TRACKS[id].author) ?? []), id]);
  return [...by].map(([author, ids]) => {
    const titles = ids.map((id) => `"${TRACKS[id].title}"`).join(', ');
    const where = author === 'Kevin MacLeod' ? 'incompetech.com' : 'OpenGameArt.org';
    if (TRACKS[ids[0]!].licence === 'CC0') return `${titles} by ${author} (${where}, CC0)`;
    return `${titles} by ${author} (${where}), licensed under Creative Commons: By Attribution 4.0 (${CC_BY.replace('https://', '')}), looped and filtered for the game`;
  });
}

export const isTrack = (id: string): id is TrackId => (TRACK_IDS as readonly string[]).includes(id);
