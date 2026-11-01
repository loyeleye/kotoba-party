// The phone's own ja-JP speech synthesis, for listening prompts (Kana Raid's listening attacks,
// Shodō Taikai's dictation). Nothing plays unless the player's own tap (or the screen that tap
// opened) asks for it; phones without a Japanese voice show the reading written instead.
//
// Sound off (the player's 🎧 switch, for a crowded room) silences every phone sound and reports no voice,
// so each listening screen takes its written path. Games whose written path would give the answer
// away check isSoundOff() and swap in a fair version (docs/sound-off.md).

import { hasTabAudio } from '../../../shared/src/audioTabs.js';
import { h } from '../../../shared/src/dom.js';

let soundOff = false;
/** main.ts passes the player's 🎧 switch in before each screen draws. */
export const setSoundOff = (off: boolean): void => {
  if (off && !soundOff) synth()?.cancel();
  soundOff = off;
};
export const isSoundOff = (): boolean => soundOff;

const synth = (): SpeechSynthesis | null => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

// On-device voices first: Chrome's network voices send the text to Google, and some of what phones read
// is players' own words (Word Gauntlet's rumour relay; docs/commercial-blockers.md row 31).
function jaVoice(): SpeechSynthesisVoice | null {
  const ja = synth()?.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja')) ?? [];
  return ja.find((v) => v.localService) ?? ja[0] ?? null;
}

/** True unless we know there is no Japanese voice (voices load late on some phones). */
export function canVoice(): boolean {
  const s = synth();
  if (!s || soundOff) return false;
  const voices = s.getVoices();
  return voices.length === 0 || !!jaVoice();
}

export function say(text: string): void {
  const s = synth();
  // Another tab of this game in this browser has the sound.
  if (!s || !text || soundOff || !hasTabAudio()) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.8;
    const v = jaVoice();
    if (v) u.voice = v;
    s.speak(u);
  } catch {
    /* no voice: the written fallback is on screen */
  }
}

/** A 🔊 replay button; nothing with sound off (the screen shows its written version instead). */
export function hearButton(text: string, label = '🔊 Hear it', cls = 'raid-hear'): HTMLElement | null {
  if (soundOff) return null;
  return h('button', { type: 'button', class: cls, onclick: () => say(text) }, label);
}
