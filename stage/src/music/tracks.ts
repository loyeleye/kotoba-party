// Recorded tracks: music files we play instead of a synth song where a real recording fits
// better. Each one's licence is logged in docs/commercial-blockers.md (row 22; the AI-made Mureka
// tracks in row 26).

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
  // Narabete!: a light ukulele-and-marimba pair for lining things up.
  'daily-beetle',
  'easy-lemon',
  // Bento Haus: a busy, cheerful kitchen.
  'kawai-kitsune',
  'feelin-good',
  // Shodō Taikai's gallery round (Ladi's pick).
  'japanese-lofi',
  // Happyōkai!: a corporate lounge for the talk, and a bouncier one for its second game.
  'lobby-time',
  'pamgaea',
  // Karaoke Duel's grown-up songs: one instrumental each, sung over whole (songs.ts `track`).
  'night-drive-satnav',
  'night-drive-asleep',
  'harbour-ferry',
  'harbour-ticket',
  'run-footsteps',
  'run-melonpan',
  'save-dinner',
  'save-cat',
  'cheers-toast',
  'cheers-starters',
  'monday-blues-1',
  'monday-blues-2',
  'self-intro-faster',
  'self-intro-questions',
  'sparkle-idol-1',
  'sparkle-idol-2',
  'sleepless-caller',
  'sleepless-coffee',
  'where-were-you-1',
  'where-were-you-2',
  // Dub Club's episode: an AI-made cheap anime opening and ending (Mureka).
  'dub-opening',
  'dub-opening-b',
  'dub-ending',
] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export interface Track {
  title: string;
  author: string;
  /** 'Mureka': AI-generated for us on a paid Mureka plan (we own the output; it must be labelled AI). */
  licence: 'CC0' | 'CC BY 4.0' | 'CC BY 3.0' | 'Mureka';
  /** The track's own page, for the credits. */
  source: string;
  url: string;
  /** Loop between these points (seconds, on beats) so endings, fades and silent tails never play. */
  loop?: [number, number];
  /** Brings the file to about −16 LUFS, so every theme plays at the same loudness. */
  gainDb: number;
  /** The synth song to play if the file can't load. */
  fallback: SongId;
  /** The track's key, as the MIDI note its bells resolve to (Narabete!'s flip plays in key). */
  bellTonic?: number;
}

const OGA = 'https://opengameart.org/content/';
const HOLIZNA = `${OGA}happy-pop-electronic-collection`;
const MUREKA = 'https://www.mureka.ai';
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
  // Narabete!: Daily Beetle (D major, so its bells end on D6) is 80 bars at 100 bpm after its intro (the file is cut just after the loop);
  // Easy Lemon (A major: bells end on A5) loops whole bars from just after its pickup to just before the ending.
  'daily-beetle': { title: 'Daily Beetle', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500025'), url: file('daily-beetle'), loop: [21.06, 213.066], gainDb: 0, fallback: 'gentle', bellTonic: 86 },
  // Bento Haus: Kawai Kitsune (116 bpm) loops 88 bars after its intro (the file is cut just after the loop);
  // Feelin Good (131 bpm) loops 64 bars from its first downbeat, cut at 130 s. Both re-encoded at 128 kbps.
  'kawai-kitsune': { title: 'Kawai Kitsune', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1500059'), url: file('kawai-kitsune'), loop: [37.036, 219.103], gainDb: -0.4, fallback: 'festive', bellTonic: 91 },
  'feelin-good': { title: 'Feelin Good', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1100475'), url: file('feelin-good'), loop: [9.683, 126.943], gainDb: 2.3, fallback: 'festive', bellTonic: 91 },
  'easy-lemon': { title: 'Easy Lemon', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1200076'), url: file('easy-lemon'), loop: [3.019, 109.087], gainDb: 0.2, fallback: 'gentle', bellTonic: 81 },
  // Happyōkai!: Lobby Time (128 bpm) loops 64 bars after its intro; Pamgaea (94 bpm) loops 28 bars from its
  // first downbeat. Both cut just after the loop and re-encoded at 128 kbps.
  'lobby-time': { title: 'Lobby Time', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1600054'), url: file('lobby-time'), loop: [4.76, 124.714], gainDb: 1.1, fallback: 'gentle' },
  pamgaea: { title: 'Pamgaea', author: 'Kevin MacLeod', licence: 'CC BY 4.0', source: macleod('USUAN1300036'), url: file('pamgaea'), loop: [0.72, 72.191], gainDb: -2.8, fallback: 'festive' },
  // Shodō Taikai's gallery: koto over a lo-fi hip-hop beat. 28 bars at about 75 bpm; the loop skips the
  // intro and the fade (picked by spectral match). CC0 as uploaded; commissioned on Fiverr (row 22, ❓).
  'japanese-lofi': { title: 'Japanese Lofi HipHop', author: 'pickentcode', licence: 'CC0', source: `${OGA}japanese-lofi-hiphop-track`, url: file('japanese-lofi-hiphop'), loop: [10.75, 100.35], gainDb: -6.2, fallback: 'gentle' },
  // Karaoke Duel. Each file is cut to the bars the song uses (re-encoded at 128 kbps), so `start` is
  // its first downbeat and the song's `segments` count bars from there. No loop: the duel plays
  // stretches of it back to back (karaokeAudio.ts playSong).
  // Night Drive: two AI-made city-pop backings (Mureka, 2026-10-27), each sung over by its own version of
  // the song (songs.ts). Each file is already the song's bars in order at exactly 100 bpm, D major.
  'night-drive-satnav': { title: 'Night Drive (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('night-drive-satnav'), gainDb: 0.9, fallback: 'gentle' },
  'night-drive-asleep': { title: 'Night Drive (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('night-drive-asleep'), gainDb: 0.6, fallback: 'gentle' },
  // Harbour in the Rain: two AI-made enka backings (Mureka, 2026-10-27), one per version of the song.
  // Each file is already the song's bars in order at exactly 71 bpm, A minor.
  'harbour-ferry': { title: 'Harbour in the Rain (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('harbour-ferry'), gainDb: 0.7, fallback: 'gentle' },
  'harbour-ticket': { title: 'Harbour in the Rain (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('harbour-ticket'), gainDb: 1.6, fallback: 'gentle' },
  // Run!: two AI-made anime-rock backings (Mureka, 2026-10-27), one per version of the song. Each file is
  // already the song's bars in order, A major: version A at exactly 132 bpm, version B at 134.
  'run-footsteps': { title: 'Run! (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('run-footsteps'), gainDb: -1, fallback: 'battle' },
  'run-melonpan': { title: 'Run! (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('run-melonpan'), gainDb: -1.5, fallback: 'battle' },
  // Save It!: two AI-made kawaii future-bass backings (Mureka, 2026-10-27), one per version of the song
  // (songs.ts). Each file is already the song's bars in order: version A at exactly 141 bpm in A major,
  // version B at 140 bpm in E major.
  'save-dinner': { title: 'Save It! (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('save-dinner'), gainDb: -2.1, fallback: 'gentle' },
  'save-cat': { title: 'Save It! (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('save-cat'), gainDb: -1.9, fallback: 'gentle' },
  // Cheers!: two AI-made izakaya-pop backings (Mureka, 2026-10-27), one per version of the song (songs.ts).
  // Each file is already the song's bars in order, A major: version A at exactly 107 bpm, version B at 108.
  'cheers-toast': { title: 'Cheers! (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('cheers-toast'), gainDb: -0.2, fallback: 'festive' },
  'cheers-starters': { title: 'Cheers! (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('cheers-starters'), gainDb: -1.6, fallback: 'festive' },
  // Monday Blues: two AI-made blues backings (Mureka, 2026-10-27), each sung over by two versions of the
  // song. Each file is already the song's bars in order, E minor: take 1 at exactly 92 bpm, take 2 at 94.
  'monday-blues-1': { title: 'Monday Blues (take 1)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('monday-blues-1'), gainDb: 1.8, fallback: 'gentle' },
  'monday-blues-2': { title: 'Monday Blues (take 2)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('monday-blues-2'), gainDb: 0.1, fallback: 'gentle' },
  // Self-Intro Rap: two AI-made boom-bap backings (Mureka, 2026-10-27), one per version of the song.
  // Each file is already the song's bars in order at exactly 96 bpm, C major.
  'self-intro-faster': { title: 'Self-Intro Rap (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('self-intro-faster'), gainDb: 0.2, fallback: 'gentle' },
  'self-intro-questions': { title: 'Self-Intro Rap (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('self-intro-questions'), gainDb: -0.1, fallback: 'gentle' },
  // Sparkle Idol: two AI-made idol-pop backings (Mureka, 2026-10-27), one per version of the song.
  // Each file is already the song's bars in order: version A at exactly 128 bpm in A major, B at 129 bpm in D major.
  // Dub Club (Mureka, 2026-10-28): two takes of the opening (games alternate; Ladi), the ending ballad under the
  // credits. Cut from bar 1 to a whole number of bars at 152 bpm, faded out; they play once, then loop.
  'dub-opening': { title: 'Afureko Opening', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('dub-opening'), gainDb: -4.8, fallback: 'anime-op' },
  'dub-opening-b': { title: 'Afureko Opening (take 2)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('dub-opening-b'), gainDb: -5.2, fallback: 'anime-op' },
  'dub-ending': { title: 'Afureko Ending', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('dub-ending'), gainDb: -3.1, fallback: 'anime-end' },
  'sparkle-idol-1': { title: 'Sparkle Idol (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('sparkle-idol-1'), gainDb: 0.8, fallback: 'festive' },
  'sparkle-idol-2': { title: 'Sparkle Idol (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('sparkle-idol-2'), gainDb: -0.8, fallback: 'festive' },
  // Sleepless Night: two AI-made R&B backings (Mureka, 2026-10-27), one per version of the song.
  // Each file is already the song's bars in order: version A at exactly 71 bpm in C minor, B at 72 bpm in C major.
  'sleepless-caller': { title: 'Sleepless Night (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('sleepless-caller'), gainDb: 1.1, fallback: 'gentle' },
  'sleepless-coffee': { title: 'Sleepless Night (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('sleepless-coffee'), gainDb: 1.1, fallback: 'gentle' },
  // Where Were You?: two AI-made Shōwa kayō duet backings (Mureka, 2026-10-27), one per version of the song
  // (songs.ts). Each file is already the song's bars in order: version A at exactly 88 bpm in F major,
  // version B at 89 bpm in D major.
  'where-were-you-1': { title: 'Where Were You? (version A)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('where-were-you-1'), gainDb: 0.5, fallback: 'gentle' },
  'where-were-you-2': { title: 'Where Were You? (version B)', author: 'Mureka AI', licence: 'Mureka', source: MUREKA, url: file('where-were-you-2'), gainDb: -0.2, fallback: 'gentle' },
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
  if (t.licence === 'Mureka') return `"${t.title}" by ${who} · AI-generated music made for Kotoba Party with mureka.ai`;
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
    if (t.licence === 'Mureka') return `${titles}: AI-generated music made for Kotoba Party with mureka.ai`;
    if (t.licence === 'CC0') return `${titles} by ${author} (${where}, CC0)`;
    const v = ccBy(t);
    return `${titles} by ${author} (${where}), licensed under Creative Commons: By Attribution ${v.name} (${v.url.replace('https://', '')}), ${t.loop ? 'looped' : 'cut'} and filtered for the game`;
  });
}

export const isTrack = (id: string): id is TrackId => (TRACK_IDS as readonly string[]).includes(id);
