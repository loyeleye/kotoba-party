"""Ghost Advice Hotline's set: crops the PixelLab draft to the stage and makes the call light's "off" frame.

    python3 tools/art/sources/hotline/booth-set.py tools/art/sources/hotline/booth-draft.png \
        tools/art/sources/hotline/wisp-draft.png tools/art/sources/hotline/phone-draft.png \
        tools/art/sources/hotline/mic-draft.png

The draft is PixelLab pixflux, seed 21 (prompt in stage/assets/manifest.json, "hotline-booth"). pixflux
letterboxes a 320x180 request, so it is drawn at 320x224 and rows 12-191 are kept (so the call light hangs below the caller's card),
less 14 rows of empty window just above the desk (draft rows 98-111), so the desk and its props sit 14 art px
higher, clear of the scoreboard (art panel, 1 Nov 2026), and the dark under the desk fills the bottom. Then:
- the framed picture at the left edge had squiggles that read as fake writing: its paper is painted plain;
- hotline-bulb-off.png is the hanging red bulb with its glass remapped to unlit reds, drawn over the
  set by stage/src/backdrop.ts on the "off" beat while the line rings.
"""
import sys
from PIL import Image

TOP = 12
# Set rows from SEAM down come from 14 draft rows further down: the desk is raised by cutting window.
SEAM = 86
RAISE = 14
src = Image.open(sys.argv[1]).convert('RGB')
spx = src.load()

# The framed picture (x 0-10, draft rows 68-108): plain grey paper, no marks.
PAPER = (0x4E, 0x43, 0x4D)
for y in range(68, 109):
    for x in range(0, 11):
        if sum(spx[x, y]) < 90:
            spx[x, y] = PAPER

set_ = Image.new('RGB', (320, 180))
set_.paste(src.crop((0, TOP, 320, TOP + SEAM)), (0, 0))
set_.paste(src.crop((0, TOP + SEAM + RAISE, 320, TOP + 180 + RAISE)), (0, SEAM))
px = set_.load()

set_.save('stage/assets/scenes/hotline-booth.png', optimize=True)

# The call light, unlit: only its glass changes.
UNLIT = {
    (0xEA, 0x37, 0x44): (0x4A, 0x16, 0x26),
    (0xE9, 0x93, 0x56): (0x5E, 0x22, 0x2C),
    (0xEC, 0xD3, 0xA5): (0x74, 0x34, 0x38),
    (0xF4, 0xF1, 0xED): (0x8A, 0x46, 0x46),
}
BOX = (272, 66 - TOP, 306, 96 - TOP)
bulb = Image.new('RGBA', (BOX[2] - BOX[0], BOX[3] - BOX[1]), (0, 0, 0, 0))
for y in range(BOX[1], BOX[3]):
    for x in range(BOX[0], BOX[2]):
        c = px[x, y]
        if c in UNLIT:
            bulb.putpixel((x - BOX[0], y - BOX[1]), UNLIT[c] + (255,))
bulb.save('stage/assets/scenes/hotline-bulb-off.png', optimize=True)
print('bulb box', BOX)

# The call light, lit: the same glass pixels at full colour, drawn above the scrim (with its glow) while lit.
lit = Image.new('RGBA', bulb.size, (0, 0, 0, 0))
for y in range(BOX[1], BOX[3]):
    for x in range(BOX[0], BOX[2]):
        c = px[x, y]
        if c in UNLIT:
            lit.putpixel((x - BOX[0], y - BOX[1]), c + (255,))
lit.save('stage/assets/scenes/hotline-bulb-on.png', optimize=True)

# The other pixflux drafts, trimmed to their pixels: the hitodama (32x32, seed 13; backdrop.ts floats it in the
# booth window's left pane and the courtroom's side lanes), the caller card's rotary phone (32x32, seed 3)
# and its "said it" mic (32x32, seed 7).
if len(sys.argv) > 2:
    for src, out in zip(sys.argv[2:5], ('scenes/hotline-wisp', 'icons/hl-phone', 'icons/hl-mic')):
        im = Image.open(src).convert('RGBA')
        im.crop(im.getbbox()).save(f'stage/assets/{out}.png', optimize=True)
