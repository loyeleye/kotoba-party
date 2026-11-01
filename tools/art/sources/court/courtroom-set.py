"""Yōkai Court's set: crops the PixelLab draft to the stage.

    python3 tools/art/sources/court/courtroom-set.py tools/art/sources/court/courtroom-draft.png

The draft is PixelLab pixflux, seed 3 (prompt in stage/assets/manifest.json, "yokai-court"), picked from 8.
pixflux letterboxes a 320x180 request, so it is drawn at 320x224; its picture is rows 12-211, and rows 26-205
are kept (a little ceiling above the two ghost fires, and the floor in front of the counsel desks).
"""
import sys
from PIL import Image

TOP = 26
Image.open(sys.argv[1]).convert('RGB').crop((0, TOP, 320, TOP + 180)).save('stage/assets/scenes/yokai-court.png', optimize=True)
