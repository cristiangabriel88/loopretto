# Loopretto — Recommendations & Improvement Plan

A detailed, opinionated audit of the current codebase with concrete next steps. Items are grouped by category and ranked roughly by impact within each group. Each item lists **what's wrong**, **why it matters**, **a concrete fix**, and (where useful) a code pointer.

---

## 1. Critical Bugs & Correctness Issues

These are not theoretical — they will break the app in observable ways under realistic use.

### 1.1 Concurrent users overwrite each other's audio file
**Where:** `app.py:67-95` — `outtmpl: 'audio.%(ext)s'` is a single global filename.

**Problem:** All users share `audio.m4a`. If User B starts a download while User A is mid-fetch, the file User A is about to receive is replaced by User B's content. On Fly.io with even two concurrent listeners, this guarantees broken playback. Even single-user, opening the app in two tabs corrupts both.

**Fix:**
- Generate a unique filename per request: `outtmpl: f'audio-{uuid4().hex}.%(ext)s'`.
- Return that filename to the client; reference it in `/audio/<filename>`.
- Tighten the path-traversal guard in `/audio/<filename>` (whitelist the UUID pattern, not just `os.path.exists`).
- Move downloads into a per-request temp directory (`tempfile.TemporaryDirectory`) and serve from there.

### 1.2 The 60-second auto-delete is a race condition for the *same* user
**Where:** `app.py:113-122` — `threading.Timer(60.0, lambda: ... os.remove(path))` fires per request.

**Problem:** Every `GET /audio/<file>` schedules a new 60-second timer. The frontend hits the endpoint twice on load (`loadAudio` and the download button later). The *first* timer's 60s fires regardless of the user's session activity, deleting the file mid-session if a user is slow to start playback (e.g. paused in tab for >60s before the blob is fully cached).

**Real symptom:** If a user pastes a URL, gets distracted for a minute, then clicks Download, the file is gone and they see "Download failed. The file may have already been cleaned up — load again."

**Fix:**
- Stop scheduling deletion on every `GET`. Schedule it once, at download time.
- Or: delete on a periodic sweep (every N minutes, remove `audio-*` files older than 10 min). Threading.Timer is the wrong primitive here.
- Or: stream the audio to the client and delete immediately after sending (use `send_file` with a callback / `Response` with cleanup, or `after_this_request`).

### 1.3 Cleanup loop misses `.mp4`, `.webp`, `.info.json`
**Where:** `app.py:68` — `for ext in ['m4a', 'webm', 'mp3', 'opus']`.

**Problem:** yt-dlp can produce `audio.mp4` (already exists in the repo as a leftover, 737 KB), `audio.webp` (thumbnail), and `audio.info.json` (metadata). None of these are deleted by the prior-cleanup loop. They accumulate forever on the host. Currently your working directory has all three.

**Fix:**
```python
for f in glob.glob('audio.*'):
    try: os.remove(f)
    except FileNotFoundError: pass
```
Or better — combined with §1.1, just delete the per-request temp directory.

### 1.4 Production deployment uses the Flask development server
**Where:** `app.py:126` (`app.run(...)`), `Dockerfile:20` (`CMD ["python", "app.py"]`).

**Problem:** Flask's built-in server is single-threaded, leaks file descriptors under load, and explicitly warns against production use (visible in `app.err`). Fly.io is currently serving real traffic through it.

**Fix:** Switch to Gunicorn (Linux) or Waitress (cross-platform). Update Dockerfile:
```dockerfile
RUN pip install gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "2", "-k", "gthread", "--threads", "4", "app:app"]
```
Note: with multiple workers, the in-memory rate limiter (§2.1) becomes per-worker — adopt Redis storage at the same time.

### 1.5 `/get_audio` returns generic 500s, hiding the real error
**Where:** `app.py:89-90` — `except Exception as e: return jsonify({'error': 'Failed to download audio'}), 500`.

**Problem:** Geo-blocked content, age-restricted videos, region locks, broken extractors after YouTube changes, network issues — all return the same opaque message. Users have no way to recover, and you have no logs.

**Fix:**
- Log `e` with `logging.exception(...)` before returning.
- Categorize common yt-dlp exceptions (`DownloadError`, `ExtractorError`, `GeoRestrictedError`) and surface a more useful message: "Video is age-restricted", "Region locked", "Video unavailable".

### 1.6 The default URL is pre-filled in the input
**Where:** `templates/index.html:92` — `value="https://www.youtube.com/watch?v=gCARYHv6sdY"`.

**Problem:** First-time users may click "Load audio" without entering anything and download Autumn Leaves. Either remove the pre-fill or wire the suggested chips to *only* set the URL when clicked, leaving the input empty by default.

### 1.7 `New design/` folder ships to production
**Where:** Repository root + `Dockerfile:11` (`COPY . .`).

**Problem:** The Dockerfile copies the entire repo including 80 KB of unused JSX. It's also confusing — a future contributor will assume it's wired in.

**Fix:** Add a `.dockerignore`:
```
.venv/
__pycache__/
audio.*
New design/
*.md
.git/
app.err
app.out
static/js/app copy.js
```

### 1.8 `static/js/app copy.js` is dead code
**Where:** `static/js/app copy.js` (9 KB).

**Problem:** Confuses readers, ships to clients (browsers can request it), shows up in greps. It's a stale earlier version of `app.js`.

**Fix:** Delete it.

---

## 2. Security

### 2.1 Rate limiter uses in-process memory
**Where:** `app.py:26` — `storage_uri="memory://"`.

**Problem:**
- Resets on every restart / redeploy.
- With multiple workers (see §1.4) each worker has its own counters — effective limit is `Nx` what's documented.
- Trivial to bypass on Fly.io by riding through a deploy.

**Fix:** Use Redis (`storage_uri="redis://..."`) once you scale beyond a single worker. Fly has free Redis via Upstash.

### 2.2 No CSRF / CORS controls on `/get_audio`
**Where:** `app.py:51-110`.

**Problem:** A malicious page can `fetch('https://loopretto.fly.dev/get_audio', { method: 'POST', body: '...' })` from any origin, using a visitor's IP to drive your server's yt-dlp downloads (and burn its rate budget). The endpoint is unauthenticated POST.

**Fix:**
- Add `flask-cors` with an allowlist of origins (`loopretto.fly.dev` only).
- Or require a same-origin check via `Sec-Fetch-Site` / `Origin` header.
- Reactivate the `REQUIRE_SECRET` gate (`app.py:32`) for any public-facing deployment, and stop hardcoding `"loopmania"` as the default secret in source.

### 2.3 `YOUTUBE_PATTERN` is too lax
**Where:** `app.py:35` — only checks that the URL starts with `youtube.com` or `youtu.be`.

**Problem:** URLs like `https://youtube.com.evil.com/...` pass the regex (the `.` is unescaped, but more importantly `^https://(www\.)?(youtube\.com|youtu\.be)/` does correctly anchor the host — false alarm there). The real issue is downstream: yt-dlp follows redirects and supports thousands of extractors beyond YouTube. A youtube.com URL that 302s elsewhere may extract from a different site than the user expects.

**Fix:**
- Pass `extractor_args` to lock yt-dlp to the youtube extractor only.
- Use `urllib.parse.urlparse` and explicitly check `hostname in {"youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"}` rather than regex.
- Add a maximum URL length (e.g. 500 chars) before passing anything to yt-dlp.

### 2.4 Path traversal surface in `/audio/<filename>`
**Where:** `app.py:113-122`.

**Problem:** `send_from_directory` itself is safe, but you also do `os.path.join('.', filename)` and `os.path.exists(path)` *before* calling `send_from_directory`. A crafted filename with `..` won't actually escape Flask's serving, but the manual cleanup callback could be tricked into trying `os.remove('../something')`.

**Fix:** Validate `filename` against a strict regex (`^audio-[0-9a-f]{32}\.[a-z0-9]+$`) before doing anything with it. Reject otherwise.

### 2.5 `APP_SECRET` defaults to `"loopmania"` in source
**Where:** `app.py:33`.

**Problem:** Even though `REQUIRE_SECRET = False` makes it inert today, the default is committed to git history. If the flag is ever flipped on without setting the env var, every public client can authenticate with the hardcoded value.

**Fix:** Default to `None`. Refuse to start if `REQUIRE_SECRET=True` and `APP_SECRET` is unset.

### 2.6 Dockerfile runs as root
**Where:** `Dockerfile`.

**Fix:** Add a non-root user:
```dockerfile
RUN useradd -m -u 10001 app
USER app
```

### 2.7 No HTTPS-only / HSTS in Fly config
**Where:** `fly.toml:18-22` — both port 80 (http) and 443 (tls,http) are exposed.

**Fix:** Add `force_https = true` to the http handler so port 80 redirects to 443. Set HSTS via Flask response headers.

### 2.8 No input length cap on YouTube URL
**Where:** `app.py:53-55`.

**Problem:** A 1 MB URL string would pass through to yt-dlp. Probably not exploitable but trivial to fix.

**Fix:** `if len(youtube_url) > 500: return 400`.

### 2.9 No SRI on CDN scripts
**Where:** `templates/index.html:33-35`, plus `howto.html` and `about.html` load Tailwind from `cdn.tailwindcss.com`.

**Problem:** If unpkg or jsdelivr is ever compromised, every Loopretto user runs attacker JS. SRI hashes mitigate this; the `New design/index.html` already uses them, but production templates don't.

**Fix:** Pin `wavesurfer.js` to a specific version and add `integrity="sha384-..." crossorigin="anonymous"` attributes. Better: self-host these libs.

### 2.10 Tailwind CDN script in production
**Where:** `templates/howto.html:8`, `templates/about.html:7`.

**Problem:** `cdn.tailwindcss.com` is a JIT compiler that runs in the browser. The Tailwind team explicitly says **not for production**. It downloads 300 KB of JS per page load.

**Fix:** Either drop Tailwind on these two pages (they're tiny — you can hand-write CSS), or use the precompiled CSS file with the classes used.

---

## 3. Performance

### 3.1 Audio is downloaded server-side, written to disk, re-fetched as Blob client-side
**Where:** `app.py:74-95`, `static/js/app.js:285-316`.

**Current path:** YouTube → server disk → HTTP → browser RAM (Blob) → wavesurfer.

**Problem:** Doubles bandwidth (round-trip through your server) and disk I/O. On Fly.io's small instances, this is the dominant cost.

**Fix options (in order of impact):**
- **Stream**: `send_file(..., conditional=True)` with range requests; avoid the Blob roundtrip by passing the URL directly to `wavesurfer.load()` instead of fetching and blobbing.
- **Background convert + cache**: For repeated URLs (same video), cache the extracted audio for a few minutes.

Note: the Blob-in-memory pattern was put in to survive the 60-second cleanup. Fix §1.2 first, then this is unblocked.

### 3.2 WaveSurfer.js v6 is stale
**Where:** `templates/index.html:33-35`.

**Problem:** Wavesurfer v7 is a full rewrite — smaller bundle, 2-3× faster waveform decoding, native WebAudio backend, vastly improved zoom performance. v6 is unmaintained.

**Fix:** Migrate to v7. Note: the plugin API changed (`WaveSurfer.timeline.create` → `WaveSurfer.Timeline.create` import etc.), so this is a couple hours of work.

### 3.3 Wheel-zoom triggers synchronous canvas re-render on every event
**Where:** `static/js/app.js:488-494` — `$("waveform").addEventListener("wheel", ...)`.

**Problem:** Each wheel tick calls `wavesurfer.zoom(currentZoom * 5)` which re-renders the canvas. On trackpads (small deltas, many events) this stutters.

**Fix:** Throttle with `requestAnimationFrame` or debounce by ~16ms:
```js
let zoomScheduled = false;
function applyZoom() { wavesurfer.zoom(currentZoom * 5); zoomScheduled = false; }
// inside wheel:
if (!zoomScheduled) { zoomScheduled = true; requestAnimationFrame(applyZoom); }
```

### 3.4 No `Cache-Control` on static assets
**Where:** Flask default static serving.

**Problem:** Browsers re-fetch your CSS, JS, piano samples on every visit. Piano samples alone are ~12 small mp3s.

**Fix:** Set `SEND_FILE_MAX_AGE_DEFAULT` on the Flask app to a year for hashed assets, or front Flask with nginx and set explicit `Cache-Control: public, max-age=31536000, immutable`. Append a content-hash to filenames for cache busting.

### 3.5 Multiple webfonts, no `font-display: swap`
**Where:** `templates/index.html:27-29`.

**Problem:** Three font families × 4 weights = lots of font files. The page blocks on font load.

**Fix:** Add `&display=swap` to the Google Fonts URL (you already do for `index.html`, but verify all weights are necessary; you currently request 4 weights of Space Grotesk and 4 of DM Sans). Consider self-hosting and using `font-display: swap` + `preload`.

### 3.6 No gzip/brotli compression
**Where:** Flask serves uncompressed CSS/JS by default.

**Fix:** Add `Flask-Compress`, or do it at the edge via Fly's HTTP handler (it can gzip automatically — check fly.toml).

### 3.7 `MediaElement` backend in WaveSurfer
**Where:** `static/js/app.js:211`.

**Problem:** `MediaElement` is the simpler backend but means you can never add WebAudio effects (EQ, pitch shift independent of speed, etc.) without switching. v6's WebAudio backend has memory issues with long files; v7 fixes this.

**Fix:** When migrating to v7, switch to the WebAudio backend so future filter features are possible.

### 3.8 No CDN / asset hashing
**Fix:** Move static assets to a versioned subpath (`/static/v2/...`) and bust on deploy.

---

## 4. Architecture & Code Quality

### 4.1 Backend is a single 125-line file with mixed concerns
**Where:** `app.py`.

**Suggested structure:**
```
loopretto/
  __init__.py        # create_app() factory
  routes/
    pages.py         # /, /howto, /about
    audio.py         # /get_audio, /audio/<filename>
  services/
    downloader.py    # yt-dlp wrapper, validation
    storage.py       # temp-dir management, cleanup
  config.py
```
- Use the app factory pattern so tests can instantiate clean apps.
- Add type hints throughout.

### 4.2 Frontend is 552 lines of imperative DOM manipulation
**Where:** `static/js/app.js`.

**Problem:** Half a dozen interleaved state machines (file lifecycle, loop region, theme, piano, fullscreen, menu) sharing module-global mutable variables. Adding a feature means understanding all of them.

**Options:**
- **Lift state into a single object** with an event emitter. Each subsystem subscribes to changes.
- **Adopt Alpine.js or htmx + a small reactive store** — adds <10 KB but pays for itself fast.
- **Commit to the React redesign** in `New design/` and ship it.

The third option is what the redesign folder hints at. Decide whether to invest in it or delete it. Don't leave it as design exploration forever.

### 4.3 Two inconsistent design systems
**Where:** `templates/index.html` (custom CSS with `oklch`, modern tokens) vs. `templates/howto.html` / `about.html` (Tailwind CDN, hardcoded colors like `rgb(25, 53, 73)`).

**Problem:** The pages look like different apps. Themes from index.html don't apply to the other two.

**Fix:** Rewrite howto/about using `styles.css` tokens. Drop Tailwind from this project entirely.

### 4.4 No tests at all
**Fix:** Start with:
- `pytest` + `pytest-flask` for `app.py` (mock yt-dlp; test URL validation, rate limiting, path traversal).
- `vitest` or `playwright` for frontend integration (load a short test mp3, verify wavesurfer mounts, verify loop region behavior).

### 4.5 No linting / formatting
**Fix:**
- Python: `ruff` (one tool, fast, replaces black + flake8 + isort).
- JS: `prettier` + `eslint`.
- Add a pre-commit hook.

### 4.6 No CI
**Fix:** GitHub Actions running lint + tests on push. Auto-deploy to Fly on main.

### 4.7 `requirements.txt` is unpinned-style flat
**Where:** `requirements.txt`.

**Note:** It actually *is* pinned (`==`). Good. But there's no separation of runtime vs. dev deps.

**Fix:** Adopt `pyproject.toml` with `uv` or `poetry`. Lock files separate from manifest.

### 4.8 No structured logging
**Fix:** Replace any future `print` with `logging` configured for JSON output on Fly. This makes errors searchable.

### 4.9 No health check endpoint
**Where:** `fly.toml:26-30` uses TCP checks only.

**Fix:** Add `GET /healthz` returning 200 and an HTTP health check in fly.toml. Catches stuck Python processes that TCP checks miss.

### 4.10 Hardcoded magic numbers
**Where:** `app.py:80-81` — 10 minute cap and 30 MB cap inline. Frontend has 5-second default loop, 60-second cleanup, etc.

**Fix:** Pull into a `config.py` with env overrides.

---

## 5. New Features (Ranked by Value to Musicians)

These are ideas, not requirements. Ordered by my read of impact for the target user (musicians learning by ear).

### 5.1 Independent pitch shifting (key transposition)
**Why:** Huge feature gap. Practicing a sax solo on guitar means transposing — currently impossible. Slowing tempo without affecting pitch is half-solved (WaveSurfer's `setPlaybackRate` already preserves pitch on most browsers via the `preservesPitch` MediaElement attribute), but you can't shift pitch independently.

**How:** WebAudio + a soundtouch.js or rubberband.js worklet. Add buttons "+1 semitone / -1 semitone". Requires WebAudio backend (see §3.7).

### 5.2 Shareable loop URLs
**Why:** "Hey check this lick" with a URL that loads the same YouTube video + loop region + speed. Killer feature for teaching.

**How:** Encode state in URL hash: `#v=abc123&start=12.5&end=16.2&speed=0.7`. On load, restore. No backend changes needed.

### 5.3 Save multiple loops per song
**Why:** A user transcribing a song wants to bounce between intro / verse / chorus / bridge / solo without redragging every time.

**How:** Frontend-only — store named regions in `localStorage` keyed by video ID. Show a list under the waveform. Click to activate.

### 5.4 Drag-and-drop / file upload as alternative source
**Why:** Some users have local mp3s they want to loop. Currently the app is YouTube-only. The whole audio pipeline already supports it.

**How:** Add a "drop a file" zone next to the URL input. Skip `/get_audio`, feed the file directly to wavesurfer. Removes the need for a server round-trip entirely for local files.

### 5.5 A/B loop comparison
**Why:** Compare a tricky riff to a simpler reference riff. Two named regions; toggle between them with a single key.

### 5.6 Pitch / note detection overlay
**Why:** Show the dominant pitch above the waveform — visually confirm what your ear hears. The killer feature for transcription.

**How:** Web Audio analyser node → autocorrelation pitch detector → render notes as a row of pills above the waveform. Open-source pitch detectors in JS (e.g. `pitchy`) make this <100 LOC.

### 5.7 Spectrogram view (toggle)
**Why:** Some users prefer spectrograms for finding pitch by eye. Wavesurfer v7 has a built-in spectrogram plugin.

### 5.8 Vocal isolation / stem separation
**Why:** Practice the bass line without the vocals; isolate the solo to transcribe. This is the #1 reason people use Moises / Spleeter.

**How:** Server-side spleeter / Demucs is expensive — needs GPU or minutes of CPU. Realistic version: integrate with an external service (Moises API), or accept the latency and run Demucs on Fly's GPU machines. Probably a paid feature.

### 5.9 Metronome
**Why:** Practicing along with a slowed-down loop without a click is hard. Tap-tempo BPM detection + visual + audio click.

### 5.10 Tuner
**Why:** Already have piano samples, already have audio analysis. Add a "tune your instrument" mode using the microphone.

### 5.11 Expanded piano: multiple octaves, scrollable
**Where:** `templates/index.html:252-294`.

**Problem:** Single octave is limiting for transcription. Adding C3-C6 is just more sample files + DOM.

### 5.12 MIDI keyboard input
**Why:** Users with MIDI keyboards could use them as the reference piano.

**How:** Web MIDI API. ~30 LOC.

### 5.13 Annotation / tab strip under waveform
**Why:** Type notes ("D7 here", "key change") tied to timestamps. Save with the loop.

### 5.14 PWA / offline mode
**Why:** The `site.webmanifest` link is already in HTML but there's no service worker. Make the static UI installable; piano samples cached offline.

### 5.15 Mobile UX
**Why:** Currently mostly unusable on phones — the waveform interactions are mouse-centric.

**How:** Audit on real devices. Make region resize handles touch-friendly. Replace hover-only affordances with tap-then-act.

### 5.16 Volume / per-channel mixer
Currently no volume slider at all (browser controls only).

### 5.17 Region presets ("8-bar loop from cursor")
**Why:** Snap-to-bars once BPM is known.

### 5.18 Keyboard shortcut help modal
**Why:** Discoverability of `z x c v b n m` piano keys, Space, arrows. The current `kbd-hint` shows only 3 shortcuts.

---

### 5.A — Audio Analysis & Visualization

These features turn the waveform into an analytical tool, not just a scrubber.

### 5.19 Automatic key detection
**Why:** "What key is this in?" is the first question of any ear-transcriber. Showing "C minor" prominently lets a beginner skip the painful trial-and-error scale-matching phase entirely.

**How:** Krumhansl-Schmuckler profile correlation on a chromagram. The chromagram is FFT magnitudes folded into 12 semitone bins. Output a confidence-ranked list ("C minor 87%, Eb major 71%"). Pure JS, no server work. Libraries: `essentia.js` does this in one line, or hand-roll it in ~150 LOC.

### 5.20 Automatic chord detection (chord-over-time strip)
**Why:** The single most-requested feature on competing apps (Chordify, ChordU). A row of chord names under the timeline showing "G – D – Em – C" as the song progresses turns Loopretto from a "loop tool" into a "transcription tool".

**How:** Per-frame chromagram → template matching against the 24 major/minor triads (and 7th extensions). Display as colored pills aligned to the timeline. Smooth with a Viterbi pass to avoid chord flicker. `essentia.js` has a `ChordsDetection` algorithm; alternative is a small CNN ported to ONNX.js. Confidence per chord lets users toggle "only show certain chords".

### 5.21 Automatic BPM / tempo detection + beat grid
**Why:** Two huge unlocks:
1. Lets §5.17 region presets ("8-bar loop") actually work.
2. Snap loop boundaries to beats so loops don't have ugly half-bar gaps.

**How:** Onset detection (spectral flux) → autocorrelation → BPM. Render vertical hairlines on the waveform at each beat. Click any beat to set loop start. Allow manual tap-tempo as fallback when detection is wrong (common on rubato performances).

### 5.22 Time-signature detection
**Why:** Knowing it's 6/8 vs 4/4 changes how you count and feel a phrase. Helpful for new musicians who can't tell yet.

**How:** Once beats are detected (§5.21), look at the periodicity of stronger beats (downbeats). Or surface manually: a 2/3/4/6/8 picker.

### 5.23 Onset markers on the waveform
**Why:** Visualizing exactly *where* each note attack happens makes transcribing dense passages dramatically easier. You see the rhythm before you hear it.

**How:** Spectral flux onset detection (already needed for §5.21). Draw vertical ticks above the waveform at each onset. Optionally snap loop region edges to nearest onset.

### 5.24 Melodic pitch contour overlay
**Why:** Different from §5.6's per-note detection — a continuous pitch curve drawn over the waveform, like a piano-roll line that follows the melody. Glissandos, bends, vibrato are visible as wavy lines.

**How:** Per-frame pitch detection (`pitchy` or YIN) plotted as an SVG polyline. Color by confidence (faint when polyphonic, sharp when monophonic).

### 5.25 Live spectrum analyzer
**Why:** Watch the frequency content of the *current playhead* in real time. Useful for spotting fundamental vs harmonic structure.

**How:** Web Audio `AnalyserNode` at 4096 FFT, render to canvas at 60fps. Toggle alongside waveform.

### 5.26 Loudness / RMS envelope under waveform
**Why:** Helps identify dynamic accents — where the player is *leaning into* a note. Surprisingly useful for groove study.

**How:** Compute RMS in 50ms windows once at load. Render as a faint orange overlay.

### 5.27 Note-name labels on the spectrogram or waveform
**Why:** Show "G4", "Bb3" etc. directly on the visualization at detected positions. Beginner-friendly version of §5.24.

**How:** Sample the detected pitch every ~200ms; label only positions where pitch is stable for >150ms and confidence is high.

---

### 5.B — Practice Tools

Features that change how you *use* the loop, not what's in it.

### 5.28 Auto-slowdown progression ("ramp practice")
**Why:** The gold-standard practice method: start at 50%, master it, ramp up to 60%, 70%… until you can play at speed. Tedious to manage manually.

**How:** UI: "Start at 50%, end at 100%, step 5% every 3 loops". The app tracks loop count and bumps `playbackRate` automatically. Show progress bar.

### 5.29 Loop with countdown / pre-roll
**Why:** When playing along, you need to know when the loop is about to restart so you can hit the downbeat. Currently the loop just *cuts* back.

**How:** Two flavors:
- **Audible click**: play 4 metronome clicks before the loop's first beat.
- **Visual countdown**: "4 - 3 - 2 - 1" overlay synced to beats.

### 5.30 Loop fade-in / fade-out (taper)
**Why:** Sudden cuts on loop restart break immersion when looping for hours. A 50ms fade at boundaries removes the click and is way less fatiguing.

**How:** Web Audio gain ramp around region boundaries. ~30 LOC.

### 5.31 Loop repetition counter
**Why:** "How many times have I tried this lick already?" is the question a frustrated practitioner asks. Showing the number objectifies practice.

**How:** Increment a counter on `region-finish`. Reset on user demand. Add a daily-rep counter that persists.

### 5.32 Practice session timer + journal
**Why:** Deliberate practice gets better when you log it. "I spent 22 minutes on bars 17-24 today". Total practice time per song.

**How:** Track time the app spends actively playing. Per-song log in `localStorage`. Optional weekly summary email if you add accounts.

### 5.33 Reverse playback
**Why:** A classic ear-training method: play a phrase backwards to hear its internal intervals more clearly without the lead-in cues.

**How:** Web Audio: reverse the `AudioBuffer` samples once on load (cached), provide a toggle.

### 5.34 "Memorize" mode — gradually fade the source
**Why:** Practice transcribed phrase from memory by progressively lowering the original's volume across reps. By the 10th loop you're playing it alone.

**How:** Volume scheduler: -3dB per repetition until silent, then back to 100%.

### 5.35 Stereo channel isolation (left / right only)
**Why:** Older recordings often pan instruments hard left/right — guitar on the left, vocal on the right. Soloing a channel isolates the part instantly. No ML needed.

**How:** Web Audio `ChannelSplitter`. Three buttons: Left / Stereo / Right.

### 5.36 Karaoke-style vocal removal (mid-side)
**Why:** For songs where vocals sit dead-center, mid-side subtraction removes most of them for free (no Demucs needed). Imperfect but free and instant.

**How:** Sum L−R to get the side channel; play that. Often makes drums and vocals quieter, bass and guitars louder.

### 5.37 Drone note (sustained reference pitch)
**Why:** Modal practice (raga, sarod study, modal jazz) wants a constant tonic drone behind the loop. Trains the ear to feel scale degrees instead of intervals.

**How:** Generate a sustained Web Audio oscillator at user-picked pitch, mixed alongside the loop. Add an octave-down variant. The piano samples can serve as drones (just loop them).

### 5.38 Tap-along beat mode
**Why:** Tap Space (or a foot pedal) to mark every beat you hear → automatically establish a beat grid even when §5.21's auto-detection fails (rubato, no clear drums).

### 5.39 Difficulty ramp / spaced repetition for songs being learned
**Why:** A user typically works on 3-5 songs at once. Spaced repetition reminds them: "you haven't played Wonderwall in 4 days — review?"

**How:** SuperMemo-2 over song IDs. Daily "what should I practice today?" view.

### 5.40 Section labeler (intro / verse / chorus / bridge)
**Why:** Songs aren't continuous — they have structure. Labeling sections lets you say "jump to chorus 2" instantly.

**How:** Manual labeler on the timeline; or auto-detect via self-similarity matrix (essentia.js does it).

---

### 5.C — Audio Manipulation & EQ

Filter and shape the sound to expose what you want to hear.

### 5.41 Parametric / graphic EQ with presets
**Why:** Boost the midrange to bring out vocals; cut the lows to focus on a guitar solo. EQ is the cheapest stem-isolation that exists.

**How:** Web Audio `BiquadFilterNode` chain. Presets: "Vocals", "Bass focus", "High guitar", "Drums", "Solo". 8-band UI for power users.

### 5.42 Draggable band-pass / high-pass / low-pass
**Why:** "I just want to hear the 200-800 Hz range to follow the bassline" — a single draggable band on a spectrogram is the cleanest UX I've seen for this (think Capo Touch's "spotlight").

**How:** Filter node + a draggable rectangle on the spectrogram canvas.

### 5.43 Bass / treble simple knobs (beginner shelf)
**Why:** Pro EQ overwhelms beginners. Two knobs cover 80% of cases.

### 5.44 Stereo width control
**Why:** Wider stereo separates parts; narrower mono-collapses to spot what's actually there.

**How:** Mid-side processing → adjustable side gain.

### 5.45 De-reverb / clarity boost
**Why:** Live recordings drown details in room sound. Even a basic spectral noise gate or off-the-shelf JS de-reverb improves transcribability.

### 5.46 Polarity invert / phase flip
**Why:** Combined with the channel isolation, polarity tricks open up classic "remove the vocal" hacks.

### 5.47 Compressor / dynamics flattener
**Why:** Quiet bits (intro, breakdown) jump to audible level. Loud bits stop clipping. Useful when slowed-down passages get even quieter.

**How:** Web Audio `DynamicsCompressorNode`. Single "more punch" toggle.

---

### 5.D — Notation, Transcription & Theory Helpers

Take what the user transcribes and help them write it down.

### 5.48 Chord chart builder synced to timeline
**Why:** As a user identifies chords, they should be able to type them at the right timestamp and build a chord chart that scrolls under the playhead.

**How:** Click on timeline → add a chord marker → type "Cmaj7". Export as text/PDF.

### 5.49 Roman numeral / Nashville Number analysis
**Why:** Once a key (§5.19) and chords (§5.48 or §5.20) are known, computing function (I, IV, V, vi, etc.) is free — and a powerful teaching tool. "Oh, every chorus is the same 1-5-6-4 progression."

### 5.50 Scale highlighter on the piano
**Why:** Once a key is known, gray out non-scale piano keys (or color-code chord tones). Beginner shortcut to "what notes work here".

### 5.51 Mode suggestion
**Why:** "It feels like C major but something's odd" — likely C Lydian. Auto-suggest modes based on the chromagram emphasis.

### 5.52 Lyrics import + sync (.lrc support)
**Why:** Karaoke-aligned lyrics double as section markers and as a memorization aid. Many .lrc files exist online for popular songs.

**How:** Drag-and-drop .lrc, or paste content. Render as a scrolling lyric line under the waveform with the active line highlighted.

### 5.53 Auto-import YouTube captions as lyrics
**Why:** When .lrc isn't available, YouTube's auto-generated captions often are. Free, usually decent quality for songs that have official subs.

**How:** `yt-dlp` already extracts captions (`--write-auto-subs`). Pass them through to the client as WebVTT.

### 5.54 Solfege / movable-do display
**Why:** Many classical/choral students think in do-re-mi, not letters. Toggle: show as letters, solfege, or scale-degree numbers.

### 5.55 Color-coded note system (Boomwhackers / chroma)
**Why:** A growing chunk of music learners (Synthesia generation, piano roll videos) think in colors. C=red, D=orange, etc. Apply consistent coloring to piano keys, pitch overlay, chord pills.

### 5.56 Cadence detection / phrase boundary markers
**Why:** "Where does the phrase end?" is half of musical understanding. Detect cadences (V→I, IV→I) and mark them on the timeline.

### 5.57 Export loop as standalone audio file
**Why:** Practice the looped 8 bars on a phone, or on a guitar amp's aux input. Currently you can download the whole 10-minute audio; the loop is gone.

**How:** Web Audio offline render of the selected region → encode mp3 client-side (lamejs) → download.

### 5.58 Export loop as MIDI (from detected pitches)
**Why:** Generate a starting MIDI transcription that the user can clean up in their DAW. Even if it's 70% accurate, it saves an hour of typing notes.

**How:** Onset detection + pitch detection → write a basic MIDI file. Probably monophonic-only at first.

---

### 5.E — Reference Instruments

Beyond the existing piano.

### 5.59 Guitar fretboard view
**Why:** Most ear-trainers are guitarists. A piano is the wrong reference instrument for them. A fretboard with hover-to-hear and "show this scale" lighting up is far more useful.

**How:** SVG fretboard. Reuse the existing chromatic samples; pitch-shift them per fret position (or use a small guitar sample set).

### 5.60 Bass fretboard
**Why:** Same reason. 4-string standard tuning, optional 5-string.

### 5.61 Multiple piano sample sets
**Why:** Current samples are short and ringy. Offer a Steinway grand, a Rhodes EP, a synth pad — same notes, different timbres. Helpful for matching to the source recording.

### 5.62 Velocity / sustain on the piano
**Why:** Single-velocity samples sound robotic. Multi-velocity sampling and a sustain pedal toggle (`Shift` key while playing?) make the reference instrument musical.

### 5.63 Drum kit / pattern player
**Why:** Practice a guitar lick with a drum loop running underneath at the detected BPM. Adds groove context.

**How:** A few preset patterns (rock, jazz, funk, swing) at the detected BPM. Volume mixer alongside main audio.

### 5.64 Chord-strum reference
**Why:** Click a chord, hear the *strummed* version on guitar (not the broken piano arpeggio). For checking "is this Cmaj7 or Cadd9?" by sound.

---

### 5.F — Recording & Play-Along

Loopretto is currently listen-only. Adding "play along" is a big step up.

### 5.65 Record yourself over the loop
**Why:** Self-listening is the #1 ear-training technique that nobody does because setup is annoying. One button "record this take" + automatic save makes it frictionless.

**How:** `getUserMedia` + `MediaRecorder`. Save the WAV under the song in `localStorage` or IndexedDB.

### 5.66 A/B compare your take vs the original
**Why:** After recording (§5.65), instantly toggle between source and your take. The fastest possible feedback loop.

**How:** Two synchronized WaveSurfer instances + a "press T to toggle source" key.

### 5.67 Visual overlay: your pitch curve vs the source
**Why:** See if you're playing in tune, on time. Two pitch contours layered (§5.24) makes mistakes blindingly obvious.

### 5.68 Click-track to recording
**Why:** Recording without a click means you'll drift. Bake the metronome (§5.29) into the practice flow.

### 5.69 Latency calibration wizard
**Why:** Web audio latency varies wildly per device. A one-time calibration ("tap when you hear the click") aligns your recording for accurate compare.

### 5.70 Save / organize takes per song
**Why:** "Show me my best take from last week."

**How:** IndexedDB. List takes sorted by date. Star favorites.

---

### 5.G — Ear-Training Modes (the explicit kind)

Direct ear training, not just "practice with audio".

### 5.71 Interval ear training quiz
**Why:** Recognizing intervals is the foundation skill. A built-in "play interval, identify it" mode using the existing piano samples is essentially free.

**How:** Random two-note prompt → user clicks the interval name → score over time. Difficulty: ascending only → both directions → harmonic (simultaneous).

### 5.72 Chord-quality recognition quiz
**Why:** "Is that major, minor, dim, dominant 7?" Same UI as 5.71, different content.

### 5.73 Scale degree recognition (with drone)
**Why:** Played under a tonic drone (§5.37), recognize "that note was the 3rd". The single most carryover-to-real-music ear skill.

### 5.74 Chord progression dictation
**Why:** Play a 4-chord progression in C → user fills it in. Builds the skill of hearing roman numerals (§5.49).

### 5.75 Rhythm dictation
**Why:** Beat-grid + claps → user reproduces the rhythm by tapping. Often the bottleneck for transcription is rhythm, not pitch.

### 5.76 Melodic dictation
**Why:** Hear a short melody → recreate it on the on-screen piano. Difficulty scales with note count and range.

### 5.77 "Find the chord in this song" challenge mode
**Why:** Real-world transcription practice — using the user's own loaded YouTube song. App highlights a measure, user guesses the chord, app reveals what the detector thinks. Gamifies §5.20.

### 5.78 Progress tracking + streaks across all quiz modes
**Why:** Duolingo-style daily streaks turn ear training into a habit.

---

### 5.H — Source Integration & Discovery

Where the audio comes from.

### 5.79 Beyond YouTube — SoundCloud, Bandcamp, direct mp3 URLs
**Why:** yt-dlp supports all of these already. The validation regex (`app.py:35`) is the only blocker.

**How:** Loosen the regex; let yt-dlp's extractor list handle it. Maintain an allowlist of supported hosts.

### 5.80 YouTube chapters as default regions
**Why:** Many tutorials and live recordings have chapters. Pre-populate them as named regions ("Intro", "Solo", "Outro").

**How:** yt-dlp returns `chapters` in `info`. Send to client; create regions on load.

### 5.81 In-app YouTube search
**Why:** Avoid the context switch of opening YouTube, copying URL, pasting. Especially valuable on tablets.

**How:** YouTube Data API (50k free queries/day on a free Google Cloud project). Show top 5 results, click to load.

### 5.82 Recently loaded / favorites quick-switcher
**Why:** Users often bounce between 2-3 songs in a session. `Cmd+K` style quick switcher beats re-pasting URLs.

### 5.83 Tagging songs (genre / difficulty / instrument)
**Why:** "Show me all my unfinished jazz transcriptions." Builds a personal library.

### 5.84 Setlists / practice playlists
**Why:** Daily warmups: a fixed list of 5 songs to cycle through.

### 5.85 Auto-skip silence / leading countdown
**Why:** Many tutorial videos have 30-second intros. Detect leading silence/talk → set the default playhead to where actual audio starts.

**How:** RMS scan; jump to first non-silent frame.

---

### 5.I — AI / ML-Powered

Heavier features that imply server compute or a paid tier.

### 5.86 Stem separation (vocals / drums / bass / other)
**Why:** This is §5.8 expanded — the single highest-value paid feature. Moises makes a real business on this alone.

**How:** Demucs or Spleeter on a GPU machine. Cost-control: cache stems per video ID; only re-run if a user actually requests it; gate behind a quota.

### 5.87 AI chord identification with confidence scores
**Why:** §5.20's template matching gets ~80% of pop songs right; a small ML model (e.g. MusicNN, Chordino) gets 92%+ including 7ths, slash chords, and modal interchange.

**How:** ONNX.js in-browser for small models; server inference for larger ones.

### 5.88 Auto-generated tab (guitar / bass)
**Why:** "Here's a starting-point tab" is huge for guitarists. Even if imperfect, it saves 90% of typing.

**How:** From pitch sequence (§5.58) → string/fret assignment with a cost function (minimize hand movement, prefer open strings on chords).

### 5.89 "Explain this phrase" — AI musicologist
**Why:** A Claude-powered button: select a region, get back "This is a ii-V-I in F major with a tritone substitution on the V". Educational gold.

**How:** Send detected pitches/chords/key to an LLM with a music-theory system prompt. Cache responses per region hash.

### 5.90 Voice-to-MIDI ("hum it, transcribe it")
**Why:** Sometimes you remember a melody but can't find the song. Hum into the mic → app generates MIDI + searches for similar songs.

### 5.91 Style suggestions / similar songs
**Why:** "You're learning Wonderwall — here are 5 songs with the same chord progression to practice next."

### 5.92 Difficulty rating per song
**Why:** A trained model rates a transcription as beginner/intermediate/advanced based on harmonic and rhythmic complexity. Helps users pick what to practice next.

---

### 5.J — Sharing & Community

Currently single-user. These add network effects.

### 5.93 Public loop library
**Why:** "How do I play the solo at 1:32 of X?" → someone else already transcribed it. Shared loops with annotations + chord charts.

**How:** Opt-in publish. Crawled, but moderated for copyright on the *annotations* (the audio itself is still YouTube's).

### 5.94 Comments on specific timestamps
**Why:** SoundCloud-style "the bend at 0:47 is killer". Teaching gold for instructors leaving notes for students.

### 5.95 Embed widget for blogs / Substacks
**Why:** Music teachers want to embed "click here to hear this exact loop slowed to 60%". An `<iframe>` embed (read-only loop player) is high-leverage growth.

### 5.96 Teacher → student loop sharing
**Why:** Teachers can drop a loop URL into a lesson plan and the student lands in the exact spot at the exact speed.

### 5.97 Follow other users / featured transcribers
**Why:** Discover advanced users' libraries.

---

### 5.K — Workflow & Quality of Life

Small but high-value polish.

### 5.98 Set page title to loaded track name
**Why:** Tabs are findable. Currently every tab is "Loopretto".

### 5.99 Restore last session on page load
**Why:** Browser crashed mid-practice → reopen the tab → same song, same loop, same speed.

**How:** Persist current state in `localStorage` every few seconds.

### 5.100 Per-song persistent settings (speed, zoom, loop)
**Why:** Coming back to a song should restore everything you set last time, including its loops.

### 5.101 Cross-device sync via account (optional)
**Why:** Practice on the laptop, continue on the tablet. Once accounts exist (likely needed for §5.86), sync everything.

### 5.102 Export everything (loops + annotations + recordings) per song
**Why:** Zip download. User-owned data, escapable from the app.

### 5.103 Undo / redo for loop edits
**Why:** Accidentally drag a region off-screen → currently lost.

### 5.104 Numeric input for loop start/end timestamps
**Why:** Type "1:23.500" directly instead of dragging — precision down to the frame.

### 5.105 Zoom-to-loop button
**Why:** One click to fill the visible waveform with just the looped region. Already half-implemented via the slider; a one-click shortcut is the right UX.

### 5.106 Foot pedal support (Web HID)
**Why:** Hands are busy playing. A USB foot pedal (mapped to play/pause/restart loop) is the killer accessory for guitarists.

**How:** Web HID API + a "press pedal to assign" wizard.

### 5.107 Custom keyboard shortcuts
**Why:** Power users want their own bindings. Especially loop-relative ones: "loop +1 bar", "halve loop length".

### 5.108 Color-blind / dyslexia-friendly preset themes
**Why:** Accessibility for a subset of users — useful and low-cost.

### 5.109 Color-coded loop regions (multiple colors for multiple loops)
**Why:** Once §5.3 exists, distinguishing the saved loops by color is the cleanest visual.

---

## 6. UX & Accessibility

### 6.1 Replace `alert()` with toast notifications
**Where:** `static/js/app.js:277, 329, 388, 414`.

**Problem:** `alert()` blocks the main thread, is ugly, and on mobile is jarring. A toast component is ~20 lines.

### 6.2 Focused button outlines are aggressively blurred
**Where:** Many handlers call `document.activeElement && document.activeElement.blur()` after a click.

**Problem:** This is hostile to keyboard users — they need a visible focus ring. The pattern was likely added because the focus ring on the play button looked bad after Space was pressed. Solve with `:focus-visible` instead: focus styles only on keyboard nav.

### 6.3 `user-select: none` on body
**Where:** `static/css/styles.css:85`.

**Problem:** Users can't copy the video title, can't select the URL they pasted. Aggressive global rule.

**Fix:** Apply `user-select: none` only to buttons / waveform / piano. Allow selection on titles and the URL input.

### 6.4 No ARIA labels on most interactive elements
**Problem:** Loop button, speed buttons, zoom slider — none have screen-reader-friendly labels.

**Fix:** Add `aria-label`, `aria-pressed` (for loop toggle), `role="slider"` semantics.

### 6.5 No reduced-motion support
**Fix:** `@media (prefers-reduced-motion: reduce) { ... }` to disable wave animations.

### 6.6 Loading state is binary (off → spinner)
**Problem:** No progress feedback during yt-dlp download. Users wait 5-30s with no idea what's happening.

**Fix:** Stream progress from the server (Server-Sent Events) or at least show staged messages ("Fetching info…", "Downloading audio…", "Decoding…").

### 6.7 Disabled buttons give no hint why
**Problem:** Play, loop, speed are disabled before audio loads — but a new user doesn't know that's expected.

**Fix:** Add a tooltip ("Load audio first") on hover.

### 6.8 "Change" button has no confirmation
**Where:** `static/js/app.js:351-367`.

**Problem:** Misclicking the refresh icon wipes the loaded track and the loop region with no undo.

**Fix:** Either confirm if a loop region exists, or make the action undoable.

### 6.9 Suggested chips overwrite user-typed URL silently
**Where:** `static/js/app.js:344-349`.

**Problem:** A user halfway through pasting their own URL clicks a chip by accident and loses their input.

**Fix:** Only replace if the input is empty / unchanged from default.

### 6.10 Page title doesn't update with loaded track
**Problem:** Browser tab still says "Loopretto" after loading "Autumn Leaves".

**Fix:** `document.title = data.title ? \`${data.title} — Loopretto\` : 'Loopretto'`.

---

## 7. Deployment & Ops

### 7.1 No `.dockerignore`
**Fix:** See §1.7. Should also exclude `audio.*` files that get baked into the image (currently your repo has `audio.mp4` 737KB committed-but-gitignored which still ends up in Docker context).

### 7.2 Single-stage Docker build
**Where:** `Dockerfile`.

**Fix:** Use a multi-stage build to drop pip cache and build deps:
```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
COPY . /app
WORKDIR /app
ENV PATH=/root/.local/bin:$PATH
USER 10001
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
```

### 7.3 No fly.io persistent volume
**Problem:** If you add Redis-backed rate limiting or any caching, you need persistent state.

**Fix:** Either Fly volume (`[[mounts]]` in fly.toml) or external Redis (Upstash).

### 7.4 Single instance, no autoscaling
**Fix:** `fly scale count 2` + ensure the app is stateless (per §1.1 fix). Add `min_machines_running = 1` to avoid cold starts.

### 7.5 No log aggregation
**Fix:** Fly has logs in the dashboard, but for any real diagnostic work, ship logs to Logtail / Axiom / Better Stack.

### 7.6 `fly.toml` is in legacy v1 format
**Where:** `fly.toml` uses `[[services]]` not `[http_service]`.

**Fix:** Migrate to the v2 schema:
```toml
[http_service]
  internal_port = 5000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
```
This unlocks scale-to-zero for cost savings on a side project.

### 7.7 `audio.info.json`, `audio.mp4`, `audio.webp` are committed to the repo
**Where:** Repo root.

**Fix:** Remove with `git rm`. Add `audio.mp4` to `.gitignore` (currently only `m4a/webm/mp3/opus` listed).

---

## 8. Developer Experience

### 8.1 No `README.md` section for contributors
**Fix:** Add a "Development" section: how to run with hot reload, how to test changes, how to add a theme, how to deploy.

### 8.2 No `.editorconfig`
**Fix:** Ship one to enforce LF / 2-space indents.

### 8.3 yt-dlp pinned to a specific version
**Where:** `requirements.txt:21` — `yt-dlp==2026.02.21`.

**Tradeoff:** Pinning is reproducible but yt-dlp regularly needs updates when YouTube changes its extractor. A pin from three months ago = a broken app.

**Fix:** Pin a minimum version (`yt-dlp>=2026.02.21,<2027`) or set up Dependabot/Renovate to bump it automatically with CI validation.

### 8.4 `requirements.txt` has many transitive deps
**Where:** Many entries (`blinker`, `colorama`, `click`, etc.) are transitives of Flask/yt-dlp.

**Fix:** Top-level deps only in the manifest; lockfile separate. `uv pip compile` or `pip-tools`.

### 8.5 No env file / dotenv support
**Fix:** Add `python-dotenv` and a `.env.example` listing `PORT`, `APP_SECRET`, `REDIS_URL`, etc.

---

## 9. Priority Roadmap

A suggested order of operations, optimizing for the smallest blast radius first:

**Week 1 — Stop the bleeding (correctness)**
1. §1.1 — Per-request unique filenames (blocks scaling beyond 1 user)
2. §1.2 — Fix the auto-delete race
3. §1.3 — Cleanup all `audio.*` extensions
4. §1.8 — Delete `app copy.js`
5. §1.7 — Add `.dockerignore`
6. §1.4 — Move to Gunicorn

**Week 2 — Security**
7. §2.1 — Redis-backed rate limiter
8. §2.2 — CORS allowlist + reactivate secret gate (or accept it's a single-user app)
9. §2.9 — SRI on CDN scripts
10. §2.10 — Drop Tailwind CDN
11. §7.6 — fly.toml v2 + force_https

**Week 3 — Quality**
12. §4.4 — Set up pytest + first 5 tests (URL validation, path traversal, rate limit)
13. §4.5 — Ruff + Prettier + pre-commit
14. §4.6 — GitHub Actions CI
15. §4.9 — Health check endpoint

**Week 4 — User-visible polish**
16. §6.1 — Toast notifications instead of alerts
17. §6.2 — Fix `:focus-visible`
18. §6.6 — Loading progress states
19. §1.6 — Don't pre-fill the input
20. §3.2 — Migrate to WaveSurfer v7

**Month 2 — New features**
21. §5.2 — Shareable loop URLs (probably 2-3 hours, huge UX win)
22. §5.3 — Saved loops in localStorage
23. §5.4 — Drag-and-drop file support
24. §5.1 — Independent pitch shifting (requires v7 + WebAudio)

**Ongoing**
25. §3.1 — Streaming audio path
26. §4.1 — Refactor backend into modules
27. §4.2 — Decide on React redesign or commit to vanilla cleanup

---

## 10. Open Questions to Answer Before Starting

1. **Is this a personal tool or a public service?** Single-user assumptions (one shared `audio.m4a`, in-memory rate limiting, no CSRF) are fine for the former and broken for the latter. The current Fly deployment suggests the latter — but the code is built for the former.
2. **Is the `New design/` rewrite happening?** If yes, much of §4.2's frontend cleanup work duplicates effort. If no, delete the folder.
3. **Is monetization on the table?** It changes whether Spleeter-style features (§5.8) are worth the cost.
4. **What's the target instance size on Fly.io?** Determines whether WebAudio pitch shifting on the server, or vocal isolation, are feasible.
