import { describe, expect, it } from 'vitest';
import { MODE_IDS, PHASES } from '../shared/src/protocol.js';
import { MODE_THEMES, cueFor } from '../stage/src/music/cues.js';
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
  it('plays pop in the lobby and the recap', () => {
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

  it('leaves Karaoke Duel to its own backing track', () => {
    expect(MODE_THEMES['karaoke-duel']).toBeNull();
    for (const phase of PHASES.filter((p) => p !== 'lobby' && p !== 'recap')) expect(cueFor('karaoke-duel', phase).song).toBeNull();
  });
});
