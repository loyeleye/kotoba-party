"""Hand touch-up for stage/assets/bento/vs/pon-flags.png after pixflux.

pixflux drew the red flag's mark as a plain block; this repaints the flag as a noren (three cloth
panels split by two slits), to match the red team crest. Run once on a fresh generation:

    python3 tools/art/sources/pon-flags-touchup.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / 'stage/assets/bento/vs/pon-flags.png'

RED = (208, 67, 54, 255)
SHADE = (167, 53, 43, 255)
DARK = (142, 32, 32, 255)
INK = (31, 15, 16, 255)
ROD = (196, 140, 80, 255)

im = Image.open(PATH).convert('RGBA')
px = im.load()
X0, X1, Y0, Y1 = 6, 26, 13, 31  # inside the flag's black outline
for y in range(Y0, Y1 + 1):
    for x in range(X0, X1 + 1):
        px[x, y] = DARK if y >= Y1 - 2 else SHADE if x in (X0, X1) else RED
for x in range(X0, X1 + 1):
    px[x, Y0] = ROD  # the rod the noren hangs from
    px[x, Y0 + 1] = INK
for slit in (X0 + 7, X0 + 14):
    for y in range(Y0 + 6, Y1 + 1):
        px[slit, y] = INK
im.save(PATH)
print(PATH)
