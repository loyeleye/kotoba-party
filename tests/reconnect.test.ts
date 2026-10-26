// Phase 0 gate, part 2: a phone that drops for 30 seconds rejoins its seat.
// The server runs on a manual clock, so "30 seconds" and "90 seconds" pass instantly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoomClient, createRoom, joinRoom } from '../shared/src/client.js';
import type { JoinResponse } from '../shared/src/protocol.js';
import { ManualClock } from '../server/src/clock.js';
import type { Room } from '../server/src/room.js';
import { startServer, until } from './helpers.js';

describe('reconnect and seat hold', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  let clock: ManualClock;
  const clients: RoomClient[] = [];

  beforeEach(async () => {
    clock = new ManualClock();
    ctx = await startServer({ clock });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await ctx.server.close();
  });

  async function setup(players: number) {
    const created = await createRoom(ctx.baseUrl);
    const room = ctx.server.rooms.get(created.code)!;
    const stage = new RoomClient({ baseUrl: ctx.baseUrl, code: created.code, token: created.stageToken });
    stage.connect();
    clients.push(stage);
    const phones: { join: JoinResponse; client: RoomClient }[] = [];
    for (let i = 1; i <= players; i++) {
      const join = (await joinRoom(ctx.baseUrl, created.code, { name: `phone${i}`, deviceId: `device-${i}` })) as JoinResponse;
      const client = new RoomClient({ baseUrl: ctx.baseUrl, code: created.code, token: join.token });
      client.connect();
      clients.push(client);
      phones.push({ join, client });
    }
    await until(() => room.state.players.filter((p) => p.connected).length === players, 5_000, 'players connected');
    return { code: created.code, room, stage, phones };
  }

  const serverPlayer = (room: Room, id: string) => room.state.players.find((p) => p.id === id);

  it('a phone that drops for 30 s mid-round gets the same seat, score and answer back', async () => {
    const { room, stage, phones } = await setup(4);
    const [p1, p2, p3, p4] = phones as [(typeof phones)[0], (typeof phones)[0], (typeof phones)[0], (typeof phones)[0]];

    expect((await stage.send({ type: 'start', rounds: 3 })).ok).toBe(true);
    clock.advance(8_000 + 4_000); // intro + prompt
    expect(room.state.phase).toBe('answer');

    expect((await p2.client.send({ type: 'answer', text: 'たぬきラーメン' })).ok).toBe(true);
    const before = { ...serverPlayer(room, p2.join.playerId)! };

    p2.client.drop();
    await until(() => serverPlayer(room, p2.join.playerId)?.connected === false, 5_000, 'server sees the drop');

    clock.advance(30_000);
    expect(room.state.phase).toBe('answer');
    const held = serverPlayer(room, p2.join.playerId);
    expect(held).toMatchObject({ id: before.id, seat: before.seat, score: before.score, connected: false });

    p2.client.reconnectNow();
    await until(() => p2.client.status === 'open' && serverPlayer(room, p2.join.playerId)?.connected === true, 5_000, 'rejoin');
    await until(() => p2.client.version === room.version, 5_000, 'latest state');

    expect(p2.client.view?.me?.playerId).toBe(p2.join.playerId);
    expect(p2.client.view?.me?.answerText).toBe('たぬきラーメン');
    expect(p2.client.view?.players.find((p) => p.id === p2.join.playerId)).toMatchObject({ seat: before.seat, connected: true });

    // The round carries on with the rejoined phone in it.
    for (const p of [p1, p3, p4]) expect((await p.client.send({ type: 'answer', text: `${p.join.playerId}!` })).ok).toBe(true);
    expect(room.state.phase).toBe('reveal');
    await until(() => p2.client.view?.phase === 'reveal', 5_000, 'reveal pushed');
    const target = p2.client.view!.reveal.find((a) => a.id !== p2.client.view!.me!.answerId)!;
    expect((await p2.client.send({ type: 'vote', answerId: target.id })).ok).toBe(true);
  });

  it('a reloaded page finds its seat with its saved token, and the old socket is replaced', async () => {
    const { code, room, phones } = await setup(3);
    const p1 = phones[0]!;
    p1.client.drop();
    await until(() => serverPlayer(room, p1.join.playerId)?.connected === false, 5_000, 'drop');
    clock.advance(30_000);

    const again = (await joinRoom(ctx.baseUrl, code, { name: 'whatever', token: p1.join.token })) as JoinResponse;
    expect(again).toEqual({ playerId: p1.join.playerId, token: p1.join.token, rejoined: true });

    const fresh = new RoomClient({ baseUrl: ctx.baseUrl, code, token: again.token });
    clients.push(fresh);
    fresh.connect();
    await until(() => serverPlayer(room, p1.join.playerId)?.connected === true, 5_000, 'reconnected');
    expect(room.state.players).toHaveLength(3);
  });

  it('the anonymous device id also finds the seat (storage kept, token lost)', async () => {
    const { code, room, phones } = await setup(2);
    const p2 = phones[1]!;
    p2.client.drop();
    await until(() => serverPlayer(room, p2.join.playerId)?.connected === false, 5_000, 'drop');
    clock.advance(30_000);
    const again = (await joinRoom(ctx.baseUrl, code, { name: 'phone2', deviceId: 'device-2' })) as JoinResponse;
    expect(again.rejoined).toBe(true);
    expect(again.playerId).toBe(p2.join.playerId);
  });

  it('releases the seat after 90 s, hands VIP on, and refuses the old token', async () => {
    const { room, phones } = await setup(3);
    const vip = phones[0]!;
    expect(room.state.vipId).toBe(vip.join.playerId);

    vip.client.drop();
    await until(() => serverPlayer(room, vip.join.playerId)?.connected === false, 5_000, 'drop');

    clock.advance(89_999);
    expect(serverPlayer(room, vip.join.playerId)).toBeDefined();
    clock.advance(2);
    expect(serverPlayer(room, vip.join.playerId)).toBeUndefined();
    expect(room.state.vipId).toBe(phones[1]!.join.playerId);

    vip.client.reconnectNow();
    await until(() => vip.client.status === 'seat-lost', 5_000, 'seat-lost');
    const res = await fetch(`${ctx.baseUrl}/api/rooms/${room.code}/commands`, {
      method: 'POST',
      headers: { authorization: `Bearer ${vip.join.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'x', type: 'start' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'seat-released' });
  });

  it('a phone that joins but never opens its socket loses the seat after 90 s', async () => {
    const created = await createRoom(ctx.baseUrl);
    const room = ctx.server.rooms.get(created.code)!;
    await joinRoom(ctx.baseUrl, created.code, { name: 'ghost' });
    expect(room.state.players).toHaveLength(1);
    clock.advance(90_001);
    expect(room.state.players).toHaveLength(0);
  });

  it('new players cannot join mid-game, but held seats can come back', async () => {
    const { code, stage, phones, room } = await setup(2);
    expect((await stage.send({ type: 'start' })).ok).toBe(true);
    const late = await joinRoom(ctx.baseUrl, code, { name: 'late' });
    expect(late).toEqual({ error: 'game-in-progress' });
    const back = await joinRoom(ctx.baseUrl, code, { name: 'phone1', token: phones[0]!.join.token });
    expect('rejoined' in back && back.rejoined).toBe(true);
    expect(room.state.players).toHaveLength(2);
  });
});
