import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { hasKanji } from '../shared/src/japanese/kana.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { hasJapanese, matchLine, namesPlace } from '../shared/src/modes/tourist/check.js';
import { ALL_LINES, BLUFFS, KINDS, PLACES, QUESTIONS, SAFE_ANSWERS } from '../shared/src/modes/tourist/places.js';
import {
  ANSWER_BONUS,
  ASK_BONUS,
  BONUS_POOL_SHARE,
  CALLER_POINTS,
  CHOICES,
  ESCAPE_POINTS,
  GUESS_BONUS,
  GUESS_POINTS,
  LAST_CHANCE_POINTS,
  ROUND_STAKE,
  SHARP_EYE_POINTS,
  turnCap,
  WIN_POINTS,
  type TouristState,
  type TouristView,
} from '../shared/src/modes/tourist/tourist.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { touristPolicy } from '../tools/bots/policies/tourist.js';
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
    readonly content: ContentLibrary = REAL_CONTENT,
    seed = 7,
    levels: Level[] = [],
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
  get st(): TouristState {
    return this.s.modeState as TouristState;
  }
  view(viewer: string | 'stage' = 'stage'): TouristView {
    const v = viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
    return v.game as TouristView;
  }
  roomView(viewer: string | 'stage' = 'stage'): RoomView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(rounds?: number, packId = 'travel') {
    expect(this.cmd('stage', { type: 'start', mode: 'tourist', packId, ...(rounds ? { rounds } : {}) }).changed).toBe(true);
    this.timeout(); // intro → card
    expect(this.s.phase).toBe('prompt');
  }
  /** Everyone taps Got it: card → first question turn. */
  cards() {
    for (const p of this.s.players) this.play(p.id, { kind: 'ready' });
    expect(this.s.phase).toBe('answer');
  }
  get tourist(): string {
    return this.st.touristId;
  }
  get locals(): string[] {
    return this.s.players.map((p) => p.id).filter((id) => id !== this.tourist);
  }
  get asker(): string {
    return this.st.turn!.askerId;
  }
  /** Someone the current asker may ask (preferring `want`). */
  targetFor(want?: string): string {
    const t = this.st.turn!;
    const ok = (id: string) => id !== t.askerId && id !== t.noAskBack;
    if (want && ok(want)) return want;
    return this.s.players.map((p) => p.id).find(ok)!;
  }
  /** One full turn: ask (a tile, spoken) and answer (a tile, spoken). */
  turn(want?: string) {
    const target = this.targetFor(want);
    const asker = this.asker;
    const q = this.view(asker).me!.questions![0]!;
    expect(this.play(asker, { kind: 'ask', targetId: target, utterance: speech(q.kana), lineId: q.id }).error).toBeUndefined();
    const a = this.view(target).me!.answers![0]!;
    expect(this.play(target, { kind: 'reply', utterance: speech(a.kana), lineId: a.id }).error).toBeUndefined();
    return { asker, target };
  }
  /** Calls a vote and has everyone vote as `ballots` says (default: for the tourist). */
  vote(caller: string, ballots?: Record<string, string>) {
    expect(this.play(caller, { kind: 'call' }).error).toBeUndefined();
    expect(this.s.phase).toBe('reveal');
    for (const p of this.s.players) {
      const suspect = ballots?.[p.id] ?? (p.id === this.tourist ? this.locals[0]! : this.tourist);
      this.play(p.id, { kind: 'vote', suspectId: suspect });
    }
  }
}

const speech = (text: string) => ({ via: 'speech' as const, text });
const typed = (text: string) => ({ via: 'typed' as const, text });

// ---- content and the checks ----

describe("Who's the Tourist?: content", () => {
  it('has 12 draft places, 4 per topic pack, each with roles and answers for every kind', () => {
    expect(PLACES.length).toBe(12);
    for (const pack of ['food', 'travel', 'family']) expect(PLACES.filter((p) => p.packId === pack).length).toBe(4);
    for (const p of PLACES) {
      expect(p.status).toBe('draft');
      expect(p.roles.length).toBeGreaterThanOrEqual(5);
      expect(p.questions.length).toBeGreaterThanOrEqual(3);
      for (const kind of KINDS.filter((k) => k !== 'yesno')) {
        expect(p.answers.some((a) => a.kind === kind && a.level === 'kana'), `${p.id} ${kind} kana`).toBe(true);
        expect(p.answers.some((a) => a.kind === kind && a.level === 'n5'), `${p.id} ${kind} n5`).toBe(true);
      }
    }
  });

  it('every line has a unique id, a kana reading without kanji, and kana-level text in kana', () => {
    const ids = ALL_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of ALL_LINES) {
      expect(hasKanji(l.jp.kana), l.id).toBe(false);
      expect(l.jp.en.length, l.id).toBeGreaterThan(0);
      if (l.level === 'kana') expect(hasKanji(l.jp.text), l.id).toBe(false);
    }
    for (const p of PLACES) expect(hasKanji(p.name.kana)).toBe(false);
    // Generic lines cover every kind at the Kana and N5 levels, so the tourist always has an answer.
    for (const kind of KINDS) {
      expect(SAFE_ANSWERS.some((a) => a.kind === kind && a.level === 'kana'), kind).toBe(true);
      expect(SAFE_ANSWERS.some((a) => a.kind === kind && a.level === 'n5'), kind).toBe(true);
    }
    expect(QUESTIONS.filter((q) => q.level === 'kana').length).toBeGreaterThanOrEqual(5);
    expect(BLUFFS.every((b) => b.kind === 'any')).toBe(true);
  });

  it('matches what was said to a known frame, kindly, but never a tiny frame inside a long sentence', () => {
    const doko = QUESTIONS.find((q) => q.id === 'tourist.q.koko-nani')!;
    expect(matchLine(speech('えっと、ここで なにを しますか'), ALL_LINES, 'n5')?.id).toBe(doko.id);
    expect(matchLine({ via: 'speech', text: 'ここで何をしますか', reading: 'ここでなにをしますか' }, ALL_LINES, 'n5')?.id).toBe(doko.id);
    // A recogniser slip still finds it.
    expect(matchLine(speech('ここで なにお しまか'), ALL_LINES, 'n5')?.id).toBe(doko.id);
    expect(matchLine(speech('はい！'), ALL_LINES, 'kana')?.id).toBe('tourist.a.hai');
    expect(matchLine(speech('はいります。きもちいい'), SAFE_ANSWERS, 'n5')).toBeNull();
    expect(matchLine(speech('ぜんぜん ちがう はなし'), ALL_LINES, 'n5')).toBeNull();
    expect(hasJapanese('hello')).toBe(false);
    expect(hasJapanese('えき')).toBe(true);
    expect(namesPlace(speech('ここは えき ですか'), 'えき')).toBe(true);
    expect(namesPlace({ via: 'speech', text: 'ここは温泉ですか', reading: 'ここはおんせんですか' }, 'おんせん')).toBe(true);
    expect(namesPlace(speech('ここは うち ですか'), 'いえ', ['うち'])).toBe(true);
    expect(namesPlace(speech('ここは ホテル ですか'), 'おんせん')).toBe(false);
  });

  it('turns per round grow with the room, 6 to 10', () => {
    expect(turnCap(3)).toBe(6);
    expect(turnCap(5)).toBe(8);
    expect(turnCap(8)).toBe(10);
  });
});

// ---- the rules ----

describe("Who's the Tourist?: a round", () => {
  it('deals one tourist with no card; every local sees the same place; the stage sees neither', () => {
    const t = new Table(5);
    t.start();
    const place = t.st.placeId;
    expect(t.st.choices.length).toBe(CHOICES);
    expect(t.st.choices).toContain(place);
    // The night's pack (travel) leads, and fills most of the choices.
    expect(PLACES.find((p) => p.id === place)!.packId).toBe('travel');
    const tv = t.view(t.tourist);
    expect(tv.me!.tourist).toBe(true);
    expect(tv.me!.card).toBeNull();
    expect(JSON.stringify(tv)).not.toContain(`"card":{`);
    expect(tv.me!.bluffs!.length).toBeGreaterThan(0);
    for (const id of t.locals) {
      const v = t.view(id);
      expect(v.me!.tourist).toBe(false);
      expect(v.me!.card!.place.id).toBe(place);
      expect(v.me!.bluffs).toBeNull();
    }
    const stage = JSON.stringify(t.view('stage'));
    expect(t.view('stage').me).toBeNull();
    expect(t.view('stage').outcome).toBeNull();
    expect(stage).not.toContain(t.tourist);
    // No view says who the tourist is except the tourist's own.
    for (const id of t.locals) expect(JSON.stringify(t.view(id))).not.toContain(`"tourist":true`);
  });

  it('runs question turns: the answerer asks next, never straight back; the log carries subtitles', () => {
    const t = new Table(4);
    t.start();
    t.cards();
    const { asker, target } = t.turn();
    expect(t.s.phase).toBe('answer');
    expect(t.asker).toBe(target);
    expect(t.st.turn!.noAskBack).toBe(asker);
    expect(t.play(target, { kind: 'pick', targetId: asker }).error).toBe('bad-target');
    expect(t.play(asker, { kind: 'pick', targetId: target }).error).toBe('not-your-turn');
    const log = t.view('stage').log;
    expect(log.length).toBe(1);
    expect(log[0]!.question.en).toBeTruthy();
    expect(log[0]!.answer!.en).toBeTruthy();
    expect(log[0]!.question.spoken).toBe(true);

    // In their own words, not a known frame: logged as heard, no subtitle.
    const next = t.targetFor();
    t.play(t.asker, { kind: 'ask', targetId: next, utterance: speech('ねこは いますか') });
    expect(t.view('stage').turn!.question).toMatchObject({ text: 'ねこは いますか', en: null, ownWords: true });
    expect(t.play(next, { kind: 'reply', utterance: typed('いません') }).error).toBeUndefined();
  });

  it('pays speaking bonuses by how it was said, from a capped pool', () => {
    const t = new Table(3);
    t.start();
    t.cards();
    const a = t.asker;
    const b = t.targetFor();
    const q = t.view(a).me!.questions![0]!;
    // A tap earns nothing; a tile said aloud earns the frame bonus; own words earn the most.
    t.play(a, { kind: 'ask', targetId: b, utterance: { via: 'tap', text: q.text }, lineId: q.id });
    expect(t.score(a)).toBe(0);
    const ans = t.view(b).me!.answers![0]!;
    t.play(b, { kind: 'reply', utterance: speech(ans.kana), lineId: ans.id });
    expect(t.score(b)).toBe(ANSWER_BONUS.frame.speech);
    const c = t.targetFor();
    t.play(b, { kind: 'ask', targetId: c, utterance: speech('ねこは すきですか？') });
    expect(t.score(b)).toBe(ANSWER_BONUS.frame.speech + ASK_BONUS.own.speech);
    // It sounded close to ここは すきですか: shown as heard, with that line's meaning as a guess.
    expect(t.view('stage').turn!.question).toMatchObject({ text: 'ねこは すきですか？', approx: true, ownWords: true });
    // English typed in: logged, no bonus.
    t.play(c, { kind: 'reply', utterance: typed('yes I do') });
    expect(t.score(c)).toBe(0);

    // Keep talking: nobody's bonus passes 30% of the round's stake.
    for (let i = 0; i < 8 && t.s.phase === 'answer'; i++) {
      const asker = t.asker;
      const target = t.targetFor();
      t.play(asker, { kind: 'ask', targetId: target, utterance: speech('いぬと ねこ、どっちが すきですか') });
      if (t.s.phase === 'answer') t.play(target, { kind: 'reply', utterance: speech('いぬが すきです、ほんとうに') });
    }
    for (const p of t.s.players) expect(t.st.bonusUsed[p.id] ?? 0).toBeLessThanOrEqual(BONUS_POOL_SHARE * ROUND_STAKE);
    expect(Math.max(...t.s.players.map((p) => t.st.bonusUsed[p.id] ?? 0))).toBe(BONUS_POOL_SHARE * ROUND_STAKE);
  });

  it('a called vote with a majority catches the tourist; the last chance still pays', () => {
    const t = new Table(4);
    t.start();
    t.cards();
    t.turn();
    const [caller, other] = t.locals as [string, string];
    const before = Object.fromEntries(t.s.players.map((p) => [p.id, t.score(p.id)]));
    t.vote(caller);
    expect(t.s.phase).toBe('encore');
    const enc = t.view('stage');
    expect(enc.outcome!.touristId).toBe(t.tourist);
    expect(enc.outcome!.place).toBeNull(); // still secret while the tourist guesses
    expect(t.view(t.tourist).me!.canGuess).toBe(true);
    t.play(t.tourist, { kind: 'guess', placeId: t.st.placeId, utterance: speech(`ここは ${PLACES.find((p) => p.id === t.st.placeId)!.name.kana} ですか`) });
    expect(t.s.phase).toBe('score');
    const gain = (id: string) => t.score(id) - before[id]!;
    expect(gain(caller)).toBe(WIN_POINTS + SHARP_EYE_POINTS + CALLER_POINTS);
    expect(gain(other)).toBe(WIN_POINTS + SHARP_EYE_POINTS);
    expect(gain(t.tourist)).toBe(LAST_CHANCE_POINTS + GUESS_BONUS.speech);
    const out = t.view('stage').outcome!;
    expect(out.how).toBe('caught');
    expect(out.place!.id).toBe(t.st.placeId);
    expect(out.lastChance!.right).toBe(true);
    expect(out.ballots.length).toBe(4);
  });

  it('a called vote without a majority goes back to the questions; each player calls once', () => {
    const t = new Table(4);
    t.start();
    t.cards();
    const [l1, l2, l3] = t.locals as [string, string, string];
    // Two for the tourist, two for a local: no majority.
    t.vote(l1, { [l1]: t.tourist, [l2]: t.tourist, [l3]: l1, [t.tourist]: l1 });
    expect(t.s.phase).toBe('answer');
    expect(t.view('stage').failedVote).not.toBeNull();
    expect(t.view(l1).me!.canCall).toBe(false);
    expect(t.play(l1, { kind: 'call' }).error).toBe('already-called');
    expect(t.view(l2).me!.canCall).toBe(true);
  });

  it('voting out a local lets the tourist escape; locals who saw through it still score', () => {
    const t = new Table(4);
    t.start();
    t.cards();
    const [l1, l2, l3] = t.locals as [string, string, string];
    t.vote(l1, { [l1]: l2, [l2]: l3, [l3]: l2, [t.tourist]: l2 });
    expect(t.s.phase).toBe('score');
    expect(t.view('stage').outcome!.how).toBe('wrong-person');
    expect(t.score(t.tourist)).toBe(ESCAPE_POINTS);
    expect(t.score(l1)).toBe(0);
  });

  it('the tourist can guess at any time: right wins big, wrong hands the locals the round', () => {
    const t = new Table(3, REAL_CONTENT, 3);
    t.start(2);
    t.cards();
    expect(t.play(t.locals[0]!, { kind: 'guess', placeId: t.st.placeId }).error).toBe('not-eligible');
    t.play(t.tourist, { kind: 'guess', placeId: t.st.placeId });
    expect(t.s.phase).toBe('score');
    expect(t.score(t.tourist)).toBe(GUESS_POINTS);
    t.timeout(); // round 2 (the last: double)
    t.cards();
    const wrong = t.st.choices.find((id) => id !== t.st.placeId)!;
    const before = Object.fromEntries(t.s.players.map((p) => [p.id, t.score(p.id)]));
    t.play(t.tourist, { kind: 'guess', placeId: wrong });
    expect(t.view('stage').outcome!.how).toBe('wrong-guess');
    for (const id of t.locals) expect(t.score(id) - before[id]!).toBe(WIN_POINTS * 2);
    t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  it('after the last turn comes a final vote; a tie lets the tourist go', () => {
    const t = new Table(4);
    t.start();
    t.cards();
    for (let i = 0; i < t.st.turnCap; i++) t.turn();
    expect(t.s.phase).toBe('reveal');
    expect(t.st.vote!.kind).toBe('final');
    const [l1, l2, l3] = t.locals as [string, string, string];
    t.play(l1, { kind: 'vote', suspectId: t.tourist });
    t.play(l2, { kind: 'vote', suspectId: t.tourist });
    t.play(l3, { kind: 'vote', suspectId: l1 });
    t.play(t.tourist, { kind: 'vote', suspectId: l1 });
    expect(t.s.phase).toBe('score');
    expect(t.view('stage').outcome!.how).toBe('escaped');
    expect(t.score(t.tourist)).toBeGreaterThanOrEqual(ESCAPE_POINTS);
    // The two who voted right still get their sharp-eye points.
    expect(t.score(l1)).toBeGreaterThanOrEqual(SHARP_EYE_POINTS);
  });

  it('skips a turn nobody uses, and rejects late moves from an earlier turn as a race', () => {
    const t = new Table(3);
    t.start();
    t.cards();
    const first = t.asker;
    const seq = t.st.turn!.seq;
    t.timeout();
    expect(t.s.phase).toBe('answer');
    expect(t.asker).not.toBe(first);
    expect(t.st.turnsDone).toBe(1);
    expect(t.play(first, { kind: 'ask', targetId: t.asker, utterance: speech('すきですか'), turn: seq }).error).toBe('wrong-phase');
  });

  it('rotates the tourist so everyone gets a go', () => {
    const t = new Table(3, REAL_CONTENT, 11);
    t.start(3);
    const tourists: string[] = [];
    for (let r = 0; r < 3; r++) {
      tourists.push(t.tourist);
      t.cards();
      t.play(t.tourist, { kind: 'guess', placeId: t.st.placeId });
      t.timeout();
    }
    expect(new Set(tourists).size).toBe(3);
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap!.awards.length).toBeGreaterThan(0);
    // Places don't repeat within a game.
  });

  it('the VIP can hide a line; the tourist leaving ends the round without points', () => {
    const t = new Table(4);
    t.start(2);
    t.cards();
    t.turn();
    expect(t.play('p2', { kind: 'hide', index: 0 }).error).toBe('not-vip');
    t.play('p1', { kind: 'hide', index: 0 });
    expect(t.view('stage').log[0]!.question.text).toBe('[hidden]');
    const tourist = t.tourist;
    t.act({ type: 'release', playerId: tourist });
    expect(t.s.phase).toBe('score');
    expect(t.view('stage').outcome!.how).toBe('left');
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    expect(t.tourist).not.toBe(tourist);
    for (let i = 0; i < 60 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  it('a Kana-level player gets romaji on places and tiles, and works with no pack content loaded', () => {
    const t = new Table(3, EMPTY_CONTENT, 5, ['kana', 'kana', 'kana']);
    t.start(1, 'food');
    t.cards();
    const v = t.view(t.asker);
    expect(v.places[0]!.romaji).toBeTruthy();
    expect(v.me!.questions!.length).toBeGreaterThan(0);
    for (const q of v.me!.questions!) {
      expect(q.romaji).toBeTruthy();
      expect(ALL_LINES.find((x) => x.id === q.id)!.level).toBe('kana');
    }
    expect(t.view('stage').places[0]!.romaji).toBeUndefined();
  });

  it('suggests answers that fit the question, and only safe ones to the tourist', () => {
    const t = new Table(4, REAL_CONTENT, 9);
    t.start();
    t.cards();
    for (let i = 0; i < 4; i++) {
      const asker = t.asker;
      const target = t.targetFor();
      const q = QUESTIONS.find((x) => x.id === 'tourist.q.itsu')!; // いつ: a 'when' question
      t.st.turn!.qSuggest = [q.id];
      t.play(asker, { kind: 'ask', targetId: target, utterance: speech(q.jp.kana), lineId: q.id });
      const answers = t.view(target).me!.answers!;
      const lines = answers.map((a) => ALL_LINES.find((l) => l.id === a.id)!);
      expect(lines.every((l) => l.kind === 'when' || l.kind === 'any' || l.kind === 'yesno')).toBe(true);
      if (target === t.tourist) {
        const placeLines = new Set(PLACES.flatMap((p) => p.answers.map((a) => a.id)));
        expect(lines.some((l) => placeLines.has(l.id))).toBe(false);
      }
      t.play(target, { kind: 'reply', utterance: speech(answers[0]!.kana), lineId: answers[0]!.id });
    }
  });
});

// ---- full system: bots play a whole game through the real server ----

describe("Who's the Tourist?: bots play a game end to end", () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      durations: { intro: 20, prompt: 150, answer: 400, reveal: 200, encore: 150, score: 30 },
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
      let questions = 0;
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 3,
        totalRounds: 1_000,
        mode: 'tourist',
        packId: 'food',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          const g = view.game as TouristView | null;
          if (g?.mode === 'tourist') questions = Math.max(questions, g.log.length);
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const bots: Bot[] = [];
      for (let i = 1; i <= players; i++) {
        bots.push(
          await Bot.join({
            baseUrl,
            code: created.code,
            name: `bot${i}`,
            policy: touristPolicy({ seed: i, delayMs: [5, 120], quiet: (id) => id.endsWith('2'), callRate: 0.3 }),
            level: i === 1 ? 'kana' : i === 3 ? 'n4' : 'n5',
            onState: (bot, view, v) => record(bot.playerId, view, v),
          }),
        );
      }
      await until(() => finished, 60_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['intro', 'prompt', 'answer', 'score', 'recap']) expect(phases, p).toContain(p);
      expect(questions).toBeGreaterThan(0);

      // Every accepted state matches what the server committed for that viewer.
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      expect(standings.reduce((n, s) => n + s.score, 0)).toBeGreaterThan(0);

      // No move failed except harmless races with the phase clock.
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(10);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
