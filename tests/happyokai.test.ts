import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import {
  answerFrames,
  closingFor,
  DECKS,
  deckTitlesFor,
  framesFor,
  MISHAPS,
  openingFor,
  questionsFor,
  readySentences,
  recoveryFor,
  SLIDES,
  slidesFor,
  TITLES,
  titlesFor,
} from '../shared/src/modes/happyokai/content.js';
import { forLevel, rb } from '../shared/src/modes/happyokai/ruby.js';
import {
  ASK,
  averageGrade,
  dealChoices,
  hanamaruPoints,
  HANAMARU_POINTS,
  n4Mix,
  presenterOrder,
  showPlan,
  speakPoints,
  SPEAK_CAP,
  type HappyokaiState,
  type HappyokaiView,
  type Line,
  type Step,
  type Talk,
} from '../shared/src/modes/happyokai/happyokai.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { happyokaiPolicy } from '../tools/bots/policies/happyokai.js';
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
  constructor(players: number, levels: Level[] = [], seed = 7) {
    this.random = mulberry(seed);
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: levels[i - 1] ?? 'n5' });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: REAL_CONTENT, newId: () => `id${++this.ids}`, random: this.random };
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
  get st(): HappyokaiState {
    return this.s.modeState as HappyokaiState;
  }
  get t(): Talk {
    return this.st.talk!;
  }
  view(viewer: string | 'stage' = 'stage'): HappyokaiView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT).game as HappyokaiView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(audience?: 'kids' | 'family' | 'cheeky') {
    if (audience) this.cmd('stage', { type: 'settings', audience });
    expect(this.cmd('stage', { type: 'start', mode: 'happyokai' }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.timeout();
    expect(this.s.phase).toBe('prompt');
  }
  /** Backstage: the presenter picks the first title and says they're ready. */
  backstage() {
    expect(this.play(this.t.presenterId, { kind: 'title', key: 0 }).error).toBeUndefined();
    expect(this.play(this.t.presenterId, { kind: 'go' }).error).toBeUndefined();
    expect(this.s.phase).toBe('answer');
  }
  say(text: string, via: Utterance['via'] = 'speech') {
    return this.play(this.t.presenterId, { kind: 'say', utterance: { via, text } });
  }
  next() {
    return this.play(this.t.presenterId, { kind: 'next' });
  }
}

const speech = (text: string): Utterance => ({ via: 'speech', text });

// ---- content ----

describe('Happyōkai!: content', () => {
  it('has titles and slides for every audience, and Cheeky never reaches a Kids room', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      expect(titlesFor(a).length, a).toBeGreaterThanOrEqual(10);
      expect(slidesFor(a).length, a).toBeGreaterThanOrEqual(30);
      expect(slidesFor(a).filter((s) => s.wild).length, `${a} wild`).toBeGreaterThanOrEqual(8);
      expect(slidesFor(a).filter((s) => !s.wild).length, `${a} straight`).toBeGreaterThanOrEqual(15);
    }
    for (const x of [...titlesFor('kids'), ...slidesFor('kids')]) expect(x.audiences, x.id).toContain('kids');
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    expect(new Set(SLIDES.map((s) => s.id)).size).toBe(SLIDES.length);
  });

  it('every slide has its picture', () => {
    const dir = fileURLToPath(new URL('../stage/assets/slides/', import.meta.url));
    for (const s of SLIDES) expect(existsSync(`${dir}${s.id}.png`), s.id).toBe(true);
    for (const n of [1, 2, 3]) expect(existsSync(`${dir}chochin-holiday-${n}.png`)).toBe(true);
  });

  it('every slide has frames, ready sentences, recoveries and questions at every level', () => {
    for (const level of ['kana', 'n5', 'n4'] as const) {
      for (const s of SLIDES) {
        expect(framesFor(level, s).length, `${s.id} ${level}`).toBeGreaterThan(0);
        const ready = readySentences(s, level, TITLES[0]!.topic);
        expect(ready.length, `${s.id} ${level}`).toBeGreaterThanOrEqual(2);
        for (const r of ready) expect(r.kana, `${s.id} ${level}`).not.toMatch(/〔|undefined|null/);
        for (const a of ['kids', 'family', 'cheeky'] as const) {
          const qs = questionsFor(level, s, TITLES[0]!.topic, a, mulberry(1));
          expect(qs.length).toBe(3);
          expect(new Set(qs.map((q) => q.text)).size).toBe(3);
        }
      }
      for (const m of MISHAPS) for (const up of [true, false]) expect(recoveryFor(m.id, level, SLIDES[0]!.word, up).kana).not.toMatch(/undefined|null/);
      // The opening fits every title: 「タイトルは「〜」です」 never doubles up its punctuation.
      for (const t of TITLES) expect(openingFor(level, 'Ladi', t.jp).text, t.id).not.toMatch(/。」|undefined/);
      expect(closingFor(level).text).toMatch(/ありがとう/);
    }
  });

  it('writes every kanji with its reading, and shows each level only the kanji it knows', () => {
    const HAN = /\p{Script=Han}/u;
    const bare = (j: { text: string; furigana?: [string, string][] }) => (j.furigana ?? [[j.text, '']]).filter(([b, r]) => !r && HAN.test(b)).map(([b]) => b);
    for (const t of TITLES) expect([...bare(t.jp), ...bare(t.topic)], t.id).toEqual([]);
    for (const s of SLIDES) expect([...bare(s.word), ...(s.did ? bare(s.did) : []), ...bare(rb(s.adj.text, s.adj.en))], s.id).toEqual([]);
    for (const level of ['kana', 'n5', 'n4'] as const)
      for (const s of SLIDES) for (const r of readySentences(s, level, TITLES[0]!.topic)) expect(bare(r), `${s.id} ${level}`).toEqual([]);
    // かな is kana only; N5 keeps N5 kanji (今日) and drops N4 ones (仕事); N4 keeps both.
    const cat = TITLES.find((t) => t.id === 'cat-job')!.jp;
    expect(forLevel(cat, 'kana').text).toBe('ねこの しごと');
    expect(forLevel(cat, 'n5').text).toBe('ねこの しごと');
    expect(forLevel(cat, 'n4').text).toBe('ねこの 仕事');
    expect(forLevel(cat, 'n4').furigana).toEqual([['ねこ', ''], ['の ', ''], ['仕事', 'しごと']]);
    expect(openingFor('kana', 'Ladi', cat).text).not.toMatch(HAN);
    expect(openingFor('n5', 'Ladi', cat).text).toContain('今日は ねこの しごとに ついて 話します');
    expect(openingFor('n4', 'Ladi', cat).kana).toContain('きょうは ねこの しごとに ついて はなしたいと おもいます');
  });

  it('has two N4 decks, Then and now and If I were…, with their own frames, cue cards, questions and answers', () => {
    const HAN = /\p{Script=Han}/u;
    const bare = (j: { text: string; furigana?: [string, string][] }) => (j.furigana ?? [[j.text, '']]).filter(([b, r]) => !r && HAN.test(b)).map(([b]) => b);
    for (const deck of ['then-now', 'if'] as const) {
      expect(DECKS[deck].status).toBe('draft');
      for (const a of ['kids', 'family', 'cheeky'] as const) expect(deckTitlesFor(a, deck).length, `${deck} ${a}`).toBeGreaterThanOrEqual(5);
      for (const a of ['kids', 'family', 'cheeky'] as const) expect(titlesFor(a).some((t) => t.deck)).toBe(false);
      const pattern = deck === 'then-now' ? /ように なりました|ことに しました|ことに なりました/ : /^もし |、もし /;
      for (const s of SLIDES) {
        const ready = readySentences(s, 'n4', deckTitlesFor('family', deck)[0]!.topic, deck);
        expect(ready.length, s.id).toBe(3);
        for (const r of ready) {
          expect(r.kana, `${s.id} ${deck}`).toMatch(pattern);
          expect(r.kana, s.id).not.toMatch(/undefined|null/);
          expect(bare(r), s.id).toEqual([]);
        }
        expect(framesFor('n4', s, deck).join(' '), s.id).toMatch(pattern);
        // Other levels keep their usual lines, even in a deck talk.
        expect(readySentences(s, 'n5', TITLES[0]!.topic, deck)).toEqual(readySentences(s, 'n5', TITLES[0]!.topic));
        expect(framesFor('n5', s, deck)).toEqual(framesFor('n5', s));
      }
      const cards = questionsFor('n4', SLIDES[0]!, deckTitlesFor('family', deck)[0]!.topic, 'family', () => 0, deck);
      expect(cards[0]!.kana).toMatch(deck === 'then-now' ? /まえは|ことに しました|ように なりました/ : /^もし/);
      expect(answerFrames('n4', deck).join(' ')).toMatch(pattern.source.startsWith('^') ? /もし/ : pattern);
      expect(answerFrames('n5', deck)).toEqual(answerFrames('n5'));
    }
    // Deck questions stay out of every other talk.
    for (let k = 0; k < 20; k++) for (const q of questionsFor('n4', SLIDES[k]!, TITLES[0]!.topic, 'family', mulberry(k))) expect(q.kana).not.toMatch(/ことに しました|できるように|もし あなたが|なれたら/);
    // An If I were… title is a clause, so the opening quotes it.
    const ifCat = TITLES.find((t) => t.id === 'if-cat')!.jp;
    expect(openingFor('n4', 'Ladi', ifCat).kana).toContain('きょうは 「もし わたしが ねこだったら」に ついて');
  });

  it('fits the N4 deck sentences to the slide: news, the "if" wish, and verbs for things you don\'t 使う', () => {
    const slide = (id: string) => SLIDES.find((s) => s.id === id)!;
    const byKind = (kind: string) => SLIDES.find((s) => s.kind === kind && !s.event && !s.use)!;
    const tn = TITLES.find((t) => t.id === 'tn-tanuki')!;
    expect(tn.deck).toBe('then-now');
    expect(TITLES.some((t) => t.id === 'tn-town')).toBe(false);
    const news = (s: (typeof SLIDES)[number]) => readySentences(s, 'n4', tn.topic, 'then-now')[2]!.kana;
    expect(news(byKind('place'))).toMatch(/^じつは、らいげつ たぬきと .+に ひっこす ことに なりました。$/);
    expect(news(byKind('food'))).toMatch(/^じつは、らいげつから たぬきが .+の おみせを ひらく ことに なりました。$/);
    expect(news(byKind('living'))).toMatch(/^じつは、らいげつ たぬきと .+が けっこんする ことに なりました。$/);
    expect(news(byKind('thing'))).toMatch(/が けっこんする ことに なりました。$/);
    const ifT = deckTitlesFor('family', 'if')[0]!.topic;
    const wish = (s: (typeof SLIDES)[number]) => readySentences(s, 'n4', ifT, 'if')[0]!.kana;
    expect(wish(byKind('living'))).toMatch(/いっしょに いたいです。$/);
    expect(wish(byKind('place'))).toMatch(/に すみたいです。$/);
    expect(wish(byKind('food'))).toMatch(/まいにち .+を たべたいです。$/);
    expect(wish(byKind('thing'))).toMatch(/まいにち .+を つかいたいです。$/);
    expect(wish(slide('sakura'))).toMatch(/まいにち さくらを たのしみたいです。$/);
    // おみくじ is drawn, not used; trains are ridden.
    expect(wish(slide('omikuji'))).toMatch(/まいにち おみくじを ひきたいです。$/);
    expect(readySentences(slide('omikuji'), 'n4', tn.topic, 'then-now')[0]!.kana).toContain('おみくじが ひけるように なりました');
    expect(readySentences(slide('shinkansen'), 'n4', tn.topic, 'then-now')[0]!.kana).toContain('しんかんせんに のれるように なりました');
    expect(wish(slide('rush-hour'))).toMatch(/でんしゃに のりたいです。$/);
  });

  it('asks いなかったら about a living slide word, なかったら about anything else', () => {
    const living = SLIDES.find((s) => s.kind === 'living')!;
    const other = SLIDES.find((s) => s.kind === 'thing')!;
    const all = (s: (typeof SLIDES)[number]) => Array.from({ length: 40 }, (_, k) => questionsFor('n4', s, TITLES[0]!.topic, 'family', mulberry(k))).flat().map((q) => q.kana);
    const livingQs = all(living);
    expect(livingQs.some((q) => q.includes('いなかったら'))).toBe(true);
    expect(livingQs.some((q) => /が なかったら/.test(q))).toBe(false);
    const otherQs = all(other);
    expect(otherQs.some((q) => /が なかったら/.test(q))).toBe(true);
    expect(otherQs.some((q) => q.includes('いなかったら'))).toBe(false);
  });
});

// ---- rules ----

describe('Happyōkai!: the show plan', () => {
  it('everyone presents, and small rooms present twice', () => {
    for (let n = 3; n <= 8; n++) {
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
      const order = presenterOrder(players as never, mulberry(n));
      const plan = showPlan(n);
      expect(order.length, `${n}`).toBe(n * plan.laps);
      for (const p of players) expect(order.filter((x) => x === p.id).length).toBe(plan.laps);
      // Never the same presenter twice in a row.
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
      expect(plan.pictures).toBeGreaterThanOrEqual(2);
    }
  });

  it('mic-off players don’t present while two others can', () => {
    const players = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, seat: i + 1, mic: i < 2 ? 'quiet' : 'ok' }));
    const order = presenterOrder(players as never, mulberry(3));
    expect(new Set(order)).toEqual(new Set(['c', 'd', 'e']));
    expect(order.length).toBe(3 * showPlan(3).laps);
    const one = players.map((p, i) => ({ ...p, mic: i < 4 ? 'quiet' : 'ok' }));
    expect(new Set(presenterOrder(one as never, mulberry(3))).size).toBe(5);
  });

  it('deals one choice that fits the title, one random, one wild', () => {
    const pool = slidesFor('family');
    for (let seed = 1; seed < 30; seed++) {
      const c = dealChoices(pool, [], ['food'], mulberry(seed));
      expect(c.map((x) => x.kind)).toEqual(['fit', 'random', 'wild']);
      expect(new Set(c.map((x) => x.slideId)).size).toBe(3);
      expect(pool.find((s) => s.id === c[2]!.slideId)!.wild).toBe(true);
    }
  });
});

describe('Happyōkai!: scoring', () => {
  const steps: Step[] = [
    { kind: 'title', slideId: null, mishapId: null, pickedBy: null, at: 0, ms: 0 },
    { kind: 'picture', slideId: 'ramen', mishapId: null, pickedBy: 'fit', at: 0, ms: 0 },
    { kind: 'close', slideId: null, mishapId: null, pickedBy: null, at: 0, ms: 0 },
  ];
  const line = (step: number, text: string, kind: Line['kind'], sentences = 1): Line => ({ id: text, step, text, shown: text, kind, sentences, hidden: false });

  it('own words beat reading out, which beats typing and tapping', () => {
    const own = speakPoints({ steps, lines: [line(1, 'ラーメンが だいすきです。', 'own')] }, 'n5');
    const read = speakPoints({ steps, lines: [line(1, 'ラーメンが だいすきです。', 'read')] }, 'n5');
    const typed = speakPoints({ steps, lines: [line(1, 'ラーメンが だいすきです。', 'typed')] }, 'n5');
    const tap = speakPoints({ steps, lines: [line(1, 'ラーメンが だいすきです。', 'tap')] }, 'n5');
    expect(own).toBeGreaterThan(read);
    expect(read).toBeGreaterThan(typed);
    expect(typed).toBeGreaterThan(tap);
    expect(tap).toBeGreaterThan(0);
  });

  it('a sentence said twice counts once; the ritual counts once; the total is capped', () => {
    const once = speakPoints({ steps, lines: [line(1, 'ラーメンです。', 'own')] }, 'n5');
    const twice = speakPoints({ steps, lines: [line(1, 'ラーメンです。', 'own'), line(1, 'ラーメンです。', 'own')] }, 'n5');
    expect(twice).toBe(once);
    const open = speakPoints({ steps, lines: [line(0, 'はじめまして。', 'own'), line(0, 'はじめまして。', 'own')] }, 'n5');
    expect(open).toBe(speakPoints({ steps, lines: [line(0, 'はじめまして。', 'own')] }, 'n5'));
    const many = Array.from({ length: 40 }, (_, i) => line(1, `${'あいうえおかきくけこさしすせそ'.slice(i % 10, (i % 10) + 3)}${i}です。`, 'own'));
    const big = { steps: [...steps.slice(0, 2), ...Array.from({ length: 10 }, () => steps[1]!), steps[2]!], lines: many.map((l, i) => ({ ...l, step: 1 + (i % 10) })) };
    expect(speakPoints(big, 'n5')).toBeLessThanOrEqual(SPEAK_CAP);
  });

  it('はなまる pays by the average of the grades given', () => {
    expect(hanamaruPoints(3)).toBe(HANAMARU_POINTS);
    expect(hanamaruPoints(1)).toBe(0);
    expect(hanamaruPoints(2)).toBe(HANAMARU_POINTS / 2);
    expect(averageGrade({})).toBe(2);
    expect(averageGrade({ a: 3, b: 2 })).toBe(2.5);
  });
});

describe('Happyōkai!: a talk', () => {
  it('gives a かな presenter one picture fewer', () => {
    const kana = new Table(4, ['kana', 'kana', 'kana', 'kana']);
    kana.start();
    expect(kana.t.pictures).toBe(showPlan(4).pictures - 1);
    const n5 = new Table(4);
    n5.start();
    expect(n5.t.pictures).toBe(showPlan(4).pictures);
  });

  it('gives an N4 presenter the N4 decks (one title from each), with deck frames and cue cards; N5 presenters never see them', () => {
    const table = new Table(3, ['n4', 'n4', 'n4']);
    table.start();
    const presenter = table.t.presenterId;
    const choices = table.t.titleChoices.map((id) => TITLES.find((t) => t.id === id)!);
    expect(choices.map((t) => t.deck)).toEqual(['then-now', 'if']);
    expect(table.view(presenter).me!.titleChoices.map((c) => c.deck?.en)).toEqual(['Then and now', 'If I were…']);
    expect(table.play(presenter, { kind: 'title', key: 1 }).error).toBeUndefined();
    expect(table.play(presenter, { kind: 'go' }).error).toBeUndefined();
    const opening = table.view(presenter).me!.script!;
    expect(opening.kana).toContain('「もし わたしが');
    expect(table.say(opening.kana).error).toBeUndefined();
    expect(table.next().error).toBeUndefined();
    const me = table.view(presenter).me!;
    expect(me.frames.join(' ')).toContain('もし ＿だったら');
    expect(me.ready.length).toBe(3);
    for (const r of me.ready) expect(r.kana).toMatch(/もし/);
    // The assistant's cue cards are the deck's sentences too.
    expect(table.view(table.t.assistantId!).me!.cueCards.map((c) => c.kana)).toEqual(me.ready.map((r) => r.kana));

    const n5 = new Table(3, ['n5', 'n5', 'kana']);
    n5.start();
    expect(n5.t.titleChoices.every((id) => !TITLES.find((t) => t.id === id)!.deck)).toBe(true);
  });

  it("alternates an N4 presenter's pairs: a deck pair, then one deck title and one usual title", () => {
    for (const seed of [3, 7, 11]) {
      const table = new Table(3, ['n4', 'n4', 'n4'], seed);
      table.start('cheeky');
      const picked: Record<string, string> = {};
      let mixes = 0;
      let usualTalks = 0;
      for (let guard = 0; guard < 600 && table.s.phase !== 'finale' && table.s.phase !== 'recap'; guard++) {
        const t = table.st.talk;
        if (table.s.phase === 'prompt' && t && !t.titleId) {
          const choices = t.titleChoices.map((id) => TITLES.find((x) => x.id === id)!);
          const decks = choices.filter((c) => c.deck);
          if (n4Mix(table.st, t.index)) {
            mixes++;
            expect(decks.length, `seed ${seed} talk ${t.index}`).toBe(1);
            // The deck title is from the deck they didn't pick last time.
            expect(decks[0]!.deck).not.toBe(TITLES.find((x) => x.id === picked[t.presenterId])!.deck);
            // The presenter takes the usual title.
            const usual = t.titleChoices.findIndex((id) => !TITLES.find((x) => x.id === id)!.deck);
            expect(table.play(t.presenterId, { kind: 'title', key: usual }).error).toBeUndefined();
          } else {
            expect(choices.map((c) => c.deck), `seed ${seed} talk ${t.index}`).toEqual(['then-now', 'if']);
            expect(table.play(t.presenterId, { kind: 'title', key: 0 }).error).toBeUndefined();
          }
          picked[t.presenterId] = t.titleId!;
          continue;
        }
        // A usual title's talk: nobody gets a deck question card.
        if (t?.titleId && !TITLES.find((x) => x.id === t.titleId)!.deck && Object.keys(t.cards).length) {
          usualTalks++;
          for (const cards of Object.values(t.cards)) for (const c of cards) expect(c.kana).not.toMatch(/まえは|ことに しました|できるように|もし あなたが|なれたら/);
        }
        table.timeout();
      }
      expect(mixes, `seed ${seed}`).toBe(3);
      expect(usualTalks, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('runs backstage → slides → questions → grades → report card, and pays everyone', () => {
    const table = new Table(4, ['kana', 'n5', 'n4', 'n5']);
    table.start();
    const presenter = table.t.presenterId;
    const assistant = table.t.assistantId!;
    expect(assistant).toBeTruthy();
    expect(assistant).not.toBe(presenter);
    // Only the presenter sees the titles; the TV doesn't show one until it's picked.
    expect(table.view(presenter).me!.titleChoices.length).toBe(2);
    expect(table.view(assistant).me!.titleChoices.length).toBe(0);
    expect(table.view().title).toBeNull();
    table.backstage();

    // Title slide: the opening is on the presenter's phone, and reading it out counts as read.
    const opening = table.view(presenter).me!.script!;
    expect(opening.text).toContain(table.s.players.find((p) => p.id === presenter)!.name);
    expect(table.say(opening.kana).error).toBeUndefined();
    expect(table.t.lines.at(-1)!.kind).toBe('read');
    expect(table.next().error).toBeUndefined();

    // Picture slides: the assistant picks the next one while the presenter talks.
    let pictures = 0;
    while (table.t.steps.at(-1)!.kind !== 'close') {
      const st = table.t.steps.at(-1)!;
      expect(st.kind).toBe('picture');
      pictures++;
      const me = table.view(presenter).me!;
      expect(me.word).not.toBeNull();
      expect(me.frames.length).toBeGreaterThan(0);
      const a = table.view(assistant).me!;
      if (a.choices.length) expect(table.play(assistant, { kind: 'pick', slideId: a.choices[2]!.id }).error).toBeUndefined();
      expect(table.say(`これは ${me.word!.kana} です。とても すきです。`).error).toBeUndefined();
      expect(table.play(presenter, { kind: 'ready', key: 0 }).error).toBeUndefined();
      // The room stamps; the presenter can't.
      expect(table.play(presenter, { kind: 'stamp', stamp: 'sugoi' }).error).toBe('not-yours');
      const audience = table.s.players.map((p) => p.id).filter((id) => id !== presenter);
      // Applause waits for the closing slide.
      expect(table.play(audience[0]!, { kind: 'stamp', stamp: 'hakushu' }).error).toBe('not-yet');
      for (const id of audience) table.play(id, { kind: 'stamp', stamp: 'omoshiroi' });
      const wild = a.choices[2]?.id;
      expect(table.next().error).toBeUndefined();
      if (wild && table.t.steps.at(-1)!.kind === 'picture') expect(table.t.steps.at(-1)!.slideId).toBe(wild);
    }
    expect(pictures).toBe(showPlan(4).pictures);
    expect(table.view().stampCount.omoshiroi).toBeGreaterThan(0);
    // Closing slide.
    expect(table.say(table.view(presenter).me!.script!.kana).error).toBeUndefined();
    expect(table.next().error).toBeUndefined();
    expect(table.s.phase).toBe('encore');

    // Question time: everyone else gets three cards; one asks out loud, one taps.
    const askers = table.s.players.map((p) => p.id).filter((id) => id !== presenter);
    for (const id of askers) expect(table.view(id).me!.questions.length).toBe(3);
    expect(table.view(presenter).me!.questions.length).toBe(0);
    expect(table.play(askers[0]!, { kind: 'ask', key: 0, utterance: speech(table.view(askers[0]!).me!.questions[0]!.text) }).error).toBeUndefined();
    expect(table.play(askers[1]!, { kind: 'ask', key: 1 }).error).toBeUndefined();
    // The TV knows who has a hand up, but not what they'll ask.
    expect(table.view().question!.askers.length).toBe(2);
    expect(table.view().question!.chosen).toBeNull();
    expect(table.play(presenter, { kind: 'choose', playerId: askers[0]! }).error).toBeUndefined();
    // Chōchin-san reads the chosen question out to the room.
    const asked = table.t.asked.find((x) => x.playerId === askers[0])!;
    expect(table.s.cues.find((c) => c.event === 'happyokai_ask')).toMatchObject({ host: 'chochin', slots: { question: asked.text, question_kana: asked.kana, question_en: asked.en } });
    expect(table.view().question!.chosen!.playerId).toBe(askers[0]);
    expect(table.view(presenter).me!.answerFrames.length).toBeGreaterThan(0);
    expect(table.say('いい しつもんですね。ラーメンが すき だから です。').error).toBeUndefined();
    expect(table.s.phase).toBe('reveal');

    // Grades: the audience (not the assistant, with 4 players).
    const graders = table.t.graders;
    expect(graders).not.toContain(presenter);
    expect(graders).not.toContain(assistant);
    for (const id of graders) expect(table.play(id, { kind: 'grade', n: 3 }).error).toBeUndefined();
    expect(table.s.phase).toBe('score');
    const card = table.view().card!;
    expect(card.flowers.every((f) => f === 3)).toBe(true);
    expect(card.presenterPoints).toBe(HANAMARU_POINTS);
    expect(card.speakPoints).toBeGreaterThan(0);
    expect(card.assistantPoints).toBeGreaterThan(0);
    expect(table.view(presenter).me!.report!.sentences).toBeGreaterThan(0);

    const before = table.score(presenter);
    table.timeout();
    expect(table.score(presenter) - before).toBe(card.presenterPoints + card.speakPoints);
    expect(table.score(assistant)).toBeGreaterThan(0);
    // Asked out loud and chosen, before any assistant points.
    expect(table.score(askers[0]!)).toBeGreaterThanOrEqual(ASK.said + ASK.picked);
    // On to the next talk, with someone else presenting.
    expect(table.s.phase).toBe('prompt');
    expect(table.t.presenterId).not.toBe(presenter);
  });

  it('a mishap replaces one slide, puts its recovery line on the presenter’s phone, and is used once', () => {
    const table = new Table(4);
    table.start();
    table.backstage();
    const presenter = table.t.presenterId;
    const assistant = table.t.assistantId!;
    table.say('はじめまして。');
    table.next();
    expect(table.play(assistant, { kind: 'pick', mishapId: 'graph' }).error).toBeUndefined();
    table.say('これは ねこ です。');
    table.next();
    const st = table.t.steps.at(-1)!;
    expect(st.kind).toBe('mishap');
    expect(st.mishapId).toBe('graph');
    expect(table.view().slide!.mishap!.id).toBe('graph');
    expect(table.view(presenter).me!.script!.text.length).toBeGreaterThan(0);
    expect(table.view(assistant).me!.mishaps.length).toBe(0);
  });

  it('the presenter can take a caption off the TV; others can’t unless VIP', () => {
    const table = new Table(4);
    table.start();
    table.backstage();
    const presenter = table.t.presenterId;
    table.say('はじめまして。');
    const id = table.t.lines[0]!.id;
    const other = table.s.players.map((p) => p.id).find((x) => x !== presenter && x !== table.s.vipId)!;
    expect(table.play(other, { kind: 'hide', lineId: id }).error).toBe('not-vip');
    expect(table.play(presenter, { kind: 'hide', lineId: id }).error).toBeUndefined();
    expect(table.view().captions[0]!.text).toBe('');
    expect(table.view(presenter).me!.lines[0]!.text).toBe('はじめまして。');
  });

  it('Next waits for a sentence or a few seconds, and the slide moves on by itself when its time runs out', () => {
    const table = new Table(3);
    table.start();
    table.backstage();
    expect(table.next().error).toBe('say-something');
    const st = table.t.steps.at(-1)!;
    table.now = st.at + st.ms + 1;
    table.act({ type: 'wake', phaseSeq: table.s.phaseSeq });
    expect(table.t.steps.length).toBe(2);
  });

  it('a presenter who leaves ends their talk', () => {
    const table = new Table(4);
    table.start();
    table.backstage();
    const presenter = table.t.presenterId;
    table.act({ type: 'release', playerId: presenter });
    expect(table.t.done || table.s.phase !== 'answer').toBe(true);
  });

  it('Kids titles and slides only in a Kids room; Cheeky ones only in Cheeky', () => {
    for (const audience of ['kids', 'cheeky'] as const) {
      const table = new Table(3, [], 3);
      table.start(audience);
      for (const id of table.t.titleChoices) expect(TITLES.find((t) => t.id === id)!.audiences).toContain(audience);
      table.backstage();
      for (const c of table.t.choices) expect(SLIDES.find((s) => s.id === c.slideId)!.audiences).toContain(audience);
    }
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Happyōkai!: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 20, prompt: 2_000, answer: 20_000, encore: 2_000, reveal: 2_000, score: 30, finale: 2_000 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [3, 5]) {
    it(`${players} bots give every talk with every client in sync`, async () => {
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
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 3,
        totalRounds: 1_000,
        mode: 'happyokai',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = happyokaiPolicy({ thinkMs: 40 });
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
      await until(() => finished, 90_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['intro', 'prompt', 'answer', 'encore', 'reveal', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }
      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      for (const s of standings) expect(s.score, s.name).toBeGreaterThan(0);
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && !['wrong-phase', 'say-something', 'question-chosen'].includes(m.error ?? '')));
      expect(bad).toEqual([]);

      for (const b of bots) b.stop();
      director.client.close();
    }, 120_000);
  }
});
