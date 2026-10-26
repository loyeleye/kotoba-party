# Graphics

First art pass (2026-10-26) for the stage: three host portraits, five pixel-art kana yōkai sprites
and an optional studio backdrop. Everything was generated; nothing is hand-drawn yet.

Theme: a late-night variety show broadcast from a haunted TV studio. The studio's old dictionary
came alive and its letters are kana yōkai (tsukumogami style). Playful-spooky and warm, never
mocking Japan, no stereotype imagery (no ninja, samurai or geisha).

## Keys

Set in the environment only. They are never written to the repo, logged or printed.

| Env var | Provider | Used for |
| --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini API (`generativelanguage.googleapis.com`) | Host portraits, studio backdrop |
| `PIXELLAB_API_KEY` | PixelLab (`api.pixellab.ai/v2`) | Pixel-art yōkai sprites |

## What's here

`stage/assets/manifest.json` lists every file with `path`, `what`, `generator`, `model`, the full
`prompt`, plus the `params` sent to the API and the `post` step (resize, palette, JPEG quality).
The manifest is the source of truth. Edit a prompt there, then regenerate.

| File | Size | Generator / model | Notes |
| --- | --- | --- | --- |
| `stage/assets/hosts/pon.png` | 512², ~95 KB | Gemini `gemini-3-pro-image` | Pon, tanuki stand-up MC (Oogiri Night) |
| `stage/assets/hosts/chochin.png` | 512², ~70 KB | Gemini `gemini-3-pro-image` | Chōchin-san, lantern-ghost conductor (Last Train) |
| `stage/assets/hosts/fude.png` | 512², ~110 KB | Gemini `gemini-3-pro-image` | Fude, living calligraphy brush (Kana Yōkai Raid) |
| `stage/assets/studio-bg.jpg` | 1920×1080, ~95 KB | Gemini `gemini-3-pro-image` | Optional backdrop; centre and right are kept dark for text |
| `stage/assets/yokai/yokai-blob.png` | 128², transparent | PixelLab `pixflux` | Round ghost; glyph goes on the belly |
| `stage/assets/yokai/yokai-lantern.png` | 128², transparent | PixelLab `pixflux` | Chōchin-obake lantern; plain paper below the face |
| `stage/assets/yokai/yokai-umbrella.png` | 128², transparent | PixelLab `pixflux` | Umbrella ghost (see Open questions) |
| `stage/assets/yokai/yokai-scroll.png` | 128², transparent | PixelLab `pixflux` | Hanging scroll; large blank paper for a glyph |
| `stage/assets/yokai/yokai-boss.png` | 192², transparent | PixelLab `pixflux` | Boss: the studio's old dictionary come alive |

Host portraits have no transparency. They sit on a solid `#14101f` background (the stage
background colour) with a soft spotlight glow, so they blend into the dark stage UI. Crop them to a
circle or rounded square if you need to.

The yōkai sprites are generic bodies with no kana on them. The game draws a large kana glyph on top
in a web font, which keeps the kana correct and lets one body serve every kana. Scale them with
`image-rendering: pixelated` and whole-number factors (2×, 3×, 4×).

## How they were made

**Gemini.** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent`
with `generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio, imageSize } }`.
Portraits were 1:1 at `1K`, the backdrop 16:9 at `2K`. All three portraits share one style
paragraph (in each prompt): bold clean outlines, flat colours with soft cel shading, a coral
`#ff7a59` rim light and a mint `#57d9a3` glow, a `#14101f` background, and "no text, no letters".
That last part is there because image models garble text, and garbled kana would be worse than
none. The images were then resized to 512² (Lanczos) and quantised to a 256-colour PNG8. The
backdrop was saved as a 1920×1080 JPEG at quality 72.

Gemini models this key can reach (as of 2026-10-26): `gemini-3-pro-image`, `gemini-3-pro-image-preview`,
`gemini-3.1-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-3.1-flash-lite-image`,
`gemini-2.5-flash-image`. The Pro model was used for quality. Flash is cheaper for iterating.

**PixelLab.** `POST https://api.pixellab.ai/v2/create-image-pixflux`. This endpoint is synchronous
and returns base64 PNG. The calls used `no_background: true`, `outline: "single color black outline"`,
`shading: "medium shading"` (`"detailed shading"` for the boss), `detail: "medium detail"`,
`view: "side"` and `text_guidance_scale: 8`. Every yōkai prompt starts with a shared preamble
("Cute friendly Japanese yokai ghost sprite …, big blank flat smooth area on the front of the
body for a text label, no text, no letters, no symbols"). The PNGs are only stripped of metadata,
with no resampling. Full docs: <https://api.pixellab.ai/v2/llms.txt> and
<https://api.pixellab.ai/v2/docs>. Newer endpoints (`/generate-image-v2` Pro, `/create-image-pro-flash`)
are asynchronous: they return a job id that you poll at `/background-jobs/{id}`. The script doesn't
use them yet.

Generations used in this pass: 4 with Gemini, 10 with PixelLab (5 first drafts, 3 regenerations
of the blob, umbrella and scroll, then 2 more umbrella attempts that were rejected).

## Regenerate

Needs Node 22+, `npm install`, ImageMagick (`magick` or `convert`) on PATH, and the keys in the
environment.

```sh
npx tsx tools/art/generate.ts                   # everything in the manifest
npx tsx tools/art/generate.ts pon chochin       # entries whose path contains these words
npx tsx tools/art/generate.ts --out /tmp/art yokai   # write candidates elsewhere to compare
npx tsx tools/art/generate.ts --seed 7 yokai-boss    # PixelLab seed override
npx tsx tools/art/generate.ts --dry-run
```

Generation is not deterministic. Neither provider was given a seed this time, so a rerun gives a
new variant, not the same image. Look at every result before you commit it, and use `--out` to
compare. If Node's `fetch` can't reach the APIs behind a proxy, run with `NODE_USE_ENV_PROXY=1`.

## Licensing and terms

- **PixelLab.** Its Terms of Service (<https://www.pixellab.ai/termsofservice>, read 2026-10-26)
  say: "You own the copyrights to your creations, permitting usage for both commercial and
  non-commercial purposes", and "You retain ownership of any content you create using PixelLab.
  You are free to use, modify, and distribute the outputs … except for training other models
  without our explicit permission." The user is responsible for not infringing third-party rights.
- **Google Gemini API.** I could not verify this. The Gemini API Additional Terms page
  (<https://ai.google.dev/gemini-api/terms>) was blocked from this session (proxy 403 / DNS). From
  memory, and to be confirmed: Google doesn't claim ownership of generated content, the user is
  responsible for how it's used, the Generative AI Prohibited Use Policy applies, and on the free
  tier prompts and outputs may be used to improve Google's products (the paid tier doesn't do this).
  Images from Gemini image models carry an invisible **SynthID** watermark. Read the current terms
  before shipping commercially.
- In many jurisdictions (including the US Copyright Office's current position), purely
  AI-generated images may not be protected by copyright, so others may be free to reuse them. If
  the hosts become the game's identity, consider hand-finished or commissioned final art.

## Open questions for Ladi

1. **Style direction.** The hosts are glossy "modern cartoon" and the yōkai are pixel art. Keep this
   mix (portraits for hosts, pixel sprites for enemies), or move everything to one style? Pixel-art
   hosts via PixelLab, or painted yōkai via Gemini, are both possible.
2. **Kasa-obake.** PixelLab drew a ghost wearing a wagasa umbrella like a hat, not a true one-eyed,
   one-legged umbrella yōkai, across three prompt variants. Keep it, or try PixelLab's Pro endpoint
   or a Gemini concept turned into pixel art (`/image-to-pixelart`)?
3. **Chōchin-san's face.** The traditional chōchin-obake has one eye and a long tongue through a
   split in the paper. I gave him two kind eyes so he reads as friendly. Is the traditional look
   preferred?
4. **Portrait backgrounds.** Should they be transparent cut-outs instead of the solid `#14101f`
   (needs background removal), and does the stage want them square or circular?
5. **Expressions and poses.** Do the hosts need extra states (happy, shocked, thinking) for
   reactions? That would be about 3 more generations per host, using the existing portrait as a
   reference image for consistency.
6. **Animation.** PixelLab can animate characters (idle bob, hit, defeat). Should the yōkai get idle
   and defeat frames for Kana Yōkai Raid?
7. **Backdrop.** Is it wanted at all, or does a flat `#14101f` keep the stage cleaner? It is dark,
   but the floating pages are the brightest spots, so a dark scrim behind text may still be needed.
8. **Final art.** Is AI art acceptable for a public release, or is this placeholder until an artist
   is hired? (See the copyright note above.)
