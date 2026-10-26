// Regenerates the stage art listed in stage/assets/manifest.json.
//
//   npx tsx tools/art/generate.ts                  # every asset
//   npx tsx tools/art/generate.ts pon yokai-boss   # only paths containing these words
//   npx tsx tools/art/generate.ts --dry-run        # print what would be generated
//   npx tsx tools/art/generate.ts --out /tmp/art   # write candidates elsewhere to compare
//   npx tsx tools/art/generate.ts --seed 42 yokai  # PixelLab seed override
//
// Keys come from the environment only (GEMINI_API_KEY, PIXELLAB_API_KEY). They are sent as
// request headers and never printed or written to disk. Post-processing (resize, palette,
// JPEG quality) shells out to ImageMagick (`magick` or `convert`), which must be on PATH.
// See docs/graphics.md.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

type Generator = 'gemini' | 'pixellab';

interface Post {
  /** ImageMagick geometry, e.g. "512x512". Smooth (Lanczos) resize; never used on pixel art. */
  resize?: string;
  /** Quantise to this many colours (PNG8, no dithering). */
  colors?: number;
  /** Write a JPEG at this quality instead of a PNG. */
  jpegQuality?: number;
}

interface Asset {
  path: string;
  what: string;
  generator: Generator;
  model: string;
  prompt: string;
  params?: Record<string, unknown>;
  post?: Post;
}

interface Manifest {
  version: number;
  notes?: string;
  assets: Asset[];
}

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const MANIFEST = join(ROOT, 'stage', 'assets', 'manifest.json');

function requireKey(name: 'GEMINI_API_KEY' | 'PIXELLAB_API_KEY'): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the environment`);
  return v;
}

/** Error text from a provider, trimmed, with anything that looks like a key removed. */
async function errorText(res: Response): Promise<string> {
  const body = (await res.text()).slice(0, 600);
  return body.replace(/(AIza[0-9A-Za-z_-]{20,}|[0-9a-f]{8}-[0-9a-f-]{27,})/g, '[redacted]');
}

async function gemini(asset: Asset): Promise<Buffer> {
  const key = requireKey('GEMINI_API_KEY');
  const { aspectRatio = '1:1', imageSize = '1K' } = (asset.params ?? {}) as { aspectRatio?: string; imageSize?: string };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(asset.model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: asset.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio, imageSize } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await errorText(res)}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] }; finishReason?: string }[];
  };
  const candidate = json.candidates?.[0];
  const data = candidate?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error(`Gemini returned no image (finishReason: ${candidate?.finishReason ?? 'none'})`);
  return Buffer.from(data, 'base64');
}

async function pixellab(asset: Asset, seed: number | undefined): Promise<Buffer> {
  const key = requireKey('PIXELLAB_API_KEY');
  if (asset.model !== 'pixflux') throw new Error(`PixelLab model ${asset.model} is not supported by this script`);
  const { width = 128, height = 128, ...rest } = (asset.params ?? {}) as { width?: number; height?: number } & Record<string, unknown>;
  const res = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      description: asset.prompt,
      image_size: { width, height },
      ...rest,
      ...(seed === undefined ? {} : { seed }),
    }),
  });
  if (!res.ok) throw new Error(`PixelLab ${res.status}: ${await errorText(res)}`);
  const json = (await res.json()) as { image?: { base64?: string } };
  const b64 = json.image?.base64?.replace(/^data:image\/\w+;base64,/, '');
  if (!b64) throw new Error('PixelLab returned no image');
  return Buffer.from(b64, 'base64');
}

function imageMagick(): string {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // try the next one
    }
  }
  throw new Error('ImageMagick (magick or convert) is required for post-processing');
}

function postProcess(raw: Buffer, asset: Asset, outFile: string): void {
  const im = imageMagick();
  const work = mkdtempSync(join(tmpdir(), 'kotoba-art-'));
  try {
    const input = join(work, 'raw');
    writeFileSync(input, raw);
    const post = asset.post ?? {};
    const args = [input, '-strip'];
    if (post.resize) args.push('-filter', 'Lanczos', '-resize', `${post.resize}^`, '-gravity', 'center', '-extent', post.resize);
    if (post.jpegQuality !== undefined) {
      args.push('-sampling-factor', '4:2:0', '-interlace', 'JPEG', '-quality', String(post.jpegQuality), `JPG:${outFile}`);
    } else {
      if (post.colors) args.push('+dither', '-colors', String(post.colors));
      args.push('-define', 'png:compression-level=9', `${post.colors ? 'PNG8' : 'PNG32'}:${outFile}`);
    }
    execFileSync(im, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const outDir = flag('--out');
  const seedArg = flag('--seed');
  const seed = seedArg === undefined ? undefined : Number(seedArg);
  const valued = new Set([outDir, seedArg]);
  const filters = argv.filter((a) => !a.startsWith('--') && !valued.has(a));

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
  const todo = manifest.assets.filter((a) => filters.length === 0 || filters.some((f) => a.path.includes(f)));
  if (todo.length === 0) throw new Error(`No manifest entries match: ${filters.join(', ')}`);

  let failed = 0;
  for (const asset of todo) {
    const outFile = outDir ? join(resolve(outDir), asset.path) : join(ROOT, asset.path);
    if (dryRun) {
      console.log(`[dry-run] ${asset.generator}/${asset.model} -> ${outFile}`);
      continue;
    }
    process.stdout.write(`${asset.path} (${asset.generator}/${asset.model}) ... `);
    try {
      const raw = asset.generator === 'gemini' ? await gemini(asset) : await pixellab(asset, seed);
      mkdirSync(dirname(outFile), { recursive: true });
      postProcess(raw, asset, outFile);
      console.log(`${Math.round(statSync(outFile).size / 1024)} KB`);
    } catch (err) {
      failed++;
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

await main();
