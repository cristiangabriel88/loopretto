# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Loopretto** — a local Flask app that downloads a YouTube track via `yt-dlp` and serves a single-page web UI for looping sections of it (waveform via WaveSurfer.js, reference piano via mp3 samples). Designed to be run on the user's own machine; no accounts, no cloud storage.

## Common commands

```bash
# Run locally (Mac/Linux)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py                              # serves on http://localhost:5000

# Run locally (Windows, user-facing)
run.bat                                    # creates .venv, installs deps, opens browser

# Override port
PORT=8080 python app.py                    # or set PORT=8080 on Windows

# Docker
docker build -t loopretto .
docker run -p 5000:5000 loopretto

# Deploy (Fly.io)
fly deploy                                 # app name: "loopretto", see fly.toml
```

There are no tests, linters, or build steps configured. The frontend is vanilla JS + CDN-loaded WaveSurfer; there is no bundler.

## Architecture

### Backend (`app.py`, ~125 lines)

A single Flask module with three routes plus static pages:

- `POST /get_audio` — accepts `{url}`, validates against `YOUTUBE_PATTERN`, deletes any prior `audio.*` file, then runs `yt-dlp` with `download_sections=['*00:00:00-00:10:00']` and `max_filesize=30MB`. Returns `{title, thumbnail, audio_file}`. Rate-limited to **5/min per IP** (plus global defaults of 3/min, 10/hour, 20/day via `Flask-Limiter`, memory backend — won't survive restarts or scale horizontally).
- `GET /audio/<filename>` — serves the downloaded file and schedules `os.remove` via `threading.Timer(60.0, ...)`. The 60-second auto-delete is load-bearing: the frontend must fetch the file into a Blob (`URL.createObjectURL`) *before* the timer fires, then plays from the blob — the original file is intentionally gone after ~60s.
- `GET /`, `/howto`, `/about` — render the corresponding Jinja templates.

`imageio-ffmpeg` provides a bundled `ffmpeg` binary so end users on Windows don't need to install ffmpeg system-wide (the Dockerfile installs apt's ffmpeg instead, but `FFMPEG_LOCATION` still works either way).

`REQUIRE_SECRET` / `APP_SECRET` exist but `REQUIRE_SECRET` is hardcoded `False` — the secret gate is dormant.

### Frontend (`static/js/app.js`, `templates/index.html`, `static/css/styles.css`)

Single-page app, no framework. Three coupled state machines live in `app.js`:

1. **Load/unload lifecycle**: `loadAudio()` POSTs to `/get_audio`, fetches `/audio/<file>` into a Blob, feeds the blob URL into `wavesurfer.load(...)`. `addNewAudioButton` tears everything down without reloading the page.
2. **Loop region**: clicking the waveform sets `masterClickTime` / `loopStart`; pressing the Loop button creates a `wavesurfer.addRegion({loop: true, ...})` 5 seconds long by default. The region itself owns the looping behavior — `region-update-end` syncs `loopStart`/`loopEnd` back to module state.
3. **Theme**: `body.theme-midnight | theme-daylight | theme-mono`, cycled via the menu, persisted in `localStorage` under `loopretto.themeIdx`. Waveform colors are re-applied on theme change via `reapplyWaveColors()` — any new themable colors must be wired through `getWaveColors()` so the canvas stays in sync.

WaveSurfer.js v6 is loaded from `unpkg.com` (timeline + regions plugins). Backend is `MediaElement` (not WebAudio) — this matters if you ever try to add effects/filters that require the WebAudio graph.

Keyboard: Space = play/pause, ←/→ = 0.5s nudge, `z x c v b n m` + `s d g h j` = piano keys. The piano `<audio>` tags are inline in `index.html` (one per note, samples in `static/piano/`).

### `New design/` directory

A standalone React/JSX prototype (Babel-in-browser, no build step) for an upcoming redesign. **Not wired into the Flask app** — `templates/index.html` is what actually ships. Treat `New design/` as design exploration only unless explicitly migrating it in.

### Deploy targets

- `fly.toml` — app `loopretto`, internal port 5000, region `otp` (change for your deploy).
- `Dockerfile` — Python 3.11-slim + apt ffmpeg.
- `run.bat` — the path most end users take on Windows; bootstraps `.venv` on first run, skips on subsequent runs.

## Things to watch when editing

- The audio file's 60-second TTL means the *download* button has to re-fetch from `/audio/<file>` while it still exists. If you change the TTL or the cleanup logic, also update the user-facing copy in the README and the error message in `app.js` (`"may have already been cleaned up — load again"`).
- `Flask-Limiter`'s memory backend resets every process restart and isn't shared across workers — fine for single-instance Fly.io / local use, but adding gunicorn workers or scaling out requires Redis storage.
- `yt-dlp`'s `download_sections` + `max_filesize` are the only guardrails against large/long downloads — keep them in sync if you raise the 10-minute cap.
- There is no CSRF token on `/get_audio`; the app assumes same-origin local usage.
