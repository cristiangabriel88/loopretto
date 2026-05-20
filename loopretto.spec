# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Loopretto desktop builds.

Cross-platform: ``build.bat`` runs it on Windows (-> dist/Loopretto/Loopretto.exe)
and ``build.sh`` runs it on macOS (-> dist/Loopretto.app). Both first generate the
icon into build/ via scripts/make_icons.py.

  pyinstaller loopretto.spec --noconfirm
"""
import sys

from PyInstaller.utils.hooks import collect_all

# Bundle the templates/static tree so the frozen app serves the same UI it does
# from source (resolved via loopretto/paths.py -> sys._MEIPASS at runtime).
datas = [
    ("static", "static"),
    ("templates", "templates"),
]
binaries = []
hiddenimports = []

# yt-dlp pulls extractors in lazily and imageio-ffmpeg ships a bundled ffmpeg
# binary; collect everything so downloads work in the frozen build.
for pkg in ("yt_dlp", "imageio_ffmpeg"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

icon = "build/loopretto.icns" if sys.platform == "darwin" else "build/loopretto.ico"

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Loopretto",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # Keep a console window: it shows "Loopretto is running at localhost:5000 -
    # close this window to stop", matching run.bat's mental model. The browser
    # tab opens automatically (app.py).
    console=True,
    icon=icon,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="Loopretto",
)

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Loopretto.app",
        icon=icon,
        bundle_identifier="com.loopretto.app",
        info_plist={
            "CFBundleName": "Loopretto",
            "CFBundleDisplayName": "Loopretto",
            "NSHighResolutionCapable": True,
            # Background app: no Dock icon clutter; the browser tab is the UI.
            "LSBackgroundOnly": False,
        },
    )
