import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level, OnsenCase, OnsenIntent } from '../content/src/types.js';
import { onsenCases } from '../content/src/onsen/cases.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import {
  BONUS_CAP,
  caseFor,
  cleanLead,
  deputyOffers,
  onsenMurderMode,
  POINTS,
  REPORT_VOICE,
  suspectLineRequests,
  THINK_MS,
  TURNS,
  type OnsenState,
  type OnsenView,
} from '../shared/src/modes/onsenMurder/onsenMurder.js';
import { checkReport, joinReport, reportFrame, reportWords, tilesInOrder } from '../shared/src/modes/onsenMurder/deputy.js';
import { accusationLine, calledName, checkAccusation, INTENTS, joinTiles, matchQuestion, questionFor, tilesFor } from '../shared/src/modes/onsenMurder/questions.js';
import { hasKanji, normalizeReading } from '../shared/src/japanese/kana.js';
import type { Audience, Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { createHostVoice, createSuspectVoice, ScriptedLlm, type BankLine } from '../server/ai/index.js';
import { suspectDirector } from '../server/src/onsen.js';
import type { Room } from '../server/src/room.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { buildQuestion, onsenMurderPolicy } from '../tools/bots/policies/onsenMurder.js';
import { createKotobaServer, type KotobaServer } from '../server/src/server.js';
import { content, hashView, TruthRecorder, until } from './helpers.js';
import { bankVoice } from '../server/src/host.js';

const CONTENT: ContentLibrary = { ...EMPTY_CONTENT, onsenCases };
const snowman = onsenCases.find((c) => c.id === 'snowman')!;

class Table {
  now = 1_000_000;
  ids = 0;
  cmdId = 0;
  readonly s: GameState = createGame('BCDF');
  constructor(
    players: number,
    readonly content: ContentLibrary = CONTENT,
    levels: Level[] = [],
  ) {
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: levels[i - 1] ?? 'n5' });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: this.content, newId: () => `id${++this.ids}`, random: () => 0.42 };
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
  get st(): OnsenState {
    return this.s.modeState as OnsenState;
  }
  view(viewer: string | 'stage' = 'stage'): OnsenView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content).game as OnsenView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(caseId = 'snowman', rounds?: number) {
    expect(this.cmd('stage', { type: 'start', mode: 'onsen-murder', rounds, extra: { caseId } }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  get turnPlayer(): string {
    return this.st.turn!.playerId!;
  }
  ask(suspectId: string, text: string, via: 'speech' | 'typed' | 'tap' = 'speech', player = this.turnPlayer) {
    return this.play(player, { kind: 'ask', suspectId, utterance: { via, text } });
  }
  /** Runs turns until the accusation. */
  toAccuse() {
    for (let guard = 0; guard < 100 && this.s.phase !== 'encore'; guard++) this.timeout();
    expect(this.s.phase).toBe('encore');
  }
}

const speech = (text: string, reading?: string) => ({ via: 'speech' as const, text, reading });

// ---- questions and content ----

describe('Murder at the Onsen: matching questions', () => {
  it('maps every natural question to its own intent, for every case', () => {
    for (const c of onsenCases) {
      for (const intent of INTENTS) {
        const q = questionFor(c, intent);
        expect(matchQuestion(c, { text: q.text }).intent, `${c.id} ${intent}`).toBe(intent);
        // Built from the tiles too (what the bots and the tile builder send).
        expect(matchQuestion(c, { text: buildQuestion(tilesFor(c), intent) }).intent, `${c.id} tiles ${intent}`).toBe(intent);
      }
    }
  });

  it('is lenient: bare question words, plain forms, kanji through the reading, katakana', () => {
    const c = snowman;
    expect(matchQuestion(c, { text: 'どこ？' }).intent).toBe('where');
    expect(matchQuestion(c, { text: '何時に寝ましたか', reading: 'なんじにねましたか' }).intent).toBe('when');
    expect(matchQuestion(c, { text: 'いつ ねた？' }).intent).toBe('when');
    expect(matchQuestion(c, { text: 'だれを みた？' }).intent).toBe('who');
    expect(matchQuestion(c, { text: 'なにを してた？' }).intent).toBe('what');
    expect(matchQuestion(c, { text: 'マフラーは だれの？' }).intent).toBe('item');
    expect(matchQuestion(c, { text: 'まふらー だれの' }).intent).toBe('item');
    expect(matchQuestion(c, { text: 'ゆきだるまさんは どんな ひと？' }).intent).toBe('victim');
  });

  it('gives no question for a mumble, but keeps the closest guess for the hint', () => {
    expect(matchQuestion(snowman, { text: 'えっと…' })).toEqual({ intent: null, closest: null });
    expect(matchQuestion(snowman, { text: 'して' })).toEqual({ intent: null, closest: 'what' });
  });

  it('joins tiles with particles hugging the word before', () => {
    const tiles = tilesFor(snowman);
    expect(buildQuestion(tiles, 'where')).toBe('どこに いましたか？');
    expect(buildQuestion(tiles, 'item')).toBe('この あかい マフラーは だれの ですか？');
    expect(joinTiles([])).toBe('');
  });

  it('checks the accusation: はんにん and the right name, kanji or kana', () => {
    const tanaka = snowman.suspects.find((s) => s.id === 'tanaka')!;
    const suzuki = snowman.suspects.find((s) => s.id === 'suzuki')!;
    expect(accusationLine(tanaka).text).toBe('はんにんは たなかさんです！');
    expect(checkAccusation({ text: 'はんにんは たなかさんです' }, tanaka)).toBe(true);
    expect(checkAccusation({ text: '犯人は田中さんです', reading: 'はんにんはたなかさんです' }, tanaka)).toBe(true);
    expect(checkAccusation({ text: 'たなかさん！' }, tanaka)).toBe(false);
    expect(checkAccusation({ text: 'はんにんは すずきさんです' }, tanaka)).toBe(false);
    expect(checkAccusation({ text: 'はんにんは すずきさんです' }, suzuki)).toBe(true);
  });
});

describe('Murder at the Onsen: the cases', () => {
  const check = (c: OnsenCase) => {
    expect(c.status).toBe('draft');
    expect(c.suspects.length).toBeGreaterThanOrEqual(3);
    expect(c.suspects.length).toBeLessThanOrEqual(4);
    expect(c.suspects.map((s) => s.id)).toContain(c.culpritId);
    expect(new Set(c.suspects.map((s) => normalizeReading(s.name.kana))).size).toBe(c.suspects.length);
    const clueIds = new Set(c.clues.map((x) => x.id));
    const given = new Set<string>();
    for (const s of c.suspects) {
      for (const intent of INTENTS) {
        const a = s.answers[intent];
        expect(a, `${c.id}/${s.id}/${intent}`).toBeTruthy();
        expect(a!.jp.kana && a!.jp.en && a!.jp.text).toBeTruthy();
        expect(hasKanji(a!.jp.kana), `${c.id}/${s.id}/${intent} kana`).toBe(false);
        if (a!.clueId) {
          expect(clueIds.has(a!.clueId), a!.clueId).toBe(true);
          given.add(a!.clueId);
        }
      }
    }
    // Every clue can be found, and at least three of them are key.
    expect([...clueIds].filter((id) => !given.has(id))).toEqual([]);
    expect(c.clues.filter((x) => x.key).length).toBeGreaterThanOrEqual(3);
    // The culprit is named by the notebook's key clues more than anyone else.
    const named = (id: string) => c.clues.filter((x) => x.key && normalizeReading(x.jp.kana).includes(normalizeReading(c.suspects.find((s) => s.id === id)!.name.kana))).length;
    for (const s of c.suspects) if (s.id !== c.culpritId) expect(named(c.culpritId), `${c.id}: ${s.id}`).toBeGreaterThan(named(s.id));
    for (const line of [...c.confession, c.title, c.setting, c.victim.found, c.shrug]) expect(hasKanji(line.kana)).toBe(false);
    // The item's keys really are in its name.
    for (const key of c.item.keys) expect(normalizeReading(c.item.name.kana)).toContain(normalizeReading(key));
  };
  for (const c of onsenCases) it(`${c.id} is complete and points at its culprit`, () => check(c));

  it('ships three cases for everyone, one Kids and four Cheeky, served through the content library', () => {
    expect(onsenCases.map((c) => c.id)).toEqual(['snowman', 'pudding', 'duck', 'ice-cream', 'sake', 'phone', 'toupee', 'candle']);
    expect(onsenCases.map((c) => c.audience ?? null)).toEqual([null, null, null, 'kids', 'cheeky', 'cheeky', 'cheeky', 'cheeky']);
    expect(content.onsenCases.length).toBe(8);
    expect(content.hostLines.filter((l) => l.event.startsWith('onsen_')).length).toBe(26);
  });

  it('picks by the room’s Audience: a family room never gets the Kids or Cheeky case, the others get their own half the time', () => {
    const seen = (audience: Audience) => {
      const ids = new Map<string, number>();
      // An even spread: the first draw (own case or not) walks 0.00…0.99, the second picks within.
      for (let i = 0; i < 100; i++) {
        const draws = [i / 100, ((i * 37) % 100) / 100];
        const c = caseFor(onsenCases, audience, () => draws.shift() ?? 0)!;
        ids.set(c.id, (ids.get(c.id) ?? 0) + 1);
      }
      return ids;
    };
    const family = seen('family');
    expect([...family.keys()].sort()).toEqual(['duck', 'pudding', 'snowman']);
    const kids = seen('kids');
    expect(kids.get('ice-cream')).toBe(50);
    expect(['sake', 'phone', 'toupee', 'candle'].some((id) => kids.has(id))).toBe(false);
    const cheeky = seen('cheeky');
    expect(['sake', 'phone', 'toupee', 'candle'].map((id) => cheeky.get(id) ?? 0).reduce((a, b) => a + b)).toBe(50);
    expect(['sake', 'phone', 'toupee', 'candle'].every((id) => cheeky.has(id))).toBe(true);
    expect(cheeky.has('ice-cream')).toBe(false);
    // Nothing that suits the room: the placeholder, never another audience's case.
    expect(caseFor(onsenCases.filter((c) => c.audience === 'cheeky'), 'kids', () => 0.1)).toBeUndefined();
  });

  it('a game started in a Kids room plays the Kids case when the dice say so', () => {
    const t = new Table(2);
    t.s.audience = 'kids';
    expect(t.cmd('stage', { type: 'start', mode: 'onsen-murder' }).changed).toBe(true);
    expect(t.st.case.id).toBe('ice-cream');
  });
});

// ---- rules ----

describe('Murder at the Onsen: questioning', () => {
  it('a spoken question that finds a clue earns question + clue points and the speaking bonus', () => {
    const t = new Table(3);
    t.start();
    const asker = t.turnPlayer;
    expect(t.view(asker).mine?.isTurn).toBe(true);
    expect(t.ask('suzuki', 'だれを みましたか').error).toBeUndefined();
    expect(t.s.phase).toBe('reveal');
    const cur = t.view().current!;
    expect(cur.answer.text).toContain('たなかさんを みました');
    expect(cur.newClue).toBe(true);
    expect(cur.natural.text).toBe('だれを みましたか？');
    // 20 + 100 base, +40 spoken (under 3/7 of 120 = 51).
    expect(t.score(asker)).toBe(POINTS.question + POINTS.clue + POINTS.spokenQuestion);
    expect(t.view().notebook.map((n) => n.id)).toEqual(['saw-tanaka']);
    expect(t.s.phrasebook[asker]?.some((e) => e.itemId === 'onsen.q.who' && e.outcome === 'said')).toBe(true);
    // Everyone else gets the question as "seen".
    const other = t.s.players.find((p) => p.id !== asker)!.id;
    expect(t.s.phrasebook[other]?.some((e) => e.itemId === 'onsen.q.who' && e.outcome === 'seen')).toBe(true);
  });

  it('the speaking bonus only pays out up to 30% of the score', () => {
    const t = new Table(1);
    t.start();
    // A question with no clue: 20 base, 40 bonus earned but only floor(20 × 3/7) = 8 paid.
    t.ask('tanaka', 'だれを みましたか');
    expect(t.score('p1')).toBe(20 + 8);
    expect(t.st.tally.p1).toMatchObject({ base: 20, bonusEarned: 40, bonusPaid: 8 });
    // A clue later lifts the cap and pays out more of the pool.
    t.timeout();
    t.ask('suzuki', 'だれを みましたか');
    expect(t.st.tally.p1).toMatchObject({ base: 140, bonusEarned: 80, bonusPaid: 60 });
    expect(t.score('p1')).toBe(200);
    expect(t.st.tally.p1!.bonusPaid / t.score('p1')).toBeLessThanOrEqual(0.3);
  });

  it('a question nobody can place gets one retry with a hint, then counts as a retry', () => {
    const t = new Table(2);
    t.start();
    const asker = t.turnPlayer;
    expect(t.ask('yamada', 'して').error).toBeUndefined();
    expect(t.s.phase).toBe('answer');
    const mine = t.view(asker).mine!;
    expect(mine.triesLeft).toBe(1);
    expect(mine.miss).toMatchObject({ heard: 'して', suspectId: 'yamada', hint: { text: 'なにを して いましたか？' } });
    expect(t.view().turn?.miss).toEqual({ suspectId: 'yamada', heard: 'して' });
    t.ask('yamada', 'なにを していましたか');
    expect(t.s.phase).toBe('reveal');
    expect(t.view().current?.newClue).toBe(true);
    expect(t.s.phrasebook[asker]?.find((e) => e.itemId === 'onsen.q.what')?.outcome).toBe('retry');
  });

  it('after two misses the suspect answers the closest question: the clue counts, the question does not', () => {
    const t = new Table(2);
    t.start();
    const asker = t.turnPlayer;
    t.ask('suzuki', 'えっと');
    t.ask('suzuki', 'うーん');
    expect(t.s.phase).toBe('reveal');
    const cur = t.view().current!;
    expect(cur.guessed).toBe(true);
    expect(cur.intent).toBe('where');
    expect(t.score(asker)).toBe(0);
    expect(t.s.phrasebook[asker]?.find((e) => e.itemId === 'onsen.q.where')?.outcome).toBe('missed');
  });

  it('repeats earn nothing; tile-built questions earn points but no speaking bonus', () => {
    const t = new Table(2);
    t.start();
    const a = t.turnPlayer;
    t.ask('tanaka', 'どこに いましたか', 'tap');
    expect(t.score(a)).toBe(POINTS.question + POINTS.clue);
    expect(t.s.phrasebook[a]?.find((e) => e.itemId === 'onsen.q.where')?.outcome).toBe('seen');
    t.timeout();
    const b = t.turnPlayer;
    expect(b).not.toBe(a);
    t.ask('tanaka', 'どこに いましたか？');
    expect(t.view().current).toMatchObject({ repeat: true, newClue: false, points: 0 });
    expect(t.score(b)).toBe(0);
    expect(t.view().suspects.find((s) => s.id === 'tanaka')?.asked).toEqual(['where']);
  });

  it('refuses moves out of turn, bad suspects and empty questions', () => {
    const t = new Table(2);
    t.start();
    const other = t.s.players.find((p) => p.id !== t.turnPlayer)!.id;
    expect(t.ask('tanaka', 'どこ', 'speech', other).error).toBe('not-your-turn');
    expect(t.ask('nobody', 'どこ').error).toBe('bad-suspect');
    expect(t.play(t.turnPlayer, { kind: 'ask', suspectId: 'tanaka', utterance: { via: 'speech', text: '   ' } }).error).toBe('empty-answer');
    expect(t.play(t.turnPlayer, { kind: 'accuse', suspectId: 'tanaka' }).error).toBe('wrong-phase');
    expect(t.play(t.turnPlayer, 'hello').error).toBe('bad-move');
  });

  it('turns go by seat, skip the disconnected, and end at once when the asker drops', () => {
    const t = new Table(3);
    t.start();
    expect(t.turnPlayer).toBe('p1');
    t.act({ type: 'connection', playerId: 'p2', connected: false });
    t.timeout();
    expect(t.turnPlayer).toBe('p3');
    // The asker drops: their turn ends at once and passes on (p2 is still away).
    t.act({ type: 'connection', playerId: 'p3', connected: false });
    expect(t.s.phase).toBe('answer');
    expect(t.st.turnNo).toBe(3);
    expect(t.turnPlayer).toBe('p1');
  });

  it('plays players × questions-each turns, at least 6 and at most 14', () => {
    const turnsFor = (players: number, rounds?: number) => {
      const t = new Table(players);
      t.start('snowman', rounds);
      return t.st.totalTurns;
    };
    expect(turnsFor(1)).toBe(TURNS.min);
    expect(turnsFor(4)).toBe(8);
    expect(turnsFor(4, 3)).toBe(12);
    expect(turnsFor(8)).toBe(TURNS.max);
  });
});

describe('Murder at the Onsen: no spoilers', () => {
  it('views carry no unasked answers, no culprit and no confession until the reveal', () => {
    const t = new Table(2);
    t.start('pudding');
    t.ask('ito', 'だれを みましたか');
    const views = [t.view(), t.view('p1'), t.view('p2')].map((v) => JSON.stringify(v));
    const pudding = onsenCases.find((c) => c.id === 'pudding')!;
    for (const json of views) {
      expect(json).not.toContain(pudding.confession[0]!.text);
      expect(json).not.toContain(pudding.solution);
      expect(json).not.toContain('culpritId');
      expect(json).not.toContain(pudding.suspects.find((s) => s.id === 'sato')!.answers.where!.jp.text);
      expect(json).not.toContain('"key":');
    }
    expect(suspectLineRequests(t.st)[0]?.key).toBeTruthy();
    for (const json of views) expect(json).not.toContain(suspectLineRequests(t.st)[0]!.key);
  });
});

describe('Murder at the Onsen: accusation and reveal', () => {
  function accuseGame() {
    const t = new Table(3);
    t.start();
    t.toAccuse();
    return t;
  }

  it('a spoken accusation of the culprit earns 300 and the bonus; wrong names earn nothing', () => {
    const t = accuseGame();
    expect(t.play('p1', { kind: 'accuse', suspectId: 'tanaka', utterance: speech('はんにんは たなかさんです！') }).error).toBeUndefined();
    expect(t.play('p1', { kind: 'accuse', suspectId: 'suzuki' }).error).toBe('already-accused');
    t.play('p2', { kind: 'accuse', suspectId: 'suzuki', utterance: speech('はんにんは すずきさんです') });
    expect(t.view().accused).toEqual(['p1', 'p2']);
    // The stage never sees whom, only who.
    expect(JSON.stringify(t.view())).not.toContain('"suspectId":"suzuki"');
    // p3 taps: the vote counts, no bonus. Everyone is in, so the reveal starts.
    t.play('p3', { kind: 'accuse', suspectId: 'tanaka' });
    expect(t.s.phase).toBe('finale');
    expect(t.score('p1')).toBe(POINTS.accuse + POINTS.spokenAccuse);
    expect(t.score('p2')).toBe(0);
    expect(t.score('p3')).toBe(POINTS.accuse);
    const r = t.view().result!;
    expect(r.culpritId).toBe('tanaka');
    expect(r.votes.map((v) => [v.playerId, v.correct, v.said])).toEqual([
      ['p1', true, true],
      ['p2', false, true],
      ['p3', true, false],
    ]);
    expect(r.confession.length).toBe(3);
    expect(t.s.phrasebook.p1?.find((e) => e.itemId === 'onsen.accuse.snowman.tanaka')).toMatchObject({ outcome: 'said', text: 'はんにんは たなかさんです！' });
    t.timeout();
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap?.awards.find((a) => a.title === 'みぬいた！')?.playerId).toBe('p1');
  });

  it('a garbled accusation gets one more try; out of time, the picked suspect still counts', () => {
    const t = accuseGame();
    t.play('p1', { kind: 'accuse', suspectId: 'tanaka', utterance: speech('えっと') });
    expect(t.view('p1').mine?.accuseTry).toEqual({ suspectId: 'tanaka', heard: 'えっと', triesLeft: 1 });
    expect(t.view().accused).toEqual([]);
    t.play('p1', { kind: 'accuse', suspectId: 'tanaka', utterance: speech('はんにんは たなか') });
    expect(t.view('p1').mine?.accusation).toEqual({ suspectId: 'tanaka', said: true });
    t.play('p2', { kind: 'accuse', suspectId: 'tanaka', utterance: speech('うーん') });
    t.timeout();
    expect(t.s.phase).toBe('finale');
    expect(t.view().result!.votes.find((v) => v.playerId === 'p2')).toMatchObject({ suspectId: 'tanaka', said: false, correct: true });
    expect(t.score('p2')).toBe(POINTS.accuse);
    expect(t.view().result!.votes.some((v) => v.playerId === 'p3')).toBe(false);
  });
});

describe('Murder at the Onsen: the LLM lead-in', () => {
  const lead = { text: 'えっ、わたしですか…', kana: 'えっ、わたしですか…', en: 'Eh, me?' };

  it('takes a clean lead-in with the server key inside the thinking beat, and only then', () => {
    const t = new Table(2);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    const req = suspectLineRequests(t.st)[0]!;
    expect(req).toMatchObject({ playerId: t.st.asks[0]!.playerId, intent: 'where', lockAt: t.now + THINK_MS });
    expect(t.play('p1', { kind: 'suspect-line', key: 'guess', lead }).error).toBe('bad-move');
    expect(t.play('p1', { kind: 'suspect-line', key: req.key, lead: { ...lead, text: 'たなかです' } }).error).toBe('bad-move');
    expect(t.play('p1', { kind: 'suspect-line', key: req.key, lead }).error).toBeUndefined();
    expect(t.view().current?.answer.text).toBe(`えっ、わたしですか… ${snowman.suspects[0]!.answers.where!.jp.text}`);
    // One per answer.
    expect(t.play('p1', { kind: 'suspect-line', key: req.key, lead }).error).toBe('bad-move');
  });

  it('refuses a lead-in that arrives after the beat', () => {
    const t = new Table(2);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    const req = suspectLineRequests(t.st)[0]!;
    t.now += THINK_MS + 1;
    expect(t.play('p1', { kind: 'suspect-line', key: req.key, lead }).error).toBe('too-late');
    expect(t.view().current?.answer.text).toBe(snowman.suspects[0]!.answers.where!.jp.text);
  });

  it('cleanLead keeps facts out: no names, numbers, はんにん, kanji or long lines', () => {
    expect(cleanLead(lead, snowman)).toEqual(lead);
    expect(cleanLead({ ...lead, text: 'はんにん？', kana: 'はんにん？' }, snowman)).toBeNull();
    expect(cleanLead({ ...lead, text: 'すずきさんが…', kana: 'すずきさんが…' }, snowman)).toBeNull();
    expect(cleanLead({ ...lead, text: '10じ…', kana: 'じゅうじ' }, snowman)).toBeNull();
    expect(cleanLead({ ...lead, text: '私ですか', kana: 'わたしですか' }, snowman)).toBeNull();
    expect(cleanLead({ ...lead, en: 'Tanaka did it' }, snowman)).toBeNull();
    expect(cleanLead({ ...lead, text: 'あ'.repeat(30), kana: 'あ'.repeat(30) }, snowman)).toBeNull();
    expect(cleanLead('hi', snowman)).toBeNull();
  });

  it('the suspect voice returns a checked line, or null without an LLM or on a bad answer', async () => {
    const req = { caseTitle: snowman.title, suspect: snowman.suspects[0]!, question: 'どこ', answer: snowman.suspects[0]!.answers.where!.jp };
    expect(await createSuspectVoice().lead(req, 1000)).toBeNull();
    const good = new ScriptedLlm(() => lead);
    expect(await createSuspectVoice({ llm: good }).lead(req, 1000)).toEqual(lead);
    expect(good.calls[0]!.user).toContain('<<<\nどこ\n>>>');
    // Fast enough for the thinking beat, whatever model the host's own lines use.
    expect(good.calls[0]!.model).toBe('claude-haiku-5-5');
    const kanji = new ScriptedLlm(() => ({ text: '私です', kana: 'わたしです', en: 'Me' }));
    expect(await createSuspectVoice({ llm: kanji }).lead(req, 1000)).toBeNull();
    expect(await createSuspectVoice({ llm: good }).lead(req, 100)).toBeNull();
  });
});

describe('Murder at the Onsen: whole games', () => {
  it('runs to the recap on timeouts alone, with the placeholder case when no content is loaded', () => {
    const t = new Table(2, EMPTY_CONTENT);
    expect(t.cmd('stage', { type: 'start', mode: 'onsen-murder' }).changed).toBe(true);
    expect(t.st.fallback).toBe(true);
    for (let i = 0; i < 200 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  for (const c of onsenCases) {
    it(`${c.id}: careful detectives who ask everything aloud find every key clue and solve it, bonus under 30%`, () => {
      const t = new Table(4, CONTENT, ['kana', 'n5', 'n5', 'n4']);
      t.start(c.id, 3);
      // Ask the questions that give clues first, then anything left.
      const plan: [string, OnsenIntent][] = [];
      for (const s of c.suspects) for (const i of INTENTS) if (s.answers[i]?.clueId) plan.push([s.id, i]);
      for (const s of c.suspects) for (const i of INTENTS) if (!s.answers[i]?.clueId) plan.push([s.id, i]);
      for (let guard = 0; guard < 300 && t.s.phase !== 'encore'; guard++) {
        if (t.s.phase === 'answer') {
          const [sid, intent] = plan.shift()!;
          t.ask(sid, questionFor(c, intent).text);
        } else t.timeout();
      }
      expect(t.s.phase).toBe('encore');
      const keys = c.clues.filter((x) => x.key).map((x) => x.id);
      expect(keys.filter((id) => !t.st.found[id])).toEqual([]);
      const culprit = c.suspects.find((s) => s.id === c.culpritId)!;
      for (const p of t.s.players) t.play(p.id, { kind: 'accuse', suspectId: culprit.id, utterance: speech(accusationLine(culprit).kana) });
      expect(t.s.phase).toBe('finale');
      expect(t.view().result?.missed).toEqual([]);
      t.timeout();
      expect(t.s.phase).toBe('recap');
      for (const p of t.s.players) {
        const tally = t.st.tally[p.id]!;
        expect(p.score).toBe(tally.base + tally.bonusPaid);
        expect(tally.bonusPaid).toBeLessThanOrEqual(Math.floor(tally.base * BONUS_CAP));
        expect(tally.bonusPaid / p.score).toBeLessThanOrEqual(0.3);
        expect(tally.correct).toBe(true);
      }
      expect(t.s.recap?.awards.map((a) => a.title)).toEqual(['めいたんてい', 'こえの たんてい', 'みぬいた！']);
    });
  }
});

// ---- full system: bots play a whole game through the real server ----

describe('Murder at the Onsen: bots play a game end to end', () => {
  let ctx: { server: KotobaServer; baseUrl: string; truth: TruthRecorder };
  const llm = new ScriptedLlm(() => ({ text: 'うーん…', kana: 'うーん…', en: 'Hmm…' }));
  beforeAll(async () => {
    // The real server, the TruthRecorder, and the LLM lead-in director with a scripted LLM.
    const lead = suspectDirector(createSuspectVoice({ llm }));
    const truth = new TruthRecorder();
    const server = createKotobaServer({
      content,
      pingIntervalMs: 0,
      roomIdleMs: 0,
      durations: { intro: 20, answer: 700, reveal: 60, encore: 1_500, finale: 30 },
      onCommit: (room: Room, v: number) => {
        truth.onCommit(room, v);
        lead(room);
      },
    });
    ctx = { server, baseUrl: await server.listen(0, '127.0.0.1'), truth };
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [3, 5]) {
    it(`${players} bots question the suspects and accuse, with every client in sync`, async () => {
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
      let lastGame: OnsenView | null = null;
      let recap: RoomView['recap'] = null;
      const phases = new Set<string>();
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 2,
        totalRounds: 1_000,
        mode: 'onsen-murder',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          if (view.game?.mode === 'onsen-murder') lastGame = view.game;
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = onsenMurderPolicy({ delayMs: [5, 40], quiet: (id) => id.endsWith('2'), tiles: (id) => id.endsWith('3') });
      const bots: Bot[] = [];
      for (let i = 1; i <= players; i++) {
        bots.push(
          await Bot.join({
            baseUrl,
            code: created.code,
            name: `bot${i}`,
            policy,
            level: i === 1 ? 'kana' : 'n5',
            onState: (bot, view, v) => record(bot.playerId, view, v),
          }),
        );
      }
      await until(() => finished, 60_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['intro', 'answer', 'reveal', 'encore', 'finale', 'recap']) expect(phases, p).toContain(p);
      const game = lastGame as OnsenView | null;
      expect(game?.result).toBeTruthy();
      expect(game!.log.length).toBeGreaterThanOrEqual(Math.max(TURNS.min, Math.min(TURNS.max, players * 2)) - 1);
      expect(game!.result!.votes.length).toBe(players);

      // Every accepted state matches what the server committed for that viewer.
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      // Scores add up: base + paid bonus, bonus inside the 30% cap.
      const st = room.state.modeState as OnsenState;
      for (const s of (recap as RoomView['recap'])!.standings) {
        const t = st.tally[s.playerId]!;
        expect(s.score, s.name).toBe(t.base + t.bonusPaid);
        expect(t.bonusPaid).toBeLessThanOrEqual(Math.floor(t.base * BONUS_CAP));
      }
      // The scripted LLM's lead-ins landed inside the thinking beat at least once.
      expect(llm.calls.length).toBeGreaterThan(0);
      expect(st.asks.some((a) => a.lead?.text === 'うーん…')).toBe(true);

      // No move failed except harmless races with the phase clock.
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(players);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});

// ---- the deputy (N4 hard role) ----

const FRAME_IDS = new Set(['to-itte-imashita', 'passive', 'tame-ni', 'sou-look', 'node']);

describe('Murder at the Onsen: the deputy’s reports', () => {
  // Every case, the Kids and Cheeky ones too (Ladi, 2026-11-01).
  for (const c of onsenCases) {
    it(`${c.id}: every answer has a report the tiles and the checker agree on`, () => {
      const names = c.suspects.map((s) => calledName(s).kana);
      for (const s of c.suspects) {
        for (const intent of INTENTS) {
          const r = s.answers[intent]!.report;
          const at = `${c.id}/${s.id}/${intent}`;
          expect(r, at).toBeTruthy();
          expect(r!.jp.text && r!.jp.kana && r!.jp.en, at).toBeTruthy();
          expect(hasKanji(r!.jp.kana) || /\d/.test(r!.jp.kana), `${at} kana`).toBe(false);
          // Text and reading split into the same words, the tiles.
          expect(r!.jp.text.split(' ').length, at).toBe(r!.jp.kana.split(' ').length);
          expect(r!.frames?.every((f) => FRAME_IDS.has(f)), at).toBe(true);
          const words = reportWords(r!);
          if (r!.frames!.includes('passive')) {
            // ＿は ＿に みられました: about a suspect, seen by this one.
            expect(words.at(-1)!.kana, at).toBe('みられました');
            expect(words.at(-2)!.kana, at).toBe(`${calledName(s).kana}に`);
            expect(names.some((n) => words[0]!.kana === `${n}は`), at).toBe(true);
          } else {
            expect(r!.frames![0], at).toBe('to-itte-imashita');
            expect(words[0]!.kana, at).toBe(`${calledName(s).kana}は`);
            expect(words.at(-1)!.kana, at).toBe('いっていました');
            expect(words.at(-2)!.kana.endsWith('と'), at).toBe(true);
          }
          // The line itself passes, typed or spoken, and so do its tiles in order.
          expect(checkReport({ via: 'typed', text: r!.jp.text, reading: r!.jp.kana }, r!), at).toBe(true);
          expect(checkReport({ via: 'speech', text: r!.jp.kana.replace(/ /g, '') }, r!), at).toBe(true);
          expect(tilesInOrder(r!, words), at).toBe(true);
          // The suspect's own polite answer is not a report.
          expect(checkReport({ via: 'typed', text: s.answers[intent]!.jp.kana }, r!), at).toBe(false);
        }
      }
    });
  }

  it('is lenient about a dropped word, but needs the facts and the frame', () => {
    const r = snowman.suspects.find((s) => s.id === 'tanaka')!.answers.where!.report!;
    expect(checkReport(speech('田中さんは10時から11時まで台所にいたと言っていました', 'たなかさんはじゅうじからじゅういちじまでだいどころにいたといっていました'), r)).toBe(true);
    expect(checkReport(speech('田中さんは10時から台所にいたと言っていました', 'たなかさんはじゅうじからだいどころにいたといっていました'), r)).toBe(true);
    // Dropping both times drops the fact.
    expect(checkReport(speech('たなかさんは だいどころに いたと いっていました'), r)).toBe(false);
    expect(checkReport(speech('たなかさんは じゅうじから じゅういちじまで だいどころに いました'), r)).toBe(false);
    expect(checkReport(speech('ゆきだるまさんは じゅうじから じゅういちじまで だいどころに いたと いいました'), r)).toBe(false);
    // A direct quote, still polite inside, is correct Japanese too.
    expect(checkReport(speech('たなかさんは じゅうじから じゅういちじまで だいどころに いましたと いっていました'), r)).toBe(true);
    expect(reportFrame(r)).toBe('＿は ＿と いっていました');
    expect(joinReport(reportWords(r))).toBe(r.jp.text);
  });

  it('a passive report needs に on the one who saw: を or が turns the sentence around', () => {
    const r = { jp: { text: 'たなかさんは すずきさんに みられました。', kana: 'たなかさんは すずきさんに みられました。', en: 'Tanaka was seen by Suzuki.' }, frames: ['passive'] };
    expect(checkReport(speech('たなかさんは すずきさんに みられました'), r)).toBe(true);
    expect(checkReport(speech('たなかさんは すずきさんを みられました'), r)).toBe(false);
    expect(checkReport(speech('たなかさんは すずきさんが みられました'), r)).toBe(false);
    expect(checkReport(speech('田中さんは鈴木さんを見られました', 'たなかさんはすずきさんをみられました'), r)).toBe(false);
    // The case's own passive reports, the same way.
    const real = snowman.suspects.find((s) => s.id === 'yamada')!.answers.who!.report!;
    expect(checkReport(speech('すずきさんは おんせんで やまださんに みられました'), real)).toBe(true);
    expect(checkReport(speech('すずきさんは おんせんで やまださんを みられました'), real)).toBe(false);
  });

  it('the panel’s rewrites keep their facts (draft Japanese)', () => {
    const suzuki = snowman.suspects.find((s) => s.id === 'suzuki')!;
    expect(suzuki.answers.who!.report!.jp.text).toBe('すずきさんは 10じ50ぷんに たなかさんが おおきい なべを もって いたと いっていました。');
    expect(suzuki.answers.what!.report!.jp.kana).toBe('すずきさんは ゆきだるまさんが じゅうじよんじゅうごふんまで げんきだったと いっていました。');
  });
});

describe('Murder at the Onsen: the deputy in play', () => {
  /** Tile ids in the report's order. */
  const inOrder = (t: Table, deputy: string) => {
    const me = t.view(deputy).mine!.deputy!;
    const words = reportWords(t.st.asks.at(-1)!.report!);
    const left = [...me.tiles];
    return words.map((w) => {
      const i = left.findIndex((x) => x.text === w.text);
      return left.splice(i, 1)[0]!.id;
    });
  };

  it('with nobody at N4 there is no deputy and nothing changes', () => {
    const t = new Table(3);
    t.start();
    expect(t.st.deputy).toBeNull();
    t.ask('tanaka', 'どこに いましたか');
    expect(t.s.phase).toBe('reveal');
    expect(t.view().deputy).toBeNull();
    expect(t.s.deadline! - t.now).toBe(12_000);
    t.timeout();
    expect(t.st.deputyLog).toEqual([]);
  });

  it('offers the N4 player the deputy’s part; tiles in order report the answer and pay', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    expect(t.turnPlayer).toBe('p1');
    expect(t.st.deputy?.playerId).toBe('p2');
    expect(t.view('p2').mine!.deputy).toMatchObject({ status: 'offered', canReport: false });
    expect(t.view('p1').mine!.deputy).toBeNull();
    expect(t.play('p1', { kind: 'deputy', accept: true }).error).toBe('not-deputy');
    expect(t.play('p2', { kind: 'deputy', accept: true }).error).toBeUndefined();
    t.ask('tanaka', 'どこに いましたか');
    // The answer runs 15 s longer for the deputy.
    expect(t.s.deadline! - t.now).toBe(12_000 + 15_000);
    const me = t.view('p2').mine!.deputy!;
    expect(me.canReport).toBe(true);
    expect(me.frame).toBe('＿は ＿と いっていました');
    expect(me.line).toBeNull();
    expect(t.view().deputy).toMatchObject({ playerId: 'p2', reporting: true, line: null });
    const before = t.score('p2');
    expect(t.play('p2', { kind: 'report', tiles: inOrder(t, 'p2') }).error).toBeUndefined();
    expect(t.score('p2') - before).toBe(POINTS.reportTiles);
    expect(t.view().deputy?.line?.text).toBe('たなかさんは 10じから 11じまで だいどころに いたと いっていました。');
    expect(t.s.phrasebook.p2?.some((e) => e.itemId === 'onsen.report.snowman.tanaka.where' && e.outcome === 'seen')).toBe(true);
    // Done, but the answer still gets its usual 12 s: the room wakes the phase then.
    expect(t.s.phase).toBe('reveal');
    const wake = onsenMurderMode.wakeAt!(t.st, 'reveal', { now: t.now } as never);
    expect(wake).toBe(t.st.revealAt + 12_000);
    t.now = wake!;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.s.phase).toBe('answer');
    expect(t.st.deputyLog).toEqual([{ turnNo: 1, playerId: 'p2', outcome: 'accepted' }]);
    // The N4 player's own turn: nobody else is N4, so no deputy.
    expect(t.turnPlayer).toBe('p2');
    expect(t.st.deputy).toBeNull();
    expect(deputyOffers(t.st)).toEqual({ p2: { offered: 1, accepted: 1, declined: 0, timeout: 0, rate: 1 } });
  });

  it('a spoken report pays more, with the speaking bonus in the pool; the passive for a sighting', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.ask('yamada', 'だれを みましたか');
    expect(t.view('p2').mine!.deputy!.frame).toBe('＿は ＿に ＿られました');
    expect(t.play('p2', { kind: 'report', utterance: speech('鈴木さんは温泉で山田さんに見られました', 'すずきさんはおんせんでやまださんにみられました') }).error).toBeUndefined();
    expect(t.st.deputy?.status).toBe('reported');
    expect(t.st.tally.p2).toMatchObject({ base: POINTS.report, bonusEarned: POINTS.spokenReport, reports: 1 });
    expect(POINTS).toMatchObject({ report: 30, reportTiles: 10, spokenReport: 40 });
    expect(t.s.phrasebook.p2?.some((e) => e.itemId === 'onsen.report.snowman.yamada.who' && e.outcome === 'said')).toBe(true);
  });

  it('an untouched offer adds no time, but can still report; one never answered times out', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    expect(t.s.deadline! - t.now).toBe(12_000);
    expect(t.view('p2').mine!.deputy).toMatchObject({ status: 'offered', canReport: true });
    // Nothing tried: the answer ends at its usual time.
    expect(onsenMurderMode.wakeAt!(t.st, 'reveal', { now: t.now } as never)).toBe(t.st.revealAt + 12_000);
    t.timeout();
    expect(t.st.deputyLog).toEqual([{ turnNo: 1, playerId: 'p2', outcome: 'timeout' }]);
    expect(deputyOffers(t.st).p2).toMatchObject({ timeout: 1, rate: 0 });
  });

  it('a first try counts as taking the part, and the answer waits for the second', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    t.play('p2', { kind: 'report', utterance: speech('たなかさんは だいどころに いました') });
    // A try in: the phase no longer ends on its own at the usual time.
    expect(onsenMurderMode.wakeAt!(t.st, 'reveal', { now: t.now } as never)).toBeNull();
    t.timeout();
    expect(t.st.deputyLog).toEqual([{ turnNo: 1, playerId: 'p2', outcome: 'accepted' }]);
  });

  it('in a room of four or more, a lone N4 deputy rests the turn after one in the part (for Ladi to confirm)', () => {
    const t = new Table(4, CONTENT, ['n5', 'n5', 'n4', 'n5']);
    t.start();
    expect(t.turnPlayer).toBe('p1');
    expect(t.st.deputy?.playerId).toBe('p3');
    t.play('p3', { kind: 'deputy', accept: true });
    t.ask('tanaka', 'どこに いましたか');
    t.play('p3', { kind: 'report', tiles: inOrder(t, 'p3') });
    t.now = t.st.revealAt + 12_000;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.st.deputyLog.at(-1)).toMatchObject({ turnNo: 1, playerId: 'p3', outcome: 'accepted' });
    // Turn 2: p3 is the only N4 player who could be deputy, and just was: they sit it out.
    expect(t.s.phase).toBe('answer');
    expect(t.turnPlayer).toBe('p2');
    expect(t.st.deputy).toBeNull();
    t.timeout(); // nobody asked
    // Turn 3 is p3's own; turn 4 they're offered again.
    expect(t.turnPlayer).toBe('p3');
    t.timeout();
    expect(t.turnPlayer).toBe('p4');
    expect(t.st.deputy?.playerId).toBe('p3');
  });

  it('in a smaller room the lone N4 deputy is offered every turn they don’t ask', () => {
    const t = new Table(3, CONTENT, ['n5', 'n5', 'n4']);
    t.start();
    t.play('p3', { kind: 'deputy', accept: true });
    t.ask('tanaka', 'どこに いましたか');
    t.play('p3', { kind: 'report', tiles: inOrder(t, 'p3') });
    t.now = t.st.revealAt + 12_000;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.turnPlayer).toBe('p2');
    expect(t.st.deputy?.playerId).toBe('p3');
  });

  it('“not this time” keeps the ordinary part, and is logged as a decline', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    expect(t.play('p2', { kind: 'deputy', accept: false }).error).toBeUndefined();
    t.ask('tanaka', 'どこに いましたか');
    expect(t.s.deadline! - t.now).toBe(12_000);
    expect(t.view('p2').mine!.deputy).toMatchObject({ status: 'declined', canReport: false, tiles: [] });
    expect(t.play('p2', { kind: 'report', tiles: ['w0'] }).error).toBe('wrong-phase');
    t.timeout();
    expect(t.st.deputyLog).toEqual([{ turnNo: 1, playerId: 'p2', outcome: 'declined' }]);
  });

  it('two misses end the report; it goes to review, with the line shown', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    t.play('p2', { kind: 'report', utterance: speech('たなかさんは だいどころに いました') });
    expect(t.view('p2').mine!.deputy).toMatchObject({ status: 'offered', triesLeft: 1, canReport: true });
    expect(t.view('p2').mine!.deputy!.line?.kana).toContain('いたと いっていました');
    const wrong = [...inOrder(t, 'p2')].reverse();
    t.play('p2', { kind: 'report', tiles: wrong });
    expect(t.st.deputy?.status).toBe('missed');
    expect(t.score('p2')).toBe(0);
    expect(t.s.phrasebook.p2?.some((e) => e.itemId === 'onsen.report.snowman.tanaka.where' && e.outcome === 'missed')).toBe(true);
    t.timeout();
    expect(t.st.deputyLog[0]?.outcome).toBe('accepted');
  });

  it('the Kids and Cheeky cases have reports too: the deputy gets tiles and can report (Ladi, 2026-11-01)', () => {
    for (const [caseId, suspectId, question] of [
      ['ice-cream', 'hana', 'だれを みましたか'],
      ['sake', 'kobayashi', 'だれを みましたか'],
      ['candle', 'kudo', 'なにを しましたか'],
    ] as const) {
      const t = new Table(2, CONTENT, ['n5', 'n4']);
      t.start(caseId);
      t.ask(suspectId, question);
      expect(t.st.deputy?.playerId, caseId).toBe('p2');
      expect(t.view('p2').mine!.deputy!.tiles.length, caseId).toBeGreaterThan(3);
      expect(t.play('p2', { kind: 'report', tiles: inOrder(t, 'p2') }).error, caseId).toBeUndefined();
      expect(t.st.deputy?.status, caseId).toBe('reported');
      expect(t.s.phrasebook.p2?.some((e) => e.itemId === `onsen.report.${caseId}.${suspectId}.${question === 'だれを みましたか' ? 'who' : 'what'}`), caseId).toBe(true);
    }
  });

  it('rotates among the N4 players, never the asker; an answer with nothing to report voids the offer', () => {
    const t = new Table(3, { ...EMPTY_CONTENT }, ['n4', 'n4', 'n4']);
    t.start('fallback');
    // The placeholder case has no reports.
    expect(t.turnPlayer).toBe('p1');
    expect(t.st.deputy?.playerId).toBe('p2');
    t.ask('a', 'どこに いましたか');
    expect(t.st.deputy).toBeNull();
    t.timeout();
    expect(t.turnPlayer).toBe('p2');
    expect(t.st.deputy?.playerId).toBe('p3');
    t.timeout(); // nobody asked
    expect(t.turnPlayer).toBe('p3');
    expect(t.st.deputy?.playerId).toBe('p1');
    expect(t.st.deputyLog).toEqual([]);
  });
});

describe('Murder at the Onsen: Chōchin-san says the deputy’s report (host says the line)', () => {
  const reportCues = (t: Table) => t.s.cues.filter((c) => c.event === 'onsen_report');
  const inOrder = (t: Table, deputy: string) => {
    const me = t.view(deputy).mine!.deputy!;
    const left = [...me.tiles];
    return reportWords(t.st.asks.at(-1)!.report!).map((w) => left.splice(left.findIndex((x) => x.text === w.text), 1)[0]!.id);
  };

  it('voices an accepted report once, as the model line, after the suspect’s answer; the answer stays up for it', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.play('p2', { kind: 'deputy', accept: true });
    t.ask('tanaka', 'どこに いましたか');
    expect(reportCues(t)).toEqual([]);
    // A spoken report, in the deputy's own words (kanji, a dropped word): the TV gets the model line.
    t.now += 2_000;
    t.play('p2', { kind: 'report', utterance: speech('田中さんは10時から台所にいたと言っていました', 'たなかさんはじゅうじからだいどころにいたといっていました') });
    expect(t.st.deputy?.status).toBe('reported');
    const r = snowman.suspects.find((s) => s.id === 'tanaka')!.answers.where!.report!;
    expect(reportCues(t)).toEqual([
      { host: 'chochin', event: 'onsen_report', slots: { line: r.jp.text, line_kana: r.jp.kana, line_en: r.jp.en }, atMs: REPORT_VOICE.after - 2_000 },
    ]);
    // The bank line is the report itself, text, reading and subtitle.
    return bankVoice(content)
      .speak('BCDF', reportCues(t)[0]!)
      .then((line) => {
        expect(line).toMatchObject({ host: 'chochin', text: r.jp.text, kana: r.jp.kana, en: r.jp.en });
        // Said 5.8 s in, done by 10.8 s: inside the answer's usual 12 s, so the turn ends as before.
        expect(onsenMurderMode.wakeAt!(t.st, 'reveal', { now: t.now } as never)).toBe(t.st.revealAt + 12_000);
        t.now = t.st.revealAt + 12_000;
        t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
        expect(t.s.phase).toBe('answer');
        expect(reportCues(t).length).toBe(1);
      });
  });

  it('the voiced pipeline fills the same line, reading and subtitle from the bank', async () => {
    const r = snowman.suspects.find((s) => s.id === 'yamada')!.answers.who!.report!;
    const line = await createHostVoice({ lines: content.hostLines.filter((l) => l.event === 'onsen_report') as BankLine[] })
      .prepare('BCDF', { host: 'chochin', event: 'onsen_report', slots: { line: r.jp.text, line_kana: r.jp.kana, line_en: r.jp.en } })
      .ready(0);
    expect(line).toMatchObject({ id: 'chochin.onsen_report.01', source: 'bank', text: r.jp.text, kana: r.jp.kana, en: r.jp.en });
  });

  it('a late report is said straight away, and the answer stays up until it has been said', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.play('p2', { kind: 'deputy', accept: true });
    t.ask('yamada', 'だれを みましたか');
    t.now = t.st.revealAt + 11_000;
    t.play('p2', { kind: 'report', tiles: inOrder(t, 'p2') });
    const cues = reportCues(t);
    expect(cues.length).toBe(1);
    expect(cues[0]!.atMs).toBeUndefined();
    expect(cues[0]!.slots?.line).toBe('すずきさんは おんせんで やまださんに みられました。');
    const until = t.now + REPORT_VOICE.beat;
    expect(onsenMurderMode.wakeAt!(t.st, 'reveal', { now: t.now } as never)).toBe(until);
    t.now = t.st.revealAt + 12_000;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.s.phase).toBe('reveal');
    t.now = until;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.s.phase).toBe('answer');
  });

  it('says nothing for a miss, a wrong first try, a decline, or a room with no N4 player', () => {
    const miss = new Table(2, CONTENT, ['n5', 'n4']);
    miss.start();
    miss.ask('tanaka', 'どこに いましたか');
    miss.play('p2', { kind: 'report', utterance: speech('たなかさんは だいどころに いました') });
    expect(reportCues(miss)).toEqual([]);
    miss.play('p2', { kind: 'report', tiles: [...inOrder(miss, 'p2')].reverse() });
    expect(miss.st.deputy?.status).toBe('missed');
    expect(reportCues(miss)).toEqual([]);

    const declined = new Table(2, CONTENT, ['n5', 'n4']);
    declined.start();
    declined.play('p2', { kind: 'deputy', accept: false });
    declined.ask('tanaka', 'どこに いましたか');
    declined.timeout();
    expect(reportCues(declined)).toEqual([]);

    const none = new Table(3);
    none.start();
    none.ask('tanaka', 'どこに いましたか');
    none.timeout();
    expect(reportCues(none)).toEqual([]);
  });

  it('a retry that lands is voiced once', () => {
    const t = new Table(2, CONTENT, ['n5', 'n4']);
    t.start();
    t.ask('tanaka', 'どこに いましたか');
    t.play('p2', { kind: 'report', utterance: speech('たなかさんは だいどころに いました') });
    const ids = inOrder(t, 'p2');
    t.play('p2', { kind: 'report', tiles: ids });
    expect(t.play('p2', { kind: 'report', tiles: ids }).error).toBe('wrong-phase');
    expect(reportCues(t).length).toBe(1);
  });
});
