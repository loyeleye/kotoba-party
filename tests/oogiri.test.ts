// Oogiri Night: rules (driven through the real room machine with fixture content) and a
// full-system game played by bots over the network.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Level } from '../content/src/types.js';
import { createRoom } from '../shared/src/client.js';
import { POINTS_PER_VOTE } from '../shared/src/constants.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { buildAnswer } from '../shared/src/modes/oogiri/answer.js';
import { dealTiles, libraryFor } from '../shared/src/modes/oogiri/deal.js';
import { FALLBACK_PACK, FALLBACK_PROMPTS } from '../shared/src/modes/oogiri/fallback.js';
import { pairings, SAY_FIRST_MS, type OogiriState, type OogiriView } from '../shared/src/modes/oogiri/oogiri.js';
import { toRomaji } from '../shared/src/japanese/romaji.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { oogiriPolicy } from '../tools/bots/policies/oogiri.js';
import { content as realContent, hashView, startServer, until } from './helpers.js';

// ---------------------------------------------------------------------------
// Harness: a room driven by hand, with a clock we control.

let ids = 0;
let seed = 1;
function harness(levels: Level[], content: ContentLibrary = EMPTY_CONTENT) {
  const s = createGame('BCDF');
  let now = 1_000_000;
  const gctx = (): GameContext => ({
    now,
    content,
    newId: () => `a${String(++ids).padStart(5, '0')}`,
    random: () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    },
  });
  const act = (a: GameAction) => apply(s, a, gctx());
  levels.forEach((level, i) => {
    act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  let cmdId = 0;
  const play = (playerId: string, move: unknown) =>
    apply(s, { type: 'command', actor: { kind: 'player', playerId }, command: { id: `c${++cmdId}`, type: 'play', move } as Command }, gctx());
  const timeout = () => act({ type: 'timeout', phaseSeq: s.phaseSeq });
  const view = (playerId?: string): RoomView => viewFor(s, playerId ? { kind: 'player', playerId } : { kind: 'stage' }, content);
  const game = (playerId?: string) => view(playerId).game as OogiriView;
  const os = () => s.modeState as OogiriState;
  const start = () => {
    const r = apply(s, { type: 'command', actor: { kind: 'stage' }, command: { id: 'start', type: 'start', mode: 'oogiri' } }, gctx());
    expect(r.changed).toBe(true);
  };
  return {
    s,
    os,
    act,
    play,
    timeout,
    view,
    game,
    start,
    tick: (ms: number) => (now += ms),
    players: () => s.players.map((p) => p.id),
    until(phase: string) {
      for (let i = 0; i < 200 && s.phase !== phase; i++) timeout();
      expect(s.phase).toBe(phase);
    },
  };
}
type H = ReturnType<typeof harness>;

/** Everyone answers every slot from memory (or with a tile at the Kana level). */
function answerAll(h: H, text = 'ねこ') {
  for (let guard = 0; guard < 40 && h.s.phase === 'answer'; guard++) {
    let any = false;
    for (const id of h.players()) {
      const slot = h.game(id).me?.slot;
      if (!slot) continue;
      any = true;
      const move = slot.sayFirst
        ? { kind: 'answer', slot: slot.index, said: { via: 'speech', text } }
        : { kind: 'answer', slot: slot.index, tiles: [{ key: slot.tiles[0]!.key, form: slot.tiles[0]!.ask?.form ?? slot.tiles[0]!.options?.[0]?.form }] };
      expect(h.play(id, move)).toMatchObject({ changed: true });
    }
    if (!any) break;
  }
}

function sumLedger(h: H, playerId: string) {
  return h.os().ledger.filter((e) => e.playerId === playerId).reduce((n, e) => n + e.points, 0);
}

// ---------------------------------------------------------------------------

describe('pairings', () => {
  it('head to head: a ring, every player answers two prompts, every prompt has two authors', () => {
    for (let n = 3; n <= 8; n++) {
      const order = Array.from({ length: n }, (_, i) => `p${i}`);
      const pairs = pairings('head-to-head', order);
      expect(pairs).toHaveLength(n);
      for (const pair of pairs) expect(new Set(pair).size).toBe(2);
      for (const p of order) expect(pairs.filter((x) => x.includes(p))).toHaveLength(2);
    }
  });

  it('photo caption: pairs, with the odd one out paired with the first player', () => {
    expect(pairings('photo-caption', ['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c', 'd']]);
    expect(pairings('photo-caption', ['a', 'b', 'c'])).toEqual([['a', 'b'], ['c', 'a']]);
    expect(pairings('ippon', ['a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
  });
});

describe('tiles', () => {
  const lib = libraryFor(EMPTY_CONTENT, FALLBACK_PACK.id);
  const prompt = FALLBACK_PROMPTS.find((p) => p.id === 'ph.oogiri.teacher-every-day')!;
  const rnd = () => 0.42;

  it('deals 8 (3 fit, 3 swerve, 2 callback) from N5, 6 at the Kana level', () => {
    const n5 = dealTiles(lib, prompt, 'n5', ['ph.neko', 'ph.inu'], rnd);
    expect(n5).toHaveLength(8);
    expect(n5.filter((t) => t.role === 'fit')).toHaveLength(3);
    expect(n5.filter((t) => t.role === 'swerve')).toHaveLength(3);
    expect(n5.filter((t) => t.role === 'callback').map((t) => t.wordId).sort()).toEqual(['ph.inu', 'ph.neko']);
    expect(dealTiles(lib, prompt, 'kana', [], rnd)).toHaveLength(6);
    expect(new Set(n5.map((t) => t.wordId)).size).toBe(8);
  });

  it('verb tiles ask for a form from N5 up; Kana level gets the ます form ready', () => {
    const n5 = dealTiles(lib, prompt, 'n5', [], rnd).filter((t) => ['ph.taberu', 'ph.neru', 'ph.utau'].includes(t.wordId));
    expect(n5.length).toBeGreaterThan(0);
    for (const t of n5) {
      expect(['masu', 'mashita', 'masen', 'tai']).toContain(t.ask);
      expect(t.options!.map((o) => o.form)).toEqual(['masu', 'mashita', 'masen', 'tai']);
    }
    const kana = dealTiles(lib, prompt, 'kana', [], rnd).filter((t) => t.wordId === 'ph.taberu');
    for (const t of kana) {
      expect(t.options).toBeUndefined();
      expect(t.jp.text).toBe('食べます');
    }
  });

  it('builds answers: picks forms, wraps frames, refuses English in round 1', () => {
    const hand = dealTiles(lib, prompt, 'n5', [], rnd);
    const verb = hand.find((t) => t.options)!;
    expect(buildAnswer({ kind: 'answer', slot: 0, tiles: [{ key: verb.key }] }, hand, [], false, 'head-to-head')).toEqual({ ok: false, error: 'pick-form' });
    const wrong = verb.options!.find((o) => o.form !== verb.ask)!;
    const built = buildAnswer({ kind: 'answer', slot: 0, tiles: [{ key: verb.key, form: wrong.form }] }, hand, [], false, 'head-to-head');
    expect(built.ok && built.answer.formTips.length).toBe(1);
    expect(built.ok && built.answer.text).toBe(wrong.jp.text);
    // Tiles can't be used while the say-it-first window is open.
    expect(buildAnswer({ kind: 'answer', slot: 0, tiles: [{ key: verb.key, form: wrong.form }] }, hand, [], true, 'head-to-head')).toEqual({ ok: false, error: 'say-it-first' });
    expect(buildAnswer({ kind: 'answer', slot: 0, said: { via: 'typed', text: 'a cat' } }, hand, [], true, 'head-to-head')).toEqual({ ok: false, error: 'japanese-only' });
    const en = buildAnswer({ kind: 'answer', slot: 0, said: { via: 'typed', text: 'a cat' } }, hand, [], true, 'photo-caption');
    expect(en.ok && en.answer.style).toBe('english');
    // A verb in a 〜たい frame goes in as its stem.
    const frames = [{ id: 'f', frame: { text: '＿＿＿たい！', kana: '＿＿＿たい！', en: 'I want to ___!' }, slot: 'verb-stem' as const, pattern: '' }];
    const taberu = hand.find((t) => t.wordId === 'ph.taberu') ?? hand.find((t) => t.stem)!;
    const tai = buildAnswer({ kind: 'answer', slot: 0, frame: 'f', tiles: [{ key: taberu.key }] }, hand, frames, false, 'photo-caption');
    expect(tai.ok && tai.answer.text).toBe(`${taberu.stem!.text}たい！`);
    // Said to send it: a match earns "spoken", anything else "tried".
    const noun = hand.find((t) => !t.options)!;
    const spoken = buildAnswer({ kind: 'answer', slot: 0, tiles: [{ key: noun.key }], said: { via: 'speech', text: noun.jp.kana } }, hand, [], false, 'head-to-head');
    expect(spoken.ok && spoken.answer.style).toBe('spoken');
    const tried = buildAnswer({ kind: 'answer', slot: 0, tiles: [{ key: noun.key }], said: { via: 'speech', text: 'ぜんぜん ちがう' } }, hand, [], false, 'head-to-head');
    expect(tried.ok && tried.answer.style).toBe('tried');
  });

  it('writes romaji for Kana-level training wheels', () => {
    expect(toRomaji('ねこの ひみつの しごと')).toBe('neko no himitsu no shigoto');
    expect(toRomaji('ラーメン')).toBe('rāmen');
    expect(toRomaji('きって')).toBe('kitte');
    expect(toRomaji('ちょっと')).toBe('chotto');
    expect(toRomaji('ほんや')).toBe("hon'ya");
  });
});

describe('a whole game through the room machine', () => {
  it('plays three rounds to the recap with consistent scores, phrasebooks and awards', () => {
    const h = harness(['kana', 'n5', 'n4', 'n5']);
    h.start();
    const seen: string[] = [];
    const kinds = new Set<string>();
    for (let guard = 0; guard < 300 && h.s.phase !== 'recap'; guard++) {
      seen.push(h.s.phase);
      const g = h.game();
      if (g.kind) kinds.add(g.kind);
      if (h.s.phase === 'answer') answerAll(h);
      else if (h.s.phase === 'reveal') {
        for (const id of h.players()) {
          const me = h.game(id).me!;
          if (!me.canVote) continue;
          const option = h.game(id).matchup!.answers.find((a) => !a.mine)!;
          h.play(id, { kind: 'vote', answerId: option.id });
          if (h.s.phase !== 'reveal') break;
        }
      } else if (h.s.phase === 'encore') {
        for (const id of h.players()) {
          const me = h.game(id).me!;
          if (me.encore === 'winner') h.play(id, { kind: 'encore', said: { via: 'speech', text: 'ねこ' } });
          else if (me.encore === 'author') h.play(id, { kind: 'encore', pass: true });
          if (h.s.phase !== 'encore') break;
        }
        if (h.s.phase === 'encore') h.timeout();
      } else h.timeout();
    }
    expect(h.s.phase).toBe('recap');
    expect([...kinds]).toEqual(['head-to-head', 'photo-caption', 'ippon']);
    expect(seen.filter((p) => p === 'prompt')).toHaveLength(3);
    // Round 1: 4 head-to-head matchups; round 2: 2 photo pairs; round 3: one for all.
    expect(seen.filter((p) => p === 'reveal')).toHaveLength(4 + 2 + 1);
    for (const p of h.s.players) expect(p.score).toBe(sumLedger(h, p.id));
    expect(h.s.players.some((p) => p.score > 0)).toBe(true);
    // Everyone's phrasebook holds the natural versions and their own words.
    for (const p of h.s.players) expect(h.s.phrasebook[p.id]!.some((e) => e.itemId.endsWith(':natural'))).toBe(true);
    expect(h.s.recap!.awards.length).toBeGreaterThan(0);
  });
});

describe('say it first', () => {
  it('holds tiles back for 5 s from N5 up, and shows them at once at the Kana level', () => {
    const h = harness(['n5', 'kana', 'n5']);
    h.start();
    h.until('answer');
    const slot = h.game('p1').me!.slot!;
    expect(slot.sayFirst).toBe(true);
    expect(slot.tiles).toEqual([]);
    expect(h.game('p2').me!.slot!.sayFirst).toBe(false);
    expect(h.game('p2').me!.slot!.tiles).toHaveLength(6);
    expect(h.game('p2').me!.slot!.prompt.romaji).toBeTruthy();
    expect(h.game('p1').me!.slot!.prompt.romaji).toBeUndefined();

    expect(h.play('p1', { kind: 'tiles', slot: 0 })).toEqual({ changed: false, error: 'say-it-first' });
    // A move from an earlier round that arrives late is a harmless race.
    expect(h.play('p1', { kind: 'tiles', slot: 0, round: 0 })).toEqual({ changed: false, error: 'wrong-phase' });
    h.tick(SAY_FIRST_MS);
    expect(h.play('p1', { kind: 'tiles', slot: 0 }).changed).toBe(true);
    const tiles = h.game('p1').me!.slot!.tiles;
    expect(tiles).toHaveLength(8);
    // A memory answer after the tiles showed is no longer "from memory".
    expect(h.play('p1', { kind: 'answer', slot: 0, said: { via: 'speech', text: 'ねこ' } }).changed).toBe(true);
    expect(h.os().answers.find((a) => a.authorId === 'p1')!.style).toBe('spoken');
    // The second slot opens with a fresh window.
    expect(h.game('p1').me!.slot!.index).toBe(1);
    expect(h.game('p1').me!.slot!.sayFirst).toBe(true);
    expect(h.play('p1', { kind: 'answer', slot: 1, said: { via: 'speech', text: 'すし' } }).changed).toBe(true);
    expect(h.os().answers.filter((a) => a.authorId === 'p1')[1]!.style).toBe('memory-spoken');
    expect(h.play('p1', { kind: 'answer', slot: 1, said: { via: 'speech', text: 'すし' } })).toEqual({ changed: false, error: 'already-answered' });
  });

  it('keeps each player’s prompts and tiles private', () => {
    const h = harness(['kana', 'kana', 'kana']);
    h.start();
    h.until('answer');
    expect(h.game('p1').me!.slot!.tiles).toHaveLength(6);
    expect(h.game().me).toBeNull();
    expect(JSON.stringify(h.game())).not.toContain('"tiles"');
    // Nobody else's view carries p1's hand.
    for (const v of [h.view('p2'), h.view('p3'), h.view()]) expect(JSON.stringify(v)).not.toContain(JSON.stringify(h.game('p1').me!.slot!.tiles));
  });
});

describe('voting, IPPON, hiding and the encore', () => {
  /** 5 players: each head-to-head matchup has 3 voters, enough for an IPPON. */
  function toReveal() {
    const h = harness(['n5', 'n5', 'n5', 'n5', 'n5']);
    h.start();
    h.until('answer');
    answerAll(h);
    expect(h.s.phase).toBe('reveal');
    return h;
  }

  it('hides authors until the encore, and only non-authors vote in head to head', () => {
    const h = toReveal();
    const m = h.os().matchups[h.os().current]!;
    const stage = JSON.stringify(h.view().game);
    expect(stage).not.toContain('authorId');
    expect(stage).not.toContain('authorName');
    expect(h.game().matchup!.answers.every((a) => a.authorId === undefined)).toBe(true);
    const author = m.authors[0]!;
    const theirs = h.game(author).matchup!.answers;
    expect(theirs.filter((a) => a.mine)).toHaveLength(1);
    expect(h.game(author).me!.canVote).toBe(false);
    expect(h.play(author, { kind: 'vote', answerId: theirs.find((a) => !a.mine)!.id })).toEqual({ changed: false, error: 'author-cant-vote' });
  });

  it('gives an IPPON when every other voter (3+) picks one answer', () => {
    const h = toReveal();
    const m = h.os().matchups[h.os().current]!;
    const target = h.game().matchup!.answers[0]!;
    const author = h.os().answers.find((a) => a.id === target.id)!.authorId;
    const voters = h.players().filter((p) => !m.authors.includes(p));
    expect(voters).toHaveLength(3);
    for (const v of voters) h.play(v, { kind: 'vote', answerId: target.id });
    expect(h.s.phase).toBe('encore');
    const g = h.game();
    expect(g.matchup!.ippon).toBe(true);
    const card = g.matchup!.answers.find((a) => a.id === target.id)!;
    expect(card).toMatchObject({ ippon: true, winner: true, votes: 3, authorId: author });
    expect(h.s.cues.some((c) => c.event === 'ippon')).toBe(true);
    const line = h.os().matchups[h.os().current]!.result!.lines.find((l) => l.answerId === target.id)!;
    expect(line.votePoints).toBe(3 * POINTS_PER_VOTE);
    expect(line.ipponPoints).toBeGreaterThan(0);
    // The bonus stays inside the 30% pool.
    expect(line.bonus + line.encoreBonus).toBeLessThanOrEqual(line.bonusCap);
    expect(line.bonusCap).toBe(Math.round((0.3 * POINTS_PER_VOTE * 3) / 2 / 5) * 5);
    expect(h.game(author).me!.encore).toBe('winner');
    expect(h.play(author, { kind: 'encore', said: { via: 'speech', text: target.text } }).changed).toBe(true);
    expect(h.game(author).me!.encore).toBe('done');
    expect(h.game().matchup!.answers.find((a) => a.id === target.id)!.encore).toBe('said');
    h.timeout();
    expect(h.s.phase).toBe('score');
    const scored = h.os().matchups[h.os().current]!.result!.lines.find((l) => l.answerId === target.id)!;
    expect(scored.encoreBonus).toBeGreaterThan(0);
    expect(scored.bonus + scored.encoreBonus).toBeLessThanOrEqual(scored.bonusCap);
    expect(h.game().matchup!.natural).not.toBeNull();
    expect(h.game(author).me!.tip!.natural.text).toBeTruthy();
  });

  it('reacts to the vote margin, and the room shouts the winner\'s answer', () => {
    const h = toReveal();
    const m = h.os().matchups[h.os().current]!;
    // Pon's reveal snap-back names the answer.
    const reveal = h.s.cues.filter((c) => c.event === 'reveal_react' && !c.ahead).at(-1)!;
    expect(reveal.slots).toMatchObject({ tile: 'ねこ', tile_kana: 'ねこ' });
    const [a, b] = h.game().matchup!.answers;
    const voters = h.players().filter((p) => !m.authors.includes(p));
    h.play(voters[0]!, { kind: 'vote', answerId: a!.id });
    h.play(voters[1]!, { kind: 'vote', answerId: a!.id });
    h.play(voters[2]!, { kind: 'vote', answerId: b!.id });
    expect(h.s.phase).toBe('encore');
    const winner = h.os().answers.find((x) => x.id === a!.id)!;
    const name = h.s.players.find((p) => p.id === winner.authorId)!.name;
    expect(h.s.cues.at(-1)).toMatchObject({ event: 'vote_close', slots: { name, tile: 'ねこ' } });
    h.timeout();
    expect(h.s.phase).toBe('score');
    const natural = h.game().matchup!.natural!;
    expect(natural.text).toContain('ねこ');
    expect(natural.text).not.toBe(m.prompt.exampleAnswer.text);
    expect(h.s.cues.at(-1)).toMatchObject({ event: 'natural_version', answer: natural.text, slots: { name, tile: 'ねこ' } });
  });

  it('says so when nobody votes, and falls back to the example answer', () => {
    const h = toReveal();
    const m = h.os().matchups[h.os().current]!;
    h.timeout();
    expect(h.s.phase).toBe('encore');
    expect(h.s.cues.at(-1)).toMatchObject({ event: 'vote_zero' });
    h.timeout();
    expect(h.game().matchup!.natural!.text).toBe(m.prompt.exampleAnswer.text);
  });

  it('lets only the VIP hide an answer; hidden answers lose their votes and show [hidden]', () => {
    const h = toReveal();
    const m = h.os().matchups[h.os().current]!;
    const [a, b] = h.game().matchup!.answers;
    const voters = h.players().filter((p) => !m.authors.includes(p));
    h.play(voters[0]!, { kind: 'vote', answerId: a!.id });
    const vip = h.s.vipId!;
    const notVip = h.players().find((p) => p !== vip)!;
    expect(h.play(notVip, { kind: 'hide', answerId: a!.id })).toEqual({ changed: false, error: 'not-vip' });
    expect(h.play(vip, { kind: 'hide', answerId: a!.id }).changed).toBe(true);
    const shown = h.game().matchup!.answers.find((x) => x.id === a!.id)!;
    expect(shown).toMatchObject({ text: '[hidden]', en: '', hidden: true });
    expect(m.votes[voters[0]!]).toBeUndefined();
    expect(h.play(voters[1]!, { kind: 'vote', answerId: a!.id })).toEqual({ changed: false, error: 'hidden' });
    expect(h.play(voters[1]!, { kind: 'vote', answerId: b!.id }).changed).toBe(true);
  });
});

describe('host reactions sent ahead', () => {
  it('sends each matchup\'s reveal reaction as it locks, matching the cue the reveal raises', () => {
    const h = harness(['n5', 'n5', 'n5', 'n5']);
    h.start();
    h.until('answer');
    h.s.cues.splice(0);
    answerAll(h);
    expect(h.s.phase).toBe('reveal');
    const cues = h.s.cues.filter((c) => c.event === 'reveal_react');
    const ahead = cues.filter((c) => c.ahead);
    const now = cues.filter((c) => !c.ahead);
    // One per matchup as it locked, then the later matchups again as the reveal starts.
    const matchups = h.os().matchups.filter((m) => h.os().answers.some((a) => a.matchup === m.index)).length;
    expect(matchups).toBeGreaterThan(1);
    expect(now).toHaveLength(1);
    expect(new Set(ahead.map((c) => c.prompt?.text)).size).toBe(matchups);
    // The cue said now has the same content as one sent ahead, so the host can use the early line.
    const { ahead: _, ...first } = ahead.find((c) => c.prompt?.text === now[0]!.prompt?.text)!;
    expect(first).toEqual(now[0]);
  });
});

describe('Pon steals a cushion', () => {
  it('once a game, when the leader is 3+ cushions ahead after a round', () => {
    const h = harness(['n5', 'n5', 'n5', 'n5', 'n5']);
    h.start();
    h.until('answer');
    answerAll(h);
    // Every vote in round 1 goes to whatever p1 wrote, else to the first answer.
    for (let guard = 0; guard < 100 && h.s.phase !== 'penalty' && h.s.phase !== 'prompt'; guard++) {
      if (h.s.phase === 'reveal') {
        const answers = h.os().answers.filter((x) => x.matchup === h.os().current);
        const pick = answers.find((x) => x.authorId === 'p1') ?? answers[0]!;
        for (const v of h.players()) if (h.game(v).me!.canVote) h.play(v, { kind: 'vote', answerId: pick.id });
        if (h.s.phase === 'reveal') h.timeout();
      } else h.timeout();
    }
    expect(h.s.phase).toBe('penalty');
    const steal = h.game().steal!;
    expect(steal.playerId).toBe('p1');
    expect(h.os().ledger.filter((e) => e.why === 'steal')).toEqual([{ playerId: 'p1', round: 1, points: -POINTS_PER_VOTE, why: 'steal' }]);
    expect(h.s.cues.some((c) => c.event === 'cushion_steal')).toBe(true);
    h.timeout();
    expect(h.s.phase).toBe('prompt');
    expect(h.os().round).toBe(2);
  });
});

describe('real content', () => {
  it('runs with the content library: N4 gets the N5 version when there is no N4 one', () => {
    const h = harness(['n4', 'n5', 'kana'], realContent);
    h.start();
    h.until('answer');
    for (const id of h.players()) {
      const slot = h.game(id).me!.slot!;
      expect(slot.prompt.text).toMatch(/＿/);
    }
    expect(h.game().placeholder).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('full system: bots play Oogiri Night over the network', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({
      durations: { intro: 20, prompt: 20, answer: 6_000, reveal: 1_500, encore: 400, score: 30, penalty: 30 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('plays a whole game with no desyncs and consistent scores', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };
    let finished = false;
    let recap: RoomView['recap'] = null;
    const phases = new Set<string>();
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 5,
      roundsPerGame: 3,
      totalRounds: 3,
      mode: 'oogiri',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        phases.add(view.phase);
        if (view.phase === 'recap') recap = view.recap;
      },
    });
    director.start();

    const levels: Level[] = ['kana', 'n5', 'n4', 'kana', 'n5'];
    const bots: Bot[] = [];
    for (let i = 0; i < levels.length; i++) {
      bots.push(
        await Bot.join({
          baseUrl,
          code: created.code,
          name: `bot${i + 1}`,
          level: levels[i],
          policy: oogiriPolicy({ thinkMs: 60, tilesChance: i === 1 ? 0.3 : 0 }),
          onState: (bot, view, v) => record(bot.playerId, view, v),
        }),
      );
    }

    await until(() => finished, 60_000, 'a whole game');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(phases.has('reveal') && phases.has('encore') && phases.has('score') && phases.has('recap')).toBe(true);
    // Every state a client accepted matches what the server committed for it.
    for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
    // No move failed except a lost race with a phase timer.
    const failures = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase').map((m) => `${b.name} ${m.key}: ${m.error}`));
    expect(failures).toEqual([]);
    expect(bots.reduce((n, b) => n + b.moves.filter((m) => m.ok).length, 0)).toBeGreaterThan(20);
    // Scores add up to the mode's ledger.
    const state = room.state.modeState as OogiriState;
    const r = recap as RoomView['recap'];
    expect(r).not.toBeNull();
    for (const s of r!.standings) {
      const sum = state.ledger.filter((e) => e.playerId === s.playerId).reduce((n, e) => n + e.points, 0);
      expect(s.score, s.name).toBe(sum);
    }
    expect(r!.standings.some((s) => s.score > 0)).toBe(true);

    for (const b of bots) b.stop();
    director.client.close();
  });
});

describe('romaji for the かな level', () => {
  it('spaces words, reads particles as they sound, and uses macrons', () => {
    expect(toRomaji('サンドイッチはよんひゃくえん、ジュースはさんびゃくえん。ぜんぶでいくら？')).toBe('Sandoitchi wa yonhyaku-en, jūsu wa sanbyaku-en. Zenbu de ikura?');
    expect(toRomaji('たこ：「すみません、＿＿＿を ください。」')).toBe('Tako: "Sumimasen, ___ o kudasai."');
    expect(toRomaji('おばあちゃんの ひみつの ソース')).toBe('obāchan no himitsu no sōsu');
    expect(toRomaji('すみません、おくれました。＿＿＿から。')).toBe('Sumimasen, okuremashita. ___ kara.');
    expect(toRomaji('おおきな タコ')).toBe('ōkina tako');
  });
  it('guesses word breaks for kana it has not seen', () => {
    expect(toRomaji('わたしは ねこが すきです')).toBe('watashi wa neko ga sukidesu');
    expect(toRomaji('ねこの ゲームは たのしい')).toBe('neko no gēmu wa tanoshii');
    expect(toRomaji('こども')).toBe('kodomo');
  });
});
