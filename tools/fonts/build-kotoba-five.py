"""Builds stage/assets/fonts/kotoba-five-{500,700}.woff2: Pixelify Sans's digit 5, redrawn.

Pixelify's 5 has a rounded top-left corner and a curl at the top right, so from the couch it reads
as S or 8 (art panel, 27 Oct 2026). This takes the Pixelify Sans variable font (OFL 1.1, no reserved
name), pins it at the two weights the pages use, swaps in a 5 with a square flag top and an open,
hookless bowl, keeps only U+0035 and renames the result "Kotoba Five". The CSS lists Kotoba Five
ahead of Pixelify Sans with unicode-range U+35, so every other character still comes from Pixelify.

Run: pip install fonttools brotli && python3 tools/fonts/build-kotoba-five.py
"""
import io
import urllib.request

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Pixelify Sans v3, Latin subset, as Google Fonts serves it (the same file the pages load).
SOURCE = 'https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9Jn0Eiw.woff2'
OUT = 'stage/assets/fonts'

# Stroke edges at each weight, read off Pixelify's own 'eight' and 'six' so the new 5 sits on the
# same grid: L/R are the outer, notch and inner x edges; y runs bottom, bottom notch, bottom stroke's
# top, middle stroke's bottom, right notch, middle stroke's top, top stroke's bottom, top.
GRID = {
    500: dict(L0=60.33, L1=150.33, Li=170.0, R1=439.67, R0=530.67, Ri=420.0,
              y0=-11.67, y1=76.67, yB=100.33, yMb=255.33, yN=279.0, yMt=366.33, yTb=520.33, yT=633.33),
    700: dict(L0=61, L1=149, Li=188, R1=453, R0=542, Ri=414,
              y0=-11, y1=74, yB=125, yMb=246, yN=297, yMt=381, yTb=501, yT=638),
}


def five(g):
    """One clockwise contour: flat full-width top, left stem, middle bar, bowl, bottom bar."""
    pts = [
        (g['L1'], g['y0']), (g['L1'], g['y1']), (g['L0'], g['y1']), (g['L0'], g['yB']),
        (g['Ri'], g['yB']), (g['Ri'], g['yMb']), (g['L0'], g['yMb']),
        (g['L0'], g['yT']), (g['R0'], g['yT']), (g['R0'], g['yTb']),
        (g['Li'], g['yTb']), (g['Li'], g['yMt']), (g['R1'], g['yMt']),
        (g['R1'], g['yN']), (g['R0'], g['yN']), (g['R0'], g['y1']),
        (g['R1'], g['y1']), (g['R1'], g['y0']),
    ]
    pen = TTGlyphPen(None)
    pen.moveTo((round(pts[0][0]), round(pts[0][1])))
    for x, y in pts[1:]:
        pen.lineTo((round(x), round(y)))
    pen.closePath()
    return pen.glyph()


def build(data, weight):
    font = instancer.instantiateVariableFont(TTFont(io.BytesIO(data)), {'wght': weight})
    glyf = font['glyf']
    glyf['five'] = five(GRID[weight])
    glyf['five'].recalcBounds(glyf)
    font['hmtx']['five'] = (font['hmtx']['five'][0], glyf['five'].xMin)

    opts = subset.Options()
    opts.name_IDs = ['*']
    opts.layout_features = []
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[0x35])
    sub.subset(font)

    family, style = 'Kotoba Five', 'Bold' if weight == 700 else 'Medium'
    name = font['name']
    for nid in (1, 2, 3, 4, 6, 16, 17, 25):
        name.removeNames(nameID=nid)
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(style, 2, 3, 1, 0x409)
    name.setName(f'{family}; {style}; Pixelify Sans 1.000 with a redrawn 5', 3, 3, 1, 0x409)
    name.setName(f'{family} {style}', 4, 3, 1, 0x409)
    name.setName(f'KotobaFive-{style}', 6, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight
    font.flavor = 'woff2'
    font.save(f'{OUT}/kotoba-five-{weight}.woff2')


if __name__ == '__main__':
    data = urllib.request.urlopen(SOURCE).read()
    for w in GRID:
        build(data, w)
        print(f'{OUT}/kotoba-five-{w}.woff2')
