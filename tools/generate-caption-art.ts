// Generates the Oogiri Night Photo Caption pictures with PixelLab.
//
//   PIXELLAB_API_KEY=... npx tsx tools/generate-caption-art.ts [promptId ...]
//
// Writes content/<image> for every photo-caption prompt whose picture is
// missing (or only the prompt ids given). Each picture is drawn from the
// prompt's `photo` description. Look at every result before committing:
// redraw any with garbled text or the wrong subject (change the seed).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { oogiriPrompts } from '../content/src/index.js';

const STYLE =
  'Funny pixel art scene for a Japanese late-night TV comedy game, warm colours, clear readable silhouettes, ' +
  'expressive cartoon characters, simple background, no text or letters. ';

const key = process.env.PIXELLAB_API_KEY;
if (!key) throw new Error('Set PIXELLAB_API_KEY.');

const only = new Set(process.argv.slice(2));
const contentDir = path.join(import.meta.dirname, '..', 'content');

for (const p of oogiriPrompts) {
  if (p.round !== 'photo-caption' || !p.photo || !p.image) continue;
  const out = path.join(contentDir, p.image);
  if (only.size ? !only.has(p.id) : existsSync(out)) continue;
  const res = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      description: STYLE + p.photo,
      image_size: { width: 320, height: 240 },
      text_guidance_scale: 8,
      view: 'side',
      seed: 7,
    }),
  });
  if (!res.ok) throw new Error(`${p.id}: ${res.status} ${await res.text()}`);
  const { image } = (await res.json()) as { image: { base64: string } };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(image.base64.replace(/^data:[^,]+,/, ''), 'base64'));
  console.log('drew', p.image);
}
