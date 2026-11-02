// Frame Concentration: Kotoba Concentration in the Green Car (docs/modes/concentration.md, "Green Car").
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { FRAME_BY_ID, framesOf, type FrameId } from '../shared/src/japanese/frames.js';
import { hasKanji, type Utterance } from '../shared/src/japanese/kana.js';
import { planForSize } from '../shared/src/modes/concentration/board.js';
import {
  concentrationMode,
  DURATIONS,
  GREEN_DURATIONS,
  GREEN_POINTS,
  PAIR_POINTS,
  SPOKEN_BONUS,
  type ConcentrationState,
  type ConcentrationView,
} from '../shared/src/modes/concentration/concentration.js';
import { GISTS, N3_DECK_FRAMES, N4_DECK_FRAMES } from '../shared/src/modes/concentration/frameDeck.js';
import { buildGreenBoard, checkFrameSay, GIST_BY_ID, gistPool, levelOfFrame, modelWords, planGreenBoard } from '../shared/src/modes/concentration/greenBoard.js';
import { EMPTY_CONTENT, type HostCue } from '../shared/src/modes/mode.js';
import { textAllowed } from '../shared/src/moderation.js';
import type { Audience, Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { BOT_OPENERS, botSentence, concentrationPolicy } from '../tools/bots/policies/concentration.js';
import type { Level } from '../content/src/types.js';
import { startServer, until } from './helpers.js';

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

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});

/** An utterance as the server hands it to the rules: with its reading and kuromoji tokens. */
function heard(text: string, via: Utterance['via'] = 'speech'): Utterance {
  const move = { u: { via, text } as Utterance };
  addReadings(move, reader);
  return move.u;
}

class Table {
  now = 1_000_000;
  ids = 0;
  cmdId = 0;
  cues: HostCue[] = [];
  readonly random: () => number;
  readonly s: GameState = createGame('BCDF');
  constructor(levels: Level[], seed = 7, audience?: Audience) {
    this.random = mulberry(seed);
    levels.forEach((level, i) => {
      this.act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
      this.act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
    });
    if (audience) this.cmd('stage', { type: 'settings', audience });
  }
  ctx(): GameContext {
    return { now: this.now, content: EMPTY_CONTENT, newId: () => `id${++this.ids}`, random: this.random };
  }
  act(action: GameAction) {
    const out = apply(this.s, action, this.ctx());
    this.cues.push(...this.s.cues);
    return out;
  }
  cmd(actor: string | 'stage', command: CommandBody) {
    const who = actor === 'stage' ? ({ kind: 'stage' } as const) : ({ kind: 'player', playerId: actor } as const);
    return this.act({ type: 'command', actor: who, command: { ...command, id: `c${++this.cmdId}` } as Command });
  }
  play(player: string, move: unknown) {
    return this.cmd(player, { type: 'play', move });
  }
  say(player: string, text: string, via: Utterance['via'] = 'speech') {
    return this.play(player, { kind: 'say', utterance: heard(text, via) });
  }
  timeout() {
    this.now = Math.max(this.now, this.s.deadline ?? 0);
    return this.act({ type: 'timeout', phaseSeq: this.s.phaseSeq });
  }
  get st(): ConcentrationState {
    return this.s.modeState as ConcentrationState;
  }
  view(viewer: string | 'stage' = 'stage'): ConcentrationView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, EMPTY_CONTENT).game as ConcentrationView;
  }
  start() {
    expect(this.cmd('stage', { type: 'start', mode: 'concentration' }).changed).toBe(true);
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  get turnPlayer(): string {
    return this.st.turn!.playerId!;
  }
  /** Cells of one face-down pair (optionally one that matches `want`). */
  pairCells(want: (p: ConcentrationState['pairs'][number]) => boolean = () => true): [number, number] {
    const pair = this.st.pairs.find((p) => !p.cleared && want(p))!;
    return this.st.cards.map((c, i) => (c.pairId === pair.id ? i : -1)).filter((i) => i >= 0) as [number, number];
  }
  gistAt(cell: number) {
    const pair = this.st.pairs.find((p) => p.id === this.st.cards[cell]!.pairId)!;
    return { pair, gist: GIST_BY_ID.get(pair.gist!.id)! };
  }
  /** Flips a pair and walks to the say-it window. */
  toClaim(want?: (p: ConcentrationState['pairs'][number]) => boolean) {
    const player = this.turnPlayer;
    const cells = this.pairCells(want);
    this.play(player, { kind: 'flip', cell: cells[0] });
    this.play(player, { kind: 'flip', cell: cells[1] });
    expect(this.s.phase).toBe('prompt');
    this.timeout();
    expect(this.s.phase).toBe('reveal');
    return { player, cells, ...this.gistAt(cells[0]) };
  }
}

// ---- the deck ----

describe('Frame Concentration: the deck', () => {
  const deckFrames: readonly FrameId[] = [...N4_DECK_FRAMES, ...N3_DECK_FRAMES];

  it('has about 160 draft gists with unique ids, pictures and gists, on frames that exist', () => {
    expect(GISTS.length).toBeGreaterThanOrEqual(150);
    for (const key of ['id', 'pic', 'en'] as const) expect(new Set(GISTS.map((g) => g[key])).size, key).toBe(GISTS.length);
    for (const g of GISTS) {
      expect(FRAME_BY_ID[g.frame], g.id).toBeDefined();
      expect(deckFrames, g.id).toContain(g.frame);
      expect(g.status).toBe('draft');
      expect(FRAME_BY_ID[g.frame].level, g.id).toBe(levelOfFrame(g.frame));
      // Kana-first, spaced, no kanji; a short English gist.
      expect(hasKanji(g.model.kana), g.id).toBe(false);
      expect(g.model.kana, g.id).toMatch(/\s/);
      expect(g.en.split(/\s+/).length, g.id).toBeLessThanOrEqual(9);
    }
  });

  it('reaches every frame in every audience, in about 30/50/20 proportions', () => {
    for (const f of deckFrames)
      for (const a of ['kids', 'family', 'cheeky'] as const) expect(GISTS.some((g) => g.frame === f && g.audience === a), `${f} ${a}`).toBe(true);
    const share = (a: string) => GISTS.filter((g) => g.audience === a).length / GISTS.length;
    expect(share('kids')).toBeGreaterThan(0.25);
    expect(share('family')).toBeGreaterThan(0.45);
    expect(share('cheeky')).toBeGreaterThan(0.12);
    expect(N4_DECK_FRAMES.length).toBe(12);
    expect(N3_DECK_FRAMES.length).toBe(15);
  });

  it('keeps Kids gists clean of the Kids word list', () => {
    for (const g of GISTS.filter((x) => x.audience === 'kids')) expect(textAllowed(`${g.model.kana} ${g.en}`, 'kids'), g.id).toBe(true);
    for (const g of GISTS) expect(textAllowed(`${g.model.kana} ${g.en}`, 'family'), g.id).toBe(true);
  });

  it('every model line carries its frame (framesOf, with the server tokens) and its key word', () => {
    const bad: string[] = [];
    for (const g of GISTS) {
      const found = framesOf(g.model, reader.tokens(g.model.text), { keepHidden: true });
      if (!found.includes(g.frame)) bad.push(`${g.id}: ${g.model.kana} → ${found.join(',')}`);
      if (!checkFrameSay(heard(g.model.kana), g).ok) bad.push(`${g.id}: the check rejects its own model`);
    }
    expect(bad).toEqual([]);
  });

  it("the bots' varied sentences still pass the check", () => {
    const bad: string[] = [];
    for (const g of GISTS)
      for (let i = 0; i < BOT_OPENERS.length; i++) {
        const line = botSentence(g.pic, (i + 0.5) / BOT_OPENERS.length)!;
        if (!checkFrameSay(heard(line), g).ok) bad.push(`${g.id}: ${line}`);
      }
    expect(bad).toEqual([]);
    expect(new Set(BOT_OPENERS.map((_, i) => botSentence(GISTS[0]!.pic, (i + 0.5) / BOT_OPENERS.length))).size).toBe(BOT_OPENERS.length);
  });
});

// ---- the check ----

describe('Frame Concentration: the lenient check', () => {
  const asleep = GISTS.find((g) => g.frame === 'furi' && g.anchorEn === 'asleep')!;

  it('takes the frame and the key word in the player’s own words', () => {
    for (const line of ['ねた ふりを した', 'ねて いる ふりを しました', 'ずっと ねた ふりを して いた', '寝たふりをしました']) expect(checkFrameSay(heard(line), asleep).ok, line).toBe(true);
  });

  it('says what was missing', () => {
    expect(checkFrameSay(heard('しらない ふりを しました'), asleep)).toEqual({ ok: false, frame: true, anchor: false });
    expect(checkFrameSay(heard('ねて いました'), asleep)).toEqual({ ok: false, frame: false, anchor: true });
    expect(checkFrameSay(heard('えっと'), asleep)).toEqual({ ok: false, frame: false, anchor: false });
  });
});

// ---- the deal ----

describe('Frame Concentration: the deal', () => {
  const newId = () => {
    let n = 0;
    return () => `x${++n}`;
  };

  it('is one step smaller than the regular board', () => {
    const r = mulberry(1);
    expect(planGreenBoard(3, r)).toMatchObject({ cols: 4, pairs: 7 });
    expect(planGreenBoard(4, r)).toMatchObject({ cols: 4, pairs: 7 });
    expect(planGreenBoard(5, r)).toMatchObject({ cols: 5, pairs: 11 });
    expect(planGreenBoard(8, r)).toMatchObject({ cols: 5, pairs: 11 });
  });

  it('deals half N4 and half N3 frames, no frame or key word twice, a quarter hard pairs from N3', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const size of [4, 5]) {
        const plan = planForSize(size, mulberry(seed));
        const b = buildGreenBoard(plan, 'family', () => 0, mulberry(seed), newId());
        expect(b.cards.length).toBe(size * size);
        expect(b.pairs.length).toBe(plan.pairs);
        const frames = b.pairs.map((p) => p.gist!.frame);
        expect(new Set(frames).size).toBe(frames.length);
        const n3 = b.pairs.filter((p) => p.gist!.level === 'n3').length;
        expect(Math.abs(n3 * 2 - plan.pairs)).toBeLessThanOrEqual(1);
        const gists = b.pairs.map((p) => GIST_BY_ID.get(p.gist!.id)!);
        expect(new Set(gists.map((g) => g.anchorEn)).size).toBe(gists.length);
        const hard = b.pairs.filter((p) => p.gist!.hard);
        expect(hard.length).toBe(Math.round(plan.pairs / 4));
        for (const p of hard) expect(p.gist!.level).toBe('n3');
        expect(gists.some((g) => g.audience === 'cheeky')).toBe(false);
        for (const p of b.pairs) {
          const cards = b.cards.filter((c) => c.pairId === p.id);
          expect(cards.map((c) => c.face.kind).sort()).toEqual(['chunk', 'gist']);
        }
      }
    }
  });

  it('deals Kids gists only in a Kids room, and a few Cheeky ones in a Cheeky room', () => {
    expect(gistPool('kids').every((g) => g.audience === 'kids')).toBe(true);
    let cheekySeen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const kids = buildGreenBoard(planForSize(5, mulberry(seed)), 'kids', () => 0, mulberry(seed), newId());
      expect(kids.pairs.length).toBe(11);
      expect(kids.pairs.every((p) => GIST_BY_ID.get(p.gist!.id)!.audience === 'kids')).toBe(true);
      for (const size of [4, 5]) {
        const b = buildGreenBoard(planForSize(size, mulberry(seed)), 'cheeky', () => 0, mulberry(seed), newId());
        const n = b.pairs.filter((p) => GIST_BY_ID.get(p.gist!.id)!.audience === 'cheeky').length;
        expect(n).toBeLessThanOrEqual(size === 4 ? 2 : 3);
        cheekySeen += n;
      }
    }
    expect(cheekySeen).toBeGreaterThan(60);
  });

  it('aims the deal at frames least said', () => {
    const said = new Set<string>(['ta-koto', 'te-shimau', 'potential', 'sou-look', 'furi', 'hazu-datta', 'zu-ni', 'you-to-suru']);
    const b = buildGreenBoard(planForSize(4, mulberry(3)), 'family', (f) => (said.has(f) ? 5 : 0), mulberry(3), newId());
    expect(b.pairs.filter((p) => said.has(p.gist!.frame))).toEqual([]);
  });
});

// ---- a game ----

describe('Frame Concentration: the game', () => {
  it('rides only in the Green Car; a regular room plays Kotoba Concentration as before', () => {
    const regular = new Table(['n5', 'n4', 'n4']);
    regular.start();
    expect(regular.st.green).toBeUndefined();
    expect(regular.view().green).toBeUndefined();
    expect(regular.st.pairs.every((p) => p.kind !== 'frame')).toBe(true);
    expect(concentrationMode.duration(regular.st, 'reveal', { player: () => undefined } as never)).toBe(DURATIONS.claim);

    const green = new Table(['n3', 'n4', 'n3']);
    green.start();
    expect(green.s.greenCarOn).toBe(true);
    expect(green.st.green).toBeDefined();
    expect(green.view().green).toBe(true);
    expect(green.st.cols).toBe(4);
    expect(green.st.pairs.every((p) => p.kind === 'frame')).toBe(true);
    expect(concentrationMode.duration(green.st, 'reveal', { player: () => undefined } as never)).toBe(GREEN_DURATIONS.claim);
    expect(GREEN_DURATIONS.claim).toBe(10_000);
  });

  it('keeps a pair said in your own words; the TV and Fude only ever get the model line', () => {
    const t = new Table(['n3', 'n3', 'n3']);
    t.start();
    const { player, cells, pair, gist } = t.toClaim((p) => !p.gist!.hard);
    const chunkCell = cells.find((i) => t.st.cards[i]!.face.kind === 'chunk')!;
    // The chunk card turns away; the gist stays; no model sentence yet.
    expect(t.view().cells[chunkCell]).toEqual({ state: 'up', masked: true });
    expect(t.view().claim?.word).toBeNull();
    expect(t.view().claim?.cue).toMatchObject({ kind: 'gist', pic: gist.pic, text: gist.en });
    const mine = `そうそう、${gist.model.kana}`;
    t.cues = [];
    expect(t.say(player, mine).error).toBeUndefined();
    expect(t.st.claim?.winnerId).toBe(player);
    expect(t.s.players.find((p) => p.id === player)!.score).toBe(PAIR_POINTS + SPOKEN_BONUS);
    // The player's own sentence goes in their phrasebook, from memory.
    expect(t.s.phrasebook[player]?.at(-1)).toMatchObject({ itemId: pair.word.id, text: mine, outcome: 'said', recall: 'memory' });
    // Fude reacts to the model line, never the transcript.
    const keep = t.cues.find((c) => c.event === 'concentration_keep')!;
    expect(keep.answer).toBe(gist.model.text);
    // The chorus window stays open for the others; the TV never shows what was heard.
    expect(t.s.phase).toBe('reveal');
    expect(JSON.stringify(t.view('stage'))).not.toContain('そうそう');
    expect(JSON.stringify(t.view(player))).toContain('そうそう');
    const others = ['p1', 'p2', 'p3'].filter((p) => p !== player);
    for (const o of others) expect(t.view(o).mine?.green?.chorus).toBe(true);
    expect(t.say(others[0]!, gist.model.kana).error).toBeUndefined();
    expect(t.s.players.find((p) => p.id === others[0])!.score).toBe(GREEN_POINTS.chorus);
    expect(t.view().claim?.chorus).toEqual([others[0]]);
    expect(t.say(others[1]!, 'えっと').error).toBeUndefined();
    expect(t.view(others[1]!).mine?.last?.tip).toEqual({ frame: false, anchor: false });
    expect(t.say(others[1]!, 'えっと ですね').error).toBeUndefined();
    // Everyone is done: on to the result, which shows the model.
    expect(t.s.phase).toBe('score');
    expect(t.view().result?.word).toEqual(gist.model);
    expect(t.view().claim?.word).toEqual(gist.model);
    expect(JSON.stringify(t.view('stage'))).not.toContain('そうそう');
  });

  it('no say during the peek (the chunk is still up), and a miss gives a tip, then a steal', () => {
    const t = new Table(['n3', 'n3', 'n3'], 11);
    t.start();
    const player = t.turnPlayer;
    const cells = t.pairCells((p) => !p.gist!.hard);
    t.play(player, { kind: 'flip', cell: cells[0] });
    t.play(player, { kind: 'flip', cell: cells[1] });
    expect(t.s.phase).toBe('prompt');
    const { gist } = t.gistAt(cells[0]);
    expect(t.say(player, gist.model.kana).error).toBe('wrong-phase');
    t.timeout();
    const frameOnly = `${FRAME_BY_ID[gist.frame].example.ja}`;
    t.say(player, frameOnly);
    const last = t.view(player).mine?.last;
    expect(last?.ok).toBe(false);
    expect(t.view(player).mine?.green?.anchorEn).toBe(gist.anchorEn);
    t.say(player, 'えっと');
    // The others chorus-miss too (or sit it out), then the steal opens.
    t.timeout();
    expect(t.s.phase).toBe('encore');
    const [a, b] = ['p1', 'p2', 'p3'].filter((p) => p !== player) as [string, string];
    expect(t.view(a).mine?.canSay).toBe(true);
    expect(t.say(player, gist.model.kana).error).toBe('wrong-phase');
    expect(t.say(a, gist.model.kana).error).toBeUndefined();
    expect(t.s.phase).toBe('score');
    expect(t.view().result).toMatchObject({ kind: 'stolen', playerId: a, word: gist.model });
    expect(t.st.tally[a]).toMatchObject({ steals: 1, pairs: 1 });
    expect(t.s.phrasebook[a]?.at(-1)).toMatchObject({ text: gist.model.kana, recall: 'memory' });
    expect(t.s.phrasebook[player]?.at(-1)).toMatchObject({ outcome: 'missed', text: gist.model.text });
    void b;
  });

  it("tiles score 100 and log read; a steal that repeats someone else's words logs read", () => {
    const t = new Table(['n3', 'n3', 'n3'], 5);
    t.start();
    const { player, gist } = t.toClaim((p) => !p.gist!.hard);
    t.say(player, 'えっと');
    t.say(player, 'あのう');
    t.timeout();
    expect(t.s.phase).toBe('encore');
    const [a] = ['p1', 'p2', 'p3'].filter((p) => p !== player) as [string];
    const tiles = t.view(a).mine?.green?.tiles ?? [];
    for (const w of modelWords(gist.model)) expect(tiles).toContain(w);
    expect(tiles.length).toBe(modelWords(gist.model).length + 2);
    expect(t.say(a, `${modelWords(gist.model).join(' ')}。`, 'tap').error).toBeUndefined();
    expect(t.st.tally[a]!.points).toBe(GREEN_POINTS.tiles);
    expect(t.s.phrasebook[a]?.at(-1)).toMatchObject({ recall: 'read' });

    const u = new Table(['n3', 'n3', 'n3'], 5);
    u.start();
    const c = u.toClaim((p) => !p.gist!.hard);
    const [x, y] = ['p1', 'p2', 'p3'].filter((p) => p !== c.player) as [string, string];
    const line = `じつは ${c.gist.model.kana}`;
    u.say(c.player, 'えっと');
    u.say(c.player, 'あのう');
    expect(u.say(y, line).error).toBeUndefined(); // y's chorus: own words, from memory
    expect(u.s.phrasebook[y]?.at(-1)).toMatchObject({ text: line, recall: 'memory' });
    u.say(x, 'えっと');
    u.say(x, 'あのう');
    expect(u.s.phase).toBe('encore');
    expect(u.say(x, line).error).toBeUndefined(); // the steal: y's words, heard in the room
    expect(u.view().result).toMatchObject({ kind: 'stolen', playerId: x });
    expect(u.s.phrasebook[x]?.at(-1)).toMatchObject({ recall: 'read' });
    expect(u.st.green!.lines[x]?.at(-1)).toMatchObject({ ok: true, memory: false, how: 'steal' });
  });

  it('hard pairs: picture only for an N3 flipper, English back and +20 stretch for an N4 flipper', () => {
    let tested = false;
    for (let seed = 1; seed < 40 && !tested; seed++) {
      const t = new Table(['n4', 'n3'], seed);
      t.start();
      if (t.turnPlayer !== 'p1' || !t.st.pairs.some((p) => p.gist!.hard)) continue;
      const { cells, gist } = t.toClaim((p) => p.gist!.hard);
      expect(t.view().claim?.cue.text).toBe(gist.en);
      expect(t.view('p1').mine?.green?.stretch).toBe(true);
      expect(t.say('p1', gist.model.kana).error).toBeUndefined();
      expect(t.st.tally.p1!.points).toBe(GREEN_POINTS.hard + SPOKEN_BONUS + GREEN_POINTS.stretch);
      void cells;
      tested = true;
    }
    expect(tested).toBe(true);
    for (let seed = 1; seed < 40; seed++) {
      const t = new Table(['n3', 'n4'], seed);
      t.start();
      if (t.turnPlayer !== 'p1' || !t.st.pairs.some((p) => p.gist!.hard)) continue;
      const { gist } = t.toClaim((p) => p.gist!.hard);
      expect(t.view().claim?.cue).toMatchObject({ kind: 'gist', pic: gist.pic, text: '' });
      return;
    }
    throw new Error('no N3 hard pair found');
  });

  it('a Kids room turns away Kids-list words before they cost a try', () => {
    const t = new Table(['n3', 'n4'], 3, 'kids');
    t.start();
    expect(t.st.pairs.every((p) => GIST_BY_ID.get(p.gist!.id)!.audience === 'kids')).toBe(true);
    const { player } = t.toClaim();
    expect(t.say(player, 'ビールを のんだ', 'typed').error).toBe('kids-words');
    expect(t.view(player).mine?.attemptsLeft).toBe(2);
  });

  it('clears the board with perfect play and gives the Own Words award', () => {
    const t = new Table(['n3', 'n4', 'n3', 'n4'], 9);
    t.start();
    for (let guard = 0; guard < 600 && t.s.phase !== 'recap'; guard++) {
      if (t.s.phase === 'answer' && t.st.pairs.some((p) => !p.cleared)) {
        const cells = t.pairCells();
        t.play(t.turnPlayer, { kind: 'flip', cell: cells[0] });
        t.play(t.turnPlayer, { kind: 'flip', cell: cells[1] });
      } else if (t.s.phase === 'reveal' && !t.st.claim!.winnerId) {
        const { gist } = t.gistAt(t.st.claim!.cells[0]);
        t.say(t.st.claim!.claimerId, `${BOT_OPENERS[t.st.turnNo % BOT_OPENERS.length]}${gist.model.kana}`);
      } else t.timeout();
    }
    expect(t.s.phase).toBe('recap');
    expect(t.st.pairs.every((p) => p.ownerId)).toBe(true);
    const total = t.s.players.reduce((n, p) => n + p.score, 0);
    expect((t.st.pairs.length * SPOKEN_BONUS) / total).toBeLessThanOrEqual(0.3);
    expect(t.s.recap?.awards.some((a) => a.title === 'じぶんの ことば賞')).toBe(true);
    expect(Object.values(t.st.green!.said).some((m) => Object.keys(m).length > 0)).toBe(true);
  });

  it('runs to the finale on timeouts alone', () => {
    const t = new Table(['n3', 'n4'], 13);
    t.start();
    for (let i = 0; i < 2_000 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
  });
});

// ---- bots through the real server ----

describe('Frame Concentration: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 20, prompt: 40, answer: 600, reveal: 400, encore: 300, score: 30, finale: 30 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('4 N4/N3 bots play Frame Concentration with varied sentences', async () => {
    const { baseUrl, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    let finished = false;
    let lastGame: ConcentrationView | null = null;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 4,
      roundsPerGame: 1,
      totalRounds: 1_000,
      mode: 'concentration',
      games: 1,
      onDone: () => (finished = true),
      onState: (view: RoomView) => {
        if (view.game?.mode === 'concentration') lastGame = view.game;
      },
    });
    director.start();
    const policy = concentrationPolicy({ delayMs: [5, 30], quiet: (id) => id.endsWith('4') });
    const bots: Bot[] = [];
    for (let i = 1; i <= 4; i++) bots.push(await Bot.join({ baseUrl, code: created.code, name: `bot${i}`, policy, level: i % 2 ? 'n3' : 'n4' }));
    await until(() => finished, 60_000, 'one game');
    const game = lastGame as ConcentrationView | null;
    expect(game?.green).toBe(true);
    expect(game!.tally.reduce((n, t) => n + t.pairs, 0)).toBeGreaterThan(3);
    const said = Object.values(room.state.phrasebook).flat().filter((e) => e.outcome === 'said');
    expect(new Set(said.map((e) => e.text)).size).toBeGreaterThan(4);
    const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase' && m.error !== 'already-solved' && m.error !== 'no-tries-left'));
    expect(bad).toEqual([]);
    for (const b of bots) b.stop();
    director.client.close();
  });
});
