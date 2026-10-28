import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/clock.js';
import { createHostVoice, lineProblem } from '../hostVoice.js';
import { defaultModerator } from '../moderation.js';
import { LlmBudget, ScriptedLlm } from '../llm.js';
import { SilentTts } from '../tts.js';
import type { BankLine } from '../types.js';

const lines: BankLine[] = [
  { id: 'pon.reveal_react.good.01', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'いいね！', kana: 'いいね！', en: 'Nice!' } },
  { id: 'pon.reveal_react.good.02', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'うまい！', kana: 'うまい！', en: 'Good one!' } },
  { id: 'pon.reveal_react.01', host: 'pon', event: 'reveal_react', jp: { text: 'なるほど！', kana: 'なるほど！', en: 'I see!' } },
  { id: 'pon.mic_check_ok.01', host: 'pon', event: 'mic_check_ok', slots: ['{name}'], jp: { text: '{name}さん、きこえるよ！', kana: '{name}さん、きこえるよ！', en: 'I can hear you, {name}!' } },
];
const quip = { text: 'ねこが ぎんこういん？ ぽんぽこ！', kana: 'ねこが ぎんこういん？ ぽんぽこ！', en: 'A cat bank clerk? Ponpoko!' };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('host voice', () => {
  it('voices the LLM line when it is ready by the deadline', async () => {
    const tts = new SilentTts();
    const voice = createHostVoice({ llm: new ScriptedLlm(() => quip), tts, lines });
    const line = await voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', answer: 'ぎんこういん' }).ready(2000);
    expect(line).toMatchObject({ source: 'llm', text: quip.text, kana: quip.kana });
    expect(line?.audio?.id).toBeTruthy();
    expect(tts.spoken[0]).toMatchObject({ host: 'pon', kana: quip.kana });
    expect(voice.audio(line!.audio!.id)).toBeDefined();
  });

  it('answers from the bank at the deadline when the LLM is slow, and never rejects', async () => {
    const clock = new ManualClock();
    const llm = new ScriptedLlm(() => quip, 1, () => new Promise<void>(() => {}));
    const voice = createHostVoice({ llm, tts: new SilentTts(), lines, clock });
    const p = voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', tier: 'good', answer: 'x' }).ready(1500);
    clock.advance(1500);
    const line = await p;
    expect(line?.source).toBe('bank');
    expect(line?.id).toMatch(/^pon\.reveal_react\.good\./);
  });

  it('falls back to the bank when the LLM line breaks the rules', async () => {
    const bad = [
      { text: '一本！', kana: '一本！', en: 'Ippon!' }, // reading has kanji
      { text: 'ねこ', kana: 'いぬ', en: 'Cat' }, // reading of another word
      { text: 'ばか！', kana: 'ばか！', en: 'Idiot!' }, // moderation
      { text: 'あ'.repeat(60), kana: 'あ'.repeat(60), en: 'Too long' },
    ];
    for (const out of bad) {
      const voice = createHostVoice({ llm: new ScriptedLlm(() => out), lines });
      const line = await voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', tier: 'good', answer: 'x' }).ready(2000);
      expect(line?.source).toBe('bank');
    }
  });

  it('only asks the LLM for lively events, and not once the game budget is spent', async () => {
    const llm = new ScriptedLlm(() => quip);
    const voice = createHostVoice({ llm, lines, budgetUsd: 0.0015 });
    await voice.prepare('ABCD', { host: 'pon', event: 'prompt_read' }).ready(100);
    expect(llm.calls).toHaveLength(0);
    await voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', answer: 'a' }).ready(100);
    await voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', answer: 'b' }).ready(100);
    expect(llm.calls).toHaveLength(2);
    expect(voice.budget('ABCD').exhausted).toBe(true);
    const third = await voice.prepare('ABCD', { host: 'pon', event: 'reveal_react', answer: 'c' }).ready(100);
    expect(third?.source).toBe('bank');
    expect(llm.calls).toHaveLength(2);
    voice.newGame('ABCD');
    expect(voice.budget('ABCD')).toBeInstanceOf(LlmBudget);
    expect(voice.budget('ABCD').exhausted).toBe(false);
  });

  it('does not repeat a bank line until the bank runs out', async () => {
    const voice = createHostVoice({ lines });
    const a = await voice.prepare('R1', { host: 'pon', event: 'reveal_react', tier: 'good' }).ready(10);
    const b = await voice.prepare('R1', { host: 'pon', event: 'reveal_react', tier: 'good' }).ready(10);
    expect(a?.id).not.toBe(b?.id);
  });

  it('uses an untiered line when a tier has none, and fills the name slot with a voiced reading', async () => {
    const voice = createHostVoice({ lines });
    expect((await voice.prepare('R', { host: 'pon', event: 'reveal_react', tier: 'ippon', llm: false }).ready(10))?.source).toBe('bank');
    const hi = await voice.prepare('R', { host: 'pon', event: 'mic_check_ok', slots: { name: 'Ladi' } }).ready(10);
    expect(hi).toMatchObject({ text: 'Ladiさん、きこえるよ！', kana: 'ラディさん、きこえるよ！', en: 'I can hear you, Ladi!' });
  });

  it('pre-renders the bank so fallback lines carry audio', async () => {
    const tts = new SilentTts();
    const voice = createHostVoice({ tts, lines });
    const { rendered } = await voice.warmUp(['pon']);
    expect(rendered).toBeGreaterThanOrEqual(3); // the slot line waits for a name
    const line = await voice.prepare('R', { host: 'pon', event: 'reveal_react', tier: 'good' }).ready(10);
    expect(line?.audio).toBeDefined();
    await tick();
  });

  it('voices a bank line on the spot when nothing was pre-rendered (Cloudflare)', async () => {
    const tts = new SilentTts();
    const voice = createHostVoice({ tts, lines });
    const line = await voice.prepare('R', { host: 'pon', event: 'reveal_react', tier: 'good', llm: false }).ready(100);
    expect(line?.source).toBe('bank');
    expect(line?.audio).toBeDefined();
    expect(voice.audio(line!.audio!.id)).toBeDefined();
    expect(tts.spoken).toHaveLength(1);
  });

  it('reads a prompt with a blank as a pause', async () => {
    const tts = new SilentTts();
    const voice = createHostVoice({ tts });
    const line = await voice.speak('R', 'pon', { text: 'ねこの しごとは ＿＿＿ です。', kana: 'ねこの しごとは ＿＿＿ です。', en: 'x' }).ready(100);
    expect(line?.audio).toBeDefined();
    expect(tts.spoken[0]?.kana).toBe('ねこの しごとは 、 です。');
  });

  it('reads given Japanese aloud', async () => {
    const tts = new SilentTts();
    const voice = createHostVoice({ tts });
    const line = await voice.speak('R', 'fude', { text: '「あ」！', kana: '「あ」！', en: '"A"!' }).ready(100);
    expect(line?.audio).toBeDefined();
    expect(tts.spoken[0]?.host).toBe('fude');
  });
});

describe('lineProblem', () => {
  const check = (text: string, kana: string) => lineProblem({ text, kana, en: 'Say it again!' }, defaultModerator, []);

  it('accepts a name with digits read the English way', () => {
    // Seen live: the model read bot4 as ぼっとふぉー, and the 4 used to count as よん.
    expect(check('bot4さん、もう いちど どうぞ！', 'ぼっとふぉーさん、もう いちど どうぞ！')).toBeNull();
    expect(check('3にんで どうぞ！', 'さんにんで どうぞ！')).toBeNull();
  });

  it('still rejects a reading of another sentence', () => {
    expect(check('bot4さん、もう いちど どうぞ！', 'ぼっとふぉーさん、ありがとう！')).toBe('reading does not match text');
  });
});
