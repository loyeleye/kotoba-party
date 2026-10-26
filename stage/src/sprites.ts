// Sprite sheets on the stage: one horizontal strip of square frames per animation, made by
// tools/art/generate.ts (stage/assets/anim). A sheet plays as an <img> inside a box that
// clips it to one frame, stepped across with transform: translateX() and steps(), so frames
// land on whole pixels and the browser only moves a layer. Calm motion and reduced motion
// hold the first frame (style.css).

import { h } from '../../shared/src/dom.js';
import type { HostMood } from '../../shared/src/protocol.js';

export interface Sheet {
  src: string;
  frames: number;
  /** One pass through every frame. */
  ms: number;
}

const ANIM = '/stage/assets/anim';
export const hostSheet = (host: string, kind: 'idle' | HostMood): Sheet => ({ src: `${ANIM}/${host}-${kind}.png`, frames: 8, ms: kind === 'idle' ? 1600 : 900 });
export const hitSheet = (yokai: string): Sheet => ({ src: `${ANIM}/${yokai}-hit.png`, frames: 9, ms: 900 });
export const BOSS_DEFEAT: Sheet = { src: `${ANIM}/yokai-boss-defeat.png`, frames: 9, ms: 1400 };

// ---------- preloading ----------
// Every sheet is fetched and decoded before it is needed, so the first hit or cheer doesn't
// flash an empty box. A sheet that fails (not made yet) is never used: callers fall back.
const ready = new Set<string>();
const failed = new Set<string>();

export function preload(srcs: string[]): void {
  if (typeof Image === 'undefined') return;
  for (const src of srcs) {
    if (ready.has(src) || failed.has(src)) continue;
    const img = new Image();
    img.src = src;
    img.decode().then(
      () => ready.add(src),
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
  private readonly img: HTMLImageElement;
  private host = '';
  private kind: 'idle' | HostMood = 'idle';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly size: number) {
    this.img = h('img', { class: 'sprite-sheet', alt: '', draggable: 'false' }) as HTMLImageElement;
    this.el = h('div', { class: 'sprite host-sprite', 'aria-hidden': 'true' }, this.img);
    this.img.addEventListener('animationend', () => this.ended());
    this.img.onerror = () => this.still();
  }

  /** Shows `host`, reacting with `mood` if the line has one. */
  show(host: string, mood?: HostMood): void {
    if (host !== this.host) {
      this.host = host;
      this.el.classList.remove('enter');
      void this.el.offsetWidth;
      this.el.classList.add('enter');
    }
    this.play(mood && !calm() ? mood : 'idle', mood === undefined);
  }

  /** Every host's sheets, to preload. */
  static sheets(hosts: string[]): string[] {
    return hosts.flatMap((host) => (['idle', 'cheer', 'oops'] as const).map((k) => hostSheet(host, k).src));
  }

  private play(kind: 'idle' | HostMood, wait: boolean): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.kind = kind;
    const sheet = hostSheet(this.host, kind);
    if (!isReady(sheet.src)) {
      // No sheet (yet): the still portrait, as before animation.
      if (kind !== 'idle' && isReady(hostSheet(this.host, 'idle').src)) return this.play('idle', true);
      return this.still();
    }
    this.el.classList.remove('still');
    this.el.setAttribute('style', spriteStyle(sheet, this.size));
    if (this.img.getAttribute('src') !== sheet.src) this.img.src = sheet.src;
    this.img.classList.remove('run');
    if (wait) return this.later();
    void this.img.offsetWidth;
    this.img.classList.add('run');
  }

  private still(): void {
    this.el.classList.add('still');
    this.el.setAttribute('style', `--size:${this.size}px;--frames:1`);
    const src = `/stage/assets/hosts/${this.host}.png`;
    if (this.img.getAttribute('src') !== src) this.img.src = src;
  }

  private ended(): void {
    this.img.classList.remove('run');
    if (this.kind !== 'idle') this.play('idle', true);
    else this.later();
  }

  /** The next idle breath, a few seconds from now. */
  private later(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (calm() || !this.el.isConnected || this.kind !== 'idle') return this.later();
      void this.img.offsetWidth;
      this.img.classList.add('run');
    }, 2500 + Math.random() * 3000);
  }
}
