// Sprite sheets on the stage: one horizontal strip of square frames per animation, made by
// tools/art/generate.ts (stage/assets/anim). A sheet plays as an <img> inside a box that
// clips it to one frame, stepped across with transform: translateX() and steps(), so frames
// land on whole pixels and the browser only moves a layer. Calm motion and reduced motion
// hold the first frame (style.css).

import { h } from '../../shared/src/dom.js';
import type { HostMood, HostSay } from '../../shared/src/protocol.js';

export interface Sheet {
  src: string;
  frames: number;
  /** One pass through every frame. */
  ms: number;
}

const ANIM = '/stage/assets/anim';
export const hostSheet = (host: string, kind: 'idle' | HostMood): Sheet => ({ src: `${ANIM}/${host}-${kind}.png`, frames: 8, ms: kind === 'idle' ? 1600 : 900 });
/** Lip sync: three mouth shapes, closed, half open, wide open. Shown one at a time, not played. */
export const talkSheet = (host: string): Sheet => ({ src: `${ANIM}/${host}-talk.png`, frames: 3, ms: 0 });
/** A caught yōkai: its flinch, then the shared smoke puff (tools/art/polish.ts), at 10 frames a second. */
export const hitSheet = (yokai: string): Sheet => timed(`${ANIM}/${yokai}-hit.png`, 100);
export const BOSS_DEFEAT: Sheet = { src: `${ANIM}/yokai-boss-defeat.png`, frames: 9, ms: 1400 };

/** A one-shot whose frame count is read off the sheet itself (square frames side by side). */
function timed(src: string, frameMs: number): Sheet {
  const frames = frameCount.get(src) ?? 9;
  return { src, frames, ms: frames * frameMs };
}

// ---------- preloading ----------
// Every sheet is fetched and decoded before it is needed, so the first hit or cheer doesn't
// flash an empty box. A sheet that fails (not made yet) is never used: callers fall back.
const ready = new Set<string>();
const failed = new Set<string>();
const frameCount = new Map<string, number>();

export function preload(srcs: string[]): void {
  if (typeof Image === 'undefined') return;
  for (const src of srcs) {
    if (ready.has(src) || failed.has(src)) continue;
    const img = new Image();
    img.src = src;
    img.decode().then(
      () => {
        if (img.naturalHeight) frameCount.set(src, Math.round(img.naturalWidth / img.naturalHeight));
        ready.add(src);
      },
      () => failed.add(src),
    );
  }
}

export const isReady = (src: string): boolean => ready.has(src);

/** Calm motion (the VIP's switch) or the system's reduced-motion setting. */
export const calm = (): boolean =>
  document.body.dataset.motion === 'calm' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/**
 * A box showing one frame of a sheet. `play` runs it once (a poof ends on an empty frame, since
 * the strip slides out of the box); `loop` repeats. Size is in CSS pixels, a whole multiple of
 * the frame size.
 */
export function spriteEl(sheet: Sheet, size: number, how: 'once' | 'loop' | 'poof', cls = ''): HTMLElement {
  const img = h('img', { class: 'sprite-sheet', src: sheet.src, alt: '', draggable: 'false' });
  return h('div', { class: `sprite ${how} ${cls}`.trim(), style: spriteStyle(sheet, size), 'aria-hidden': 'true' }, img);
}

export const spriteStyle = (sheet: Sheet, size: number): string => `--size:${size}px;--frames:${sheet.frames};--ms:${sheet.ms}ms`;

// ---------- the host ----------
/**
 * The host sprite beside the speech bubble. It stays on screen across lines: a new line only
 * swaps the bubble, a new host slides in, and a line with a mood plays that reaction once
 * before going back to idle. Idle plays one breath every few seconds, not a constant loop.
 */
export class HostSprite {
  readonly el: HTMLElement;
  /** The sheet on show. Each sheet keeps its own <img> (see `use`). */
  private img: HTMLImageElement;
  private readonly imgs = new Map<string, HTMLImageElement>();
  private host = '';
  private kind: 'idle' | HostMood = 'idle';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private size: number) {
    this.img = this.sheetImg('');
    this.el = h('div', { class: 'sprite host-sprite', 'aria-hidden': 'true' }, this.img);
  }

  /**
   * One <img> per sheet, made once and kept. Swapping a single <img>'s src showed the old sheet
   * with the new sheet's frame count (three squeezed hosts, or half a frame) until the new src
   * loaded, and the live site revalidates every image (max-age=0), so that took a round trip each
   * time. An <img> that keeps its src keeps its picture, so the frames always match.
   */
  private sheetImg(src: string): HTMLImageElement {
    let img = this.imgs.get(src);
    if (!img) {
      const made = h('img', { class: 'sprite-sheet', alt: '', draggable: 'false' }) as HTMLImageElement;
      made.addEventListener('animationend', () => made === this.img && this.ended());
      made.onerror = () => made === this.img && this.still();
      if (src) made.src = src;
      this.imgs.set(src, (img = made));
    }
    return img;
  }

  /** Shows `src` in a box styled for it. */
  private use(src: string, style: string): void {
    const img = this.sheetImg(src);
    this.el.setAttribute('style', style);
    if (img === this.img) return;
    this.img.classList.remove('run');
    this.img.style.transform = '';
    this.img.replaceWith(img);
    this.img = img;
  }

  /** Shows `host`, reacting with `mood` if the line has one. */
  show(host: string, mood?: HostMood): void {
    if (host !== this.host) {
      this.host = host;
      // Start loading this host's sheets now, so each is ready before it's first shown.
      for (const k of ['idle', 'cheer', 'oops'] as const) this.sheetImg(hostSheet(host, k).src);
      this.sheetImg(talkSheet(host).src);
      this.el.classList.remove('enter');
      void this.el.offsetWidth;
      this.el.classList.add('enter');
    }
    this.play(mood && !calm() ? mood : 'idle', mood === undefined);
  }

  /** A new on-screen size in CSS px (the stage picks one that lands on whole device pixels). */
  resize(size: number): void {
    if (size === this.size) return;
    this.size = size;
    this.el.style.setProperty('--size', `${size}px`);
  }

  /** Every host's sheets, to preload. */
  static sheets(hosts: string[]): string[] {
    return hosts.flatMap((host) => [...(['idle', 'cheer', 'oops'] as const).map((k) => hostSheet(host, k).src), talkSheet(host).src]);
  }

  /**
   * Moves the mouth while the host speaks. With VOICEVOX's timing (`mouth`) the shapes follow the
   * audio clock; with audio but no timing they flap; with no audio at all (subtitles only) they flap
   * for about as long as the line would take to say. A reaction plays first; the mouth joins after.
   */
  talk(audio: HTMLAudioElement | null, mouth: HostSay['mouth'], kana: string): void {
    this.stopTalking();
    const sheet = talkSheet(this.host);
    if (calm() || !isReady(sheet.src)) return;
    const start = performance.now();
    const silentMs = Math.min(6000, [...kana.replace(/[\s、。！？!?…ー・]/g, '')].length * 130);
    const flap = [1, 2, 1, 0];
    const tick = (now: number) => {
      this.talkRaf = 0;
      let shape: number | null;
      if (audio) {
        if (audio.ended || (audio.paused && audio.currentTime > 0)) shape = null;
        else if (mouth?.length) shape = shapeAt(mouth, audio.currentTime * 1000);
        else shape = audio.currentTime > 0 ? flap[Math.floor((audio.currentTime * 1000) / 110) % 4]! : 0;
      } else shape = now - start < silentMs ? flap[Math.floor((now - start) / 110) % 4]! : null;
      if (shape === null || !this.el.isConnected) return this.stopTalking();
      if (this.kind === 'idle') this.mouthShape(shape);
      this.talkRaf = requestAnimationFrame(tick);
    };
    this.talkRaf = requestAnimationFrame(tick);
  }

  private talking = false;
  private talkRaf = 0;

  private mouthShape(shape: number): void {
    const sheet = talkSheet(this.host);
    if (!this.talking) {
      this.talking = true;
      if (this.idleTimer !== null) clearTimeout(this.idleTimer);
      this.idleTimer = null;
      this.img.classList.remove('run');
      this.el.classList.remove('still');
      this.use(sheet.src, spriteStyle(sheet, this.size));
    }
    this.img.style.transform = `translateX(${(-100 * shape) / sheet.frames}%)`;
  }

  private stopTalking(): void {
    if (this.talkRaf) cancelAnimationFrame(this.talkRaf);
    this.talkRaf = 0;
    if (!this.talking) return;
    this.talking = false;
    this.img.style.transform = '';
    if (this.kind === 'idle') this.play('idle', true);
  }

  private play(kind: 'idle' | HostMood, wait: boolean): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.talking) {
      this.talking = false;
      this.img.style.transform = '';
    }
    this.kind = kind;
    const sheet = hostSheet(this.host, kind);
    if (!isReady(sheet.src)) {
      // No sheet (yet): the still portrait, as before animation.
      if (kind !== 'idle' && isReady(hostSheet(this.host, 'idle').src)) return this.play('idle', true);
      return this.still();
    }
    this.el.classList.remove('still');
    this.use(sheet.src, spriteStyle(sheet, this.size));
    this.img.classList.remove('run');
    if (wait) return this.later();
    void this.img.offsetWidth;
    this.img.classList.add('run');
  }

  private still(): void {
    this.el.classList.add('still');
    this.use(`/stage/assets/hosts/${this.host}.png`, `--size:${this.size}px;--frames:1`);
  }

  private ended(): void {
    this.img.classList.remove('run');
    if (this.talking) return;
    if (this.kind !== 'idle') this.play('idle', true);
    else this.later();
  }

  /** The next idle breath, a few seconds from now. */
  private later(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (calm() || !this.el.isConnected || this.kind !== 'idle' || this.talking) return this.later();
      void this.img.offsetWidth;
      this.img.classList.add('run');
    }, 2500 + Math.random() * 3000);
  }
}

/** The mouth shape at `ms` into a track, or null once the track is over. */
export function shapeAt(track: NonNullable<HostSay['mouth']>, ms: number): number | null {
  let t = 0;
  for (const [shape, len] of track) {
    t += len;
    if (ms < t) return shape;
  }
  return null;
}
