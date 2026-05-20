"""Write the practice journal to the user's Documents folder (local-only).

The browser owns the journal data (localStorage); this just persists what it
sends to disk. The directory is created on first save.
"""
from __future__ import annotations

import json
import os

from ..config import Config


def save_journal(markdown: str, data: object) -> dict:
    """Write practice-journal.md + practice-data.json; return {dir, files}.

    ``data`` is the already-parsed practice JSON (the route validates it before
    calling); it is re-dumped here pretty-printed as the backup file.
    """
    os.makedirs(Config.PRACTICE_JOURNAL_DIR, exist_ok=True)

    md_path = os.path.join(Config.PRACTICE_JOURNAL_DIR, "practice-journal.md")
    json_path = os.path.join(Config.PRACTICE_JOURNAL_DIR, "practice-data.json")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return {
        "dir": Config.PRACTICE_JOURNAL_DIR,
        "files": ["practice-journal.md", "practice-data.json"],
    }
