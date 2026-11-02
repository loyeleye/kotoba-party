import { describe, expect, it } from 'vitest';
import { createGame, apply, type GameAction, type GameContext } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import type { Audience, Command } from '../shared/src/protocol.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { viewFor } from '../shared/src/view.js';
import { framesOf } from '../shared/src/japanese/frames.js';
import { GOALS, needIds } from '../shared/src/path.js';
import { SENTENCE_MAX_TURNS, SENTENCE_N3_BONUS, SENTENCE_POINTS, sentenceLink, type WordGauntletState, type WordGauntletView } from '../shared/src/modes/wordGauntlet/wordGauntlet.js';
import { fillModel, linkOf, modelsFor, SENTENCE_CARD_BY_FRAME, SENTENCE_CARDS, startsWithLink } from '../shared/src/modes/wordGauntlet/sentences.js';
import { GREEN_CAR_CHEEKY_WORDS, GREEN_CAR_WORDS, fakeWordPool } from '../shared/src/modes/wordGauntlet/words.js';
import type { Level } from '../content/src/types.js';

let ids = 0;
const now = 1_000_000;
const content: ContentLibrary = EMPTY_CONTENT;
const gctx = (): GameContext => ({ now, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random: () => 0 });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

/** A room at these levels, run on to round 3. An all-N4+ room rides in the Green Car unless `greenCar` is false. */
function room(levels: Level[], greenCar = true, audience: Audience = 'family') {
  const s = createGame('BCDF');
  const act = (a: GameAction) => apply(s, a, gctx());
  const cmd = (actor: ReturnType<typeof as> | typeof stage, command: CommandBody) => apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, gctx());
  const play = (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move });
  let ticks = 0;
  const tick = () => {
    if (++ticks > 400) throw new Error(`stuck in ${s.phase} (${(s.modeState as WordGauntletState | null)?.segment})`);
    return act({ type: 'timeout', phaseSeq: s.phaseSeq });
  };
  const ms = () => s.modeState as WordGauntletState;
  const view = (viewer: ReturnType<typeof as> | typeof stage) => viewFor(s, viewer, content).game as WordGauntletView;
  levels.forEach((level, i) => {
    act({ type: 'join', playerId: `p${i + 1}`, name: `Player${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  cmd(stage, { type: 'settings', greenCar, audience });
  cmd(stage, { type: 'start', mode: 'word-gauntlet' });
  const fakes = new Set<string>();
  while (ms().segment !== 'sentences' && ms().segment !== 'shiritori' && s.phase !== 'recap') {
    if (ms().fake) fakes.add(ms().fake!.word.id);
    tick();
  }
  return { s, play, tick, ms, view, fakes };
}

/** Runs on to the first sentence turn. */
function toTurn(r: ReturnType<typeof room>) {
  while (r.s.phase !== 'answer') {
    if (r.s.phase === 'recap') throw new Error('no turn left');
    r.tick();
  }
  return r.ms().sentences!.turns[r.ms().sentences!.current]!;
}

const say = (text: string) => ({ via: 'speech', text });

/** A sentence for this card that starts the way the chain asks. */
function lineFor(r: ReturnType<typeof room>, frame: string): string {
  const st = r.ms().sentences!;
  const link = sentenceLink(st);
  const noun = link.word ?? `${link.kana}かな`;
  return fillModel(SENTENCE_CARD_BY_FRAME[frame]!.models[0]!, { kana: noun, en: noun }).text;
}

describe('Sentence Shiritori content', () => {
  it('asks only for frames a path goal requires, and every model line carries its frame in every audience', () => {
    const required = new Set(GOALS.flatMap((g) => g.need.flatMap((n) => [...needIds(n)])));
    for (const card of SENTENCE_CARDS) {
      expect(required.has(card.frame), card.frame).toBe(true);
      for (const audience of ['kids', 'family', 'cheeky'] as const) {
        const models = modelsFor(card, audience);
        expect(models.length, `${card.frame} ${audience}`).toBeGreaterThan(0);
        for (const m of models)
          for (const noun of ['ねこ', 'ケーキ', 'せんせい']) {
            const line = fillModel(m, { kana: noun, en: noun }).text;
            expect(framesOf({ text: line, kana: line }, undefined, { keepHidden: true }), line).toContain(card.frame);
            expect(line.startsWith(noun)).toBe(true);
          }
      }
    }
    // Both levels, so an N3 seat can alternate and an N4 seat can stretch.
    expect(SENTENCE_CARDS.filter((c) => c.level === 'n3').length).toBeGreaterThanOrEqual(4);
    expect(SENTENCE_CARDS.filter((c) => c.level === 'n4').length).toBeGreaterThanOrEqual(4);
    // Cheeky lines never reach Kids or Family rooms.
    expect(SENTENCE_CARDS.flatMap((c) => modelsFor(c, 'family')).some((m) => m.audience === 'cheeky')).toBe(false);
  });

  it('links on the last word or the last kana', () => {
    const link = linkOf('ねこを みる たびに、 わらって しまう。');
    expect(link.word).toBe('しまう');
    expect(link.kana).toBe('う');
    expect(startsWithLink('しまうまっぽい', link)).toBe(true);
    expect(startsWithLink('うさぎは', link)).toBe(true);
    expect(startsWithLink('ねこは', link)).toBe(false);
    // A reading with no spaces has no last word: the last kana only.
    expect(linkOf('ねこをみるたびにわらってしまう').word).toBeNull();
    // ん falls back to the kana before it.
    expect(linkOf('もう いりません').kana).toBe('せ');
  });

  it('deals N3 kanji words in the Green Car, Kids from the gentle list, Cheeky its own first', () => {
    expect(fakeWordPool('kids', () => 0, 20, true).every((w) => GREEN_CAR_WORDS.includes(w) && w.kids)).toBe(true);
    expect(GREEN_CAR_CHEEKY_WORDS).toContain(fakeWordPool('cheeky', () => 0, 1, true)[0]);
    expect(fakeWordPool('family', () => 0, 30, true).every((w) => GREEN_CAR_WORDS.includes(w))).toBe(true);
  });
});

describe('Word Gauntlet in the Green Car', () => {
  it('plays one N3 kanji word, then Sentence Shiritori as round 3', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    expect(r.fakes.size).toBe(1);
    expect(GREEN_CAR_WORDS.some((w) => r.fakes.has(w.id))).toBe(true);
    expect(r.ms().segment).toBe('sentences');
    expect(r.ms().sentences!.turns.length).toBe(SENTENCE_MAX_TURNS);
  });

  it('keeps the shiritori showdown with the Green Car off', () => {
    const r = room(['n3', 'n4', 'n3', 'n4'], false);
    expect(r.ms().segment).toBe('shiritori');
    expect(r.fakes.size).toBe(2);
  });

  it('accepts a sentence that starts from the link and carries the card frame, and puts it in the phrasebook', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    const turn = toTurn(r);
    expect(turn.card).toBeTruthy();
    const pid = turn.playerId;
    const before = r.s.players.find((p) => p.id === pid)!.score;
    // Wrong start, then no frame: free retries.
    expect(r.play(pid, { kind: 'sentence', utterance: say('かめは おいしそうです。') }).error).toBe('wrong-start');
    expect(r.play(pid, { kind: 'sentence', utterance: say('しりとりは たのしい。') }).error).toBe('no-frame');
    const line = lineFor(r, turn.card!);
    expect(r.play(pid, { kind: 'sentence', utterance: say(line) }).error).toBeUndefined();
    expect(turn.frame).toBe(turn.card);
    const n3 = SENTENCE_CARD_BY_FRAME[turn.card!]!.level === 'n3';
    expect(r.s.players.find((p) => p.id === pid)!.score - before).toBeGreaterThanOrEqual(SENTENCE_POINTS + (n3 ? SENTENCE_N3_BONUS : 0));
    const entry = (r.s.phrasebook[pid] ?? []).find((e) => e.itemId === `wg.sentence.${turn.card}`);
    expect(entry).toMatchObject({ text: line, outcome: 'said', recall: 'memory' });
    // The next sentence links from this one.
    expect(r.ms().sentences!.chain.at(-1)!.text).toBe(line);
  });

  it('gives an N3 seat N3 and N4 cards in turn, and an N4 seat an N4 card with N3 stretch', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    const levels: Record<string, string[]> = {};
    for (let i = 0; i < r.ms().sentences!.turns.length; i++) {
      const turn = toTurn(r);
      const level = r.s.players.find((p) => p.id === turn.playerId)!.level;
      (levels[turn.playerId] ??= []).push(SENTENCE_CARD_BY_FRAME[turn.card!]!.level);
      if (level === 'n4') {
        expect(SENTENCE_CARD_BY_FRAME[turn.stretch!]!.level).toBe('n3');
        expect(r.view(as(turn.playerId)).sentences!.mine!.stretch).toMatchObject({ n3: true });
      } else expect(turn.stretch).toBeNull();
      r.tick();
    }
    expect(levels.p1).toEqual(['n3', 'n4']);
    expect(levels.p2).toEqual(['n4', 'n4']);
  });

  it('credits an N4 player who used the N3 stretch card with it', () => {
    const r = room(['n4', 'n4', 'n4', 'n4']);
    const turn = toTurn(r);
    const line = lineFor(r, turn.stretch!);
    expect(r.play(turn.playerId, { kind: 'sentence', utterance: say(line) }).error).toBeUndefined();
    expect(turn.frame).toBe(turn.stretch);
  });

  it('aims the next card away from a frame the player has just said', () => {
    const r = room(['n4', 'n4', 'n4', 'n4']);
    const first = new Map<string, string>();
    for (let i = 0; i < r.ms().sentences!.turns.length; i++) {
      const turn = toTurn(r);
      const had = first.get(turn.playerId);
      if (had) expect(turn.card).not.toBe(had);
      else {
        first.set(turn.playerId, turn.card!);
        // A sentence ends the turn at once.
        expect(r.play(turn.playerId, { kind: 'sentence', utterance: say(lineFor(r, turn.card!)) }).error).toBeUndefined();
        continue;
      }
      r.tick();
    }
  });

  it('skips a turn that runs out and keeps the link; the hint shows a line but counts as read', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    const t1 = toTurn(r);
    const link = sentenceLink(r.ms().sentences!);
    r.tick();
    expect(t1.skipped).toBe(true);
    const t2 = toTurn(r);
    expect(sentenceLink(r.ms().sentences!)).toEqual(link);
    expect(r.play(t2.playerId, { kind: 'hint' }).error).toBeUndefined();
    const hint = r.view(as(t2.playerId)).sentences!.mine!.hint!;
    expect(framesOf({ text: hint.text, kana: hint.text }, undefined, { keepHidden: true })).toContain(t2.card);
    expect(startsWithLink(hint.text, link)).toBe(true);
    expect(r.play(t2.playerId, { kind: 'sentence', utterance: say(hint.text) }).error).toBeUndefined();
    expect((r.s.phrasebook[t2.playerId] ?? []).find((e) => e.itemId.startsWith('wg.sentence.'))?.recall).toBe('read');
  });

  it('votes for the best sentence (not your own) and pays for it', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    const t = toTurn(r);
    r.play(t.playerId, { kind: 'sentence', utterance: say(lineFor(r, t.card!)) });
    while (r.s.phase !== 'reveal') r.tick();
    expect(r.play(t.playerId, { kind: 'vote', step: 1 }).error).toBe('own-answer');
    expect(r.play(t.playerId === 'p1' ? 'p2' : 'p1', { kind: 'vote', step: 0 }).error).toBe('unknown-answer');
    expect(r.play(t.playerId === 'p1' ? 'p2' : 'p1', { kind: 'vote', step: 1 }).error).toBeUndefined();
    while (r.s.phase === 'reveal') r.tick();
    expect(r.view(stage).sentences!.votes![1]).toBe(1);
    expect(r.ms().stats.sentenceVotes?.[t.playerId]).toBe(1);
    while (r.s.phase !== 'recap') r.tick();
  });
});
