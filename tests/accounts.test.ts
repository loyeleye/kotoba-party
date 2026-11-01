// Optional sign-in (docs/accounts.md): the yōkai card rules, the account service with a stand-in for
// the phone's passkey, and a room handing a signed-in player's finished game to it.

import { describe, expect, it } from 'vitest';
import { Accounts, MemoryAccountStorage, type Passkeys } from '../server/src/accounts.js';
import { ManualClock } from '../server/src/clock.js';
import { Room, type AccountResult } from '../server/src/room.js';
import { addGame, CATCH_DAYS, dayOf, dueCards, duePhrases, emptyProgress, reviewPhrase, rightSound, type AccountView, type GameResult, type PracticeItem } from '../shared/src/progress.js';
import type { PhraseEntry } from '../shared/src/modes/mode.js';
import { content } from './helpers.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 28, 12);

const item = (over: Partial<PracticeItem> = {}): PracticeItem => ({ itemId: 'h-ka', char: 'か', hear: 'か', en: 'ka', seen: 1, recalled: 0, missed: 0, ...over });
const game = (at: number, cards: PracticeItem[], over: Partial<GameResult> = {}): GameResult => ({ mode: 'kana-raid', at, score: 300, place: 1, players: 3, coop: false, awards: [], cards, phrases: [], ...over });

const phrase = (itemId: string, outcome: PhraseEntry['outcome']): PhraseEntry => ({ itemId, text: 'お願いします', kana: 'おねがいします', en: 'please', outcome });

describe('saved phrasebook', () => {
  it('saves phrases from any game: said moves up, a retry or miss comes back tomorrow, seen only adds', () => {
    const p = emptyProgress();
    addGame(p, game(T0, [], { mode: 'last-train', phrases: [phrase('a', 'said'), phrase('b', 'retry'), phrase('c', 'missed'), phrase('d', 'seen')] }), 0);
    expect(p.phrases!['a']).toMatchObject({ box: 1, due: T0 + DAY, said: 1, mode: 'last-train', last: 'said' });
    expect(p.phrases!['b']).toMatchObject({ box: 1, due: T0 + DAY, missed: 0, last: 'retry' });
    expect(p.phrases!['c']).toMatchObject({ box: 1, due: T0 + DAY, missed: 1 });
    expect(p.phrases!['d']).toMatchObject({ box: 0, due: T0 });
    expect(duePhrases(p, T0).map((c) => c.itemId)).toEqual(['d']);
    expect(duePhrases(p, T0 + DAY).map((c) => c.itemId)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('leaves Kana Raid’s kana to the yōkai cards', () => {
    const p = emptyProgress();
    addGame(p, game(T0, [item()], { phrases: [{ ...phrase('h-ka', 'said'), text: 'か', kana: 'か' }, phrase('x', 'said')] }), 0);
    expect(Object.keys(p.phrases!)).toEqual(['x']);
  });

  it('a self-marked review: knew it waits longer, not yet comes back tomorrow', () => {
    const p = emptyProgress();
    addGame(p, game(T0, [], { phrases: [phrase('a', 'said')] }), 0);
    expect(reviewPhrase(p, 'a', true, T0 + DAY)).toMatchObject({ box: 2, due: T0 + DAY + 3 * DAY, said: 2 });
    expect(reviewPhrase(p, 'a', false, T0 + 4 * DAY)).toMatchObject({ box: 1, due: T0 + 5 * DAY, missed: 1, last: 'missed' });
    expect(reviewPhrase(p, 'nope', true, T0)).toBeNull();
  });

  it('copes with a save from before phrases existed', () => {
    const p = { cards: {}, games: [] };
    expect(duePhrases(p, T0)).toEqual([]);
    addGame(p, game(T0, [], { phrases: [phrase('a', 'seen')] }), 0);
    expect(Object.keys((p as { phrases?: object }).phrases!)).toEqual(['a']);
  });
});

describe('yōkai cards', () => {
  it('only a right answer from memory moves a card up; three different days catch it', () => {
    const p = emptyProgress();
    addGame(p, game(T0, [item({ recalled: 0 })]), 0);
    expect(p.cards['h-ka']).toMatchObject({ box: 0, days: [], caughtAt: null });
    expect(dueCards(p, T0).map((c) => c.itemId)).toEqual(['h-ka']);

    addGame(p, game(T0 + 1000, [item({ recalled: 2 })]), 0);
    addGame(p, game(T0 + 2000, [item({ recalled: 1 })]), 0); // same day: still one day
    expect(p.cards['h-ka']!.days).toHaveLength(1);
    expect(p.cards['h-ka']!.box).toBe(2);
    addGame(p, game(T0 + DAY, [item({ recalled: 1 })]), 0);
    expect(p.cards['h-ka']!.caughtAt).toBeNull();
    addGame(p, game(T0 + 2 * DAY, [item({ recalled: 1 })]), 0);
    expect(p.cards['h-ka']!.days).toHaveLength(CATCH_DAYS);
    expect(p.cards['h-ka']!.caughtAt).toBe(T0 + 2 * DAY);
    expect(p.games).toHaveLength(5);
  });

  it('a miss sends the card back to tomorrow, and a caught yōkai stays caught', () => {
    const p = emptyProgress();
    for (let d = 0; d < 3; d++) addGame(p, game(T0 + d * DAY, [item({ recalled: 1 })]), 0);
    addGame(p, game(T0 + 3 * DAY, [item({ missed: 1 })]), 0);
    const card = p.cards['h-ka']!;
    expect(card.box).toBe(1);
    expect(card.due).toBe(T0 + 4 * DAY);
    expect(card.caughtAt).not.toBeNull();
    expect(dueCards(p, T0 + 3 * DAY)).toEqual([]);
    expect(dueCards(p, T0 + 4 * DAY)).toHaveLength(1);
  });

  it('counts days in the player’s own time zone', () => {
    // 23:30 in New York (UTC−4 → offset 240) is already the next day in UTC.
    const lateNy = Date.UTC(2026, 9, 29, 3, 30);
    expect(dayOf(lateNy, 0)).toBe('2026-10-29');
    expect(dayOf(lateNy, 240)).toBe('2026-10-28');
  });

  it('takes Hepburn and the usual romaji variants', () => {
    expect(rightSound({ hear: 'し' }, 'shi')).toBe(true);
    expect(rightSound({ hear: 'し' }, ' SI ')).toBe(true);
    expect(rightSound({ hear: 'つ' }, 'tu')).toBe(true);
    expect(rightSound({ hear: 'ふ' }, 'hu')).toBe(true);
    expect(rightSound({ hear: 'お' }, 'wo')).toBe(true); // を and お sound the same
    expect(rightSound({ hear: 'ん' }, 'n')).toBe(true);
    expect(rightSound({ hear: 'てぃ' }, 'ti')).toBe(true); // the card shows ティ as "ti"
    expect(rightSound({ hear: 'ぱーてぃー' }, 'paatii')).toBe(true);
    expect(rightSound({ hear: 'ぱーてぃー' }, 'pati')).toBe(true);
    expect(rightSound({ hear: 'し' }, 'chi')).toBe(false);
    expect(rightSound({ hear: 'か' }, 'か')).toBe(false); // romaji only: copying the kana isn't recall
    expect(rightSound({ hear: 'か' }, '')).toBe(false);
  });
});

/** Stands in for the phone: the response's client data carries the challenge, as a real one's does. */
function fakePasskeys(): Passkeys & { last: string } {
  const fake = {
    last: '',
    registrationOptions: async (o: { challenge: string }) => ((fake.last = o.challenge), { challenge: o.challenge }),
    authenticationOptions: async (o: { challenge: string }) => ((fake.last = o.challenge), { challenge: o.challenge }),
    verifyRegistration: async (o: { response: unknown }) => {
      const r = o.response as { id: string; ok?: boolean };
      return r.ok === false ? null : { id: r.id, publicKey: 'pk', counter: 0 };
    },
    verifyAuthentication: async (o: { response: unknown }) => ((o.response as { ok?: boolean }).ok === false ? null : { counter: 1 }),
  };
  return fake;
}
const response = (challenge: string, id = 'cred-1', extra: Record<string, unknown> = {}) => ({
  id,
  response: { clientDataJSON: Buffer.from(JSON.stringify({ challenge })).toString('base64url') },
  ...extra,
});

function service(now = () => T0) {
  const passkeys = fakePasskeys();
  const accounts = new Accounts(new MemoryAccountStorage(), passkeys, now);
  const call = async (action: string, body?: unknown, token?: string) => {
    const req = new Request(`http://local/api/account/${action}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await accounts.handle(req, action.split('?')[0]!, 'https://tanoshi.example');
    return { status: res.status, data: (await res.json()) as Record<string, unknown> & { token?: string; account?: AccountView; error?: string } };
  };
  const register = async (name = 'Aki', id = 'cred-1') => {
    await call('register/options', { name });
    return call('register/verify', { response: response(passkeys.last, id), tz: 0 });
  };
  return { accounts, passkeys, call, register };
}

describe('account service', () => {
  it('creates a save with a passkey, signs in again on another phone and signs out', async () => {
    const s = service();
    const reg = await s.register('Aki');
    expect(reg.status).toBe(200);
    expect(reg.data.account).toMatchObject({ name: 'Aki', cards: [], games: [] });
    const first = reg.data.token!;

    await s.call('login/options', {});
    const login = await s.call('login/verify', { response: response(s.passkeys.last) });
    expect(login.status).toBe(200);
    const second = login.data.token!;
    expect(second).not.toBe(first);

    expect((await s.call('me', undefined, second)).data.account!.name).toBe('Aki');
    await s.call('signout', {}, second);
    expect((await s.call('me', undefined, second)).status).toBe(401);
    expect((await s.call('me', undefined, first)).status).toBe(200);
  });

  it('uses each challenge once and only for its own step', async () => {
    const s = service();
    await s.call('register/options', { name: 'Aki' });
    const challenge = s.passkeys.last;
    expect((await s.call('login/verify', { response: response(challenge) })).data.error).toBe('expired');
    // The wrong-step try used it up.
    expect((await s.call('register/verify', { response: response(challenge) })).data.error).toBe('expired');
    expect((await s.call('register/options', { name: '' })).data.error).toBe('bad-name');
  });

  it('refuses an expired challenge, a failed passkey and an unknown one', async () => {
    let now = T0;
    const s = service(() => now);
    await s.call('register/options', { name: 'Aki' });
    now += 6 * 60_000;
    expect((await s.call('register/verify', { response: response(s.passkeys.last) })).data.error).toBe('expired');
    await s.call('register/options', { name: 'Aki' });
    expect((await s.call('register/verify', { response: response(s.passkeys.last, 'c', { ok: false }) })).data.error).toBe('not-verified');
    await s.call('login/options', {});
    expect((await s.call('login/verify', { response: response(s.passkeys.last, 'nobody') })).status).toBe(404);
  });

  it('saves a room’s results to the signed-in player and reviews their cards', async () => {
    const s = service();
    const token = (await s.register()).data.token!;
    const results: AccountResult[] = [
      { account: token, result: game(T0, [item({ missed: 1 }), item({ itemId: 'h-shi', char: 'し', hear: 'し', en: 'shi', recalled: 1 })]) },
      { account: 'not-a-session', result: game(T0, [item()]) },
    ];
    await s.accounts.recordResults(results);
    const me = (await s.call('me', undefined, token)).data.account!;
    expect(me.games).toHaveLength(1);
    expect(me.bests).toEqual([{ mode: 'kana-raid', best: 300, played: 1, wins: 1 }]);
    expect(me.cards.map((c) => c.itemId).sort()).toEqual(['h-ka', 'h-shi']);
    expect(me.due).toEqual([]); // the miss comes back tomorrow

    const right = await s.call('review', { itemId: 'h-ka', answer: 'ka' }, token);
    expect(right.data).toMatchObject({ right: true, expected: 'ka', caught: false });
    const wrong = await s.call('review', { itemId: 'h-shi', answer: 'su' }, token);
    expect(wrong.data).toMatchObject({ right: false, expected: 'shi' });
    expect((await s.call('review', { itemId: 'h-nope', answer: 'a' }, token)).status).toBe(404);
    expect((await s.call('review', { itemId: 'h-ka', answer: 'ka' })).status).toBe(401);
  });

  it('reviews a saved phrase and lists phrasebooks for the stage', async () => {
    const s = service();
    const token = (await s.register()).data.token!;
    await s.accounts.recordResults([{ account: token, result: game(T0, [], { mode: 'last-train', phrases: [phrase('a', 'missed'), phrase('b', 'said')] }) }]);
    const me = (await s.call('me', undefined, token)).data.account!;
    expect(me.phrases.map((p) => p.itemId).sort()).toEqual(['a', 'b']);
    expect((await s.call('review', { kind: 'phrase', itemId: 'a', knew: true }, token)).data).toMatchObject({ phrase: { itemId: 'a', box: 2 } });
    expect((await s.call('review', { kind: 'phrase', itemId: 'zz', knew: true }, token)).status).toBe(404);
    const books = await s.accounts.phrasebooks([{ playerId: 'p1', account: token }, { playerId: 'p2', account: 'not-a-session' }]);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ playerId: 'p1', name: 'Aki' });
    expect(books[0]!.phrases.map((p) => p.itemId).sort()).toEqual(['a', 'b']);
  });

  it('keeps the learning path switch, off until turned on, with the frames met so far', async () => {
    const s = service();
    const token = (await s.register()).data.token!;
    expect((await s.call('me', undefined, token)).data.account).toMatchObject({ path: false, frames: [] });
    await s.accounts.recordResults([
      { account: token, result: game(T0, [], { mode: 'last-train', phrases: [{ itemId: 'k', text: 'コーヒーを ください', kana: 'コーヒーを ください', en: 'A coffee, please', outcome: 'said' }] }) },
    ]);
    const on = await s.call('settings', { path: true }, token);
    expect(on.data.account).toMatchObject({ path: true, frames: [{ id: 'kudasai', phrases: 1, said: 1 }] });
    // The path's goals come worked out from the whole save, and the phrase remembers the day it was said.
    const st = on.data.account!.pathStatus;
    expect(st.goals).toHaveLength(24);
    expect(st.frames.find((f) => f.id === 'kudasai')).toMatchObject({ met: false, rule: { says: 1, fillers: 1, days: 1, inGame: true } });
    expect(on.data.account!.phrases[0]).toMatchObject({ recall: 'memory', memory: [{ n: 1, game: true }] });
    expect((await s.call('me', undefined, token)).data.account!.path).toBe(true);
    expect((await s.call('settings', { path: 'yes' }, token)).data.error).toBe('bad-settings');
    expect((await s.call('settings', { path: false })).status).toBe(401);
    expect((await s.call('settings', { path: false }, token)).data.account!.path).toBe(false);
  });

  it('deletes everything: the save, its passkeys and every sign-in', async () => {
    const s = service();
    const token = (await s.register()).data.token!;
    const del = await s.call('delete', {}, token);
    expect(del.data).toMatchObject({ ok: true, credentials: ['cred-1'] });
    expect((await s.call('me', undefined, token)).status).toBe(401);
    await s.call('login/options', {});
    expect((await s.call('login/verify', { response: response(s.passkeys.last) })).status).toBe(404);
  });
});

describe('a room saves signed-in players’ games', () => {
  it('hands each signed-in player’s result over at the recap, and nobody else’s', () => {
    const clock = new ManualClock(T0);
    const saved: AccountResult[][] = [];
    const room = new Room({ code: 'SAVE', clock, content, idleMs: 0, staleMs: 0, onResults: (r) => saved.push(r) });
    const stage = room.createStageToken();
    const aki = room.join({ name: 'Aki', account: 'session-aki' });
    const ben = room.join({ name: 'Ben' });
    if ('error' in aki || 'error' in ben) throw new Error('join failed');
    // Phones on the line, so their seats aren't given up while the clock runs.
    for (const t of [aki.token, ben.token]) room.attach(t, { send: () => {}, close: () => {} });
    expect(room.command(stage, { id: 's1', type: 'start', mode: 'debug', rounds: 1 })).toMatchObject({ ok: true });
    expect(room.signedIn()).toEqual([{ playerId: aki.playerId, account: 'session-aki' }]);
    room.state.phrasebook[aki.playerId] = [phrase('a', 'said'), phrase('b', 'missed')];
    room.state.phrasebook[ben.playerId] = [phrase('a', 'missed')];
    for (let i = 0; i < 50 && room.state.phase !== 'recap'; i++) clock.advance(60_000);
    expect(room.state.phase).toBe('recap');
    // Tonight's phrasebook for the stage: who said and who missed each phrase.
    expect(room.state.tonight).toEqual([
      expect.objectContaining({ itemId: 'a', mode: 'debug', said: ['Aki'], missed: ['Ben'] }),
      expect.objectContaining({ itemId: 'b', said: [], missed: ['Aki'] }),
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(1);
    expect(saved[0]![0]!.result.phrases).toHaveLength(2);
    // The Phrasebook: the stage sees everyone's; a phone sees only its own phrases and its own save.
    expect(room.phrasebookFor(stage)).toMatchObject({ tonight: [{ itemId: 'a' }, { itemId: 'b' }], signedIn: [{ playerId: aki.playerId }] });
    expect(room.phrasebookFor(ben.token)).toMatchObject({ tonight: [{ itemId: 'a' }], signedIn: [] });
    expect(room.phrasebookFor(aki.token)!.signedIn).toEqual([{ playerId: aki.playerId, account: 'session-aki' }]);
    expect(room.phrasebookFor('nope')).toBeNull();
    expect(saved[0]![0]).toMatchObject({ account: 'session-aki', result: { mode: 'debug', players: 2 } });
    expect(saved[0]![0]!.result.at).toBeGreaterThan(T0);

    // Signing out between games: the next game isn't saved.
    expect(room.join({ name: 'Aki', token: aki.token })).toMatchObject({ playerId: aki.playerId, rejoined: true });
    room.command(stage, { id: 's2', type: 'playAgain' });
    room.command(stage, { id: 's3', type: 'start', mode: 'debug', rounds: 1 });
    for (let i = 0; i < 50 && room.state.phase !== 'recap'; i++) clock.advance(60_000);
    expect(room.state.phase).toBe('recap');
    expect(saved).toHaveLength(1);
  });
});
