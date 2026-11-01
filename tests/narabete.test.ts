import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { normalizeReading, soundKey, type Utterance } from '../shared/src/japanese/kana.js';
import type { ContentLibrary } from '../shared/src/modes/mode.js';
import { FEEL_THEMES, feelThemesFor, TIME_SETS, timeSetsFor } from '../shared/src/modes/narabete/cards.js';
import { defenceScript } from '../shared/src/modes/narabete/defence.js';
import {
  BONUS_POOL_SHARE,
  computeFlip,
  dealTime,
  DEFENCE_SHARE,
  hardTally,
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
    // Nothing is paid while the cards are still face down: the flip pays at its end.
    expect(t.ids_().map((id) => t.score(id))).toEqual([0, 0, 0, 0]);
    const v = t.view();
    expect(v.flip).toMatchObject({ perfect: true, pairs: 3, teamPoints: team });
    expect(v.line.every((c) => c.label && c.text)).toBe(true);
    expect(t.s.cues.at(-1)).toMatchObject({ host: 'nobiko', event: 'narabete_perfect' });
    t.timeout();
    expect(t.score('p1')).toBe(team + bonus(SAY_SHARE.memory));
    expect(t.score('p2')).toBe(team + bonus(SAY_SHARE.helped));
    expect(t.score('p3')).toBe(team + bonus(SAY_SHARE.typed));
    expect(t.score('p4')).toBe(team + bonus(SAY_SHARE.tried));
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
    // A room with an N4 player gets the N4 defence, even in the Time Line.
    if (t.s.phase === 'encore') t.timeout();
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
    expect(t.view().defence?.text).toBe('ぜんぜん くさくない からです。');
    const flipPay = t.r.flip!.teamPoints;
    expect(t.r.flip!.bonus.p1).toBeGreaterThan(t.r.flip!.bonus.p2!); // the defence share
    expect(DEFENCE_SHARE).toBeGreaterThan(0);
    expect(t.play('p1', { kind: 'vote', cardId: p1.id }).error).toBe('own-card');
    expect(t.play('p2', { kind: 'vote', cardId: p1.id }).error).toBeUndefined();
    expect(t.play('p2', { kind: 'vote', cardId: p1.id }).error).toBe('already-voted');
    const before = t.score('p1');
    const myBonus = t.r.flip!.bonus.p1!;
    t.timeout();
    expect(t.score('p1')).toBe(before + flipPay + myBonus + VOTE_POINTS);
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
    expect(t.s.recap?.awards.some((a) => a.title === 'いいこえ賞')).toBe(true);
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

// ---- the N4 hard role: rank and defend (goal 4.11) ----

describe('Narabete!: the N4 defence script', () => {
  it('fits the frame to where the card sits, with ので in every model line', () => {
    const first = defenceScript({ unit: 'time' }, 0, 4, '');
    expect(first.spot).toBe('first');
    expect(first.frame.kana).toBe('＿ので、これが いちばん さきです。');
    expect(first.status).toBe('draft');
    expect(first.frames).toEqual(['node']);
    const last = defenceScript({ unit: 'price' }, 3, 4, 'Aki');
    expect(last.frame.kana).toContain('いちばん あとです');
    const after = defenceScript({ unit: 'date' }, 2, 4, 'Aki');
    expect(after.frame.kana).toContain('Akiさんの あとです');
    for (const s of [first, last, after]) {
      expect(s.lines.length).toBeGreaterThanOrEqual(2);
      for (const l of s.lines) {
        expect(l.kana).toMatch(/ので、/);
        expect(l.en.length).toBeGreaterThan(0);
      }
    }
    // A な-adjective theme joins with なので; an い-adjective or verb as it is.
    const pon = FEEL_THEMES.find((x) => x.more.kana === 'たいへん')!;
    expect(defenceScript({ theme: pon }, 3, 4, 'Aki').lines.map((l) => l.kana).join(' ')).toContain('たいへんなので');
    expect(defenceScript({ theme: pon }, 3, 4, 'Aki').lines.map((l) => l.kana).join(' ')).toContain('たいへんな もの');
    const smelly = FEEL_THEMES.find((x) => x.id === 'smelly')!;
    expect(defenceScript({ theme: smelly }, 0, 4, '').lines[0]!.kana).toBe('ちょっとだけ くさいので、これが いちばん さきです。');
  });
});

describe('Narabete!: the N4 defence in a game', () => {
  it('the N4 player is offered it in the line-up, defends in its own encore, and only they get the bonus for it', () => {
    const t = new Table(3, ['n5', 'n4', 'n5']);
    t.start();
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    expect(t.view('p2').me!.hard).toMatchObject({ answer: 'offered', script: null });
    expect(t.view('p1').me!.hard).toBeNull();
    expect(t.play('p1', { kind: 'hard', accept: true }).error).toBe('not-offered');
    expect(t.play('p2', { kind: 'hard', accept: true }).error).toBeUndefined();
    t.sortLine();
    t.lockAll();
    // A Time Line has no ordinary defence, so the N4 one is the encore.
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('hard');
    // Its own cue: an invitation by name, not "your card moved a lot".
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_hard', slots: { name: 'P2' } });
    expect(t.view().defence).toMatchObject({ playerId: 'p2', n4: true });
    expect(t.view().defence!.frame!.kana).toMatch(/^＿ので、/);
    const me = t.view('p2').me!;
    expect(me.defending).toBe(true);
    expect(me.hard!.script!.lines.length).toBeGreaterThanOrEqual(2);
    expect(t.view('p1').me!.defending).toBe(false);
    expect(t.play('p1', { kind: 'defend', pass: true }).error).toBe('not-yours');
    expect(t.play('p2', { kind: 'defend', utterance: speech(me.hard!.script!.lines[0]!.kana) }).error).toBeUndefined();
    expect(t.s.phase).toBe('score');
    expect(t.r.hard).toMatchObject({ ok: true, framed: true, answer: 'accepted' });
    // Everyone said their card from memory: the N4 defender gets the defence share on top, nobody else changes.
    expect(t.r.flip!.bonus.p2!).toBeGreaterThan(t.r.flip!.bonus.p1!);
    expect(t.r.flip!.bonus.p1).toBe(t.r.flip!.bonus.p3);
    t.timeout();
    expect(hardTally(t.st)).toEqual({ offered: 1, accepted: 1, rate: 1 });
    // A model line read off the phone goes in the phrasebook as seen, not said.
    expect(t.s.phrasebook.p2!.find((e) => e.itemId.startsWith('narabete:defence:'))!.outcome).toBe('seen');
  });

  it('an offer still open when the line-up ends times out: no encore', () => {
    const t = new Table(3, ['n5', 'n4', 'n5']);
    t.start();
    t.sayAll();
    expect(t.view('p2').me!.hard).toMatchObject({ answer: 'offered' });
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    expect(t.r.hard?.answer).toBe('timeout');
    expect(t.view('p2').me!.hard).toBeNull();
    t.timeout();
    expect(t.st.hardLog).toEqual([{ round: 1, playerId: 'p2', answer: 'timeout' }]);
    expect(hardTally(t.st)).toEqual({ offered: 1, accepted: 0, rate: 0 });
  });

  it('their own spoken ので reason is logged as said', () => {
    const t = new Table(3, ['n5', 'n4', 'n5']);
    t.start();
    t.sayAll();
    t.play('p2', { kind: 'hard', accept: true });
    t.sortLine();
    t.lockAll();
    expect(t.r.encore).toBe('hard');
    t.play('p2', { kind: 'defend', utterance: speech('ぼくの すきな じかん なので、ここです') });
    expect(t.r.hard).toMatchObject({ ok: true, framed: true, read: false });
    t.timeout();
    expect(t.s.phrasebook.p2!.find((e) => e.itemId.startsWith('narabete:defence:'))!.outcome).toBe('said');
  });

  it('spotlight: in a room of 4+, a lone N4 player who defended last round gets the next one off', () => {
    const t = new Table(4, ['n5', 'n4', 'n5', 'kana']);
    t.start();
    t.sayAll();
    t.play('p2', { kind: 'hard', accept: true });
    t.sortLine();
    t.lockAll();
    expect(t.r.encore).toBe('hard');
    t.play('p2', { kind: 'defend', pass: true });
    expect(t.s.phase).toBe('score');
    t.timeout();
    t.timeout();
    expect(t.s.phase).toBe('answer');
    t.sayAll();
    expect(t.r.hard).toBeNull();
    // A small room keeps offering it every round.
    const small = new Table(3, ['n5', 'n4', 'n5']);
    small.start();
    small.sayAll();
    small.play('p2', { kind: 'hard', accept: true });
    small.sortLine();
    small.lockAll();
    small.play('p2', { kind: 'defend', pass: true });
    small.timeout();
    small.timeout();
    small.sayAll();
    expect(small.r.hard?.playerId).toBe('p2');
  });

  it('“not this time” in the line-up skips it; a room with no N4 player never has it', () => {
    const t = new Table(3, ['n5', 'n4', 'n5']);
    t.start();
    t.sayAll();
    expect(t.play('p2', { kind: 'hard', accept: false }).error).toBeUndefined();
    expect(t.view('p2').me!.hard).toBeNull();
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    t.timeout();
    expect(hardTally(t.st)).toEqual({ offered: 1, accepted: 0, rate: 0 });

    const plain = new Table(3, ['kana', 'n5', 'n5']);
    plain.start();
    plain.sayAll();
    expect(plain.r.hard).toBeNull();
    plain.sortLine();
    plain.lockAll();
    expect(plain.s.phase).toBe('score');
  });

  it('rotates among N4 players; in a Feelings round the ordinary defence goes first, then the N4 one', () => {
    const t = new Table(3, ['n5', 'n4', 'n4']);
    t.start();
    t.sayAll();
    expect(t.r.hard?.playerId).toBe('p2');
    t.sortLine();
    t.lockAll(); // p2 doesn't answer the offer: it times out, no encore
    expect(t.s.phase).toBe('score');
    t.timeout();
    t.timeout();
    expect(t.r.kind).toBe('feel');
    t.sayAll();
    expect(t.r.hard?.playerId).toBe('p3');
    // p1 (N5) walks its card the furthest: the ordinary defence is theirs.
    const p1 = t.cardOf('p1');
    while (t.r.line.indexOf(p1.id) > 0) t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'move', dir: 1 });
    t.play('p1', { kind: 'move', dir: -1 });
    t.play('p3', { kind: 'hard', accept: true });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('defence');
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_defence' });
    expect(t.view().defence).toMatchObject({ playerId: 'p1', n4: false });
    expect(t.play('p1', { kind: 'defend', utterance: speech('ぜんぜん くさくない から です') }).error).toBeUndefined();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('hard');
    expect(t.view('p3').me!.defending).toBe(true);
    expect(t.play('p3', { kind: 'defend', utterance: speech('ちょっとだけ くさいので、これが いちばん さきです') }).error).toBeUndefined();
    expect(t.s.phase).toBe('score');
    expect(t.view().defence).toMatchObject({ playerId: 'p1', n4: false });
    expect(t.r.flip!.bonus.p1!).toBe(t.r.flip!.bonus.p3!);
    expect(t.r.flip!.bonus.p1!).toBeGreaterThan(t.r.flip!.bonus.p2!);
  });

  it('an N4 player who also moved the most defends once, with the N4 script', () => {
    const t = new Table(3, ['n4', 'n5', 'n5']);
    t.start();
    toFeelingsN4(t);
    t.sayAll();
    expect(t.r.hard?.playerId).toBe('p1');
    const p1 = t.cardOf('p1');
    while (t.r.line.indexOf(p1.id) > 0) t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'move', dir: 1 });
    t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'hard', accept: true });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.defence).toBeNull();
    expect(t.r.encore).toBe('hard');
    t.play('p1', { kind: 'defend', pass: true });
    expect(t.s.phase).toBe('score');
    // They took it, then passed at the mic: still a yes to the offer, with no bonus.
    expect(t.r.hard).toMatchObject({ answer: 'accepted', ok: false });
  });

  it('an N4 player who moved the most but left the offer open gives the ordinary defence', () => {
    const t = new Table(3, ['n4', 'n5', 'n5']);
    t.start();
    toFeelingsN4(t);
    t.sayAll();
    const p1 = t.cardOf('p1');
    while (t.r.line.indexOf(p1.id) > 0) t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'move', dir: 1 });
    t.play('p1', { kind: 'move', dir: -1 });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('defence');
    expect(t.r.hard?.answer).toBe('timeout');
  });
});

/** Through the Time Line (and its N4 defence, left to run out) to the first Feelings round. */
function toFeelingsN4(t: Table) {
  t.sayAll();
  t.sortLine();
  t.lockAll();
  if (t.s.phase === 'encore') t.timeout();
  t.timeout();
  t.timeout();
  expect(t.r.kind).toBe('feel');
}

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
