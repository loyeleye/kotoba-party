import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, wakeAt, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { Utterance } from '../shared/src/japanese/kana.js';
import {
  ARRIVE_GAP_MS,
  BONUS,
  BONUS_POOL_SHARE,
  compareBox,
  countIn,
  FIRST_ARRIVAL_MS,
  makeOrder,
  offLine,
  orderText,
  parseCall,
  starsFor,
  TIP_POINTS,
  TIPS,
  type BentoState,
  type BentoView,
  type Round,
  type Visit,
} from '../shared/src/modes/bentoHaus/bentoHaus.js';
import { COUNTS, CUSTOMERS, customerOf, FOODS, foodOf, RIDDLES } from '../shared/src/modes/bentoHaus/menu.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader, type Reader } from '../server/src/reading.js';
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
  /** Runs the mode's clock to its next timed event, as the server's wake timer would. */
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
  score(id: string): number {
    return this.s.players.find((p) => p.id === id)!.score;
  }
  start(audience?: 'kids' | 'family' | 'cheeky') {
    if (audience) this.cmd('stage', { type: 'settings', audience });
    expect(this.cmd('stage', { type: 'start', mode: 'bento-haus' }).changed).toBe(true);
    this.timeout();
    expect(this.s.phase).toBe('prompt');
    this.timeout();
    expect(this.s.phase).toBe('answer');
  }
  /** Runs the clock until a customer is waiting, and returns them. */
  customer(): Visit {
    for (let i = 0; i < 5 && !this.r.visits.some((v) => v.state === 'waiting'); i++) this.wake();
    return this.r.visits.find((v) => v.state === 'waiting')!;
  }
  holder(foodId: string): string {
    return this.r.holders[foodId]!;
  }
  /** The kitchen fills a visit's order exactly: the order-taker calls, each station reads back and sends. */
  fill(v: Visit, opts: { skip?: string } = {}) {
    for (const l of v.lines) {
      if (l.foodId === opts.skip) continue;
      const f = foodOf(l.foodId)!;
      expect(this.play(v.takerId, { kind: 'call', utterance: speech(`${f.kana} ${COUNTS.tsu[l.n - 1]}、おねがいします`) }).error).toBeUndefined();
      const t = this.r.tickets.at(-1)!;
      expect(t.foodId).toBe(l.foodId);
      expect(this.play(t.stationId!, { kind: 'readback', ticketId: t.id, utterance: speech(`はい、${f.kana} ${COUNTS.tsu[l.n - 1]}ですね`) }).error).toBeUndefined();
      expect(this.play(t.stationId!, { kind: 'send', ticketId: t.id }).error).toBeUndefined();
    }
  }
}

const speech = (text: string): Utterance => ({ via: 'speech', text });

let reader: Reader;
beforeAll(async () => {
  reader = (await createReader())!;
});
function heard(text: string): Utterance {
  const move = { u: { via: 'speech', text } as Utterance };
  addReadings(move, reader);
  return move.u;
}

const menuAll = FOODS.map((f) => f.id);

describe('Bento Haus: the kitchen', () => {
  it('every food has a picture, a counter and readings; every riddle names a real food', () => {
    for (const f of FOODS) {
      expect(f.emoji, f.id).toBeTruthy();
      expect(COUNTS[f.counter].length, f.id).toBe(4);
    }
    for (const id of Object.keys(RIDDLES)) expect(foodOf(id), id).toBeDefined();
    for (const c of CUSTOMERS) for (const line of [c.hello, c.perfect, c.leave]) expect(line.text && line.en, c.id).toBeTruthy();
  });

  it('every Bento Haus host event has four Pon lines, and slots match', () => {
    const events = ['bento_intro', 'bento_round', 'bento_customer', 'bento_static', 'bento_perfect', 'bento_close', 'bento_meh', 'bento_leave', 'bento_bake', 'bento_ajimi', 'bento_stars'];
    for (const e of events) {
      const lines = ponLines.filter((l) => l.event === e);
      expect(lines.length, e).toBe(4);
      for (const l of lines) for (const slot of l.jp.text.match(/\{\w+\}/g) ?? []) expect(l.slots ?? [], l.id).toContain(slot);
    }
  });

  it('hears a call: the food and the count after it, in any counter, kana, digits or kanji', () => {
    expect(parseCall(speech('からあげ ふたつ、おねがいします！'), menuAll)).toEqual([{ foodId: 'karaage', n: 2 }]);
    expect(parseCall(speech('えびフライを さんぼんと、ミニトマトを いっこ'), menuAll)).toEqual([
      { foodId: 'ebi', n: 3 },
      { foodId: 'tomato', n: 1 },
    ]);
    expect(parseCall(speech('ふたつの おにぎり'), menuAll)).toEqual([{ foodId: 'onigiri', n: 2 }]);
    expect(parseCall(speech('いちご 3つ'), menuAll)).toEqual([{ foodId: 'ichigo', n: 3 }]);
    expect(parseCall(speech('のり'), menuAll)).toEqual([{ foodId: 'nori', n: null }]);
    expect(parseCall(speech('えっと… あれ…'), menuAll)).toEqual([]);
    // Only this round's menu counts.
    expect(parseCall(speech('からあげ ふたつ'), ['onigiri'])).toEqual([]);
    expect(countIn('をよっつ')).toBe(4);
    expect(countIn('を二つ')).toBe(2);
  });

  it('hears a call written in kanji by its reading', () => {
    expect(parseCall(heard('唐揚げを二つお願いします'), menuAll)).toEqual([{ foodId: 'karaage', n: 2 }]);
  });

  it('compares a box with its order, and names the one thing off without naming anyone', () => {
    const lines = [
      { foodId: 'karaage', n: 2, riddle: false },
      { foodId: 'tomato', n: 3, riddle: false },
    ];
    expect(compareBox(lines, { karaage: 2, tomato: 3 })).toEqual([]);
    expect(compareBox(lines, { karaage: 2 })).toEqual([{ foodId: 'tomato', how: 'missing' }]);
    expect(compareBox(lines, { karaage: 1, tomato: 3, nori: 1 })).toEqual([
      { foodId: 'karaage', how: 'few' },
      { foodId: 'nori', how: 'extra' },
    ]);
    expect(offLine('tomato', 'missing').text).toBe('あれ？　ミニトマトが ありません。');
  });

  it('says orders as a customer would: counters from round 2, riddles and changes of mind', () => {
    const lines = [
      { foodId: 'karaage', n: 2, riddle: false },
      { foodId: 'ebi', n: 1, riddle: false },
    ];
    expect(orderText(lines, false).text).toBe('からあげを ふたつと、えびフライを ひとつ ください。');
    expect(orderText(lines, true).text).toBe('からあげを ふたつと、えびフライを いっぽん ください。');
    expect(orderText(lines, true, { changeOfMind: 0 }).text).toBe('からあげを みっつ… やっぱり ふたつと、えびフライを いっぽん ください。');
    expect(orderText([{ foodId: 'tomato', n: 3, riddle: true }], true, { rush: true }).text).toBe('いそぎで おねがいします！　あかくて まるい、ちいさな やさいを さんこ ください。');
  });

  it('bends orders to each customer: one of everything, cucumber, nothing hot, three inari', () => {
    const random = mulberry(3);
    for (let i = 0; i < 20; i++) {
      expect(makeOrder(2, menuAll, customerOf('hitotsume')!, 'n5', random).lines.every((l) => l.n === 1)).toBe(true);
      expect(makeOrder(1, menuAll, customerOf('kappa')!, 'n5', random).lines.some((l) => l.foodId === 'kyuuri')).toBe(true);
      expect(makeOrder(3, menuAll, customerOf('yukionna')!, 'n4', random).lines.every((l) => !foodOf(l.foodId)!.hot)).toBe(true);
      expect(makeOrder(3, menuAll, customerOf('kitsune')!, 'n5', random).lines).toContainEqual({ foodId: 'inari', n: 3, riddle: false });
      // Kana players never get riddles, and round 1 has none at all.
      expect(makeOrder(2, menuAll, customerOf('obaachan')!, 'kana', random).lines.some((l) => l.riddle)).toBe(false);
      expect(makeOrder(1, menuAll, customerOf('obaachan')!, 'n4', random).lines.some((l) => l.riddle)).toBe(false);
    }
  });

  it('gives 1–3 stars for the share of tips on offer', () => {
    expect(starsFor(0, 9)).toBe(0);
    expect(starsFor(1, 9)).toBe(1);
    expect(starsFor(5, 9)).toBe(2);
    expect(starsFor(9, 9)).toBe(3);
  });
});

describe('Bento Haus: a shift', () => {
  it('a customer phones one player; the TV never sees the order; the food is spread across every phone', () => {
    const t = new Table(3);
    t.start();
    expect(t.r.visits).toEqual([]);
    // The first customer comes in on the mode's own clock, without the phase changing.
    const seq = t.s.phaseSeq;
    expect(wakeAt(t.s, t.ctx())).toBe(t.r.shiftStart + FIRST_ARRIVAL_MS);
    const v = t.customer();
    expect(t.s.phaseSeq).toBe(seq);
    expect(t.s.phase).toBe('answer');
    const stage = t.view();
    expect(JSON.stringify(stage)).not.toContain(v.text);
    expect(stage.visits[0]!.takerId).toBe(v.takerId);
    const mine = t.view(v.takerId).me!;
    expect(mine.taking[0]!.text).toBe(v.text);
    const other = t.view(['p1', 'p2', 'p3'].find((p) => p !== v.takerId)!).me!;
    expect(other.taking).toEqual([]);
    // Every phone holds some of the menu, and every food is on exactly one phone.
    const shelves = ['p1', 'p2', 'p3'].map((p) => t.view(p).me!.shelf);
    for (const s of shelves) expect(s.length).toBeGreaterThan(0);
    expect(shelves.flat().sort()).toEqual([...t.r.menu].sort());
  });

  it('call → ticket on the right phone → read back → send → serve: a perfect box pays 3 tips', () => {
    const t = new Table(3);
    t.start();
    const v = t.customer();
    const first = v.lines[0]!;
    const station = t.holder(first.foodId);
    // A station can't send food nobody called.
    expect(t.play(station, { kind: 'send', ticketId: 'nope' }).error).toBe('bad-move');
    t.fill(v);
    expect(t.view(station).me!.tickets.some((x) => x.foodId === first.foodId && x.state === 'sent')).toBe(true);
    expect(Object.fromEntries(t.view().visits[0]!.box.map((b) => [b.foodId, b.n]))).toEqual(Object.fromEntries(v.lines.map((l) => [l.foodId, l.n])));
    // Only the order-taker serves.
    const notTaker = ['p1', 'p2', 'p3'].find((p) => p !== v.takerId)!;
    expect(t.play(notTaker, { kind: 'serve', visitId: v.id }).error).toBe('bad-move');
    expect(t.play(v.takerId, { kind: 'serve', visitId: v.id, utterance: speech('おまたせしました') }).error).toBeUndefined();
    expect(v.state).toBe('served');
    expect(v.tips).toBe(TIPS.perfect * (v.rush ? 2 : 1));
    expect(v.reaction).toEqual(customerOf(v.customerId)!.perfect);
    // The counter frees up and the next customer is on the way.
    expect(t.r.nextArriveAt).not.toBeNull();
    expect(t.r.nextArriveAt!).toBeLessThanOrEqual(t.now + 2 * ARRIVE_GAP_MS);
  });

  it('a call that doesn’t come through is radio static on the TV, with no name; a read-back must match', () => {
    const t = new Table(2);
    t.start();
    const v = t.customer();
    t.play(v.takerId, { kind: 'call', utterance: speech('えっと… なんだっけ') });
    const feed = t.view().feed;
    expect(feed.at(-1)).toMatchObject({ foodId: null, n: null });
    expect(JSON.stringify(feed)).not.toContain(v.takerId);
    // The food came through but not the number: the station can ask, not send.
    const f = foodOf(v.lines[0]!.foodId)!;
    t.play(v.takerId, { kind: 'call', utterance: speech(f.kana) });
    const ticket = t.r.tickets.at(-1)!;
    expect(ticket.n).toBeNull();
    expect(t.play(ticket.stationId!, { kind: 'send', ticketId: ticket.id }).error).toBe('bad-move');
    expect(t.play(ticket.stationId!, { kind: 'ask', ticketId: ticket.id, utterance: speech('いくつですか') }).error).toBeUndefined();
    expect(t.view(v.takerId).me!.calls.at(-1)!.asked).toBe(true);
    // A read-back of the wrong number is refused.
    t.play(v.takerId, { kind: 'call', utterance: speech(`${f.kana} ふたつ`) });
    const good = t.r.tickets.at(-1)!;
    expect(t.play(good.stationId!, { kind: 'readback', ticketId: good.id, utterance: speech(`はい、${f.kana} みっつですね`) }).error).toBe('readback-mismatch');
  });

  it('a customer who waits too long leaves: a half-made box sells as わけあり for 1 tip, an empty one for nothing', () => {
    const t = new Table(2);
    t.start();
    const v = t.customer();
    const l = v.lines[0]!;
    t.play(v.takerId, { kind: 'call', foodId: l.foodId, n: 1 });
    t.play(t.holder(l.foodId), { kind: 'send', ticketId: t.r.tickets.at(-1)!.id });
    const seq = t.s.phaseSeq;
    t.now = v.leaveAt;
    t.act({ type: 'wake', phaseSeq: seq });
    expect(t.s.phaseSeq).toBe(seq);
    expect(v.state).toBe('left');
    expect(v.tips).toBe(TIPS.wakeari);
    // The next one is still waiting at closing time, with an empty box: no tip.
    const next = t.customer();
    t.timeout();
    expect(t.s.phase).toBe('score');
    expect(next.state).toBe('left');
    expect(next.tips).toBe(0);
    expect(next.reaction).toEqual(customerOf(next.customerId)!.leave);
  });

  it('ばけた！ Pon fills one missing food, once a round', () => {
    const t = new Table(3, [], 11);
    t.start();
    const v = t.customer();
    v.lines = [
      { foodId: t.r.menu[0]!, n: 1, riddle: false },
      { foodId: t.r.menu[1]!, n: 2, riddle: false },
    ];
    t.fill(v, { skip: t.r.menu[1]! });
    t.play(v.takerId, { kind: 'serve', visitId: v.id });
    expect(v.baked).toBe(t.r.menu[1]);
    expect(v.tips).toBe(TIPS.perfect * (v.rush ? 2 : 1));
    // Only once a round: the next box with one thing missing is 2 tips.
    const w = t.customer();
    w.lines = [
      { foodId: t.r.menu[2]!, n: 1, riddle: false },
      { foodId: t.r.menu[3]!, n: 1, riddle: false },
    ];
    w.rush = false;
    t.fill(w, { skip: t.r.menu[3]! });
    t.play(w.takerId, { kind: 'serve', visitId: w.id });
    expect(w.baked).toBeNull();
    expect(w.tips).toBe(TIPS.close);
    expect(w.reaction!.text).toBe(`あれ？　${foodOf(t.r.menu[3]!)!.kana}が ありません。`);
  });

  it('あじみ: Pon eats one of the third thing sent in a shift, so it has to be called again', () => {
    const t = new Table(1);
    t.start();
    const v = t.customer();
    for (let i = 0; i < 3; i++) {
      t.play('p1', { kind: 'call', foodId: t.r.menu[i]!, n: 2 });
      t.play('p1', { kind: 'send', ticketId: t.r.tickets.at(-1)!.id });
    }
    expect(t.r.ajimi).toMatchObject({ visitId: v.id, foodId: t.r.menu[2] });
    expect(v.box[t.r.menu[2]!]).toBe(1);
    expect(t.view().ajimi?.foodId).toBe(t.r.menu[2]);
  });

  it('pays every tip to the whole team, plus a speaking bonus capped at 30% of it, and gives stars', () => {
    const t = new Table(3);
    t.start();
    const v = t.customer();
    t.fill(v);
    t.play(v.takerId, { kind: 'serve', visitId: v.id, utterance: speech('おまたせしました') });
    const tips = t.r.tips;
    t.timeout();
    expect(t.s.phase).toBe('score');
    const team = tips * TIP_POINTS;
    expect(t.r.teamPoints).toBe(team);
    expect(t.r.stars).toBeGreaterThan(0);
    const cap = Math.round(team * BONUS_POOL_SHARE);
    for (const p of ['p1', 'p2', 'p3']) {
      expect(t.score(p)).toBeGreaterThanOrEqual(team);
      expect(t.score(p)).toBeLessThanOrEqual(team + cap);
    }
    expect(t.score(v.takerId)).toBe(team + Math.min(cap, BONUS.callSpoken * v.lines.length + BONUS.serve + (v.lines.some((l) => t.holder(l.foodId) === v.takerId) ? BONUS.readback : 0)));
    // The closing view shows each order next to what was served.
    expect(t.view().visits[0]!.order?.text).toBe(v.text);
  });

  it('plays three shifts to the recap, with awards', () => {
    const t = new Table(2, ['kana', 'n4']);
    t.start('cheeky');
    for (let round = 1; round <= 3; round++) {
      for (let k = 0; k < 2; k++) {
        const v = t.customer();
        if (!v) break;
        // Riddle lines are worked out from the riddle.
        t.fill(v);
        t.play(v.takerId, { kind: 'serve', visitId: v.id, utterance: speech('おまたせしました') });
      }
      if (t.s.phase === 'answer') t.timeout();
      expect(t.s.phase).toBe('score');
      t.timeout();
      if (t.s.phase === 'prompt') t.timeout();
    }
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap!.awards.length).toBeGreaterThan(0);
    // Cheeky customers turn up in a Cheeky room.
    expect(t.st.usedCustomers.some((id) => customerOf(id)!.audiences.includes('cheeky'))).toBe(true);
  });

  it('a player who leaves hands their shelf and their orders on', () => {
    const t = new Table(3);
    t.start();
    const v = t.customer();
    const gone = v.takerId;
    t.act({ type: 'release', playerId: gone });
    expect(Object.values(t.r.holders)).not.toContain(gone);
    expect(t.s.players.map((p) => p.id)).toContain(v.takerId);
  });

  it('a stale wake is ignored', () => {
    const t = new Table(2);
    t.start();
    expect(t.act({ type: 'wake', phaseSeq: t.s.phaseSeq - 1 }).changed).toBe(false);
  });
});

describe('Bento Haus: bots end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ reader, durations: { intro: 20, prompt: 30, answer: 6_000, score: 30 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [2, 5]) {
    it(`${players} bots run the kitchen through three shifts with every client in sync`, async () => {
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
        mode: 'bento-haus',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          const g = view.game as BentoView | null;
          if (g?.mode === 'bento-haus') served = Math.max(served, g.visits.filter((x) => x.state === 'served' && x.tips > 0).length);
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
      expect(standings.every((s) => s.score > 0)).toBe(true);
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && !['wrong-phase', 'no-customer'].includes(m.error ?? '')));
      expect(bad).toEqual([]);
      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
