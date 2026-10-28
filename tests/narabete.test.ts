import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { normalizeReading, soundKey, type Utterance } from '../shared/src/japanese/kana.js';
import type { ContentLibrary } from '../shared/src/modes/mode.js';
import { FEEL_THEMES, feelThemesFor, TIME_SETS, timeSetsFor } from '../shared/src/modes/narabete/cards.js';
import {
  BONUS_POOL_SHARE,
  computeFlip,
  dealTime,
  DEFENCE_SHARE,
  PAIR_POINTS,
  PERFECT_POINTS,
  PERFORM_POINTS,
  saidTime,
  SAY_SHARE,
  soundsLikeNumber,
  timeSetOf,
  VOTE_POINTS,
  type NarabeteState,
  type NarabeteView,
  type Round,
} from '../shared/src/modes/narabete/narabete.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { labelValue, narabetePolicy } from '../tools/bots/policies/narabete.js';
import { content as REAL_CONTENT, hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Table {
  now = 1_000_000;
  ids = 0;
  cmdId = 0;
  readonly random: () => number;
  readonly s: GameState = createGame('BCDF');
  constructor(
    players: number,
    levels: Level[] = [],
    readonly content: ContentLibrary = REAL_CONTENT,
    seed = 7,
  ) {
    this.random = mulberry(seed);
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: levels[i - 1] ?? 'n5' });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: this.content, newId: () => `id${++this.ids}`, random: this.random };
  }
  act(action: GameAction) {
    return apply(this.s, action, this.ctx());
  }
  cmd(actor: string | 'stage', command: CommandBody) {
    const who = actor === 'stage' ? ({ kind: 'stage' } as const) : ({ kind: 'player', playerId: actor } as const);
    return apply(this.s, { type: 'command', actor: who, command: { ...command, id: `c${++this.cmdId}` } as Command }, this.ctx());
  }
  play(player: string, move: unknown) {
    return this.cmd(player, { type: 'play', move });
  }
  timeout() {
    this.now = Math.max(this.now, this.s.deadline ?? 0);
    return this.act({ type: 'timeout', phaseSeq: this.s.phaseSeq });
  }
  get st(): NarabeteState {
    return this.s.modeState as NarabeteState;
  }
  get r(): Round {
    return this.st.current!;
  }
  view(viewer: string | 'stage' = 'stage'): NarabeteView {
    const v = viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
    return v.game as NarabeteView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  ids_(): string[] {
    return this.s.players.map((p) => p.id);
  }
  start(audience?: 'kids' | 'family' | 'cheeky') {
    if (audience) this.cmd('stage', { type: 'settings', audience });
    expect(this.cmd('stage', { type: 'start', mode: 'narabete' }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.timeout();
    expect(this.s.phase).toBe('prompt');
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  cardOf(id: string) {
    return this.r.cards.find((c) => c.ownerId === id)!;
  }
  /** Every player says their Time card's sentence (or a Feelings answer) out loud. */
  sayAll(feel = 'ちょっと ひどい です') {
    for (const id of this.ids_()) {
      const c = this.cardOf(id);
      const tc = TIME_SETS.flatMap((x) => x.cards).find((x) => x.id === c.timeId);
      expect(this.play(id, { kind: 'say', utterance: speech(tc ? tc.jp.kana : feel) }).error).toBeUndefined();
    }
  }
  /** Sorts the line into true order by moving cards, the way players would (bubble sort). */
  sortLine() {
    for (let pass = 0; pass < this.r.line.length; pass++)
      for (let i = 0; i < this.r.line.length - 1; i++) {
        const a = this.r.cards.find((c) => c.id === this.r.line[i])!;
        const b = this.r.cards.find((c) => c.id === this.r.line[i + 1])!;
        if (a.value > b.value) expect(this.play(a.ownerId, { kind: 'move', dir: 1 }).error).toBeUndefined();
      }
  }
  lockAll() {
    for (const id of this.ids_()) this.play(id, { kind: 'lock', locked: true });
  }
}

const speech = (text: string): Utterance => ({ via: 'speech', text });
const typed = (text: string): Utterance => ({ via: 'typed', text });

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});
function heard(text: string, via: Utterance['via'] = 'speech'): Utterance {
  const move = { u: { via, text } as Utterance };
  addReadings(move, reader);
  return move.u;
}

// ---- the cards ----

describe('Narabete!: the cards', () => {
  it('every Time Line set is a story of 8 cards with distinct values, and every key is in its sentence', () => {
    for (const set of TIME_SETS) {
      expect(set.cards.length, set.id).toBe(8);
      expect(new Set(set.cards.map((c) => c.value)).size, set.id).toBe(8);
      expect(new Set(set.cards.map((c) => c.id)).size).toBe(8);
      for (const c of set.cards) {
        expect(c.keys.length, c.id).toBeGreaterThan(0);
        expect(
          c.keys.some((k) => soundKey(normalizeReading(c.jp.kana)).includes(soundKey(k))),
          `${c.id}: ${c.keys.join('/')} in ${c.jp.kana}`,
        ).toBe(true);
      }
    }
  });

  it('every audience has Time sets, Feelings themes and a Worst Day Ever story', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      expect(timeSetsFor(a).length, a).toBeGreaterThan(0);
      expect(feelThemesFor(a, false).length, a).toBeGreaterThan(1);
      expect(feelThemesFor(a, true).length, a).toBeGreaterThan(0);
    }
    // Cheeky never reaches a Kids room.
    expect(timeSetsFor('kids').some((s) => s.audiences.includes('cheeky') && !s.audiences.includes('kids'))).toBe(false);
    expect(feelThemesFor('kids', false).every((t) => t.audiences.includes('kids'))).toBe(true);
  });

  it('every Feelings theme has ready answers spread over the scale, frames and two swerve words', () => {
    for (const t of FEEL_THEMES) {
      expect(t.ready.length, t.id).toBeGreaterThanOrEqual(6);
      const scores = t.ready.map((r) => r.score);
      expect(Math.min(...scores), t.id).toBeLessThan(25);
      expect(Math.max(...scores), t.id).toBeGreaterThan(75);
      expect(t.frames.length, t.id).toBeGreaterThan(0);
      expect(t.swerve.length, t.id).toBe(2);
      // Ready answers never say a number.
      for (const r of t.ready) expect(soundsLikeNumber({ via: 'typed', text: r.jp.text }), `${t.id}: ${r.jp.text}`).toBe(false);
    }
  });

  it('always deals the punchline (the last card of the story)', () => {
    const set = TIME_SETS[0]!;
    for (let seed = 1; seed < 20; seed++) {
      const dealt = dealTime(set, [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never, mulberry(seed));
      expect(dealt.length).toBe(3);
      expect(dealt.map((c) => c.value)).toContain(Math.max(...set.cards.map((c) => c.value)));
    }
  });
});

// ---- hearing it ----

describe('Narabete!: hearing the card', () => {
  it('hears the time in kana, kanji and digits', () => {
    const keys = ['よじはん', 'よじさんじゅっぷん'];
    expect(saidTime(heard('ごご よじはんに おきます'), keys)).toBe(true);
    expect(saidTime(heard('午後4時半に起きます'), keys)).toBe(true);
    expect(saidTime(heard('4時30分に起きます'), keys)).toBe(true);
    expect(saidTime(heard('ごじに おきます'), keys)).toBe(false);
    expect(saidTime(heard('300円です'), ['さんびゃくえん'])).toBe(true);
  });

  it('warns, never rejects, when a Feelings answer sounds like the number', () => {
    expect(soundsLikeNumber(heard('70くらい'))).toBe(true);
    expect(soundsLikeNumber(heard('ななじゅう'))).toBe(true);
    expect(soundsLikeNumber(heard('すごく くさい'))).toBe(false);
  });

  it('the bots read a clock, a price and a date in the order a listener would', () => {
    expect(labelValue('7:00 am')).toBeLessThan(labelValue('12:00 noon'));
    expect(labelValue('11:00 pm')).toBeLessThan(labelValue('12:00 midnight'));
    expect(labelValue('12:00 midnight')).toBeLessThan(labelValue('2:00 am'));
    expect(labelValue('¥98')).toBeLessThan(labelValue('¥1,980'));
    expect(labelValue('Jan 1')).toBeLessThan(labelValue('Dec 24'));
  });
});

// ---- the flip ----

describe('Narabete!: the flip', () => {
  const round = (values: number[]): Round => ({
    index: 1,
    kind: 'feel',
    setId: 'x',
    cards: values.map((value, i) => ({ id: `c${i}`, ownerId: `p${i}`, value, offers: [], hinted: false, said: null, hidden: false, moves: 0, again: [] })),
    line: values.map((_, i) => `c${i}`),
    locks: {},
    defence: null,
    flip: null,
    votes: {},
  });

  it('a line in order is perfect, with nothing held back', () => {
    const f = computeFlip(round([3, 20, 50, 99]));
    expect(f).toMatchObject({ pairs: 3, maxPairs: 3, perfect: true, knots: [], last: null });
    expect(f.order).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('ties a knot between each pair out of order and flips the most out-of-place card last', () => {
    const f = computeFlip(round([99, 20, 50, 70]));
    expect(f.knots).toEqual([0]);
    expect(f.pairs).toBe(2);
    expect(f.perfect).toBe(false);
    expect(f.last).toBe('c0');
    expect(f.order.at(-1)).toBe('c0');
  });
});

// ---- a whole game, move by move ----

describe('Narabete!: the Time Line round', () => {
  it('deals one secret card each; the TV never shows a time before the flip', () => {
    const t = new Table(4);
    t.start();
    expect(t.r.kind).toBe('time');
    expect(t.r.cards.length).toBe(4);
    const set = timeSetOf(t.r.setId)!;
    const stage = t.view();
    expect(stage.title).toEqual(set.title);
    expect(stage.line.every((c) => c.value === undefined && c.label === undefined && c.text === null)).toBe(true);
    const mine = t.view('p1').me!;
    expect(mine.time?.label).toBeTruthy();
    expect(mine.time?.jp).toBeNull(); // N5: from memory, the hint shows the Japanese
    expect(t.play('p1', { kind: 'hint' }).error).toBeUndefined();
    expect(t.view('p1').me!.time?.jp?.text).toBeTruthy();
    // Kana players always see it, with romaji.
    const k = new Table(2, ['kana']);
    k.start();
    expect(k.view('p1').me!.time?.romaji).toBeTruthy();
  });

  it('a card counts as said when its time comes through; a worse try never replaces a good one', () => {
    const t = new Table(3);
    t.start();
    const c = t.cardOf('p1');
    const tc = TIME_SETS.flatMap((x) => x.cards).find((x) => x.id === c.timeId)!;
    t.play('p1', { kind: 'say', utterance: speech('えっと') });
    expect(t.cardOf('p1').said?.ok).toBe(false);
    t.play('p1', { kind: 'say', utterance: speech(tc.jp.kana) });
    expect(t.cardOf('p1').said?.ok).toBe(true);
    t.play('p1', { kind: 'say', utterance: speech('えっと') });
    expect(t.cardOf('p1').said?.ok).toBe(true);
  });

  it('moves swap your own card with a neighbour and unlock both; all locked opens the flip', () => {
    const t = new Table(3, [], REAL_CONTENT, 11);
    t.start();
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    const before = [...t.r.line];
    const first = t.r.cards.find((c) => c.id === before[0])!;
    const second = t.r.cards.find((c) => c.id === before[1])!;
    t.play(second.ownerId, { kind: 'lock', locked: true });
    expect(t.play(first.ownerId, { kind: 'move', dir: -1 }).error).toBeUndefined(); // at the end: nothing happens
    expect(t.r.line).toEqual(before);
    expect(t.play(first.ownerId, { kind: 'move', dir: 1 }).error).toBeUndefined();
    expect(t.r.line.slice(0, 2)).toEqual([before[1], before[0]]);
    expect(t.r.locks[second.ownerId]).toBeUndefined();
    // The stage shows pictures now, still no times.
    expect(t.view().line.every((c) => c.emoji && c.label === undefined)).toBe(true);
    // Asking to hear one again: not your own.
    expect(t.play(first.ownerId, { kind: 'again', cardId: first.id }).error).toBe('own-card');
    expect(t.play(second.ownerId, { kind: 'again', cardId: first.id }).error).toBeUndefined();
    expect(t.view(first.ownerId).me!.againFrom).toEqual([t.s.players.find((p) => p.id === second.ownerId)!.name]);
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score'); // no defence in a Time Line
  });

  it('a perfect line pays every pair, the perfect bonus and each speaking bonus, within the 30% pool', () => {
    const t = new Table(4, [], REAL_CONTENT, 3);
    t.start();
    t.play('p2', { kind: 'hint' });
    for (const id of t.ids_()) {
      const tc = TIME_SETS.flatMap((x) => x.cards).find((x) => x.id === t.cardOf(id).timeId)!;
      t.play(id, { kind: 'say', utterance: id === 'p3' ? typed(tc.jp.kana) : id === 'p4' ? speech('えっと') : speech(tc.jp.kana) });
    }
    expect(t.s.phase).toBe('reveal'); // a try that missed the time still counts as said
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    const team = 3 * PAIR_POINTS + PERFECT_POINTS;
    const cap = Math.round((BONUS_POOL_SHARE * team) / 5) * 5;
    const bonus = (share: number) => Math.round((cap * share) / 5) * 5;
    expect(t.score('p1')).toBe(team + bonus(SAY_SHARE.memory));
    expect(t.score('p2')).toBe(team + bonus(SAY_SHARE.helped));
    expect(t.score('p3')).toBe(team + bonus(SAY_SHARE.typed));
    expect(t.score('p4')).toBe(team + bonus(SAY_SHARE.tried));
    const v = t.view();
    expect(v.flip).toMatchObject({ perfect: true, pairs: 3, teamPoints: team });
    expect(v.line.every((c) => c.label && c.text)).toBe(true);
    expect(t.s.cues.at(-1)).toMatchObject({ host: 'nobiko', event: 'narabete_perfect' });
  });

  it('a knotted line still pays the pairs in order; mistakes never cost points', () => {
    const t = new Table(3, [], REAL_CONTENT, 5);
    t.start();
    t.sayAll();
    // Put the line in reverse order.
    t.sortLine();
    t.r.line.reverse();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    expect(t.view().flip!.pairs).toBe(0);
    for (const id of t.ids_()) expect(t.score(id)).toBeGreaterThanOrEqual(0);
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_knot' });
  });
});

describe('Narabete!: the Feelings Line and the Worst Day Ever', () => {
  function toFeelings(t: Table) {
    t.sayAll();
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    t.timeout();
    expect(t.s.phase).toBe('answer');
    expect(t.r.kind).toBe('feel');
  }

  it('a secret number each, ready answers to tap, and a warning for saying the number', () => {
    const t = new Table(3, ['kana', 'n5', 'n4']);
    t.start();
    toFeelings(t);
    const secrets = t.r.cards.map((c) => c.value);
    expect(new Set(secrets).size).toBe(3);
    expect(secrets.every((n) => n >= 1 && n <= 100)).toBe(true);
    expect(t.view('p1').me!.offers.length).toBe(4); // Kana gets one more
    expect(t.view('p2').me!.offers.length).toBe(3);
    expect(t.view('p1').me!.offers[0]!.romaji).toBeTruthy();
    expect(t.view().line.every((c) => c.value === undefined)).toBe(true);
    // Nobody else's phone shows your number.
    expect(t.view('p2').me!.secret).toBe(t.cardOf('p2').value);
    const key = t.view('p1').me!.offers[0]!.key;
    expect(t.play('p1', { kind: 'ready', key }).error).toBeUndefined();
    expect(t.cardOf('p1').said).toMatchObject({ via: 'tap', ready: key, ok: true });
    t.play('p2', { kind: 'say', utterance: heard(`${t.cardOf('p2').value}くらい`) });
    expect(t.view('p2').me!.said?.warn).toBe(true);
    expect(t.play('p2', { kind: 'say', utterance: heard('まあまあ くさい') }).error).toBeUndefined();
    expect(t.view('p2').me!.said?.warn).toBe(false);
  });

  it('the most-moved card defends itself; votes pay its author; your own answer is not on your ballot', () => {
    const t = new Table(3);
    t.start();
    toFeelings(t);
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    // p1 walks its card the furthest.
    const p1 = t.cardOf('p1');
    while (t.r.line.indexOf(p1.id) > 0) t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'move', dir: 1 });
    t.play('p1', { kind: 'move', dir: -1 });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.defence?.playerId).toBe('p1');
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_defence', slots: { name: 'P1' } });
    expect(t.view('p1').me!.defending).toBe(true);
    expect(t.play('p2', { kind: 'defend', pass: true }).error).toBe('not-yours');
    expect(t.play('p1', { kind: 'defend', utterance: speech('ぜんぜん くさくない から です') }).error).toBeUndefined();
    expect(t.s.phase).toBe('score');
    expect(t.view().defence?.text).toBe('ぜんぜん くさくない から です');
    const flipPay = t.r.flip!.teamPoints;
    expect(t.r.flip!.bonus.p1).toBeGreaterThan(t.r.flip!.bonus.p2!); // the defence share
    expect(DEFENCE_SHARE).toBeGreaterThan(0);
    expect(t.play('p1', { kind: 'vote', cardId: p1.id }).error).toBe('own-card');
    expect(t.play('p2', { kind: 'vote', cardId: p1.id }).error).toBeUndefined();
    expect(t.play('p2', { kind: 'vote', cardId: p1.id }).error).toBe('already-voted');
    const before = t.score('p1');
    t.timeout();
    expect(t.score('p1')).toBe(before + VOTE_POINTS);
    expect(flipPay).toBeGreaterThanOrEqual(0);
  });

  it('round 3 is read out as a story, lowest first, one turn each, then the recap with awards', () => {
    const t = new Table(3);
    t.start();
    toFeelings(t);
    t.sayAll('すごく いやな いちにち');
    t.sortLine();
    t.lockAll();
    if (t.s.phase === 'encore') t.timeout();
    expect(t.s.phase).toBe('score');
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    t.timeout();
    expect(t.r.kind).toBe('story');
    t.sayAll('でんしゃに のりおくれた');
    t.sortLine();
    t.lockAll();
    if (t.s.phase === 'encore') t.timeout();
    expect(t.s.phase).toBe('score');
    t.timeout();
    expect(t.s.phase).toBe('finale');
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_story' });
    const order = t.st.story!.order.map((id) => t.r.cards.find((c) => c.id === id)!);
    expect(order.map((c) => c.value)).toEqual([...order.map((c) => c.value)].sort((a, b) => a - b));
    for (const c of order) {
      expect(t.s.phase).toBe('finale');
      const v = t.view(c.ownerId);
      expect(v.me!.performing).toBeTruthy();
      const other = order.find((x) => x.ownerId !== c.ownerId)!;
      expect(t.play(other.ownerId, { kind: 'perform', pass: true }).error).toBe('not-your-turn');
      const before = t.score(c.ownerId);
      expect(t.play(c.ownerId, { kind: 'perform', utterance: speech(`そして ${c.said!.text}`) }).error).toBeUndefined();
      expect(t.score(c.ownerId)).toBe(before + PERFORM_POINTS);
    }
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap?.awards.some((a) => a.title === 'いい こえ賞')).toBe(true);
  });

  it.each(['kids', 'family', 'cheeky'] as const)('a %s room plays content for its audience', (audience) => {
    const t = new Table(2);
    t.start(audience);
    expect(timeSetOf(t.r.setId)!.audiences).toContain(audience);
    toFeelings(t);
    expect(FEEL_THEMES.find((x) => x.id === t.r.setId)!.audiences).toContain(audience);
  });

  it('the VIP can hide an answer; votes for it are returned', () => {
    const t = new Table(3);
    t.start();
    toFeelings(t);
    t.sayAll();
    const c = t.cardOf('p2');
    expect(t.play('p2', { kind: 'hide', cardId: c.id }).error).toBe('not-vip');
    expect(t.play('p1', { kind: 'hide', cardId: c.id }).error).toBeUndefined();
    expect(t.view().line.find((x) => x.id === c.id)!.text).toBe('[hidden]');
  });

  it('survives players leaving mid-round', () => {
    const t = new Table(4);
    t.start();
    t.sayAll();
    t.act({ type: 'connection', playerId: 'p3', connected: false });
    t.act({ type: 'release', playerId: 'p3' });
    for (const id of ['p1', 'p2', 'p4']) t.play(id, { kind: 'lock', locked: true });
    expect(['score', 'reveal']).toContain(t.s.phase);
    if (t.s.phase === 'reveal') t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.r.flip!.maxPairs).toBeLessThanOrEqual(3);
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Narabete!: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      reader,
      durations: { intro: 20, prompt: 30, answer: 1_500, reveal: 1_500, encore: 400, score: 30, finale: 400 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [3, 6]) {
    it(`${players} bots play every round with every client in sync`, async () => {
      const { baseUrl, truth, server } = ctx;
      const created = await createRoom(baseUrl);
      const room = server.rooms.get(created.code)!;
      const seen = new Map<string, { v: number; hash: string }[]>();
      const record = (id: string, view: RoomView, v: number) => {
        let list = seen.get(id);
        if (!list) seen.set(id, (list = []));
        list.push({ v, hash: hashView(view) });
      };
      let finished = false;
      let recap: RoomView['recap'] = null;
      const phases = new Set<string>();
      const kinds = new Set<string>();
      let pairs = 0;
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 3,
        totalRounds: 1_000,
        mode: 'narabete',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          const g = view.game as NarabeteView | null;
          if (g?.mode === 'narabete' && g.kind) kinds.add(g.kind);
          if (g?.mode === 'narabete' && g.flip && view.phase === 'score') pairs = Math.max(pairs, g.flip.pairs);
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = narabetePolicy({ thinkMs: 40, quiet: (id) => id.endsWith('2') });
      const bots: Bot[] = [];
      for (let i = 1; i <= players; i++) {
        bots.push(
          await Bot.join({
            baseUrl,
            code: created.code,
            name: `bot${i}`,
            policy,
            level: i === 1 ? 'kana' : i === 3 ? 'n4' : 'n5',
            onState: (bot, view, v) => record(bot.playerId, view, v),
          }),
        );
      }
      await until(() => finished, 60_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['intro', 'prompt', 'answer', 'reveal', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      expect([...kinds].sort()).toEqual(['feel', 'story', 'time']);
      expect(pairs).toBeGreaterThan(0);

      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      expect(standings.reduce((n, s) => n + s.score, 0)).toBeGreaterThan(0);

      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(players * 6);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
