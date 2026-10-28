import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import { TIP_POINTS, TIPS, type BentoView, type Round, type Visit } from '../shared/src/modes/bentoHaus/bentoHaus.js';
import { dealTeams, type VsState } from '../shared/src/modes/bentoHaus/bentoHausVs.js';
import { COUNTS, foodOf } from '../shared/src/modes/bentoHaus/menu.js';
import type { ModePlayer } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { createReader, type Reader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { bentoHausPolicy } from '../tools/bots/policies/bentoHaus.js';
import { content as REAL_CONTENT, hashView, startServer, until } from './helpers.js';
import { ponLines } from '../content/src/hosts/pon.js';

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

const speech = (text: string): Utterance => ({ via: 'speech', text });

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
  wake() {
    const at = wakeAt(this.s, this.ctx());
    expect(at).not.toBeNull();
    this.now = Math.max(this.now, at!);
    return this.act({ type: 'wake', phaseSeq: this.s.phaseSeq });
  }
  get st(): VsState {
    return this.s.modeState as VsState;
  }
  k(team: number): Round {
    return this.st.kitchens[team]!;
  }
  view(viewer: string | 'stage' = 'stage'): BentoView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT).game as BentoView;
  }
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start() {
    expect(this.cmd('stage', { type: 'start', mode: 'bento-haus-vs' }).changed).toBe(true);
    this.timeout();
    expect(this.s.phase).toBe('prompt');
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  /** Runs the clock until a customer is waiting, and returns each kitchen's copy. */
  customer(): Visit[] {
    for (let i = 0; i < 5 && !this.k(0).visits.some((v) => v.state === 'waiting'); i++) this.wake();
    const id = this.k(0).visits.find((v) => v.state === 'waiting')!.id;
    return this.st.kitchens.map((k) => k.visits.find((v) => v.id === id)!);
  }
  /** One kitchen fills its copy of an order exactly. */
  fill(team: number, v: Visit, opts: { only?: string } = {}) {
    for (const l of v.lines) {
      if (opts.only && l.foodId !== opts.only) continue;
      const f = foodOf(l.foodId)!;
      expect(this.play(v.takerId, { kind: 'call', utterance: speech(`${f.kana} ${COUNTS.tsu[l.n - 1]}、おねがいします`) }).error).toBeUndefined();
      const t = this.k(team).tickets.at(-1)!;
      expect(t.foodId).toBe(l.foodId);
      expect(this.play(t.stationId!, { kind: 'send', ticketId: t.id }).error).toBeUndefined();
    }
  }
}

const player = (id: string, level: Level, seat: number): ModePlayer => ({ id, name: id, seat, level, connected: true, score: 0 });

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});

describe('Bento Haus VS: the teams', () => {
  it('deals two teams with a similar mix of levels', () => {
    const ps = [player('a', 'n4', 1), player('b', 'n4', 2), player('c', 'kana', 3), player('d', 'kana', 4), player('e', 'n5', 5), player('f', 'n5', 6)];
    for (let seed = 1; seed < 20; seed++) {
      const teams = dealTeams(ps, mulberry(seed));
      expect(teams.map((t) => t.length)).toEqual([3, 3]);
      for (const level of ['n4', 'n5', 'kana'] as const) for (const t of teams) expect(t.filter((id) => ps.find((p) => p.id === id)!.level === level).length, `${seed} ${level}`).toBe(1);
    }
    expect(
      dealTeams(ps.slice(0, 5), mulberry(3))
        .map((t) => t.length)
        .sort(),
    ).toEqual([2, 3]);
  });

  it('every VS host event has four Pon lines, and slots match', () => {
    for (const e of ['bento_vs_intro', 'bento_vs_win', 'bento_vs_tie']) {
      const lines = ponLines.filter((l) => l.event === e);
      expect(lines.length, e).toBe(4);
      for (const l of lines) for (const slot of l.jp.text.match(/\{\w+\}/g) ?? []) expect(l.slots ?? [], l.id).toContain(slot);
    }
  });

  it('needs four players', () => {
    const t = new Table(3);
    expect(t.cmd('stage', { type: 'start', mode: 'bento-haus-vs' }).changed).toBe(false);
  });
});

describe('Bento Haus VS: a shift', () => {
  it('a customer phones both kitchens with the same order; each team has the whole menu on its own phones', () => {
    const t = new Table(4);
    t.start();
    const [a, b] = t.st.teams.map((x) => x.members);
    expect(a!.length).toBe(2);
    expect(b!.length).toBe(2);
    for (const [i, team] of [a!, b!].entries()) for (const id of t.k(i).menu) expect(team).toContain(t.k(i).holders[id]);
    expect(t.k(0).menu).toEqual(t.k(1).menu);
    const [va, vb] = t.customer();
    expect(va!.id).toBe(vb!.id);
    expect(va!.text).toBe(vb!.text);
    expect(a).toContain(va!.takerId);
    expect(b).toContain(vb!.takerId);
    // The TV sees both kitchens but never the order; each phone sees its own kitchen.
    const stage = t.view();
    expect(stage.vs!.teams.map((x) => x.visits.length)).toEqual([1, 1]);
    expect(JSON.stringify(stage)).not.toContain(va!.text);
    expect(t.view(va!.takerId).me!.taking[0]!.text).toBe(va!.text);
    expect(t.view(vb!.takerId).vs!.myTeam).toBe(1);
    expect(t.view(vb!.takerId).me!.taking[0]!.visitId).toBe(vb!.id);
  });

  it('a call only reaches your own team’s phones', () => {
    const t = new Table(4);
    t.start();
    const [va] = t.customer();
    const f = foodOf(va!.lines[0]!.foodId)!;
    t.play(va!.takerId, { kind: 'call', utterance: speech(`${f.kana} ふたつ`) });
    expect(t.k(1).tickets).toEqual([]);
    expect(t.st.teams[0]!.members).toContain(t.k(0).tickets[0]!.stationId);
  });

  it('the first box served wins the customer; the other goes as わけあり for 1 tip, and a late serve is too late', () => {
    const t = new Table(4);
    t.start();
    const [va, vb] = t.customer();
    t.fill(1, vb!, { only: vb!.lines[0]!.foodId });
    expect(t.play(va!.takerId, { kind: 'serve', visitId: va!.id }).error).toBe('empty-box');
    t.fill(0, va!);
    expect(t.play(va!.takerId, { kind: 'serve', visitId: va!.id }).error).toBeUndefined();
    const rush = va!.rush ? 2 : 1;
    expect(va!.state).toBe('served');
    expect(va!.tips).toBe(TIPS.perfect * rush);
    expect(vb!.state).toBe('left');
    expect(vb!.tips).toBe(TIPS.wakeari);
    expect(t.k(1).tips).toBe(TIPS.wakeari);
    expect(t.play(vb!.takerId, { kind: 'serve', visitId: vb!.id }).error).toBe('too-late');
    const stage = t.view();
    expect(stage.vs!.teams.map((x) => x.tips)).toEqual([TIPS.perfect * rush, TIPS.wakeari]);
  });

  it('a customer who waits too long leaves both kitchens', () => {
    const t = new Table(4);
    t.start();
    const [va, vb] = t.customer();
    t.fill(0, va!, { only: va!.lines[0]!.foodId });
    t.now = va!.leaveAt;
    t.wake();
    expect(va!.state).toBe('left');
    expect(vb!.state).toBe('left');
    expect(va!.tips).toBe(TIPS.wakeari);
    expect(vb!.tips).toBe(0);
  });

  it('pays each kitchen’s tips to its own players, names the shift’s winner, and plays to the recap', () => {
    const t = new Table(4);
    t.start();
    const [va] = t.customer();
    t.fill(0, va!);
    t.play(va!.takerId, { kind: 'serve', visitId: va!.id });
    const tipsA = t.k(0).tips;
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.st.winner).toBe(0);
    expect(t.view().vs!.winner).toBe(0);
    for (const id of t.st.teams[0]!.members) expect(t.score(id)).toBeGreaterThanOrEqual(tipsA * TIP_POINTS);
    for (const id of t.st.teams[1]!.members) expect(t.score(id)).toBeLessThan(tipsA * TIP_POINTS);
    for (let round = 2; round <= 3; round++) {
      t.timeout();
      expect(t.s.phase).toBe('prompt');
      expect(t.st.teams[0]!.banked).toBe(tipsA);
      t.timeout();
      t.timeout();
    }
    t.timeout();
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap!.awards.map((a) => a.title)).toContain('はんじょう賞');
    expect(t.s.recap!.coop).toBeFalsy();
  });

  it('a player who leaves hands their shelf and orders to their teammates', () => {
    const t = new Table(4);
    t.start();
    const [va] = t.customer();
    const gone = va!.takerId;
    const mate = t.st.teams[0]!.members.find((id) => id !== gone)!;
    t.act({ type: 'release', playerId: gone });
    expect(va!.takerId).toBe(mate);
    expect(Object.values(t.k(0).holders).every((id) => id === mate)).toBe(true);
  });
});

describe('Bento Haus VS: bots end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ reader, durations: { intro: 20, prompt: 30, answer: 6_000, score: 30 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [4, 7]) {
    it(`${players} bots race two kitchens through three shifts with every client in sync`, async () => {
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
      let served = 0;
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 3,
        totalRounds: 1_000,
        mode: 'bento-haus-vs',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          const g = view.game as BentoView | null;
          if (g?.mode === 'bento-haus-vs') served = Math.max(served, ...(g.vs?.teams ?? []).map((x) => x.visits.filter((y) => y.state === 'served').length));
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
            policy: bentoHausPolicy({ thinkMs: 60, quiet: i === 2 }),
            level: i === 1 ? 'kana' : i === 3 ? 'n4' : 'n5',
            onState: (bot, view, v) => record(bot.playerId, view, v),
          }),
        );
      }
      await until(() => finished, 60_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      expect(served).toBeGreaterThan(0);
      for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      const standings = (recap as RoomView['recap'])!.standings;
      expect(standings.length).toBe(players);
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && !['wrong-phase', 'no-customer', 'too-late'].includes(m.error ?? '')));
      expect(bad).toEqual([]);
      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
