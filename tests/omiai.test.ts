import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { appealQuestion, CARDS, CLOSERS, introQuestion, KEIGO_PAIRS, keigoPair, OPENERS, withName } from '../shared/src/modes/omiai/cards.js';
import { checkManners, METER, restoreScript, verbForms } from '../shared/src/modes/omiai/manners.js';
import {
  ACCEPT_POINTS,
  BONUS_POOL_SHARE,
  dealTiles,
  ENCORE_SHARE,
  joinTiles,
  questionFor,
  SAY_FIRST_MS,
  STAR_METER,
  STYLE_SHARE,
  type OmiaiState,
  type OmiaiView,
} from '../shared/src/modes/omiai/omiai.js';
import { POINTS_PER_VOTE } from '../shared/src/constants.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { omiaiPolicy } from '../tools/bots/policies/omiai.js';
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
  get st(): OmiaiState {
    return this.s.modeState as OmiaiState;
  }
  view(viewer: string | 'stage' = 'stage'): OmiaiView {
    const v = viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
    return v.game as OmiaiView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(rounds?: number, cardId = 'kappa') {
    expect(this.cmd('stage', { type: 'start', mode: 'omiai', extra: { cardId }, ...(rounds ? { rounds } : {}) }).changed).toBe(true);
    this.timeout(); // intro → the guest asks
    expect(this.s.phase).toBe('prompt');
    this.timeout(); // → answer
    expect(this.s.phase).toBe('answer');
  }
  /** Answers by voice (or typing) from memory, for every player given. */
  answer(answers: Record<string, string | Utterance>) {
    for (const [id, a] of Object.entries(answers)) expect(this.play(id, { kind: 'answer', utterance: typeof a === 'string' ? speech(a) : a }).error).toBeUndefined();
  }
  answerOf(id: string) {
    return this.st.current!.answers.find((a) => a.authorId === id)!;
  }
}

const speech = (text: string): Utterance => ({ via: 'speech', text });
const typed = (text: string): Utterance => ({ via: 'typed', text });

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});
/** An utterance as the server would hand it to the rules: with its reading and kuromoji tokens. */
function heard(text: string, via: Utterance['via'] = 'speech'): Utterance {
  const move = { u: { via, text } as Utterance };
  addReadings(move, reader);
  return move.u;
}

// ---- the checker ----

describe('Omiai: the manners checker', () => {
  it('knows polite endings, with or without a final particle', () => {
    for (const t of ['すしが すきです。', 'まいにち はしります', 'きのう いきました。', 'ねこは いません', 'いっしょに いきましょう！', 'たぶん あめでしょう', 'すわって ください', 'なんですか？', 'いいですね', 'がんばりますよ']) {
      const m = checkManners(t, 'n5');
      expect(m.register, t).toBe('polite');
      expect(m.rewrite, t).toBeNull();
      expect(m.politeClauses).toBe(m.clauses);
      expect(m.hits.map((h) => h.kind)).toContain('polite-end');
    }
  });

  it('rewrites plain and casual endings politely, one rule each', () => {
    const cases: [string, string][] = [
      ['すしが すきだ', 'すしが すきです。'],
      ['すしが すきだよ', 'すしが すきですよ。'],
      ['やきゅうが すきじゃん', 'やきゅうが すきですね。'],
      ['まいにち はしる', 'まいにち はしります。'],
      ['きのう たべた', 'きのう たべました。'],
      ['のんだ', 'のみました。'],
      ['いかない', 'いきません。'],
      ['わからない', 'わかりません。'],
      ['たべなかった', 'たべませんでした。'],
      ['べんきょうしてる', 'べんきょうしています。'],
      ['おぼえてない', 'おぼえていません。'],
      ['いっしょに いこう', 'いっしょに いきましょう。'],
      ['ちょっと まって', 'ちょっと まってください。'],
      ['おいしい', 'おいしいです。'],
      ['たのしかった', 'たのしかったです。'],
      ['がくせいじゃない', 'がくせいじゃありません。'],
      ['げんきだった', 'げんきでした。'],
      ['じかんが ない', 'じかんが ありません。'],
      ['いくかな', 'いくでしょうか。'],
      ['きゅうりが だいすきなの？', 'きゅうりが だいすきですか？'],
      ['いっしょに つりを しない？', 'いっしょに つりを しませんか？'],
      ['いっしょに つりを しようよ！', 'いっしょに つりを しましょう。'],
      ['ゲームが すき', 'ゲームが すきです。'],
    ];
    for (const [input, want] of cases) {
      const m = checkManners(input, 'n5');
      expect(m.rewrite?.text, input).toBe(want);
      expect(m.note, input).toBeTruthy();
      expect(['plain', 'casual'], input).toContain(m.register);
      // The rewrite always passes its own check.
      expect(['polite', 'keigo'], want).toContain(checkManners(m.rewrite!.kana, 'n5').register);
    }
  });

  it('swaps casual words, with a note, and judges what was said (not the swap)', () => {
    const cases: [string, string, string][] = [
      ['うん、すき', 'はい、すきです。', 'うん'],
      ['おれは ゲームが すき', 'わたしは ゲームが すきです。', 'おれ'],
      ['まじ やばい', 'ほんとうに すごいです。', 'まじ'],
      ['めっちゃ おいしい', 'とても おいしいです。', 'めっちゃ'],
      ['ありがとう', 'ありがとうございます。', 'ありがとう'],
      ['ごめんね', 'すみません。', 'ごめんね'],
      ['よろしく！', 'よろしくおねがいします。', 'よろしく'],
      ['いいっす', 'いいです。', 'っす'],
      ['えっとね、すしだよ', 'ええと、すしですよ。', 'えっとね'],
    ];
    for (const [input, want, word] of cases) {
      const m = checkManners(input, 'n5');
      expect(m.rewrite?.text, input).toBe(want);
      expect(m.casual.map((c) => c.text).join(','), input).toContain(word);
      expect(m.register, input).toBe('casual');
    }
    // うんどう (exercise) and まじめ (serious) are not slang.
    expect(checkManners('うんどうが すきです', 'n5').casual).toEqual([]);
    expect(checkManners('まじめです', 'n5').casual).toEqual([]);
  });

  it('never lowers the meter for a mistake; only good manners raise it', () => {
    const base = checkManners('すしが すきです', 'n5').meter;
    expect(checkManners('まじ、すしが すきです', 'n5').meter).toBe(base);
    expect(checkManners('すしが すきだよ', 'n5').meter).toBe(0);
    expect(checkManners('やばい じゃん', 'n5').meter).toBe(0);
    for (const t of ['', 'hello', 'うん', 'すしを']) expect(checkManners(t, 'n5').meter).toBeGreaterThanOrEqual(0);
    // More manners, more meter.
    const polite = checkManners('すしが すきです。', 'n4').meter;
    const greeting = checkManners('はじめまして。アキです。よろしく おねがいします。', 'n4', { name: 'アキ' }).meter;
    const keigo = checkManners('はじめまして。アキと もうします。よろしく おねがいいたします。', 'n4', { name: 'アキ' }).meter;
    expect(polite).toBe(METER.ending);
    expect(greeting).toBeGreaterThan(polite);
    expect(keigo).toBeGreaterThan(greeting);
    expect(checkManners('はじめまして。アキと もうします。', 'n4', { name: 'アキ' }).register).toBe('keigo');
    // Level-scaled: the same answer shows more of the meter to a beginner, capped at 100.
    expect(checkManners('すしが すきです。', 'kana').meter).toBeGreaterThan(checkManners('すしが すきです。', 'n5').meter);
    expect(checkManners('すしが すきです。', 'n5').meter).toBeGreaterThan(polite);
    expect(checkManners('しつれいですが、おしごとは なにを なさって いますか。そうですね、すてきですね。', 'kana').meter).toBeLessThanOrEqual(100);
  });

  it('counts set phrases, keigo, お/ご words, aizuchi and cushions', () => {
    const kinds = (t: string, name?: string) => checkManners(t, 'n4', { name }).hits.map((h) => h.kind);
    expect(kinds('はじめまして。ベンです。', 'ベン')).toEqual(expect.arrayContaining(['greeting', 'name-intro', 'polite-end']));
    expect(kinds('せんせいで いらっしゃいますか')).toContain('honorific');
    expect(kinds('おかけに なりますか')).toContain('honorific');
    expect(kinds('なにを めしあがりますか')).toContain('honorific');
    expect(kinds('とうきょうに すんでおります')).toContain('humble');
    expect(kinds('あした まいります')).toContain('humble');
    expect(kinds('がくせいで ございます')).toContain('humble');
    expect(kinds('おしごとは なんですか')).toContain('prefix');
    expect(kinds('なるほど、そうですね')).toContain('aizuchi');
    expect(kinds('しつれいですが、おなまえは？')).toContain('cushion');
    // ごめんなさい is not keigo; おねがいします is a set phrase, not humble keigo.
    expect(kinds('ごめんなさい')).not.toContain('honorific');
    expect(kinds('おねがいします')).not.toContain('humble');
  });

  it('an answer that is only a greeting or an aizuchi needs no ending, at half credit', () => {
    const m = checkManners('はい！', 'n4');
    expect(m.register).toBe('polite');
    expect(m.clauses).toBe(0);
    expect(m.meter).toBe(Math.round(METER.ending / 2 + METER.aizuchi));
    expect(checkManners('はじめまして！', 'n4').rewrite).toBeNull();
  });

  it('leaves alone what it cannot be sure of', () => {
    expect(checkManners('hello there', 'n5')).toMatchObject({ register: 'none', meter: 0, rewrite: null });
    expect(checkManners('すしを', 'n5').rewrite).toBeNull(); // a fragment
    expect(checkManners('えきで', 'n5').rewrite).toBeNull();
    // Kanji with no reading from the server: the ending is still judged, but nothing is guessed.
    expect(checkManners({ via: 'typed', text: '寿司を食べる' }, 'n5').rewrite).toBeNull();
    expect(checkManners({ via: 'typed', text: '寿司が好きです' }, 'n5').register).toBe('polite');
    // Katakana words are nouns (モデル is not モ + でる).
    expect(checkManners('モデル', 'n5').rewrite?.text).toBe('モデルです。');
    expect(checkManners('あした', 'n5').rewrite?.text).toBe('あしたです。');
  });

  it('offers a keigo step up for an answer that is already polite', () => {
    const up = (t: string, name?: string) => checkManners(t, 'n4', { name }).upgrade?.text;
    expect(up('つりを します。')).toBe('つりを いたします。');
    expect(up('とうきょうに すんでいます。')).toBe('とうきょうに すんでおります。');
    expect(up('あした えきに いきます。')).toBe('あした えきに まいります。');
    expect(up('すしを たべます。')).toBe('すしを いただきます。');
    expect(up('はじめまして。アキです。', 'アキ')).toBe('はじめまして。アキともうします。');
    // Words that only contain a verb form are left alone.
    expect(up('ほんを よみます。')).toBeUndefined();
    expect(up('かいものに いきたいです。')).toBeUndefined();
    // Nothing to raise when there is keigo already.
    expect(checkManners('つりを いたします。', 'n4').upgrade).toBeNull();
  });

  it('is deterministic and conjugates the verb table correctly', () => {
    const a = checkManners('おれ、まいにち ゲームする', 'n5');
    expect(checkManners('おれ、まいにち ゲームする', 'n5')).toEqual(a);
    expect(verbForms('のむ', 'u')).toMatchObject({ stem: 'のみ', te: 'のんで', ta: 'のんだ', nai: 'のまない', vol: 'のもう' });
    expect(verbForms('いく', 'u')).toMatchObject({ stem: 'いき', te: 'いって', ta: 'いった' });
    expect(verbForms('かう', 'u')).toMatchObject({ nai: 'かわない' });
    expect(verbForms('たべる', 'ru')).toMatchObject({ stem: 'たべ', te: 'たべて', nai: 'たべない' });
    expect(verbForms('べんきょうする', 'suru')).toMatchObject({ stem: 'べんきょうし', te: 'べんきょうして' });
    expect(verbForms('くる', 'kuru')).toMatchObject({ stem: 'き', nai: 'こない' });
  });
});

describe('Omiai: the checker with real kuromoji tokens', () => {
  it('uses the reading for kanji answers and puts the kanji back in the tip', () => {
    const m = checkManners(heard('明日は休みだ'), 'n5');
    expect(m.rewrite).toEqual({ text: '明日は休みです。', kana: 'あしたはやすみです。' });
    expect(checkManners(heard('寿司を食べる'), 'n5').rewrite?.text).toBe('寿司を食べます。');
    expect(checkManners(heard('お茶が好きです'), 'n5').register).toBe('polite');
    expect(checkManners(heard('お仕事は何ですか'), 'n5').hits.map((h) => h.kind)).toContain('prefix');
    expect(restoreScript('げーむです。', heard('ゲームだ'))).toBe('ゲームです。');
  });

  it('tells nouns from verb forms by the dictionary', () => {
    expect(checkManners(heard('あした'), 'n5').rewrite?.text).toBe('あしたです。');
    expect(checkManners(heard('テレビみた'), 'n5').rewrite?.text).toBe('テレビみました。');
    expect(checkManners(heard('コンビニじゃん'), 'n5').rewrite?.text).toBe('コンビニですね。');
    expect(checkManners(heard('やまだ'), 'n5').rewrite?.text).toBe('やまだです。');
    expect(checkManners(heard('まいにち のむよ'), 'n5').rewrite?.text).toBe('まいにち のみますよ。');
    // An odd split of kana (ご|し|ゅみは) is not trusted as a noun.
    expect(checkManners(heard('しつれいですが、ごしゅみは？'), 'n5').rewrite).toBeNull();
  });

  it('gives the same verdict with and without tokens on kana answers', () => {
    for (const t of ['すしが すきだよ', 'はじめまして。アキです。', 'うん、ねこが だいすき', 'とうきょうに すんでおります', 'いっしょに つりを しようよ']) {
      const a = checkManners(heard(t), 'n5', { name: 'アキ' });
      const b = checkManners(t, 'n5', { name: 'アキ' });
      expect(a.register, t).toBe(b.register);
      expect(a.meter, t).toBe(b.meter);
      expect(a.rewrite?.kana, t).toBe(b.rewrite?.kana);
    }
  });
});

// ---- content ----

describe('Omiai: the character cards', () => {
  const allQuestions = CARDS.flatMap((c) => [introQuestion(c), ...c.questions, appealQuestion(c)]);

  it('has 8 draft cards, kana only, 3 questions each, with unique ids and known keigo pairs', () => {
    expect(CARDS.length).toBe(8);
    const ids = new Set<string>();
    for (const c of CARDS) {
      expect(c.status).toBe('draft');
      expect(c.questions.length).toBeGreaterThanOrEqual(3);
      expect(c.appeal.length).toBeGreaterThanOrEqual(3);
      expect(c.accept.text).toContain('{name}');
      for (const q of [introQuestion(c), ...c.questions, appealQuestion(c)]) {
        expect(ids.has(q.id), q.id).toBe(false);
        ids.add(q.id);
        expect(keigoPair(q.keigo), q.id).toBeDefined();
        for (const jp of [q.ask.n5, q.ask.n4, ...q.fills, ...Object.values(q.example)]) expect(jp.text, q.id).not.toMatch(/[一-鿿]/);
      }
    }
    expect(new Set(KEIGO_PAIRS.map((p) => p.id)).size).toBe(KEIGO_PAIRS.length);
  });

  it('every stock answer is judged polite at its level, with and without tokens', () => {
    for (const q of allQuestions) {
      for (const level of ['kana', 'n5', 'n4'] as const) {
        const ex = withName(q.example[level], 'アキ');
        for (const u of [heard(ex.text), typed(ex.text)]) {
          const m = checkManners(u, level, { name: 'アキ' });
          expect(['polite', 'keigo'], `${q.id} ${level}: ${ex.text}`).toContain(m.register);
          expect(m.rewrite, `${q.id} ${level}`).toBeNull();
        }
      }
    }
  });

  it('the guests model keigo: every N4 question has an honorific, humble or お/ご touch', () => {
    for (const q of allQuestions) {
      const kinds = checkManners(q.ask.n4.kana, 'n4').hits.map((h) => h.kind);
      expect(kinds.some((k) => k === 'honorific' || k === 'humble' || k === 'prefix'), `${q.id}: ${q.ask.n4.text}`).toBe(true);
      expect(['polite', 'keigo'], `${q.id}: ${q.ask.n5.text}`).toContain(checkManners(q.ask.n5.kana, 'n5').register);
    }
  });

  it('tiles: a polite ending makes a polite answer, a casual one a casual answer with a polite fix', () => {
    for (const q of allQuestions) {
      const lead = q.lead ? `${q.lead.text} ` : '';
      for (const fill of q.fills.map((f) => withName(f, 'アキ'))) {
        for (const e of q.endings.polite) {
          const m = checkManners(`${lead}${fill.text}${e.jp.text}`, 'n4', { name: 'アキ' });
          expect(['polite', 'keigo'], `${q.id}: ${fill.text}${e.jp.text}`).toContain(m.register);
        }
        for (const e of q.endings.casual) {
          const m = checkManners(`${lead}${fill.text}${e.jp.text}`, 'n5');
          expect(['plain', 'casual'], `${q.id}: ${fill.text}${e.jp.text}`).toContain(m.register);
          expect(m.rewrite, `${q.id}: ${fill.text}${e.jp.text}`).not.toBeNull();
          expect(['polite', 'keigo']).toContain(checkManners(m.rewrite!.kana, 'n5').register);
        }
      }
    }
    for (const o of [...OPENERS.wh.casual, ...OPENERS.yesno.casual, ...OPENERS.intro.casual, ...CLOSERS.casual]) {
      expect(checkManners(`${o.text}すしです。`, 'n5').casual.length, o.text).toBeGreaterThan(0);
    }
  });

  it('round 1 introduces, the last round appeals, the middle asks the card in order', () => {
    const card = CARDS[0]!;
    expect(questionFor(card, 1, 4).id).toBe(`${card.id}.intro`);
    expect(questionFor(card, 2, 4).id).toBe(card.questions[0]!.id);
    expect(questionFor(card, 3, 4).id).toBe(card.questions[1]!.id);
    expect(questionFor(card, 4, 4).id).toBe(`${card.id}.appeal`);
    expect(questionFor(card, 4, 5).id).toBe(card.questions[2]!.id);
  });
});

// ---- the rules ----

describe('Omiai: answering', () => {
  it('runs intro → the guest asks → answer, and ends the answer phase once everyone is in', () => {
    const t = new Table(3);
    t.start();
    expect(t.view().question?.text).toContain('はじめまして');
    t.answer({ p1: 'はじめまして。P1です。よろしく おねがいします。', p2: 'やあ、P2だよ', p3: typed('P3です') });
    expect(t.s.phase).toBe('reveal');
  });

  it('say it first: tiles open only after 5 seconds from N5 up; Kana players get them at once, with romaji', () => {
    const t = new Table(3, ['n5', 'kana', 'n4']);
    t.start();
    expect(t.view('p1').me!.slot!.sayFirst).toBe(true);
    expect(t.view('p1').me!.slot!.tiles).toEqual([]);
    expect(t.play('p1', { kind: 'tiles' }).error).toBe('say-it-first');
    expect(t.play('p1', { kind: 'answer', tiles: ['opener0'] }).error).toBe('say-it-first');
    t.now += SAY_FIRST_MS;
    expect(t.play('p1', { kind: 'tiles' }).error).toBeUndefined();
    expect(t.view('p1').me!.slot!.tiles.length).toBeGreaterThan(4);
    const kana = t.view('p2').me!.slot!;
    expect(kana.sayFirst).toBe(false);
    expect(kana.tiles[0]!.romaji).toBeTruthy();
    expect(kana.question.romaji).toBeTruthy();
    // N4 hears the keigo question and gets the humble ending tile.
    expect(t.view('p3').me!.slot!.question.text).toContain('うかがっても');
    t.now += SAY_FIRST_MS;
    t.play('p3', { kind: 'tiles' });
    expect(t.view('p3').me!.slot!.tiles.map((x) => x.text)).toContain('と もうします。');
    expect(t.view('p1').me!.slot!.tiles.map((x) => x.text)).not.toContain('と もうします。');
  });

  it('builds a tile answer on the server, with the player’s own name tile', () => {
    const t = new Table(3, ['kana', 'n5', 'n5']);
    t.start();
    const tiles = t.st.current!.slots.p1!.tiles;
    const pick = (role: string, text: string) => tiles.find((x) => x.role === role && x.jp.text === text)!.key;
    const keys = [pick('opener', 'はじめまして。'), pick('fill', 'P1'), pick('ending', 'です。'), pick('closer', 'よろしく おねがいします。')];
    expect(t.play('p1', { kind: 'answer', tiles: keys }).error).toBeUndefined();
    const a = t.answerOf('p1');
    expect(a.text).toBe('はじめまして。P1です。よろしく おねがいします。');
    expect(a.style).toBe('tiles');
    expect(a.manners.register).toBe('polite');
    expect(joinTiles([tiles.find((x) => x.role === 'fill')!, tiles.find((x) => x.jp.text === 'だよ。')!])).toBe('P1だよ。');
    // Bad tile moves.
    expect(t.play('p2', { kind: 'answer', tiles: ['nope'] }).error).toBe('say-it-first');
    t.now += SAY_FIRST_MS;
    t.play('p2', { kind: 'tiles' });
    expect(t.play('p2', { kind: 'answer', tiles: ['nope'] }).error).toBe('bad-move');
    expect(t.play('p2', { kind: 'answer', tiles: ['fill1', 'fill1'] }).error).toBe('bad-move');
    expect(t.play('p2', { kind: 'answer', tiles: [] }).error).toBe('bad-move');
    expect(t.play('p1', { kind: 'answer', utterance: speech('もう いちど') }).error).toBe('already-answered');
    expect(t.play('p3', { kind: 'answer', utterance: speech('   ') }).error).toBe('empty-answer');
  });

  it('deals polite and casual endings side by side, so a tile answer is a register choice', () => {
    for (const card of CARDS) {
      for (let round = 1; round <= 4; round++) {
        const q = questionFor(card, round, 4);
        const kind = round === 1 ? 'intro' : round === 4 ? 'appeal' : 'question';
        for (const level of ['kana', 'n5', 'n4'] as const) {
          const tiles = dealTiles(q, kind, { id: 'x', name: 'アキ', seat: 1, level, connected: true, score: 0 }, mulberry(round));
          const endings = tiles.filter((x) => x.role === 'ending');
          expect(endings.some((x) => x.casual) && endings.some((x) => !x.casual), `${q.id} ${level}`).toBe(true);
          expect(tiles.filter((x) => x.role === 'fill').length).toBeLessThanOrEqual(level === 'kana' ? 3 : 4);
          expect(new Set(tiles.map((x) => x.key)).size).toBe(tiles.length);
        }
      }
    }
  });

  it('style follows how it was said: from memory, after the tiles, typed or tapped', () => {
    const t = new Table(4, ['n5', 'n5', 'n5', 'kana']);
    t.start();
    t.answer({ p1: 'はじめまして。P1です。', p2: typed('はじめまして。P2です。') });
    t.now += SAY_FIRST_MS;
    t.play('p3', { kind: 'tiles' });
    t.answer({ p3: 'はじめまして。P3です。', p4: 'はじめまして。P4です。' });
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => t.answerOf(id).style)).toEqual(['memory-spoken', 'memory-typed', 'spoken', 'spoken']);
  });
});

describe('Omiai: voting, the manners meter and points', () => {
  function round1(levels: Level[] = []) {
    const t = new Table(3, levels);
    t.start();
    t.answer({ p1: 'はじめまして。P1と もうします。よろしく おねがいいたします。', p2: 'やあ、P2だよ', p3: 'hi, I am P3' });
    expect(t.s.phase).toBe('reveal');
    return t;
  }

  it('reveals answers anonymously, then authors and meters after the vote', () => {
    const t = round1();
    const stage = t.view();
    expect(stage.answers.length).toBe(3);
    expect(stage.answers.every((a) => a.authorId === undefined && a.meter === undefined)).toBe(true);
    expect(JSON.stringify(stage)).not.toContain('"tip"');
    const mine = t.view('p2').answers.filter((a) => a.mine);
    expect(mine.length).toBe(1);
    expect(t.view('p2').me!.tip).toBeNull();
    const id = (author: string) => t.answerOf(author).id;
    expect(t.play('p1', { kind: 'vote', answerId: id('p1') }).error).toBe('own-answer');
    t.play('p1', { kind: 'vote', answerId: id('p2') });
    expect(t.play('p1', { kind: 'vote', answerId: id('p3') }).error).toBe('already-voted');
    t.play('p2', { kind: 'vote', answerId: id('p1') });
    t.play('p3', { kind: 'vote', answerId: id('p1') });
    expect(t.s.phase).toBe('encore');
    const after = t.view();
    const p1 = after.answers.find((a) => a.authorId === 'p1')!;
    expect(p1).toMatchObject({ winner: true, votes: 2, register: 'keigo' });
    expect(p1.reaction?.emoji).toBe('🫖');
    expect(after.answers.find((a) => a.authorId === 'p2')!.register).toBe('casual');
    expect(after.answers.find((a) => a.authorId === 'p3')!.register).toBe('none');
  });

  it('pays votes plus a manners bonus within the 30% pool; casual and English answers lose nothing', () => {
    const t = round1();
    const id = (author: string) => t.answerOf(author).id;
    t.play('p1', { kind: 'vote', answerId: id('p2') });
    t.play('p2', { kind: 'vote', answerId: id('p3') });
    t.play('p3', { kind: 'vote', answerId: id('p2') });
    const cap = Math.round((BONUS_POOL_SHARE * POINTS_PER_VOTE * 2) / 5) * 5;
    const m1 = t.answerOf('p1').manners.meter;
    expect(t.score('p1')).toBe(Math.min(cap, Math.round((cap * (m1 / 100) * STYLE_SHARE['memory-spoken']) / 5) * 5));
    expect(t.score('p2')).toBe(2 * POINTS_PER_VOTE); // casual: votes count in full, no manners bonus
    expect(t.score('p3')).toBe(POINTS_PER_VOTE); // English: votes count, no bonus
    const bonus = t.st.current!.result!.map((l) => l.bonus);
    expect(bonus.every((b) => b <= cap)).toBe(true);
  });

  it('every phone gets its own private tip: the rewrite, the keigo step up, or the stock answer', () => {
    const t = round1(['n4', 'n5', 'n5']);
    for (const p of ['p1', 'p2', 'p3']) t.play(p, { kind: 'vote', answerId: t.st.current!.answers.find((a) => a.authorId !== p)!.id });
    expect(t.s.phase).toBe('encore');
    const tip = (id: string) => t.view(id).me!.tip!;
    expect(tip('p1').kind).toBe('perfect'); // already keigo
    expect(tip('p2')).toMatchObject({ kind: 'rewrite', target: { text: 'こんにちは、P2ですよ。' } });
    expect(tip('p2').casual.map((c) => c.text)).toContain('やあ');
    expect(tip('p3').kind).toBe('stock');
    expect(tip('p3').target.text).toBe('はじめまして。P3です。よろしく おねがいします。');
    // Nobody sees anyone else's tip.
    expect(JSON.stringify(t.view('p1'))).not.toContain('P2ですよ');
    expect(JSON.stringify(t.view())).not.toContain('P2ですよ');
  });

  it('the encore: say the polite version back for a bonus, two tries, never past the cap', () => {
    const t = round1();
    for (const p of ['p1', 'p2', 'p3']) t.play(p, { kind: 'vote', answerId: t.answerOf(p === 'p1' ? 'p2' : 'p1').id });
    const before = t.score('p2');
    expect(t.play('p2', { kind: 'encore', utterance: speech('ちがう ことば') }).error).toBeUndefined();
    expect(t.view('p2').me!.encore).toMatchObject({ ok: false, triesLeft: 1, heard: 'ちがう ことば' });
    expect(t.play('p2', { kind: 'encore', utterance: speech('こんにちは、P2ですよ') }).error).toBeUndefined();
    expect(t.view('p2').me!.encore!.ok).toBe(true);
    t.play('p1', { kind: 'encore', pass: true });
    t.play('p3', { kind: 'encore', utterance: typed('はじめまして。P3です。よろしく おねがいします。') });
    expect(t.s.phase).toBe('score');
    const line = t.st.current!.result!.find((l) => l.authorId === 'p2')!;
    expect(line.encoreBonus).toBe(Math.round((line.cap * ENCORE_SHARE.other.speech) / 5) * 5);
    expect(t.score('p2')).toBe(before + line.encoreBonus);
    for (const l of t.st.current!.result!) expect(l.bonus + l.encoreBonus).toBeLessThanOrEqual(l.cap);
    // Phrasebook: the polite version, said; the stock answer seen by everyone.
    expect(t.s.phrasebook.p2!.find((e) => e.itemId.startsWith('omiai:'))).toMatchObject({ outcome: 'said', text: 'こんにちは、P2ですよ。' });
    expect(t.s.phrasebook.p1!.some((e) => e.itemId === 'kappa.intro:example')).toBe(true);
    // The stage shows the winner's answer said politely.
    expect(t.view().natural?.from).toBe('p1');
  });

  it('comebacks raise a trailing player’s bonus, never past the cap', () => {
    const t = new Table(3);
    t.start();
    t.s.players.find((p) => p.id === 'p1')!.score = 1000;
    const keigo = 'はじめまして。P2と もうします。どうぞ よろしく おねがいいたします。';
    t.answer({ p1: 'はじめまして。P1です。', p2: keigo, p3: 'すしです' });
    for (const p of ['p1', 'p2', 'p3']) t.play(p, { kind: 'vote', answerId: t.answerOf(p === 'p1' ? 'p3' : 'p1').id });
    for (const l of t.st.current!.result!) expect(l.bonus).toBeLessThanOrEqual(l.cap);
    expect(t.st.current!.result!.find((l) => l.authorId === 'p2')!.bonus).toBe(t.st.current!.result![0]!.cap);
  });

  it('the VIP can hide an answer; votes for it are returned', () => {
    const t = round1();
    const p2 = t.answerOf('p2').id;
    t.play('p3', { kind: 'vote', answerId: p2 });
    expect(t.play('p2', { kind: 'hide', answerId: p2 }).error).toBe('not-vip');
    expect(t.play('p1', { kind: 'hide', answerId: p2 }).error).toBeUndefined();
    expect(t.st.current!.votes.p3).toBeUndefined();
    expect(t.view().answers.find((a) => a.id === p2)!.text).toBe('[hidden]');
    expect(t.play('p3', { kind: 'vote', answerId: p2 }).error).toBe('hidden');
  });
});

describe('Omiai: the finale and the whole game', () => {
  it('the last round is worth double, and the guest invites the contestant with the most hearts', () => {
    const t = new Table(3);
    t.start(3);
    for (let round = 1; round <= 3; round++) {
      expect(t.s.phase).toBe('answer');
      t.answer({ p1: 'はい、だいすきです。よろしく おねがいします。', p2: 'うん、すきだよ', p3: 'すき' });
      // Everyone votes for p2's casual answer: charm wins votes, manners win stars.
      t.play('p1', { kind: 'vote', answerId: t.answerOf('p2').id });
      t.play('p3', { kind: 'vote', answerId: t.answerOf('p2').id });
      t.play('p2', { kind: 'vote', answerId: t.answerOf('p3').id });
      if (round === 3) expect(t.view().multiplier).toBe(2);
      // The last vote closes the charm vote; time runs out on the rest until the next question.
      for (let i = 0; i < 10 && t.s.phase !== 'answer' && t.s.phase !== 'finale'; i++) t.timeout();
    }
    expect(t.s.phase).toBe('finale');
    const v = t.view();
    expect(v.finale!.accepted).toBe('p2'); // 6 vote hearts beat 3 star hearts
    expect(v.finale!.line!.text).toContain('P2さん');
    expect(t.view('p2').me!.accepted).toBe(true);
    expect(t.st.stats.p1!.stars).toBe(3);
    expect(t.answerOf('p1').manners.meter).toBeGreaterThanOrEqual(STAR_METER);
    const before = t.score('p2');
    t.timeout();
    expect(t.s.phase).toBe('recap');
    expect(t.score('p2')).toBe(before);
    expect(t.s.recap!.awards.map((a) => a.title)).toEqual(expect.arrayContaining(['おちゃの しょうたい', 'おもてなし しょう', 'にんきもの']));
    expect(t.s.recap!.awards.find((a) => a.title === 'おちゃの しょうたい')!.playerId).toBe('p2');
    expect(t.s.recap!.awards.find((a) => a.title === 'おもてなし しょう')!.playerId).toBe('p1');
    expect(before).toBeGreaterThanOrEqual(ACCEPT_POINTS);
  });

  it('nobody is invited when nobody earned a heart; points never go down', () => {
    const t = new Table(3, [], EMPTY_CONTENT, 3);
    expect(t.cmd('stage', { type: 'start', mode: 'omiai' }).changed).toBe(true);
    const scores: number[] = [];
    for (let i = 0; i < 60 && t.s.phase !== 'recap'; i++) {
      if (t.s.phase === 'finale') expect(t.view().finale!.accepted).toBeNull();
      t.timeout();
      scores.push(t.s.players.reduce((n, p) => n + p.score, 0));
    }
    expect(t.s.phase).toBe('recap');
    expect(t.st.round).toBe(4);
    expect(scores.every((x, i) => i === 0 || x >= scores[i - 1]!)).toBe(true);
  });

  it('picks a random card unless one is asked for; 5 rounds use all three of its questions', () => {
    const t = new Table(2, [], REAL_CONTENT, 11);
    expect(t.cmd('stage', { type: 'start', mode: 'omiai', rounds: 5 }).changed).toBe(true);
    expect(CARDS.map((c) => c.id)).toContain(t.st.cardId);
    const asked: string[] = [];
    for (let i = 0; i < 80 && t.s.phase !== 'recap'; i++) {
      if (t.s.phase === 'prompt') asked.push(t.st.current!.question.id);
      t.timeout();
    }
    expect(asked.length).toBe(5);
    expect(new Set(asked).size).toBe(5);
  });

  it('survives players leaving mid-round', () => {
    const t = new Table(4);
    t.start();
    t.answer({ p1: 'はじめまして。P1です。', p2: 'P2です' });
    t.act({ type: 'release', playerId: 'p2' });
    t.timeout(); // → reveal
    t.play('p1', { kind: 'vote', answerId: t.st.current!.answers.find((a) => a.authorId !== 'p1')?.id ?? 'x' });
    t.act({ type: 'release', playerId: 'p3' });
    for (let i = 0; i < 60 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Omiai: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      reader,
      durations: { intro: 20, prompt: 30, answer: 1_200, reveal: 400, encore: 400, score: 30, finale: 30 },
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
      const registers = new Set<string>();
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 4,
        totalRounds: 1_000,
        mode: 'omiai',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          const g = view.game as OmiaiView | null;
          if (g?.mode === 'omiai') for (const a of g.answers) if (a.register) registers.add(a.register);
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = omiaiPolicy({ thinkMs: 60, tilesChance: 0, quiet: (id) => id.endsWith('2') });
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

      for (const p of ['intro', 'prompt', 'answer', 'reveal', 'encore', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      expect(registers.size).toBeGreaterThan(1);

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
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(players * 6);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
