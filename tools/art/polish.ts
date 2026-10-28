// Cleans up the animation sheets PixelLab makes, so they hold up in a demo. Each manifest entry
// with a `polish` block is rebuilt from its raw sheet (`polish.from`, kept in tools/art/sources/anim)
// into its `path`:
//
//   npx tsx tools/art/polish.ts            # every entry with a polish block
//   npx tsx tools/art/polish.ts pon-cheer  # only paths containing these words
//
// Steps, in order (all optional):
//   frames  which raw frames to keep, in play order: drops off-model frames, or reorders them
//   steady  a pixel whose colour is within this distance (0–441) of raw frame 0's takes frame 0's
//           colour, so shading doesn't crawl between frames while real motion stays
//   only    [x, y, w, h]: outside this box every frame is raw frame 0 (lip sync: only the mouth moves)
//   mouth   [x, y, w, h] around the open mouth in raw frame 0: makes three frames, mouth closed,
//           half open and as drawn, for lip sync. In each column the opening runs from the top
//           to the bottom outline pixel. Closed keeps only the top one (the upper lip) and paints
//           the rest with the skin around it (a fifth value 'bottom' keeps the lower lip instead,
//           for a grin whose upper lip would read as a frown, and 'fill' takes every non-skin pixel
//           as the opening, for a mouth drawn with no outline); half closes it halfway down.
//   poof    a sheet of the same frame size whose frames are appended; its first frame is drawn over
//           the last kept frame, so the yōkai turns into the puff instead of vanishing
//
// Needs ImageMagick (`magick` or `convert`) on PATH, like generate.ts. See docs/graphics.md.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Polish {
  from: string;
  frames?: number[];
  steady?: number;
  only?: [number, number, number, number];
  mouth?: [number, number, number, number] | [number, number, number, number, 'bottom' | 'fill'];
  poof?: string;
}

interface Asset {
  path: string;
  polish?: Polish;
}

const root = resolve(import.meta.dirname, '../..');
const im = (() => {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // try the next one
    }
  }
  throw new Error('ImageMagick (magick or convert) is required');
})();

/** A sheet as RGBA bytes, split into square frames as tall as the sheet. */
interface Sheet {
  size: number;
  frames: Uint8Array<ArrayBufferLike>[];
}

function load(file: string): Sheet {
  const [w, h] = execFileSync(im, [file, '-format', '%w %h', 'info:']).toString().split(' ').map(Number) as [number, number];
  const rgba = new Uint8Array(execFileSync(im, [file, '-depth', '8', 'rgba:-'], { maxBuffer: 64 << 20 }));
  const frames: Uint8Array[] = [];
  for (let f = 0; f < w / h; f++) {
    const frame = new Uint8Array(h * h * 4);
    for (let y = 0; y < h; y++) frame.set(rgba.subarray((y * w + f * h) * 4, (y * w + f * h + h) * 4), y * h * 4);
    frames.push(frame);
  }
  return { size: h, frames };
}

function save(sheet: Sheet, file: string): void {
  const { size, frames } = sheet;
  const w = size * frames.length;
  const rgba = new Uint8Array(w * size * 4);
  frames.forEach((frame, f) => {
    for (let y = 0; y < size; y++) rgba.set(frame.subarray(y * size * 4, (y + 1) * size * 4), (y * w + f * size) * 4);
  });
  execFileSync(im, ['-size', `${w}x${size}`, '-depth', '8', 'rgba:-', '-strip', '-define', 'png:compression-level=9', `PNG32:${file}`], { input: rgba });
}

function polish(p: Polish): Sheet {
  const raw = load(resolve(root, p.from));
  const { size } = raw;
  let frames: Uint8Array<ArrayBufferLike>[] = (p.frames ?? raw.frames.map((_, i) => i)).map((i) => {
    const f = raw.frames[i];
    if (!f) throw new Error(`${p.from} has no frame ${i}`);
    return new Uint8Array(f);
  });
  // Everything is steadied against the raw first frame: the shipped sprite itself.
  const base = raw.frames[0]!;
  if (p.steady !== undefined || p.only) {
    const [bx, by, bw, bh] = p.only ?? [0, 0, size, size];
    for (const f of frames) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const inside = x >= bx && x < bx + bw && y >= by && y < by + bh;
          const same = f[i + 3] === base[i + 3] && Math.hypot(f[i]! - base[i]!, f[i + 1]! - base[i + 1]!, f[i + 2]! - base[i + 2]!) <= (p.steady ?? -1);
          if (!inside || same) f.set(base.subarray(i, i + 4), i);
        }
      }
    }
  }
  if (p.mouth) frames = mouthShapes(base, size, p.mouth);
  if (p.poof) {
    const poof = load(resolve(root, p.poof));
    if (poof.size !== size) throw new Error(`${p.poof} frames are ${poof.size}px, ${p.from} frames are ${size}px`);
    const [first, ...rest] = poof.frames;
    const over = new Uint8Array(frames.at(-1)!);
    for (let i = 0; i < over.length; i += 4) if (first![i + 3]) over.set(first!.subarray(i, i + 4), i);
    frames = [...frames, over, ...rest];
  }
  return { size, frames };
}

function mouthShapes(base: Uint8Array<ArrayBufferLike>, size: number, [bx, by, bw, bh, lip]: NonNullable<Polish['mouth']>): Uint8Array<ArrayBufferLike>[] {
  const at = (x: number, y: number) => (y * size + x) * 4;
  const luma = (f: Uint8Array<ArrayBufferLike>, i: number) => 0.3 * f[i]! + 0.59 * f[i + 1]! + 0.11 * f[i + 2]!;
  // Skin: the commonest light colour in the box. Mouth: everything in the box that isn't skin-light.
  const counts = new Map<number, number>();
  for (let y = by; y < by + bh; y++)
    for (let x = bx; x < bx + bw; x++) {
      const i = at(x, y);
      if (base[i + 3]! > 127 && luma(base, i) >= 110) {
        const key = (base[i]! << 16) | (base[i + 1]! << 8) | base[i + 2]!;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  const skinKey = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (skinKey === undefined) throw new Error('mouth box has no skin colour');
  const skin = [skinKey >> 16, (skinKey >> 8) & 255, skinKey & 255, 255];
  // The mouth's outline is its darkest pixels: in each column, everything between the top and
  // bottom outline pixel is the opening (teeth, tongue, inside).
  const dark = (i: number) => base[i + 3]! > 127 && luma(base, i) < 60;
  let ink = [0, 0, 0, 255];
  let darkest = 256;
  for (let y = by; y < by + bh; y++)
    for (let x = bx; x < bx + bw; x++) {
      const i = at(x, y);
      if (dark(i) && luma(base, i) < darkest) {
        darkest = luma(base, i);
        ink = [base[i]!, base[i + 1]!, base[i + 2]!, 255];
      }
    }
  // 'fill': a mouth drawn with no outline (a solid red opening), so every non-skin pixel is the opening.
  const isSkin = (i: number) => base[i + 3]! <= 127 || ((base[i]! << 16) | (base[i + 1]! << 8) | base[i + 2]!) === skinKey;
  const shape = (keep: (depth: number) => number) => {
    const f = new Uint8Array(base);
    for (let x = bx; x < bx + bw; x++) {
      const ys: number[] = [];
      for (let y = by; y < by + bh; y++) if (lip === 'fill' ? !isSkin(at(x, y)) : dark(at(x, y))) ys.push(y);
      if (ys.length < 2) continue;
      const top = ys[0]!;
      const bottom = ys.at(-1)!;
      if (lip === 'bottom' && keep(bottom - top) === 0) {
        // Closed on the lower lip: a grin's smile curve, where the upper lip would read as a frown.
        for (let y = top; y < bottom; y++) f.set(skin, at(x, y));
        f.set(ink, at(x, bottom));
        continue;
      }
      const cut = top + keep(bottom - top);
      f.set(ink, at(x, cut));
      for (let y = cut + 1; y <= bottom; y++) f.set(skin, at(x, y));
    }
    return f;
  };
  return [shape(() => 0), shape((depth) => Math.floor(depth / 2)), new Uint8Array(base)];
}

const manifest = JSON.parse(readFileSync(resolve(root, 'stage/assets/manifest.json'), 'utf8')) as { assets: Asset[] };
const only = process.argv.slice(2);
for (const asset of manifest.assets) {
  if (!asset.polish || (only.length && !only.some((w) => asset.path.includes(w)))) continue;
  const sheet = polish(asset.polish);
  save(sheet, resolve(root, asset.path));
  console.log(`${asset.path}: ${sheet.frames.length} frames from ${asset.polish.from}`);
}
