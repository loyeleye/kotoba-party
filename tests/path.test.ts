// The learning path, v2 (shared/src/path.ts, docs/progressive-learning.md): 24 goals on three lines, met by
// frames said from memory (3 says, 2 fillers, 2 days at least 3 apart, one in a game), a 21-day re-check,
// and the suggestion the lobby strip shows.

import { describe, expect, it } from 'vitest';
import { kana } from '../content/src/kana/kana.js';
import type { PhraseEntry } from '../shared/src/modes/mode.js';
import { MODES } from '../shared/src/modes/registry.js';
import { currentLine, frameReady, frameText, GOAL_FRAMES, GOALS, KANA_TARGET, LINES, markPath, missingFrames, pathStatus, suggest } from '../shared/src/path.js';
import { addGame, duePhrases, emptyProgress, frameRule, MAX_PHRASES, recallOf, reviewPhrase, type GameResult, type Progress } from '../shared/src/progress.js';
import type { ModeId } from '../shared/src/protocol.js';
import { tonightFrames } from '../controller/src/path.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 12);
const room = (players: number, speakers = players) => ({ players, speakers });

const said = (itemId: string, text: string, over: Partial<PhraseEntry> = {}): PhraseEntry => ({ itemId, text, kana: text, en: '', outcome: 'said', ...over });
const game = (at: number, phrases: PhraseEntry[], over: Partial<GameResult> = {}): GameResult => ({ mode: 'last-train', at, score: 100, place: 1, players: 3, coop: false, awards: [], cards: [], phrases, ...over });

/** Plays a game and saves it the way the account service does. */
function play(p: Progress, at: number, phrases: PhraseEntry[], over: Partial<GameResult> = {}): string[] {
  addGame(p, game(at, phrases, over), 0);
  return markPath(p, at);
}

const status = (p: Progress, now = T0) => pathStatus(p, now);
const goal = (p: Progress, id: string, now = T0) => status(p, now).goals.find((g) => g.id === id)!;
const frame = (p: Progress, id: string, now = T0) => status(p, now).frames.find((f) => f.id === id)!;

/** Two ＿です phrases said on day 0 and again on day 3: meets the ＿です frame (K4). */
function meetDesu(p: Progress): void {
  play(p, T0, [said('a', 'アキです。'), said('b', 'がくせいです。')]);
  play(p, T0 + 3 * DAY, [said('a', 'アキです。')]);
}

describe('the goals', () => {
  it('are the tiers doc’s 24: 4 on the Kana Line, 10 on the Local Line, 10 on the Express Line', () => {
    expect(GOALS).toHaveLength(24);
    expect(LINES.map((l) => GOALS.filter((g) => g.line === l.id).length)).toEqual([4, 10, 10]);
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(24);
    for (const g of GOALS) for (const m of g.games) expect(MODES[m], `${g.id} ${m}`).toBeDefined();
  });

  it('give every frame they name a label and hand-written rōmaji', () => {
    for (const id of GOAL_FRAMES) {
      const t = frameText(id);
      expect(t.romaji, id).not.toBe(id);
      expect(t.ja, id).toMatch(/[ぁ-んァ-ン＿]/);
    }
  });

  it('hide only the gap (4.7) and wait for frames.ts on the frames it doesn’t have yet', () => {
    expect(GOALS.filter((g) => g.gap).map((g) => g.id)).toEqual(['4.7']);
    // Today's frames cover K4, 5.1, 5.4 (with ＿に ＿が あります standing in), 5.5, 5.6, 5.7, 5.9 and 4.2.
    for (const id of ['K4', '5.1', '5.4', '5.5', '5.6', '5.7', '5.9', '4.2']) expect(missingFrames(GOALS.find((g) => g.id === id)!), id).toEqual([]);
    for (const g of GOALS) for (const id of missingFrames(g)) expect(frameReady(id)).toBe(false);
  });

  it('keep the old path’s step 7 and 8 frames on a goal (#129)', () => {
    const named = new Set(GOALS.flatMap((g) => [...g.need.flat(), ...g.also]));
    for (const id of ['ka', 'sou', 'nan', 'masen-ka', 'te-mo-ii']) expect(named.has(id), id).toBe(true);
  });
});

describe('when a frame is met', () => {
  it('needs 3 says, 2 fillers, 2 days at least 3 apart, and a game', () => {
    const p = emptyProgress();
    play(p, T0, [said('a', 'アキです。'), said('b', 'がくせいです。')]);
    expect(frame(p, 'desu')).toMatchObject({ met: false, rule: { says: 2, fillers: 2, days: 1, spaced: false, inGame: true } });
    // The next day is too soon to count as spaced.
    play(p, T0 + DAY, [said('a', 'アキです。')]);
    expect(frame(p, 'desu').met).toBe(false);
    play(p, T0 + 3 * DAY, [said('b', 'がくせいです。')]);
    expect(frame(p, 'desu', T0 + 3 * DAY)).toMatchObject({ met: true, progress: 1, recheck: 'waiting' });
  });

  it('counts at most 2 says a day', () => {
    const p = emptyProgress();
    play(p, T0, [said('a', 'アキです。'), said('b', 'がくせいです。'), said('c', 'ねこです。')]);
    expect(frameRule(Object.values(p.phrases!)).says).toBe(2);
  });

  it('needs 2 different fillers', () => {
    const p = emptyProgress();
    for (const d of [0, 3, 6]) play(p, T0 + d * DAY, [said('a', 'アキです。')]);
    expect(frame(p, 'desu', T0 + 6 * DAY)).toMatchObject({ met: false, rule: { says: 3, fillers: 1, spaced: true } });
  });

  it('needs one day in a game, not only phone reviews', () => {
    const p = emptyProgress();
    // Seen in a game (not said), then known twice in reviews 3 days apart.
    play(p, T0, [said('a', 'アキです。', { outcome: 'seen' }), said('b', 'がくせいです。', { outcome: 'seen' })]);
    reviewPhrase(p, 'a', true, T0, 0);
    reviewPhrase(p, 'b', true, T0, 0);
    reviewPhrase(p, 'a', true, T0 + 3 * DAY, 0);
    markPath(p, T0 + 3 * DAY);
    expect(frame(p, 'desu', T0 + 3 * DAY)).toMatchObject({ met: false, rule: { says: 3, fillers: 2, spaced: true, inGame: false } });
  });

  it('counts only true recall: read, echoed, tile and script lines don’t', () => {
    const p = emptyProgress();
    play(p, T0, [said('a', 'アキです。', { recall: 'read' }), said('b', 'がくせいです。', { recall: 'read' })]);
    play(p, T0 + 3 * DAY, [said('c', 'ねこです。')], { mode: 'dub-club' });
    expect(frame(p, 'desu')).toMatchObject({ met: false, rule: { says: 0, fillers: 0 } });
    expect(p.phrases!['a']).toMatchObject({ recall: 'read', said: 1 });
    expect(recallOf({}, 'karaoke-duel')).toBe('read');
    expect(recallOf({}, 'oogiri')).toBe('memory');
  });
});

describe('goals and stamps', () => {
  it('stamps a goal once its required frames are met, and keeps the stamp when the phrases age out', () => {
    const p = emptyProgress();
    play(p, T0, [said('a', 'アキです。'), said('b', 'がくせいです。')]);
    expect(goal(p, 'K4').met).toBe(false);
    const fresh = play(p, T0 + 3 * DAY, [said('a', 'アキです。')]);
    expect(fresh).toContain('K4');
    expect(goal(p, 'K4', T0 + 3 * DAY)).toMatchObject({ met: true, metAt: T0 + 3 * DAY });
    // A full phrasebook pushes the old ones out; the frame and the goal stay met.
    play(p, T0 + 4 * DAY, Array.from({ length: MAX_PHRASES + 5 }, (_, i) => said(`x${i}`, `ことば${i}`, { outcome: 'seen' })));
    expect(p.phrases!['a']).toBeUndefined();
    expect(goal(p, 'K4', T0 + 4 * DAY).met).toBe(true);
    expect(frame(p, 'desu', T0 + 4 * DAY).met).toBe(true);
  });

  it('needs every required frame: 5.7 takes any question frame, plus そうです／ちがいます', () => {
    const p = emptyProgress();
    play(p, T0, [said('a', 'えきは どこですか。'), said('b', 'トイレは どこですか。'), said('c', 'はい、そうです。'), said('d', 'いいえ、ちがいます。')]);
    play(p, T0 + 3 * DAY, [said('a', 'えきは どこですか。'), said('c', 'はい、そうです。')]);
    expect(goal(p, '5.7', T0 + 3 * DAY).met).toBe(true);
    // ＿は どこですか is 5.4's too, but 5.4 also needs ＿に ＿が あります.
    expect(goal(p, '5.4', T0 + 3 * DAY)).toMatchObject({ met: false, progress: 0.5 });
  });

  it('meets a kana goal at 90% of the script, with credit from the first night', () => {
    const p = emptyProgress();
    const hira = kana.filter((k) => k.script === 'hiragana');
    const cards = (n: number) => hira.slice(0, n).map((k) => ({ itemId: k.id, char: k.char, hear: k.sound, en: k.romaji, seen: 1, recalled: 1, missed: 0 }));
    addGame(p, game(T0, [], { mode: 'kana-raid', cards: cards(20) }), 0);
    markPath(p, T0);
    expect(goal(p, 'K1').progress).toBeGreaterThan(0);
    expect(goal(p, 'K1').count).toEqual({ have: 0, need: KANA_TARGET.hiragana });
    addGame(p, game(T0 + DAY, [], { mode: 'kana-raid', cards: cards(KANA_TARGET.hiragana) }), 0);
    expect(markPath(p, T0 + DAY)).toEqual([]);
    addGame(p, game(T0 + 2 * DAY, [], { mode: 'kana-raid', cards: cards(KANA_TARGET.hiragana) }), 0);
    expect(markPath(p, T0 + 2 * DAY)).toContain('K1');
    expect(KANA_TARGET.hiragana).toBeLessThan(hira.length);
  });

  it('meets the set-phrase goal at 6 of 8, each on 2 days', () => {
    const p = emptyProgress();
    const set = ['おはようございます', 'こんにちは', 'こんばんは', 'ありがとうございます', 'すみません', 'ごめんなさい'];
    play(p, T0, set.map((s, i) => said(`s${i}`, `${s}。`)));
    expect(goal(p, 'K3').count).toEqual({ have: 0, need: 6 });
    play(p, T0 + DAY, set.map((s, i) => said(`s${i}`, `${s}。`)));
    expect(goal(p, 'K3', T0 + DAY)).toMatchObject({ met: true, count: { have: 6, need: 6 } });
  });

  it('counts kanji read from memory in Shodō and Read the Signs', () => {
    const p = emptyProgress();
    play(p, T0, [said('kj-山', '山'), said('read-the-signs.exit', '「出口」です。')], { mode: 'shodo' });
    play(p, T0 + DAY, [said('kj-山', '山'), said('read-the-signs.exit', '「出口」です。')], { mode: 'shodo' });
    const s = status(p, T0 + DAY);
    expect(s.goals.find((g) => g.id === '5.10')!.count!.have).toBeGreaterThanOrEqual(2);
    expect(s.stats.kanji).toBeGreaterThanOrEqual(2);
  });
});

describe('the 21-day re-check', () => {
  it('brings a met frame back once in the phone review; missed, it fades until said again', () => {
    const p = emptyProgress();
    meetDesu(p);
    const met = T0 + 3 * DAY;
    expect(frame(p, 'desu', met).recheck).toBe('waiting');
    const check = met + 21 * DAY;
    expect(frame(p, 'desu', check).recheck).toBe('due');
    expect(goal(p, 'K4', check).recheck).toBe('due');
    const first = duePhrases(p, check)[0]!;
    expect(['a', 'b']).toContain(first.itemId);
    reviewPhrase(p, first.itemId, false, check, 0);
    expect(frame(p, 'desu', check).recheck).toBe('fading');
    expect(goal(p, 'K4', check)).toMatchObject({ met: true, recheck: 'fading' });
    // Not in the review again just for the check.
    expect(duePhrases(p, check).filter((c) => c.itemId === first.itemId && c.due > check)).toEqual([]);
    play(p, check + DAY, [said('a', 'アキです。')]);
    expect(frame(p, 'desu', check + DAY).recheck).toBe('passed');
  });

  it('passes when known in the review', () => {
    const p = emptyProgress();
    meetDesu(p);
    const check = T0 + 24 * DAY;
    reviewPhrase(p, duePhrases(p, check)[0]!.itemId, true, check, 0);
    expect(frame(p, 'desu', check).recheck).toBe('passed');
    expect(duePhrases(p, check + DAY).some((c) => c.due > check + DAY)).toBe(false);
  });
});

describe('what to play next', () => {
  it('starts on the player’s own line: kana at the Kana level, the Local Line at N5', () => {
    const p = emptyProgress();
    expect(suggest(status(p), 'kana', room(4))).toMatchObject({ line: { id: 'kana' }, goal: { id: 'K1' }, mode: 'kana-raid', instead: false });
    expect(suggest(status(p), 'n5', room(4))).toMatchObject({ line: { id: 'local' }, goal: { id: '5.1' }, mode: 'hajimemashite' });
    expect(suggest(status(p), 'n4', room(4))!.line.id).toBe('express');
  });

  it('picks a game that fits the room, and moves on as goals are met', () => {
    const p = emptyProgress();
    // Nice to Meet You! needs 3: a pair gets Omiai for 5.1.
    expect(suggest(status(p), 'n5', room(2))).toMatchObject({ goal: { id: '5.1' }, mode: 'omiai' });
    meetDesu(p);
    expect(suggest(status(p, T0 + 3 * DAY), 'kana', room(4))!.goal.id).toBe('K1');
  });

  it('skips goals waiting on frames.ts', () => {
    const s = suggest(status(emptyProgress()), 'n5', null)!;
    expect(missingFrames(s.goal)).toEqual([]);
  });

  it('moves to the next line up once a line is cleared', () => {
    const st = status(emptyProgress());
    st.lines[0]!.cleared = true;
    expect(currentLine(st, 'kana').id).toBe('local');
  });
});

describe('the recap box', () => {
  it('lists each frame said from memory once, with how many different phrases', () => {
    const book: PhraseEntry[] = [said('a', 'すしが すきです。'), said('b', 'ねこが すきです。'), said('c', 'いぬが すきです。', { recall: 'read' }), said('d', 'コーヒーを ください。', { outcome: 'seen' })];
    expect(tonightFrames(book, 'oogiri' as ModeId)).toEqual([{ id: 'suki', phrases: 2 }]);
    expect(tonightFrames(book, 'dub-club')).toEqual([]);
  });
});
