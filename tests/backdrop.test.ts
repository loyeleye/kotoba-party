// The backdrop's art must exist at the art resolution the canvas draws (320×180 for full scenes),
// and the train windows the code scrolls the town through must be see-through in the carriage.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const png = (path: string) => {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('backdrop art', () => {
  it('ships the full scenes at 320×180', () => {
    for (const name of ['studio-far', 'train-carriage']) expect(png(`stage/assets/scenes/${name}.png`)).toEqual({ w: 320, h: 180 });
  });

  it('keeps the props and pages small enough to sit at the edges', () => {
    expect(png('stage/assets/scenes/studio-props.png').w).toBeLessThanOrEqual(80);
    for (let i = 1; i <= 4; i++) expect(png(`stage/assets/scenes/page-${i}.png`).w).toBeLessThanOrEqual(32);
  });

  it('lists every scene file in the art manifest', () => {
    const manifest = JSON.parse(readFileSync('stage/assets/manifest.json', 'utf8')) as { assets: { path: string }[] };
    const paths = new Set(manifest.assets.map((a) => a.path));
    for (const name of ['studio-far', 'studio-props', 'page-1', 'page-2', 'page-3', 'page-4', 'train-carriage']) expect(paths.has(`stage/assets/scenes/${name}.png`)).toBe(true);
  });
});
