import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import type { CommandBody } from '../shared/src/client.js';
import { createRoom } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import {
  CHORUS_CAP,
  CHORUS_POINTS,
  CROWD_BONUS,
  pickDuel,
  planTurns,
  type KaraokeDuelView,
  type KaraokeState,
} from '../shared/src/modes/karaokeDuel/karaokeDuel.js';
import { detectPitch, hzToMidi, midiToHz, summarise, type PitchSample } from '../shared/src/modes/karaokeDuel/pitch.js';
import {
  FRAME_MS,
  foldOctave,
  MAX_FRAMES,
  melodyFrames,
  moraSimilarity,
  parseTake,
  SANG_IT_QUALITY,
  pitchScore,
  pronScore,
  scoreTake,
  timingScore,
  TYPED_SHARE,
  type Take,
} from '../shared/src/modes/karaokeDuel/scoring.js';
import { lineMs, romajiMorae, SONGS, splitMorae, type SongLine } from '../shared/src/modes/karaokeDuel/songs.js';
import { EMPTY_CONTENT, type ModePlayer } from '../shared/src/modes/mode.js';
import { isKana } from '../shared/src/japanese/kana.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { addReadings, createReader } from '../server/src/reading.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { karaokeDuelPolicy, sungKana } from '../tools/bots/policies/karaokeDuel.js';
import { hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

const SONG = SONGS[0]!;
const LINE = SONG.lines[0]!; // おはよう おはよう
const LEN = lineMs(LINE, SONG.bpm);

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

const speech = (text: string) => ({ via: 'speech' as const, text });

/** A perfect sung take of `line` (kana transcript, the melody in tune, on the beat). */
function perfect(line: SongLine, bpm: number, transpose = 0): Omit<Take, 'utterance'> & { utterance: { via: 'speech'; text: string } } {
  return { utterance: speech(line.kana), pitch: melodyFrames(line, bpm, transpose), onsetMs: 0, durMs: lineMs(line, bpm), timing: 'mic' };
}

class Table {
  now = 1_000_000;
  ids = 0;
  cmdId = 0;
  readonly random: () => number;
  readonly s: GameState = createGame('BCDF');
  constructor(players: number, seed = 7, levels: Level[] = []) {
    this.random = mulberry(seed);
    for (let i = 1; i <= players; i++) {
      this.act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: levels[i - 1] ?? 'n5' });
      this.act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
  }
  ctx(): GameContext {
    return { now: this.now, content: EMPTY_CONTENT, newId: () => `id${++this.ids}`, random: this.random };
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
  get st(): KaraokeState {
    return this.s.modeState as KaraokeState;
  }
  view(viewer: string | 'stage' = 'stage'): KaraokeDuelView {
    return viewFor(this.s, viewer === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: viewer }, EMPTY_CONTENT).game as KaraokeDuelView;
  }
  start(rounds?: number) {
    expect(this.cmd('stage', { type: 'start', mode: 'karaoke-duel', rounds }).changed).toBe(true);
    this.timeout(); // intro → song card
    expect(this.s.phase).toBe('prompt');
  }
  /** The current line and singer. */
  get turn() {
    const v = this.view();
    return { no: v.turn!.no, singer: v.turn!.singerId, line: v.song!.lines[v.turn!.line]!, src: SONGS.find((x) => x.id === v.song!.id)!.lines[v.turn!.line]!, bpm: v.song!.bpm };
  }
  sing(extra: Record<string, unknown> = {}) {
    const t = this.turn;
    return this.play(t.singer, { kind: 'sing', turn: t.no, ...perfect(t.src, t.bpm), ...extra });
  }
  score(id: string) {
    return this.s.players.find((p) => p.id === id)!.score;
  }
}

// ---- songs ----

describe('Karaoke Duel: songs', () => {
  it('has original draft songs whose every line has one note and one romaji syllable per mora', () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(4);
    // At least four grown-up songs, so a default four-song game has no children's songs.
    expect(SONGS.filter((s) => !s.kids).length).toBeGreaterThanOrEqual(4);
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
    for (const song of SONGS) {
      expect(song.status).toBe('draft');
      expect(song.lines.length).toBe(4);
      for (const line of song.lines) {
        const morae = splitMorae(line.kana);
        expect(isKana(line.kana), line.kana).toBe(true);
        expect(line.melody.length, `${song.id}: ${line.kana}`).toBe(morae.length);
        expect(romajiMorae(line).length, `${song.id}: ${line.romaji}`).toBe(morae.length);
        for (const [midi, beats] of line.melody) {
          expect(midi).toBeGreaterThanOrEqual(48);
          expect(midi).toBeLessThanOrEqual(84);
          expect(beats).toBeGreaterThan(0);
        }
        // Short enough to sing in one breath: under 5 s.
        expect(lineMs(line, song.bpm)).toBeLessThan(5_000);
      }
    }
  });

  it('plays every grown-up song before any children’s song', () => {
    const t = new Table(2);
    t.start();
    const grown = SONGS.filter((x) => !x.kids).map((x) => x.id);
    const order = t.st.songOrder;
    expect(order).toHaveLength(SONGS.length);
    expect([...order.slice(0, grown.length)].sort()).toEqual([...grown].sort());
    expect(t.view().song!.style).toBe(SONGS.find((x) => x.id === order[0])!.style);
  });

  it('splits kana into morae: small kana join, っ ん ー stand alone', () => {
    expect(splitMorae('きょうも たのしかった')).toEqual(['きょ', 'う', 'も', 'た', 'の', 'し', 'か', 'っ', 'た']);
    expect(splitMorae('ラーメン')).toEqual(['ラ', 'ー', 'メ', 'ン']);
    expect(splitMorae('にゃあ！')).toEqual(['にゃ', 'あ']);
  });
});

// ---- scoring ----

describe('Karaoke Duel: pronunciation', () => {
  it('compares mora by mora, forgiving script and same-sounding spellings', () => {
    expect(moraSimilarity('おはよう おはよう', 'おはようおはよう')).toBe(1);
    expect(moraSimilarity('おはよう おはよう', 'オハヨーオハヨー')).toBe(1);
    expect(moraSimilarity('つぎは とうきょう', 'つぎはとーきょー')).toBe(1);
    expect(moraSimilarity('おはよう おはよう', 'おはよおはよう')).toBeCloseTo(7 / 8);
    expect(moraSimilarity('おはよう おはよう', '')).toBe(0);
    expect(moraSimilarity('ねこが ねてる', 'ぜんぜん ちがう ことば です よ ね')).toBe(0);
  });

  it('reads a kanji transcript through the reading the server adds', () => {
    const line = SONGS.find((s) => s.id === 'densha')!.lines[2]!; // まどから ふじさん
    expect(pronScore(line, { via: 'speech', text: '窓から富士山', reading: 'まどからふじさん' }, 'n5').score).toBe(1);
    // Without the reading only the kana in it (から) can match.
    expect(pronScore(line, { via: 'speech', text: '窓から富士山' }, 'n5').score).toBeLessThan(0.5);
  });

  it('the server finds the transcript in a sing move and adds its kana reading', async () => {
    const reader = await createReader();
    const body = { type: 'play', move: { kind: 'sing', turn: 3, utterance: { via: 'speech', text: '窓から富士山', reading: 'forged' } } };
    addReadings(body, reader);
    expect(body.move.utterance.reading).toBe('まどからふじさん');
  });

  it('stretches by level: a Kana-level near miss is full marks, an N4 one is not', () => {
    const near = speech('おはよおはよう'); // 7 of 8 morae
    expect(pronScore(LINE, near, 'kana').score).toBe(1);
    expect(pronScore(LINE, near, 'n4').score).toBeLessThan(1);
  });
});

describe('Karaoke Duel: pitch', () => {
  it('folds octave slips', () => {
    expect(foldOctave(12)).toBe(0);
    expect(foldOctave(-12)).toBe(0);
    expect(foldOctave(13)).toBe(1);
    expect(foldOctave(7)).toBe(-5);
  });

  it('scores the shape: in any key or octave the melody is perfect', () => {
    for (const shift of [0, 5, -3, -12, 12, -7]) expect(pitchScore(LINE, SONG.bpm, melodyFrames(LINE, SONG.bpm, shift), 0, LEN), `shift ${shift}`).toBeCloseTo(1);
  });

  it('a slow or late singer still lines up (the voiced span is stretched over the line)', () => {
    const slow = melodyFrames(LINE, SONG.bpm).flatMap((v) => [v, v]); // twice as slow
    expect(pitchScore(LINE, SONG.bpm, [null, null, null, ...slow], 300, LEN * 2)).toBeGreaterThan(0.9);
  });

  it('a monotone or a melody upside down scores low; silence is "not measured"', () => {
    const flat = melodyFrames(LINE, SONG.bpm).map((v) => (v === null ? null : 64));
    expect(pitchScore(LINE, SONG.bpm, flat, 0, LEN)!).toBeLessThan(0.75);
    const upside = melodyFrames(LINE, SONG.bpm).map((v) => (v === null ? null : 128 - v));
    expect(pitchScore(LINE, SONG.bpm, upside, 0, LEN)!).toBeLessThan(0.6);
    expect(pitchScore(LINE, SONG.bpm, Array(30).fill(null), 0, LEN)).toBeNull();
  });

  it('treats a small っ as a rest', () => {
    const line = SONG.lines[3]!; // いってきます
    const frames = melodyFrames(line, SONG.bpm);
    expect(frames.some((v) => v === null)).toBe(true);
    expect(pitchScore(line, SONG.bpm, frames, 0, lineMs(line, SONG.bpm))).toBeCloseTo(1);
  });
});

describe('Karaoke Duel: timing and the whole take', () => {
  it('timing: on the beat and the right length is perfect; very late or very short is not', () => {
    expect(timingScore(LEN, 0, LEN)).toBe(1);
    expect(timingScore(LEN, -200, LEN * 1.2)).toBe(1);
    expect(timingScore(LEN, 1_500, LEN)).toBeCloseTo(0.4);
    expect(timingScore(LEN, 0, LEN * 0.3)).toBeCloseTo(0.6);
  });

  it('weights pronunciation 60, pitch 25, timing 15', () => {
    const take = perfect(LINE, SONG.bpm) as Take;
    expect(scoreTake(LINE, SONG.bpm, LEN, take, 'n5')).toMatchObject({ quality: 100, pitchUsed: true });
    // In tune and on time, but the words only half right (N4: full marks from 0.95).
    const half = scoreTake(LINE, SONG.bpm, LEN, { ...take, utterance: speech('おはよう') }, 'n4');
    expect(half.pron).toBeCloseTo(0.5 / 0.95);
    expect(half.quality).toBe(Math.round(100 * (0.6 * half.pron + 0.25 * half.pitch! + 0.15 * half.timing!)));
  });

  it('without pitch it reweights to words 80% and timing 20%, and says so', () => {
    const take = { ...(perfect(LINE, SONG.bpm) as Take), pitch: null, timing: 'button' as const, onsetMs: 1_500 };
    const s = scoreTake(LINE, SONG.bpm, LEN, take, 'n5');
    expect(s.pitchUsed).toBe(false);
    expect(s.pitch).toBeNull();
    expect(s.quality).toBe(Math.round(100 * (0.6 + 0.15 * 0.4) / 0.75));
  });

  it('a tracker that heard nothing in tune is a 0 for pitch, not a reweight', () => {
    const s = scoreTake(LINE, SONG.bpm, LEN, { ...(perfect(LINE, SONG.bpm) as Take), pitch: Array(20).fill(null) }, 'n5');
    expect(s.pitchUsed).toBe(true);
    expect(s.pitch).toBe(0);
    expect(s.quality).toBe(75);
  });

  it('no words, no tune: humming (or the TV) in perfect pitch scores nothing', () => {
    const s = scoreTake(LINE, SONG.bpm, LEN, { ...(perfect(LINE, SONG.bpm) as Take), utterance: speech('') }, 'n5');
    expect(s.quality).toBe(0);
  });

  it('the typed quiet fallback earns half the words score and nothing else', () => {
    const s = scoreTake(LINE, SONG.bpm, LEN, { utterance: { via: 'typed', text: LINE.kana }, pitch: null, onsetMs: null, durMs: null, timing: null }, 'n5');
    expect(s.quality).toBe(50);
  });

  it('takes an honour-system "I sang it" tap at a small fixed score', () => {
    const take = parseTake({ utterance: { via: 'tap', text: 'ignored' } });
    expect('error' in take).toBe(false);
    if ('error' in take) return;
    expect(take.utterance.text).toBe('');
    const score = scoreTake(LINE, SONG.bpm, 4000, take, 'kana');
    expect(score.quality).toBe(SANG_IT_QUALITY);
    expect(score.quality).toBeLessThan(100 * TYPED_SHARE);
  });

  it('refuses malformed takes outright', () => {
    const ok = { ...perfect(LINE, SONG.bpm) } as unknown as Record<string, unknown>;
    expect('error' in parseTake(ok)).toBe(false);
    const bad: Record<string, unknown>[] = [
      { ...ok, utterance: { via: 'shout', text: 'x' } },
      { ...ok, utterance: { via: 'speech', text: 'x'.repeat(500) } },
      { ...ok, pitch: Array(MAX_FRAMES + 1).fill(60) },
      { ...ok, pitch: [60, Number.NaN] },
      { ...ok, pitch: [60, Number.POSITIVE_INFINITY] },
      { ...ok, pitch: [60, 400] },
      { ...ok, pitch: [60, '61'] },
      { ...ok, pitch: { 0: 60 } },
      { ...ok, onsetMs: Number.NaN },
      { ...ok, onsetMs: 1e9 },
      { ...ok, onsetMs: undefined },
      { ...ok, durMs: -1 },
      { ...ok, durMs: '300' },
      { ...ok, timing: 'vibes' },
      { ...ok, utterance: { via: 'typed', text: '   ' } },
    ];
    for (const raw of bad) expect('error' in parseTake(raw), JSON.stringify(raw).slice(0, 80)).toBe(true);
  });
});

describe('Karaoke Duel: the phone’s pitch tracker', () => {
  const sine = (hz: number, rate = 44_100, n = 2048, amp = 0.3) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));

  it('finds the pitch of a sung note and ignores silence', () => {
    for (const hz of [110, 196, 261.63, 440, 660]) {
      const found = detectPitch(sine(hz), 44_100);
      expect(found, `${hz} Hz`).not.toBeNull();
      expect(Math.abs(hzToMidi(found!.hz) - hzToMidi(hz)), `${hz} Hz`).toBeLessThan(0.2);
    }
    expect(detectPitch(new Float32Array(2048), 44_100)).toBeNull();
    const noise = mulberry(3);
    expect(detectPitch(Float32Array.from({ length: 2048 }, () => noise() - 0.5), 44_100)).toBeNull();
  });

  it('turns samples into a capped contour from the first beat, plus onset and length', () => {
    const samples: PitchSample[] = [];
    for (let t = -1_600; t < 3_000; t += 40) {
      const singing = t >= 120 && t < 2_400;
      samples.push({ t, rms: singing ? 0.2 : 0.004, midi: singing ? hzToMidi(midiToHz(64)) : null });
    }
    const s = summarise(samples);
    expect(s.onsetMs).toBe(120);
    expect(s.durMs).toBeGreaterThan(2_200);
    expect(s.pitch.length).toBe(Math.ceil(2_961 / FRAME_MS));
    expect(s.pitch[0]).toBeNull();
    expect(s.pitch[5]).toBe(64);
    const long = summarise(Array.from({ length: 1_000 }, (_, i) => ({ t: i * 40, rms: 0.2, midi: 60 })));
    expect(long.pitch.length).toBe(MAX_FRAMES);
  });
});

// ---- duels ----

const mp = (id: string, seat: number, connected = true): ModePlayer => ({ id, name: id, seat, level: 'n5', connected, score: 0 });

describe('Karaoke Duel: who duels', () => {
  it('everyone duels before anyone duels twice, and a pair never repeats back to back', () => {
    const players = [1, 2, 3, 4, 5].map((i) => mp(`p${i}`, i));
    const count: Record<string, number> = {};
    let last = '';
    const random = mulberry(9);
    for (let round = 0; round < 6; round++) {
      const duel = pickDuel(players, count, last, random)!;
      const key = [duel.a, duel.b].sort().join('|');
      expect(key).not.toBe(last);
      last = key;
      for (const id of [duel.a, duel.b]) count[id] = (count[id] ?? 0) + 1;
      const values = players.map((p) => count[p.id] ?? 0);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
      if (round === 2) expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
    }
  });

  it('prefers connected players, and lines alternate who goes first', () => {
    const duel = pickDuel([mp('a', 1, false), mp('b', 2), mp('c', 3)], {}, '', () => 0.5)!;
    expect([duel.a, duel.b].sort()).toEqual(['b', 'c']);
    expect(planTurns({ a: 'x', b: 'y' }, 3).map((t) => `${t.line}${t.singerId}`)).toEqual(['0x', '0y', '1y', '1x', '2x', '2y']);
  });
});

describe('Karaoke Duel: a game', () => {
  it('two players: song card, eight sing turns, no crowd vote, result; the last song counts double', () => {
    const t = new Table(2);
    t.start(2);
    const view = t.view();
    expect(view.song?.lines.length).toBe(4);
    expect(view.duel).toEqual({ a: 'p1', b: 'p2' });
    t.timeout();
    let turns = 0;
    while (t.s.phase === 'answer') {
      expect(t.sing().error).toBeUndefined(); // a take ends the turn at once
      turns += 1;
    }
    expect(turns).toBe(8);
    expect(t.s.phase).toBe('score');
    expect(t.view().result?.sung).toEqual({ p1: 400, p2: 400 });
    expect(t.view().result?.winners.sort()).toEqual(['p1', 'p2']);
    expect(t.score('p1')).toBe(400);
    t.timeout(); // round 2: the final song
    expect(t.s.phase).toBe('prompt');
    expect(t.view().doubled).toBe(true);
    t.timeout();
    t.sing();
    expect(t.score(t.st.takes[0]!.playerId)).toBe(600);
    for (let i = 0; i < 100 && t.s.phase !== 'recap'; i++) t.timeout();
    expect(t.s.phase).toBe('recap');
    expect(t.s.recap?.awards.map((a) => a.title)).toContain('カラオケ スター');
    // Every line sung went in the phrasebook.
    expect(t.s.phrasebook.p1?.length).toBeGreaterThan(0);
  });

  it('refuses stale, out-of-turn and repeated takes; a missed turn scores 0 and moves on', () => {
    const t = new Table(2);
    t.start(1);
    t.timeout();
    const first = t.turn;
    const other = first.singer === 'p1' ? 'p2' : 'p1';
    expect(t.play(other, { kind: 'sing', turn: first.no, ...perfect(first.src, first.bpm) }).error).toBe('not-your-turn');
    expect(t.play(first.singer, { kind: 'sing', turn: first.no - 1, ...perfect(first.src, first.bpm) }).error).toBe('wrong-phase');
    expect(t.play(first.singer, { kind: 'sing', turn: first.no, ...perfect(first.src, first.bpm), pitch: [Number.NaN] }).error).toBe('bad-pitch');
    expect(t.play(first.singer, { kind: 'sing', turn: first.no, ...perfect(first.src, first.bpm), onsetMs: '0' }).error).toBe('bad-timing');
    // Nobody sings: the turn times out with a missed take.
    t.timeout();
    expect(t.st.takes[0]).toMatchObject({ missed: true, points: 0 });
    expect(t.s.phase).toBe('answer');
    // The first singer's late take for the old turn doesn't count for the new one.
    expect(t.play(first.singer, { kind: 'sing', turn: first.no, ...perfect(first.src, first.bpm) }).error).toBe('wrong-phase');
    expect(t.sing().error).toBeUndefined();
  });

  it('a duelist who drops is skipped', () => {
    const t = new Table(2);
    t.start(1);
    t.timeout();
    const singer = t.turn.singer;
    t.act({ type: 'connection', playerId: singer, connected: false });
    expect(t.st.takes[0]).toMatchObject({ playerId: singer, missed: true });
  });

  it('the audience sings along (capped) and votes for the crowd favourite', () => {
    const t = new Table(3, 4, ['n5', 'n5', 'kana']);
    t.start(1);
    const duel = t.st.duel!;
    const fan = ['p1', 'p2', 'p3'].find((id) => id !== duel.a && id !== duel.b)!;
    t.timeout();
    // Duelists can't chorus; the fan can, once per line, up to the cap.
    expect(t.play(duel.a, { kind: 'chorus', turn: t.turn.no, utterance: speech(t.turn.line.kana) }).error).toBe('not-eligible');
    let turns = 0;
    while (t.s.phase === 'answer') {
      const turn = t.turn;
      expect(t.view(fan).mine?.canChorus).toBe(true);
      expect(t.play(fan, { kind: 'chorus', turn: turn.no, utterance: speech(turn.line.kana) }).error).toBeUndefined();
      expect(t.play(fan, { kind: 'chorus', turn: turn.no, utterance: speech(turn.line.kana) }).error).toBe('already-answered');
      // A typed chorus isn't a chorus.
      expect(t.play(fan, { kind: 'chorus', turn: turn.no, utterance: { via: 'typed', text: 'x' } }).error).toBeDefined();
      t.sing();
      turns += 1;
    }
    expect(turns).toBe(8);
    expect(t.score(fan)).toBe(CHORUS_CAP);
    expect(CHORUS_CAP / CHORUS_POINTS).toBeLessThan(8);
    // The crowd vote.
    expect(t.s.phase).toBe('reveal');
    expect(t.play(duel.a, { kind: 'vote', playerId: duel.b }).error).toBe('not-eligible');
    expect(t.play(fan, { kind: 'vote', playerId: fan }).error).toBe('bad-vote');
    const before = t.score(duel.b);
    expect(t.play(fan, { kind: 'vote', playerId: duel.b }).error).toBeUndefined();
    // Everyone in: straight to the result. The final (only) round doubles the crowd bonus.
    expect(t.s.phase).toBe('score');
    expect(t.score(duel.b) - before).toBe(2 * CROWD_BONUS);
    expect(t.view().result?.winners).toEqual([duel.b]);
    expect(t.s.phrasebook[fan]?.every((e) => e.outcome === 'said')).toBe(true);
  });

  it('keeps what the recogniser heard private to the singer', () => {
    const t = new Table(3);
    t.start(1);
    t.timeout();
    const singer = t.turn.singer;
    t.play(singer, { kind: 'sing', turn: t.turn.no, ...perfect(t.turn.src, t.turn.bpm), utterance: speech('おはよ おはよう') });
    const stage = JSON.stringify(viewFor(t.s, { kind: 'stage' }, EMPTY_CONTENT));
    expect(stage).not.toContain('おはよ おはよう');
    const others = t.s.players.filter((p) => p.id !== singer).map((p) => JSON.stringify(viewFor(t.s, { kind: 'player', playerId: p.id }, EMPTY_CONTENT)));
    for (const v of others) expect(v).not.toContain('おはよ おはよう');
    expect(t.view(singer).mine?.takes[0]?.heard).toBe('おはよ おはよう');
  });

  it('a sloppy beginner still scores, and a perfect take beats it', () => {
    const t = new Table(2, 1, ['kana', 'n5']);
    t.start(1);
    t.timeout();
    const morae = t.turn.line.words.flat();
    const rough = sungKana(morae, 0.3, (salt) => (salt.length * 37) % 100 / 100);
    t.play(t.turn.singer, { kind: 'sing', turn: t.turn.no, utterance: speech(rough), pitch: null, onsetMs: 600, durMs: 2_000, timing: 'button' });
    const q = t.st.takes[0]!.score.quality;
    expect(q).toBeGreaterThan(20);
    expect(q).toBeLessThan(100);
  });
});

// ---- full system: bots play a whole game through the real server ----

describe('Karaoke Duel: bots play a game end to end', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 20, prompt: 40, answer: 800, reveal: 500, score: 30, finale: 30 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  for (const players of [2, 4]) {
    it(`${players} bots sing a game with every client in sync`, async () => {
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
      let lastGame: KaraokeDuelView | null = null;
      const phases = new Set<string>();
      const director = new Director(baseUrl, created.code, created.stageToken, {
        players,
        roundsPerGame: 2,
        totalRounds: 1_000,
        mode: 'karaoke-duel',
        games: 1,
        onDone: () => (finished = true),
        onState: (view, v) => {
          record('stage', view, v);
          phases.add(view.phase);
          if (view.game?.mode === 'karaoke-duel') lastGame = view.game;
          if (view.phase === 'recap') recap = view.recap;
        },
      });
      director.start();
      const bots: Bot[] = [];
      for (let i = 1; i <= players; i++) {
        const policy = karaokeDuelPolicy({ seed: i, delayMs: [5, 60], noPitch: i === 2, quiet: i === 4 });
        bots.push(
          await Bot.join({ baseUrl, code: created.code, name: `bot${i}`, policy, level: i === 1 ? 'kana' : 'n5', onState: (bot, view, v) => record(bot.playerId, view, v) }),
        );
      }
      await until(() => finished, 60_000, 'one game');
      await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

      for (const p of ['prompt', 'answer', 'score', 'finale', 'recap']) expect(phases, p).toContain(p);
      if (players > 2) expect(phases).toContain('reveal');
      else expect(phases).not.toContain('reveal');

      // Every accepted state matches what the server committed for that viewer.
      for (const [id, list] of seen) {
        for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
      }

      // Scores add up: each final score is that player's tally, and singing earned points.
      const standings = (recap as RoomView['recap'])!.standings;
      const game = lastGame as KaraokeDuelView | null;
      for (const s of standings) expect(s.score, s.name).toBe(game!.tally.find((x) => x.playerId === s.playerId)!.points);
      expect(standings.reduce((n, s) => n + s.score, 0)).toBeGreaterThan(0);

      // Bots sang (and typed) their takes; nothing failed but harmless races with the clock.
      const bad = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase'));
      expect(bad).toEqual([]);
      expect(bots.flatMap((b) => b.moves).filter((m) => m.ok && m.key.includes('sing')).length).toBeGreaterThanOrEqual(8);

      for (const b of bots) b.stop();
      director.client.close();
    });
  }
});
