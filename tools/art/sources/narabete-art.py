# Builds Narabete!'s two hand-drawn sprites, in Nobiko-san's neck colours and outline:
#   stage/assets/anim/nobiko-knot.png  a knot tied in her neck, 3 frames of 72x50: a loose loop, cinching, then
#                                      tied tight with a cramp mark (💢). Its tails run level along y = 8 and the loop hangs
#                                      below, clear of the cards above the neck; it sits over the ruler's neck
#                                      (stage/src/neck.ts, drawRuler) with no seam.
#   stage/assets/fx/peg.png            a wooden clothes peg, 10x17, pinning a card's string to the neck (dark wood, so
#                                      it stands out from her skin).
# Usage: python3 tools/art/sources/narabete-art.py stage/assets/anim/nobiko-knot.png stage/assets/fx/peg.png
#
# Drawn here rather than by PixelLab, like nobiko-peek.py, so the knot is her neck exactly: the same three passes
# (outline, shade, skin set a pixel up) at the same thickness.
import math, sys
from PIL import Image
SKIN, SHADE, INK = (251, 222, 190, 255), (155, 98, 94, 255), (11, 6, 5, 255)
CRAMP = (255, 64, 72, 255)
W, H = 72, 50
LINE = 8

def disc(im, cx, cy, r, c):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if 0 <= x < im.width and 0 <= y < im.height and (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r:
                im.putpixel((x, y), c)

def bez(p0, p1, p2, p3, n=40):
    return [tuple(u**3*a + 3*u*u*t*b + 3*u*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
            for t, u in ((i / n, 1 - i / n) for i in range(n + 1))]

def snap(pts):
    return [(round(x), round(y)) for x, y in pts]

def strand(im, pts, ink=True, skin=SKIN):
    """Her neck along `pts`, as the stage paints it (stage/src/neck.ts, paintNeck): points on whole pixels, skin a pixel up."""
    pts = snap(pts)
    if ink:
        for x, y in pts: disc(im, x, y, 6.2, INK)
    for x, y in pts: disc(im, x, y, 5.2, SHADE)
    for x, y in pts: disc(im, x, y - 1, 4.2, skin)

def margin(pts, px):
    """How many points along `pts` it takes to cover `px` pixels."""
    d = 0
    for k in range(1, len(pts)):
        d += math.dist(pts[k], pts[k - 1])
        if d >= px: return k
    return len(pts) // 2

def knot(kx, ky, node):
    """The neck dips off the line into a loop (a nodal cubic, x = u(u²-1), y = 1-u²) that crosses itself `node`
    px below the line, then eases back up. The outgoing pass crosses over the incoming one."""
    f = Image.new('RGBA', (W, H))
    cx, ny, U = W / 2, LINE + node, 1.16
    loop = [(cx + kx * u * (u * u - 1), ny - ky * (u * u - 1)) for u in (-U + 2 * U * i / 300 for i in range(301))]
    (ax, ay), (bx, by) = loop[0], loop[-1]
    left = bez((-3, LINE), (ax - 14, LINE), (ax - 5, ay - 6), (ax, ay))
    right = bez((bx, by), (bx + 5, by - 6), (bx + 14, LINE), (W + 3, LINE))
    strand(f, left + loop + right)
    # Redraw the outgoing pass from just before the crossing (u = 1) to the line, on top. Its outline stops short of
    # both ends and its shade short of the last one, so no cap shows where it rejoins the tube.
    over = loop[int(len(loop) * 0.84):] + right[:24]
    m = margin(over, 8)
    strand(f, over[m:-m])
    for x, y in snap(over[:-m]): disc(f, x, y, 5.2, SHADE)
    for x, y in snap(over): disc(f, x, y - 1, 4.2, SKIN)
    return f

# Tied, a cramp mark (the manga 💢) pops beside it: four red corners round a cross-shaped gap, outlined in ink, 13x13.
frames = [knot(34, 26, 10), knot(30, 21, 8), knot(25, 15, 6)]
CRAMP_MARK = [
    ".KKKK...KKKK.",
    "KRRRRK.KRRRRK",
    "KRRRRK.KRRRRK",
    "KRRKKK.KKKRRK",
    "KRRK.....KRRK",
    ".KKK.....KKK.",
    ".............",
    ".KKK.....KKK.",
    "KRRK.....KRRK",
    "KRRKKK.KKKRRK",
    "KRRRRK.KRRRRK",
    "KRRRRK.KRRRRK",
    ".KKKK...KKKK.",
]
for y, row in enumerate(CRAMP_MARK):
    for x, ch in enumerate(row):
        if ch != '.': frames[2].putpixel((53 + x, 24 + y), INK if ch == 'K' else CRAMP)
sheet = Image.new('RGBA', (W * len(frames), H))
for i, f in enumerate(frames): sheet.alpha_composite(f, (i * W, 0))
sheet.save(sys.argv[1])

# K ink, L/W/D light, mid and dark wood, S/s the steel spring and its shade.
PEG = [
    "..KKKKKK..",
    ".KLLWKLWK.",
    ".KLWWKLWK.",
    ".KLWWKLWK.",
    ".KLWWKLWK.",
    "KKKKKKKKKK",
    "KSSSSSSSsK",
    "KssssssssK",
    "KKKKKKKKKK",
    ".KLWDKLWK.",
    ".KLWDKLWK.",
    ".KLWDKLWK.",
    ".KLWDKWDK.",
    "..KWDKWDK.",
    "..KWDKWK..",
    "..KWDKWK..",
    "...KKKK...",
]
C = {'K': INK, 'W': (150, 84, 38, 255), 'L': (196, 120, 60, 255), 'D': (98, 52, 24, 255),
     'S': (200, 208, 222, 255), 's': (120, 128, 150, 255)}
peg = Image.new('RGBA', (len(PEG[0]), len(PEG)))
for y, row in enumerate(PEG):
    for x, ch in enumerate(row):
        if ch in C: peg.putpixel((x, y), C[ch])
peg.save(sys.argv[2])
