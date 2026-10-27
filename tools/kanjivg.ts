// Reading KanjiVG stroke files, shared by tools/content-strokes.ts (kana) and
// tools/content-kanji-strokes.ts (kanji). KanjiVG is © Ulrich Apel and contributors, CC BY-SA 3.0;
// anything generated from it carries the attribution.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Pt = [number, number];

export const BOX = 109;
export const TOLERANCE = 1.2 / BOX;
const URL_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';

export function svgFor(char: string, dir: string | undefined): string {
  const file = `${char.codePointAt(0)!.toString(16).padStart(5, '0')}.svg`;
  if (dir) return readFileSync(join(dir, file), 'utf8');
  return execFileSync('curl', ['-sSf', '-m', '30', `${URL_BASE}${file}`], { encoding: 'utf8' });
}

/** The stroke paths in order (kvg:XXXXX-s1, -s2 …). */
export function strokePaths(svg: string): string[] {
  const out: { n: number; d: string }[] = [];
  for (const m of svg.matchAll(/<path[^>]*\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*\bd="([^"]+)"/g)) out.push({ n: Number(m[1]), d: m[2]! });
  return out.sort((a, b) => a.n - b.n).map((x) => x.d);
}

/** Flattens an SVG path (M, L, H, V, C, S and their relative forms) into points. */
export function flatten(d: string): Pt[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let i = 0;
  let cmd = '';
  let cur: Pt = [0, 0];
  let lastCtrl: Pt | null = null;
  const num = () => Number(tokens[i++]);
  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => {
    for (let k = 1; k <= 16; k++) {
      const t = k / 16;
      const u = 1 - t;
      pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const off = (p: Pt): Pt => (rel ? [cur[0] + p[0], cur[1] + p[1]] : p);
    switch (cmd.toUpperCase()) {
      case 'M':
        cur = off([num(), num()]);
        pts.push(cur);
        cmd = rel ? 'l' : 'L';
        lastCtrl = null;
        break;
      case 'L':
        cur = off([num(), num()]);
        pts.push(cur);
        lastCtrl = null;
        break;
      case 'H':
        cur = [rel ? cur[0] + num() : num(), cur[1]];
        pts.push(cur);
        lastCtrl = null;
        break;
      case 'V':
        cur = [cur[0], rel ? cur[1] + num() : num()];
        pts.push(cur);
        lastCtrl = null;
        break;
      case 'C': {
        const p1 = off([num(), num()]);
        const p2 = off([num(), num()]);
        const p3 = off([num(), num()]);
        cubic(cur, p1, p2, p3);
        lastCtrl = p2;
        cur = p3;
        break;
      }
      case 'S': {
        const p1: Pt = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const p2 = off([num(), num()]);
        const p3 = off([num(), num()]);
        cubic(cur, p1, p2, p3);
        lastCtrl = p2;
        cur = p3;
        break;
      }
      case 'Z':
        break;
      default:
        throw new Error(`Unsupported path command ${cmd} in ${d}`);
    }
  }
  return pts;
}

export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  const [a, b] = [pts[0]!, pts.at(-1)!];
  let worst = 0;
  let at = 0;
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    const dist = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (dist > worst) [worst, at] = [dist, k];
  }
  if (worst <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

export const round = (n: number) => Math.round(n * 1000) / 1000;
