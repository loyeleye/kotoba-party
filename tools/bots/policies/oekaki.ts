// How a bot plays Oekaki: draws a simple stroke scribble (a wobbly blob with eyes and a few
// lines, in a colour or two), writes a plausible fake from its word tiles (said, typed or
// tapped, by seat), picks a title, and says the real one with the room.
// In the Green Car its fake is a sentence: a who tile plus a what-happened chunk. Mostly (about 70%) it says one
// from memory, a chunk of another Green Car sentence that isn't in its hand, in the real sentence's frame (an N3
// bot, when the drawing is N4, half the time in an N3 frame); otherwise it sends a who tile and a chunk tile.

import type { InkPoint } from '../../../shared/src/japanese/strokes.js';
import { PALETTE } from '../../../shared/src/modes/oekaki/drawing.js';
import type { OekakiView } from '../../../shared/src/modes/oekaki/oekaki.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { normalizeReading } from '../../../shared/src/japanese/kana.js';
import { FRAME_BY_ID } from '../../../shared/src/japanese/frames.js';
import { sentencesFor } from '../../../shared/src/modes/oekaki/sentences.js';
import type { ModePolicy } from '../bot.js';

export interface OekakiPolicyOptions {
  /** Think time before each move. */
  delayMs?: number;
  seed?: number;
}

/** A small deterministic random source (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;

/** A scribble a bot might draw: a blob, two dots for eyes, a mouth and a few loose lines. */
export function botScribble(random: () => number): { strokes: InkPoint[][]; colors: number[] } {
  const strokes: InkPoint[][] = [];
  const colors: number[] = [];
  const main = 1 + Math.floor(random() * (PALETTE.length - 1));
  const [cx, cy, rad] = [0.4 + random() * 0.2, 0.4 + random() * 0.2, 0.2 + random() * 0.12];
  const blob: InkPoint[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const wob = 1 + (random() - 0.5) * 0.15;
    blob.push([r3(cx + Math.cos(a) * rad * wob), r3(cy + Math.sin(a) * rad * wob * 0.85)]);
  }
  strokes.push(blob);
  colors.push(main);
  for (const dx of [-0.35, 0.35]) {
    const [ex, ey] = [cx + dx * rad, cy - 0.25 * rad];
    strokes.push([[r3(ex), r3(ey)], [r3(ex + 0.01), r3(ey + 0.01)]]);
    colors.push(0);
  }
  const mouth: InkPoint[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    mouth.push([r3(cx - 0.4 * rad + t * 0.8 * rad), r3(cy + 0.3 * rad + Math.sin(t * Math.PI) * 0.15 * rad)]);
  }
  strokes.push(mouth);
  colors.push(0);
  const extra = 1 + Math.floor(random() * 4);
  for (let k = 0; k < extra; k++) {
    const line: InkPoint[] = [];
    let [x, y] = [random(), random()];
    for (let i = 0; i < 10; i++) {
      line.push([r3(x), r3(y)]);
      x += (random() - 0.5) * 0.12;
      y += (random() - 0.5) * 0.12;
    }
    strokes.push(line);
    colors.push(Math.floor(random() * PALETTE.length));
  }
  return { strokes, colors };
}

/** A Green Car fake: a who tile and a what-happened chunk, said from memory or sent as tiles. */
function greenFake(view: RoomView, m: NonNullable<OekakiView['mine']>, salt: number, random: () => number): unknown {
  const tiles = m.tiles!;
  const whos = tiles.flatMap((t, i) => (t.chunk === 'who' ? [i] : []));
  const dids = tiles.flatMap((t, i) => (t.chunk === 'did' ? [i] : []));
  const who = whos[salt % Math.max(1, whos.length)] ?? 0;
  if (random() < 0.7) {
    const level = view.me?.level;
    const real = m.frame?.id;
    const n3 = level === 'n3' && !m.frame?.n3 && random() < 0.5;
    const inHand = new Set(dids.map((i) => normalizeReading(tiles[i]!.kana)));
    const pool = sentencesFor(view.audience).filter((x) => !inHand.has(normalizeReading(x.did.kana)));
    const fit = pool.filter((x) => (n3 ? x.frames.some((f) => FRAME_BY_ID[f]?.level === 'n3') : real ? x.frames.includes(real as never) : true));
    const list = fit.length ? fit : pool;
    const x = list[Math.floor(random() * list.length)];
    if (x) return { kind: 'fake', utterance: { via: 'speech', text: `${tiles[who]!.kana} ${x.did.kana}` } };
  }
  const did = dids[salt % Math.max(1, dids.length)] ?? 0;
  return { kind: 'fake', tiles: [who, did] };
}

export function oekakiPolicy(opts: OekakiPolicyOptions = {}): ModePolicy {
  const delayMs = opts.delayMs ?? 30;
  const random = rng(opts.seed ?? 1);
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as OekakiView | null;
      if (!game || game.mode !== 'oekaki' || !game.mine) return [];
      const m = game.mine;
      const seat = view.players.find((p) => p.id === playerId)?.seat ?? 1;
      const later = (n = 1) => delayMs * n + seat * 3;
      const out: { key: string; move: unknown; delayMs?: number }[] = [];

      if (view.phase === 'prompt' && m.prompt && !m.drawn) {
        out.push({ key: 'draw', move: { kind: 'draw', ...botScribble(random) }, delayMs: later(2) });
      }
      if (view.phase === 'answer' && !m.isArtist && !m.fake && m.tiles && !game.hiddenDrawing && m.tiles.some((t) => t.chunk)) {
        out.push({ key: 'fake', move: greenFake(view, m, seat + game.index * 7 + game.round * 3, random), delayMs: later() });
      } else if (view.phase === 'answer' && !m.isArtist && !m.fake && m.tiles && !game.hiddenDrawing) {
        // A plausible fake: [adjective] noun, or noun の noun, from the tiles (never the answer).
        const nouns = m.tiles.flatMap((t, i) => (!t.particle && !/い$/.test(t.kana) ? [i] : []));
        const adjs = m.tiles.flatMap((t, i) => (/い$/.test(t.kana) && !t.particle ? [i] : []));
        const no = m.tiles.findIndex((t) => t.particle);
        const n1 = nouns[(seat + game.index) % Math.max(1, nouns.length)] ?? 0;
        const n2 = nouns[(seat + game.index + 1) % Math.max(1, nouns.length)] ?? n1;
        const a = adjs[(seat + game.round) % Math.max(1, adjs.length)];
        const pick = seat % 3 === 0 && a !== undefined ? [a, n1] : seat % 3 === 1 && no >= 0 && n2 !== n1 ? [n1, no, n2] : [n1];
        if (seat % 2 === 0) {
          out.push({ key: 'fake', move: { kind: 'fake', tiles: pick }, delayMs: later() });
        } else {
          const text = pick.map((i) => m.tiles![i]!.kana).join(' ').replace(/ の/g, 'の');
          out.push({ key: 'fake', move: { kind: 'fake', utterance: { via: seat % 4 === 1 ? 'speech' : 'typed', text } }, delayMs: later() });
        }
      }
      if (view.phase === 'reveal' && !m.isArtist && !m.pick && game.options) {
        const options = game.options.filter((o) => o.id !== m.optionId && !o.hidden);
        const o = options[(seat * 7 + game.index) % Math.max(1, options.length)];
        if (o) out.push({ key: 'pick', move: { kind: 'pick', optionId: o.id }, delayMs: later() });
      }
      if (view.phase === 'score' && game.result && !m.said) {
        out.push({ key: 'say', move: { kind: 'say', utterance: { via: seat % 2 ? 'speech' : 'typed', text: game.result.real.kana } }, delayMs: later() });
      }
      return out;
    },
  };
}
