import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { heardScore, phraseKey, saidPhrase, substringDistance, tolerance } from '../shared/src/modes/phraseBingo/check.js';
import {
  BINGO_POINTS,
  BUZZES,
  CARD_CELLS,
  castSize,
  CATCH_POINTS,
  ECHO_BONUS,
  GRACE_MS,
  MEMORY_BONUS,
  secretsFor,
  SLIP_POINTS,
  SMOOTH_POINTS,
  type PhraseBingoState,
  type PhraseBingoView,
} from '../shared/src/modes/phraseBingo/phraseBingo.js';
import { SCENES } from '../shared/src/modes/phraseBingo/scenes.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { phraseBingoPolicy } from '../tools/bots/policies/phraseBingo.js';
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
  get st(): PhraseBingoState {
    return this.s.modeState as PhraseBingoState;
  }
  view(viewer: string | 'stage' = 'stage'): PhraseBingoView {
    const v = viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
    return v.game as PhraseBingoView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(rounds?: number, packId = 'food') {
    expect(this.cmd('stage', { type: 'start', mode: 'phrase-bingo', packId, ...(rounds ? { rounds } : {}) }).changed).toBe(true);
    this.timeout(); // intro → scene card
    expect(this.s.phase).toBe('prompt');
  }
  /** Scene card → action. */
  action() {
    for (const a of this.st.cast) this.play(a.playerId, { kind: 'ready' });
    expect(this.s.phase).toBe('answer');
  }
  get actors(): string[] {
    return this.st.cast.map((a) => a.playerId);
  }
  get audience(): string[] {
    return Object.keys(this.st.cards);
  }
  secretsOf(id: string) {
    return this.st.cast.find((a) => a.playerId === id)!.secrets.map((x) => this.st.pool[x.phraseId]!);
  }
}

const speech = (text: string) => ({ via: 'speech' as const, text });
const typed = (text: string) => ({ via: 'typed' as const, text });

// ---- the checker ----

describe('Phrase Bingo: the lenient phrase check', () => {
  it('finds the phrase inside a longer transcript, with particles said as they sound', () => {
    expect(saidPhrase(speech('えっと、おいしい！ですね'), 'おいしい！', undefined, 'n5')).toBe(true);
    expect(saidPhrase(speech('チェックインをおねがいします'), 'チェックインを おねがいします。', undefined, 'n5')).toBe(true);
    expect(saidPhrase(speech('すみません えきわ どこですか'), 'すみません、えきは どこですか。', undefined, 'n5')).toBe(true);
    expect(saidPhrase(speech('コンバンワ'), 'こんばんは。', undefined, 'kana')).toBe(true);
  });

  it('uses the server-made reading for kanji transcripts', () => {
    expect(saidPhrase({ via: 'speech', text: '終電は何時ですか', reading: 'しゅうでんはなんじですか' }, 'しゅうでんは なんじですか。', undefined, 'n5')).toBe(true);
  });

  it('forgives about one kana in five, but not short phrases or other lines', () => {
    expect(tolerance(3, 'n5')).toBe(0);
    expect(tolerance(6, 'n5')).toBe(1);
    expect(tolerance(12, 'n5')).toBe(2);
    expect(tolerance(12, 'kana')).toBe(3);
    expect(substringDistance('abc', 'xxabcxx')).toBe(0);
    expect(substringDistance('abcd', 'xxabxdxx')).toBe(1);
    // A recogniser slip (しゅでん for しゅうでん) still counts.
    expect(saidPhrase(speech('しゅでんはなんじですか'), 'しゅうでんは なんじですか。', undefined, 'n5')).toBe(true);
    expect(saidPhrase(speech('みず'), 'みぎ！', undefined, 'kana')).toBe(false);
    expect(saidPhrase(speech('きっぷをください'), 'しゃしんを とっても いいですか。', undefined, 'n5')).toBe(false);
    expect(heardScore('', ['あ'], 'n5')).toBeNull();
    expect(saidPhrase(speech('ごちそうさま'), 'ごちそうさまでした。', ['ごちそうさま'], 'kana')).toBe(true);
  });

  it('every scene phrase is self-consistent: kana-only reading that matches itself, unique ids', () => {
    const ids = new Set<string>();
    for (const sc of SCENES) {
      expect(sc.status).toBe('draft');
      expect(sc.roles.length).toBeGreaterThanOrEqual(4);
      for (const level of ['kana', 'n5', 'n4'] as const) expect(sc.phrases.filter((p) => p.level === level).length, `${sc.id} ${level}`).toBeGreaterThanOrEqual(3);
      for (const p of sc.phrases) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
        expect(phraseKey(p.jp.kana), p.id).toMatch(/^[ぁ-ゖ]+$/);
        expect(saidPhrase(speech(p.jp.kana), p.jp.kana, p.accepted, p.level)).toBe(true);
      }
    }
  });

  it('pack-copied phrases match their topic-pack source', () => {
    const packPhrases = new Map(REAL_CONTENT.packs.flatMap((p) => p.phrases).map((p) => [p.id, p]));
    for (const p of SCENES.flatMap((s) => s.phrases)) {
      if (!p.from) continue;
      const src = packPhrases.get(p.from);
      expect(src, p.from).toBeDefined();
      expect(phraseKey(src!.jp.kana)).toBe(phraseKey(p.jp.kana));
    }
  });
});

// ---- the rules ----

describe('Phrase Bingo: casting and dealing', () => {
  it('sizes the cast so someone is always watching', () => {
    expect([3, 4, 5, 6, 7, 8].map(castSize)).toEqual([2, 2, 3, 3, 3, 4]);
    expect(castSize(2)).toBe(1);
    expect(secretsFor('n5', 2)).toBe(3);
    expect(secretsFor('kana', 2)).toBe(2);
    expect(secretsFor('n5', 3)).toBe(2);
    expect(secretsFor('n4', 4)).toBe(2);
  });

  it('leaves decoys on the card in a three-actor N5 scene', () => {
    const t = new Table(5, REAL_CONTENT, 3, ['n5', 'n5', 'n5', 'n5', 'n5']);
    t.start();
    const secrets = t.st.cast.flatMap((a) => a.secrets.map((x) => x.phraseId));
    expect(secrets.length).toBe(6);
    for (const id of t.audience) expect(t.st.cards[id]!.cells.filter((c) => !secrets.includes(c)).length).toBe(3);
  });

  it('deals level-matched secrets with no clashes, and a 9-cell card holding every secret', () => {
    const t = new Table(5, REAL_CONTENT, 3, ['kana', 'n5', 'n4', 'n5', 'kana']);
    t.start();
    expect(t.actors.length).toBe(3);
    expect(t.audience.length).toBe(2);
    const secrets = t.st.cast.flatMap((a) => a.secrets.map((x) => x.phraseId));
    expect(new Set(secrets).size).toBe(secrets.length);
    for (const a of t.st.cast) {
      const level = t.s.players.find((p) => p.id === a.playerId)!.level;
      expect(a.secrets.length).toBe(secretsFor(level, 3));
      for (const p of t.secretsOf(a.playerId)) {
        if (level === 'kana') expect(p.level).toBe('kana');
        if (level === 'n4') expect(p.level).toBe('n4');
      }
    }
    const keys = Object.values(t.st.pool).map((p) => phraseKey(p.jp.kana));
    for (const k of keys) expect(keys.filter((x) => x.includes(k)).length, k).toBe(1);
    for (const id of t.audience) {
      const card = t.st.cards[id]!;
      expect(card.cells.length).toBe(CARD_CELLS);
      for (const s of secrets) expect(card.cells).toContain(s);
    }
    // Pack-copied phrases take the pack's own text.
    const fromPack = Object.values(t.st.pool).find((p) => p.jp.furigana);
    if (fromPack) expect(fromPack.jp.furigana?.length).toBeGreaterThan(0);
  });

  it('nothing leaks: the stage never carries a secret, actors see only their own lines', () => {
    const t = new Table(4);
    t.start();
    const [a, b] = t.actors as [string, string];
    const aLines = t.secretsOf(a);
    const bLines = t.secretsOf(b);
    const stage = JSON.stringify(t.view('stage'));
    for (const p of [...aLines, ...bLines]) expect(stage).not.toContain(p.jp.en);
    // Studying: the actor sees their lines in full; not the other actor's, and no card.
    const va = t.view(a).me!;
    expect(va.part).toBe('actor');
    expect(va.card).toBeNull();
    expect(va.actor!.secrets.map((x) => x.jp?.kana)).toEqual(aLines.map((p) => p.jp.kana));
    expect(JSON.stringify(t.view(a))).not.toContain(bLines[0]!.jp.en);
    // The audience has a card but doesn't know who holds what.
    const aud = t.view(t.audience[0]!).me!;
    expect(aud.part).toBe('audience');
    expect(aud.card!.cells.length).toBe(9);
    expect(JSON.stringify(aud)).not.toContain(a);
    // In the scene the Japanese hides until peeked or said.
    t.action();
    const hidden = t.view(a).me!.actor!.secrets;
    expect(hidden.every((x) => x.jp === null && x.en && x.hint)).toBe(true);
    expect(JSON.stringify(t.view('stage'))).not.toContain(aLines[0]!.jp.kana);
    expect(t.play(a, { kind: 'peek', phraseId: aLines[0]!.id }).error).toBeUndefined();
    expect(t.view(a).me!.actor!.secrets[0]!.jp?.kana).toBe(aLines[0]!.jp.kana);
  });

  it('the scene card ends early once every actor is ready', () => {
    const t = new Table(3);
    t.start();
    const [a, b] = t.actors as [string, string];
    expect(t.play(t.audience[0]!, { kind: 'ready' }).error).toBe('not-eligible');
    t.play(a, { kind: 'ready' });
    expect(t.s.phase).toBe('prompt');
    expect(t.view('stage').cast.find((x) => x.playerId === a)?.ready).toBe(true);
    t.play(b, { kind: 'ready' });
    expect(t.s.phase).toBe('answer');
  });

  it('rotates the cast so everyone acts, and the last scene is worth double', () => {
    const t = new Table(4);
    t.start(4);
    const acted: Record<string, number> = {};
    for (let scene = 1; scene <= 4; scene++) {
      expect(t.s.phase).toBe('prompt');
      for (const id of t.actors) acted[id] = (acted[id] ?? 0) + 1;
      expect(t.view().multiplier).toBe(scene === 4 ? 2 : 1);
      for (let i = 0; i < 5; i++) t.timeout();
    }
    expect(t.s.phase).toBe('recap');
    expect(Object.values(acted)).toEqual([2, 2, 2, 2]);
  });
});

describe('Phrase Bingo: the scene', () => {
  it('a line said from memory and never caught scores slip + smooth + memory bonus', () => {
    const t = new Table(3);
    t.start();
    t.action();
    const [a] = t.actors as [string];
    const line = t.secretsOf(a)[0]!;
    expect(t.play(a, { kind: 'say', utterance: speech(`えっと、${line.jp.kana}`) }).error).toBeUndefined();
    expect(t.view(a).me!.actor!.last).toMatchObject({ matched: line.id });
    // The stage knows someone slipped one in, not which.
    const stage = t.view('stage');
    expect(stage.ticker).toEqual([{ kind: 'slip', playerId: a, atSec: 0 }]);
    expect(stage.cast.find((x) => x.playerId === a)?.said).toBe(1);
    // Saying it again, or saying nonsense, changes nothing.
    t.play(a, { kind: 'say', utterance: speech(line.jp.kana) });
    t.play(a, { kind: 'say', utterance: speech('ぜんぜん ちがう') });
    expect(t.view(a).me!.actor!.last).toEqual({ heard: 'ぜんぜん ちがう', matched: null });
    expect(t.st.slips.length).toBe(1);
    t.timeout(); // scene ends
    expect(t.s.phase).toBe('reveal');
    expect(t.score(a)).toBe(SLIP_POINTS + SMOOTH_POINTS + MEMORY_BONUS.speech);
    expect(t.s.phrasebook[a]?.find((e) => e.itemId === line.id)?.outcome).toBe('said');
    // Unsaid lines go in the phrasebook as missed.
    expect(t.s.phrasebook[a]?.filter((e) => e.outcome === 'missed').length).toBe(2);
    const revealed = t.view('stage').cast.find((x) => x.playerId === a)!.phrases!;
    expect(revealed.find((p) => p.id === line.id)).toMatchObject({ said: true, smooth: true, memory: true });
    expect(t.view('stage').ticker[0]?.phrase?.text).toBe(line.jp.text);
  });

  it('a caught line pays the catcher; peeking or typing trims the bonus; wrong buzzes cost nothing', () => {
    const t = new Table(4);
    t.start();
    t.action();
    const [a, b] = t.actors as [string, string];
    const [x, y] = t.audience as [string, string];
    const [l1, l2] = t.secretsOf(a) as [ReturnType<Table['secretsOf']>[number], ReturnType<Table['secretsOf']>[number]];
    const bLine = t.secretsOf(b)[0]!;
    // Actors can't buzz, the audience can't say lines.
    expect(t.play(a, { kind: 'buzz', phraseId: l1.id, actorId: b }).error).toBe('not-eligible');
    expect(t.play(x, { kind: 'say', utterance: speech(l1.jp.kana) }).error).toBe('not-eligible');

    t.play(a, { kind: 'peek', phraseId: l1.id });
    t.play(a, { kind: 'say', utterance: speech(l1.jp.kana) });
    t.now += 2_000;
    expect(t.play(x, { kind: 'buzz', phraseId: l1.id, actorId: a }).error).toBeUndefined(); // caught
    expect(t.play(x, { kind: 'buzz', phraseId: l1.id, actorId: b }).error).toBe('already-guessed');
    expect(t.play(y, { kind: 'buzz', phraseId: bLine.id, actorId: a }).error).toBeUndefined(); // wrong actor
    // Buzzing a line before it is said is a guess, and misses unless it comes within the grace.
    expect(t.play(y, { kind: 'buzz', phraseId: l2.id, actorId: a }).error).toBeUndefined();
    t.now += GRACE_MS + 1_000;
    t.play(a, { kind: 'say', utterance: typed(l2.jp.kana) });
    t.play(b, { kind: 'say', utterance: speech(bLine.jp.kana) });
    t.now += 100;
    expect(t.play(y, { kind: 'buzz', phraseId: t.st.cards[y]!.cells.find((c) => c !== bLine.id && c !== l2.id)!, actorId: b }).error).toBeUndefined();
    expect(t.play(y, { kind: 'buzz', phraseId: l1.id, actorId: a }).error).toBe('no-tries-left');
    expect(t.view(y).me!.card!.buzzesLeft).toBe(0);
    // During the scene the stage shows that x and y buzzed, never at whom.
    expect(t.view('stage').ticker.filter((i) => i.kind === 'buzz').every((i) => !i.buzz)).toBe(true);

    t.timeout();
    // a: l1 peeked + caught → 100; l2 typed from memory, uncaught → 100 + 100 + 20 (comeback ×1.5 doesn't apply: all at 0).
    expect(t.score(a)).toBe(SLIP_POINTS + (SLIP_POINTS + SMOOTH_POINTS + MEMORY_BONUS.typed));
    expect(t.score(x)).toBe(CATCH_POINTS);
    expect(t.score(y)).toBe(0);
    const l1v = t.view('stage').cast.find((c) => c.playerId === a)!.phrases!.find((p) => p.id === l1.id)!;
    expect(l1v).toMatchObject({ said: true, smooth: false, memory: false, caughtBy: [x] });
    expect(t.s.phrasebook[a]?.find((e) => e.itemId === l1.id)?.outcome).toBe('retry');
    expect(t.s.phrasebook[x]?.find((e) => e.itemId === l1.id)?.outcome).toBe('seen');
    expect(t.view(y).me!.card!.cells.filter((c) => c.buzz).map((c) => c.buzz!.result)).toEqual(expect.arrayContaining(['miss', 'miss', 'miss']));
  });

  it('a buzz just before the line registers (recogniser lag) still catches it', () => {
    const t = new Table(3);
    t.start();
    t.action();
    const [a] = t.actors as [string];
    const [x] = t.audience as [string];
    const line = t.secretsOf(a)[0]!;
    t.play(x, { kind: 'buzz', phraseId: line.id, actorId: a });
    t.now += GRACE_MS - 500;
    t.play(a, { kind: 'say', utterance: speech(line.jp.kana) });
    t.timeout();
    expect(t.score(x)).toBe(CATCH_POINTS);
    expect(t.score(a)).toBe(SLIP_POINTS + MEMORY_BONUS.speech);
  });

  it('the scene ends early once every line is said and every buzz used', () => {
    const t = new Table(3);
    t.start();
    t.action();
    const [x] = t.audience as [string];
    for (const a of t.actors) for (const p of t.secretsOf(a)) t.play(a, { kind: 'say', utterance: speech(p.jp.kana) });
    expect(t.s.phase).toBe('answer');
    const cells = t.st.cards[x]!.cells;
    for (let i = 0; i < BUZZES; i++) t.play(x, { kind: 'buzz', phraseId: cells[i]!, actorId: t.actors[0]! });
    expect(t.s.phase).toBe('reveal');
  });

  it('bingo: a card line of lines that were said pays the card holder', () => {
    const t = new Table(3);
    t.start();
    t.action();
    const [x] = t.audience as [string];
    const said: string[] = [];
    for (const a of t.actors) for (const p of t.secretsOf(a)) {
      t.play(a, { kind: 'say', utterance: speech(p.jp.kana) });
      said.push(p.id);
    }
    // Plant the said lines on the top row of x's card.
    const card = t.st.cards[x]!;
    card.cells = [...said.slice(0, 3), ...card.cells.filter((c) => !said.slice(0, 3).includes(c))];
    t.timeout();
    expect(t.score(x)).toBe(BINGO_POINTS);
    t.timeout(); // reveal → encore
    t.timeout(); // encore → score
    expect(t.s.phase).toBe('score');
    expect(t.view('stage').bingos).toEqual([x]);
    expect(t.view(x).me!.card!.line).toEqual([0, 1, 2]);
    expect(t.view(x).me!.card!.cells.slice(0, 3).every((c) => c.daubed)).toBe(true);
  });

  it('the encore: everyone shouts the smoothest line back for a small bonus', () => {
    const t = new Table(3);
    t.start();
    t.action();
    const [a, b] = t.actors as [string, string];
    const [x] = t.audience as [string];
    const line = t.secretsOf(b)[1]!;
    t.play(b, { kind: 'say', utterance: speech(line.jp.kana) });
    t.timeout();
    t.timeout();
    expect(t.s.phase).toBe('encore');
    expect(t.view('stage').highlight?.id).toBe(line.id);
    const before = t.score(x);
    expect(t.play(x, { kind: 'echo', utterance: speech(line.jp.kana) }).error).toBeUndefined();
    // x trails (0 points against b's slip), so the comeback raises the bonus by half.
    expect(t.score(x)).toBe(before + ECHO_BONUS.speech * 1.5);
    expect(t.view(x).me!.echo).toMatchObject({ ok: true, canEcho: false });
    t.play(a, { kind: 'echo', utterance: speech('ちがう') });
    expect(t.view(a).me!.echo).toMatchObject({ ok: false, triesLeft: 1, heard: 'ちがう' });
    t.play(a, { kind: 'echo', utterance: speech('ちがう') });
    expect(t.play(a, { kind: 'echo', utterance: speech(line.jp.kana) }).error).toBe('no-tries-left');
    expect(t.s.phase).toBe('encore');
    t.play(b, { kind: 'echo', utterance: typed(line.jp.kana) });
    expect(t.s.phase).toBe('score'); // everyone done
    expect(t.view('stage').echoed.sort()).toEqual([b, x].sort());
  });

  it('speaking bonuses stay within 30% of what each player had at stake, comebacks included', () => {
    const t = new Table(4, REAL_CONTENT, 11);
    t.start(3);
    for (let guard = 0; guard < 100 && t.s.phase !== 'recap'; guard++) {
      if (t.s.phase === 'answer') {
        for (const a of t.actors) for (const p of t.secretsOf(a)) t.play(a, { kind: 'say', utterance: speech(p.jp.kana) });
        t.timeout();
      } else if (t.s.phase === 'encore') {
        const h = t.st.pool[t.st.highlight!]!;
        for (const p of t.s.players) t.play(p.id, { kind: 'echo', utterance: speech(h.jp.kana) });
      } else t.timeout();
      if (t.s.phase === 'score') {
        for (const [id, used] of Object.entries(t.st.bonusUsed)) {
          const actor = t.st.cast.find((a) => a.playerId === id);
          const stake = actor ? (SLIP_POINTS + SMOOTH_POINTS) * actor.secrets.length : CATCH_POINTS * BUZZES;
          expect(used).toBeLessThanOrEqual(0.3 * stake * t.view().multiplier);
        }
      }
    }
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap!.awards.some((a) => a.title === 'だいめいゆう')).toBe(true);
  });
});

describe('Phrase Bingo: robustness', () => {
  it('plays a whole game on timeouts alone with no content loaded (the scenes carry their own lines)', () => {
    const t = new Table(3, EMPTY_CONTENT, 5);
    expect(t.cmd('stage', { type: 'start', mode: 'phrase-bingo' }).changed).toBe(true);
    for (let i = 0; i < 100 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
    expect(t.st.round).toBe(4);
  });

  it('survives an actor and an audience member leaving mid-scene', () => {
    const t = new Table(5);
    t.start();
    t.action();
    const [a] = t.actors as [string];
    const [x] = t.audience as [string];
    t.play(a, { kind: 'say', utterance: speech(t.secretsOf(a)[0]!.jp.kana) });
    t.play(x, { kind: 'buzz', phraseId: t.secretsOf(a)[0]!.id, actorId: a });
    t.act({ type: 'release', playerId: a });
    t.act({ type: 'release', playerId: x });
    for (let i = 0; i < 40 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  it('a Kana-level viewer gets romaji on lines and cards', () => {
    const t = new Table(3, REAL_CONTENT, 2, ['kana', 'kana', 'kana']);
    t.start();
    const actor = t.actors[0]!;
    const v = t.view(actor).me!.actor!;
    expect(v.secrets.length).toBe(2);
    expect(v.secrets[0]!.jp?.romaji).toBeTruthy();
    expect(t.view(t.audience[0]!).me!.card!.cells[0]!.romaji).toBeTruthy();
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Phrase Bingo: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      durations: { intro: 20, prompt: 150, answer: 700, reveal: 40, encore: 200, score: 30 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [3, 6]) {
    it(`${players} bots play every scene with every client in sync`, async () => {
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
      let slips = 0;
      let catches = 0;
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 3,
        totalRounds: 1_000,
        mode: 'phrase-bingo',
        packId: 'travel',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          const g = view.game as PhraseBingoView | null;
          if (g?.mode === 'phrase-bingo' && view.phase === 'reveal') {
            slips += g.cast.reduce((n, a) => n + (a.phrases ?? []).filter((p) => p.said).length, 0);
            catches += g.ticker.filter((i) => i.buzz?.ok).length;
          }
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = phraseBingoPolicy({ delayMs: [5, 300], quiet: (id) => id.endsWith('2'), hearRate: 0.9 });
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

      for (const p of ['intro', 'prompt', 'answer', 'reveal', 'encore', 'score', 'recap']) expect(phases, p).toContain(p);
      expect(slips).toBeGreaterThan(3);

      // Every accepted state matches what the server committed for that viewer.
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      expect(standings.reduce((n, s) => n + s.score, 0)).toBeGreaterThan(0);
      expect(catches).toBeGreaterThanOrEqual(0);

      // No move failed except harmless races with the phase clock.
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(10);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
