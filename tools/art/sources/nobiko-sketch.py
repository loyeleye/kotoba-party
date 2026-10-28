# Builds tools/art/sources/nobiko-sketch.png, the layout sketch PixelLab pixflux redraws into Nobiko-san
# (see docs/graphics.md). Usage: python3 nobiko-sketch.py nobiko-body.png nobiko-sketch.png
#
# nobiko-body.png is a text-only pixflux auntie (big head, normal neck). The sketch cuts her into head and
# body, shrinks both, leans the head up and to the right (towards the speech bubble, eavesdropping) and joins
# them with a hand-drawn S-curved neck, leaving a few rows clear above the bun.
import sys
from PIL import Image, ImageDraw
W = 128
SKIN, SHADE, INK = (253, 224, 187, 255), (232, 190, 150, 255), (19, 4, 30, 255)
src = Image.open(sys.argv[1]).convert('RGBA')
head = Image.new('RGBA', (W, W)); body = Image.new('RGBA', (W, W))
for y in range(W):
    for x in range(W):
        p = src.getpixel((x, y))
        if p[3]:
            (head if y <= 73 and not (x < 35 and y >= 55) else body).putpixel((x, y), p)  # the fan (lower left) stays with the body
def shrink(im, k):
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)
HK, BK = 0.9, 0.75
box = body.getbbox()
hb, bb = shrink(head, HK), shrink(body, BK)
out = Image.new('RGBA', (W, W))
bx, by = 8, W - bb.height - 2
hx, hy = min(W - hb.width - 2, 78 - hb.width // 2), 4
collar = (bx + round((63 - box[0]) * BK), by + round((80 - box[1]) * BK))  # the kimono collar: x 63, y 80 in the source
chin = (hx + hb.width // 2 - 2, hy + hb.height - 4)
c1, c2 = (collar[0] - 10, collar[1] - 22), (chin[0] - 14, chin[1] + 12)
pts = []
for i in range(41):
    t = i / 40
    pts.append(tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(collar, c1, c2, chin)))
d = ImageDraw.Draw(out)
d.line(pts, fill=INK, width=12, joint='curve')
d.line(pts, fill=SKIN, width=8, joint='curve')
d.line([(x + 2, y + 1) for x, y in pts], fill=SHADE, width=2)
out.alpha_composite(bb, (bx, by))
out.alpha_composite(hb, (hx, hy))
out.save(sys.argv[2])
