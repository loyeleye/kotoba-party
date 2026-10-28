# Graphics

Art for the stage: three host portraits, five kana yōkai sprites and the backdrop sets. Everything is
PixelLab pixel art, matching the Photo Caption pictures, except three tiny hand-drawn page sprites.

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
| `stage/assets/hosts/nobiko.png` | 128², transparent | PixelLab `pixflux` + sketch | Nobiko-san, rokurokubi matchmaking auntie (Omiai, Karaoke Duel). Text alone never drew the long neck (12 tries), so pixflux redrew a layout sketch (`init_image`, see below) |
| `stage/assets/yokai/yokai-blob.png` | 128², transparent | PixelLab `pixflux` | Round ghost; glyph goes on the belly |
| `stage/assets/yokai/yokai-lantern.png` | 128², transparent | PixelLab `pixflux` | Chōchin-obake lantern; plain paper below the face |
| `stage/assets/yokai/yokai-umbrella.png` | 128², transparent | PixelLab `pixflux` | Umbrella ghost (see Open questions) |
| `stage/assets/yokai/yokai-scroll.png` | 128², transparent | PixelLab `pixflux` | Hanging scroll; large blank paper for a glyph |
| `stage/assets/yokai/yokai-boss.png` | 192², transparent | PixelLab `pixflux` | Boss: the studio's old dictionary come alive |

Host portraits are transparent 128² sprites, like the yōkai. The stage shows them with `image-rendering: pixelated`
at a whole multiple of their pixels on the real screen (1× at 720p, 2× at 1080p, 3× at 4K, so 192 to
256 canvas px; see `scaleCanvas` in `stage/src/main.ts`), on a lit plate: a soft disc of lantern
light with a paper rim that lifts each host off the dark sets. Don't crop them to a circle: it cuts off
arms and props.

The yōkai sprites are generic bodies with no kana on them. The game draws a large kana glyph on top
in a web font, which keeps the kana correct and lets one body serve every kana. Scale them with
`image-rendering: pixelated` and whole-number factors (2×, 3×, 4×). The same goes for the hosts.

## Animation

Twenty-one sprite sheets in `stage/assets/anim/` (art panel, 26 Oct 2026). Each is one row of square
frames. Most are made by PixelLab's `animate-with-text-v3` from the still sprite, which goes in as
both the first and the last frame so a loop closes on the pose it started from, then cleaned up by
`tools/art/polish.ts` (below). The three mouth sheets are drawn from the portraits by the same tool.

| Sheets | Frames | Plays |
| --- | --- | --- |
| `{pon,chochin,fude,nobiko}-idle.png` | 8 × 128² | One breath every few seconds, then holds frame 0 |
| `{pon,chochin,fude,nobiko}-{cheer,oops}.png` | 8 × 128² | Once, when a host line has that mood, then back to idle |
| `{pon,chochin,fude,nobiko}-talk.png` | 3 × 128² | Lip sync: closed, half open, open, shown one at a time while the host speaks |
| `yokai-{blob,lantern,umbrella,scroll}-hit.png` | 11 × 128² | Once when a yōkai is caught: 4 flinch frames, then the shared smoke puff; ends empty |
| `yokai-boss-defeat.png` | 9 × 192² | Once when the boss is beaten; ends empty |

The server gives each host line a `mood` from its cue (`server/src/host.ts`: a win cheers, a miss
flinches). `stage/src/sprites.ts` plays the sheets: an `<img>` of the whole strip in a box that clips
it to one frame, moved with `transform: translateX()` and `steps(n)`, so only a layer moves and every
frame lands on whole pixels. Every sheet is preloaded and decoded when the stage opens; a sheet that
fails to load falls back to the still sprite.

Rules for anything that moves:

- Sprites play at whole-number scales (1×, 2×), with `steps()`. No scale or rotate tweens on pixel
  art, and no smooth sub-pixel floats: the yōkai bob is 0, 2, 4 px in steps.
- Japanese that players are reading never moves: the boss's word stays still while its art bobs
  behind it, the channel-change title cuts in and out, and no Japanese types itself out.
- Flashes are opacity on a mask of the sprite, not `filter`.
- Calm motion (the VIP's switch on the phone, or the system's reduced-motion setting) holds every
  sprite on frame 0, stops shakes, bobs and wipes, and fades new things in. Reveal beats keep their
  timing.

**Lip sync.** VOICEVOX's `audio_query` gives the length of every consonant and vowel it will say.
The server turns that into a mouth track (`mouthTrack` in `server/ai/tts.ts`: あ and お open wide,
い, う and え half, ん, っ, pauses and p/b/m closed) and sends it with the line (`HostSay.mouth`). The
stage shows the matching mouth frame against the audio's own clock, so it stays in sync even if the
audio starts late. With audio but no track the mouth flaps; with no audio (subtitles only, or the
browser blocked autoplay) it flaps for about as long as the line takes to say. A reaction plays
first and the mouth joins after; Calm motion keeps the mouth still.

**Polish** (`npx tsx tools/art/polish.ts`, after generating). PixelLab's frames are raw: shading
crawls between frames, some frames go off-model, and a one-shot doesn't always end cleanly. Every
animation entry in the manifest has a `polish` block, and the tool rebuilds the shipped sheet from
the raw one kept in `tools/art/sources/anim/`:

- `frames` keeps only the good frames, in play order (each yōkai keeps 4 flinch frames).
- `steady` gives a pixel the shipped sprite's colour when it is within that distance of it, so
  shading holds still while real motion stays.
- `poof` appends the shared smoke puff (`stage/assets/fx/poof.png`, PixelLab), its first frame drawn
  over the yōkai so it turns into smoke instead of vanishing.
- `mouth` draws the lip-sync frames from the portrait itself: in each column of the mouth box the
  opening runs between the top and bottom outline pixel; closed keeps one lip line and paints the
  rest with the skin colour around it, half closes it halfway. So only the mouth ever moves.

The generator turns the frames into a sheet: it drops a loop's repeated last frame, remaps every
frame to frame 0's colours (no shimmer between frames), cuts alpha to on or off, and puts each
frame's mask back after the remap (an early batch lost its transparency without that step).

## Backdrop

Since 2026-10-27 the stage draws its set into one 320×180 `<canvas>` behind everything
(`stage/src/backdrop.ts`), scaled 6× with `image-rendering: pixelated`, under the scrim (`.scrim` in
`stage/style.css`). This follows the art panel's review of parallax backgrounds (26 Oct 2026).

| Set | File | Games |
| --- | --- | --- |
| Studio | `stage/assets/scenes/studio.png` | Lobby, Kana Raid, Word Gauntlet, Concentration, Oekaki, Who's the Tourist? |
| Comedy stage | `scenes/comedy-stage.png` | Oogiri Night, Phrase Bingo Theater |
| Karaoke box | `scenes/karaoke-box.png` | Karaoke Duel |
| Onsen inn | `scenes/onsen-inn.png` | Murder at the Onsen |
| Tea room | `scenes/tea-room.png` | Omiai Matchmaker |
| Train carriage | `scenes/train-carriage.png` | Last Train (windows cut out) |
| Pages | `scenes/page-a.png` … `page-c.png` | The loose dictionary pages floating in the studio's side lanes |

Every set is a text-only PixelLab `pixflux` image drawn as pixel art from the start, with its bright
props at the sides and a dark, plain centre for the text. The first studio (2026-10-26) was converted
from a painted Gemini image, and its edges smeared into blobs at 6×; it was replaced on 2026-10-27.
The pages are hand-drawn, pixel by pixel, so they stay crisp. Effects are drawn in code.

Per mode:

- **Studio (lobby and most games):** floor mist drifting both ways, two spotlights whose pools sweep
  the floor, the pages bobbing a pixel or two.
- **Kana Raid:** the studio with will-o'-wisps (鬼火) in the side lanes and thicker mist. No pages:
  drifting paper would look like yōkai to catch.
- **Comedy stage:** brighter spotlights and a little stage smoke. **Karaoke box:** mirror-ball dots
  on the side walls, stepping once a bar. **Onsen inn:** steam (湯気) rising from the bottom
  corners. **Tea room:** a few 桜 petals.
- **Last Train:** the carriage. A night town (far skyline and near poles, drawn in code) scrolls past
  the windows during the intro and the first 1.5 s of each "next stop", then the train pulls in and
  holds; rain (秋雨) runs on the glass, and the straps sway while it moves.
- **Who's the Tourist?** stays on the plain studio: a themed set would tell the tourist the place.
- **Confetti (紙吹雪):** one burst in gold and washi colours in the side lanes when a round's scores
  or the recap appear.

Rules:

- Nothing is drawn inside the text area (art px x 56–264, y 22–150), except the floor mist below it.
  Effects never use the right/wrong colours (`--good`, `--bad`) or seat colours.
- Effects run full in the lobby, intros and the recap, low (35% speed) through prompts, reveals and
  waits, and ease to a stop over about 400 ms while anyone speaks (`speaks()` in
  `stage/src/music/cues.ts`), while Kana Raid's yōkai are out, and in a timer's last 5 seconds.
- The camera steps 1 art px every 120 ms to a new mark on each phase change (the pages move 2×, the
  set not at all); in the lobby it drifts slowly between two marks. No zoom or shake.
- Light is flat layers at one opacity each, not dithered (a dithered beam reads as a grid at 6×), and
  nothing flashes more than twice a second.
- Calm motion and `prefers-reduced-motion` draw one still frame (a still confetti scatter in the
  recap). **Background effects** off in the stage's Settings shows the set with no effects. Both
  are per screen.
- About 12 frames a second, paused while the tab is hidden. No filters or blend modes.

How the sets were made: see each entry in the manifest. `pixflux` letterboxes a 320×180 request
with black bars, so each set was drawn at 320×224 and cropped to 180 rows. The carriage's black
window panes were flood-filled to transparent. Both steps were done by hand, so the manifest marks
the sets `polish` and `tools/art/generate.ts` skips them.

## How they were made

**PixelLab `pixflux`** (`POST https://api.pixellab.ai/v2/create-image-pixflux`, synchronous, returns
base64 PNG) drew the yōkai, Chōchin-san and Fude from text. The calls used `no_background: true`,
`outline: "single color black outline"`, `shading: "medium shading"` (`"detailed shading"` for the
boss), `detail: "medium detail"`, `view: "side"` and `text_guidance_scale: 8` (10 for Chōchin-san).
Every yōkai prompt starts with a shared preamble ("Cute friendly Japanese yokai ghost sprite …, big
blank flat smooth area on the front of the body for a text label, no text, no letters, no symbols").
The host prompts share another ("Pixel art character portrait for a cozy-spooky Japanese late-night
TV game show …, no text or letters"). The PNGs are only stripped of metadata, with no resampling.

**Nobiko-san** (2026-10-27, redrawn 2026-10-28) is `pixflux` too, but from a sketch. A rokurokubi's
long neck is the whole joke, and text alone drew a normal-necked lady in all 12 tries over two
prompts. So `tools/art/sources/nobiko-sketch.py` cuts a text-only auntie (`nobiko-body.png`, seed 8)
into head and body, shrinks them (head 0.9, body 0.75), and joins them with a hand-drawn S-curved
neck; `generate.ts` sends that sketch as `init_image` when a `pixflux` entry has a `source`. The
first version kept the sketch too closely (strength 300) and looked flatter than the other hosts,
so the redraw uses strength 80 (seed 21), which lets pixflux repaint it at full detail. Her
lip-sync mouth is hand-painted (an outlined 7×5 opening), so `polish.ts` uses the normal outline
mode; its `'fill'` mode (every non-skin pixel in the box is the opening) is there for mouths with no
outline.

**PixelLab `image-to-pixelart`** (`POST https://api.pixellab.ai/v2/image-to-pixelart`) converted two
earlier Gemini images, kept in `tools/art/sources/`:

- **Pon.** `pixflux` drew a raccoon or a red panda (pointed ears, ringed tail) in all seven text-only
  attempts, across two prompts that said "tanuki, not a raccoon". Converting the old Gemini Pon
  (256², `init_image_strength: 0`) kept his tanuki look. The result comes on a dark square, so the
  script makes the background transparent (corner flood fill, 6% fuzz) and adds a 1px `#1a0f14`
  outline to match the other sprites.
- **Backdrop** (removed 2026-10-27). The old Gemini backdrop at 384×216, converted to 320×180. Its
  smeared edges are why the sets are now drawn with `pixflux` instead.

Full PixelLab docs: <https://api.pixellab.ai/v2/llms.txt> and <https://api.pixellab.ai/v2/docs>.
Newer endpoints (`/generate-image-v2` Pro, `/create-image-pro-flash`, `/image-to-pixelart-pro`) are
asynchronous: they return a job id that you poll at `/background-jobs/{id}`. The script doesn't use
them yet.

**Gemini** (`gemini-3-pro-image`) made the two source images (only Pon's is left). The script can still call it
(`generator: "gemini"`) to draft a new source image for `image-to-pixelart`, but nothing in the
manifest uses it now. Gemini can also draw "16-bit pixel art" itself, and that was one of the three
options compared; it reads well once snapped to a 128px grid, but PixelLab was chosen.

Generations: first pass 4 with Gemini and 10 with PixelLab. Pixel-art pass (2026-10-26) about 21
with PixelLab (host drafts, 7 Pon attempts, conversions, 3 backdrop drafts) and 3 with Gemini for the
style comparison.
Animation pass (2026-10-26): 28 `animate-with-text-v3` jobs (14 sheets × seeds 11 and 22, the
better seed kept, recorded in the manifest), plus a first batch thrown away for lost transparency.
Each job cost about 2 generations. Polish pass (same day): 3 smoke-puff stills, 3 poof animations,
9 talk animations (not used: the mouths came out cleaner drawn from the portraits), and 9 retries of
the three weakest host reactions with sharper prompts.

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
- Fonts: Pixelify Sans for English titles and numbers only; Press Start 2P for the room code (`--font-code`), whose letters must survive a glance across the room; Noto Sans JP for all Japanese (`--font-ja`); Noto Sans for English body text and romaji (`--font-body`). Both OFL 1.1, loaded from Google Fonts (see commercial-blockers.md, row 11).
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
- **Google Gemini API.** No shipped file is raw Gemini output any more, but Pon is a PixelLab
  conversion of a Gemini image, so Gemini's terms still apply to him. The source image sits in
  `tools/art/sources/` and isn't served. The Gemini terms are still unread (row 7). Since 2026-10-27
  the backdrop no longer comes from Gemini. Redrawing Pon from text alone, or commissioning him,
  would drop Gemini entirely.
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
7. ~~**Backdrop.**~~ Decided 2026-10-26: keep it, with effects. On 2026-10-27 it became a set per
   game (see [Backdrop](#backdrop)).
8. ~~**Final art.**~~ Decided 2026-10-26: AI pixel art while non-commercial; commission before selling.
