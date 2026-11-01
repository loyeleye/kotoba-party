// The shared mixed-room pieces: Gallery tiles and the curveball, the booth's lit key word, the host stand-in.
import { describe, expect, it } from 'vitest';
import { armCurveball, commentaryMs, keyHeld, CURVEBALL_POINTS, galleryBubbles, galleryTileFor, gistFor, hostStandsIn, lightUp, openGallery, pickGallery } from '../shared/src/modes/mixedRoom.js';

describe('Gallery', () => {
  it('gives one reaction per player and one curveball to a Kana or N5 player', () => {
    const g = openGallery(['a', 'b', 'c'], ['b', 'c'], { word: 'ので' }, false, 0);
    expect(g.curveball?.playerId).toBe('b');
    expect(g.curveball!.options).toHaveLength(3);
    expect(g.curveball!.options.filter((o) => o.correct).map((o) => o.kana)).toEqual(['ので']);
    expect(pickGallery(g, 'a', 'sugoi')).toBe(0);
    expect(pickGallery(g, 'a', 'warai')).toBeNull();
    expect(pickGallery(g, 'b', 'ので')).toBe(CURVEBALL_POINTS);
    expect(pickGallery(g, 'b', 'ので')).toBeNull();
    expect(pickGallery(g, 'z', 'sugoi')).toBeNull();
    expect(galleryBubbles(g).map((t) => t.id)).toEqual(['sugoi']);
    expect(galleryTileFor(g, 'b', 'kana')).toMatchObject({ kind: 'curveball', right: true });
    expect(galleryTileFor(g, 'c', 'n5')).toMatchObject({ kind: 'react', picked: null });
    expect(galleryTileFor(g, 'n4', 'n4')).toBeNull();
  });

  it('has no curveball once used, without a key word, or without Kana/N5 players', () => {
    expect(openGallery(['a', 'b'], ['b'], { word: 'ので' }, true, 0).curveball).toBeNull();
    expect(openGallery(['a', 'b'], ['b'], null, false, 0).curveball).toBeNull();
    expect(openGallery(['a'], [], { word: 'ので' }, false, 0).curveball).toBeNull();
  });

  it('shows romaji on curveball options for Kana players only', () => {
    const g = openGallery(['b'], ['b'], { word: 'から' }, false, 2);
    const kana = galleryTileFor(g, 'b', 'kana');
    const n5 = galleryTileFor(g, 'b', 'n5');
    expect(kana?.kind === 'curveball' && kana.options.every((o) => !!o.romaji)).toBe(true);
    expect(n5?.kind === 'curveball' && n5.options.every((o) => o.romaji === null)).toBe(true);
  });
});

describe('armCurveball', () => {
  it('deals once the line lands, to a Kana or N5 player who has not reacted', () => {
    const g = openGallery(['a', 'b', 'c'], ['b', 'c'], null, false, 0);
    expect(g.curveball).toBeNull();
    pickGallery(g, 'b', 'sugoi');
    expect(armCurveball(g, ['b', 'c'], { word: 'ので' }, false, 3)).toBe(true);
    expect(g.curveball?.playerId).toBe('c');
    expect(keyHeld(g)).toBe(true);
    pickGallery(g, 'c', 'ので');
    expect(keyHeld(g)).toBe(false);
    expect(armCurveball(g, ['b', 'c'], { word: 'ので' }, false, 3)).toBe(false);
  });
  it('deals none without a key, once used, or when every Kana/N5 player has reacted', () => {
    const g = openGallery(['a', 'b'], ['b'], null, false, 0);
    expect(armCurveball(g, ['b'], null, false, 0)).toBe(false);
    expect(armCurveball(g, ['b'], { word: 'ので' }, true, 0)).toBe(false);
    pickGallery(g, 'b', 'sugoi');
    expect(armCurveball(g, ['b'], { word: 'ので' }, false, 0)).toBe(false);
    expect(armCurveball(null, ['b'], { word: 'ので' }, false, 0)).toBe(false);
  });
});

describe('commentary booth', () => {
  it('lights the first key word, the longest at a tie', () => {
    expect(lightUp('あめなので、かさです。', ['ので', 'なので'])).toEqual({ before: 'あめ', key: 'なので', after: '、かさです。' });
    expect(lightUp('かさです。', ['ので'])).toEqual({ before: 'かさです。', key: '', after: '' });
  });
  it('runs 5–7 s and gives the gist below N4 only', () => {
    expect(commentaryMs({ text: 'a', kana: 'あ', en: '' })).toBe(5_000);
    expect(commentaryMs({ text: 'a', kana: 'あ'.repeat(80), en: '' })).toBe(7_000);
    const c = { playerId: 'a', line: { text: 'あ', kana: 'あ', en: 'a' }, voiced: true, lit: lightUp('あ', []), note: '', gist: { kana: 'かさ', en: 'umbrella', emoji: null }, ms: 5_000 };
    expect(gistFor(c, 'n4')).toBeNull();
    expect(gistFor(c, 'kana')?.romaji).toBe('kasa');
    expect(gistFor(c, 'n5')?.romaji).toBeNull();
  });
});

describe('host stand-in', () => {
  it('only in a 1–2-player room with nobody at N4', () => {
    expect(hostStandsIn(['n5'])).toBe(true);
    expect(hostStandsIn(['kana', 'n5'])).toBe(true);
    expect(hostStandsIn(['n4', 'n5'])).toBe(false);
    expect(hostStandsIn(['n5', 'n5', 'kana'])).toBe(false);
    expect(hostStandsIn([])).toBe(false);
  });
});
