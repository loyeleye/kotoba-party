import { describe, expect, it } from 'vitest';
import { MODE_IDS, PHASES } from '../shared/src/protocol.js';
import { MODE_ALT_THEMES, MODE_THEMES, cueFor, listening, saying, themeFor } from '../stage/src/music/cues.js';
import { existsSync } from 'node:fs';
import { SONGS, SONG_IDS, compile, leadLength, noteToMidi, parseChord, parseLead } from '../stage/src/music/songs.js';
import { TRACKS, TRACK_CREDITS, TRACK_IDS, creditSummary } from '../stage/src/music/tracks.js';
import { execFileSync } from 'node:child_process';

describe('songs', () => {
  it.each(SONG_IDS)('%s compiles, and its lead fills every bar', (id) => {
    const song = SONGS[id];
    const plan = compile(song);
    expect(plan.bars).toBe(song.chords.length);
    if (song.lead) expect(leadLength(song.lead.notes)).toBe(plan.bars * 8);
    for (const bar of plan.byBar) for (const e of bar) expect(e.step).toBeLessThan(plan.bars * 16);
    expect(plan.byBar.flat().length).toBeGreaterThan(0);
  });

  it('reads notes and chords', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#4')).toBe(66);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(parseChord('Bbmaj7')).toEqual({ root: 10, tones: [0, 4, 7, 11] });
    expect(parseChord('C#m')).toEqual({ root: 1, tones: [0, 3, 7] });
    expect(() => parseChord('H')).toThrow();
  });

  it('holds a note across "-" and skips rests', () => {
    const ev = parseLead('A4 - - . C5 . . .', 'pulse');
    expect(ev.map((e) => [e.step, e.len, e.midi])).toEqual([
      [0, 6, 69],
      [8, 2, 72],
    ]);
  });

  it('every loop and jingle the cues use exists', () => {
    for (const mode of MODE_IDS) for (const phase of PHASES) {
      const cue = cueFor(mode, phase);
      for (const id of [cue.song, cue.leadIn, cue.sting]) if (id) expect([...SONG_IDS, ...TRACK_IDS]).toContain(id);
    }
  });

  it.each(TRACK_IDS)('track %s has its file and licence', (id) => {
    const t = TRACKS[id];
    expect(existsSync(t.url.replace(/^\/stage\//, 'stage/'))).toBe(true);
    expect(t.licence).toBeTruthy();
    expect(Number.isFinite(t.gainDb)).toBe(true);
    if (t.loop) {
      const [a, b] = t.loop;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b - a).toBeGreaterThan(20);
      if (ffprobe) expect(b).toBeLessThanOrEqual(duration(t.url.replace(/^\/stage\//, 'stage/')));
    }
  });

  it('credits every track with its title, author and licence', () => {
    for (const [i, id] of TRACK_IDS.entries()) {
      const t = TRACKS[id];
      expect(TRACK_CREDITS[i]).toContain(`"${t.title}" by ${t.author}`);
      if (t.licence === 'CC BY 4.0') expect(TRACK_CREDITS[i]).toMatch(/By Attribution 4\.0.*creativecommons\.org\/licenses\/by\/4\.0.*Looped and filtered/);
    }
    const summary = creditSummary().join('\n');
    for (const t of Object.values(TRACKS)) expect(summary).toContain(`"${t.title}"`);
    expect(summary).toContain('creativecommons.org/licenses/by/4.0');
    expect(summary).toMatch(/by Kevin MacLeod \(incompetech\.com\)/);
    // Short enough to read across the foot of the recap.
    for (const line of creditSummary()) expect(line.length).toBeLessThan(220);
  });
});

const ffprobe = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const duration = (file: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

describe('cues', () => {
  it('plays Bouncing in the lobby and pop in the recap', () => {
    expect(cueFor(null, 'lobby')).toEqual({ song: 'bouncing', mix: 'full' });
    expect(cueFor('oogiri', 'recap')).toEqual({ song: 'happy-dance', mix: 'full', leadIn: 'fanfare' });
  });

  it('keeps a recorded theme playing through the scores', () => {
    expect(cueFor('oogiri', 'score')).toEqual({ song: 'monkeys', mix: 'full' });
    expect(cueFor('last-train', 'score')).toEqual({ song: 'score', mix: 'full' });
  });

  it("plays each mode's theme, under the players' voices while they answer", () => {
    expect(cueFor('word-gauntlet', 'prompt')).toEqual({ song: 'investigations', mix: 'full' });
    expect(cueFor('onsen-murder', 'answer')).toEqual({ song: 'sneaky', mix: 'under' });
    expect(cueFor('kana-raid', 'reveal')).toEqual({ song: 'raid', mix: 'under', sting: 'reveal' });
    expect(cueFor('kana-raid', 'finale')).toEqual({ song: 'raid', mix: 'under' });
    expect(cueFor('last-train', 'finale')).toEqual({ song: 'finale', mix: 'under' });
  });

  it('drops under the stage reading Japanese aloud', () => {
    expect(cueFor('onsen-murder', 'prompt').mix).toBe('under');
    expect(cueFor('concentration', 'prompt').mix).toBe('under');
    expect(cueFor('oekaki', 'score').mix).toBe('under');
    expect(cueFor('oogiri', 'prompt').mix).toBe('under');
  });

  it('only rolls a drum for a reveal that is a reveal', () => {
    expect(cueFor('concentration', 'reveal').sting).toBeUndefined();
    expect(cueFor('last-train', 'reveal').sting).toBeUndefined();
    expect(cueFor('onsen-murder', 'reveal').sting).toBeUndefined();
    expect(cueFor('onsen-murder', 'finale').sting).toBe('reveal');
    expect(cueFor('oogiri', 'reveal').sting).toBe('reveal');
  });

  it("doesn't restart the music for an encore", () => {
    expect(cueFor('oogiri', 'encore')).toEqual({ song: 'monkeys', mix: 'under', keep: true });
  });

  it('leaves Karaoke Duel to its own backing track while someone sings, and fills the gaps between', () => {
    expect(MODE_THEMES['karaoke-duel']).toBeNull();
    expect(cueFor('karaoke-duel', 'answer').song).toBeNull();
    expect(cueFor('karaoke-duel', 'intro')).toEqual({ song: 'gentle', mix: 'full', leadIn: 'ident' });
    expect(cueFor('karaoke-duel', 'reveal').mix).toBe('under');
    expect(cueFor('karaoke-duel', 'finale').song).toBe('finale');
  });

  it('keeps Shodō Taikai calm, with a recorded track for the gallery', () => {
    for (const phase of ['prompt', 'score', 'answer', 'reveal'] as const) expect(cueFor('shodo', phase)).toEqual({ song: 'gentle', mix: 'under', keep: true });
    expect(cueFor('shodo', 'answer', 0, true).mix).toBe('listen');
    // Full while the big sheets are written, under once players start saying their sentence.
    expect(cueFor('shodo', 'encore')).toEqual({ song: 'japanese-lofi', mix: 'full' });
    expect(cueFor('shodo', 'encore', 0, false, true)).toEqual({ song: 'japanese-lofi', mix: 'under' });
    expect(saying({ mode: 'shodo', phase: 'encore', game: { mode: 'shodo', finished: 0 } } as never)).toBe(false);
    expect(saying({ mode: 'shodo', phase: 'encore', game: { mode: 'shodo', finished: 1 } } as never)).toBe(true);
    expect(cueFor('shodo', 'finale')).toEqual({ song: 'japanese-lofi', mix: 'full', keep: true });
    expect(cueFor('shodo', 'penalty').mix).toBe('under');
    expect(cueFor('shodo', 'reveal').sting).toBeUndefined();
    expect(listening({ mode: 'shodo', phase: 'answer', game: { mode: 'shodo', itemKind: 'dictation' } } as never)).toBe(true);
    expect(listening({ mode: 'shodo', phase: 'answer', game: { mode: 'shodo', itemKind: 'recall' } } as never)).toBe(false);
  });

  it('opens every game with the house ident', () => {
    for (const mode of MODE_IDS) expect(cueFor(mode, 'intro').leadIn).toBe('ident');
  });

  it('alternates each game between its two themes', () => {
    for (const [mode, alt] of Object.entries(MODE_ALT_THEMES)) {
      const m = mode as keyof typeof MODE_THEMES;
      expect(themeFor(m, 0)).toBe(MODE_THEMES[m]);
      expect(themeFor(m, 1)).toBe(alt);
      expect(themeFor(m, 2)).toBe(MODE_THEMES[m]);
      expect(cueFor(m, 'prompt', 1).song).toBe(alt);
    }
    expect(new Set(Object.values(MODE_ALT_THEMES)).size).toBe(Object.keys(MODE_ALT_THEMES).length);
  });

  it("drops further for Kana Raid's listening waves", () => {
    const raid = (wave: number, phase: 'answer' | 'prompt' = 'answer') => ({ mode: 'kana-raid' as const, phase, game: { mode: 'kana-raid', wave } as never });
    expect(listening(raid(1))).toBe(false);
    expect(listening(raid(2))).toBe(true);
    expect(listening(raid(3))).toBe(true);
    expect(listening(raid(2, 'prompt'))).toBe(false);
    expect(cueFor('kana-raid', 'answer', 0, true).mix).toBe('listen');
  });
});
