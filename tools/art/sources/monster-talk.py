# Builds Dub Club's monster lip sync: stage/assets/dub/char-monster-talk.png, 384x128 (closed, half, open).
# The monster is drawn roaring, mouth wide, so frame 2 is the still itself. Frames 0 and 1 close the jaw: in
# each column the mouth (teeth, tongue, throat) is squeezed toward its middle, keeping the top teeth above and
# the bottom teeth below, and the rest is painted over with the body colour and an ink lip line. Closed keeps
# four rows (clenched fangs, it's a monster); half keeps half the opening. No model: its own pixels and palette.
# Usage: python3 tools/art/sources/monster-talk.py stage/assets/dub/char-monster.png stage/assets/dub/char-monster-talk.png
import sys
from PIL import Image

MOUTH = {(232, 105, 104, 255), (6, 3, 3, 255), (70, 21, 32, 255), (12, 6, 6, 255), (247, 229, 159, 255), (142, 123, 96, 255), (245, 245, 245, 255)}
BODY, INK = (56, 35, 73, 255), (6, 8, 32, 255)
BOX = (30, 44, 100, 86)  # x0, y0, x1, y1 around the open mouth


def squeeze(src, keep):
    im = src.copy()
    px, sp = im.load(), src.load()
    for x in range(BOX[0], BOX[2]):
        rows = [y for y in range(BOX[1], BOX[3]) if sp[x, y] in MOUTH]
        if not rows:
            continue
        top, bot = min(rows), max(rows)
        h = bot - top + 1
        n = keep(h)
        if n >= h:
            continue
        nt = round((top + bot) / 2 - n / 2)
        nb = nt + n - 1
        for y in rows:
            px[x, y] = BODY
        for i in range(n // 2):
            px[x, nt + i] = sp[x, top + i]
        for i in range(n - n // 2):
            px[x, nb - i] = sp[x, bot - i]
        if nt - 1 >= top:
            px[x, nt - 1] = INK
        if nb + 1 <= bot:
            px[x, nb + 1] = INK
    return im


src = Image.open(sys.argv[1]).convert('RGBA')
w = src.width
sheet = Image.new('RGBA', (w * 3, src.height))
sheet.paste(squeeze(src, lambda h: min(h, 4)), (0, 0))
sheet.paste(squeeze(src, lambda h: max(4, h // 2)), (w, 0))
sheet.paste(src, (2 * w, 0))
sheet.save(sys.argv[2])
