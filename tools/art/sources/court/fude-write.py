"""Makes stage/assets/court/fude-write.png: Fude-san upside down, writing the verdict with her own hair.

Fude-san is a brush tsukumogami, so on Yōkai Court's verdict scroll she writes 有罪 or 無罪 herself, not with a
separate brush (story-craft and humour seats, 1 Nov 2026). This takes frame 3 of her shipped think sheet
(stage/assets/anim/fude-think.png, eyes squeezed shut in concentration), turns it 180 degrees so her black
topknot is the brush tip, and crops it to the opaque pixels. A 180-degree turn moves whole pixels, so the
art stays on its grid. No generator: it is our own PixelLab portrait, edited.

Run: python3 tools/art/sources/court/fude-write.py
"""
from PIL import Image

SHEET = 'stage/assets/anim/fude-think.png'
OUT = 'stage/assets/court/fude-write.png'
FRAME = 3

sheet = Image.open(SHEET).convert('RGBA')
h = sheet.height
frame = sheet.crop((FRAME * h, 0, FRAME * h + h, h)).rotate(180)
frame = frame.crop(frame.getbbox())
frame.save(OUT)
print(OUT, frame.size)
