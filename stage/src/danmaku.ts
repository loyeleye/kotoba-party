// The lobby's 弾幕 (danmaku): game titles fly right to left across the stage, the way comments
// cross a Niconico video, each in its game's colour: the Japanese title with furigana on top,
// the English under it. Big titles run in full-width lanes above the lobby panel, where they read
// whole; small ones drift past beside it as background. Calm motion, reduced motion and this
// screen's own "Flying titles" switch turn them off; the lobby then shows the still list (main.ts).

import { h, ruby } from '../../shared/src/dom.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';

/** Readings for the furigana over each title's kanji. */
export const TITLE_KANA: Record<string, string> = {
  'kana-raid': 'かなようかいレイド',
  oogiri: 'おおぎりナイト',
  'last-train': 'しゅうでん',
  'word-gauntlet': 'ことばのかんもん',
  concentration: 'ことばしんけいすいじゃく',
  'phrase-bingo': 'フレーズビンゴげきじょう',
  'karaoke-duel': 'カラオケたいけつ',
  'onsen-murder': 'おんせんさつじんじけん',
  oekaki: 'おえかき',
  shodo: 'しょどうたいかい',
};

/** Japanese size (px) for the lanes above the panel, and for the small lanes beside it. */
const BIG = [40, 52];
const SMALL = 30;
/** A two-line title (furigana, Japanese, English) needs about this many times its size. */
const LANE_RATIO = 2.1;
/** Speed across the screen in px/s, the same for every size so a title never catches the one ahead. */
const SPEED = 120;
/** A new title every this many ms (±30%), never more than this many on screen. */
const EVERY = 2300;
const MAX_ON_SCREEN = 9;
/** How many titles are already part-way across when the lobby opens, so it never starts empty. */
const PREFILL = 5;
/** Gap between a title's tail and the next title in its lane, px. */
const GAP = 140;

const OFF_KEY = 'kotoba:danmaku';
let enabled = ((): boolean => {
  try {
    return localStorage.getItem(OFF_KEY) !== 'off';
  } catch {
    return true;
  }
})();
let onToggle: (() => void) | null = null;
/** This screen's own switch (stage settings), so anyone at the TV can stop the motion. */
export const isDanmakuOn = (): boolean => enabled;
export function setDanmaku(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(OFF_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
  onToggle?.();
}
export const onDanmakuToggle = (fn: () => void): void => void (onToggle = fn);

interface Lane {
  top: number;
  size: number;
  /** When the last title's tail plus the gap has entered (performance.now() ms). */
  free: number;
}

let layer: HTMLElement | null = null;
let stage: HTMLElement | null = null;
let main: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let modes: ModeInfo[] = [];
let queue: string[] = [];
let lanes: Lane[] = [];
let laneKey = '';

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** The next game to fly: each game once per shuffled pass, never one already on screen. */
function nextMode(): ModeInfo | undefined {
  const flying = new Set([...(layer?.children ?? [])].map((el) => (el as HTMLElement).dataset.mode));
  for (let tries = 0; tries < modes.length * 2; tries++) {
    if (!queue.length) queue = shuffle(modes.map((m) => m.id));
    const id = queue.shift()!;
    const m = modes.find((x) => x.id === id);
    if (m && !flying.has(m.id)) return m;
  }
  return undefined;
}

/**
 * Lanes from where the lobby panel sits now: big lanes in the band above it, small lanes in the
 * band beside it. The layer spans the stage's full width, so titles enter at the screen's edge.
 */
function layout(): void {
  if (!layer || !stage || !main) return;
  layer.style.top = `${main.offsetTop}px`;
  layer.style.height = `${main.offsetHeight}px`;
  const panel = main.querySelector<HTMLElement>('.lobby');
  const scale = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
  const height = main.offsetHeight;
  const panelTop = panel ? Math.max(0, (panel.getBoundingClientRect().top - main.getBoundingClientRect().top) / scale) : height;
  const key = `${Math.round(panelTop)}:${height}`;
  if (key === laneKey) return;
  laneKey = key;
  const next: Lane[] = [];
  let y = 4;
  for (;;) {
    const size = BIG[next.length % BIG.length]!;
    if (y + size * LANE_RATIO > panelTop - 4) break;
    next.push({ top: y, size, free: 0 });
    y += size * LANE_RATIO;
  }
  // Beside the panel: small lanes, down to a strip clear of the player cards' shadows.
  for (y = Math.max(y, panelTop); y + SMALL * LANE_RATIO <= height - 16; y += SMALL * LANE_RATIO) next.push({ top: y, size: SMALL, free: 0 });
  // Keep the timing of lanes that are still where they were.
  for (const lane of next) lane.free = lanes.find((l) => l.top === lane.top && l.size === lane.size)?.free ?? 0;
  lanes = next;
}

/** Sends one title down a lane; `ahead` ms starts it part-way across (for the opening frame). */
function fly(m: ModeInfo, lane: Lane, ahead = 0): void {
  if (!layer) return;
  const width = layer.clientWidth;
  const item = h(
    'div',
    { class: `dm-item${lane.size === SMALL ? ' dm-small' : ''}`, 'data-mode': m.id, 'aria-hidden': 'true' },
    ruby({ text: m.titleJa, kana: TITLE_KANA[m.id] ?? null }, { class: 'dm-ja' }),
    h('span', { class: 'dm-en' }, m.title),
  );
  item.style.top = `${lane.top}px`;
  item.style.fontSize = `${lane.size}px`;
  layer.append(item);
  const w = item.offsetWidth;
  const ms = ((width + w) / SPEED) * 1000;
  lane.free = performance.now() - ahead + ((w + GAP) / SPEED) * 1000;
  const anim = item.animate([{ transform: `translateX(${width}px)` }, { transform: 'translateX(-100%)' }], { duration: ms, easing: 'linear' });
  anim.currentTime = Math.min(ahead, ms - 1);
  anim.onfinish = () => item.remove();
}

function launch(): void {
  timer = null;
  if (!layer) return;
  layout();
  const now = performance.now();
  const open = lanes.filter((l) => l.free <= now);
  // Big lanes most of the time: they're the ones people read.
  const big = open.filter((l) => l.size !== SMALL);
  const pool = big.length && Math.random() < 0.7 ? big : open;
  const m = layer.children.length < MAX_ON_SCREEN && pool.length ? nextMode() : undefined;
  if (m) fly(m, pool[Math.floor(Math.random() * pool.length)]!);
  schedule();
}

function schedule(): void {
  if (timer || !layer || document.hidden) return;
  timer = setTimeout(launch, EVERY * (0.7 + Math.random() * 0.6));
}

/** Titles already on their way, spread over the lanes, so the lobby opens full. */
function prefill(): void {
  layout();
  const width = layer?.clientWidth ?? 0;
  for (const lane of shuffle(lanes).slice(0, PREFILL)) {
    const m = nextMode();
    if (!m) break;
    fly(m, lane, ((width * (0.15 + Math.random() * 0.7)) / SPEED) * 1000);
  }
}

function onVisibility(): void {
  if (!document.hidden) return schedule();
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Start the titles flying over `mainEl` (inside the stage canvas `canvasEl`), or keep them
 * flying with an updated list of games.
 */
export function startDanmaku(canvasEl: HTMLElement, mainEl: HTMLElement, list: ModeInfo[]): void {
  if (list.map((m) => m.id).join() !== modes.map((m) => m.id).join()) queue = [];
  modes = list;
  if (layer) return layout();
  stage = canvasEl;
  main = mainEl;
  const el = h('div', { class: 'danmaku', 'aria-hidden': 'true' });
  layer = el;
  laneKey = '';
  lanes = [];
  stage.append(el);
  document.addEventListener('visibilitychange', onVisibility);
  // Widths are measured once a title is placed, so wait for the pixel and Japanese fonts.
  void document.fonts.ready.then(() => {
    if (layer !== el) return;
    prefill();
    el.classList.add('on');
    schedule();
  });
}

export function stopDanmaku(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  layer?.remove();
  layer = null;
}
