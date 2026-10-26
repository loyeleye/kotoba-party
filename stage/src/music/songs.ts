// The game's music, written as data and played by a small chiptune synth (engine.ts), so there
// are no audio files and nothing to license: every tune here is original to Kotoba Party.
//
// Each song is a loop of bars. `chords` has one entry per bar ("C G" splits a bar in two). The
// lead is written on an 8th-note grid, eight tokens a bar: a note (A4, F#5, Bb3), "-" to hold the
// note before, "." for a rest; "|" is ignored and only there to make bars readable. Drums are on a
// 16th grid, sixteen steps a bar, repeated to fill the song: "X" accent, "x" hit, "o" ghost, "." none.
// Bass and accompaniment are generated from the chords in the style named.
//
// The house theme: "ko-to-ba pa-a-ty!", D5 . D5 E5 F#5 - A5 . | G5 F#5 E5 - D5. The ident opens
// every game with it, the recap fanfare and the synth lobby and outro quote it, so the show
// sounds like one show whatever track plays between them.

export const SONG_IDS = ['lobby', 'festive', 'quiz', 'stroll', 'rush', 'battle', 'mystery', 'gentle', 'score', 'finale', 'outro', 'fanfare', 'reveal', 'ident'] as const;
export type SongId = (typeof SONG_IDS)[number];

export type Voice = 'pulse' | 'square' | 'tri' | 'pluck' | 'flute' | 'bell';
/** k kick, t taiko, s snare, h hi-hat, w woodblock (hyōshigi), g chanchiki (festival gong). */
export type Drum = 'k' | 't' | 's' | 'h' | 'w' | 'g';
export type CompStyle = 'stab' | 'arp' | 'pad' | 'none';
export type BassStyle = 'root4' | 'bounce' | 'octave' | 'drive' | 'long';

export interface Song {
  title: string;
  bpm: number;
  /** How late off-beat 8ths land, as a share of an 8th (0 straight, 0.33 full triplet swing). */
  swing?: number;
  /** Loops forever; false for jingles, which play once. */
  loop: boolean;
  chords: string[];
  lead?: { voice: Voice; notes: string; gain?: number };
  comp: { style: CompStyle; voice: Voice; gain?: number };
  bass: { style: BassStyle; gain?: number };
  drums: Partial<Record<Drum, string>>;
}

export const SONGS: Record<SongId, Song> = {
  // Lobby: a summer-festival walk-in, D major pentatonic over a bouncing octave bass.
  lobby: {
    title: 'Natsu Matsuri Walk-in',
    bpm: 116,
    swing: 0.12,
    loop: true,
    chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
    lead: {
      voice: 'pulse',
      notes:
        'D5 . D5 E5 F#5 - A5 . | G5 F#5 E5 - D5 - A4 - | A4 B4 D5 - E5 D5 B4 A4 | F#4 - E4 - D4 - . . |' +
        'F#4 A4 B4 - D5 - B4 A4 | B4 - A4 F#4 E4 - D4 E4 | F#4 A4 E4 - D4 E4 F#4 E4 | D4 - - - . . . .',
    },
    comp: { style: 'stab', voice: 'pluck' },
    bass: { style: 'octave' },
    drums: {
      k: 'x.......x.......',
      s: '....x.......x...',
      h: '..o...o...o...o.',
      t: 'X..........x....',
      g: 'x.o.x...x.o.x...',
    },
  },
  // Oogiri, Phrase Bingo, Oekaki: comedy-show bounce.
  festive: {
    title: 'Laugh Track Bounce',
    bpm: 128,
    swing: 0.18,
    loop: true,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'],
    lead: {
      voice: 'pulse',
      notes:
        'C5 . A4 C5 D5 . C5 A4 | F4 . G4 A4 - . D4 - | D5 . C5 D5 F5 - D5 C5 | G4 - A4 - C5 - . . |' +
        'C5 . A4 C5 D5 . F5 D5 | C5 . A4 G4 F4 - D4 - | F4 G4 A4 C5 D5 C5 A4 G4 | G4 - . C5 G4 - . .',
    },
    comp: { style: 'stab', voice: 'square', gain: 0.6 },
    bass: { style: 'bounce' },
    drums: {
      k: 'x.....x.x.......',
      s: '....x.......x...',
      h: 'x.o.x.o.x.o.x.o.',
      w: '......x.......x.',
    },
  },
  // Word Gauntlet, Concentration: a clock-tick thinking loop.
  quiz: {
    title: 'Tick-Tock Quiz Desk',
    bpm: 120,
    loop: true,
    chords: ['Am', 'F', 'C', 'G'],
    lead: { voice: 'bell', notes: 'E5 . . C5 . . A4 . | F5 . . C5 . . A4 . | G5 . . E5 . . C5 . | D5 . B4 . G4 . D5 .' },
    comp: { style: 'arp', voice: 'pulse', gain: 0.5 },
    bass: { style: 'root4' },
    drums: {
      k: 'x.......x.......',
      h: 'o.o.o.o.o.o.o.o.',
      w: 'x...x...x...x...',
    },
  },
  // Tourist Trouble: a breezy stroll with a flute.
  stroll: {
    title: 'Ekimae Stroll',
    bpm: 104,
    swing: 0.2,
    loop: true,
    chords: ['G', 'Em', 'C', 'D'],
    lead: { voice: 'flute', notes: 'D5 - B4 - G4 A4 B4 - | E5 - D5 B4 A4 - G4 - | E4 G4 A4 - B4 - A4 G4 | A4 - - - . . D4 .' },
    comp: { style: 'stab', voice: 'pluck' },
    bass: { style: 'bounce' },
    drums: {
      k: 'x.......x.......',
      s: '....o.......o...',
      h: '..o...o...o...o.',
    },
  },
  // The Last Train: a rattling, hurried train rhythm.
  rush: {
    title: 'Last Train Dash',
    bpm: 150,
    loop: true,
    // 16 bars (about 26 s): the dash, an answer to it, a climb to the B chord, the dash again.
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'Am', 'C', 'D', 'B', 'Em', 'Em', 'C', 'D'],
    lead: {
      voice: 'pulse',
      notes:
        'E5 . E5 D5 B4 . G4 . | A4 B4 . G4 E4 . . . | E5 . G5 . E5 D5 C5 B4 | A4 . B4 . D5 - - . |' +
        'E5 . E5 D5 B4 . G4 . | A4 B4 . G4 E4 . G4 A4 | B4 . C5 . D5 . E5 . | F#5 - E5 - D5 - . . |' +
        'A4 . C5 . E5 - D5 C5 | G4 . C5 . E5 . G5 - | F#5 - E5 - D5 - C5 - | B4 - D#5 - F#5 - B5 . |' +
        'E5 . E5 D5 B4 . G4 . | A4 B4 . G4 E4 . . . | E5 . G5 . E5 D5 C5 B4 | A4 . B4 . E5 - - .',
    },
    comp: { style: 'arp', voice: 'square', gain: 0.4 },
    bass: { style: 'drive' },
    drums: {
      k: 'x..x..x.x..x..x.',
      s: '....x.......x...',
      h: 'oooooooooooooooo',
    },
  },
  // Kana Yōkai Raid: a driving minor battle with taiko (D miyako-bushi flavour).
  battle: {
    title: 'Yōkai Raid',
    bpm: 138,
    loop: true,
    chords: ['Dm', 'Bb', 'Gm', 'A'],
    lead: { voice: 'square', notes: 'D5 . D5 Eb5 D5 . A4 . | Bb4 . A4 . G4 - A4 . | G4 . Bb4 . D5 . Eb5 D5 | C#5 - - . A4 . . .', gain: 0.8 },
    comp: { style: 'arp', voice: 'pulse', gain: 0.45 },
    bass: { style: 'drive' },
    drums: {
      k: 'x...x...x...x...',
      s: '....x.......x...',
      h: '..o...o...o...o.',
      t: 'X..x..x.........',
    },
  },
  // Murder at the Onsen: slow and spooky, in-scale on A, wooden clappers.
  mystery: {
    title: 'Steam and Suspicion',
    bpm: 84,
    loop: true,
    chords: ['Am', 'Dm', 'Bb', 'E'],
    lead: { voice: 'flute', notes: 'E5 - - F5 E5 - . . | D5 - - - A4 - Bb4 A4 | F4 - - - D5 - - - | E5 - - - . . . .' },
    comp: { style: 'pad', voice: 'tri', gain: 0.7 },
    bass: { style: 'long' },
    drums: {
      k: 'x...............',
      h: '........o.......',
      w: '......x........X',
    },
  },
  // Omiai: warm and sweet, music-box bells.
  gentle: {
    title: 'Teacups at Two',
    bpm: 92,
    swing: 0.15,
    loop: true,
    chords: ['F', 'Am7', 'Bbmaj7', 'C'],
    lead: { voice: 'bell', notes: 'A4 - C5 - D5 - C5 - | E5 - - - C5 - A4 - | D5 - F5 - D5 C5 A4 - | G4 - - - . . . .' },
    comp: { style: 'pad', voice: 'tri', gain: 0.6 },
    bass: { style: 'long' },
    drums: {
      k: 'x.......x.......',
      h: '....o.......o...',
    },
  },
  // Scores: a jaunty tally-up.
  score: {
    title: 'Tally Ho',
    bpm: 132,
    swing: 0.15,
    loop: true,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
    lead: {
      voice: 'pulse',
      notes:
        'G4 . C5 . E5 . G5 . | A5 G5 E5 . C5 . A4 . | F4 . A4 . C5 . A4 . | B4 . D5 . G5 - - . |' +
        'G4 . C5 . E5 . G5 . | A5 G5 E5 . C5 . E5 . | F5 . E5 . D5 . C5 . | B4 . C5 . D5 - - . |' +
        'A4 . C5 . F5 - E5 . | D5 . B4 . G4 - - . | E5 . G5 . B5 - G5 . | A5 - - . E5 . C5 . |' +
        'F5 . E5 . D5 . C5 . | B4 . D5 . G5 - F5 . | E5 . D5 . C5 - - . | C5 . E5 . G5 - - .',
    },
    comp: { style: 'stab', voice: 'pluck' },
    bass: { style: 'octave' },
    drums: {
      k: 'x.......x.......',
      s: '....x.......x...',
      h: 'x.o.x.o.x.o.x.o.',
      g: 'x.......x.......',
    },
  },
  // Finales (Platform Dash, the Raid's boss): big taiko.
  finale: {
    title: 'Taiko Showdown',
    bpm: 120,
    loop: true,
    chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'Gm', 'Bb', 'C', 'A'],
    lead: {
      voice: 'square',
      notes:
        'D5 - - . A4 . D5 . | F5 - E5 . D5 . C5 . | D5 - - . F5 . D5 . | E5 - - . G5 - E5 . |' +
        'D5 - - . A4 . D5 . | F5 - E5 . D5 . F5 . | G5 - - . F5 . D5 . | E5 - - . C5 - E5 . |' +
        'G5 - F5 . D5 . Bb4 . | F5 - D5 . Bb4 . D5 . | E5 - G5 . C6 - G5 . | A5 - - . C#5 - E5 .',
      gain: 0.8,
    },
    comp: { style: 'pad', voice: 'pulse', gain: 0.35 },
    bass: { style: 'drive' },
    drums: {
      k: 'x.......x.......',
      s: '....x.......x...',
      t: 'X..x..x.x.x.x...',
      g: 'o.o.o.o.o.o.o.o.',
    },
  },
  // Recap, after the fanfare: winding down.
  outro: {
    title: 'Otsukaresama',
    bpm: 100,
    swing: 0.2,
    loop: true,
    chords: ['D', 'Bm', 'G', 'A'],
    lead: { voice: 'pluck', notes: 'D5 - D5 E5 F#5 - A5 - | B4 - A4 - F#4 - D4 - | E4 F#4 A4 - B4 - A4 F#4 | E4 - - - . . . .' },
    comp: { style: 'pad', voice: 'tri', gain: 0.6 },
    bass: { style: 'bounce' },
    drums: {
      k: 'x.......x.......',
      s: '....o.......o...',
      h: '..o...o...o...o.',
    },
  },
  // Jingle into the recap.
  fanfare: {
    title: 'Curtain Call',
    bpm: 140,
    loop: false,
    chords: ['D', 'G A', 'D'],
    // The house theme, then up to the top D.
    lead: { voice: 'pulse', notes: 'D5 . D5 E5 F#5 - A5 . | B5 - A5 . G5 F#5 E5 . | D6 - - - - - - .' },
    comp: { style: 'stab', voice: 'square', gain: 0.6 },
    bass: { style: 'octave' },
    drums: {
      s: 'x.x.x.x.xxxxxxxx|x...x...x...x...|................',
      t: '................|................|X...............',
      g: '................|................|X...............',
    },
  },
  // Drum roll before a reveal: unpitched, so it sits over any loop.
  // The house ident before every game: the theme once, quick, with a gong on the landing.
  ident: {
    title: 'Kotoba Party!',
    bpm: 150,
    loop: false,
    chords: ['D', 'G A', 'D'],
    lead: { voice: 'pulse', notes: 'D5 . D5 E5 F#5 - A5 . | G5 F#5 E5 - D5 - E5 - | D5 - - - . . . .' },
    comp: { style: 'stab', voice: 'square', gain: 0.5 },
    bass: { style: 'octave' },
    drums: {
      k: 'x.......x.......|x.......x.......|x...............',
      s: '....x.......x...|....x.......xxxx|................',
      h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|................',
      g: '................|................|X...............',
    },
  },
  reveal: {
    title: 'Drum Roll',
    bpm: 140,
    loop: false,
    chords: ['C'],
    comp: { style: 'none', voice: 'tri' },
    bass: { style: 'long', gain: 0 },
    drums: {
      s: 'ooooxxxxxxxxXX..',
      t: '............X...',
      g: '............X...',
    },
  },
};

// ---- compiling a song into timed events ----

export type Part = 'lead' | 'comp' | 'bass' | 'drum';

export interface MusicEvent {
  part: Part;
  voice: Voice | Drum;
  /** In 16ths from the start of the song. */
  step: number;
  /** In 16ths. */
  len: number;
  /** MIDI note; 0 for drums. */
  midi: number;
  /** 0–1. */
  vel: number;
}

export interface Plan {
  bars: number;
  /** Events grouped by the bar they start in. */
  byBar: MusicEvent[][];
}

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" → 66. Throws on anything else. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PITCH[m[1]!]! + acc;
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  '5': [0, 7],
};

/** "Bbmaj7" → root pitch class 10 and its intervals. */
export function parseChord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const tones = m ? QUALITY[m[3]!] : undefined;
  if (!m || !tones) throw new Error(`bad chord "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return { root: (PITCH[m[1]!]! + acc + 12) % 12, tones };
}

const tokens = (s: string) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);

/** Lead tokens (8th grid) → note events. */
export function parseLead(notes: string, voice: Voice, gain = 1): MusicEvent[] {
  const out: MusicEvent[] = [];
  tokens(notes).forEach((tok, i) => {
    if (tok === '.') return;
    if (tok === '-') {
      const last = out.at(-1);
      if (last && last.step + last.len === i * 2) last.len += 2;
      return;
    }
    out.push({ part: 'lead', voice, step: i * 2, len: 2, midi: noteToMidi(tok), vel: gain });
  });
  return out;
}

export function leadLength(notes: string): number {
  return tokens(notes).length;
}

const VEL: Record<string, number> = { X: 1, x: 0.75, o: 0.4 };

/** One drum line, repeated over `bars`. */
export function parseDrum(pattern: string, drum: Drum, bars: number): MusicEvent[] {
  const steps = pattern.replace(/\|/g, '');
  if (steps.length === 0 || steps.length % 16 !== 0) throw new Error(`drum "${drum}" is not whole bars: ${pattern}`);
  const out: MusicEvent[] = [];
  for (let s = 0; s < bars * 16; s++) {
    const vel = VEL[steps[s % steps.length]!];
    if (vel) out.push({ part: 'drum', voice: drum, step: s, len: 1, midi: 0, vel });
  }
  return out;
}

/** Nearest MIDI note with pitch class `pc` at or above `low`. */
const above = (pc: number, low: number) => low + ((pc - low) % 12 + 12) % 12;

function bassFor(root: number, start: number, len: number, style: BassStyle, gain: number): MusicEvent[] {
  const r = above(root, 36);
  const ev = (step: number, l: number, midi: number, vel = gain): MusicEvent => ({ part: 'bass', voice: 'tri', step: start + step, len: l, midi, vel });
  const out: MusicEvent[] = [];
  switch (style) {
    case 'long':
      out.push(ev(0, len, r));
      break;
    case 'root4':
      for (let s = 0; s < len; s += 4) out.push(ev(s, 3, r));
      break;
    case 'drive':
      for (let s = 0; s < len; s += 2) out.push(ev(s, 2, r, s % 4 === 0 ? gain : gain * 0.8));
      break;
    case 'bounce':
      for (let s = 0; s < len; s += 4) out.push(ev(s, 2, s % 8 === 0 ? r : r + 7), ev(s + 2, 1, r + 12, gain * 0.6));
      break;
    case 'octave':
      for (let s = 0; s < len; s += 2) out.push(ev(s, 2, s % 4 === 0 ? r : r + 12, s % 4 === 0 ? gain : gain * 0.75));
      break;
  }
  return out;
}

function compFor(root: number, tones: number[], start: number, len: number, style: CompStyle, voice: Voice, gain: number): MusicEvent[] {
  const base = above(root, 57);
  const chord = tones.map((t) => base + t);
  const ev = (step: number, l: number, midi: number, vel = gain): MusicEvent => ({ part: 'comp', voice, step: start + step, len: l, midi, vel });
  const out: MusicEvent[] = [];
  switch (style) {
    case 'none':
      break;
    case 'pad':
      for (const m of chord) out.push(ev(0, len, m, gain / chord.length));
      break;
    case 'stab':
      // Off-beat chord stabs, festival style.
      for (let s = 2; s < len; s += 4) for (const m of chord) out.push(ev(s, 1, m, gain / chord.length));
      break;
    case 'arp': {
      const up = [...chord, chord[0]! + 12].map((m) => m + 12);
      for (let s = 0; s < len; s++) out.push(ev(s, 1, up[s % up.length]!, s % 4 === 0 ? gain : gain * 0.7));
      break;
    }
  }
  return out;
}

/** Turns a song into timed events, grouped by bar. */
export function compile(song: Song): Plan {
  const bars = song.chords.length;
  const events: MusicEvent[] = [];
  song.chords.forEach((bar, b) => {
    const parts = tokens(bar);
    const each = 16 / parts.length;
    parts.forEach((name, i) => {
      const { root, tones } = parseChord(name);
      events.push(...bassFor(root, b * 16 + i * each, each, song.bass.style, song.bass.gain ?? 1));
      events.push(...compFor(root, tones, b * 16 + i * each, each, song.comp.style, song.comp.voice, song.comp.gain ?? 1));
    });
  });
  if (song.lead) events.push(...parseLead(song.lead.notes, song.lead.voice, song.lead.gain ?? 1));
  for (const [drum, pattern] of Object.entries(song.drums)) events.push(...parseDrum(pattern, drum as Drum, bars));
  const byBar: MusicEvent[][] = Array.from({ length: bars }, () => []);
  for (const e of events) byBar[Math.floor(e.step / 16)]?.push(e);
  return { bars, byBar };
}
