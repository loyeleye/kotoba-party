import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { withExperiments } from '../shared/src/modes/experiments.js';
import { STAND_IN_CURVEBALL_MS, standInSetupFor, standInVoiceMs } from '../shared/src/modes/mixedRoom.js';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import { STAND_IN_AT_MS, TIPS, type BentoState, type BentoView, type Round, type Visit } from '../shared/src/modes/bentoHaus/bentoHaus.js';
import {
  atStepLevel,
  checkLine,
  complaintSteps,
  creditedLine,
  DESK_LINGER_MS,
  GALLERY_MS,
  GUEST_ASKS,
  INCIDENT_MS,
  offerStats,
  rolesFor,
  SORRY_OMACHI,
  SPECIAL_EVERY,
  SPECIALS,
  SURE_OMACHI,
  THANKS,
  WELCOME,
  WELCOME_N3_ALT,
  winBack,
  type RoleOffer,
  type StepScript,
} from '../shared/src/modes/bentoHaus/hardRoles.js';
import { curveballPoints, CURVEBALL_POINTS, SAY_PICK, SPOKEN_REACTION_POINTS } from '../shared/src/modes/mixedRoom.js';
import { framesOf } from '../shared/src/japanese/frames.js';
import { COUNTS, CUSTOMERS, FOODS, foodOf } from '../shared/src/modes/bentoHaus/menu.js';
import type { Command } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
import { content as REAL_CONTENT } from './helpers.js';

// standInSetup's gap after the setup line, from its bank line (at least STAND_IN_SETUP_MS).
const SETUP_MS = standInSetupFor(REAL_CONTENT.hostLines, 'bento_standin_setup');

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

const FRAMES = new Set(['te-moraeru', 'te-itadakemasen', 'o-kudasai', 'keigo', 'te-aru']);

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
    expect(checkLine(speech('もうしわけ ございません。おたばこは ごえんりょ いただけますか。'), { check: 'decline', keys: smoking.keys }).ok).toBe(true);
    expect(checkLine(speech('おたばこは ごえんりょ おねがいします。'), { check: 'decline', keys: smoking.keys }).ok).toBe(true);
    const step = { check: smoking.kind, keys: smoking.keys };
    const no = checkLine(speech('たばこを すっては いけません。'), step);
    expect(no.ok).toBe(false);
    expect(no.hint).toContain('ごえんりょ');
    expect(checkLine(speech('ごえんりょ ください。'), step).ok).toBe(false);
  });

  // N3 (docs/n3-coverage.md): an N3 order-taker's おもてなし lines use ＿させて いただきます and ＿て おります. Anyone may
  // say them and is credited with the N3 line; an N3 player who says the N4 line is credited with that one.
  it('N3 おもてなし lines pass their check, carry their N3 frames, and credit the form that was said', () => {
    const steps = [WELCOME, { ...WELCOME, n3: WELCOME_N3_ALT }, ...GUEST_ASKS.map((a): StepScript => ({ to: 'customer', check: a.kind, model: a.model, n3: a.n3, ...(a.keys ? { keys: a.keys } : {}) }))];
    for (const st of steps) {
      const n3 = atStepLevel(st, 'n3');
      expect(n3.model, st.model.text).toBe(st.n3);
      expect(n3.plain, st.model.text).toBe(st.model);
      const said = framesOf({ text: st.n3!.text, kana: st.n3!.kana }, undefined, { keepHidden: true });
      for (const f of st.n3!.frames ?? []) expect([st.n3!.text, f, said.includes(f as never)]).toEqual([st.n3!.text, f, true]);
      // The N3 line, from an N3 or an N4 player, is credited as the N3 line.
      for (const step of [n3, st]) {
        const r = checkLine(speech(st.n3!.text), step);
        expect([st.n3!.text, r.ok, r.form]).toEqual([st.n3!.text, true, 'n3']);
        expect(creditedLine(step, r.form, r.frames)).toBe(st.n3);
      }
      // The N4 line from an N3 player is still fine, credited as itself.
      const r = checkLine(speech(st.model.text), n3);
      expect([st.model.text, r.ok, r.form]).toEqual([st.model.text, true, 'plain']);
      expect(creditedLine(n3, r.form, r.frames)).toBe(st.model);
      expect(atStepLevel(st, 'n4')).toBe(st);
    }
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
    // 〜て くれませんか to your own kitchen is fine too, tagged te-kuremasen.
    expect(checkLine(speech('からあげを もう ひとつ つくって くれませんか'), kitchen)).toEqual({ ok: true, hint: null, frames: ['te-kuremasen'], form: 'kuremasen' });
    expect(checkLine(speech('もう ひとつ つくって くれますか'), kitchen).ok).toBe(false);
    // おまち いただけますか (without the て) is a polite ask to a customer.
    expect(checkLine(speech('かしこまりました。しょうしょう おまち いただけますか。'), { check: 'ask' }).ok).toBe(true);
    expect(checkLine(speech('もうしわけ ございません。おまち いただけませんか。'), sorry).ok).toBe(true);
    expect(checkLine(speech('どうぞ すわって ください'), { check: 'welcome' }).ok).toBe(false);
    expect(checkLine(speech('しょうしょう おまちください'), { check: 'welcome' }).ok).toBe(true);
    expect(checkLine(speech('おはしを よういして います'), { check: 'ready' }).ok).toBe(false);
  });

  it('smoking and phone calls come only from Cheeky customers', () => {
    expect(GUEST_ASKS.find((a) => a.id === 'smoking')!.customers).toEqual(['buchou']);
    expect(GUEST_ASKS.find((a) => a.id === 'phone')!.customers).toEqual(['zangyou']);
    expect(THANKS.en).toBe('Thanks. You saved me.');
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
  it('rotates the manager seat with nextOfferee; the rest get おもてなし', () => {
    expect(rolesFor(1, [p('a', 'n5'), p('b', 'kana')])).toEqual([]);
    const two = [p('a', 'n4'), p('b', 'n5'), p('c', 'n4')];
    expect(rolesFor(1, two)).toEqual([
      { playerId: 'a', role: 'manager' },
      { playerId: 'c', role: 'omotenashi' },
    ]);
    // Fewest offers of the seat first: c, then a again.
    const log: RoleOffer[] = [{ round: 1, playerId: 'a', role: 'manager', answer: 'accepted' }];
    expect(rolesFor(2, two, log).find((o) => o.role === 'manager')!.playerId).toBe('c');
    log.push({ round: 2, playerId: 'c', role: 'manager', answer: 'accepted' });
    expect(rolesFor(3, two, log).find((o) => o.role === 'manager')!.playerId).toBe('a');
    // A lone N4 player in a small room keeps the seat while they take it…
    const one = [p('a', 'n4'), p('b', 'n5')];
    expect(rolesFor(2, one, [{ round: 1, playerId: 'a', role: 'manager', answer: 'accepted' }])[0]!.role).toBe('manager');
    // …sits it out for a shift after saying no (the おもてなし shift instead)…
    expect(rolesFor(2, one, [{ round: 1, playerId: 'a', role: 'manager', answer: 'declined' }])[0]!.role).toBe('omotenashi');
    // …and in a room of 4 or more, gets it every other shift.
    const four = [p('a', 'n4'), p('b', 'n5'), p('c', 'n5'), p('d', 'kana')];
    const seat = (r: number, o: RoleOffer[]) => rolesFor(r, four, o)[0]!.role;
    expect(seat(2, [{ round: 1, playerId: 'a', role: 'manager', answer: 'accepted' }])).toBe('omotenashi');
    expect(seat(3, [{ round: 1, playerId: 'a', role: 'manager', answer: 'accepted' }])).toBe('manager');
  });

  it('a disconnected N4 player is never offered a role', () => {
    const t = new Table(['n4', 'n5', 'n4']);
    t.act({ type: 'connection', playerId: 'p1', connected: false });
    t.toPrompt();
    expect(t.st.hard!.offers.map((o) => [o.playerId, o.role])).toEqual([['p3', 'manager']]);
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'manager' });
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
    expect(offerStats(t.st.hard!.offers)).toEqual({ offered: 2, accepted: 1, declined: 1, timeout: 0, away: 0, rate: 0.5 });
    expect(t.view().hard!.manager).toBe('p1');
  });

  it('a declined deputy manager seat passes to the next N4 player in turn, each pass a new logged offer', () => {
    const t = new Table(['n4', 'n5', 'n4', 'n4']);
    t.toPrompt();
    // Shift 1: p1 has the seat; p3 and p4 are offered おもてなし. p4 takes おもてなし first.
    expect(t.play('p4', { kind: 'role', accept: true }).error).toBeUndefined();
    expect(t.play('p1', { kind: 'role', accept: false }).error).toBeUndefined();
    // The seat goes to p3 (next N4 in turn), replacing p3's unanswered おもてなし offer; p4 already has a role.
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'manager' });
    expect(t.view('p1').me!.hard).toBeUndefined();
    expect(t.st.hard!.offers.filter((o) => o.playerId === 'p3')).toEqual([{ round: 1, playerId: 'p3', role: 'manager', answer: null }]);
    t.open();
    expect(t.play('p3', { kind: 'role', accept: true }).error).toBeUndefined();
    expect(t.view().hard!.manager).toBe('p3');
    expect(t.view('p3').me!.hard).toMatchObject({ offer: null, role: 'manager' });
    expect(t.st.hard!.offers.map((o) => [o.playerId, o.role, o.answer])).toEqual([
      ['p1', 'manager', 'declined'],
      ['p4', 'omotenashi', 'accepted'],
      ['p3', 'manager', 'accepted'],
    ]);
    expect(offerStats(t.st.hard!.offers)).toMatchObject({ offered: 3, accepted: 2, declined: 1 });
  });

  it('when every N4 player declines the seat, it stays empty for the shift', () => {
    const t = new Table(['n4', 'n5', 'n4']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: false });
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'manager' });
    t.play('p3', { kind: 'role', accept: false });
    // Back round to p1, who already said no: nobody else is asked.
    expect(t.view('p1').me!.hard).toBeUndefined();
    expect(t.view('p3').me!.hard).toBeUndefined();
    expect(t.st.hard!.offers.map((o) => [o.playerId, o.role, o.answer])).toEqual([
      ['p1', 'manager', 'declined'],
      ['p3', 'manager', 'declined'],
    ]);
    t.open();
    expect(t.view().hard!.manager).toBeNull();
    // Next shift, both sit the seat out (a no last time means no nagging): both are offered おもてなし.
    t.timeout();
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'omotenashi' });
    expect(t.view('p1').me!.hard?.offer).toEqual({ role: 'omotenashi' });
    // The shift after, the seat is offered again.
    t.open();
    t.timeout();
    t.timeout();
    expect(t.view('p1').me!.hard?.offer).toEqual({ role: 'manager' });
  });

  it('a lone N4 player declining the seat leaves it empty', () => {
    const t = new Table(['n4', 'n5']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: false });
    expect(t.st.hard!.offers).toHaveLength(1);
    expect(t.view('p1').me!.hard).toBeUndefined();
  });

  it('an offer still open at closing time is a timeout, counted against the rate', () => {
    const t = new Table(['n4', 'n5', 'n4']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    expect(t.st.hard!.offers.find((o) => o.playerId === 'p3')!.answer).toBeNull();
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(t.st.hard!.offers.find((o) => o.playerId === 'p3')!.answer).toBe('timeout');
    expect(offerStats(t.st.hard!.offers)).toMatchObject({ accepted: 1, timeout: 1, rate: 0.5 });
    expect(t.play('p3', { kind: 'role', accept: true }).error).toBeDefined();
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
    // The fix landed: half the tips the box lost (rounded up) come back for the team.
    const back = winBack(TIPS.perfect * (v.rush ? 2 : 1) - (v.tips - inc.won!));
    expect(back).toBeGreaterThan(0);
    expect(inc.won).toBe(back);
    expect(t.r.tips).toBe(tips + back);
    expect(t.view().hard!.desk[0]!.won).toBe(back);
    expect(t.r.bonus.p1).toBeGreaterThan(0);
    expect(t.view().hard!.handled).toEqual({ done: 1, of: 1 });
  });

  it('a line whose words were opened before the first try is logged as seen', () => {
    const t = managerTable();
    const v = t.customer();
    t.fill(v, v.lines[0]!.foodId);
    t.r.bakeUsed = true;
    t.play(v.takerId, { kind: 'serve', visitId: v.id });
    const inc = t.r.hard!.incidents.at(-1)!;
    expect(t.view('p1').me!.hard!.desk[0]!.steps[0]!.check).toBe('sorry-ask');
    // Peeked, missed once, then right: still read off the screen.
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech('すみません。'), peeked: true });
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech('もうしわけ ございません。すこし まって いただけますか。') });
    expect(t.s.phrasebook.p1!.at(-1)!.outcome).toBe('seen');
  });

  it('the yuki-onna asks for ice; the kitchen line names こおり', () => {
    const ice = SPECIALS.find((x) => x.id === 'ice')!;
    expect(ice.customers).toEqual(['yukionna']);
    expect(ice.steps[1].keys).toEqual(['こおり']);
    expect(checkLine(speech('こおりを いれて もらえますか'), ice.steps[1]).ok).toBe(true);
  });

  it('the kappa, the fox and the one-eyed boy have their own special orders, at the right station', () => {
    const own = (id: string) => SPECIALS.find((x) => x.id === id)!;
    const cases: [string, string, string, string][] = [
      ['kyuuri-more', 'kappa', 'kyuuri', 'きゅうりを もう すこし いれて もらえますか'],
      ['inari-apart', 'kitsune', 'inari', 'いなりずしを べつの はこに いれて もらえますか'],
      ['big-eye', 'hitotsume', 'onigiri', 'おにぎりを おおきく して もらえますか'],
    ];
    for (const [id, customer, food, line] of cases) {
      const x = own(id);
      expect(x.customers).toEqual([customer]);
      expect(CUSTOMERS.some((c) => c.id === customer), customer).toBe(true);
      expect(FOODS.some((f) => f.id === food), food).toBe(true);
      expect(x.foodId).toBe(food);
      expect(x.steps[1].model.frames).toEqual(['te-moraeru']);
      expect(checkLine(speech(line), x.steps[1]).ok, id).toBe(true);
    }
    // The kitchen line must name what the station adds.
    expect(checkLine(speech('もう すこし いれて もらえますか'), own('kyuuri-more').steps[1]).ok).toBe(false);
  });

  it('special orders come every few customers, and run out after a while', () => {
    const t = managerTable();
    const seen: Visit[] = [];
    // Pon's disguise or taste-test would turn a box into a complaint and keep the desk busy.
    t.r.bakeUsed = true;
    t.r.ajimi = { visitId: 'none', foodId: 'none', at: 0 };
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

  it('views carry the server clock, so a finished desk leaves the TV after its linger', () => {
    const t = managerTable();
    const v = t.customer();
    // viewFor builds views with now 0; the view's at is the last time the mode ran.
    expect(t.view().at).toBe(t.now);
    expect(t.view('p1').at).toBe(t.now);
    t.fill(v, v.lines[0]!.foodId);
    t.r.bakeUsed = true;
    t.play(v.takerId, { kind: 'serve', visitId: v.id });
    const inc = t.r.hard!.incidents.at(-1)!;
    t.play('p1', { kind: 'manager', incidentId: inc.id, skip: true });
    t.play('p1', { kind: 'manager', incidentId: inc.id, skip: true });
    expect(inc.state).toBe('missed');
    expect(t.view().hard!.desk.map((d) => d.id)).toEqual([inc.id]);
    t.now = inc.endedAt! + DESK_LINGER_MS;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.view().at).toBe(t.now);
    expect(t.view().hard!.desk).toEqual([]);
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

// ---- round 4: the manager's seat, credit, and mixed rooms ----

/** Serve a box with one thing off (a food left out, or one extra), so the deputy manager gets a complaint. */
function complain(t: Table) {
  t.r.bakeUsed = true;
  t.r.ajimi ??= { visitId: 'none', foodId: 'none', at: 0 };
  const v = t.customer();
  if (v.lines.length > 1) t.fill(v, v.lines[0]!.foodId);
  else {
    t.fill(v);
    const extra = t.r.menu.find((id) => !v.lines.some((l) => l.foodId === id))!;
    v.box[extra] = 1;
  }
  expect(t.play(v.takerId, { kind: 'serve', visitId: v.id }).error).toBeUndefined();
  const inc = t.r.hard!.incidents.at(-1)!;
  expect(inc.kind).toBe('complaint');
  return { v, inc };
}
const SORRY_LINE = 'もうしわけ ございません。すこし まって いただけますか。';
const cuesOf = (t: Table, event: string) => t.s.cues.filter((c) => c.event === event);

function seated(levels: Level[]) {
  const t = new Table(levels);
  t.toPrompt();
  expect(t.play('p1', { kind: 'role', accept: true }).error).toBeUndefined();
  t.open();
  return t;
}

describe('Bento Haus hard roles: the deputy manager’s seat', () => {
  it('the deputy manager takes no ordinary orders while holding the seat; the others take them all', () => {
    const t = seated(['n4', 'n5', 'kana']);
    t.r.bakeUsed = true;
    for (let k = 0; k < 4 && t.s.phase === 'answer'; k++) {
      const v = t.customer();
      expect(v.takerId).not.toBe('p1');
      t.fill(v);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
    }
    expect(t.r.visits.length).toBeGreaterThanOrEqual(3);
  });

  it('a deputy manager alone in the room still takes the orders', () => {
    const t = seated(['n4']);
    expect(t.customer().takerId).toBe('p1');
  });

  it('a declined seat still passes to the next N4 player (nextOfferee), and they then take no orders', () => {
    const t = new Table(['n4', 'n5', 'n4']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: false });
    expect(t.view('p3').me!.hard?.offer).toEqual({ role: 'manager' });
    t.play('p3', { kind: 'role', accept: true });
    t.open();
    t.r.bakeUsed = true;
    for (let k = 0; k < 3 && t.s.phase === 'answer'; k++) {
      const v = t.customer();
      expect(v.takerId).not.toBe('p3');
      t.fill(v);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
    }
  });

  it('a fix that lands wins back half the tips the box lost, rounded up; a missed one wins nothing', () => {
    expect([0, 1, 2, 3, 4].map(winBack)).toEqual([0, 1, 1, 2, 2]);
    const t = seated(['n4', 'n5']);
    const { v, inc } = complain(t);
    const before = t.r.tips;
    expect(inc.lost).toBe(TIPS.perfect * (v.rush ? 2 : 1) - v.tips);
    t.play('p1', { kind: 'manager', incidentId: inc.id, skip: true });
    t.play('p1', { kind: 'manager', incidentId: inc.id, skip: true });
    expect(inc.state).toBe('missed');
    expect(t.r.tips).toBe(before);
    expect(inc.won).toBeUndefined();
  });

  it('"Need the words?" opens by itself on the deputy manager’s first incident of the game only', () => {
    const t = seated(['n4', 'n5']);
    const first = complain(t).inc;
    expect(t.view('p1').me!.hard!.desk[0]!.firstHelp).toBe(true);
    t.play('p1', { kind: 'manager', incidentId: first.id, skip: true });
    t.play('p1', { kind: 'manager', incidentId: first.id, skip: true });
    const second = complain(t).inc;
    expect(second.id).not.toBe(first.id);
    expect(t.view('p1').me!.hard!.desk[0]!.firstHelp).toBe(false);
  });
});

describe('Bento Haus hard roles: crediting only the frames used', () => {
  const tags = (text: string) => framesOf({ text, kana: text });

  it('a kitchen line said with くれますか is credited te-kuremasen, not te-moraeru', () => {
    const t = seated(['n4', 'n5']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(SORRY_LINE) });
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(inc.steps[1]!.model.text.replace('もらえますか', 'くれますか')) });
    expect(inc.state).toBe('asked');
    const entry = t.s.phrasebook.p1!.at(-1)!;
    expect(entry.text).toContain('くれますか');
    expect(entry.itemId).toMatch(/:kureru$/);
    expect(tags(entry.text)).toContain('te-kuremasen');
    expect(tags(entry.text)).not.toContain('te-moraeru');
    expect(inc.steps[1]!.heardFrames).toEqual(['te-kuremasen']);
    // The station's card and the TV show the line in the form it was said.
    expect(t.view(inc.stationId!).me!.hard!.requests[0]!.text).toContain('くれますか');
    expect(t.view().hard!.desk[0]!.said.at(-1)!.text).toContain('くれますか');
  });

  it('a kitchen line said with いただけますか is credited te-itadakemasen', () => {
    const step = complaintSteps({ foodId: 'karaage', how: 'missing' }, 1, false)[1];
    const res = checkLine(speech('からあげを もう ひとつ つくって いただけますか'), step);
    expect(res).toMatchObject({ ok: true, form: 'itadaku', frames: ['te-itadakemasen'] });
    const line = creditedLine(step, res.form, res.frames);
    expect(line.text).toBe('からあげを もう ひとつ つくって いただけますか。');
    expect(tags(line.text)).toContain('te-itadakemasen');
    expect(tags(line.text)).not.toContain('te-moraeru');
    expect(creditedLine(step, undefined)).toBe(step.model);
  });

  it('the ask step accepts しょうしょう おまちください, credited o-kudasai', () => {
    for (const x of [SURE_OMACHI, SORRY_OMACHI]) {
      expect(x.kana).toBe(x.text);
      for (const f of x.frames ?? []) expect(FRAMES.has(f), f).toBe(true);
      expect(tags(x.text)).toContain('o-kudasai');
      expect(tags(x.text)).not.toContain('te-itadakemasen');
    }
    const ask = SPECIALS.find((x) => x.id === 'no-wasabi')!.steps[0];
    expect(ask.alt).toBe(SURE_OMACHI);
    expect(checkLine(speech('かしこまりました。しょうしょう おまちください。'), ask)).toMatchObject({ ok: true, form: 'omachi', frames: ['o-kudasai'] });
    expect(creditedLine(ask, 'omachi').text).toBe(SURE_OMACHI.text);
    // A complaint's sorry step asks them to wait too; the dream's (make it a rice ball instead) doesn't.
    const sorry = complaintSteps({ foodId: 'karaage', how: 'missing' }, 1, false)[0];
    expect(checkLine(speech('もうしわけ ございません。しょうしょう おまちください。'), sorry)).toMatchObject({ ok: true, form: 'omachi', frames: ['keigo', 'o-kudasai'] });
    const dream = SPECIALS.find((x) => x.id === 'dream')!.steps[0];
    expect(checkLine(speech('もうしわけ ございません。しょうしょう おまちください。'), dream).ok).toBe(false);
    expect(checkLine(speech('しょうしょう おまちください。'), sorry).ok).toBe(false);
  });

  it('an ask said with おまちください goes in the phrasebook as that line', () => {
    const t = seated(['n4', 'n5']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech('もうしわけ ございません。しょうしょう おまちください。') });
    expect(inc.step).toBe(1);
    expect(t.s.phrasebook.p1!.at(-1)!.text).toBe(SORRY_OMACHI.text);
  });
});

describe('Bento Haus hard roles: guests reply', () => {
  it('every guest has a short draft reply, shown on the TV once their question is answered', () => {
    for (const a of GUEST_ASKS) expect(a.reply.text.length, a.id).toBeGreaterThan(0);
    const t = new Table(['n4', 'n5']);
    t.toPrompt();
    t.play('p1', { kind: 'role', accept: false });
    t.open();
    t.timeout();
    t.timeout();
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    let v = t.customer();
    while (v.takerId !== 'p1') {
      t.fill(v);
      t.play(v.takerId, { kind: 'serve', visitId: v.id });
      v = t.customer();
    }
    t.play('p1', { kind: 'omotenashi', visitId: v.id, utterance: speech('いらっしゃいませ。おすわりください。') });
    expect(t.view().hard!.guests[v.id]!.reply).toBeNull();
    const ask = GUEST_ASKS.find((a) => a.id === t.r.hard!.guests[0]!.askId)!;
    t.now += 8_000;
    t.play('p1', { kind: 'omotenashi', visitId: v.id, utterance: speech(ask.model.text) });
    expect(t.view().hard!.guests[v.id]!.reply).toEqual(ask.reply);
    // Pon's reaction to a guest looked after perfectly.
    expect(cuesOf(t, 'bento_omotenashi_win')).toHaveLength(1);
  });
});

describe('Bento Haus mixed rooms: the booth and the Gallery', () => {
  it('a skipped apology gets no booth and no Gallery', () => {
    const t = seated(['n4', 'n5', 'kana']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, skip: true });
    expect(t.r.hard!.booth ?? null).toBeNull();
    expect(t.view().hard!.booth).toBeNull();
    expect(t.view('p2').me!.hard?.gallery ?? null).toBeNull();
    expect(cuesOf(t, 'bento_replay')).toEqual([]);
  });

  it.each([true, false])('a Gallery player may say their reaction for a small bonus; a miss leaves the tiles to tap (spoken reaction: %s)', (on) => {
    onTestFinished(withExperiments({ spokenReaction: on }));
    const t = seated(['n4', 'n5', 'kana']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: heard('申し訳ございません、少々待っていただけますか') });
    const P = 'p3';
    const say = (text: string) => t.play(P, { kind: 'gallery', pick: SAY_PICK, utterance: { via: 'speech', text } });
    const before = t.s.players.find((p) => p.id === P)!.score;
    if (!on) {
      // Switch off: a said reaction is refused, the tile offers no mic, and tapping works as before.
      expect(say('すごい！').error).toBe('not-allowed');
      expect(t.view(P).me!.hard!.gallery).not.toHaveProperty('say');
      expect(t.play(P, { kind: 'gallery', pick: 'sugoi' }).error).toBeUndefined();
      expect(t.s.players.find((p) => p.id === P)!.score).toBe(before);
      return;
    }
    expect(t.view(P).me!.hard!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: false } });
    // A miss: no tile, no points, nothing on the TV; the phone says to tap instead.
    expect(say('ありがとう').error).toBeUndefined();
    expect(t.view(P).me!.hard!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: true } });
    expect(t.s.players.find((p) => p.id === P)!.score).toBe(before);
    // A match (a little ending is fine): picks that tile, pays the bonus, shows a said bubble on the TV.
    expect(say('すごいね！').error).toBeUndefined();
    expect(t.view(P).me!.hard!.gallery).toMatchObject({ kind: 'react', picked: 'sugoi', say: { said: true, missed: false } });
    expect(t.s.players.find((p) => p.id === P)!.score - before).toBe(SPOKEN_REACTION_POINTS);
    expect(t.view().hard!.gallery).toEqual([expect.objectContaining({ id: 'sugoi', said: true })]);
    // In the phrasebook as said, but read: the tile shows the kana.
    expect(t.s.phrasebook[P]?.find((e) => e.itemId === 'gallery-sugoi')).toMatchObject({ outcome: 'said', recall: 'read', kana: 'すごい！' });
    // One reaction a round, said or tapped.
    expect(say('なるほど').error).toBe('not-allowed');
  });

  it.each([true, false])('once the apology lands: Pon voices the fixed line, the TV lights いただけますか, the others get tiles and the gist (scaled curveball: %s)', (scaled) => {
    onTestFinished(withExperiments({ scaledCurveball: scaled }));
    const t = seated(['n4', 'n5', 'kana']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: heard('申し訳ございません、少々待っていただけますか') });
    expect(inc.step).toBe(1);
    // The fixed model line is voiced, never the player's own words.
    expect(cuesOf(t, 'bento_replay')).toEqual([{ host: 'pon', event: 'bento_replay', slots: { line: SORRY_LINE, line_kana: SORRY_LINE, line_en: "I'm terribly sorry. Could you wait a moment?" } }]);
    const tv = t.view().hard!;
    expect(tv.booth).toMatchObject({ playerId: 'p1', lit: { key: 'いただけますか' } });
    expect(tv.booth!.note.length).toBeGreaterThan(0);
    // Gist on Kana and N5 phones (romaji for Kana), none for the deputy manager.
    expect(t.view('p2').me!.hard!.booth).toMatchObject({ romaji: null });
    expect(t.view('p3').me!.hard!.booth!.romaji).toBeTruthy();
    expect(t.view('p1').me!.hard!.booth).toBeNull();
    // Tiles: a Kana/N5 player picked by the seed (here p2) gets the curveball, the other reacts; the deputy
    // manager gets none.
    expect(t.view('p1').me!.hard!.gallery).toBeNull();
    expect(t.view('p2').me!.hard!.gallery!.kind).toBe('curveball');
    expect(t.view('p3').me!.hard!.gallery!.kind).toBe('react');
    expect(t.play('p3', { kind: 'gallery', pick: 'sugoi' }).error).toBeUndefined();
    expect(t.play('p3', { kind: 'gallery', pick: 'warai' }).error).toBe('not-allowed');
    expect(t.view().hard!.gallery.map((b) => b.id)).toEqual(['sugoi']);
    // The right word: +5 to the normal score (+15 scaled: a tenth of a perfect box), once.
    const score = t.s.players.find((p) => p.id === 'p2')!.score;
    expect(t.play('p2', { kind: 'gallery', pick: 'いただけますか' }).error).toBeUndefined();
    expect(t.s.players.find((p) => p.id === 'p2')!.score).toBe(score + (scaled ? 15 : CURVEBALL_POINTS));
    expect(t.view('p2').me!.hard!.gallery).toMatchObject({ kind: 'curveball', right: true });
    expect(t.play('p2', { kind: 'gallery', pick: 'いただけますか' }).error).toBe('not-allowed');
    // The booth leaves after its 5–7 s; the tiles after GALLERY_MS.
    const booth = t.r.hard!.booth!;
    expect(booth.ms).toBeGreaterThanOrEqual(5_000);
    expect(booth.ms).toBeLessThanOrEqual(7_000);
    t.now = booth.at + booth.ms;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.view().hard!.booth).toBeNull();
    expect(t.view('p2').me!.hard?.booth ?? null).toBeNull();
    t.now = t.r.hard!.gallery!.until;
    t.act({ type: 'wake', phaseSeq: t.s.phaseSeq });
    expect(t.view().hard!.gallery).toEqual([]);
    expect(t.play('p3', { kind: 'gallery', pick: 'sugoi' }).error).toBe('too-late');
    expect(GALLERY_MS).toBe(12_000);
  });

  it('the curveball is dealt only once the line has landed, never with a word the line contained', () => {
    const t = seated(['n4', 'n5', 'kana']);
    const { inc } = complain(t);
    // The complaint is on the desk, nothing said yet: no tiles, no curveball.
    expect(t.r.hard!.gallery ?? null).toBeNull();
    expect(t.st.hard!.curveballUsed ?? false).toBe(false);
    expect(t.view('p2').me!.hard?.gallery ?? null).toBeNull();
    expect(t.view('p3').me!.hard?.gallery ?? null).toBeNull();
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(SORRY_LINE) });
    // Landed: exactly one curveball, and the game's is used.
    const tiles = ['p2', 'p3'].map((id) => t.view(id).me!.hard!.gallery!.kind);
    expect(tiles.filter((k) => k === 'curveball')).toHaveLength(1);
    expect(t.st.hard!.curveballUsed).toBe(true);
    const cb = t.r.hard!.gallery!.g.curveball!;
    const flat = SORRY_LINE.replace(/[\s　]/g, '');
    for (const o of cb.options) if (!o.correct) expect(flat.includes(o.kana)).toBe(false);
    // The TV holds the key word back while the curveball is open, and lights it once it's answered.
    expect(t.view().hard!.booth!.holdKey).toBe(true);
    t.play(cb.playerId, { kind: 'gallery', pick: cb.word });
    expect(t.view().hard!.booth!.holdKey).toBe(false);
  });

  it('a missed line deals no curveball; the game keeps it for a line that lands', () => {
    const t = seated(['n4', 'n5']);
    const a = complain(t).inc;
    t.play('p1', { kind: 'manager', incidentId: a.id, skip: true });
    expect(t.r.hard!.gallery ?? null).toBeNull();
    expect(t.st.hard!.curveballUsed ?? false).toBe(false);
    // Next shift, the line lands: the curveball comes then.
    t.timeout();
    t.timeout();
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    const b = complain(t).inc;
    t.play('p1', { kind: 'manager', incidentId: b.id, utterance: speech(SORRY_LINE) });
    expect(t.view('p2').me!.hard!.gallery!.kind).toBe('curveball');
  });

  it('once a shift, the curveball once a game; a wrong word scores nothing', () => {
    const t = seated(['n4', 'n5']);
    const a = complain(t).inc;
    t.play('p1', { kind: 'manager', incidentId: a.id, utterance: speech(SORRY_LINE) });
    const cb = t.view('p2').me!.hard!.gallery!;
    expect(cb.kind).toBe('curveball');
    if (cb.kind !== 'curveball') return;
    expect(cb.options.map((o) => o.kana)).toContain('いただけますか');
    const wrong = cb.options.find((o) => o.kana !== 'いただけますか')!;
    const score = t.s.players.find((p) => p.id === 'p2')!.score;
    t.play('p2', { kind: 'gallery', pick: wrong.kana });
    expect(t.s.players.find((p) => p.id === 'p2')!.score).toBe(score);
    t.play('p1', { kind: 'manager', incidentId: a.id, skip: true });
    // A second landing in the same shift: no second booth.
    const b = complain(t).inc;
    t.play('p1', { kind: 'manager', incidentId: b.id, utterance: speech(SORRY_LINE) });
    expect(cuesOf(t, 'bento_replay')).toHaveLength(1);
    // Next shift (p1 keeps the seat in a 2-player room): a new booth and tiles, but reactions only.
    t.timeout();
    t.timeout();
    t.play('p1', { kind: 'role', accept: true });
    t.open();
    const c = complain(t).inc;
    t.play('p1', { kind: 'manager', incidentId: c.id, utterance: speech(SORRY_LINE) });
    expect(cuesOf(t, 'bento_replay')).toHaveLength(2);
    expect(t.view('p2').me!.hard!.gallery!.kind).toBe('react');
  });

  it('Pon reacts when the deputy manager’s request is done', () => {
    const t = seated(['n4', 'n5']);
    const { inc } = complain(t);
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(SORRY_LINE) });
    t.play('p1', { kind: 'manager', incidentId: inc.id, utterance: speech(inc.steps[1]!.model.text) });
    t.now += 8_000;
    t.play(inc.stationId!, { kind: 'request-done', incidentId: inc.id });
    expect(cuesOf(t, 'bento_manager_win')).toHaveLength(1);
  });
});

describe('Bento Haus mixed rooms: the host stand-in', () => {
  it('in a 1–2-player room with nobody at N4, Pon plays the deputy manager once, on the first title card', () => {
    onTestFinished(withExperiments({ standInSetup: false, standInCurveball: false }));
    const t = new Table(['n5', 'kana']);
    t.toPrompt();
    const si = t.st.standIn!;
    expect(si).toBeDefined();
    expect(cuesOf(t, 'bento_standin')).toEqual([
      { host: 'pon', event: 'bento_standin', slots: { line: si.line.text, line_kana: si.line.kana, line_en: si.line.en }, atMs: STAND_IN_AT_MS },
    ]);
    expect(si.line.text).toContain('いただけますか');
    // Up 2.5 s in, once Pon's round call is done, and on the TV to the end of the 8 s title card.
    expect(STAND_IN_AT_MS).toBe(2_500);
    expect('standIn' in t.view()).toBe(false);
    t.wake();
    expect(t.now - (t.s.deadline! - 8_000)).toBe(STAND_IN_AT_MS);
    const tv = t.view().standIn!;
    expect(tv.lit.key).toBe('いただけますか');
    expect(tv.gist).toBeNull();
    expect(t.view('p1').standIn!.gist).toMatchObject({ romaji: null });
    expect(t.view('p2').standIn!.gist!.romaji).toBeTruthy();
    expect(si.ms).toBeLessThanOrEqual(7_000);
    t.now = t.s.deadline! - 1;
    expect('standIn' in t.view()).toBe(true);
    // No one is asked to say anything, no points, no hard-role state; and it's once a game.
    expect(t.st.hard).toBeUndefined();
    t.open();
    expect('standIn' in t.view()).toBe(false);
    t.timeout();
    t.timeout();
    expect(t.s.phase).toBe('prompt');
    expect('standIn' in t.view()).toBe(false);
    expect(cuesOf(t, 'bento_standin')).toHaveLength(1);
    expect(t.s.players.every((p) => p.score === 0)).toBe(true);
  });

  it('standInSetup: his ドロン！ line where the line began, the line 2.5 s later; the title card runs to its end', () => {
    onTestFinished(withExperiments({ standInSetup: true, standInCurveball: false }));
    const t = new Table(['n5']);
    t.toPrompt();
    const start = t.now;
    const si = t.st.standIn!;
    const at = STAND_IN_AT_MS + SETUP_MS;
    expect(cuesOf(t, 'bento_standin_setup')).toEqual([{ host: 'pon', event: 'bento_standin_setup', atMs: STAND_IN_AT_MS }]);
    expect(cuesOf(t, 'bento_standin')).toEqual([
      { host: 'pon', event: 'bento_standin', slots: { line: si.line.text, line_kana: si.line.kana, line_en: si.line.en }, atMs: at },
    ]);
    expect(si.at).toBe(start + at);
    expect(t.s.deadline! - start).toBe(Math.max(8_000, at + standInVoiceMs(si.line.kana)));
    t.wake();
    expect(t.view('p1').standIn!.gallery).toBeUndefined();
    expect(t.view('p1').standIn!.gist).toBeTruthy();
    expect(REAL_CONTENT.hostLines.find((l) => l.event === 'bento_standin_setup')!.jp.text).toContain('ドロン');
  });

  it('standInCurveball: a tile for both while he says it, then the curveball on いただけますか, +5 if right', () => {
    onTestFinished(withExperiments({ standInSetup: false, standInCurveball: true }));
    const t = new Table(['n5', 'kana']);
    t.toPrompt();
    const start = t.now;
    const si = t.st.standIn!;
    const said = si.at + standInVoiceMs(si.line.kana);
    expect(t.s.deadline!).toBe(Math.max(start + 8_000, said + STAND_IN_CURVEBALL_MS));
    t.wake();
    expect(t.now).toBe(si.at);
    expect(t.view('p1').standIn!.gallery).toMatchObject({ kind: 'react' });
    expect(t.view().standIn!.holdKey).toBe(true);
    expect(t.view('p1').standIn!.gist).toBeNull();
    expect(t.play('p1', { kind: 'gallery', pick: 'sugoi' }).error).toBeUndefined();
    expect(t.view().standIn!.bubbles!.map((b) => b.id)).toEqual(['sugoi']);
    t.wake();
    expect(t.now).toBe(said);
    const tile = t.view('p2').standIn!.gallery!;
    expect(tile.kind).toBe('curveball');
    if (tile.kind === 'curveball') expect(tile.options.every((o) => o.romaji)).toBe(true);
    expect(t.view('p1').standIn!.gist).toBeTruthy();
    expect(t.view('p2').standIn!.gist).toBeNull();
    expect(t.play('p2', { kind: 'gallery', pick: 'いただけますか' }).error).toBeUndefined();
    expect(t.s.players.find((p) => p.id === 'p2')!.score).toBe(curveballPoints('bento-haus'));
    // Answered and the line said: the title card ends now, or at its usual 8 s if that's later.
    if (t.s.phase === 'prompt') t.wake();
    expect(t.s.phase).toBe('answer');
    expect(t.now - start).toBe(Math.max(8_000, said - start));
  });

  it('a room with an N4 player, or of 3 or more, never gets the stand-in', () => {
    for (const levels of [['n4', 'n5'], ['n5', 'n5', 'kana']] as Level[][]) {
      const t = new Table(levels);
      t.toPrompt();
      expect(t.st.standIn).toBeUndefined();
      expect(cuesOf(t, 'bento_standin')).toEqual([]);
    }
  });

  it('an N5-only room of 3 or more is unchanged: no new state, views or cues', () => {
    const t = new Table(['n5', 'n5', 'kana']);
    t.toPrompt();
    expect(wakeAt(t.s, t.ctx())).toBeNull();
    t.open();
    const v = t.customer();
    t.fill(v, v.lines[0]!.foodId);
    t.play(v.takerId, { kind: 'serve', visitId: v.id });
    expect(t.st.hard).toBeUndefined();
    expect(t.st.standIn).toBeUndefined();
    for (const who of ['stage', 'p1', 'p3'] as const) {
      const view = t.view(who);
      expect('hard' in view).toBe(false);
      expect('standIn' in view).toBe(false);
      if (view.me) expect(view.me.hard).toBeUndefined();
    }
    expect(t.play('p1', { kind: 'gallery', pick: 'sugoi' }).error).toBe('bad-move');
    for (const e of ['bento_replay', 'bento_standin', 'bento_manager_win', 'bento_omotenashi_win']) expect(cuesOf(t, e)).toEqual([]);
  });
});
