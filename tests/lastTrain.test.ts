// Last Train: rules with small fixtures (driven through the real room machine), then a full
// system run with bots playing over the network.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JpText, LastTrainMinigame, LastTrainScenario, MinigameItem } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { checkUtterance, firstMora, toRomaji } from '../shared/src/modes/lastTrain/check.js';
import { buildStops, RULES, type LastTrainState, type LastTrainView } from '../shared/src/modes/lastTrain/lastTrain.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { lastTrainPolicy } from '../tools/bots/policies/lastTrain.js';
import { content as realContent, hashView, startServer, until } from './helpers.js';

const t = (text: string, kana = text, en = text): JpText => ({ text, kana, en });
const item = (id: string, accepted: string[], level: MinigameItem['level'] = 'n5', timeLimit = 10): MinigameItem => ({
  id,
  level,
  prompt: t(`prompt ${id}`),
  accepted,
  model: t(accepted[0]!, accepted[0]!, `model ${id}`),
  hint: `hint ${id}`,
  timeLimit,
});
const mg = (id: string, items: MinigameItem[], extra: Partial<LastTrainMinigame> = {}): LastTrainMinigame => ({
  id,
  title: t(id),
  topic: id,
  promptType: 'spoken-question',
  penalty: false,
  phase: 1,
  status: 'draft',
  intro: t(`intro ${id}`),
  items,
  ...extra,
});

const MINIGAMES: LastTrainMinigame[] = [
  mg('konbini-math', [item('km1', ['さんびゃくえん', 'さんびゃく'])]),
  mg('meet-the-innkeeper', [item('mi1', ['こんばんは', 'こんばんわ'])]),
  mg('particle-panic', [item('pp1', ['は'])], { promptType: 'fill-particle', penalty: true }),
  mg('calendar-crunch', [item('cc1', ['げつようび'])], { penalty: true }),
];
const SCENARIO: LastTrainScenario = {
  id: 'test-line',
  title: t('テスト線'),
  departure: t('しゅっぱつ'),
  stops: [
    { id: 's1', name: t('一'), minigameId: 'konbini-math', announcement: t('つぎはいち') },
    { id: 's2', name: t('二'), minigameId: 'meet-the-innkeeper', announcement: t('つぎはに') },
    { id: 's3', name: t('三'), minigameId: 'particle-panic', announcement: t('つぎはさん') },
    { id: 's4', name: t('四'), minigameId: 'konbini-math', announcement: t('しゅうてん') },
  ],
  twist: t('じつは'),
  platformDash: [item('d1', ['えき'], 'n5', 5), item('d2', ['でんしゃ'], 'n5', 5)],
  status: 'draft',
};
const CONTENT: ContentLibrary = { ...EMPTY_CONTENT, lastTrainMinigames: MINIGAMES, lastTrainScenarios: [SCENARIO] };

// ---- a small driver around the real room machine ----

class Table {
  state: GameState = createGame('LAST');
  now = 1_000_000;
  cues: { event: string; slots?: Record<string, string> }[] = [];
  private ids = 0;
  private cmdId = 0;
  constructor(
    readonly content: ContentLibrary,
    players: number,
  ) {
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: `P${i}` });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: this.content, newId: () => `id${++this.ids}`, random: () => 0.5 };
  }
  act(a: GameAction) {
    const out = apply(this.state, a, this.ctx());
    this.cues.push(...this.state.cues.splice(0));
    return out;
  }
  cmd(actor: string | 'stage', command: CommandBody) {
    return this.act({ type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++this.cmdId}` } as Command });
  }
  start(stops = 4) {
    expect(this.cmd('stage', { type: 'start', mode: 'last-train', rounds: stops }).changed).toBe(true);
  }
  timeout() {
    return this.act({ type: 'timeout', phaseSeq: this.state.phaseSeq });
  }
  until(phase: string) {
    for (let i = 0; i < 40 && this.state.phase !== phase; i++) this.timeout();
    expect(this.state.phase).toBe(phase);
  }
  get s() {
    return this.state.modeState as LastTrainState;
  }
  view(id: string | 'stage'): LastTrainView {
    return viewFor(this.state, id === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: id }, this.content).game as LastTrainView;
  }
  task(id: string) {
    return this.view(id).me!.task!;
  }
  say(id: string, text: string, via: 'speech' | 'typed' = 'speech') {
    const task = this.view(id).me?.task;
    return this.cmd(id, { type: 'play', move: { kind: 'answer', key: task?.key ?? 'none', utterance: { via, text } } });
  }
  /** Answers the current item right (looked up in the state, as a test can). */
  sayRight(id: string) {
    const item = this.state.phase === 'penalty' ? this.s.penalties[id]!.task.item : this.state.phase === 'finale' ? this.s.racers[id]!.task!.item : this.s.turns[id]!.task.item;
    return this.say(id, item.accepted[0]!);
  }
  play(id: string, move: unknown) {
    return this.cmd(id, { type: 'play', move });
  }
  score(id: string) {
    return this.state.players.find((p) => p.id === id)!.score;
  }
}

describe('Last Train answer checking', () => {
  it('compares kana readings leniently', () => {
    expect(checkUtterance({ via: 'speech', text: '三百円', reading: 'さんびゃくえん' }, ['さんびゃくえん'])).toBe(true);
    expect(checkUtterance({ via: 'typed', text: 'サンビャクエン' }, ['さんびゃくえん'])).toBe(true);
    expect(checkUtterance({ via: 'typed', text: 'よんひゃくえん' }, ['さんびゃくえん'])).toBe(false);
  });
  it('accepts particles said as they sound only in particle minigames', () => {
    expect(checkUtterance({ via: 'speech', text: 'わ' }, ['は'], true)).toBe(true);
    expect(checkUtterance({ via: 'speech', text: 'え' }, ['へ'], true)).toBe(true);
    expect(checkUtterance({ via: 'speech', text: 'お' }, ['を'], true)).toBe(true);
    expect(checkUtterance({ via: 'speech', text: 'わたしわがくせいです' }, ['わたしはがくせいです'], true)).toBe(true);
    expect(checkUtterance({ via: 'speech', text: 'わ' }, ['は'], false)).toBe(false);
  });
  it('writes romaji and finds the first sound for Kana-level help', () => {
    expect(toRomaji('さんびゃくえん')).toBe('sanbyakuen');
    expect(toRomaji('きっぷ')).toBe('kippu');
    expect(toRomaji('コーヒー')).toBe('koohii');
    expect(toRomaji('きんえん')).toBe("kin'en");
    expect(firstMora('しゃしん')).toBe('しゃ');
    expect(firstMora('きっぷ')).toBe('き');
  });
});

describe('Last Train rules', () => {
  it('trims or pads stops to the VIP’s pick and keeps the last stop last', () => {
    const minigames = Object.fromEntries(MINIGAMES.map((m) => [m.id, m]));
    const six = buildStops(SCENARIO, 6, minigames, ['particle-panic', 'calendar-crunch'], () => 0.3);
    expect(six).toHaveLength(6);
    expect(six.at(-1)!.id).toBe('s4');
    const long = { ...SCENARIO, stops: [...SCENARIO.stops.slice(0, 3), ...SCENARIO.stops.slice(0, 3), SCENARIO.stops[3]!] };
    const four = buildStops(long, 4, minigames, [], () => 0.3);
    expect(four.map((x) => x.id)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it('runs departure → stops → finale → recap, with cues at each beat', () => {
    const g = new Table(CONTENT, 2);
    g.start(4);
    expect(g.state.phase).toBe('intro');
    expect(g.cues.some((c) => c.event === 'train_departure')).toBe(true);
    expect(g.view('stage').stops).toHaveLength(4);
    g.timeout();
    expect(g.state.phase).toBe('prompt');
    expect(g.cues.some((c) => c.event === 'train_stop' && c.slots?.stop === '一')).toBe(true);
    g.timeout();
    expect(g.state.phase).toBe('answer');
    expect(g.view('p1').me!.task!.limitMs).toBe(10_000);
  });

  it('scores a first-try answer, with a speech bonus capped at 30% of the points', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    g.until('answer');
    expect(g.say('p1', 'さんびゃくえん', 'speech').changed).toBe(true);
    expect(g.say('p2', 'さんびゃくえん', 'typed').changed).toBe(true);
    expect(g.state.phase).toBe('reveal'); // everyone resolved: the phase ends early
    const spoken = g.score('p1');
    const typed = g.score('p2');
    expect(typed).toBe(RULES.pointsFirstTry);
    expect(spoken).toBeGreaterThan(typed);
    expect(spoken - typed).toBeLessThanOrEqual(Math.floor(spoken * 0.3));
    const rows = g.view('stage').results!;
    expect(rows.map((r) => r.outcome)).toEqual(['first', 'first']);
    expect(rows[0]!.model.kana).toBe('さんびゃくえん');
    expect(g.state.phrasebook.p1?.[0]?.outcome).toBe('said');
  });

  it('gives one private retry with the hint, and hides answers from the stage until the stop resolves', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    g.until('answer');
    g.say('p1', 'よんひゃくえん');
    const mine = g.view('p1').me!;
    expect(mine.status).toBe('retry');
    expect(mine.task!.attempt).toBe(2);
    expect(mine.task!.hint).toBe('hint km1');
    expect(mine.task!.lastHeard).toBe('よんひゃくえん');
    // The stage sees a status, never the words.
    const stage = g.view('stage');
    expect(stage.travellers.find((x) => x.playerId === 'p1')!.status).toBe('retry');
    expect(JSON.stringify(stage)).not.toContain('よんひゃくえん');
    expect(JSON.stringify(stage)).not.toContain('hint km1');
    expect(stage.results).toBeNull();
    // p2 does not see p1's hint either (but may see the heard text, to judge an overrule).
    expect(JSON.stringify(g.view('p2'))).not.toContain('hint km1');
    g.say('p1', 'さんびゃく');
    expect(g.view('p1').me!.status).toBe('correct');
  });

  it('sends a double miss to the penalty car; failing it makes a ghost', () => {
    const g = new Table(CONTENT, 1); // alone: no one to overrule
    g.start();
    g.until('answer');
    g.say('p1', 'だめ');
    g.say('p1', 'だめ');
    expect(g.state.phase).toBe('reveal');
    expect(g.view('stage').results![0]!.outcome).toBe('missed');
    g.timeout();
    expect(g.state.phase).toBe('penalty');
    const task = g.task('p1');
    expect(task.kind).toBe('penalty');
    expect(['particle-panic', 'calendar-crunch'].some((id) => task.minigame?.text === id)).toBe(true);
    g.say('p1', 'ちがう');
    expect(g.state.phase).toBe('prompt'); // penalty resolved early, on to the next stop
    expect(g.s.travellers.p1!.ghost).toBe(true);
    expect(g.cues.some((c) => c.event === 'train_ghost' && c.slots?.name === 'P1')).toBe(true);
    expect(g.state.phrasebook.p1!.some((e) => e.outcome === 'missed')).toBe(true);
  });

  it('a room overrule counts a rejected answer as correct, never as a miss, and is logged', () => {
    const g = new Table(CONTENT, 3);
    g.start();
    g.until('answer');
    // Fine Japanese, but not on this item's accepted list: the checker rejects it.
    g.say('p1', 'さんびゃくえんです');
    expect(g.view('p1').me!.status).toBe('retry');
    const w = g.view('p2').overrules[0]!;
    expect(w.heard).toBeTruthy();
    expect(w.canVote).toBe(true);
    expect(g.view('stage').overrules[0]!.heard).toBeUndefined();
    expect(g.view('p1').overrules[0]!.mine).toBe(true);
    g.play('p2', { kind: 'overrule', windowId: w.id, up: true });
    g.play('p3', { kind: 'overrule', windowId: w.id, up: true });
    expect(g.view('p1').me!.status).toBe('correct');
    expect(g.s.overruleLog).toHaveLength(1);
    expect(g.cues.some((c) => c.event === 'room_overrule')).toBe(true);
    g.say('p2', 'さんびゃく');
    g.say('p3', 'さんびゃく');
    expect(g.state.phase).toBe('reveal');
    expect(g.view('stage').results!.find((r) => r.playerId === 'p1')!.outcome).toBe('overruled');
    expect(g.score('p1')).toBeGreaterThan(0);
    g.timeout();
    expect(g.state.phase).toBe('prompt'); // no penalty for p1
    expect(g.s.travellers.p1!.ghost).toBe(false);
  });

  it('overrules the first attempt mid-retry; a split vote is upheld', () => {
    const g = new Table(CONTENT, 3);
    g.start();
    g.until('answer');
    g.say('p1', 'xx');
    const w = g.view('p2').overrules[0]!;
    g.play('p2', { kind: 'overrule', windowId: w.id, up: true });
    g.play('p3', { kind: 'overrule', windowId: w.id, up: false });
    expect(g.view('stage').overrules[0]!.state).toBe('upheld');
    expect(g.view('p1').me!.status).toBe('retry');
    // Voting on a closed window is a harmless race.
    expect(g.play('p3', { kind: 'overrule', windowId: w.id, up: true }).error).toBe('wrong-phase');
  });

  it('times out an attempt by the phone’s tick, but not early', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    g.until('answer');
    const first = g.task('p1');
    g.play('p1', { kind: 'tick' });
    expect(g.task('p1').key).toBe(first.key); // too early: nothing happens
    g.now += first.limitMs;
    g.play('p1', { kind: 'tick' });
    expect(g.view('p1').me!.status).toBe('retry');
    // A late answer to the old key is a race, not an error.
    expect(g.cmd('p1', { type: 'play', move: { kind: 'answer', key: first.key, utterance: { via: 'speech', text: 'さんびゃく' } } }).error).toBe('wrong-phase');
  });

  it('lets a ghost haunt a living player once per stop, shaving 2 s off their next timer', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    g.until('answer');
    g.s.travellers.p1!.ghost = true;
    expect(g.view('p1').me!.canHaunt).toBe(true);
    expect(g.play('p1', { kind: 'haunt', targetId: 'p2' }).changed).toBe(true);
    expect(g.play('p1', { kind: 'haunt', targetId: 'p2' }).error).toBe('already-haunted');
    expect(g.play('p2', { kind: 'haunt', targetId: 'p1' }).error).toBe('not-a-ghost');
    expect(g.view('stage').haunts).toEqual([{ by: 'p1', target: 'p2' }]);
    g.say('p2', 'xx');
    expect(g.task('p2').limitMs).toBe(10_000 - RULES.hauntMs);
  });

  it('brings a ghost back after two correct answers in a row', () => {
    const g = new Table(CONTENT, 1);
    g.start();
    g.until('answer');
    g.s.travellers.p1!.ghost = true;
    g.s.turns.p1!.ghostAtStart = true;
    g.say('p1', 'さんびゃく');
    expect(g.s.travellers.p1!.streak).toBe(1);
    expect(g.score('p1')).toBe(Math.round(RULES.pointsFirstTry * RULES.ghostShare) + Math.round(Math.round(RULES.pointsFirstTry * RULES.ghostShare) * RULES.speechRate));
    g.until('answer');
    g.say('p1', 'こんばんわ');
    expect(g.s.travellers.p1!.ghost).toBe(false);
    expect(g.cues.some((c) => c.event === 'train_revive')).toBe(true);
  });

  it('accepts は said as わ at Particle Panic', () => {
    const g = new Table(CONTENT, 1);
    g.start();
    for (let stop = 0; stop < 2; stop++) {
      g.until('answer');
      g.say('p1', stop === 0 ? 'さんびゃく' : 'こんばんは');
    }
    g.until('answer');
    expect(g.view('stage').stop!.minigame.id).toBe('particle-panic');
    g.say('p1', 'わ');
    expect(g.view('p1').me).toBeTruthy();
    expect(g.s.turns.p1!.status).toBe('correct');
  });

  it('Platform Dash: first aboard wins; ghosts start further back but can still board', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    while (g.state.phase !== 'finale') {
      if (g.state.phase === 'answer') ['p1', 'p2'].forEach((id) => g.sayRight(id));
      else g.timeout();
    }
    expect(g.cues.some((c) => c.event === 'platform_dash')).toBe(true);
    const dash = () => g.view('stage').dash!;
    expect(dash().racers.every((r) => r.pos === 0)).toBe(true);
    const answer = (id: string) => {
      const task = g.task(id);
      const accepted = SCENARIO.platformDash.find((d) => d.id === task.itemId)!.accepted[0]!;
      g.say(id, accepted);
    };
    for (let i = 0; i < RULES.dashTrack; i++) answer('p1');
    expect(dash().racers.find((r) => r.playerId === 'p1')!.aboard).toBe(1);
    for (let i = 0; i < RULES.dashTrack; i++) answer('p2');
    expect(g.state.phase).toBe('score');
    const results = g.view('stage').dash!.results!;
    expect(results[0]).toMatchObject({ playerId: 'p1', rank: 1, points: RULES.dashPoints[0] });
    expect(results[1]).toMatchObject({ playerId: 'p2', rank: 2, points: RULES.dashPoints[1] });
    g.timeout();
    expect(g.state.phase).toBe('recap');
    expect(g.state.recap!.awards.some((a) => a.playerId === 'p1' && a.en === 'First Aboard')).toBe(true);

    // A ghost's dash starts behind.
    const h = new Table(CONTENT, 2);
    h.start();
    h.s.travellers.p2!.ghost = true;
    h.until('finale');
    expect(h.view('stage').dash!.racers.find((r) => r.playerId === 'p2')!.pos).toBe(-RULES.ghostStartBack);
  });

  it('keeps the ledger equal to the room’s scores', () => {
    const g = new Table(CONTENT, 3);
    g.start();
    let ledger: LastTrainView['ledger'] = [];
    while (g.state.phase !== 'recap') {
      if (g.state.phase === 'answer') for (const id of ['p1', 'p2', 'p3']) g.say(id, id === 'p3' ? 'xx' : 'さんびゃく');
      ledger = g.view('stage').ledger;
      g.timeout();
    }
    for (const p of g.state.players) expect(p.score).toBe(ledger.filter((e) => e.playerId === p.id).reduce((n, e) => n + e.points, 0));
    expect(g.score('p1')).toBeGreaterThan(0);
  });

  it('runs end to end with no Last Train content at all (placeholder set)', () => {
    const g = new Table(EMPTY_CONTENT, 2);
    g.start(6);
    expect(g.s.stops).toHaveLength(6);
    let guard = 0;
    while (g.state.phase !== 'recap' && guard++ < 100) {
      if (g.state.phase === 'answer' || g.state.phase === 'penalty') g.say('p1', 'なに');
      g.timeout();
    }
    expect(g.state.phase).toBe('recap');
  });

  it('runs with the real content, dealing each phone its own item at its level', () => {
    const g = new Table(realContent, 3);
    g.act({ type: 'command', actor: { kind: 'player', playerId: 'p3' }, command: { id: 'lv', type: 'setLevel', level: 'kana' } });
    g.start(6);
    expect(g.s.stops).toHaveLength(6);
    g.until('answer');
    const items = ['p1', 'p2', 'p3'].map((id) => g.s.turns[id]!.task.item);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
    expect(items[2]!.level).toBe('kana');
    expect(g.view('p3').me!.task!.romaji).toBeTruthy();
    expect(g.view('p1').me!.task!.romaji).toBeNull();
  });

  it('rejects malformed moves', () => {
    const g = new Table(CONTENT, 2);
    g.start();
    g.until('answer');
    expect(g.play('p1', null).error).toBe('bad-move');
    expect(g.play('p1', { kind: 'answer', key: g.task('p1').key, utterance: { via: 'speech', text: '   ' } }).error).toBe('empty-answer');
    expect(g.play('p1', { kind: 'answer', key: 5 }).error).toBe('bad-move');
    expect(g.play('p1', { kind: 'overrule', windowId: 'nope', up: true }).error).toBe('unknown-window');
    expect(g.play('p1', { kind: 'nonsense' }).error).toBe('bad-move');
  });
});

// ---- full system: bots over the network ----

describe('Last Train with bots', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 30, prompt: 30, answer: 1_500, reveal: 60, penalty: 1_200, finale: 4_000, score: 40 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('plays a whole game with 5 bots and every client in sync', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };
    let lastGame: LastTrainView | null = null;
    let recap: RoomView['recap'] = null;
    const phases = new Set<string>();
    let finished = false;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 5,
      roundsPerGame: 4,
      totalRounds: 4,
      mode: 'last-train',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        phases.add(view.phase);
        if (view.game?.mode === 'last-train') lastGame = view.game;
        if (view.phase === 'recap') recap = view.recap;
      },
    });
    director.start();
    const bots: Bot[] = [];
    for (let i = 1; i <= 5; i++) {
      bots.push(
        await Bot.join({
          baseUrl,
          code: created.code,
          name: `bot${i}`,
          level: i === 5 ? 'kana' : 'n5',
          policy: lastTrainPolicy({ content: realContent, seed: i }),
          onState: (bot, view, v) => record(bot.playerId, view, v),
        }),
      );
    }
    await until(() => finished, 18_000, 'one Last Train game');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect([...phases]).toEqual(expect.arrayContaining(['intro', 'prompt', 'answer', 'reveal', 'finale', 'score', 'recap']));
    for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
    for (const c of [director.client, ...bots.map((b) => b.client)]) expect(c.version).toBe(room.version);

    const failed = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failed).toEqual([]);
    expect(bots.reduce((n, b) => n + b.moves.filter((m) => m.ok).length, 0)).toBeGreaterThan(20);
    // The room overrule path ran over the network.
    expect(bots.some((b) => b.moves.some((m) => m.ok && m.key.includes(':overrule:')))).toBe(true);

    // Scores: the recap equals the sum of the ledger the stage saw.
    const game = lastGame as LastTrainView | null;
    expect(game).not.toBeNull();
    const standings = (recap as RoomView['recap'])!.standings;
    for (const s of standings) {
      const sum = game!.ledger.filter((e) => e.playerId === s.playerId).reduce((n, e) => n + e.points, 0);
      expect(s.score, `${s.name}'s score`).toBe(sum);
    }
    expect(standings.some((s) => s.score > 0)).toBe(true);
    for (const b of bots) b.stop();
    director.client.close();
  }, 30_000);
});
