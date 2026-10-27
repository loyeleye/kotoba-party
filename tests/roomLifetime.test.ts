// Rooms that nobody uses close on their own, so a forgotten screen can't keep one open forever.

import { describe, expect, it } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room, type RoomSocket } from '../server/src/room.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { CLOSE } from '../shared/src/protocol.js';
import { content } from './helpers.js';

const MIN = 60_000;

function fakeSocket() {
  const sent: string[] = [];
  const closed: { code: number; reason: string }[] = [];
  const socket: RoomSocket = { send: (d) => sent.push(d), close: (code, reason) => closed.push({ code, reason }) };
  return { socket, sent, closed };
}

function makeRoom() {
  const clock = new ManualClock();
  let closedCount = 0;
  const room = new Room({ code: 'TEST', clock, content, idleMs: 10 * MIN, staleMs: 30 * MIN, onClose: () => closedCount++ });
  return { clock, room, closedCount: () => closedCount };
}

describe('room lifetime', () => {
  it('closes after the idle time once every screen has gone', () => {
    const { clock, room } = makeRoom();
    const stage = fakeSocket();
    expect(room.attach(room.createStageToken(), stage.socket)).toBe(true);
    room.detach(stage.socket);
    clock.advance(10 * MIN - 1);
    expect(room.closed).toBe(false);
    clock.advance(1);
    expect(room.closed).toBe(true);
  });

  it('closes a room nobody plays in even while a screen stays connected', () => {
    const { clock, room, closedCount } = makeRoom();
    const stage = fakeSocket();
    room.attach(room.createStageToken(), stage.socket);
    clock.advance(30 * MIN);
    expect(room.closed).toBe(true);
    expect(closedCount()).toBe(1);
    expect(stage.sent.at(-1)).toBe(JSON.stringify({ type: 'bye', reason: 'room-idle' }));
    expect(stage.closed).toEqual([{ code: CLOSE.roomGone, reason: 'room-idle' }]);
  });

  it('joins and commands keep it open', () => {
    const { clock, room } = makeRoom();
    const stageToken = room.createStageToken();
    room.attach(stageToken, fakeSocket().socket);
    clock.advance(20 * MIN);
    const join = room.join({ name: 'Aki' }) as JoinResponse;
    room.attach(join.token, fakeSocket().socket);
    clock.advance(20 * MIN);
    room.command(join.token, { id: 'c1', type: 'setLevel', level: 'n5' });
    clock.advance(29 * MIN);
    expect(room.closed).toBe(false);
    clock.advance(1 * MIN);
    expect(room.closed).toBe(true);
  });

  it('a token the room does not know does not keep it open', () => {
    const { clock, room } = makeRoom();
    room.attach(room.createStageToken(), fakeSocket().socket);
    clock.advance(20 * MIN);
    room.command('nope', { id: 'c1', type: 'start', mode: 'debug' });
    clock.advance(10 * MIN);
    expect(room.closed).toBe(true);
  });
});
