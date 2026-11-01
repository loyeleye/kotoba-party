# Read the Signs: makes the station-sign art from three raw PixelLab pixflux drawings (manifest entries
# stage/assets/signs/*; raws in tools/art/sources/signs/). Whole pixels only, nearest-neighbour upscale.
#   board-raw.png  -> sign-board{,-exit,-men,-women}.png: the casing cropped, the two middle rivets taken out so
#                     the edges can stretch (CSS nine-slices it, 14 art px per side), the face recoloured per kind
#                     with its own shading kept (dark navy, exit yellow, men's blue, women's red), x3.
#   arrow-raw.png  -> sign-arrow.png: the white fill only (no outline), turned to point left, x4. CSS uses it as a
#                     mask, so the arrow takes the sign's text colour.
#   hanger-raw.png -> sign-hanger.png: the rod and its bottom bracket, x3.
# Usage: python3 tools/art/sources/signs.py
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'tools/art/sources/signs'
OUT = ROOT / 'stage/assets/signs'
OUT.mkdir(parents=True, exist_ok=True)


def up(im, n):
    return im.resize((im.width * n, im.height * n), Image.NEAREST)


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


# ---- board ----
raw = Image.open(SRC / 'board-raw.png').convert('RGBA')
board = raw.crop(raw.getchannel('A').getbbox())  # 86x40, casing to casing
W, H = board.size
MAIN = (36, 57, 90)       # the face's flat colour
OUTLINE = lum((17, 19, 46)) + 1
RIVET = (192, 212, 245)
px = board.load()
# The face is everything inside the dark outline ring (x 4..W-5, y 3..H-5 on the crop).
FACE = (4, 3, W - 4, H - 4)


def in_face(x, y):
    return FACE[0] <= x < FACE[2] and FACE[1] <= y < FACE[3]


# The rivets halfway down each side would smear when the edge stretches: paint them as face.
for x, y in [(5, 19), (W - 6, 19)]:
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            px[x + dx, y + dy] = MAIN + (255,)

KINDS = {'': None, '-exit': (255, 210, 63), '-men': (47, 111, 214), '-women': (214, 58, 79)}
for suffix, base in KINDS.items():
    im = board.copy()
    p = im.load()
    if base:
        for y in range(H):
            for x in range(W):
                c = p[x, y]
                if not in_face(x, y) or c[3] == 0 or c[:3] == RIVET or lum(c) < OUTLINE:
                    continue
                k = lum(c) / lum(MAIN)
                p[x, y] = tuple(max(0, min(255, round(v * k))) for v in base) + (255,)
    up(im, 3).save(OUT / f'sign-board{suffix}.png', optimize=True)

# ---- arrow ----
raw = Image.open(SRC / 'arrow-raw.png').convert('RGBA')
mask = Image.new('RGBA', raw.size)
for y in range(raw.height):
    for x in range(raw.width):
        c = raw.getpixel((x, y))
        if c[3] and sum(c[:3]) > 600:
            mask.putpixel((x, y), (255, 255, 255, 255))
mask = mask.crop(mask.getchannel('A').getbbox()).rotate(90, expand=True)  # it points up; turn it left
up(mask, 4).save(OUT / 'sign-arrow.png', optimize=True)

# ---- hanger ----
raw = Image.open(SRC / 'hanger-raw.png').convert('RGBA')
hanger = raw.crop((0, 14, raw.width, raw.height))
hanger = hanger.crop(hanger.getchannel('A').getbbox())
up(hanger, 3).save(OUT / 'sign-hanger.png', optimize=True)

for f in sorted(OUT.glob('*.png')):
    w, h = Image.open(f).size
    print(f'{f.relative_to(ROOT)}: {w}x{h}')
