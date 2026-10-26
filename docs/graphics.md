# Graphics

Art for the stage: three host portraits, five kana yōkai sprites and a studio backdrop. Everything is
PixelLab pixel art, matching the Photo Caption pictures. Nothing is hand-drawn yet.

**Style decision (Ladi, 2026-10-26):** pixel art from PixelLab for everything, while the game is
non-commercial. Commission the art before going commercial (see
[commercial-blockers.md](commercial-blockers.md), row 6). The first pass had glossy Gemini host
portraits and a painted Gemini backdrop; those were replaced the same day after a side-by-side of
Gemini, PixelLab and Gemini-drawn pixel art.

Theme: a late-night variety show broadcast from a haunted TV studio. The studio's old dictionary
came alive and its letters are kana yōkai (tsukumogami style). Playful-spooky and warm, never
mocking Japan, no stereotype imagery (no ninja, samurai or geisha).

## Keys

Set in the environment only. They are never written to the repo, logged or printed.

| Env var | Provider | Used for |
| --- | --- | --- |
| `PIXELLAB_API_KEY` | PixelLab (`api.pixellab.ai/v2`) | Everything that ships |
| `GEMINI_API_KEY` | Google Gemini API (`generativelanguage.googleapis.com`) | Optional: drafting a source image to convert. Nothing shipped comes straight from Gemini |

## What's here

`stage/assets/manifest.json` lists every file with `path`, `what`, `generator`, `model`, the full
`prompt` (or the `source` image it was converted from), plus the `params` sent to the API and the
`post` step (background removal, outline, upscale).
The manifest is the source of truth. Edit a prompt there, then regenerate.

| File | Size | Generator / model | Notes |
| --- | --- | --- | --- |
| `stage/assets/hosts/pon.png` | 128², transparent | PixelLab `image-to-pixelart` | Pon, tanuki stand-up MC (Oogiri Night). Converted from the old Gemini portrait |
| `stage/assets/hosts/chochin.png` | 128², transparent | PixelLab `pixflux` | Chōchin-san, lantern-ghost conductor (Last Train) |
| `stage/assets/hosts/fude.png` | 128², transparent | PixelLab `pixflux` | Fude, living calligraphy brush (Kana Yōkai Raid) |
| `stage/assets/studio-bg.png` | 320×180 drawn, saved 6× at 1920×1080, ~45 KB | PixelLab `image-to-pixelart` | Backdrop; converted from the old Gemini backdrop. Centre kept dark for text |
| `stage/assets/yokai/yokai-blob.png` | 128², transparent | PixelLab `pixflux` | Round ghost; glyph goes on the belly |
| `stage/assets/yokai/yokai-lantern.png` | 128², transparent | PixelLab `pixflux` | Chōchin-obake lantern; plain paper below the face |
| `stage/assets/yokai/yokai-umbrella.png` | 128², transparent | PixelLab `pixflux` | Umbrella ghost (see Open questions) |
| `stage/assets/yokai/yokai-scroll.png` | 128², transparent | PixelLab `pixflux` | Hanging scroll; large blank paper for a glyph |
| `stage/assets/yokai/yokai-boss.png` | 192², transparent | PixelLab `pixflux` | Boss: the studio's old dictionary come alive |

Host portraits are transparent 128² sprites, like the yōkai. The stage shows them at 1× (128px) in a
rounded square on `#14101f` with `image-rendering: pixelated`. Don't crop them to a circle: it cuts off
arms and props.

The backdrop is drawn at 320×180 and saved already scaled 6× (nearest neighbour), because a CSS
background can't be made `pixelated` without affecting every image on the page.

The yōkai sprites are generic bodies with no kana on them. The game draws a large kana glyph on top
in a web font, which keeps the kana correct and lets one body serve every kana. Scale them with
`image-rendering: pixelated` and whole-number factors (2×, 3×, 4×). The same goes for the hosts.

## How they were made

**PixelLab `pixflux`** (`POST https://api.pixellab.ai/v2/create-image-pixflux`, synchronous, returns
base64 PNG) drew the yōkai, Chōchin-san and Fude from text. The calls used `no_background: true`,
`outline: "single color black outline"`, `shading: "medium shading"` (`"detailed shading"` for the
boss), `detail: "medium detail"`, `view: "side"` and `text_guidance_scale: 8` (10 for Chōchin-san).
Every yōkai prompt starts with a shared preamble ("Cute friendly Japanese yokai ghost sprite …, big
blank flat smooth area on the front of the body for a text label, no text, no letters, no symbols").
The host prompts share another ("Pixel art character portrait for a cozy-spooky Japanese late-night
TV game show …, no text or letters"). The PNGs are only stripped of metadata, with no resampling.

**PixelLab `image-to-pixelart`** (`POST https://api.pixellab.ai/v2/image-to-pixelart`) converted two
earlier Gemini images, kept in `tools/art/sources/`:

- **Pon.** `pixflux` drew a raccoon or a red panda (pointed ears, ringed tail) in all seven text-only
  attempts, across two prompts that said "tanuki, not a raccoon". Converting the old Gemini Pon
  (256², `init_image_strength: 0`) kept his tanuki look. The result comes on a dark square, so the
  script makes the background transparent (corner flood fill, 6% fuzz) and adds a 1px `#1a0f14`
  outline to match the other sprites.
- **Backdrop.** The old Gemini backdrop at 384×216, converted to 320×180, then upscaled 6×.

Full PixelLab docs: <https://api.pixellab.ai/v2/llms.txt> and <https://api.pixellab.ai/v2/docs>.
Newer endpoints (`/generate-image-v2` Pro, `/create-image-pro-flash`, `/image-to-pixelart-pro`) are
asynchronous: they return a job id that you poll at `/background-jobs/{id}`. The script doesn't use
them yet.

**Gemini** (`gemini-3-pro-image`) made the two source images. The script can still call it
(`generator: "gemini"`) to draft a new source image for `image-to-pixelart`, but nothing in the
manifest uses it now. Gemini can also draw "16-bit pixel art" itself, and that was one of the three
options compared; it reads well once snapped to a 128px grid, but PixelLab was chosen.

Generations: first pass 4 with Gemini and 10 with PixelLab. Pixel-art pass (2026-10-26) about 21
with PixelLab (host drafts, 7 Pon attempts, conversions, 3 backdrop drafts) and 3 with Gemini for the
style comparison.

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

Generation is not deterministic. The manifest records each PixelLab seed, but a rerun of `pixflux`
with the same seed and prompt still gave a different Chōchin-san and Fude, so treat a rerun as a new
variant. The two `image-to-pixelart` conversions did come back the same. Look at every result before you commit it, and use `--out` to
compare. If Node's `fetch` can't reach the APIs behind a proxy, run with `NODE_USE_ENV_PROXY=1`.

## Stage layout and type

- The stage is a fixed 1920×1080 canvas scaled to the window (`stage/src/main.ts`, `scaleCanvas`), with a 5% title-safe margin. Rows: header, host, play area, score ribbon. Nothing scrolls; a play area that is too tall is shrunk to fit (`#fit`).
- Fonts: Pixelify Sans for English titles and numbers only; Noto Sans JP for all Japanese (`--font-ja`); Noto Sans for English body text and romaji (`--font-body`). Both OFL 1.1, loaded from Google Fonts (see commercial-blockers.md, row 11).
- Japanese text is wrapped in `lang="ja"` automatically by `h()` and breaks between phrases (`word-break: auto-phrase`); a blank stays with its particle and a number with its counter.
- Text on coral, mint or gold fills is dark (`--on-accent`), never white.
- The developer panel is hidden; open the stage with `?debug=1` to show it.

## Licensing and terms

Tracked in [commercial-blockers.md](commercial-blockers.md): row 6 (PixelLab) and row 7 (Gemini).

- **PixelLab.** Its Terms of Service (<https://www.pixellab.ai/termsofservice>, read 2026-10-26)
  say: "You own the copyrights to your creations, permitting usage for both commercial and
  non-commercial purposes", and "You retain ownership of any content you create using PixelLab.
  You are free to use, modify, and distribute the outputs … except for training other models
  without our explicit permission." The user is responsible for not infringing third-party rights.
- **Google Gemini API.** No shipped file is raw Gemini output any more, but Pon and the backdrop are
  PixelLab conversions of Gemini images, so Gemini's terms still apply to those two. The source images
  sit in `tools/art/sources/` and aren't served. The Gemini terms are still unread (row 7). Redrawing
  Pon and the backdrop from text alone, or commissioning them, would drop Gemini entirely.
- In many jurisdictions (including the US Copyright Office's current position), purely
  AI-generated images may not be protected by copyright, so others may be free to reuse them. That's
  why the plan is to commission the hosts and key art before selling.

## Open questions for Ladi

1. ~~**Style direction.**~~ Decided 2026-10-26: PixelLab pixel art for everything.
2. **Kasa-obake.** PixelLab drew a ghost wearing a wagasa umbrella like a hat, not a true one-eyed,
   one-legged umbrella yōkai, across three prompt variants. Keep it, or try PixelLab's Pro endpoint
   or a Gemini concept turned into pixel art (`/image-to-pixelart`)?
3. **Chōchin-san's face.** The traditional chōchin-obake has one eye and a long tongue through a
   split in the paper. I gave him two kind eyes so he reads as friendly. Is the traditional look
   preferred?
4. ~~**Portrait backgrounds.**~~ Now transparent sprites, shown in a rounded square at 128px.
5. **Expressions and poses.** Do the hosts need extra states (happy, shocked, thinking) for
   reactions? That would be about 3 more generations per host, using the existing portrait as a
   reference image for consistency.
6. **Animation.** PixelLab can animate characters (idle bob, hit, defeat). Should the yōkai get idle
   and defeat frames for Kana Yōkai Raid?
7. **Backdrop.** Is it wanted at all, or does a flat `#14101f` keep the stage cleaner? It sits under
   a 78–90% dark scrim. A brighter PixelLab draft (a lit stage with red curtains and spotlights) is an
   option if the scrim is lightened.
8. ~~**Final art.**~~ Decided 2026-10-26: AI pixel art while non-commercial; commission before selling.
