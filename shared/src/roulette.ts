// Surprise Me!'s reveal: a festival prize wheel over the whole screen (so the game behind it stays
// hidden), one wedge per game that fits the room. It spins under a ticking pointer flap, slows and
// stops on the game the room rolled, then a banner names it. The stage and the phones each play it
// on their own when a Surprise Me! game opens; the game itself was already picked by the room (game.ts).

import { h } from './dom.js';
import type { ModeInfo } from './modes/mode.js';

/** How long the wheel spins, and how many whole turns it makes before it settles. */
const SPIN_MS = 4600;
const TURNS = 6;
/** How long the landed game stays up before the wheel goes. */
const HOLD_MS = 2200;
const CALM_HOLD_MS = 2400;
/** Bulbs round the rim (they chase while it spins, then flash). */
const BULBS = 24;

/** Wedge fills, round the wheel in turn (the seat colours: dark ink reads on every one). */
const FILLS = ['--seat-1', '--seat-2', '--seat-3', '--seat-4', '--seat-5', '--seat-6', '--seat-7', '--seat-8'];
const CONFETTI = ['--accent', '--gold', '--paper', '--seat-2', '--seat-5', '--seat-6'];

export interface RouletteOptions {
  /** Calm motion: no spin, the wheel is shown already stopped on the pick. */
  calm: boolean;
  /** Extra class for the wheel's size (the stage's is TV-sized). */
  size?: string;
  /** The pointer passes into a new wedge (a tick sound on the stage). */
  onTick?: () => void;
  /** The wheel has stopped. */
  onLand?: () => void;
  /** The wheel has gone. */
  onDone?: () => void;
}

/**
 * How far (degrees, clockwise) the wheel turns to stop with the pointer (at the top) on `pick`'s
 * wedge. `jitter` (0 to 1) moves the stop around inside the wedge so it doesn't always land dead centre.
 */
export function wheelTurn(pool: readonly ModeInfo[], pick: ModeInfo, jitter = 0.5, turns = TURNS): number {
  const n = Math.max(1, pool.length);
  const at = Math.max(0, pool.findIndex((m) => m.id === pick.id));
  const wedge = 360 / n;
  const inside = (0.2 + 0.6 * Math.min(1, Math.max(0, jitter))) * wedge;
  return turns * 360 + (360 - (at * wedge + inside));
}

/** Which wedge sits under the pointer when the wheel has turned `deg` degrees clockwise. */
export function wedgeAt(n: number, deg: number): number {
  const a = (((360 - deg) % 360) + 360) % 360;
  return Math.min(n - 1, Math.floor(a / (360 / n)));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = 240;
const pt = (a: number, r: number) => `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`;
const host = (id: string) => `/stage/assets/hosts/${id}.png`;

/** The turning part: wedges clockwise from the top, each with its game's name and host, gold pegs between. */
function discSvg(pool: readonly ModeInfo[]): string {
  const n = pool.length;
  const R = 200;
  const wedge = (2 * Math.PI) / n;
  const font = n > 12 ? 12 : n > 8 ? 14 : 17;
  const icon = n > 12 ? 26 : n > 8 ? 32 : 40;
  const slices = pool.map((m, i) => {
    const a0 = i * wedge;
    const mid = ((a0 + wedge / 2) * 180) / Math.PI;
    const path = n === 1 ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z` : `M ${C} ${C} L ${pt(a0, R)} A ${R} ${R} 0 ${wedge > Math.PI ? 1 : 0} 1 ${pt(a0 + wedge, R)} Z`;
    // The name runs out from the hub towards the host, squeezed if it would run into it.
    const room = 176 - icon - 54;
    const fit = Math.min(m.title.length * font * 0.56, room);
    return (
      `<g class="wheel-wedge" data-i="${i}"><path d="${path}" fill="var(${FILLS[i % FILLS.length]})"/>` +
      `<g transform="rotate(${(mid - 90).toFixed(2)} ${C} ${C})">` +
      `<text x="${C + 54 + fit / 2}" y="${C}" font-size="${font}" textLength="${fit.toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(m.title)}</text>` +
      `<image href="${host(m.host)}" x="${C + 188 - icon}" y="${C - icon / 2}" width="${icon}" height="${icon}" transform="rotate(90 ${C + 188 - icon / 2} ${C})"/></g></g>`
    );
  });
  const lines = n > 1 ? pool.map((_, i) => `<line x1="${C}" y1="${C}" x2="${pt(i * wedge, R).replace(' ', '" y2="')}"/>`).join('') : '';
  const pegs = n > 1 ? pool.map((_, i) => `<circle cx="${pt(i * wedge, R - 6).replace(' ', '" cy="')}" r="5"/>`).join('') : '';
  return (
    `<svg class="wheel-disc" viewBox="0 0 480 480" aria-hidden="true">` +
    `<defs><radialGradient id="wheel-shade"><stop offset="0.25" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient></defs>` +
    slices.join('') +
    `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#wheel-shade)" pointer-events="none"/>` +
    `<g class="wheel-lines">${lines}</g><g class="wheel-pegs">${pegs}</g></svg>`
  );
}

/** The still part over it: the lacquer rim with its bulbs, a gloss, and the hub cap. */
function frameSvg(): string {
  const bulbs = Array.from({ length: BULBS }, (_, i) => `<circle class="bulb ${i % 2 ? 'odd' : 'even'}" cx="${pt((i * 2 * Math.PI) / BULBS, 214).replace(' ', '" cy="')}" r="6"/>`).join('');
  return (
    `<svg class="wheel-frame" viewBox="0 0 480 480" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="wheel-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset="0.45" stop-color="#ffcc33"/><stop offset="1" stop-color="#b9781c"/></linearGradient>` +
    `<radialGradient id="wheel-cap" cx="0.4" cy="0.35"><stop offset="0" stop-color="#ff7a66"/><stop offset="1" stop-color="#9c1530"/></radialGradient>` +
    `<linearGradient id="wheel-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<circle cx="${C}" cy="${C}" r="214" fill="none" stroke="var(--lantern)" stroke-width="28"/>` +
    `<circle cx="${C}" cy="${C}" r="228" fill="none" stroke="url(#wheel-gold)" stroke-width="5"/>` +
    `<circle cx="${C}" cy="${C}" r="200" fill="none" stroke="url(#wheel-gold)" stroke-width="5"/>` +
    bulbs +
    `<path d="M ${C - 150} ${C - 70} A 170 170 0 0 1 ${C + 150} ${C - 70} A 260 200 0 0 0 ${C - 150} ${C - 70} Z" fill="url(#wheel-gloss)"/>` +
    `<circle cx="${C}" cy="${C}" r="46" fill="url(#wheel-gold)" stroke="var(--outline)" stroke-width="4"/>` +
    `<circle cx="${C}" cy="${C}" r="36" fill="url(#wheel-cap)"/>` +
    `</svg>`
  );
}

/** The pointer flap at the top: a gold-edged vermilion drop that kicks back as each peg passes. */
const POINTER_SVG =
  `<svg viewBox="0 0 60 80" aria-hidden="true"><path d="M30 78 L6 26 A26 26 0 1 1 54 26 Z" fill="var(--accent)" stroke="var(--outline)" stroke-width="5" stroke-linejoin="round"/>` +
  `<path d="M30 64 L14 28 A17 17 0 1 1 46 28 Z" fill="none" stroke="#ffe08a" stroke-width="3" opacity="0.8"/><circle cx="30" cy="24" r="8" fill="var(--gold)" stroke="var(--outline)" stroke-width="3"/></svg>`;

/** A burst of paper confetti over the card. */
function confetti(into: HTMLElement): void {
  const box = h('div', { class: 'wheel-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 46; i++) {
    const bit = h('i', {});
    bit.style.setProperty('--x', `${(Math.random() * 2 - 1) * 46}vmin`);
    bit.style.setProperty('--y', `${-20 - Math.random() * 34}vmin`);
    bit.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
    bit.style.setProperty('--d', `${Math.round(Math.random() * 140)}ms`);
    bit.style.background = `var(${CONFETTI[i % CONFETTI.length]})`;
    box.append(bit);
  }
  into.append(box);
}

/** Puts the wheel over `parent` and spins it. Returns the overlay (it removes itself when done). */
export function playRoulette(parent: HTMLElement, pool: readonly ModeInfo[], pick: ModeInfo, opts: RouletteOptions): HTMLElement {
  parent.querySelector('.roulette')?.remove();
  const games = pool.some((m) => m.id === pick.id) ? pool : [pick];
  const spinner = h('div', { class: 'wheel-spin' });
  spinner.innerHTML = discSvg(games);
  const frame = h('div', { class: 'wheel-still' });
  frame.innerHTML = frameSvg();
  const hubImg = h('img', { class: 'wheel-hub-host', src: host('pon'), alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }) as HTMLImageElement;
  const pointer = h('div', { class: 'wheel-pointer' });
  pointer.innerHTML = POINTER_SVG;
  const wheel = h('div', { class: 'wheel', 'aria-hidden': 'true' }, h('div', { class: 'wheel-rays' }), spinner, frame, hubImg, pointer);
  const status = h('p', { class: 'roulette-status', role: 'status' }, games.length > 1 ? `Spinning between ${games.length} games…` : '');
  const banner = h(
    'div',
    { class: 'roulette-banner' },
    h('span', { class: 'roulette-banner-kicker' }, 'Tonight’s game'),
    h('strong', { class: 'roulette-banner-ja', lang: 'ja' }, pick.titleJa),
    h('span', { class: 'roulette-banner-en' }, pick.title),
  );
  const card = h(
    'div',
    { class: `roulette${opts.calm ? ' quiet' : ''}${opts.size ? ` ${opts.size}` : ''}` },
    h(
      'div',
      { class: 'roulette-card' },
      h('p', { class: 'roulette-kicker' }, h('span', { class: 'roulette-kicker-ja', lang: 'ja' }, 'おまかせ！'), h('span', { class: 'roulette-kicker-en' }, 'Surprise Me!')),
      wheel,
      h('div', { class: 'roulette-foot' }, status, banner),
    ),
  );
  parent.append(card);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
  let raf = 0;
  const close = () => {
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    if (!card.isConnected) return;
    card.classList.add('roulette-out');
    setTimeout(() => card.remove(), 320);
    opts.onDone?.();
  };
  card.addEventListener('click', close);
  const turn = wheelTurn(games, pick, Math.random());
  const at = games.findIndex((m) => m.id === pick.id);
  const land = () => {
    cancelAnimationFrame(raf);
    card.classList.remove('spinning');
    card.classList.add('landed');
    spinner.querySelector(`.wheel-wedge[data-i="${at}"]`)?.classList.add('won');
    hubImg.src = host(pick.host);
    status.textContent = `Tonight’s game: ${pick.title}`;
    if (!opts.calm) confetti(card);
    opts.onLand?.();
    later(close, opts.calm ? CALM_HOLD_MS : HOLD_MS);
  };
  if (opts.calm) {
    spinner.style.transform = `rotate(${turn % 360}deg)`;
    land();
    return card;
  }
  card.classList.add('spinning');
  // Start on the next frame so the transition runs from 0.
  requestAnimationFrame(() => {
    spinner.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.55, 0.08, 1)`;
    spinner.style.transform = `rotate(${turn}deg)`;
    // Each wedge passing the pointer ticks it, read off the wheel's live angle.
    let last = 0;
    const watch = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(spinner).transform);
      const w = wedgeAt(games.length, ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360);
      if (w !== last) {
        opts.onTick?.();
        pointer.classList.remove('flick');
        void pointer.offsetWidth;
        pointer.classList.add('flick');
      }
      last = w;
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
  });
  later(land, SPIN_MS + 100);
  return card;
}
