"""Builds stage/assets/fonts/kotoba-pixel-{500,700}.woff2: Pixelify Sans's 5, C and B, redrawn.

From the couch, Pixelify's 5 reads as S or 8: it has a rounded top-left corner and a curl at the top
right (art panel, 27 Oct 2026). Its C is an O with a notch one pixel tall in the right side (65 units
of a 645-unit height at weight 500, 34 at 700), so "Yokai Court" read "Yokai Oourt" (Yokai Court
panel, 1 Nov 2026). Its bold B is a G with a notch: rounded left corners, and a middle bar that hangs
off the right side instead of the stem, so "Bento Haus" read "Gento Haus" (same check).

This takes the Pixelify Sans variable font (OFL 1.1, no reserved name), pins it at the two weights
the pages use, swaps in a 5 with a square flag top and an open, hookless bowl, a C whose mouth is
cut back to the same depth as Pixelify's own lowercase c, and a B with a square stem and two closed
bowls (built like Pixelify's own D). It keeps only U+0035, U+0042 and U+0043 and renames the result
"Kotoba Pixel". The CSS lists Kotoba Pixel ahead of Pixelify Sans with unicode-range U+35, U+42-43,
so every other character still comes from Pixelify.

Run: pip install fonttools brotli && python3 tools/fonts/build-kotoba-pixel.py
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


# The C's mouth: the top arm's terminal stops at yTt and the bottom arm's starts at yBt. Both sit one
# stroke (about 90 units) in from the inner counter, which is where Pixelify's lowercase c puts its
# own terminals (190/255 at 500, 211/246 at 700), so the capital matches the small letter.
MOUTH = {500: dict(yTt=431, yBt=190), 700: dict(yTt=416, yBt=211)}


def cee(glyphset, weight):
    """Pixelify's own C with its mouth widened: the right-side stubs are cut back to the terminals."""
    from fontTools.pens.recordingPen import RecordingPen
    rec = RecordingPen()
    glyphset['C'].draw(rec)
    pts = [a[0] for op, a in rec.value if op in ('moveTo', 'lineTo')]
    # Pixelify's C is one contour; the four points at the right of the mouth come in order: outer
    # top-arm end, inner top-arm end, inner bottom-arm end, outer bottom-arm end.
    mouth = [i for i, (x, y) in enumerate(pts) if x > 300 and 200 < y < 400]
    assert len(mouth) == 4, mouth
    m = MOUTH[weight]
    for k, i in enumerate(mouth):
        x, _ = pts[i]
        pts[i] = (x, m['yTt'] if k < 2 else m['yBt'])
    pen = TTGlyphPen(None)
    pen.moveTo((round(pts[0][0]), round(pts[0][1])))
    for x, y in pts[1:]:
        pen.lineTo((round(x), round(y)))
    pen.closePath()
    return pen.glyph()


def contours(glyphset, name):
    from fontTools.pens.recordingPen import RecordingPen
    rec = RecordingPen()
    glyphset[name].draw(rec)
    out = []
    for op, a in rec.value:
        if op == 'moveTo':
            out.append([a[0]])
        elif op == 'lineTo':
            out[-1].append(a[0])
    return out


def bee(glyphset):
    """Pixelify's B with a square stem and the middle bar joined to it: two closed bowls, like its D."""
    outer, inner = contours(glyphset, 'B')
    # Outer: Pixelify rounds the left corners with six points (bottom step, stem, top step); a square
    # stem needs only its two corners. The right side (both bowls and the waist notch) is kept.
    xs = [x for x, _ in outer]
    ys = [y for _, y in outer]
    left, bottom, top = min(xs), min(ys), max(ys)
    right_side = [pt for pt in outer if pt[0] > 300]
    outer = [(left, bottom), (left, top)] + right_side
    # Inner: one counter with a tongue from the right; split it into two rectangles at the tongue.
    ix = sorted({x for x, _ in inner})
    iy = sorted({y for _, y in inner})
    x0, x1 = ix[0], ix[-1]
    y0, yMb, yMt, y1 = iy
    pen = TTGlyphPen(None)
    for contour in (outer,
                    [(x0, y0), (x1, y0), (x1, yMb), (x0, yMb)],
                    [(x0, yMt), (x1, yMt), (x1, y1), (x0, y1)]):
        pen.moveTo((round(contour[0][0]), round(contour[0][1])))
        for x, y in contour[1:]:
            pen.lineTo((round(x), round(y)))
        pen.closePath()
    return pen.glyph()


def build(data, weight):
    font = instancer.instantiateVariableFont(TTFont(io.BytesIO(data)), {'wght': weight})
    glyf = font['glyf']
    glyf['B'] = bee(font.getGlyphSet())
    glyf['B'].recalcBounds(glyf)
    font['hmtx']['B'] = (font['hmtx']['B'][0], glyf['B'].xMin)
    glyf['C'] = cee(font.getGlyphSet(), weight)
    glyf['C'].recalcBounds(glyf)
    glyf['five'] = five(GRID[weight])
    glyf['five'].recalcBounds(glyf)
    font['hmtx']['five'] = (font['hmtx']['five'][0], glyf['five'].xMin)

    opts = subset.Options()
    opts.name_IDs = ['*']
    opts.layout_features = []
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[0x35, 0x42, 0x43])
    sub.subset(font)

    family, style = 'Kotoba Pixel', 'Bold' if weight == 700 else 'Medium'
    name = font['name']
    for nid in (1, 2, 3, 4, 6, 16, 17, 25):
        name.removeNames(nameID=nid)
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(style, 2, 3, 1, 0x409)
    name.setName(f'{family}; {style}; Pixelify Sans 1.000 with a redrawn 5, B and C', 3, 3, 1, 0x409)
    name.setName(f'{family} {style}', 4, 3, 1, 0x409)
    name.setName(f'KotobaPixel-{style}', 6, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight
    font.flavor = 'woff2'
    font.save(f'{OUT}/kotoba-pixel-{weight}.woff2')


if __name__ == '__main__':
    data = urllib.request.urlopen(SOURCE).read()
    for w in GRID:
        build(data, w)
        print(f'{OUT}/kotoba-pixel-{w}.woff2')
