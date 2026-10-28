// Ending a game early (the wrong game was picked): back to the lobby in the same room, with every
// player still seated and scores as they were when that game started.

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
  return { room, stage, aki, ben };
}

const scores = (room: Room) => Object.fromEntries(room.state.players.map((p) => [p.name, p.score]));

describe('ending a game early', () => {
  it('goes back to the lobby with the scores from before the game', () => {
    const { room, stage, aki } = setup();
    // The last game's points, as the lobby shows them.
    room.state.players[0]!.score = 7;
    room.state.players[1]!.score = 3;
    room.command(stage, { id: 's3', type: 'start', mode: 'debug' });
    room.state.players[0]!.score = 50;
    expect(room.command(aki.token, { id: 'e1', type: 'endGame' })).toMatchObject({ ok: true });
    expect(room.state.phase).toBe('lobby');
    expect(room.state.recap).toBeNull();
    expect(scores(room)).toEqual({ Aki: 7, Ben: 3 });
    expect(room.closed).toBe(false);
    // The lobby takes a new game straight away.
    expect(room.command(stage, { id: 's4', type: 'start', mode: 'debug' })).toMatchObject({ ok: true });
  });

  it('the main stage can end it too, and a player who left is not brought back', () => {
    const { room, stage, ben } = setup();
    room.state.players[1]!.score = 4;
    room.command(stage, { id: 's1', type: 'start', mode: 'debug' });
    room.state.players[0]!.score = 9;
    expect(room.command(stage, { id: 'e1', type: 'endGame' })).toMatchObject({ ok: true });
    expect(room.state.players.map((p) => p.name)).toEqual(['Aki', 'Ben']);
    expect(scores(room)).toEqual({ Aki: 0, Ben: 4 });
    expect(room.viewFor({ kind: 'player', playerId: ben.playerId }).phase).toBe('lobby');
  });

  it('only the VIP or a stage that runs the game can end it, and only mid-game', () => {
    const { room, stage, ben } = setup();
    expect(room.command(stage, { id: 'e0', type: 'endGame' })).toMatchObject({ ok: false, error: 'wrong-phase' });
    room.command(stage, { id: 's1', type: 'start', mode: 'debug' });
    expect(room.command(ben.token, { id: 'e1', type: 'endGame' })).toMatchObject({ ok: false, error: 'not-vip' });
    const watch = room.createWatchToken()!;
    expect(room.command(watch, { id: 'e2', type: 'endGame' })).toMatchObject({ ok: false, error: 'watch-only' });
    room.command(stage, { id: 'r1', type: 'settings', remoteControl: true });
    expect(room.command(watch, { id: 'e3', type: 'endGame' })).toMatchObject({ ok: true });
  });
});
