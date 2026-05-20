"""Write the practice journal to the user's Documents folder (local-only).

The browser owns the journal data (localStorage); this just persists what it
sends to disk. The directory is created on first save.
"""
from __future__ import annotations

import json
import os

from ..config import Config


def save_journal(markdown: str, data_json: str) -> dict:
    """Write practice-journal.md + practice-data.json; return {dir, files}."""
    os.makedirs(Config.PRACTICE_JOURNAL_DIR, exist_ok=True)

    md_path = os.path.join(Config.PRACTICE_JOURNAL_DIR, "practice-journal.md")
    json_path = os.path.join(Config.PRACTICE_JOURNAL_DIR, "practice-data.json")

    # Re-dump the JSON so the backup file is pretty-printed and validated
    # (a malformed body raises ValueError, mapped to a 500 by the route).
    parsed = json.loads(data_json)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(parsed, f, indent=2, ensure_ascii=False)

    return {
        "dir": Config.PRACTICE_JOURNAL_DIR,
        "files": ["practice-journal.md", "practice-data.json"],
    }
