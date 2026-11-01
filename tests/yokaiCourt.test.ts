import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import { hostLines } from '../content/src/hosts/index.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { ALL_FRAMES, framesOf } from '../shared/src/japanese/frames.js';
import { hasKanji } from '../shared/src/japanese/kana.js';
import { CASES, CHUNKS, CLUES, fill, kanaTilesOf, LINES, PLACES, slotsOf, TESTIMONIES, WITNESS, YOKAI, type Side } from '../shared/src/modes/yokaiCourt/cases.js';
import { CASE_MS, ASK_MS, TESTIFY_MS, PLAN_MS, POINTS, RECORD_MS, UPLOAD_MS, GRACE_MS, CHECK_MS, GIST_MS, VOTE_MS, VERDICT_MS, FUDE_PLAY_MS, roundsFor, type CourtState, type CourtView } from '../shared/src/modes/yokaiCourt/court.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { yokaiCourtPolicy } from '../tools/bots/policies/yokaiCourt.js';
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
  get phase(): string {
    return this.s.phase;
  }
  get st(): CourtState {
    return this.s.modeState as CourtState;
  }
  get c() {
    return this.st.cases[this.st.round - 1]!;
  }
  room(viewer: string | 'stage' = 'stage'): RoomView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT);
  }
  view(viewer: string | 'stage' = 'stage'): CourtView {
    return this.room(viewer).game as CourtView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  level(id: string): Level {
    return this.s.players.find((p) => p.id === id)!.level;
  }
  start() {
    expect(this.cmd('stage', { type: 'start', mode: 'yokai-court' }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.tick();
    expect(this.s.phase).toBe('prompt');
  }
  playOut(opts: { speak?: boolean } = {}, guard = 3000): number {
    const t0 = this.now;
    const policy = yokaiCourtPolicy({ thinkMs: 0, ...opts });
    for (let i = 0; i < guard && this.s.phase !== 'recap'; i++) {
      for (let pass = 0; pass < 3; pass++) {
        const before = this.s.phaseSeq;
        for (const p of this.s.players) {
          for (const a of policy.act(this.room(p.id), p.id)) this.cmd(p.id, { type: 'play', move: a.move });
          if (this.s.phaseSeq !== before) break;
        }
        if (this.s.phaseSeq !== before) break;
      }
      if (this.phase !== 'recap') this.tick();
    }
    expect(this.phase).toBe('recap');
    return this.now - t0;
  }
}

const clip = (said: string, checked = true) => ({ kind: 'argue', type: 'clip', clipId: `clip-${said.length}-${checked}`, durMs: 6000, checked, heard: checked ? { via: 'speech', text: said, reading: said } : null });

/** Plays to the witness's question, has them answer, then on to the plan beat. */
function toPlan(t: Table, testimony: string | null = 'saw') {
  expect(t.c.step).toBe('case');
  t.tick();
  expect(t.c.step).toBe('ask');
  if (testimony && t.c.witness) expect(t.play(t.c.witness, { kind: 'testify', testimony }).error).toBeUndefined();
  t.tick();
  expect(t.c.step).toBe('testify');
  t.tick();
  expect(t.c.step).toBe('plan');
}

/** Both lawyers argue (`argue` decides each one's move in the record beat), then on to the reveal. */
function argueAll(t: Table, argue: (id: string, side: Side) => Record<string, unknown> | null) {
  const c = t.c;
  for (const id of [c.pros, c.def]) if (t.level(id) !== 'kana') t.play(id, { kind: 'ready' });
  while (t.s.phase === 'prompt') t.tick();
  expect(t.s.phase).toBe('answer');
  for (const [id, side] of [[c.pros, 'pros'], [c.def, 'def']] as [string, Side][]) {
    const m = argue(id, side);
    if (m) expect(t.play(id, m).error, id).toBeUndefined();
  }
  while (t.s.phase === 'answer') t.tick();
  expect(t.s.phase).toBe('reveal');
}

/** On to the check, every judge answers, then the vote. */
function checkAndVote(t: Table, check: (id: string, answer: string) => string | null, vote: (id: string) => Side | null) {
  while (t.c.step === 'play') t.tick();
  expect(t.c.step).toBe('check');
  const answer = t.view(t.c.judges[0]!).verdict;
  expect(answer).toBeNull();
  const cs = CASES.find((x) => x.id === t.c.caseId)!;
  const right = t.c.checkSide === 'pros' ? cs.clue : cs.alibi;
  for (const id of t.c.judges) {
    const pick = check(id, right);
    if (pick) expect(t.play(id, { kind: 'check', thingId: pick }).error).toBeUndefined();
  }
  while (t.s.phase === 'reveal') t.tick();
  expect(t.s.phase).toBe('encore');
  t.tick();
  expect(t.c.step).toBe('vote');
  for (const id of t.c.judges) {
    const v = vote(id);
    if (v) expect(t.play(id, { kind: 'vote', side: v }).error).toBeUndefined();
  }
  while (t.s.phase === 'encore') t.tick();
  expect(t.s.phase).toBe('score');
}

const caseOf = (t: Table) => CASES.find((x) => x.id === t.c.caseId)!;
/** N3 frame ids that land with the progressive-learning work. TODO(n3): drop this once they're in frames.ts. */
const PENDING_N3 = new Set(['ni-chigainai', 'wake-dewa-nai']);
/** Frames framesOf only finds with kuromoji tokens (the server passes them; this test doesn't). */
const TOKEN_ONLY = new Set(['sou-hear']);

// ---- content ----

describe('Yōkai Court content', () => {
  it('has a picture for every yōkai, clue, place and case object', () => {
    const pics = [...YOKAI.map((y) => y.picture), ...CLUES.map((c) => c.picture), ...PLACES.map((p) => p.picture), ...CASES.map((c) => c.object.picture)];
    for (const p of pics) expect(existsSync(`stage/assets/${p}.png`), p).toBe(true);
  });

  it('fills every line with no slot left over, kana-only where it must be', () => {
    for (const cs of CASES)
      for (const t of TESTIMONIES) {
        const slots = slotsOf(cs, t);
        const w = fill(WITNESS[t], slots, true);
        expect(w.kana, `${cs.id} ${t}`).not.toMatch(/[{}[\]|]/);
        expect(hasKanji(w.kana)).toBe(false);
        for (const side of ['pros', 'def'] as Side[]) {
          for (const tile of kanaTilesOf(side, t)) {
            const line = fill(tile.tpl, slots, true);
            expect(hasKanji(line.text), `${cs.id} ${t} ${side} ${tile.id}`).toBe(false);
            expect(line.text + line.en).not.toMatch(/[{}[\]|]/);
          }
          expect(kanaTilesOf(side, t).filter((x) => x.evidence)).toHaveLength(1);
          for (const lv of ['n5', 'n4', 'n3'] as const) {
            const line = fill(LINES[side][t][lv], slots, lv === 'n5');
            expect(line.text + line.kana + line.en, `${cs.id} ${t} ${side} ${lv}`).not.toMatch(/[{}[\]|]/);
            if (lv === 'n5') expect(hasKanji(line.text)).toBe(false);
          }
        }
      }
  });

  it('tags each level line with frames it really uses', () => {
    const known = new Set(ALL_FRAMES.map((f) => f.id as string));
    for (const cs of CASES)
      for (const t of TESTIMONIES)
        for (const side of ['pros', 'def'] as Side[])
          for (const lv of ['n5', 'n4', 'n3'] as const) {
            const tpl = LINES[side][t][lv];
            const line = fill(tpl, slotsOf(cs, t), lv === 'n5');
            const got = framesOf(line, undefined, { keepHidden: true }) as string[];
            for (const f of tpl.frames ?? []) {
              if (PENDING_N3.has(f)) continue;
              expect(known.has(f), f).toBe(true);
              if (TOKEN_ONLY.has(f)) continue;
              expect(got, `${cs.id} ${t} ${side} ${lv}: ${line.kana}`).toContain(f);
            }
          }
  });

  it('says each level line with one of its own level’s chunks, so the booth and the path can credit it', () => {
    for (const cs of CASES)
      for (const t of TESTIMONIES)
        for (const side of ['pros', 'def'] as Side[])
          for (const lv of ['n5', 'n4', 'n3'] as const) {
            const line = fill(LINES[side][t][lv], slotsOf(cs, t), lv === 'n5');
            const said = line.kana.replace(/[\s、。！？]/g, '');
            const k = CHUNKS.find((x) => x.keys.some((key) => said.includes(key)));
            expect(k?.level, `${cs.id} ${t} ${side} ${lv}: ${line.kana}`).toBe(lv);
          }
  });

  it('gives every event the mode cues at least one Fude-san line', () => {
    const events = ['court_intro', 'court_case', 'court_ask', 'court_testimony', 'court_curveball', 'court_plan', 'court_read', 'court_mic_pass', 'court_stand_in', 'court_check', 'court_vote', 'court_guilty', 'court_not_guilty', 'court_tie', 'court_booth'];
    for (const e of events) expect(hostLines.some((l) => l.host === 'fude' && l.event === e), e).toBe(true);
    for (const l of hostLines.filter((x) => x.event.startsWith('court_'))) {
      expect(l.status).toBe('draft');
      expect(hasKanji(l.jp.kana)).toBe(false);
    }
  });
});

// ---- roles ----

describe('Yōkai Court roles', () => {
  it('runs 3 cases for 4–6 players and 4 for 7–8, and everyone argues at least once', () => {
    expect(roundsFor(4)).toBe(3);
    expect(roundsFor(6)).toBe(3);
    expect(roundsFor(7)).toBe(4);
    for (const n of [4, 5, 6, 7, 8]) {
      const t = new Table(n, [], 3 + n);
      t.start();
      t.playOut();
      const argued = new Set(t.st.cases.flatMap((c) => [c.pros, c.def]));
      expect(argued.size, `${n} players`).toBe(Math.min(n, 2 * roundsFor(n)));
      for (const c of t.st.cases) {
        expect(c.pros).not.toBe(c.def);
        expect(c.judges).not.toContain(c.pros);
        expect(c.judges).not.toContain(c.def);
        if (c.witness) expect(c.judges).toContain(c.witness);
        expect(c.judges.length).toBe(n - 2);
      }
    }
  });

  it('pairs lawyers by the closest level', () => {
    const t = new Table(4, ['kana', 'n4', 'kana', 'n4'], 5);
    t.start();
    const c = t.c;
    expect(t.level(c.pros)).toBe(t.level(c.def));
  });
});

// ---- secrets on the TV ----

describe('Yōkai Court on the TV', () => {
  it('never shows a mission, the check’s answer, or an argument’s words before the gist', () => {
    const t = new Table(5, ['n4', 'n4', 'n5', 'n5', 'kana'], 9);
    t.start();
    toPlan(t);
    const cs = caseOf(t);
    const stage = () => JSON.stringify(t.view('stage'));
    expect(t.view('stage').me).toBeNull();
    const model = t.view(t.c.pros).me!.mission!.model.kana;
    expect(stage()).not.toContain(model);
    argueAll(t, (id, side) => clip(t.view(id).me!.mission!.model.kana + (side === 'def' ? '' : '')));
    expect(t.view('stage').play).not.toBeNull();
    const evidence = t.c.checkSide === 'pros' ? cs.clue : cs.alibi;
    expect(t.view('stage').args).toEqual([]);
    expect(stage()).not.toContain(`"id":"${evidence}"`);
    // A judge's Listening card holds back the detail the check asks about.
    const judge = t.c.judges[0]!;
    expect(t.view(judge).me!.listen).not.toBeNull();
    expect(JSON.stringify(t.view(judge).me!.listen)).not.toContain(`"id":"${evidence}"`);
    while (t.c.step === 'play') t.tick();
    expect(t.view('stage').args).toEqual([]);
    while (t.s.phase === 'reveal') t.tick();
    expect(t.view('stage').args).toHaveLength(2);
  });
});

// ---- scoring ----

describe('Yōkai Court scoring', () => {
  it('pays the winner, each vote, the majority and a right check', () => {
    const t = new Table(6, ['n5', 'n5', 'n5', 'n5', 'n5', 'n5'], 21);
    t.start();
    toPlan(t);
    const { pros, def, judges } = t.c;
    argueAll(t, (id) => clip(t.view(id).me!.mission!.model.kana));
    const before = Object.fromEntries(t.s.players.map((p) => [p.id, p.score]));
    // 3 for the prosecution, 1 for the defence; two judges check right.
    const cs = caseOf(t);
    const decoy = t.c.checkSide === 'pros' ? cs.clueDecoys[0]! : cs.alibiDecoys[0]!;
    checkAndVote(t, (id, right) => (judges.indexOf(id) < 2 ? right : decoy), (id) => (judges.indexOf(id) < 3 ? 'pros' : 'def'));
    const gain = (id: string) => t.score(id) - before[id]!;
    expect(gain(pros)).toBe(POINTS.win + 3 * POINTS.vote);
    expect(gain(def)).toBe(POINTS.vote);
    const right = t.c.checkSide === 'pros' ? caseOf(t).clue : caseOf(t).alibi;
    for (const id of judges) {
      const checked = t.c.checks[id] === right ? POINTS.check : 0;
      const majority = judges.indexOf(id) < 3 ? POINTS.majority : 0;
      expect(gain(id), id).toBe(checked + majority);
    }
    expect(t.view('stage').verdict).toMatchObject({ pros: 3, def: 1, winner: 'pros', tie: false });
  });

  it('a tie is not guilty: the defence wins, and nobody is paid for a majority', () => {
    const t = new Table(6, [], 22);
    t.start();
    toPlan(t);
    const { def, judges } = t.c;
    argueAll(t, (id) => clip(t.view(id).me!.mission!.model.kana));
    const before = t.score(def);
    checkAndVote(t, () => null, (id) => (judges.indexOf(id) < 2 ? 'pros' : 'def'));
    expect(t.view('stage').verdict).toMatchObject({ pros: 2, def: 2, winner: 'def', tie: true });
    expect(t.score(def) - before).toBe(POINTS.win + 2 * POINTS.vote);
    expect(t.st.ledger.filter((e) => e.why === 'majority')).toHaveLength(0);
  });

  it('voids the check only when the side never said its evidence', () => {
    const t = new Table(5, [], 23);
    t.start();
    toPlan(t);
    const cs = caseOf(t);
    // Both lawyers say something with no evidence in it.
    argueAll(t, () => clip('ちがいます'));
    checkAndVote(t, (_, right) => right, () => 'def');
    expect(t.view('stage').verdict!.check.valid).toBe(false);
    expect(t.st.ledger.filter((e) => e.why === 'check')).toHaveLength(0);
    expect(cs).toBeTruthy();
  });

  it('a stand-in scores nothing, and a mic pass scores half', () => {
    const t = new Table(5, [], 24);
    t.start();
    toPlan(t);
    const { pros, def } = t.c;
    t.play(pros, { kind: 'pass' });
    argueAll(t, () => null);
    expect(t.c.args[pros]).toMatchObject({ kind: 'fude', pass: true });
    expect(t.c.args[def]).toMatchObject({ kind: 'fude', free: true });
    const before = { pros: t.score(pros), def: t.score(def) };
    checkAndVote(t, () => null, () => 'def');
    expect(t.score(pros) - before.pros).toBe(0);
    expect(t.score(def) - before.def).toBe(0);
    // The mic pass is once a game.
    expect(t.st.micPassUsed[pros]).toBe(true);
  });

  it('half points on a mic pass that wins', () => {
    const t = new Table(5, [], 25);
    t.start();
    toPlan(t);
    const { pros } = t.c;
    t.play(pros, { kind: 'pass' });
    argueAll(t, (id) => (id === pros ? null : clip(t.view(id).me!.mission!.model.kana)));
    const before = t.score(pros);
    checkAndVote(t, () => null, () => 'pros');
    expect(t.score(pros) - before).toBe((POINTS.win + 3 * POINTS.vote) / 2);
  });
});

// ---- Kana lawyers ----

describe('Yōkai Court Kana lawyers', () => {
  it('picks one or two tiles; Fude-san reads them for full points, and a missing pick is a free stand-in', () => {
    const t = new Table(4, ['kana', 'kana', 'kana', 'kana'], 31);
    t.start();
    toPlan(t);
    const { pros, def } = t.c;
    expect(t.level(pros)).toBe('kana');
    expect(t.view(pros).me!.tiles).toHaveLength(3);
    expect(t.play(pros, { kind: 'pick', tiles: ['claim', 'evidence', 'answer'] }).error).toBe('bad-move');
    expect(t.play(pros, { kind: 'pick', tiles: ['evidence', 'claim'] }).error).toBeUndefined();
    argueAll(t, () => null);
    expect(t.c.args[pros]).toMatchObject({ kind: 'tiles', tiles: ['evidence', 'claim'] });
    expect(t.c.args[def]).toMatchObject({ kind: 'fude', free: true });
    expect(t.view('stage').verdict).toBeNull();
    checkAndVote(t, () => null, () => 'pros');
    expect(t.view(pros).me!.points).toBe(POINTS.win + 2 * POINTS.vote);
  });
});

// ---- the path ----

describe('Yōkai Court and the path', () => {
  it('credits a speaking lawyer’s level line from memory, with a hint, or as seen', () => {
    const t = new Table(5, ['n4', 'n4', 'n4', 'n4', 'n4'], 41);
    t.start();
    toPlan(t);
    const { pros, def } = t.c;
    t.play(def, { kind: 'hint' });
    const cs = caseOf(t);
    argueAll(t, (id) => clip(t.view(id).me!.mission!.model.kana));
    checkAndVote(t, () => null, () => 'def');
    const entry = (id: string, side: Side) => t.s.phrasebook[id]!.find((e) => e.itemId === `court:${cs.id}:saw:${side}:n4`)!;
    expect(entry(pros, 'pros')).toMatchObject({ outcome: 'said', recall: 'memory' });
    expect(entry(def, 'def')).toMatchObject({ outcome: 'said', recall: 'read' });
    expect(t.view(pros).me!.note!.credit).toBe('memory');
    expect(t.view(def).me!.note!.credit).toBe('hint');
    // The booth plays one of their own lines with the chunk.
    expect(t.c.booth).not.toBeNull();
  });

  it('credits the witness’s answer as said when they said it too', () => {
    const t = new Table(4, [], 42);
    t.start();
    t.tick();
    const w = t.c.witness!;
    t.play(w, { kind: 'testify', testimony: 'curve' });
    expect(t.play(w, { kind: 'said', heard: null }).error).toBeUndefined();
    while (t.s.phase !== 'score') t.tick();
    const cs = caseOf(t);
    expect(t.s.phrasebook[w]!.find((e) => e.itemId === `court:witness:${cs.id}:curve`)).toMatchObject({ outcome: 'said' });
  });
});

// ---- pacing ----

describe('Yōkai Court pacing', () => {
  it('runs a typical case in about 80 s and the worst in under 100 s', () => {
    const worst = CASE_MS + ASK_MS + TESTIFY_MS + PLAN_MS + RECORD_MS.n3 + UPLOAD_MS + GRACE_MS + 2 * (RECORD_MS.n3 + 500) + CHECK_MS + GIST_MS + VOTE_MS + VERDICT_MS;
    expect(worst).toBeLessThan(100_000);
    expect(FUDE_PLAY_MS.n3).toBeLessThanOrEqual(RECORD_MS.n3);
    const t = new Table(6, [], 51);
    t.start();
    const ms = t.playOut();
    expect(ms / roundsFor(6)).toBeLessThan(100_000);
  });

  it('plays a whole game with bots for every room size, speaking or typing', () => {
    for (const n of [4, 8]) {
      for (const speak of [false, true]) {
        const t = new Table(n, ['kana', 'n5', 'n4', 'n5', 'kana', 'n4', 'n5', 'n4'].slice(0, n) as Level[], 60 + n);
        t.start();
        t.playOut({ speak });
        expect(t.st.cases).toHaveLength(roundsFor(n));
        expect(t.st.cases.every((c) => c.settled)).toBe(true);
      }
    }
  });
});
