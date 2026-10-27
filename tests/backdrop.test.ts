// The backdrop's art must exist at the art resolution the canvas draws (320×180 for full scenes),
// and the train windows the code scrolls the town through must be see-through in the carriage.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const png = (path: string) => {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const SETS = ['studio', 'onsen-inn', 'karaoke-box', 'comedy-stage', 'tea-room', 'train-carriage'];
const PAGES = ['page-a', 'page-b', 'page-c'];

describe('backdrop art', () => {
  it('ships the full scenes at 320×180', () => {
    for (const name of SETS) expect(png(`stage/assets/scenes/${name}.png`)).toEqual({ w: 320, h: 180 });
  });

  it('keeps the pages small enough to sit in the side lanes', () => {
    for (const name of PAGES) expect(png(`stage/assets/scenes/${name}.png`).w).toBeLessThanOrEqual(16);
  });

  it('lists every scene file in the art manifest', () => {
    const manifest = JSON.parse(readFileSync('stage/assets/manifest.json', 'utf8')) as { assets: { path: string }[] };
    const paths = new Set(manifest.assets.map((a) => a.path));
    for (const name of [...SETS, ...PAGES]) expect(paths.has(`stage/assets/scenes/${name}.png`)).toBe(true);
  });
});
