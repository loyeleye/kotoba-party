// A brush look for ink strokes: each stroke becomes a filled outline that is thicker where the
// brush lands, keeps its weight through the body, and either stops square-ish (とめ) or thins
// out in a sweep (はらい) when it heads down and off to one side. Used by inkSvg's `brush` option
// for Shodō Taikai's models, replays and gallery sheets. Pure: strings in, strings out.
//
// The endings are drawn, never graded (the Japanese panel: とめ・はね・はらい belong in the
// look, not the check). Whether a stroke sweeps is read from its last stretch, so a player's own
// strokes get the same treatment as KanjiVG's.

import type { InkPoint } from './japanese/strokes.js';

type P = [number, number];

/** Chaikin corner cutting, keeping the end points: a polyline from the phone looks like a brush. */
function smooth(pts: P[], rounds = 2): P[] {
  let out = pts;
  for (let r = 0; r < rounds && out.length > 2; r++) {
    const next: P[] = [out[0]!];
    for (let i = 0; i + 1 < out.length; i++) {
      const [a, b] = [out[i]!, out[i + 1]!];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    next.push(out.at(-1)!);
    out = next;
  }
  return out;
}

const len = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** True when the stroke ends in a sweep: its last stretch heads down and clearly sideways. */
export function sweeps(stroke: readonly InkPoint[]): boolean {
  if (stroke.length < 2) return false;
  const total = stroke.reduce((n, p, i) => (i ? n + len(stroke[i - 1] as P, p as P) : 0), 0);
  if (total < 0.18) return false;
  // The point about 30% of the length back from the end.
  let walked = 0;
  let from = stroke[0]!;
  for (let i = stroke.length - 1; i > 0; i--) {
    walked += len(stroke[i - 1] as P, stroke[i] as P);
    from = stroke[i - 1]!;
    if (walked >= 0.3 * total) break;
  }
  const end = stroke.at(-1)!;
  const [dx, dy] = [end[0] - from[0], end[1] - from[1]];
  return dy > 0.02 && Math.abs(dx) > 0.35 * dy;
}

/**
 * The outline of one stroke as an SVG path, in a 0–`scale` box. `width` is the body width in the
 * same units. A single point (a dot) is a round blot.
 */
export function brushPath(stroke: readonly InkPoint[], width: number, scale = 100): string {
  const f = (n: number) => n.toFixed(1);
  if (!stroke.length) return '';
  const raw: P[] = stroke.map(([x, y]) => [x * scale, y * scale]);
  // Drop jitter closer than half a brush width (a finger's wobble would fold the outline into
  // curls), keeping the true end.
  const kept: P[] = [raw[0]!];
  for (const p of raw.slice(1)) if (len(kept.at(-1)!, p) > width * 0.5) kept.push(p);
  if (kept.length > 1 && len(kept.at(-1)!, raw.at(-1)!) > 0.05) kept[kept.length - 1] = raw.at(-1)!;
  else if (kept.length === 1 && raw.length > 1) kept.push(raw.at(-1)!);
  const pts = smooth(kept);
  if (pts.length < 2 || len(pts[0]!, pts.at(-1)!) < width * 0.3) {
    const [x, y] = pts[0]!;
    const r = width * 0.62;
    return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + len(pts[i - 1]!, pts[i]!));
  const total = cum.at(-1)! || 1;
  const sweep = sweeps(stroke);
  // Landing (打ち込み) a little heavy, an even body, then a stop or a long taper.
  const profile = (t: number) => {
    const land = t < 0.12 ? 1.18 - 0.18 * (t / 0.12) : 1;
    const tail = sweep ? (t > 0.55 ? Math.max(0.12, 1 - ((t - 0.55) / 0.45) * 0.88) : 1) : t > 0.9 ? 1.06 : 1;
    return land * tail;
  };
  const left: P[] = [];
  const right: P[] = [];
  pts.forEach((p, i) => {
    // Normals from a wider window, so a tight wiggle can't flip the outline inside out.
    const a = pts[Math.max(0, i - 2)]!;
    const b = pts[Math.min(pts.length - 1, i + 2)]!;
    const d = len(a, b) || 1;
    const [nx, ny] = [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
    const w = (width * profile(cum[i]! / total)) / 2;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  });
  const r0 = (width * profile(0)) / 2;
  const r1 = (width * profile(1)) / 2;
  const line = (ps: P[]) => ps.map(([x, y]) => `L${f(x)} ${f(y)}`).join('');
  return `M${f(left[0]![0])} ${f(left[0]![1])}${line(left.slice(1))}A${f(r1)} ${f(r1)} 0 0 0 ${f(right.at(-1)![0])} ${f(right.at(-1)![1])}${line(right.slice(0, -1).reverse())}A${f(r0)} ${f(r0)} 0 0 0 ${f(left[0]![0])} ${f(left[0]![1])}Z`;
}
