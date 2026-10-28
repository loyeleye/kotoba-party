# Builds stage/assets/anim/nobiko-peek.png, Nobiko-san's nosy peek: her neck stretches out to the right
# (over the speech bubble, towards the answers), holds for a look, and springs back.
# Usage: python3 tools/art/sources/nobiko-peek.py stage/assets/hosts/nobiko.png stage/assets/anim/nobiko-peek.png \
#   stage/assets/anim/nobiko-reach.png stage/assets/anim/nobiko-sway.png
#
# Unlike the other sheets this one isn't PixelLab: it cuts her portrait into head and body, keeps both exactly
# as drawn, and redraws only the neck between them, so the head stays on model in every frame. Frames are
# 256x128 (twice as wide as the portrait), with the body where the portrait has it; stage/src/sprites.ts
# shows the sheet in a box twice as wide that overhangs the bubble.
import sys
from PIL import Image
W, H = 256, 128
SKIN, SHADE, INK = (251, 222, 190, 255), (155, 98, 94, 255), (11, 6, 5, 255)
src = Image.open(sys.argv[1]).convert('RGBA')
head = Image.new('RGBA', (128, 128)); body = Image.new('RGBA', (128, 128))
for y in range(128):
    for x in range(128):
        p = src.getpixel((x, y))
        if not p[3]: continue
        if 66 <= y <= 72 and 40 <= x < 56 and (sum(p[:3]) > 450 or p[:3] == SKIN[:3] or sum(p[:3]) < 60): continue  # a stub of her neck under the hair: redrawn
        if y <= 64 or (y <= 72 and (x < 56 or x > 78)): head.putpixel((x, y), p)  # face, bun and the hair below the chin
        elif y >= 84 or x < 26: body.putpixel((x, y), p)  # kimono, hands and the fan; the neck between is redrawn
BASE, CHIN = (42, 88), (67, 63)
EYES = [(53, 45, 65, 51), (75, 45, 89, 51)]  # her eyes in the portrait: x0, y0, x1, y1 (exclusive)
SKINS = {SKIN[:3], (250, 154, 182)}  # skin and blush

def glance(im, k, eyes=EYES):
    """Her eyes look k pixels to the right: in each row the iris and its highlights slide over inside the
    eye's outline, and white sclera fills in behind. Ink within two pixels of skin is the (two-pixel) outline and stays put."""
    out = im.copy()
    for x0, y0, x1, y1 in eyes:
        def skin(x, y): return im.getpixel((x, y))[:3] in SKINS
        def inside(x, y):
            if skin(x, y): return False
            if sum(im.getpixel((x, y))[:3]) < 60:  # ink: outline if it touches skin
                return not any(skin(x + a, y + b) for a, b in ((1, 0), (2, 0), (-1, 0), (-2, 0), (0, 1), (0, -1)))
            return True
        for y in range(y0, y1):
            xs = [x for x in range(x0, x1) if inside(x, y)]
            for x in xs:
                out.putpixel((x, y), im.getpixel((x - k, y)) if x - k in xs else (250, 249, 249, 255))
    return out

# (head offset x, y, head flipped) per frame: out, a turn to face the middle of the screen, a look, a second lean
# in, then a turn back and a spring back to the idle pose. Her face is drawn turned a little to the left, so the
# mirrored head faces right, towards the bubble and the answers.
OFFSETS = [(0, 0, False), (20, -1, False), (48, -2, True), (80, -2, True), (100, -1, True), (100, 0, True),
           (104, -1, True), (100, 0, True), (56, -1, True), (24, 0, False)]
FLIPPED = head.transpose(Image.FLIP_LEFT_RIGHT)
FLIPPED_EYES = [(128 - x1, y0, 128 - x0, y1) for x0, y0, x1, y1 in EYES]
FLIP_SHIFT = 2 * CHIN[0] - 127  # keeps the mirrored chin on the end of the neck

def bezier(p0, p1, p2, p3, n):
    for i in range(n + 1):
        t = i / n; u = 1 - t
        yield (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
               u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])

def disc(im, cx, cy, r, colour):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if 0 <= x < im.width and 0 <= y < im.height and (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                im.putpixel((x, y), colour)

def draw_neck(pts, size):
    neck = Image.new('RGBA', size)
    for x, y in pts: disc(neck, x, y, 6.2, INK)
    for x, y in pts: disc(neck, x, y, 5.2, SHADE)
    for x, y in pts: disc(neck, x - 0.4, y - 0.9, 4.2, SKIN)
    return neck

sheet = Image.new('RGBA', (W * len(OFFSETS), H))
for i, (dx, dy, flip) in enumerate(OFFSETS):
    f = Image.new('RGBA', (W, H))
    if dx == 0:  # at rest she is the portrait itself, so the sheet starts on the idle pose
        f.alpha_composite(src)
        sheet.alpha_composite(f, (i * W, 0))
        continue
    chin = (CHIN[0] + dx - (8 if flip else 0), CHIN[1] + dy)  # the mirrored jaw is shorter on the right: end the neck under it
    # Up out of the collar, then a long S out to the chin; the dip sags lower the further she reaches.
    sag = min(14, dx / 6)
    pts = list(bezier(BASE, (BASE[0] + 2, BASE[1] - 22), (chin[0] - 12 - dx / 3, chin[1] + 10 + sag), chin, 80))
    f.alpha_composite(draw_neck(pts, (W, H)))
    f.alpha_composite(body)  # over the neck, so it disappears into the collar
    k = 1 if dx < 40 else 2  # she looks where she's going
    if flip: f.alpha_composite(glance(FLIPPED, k, FLIPPED_EYES), (dx + FLIP_SHIFT, dy))
    else: f.alpha_composite(glance(head, k), (dx, dy))
    sheet.alpha_composite(f, (i * W, 0))
sheet.save(sys.argv[2])

# The long reach (stage/src/reach.ts) draws her neck live, so it takes her parts on their own: frame 0 is the
# body without its neck, frame 1 the mirrored head glancing right, frame 2 the mirrored head wincing. The neck meets the head at (60, 63), under the left of the jaw so it never pokes out past the chin.
# Frame 2 is the same head wincing (Narabete!'s knots); 3–5 blink and talk. Built further down, after the faces.
REACH_AT = len(sys.argv) > 3

# Her chorus dance (stage/src/modes/karaokeDuel.ts): 8 frames of 128x128 over two beats. Her body stays put and
# her neck bends to carry her head over to the left on the first beat and the right on the second, dipping a
# pixel at each end of the swing, with her eyes leading the way. The neck is redrawn in every frame, the same way
# as the peek, so it bends rather than the whole of her sliding. Rows come in pairs, one pair per face, the second
# of each pair for blinks: her own face (and a blink), a big smile (the cheer sheet's laughing eyes with its widest
# open mouth; already shut, so no blink) and a wry, unimpressed look (from the oops sheet; already half shut). The
# smile and the wry look are pasted onto her portrait head from those sheets' frames.
SWAY = [(-6, 1), (-4, 0), (0, 0), (4, 0), (6, 1), (4, 0), (0, 0), (-4, 0)]  # head offset x, y per frame
LIDS = [(52, 43, 66, 52), (73, 44, 90, 53)]  # around each eye, wider than EYES to take in the lashes
# Each closed eye: a lash line arcing down (x0, x1, y), drawn two pixels thick in the middle.
LASHES = [[(54, 54, 47), (55, 63, 48), (64, 64, 47), (57, 61, 49)], [(75, 75, 48), (76, 87, 49), (88, 88, 48), (78, 85, 50)]]
FACE = (51, 36, 92, 65)  # the face pasted between expressions: x0, y0, x1, y1 (exclusive)

def blink(im):
    out = im.copy()
    for (x0, y0, x1, y1), lash in zip(LIDS, LASHES):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if out.getpixel((x, y))[:3] not in SKINS: out.putpixel((x, y), SKIN)
        for a, b, y in lash:
            for x in range(a, b + 1): out.putpixel((x, y), INK)
    return out

def face_from(sheet, i, dx, dy):
    """Her head with the face of frame i of another sheet, where that frame's head sits (dx, dy) from the portrait's."""
    src = Image.open(sheet).convert('RGBA').crop((i * 128, 0, i * 128 + 128, 128))
    out = head.copy()
    x0, y0, x1, y1 = FACE
    for y in range(y0, y1):
        for x in range(x0, x1): out.putpixel((x, y), src.getpixel((x + dx, y + dy)))
    return out, src

def smile():
    """Cheer frame 1's laughing eyes, with the wide-open mouth of cheer frame 3 (a few rows dropped to fit her chin)."""
    sheet = sys.argv[1].replace('hosts/nobiko.png', 'anim/nobiko-cheer.png')
    out, _ = face_from(sheet, 1, 3, 0)
    wide = Image.open(sheet).convert('RGBA').crop((384, 0, 512, 128))
    for y in range(55, 63):
        for x in range(64, 75): out.putpixel((x, y), SKIN)  # her small open mouth
    for k, y in enumerate((54, 55, 56, 57, 59, 61, 62, 63, 64)):
        for x in range(71, 85):
            p = wide.getpixel((x, y))
            if p[:3] not in SKINS: out.putpixel((x - 8, 55 + k), p)
    return out

def wry():
    return face_from(sys.argv[1].replace('hosts/nobiko.png', 'anim/nobiko-oops.png'), 7, -4, 2)[0]

def wince():
    """Eyes squeezed shut (> <) and teeth clenched in a grimace: a knot pulled tight in her neck."""
    out = head.copy()
    for x0, y0, x1, y1 in LIDS:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if out.getpixel((x, y))[:3] not in SKINS: out.putpixel((x, y), SKIN)
    def line(a, b):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for k in range(n + 1):
            x = round(a[0] + (b[0] - a[0]) * k / n); y = round(a[1] + (b[1] - a[1]) * k / n)
            out.putpixel((x, y), INK); out.putpixel((x, y + 1), INK)
    for a, b, c in (((54, 44), (62, 47), (54, 50)), ((87, 45), (79, 48), (87, 51))):
        line(a, b); line(b, c)
    for y in range(54, 63):
        for x in range(62, 78):
            if out.getpixel((x, y))[:3] not in SKINS: out.putpixel((x, y), SKIN)
    TEETH = (255, 250, 240, 255)
    for y in range(56, 61):
        for x in range(65, 75):
            edge = y in (56, 60) or x in (65, 74)
            out.putpixel((x, y), INK if edge or y == 58 or x in (68, 71) else TEETH)
    return out

if REACH_AT:
    # 3: blinking; 4 and 5: mouth shut and half open, from her lip-sync sheet (its open frame is the portrait's), so
    # the head on Narabete!'s ruler can talk and blink for her while her portrait's plate is empty.
    talk = Image.open(sys.argv[1].replace('hosts/nobiko.png', 'anim/nobiko-talk.png')).convert('RGBA')
    def mouth(k):
        out = head.copy()
        for y in range(56, 64):
            for x in range(62, 78): out.putpixel((x, y), talk.getpixel((k * 128 + x, y)))
        return out
    mirrored = lambda im, k=2: glance(im.transpose(Image.FLIP_LEFT_RIGHT), k, FLIPPED_EYES)
    frames = [body, mirrored(head), wince().transpose(Image.FLIP_LEFT_RIGHT), blink(head).transpose(Image.FLIP_LEFT_RIGHT), mirrored(mouth(0)), mirrored(mouth(1))]
    parts = Image.new('RGBA', (128 * len(frames), 128))
    for i, f in enumerate(frames): parts.alpha_composite(f, (128 * i, 0))
    parts.save(sys.argv[3])

if len(sys.argv) > 4:
    faces = [(head, True), (blink(head), False), (smile(), True), (smile(), False), (wry(), True), (wry(), False)]
    sway = Image.new('RGBA', (128 * len(SWAY), 128 * len(faces)))
    for row, (face, looks) in enumerate(faces):
        for i, (dx, dy) in enumerate(SWAY):
            f = Image.new('RGBA', (128, 128))
            chin = (CHIN[0] + dx, CHIN[1] + dy)
            f.alpha_composite(draw_neck(list(bezier(BASE, (BASE[0] + 2, BASE[1] - 22), (chin[0] - 12, chin[1] + 10), chin, 80)), (128, 128)))
            f.alpha_composite(body)
            f.alpha_composite(glance(face, (dx > 0) - (dx < 0)) if looks and row == 0 else face, (dx, dy))
            sway.alpha_composite(f, (i * 128, row * 128))
    sway.save(sys.argv[4])
