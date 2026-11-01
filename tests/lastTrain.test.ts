// Last Train: rules with small fixtures (driven through the real room machine), then a full
// system run with bots playing over the network.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JpText, LastTrainMinigame, LastTrainScenario, MinigameItem } from '../content/src/types.js';
import { lastTrainScenarios } from '../content/src/last-train/index.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { checkUtterance, firstMora } from '../shared/src/modes/lastTrain/check.js';
import { toRomaji } from '../shared/src/japanese/romaji.js';
import { buildStops, itemIndex, mirrored, roleKey, RULES, type LastTrainState, type LastTrainView } from '../shared/src/modes/lastTrain/lastTrain.js';
import { CURVEBALL_POINTS } from '../shared/src/modes/mixedRoom.js';
import { framesOf } from '../shared/src/japanese/frames.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { lastTrainPolicy } from '../tools/bots/policies/lastTrain.js';
import { content as realContent, hashView, startServer, until } from './helpers.js';
import { createReader } from '../server/src/reading.js';

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
  cues: { host?: string; event: string; slots?: Record<string, string>; atMs?: number }[] = [];
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
    expect(toRomaji('コーヒー')).toBe('kōhī');
    expect(toRomaji('きんえん')).toBe("kin'en");
    expect(firstMora('しゃしん')).toBe('しゃ');
    expect(firstMora('きっぷ')).toBe('き');
  });
});

describe('Read the Signs', () => {
  const signs = realContent.lastTrainMinigames.find((m) => m.id === 'read-the-signs')!;
  it('draws a sign for every item, and its model answer is accepted', () => {
    expect(signs.items.length).toBeGreaterThanOrEqual(12);
    for (const it of signs.items) {
      expect(it.signs?.length, it.id).toBeGreaterThan(0);
      expect(checkUtterance({ via: 'typed', text: it.model.kana.replace(/。$/, '') }, it.accepted), it.id).toBe(true);
      if (it.mirror) expect(checkUtterance({ via: 'typed', text: it.mirror.model.kana.replace(/。$/, '') }, it.mirror.accepted), it.id).toBe(true);
      // Hints are pictures to remember a kanji by, never its reading. Kana signs carry the reading
      // instead: show first, then test.
      if (it.prompt.kana.includes('よみますか')) expect(it.hint, it.id).not.toContain(it.accepted[0]!);
      if (it.level === 'kana') for (const sg of it.signs!) expect(sg.reading, it.id).toBeTruthy();
    }
    expect(['kana', 'n5', 'n4'].every((l) => signs.items.some((it) => it.level === l))).toBe(true);
  });
  it('never writes a direction question with the signs it asks about', () => {
    for (const it of signs.items.filter((i) => (i.signs?.length ?? 0) > 1)) {
      for (const sg of it.signs!) expect(it.prompt.text, it.id).not.toContain(sg.text);
      expect(it.signs!.filter((sg) => sg.target).length, it.id).toBe(1);
      expect(it.mirror, it.id).toBeDefined();
    }
  });
  it('mirrors a pair of boards with the answer that then fits', () => {
    const exit = signs.items.find((i) => i.id === 'read-the-signs.06-deguchi-doko')!;
    const m = mirrored(exit);
    expect(m.id).toBe('read-the-signs.06-deguchi-doko~mirrored');
    expect(m.signs!.map((sg) => [sg.text, sg.arrow])).toEqual([['入口', 'left'], ['出口', 'right']]);
    expect(checkUtterance({ via: 'typed', text: 'みぎです' }, m.accepted)).toBe(true);
    expect(checkUtterance({ via: 'typed', text: 'ひだりです' }, m.accepted)).toBe(false);
    expect(itemIndex(realContent).get(m.id)?.accepted).toEqual(m.accepted);
  });
  it('rides the Obake Line, before its last stop', () => {
    const line = lastTrainScenarios.find((sc) => sc.id === 'obake-line')!;
    expect(line.stops.at(-2)!.minigameId).toBe('read-the-signs');
  });

  // A line of four 北口 stops, with the real Read the Signs and two penalty minigames.
  const KITA: LastTrainScenario = {
    ...SCENARIO,
    id: 'kita-line',
    stops: [1, 2, 3, 4].map((n) => ({ id: `k${n}`, name: { text: '北口', kana: 'きたぐち', en: 'Kitaguchi' }, minigameId: 'read-the-signs', announcement: t('つぎはきたぐち') })),
  };
  const SIGNS_CONTENT: ContentLibrary = { ...EMPTY_CONTENT, lastTrainMinigames: [signs, ...MINIGAMES.filter((m) => m.penalty)], lastTrainScenarios: [KITA] };

  it('skips signs the stop name gives away, and never shows a phone the answer', () => {
    const g = new Table(SIGNS_CONTENT, 6);
    g.start();
    g.until('answer');
    const dealt = Object.values(g.s.turns).map((tn) => tn.task.item.id);
    expect(dealt).toHaveLength(6);
    expect(dealt).not.toContain('read-the-signs.08-kitaguchi');
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      const task = g.task(id);
      expect(task.signs?.length).toBeGreaterThan(0);
      for (const sg of task.signs!) {
        expect(sg).not.toHaveProperty('target');
        // A pair is drawn plain on the first try: exit yellow or toilet red would give it away.
        if (task.signs!.length > 1) expect(sg).not.toHaveProperty('kind');
      }
    }
  });
  it('shows a Kana player a sign with its reading first, and tests a pair without it', () => {
    const g = new Table(SIGNS_CONTENT, 1);
    g.state.players[0]!.level = 'kana';
    g.start();
    g.until('answer');
    const first = g.task('p1');
    expect(first.signs).toHaveLength(1);
    expect(first.signs![0]!.reading).toBeTruthy();
    expect(first.hint).toBeTruthy();
    // A pair hides the readings until the retry.
    const pair = signs.items.find((i) => i.id === 'read-the-signs.06-deguchi-doko')!;
    g.s.turns.p1!.task.item = pair;
    expect(g.task('p1').signs!.every((sg) => !sg.reading && !sg.kind)).toBe(true);
    expect(g.task('p1').hint).toBeNull();
    g.say('p1', 'わからない');
    expect(g.task('p1').attempt).toBe(2);
    expect(g.task('p1').signs!.every((sg) => sg.reading)).toBe(true);
  });
  it('outlines the asked-about sign on the TV, and a miss never sends anyone to the penalty car', () => {
    const g = new Table(SIGNS_CONTENT, 6);
    g.start();
    g.until('reveal');
    const rows = g.view('stage').results!;
    expect(rows.every((r) => r.outcome === 'missed' && r.signs?.length)).toBe(true);
    for (const r of rows.filter((x) => x.signs!.length > 1)) expect(r.signs!.filter((sg) => sg.target)).toHaveLength(1);
    g.timeout();
    expect(g.state.phase).toBe('prompt');
    expect(Object.values(g.s.travellers).some((tr) => tr.ghost)).toBe(false);
  });
});

describe('Read the Signs readings', () => {
  it('the server reads every sign the way the game accepts it', async () => {
    const reader = (await createReader())!;
    // Read the Signs, and the inn's signs for the N4 front-desk guest (受付, 予約).
    const signItems = realContent.lastTrainMinigames.filter((m) => m.id === 'read-the-signs' || m.id === 'meet-the-innkeeper').flatMap((m) => m.items);
    // 北口 is きたぐち, not きたくち; 出口 alone is でぐち, not the dictionary's いでぐち.
    for (const it of signItems.filter((i) => i.signs?.length === 1)) {
      expect(checkUtterance({ via: 'speech', text: it.signs![0]!.text, reading: reader(it.signs![0]!.text) }, it.accepted), it.id).toBe(true);
    }
    expect(reader('出口は左です')).toBe('でぐちはひだりです');
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
    // The station's reading and English name ride along, so the voiced line never drops it.
    const stopCue = g.cues.find((c) => c.event === 'train_stop')!;
    expect(stopCue.slots?.stop_kana).toBeTruthy();
    expect(stopCue.slots?.stop_en).toBeTruthy();
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
    // The retry p1 was given is moot now: an answer to it that crossed the overrule is stale, not a repeat.
    expect(g.play('p1', { kind: 'answer', key: g.s.turns.p1!.task.key, utterance: { via: 'speech', text: 'さんびゃくえん' } })).toMatchObject({ error: 'wrong-phase' });
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
    // The same holds after the retry runs out too.
    const second = g.task('p1');
    g.now += second.limitMs;
    g.play('p1', { kind: 'tick' });
    expect(g.view('p1').me!.status).toBe('missed');
    expect(g.cmd('p1', { type: 'play', move: { kind: 'answer', key: second.key, utterance: { via: 'speech', text: 'さんびゃく' } } }).error).toBe('wrong-phase');
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

describe('Last Train hard roles (N4)', () => {
  const ROLE = { id: 'announcer', name: t('アナウンスがかり', 'アナウンスがかり', 'The announcer'), pitch: 'pitch' };
  const roleItem = (id: string, accepted: string[]): MinigameItem => ({ ...item(id, accepted, 'n4', 12), role: ROLE, frames: ['keigo'] });
  const ANNOUNCE = mg('station-announcement', [item('sa1', ['しぶやです']), item('sa2', ['うえのです']), roleItem('ann1', ['まもなくまいります']), roleItem('ann2', ['おさがりください'])], { promptType: 'listen-and-answer' });
  const LINE: LastTrainScenario = { ...SCENARIO, id: 'role-line', stops: SCENARIO.stops.map((st) => ({ ...st, minigameId: 'station-announcement' })) };
  const ROLE_CONTENT: ContentLibrary = { ...EMPTY_CONTENT, lastTrainMinigames: [ANNOUNCE, ...MINIGAMES.filter((m) => m.penalty)], lastTrainScenarios: [LINE] };
  const FRAMES = new Set(['te-itadakemasen', 'kamo', 'sou-look', 'sou-hear', 'hazu', 'te-aru', 'o-kudasai', 'keigo', 'sign-kanji']);

  const table = (lib: ContentLibrary, levels: MinigameItem['level'][]) => {
    const g = new Table(lib, levels.length);
    levels.forEach((level, i) => g.act({ type: 'command', actor: { kind: 'player', playerId: `p${i + 1}` }, command: { id: `lv${i}`, type: 'setLevel', level } }));
    return g;
  };
  const role = (g: Table, id: string, accept: boolean) => g.play(id, { kind: 'role', key: g.view(id).me!.offer!.key, accept });

  it('writes every role line at N4, tagged with its frames, in all three minigames', () => {
    const real = realContent.lastTrainMinigames;
    const roles = real.flatMap((m) => m.items.filter((i) => i.role).map((i) => ({ m: m.id, i })));
    expect(new Set(roles.map((r) => r.m))).toEqual(new Set(['station-announcement', 'lost-and-found', 'meet-the-innkeeper']));
    for (const { i } of roles) {
      expect(i.level, i.id).toBe('n4');
      expect(i.frames?.length, i.id).toBeGreaterThan(0);
      for (const f of i.frames!) expect(FRAMES.has(f), `${i.id}: ${f}`).toBe(true);
      expect(checkUtterance({ via: 'typed', text: i.model.kana.replace(/。$/, '') }, i.accepted), i.id).toBe(true);
      // Sign hints are pictures, never the reading.
      if (i.signs) expect(i.hint, i.id).not.toContain(i.accepted[0]!);
    }
    // Lost and Found has ordinary items for everyone else, and comes only as an N4 swap.
    const lost = real.find((m) => m.id === 'lost-and-found')!;
    expect(['kana', 'n5'].every((l) => lost.items.some((i) => i.level === l && !i.role))).toBe(true);
    expect(lost.n4Stop).toBe(true);
    const swaps = lastTrainScenarios.flatMap((sc) => sc.stops.filter((st) => st.withN4).map((st) => ({ sc, st })));
    expect(swaps.map(({ st }) => st.withN4!.minigameId)).toEqual(['lost-and-found', 'lost-and-found']);
    for (const { sc } of swaps) expect(sc.audience, sc.id).toBeUndefined();
    expect(lastTrainScenarios.flatMap((sc) => sc.stops).some((st) => st.minigameId === 'lost-and-found')).toBe(false);
  });

  it('changes nothing in a room with no N4 player: same stops, no offers, no role items', () => {
    const lib = { lastTrainMinigames: realContent.lastTrainMinigames, lastTrainScenarios };
    const all = Object.fromEntries(lib.lastTrainMinigames.map((m) => [m.id, m]));
    const before = Object.fromEntries(lib.lastTrainMinigames.filter((m) => m.id !== 'lost-and-found').map((m) => [m.id, m]));
    const penalties = lib.lastTrainMinigames.filter((m) => m.penalty).map((m) => m.id);
    const seeded = () => {
      let x = 7;
      return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    };
    for (const sc of lastTrainScenarios) {
      const plain = { ...sc, stops: sc.stops.map(({ withN4: _, ...st }) => st) };
      for (const want of [4, 6]) expect(buildStops(sc, want, all, penalties, seeded()), sc.id).toEqual(buildStops(plain, want, before, penalties, seeded()));
    }
    const g = table(ROLE_CONTENT, ['n5', 'kana']);
    g.start();
    g.until('answer');
    expect(Object.values(g.s.turns).every((tn) => !tn.task.item.role && tn.status === 'answering')).toBe(true);
    expect(g.view('p1').me!.offer).toBeNull();
    expect(g.s.roleLog).toEqual([]);
  });

  it('swaps in the lost property stop when the room has an N4 player', () => {
    const lib = { lastTrainMinigames: realContent.lastTrainMinigames, lastTrainScenarios };
    const minigames = Object.fromEntries(lib.lastTrainMinigames.map((m) => [m.id, m]));
    const obake = lastTrainScenarios.find((sc) => sc.id === 'obake-line')!;
    expect(buildStops(obake, 6, minigames, [], () => 0.5, true).map((st) => st.id)).toContain('obake-line.wasureno');
    expect(buildStops(obake, 6, minigames, [], () => 0.5, false).map((st) => st.id)).not.toContain('obake-line.wasureno');
    const hoshi = lastTrainScenarios.find((sc) => sc.id === 'hoshimidai-line')!;
    expect(buildStops(hoshi, 4, minigames, [], () => 0.5, true).map((st) => st.id)).toContain('hoshimidai-line.otonashi');
  });

  it('offers the hard role to one N4 player, privately; taking it shows the line to say, not play', () => {
    const g = table(ROLE_CONTENT, ['n4', 'n4', 'n5']);
    g.start();
    g.until('answer');
    const offered = ['p1', 'p2'].filter((id) => g.view(id).me!.offer);
    expect(offered).toEqual(['p1']);
    // The other N4 player gets the ordinary part, exactly as before hard roles.
    expect(g.s.turns.p2!.task.item.role).toBeUndefined();
    expect(g.view('p2').me!.task!.listen).toBe(true);
    // Nobody else sees the offer, and the TV just sees someone answering.
    expect(g.view('stage').travellers.find((x) => x.playerId === 'p1')!.status).toBe('answering');
    expect(JSON.stringify(g.view('stage'))).not.toContain('アナウンスがかり');
    expect(JSON.stringify(g.view('p3'))).not.toContain('アナウンスがかり');
    expect(g.view('p1').me!.task).toBeNull();
    // The phone counts down to the server's deadline, not from when it first drew the card.
    expect(g.view('p1').me!.offer!.deadline).toBe(g.now + RULES.offerMs);
    g.now += 3_000;
    expect(g.view('p1').me!.offer!.deadline - g.now).toBe(RULES.offerMs - 3_000);
    expect(role(g, 'p1', true).changed).toBe(true);
    const task = g.view('p1').me!.task!;
    expect(task.role?.en).toBe('The announcer');
    expect(task.listen).toBe(false);
    expect(task.limitMs).toBe(12_000);
    // The clock starts when the role is taken.
    expect(g.s.turns.p1!.task.deadline).toBe(g.now + 12_000);
    expect(g.s.roleLog).toEqual([expect.objectContaining({ playerId: 'p1', roleId: 'announcer', answer: 'accepted' })]);
    g.sayRight('p1');
    g.sayRight('p2');
    g.sayRight('p3');
    expect(g.state.phase).toBe('reveal');
    const rows = g.view('stage').results!;
    expect(rows.find((r) => r.playerId === 'p1')!.role?.en).toBe('The announcer');
    expect(rows.find((r) => r.playerId === 'p2')!.role).toBeNull();
    // A taken hard role pays RULES.roleBonus on top of the base (and the speech bonus scales with it).
    expect(RULES.roleBonus).toBe(20);
    expect(g.score('p1') - g.score('p2')).toBeGreaterThanOrEqual(RULES.roleBonus);
  });

  it('logs a bot\'s offer answer as a bot\'s, so it stays out of the gate', () => {
    const g = table(ROLE_CONTENT, ['n4']);
    g.start();
    g.until('answer');
    expect(g.play('p1', { kind: 'role', key: g.s.turns.p1!.task.key, accept: true, bot: true }).changed).toBe(true);
    expect(g.s.roleLog).toEqual([expect.objectContaining({ playerId: 'p1', answer: 'accepted', bot: true })]);
    const h = table(ROLE_CONTENT, ['n4']);
    h.start();
    h.until('answer');
    role(h, 'p1', true);
    expect(h.s.roleLog[0]!.bot).toBeUndefined();
  });

  it('"not this time" deals the ordinary item; no answer does too; offers rotate among N4 players', () => {
    const g = table(ROLE_CONTENT, ['n4', 'n4']);
    g.start(4);
    g.until('answer');
    expect(role(g, 'p1', false).changed).toBe(true);
    expect(g.view('p1').me!.offer).toBeNull();
    expect(g.s.turns.p1!.task.item.role).toBeUndefined();
    expect(g.s.turns.p1!.task.item.level).toBe('n5');
    expect(g.play('p1', { kind: 'role', key: g.s.turns.p1!.task.key, accept: true }).error).toBe('wrong-phase');
    g.until('prompt');
    g.until('answer');
    // Stop 2: p2's turn. No answer within the offer window deals the ordinary item.
    expect(g.view('p1').me!.offer).toBeNull();
    expect(g.view('p2').me!.offer).not.toBeNull();
    g.now += RULES.offerMs - 500;
    expect(g.play('p2', { kind: 'tick' }).changed).toBe(true);
    expect(g.s.turns.p2!.status).toBe('answering');
    expect(g.s.turns.p2!.task.item.role).toBeUndefined();
    g.until('prompt');
    g.until('answer');
    expect(g.view('p1').me!.offer).not.toBeNull();
    expect(g.s.roleLog.map((r) => [r.playerId, r.answer])).toEqual([
      ['p1', 'declined'],
      ['p2', 'timeout'],
      ['p1', 'away'],
    ]);
  });

  it('a missed hard role never sends anyone to the penalty car', () => {
    const g = table(ROLE_CONTENT, ['n4']);
    g.start();
    g.until('answer');
    role(g, 'p1', true);
    g.say('p1', 'だめ');
    g.say('p1', 'だめ');
    expect(g.state.phase).toBe('reveal');
    g.timeout();
    expect(g.state.phase).toBe('prompt');
    expect(g.s.travellers.p1!.ghost).toBe(false);
  });

  describe('Chōchin-san says a taken role’s line at the reveal (decided by Ladi: the host says the line)', () => {
    const reads = (g: Table) => g.cues.filter((c) => c.event === 'train_role_read');

    it('once, after his reaction, with the model line and its subtitle, only when the role was answered right', () => {
      const g = table(ROLE_CONTENT, ['n4', 'n5']);
      g.start();
      g.until('answer');
      role(g, 'p1', true);
      const model = g.s.turns.p1!.task.item.model;
      g.sayRight('p1');
      g.sayRight('p2');
      expect(g.state.phase).toBe('reveal');
      expect(reads(g)).toEqual([{ host: 'chochin', event: 'train_role_read', slots: { line: model.text, line_kana: model.kana, line_en: model.en }, atMs: RULES.roleReadAtMs }]);
      // The reaction still opens the reveal; the line follows it, and the reveal row and model answer stay.
      const at = g.cues.findIndex((c) => c.event === 'train_role_read');
      expect(g.cues.slice(0, at).some((c) => c.event === 'reveal_react' && c.atMs === undefined)).toBe(true);
      expect(g.view('stage').results!.find((r) => r.playerId === 'p1')).toMatchObject({ model, role: { en: 'The announcer' } });
      g.timeout();
      expect(reads(g)).toHaveLength(1);
    });

    it('on the retry too; never for a missed role, a declined one, or an ordinary item', () => {
      const retry = table(ROLE_CONTENT, ['n4']);
      retry.start();
      retry.until('answer');
      role(retry, 'p1', true);
      retry.say('p1', 'だめ');
      retry.sayRight('p1');
      expect(retry.state.phase).toBe('reveal');
      expect(reads(retry)).toHaveLength(1);

      const missed = table(ROLE_CONTENT, ['n4']);
      missed.start();
      missed.until('answer');
      role(missed, 'p1', true);
      missed.say('p1', 'だめ');
      missed.say('p1', 'だめ');
      expect(missed.state.phase).toBe('reveal');
      expect(reads(missed)).toHaveLength(0);

      const declined = table(ROLE_CONTENT, ['n4', 'n5']);
      declined.start();
      declined.until('answer');
      role(declined, 'p1', false);
      declined.sayRight('p1');
      declined.sayRight('p2');
      expect(declined.state.phase).toBe('reveal');
      expect(reads(declined)).toHaveLength(0);
    });

    it('for every role: the announcer, Lost and Found’s passenger and staff, and the guest at the inn', () => {
      for (const mgId of ['station-announcement', 'lost-and-found', 'meet-the-innkeeper']) {
        const real = realContent.lastTrainMinigames.find((m) => m.id === mgId)!;
        const line: LastTrainScenario = { ...SCENARIO, id: `${mgId}-line`, stops: SCENARIO.stops.map((st) => ({ ...st, minigameId: mgId })) };
        const lib: ContentLibrary = { ...EMPTY_CONTENT, lastTrainMinigames: [real, ...MINIGAMES.filter((m) => m.penalty)], lastTrainScenarios: [line] };
        const g = table(lib, ['n4']);
        g.start();
        g.until('answer');
        role(g, 'p1', true);
        const item = g.s.turns.p1!.task.item;
        expect(item.role, mgId).toBeDefined();
        g.sayRight('p1');
        expect(g.state.phase, mgId).toBe('reveal');
        expect(reads(g).map((c) => c.slots), mgId).toEqual([{ line: item.model.text, line_kana: item.model.kana, line_en: item.model.en }]);
        // Every role's model reading is kana only, so the host's TTS can say it.
        for (const i of real.items.filter((x) => x.role)) expect(i.model.kana, i.id).not.toMatch(/[\u3400-\u9fff]/);
      }
    });
  });

  it('rejects malformed role moves', () => {
    const g = table(ROLE_CONTENT, ['n4']);
    g.start();
    g.until('answer');
    expect(g.play('p1', { kind: 'role', key: 'x' }).error).toBe('bad-move');
    expect(g.play('p1', { kind: 'role', key: 'nope', accept: true }).error).toBe('wrong-phase');
  });
});

describe('Last Train mixed rooms (Gallery, commentary booth, host stand-in)', () => {
  const ANN = { id: 'announcer', name: t('アナウンスがかり', 'アナウンスがかり', 'The announcer'), pitch: 'pitch' };
  const GUEST = { id: 'front-desk-guest', name: t('フロントのおきゃくさま', 'フロントのおきゃくさま', 'The guest'), pitch: 'pitch' };
  const roleItem = (id: string, accepted: string[], role = ANN): MinigameItem => ({ ...item(id, accepted, 'n4', 12), role, frames: ['keigo'] });
  const ANNOUNCE = mg('station-announcement', [item('sa1', ['しぶやです']), item('sa2', ['うえのです']), roleItem('ann1', ['まもなくまいります']), roleItem('ann2', ['おさがりください'])], { promptType: 'listen-and-answer' });
  const INN = mg('meet-the-innkeeper', [item('mi1', ['こんばんは']), roleItem('g1', ['よんでいただけますか'], GUEST)]);
  const lineOf = (mgId: string): LastTrainScenario => ({ ...SCENARIO, id: `${mgId}-line`, stops: SCENARIO.stops.map((st) => ({ ...st, minigameId: mgId })) });
  const lib = (m: LastTrainMinigame): ContentLibrary => ({ ...EMPTY_CONTENT, lastTrainMinigames: [m, ...MINIGAMES.filter((x) => x.penalty)], lastTrainScenarios: [lineOf(m.id)] });
  const ROLES = lib(ANNOUNCE);
  const table = (content: ContentLibrary, levels: MinigameItem['level'][]) => {
    const g = new Table(content, levels.length);
    levels.forEach((level, i) => g.act({ type: 'command', actor: { kind: 'player', playerId: `p${i + 1}` }, command: { id: `lv${i}`, type: 'setLevel', level } }));
    return g;
  };
  const role = (g: Table, id: string, accept: boolean) => g.play(id, { kind: 'role', key: g.view(id).me!.offer!.key, accept });
  const offered = (g: Table) => Object.values(g.s.turns).filter((tn) => tn.status === 'offer').map((tn) => tn.playerId);
  /** Plays a stop to its reveal: every phone answers its item right. */
  const answerAll = (g: Table) => {
    for (const p of g.state.players) if (g.s.turns[p.id]?.status === 'answering') g.sayRight(p.id);
    expect(g.state.phase).toBe('reveal');
  };

  it('offers rotate by nextOfferee: a "no" sits the next offer out, and in a room of 4+ nobody holds it twice running', () => {
    const g = table(ROLES, ['n4', 'n5']);
    g.start(4);
    g.until('answer');
    role(g, 'p1', false);
    g.until('prompt');
    g.until('answer');
    // The lone N4 player said no last time: no nagging, the ordinary item straight away.
    expect(offered(g)).toEqual([]);
    expect(g.s.turns.p1!.task.item.role).toBeUndefined();
    g.until('prompt');
    g.until('answer');
    expect(offered(g)).toEqual(['p1']);

    const big = table(ROLES, ['n4', 'n5', 'n5', 'kana']);
    big.start(4);
    big.until('answer');
    role(big, 'p1', true);
    big.until('prompt');
    big.until('answer');
    expect(offered(big)).toEqual([]);
    big.until('prompt');
    big.until('answer');
    expect(offered(big)).toEqual(['p1']);
  });

  it('the Gallery: a tile for each player without the seat while the line is said, bubbles on the TV, one curveball a game worth +5', () => {
    const g = table(ROLES, ['n4', 'n5', 'kana']);
    g.start(4);
    g.until('answer');
    // Nothing before the role is taken.
    expect(g.view('p2').me!.gallery).toBeNull();
    expect(g.view('stage').gallery).toBeNull();
    role(g, 'p1', true);
    expect(g.view('p1').me!.gallery).toBeNull();
    // The first Kana or N5 player gets the curveball: the line's frame word and two others.
    const cb = g.view('p2').me!.gallery!;
    expect(cb.kind).toBe('curveball');
    const word = g.s.gallery!.curveball!.word;
    expect(['まいります', 'おさがりください']).toContain(word);
    expect(g.s.turns.p1!.task.item.model.kana).toContain(word);
    if (cb.kind === 'curveball') {
      expect(cb.options).toHaveLength(3);
      expect(cb.options.filter((o) => o.kana === word)).toHaveLength(1);
      expect(cb.options.every((o) => o.romaji === null)).toBe(true);
    }
    // The stage never carries the curveball's answer.
    expect(JSON.stringify(g.view('stage'))).not.toContain(word);
    const react = g.view('p3').me!.gallery!;
    expect(react.kind).toBe('react');
    expect(g.play('p3', { kind: 'gallery', pick: 'sugoi' }).changed).toBe(true);
    expect(g.play('p3', { kind: 'gallery', pick: 'warai' }).error).toBe('not-allowed');
    expect(g.play('p1', { kind: 'gallery', pick: 'sugoi' }).error).toBe('not-allowed');
    expect(g.play('p3', { kind: 'gallery' }).error).toBe('bad-move');
    expect(g.view('stage').gallery!.map((b) => b.id)).toEqual(['sugoi']);
    const before = g.score('p2');
    expect(g.play('p2', { kind: 'gallery', pick: word }).changed).toBe(true);
    expect(g.score('p2') - before).toBe(CURVEBALL_POINTS);
    expect(g.s.ledger.filter((e) => e.reason === 'curveball')).toEqual([{ playerId: 'p2', points: 5, reason: 'curveball', stop: 0 }]);
    // Reactions are never scored.
    expect(g.score('p3')).toBe(0);
    answerAll(g);
    // Still up through the reveal.
    expect(g.view('stage').gallery).toHaveLength(1);
    g.until('prompt');
    expect(g.view('stage').gallery).toBeNull();
    g.until('answer');
    role(g, 'p1', true);
    // Once a game: the curveball doesn't come back.
    expect(g.view('p2').me!.gallery!.kind).toBe('react');
    expect(g.s.gallery!.curveball).toBeNull();
  });

  it('a wrong curveball pick earns nothing; a Kana player sees romaji on it', () => {
    const g = table(ROLES, ['n4', 'kana']);
    g.start(4);
    g.until('answer');
    role(g, 'p1', true);
    const cb = g.view('p2').me!.gallery!;
    expect(cb.kind).toBe('curveball');
    if (cb.kind !== 'curveball') return;
    expect(cb.options.every((o) => !!o.romaji)).toBe(true);
    const wrong = cb.options.find((o) => o.kana !== g.s.gallery!.curveball!.word)!;
    expect(g.play('p2', { kind: 'gallery', pick: wrong.kana }).changed).toBe(true);
    expect(g.score('p2')).toBe(0);
    expect(g.view('p2').me!.gallery).toMatchObject({ kind: 'curveball', right: false });
  });

  it('no Gallery for a declined role, or for the guest at the inn', () => {
    const g = table(ROLES, ['n4', 'n5']);
    g.start(4);
    g.until('answer');
    role(g, 'p1', false);
    expect(g.s.gallery).toBeNull();
    expect(g.play('p2', { kind: 'gallery', pick: 'sugoi' }).error).toBe('no-gallery');
    const inn = table(lib(INN), ['n4', 'n5']);
    inn.start(4);
    inn.until('answer');
    role(inn, 'p1', true);
    expect(inn.s.gallery).toBeNull();
  });

  it('the booth: only after a taken role lands, at the reveal, with the key word lit and the gist on Kana and N5 phones', () => {
    const g = table(ROLES, ['n4', 'n5', 'kana', 'n4']);
    g.start(4);
    g.until('answer');
    role(g, 'p1', true);
    const model = g.s.turns.p1!.task.item.model;
    answerAll(g);
    const b = g.view('stage').booth!;
    expect(b).toMatchObject({ playerId: 'p1', name: 'P1', line: model, atMs: RULES.roleReadAtMs });
    expect(['まいります', 'おさがりください']).toContain(b.lit.key);
    expect(b.lit.before + b.lit.key + b.lit.after).toBe(model.text);
    expect(b.note).toMatch(/\S/);
    // It fits inside the reveal: no time added.
    expect(b.atMs + b.ms).toBeLessThanOrEqual(12_000);
    expect(g.state.deadline! - g.now).toBe(12_000);
    expect(g.view('p2').me!.booth).toEqual({ kana: model.kana, en: model.en, emoji: '📢', romaji: null });
    expect(g.view('p3').me!.booth!.romaji).toBe(toRomaji(model.kana));
    // Not on the speaker's phone, nor an N4 one.
    expect(g.view('p1').me!.booth).toBeNull();
    expect(g.view('p4').me!.booth).toBeNull();
    // The host voices the fixed model line only (train_role_read), and a landed announcement gets his own reaction.
    const reveal = g.cues.slice(g.cues.findIndex((c) => c.event === 'reveal_react'));
    expect(reveal.map((c) => c.event)).toEqual(['reveal_react', 'train_announcer_react', 'train_role_read']);
    expect(reveal[1]!.atMs).toBeUndefined();
    g.until('prompt');
    expect(g.view('stage').booth).toBeNull();
  });

  it('no booth or announcer reaction for a missed or declined role, or an ordinary item; the guest gets the booth but no reaction', () => {
    const missed = table(ROLES, ['n4', 'n5']);
    missed.start(4);
    missed.until('answer');
    role(missed, 'p1', true);
    missed.sayRight('p2');
    // Both tries rejected, and the room (p2) upholds both.
    for (let i = 0; i < 2; i++) {
      missed.say('p1', 'だめ');
      const w = missed.view('p2').overrules.find((x) => x.canVote)!;
      missed.play('p2', { kind: 'overrule', windowId: w.id, up: false });
    }
    expect(missed.state.phase).toBe('reveal');
    expect(missed.view('stage').booth).toBeNull();
    expect(missed.cues.some((c) => c.event === 'train_announcer_react')).toBe(false);

    const declined = table(ROLES, ['n4', 'n5']);
    declined.start(4);
    declined.until('answer');
    role(declined, 'p1', false);
    answerAll(declined);
    expect(declined.view('stage').booth).toBeNull();
    expect(declined.view('p2').me!.booth).toBeNull();

    const inn = table(lib(INN), ['n4', 'n5']);
    inn.start(4);
    inn.until('answer');
    role(inn, 'p1', true);
    answerAll(inn);
    expect(inn.view('stage').booth!.lit.key).toBe('いただけますか');
    expect(inn.view('p2').me!.booth!.emoji).toBe('🛎️');
    expect(inn.cues.some((c) => c.event === 'train_announcer_react')).toBe(false);
  });

  it('the host stand-in: once a game, at the first announcer stop, in a room of one or two with nobody at N4', () => {
    for (const levels of [['n5'], ['n5', 'kana']] as MinigameItem['level'][][]) {
      const g = table(ROLES, levels);
      g.start(4);
      g.until('prompt');
      const stand = g.cues.filter((c) => c.event === 'train_stand_in');
      // Always the first announcer line: nothing random is drawn, so the rest of the game deals as before.
      expect(stand).toEqual([{ host: 'chochin', event: 'train_stand_in', slots: { line: 'まもなくまいります', line_kana: 'まもなくまいります', line_en: 'model ann1' }, atMs: RULES.standInAtMs }]);
      expect(g.view('stage').standIn).toMatchObject({ line: { text: 'まもなくまいります' }, atMs: RULES.standInAtMs });
      expect(g.view('p1').me!.standIn).toMatchObject({ kana: 'まもなくまいります', en: 'model ann1' });
      if (levels[1]) expect(g.view('p2').me!.standIn!.romaji).toBe(toRomaji('まもなくまいります'));
      // One moment of at most 7 s: the announcement runs on until the line is said.
      const ms = g.state.deadline! - g.now;
      expect(ms).toBeGreaterThan(7_000);
      expect(ms - RULES.standInAtMs).toBeLessThanOrEqual(7_000);
      // Nobody is asked to say anything, and nobody scores for it.
      g.until('answer');
      expect(g.view('stage').standIn).toBeNull();
      expect(Object.values(g.s.turns).every((tn) => tn.status === 'answering' && !tn.task.item.role)).toBe(true);
      expect(g.s.roleLog).toEqual([]);
      g.until('prompt');
      expect(g.state.deadline! - g.now).toBe(7_000);
      g.until('recap');
      expect(g.cues.filter((c) => c.event === 'train_stand_in')).toHaveLength(1);
      expect(g.state.players.every((p) => p.score === g.s.ledger.filter((e) => e.playerId === p.id).reduce((n, e) => n + e.points, 0))).toBe(true);
    }
    for (const levels of [['n5', 'n4'], ['n4'], ['n5', 'n5', 'kana']] as MinigameItem['level'][][]) {
      const g = table(ROLES, levels);
      g.start(4);
      g.until('prompt');
      expect(g.cues.some((c) => c.event === 'train_stand_in'), levels.join()).toBe(false);
      expect(g.view('stage').standIn).toBeNull();
      expect(g.state.deadline! - g.now).toBe(7_000);
    }
  });

  it('no stand-in on a line without the announcer', () => {
    const g = table(lib(INN), ['n5']);
    g.start(4);
    g.until('recap');
    expect(g.cues.some((c) => c.event === 'train_stand_in')).toBe(false);
  });

  it('changes nothing in an N5-only room of 3+: no Gallery, booth, stand-in or new cues, same timings', () => {
    const g = table(ROLES, ['n5', 'n5', 'kana']);
    g.start(4);
    const durations: number[] = [];
    for (let i = 0; i < 40 && g.state.phase !== 'recap'; i++) {
      if (g.state.deadline) durations.push(g.state.deadline - g.now);
      for (const id of ['stage', 'p1', 'p3'] as const) {
        const v = g.view(id);
        expect(v.gallery).toBeNull();
        expect(v.booth).toBeNull();
        expect(v.standIn).toBeNull();
        if (v.me) expect([v.me.gallery, v.me.booth, v.me.standIn]).toEqual([null, null, null]);
      }
      if (g.state.phase === 'answer') answerAll(g);
      else g.timeout();
    }
    expect(g.cues.some((c) => ['train_stand_in', 'train_announcer_react'].includes(c.event))).toBe(false);
    expect(g.s.ledger.every((e) => e.reason !== 'curveball')).toBe(true);
    expect(durations.filter((d) => d === 7_000).length).toBe(4);
    expect(g.s.gallery).toBeNull();
    expect(g.s.curveballUsed).toBe(false);
  });

  it('lights the key word of every real role line', () => {
    for (const m of realContent.lastTrainMinigames) {
      for (const i of m.items.filter((x) => x.role && !x.signs)) expect(roleKey(i), i.id).not.toBeNull();
    }
  });
});

describe('Lost and Found: yōkai lost property', () => {
  const lost = realContent.lastTrainMinigames.find((m) => m.id === 'lost-and-found')!;
  it('has Pon’s leaf, a kappa’s dish and Chōchin-san’s candle as N4 role items, in the same shape as the rest', () => {
    const ids = ['lost-and-found.19-happa-kaite-aru', 'lost-and-found.20-osara-hazu', 'lost-and-found.21-rousoku-souda'];
    const items = ids.map((id) => lost.items.find((i) => i.id === id)!);
    expect(items.every(Boolean)).toBe(true);
    expect(items.map((i) => i.frames)).toEqual([['te-aru'], ['hazu'], ['sou-hear']]);
    expect(items.map((i) => i.role!.id)).toEqual(['lost-property-staff', 'passenger', 'lost-property-staff']);
    expect(items[0]!.prompt.kana).toContain('たぬき');
    expect(items[0]!.visual).toContain('ポン');
    expect(items[1]!.visual).toContain('kappa');
    expect(items[2]!.prompt.kana).toContain('ろうそく');
    for (const i of items) {
      expect(i.level).toBe('n4');
      expect(i.visual && i.hint && i.model.en).toBeTruthy();
      expect(checkUtterance({ via: 'typed', text: i.model.kana.replace(/。$/, '') }, i.accepted), i.id).toBe(true);
    }
    // The regex frames find themselves in the model line.
    expect(framesOf(items[0]!.model)).toContain('te-aru');
    expect(framesOf(items[1]!.model)).toContain('hazu');
  });

  it('writes furigana that spell out every kanji line', () => {
    const lines = lost.items.flatMap((i) => [i.prompt, i.model]);
    for (const l of lines) if (l.furigana) expect(l.furigana.map(([a]) => a).join(''), l.text).toBe(l.text);
    for (const l of lines) if (/[㐀-鿿]/.test(l.text)) expect(l.furigana, l.text).toBeDefined();
  });
});

// ---- full system: bots over the network ----

describe('Last Train and the room\'s Audience', () => {
  const line = (id: string, audience?: LastTrainScenario['audience']): LastTrainScenario => ({ ...SCENARIO, id, ...(audience ? { audience } : {}) });
  const content = (...lines: LastTrainScenario[]): ContentLibrary => ({ ...CONTENT, lastTrainScenarios: lines });
  const rideWith = (lib: ContentLibrary, audience?: 'kids' | 'family' | 'cheeky') => {
    const t = new Table(lib, 2);
    if (audience) expect(t.cmd('stage', { type: 'settings', audience }).error).toBeUndefined();
    t.start();
    return t.s.scenario.id;
  };

  it('rides the Kids or Cheeky line in a room set to it, and only family lines otherwise', () => {
    const lib = content(line('family-line'), line('kids-line', 'kids'), line('cheeky-line', 'cheeky'));
    expect(rideWith(lib)).toBe('family-line');
    expect(rideWith(lib, 'family')).toBe('family-line');
    expect(rideWith(lib, 'kids')).toBe('kids-line');
    expect(rideWith(lib, 'cheeky')).toBe('cheeky-line');
  });

  it('falls back to a family line when the room\'s audience has none', () => {
    expect(rideWith(content(line('family-line'), line('kids-line', 'kids')), 'cheeky')).toBe('family-line');
  });

  it('picks among lines of the same length instead of always the first', () => {
    const six = (id: string): LastTrainScenario => ({ ...line(id, 'cheeky'), stops: [...SCENARIO.stops, ...SCENARIO.stops.slice(0, 2)].map((st, i) => ({ ...st, id: `${id}.${i}` })) });
    const lib = content(line('family-line'), six('cheeky-a'), six('cheeky-b'));
    // The table's random() is 0.5, so a fair pick of two lands on the second.
    expect(rideWith(lib, 'cheeky')).toBe('cheeky-b');
  });

  it('gives the real content one Kids line and two Cheeky lines', () => {
    expect(lastTrainScenarios.filter((sc) => sc.audience === 'kids').map((sc) => sc.id)).toEqual(['school-trip-line']);
    expect(lastTrainScenarios.filter((sc) => sc.audience === 'cheeky').map((sc) => sc.id)).toEqual(['horoyoi-line', 'kisaragi-line']);
    for (const sc of lastTrainScenarios.filter((x) => x.audience)) expect(sc.stops.length, sc.id).toBe(6);
  });
});

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
          // Bot 4 is N4, so hard-role offers run over the network too.
          level: i === 5 ? 'kana' : i === 4 ? 'n4' : 'n5',
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
    // Every family line has a hard-role stop, so the N4 bot was offered one and answered it.
    expect(bots[3]!.moves.some((m) => m.ok && m.key.includes(':role:'))).toBe(true);

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
