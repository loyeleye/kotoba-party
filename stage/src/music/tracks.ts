// Recorded tracks: music files we play instead of a synth song where a real recording fits
// better. Each one's licence is logged in docs/commercial-blockers.md (row 22).

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
  /** Where it came from, for the credits. */
  source: string;
  url: string;
}

const OGA = 'https://opengameart.org/content/';
const HOLIZNA = `${OGA}happy-pop-electronic-collection`;
const INCOMPETECH = 'https://incompetech.com/music/royalty-free/';
const file = (name: string) => `/stage/assets/music/${name}.mp3`;

export const TRACKS: Record<TrackId, Track> = {
  // Kana Yōkai Raid: anime-style rock battle theme. Loops seamlessly (40 bars at 140 bpm).
  raid: { title: 'Determination', author: 'HydroGene', licence: 'CC0', source: `${OGA}determination-anime-style-music`, url: file('determination') },
  // The lobby and the social games: bright pop, funk and swing.
  bouncing: { title: 'Bouncing', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('bouncing') },
  monkeys: { title: 'Monkeys Spinning Monkeys', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('monkeys-spinning-monkeys') },
  love: { title: 'Love Love Love', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('love-love-love') },
  heps: { title: 'Hep Cats', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('hep-cats') },
  trip: { title: 'Take a Trip', author: 'genaralskar', licence: 'CC BY 4.0', source: `${OGA}take-a-trip`, url: file('take-a-trip') },
  carefree: { title: 'Carefree', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('carefree') },
  'happy-dance': { title: 'Happy Dance', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('happy-dance') },
  // The quiz games and the murder mystery.
  investigations: { title: 'Investigations', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('investigations') },
  funkorama: { title: 'Funkorama', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('funkorama') },
  sneaky: { title: 'Sneaky Snitch', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: INCOMPETECH, url: file('sneaky-snitch') },
};

/** The credit lines a credits screen must show (CC BY tracks need one; CC0 ones get one anyway). */
export const TRACK_CREDITS: string[] = TRACK_IDS.map((id) => {
  const t = TRACKS[id];
  return t.licence === 'CC BY 4.0' ? `"${t.title}" by ${t.author}, licensed under CC BY 4.0 (${t.source})` : `"${t.title}" by ${t.author} (CC0)`;
});

export const isTrack = (id: string): id is TrackId => (TRACK_IDS as readonly string[]).includes(id);
