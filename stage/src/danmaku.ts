// The lobby's 弾幕 (danmaku): game titles fly right to left across the main area, the way
// comments cross a Niconico video, in lanes at three sizes and each game's own colour. They pass
// behind the lobby's centre panel. Calm motion and reduced motion turn them off; the lobby then
// shows the still list instead (main.ts).

import { h } from '../../shared/src/dom.js';
import type { ModeInfo } from '../../shared/src/modes/mode.js';

/** Three sizes, from the lobby's body text up to just under the brand title (56 px). */
const SIZES = [30, 40, 52];
/** Lanes are this tall (the biggest size plus its outline and a gap). */
const LANE = 72;
/** Speed across the screen in px/s, the same for every size so a title never catches the one ahead in its lane. */
const SPEED = 140;
/** A new title every this many ms, and never more than this many on screen. */
const EVERY = 1100;
const MAX_ON_SCREEN = 8;

let layer: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let modes: ModeInfo[] = [];
let queue: ModeInfo[] = [];
/** When each lane's last title has fully entered the screen (ms, performance.now()). */
let laneFree: number[] = [];

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
    if (!queue.length) queue = shuffle(modes);
    const m = queue.shift()!;
    if (!flying.has(m.id)) return m;
  }
  return undefined;
}

function launch(): void {
  if (!layer) return;
  const width = layer.clientWidth;
  // Leave a strip at the bottom clear of the player cards' shadows.
  const lanes = Math.max(1, Math.floor((layer.clientHeight - 24) / LANE));
  if (laneFree.length !== lanes) laneFree = Array.from({ length: lanes }, () => 0);
  const now = performance.now();
  const open = laneFree.map((t, i) => (t <= now ? i : -1)).filter((i) => i >= 0);
  const m = layer.children.length < MAX_ON_SCREEN && open.length ? nextMode() : undefined;
  if (m && width > 0) {
    const lane = open[Math.floor(Math.random() * open.length)]!;
    const tier = Math.floor(Math.random() * SIZES.length);
    const item = h(
      'span',
      { class: `dm-item dm-${tier}`, 'data-mode': m.id, 'aria-hidden': 'true' },
      h('span', { class: 'dm-en' }, m.title),
      h('span', { class: 'dm-ja', lang: 'ja' }, m.titleJa),
    );
    item.style.top = `${lane * LANE + (LANE - SIZES[tier]!) / 2}px`;
    item.style.fontSize = `${SIZES[tier]}px`;
    layer.append(item);
    const run = width + item.offsetWidth;
    const ms = (run / SPEED) * 1000;
    // The lane opens again once this title's tail is on screen plus a gap.
    laneFree[lane] = now + ((item.offsetWidth + 160) / SPEED) * 1000;
    const anim = item.animate([{ transform: `translateX(${width}px)` }, { transform: `translateX(${-item.offsetWidth}px)` }], { duration: ms, easing: 'linear' });
    anim.onfinish = () => item.remove();
  }
  timer = setTimeout(launch, EVERY * (0.7 + Math.random() * 0.6));
}

/** Start the titles flying in `host` (or keep them flying with an updated list of games). */
export function startDanmaku(host: HTMLElement, list: ModeInfo[]): void {
  modes = list;
  if (layer && layer.parentElement === host) return;
  stopDanmaku();
  layer = h('div', { class: 'danmaku', 'aria-hidden': 'true' });
  host.prepend(layer);
  queue = [];
  laneFree = [];
  launch();
}

export function stopDanmaku(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  layer?.remove();
  layer = null;
}
