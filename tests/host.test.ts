// The server's host director: cues sent ahead start the LLM line early, so the reveal gets it in time.

import { describe, expect, it } from 'vitest';
import { createHostVoice, ScriptedLlm, type BankLine } from '../server/ai/index.js';
import { ManualClock } from '../server/src/clock.js';
import { aiVoice, bankVoice } from '../server/src/host.js';
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

  it('asks once for a cue sent ahead twice', async () => {
    const { llm } = slowLlm();
    const voice = aiVoice(createHostVoice({ llm, lines, clock: new ManualClock() }), bankVoice(EMPTY_CONTENT));
    voice.ahead!('ABCD', { ...cue, ahead: true });
    voice.ahead!('ABCD', { ...cue, ahead: true });
    await tick();
    expect(llm.calls).toHaveLength(1);
  });
});
