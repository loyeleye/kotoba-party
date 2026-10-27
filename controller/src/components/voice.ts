// The phone's own ja-JP speech synthesis, for listening prompts (Kana Raid's listening attacks,
// Shodō Taikai's dictation). Nothing plays unless the player's own tap (or the screen that tap
// opened) asks for it; phones without a Japanese voice show the reading written instead.

import { h } from '../../../shared/src/dom.js';

const synth = (): SpeechSynthesis | null => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

function jaVoice(): SpeechSynthesisVoice | null {
  return synth()?.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja')) ?? null;
}

/** True unless we know there is no Japanese voice (voices load late on some phones). */
export function canVoice(): boolean {
  const s = synth();
  if (!s) return false;
  const voices = s.getVoices();
  return voices.length === 0 || !!jaVoice();
}

export function say(text: string): void {
  const s = synth();
  if (!s || !text) return;
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

export function hearButton(text: string, label = '🔊 Hear it', cls = 'raid-hear'): HTMLElement {
  return h('button', { type: 'button', class: cls, onclick: () => say(text) }, label);
}
