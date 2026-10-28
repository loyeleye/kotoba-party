# Centres each Narabete! card picture (stage/assets/cards/*.png, 64² PixelLab pixflux) on its own drawing: pixflux
# often leaves the object off to one side, which looks crooked in a row of cards. Moves pixels only, whole pixels.
# Usage: python3 tools/art/sources/center-cards.py stage/assets/cards/*.png
import sys
from PIL import Image
for path in sys.argv[1:]:
    im = Image.open(path).convert('RGBA')
    box = im.getchannel('A').getbbox()
    if not box: continue
    x0, y0, x1, y1 = box
    dx = (im.width - (x1 - x0)) // 2 - x0
    dy = (im.height - (y1 - y0)) // 2 - y0
    if dx or dy:
        out = Image.new('RGBA', im.size)
        out.alpha_composite(im.crop(box), (x0 + dx, y0 + dy))
        out.save(path)
        print(f'{path}: moved {dx:+d}, {dy:+d}')
