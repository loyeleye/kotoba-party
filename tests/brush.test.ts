// Ink Storm (Brush, v1.1): the stroke references, the offline drawing check, the Raid's
// drawing wave, the vision coach's plumbing, and a full game played by bots through the server.

import { inflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { kanaStrokes } from '../content/src/kana/strokes.js';
import { createInkCoach, encodePng, rasterize, ScriptedLlm } from '../server/ai/index.js';
import { inkCoachDirector } from '../server/src/ink.js';
import type { Room } from '../server/src/room.js';
import { createRoom, type CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameContext } from '../shared/src/game.js';
import { gradeInk, INK_MAX_POINTS, INK_MAX_STROKES, readInk, type InkPoint } from '../shared/src/japanese/strokes.js';
import { BASE_POINTS, BONUS_CAP, INK_WAVE, inkCoachRequests, QUIET_DAMAGE, type KanaRaidView, type RaidState } from '../shared/src/modes/kanaRaid/kanaRaid.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { handDraw, scribble } from '../tools/bots/ink.js';
import { kanaRaidPolicy } from '../tools/bots/policies/kanaRaid.js';
import { content, hashView, startServer, until } from './helpers.js';

let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ref = (char: string) => kanaStrokes.find((k) => k.char === char)!.strokes;
const len = (s: readonly InkPoint[]) => s.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - s[i - 1]![0], p[1] - s[i - 1]![1]) : 0), 0);

// ---------- the stroke references ----------

/** Standard stroke counts (as in KanjiVG and school charts). */
const COUNTS =
  'あ3い2う2え2お3か3き4く1け3こ2さ3し1す2せ3そ1た4ち2つ1て1と2な4に3ぬ2ね2の1は3ひ1ふ4へ1ほ4ま3み2む3め2も3や3ゆ2よ2ら2り2る1れ2ろ1わ2を3ん1' +
  'ア2イ2ウ3エ3オ3カ2キ3ク2ケ3コ2サ3シ3ス2セ2ソ2タ3チ3ツ3テ3ト2ナ2ニ2ヌ2ネ4ノ1ハ2ヒ2フ1ヘ1ホ4マ2ミ3ム2メ2モ3ヤ2ユ2ヨ3ラ2リ2ル2レ1ロ3ワ2ヲ3ン2';

describe('stroke references', () => {
  it('covers all 46 basic hiragana and 46 katakana with the right stroke counts', () => {
    const table = new Map([...COUNTS.matchAll(/(\D)(\d)/g)].map((m) => [m[1]!, Number(m[2])]));
    expect(table.size).toBe(92);
    const basic = content.kana.filter((k) => k.kind === 'basic');
    expect(basic.length).toBe(92);
    expect(content.kanaStrokes.length).toBe(92);
    for (const k of basic) {
      const entry = content.kanaStrokes.find((x) => x.kanaId === k.id);
      expect(entry?.char, k.id).toBe(k.char);
      expect(entry!.strokes.length, k.char).toBe(table.get(k.char));
      for (const s of entry!.strokes) {
        expect(s.length).toBeGreaterThanOrEqual(2);
        for (const [x, y] of s) expect(x >= 0 && x <= 1 && y >= 0 && y <= 1).toBe(true);
      }
    }
  });
});

// ---------- the offline check ----------

describe('kana drawing check', () => {
  it('passes the reference redrawn by a wobbly hand, cleanly, for every kana', () => {
    for (const k of kanaStrokes) {
      for (let t = 0; t < 3; t++) {
        const g = gradeInk(handDraw(k.strokes, random, { wobble: 0.025 }), k.strokes);
        expect(g, k.char).toMatchObject({ pass: true, clean: true, strokeCountOk: true, orderOk: true, directionOk: true, tip: 'ok' });
        expect(g.shapeScore).toBeGreaterThan(0.5);
      }
    }
  });

  it('flags a long stroke drawn backwards, and does not let it through', () => {
    let checked = 0;
    for (const k of kanaStrokes) {
      k.strokes.forEach((s, i) => {
        if (len(s) < 0.35) return;
        const g = gradeInk(handDraw(k.strokes, random, { reverse: i }), k.strokes);
        expect(g, `${k.char} stroke ${i + 1}`).toMatchObject({ directionOk: false, pass: false, tip: 'direction', stroke: i + 1 });
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(80);
    // ソ drawn the ン way round is not ソ.
    expect(gradeInk(handDraw(ref('ン'), random), ref('ソ')).pass).toBe(false);
  });

  it('flags strokes out of order but still lets the kana land', () => {
    const g = gradeInk(handDraw(ref('あ'), random, { swap: [0, 1] }), ref('あ'));
    expect(g).toMatchObject({ pass: true, clean: false, orderOk: false, tip: 'order', stroke: 1 });
  });

  it('is forgiving about two strokes joined in one go, strict about a missing one', () => {
    // き written with its last two strokes joined (a common hand), and さ the same way.
    for (const char of ['き', 'さ']) {
      const r = ref(char);
      const joined = [...r.slice(0, -2), [...r.at(-2)!, ...r.at(-1)!]];
      expect(gradeInk(handDraw(joined, random), r), char).toMatchObject({ pass: true, clean: false, strokeCountOk: false, tip: 'too-few' });
    }
    // タ without its inner stroke is ク, not タ.
    expect(gradeInk(handDraw(ref('ク'), random), ref('タ')).pass).toBe(false);
  });

  it('fails a different kana (look-alikes aside, which the vision coach is for)', () => {
    for (const [drawn, target] of [['あ', 'お'], ['い', 'こ'], ['ね', 'わ'], ['シ', 'ツ'], ['か', 'や'], ['ア', 'マ'], ['の', 'め'], ['ち', 'さ'], ['コ', 'ユ'], ['チ', 'テ']] as const) {
      expect(gradeInk(handDraw(ref(drawn), random), ref(target)).pass, `${drawn} as ${target}`).toBe(false);
    }
    let passes = 0;
    let n = 0;
    for (const a of kanaStrokes) {
      for (const b of kanaStrokes) {
        if (a.char === b.char) continue;
        n++;
        if (gradeInk(a.strokes, b.strokes).pass) passes++;
      }
    }
    expect(passes / n).toBeLessThan(0.015);
  });

  it('rejects scribbles, taps and nothing', () => {
    for (let t = 0; t < 40; t++) {
      const k = kanaStrokes[(t * 7) % kanaStrokes.length]!;
      const g = gradeInk(scribble(random, 1 + (t % 4)), k.strokes);
      expect(g.pass, k.char).toBe(false);
    }
    expect(gradeInk([[[0.5, 0.5]]], ref('く')).tip).toBe('empty');
    expect(gradeInk([[[0.5, 0.5], [0.52, 0.51]]], ref('く')).tip).toBe('empty');
    expect(gradeInk([], ref('く')).tip).toBe('empty');
  });

  it('reads drawings off the wire strictly', () => {
    expect(readInk([[[0.1, 0.2], [0.3, 0.4]]])).toEqual([[[0.1, 0.2], [0.3, 0.4]]]);
    expect(readInk([[[1.05, -0.05]]])).toEqual([[[1, 0]]]);
    expect(readInk([])).toBeNull();
    expect(readInk('ぬ')).toBeNull();
    expect(readInk([[]])).toBeNull();
    expect(readInk([[[0.1, NaN]]])).toBeNull();
    expect(readInk([[[0.1, 2]]])).toBeNull();
    expect(readInk([[[0.1, 0.2, 0.3]]])).toBeNull();
    expect(readInk([[{ x: 0.1, y: 0.2 }]])).toBeNull();
    expect(readInk(Array.from({ length: INK_MAX_STROKES + 1 }, () => [[0.1, 0.1]]))).toBeNull();
    expect(readInk([Array.from({ length: INK_MAX_POINTS + 1 }, () => [0.1, 0.1])])).toBeNull();
    expect(readInk(Array.from({ length: 10 }, () => Array.from({ length: 50 }, () => [0.1, 0.1])))).toBeNull(); // 500 points in all
  });
});

// ---------- the Raid's Ink Storm wave ----------

let now = 5_000_000;
let ids = 0;
const ctx = (): GameContext => ({ now, content, newId: () => `id${++ids}`, random });
let cmdN = 0;

function room(n: number) {
  const s = createGame('INKS');
  for (let i = 1; i <= n; i++) {
    apply(s, { type: 'join', playerId: `p${i}`, name: `P${i}`, level: i === 1 ? 'kana' : 'n5' }, ctx());
    apply(s, { type: 'connection', playerId: `p${i}`, connected: true }, ctx());
  }
  const cmd = (actor: string | 'stage', command: CommandBody) =>
    apply(s, { type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++cmdN}` } as Command }, ctx());
  const play = (id: string, move: unknown) => cmd(id, { type: 'play', move });
  const timeout = () => apply(s, { type: 'timeout', phaseSeq: s.phaseSeq }, ctx());
  const rs = () => s.modeState as RaidState;
  const view = (id: string) => viewFor(s, { kind: 'player', playerId: id }, content).game as KanaRaidView;
  const stage = () => viewFor(s, { kind: 'stage' }, content).game as KanaRaidView;
  const score = (id: string) => s.players.find((p) => p.id === id)!.score;
  return { s, cmd, play, timeout, rs, view, stage, score };
}

/** Starts a raid and skips the three spoken waves to Ink Storm's battle. */
function toInk(r: ReturnType<typeof room>, extra?: Record<string, unknown>) {
  expect(r.cmd('stage', { type: 'start', mode: 'kana-raid', ...(extra ? { extra } : {}) }).error).toBeUndefined();
  for (const p of r.s.players) r.play(p.id, { kind: 'ready' });
  for (let guard = 0; guard < 30 && !(r.s.phase === 'answer' && r.rs().wave === INK_WAVE); guard++) r.timeout();
}

const target = (r: ReturnType<typeof room>, id: string) => {
  const a = r.rs().players[id]!.attack!;
  return content.kana.find((k) => k.id === a.itemId)!;
};
const draw = (r: ReturnType<typeof room>, id: string, ink: InkPoint[][]) => r.play(id, { kind: 'attack', attackId: r.rs().players[id]!.attack!.id, ink });

describe('Ink Storm in the Raid', () => {
  it('is on by default as wave 4 before the boss; the VIP can switch it off', () => {
    const r = room(2);
    r.cmd('stage', { type: 'start', mode: 'kana-raid' });
    expect(r.view('p1')).toMatchObject({ ink: true, inkAvailable: true, waves: 4 });
    expect(r.play('p2', { kind: 'ink', on: false }).error).toBe('not-vip');
    expect(r.play('p1', { kind: 'ink', on: 'no' }).error).toBe('bad-move');
    expect(r.play('p1', { kind: 'ink', on: false }).error).toBeUndefined();
    expect(r.stage()).toMatchObject({ ink: false, waves: 3 });
    for (const p of r.s.players) r.play(p.id, { kind: 'ready' });
    for (let guard = 0; guard < 30 && r.s.phase !== 'finale'; guard++) {
      expect(r.rs().wave).toBeLessThanOrEqual(3);
      r.timeout();
    }
    expect(r.s.phase).toBe('finale');
    expect(r.stage().waveInfo?.title).toBe('Word Yōkai');

    const off = room(1);
    off.cmd('stage', { type: 'start', mode: 'kana-raid', extra: { ink: false } });
    expect(off.stage()).toMatchObject({ ink: false, waves: 3 });
    expect(off.s.phase).toBe('intro');
  });

  it('masks the yōkai and asks each phone to draw the true form, in its own chapters', () => {
    const r = room(2);
    toInk(r);
    expect(r.s.phase).toBe('answer');
    const st = r.stage();
    expect(st.waveInfo?.title).toBe('Ink Storm');
    // The stage shows only masks: never the kana to draw.
    for (const y of r.rs().horde) {
      const shown = st.horde.find((v) => v.id === y.id)!;
      expect(shown.char).toBe(y.mask);
      expect(shown.char).not.toBe(y.char);
    }
    const a = r.view('p1').me!.attack!;
    const k = target(r, 'p1');
    expect(a).toMatchObject({ kind: 'draw', step: 'draw', script: k.script, hear: k.sound, romaji: k.romaji });
    expect(a).not.toHaveProperty('word');
    expect(content.kana.find((x) => x.id === k.twinId)!.char).toBe(a.show);
    expect(r.rs().players.p1!.chapters).toContain(k.chapter);
    // p2 is n5 and on chapter 1: romaji there too (chapter-1 training wheels).
    expect(r.view('p2').me!.attack!.romaji).toBeTruthy();
  });

  it('scores a clean drawing at full damage, a messy one softer, then pays the speaking bonus from the capped pool', () => {
    const r = room(1);
    toInk(r);
    const k = target(r, 'p1');
    const strokes = content.kanaStrokes.find((x) => x.kanaId === k.id)!.strokes;
    const before = r.score('p1');
    expect(draw(r, 'p1', handDraw(strokes, random)).error).toBeUndefined();
    const last = r.rs().players.p1!.last!;
    expect(last).toMatchObject({ ok: true, kind: 'draw', damage: BASE_POINTS, points: BASE_POINTS, tip: null });
    expect(last.ink!.clean).toBe(true);
    expect(r.score('p1') - before).toBe(BASE_POINTS);
    expect(r.stage().inks.at(-1)).toMatchObject({ playerId: 'p1', char: k.char, ok: true, clean: true });
    // Say it.
    const say = r.view('p1').me!.attack!;
    expect(say).toMatchObject({ kind: 'draw', step: 'say', word: { text: k.char } });
    r.play('p1', { kind: 'attack', attackId: say.id, say: { via: 'speech', text: k.char } });
    const bonus = r.rs().players.p1!.last!.points;
    expect(bonus).toBe(Math.round(BASE_POINTS * 0.3));
    const w = r.rs().players.p1!.wave;
    expect(w.bonus).toBeLessThanOrEqual(BONUS_CAP * (w.base + w.bonus) + 1);

    // A messy drawing (strokes out of order) still lands, at 70% damage, with a stroke-order tip.
    // (Chapter 1 is the default: every vowel has two or more strokes.)
    const k2 = target(r, 'p1');
    const s2 = content.kanaStrokes.find((x) => x.kanaId === k2.id)!.strokes;
    expect(s2.length).toBeGreaterThanOrEqual(2);
    draw(r, 'p1', handDraw(s2, random, { swap: [0, 1] }));
    const messy = r.rs().players.p1!.last!;
    expect(messy).toMatchObject({ ok: true, kind: 'draw' });
    expect(messy.ink!.clean).toBe(false);
    expect(messy.damage).toBe(Math.round(messy.points * QUIET_DAMAGE));
    expect(messy.tip).toMatch(/order/i);
  });

  it('a miss costs nothing, shows how it is written, retries once and queues a vision second look', () => {
    const r = room(1);
    toInk(r);
    const k = target(r, 'p1');
    const strokes = content.kanaStrokes.find((x) => x.kanaId === k.id)!.strokes;
    const longest = strokes.map((s, i) => ({ i, l: len(s) })).sort((a, b) => b.l - a.l)[0]!;
    const before = r.score('p1');
    draw(r, 'p1', longest.l >= 0.35 ? handDraw(strokes, random, { reverse: longest.i }) : scribble(random));
    const last = r.rs().players.p1!.last!;
    expect(last.ok).toBe(false);
    expect(last.tip).toBeTruthy();
    expect(last.ink!.ref.length).toBe(strokes.length);
    expect(r.score('p1')).toBe(before);
    const retry = r.rs().players.p1!.attack!;
    expect(retry).toMatchObject({ itemId: k.id, retry: true, kind: 'draw', step: 'draw' });

    // The miss is queued for the coach; the key never reaches any view.
    const asks = inkCoachRequests(r.s.modeState);
    expect(asks.length).toBe(1);
    expect(asks[0]!.candidates).toContain(k.char);
    expect(asks[0]!.candidates.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(r.view('p1'))).not.toContain(asks[0]!.key);
    expect(JSON.stringify(r.stage())).not.toContain(asks[0]!.key);
    // Only the right key lands a tip.
    expect(r.play('p1', { kind: 'ink-tip', key: 'guess', tip: 'Ha!' }).error).toBe('bad-move');
    expect(r.play('p1', { kind: 'ink-tip', key: asks[0]!.key, tip: 'The long stroke starts at the top.' }).error).toBeUndefined();
    expect(r.view('p1').me!.coach).toEqual({ char: k.char, tip: 'The long stroke starts at the top.' });
    expect(inkCoachRequests(r.s.modeState).length).toBe(0);
    expect(r.play('p1', { kind: 'ink-tip', key: asks[0]!.key, tip: 'again' }).error).toBe('bad-move');
  });

  it('rejects malformed drawings', () => {
    const r = room(1);
    toInk(r);
    const id = r.rs().players.p1!.attack!.id;
    for (const ink of ['ぬ', [], [[]], [[[0.1, 'x']]], [[[0.1, 9]]], Array.from({ length: 13 }, () => [[0.1, 0.1]]), [Array.from({ length: 65 }, () => [0.5, 0.5])]]) {
      expect(r.play('p1', { kind: 'attack', attackId: id, ink }).error).toBe('bad-answer');
    }
    // A drawing is not an answer to anything else, and a say isn't a drawing.
    expect(r.play('p1', { kind: 'attack', attackId: id, say: { via: 'speech', text: 'あ' } }).error).toBe('bad-answer');
    expect(r.play('p1', { kind: 'attack', attackId: id, pick: '0' }).error).toBe('bad-answer');
  });
});

// ---------- the vision coach's plumbing ----------

describe('Ink Storm coach', () => {
  it('rasterises a drawing to a valid grayscale PNG', () => {
    const img = rasterize(ref('ぬ'), 64, 4);
    expect(img.length).toBe(64 * 64);
    expect(img.filter((v) => v === 0).length).toBeGreaterThan(200);
    const png = encodePng(img, 64, 64);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(64);
    const idatLen = png.readUInt32BE(33);
    expect(png.subarray(37, 41).toString('ascii')).toBe('IDAT');
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect(raw.length).toBe(65 * 64);
  });

  it('asks a closed-set question with the drawing attached and never throws', async () => {
    const llm = new ScriptedLlm(() => ({ looksLike: 'め', tip: 'Finish ぬ with a little loop at the end of its tail.' }));
    const coach = createInkCoach({ llm });
    const tip = await coach.look({ char: 'ぬ', candidates: ['め', 'ぬ', 'ね'], strokes: ref('め'), passed: true });
    expect(tip).toBe('Looks like め! Finish ぬ with a little loop at the end of its tail.');
    const req = llm.calls[0]!;
    expect(req.user).toContain('め, ぬ, ね');
    expect(req.images?.[0]?.mediaType).toBe('image/png');
    expect(Buffer.from(req.images![0]!.data, 'base64').subarray(1, 4).toString('ascii')).toBe('PNG');
    const broken = createInkCoach({ llm: new ScriptedLlm(() => ({ nope: true })) });
    expect(await broken.look({ char: 'ぬ', candidates: ['ぬ', 'め'], strokes: ref('ぬ'), passed: false })).toBeNull();
    expect(await createInkCoach().look({ char: 'ぬ', candidates: ['ぬ', 'め'], strokes: ref('ぬ'), passed: false })).toBeNull();
  });
});

// ---------- the whole thing, through the server ----------

describe('Ink Storm: bots play a whole raid through the server', () => {
  let srv: Awaited<ReturnType<typeof startServer>>;
  let tips = 0;
  beforeAll(async () => {
    const coach = createInkCoach({ llm: new ScriptedLlm(() => ({ looksLike: 'unclear', tip: 'Start the long stroke at the top.' }), 5) });
    const director = inkCoachDirector(coach);
    let onCommit: (room: Room, v: number) => void = () => {};
    srv = await startServer({
      durations: { intro: 1_500, prompt: 30, answer: 3_500, reveal: 30, score: 30, finale: 2_500, encore: 30 },
      onCommit: (room, v) => onCommit(room, v),
    });
    onCommit = (room, v) => {
      srv.truth.onCommit(room, v);
      director(room);
    };
  });
  afterAll(async () => {
    await srv.server.close();
  });

  it('3 bots draw through Ink Storm to the recap with every client in sync', async () => {
    const { baseUrl, truth, server } = srv;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      const list = seen.get(id) ?? [];
      seen.set(id, list);
      list.push({ v, hash: hashView(view) });
    };
    let inkWave = false;
    let inksShown = 0;
    let finished = false;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 3,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'kana-raid',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        const g = view.game as KanaRaidView | null;
        if (g?.mode === 'kana-raid' && g.ink && g.wave === INK_WAVE && view.phase === 'answer') {
          inkWave = true;
          inksShown = Math.max(inksShown, g.inks.length);
        }
      },
    });
    director.start();
    // Clumsy bots, so there are misses for the coach to look at.
    const policy = kanaRaidPolicy({ accuracy: 0.5, minDelayMs: 5, maxDelayMs: 40 });
    const bots: Bot[] = [];
    for (let i = 1; i <= 3; i++) {
      bots.push(
        await Bot.join({
          baseUrl,
          code: created.code,
          name: `brush${i}`,
          level: 'kana',
          policy,
          onState: (bot, view, v) => {
            record(bot.playerId, view, v);
            if ((view.game as KanaRaidView | null)?.me?.coach) tips++;
          },
        }),
      );
    }
    await until(() => finished, 25_000, 'the raid to reach the recap');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(inkWave).toBe(true);
    expect(inksShown).toBeGreaterThan(0);
    const drawings = bots.flatMap((b) => b.moves.filter((m) => m.ok && m.key.includes(':draw')));
    expect(drawings.length).toBeGreaterThan(3);
    const failed = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failed).toEqual([]);
    expect(tips).toBeGreaterThan(0);
    let checked = 0;
    for (const [id, list] of seen) {
      for (const { v, hash } of list) {
        expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
    for (const b of bots) b.stop();
    director.client.close();
  });
});
