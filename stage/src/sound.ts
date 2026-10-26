// The stage's one AudioContext, shared by the music and Karaoke Duel's backing track. Browsers
// only start audio after a click or key press on the page, so the first one unlocks it. Mute is
// one switch for everything and is remembered in this browser.

type Ctor = typeof AudioContext;
const AudioCtor: Ctor | undefined =
  typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) : undefined;

const MUTE_KEY = 'kotoba:muted';
/** The music bus's resting level. */
export const MUSIC_LEVEL = 0.55;

export interface Sound {
  ctx: AudioContext;
  /** Music goes here: ducked under the host's voice. */
  music: GainNode;
  /** Everything else (Karaoke Duel's backing track). */
  sfx: GainNode;
}

let sound: Sound | null = null;
let masterGain: GainNode | null = null;
let muted = readMuted();
const muteListeners: ((muted: boolean) => void)[] = [];
const readyListeners: (() => void)[] = [];

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The shared context and buses, created on first use; null where Web Audio is missing. */
export function getSound(): Sound | null {
  if (!AudioCtor) return null;
  if (!sound) {
    const ctx = new AudioCtor();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    // A gentle limiter so stacked parts never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = MUSIC_LEVEL;
    music.connect(master);
    const sfx = ctx.createGain();
    sfx.connect(master);
    sound = { ctx, music, sfx };
    ctx.addEventListener('statechange', ready);
    // Some browsers start it running (the player has used the page before): no statechange then.
    queueMicrotask(ready);
    masterGain = master;
  }
  return sound;
}

export const audioSupported = (): boolean => !!AudioCtor;

/** True once the page may play sound. */
export function audioReady(): boolean {
  return !!sound && sound.ctx.state === 'running';
}

/** Call from a click or key press: unlocks audio for the rest of the session. */
export function unlockAudio(): void {
  void getSound()?.ctx.resume();
}

function ready(): void {
  if (sound?.ctx.state === 'running') readyListeners.forEach((f) => f());
}

/** Runs `fn` whenever audio starts running. */
export function onAudioReady(fn: () => void): void {
  readyListeners.push(fn);
}

export const isMuted = (): boolean => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // private mode: not remembered
  }
  if (sound && masterGain) {
    const now = sound.ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(value ? 0 : 1, now, 0.05);
  }
  muteListeners.forEach((f) => f(value));
}

export function onMuteChange(fn: (muted: boolean) => void): void {
  muteListeners.push(fn);
}

if (typeof document !== 'undefined') {
  // Any click or key on the stage (the VIP's start, a skip, the sound button) unlocks audio.
  // Some browsers (iOS Safari among them) only count the end of a tap, so listen for both ends.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => unlockAudio(), { capture: true });
}
