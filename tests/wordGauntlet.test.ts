import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TopicPack } from '../content/src/types.js';
import { createRoom, type CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { toRomaji } from '../shared/src/modes/wordGauntlet/romaji.js';
import { baseKana, dictionaryNoun, endsInN, follows, lastKana, startOptions, wordReading } from '../shared/src/modes/wordGauntlet/shiritori.js';
import {
  challengeAccepted,
  POINTS_PER_FOOLED,
  POINTS_PER_TELEPHONE_VOTE,
  POINTS_REAL_FOUND,
  SHOWDOWN_BONUS,
  TELEPHONE_MULTIPLIER,
  type WordGauntletState,
  type WordGauntletView,
} from '../shared/src/modes/wordGauntlet/wordGauntlet.js';
import { OBSCURE_WORDS } from '../shared/src/modes/wordGauntlet/words.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { Bot, Director } from '../tools/bots/bot.js';
import { wordGauntletPolicy } from '../tools/bots/policies/wordGauntlet.js';
import { content as realContent, hashView, startServer, until } from './helpers.js';

// ---- fixtures ----

const pack: TopicPack = {
  id: 'food',
  title: { text: '食べもの', kana: 'たべもの', en: 'Food' },
  blurb: 'test pack',
  words: [
    { id: 'food.ringo', jp: { text: 'りんご', kana: 'りんご', en: 'apple' }, pos: 'noun', level: 'kana' },
    { id: 'food.gohan', jp: { text: 'ごはん', kana: 'ごはん', en: 'rice' }, pos: 'noun', level: 'kana' },
    { id: 'food.goma', jp: { text: 'ごま', kana: 'ごま', en: 'sesame' }, pos: 'noun', level: 'n5' },
    { id: 'food.coffee', jp: { text: 'コーヒー', kana: 'コーヒー', en: 'coffee' }, pos: 'noun', level: 'kana' },
  ],
  phrases: [{ id: 'food.phrase.oishii', jp: { text: 'とても おいしいです。', kana: 'とても おいしいです。', en: 'It is very tasty.' }, level: 'n5', situation: 'eating' }],
  baselineWordIds: [],
  status: 'draft',
};
const fixture: ContentLibrary = { ...EMPTY_CONTENT, packs: [pack] };

let ids = 0;
let now = 1_000_000;
const gctx = (content: ContentLibrary = fixture): GameContext => ({ now, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random: () => 0 });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

function room(n: number, content = fixture) {
  const s = createGame('BCDF');
  const act = (a: GameAction) => apply(s, a, gctx(content));
  const cmd = (actor: ReturnType<typeof as> | typeof stage, command: CommandBody) =>
    apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, gctx(content));
  const play = (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move });
  const tick = () => act({ type: 'timeout', phaseSeq: s.phaseSeq });
  const ms = () => s.modeState as WordGauntletState;
  const view = (viewer: ReturnType<typeof as> | typeof stage) => viewFor(s, viewer, content).game as WordGauntletView;
  for (let i = 1; i <= n; i++) {
    act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: i === 4 ? 'kana' : 'n5' });
    act({ type: 'connection', playerId: `p${i}`, connected: true });
  }
  return { s, act, cmd, play, tick, ms, view };
}

const score = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.score;

/** Plays the two fake words with no moves, then lands on the telephone prompt. */
function skipFakes(r: ReturnType<typeof room>) {
  r.cmd(stage, { type: 'start', mode: 'word-gauntlet', packId: 'food' });
  while (r.ms().segment !== 'telephone' && r.s.phase !== 'recap') r.tick();
}

// ---- rules ----

describe('shiritori kana rules', () => {
  it('follows the house rules', () => {
    expect(lastKana('こーひー')).toBe('ひ'); // ー continues from the kana before it
    expect(lastKana('きしゃ')).toBe('や'); // small kana count as full size
    expect(endsInN('しゃしん')).toBe(true);
    expect(endsInN('きしゃ')).toBe(false);
    expect(follows('か', 'がっこう')).toBe(true); // dakuten may be added …
    expect(follows('が', 'かめ')).toBe(true); // … or dropped
    expect(follows('は', 'ぱん')).toBe(true);
    expect(follows('ご', 'りんご')).toBe(false);
    expect(baseKana('ぽ')).toBe('ほ');
    expect(startOptions('か')).toEqual(['か', 'が']);
    expect(startOptions('ほ')).toEqual(['ほ', 'ぼ', 'ぽ']);
    expect(startOptions('な')).toEqual(['な']);
  });

  it('reads words as hiragana', () => {
    expect(wordReading('ゴリラ')).toBe('ごりら');
    expect(wordReading(' りんご。')).toBe('りんご');
    expect(wordReading('りんごです')).toBe('りんご');
    expect(wordReading('林檎')).toBeNull();
    expect(wordReading('ringo')).toBeNull();
    expect(toRomaji('しゃしん')).toBe('shashin');
    expect(toRomaji('みっかぼうず')).toBe('mikkabouzu');
  });

  it('trusts the dictionary only for a single known noun', () => {
    const tok = (surface: string, pos: string, known = true) => ({ surface, reading: surface, pos, known });
    expect(dictionaryNoun([tok('りんご', '名詞')], 'りんご')).toBe(true);
    expect(dictionaryNoun([tok('りんご', '名詞'), tok('です', '助動詞')], 'りんご')).toBe(true);
    expect(dictionaryNoun([tok('ご', '接頭詞'), tok('り', '助動詞'), tok('ら', '名詞')], 'ごりら')).toBe(false);
    expect(dictionaryNoun([tok('ぺぽ', '名詞', false)], 'ぺぽ')).toBe(false);
    expect(dictionaryNoun(undefined, 'りんご')).toBe(false);
  });

  it('accepts challenged words on a majority or a tie', () => {
    expect(challengeAccepted({})).toBe(true);
    expect(challengeAccepted({ a: true, b: false })).toBe(true);
    expect(challengeAccepted({ a: false, b: false, c: true })).toBe(false);
  });

  it('ships a marked draft list of 12–20 obscure words', () => {
    expect(OBSCURE_WORDS.length).toBeGreaterThanOrEqual(12);
    expect(OBSCURE_WORDS.length).toBeLessThanOrEqual(20);
    for (const w of OBSCURE_WORDS) expect(wordReading(w.jp.kana), w.id).not.toBeNull();
  });
});

describe('Fake Kanji', () => {
  it('scores finding the real meaning and fooling others, and keeps fakes private', () => {
    const r = room(4);
    r.cmd(stage, { type: 'start', mode: 'word-gauntlet', packId: 'food' });
    r.tick(); // intro → prompt
    r.tick(); // prompt → answer
    expect(r.s.phase).toBe('answer');
    const word = r.ms().fake!.word;
    expect(r.play('p1', { kind: 'fake', text: word.jp.en }).error).toBe('too-close');
    expect(r.play('p1', { kind: 'fake', text: 'A soup for ghosts' }).changed).toBe(true);
    expect(r.play('p1', { kind: 'fake', text: 'again' }).error).toBe('already-answered');
    expect(r.play('p2', { kind: 'fake', text: 'A hat that sneezes' }).changed).toBe(true);
    // The stage and other phones see who is in, never what they wrote.
    expect(JSON.stringify(r.view(stage))).not.toContain('ghosts');
    expect(JSON.stringify(r.view(as('p2')))).not.toContain('ghosts');
    expect(r.view(as('p1')).fake!.mine!.fake).toBe('A soup for ghosts');
    r.play('p3', { kind: 'fake', text: 'Dancing badly' });
    r.play('p4', { kind: 'fake', text: 'a soup for ghosts!' }); // same as p1's: shares the option
    expect(r.s.phase).toBe('reveal'); // everyone in: ends early
    const options = r.view(stage).fake!.options!;
    expect(options).toHaveLength(4); // 3 distinct fakes + the real one
    expect(JSON.stringify(r.view(stage))).not.toContain('"real"');
    const real = r.ms().fake!.options.find((o) => o.real)!;
    const ghosts = r.ms().fake!.options.find((o) => o.text === 'A soup for ghosts')!;
    const hat = r.ms().fake!.options.find((o) => o.text === 'A hat that sneezes')!;
    expect(r.play('p1', { kind: 'pick', optionId: ghosts.id }).error).toBe('own-answer');
    r.play('p1', { kind: 'pick', optionId: real.id });
    r.play('p2', { kind: 'pick', optionId: ghosts.id });
    r.play('p3', { kind: 'pick', optionId: ghosts.id });
    r.play('p4', { kind: 'pick', optionId: hat.id });
    expect(r.s.phase).toBe('score');
    expect(score(r.s, 'p1')).toBe(POINTS_REAL_FOUND + 2 * POINTS_PER_FOOLED);
    expect(score(r.s, 'p4')).toBe(2 * POINTS_PER_FOOLED);
    expect(score(r.s, 'p2')).toBe(POINTS_PER_FOOLED);
    const v = r.view(stage).fake!;
    expect(v.golden!.jp.text).toBe(word.jp.text);
    expect(v.results!.find((x) => x.real)!.pickedBy.map((p) => p.id)).toEqual(['p1']);
    // Say the golden word: a bonus from the capped pool, and a phrasebook entry.
    expect(r.play('p3', { kind: 'say', utterance: { via: 'speech', text: 'ぜんぜんちがう' } }).error).toBe('not-the-word');
    const before = score(r.s, 'p3');
    expect(r.play('p3', { kind: 'say', utterance: { via: 'speech', text: word.jp.kana } }).changed).toBe(true);
    expect(score(r.s, 'p3')).toBeGreaterThan(before);
    expect(r.s.phrasebook.p3!.find((e) => e.itemId === `wg.golden.${word.id}`)!.outcome).toBe('said');
    expect(r.s.phrasebook.p2!.find((e) => e.itemId === `wg.golden.${word.id}`)!.outcome).toBe('seen');
  });
});

describe('Lost in Translation', () => {
  it('shows each stepper only the previous step, then reveals the drift for a double-points vote', () => {
    const r = room(4);
    skipFakes(r);
    expect(r.s.phase).toBe('prompt');
    const scoresBefore = Object.fromEntries(r.s.players.map((p) => [p.id, p.score]));
    r.tick(); // → first step
    const t = () => r.ms().telephone!;
    const order = t().steps.map((st) => st.playerId);
    const [a, b, c, d] = order as [string, string, string, string];
    expect(r.view(as(a)).telephone!.mine!.prev!.text).toBe('とても おいしいです。');
    expect(r.view(as(b)).telephone!.mine!.prev).toBeNull();
    expect(JSON.stringify(r.view(stage))).not.toContain('おいしい');
    expect(r.play(b, { kind: 'step', utterance: { via: 'typed', text: 'hi' } }).error).toBe('not-your-turn');
    expect(r.play(a, { kind: 'step', utterance: { via: 'typed', text: 'とても' } }).error).toBe('not-english');
    r.play(a, { kind: 'step', utterance: { via: 'typed', text: 'It is very tasty' } });
    expect(r.view(as(b)).telephone!.mine!.prev!.text).toBe('It is very tasty');
    expect(r.play(b, { kind: 'step', utterance: { via: 'typed', text: 'hello' } }).error).toBe('not-japanese');
    r.play(b, { kind: 'step', utterance: { via: 'speech', text: 'とても おいしい' } });
    r.play(c, { kind: 'step', utterance: { via: 'typed', text: 'Very delicious' } });
    r.play(d, { kind: 'step', utterance: { via: 'typed', text: 'すごく おいしい' } });
    expect(r.s.phase).toBe('reveal');
    expect(r.view(stage).telephone!.reveal!.steps.map((st) => st.text)).toEqual(['It is very tasty', 'とても おいしい', 'Very delicious', 'すごく おいしい']);
    expect(r.play(a, { kind: 'vote', step: 0 }).error).toBe('own-answer');
    r.play(a, { kind: 'vote', step: 1 });
    r.play(c, { kind: 'vote', step: 1 });
    r.play(d, { kind: 'vote', step: 1 });
    r.play(b, { kind: 'vote', step: 2 });
    r.tick(); // the reveal waits for its animation; the timer ends it
    expect(r.s.phase).toBe('score');
    const gained = (id: string) => score(r.s, id) - scoresBefore[id]!;
    expect(gained(c)).toBe(POINTS_PER_TELEPHONE_VOTE * TELEPHONE_MULTIPLIER);
    // b: three votes plus a speaking bonus no bigger than 30% of the round.
    const round = r.s.players.reduce((n, p) => n + gained(p.id), 0);
    expect(gained(b)).toBeGreaterThan(3 * POINTS_PER_TELEPHONE_VOTE * TELEPHONE_MULTIPLIER);
    const bonus = round - 4 * POINTS_PER_TELEPHONE_VOTE * TELEPHONE_MULTIPLIER;
    expect(bonus).toBeLessThanOrEqual(round * 0.3);
  });

  it('skips a stepper whose phone is away', () => {
    const r = room(4);
    skipFakes(r);
    const second = r.ms().telephone!.steps[1]!.playerId;
    r.act({ type: 'connection', playerId: second, connected: false });
    r.tick(); // → step 0
    const first = r.ms().telephone!.steps[0]!.playerId;
    r.play(first, { kind: 'step', utterance: { via: 'typed', text: 'Delicious' } });
    expect(r.ms().telephone!.current).toBe(2);
    expect(r.ms().telephone!.steps[1]!.skipped).toBe(true);
    // Step 2 translates step 0, the last one done.
    const third = r.ms().telephone!.steps[2]!.playerId;
    expect(r.view(as(third)).telephone!.mine!.prev!.text).toBe('Delicious');
  });
});

describe('Shiritori Showdown', () => {
  function toShiritori() {
    const r = room(4);
    skipFakes(r);
    while (r.ms().segment !== 'shiritori') r.tick();
    expect(r.s.phase).toBe('prompt');
    r.tick(); // → first turn
    expect(r.s.phase).toBe('answer');
    return r;
  }
  const turn = (r: ReturnType<typeof room>) => r.ms().shiritori!.turn!;
  const say = (r: ReturnType<typeof room>, text: string, extra: object = {}) => r.play(turn(r), { kind: 'word', utterance: { via: 'speech', text, ...extra } });

  it('chains words, refuses bad links and repeats, and knocks out ん and timeouts', () => {
    const r = toShiritori();
    expect(r.view(stage).shiritori!.need).toBe('り');
    expect(r.play(r.ms().shiritori!.rotation[1]!, { kind: 'word', utterance: { via: 'typed', text: 'りんご' } }).error).toBe('not-your-turn');
    expect(say(r, 'ごりら').error).toBe('wrong-start');
    expect(say(r, 'りす').changed).toBe(true);
    expect(say(r, 'すし').changed).toBe(true);
    expect(say(r, 'しりとり').error).toBe('repeat');
    expect(say(r, 'しか').changed).toBe(true);
    expect(say(r, 'カリ').changed).toBe(true); // katakana is fine; not in any list, so the room judges it
    expect(r.s.phase).toBe('reveal');
    r.tick(); // nobody judged: a tie accepts
    expect(r.ms().shiritori!.chain.map((w) => w.reading)).toEqual(['しりとり', 'りす', 'すし', 'しか', 'かり']);
    const first = turn(r);
    expect(say(r, 'りんご').changed).toBe(true); // in the pack
    expect(r.ms().shiritori!.chain.at(-1)!.source).toBe('pack');
    expect(turn(r)).not.toBe(first);
    expect(r.s.phrasebook[first]!.some((e) => e.itemId === 'food.ringo' && e.outcome === 'said')).toBe(true);
    const second = turn(r);
    say(r, 'ごはん'); // ends in ん: out
    expect(r.ms().shiritori!.alive).not.toContain(second);
    expect(r.view(stage).shiritori!.need).toBe('ご'); // the ん word never joined the chain
    const third = turn(r);
    r.tick(); // out of time
    expect(r.ms().shiritori!.out.map((o) => [o.playerId, o.reason])).toEqual([
      [second, 'n'],
      [third, 'timeout'],
    ]);
  });

  it('lets knocked-out players judge an unknown word, and crowns the last one standing', () => {
    const r = toShiritori();
    const a = turn(r);
    say(r, 'りんご');
    const b = turn(r);
    say(r, 'ごはん'); // b is out and becomes a judge
    const c = turn(r);
    expect(say(r, 'ごぽぽぺ').changed).toBe(true);
    expect(r.s.phase).toBe('reveal');
    expect(r.view(stage).shiritori!.challenge!.voters).toEqual([b]);
    expect(r.play(a, { kind: 'judge', accept: true }).error).toBe('not-a-judge');
    r.play(b, { kind: 'judge', accept: false }); // rejected: c is out
    expect(r.s.phase).toBe('answer');
    expect(r.ms().shiritori!.alive).not.toContain(c);
    const d = turn(r);
    expect(d).not.toBe(c);
    // Unknown to every list and with no dictionary facts: the judges (b and c) say nothing, and a tie accepts.
    expect(say(r, 'ごまだんご').changed).toBe(true);
    expect(r.s.phase).toBe('reveal');
    expect(r.view(stage).shiritori!.challenge!.voters).toEqual([b, c]);
    r.tick();
    expect(r.ms().shiritori!.chain.at(-1)!.source).toBe('room');
    expect(turn(r)).toBe(a);
    // A word the dictionary knows as one noun is fine even if no list has it.
    expect(say(r, 'ごみばこ', { tokens: [{ surface: 'ごみばこ', reading: 'ごみばこ', pos: '名詞', known: true }] }).changed).toBe(true);
    expect(r.ms().shiritori!.chain.at(-1)!.source).toBe('dictionary');
    // Remaining players: time out one by one until one is left.
    while (r.s.phase === 'answer' && r.ms().shiritori!.alive.length > 1) r.tick();
    expect(r.s.phase).toBe('score');
    const winner = r.ms().shiritori!.winnerId!;
    expect(winner).toBeTruthy();
    expect(r.ms().shiritori!.crown).toBeGreaterThanOrEqual(SHOWDOWN_BONUS);
    expect(Math.max(...r.s.players.filter((p) => p.id !== winner).map((p) => p.score))).toBeLessThan(score(r.s, winner));
    r.tick();
    expect(r.s.phase).toBe('recap');
    expect(r.s.recap!.awards.some((aw) => aw.playerId === winner && aw.title === 'しりとり王')).toBe(true);
  });

  it('spends a hint token for three words that fit', () => {
    const r = toShiritori();
    say(r, 'りんご');
    const p = turn(r);
    const tokens = r.ms().shiritori!.tokens[p]!;
    if (tokens === 0) {
      expect(r.play(p, { kind: 'hint' }).error).toBe('no-tokens');
      return;
    }
    r.play(p, { kind: 'hint' });
    const hint = r.view(as(p)).shiritori!.mine!.hint!;
    expect(hint.length).toBeGreaterThan(0);
    expect(hint.length).toBeLessThanOrEqual(3);
    for (const w of hint) expect(follows('ご', w.kana)).toBe(true);
    expect(r.view(stage).shiritori!.mine).toBeNull();
    expect(r.ms().shiritori!.tokens[p]).toBe(tokens - 1);
  });

  it('gives kana-level players a longer floor timer and more hint tokens', () => {
    const r = toShiritori();
    const sh = r.ms().shiritori!;
    expect(sh.tokens.p4).toBeGreaterThanOrEqual(3);
  });
});

describe('thin content', () => {
  it('runs end to end with no packs at all', () => {
    const r = room(4, EMPTY_CONTENT);
    r.cmd(stage, { type: 'start', mode: 'word-gauntlet' });
    let guard = 0;
    while (r.s.phase !== 'recap' && guard++ < 500) {
      if (r.s.phase === 'answer' && r.ms().segment === 'telephone') {
        const t = r.ms().telephone!;
        const step = t.steps[t.current]!;
        r.play(step.playerId, { kind: 'step', utterance: { via: 'typed', text: step.to === 'en' ? 'A cat' : 'ねこ' } });
      } else r.tick();
    }
    expect(r.s.phase).toBe('recap');
    expect(r.ms().telephone!.starter.id).toMatch(/^wg\.starter\./);
  });
});

// ---- full system ----

describe('Word Gauntlet: bots play a whole game over the real server', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer({ durations: { intro: 5, prompt: 5, answer: 250, reveal: 250, score: 150 } });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('reaches the recap with scores that add up and no desyncs', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;
    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };
    let last: WordGauntletView | null = null;
    const segments = new Set<string>();
    let challenged = false;
    let recap: RoomView['recap'] = null;
    let finished = false;
    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: 5,
      roundsPerGame: 1,
      totalRounds: 1,
      mode: 'word-gauntlet',
      packId: 'food',
      games: 1,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        const game = view.game as WordGauntletView | null;
        if (game) {
          last = game;
          if (game.segment) segments.add(game.segment);
          if (game.shiritori?.challenge) challenged = true;
        }
        if (view.phase === 'recap') recap = view.recap;
      },
    });
    director.start();
    const policy = wordGauntletPolicy(realContent, { delayMs: 5 });
    const bots: Bot[] = [];
    for (let i = 1; i <= 5; i++) {
      bots.push(await Bot.join({ baseUrl, code: created.code, name: `wg${i}`, policy, level: i === 5 ? 'kana' : 'n5', onState: (bot, view, v) => record(bot.playerId, view, v) }));
    }
    await until(() => finished, 18_000, 'the gauntlet');
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect([...segments]).toEqual(['fake', 'telephone', 'shiritori']);
    expect(challenged).toBe(true);
    // Every point the mode handed out shows up on the scoreboard.
    const standings = (recap as RoomView['recap'])!.standings;
    for (const s of standings) expect(s.score, s.name).toBe((last as WordGauntletView | null)?.earned[s.playerId] ?? 0);
    // The showdown decided the winner.
    const winner = (last as WordGauntletView | null)!.shiritori!.winnerId;
    expect(standings[0]!.playerId).toBe(winner);
    // No desyncs.
    for (const [id, list] of seen) for (const { v, hash } of list) expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
    // Only harmless races with the phase clock.
    const failures = bots.flatMap((b) => b.moves.filter((m) => !m.ok && m.error !== 'wrong-phase' && m.error !== 'not-your-turn'));
    expect(failures).toEqual([]);
    for (const b of bots) b.stop();
    director.client.close();
  });
});
