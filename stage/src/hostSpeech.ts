// The hosts' voice when the server has none. Host lines come with VOICEVOX audio only when the
// server has VOICEVOX_URL set (docs/cloudflare.md); without it the TV reads the line's kana with the
// browser's own Japanese voice instead, each host at their own pitch and pace, so the hosts are
// never silent. A browser with two or more Japanese voices gives the men and the women different ones.

import { duckForSpeech } from './music/index.js';
import { audioReady, silent } from './sound.js';

interface Speaker {
  /** Which kind of system voice suits the host, when the browser has a choice. */
  kind: 'male' | 'female';
  pitch: number;
  rate: number;
}

// Tuned to sit near each host's VOICEVOX voice (server/ai/hosts.ts).
const SPEAKERS: Record<string, Speaker> = {
  pon: { kind: 'male', pitch: 1.5, rate: 1.1 }, // 白上虎太郎: an excitable kid
  chochin: { kind: 'male', pitch: 0.6, rate: 0.85 }, // ちび式じい: an unhurried old man
  fude: { kind: 'female', pitch: 1.25, rate: 0.95 }, // 春日部つむぎ: bright, careful
  nobiko: { kind: 'female', pitch: 1.0, rate: 1.0 }, // No.7: the announcer
};
const DEFAULT: Speaker = { kind: 'female', pitch: 1, rate: 1 };

// System voices by name: macOS Otoya/Kyoko, Windows Ichiro/Haruka/Ayumi/Sayaka, Android and Chrome.
const MALE = /otoya|ichiro|keita|daichi|naoki|hattori|男性|male/i;

/** The host line being read now, so stopping it leaves other speech (Onsen suspects, cards) alone. */
let current: SpeechSynthesisUtterance | null = null;

const synth = (): SpeechSynthesis | null => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

function jaVoices(): SpeechSynthesisVoice[] {
  return synth()?.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja')) ?? [];
}
// Voices load late in Chrome; asking once starts the load.
synth()?.getVoices();

function voiceFor(kind: Speaker['kind']): SpeechSynthesisVoice | null {
  const all = jaVoices();
  const male = all.filter((v) => MALE.test(v.name));
  const female = all.filter((v) => !MALE.test(v.name));
  const pick = (vs: SpeechSynthesisVoice[]) => vs.find((v) => v.localService) ?? vs[0];
  return (kind === 'male' ? pick(male) : pick(female)) ?? pick(all) ?? null;
}

/** True when this browser can read a host line aloud now: a Japanese voice, sound unlocked and on. */
export function canSpeakHost(): boolean {
  return !!synth() && audioReady() && !silent() && jaVoices().length > 0;
}

/** Reads `kana` in `host`'s voice, cutting off whatever the browser was saying. Never throws. */
export function speakHost(host: string, kana: string): void {
  const s = synth();
  if (!s || !kana || !canSpeakHost()) return;
  const sp = SPEAKERS[host] ?? DEFAULT;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(kana);
    u.lang = 'ja-JP';
    const v = voiceFor(sp.kind);
    if (v) u.voice = v;
    u.pitch = sp.pitch;
    u.rate = sp.rate;
    duckForSpeech(u);
    current = u;
    for (const ev of ['end', 'error'] as const) u.addEventListener(ev, () => current === u && (current = null));
    s.speak(u);
  } catch {
    // No voice after all: the subtitles are on screen.
  }
}

/** Stops a host line mid-sentence, e.g. when a mode holds the next one back. */
export function stopHostSpeech(): void {
  if (!current) return;
  current = null;
  synth()?.cancel();
}
