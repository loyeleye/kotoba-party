// The shared mixed-room pieces: Gallery tiles and the curveball, the booth's lit key word, the host stand-in.
import { describe, expect, it, onTestFinished } from 'vitest';
import { POINTS_PER_VOTE } from '../shared/src/constants.js';
import { TIP_POINTS, TIPS } from '../shared/src/modes/bentoHaus/bentoHaus.js';
import { GUESS_POINTS } from '../shared/src/modes/dubClub/dubClub.js';
import { withExperiments } from '../shared/src/modes/experiments.js';
import { RULES } from '../shared/src/modes/lastTrain/lastTrain.js';
import { PAIR_POINTS } from '../shared/src/modes/narabete/narabete.js';
import { POINTS as ONSEN } from '../shared/src/modes/onsenMurder/onsenMurder.js';
import type { PhraseEntry } from '../shared/src/modes/mode.js';
import { armCurveball, BASIC_POINTS, commentaryMs, curveballPoints, keyHeld, CURVEBALL_POINTS, galleryBubbles, galleryTileFor, gistFor, hostStandsIn, lightUp, openGallery, pickGallery, reactionSaid, SAY_PICK, SPOKEN_REACTION_POINTS } from '../shared/src/modes/mixedRoom.js';

describe('Gallery', () => {
  it.each([true, false])('gives one reaction per player and one curveball to a Kana or N5 player (experiments: %s)', (on) => {
    // With no game named, the curveball is +5 either way; the tiles carry `say` only with spokenReaction on.
    onTestFinished(withExperiments({ spokenReaction: on, scaledCurveball: on }));
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
    if (on) expect(galleryTileFor(g, 'c', 'n5')).toMatchObject({ say: { said: false, missed: false } });
    else expect(galleryTileFor(g, 'c', 'n5')).not.toHaveProperty('say');
    expect(galleryTileFor(g, 'n4', 'n4')).toBeNull();
    expect(g).not.toHaveProperty('said');
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

describe('curveball distractors', () => {
  it('never offers a word the line also contained', () => {
    for (let seed = 0; seed < 12; seed++) {
      const g = openGallery(['b'], ['b'], { word: 'ので', pool: ['のに', 'から', 'けど', 'まで'], heard: 'あるいたけど、つかれたので、やすみました' }, false, seed);
      expect(g.curveball!.options.map((o) => o.kana)).not.toContain('けど');
      const o = openGallery(['b'], ['b'], { word: 'ございます', heard: 'ありがとうございました' }, false, seed);
      expect(o.curveball?.options.some((x) => x.kana === 'ございます' && x.correct)).toBe(true);
    }
  });
});

describe('curveball with a pool of seven', () => {
  it('still deals two different distractors', () => {
    const pool = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'ので'];
    for (let seed = 0; seed < 14; seed++) expect(openGallery(['b'], ['b'], { word: 'ので', pool }, false, seed).curveball?.options).toHaveLength(3);
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

describe('spokenReaction: saying a Gallery reaction', () => {
  const speech = (text: string, reading?: string) => ({ via: 'speech' as const, text, reading });

  it('matches each tile as said, with a little ending, kanji (by reading) or a doubled word; not other words', () => {
    expect(reactionSaid(speech('すごい'))?.id).toBe('sugoi');
    expect(reactionSaid(speech('すごいね！'))?.id).toBe('sugoi');
    expect(reactionSaid(speech('すごいすごい'))?.id).toBe('sugoi');
    expect(reactionSaid(speech('凄い', 'すごい'))?.id).toBe('sugoi');
    expect(reactionSaid(speech('なるほどね'))?.id).toBe('naruhodo');
    expect(reactionSaid(speech('へー'))?.id).toBe('e');
    expect(reactionSaid(speech('へぇ'))?.id).toBe('e');
    expect(reactionSaid(speech('頑張れ', 'がんばれ'))?.id).toBe('warai');
    expect(reactionSaid(speech('ガンバレー'))?.id).toBe('warai');
    expect(reactionSaid(speech('ありがとう'))).toBeNull();
    expect(reactionSaid(speech('すごいですね、ほんとうに'))).toBeNull();
    expect(reactionSaid(speech('へ'))).toBeNull();
    expect(reactionSaid(speech(''))).toBeNull();
  });

  it('on: a match picks the tile for SPOKEN_REACTION_POINTS and logs it as said, read; a miss changes nothing but the hint', () => {
    onTestFinished(withExperiments({ spokenReaction: true }));
    const g = openGallery(['a', 'b'], ['b'], { word: 'ので' }, false, 0);
    const logged: PhraseEntry[] = [];
    const phrase = (e: PhraseEntry) => logged.push(e);
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('ありがとう'), phrase })).toBe(0);
    expect(g.picks).toEqual({});
    expect(galleryTileFor(g, 'a', 'n4')).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: true } });
    // Only speech: a typed or missing utterance is refused (tap the tile instead).
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: { via: 'typed', text: 'すごい' }, phrase })).toBeNull();
    expect(pickGallery(g, 'a', SAY_PICK, { phrase })).toBeNull();
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('すごい！'), phrase })).toBe(SPOKEN_REACTION_POINTS);
    expect(SPOKEN_REACTION_POINTS).toBe(2);
    expect(galleryTileFor(g, 'a', 'n4')).toMatchObject({ picked: 'sugoi', say: { said: true, missed: false } });
    expect(galleryBubbles(g)).toEqual([expect.objectContaining({ id: 'sugoi', said: true })]);
    expect(logged).toEqual([{ itemId: 'gallery-sugoi', text: 'すごい！', kana: 'すごい！', en: 'Amazing!', outcome: 'said', recall: 'read' }]);
    // One a round, said or tapped; the curveball player can't say a reaction in place of their answer.
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('なるほど') })).toBeNull();
    expect(pickGallery(g, 'a', 'naruhodo')).toBeNull();
    expect(pickGallery(g, 'b', SAY_PICK, { utterance: speech('すごい') })).toBeNull();
    // A tapped bubble isn't marked said.
    const t = openGallery(['c'], [], null, false, 0);
    pickGallery(t, 'c', 'e');
    expect(galleryBubbles(t)[0]).not.toHaveProperty('said');
  });

  it('off: a said reaction is refused, tiles carry no mic, and taps work as before', () => {
    onTestFinished(withExperiments({ spokenReaction: false }));
    const g = openGallery(['a'], [], null, false, 0);
    const logged: PhraseEntry[] = [];
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('すごい'), phrase: (e) => logged.push(e) })).toBeNull();
    expect(g).toEqual({ players: ['a'], picks: {}, curveball: null });
    expect(galleryTileFor(g, 'a', 'n5')).toEqual({ kind: 'react', picked: null, tiles: expect.any(Array) });
    expect(pickGallery(g, 'a', 'sugoi')).toBe(0);
    expect(logged).toEqual([]);
  });
});

describe('scaledCurveball: the curveball pays about a tenth of the game\'s basic right answer', () => {
  it('copies each game\'s basic right answer correctly', () => {
    expect(BASIC_POINTS).toEqual({
      'bento-haus': TIPS.perfect * TIP_POINTS,
      'last-train': RULES.pointsFirstTry,
      'onsen-murder': ONSEN.accuse,
      omiai: POINTS_PER_VOTE,
      'dub-club': GUESS_POINTS,
      narabete: PAIR_POINTS,
    });
  });

  it('on: a tenth, rounded to 5; with no game named, +5', () => {
    onTestFinished(withExperiments({ scaledCurveball: true }));
    expect(curveballPoints('bento-haus')).toBe(15);
    expect(curveballPoints('last-train')).toBe(10);
    expect(curveballPoints('onsen-murder')).toBe(30);
    expect(curveballPoints('omiai')).toBe(10);
    expect(curveballPoints('dub-club')).toBe(5);
    expect(curveballPoints('narabete')).toBe(10);
    expect(curveballPoints()).toBe(CURVEBALL_POINTS);
    const g = openGallery(['b'], ['b'], { word: 'ので' }, false, 0);
    expect(pickGallery(g, 'b', 'ので', { game: 'onsen-murder' })).toBe(30);
    // The phone's "Yes! +N" reads what was paid.
    expect(galleryTileFor(g, 'b', 'n5')).toMatchObject({ kind: 'curveball', right: true, paid: 30 });
  });

  it('off: +5 in every game, and the phone falls back to +5', () => {
    onTestFinished(withExperiments({ scaledCurveball: false }));
    for (const game of Object.keys(BASIC_POINTS) as (keyof typeof BASIC_POINTS)[]) expect(curveballPoints(game)).toBe(5);
    const g = openGallery(['b'], ['b'], { word: 'ので' }, false, 0);
    expect(pickGallery(g, 'b', 'ので', { game: 'onsen-murder' })).toBe(5);
    expect(g.curveball).not.toHaveProperty('paid');
    expect(galleryTileFor(g, 'b', 'n5')).not.toHaveProperty('paid');
  });
});
