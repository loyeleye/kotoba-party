import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/clock.js';
import { createJudge, judgeOffline, type JudgeItem } from '../judge.js';
import { LlmBudget, LlmUnavailable, ScriptedLlm } from '../llm.js';

const konbini: JudgeItem = {
  id: 'konbini-350',
  prompt: { text: 'いくらですか。', kana: 'いくらですか。', en: 'How much is it?' },
  accepted: [{ text: '三百五十円です', kana: 'さんびゃくごじゅうえんです', en: "It's 350 yen" }],
};
const student: JudgeItem = {
  id: 'intro',
  prompt: { text: 'あなたは？', kana: 'あなたは？', en: 'And you?' },
  accepted: [{ text: '私は学生です', kana: 'わたしはがくせいです', en: "I'm a student" }],
};
const aunt: JudgeItem = {
  id: 'family',
  prompt: { text: 'だれですか。', kana: 'だれですか。', en: 'Who is it?' },
  accepted: [{ text: 'おばあさんです', kana: 'おばあさんです', en: "It's my grandmother" }],
};
const oogiri: JudgeItem = {
  id: 'cat-job',
  prompt: { text: 'ねこの ひみつの しごとは ＿＿＿ です。', kana: 'ねこの ひみつの しごとは ＿＿＿ です。', en: "The cat's secret job is ___." },
  points: [{ id: 'past', t: 'Uses a verb in the past polite form ました', keys: ['ました'] }],
};

describe('offline judge', () => {
  it('accepts the reading, the kanji, digits and kana alike', () => {
    for (const a of ['さんびゃくごじゅうえんです', '三百五十円です', '350円です', 'サンビャクゴジュウエンです。']) {
      expect(judgeOffline(a, konbini)).toMatchObject({ acceptable: true, match: 'exact', bonus: 1 });
    }
  });

  it('accepts は written わ, with a private tip', () => {
    const v = judgeOffline('わたしわ がくせいです', student);
    expect(v).toMatchObject({ acceptable: true, match: 'equivalent' });
    expect(v.tip).toMatch(/は/);
  });

  it('accepts dropping a softener', () => {
    expect(judgeOffline('わたしはがくせいですよ', student).acceptable).toBe(true);
  });

  it('never waves a length slip through', () => {
    const v = judgeOffline('おばさんです', aunt);
    expect(v).toMatchObject({ acceptable: false, match: 'length' });
    expect(v.clue).toMatch(/long sound/);
  });

  it('marks a near miss unsure and a wrong answer wrong', () => {
    expect(judgeOffline('さんびゃくごじゅうえんでう', konbini)).toMatchObject({ acceptable: null, match: 'close' });
    expect(judgeOffline('ねこです', konbini)).toMatchObject({ acceptable: false, match: 'none' });
  });

  it('checks open answers by key terms only', () => {
    const v = judgeOffline('ねこは ぎんこうで はたらきました', oogiri);
    expect(v.acceptable).toBeNull();
    expect(v.points).toEqual([{ id: 'past', made: true, ev: 'ました' }]);
  });
});

const llmVerdict = (over: Record<string, unknown> = {}) => ({
  acceptable: true,
  confident: true,
  natural: { text: 'ねこは よる ぎんこうで はたらいています。', kana: 'ねこは よる ぎんこうで はたらいています。', en: 'The cat works at a bank at night.' },
  tip: 'て-form + います says what someone is doing now.',
  clue: '',
  points: [{ n: 1, made: true, quote: 'はたらきました' }],
  japanese: 'full',
  ...over,
});

describe('judge with an LLM', () => {
  it('skips the LLM for an exact match', async () => {
    const llm = new ScriptedLlm(() => llmVerdict());
    const v = await createJudge({ llm }).judge({ answer: '350円です', item: konbini, level: 'n5' });
    expect(v.source).toBe('offline');
    expect(llm.calls).toHaveLength(0);
  });

  it('asks the LLM about open answers and keeps only quoted points', async () => {
    const llm = new ScriptedLlm(() => llmVerdict({ points: [{ n: 1, made: true, quote: 'not in the answer' }] }));
    const v = await createJudge({ llm }).judge({ answer: 'ねこは ぎんこうで はたらく', item: oogiri, level: 'n5' });
    expect(v).toMatchObject({ acceptable: true, source: 'llm', bonus: 1 });
    expect(v.points[0]!.made).toBe(false);
    expect(v.natural?.text).toContain('ぎんこう');
  });

  it('keeps a length slip wrong even if the model is lenient', async () => {
    const llm = new ScriptedLlm(() => llmVerdict({ acceptable: true }));
    const v = await createJudge({ llm }).judge({ answer: 'おばさんです', item: aunt, level: 'n5' });
    expect(v.acceptable).toBe(false);
  });

  it('drops the natural version when the model is unsure or the reading has kanji', async () => {
    const unsure = new ScriptedLlm(() => llmVerdict({ confident: false }));
    expect((await createJudge({ llm: unsure }).judge({ answer: 'ねこ ぎんこう', item: oogiri, level: 'n5' })).natural).toBeUndefined();
    const kanji = new ScriptedLlm(() => llmVerdict({ natural: { text: '銀行', kana: '銀行', en: 'bank' } }));
    expect((await createJudge({ llm: kanji }).judge({ answer: 'ねこ ぎんこう', item: oogiri, level: 'n5' })).natural).toBeUndefined();
  });

  it('falls back to the offline verdict at the deadline', async () => {
    const clock = new ManualClock();
    let release!: () => void;
    const llm = new ScriptedLlm(() => llmVerdict(), 1, () => new Promise<void>((r) => (release = r)));
    const p = createJudge({ llm, clock, timeoutMs: 3000 }).judge({ answer: 'ねこです', item: konbini, level: 'n5' });
    await Promise.resolve();
    clock.advance(3000);
    const v = await p;
    expect(v).toMatchObject({ source: 'offline', acceptable: false });
    release();
  });

  it('falls back when the LLM fails or the budget is spent', async () => {
    const failing = new ScriptedLlm(() => {
      throw new LlmUnavailable('api', '500');
    });
    expect((await createJudge({ llm: failing }).judge({ answer: 'ねこです', item: konbini, level: 'n5' })).source).toBe('offline');
    const llm = new ScriptedLlm(() => llmVerdict());
    const budget = new LlmBudget(0.0005);
    budget.record('host', 0.001);
    expect((await createJudge({ llm }).judge({ answer: 'ねこです', item: konbini, level: 'n5', budget })).source).toBe('offline');
    expect(llm.calls).toHaveLength(0);
  });
});
