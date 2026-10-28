// Nobiko-san's neck, drawn live at her art-pixel resolution: the same three passes as her sheets
// (tools/art/sources/nobiko-peek.py), so a neck drawn here matches the one in her peek and sway.
// Her long reach (reach.ts) and Narabete!'s ruler (drawRuler) both paint with it.

export type Pt = { x: number; y: number };

const INK = [11, 6, 5];
const SHADE = [155, 98, 94];
const SKIN = [251, 222, 190];
/** Outline, shade and skin radii in art pixels: a neck about 12 art pixels thick. */
const R = { ink: 6.2, shade: 5.2, skin: 4.2 };

/** Points along a cubic Bézier, about `step` art pixels apart. */
export function bezier(p0: Pt, c1: Pt, c2: Pt, p1: Pt, step = 0.66): Pt[] {
  const n = Math.max(20, Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / step));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u ** 3 * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * p1.x,
      y: u ** 3 * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * p1.y,
    });
  }
  return pts;
}

/** Paints a neck along `pts` (art pixels on the canvas): outline, shade, then skin set a pixel up. Points snap to
 * whole pixels, so its edges run in clean steps instead of picking up stray one-pixel notches. */
export function paintNeck(ctx: CanvasRenderingContext2D, path: Pt[]): void {
  const { width, height } = ctx.canvas;
  const pts: Pt[] = [];
  for (const q of path) {
    const p = { x: Math.round(q.x), y: Math.round(q.y) };
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  }
  if (!pts.length) return;
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((q) => q.x)) - 8));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((q) => q.y)) - 8));
  const x1 = Math.min(width, Math.ceil(Math.max(...pts.map((q) => q.x)) + 8));
  const y1 = Math.min(height, Math.ceil(Math.max(...pts.map((q) => q.y)) + 8));
  if (x1 <= x0 || y1 <= y0) return;
  // Callers paint the neck first, on a cleared canvas, so its box starts empty (no readback).
  const img = ctx.createImageData(x1 - x0, y1 - y0);
  const disc = (cx: number, cy: number, r: number, c: number[]) => {
    for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) {
        if (x < x0 || y < y0 || x >= x1 || y >= y1 || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
        const i = ((y - y0) * img.width + (x - x0)) * 4;
        img.data[i] = c[0]!;
        img.data[i + 1] = c[1]!;
        img.data[i + 2] = c[2]!;
        img.data[i + 3] = 255;
      }
    }
  };
  for (const q of pts) disc(q.x, q.y, R.ink, INK);
  for (const q of pts) disc(q.x, q.y, R.shade, SHADE);
  for (const q of pts) disc(q.x, q.y - 1, R.skin, SKIN);
  ctx.putImageData(img, x0, y0);
}

/**
 * Narabete!'s ruler: her neck rises out of the collar at `collar`, runs level along `line` (the y the
 * cards hang from) and ends under her chin at `chin`. Between pegs it droops a little, as if the cards
 * pull it down; the droop is deepest halfway between two pegs, and `breath` (0 or 1) deepens it a pixel as she
 * breathes. Returns the points, so the caller can hang pegs and knots on the same pixels.
 */
export function rulerPoints(collar: Pt, chin: Pt, line: number, pegs: number[], breath = 0): Pt[] {
  // Out of the collar and into the chin on short curves, so the ends meet her body and head at any height.
  const left = collar.x + 12;
  const right = chin.x - 12;
  const rise = bezier(collar, { x: collar.x + 2, y: collar.y + (line - collar.y) * 0.8 }, { x: collar.x + 6, y: line }, { x: left, y: line });
  const fall = bezier({ x: right, y: line }, { x: chin.x - 6, y: line }, { x: chin.x - 2, y: chin.y + (line - chin.y) * 0.8 }, chin);
  const stops = [left, ...pegs.filter((x) => x > left && x < right).sort((a, b) => a - b), right];
  const mid: Pt[] = [];
  for (let k = 1; k < stops.length; k++) {
    const a = stops[k - 1]!;
    const b = stops[k]!;
    const sag = Math.min(3, (b - a) / 30) + (b - a > 60 ? breath : 0);
    for (let x = a; x < b; x += 0.66) {
      const t = (x - a) / (b - a);
      mid.push({ x, y: line + 4 * sag * t * (1 - t) });
    }
  }
  return [...rise, ...mid, ...fall];
}

/** A knot tied in the ruler: `x` where it sits, `frame` 0 loose loop, 1 cinching, 2 tied (with a cramp). */
export interface Knot {
  x: number;
  frame: 0 | 1 | 2;
}

/** The knot sheet (tools/art/sources/narabete-art.py): 3 frames, 72x50, the neck's centre line 8 from the top, the loop hanging below. */
export const KNOT = { w: 72, h: 50, line: 8 };
/** The clothes peg (same script): 10x17, its spring 6 from the top, which sits on the neck's centre line. */
export const PEG = { w: 10, h: 17, spring: 7 };

/**
 * Draws Narabete!'s ruler on `ctx` (art pixels): the neck from `collar` to `chin` along `line`, a peg
 * at each of `pegs` where a card hangs from it, and its knots. The neck stays level at every peg and
 * knot and droops a little between them, so it doesn't move when a knot ties.
 */
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  r: { collar: Pt; chin: Pt; line: number; pegs: number[]; knots: Knot[]; breath?: number },
  art: { knot: HTMLImageElement; peg: HTMLImageElement },
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  // Level under each knot's straight tails too, so the sprite meets the neck with no step.
  const stops = [...r.pegs, ...r.knots.flatMap((k) => [k.x - KNOT.w / 2, k.x, k.x + KNOT.w / 2])].map(Math.round);
  paintNeck(ctx, rulerPoints(r.collar, r.chin, r.line, stops, r.breath));
  for (const k of r.knots) {
    ctx.drawImage(art.knot, k.frame * KNOT.w, 0, KNOT.w, KNOT.h, Math.round(k.x - KNOT.w / 2), r.line - KNOT.line, KNOT.w, KNOT.h);
  }
  for (const x of r.pegs) ctx.drawImage(art.peg, Math.round(x - PEG.w / 2), r.line - PEG.spring, PEG.w, PEG.h);
}
