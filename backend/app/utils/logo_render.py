"""
app/utils/logo_render.py — server-side rendering of the Noqeev brand mark,
for the branding workspace's on-demand download panel (app icon, social
avatar, full lockup, raw SVG).

MARK_POINTS/MARK_STROKE/the gold gradient stops below are ported 1:1 from
frontend/components/premium/Logo.js and frontend/app/brand/assetKit.js's
markOnlySvg() — same six-point bowl-and-tail path, same 14-unit stroke,
same padding (72% scale, offset 14 in a 0-100 box), same three gradient
stops. If the mark's geometry ever changes in Logo.js, this file needs the
same edit — there's no way to share one literal source of truth across a
JS frontend and a Python backend, so this comment is the tripwire instead.

Rendering is plain Pillow (ImageDraw.line with joint="curve" for the round
joins, flat ends for the butt caps, a vertical-gradient mask composite for
the fill) rather than an SVG rasterizer: cairosvg/resvg need system
libraries (libcairo, etc.) that aren't guaranteed present on a normal
Render deploy image, and the mark's geometry is simple enough — six
points, one stroke, one gradient — that hand-rendering it with Pillow, a
dependency this app already ships, avoids that whole deploy-risk category.
Everything is drawn at a supersampled resolution and downsampled once at
the end for anti-aliasing.
"""
import os

from PIL import Image, ImageDraw, ImageFont

MARK_POINTS = [
    (22, 68),
    (22, 16),
    (74, 16),
    (74, 68),
    (88, 86),
    (97, 8),
]
MARK_STROKE = 14
PAD_SCALE = 0.72
PAD_OFFSET = 14

# (stop position 0-1, RGB) — top of the mark brightest, base deepest bronze.
GRADIENT_STOPS = [
    (0.0, (0xF6, 0xE6, 0xB3)),
    (0.38, (0xF5, 0x9E, 0x0B)),
    (1.0, (0x5C, 0x44, 0x19)),
]

WORDMARK_COLOR = (0xF5, 0xF5, 0xF3)  # near-white — the dark-theme wordmark color
TILE_BG = (0x17, 0x18, 0x1C)  # near-black — matches the app's dark --card surface

_FONT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "Unbounded-ExtraBold.ttf")


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _gradient_color(t):
    t = max(0.0, min(1.0, t))
    for (t0, c0), (t1, c1) in zip(GRADIENT_STOPS, GRADIENT_STOPS[1:]):
        if t0 <= t <= t1:
            local_t = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return _lerp(c0, c1, local_t)
    return GRADIENT_STOPS[-1][1]


def _mark_rgba(size_px, supersample=3):
    """The mark alone, transparent background, baked-in ~14% padding —
    the same shape markOnlySvg() produces. Returns an RGBA Image sized
    (size_px, size_px)."""
    ss_size = size_px * supersample
    unit = ss_size / 100.0

    pts_px = [((PAD_OFFSET + x * PAD_SCALE) * unit, (PAD_OFFSET + y * PAD_SCALE) * unit) for x, y in MARK_POINTS]
    stroke_px = max(1, round(MARK_STROKE * PAD_SCALE * unit))

    mask = Image.new("L", (ss_size, ss_size), 0)
    ImageDraw.Draw(mask).line(pts_px, fill=255, width=stroke_px, joint="curve")

    y_top = (PAD_OFFSET + 8 * PAD_SCALE) * unit
    y_bottom = (PAD_OFFSET + 86 * PAD_SCALE) * unit
    span = max(1.0, y_bottom - y_top)

    gradient = Image.new("RGB", (ss_size, ss_size))
    grow = [_gradient_color((y - y_top) / span) for y in range(ss_size)]
    px = gradient.load()
    for y in range(ss_size):
        row_color = grow[y]
        for x in range(ss_size):
            px[x, y] = row_color

    out = Image.new("RGBA", (ss_size, ss_size))
    out.paste(gradient, (0, 0), mask)
    return out.resize((size_px, size_px), Image.LANCZOS)


def render_svg():
    """The raw vector mark, transparent background — the "download SVG"
    format. Same markup shape as assetKit.js's markOnlySvg()."""
    stops = "".join(f'<stop offset="{int(t * 100)}%" stop-color="#{c[0]:02X}{c[1]:02X}{c[2]:02X}" />' for t, c in GRADIENT_STOPS)
    path = " ".join(f"{'M' if i == 0 else 'L'} {x} {y}" for i, (x, y) in enumerate(MARK_POINTS))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">{stops}</linearGradient></defs>'
        f'<svg x="{PAD_OFFSET}" y="{PAD_OFFSET}" width="{100 * PAD_SCALE:g}" height="{100 * PAD_SCALE:g}" viewBox="0 0 100 100">'
        f'<path d="{path}" fill="none" stroke="url(#g)" stroke-width="{MARK_STROKE}" '
        'stroke-linecap="butt" stroke-linejoin="round" /></svg></svg>'
    )


def _png_bytes(img):
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_app_icon(size=1024):
    """Solid-tile app icon — platforms reject transparency here, so the
    mark sits on the app's own dark surface color with generous margin."""
    canvas = Image.new("RGB", (size, size), TILE_BG)
    mark_size = round(size * 0.72)
    mark = _mark_rgba(mark_size)
    offset = ((size - mark_size) // 2, (size - mark_size) // 2)
    canvas.paste(mark, offset, mark)
    return _png_bytes(canvas)


def render_social_avatar(size=1000):
    """Same solid-tile treatment as the app icon, but with a much bigger
    inset — a circular crop clips deep into each corner, and the mark's
    own tail (the highest, most off-center point) is exactly the kind of
    detail that gets cut off without this extra margin."""
    canvas = Image.new("RGB", (size, size), TILE_BG)
    mark_size = round(size * 0.56)
    mark = _mark_rgba(mark_size)
    offset = ((size - mark_size) // 2, (size - mark_size) // 2)
    canvas.paste(mark, offset, mark)
    return _png_bytes(canvas)


def render_lockup(width=1600, height=500):
    """Mark + wordmark side by side, transparent background — same
    proportions Logo.js's full lockup uses (gap = 0.36 * icon size,
    wordmark font size = 0.72 * icon size), just at export resolution.

    Those proportions were tuned for small UI header sizes; at export
    scale, Unbounded ExtraBold's own width runs the naive content width
    right up against the canvas edge, so this scales the whole lockup
    down to fit inside a margin rather than trusting the ratio blindly.
    """
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    margin = round(width * 0.06)
    max_content_w = width - margin * 2

    icon_size = round(height * 0.6)
    gap = round(icon_size * 0.36)
    font_size = round(icon_size * 0.72)
    font = ImageFont.truetype(_FONT_PATH, font_size)

    draw = ImageDraw.Draw(canvas)
    text = "NOQEEV"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    content_w = icon_size + gap + text_w

    if content_w > max_content_w:
        scale = max_content_w / content_w
        icon_size = round(icon_size * scale)
        gap = round(gap * scale)
        font_size = round(font_size * scale)
        font = ImageFont.truetype(_FONT_PATH, font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        content_w = icon_size + gap + text_w

    text_h = bbox[3] - bbox[1]
    start_x = (width - content_w) // 2
    mid_y = height // 2

    mark = _mark_rgba(icon_size)
    canvas.paste(mark, (start_x, mid_y - icon_size // 2), mark)

    text_x = start_x + icon_size + gap
    text_y = mid_y - text_h // 2 - bbox[1]
    draw.text((text_x, text_y), text, font=font, fill=(*WORDMARK_COLOR, 255))

    return _png_bytes(canvas)
