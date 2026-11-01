"""Builds stage/assets/fonts/kotoba-pixel-{500,700}.woff2: Pixelify Sans with the look-alikes redrawn.

Read from the couch, Pixelify Sans mixes up characters:
- Its 5 reads as S or 8: a rounded top-left corner and a curl at the top right (art panel, 27 Oct 2026).
- Its C is an O with a notch one pixel tall in the right side (65 units of a 645-unit height at
  weight 500, 34 at 700), so "Yokai Court" read "Yokai Oourt" (Yokai Court panel, 1 Nov 2026). Its G
  has the same notch, and a crossbar that runs into the stem (art panel, 1 Nov 2026).
- Its bold B is a G with a notch: rounded left corners, and a middle bar that hangs off the right
  side instead of the stem, so "Bento Haus" read "Gento Haus".
- Its 2, 3, 6 and 9 have hooks that close their open halves, so each reads as 8 ("216" as "816").

This takes the Pixelify Sans variable font (OFL 1.1, no reserved name), pins it at the two weights the
pages use and redraws those glyphs on Pixelify's own grid and stroke widths, squaring a corner or
opening a hook only where that tells the glyph apart:
- 5: a square flag top and an open, hookless bowl.
- C and G: the mouth is cut back to the depth of Pixelify's own lowercase c and E, and the G's crossbar
  stands clear of the stem.
- B: a square stem and two closed bowls, built like Pixelify's own D.
- 2 and 3: squared, open on the left. 6 and 9: their hooks are removed.

It drops the ligatures (Pixelify's fi draws "file" as "Ale"), keeps kerning, and renames the result
"Kotoba Pixel": the complete face, self-hosted, so the pages no longer load Pixelify from Google and a
slow or blocked CDN can't leave titles in a mix of pixel and system letters.

Run: pip install fonttools brotli && python3 tools/fonts/build-kotoba-pixel.py
"""
import hashlib
import io
import urllib.request

from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# Pixelify Sans v3 as Google Fonts serves it, pinned by hash: the Latin subset (ASCII, Latin-1,
# punctuation) gets the redraws; Latin Extended (the macron vowels of romaji, ō ū ā ē ī) is built as
# a second file of the same family. Google's Cyrillic subset isn't used.
SOURCES = {
    '': ('https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9Jn0Eiw.woff2',
         '4a5633a0c9c1b73abd133a56d3716c2d8df2ed03cb987346f72194aeb224f382'),
    '-ext': ('https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9JnMEi1lR.woff2',
             '0afa0101fd8c5892b1661f7561564c98f0aa13ef2d6609809d477820c4bc6c89'),
}
OUT = 'stage/assets/fonts'

# Stroke edges at each weight, read off Pixelify's own 'eight' and 'six' so the new 5 sits on the
# same grid: L/R are the outer, notch and inner x edges; y runs bottom, bottom notch, bottom stroke's
# top, middle stroke's bottom, right notch bottom and top, middle stroke's top, top stroke's bottom,
# top corner step, top; xM is where the 3's middle bar starts (the left end of Pixelify's B tongue).
GRID = {
    500: dict(L0=60.33, L1=150.33, Li=170.0, R1=439.67, R0=530.67, Ri=420.0,
              y0=-11.67, y1=76.67, yB=100.33, yMb=255.33, yN=279.0, yNt=344.0, yMt=366.33, yTb=520.33,
              yTs=544.0, yT=633.33, xM=240.0),
    700: dict(L0=61, L1=149, Li=188, R1=453, R0=542, Ri=414,
              y0=-11, y1=74, yB=125, yMb=246, yN=297, yNt=331, yMt=381, yTb=501, yTs=552, yT=638, xM=237),
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
# own terminals (190/255 at 500, 211/246 at 700), so the capital matches the small letter; the top one
# is on the row where Pixelify's E ends its top arm (432 at 500, 416 at 700).
MOUTH = {500: dict(yTt=432, yBt=190), 700: dict(yTt=416, yBt=211)}


def cee(glyphset, weight):
    """Pixelify's own C with its mouth widened: the right-side stubs are cut back to the terminals."""
    from fontTools.pens.recordingPen import RecordingPen
    rec = RecordingPen()
    glyphset['C'].draw(rec)
    pts = [a[0] for op, a in rec.value if op in ('moveTo', 'lineTo')]
    # Pixelify's C is one contour; the four points at the right of the mouth come in order: outer
    # top-arm end, inner top-arm end, inner bottom-arm end, outer bottom-arm end.
    mouth = [i for i, (x, y) in enumerate(pts) if x > 300 and 200 < y < 400]
    check(len(mouth) == 4, f'C mouth points: {mouth}')
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


def check(ok, what):
    """Stops the build if Pixelify's outlines aren't the shape the redraws expect (not skipped by -O)."""
    if not ok:
        raise SystemExit(f'Unexpected Pixelify outline, check the redraw: {what}')


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
    check(len(outer) == 16 and len(inner) == 8, f'B outline: {outer} {inner}')
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


def poly(*contours):
    pen = TTGlyphPen(None)
    for pts in contours:
        pen.moveTo((round(pts[0][0]), round(pts[0][1])))
        for x, y in pts[1:]:
            pen.lineTo((round(x), round(y)))
        pen.closePath()
    return pen.glyph()


def two(g):
    """A squared 2: flat top bar, right stem down to the middle bar, left stem down to a flat base.
    Pixelify's 2 has a top-left hook and a bottom-right stub that close both halves, so it reads as 8."""
    return poly([
        (g['L0'], g['y0']), (g['L0'], g['yMt']), (g['Ri'], g['yMt']), (g['Ri'], g['yTb']),
        (g['L0'], g['yTb']), (g['L0'], g['yT']), (g['R1'], g['yT']), (g['R1'], g['yTs']),
        (g['R0'], g['yTs']), (g['R0'], g['yMb']), (g['Li'], g['yMb']), (g['Li'], g['yB']),
        (g['R0'], g['yB']), (g['R0'], g['y0']),
    ])


def three(g):
    """A 3 open on the left: flat top and bottom bars with no left hooks, and a middle bar that starts
    inset from the left edge. Pixelify's 3 has tall left hooks, so it reads as 8."""
    return poly([
        (g['L0'], g['y0']), (g['L0'], g['yB']), (g['Ri'], g['yB']), (g['Ri'], g['yMb']),
        (g['xM'], g['yMb']), (g['xM'], g['yMt']), (g['Ri'], g['yMt']), (g['Ri'], g['yTb']),
        (g['L0'], g['yTb']), (g['L0'], g['yT']), (g['R1'], g['yT']), (g['R1'], g['yTs']),
        (g['R0'], g['yTs']), (g['R0'], g['yNt']), (g['R1'], g['yNt']), (g['R1'], g['yN']),
        (g['R0'], g['yN']), (g['R0'], g['y1']), (g['R1'], g['y1']), (g['R1'], g['y0']),
    ])


def six(glyphset):
    """Pixelify's 6 without the hook at the top right (which closes it into an 8 or a G)."""
    outer, bowl = contours(glyphset, 'six')
    # outer[6:12] is the hook: the top bar's end, its rounded corner and the stub down the right side.
    check(len(outer) == 20, f'6 outline: {outer}')
    (x, yT), (_, yTb) = outer[6], outer[11]
    return poly(outer[:6] + [(x, yT), (x, yTb)] + outer[12:], bowl)


def nine(glyphset):
    """Pixelify's 9 without the hook at the bottom left: the 6 turned round."""
    outer, bowl = contours(glyphset, 'nine')
    # outer[1:6] is the hook: the bottom bar's rounded corner and the stub up the left side.
    check(len(outer) == 20, f'9 outline: {outer}')
    (x, _), (_, yB) = outer[0], outer[5]
    return poly(outer[:1] + [(x, yB)] + outer[6:], bowl)



# G's crossbar: Pixelify starts it 70 (500) or 49 (700) units from the stem, so it runs into the stem
# and the G reads as a boxed 6 or O. Moving its left end to here leaves a clear gap.
GBAR = {500: 260, 700: 277}


def gee(glyphset, weight):
    """Pixelify's G with the C's open mouth and a crossbar that stands clear of the stem."""
    (pts,) = contours(glyphset, 'G')
    mouth = [i for i, (x, y) in enumerate(pts) if x > 400 and 300 < y < 400]
    bar = [i for i, (x, y) in enumerate(pts) if 200 < x < 300]
    check(len(mouth) == 2 and len(bar) == 2, f'G mouth/bar points: {mouth} {bar}')
    for i in mouth:
        pts[i] = (pts[i][0], MOUTH[weight]['yTt'])
    for i in bar:
        pts[i] = (GBAR[weight], pts[i][1])
    return poly(pts)


def build(data, weight, part):
    font = instancer.instantiateVariableFont(TTFont(io.BytesIO(data), recalcTimestamp=False), {'wght': weight})
    font.recalcTimestamp = False  # the same source gives the same bytes
    if part == '':
        gs = font.getGlyphSet()
        drawn = {'B': bee(gs), 'C': cee(gs, weight), 'G': gee(gs, weight),
                 'five': five(GRID[weight]), 'two': two(GRID[weight]), 'three': three(GRID[weight]),
                 'six': six(gs), 'nine': nine(gs)}
        glyf = font['glyf']
        for name, glyph in drawn.items():
            width = font['hmtx'][name][0]
            glyf[name] = glyph
            glyf[name].recalcBounds(glyf)
            font['hmtx'][name] = (width, glyf[name].xMin)

    # Every character the source has; kerning and accent placement kept, ligatures dropped (Pixelify's
    # fi ligature draws "file" as "Ale").
    opts = subset.Options()
    opts.name_IDs = ['*']
    opts.layout_features = ['kern', 'mark', 'mkmk', 'ccmp', 'locl']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=font.getBestCmap().keys())
    sub.subset(font)

    family, style = 'Kotoba Pixel', 'Bold' if weight == 700 else 'Medium'
    name = font['name']
    for nid in (1, 2, 3, 4, 6, 16, 17, 25):
        name.removeNames(nameID=nid)
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(style, 2, 3, 1, 0x409)
    name.setName(f'{family}; {style}; Pixelify Sans 1.000 with 2, 3, 5, 6, 9, B, C and G redrawn', 3, 3, 1, 0x409)
    name.setName(f'{family} {style}', 4, 3, 1, 0x409)
    name.setName(f'KotobaPixel-{style}', 6, 3, 1, 0x409)
    font['OS/2'].usWeightClass = weight
    font.flavor = 'woff2'
    out = f'{OUT}/kotoba-pixel{part}-{weight}.woff2'
    font.save(out)
    return out


if __name__ == '__main__':
    for part, (url, sha) in SOURCES.items():
        data = urllib.request.urlopen(url).read()
        if hashlib.sha256(data).hexdigest() != sha:
            raise SystemExit(f'{url} changed (sha256 {hashlib.sha256(data).hexdigest()}): check the redraws still fit, then update SOURCES')
        for w in GRID:
            print(build(data, w, part))
