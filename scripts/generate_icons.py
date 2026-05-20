"""Generate favicons and app icons from the Loopretto mark.

Run after the logo changes:
    python scripts/generate_icons.py

Requires Pillow (a build-time tool only, NOT a runtime dependency, so it's
not in requirements). Source is static/images/logo-mark.png; outputs land in
static/images/favicon/ (the paths the templates reference) plus static/.
"""
from __future__ import annotations

import colorsys
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "static", "images")
FAV = os.path.join(IMG, "favicon")
MARK = os.path.join(IMG, "logo-mark.png")

BG = (255, 255, 255, 255)   # white plate so the navy+purple mark is always visible
FILL_FRAC = 0.84            # mark width as a fraction of the canvas


def make_icon(size: int, radius_frac: float = 0.0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Rounded (or square) white background plate.
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    r = int(size * radius_frac)
    if r > 0:
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    else:
        draw.rectangle([0, 0, size, size], fill=BG)
    canvas = Image.alpha_composite(canvas, plate)

    # Scale the mark to fit, centred.
    mark = Image.open(MARK).convert("RGBA")
    target_w = int(size * FILL_FRAC)
    scale = target_w / mark.width
    target_h = int(mark.height * scale)
    if target_h > size * 0.88:  # very tall logos: fit by height instead
        scale = (size * 0.88) / mark.height
        target_w = int(mark.width * scale)
        target_h = int(mark.height * scale)
    mark = mark.resize((max(1, target_w), max(1, target_h)), Image.LANCZOS)
    canvas.alpha_composite(mark, ((size - target_w) // 2, (size - target_h) // 2))
    return canvas


PNG_SPECS = {
    "favicon-16x16.png": (16, 0.18),
    "favicon-32x32.png": (32, 0.18),
    "favicon-48x48.png": (48, 0.2),
    "apple-touch-icon.png": (180, 0.0),       # iOS applies its own rounding
    "android-chrome-192x192.png": (192, 0.0),
    "android-chrome-512x512.png": (512, 0.0),
}

for name, (size, radius) in PNG_SPECS.items():
    make_icon(size, radius).save(os.path.join(FAV, name))
    print("wrote", name)

ico = make_icon(48, 0.18)
ico.save(os.path.join(FAV, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico")

# Root-level copies (some browsers probe /static/favicon.*).
make_icon(32, 0.18).save(os.path.join(ROOT, "static", "favicon.png"))
ico.save(os.path.join(ROOT, "static", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote static/favicon.ico, static/favicon.png")


def make_light_variant(src: str, dst: str) -> None:
    """Lift every opaque pixel into the upper lightness range (hue preserved) so
    the navy half of the logo (and the navy wordmark text) read on the app's
    dark themes. Used on dark backgrounds; the original is used on the light theme."""
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hue, light, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            light = 0.62 + 0.33 * light          # map [0,1] -> [0.62, 0.95]
            sat = min(1.0, sat * 1.05)
            nr, ng, nb = colorsys.hls_to_rgb(hue, light, sat)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(dst)
    print("wrote", os.path.basename(dst))


make_light_variant(MARK, os.path.join(IMG, "logo-mark-light.png"))
make_light_variant(os.path.join(IMG, "logo-wordmark.png"), os.path.join(IMG, "logo-wordmark-light.png"))
