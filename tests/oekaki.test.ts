import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level, TopicPack } from '../content/src/types.js';
import { FRAME_BY_ID, framesOf } from '../shared/src/japanese/frames.js';
import { normalizeReading } from '../shared/src/japanese/kana.js';
import { SENTENCE_BY_ID, SENTENCES, sentenceText, sentencesFor } from '../shared/src/modes/oekaki/sentences.js';
import { createRoom, type CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { INK_LIMITS, readInk, thinToLimits, type InkPoint } from '../shared/src/japanese/strokes.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { MIN_INK, OEKAKI_LIMITS, PALETTE, readDrawing } from '../shared/src/modes/oekaki/drawing.js';
import { buildTileFake, editDistance, readUtteranceFake, tooClose } from '../shared/src/modes/oekaki/fakes.js';
import {
  FAKE_SPOKEN_BONUS,
  POINTS_ARTIST_PER_FINDER,
  POINTS_PER_FOOLED,
  POINTS_REAL_FOUND,
  SAY_SPOKEN_BONUS,
  type OekakiState,
  type OekakiView,
} from '../shared/src/modes/oekaki/oekaki.js';
import { dealPrompt, dealTiles, markUsed, NO_TILE, poolFor, shortEn, type Prompt } from '../shared/src/modes/oekaki/prompts.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { botScribble, oekakiPolicy } from '../tools/bots/policies/oekaki.js';
import { content as realContent, hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

const pack: TopicPack = {
  id: 'food',
  title: { text: '食べもの', kana: 'たべもの', en: 'Food' },
  blurb: 'test pack',
  words: [
    { id: 'food.sushi', jp: { text: 'すし', kana: 'すし', en: 'sushi' }, pos: 'noun', level: 'kana' },
    { id: 'food.ramen', jp: { text: 'ラーメン', kana: 'ラーメン', en: 'ramen' }, pos: 'noun', level: 'kana' },
    { id: 'food.cake', jp: { text: 'ケーキ', kana: 'ケーキ', en: 'cake' }, pos: 'noun', level: 'kana' },
    { id: 'food.pan', jp: { text: 'パン', kana: 'パン', en: 'bread' }, pos: 'noun', level: 'kana' },
    { id: 'food.fish', jp: { text: '魚', kana: 'さかな', en: 'fish' }, pos: 'noun', level: 'n5' },
    { id: 'food.onigiri', jp: { text: 'おにぎり', kana: 'おにぎり', en: 'onigiri (rice ball)' }, pos: 'noun', level: 'n5' },
    { id: 'food.cat-chef', jp: { text: 'ねこの シェフ', kana: 'ねこの シェフ', en: 'a cat chef' }, pos: 'noun', level: 'kana', swerve: true },
    { id: 'food.ringo', jp: { text: 'りんご', kana: 'りんご', en: 'apple' }, pos: 'noun', level: 'kana' },
    { id: 'food.right', jp: { text: '右', kana: 'みぎ', en: 'right' }, pos: 'noun', level: 'n5', tags: ['directions'] },
    { id: 'food.ninja', jp: { text: 'にんじゃ', kana: 'にんじゃ', en: 'ninja' }, pos: 'noun', level: 'n5', stereotype: true },
    { id: 'food.eat', jp: { text: '食べる', kana: 'たべる', en: 'to eat' }, pos: 'verb-ru', level: 'n5' },
  ],
  phrases: [],
  baselineWordIds: ['food.ringo'],
  status: 'draft',
};
const fixture: ContentLibrary = { ...EMPTY_CONTENT, packs: [pack] };

let ids = 0;
const now = 1_000_000;
const gctx = (content: ContentLibrary = fixture, random: () => number = () => 0): GameContext => ({ now, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

function room(n: number, content = fixture, levels: Record<number, Level> = { 4: 'kana' }, random: () => number = () => 0) {
  const s = createGame('BCDF');
  const act = (a: GameAction) => apply(s, a, gctx(content, random));
  const cmd = (actor: ReturnType<typeof as> | typeof stage, command: CommandBody) =>
    apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, gctx(content, random));
  const play = (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move });
  const tick = () => act({ type: 'timeout', phaseSeq: s.phaseSeq });
  const ms = () => s.modeState as OekakiState;
  const view = (viewer: ReturnType<typeof as> | typeof stage) => viewFor(s, viewer, content).game as OekakiView;
  for (let i = 1; i <= n; i++) {
    act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: levels[i] ?? 'n5' });
    act({ type: 'connection', playerId: `p${i}`, connected: true });
  }
  return { s, act, cmd, play, tick, ms, view };
}

const score = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.score;

/** A drawing big enough to count: a square, then a diagonal in red. */
const square: InkPoint[][] = [
  [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]],
  [[0.2, 0.2], [0.8, 0.8]],
];
const draw = { kind: 'draw', strokes: square, colors: [0, 1] };

/** Starts a game and has everyone draw; lands on the first drawing's fake-title phase. */
function startAndDraw(r: ReturnType<typeof room>, n: number, extra: Partial<CommandBody> = {}) {
  r.cmd(stage, { type: 'start', mode: 'oekaki', packId: 'food', ...extra } as CommandBody);
  r.tick(); // intro → draw
  for (let i = 1; i <= n; i++) expect(r.play(`p${i}`, draw).changed).toBe(true);
  expect(r.s.phase).toBe('answer');
}

// ---- drawing data ----

describe('drawings on the wire', () => {
  it('reads strokes with palette colours and refuses anything malformed', () => {
    expect(readDrawing({ strokes: square, colors: [0, 5] })).toEqual({ strokes: square, colors: [0, 5] });
    expect(readDrawing({ strokes: square })!.colors).toEqual([0, 0]);
    expect(readDrawing({ strokes: square, colors: [0] })).toBeNull(); // one colour per stroke
    expect(readDrawing({ strokes: square, colors: [0, PALETTE.length] })).toBeNull();
    expect(readDrawing({ strokes: square, colors: [0, 1.5] })).toBeNull();
    expect(readDrawing({ strokes: square, colors: ['red', 0] })).toBeNull();
    expect(readDrawing({ strokes: 'a cat' })).toBeNull();
    expect(readDrawing(square)).toBeNull(); // not wrapped in { strokes }
    expect(readDrawing({ strokes: [[[0.5, 0.5]]] })).toBeNull(); // a tap
    expect(readDrawing({ strokes: [[[0.5, 0.5], [0.5 + MIN_INK / 2, 0.5]]] })).toBeNull();
    expect(readDrawing({ strokes: [[[0.1, NaN], [0.2, 0.2]]] })).toBeNull();
    expect(readDrawing({ strokes: [[[0.1, 3], [0.2, 0.2]]] })).toBeNull();
    const tooMany = Array.from({ length: OEKAKI_LIMITS.strokes + 1 }, (_, i) => [[0.1, i / 60], [0.9, i / 60]]);
    expect(readDrawing({ strokes: tooMany })).toBeNull();
    const tooLong = [Array.from({ length: OEKAKI_LIMITS.points + 1 }, (_, i) => [i / 100, 0.5])];
    expect(readDrawing({ strokes: tooLong })).toBeNull();
    const tooMuch = Array.from({ length: 10 }, () => Array.from({ length: 80 }, (_, i) => [i / 80, 0.5]));
    expect(readDrawing({ strokes: tooMuch })).toBeNull(); // 800 points in all
  });

  it('leaves Ink Storm’s limits as they were', () => {
    const fortyStrokes = Array.from({ length: 40 }, () => [[0.1, 0.1], [0.2, 0.2]]);
    expect(readInk(fortyStrokes)).toBeNull();
    expect(readInk(fortyStrokes, OEKAKI_LIMITS)).not.toBeNull();
    expect(INK_LIMITS.strokes).toBeLessThan(OEKAKI_LIMITS.strokes);
  });

  it('thins a long drawing to fit the limits, keeping more points on long strokes', () => {
    const long = Array.from({ length: 300 }, (_, i): InkPoint => [i / 300, 0.5]);
    const dot: InkPoint[] = [[0.5, 0.5], [0.51, 0.5]];
    const strokes = [long, long, long, dot, ...Array.from({ length: 60 }, () => dot)];
    const thinned = thinToLimits(strokes, OEKAKI_LIMITS);
    expect(thinned).toHaveLength(OEKAKI_LIMITS.strokes);
    expect(thinned.reduce((n, s) => n + s.length, 0)).toBeLessThanOrEqual(OEKAKI_LIMITS.total);
    expect(Math.max(...thinned.map((s) => s.length))).toBeLessThanOrEqual(OEKAKI_LIMITS.points);
    expect(thinned[0]!.length).toBeGreaterThan(thinned[3]!.length);
    expect(readDrawing({ strokes: thinned })).not.toBeNull();
    // And the wire size stays well under the server's 16 KB command limit.
    expect(JSON.stringify({ type: 'play', move: { kind: 'draw', strokes: thinned, colors: thinned.map(() => 5) } }).length).toBeLessThan(14_000);
  });

  it('bot scribbles are valid drawings', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20; i++) expect(readDrawing(botScribble(random))).not.toBeNull();
  });
});

// ---- fakes ----

describe('fake titles', () => {
  const real = { text: 'ねこの シェフ', kana: 'ねこの シェフ' };

  it('refuses fakes that are really the answer, however they are spelt', () => {
    expect(tooClose({ text: 'ネコノシェフ', kana: 'ネコノシェフ' }, real)).toBe(true);
    expect(tooClose({ text: 'ねこのしぇふ', kana: 'ねこのしぇふ' }, real)).toBe(true);
    expect(tooClose({ text: 'ねこの シェフだ', kana: 'ねこの シェフだ' }, real)).toBe(true); // the answer plus a bit
    expect(tooClose({ text: 'ねこの シェア', kana: 'ねこの シェア' }, real)).toBe(true); // one kana off
    expect(tooClose({ text: 'らあめん', kana: 'らあめん' }, { text: 'ラーメン', kana: 'ラーメン' })).toBe(true);
    // The server's reading of kanji counts (拉麺 read as らーめん).
    expect(tooClose({ text: '拉麺', kana: 'らーめん' }, { text: 'ラーメン', kana: 'ラーメン' })).toBe(true);
    expect(tooClose({ text: 'ねこ', kana: 'ねこ' }, real)).toBe(false); // part of it is a fair bluff
    expect(tooClose({ text: 'いぬの シェフ', kana: 'いぬの シェフ' }, real)).toBe(false);
    expect(tooClose({ text: 'すき', kana: 'すき' }, { text: 'すし', kana: 'すし' })).toBe(false); // short words: one kana is a different word
    expect(editDistance('ねこ', 'ねこの')).toBe(1);
  });

  it('reads typed and spoken fakes, Japanese only', () => {
    expect(readUtteranceFake({ via: 'typed', text: '  ねこの   ケーキ ' })).toEqual({ ok: true, fake: { text: 'ねこの ケーキ', kana: 'ねこの ケーキ', en: null, via: 'typed' } });
    expect(readUtteranceFake({ via: 'speech', text: '大きい魚', reading: 'おおきいさかな' })).toMatchObject({ ok: true, fake: { kana: 'おおきいさかな', via: 'speech' } });
    expect(readUtteranceFake({ via: 'typed', text: 'a cat chef' })).toEqual({ ok: false, error: 'not-japanese' });
    expect(readUtteranceFake({ via: 'typed', text: '   ' })).toEqual({ ok: false, error: 'empty-answer' });
    expect(readUtteranceFake({ via: 'shout', text: 'ねこ' })).toEqual({ ok: false, error: 'bad-move' });
    expect(readUtteranceFake('ねこ')).toEqual({ ok: false, error: 'bad-move' });
  });

  it('builds fakes from tiles, joining の to its neighbours', () => {
    const hand = [
      { text: '魚', kana: 'さかな', en: 'fish' },
      { text: 'ケーキ', kana: 'ケーキ', en: 'cake' },
      { text: 'こわい', kana: 'こわい', en: 'scary' },
      NO_TILE,
    ];
    expect(buildTileFake([0, 3, 1], hand)).toEqual({ ok: true, fake: { text: '魚の ケーキ', kana: 'さかなの ケーキ', en: "fish's cake", via: 'tiles' } });
    expect(buildTileFake([0, 3, 1], hand, true)).toMatchObject({ ok: true, fake: { text: 'さかなの ケーキ' } }); // Kana-level writers write kana
    expect(buildTileFake([2, 1], hand)).toMatchObject({ ok: true, fake: { text: 'こわい ケーキ', en: 'scary cake' } });
    expect(buildTileFake([3, 1], hand)).toMatchObject({ ok: true, fake: { text: 'ケーキ' } }); // a stray の is dropped
    expect(buildTileFake([3], hand)).toEqual({ ok: false, error: 'empty-answer' });
    expect(buildTileFake([1, 1], hand)).toEqual({ ok: false, error: 'tile-twice' });
    expect(buildTileFake([9], hand)).toEqual({ ok: false, error: 'bad-move' });
    expect(buildTileFake([0.5], hand)).toEqual({ ok: false, error: 'bad-move' });
    expect(buildTileFake([0, 1, 2, 3, 0], hand)).toEqual({ ok: false, error: 'too-long' });
    expect(buildTileFake('0', hand)).toEqual({ ok: false, error: 'empty-answer' });
  });
});

// ---- prompts ----

describe('prompts and tiles', () => {
  it('draws from the pack’s drawable nouns: no baseline, stereotype, direction or verb words', () => {
    const ids = poolFor(fixture, 'food').words.map((w) => w.id);
    expect(ids).toContain('food.cat-chef');
    expect(ids).not.toContain('food.ringo');
    expect(ids).not.toContain('food.ninja');
    expect(ids).not.toContain('food.right');
    expect(ids).not.toContain('food.eat');
    expect(shortEn('onigiri (rice ball); a snack')).toBe('onigiri');
  });

  it('gives Kana-level players kana words and N5 players pairs, without repeats', () => {
    let seed = 3;
    const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    const used = new Set<string>();
    const kana: Prompt[] = [];
    for (let i = 0; i < 5; i++) {
      const p = dealPrompt(fixture, 'food', 'kana', used, random);
      markUsed(used, p);
      kana.push(p);
    }
    expect(new Set(kana.map((p) => p.id)).size).toBe(5);
    expect(kana.every((p) => pack.words.find((w) => w.id === p.id)?.level === 'kana')).toBe(true);
    const pair = dealPrompt(fixture, 'food', 'n5', new Set(), () => 0);
    expect(pair.id).toMatch(/^oekaki\..+\+food\./);
    expect(pair.text).toContain(' ');
    expect(pair.parts).toHaveLength(2);
    // With everything used up it repeats rather than stopping.
    const all = new Set(poolFor(fixture, 'food').words.flatMap((w) => [w.id, `r:${w.jp.kana}`]));
    expect(dealPrompt(fixture, 'food', 'kana', all, random).id).toBeTruthy();
  });

  it('never deals a tile that is a piece of the real title', () => {
    const real = dealPrompt(fixture, 'food', 'n5', new Set(), () => 0);
    for (let k = 0; k < 10; k++) {
      let seed = k + 1;
      const tiles = dealTiles(fixture, 'food', real, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
      expect(tiles.at(-1)).toEqual(NO_TILE);
      for (const t of tiles.filter((x) => !x.particle)) for (const part of real.parts) expect(part.includes(t.kana) || t.kana.includes(part)).toBe(false);
    }
  });

  it('falls back to a built-in list with no packs', () => {
    const p = dealPrompt(EMPTY_CONTENT, null, 'kana', new Set(), () => 0);
    expect(p.id).toMatch(/^oekaki\.fallback\./);
  });
});

// ---- rules ----

describe('Oekaki rounds', () => {
  it('deals secret words, validates drawings and keeps them off the phones', () => {
    const r = room(4);
    r.cmd(stage, { type: 'start', mode: 'oekaki', packId: 'food' });
    expect(r.s.phase).toBe('intro');
    r.tick();
    expect(r.s.phase).toBe('prompt');
    // Each phone sees only its own secret word; the stage sees none.
    const mine = r.view(as('p1')).mine!.prompt!;
    expect(mine.text).toBe(r.ms().prompts.p1!.text);
    expect(JSON.stringify(r.view(stage))).not.toContain(r.ms().prompts.p1!.text);
    expect(r.view(as('p4')).mine!.prompt!.romaji).toBeTruthy(); // Kana level: romaji training wheels
    expect(r.view(as('p1')).mine!.prompt!.romaji).toBeNull();
    expect(r.play('p1', { kind: 'draw', strokes: [[[0.5, 0.5]]] }).error).toBe('bad-drawing');
    expect(r.play('p1', { kind: 'draw', strokes: square, colors: [0, 99] }).error).toBe('bad-drawing');
    expect(r.play('p1', draw).changed).toBe(true);
    expect(r.play('p1', draw).error).toBe('already-answered');
    expect(r.view(stage).drawn).toEqual(['p1']);
    r.play('p2', draw);
    r.play('p3', draw);
    r.play('p4', draw);
    expect(r.s.phase).toBe('answer'); // everyone in: ends early
    const t = r.ms().turn!;
    expect(r.view(stage).drawing!.strokes).toEqual(square);
    expect(r.view(stage).drawing!.colors).toEqual([0, 1]);
    for (const p of ['p1', 'p2', 'p3', 'p4']) expect(r.view(as(p)).drawing).toBeNull();
    expect(r.view(as(t.sketch.artistId)).mine!.isArtist).toBe(true);
    expect(r.view(as(t.sketch.artistId)).mine!.prompt!.text).toBe(t.sketch.prompt.text);
  });

  it('scores finding the real title, fooling others and the artist, with a capped voice bonus', () => {
    const r = room(4);
    startAndDraw(r, 4);
    const t = r.ms().turn!;
    const artist = t.sketch.artistId;
    const [a, b, c] = ['p1', 'p2', 'p3', 'p4'].filter((p) => p !== artist) as [string, string, string];
    const real = t.sketch.prompt;
    expect(r.play(artist, { kind: 'fake', utterance: { via: 'typed', text: 'ねこ' } }).error).toBe('your-drawing');
    expect(r.play(a, { kind: 'fake', utterance: { via: 'typed', text: real.kana } }).error).toBe('too-close');
    expect(r.play(a, { kind: 'fake', utterance: { via: 'typed', text: 'a ghost' } }).error).toBe('not-japanese');
    expect(r.play(a, { kind: 'fake', utterance: { via: 'speech', text: 'おばけの パン' } }).changed).toBe(true);
    expect(r.play(a, { kind: 'fake', utterance: { via: 'speech', text: 'もう いっかい' } }).error).toBe('already-answered');
    // Nobody sees what was written until the vote.
    expect(JSON.stringify(r.view(stage))).not.toContain('おばけの');
    expect(JSON.stringify(r.view(as(b)))).not.toContain('おばけの');
    expect(r.view(as(a)).mine!.fake).toBe('おばけの パン');
    expect(r.view(stage).submitted).toEqual([a]);
    // Tiles: every writer has a hand; the artist has none.
    expect(r.view(as(b)).mine!.tiles!.length).toBeGreaterThan(1);
    expect(r.view(as(artist)).mine!.tiles).toBeNull();
    r.play(b, { kind: 'fake', utterance: { via: 'typed', text: 'オバケノ パン' } }); // the same fake as a's: shares the option
    r.play(c, { kind: 'fake', tiles: [0] });
    expect(r.s.phase).toBe('reveal');
    const options = r.view(stage).options!;
    expect(options).toHaveLength(3); // two distinct fakes + the real one
    // The vote shows every title in kana, so the real title's kanji can't give it away.
    for (const o of options) expect(o.text).toBe(o.kana);
    expect(JSON.stringify(r.view(stage))).not.toContain('"real"');
    const ms = r.ms().turn!;
    const realOpt = ms.options.find((o) => o.real)!;
    const ghost = ms.options.find((o) => o.authorIds.includes(a))!;
    const tileFake = ms.options.find((o) => o.authorIds.includes(c))!;
    expect(ghost.authorIds).toEqual([a, b]);
    expect(r.play(a, { kind: 'pick', optionId: ghost.id }).error).toBe('own-answer');
    expect(r.play(artist, { kind: 'pick', optionId: realOpt.id }).error).toBe('your-drawing');
    r.play(a, { kind: 'pick', optionId: realOpt.id });
    r.play(b, { kind: 'pick', optionId: tileFake.id });
    r.play(c, { kind: 'pick', optionId: ghost.id });
    expect(r.s.phase).toBe('score');
    // a: found it (100) + fooled c (50) + voice bonus; b: fooled c (50) + typed bonus; c: fooled b (50).
    // artist: one finder (50). Base 300, so the 30% pool holds 128: both bonuses fit.
    expect(score(r.s, artist)).toBe(POINTS_ARTIST_PER_FINDER);
    expect(score(r.s, a)).toBe(POINTS_REAL_FOUND + POINTS_PER_FOOLED + FAKE_SPOKEN_BONUS);
    expect(score(r.s, c)).toBe(POINTS_PER_FOOLED);
    const v = r.view(as(c)).result!;
    expect(v.real.text).toBe(real.text);
    expect(v.artistId).toBe(artist);
    expect(v.options.find((o) => o.real)!.pickedBy.map((p) => p.id)).toEqual([a]);
    expect(v.options.find((o) => o.id === tileFake.id)!.en).toBeTruthy();
    // Say it together: a bonus from the pool, and the sketchbook marks it said.
    expect(r.play(c, { kind: 'say', utterance: { via: 'speech', text: 'ぜんぜん ちがう' } }).error).toBe('not-the-word');
    expect(r.play(c, { kind: 'say', utterance: { via: 'speech', text: real.kana } }).changed).toBe(true);
    expect(score(r.s, c)).toBe(POINTS_PER_FOOLED + SAY_SPOKEN_BONUS);
    expect(r.play(c, { kind: 'say', utterance: { via: 'speech', text: real.kana } }).error).toBe('already-answered');
    expect(r.s.phrasebook[c]!.find((e) => e.itemId === real.id)!.outcome).toBe('said');
    expect(r.s.phrasebook[b]!.find((e) => e.itemId === real.id)!.outcome).toBe('seen');
    // Speaking bonuses never pass 30% of the drawing's points.
    for (const p of ['p1', 'p2', 'p3', 'p4']) r.play(p, { kind: 'say', utterance: { via: 'speech', text: real.kana } });
    const turn = r.ms().turn!;
    expect(turn.pool.bonus).toBeLessThanOrEqual(Math.floor((turn.pool.base * 0.3) / 0.7));
  });

  it('adds Fude’s decoys when too few fakes come in, and they fool nobody into points', () => {
    const r = room(3);
    startAndDraw(r, 3);
    r.tick(); // nobody wrote a fake
    expect(r.s.phase).toBe('reveal');
    const t = r.ms().turn!;
    expect(t.options.filter((o) => o.house)).toHaveLength(2);
    for (const o of t.options) if (!o.real) expect(tooClose(o, t.sketch.prompt)).toBe(false);
    const voters = ['p1', 'p2', 'p3'].filter((p) => p !== t.sketch.artistId);
    const decoy = t.options.find((o) => o.house)!;
    for (const v of voters) r.play(v, { kind: 'pick', optionId: decoy.id });
    expect(r.s.phase).toBe('score');
    expect(r.s.players.every((p) => p.score === 0)).toBe(true);
    expect(r.view(stage).result!.options.find((o) => o.house)!.pickedBy).toHaveLength(2);
  });

  it('lets only the VIP hide a title or the whole drawing', () => {
    const r = room(4);
    startAndDraw(r, 4);
    const t = r.ms().turn!;
    const writers = ['p1', 'p2', 'p3', 'p4'].filter((p) => p !== t.sketch.artistId);
    writers.forEach((p, i) => r.play(p, { kind: 'fake', utterance: { via: 'typed', text: ['いぬの パン', 'ひどい ことば', 'くもの すし'][i]! } }));
    expect(r.s.phase).toBe('reveal');
    const rude = r.ms().turn!.options.find((o) => o.text === 'ひどい ことば')!;
    const vip = r.s.vipId!;
    const other = writers.find((p) => p !== vip)!;
    expect(r.play(other, { kind: 'hide', optionId: rude.id }).error).toBe('not-vip');
    // Someone picked it before the VIP hid it: their pick is undone and they pick again.
    const picker = writers.find((p) => !rude.authorIds.includes(p))!;
    r.play(picker, { kind: 'pick', optionId: rude.id });
    expect(r.play(vip, { kind: 'hide', optionId: rude.id }).changed).toBe(true);
    expect(r.ms().turn!.picks[picker]).toBeUndefined();
    expect(r.view(stage).options!.find((o) => o.id === rude.id)!.text).toBe('[hidden]');
    expect(JSON.stringify(r.view(stage))).not.toContain('ひどい');
    expect(r.play(picker, { kind: 'pick', optionId: rude.id }).error).toBe('hidden');
    // Hiding the drawing ends its turn with no points; the real title is still said together.
    expect(r.play(vip, { kind: 'hide', drawing: true }).changed).toBe(true);
    expect(r.s.phase).toBe('score');
    expect(r.view(stage).drawing).toBeNull();
    expect(r.view(stage).hiddenDrawing).toBe(true);
    expect(r.s.players.every((p) => p.score === 0)).toBe(true);
  });

  it('skips a hidden drawing straight from the fake titles to the score', () => {
    const r = room(3);
    startAndDraw(r, 3);
    r.play(r.s.vipId!, { kind: 'hide', drawing: true });
    expect(r.s.phase).toBe('score');
    expect(r.play('p2', { kind: 'fake', utterance: { via: 'typed', text: 'ねこ' } }).error).toBe('wrong-phase');
  });

  it('shows every drawing once, then a second round at double points, then the recap', () => {
    const r = room(3);
    startAndDraw(r, 3, { rounds: 2 });
    const artists: string[] = [];
    let guard = 0;
    while (r.s.phase !== 'recap' && guard++ < 100) {
      if (r.s.phase === 'prompt') for (const p of ['p1', 'p2', 'p3']) r.play(p, draw);
      else {
        if (r.s.phase === 'answer') artists.push(`${r.ms().round}:${r.ms().turn!.sketch.artistId}`);
        if (r.s.phase === 'reveal' && r.ms().round === 2) {
          const t = r.ms().turn!;
          const real = t.options.find((o) => o.real)!;
          for (const p of ['p1', 'p2', 'p3']) if (p !== t.sketch.artistId) r.play(p, { kind: 'pick', optionId: real.id });
          expect(r.s.phase).toBe('score');
          expect(r.view(stage).result!.double).toBe(true);
          expect(r.ms().turn!.points[t.sketch.artistId]).toBe(2 * 2 * POINTS_ARTIST_PER_FINDER);
        }
        r.tick();
      }
    }
    expect(r.s.phase).toBe('recap');
    expect(artists.sort()).toEqual(['1:p1', '1:p2', '1:p3', '2:p1', '2:p2', '2:p3']);
    // Six different words were dealt over the two rounds.
    expect(r.ms().used.filter((u) => !u.startsWith('r:'))).toHaveLength(6);
    const awards = r.s.recap!.awards.map((x) => x.title);
    expect(awards).toContain('がはく');
    expect(awards).toContain('めいたんてい');
  });

  it('skips players who never sent a drawing', () => {
    const r = room(3);
    r.cmd(stage, { type: 'start', mode: 'oekaki', packId: 'food' });
    r.tick();
    r.play('p2', draw);
    r.tick(); // time's up: one drawing
    expect(r.s.phase).toBe('answer');
    expect(r.view(stage).count).toBe(1);
    r.tick();
    r.tick();
    r.tick(); // score → recap
    expect(r.s.phase).toBe('recap');
  });

  it('runs end to end with no packs at all', () => {
    const r = room(3, EMPTY_CONTENT);
    r.cmd(stage, { type: 'start', mode: 'oekaki' });
    let guard = 0;
    while (r.s.phase !== 'recap' && guard++ < 50) {
      if (r.s.phase === 'prompt' && !r.ms().sketches.length) for (const p of ['p1', 'p2', 'p3']) r.play(p, draw);
      else r.tick();
    }
    expect(r.s.phase).toBe('recap');
    expect(Object.values(r.ms().prompts).every((p) => p.id.includes('oekaki.fallback.'))).toBe(true);
  });

  it('keeps the stage view small: the drawing only while it is up', () => {
    const r = room(4);
    r.cmd(stage, { type: 'start', mode: 'oekaki', packId: 'food' });
    r.tick();
    const big = botScribble(() => 0.37);
    for (const p of ['p1', 'p2', 'p3', 'p4']) r.play(p, { kind: 'draw', ...big });
    expect(JSON.stringify(r.view(stage)).length).toBeLessThan(12_000);
    expect(JSON.stringify(r.view(as('p1'))).length).toBeLessThan(3_000);
  });
});

// ---- full system ----

describe('Oekaki: bots play a whole game over the real server', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 5, prompt: 400, answer: 300, reveal: 300, score: 150 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('reaches the recap with scores that add up and no desyncs', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };
    let last: OekakiView | null = null;
    let drawingsShown = 0;
    let recap: RoomView['recap'] = null;
    let finished = false;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 5,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'oekaki',
      packId: 'food',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        const game = view.game as OekakiView | null;
        if (game) {
          last = game;
          if (game.drawing) drawingsShown = Math.max(drawingsShown, game.index);
        }
        if (view.phase === 'recap') recap = view.recap;
      },
    });
    director.start();
    const bots: Bot[] = [];
    for (let i = 1; i <= 5; i++) {
      const policy = oekakiPolicy({ delayMs: 5, seed: i });
      bots.push(await Bot.join({ baseUrl, code: created.code, name: `oe${i}`, policy, level: i === 5 ? 'kana' : 'n5', onState: (bot, view, v) => record(bot.playerId, view, v) }));
    }
    await until(() => finished, 20_000, 'the game');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(drawingsShown).toBe(5);
    const standings = (recap as RoomView['recap'])!.standings;
    for (const s of standings) expect(s.score, s.name).toBe((last as OekakiView | null)?.earned[s.playerId] ?? 0);
    expect(standings.some((s) => s.score > 0)).toBe(true);
    // Everyone's sketchbook has the real titles.
    for (const p of room.state.players) expect(room.state.phrasebook[p.id]?.length ?? 0).toBeGreaterThanOrEqual(5);
    // No desyncs.
    for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
    // Only harmless races with the phase clock.
    const failures = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failures).toEqual([]);
    for (const b of bots) b.stop();
    director.client.close();
  });
});

describe('Oekaki: the Green Car', () => {
  const N4 = new Set(['ta-koto', 'passive', 'te-shimau']);
  const N3 = new Set(['suffering-passive', 'saserareru', 'you-to-suru', 'zu-ni', 'furi', 'ppanashi', 'mama']);
  const both = (j: { text: string; kana: string }) => [...new Set([...framesOf(j), ...framesOf({ text: j.kana, kana: j.kana })])];
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const green = (seed = 1, audience?: 'kids' | 'family' | 'cheeky') => {
    const r = room(4, fixture, { 1: 'n3', 2: 'n4', 3: 'n3', 4: 'n4' }, seeded(seed));
    if (audience) r.cmd(stage, { type: 'settings', audience });
    startAndDraw(r, 4);
    return r;
  };

  it('every sentence is N4 or N3, a draft, and its what-happened chunk says its frames', () => {
    for (const x of SENTENCES) {
      expect(x.status, x.id).toBe('draft');
      for (const f of x.frames) {
        expect(FRAME_BY_ID[f].level, `${x.id} ${f}`).toBe(x.level);
        expect(both(sentenceText(x)), x.id).toContain(f);
        expect(both(x.did), x.id).toContain(f);
      }
    }
    // Every frame in every audience; Kids and Cheeky pools of their own.
    for (const audience of ['kids', 'family', 'cheeky'] as const) {
      const frames = new Set(sentencesFor(audience).flatMap((x) => x.frames));
      for (const f of [...N4, ...N3]) expect(frames.has(f as never), `${audience}: ${f}`).toBe(true);
    }
    const kidsOnly = SENTENCES.filter((x) => x.audiences.includes('kids')).length;
    const cheekyOnly = SENTENCES.filter((x) => x.audiences.length === 1 && x.audiences[0] === 'cheeky').length;
    expect(kidsOnly / SENTENCES.length).toBeGreaterThan(0.25);
    expect(cheekyOnly / SENTENCES.length).toBeGreaterThan(0.15);
  });

  it('everyone draws a sentence: N4 artists N4, N3 artists N4 or N3; writers get chunk tiles and the frame hint', () => {
    const levels = { n3: 0, n4: 0 };
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = green(seed);
      for (const p of r.s.players) {
        const x = SENTENCE_BY_ID.get(r.ms().prompts[p.id]!.id)!;
        expect(x, p.id).toBeDefined();
        expect(x.audiences).toContain('family');
        if (p.level === 'n4') expect(x.level).toBe('n4');
        else levels[x.level]++;
      }
      const t = r.ms().turn!;
      const real = SENTENCE_BY_ID.get(t.sketch.prompt.id)!;
      for (const p of r.s.players) {
        const me = r.view(as(p.id)).mine!;
        if (p.id === t.sketch.artistId) {
          expect(me.frame).toBeNull();
          continue;
        }
        expect(me.frame!.id).toBe(real.frames[0]);
        expect(!!me.frame!.n3).toBe(real.level === 'n3');
        const tiles = me.tiles!;
        expect(tiles.filter((x) => x.chunk === 'who')).toHaveLength(3);
        const dids = tiles.filter((x) => x.chunk === 'did');
        expect(dids).toHaveLength(3);
        for (const x of tiles) expect([normalizeReading(real.who.kana), normalizeReading(real.did.kana)]).not.toContain(normalizeReading(x.kana));
        // An N4 writer always has an N3 stretch chunk, tagged; an N3 writer both levels.
        if (p.level === 'n4') expect(dids.some((d) => d.n3)).toBe(true);
        else expect(dids.some((d) => d.n3) && dids.some((d) => !d.n3)).toBe(true);
        // At least one chunk in the real sentence's frame.
        expect(dids.some((d) => both(d).some((f) => real.frames.includes(f as never)))).toBe(true);
      }
    }
    expect(levels.n3).toBeGreaterThan(2);
    expect(levels.n4).toBeGreaterThan(2);
  });

  it('a fake must carry an N4 or N3 frame; one said from memory counts, one read off a tile does not', () => {
    const r = green(3);
    const t = r.ms().turn!;
    const [a, b, c] = r.s.players.map((p) => p.id).filter((id) => id !== t.sketch.artistId);
    expect(r.play(a!, { kind: 'fake', utterance: { via: 'speech', text: 'ねこが ねた' } }).error).toBe('no-frame');
    // From memory: a chunk that isn't in the hand.
    const hand = new Set(t.tiles[a!]!.map((x) => normalizeReading(x.kana)));
    const mem = SENTENCES.find((x) => x.frames.includes('furi') && !hand.has(normalizeReading(x.did.kana)) && x.id !== t.sketch.prompt.id)!;
    expect(r.play(a!, { kind: 'fake', utterance: { via: 'speech', text: `ゆうれいが ${mem.did.kana}` } }).error).toBeUndefined();
    const entry = r.s.phrasebook[a!]!.find((e) => e.itemId.startsWith('oekaki:fake:'))!;
    expect(entry).toMatchObject({ outcome: 'said', recall: 'memory' });
    expect(entry.frames).toContain('furi');
    expect(r.ms().gcSaid![a!]!.furi).toBe(1);
    // Read off a tile: logged, not from memory, not counted.
    const did = t.tiles[b!]!.find((x) => x.chunk === 'did')!;
    expect(r.play(b!, { kind: 'fake', utterance: { via: 'speech', text: `ゆうれいが ${did.kana}` } }).error).toBeUndefined();
    expect(r.s.phrasebook[b!]!.find((e) => e.itemId.startsWith('oekaki:fake:'))!.recall).toBe('read');
    expect(r.ms().gcSaid?.[b!]).toBeUndefined();
    // Tiles: a who tile and a chunk tile make a sentence (no phrase logged).
    const hc = t.tiles[c!]!;
    expect(r.play(c!, { kind: 'fake', tiles: [hc.findIndex((x) => x.chunk === 'who'), hc.findIndex((x) => x.chunk === 'did')] }).error).toBeUndefined();
    expect((r.s.phrasebook[c!] ?? []).some((e) => e.itemId.startsWith('oekaki:fake:'))).toBe(false);
    expect(r.s.phase).toBe('reveal');
  });

  it('house decoys are other sentences; Kids rooms never see Cheeky sentences', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = green(seed, 'kids');
      for (const p of r.s.players) expect(SENTENCE_BY_ID.get(r.ms().prompts[p.id]!.id)!.audiences).toContain('kids');
      for (const tiles of Object.values(r.ms().turn!.tiles)) {
        for (const x of tiles) expect(SENTENCES.some((y) => y.audiences.includes('kids') && (y.who.kana === x.kana || y.did.kana === x.kana)), x.kana).toBe(true);
      }
      r.tick(); // nobody wrote a fake
      const house = r.ms().turn!.options.filter((o) => o.house);
      expect(house).toHaveLength(2);
      for (const o of house) expect(SENTENCES.some((y) => y.audiences.includes('kids') && sentenceText(y).text === o.text), o.text).toBe(true);
    }
  });

  it('a mixed room is unchanged: words, word tiles and frameless fakes', () => {
    const r = room(4, fixture, { 1: 'n3', 2: 'n4', 3: 'n5', 4: 'n4' });
    startAndDraw(r, 4);
    for (const p of r.s.players) expect(SENTENCE_BY_ID.has(r.ms().prompts[p.id]!.id)).toBe(false);
    const t = r.ms().turn!;
    const writer = r.s.players.find((p) => p.id !== t.sketch.artistId)!.id;
    expect(r.view(as(writer)).mine!.frame).toBeNull();
    expect(t.tiles[writer]!.some((x) => x.chunk)).toBe(false);
    expect(r.play(writer, { kind: 'fake', utterance: { via: 'speech', text: 'あおい ねこ' } }).error).toBeUndefined();
  });

  it('bots in the Green Car say fakes from memory, N3 frames about half', () => {
    let n3 = 0;
    let n4 = 0;
    for (const seed of [1, 2, 3]) {
      const r = room(4, fixture, { 1: 'n3', 2: 'n4', 3: 'n3', 4: 'n4' }, seeded(seed));
      r.cmd(stage, { type: 'start', mode: 'oekaki', packId: 'food', rounds: 2 } as CommandBody);
      const policy = oekakiPolicy({ seed });
      const done = new Set<string>();
      for (let guard = 0; guard < 500 && r.s.phase !== 'recap'; guard++) {
        let moved = false;
        for (const p of r.s.players) {
          const view = viewFor(r.s, as(p.id), fixture);
          for (const m of policy.act(view, p.id)) {
            const key = `${p.id}:${view.phaseSeq}:${m.key}`;
            if (done.has(key)) continue;
            done.add(key);
            r.play(p.id, m.move);
            moved = true;
          }
        }
        if (!moved) r.tick();
      }
      expect(r.s.phase).toBe('recap');
      for (const p of r.s.players.filter((x) => x.level === 'n3')) {
        const memory = (r.s.phrasebook[p.id] ?? []).filter((e) => e.recall === 'memory' && e.outcome === 'said');
        for (const e of memory) for (const f of e.frames ?? []) N3.has(f) ? n3++ : N4.has(f) ? n4++ : null;
      }
    }
    expect(n3).toBeGreaterThan(2);
    expect(n4).toBeGreaterThan(2);
  });
});
