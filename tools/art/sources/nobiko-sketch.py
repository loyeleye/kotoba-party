# Builds tools/art/sources/nobiko-sketch.png, the layout sketch PixelLab pixflux redraws into Nobiko-san
# (see docs/graphics.md). Usage: python3 nobiko-sketch.py nobiko-body.png nobiko-sketch.png
import sys
from PIL import Image, ImageDraw
src = Image.open(sys.argv[1]).convert('RGBA')
W = 128
head = Image.new('RGBA', (W, W)); body = Image.new('RGBA', (W, W))
for y in range(W):
    for x in range(W):
        p = src.getpixel((x, y))
        if p[3] == 0: continue
        fan = x >= 86 and y >= 60
        (head if (y < 76 and not fan) else body).putpixel((x, y), p)
hs, bs = 0.66, 0.9
hb = head.crop(head.getbbox()); hb = hb.resize((round(hb.width*hs), round(hb.height*hs)), Image.NEAREST)
bb = body.crop(body.getbbox()); bb = bb.resize((round(bb.width*bs), round(bb.height*bs)), Image.NEAREST)
out = Image.new('RGBA', (W, W))
bx, by = (W - bb.width)//2 + 2, W - bb.height - 2
hx, hy = 64 - hb.width//2 + 6, 1
# neck: an S-curve from the collar up to the chin
collar = (bx + round(40*bs), by + 14)
chin = (hx + hb.width//2, hy + hb.height - 6)
pts = []
for i in range(41):
    t = i/40
    # cubic bezier with a bulge to the left
    c1 = (collar[0]-22, collar[1]-26); c2 = (chin[0]+14, chin[1]+14)
    x = (1-t)**3*collar[0] + 3*(1-t)**2*t*c1[0] + 3*(1-t)*t**2*c2[0] + t**3*chin[0]
    y = (1-t)**3*collar[1] + 3*(1-t)**2*t*c1[1] + 3*(1-t)*t**2*c2[1] + t**3*chin[1]
    pts.append((x, y))
d = ImageDraw.Draw(out)
d.line(pts, fill=(20, 12, 24, 255), width=12, joint='curve')
d.line(pts, fill=(253, 225, 193, 255), width=7, joint='curve')
# shade stripe on the right side of the neck
d.line([(x+2, y) for x, y in pts], fill=(236, 196, 160, 255), width=2)
out.alpha_composite(bb, (bx, by))
out.alpha_composite(hb, (hx, hy))
out.save(sys.argv[2])
# drop stray specks: opaque islands under 30 px
out = Image.open(sys.argv[2]); px = out.load(); seen = set()
for y0 in range(W):
    for x0 in range(W):
        if px[x0, y0][3] == 0 or (x0, y0) in seen: continue
        comp, stack = [], [(x0, y0)]; seen.add((x0, y0))
        while stack:
            x, y = stack.pop(); comp.append((x, y))
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < W and 0 <= ny < W and (nx, ny) not in seen and px[nx, ny][3]:
                    seen.add((nx, ny)); stack.append((nx, ny))
        if len(comp) < 30:
            for p in comp: px[p] = (0, 0, 0, 0)
out.save(sys.argv[2])
# the fan hand's knuckles were cut loose from the hand when the body was scaled; clear them
out = Image.open(sys.argv[2])
for y in range(70, 80):
    for x in range(76, 85):
        if x < 83 or y < 77: out.putpixel((x, y), (0, 0, 0, 0))
out.save(sys.argv[2])
