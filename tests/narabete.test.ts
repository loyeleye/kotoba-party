import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { withExperiments } from '../shared/src/modes/experiments.js';
import { normalizeReading, soundKey, type Utterance } from '../shared/src/japanese/kana.js';
import type { ContentLibrary } from '../shared/src/modes/mode.js';
import { FEEL_THEMES, feelThemesFor, TIME_SETS, timeSetsFor } from '../shared/src/modes/narabete/cards.js';
import { defenceScript } from '../shared/src/modes/narabete/defence.js';
import { curveballPoints, SAY_PICK, SPOKEN_REACTION_POINTS, STAND_IN_CURVEBALL_MS, standInSetupFor } from '../shared/src/modes/mixedRoom.js';
import {
  BONUS_POOL_SHARE,
  DEFENCE_KEY,
  DURATIONS,
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
import { bankVoice } from '../server/src/host.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { labelValue, narabetePolicy } from '../tools/bots/policies/narabete.js';
import { content as REAL_CONTENT, hashView, startServer, until } from './helpers.js';

// standInSetup's gap after the setup line, from its bank line (at least STAND_IN_SETUP_MS).
const SETUP_MS = standInSetupFor(REAL_CONTENT.hostLines, 'narabete_standin_setup');

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
  start(audience?: 'kids' | 'family' | 'cheeky', greenCar?: boolean) {
    if (audience) this.cmd('stage', { type: 'settings', audience });
    if (greenCar !== undefined) this.cmd('stage', { type: 'settings', greenCar });
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

describe('Narabete!: the N4 defence in a game (Green Car only)', () => {
  it('in the Green Car it is given in the line-up with no offer, defended in its own encore, and only they get the bonus for it', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    expect(t.s.greenCarOn).toBe(true);
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    // Already theirs: no offer card.
    expect(t.r.hard).toMatchObject({ playerId: 'p1', answer: 'accepted' });
    expect(t.view('p1').me!.hard).toMatchObject({ answer: 'accepted', script: null });
    expect(t.view('p2').me!.hard).toBeNull();
    expect(t.play('p2', { kind: 'hard', accept: true }).error).toBe('not-offered');
    t.sortLine();
    t.lockAll();
    // A Time Line has no ordinary defence, so the N4 one is the encore.
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('hard');
    expect(t.s.deadline! - t.now).toBe(DURATIONS.encoreN4);
    // Its own cue: an invitation by name, not "your card moved a lot".
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_hard', slots: { name: 'P1' } });
    expect(t.view().defence).toMatchObject({ playerId: 'p1', n4: true });
    expect(t.view().defence!.frame!.kana).toMatch(/^＿ので、/);
    const me = t.view('p1').me!;
    expect(me.defending).toBe(true);
    expect(me.hard!.script!.lines.length).toBeGreaterThanOrEqual(2);
    expect(t.view('p2').me!.defending).toBe(false);
    expect(t.play('p2', { kind: 'defend', pass: true }).error).toBe('not-yours');
    expect(t.play('p1', { kind: 'defend', utterance: speech(me.hard!.script!.lines[0]!.kana) }).error).toBeUndefined();
    // It landed: the commentary booth's replay, then the flip.
    expect(t.r.encore).toBe('replay');
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.r.hard).toMatchObject({ ok: true, framed: true, answer: 'accepted' });
    // Everyone said their card from memory: the N4 defender gets the defence share on top, nobody else changes.
    expect(t.r.flip!.bonus.p1!).toBeGreaterThan(t.r.flip!.bonus.p2!);
    expect(t.r.flip!.bonus.p2).toBe(t.r.flip!.bonus.p3);
    t.timeout();
    // Given, not offered: nothing in the offer log, and the Green Car's own rotation has it.
    expect(t.st.hardLog).toEqual([]);
    expect(hardTally(t.st)).toEqual({ offered: 0, accepted: 0, rate: null });
    expect(t.st.gcDefences).toEqual([{ round: 1, playerId: 'p1' }]);
    // A model line read off the phone goes in the phrasebook as seen, not said.
    expect(t.s.phrasebook.p1!.find((e) => e.itemId.startsWith('narabete:defence:'))!.outcome).toBe('seen');
  });

  it('is a Green Car move-out: a mixed room with N4 players never has it (no offer, no 15 s encore)', () => {
    for (const levels of [['n5', 'n4', 'n5'], ['n4', 'kana', 'n3', 'n5']] as Level[][]) {
      const t = new Table(levels.length, levels);
      t.start();
      expect(t.s.greenCarOn).toBe(false);
      t.sayAll();
      expect(t.r.hard ?? null).toBeNull();
      for (const id of t.ids_()) expect(t.view(id).me!.hard).toBeNull();
      expect(t.play('p2', { kind: 'hard', accept: true }).error).toBe('not-offered');
      t.sortLine();
      t.lockAll();
      expect(t.s.phase).toBe('score');
      t.timeout();
      expect(t.st.hardLog).toEqual([]);
    }
  });

  it('an all-N4+ room with the Green Car switched off never has it', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start(undefined, false);
    expect(t.s.greenCarOn).toBe(false);
    t.sayAll();
    expect(t.r.hard ?? null).toBeNull();
  });

  it('their own spoken ので reason is logged as said', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    t.sayAll();
    t.sortLine();
    t.lockAll();
    expect(t.r.encore).toBe('hard');
    t.play('p1', { kind: 'defend', utterance: speech('ぼくの すきな じかん なので、ここです') });
    expect(t.r.hard).toMatchObject({ ok: true, framed: true, read: false });
    t.timeout();
    expect(t.s.phrasebook.p1!.find((e) => e.itemId.startsWith('narabete:defence:'))!.outcome).toBe('said');
  });

  it('is given every round, in turn: fewest given first, then longest ago (a pass still counts as given)', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    const order: string[] = [];
    for (let round = 1; round <= 3; round++) {
      if (round > 1) {
        while (t.s.phase !== 'answer') t.timeout();
      }
      t.sayAll();
      order.push(t.r.hard!.playerId);
      expect(t.r.hard!.answer).toBe('accepted');
      t.sortLine();
      t.lockAll();
      while (t.s.phase === 'encore') {
        const on = t.r.encore === 'hard' ? t.r.hard!.playerId : t.r.defence?.playerId;
        if (on) t.play(on, { kind: 'defend', pass: true });
        else t.timeout();
      }
      expect(t.s.phase).toBe('score');
      t.timeout();
    }
    expect(order).toEqual(['p1', 'p2', 'p3']);
    expect(t.st.hardLog).toEqual([]);
    // A lone N4+ player with a card said gets it every round, with no spotlight rest.
    const lone = new Table(4, ['n4', 'n3', 'n3', 'n4']);
    lone.start();
    for (let round = 1; round <= 2; round++) {
      if (round > 1) {
        while (lone.s.phase !== 'answer') lone.timeout();
      }
      const card = lone.cardOf('p1');
      const tc = TIME_SETS.flatMap((x) => x.cards).find((x) => x.id === card.timeId);
      lone.play('p1', { kind: 'say', utterance: speech(tc ? tc.jp.kana : 'ちょっと ひどい です') });
      lone.timeout();
      expect(lone.s.phase).toBe('reveal');
      expect(lone.r.hard?.playerId, `round ${round}`).toBe('p1');
      lone.lockAll();
      while (lone.s.phase === 'encore') lone.timeout();
      lone.timeout();
    }
  });

  it('“not this time after all” in the line-up skips it, and stays out of the offer log', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    t.sayAll();
    expect(t.play('p1', { kind: 'hard', accept: false }).error).toBeUndefined();
    expect(t.view('p1').me!.hard).toBeNull();
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    t.timeout();
    expect(hardTally(t.st)).toEqual({ offered: 0, accepted: 0, rate: null });
  });

  it('in a Feelings round the ordinary defence goes first, then the N4 one', () => {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    toFeelingsN4(t);
    t.sayAll();
    expect(t.r.hard?.playerId).toBe('p2');
    // p1 walks its card the furthest: the ordinary defence is theirs.
    const p1 = t.cardOf('p1');
    while (t.r.line.indexOf(p1.id) > 0) t.play('p1', { kind: 'move', dir: -1 });
    t.play('p1', { kind: 'move', dir: 1 });
    t.play('p1', { kind: 'move', dir: -1 });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('defence');
    expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_defence' });
    expect(t.view().defence).toMatchObject({ playerId: 'p1', n4: false });
    expect(t.play('p1', { kind: 'defend', utterance: speech('ぜんぜん くさくない から です') }).error).toBeUndefined();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('hard');
    expect(t.view('p2').me!.defending).toBe(true);
    expect(t.play('p2', { kind: 'defend', utterance: speech('ちょっとだけ くさいので、これが いちばん さきです') }).error).toBeUndefined();
    expect(t.r.encore).toBe('replay');
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.view().defence).toMatchObject({ playerId: 'p1', n4: false });
    expect(t.r.flip!.bonus.p1!).toBe(t.r.flip!.bonus.p2!);
    expect(t.r.flip!.bonus.p1!).toBeGreaterThan(t.r.flip!.bonus.p3!);
  });

  /** The Feelings round's N4 defender moves their card the furthest. */
  function defenderMovesMost(t: Table): string {
    const d = t.r.hard!.playerId;
    const c = t.cardOf(d);
    while (t.r.line.indexOf(c.id) > 0) t.play(d, { kind: 'move', dir: -1 });
    t.play(d, { kind: 'move', dir: 1 });
    t.play(d, { kind: 'move', dir: -1 });
    return d;
  }

  it('an N4 defender who also moved the most defends once, with the N4 script', () => {
    const t = new Table(3, ['n4', 'n3', 'n3']);
    t.start();
    toFeelingsN4(t);
    t.sayAll();
    const d = defenderMovesMost(t);
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.defence).toBeNull();
    expect(t.r.encore).toBe('hard');
    t.play(d, { kind: 'defend', pass: true });
    expect(t.s.phase).toBe('score');
    expect(t.r.hard).toMatchObject({ answer: 'accepted', ok: false });
  });

  // The `narabeteFold` experiment: on (above), one defence; off, the ordinary defence and then the N4 encore.
  it('narabeteFold off: an N4 defender who also moved the most gives the ordinary defence, then the N4 one', () => {
    const restore = withExperiments({ narabeteFold: false });
    try {
      const t = new Table(3, ['n4', 'n3', 'n3']);
      t.start();
      toFeelingsN4(t);
      t.sayAll();
      const d = defenderMovesMost(t);
      t.lockAll();
      expect(t.r.encore).toBe('defence');
      expect(t.s.deadline! - t.now).toBe(DURATIONS.encore);
      expect(t.view().defence).toMatchObject({ playerId: d, n4: false });
      t.play(d, { kind: 'defend', pass: true });
      expect(t.s.phase).toBe('encore');
      expect(t.r.encore).toBe('hard');
      expect(t.view().defence).toMatchObject({ playerId: d, n4: true });
    } finally {
      restore();
    }
  });

  it('narabeteFold on: the folded defence goes straight to the N4 encore, with its frame', () => {
    const restore = withExperiments({ narabeteFold: true });
    try {
      const t = new Table(3, ['n4', 'n3', 'n3']);
      t.start();
      toFeelingsN4(t);
      t.sayAll();
      const d = defenderMovesMost(t);
      t.lockAll();
      expect(t.r.encore).toBe('hard');
      expect(t.s.deadline! - t.now).toBe(DURATIONS.encoreN4);
      expect(t.view().defence).toMatchObject({ playerId: d, n4: true });
      expect(t.view().defence!.frame?.text).toContain('ので');
      expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_hard' });
    } finally {
      restore();
    }
  });

  it('an N4 defender who moved the most but passed in the line-up gives the ordinary defence', () => {
    const t = new Table(3, ['n4', 'n3', 'n3']);
    t.start();
    toFeelingsN4(t);
    t.sayAll();
    const d = defenderMovesMost(t);
    t.play(d, { kind: 'hard', accept: false });
    t.lockAll();
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('defence');
    expect(t.view().defence).toMatchObject({ playerId: d, n4: false });
    expect(t.r.hard?.answer).toBe('declined');
  });
});

describe('Narabete!: the commentary booth (the N4 defence replayed)', () => {
  /** A Green Car Time Line, to the N4 defence's encore (p1 defends). */
  function toDefence(): Table {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    t.sayAll();
    t.sortLine();
    t.lockAll();
    expect(t.r.encore).toBe('hard');
    expect(t.r.hard!.playerId).toBe('p1');
    return t;
  }
  const replays = (t: Table) => t.s.cues.filter((c) => c.event === 'narabete_replay');

  it('once the ので line lands: the host says it on the TV with the ので lit (no gist: every phone is N4+)', () => {
    const t = toDefence();
    const model = t.view('p1').me!.hard!.script!.lines[0]!;
    t.now += 3_000;
    t.play('p1', { kind: 'defend', utterance: speech(model.kana) });
    expect(t.s.phase).toBe('encore');
    expect(t.r.encore).toBe('replay');
    // Within the 15 s encore: said 3 s in, the replay gets its 7 s.
    expect(t.s.deadline! - t.now).toBe(7_000);
    // Nobiko-san says the model line herself, once, with its subtitle; the defence stays on the TV too.
    expect(replays(t)).toHaveLength(1);
    expect(replays(t)[0]).toMatchObject({ host: 'nobiko', slots: { line: model.text, line_en: model.en } });
    const tv = t.view();
    expect(tv.defence).toMatchObject({ playerId: 'p1', n4: true, done: true });
    expect(tv.replay).toMatchObject({ playerId: 'p1', line: { text: model.text } });
    expect(tv.replay!.lit.key).toBe('ので');
    expect(tv.replay!.lit.before + 'ので' + tv.replay!.lit.after).toBe(model.text);
    expect(tv.replay!.note).toBe('ので = because: P1 gave the reason first, then where the card goes.');
    expect(JSON.stringify(tv.replay)).not.toMatch(/wrong|mistake|should|correct/i);
    // The gist is for Kana and N5 phones, and there are none in the Green Car.
    for (const id of t.ids_()) expect(t.view(id).me!.gist).toBeNull();
    // Then the flip, with no second replay.
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.view().replay).toBeNull();
    expect(replays(t)).toHaveLength(1);
  });

  it('said late, the replay runs at most 5 s past the encore', () => {
    const t = toDefence();
    t.now += 13_000;
    t.play('p1', { kind: 'defend', utterance: speech(t.view('p1').me!.hard!.script!.lines[1]!.kana) });
    expect(t.r.encore).toBe('replay');
    expect(t.s.deadline! - t.now).toBe(5_000);
  });

  it('their own ので line is replayed on the TV but never voiced', () => {
    const t = toDefence();
    t.play('p1', { kind: 'defend', utterance: speech('ぼくの すきな じかん なので、ここです') });
    expect(t.r.encore).toBe('replay');
    // The host speaks only fixed, checked lines, never what speech recognition heard.
    expect(replays(t)).toHaveLength(0);
    expect(t.view().replay!.lit).toEqual({ before: 'ぼくの すきな じかん な', key: 'ので', after: '、ここです。' });
  });

  it('no replay and no cue unless it landed: passed, typed, or said without ので', () => {
    for (const move of [
      { kind: 'defend', pass: true },
      { kind: 'defend', utterance: typed('はやいので、これが いちばん さきです') },
      { kind: 'defend', utterance: speech('ここが いいと おもいます') },
    ]) {
      const t = toDefence();
      t.play('p1', move);
      expect(t.s.phase).toBe('score');
      expect(replays(t)).toHaveLength(0);
      expect(t.r.replay ?? null).toBeNull();
    }
  });
});

/** Through the Time Line (and its N4 defence in the Green Car, left to run out) to the first Feelings round. */
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

  for (const [players, green] of [[3, false], [6, false], [4, true]] as const) {
    it(`${players} bots play every round with every client in sync${green ? ' (Green Car)' : ''}`, async () => {
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
            level: green ? (i % 2 ? 'n4' : 'n3') : i === 1 ? 'kana' : i === 3 ? 'n4' : 'n5',
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

// ---- mixed rooms: offer rotation, the Gallery, the booth's reaction, the host stand-in ----

describe('Narabete!: mixed rooms', () => {
  /** The N4 defence lives in the Green Car now: a Green Car Time Line, to its encore (p1 defends round 1). */
  function toDefence(): Table {
    const t = new Table(3, ['n4', 'n3', 'n4']);
    t.start();
    t.sayAll();
    expect(t.r.hard!.playerId).toBe('p1');
    t.sortLine();
    t.lockAll();
    expect(t.r.encore).toBe('hard');
    return t;
  }

  it('a mixed room has no N4 defence, so no Gallery and no curveball', () => {
    const t = new Table(3, ['kana', 'n4', 'n5']);
    t.start();
    t.sayAll();
    expect(t.r.hard ?? null).toBeNull();
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    expect(t.view().gallery).toEqual([]);
    for (const id of t.ids_()) expect(t.view(id).me!.gallery).toBeNull();
    expect(t.st.curveball).toBe(false);
  });

  it.each([true, false])('a Gallery player may say their reaction for a small bonus; a miss leaves the tiles to tap (spoken reaction: %s)', (on) => {
    onTestFinished(withExperiments({ spokenReaction: on }));
    const t = toDefence();
    const P = 'p2';
    const say = (text: string) => t.play(P, { kind: 'gallery', pick: SAY_PICK, utterance: { via: 'speech', text } });
    const before = t.score(P);
    if (!on) {
      // Switch off: a said reaction is refused, the tile offers no mic, and tapping works as before.
      expect(say('すごい！').error).toBe('bad-move');
      expect(t.view(P).me!.gallery).not.toHaveProperty('say');
      expect(t.play(P, { kind: 'gallery', pick: 'sugoi' }).error).toBeUndefined();
      expect(t.score(P)).toBe(before);
      return;
    }
    // Not while the defence is still being said: no 🎤, and a said reaction is refused (nobody talks over it).
    expect(t.view(P).me!.gallery).not.toHaveProperty('say');
    expect(say('すごい！').error).toBe('bad-move');
    // The defence lands: now it may be said.
    t.play('p1', { kind: 'defend', utterance: { via: 'speech', text: t.view('p1').me!.hard!.script!.lines[0]!.kana } });
    expect(t.r.encore).toBe('replay');
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: false } });
    // A miss: no tile, no points, nothing on the TV; the phone says to tap instead.
    expect(say('ありがとう').error).toBeUndefined();
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: true } });
    expect(t.score(P)).toBe(before);
    // A match (a little ending is fine): picks that tile, pays the bonus, shows a said bubble on the TV.
    expect(say('すごいね！').error).toBeUndefined();
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: 'sugoi', say: { said: true, missed: false } });
    expect(t.score(P) - before).toBe(SPOKEN_REACTION_POINTS);
    expect(t.view().gallery).toEqual([expect.objectContaining({ id: 'sugoi', said: true })]);
    // In the phrasebook as said, but read: the tile shows the kana.
    expect(t.s.phrasebook[P]?.find((e) => e.itemId === 'gallery-sugoi')).toMatchObject({ outcome: 'said', recall: 'read', kana: 'すごい！' });
    // One reaction a round, said or tapped.
    expect(say('なるほど').error).toBe('bad-move');
  });

  it('the Gallery in the Green Car: everyone but the defender gets a reaction tile, and no curveball (nobody is Kana or N5)', () => {
    const t = toDefence();
    expect(t.view('p2').me!.gallery!.kind).toBe('react');
    expect(t.view('p3').me!.gallery!.kind).toBe('react');
    expect(t.view('p1').me!.gallery).toBeNull();
    expect(t.play('p1', { kind: 'gallery', pick: 'sugoi' }).error).toBe('bad-move');
    t.play('p1', { kind: 'defend', utterance: speech(t.view('p1').me!.hard!.script!.lines[0]!.kana) });
    expect(t.r.encore).toBe('replay');
    expect(t.view('p2').me!.gallery!.kind).toBe('react');
    expect(t.view('p3').me!.gallery!.kind).toBe('react');
    expect(t.view().replay!.holdKey).toBe(false);
    expect(t.st.curveball).toBe(false);
    expect(t.play('p2', { kind: 'gallery', pick: 'sugoi' }).error).toBeUndefined();
    expect(t.play('p2', { kind: 'gallery', pick: 'warai' }).error).toBe('bad-move');
    expect(t.view().gallery.map((b) => b.id)).toEqual(['sugoi']);
    // Gone by the flip.
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.view().gallery).toEqual([]);
    expect(t.play('p3', { kind: 'gallery', pick: 'e' }).error).toBe('wrong-phase');
  });

  it('no Gallery during the ordinary defence, nor in a room where nobody took the N4 defence', () => {
    const plain = new Table(3, ['kana', 'n5', 'n5']);
    plain.start();
    toFeelingsN4(plain);
    plain.sayAll();
    const p1 = plain.cardOf('p1');
    while (plain.r.line.indexOf(p1.id) > 0) plain.play('p1', { kind: 'move', dir: -1 });
    plain.play('p1', { kind: 'move', dir: 1 });
    plain.play('p1', { kind: 'move', dir: -1 });
    plain.lockAll();
    expect(plain.r.encore).toBe('defence');
    expect(plain.view('p2').me!.gallery).toBeNull();
    expect(plain.view().gallery).toEqual([]);
    expect(plain.play('p2', { kind: 'gallery', pick: 'sugoi' }).error).toBe('wrong-phase');
  });

  it('the booth: Nobiko-san reacts (あらまあ) first, then says the model line a beat later', () => {
    const t = toDefence();
    t.play('p1', { kind: 'defend', utterance: speech(t.view('p1').me!.hard!.script!.lines[0]!.kana) });
    const events = t.s.cues.map((c) => c.event);
    const hooray = events.lastIndexOf('narabete_hooray');
    expect(hooray).toBeGreaterThanOrEqual(0);
    expect(events.lastIndexOf('narabete_replay')).toBeGreaterThan(hooray);
    expect(t.s.cues.find((c) => c.event === 'narabete_replay')!.atMs).toBe(DURATIONS.replayLineAt);
    expect(REAL_CONTENT.hostLines.some((l) => l.event === 'narabete_hooray' && l.jp.text.startsWith('あらまあ'))).toBe(true);
  });

  it('the host stand-in: a 2-player room with no N4 player hears one model defence, once a game', () => {
    onTestFinished(withExperiments({ standInSetup: false, standInCurveball: false }));
    const t = new Table(2, ['kana', 'n5']);
    t.start();
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    const cues = t.s.cues.filter((c) => c.event === 'narabete_standin');
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ host: 'nobiko', atMs: DURATIONS.standInAt });
    const tv = t.view().standIn!;
    expect(tv.line.text).toBe(cues[0]!.slots!.line);
    expect(tv.line.text).toMatch(/ので、これが いちばん あとです。$/);
    expect(tv.lit.key).toBe(DEFENCE_KEY);
    expect(tv.ms).toBeGreaterThanOrEqual(5_000);
    expect(tv.ms).toBeLessThanOrEqual(7_000);
    expect(DURATIONS.standInAt + tv.ms).toBeLessThan(DURATIONS.reveal);
    expect(t.view('p1').me!.standIn!.romaji).toBeTruthy();
    expect(t.view('p2').me!.standIn).toMatchObject({ kana: tv.line.kana, romaji: null });
    // Nobody is asked to say it: no offer, no encore, no points.
    expect(t.r.hard ?? null).toBeNull();
    t.sortLine();
    t.lockAll();
    expect(t.s.phase).toBe('score');
    // Once a game.
    t.timeout();
    t.timeout();
    t.sayAll();
    expect(t.s.phase).toBe('reveal');
    expect(t.view().standIn).toBeNull();
    expect(t.s.cues.filter((c) => c.event === 'narabete_standin')).toHaveLength(1);
  });

  describe('the stand-in experiments', () => {
    const wake = (t: Table) => {
      const at = wakeAt(t.s, t.ctx());
      expect(at).not.toBeNull();
      t.now = at!;
      t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    };

    it('standInSetup: her setup line where the defence began, the defence 2.5 s later, inside the line-up', () => {
      onTestFinished(withExperiments({ standInSetup: true, standInCurveball: false }));
      const t = new Table(2, ['kana', 'n5']);
      t.start();
      t.sayAll();
      const ours = t.s.cues.filter((c) => c.event.startsWith('narabete_standin'));
      expect(ours.map((c) => [c.event, c.atMs])).toEqual([
        ['narabete_standin_setup', DURATIONS.standInAt],
        ['narabete_standin', DURATIONS.standInAt + SETUP_MS],
      ]);
      expect(t.view().standIn!.atMs).toBe(DURATIONS.standInAt + SETUP_MS);
      expect(t.s.deadline! - t.now).toBe(DURATIONS.reveal);
      expect(t.view('p1').me!.gallery).toBeNull();
      t.sortLine();
      t.lockAll();
      expect(t.s.phase).toBe('score');
    });

    it('standInCurveball: she starts at once (no "line them up"), a tile for both, then the curveball on ので', () => {
      onTestFinished(withExperiments({ standInSetup: false, standInCurveball: true }));
      const t = new Table(2, ['kana', 'n5']);
      t.start();
      t.sayAll();
      const start = t.now;
      // The strip stays up through the curveball's window, so its ms runs that much past the line.
      const ms = t.view().standIn!.ms - STAND_IN_CURVEBALL_MS;
      expect(t.s.cues.at(-1)).toMatchObject({ event: 'narabete_standin', atMs: DURATIONS.standInEarlyAt });
      expect(t.s.cues.filter((c) => c.event === 'narabete_order')).toHaveLength(0);
      expect(t.s.deadline! - start).toBe(DURATIONS.reveal);
      expect(t.view('p1').me!.gallery).toMatchObject({ kind: 'react' });
      expect(t.view().standIn!.holdKey).toBe(true);
      expect(t.view('p2').me!.standIn).toBeNull();
      expect(t.play('p2', { kind: 'gallery', pick: 'warai' }).error).toBeUndefined();
      expect(t.view().gallery.map((b) => b.id)).toEqual(['warai']);
      wake(t);
      expect(t.now).toBe(start + DURATIONS.standInEarlyAt + ms);
      expect(t.view('p1').me!.gallery!.kind).toBe('curveball');
      expect(t.view('p2').me!.standIn).toMatchObject({ romaji: null });
      expect(t.view('p1').me!.standIn).toBeNull();
      const before = t.score('p1');
      expect(t.play('p1', { kind: 'gallery', pick: DEFENCE_KEY }).error).toBeUndefined();
      expect(t.score('p1')).toBe(before + curveballPoints('narabete'));
      expect(t.st.curveball).toBe(true);
      expect(t.s.phase).toBe('reveal');
    });

    it('standInCurveball never holds the line-up: locked while she speaks, it ends and the Gallery carries into the score', () => {
      onTestFinished(withExperiments({ standInSetup: true, standInCurveball: true }));
      const t = new Table(2, ['kana', 'n5']);
      t.start();
      t.sayAll();
      const start = t.now;
      const st = t.st.standIn!;
      expect(st.atMs).toBe(DURATIONS.standInEarlyAt + SETUP_MS);
      // She has started her line; everyone locks: the line-up ends at once.
      t.now = start + st.atMs + 1_000;
      t.sortLine();
      t.lockAll();
      expect(t.s.phase).toBe('score');
      expect(t.view('p1').me!.gallery).toMatchObject({ kind: 'react' });
      wake(t);
      expect(t.now).toBe(start + st.atMs + st.c.ms);
      const who = t.st.standIn!.sg!.g.curveball!.playerId;
      expect(t.play(who, { kind: 'gallery', pick: DEFENCE_KEY }).error).toBeUndefined();
      expect(t.score(who)).toBeGreaterThanOrEqual(curveballPoints('narabete'));
      // Gone with the score.
      t.timeout();
      expect(t.s.phase).toBe('prompt');
      expect(t.st.standIn!.sg).toBeNull();
    });

    it('standInCurveball: a line-up locked before she got to her line drops the Gallery and the curveball', () => {
      onTestFinished(withExperiments({ standInSetup: false, standInCurveball: true }));
      const t = new Table(2, ['kana', 'n5']);
      t.start();
      t.sayAll();
      t.sortLine();
      t.lockAll();
      expect(t.s.phase).toBe('score');
      expect(t.st.standIn!.sg).toBeNull();
      expect(t.view('p1').me!.gallery).toBeNull();
      expect(t.st.curveball).toBe(false);
    });

    it('stays out of rooms with an N4 player, and of 3+ rooms', () => {
      onTestFinished(withExperiments({ standInSetup: true, standInCurveball: true }));
      for (const levels of [['n4', 'n5'], ['kana', 'n5', 'n5']] as Level[][]) {
        const t = new Table(levels.length, levels);
        t.start();
        t.sayAll();
        expect(t.s.cues.some((c) => c.event === 'narabete_standin_setup')).toBe(false);
        expect(t.view('p2').me!.gallery).toBeNull();
      }
    });
  });

  it('no stand-in with an N4 player, or with 3+ players; an N5-only 3+ room sees nothing new', () => {
    for (const levels of [['n4', 'n5'], ['kana', 'n5', 'n5']] as Level[][]) {
      const t = new Table(levels.length, levels);
      t.start();
      t.sayAll();
      expect(t.view().standIn).toBeNull();
      expect(t.s.cues.some((c) => c.event === 'narabete_standin')).toBe(false);
      for (const id of t.ids_()) expect(t.view(id).me!.standIn).toBeNull();
    }
  });

  it('every Feelings theme says whether its word is a な-adjective, and たいへん is', () => {
    for (const theme of FEEL_THEMES) expect(typeof theme.na).toBe('boolean');
    expect(FEEL_THEMES.filter((x) => x.na).every((x) => x.more.kana === 'たいへん')).toBe(true);
    expect(FEEL_THEMES.filter((x) => x.more.kana === 'たいへん').every((x) => x.na)).toBe(true);
    // The flag decides, not the word's last kana: しずか ends in か, which looked like a verb ending.
    const quiet = { more: { text: 'しずか', kana: 'しずか', en: 'quieter' }, na: true };
    expect(defenceScript({ theme: quiet }, 3, 4, 'Aki').lines[0]!.kana).toContain('しずかなので');
    const smelly = { more: { text: 'くさい', kana: 'くさい', en: 'smellier' }, na: false };
    expect(defenceScript({ theme: smelly }, 3, 4, 'Aki').lines[0]!.kana).toContain('くさいので');
  });
});
