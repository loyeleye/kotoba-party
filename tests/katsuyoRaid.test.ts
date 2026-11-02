// Katsuyō Raid (活用レイド), the Green Car Kana Yōkai Raid: the verb list and chunk deck against the frame
// matchers, the form and chunk checks, the rules (what counts toward stamps), then a whole game played by bots
// through the real server.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BADGES, BADGE_BY_ID, KATSUYO_VERBS, type BadgeId } from '../content/src/katsuyo/verbs.js';
import { KATSUYO_BOSS_LINES, KATSUYO_CHUNKS } from '../content/src/katsuyo/lines.js';
import { createRoom, type CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameContext } from '../shared/src/game.js';
import { FRAME_BY_ID, framesOf } from '../shared/src/japanese/frames.js';
import { checkForm, checkLine, formTip, formVariants, heard } from '../shared/src/modes/kanaRaid/katsuyoCheck.js';
import { badgeScale, BLOW_POINTS, TAP_MISS, type KatsuyoRaidView, type KatsuyoState } from '../shared/src/modes/kanaRaid/katsuyoRaid.js';
import type { RaidState } from '../shared/src/modes/kanaRaid/kanaRaid.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import type { Audience } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { katsuyoRaidPolicy, raidPolicy } from '../tools/bots/policies/katsuyoRaid.js';
import { kanaRaidPolicy } from '../tools/bots/policies/kanaRaid.js';
import { content, hashView, startServer, until } from './helpers.js';

const fr = (kana: string) => framesOf({ text: kana, kana }, undefined, { keepHidden: true });
const verb = (id: string) => KATSUYO_VERBS.find((v) => v.id === id)!;
const u = (text: string, via: 'speech' | 'typed' = 'speech') => ({ via, text });

// ---------- content ----------

describe('Katsuyō Raid content', () => {
  it('uses only frame ids that exist, and every line is a draft', () => {
    for (const b of BADGES) expect(FRAME_BY_ID[b.id as keyof typeof FRAME_BY_ID], b.id).toBeDefined();
    for (const v of KATSUYO_VERBS) expect(v.status).toBe('draft');
    for (const c of KATSUYO_CHUNKS) expect(c.status).toBe('draft');
    for (const l of KATSUYO_BOSS_LINES) expect(l.status).toBe('draft');
  });

  it('every drill form matches its own frame (the passive and causative need someone, or the dictionary)', () => {
    for (const v of KATSUYO_VERBS)
      for (const [b, f] of Object.entries(v.forms) as [BadgeId, { kana: string }][]) {
        if (b === 'passive' || b === 'causative' || b === 'suffering-passive') continue;
        expect(fr(f.kana), `${v.id} ${b} ${f.kana}`).toContain(b);
      }
  });

  it('every chunk names a verb that takes its badge, and its model chunk carries the frame', () => {
    for (const c of KATSUYO_CHUNKS) {
      const v = verb(c.verbId);
      expect(v, c.id).toBeDefined();
      expect(v.forms[c.badge], c.id).toBeDefined();
      // The causative matcher needs the server's tokens, which the content test doesn't load.
      if (c.badge !== 'causative') expect(fr(c.model.kana), c.id).toContain(c.badge);
      expect(checkLine(u(c.model.kana), v, c.badge).ok, c.id).toBe(true);
    }
  });

  it('every boss line is an N3 line that carries its badge, with pieces its verbs take', () => {
    for (const l of KATSUYO_BOSS_LINES) {
      expect(BADGE_BY_ID[l.badge].side, l.id).toBe('n3');
      expect(fr(l.line.kana), l.id).toContain(l.badge);
      expect(checkLine(u(l.line.kana), verb(l.verbId), l.badge, 4).ok, l.id).toBe(true);
      for (const p of l.pieces) expect(verb(p.verbId).forms[p.badge], `${l.id} ${p.verbId} ${p.badge}`).toBeDefined();
    }
  });

  it('every badge is reachable in every audience, and Kids rooms draw no drinking, stealing or money', () => {
    const inAud = (x: { audiences?: readonly string[] }, a: Audience) => (a === 'kids' ? !x.audiences : !x.audiences || x.audiences.includes(a));
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      const verbs = KATSUYO_VERBS.filter((v) => inAud(v, a));
      for (const b of BADGES) {
        if (b.drill) expect(verbs.some((v) => v.forms[b.id]), `${a} drill ${b.id}`).toBe(true);
        expect(KATSUYO_CHUNKS.some((c) => c.badge === b.id && inAud(c, a) && inAud(verb(c.verbId), a)), `${a} chunk ${b.id}`).toBe(true);
        if (b.side === 'n3') expect(KATSUYO_BOSS_LINES.some((l) => l.badge === b.id && inAud(l, a)), `${a} boss ${b.id}`).toBe(true);
      }
    }
    const kidsVerbs = new Set(KATSUYO_VERBS.filter((v) => !v.audiences).map((v) => v.id));
    for (const banned of ['nomu', 'nusumu', 'harau', 'kau']) expect(kidsVerbs.has(banned)).toBe(false);
    for (const l of KATSUYO_BOSS_LINES.filter((x) => !x.audiences)) expect(l.line.kana).not.toMatch(/ビール|よっぱら|のみかい|デート|ぶちょう|おかね/);
  });
});

// ---------- checks ----------

describe('Katsuyō Raid checks', () => {
  it('accepts any tense or politeness of the badge form, and names a sibling form', () => {
    const nomu = verb('nomu');
    for (const said of ['のまされる', 'のまされた', 'のまされました', '飲まされた']) {
      expect(checkForm(heard({ via: 'speech', text: said, ...(said.startsWith('飲') ? { reading: 'のまされた' } : {}) }), nomu, 'saserareru').ok, said).toBe(true);
    }
    const wrong = checkForm(['のませた'], nomu, 'saserareru');
    expect(wrong).toEqual({ ok: false, sibling: 'causative' });
    expect(formTip(nomu, 'saserareru', 'causative')).toContain('のませる');
    expect(checkForm(['のむ'], nomu, 'saserareru').ok).toBe(false);
    // ＿やすい／にくい: either word.
    expect(checkForm(['よみにくかった'], verb('yomu'), 'yasui-nikui').ok).toBe(true);
    expect(formVariants('you-to-suru', 'おきようと する')).toContain('おきようとした');
  });

  it('a chunk needs the yōkai’s verb in its badge form and a word of the player’s own', () => {
    const nusumu = verb('nusumu');
    expect(checkLine(u('かばんを ぬすまれた'), nusumu, 'passive').ok).toBe(true);
    expect(checkLine(u('ぬすまれた'), nusumu, 'passive')).toMatchObject({ ok: false, ownWord: false });
    expect(checkLine(u('かばんを ぬすんだ'), nusumu, 'passive')).toMatchObject({ ok: false, verb: false });
    expect(checkLine(u('でんきを つけっぱなしだった'), verb('tsukeru'), 'ppanashi').ok).toBe(true);
    expect(checkLine(u('つけっぱなし'), verb('tsukeru'), 'ppanashi').ok).toBe(false);
  });

  it('badge scale: own side 1.0, an N3 stretch for N4 1.2, an N4 badge for N3 0.8', () => {
    expect(badgeScale('passive', 'n4')).toBe(1);
    expect(badgeScale('zu-ni', 'n3')).toBe(1);
    expect(badgeScale('zu-ni', 'n4')).toBe(1.2);
    expect(badgeScale('passive', 'n3')).toBe(0.8);
  });
});

// ---------- rules ----------

let now = 1_000_000;
let ids = 0;
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gctx = (): GameContext => ({ now, content, newId: () => `id${++ids}`, random });
let cmdN = 0;

function room(levels: ('n4' | 'n3' | 'kana')[], audience?: Audience) {
  const s = createGame('KATS');
  levels.forEach((level, i) => {
    apply(s, { type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level }, gctx());
    apply(s, { type: 'connection', playerId: `p${i + 1}`, connected: true }, gctx());
  });
  const cmd = (actor: string | 'stage', command: CommandBody) =>
    apply(s, { type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++cmdN}` } as Command }, gctx());
  if (audience) expect(cmd('stage', { type: 'settings', audience }).error).toBeUndefined();
  const play = (id: string, move: unknown) => cmd(id, { type: 'play', move });
  const timeout = () => apply(s, { type: 'timeout', phaseSeq: s.phaseSeq }, gctx());
  const ks = () => s.modeState as KatsuyoState;
  const view = (id: string) => viewFor(s, { kind: 'player', playerId: id }, content).game as KatsuyoRaidView;
  const stage = () => viewFor(s, { kind: 'stage' }, content).game as KatsuyoRaidView;
  const score = (id: string) => s.players.find((p) => p.id === id)!.score;
  const phrases = (id: string) => s.phrasebook[id] ?? [];
  return { s, cmd, play, timeout, ks, view, stage, score, phrases };
}
type Room = ReturnType<typeof room>;

function start(r: Room, extra?: Record<string, unknown>) {
  expect(r.cmd('stage', { type: 'start', mode: 'kana-raid', ...(extra ? { extra } : {}) }).error).toBeUndefined();
  expect(r.s.phase).toBe('intro');
}

/** Through the badge check to the battle of the wave after `skip` timeouts. */
function toWave(r: Room, wave: number) {
  for (const p of r.s.players) r.play(p.id, { kind: 'ready' });
  expect(r.s.phase).toBe('prompt');
  r.timeout();
  for (let w = 1; w < wave; w++) {
    r.timeout(); // answer → reveal
    r.timeout(); // reveal → score
    r.timeout(); // score → prompt
    r.timeout(); // prompt → answer
  }
  expect(r.s.phase).toBe('answer');
  expect(r.ks().wave).toBe(wave);
}

const attackOf = (r: Room, id: string) => r.ks().players[id]!.attack!;

describe('Katsuyō Raid rules', () => {
  it('a Green Car room plays Katsuyō Raid; a room with a kana player plays the kana raid as before', () => {
    const g = room(['n4', 'n3']);
    start(g);
    expect(g.ks().variant).toBe('katsuyo');
    expect(g.view('p1').variant).toBe('katsuyo');
    expect(g.view('p1').chart).toHaveLength(12);
    // N4 seats tick the N4 badges (N3 are optional stretch); N3 seats tick all twelve.
    expect(g.view('p1').me!.badges.every((b) => BADGE_BY_ID[b].side === 'n4')).toBe(true);
    expect(g.view('p2').me!.badges).toHaveLength(12);

    const k = room(['kana', 'n4']);
    start(k);
    expect((k.s.modeState as RaidState & { variant?: string }).variant).toBeUndefined();
    expect((k.s.modeState as RaidState).chapters.length).toBeGreaterThan(0);
  });

  it('the badge check keeps a badge on the seat’s own side', () => {
    const r = room(['n4', 'n3']);
    start(r);
    expect(r.play('p1', { kind: 'badges', badges: ['zu-ni'] }).error).toBe('bad-badges');
    expect(r.play('p1', { kind: 'badges', badges: ['passive', 'zu-ni'] }).error).toBeUndefined();
    expect(r.view('p1').me!.badges).toEqual(['passive', 'zu-ni']);
    expect(r.play('p2', { kind: 'badges', badges: ['passive'] }).error).toBe('bad-badges');
  });

  it('Wave 1: a spoken form hits and logs a phrasebook card with no frames; a wrong tap costs 5, a spoken miss nothing', () => {
    const r = room(['n3']);
    start(r, { ink: false });
    toWave(r, 1);
    const a = attackOf(r, 'p1');
    expect(a.kind).toBe('form');
    const v = verb(a.verbId!);
    const form = v.forms[a.badgeId!]!;
    expect(r.view('p1').me!.attack!.verb!.kana).toBe(v.verb.kana);
    expect(r.play('p1', { kind: 'attack', attackId: a.id, say: u(form.kana) }).error).toBeUndefined();
    expect(r.ks().players.p1!.last).toMatchObject({ ok: true, counted: false });
    const card = r.phrases('p1').at(-1)!;
    expect(card).toMatchObject({ itemId: `katsuyo:${v.id}:${a.badgeId}`, outcome: 'said', recall: 'memory', frames: [] });
    const before = r.score('p1');
    expect(before).toBeGreaterThan(0);

    // A spoken miss is free (and comes back once).
    const b = attackOf(r, 'p1');
    r.play('p1', { kind: 'attack', attackId: b.id, say: u('えっと') });
    expect(r.score('p1')).toBe(before);
    expect(r.ks().players.p1!.last).toMatchObject({ ok: false, retryNext: true });
    // A wrong tap costs TAP_MISS.
    const c = attackOf(r, 'p1');
    expect(c.retry).toBe(true);
    const wrong = c.options.find((o) => o.id !== c.answer)!;
    r.play('p1', { kind: 'attack', attackId: c.id, pick: wrong.id });
    expect(r.score('p1')).toBe(before - TAP_MISS);
  });

  it('Wave 2: the badge is hidden, tapped, then the plain verb is said back', () => {
    const r = room(['n4']);
    start(r, { ink: false });
    toWave(r, 2);
    const a = attackOf(r, 'p1');
    expect(a.kind).toBe('badge');
    const pv = r.view('p1').me!.attack!;
    expect(pv.badge).toBeUndefined();
    expect(pv.hear).toBeTruthy();
    expect(r.stage().horde.find((y) => y.id === a.yokaiId)).toMatchObject({ hidden: true, badge: null });
    r.play('p1', { kind: 'attack', attackId: a.id, pick: a.answer });
    expect(r.ks().players.p1!.last).toMatchObject({ ok: true, kind: 'badge' });
    const say = attackOf(r, 'p1');
    expect(say.step).toBe('say');
    r.play('p1', { kind: 'attack', attackId: say.id, say: u(verb(say.verbId!).verb.kana) });
    expect(r.phrases('p1').at(-1)).toMatchObject({ itemId: `katsuyo-verb:${say.verbId}`, frames: [] });
  });

  it('Wave 3: a chunk said with an own word counts (what was said is the card); typed logs read; a bare form misses', () => {
    const r = room(['n3', 'n3']);
    start(r, { ink: false });
    toWave(r, 3);
    const a = attackOf(r, 'p1');
    expect(a.kind).toBe('chunk');
    const chunk = KATSUYO_CHUNKS.find((c) => c.id === a.chunkId)!;
    expect(r.view('p1').me!.attack).toMatchObject({ gist: chunk.gist, picture: chunk.picture });
    // The TV and the phone never see the model before it's caught.
    expect(JSON.stringify(r.view('p1'))).not.toContain(chunk.model.kana);

    r.play('p1', { kind: 'attack', attackId: a.id, say: u(chunk.model.kana) });
    const last = r.ks().players.p1!.last!;
    expect(last).toMatchObject({ ok: true, counted: true });
    const card = r.phrases('p1').at(-1)!;
    expect(card.itemId).toBe(`katsuyo-chunk:${chunk.model.kana.replace(/\s/g, '')}`);
    expect(card).toMatchObject({ outcome: 'said', recall: 'memory', text: chunk.model.kana });
    expect(card.frames).toBeUndefined();
    expect(r.ks().players.p1!.counted[chunk.badge]).toBe(1);

    // p2: the bare form alone has no word of their own.
    const b = attackOf(r, 'p2');
    const c2 = KATSUYO_CHUNKS.find((c) => c.id === b.chunkId)!;
    const bare = verb(c2.verbId).forms[c2.badge]!.kana;
    r.play('p2', { kind: 'attack', attackId: b.id, say: u(bare) });
    expect(r.ks().players.p2!.last).toMatchObject({ ok: false, counted: false });
    // Typed: a hit, but read, never counted.
    const c = attackOf(r, 'p2');
    const c3 = KATSUYO_CHUNKS.find((x) => x.id === c.chunkId)!;
    r.play('p2', { kind: 'attack', attackId: c.id, say: u(c3.model.kana, 'typed') });
    expect(r.ks().players.p2!.last).toMatchObject({ ok: true, counted: false });
    expect(r.phrases('p2').at(-1)).toMatchObject({ outcome: 'seen', recall: 'read' });
  });

  it('Kids rooms refuse typed words a Kids room must not show', () => {
    const r = room(['n4'], 'kids');
    start(r, { ink: false });
    toWave(r, 3);
    const a = attackOf(r, 'p1');
    expect(r.play('p1', { kind: 'attack', attackId: a.id, say: u('ビールを のまされた', 'typed') }).error).toBe('kids-words');
    // Kids rooms only see Kids chunks.
    for (const y of r.ks().horde) {
      const c = KATSUYO_CHUNKS.find((x) => x.id === y.itemId)!;
      expect(c.audiences).toBeUndefined();
    }
  });

  it('aim the deal: an N3 seat’s horde is about half N4 and half N3 badges', () => {
    const r = room(['n3']);
    start(r, { ink: false });
    toWave(r, 1);
    const sides = r.ks().horde.map((y) => BADGE_BY_ID[y.badge!].side);
    const n3 = sides.filter((x) => x === 'n3').length;
    expect(sides.length).toBeGreaterThanOrEqual(6);
    expect(Math.abs(n3 - (sides.length - n3))).toBeLessThanOrEqual(1);
    // And no badge twice before every badge on its side came once.
    const n4s = r.ks().horde.filter((y) => BADGE_BY_ID[y.badge!].side === 'n4').map((y) => y.badge);
    expect(new Set(n4s.slice(0, 4)).size).toBe(Math.min(4, n4s.length));
  });

  it('the boss: pieces are bare forms; the finishing blow from the gist counts for the frames heard; the line shows once it falls', () => {
    const r = room(['n3', 'n4']);
    start(r, { ink: false });
    toWave(r, 1);
    // Skip to the boss.
    for (let i = 0; i < 4 * 2 + 3; i++) r.timeout();
    expect(r.s.phase).toBe('finale');
    const boss = r.ks().boss!;
    const line = KATSUYO_BOSS_LINES.find((l) => l.id === boss.lineId)!;
    expect(r.stage().boss).toMatchObject({ gist: line.gist, line: null });
    expect(JSON.stringify(r.stage())).not.toContain(line.line.kana);
    // Break every piece.
    for (let i = 0; i < 20 && r.ks().boss!.stage === 'break'; i++) {
      for (const id of ['p1', 'p2']) {
        const a = r.ks().players[id]!.attack;
        if (!a || a.kind !== 'piece') continue;
        const f = verb(a.verbId!).forms[a.badgeId!]!;
        r.play(id, { kind: 'attack', attackId: a.id, say: u(f.kana) });
      }
    }
    expect(r.ks().boss!.stage).toBe('blow');
    expect(r.phrases('p1').filter((e) => e.itemId.startsWith('katsuyo:')).every((e) => e.frames?.length === 0)).toBe(true);
    const blow = attackOf(r, 'p1');
    expect(blow.kind).toBe('blow');
    expect(r.view('p1').me!.attack).toMatchObject({ gist: line.gist });
    const before = r.score('p1');
    r.play('p1', { kind: 'attack', attackId: blow.id, say: u(line.line.kana) });
    expect(r.ks().boss!.defeated).toBe(true);
    expect(r.score('p1') - before).toBeGreaterThanOrEqual(BLOW_POINTS.spoken);
    const card = r.phrases('p1').at(-1)!;
    expect(card).toMatchObject({ itemId: `katsuyo-boss:${line.id}`, outcome: 'said', recall: 'memory' });
    expect(card.frames).toContain(line.badge);
    expect(r.stage().boss!.line).toEqual(line.line);
    // The scroll glows until everyone has said theirs or passed.
    expect(r.s.phase).toBe('finale');
    const p2 = attackOf(r, 'p2');
    r.play('p2', { kind: 'attack', attackId: p2.id, pass: true });
    expect(r.s.phase).toBe('encore');
    expect(r.view('p1').me!.recap!.bossLine).toEqual(line.line);
  });

  it('Ink Storm writes N4 kanji (and sign kanji for N3) and logs Shodō’s ids from memory once the word is said', () => {
    const r = room(['n3']);
    start(r);
    expect(r.ks().ink).toBe(true);
    toWave(r, 4);
    const a = attackOf(r, 'p1');
    expect(a.kind).toBe('draw');
    expect(a.itemId).toMatch(/^kj-/);
    const char = a.char!;
    const strokes = content.kanjiStrokes.find((k) => k.char === char)!.strokes;
    r.play('p1', { kind: 'attack', attackId: a.id, ink: strokes });
    expect(r.ks().players.p1!.last).toMatchObject({ ok: true, kind: 'draw' });
    const say = attackOf(r, 'p1');
    expect(say.step).toBe('say');
    r.play('p1', { kind: 'attack', attackId: say.id, say: u(say.word!.kana) });
    expect(r.phrases('p1').at(-1)).toMatchObject({ itemId: a.itemId, outcome: 'said', recall: 'memory' });
    const levels = new Set(r.ks().horde.map((y) => content.writeKanji.find((k) => k.id === y.itemId)!.level));
    expect([...levels].sort()).toEqual(['n3', 'n4']);
  });
});

// ---------- a whole game ----------

describe('Katsuyō Raid: bots play a whole Green Car game through the server', () => {
  let srv: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    srv = await startServer({ durations: { intro: 1_500, prompt: 30, answer: 2_500, reveal: 30, score: 30, finale: 2_500, encore: 30 } });
  });
  afterAll(async () => {
    await srv.server.close();
  });

  it('3 N4/N3 bots raid to the recap with every client in sync', async () => {
    const { baseUrl, server } = srv;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      const list = seen.get(id) ?? [];
      seen.set(id, list);
      list.push({ v, hash: hashView(view) });
    };
    const phases = new Set<string>();
    let finished = false;
    let variant: string | undefined;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 3,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'kana-raid',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        phases.add(view.phase);
        variant ??= (view.game as { variant?: string } | null)?.variant;
      },
    });
    director.start();
    const bots: Bot[] = [];
    const levels = ['n4', 'n3', 'n3'] as const;
    for (let i = 0; i < 3; i++) {
      const policy = raidPolicy(kanaRaidPolicy(), katsuyoRaidPolicy({ minDelayMs: 5, maxDelayMs: 60 }));
      bots.push(await Bot.join({ baseUrl, code: created.code, name: `katsuyo${i + 1}`, level: levels[i], policy, onState: (bot, view, v) => record(bot.playerId, view, v) }));
    }
    await until(() => finished, 25_000, 'the raid to reach the recap');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(variant).toBe('katsuyo');
    for (const p of ['intro', 'prompt', 'answer', 'reveal', 'score', 'finale', 'encore', 'recap']) expect(phases).toContain(p);
    const failed = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failed).toEqual([]);
    expect(bots.reduce((n, b) => n + b.moves.filter((m) => m.ok).length, 0)).toBeGreaterThan(15);
    expect(room.state.players.some((p) => p.score > 0)).toBe(true);
  });
});
