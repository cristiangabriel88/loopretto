"""Audio routes: POST /get_audio and GET /audio/<filename>.

The browser streams the working file directly from ``/audio/<filename>`` via
range requests (no Blob round-trip). The file persists until the next track is
downloaded, so there is no per-request deletion timer to race against.
"""
from __future__ import annotations

from flask import Blueprint, Response, current_app, jsonify, request, send_from_directory

from ..config import Config
from ..extensions import limiter
from ..services import storage
from ..services.downloader import DownloadError, download_audio, is_supported_url

audio = Blueprint("audio", __name__)


@audio.route("/get_audio", methods=["POST"])
@limiter.limit(Config.GET_AUDIO_RATE_LIMIT)
def get_audio() -> Response | tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    youtube_url = data.get("url")
    secret = data.get("secret")

    if not youtube_url:
        return jsonify({"error": "No URL provided"}), 400

    if Config.REQUIRE_SECRET and secret != Config.APP_SECRET:
        return jsonify({"error": "Unauthorized"}), 403

    if not is_supported_url(youtube_url):
        return jsonify({"error": "Unsupported or invalid URL"}), 400

    try:
        result = download_audio(youtube_url)
    except DownloadError as exc:
        current_app.logger.exception("Audio download failed")
        status = 400 if str(exc) == "Audio too large" else 500
        return jsonify({"error": str(exc)}), status

    return jsonify(result)


@audio.route("/audio/<path:filename>")
def serve_audio(filename: str) -> Response | tuple[str, int]:
    if not storage.is_valid_audio_filename(filename):
        return "Not found", 404

    # conditional=True enables HTTP range requests for streaming/seeking.
    # max_age=0 + no-store: the filename is reused across tracks, so it must
    # never be cached (the global static cache is a year; see config).
    response = send_from_directory(
        Config.AUDIO_DIR, filename, conditional=True, max_age=0
    )
    response.headers["Cache-Control"] = "no-store"
    return response
