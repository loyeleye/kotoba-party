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
import { armCurveball, BASIC_POINTS, commentaryMs, curveballPoints, dealStandIn, keyHeld, KEY_GLOSS, CURVEBALL_POINTS, galleryBubbles, galleryTileFor, gistFor, hostStandsIn, landGallery, lightUp, openGallery, openStandInGallery, pickGallery, reactionSaid, SAY_PICK, setupKana, SPOKEN_REACTION_POINTS, STAND_IN_SETUP_MS, standInSetupFor, standInSetupMs, standInVoiceMs } from '../shared/src/modes/mixedRoom.js';
import { hostLines } from '../content/src/hosts/index.js';
import { lastTrainMinigames } from '../content/src/last-train/index.js';
import { BOOTH_KEYS } from '../shared/src/modes/bentoHaus/hardRoles.js';
import { EPISODES } from '../shared/src/modes/dubClub/scenes.js';
import { roleKey } from '../shared/src/modes/lastTrain/lastTrain.js';
import { DEFENCE_KEY } from '../shared/src/modes/narabete/narabete.js';
import { NAKODO_KEYS } from '../shared/src/modes/omiai/cards.js';

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

describe('the curveball teaches the meaning', () => {
  it('shows the answer in romaji and its gloss once picked, and saves the word as seen', () => {
    const g = openGallery(['b'], ['b'], { word: 'ので' }, false, 0);
    expect(g.curveball?.en).toBe('so, because');
    expect(galleryTileFor(g, 'b', 'n5')).toMatchObject({ answerRomaji: null, gloss: null });
    const logged: PhraseEntry[] = [];
    const wrong = g.curveball!.options.find((o) => !o.correct)!.kana;
    expect(pickGallery(g, 'b', wrong, { phrase: (e) => logged.push(e) })).toBe(0);
    expect(galleryTileFor(g, 'b', 'n5')).toMatchObject({ right: false, answer: 'ので', answerRomaji: 'node', gloss: 'so, because' });
    expect(logged).toEqual([{ itemId: 'curveball-ので', text: 'ので', kana: 'ので', en: 'so, because', outcome: 'seen' }]);
  });

  it('takes the key\'s own English over the gloss, and logs nothing without either', () => {
    expect(openGallery(['b'], ['b'], { word: 'ので', en: 'since' }, false, 0).curveball?.en).toBe('since');
    const g = openGallery(['b'], ['b'], { word: 'あいうえ', pool: ['かきくけ', 'さしすせ'] }, false, 0);
    expect(g.curveball).not.toHaveProperty('en');
    const logged: PhraseEntry[] = [];
    pickGallery(g, 'b', 'あいうえ', { phrase: (e) => logged.push(e) });
    expect(logged).toEqual([]);
    expect(galleryTileFor(g, 'b', 'kana')).toMatchObject({ answerRomaji: 'aiue', gloss: null });
  });

  it('has a gloss for every key word the six games light', () => {
    const keys = new Set<string>([
      ...BOOTH_KEYS, // Bento Haus
      ...lastTrainMinigames.flatMap((m) => m.items).flatMap((i) => (i.role ? [roleKey(i)?.kana ?? ''] : [])).filter(Boolean), // Last Train
      'いっていました', 'みられました', // Murder at the Onsen (keyWord)
      ...NAKODO_KEYS, // Omiai
      ...EPISODES.flatMap((e) => e.scenes).flatMap((sc) => [sc.adlib, sc.cheekyAdlib]).flatMap((a) => a?.keys ?? []).filter((k) => k.length >= 3), // Dub Club (curveballKey)
      DEFENCE_KEY, // Narabete!
    ]);
    expect([...keys].filter((k) => !KEY_GLOSS[k])).toEqual([]);
  });

  it('puts romaji and English under the reaction tiles at Kana level, English only above', () => {
    const g = openGallery(['a'], [], null, false, 0);
    const kana = galleryTileFor(g, 'a', 'kana');
    const n5 = galleryTileFor(g, 'a', 'n5');
    expect(kana?.kind === 'react' && kana.tiles.map((t) => t.romaji)).toEqual(['Sugoi!', 'naruhodo', 'Hē!', 'Ganbare!']);
    expect(n5?.kind === 'react' && n5.tiles.every((t) => !t.romaji && !!t.en)).toBe(true);
  });
});

describe('stand-in curveball: a quick tap doesn\'t cost it', () => {
  const seats = [{ id: 'a', level: 'kana' as const }, { id: 'b', level: 'n5' as const }];

  it('goes to a player who hasn\'t reacted first, then to one who has', () => {
    const sg = openStandInGallery(seats, false, 0, 1_000, 2_000)!;
    pickGallery(sg.g, 'a', 'sugoi');
    expect(dealStandIn(sg, seats, { word: 'ので' }, false, 0, 1_000)).toBe(true);
    expect(sg.g.curveball?.playerId).toBe('b');
    expect(sg.g.landed).toBe(true);

    const both = openStandInGallery(seats, false, 0, 1_000, 2_000)!;
    pickGallery(both.g, 'a', 'sugoi');
    pickGallery(both.g, 'b', 'e');
    expect(dealStandIn(both, seats, { word: 'ので' }, false, 0, 1_000)).toBe(true);
    expect(['a', 'b']).toContain(both.g.curveball?.playerId);
    // Their reaction stays on the TV, and the curveball is still theirs to answer.
    expect(galleryBubbles(both.g)).toHaveLength(2);
    expect(galleryTileFor(both.g, both.g.curveball!.playerId, 'n5')).toMatchObject({ kind: 'curveball', picked: null });
    expect(pickGallery(both.g, both.g.curveball!.playerId, 'ので')).toBe(CURVEBALL_POINTS);
  });

  it('mixed rooms keep the rule: nobody who has reacted gets it', () => {
    const g = openGallery(['a', 'b'], ['a', 'b'], null, false, 0);
    pickGallery(g, 'a', 'sugoi');
    pickGallery(g, 'b', 'e');
    expect(armCurveball(g, ['a', 'b'], { word: 'ので' }, false, 0)).toBe(false);
    expect(armCurveball(g, ['a', 'b'], { word: 'ので' }, false, 0, { evenIfReacted: true })).toBe(true);
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
  it('waits for the setup line by its length, never under 2.5 s', () => {
    expect(standInSetupMs('')).toBe(STAND_IN_SETUP_MS);
    expect(standInSetupMs('ドロン！')).toBe(STAND_IN_SETUP_MS);
    const long = 'あ'.repeat(16);
    expect(standInSetupMs(long)).toBe(standInVoiceMs(long));
    expect(standInSetupMs(long)).toBeGreaterThan(STAND_IN_SETUP_MS);
    // From the bank: the longest line of the event, the floor when there's none.
    const line = (event: string, kana: string) => ({ id: `${event}.${kana}`, host: 'pon', event, jp: { text: kana, kana, en: '' }, status: 'draft' }) as (typeof hostLines)[number];
    const bank = [line('x_standin_setup', 'あいう'), line('x_standin_setup', long), line('y', 'あ'.repeat(40))];
    expect(setupKana(bank, 'x_standin_setup')).toBe(long);
    expect(standInSetupFor(bank, 'x_standin_setup')).toBe(standInVoiceMs(long));
    expect(standInSetupFor(bank, 'none')).toBe(STAND_IN_SETUP_MS);
  });

  it('keeps every setup line to 16 kana or fewer', () => {
    const setups = hostLines.filter((l) => /_stand_?in_setup$/.test(l.event));
    expect(setups.length).toBeGreaterThanOrEqual(6);
    const long = setups.filter((l) => l.jp.kana.replace(/[\s　。、！？…「」]/g, '').length > 16).map((l) => l.id);
    expect(long).toEqual([]);
  });

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

  it('matches a stretched vowel or small っ inside the word, 〜 as ー, polite endings and がんばって', () => {
    for (const said of ['すごーい', 'すご〜い', 'すご～い', 'すっごい', 'すごいです', 'すごいですね', 'すごーいですね']) expect(reactionSaid(speech(said))?.id, said).toBe('sugoi');
    for (const said of ['なーるほど', 'なるほどです']) expect(reactionSaid(speech(said))?.id, said).toBe('naruhodo');
    for (const said of ['へ〜', 'へぇ〜', 'へ~', 'へええ']) expect(reactionSaid(speech(said))?.id, said).toBe('e');
    for (const said of ['がんばって', 'がんばってください', '頑張ってください']) expect(reactionSaid(speech(said, said === '頑張ってください' ? 'がんばってください' : undefined))?.id, said).toBe('warai');
    for (const said of ['へ', 'すし', 'すごいですね、ほんとうに', 'なる', 'がんばる']) expect(reactionSaid(speech(said)), said).toBeNull();
  });

  it('takes a said reaction only once the line has landed; a tap any time', () => {
    onTestFinished(withExperiments({ spokenReaction: true }));
    const g = openGallery(['a', 'b'], ['b'], null, false, 0);
    expect(g).not.toHaveProperty('landed');
    // While the line is being said: no 🎤 on the tile, and a said reaction is refused (not even a miss).
    expect(galleryTileFor(g, 'a', 'n5')).not.toHaveProperty('say');
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('すごい') })).toBeNull();
    expect(g.picks).toEqual({});
    expect(pickGallery(g, 'b', 'naruhodo')).toBe(0);
    // The line lands (armCurveball marks it, curveball or not): now it may be said.
    expect(armCurveball(g, ['b'], { word: 'ので' }, false, 0)).toBe(false);
    expect(g.landed).toBe(true);
    expect(galleryTileFor(g, 'a', 'n5')).toMatchObject({ say: { said: false, missed: false } });
    expect(pickGallery(g, 'a', SAY_PICK, { utterance: speech('すごい') })).toBe(SPOKEN_REACTION_POINTS);
    // landGallery, for a game that lands its line without armCurveball; and armCurveball even when used.
    const h = openGallery(['c'], [], null, false, 0);
    landGallery(h);
    expect(h.landed).toBe(true);
    const u = openGallery(['c'], ['c'], null, true, 0);
    armCurveball(u, ['c'], null, true, 0);
    expect(u.landed).toBe(true);
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
      'onsen-murder': ONSEN.clue,
      omiai: POINTS_PER_VOTE,
      'dub-club': GUESS_POINTS,
      narabete: PAIR_POINTS,
    });
  });

  it('on: a tenth, rounded to 5; with no game named, +5', () => {
    onTestFinished(withExperiments({ scaledCurveball: true }));
    expect(curveballPoints('bento-haus')).toBe(15);
    expect(curveballPoints('last-train')).toBe(10);
    // Onsen's base is a clue (100), so the tap never out-pays an understood question (20).
    expect(curveballPoints('onsen-murder')).toBe(10);
    expect(curveballPoints('omiai')).toBe(10);
    expect(curveballPoints('dub-club')).toBe(5);
    expect(curveballPoints('narabete')).toBe(10);
    expect(curveballPoints()).toBe(CURVEBALL_POINTS);
    const g = openGallery(['b'], ['b'], { word: 'ので' }, false, 0);
    expect(pickGallery(g, 'b', 'ので', { game: 'onsen-murder' })).toBe(10);
    // The phone's "Yes! +N" reads what was paid.
    expect(galleryTileFor(g, 'b', 'n5')).toMatchObject({ kind: 'curveball', right: true, paid: 10 });
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
