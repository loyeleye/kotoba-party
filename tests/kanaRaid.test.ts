// Kana Yōkai Raid: rules with small fixtures, then a full game played by bots through the
// real server.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BossWord, Kana, LookAlikeSet, MinimalPair } from '../content/src/types.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameContext, type GameState } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import { buildDeck, checkSound, checkWord } from '../shared/src/modes/kanaRaid/deck.js';
import { BASE_POINTS, BONUS_CAP, levelScale, type KanaRaidView, type RaidState } from '../shared/src/modes/kanaRaid/kanaRaid.js';
import { EMPTY_CONTENT, type ContentLibrary, type HostCue } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { kanaRaidPolicy } from '../tools/bots/policies/kanaRaid.js';
import { hashView, startServer, until } from './helpers.js';

// ---------- fixtures ----------

const pair = (h: string, k: string, romaji: string, sound: string, chapter: number, extra: Partial<Kana> = {}): Kana[] => [
  { id: `h-${romaji}`, char: h, script: 'hiragana', kind: 'basic', chapter, romaji, sound, twinId: `k-${romaji}`, difficulty: chapter === 1 ? 1 : 2, ...extra },
  { id: `k-${romaji}`, char: k, script: 'katakana', kind: 'basic', chapter, romaji, sound, twinId: `h-${romaji}`, difficulty: chapter === 1 ? 1 : 2, ...extra },
];
const KANA: Kana[] = [
  ...pair('あ', 'ア', 'a', 'あ', 1),
  ...pair('い', 'イ', 'i', 'い', 1),
  ...pair('う', 'ウ', 'u', 'う', 1),
  ...pair('え', 'エ', 'e', 'え', 1),
  ...pair('お', 'オ', 'o', 'お', 1),
  ...pair('か', 'カ', 'ka', 'か', 2),
  ...pair('き', 'キ', 'ki', 'き', 2),
  ...pair('す', 'ス', 'su', 'す', 3, { confusableSounds: ['つ'] }),
  ...pair('し', 'シ', 'shi', 'し', 3),
  ...pair('つ', 'ツ', 'tsu', 'つ', 4, { confusableSounds: ['す', 'ちゅ'] }),
  ...pair('を', 'ヲ', 'wo', 'お', 10),
  ...pair('ん', 'ン', 'n', 'ん', 10),
  { id: 'k-long-mark', char: 'ー', script: 'katakana', kind: 'mark', chapter: 12, romaji: 'long-mark', sound: 'ー', difficulty: 4 },
  { id: 'k-vo', char: 'ヴォ', script: 'katakana', kind: 'special', chapter: 13, romaji: 'vo', sound: 'ゔぉ', difficulty: 5 },
];
KANA.find((k) => k.id === 'h-o')!.homophoneIds = ['h-wo'];
KANA.find((k) => k.id === 'h-wo')!.homophoneIds = ['h-o'];
const LOOKS: LookAlikeSet[] = [{ id: 'shi-tsu', kanaIds: ['k-shi', 'k-tsu'], tip: 'シ rises; ツ falls.' }];
const PAIRS: MinimalPair[] = [
  { id: 'ie-iie', contrast: 'long-vowel', a: { text: '家', kana: 'いえ', en: 'house' }, b: { text: 'いいえ', kana: 'いいえ', en: 'no' }, minChapter: 1 },
];
const BOSSES: BossWord[] = [
  { id: 'aisu', word: { text: 'アイス', kana: 'アイス', en: 'ice cream' }, pieces: ['ア', 'イ', 'ス'], minChapter: 3 },
  { id: 'suki', word: { text: 'スキー', kana: 'スキー', en: 'skiing' }, pieces: ['ス', 'キ', 'ー'], minChapter: 12 },
];
const CONTENT: ContentLibrary = { ...EMPTY_CONTENT, kana: KANA, lookAlikeSets: LOOKS, minimalPairs: PAIRS, bossWords: BOSSES };
const deck = buildDeck(CONTENT);
const K = (id: string) => deck.byId.get(id)!;

// ---------- a little driver around the room machine ----------

let now = 1_000_000;
let ids = 0;
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ctx = (content: ContentLibrary = CONTENT): GameContext => ({ now, content, newId: () => `id${++ids}`, random });
let cmdN = 0;

function room(n: number, content: ContentLibrary = CONTENT) {
  const s = createGame('RAID');
  for (let i = 1; i <= n; i++) {
    apply(s, { type: 'join', playerId: `p${i}`, name: `P${i}`, level: 'kana' }, ctx(content));
    apply(s, { type: 'connection', playerId: `p${i}`, connected: true }, ctx(content));
  }
  const cmd = (actor: string | 'stage', command: CommandBody) =>
    apply(s, { type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++cmdN}` } as Command }, ctx(content));
  const play = (id: string, move: unknown) => cmd(id, { type: 'play', move });
  const timeout = () => apply(s, { type: 'timeout', phaseSeq: s.phaseSeq }, ctx(content));
  const rs = () => s.modeState as RaidState;
  const view = (id: string) => viewFor(s, { kind: 'player', playerId: id }, content).game as KanaRaidView;
  const stage = () => viewFor(s, { kind: 'stage' }, content).game as KanaRaidView;
  const score = (id: string) => s.players.find((p) => p.id === id)!.score;
  return { s, cmd, play, timeout, rs, view, stage, score };
}

/** Starts a raid and goes to wave 1's battle. */
function toBattle(r: ReturnType<typeof room>, chapters: Record<string, number[]> = {}) {
  expect(r.cmd('stage', { type: 'start', mode: 'kana-raid' }).error).toBeUndefined();
  expect(r.s.phase).toBe('intro');
  for (const p of r.s.players) {
    if (chapters[p.id]) expect(r.play(p.id, { kind: 'chapters', chapters: chapters[p.id] }).error).toBeUndefined();
  }
  for (const p of r.s.players) r.play(p.id, { kind: 'ready' });
  expect(r.s.phase).toBe('prompt');
  r.timeout();
  expect(r.s.phase).toBe('answer');
}

/** Answers the player's current attack right (or wrong) using the server's answer. */
function answer(r: ReturnType<typeof room>, id: string, right: boolean, how: 'speech' | 'tap' = 'speech') {
  const a = r.rs().players[id]!.attack!;
  if (a.kind === 'shout' && how === 'speech') {
    const k = K(a.itemId);
    return r.play(id, { kind: 'attack', attackId: a.id, say: { via: 'speech', text: right ? k.char : k.sound === 'ん' ? 'あ' : 'ん' } });
  }
  const wrong = a.options.find((o) => o.id !== a.answer)!.id;
  return r.play(id, { kind: 'attack', attackId: a.id, pick: right ? a.answer : wrong });
}

/** Forces the next attack to be a Shout (so a test can check speaking). */
function forceShout(r: ReturnType<typeof room>, id: string) {
  for (let i = 0; i < 50 && r.rs().players[id]!.attack!.kind !== 'shout'; i++) answer(r, id, true);
  expect(r.rs().players[id]!.attack!.kind).toBe('shout');
}

// ---------- tests ----------

describe('kana sound check', () => {
  it('accepts the sound, its homophones and a stretched vowel; refuses confusions and romaji', () => {
    expect(checkSound(['か'], K('h-ka'), deck).ok).toBe(true);
    expect(checkSound(['カー'], K('h-ka'), deck).ok).toBe(true);
    expect(checkSound(['かっ'], K('k-ka'), deck).ok).toBe(true);
    expect(checkSound(['を'], K('h-o'), deck).ok).toBe(true);
    expect(checkSound(['お'], K('h-wo'), deck).ok).toBe(true);
    expect(checkSound(['ゔぉ'], K('k-vo'), deck).ok).toBe(true);
    const tsu = checkSound(['す'], K('h-tsu'), deck);
    expect(tsu).toMatchObject({ ok: false, heard: 'す' });
    expect(checkSound(['ka'], K('h-ka'), deck)).toMatchObject({ ok: false, romaji: true });
    expect(checkSound(['き'], K('h-ka'), deck).ok).toBe(false);
  });

  it('tells long from short in minimal pairs', () => {
    const [p] = PAIRS;
    expect(checkWord(['いいえ'], p!.b, p!.a)).toBe(true);
    expect(checkWord(['いえ'], p!.b, p!.a)).toBe(false);
    expect(checkWord(['家'], p!.a, p!.b)).toBe(true);
  });

  it('scales damage so a first-timer’s あ hits as hard as an expert’s ヴォ', () => {
    expect(levelScale(K('h-a').difficulty, 1)).toBe(1);
    expect(levelScale(K('k-vo').difficulty, 13)).toBe(1);
    expect(levelScale(K('h-a').difficulty, 13)).toBeLessThan(1);
  });
});

describe('Kana Yōkai Raid rules', () => {
  it('chapter pick never holds up the room and defaults to chapter 1', () => {
    const r = room(2);
    r.cmd('stage', { type: 'start', mode: 'kana-raid' });
    expect(r.view('p1').chapters.length).toBeGreaterThan(3);
    expect(r.play('p1', { kind: 'chapters', chapters: [1, 99] }).error).toBe('bad-chapters');
    expect(r.play('p1', { kind: 'chapters', chapters: 'all' }).error).toBe('bad-chapters');
    r.play('p1', { kind: 'chapters', chapters: [2, 1] });
    r.play('p1', { kind: 'ready' });
    expect(r.s.phase).toBe('intro'); // p2 isn't ready, but the timer still runs
    r.timeout();
    expect(r.s.phase).toBe('prompt');
    expect(r.rs().players.p1!.chapters).toEqual([1, 2]);
    expect(r.rs().players.p2!.chapters).toEqual([1]);
  });

  it('attacks each player only with kana from their own chapters, and keeps attacks private', () => {
    const r = room(2);
    toBattle(r, { p1: [1], p2: [3, 4] });
    for (let i = 0; i < 25; i++) {
      for (const id of ['p1', 'p2']) {
        const a = r.rs().players[id]!.attack!;
        const k = K(a.itemId);
        expect(r.rs().players[id]!.chapters).toContain(k.chapter);
        answer(r, id, i % 3 !== 0);
        now += 200;
      }
    }
    // The horde mixes both players' chapters.
    const chapters = new Set(r.rs().horde.map((y) => K(y.itemId).chapter));
    expect([...chapters].some((c) => c === 1) && [...chapters].some((c) => c >= 3)).toBe(true);
    // The stage never sees an attack; a phone sees only its own and never the answer.
    expect(r.stage().me).toBeNull();
    const mine = r.view('p1').me!.attack!;
    expect(mine).not.toHaveProperty('answer');
    expect(mine).not.toHaveProperty('itemId');
    expect(JSON.stringify(r.view('p1'))).not.toContain(r.rs().players.p2!.attack!.id);
  });

  it('a spoken hit earns the speaking bonus; a quiet one hits for less; a miss costs nothing and retries once', () => {
    const r = room(1);
    toBattle(r);
    forceShout(r, 'p1');
    const before = r.score('p1');
    answer(r, 'p1', true, 'speech');
    const spoken = r.rs().players.p1!.last!;
    expect(spoken.ok).toBe(true);
    expect(r.score('p1') - before).toBe(Math.round(BASE_POINTS * 1.3));
    expect(spoken.damage).toBe(BASE_POINTS);

    forceShout(r, 'p1');
    const b2 = r.score('p1');
    answer(r, 'p1', true, 'tap');
    const quiet = r.rs().players.p1!.last!;
    expect(r.score('p1') - b2).toBe(BASE_POINTS);
    expect(quiet.damage).toBe(Math.round(BASE_POINTS * 0.7));

    const missed = r.rs().players.p1!.attack!;
    const b3 = r.score('p1');
    answer(r, 'p1', false);
    const last = r.rs().players.p1!.last!;
    expect(last.ok).toBe(false);
    expect(last.tip).toBeTruthy();
    expect(r.score('p1')).toBe(b3);
    const retry = r.rs().players.p1!.attack!;
    expect(retry.itemId).toBe(missed.itemId);
    expect(retry.retry).toBe(true);
    answer(r, 'p1', false);
    expect(r.rs().players.p1!.attack!.retry).toBe(false);
  });

  it('rejects stale and malformed attacks', () => {
    const r = room(1);
    toBattle(r);
    const a = r.rs().players.p1!.attack!;
    expect(r.play('p1', { kind: 'attack', attackId: 'nope', pick: '0' }).error).toBe('stale-attack');
    expect(r.play('p1', { kind: 'attack', attackId: a.id }).error).toBe('bad-answer');
    expect(r.play('p1', { kind: 'attack', attackId: a.id, say: { via: 'shout', text: 'あ' } }).error).toBe('bad-answer');
    expect(r.play('p1', { kind: 'chapters', chapters: [1] }).error).toBe('wrong-phase');
    expect(r.play('p1', 'hello').error).toBe('bad-move');
  });

  it('team combos multiply damage and cue Fude; escapes go on the haunted list', () => {
    const r = room(2);
    toBattle(r);
    const cues: HostCue[] = [];
    const drain = () => cues.push(...r.s.cues.splice(0));
    drain();
    now = r.rs().horde[0]!.spawnAt + 10;
    for (let i = 0; i < 4; i++) {
      answer(r, i % 2 ? 'p2' : 'p1', true, 'tap');
      now += 300;
    }
    drain();
    expect(r.rs().combo.players.length).toBe(2);
    expect(r.rs().combo.best).toBeGreaterThanOrEqual(3);
    expect(cues.some((c) => c.event === 'raid_combo')).toBe(true);
    // Let the rest walk off: the next move settles the escape.
    now = Math.max(...r.rs().horde.map((y) => y.escapeAt)) + 1;
    answer(r, 'p1', true, 'tap');
    drain();
    expect(r.rs().horde.every((y) => y.state !== 'alive')).toBe(true);
    expect(r.rs().escaped.length).toBeGreaterThan(0);
    expect(cues.some((c) => c.event === 'raid_escape')).toBe(true);
    // Everything is gone, so the battle ends early.
    expect(r.s.phase).toBe('reveal');
    expect(r.stage().waveResult!.escaped).toBeGreaterThan(0);
  });

  it('plays all three waves, the boss and the raid recap; bonuses stay inside the cap', () => {
    const r = room(3);
    toBattle(r, { p1: [1], p2: [1, 2, 3], p3: [1, 2, 3, 4, 10] });
    const kinds = new Set<string>();
    for (let wave = 1; wave <= 3; wave++) {
      expect(r.s.phase).toBe('answer');
      expect(r.rs().wave).toBe(wave);
      for (let i = 0; i < 12 && r.s.phase === 'answer'; i++) {
        for (const id of ['p1', 'p2', 'p3']) {
          if (r.s.phase !== 'answer') break;
          const a = r.rs().players[id]!.attack!;
          kinds.add(a.kind);
          if (a.kind === 'pair') {
            r.play(id, { kind: 'attack', attackId: a.id, pick: a.answer });
            const b = r.rs().players[id]!.attack!;
            expect(b.step).toBe('say');
            r.play(id, { kind: 'attack', attackId: b.id, say: { via: 'speech', text: b.word!.kana } });
          } else answer(r, id, (i + id.length) % 4 !== 0);
          now += 150;
        }
      }
      if (r.s.phase === 'answer') r.timeout();
      expect(r.s.phase).toBe('reveal');
      const result = r.stage().waveResult!;
      for (const p of result.players) expect(p.bonus).toBeLessThanOrEqual(BONUS_CAP * p.points + 1);
      r.timeout(); // → score
      r.timeout(); // → prompt or finale
      if (wave < 3) r.timeout(); // prompt → answer
    }
    expect(kinds).toEqual(new Set(['shout', 'twin', 'lookalike', 'echo', 'pair']));

    expect(r.s.phase).toBe('finale');
    const boss = r.stage().boss!;
    expect(boss.word).toBe('アイス'); // chapter 4 at most: スキー needs chapter 12
    expect(new Set(boss.pieces.map((x) => x.owner)).size).toBe(3); // one piece each
    for (let i = 0; i < 20 && r.rs().boss!.stage === 'break'; i++) {
      for (const id of ['p1', 'p2', 'p3']) {
        const a = r.rs().players[id]!.attack;
        if (a?.kind === 'piece') r.play(id, { kind: 'attack', attackId: a.id, pick: a.answer });
      }
    }
    expect(r.rs().boss!.stage).toBe('blow');
    const cues = r.s.cues.splice(0);
    expect(cues.some((c) => c.event === 'kakegoe_call')).toBe(true);
    r.play('p1', { kind: 'attack', attackId: r.rs().players.p1!.attack!.id, say: { via: 'speech', text: 'アイス' } });
    r.play('p2', { kind: 'attack', attackId: r.rs().players.p2!.attack!.id, say: { via: 'typed', text: 'あいす' } });
    expect(r.s.phase).toBe('finale');
    r.play('p3', { kind: 'attack', attackId: r.rs().players.p3!.attack!.id, pass: true });
    expect(r.s.phase).toBe('encore');
    expect(r.rs().boss!.defeated).toBe(true);

    const sum = r.stage().summary!;
    expect(sum.bossDefeated).toBe(true);
    expect(sum.correct.length).toBeGreaterThan(0);
    const mine = r.view('p1').me!.recap!;
    expect(mine.seen.length).toBeGreaterThan(0);
    expect(r.view('p2').me!.recap).not.toEqual(null);
    r.timeout();
    expect(r.s.phase).toBe('recap');
    expect(r.s.recap!.awards.length).toBeGreaterThan(0);
    expect(r.s.phrasebook.p1!.length).toBeGreaterThan(0);
    expect(r.s.phrasebook.p1!.some((e) => e.text === 'アイス' && e.outcome === 'said')).toBe(true);
  });

  it('runs end to end on the built-in placeholder set when content is empty', () => {
    const r = room(1, EMPTY_CONTENT);
    expect(r.cmd('stage', { type: 'start', mode: 'kana-raid' }).error).toBeUndefined();
    r.play('p1', { kind: 'ready' });
    let guard = 0;
    while (r.s.phase !== 'recap' && guard++ < 200) {
      const a = r.rs().players.p1?.attack;
      if (a && (r.s.phase === 'answer' || r.s.phase === 'finale')) {
        if (a.kind === 'blow') r.play('p1', { kind: 'attack', attackId: a.id, say: { via: 'speech', text: a.word!.kana } });
        else if (a.kind === 'pair' && a.step === 'say') r.play('p1', { kind: 'attack', attackId: a.id, pass: true });
        else r.play('p1', { kind: 'attack', attackId: a.id, pick: a.answer });
        now += 100;
      } else r.timeout();
    }
    expect(r.s.phase).toBe('recap');
    expect(r.score('p1')).toBeGreaterThan(0);
    expect(r.s.players[0]!.score).toBeGreaterThan(0);
  });
});

describe('Kana Yōkai Raid: bots play a whole game through the server', () => {
  let srv: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    srv = await startServer({ durations: { intro: 1_500, prompt: 30, answer: 2_500, reveal: 30, score: 30, finale: 2_500, encore: 30 } });
  });
  afterAll(async () => {
    await srv.server.close();
  });

  it('4 bots raid to the recap with every client in sync', async () => {
    const { baseUrl, truth, server } = srv;
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
    let standings: { playerId: string; score: number }[] = [];
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 4,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'kana-raid',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        phases.add(view.phase);
        if (view.phase === 'recap' && view.recap) standings = view.recap.standings;
      },
    });
    director.start();
    const policy = kanaRaidPolicy({ minDelayMs: 5, maxDelayMs: 60 });
    const bots: Bot[] = [];
    for (let i = 1; i <= 4; i++) {
      bots.push(await Bot.join({ baseUrl, code: created.code, name: `raider${i}`, level: 'kana', policy, onState: (bot, view, v) => record(bot.playerId, view, v) }));
    }
    await until(() => finished, 20_000, 'the raid to reach the recap');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    for (const p of ['intro', 'prompt', 'answer', 'reveal', 'score', 'finale', 'encore', 'recap']) expect(phases).toContain(p);
    const failed = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
    expect(failed).toEqual([]);
    expect(bots.reduce((n, b) => n + b.moves.filter((m) => m.ok).length, 0)).toBeGreaterThan(20);
    // Scores: the recap matches the room and someone scored.
    for (const s of standings) expect(s.score).toBe(room.state.players.find((p) => p.id === s.playerId)!.score);
    expect(standings.some((s) => s.score > 0)).toBe(true);
    // Every accepted state matches what the server committed for that viewer.
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
