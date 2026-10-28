# Builds Nice to Meet You!'s lie tanuki: stage/assets/fx/tanuki-doron.png, 64x64.
# A tanuki in disguise has just turned back (ドロン！): Pon's own head from his idle sheet, with the leaf on top that
# tanuki use to change shape. Cut from Pon's frame rather than drawn fresh, so it is his pixels, outline and palette
# exactly; the card shows it at 56px with the writer's seat colour behind it.
# Usage: python3 tools/art/sources/tanuki-doron.py stage/assets/anim/pon-idle.png stage/assets/fx/tanuki-doron.png
import sys
from PIL import Image

INK = (40, 20, 10, 255)
LEAF, LEAF_LIGHT, LEAF_DARK = (92, 168, 60, 255), (150, 210, 96, 255), (40, 96, 34, 255)
SIZE = 64
HEAD = (36, 14, 92, 55)  # Pon's head in frame 0 of the idle sheet, ears to chin (the bow tie starts below)

def leaf(im, ox, oy):
    """A leaf tilted to the right, stalk at the bottom left: ink outline, light upper half, dark midrib."""
    rows = [  # x ranges of the leaf body per row, before the outline
        (6, 8), (5, 9), (4, 10), (3, 11), (3, 11), (2, 11), (2, 10), (2, 10), (3, 9), (3, 8), (4, 7),
    ]
    body = set()
    for y, (a, b) in enumerate(rows):
        for x in range(a, b + 1):
            body.add((x, y))
    for x, y in body:  # outline: every empty neighbour of the body
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (x + dx, y + dy)
            if p not in body:
                im.putpixel((ox + p[0], oy + p[1]), INK)
    for x, y in body:
        im.putpixel((ox + x, oy + y), LEAF_LIGHT if x + y < 11 else LEAF)
    for t in range(1, 10):  # midrib from the tip down to the stalk
        im.putpixel((ox + 8 - t * 5 // 9, oy + t), LEAF_DARK)
    for t in range(3):  # stalk
        im.putpixel((ox + 3 - t, oy + 11 + t), INK)

def main(src, out):
    head = Image.open(src).convert('RGBA').crop(HEAD)
    w, h = head.size
    # The crop cuts through the neck: close it with the outline where the bottom row is opaque.
    for x in range(w):
        if head.getpixel((x, h - 1))[3] > 128:
            head.putpixel((x, h - 1), INK)
    im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    hx, hy = (SIZE - w) // 2, SIZE - h - 1
    im.alpha_composite(head, (hx, hy))
    leaf(im, hx + 20, hy - 6)  # on the crown, between the ears
    im.save(out)

if __name__ == '__main__':
    main(*sys.argv[1:3])
