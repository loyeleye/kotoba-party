// The offline kana drawing check (design doc, "Kana drawing grader (hybrid)"): compares the
// strokes a phone recorded with a KanjiVG-style reference for count, order and direction,
// and scores the shape. Pure and deterministic, so the server grades and tests replay it.
//
// How it works: both drawings are fitted into the same box (centred, longest side 1, so
// size and position on the canvas don't matter), every stroke is resampled to evenly spaced
// points, and then
//   - shape: how far the drawing's ink is from the reference's and back (a two-way mean
//     nearest-point distance), mixed with the per-stroke distance when the counts match;
//   - order: whether stroke i lines up best with reference stroke i, or a reshuffle fits better;
//   - direction: whether each long stroke runs start → end like the reference (short dots
//     and ticks are never checked; nobody can tell which way a dot went).
// It leans towards yes (forgiving by design): one stroke too many or too few still passes
// when the shape is clearly right, and a wrong order still lands. A reversed long stroke
// does not pass: for ソ/ン and シ/ツ the direction *is* the letter. Scribbles (far more ink
// than the kana has, or ink all over the box) and tiny marks never pass.

/** A point in the drawing box, 0–1, x right, y down. */
export type InkPoint = readonly [number, number];
export type InkStroke = readonly InkPoint[];

export type InkTipKey = 'ok' | 'empty' | 'scribble' | 'shape' | 'too-few' | 'too-many' | 'direction' | 'order';

export interface InkGrade {
  /** Same number of strokes as the reference. */
  strokeCountOk: boolean;
  /** Strokes drawn in the reference's order (only checked when the count matches). */
  orderOk: boolean;
  /** Every long stroke runs the reference's way (only checked when the count matches). */
  directionOk: boolean;
  /** 0 (nothing like it) … 1 (the reference itself). */
  shapeScore: number;
  /** The drawing counts as the kana. */
  pass: boolean;
  /** Passed with the right count, order and direction. */
  clean: boolean;
  /** What to say about it: the most useful single thing. */
  tip: InkTipKey;
  expected: number;
  drawn: number;
  /** The reference stroke (1-based) the tip is about, for order and direction tips. */
  stroke?: number;
}

// ---------- tuning ----------

/** Points per stroke after resampling. */
const SAMPLES = 24;
/** Shape score needed to pass, and to pass with one stroke too many or too few. */
export const INK_PASS = 0.5;
export const INK_PASS_OFF_BY_ONE = 0.62;
/** A drawing smaller than this share of the canvas (longest side) is a tap, not a kana. */
const MIN_SIZE = 0.06;
/** Strokes at least this long (in the fitted box) have their direction checked. */
const LONG_STROKE = 0.3;
/** More ink than this many times the reference's is a scribble. */
const MAX_INK = 2.6;
/** Distances that map to a shape score of 1 and 0. */
const DIST_GOOD = 0.035;
const DIST_BAD = 0.2;

// ---------- geometry ----------

type P = [number, number];

const dist = (a: InkPoint, b: InkPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function length(s: InkStroke): number {
  let n = 0;
  for (let i = 1; i < s.length; i++) n += dist(s[i - 1]!, s[i]!);
  return n;
}

/** Centres the drawing and scales its longest side to 1 (the same transform for every stroke). */
function fit(strokes: readonly InkStroke[]): { strokes: P[][]; size: number } {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of strokes) for (const [x, y] of s) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  const size = Math.max(x1 - x0, y1 - y0);
  const k = 1 / Math.max(size, 1e-6);
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  return { strokes: strokes.map((s) => s.map(([x, y]): P => [0.5 + (x - cx) * k, 0.5 + (y - cy) * k])), size };
}

/** `n` points evenly spaced along the stroke. */
export function resample(s: InkStroke, n = SAMPLES): P[] {
  if (s.length === 0) return [];
  const total = length(s);
  if (s.length === 1 || total < 1e-9) return Array.from({ length: n }, (): P => [s[0]![0], s[0]![1]]);
  const out: P[] = [[s[0]![0], s[0]![1]]];
  const step = total / (n - 1);
  let want = step;
  let walked = 0;
  for (let i = 1; i < s.length && out.length < n; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    const seg = dist(a, b);
    while (seg > 0 && walked + seg >= want - 1e-9 && out.length < n) {
      const t = (want - walked) / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      want += step;
    }
    walked += seg;
  }
  while (out.length < n) out.push([s.at(-1)![0], s.at(-1)![1]]);
  return out;
}

/** Mean distance between matching points of two resampled strokes, as drawn and reversed. */
function strokeDist(a: P[], b: P[]): { fwd: number; rev: number } {
  let fwd = 0;
  let rev = 0;
  for (let i = 0; i < a.length; i++) {
    fwd += dist(a[i]!, b[i]!);
    rev += dist(a[i]!, b[b.length - 1 - i]!);
  }
  return { fwd: fwd / a.length, rev: rev / a.length };
}

/** Two-way mean nearest-point distance between two point clouds (the larger of the two directions). */
function chamfer(a: P[], b: P[]): number {
  const oneWay = (from: P[], to: P[]) => from.reduce((sum, p) => sum + Math.min(...to.map((q) => dist(p, q))), 0) / Math.max(1, from.length);
  return Math.max(oneWay(a, b), oneWay(b, a));
}

const score = (d: number) => Math.max(0, Math.min(1, 1 - (d - DIST_GOOD) / (DIST_BAD - DIST_GOOD)));

/** All orderings of 0..n-1 (n is at most 6 here). */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1)) for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n - 1, ...rest.slice(i)]);
  return out;
}

// ---------- the grader ----------

interface Match {
  shapeScore: number;
  orderOk: boolean;
  /** Reference stroke (0-based) drawn the wrong way round. */
  reversed?: number;
  /** First reference stroke (0-based) drawn out of order. */
  outOfOrder?: number;
}

/** Lines up two drawings with the same stroke count and scores them. */
function matchStrokes(mine: P[][], ref: P[][]): Match {
  const n = ref.length;
  const a = mine.map((s) => resample(s));
  const b = ref.map((s) => resample(s));
  const d = a.map((s) => b.map((r) => strokeDist(s, r)));
  const cost = (i: number, j: number) => Math.min(d[i]![j]!.fwd, d[i]![j]!.rev);
  const total = (perm: readonly number[]) => perm.reduce((sum, j, i) => sum + cost(i, j), 0);
  const identity = Array.from({ length: n }, (_, i) => i);
  let best = identity;
  let bestCost = total(identity);
  if (n <= 6) {
    for (const perm of permutations(n)) {
      const c = total(perm);
      if (c < bestCost - 1e-9) [best, bestCost] = [perm, c];
    }
  }
  // A reshuffle has to fit clearly better before we call the order wrong.
  let orderOk = total(identity) - bestCost <= 0.02 * n;
  let mapping = orderOk ? identity : best;
  // Kanji have too many strokes to try every order: a drawn stroke that clearly fits another
  // reference stroke better than its own counts as out of order.
  let greedyOut: number | undefined;
  if (n > 6) {
    for (let i = 0; i < n && greedyOut === undefined; i++) {
      for (let j = 0; j < n; j++) if (j !== i && cost(i, j) + 0.04 < cost(i, i) && cost(j, i) + 0.04 < cost(j, j)) greedyOut = Math.min(i, j);
    }
    orderOk = greedyOut === undefined;
    mapping = identity;
  }
  const glyph = chamfer(a.flat(), b.flat());
  const shapeScore = round(score(0.5 * glyph + 0.5 * (total(mapping) / n)));
  let reversed: number | undefined;
  mapping.forEach((j, i) => {
    if (reversed !== undefined || length(ref[j]!) < LONG_STROKE) return;
    const { fwd, rev } = d[i]![j]!;
    if (rev + 0.03 < fwd) reversed = j;
  });
  const outOfOrder = orderOk ? undefined : (greedyOut ?? mapping.findIndex((j, i) => j !== i));
  return { shapeScore, orderOk, ...(reversed !== undefined ? { reversed } : {}), ...(outOfOrder !== undefined ? { outOfOrder } : {}) };
}

/** Every way of joining two neighbouring strokes into one (a stroke written without lifting the brush). */
function joinings(strokes: P[][]): P[][][] {
  const out: P[][][] = [];
  for (let i = 0; i + 1 < strokes.length; i++) out.push([...strokes.slice(0, i), [...strokes[i]!, ...strokes[i + 1]!], ...strokes.slice(i + 2)]);
  return out;
}

/**
 * Grades a drawing against a reference. `drawn` comes from the phone in canvas units (0–1);
 * `reference` is the content's stroke list for the kana. Never throws.
 */
export function gradeInk(drawn: readonly InkStroke[], reference: readonly InkStroke[]): InkGrade {
  const strokes = drawn.filter((s) => s.length > 0);
  const expected = reference.length;
  const base = { expected, drawn: strokes.length, strokeCountOk: strokes.length === expected };
  const fail = (tip: InkTipKey, shapeScore = 0): InkGrade => ({ orderOk: false, directionOk: false, shapeScore, pass: false, clean: false, tip, ...base });
  if (!strokes.length || !expected) return fail('empty');
  const mine = fit(strokes);
  if (mine.size < MIN_SIZE) return fail('empty');
  const ref = fit(reference);
  const ink = mine.strokes.reduce((n, s) => n + length(s), 0);
  const refInk = ref.strokes.reduce((n, s) => n + length(s), 0);
  if (ink > MAX_INK * refInk + 0.5 || strokes.length > expected + 3) {
    return fail('scribble', round(score(chamfer(mine.strokes.flatMap((s) => resample(s)), ref.strokes.flatMap((s) => resample(s))))));
  }

  if (strokes.length !== expected) {
    // One stroke off: maybe two strokes written in one go (or one written in two). Score the
    // best joining; anything further off only gets a shape score for the tip.
    const diff = strokes.length - expected;
    const tries = diff === -1 ? joinings(ref.strokes).map((r) => matchStrokes(mine.strokes, r)) : diff === 1 ? joinings(mine.strokes).map((m) => matchStrokes(m, ref.strokes)) : [];
    const best = tries.sort((x, y) => y.shapeScore - x.shapeScore)[0];
    const shapeScore = best?.shapeScore ?? round(score(chamfer(mine.strokes.flatMap((s) => resample(s)), ref.strokes.flatMap((s) => resample(s)))));
    const pass = !!best && shapeScore >= INK_PASS_OFF_BY_ONE && best.reversed === undefined;
    const tip: InkTipKey = shapeScore < INK_PASS ? 'shape' : diff < 0 ? 'too-few' : 'too-many';
    return { orderOk: !!best?.orderOk, directionOk: !!best && best.reversed === undefined, shapeScore, pass, clean: false, tip, ...base };
  }

  const m = matchStrokes(mine.strokes, ref.strokes);
  const directionOk = m.reversed === undefined;
  let tip: InkTipKey = 'ok';
  let stroke: number | undefined;
  if (m.shapeScore < INK_PASS) tip = 'shape';
  else if (!directionOk) [tip, stroke] = ['direction', m.reversed! + 1];
  else if (!m.orderOk) [tip, stroke] = ['order', m.outOfOrder! + 1];
  const pass = m.shapeScore >= INK_PASS && directionOk;
  return { orderOk: m.orderOk, directionOk, shapeScore: m.shapeScore, pass, clean: pass && m.orderOk, tip, ...base, ...(stroke ? { stroke } : {}) };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------- one stroke at a time (tracing) ----------

export type StrokeCheck = 'ok' | 'reversed' | 'off';

/** How far (mean point distance, share of the pad) a traced stroke may stray from its ghost. */
export const TRACE_TOLERANCE = 0.085;
/** The "steady hand" setting's looser tolerance. */
export const TRACE_TOLERANCE_LOOSE = 0.125;
/** Strokes shorter than this (in the 0–1 box) are dots and ticks: their direction is never checked. */
const DOT = 0.14;

/**
 * Checks one stroke traced over its ghost, in pad coordinates (the ghost is the reference stroke
 * drawn where it stands in the 0–1 box, so no fitting). Used on the phone the moment a finger lifts
 * and again on the server. A long stroke run backwards is 'reversed'; anything else too far from
 * the ghost (or far longer than it) is 'off'.
 */
export function checkStroke(drawn: InkStroke, reference: InkStroke, tolerance = TRACE_TOLERANCE): StrokeCheck {
  if (!drawn.length || !reference.length) return 'off';
  const refLen = length(reference);
  if (length(drawn) > 2.2 * refLen + 0.12) return 'off';
  const { fwd, rev } = strokeDist(resample(drawn), resample(reference));
  if (refLen < DOT) return Math.min(fwd, rev) <= tolerance * 1.3 ? 'ok' : 'off';
  if (fwd <= tolerance) return 'ok';
  return rev <= tolerance && rev + 0.02 < fwd ? 'reversed' : 'off';
}

// ---------- tips ----------

/** Where a stroke starts and which way it heads, in words ("from the top-left down"). */
export function strokeWay(s: InkStroke): string {
  const a = s[0];
  const b = s.at(-1);
  if (!a || !b) return '';
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const vert = Math.abs(dy) > 0.5 * Math.abs(dx) ? (dy > 0 ? 'down' : 'up') : '';
  const horiz = Math.abs(dx) > 0.5 * Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : '';
  const from = [dy > 0 ? 'top' : dy < 0 ? 'bottom' : '', dx > 0 ? 'left' : dx < 0 ? 'right' : ''].filter(Boolean);
  const way = vert && horiz ? `${vert} and to the ${horiz}` : vert || `to the ${horiz}`;
  return `starts at the ${from.join('-') || 'top'} and goes ${way}`;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** One kind line about a drawing. Never romaji. */
export function inkTipText(g: InkGrade, char: string, reference: readonly InkStroke[]): string {
  const strokes = `${g.expected} stroke${g.expected === 1 ? '' : 's'}`;
  const nth = (i: number) => ORDINAL[i - 1] ?? `${i}th`;
  switch (g.tip) {
    case 'ok':
      return `Beautiful ${char}!`;
    case 'empty':
      return `Draw ${char} big: use the whole box.`;
    case 'scribble':
      return `Fude can’t read a scribble! ${char} has ${strokes}.`;
    case 'shape':
      return `That didn’t look like ${char}. It has ${strokes}: watch the replay.`;
    case 'too-few':
      return `${char} has ${strokes}; you drew ${g.drawn}. Lift the brush between strokes.`;
    case 'too-many':
      return `${char} has ${strokes}; you drew ${g.drawn}.`;
    case 'direction': {
      const s = reference[(g.stroke ?? 1) - 1];
      return `${char}’s ${nth(g.stroke ?? 1)} stroke ${s ? strokeWay(s) : 'runs the other way'}.`;
    }
    case 'order':
      return `Right shape! Stroke order: ${char}’s ${nth(g.stroke ?? 1)} stroke ${reference[(g.stroke ?? 1) - 1] ? strokeWay(reference[(g.stroke ?? 1) - 1]!) : 'comes earlier'}.`;
  }
}

// ---------- wire format ----------

/** Limits on a drawing coming off the wire. Kana have at most 4 strokes; this leaves room for mistakes. */
export const INK_MAX_STROKES = 12;
export const INK_MAX_POINTS = 64;
export const INK_MAX_TOTAL_POINTS = 400;

/** Wire limits for a drawing. Ink Storm uses the defaults; free drawing (Oekaki) passes larger ones. */
export interface InkLimits {
  strokes: number;
  /** Points per stroke. */
  points: number;
  /** Points in the whole drawing. */
  total: number;
}

export const INK_LIMITS: InkLimits = { strokes: INK_MAX_STROKES, points: INK_MAX_POINTS, total: INK_MAX_TOTAL_POINTS };

/** Kanji (Shodō Taikai): up to 20 strokes in a two-kanji word cell, with room for slips. */
export const KANJI_LIMITS: InkLimits = { strokes: 24, points: 48, total: 900 };

/**
 * Reads a drawing off the wire: an array of strokes, each an array of [x, y] in 0–1 (values
 * a little outside are clamped). Returns null for anything else or anything over the limits.
 */
export function readInk(raw: unknown, limits: InkLimits = INK_LIMITS): InkPoint[][] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > limits.strokes) return null;
  const out: InkPoint[][] = [];
  let total = 0;
  for (const s of raw) {
    if (!Array.isArray(s) || s.length === 0 || s.length > limits.points) return null;
    total += s.length;
    if (total > limits.total) return null;
    const stroke: InkPoint[] = [];
    for (const p of s) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const [x, y] = p as unknown[];
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) return null;
      stroke.push([round(Math.min(1, Math.max(0, x))), round(Math.min(1, Math.max(0, y)))]);
    }
    out.push(stroke);
  }
  return out;
}

/** Thins a stroke to at most `max` points (evenly along it), for the stage replay and the wire. */
export function thin(s: InkStroke, max: number): InkPoint[] {
  if (s.length <= max) return s.map((p) => [p[0], p[1]] as InkPoint);
  return resample(s, max).map(([x, y]) => [round(x), round(y)] as InkPoint);
}

/**
 * Thins strokes to fit `limits` for the wire: at most `limits.strokes` strokes, each at most
 * `limits.points` points, and `limits.total` in all, shared out by how many points each stroke
 * has (so a long line keeps more detail than a dot).
 */
export function thinToLimits(strokes: readonly InkStroke[], limits: InkLimits = INK_LIMITS): InkPoint[][] {
  const kept = strokes.filter((s) => s.length).slice(0, limits.strokes);
  const want = kept.map((s) => Math.min(s.length, limits.points));
  const sum = want.reduce((n, w) => n + w, 0);
  let alloc = want;
  if (sum > limits.total) {
    const k = limits.total / sum;
    alloc = want.map((w) => Math.max(Math.min(2, w), Math.floor(w * k)));
    // The two-point floor can overshoot by a little: trim the longest until it fits.
    for (let over = alloc.reduce((n, a) => n + a, 0) - limits.total; over > 0; over--) {
      const i = alloc.indexOf(Math.max(...alloc));
      alloc[i] = alloc[i]! - 1;
    }
  }
  return kept.map((s, i) => thin(s, Math.max(1, alloc[i]!)));
}
