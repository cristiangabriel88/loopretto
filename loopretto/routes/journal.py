"""Practice-journal export route: POST /save_journal.

Local-only convenience: writes the browser-held practice journal to the user's
Documents folder as readable Markdown plus a JSON backup. The frontend renders
the Markdown and ships the raw localStorage JSON; this route just persists both.
"""
from __future__ import annotations

import json

from flask import Blueprint, Response, current_app, jsonify, request

from ..config import Config
from ..services.journal_export import save_journal

journal = Blueprint("journal", __name__)


@journal.route("/save_journal", methods=["POST"])
def save_journal_route() -> Response | tuple[Response, int]:
    data = request.get_json(silent=True) or {}
    markdown = data.get("markdown")
    data_json = data.get("data")

    if not isinstance(markdown, str) or not isinstance(data_json, str):
        return jsonify({"error": "Missing journal content"}), 400
    if len(markdown) + len(data_json) > Config.MAX_JOURNAL_BYTES:
        return jsonify({"error": "Journal too large"}), 400

    # Validate the backup payload here so malformed JSON is a client error (400),
    # not a server error - and we don't echo the parser's internals back.
    try:
        parsed = json.loads(data_json)
    except ValueError:
        return jsonify({"error": "Invalid journal data"}), 400

    try:
        result = save_journal(markdown, parsed)
    except OSError as exc:
        current_app.logger.exception("Practice journal save failed")
        return jsonify({"error": str(exc)}), 500

    return jsonify({"ok": True, **result})
