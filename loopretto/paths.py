"""Path resolution that works both from source and from a frozen build.

When Loopretto runs from source, templates/static live at the repo root and the
working audio file is written there too. When it runs as a PyInstaller bundle
(the Windows ``.exe`` / macOS ``.app`` on the Releases page), ``__file__`` points
*inside* the bundle's read-only extraction dir, so those assumptions break. These
helpers paper over the difference: read-only bundled assets come from the bundle,
writable runtime files go to a per-user working dir.
"""
from __future__ import annotations

import os
import sys
import tempfile

# Repo root when running from source: parent of this package.
_SOURCE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_frozen() -> bool:
    """True when running from a PyInstaller bundle (``.exe`` / ``.app``)."""
    return bool(getattr(sys, "frozen", False))


def resource_dir() -> str:
    """Directory holding read-only bundled assets (templates, static, ffmpeg).

    PyInstaller unpacks bundled data under ``sys._MEIPASS``; from source this is
    just the repo root.
    """
    if is_frozen():
        return getattr(sys, "_MEIPASS", _SOURCE_ROOT)
    return _SOURCE_ROOT


def working_dir() -> str:
    """Writable directory for the reused ``audio.*`` working file.

    From source this is the repo root (matches the historical behaviour and the
    ``.gitignore`` entries). From a bundle, the repo root is read-only and
    ephemeral, so we use a per-user temp folder - the file is a single working
    copy that's cleared on each new download, so temp is the right home for it.
    """
    if is_frozen():
        d = os.path.join(tempfile.gettempdir(), "Loopretto")
        os.makedirs(d, exist_ok=True)
        return d
    return _SOURCE_ROOT
