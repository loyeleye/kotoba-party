// The stage's one AudioContext, shared by the music, the sound effects and Karaoke Duel's backing
// track. Browsers only start audio after a click or key press on the page, so the first one unlocks
// it. Mute is one switch for everything; it and the settings panel's volumes are remembered in this
// browser.

type Ctor = typeof AudioContext;
const AudioCtor: Ctor | undefined =
  typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) : undefined;

const MUTE_KEY = 'kotoba:muted';
/** The music bus's resting level. */
export const MUSIC_LEVEL = 0.55;

export interface Sound {
  ctx: AudioContext;
  /** The loops go here: ducked under voices. Feeds the background music volume. */
  music: GainNode;
  /** Jingles and Karaoke Duel's backing track: background music volume, never ducked. */
  backing: GainNode;
  /** Sound effects (sfx.ts): the sound effects volume. */
  sfx: GainNode;
}

/** The settings panel's four volumes, 0 to 1. Host voice covers the browser's read-aloud Japanese too. */
export interface Volumes {
  master: number;
  host: number;
  sfx: number;
  music: number;
}
export type VolumeId = keyof Volumes;

const VOLUME_KEY = 'kotoba:volumes';
const DEFAULT_VOLUMES: Volumes = { master: 1, host: 1, sfx: 0.8, music: 1 };

let sound: Sound | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let muted = readMuted();
const volumes = readVolumes();
const muteListeners: ((muted: boolean) => void)[] = [];
const readyListeners: (() => void)[] = [];
const volumeListeners: ((v: Volumes) => void)[] = [];

function readVolumes(): Volumes {
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}') as Partial<Volumes>;
    const v = { ...DEFAULT_VOLUMES };
    for (const k of Object.keys(v) as VolumeId[]) if (typeof saved[k] === 'number') v[k] = Math.max(0, Math.min(1, saved[k]));
    return v;
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

/** Slider position to gain: a square law, so the bottom half of the slider is usable. */
const curve = (x: number): number => x * x;

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
    master.gain.value = muted ? 0 : curve(volumes.master);
    // A gentle limiter so stacked parts never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = curve(volumes.music);
    musicGain.connect(master);
    const music = ctx.createGain();
    music.gain.value = MUSIC_LEVEL;
    music.connect(musicGain);
    const backing = ctx.createGain();
    backing.connect(musicGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = curve(volumes.sfx);
    sfxGain.connect(master);
    const sfx = ctx.createGain();
    sfx.connect(sfxGain);
    sound = { ctx, music, backing, sfx };
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
    masterGain.gain.setTargetAtTime(value ? 0 : curve(volumes.master), now, 0.05);
  }
  muteListeners.forEach((f) => f(value));
}

export const getVolumes = (): Volumes => ({ ...volumes });

/** Sets one volume (0 to 1) and remembers it in this browser. */
export function setVolume(id: VolumeId, value: number): void {
  volumes[id] = Math.max(0, Math.min(1, value));
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
  } catch {
    // private mode: not remembered
  }
  const node = { master: muted ? null : masterGain, music: musicGain, sfx: sfxGain, host: null }[id];
  if (sound && node) node.gain.setTargetAtTime(curve(volumes[id]), sound.ctx.currentTime, 0.03);
  volumeListeners.forEach((f) => f(getVolumes()));
}

export function onVolumeChange(fn: (v: Volumes) => void): void {
  volumeListeners.push(fn);
}

/** The level for a host's voice line or the browser's read-aloud speech (an element's volume, 0 to 1). */
export const voiceVolume = (): number => (muted ? 0 : curve(volumes.master) * curve(volumes.host));

export function onMuteChange(fn: (muted: boolean) => void): void {
  muteListeners.push(fn);
}

if (typeof document !== 'undefined') {
  // Any click or key on the stage (the VIP's start, a skip, the sound button) unlocks audio.
  // Some browsers (iOS Safari among them) only count the end of a tap, so listen for both ends.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => unlockAudio(), { capture: true });
}
