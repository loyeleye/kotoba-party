// Shodō Taikai: the kanji data, the per-stroke trace check, the brush outline, the rounds and
// their privacy rules, and a full game played by bots through the server.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { kanjiStrokes } from '../content/src/kanji/strokes.js';
import { writeKanji, writeWords } from '../content/src/kanji/kanji.js';
import { createRoom, type CommandBody } from '../shared/src/client.js';
import { brushPath } from '../shared/src/brush.js';
import { apply, createGame, type GameAction, type GameContext } from '../shared/src/game.js';
import { checkStroke, gradeInk, strokeStart, strokeWay, traceTolerance, type InkPoint } from '../shared/src/japanese/strokes.js';
import { buildDeck, dealPractice, dictationPool, KANJI_LOOKALIKES, LOOKALIKE_KANA, practicePool, reviewPool, wordWith } from '../shared/src/modes/shodo/deck.js';
import { AWARDS, BONUS_SHARE, ITEMS, type ShodoState, type ShodoView } from '../shared/src/modes/shodo/shodo.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { toRomaji } from '../shared/src/japanese/romaji.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { handDraw, scribble } from '../tools/bots/ink.js';
import { shodoPolicy, traceOver } from '../tools/bots/policies/shodo.js';
import { content, hashView, startServer, until } from './helpers.js';

let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ref = (char: string) => kanjiStrokes.find((k) => k.char === char)!.strokes;
const len = (s: readonly (readonly number[])[]) => s.reduce((n, p, i) => (i ? n + Math.hypot(p[0]! - s[i - 1]![0]!, p[1]! - s[i - 1]![1]!) : 0), 0);

// ---- data ----

describe('kanji data', () => {
  it('has stroke data for every kanji, with school stroke counts', () => {
    expect(writeKanji.length).toBe(161);
    expect(['n5', 'n4', 'n3'].map((l) => writeKanji.filter((k) => k.level === l).length)).toEqual([70, 61, 30]);
    // The N4 kanji the game's own N4 lines use (PR #146 panel).
    for (const c of '思持待使乗着終写会教') expect(writeKanji.find((k) => k.char === c)?.level, c).toBe('n4');
    for (const k of writeKanji) expect(ref(k.char)?.length, k.char).toBeGreaterThan(0);
    const counts: Record<string, number> = { 一: 1, 二: 2, 三: 3, 山: 3, 川: 3, 木: 4, 日: 4, 右: 5, 左: 5, 本: 5, 女: 3, 子: 3, 書: 10, 歩: 8, 雨: 8, 車: 7, 着: 12, 押: 8, 階: 12, 煙: 13, 険: 11 };
    for (const [c, n] of Object.entries(counts)) expect(ref(c)?.length, c).toBe(n);
  });

  it('romanizes a lone kana as itself, not as a particle', () => {
    expect([toRomaji('へ'), toRomaji('は'), toRomaji('ヘ')]).toEqual(['he', 'ha', 'he']);
    expect(toRomaji('がっこうへ いきます')).toBe('gakkō e ikimasu');
  });

  it('gives every look-alike kanji a kana name, so Fude can voice a misreading', () => {
    for (const c of KANJI_LOOKALIKES.flat()) expect(LOOKALIKE_KANA[c], c).toMatch(/^[ぁ-ゖ]+$/);
  });

  it('only lists words whose kanji all have strokes, and points stay in the box', () => {
    const chars = new Set(writeKanji.map((k) => k.char));
    for (const w of writeWords) for (const c of w.word.text) expect(chars.has(c), `${w.word.text}: ${c}`).toBe(true);
    for (const k of kanjiStrokes) for (const s of k.strokes) for (const [x, y] of s) expect(x >= 0 && x <= 1 && y >= 0 && y <= 1, k.char).toBe(true);
  });

  it('deals by level: N5 from the early steps, N4 later steps and words', () => {
    const deck = buildDeck(content);
    expect(practicePool(deck, 'kana').every((t) => t.kind === 'kana' && /[ぁ-ゖ]/.test(t.text))).toBe(true);
    expect(practicePool(deck, 'n5').every((t) => t.kind === 'kanji' && (t.step ?? 0) <= 5)).toBe(true);
    expect(dictationPool(deck, 'n4', true).every((t) => t.kind === 'word' && t.cells.length >= 2)).toBe(true);
    expect(dictationPool(deck, 'n5', true).every((t) => t.kind === 'kanji')).toBe(true);
  });

  it('deals an N4 player two N4 kanji and one N5 review, and N3 the sign kanji with N4 review', () => {
    const deck = buildDeck(content);
    expect(practicePool(deck, 'n4').map((t) => t.level)).toEqual(Array(61).fill('n4'));
    expect(reviewPool(deck, 'n4').every((t) => t.level === 'n5' && (t.step ?? 0) >= 3)).toBe(true);
    expect(practicePool(deck, 'n3').map((t) => t.level)).toEqual(Array(30).fill('n3'));
    for (let i = 0; i < 5; i++) {
      expect(dealPractice(deck, 'n4', new Set(), random).map((t) => t.level)).toEqual(['n4', 'n4', 'n5']);
      expect(dealPractice(deck, 'n3', new Set(), random).map((t) => t.level)).toEqual(['n3', 'n3', 'n4']);
      expect(dealPractice(deck, 'n5', new Set(), random).every((t) => t.level === 'n5')).toBe(true);
    }
    // Dictation words: N4 words have an N4 kanji (会社, not 学生); N3 words are the signs (非常口).
    expect(dictationPool(deck, 'n4', true).every((t) => t.level === 'n4')).toBe(true);
    expect(dictationPool(deck, 'n4', true).map((t) => t.text)).toContain('会社');
    expect(dictationPool(deck, 'n3', true).map((t) => t.text)).toEqual(expect.arrayContaining(['非常口', '受付', '予約', '禁煙']));
    // A practised kanji comes back inside a word.
    const sha = deck.kanji.find((t) => t.text === '社')!;
    expect(wordWith(deck, 'n4', sha, new Set(), random)?.text).toBe('会社');
    expect(wordWith(deck, 'n5', sha, new Set(), random)).toBeNull();
    // Never a sign word for an N4 player: 引 is only in 割引, 自 is in 自分 and 自由席.
    const hiku = deck.kanji.find((t) => t.text === '引')!;
    const ji = deck.kanji.find((t) => t.text === '自')!;
    for (let i = 0; i < 20; i++) {
      expect(wordWith(deck, 'n4', hiku, new Set(), random)).toBeNull();
      expect(wordWith(deck, 'n4', ji, new Set(), random)?.text).toBe('自分');
    }
  });

  it('never deals an N3 target to an N5 or N4 player, and one kanji per say-word a game', () => {
    const deck = buildDeck(content);
    for (const level of ['n5', 'n4'] as const) {
      for (const words of [true, false]) expect(dictationPool(deck, level, words).filter((t) => t.level === 'n3'), level).toEqual([]);
      for (let i = 0; i < 30; i++) {
        const dealt = dealPractice(deck, level, new Set(), random);
        expect(dealt.filter((t) => t.level === 'n3')).toEqual([]);
        for (const t of dealt) expect(wordWith(deck, level, t, new Set(), random)?.level ?? 'n5').not.toBe('n3');
      }
    }
    // 改 and 札 both say 改札: never both in one N3 deal.
    for (let i = 0; i < 50; i++) {
      const says = dealPractice(deck, 'n3', new Set(), random).map((t) => t.say.text);
      expect(new Set(says).size).toBe(says.length);
    }
  });
});

// ---- strokes ----

describe('tracing one stroke at a time', () => {
  it('passes a stroke traced over its ghost, and catches one run backwards or out of place', () => {
    const [first, second] = ref('十');
    expect(checkStroke(traceOver([first!], random)[0]!, first!)).toBe('ok');
    expect(checkStroke([...first!].reverse(), first!)).toBe('reversed');
    // The other stroke of 十 traced in its place is off, not just a nearby miss.
    expect(checkStroke(second!, first!)).toBe('off');
    // A long scrawl over the ghost isn't a trace.
    expect(checkStroke(scribble(random, 1)[0]!, first!)).toBe('off');
  });

  it('is a step looser for Kana-level beginners, and another with steady hand', () => {
    expect(traceTolerance(true, false)).toBeGreaterThan(traceTolerance(false, false));
    expect(traceTolerance(true, true)).toBeGreaterThan(traceTolerance(true, false));
    expect(traceTolerance(false, true)).toBe(traceTolerance(true, false));
    // Off by a tenth of the pad: too far for N5 and N4, close enough for a beginner.
    const s = ref('一')[0]!;
    const shifted = s.map(([x, y]) => [x, y + 0.1] as InkPoint);
    expect(checkStroke(shifted, s, traceTolerance(false, false))).toBe('off');
    expect(checkStroke(shifted, s, traceTolerance(true, false))).toBe('ok');
  });

  it('ignores the direction of dots', () => {
    const dot = kanjiStrokes.flatMap((k) => k.strokes).find((s) => len(s) > 0.04 && len(s) < 0.1)!;
    expect(checkStroke([...dot].reverse(), dot)).toBe('ok');
  });

  it('grades a hand-drawn kanji, and spots a swapped stroke order', () => {
    const shape = ref('右');
    expect(gradeInk(handDraw(shape, random), shape).clean).toBe(true);
    const swapped = gradeInk(handDraw(shape, random, { swap: [0, 1] }), shape);
    expect(swapped.pass).toBe(true);
    expect(swapped.orderOk).toBe(false);
  });

  it('says where a stroke starts by where it is, not which way it goes', () => {
    // 人's second stroke starts mid-way down the first, not at the top-left.
    expect(strokeStart(ref('人')[1]!)).not.toBe('the top-left');
    expect(strokeWay(ref('一')[0]!)).toBe('starts at the left and goes to the right');
  });

  it('draws a brush outline for every stroke', () => {
    for (const s of ref('書')) expect(brushPath(s, 7)).toMatch(/^M[\d.]+ [\d.]+.*Z$/);
  });
});

// ---- rounds ----

let ids = 0;
const gctx = (): GameContext => ({ now: 1_000_000, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random: () => 0.42 });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

function room(levels: ('kana' | 'n5' | 'n4')[]) {
  const s = createGame('BCDF');
  const act = (a: GameAction) => apply(s, a, gctx());
  const cmd = (actor: ReturnType<typeof as> | typeof stage, command: CommandBody) => apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, gctx());
  const play = (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move });
  const tick = () => act({ type: 'timeout', phaseSeq: s.phaseSeq });
  const ms = () => s.modeState as ShodoState;
  const view = (viewer: ReturnType<typeof as> | typeof stage) => viewFor(s, viewer, content).game as ShodoView;
  levels.forEach((level, i) => {
    act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  return { s, act, cmd, play, tick, ms, view };
}

const score = (r: ReturnType<typeof room>, id: string) => r.s.players.find((p) => p.id === id)!.score;

/** Plays round 1 for one player: says each target, traces cleanly, writes from memory. */
function practice(r: ReturnType<typeof room>, id: string) {
  const deck = buildDeck(content);
  for (let guard = 0; guard < 20; guard++) {
    const p = r.view(as(id)).me!.practice!;
    if (!p.rep) return;
    const st = r.ms().practice[id]!;
    const t = st.targets[st.reps[st.next]!.target]!;
    if (p.sayFirst) expect(r.play(id, { kind: 'say', utterance: { via: 'speech', text: t.say.kana } }).error).toBeUndefined();
    else if (p.rep === 'memory') r.play(id, { kind: 'rep', strokes: handDraw(t.cells[0]!, random) });
    else r.play(id, { kind: 'rep', strokes: traceOver(p.target!.cells![0]!, random) });
    expect(deck.kanji.length).toBeGreaterThan(0);
  }
}

describe('Shodō Taikai rounds', () => {
  it('runs practice → read → three items → gallery → stamps → claim → recap', () => {
    const r = room(['n5', 'n5', 'kana', 'n4']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    expect(r.s.phase).toBe('intro');
    r.tick();
    expect(r.s.phase).toBe('prompt');
    for (const id of ['p1', 'p2', 'p3', 'p4']) practice(r, id);
    expect(r.s.phase).toBe('score');
    // Round 1 pays once, when it ends, so the chime rings once.
    expect(score(r, 'p1')).toBeGreaterThan(0);
    r.tick();
    for (let i = 0; i < ITEMS; i++) {
      expect(r.s.phase).toBe('answer');
      for (const id of ['p1', 'p2', 'p3', 'p4']) {
        const item = r.ms().items.at(-1)!;
        const t = item.targets[id]!;
        if (item.kind === 'recall') {
          // Writing before saying (or giving up) is refused.
          expect(r.play(id, { kind: 'sheet', cells: t.cells.map((c) => handDraw(c, random)) }).error).toBe('say-first');
          r.play(id, { kind: 'say', utterance: { via: 'typed', text: t.say.kana } });
        }
        r.play(id, { kind: 'sheet', cells: t.cells.map((c) => handDraw(c, random)) });
      }
      expect(r.s.phase).toBe('reveal');
      r.tick();
    }
    expect(r.s.phase).toBe('encore');
    // One silly brief for the room; the big sheet shows its word but no model under the pad.
    const brief = r.ms().gallery!.brief;
    expect(r.view(stage).brief).toEqual(brief);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      const mine = r.view(as(id)).me!.gallery!.target;
      expect(mine.cells).toBeNull();
      expect(mine.text.length).toBeGreaterThan(0);
      expect(mine.say.kana).toMatch(new RegExp(`^${brief.kana} .+です$`));
    }
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      const t = r.ms().gallery!.targets[id]!;
      r.play(id, { kind: 'sheet', cells: t.cells.map((c) => handDraw(c, random)) });
      // The sentence without です counts, and so does the word on its own.
      if (id === 'p1') expect(r.play(id, { kind: 'say', utterance: { via: 'typed', text: t.say.kana.replace(/です$/, '') } }).error).toBeUndefined();
      else if (id === 'p2') expect(r.play(id, { kind: 'say', utterance: { via: 'typed', text: t.word!.kana } }).error).toBeUndefined();
      else r.play(id, { kind: 'say-skip' });
    }
    expect(r.s.phase).toBe('finale');
    // The sheets brush on as the vote opens, and Fude reacts (or calls back a misreading).
    expect(r.view(stage).slotMs).toBeGreaterThan(0);
    expect(['shodo_gallery_reveal', 'shodo_callback']).toContain(r.s.cues.at(-1)?.event);
    // Stamps: never on your own sheet, at most three, movable.
    const sheets = r.ms().gallery!.sheets;
    const own = sheets.findIndex((x) => x.playerId === 'p1');
    expect(r.play('p1', { kind: 'stamp', award: 'tappitsu', sheet: own }).error).toBe('own-answer');
    const others = (id: string) => sheets.map((x, i) => (x.playerId === id ? -1 : i)).filter((i) => i >= 0);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      AWARDS.slice(0, 3).forEach((a, k) => expect(r.play(id, { kind: 'stamp', award: a.id, sheet: others(id)[k % 3]! }).error).toBeUndefined());
      if (id === 'p1') {
        expect(r.play('p1', { kind: 'stamp', award: AWARDS[3].id, sheet: others('p1')[0]! }).error).toBe('out-of-stamps');
        expect(r.play('p1', { kind: 'stamp', award: AWARDS[0].id, sheet: others('p1')[2]! }).error).toBeUndefined();
      }
    }
    expect(r.s.phase).toBe('penalty');
    // Stamps show now; names only once claimed.
    const gal = r.view(stage).sheets!;
    expect(gal.some((x) => Object.keys(x.stamps).length)).toBe(true);
    expect(gal.every((x) => x.name === null)).toBe(true);
    // Fude reads out a winner by number; the TV lists each stamp's winner, unnamed until claimed.
    const winners = r.view(stage).winners!;
    expect(winners.length).toBeGreaterThan(0);
    expect(winners.every((w) => w.name === null)).toBe(true);
    const announced = r.s.cues.at(-1)!;
    expect(announced.event).toBe('shodo_award');
    expect(winners.map((w) => String(w.n))).toContain(announced.slots!.n);
    // The voice reads only kana: the number comes with its reading, or "1ばん" is voiced "ばん".
    expect(announced.slots!.n_kana).toMatch(/^[ぁ-ゖ]+$/);
    r.play('p2', { kind: 'claim' });
    expect(r.s.cues.at(-1)).toMatchObject({ event: 'shodo_claimed', slots: { name: 'P2' } });
    r.play('p3', { kind: 'claim' });
    expect(r.s.cues.filter((c) => c.event === 'shodo_claimed').length).toBe(1);
    expect(r.view(stage).sheets!.filter((x) => x.name === 'P2').length).toBe(1);
    r.tick();
    expect(r.s.phase).toBe('recap');
    // Fude presents an award: the cue names it, so a bank line can stand in for a slow LLM.
    expect(r.s.cues.at(-1)).toMatchObject({ event: 'recap_award', slots: { award: expect.any(String), award_kana: expect.stringMatching(/^[ぁ-ゖァ-ヺー\s]+$/), name: expect.any(String) } });
    // Stamp awards go only to writers who claimed their sheet.
    const stampTitles = new Set<string>(AWARDS.map((a) => a.ja));
    const claimedWinners = (r.s.recap?.awards ?? []).filter((a) => stampTitles.has(a.title));
    expect(claimedWinners.every((a) => a.playerId === 'p2' || a.playerId === 'p3')).toBe(true);
    const st = r.ms();
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(st.bonus[id] ?? 0).toBeLessThanOrEqual(((st.base[id] ?? 0) * BONUS_SHARE) / (1 - BONUS_SHARE) + 1);
    for (const p of r.s.players) expect(p.score).toBe(st.earned[p.id] ?? 0);
  });

  it('logs "say it, then write it" as said from memory, unless the reading was shown first; N4 ends on a word', () => {
    const r = room(['n4', 'n4']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    r.tick();
    for (const id of ['p1', 'p2']) practice(r, id);
    expect(r.ms().practice.p1!.targets.map((t) => t.level)).toEqual(['n4', 'n4', 'n5']);
    r.tick();
    for (let i = 0; i < ITEMS; i++) {
      const item = r.ms().items.at(-1)!;
      for (const id of ['p1', 'p2']) {
        const t = item.targets[id]!;
        if (item.kind === 'recall') {
          if (id === 'p2') r.play(id, { kind: 'say-skip' });
          r.play(id, { kind: 'say', utterance: { via: 'speech', text: t.say.kana } });
        }
        r.play(id, { kind: 'sheet', cells: t.cells.map((c) => handDraw(c, random)) });
      }
      r.tick();
    }
    const [first, , last] = r.ms().items;
    const practised = r.ms().practice.p1!.targets;
    expect(first!.targets.p1!.id).toBe(practised[0]!.id);
    // The last item is a word with the second practised kanji in it, when one has it.
    const second = practised[1]!.text;
    const hasWord = writeWords.some((w) => w.word.text.includes(second));
    expect(last!.targets.p1!.kind).toBe(hasWord ? 'word' : 'kanji');
    expect(last!.targets.p1!.text).toContain(second);
    const logged = (pid: string, itemId: string) => (r.s.phrasebook[pid] ?? []).filter((x) => x.itemId === itemId).map((x) => x.recall);
    expect(logged('p1', last!.targets.p1!.id)).toContain('memory');
    // p2 gave up first: read. (A kanji target was already said from memory in practice, so check a word.)
    if (last!.targets.p2!.kind === 'word') expect(logged('p2', last!.targets.p2!.id)).toEqual(['read']);
    else expect(r.ms().items[2]!.peeked?.p2).toBe(true);
  });

  it('gives a stroke out of step its own line at the replay', () => {
    const r = room(['n5']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    for (let guard = 0; guard < 5 && r.s.phase !== 'answer'; guard++) r.tick();
    const item = r.ms().items.at(-1)!;
    const t = item.targets.p1!;
    r.play('p1', { kind: 'say-skip' });
    const swapped = t.cells.map((c) => handDraw(c, random, c.length > 1 ? { swap: [0, 1] } : {}));
    r.play('p1', { kind: 'sheet', cells: swapped });
    const sheet = item.sheets.p1!;
    expect(r.s.phase).toBe('reveal');
    expect(sheet.pass && sheet.outOfOrder !== null).toBe(true);
    if (sheet.misread) expect(r.s.cues.at(-1)).toMatchObject({ event: 'shodo_misread', slots: { target: t.text } });
    else if (sheet.outOfOrder !== null) expect(r.s.cues.at(-1)?.event).toBe('shodo_synchro_break');
  });

  it('hands in unsent ink when time runs out, and keeps Fude quiet over dictation', () => {
    const r = room(['n5', 'n5']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    for (let guard = 0; guard < 5 && r.s.phase !== 'answer'; guard++) r.tick();
    const item = r.ms().items.at(-1)!;
    expect(item.kind).toBe('recall');
    r.play('p1', { kind: 'say-skip' });
    const t = item.targets.p1!;
    // A draft with a square still empty is fine; p2 never showed the reading, so has no pad.
    expect(r.play('p1', { kind: 'draft', cells: t.cells.map((c) => handDraw(c, random)) }).error).toBeUndefined();
    expect(r.play('p2', { kind: 'draft', cells: [[]] }).error).toBeUndefined();
    r.tick();
    expect(r.s.phase).toBe('reveal');
    expect(item.sheets.p1?.pass).toBe(true);
    expect(item.sheets.p2).toBeUndefined();
    r.tick();
    expect(r.ms().items.at(-1)!.kind).toBe('dictation');
    expect(r.s.cues.at(-1)?.event).not.toBe('shodo_dictation');
  });

  it('makes the big sheet an other-hand round when the VIP ticks it', () => {
    const r = room(['n5', 'kana']);
    r.cmd(stage, { type: 'start', mode: 'shodo', extra: { otherHand: true } } as CommandBody);
    expect(r.ms().otherHand).toBe(true);
    for (let guard = 0; guard < 20 && r.s.phase !== 'encore'; guard++) r.tick();
    expect(r.s.phase).toBe('encore');
    expect(r.view(stage).otherHand).toBe(true);
    expect(r.s.cues.at(-1)?.event).toBe('shodo_other_hand');
    const plain = room(['n5']);
    plain.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    expect(plain.ms().otherHand).toBe(false);
  });

  it('never shows the answer on the phone before it is written', () => {
    const r = room(['n5', 'kana']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    r.tick();
    for (const id of ['p1', 'p2']) practice(r, id);
    r.tick();
    for (const id of ['p1', 'p2']) {
      const it = r.view(as(id)).me!.item!;
      const t = r.ms().items.at(-1)!.targets[id]!;
      expect(it.target.text).toBe('');
      expect(it.target.cells).toBeNull();
      expect(it.target.say.text).toBe('');
      // Recall: the reading too, until said.
      expect(it.target.say.kana).toBe('');
      expect(JSON.stringify(it)).not.toContain(t.text);
    }
    // The stage never names who is still writing.
    expect(JSON.stringify(r.view(stage))).not.toMatch(/"P[12]"/);
  });

  it('memory reps carry no model, and a skipped trace keeps its memory rep', () => {
    const r = room(['n5']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    r.tick();
    r.play('p1', { kind: 'say-skip' });
    const before = r.ms().practice.p1!.reps.length;
    expect(r.play('p1', { kind: 'skip-trace' }).error).toBeUndefined();
    const p = r.ms().practice.p1!;
    expect(p.reps.length).toBe(before - 2);
    expect(p.reps.filter((x) => x.target === 0).map((x) => x.kind)).toEqual(['memory']);
    while (r.ms().practice.p1!.reps[r.ms().practice.p1!.next]?.kind !== 'memory') {
      const v = r.view(as('p1')).me!.practice!;
      if (v.sayFirst) r.play('p1', { kind: 'say-skip' });
      else r.play('p1', { kind: 'rep', strokes: traceOver(v.target!.cells![0]!, random) });
    }
    const v = r.view(as('p1')).me!.practice!;
    expect(v.rep).toBe('memory');
    expect(v.target!.cells).toBeNull();
    expect(v.target!.text).toBe('');
  });

  it('rejects a traced rep that strays from the model', () => {
    const r = room(['n5']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    r.tick();
    r.play('p1', { kind: 'say-skip' });
    const t = r.view(as('p1')).me!.practice!.target!;
    r.play('p1', { kind: 'rep', strokes: t.cells![0]!.map((s) => [...s].reverse() as InkPoint[]) });
    expect(r.ms().practice.p1!.results[0]!.ok).toBe(false);
    expect(r.ms().practice.p1!.points).toBe(0);
  });

  it('skips the vote with fewer than three players', () => {
    const r = room(['n5', 'n5']);
    r.cmd(stage, { type: 'start', mode: 'shodo' } as CommandBody);
    r.tick();
    for (const id of ['p1', 'p2']) practice(r, id);
    r.tick();
    for (let i = 0; i < ITEMS; i++) {
      r.tick();
      r.tick();
    }
    expect(r.s.phase).toBe('encore');
    r.tick();
    expect(r.s.phase).toBe('penalty');
  });
});

// ---- full system ----

describe('Shodō Taikai: bots play a whole game over the real server', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 5, prompt: 3000, score: 50, answer: 1500, reveal: 50, encore: 1500, finale: 1500, penalty: 200 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('reaches the recap with scores that add up and no desyncs', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };
    let last: ShodoView | null = null;
    let replays = 0;
    let recap: RoomView['recap'] = null;
    let finished = false;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 4,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'shodo',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        const game = view.game as ShodoView | null;
        if (game) last = game;
        if (view.phase === 'reveal' && game?.sheets?.length) replays = Math.max(replays, game.item);
        if (view.phase === 'recap') recap = view.recap;
      },
    });
    director.start();
    const bots: Bot[] = [];
    const levels = ['n5', 'kana', 'n4', 'n5'] as const;
    for (let i = 1; i <= 4; i++) {
      const policy = shodoPolicy({ content, delayMs: 5, seed: i });
      bots.push(await Bot.join({ baseUrl, code: created.code, name: `sho${i}`, policy, level: levels[i - 1], onState: (bot, view, v) => record(bot.playerId, view, v) }));
    }
    await until(() => finished, 30_000, 'the game');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(replays).toBe(ITEMS);
    const standings = (recap as RoomView['recap'])!.standings;
    for (const s of standings) expect(s.score, s.name).toBe((last as ShodoView | null)?.earned[s.playerId] ?? 0);
    expect(standings.every((s) => s.score > 0)).toBe(true);
    for (const p of room.state.players) expect(room.state.phrasebook[p.id]?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
    const failures = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failures).toEqual([]);
    for (const b of bots) b.stop();
    director.client.close();
  }, 40_000);
});
