// Plays the right music for the room: picks a cue from the mode and phase (cues.ts), crossfades
// between loops, moves the mix under players' voices and ducks under the hosts'. Also owns the
// stage's sound button and the "now playing" credit beside it.

import { h, mount } from '../../../shared/src/dom.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MUSIC_LEVEL, audioReady, audioSupported, getSound, isAway, isMuted, onAudioReady, onAwayChange, onMuteChange, onVolumeChange, setMuted, silent, unlockAudio, voiceVolume } from '../sound.js';
import { cueFor, listening, saying, SHODO_GALLERY, themeFor, type Cue, type MusicId } from './cues.js';
import { SongVoice, TrackVoice, load, type Mix } from './engine.js';
import { SONGS, type SongId } from './songs.js';
import { TRACKS, isTrack, type TrackId } from './tracks.js';

/** How far ahead synth bars are scheduled, seconds. A hidden tab's timers run about once a second. */
const ahead = () => (typeof document !== 'undefined' && document.hidden ? 1.6 : 0.35);

interface Playing {
  id: MusicId;
  voice: SongVoice | TrackVoice;
  mix: Mix;
  /** Context time of the next bar to schedule (synth songs). */
  nextAt: number;
  nextBar: number;
  /** For a lead-in: the loop that follows it. */
  then?: MusicId;
}

let playing: Playing | null = null;
const STREAMER_KEY = 'kotoba:streamer';
let streamer = (() => {
  try {
    return localStorage.getItem(STREAMER_KEY) === '1';
  } catch {
    return false;
  }
})();
let want: Cue = { song: null, mix: 'full' };
let stingSeq = -1;
let lastPhaseSeq = -1;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts `id`. The old voice fades out once the new one can sound (a track may still be loading),
 * or rings out if it is a finished jingle. A track that can't load falls back to its synth song.
 */
function start(id: MusicId, mix: Mix, at?: number, then?: MusicId, ringOut = false): void {
  const sound = getSound();
  if (!sound) return;
  const old = playing?.voice;
  const leave = () => {
    if (!old) return;
    if (ringOut && old instanceof SongVoice) old.release();
    else old.fadeOut();
  };
  let voice: SongVoice | TrackVoice;
  if (isTrack(id)) {
    const t = TRACKS[id];
    const track = new TrackVoice(sound.ctx, { url: t.url, loop: t.loop, gainDb: t.gainDb, at }, sound.music, mix);
    voice = track;
    void track.ready.then((ok) => {
      leave();
      if (!ok) failed.add(id as TrackId);
      if (!ok && playing?.voice === track) {
        console.warn(`music: couldn't play ${t.url}; using the synth's ${t.fallback}`);
        start(t.fallback, playing.mix);
      }
    });
  } else {
    voice = new SongVoice(sound.ctx, SONGS[id], sound.music, mix);
    leave();
  }
  playing = { id, voice, mix, nextAt: at ?? sound.ctx.currentTime + 0.08, nextBar: 0, then };
  showCredit(id);
  timer ??= setInterval(pump, 60);
  pump();
}

function stop(): void {
  playing?.voice.fadeOut();
  playing = null;
  showCredit(null);
  if (timer) clearInterval(timer);
  timer = null;
}

/** Schedules synth bars ahead of the clock; moves from a lead-in to its loop. */
function pump(): void {
  const sound = getSound();
  if (!sound || !playing) return;
  const now = sound.ctx.currentTime;
  // Woken late (a background tab): skip ahead rather than pile up old bars.
  if (playing.nextAt < now - 0.5) playing.nextAt = now + 0.05;
  while (playing && playing.voice instanceof SongVoice && playing.nextAt < now + ahead()) {
    const p = playing as Playing & { voice: SongVoice };
    const song = SONGS[p.id as SongId];
    if (p.nextBar >= p.voice.plan.bars && !song.loop) {
      if (p.then) start(p.then, want.mix, p.nextAt, undefined, true);
      else stop();
      continue;
    }
    p.voice.scheduleBar(p.nextBar % p.voice.plan.bars, p.nextAt);
    p.nextAt += p.voice.barSeconds;
    p.nextBar++;
  }
}

/** A one-shot over the music. It skips the ducked bus, so a host line starting with it doesn't duck it. */
function sting(id: SongId): void {
  const sound = getSound();
  if (!sound) return;
  const v = new SongVoice(sound.ctx, SONGS[id], sound.backing, 'full');
  const at = sound.ctx.currentTime + 0.05;
  for (let b = 0; b < v.plan.bars; b++) v.scheduleBar(b, at + b * v.barSeconds);
  v.release();
}

/** Loads the tracks the room is likely to need next, so they start on time. */
function preload(view: RoomView): void {
  const sound = getSound();
  if (!sound) return;
  if (!sound || streamer) return;
  const theme = view.mode ? themeFor(view.mode, view.phase === 'lobby' ? (played[view.mode] ?? 0) : game) : null;
  const next: MusicId[] = view.phase === 'lobby' ? (theme ? [theme] : []) : [theme ?? 'happy-dance', 'happy-dance'];
  // Shodō Taikai switches to its gallery track for round 3.
  if (view.mode === 'shodo' && view.phase !== 'lobby') next.push(SHODO_GALLERY);
  for (const id of next) if (isTrack(id)) void load(sound.ctx, TRACKS[id].url).catch(() => {});
}

// ---- which of a mode's two themes: they alternate game by game on this screen ----

const PLAYED_KEY = 'kotoba:played';
/** How many games of each mode this screen has started; picks the theme for the next one. */
const played: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
})();
/** This game's number for its mode (0 for the first): the theme to play. */
let game = 0;
let lastPhase: RoomView['phase'] | null = null;

function countGame(view: RoomView): void {
  const starting = view.phase === 'intro' && lastPhase !== 'intro';
  lastPhase = view.phase;
  if (!starting || !view.mode) return;
  game = played[view.mode] ?? 0;
  played[view.mode] = game + 1;
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(played));
  } catch {
    // private mode: every game gets the first theme
  }
}

/** Call on every render: follows the room's mode and phase. */
export function updateMusic(view: RoomView): void {
  countGame(view);
  const cue = cueFor(view.mode, view.phase, game, listening(view), saying(view));
  const newPhase = view.phaseSeq !== lastPhaseSeq;
  lastPhaseSeq = view.phaseSeq;
  want = cue;
  if (!audioReady() || isMuted()) return;
  if (newPhase) preload(view);
  apply(cue, newPhase ? view.phaseSeq : -1);
}

/** Tracks that wouldn't load this session: their synth stand-in plays instead. */
const failed = new Set<TrackId>();

/** Streamer mode, or a file that won't load, swaps a recorded track for its synth stand-in. */
const resolve = (id: MusicId): MusicId => (isTrack(id) && (streamer || failed.has(id)) ? TRACKS[id].fallback : id);

function apply(raw: Cue, phaseSeq: number): void {
  const cue: Cue = raw.song ? { ...raw, song: resolve(raw.song) } : raw;
  if (!cue.song) {
    stop();
    return;
  }
  const target = playing?.then ?? playing?.id;
  if (playing && (target === cue.song || cue.keep)) {
    if (playing.mix !== cue.mix) {
      playing.mix = cue.mix;
      playing.voice.setMix(cue.mix);
    }
  } else if (cue.leadIn) start(cue.leadIn, 'full', undefined, cue.song);
  else start(cue.song, cue.mix);
  if (cue.sting && phaseSeq >= 0 && phaseSeq !== stingSeq) {
    stingSeq = phaseSeq;
    sting(cue.sting);
  }
}

onAudioReady(() => {
  if (!isMuted()) apply(want, -1);
  refreshButton();
});
onMuteChange((muted) => {
  if (muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (muted) stop();
  else if (audioReady()) apply(want, -1);
  refreshButton();
});
// Another tab took the sound: the music plays on here silently (sound.ts), so taking it back is
// seamless, but a line already being read aloud stops and host lines go quiet.
onAwayChange((away) => {
  if (away && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  for (const a of voices) {
    a.muted = silent();
    a.volume = voiceVolume();
  }
  refreshButton();
});

/** Streamer mode plays only the game's own synth tunes (no recorded tracks), on this screen. */
export const isStreamerMode = (): boolean => streamer;

export function setStreamerMode(on: boolean): void {
  streamer = on;
  try {
    localStorage.setItem(STREAMER_KEY, on ? '1' : '0');
  } catch {
    // private mode: not remembered
  }
  // Restart whatever is playing in its new form.
  stop();
  if (audioReady() && !isMuted()) apply(want, -1);
}

// ---- ducking under voices ----

/** Voices talking right now; the music comes back up only when the last one ends. */
let talking = 0;

function duck(): () => void {
  const sound = getSound();
  if (!sound) return () => {};
  const g = sound.music.gain;
  const now = sound.ctx.currentTime;
  if (talking++ === 0) {
    g.cancelScheduledValues(now);
    g.setTargetAtTime(MUSIC_LEVEL * 0.2, now, 0.03);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--talking > 0) return;
    const t = sound.ctx.currentTime;
    g.cancelScheduledValues(t);
    // Hold briefly, so the music doesn't swell between two lines.
    g.setTargetAtTime(MUSIC_LEVEL, t + 0.15, 0.25);
  };
}

/** Ducks the music for a host's voice line; call before play(). Sound off silences the line too. */
export function duckFor(audio: HTMLAudioElement): void {
  audio.muted = silent();
  audio.volume = voiceVolume();
  voices.add(audio);
  const end = duck();
  for (const ev of ['ended', 'pause', 'error']) audio.addEventListener(ev, () => (voices.delete(audio), end()));
}

/** Host lines playing now, so a volume change reaches them mid-line. */
const voices = new Set<HTMLAudioElement>();
onVolumeChange(() => {
  for (const a of voices) a.volume = voiceVolume();
});

/** Ducks the music for Japanese read out by the browser (Onsen suspects, Concentration cards). */
export function duckForSpeech(u: SpeechSynthesisUtterance): void {
  u.volume = voiceVolume();
  let end: (() => void) | null = null;
  u.addEventListener('start', () => (end = duck()));
  for (const ev of ['end', 'error'] as const) u.addEventListener(ev, () => end?.());
}

// ---- the sound button and the credit ----

let button: HTMLButtonElement | null = null;
let credit: HTMLElement | null = null;

function refreshButton(): void {
  if (!button) return;
  const ready = audioReady();
  button.classList.toggle('mu-ask', !ready);
  mount(button, !ready ? '🔊 Click for music' : isMuted() ? '🔇 Sound off' : isAway() ? '🔈 Sound in another tab' : '🔊 Sound on');
}

/** Names the recorded track that's playing, with its licence: CC BY asks for the credit where it's used. */
function showCredit(id: MusicId | null): void {
  if (!credit) return;
  const t = id && isTrack(id) ? TRACKS[id] : null;
  credit.hidden = !t;
  if (t) mount(credit, `♪ ${t.title} · ${t.author} · ${t.licence}`);
}

/** Puts the sound button and the now-playing credit on the stage. */
export function mountSoundButton(parent: HTMLElement): void {
  if (!audioSupported()) return;
  button = h('button', { type: 'button', class: 'mu-sound' }) as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (!audioReady()) {
      unlockAudio();
      if (isMuted()) setMuted(false);
    } else setMuted(!isMuted());
    refreshButton();
  });
  credit = h('span', { class: 'mu-now', hidden: true });
  parent.append(button, credit);
  refreshButton();
  // Some browsers let a page the player has used before start audio without a click.
  unlockAudio();
}
