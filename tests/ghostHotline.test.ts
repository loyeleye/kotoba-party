import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { callsFor, heardAny, lineOf, MAX_ADVISERS, POINTS, REACT_LOCK_MS, REACT_MS, RECORD_MS, type HotlineState, type HotlineView } from '../shared/src/modes/ghostHotline/hotline.js';
import { ADVICE, adviceOf, betTilesOf, CHUNKS, kanaTilesOf, PROBLEMS, problemOf } from '../shared/src/modes/ghostHotline/problems.js';
import { phraseFrames } from '../shared/src/progress.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { ghostHotlinePolicy } from '../tools/bots/policies/ghostHotline.js';
import { content as REAL_CONTENT } from './helpers.js';

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
  play(player: string, move: Record<string, unknown>) {
    return this.cmd(player, { type: 'play', move: { round: this.st.round, ...move } });
  }
  /** The next timed event: a wake inside the phase, or the phase's deadline. */
  tick() {
    const w = wakeAt(this.s, this.ctx());
    const d = this.s.deadline;
    if (w !== null && (d === null || w < d)) {
      this.now = Math.max(this.now, w);
      return this.act({ type: 'wake', phaseSeq: this.s.phaseSeq });
    }
    this.now = Math.max(this.now, d ?? this.now);
    return this.act({ type: 'timeout', phaseSeq: this.s.phaseSeq });
  }
  /** The phase, unnarrowed (loops below compare it after the game moves on). */
  get phase(): string {
    return this.s.phase;
  }
  get st(): HotlineState {
    return this.s.modeState as HotlineState;
  }
  get c() {
    return this.st.calls[this.st.round - 1]!;
  }
  room(viewer: string | 'stage' = 'stage'): RoomView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT);
  }
  view(viewer: string | 'stage' = 'stage'): HotlineView {
    return this.room(viewer).game as HotlineView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(extra?: Record<string, unknown>) {
    expect(this.cmd('stage', { type: 'start', mode: 'ghost-hotline', ...(extra ? { extra } : {}) }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.tick();
    expect(this.s.phase).toBe('prompt');
  }
  /** Plays to the recap, letting bots move at every beat, and returns how long the game took. */
  playOut(bots = true, guard = 2000): number {
    const t0 = this.now;
    const policy = ghostHotlinePolicy({ thinkMs: 0 });
    for (let i = 0; i < guard && this.s.phase !== 'recap'; i++) {
      if (bots) {
        for (let pass = 0; pass < 3; pass++) {
          const before = this.s.phaseSeq;
          for (const p of this.s.players) {
            for (const a of policy.act(this.room(p.id), p.id)) this.cmd(p.id, { type: 'play', move: a.move });
            if (this.s.phaseSeq !== before) break;
          }
          if (this.s.phaseSeq !== before) break;
        }
      }
      if (this.phase !== 'recap') this.tick();
    }
    expect(this.phase).toBe('recap');
    return this.now - t0;
  }
}


const problem = (t: Table) => problemOf(t.c.problemId)!;

/** Plays the current call to its plan beat. */
function toPlan(t: Table) {
  if (t.c.step === 'ring') t.tick();
  expect(t.c.step).toBe('plan');
}

/** Every adviser in, then on to the reveal. `advise` decides each adviser's move. */
function adviseAll(t: Table, advise: (id: string, level: Level) => Record<string, unknown> | null) {
  toPlan(t);
  const c = t.c;
  for (const id of c.advisers) {
    const level = t.s.players.find((p) => p.id === id)!.level;
    if (level === 'kana') {
      const m = advise(id, level);
      if (m) expect(t.play(id, m).error).toBeUndefined();
    } else t.play(id, { kind: 'ready' });
  }
  if (t.s.phase === 'prompt') t.tick();
  expect(t.s.phase).toBe('answer');
  for (const id of c.advisers) {
    const level = t.s.players.find((p) => p.id === id)!.level;
    if (level === 'kana' || c.advice[id]) continue;
    const m = advise(id, level);
    if (m) expect(t.play(id, m).error, id).toBeUndefined();
  }
  while (t.s.phase === 'answer') t.tick();
  expect(t.s.phase).toBe('reveal');
}

const clip = (said: string, checked = true) => ({ kind: 'advice', type: 'clip', clipId: 'c1', durMs: 3000, checked, heard: { via: 'speech', text: said, reading: said } });

// ---- content ----

describe('Ghost Advice Hotline: content', () => {
  it('has sixteen calls, each with five different tiles that exist, and lines that give the cure', () => {
    expect(PROBLEMS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(PROBLEMS.map((p) => p.id)).size).toBe(PROBLEMS.length);
    expect(new Set(ADVICE.map((a) => a.id)).size).toBe(ADVICE.length);
    for (const p of PROBLEMS) {
      const tiles = [p.cure, p.near, ...p.decoys, p.curve];
      expect(new Set(tiles).size, p.id).toBe(5);
      for (const id of tiles) expect(adviceOf(id), `${p.id} ${id}`).toBeTruthy();
      expect(kanaTilesOf(p), p.id).toContain(p.cure);
      expect(betTilesOf(p), p.id).toContain(p.cure);
      for (const level of ['n5', 'n4'] as const) {
        const line = lineOf(p, level);
        expect(heardAny(line.model.kana, adviceOf(p.cure)!.keys), `${p.id} ${level}: ${line.model.kana}`).toBe(true);
        expect(line.mission, `${p.id} ${level}`).not.toMatch(/〜|＿|te-form|grammar/i);
      }
      expect(p.advice.n5.frame?.kana, p.id).toContain('＿＿');
      // Every N4 model uses a chunk the booth can credit.
      expect(CHUNKS.some((k) => k.level === 'n4' && heardAny(p.advice.n4.model.kana, k.keys)), p.id).toBe(true);
      for (const level of ['kana', 'n5', 'n4'] as const) expect(p.line[level].kana, `${p.id} ${level}`).toBeTruthy();
    }
    // A cure's keys never fire on the call's other tiles.
    for (const p of PROBLEMS) for (const id of [p.near, ...p.decoys, p.curve]) expect(heardAny(adviceOf(id)!.word.kana, adviceOf(p.cure)!.keys), `${p.id}: ${id}`).toBe(false);
  });

  it('has a picture for every tile and caller once the art lands', () => {
    const dir = new URL('../stage/assets/hotline/', import.meta.url);
    if (!existsSync(dir)) return;
    for (const a of ADVICE) expect(existsSync(new URL(`${a.picture}.png`, dir)), a.picture).toBe(true);
    for (const p of PROBLEMS) expect(existsSync(new URL(`${p.caller.picture}.png`, dir)), p.caller.picture).toBe(true);
  });
});

// ---- rules ----

describe('Ghost Advice Hotline: roles', () => {
  it('everyone calls the same number of times, with at most three advisers, for 3 to 8 players', () => {
    for (let n = 3; n <= 8; n++) {
      const t = new Table(n, [], n);
      t.start();
      t.playOut();
      expect(t.st.calls.length, `${n}`).toBe(callsFor(n));
      const calls = new Map<string, number>();
      for (const c of t.st.calls) {
        calls.set(c.caller!, (calls.get(c.caller!) ?? 0) + 1);
        expect(c.advisers.length).toBeLessThanOrEqual(MAX_ADVISERS);
        expect(c.advisers).not.toContain(c.caller);
        expect(c.gallery).not.toContain(c.caller);
      }
      expect(calls.size, `${n}`).toBe(n);
      expect(new Set(calls.values()).size, `${n}: ${[...calls.values()]}`).toBe(1);
    }
  });

  it('two players both advise a scripted yōkai, and there is no laugh vote', () => {
    const t = new Table(2, [], 4);
    t.start();
    expect(t.st.scripted).toBe(true);
    expect(t.c.caller).toBeNull();
    expect(t.c.advisers.length).toBe(2);
    t.playOut();
    expect(t.st.ledger.some((e) => e.why === 'laugh')).toBe(false);
  });
});

describe('Ghost Advice Hotline: scoring', () => {
  it('the ledger adds up to every score', () => {
    for (const n of [3, 5, 8]) {
      const t = new Table(n, ['kana', 'n5', 'n4', 'n5', 'n4', 'kana', 'n5', 'n4'], 30 + n);
      t.start();
      t.playOut();
      for (const p of t.s.players) {
        const sum = t.st.ledger.filter((e) => e.playerId === p.id).reduce((a, e) => a + e.points, 0);
        expect(sum, `${n} ${p.id}`).toBe(p.score);
      }
      expect(t.st.ledger.some((e) => e.points > 0)).toBe(true);
    }
  });

  it('locks the caller’s reaction at 3 s but holds the beat so a last-second tap gets its reveal', () => {
    const t = new Table(4, ['n5', 'n5', 'n5', 'n5'], 1);
    t.start();
    const c = t.c;
    t.play(c.caller!, { kind: 'say', clipId: 'line1' });
    toPlan(t);
    adviseAll(t, () => clip('えっと…'));
    while (t.s.phase === 'reveal' && t.c.step === 'play') t.tick();
    expect(t.c.step).toBe('react');
    const at = t.c.stepAt;
    t.now = at + REACT_LOCK_MS + 1;
    expect(t.play(c.caller!, { kind: 'react', index: t.c.at, reaction: 'soreda' }).error).toBe('too-late');
    t.now = at + REACT_LOCK_MS - 1;
    expect(t.play(c.caller!, { kind: 'react', index: t.c.at, reaction: 'soreda' }).error).toBeUndefined();
    expect(REACT_MS - REACT_LOCK_MS).toBeGreaterThanOrEqual(650);
  });

  it('pays それだ, おしい, laughs, a sweep, the right bet and the caller’s line', () => {
    const t = new Table(6, ['n5', 'n5', 'n5', 'n5', 'n5', 'n5'], 2);
    t.start();
    const c = t.c;
    const p = problem(t);
    expect(t.play(c.caller!, { kind: 'say', clipId: 'line1' }).error).toBeUndefined();
    toPlan(t);
    for (const g of c.gallery) t.play(g, { kind: 'bet', tileId: p.cure });
    const [a1, a2, a3] = c.advisers;
    const cure = lineOf(p, 'n5').model.kana;
    adviseAll(t, (id) => (id === a3 ? clip('えっと…') : clip(cure)));
    // The caller reacts to each advice as it plays.
    while (t.s.phase === 'reveal' && t.c.step !== 'secret') {
      const now = t.c.order[t.c.at]!;
      if (t.c.step === 'play' && !t.c.reactions[now]) expect(t.play(c.caller!, { kind: 'react', index: t.c.at, reaction: now === a1 ? 'soreda' : now === a2 ? 'oshii' : 'chigau' }).error).toBeUndefined();
      t.tick();
    }
    while (t.s.phase === 'reveal') t.tick();
    expect(t.s.phase).toBe('encore');
    for (const pl of t.s.players) if (pl.id !== a1) t.play(pl.id, { kind: 'vote', playerId: a1 });
    // An adviser can't vote for themselves.
    expect(t.play(a1!, { kind: 'vote', playerId: a1 }).error).toBe('bad-move');
    t.play(a1!, { kind: 'vote', playerId: a2 });
    expect(t.s.phase).toBe('score');
    const got = (id: string, why: string) => t.st.ledger.filter((e) => e.round === c.index && e.playerId === id && e.why === why).reduce((a, e) => a + e.points, 0);
    expect(got(a1!, 'soreda')).toBe(POINTS.soreda);
    expect(got(a2!, 'oshii')).toBe(POINTS.oshii);
    expect(got(a3!, 'soreda') + got(a3!, 'oshii')).toBe(0);
    expect(got(a1!, 'laugh')).toBe(5 * POINTS.laugh);
    // Every vote but their own is a sweep (they can't vote for themselves).
    expect(got(a1!, 'sweep')).toBe(POINTS.sweep);
    // Speaking pays: a1 and a2 named advice in their own clips; a3's "えっと…" didn't.
    expect(got(a1!, 'spoke')).toBe(POINTS.spoke);
    expect(got(a2!, 'spoke')).toBe(POINTS.spoke);
    expect(got(a3!, 'spoke')).toBe(0);
    for (const g of c.gallery) expect(got(g, 'bet')).toBe(POINTS.bet);
    expect(got(c.caller!, 'line')).toBe(POINTS.line);
    expect(t.view('stage').secret!.fair).toBe(true);
    expect(t.view(a1!).me!.breakdown.map((b) => b.why).sort()).toEqual(['laugh', 'soreda', 'spoke', 'sweep']);
  });

  it('a Kana adviser’s tile is marked by the game, and the caller can’t overrule it', () => {
    const t = new Table(4, ['n5', 'kana', 'kana', 'kana'], 6);
    t.start();
    // Find a call where Kana advisers pick.
    const c = t.c;
    const p = problem(t);
    const kana = c.advisers.filter((id) => t.s.players.find((x) => x.id === id)!.level === 'kana');
    adviseAll(t, (id) => (kana.includes(id) ? { kind: 'pick', tileId: id === kana[0] ? p.cure : p.curve } : clip(lineOf(p, 'n5').model.kana)));
    while (t.s.phase === 'reveal') {
      const now = t.c.order[t.c.at]!;
      if (c.caller && kana.includes(now) && t.c.step === 'play') expect(t.play(c.caller, { kind: 'react', index: t.c.at, reaction: 'chigau' }).error).toBe('game-marks-it');
      t.tick();
    }
    if (kana[0]) expect(t.c.reactions[kana[0]]).toBe('soreda');
    if (kana[1]) expect(t.c.reactions[kana[1]]).toBe('chigau');
  });

  it('a mic pass is once a game and earns half; a free read when the mic is blocked doesn’t use it', () => {
    const t = new Table(3, ['n5', 'n5', 'n5'], 9);
    t.start();
    toPlan(t);
    const [a1, a2] = t.c.advisers;
    expect(t.play(a1!, { kind: 'pass' }).error).toBeUndefined();
    expect(t.play(a2!, { kind: 'pass', free: true }).error).toBeUndefined();
    expect(t.st.micPassUsed[a2!]).toBeFalsy();
    while (t.s.phase !== 'score') t.tick();
    // The scripted judge (no tap from the caller) hears Nobiko-san give the cure.
    expect(t.st.ledger.filter((e) => e.playerId === a1 && e.why === 'soreda').reduce((a, e) => a + e.points, 0)).toBe(POINTS.soreda / 2);
    // A pass never opens the booth.
    expect(t.c.booth).toBeNull();
    while ((t.s.phase as string) !== 'prompt') t.tick();
    toPlan(t);
    if (t.c.advisers.includes(a1!)) expect(t.play(a1!, { kind: 'pass' }).error).toBe('no-pass-left');
  });
});

describe('Ghost Advice Hotline: secrets', () => {
  it('only the caller sees the secret before the secret beat, and the TV never shows spoken advice while it plays', () => {
    const t = new Table(5, ['kana', 'n5', 'n4', 'n5', 'n4'], 5);
    t.start();
    const policy = ghostHotlinePolicy({ thinkMs: 0 });
    for (let guard = 0; guard < 600 && t.s.phase !== 'recap'; guard++) {
      const c = t.c;
      const p = problem(t);
      const early = t.s.phase === 'prompt' || t.s.phase === 'answer' || (t.s.phase === 'reveal' && c.step !== 'secret');
      if (early) {
        const stage = t.view('stage');
        expect(stage.secret).toBeNull();
        expect(JSON.stringify(stage)).not.toContain(p.secret.kana);
        for (const pl of t.s.players) if (pl.id !== c.caller) expect(t.view(pl.id).me!.secret).toBeNull();
      }
      if (t.s.phase === 'reveal' && c.step === 'play') {
        const play = t.view('stage').play!;
        if (play.kind !== 'tile') expect(play.tile).toBeNull();
        expect(t.view('stage').rows.some((r) => r.playerId === play.playerId)).toBe(false);
      }
      for (const pl of t.s.players) for (const a of policy.act(t.room(pl.id), pl.id)) t.cmd(pl.id, { type: 'play', move: a.move });
      if (t.phase !== 'recap') t.tick();
    }
    expect(t.phase).toBe('recap');
  });

  it('bets and Kana picks lock when the plan beat ends (all-Kana calls skip the recording)', () => {
    const t = new Table(6, ['kana', 'kana', 'kana', 'kana', 'kana', 'kana'], 3);
    t.start();
    toPlan(t);
    const c = t.c;
    const p = problem(t);
    for (const id of c.advisers) t.play(id, { kind: 'pick', tileId: p.near });
    expect(t.s.phase).not.toBe('prompt');
    expect(t.play(c.gallery[0]!, { kind: 'bet', tileId: p.cure }).error).toBe('wrong-phase');
    expect(t.play(c.advisers[0]!, { kind: 'pick', tileId: p.cure }).error).toBe('wrong-phase');
  });
});

describe('Ghost Advice Hotline: the learning path', () => {
  it('an adviser’s own clip that gives advice counts as said from memory; the hint makes it read; Nobiko-san’s reading is seen', () => {
    const t = new Table(4, ['n4', 'n4', 'n4', 'n4'], 7);
    t.start();
    toPlan(t);
    const c = t.c;
    const p = problem(t);
    const [a1, a2, a3] = c.advisers;
    t.play(a2!, { kind: 'hint' });
    t.play(a3!, { kind: 'pass' });
    const model = lineOf(p, 'n4').model.kana;
    adviseAll(t, (id) => (id === a3 ? null : clip(model)));
    while (t.s.phase !== 'score') t.tick();
    const entry = (id: string) => t.s.phrasebook[id]!.find((e) => e.itemId === `hotline:${p.id}:n4`)!;
    expect(entry(a1!)).toMatchObject({ outcome: 'said', recall: 'memory' });
    expect(entry(a2!)).toMatchObject({ outcome: 'said', recall: 'read' });
    expect(entry(a3!)).toMatchObject({ outcome: 'seen', recall: 'read' });
    // The booth credits an adviser's own words.
    expect(c.booth).not.toBeNull();
    expect([a1, a2]).toContain(c.booth!.playerId);
    expect(t.view(a1!).me!.note!.chunk).not.toBeNull();
    expect(t.view(a1!).me!.note!.credit).toBe('memory');
    expect(t.view(a2!).me!.note!.credit).toBe('hint');
  });

  it('only credits the level line when their own clip used its pattern', () => {
    const t = new Table(4, ['n4', 'n4', 'n4', 'n4'], 11);
    t.start();
    toPlan(t);
    const c = t.c;
    const p = problem(t);
    const [a1, a2, a3] = c.advisers;
    const cure = adviceOf(p.cure)!.word.kana;
    // a1: the cure, bare (no ほうが いい / たら どうですか); a2: the N5 frame on an N4 call; a3: no speech-to-text.
    adviseAll(t, (id) => (id === a1 ? clip(cure.replace(/！$/, '')) : id === a2 ? clip(lineOf(p, 'n5').model.kana) : clip('', false)));
    while (t.s.phase !== 'score') t.tick();
    const entry = (id: string) => t.s.phrasebook[id]!.find((e) => e.itemId === `hotline:${p.id}:n4`)!;
    expect(entry(a1!)).toMatchObject({ outcome: 'seen' });
    expect(entry(a2!)).toMatchObject({ outcome: 'seen' });
    expect(entry(a3!)).toMatchObject({ outcome: 'said', recall: 'read' });
    // The note says exactly what was logged.
    expect(t.view(a1!).me!.note!.credit).toBe('seen');
    expect(t.view(a2!).me!.note!.credit).toBe('seen');
    expect(t.view(a3!).me!.note!.credit).toBe('unchecked');
    // Speaking still pays when the clip gave advice, or couldn't be checked.
    const spoke = (id: string) => t.st.ledger.filter((e) => e.playerId === id && e.why === 'spoke').length;
    expect(spoke(a1!)).toBe(1);
    expect(spoke(a3!)).toBe(1);
  });

  it('logs a line’s conditional (＿たら, 4.5) only when the adviser said one: ほうが いい alone credits hou-ga-ii, not tara', () => {
    const t = new Table(4, ['n4', 'n4', 'n4', 'n4'], 7);
    t.start();
    toPlan(t);
    const c = t.c;
    c.problemId = 'ittan';
    const p = problem(t);
    const n4 = lineOf(p, 'n4');
    expect(n4.plain).toBeTruthy();
    const [a1, a2, a3] = c.advisers;
    // a1: the advice without the conditional; a2: Nobiko-san's version, conditional and all; a3: あたらしい is not a たら.
    adviseAll(t, (id) => clip(id === a1 ? n4.plain!.kana : id === a2 ? n4.model.kana : 'あたらしい せんたくきで あらった ほうが いいですよ'));
    while (t.s.phase !== 'score') t.tick();
    const entry = (id: string) => t.s.phrasebook[id]!.find((e) => e.itemId === `hotline:${p.id}:n4`)!;
    for (const id of [a1!, a3!]) {
      expect(entry(id)).toMatchObject({ outcome: 'said', recall: 'memory', kana: n4.plain!.kana });
      expect(phraseFrames(entry(id))).toContain('hou-ga-ii');
      expect(phraseFrames(entry(id))).not.toContain('tara');
    }
    expect(entry(a2!)).toMatchObject({ outcome: 'said', recall: 'memory', kana: n4.model.kana });
    expect(phraseFrames(entry(a2!))).toContain('tara');
  });

  it('every conditional line has a plain version with the same advice and no conditional', () => {
    const withIf = PROBLEMS.filter((p) => p.advice.n4.plain);
    expect(withIf.length).toBe(6);
    for (const p of withIf) {
      const { model, plain } = p.advice.n4;
      expect(phraseFrames(model), p.id).toEqual(expect.arrayContaining(['tara', 'hou-ga-ii']));
      expect(phraseFrames(plain!), p.id).toContain('hou-ga-ii');
      expect(phraseFrames(plain!), p.id).not.toContain('tara');
      const tail = (x: string) => x.split('、').pop();
      expect(tail(plain!.kana), p.id).toBe(tail(model.kana));
    }
  });

  it('a VIP-hidden clip earns nothing and isn’t credited', () => {
    const t = new Table(4, ['n4', 'n4', 'n4', 'n4'], 13);
    t.start();
    toPlan(t);
    const c = t.c;
    const p = problem(t);
    const [a1] = c.advisers;
    adviseAll(t, () => clip(lineOf(p, 'n4').model.kana));
    const vip = { id: t.s.vipId! };
    while (t.s.phase !== 'reveal') t.tick();
    expect(t.play(vip.id, { kind: 'hide', playerId: a1 }).error).toBeUndefined();
    while ((t.s.phase as string) !== 'score') t.tick();
    expect(t.st.ledger.filter((e) => e.playerId === a1 && e.round === c.index).reduce((a, e) => a + e.points, 0)).toBe(0);
    expect(t.s.phrasebook[a1!]!.find((e) => e.itemId === `hotline:${p.id}:n4`)).toMatchObject({ outcome: 'seen' });
  });
});

describe('Ghost Advice Hotline: gists', () => {
  it('never name the cure: the gist is on every phone, so it only hints', () => {
    for (const p of PROBLEMS) {
      const g = p.gist.kana.replace(/[\s　、。！？]/g, '');
      expect(heardAny(g, adviceOf(p.cure)!.keys), p.id).toBe(false);
    }
  });
});

describe('Ghost Advice Hotline: chunks', () => {
  it('credit advice patterns only: not a comparison (クーラーの ほうが いい) or a conditional question (ねたら どうなりますか)', () => {
    const ho = CHUNKS.find((k) => k.id === 'hou')!;
    const ta = CHUNKS.find((k) => k.id === 'tara')!;
    expect(heardAny('くうらあのほうがいいです', ho.keys)).toBe(false);
    expect(heardAny('ねたほうがいいです', ho.keys)).toBe(true);
    expect(heardAny('ねたらどうなりますか', ta.keys)).toBe(false);
    expect(heardAny('ねたらどうですか', ta.keys)).toBe(true);
    // Every model at a level uses that level's chunk.
    for (const p of PROBLEMS) for (const lv of ['n5', 'n4'] as const) {
      const m = p.advice[lv].model.kana.replace(/[\s　、。！？「」]/g, '');
      expect(CHUNKS.some((k) => k.level === lv && heardAny(m, k.keys)), `${p.id} ${lv}`).toBe(true);
    }
  });
});

describe('Ghost Advice Hotline: if and when', () => {
  it('some N4 advice says when to do it (＿たら, 4.5), and why-not advice (＿たら どうですか) never counts as an if', () => {
    const n4 = PROBLEMS.map((p) => p.advice.n4.model);
    const ifs = n4.filter((m) => phraseFrames(m).includes('tara'));
    expect(ifs.length).toBeGreaterThanOrEqual(3);
    for (const m of ifs) expect(phraseFrames(m), m.kana).toContain('hou-ga-ii');
    for (const m of n4.filter((x) => phraseFrames(x).includes('tara-dou'))) expect(phraseFrames(m), m.kana).not.toContain('tara');
  });
});

describe('Ghost Advice Hotline: pacing', () => {
  it('an 8-player game takes 11.5 minutes or less, even when every clip uses its full time', () => {
    const t = new Table(8, ['n5', 'n4', 'kana', 'n5', 'n4', 'n5', 'n4', 'n5'], 8);
    t.start();
    const t0 = t.now - 12_000;
    for (let guard = 0; guard < 2000 && t.s.phase !== 'recap'; guard++) {
      if (t.s.phase === 'answer') {
        const c = t.c;
        const waiting = c.advisers.filter((id) => !c.advice[id] && t.s.players.find((p) => p.id === id)!.level !== 'kana');
        if (waiting.length) {
          t.now += RECORD_MS.n4;
          const model = lineOf(problem(t), 'n4').model.kana;
          for (const id of waiting) t.play(id, { ...clip(model), durMs: RECORD_MS.n4 + 500 });
          continue;
        }
      }
      t.tick();
    }
    expect(t.phase).toBe('recap');
    expect(t.now - t0).toBeLessThanOrEqual(11.5 * 60_000);
  });

  it('bots finish a game quicker than the timers alone', () => {
    const idle = new Table(5, [], 3);
    idle.start();
    const slow = idle.playOut(false);
    const busy = new Table(5, [], 3);
    busy.start();
    const fast = busy.playOut(true);
    expect(fast).toBeLessThan(slow);
  });
});
