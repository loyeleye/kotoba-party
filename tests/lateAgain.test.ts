import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { CAUSES, causeOf, dealOptions, latenessFor, lineFor, SCENES, scenesFor, SORRY_TILE, SOUND_TILE_ID, TANUKI_TILE, truthLine } from '../shared/src/modes/lateAgain/causes.js';
import { MAX_LEAVES, POINTS, RECORD_MS, roundsFor, type LateState, type LateView } from '../shared/src/modes/lateAgain/lateAgain.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { lateAgainPolicy } from '../tools/bots/policies/lateAgain.js';
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
  get st(): LateState {
    return this.s.modeState as LateState;
  }
  get r() {
    return this.st.rounds[this.st.round - 1]!;
  }
  room(viewer: string | 'stage' = 'stage'): RoomView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT);
  }
  view(viewer: string | 'stage' = 'stage'): LateView {
    return this.room(viewer).game as LateView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(extra?: Record<string, unknown>) {
    expect(this.cmd('stage', { type: 'start', mode: 'late-again', ...(extra ? { extra } : {}) }).changed).toBe(true);
    expect(this.s.phase).toBe('intro');
    this.tick();
    expect(this.s.phase).toBe('prompt');
  }
  /** Plays to the recap, letting bots move at every beat, and returns how long the game took. */
  playOut(bots = true, guard = 2000): number {
    const t0 = this.now;
    const policy = lateAgainPolicy({ thinkMs: 0 });
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

// ---- content ----

describe('Late Again!: content', () => {
  it('every cause has a mission and Pon’s version at N5 and N4, and N5 has a sentence frame', () => {
    expect(new Set(CAUSES.map((c) => c.id)).size).toBe(CAUSES.length);
    for (const c of CAUSES) {
      for (const level of ['n5', 'n4'] as const) {
        const line = lineFor(c, level);
        expect(line.mission, `${c.id} ${level}`).toBeTruthy();
        expect(line.model.kana, `${c.id} ${level}`).toMatch(/すみません|ごめん|もうしわけ/);
        // An N5 or N4 excuse names its cause, so the gallery can catch it.
        expect(c.keys.some((k) => line.model.kana.includes(k)) || c.keys.some((k) => line.model.kana.includes(k.replace(/^げーむ$/, 'ゲーム').replace(/^からす$/, 'カラス').replace(/^でーと$/, 'デート'))), `${c.id} ${level}`).toBe(true);
        // The mission never names the grammar.
        expect(line.mission, `${c.id} ${level}`).not.toMatch(/〜|passive|te-form|すぎ|ので/i);
      }
      const frame = c.lines.n5!.frame;
      expect(frame, c.id).toBeTruthy();
      expect(frame!.text, c.id).toContain('＿＿');
      expect(frame!.kana, c.id).toContain('＿＿');
      // The frame is Pon's version with one gap: the cause word.
      expect(c.lines.n4!.chunk, c.id).toBeTruthy();
      expect(c.lines.n4!.model.text, c.id).toContain(c.lines.n4!.chunk!.text);
      expect(c.check.wrong, c.id).not.toContain(c.check.right);
    }
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
  });

  it('deals one believable cause, one self-own and one yōkai, at most one sleep joke, never the recent ones', () => {
    const random = mulberry(3);
    for (const audience of ['kids', 'family', 'cheeky'] as const) {
      for (let i = 0; i < 80; i++) {
        const avoid = new Set(dealOptions(random, new Set(), audience));
        const deal = dealOptions(random, avoid, audience).map((id) => causeOf(id)!);
        expect(new Set(deal.map((c) => c.bucket))).toEqual(new Set(['believable', 'selfown', 'yokai']));
        expect(deal.filter((c) => c.sleep).length).toBeLessThanOrEqual(1);
        for (const c of deal) expect(avoid.has(c.id)).toBe(false);
        if (audience !== 'cheeky') for (const c of deal) expect(c.audiences, c.id).toBeUndefined();
      }
    }
  });

  it('every cause has Pon’s three reactions, a sound tile and a real-story line', () => {
    for (const c of CAUSES) {
      for (const tier of ['flop', 'good', 'ippon'] as const) expect(c.pon[tier].kana, `${c.id} ${tier}`).toBeTruthy();
      expect(c.sound.kana, c.id).toBeTruthy();
      expect(truthLine(c).kana, c.id).toMatch(/^ほんとうは… .+だったポン！$/);
      expect(truthLine(c).kana).not.toContain('！だった');
    }
    expect(truthLine(null).kana).toContain('ポンだった');
    // Kids rooms never get a Cheeky scene or cause.
    expect(scenesFor('kids').every((s) => !s.audiences)).toBe(true);
    expect(latenessFor(6, 6).kana).toBe('いちねん');
    expect(latenessFor(1, 6).kana).toBe('ごふん');
  });

  it('has a picture for every cause, the curveball and the leaf', () => {
    const dir = fileURLToPath(new URL('../stage/assets/late/', import.meta.url));
    if (!existsSync(dir)) return; // the art lands with its own commit
    for (const c of CAUSES) expect(existsSync(`${dir}${c.picture}.png`), c.picture).toBe(true);
    expect(existsSync(`${dir}${TANUKI_TILE.picture}.png`)).toBe(true);
    expect(existsSync(`${dir}leaf.png`)).toBe(true);
  });
});

// ---- rules ----

describe('Late Again!: roles', () => {
  it('everyone is late the same number of times, for 2 to 8 players', () => {
    for (let n = 2; n <= 8; n++) {
      const t = new Table(n, [], n);
      t.start();
      t.playOut();
      const counts = new Map<string, number>();
      for (const r of t.st.rounds) counts.set(r.latecomer, (counts.get(r.latecomer) ?? 0) + 1);
      expect(t.st.rounds.length, `${n}`).toBe(roundsFor(n));
      expect(counts.size, `${n}`).toBe(n);
      expect(new Set(counts.values()).size, `${n}: ${[...counts.values()]}`).toBe(1);
    }
  });

  it('nobody is acting chief twice in a row with 4 or more players, and everyone gets a turn', () => {
    for (let n = 4; n <= 8; n++) {
      const t = new Table(n, [], 10 + n);
      t.start();
      t.playOut();
      const chiefs = t.st.rounds.map((r) => r.chief);
      for (let i = 1; i < chiefs.length; i++) expect(chiefs[i], `${n} round ${i + 1}`).not.toBe(chiefs[i - 1]);
      for (const r of t.st.rounds) {
        expect(r.chief).not.toBe(r.latecomer);
        expect(r.witness).not.toBe(r.latecomer);
        expect(r.chief).not.toBe(r.witness);
      }
      if (n <= 6) expect(new Set(chiefs).size, `${n}`).toBe(n);
    }
  });

  it('the first chief is a Kana player when one is free', () => {
    const t = new Table(5, ['n4', 'n4', 'n4', 'kana', 'n4'], 4);
    t.start();
    const r = t.r;
    if (r.latecomer !== 'p4' && r.witness !== 'p4') expect(r.chief).toBe('p4');
  });

  it('two players play together against Pon’s record, with Pon as the witness', () => {
    const t = new Table(2);
    t.start();
    expect(t.st.coop).toBe(true);
    expect(t.r.witness).toBeNull();
    expect(t.r.chief).not.toBe(t.r.latecomer);
    t.playOut();
    // Team points are shared; only listening points are each player's own.
    const team = (id: string) => t.st.ledger.filter((e) => e.playerId === id && (e.why === 'coop' || e.why === 'alibi')).reduce((a, e) => a + e.points, 0);
    expect(team('p1')).toBe(team('p2'));
  });
});

describe('Late Again!: scoring', () => {
  it('the ledger adds up to every score', () => {
    for (const n of [3, 5, 8]) {
      const t = new Table(n, ['kana', 'n5', 'n4', 'n5', 'n4', 'kana', 'n5', 'n4'], 20 + n);
      t.start();
      t.playOut();
      for (const p of t.s.players) {
        const sum = t.st.ledger.filter((e) => e.playerId === p.id).reduce((a, e) => a + e.points, 0);
        expect(sum, `${n} ${p.id}`).toBe(p.score);
      }
      expect(t.st.ledger.some((e) => e.points > 0)).toBe(true);
    }
  });

  it('a leaf is refused at zero, and nobody ever holds more than two', () => {
    const t = new Table(5, [], 9);
    t.start();
    let refused = 0;
    for (let guard = 0; guard < 400 && t.s.phase !== 'recap'; guard++) {
      for (const id of Object.keys(t.st.leaves)) expect(t.st.leaves[id]!).toBeLessThanOrEqual(MAX_LEAVES);
      if (t.s.phase === 'encore') {
        for (const p of t.s.players) {
          const me = t.view(p.id).me!;
          if (!me.canVote) continue;
          const res = t.play(p.id, { kind: 'leaf', give: true });
          if (me.leaves <= 0) {
            expect(res.error).toBe('no-leaf');
            refused++;
          } else expect(res.error).toBeUndefined();
        }
      }
      if (t.phase !== 'recap') t.tick();
    }
    expect(t.phase).toBe('recap');
    // Everyone giving every round runs the leaves out.
    expect(refused).toBeGreaterThan(0);
  });

  it('pays the latecomer per leaf, the witness for a matching alibi, and the chief for reading the room', () => {
    const t = new Table(4, [], 2);
    t.start();
    t.tick(); // scene → plan
    const r = t.r;
    expect(t.play(r.latecomer, { kind: 'cause', causeId: r.options[1] }).error).toBeUndefined();
    expect(t.play(r.witness!, { kind: 'alibi', tileId: r.options[1] }).error).toBeUndefined();
    expect(t.play(r.gallery[0]!, { kind: 'bet', causeId: r.options[1] }).error).toBeUndefined();
    t.play(r.latecomer, { kind: 'ready' });
    expect(t.s.phase).toBe('answer');
    expect(t.play(r.latecomer, { kind: 'excuse', type: 'typed', text: lineFor(CAUSES.find((c) => c.id === r.options[1])!, 'n5').model.kana }).error).toBeUndefined();
    expect(t.s.phase).toBe('reveal');
    t.tick(); // play → gist
    t.tick(); // → encore
    expect(t.s.phase).toBe('encore');
    const before = new Map(t.s.players.map((p) => [p.id, p.score]));
    // Voters: everyone but the latecomer and the chief.
    for (const id of [r.witness!, ...r.gallery]) t.play(id, { kind: 'leaf', give: true });
    t.play(r.chief!, { kind: 'rule', call: 'safe' });
    expect(t.s.phase).toBe('score');
    const gained = (id: string) => t.score(id) - before.get(id)!;
    expect(gained(r.latecomer)).toBe(2 * POINTS.leaf + POINTS.alibi);
    expect(gained(r.witness!)).toBe(POINTS.alibi);
    expect(gained(r.chief!)).toBe(POINTS.chief);
    expect(gained(r.gallery[0]!)).toBe(POINTS.bet);
    // Two voters: every leaf, but IPPON needs three.
    expect(t.r.ruling!.tier).toBe('good');
  });
});

describe('Late Again!: secrets', () => {
  it('never shows the cause or the gist to anyone else before the gist beat', () => {
    const t = new Table(5, ['kana', 'n5', 'n4', 'n5', 'n4'], 5);
    t.start();
    const policy = lateAgainPolicy({ thinkMs: 0 });
    for (let guard = 0; guard < 400 && t.s.phase !== 'recap'; guard++) {
      const r = t.r;
      const early = t.s.phase === 'prompt' || t.s.phase === 'answer' || (t.s.phase === 'reveal' && r.step === 'play');
      if (early) {
        const stage = t.view('stage');
        expect(stage.gist).toBeNull();
        expect(JSON.stringify(stage.me)).toBe('null');
        for (const p of t.s.players) {
          if (p.id === r.latecomer) continue;
          const me = t.view(p.id).me!;
          expect(me.gist, `${p.id} ${t.s.phase}`).toBeNull();
          expect(me.cause).toBeNull();
          // The chief never sees a bet or an alibi.
          if (p.id === r.chief) expect(me.alibi).toBeNull();
        }
        expect(JSON.stringify(stage)).not.toContain(`"cause":"${r.cause}"`);
      }
      for (const p of t.s.players) for (const a of policy.act(t.room(p.id), p.id)) t.cmd(p.id, { type: 'play', move: a.move });
      if (t.phase !== 'recap') t.tick();
    }
    expect(t.phase).toBe('recap');
  });

  it('only the latecomer may blame a cause, and only from the witness’s three', () => {
    const t = new Table(4);
    t.start();
    t.tick();
    const r = t.r;
    expect(t.play(r.witness!, { kind: 'cause', causeId: r.options[0] }).error).toBe('not-yours');
    const other = CAUSES.find((c) => !r.options.includes(c.id))!.id;
    expect(t.play(r.latecomer, { kind: 'cause', causeId: other }).error).toBe('bad-move');
    expect(t.play(r.witness!, { kind: 'alibi', tileId: TANUKI_TILE.id }).error).toBeUndefined();
    expect(t.play(r.chief!, { kind: 'bet', causeId: r.options[0] }).error).toBe('not-yours');
  });

  it('the blind variant deals the cause and refuses a pick', () => {
    const t = new Table(4);
    t.start({ blindLatecomer: true });
    t.tick();
    expect(t.r.blind).toBe(true);
    expect(t.play(t.r.latecomer, { kind: 'cause', causeId: t.r.options[0] }).error).toBe('blind');
    expect(t.view(t.r.latecomer).me!.canPick).toBe(false);
  });
});

describe('Late Again!: the excuse', () => {
  it('a Kana excuse is built from tiles, and the tiles go in by themselves when time runs out', () => {
    const t = new Table(3, ['kana', 'kana', 'kana'], 1);
    t.start();
    t.tick();
    const r = t.r;
    const me = t.view(r.latecomer).me!;
    expect(me.tiles.map((x) => x.id)).toEqual([SORRY_TILE.id, ...r.options, TANUKI_TILE.id]);
    expect(t.play(r.latecomer, { kind: 'tiles', tiles: [SOUND_TILE_ID] }).error).toBe('bad-move');
    expect(t.play(r.latecomer, { kind: 'tiles', tiles: [SORRY_TILE.id, r.options[2], SOUND_TILE_ID] }).error).toBeUndefined();
    const tiles = t.view(r.latecomer).me!.tiles;
    expect(tiles.at(-1)!.word.kana).toBe(causeOf(r.options[2])!.sound.kana);
    expect(t.play(r.latecomer, { kind: 'tiles', tiles: ['a', 'b', 'c', 'd'] }).error).toBe('bad-move');
    t.tick(); // plan → answer
    t.tick(); // answer ends
    expect(t.s.phase).toBe('reveal');
    expect(t.r.excuse!.kind).toBe('tiles');
    expect(t.r.cause).toBe(r.options[2]);
    expect(t.view('stage').play!.tiles.map((x) => x.word.kana)).toEqual([SORRY_TILE.word.kana, causeOf(r.options[2])!.word.kana, causeOf(r.options[2])!.sound.kana]);
  });

  it('Pon stands in when nothing comes, and the mic pass works once a game', () => {
    const t = new Table(3, [], 6);
    t.start();
    t.tick();
    t.tick();
    t.tick();
    expect(t.s.phase).toBe('reveal');
    expect(t.r.excuse!.kind).toBe('pon');
    expect(t.r.excuse!.standIn).toBe(true);
    // Next rounds: the same latecomer passes once, then can't again.
    const late = new Map<string, number>();
    while (t.s.phase !== 'recap') {
      if (t.s.phase === 'answer') {
        const id = t.r.latecomer;
        late.set(id, (late.get(id) ?? 0) + 1);
        const res = t.play(id, { kind: 'micPass' });
        if (late.get(id) === 1) expect(res.error).toBeUndefined();
        else expect(res.error).toBe('no-pass-left');
      }
      if (t.phase !== 'recap') t.tick();
    }
  });
});

describe('Late Again!: pacing', () => {
  it('an 8-player game takes 8.5 minutes or less, even when every excuse uses its full time', () => {
    const t = new Table(8, ['n5', 'n4', 'kana', 'n5', 'n4', 'n5', 'n4', 'n5'], 8);
    t.start();
    const t0 = t.now - 12_000;
    for (let guard = 0; guard < 600 && t.s.phase !== 'recap'; guard++) {
      if (t.s.phase === 'answer' && !t.r.excuse && t.r.level !== 'kana') {
        // The take runs to the limit.
        t.now += RECORD_MS[t.r.level];
        t.play(t.r.latecomer, { kind: 'excuse', type: 'clip', clipId: 'clip1', durMs: RECORD_MS[t.r.level] + 500 });
        continue;
      }
      t.tick();
    }
    expect(t.phase).toBe('recap');
    expect(t.now - t0).toBeLessThanOrEqual(8.5 * 60_000);
  });

  it('bots finish a game quicker than the timers alone', () => {
    const idle = new Table(6, [], 3);
    idle.start();
    const slow = idle.playOut(false);
    const busy = new Table(6, [], 3);
    busy.start();
    const fast = busy.playOut(true);
    expect(fast).toBeLessThan(slow);
  });
});
