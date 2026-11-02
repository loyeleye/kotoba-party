// Solo missions (shared/src/missions.ts): Sign Walk's signs, its reading check, how its days count toward 3.12
// and nothing else, and the account service's two mission calls.

import { describe, expect, it } from 'vitest';
import { writeKanji } from '../content/src/kanji/kanji.js';
import { Accounts, MemoryAccountStorage, type Passkeys } from '../server/src/accounts.js';
import { MISSION_BY_ID, MISSION_SIZE, SOLO_KANJI_DAYS, checkReading, missionFor, pickMission } from '../shared/src/missions.js';
import { ITEM_DAYS, KANJI_GOAL, pathStatus } from '../shared/src/path.js';
import { addGame, addSoloSay, dayOf, emptyProgress, frameRule, reviewPhrase, type AccountView, type Progress } from '../shared/src/progress.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 12);
const walk = MISSION_BY_ID['sign-walk']!;
const say = (p: Progress, itemId: string, at: number, memory = true) => {
  const w = walk.words.find((x) => x.itemId === itemId)!;
  addSoloSay(p, { itemId, text: w.text, kana: w.kana, en: w.en, outcome: 'said', recall: memory ? 'memory' : 'read' }, at, 0);
};
const goal = (p: Progress, id: string, at: number) => pathStatus(p, at, 0).goals.find((g) => g.id === id)!;

describe('Sign Walk', () => {
  it('reads every sign kanji of 3.12 through its sign word, and only those', () => {
    expect(missionFor('3.12')).toBe(walk);
    const chars = walk.words.flatMap((w) => w.kanji.map((k) => k.char));
    const n3 = writeKanji.filter((k) => k.level === 'n3').map((k) => k.char);
    expect(new Set(chars)).toEqual(new Set(n3));
    expect(chars).toHaveLength(KANJI_GOAL);
    for (const w of walk.words) {
      expect(w.itemId).toBe(`kw-${w.text}`);
      for (const k of w.kanji) expect(w.text).toContain(k.char);
    }
    expect(walk.words.find((w) => w.text === '非常口')!.kanji.map((k) => k.char)).toEqual(['非', '常']);
    expect(walk.words.find((w) => w.text === '非常口')!.sign.kind).toBe('exit');
    expect(SOLO_KANJI_DAYS).toBeLessThanOrEqual(ITEM_DAYS);
    expect(ITEM_DAYS).toBe(2); // missions.ts keeps its own copy
  });

  it('checks the reading: kana, romaji or speech; never the kanji typed in', () => {
    const w = walk.words.find((x) => x.text === '非常口')!;
    expect(checkReading(w, { via: 'typed', text: 'ひじょうぐち' })).toEqual({ right: true });
    expect(checkReading(w, { via: 'typed', text: 'hijouguchi' })).toEqual({ right: true });
    expect(checkReading(w, { via: 'tap', text: 'ひじょーぐち' })).toEqual({ right: true });
    expect(checkReading(w, { via: 'speech', text: '非常口', reading: 'ひじょうぐち' })).toEqual({ right: true });
    expect(checkReading(w, { via: 'typed', text: '非常口' })).toEqual({ right: false, why: 'kanji-typed' });
    expect(checkReading(w, { via: 'typed', text: 'でぐち' })).toEqual({ right: false, why: 'wrong' });
    expect(checkReading(w, { via: 'typed', text: ' ' })).toEqual({ right: false, why: 'empty' });
  });

  it('deals half-read kanji first, skips signs read today, and deals the same signs on a reload', () => {
    const p = emptyProgress();
    say(p, 'kw-非常口', T0 - 2 * DAY);
    say(p, 'kw-禁煙', T0);
    const picked = pickMission(p, walk, T0, 0);
    expect(picked).toHaveLength(MISSION_SIZE);
    expect(picked.map((w) => w.text)).toContain('非常口');
    expect(picked.map((w) => w.text)).not.toContain('禁煙');
    expect(pickMission(p, walk, T0 + 60_000, 0).map((w) => w.itemId)).toEqual(picked.map((w) => w.itemId));
  });
});

describe('solo days on the path', () => {
  it('clears 3.12 from missions on two days, and a second say the same day adds nothing', () => {
    const p = emptyProgress();
    for (const w of walk.words) say(p, w.itemId, T0);
    for (const w of walk.words) say(p, w.itemId, T0 + 60_000);
    expect(goal(p, '3.12', T0).count).toEqual({ have: 0, need: KANJI_GOAL });
    for (const w of walk.words) say(p, w.itemId, T0 + DAY);
    const g = goal(p, '3.12', T0 + DAY);
    expect(g.count).toEqual({ have: KANJI_GOAL, need: KANJI_GOAL });
    expect(g.met).toBe(true);
  });

  it('never counts a read after peeking, a phone review day, or a solo day toward a frame', () => {
    const p = emptyProgress();
    for (const w of walk.words) say(p, w.itemId, T0, false);
    for (const w of walk.words) reviewPhrase(p, w.itemId, true, T0 + DAY, 0);
    expect(goal(p, '3.12', T0 + DAY).count!.have).toBe(0);
    say(p, 'kw-予約', T0 + 2 * DAY);
    const card = p.phrases!['kw-予約']!;
    expect(card.memory!.find((d) => d.day === dayOf(T0 + 2 * DAY, 0))).toMatchObject({ solo: true, game: false });
    expect(frameRule([card]).inGame).toBe(false);
  });

  it('only goals with a mission read solo days: N4 kanji count for 4.10 (Kanji Walk), N5 ones not for 5.10', () => {
    const p = emptyProgress();
    for (const at of [T0, T0 + DAY]) addSoloSay(p, { itemId: 'kw-会社', text: '会社', kana: 'かいしゃ', en: 'a company', outcome: 'said', recall: 'memory' }, at, 0);
    for (const at of [T0, T0 + DAY]) addSoloSay(p, { itemId: 'kw-日本', text: '日本', kana: 'にほん', en: 'Japan', outcome: 'said', recall: 'memory' }, at, 0);
    expect(goal(p, '4.10', T0 + DAY).count!.have).toBe(2); // 会 and 社
    expect(goal(p, '5.10', T0 + DAY).count!.have).toBe(0);
    expect(missionFor('5.10')).toBeUndefined();
  });

  it('Kanji Walk reads every N4 kanji through its say word, on a word card', () => {
    const kw = missionFor('4.10')!;
    expect(kw.look).toBe('card');
    const n4 = writeKanji.filter((k) => k.level === 'n4').map((k) => k.char);
    expect(new Set(kw.words.flatMap((w) => w.kanji.map((k) => k.char)))).toEqual(new Set(n4));
    expect(n4.length).toBeGreaterThanOrEqual(KANJI_GOAL);
  });

  it('keeps a game day and a solo day together: one of each clears a kanji', () => {
    const p = emptyProgress();
    addGame(p, { mode: 'shodo', at: T0, score: 0, place: 0, players: 2, coop: false, awards: [], cards: [], phrases: [{ itemId: 'kj-禁', text: '禁煙', kana: 'きんえん', en: 'no smoking', outcome: 'said', recall: 'memory' }] }, 0);
    say(p, 'kw-禁煙', T0 + DAY);
    expect(goal(p, '3.12', T0 + DAY).count!.have).toBe(1); // 禁 (game + solo); 煙 has one solo day
  });
});

// ---- the account service ----

function service(now: () => number) {
  const passkeys: Passkeys & { last: string } = {
    last: '',
    registrationOptions: async (o) => ((passkeys.last = o.challenge), { challenge: o.challenge }),
    authenticationOptions: async (o) => ((passkeys.last = o.challenge), { challenge: o.challenge }),
    verifyRegistration: async (o) => ({ id: (o.response as { id: string }).id, publicKey: 'pk', counter: 0 }),
    verifyAuthentication: async () => ({ counter: 1 }),
  };
  const accounts = new Accounts(new MemoryAccountStorage(), passkeys, now);
  const call = async (action: string, body?: unknown, token?: string, speech = false) => {
    const req = new Request(`http://local/api/account/${action}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await accounts.handle(req, action, 'https://tanoshi.example', { speech });
    return { status: res.status, data: (await res.json()) as Record<string, any> & { token?: string; account?: AccountView } };
  };
  const register = async () => {
    await call('register/options', { name: 'Aki' });
    const clientDataJSON = Buffer.from(JSON.stringify({ challenge: passkeys.last })).toString('base64url');
    return (await call('register/verify', { response: { id: 'cred-1', response: { clientDataJSON } }, tz: 0 })).data.token!;
  };
  return { accounts, call, register };
}

describe('mission calls', () => {
  it('deals signs without their readings, saves only a right reading from memory, and peeking is practice', async () => {
    let now = T0;
    const s = service(() => now);
    const token = await s.register();
    expect((await s.call('mission', { mission: 'sign-walk' })).status).toBe(401);
    expect((await s.call('mission', { mission: 'nope' }, token)).status).toBe(404);
    const start = await s.call('mission', { mission: 'sign-walk' }, token, true);
    expect(start.status).toBe(200);
    expect(start.data.speech).toBe(true);
    const words = start.data.mission.words as { itemId: string; sign: { text: string } }[];
    expect(words).toHaveLength(MISSION_SIZE);
    expect(JSON.stringify(start.data)).not.toMatch(/kana|romaji|[ぁ-ん]/);

    const [a, b] = words.map((w) => walk.words.find((x) => x.itemId === w.itemId)!);
    const wrong = await s.call('mission/answer', { mission: 'sign-walk', itemId: a!.itemId, answer: { via: 'typed', text: 'ちがう' } }, token);
    expect(wrong.data).toMatchObject({ right: false, why: 'wrong', heard: 'ちがう' });
    expect(wrong.data.reveal).toBeUndefined();
    const right = await s.call('mission/answer', { mission: 'sign-walk', itemId: a!.itemId, answer: { via: 'typed', text: a!.kana } }, token);
    expect(right.data).toMatchObject({ right: true, counted: true, reveal: { text: a!.text, kana: a!.kana } });

    const peek = await s.call('mission/answer', { mission: 'sign-walk', itemId: b!.itemId, giveUp: true }, token);
    expect(peek.data).toMatchObject({ right: false, counted: false, reveal: { kana: b!.kana } });
    const practice = await s.call('mission/answer', { mission: 'sign-walk', itemId: b!.itemId, answer: { via: 'typed', text: b!.kana }, peeked: true }, token);
    expect(practice.data).toMatchObject({ right: true, counted: false });
    expect((await s.call('mission/answer', { mission: 'sign-walk', itemId: 'kw-日本', answer: { via: 'typed', text: 'にほん' } }, token)).status).toBe(404);

    now = T0 + DAY;
    await s.call('mission/answer', { mission: 'sign-walk', itemId: a!.itemId, answer: { via: 'typed', text: a!.kana } }, token);
    await s.call('settings', { path: true }, token);
    const me = (await s.call('me', undefined, token)).data.account!;
    expect(me.pathStatus.goals.find((g) => g.id === '3.12')!.count!.have).toBe(a!.kanji.length);
  });
});
