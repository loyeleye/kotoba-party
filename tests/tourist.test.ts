import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { hasKanji, toHiragana } from '../shared/src/japanese/kana.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { hasJapanese, matchLine, namesPlace, oneWordChanged, saysLine } from '../shared/src/modes/tourist/check.js';
import { createReader } from '../server/src/reading.js';
import { toRomaji as toRomajiOf } from '../shared/src/japanese/romaji.js';
import { setReading } from '../server/src/utterances.js';
import { ALL_LINES, BLUFFS, KINDS, PLACES, QUESTIONS, SAFE_ANSWERS } from '../shared/src/modes/tourist/places.js';
import { GREEN_LINES, GREEN_PLACE_LINES, GREEN_PLACES } from '../shared/src/modes/tourist/rules.js';
import { framesOf } from '../shared/src/japanese/frames.js';
import { phraseFrames } from '../shared/src/progress.js';
import {
  ANSWER_BONUS,
  ASK_BONUS,
  BONUS_POOL_SHARE,
  CALLER_POINTS,
  CHOICES,
  CUE_CHIPS,
  cueChip,
  CUE_LEVELS,
  ESCAPE_POINTS,
  GUESS_BONUS,
  GUESS_POINTS,
  LAST_CHANCE_POINTS,
  ROUND_STAKE,
  SHARP_EYE_POINTS,
  turnCap,
  WIN_POINTS,
  placesFor,
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
  /** `greenCar: false` keeps an all-N4+ table out of the Green Car (the mixed-room rules). */
  start(rounds?: number, packId = 'travel', opts: { greenCar?: boolean; audience?: 'kids' | 'family' | 'cheeky' } = {}) {
    if (opts.audience) this.cmd('stage', { type: 'settings', audience: opts.audience });
    if (opts.greenCar === false) expect(this.cmd('stage', { type: 'settings', greenCar: false }).changed).toBe(true);
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

  it('furigana: a line whose reading lines up with its kanji more than one way carries hand-written segments', () => {
    // かいしゃの 人と 行きます / ひとと いきます also lines up as 人=ひ, 行=とい; autoFurigana takes the first.
    const read = (s: string) => hasKanji(s) || /[0-9０-９]/.test(s); // what autoFurigana reads from the kana
    const ways = (text: string, kana: string): number => {
      const runs = [...text].reduce<string[]>((rs, ch) => {
        const last = rs.at(-1);
        if (last !== undefined && read(last[0]!) === read(ch)) rs[rs.length - 1] = last + ch;
        else rs.push(ch);
        return rs;
      }, []);
      const norm = (s: string) => toHiragana(s).replace(/[\s　]/g, '');
      const reading = norm(kana);
      const count = (r: number, p: number): number => {
        if (r === runs.length) return p === reading.length ? 1 : 0;
        const run = runs[r]!;
        if (!read(run)) return reading.startsWith(norm(run), p) ? count(r + 1, p + norm(run).length) : 0;
        let n = 0;
        for (let len = 1; len <= Math.min(reading.length - p, run.length * 4); len++) n += count(r + 1, p + len);
        return n;
      };
      return count(0, 0);
    };
    const all = [...ALL_LINES.map((l) => [l.id, l.jp] as const), ...PLACES.flatMap((p) => [[p.id, p.name] as const, ...p.roles.map((r) => [p.id, r] as const)])];
    for (const [id, jp] of all) if (hasKanji(jp.text) && !jp.furigana?.length) expect(ways(jp.text, jp.kana), `${id}: ${jp.text}`).toBe(1);
    const work = ALL_LINES.find((l) => l.jp.text === 'かいしゃの 人と 行きます。')!;
    expect(work.jp.furigana?.filter(([, r]) => r)).toEqual([['人', 'ひと'], ['行', 'い']]);
  });

  it("Chōchin-san has his own lines for this mode, none about trains", () => {
    const lines = REAL_CONTENT.hostLines.filter((l) => l.event.startsWith('tourist_'));
    for (const event of ['tourist_intro', 'tourist_deal', 'tourist_vote', 'tourist_last_chance', 'tourist_caught', 'tourist_escaped']) {
      expect(lines.filter((l) => l.event === event && l.host === 'chochin').length, event).toBe(5);
    }
    for (const l of lines) expect(l.jp.en, l.id).not.toMatch(/train|station|ticket|ghost|passenger/i);
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

  it("the N4 must / needn't answers don't open with はい or いいえ, so they fit either question", () => {
    const line = (id: string) => SAFE_ANSWERS.find((l) => l.id === id)!;
    expect(line('tourist.a.nakereba').jp.text).toBe('そう しなければ なりません。');
    expect(line('tourist.a.nakereba').jp.en).toBe('You have to.');
    expect(line('tourist.a.nakute-mo-ii').jp.text).toBe('しなくても いいですよ。');
    expect(line('tourist.a.nakute-mo-ii').jp.en).toBe("You don't have to.");
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

  it('has an N4 deck: may, must/needn\'t and can questions and answers, generic and at every place, tagged and draft', () => {
    const deck = ALL_LINES.filter((l) => l.frames?.length);
    for (const l of deck) expect(l.level, l.id).toBe('n4');
    for (const l of [...QUESTIONS, ...SAFE_ANSWERS].filter((x) => x.frames)) expect(l.status, l.id).toBe('draft');
    const has = (lines: readonly { frames?: readonly string[] }[], f: string) => lines.some((l) => l.frames?.includes(f));
    for (const f of ['nakereba', 'nakutemo-ii', 'potential']) expect(has(QUESTIONS, f), f).toBe(true);
    for (const f of ['nakereba', 'nakutemo-ii', 'potential']) expect(has(SAFE_ANSWERS, f), f).toBe(true);
    for (const p of PLACES) {
      expect(p.questions.some((q) => q.frames?.length), p.id).toBe(true);
      expect(p.answers.filter((a) => a.frames?.length).length, p.id).toBeGreaterThanOrEqual(2);
    }
    expect(deck.every((l) => /なければ|なくても|ては いけ|ても いい|ことが できます|[られえけせてべめ]ま[すせ]/.test(l.jp.kana)), 'every deck line is in its frame').toBe(true);
    // 4.2's required frame: generic ＿ても いいですか questions every place can answer (step 5b-2).
    expect(QUESTIONS.filter((q) => q.frames?.includes('te-mo-ii')).length).toBeGreaterThanOrEqual(3);
  });

  it('N4 players get N4 deck tiles, and a must question gets must/needn\'t answers first; N5 players see none of it', () => {
    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n4', 'n4']);
    t.start(undefined, undefined, { greenCar: false });
    t.cards();
    const asker = t.asker;
    const qs = t.view(asker).me!.cues!.map((q) => ALL_LINES.find((l) => l.id === q.id)!);
    expect(qs.every((l) => l.level === 'n4')).toBe(true);
    const q = QUESTIONS.find((x) => x.id === 'tourist.q.shizuka')!;
    t.st.turn!.qSuggest = [q.id];
    const target = t.targetFor(t.locals.find((id) => id !== asker));
    t.play(asker, { kind: 'ask', targetId: target, utterance: speech(q.jp.kana), lineId: q.id });
    const first = ALL_LINES.find((l) => l.id === t.view(target).me!.answers![0]!.id)!;
    expect(first.frames?.some((f) => ['nakereba', 'nakutemo-ii', 'te-wa-ikenai'].includes(f)), first.id).toBe(true);

    const n5 = new Table(4, REAL_CONTENT, 9);
    n5.start();
    n5.cards();
    const tiles = n5.view(n5.asker).me!.questions!.map((x) => ALL_LINES.find((l) => l.id === x.id)!);
    expect(tiles.some((l) => l.frames)).toBe(false);
  });

  it('an N4 asker gets cues: the English and the frame, with the Japanese only after a peek; N5 askers keep tiles', () => {
    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n4', 'n4']);
    t.start(undefined, undefined, { greenCar: false });
    t.cards();
    const me = t.view(t.asker).me!;
    expect(me.questions).toBeNull();
    expect(me.cues!.length).toBe(5);
    for (const c of me.cues!) {
      expect(c.en, c.id).toBe(ALL_LINES.find((l) => l.id === c.id)!.jp.en);
      expect(c.jp, c.id).toBeNull();
    }
    // ＿ても いいですか gets its own chip.
    t.st.turn!.qSuggest = ['tourist.q.hitori', 'tourist.q.harawanakute'];
    const [hitori, harawanakute] = t.view(t.asker).me!.cues!;
    expect(hitori!.frame).toMatchObject({ id: 'te-mo-ii', ja: '＿ても いいですか' });
    expect(harawanakute!.frame?.id).toBe('nakutemo-ii');
    // Nobody else sees the cues, and only the asker may peek, at a cue they were given.
    const other = t.targetFor();
    expect(t.view(other).me!.cues).toBeNull();
    expect(t.play(other, { kind: 'peek', lineId: 'tourist.q.hitori' }).error).toBe('not-your-turn');
    expect(t.play(t.asker, { kind: 'peek', lineId: 'tourist.q.suki' }).error).toBe('bad-move');
    expect(t.play(t.asker, { kind: 'peek', lineId: 'tourist.q.hitori' }).error).toBeUndefined();
    expect(t.view(t.asker).me!.cues![0]!.jp).toMatchObject({ text: '一人で 行っても いいですか。' });
    expect(t.view(t.asker).me!.cues![1]!.jp).toBeNull();

    // Kana and N5 askers: tiles as before, and no peeking.
    const n5 = new Table(4, REAL_CONTENT, 9, ['n5', 'kana', 'n4', 'n5']);
    n5.start();
    n5.cards();
    while (n5.s.players.find((p) => p.id === n5.asker)!.level === 'n4') n5.timeout();
    expect(n5.view(n5.asker).me!.questions!.length).toBe(5);
    expect(n5.view(n5.asker).me!.cues).toBeNull();
    expect(n5.play(n5.asker, { kind: 'peek', lineId: n5.st.turn!.qSuggest[0]! }).error).toBe('bad-move');
  });

  it('a question asked off a cue counts as said from memory; after a peek, as read', () => {
    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n4', 'n4']);
    t.start(undefined, undefined, { greenCar: false });
    t.cards();
    const q = QUESTIONS.find((x) => x.id === 'tourist.q.hitori')!;
    const asker = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(asker, { kind: 'ask', targetId: t.targetFor(), utterance: speech(q.jp.kana), lineId: q.id });
    const entry = t.s.phrasebook[asker]!.find((e) => e.itemId === q.id)!;
    expect(entry).toMatchObject({ outcome: 'said', recall: 'memory' });
    expect(phraseFrames(entry)).toContain('te-mo-ii');
    // From memory pays like own words; the stage still shows the tidy line.
    expect(t.score(asker)).toBe(ASK_BONUS.own.speech);
    expect(t.view('stage').turn!.question).toMatchObject({ text: q.jp.text, en: q.jp.en, ownWords: true, approx: false });

    // Peeked first: read, and the tile's bonus.
    t.play(t.st.turn!.targetId!, { kind: 'reply', utterance: speech('はい、いいですよ') });
    const b = t.asker;
    const q2 = QUESTIONS.find((x) => x.id === 'tourist.q.harawanakute')!;
    t.st.turn!.qSuggest = [q2.id];
    const before = t.score(b);
    expect(t.play(b, { kind: 'peek', lineId: q2.id }).error).toBeUndefined();
    t.play(b, { kind: 'ask', targetId: t.targetFor(), utterance: speech(q2.jp.kana), lineId: q2.id });
    expect(t.s.phrasebook[b]!.find((e) => e.itemId === q2.id)).toMatchObject({ outcome: 'seen', recall: 'read' });
    expect(t.score(b) - before).toBe(ASK_BONUS.frame.speech);
    // Too late to peek once asked.
    expect(t.play(b, { kind: 'peek', lineId: q2.id }).error).toBe('already-asked');
  });

  it('a tile with one word swapped is the asker\'s own words, logged as said; a one-kana slip is still the tile', () => {
    const q = QUESTIONS.find((x) => x.id === 'tourist.q.hitori')!;
    expect(oneWordChanged(speech('ともだちと いっても いいですか'), q)).toBe(true);
    expect(oneWordChanged(speech('ひとりで いっても いいですか'), q)).toBe(false);
    expect(oneWordChanged(speech('ひとりで いっても いいですが'), q)).toBe(false);
    expect(oneWordChanged(speech('ともだちと たべても いいですか'), q)).toBe(false);

    // An N5 asker with the tile on screen: own words, and the phrasebook keeps what they said.
    const t = new Table(4, REAL_CONTENT, 9);
    t.start();
    t.cards();
    const asker = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(asker, { kind: 'ask', targetId: t.targetFor(), utterance: speech('ともだちと いっても いいですか'), lineId: q.id });
    expect(t.view('stage').turn!.question).toMatchObject({ text: 'ともだちと いっても いいですか', kana: 'ともだちと いっても いいですか', en: `${q.jp.en} (one word changed)`, approx: false, ownWords: true });
    expect(t.score(asker)).toBe(ASK_BONUS.own.speech);
    const entry = t.s.phrasebook[asker]!.find((e) => e.itemId.startsWith('tourist.own.'))!;
    // Own words (and their bonus), but the line was on the tile: read, not memory.
    expect(entry).toMatchObject({ text: 'ともだちと いっても いいですか', en: `${q.jp.en} (one word changed)`, outcome: 'said', recall: 'read' });
    expect(phraseFrames(entry)).toContain('te-mo-ii');
    expect(t.s.phrasebook[asker]!.some((e) => e.itemId === q.id)).toBe(false);

    // Read off the tile with a slip: still the tile, still read.
    t.play(t.st.turn!.targetId!, { kind: 'reply', utterance: speech('はい') });
    const b = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(b, { kind: 'ask', targetId: t.targetFor(), utterance: speech('ひとりで いっても いいですが'), lineId: q.id });
    expect(t.view('stage').turn!.question).toMatchObject({ text: q.jp.text, ownWords: false });
    expect(t.s.phrasebook[b]!.find((e) => e.itemId === q.id)).toMatchObject({ outcome: 'seen', recall: 'read' });
  });

  it('a swap off a cue is from memory unpeeked, read after a peek; a Kana asker sees it in romaji', () => {
    const q = QUESTIONS.find((x) => x.id === 'tourist.q.hitori')!;
    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n4', 'kana']);
    t.start();
    t.cards();
    while (t.asker === 'p4') t.timeout();
    const a = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(a, { kind: 'ask', targetId: ['p1', 'p2', 'p3'].find((id) => id !== a)!, utterance: speech('ともだちと いっても いいですか'), lineId: q.id });
    expect(t.s.phrasebook[a]!.find((e) => e.itemId.startsWith('tourist.own.'))).toMatchObject({ outcome: 'said', recall: 'memory' });
    t.play(t.st.turn!.targetId!, { kind: 'reply', utterance: speech('はい') });

    // Peeked, then swapped: still own words and their bonus, but read.
    const b = t.asker;
    t.st.turn!.qSuggest = [q.id];
    const before = t.score(b);
    expect(t.play(b, { kind: 'peek', lineId: q.id }).error).toBeUndefined();
    t.play(b, { kind: 'ask', targetId: t.targetFor('p4'), utterance: speech('かぞくと いっても いいですか'), lineId: q.id });
    expect(t.score(b) - before).toBe(ASK_BONUS.own.speech);
    expect(t.s.phrasebook[b]!.find((e) => e.itemId === 'tourist.own.かぞくといってもいいですか')).toMatchObject({ outcome: 'said', recall: 'read' });
    // Whoever hears it at Kana level gets romaji, and the English says what changed.
    const heard = t.view(t.st.turn!.targetId!).turn!.question!;
    expect(heard).toMatchObject({ kana: 'かぞくと いっても いいですか', en: `${q.jp.en} (one word changed)` });
    expect(t.st.turn!.targetId).toBe('p4');
    expect(heard.romaji).toBe(toRomajiOf('かぞくと いっても いいですか'));
  });

  it('kanji said through the real reader: the line as written is the line, and a real swap is a swap', async () => {
    const reader = (await createReader())!;
    expect(reader('一人で 行っても いいですか')).toBe('ひとりで いっても いいですか');
    expect(reader('友達と 行っても いいですか')).toBe('ともだちと いっても いいですか');
    expect(reader('何を 持って 行ったら いいですか')).toBe('なにを もって いったら いいですか');
    // 行う stays おこなう where it is one.
    expect(reader('会議を 行った')).toBe('かいぎを おこなった');
    expect(reader('行います')).toBe('おこないます');
    expect(reader('行われる')).toBe('おこなわれる');
    const said = (text: string) => {
      const u = speech(text) as { via: 'speech'; text: string; reading?: string };
      setReading(u, reader(text), reader.tokens(text));
      return u;
    };
    const q = QUESTIONS.find((x) => x.id === 'tourist.q.hitori')!;
    expect(saysLine(said('一人で 行っても いいですか'), q)).toBe(true);
    expect(oneWordChanged(said('一人で 行っても いいですか'), q)).toBe(false);
    expect(oneWordChanged(said('友達と 行っても いいですか'), q)).toBe(true);

    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n4', 'n4']);
    t.start(undefined, undefined, { greenCar: false });
    t.cards();
    const a = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(a, { kind: 'ask', targetId: t.targetFor(), utterance: said('一人で 行っても いいですか'), lineId: q.id });
    expect(t.view('stage').turn!.question).toMatchObject({ text: q.jp.text, en: q.jp.en, ownWords: true, approx: false });
    expect(t.s.phrasebook[a]!.find((e) => e.itemId === q.id)).toMatchObject({ outcome: 'said', recall: 'memory' });
    t.play(t.st.turn!.targetId!, { kind: 'reply', utterance: speech('はい') });
    const b = t.asker;
    t.st.turn!.qSuggest = [q.id];
    t.play(b, { kind: 'ask', targetId: t.targetFor(), utterance: said('友達と 行っても いいですか'), lineId: q.id });
    expect(t.view('stage').turn!.question).toMatchObject({ text: '友達と 行っても いいですか', kana: 'ともだちと いっても いいですか', en: `${q.jp.en} (one word changed)`, ownWords: true });
    expect(t.s.phrasebook[b]!.find((e) => e.itemId === 'tourist.own.ともだちといってもいいですか')).toMatchObject({ outcome: 'said', recall: 'memory' });
  });

  it('cue chips are question forms that match the cue; N5-frame cues get none', () => {
    expect(CUE_LEVELS).toEqual(['n4', 'n3']);
    const cueLines = [...QUESTIONS, ...PLACES.flatMap((p) => p.questions)].filter((l) => l.level === 'n4' || l.level === 'n3');
    for (const l of cueLines) {
      const chip = cueChip(l);
      if (!chip) continue;
      expect(chip.ja, l.id).toContain('＿');
      expect(chip.ja, l.id).toMatch(/か$/);
    }
    for (const c of Object.values(CUE_CHIPS)) expect(c!.ja).toMatch(/＿.*か$/);
    const byId = (id: string) => cueLines.find((l) => l.id === id)!;
    expect(cueChip(byId('tourist.q.hitori'))).toMatchObject({ id: 'te-mo-ii', ja: '＿ても いいですか', en: 'May I ___?' });
    expect(cueChip(byId('tourist.q.harawanakute'))).toMatchObject({ ja: '＿なくても いいですか', en: 'Do I not have to ___?' });
    expect(cueChip(byId('tourist.q.shizuka'))).toMatchObject({ ja: '＿なければ なりませんか', en: 'Do I have to ___?' });
    expect(cueChip(byId('tourist.q.taberaremasu'))).toMatchObject({ ja: '＿(ら)れますか', en: 'Can you ___?' });
    for (const id of ['tourist.q.motte', 'tourist.onsen.q.what.n4', 'tourist.kuukou.q.when.n4']) expect(cueChip(byId(id)), id).toMatchObject({ id: 'tara', ja: '＿たら いいですか' });
    expect(cueChip(byId('tourist.ramen.q.yesno.n4'))).toBeNull();
    expect(cueChip(byId('tourist.q.dekimasu'))).toBeNull();
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

describe("Who's the Tourist?: the Green Car", () => {
  const EVERY = new Map([...ALL_LINES, ...GREEN_LINES].map((l) => [l.id, l]));
  const N3_RULES = ['koto-ni-natteiru', 'beki', 'temo-kamawanai', 'wake-dewa-nai'];
  const N4_RULES = ['te-mo-ii', 'te-wa-ikenai', 'potential'];
  const CHEEKY = GREEN_PLACES.filter((p) => p.audiences && !p.audiences.includes('kids')).map((p) => p.id);
  const framesIn = (j: { text: string; kana: string | null }) => [
    ...new Set([...framesOf({ text: j.text, kana: j.kana ?? j.text }, undefined, { keepHidden: true }), ...framesOf({ text: j.kana ?? j.text, kana: j.kana ?? j.text }, undefined, { keepHidden: true })]),
  ];

  it('every rules line is N4 or N3, a draft, and says the frames it carries', () => {
    expect(GREEN_LINES.length).toBeGreaterThan(60);
    for (const l of GREEN_LINES) {
      expect(['n4', 'n3'], l.id).toContain(l.level);
      expect(l.status, l.id).toBe('draft');
      expect(l.greenCar, l.id).toBe(true);
      expect(l.frames?.length, l.id).toBeGreaterThan(0);
      for (const f of l.frames!) expect(framesIn(l.jp), `${l.id}: ${l.jp.kana}`).toContain(f);
      // The tone frames are never aimed at a player.
      expect(l.frames!.some((f) => ['kuse-ni', 'wari-ni', 'ni-shite-wa', 'wake-ga-nai'].includes(f)), l.id).toBe(false);
    }
    const frames = new Set(GREEN_LINES.flatMap((l) => l.frames ?? []));
    for (const f of [...N3_RULES, ...N4_RULES, 'tame-ni', 'you-ni']) expect(frames, f).toContain(f);
    // Every existing place has its own rules lines.
    for (const p of PLACES) expect(GREEN_PLACE_LINES[p.id]?.answers.length ?? 0, p.id).toBeGreaterThanOrEqual(2);
  });

  it('every rules frame is reachable in every audience: Kids rooms never get the Cheeky places, Cheeky rooms can', () => {
    const all = new Set(GREEN_LINES.flatMap((l) => l.frames ?? []));
    for (const audience of ['kids', 'family', 'cheeky'] as const) {
      const places = placesFor(true, audience);
      const lines = places.flatMap((p) => [...p.questions, ...p.answers, ...(GREEN_PLACE_LINES[p.id]?.questions ?? []), ...(GREEN_PLACE_LINES[p.id]?.answers ?? [])]);
      const generic = GREEN_LINES.filter((l) => l.id.startsWith('tourist.gc.q.') || l.id.startsWith('tourist.gc.a.') || l.id.startsWith('tourist.gc.bluff.'));
      const reach = new Set([...lines, ...generic].flatMap((l) => l.frames ?? []));
      for (const f of all) expect(reach.has(f), `${audience}: ${f}`).toBe(true);
      if (audience === 'kids') for (const id of CHEEKY) expect(places.map((p) => p.id), id).not.toContain(id);
      if (audience === 'cheeky') for (const id of CHEEKY) expect(places.map((p) => p.id), id).toContain(id);
    }
    expect(placesFor(false, 'cheeky').map((p) => p.id)).toEqual(PLACES.map((p) => p.id));

    const kids = new Table(4, REAL_CONTENT, 3, ['n3', 'n4', 'n4', 'n3']);
    kids.start(undefined, undefined, { audience: 'kids' });
    expect(kids.st.order.some((id) => CHEEKY.includes(id))).toBe(false);
    expect(kids.st.order.slice(0, 2).sort()).toEqual(['gakkou', 'suizokukan']);
    const cheeky = new Table(4, REAL_CONTENT, 3, ['n3', 'n4', 'n4', 'n3']);
    cheeky.start(undefined, undefined, { audience: 'cheeky' });
    expect(cheeky.st.order.slice(0, 4).sort()).toEqual([...CHEEKY, 'suizokukan'].sort());
  });

  it('a mixed room is unchanged: no Green Car places or lines', () => {
    const t = new Table(4, REAL_CONTENT, 9, ['n4', 'n4', 'n5', 'n5']);
    t.start(undefined, undefined, { audience: 'cheeky' });
    expect(t.st.order.every((id) => PLACES.some((p) => p.id === id))).toBe(true);
    t.cards();
    for (const p of t.s.players) {
      const me = t.view(p.id).me!;
      for (const x of [...(me.questions ?? []), ...(me.cues ?? []), ...(me.answers ?? [])]) expect(EVERY.get(x.id)!.greenCar, x.id).toBeUndefined();
    }
  });

  it('an N3 asker gets half N4, half N3 cues; an N4 asker gets N4 cues and one N3 stretch, tagged; no Kana or N5', () => {
    let n3Asks = 0;
    let n4Asks = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = new Table(4, REAL_CONTENT, seed, ['n3', 'n4', 'n3', 'n4']);
      t.start();
      t.cards();
      for (let k = 0; k < 4 && t.s.phase === 'answer'; k++) {
        const asker = t.asker;
        const level = t.s.players.find((p) => p.id === asker)!.level;
        const cues = t.view(asker).me!.cues!;
        expect(cues.length).toBe(5);
        const lines = cues.map((c) => EVERY.get(c.id)!);
        for (const l of lines) expect(['n4', 'n3'], l.id).toContain(l.level);
        for (const c of cues) expect(!!c.n3, c.id).toBe(EVERY.get(c.id)!.level === 'n3');
        const n3 = lines.filter((l) => l.level === 'n3').length;
        if (level === 'n3') {
          expect([2, 3]).toContain(n3);
          n3Asks++;
        } else {
          expect(n3).toBe(1);
          expect(lines.at(-1)!.level).toBe('n3');
          n4Asks++;
        }
        // Asked off a cue, from memory: the answerer's tiles are N4/N3 only, and an N4 answerer gets an N3 stretch.
        const line = lines[0]!;
        const target = t.targetFor();
        expect(t.play(asker, { kind: 'ask', targetId: target, utterance: speech(line.jp.kana!), lineId: line.id }).error).toBeUndefined();
        for (const f of line.frames ?? []) expect(t.st.gcSaid?.[asker]?.[f], `${line.id} ${f}`).toBeGreaterThan(0);
        const answers = t.view(target).me!.answers!;
        for (const a of answers) expect(['n4', 'n3'], a.id).toContain(EVERY.get(a.id)!.level);
        if (t.s.players.find((p) => p.id === target)!.level === 'n4') expect(answers.filter((a) => a.n3).length).toBeGreaterThanOrEqual(1);
        expect(t.play(target, { kind: 'reply', utterance: speech(answers[0]!.kana!), lineId: answers[0]!.id }).error).toBeUndefined();
      }
    }
    expect(n3Asks).toBeGreaterThan(0);
    expect(n4Asks).toBeGreaterThan(0);
  });

  it('bots in the Green Car say the rules lines from memory, N3 frames included', () => {
    const N3 = new Set(N3_RULES);
    let n3Frames = 0;
    let rules = 0;
    for (const seed of [1, 2, 3]) {
      const t = new Table(4, REAL_CONTENT, seed, ['n3', 'n4', 'n3', 'n4']);
      t.start(2);
      const policy = touristPolicy({ seed, delayMs: [0, 0] });
      const done = new Set<string>();
      for (let guard = 0; guard < 3000 && t.s.phase !== 'recap'; guard++) {
        let moved = false;
        for (const p of t.s.players) {
          const view = t.roomView(p.id);
          for (const m of policy.act(view, p.id)) {
            const key = `${p.id}:${view.phaseSeq}:${m.key}`;
            if (done.has(key)) continue;
            done.add(key);
            t.play(p.id, m.move);
            moved = true;
          }
        }
        if (!moved) t.timeout();
      }
      const all = Object.values(t.s.phrasebook).flat();
      const memory = all.filter((e) => e.recall === 'memory' && e.outcome === 'said');
      n3Frames += memory.flatMap((e) => (e.frames ?? framesIn(e)).filter((f) => N3.has(f))).length;
      rules += all.filter((e) => GREEN_LINES.some((l) => l.jp.text === e.text || l.jp.kana === e.text)).length;
    }
    expect(rules).toBeGreaterThan(5);
    expect(n3Frames).toBeGreaterThan(3);
  });
});
