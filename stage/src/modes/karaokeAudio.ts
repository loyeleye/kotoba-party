// Karaoke Duel's backing. A continuous song plays its produced instrumental straight through
// (playSong) with a quiet synth guide melody on each line (playTurn, guide only). A sing-along
// song, or a continuous one whose track can't play (it failed to load, or streamer mode), gets a
// tiny Web Audio synth instead: for each sing turn a one-bar count-in (woodblock clicks), a soft
// bass, light drums and the guide melody, all on the server's clock. Each song's style (STYLES)
// sets the bass pattern, the swing, the drums and the guide's sound. Browsers only start audio after a click on
// the page, so the stage shows a "click for music" button until then.

import type { SongStyle } from '../../../shared/src/modes/karaokeDuel/songs.js';
import { load } from '../music/engine.js';
import { creditTrack, isStreamerMode } from '../music/index.js';
import { parseChord } from '../music/songs.js';
import { TRACKS, isTrack } from '../music/tracks.js';
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
  style: SongStyle;
  /** Chord names spread evenly over the line; the bass plays their roots. Empty: follow the melody. */
  chords: string[];
  /**
   * A continuous song: earlier turns' notes ring on (they overlap this turn's count-in), and when its
   * track is playing only the guide melody plays.
   */
  continuous?: boolean;
}

interface Style {
  guide: OscillatorType;
  /** Bass hits in each beat: when (in beats) and how far above the root (semitones). */
  bass: readonly (readonly [at: number, up: number])[];
  bassWave: OscillatorType;
  /** Where the off-beat falls: 0.5 straight, 2/3 swung. */
  swing: number;
  /**
   * Kick on beats 1 and 3, snare (or claps) on 2 and 4, hi-hat on and off the beat. `four`: a kick
   * on every beat (idol pop); `boom`: boom-bap, an extra kick just after beat 2.
   */
  drums: 'none' | 'soft' | 'rock' | 'claps' | 'four' | 'boom';
  /** Hi-hats per beat: 2 (eighths) or 4 (sixteenths: city pop, R&B). */
  hats: 2 | 4;
  /** A slow wobble on held guide notes (1.5 beats or more: enka's long ends). */
  vibrato: boolean;
}

const STYLES: Record<SongStyle, Style> = {
  nursery: { guide: 'triangle', bass: [[0, 0]], bassWave: 'sine', swing: 0.5, drums: 'none', hats: 2, vibrato: false },
  citypop: { guide: 'sine', bass: [[0, 0], [0.5, 12], [0.75, 0]], bassWave: 'triangle', swing: 0.5, drums: 'soft', hats: 4, vibrato: false },
  enka: { guide: 'sine', bass: [[0, 0]], bassWave: 'sine', swing: 0.5, drums: 'none', hats: 2, vibrato: true },
  rock: { guide: 'square', bass: [[0, 0], [0.5, 0]], bassWave: 'sawtooth', swing: 0.5, drums: 'rock', hats: 2, vibrato: false },
  izakaya: { guide: 'triangle', bass: [[0, 0], [2 / 3, 7]], bassWave: 'triangle', swing: 2 / 3, drums: 'claps', hats: 2, vibrato: false },
  blues: { guide: 'triangle', bass: [[0, 0], [2 / 3, 7]], bassWave: 'sine', swing: 2 / 3, drums: 'soft', hats: 2, vibrato: false },
  kayou: { guide: 'triangle', bass: [[0, 0], [2 / 3, 7]], bassWave: 'sine', swing: 2 / 3, drums: 'soft', hats: 2, vibrato: true },
  hiphop: { guide: 'square', bass: [[0, 0]], bassWave: 'sine', swing: 0.58, drums: 'boom', hats: 2, vibrato: false },
  rnb: { guide: 'sine', bass: [[0, 0], [0.75, 0]], bassWave: 'sine', swing: 0.5, drums: 'soft', hats: 4, vibrato: false },
  idol: { guide: 'square', bass: [[0, 0], [0.5, 12]], bassWave: 'triangle', swing: 0.5, drums: 'four', hats: 2, vibrato: false },
};

let scheduledKey = '';
let live: AudioScheduledSourceNode[] = [];

/** The continuous song playing now: its key, the file's source, and its own gain for the fade. */
let song: { key: string; srcs: AudioBufferSourceNode[]; gain: GainNode; failed: boolean } | null = null;

/** Guide melody volume: quiet, so phone mics mostly hear the singer (see the doc's known gaps). */
const GUIDE_GAIN = 0.07;
const BASS_GAIN = 0.12;
const CLICK_GAIN = 0.25;
const DRUM_GAIN = 0.1;

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
  stopSong();
  stopTurn();
}

function stopTurn(): void {
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

function tone(c: AudioContext, at: number, dur: number, freq: number, gain: number, type: OscillatorType, vibrato = false): void {
  if (at + dur < c.currentTime) return;
  const start = Math.max(at, c.currentTime);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (vibrato) {
    // Hold the note straight, then let it wobble (about a quarter-tone, 5.5 times a second).
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(freq * 0.015, start + Math.min(0.5, dur / 2));
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.1);
    live.push(lfo);
  }
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

let noise: { ctx: AudioContext; buf: AudioBuffer } | null = null;

/** Half a second of white noise, made once, for the snare, claps and hi-hat. */
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise?.ctx === c) return noise.buf;
  const buf = c.createBuffer(1, Math.round(c.sampleRate / 2), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = { ctx: c, buf };
  return buf;
}

/** A filtered noise burst: hi-hat (high, short), snare or claps (lower, longer). */
function hiss(c: AudioContext, at: number, cutoff: number, len: number, gain: number): void {
  if (at < c.currentTime) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoff;
  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(filter).connect(amp).connect(out());
  src.start(at);
  src.stop(at + len + 0.02);
  live.push(src);
}

/** A short falling sine thump. */
function kick(c: AudioContext, at: number, gain: number): void {
  if (at < c.currentTime) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
  osc.connect(amp).connect(out());
  osc.start(at);
  osc.stop(at + 0.17);
  live.push(osc);
}

/** One beat of drums; `n` is the beat's number from the line's first beat (0 = beat 1). */
function drums(c: AudioContext, at: number, n: number, beatS: number, style: Style): void {
  if (style.drums === 'none') return;
  const backbeat = n % 2 === 1;
  const loud = style.drums === 'rock' || style.drums === 'four' ? 1.4 : 1;
  if (!backbeat || style.drums === 'four') kick(c, at, DRUM_GAIN * 1.5 * loud);
  if (style.drums === 'boom' && n % 4 === 1) kick(c, at + 0.5 * beatS, DRUM_GAIN * 1.2);
  if (backbeat && style.drums === 'claps') [0, 0.012, 0.025].forEach((d) => hiss(c, at + d, 1_200, 0.08, DRUM_GAIN * 0.7));
  else if (backbeat) {
    const crack = style.drums !== 'soft';
    hiss(c, at, 1_500, crack ? 0.16 : 0.07, DRUM_GAIN * (crack ? 1.2 : 0.5));
  }
  hiss(c, at, 7_000, 0.03, DRUM_GAIN * 0.35);
  if (style.hats === 4) for (const q of [0.25, 0.5, 0.75]) hiss(c, at + q * beatS, 7_000, 0.025, DRUM_GAIN * (q === 0.5 ? 0.25 : 0.15));
  else hiss(c, at + style.swing * beatS, 7_000, 0.03, DRUM_GAIN * 0.25);
}

/** A chord's root as a bass note (MIDI 33–44, A1 to G♯2). */
function chordRoot(name: string): number | null {
  try {
    return 33 + ((parseChord(name).root - 9 + 12) % 12);
  } catch {
    return null;
  }
}

export interface SongPlay {
  /** Unique per song played; calling again with the same key does nothing. */
  key: string;
  /** The track's id in the stage's recorded tracks. */
  trackId: string;
  /** Seconds into the file where its bar 0 starts. */
  start: number;
  /** The stretches of the file to play back to back, in its bars. */
  segments: [number, number][];
  /** Seconds per bar. */
  barS: number;
  /** Local epoch ms of beat 0 (the start of the first stretch). */
  songAt: number;
}

/** True while a continuous song's own track is (or will be) playing, so the synth plays only the guide. */
export const songPlaying = (key: string): boolean => !!song && song.key === key && !song.failed;

/**
 * Plays a continuous song's instrumental from beat 0 at `songAt` (or from where it has got to, for a
 * stage that joins late), through the backing bus. Safe to call on every redraw.
 */
export function playSong(play: SongPlay): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || song?.key === play.key) return;
  stopSong();
  const t = isTrack(play.trackId) ? TRACKS[play.trackId] : null;
  const gain = c.createGain();
  gain.gain.value = t ? 10 ** (t.gainDb / 20) : 1;
  gain.connect(out());
  const mine = { key: play.key, srcs: [] as AudioBufferSourceNode[], gain, failed: !t || isStreamerMode() };
  song = mine;
  if (mine.failed) return;
  load(c, t!.url).then(
    (buffer) => {
      if (song !== mine) return;
      const lead = outputLatencyMs();
      let at = c.currentTime + (play.songAt - lead - Date.now()) / 1000;
      for (const [x, y] of play.segments) {
        const from = play.start + x * play.barS;
        const len = (y - x) * play.barS;
        // A stage that loads late joins the song where it has got to.
        const skip = Math.max(0, c.currentTime - at);
        if (skip < len) {
          const src = c.createBufferSource();
          src.buffer = buffer;
          src.connect(gain);
          src.start(Math.max(at, c.currentTime), from + skip, len - skip);
          mine.srcs.push(src);
        }
        at += len;
      }
      creditTrack(play.trackId);
      // The last bars fade out.
      gain.gain.setValueAtTime(gain.gain.value, Math.max(c.currentTime, at - 4));
      gain.gain.linearRampToValueAtTime(0, Math.max(c.currentTime, at));
    },
    () => {
      mine.failed = true;
    },
  );
}

/** Fades the continuous song out. */
export function stopSong(fade = 1.2): void {
  const c = context();
  const s = song;
  song = null;
  if (s) creditTrack(null);
  if (!s || !c) return;
  s.gain.gain.cancelScheduledValues(c.currentTime);
  s.gain.gain.setTargetAtTime(0, c.currentTime, fade / 4);
  for (const src of s.srcs) {
    try {
      src.stop(c.currentTime + fade);
    } catch {
      // already stopped
    }
  }
}

/** Schedules one sing turn's count-in, bass and guide melody. Safe to call on every redraw. */
export function playTurn(track: TurnTrack, guideOnly = false): void {
  const c = context();
  if (!c || isMuted() || c.state !== 'running' || scheduledKey === track.key) return;
  if (!track.continuous) stopTurn();
  scheduledKey = track.key;
  // Local wall-clock ms → AudioContext seconds, early by the speakers' delay, so each click and note
  // is heard on the server's beat (which the phones time the singers against), not scheduled on it.
  const lead = outputLatencyMs();
  const toAudio = (localMs: number) => c.currentTime + (localMs - lead - Date.now()) / 1000;
  const beat = track.beatMs;
  const style = STYLES[track.style] ?? STYLES.nursery;
  const guideGain = style.guide === 'square' ? GUIDE_GAIN * 0.5 : GUIDE_GAIN;
  const guide = () =>
    track.notes.forEach((n, i) => {
      if (track.rests[i]) return;
      tone(c, toAudio(track.lineAt + n.startMs), (n.ms / 1000) * 0.95, hz(n.midi), guideGain, style.guide, style.vibrato && n.ms >= 1.5 * beat);
    });
  if (guideOnly) return guide();
  for (let k = 0; k < track.countInBeats; k++) click(c, toAudio(track.lineAt - (track.countInBeats - k) * beat), k === 0);

  const end = track.notes.reduce((n, x) => Math.max(n, x.startMs + x.ms), 0);
  // Bass, in the style's pattern: the root of the chord at each beat, or (a song without chords)
  // the melody note sounding then, two octaves down. Bright waves play quieter so they sit at the
  // same loudness as a sine.
  const bassGain = style.bassWave === 'sine' ? BASS_GAIN : BASS_GAIN * 0.5;
  const roots = track.chords.map(chordRoot);
  for (let t = 0, n = 0; t < end; t += beat, n++) {
    const note = track.notes.find((x) => t >= x.startMs && t < x.startMs + x.ms) ?? track.notes[0];
    const root = roots.length ? roots[Math.min(roots.length - 1, Math.floor((t / end) * roots.length))] : null;
    const base = root ?? (note ? note.midi - 24 : null);
    style.bass.forEach(([at, up], i) => {
      const len = ((style.bass[i + 1]?.[0] ?? 1) - at) * 0.9;
      if (base !== null) tone(c, toAudio(track.lineAt + t + at * beat), (beat / 1000) * len, hz(base + up), bassGain, style.bassWave);
    });
    drums(c, toAudio(track.lineAt + t), n, beat / 1000, style);
  }
  guide();
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
