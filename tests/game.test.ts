import { describe, expect, it } from 'vitest';
import { IPPON_BONUS, POINTS_PER_VOTE } from '../shared/src/constants.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import type { DebugState, DebugView } from '../shared/src/modes/debug/debug.js';
import { EMPTY_CONTENT } from '../shared/src/modes/mode.js';
import type { Command } from '../shared/src/protocol.js';
import { isRoomCode, normalizeRoomCode, randomRoomCode } from '../shared/src/roomCode.js';
import { viewFor } from '../shared/src/view.js';

let ids = 0;
const ctx = (now = 0): GameContext => ({
  now,
  content: { ...EMPTY_CONTENT, debugPrompts: [{ id: 'p1', text: 'prompt one' }, { id: 'p2', text: 'prompt two' }] },
  newId: () => `a${String(++ids).padStart(4, '0')}`,
  random: () => 0.5,
});

const stage = { kind: 'stage' } as const;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
let cmdId = 0;
const cmd = (state: GameState, actor: ReturnType<typeof as> | typeof stage, command: CommandBody) =>
  apply(state, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, ctx());
const act = (state: GameState, action: GameAction) => apply(state, action, ctx());
const ds = (state: GameState) => state.modeState as DebugState;

function lobby(n: number): GameState {
  const s = createGame('BCDF');
  for (let i = 1; i <= n; i++) {
    act(s, { type: 'join', playerId: `p${i}`, name: `P${i}` });
    act(s, { type: 'connection', playerId: `p${i}`, connected: true });
  }
  return s;
}

function toAnswer(s: GameState, rounds = 3) {
  expect(cmd(s, stage, { type: 'start', mode: 'debug', rounds }).changed).toBe(true);
  act(s, { type: 'timeout', phaseSeq: s.phaseSeq }); // intro → prompt
  act(s, { type: 'timeout', phaseSeq: s.phaseSeq }); // prompt → answer
  expect(s.phase).toBe('answer');
}

describe('round state machine', () => {
  it('walks lobby → intro → prompt → answer → reveal → encore → score → … → recap', () => {
    const s = lobby(3);
    toAnswer(s, 2);
    const seen: string[] = [s.phase];
    while (s.phase !== 'recap') {
      // One answer keeps the reveal phase alive (with no answers it is skipped).
      if (s.phase === 'answer') cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'hi' } });
      act(s, { type: 'timeout', phaseSeq: s.phaseSeq });
      seen.push(s.phase);
    }
    expect(seen).toEqual(['answer', 'reveal', 'encore', 'score', 'prompt', 'answer', 'reveal', 'encore', 'score', 'recap']);
    expect(s.deadline).toBeNull();
  });

  it('ignores stale timers', () => {
    const s = lobby(2);
    toAnswer(s);
    cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'hi' } });
    const seq = s.phaseSeq;
    act(s, { type: 'timeout', phaseSeq: seq });
    expect(s.phase).toBe('reveal');
    expect(act(s, { type: 'timeout', phaseSeq: seq }).changed).toBe(false);
    expect(s.phase).toBe('reveal');
  });

  it('ends the answer phase early once every connected player is in, ignoring dropped players', () => {
    const s = lobby(3);
    toAnswer(s);
    act(s, { type: 'connection', playerId: 'p3', connected: false });
    cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'one' } });
    expect(s.phase).toBe('answer');
    cmd(s, as('p2'), { type: 'play', move: { kind: 'answer', text: 'two' } });
    expect(s.phase).toBe('reveal');
  });

  it('rejects double answers, own-answer votes, double votes and wrong phases', () => {
    const s = lobby(3);
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'x' } }).error).toBe('wrong-phase');
    toAnswer(s);
    cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'one' } });
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'answer', text: 'again' } }).error).toBe('already-answered');
    expect(cmd(s, as('p2'), { type: 'play', move: { kind: 'answer', text: '   ' } }).error).toBe('empty-answer');
    cmd(s, as('p2'), { type: 'play', move: { kind: 'answer', text: 'two' } });
    cmd(s, as('p3'), { type: 'play', move: { kind: 'answer', text: 'three' } });
    expect(s.phase).toBe('reveal');
    const own = ds(s).answers.find((a) => a.authorId === 'p1')!;
    const other = ds(s).answers.find((a) => a.authorId === 'p2')!;
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'vote', answerId: own.id } }).error).toBe('own-answer');
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'vote', answerId: 'nope' } }).error).toBe('unknown-answer');
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'vote', answerId: other.id } }).changed).toBe(true);
    expect(cmd(s, as('p1'), { type: 'play', move: { kind: 'vote', answerId: other.id } }).error).toBe('already-voted');
  });

  it('only the VIP or the stage can start and skip', () => {
    const s = lobby(2);
    expect(cmd(s, as('p2'), { type: 'start', mode: 'debug' }).error).toBe('not-vip');
    expect(cmd(s, as('p1'), { type: 'start', mode: 'debug' }).changed).toBe(true);
    expect(cmd(s, as('p2'), { type: 'skip', phaseSeq: s.phaseSeq }).error).toBe('not-vip');
    expect(cmd(s, as('p1'), { type: 'skip', phaseSeq: s.phaseSeq - 1 }).error).toBe('stale-phase');
    expect(cmd(s, stage, { type: 'skip', phaseSeq: s.phaseSeq }).changed).toBe(true);
    expect(s.phase).toBe('prompt');
  });

  it('the VIP or the stage switches Calm motion for everyone, in any phase', () => {
    const s = lobby(2);
    expect(viewFor(s, as('p2'), EMPTY_CONTENT).calmMotion).toBe(false);
    expect(cmd(s, as('p2'), { type: 'setMotion', calm: true }).error).toBe('not-vip');
    expect(cmd(s, as('p1'), { type: 'setMotion', calm: true }).changed).toBe(true);
    expect(viewFor(s, as('p2'), EMPTY_CONTENT).calmMotion).toBe(true);
    expect(cmd(s, as('p1'), { type: 'start', mode: 'debug' }).changed).toBe(true);
    expect(cmd(s, stage, { type: 'setMotion', calm: false }).changed).toBe(true);
    expect(s.calmMotion).toBe(false);
    expect(cmd(s, stage, { type: 'setMotion', calm: 'yes' } as unknown as CommandBody).error).toBe('bad-command');
  });
});

describe('scoring', () => {
  function playRound(s: GameState, votes: Record<string, string>) {
    for (const p of s.players) cmd(s, as(p.id), { type: 'play', move: { kind: 'answer', text: `${p.id} says` } });
    expect(s.phase).toBe('reveal');
    const byAuthor = (id: string) => ds(s).answers.find((a) => a.authorId === id)!.id;
    for (const [voter, author] of Object.entries(votes)) cmd(s, as(voter), { type: 'play', move: { kind: 'vote', answerId: byAuthor(author) } });
  }

  it('scores votes, gives IPPON when every other voter agrees (3+), and doubles the last round', () => {
    const s = lobby(4);
    toAnswer(s, 2);
    playRound(s, { p2: 'p1', p3: 'p1', p4: 'p1', p1: 'p2' });
    expect(s.phase).toBe('encore');
    const r1 = ds(s).results!;
    expect(r1.find((a) => a.authorId === 'p1')).toMatchObject({ votes: 3, ippon: true, points: 3 * POINTS_PER_VOTE + IPPON_BONUS });
    expect(r1.find((a) => a.authorId === 'p2')).toMatchObject({ votes: 1, ippon: false, points: POINTS_PER_VOTE });

    act(s, { type: 'timeout', phaseSeq: s.phaseSeq }); // encore → score
    act(s, { type: 'timeout', phaseSeq: s.phaseSeq }); // score → prompt, round 2
    act(s, { type: 'timeout', phaseSeq: s.phaseSeq }); // prompt → answer
    expect(ds(s).round).toBe(2);
    playRound(s, { p1: 'p2', p3: 'p2', p4: 'p3', p2: 'p1' });
    expect(s.phase).toBe('encore');
    // Last round counts double; split votes, so no IPPON.
    expect(ds(s).results!.find((a) => a.authorId === 'p2')).toMatchObject({ votes: 2, ippon: false, points: 2 * POINTS_PER_VOTE * 2 });
    expect(s.players.find((p) => p.id === 'p1')!.score).toBe(3 * POINTS_PER_VOTE + IPPON_BONUS + POINTS_PER_VOTE * 2);
  });

  it('skips the vote when nobody answered', () => {
    const s = lobby(2);
    toAnswer(s);
    act(s, { type: 'timeout', phaseSeq: s.phaseSeq });
    expect(s.phase).toBe('encore');
    expect(ds(s).results!).toEqual([]);
  });

  it('a released player loses their vote but the room plays on', () => {
    const s = lobby(3);
    toAnswer(s);
    playRound(s, { p1: 'p2' });
    act(s, { type: 'release', playerId: 'p1' });
    expect(ds(s).votes.p1).toBeUndefined();
    expect(s.phase).toBe('reveal');
  });
});

describe('seats', () => {
  it('reuses the lowest free seat and passes VIP on when the VIP leaves', () => {
    const s = lobby(3);
    act(s, { type: 'release', playerId: 'p1' });
    expect(s.vipId).toBe('p2');
    act(s, { type: 'join', playerId: 'p9', name: 'P9' });
    expect(s.players.find((p) => p.id === 'p9')!.seat).toBe(1);
  });

  it('caps the room at 8 and refuses duplicate names', () => {
    const s = lobby(8);
    expect(act(s, { type: 'join', playerId: 'x', name: 'X' }).error).toBe('room-full');
    const t = lobby(1);
    expect(act(t, { type: 'join', playerId: 'x', name: 'p1' }).error).toBe('name-taken');
  });
});

describe('views', () => {
  it('keeps answers anonymous until the encore', () => {
    const s = lobby(3);
    toAnswer(s);
    for (const p of s.players) cmd(s, as(p.id), { type: 'play', move: { kind: 'answer', text: `${p.id} says` } });
    const v = viewFor(s, stage, EMPTY_CONTENT);
    const game = v.game as DebugView;
    expect(v.phase).toBe('reveal');
    expect(JSON.stringify(game.reveal)).not.toContain('authorId');
    expect(game.results).toBeNull();
    expect((viewFor(s, as('p2'), EMPTY_CONTENT).game as DebugView).mine?.answerText).toBe('p2 says');
  });

  it('lets players pick a level in the lobby but not mid-game', () => {
    const s = lobby(2);
    expect(cmd(s, as('p1'), { type: 'setLevel', level: 'kana' }).changed).toBe(true);
    expect(s.players[0]!.level).toBe('kana');
    expect(cmd(s, as('p1'), { type: 'setLevel', level: 'n9' as never }).error).toBe('bad-level');
    toAnswer(s);
    expect(cmd(s, as('p1'), { type: 'setLevel', level: 'n4' }).error).toBe('wrong-phase');
  });

  it('runs the lobby mic check: こんにちは passes, anything else switches to quiet mode', () => {
    const s = lobby(2);
    cmd(s, as('p1'), { type: 'micCheck', utterance: { via: 'speech', text: 'コンニチハ' } });
    cmd(s, as('p2'), { type: 'micCheck', utterance: { via: 'tap', text: '' } });
    expect(s.players.map((p) => p.mic)).toEqual(['ok', 'quiet']);
    expect(s.cues.map((c) => c.event)).toEqual(['mic_check_ok', 'mic_check_quiet']);
  });

  it('only the "can’t talk" tap turns quiet mode on: a typed or misheard check keeps the mic, and null turns it back on', () => {
    const s = lobby(2);
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: { via: 'typed', text: 'hello' } }).error).toBe('not-konnichiwa');
    expect(cmd(s, as('p2'), { type: 'micCheck', utterance: { via: 'speech', text: 'こんばんは' } }).error).toBe('not-konnichiwa');
    expect(s.players.map((p) => p.mic)).toEqual([null, null]);
    expect(s.cues).toEqual([]);
    cmd(s, as('p1'), { type: 'micCheck', utterance: { via: 'tap', text: '' } });
    expect(s.players[0]!.mic).toBe('quiet');
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: null }).changed).toBe(true);
    expect(s.players[0]!.mic).toBe(null);
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: 42 }).error).toBe('bad-command');
  });

  it('lets the header mic switch turn quiet mode on and off mid-game, without a host line', () => {
    const s = lobby(2);
    toAnswer(s);
    const cues = s.cues.length;
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: { via: 'tap', text: '' } }).changed).toBe(true);
    expect(s.players[0]!.mic).toBe('quiet');
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: null }).changed).toBe(true);
    expect(s.players[0]!.mic).toBe(null);
    expect(cmd(s, as('p1'), { type: 'micCheck', utterance: { via: 'speech', text: 'こんにちは' } }).error).toBe('wrong-phase');
    expect(s.cues.length).toBe(cues);
  });

  it('refuses a mode the room is too small for', () => {
    const s = lobby(2);
    expect(cmd(s, stage, { type: 'start', mode: 'oogiri' }).error).toBe('not-enough-players');
  });
});

describe('room codes', () => {
  it('are 4 letters from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) expect(isRoomCode(randomRoomCode())).toBe(true);
    for (let i = 0; i < 200; i++) expect(randomRoomCode()).not.toMatch(/[BGQSZ]/); // look like 8, 6, O, 5, 2
    expect(isRoomCode('MGZG')).toBe(true); // older codes still join
    expect(normalizeRoomCode(' bc df ')).toBe('BCDF');
    expect(isRoomCode('ABCD')).toBe(false); // A is a vowel
  });
});
