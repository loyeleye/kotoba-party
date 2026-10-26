// Brush strokes as SVG, for Ink Storm's replays and Oekaki's drawings on the stage and the
// phone. Each stroke is a path drawn on with a CSS animation (pathLength 1 +
// stroke-dashoffset), one after another in stroke order. `elapsedMs` starts the animation
// part-way through (a negative delay), so a re-render never restarts a replay already playing.

import type { InkPoint } from './japanese/strokes.js';

const SVG = 'http://www.w3.org/2000/svg';

export interface InkSvgOptions {
  class?: string;
  /** Time per stroke, ms (default 450). */
  strokeMs?: number;
  /** How far into the replay we are, ms (default 0: start now). */
  elapsedMs?: number;
  /** Draw a faint practice grid (the 田 lines of practice paper). */
  grid?: boolean;
  /** Mark where each stroke starts with its number. */
  numbers?: boolean;
  /** A CSS colour per stroke (Oekaki's palette); strokes without one keep the stylesheet's ink. */
  colors?: readonly (string | undefined)[];
  /** Stroke width in viewBox units (the box is 100 wide); default from the stylesheet. */
  width?: number;
}

export function inkSvg(strokes: readonly (readonly InkPoint[])[], opts: InkSvgOptions = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', `ink-svg ${opts.class ?? ''}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  if (opts.grid) {
    for (const d of ['M50 0V100', 'M0 50H100']) {
      const line = document.createElementNS(SVG, 'path');
      line.setAttribute('d', d);
      line.setAttribute('class', 'ink-grid');
      svg.append(line);
    }
  }
  const per = opts.strokeMs ?? 450;
  const labels: [number, number][] = [];
  const elapsed = opts.elapsedMs ?? 0;
  strokes.forEach((s, i) => {
    if (!s.length) return;
    const pts = s.length === 1 ? [s[0]!, [s[0]![0] + 0.004, s[0]![1] + 0.004] as const] : s;
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', pts.map(([x, y], j) => `${j ? 'L' : 'M'}${(x * 100).toFixed(1)} ${(y * 100).toFixed(1)}`).join(''));
    path.setAttribute('pathLength', '1');
    path.setAttribute('class', 'ink-stroke');
    const color = opts.colors?.[i];
    const look = `${color ? `stroke:${color};` : ''}${opts.width ? `stroke-width:${opts.width};` : ''}`;
    path.setAttribute('style', `${look}animation-duration:${per}ms;animation-delay:${i * per - elapsed}ms`);
    svg.append(path);
    if (opts.numbers) {
      const n = document.createElementNS(SVG, 'text');
      let [x, y] = [Math.min(92, Math.max(2, pts[0]![0] * 100 - 6)), Math.min(96, Math.max(8, pts[0]![1] * 100 - 3))];
      // Strokes that start in the same place (ウ's 2 and 3) get their numbers side by side.
      for (let t = 0; t < 6 && labels.some(([lx, ly]) => Math.abs(lx - x) < 6 && Math.abs(ly - y) < 8); t++) x = x > 80 ? x - 7 : x + 7;
      labels.push([x, y]);
      n.setAttribute('x', String(x));
      n.setAttribute('y', String(y));
      n.setAttribute('class', 'ink-num');
      n.setAttribute('style', `animation-delay:${i * per - elapsed}ms`);
      n.textContent = String(i + 1);
      svg.append(n);
    }
  });
  return svg;
}
