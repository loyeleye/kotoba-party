# Builds stage/assets/anim/nobiko-peek.png, Nobiko-san's nosy peek: her neck stretches out to the right
# (over the speech bubble, towards the answers), holds for a look, and springs back.
# Usage: python3 tools/art/sources/nobiko-peek.py stage/assets/hosts/nobiko.png stage/assets/anim/nobiko-peek.png
#
# Unlike the other sheets this one isn't PixelLab: it cuts her portrait into head and body, keeps both exactly
# as drawn, and redraws only the neck between them, so the head stays on model in every frame. Frames are
# 256x128 (twice as wide as the portrait), with the body where the portrait has it; stage/src/sprites.ts
# shows the sheet in a box twice as wide that overhangs the bubble.
import sys
from PIL import Image
W, H = 256, 128
SKIN, SHADE, INK = (251, 222, 190, 255), (155, 98, 94, 255), (11, 6, 5, 255)
src = Image.open(sys.argv[1]).convert('RGBA')
head = Image.new('RGBA', (128, 128)); body = Image.new('RGBA', (128, 128))
for y in range(128):
    for x in range(128):
        p = src.getpixel((x, y))
        if not p[3]: continue
        if y <= 64 or (y <= 72 and (x < 56 or x > 78)): head.putpixel((x, y), p)  # face, bun and the hair below the chin
        elif y >= 84 or x < 26: body.putpixel((x, y), p)  # kimono, hands and the fan; the neck between is redrawn
BASE, CHIN = (42, 88), (67, 63)
EYES = [(53, 45, 65, 51), (75, 45, 89, 51)]  # her eyes in the portrait: x0, y0, x1, y1 (exclusive)
SKINS = {SKIN[:3], (250, 154, 182)}  # skin and blush

def glance(im, k):
    """Her eyes look k pixels to the right: in each row the iris and its highlights slide over inside the
    eye's outline, and white sclera fills in behind. Ink within two pixels of skin is the (two-pixel) outline and stays put."""
    out = im.copy()
    for x0, y0, x1, y1 in EYES:
        def skin(x, y): return im.getpixel((x, y))[:3] in SKINS
        def inside(x, y):
            if skin(x, y): return False
            if sum(im.getpixel((x, y))[:3]) < 60:  # ink: outline if it touches skin
                return not any(skin(x + a, y + b) for a, b in ((1, 0), (2, 0), (-1, 0), (-2, 0), (0, 1), (0, -1)))
            return True
        for y in range(y0, y1):
            xs = [x for x in range(x0, x1) if inside(x, y)]
            for x in xs:
                out.putpixel((x, y), im.getpixel((x - k, y)) if x - k in xs else (250, 249, 249, 255))
    return out

# (head offset x, y) per frame: out, a look, a second lean in, then a spring back to the idle pose.
OFFSETS = [(0, 0), (20, -1), (48, -2), (80, -2), (100, -1), (100, 0), (104, -1), (100, 0), (56, -1), (24, 0)]

def bezier(p0, p1, p2, p3, n):
    for i in range(n + 1):
        t = i / n; u = 1 - t
        yield (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
               u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])

def disc(im, cx, cy, r, colour):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if 0 <= x < im.width and 0 <= y < im.height and (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                im.putpixel((x, y), colour)

sheet = Image.new('RGBA', (W * len(OFFSETS), H))
for i, (dx, dy) in enumerate(OFFSETS):
    f = Image.new('RGBA', (W, H))
    if (dx, dy) == (0, 0):  # at rest she is the portrait itself, so the sheet starts on the idle pose
        f.alpha_composite(src)
        sheet.alpha_composite(f, (i * W, 0))
        continue
    chin = (CHIN[0] + dx, CHIN[1] + dy)
    # Up out of the collar, then a long S out to the chin; the dip sags lower the further she reaches.
    sag = min(14, dx / 6)
    pts = list(bezier(BASE, (BASE[0] + 2, BASE[1] - 22), (chin[0] - 12 - dx / 3, chin[1] + 10 + sag), chin, 80))
    neck = Image.new('RGBA', (W, H))
    for x, y in pts: disc(neck, x, y, 6.2, INK)
    for x, y in pts: disc(neck, x, y, 5.2, SHADE)
    for x, y in pts: disc(neck, x - 0.4, y - 0.9, 4.2, SKIN)
    f.alpha_composite(neck)
    f.alpha_composite(body)  # over the neck, so it disappears into the collar
    f.alpha_composite(glance(head, 1 if dx < 40 else 2), (dx, dy))  # she looks where she's going
    sheet.alpha_composite(f, (i * W, 0))
sheet.save(sys.argv[2])
