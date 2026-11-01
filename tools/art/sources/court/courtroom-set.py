"""Yōkai Court's set: crops the PixelLab draft to the stage, then the art panel's edits (1 Nov 2026).

    python3 tools/art/sources/court/courtroom-set.py tools/art/sources/court/courtroom-draft.png

The draft is PixelLab pixflux, seed 3 (prompt in stage/assets/manifest.json, "yokai-court"), picked from 8.
pixflux letterboxes a 320x180 request, so it is drawn at 320x224; its picture is rows 12-211, and rows 26-205
are kept. Then:
- the two ghost fires at the top (behind the title bar and the timer) are painted out; backdrop.ts floats
  hitodama in the side lanes instead;
- the bench's seven chairs become nine, the middle one taller: a lay-judge trial (裁判員裁判) seats three
  judges and six lay judges, and Fude-san presides from the middle;
- the wall lanterns' cool white glass is warmed to amber, the set's one warm accent.
"""
import sys
from PIL import Image

TOP = 26
set_ = Image.open(sys.argv[1]).convert('RGB').crop((0, TOP, 320, TOP + 180))
px = set_.load()
W = 320

# The ghost fires: blue-white flame pixels in the top rows become the wall beside them (same row).
def fire(c):
    r, g, b = c
    return (b > 120 and b > r + 30) or r + g + b > 300
for x0, x1 in ((86, 106), (216, 238)):
    for y in range(0, 25):
        for x in range(x0, x1):
            if fire(px[x, y]):
                sx = x0 - 1
                while fire(px[sx, y]):
                    sx -= 1
                px[x, y] = px[sx, y]

# Nine chairs. The wall behind the old seven is rebuilt from the row just above them.
CHAIR = (151, 88, 171, 118)  # the fourth chair, 20x30
chair = set_.crop(CHAIR)
for y in range(CHAIR[1], CHAIR[3]):
    for x in range(50, 271):
        px[x, y] = px[x, 86]
# Fude-san's chair: the same chair with its back 5 rows taller.
tall = Image.new('RGB', (20, 35))
tall.paste(chair.crop((0, 0, 20, 8)), (0, 0))
for i in range(5):
    tall.paste(chair.crop((0, 8, 20, 9)), (0, 8 + i))
tall.paste(chair.crop((0, 8, 20, 30)), (0, 13))
for i in range(9):
    x = 52 + round(i * 24.5)
    if i == 4:
        set_.paste(tall, (x, CHAIR[1] - 5))
    else:
        set_.paste(chair, (x, CHAIR[1]))

# Amber lanterns (left x 20-42, right x 278-300).
AMBER = {(236, 239, 229): (255, 214, 140), (184, 174, 160): (226, 156, 84), (127, 110, 111): (150, 92, 64)}
for x0, x1 in ((18, 44), (276, 302)):
    for y in range(28, 95):
        for x in range(x0, x1):
            c = px[x, y]
            if c in AMBER:
                px[x, y] = AMBER[c]

set_.save('stage/assets/scenes/yokai-court.png', optimize=True)
