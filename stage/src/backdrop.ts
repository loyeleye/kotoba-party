// The set behind the show: a pixel-art set per game and the effects that live in it (mist,
// spotlights, drifting pages, confetti, rain past the train windows), drawn into one 320×180 canvas that CSS
// scales 6× with nearest-neighbour, so every move lands on a whole art pixel. It sits under the
// scrim, so the room's text keeps its contrast whatever moves.
//
// Rules (art panel, 26 Oct 2026; docs/graphics.md "Backdrop"):
// - Nothing moves in the text area: effects are clipped out of the centre box, except the floor
//   mist below it. Each set keeps its bright props at the sides.
// - Effects play in the lobby, intros and the recap, run low through prompts and waits, and ease to
//   a stop while anyone speaks, while Kana Raid's yōkai are out, and in a timer's last 5 seconds.
// - Each effect means something: confetti fires once for a round's scores or the winner, the train's
//   windows scroll only while it travels, and the camera steps only when the phase changes.
// - Calm motion (and prefers-reduced-motion) draws one still frame. "Background effects" off in
//   Settings shows the set with no effects at all.
// - About 12 frames a second, paused while the tab is hidden. No filters or blending.

import type { ModeId, RoomView } from '../../shared/src/protocol.js';
import { speaks } from './music/cues.js';
import { calm } from './sprites.js';

const W = 320;
const H = 180;
const FRAME_MS = 83;
/** The text area, in art pixels: no effect is drawn inside it. */
const SAFE = { x: 56, y: 22, w: 208, h: 128 };
/** Train windows in train-carriage.png (cut out to show the town). */
const WINDOWS = [
  { x: 27, y: 54, w: 76, h: 52 },
  { x: 125, y: 54, w: 76, h: 51 },
  { x: 243, y: 54, w: 77, h: 51 },
];

const ASSET = '/stage/assets/scenes/';
const art: Record<string, HTMLImageElement> = {};
/** The set for each game: the studio unless the game has a place of its own. */
const SETS: Partial<Record<ModeId, string>> = {
  'onsen-murder': 'onsen-inn',
  'karaoke-duel': 'karaoke-box',
  // Ghost Advice Hotline: Nobiko-san's late-night call-in booth (a mic, a rotary phone and the call light).
  'ghost-hotline': 'hotline-booth',
  oogiri: 'comedy-stage',
  'phrase-bingo': 'comedy-stage',
  omiai: 'tea-room',
};
for (const name of ['studio', ...new Set(Object.values(SETS)), 'page-a', 'page-b', 'page-c', 'train-carriage', 'hotline-bulb-off']) {
  const img = new Image();
  img.src = `${ASSET}${name}.png`;
  img.onload = () => draw();
  art[name] = img;
}
const ready = (name: string): boolean => art[name]!.complete && art[name]!.naturalWidth > 0;

// ---- the "Background effects" setting (this screen only) ----

const KEY = 'kotoba:ambient';
let ambientOn = ((): boolean => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
export const isAmbientOn = (): boolean => ambientOn;
export function setAmbient(on: boolean): void {
  ambientOn = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
  restart();
}

// ---- state ----

type Level = 'full' | 'low' | 'hold';
let ctx: CanvasRenderingContext2D | null = null;
let left: () => number | null = () => null;
let view: Pick<RoomView, 'mode' | 'phase' | 'phaseSeq' | 'game'> | null = null;
let phaseAt = 0;
/** Scene time in seconds: it runs at `speed`, which eases to 0 when the stage should hold still. */
let t = 0;
let speed = 1;
/** The train's speed through the town, 0 (at a stop) to 1. */
let train = 0;
let cam = 0;
let camTarget = 0;
let camAt = 0;
let lastFrame = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const confetti: { x: number; y: number; vx: number; vy: number; c: string; w: number }[] = [];
/** Ghost Hotline: when this call's phone started ringing, and which call that was. */
let ringAt: number | null = null;
let ringKey = '';
let burstAt: number | null = null;
let wasCalm = false;

/** Puts the backdrop canvas and the scrim at the back of the stage. */
export function mountBackdrop(stage: HTMLElement, remaining: () => number | null): void {
  left = remaining;
  const canvas = document.createElement('canvas');
  canvas.className = 'backdrop';
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute('aria-hidden', 'true');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  stage.prepend(canvas, scrim);
  ctx = canvas.getContext('2d');
  document.addEventListener('visibilitychange', restart);
  restart();
}

/** Call on every render. */
export function updateBackdrop(next: RoomView): void {
  const changed = !view || next.phaseSeq !== view.phaseSeq;
  const prevPhase = view?.phase;
  view = next;
  // A new call rings in Ghost Hotline: the booth's call light flashes with the phone (the ring is a step
  // inside the prompt phase, so it doesn't count as a phase change).
  const ring = hotlineRing(next);
  if (ring && ring !== ringKey) {
    ringKey = ring;
    ringAt = performance.now();
    if (!changed) return restart();
  }
  // The VIP's Calm motion switch arrives with the view: start or stop the loop when it flips.
  if (calm() !== wasCalm) {
    wasCalm = calm();
    if (!changed) return restart();
  }
  if (!changed) return;
  phaseAt = performance.now();
  if (!calm() && ambientOn && prevPhase !== undefined) {
    // A cut: the camera steps to a new spot, a few art pixels over, and settles there.
    camTarget = [-2, 0, 2, 0][next.phaseSeq % 4]!;
    // Confetti is for results: a round's scores and the winner, not every answer shown.
    if (next.phase === 'score' || next.phase === 'recap') burstAt = phaseAt + 600;
  }
  restart();
}

function level(): Level {
  if (!view) return 'full';
  const { phase, mode } = view;
  const ms = left();
  if (ms !== null && ms > 0 && ms <= 5_000 && phase !== 'lobby') return 'hold';
  if (mode === 'kana-raid' && phase === 'answer') return 'hold';
  if (phase !== 'reveal' && phase !== 'finale' && speaks(mode, phase)) return 'hold';
  return phase === 'lobby' || phase === 'intro' || phase === 'recap' ? 'full' : 'low';
}

function restart(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  lastFrame = performance.now();
  if (calm() || !ambientOn) {
    speed = 0;
    confetti.length = 0;
    burstAt = null;
    cam = camTarget = 0;
  }
  draw();
  if (!document.hidden && !calm() && ambientOn) timer = setTimeout(frame, FRAME_MS);
}

function frame(): void {
  const now = performance.now();
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  const lv = level();
  const target = lv === 'hold' ? 0 : lv === 'low' ? 0.35 : 1;
  // Ease over about 400 ms, so motion settles rather than snapping off.
  speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), dt * 2.5);
  t += dt * speed;
  // The train travels through intros and the first moments of each "next stop", then pulls in.
  const travelling = view?.mode === 'last-train' && (view.phase === 'intro' || (view.phase === 'prompt' && now - phaseAt < 1_500));
  train += Math.sign((travelling ? 1 : 0) - train) * Math.min(Math.abs((travelling ? 1 : 0) - train), dt * 1.2);
  // Lobby: the camera drifts slowly between its marks instead.
  if (view?.phase === 'lobby') camTarget = Math.floor(t / 3) % 2 ? 2 : -2;
  if (cam !== camTarget && now - camAt > 120) {
    cam += Math.sign(camTarget - cam);
    camAt = now;
  }
  if (burstAt !== null && now >= burstAt) {
    burst(view?.phase === 'recap' ? 60 : 36);
    burstAt = null;
  }
  stepConfetti(dt);
  draw();
  timer = setTimeout(frame, FRAME_MS);
}

// ---- drawing ----

function draw(): void {
  const g = ctx;
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.fillStyle = '#0c0720';
  g.fillRect(0, 0, W, H);
  const mode = view?.mode ?? null;
  const effects = ambientOn;
  if (mode === 'last-train') drawTrain(g, effects);
  else if (mode && SETS[mode]) drawSet(g, mode, SETS[mode]!, effects);
  else drawStudio(g, mode, effects);
  if (!effects) return;
  g.save();
  clipOutSafe(g);
  drawConfetti(g);
  g.restore();
}

function clipOutSafe(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.rect(0, 0, W, H);
  g.rect(SAFE.x + SAFE.w, SAFE.y, -SAFE.w, SAFE.h);
  g.clip('evenodd');
}

const pageSpots: [string, number, number, number][] = [
  // [sprite, x, y, bob phase]: loose dictionary pages floating in the side lanes.
  ['page-a', 12, 84, 0],
  ['page-b', 30, 34, 1.7],
  ['page-c', 290, 118, 0.9],
  ['page-a', 20, 128, 2.6],
];

function drawStudio(g: CanvasRenderingContext2D, mode: ModeId | null, effects: boolean): void {
  if (ready('studio')) g.drawImage(art['studio']!, 0, 0);
  if (effects) spotlights(g, 0.1);
  // Kana Raid has no paper in the air: drifting slips would look like yōkai to catch.
  if (mode !== 'kana-raid') {
    for (const [name, x, y, ph] of pageSpots) {
      if (!ready(name)) continue;
      const bob = effects ? [0, 1, 2, 1][Math.floor(t * 1.2 + ph * 4) % 4]! : 0;
      g.drawImage(art[name]!, x + cam * 2, y - bob);
    }
  }
  if (!effects) return;
  g.save();
  clipOutSafe(g);
  if (mode === 'kana-raid') onibi(g);
  g.restore();
  mist(g, mode === 'kana-raid' ? 0.55 : 0.35);
}

/** A game with a place of its own: its set, and the one effect that belongs there. */
function drawSet(g: CanvasRenderingContext2D, mode: ModeId, set: string, effects: boolean): void {
  if (ready(set)) g.drawImage(art[set]!, 0, 0);
  if (!effects) return;
  if (set === 'comedy-stage') spotlights(g, 0.16);
  g.save();
  clipOutSafe(g);
  if (mode === 'karaoke-duel') mirrorBall(g);
  if (mode === 'ghost-hotline') callLight(g);
  if (mode === 'onsen-murder') steam(g);
  if (mode === 'omiai') petals(g);
  g.restore();
  // Stage smoke on the boards; a karaoke box or a tea room has none.
  if (set === 'comedy-stage') mist(g, 0.25);
}

// A 4×4 ordered-dither threshold, so light and mist are drawn as pixel patterns, not alpha ramps.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number): number => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

/**
 * Two rig spotlights at the sides, sweeping their pools slowly across the floor. Each beam is two
 * flat layers of warm light (a core and a wider haze) at one opacity each: at 6× a dithered beam
 * reads as a grid, not light.
 */
function spotlights(g: CanvasRenderingContext2D, alpha: number): void {
  g.save();
  clipOutSafe(g);
  g.fillStyle = '#ffe2a8';
  for (const [x0, dir] of [
    [40, 1],
    [282, -1],
  ] as const) {
    // The pool's foot swings 12 art px each way over about 8 seconds, in whole-pixel steps.
    const swing = Math.round(Math.sin(t * 0.8 + (dir > 0 ? 0 : 2)) * 12);
    const foot = x0 + dir * 6 + swing;
    for (const [a, spread] of [
      [alpha * 0.5, 22],
      [alpha, 12],
    ] as const) {
      g.globalAlpha = a;
      g.beginPath();
      g.moveTo(x0 - 2, 14);
      g.lineTo(x0 + 2, 14);
      g.lineTo(foot + spread, 168);
      g.lineTo(foot - spread, 168);
      g.closePath();
      g.fill();
    }
    // The pool of light where the beam meets the floor.
    g.globalAlpha = alpha;
    g.beginPath();
    g.ellipse(foot, 167, 22, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Ghost Hotline's ringing call, keyed by its prompt phase (null outside the ring beat). */
function hotlineRing(v: RoomView): string | null {
  const game = v.game as { step?: string | null } | null;
  return v.mode === 'ghost-hotline' && game?.step === 'ring' ? String(v.phaseSeq) : null;
}

/** How long the call light flashes when a call rings in: three flashes, one a second. */
const RING_FLASH_MS = 3_000;
/** The call light's bulb, unlit, over the set's lit one (hotline-booth.png). */
const BULB = { x: 272, y: 54 };

/**
 * Ghost Hotline: the red call light over the phone flashes once a second for the first 3 s of a call, as
 * the phone rings, then stays lit while the caller is on the line. Like confetti it is a one-off signal,
 * so it runs on the clock even while the room holds; it sits at the right edge, outside the text area.
 */
function callLight(g: CanvasRenderingContext2D): void {
  if (ringAt === null || !ready('hotline-bulb-off')) return;
  const since = performance.now() - ringAt;
  if (since >= RING_FLASH_MS) return;
  if (Math.floor(since / 500) % 2 === 1) g.drawImage(art['hotline-bulb-off']!, BULB.x, BULB.y);
}

/** Karaoke: dots from a mirror ball, stepping across the side walls once a bar. */
function mirrorBall(g: CanvasRenderingContext2D): void {
  const bar = Math.floor(t / 2);
  const colors = ['#ffd23f', '#6ecef7', '#f98bcd', '#fff4dc'];
  g.save();
  clipOutSafe(g);
  g.globalAlpha = 0.7;
  for (let i = 0; i < 12; i++) {
    const r = hash(i * 7 + bar * 131);
    const side = i % 2 ? 0 : 264;
    g.fillStyle = colors[i % colors.length]!;
    g.fillRect(side + Math.floor(r * 52) + 1, 20 + Math.floor(hash(i * 13 + bar * 17) * 120), 3, 2);
  }
  g.restore();
}

let mistTile: HTMLCanvasElement | null = null;
/** Floor mist: two dithered bands drifting in opposite directions below the play area. */
function mist(g: CanvasRenderingContext2D, alpha: number): void {
  if (!mistTile) {
    mistTile = document.createElement('canvas');
    mistTile.width = 640;
    mistTile.height = 36;
    const mg = mistTile.getContext('2d')!;
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 640; x++) {
        // Soft lumps, densest in the middle rows, tiling seamlessly in x.
        const lump = 0.5 + 0.25 * Math.sin((x / 640) * Math.PI * 6) + 0.2 * Math.sin((x / 640) * Math.PI * 14 + 1.3);
        const band = 1 - Math.abs(y - 18) / 18;
        const v = lump * band;
        // Solid clumps with a dithered rim one or two pixels deep, not a speckled band.
        if (v > 0.42 + dither(x, y) * 0.12) {
          mg.fillStyle = v > 0.62 ? '#8a86c4' : '#5b5a9c';
          mg.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  const draw1 = (y: number, px: number, a: number) => {
    const off = ((Math.floor(px) % 640) + 640) % 640;
    g.globalAlpha = a;
    g.drawImage(mistTile!, -off, y);
    g.drawImage(mistTile!, 640 - off, y);
  };
  draw1(148, t * 2, alpha);
  draw1(156, -t * 3 + 200, alpha * 0.7);
  g.globalAlpha = 1;
}

/** Kana Raid: will-o'-wisps (鬼火) hovering in the side lanes, flickering at most twice a second. */
function onibi(g: CanvasRenderingContext2D): void {
  const spots = [
    [18, 46],
    [40, 104],
    [28, 140],
    [296, 40],
    [276, 96],
    [300, 132],
  ];
  spots.forEach(([x, y], i) => {
    const bob = [0, 1, 2, 1][Math.floor(t * 1.5 + i) % 4]!;
    const bright = Math.floor(t * 2 + i * 0.7) % 3 !== 0;
    g.globalAlpha = bright ? 0.9 : 0.55;
    g.fillStyle = '#7fd8ff';
    g.fillRect(x! - 1, y! - bob - 1, 4, 4);
    g.fillStyle = '#e8fbff';
    g.fillRect(x!, y! - bob, 2, 2);
  });
  g.globalAlpha = 1;
}

/** Onsen: steam (湯気) rising from the bottom corners, in solid puffs that fade in three steps. */
function steam(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#c9c4ee';
  for (let i = 0; i < 6; i++) {
    const life = (t * 0.25 + i / 6) % 1;
    const x = (i % 2 ? 14 : 300) + Math.round(Math.sin(life * 6 + i) * 4);
    const y = 178 - Math.round(life * 90);
    const r = 3 + Math.round(life * 6);
    g.globalAlpha = [0.4, 0.28, 0.14][Math.min(2, Math.floor(life * 3))]!;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      g.fillRect(x - half, y + dy, half * 2 + 1, 1);
    }
  }
  g.globalAlpha = 1;
}

/** Omiai: a few cherry petals (桜) falling in the side lanes. */
function petals(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#f7b6c8';
  for (let i = 0; i < 8; i++) {
    const life = (t * 0.08 + hash(i)) % 1;
    const lane = i % 2 ? 4 + hash(i + 9) * 46 : 270 + hash(i + 9) * 46;
    const x = Math.round(lane + Math.sin(life * 8 + i) * 5);
    const y = Math.round(life * 190) - 6;
    g.fillRect(x, y, 3, 2);
  }
}

// ---- Last Train ----

let town: { far: HTMLCanvasElement; near: HTMLCanvasElement } | null = null;
let trainX = 0;
let lastTrainT = 0;

/** The night town seen from the train: a far skyline and near poles, each a seamless 640 px strip. */
function makeTown(): { far: HTMLCanvasElement; near: HTMLCanvasElement } {
  const far = document.createElement('canvas');
  far.width = 640;
  far.height = H;
  const fg = far.getContext('2d')!;
  // Night sky, dithered from deep indigo to a city glow at the horizon.
  for (let y = 50; y < 110; y++) {
    for (let x = 0; x < 640; x++) {
      const v = (y - 50) / 60;
      fg.fillStyle = v > dither(x, y) * 1.4 ? '#2a1f5a' : '#140d33';
      fg.fillRect(x, y, 1, 1);
    }
  }
  let x = 0;
  let i = 0;
  while (x < 640) {
    const w = 10 + Math.floor(hash(i) * 18);
    const top = 62 + Math.floor(hash(i + 50) * 26);
    const bw = Math.min(w, 640 - x);
    fg.fillStyle = '#0e0a26';
    fg.fillRect(x, top, bw, 110 - top);
    // Lit windows: warm 1 px squares on a 3 px grid, about a third of them on.
    fg.fillStyle = '#ffd27a';
    for (let wy = top + 3; wy < 104; wy += 4) for (let wx = x + 2; wx < x + bw - 1; wx += 3) if (hash(wx * 3 + wy * 7) < 0.3) fg.fillRect(wx, wy, 1, 1);
    x += w + Math.floor(hash(i + 99) * 4);
    i++;
  }
  const near = document.createElement('canvas');
  near.width = 640;
  near.height = H;
  const ng = near.getContext('2d')!;
  // Catenary poles every 160 px, a fence along the bottom, and one level-crossing light.
  ng.fillStyle = '#060414';
  for (let px = 20; px < 640; px += 160) {
    ng.fillRect(px, 50, 3, 60);
    ng.fillRect(px - 6, 60, 15, 2);
  }
  for (let fx = 0; fx < 640; fx += 4) ng.fillRect(fx, 100, 1, 8);
  ng.fillRect(0, 100, 640, 1);
  ng.fillStyle = '#ff6b4a';
  ng.fillRect(420, 90, 2, 2);
  ng.fillRect(424, 90, 2, 2);
  return { far, near };
}

function drawTrain(g: CanvasRenderingContext2D, effects: boolean): void {
  town ??= makeTown();
  // The town only moves while the train does; at a stop, it holds wherever it pulled in.
  const dtTrain = t - lastTrainT;
  lastTrainT = t;
  if (effects) trainX += Math.max(0, dtTrain) * train * 40;
  const scroll = (layer: HTMLCanvasElement, px: number) => {
    const off = ((Math.floor(px) % 640) + 640) % 640;
    g.drawImage(layer, -off, 0);
    g.drawImage(layer, 640 - off, 0);
  };
  scroll(town.far, trainX * 0.3);
  scroll(town.near, trainX);
  if (effects) rain(g);
  if (ready('train-carriage')) g.drawImage(art['train-carriage']!, 0, 0);
  // Straps swing a pixel while the train moves, and settle when it stops.
  if (effects && train > 0.05 && ready('train-carriage')) {
    const sway = Math.floor(t * 4) % 2;
    if (sway) {
      g.save();
      g.beginPath();
      g.rect(0, 12, W, 40);
      g.clip();
      g.drawImage(art['train-carriage']!, 0, 12, W, 40, 1, 12, W, 40);
      g.restore();
    }
  }
}

/** Autumn rain (秋雨) on the windows: short streaks, slanting more while the train moves. */
function rain(g: CanvasRenderingContext2D): void {
  g.save();
  g.beginPath();
  for (const w of WINDOWS) g.rect(w.x, w.y, w.w, w.h);
  g.clip();
  g.fillStyle = '#8a86c4';
  g.globalAlpha = 0.7;
  const slant = Math.round(train * 3);
  for (let i = 0; i < 40; i++) {
    const w = WINDOWS[i % 3]!;
    const life = (t * 0.9 + hash(i)) % 1;
    const x = w.x + Math.floor(hash(i + 7) * w.w) - Math.round(life * slant * 6);
    const y = w.y + Math.floor(life * (w.h + 6)) - 3;
    for (let k = 0; k < 3; k++) g.fillRect(x - Math.round((k * slant) / 3), y + k, 1, 1);
  }
  g.restore();
}

// ---- confetti (紙吹雪): one burst for a round's scores or the winner, in the side lanes ----

const CONFETTI = ['#ffcc33', '#fff4dc', '#ff5f3c', '#ffd23f', '#f0c294'];

function burst(n: number): void {
  for (let i = 0; i < n && confetti.length < 60; i++) {
    const left = i % 2 === 0;
    confetti.push({
      x: left ? 4 + Math.random() * 44 : 272 + Math.random() * 44,
      y: -4 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 10,
      vy: 30 + Math.random() * 30,
      c: CONFETTI[i % CONFETTI.length]!,
      w: Math.random() < 0.5 ? 2 : 3,
    });
  }
}

function stepConfetti(dt: number): void {
  // Confetti is a one-off beat, not ambience: it falls at full speed even while the room holds.
  for (const p of confetti) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy = Math.min(70, p.vy + 20 * dt);
  }
  for (let i = confetti.length - 1; i >= 0; i--) if (confetti[i]!.y > H + 4) confetti.splice(i, 1);
}

function drawConfetti(g: CanvasRenderingContext2D): void {
  g.globalAlpha = 1;
  for (const p of confetti) {
    g.fillStyle = p.c;
    // A flutter: pieces flip between wide and narrow on alternate frames.
    const flip = Math.floor(p.y / 3) % 2;
    g.fillRect(Math.round(p.x), Math.round(p.y), flip ? p.w : 1, flip ? 1 : 2);
  }
  // Calm motion: the recap shows a still scatter on the floor instead of a burst.
  if (calm() && view?.phase === 'recap') {
    for (let i = 0; i < 24; i++) {
      g.fillStyle = CONFETTI[i % CONFETTI.length]!;
      const lane = i % 2 ? 6 + hash(i) * 42 : 272 + hash(i) * 42;
      g.fillRect(Math.round(lane), 150 + Math.floor(hash(i + 3) * 26), 2, 1);
    }
  }
}

/** A repeatable 0..1 from an integer, for layouts that must look the same every frame. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

