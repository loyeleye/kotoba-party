"""Layout sketch for Pon waving the team flags (Bento Haus VS intro and closing).

Starts from the shipped Pon, paints the microphone out with his paw colour, and puts a pole with a
flag in each hand: red noren-style flag on his left (screen left), blue wave flag on his right.
pixflux then redraws the sketch (init_image) so the flags get proper shading.

    python3 tools/art/sources/pon-flags-sketch.py   # writes tools/art/sources/pon-flags-sketch.png
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'tools/art/sources/pon-flags-sketch.png'

INK = (26, 15, 20, 255)
WOOD = (150, 98, 52, 255)
RED = (214, 58, 52, 255)
RED_DARK = (150, 34, 40, 255)
BLUE = (52, 112, 204, 255)
BLUE_DARK = (30, 66, 140, 255)
WHITE = (244, 236, 220, 255)

im = Image.open(ROOT / 'stage/assets/hosts/pon.png').convert('RGBA')
px = im.load()

# Paint the microphone out: its grey-blue head and dark outline become arm fur, and the bit of
# handle under his paw becomes belly.
ARM = (211, 105, 45, 255)
BELLY = (243, 205, 150, 255)
for y in range(53, 70):
    for x in range(53, 64):
        r, g, b, a = px[x, y]
        if a and (b > r or r + g + b < 120):
            px[x, y] = ARM
for y in range(77, 82):
    for x in range(53, 59):
        r, g, b, a = px[x, y]
        if a and (b > r or r + g + b < 120):
            px[x, y] = BELLY

d = ImageDraw.Draw(im)


def flag(pole_bottom, pole_top, box, fill, dark, stripe):
    d.line([pole_bottom, pole_top], fill=INK, width=4)
    d.line([pole_bottom, pole_top], fill=WOOD, width=2)
    d.rectangle(box, fill=fill, outline=INK)
    x0, y0, x1, y1 = box
    d.rectangle((x0 + 1, y1 - 2, x1 - 1, y1 - 1), fill=dark)
    stripe(x0, y0, x1, y1)


def noren(x0, y0, x1, y1):
    # Noren slits: two pale cuts from the bottom edge.
    for x in (x0 + (x1 - x0) // 3, x0 + 2 * (x1 - x0) // 3):
        d.line([(x, y0 + 7), (x, y1)], fill=INK)
    d.ellipse((x0 + 7, y0 + 2, x0 + 13, y0 + 6), fill=WHITE)


def wave(x0, y0, x1, y1):
    for i, y in enumerate((y0 + 5, y0 + 10)):
        for x in range(x0 + 2, x1 - 1, 6):
            d.arc((x, y - 2, x + 6, y + 4), 180, 360, fill=WHITE)


flag((53, 76), (26, 14), (4, 12, 26, 32), RED, RED_DARK, noren)
flag((108, 62), (118, 8), (96, 6, 117, 26), BLUE, BLUE_DARK, wave)

im.save(OUT)
print(OUT)
