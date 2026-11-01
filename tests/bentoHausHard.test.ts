import { beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import type { BentoState, BentoView, Round, Visit } from '../shared/src/modes/bentoHaus/bentoHaus.js';
import { checkLine, complaintSteps, GUEST_ASKS, INCIDENT_MS, offerStats, rolesFor, SPECIAL_EVERY, SPECIALS, WELCOME, type StepScript } from '../shared/src/modes/bentoHaus/hardRoles.js';
import { COUNTS, FOODS, foodOf } from '../shared/src/modes/bentoHaus/menu.js';
import type { Command } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
import { content as REAL_CONTENT } from './helpers.js';

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
  constructor(levels: Level[], seed = 7) {
    this.random = mulberry(seed);
    levels.forEach((level, i) => {
      this.act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
      this.act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
    });
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
  get st(): BentoState {
    return this.s.modeState as BentoState;
  }
  get r(): Round {
    return this.st.current!;
  }
  view(viewer: string | 'stage' = 'stage'): BentoView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, REAL_CONTENT).game as BentoView;
  }
  /** To the shift's title card (where the offer is first made). */
  toPrompt() {
    expect(this.cmd('stage', { type: 'start', mode: 'bento-haus' }).changed).toBe(true);
    this.timeout();
    expect(this.s.phase).toBe('prompt');
  }
  open() {
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  customer(): Visit {
    for (let i = 0; i < 5 && !this.r.visits.some((v) => v.state === 'waiting'); i++) this.wake();
    return this.r.visits.find((v) => v.state === 'waiting')!;
  }
  /** The kitchen fills an order, leaving one food out if asked. */
  fill(v: Visit, skip?: string) {
    for (const l of v.lines) {
      if (l.foodId === skip) continue;
      const f = foodOf(l.foodId)!;
      expect(this.play(v.takerId, { kind: 'call', utterance: speech(`${f.kana} ${COUNTS.tsu[l.n - 1]}、おねがいします`) }).error).toBeUndefined();
      const t = this.r.tickets.at(-1)!;
      expect(this.play(t.stationId!, { kind: 'send', ticketId: t.id }).error).toBeUndefined();
    }
  }
}

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});
function heard(text: string): Utterance {
  const move = { u: { via: 'speech', text } as Utterance };
  addReadings(move, reader);
  return move.u;
}

const FRAMES = new Set(['te-moraeru', 'te-itadakemasu-ka', 'o-kudasai', 'keigo-verb', 'te-aru']);

describe('Bento Haus hard roles: the lines', () => {
  const allSteps = (): StepScript[] => [
    WELCOME,
    ...SPECIALS.flatMap((x) => [...x.steps]),
    ...GUEST_ASKS.map((a): StepScript => ({ to: 'customer', check: a.kind, model: a.model, ...(a.keys ? { keys: a.keys } : {}) })),
    ...FOODS.flatMap((f) => [...complaintSteps({ foodId: f.id, how: 'missing' }, 2, true), ...complaintSteps({ foodId: f.id, how: 'extra' }, 1, false)]),
  ];

  it('every line is draft, kana, tagged with N4 frames by name, and passes its own check', () => {
    for (const x of [...SPECIALS, ...GUEST_ASKS]) expect(x.status, x.id).toBe('draft');
    for (const st of allSteps()) {
      expect(st.model.kana, st.model.text).toBe(st.model.text);
      expect(st.model.frames?.length, st.model.text).toBeGreaterThan(0);
      for (const f of st.model.frames ?? []) expect(FRAMES.has(f), f).toBe(true);
      expect(checkLine(speech(st.model.text), st), st.model.text).toEqual({ ok: true, hint: null });
    }
  });

  it('staff turn guests down with ＿は ごえんりょ ください, never ＿ては いけません', () => {
    for (const a of GUEST_ASKS.filter((x) => x.kind === 'decline')) expect(a.model.text, a.id).toMatch(/は ごえんりょ ください。$/);
    const smoking = GUEST_ASKS.find((a) => a.id === 'smoking')!;
    const step = { check: smoking.kind, keys: smoking.keys };
    const no = checkLine(speech('たばこを すっては いけません。'), step);
    expect(no.ok).toBe(false);
    expect(no.hint).toContain('ごえんりょ');
    expect(checkLine(speech('ごえんりょ ください。'), step).ok).toBe(false);
  });

  it('keigo to customers, もらえますか to the kitchen, with private hints', () => {
    const sorry = { check: 'sorry-ask' as const };
    expect(checkLine(speech('すこし まって いただけますか。'), sorry).hint).toContain('もうしわけ');
    expect(checkLine(speech('もうしわけ ございません。すこし まって もらえますか。'), sorry).hint).toContain('いただけますか');
    expect(checkLine(speech('もうしわけ ありません。まって いただけませんか。'), sorry).ok).toBe(true);
    const kitchen = { check: 'kitchen' as const, keys: ['からあげ'] };
    expect(checkLine(speech('からあげを もう ひとつ つくって もらえますか'), kitchen).ok).toBe(true);
    expect(checkLine(speech('もう ひとつ つくって もらえますか'), kitchen).hint).toContain('からあげ');
    expect(checkLine(speech('からあげを つくって ください'), kitchen).ok).toBe(false);
    expect(checkLine(speech('どうぞ すわって ください'), { check: 'welcome' }).ok).toBe(false);
    expect(checkLine(speech('しょうしょう おまちください'), { check: 'welcome' }).ok).toBe(true);
    expect(checkLine(speech('おはしを よういして います'), { check: 'ready' }).ok).toBe(false);
  });

  it('hears keigo written in kanji by its reading', () => {
    expect(checkLine(heard('申し訳ございません。少し待っていただけますか'), { check: 'sorry-ask' }).ok).toBe(true);
    expect(checkLine(heard('唐揚げをもう一つ作ってもらえますか'), { check: 'kitchen', keys: ['からあげ'] }).ok).toBe(true);
    expect(checkLine(heard('お箸は用意してあります'), { check: 'ready' }).ok).toBe(true);
    expect(checkLine(heard('お煙草はご遠慮ください'), { check: 'decline', keys: ['たばこ'] }).ok).toBe(true);
  });
});

describe('Bento Haus hard roles: who is offered what', () => {
  const p = (id: string, level: Level) => ({ id, level });
  it('rotates the manager seat through the N4 players; the rest get おもてなし', () => {
    expect(rolesFor(1, [p('a', 'n5'), p('b', 'kana')])).toEqual([]);
    expect([1, 2, 3].map((r) => rolesFor(r, [p('a', 'n4'), p('b', 'n5')])[0]!.role)).toEqual(['manager', 'omotenashi', 'manager']);
    const two = [p('a', 'n4'), p('b', 'n5'), p('c', 'n4')];
    expect(rolesFor(1, two)).toEqual([
      { playerId: 'a', role: 'manager' },
      { playerId: 'c', role: 'omotenashi' },
    ]);
    expect(rolesFor(2, two).find((o) => o.role === 'manager')!.playerId).toBe('c');
  });

  it('a room with no N4 player gets no hard-role state or view at all', () => {
    const t = new Table(['n5', 'kana']);
    t.toPrompt();
    t.open();
    t.customer();
    expect(t.st.hard).toBeUndefined();
    expect(t.r.hard).toBeUndefined();
    expect('hard' in t.view()).toBe(false);
    expect(t.view('p1').me!.hard).toBeUndefined();
    expect(t.play('p1', { kind: 'role', accept: true }).error).toBe('bad-move');
  });

  it('records accepted, declined and unanswered offers; only N4 phones get one', () => {
    const t = new Table(['n4', 'n5', 'n4']);
    t.toPrompt();
    expect(t.view('p1').me!.hard?.offer).toEqual({ role: 'manager' });
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'omotenashi' });
    expect(t.view('p2').me!.hard).toBeUndefined();
    expect(t.play('p2', { kind: 'role', accept: true }).error).toBe('not-allowed');
    expect(t.play('p1', { kind: 'role', accept: true }).error).toBeUndefined();
    expect(t.play('p1', { kind: 'role', accept: false }).error).toBe('not-allowed');
    expect(t.view('p1').me!.hard).toMatchObject({ offer: null, role: 'manager' });
    t.open();
    expect(t.play('p3', { kind: 'role', accept: false }).error).toBeUndefined();
    expect(t.view('p3').me!.hard).toBeUndefined();
    expect(offerStats(t.st.hard!.offers)).toEqual({ offered: 2, accepted: 1, declined: 1, unanswered: 0 });
    expect(t.view().hard!.manager).toBe('p1');
  });
});

describe('Bento Haus hard roles: the manager', () => {
  function managerTable() {
    const t = new Table(['n4', 'n5']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    return t;
  }

  it('a box with a food missing becomes a complaint: sorry and wait, then the station makes it', () => {
    const t = managerTable();
    const v = t.customer();
    const missing = v.lines[0]!.foodId;
    t.fill(v, missing);
    // Pon won't disguise himself as the missing food this time.
    t.r.bakeUsed = true;
    expect(t.play(v.takerId, { kind: 'serve', visitId: v.id }).error).toBeUndefined();
    const tips = t.r.tips;
    const inc = t.r.hard!.incidents.at(-1)!;
    expect(v.baked).toBeNull();
    expect(inc.kind).toBe('complaint');
    const desk = t.view('p1').me!.hard!.desk[0]!;
    expect(desk.steps[0]!.to).toBe('customer');

    // A miss: a private hint on the manager's phone, nothing on the TV.
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech('すみません。まって ください。') });
    expect(t.view('p1').me!.hard!.desk[0]!.steps[0]!.hint).toBeTruthy();
    expect(JSON.stringify(t.view())).not.toContain('💡');
    expect(t.view().hard!.desk[0]!.said).toEqual([]);
    expect(JSON.stringify(t.view('p2'))).not.toContain(t.view('p1').me!.hard!.desk[0]!.steps[0]!.hint!);

    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech('もうしわけ ございません。すこし まって いただけますか。') });
    expect(t.view().hard!.desk[0]!.said.map((x) => x.to)).toEqual(['customer']);
    const f = foodOf(missing)!;
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(`${f.kana}を もう ひとつ つくって もらえますか。`) });
    expect(inc.state).toBe('asked');
    const station = inc.stationId!;
    const req = t.view(station).me!.hard!.requests[0]!;
    expect(req.text).toContain('もらえますか');
    expect(t.play(station === 'p1' ? 'p2' : 'p1', { kind: 'request-done', incidentId: inc.id }).error).toBe('bad-move');
    expect(t.play(station, { kind: 'request-done', incidentId: inc.id }).error).toBeUndefined();
    expect(inc.state).toBe('resolved');
    expect(t.view().hard!.desk[0]!.line.text).toBe('ありがとう。たすかりました。');
    // Nobody's pay changes: the tips stay what the box earned.
    expect(t.r.tips).toBe(tips);
    expect(t.r.bonus.p1).toBeGreaterThan(0);
    expect(t.view().hard!.handled).toEqual({ done: 1, of: 1 });
  });

  it('special orders come every few customers, and run out after a while', () => {
    const t = managerTable();
    const seen: Visit[] = [];
    for (let k = 0; k < SPECIAL_EVERY && t.s.phase === 'answer'; k++) {
      const v = t.customer();
      seen.push(v);
      t.fill(v);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
    }
    const inc = t.r.hard!.incidents.find((i) => i.kind === 'special');
    expect(inc).toBeDefined();
    expect(t.view('p1').me!.hard!.desk.map((d) => d.id)).toContain(inc!.id);
    t.now = inc!.until;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(inc!.state).toBe('missed');
    expect(INCIDENT_MS).toBeGreaterThan(0);
  });

  it('a declined seat is the ordinary part: no complaints, no specials', () => {
    const t = new Table(['n4', 'n5']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: false });
    t.open();
    for (let k = 0; k < 3 && t.s.phase === 'answer'; k++) {
      const v = t.customer();
      t.fill(v, v.lines[0]!.foodId);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
    }
    expect(t.r.hard!.incidents).toEqual([]);
    expect(t.view('p1').me!.hard).toBeUndefined();
  });
});

describe('Bento Haus hard roles: the おもてなし shift', () => {
  it('the guest is seated, asks their question, and leaves stars; corrections stay on the phone', () => {
    const t = new Table(['n4', 'n5']);
    t.toPrompt();
    // Shift 1 offers the single N4 player the manager seat; shift 2, おもてなし.
    t.play('p1', { kind: 'role', accept: false });
    t.open();
    t.timeout();
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    expect(t.view('p1').me!.hard!.offer).toEqual({ role: 'omotenashi' });
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    let v = t.customer();
    while (v.takerId !== 'p1') {
      t.fill(v);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
      v = t.customer();
    }
    const g = t.view('p1').me!.hard!.guests[v.id]!;
    expect(g.steps[0]!.model.text).toContain('おすわりください');
    expect(t.view().hard!.guests[v.id]!.ask).toBeNull();
    t.play('p1', { kind: 'omotenashi', visitId: v.id, utterance: speech('いらっしゃいませ。おすわりください。') });
    const ask = GUEST_ASKS.find((a) => a.id === t.r.hard!.guests[0]!.askId)!;
    expect(t.view().hard!.guests[v.id]!.ask).toEqual(ask.ask);
    if (ask.kind === 'decline') {
      t.play('p1', { kind: 'omotenashi', visitId: v.id, utterance: speech('ここでは だめです。') });
      const hint = t.view('p1').me!.hard!.guests[v.id]!.steps[1]!.hint!;
      expect(hint).toContain('ごえんりょ');
      expect(JSON.stringify(t.view())).not.toContain(hint);
      expect(JSON.stringify(t.view())).not.toContain('だめです');
    }
    t.play('p1', { kind: 'omotenashi', visitId: v.id, utterance: speech(ask.model.text) });
    expect(t.view().hard!.guests[v.id]!.said.length).toBe(2);
    t.fill(v);
    t.play('p1', { kind: 'serve', visitId: v.id });
    expect(t.view().hard!.guests[v.id]!.stars).toBe(3);
    expect(t.play('p1', { kind: 'omotenashi', visitId: v.id, skip: true }).error).toBe('too-late');
    expect(offerStats(t.st.hard!.offers)).toMatchObject({ offered: 2, accepted: 1, declined: 1 });
  });
});
