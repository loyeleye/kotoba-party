# Draws the two Bento Haus foods PixelLab never got right (nori came out on a tray or on fire, the
# umeboshi as a tomato or a cherry): 64x64, transparent, a one-pixel near-black outline and simple
# shading, to sit with the pixflux food icons.
#
#   python3 tools/art/sources/bento-food.py
import math
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[3] / 'stage' / 'assets' / 'bento' / 'food'
INK = (16, 10, 14, 255)


def outline(img: Image.Image) -> Image.Image:
    """A one-pixel outline around every opaque pixel."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                dst[x, y] = INK
    return out


def nori() -> Image.Image:
    # A sheet of nori, tilted a little, with the faint grain and a lighter top edge.
    img = Image.new('RGBA', (64, 64))
    px = img.load()
    rnd = random.Random(4)
    ang = math.radians(-12)
    cx, cy, half = 32, 33, 19
    for y in range(64):
        for x in range(64):
            u = (x - cx) * math.cos(ang) + (y - cy) * math.sin(ang)
            v = -(x - cx) * math.sin(ang) + (y - cy) * math.cos(ang)
            if abs(u) <= half and abs(v) <= half:
                shade = 0
                if v < -half + 3:
                    shade = 2
                elif u > half - 3 or v > half - 3:
                    shade = -1
                elif rnd.random() < 0.09:
                    shade = 1
                base = {-1: (18, 34, 24), 0: (30, 52, 36), 1: (44, 70, 48), 2: (62, 92, 62)}[shade]
                px[x, y] = (*base, 255)
    return outline(img)


def umeboshi() -> Image.Image:
    # A soft, wrinkled red plum: a slightly squashed circle, darker creases, one highlight.
    img = Image.new('RGBA', (64, 64))
    px = img.load()
    cx, cy, rx, ry = 32, 35, 18, 16
    for y in range(64):
        for x in range(64):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = dx * dx + dy * dy
            if d > 1:
                continue
            # Creases: folds running in from the edge, like a dried plum's, plus darker lower side.
            ang = math.atan2(dy, dx)
            fold = math.sin(ang * 7 + math.sqrt(d) * 3.0)
            col = (186, 30, 52)
            if d > 0.25 and fold > 0.82:
                col = (122, 16, 38)
            elif d > 0.2 and fold > 0.55:
                col = (150, 22, 44)
            if d > 0.8 and dy > -0.1:
                col = (110, 14, 34)
            if (x - (cx - 7)) ** 2 + (y - (cy - 7)) ** 2 < 10:
                col = (248, 132, 140)
            px[x, y] = (*col, 255)
    return outline(img)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    nori().save(OUT / 'nori.png')
    umeboshi().save(OUT / 'umeboshi.png')
    print('wrote', OUT / 'nori.png', OUT / 'umeboshi.png')
