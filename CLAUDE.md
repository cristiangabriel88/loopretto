# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Loopretto** - a local Flask app that downloads a YouTube track via `yt-dlp` and serves a single-page web UI for looping sections of it (waveform via WaveSurfer.js, reference piano via mp3 samples). Designed to be run on the user's own machine; no accounts, no cloud storage.

> **Local-only, by design - this will never be deployed.** It's a personal tool the owner runs on their own machine; deploying is intentionally off the table. Downloads work **anonymously - no login, no cookies** - by pointing yt-dlp at alternate YouTube *player clients* that aren't behind the "confirm you're not a bot" wall (see "YouTube player client" below). So Loopretto stays a **single-user, localhost app**.
>
> Because of that, its single-user assumptions are **permanent, not interim**: in-process rate limiting, no CSRF/CORS gate, the dormant secret gate, a single reused working audio file, the dev server, and so on are all fine and intended. **Do not add "production hardening"** - Redis-backed limiting, CORS/CSRF, gunicorn/waitress, HTTPS/HSTS, multi-worker concurrency, autoscaling, etc. are out of scope and wasted effort here. Keep every change aligned with the local, single-user model.

## Common commands

```bash
# Run locally (Mac/Linux)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py                              # serves on http://localhost:5000

# Run locally (Windows, user-facing) - the primary way it's run
run.bat                                    # creates .venv, installs deps, opens browser

# Override port
PORT=8080 python app.py                    # or set PORT=8080 on Windows
```

There is no deploy step - the app is always run on `localhost` (see the note above).

There are no tests, linters, or build steps configured. The frontend is vanilla JS + vendored WaveSurfer (`static/js/vendor/`, pinned 7.12.7); there is no bundler.

**Dependencies:** `requirements.in` is the manifest (4 direct deps: Flask, Flask-Limiter, imageio-ffmpeg, yt-dlp); `requirements.txt` is the pinned lockfile that `run.bat` installs. Regenerate the lock with `uv pip compile requirements.in -o requirements.txt`. `yt-dlp` is deliberately a **range** (`>=2026.02.21,<2027`) in both - a stale pin breaks downloads when YouTube changes extractors. `.github/dependabot.yml` bumps deps weekly.

## Architecture

### Backend (`loopretto/` package, app factory)

`app.py` at the repo root is a thin entrypoint: `app = create_app()` then `app.run(...)`. `run.bat` and `python app.py` use this. The real code is a small package:

```
loopretto/
  __init__.py        # create_app() factory: Flask app, blueprints, limiter, static cache
  config.py          # all tunables (env-overridable); YOUTUBE_PATTERN, caps, AUDIO_DIR, PRACTICE_JOURNAL_DIR, rate limits
  extensions.py      # Flask-Limiter instance (memory storage)
  routes/
    pages.py         # GET /, /howto, /about
    audio.py         # POST /get_audio, GET /audio/<filename>
    journal.py       # POST /save_journal
  services/
    downloader.py    # yt-dlp wrapper + YouTube URL validation + ffmpeg location
    storage.py       # audio-file path/validation/cleanup helpers
    journal_export.py # writes practice-journal.md + practice-data.json to Documents
```

- `POST /get_audio` - accepts `{url}`, validates via `is_supported_url()` (an **allowlist of hosts** - `Config.SUPPORTED_HOSTS`: YouTube/SoundCloud/Bandcamp/Vimeo + subdomains - or a direct audio-file URL, capped at `MAX_URL_LENGTH`; yt-dlp's extractors handle the rest), removes any prior `audio.*` file (glob, so thumbnails/`.info.json` go too), then runs `yt-dlp` with `download_sections` (leading 10 min) and `max_filesize` (30 MB). Returns `{title, thumbnail, audio_file}`. Failures raise `DownloadError`, are logged via `logger.exception`, and map to a 4xx/5xx JSON error. Rate-limited to **5/min per IP** plus global defaults (3/min, 10/hour, 20/day) via `Flask-Limiter` (memory backend - resets on restart, not shared across workers).
- `GET /audio/<filename>` - serves the working file with `conditional=True` (HTTP range requests) so the browser **streams** it; the filename is validated against `^audio\.[a-z0-9]+$`. Because the filename is reused across tracks, this response is forced to `Cache-Control: no-store`. There is **no per-request deletion timer** - the file simply lives until the next track is downloaded (which clears it).
- `POST /save_journal` - accepts `{markdown, data}` (both strings: the frontend-rendered Markdown and the raw `loopretto.practice` JSON string), validated for type + a `MAX_JOURNAL_BYTES` size cap, and writes `practice-journal.md` + `practice-data.json` (re-dumped pretty-printed) to `Config.PRACTICE_JOURNAL_DIR` (default `~/Documents/Practice Journal`, created on first save; env-overridable). The browser owns the data; this route is a dumb file writer that's intentionally **not** rate-limited (local single-user). Errors map to a 400/500 JSON error via `logger.exception`. Drives the opt-in "Save journal to Documents" setting (see frontend).
- `GET /`, `/howto`, `/about` - render the corresponding Jinja templates.

**YouTube player client (how anonymous downloads work).** YouTube gates its default `web` client behind a "confirm you're not a bot" wall. `_ydl_opts()` sets `extractor_args.youtube.player_client` to `Config.YOUTUBE_PLAYER_CLIENTS` (default `web_safari,android_vr,tv,android,ios`) - these return formats with **no login and no cookies**, so downloads just work. yt-dlp aggregates formats across the listed clients, so include a few for resilience; override via the `YOUTUBE_PLAYER_CLIENTS` env (comma list) if YouTube shifts which ones pass. If they ever break, the symptom is the bot-check error again - try other clients first. Cookies are **optional and off by default** (`COOKIES_FROM_BROWSER` / `COOKIES_FILE`), only for the rare age-restricted/private video; on Windows, Chrome/Edge cookie DBs can't be read while those browsers run, so prefer Firefox or a `cookies.txt`. `_friendly_error` maps yt-dlp failures to short user messages.

`AUDIO_DIR` defaults to an **absolute** path (the repo root, computed in `config.py`). This matters: the Flask app's `root_path` is now the package dir, so a relative `"."` would resolve there and break `send_from_directory`. Keep `AUDIO_DIR` absolute.

`imageio-ffmpeg` provides a bundled `ffmpeg` so users don't need it system-wide (`FFMPEG_LOCATION` points at it). `REQUIRE_SECRET`/`APP_SECRET` exist but `REQUIRE_SECRET` defaults `False` - the secret gate is dormant and stays that way (local only).

Static assets are cached for **1 year** (`SEND_FILE_MAX_AGE_DEFAULT`, set in `create_app`). Assets are not content-hashed, so **hard-refresh after editing CSS/JS** during development, or run with `STATIC_CACHE_SECONDS=0`.

### Frontend (`static/js/*.js`, `templates/index.html`, `static/css/styles.css`)

Single-page app, no framework, no bundler. **WaveSurfer.js v7** is **vendored** in `static/js/vendor/` (pinned 7.12.7: `wavesurfer.min.js` + the `wavesurfer.timeline.min.js` / `wavesurfer.regions.min.js` UMD plugin builds exposing `WaveSurfer.Timeline` / `WaveSurfer.Regions`) - no CDN at launch, so the app works offline after the first track. Re-vendor by curling the same paths from `unpkg.com/wavesurfer.js@<version>/dist/...`. Four `defer`'d scripts load in order - three feature modules expose globals, then `app.js` orchestrates everything:

- `pitch-shifter.js` → `window.Jungle` - tempo-preserving pitch shift (delay-line + crossfade, works on a live stream).
- `pitch-detect.js` → `window.PitchDetect` - `autoCorrelate()` + `freqToNote()` (ACF pitch detection).
- `metronome.js` → `window.Metronome` - look-ahead scheduler, tap-tempo, accented downbeat.
- `practice.js` → `window.PracticeStore` - localStorage-backed per-song time/rep log + daily totals (single key `loopretto.practice`).
- `setlists.js` → `window.SetlistStore` - localStorage named song-lists (key `loopretto.setlists`); only URL-based songs (a dropped file has no durable URL).
- `app.js` - DOM wiring, WaveSurfer, the Web Audio graph, and all the state machines.

State machines in `app.js`:

1. **Load/unload lifecycle**: two sources feed the same player. `loadAudio()` POSTs to `/get_audio` then `wavesurfer.load('/audio/<file>?t=<ts>')` (streamed directly, no Blob round-trip; `?t=` defeats the reused filename). `loadFile()` handles drag-and-drop / file-picker input by `URL.createObjectURL`-ing the `File` and loading it - **no server round-trip at all**. `revealPlayer()` is the shared "show the UI" step; `addNewAudioButton` tears everything down (including metronome/notes/transpose) without reloading. `sourceType` (`"youtube"|"file"`) decides how Download behaves.
2. **Loop region**: clicking the waveform fires v7's `interaction` event, setting `masterClickTime`/`loopStart`; the Loop button creates a 5-second `wsRegions.addRegion(...)`. v7 regions have **no built-in `loop` option** - looping is manual via the `region-out` event (jump back to `region.start`). `region-updated` syncs drag/resize back to module state.
3. **Theme**: `body.theme-light | theme-dim | theme-dark` (default `theme-dim`), cycled via the menu, persisted in `localStorage` (`loopretto.themeIdx`). Waveform colors re-apply via `reapplyWaveColors()` → `wavesurfer.setOptions({...})`; new themable colors must route through `getWaveColors()`.

**Audio graph (Web Audio):** the app owns the `<audio>` element (`new Audio()`, `preservesPitch = true`) and passes it to WaveSurfer via the `media` option. `ensureAudioGraph()` (called on any first play/toggle gesture) lazily builds it once: `MediaElementSource → [Jungle pitch shifter | direct] → channelIn → [channel-isolation stage] → channelOut → fxIn → [EQ → band-pass → compressor] → fxOut → masterGain → destination`, with an `AnalyserNode` tapping `masterGain` for note detection, and the `Metronome` attached to the same context (clicks go straight to `destination`). The graph survives across loads because we own the element. `routePitch()` bypasses the pitch shifter at 0 semitones (clean audio) and inserts it otherwise (its output target is `channelIn`, not master) - call it whenever `semitoneOffset` changes. `applyChannelMode()` rewires only the `channelIn → channelOut` segment; `rebuildFxChain()` rewires only the `fxIn → fxOut` segment.

**Features wired on top of the graph:**
- **Transpose (§5.1)**: "Key" −/+ buttons set `semitoneOffset` (−12…+12) → `Jungle.setPitchOffset(semitones/12)`. Tempo is unchanged.
- **Channel isolation / karaoke (§4.C)**: the "Audio" segmented control (Stereo / L / R / Karaoke) calls `applyChannelMode()`, which rebuilds a `ChannelSplitter`→(gains)→`ChannelMerger` sub-graph between `channelIn` and `channelOut`. "Karaoke" plays **L−R** (the mid-side difference) to cancel center-panned vocals. Resets to Stereo on each load/teardown (`resetChannelMode()`). Because the metronome/drone bypass `masterGain` (and the whole channel/FX stages), they're unaffected.
- **Sound FX panel (§4.C)**: the "Sound" toggle opens a panel with three effects living in the FX segment (`fxIn → fxOut`); persistent nodes are wired in series by `rebuildFxChain()` only when active (toggles reconnect; sliders update `AudioParam`s live). (a) **Parametric EQ** - a 5-band `BiquadFilterNode` chain (80/250/1k/3.5k/12k), preset gains in `EQ_PRESETS`; "off" bypasses it. (b) **Band-pass spotlight** - one band-pass `BiquadFilterNode` with log-mapped Freq/Width sliders. (c) **Punch** - a `DynamicsCompressorNode` + make-up gain. `resetFx()` clears all three on load/teardown.
- **Note overlay (§5.6)**: the "Notes" toggle runs a `requestAnimationFrame` loop reading the analyser → `autoCorrelate` → live note pill (name + cents) plus a rolling strip of recently-detected stable notes.
- **Metronome (§5.9)**: the "Metronome" panel (Start/Stop, BPM ±, Tap tempo, beats-per-bar, visual beat dots). Beats-per-bar of **1** means a plain, un-accented click (no downbeat) - every tick is identical; values >1 accent beat 0. The click sample is **`static/sounds/click.wav`**, passed to the client via the panel's `data-click-src` (`url_for`). It's a generated placeholder - drop in any WAV at that path to replace it.
- **Practice panel** (the "Practice" toggle) bundles several features, all keyed to the current song (`currentSongId` - `yt:<id>` or `file:<name>`):
  - **Loop reps (§5.31)**: incremented in the `region-out` loop handler (`onLoopRestart`); shown as a `× N` badge by the loop tag and reset on demand (daily total persists).
  - **Practice session + journal (§5.32)**: a **manual wall-clock stopwatch** the user starts/stops (`startSession`/`stopSession`/`newSession`), not a playback clock - it runs whether the track is playing or paused, so working a part out on the instrument counts. `bankSessionSegment()` credits elapsed time to the current song via `PracticeStore.addTime` (which also bumps the per-day total, so daily = sum of segments, no double counting); the segment is re-marked on each song change (`beginSong`) and banked on `beforeunload`. On Stop a session entry (time, reps, optional **notes**, pomodoros) is recorded via `PracticeStore.addSession`; the journal lists per-song aggregates plus recent sessions. Play/pause no longer banks time. The session survives "Change track".
  - **Daily goal + streak (§5.33)**: `PracticeStore.getGoal`/`setGoal` (default 30 min) drives a progress bar against today's total; `PracticeStore.streak()` counts consecutive days with logged practice (anchored on yesterday if today has none yet).
  - **Pomodoro (§5.33)**: independent focus/break countdown (`startPomodoro`/`pomoTransition`), default 25/5 min; each phase switch fires `playChime()` (a short sine ping straight to `audioCtx.destination`, same bypass as the metronome/drone - no asset, no notification permission) and a toast.
  - **Memorize mode (§5.34)**: each loop restart steps `masterGain` down ~3 dB (`MEM_LEVELS`) until silent, then back to full - fades only the track (metronome/drone bypass `masterGain`).
  - **Save journal to Documents**: an opt-in toggle (single flag `loopretto.journalSync`) mirrored in **two** places - the burger-menu switch (`#journal-sync-toggle`) and the Practice-panel "Journal file" pill (`#journal-sync-pill`); `applyJournalSync()` keeps both in sync. While on, `saveJournalToDisk()` POSTs to `/save_journal` on every session **Stop** (silent) and on `beforeunload` (via `navigator.sendBeacon`, since `fetch` won't complete during unload); a **Save now** button (`#journal-save-now`) always writes on demand. `buildJournalMarkdown()` renders the human-readable journal (mirrors `renderJournal`, reuses `fmtClock`/`PracticeStore` getters); the raw `loopretto.practice` string is sent alongside as the JSON backup. The browser does the rendering - the backend just writes the two files.
- **Drone (§5.37)**: its own top-level panel (the "Drone" toggle button next to Sound/Practice/Metronome/Piano, panel `#drone-body`), **not** part of the Practice panel. Up to three **tanpura-like** voices (note + octave, optional octave-below). Each voice is two slightly detuned oscillators driven by a shared, lazily-built `PeriodicWave` (`tanpuraWave()` - strong fundamental + a resonant "jivari" band of upper harmonics) feeding a per-voice gain (the pluck envelope). All voices feed a shared bus: a slowly LFO-swept peaking filter (the jivari shimmer) → warmth lowpass → Vol gain → `destination`, **bypassing `masterGain`** so memorize/transpose don't affect the reference pitch. The **Pluck** toggle (`#drone-pluck`, default on) runs a repeating swell-and-decay envelope per voice (`pluckVoice` on a `setInterval`, `PLUCK_PERIOD`), staggered across active voices via `restaggerPlucks()` so they stroke in sequence; off = a steady sustained tone. `setDrone(false)` is the teardown hook (clears each voice's pluck timer).
- **Fretboard**: a top-level panel (`#fretboard-body`, the "Fretboard" tab) showing an interactive **guitar/bass neck** built entirely in `app.js` (`renderFretboard()`) from one shared CSS grid (`--fb-cols`) reused by the fret-number row, inlay overlay, and per-string rows so columns line up. Rows render high-string-on-top → **thickest (low) string on the bottom** (tab/player view); fret wires + nut are inset box-shadows on the cells. Clicking a position plays the note and lights up **every position sharing that pitch class**. Guitar/Bass segmented switch + a "Labels" toggle persist to `localStorage` (`loopretto.fretboard`). **Note playback** prefers real recorded samples: a few anchor `.mp3`s per instrument live in `static/instruments/{guitar,bass}/` (CC-BY, see `static/instruments/CREDITS.txt`), decoded lazily (`fbLoadSamples`, warmed on panel-open / instrument-switch) and pitch-shifted to the nearest anchor via `playbackRate` (`fbPluckSample`); a Karplus-Strong synth (`fbPluckSynth`) is the fallback until a kit decodes. Like the metronome/drone, it routes straight to `destination` (bypasses `masterGain`).

**Sources, sessions, setlists & UX:**
- **Sources (§5.79)**: any host the backend allowlists, plus dropped local files. `sourceType` is `"youtube"` (= any server-downloaded URL source) or `"file"`; `currentSourceUrl` holds the actual URL (null for files). Local files can't be saved to setlists or restored on reload (no durable URL).
- **Setlists (§5.84)**: `SetlistStore` named lists shown in the loading view (click a song to load it); the "Save" button in the player opens a popover to add the current song to / create a setlist.
- **Restore last session (§5.99)**: `saveSession()` writes `{url,title,loop,speed,pitch,zoom}` to `loopretto.session` every 5s + on `beforeunload` (URL sources only). On load a "Resume" banner offers to reload it; restore is applied via `pendingRestore` after `wavesurfer.load()` resolves. It does **not** auto-download - the user clicks Resume (avoids surprise re-fetches / rate limits).
- **UX:** staged load labels (§6.6, timed stages then a real "Decoding…"); `user-select` scoped to chrome only (§6.3); disabled controls use `pointer-events:none` so a hover surfaces the "Load a track first" tooltip on the wrapping element (§6.7, managed in `setHintTitles`); the "Change" button is a click-to-confirm when a loop exists (§6.8).

Speed changes call `setPlaybackRate(rate, true)` (preserve pitch). Wheel-zoom is throttled to one re-render per animation frame. Keyboard: Space = play/pause, ←/→ = 0.5s nudge (`wavesurfer.setTime`), `z x c v b n m` + `s d g h j` = piano keys (inline `<audio>` tags, one per chromatic note of the C3 octave in `static/piano/`; CC-BY samples, see `static/piano/CREDITS.txt`). White keys show only the keyboard-shortcut letter, no note name.

### Templates / styling

All three templates (`index.html`, `howto.html`, `about.html`) share **`static/css/styles.css`** and the same design tokens (oklch theme variables, Space Grotesk / DM Sans / JetBrains Mono). Tailwind has been removed. Content pages use the `.doc-*` classes at the bottom of `styles.css`; they default to `theme-dim`.

### Running it

- `run.bat` - the primary way it's run on Windows; bootstraps `.venv` on first run, installs deps, opens the browser at `localhost:5000`.
- `python app.py` - the Mac/Linux path.

There are **no deploy files** - the old `fly.toml`/`Dockerfile` were removed, since the app is never deployed (deploying breaks YouTube downloads - see the top note). Don't reintroduce them.

## Things to watch when editing

- The served audio file persists until the next download; if you change `AUDIO_DIR`, keep it absolute and consistent between `downloader.py` (yt-dlp `outtmpl`) and `storage.py`/`audio.py` (serving + cleanup).
- WaveSurfer **v7 API differs from v6**: events `timeupdate`/`interaction`/`ready(duration)`, methods `setTime`/`setOptions`, regions via `registerPlugin` + manual loop. Don't reintroduce v6 calls (`addRegion` on the instance, `setWaveColor`, `audioprocess`, `seek`, region `loop: true`).
- `Flask-Limiter`'s memory backend resets on restart and isn't shared across workers - fine for local single-instance use.
- `yt-dlp`'s `download_sections` + `max_filesize` are the only guardrails against large/long downloads - keep them in sync (both live in `config.py`).
- The Web Audio graph creates `MediaElementSource` **once** per element; don't create a second one or playback audio will be lost. Changing transpose calls `mediaSource.disconnect()` + reconnect via `routePitch()` - keep that the only place that rewires the source (it reconnects into `channelIn`, the entry of the channel-isolation stage). Channel-mode changes touch only the `channelIn → channelOut` segment via `applyChannelMode()`; don't rewire the source there.
- The pitch shifter is a live-stream delay-line effect (no full-buffer decode), so it composes with streaming playback but has mild warble at large intervals - that's expected, not a bug. It's bypassed entirely at 0 semitones.
- `static/sounds/click.wav` is a generated placeholder metronome sample; replacing the file (same path) is all that's needed to change the click.
