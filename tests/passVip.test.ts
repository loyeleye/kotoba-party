// Handing the VIP star to another phone: the VIP or the main stage can do it, nobody else.

import { describe, expect, it } from 'vitest';
import { ManualClock } from '../server/src/clock.js';
import { Room } from '../server/src/room.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { content } from './helpers.js';

function setup() {
  const room = new Room({ code: 'TEST', clock: new ManualClock(), content });
  const stage = room.createStageToken();
  const aki = room.join({ name: 'Aki' }) as JoinResponse;
  const ben = room.join({ name: 'Ben' }) as JoinResponse;
  const cho = room.join({ name: 'Cho' }) as JoinResponse;
  return { room, stage, aki, ben, cho };
}

describe('handing over VIP', () => {
  it('the VIP can make another player the VIP, who can then start a game', () => {
    const { room, aki, ben } = setup();
    expect(room.state.vipId).toBe(aki.playerId);
    expect(room.command(aki.token, { id: 'p1', type: 'passVip', playerId: ben.playerId })).toMatchObject({ ok: true });
    expect(room.state.vipId).toBe(ben.playerId);
    expect(room.viewFor({ kind: 'player', playerId: ben.playerId }).players.find((p) => p.id === ben.playerId)?.isVip).toBe(true);
    expect(room.command(aki.token, { id: 's1', type: 'start', mode: 'debug' })).toMatchObject({ ok: false, error: 'not-vip' });
    expect(room.command(ben.token, { id: 's2', type: 'start', mode: 'debug' })).toMatchObject({ ok: true });
  });

  it('the main stage can hand it over; other players and watching screens cannot', () => {
    const { room, stage, ben, cho } = setup();
    expect(room.command(ben.token, { id: 'p1', type: 'passVip', playerId: ben.playerId })).toMatchObject({ ok: false, error: 'not-vip' });
    const watcher = room.createWatchToken()!;
    room.command(stage, { id: 'rc', type: 'settings', remoteControl: true });
    expect(room.command(watcher, { id: 'p2', type: 'passVip', playerId: ben.playerId })).toMatchObject({ ok: false, error: 'watch-only' });
    expect(room.command(stage, { id: 'p3', type: 'passVip', playerId: cho.playerId })).toMatchObject({ ok: true });
    expect(room.state.vipId).toBe(cho.playerId);
  });

  it('refuses a player who is not in the room', () => {
    const { room, aki } = setup();
    expect(room.command(aki.token, { id: 'p1', type: 'passVip', playerId: 'nobody' })).toMatchObject({ ok: false, error: 'bad-command' });
    expect(room.state.vipId).toBe(aki.playerId);
  });
});
