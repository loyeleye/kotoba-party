// Dub Club: the content, the word check, the spoiler rule, the screening and scoring, and the room's
// kept clips (only the sender's own, only the main TV, dropped as soon as the game is done with them).

import { existsSync } from 'node:fs';
import { describe, expect, it, onTestFinished } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room, wavDurationMs } from '../server/src/room.js';
import { soundMorae } from '../shared/src/modes/karaokeDuel/scoring.js';
import { ACT_POINTS, adlibCheck, adlibSimilarity, adlibTally, BOOTH_LINE_AT_MS, casualChunk, EPISODE_POINTS, GUESS_POINTS, HEART_POINTS, missionWord, saidDirection, STANDIN_AT_MS, wordMarks, wordsSimilarity, type DubState, type DubView } from '../shared/src/modes/dubClub/dubClub.js';
import { withExperiments } from '../shared/src/modes/experiments.js';
import { curveballPoints, CURVEBALL_POINTS, SAY_PICK, SPOKEN_REACTION_POINTS, STAND_IN_CURVEBALL_MS, STAND_IN_SETUP_MS } from '../shared/src/modes/mixedRoom.js';
import type { HostCue } from '../shared/src/modes/mode.js';
import { DIRECTIONS, EPISODES, directionOf, directionsFor, episodesFor, sceneAdlib, takeLimitMs } from '../shared/src/modes/dubClub/scenes.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { content } from './helpers.js';

const LEVELS = ['kana', 'n5', 'n4'] as const;

/** A short 16 kHz mono WAV: a tone, `ms` long. */
function wav(ms = 1000): Uint8Array {
  const rate = 16_000;
  const n = Math.round((rate * ms) / 1000);
  const b = new Uint8Array(44 + n * 2);
  const v = new DataView(b.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i / 8) * 8000), true);
  return b;
}

describe('Dub Club: the content', () => {
  it('every episode has three scenes with a line at every level, and art for each', () => {
    for (const ep of EPISODES) {
      expect(ep.scenes.length, ep.id).toBe(3);
      for (const sc of ep.scenes) {
        for (const lines of [sc.lines, sc.cheeky].filter(Boolean)) for (const l of LEVELS) expect(lines![l].kana.length, `${sc.id} ${l}`).toBeGreaterThan(0);
        // Kana lines are long enough to act: at least four morae.
        expect(soundMorae(sc.lines.kana.kana).length, sc.id).toBeGreaterThanOrEqual(4);
        const bg = `stage/assets/dub/bg-${sc.bg}.png`;
        const char = sc.char === 'pon' ? 'stage/assets/hosts/pon.png' : `stage/assets/dub/char-${sc.char}.png`;
        expect(existsSync(bg), bg).toBe(true);
        expect(existsSync(char), char).toBe(true);
        // Every character lip-syncs: a mouth sheet of three frames (Pon's is anim/pon-talk.png).
        if (sc.char !== 'pon') expect(existsSync(`stage/assets/dub/char-${sc.char}-talk.png`), `${sc.char} talk`).toBe(true);
      }
    }
  });

  it('every direction card has its pixel icon, and the episode has its title, end and credits art', () => {
    for (const d of DIRECTIONS) expect(existsSync(`stage/assets/dub/cards/${d.id}.png`), d.id).toBe(true);
    for (const n of ['title', 'end', 'credits']) expect(existsSync(`stage/assets/dub/ep-${n}.png`), n).toBe(true);
    for (const n of ['play', 'stop', 'mic']) expect(existsSync(`stage/assets/dub/ui-${n}.png`), n).toBe(true);
  });

  it('every audience gets episodes and a deck of several sound families; Cheeky never reaches Kids', () => {
    for (const a of ['kids', 'family', 'cheeky'] as const) {
      expect(episodesFor(a).length, a).toBeGreaterThan(1);
      expect(new Set(directionsFor(a).map((d) => d.family)).size, a).toBeGreaterThanOrEqual(6);
    }
    expect(episodesFor('kids').some((e) => e.audience === 'cheeky')).toBe(false);
    expect(directionsFor('kids').some((d) => d.audience === 'cheeky')).toBe(false);
    expect(directionsFor('family').some((d) => d.audience)).toBe(false);
    expect(new Set(DIRECTIONS.map((d) => d.id)).size).toBe(DIRECTIONS.length);
    for (const d of DIRECTIONS) expect(d.spoil.length, d.id).toBeGreaterThan(0);
  });

  it('gives slow cards longer to record, within 12 s', () => {
    expect(takeLimitMs('こんにちは', false)).toBe(6000);
    expect(takeLimitMs('こんにちは', true)).toBe(9000);
    expect(takeLimitMs('あ'.repeat(40), true)).toBe(12000);
  });
});

describe('Dub Club: the word check', () => {
  it('scores a clean read 1, and extra sounds (a にゃ, a laugh) cost nothing', () => {
    expect(wordsSimilarity('おはよう', 'おはよう')).toBe(1);
    expect(wordsSimilarity('おはよう', 'にゃ おはよう にゃ')).toBe(1);
    expect(wordsSimilarity('おはよう', 'おは')).toBeLessThan(0.7);
    expect(wordsSimilarity('おはよう', '')).toBe(0);
  });

  it('marks which sounds came through', () => {
    const { marks } = wordMarks('ねこです', 'ねこで');
    expect(marks.map((m) => m.m).join('')).toBe('ねこです');
    expect(marks.slice(0, 3).every((m) => m.ok)).toBe(true);
    expect(marks[3]!.ok).toBe(false);
  });

  it('catches a take that says its own card, but not a word the line already has', () => {
    const robot = directionOf('robot')!;
    const loud = directionOf('loud')!;
    expect(saidDirection({ via: 'speech', text: 'ロボットみたいに', reading: 'ろぼっとみたいに' }, robot, 'おはよう')).toBe(true);
    expect(saidDirection({ via: 'speech', text: 'おはよう', reading: 'おはよう' }, robot, 'おはよう')).toBe(false);
    expect(saidDirection({ via: 'speech', text: 'おおきなこえ', reading: 'おおきなこえ' }, loud, 'おおきなこえで いって')).toBe(false);
  });
});

function setup(players = 3) {
  const clock = new ManualClock();
  const room = new Room({ code: 'DUBS', clock, content });
  const stage = room.createStageToken();
  const seats = Array.from({ length: players }, (_, i) => room.join({ name: `P${i + 1}` }) as JoinResponse);
  // Every phone is connected.
  for (const s of seats) room.attach(s.token, { send: () => {}, close: () => {} });
  let n = 0;
  const cmd = (token: string, body: Record<string, unknown>) => room.command(token, { id: `c${++n}`, ...body });
  const play = (seat: JoinResponse, move: Record<string, unknown>) => cmd(seat.token, { type: 'play', move });
  const st = () => room.state.modeState as DubState;
  const view = (seat?: JoinResponse) => room.viewFor(seat ? { kind: 'player', playerId: seat.playerId } : { kind: 'stage' }).game as DubView;
  const skipPhase = () => cmd(stage, { type: 'skip', phaseSeq: room.state.phaseSeq });
  return { clock, room, stage, seats, cmd, play, st, view, skipPhase };
}

describe('Dub Club: a scene', () => {
  it('rehearses, records, screens each dub with a guess and a reveal, and pays the scene', () => {
    const t = setup(3);
    const [a, b, c] = t.seats as [JoinResponse, JoinResponse, JoinResponse];
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    expect(t.room.state.phase).toBe('intro');
    t.skipPhase();
    expect(t.room.state.phase).toBe('prompt');
    const me = t.view(a).me!;
    expect(me.offered.length).toBe(2);
    expect(t.play(a, { kind: 'pick', direction: me.offered[1]!.id })).toMatchObject({ ok: true });
    t.skipPhase();
    expect(t.room.state.phase).toBe('answer');

    // A's plain read is checked privately; typed reads are refused.
    const line = t.view(a).me!.line!;
    expect(t.play(a, { kind: 'rehearse', utterance: { via: 'typed', text: line.kana } })).toMatchObject({ ok: false });
    t.play(a, { kind: 'rehearse', utterance: { via: 'speech', text: line.kana } });
    expect(t.view(a).me!.rehearsal!.similarity).toBe(1);
    expect(t.view(b).me!.rehearsal).toBeNull();

    // A sends a kept clip; B plays from the phone; C passes.
    const kept = t.room.keepClip(a.token, wav(1500))!;
    expect(kept.durMs).toBe(1500);
    t.play(a, { kind: 'take', clipId: kept.clipId, local: false, durMs: 99, heard: null, checked: true });
    t.play(b, { kind: 'take', clipId: null, local: true, durMs: 2000, heard: null, checked: true });
    t.play(c, { kind: 'pass' });
    // Everyone is in: the screening starts.
    expect(t.room.state.phase).toBe('reveal');
    const take = t.st().rounds[0]!.actors.find((x) => x.playerId === a.playerId)!.take!;
    // The clip's own length wins over what the phone said.
    expect(take.durMs).toBe(1500);

    const r = t.st().rounds[0]!;
    const order = [...r.order];
    expect(order.sort()).toEqual([a.playerId, b.playerId].sort());
    const seatOf = (id: string) => t.seats.find((s) => s.playerId === id)!;
    for (const actorId of r.order) {
      // The clapper, then the dub plays.
      for (let i = 0; i < 100 && !(t.view().now?.playerId === actorId && t.view().now?.step === 'play'); i++) t.clock.advance(100);
      expect(t.view().now?.step).toBe('play');
      // Everyone else guesses right.
      for (const s of t.seats) {
        if (s.playerId === actorId) continue;
        const actor = r.actors.find((x) => x.playerId === actorId)!;
        expect(t.play(s, { kind: 'guess', actorId, direction: actor.direction })).toMatchObject({ ok: true });
      }
      expect(t.play(seatOf(actorId), { kind: 'guess', actorId, direction: 'happy' })).toMatchObject({ ok: false });
      for (let i = 0; i < 200 && t.view().now?.step !== 'reveal'; i++) t.clock.advance(100);
      expect(t.view().now?.card?.id).toBe(r.actors.find((x) => x.playerId === actorId)!.direction);
    }
    // C gives a heart to A.
    expect(t.play(c, { kind: 'heart', actorId: a.playerId })).toMatchObject({ ok: true });
    t.clock.advance(4_000);
    expect(t.room.state.phase).toBe('score');
    const res = t.view(a).results!;
    const ra = res.find((x) => x.playerId === a.playerId)!;
    expect(ra.act).toBe(2 * ACT_POINTS);
    expect(ra.guess).toBe(GUESS_POINTS);
    expect(ra.heart).toBe(HEART_POINTS);
    expect(ra.episode).toBe(EPISODE_POINTS);
    expect(t.view(a).best).toBe(a.playerId);
    expect(t.view(c).results!.find((x) => x.playerId === c.playerId)!.guess).toBe(2 * GUESS_POINTS);
    // The best dub's clip is kept for the episode; nothing else is.
    expect(t.room.keptClips).toBe(1);
  });

  it('a spoiler voids the acting points', () => {
    const t = setup(3);
    const [a] = t.seats as [JoinResponse];
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.skipPhase();
    const d = directionOf(t.st().rounds[0]!.actors.find((x) => x.playerId === a.playerId)!.direction)!;
    t.play(a, { kind: 'take', clipId: null, local: true, durMs: 1000, heard: { via: 'speech', text: d.spoil[0]!, reading: d.spoil[0]! }, checked: true });
    expect(t.st().rounds[0]!.actors.find((x) => x.playerId === a.playerId)!.take!.spoiler).toBe(true);
  });
});

describe('Dub Club: kept clips', () => {
  it('keeps clips only while a mode that plays them is on, for the main TV only', () => {
    const t = setup(3);
    const [a, b] = t.seats as [JoinResponse, JoinResponse];
    // Not in a game: nothing is kept.
    expect(t.room.keepClip(a.token, wav())).toBeNull();
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.skipPhase();
    const kept = t.room.keepClip(a.token, wav())!;
    expect(kept).not.toBeNull();
    expect(t.room.keepClip(t.stage, wav())).toBeNull();
    const watch = t.room.createWatchToken()!;
    expect(t.room.clipFor(t.stage, kept.clipId)).not.toBeNull();
    expect(t.room.clipFor(watch, kept.clipId)).toBeNull();
    expect(t.room.clipFor(b.token, kept.clipId)).toBeNull();
    // B can't send A's clip as its own.
    t.play(b, { kind: 'take', clipId: kept.clipId, local: false, durMs: 1000, heard: null, checked: false });
    expect(t.st().rounds[0]!.actors.find((x) => x.playerId === b.playerId)!.take).toBeNull();
    // A clip no take names is dropped when the phase moves on.
    t.skipPhase();
    expect(t.room.keptClips).toBe(0);
  });

  it('reads a WAV header for the length', () => {
    expect(wavDurationMs(wav(2500))).toBe(2500);
  });

  it('plays a whole game to the recap with bots-style moves, and drops every clip at the end', () => {
    const t = setup(4);
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    let guard = 0;
    while (t.room.state.phase !== 'recap' && guard++ < 400) {
      if (t.room.state.phase === 'answer') {
        for (const s of t.seats) {
          const v = t.view(s).me!;
          if (v.sent) continue;
          const k = t.room.keepClip(s.token, wav(800));
          t.play(s, { kind: 'take', clipId: k?.clipId ?? null, local: !k, durMs: 800, heard: null, checked: false });
        }
      }
      t.clock.advance(1_000);
    }
    expect(t.room.state.phase).toBe('recap');
    expect(t.room.keptClips).toBe(0);
    expect(t.room.state.recap!.standings.length).toBe(4);
  });
});

// ---- the N4 ad-lib role (hard role, goal 4.8) ----

const N4_FRAMES = ['plain', 'n-da', 'teru', 'te-shimau', 'potential'];

describe('Dub Club: the ad-lib content', () => {
  it('every scene has a mission, a picture, key words and a casual model line that passes its own check', () => {
    for (const ep of EPISODES)
      for (const sc of ep.scenes)
        for (const ad of [sc.adlib, sc.cheekyAdlib].filter(Boolean)) {
          expect(ad!.mission.length, sc.id).toBeGreaterThan(10);
          expect(ad!.emoji, sc.id).toBeTruthy();
          expect(ad!.keys.length, sc.id).toBeGreaterThan(0);
          expect(ad!.status, sc.id).toBe('draft');
          expect(ad!.frames.length, sc.id).toBeGreaterThan(0);
          for (const f of ad!.frames) expect(N4_FRAMES, `${sc.id} ${f}`).toContain(f);
          const check = adlibCheck(ad!.model.kana, ad!);
          expect(check.casual, `${sc.id} casual`).toBe(true);
          expect(check.key, `${sc.id} key`).toBe(true);
          // No polite endings in a casual model line.
          expect(ad!.model.kana, sc.id).not.toMatch(/(です|ます)[。！？]?$/);
        }
    // The Cheeky twist has its own mission.
    expect(sceneAdlib(EPISODES.find((e) => e.id === 'sakura')!.scenes[2], 'cheeky').model.kana).toContain('けっこん');
  });

  it('checks casual speech leniently: plain endings, 〜んだ and contractions count; です/ます does not', () => {
    const keys = { keys: ['おにぎり'] };
    expect(adlibCheck('だれが おにぎり たべたの？', keys)).toMatchObject({ casual: true, key: true });
    const chatta = adlibCheck({ via: 'speech', text: '食べちゃった', reading: 'たべちゃった' }, keys);
    expect(chatta).toMatchObject({ casual: true, key: false });
    // 〜ちゃった is 〜て しまう said casually (te-shimau); 〜てる is teru.
    expect(chatta.frames).toContain('te-shimau');
    expect(chatta.frames).not.toContain('teru');
    expect(adlibCheck('いま たべてる', keys).frames).toContain('teru');
    expect(adlibCheck('おばけ なんだ', keys).frames).toContain('n-da');
    expect(adlibCheck('おにぎりを たべましたよ。', keys)).toMatchObject({ casual: false, key: true });
    expect(adlibCheck('おにぎりは どこですか', keys).casual).toBe(false);
    expect(adlibSimilarity({ casual: true, key: true, frames: [] })).toBe(1);
  });

  it('rejects polite lines and false contractions (ホテル, ください, でしょう)', () => {
    const keys = { keys: ['おにぎり'] };
    expect(adlibCheck('わたしの おにぎりを たべましたか。', keys).casual).toBe(false);
    expect(adlibCheck('ホテルで まって います。', keys).casual).toBe(false);
    expect(adlibCheck('ホテルに かえります。', keys).casual).toBe(false);
    expect(adlibCheck('ちょっとください', keys).casual).toBe(false);
    expect(adlibCheck('そうでしょう', keys).casual).toBe(false);
  });

  it('accepts plain forms with no particle', () => {
    const keys = { keys: ['おにぎり'] };
    for (const line of ['しらない。ぼくじゃない。', 'おなか すいた。', 'ちがう！', 'おいしかった！', 'いっしょに いこう！', 'ぜんぶ たべた！'])
      expect(adlibCheck(line, keys).casual, line).toBe(true);
    expect(adlibCheck('しらない。', keys).frames).toContain('plain');
    expect(adlibSimilarity({ casual: true, key: false, frames: [] })).toBeGreaterThanOrEqual(0.5);
    expect(adlibSimilarity({ casual: false, key: false, frames: [] })).toBeLessThan(0.5);
  });
});

function setupLevels(levels: ('kana' | 'n5' | 'n4')[]) {
  const t = setup(0);
  const seats = levels.map((level, i) => t.room.join({ name: `P${i + 1}`, level }) as JoinResponse);
  for (const s of seats) t.room.attach(s.token, { send: () => {}, close: () => {} });
  return { ...t, seats };
}

describe('Dub Club: the ad-lib role', () => {
  /** Plays scene by scene to `round`, passing everyone at recording. */
  function toRound(t: ReturnType<typeof setupLevels>, round: number) {
    for (let i = 0; i < 400 && t.st().round < round; i++) {
      if (t.room.state.phase === 'answer') for (const s of t.seats) if (!t.view(s).me!.sent && !t.view(s).me!.passed) t.play(s, { kind: 'pass' });
      t.clock.advance(1_000);
    }
    expect(t.st().round).toBe(round);
  }

  it('offers the N4 player the ad-lib beside the scripted line; Take it swaps in the mission', () => {
    const t = setupLevels(['kana', 'n5', 'n4']);
    const [k, n5, n4] = t.seats as [JoinResponse, JoinResponse, JoinResponse];
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    expect(t.room.state.phase).toBe('prompt');
    const scene0 = EPISODES.find((e) => e.id === t.st().episodeId)!.scenes[0];
    // Opt-in: until they take it, the phone shows the scripted N4 line with the offer.
    const mine = t.view(n4).me!;
    expect(mine.line!.kana).toBe(scene0.lines.n4.kana);
    expect(mine.adlib).toMatchObject({ state: 'offered', model: null });
    expect(mine.adlib!.mission.length).toBeGreaterThan(0);
    for (const s of [k, n5]) {
      expect(t.view(s).me!.adlib).toBeNull();
      expect(t.view(s).me!.line).not.toBeNull();
    }
    // Others can't take it.
    expect(t.play(n5, { kind: 'adlib', accept: true })).toMatchObject({ ok: false });
    expect(t.view().cast.some((c) => c.adlib)).toBe(false);
    expect(t.play(n4, { kind: 'adlib', accept: true })).toMatchObject({ ok: true });
    expect(t.view(n4).me!.line).toBeNull();
    expect(t.view().cast.filter((c) => c.adlib).map((c) => c.playerId)).toEqual([n4.playerId]);
    t.skipPhase();

    // A casual plain read on the mission scores full; the model shows only after the take.
    const ad = sceneAdlib(scene0, t.st().audience);
    t.play(n4, { kind: 'rehearse', utterance: { via: 'speech', text: ad.model.kana, reading: ad.model.kana } });
    expect(t.view(n4).me!.adlib).toMatchObject({ state: 'accepted', check: { casual: true, key: true }, model: null });
    expect(t.view(n4).me!.rehearsal!.similarity).toBe(1);
    expect(t.view(n4).me!.limitMs).toBeGreaterThanOrEqual(9_000);
    t.play(n4, { kind: 'take', clipId: null, local: true, durMs: 3000, heard: null, checked: true });
    expect(t.view(n4).me!.adlib!.model).toEqual(ad.model);
    expect(t.play(n4, { kind: 'adlib', accept: false })).toMatchObject({ ok: false }); // sent: too late
    expect(adlibTally(t.st())).toEqual({ offered: 1, accepted: 1, rate: 1 });
  });

  it('a plain read while the offer is open is of the script, and isn’t a yes', () => {
    const t = setupLevels(['n5', 'kana', 'n4']);
    const n4 = t.seats[2]!;
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.skipPhase();
    expect(t.room.state.phase).toBe('answer');
    const line = EPISODES.find((e) => e.id === t.st().episodeId)!.scenes[0].lines.n4;
    t.play(n4, { kind: 'rehearse', utterance: { via: 'speech', text: line.kana, reading: line.kana } });
    expect(t.view(n4).me!.adlib?.state).toBe('offered');
    expect(t.view(n4).me!.rehearsal!.marks.length).toBeGreaterThan(0);
    expect(t.st().rounds[0]!.actors.find((a) => a.playerId === n4.playerId)!.adlib).toBe('offered');
  });

  it('sending the scripted take with the offer open logs it as timed out', () => {
    const t = setupLevels(['n5', 'kana', 'n4']);
    const n4 = t.seats[2]!;
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.skipPhase();
    t.play(n4, { kind: 'take', clipId: null, local: true, durMs: 3000, heard: null, checked: true });
    const actor = t.st().rounds[0]!.actors.find((a) => a.playerId === n4.playerId)!;
    expect(actor.adlib).toBe('timeout');
    expect(t.view(n4).me!.adlib).toBeNull();
    expect(t.view().cast.some((c) => c.adlib)).toBe(false);
    expect(adlibTally(t.st())).toEqual({ offered: 1, accepted: 0, rate: 0 });
  });

  it('an offer still open when recording ends times out', () => {
    const t = setupLevels(['n5', 'kana', 'n4']);
    const n4 = t.seats[2]!;
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.skipPhase();
    t.skipPhase(); // recording ends with no answer
    expect(t.st().rounds[0]!.actors.find((a) => a.playerId === n4.playerId)!.adlib).toBe('timeout');
  });

  it('“not this time” gives the scripted N4 line, and offers rotate among N4 players', () => {
    const t = setupLevels(['n5', 'n4', 'n4']);
    const [, a, b] = t.seats as [JoinResponse, JoinResponse, JoinResponse];
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    expect(t.view(a).me!.adlib?.state).toBe('offered');
    expect(t.view(b).me!.adlib).toBeNull();
    expect(t.play(a, { kind: 'adlib', accept: false })).toMatchObject({ ok: true });
    expect(t.view(a).me!.adlib).toBeNull();
    expect(t.view(a).me!.line!.kana).toBe(EPISODES.find((e) => e.id === t.st().episodeId)!.scenes[0].lines.n4.kana);
    expect(adlibTally(t.st())).toEqual({ offered: 1, accepted: 0, rate: 0 });
    // Scene 2 goes to the other N4 player.
    toRound(t, 2);
    expect(t.view(b).me!.adlib?.state).toBe('offered');
    expect(t.view(a).me!.adlib).toBeNull();
  });

  it('spotlight: in a room of 4+, a lone N4 player who ad-libbed last scene gets the next one off', () => {
    const t = setupLevels(['n5', 'n5', 'kana', 'n4']);
    const n4 = t.seats[3]!;
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.play(n4, { kind: 'adlib', accept: true });
    toRound(t, 2);
    expect(t.view(n4).me!.adlib).toBeNull();
    expect(t.st().rounds[1]!.actors.every((a) => a.adlib === undefined)).toBe(true);
    // Scene 3: offered again.
    toRound(t, 3);
    expect(t.view(n4).me!.adlib?.state).toBe('offered');
  });

  it('a lone N4 player in a small room is offered it every scene', () => {
    const t = setupLevels(['n5', 'kana', 'n4']);
    const n4 = t.seats[2]!;
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    t.play(n4, { kind: 'adlib', accept: true });
    toRound(t, 2);
    expect(t.view(n4).me!.adlib?.state).toBe('offered');
  });

  it('a room with no N4 player never sees it', () => {
    const t = setupLevels(['kana', 'n5', 'n5']);
    t.cmd(t.stage, { type: 'start', mode: 'dub-club' });
    t.skipPhase();
    expect(t.st().rounds[0]!.actors.every((a) => a.adlib === undefined)).toBe(true);
    expect(t.view().cast.some((c) => c.adlib)).toBe(false);
  });
});

// ---- mixed rooms: offer rotation, the Gallery, the booth after a good ad-lib, the host stand-in ----

describe('Dub Club: mixed rooms', () => {
  /** A room of these levels, every phone connected, collecting the host cues. */
  function room(levels: ('kana' | 'n5' | 'n4')[]) {
    const cues: HostCue[] = [];
    const clock = new ManualClock();
    const r = new Room({ code: 'DUBM', clock, content, onCues: (_room, raised) => cues.push(...raised) });
    const stage = r.createStageToken();
    const seats = levels.map((level, i) => r.join({ name: `P${i + 1}`, level }) as JoinResponse);
    const sockets = seats.map((s) => {
      const sock = { send: () => {}, close: () => {} };
      r.attach(s.token, sock);
      return sock;
    });
    let n = 0;
    const cmd = (token: string, body: Record<string, unknown>) => r.command(token, { id: `c${++n}`, ...body });
    const play = (seat: JoinResponse, move: Record<string, unknown>) => cmd(seat.token, { type: 'play', move });
    const st = () => r.state.modeState as DubState;
    const view = (seat?: JoinResponse) => r.viewFor(seat ? { kind: 'player', playerId: seat.playerId } : { kind: 'stage' }).game as DubView;
    const skipPhase = () => cmd(stage, { type: 'skip', phaseSeq: r.state.phaseSeq });
    /** Starts on the Onigiri Thief (its first mission's words: おにぎり, たべ, だれ), at the first scene card. */
    const start = () => {
      cmd(stage, { type: 'start', mode: 'dub-club' });
      st().episodeId = 'onigiri';
      skipPhase();
      expect(r.state.phase).toBe('prompt');
    };
    const until = (f: () => boolean) => {
      for (let i = 0; i < 600 && !f(); i++) clock.advance(100);
      expect(f()).toBe(true);
    };
    const score = (seat: JoinResponse) => r.state.players.find((p) => p.id === seat.playerId)!.score;
    return { room: r, clock, cues, seats, sockets, cmd, play, st, view, skipPhase, start, until, score };
  }
  const adlib0 = () => sceneAdlib(EPISODES.find((e) => e.id === 'onigiri')!.scenes[0], 'family');
  const heard = (text: string) => ({ via: 'speech', text, reading: text });

  /** The N4 player takes the ad-lib and sends `take` (after a plain read of `plain`); everyone else passes. */
  function adlibScene(t: ReturnType<typeof room>, plain: string, take: string | null) {
    const [k, n5, n4] = t.seats as [JoinResponse, JoinResponse, JoinResponse];
    expect(t.play(n4, { kind: 'adlib', accept: true })).toMatchObject({ ok: true });
    t.skipPhase();
    t.play(n4, { kind: 'rehearse', utterance: heard(plain) });
    t.play(n4, { kind: 'take', clipId: null, local: true, durMs: 2500, heard: take ? heard(take) : null, checked: true });
    t.play(k, { kind: 'pass' });
    t.play(n5, { kind: 'pass' });
    expect(t.room.state.phase).toBe('reveal');
    return { k, n5, n4 };
  }

  it.each([true, false])('a Gallery player may say their reaction for a small bonus; a miss leaves the tiles to tap (spoken reaction: %s)', (on) => {
    onTestFinished(withExperiments({ spokenReaction: on }));
    const t = room(['kana', 'n5', 'n4']);
    t.start();
    const { k } = adlibScene(t, adlib0().model.kana, 'ねえ、おにぎり だれが たべたの');
    t.until(() => t.view().now?.step === 'play');
    const P = k;
    const say = (text: string) => t.play(P, { kind: 'gallery', pick: SAY_PICK, utterance: { via: 'speech', text } });
    const before = t.score(P);
    if (!on) {
      // Switch off: a said reaction is refused, the tile offers no mic, and tapping works as before.
      expect(say('すごい！')).toMatchObject({ ok: false });
      expect(t.view(P).me!.gallery).not.toHaveProperty('say');
      expect(t.play(P, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: true });
      expect(t.score(P)).toBe(before);
      return;
    }
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: false } });
    // A miss: no tile, no points, nothing on the TV; the phone says to tap instead.
    expect(say('ありがとう')).toMatchObject({ ok: true });
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: null, say: { said: false, missed: true } });
    expect(t.score(P)).toBe(before);
    // A match (a little ending is fine): picks that tile, pays the bonus, shows a said bubble on the TV.
    expect(say('すごいね！')).toMatchObject({ ok: true });
    expect(t.view(P).me!.gallery).toMatchObject({ kind: 'react', picked: 'sugoi', say: { said: true, missed: false } });
    expect(t.score(P) - before).toBe(SPOKEN_REACTION_POINTS);
    expect(t.view().now!.gallery).toEqual([expect.objectContaining({ id: 'sugoi', said: true })]);
    // In the phrasebook as said, but read: the tile shows the kana.
    expect(t.room.state.phrasebook[P.playerId]?.find((e) => e.itemId === 'gallery-sugoi')).toMatchObject({ outcome: 'said', recall: 'read', kana: 'すごい！' });
    // One reaction a round, said or tapped.
    expect(say('なるほど')).toMatchObject({ ok: false });
  });

  it.each([true, false])('the Gallery on the ad-lib dub: a curveball on a mission word for a Kana or N5 player, reactions for the rest (scaled curveball: %s)', (scaled) => {
    onTestFinished(withExperiments({ scaledCurveball: scaled }));
    const t = room(['kana', 'n5', 'n4']);
    t.start();
    const take = 'ねえ、おにぎり だれが たべたの';
    const { k, n5, n4 } = adlibScene(t, adlib0().model.kana, take);
    // No curveball while the take plays: the room hasn't heard it yet.
    t.until(() => t.view().now?.step === 'play');
    expect(t.view(k).me!.gallery!.kind).toBe('react');
    expect(t.view(n5).me!.gallery!.kind).toBe('react');
    expect(t.st().curveball).toBe(false);
    // Once it has played, a Kana or N5 player who hasn't reacted gets it. Who rotates with the seed (the
    // scene's number): scene 1 picks the second of them, the N5 player.
    t.until(() => t.view().now?.step === 'guess');
    const cb = t.view(n5).me!.gallery!;
    expect(cb.kind).toBe('curveball');
    if (cb.kind !== 'curveball') return;
    // The longest mission word heard in the take, against other scenes' mission words.
    expect(cb.options.map((o) => o.kana)).toContain('おにぎり');
    expect(cb.options).toHaveLength(3);
    expect(t.view(k).me!.gallery!.kind).toBe('react');
    expect(t.view(n4).me!.gallery).toBeNull();
    expect(t.play(n4, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: false });
    expect(t.play(k, { kind: 'gallery', pick: 'naruhodo' })).toMatchObject({ ok: true });
    expect(t.play(k, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: false });
    expect(t.view().now!.gallery.map((b) => b.id)).toEqual(['naruhodo']);
    const before = t.score(n5);
    expect(t.play(n5, { kind: 'gallery', pick: 'おにぎり' })).toMatchObject({ ok: true });
    // Dub Club's right guess is 50, so a tenth is the old +5 either way.
    expect(t.score(n5) - before).toBe(scaled ? 5 : CURVEBALL_POINTS);
    expect(t.view(n5).me!.gallery).toMatchObject({ kind: 'curveball', right: true, answer: 'おにぎり' });
    expect(t.st().curveball).toBe(true);
  });

  it('the curveball comes after the take has played, not before; a take with no mission word in it deals none', () => {
    // Kana and N5 players who both reacted while the take played are past the curveball: none is dealt.
    const early = room(['kana', 'n5', 'n4']);
    early.start();
    const seats = adlibScene(early, adlib0().model.kana, 'ねえ、おにぎり だれが たべたの');
    early.until(() => early.view().now?.step === 'play');
    expect(early.play(seats.k, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: true });
    expect(early.play(seats.n5, { kind: 'gallery', pick: 'e' })).toMatchObject({ ok: true });
    early.until(() => early.view().now?.step === 'guess');
    expect(early.view(seats.k).me!.gallery).toMatchObject({ kind: 'react', picked: 'sugoi' });
    expect(early.st().curveball).toBe(false);

    // A take with none of the mission's words: nothing to ask about, so no curveball.
    const missed = room(['kana', 'n5', 'n4']);
    missed.start();
    const m = adlibScene(missed, adlib0().model.kana, 'きょうは いい てんき だね');
    missed.until(() => missed.view().now?.step === 'guess');
    expect(missed.view(m.k).me!.gallery!.kind).toBe('react');
    expect(missed.view(m.n5).me!.gallery!.kind).toBe('react');
    expect(missed.st().curveball).toBe(false);
  });

  it('a good ad-lib: カット！, then the booth replays the scene’s model line in Fude’s voice, never the take', () => {
    const t = room(['kana', 'n5', 'n4']);
    t.start();
    const take = 'ねえ、おにぎり だれが たべたの';
    const { k, n5, n4 } = adlibScene(t, adlib0().model.kana, take);
    t.until(() => t.view().now?.step === 'reveal');
    expect(t.cues.some((c) => c.event === 'dub_cut')).toBe(false);
    t.until(() => t.view().now?.step === 'booth');
    const model = adlib0().model;
    const cut = t.cues.findIndex((c) => c.event === 'dub_cut');
    expect(t.cues[cut]).toMatchObject({ host: 'fude', slots: { name: 'P3' } });
    const booth = t.cues.find((c) => c.event === 'dub_booth')!;
    expect(t.cues.indexOf(booth)).toBeGreaterThan(cut);
    expect(booth).toMatchObject({ host: 'fude', slots: { line: model.text, line_kana: model.kana, line_en: model.en }, atMs: BOOTH_LINE_AT_MS });
    expect(JSON.stringify(t.cues)).not.toContain(take);
    const tv = t.view().now!;
    expect(tv.booth!.line).toEqual(model);
    expect(tv.booth!.lit.key.length).toBeGreaterThan(0);
    expect(tv.booth!.lit.before + tv.booth!.lit.key + tv.booth!.lit.after).toBe(model.text);
    // The curveball dealt after the take is still unanswered, so the TV holds the lit word back for now.
    expect(tv.booth!.holdKey).toBe(true);
    expect(tv.booth!.note).toBe(`P3's take is a keeper. Fude-kantoku's cut, for the record, with 「${tv.booth!.lit.key}」.`);
    expect(t.view(k).me!.gist!.en).toBe(`P3's ad-lib: approved! Fude's cut: “${model.en}”`);
    expect(tv.card).not.toBeNull();
    // Kana and N5 phones get the gist; the actor doesn't.
    expect(t.view(k).me!.gist).toMatchObject({ kana: model.kana, romaji: expect.any(String) });
    expect(t.view(n5).me!.gist).toMatchObject({ kana: model.kana, romaji: null });
    expect(t.view(n4).me!.gist).toBeNull();
    // 5–7 s, then on to the cast notes.
    const at = t.view().now!.at;
    t.until(() => t.room.state.phase === 'score');
    expect(t.clock.now() - at).toBeGreaterThanOrEqual(5_000);
    expect(t.clock.now() - at).toBeLessThanOrEqual(7_100);
  });

  it('no booth for a scripted take, nor for an ad-lib that wasn’t casual', () => {
    const scripted = room(['kana', 'n5', 'n4']);
    scripted.start();
    const [k, n5, n4] = scripted.seats as [JoinResponse, JoinResponse, JoinResponse];
    scripted.play(n4, { kind: 'adlib', accept: false });
    scripted.skipPhase();
    scripted.play(n4, { kind: 'take', clipId: null, local: true, durMs: 2000, heard: null, checked: true });
    scripted.play(k, { kind: 'pass' });
    scripted.play(n5, { kind: 'pass' });
    scripted.until(() => scripted.room.state.phase === 'score');
    expect(scripted.cues.some((c) => c.event === 'dub_cut' || c.event === 'dub_booth')).toBe(false);
    expect(scripted.st().rounds[0]!.gallery ?? null).toBeNull();

    const polite = room(['kana', 'n5', 'n4']);
    polite.start();
    adlibScene(polite, 'おにぎりを たべましたか', 'おにぎりを たべましたか');
    const steps = new Set<string>();
    for (let i = 0; i < 600 && polite.room.state.phase === 'reveal'; i++) {
      if (polite.view().now) steps.add(polite.view().now!.step);
      polite.clock.advance(100);
    }
    expect(steps.has('reveal')).toBe(true);
    expect(steps.has('booth')).toBe(false);
    expect(polite.cues.some((c) => c.event === 'dub_cut' || c.event === 'dub_booth')).toBe(false);
  });

  it('after “mission missed”, the phone shows a mission word to aim for', () => {
    const t = room(['kana', 'n5', 'n4']);
    t.start();
    const n4 = t.seats[2]!;
    t.play(n4, { kind: 'adlib', accept: true });
    t.skipPhase();
    t.play(n4, { kind: 'rehearse', utterance: heard('きょうは いい てんき だね') });
    expect(t.view(n4).me!.adlib).toMatchObject({ check: { casual: true, key: false }, hint: 'おにぎり' });
    expect(missionWord(adlib0())).toBe('おにぎり');
    expect(missionWord({ keys: ['すき'] })).toBe('すき');
    t.play(n4, { kind: 'rehearse', utterance: heard(adlib0().model.kana) });
    expect(t.view(n4).me!.adlib!.hint).toBeNull();
  });

  it('the casual chunk lit in the booth is a contraction, 〜んだ, or a clause-final particle', () => {
    expect(casualChunk('ごめんね。おいしそう だったから、たべちゃったんだ。')).toBe('ちゃった');
    expect(casualChunk('おばけが でたんだ！ みんな、はやく にげて！')).toBe('んだ');
    expect(casualChunk('みんな、だいじょうぶだよ！ わたしが まもるから。へんしん！')).toBe('だよ');
    const onigiri = adlib0().model.text;
    // 「…たべたの？」: the の at the end, not the one in わたしの (made long enough to be lit where it is).
    const key = casualChunk(onigiri);
    expect(key.endsWith('の')).toBe(true);
    expect(onigiri.indexOf(key)).toBeGreaterThan(onigiri.indexOf('たべ'));
    for (const e of EPISODES) for (const sc of e.scenes) expect(casualChunk(sc.adlib.model.text), sc.id).not.toBe('');
    // With the line's frames: a て-form chunk only on a line tagged teru, so the monster's かてない (can't win)
    // isn't lit as 〜てない, while 「…たべてないし」 is.
    const monster = EPISODES.flatMap((e) => e.scenes).find((sc) => sc.adlib.model.text.includes('かてない'))!.adlib;
    expect(casualChunk(monster.model.text, monster.frames)).not.toBe('てない');
    expect(casualChunk(monster.model.text, monster.frames)).not.toBe('');
    expect(casualChunk('しらないよ。ぼく、なにも たべてないし。…もぐもぐ。', ['plain', 'teru'])).toBe('てない');
    // 〜ちゃった lines are tagged te-shimau and still light ちゃった.
    expect(casualChunk('ごめんね。おいしそう だったから、たべちゃったんだ。', ['plain', 'te-shimau', 'n-da'])).toBe('ちゃった');
    for (const e of EPISODES) for (const sc of e.scenes) expect(casualChunk(sc.adlib.model.text, sc.adlib.frames), sc.id).not.toBe('');
  });

  it('offers go by nextOfferee: a lone N4 player who says “not this time” sits the next scene out', () => {
    const t = room(['kana', 'n5', 'n4']);
    t.start();
    const n4 = t.seats[2]!;
    expect(t.play(n4, { kind: 'adlib', accept: false })).toMatchObject({ ok: true });
    const toRound = (round: number) => {
      for (let i = 0; i < 400 && t.st().round < round; i++) {
        if (t.room.state.phase === 'answer') for (const s of t.seats) if (!t.view(s).me!.sent && !t.view(s).me!.passed) t.play(s, { kind: 'pass' });
        t.clock.advance(1_000);
      }
    };
    toRound(2);
    expect(t.view(n4).me!.adlib).toBeNull();
    toRound(3);
    expect(t.view(n4).me!.adlib?.state).toBe('offered');
  });

  it('the host stand-in: with two players and nobody at N4, Fude ad-libs one scene card himself, once a game', () => {
    onTestFinished(withExperiments({ standInSetup: false, standInCurveball: false }));
    const t = room(['kana', 'n5', 'n5']);
    t.cmd(t.room.createStageToken(), { type: 'start', mode: 'dub-club' });
    t.st().episodeId = 'onigiri';
    // One player drops out before the first scene: two are left.
    t.room.detach(t.sockets[2]!);
    t.skipPhase();
    expect(t.room.state.phase).toBe('prompt');
    const model = adlib0().model;
    const cues = t.cues.filter((c) => c.event === 'dub_standin');
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ host: 'fude', slots: { line: model.text, line_kana: model.kana, line_en: model.en }, atMs: STANDIN_AT_MS });
    const tv = t.view().standIn!;
    expect(tv.line).toEqual(model);
    expect(tv.at).toBe(t.view().phaseAt + STANDIN_AT_MS);
    expect(tv.ms).toBeGreaterThanOrEqual(5_000);
    expect(tv.ms).toBeLessThanOrEqual(7_000);
    expect(STANDIN_AT_MS + tv.ms).toBeLessThanOrEqual(12_000);
    const [k, n5] = t.seats as [JoinResponse, JoinResponse];
    expect(t.view(k).me!.gist).toMatchObject({ kana: model.kana, romaji: expect.any(String) });
    expect(t.view(n5).me!.gist).toMatchObject({ kana: model.kana, romaji: null });
    // Nobody is offered anything.
    expect(t.st().rounds[0]!.actors.every((a) => a.adlib === undefined)).toBe(true);
    t.skipPhase();
    expect(t.view().standIn).toBeNull();
    expect(t.view(k).me!.gist).toBeNull();
    // Once a game.
    for (let i = 0; i < 400 && t.st().round < 2; i++) {
      if (t.room.state.phase === 'answer') for (const s of t.seats.slice(0, 2)) if (!t.view(s).me!.sent && !t.view(s).me!.passed) t.play(s, { kind: 'pass' });
      t.clock.advance(1_000);
    }
    expect(t.room.state.phase).toBe('prompt');
    expect(t.view().standIn).toBeNull();
    expect(t.cues.filter((c) => c.event === 'dub_standin')).toHaveLength(1);
  });

  describe('the stand-in experiments', () => {
    /** Dub Club needs three to start: one drops out before the first scene, so two are left. */
    const two = () => {
      const t = room(['kana', 'n5', 'n5']);
      t.cmd(t.room.createStageToken(), { type: 'start', mode: 'dub-club' });
      t.st().episodeId = 'onigiri';
      t.room.detach(t.sockets[2]!);
      t.skipPhase();
      expect(t.room.state.phase).toBe('prompt');
      return t;
    };
    it('standInSetup: his setup line where the ad-lib began, the ad-lib 2.5 s later; the card runs to its end', () => {
      onTestFinished(withExperiments({ standInSetup: true, standInCurveball: false }));
      const t = two();
      const model = adlib0().model;
      const ours = t.cues.filter((c) => c.event.startsWith('dub_standin'));
      expect(ours).toEqual([
        { host: 'fude', event: 'dub_standin_setup', atMs: STANDIN_AT_MS },
        { host: 'fude', event: 'dub_standin', slots: { line: model.text, line_kana: model.kana, line_en: model.en }, atMs: STANDIN_AT_MS + STAND_IN_SETUP_MS },
      ]);
      const tv = t.view().standIn!;
      expect(tv.at).toBe(t.view().phaseAt + STANDIN_AT_MS + STAND_IN_SETUP_MS);
      expect(tv.bubbles).toBeUndefined();
      expect(t.room.state.deadline! - t.view().phaseAt).toBe(Math.max(12_000, STANDIN_AT_MS + STAND_IN_SETUP_MS + tv.ms));
      expect(t.view(t.seats[0]!).me!.gallery).toBeNull();
    });

    it('standInCurveball: a tile for both while he says it, then the curveball on a mission word, +5 if right', () => {
      onTestFinished(withExperiments({ standInSetup: false, standInCurveball: true }));
      const t = two();
      const [k, n5] = t.seats as [JoinResponse, JoinResponse];
      const tv = t.view().standIn!;
      const said = tv.at + tv.ms;
      expect(t.room.state.deadline!).toBe(Math.max(t.view().phaseAt + 12_000, said + STAND_IN_CURVEBALL_MS));
      expect(t.view(k).me!.gallery).toMatchObject({ kind: 'react' });
      expect(tv.holdKey).toBe(true);
      expect(t.view(k).me!.gist).toBeNull();
      expect(t.play(n5, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: true });
      expect(t.view().standIn!.bubbles!.map((b) => b.id)).toEqual(['sugoi']);
      t.until(() => !!t.view(k).me!.gallery && t.view(k).me!.gallery!.kind === 'curveball');
      expect(t.clock.now()).toBeGreaterThanOrEqual(said);
      expect(t.view(n5).me!.gist).toMatchObject({ kana: adlib0().model.kana });
      const word = t.st().standIn!.sg!.g.curveball!.word;
      expect(adlib0().keys).toContain(word);
      expect(t.play(k, { kind: 'gallery', pick: word })).toMatchObject({ ok: true });
      expect(t.score(k)).toBe(curveballPoints('dub-club'));
      expect(t.st().curveball).toBe(true);
      t.until(() => t.room.state.phase === 'answer');
      expect(t.view(k).me!.gallery).toBeNull();
    });
  });

  it('a room of three with nobody at N4 sees nothing new: no stand-in, no Gallery, no booth', () => {
    const t = room(['kana', 'n5', 'n5']);
    t.start();
    expect(t.view().standIn).toBeNull();
    for (const s of t.seats) expect(t.view(s).me!.gist).toBeNull();
    t.skipPhase();
    for (const s of t.seats) t.play(s, { kind: 'take', clipId: null, local: true, durMs: 1500, heard: heard('おにぎり たべたの'), checked: true });
    t.until(() => t.view().now?.step === 'play');
    for (const s of t.seats) expect(t.view(s).me!.gallery).toBeNull();
    expect(t.play(t.seats[0]!, { kind: 'gallery', pick: 'sugoi' })).toMatchObject({ ok: false });
    t.until(() => t.room.state.phase === 'score');
    expect(t.cues.some((c) => ['dub_standin', 'dub_cut', 'dub_booth'].includes(c.event))).toBe(false);
  });
});
