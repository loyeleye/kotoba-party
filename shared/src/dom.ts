// A tiny element builder for the stage and controller pages (no framework in Phase 0).
//
// Japanese text gets two things for free from h(): runs of Japanese in an English element are
// wrapped in <span lang="ja"> (so the stylesheet's phrase-aware line breaking and Japanese font
// apply), and blanks (＿＿＿) and number + counter pairs (400円, 1枚) become unbreakable units.

import { autoFurigana } from './japanese/furigana.js';
import { awardKana } from './japanese/kana.js';

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/** Listeners h() attached, so patch() can swap them when it reuses an element. */
const listeners = new WeakMap<Element, Map<string, EventListener>>();

/** Elements whose children must stay plain text. */
const TEXT_ONLY = new Set(['OPTION', 'TEXTAREA', 'TITLE', 'SCRIPT', 'STYLE', 'PRE', 'RT']);

export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
      let map = listeners.get(el);
      if (!map) listeners.set(el, (map = new Map()));
      map.set(key.slice(2), value);
    } else if (key === 'class') el.className = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  const plain = TEXT_ONLY.has(el.tagName);
  const lang = typeof attrs.lang === 'string' ? attrs.lang : null;
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) el.append(child);
    else if (plain || (lang !== null && lang !== 'ja')) el.append(String(child));
    else if (el.tagName === 'RUBY') el.append(String(child)); // a ruby base is Japanese already
    else el.append(...jpNodes(String(child), lang === 'ja'));
  }
  return el;
}

// ---- Japanese text ----

const JA_CHAR = '\\u3001-\\u303f\\u3041-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\uff01-\\uff3e\\uff40-\\uff60々〆ヶ';
const HAS_JA = new RegExp(`[${JA_CHAR}\\uff3f]`);
/**
 * One pass over a string: a blank with the particle and mark that follow it, a number with its
 * counter, or a run of Japanese (spaces between Japanese words stay inside the run).
 */
// One Japanese character, unless it is an opening bracket right before a blank: that bracket rides
// with the blank, so 「 never ends a line (行末禁則).
const JA_ONE = `(?![「『（](?:＿|_{3}))[${JA_CHAR}]`;
const PIECES = new RegExp(
  `([「『（]?)(＿+|_{3,})([ぁ-ゖ]{0,2}[。、！？」』）]*)` +
    `|(\\d[\\d,.]*\\s?(?:[円枚人回個本匹時分秒点番歳階杯日月年冊台]|えん|まい|ばん|にん))` +
    `|((?:[A-Za-z]+(?=[${JA_CHAR}]))?(?:${JA_ONE})+(?:[ \\u3000]+(?:${JA_ONE})+)*)`,
  'g',
);

/** Splits text into nodes: blanks and number + counter pairs never wrap; Japanese gets lang="ja". */
export function jpNodes(text: string, inJapanese = false): (Node | string)[] {
  if (!HAS_JA.test(text) && !/_{3,}/.test(text)) return [text];
  const out: (Node | string)[] = [];
  let last = 0;
  for (const m of text.matchAll(PIECES)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    last = at + m[0].length;
    if (m[2] !== undefined) {
      const blank = document.createElement('span');
      blank.className = 'jp-blank';
      blank.setAttribute('aria-label', 'blank');
      blank.textContent = '＿＿＿';
      if (!m[1] && !m[3]) out.push(wrapJa([blank], inJapanese));
      else out.push(nowrap([...(m[1] ? [m[1]] : []), blank, ...(m[3] ? [m[3]] : [])], inJapanese));
    } else if (m[4] !== undefined) {
      out.push(nowrap([m[4]], inJapanese));
    } else if (inJapanese) {
      out.push(m[5]!);
    } else {
      out.push(wrapJa([m[5]!], false));
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function nowrap(parts: (Node | string)[], inJapanese: boolean): HTMLElement {
  const span = document.createElement('span');
  span.className = 'nw';
  if (!inJapanese) span.lang = 'ja';
  span.append(...parts);
  return span;
}

function wrapJa(parts: (Node | string)[], inJapanese: boolean): Node {
  if (inJapanese) return parts.length === 1 && parts[0] instanceof Node ? parts[0] : nowrap(parts, true);
  const span = document.createElement('span');
  span.lang = 'ja';
  span.append(...parts);
  return span;
}

/** Japanese with furigana from `[base, reading]` pairs (reading '' for kana). */
/** Whether ruby() can put furigana on this text (hand-written, or worked out from its kana). */
export const hasReading = (jp: { text: string; kana?: string | null; furigana?: readonly (readonly [string, string])[] }): boolean =>
  !!(jp.furigana?.length || (jp.kana && autoFurigana(jp.text, jp.kana)));

export { awardKana };

/** An award title (はくしゅ賞, しりとり王, うそつき名人) with furigana over its kanji. */
export const awardTitle = (title: string): HTMLElement => ruby({ text: title, kana: awardKana(title) });

export function ruby(jp: { text: string; kana?: string | null; furigana?: readonly (readonly [string, string])[] }, attrs: Attrs = {}): HTMLElement {
  // No hand-written segments: work them out from the kana reading when there is one.
  const furigana = jp.furigana?.length ? jp.furigana : jp.kana ? autoFurigana(jp.text, jp.kana) : null;
  if (!furigana?.length) return h('span', { lang: 'ja', ...attrs }, jp.text);
  return h('span', { lang: 'ja', ...attrs }, furigana.map(([base, reading]) => (reading ? h('ruby', {}, base, h('rt', {}, reading)) : base)));
}

// ---- mounting ----

/** Replaces everything in `root`. Use for interactive screens that rebuild on purpose. */
export function mount(root: HTMLElement, ...children: (Child | Child[])[]): void {
  root.replaceChildren(...toNodes(children));
}

/**
 * Updates `root` to match `children`, reusing the elements already there, so CSS transitions
 * run (an HP bar shrinks, a runner moves) and running animations don't restart. Children are
 * matched by tag in order, or by `data-key` when they have one (give list items a key when
 * they can move, and give a one-shot effect a key that changes with its event).
 *
 * `animation-delay` and custom properties ending in `delay` (and `--d`) keep the value they had when the
 * element appeared: renderers set them from "time since the event" so a fresh element starts
 * part-way through, and updating them on a reused element would push a running animation on.
 */
export function patch(root: HTMLElement, ...children: (Child | Child[])[]): void {
  patchChildren(root, toNodes(children).map((c) => (typeof c === 'string' ? document.createTextNode(c) : c)));
}

function toNodes(children: (Child | Child[])[]): (Node | string)[] {
  return children.flat().filter((c): c is Node | string | number => c !== null && c !== undefined && c !== false).map((c) => (c instanceof Node ? c : String(c)));
}

const keyOf = (n: Node): string | null => (n instanceof Element ? n.getAttribute('data-key') : null);

function patchChildren(parent: Element, next: Node[]): void {
  const keyed = new Map<string, Element>();
  for (const c of parent.children) {
    const k = c.getAttribute('data-key');
    if (k !== null) keyed.set(`${c.tagName}:${k}`, c);
  }
  // Drop keyed children that are gone before matching. Otherwise each later sibling would be
  // moved in front of the leaver, and moving an element restarts its CSS animations (a Raid
  // yōkai behind a caught one would jump back to the start of its march).
  const wanted = new Set(next.flatMap((n) => (keyOf(n) === null ? [] : [`${(n as Element).tagName}:${keyOf(n)}`])));
  for (const [id, el] of keyed) {
    if (wanted.has(id)) continue;
    el.remove();
    keyed.delete(id);
  }
  let cursor: ChildNode | null = parent.firstChild;
  for (const n of next) {
    const key = keyOf(n);
    let match: Node | null = null;
    if (key !== null) {
      const id = `${(n as Element).tagName}:${key}`;
      match = keyed.get(id) ?? null;
      keyed.delete(id);
    } else if (cursor && keyOf(cursor) === null && sameKind(cursor, n)) {
      match = cursor;
    }
    if (!match) {
      parent.insertBefore(n, cursor);
      continue;
    }
    morph(match, n);
    if (match === cursor) cursor = cursor.nextSibling;
    else moveBefore(parent, match, cursor);
  }
  while (cursor) {
    const after: ChildNode | null = cursor.nextSibling;
    cursor.remove();
    cursor = after;
  }
}

/** A real reorder: where the browser has `moveBefore`, the moved element keeps its running animations. */
function moveBefore(parent: Element, node: Node, ref: ChildNode | null): void {
  const move = (parent as Element & { moveBefore?: (node: Node, ref: Node | null) => void }).moveBefore;
  if (typeof move === 'function') {
    try {
      move.call(parent, node, ref);
      return;
    } catch {
      // Not movable state-preservingly (another document, say): fall back to a plain move.
    }
  }
  parent.insertBefore(node, ref);
}

function sameKind(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  return !(a instanceof Element) || a.tagName === (b as Element).tagName;
}

function morph(old: Node, next: Node): void {
  if (!(old instanceof Element) || !(next instanceof Element)) {
    if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
    return;
  }
  for (const { name } of [...old.attributes]) if (!next.hasAttribute(name)) old.removeAttribute(name);
  for (const { name, value } of [...next.attributes]) {
    if (name === 'style') syncStyle(old, value);
    else if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  }
  const was = listeners.get(old);
  const now = listeners.get(next);
  if (was || now) {
    for (const [type, fn] of was ?? []) old.removeEventListener(type, fn);
    for (const [type, fn] of now ?? []) old.addEventListener(type, fn);
    if (now) listeners.set(old, now);
    else listeners.delete(old);
  }
  patchChildren(old, [...next.childNodes]);
}

const STICKY = /^(animation-delay|--[\w-]*delay|--d)$/i;
const declarations = (style: string): [string, string][] =>
  style
    .split(';')
    .map((d) => d.split(/:(.*)/s).map((x) => x.trim()) as [string, string])
    .filter(([p, v]) => p && v !== undefined);

function syncStyle(el: Element, next: string): void {
  const prev = el.getAttribute('style') ?? '';
  if (prev === next) return;
  const kept = new Map(declarations(prev).filter(([p]) => STICKY.test(p)));
  const merged = declarations(next)
    .map(([p, v]) => `${p}:${STICKY.test(p) && kept.has(p) ? kept.get(p) : v}`)
    .join(';');
  if (merged !== prev) el.setAttribute('style', merged);
}

/** Places with ties: equal scores share a place (1, 2, 2, 4). */
export function placesOf(scores: readonly number[]): number[] {
  return scores.map((score, i) => (i > 0 && scores[i - 1] === score ? -1 : i + 1)).map((p, i, all) => {
    let j = i;
    while (all[j] === -1) j--;
    return all[j]!;
  });
}

export function formatSeconds(ms: number | null): string {
  if (ms === null) return '';
  return String(Math.ceil(ms / 1000));
}

export const PHASE_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  intro: 'Intro',
  prompt: 'Prompt',
  answer: 'Answer',
  reveal: 'Results',
  encore: 'Encore',
  score: 'Score',
  penalty: 'Penalty',
  finale: 'Finale',
  recap: 'Recap',
};

/** A shape per seat, so seats are told apart by more than colour (colour-blind safe). */
export const SEAT_SHAPES = ['●', '▲', '■', '◆', '★', '♥', '✚', '✿'] as const;
export const seatShape = (seat: number): string => SEAT_SHAPES[(seat - 1) % SEAT_SHAPES.length] ?? '';

/** The level buttons and chips. The beginner level can't read kana yet, so it wears the 🔰 shoshinsha (beginner) mark, not kana. */
export const LEVEL_LABELS: Record<string, string> = { kana: '🔰 New', n5: 'N5', n4: 'N4', n3: 'N3' };

export const HOST_NAMES: Record<string, string> = { pon: 'ポン', chochin: 'ちょうちんさん', fude: 'フデ', nobiko: 'のびこさん' };

// ---- reveal pacing ----

/** Each element enters `stepMs` after the one before it (the .beat-in animation in the stage CSS). */
export function stagger<T extends HTMLElement>(els: T[], stepMs = 160, startMs = 0): T[] {
  els.forEach((el, i) => {
    el.classList.add('beat-in');
    el.style.animationDelay = `${startMs + i * stepMs}ms`;
  });
  return els;
}

/** Beat n of a reveal sheet, as an inline style: things land one beat apart, not all at once. */
export const beat = (n: number, beatMs = 700): string => `animation-delay:${n * beatMs}ms`;
