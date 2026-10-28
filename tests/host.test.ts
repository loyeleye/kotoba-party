// The server's host director: cues sent ahead start the LLM line early, so the reveal gets it in time.

import { describe, expect, it } from 'vitest';
import { createHostVoice, fillSlots, ScriptedLlm, type BankLine } from '../server/ai/index.js';
import { ManualClock } from '../server/src/clock.js';
import { aiVoice, bankVoice, moodFor } from '../server/src/host.js';
import { EMPTY_CONTENT, type HostCue } from '../shared/src/modes/mode.js';

const lines: BankLine[] = [{ id: 'pon.reveal_react.good.01', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'いいね！', kana: 'いいね！', en: 'Nice!' } }];
const quip = { text: 'ねこが ぎんこういん？ ポン！', kana: 'ねこが ぎんこういん？ ぽん！', en: 'A cat bank clerk? Pon!' };
const cue: HostCue = { host: 'pon', event: 'reveal_react', tier: 'good', answer: 'ぎんこういんの ねこ / ねる', answerEn: 'a bank clerk cat / sleep' };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** An LLM that answers only when let go, like a 3-second Opus call. */
function slowLlm() {
  let go!: () => void;
  const gate = new Promise<void>((r) => (go = r));
  return { llm: new ScriptedLlm(() => quip, 1, () => gate), go };
}

describe('host lines sent ahead', () => {
  it('uses the line started ahead when the same cue arrives', async () => {
    const clock = new ManualClock();
    const { llm, go } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock }), bankVoice(EMPTY_CONTENT));
    voice.ahead!('ABCD', { ...cue, ahead: true });
    go();
    for (let i = 0; i < 5; i++) await tick();
    const line = await voice.speak('ABCD', cue);
    expect(line?.text).toBe(quip.text);
    expect(llm.calls).toHaveLength(1);
  });

  it('starts fresh, and falls back to the bank, when nothing was sent ahead', async () => {
    const clock = new ManualClock();
    const { llm } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock }), bankVoice(EMPTY_CONTENT));
    voice.ahead!('ABCD', { ...cue, answer: 'another answer', ahead: true });
    const p = voice.speak('ABCD', cue);
    await tick();
    clock.advance(1500);
    expect((await p)?.text).toBe('いいね！');
    expect(llm.calls).toHaveLength(2);
  });

  it('waits as long as the cue allows for a line still being written', async () => {
    const clock = new ManualClock();
    const { llm, go } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock }), bankVoice(EMPTY_CONTENT));
    const p = voice.speak('ABCD', { ...cue, waitMs: 4000 });
    await tick();
    clock.advance(3000);
    go();
    for (let i = 0; i < 5; i++) await tick();
    expect((await p)?.text).toBe(quip.text);
  });

  it('waits longer for a fresh line when the cue allows it', async () => {
    const clock = new ManualClock();
    const { llm, go } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock }), bankVoice(EMPTY_CONTENT));
    const p = voice.speak('ABCD', { ...cue, waitMs: 6000 });
    await tick();
    clock.advance(3000);
    go();
    expect((await p)?.text).toBe(quip.text);
  });

  it('asks once for a cue sent ahead twice', async () => {
    const { llm } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock: new ManualClock() }), bankVoice(EMPTY_CONTENT));
    voice.ahead!('ABCD', { ...cue, ahead: true });
    voice.ahead!('ABCD', { ...cue, ahead: true });
    await tick();
    expect(llm.calls).toHaveLength(1);
  });
});

describe('bank lines that name the answer', () => {
  const content = {
    ...EMPTY_CONTENT,
    hostLines: [
      { id: 'pon.reveal_react.good.01', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'いいね！', kana: 'いいね！', en: 'Nice!' }, status: 'draft' },
      { id: 'pon.reveal_react.good.13', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'なんで {tile}！？', kana: 'なんで {tile}！？', en: 'Why {tile}?!' }, slots: ['{tile}'], status: 'draft' },
    ],
  } as typeof EMPTY_CONTENT;

  it('prefers a {tile} line, filling the reading and English from their own slots', async () => {
    const line = await bankVoice(content).speak('ABCD', { ...cue, slots: { tile: '大きな タコ', tile_kana: 'おおきな タコ', tile_en: 'a giant octopus' } });
    expect(line).toMatchObject({ text: 'なんで 大きな タコ！？', kana: 'なんで おおきな タコ！？', en: 'Why a giant octopus?!' });
  });

  it('capitalises an English answer that opens the line', async () => {
    const opens = { ...EMPTY_CONTENT, hostLines: [{ id: 'pon.vote_close.01', host: 'pon', event: 'vote_close', jp: { text: '{tile}の かち！', kana: '{tile}の かち！', en: '{tile} wins! Go, {tile}!' }, slots: ['{tile}'], status: 'draft' }] } as typeof EMPTY_CONTENT;
    const line = await bankVoice(opens).speak('ABCD', { host: 'pon', event: 'vote_close', slots: { tile: 'たこ', tile_kana: 'たこ', tile_en: 'an octopus' } });
    expect(line?.en).toBe('An octopus wins! Go, an octopus!');
    expect(fillSlots({ text: '{tile}！', kana: '{tile}！', en: '{tile}… fine.' }, { tile: 'たこ', tile_en: 'an octopus' }).en).toBe('An octopus… fine.');
  });

  it('uses the other lines when the cue names no answer', async () => {
    expect((await bankVoice(content).speak('ABCD', cue))?.text).toBe('いいね！');
  });
});

describe('host moods', () => {
  it('cheers a win, flinches at a miss, and otherwise just idles', () => {
    expect(moodFor({ host: 'pon', event: 'ippon' })).toBe('cheer');
    expect(moodFor({ host: 'pon', event: 'raid_combo' })).toBe('cheer');
    expect(moodFor({ host: 'pon', event: 'raid_escape' })).toBe('oops');
    expect(moodFor({ host: 'nobiko', event: 'miss_kind' })).toBe('oops');
    expect(moodFor({ host: 'pon', event: 'prompt_read' })).toBeUndefined();
  });

  it('gives only Nobiko-san the neck-stretch peek, as answers come in and are revealed', () => {
    expect(moodFor({ host: 'nobiko', event: 'say_it_first' })).toBe('peek');
    expect(moodFor({ host: 'nobiko', event: 'reveal_react', tier: 'good' })).toBe('peek');
    expect(moodFor({ host: 'nobiko', event: 'reveal_react', tier: 'ippon' })).toBe('cheer');
    expect(moodFor({ host: 'pon', event: 'reveal_react', tier: 'good' })).toBeUndefined();
  });
});

describe('lip sync on the stage', () => {
  it('finds the mouth shape at a moment of the audio, and ends with the track', async () => {
    const { shapeAt } = await import('../stage/src/sprites.js');
    const track: [0 | 1 | 2, number][] = [[0, 50], [2, 100], [1, 40]];
    expect(shapeAt(track, 0)).toBe(0);
    expect(shapeAt(track, 60)).toBe(2);
    expect(shapeAt(track, 160)).toBe(1);
    expect(shapeAt(track, 190)).toBeNull();
  });
});
