import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PackWord, TopicPack } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { buildBoard, planBoard, planForSize, usableWords } from '../shared/src/modes/concentration/board.js';
import {
  concentrationMode,
  GUESS_OPENS_AT,
  PAIR_POINTS,
  SPOKEN_BONUS,
  type ConcentrationState,
  type ConcentrationView,
} from '../shared/src/modes/concentration/concentration.js';
import { toRomaji } from '../shared/src/japanese/romaji.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { concentrationPolicy } from '../tools/bots/policies/concentration.js';
import { hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

const word = (id: string, text: string, kana: string, en: string, level: PackWord['level'] = 'n5'): PackWord => ({ id: `t.${id}`, jp: { text, kana, en }, pos: 'noun', level });

const PACK: TopicPack = {
  id: 'test',
  title: { text: 'テスト', kana: 'テスト', en: 'Test' },
  blurb: 'fixture',
  words: [
    word('mizu', '水', 'みず', 'water'),
    word('sushi', 'すし', 'すし', 'sushi', 'kana'),
    word('neko', 'ねこ', 'ねこ', 'cat', 'kana'),
    word('inu', '犬', 'いぬ', 'dog'),
    word('eki', '駅', 'えき', 'station'),
    word('kasa', 'かさ', 'かさ', 'umbrella'),
    word('coffee', 'コーヒー', 'コーヒー', 'coffee', 'kana'),
    word('hon', '本', 'ほん', 'book'),
    word('yama', '山', 'やま', 'mountain'),
    word('baseline', 'りんご', 'りんご', 'apple', 'kana'),
    { ...word('long', 'おばあちゃんの ひみつ', 'おばあちゃんの ひみつ', "grandma's secret"), swerve: true },
  ],
  phrases: [],
  baselineWordIds: ['t.baseline'],
  status: 'draft',
};

const CONTENT: ContentLibrary = { ...EMPTY_CONTENT, packs: [PACK] };

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
    readonly content: ContentLibrary = CONTENT,
    seed = 7,
    levels: PackWord['level'][] = [],
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
  get st(): ConcentrationState {
    return this.s.modeState as ConcentrationState;
  }
  view(viewer: string | 'stage' = 'stage'): ConcentrationView {
    const v = viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, this.content);
    return v.game as ConcentrationView;
  }
  start() {
    expect(this.cmd('stage', { type: 'start', mode: 'concentration', packId: 'test' }).changed).toBe(true);
    this.timeout(); // intro → first turn
    expect(this.s.phase).toBe('answer');
  }
  get turnPlayer(): string {
    return this.st.turn!.playerId!;
  }
  /** Cells of one face-down pair. */
  pairCells(): [number, number] {
    const st = this.st;
    const pair = st.pairs.find((p) => !p.cleared)!;
    const cells = st.cards.map((c, i) => (c.pairId === pair.id ? i : -1)).filter((i) => i >= 0);
    return cells as [number, number];
  }
  wordOf(cell: number) {
    const st = this.st;
    return st.pairs.find((p) => p.id === st.cards[cell]!.pairId)!.word.jp;
  }
  /** Two face-down pair cards that don't match. */
  mismatchCells(): [number, number] {
    const st = this.st;
    const down = st.cards.map((c, i) => (c.state === 'down' && c.role !== 'special' ? i : -1)).filter((i) => i >= 0);
    const a = down[0]!;
    const b = down.find((i) => st.cards[i]!.pairId !== st.cards[a]!.pairId)!;
    return [a, b];
  }
  specialCell(kind: 'yokai' | 'bonus' | 'fog'): number {
    const st = this.st;
    let i = st.cards.findIndex((c) => c.state === 'down' && c.face.special === kind);
    if (i < 0) {
      // Plant one: swap a pair card out for the special (keeps the test independent of the shuffle).
      i = st.cards.findIndex((c) => c.state === 'down' && c.role === 'special');
      st.cards[i] = { pairId: null, role: 'special', face: { kind: 'special', special: kind, text: '?' }, state: 'down' };
    }
    return i;
  }
  /** Flips a pair and walks to the say-it window. */
  toClaim(): { player: string; cells: [number, number] } {
    const player = this.turnPlayer;
    const cells = this.pairCells();
    expect(this.play(player, { kind: 'flip', cell: cells[0] }).error).toBeUndefined();
    expect(this.play(player, { kind: 'flip', cell: cells[1] }).error).toBeUndefined();
    expect(this.s.phase).toBe('prompt');
    this.timeout();
    expect(this.s.phase).toBe('reveal');
    return { player, cells };
  }
}

const speech = (text: string) => ({ via: 'speech', text });
const typed = (text: string) => ({ via: 'typed', text });

// ---- unit tests ----

describe('Kotoba Concentration: board', () => {
  it('sizes the board by player count and level', () => {
    const r = mulberry(1);
    expect(planBoard(3, ['n5', 'n5', 'n5'], r)).toMatchObject({ cols: 4, pairs: 7 });
    expect(planBoard(5, ['n5', 'n5', 'n5', 'n5', 'n5'], r)).toMatchObject({ cols: 5, pairs: 11 });
    expect(planBoard(8, Array(8).fill('n5'), r)).toMatchObject({ cols: 6, pairs: 16 });
    expect(planBoard(8, Array(8).fill('kana'), r)).toMatchObject({ cols: 5 });
    for (const size of [4, 5, 6]) {
      const plan = planForSize(size, r);
      expect(plan.pairs * 2 + plan.specials.length).toBe(size * size);
    }
  });

  it('skips baseline and swerve words, and builds two cards per pair with distinct readings', () => {
    const words = usableWords(PACK, ['n5']);
    expect(words.map((w) => w.id)).not.toContain('t.baseline');
    expect(words.map((w) => w.id)).not.toContain('t.long');
    const board = buildBoard(PACK, planForSize(4, mulberry(3)), ['n5', 'n5'], mulberry(3), (() => { let n = 0; return () => `x${++n}`; })());
    expect(board.cards.length).toBe(16);
    expect(board.pairs.length).toBe(7);
    for (const p of board.pairs) {
      const cards = board.cards.filter((c) => c.pairId === p.id);
      expect(cards.map((c) => c.role).sort()).toEqual(['cue', 'word']);
      if (p.kind === 'reading') expect(cards.find((c) => c.role === 'cue')!.face.kind).toBe('kanji');
    }
    expect(new Set(board.pairs.map((p) => p.word.jp.kana)).size).toBe(7);
    // The 9 usable fixture words can't fill a 5×5 (11 pairs): the placeholder words top it up.
    const big = buildBoard(PACK, planForSize(5, mulberry(3)), ['n5'], mulberry(3), (() => { let n = 0; return () => `y${++n}`; })());
    expect(big.pairs.length).toBe(11);
    expect(big.fallback).toBe(true);
  });

  it('turns kana into romaji for the Kana-level hint', () => {
    expect(toRomaji('みず')).toBe('mizu');
    expect(toRomaji('コーヒー')).toBe('kōhī');
    expect(toRomaji('でんしゃ')).toBe('densha');
    expect(toRomaji('きっぷ')).toBe('kippu');
    expect(toRomaji('ぎゅうにゅう')).toBe('gyūnyū');
    expect(toRomaji('きんえん')).toBe("kin'en");
    expect(toRomaji('ティー')).toBe('tī');
    expect(toRomaji('まっちゃ')).toBe('matcha');
  });
});

describe('Kotoba Concentration: turns', () => {
  it('a matched pair said aloud is kept for 140 points and goes in the phrasebook', () => {
    const t = new Table(3);
    t.start();
    const { player, cells } = t.toClaim();
    // The word card turns away during the say-it window, for everyone.
    const stage = t.view('stage');
    const wordCell = cells.find((i) => t.st.cards[i]!.role === 'word')!;
    expect(stage.cells[wordCell]).toEqual({ state: 'up', masked: true });
    expect(stage.claim?.word).toBeNull();
    expect(JSON.stringify(stage)).not.toContain(t.wordOf(wordCell).kana);
    const w = t.wordOf(cells[0]);
    expect(t.play('p3' === player ? 'p1' : 'p3', { kind: 'say', utterance: speech(w.kana) }).error).toBe('not-your-pair');
    expect(t.play(player, { kind: 'say', utterance: speech(w.kana) }).error).toBeUndefined();
    expect(t.s.phase).toBe('score');
    expect(t.s.players.find((p) => p.id === player)!.score).toBe(PAIR_POINTS + SPOKEN_BONUS);
    expect(t.s.phrasebook[player]?.[0]).toMatchObject({ kana: w.kana, outcome: 'said' });
    expect(t.view().result).toMatchObject({ kind: 'claimed', playerId: player, points: 140 });
    expect(t.view().cells[cells[0]]!.state).toBe('cleared');
    // The two cleared cells now show the hidden picture.
    expect(t.view().picture.tiles.filter(Boolean).length).toBe(2);
    t.timeout();
    expect(t.s.phase).toBe('answer');
    expect(t.turnPlayer).not.toBe(player);
  });

  it('typing it (quiet mode) still keeps the pair but earns less', () => {
    const t = new Table(2);
    t.start();
    const { player, cells } = t.toClaim();
    expect(t.play(player, { kind: 'say', utterance: typed(t.wordOf(cells[0]).kana) }).error).toBeUndefined();
    expect(t.s.players.find((p) => p.id === player)!.score).toBe(PAIR_POINTS);
  });

  it('accepts a kanji transcript through its server-made reading', () => {
    const t = new Table(2);
    t.start();
    const { player, cells } = t.toClaim();
    const w = t.wordOf(cells[0]);
    expect(t.play(player, { kind: 'say', utterance: { via: 'speech', text: '漢字', reading: w.kana } }).error).toBeUndefined();
    expect(t.view().result?.kind).toBe('claimed');
  });

  it('after two misses anyone else can steal it; first right answer wins', () => {
    const t = new Table(3);
    t.start();
    const { player, cells } = t.toClaim();
    const w = t.wordOf(cells[0]);
    t.play(player, { kind: 'say', utterance: speech('ちがう') });
    expect(t.view(player).mine?.last).toEqual({ ok: false, heard: 'ちがう' });
    t.play(player, { kind: 'say', utterance: speech('ちがいます') });
    expect(t.s.phase).toBe('encore');
    expect(t.view(player).mine?.canSay).toBe(false);
    const [a, b] = ['p1', 'p2', 'p3'].filter((p) => p !== player) as [string, string];
    expect(t.view(a).mine?.canSay).toBe(true);
    expect(t.play(a, { kind: 'say', utterance: speech(w.kana) }).error).toBeUndefined();
    expect(t.play(b, { kind: 'say', utterance: speech(w.kana) }).error).toBe('wrong-phase');
    expect(t.s.phase).toBe('score');
    expect(t.view().result).toMatchObject({ kind: 'stolen', playerId: a });
    expect(t.st.tally[a]).toMatchObject({ pairs: 1, steals: 1, points: 140 });
    expect(t.s.phrasebook[player]?.[0]?.outcome).toBe('missed');
  });

  it('a pair nobody says goes back down once, then leaves the board with no owner', () => {
    const t = new Table(2);
    t.start();
    const first = t.toClaim();
    t.timeout(); // claim window closes
    expect(t.s.phase).toBe('encore');
    t.timeout(); // steal window closes
    expect(t.view().result?.kind).toBe('missed');
    t.timeout();
    expect(t.st.cards[first.cells[0]]!.state).toBe('down');
    // Same pair again: the cards are where they were.
    const player = t.turnPlayer;
    t.play(player, { kind: 'flip', cell: first.cells[0] });
    t.play(player, { kind: 'flip', cell: first.cells[1] });
    t.timeout();
    t.timeout();
    t.timeout();
    expect(t.view().result?.kind).toBe('cleared');
    expect(t.view().cells[first.cells[0]]).toEqual({ state: 'cleared', owner: null });
  });

  it('a mismatch shows both cards, flips them back and passes the turn by seat, skipping the disconnected', () => {
    const t = new Table(3);
    t.start();
    expect(t.turnPlayer).toBe('p1');
    t.act({ type: 'connection', playerId: 'p2', connected: false });
    const [a, b] = t.mismatchCells();
    expect(t.play('p2', { kind: 'flip', cell: a }).error).toBe('not-your-turn');
    t.play('p1', { kind: 'flip', cell: a });
    expect(t.play('p1', { kind: 'flip', cell: a }).error).toBe('not-face-down');
    expect(t.play('p1', { kind: 'flip', cell: 99 }).error).toBe('bad-cell');
    expect(t.play('p1', { kind: 'flip', cell: '1' }).error).toBe('bad-cell');
    t.play('p1', { kind: 'flip', cell: b });
    expect(t.s.phase).toBe('score');
    expect(t.view().cells[a]!.state).toBe('up');
    expect(t.view().result?.kind).toBe('mismatch');
    t.timeout();
    expect(t.st.cards[a]!.state).toBe('down');
    expect(t.turnPlayer).toBe('p3');
  });

  it('the turn timer passes the turn and turns a lone card back down', () => {
    const t = new Table(2);
    t.start();
    const [a] = t.mismatchCells();
    t.play('p1', { kind: 'flip', cell: a });
    t.timeout();
    expect(t.s.phase).toBe('answer');
    expect(t.turnPlayer).toBe('p2');
    expect(t.st.cards[a]!.state).toBe('down');
  });

  it('a turn player who drops ends their turn at once', () => {
    const t = new Table(3);
    t.start();
    t.act({ type: 'connection', playerId: 'p1', connected: false });
    expect(t.s.phase).toBe('answer');
    expect(t.turnPlayer).toBe('p2');
  });
});

describe('Kotoba Concentration: special tiles', () => {
  it('yōkai shuffles the face-down cards and the turn goes on', () => {
    const t = new Table(2);
    t.start();
    const before = t.st.shuffleSeq;
    const cell = t.specialCell('yokai');
    const [a] = t.mismatchCells();
    t.play('p1', { kind: 'flip', cell: a });
    const upCard = t.st.cards[a];
    expect(t.play('p1', { kind: 'flip', cell }).error).toBeUndefined();
    expect(t.st.shuffleSeq).toBe(before + 1);
    expect(t.st.cards[cell]!.state).toBe('cleared');
    expect(t.st.cards[a]).toBe(upCard); // the face-up card stays put
    expect(t.s.phase).toBe('answer');
    expect(t.st.turn!.flips.length).toBe(1);
    expect(t.view().flash?.kind).toBe('yokai');
  });

  it('bonus gives the same player another turn', () => {
    const t = new Table(2);
    t.start();
    t.play('p1', { kind: 'flip', cell: t.specialCell('bonus') });
    const [a, b] = t.mismatchCells();
    t.play('p1', { kind: 'flip', cell: a });
    t.play('p1', { kind: 'flip', cell: b });
    t.timeout();
    expect(t.turnPlayer).toBe('p1');
    expect(t.view().turn?.extra).toBe(true);
    const [c, d] = t.mismatchCells();
    t.play('p1', { kind: 'flip', cell: c });
    t.play('p1', { kind: 'flip', cell: d });
    t.timeout();
    expect(t.turnPlayer).toBe('p2');
  });

  it('fog hides a row for the next turn only', () => {
    const t = new Table(2);
    t.start();
    t.play('p1', { kind: 'flip', cell: t.specialCell('fog') });
    const row = t.st.pendingFog!;
    expect(row).not.toBeNull();
    t.timeout(); // p1's turn runs out
    expect(t.turnPlayer).toBe('p2');
    expect(t.view().fogRow).toBe(row);
    const fogged = t.st.cards.findIndex((c, i) => c.state === 'down' && Math.floor(i / t.st.cols) === row);
    expect(t.play('p2', { kind: 'flip', cell: fogged }).error).toBe('fogged');
    t.timeout();
    expect(t.view().fogRow).toBeNull();
  });
});

describe('Kotoba Concentration: hidden picture', () => {
  it('opens once a pair is cleared, takes one guess each, and pays more the earlier it is solved', () => {
    const t = new Table(3);
    t.start();
    const answerId = t.st.scene.id;
    const wrong = t.st.scene.options.find((o) => o.id !== answerId)!.id;
    expect(t.play('p2', { kind: 'guess', optionId: answerId }).error).toBe('too-early');
    // The stage never carries a tile before it is uncovered, nor the answer.
    const stage = t.view();
    expect(stage.picture.tiles.every((x) => x === null)).toBe(true);
    expect(stage.picture.answer).toBeNull();
    const { player, cells } = t.toClaim();
    t.play(player, { kind: 'say', utterance: speech(t.wordOf(cells[0]).kana) });
    expect(t.view().picture.uncovered).toBeGreaterThanOrEqual(GUESS_OPENS_AT);
    expect(t.play('p2', { kind: 'guess', optionId: 'nope' }).error).toBe('bad-option');
    expect(t.play('p2', { kind: 'guess', optionId: wrong }).error).toBeUndefined();
    expect(t.play('p2', { kind: 'guess', optionId: answerId }).error).toBe('already-guessed');
    const worth = t.view().picture.worth;
    const before = t.s.players.find((p) => p.id === 'p3')!.score;
    expect(t.play('p3', { kind: 'guess', optionId: answerId }).error).toBeUndefined();
    expect(t.s.players.find((p) => p.id === 'p3')!.score).toBe(before + worth);
    expect(worth).toBeGreaterThan(200);
    expect(t.view().picture.answer).toEqual(t.st.scene.name);
    expect(t.view().picture.tiles.every(Boolean)).toBe(true);
    expect(t.play('p1', { kind: 'guess', optionId: answerId }).error).toBe('already-solved');
  });
});

describe('Kotoba Concentration: whole games', () => {
  it('runs to the finale with no content at all (placeholder words) and only timeouts', () => {
    const t = new Table(2, EMPTY_CONTENT, 11);
    expect(t.cmd('stage', { type: 'start', mode: 'concentration' }).changed).toBe(true);
    expect(t.st.fallback).toBe(true);
    for (let i = 0; i < 2_000 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  it('ends at the time cap', () => {
    const t = new Table(2);
    t.start();
    t.now += 13 * 60_000;
    t.timeout();
    expect(t.s.phase).toBe('finale');
    t.timeout();
    expect(t.s.phase).toBe('recap');
  });

  it('clears the board with perfect play, keeping the speaking bonus under 30% of points', () => {
    const t = new Table(4, CONTENT, 5, ['kana', 'n5', 'n5', 'n4']);
    t.start();
    for (let guard = 0; guard < 500 && t.s.phase !== 'recap'; guard++) {
      if (t.s.phase === 'answer' && t.st.pairs.some((p) => !p.cleared)) {
        const player = t.turnPlayer;
        const cells = t.pairCells();
        t.play(player, { kind: 'flip', cell: cells[0] });
        t.play(player, { kind: 'flip', cell: cells[1] });
      } else if (t.s.phase === 'reveal') {
        const claimer = t.st.claim!.claimerId;
        // A Kana-level player gets the reading and romaji in their own window.
        const hint = t.view(claimer).mine?.hint;
        if (t.s.players.find((p) => p.id === claimer)!.level === 'kana') expect(hint?.romaji).toBeTruthy();
        else expect(hint).toBeNull();
        t.play(claimer, { kind: 'say', utterance: speech(t.wordOf(t.st.claim!.cells[0]).kana) });
      } else t.timeout();
    }
    expect(t.s.phase).toBe('recap');
    const total = t.s.players.reduce((n, p) => n + p.score, 0);
    expect(total).toBe(t.st.pairs.length * (PAIR_POINTS + SPOKEN_BONUS));
    expect((t.st.pairs.length * SPOKEN_BONUS) / total).toBeLessThanOrEqual(0.3);
    expect(t.s.recap?.awards.some((a) => a.title === 'きおく マスター')).toBe(true);
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Kotoba Concentration: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      durations: { intro: 20, prompt: 40, answer: 600, reveal: 400, encore: 300, score: 30, finale: 30 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [3, 5]) {
    it(`${players} bots clear the board with every client in sync`, async () => {
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
      let lastGame: ConcentrationView | null = null;
      let recap: RoomView['recap'] = null;
      const phases = new Set<string>();
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 1,
        totalRounds: 1_000,
        mode: 'concentration',
        packId: 'food',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          if (view.game?.mode === 'concentration') lastGame = view.game;
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const policy = concentrationPolicy({ delayMs: [5, 40], quiet: (id) => id.endsWith('2') });
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

      // A real game happened: turns, say-it windows and a cleared board.
      for (const p of ['answer', 'prompt', 'reveal', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      const game = lastGame as ConcentrationView | null;
      expect(game?.pairsLeft).toBe(0);

      // Every accepted state matches what the server committed for that viewer.
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      // Scores add up: each final score is that player's tally, and the tally is pairs + picture bonus.
      const standings = (recap as RoomView['recap'])!.standings;
      for (const s of standings) {
        const t = game!.tally.find((x) => x.playerId === s.playerId)!;
        expect(s.score, s.name).toBe(t.points);
        const solved = game!.picture.solvedBy === s.playerId;
        expect(t.points >= t.pairs * PAIR_POINTS && t.points <= t.pairs * (PAIR_POINTS + SPOKEN_BONUS) + (solved ? 240 : 0)).toBe(true);
      }
      expect(game!.tally.reduce((n, t) => n + t.pairs, 0)).toBeLessThanOrEqual(game!.totalPairs);

      // No move failed except harmless races with the phase clock.
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase' && m.error !== 'already-solved'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok).length).toBeGreaterThan(10);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
