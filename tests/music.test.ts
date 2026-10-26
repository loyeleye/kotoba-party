import { describe, expect, it } from 'vitest';
import { MODE_IDS, PHASES } from '../shared/src/protocol.js';
import { MODE_THEMES, cueFor } from '../stage/src/music/cues.js';
import { SONGS, SONG_IDS, compile, leadLength, noteToMidi, parseChord, parseLead } from '../stage/src/music/songs.js';

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
      for (const id of [cue.song, cue.leadIn, cue.sting]) if (id) expect(SONG_IDS).toContain(id);
    }
  });
});

describe('cues', () => {
  it('plays the lobby tune in the lobby and a fanfare into the recap', () => {
    expect(cueFor(null, 'lobby')).toEqual({ song: 'lobby', mix: 'full' });
    expect(cueFor('oogiri', 'recap')).toEqual({ song: 'outro', mix: 'full', leadIn: 'fanfare' });
  });

  it("plays each mode's theme, under the players' voices while they answer", () => {
    expect(cueFor('onsen-murder', 'prompt')).toEqual({ song: 'mystery', mix: 'full' });
    expect(cueFor('onsen-murder', 'answer')).toEqual({ song: 'mystery', mix: 'under' });
    expect(cueFor('kana-raid', 'reveal')).toEqual({ song: 'battle', mix: 'under', sting: 'reveal' });
    expect(cueFor('last-train', 'finale')).toEqual({ song: 'finale', mix: 'under' });
  });

  it("doesn't restart the music for an encore", () => {
    expect(cueFor('oogiri', 'encore')).toEqual({ song: 'festive', mix: 'under', keep: true });
  });

  it('leaves Karaoke Duel to its own backing track', () => {
    expect(MODE_THEMES['karaoke-duel']).toBeNull();
    for (const phase of PHASES.filter((p) => p !== 'lobby' && p !== 'recap')) expect(cueFor('karaoke-duel', phase).song).toBeNull();
  });
});
