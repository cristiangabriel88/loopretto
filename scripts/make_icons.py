"""Generate app icons for the packaged builds from the Loopretto logo mark.

Source is the square 512px logo (``static/images/favicon/android-chrome-512x512.png``)
so the ``.exe`` / ``.app`` icon matches the in-app logo. Outputs into ``build/``:

  build/loopretto.ico    - Windows (multi-resolution)
  build/loopretto.icns   - macOS   (only generated when run on macOS)
  build/loopretto.iconset/ - intermediate PNGs used to build the .icns

Run directly (``python scripts/make_icons.py``) or via build.bat / build.sh.
"""
from __future__ import annotations

import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "static", "images", "favicon", "android-chrome-512x512.png")
BUILD = os.path.join(ROOT, "build")

# Sizes Windows .ico carries; Pillow embeds all of them in one file.
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def _load_source() -> Image.Image:
    if not os.path.exists(SOURCE):
        sys.exit(f"Icon source not found: {SOURCE}")
    return Image.open(SOURCE).convert("RGBA")


def make_ico(img: Image.Image) -> str:
    os.makedirs(BUILD, exist_ok=True)
    out = os.path.join(BUILD, "loopretto.ico")
    img.save(out, format="ICO", sizes=ICO_SIZES)
    print(f"wrote {out}")
    return out


def make_icns(img: Image.Image) -> str | None:
    """Build a macOS .icns via the standard .iconset + iconutil dance.

    ``iconutil`` ships with macOS; on other platforms we only emit the .ico.
    """
    iconset = os.path.join(BUILD, "loopretto.iconset")
    os.makedirs(iconset, exist_ok=True)
    # Apple's expected iconset names: icon_<pt>x<pt>[@2x].png
    for pt in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = pt * scale
            name = f"icon_{pt}x{pt}{'@2x' if scale == 2 else ''}.png"
            img.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))
    out = os.path.join(BUILD, "loopretto.icns")
    if sys.platform != "darwin":
        print("not on macOS - skipping .icns (the .iconset PNGs are ready)")
        return None
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", out], check=True)
    print(f"wrote {out}")
    return out


def main() -> None:
    img = _load_source()
    make_ico(img)
    make_icns(img)


if __name__ == "__main__":
    main()
