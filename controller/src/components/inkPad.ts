// A drawing pad for Ink Storm: a square canvas the player draws a kana on with a finger,
// stroke by stroke, with Undo, Clear and Send. Records each stroke's points (0–1 of the
// pad, start → end) in the order drawn. The canvas sets touch-action: none so drawing never
// scrolls the page, and fits any phone from 320 px wide.
//
// The phone redraws its screen when the game state moves on, so the strokes in progress
// live here, keyed by attack id, and a redrawn pad picks up where the finger left off.

import { h } from '../../../shared/src/dom.js';
import { INK_MAX_POINTS, INK_MAX_STROKES, INK_MAX_TOTAL_POINTS, thin, type InkPoint } from '../../../shared/src/japanese/strokes.js';

type Stroke = InkPoint[];

const drafts = new Map<string, Stroke[]>();

export interface InkPadOptions {
  /** Keeps the drawing across redraws (the attack id). */
  key: string;
  sendLabel?: string;
  onSend(strokes: InkPoint[][]): Promise<boolean> | void;
}

/** A point is kept once the finger has moved this far (share of the pad). */
const MIN_STEP = 0.012;

/** The strokes thinned to the wire limits. */
export function forWire(strokes: readonly Stroke[]): InkPoint[][] {
  const kept = strokes.filter((s) => s.length).slice(0, INK_MAX_STROKES);
  const per = Math.min(INK_MAX_POINTS, Math.floor(INK_MAX_TOTAL_POINTS / Math.max(1, kept.length)));
  return kept.map((s) => thin(s, per).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as InkPoint));
}

export function inkPad(opts: InkPadOptions): HTMLElement {
  for (const k of drafts.keys()) if (k !== opts.key) drafts.delete(k);
  const strokes = drafts.get(opts.key) ?? [];
  drafts.set(opts.key, strokes);

  const canvas = h('canvas', { class: 'ink-canvas', 'aria-label': 'Drawing pad: draw the kana here' }) as HTMLCanvasElement;
  const undo = h('button', { type: 'button', class: 'secondary ink-undo' }, '↶ Undo') as HTMLButtonElement;
  const clear = h('button', { type: 'button', class: 'secondary ink-clear' }, 'Clear') as HTMLButtonElement;
  const send = h('button', { type: 'button', class: 'primary ink-send' }, opts.sendLabel ?? 'Cast it! 🖌') as HTMLButtonElement;
  const count = h('span', { class: 'ink-count' });
  const wrap = h(
    'div',
    { class: 'ink-pad' },
    h('div', { class: 'ink-paper' }, canvas),
    h('div', { class: 'ink-tools' }, undo, count, clear),
    send,
  );

  let ctx: CanvasRenderingContext2D | null = null;
  let size = 0;
  let current: Stroke | null = null;
  let pointer: number | null = null;
  let sending = false;

  const refresh = () => {
    const n = strokes.length;
    undo.disabled = n === 0 || sending;
    clear.disabled = n === 0 || sending;
    send.disabled = n === 0 || sending;
    count.textContent = n ? `${n} stroke${n === 1 ? '' : 's'}` : 'Draw it!';
  };

  const paint = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(canvas).color || '#111';
    ctx.lineWidth = Math.max(4, size * 0.035);
    for (const s of strokes) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0]![0] * size, s[0]![1] * size);
      if (s.length === 1) ctx.lineTo(s[0]![0] * size + 0.5, s[0]![1] * size + 0.5);
      for (const [x, y] of s.slice(1)) ctx.lineTo(x * size, y * size);
      ctx.stroke();
    }
  };

  const resize = () => {
    const css = canvas.getBoundingClientRect().width;
    if (!css) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    size = css;
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  };

  const at = (e: PointerEvent): InkPoint => {
    const r = canvas.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (sending || pointer !== null || strokes.length >= INK_MAX_STROKES) return;
    e.preventDefault();
    pointer = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    if (!ctx) resize();
    current = [at(e)];
    strokes.push(current);
    paint();
    refresh();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer || !current) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = at(ev);
      const last = current.at(-1)!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_STEP && current.length < 400) current.push(p);
    }
    paint();
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    if (current) {
      const p = at(e);
      const last = current.at(-1)!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.002) current.push(p);
    }
    current = null;
    paint();
    refresh();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  undo.addEventListener('click', () => {
    strokes.pop();
    paint();
    refresh();
  });
  clear.addEventListener('click', () => {
    strokes.length = 0;
    paint();
    refresh();
  });
  send.addEventListener('click', () => {
    if (!strokes.length || sending) return;
    sending = true;
    refresh();
    void Promise.resolve(opts.onSend(forWire(strokes))).then((ok) => {
      sending = false;
      if (ok === false) refresh();
      else drafts.delete(opts.key);
    });
  });

  // Size the canvas once it's on the page, and again when the phone turns.
  requestAnimationFrame(resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => resize()).observe(canvas);
  refresh();
  return wrap;
}
