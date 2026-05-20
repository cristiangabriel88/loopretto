"""Configuration for the Loopretto Flask app.

Loopretto is a local, single-user tool; these defaults assume same-origin
usage on the user's own machine, not a hardened public deployment.
"""
from __future__ import annotations

import os

# Repo root (parent of this package). Used as the default audio directory so
# downloads and the /audio route resolve to the same place regardless of cwd.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    # --- Network ---
    PORT: int = _int_env("PORT", 5000)

    # --- Optional shared-secret gate (dormant by default for local use) ---
    REQUIRE_SECRET: bool = os.environ.get("REQUIRE_SECRET", "false").lower() == "true"
    APP_SECRET: str = os.environ.get("APP_SECRET", "loopmania")

    # --- Download guardrails ---
    # Only the leading 10 minutes are ever fetched, capped at 30 MB.
    DOWNLOAD_SECTION: str = os.environ.get("DOWNLOAD_SECTION", "*00:00:00-00:10:00")
    MAX_FILESIZE_BYTES: int = _int_env("MAX_FILESIZE_MB", 30) * 1024 * 1024

    # Where yt-dlp writes the extracted audio. A single working file is reused;
    # the previous one is removed before each new download.
    AUDIO_DIR: str = os.environ.get("AUDIO_DIR", _PROJECT_ROOT)
    AUDIO_BASENAME: str = "audio"

    # --- Rate limiting (in-process memory; resets on restart, fine for local) ---
    # Off by default: this is a single-user local app, so the "Too Many Requests"
    # wall just gets in the way. Set RATE_LIMIT_ENABLED=1 to turn it back on.
    RATE_LIMIT_ENABLED: bool = os.environ.get("RATE_LIMIT_ENABLED", "false").lower() == "true"
    RATE_LIMITS = ["3 per minute", "10 per hour", "20 per day"]
    GET_AUDIO_RATE_LIMIT = "5 per minute"

    # --- Static asset caching ---
    # Assets are not content-hashed, so a long cache means hard-refreshing after
    # editing CSS/JS during development. Override with STATIC_CACHE_SECONDS=0.
    STATIC_CACHE_SECONDS: int = _int_env("STATIC_CACHE_SECONDS", 31536000)  # 1 year

    # --- URL validation ---
    MAX_URL_LENGTH: int = _int_env("MAX_URL_LENGTH", 600)
    # Hosts yt-dlp supports that we explicitly allow. Subdomains match too
    # (e.g. m./music.youtube.com, *.bandcamp.com). Direct audio-file URLs
    # (AUDIO_URL_EXTS) are also accepted.
    SUPPORTED_HOSTS = {
        "youtube.com",
        "youtu.be",
        "soundcloud.com",
        "bandcamp.com",
        "vimeo.com",
    }
    AUDIO_URL_EXTS = (".mp3", ".m4a", ".wav", ".ogg", ".oga", ".opus", ".flac", ".aac")

    # --- YouTube player client ---
    # YouTube gates its default "web" client behind a "confirm you're not a bot"
    # wall. These alternate player clients return formats anonymously (no login,
    # no cookies). Order matters; yt-dlp aggregates formats across them.
    # Override with a comma-separated list if YouTube shifts which ones work.
    YOUTUBE_PLAYER_CLIENTS = [
        c.strip()
        for c in os.environ.get(
            "YOUTUBE_PLAYER_CLIENTS", "web_safari,android_vr,tv,android,ios"
        ).split(",")
        if c.strip()
    ]

    # Optional cookies, OFF by default. Only used if you explicitly set one of
    # these (e.g. for age-restricted/private videos the clients above can't get).
    COOKIES_FROM_BROWSER = os.environ.get("COOKIES_FROM_BROWSER") or None
    COOKIES_FILE = os.environ.get("COOKIES_FILE") or None
