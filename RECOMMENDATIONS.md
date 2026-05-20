# Loopretto - Ideas, Polish & Next Steps

A fresh, opinionated take on where Loopretto can go. This is a rewrite from scratch: it drops the old deployment/security/ops material (the app is local-only and never deployed, by design) and focuses on what actually moves the needle for the one person who runs it - **look and feel, performance, new features, and quality-of-life**.

Each idea says *what*, *why it matters*, and (where useful) *how* with a code pointer. Nothing here is mandatory. Treat it as a menu.

## The core insight to lean into

Loopretto is a **single-user, localhost, all-in-the-browser** tool. The backend does exactly one thing: hand `yt-dlp` a URL and stream back one audio file. **Every musical feature already runs client-side** - the Web Audio graph, pitch shift, tempo detection, note detection, WAV export, practice logging. That's a superpower, not a limitation:

- New audio features almost never need backend work. Key detection, chord detection, EQ, channel isolation, even in-browser stem separation are all just more Web Audio + a bit of DSP.
- There are no other users to coordinate with, so `localStorage`/IndexedDB is a perfectly good database.
- The only thing that *requires* the network mid-session is the WaveSurfer CDN load (see Performance below). Fix that and the app becomes genuinely offline-capable after the first download.

So the rest of this doc assumes: keep the backend tiny, push everything into the browser, and make the local experience delightful.

---

## ✅ Shipped

Done in the last pass; kept here as a short changelog so the rest of the doc stays a forward-looking backlog.

- **1.1** Wired the `F` focus-mode shortcut - extracted `toggleZen()`, called from both the menu item and a `keydown` `f`/`F` case (works with no track loaded).
- **1.2** Removed the pre-filled URL `value=` so a blank "Load audio" no longer downloads a surprise track.
- **1.3** Replaced every `alert()` with a non-blocking, theme-styled `toast()` helper (queued, auto-dismiss, click-to-close).
- **1.4** Deleted all `blur()`-after-click calls; focus rings now show only for keyboard nav via `:focus-visible`.
- **1.6** Suggestion chips only fill the URL input when it's empty, so a half-typed/pasted URL is never clobbered.
- **2.1** Loop restart now flashes a brief accent wash over the waveform (`.wave-flash`) so the jump-back reads as intentional.
- **2.2** Added an app-wide `@media (prefers-reduced-motion: reduce)` block (quiets the loop-dot/ready pulses and near-zeroes transitions).
- **2.3** ARIA pass: `aria-pressed` on loop/notes/metronome/piano/practice + memorize/drone toggles, `aria-label` on the steppers, `aria-valuetext` on the zoom range.
- **2.4** Added a `?` keyboard-shortcut overlay generated from a single `SHORTCUTS` map (Esc / scrim / × to close); top-bar hint advertises it.
- **2.5** Empty-waveform copy reworded to "Load a track to see the waveform" to match the broadened sources.
- **2.7** Loop-region fill is derived from the accent (`getRegionColor()`) and re-tints live when the theme/accent changes, instead of a hardcoded violet.
- **3.1** Self-hosted WaveSurfer: the three UMD builds are vendored in `static/js/vendor/` (pinned 7.12.7) - no CDN at launch, offline-capable after the first track.
- **3.2** Note-detection autocorrelation is decimated to ~20Hz (every 3rd frame) with a matched decay constant, freeing the main thread during playback.
- **3.3** `decodeCurrentSource()` memoizes the decoded `AudioBuffer` per track (invalidated on teardown/load), so Sync + Export decode once instead of twice.
- **3.4** Trimmed the Google Fonts request to only the weights the CSS uses (Space Grotesk 500/600/700, DM Sans 400/500/600/700, JetBrains Mono 400/500).
- **4.C (done)** Audio manipulation & EQ, all on the channel stage:
  - *Channel isolation + karaoke* - an "Audio" segmented control (Stereo / L / R / Karaoke); a `ChannelSplitter`/`ChannelMerger` stage where "Karaoke" plays L−R to cancel center-panned vocals.
  - *Parametric EQ presets* - a 5-band `BiquadFilterNode` chain (Off / Vocals / Bass focus / High guitar / Drums) in the new "Sound" panel.
  - *Band-pass spotlight* - a single band-pass with draggable Freq + Width sliders to solo a frequency range (e.g. follow the bassline).
  - *Punch (compressor)* - a `DynamicsCompressorNode` + make-up gain so quiet/slowed passages stay audible.
  - All three live in an FX segment (`channelOut → [EQ → band-pass → compressor] → master`), persistent nodes wired in series by `rebuildFxChain()` only when active; sliders update params live. Metronome/drone bypass master, so they're unaffected.
- **4.I (partial)** Zoom-to-loop button: a "fit" icon in the Zoom group sets `wavesurfer.zoom()` so the looped region fills the view, then scrolls it to the left edge. Enabled only while a loop exists.

**Intentionally not done:** the tab title is left as a constant "Loopretto" (it should always read Loopretto, not the track name) - this is wanted behavior, not the "1.5" bug it was once filed as.

---

## 2. Aspect (visual & UI polish)

The design system is already strong - oklch theme tokens, three themes, accent + background pickers, Space Grotesk / DM Sans / JetBrains Mono. The remaining open item:

### 2.6 Tighten mobile / narrow-window layout

The controls row is built for desktop (transport + middle cluster + right cluster on one line). On a phone or a narrow window it will crowd. Even without full touch support (see 4.x), a couple of `@media (max-width)` rules that stack the clusters and enlarge tap targets would make casual phone use bearable.

---

## 4. New features

Grouped by theme and roughly ordered by value to the target user (someone learning music by ear). The ones already shipped (pitch shift, file drop, note overlay, metronome, practice panel, drone, memorize mode, WAV export, setlists, session restore, tempo sync) are not repeated.

### 4.A Audio analysis & visualization

The decoded-buffer cache (3.3) is the enabler for most of these.

- **Key detection.** "What key is this in?" is the first question of any transcriber. Krumhansl-Schmuckler profile correlation over a chromagram gives "C minor 87%, Eb major 71%". Pure JS, ~150 LOC, no backend. Show it as a prominent pill next to the detected root you already display (`note-root`).
- **Chord-over-time strip.** A row of chord pills under the timeline ("G - D - Em - C") is the single most-loved feature on Chordify/ChordU. Per-frame chromagram -> match against the 24 major/minor triads -> smooth to stop flicker. This is what turns Loopretto from a looper into a transcription tool.
- **Beat grid from the existing tempo detector.** `tempo.js` already finds BPM. Render vertical hairlines at each beat on the waveform, and let loop edges snap to beats so loops stop having ugly half-bar gaps. Unlocks "loop the next 8 bars" presets.
- **Onset markers.** Spectral flux (already computed inside `tempo.js`) gives note-attack positions. Draw ticks above the waveform; snap loop boundaries to the nearest onset. Makes dense passages far easier to carve up.
- **Melodic pitch contour overlay.** A continuous pitch line drawn over the waveform (piano-roll style) shows bends, slides, and vibrato as wavy lines. Reuses the `pitch-detect.js` machinery, plotted as an SVG polyline colored by confidence.
- **Spectrogram toggle.** WaveSurfer v7 ships a spectrogram plugin; some people find pitch by eye faster on a spectrogram. Drop-in.
- **Live spectrum analyzer.** An `AnalyserNode` -> canvas bar display of the current playhead's frequency content. The analyser tap already exists (`app.js:356`).

### 4.B Practice tools

Building on the existing Practice panel.

- **Auto-slowdown ramp.** The gold-standard practice method: "start at 50%, +5% every 3 loops up to 100%". The rep counter (`onLoopRestart`, `app.js:1287`) already fires on each loop - hook tempo bumps into it and show a progress bar. High value, low effort given the plumbing is there.
- **Loop pre-roll / count-in.** Right now the loop just cuts back. Play 4 metronome clicks (or a "4-3-2-1" visual) before the loop's first beat so you can come in on the downbeat when playing along. The metronome is already attached to the same audio clock.
- **Loop boundary fade (taper).** A ~50ms gain ramp at the loop seam removes the click and is far less fatiguing over a long session. ~30 LOC of Web Audio gain automation around the `region-out` jump.
- **Reverse playback.** Classic ear-training trick: hear a phrase backwards to expose its intervals. Reverse the cached AudioBuffer once, toggle. (Needs 3.3.)
- **Tap-along beat mode.** When auto BPM detection fails (rubato, no drums), let the user tap Space to mark beats and build the grid manually. The metronome already has tap-tempo logic to borrow.
- **Spaced repetition across songs.** A user juggles 3-5 songs. The practice journal (`PracticeStore`) already logs per-song time and a "last" date - a SuperMemo-2-style "what should I review today?" view is a natural extension.
- **Section labeler.** Tag stretches of the timeline as Intro / Verse / Chorus / Solo and jump between them. Pairs with YouTube chapters (4.G).

### 4.C Audio manipulation & EQ

**Done** - see the ✅ section. Channel isolation (L/R), mid-side karaoke, a 5-band parametric EQ with presets, a draggable band-pass spotlight, and a "punch" compressor all ship on the channel + FX stages. Future polish could add a spectrogram behind the band-pass (paired with 4.A) or user-adjustable EQ bands, but the core of this section is covered.

### 4.D Notation, transcription & theory helpers

These compound once key (4.A) and chords (4.A) exist.

- **Chord chart builder synced to the timeline.** Click the timeline, type "Cmaj7", build a chart that scrolls under the playhead. Export as text.
- **Roman-numeral / Nashville analysis.** Once key + chords are known, computing function (I, IV, V, vi) is free and teaches progressions ("every chorus is 1-5-6-4").
- **Scale highlighter on the piano.** Gray out non-scale keys once a key is detected. Beginner shortcut to "what notes work here". The piano DOM is right there (`index.html:600`).
- **Lyrics / `.lrc` sync.** Drag in an `.lrc`, render a scrolling lyric line with the active line highlighted; doubles as section markers. Or pull captions straight from `yt-dlp` (it already can fetch `--write-auto-subs`) and pass them through as WebVTT.
- **Solfege / scale-degree display toggle.** Show notes as letters, do-re-mi, or scale numbers depending on how the user thinks.
- **Export loop as MIDI.** Onset + pitch detection -> a basic monophonic MIDI file as a transcription starting point. Even 70% accurate saves an hour of typing.

### 4.E Reference instruments

The piano is great for keyboardists; most ear-trainers are guitarists.

- **Guitar fretboard view.** An SVG fretboard with hover-to-hear and "light up this scale" is far more useful to a guitarist than a piano. Reuse the existing chromatic samples, pitch-shifted per fret.
- **Bass fretboard.** Same idea, 4-string standard tuning.
- **Multiple piano timbres.** Offer a grand, a Rhodes, a pad - same samples folder, different sets - so the reference can match the recording's sound.
- **Strummed chord reference.** Click a chord, hear it strummed on guitar (not the broken piano arpeggio) to check "Cmaj7 or Cadd9?" by ear.

### 4.F Recording & play-along

Loopretto is listen-only today; adding record-yourself is a big step up and stays fully local.

- **Record over the loop.** `getUserMedia` + `MediaRecorder`, save the take in IndexedDB keyed by `currentSongId`. The #1 ear-training technique nobody does because setup is annoying - make it one button.
- **A/B your take vs the source.** Toggle between the original and your recording for instant feedback.
- **Overlay your pitch curve vs the source.** Two contours layered (4.A) make wrong notes and timing obvious at a glance.
- **Latency calibration.** A one-time "tap when you hear the click" wizard so recordings line up. Web Audio latency varies wildly per device.

### 4.G Sources & quick-switching

- **YouTube chapters as default regions.** `yt-dlp` returns `chapters` in `info` (the downloader already has the `info` dict at `downloader.py:100`). Pass them through and pre-create named regions ("Intro", "Solo", "Outro").
- **Recent / favorites quick-switcher.** A `Cmd/Ctrl+K` palette over recently loaded songs beats re-pasting URLs when bouncing between 2-3 tunes. Setlists already model saved songs - extend with an auto "Recent" list.
- **Auto-skip leading silence/talk.** Many tutorials open with 30s of intro. RMS-scan the decoded buffer and set the initial playhead to the first real audio.
- **Per-song persistent settings.** Session restore (`loopretto.session`) already saves speed/pitch/zoom/loop for the *last* song. Key it by `currentSongId` instead so returning to any song restores its setup, including saved loops.

### 4.H Ear-training mini-games

The piano samples + pitch detection make these almost free, and they fit the "learn by ear" mission.

- **Scale-degree recognition with the drone.** Play a note under the existing tonic drone (`app.js:1327`), user names "that was the 3rd". The single highest-carryover ear skill.
- **Interval / chord-quality quizzes.** Random prompts on the existing samples, score over time.
- **Melodic / rhythm dictation.** Hear a short phrase, reproduce it on the on-screen piano or by tapping. Rhythm is often the real transcription bottleneck.
- **Streaks.** Duolingo-style daily streaks turn ear training into a habit; `PracticeStore` already tracks daily totals to build on.

### 4.I Quality-of-life

- **Numeric loop in/out fields.** Type "1:23.500" instead of dragging, for frame-precise loops. Sits next to the existing loop tag.
- **Undo for loop edits.** Accidentally drag a region away and it's gone. Keep a one-deep history of region start/end.
- **Shareable loop state via URL hash.** Even local-only, `#start=12.5&end=16.2&speed=0.7&pitch=-2` lets you bookmark a setup or send a teacher/student a link that restores it (they still paste their own source). No backend.
- **Color-blind-friendly theme preset.** A fourth theme with distinct, high-contrast accent + waveform colors. The token system makes this a small addition.

---

## 5. Helpful hints & developer experience

Small things that make working on Loopretto nicer.

- **Hot-reload while editing CSS/JS.** Static assets cache for a year (`STATIC_CACHE_SECONDS`, `config.py:47`). Run with `STATIC_CACHE_SECONDS=0` during development so you don't have to hard-refresh after every edit. Worth a note in the README's (future) dev section.
- **A handful of backend tests.** No tests exist. The highest-value targets are pure functions with clear contracts: `is_supported_url()` (`downloader.py:30`) and `is_valid_audio_filename()` (`storage.py:24`). A dozen `pytest` cases (valid hosts, subdomains, direct-audio extensions, oversized URLs, path-traversal filenames) lock in the security-relevant validation without needing to mock `yt-dlp`.
- **Ruff for Python.** One fast tool replaces black + flake8 + isort. The backend is small and already clean, so adoption is painless and keeps it that way.
- **`.editorconfig`.** The repo mixes a Flask backend and vanilla JS; a small `.editorconfig` (LF, indent rules) keeps contributors consistent. The CSS file is tabs-indented HTML/2-space JS - pick and enforce.
- **Split `app.js` by concern.** It's ~1,500 lines of interleaved state machines (load lifecycle, loop, theme, menu, metronome, practice, piano) over module-global `let`s. It works, but adding a feature means understanding all of it. A pragmatic refactor: lift the shared mutable state into one object and split the feature blocks into ES modules (`<script type="module">`, no bundler needed). The feature files (`metronome.js`, `practice.js`, etc.) already prove the pattern; `app.js` is the holdout.
- **Document the player-client knob prominently.** When downloads break, the fix is almost always `YOUTUBE_PLAYER_CLIENTS` (`config.py:68`) or cookies. The README's troubleshooting section covers cookies well; a one-liner about the player-client override would save a future debugging session.

---

## 6. A weekend shortlist

The earlier shortlist (the chapter 1-3 papercuts, self-hosting WaveSurfer, the decoded-buffer cache) is now shipped - see the ✅ section up top. What's left, in order:

1. **3.3 is done**, so **4.A key detection** is unblocked - the first genuinely new musical feature, and the one transcribers ask for first. It pairs naturally with the now-shipped FX panel (a spectrogram behind the band-pass spotlight).
2. **2.6** narrow-window layout - a couple of `@media (max-width)` rules so casual phone use is bearable (the right-cluster now has five toggles, so this matters a bit more).
3. **4.B practice tools** (auto-slowdown ramp, count-in, loop taper) - all hook the loop machinery that's already in place.

Everything else is a deep, optional backlog. The throughline: keep the backend a thin `yt-dlp` pipe, do the music in the browser, and make the local experience feel handcrafted.
