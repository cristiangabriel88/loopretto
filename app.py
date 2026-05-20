"""Entrypoint. Real app lives in the ``loopretto`` package (app factory)."""
import logging
import os
import re
import socket
import threading
import time
import webbrowser

from loopretto import create_app
from loopretto.config import Config

app = create_app()


def _open_browser_when_ready(port, host="127.0.0.1", timeout=20.0):
    """Open the default browser at the app URL, once the server answers.

    Lives here (not in ``run.bat``) so the tab opens for *every* launch path -
    ``run.bat``, ``python app.py``, and the packaged Windows ``.exe`` / macOS
    ``.app`` builds, which all run this entrypoint. Runs on a daemon thread and
    polls the port instead of sleeping a fixed amount, so the tab never opens
    before the page is actually serving (and never opens a dead tab if startup
    fails). On Windows ``webbrowser.open`` uses the registry default; on macOS
    it shells out to ``open`` - both work the same from a frozen bundle.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                break
        except OSError:
            time.sleep(0.2)
    else:
        return  # server never came up - don't open a tab to nothing
    try:
        webbrowser.open(f"http://localhost:{port}")
    except Exception:  # pragma: no cover - opening a browser is best-effort
        logging.getLogger(__name__).warning("Could not open a browser automatically.")


# Werkzeug access-log lines look like:
#   127.0.0.1 - - [date] "GET /static/... HTTP/1.1" 200 -
# Routine successful fetches of assets and the streamed audio file are pure
# noise for a local single-user app (the audio stream alone fires many range
# requests), so we drop them while keeping errors and the real actions visible.
_QUIET_PREFIXES = ("/static/", "/audio/", "/favicon.ico")
_ACCESS_RE = re.compile(r'"(?:GET|HEAD) (\S+) [^"]*" (\d{3})')


def _quiet_werkzeug(record):
    """Drop Werkzeug's dev-server banner and routine asset/audio access logs.

    Loopretto is local-only by design (see CLAUDE.md), so the production-WSGI
    warning is noise; Werkzeug logs the whole startup banner as one record, so
    we strip just that line rather than silencing the logger.
    """
    msg = record.getMessage()
    if "This is a development server" in msg:
        kept = [ln for ln in msg.splitlines() if "This is a development server" not in ln]
        record.msg = "\n".join(kept)
        record.args = None
        return True
    m = _ACCESS_RE.search(msg)
    if m:
        path, status = m.group(1), m.group(2)
        if status[0] in "23" and path.split("?", 1)[0].startswith(_QUIET_PREFIXES):
            return False  # suppress routine successful asset/audio fetch
    return True


logging.getLogger("werkzeug").addFilter(_quiet_werkzeug)

if __name__ == "__main__":
    # Auto-open the browser on launch. Skip if NO_BROWSER=1 (headless runs), and
    # guard against the Werkzeug reloader's double-spawn (harmless here since
    # debug=False means no reloader, but correct if that ever changes).
    if os.environ.get("NO_BROWSER") != "1" and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        threading.Thread(
            target=_open_browser_when_ready, args=(Config.PORT,), daemon=True
        ).start()
    app.run(host="0.0.0.0", port=Config.PORT, debug=False)
