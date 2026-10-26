// Karaoke Duel's backing track: a tiny Web Audio synth, so no audio files are needed. For each
// sing turn it schedules a one-bar count-in (woodblock clicks), a soft bass on every beat and
// a quiet guide melody, all on the server's clock. Browsers only start audio after a click on
// the page, so the stage shows a "click for music" button until then.

import { getSound, isMuted, onMuteChange } from '../sound.js';

export interface TurnTrack {
  /** Unique per sing turn; scheduling the same key twice does nothing. */
  key: string;
  /** Local epoch ms of the line's first beat. */
  lineAt: number;
  beatMs: number;
  countInBeats: number;
  notes: { startMs: number; ms: number; midi: number }[];
  /** Morae that are rests (small っ). */
  rests: boolean[];
}

let scheduledKey = '';
let live: AudioScheduledSourceNode[] = [];

/** Guide melody volume: quiet, so phone mics mostly hear the singer (see the doc's known gaps). */
const GUIDE_GAIN = 0.07;
const BASS_GAIN = 0.12;
const CLICK_GAIN = 0.25;

// The context, unlocking and mute are shared with the music (../sound.ts).
export { audioReady, audioSupported, isMuted, setMuted, unlockAudio } from '../sound.js';

function context(): AudioContext | null {
  return getSound()?.ctx ?? null;
}

/** Where the backing track plays: with the music's volume, but never ducked. */
const out = (): AudioNode => getSound()!.backing;

/**
 * How late the speakers are behind the audio clock (TV soundbars can add 100 ms or more). The
 * backing track is scheduled this much early, so it is heard on the server's beat.
 */
export function outputLatencyMs(): number {
  const c = context();
  if (!c || c.state !== 'running') return 0;
  const s = (c as AudioContext & { outputLatency?: number }).outputLatency ?? c.baseLatency;
  return Number.isFinite(s) ? Math.min(500, Math.max(0, s * 1000)) : 0;
}

onMuteChange((muted) => {
  if (muted) stopAll();
});

export function stopAll(): void {
  for (const node of live) {
    try {
      node.stop();
    } catch {
      // already stopped
    }
  }
  live = [];
  scheduledKey = '';
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function tone(c: AudioContext, at: number, dur: number, freq: number, gain: number, type: OscillatorType): void {
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.015);
  amp.gain.setTargetAtTime(gain * 0.6, start + 0.05, 0.1);
  amp.gain.setTargetAtTime(0, start + Math.max(0.03, dur - 0.04), 0.02);
  osc.connect(amp).connect(out());
  osc.start(start);
  osc.stop(start + dur + 0.1);
  live.push(osc);
}

function click(c: AudioContext, at: number, accent: boolean): void {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1_600 : 1_100, at);
  amp.gain.setValueAtTime(CLICK_GAIN, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
  osc.connect(amp).connect(out());
  osc.start(at);
  osc.stop(at + 0.08);
  live.push(osc);
}

/** Schedules one sing turn's count-in, bass and guide melody. Safe to call on every redraw. */
export function playTurn(track: TurnTrack): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || scheduledKey === track.key) return;
  stopAll();
  scheduledKey = track.key;
  // Local wall-clock ms → AudioContext seconds, early by the speakers' delay, so each click and note
  // is heard on the server's beat (which the phones time the singers against), not scheduled on it.
  const lead = outputLatencyMs();
  const toAudio = (localMs: number) => c.currentTime + (localMs - lead - Date.now()) / 1000;
  const beat = track.beatMs;
  for (let k = 0; k < track.countInBeats; k++) click(c, toAudio(track.lineAt - (track.countInBeats - k) * beat), k === 0);

  const end = track.notes.reduce((n, x) => Math.max(n, x.startMs + x.ms), 0);
  // Bass: the melody note sounding on each beat, two octaves down.
  for (let t = 0; t < end; t += beat) {
    const note = track.notes.find((n) => t >= n.startMs && t < n.startMs + n.ms) ?? track.notes[0];
    if (note) tone(c, toAudio(track.lineAt + t), (beat / 1000) * 0.9, hz(note.midi - 24), BASS_GAIN, 'sine');
  }
  track.notes.forEach((n, i) => {
    if (track.rests[i]) return;
    tone(c, toAudio(track.lineAt + n.startMs), (n.ms / 1000) * 0.95, hz(n.midi), GUIDE_GAIN, 'triangle');
  });
}

/** A short "ta-da" for the duel result. */
export function fanfare(key: string): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || scheduledKey === key) return;
  stopAll();
  scheduledKey = key;
  const t = c.currentTime + 0.05;
  [60, 64, 67, 72].forEach((m, i) => tone(c, t + i * 0.12, i === 3 ? 0.6 : 0.14, hz(m), 0.12, 'triangle'));
}
