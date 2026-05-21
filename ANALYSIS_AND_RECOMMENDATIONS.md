# Loopretto - Analysis, Test Report & Recommendations

A full pass over the codebase: I read every backend module and the frontend
wiring, set up a clean virtualenv, ran the app, and exercised the routes and the
pure validation logic. **No code or visual changes were made** - this document
records what works, what I verified, the few discrepancies worth knowing about,
and a prioritized, local-only-respecting set of recommendations.

> Scope note: this is a *forward-looking feature backlog's* companion. The
> existing `RECOMMENDATIONS.md` is the feature-idea menu (key detection, chord
> strips, ear-training games, etc.). This file is the **engineering health
> report** - test coverage, correctness, doc accuracy, and small fixes - and is
> deliberately kept separate so neither overwrites the other.

---

## 1. Verdict

**The app works.** It imports cleanly, the factory builds, all three pages
render, every route returns the right status codes and bodies, the security-
relevant validation is solid, the Web Audio/feature-module wiring is intact, and
all referenced static assets exist on disk. Nothing is broken.

The one thing I could **not** exercise here is a real YouTube download - this
sandbox's network proxy returns `403 Forbidden` for YouTube content (TCP to
:443 connects, but HTTPS GETs are blocked). That is an **environment limitation,
not an app bug**: the `yt-dlp` wiring, options, and error mapping are all
correct, and the failure was correctly caught and surfaced as the friendly
`"Failed to download audio"` message. On a normal machine with open network
this path works (it's how the owner runs it daily).

---

## 2. What I tested

Environment: Python 3.11.15, fresh `.venv`, `pip install -r requirements.txt`
(clean, `pip check` reports no broken requirements). yt-dlp resolved to
`2026.03.17` (inside the `>=2026.02.21,<2027` range). Node 22 used only for JS
syntax checks.

### 2.1 Backend - routes (Flask test client + live server on :5055)

| Case | Expected | Result |
| --- | --- | --- |
| `GET /` | 200, HTML | ✅ 200, 42,820 bytes |
| `GET /howto` | 200, HTML | ✅ 200 |
| `GET /about` | 200, HTML | ✅ 200 |
| `GET /static/css/styles.css` | 200, `Cache-Control: public, max-age=31536000` | ✅ correct 1-year cache |
| `POST /get_audio` (no body) | 400 `No URL provided` | ✅ |
| `POST /get_audio` (`evil.com`) | 400 `Unsupported or invalid URL` | ✅ |
| `POST /get_audio` (non-JSON body) | 400 | ✅ (silent JSON parse → `{}`) |
| `GET /audio/..%2f..%2fetc%2fpasswd` | 404 | ✅ blocked by filename regex |
| `GET /audio/bad.txt` | 404 | ✅ |
| `GET /audio/audio.mp3` (real file) | 200, `Cache-Control: no-store`, `Accept-Ranges: bytes` | ✅ both headers present |
| `POST /save_journal` (missing fields) | 400 `Missing journal content` | ✅ |
| `POST /save_journal` (malformed JSON backup) | 400 `Invalid journal data` | ✅ |
| `POST /save_journal` (valid) | 200, writes 2 files | ✅ wrote `practice-journal.md` + pretty `practice-data.json` |
| `POST /save_journal` (>5 MB) | 400 `Journal too large` | ✅ |
| `GET /nope` | 404 | ✅ |

The access-log filter in `app.py` works as intended: a successful
`/static/...` fetch was **suppressed** from the log while `GET /`,
`GET /about`, and the `/audio/...` 404 were kept. The dev-server "this is a
production warning" banner line is stripped.

### 2.2 Backend - pure validation (security-relevant)

`is_supported_url()` (`downloader.py:38`) - 16/16 cases pass, including the
ones that matter for safety:

- Rejects non-allowlisted hosts, `ftp://`, `javascript:`, empty, and
  over-length URLs.
- Rejects the classic suffix-spoof `youtube.com.evil.com` and the
  prefix-spoof `fakeyoutube.com`/`notyoutube.com` (the `host == h or
  host.endswith("." + h)` check is correct - it does **not** fall for
  substring tricks).
- Accepts real allowlisted hosts + subdomains (`music.youtube.com`,
  `*.bandcamp.com`) and direct audio URLs case-insensitively (`song.MP3`).

`is_valid_audio_filename()` (`storage.py:24`) - 10/10 pass: only
`audio.<lowercase-alnum-ext>` is allowed; path traversal, uppercase, trailing
dot, embedded space, and bare `audio` are all rejected. Path traversal is
additionally blocked by `send_from_directory`.

`_sanitize_download_name()` (`audio.py:71`) - strips `/ \ < > : " | ? *` and
control chars, trims trailing dots, caps at 200 chars. `None` → `""`. Correct.

### 2.3 Frontend

- `node --check` passes on **all 7** JS files (`app.js`, `metronome.js`,
  `pitch-detect.js`, `pitch-shifter.js`, `practice.js`, `setlists.js`,
  `tempo.js`) - no syntax errors.
- Script load order in `index.html` is correct: 3 vendored WaveSurfer UMD
  builds → 6 feature modules → `app.js`, all `defer`'d.
- Every global a feature module exposes (`window.Jungle`, `PitchDetect`,
  `Metronome`, `PracticeStore`, `SetlistStore`, `TempoDetect`) is consumed in
  `app.js` (PracticeStore 23×, SetlistStore 11×, etc.). No dangling globals.
- The vendored builds expose the expected `WaveSurfer.Timeline` /
  `WaveSurfer.Regions` namespaces.
- **Every** `url_for('static', ...)` reference resolves to a file that exists:
  all favicons, both logo variants, all 12 piano `.mp3`s, `sounds/click.wav`,
  and the fretboard `data-sample-base`/`data-click-src` attributes are wired.
- Fretboard anchor samples in `FB_SAMPLES` (`app.js:2732`) match disk
  **exactly**: guitar `E2 A2 D3 G3 C4 F4 As4 D5`, bass `E1 As1 E2 As2 E3 G3`.

### 2.4 Hygiene

- `python -m py_compile` passes on the whole package.
- Working tree is clean; no stray `audio.*` artifacts committed (`.gitignore`
  covers the runtime file and `__pycache__`/`.venv`).
- `requirements.txt` lock is coherent (Flask 3.1.3, Werkzeug 3.1.8,
  Flask-Limiter 3.12, imageio-ffmpeg 0.5.1, yt-dlp range).

---

## 3. Findings

No bugs found. The items below are minor and almost all are **doc accuracy**,
not code defects.

### 3.1 Documentation is stale in three spots (worth a quick sync)

1. **Rate limiting is OFF by default, but `CLAUDE.md` says it's on.**
   `CLAUDE.md` states `/get_audio` is "Rate-limited to **5/min per IP** plus
   global defaults (3/min, 10/hour, 20/day)". In reality `config.py:61` sets
   `RATE_LIMIT_ENABLED = False` and `extensions.py:21` passes
   `enabled=Config.RATE_LIMIT_ENABLED`, so the `@limiter.limit` decorator is
   inert unless `RATE_LIMIT_ENABLED=1`. The *code's* default (off, with a clear
   comment explaining why) is the intended behavior for a local single-user
   app; it's the prose in `CLAUDE.md` that's out of date. One-line fix to the
   doc.

2. **`app.js` is 2,921 lines, not "~1,500".** `RECOMMENDATIONS.md` §5 ("Split
   `app.js` by concern") describes it as "~1,500 lines". It has roughly doubled
   (fretboard, drone, FX, practice all landed since). The refactor suggestion is
   *more* relevant now, but the number is wrong.

3. **Stale code pointers.** Because `app.js` grew, the line references in
   `RECOMMENDATIONS.md` (`app.js:356`, `:1287`, `:1327`, `index.html:600`) and
   the "four `defer`'d scripts" phrasing in `CLAUDE.md` (there are now 6 feature
   modules + 3 vendor builds) no longer match. The accompanying bullet lists are
   still accurate; only the counts/line numbers drifted.

### 3.2 `.gitignore` audio list is narrower than the cleanup glob

`.gitignore` enumerates specific runtime extensions (`audio.m4a`, `audio.webm`,
`audio.mp3`, `audio.opus`, `audio.webp`, `audio.info.json`) while
`clear_previous_audio()` (`storage.py:29`) globs **`audio.*`** - so yt-dlp could
briefly write, e.g., `audio.mp4`/`audio.aac`/`audio.flac` that the cleanup
removes but `.gitignore` wouldn't have hidden. Low risk (the file is short-lived
and the working tree is clean today), but a single `audio.*` line in
`.gitignore` would match the cleanup's breadth and remove the mismatch.

### 3.3 No automated tests (known)

`RECOMMENDATIONS.md` §5 already calls this out. The validation logic I tested by
hand above is exactly the high-value, easy-to-pin target - see §4.1.

---

## 4. Recommendations

Ordered by value-for-effort, and kept strictly within the **local-only,
single-user** philosophy in `CLAUDE.md` (no production hardening - no Redis,
CORS/CSRF, gunicorn, HTTPS, etc.).

### 4.1 Add a tiny `pytest` suite for the validation functions  *(highest value)*

The three functions I exercised by hand are pure, security-relevant, and have
clear contracts - perfect for a dozen locked-in tests, no `yt-dlp` mocking
needed. The exact cases that passed in §2.2 are a ready-made fixture table:

- `is_supported_url()`: allowlisted hosts + subdomains, direct-audio extensions
  (case-insensitive), and the rejections - suffix-spoof (`youtube.com.evil.com`),
  prefix-spoof (`fakeyoutube.com`), bad scheme, over-length, empty.
- `is_valid_audio_filename()`: `audio.<ext>` accepted; traversal/uppercase/
  trailing-dot/space/bare-name rejected.
- `_sanitize_download_name()`: separator/control-char stripping, `None` → `""`,
  length cap.

~40 lines of `pytest`, runnable as `python -m pytest`. This is the single best
return on effort and guards the only code paths where a regression would have
security weight.

### 4.2 Sync the three stale doc spots in §3.1

A 5-minute edit: flip the `CLAUDE.md` rate-limit sentence to "off by default
(set `RATE_LIMIT_ENABLED=1` to enable 5/min + 3/10/20 global)", update the
`app.js` line count, and refresh/relax the drifted line pointers. Keeps the docs
trustworthy for the next debugging session.

### 4.3 Broaden the `.gitignore` audio line to `audio.*`

Matches the cleanup glob; prevents any future yt-dlp output extension from ever
showing up as an untracked file. One-line change.

### 4.4 (Optional, dev-experience) A `STATIC_CACHE_SECONDS=0` dev note + Ruff

Both already in `RECOMMENDATIONS.md` §5; reaffirming because they're cheap. The
1-year static cache (`config.py:68`) means edits to CSS/JS need a hard refresh -
documenting `STATIC_CACHE_SECONDS=0` for active development saves confusion.
Ruff (one tool, fast) keeps the already-clean backend clean.

### 4.5 Leave the rest to the feature backlog

The musical features (key detection, chord strip, beat grid, ear-training) live
in `RECOMMENDATIONS.md` and are unaffected by this review - the architecture is
sound and ready for them. Nothing here blocks that work.

---

## 5. Things confirmed healthy (no action needed)

- **Security posture is good for its threat model.** Host allowlist with
  correct subdomain matching, strict served-filename regex, `no-store` on the
  reused audio file, download-name sanitization, JSON size caps, and friendly
  error mapping that doesn't leak `yt-dlp` internals. The dormant secret gate and
  in-memory limiter are intentional and fine for local use.
- **Path handling survives both source and frozen builds** (`paths.py`):
  read-only bundled assets vs. a writable per-user working dir, `AUDIO_DIR` kept
  absolute - exactly what `send_from_directory` needs.
- **Download guardrails are paired and present**: `download_sections` (leading
  10 min) + `max_filesize` (30 MB), with a post-download size re-check that
  deletes an oversized file.
- **The browser-auto-open** polls the port instead of sleeping and won't open a
  dead tab; honors `NO_BROWSER=1`.
- **Frontend wiring is intact** end to end (globals, load order, assets,
  fretboard kits).

---

*Tested on 2026-05-21. No source files were modified; this report is the only
artifact added.*
