// Regenerates the stage art listed in stage/assets/manifest.json.
//
//   npx tsx tools/art/generate.ts                  # every asset
//   npx tsx tools/art/generate.ts pon yokai-boss   # only paths containing these words
//   npx tsx tools/art/generate.ts --dry-run        # print what would be generated
//   npx tsx tools/art/generate.ts --out /tmp/art   # write candidates elsewhere to compare
//   npx tsx tools/art/generate.ts --seed 42 yokai  # PixelLab seed override
//
// Animations (model "animate-with-text-v3") come out as one horizontal sprite sheet: the shipped
// sprite in `source` is the first frame, every frame is remapped to that sprite's colours (no
// shimmer), and the API's closing frame is dropped so a loop or a reaction ends back on frame 0.
// An entry with a `polish` block writes its raw sheet to `polish.from` instead; run
// tools/art/polish.ts after it to make the shipped sheet.
//
// All shipped art is PixelLab pixel art. The Gemini path is kept for drafting source images that
// PixelLab's image-to-pixelart then converts (see `source` in the manifest).
//
// Keys come from the environment only (GEMINI_API_KEY, PIXELLAB_API_KEY). They are sent as
// request headers and never printed or written to disk. Post-processing (resize, palette,
// JPEG quality) shells out to ImageMagick (`magick` or `convert`), which must be on PATH.
// See docs/graphics.md.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** 'polish': nothing to call; tools/art/polish.ts makes it from shipped art (lip-sync mouths). */
type Generator = 'gemini' | 'pixellab' | 'polish';

interface Post {
  /** ImageMagick geometry, e.g. "512x512". Smooth (Lanczos) resize; never used on pixel art. */
  resize?: string;
  /** Make the background transparent: flood-fill from the four corners with this fuzz (percent). */
  removeBackground?: number;
  /** Draw a 1px outline of this colour around the opaque pixels (after removeBackground). */
  outline?: string;
  /** Whole-number nearest-neighbour upscale, for pixel art that can't be scaled in CSS. */
  scale?: number;
  /** Quantise to this many colours (PNG8, no dithering). */
  colors?: number;
  /** Write a JPEG at this quality instead of a PNG. */
  jpegQuality?: number;
}

/** A generated image, or the frames of an animation. */
type Raw = Buffer | Buffer[];

interface Asset {
  path: string;
  what: string;
  generator: Generator;
  model: string;
  prompt: string;
  /** image-to-pixelart only: repo path of the image to convert. */
  source?: string;
  params?: Record<string, unknown>;
  post?: Post;
  /** Clean-up for an animation sheet, done by tools/art/polish.ts from the raw sheet at `from`. */
  polish?: { from: string };
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

async function pixellab(asset: Asset, seed: number | undefined): Promise<Raw> {
  const key = requireKey('PIXELLAB_API_KEY');
  if (asset.model === 'animate-with-text-v3') return animate(asset, seed, key);
  const { width = 128, height = 128, ...rest } = (asset.params ?? {}) as { width?: number; height?: number } & Record<string, unknown>;
  let endpoint: string;
  let body: Record<string, unknown>;
  if (asset.model === 'pixflux') {
    endpoint = 'create-image-pixflux';
    body = { description: asset.prompt, image_size: { width, height }, ...rest };
  } else if (asset.model === 'image-to-pixelart') {
    // The prompt is documentation only: this endpoint takes no text, just the source image.
    if (!asset.source) throw new Error('image-to-pixelart needs a source image');
    const src = readFileSync(join(ROOT, asset.source));
    const [sw, sh] = execFileSync(imageMagick(), [join(ROOT, asset.source), '-format', '%w %h', 'info:']).toString().split(' ').map(Number);
    endpoint = 'image-to-pixelart';
    body = { image: { base64: src.toString('base64') }, image_size: { width: sw, height: sh }, output_size: { width, height }, ...rest };
  } else {
    throw new Error(`PixelLab model ${asset.model} is not supported by this script`);
  }
  const res = await fetch(`https://api.pixellab.ai/v2/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...body, ...(seed === undefined ? {} : { seed }) }),
  });
  if (!res.ok) throw new Error(`PixelLab ${res.status}: ${await errorText(res)}`);
  const json = (await res.json()) as { image?: { base64?: string } };
  const b64 = json.image?.base64?.replace(/^data:image\/\w+;base64,/, '');
  if (!b64) throw new Error('PixelLab returned no image');
  return Buffer.from(b64, 'base64');
}

/**
 * animate-with-text-v3: the source sprite is the first frame and, with `loop: true` (the default),
 * the last one too, so idles loop and reactions land back on the idle pose. Asynchronous: it
 * returns a job id that is polled until the frames are ready (30 s to a few minutes).
 */
async function animate(asset: Asset, seed: number | undefined, key: string): Promise<Buffer[]> {
  if (!asset.source) throw new Error('animate-with-text-v3 needs a source sprite');
  const first = { type: 'base64', base64: readFileSync(join(ROOT, asset.source)).toString('base64'), format: 'png' };
  const { loop = true, ...rest } = (asset.params ?? {}) as { loop?: boolean } & Record<string, unknown>;
  const auth = { authorization: `Bearer ${key}` };
  const res = await fetch('https://api.pixellab.ai/v2/animate-with-text-v3', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...auth },
    body: JSON.stringify({ first_frame: first, ...(loop ? { last_frame: first } : {}), action: asset.prompt, no_background: true, ...rest, ...(seed === undefined ? {} : { seed }) }),
  });
  if (!res.ok) throw new Error(`PixelLab ${res.status}: ${await errorText(res)}`);
  const { background_job_id: id } = (await res.json()) as { background_job_id?: string };
  if (!id) throw new Error('PixelLab returned no job id');
  for (let tries = 0; tries < 120; tries++) {
    await new Promise((r) => setTimeout(r, 6_000));
    const poll = await fetch(`https://api.pixellab.ai/v2/background-jobs/${id}`, { headers: auth });
    if (!poll.ok) continue;
    const job = (await poll.json()) as { status?: string; last_response?: { images?: ({ base64?: string } | string)[]; detail?: string } };
    if (job.status === 'failed') throw new Error(`PixelLab job failed: ${job.last_response?.detail ?? 'no detail'}`);
    if (job.status !== 'completed') continue;
    const frames = (job.last_response?.images ?? []).map((im) => (typeof im === 'string' ? im : (im.base64 ?? '')).replace(/^data:image\/\w+;base64,/, ''));
    if (frames.length < 2) throw new Error('PixelLab returned no frames');
    return frames.map((b) => Buffer.from(b, 'base64'));
  }
  throw new Error('PixelLab job timed out');
}

/** Frames → one horizontal sheet, each frame snapped to the first frame's colours. */
function sheet(frames: Buffer[], asset: Asset, outFile: string): void {
  const im = imageMagick();
  const work = mkdtempSync(join(tmpdir(), 'kotoba-anim-'));
  try {
    // A loop's last frame repeats the first (we asked for it), so it is dropped: the sheet plays
    // 0..n-1 and wraps cleanly. A one-shot (loop: false) keeps every frame.
    const loop = (asset.params as { loop?: boolean } | undefined)?.loop !== false;
    const files = (loop ? frames.slice(0, -1) : frames).map((f, i) => {
      const file = join(work, `f${String(i).padStart(2, '0')}.png`);
      writeFileSync(file, f);
      return file;
    });
    // Every frame is remapped to frame 0's colours (no shimmer between frames), and its alpha is
    // cut to fully on or off. The remap drops alpha, so each frame's mask is put back after it.
    const palette = join(work, 'palette.png');
    execFileSync(im, [files[0]!, '-alpha', 'off', '-unique-colors', palette]);
    const fixed = files.map((file, i) => {
      const out = join(work, `g${String(i).padStart(2, '0')}.png`);
      execFileSync(im, [file, '-strip', '(', '+clone', '-alpha', 'extract', '-threshold', '50%', ')', '(', '-clone', '0', '-alpha', 'off', '+dither', '-remap', palette, ')', '-delete', '0', '+swap', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', `PNG32:${out}`]);
      return out;
    });
    execFileSync(im, [...fixed, '+append', '+repage', '-define', 'png:compression-level=9', `PNG32:${outFile}`], { stdio: ['ignore', 'ignore', 'inherit'] });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
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
    if (post.removeBackground !== undefined) {
      const [w = 1, h = 1] = execFileSync(im, [input, '-format', '%w %h', 'info:']).toString().split(' ').map(Number);
      args.push('-alpha', 'set', '-fuzz', `${post.removeBackground}%`, '-fill', 'none');
      for (const corner of [`0,0`, `${w - 1},0`, `0,${h - 1}`, `${w - 1},${h - 1}`]) args.push('-draw', `color ${corner} floodfill`);
      args.push('-fuzz', '0');
    }
    if (post.outline) {
      // Copy, turn the alpha into a 1px-dilated silhouette in the outline colour, and put it underneath.
      args.push('(', '+clone', '-alpha', 'extract', '-threshold', '50%', '-morphology', 'Dilate', 'Diamond:1');
      args.push('-background', post.outline, '-alpha', 'shape', ')', '+swap', '-compose', 'over', '-composite');
      args.push('-channel', 'A', '-threshold', '50%', '+channel');
    }
    if (post.scale) args.push('-filter', 'point', '-resize', `${post.scale * 100}%`);
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
  const todo = manifest.assets.filter((a) => a.generator !== 'polish' && (filters.length === 0 || filters.some((f) => a.path.includes(f))));
  if (todo.length === 0) throw new Error(`No manifest entries match: ${filters.join(', ')}`);

  let failed = 0;
  for (const asset of todo) {
    // A polished animation's raw sheet goes to its polish.from; tools/art/polish.ts makes the shipped one.
    const target = asset.polish?.from ?? asset.path;
    const outFile = outDir ? join(resolve(outDir), target) : join(ROOT, target);
    if (dryRun) {
      console.log(`[dry-run] ${asset.generator}/${asset.model} -> ${outFile}`);
      continue;
    }
    process.stdout.write(`${asset.path} (${asset.generator}/${asset.model}) ... `);
    try {
      const raw = asset.generator === 'gemini' ? await gemini(asset) : await pixellab(asset, seed);
      mkdirSync(dirname(outFile), { recursive: true });
      if (Array.isArray(raw)) sheet(raw, asset, outFile);
      else postProcess(raw, asset, outFile);
      console.log(`${Math.round(statSync(outFile).size / 1024)} KB`);
    } catch (err) {
      failed++;
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

await main();
