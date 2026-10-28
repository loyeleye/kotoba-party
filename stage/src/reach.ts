// Nobiko-san's long reach: her neck snakes out of the host box to the card the mode marks `.host-target`
// (Omiai's winning answer), she has a look over its top edge, and springs back. Unlike the sprite sheets
// it is drawn live, on a canvas over the whole stage at her art-pixel resolution, so the neck and head
// land on the same whole-pixel grid as the sprite wherever the card is. Her body and head come from
// nobiko-reach.png (tools/art/sources/nobiko-peek.py): frame 0 the body without its neck, frame 1 her
// head mirrored to face the middle of the screen.

import { bezier, paintNeck, type Pt } from './neck.js';

const PARTS = '/stage/assets/anim/nobiko-reach.png';
/** Where the neck leaves the collar, and where it meets the mirrored head (art pixels in their frames). */
const BASE = { x: 42, y: 88 };
const HEAD_CHIN = { x: 60, y: 63 };
/** The neck end at rest: where the portrait's chin is. */
const REST = { x: 59, y: 63 };
const MS = 2600;

let parts: HTMLImageElement | null = null;

/** Starts loading her parts; the reach is skipped until they're in. */
export function preloadReach(): void {
  if (parts || typeof Image === 'undefined') return;
  parts = new Image();
  parts.src = PARTS;
}

export const reachReady = (): boolean => !!parts?.complete && parts.naturalWidth > 0;

/**
 * Plays the reach from `sprite` (the host box, `size` canvas px for 128 art px) to `.host-target`.
 * Returns a function that stops it early, or null, doing nothing, when there is no target on screen.
 * `done` runs when she is back (not when stopped).
 */
export function reach(sprite: HTMLElement, size: number, done: () => void): (() => void) | null {
  const stage = sprite.closest<HTMLElement>('.canvas');
  const target = () => stage?.querySelector<HTMLElement>('.host-target') ?? null;
  if (!stage || !parts || !reachReady() || !target()) return null;
  const ap = size / 128; // canvas px per art pixel
  const canvas = document.createElement('canvas');
  canvas.className = 'host-reach';
  canvas.width = Math.ceil(stage.offsetWidth / ap);
  canvas.height = Math.ceil(stage.offsetHeight / ap);
  canvas.style.width = `${canvas.width * ap}px`;
  canvas.style.height = `${canvas.height * ap}px`;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  stage.append(canvas);
  sprite.classList.add('reaching');

  // Positions in art pixels on the canvas, from layout boxes (the stage is scaled, so divide that out).
  const art = (el: HTMLElement) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = (s.width / stage.offsetWidth) * ap; // screen px per art pixel
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
  };
  const origin = art(sprite);
  const o = { x: Math.round(origin.x), y: Math.round(origin.y) };
  // Her chin rests on the card's top edge near its right end, so her face peers over without covering the answer.
  let goal: Pt = { x: 0, y: 0 };
  const aim = () => {
    const t = target();
    if (!t) return;
    const r = art(t);
    goal = { x: Math.round(r.x + r.w - 36 / ap) - o.x, y: Math.round(r.y + 10 / ap) - o.y };
  };
  aim();

  const start = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / MS);
    if (p < 0.6) aim(); // the card can still be settling into place
    // Out fast (0–30%), a look with a little bob (30–80%), and a spring back (80–100%).
    const e = p < 0.3 ? 1 - (1 - p / 0.3) ** 3 : p < 0.8 ? 1 : 1 - ((p - 0.8) / 0.2) ** 2;
    const bob = p >= 0.3 && p < 0.8 ? Math.round(Math.sin((p - 0.3) * 4 * Math.PI)) : 0;
    const chin = { x: Math.round(REST.x + (goal.x - REST.x) * e), y: Math.round(REST.y + (goal.y - REST.y) * e) + bob };
    draw(ctx, o, chin);
    if (p < 1) raf = requestAnimationFrame(frame);
    else {
      stop();
      done();
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    canvas.remove();
    sprite.classList.remove('reaching');
  };
  raf = requestAnimationFrame(frame);
  return stop;
}

/** One frame: the neck from collar to chin, the body over its base, then the head. */
function draw(ctx: CanvasRenderingContext2D, o: Pt, chin: Pt): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const base = { x: o.x + BASE.x, y: o.y + BASE.y };
  const end = { x: o.x + chin.x, y: o.y + chin.y };
  const d = Math.max(0, chin.x - REST.x);
  const sag = Math.min(14, d / 6);
  // Up out of the collar, then a long S to the chin, sagging a little more the further she reaches.
  paintNeck(ctx, bezier(base, { x: base.x + 2, y: base.y - 22 }, { x: end.x - 12 - d / 3, y: end.y + 10 + sag }, end));
  ctx.drawImage(parts!, 0, 0, 128, 128, o.x, o.y, 128, 128);
  ctx.drawImage(parts!, 128, 0, 128, 128, end.x - HEAD_CHIN.x, end.y - HEAD_CHIN.y, 128, 128);
}
