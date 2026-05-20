"""yt-dlp wrapper and YouTube URL validation."""
from __future__ import annotations

import logging
import os
from typing import Any, Optional
from urllib.parse import urlparse

import yt_dlp as youtube_dl

from ..config import Config
from . import storage

log = logging.getLogger(__name__)

# Use the ffmpeg bundled via imageio-ffmpeg so end users don't have to install
# it system-wide.
try:
    import imageio_ffmpeg

    FFMPEG_LOCATION: Optional[str] = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_LOCATION = None


class DownloadError(Exception):
    """Raised when audio extraction fails or the result is unusable."""


def is_supported_url(url: str) -> bool:
    """Accept http(s) URLs on an allowlisted host (or its subdomains), or a
    direct audio-file URL. yt-dlp's extractors handle the rest."""
    if not url or len(url) > Config.MAX_URL_LENGTH:
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if parsed.path.lower().endswith(Config.AUDIO_URL_EXTS):
        return True
    return any(host == h or host.endswith("." + h) for h in Config.SUPPORTED_HOSTS)


def _ydl_opts() -> dict[str, Any]:
    opts: dict[str, Any] = {
        "format": "bestaudio[ext=m4a]/bestaudio",
        "outtmpl": os.path.join(Config.AUDIO_DIR, f"{Config.AUDIO_BASENAME}.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "download_sections": [Config.DOWNLOAD_SECTION],
        "max_filesize": Config.MAX_FILESIZE_BYTES,
        # Use player clients that aren't behind YouTube's bot wall; this is what
        # lets anonymous (no-login) downloads work.
        "extractor_args": {"youtube": {"player_client": Config.YOUTUBE_PLAYER_CLIENTS}},
    }
    if FFMPEG_LOCATION:
        opts["ffmpeg_location"] = FFMPEG_LOCATION
    # Cookies are optional and off by default; only attach if explicitly set.
    if Config.COOKIES_FILE:
        opts["cookiefile"] = Config.COOKIES_FILE
    elif Config.COOKIES_FROM_BROWSER:
        opts["cookiesfrombrowser"] = (Config.COOKIES_FROM_BROWSER,)
    return opts


def _friendly_error(exc: Exception) -> str:
    msg = str(exc).lower()
    if "sign in to confirm" in msg or "not a bot" in msg:
        return (
            "YouTube blocked this download with a bot check. Try again in a moment; "
            "if it keeps happening, set COOKIES_FROM_BROWSER or COOKIES_FILE."
        )
    if "is not available" in msg or "video unavailable" in msg or "removed" in msg:
        return "Video unavailable."
    if "private" in msg:
        return "This video is private."
    if "age" in msg and "restrict" in msg:
        return "Video is age-restricted."
    if "geo" in msg or "region" in msg or "not available in your" in msg:
        return "Video is region-locked."
    return "Failed to download audio"


def download_audio(youtube_url: str) -> dict[str, str]:
    """Download the leading section of ``youtube_url`` as audio.

    Returns ``{title, thumbnail, audio_file}``. Raises :class:`DownloadError`
    on any failure so the caller can map it to an HTTP response.
    """
    storage.clear_previous_audio()

    try:
        with youtube_dl.YoutubeDL(_ydl_opts()) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
    except Exception as exc:  # noqa: BLE001 (categorized for the caller)
        log.exception("Download failed")
        raise DownloadError(_friendly_error(exc)) from exc

    ext = info.get("ext", "m4a")
    filename = f"{Config.AUDIO_BASENAME}.{ext}"
    path = storage.audio_path(filename)

    if not os.path.exists(path):
        raise DownloadError("Audio file not found")

    if os.path.getsize(path) > Config.MAX_FILESIZE_BYTES:
        try:
            os.remove(path)
        except OSError:
            pass
        raise DownloadError("Audio too large")

    return {
        "title": info.get("title", "Unknown Title"),
        "thumbnail": info.get("thumbnail", ""),
        "audio_file": filename,
    }
