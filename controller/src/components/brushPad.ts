// Shodō Taikai's writing pad: one square of practice paper per character, with an optional
// model (KanjiVG strokes) drawn under the ink.
//
//   trace  the model in grey, the next stroke's start marked with a red dot and its number;
//          each stroke is checked the moment the finger lifts (checkStroke) and a wrong one
//          fades out with a short tip, so nobody practises a mistake. The rep sends itself
//          once the last stroke is right.
//   faint  the same, with the model barely there.
//   free   no model, Undo / Clear / Send (writing from memory and the hand-in sheets). A
//          word has one square per character, picked with the 1 · 2 tabs above the paper.
//
// Strokes in progress live here, keyed like inkPad's, so a redrawn screen keeps them.

import { brushPath } from '../../../shared/src/brush.js';
import { h } from '../../../shared/src/dom.js';
import { checkStroke, KANJI_LIMITS, strokeHeading, traceTolerance, type InkPoint, type InkStroke } from '../../../shared/src/japanese/strokes.js';
import { forWire } from './inkPad.js';

type Stroke = InkPoint[];

export type PadMode = 'trace' | 'faint' | 'free';

interface Draft {
  cells: Stroke[][];
  cell: number;
  corrections: number;
}

const drafts = new Map<string, Draft>();

export interface BrushPadOptions {
  key: string;
  mode: PadMode;
  /** Squares to write (characters). */
  cells: number;
  /** The model per square: required for trace and faint, optional (a faint guide) for free. */
  model?: InkPoint[][][] | null;
  sendLabel?: string;
  label?: string;
  /** Kana-level players: the trace check starts a step looser. */
  beginner?: boolean;
  /** Free pads: the sheet so far, a moment after each change, so time running out doesn't lose it. */
  onDraft?(cells: InkPoint[][][]): void;
  /** Called with each square's strokes and the strokes the pad had to correct. */
  onSend(cells: InkPoint[][][], corrections: number): Promise<boolean> | void;
}

const MIN_STEP = 0.012;

// "Steady hand" (accessibility): a looser trace check, kept on this phone.
const STEADY_KEY = 'kotoba.steadyHand';
export function steadyHand(): boolean {
  try {
    return localStorage.getItem(STEADY_KEY) === '1';
  } catch {
    return false;
  }
}
export function setSteadyHand(on: boolean): void {
  try {
    localStorage.setItem(STEADY_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the setting lasts this screen */
  }
}

export function brushPad(opts: BrushPadOptions): HTMLElement {
  for (const k of drafts.keys()) if (k !== opts.key) drafts.delete(k);
  const draft = drafts.get(opts.key) ?? { cells: Array.from({ length: opts.cells }, () => []), cell: 0, corrections: 0 };
  drafts.set(opts.key, draft);
  const checking = opts.mode !== 'free' && !!opts.model?.[0]?.length;
  const ref = (cell: number): readonly InkStroke[] => opts.model?.[cell] ?? [];

  const canvas = h('canvas', { class: 'sho-canvas', 'aria-label': opts.label ?? 'Writing pad' }) as HTMLCanvasElement;
  const tip = h('p', { class: 'sho-tip', role: 'status', 'aria-live': 'polite' });
  const undo = h('button', { type: 'button', class: 'secondary' }, '↶ Undo') as HTMLButtonElement;
  const clear = h('button', { type: 'button', class: 'secondary' }, checking ? 'Start over' : 'Clear') as HTMLButtonElement;
  const send = h('button', { type: 'button', class: 'primary sho-send' }, opts.sendLabel ?? 'Hand it in 🖌') as HTMLButtonElement;
  const count = h('span', { class: 'sho-count' });
  const tabs = opts.cells > 1 ? Array.from({ length: opts.cells }, (_, i) => h('button', { type: 'button', class: 'sho-cell-tab', 'aria-pressed': String(i === draft.cell) }, `${i + 1}`) as HTMLButtonElement) : [];
  const wrap = h(
    'div',
    { class: `sho-pad sho-${opts.mode}` },
    tabs.length ? h('div', { class: 'sho-cell-tabs', role: 'group', 'aria-label': 'Which character' }, h('span', { class: 'hint' }, 'Character'), tabs) : null,
    h('div', { class: 'sho-paper' }, canvas),
    tip,
    // Hand-in sits right under the paper, above Undo / Clear, so it stays above the fold (UX panel).
    checking ? null : send,
    checking ? h('div', { class: 'sho-tools' }, count, clear) : h('div', { class: 'sho-tools' }, undo, count, clear),
  );

  let ctx: CanvasRenderingContext2D | null = null;
  let size = 0;
  let current: Stroke | null = null;
  let pointer: number | null = null;
  let sending = false;
  let wrong: Stroke | null = null;
  let wrongTimer: ReturnType<typeof setTimeout> | null = null;

  const strokes = () => draft.cells[draft.cell]!;
  const total = () => draft.cells.reduce((n, c) => n + c.length, 0);
  const full = () => (checking ? strokes().length >= ref(draft.cell).length : strokes().length >= KANJI_LIMITS.strokes);

  const refresh = () => {
    const n = strokes().length;
    undo.disabled = n === 0 || sending;
    clear.disabled = n === 0 || sending;
    send.disabled = sending || draft.cells.some((c) => c.length === 0);
    const want = ref(draft.cell).length;
    count.textContent = checking ? `Stroke ${Math.min(n + 1, want)} of ${want}` : n ? `${n} stroke${n === 1 ? '' : 's'}` : 'Write it!';
    tabs.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === draft.cell));
      b.classList.toggle('done', draft.cells[i]!.length > 0);
    });
  };

  const line = (s: readonly InkPoint[], width: number, style: string) => {
    if (!ctx || !s.length) return;
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.beginPath();
    ctx.moveTo(s[0]![0] * size, s[0]![1] * size);
    if (s.length === 1) ctx.lineTo(s[0]![0] * size + 0.5, s[0]![1] * size + 0.5);
    for (const [x, y] of s.slice(1)) ctx.lineTo(x * size, y * size);
    ctx.stroke();
  };

  const paint = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const css = getComputedStyle(canvas);
    const ink = css.color || '#1b1712';
    const model = ref(draft.cell);
    const done = strokes().length;
    if (model.length && opts.mode !== 'free') {
      const ghost = opts.mode === 'trace' ? 'rgba(60, 50, 40, 0.22)' : 'rgba(60, 50, 40, 0.08)';
      model.forEach((s) => line(s, size * 0.075, ghost));
      // The next stroke: a darker ghost (trace only), a red start dot and its number.
      const next = model[done];
      if (next?.length) {
        if (opts.mode === 'trace') line(next, size * 0.075, 'rgba(60, 50, 40, 0.38)');
        const [x, y] = next[0]!;
        ctx.fillStyle = '#c8102e';
        ctx.beginPath();
        ctx.arc(x * size, y * size, Math.max(6, size * 0.025), 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `bold ${Math.round(size * 0.05)}px system-ui, sans-serif`;
        ctx.fillText(String(done + 1), x * size + size * 0.03, y * size - size * 0.03);
      }
    } else if (model.length) {
      model.forEach((s) => line(s, size * 0.075, 'rgba(60, 50, 40, 0.06)'));
    }
    // Finished strokes in the same brush as the TV; the one under the finger stays a quick line.
    strokes().forEach((s) => {
      if (s === current || typeof Path2D === 'undefined') return line(s, Math.max(4, size * 0.045), ink);
      ctx!.fillStyle = ink;
      ctx!.fill(new Path2D(brushPath(s, Math.max(5, size * 0.06), size)));
    });
    if (wrong) line(wrong, Math.max(4, size * 0.045), 'rgba(200, 16, 46, 0.55)');
  };

  const resize = () => {
    const w = canvas.getBoundingClientRect().width;
    if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    size = w;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  };

  const at = (e: PointerEvent): InkPoint => {
    const r = canvas.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };

  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  const saveDraft = () => {
    if (!opts.onDraft || checking) return;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (!sending) opts.onDraft?.(draft.cells.map((c) => (c.length ? forWire(c, KANJI_LIMITS) : [])));
    }, 400);
  };

  const submit = () => {
    if (sending) return;
    sending = true;
    if (draftTimer) clearTimeout(draftTimer);
    refresh();
    const cells = draft.cells.map((c) => forWire(c, KANJI_LIMITS));
    void Promise.resolve(opts.onSend(cells, draft.corrections)).then((ok) => {
      sending = false;
      if (ok === false) refresh();
      else drafts.delete(opts.key);
    });
  };

  // A traced stroke, checked as the finger lifts.
  const judge = (s: Stroke) => {
    const want = ref(draft.cell)[strokes().length - 1];
    if (!want) return;
    const verdict = checkStroke(s, want, traceTolerance(!!opts.beginner, steadyHand()));
    if (verdict === 'ok') {
      tip.textContent = '';
      if (full()) submit();
      return;
    }
    strokes().pop();
    draft.corrections += 1;
    wrong = s;
    if (wrongTimer) clearTimeout(wrongTimer);
    wrongTimer = setTimeout(() => {
      wrong = null;
      paint();
    }, 600);
    navigator.vibrate?.(30);
    tip.textContent = verdict === 'reversed' ? `Other way: this stroke goes ${strokeHeading(want)}.` : `Start at the red dot and go ${strokeHeading(want)}.`;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (sending || pointer !== null || full()) return;
    e.preventDefault();
    pointer = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    if (!ctx) resize();
    current = [at(e)];
    strokes().push(current);
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
    const s = current;
    if (s) {
      const p = at(e);
      const last = s.at(-1)!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.002) s.push(p);
    }
    current = null;
    if (s && checking) judge(s);
    else saveDraft();
    paint();
    refresh();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  undo.addEventListener('click', () => {
    strokes().pop();
    saveDraft();
    paint();
    refresh();
  });
  clear.addEventListener('click', () => {
    strokes().length = 0;
    tip.textContent = '';
    saveDraft();
    paint();
    refresh();
  });
  send.addEventListener('click', () => {
    if (total() && !draft.cells.some((c) => c.length === 0)) submit();
  });
  tabs.forEach((b, i) =>
    b.addEventListener('click', () => {
      draft.cell = i;
      paint();
      refresh();
    }),
  );

  requestAnimationFrame(resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => resize()).observe(canvas);
  refresh();
  return wrap;
}
