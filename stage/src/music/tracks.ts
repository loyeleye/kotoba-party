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
  // Second themes: each game alternates between two (cues.ts MODE_THEMES).
  'quirky-dog',
  'life-of-riley',
  'wallpaper',
  'off-to-osaka',
  'local-forecast',
  'cipher',
  'kool-kats',
  'ishikari-lore',
  'ouroboros',
  // Shodō Taikai's gallery round (Ladi's pick).
  'japanese-lofi',
  // Karaoke Duel's grown-up songs: one instrumental each, sung over whole (songs.ts `track`).
  'nights-in-june',
  'past-sadness',
  'jrpg-rock',
  'hot-springs',
  'hustle',
  'lazy-saturday',
  'starlight',
  'slow-jam',
  'in-your-arms',
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface Track {
  title: string;
  author: string;
  licence: 'CC0' | 'CC BY 4.0' | 'CC BY 3.0';
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
  bouncing: { title: 'Bouncing', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('bouncing'), loop: [12.539, 76.539], gainDb: -6.5, fallback: 'lobby' },
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
  love: { title: 'Love Love Love', author: 'Holizna', licence: 'CC0', source: HOLIZNA, url: file('love-love-love'), loop: [21.432, 154.9972], gainDb: -6.7, fallback: 'festive' },
  heps: { title: 'Hep Cats', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500022'), url: file('hep-cats'), loop: [3.738, 243.7381], gainDb: 0.7, fallback: 'festive' },
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
  // Second themes (Kevin MacLeod): a game played twice in a row gets its other theme.
  'quirky-dog': { title: 'Quirky Dog', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500053'), url: file('quirky-dog'), loop: [5.503, 135.442], gainDb: -6.7, fallback: 'festive' },
  'life-of-riley': { title: 'Life of Riley', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1400054'), url: file('life-of-riley'), loop: [8.011, 223.004], gainDb: 2.1, fallback: 'festive' },
  'wallpaper': { title: 'Wallpaper', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100843'), url: file('wallpaper'), loop: [15.534, 201.34], gainDb: -4.3, fallback: 'festive' },
  'off-to-osaka': { title: 'Off to Osaka', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100128'), url: file('off-to-osaka'), loop: [8.081, 98.337], gainDb: 3.2, fallback: 'stroll' },
  'local-forecast': { title: 'Local Forecast - Elevator', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1300012'), url: file('local-forecast'), loop: [5.735, 185.922], gainDb: 3.7, fallback: 'gentle' },
  'cipher': { title: 'Cipher', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100844'), url: file('cipher'), loop: [4.481, 215.667], gainDb: 3.7, fallback: 'quiz' },
  'kool-kats': { title: 'Kool Kats', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100601'), url: file('kool-kats'), loop: [6.966, 193.8688], gainDb: 0.4, fallback: 'quiz' },
  'ishikari-lore': { title: 'Ishikari Lore', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100192'), url: file('ishikari-lore'), loop: [6.641, 158.8361], gainDb: 6.9, fallback: 'mystery' },
  'ouroboros': { title: 'Ouroboros', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1400007'), url: file('ouroboros'), loop: [23.615, 158.198], gainDb: -6.1, fallback: 'battle' },
  // Shodō Taikai's gallery: koto over a lo-fi hip-hop beat. 28 bars at about 75 bpm; the loop skips the
  // intro and the fade (picked by spectral match). CC0 as uploaded; commissioned on Fiverr (row 22, ❓).
  'japanese-lofi': { title: 'Japanese Lofi HipHop', author: 'pickentcode', licence: 'CC0', source: `${OGA}japanese-lofi-hiphop-track`, url: file('japanese-lofi-hiphop'), loop: [10.75, 100.35], gainDb: -6.2, fallback: 'gentle' },
  // Karaoke Duel. Each file is cut to the bars the song uses (re-encoded at 128 kbps), so `start` is
  // its first downbeat and the song's `segments` count bars from there. No loop: the duel plays
  // stretches of it back to back (karaokeAudio.ts playSong).
  // Night Drive: city-pop groove, 120 bpm, B minor. Cut from 8.0 s (orig. bar 4) to 65.0 s.
  'nights-in-june': { title: 'Nights In June', author: 'KLY', licence: 'CC BY 3.0', source: `${OGA}nights-in-june`, url: file('nights-in-june'), gainDb: -3.5, fallback: 'gentle' },
  // Harbour in the Rain: slow piano, 72 bpm, A minor (a Dm7–G–Am7–C loop throughout). The first 128 s.
  // Very quiet (−28.7 LUFS), so the gain stops just short of clipping its loudest peak.
  'past-sadness': { title: 'Past Sadness', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1900007'), url: file('past-sadness'), gainDb: 11.5, fallback: 'gentle' },
  // Run!: anime rock, 152 bpm, F♯ minor. From 14.0 s (orig. bar 9).
  'jrpg-rock': { title: 'JRPG Epic Rock Battle Theme', author: 'HydroGene', licence: 'CC0', source: `${OGA}jrpg-epic-rock-battle-theme-1`, url: file('jrpg-epic-rock'), gainDb: -7.2, fallback: 'battle' },
  // Cheers!: festival tune, 120 bpm, A major. The first 33 s.
  'hot-springs': { title: 'Hot Springs Town', author: 'Kistol', licence: 'CC0', source: `${OGA}hot-springs-town`, url: file('hot-springs-town'), gainDb: 0.3, fallback: 'festive' },
  // Monday Blues: minor blues, 120 bpm, E minor (12-bar). From 15.0 s (orig. bar 7), before the key change.
  hustle: { title: 'Hustle', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100793'), url: file('hustle'), gainDb: -6.1, fallback: 'mystery' },
  // Self-Intro Rap: boom-bap, 92 bpm, A minor (a four-bar loop). From 36.0 s (orig. bar 14).
  'lazy-saturday': { title: 'Lazy Saturday', author: 'vandalorum', licence: 'CC BY 4.0', source: `${OGA}hiphop-old-school-chill-themes`, url: file('lazy-saturday'), gainDb: -0.2, fallback: 'gentle' },
  // Sparkle Idol: bright pop, 130 bpm, D major. From 7.0 s (orig. bar 4).
  starlight: { title: 'Cheers For Starlight', author: 'Chloe Wolfe', licence: 'CC BY 4.0', source: `${OGA}cute-bytes-ost-cheers-for-starlight`, url: file('cheers-for-starlight'), gainDb: -6.7, fallback: 'festive' },
  // Sleepless Night: slow jam, 75 bpm, C minor. The first 90 s.
  'slow-jam': { title: 'Slow Jam', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1600015'), url: file('slow-jam'), gainDb: -4.7, fallback: 'gentle' },
  // Where Were You?: 1940s swing ballad, 98 bpm, F major. The first 80 s.
  'in-your-arms': { title: 'In Your Arms', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500042'), url: file('in-your-arms'), gainDb: -2.5, fallback: 'gentle' },
};

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const ccBy = (t: Track) => (t.licence === 'CC BY 3.0' ? { name: '3.0', url: 'https://creativecommons.org/licenses/by/3.0/' } : { name: '4.0', url: CC_BY });

/**
 * The credit line for a track, in the form CC BY 4.0 and incompetech ask for: title, author, source,
 * licence with a link, and a note that the game loops and filters it. CC0 tracks are credited too.
 */
export function creditFor(id: TrackId): string {
  const t = TRACKS[id];
  const who = t.author === 'Kevin MacLeod' ? 'Kevin MacLeod (incompetech.com)' : t.author;
  if (t.licence === 'CC0') return `"${t.title}" by ${who} (CC0) · ${t.source}`;
  const v = ccBy(t);
  return `"${t.title}" by ${who} · ${t.source} · Licensed under Creative Commons: By Attribution ${v.name} · ${v.url} · ${t.loop ? 'Looped and filtered' : 'Cut and filtered'} for the game`;
}

/** Every track's full credit line, for docs/music.md and the tests. */
export const TRACK_CREDITS: string[] = TRACK_IDS.map(creditFor);

/**
 * The same credits grouped by author, each line short enough to read across the foot of the recap
 * screen (an author with many tracks takes several lines): titles, author, where they're from and
 * the licence with its link.
 */
export function creditSummary(perLine = 3): string[] {
  const by = new Map<string, TrackId[]>();
  for (const id of TRACK_IDS) by.set(TRACKS[id].author, [...(by.get(TRACKS[id].author) ?? []), id]);
  const groups: [string, TrackId[]][] = [];
  for (const [author, ids] of by) for (let i = 0; i < ids.length; i += perLine) groups.push([author, ids.slice(i, i + perLine)]);
  return groups.map(([author, ids]) => {
    const titles = ids.map((id) => `"${TRACKS[id].title}"`).join(', ');
    const where = author === 'Kevin MacLeod' ? 'incompetech.com' : 'OpenGameArt.org';
    const t = TRACKS[ids[0]!];
    if (t.licence === 'CC0') return `${titles} by ${author} (${where}, CC0)`;
    const v = ccBy(t);
    return `${titles} by ${author} (${where}), licensed under Creative Commons: By Attribution ${v.name} (${v.url.replace('https://', '')}), ${t.loop ? 'looped' : 'cut'} and filtered for the game`;
  });
}

export const isTrack = (id: string): id is TrackId => (TRACK_IDS as readonly string[]).includes(id);
