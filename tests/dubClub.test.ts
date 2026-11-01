// Dub Club: the content, the word check, the spoiler rule, the screening and scoring, and the room's
// kept clips (only the sender's own, only the main TV, dropped as soon as the game is done with them).

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room, wavDurationMs } from '../server/src/room.js';
import { soundMorae } from '../shared/src/modes/karaokeDuel/scoring.js';
import { ACT_POINTS, adlibCheck, adlibSimilarity, adlibTally, EPISODE_POINTS, GUESS_POINTS, HEART_POINTS, saidDirection, wordMarks, wordsSimilarity, type DubState, type DubView } from '../shared/src/modes/dubClub/dubClub.js';
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

const N4_FRAMES = ['plain', 'n-da', 'teru', 'potential'];

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
    expect(chatta.frames).toContain('teru');
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
