"""Audio file storage and cleanup helpers.

Loopretto reuses a single working audio file (``audio.<ext>``). Each new
download removes the previous one, so there is no per-request timer to race
against; the file simply lives until the next track is loaded.
"""
from __future__ import annotations

import glob
import os
import re

from ..config import Config

# Strict allowlist for the served filename: ``audio.<lowercase-ext>`` only.
_FILENAME_RE = re.compile(r"^audio\.[a-z0-9]+$")


def audio_path(filename: str) -> str:
    """Absolute-ish path to a file inside the audio directory."""
    return os.path.join(Config.AUDIO_DIR, filename)


def is_valid_audio_filename(filename: str) -> bool:
    """Reject anything that isn't our own ``audio.<ext>`` working file."""
    return bool(_FILENAME_RE.match(filename))


def clear_previous_audio() -> None:
    """Remove any leftover ``audio.*`` working files (m4a, webm, mp4, webp, ...).

    Globbing covers every extension yt-dlp may emit, so thumbnails and metadata
    side-files don't accumulate.
    """
    pattern = os.path.join(Config.AUDIO_DIR, f"{Config.AUDIO_BASENAME}.*")
    for path in glob.glob(pattern):
        try:
            os.remove(path)
        except OSError:
            pass
