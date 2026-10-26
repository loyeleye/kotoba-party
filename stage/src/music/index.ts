// Plays the right music for the room: picks a cue from the mode and phase (cues.ts), crossfades
// between loops, moves the mix under players' voices and ducks under the host's. Also owns the
// stage's sound button.

import { h, mount } from '../../../shared/src/dom.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MUSIC_LEVEL, audioReady, audioSupported, getSound, isMuted, onAudioReady, onMuteChange, setMuted, unlockAudio } from '../sound.js';
import { cueFor, type Cue } from './cues.js';
import { SongVoice } from './engine.js';
import { SONGS, type SongId } from './songs.js';

/** How far ahead bars are scheduled, seconds. */
const AHEAD = 0.35;

interface Playing {
  id: SongId;
  voice: SongVoice;
  /** Context time of the next bar to schedule. */
  nextAt: number;
  nextBar: number;
  /** For a lead-in: the loop that follows it. */
  then?: SongId;
}

let playing: Playing | null = null;
let want: Cue = { song: null, mix: 'full' };
let stingSeq = -1;
let lastPhaseSeq = -1;
let timer: ReturnType<typeof setInterval> | null = null;

function start(id: SongId, cue: Cue, at?: number, then?: SongId): void {
  const sound = getSound();
  if (!sound) return;
  playing?.voice.fadeOut();
  const voice = new SongVoice(sound.ctx, SONGS[id], sound.music, cue.mix);
  playing = { id, voice, nextAt: at ?? sound.ctx.currentTime + 0.08, nextBar: 0, then };
  timer ??= setInterval(pump, 60);
  pump();
}

function stop(): void {
  playing?.voice.fadeOut();
  playing = null;
  if (timer) clearInterval(timer);
  timer = null;
}

/** Schedules bars ahead of the clock; moves from a lead-in to its loop. */
function pump(): void {
  const sound = getSound();
  if (!sound || !playing) return;
  const now = sound.ctx.currentTime;
  // Woken late (a background tab): skip ahead rather than pile up old bars.
  if (playing.nextAt < now - 0.5) playing.nextAt = now + 0.05;
  while (playing && playing.nextAt < now + AHEAD) {
    const p = playing;
    const song = SONGS[p.id];
    if (p.nextBar >= p.voice.plan.bars && !song.loop) {
      if (p.then) start(p.then, want, p.nextAt);
      else stop();
      continue;
    }
    p.voice.scheduleBar(p.nextBar % p.voice.plan.bars, p.nextAt);
    p.nextAt += p.voice.barSeconds;
    p.nextBar++;
  }
}

function sting(id: SongId): void {
  const sound = getSound();
  if (!sound) return;
  const v = new SongVoice(sound.ctx, SONGS[id], sound.music, 'full');
  const at = sound.ctx.currentTime + 0.05;
  for (let b = 0; b < v.plan.bars; b++) v.scheduleBar(b, at + b * v.barSeconds);
  setTimeout(() => v.fadeOut(0.1), (v.plan.bars * v.barSeconds + 2) * 1000);
}

/** Call on every render: follows the room's mode and phase. */
export function updateMusic(view: RoomView): void {
  const cue = cueFor(view.mode, view.phase);
  const newPhase = view.phaseSeq !== lastPhaseSeq;
  lastPhaseSeq = view.phaseSeq;
  want = cue;
  if (!audioReady() || isMuted()) return;
  apply(cue, newPhase ? view.phaseSeq : -1);
}

function apply(cue: Cue, phaseSeq: number): void {
  if (!cue.song) {
    stop();
    return;
  }
  const target = playing?.then ?? playing?.id;
  if (playing && (target === cue.song || cue.keep)) playing.voice.setMix(cue.mix);
  else if (cue.leadIn) start(cue.leadIn, { ...cue, mix: 'full' }, undefined, cue.song);
  else start(cue.song, cue);
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
  if (muted) stop();
  else if (audioReady()) apply(want, -1);
  refreshButton();
});

/** Lowers the music while the host's voice line plays. */
export function duckFor(audio: HTMLAudioElement): void {
  const sound = getSound();
  if (!sound) return;
  const g = sound.music.gain;
  const to = (v: number) => {
    const now = sound.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(v, now, 0.12);
  };
  audio.addEventListener('play', () => to(MUSIC_LEVEL * 0.35));
  for (const ev of ['ended', 'pause', 'error']) audio.addEventListener(ev, () => to(MUSIC_LEVEL));
}

// ---- the sound button ----

let button: HTMLButtonElement | null = null;

function refreshButton(): void {
  if (!button) return;
  const ready = audioReady();
  button.classList.toggle('mu-ask', !ready);
  mount(button, !ready ? '🔊 Click for music' : isMuted() ? '🔇 Sound off' : '🔊 Sound on');
}

/** Puts the sound button on the stage. */
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
  parent.append(button);
  refreshButton();
  // Some browsers let a page the player has used before start audio without a click.
  unlockAudio();
}
