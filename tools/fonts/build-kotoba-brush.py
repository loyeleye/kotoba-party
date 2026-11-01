"""Builds stage/assets/fonts/kotoba-brush.woff2: Yuji Syuku, cut down to the verdict's few kanji.

Yōkai Court's verdict column (有罪 / 無罪) is written by Fude-san, a calligraphy brush, so it needs a brush
face, not Noto Sans JP at 900 (N1 Japanese seat, 1 Nov 2026: no 入筆, 止め, はね or はらい). Yuji Syuku is
a brush-style mincho from the Yuji Project (OFL 1.1, no Reserved Font Name). The full font is 8 MB, so
this keeps only the characters the stage writes in it and renames the result "Kotoba Brush". The CSS
loads it for .yc-brush-ja and the 筆 seal only.

Run: pip install fonttools brotli && python3 tools/fonts/build-kotoba-brush.py
"""
import io
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/yujisyuku/YujiSyuku-Regular.ttf'
OUT = 'stage/assets/fonts/kotoba-brush.woff2'
# The verdicts and the seal: 有罪, 無罪, 筆.
TEXT = '有罪無筆'

font = TTFont(io.BytesIO(urllib.request.urlopen(SOURCE).read()))
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['vert', 'vrt2']
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(text=TEXT)
sub.subset(font)
for rec in font['name'].names:
    s = rec.toUnicode()
    if 'Yuji Syuku' in s:
        rec.string = s.replace('Yuji Syuku', 'Kotoba Brush')
    elif rec.nameID == 6:
        rec.string = 'KotobaBrush-Regular'
font.flavor = 'woff2'
font.save(OUT)
print(OUT)
