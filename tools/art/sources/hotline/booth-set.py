"""Ghost Advice Hotline's set: crops the PixelLab draft to the stage and makes the call light's "off" frame.

    python3 tools/art/sources/hotline/booth-set.py <pixflux 320x224 draft>

The draft is PixelLab pixflux, seed 21 (prompt in stage/assets/manifest.json, "hotline-booth"). pixflux
letterboxes a 320x180 request, so it is drawn at 320x224 and rows 12-191 are kept (so the call light hangs below the caller's card). Then:
- the framed picture at the left edge had squiggles that read as fake writing: its paper is painted plain;
- hotline-bulb-off.png is the hanging red bulb with its glass remapped to unlit reds, drawn over the
  set by stage/src/backdrop.ts on the "off" beat while the line rings.
"""
import sys
from PIL import Image

TOP = 12
src = Image.open(sys.argv[1]).convert('RGB')
set_ = src.crop((0, TOP, 320, TOP + 180))
px = set_.load()

# The framed picture (x 0-10, draft rows 68-108): plain grey paper, no marks.
PAPER = (0x4E, 0x43, 0x4D)
for y in range(68 - TOP, 109 - TOP):
    for x in range(0, 11):
        if sum(px[x, y]) < 90:
            px[x, y] = PAPER

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
