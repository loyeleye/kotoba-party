// Karaoke Duel lyric sets by audience (shared/src/modes/karaokeDuel/lyrics/): every set fits its
// version's melody and track mora for mora, never sings the song's title, and every recorded take
// has kids, family and cheeky words. Run one song's checks with `npx vitest run tests/karaokeLyrics.test.ts -t <group>`.

import { describe, expect, it } from 'vitest';
import { isKana } from '../shared/src/japanese/kana.js';
import { LYRIC_SETS, lyricSetsOf } from '../shared/src/modes/karaokeDuel/lyrics/index.js';
import { melodyFrames, scoreTake } from '../shared/src/modes/karaokeDuel/scoring.js';
import { AUDIENCES, lineMs, romajiMorae, SONGS, splitMorae, withLyrics, type Song, type SongLine } from '../shared/src/modes/karaokeDuel/songs.js';
import { parseChord } from '../stage/src/music/songs.js';
import { TRACKS } from '../stage/src/music/tracks.js';

const beats = (line: Pick<SongLine, 'melody'>) => line.melody.reduce((n, [, b]) => n + b, 0);
const perfect = (line: SongLine, bpm: number) => ({ utterance: { via: 'speech' as const, text: line.kana }, pitch: melodyFrames(line, bpm, 0), onsetMs: 0, durMs: lineMs(line, bpm), timing: 'mic' as const });
/** Kana with spaces and punctuation gone, so a title can't hide behind a word break. */
const bare = (kana: string) => [...kana].filter((c) => isKana(c)).join('');
const groups = [...new Set(Object.keys(LYRIC_SETS).map((id) => SONGS.find((s) => s.id === id)?.group ?? id))];
const isMureka = (song: Song) => !!song.track && TRACKS[song.track.id as keyof typeof TRACKS]?.licence === 'Mureka';

describe('Karaoke Duel: lyric sets', () => {
  it('belong to continuous versions, with ids that name the version and audience', () => {
    for (const [songId, sets] of Object.entries(LYRIC_SETS)) {
      const song = SONGS.find((s) => s.id === songId);
      expect(song?.form, songId).toBeTruthy();
      for (const set of sets) {
        expect(AUDIENCES).toContain(set.audience);
        expect(set.id.startsWith(`${songId}:${set.audience}`), set.id).toBe(true);
        expect(set.status).toBe('draft');
        expect(set.about.length).toBeGreaterThan(0);
      }
      expect(new Set(sets.map((x) => x.id)).size, songId).toBe(sets.length);
    }
  });

  it.each(groups)('%s: every line has one note and one romaji syllable per mora, in the version’s time', (group) => {
    for (const song of SONGS.filter((s) => (s.group ?? s.id) === group)) {
      for (const set of lyricSetsOf(song.id)) {
        expect(set.lines.length, set.id).toBe(song.lines.length);
        const sung = withLyrics(song, set);
        for (const [i, line] of sung.lines.entries()) {
          const where = `${set.id} line ${i}: ${line.kana}`;
          const morae = splitMorae(line.kana);
          expect(isKana(line.kana), where).toBe(true);
          expect(line.melody.length, where).toBe(morae.length);
          expect(romajiMorae(line).length, `${where} / ${line.romaji}`).toBe(morae.length);
          expect(line.en.length, where).toBeGreaterThan(0);
          // A new rhythm keeps the line's length, so it still fits its bars of the track.
          if (set.lines[i]!.melody) expect(beats(line), where).toBe(beats(song.lines[i]!));
          for (const [midi, b] of line.melody) {
            expect(midi).toBeGreaterThanOrEqual(48);
            expect(midi).toBeLessThanOrEqual(84);
            expect(b).toBeGreaterThan(0);
          }
          expect(scoreTake(line, sung.bpm, lineMs(line, sung.bpm), perfect(line, sung.bpm), 'n5').quality, where).toBe(100);
          for (const chord of line.chords?.split(/\s+/) ?? []) expect(() => parseChord(chord), chord).not.toThrow();
        }
      }
    }
  });

  it.each(groups)('%s: no lyric set sings the song’s title', (group) => {
    for (const song of SONGS.filter((s) => (s.group ?? s.id) === group)) {
      const title = bare(song.title.kana);
      for (const set of lyricSetsOf(song.id)) for (const line of set.lines) expect(bare(line.kana).includes(title), `${set.id}: ${line.kana}`).toBe(false);
    }
  });

  it('every recorded take has kids, family and cheeky words', () => {
    const takes = new Map<string, Song[]>();
    for (const song of SONGS.filter(isMureka)) takes.set(song.track!.id, [...(takes.get(song.track!.id) ?? []), song]);
    expect(takes.size).toBeGreaterThan(0);
    for (const [track, versions] of takes) {
      const sets = versions.flatMap((v) => lyricSetsOf(v.id));
      for (const audience of ['kids', 'cheeky'] as const) expect(sets.some((x) => x.audience === audience), `${track}: ${audience}`).toBe(true);
    }
  });
});
