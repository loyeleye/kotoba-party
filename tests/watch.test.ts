// More than one stage screen per room: friends in other places open the stage on their own
// laptops with the room code. A watching screen sees what the main stage sees and nothing more.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoomClient, createRoom, joinRoom, watchRoom } from '../shared/src/client.js';
import type { JoinResponse, WatchRoomResponse } from '../shared/src/protocol.js';
import { ManualClock } from '../server/src/clock.js';
import { MAX_WATCHERS } from '../server/src/room.js';
import { startServer, until } from './helpers.js';

describe('watching stage screens', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  const clients: RoomClient[] = [];

  beforeEach(async () => {
    ctx = await startServer({ clock: new ManualClock() });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await ctx.server.close();
  });

  function connect(code: string, token: string): RoomClient {
    const client = new RoomClient({ baseUrl: ctx.baseUrl, code, token });
    client.connect();
    clients.push(client);
    return client;
  }

  it('a second screen joins by code, sees the stage view and follows the game', async () => {
    const created = await createRoom(ctx.baseUrl);
    const stage = connect(created.code, created.stageToken);
    const watched = (await watchRoom(ctx.baseUrl, created.code.toLowerCase())) as WatchRoomResponse;
    expect(watched.watch).toBe(true);
    expect(watched.code).toBe(created.code);
    expect(watched.stageToken).not.toBe(created.stageToken);
    const remote = connect(created.code, watched.stageToken);

    for (const name of ['Aki', 'Ben']) {
      const join = (await joinRoom(ctx.baseUrl, created.code, { name })) as JoinResponse;
      connect(created.code, join.token);
    }
    await until(() => remote.view?.players.length === 2 && stage.view?.players.length === 2, 5_000, 'both screens see the players');

    expect((await stage.send({ type: 'start', mode: 'debug', rounds: 1 })).ok).toBe(true);
    await until(() => remote.view?.phase === 'intro' && remote.version === stage.version, 5_000, 'remote screen follows');
    expect(remote.view).toEqual(stage.view);
  });

  it('a watching screen cannot start, skip or restart the game', async () => {
    const created = await createRoom(ctx.baseUrl);
    const watched = (await watchRoom(ctx.baseUrl, created.code)) as WatchRoomResponse;
    const remote = connect(created.code, watched.stageToken);
    const join = (await joinRoom(ctx.baseUrl, created.code, { name: 'Aki' })) as JoinResponse;
    connect(created.code, join.token);
    await until(() => remote.view?.players.length === 1, 5_000, 'player in');

    for (const body of [{ type: 'start', mode: 'debug' }, { type: 'playAgain' }, { type: 'skip', phaseSeq: 0 }] as const) {
      const result = await remote.send(body);
      expect(result).toMatchObject({ ok: false, error: 'watch-only' });
    }
    expect(ctx.server.rooms.get(created.code)!.state.phase).toBe('lobby');
  });

  it('runs the game from a watching screen once the main stage turns on remote control', async () => {
    const created = await createRoom(ctx.baseUrl);
    const stage = connect(created.code, created.stageToken);
    const watched = (await watchRoom(ctx.baseUrl, created.code)) as WatchRoomResponse;
    const remote = connect(created.code, watched.stageToken);
    const join = (await joinRoom(ctx.baseUrl, created.code, { name: 'Aki' })) as JoinResponse;
    const phone = connect(created.code, join.token);
    await until(() => remote.view?.players.length === 1, 5_000, 'player in');
    expect(remote.view?.remoteControl).toBe(false);

    // Only the main stage holds the switch.
    expect(await remote.send({ type: 'settings', remoteControl: true })).toMatchObject({ ok: false, error: 'watch-only' });
    expect(await phone.send({ type: 'settings', remoteControl: true })).toMatchObject({ ok: false, error: 'not-allowed' });
    expect((await stage.send({ type: 'settings', remoteControl: true })).ok).toBe(true);
    await until(() => remote.view?.remoteControl === true, 5_000, 'remote sees the switch');

    expect((await remote.send({ type: 'start', mode: 'debug', rounds: 1 })).ok).toBe(true);
    await until(() => stage.view?.phase === 'intro', 5_000, 'game started from the remote screen');
    expect(await remote.send({ type: 'settings', remoteControl: false })).toMatchObject({ ok: false, error: 'watch-only' });

    expect((await stage.send({ type: 'settings', remoteControl: false })).ok).toBe(true);
    await until(() => remote.view?.remoteControl === false, 5_000, 'switch off');
    expect(await remote.send({ type: 'skip', phaseSeq: remote.view!.phaseSeq })).toMatchObject({ ok: false, error: 'watch-only' });
  });

  it('answers room-not-found for a closed room and caps the screens, forgetting closed ones first', async () => {
    const created = await createRoom(ctx.baseUrl);
    expect(await watchRoom(ctx.baseUrl, created.code === 'BCDF' ? 'BCDG' : 'BCDF')).toEqual({ error: 'room-not-found' });
    await joinRoom(ctx.baseUrl, created.code, { name: 'Aki' }); // a room at v0 has nothing to push yet
    const tokens: string[] = [];
    for (let i = 0; i < MAX_WATCHERS; i++) tokens.push(((await watchRoom(ctx.baseUrl, created.code)) as WatchRoomResponse).stageToken);
    const live = connect(created.code, tokens[0]!);
    await until(() => live.view !== null, 5_000, 'screen open');

    // Fifteen of them never connected, so the next ask makes room by forgetting those.
    const next = await watchRoom(ctx.baseUrl, created.code);
    expect('stageToken' in next).toBe(true);
    const room = ctx.server.rooms.get(created.code)!;
    expect(room.viewerFor(tokens[0]!)).toEqual({ kind: 'stage', watch: true });
    expect(room.viewerFor(tokens[1]!)).toBeUndefined();

    // With every screen open, the room says no.
    for (let i = 0; i < MAX_WATCHERS - 2; i++) {
      const t = ((await watchRoom(ctx.baseUrl, created.code)) as WatchRoomResponse).stageToken;
      connect(created.code, t);
    }
    connect(created.code, (next as WatchRoomResponse).stageToken);
    await until(() => room.connectionCount === MAX_WATCHERS, 5_000, 'all screens open');
    expect(await watchRoom(ctx.baseUrl, created.code)).toEqual({ error: 'too-many-screens' });
  });
});
