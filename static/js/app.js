// ====== Loopretto - app.js (WaveSurfer v7) ======

// ----- DOM refs -----
const $ = (id) => document.getElementById(id);

const body = document.body;
const mainContainer = $("mainContainer");

const playPauseButton = $("play-pause");
const playButton = $("playButton");
const pauseButton = $("pauseButton");

const loopButton = $("loop");
const loopLabel = $("loop-label");
const loopDot = document.querySelector("#loop .loop-dot");
const loopTag = $("loop-tag");
const loopTagText = $("loop-tag-text");

const zoomSlider = $("zoom-range");
const zoomDisplay = $("zoom-display");
const zoomResetBtn = $("zoom-reset");
const channelSeg = $("channel-seg");

const speedDownButton = $("decrease-speed");
const speedUpButton = $("increase-speed");
const speedDisplay = $("speed-display");

const addNewAudioButton = $("addNewAudioButton");
const downloadAudioButton = $("downloadAudioButton");
const showPianoButton = $("showPianoButton");
const showNotesButton = $("showNotesButton");
const showMetronomeButton = $("showMetronomeButton");
const showPracticeButton = $("showPracticeButton");
const showFxButton = $("showFxButton");
const showDroneButton = $("showDroneButton");
const showFretboardButton = $("showFretboardButton");
const sectionTabs = $("section-tabs");
const tabsTrack = $("tabs-track");
const tabIndicator = $("tab-indicator");
const fretboardBody = $("fretboard-body");

const repsTag = $("reps-tag");
const repsTagNum = $("reps-tag-num");

const pitchDownButton = $("pitch-down");
const pitchUpButton = $("pitch-up");
const pitchDisplay = $("pitch-display");

const noteRootEl = $("note-root"); // the live readout lives inside the Notes button

const loadingZone = $("loading-zone");
const loadingIndicator = $("loading-indicator");
const loadAudioBtn = $("load-audio");
const loadAudioLabel = $("load-audio-label");
const urlForm = $("url-form");
const urlInput = $("youtube-url");
const dropZone = $("drop-zone");
const fileInput = $("file-input");
const filePickBtn = $("file-pick");

const resumeBanner = $("resume-banner");
const resumeTitle = $("resume-title");
const resumeBtn = $("resume-btn");
const resumeDismiss = $("resume-dismiss");

const setlistsEl = $("setlists");
const setlistsBody = $("setlists-body");
const setlistNewBtn = $("setlist-new");
const saveSetlistButton = $("saveSetlistButton");
const setlistPopover = $("setlist-popover");
const setlistPopoverList = $("setlist-popover-list");
const setlistPopoverNew = $("setlist-popover-new");
const setlistNewName = $("setlist-new-name");
const changeLabel = $("change-label");

const thumbAndTitleZone = $("thumb-and-title-zone");
const videoTitle = $("video-title");
const videoThumbnail = $("video-thumbnail");
const practiceTime = $("practice-time");

const waveformCard = $("waveform-card");
const controlsRow = $("controls-row");
const waveEmpty = $("wave-empty");
const waveFlash = $("wave-flash");
const waveformEl = $("waveform");
const currentTimeEl = $("current-time");
const durationTimeEl = $("duration-time");

const menuToggle = $("menuToggle");
const menuPanel = $("menuPanel");
const menuScrim = $("menuScrim");
const themeGrid = $("theme-grid");
const accentRow = $("accent-row");
const bgRow = $("bg-row");
const surfaceRow = $("surface-row");
const zenButton = $("zen-mode");
const minimalToggle = $("minimal-toggle");
const journalSyncToggle = $("journal-sync-toggle");
const journalSyncPill = $("journal-sync-pill");
const journalSaveNow = $("journal-save-now");
const journalSyncStatus = $("journal-sync-status");

// ----- State -----
let fileIsLoaded = false;
let audioFile = "";
let masterClickTime = null;
let masterLoopEndTime = null;
let loopStart = null;
let loopEnd = null;
let loopRegion = null;
let currentZoom = 0;
let currentSpeed = 1.0;
let isPaused = true;
let semitoneOffset = 0;
let currentObjectURL = null; // object URL for a locally-dropped file (if any)
let sourceType = "youtube"; // "youtube" (server-downloaded URL source) | "file"
let currentSourceUrl = null; // the URL actually loaded (for setlists/session); null for files
let pendingRestore = null; // session state to apply after the next load completes
let notesOn = false;
let noteRafId = null;
let currentSongId = null;
// Manual practice session: a wall-clock stopwatch the user starts/stops. It
// runs whether the track is playing or paused, so hands-on-instrument time is
// counted. Time is banked into PracticeStore in per-song segments.
let sessionActive = false;
let sessionStartTs = null; // performance.now() at session start (for the headline timer)
let sessionMarkTs = null; // start of the current not-yet-banked per-song segment
let sessionReps = 0; // loop reps logged during the current session (for the journal)
let sessionTickId = null;
// Pomodoro focus/break timer (independent of the session).
let pomoActive = false;
let pomoPhase = "focus"; // "focus" | "break"
let pomoEndTs = 0; // performance.now() when the current phase ends
let pomoTickId = null;
let pomoCompleted = 0; // focus blocks finished
let pomoFocusMin = 25;
let pomoBreakMin = 5;
let loopReps = 0; // reps for the current loop (resettable)
let memorizeOn = false;
let memorizeStep = 0;
let droneOn = false;

// ----- Helpers -----
function fmt(secs) {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Non-blocking toast notifications (replace alert()). A single fixed container
// holds a stack of auto-dismissing messages styled with the theme tokens.
let _toastWrap = null;
function toast(message, kind = "info", ms = 3600) {
  if (!_toastWrap) {
    _toastWrap = document.createElement("div");
    _toastWrap.className = "toast-wrap";
    document.body.appendChild(_toastWrap);
  }
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  _toastWrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const dismiss = () => {
    el.classList.remove("show");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback if transitionend doesn't fire
  };
  const timer = setTimeout(dismiss, ms);
  el.addEventListener("click", () => { clearTimeout(timer); dismiss(); });
}

function setControlsEnabled(enabled) {
  [
    speedDownButton, speedUpButton, playPauseButton, loopButton, zoomSlider, zoomResetBtn,
    showPianoButton, showNotesButton, showMetronomeButton, showPracticeButton,
    showFxButton, showDroneButton, showFretboardButton, pitchDownButton, pitchUpButton,
  ].concat(channelSeg ? [...channelSeg.querySelectorAll(".seg-btn")] : [])
    .forEach((el) => {
      if (el) el.disabled = !enabled;
    });
  setHintTitles(!enabled);
}

// Disabled controls have pointer-events:none (CSS), so a hover falls
// through to these wrappers; show "Load a track first" there until enabled.
let _hintWraps = null;
function setHintTitles(disabled) {
  if (!_hintWraps) {
    _hintWraps = [document.querySelector(".transport"), document.querySelector(".section-tabs")]
      .concat(Array.from(document.querySelectorAll(".controls-middle .control-group")))
      .filter(Boolean);
    _hintWraps.forEach((w) => { w.dataset.origTitle = w.getAttribute("title") || ""; });
  }
  _hintWraps.forEach((w) => {
    w.setAttribute("title", disabled ? "Load a track first" : w.dataset.origTitle);
  });
}

function updateZoomSlider(value) {
  zoomSlider.value = value;
  zoomSlider.setAttribute("aria-valuetext", `${value}%`);
  zoomDisplay.textContent = `${value}%`;
}

function updateSpeedDisplay() {
  speedDisplay.textContent = `${Math.round(currentSpeed * 100)}%`;
}

function setPlayingUI(playing) {
  isPaused = !playing;
  if (playing) {
    playButton.style.display = "none";
    pauseButton.style.display = "block";
    playPauseButton.setAttribute("aria-label", "Pause");
  } else {
    playButton.style.display = "block";
    pauseButton.style.display = "none";
    playPauseButton.setAttribute("aria-label", "Play");
  }
}

function setLoopUI(active) {
  loopButton.setAttribute("aria-pressed", active ? "true" : "false");
  if (active) {
    loopButton.classList.add("active");
    loopLabel.textContent = "Looping";
    loopDot.style.display = "inline-block";
    loopTag.style.display = "inline-flex";
    repsTag.style.display = "inline-flex";
    resetLoopReps();
    resetMemorizeLevel();
  } else {
    loopButton.classList.remove("active");
    loopLabel.textContent = "Loop section";
    loopDot.style.display = "none";
    loopTag.style.display = "none";
    repsTag.style.display = "none";
  }
}

function refreshLoopTag() {
  if (loopRegion) {
    loopTagText.textContent = `${fmt(loopRegion.start)} – ${fmt(loopRegion.end)}`;
  }
}

// ----- Initial state -----
setControlsEnabled(false);
updateZoomSlider(currentZoom);
updateSpeedDisplay();

// ----- Appearance: theme picker (Light / Dim / Dark) + accent selector -----
const THEME_CLASSES = ["theme-light", "theme-dim", "theme-dark"];
const DEFAULT_THEME = "theme-dim";
const DEFAULT_ACCENT = "oklch(0.66 0.1 290)";

function applyTheme(cls) {
  if (!THEME_CLASSES.includes(cls)) cls = DEFAULT_THEME;
  THEME_CLASSES.forEach((c) => body.classList.toggle(c, c === cls));
  themeGrid.querySelectorAll(".theme-opt").forEach((opt) => {
    opt.classList.toggle("active", opt.dataset.theme === cls);
    opt.setAttribute("aria-pressed", opt.dataset.theme === cls ? "true" : "false");
  });
  try { localStorage.setItem("loopretto.theme", cls); } catch (e) {}
  reapplyWaveColors();
}

// Accent picker; "default" maps to the theme's own accent (DEFAULT_ACCENT),
// mirroring the "Theme default" swatch of the Background / Containers rows.
function applyAccent(value) {
  if (!value || value === "default") {
    document.documentElement.style.setProperty("--accent-raw", DEFAULT_ACCENT);
    value = "default";
  } else {
    document.documentElement.style.setProperty("--accent-raw", value);
  }
  accentRow.querySelectorAll(".accent-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.accent === value);
  });
  try { localStorage.setItem("loopretto.accent", value); } catch (e) {}
  reapplyWaveColors();
}

// Background picker: retints --bg-hue / --bg-chroma on <html>; "default" clears
// the override so each theme's own background returns (via CSS var fallbacks).
function applyBg(value) {
  const rootStyle = document.documentElement.style;
  if (!value || value === "default") {
    rootStyle.removeProperty("--bg-hue");
    rootStyle.removeProperty("--bg-chroma");
    value = "default";
  } else {
    const [hue, chroma] = value.split(" ");
    rootStyle.setProperty("--bg-hue", hue);
    rootStyle.setProperty("--bg-chroma", chroma);
  }
  bgRow.querySelectorAll(".bg-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.bg === value);
  });
  try { localStorage.setItem("loopretto.bg", value); } catch (e) {}
}

// Containers picker: retints --surface-hue / --surface-chroma on <html>, so
// every panel takes the tint; "default" clears the override (same shape as
// applyBg). The per-theme lightness scale is untouched.
function applySurface(value) {
  const rootStyle = document.documentElement.style;
  if (!value || value === "default") {
    rootStyle.removeProperty("--surface-hue");
    rootStyle.removeProperty("--surface-chroma");
    value = "default";
  } else {
    const [hue, chroma] = value.split(" ");
    rootStyle.setProperty("--surface-hue", hue);
    rootStyle.setProperty("--surface-chroma", chroma);
  }
  surfaceRow.querySelectorAll(".surface-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.surface === value);
  });
  try { localStorage.setItem("loopretto.surface", value); } catch (e) {}
}

themeGrid.addEventListener("click", (e) => {
  const opt = e.target.closest(".theme-opt");
  if (opt) applyTheme(opt.dataset.theme); // keep the menu open so themes can be tried back-to-back
});
accentRow.addEventListener("click", (e) => {
  const dot = e.target.closest(".accent-dot");
  if (dot) applyAccent(dot.dataset.accent);
});
bgRow.addEventListener("click", (e) => {
  const dot = e.target.closest(".bg-dot");
  if (dot) applyBg(dot.dataset.bg);
});
surfaceRow.addEventListener("click", (e) => {
  const dot = e.target.closest(".surface-dot");
  if (dot) applySurface(dot.dataset.surface);
});

let savedTheme = DEFAULT_THEME;
let savedAccent = "default";
let savedBg = "default";
let savedSurface = "default";
try {
  savedTheme = localStorage.getItem("loopretto.theme") || DEFAULT_THEME;
  savedAccent = localStorage.getItem("loopretto.accent") || "default";
  savedBg = localStorage.getItem("loopretto.bg") || "default";
  savedSurface = localStorage.getItem("loopretto.surface") || "default";
} catch (e) {}
// Drop a stale/old-palette accent so the current swatches always apply.
const validAccents = [...accentRow.querySelectorAll(".accent-dot")].map((d) => d.dataset.accent);
if (!validAccents.includes(savedAccent)) savedAccent = "default";
// Same guard for backgrounds, in case the swatch set changes.
const validBgs = [...bgRow.querySelectorAll(".bg-dot")].map((d) => d.dataset.bg);
if (!validBgs.includes(savedBg)) savedBg = "default";
// And for container tints.
const validSurfaces = [...surfaceRow.querySelectorAll(".surface-dot")].map((d) => d.dataset.surface);
if (!validSurfaces.includes(savedSurface)) savedSurface = "default";

// ----- Menu -----
function openMenu() {
  menuPanel.classList.add("open");
  menuScrim.classList.add("open");
}
function closeMenu() {
  menuPanel.classList.remove("open");
  menuScrim.classList.remove("open");
}
menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  if (menuPanel.classList.contains("open")) closeMenu();
  else openMenu();
});
menuScrim.addEventListener("click", closeMenu);

// ----- Focus / Fullscreen mode -----
// Shared by the menu item and the `F` keyboard shortcut.
function toggleZen() {
  closeMenu();
  const docElm = document.documentElement;
  const isFull = document.fullscreenElement || document.webkitFullscreenElement ||
    document.mozFullScreenElement || document.msFullscreenElement;
  if (isFull) {
    (document.exitFullscreen || document.mozCancelFullScreen ||
      document.webkitExitFullscreen || document.msExitFullscreen).call(document);
  } else {
    (docElm.requestFullscreen || docElm.mozRequestFullScreen ||
      docElm.webkitRequestFullscreen || docElm.msRequestFullscreen).call(docElm);
  }
}
zenButton.addEventListener("click", (e) => {
  e.preventDefault();
  toggleZen();
});

// Keep the Focus mode toggle in sync with the actual fullscreen state
// (e.g. when the user exits fullscreen with Esc).
function syncZenToggle() {
  const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement ||
    document.mozFullScreenElement || document.msFullscreenElement);
  zenButton.setAttribute("aria-checked", isFull ? "true" : "false");
}
["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"]
  .forEach((evt) => document.addEventListener(evt, syncZenToggle));

// ----- Keyboard-shortcut help overlay -----
// One source of truth for every binding, so the overlay can't drift from the
// real handlers below. Keys render as <kbd> chips.
const SHORTCUTS = [
  { keys: ["Space"], desc: "Play / pause" },
  { keys: ["←", "→"], desc: "Nudge 0.5s back / forward" },
  { keys: ["F"], desc: "Focus (fullscreen) mode" },
  { keys: ["?"], desc: "Show this shortcuts list" },
  { keys: ["Esc"], desc: "Close this list / exit fullscreen" },
  { keys: ["Z", "X", "C", "V", "B", "N", "M"], desc: "Piano: natural keys (C–B)" },
  { keys: ["S", "D", "G", "H", "J"], desc: "Piano: sharp/flat keys" },
];
const shortcutsOverlay = $("shortcuts-overlay");
const shortcutsList = $("shortcuts-list");
const shortcutsClose = $("shortcuts-close");
let _shortcutsBuilt = false;

function buildShortcutsList() {
  if (_shortcutsBuilt) return;
  SHORTCUTS.forEach((s) => {
    const row = document.createElement("div");
    row.className = "shortcut-row";
    const desc = document.createElement("span");
    desc.className = "shortcut-desc";
    desc.textContent = s.desc;
    const keys = document.createElement("span");
    keys.className = "shortcut-keys";
    s.keys.forEach((k) => {
      const kbd = document.createElement("kbd");
      kbd.textContent = k;
      keys.appendChild(kbd);
    });
    row.appendChild(desc);
    row.appendChild(keys);
    shortcutsList.appendChild(row);
  });
  _shortcutsBuilt = true;
}
function isShortcutsOpen() { return shortcutsOverlay.style.display !== "none"; }
function openShortcuts() {
  buildShortcutsList();
  shortcutsOverlay.style.display = "";
  shortcutsClose.focus();
}
function closeShortcuts() { shortcutsOverlay.style.display = "none"; }
function toggleShortcuts() { isShortcutsOpen() ? closeShortcuts() : openShortcuts(); }
shortcutsClose.addEventListener("click", closeShortcuts);
const shortcutsOpenBtn = $("shortcuts-open");
if (shortcutsOpenBtn) shortcutsOpenBtn.addEventListener("click", openShortcuts);
shortcutsOverlay.addEventListener("click", (e) => {
  if (e.target === shortcutsOverlay) closeShortcuts(); // click the scrim to dismiss
});

// ----- Minimal start screen (hide intro copy + suggested links) -----
function applyMinimalStart(on) {
  body.classList.toggle("minimal-start", on);
  minimalToggle.setAttribute("aria-checked", on ? "true" : "false");
  try { localStorage.setItem("loopretto.minimalStart", on ? "1" : "0"); } catch (e) {}
}
minimalToggle.addEventListener("click", (e) => {
  e.preventDefault();
  applyMinimalStart(!body.classList.contains("minimal-start")); // instant, menu stays open
});
let savedMinimalStart = false;
try { savedMinimalStart = localStorage.getItem("loopretto.minimalStart") === "1"; } catch (e) {}
applyMinimalStart(savedMinimalStart);

// ----- Practice journal -> Documents folder (local-only file write) -----
// One flag (loopretto.journalSync) mirrored in two toggles: the burger-menu
// switch and the Practice-panel pill. While on, the journal is written to
// ~/Documents/Practice Journal on every session Stop and on page close; a
// "Save now" button always writes on demand.
let journalSyncOn = false;
function applyJournalSync(on) {
  journalSyncOn = on;
  journalSyncToggle.setAttribute("aria-checked", on ? "true" : "false");
  journalSyncPill.classList.toggle("active", on);
  journalSyncPill.setAttribute("aria-pressed", on ? "true" : "false");
  journalSyncPill.textContent = on ? "On" : "Off";
  try { localStorage.setItem("loopretto.journalSync", on ? "1" : "0"); } catch (e) {}
}

// Build the human-readable journal from PracticeStore (mirrors renderJournal).
function buildJournalMarkdown() {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const t = PracticeStore.today();
  const goal = PracticeStore.getGoal();
  const streak = PracticeStore.refreshStreak();
  const goalMet = t.ms >= goal * 60000 ? " (met)" : "";

  const lines = [
    "# Practice Journal",
    `_Updated ${stamp}_`,
    "",
    "## Today",
    `${fmtClock(t.ms)} · ${t.reps} reps · goal ${goal} min${goalMet}`,
    `Streak: ${streak.current} day${streak.current === 1 ? "" : "s"} (best ${streak.best})`,
    "",
  ];

  const songs = PracticeStore.songs();
  if (songs.length) {
    lines.push("## Songs", "");
    songs.forEach((s) => {
      lines.push(`- **${s.title || s.id}** — ${fmtClock(s.totalMs)} · ${s.reps} reps · last ${s.last || "-"}`);
    });
    lines.push("");
  }

  const sessions = PracticeStore.recentSessions(100);
  if (sessions.length) {
    lines.push("## Recent sessions", "");
    sessions.forEach((s) => {
      const bits = [`${fmtClock(s.ms)}`, `${s.reps} reps`];
      if (s.pomos) bits.push(`${s.pomos} pomodoro${s.pomos === 1 ? "" : "s"}`);
      lines.push(`### ${s.date} — ${s.title || "(untitled)"}`);
      lines.push(bits.join(" · "));
      if (s.note) lines.push("", `> ${s.note.replace(/\n/g, "\n> ")}`);
      lines.push("");
    });
  }

  return lines.join("\n");
}

async function saveJournalToDisk({ silent } = {}) {
  let dataJson;
  try { dataJson = localStorage.getItem("loopretto.practice"); } catch (e) { dataJson = null; }
  if (!dataJson) { if (!silent) toast("No practice logged yet.", "info"); return; }
  try {
    const res = await fetch("/save_journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: buildJournalMarkdown(), data: dataJson }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || "Save failed");
    if (journalSyncStatus) journalSyncStatus.textContent = "Saved to " + out.dir;
    if (!silent) toast("Journal saved to Documents", "success");
  } catch (err) {
    if (!silent) toast("Couldn't save journal: " + err.message, "error");
  }
}

journalSyncToggle.addEventListener("click", (e) => {
  e.preventDefault(); // menu stays open
  applyJournalSync(!journalSyncOn);
  if (journalSyncOn) saveJournalToDisk({ silent: false });
});
journalSyncPill.addEventListener("click", () => {
  applyJournalSync(!journalSyncOn);
  if (journalSyncOn) saveJournalToDisk({ silent: false });
});
journalSaveNow.addEventListener("click", () => saveJournalToDisk({ silent: false }));
try { applyJournalSync(localStorage.getItem("loopretto.journalSync") === "1"); } catch (e) { applyJournalSync(false); }

// On a hard close, persist the latest journal if auto-save is on. fetch() won't
// reliably complete during unload, so use sendBeacon (the route reads the
// application/json Blob via get_json just like a normal POST).
window.addEventListener("beforeunload", () => {
  if (!journalSyncOn) return;
  let dataJson;
  try { dataJson = localStorage.getItem("loopretto.practice"); } catch (e) { return; }
  if (!dataJson) return;
  const body = new Blob(
    [JSON.stringify({ markdown: buildJournalMarkdown(), data: dataJson })],
    { type: "application/json" }
  );
  navigator.sendBeacon("/save_journal", body);
});

// ----- Audio element + Web Audio graph -----
// We own the <audio> element so the Web Audio graph survives across loads.
// WaveSurfer plays through it; routing it via an AudioContext gives a stable
// insertion point for future effects (EQ, pitch shift, etc.).
const mediaEl = new Audio();
mediaEl.preservesPitch = true; // slow down without the chipmunk pitch shift

const metroBody = $("metro-body");

let audioCtx = null;
let masterGain = null;
let mediaSource = null;
let pitchShifter = null;
let analyser = null;
let channelIn = null; // entry of the channel-isolation stage
let channelOut = null; // exit of the channel-isolation stage → masterGain
let channelNodes = []; // splitter/merger/gain nodes rebuilt per mode
let channelMode = "stereo"; // "stereo" | "left" | "right" | "side" (karaoke)
// FX segment (EQ → band-pass spotlight → compressor), inserted channelOut→master.
let fxIn = null, fxOut = null;
let eqBands = null;       // array of BiquadFilterNodes (multi-band parametric EQ)
let bandpassNode = null;  // band-pass "spotlight"
let compressorNode = null, compMakeup = null; // "punch" compressor + makeup gain
let eqPreset = "off";
let spotlightOn = false;
let punchOn = false;
let spotlightReady = false; // gates drawSpotlight() until its DOM refs exist
const metronome = new Metronome();

function ensureAudioGraph() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    // createMediaElementSource can only run once per element; the source then
    // follows the element across src changes.
    mediaSource = audioCtx.createMediaElementSource(mediaEl);

    // Independent pitch shift (tempo-preserving). Bypassed at 0 semitones so
    // clean audio isn't degraded by the delay-line crossfade.
    pitchShifter = new Jungle(audioCtx);

    // Channel-isolation stage sits between the pitch path and master, so L/R
    // solo and mid-side vocal removal apply to whatever's playing. Both the
    // direct (0-semitone) path and the pitch shifter feed channelIn.
    channelIn = audioCtx.createGain();
    channelOut = audioCtx.createGain();
    applyChannelMode(channelMode);
    pitchShifter.output.connect(channelIn);

    // FX segment: channelOut → [EQ → band-pass → compressor] → master. Nodes
    // are persistent; rebuildFxChain() wires only the active ones in series.
    fxIn = audioCtx.createGain();
    fxOut = audioCtx.createGain();
    buildFxNodes();
    channelOut.connect(fxIn);
    fxOut.connect(masterGain);
    rebuildFxChain();

    // Analyser tap (post-everything) feeds the live note-detection overlay.
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);

    // Metronome shares the same AudioContext/clock; clicks bypass masterGain.
    metronome.attach(audioCtx, audioCtx.destination, metroBody && metroBody.dataset.clickSrc);

    routePitch();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// Route the media source directly into the channel stage (0 semitones) or
// through the pitch shifter first. Called whenever the transpose amount changes.
function routePitch() {
  if (!mediaSource) return;
  try { mediaSource.disconnect(); } catch (e) {}
  if (semitoneOffset === 0) {
    mediaSource.connect(channelIn);
  } else {
    mediaSource.connect(pitchShifter.input);
    pitchShifter.setPitchOffset(semitoneOffset / 12);
  }
}

// Rewire the channel stage for the chosen mode. "side" is L−R (the mid-side
// difference), which cancels center-panned content - a free, instant karaoke.
function applyChannelMode(mode) {
  channelMode = mode;
  if (!channelIn || !channelOut) return; // graph not built yet; applied on build
  try { channelIn.disconnect(); } catch (e) {}
  channelNodes.forEach((n) => { try { n.disconnect(); } catch (e) {} });
  channelNodes = [];

  if (mode === "stereo") {
    channelIn.connect(channelOut); // clean passthrough
    return;
  }

  const splitter = audioCtx.createChannelSplitter(2);
  channelIn.connect(splitter);
  channelNodes.push(splitter);

  if (mode === "left" || mode === "right") {
    const ch = mode === "left" ? 0 : 1;
    const merger = audioCtx.createChannelMerger(2);
    splitter.connect(merger, ch, 0); // same channel to both outputs (mono)
    splitter.connect(merger, ch, 1);
    merger.connect(channelOut);
    channelNodes.push(merger);
  } else if (mode === "side") {
    const invR = audioCtx.createGain();
    invR.gain.value = -1;
    const sum = audioCtx.createGain(); // L + (−R) = L − R
    splitter.connect(sum, 0);   // L
    splitter.connect(invR, 1);  // R
    invR.connect(sum);
    const merger = audioCtx.createChannelMerger(2);
    sum.connect(merger, 0, 0);
    sum.connect(merger, 0, 1);
    merger.connect(channelOut);
    channelNodes.push(invR, sum, merger);
  }
}

// ----- FX: parametric EQ, band-pass spotlight, compressor -----
const EQ_FREQS = [80, 250, 1000, 3500, 12000];
const EQ_TYPES = ["lowshelf", "peaking", "peaking", "peaking", "highshelf"];
// Per-band gain (dB) for each preset; order matches EQ_FREQS.
const EQ_PRESETS = {
  off:    [0, 0, 0, 0, 0],
  vocals: [-3, -1, 3, 4, 1],
  bass:   [6, 3, -2, -4, -3],
  guitar: [-4, -2, 1, 5, 2],
  drums:  [4, -2, -1, 2, 5],
};

// Map the 0–100 sliders to musically useful, logarithmic ranges.
function spotlightFreqFromSlider() { return 50 * Math.pow(160, Number(spotlightFreq.value) / 100); } // 50 Hz–8 kHz
function spotlightQFromSlider() { return 0.5 * Math.pow(24, Number(spotlightQ.value) / 100); }        // Q 0.5–12

function buildFxNodes() {
  eqBands = EQ_FREQS.map((f, i) => {
    const b = audioCtx.createBiquadFilter();
    b.type = EQ_TYPES[i];
    b.frequency.value = f;
    if (b.type === "peaking") b.Q.value = 1.0;
    b.gain.value = 0;
    return b;
  });
  bandpassNode = audioCtx.createBiquadFilter();
  bandpassNode.type = "bandpass";
  bandpassNode.frequency.value = spotlightFreqFromSlider();
  bandpassNode.Q.value = spotlightQFromSlider();
  compressorNode = audioCtx.createDynamicsCompressor();
  compressorNode.threshold.value = -28;
  compressorNode.knee.value = 24;
  compressorNode.ratio.value = 4;
  compressorNode.attack.value = 0.005;
  compressorNode.release.value = 0.18;
  compMakeup = audioCtx.createGain();
  compMakeup.gain.value = 1.8; // ~+5 dB make-up to offset the gain reduction
  applyEqPreset(eqPreset);
}

// Wire only the active effects in series between fxIn and fxOut. Called on
// toggle/preset change only (never on slider drag, which updates params live).
function rebuildFxChain() {
  if (!fxIn) return;
  try { fxIn.disconnect(); } catch (e) {}
  eqBands.forEach((b) => { try { b.disconnect(); } catch (e) {} });
  try { bandpassNode.disconnect(); } catch (e) {}
  try { compressorNode.disconnect(); } catch (e) {}
  try { compMakeup.disconnect(); } catch (e) {}

  let node = fxIn;
  if (eqPreset !== "off") {
    eqBands.forEach((b) => { node.connect(b); node = b; });
  }
  if (spotlightOn) { node.connect(bandpassNode); node = bandpassNode; }
  if (punchOn) { node.connect(compressorNode); compressorNode.connect(compMakeup); node = compMakeup; }
  node.connect(fxOut);
}

function applyEqPreset(preset) {
  const gains = EQ_PRESETS[preset] || EQ_PRESETS.off;
  if (!eqBands) return;
  eqBands.forEach((b, i) => {
    if (audioCtx) b.gain.setTargetAtTime(gains[i], audioCtx.currentTime, 0.02);
    else b.gain.value = gains[i];
  });
}

// ----- WaveSurfer -----
function getWaveColors() {
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent").trim() || "#a586ff";
  const isLight = body.classList.contains("theme-light");
  const wave = isLight ? "oklch(0.78 0.03 280)" : "oklch(0.45 0.04 280)";
  return { waveColor: wave, progressColor: accent };
}

// Loop-region fill, derived from the current accent so it matches the theme
// instead of being a hardcoded violet. `accent` is already a concrete oklch
// value, so the relative-color form just lowers its alpha.
function getRegionColor() {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#a586ff";
  return `oklch(from ${accent} l c h / 0.22)`;
}

const initialColors = getWaveColors();
const wavesurfer = WaveSurfer.create({
  container: "#waveform",
  media: mediaEl,
  waveColor: initialColors.waveColor,
  progressColor: initialColors.progressColor,
  cursorColor: getComputedStyle(document.documentElement).getPropertyValue("--text") || "#fff",
  cursorWidth: 2,
  height: 130,
  barWidth: 2,
  barRadius: 2,
  barGap: 1,
  autoCenter: false,
});

const wsRegions = wavesurfer.registerPlugin(WaveSurfer.Regions.create());
wavesurfer.registerPlugin(
  WaveSurfer.Timeline.create({
    // No container: render inside the wrapper so the ruler scrolls with the
    // waveform and the horizontal scrollbar lands beneath it.
    height: 18,
    timeInterval: 1,
    primaryLabelInterval: 10,
    secondaryLabelInterval: 5,
    style: { fontSize: "9px", color: "rgba(150,150,170,0.7)" },
  })
);

function reapplyWaveColors() {
  const c = getWaveColors();
  try {
    wavesurfer.setOptions({ waveColor: c.waveColor, progressColor: c.progressColor });
  } catch (e) {}
  // Keep an existing loop region in step with the chosen accent.
  if (loopRegion) {
    try { loopRegion.setOptions({ color: getRegionColor() }); } catch (e) {}
  }
  if (spotlightReady) drawSpotlight();
}

// Apply persisted appearance after wavesurfer exists so wave colors track it.
applyAccent(savedAccent);
applyBg(savedBg);
applySurface(savedSurface);
applyTheme(savedTheme);

wavesurfer.on("ready", (dur) => {
  durationTimeEl.textContent = fmt(dur);
  currentTimeEl.textContent = fmt(0);
});

wavesurfer.on("timeupdate", (t) => {
  currentTimeEl.textContent = fmt(t);
});

// Fired when the user clicks/seeks on the waveform.
wavesurfer.on("interaction", (newTime) => {
  masterClickTime = newTime;
  loopStart = newTime;
  currentTimeEl.textContent = fmt(newTime);
});

// Play state no longer drives practice time; the manual session timer does
// (so paused, working-it-out-on-the-instrument time counts too).
wavesurfer.on("play", () => {
  setPlayingUI(true);
});
wavesurfer.on("pause", () => {
  setPlayingUI(false);
});
wavesurfer.on("finish", () => {
  setPlayingUI(false);
});

// Loop: when the playhead leaves the loop region, jump back to its start.
wsRegions.on("region-out", (region) => {
  if (loopRegion && region.id === loopRegion.id) {
    // Only a genuine loop-around — the playhead reaching the loop end during
    // playback — counts as a rep. The play/pause toggle also seeks to loopStart,
    // which fires region-out while paused; those manual seeks must not log a rep.
    const playing = wavesurfer.isPlaying();
    wavesurfer.setTime(region.start);
    if (playing) onLoopRestart();
  }
});

// Drag / resize of the loop region syncs back to module state.
wsRegions.on("region-updated", (region) => {
  if (loopRegion && region.id === loopRegion.id) {
    masterClickTime = region.start;
    loopStart = region.start;
    loopEnd = region.end;
    refreshLoopTag();
  }
});

// ----- Shared player reveal / source helpers -----
function clearObjectURL() {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }
}

function revealPlayer(title, thumbnail) {
  videoTitle.textContent = title || "Unknown";
  if (thumbnail) {
    videoThumbnail.src = thumbnail;
    videoThumbnail.style.display = "";
  } else {
    videoThumbnail.removeAttribute("src");
    videoThumbnail.style.display = "none";
  }
  loadingZone.classList.add("hidden");
  thumbAndTitleZone.classList.remove("hidden");
  waveformCard.classList.remove("hidden");
  controlsRow.classList.remove("hidden");
  sectionTabs.classList.remove("hidden");
  waveEmpty.classList.add("hidden");
  fileIsLoaded = true;
  setControlsEnabled(true);
  window.currentAudioTitle = title || "audio";
  updateSaveSetlistButton();
  // Pin all sections to a common height now the strip is visible, so the very
  // first tab switch is already flicker-free.
  syncSectionHeights();
}

// ----- Local file source (drag & drop / file picker), skips /get_audio -----
function loadFile(file) {
  if (!file) return;
  if (!/^audio\/|^video\//.test(file.type) && !/\.(mp3|m4a|wav|ogg|opus|flac|aac|webm|mp4)$/i.test(file.name)) {
    toast("That doesn't look like an audio file.", "error");
    return;
  }
  clearObjectURL();
  invalidateDecodedCache();
  currentObjectURL = URL.createObjectURL(file);
  sourceType = "file";
  currentSourceUrl = null; // local files can't be saved/restored from a URL
  audioFile = file.name;
  window.currentAudioFile = file.name;
  resetTranspose();
  resetChannelMode();
  resetFx();
  revealPlayer(file.name, null);
  beginSong(computeSongId(file.name, "file"), file.name);
  clearSession(); // a local file isn't restorable on reload
  wavesurfer.load(currentObjectURL).catch((err) => {
    console.error(err);
    toast("Could not decode that audio file.", "error");
  });
}

filePickBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) loadFile(file);
  fileInput.value = ""; // allow re-picking the same file
});

// Accept a drop anywhere on the page while no track is loaded; once loaded,
// the drop zone in the loading view is hidden, so this is effectively scoped.
["dragenter", "dragover"].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    if (dropZone) dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    if (evt === "dragleave" && e.relatedTarget) return;
    if (dropZone) dropZone.classList.remove("dragover");
  });
});
document.addEventListener("drop", (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  loadFile(e.dataTransfer.files[0]);
});

// ----- Load audio (POST /get_audio, then stream /audio/<file> directly) -----
async function loadAudio() {
  if (loadAudioBtn.disabled) return;
  const youtubeUrl = urlInput.value.trim();
  if (!youtubeUrl) {
    toast("Paste a YouTube, SoundCloud, Bandcamp or direct audio URL first.");
    return;
  }

  loadAudioBtn.disabled = true;
  loadingIndicator.style.display = "inline-block";
  startLoadStages();

  try {
    const response = await fetch("/get_audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl }),
    });

    if (!response.ok) {
      let msg = "Failed to load audio";
      if (response.status === 429) {
        msg = "Rate limited. Too many requests, try again in a minute.";
      } else {
        try {
          const err = await response.json();
          if (err && err.error) msg = err.error;
        } catch (e) {}
      }
      throw new Error(msg);
    }

    const data = await response.json();
    audioFile = data.audio_file;
    sourceType = "youtube";
    currentSourceUrl = youtubeUrl;
    clearObjectURL();
    invalidateDecodedCache();
    resetTranspose();
    resetChannelMode();
    resetFx();

    revealPlayer(data.title, data.thumbnail);
    window.currentAudioFile = audioFile;
    beginSong(computeSongId(youtubeUrl, "youtube"), data.title);

    // Real "decoding" stage: fetch is done, now WaveSurfer decodes the waveform.
    stopLoadStages();
    loadAudioLabel.textContent = "Decoding…";

    // Stream the file straight from the server (range requests), no Blob
    // round-trip. The cache-bust query keeps the reused filename fresh.
    await wavesurfer.load(`/audio/${audioFile}?t=${Date.now()}`);
    applyPendingRestore();
    saveSession();
  } catch (err) {
    console.error(err);
    toast(err.message || "Failed to load audio", "error");
    fileIsLoaded = false;
    setControlsEnabled(false);
  } finally {
    stopLoadStages();
    loadingIndicator.style.display = "none";
    loadAudioLabel.textContent = "Load audio";
    loadAudioBtn.disabled = false;
  }
}

// Staged loading feedback (the fetch is opaque, so the first stages are
// time-based; the final "Decoding…" stage is real, set when load() begins).
const LOAD_STAGES = ["Fetching info…", "Downloading…", "Almost there…"];
let _loadStageTimer = null;
function startLoadStages() {
  let i = 0;
  loadAudioLabel.textContent = LOAD_STAGES[0];
  _loadStageTimer = setInterval(() => {
    i = Math.min(i + 1, LOAD_STAGES.length - 1);
    loadAudioLabel.textContent = LOAD_STAGES[i];
  }, 1500);
}
function stopLoadStages() {
  if (_loadStageTimer) {
    clearInterval(_loadStageTimer);
    _loadStageTimer = null;
  }
}

urlForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loadAudio();
});

document.querySelectorAll(".chip[data-url]").forEach((chip) => {
  chip.addEventListener("click", () => {
    // Always drop the chip's URL into the address bar, replacing whatever is
    // there - so clicking from one suggestion to the next just swaps it out.
    urlInput.value = chip.dataset.url;
    urlInput.focus();
  });
});

function teardownTrack() {
  wavesurfer.stop();
  if (loopRegion) {
    loopRegion.remove();
    loopRegion = null;
  }
  wsRegions.clearRegions();
  setLoopUI(false);
  setPlayingUI(false);
  bankSessionSegment(); // credit the outgoing song; the session keeps running across track changes
  setNotesEnabled(false);
  stopMetronome();
  setMemorize(false);
  setDrone(false);
  resetTranspose();
  resetChannelMode();
  resetFx();
  clearObjectURL();
  invalidateDecodedCache();
  currentSongId = null;
  currentSourceUrl = null;
  closePanel(pianoBody, showPianoButton);
  closePanel(metroBody, showMetronomeButton);
  closePanel(practiceBody, showPracticeButton);
  closePanel(fxBody, showFxButton);
  closePanel(droneBody, showDroneButton);
  closePanel(fretboardBody, showFretboardButton);
  moveTabIndicator(); // nothing active now -> fade the pill out
  closeSetlistPopover();
  thumbAndTitleZone.classList.add("hidden");
  waveformCard.classList.add("hidden");
  controlsRow.classList.add("hidden");
  sectionTabs.classList.add("hidden");
  loadingZone.classList.remove("hidden");
  waveEmpty.classList.remove("hidden");
  fileIsLoaded = false;
  setControlsEnabled(false);
  currentTimeEl.textContent = "0:00";
  durationTimeEl.textContent = "0:00";
  clearSession();
  renderSetlists();
}

// Guard the destructive "Change" with a click-to-confirm when a loop
// exists (the loop region would be lost). No loop means change immediately.
let _changeArmed = false;
let _changeTimer = null;
function disarmChange() {
  _changeArmed = false;
  if (_changeTimer) { clearTimeout(_changeTimer); _changeTimer = null; }
  changeLabel.textContent = "Change";
  addNewAudioButton.classList.remove("confirming");
}
addNewAudioButton.addEventListener("click", () => {
  if (loopRegion && !_changeArmed) {
    _changeArmed = true;
    changeLabel.textContent = "Discard loop?";
    addNewAudioButton.classList.add("confirming");
    _changeTimer = setTimeout(disarmChange, 3000);
    return;
  }
  disarmChange();
  teardownTrack();
});

// ----- Download (direct link; server file for YouTube, the file itself otherwise) -----
downloadAudioButton.addEventListener("click", () => {
  if (!audioFile) return;
  const a = document.createElement("a");
  if (sourceType === "file" && currentObjectURL) {
    a.href = currentObjectURL;
    a.download = audioFile; // original filename already has its extension
  } else {
    // Keep the real video title; only strip characters illegal in filenames.
    const safeTitle = (window.currentAudioTitle || "audio")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // chars Windows/most OSes forbid
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/, "") // no trailing dots (Windows)
      || "audio";
    const ext = audioFile.split(".").pop();
    a.href = `/audio/${audioFile}?t=${Date.now()}`;
    a.download = `${safeTitle}.${ext}`;
  }
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// ----- Session restore -----
const SESSION_KEY = "loopretto.session";
function saveSession() {
  if (!fileIsLoaded || sourceType === "file" || !currentSourceUrl) return;
  const state = {
    url: currentSourceUrl,
    title: window.currentAudioTitle || "",
    loopActive: !!loopRegion,
    loopStart: loopRegion ? loopRegion.start : null,
    loopEnd: loopRegion ? loopRegion.end : null,
    speed: currentSpeed,
    pitch: semitoneOffset,
    zoom: currentZoom,
  };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function applyPendingRestore() {
  if (!pendingRestore) return;
  const r = pendingRestore;
  pendingRestore = null;
  if (typeof r.speed === "number" && r.speed > 0) {
    currentSpeed = Math.max(0.1, Math.min(2.0, r.speed));
    wavesurfer.setPlaybackRate(currentSpeed, true);
    updateSpeedDisplay();
  }
  if (typeof r.pitch === "number" && r.pitch !== 0) setTranspose(r.pitch);
  if (typeof r.zoom === "number" && r.zoom > 0) {
    currentZoom = Math.max(0, Math.min(100, r.zoom));
    try { wavesurfer.zoom(currentZoom * 2.5); } catch (e) {}
    updateZoomSlider(currentZoom);
  }
  if (r.loopActive && typeof r.loopStart === "number" && typeof r.loopEnd === "number") {
    const dur = wavesurfer.getDuration();
    loopStart = Math.max(0, Math.min(r.loopStart, dur));
    loopEnd = Math.max(loopStart + 0.1, Math.min(r.loopEnd, dur));
    if (loopRegion) { loopRegion.remove(); loopRegion = null; }
    loopRegion = wsRegions.addRegion({
      start: loopStart, end: loopEnd,
      color: getRegionColor(), drag: true, resize: true,
    });
    setLoopUI(true);
    refreshLoopTag();
  }
}

(function initResume() {
  const s = readSession();
  if (!s || !s.url) { resumeBanner.style.display = "none"; return; }
  resumeTitle.textContent = s.title || s.url;
  resumeBanner.style.display = "";
})();
resumeBtn.addEventListener("click", () => {
  const s = readSession();
  if (!s || !s.url) { resumeBanner.style.display = "none"; return; }
  pendingRestore = s;
  urlInput.value = s.url;
  resumeBanner.style.display = "none";
  loadAudio();
});
resumeDismiss.addEventListener("click", () => {
  resumeBanner.style.display = "none";
  clearSession();
});
setInterval(saveSession, 5000);
window.addEventListener("beforeunload", saveSession);

// ----- Setlists -----
function updateSaveSetlistButton() {
  const ok = sourceType !== "file" && !!currentSourceUrl;
  saveSetlistButton.disabled = !ok;
  saveSetlistButton.title = ok ? "Save this song to a setlist" : "Local files can't be saved to a setlist";
}

function currentSongForSetlist() {
  if (sourceType === "file" || !currentSourceUrl) return null;
  return {
    id: currentSongId,
    title: window.currentAudioTitle || currentSourceUrl,
    url: currentSourceUrl,
    sourceType: "url",
  };
}

function renderSetlists() {
  const lists = SetlistStore.all();
  setlistsBody.innerHTML = "";
  if (!lists.length) { setlistsEl.style.display = "none"; return; }
  setlistsEl.style.display = "";
  lists.forEach((list) => {
    const group = document.createElement("div");
    group.className = "setlist-group";
    const head = document.createElement("div");
    head.className = "setlist-group-head";
    const name = document.createElement("span");
    name.className = "setlist-name";
    name.textContent = `${list.name} · ${list.songs.length}`;
    const del = document.createElement("button");
    del.className = "linkish danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => { SetlistStore.remove(list.name); renderSetlists(); });
    head.appendChild(name);
    head.appendChild(del);
    group.appendChild(head);
    if (!list.songs.length) {
      const empty = document.createElement("div");
      empty.className = "setlist-empty";
      empty.textContent = "Empty. Load a song and Save it here.";
      group.appendChild(empty);
    }
    list.songs.forEach((song) => {
      const row = document.createElement("div");
      row.className = "setlist-song";
      const load = document.createElement("button");
      load.className = "setlist-song-load";
      load.textContent = song.title || song.url;
      load.title = "Load " + (song.title || song.url);
      load.addEventListener("click", () => { urlInput.value = song.url; loadAudio(); });
      const rm = document.createElement("button");
      rm.className = "setlist-song-rm";
      rm.textContent = "×";
      rm.title = "Remove from setlist";
      rm.addEventListener("click", () => { SetlistStore.removeSong(list.name, song.id); renderSetlists(); });
      row.appendChild(load);
      row.appendChild(rm);
      group.appendChild(row);
    });
    setlistsBody.appendChild(group);
  });
}

setlistNewBtn.addEventListener("click", () => {
  const name = prompt("Name the new setlist:");
  if (name && name.trim()) { SetlistStore.create(name.trim()); renderSetlists(); }
});

function renderSetlistPopover() {
  const song = currentSongForSetlist();
  setlistPopoverList.innerHTML = "";
  const names = SetlistStore.names();
  if (!names.length) {
    const hint = document.createElement("div");
    hint.className = "setlist-empty";
    hint.textContent = "No setlists yet. Create one below.";
    setlistPopoverList.appendChild(hint);
  }
  names.forEach((n) => {
    const row = document.createElement("button");
    row.className = "setlist-pick";
    const inIt = song && SetlistStore.has(n, song.id);
    if (inIt) row.classList.add("in");
    row.textContent = (inIt ? "✓ " : "+ ") + n;
    row.addEventListener("click", () => {
      if (!song) return;
      if (SetlistStore.has(n, song.id)) {
        SetlistStore.removeSong(n, song.id);
        toast(`Removed from "${n}"`, "info");
      } else {
        SetlistStore.addSong(n, song);
        toast(`Saved to "${n}"`, "success");
      }
      renderSetlistPopover();
      renderSetlists();
    });
    setlistPopoverList.appendChild(row);
  });
}
function openSetlistPopover() { renderSetlistPopover(); setlistPopover.style.display = ""; }
function closeSetlistPopover() { setlistPopover.style.display = "none"; }

saveSetlistButton.addEventListener("click", (e) => {
  e.stopPropagation();
  if (saveSetlistButton.disabled) return;
  if (setlistPopover.style.display === "none") openSetlistPopover();
  else closeSetlistPopover();
});
setlistPopoverNew.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = setlistNewName.value.trim();
  if (!name) return;
  const song = currentSongForSetlist();
  SetlistStore.create(name);
  if (song) {
    SetlistStore.addSong(name, song);
    toast(`Saved to "${name}"`, "success");
  } else {
    toast(`Created setlist "${name}"`, "success");
  }
  setlistNewName.value = "";
  renderSetlistPopover();
  renderSetlists();
});
document.addEventListener("click", (e) => {
  if (setlistPopover.style.display !== "none" && !e.target.closest(".setlist-save-wrap")) {
    closeSetlistPopover();
  }
});

renderSetlists();

// ----- Loop button -----
loopButton.addEventListener("click", () => {
  if (loopRegion) {
    loopRegion.remove();
    loopRegion = null;
    loopStart = masterClickTime;
    loopEnd = masterLoopEndTime;
    setLoopUI(false);
  } else if (loopStart !== null) {
    const duration = wavesurfer.getDuration();
    loopEnd = Math.min(loopStart + 5, duration);
    loopRegion = wsRegions.addRegion({
      start: loopStart,
      end: loopEnd,
      color: getRegionColor(),
      drag: true,
      resize: true,
    });
    setLoopUI(true);
    refreshLoopTag();
  } else {
    toast("Click on the waveform to set a marker, then create a loop.");
  }
});

// ----- Play/Pause -----
function togglePlayPause() {
  if (!fileIsLoaded) return;
  ensureAudioGraph();
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    setPlayingUI(false);
    if (loopStart !== null) {
      wavesurfer.setTime(loopStart);
    }
  } else {
    if (loopStart !== null) {
      wavesurfer.setTime(loopStart);
    } else {
      loopStart = 0;
      wavesurfer.setTime(0);
    }
    wavesurfer.play();
    setPlayingUI(true);
  }
}

playPauseButton.addEventListener("click", () => {
  togglePlayPause();
});

// ----- Keyboard shortcuts -----
document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

  // "?" opens the shortcuts overlay; Escape closes it. Both work any time.
  if (e.key === "?") {
    e.preventDefault();
    toggleShortcuts();
    return;
  }
  if (e.key === "Escape" && isShortcutsOpen()) {
    closeShortcuts();
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    if (fileIsLoaded) togglePlayPause();
    return;
  }
  // Focus mode works without a track loaded too.
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    toggleZen();
    return;
  }
  if (!fileIsLoaded) return;

  const currentTime = wavesurfer.getCurrentTime();
  const duration = wavesurfer.getDuration();
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    wavesurfer.setTime(Math.max(0, currentTime - 0.5));
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    wavesurfer.setTime(Math.min(duration, currentTime + 0.5));
  }
});

// ----- Speed (preserves pitch) -----
speedDownButton.addEventListener("click", () => {
  if (currentSpeed > 0.1) {
    currentSpeed = Math.max(0.1, Math.round((currentSpeed - 0.1) * 10) / 10);
    wavesurfer.setPlaybackRate(currentSpeed, true);
    updateSpeedDisplay();
  }
});

speedUpButton.addEventListener("click", () => {
  if (currentSpeed < 2.0) {
    currentSpeed = Math.min(2.0, Math.round((currentSpeed + 0.1) * 10) / 10);
    wavesurfer.setPlaybackRate(currentSpeed, true);
    updateSpeedDisplay();
  }
});

// ----- Zoom -----
// Wheel events fire rapidly (especially on trackpads); coalesce the canvas
// re-render to one per animation frame.
let zoomScheduled = false;
function applyWheelZoom() {
  zoomScheduled = false;
  try { wavesurfer.zoom(currentZoom * 5); } catch (e) {}
}

waveformEl.addEventListener("wheel", (e) => {
  if (!fileIsLoaded) return;
  e.preventDefault();
  currentZoom = Math.max(0, Math.min(100, currentZoom + (e.deltaY < 0 ? 10 : -10)));
  updateZoomSlider(currentZoom);
  if (!zoomScheduled) {
    zoomScheduled = true;
    requestAnimationFrame(applyWheelZoom);
  }
}, { passive: false });

zoomSlider.addEventListener("input", (event) => {
  currentZoom = Math.max(0, Math.min(100, Number(event.target.value)));
  try { wavesurfer.zoom(currentZoom * 2.5); } catch (e) {}
  updateZoomSlider(currentZoom);
});

// Zoom all the way out so the whole track fits the waveform again.
function resetZoom() {
  currentZoom = 0;
  try { wavesurfer.zoom(currentZoom * 2.5); } catch (e) {}
  updateZoomSlider(currentZoom);
}
zoomResetBtn.addEventListener("click", resetZoom);

// ----- Channel isolation / vocal removal (mid-side) -----
function setChannelMode(mode) {
  channelMode = mode;
  ensureAudioGraph(); // build the graph if this is the first audio gesture
  applyChannelMode(mode);
  updateChannelUI();
}
function updateChannelUI() {
  channelSeg.querySelectorAll(".seg-btn").forEach((b) => {
    const on = b.dataset.chan === channelMode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
function resetChannelMode() {
  channelMode = "stereo";
  applyChannelMode("stereo");
  updateChannelUI();
}
channelSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn || btn.disabled) return;
  setChannelMode(btn.dataset.chan);
});

// ----- Sound FX panel (EQ / spotlight / punch) -----
const fxBody = $("fx-body");
const eqPresetSel = $("eq-preset");
const spotlightBlock = document.querySelector(".spotlight-block");
const spotlightToggle = $("spotlight-toggle");
const spotlightFreq = $("spotlight-freq");
const spotlightQ = $("spotlight-q");
const spotlightFreqLabel = $("spotlight-freq-label");
const spotlightStateHint = $("spotlight-state-hint");
const spotlightViz = $("spotlight-viz");
const spotlightCanvas = $("spotlight-canvas");
const spotlightCtx = spotlightCanvas ? spotlightCanvas.getContext("2d") : null;
const punchToggle = $("punch-toggle");

// Visualizer frequency axis (a touch wider than the slider's 50 Hz–8 kHz reach).
const SPOT_VIZ_FMIN = 30, SPOT_VIZ_FMAX = 18000;
const SPOT_VIZ_TICKS = [100, 1000, 10000];

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// Analytic band-pass magnitude (0–1, peak 1 at center) so the curve renders
// even before the audio graph exists; matches the BiquadFilter "bandpass" shape.
function bandpassMag(f, f0, q) {
  const r = f / f0 - f0 / f;
  return 1 / Math.sqrt(1 + q * q * r * r);
}

let spotlightRaf = 0;
function requestSpotlightDraw() {
  if (spotlightRaf) return;
  spotlightRaf = requestAnimationFrame(() => { spotlightRaf = 0; drawSpotlight(); });
}

function drawSpotlight() {
  if (!spotlightReady || !spotlightCtx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = spotlightViz.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (w < 2 || h < 2) return; // panel hidden; ResizeObserver redraws when shown
  if (spotlightCanvas.width !== w * dpr || spotlightCanvas.height !== h * dpr) {
    spotlightCanvas.width = w * dpr;
    spotlightCanvas.height = h * dpr;
  }
  const ctx = spotlightCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const logMin = Math.log10(SPOT_VIZ_FMIN), logMax = Math.log10(SPOT_VIZ_FMAX);
  const span = logMax - logMin;
  const xToFreq = (x) => Math.pow(10, logMin + (x / w) * span);
  const freqToX = (f) => ((Math.log10(f) - logMin) / span) * w;

  const f0 = spotlightFreqFromSlider();
  const q = spotlightQFromSlider();
  const on = spotlightOn;
  const accent = cssVar("--accent");
  const curveColor = on ? accent : cssVar("--text-dim");
  const top = 6, base = h - 2;

  // Frequency gridlines + labels.
  ctx.lineWidth = 1;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "bottom";
  SPOT_VIZ_TICKS.forEach((f) => {
    const x = Math.round(freqToX(f)) + 0.5;
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = cssVar("--border");
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = cssVar("--text-dim");
    ctx.fillText(f >= 1000 ? f / 1000 + "k" : String(f), x + 4, h - 3);
  });
  ctx.globalAlpha = 1;

  // Response curve.
  const pts = [];
  for (let x = 0; x <= w; x += 2) {
    const mag = bandpassMag(xToFreq(x), f0, q);
    pts.push([x, base - mag * (base - top)]);
  }

  // Soft fill under the curve.
  ctx.beginPath();
  ctx.moveTo(0, base + 2);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(w, base + 2);
  ctx.closePath();
  ctx.globalAlpha = on ? 0.22 : 0.1;
  ctx.fillStyle = curveColor;
  ctx.fill();

  // Stroke, with a glow when active.
  ctx.globalAlpha = 1;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = curveColor;
  ctx.shadowColor = on ? accent : "transparent";
  ctx.shadowBlur = on ? 10 : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Peak marker at the center frequency.
  const peakX = freqToX(f0), peakY = top;
  ctx.globalAlpha = on ? 0.35 : 0.18;
  ctx.strokeStyle = curveColor;
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(peakX, peakY); ctx.lineTo(peakX, base); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(peakX, peakY + 1, on ? 4 : 3, 0, Math.PI * 2);
  ctx.fillStyle = curveColor;
  ctx.fill();
}

function setEqPreset(preset) {
  eqPreset = preset;
  ensureAudioGraph();
  applyEqPreset(preset);
  rebuildFxChain();
}
function setSpotlight(on) {
  spotlightOn = on;
  ensureAudioGraph();
  spotlightToggle.classList.toggle("active", on);
  spotlightToggle.setAttribute("aria-pressed", on ? "true" : "false");
  spotlightToggle.textContent = on ? "On" : "Off";
  if (spotlightBlock) spotlightBlock.classList.toggle("spotlight-on", on);
  if (spotlightStateHint) spotlightStateHint.textContent = on ? "Soloing this band" : "Preview only - turn on to hear it";
  drawSpotlight();
  rebuildFxChain();
}
function setPunch(on) {
  punchOn = on;
  ensureAudioGraph();
  punchToggle.classList.toggle("active", on);
  punchToggle.setAttribute("aria-pressed", on ? "true" : "false");
  punchToggle.textContent = on ? "On" : "Off";
  rebuildFxChain();
}
function updateSpotlightFreqLabel() {
  spotlightFreqLabel.textContent = `${Math.round(spotlightFreqFromSlider())} Hz`;
}
function resetFx() {
  eqPreset = "off";
  spotlightOn = false;
  punchOn = false;
  eqPresetSel.value = "off";
  spotlightToggle.classList.remove("active");
  spotlightToggle.setAttribute("aria-pressed", "false");
  spotlightToggle.textContent = "Off";
  if (spotlightBlock) spotlightBlock.classList.remove("spotlight-on");
  if (spotlightStateHint) spotlightStateHint.textContent = "Preview only - turn on to hear it";
  punchToggle.classList.remove("active");
  punchToggle.setAttribute("aria-pressed", "false");
  punchToggle.textContent = "Off";
  applyEqPreset("off");
  drawSpotlight();
  rebuildFxChain();
}

eqPresetSel.addEventListener("change", () => setEqPreset(eqPresetSel.value));
spotlightToggle.addEventListener("click", () => setSpotlight(!spotlightOn));
punchToggle.addEventListener("click", () => setPunch(!punchOn));
spotlightFreq.addEventListener("input", () => {
  updateSpotlightFreqLabel();
  requestSpotlightDraw();
  if (bandpassNode && audioCtx) {
    bandpassNode.frequency.setTargetAtTime(spotlightFreqFromSlider(), audioCtx.currentTime, 0.02);
  }
});
spotlightQ.addEventListener("input", () => {
  requestSpotlightDraw();
  if (bandpassNode && audioCtx) {
    bandpassNode.Q.setTargetAtTime(spotlightQFromSlider(), audioCtx.currentTime, 0.02);
  }
});
updateSpotlightFreqLabel();

// The FX panel starts hidden (0×0), so draw once it gains a size and on resize.
spotlightReady = true;
if (spotlightViz && "ResizeObserver" in window) {
  new ResizeObserver(() => requestSpotlightDraw()).observe(spotlightViz);
}
drawSpotlight();

showFxButton.addEventListener("click", () => {
  selectSection(fxBody, showFxButton);
  requestSpotlightDraw();
});

// ----- Panel toggles (Metronome / Piano) -----
const pianoBody = $("piano-body");
function openPanel(panel, btn) { panel.classList.add("show"); btn.classList.add("active"); btn.setAttribute("aria-selected", "true"); }
function closePanel(panel, btn) { panel.classList.remove("show"); btn.classList.remove("active"); btn.setAttribute("aria-selected", "false"); }

// The section tabs behave like a tablist: picking one opens its panel and closes
// the rest; clicking the active tab collapses it. The accent pill (.tab-indicator)
// glides behind the active tab and fades out when nothing is selected. The panel
// refs it closes over are defined further down, so this resolves them at call
// time via getSectionPanels() rather than capturing them now.
function getSectionPanels() {
  return [
    [fxBody, showFxButton],
    [practiceBody, showPracticeButton],
    [metroBody, showMetronomeButton],
    [droneBody, showDroneButton],
    [pianoBody, showPianoButton],
    [fretboardBody, showFretboardButton],
  ];
}

function moveTabIndicator() {
  const active = tabsTrack.querySelector(".section-tab.active");
  if (!active) {
    tabIndicator.classList.remove("show");
    return;
  }
  // offsetLeft/offsetWidth are relative to .tabs-track (the indicator's
  // offsetParent), so they map straight onto the pill.
  tabIndicator.style.width = `${active.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
  tabIndicator.classList.add("show");
  active.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function selectSection(panel, btn) {
  const willOpen = !panel.classList.contains("show");
  getSectionPanels().forEach(([p, b]) => closePanel(p, b));
  if (willOpen) openPanel(panel, btn);
  moveTabIndicator();
}

// Pin every section panel to the height of the tallest one, so switching tabs
// never resizes the card and the page below it doesn't jump. We briefly render
// each hidden panel (kept invisible, no paint happens mid-task) to read its
// natural height with the floor removed, then publish the max as --section-min-h.
function syncSectionHeights() {
  if (!sectionTabs || sectionTabs.classList.contains("hidden")) return;
  const root = document.documentElement;
  root.style.setProperty("--section-min-h", "0px"); // measure natural heights, not the floor
  let max = 0;
  getSectionPanels().forEach(([p]) => {
    if (!p) return;
    const shown = p.classList.contains("show");
    if (!shown) { p.style.visibility = "hidden"; p.classList.add("show"); }
    max = Math.max(max, p.offsetHeight);
    if (!shown) { p.classList.remove("show"); p.style.visibility = ""; }
  });
  root.style.setProperty("--section-min-h", max > 0 ? `${max}px` : "auto");
}

// Reposition the pill and re-pin the shared height when the viewport reflows.
let _heightSyncRaf = 0;
window.addEventListener("resize", () => {
  if (!sectionTabs || sectionTabs.classList.contains("hidden")) return;
  moveTabIndicator();
  if (_heightSyncRaf) cancelAnimationFrame(_heightSyncRaf);
  _heightSyncRaf = requestAnimationFrame(syncSectionHeights);
});

// ----- Pitch shift (transpose, tempo unchanged) -----
function updatePitchDisplay() {
  const sign = semitoneOffset > 0 ? "+" : "";
  pitchDisplay.textContent = `${sign}${semitoneOffset}`;
  pitchDisplay.classList.toggle("changed", semitoneOffset !== 0);
}
function resetTranspose() {
  semitoneOffset = 0;
  updatePitchDisplay();
  if (audioCtx) routePitch();
}
function setTranspose(semitones) {
  semitoneOffset = Math.max(-12, Math.min(12, semitones));
  updatePitchDisplay();
  ensureAudioGraph();
  routePitch();
}
pitchDownButton.addEventListener("click", () => { setTranspose(semitoneOffset - 1); });
pitchUpButton.addEventListener("click", () => { setTranspose(semitoneOffset + 1); });

// ----- Root-note detection overlay -----
// Instead of a flickering live pitch, accumulate detected pitches into a
// decaying pitch-class histogram and show only the dominant one, the root /
// tonal centre of whatever's playing. The decay lets it follow section changes.
const PC_NAMES = PitchDetect.NOTE_NAMES;
const _noteBuf = new Float32Array(2048);
const pcWeights = new Float32Array(12);

function setNotesEnabled(on) {
  notesOn = on;
  showNotesButton.classList.toggle("active", on);
  showNotesButton.setAttribute("aria-pressed", on ? "true" : "false");
  if (on) {
    ensureAudioGraph();
    pcWeights.fill(0);
    noteRootEl.textContent = "–"; // placeholder until a root is detected
    if (!noteRafId) detectLoop();
  } else {
    // Off: the button is just "Notes" again — clear the in-button readout.
    noteRootEl.textContent = "";
    if (noteRafId) {
      cancelAnimationFrame(noteRafId);
      noteRafId = null;
    }
  }
}
showNotesButton.addEventListener("click", () => { setNotesEnabled(!notesOn); });

// Autocorrelation is O(n^2) per call, so run it every 3rd frame (~20Hz) rather
// than every frame; the root note doesn't move fast enough to need 60Hz, and
// this keeps the main thread free during playback on slower machines.
let _noteFrame = 0;
const NOTE_DECIMATE = 3;
function detectLoop() {
  noteRafId = requestAnimationFrame(detectLoop);
  if (!analyser) return;
  if (_noteFrame++ % NOTE_DECIMATE !== 0) return;
  analyser.getFloatTimeDomainData(_noteBuf);
  const freq = PitchDetect.autoCorrelate(_noteBuf, audioCtx.sampleRate);

  // Decay each detection pass so the root tracks the current passage (~1s
  // memory). 0.91 ≈ the old per-frame 0.97 compounded over NOTE_DECIMATE frames.
  for (let i = 0; i < 12; i++) pcWeights[i] *= 0.91;

  if (freq > 0) {
    const n = PitchDetect.freqToNote(freq);
    const pc = ((n.midi % 12) + 12) % 12;
    const conf = 1 - Math.min(Math.abs(n.cents), 50) / 50; // in-tune ⇒ trust it more
    pcWeights[pc] += 0.4 + 0.6 * conf;
  }

  let idx = -1;
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (pcWeights[i] > max) { max = pcWeights[i]; idx = i; }
  }
  // Require a little accumulated evidence so noise/silence doesn't show a root.
  noteRootEl.textContent = idx >= 0 && max > 1.5 ? PC_NAMES[idx] : "-";
}

// ----- Metronome -----
const bpmDisplay = $("bpm-display");
const metroToggle = $("metro-toggle");
const metroToggleLabel = $("metro-toggle-label");
const metroPlayIcon = $("metro-play-icon");
const metroStopIcon = $("metro-stop-icon");
const bpmDown = $("bpm-down");
const bpmUp = $("bpm-up");
const metroTap = $("metro-tap");
const metroSync = $("metro-sync");
const metroSyncLabel = $("metro-sync-label");
const metroBeats = $("metro-beats");
const beatDots = $("beat-dots");

function renderBeatDots() {
  beatDots.innerHTML = "";
  for (let i = 0; i < metronome.beatsPerBar; i++) {
    const d = document.createElement("span");
    d.className = "beat-dot" + (i === 0 && metronome.beatsPerBar > 1 ? " down" : "");
    beatDots.appendChild(d);
  }
}
function updateBpmDisplay() { bpmDisplay.textContent = String(metronome.bpm); }
function setMetroPlayingUI(running) {
  metroToggle.classList.toggle("active", running);
  metroToggle.setAttribute("aria-pressed", running ? "true" : "false");
  metroToggleLabel.textContent = running ? "Stop" : "Start";
  metroPlayIcon.style.display = running ? "none" : "block";
  metroStopIcon.style.display = running ? "block" : "none";
  if (!running) [...beatDots.children].forEach((d) => d.classList.remove("on"));
}
function stopMetronome() {
  metronome.stop();
  setMetroPlayingUI(false);
}
metronome.onBeat = (beat) => {
  const dots = beatDots.children;
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i === beat);
};
metroToggle.addEventListener("click", () => {
  ensureAudioGraph();
  setMetroPlayingUI(metronome.toggle());
});
bpmDown.addEventListener("click", () => { metronome.setBpm(metronome.bpm - 1); updateBpmDisplay(); });
bpmUp.addEventListener("click", () => { metronome.setBpm(metronome.bpm + 1); updateBpmDisplay(); });
metroTap.addEventListener("click", () => { ensureAudioGraph(); metronome.tap(); updateBpmDisplay(); });

// Detect the loaded track's tempo and set the metronome to it.
metroSync.addEventListener("click", async () => {
  if (!fileIsLoaded || metroSync.disabled) return;
  metroSync.disabled = true;
  metroSyncLabel.textContent = "Detecting…";
  try {
    const buffer = await decodeCurrentSource();
    const bpm = TempoDetect.detect(buffer);
    if (bpm) {
      metronome.setBpm(bpm);
      updateBpmDisplay();
      metroSyncLabel.textContent = `${bpm} BPM`;
    } else {
      metroSyncLabel.textContent = "No tempo found";
    }
  } catch (e) {
    console.error("tempo detection failed", e);
    metroSyncLabel.textContent = "Failed";
  } finally {
    setTimeout(() => { metroSyncLabel.textContent = "Sync to track"; }, 1600);
    metroSync.disabled = false;
  }
});
metroBeats.addEventListener("change", () => {
  metronome.setBeatsPerBar(parseInt(metroBeats.value, 10));
  renderBeatDots();
});
showMetronomeButton.addEventListener("click", () => { selectSection(metroBody, showMetronomeButton); });

renderBeatDots();
updateBpmDisplay();
updatePitchDisplay();

// ----- Practice tools (session/journal, reps, memorize) -----
const practiceBody = $("practice-body");
const droneBody = $("drone-body");
const psSession = $("ps-session");
const psSong = $("ps-song");
const psToday = $("ps-today");
const psTodayReps = $("ps-today-reps");
const sessionToggle = $("session-toggle");
const sessionNew = $("session-new");
const sessionNote = $("session-note");
const goalFill = $("goal-fill");
const goalMinEl = $("goal-min");
const goalPct = $("goal-pct");
const goalDown = $("goal-down");
const goalUp = $("goal-up");
const streakFlame = $("streak-flame");
const streakNum = $("streak-num");
const streakBest = $("streak-best");
const streakFreezes = $("streak-freezes");
const streakWeek = $("streak-week");
let prevStreak = null;
const pomoCountdown = $("pomo-countdown");
const pomoToggle = $("pomo-toggle");
const pomoStatus = $("pomo-status");
const pomoFocusEl = $("pomo-focus");
const pomoBreakEl = $("pomo-break");
const pomoFocusDown = $("pomo-focus-down");
const pomoFocusUp = $("pomo-focus-up");
const pomoBreakDown = $("pomo-break-down");
const pomoBreakUp = $("pomo-break-up");
const journalToggle = $("journal-toggle");
const journalEl = $("journal");
const repCount = $("rep-count");
const repReset = $("rep-reset");
const memorizeToggle = $("memorize-toggle");
const memorizeLevel = $("memorize-level");
const droneVoices = [1, 2, 3].map((i) => ({
  toggle: $("drone-toggle-" + i),
  note: $("drone-note-" + i),
  octave: $("drone-octave-" + i),
  on: false,
  nodes: null,
}));
const droneOctaveDown = $("drone-octave-down");
const droneVol = $("drone-vol");

function fmtClock(ms) {
  let s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function computeSongId(idPart, type) {
  if (type === "file") return "file:" + idPart;
  const m = idPart.match(/[?&]v=([\w-]+)/) || idPart.match(/youtu\.be\/([\w-]+)/);
  return "yt:" + (m ? m[1] : idPart);
}

function beginSong(songId, title) {
  // If a session is running, bank the previous song's segment before switching
  // so each song's "this song" total stays accurate across track changes.
  bankSessionSegment();
  currentSongId = songId;
  window.currentAudioTitle = title || window.currentAudioTitle;
  loopReps = 0;
  updateRepDisplay();
  resetMemorizeLevel();
  updatePracticeDisplay();
}

// --- Practice session timer (manual, wall-clock) ---
// Bank the elapsed-since-the-last-mark to the current song. addTime() also
// increments today's total, so the daily total is the sum of segments (no
// double counting). Resets the mark so the next call banks only new time.
function bankSessionSegment() {
  if (!sessionActive || sessionMarkTs == null) return;
  const ms = performance.now() - sessionMarkTs;
  sessionMarkTs = performance.now();
  if (ms > 0 && currentSongId) PracticeStore.addTime(currentSongId, window.currentAudioTitle, ms);
}
function startSession() {
  sessionActive = true;
  sessionStartTs = sessionMarkTs = performance.now();
  sessionReps = 0;
  if (!sessionTickId) sessionTickId = setInterval(updatePracticeDisplay, 1000);
  updateSessionUI();
  updatePracticeDisplay();
}
function stopSession() {
  if (!sessionActive) return;
  const total = performance.now() - sessionStartTs;
  bankSessionSegment();
  PracticeStore.addSession({
    start: Date.now() - total,
    ms: total,
    songId: currentSongId,
    title: window.currentAudioTitle,
    note: sessionNote ? sessionNote.value.trim() : "",
    reps: sessionReps,
    pomos: pomoCompleted,
  });
  if (journalSyncOn) saveJournalToDisk({ silent: true });
  sessionActive = false;
  sessionMarkTs = null;
  if (sessionTickId) { clearInterval(sessionTickId); sessionTickId = null; }
  updateSessionUI();
  updatePracticeDisplay();
}
function newSession() {
  if (sessionActive) stopSession();
  if (sessionNote) sessionNote.value = "";
  startSession();
}
function updateSessionUI() {
  sessionToggle.classList.toggle("active", sessionActive);
  sessionToggle.setAttribute("aria-pressed", sessionActive ? "true" : "false");
  sessionToggle.textContent = sessionActive ? "Stop" : "Start";
}
function updatePracticeDisplay() {
  // live = the current per-song segment that hasn't been banked yet.
  const live = sessionActive && sessionMarkTs != null ? performance.now() - sessionMarkTs : 0;
  const songTotal = (currentSongId ? PracticeStore.song(currentSongId).totalMs : 0) + live;
  const sessionElapsed = sessionActive ? performance.now() - sessionStartTs : 0;
  psSession.textContent = fmtClock(sessionElapsed);
  psSong.textContent = fmtClock(songTotal);
  const t = PracticeStore.today();
  psToday.textContent = fmtClock(t.ms + live);
  psTodayReps.textContent = String(t.reps);
  if (practiceTime) practiceTime.textContent = fmtClock(songTotal);
  updateGoalDisplay(t.ms + live);
  updateStreakDisplay();
}
// On a hard close, bank the open segment so the time isn't lost. A full session
// entry is only recorded on an explicit Stop.
window.addEventListener("beforeunload", bankSessionSegment);
sessionToggle.addEventListener("click", () => { if (sessionActive) stopSession(); else startSession(); });
sessionNew.addEventListener("click", () => { newSession(); });

// --- Daily goal + streak ---
function updateGoalDisplay(todayMs) {
  if (typeof todayMs !== "number") {
    const live = sessionActive && sessionMarkTs != null ? performance.now() - sessionMarkTs : 0;
    todayMs = PracticeStore.today().ms + live;
  }
  const goalMs = PracticeStore.getGoal() * 60000;
  const pct = goalMs > 0 ? Math.min(100, (todayMs / goalMs) * 100) : 0;
  goalFill.style.width = pct + "%";
  goalFill.classList.toggle("met", pct >= 100);
  goalPct.textContent = Math.round(pct) + "%";
  goalMinEl.textContent = String(PracticeStore.getGoal());
}
goalDown.addEventListener("click", () => { PracticeStore.setGoal(PracticeStore.getGoal() - 5); updateGoalDisplay(); });
goalUp.addEventListener("click", () => { PracticeStore.setGoal(PracticeStore.getGoal() + 5); updateGoalDisplay(); });

// --- Streak (flame + best + freezes + week dots, with milestone celebration) ---
const DAY_MS = 86400000;
const STREAK_MILESTONES = [7, 30, 100, 365];
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function dayKeyUTC(date) {
  return date.toISOString().slice(0, 10);
}

function renderStreakWeek() {
  if (!streakWeek) return;
  // Current week, Sunday -> Saturday, in UTC to match PracticeStore day keys.
  const now = new Date();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  const todayKey = dayKeyUTC(now);
  let html = "";
  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday.getTime() + i * DAY_MS);
    const key = dayKeyUTC(day);
    const info = PracticeStore.dayInfo(key);
    const cls = ["streak-day"];
    if (info.frozen) cls.push("frozen");
    else if (info.ms > 0) cls.push("practiced");
    if (key === todayKey) cls.push("today");
    if (key > todayKey) cls.push("future");
    html += `<span class="${cls.join(" ")}"><span class="streak-dot"></span><span class="streak-dow">${WEEKDAY_INITIALS[i]}</span></span>`;
  }
  streakWeek.innerHTML = html;
}

function updateStreakDisplay() {
  const info = PracticeStore.refreshStreak();
  const cur = info.current;
  const live = sessionActive && sessionMarkTs != null ? performance.now() - sessionMarkTs : 0;
  const doneToday = PracticeStore.today().ms + live > 0;

  if (streakNum) streakNum.textContent = String(cur);
  if (streakFlame) streakFlame.classList.toggle("lit", doneToday && cur > 0);
  if (streakBest) streakBest.textContent = "Best " + info.best;
  if (streakFreezes) {
    streakFreezes.textContent = info.freezes > 0 ? "❄ × " + info.freezes : "";
    streakFreezes.style.display = info.freezes > 0 ? "" : "none";
  }
  renderStreakWeek();

  // Celebrate only when the streak actually grows (first practice of a new day),
  // never on the initial page-load read.
  if (prevStreak != null && cur > prevStreak) {
    if (streakFlame) {
      streakFlame.classList.remove("pulse");
      void streakFlame.offsetWidth; // restart the animation
      streakFlame.classList.add("pulse");
    }
    if (STREAK_MILESTONES.indexOf(cur) !== -1) {
      toast(`🔥 ${cur} day streak!`, "success");
    } else {
      toast(`Streak extended · ${cur} day${cur === 1 ? "" : "s"}`, "info");
    }
    if (typeof playChime === "function") playChime();
  }
  prevStreak = cur;
}

// --- Pomodoro ---
function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function updatePomoUI() {
  pomoToggle.classList.toggle("active", pomoActive);
  pomoToggle.setAttribute("aria-pressed", pomoActive ? "true" : "false");
  pomoToggle.textContent = pomoActive ? "Stop" : "Start";
  pomoStatus.innerHTML = `${pomoPhase} &middot; #${pomoCompleted}`;
  pomoFocusEl.textContent = String(pomoFocusMin);
  pomoBreakEl.textContent = String(pomoBreakMin);
  const remaining = pomoActive ? pomoEndTs - performance.now() : (pomoPhase === "break" ? pomoBreakMin : pomoFocusMin) * 60000;
  pomoCountdown.textContent = fmtCountdown(remaining);
}
function startPomodoro() {
  pomoActive = true;
  pomoPhase = "focus";
  pomoEndTs = performance.now() + pomoFocusMin * 60000;
  if (!pomoTickId) pomoTickId = setInterval(pomoTick, 250);
  updatePomoUI();
}
function stopPomodoro() {
  pomoActive = false;
  if (pomoTickId) { clearInterval(pomoTickId); pomoTickId = null; }
  updatePomoUI();
}
function pomoTick() {
  if (!pomoActive) return;
  if (performance.now() >= pomoEndTs) pomoTransition();
  else updatePomoUI();
}
function pomoTransition() {
  if (pomoPhase === "focus") {
    pomoCompleted++;
    pomoPhase = "break";
    pomoEndTs = performance.now() + pomoBreakMin * 60000;
    playChime();
    toast(`Focus block #${pomoCompleted} done. Take a ${pomoBreakMin} min break.`, "info");
  } else {
    pomoPhase = "focus";
    pomoEndTs = performance.now() + pomoFocusMin * 60000;
    playChime();
    toast("Break's over. Back to it.", "info");
  }
  updatePomoUI();
}
// Short two-note sine ping straight to destination (bypasses masterGain, same
// pattern as the metronome/drone). No asset, no notification permission.
function playChime() {
  ensureAudioGraph();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [880, 1318.5].forEach((freq, i) => {
    const t = now + i * 0.16;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
pomoToggle.addEventListener("click", () => { if (pomoActive) stopPomodoro(); else startPomodoro(); });
pomoFocusDown.addEventListener("click", () => { pomoFocusMin = Math.max(1, pomoFocusMin - 5); updatePomoUI(); });
pomoFocusUp.addEventListener("click", () => { pomoFocusMin = Math.min(120, pomoFocusMin + 5); updatePomoUI(); });
pomoBreakDown.addEventListener("click", () => { pomoBreakMin = Math.max(1, pomoBreakMin - 1); updatePomoUI(); });
pomoBreakUp.addEventListener("click", () => { pomoBreakMin = Math.min(60, pomoBreakMin + 1); updatePomoUI(); });

// --- Loop rep counter ---
function resetLoopReps() {
  loopReps = 0;
  updateRepDisplay();
}
function updateRepDisplay() {
  repsTagNum.textContent = String(loopReps);
  if (repCount) repCount.textContent = String(loopReps);
}
function onLoopRestart() {
  loopReps++;
  if (sessionActive) sessionReps++;
  if (currentSongId) PracticeStore.addRep(currentSongId, window.currentAudioTitle);
  updateRepDisplay();
  updatePracticeDisplay();
  flashLoopRestart();
  if (memorizeOn) advanceMemorize();
}

// Brief accent wash over the waveform on each loop restart (2.1).
function flashLoopRestart() {
  if (!waveFlash) return;
  waveFlash.classList.remove("flash");
  void waveFlash.offsetWidth; // restart the animation even on back-to-back loops
  waveFlash.classList.add("flash");
}
repReset.addEventListener("click", () => { resetLoopReps(); });

// --- Memorize mode: fade the track ~3 dB each loop, then back to full ---
const MEM_LEVELS = [1.0, 0.708, 0.501, 0.355, 0.251, 0.178, 0.0];
function applyMasterGain(g) {
  if (masterGain && audioCtx) masterGain.gain.setTargetAtTime(g, audioCtx.currentTime, 0.02);
}
function advanceMemorize() {
  memorizeStep = (memorizeStep + 1) % MEM_LEVELS.length;
  applyMasterGain(MEM_LEVELS[memorizeStep]);
  updateMemorizeDisplay();
}
function resetMemorizeLevel() {
  memorizeStep = 0;
  if (memorizeOn) applyMasterGain(1.0);
  updateMemorizeDisplay();
}
function setMemorize(on) {
  memorizeOn = on;
  if (on) ensureAudioGraph();
  memorizeToggle.classList.toggle("active", on);
  memorizeToggle.setAttribute("aria-pressed", on ? "true" : "false");
  memorizeToggle.textContent = on ? "On" : "Off";
  memorizeStep = 0;
  applyMasterGain(1.0); // always restore full volume on toggle
  updateMemorizeDisplay();
}
function updateMemorizeDisplay() {
  if (!memorizeOn) { memorizeLevel.textContent = "off"; return; }
  const g = MEM_LEVELS[memorizeStep];
  memorizeLevel.textContent = g === 0 ? "silent" : Math.round(g * 100) + "%";
}
memorizeToggle.addEventListener("click", () => { setMemorize(!memorizeOn); });

// --- Drone: up to three sustained reference pitches (a chord), bypass masterGain ---
const NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
// Shared output: every voice feeds one lowpass -> Vol gain -> destination, bypassing
// masterGain so memorize fade / transpose never touch the reference pitches.
let droneBus = null;

function ensureDroneBus() {
  ensureAudioGraph();
  if (!audioCtx) return false;
  if (!droneBus) {
    const out = audioCtx.createGain();
    out.gain.value = Number(droneVol.value) / 100;
    out.connect(audioCtx.destination);
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    lp.connect(out);
    droneBus = { lp, out };
  }
  return true;
}
function voiceFreq(v) {
  const octave = parseInt(v.octave.value, 10);
  const midi = (octave + 1) * 12 + (NOTE_INDEX[v.note.value] || 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function startVoiceNodes(v) {
  if (!ensureDroneBus()) return;
  stopVoiceNodes(v, true);
  const vg = audioCtx.createGain(); // per-voice gain ramps for click-free start/stop
  vg.gain.value = 0;
  vg.connect(droneBus.lp);
  const f = voiceFreq(v);
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = f;
  osc.connect(vg);
  osc.start();
  let oscOct = null;
  if (droneOctaveDown.checked) {
    oscOct = audioCtx.createOscillator();
    oscOct.type = "sine";
    oscOct.frequency.value = f / 2;
    const og = audioCtx.createGain();
    og.gain.value = 0.7;
    oscOct.connect(og).connect(vg);
    oscOct.start();
  }
  vg.gain.setTargetAtTime(1, audioCtx.currentTime, 0.04);
  v.nodes = { osc, oscOct, vg };
}
function stopVoiceNodes(v, immediate) {
  if (!v.nodes) return;
  const n = v.nodes;
  v.nodes = null;
  try { n.vg.gain.setTargetAtTime(0, audioCtx.currentTime, 0.04); } catch (e) {}
  const stop = () => {
    try { n.osc.stop(); } catch (e) {}
    try { if (n.oscOct) n.oscOct.stop(); } catch (e) {}
  };
  if (immediate) stop();
  else setTimeout(stop, 150);
}
function setVoice(v, on) {
  v.on = on;
  v.toggle.classList.toggle("active", on);
  v.toggle.setAttribute("aria-pressed", on ? "true" : "false");
  v.toggle.textContent = on ? "On" : "Off";
  if (on) startVoiceNodes(v);
  else stopVoiceNodes(v, false);
  droneOn = droneVoices.some((x) => x.on);
}
// setDrone(false) is the teardown hook (stops every voice); setDrone(true) restarts active ones.
function setDrone(on) {
  if (!on) { droneVoices.forEach((v) => setVoice(v, false)); return; }
  droneVoices.forEach((v) => { if (v.on) startVoiceNodes(v); });
}
droneVoices.forEach((v) => {
  v.toggle.addEventListener("click", () => setVoice(v, !v.on));
  [v.note, v.octave].forEach((el) => {
    el.addEventListener("change", () => { if (v.on) startVoiceNodes(v); });
  });
});
droneVol.addEventListener("input", () => {
  if (droneBus && audioCtx) {
    droneBus.out.gain.setTargetAtTime(Number(droneVol.value) / 100, audioCtx.currentTime, 0.02);
  }
});
droneOctaveDown.addEventListener("change", () => {
  droneVoices.forEach((v) => { if (v.on) startVoiceNodes(v); });
});
showDroneButton.addEventListener("click", () => { selectSection(droneBody, showDroneButton); });

// --- Journal ---
function renderJournal() {
  const songs = PracticeStore.songs();
  journalEl.innerHTML = "";
  if (!songs.length) {
    const empty = document.createElement("div");
    empty.className = "journal-empty";
    empty.textContent = "No practice logged yet.";
    journalEl.appendChild(empty);
    return;
  }
  songs.forEach((s) => {
    const row = document.createElement("div");
    row.className = "journal-row";
    const title = document.createElement("span");
    title.className = "j-title";
    title.textContent = s.title || s.id;
    const meta = document.createElement("span");
    meta.className = "j-meta";
    meta.textContent = `${fmtClock(s.totalMs)} · ${s.reps} reps · ${s.last || "-"}`;
    row.appendChild(title);
    row.appendChild(meta);
    journalEl.appendChild(row);
  });

  // Recent practice sessions (with notes), newest first.
  const sessions = PracticeStore.recentSessions(20);
  if (sessions.length) {
    const head = document.createElement("div");
    head.className = "journal-subhead";
    head.textContent = "Recent sessions";
    journalEl.appendChild(head);
    sessions.forEach((s) => {
      const row = document.createElement("div");
      row.className = "journal-row session-row";
      const left = document.createElement("span");
      left.className = "j-title";
      left.textContent = s.note || s.title || "(no note)";
      const meta = document.createElement("span");
      meta.className = "j-meta";
      meta.textContent = `${fmtClock(s.ms)} · ${s.reps} reps · ${s.date}`;
      row.appendChild(left);
      row.appendChild(meta);
      journalEl.appendChild(row);
    });
  }
}
journalToggle.addEventListener("click", () => {
  if (journalEl.style.display === "none") {
    renderJournal();
    journalEl.style.display = "";
    journalToggle.textContent = "Hide";
  } else {
    journalEl.style.display = "none";
    journalToggle.textContent = "Journal";
  }
});

// Fetch + decode the current source into an AudioBuffer (used by metronome
// tempo sync). The result is memoized per track; the cache is invalidated when
// the track changes (teardownTrack / loadFile / loadAudio).
let _decodedCache = { key: null, buffer: null, promise: null };
function decodedCacheKey() {
  return sourceType === "file" && currentObjectURL ? currentObjectURL : `yt:${audioFile}`;
}
function invalidateDecodedCache() {
  _decodedCache = { key: null, buffer: null, promise: null };
}
async function decodeCurrentSource() {
  ensureAudioGraph();
  const key = decodedCacheKey();
  if (_decodedCache.key === key) {
    if (_decodedCache.buffer) return _decodedCache.buffer;
    if (_decodedCache.promise) return _decodedCache.promise;
  }
  const srcUrl = sourceType === "file" && currentObjectURL
    ? currentObjectURL
    : `/audio/${audioFile}?t=${Date.now()}`;
  const promise = (async () => {
    const resp = await fetch(srcUrl);
    if (!resp.ok) throw new Error("fetch failed");
    const arr = await resp.arrayBuffer();
    return audioCtx.decodeAudioData(arr);
  })();
  _decodedCache = { key, buffer: null, promise };
  try {
    const buffer = await promise;
    if (_decodedCache.key === key) _decodedCache.buffer = buffer;
    return buffer;
  } catch (e) {
    invalidateDecodedCache(); // don't cache a failed decode
    throw e;
  }
}

showPracticeButton.addEventListener("click", () => {
  updatePracticeDisplay();
  if (journalEl.style.display !== "none") renderJournal();
  selectSection(practiceBody, showPracticeButton);
});

updateRepDisplay();
updateMemorizeDisplay();
updateSessionUI();
updatePomoUI();
updatePracticeDisplay();

// ----- Piano -----
const WHITE_KEYS = ["z", "x", "c", "v", "b", "n", "m"];
const BLACK_KEYS = ["s", "d", "g", "h", "j"];

const keys = document.querySelectorAll(".key");
const whiteKeys = document.querySelectorAll(".key.white");
const blackKeys = document.querySelectorAll(".key.black");

keys.forEach((key) => {
  key.addEventListener("mousedown", () => playNote(key));
});

document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if (!fileIsLoaded) return;
  if (e.repeat) return;
  const key = e.key.toLowerCase();
  const whiteKeyIndex = WHITE_KEYS.indexOf(key);
  const blackKeyIndex = BLACK_KEYS.indexOf(key);
  if (whiteKeyIndex > -1) playNote(whiteKeys[whiteKeyIndex]);
  if (blackKeyIndex > -1) playNote(blackKeys[blackKeyIndex]);
});

function playNote(key) {
  if (!key || !fileIsLoaded) return;
  const note = key.dataset.note;
  const noteAudio = document.getElementById(note);
  if (!noteAudio) return;
  noteAudio.currentTime = 0;
  noteAudio.play().catch((err) => console.error("Audio playback failed:", err));
  key.classList.add("active");
  const cleanup = () => {
    key.classList.remove("active");
    noteAudio.removeEventListener("ended", cleanup);
  };
  noteAudio.addEventListener("ended", cleanup);
  setTimeout(() => key.classList.remove("active"), 350);
}

showPianoButton.addEventListener("click", () => {
  selectSection(pianoBody, showPianoButton);
});

// ----- Fretboard (interactive guitar / bass neck) -----
// The neck is built from a shared CSS grid: a fret-number row, an inlay overlay
// and one row per string, all using --fb-cols so columns line up. Clicking a
// position synthesises a plucked-string tone (Karplus-Strong, no samples) and
// lights up every spot on the neck that shares that pitch class.
const FB_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FB_FRETS = 12;
const FB_INLAYS = [3, 5, 7, 9]; // 12 is a double inlay, handled separately
const FB_TUNINGS = {
  // strings run low → high; gauges in px (thick low strings → thin high ones);
  // `wound` = how many of the low strings get the wrapped-wire texture.
  guitar: { strings: [40, 45, 50, 55, 59, 64], gauges: [2.6, 2.3, 2.0, 1.6, 1.3, 1.1], wound: 3, tuning: "E A D G B E" },
  bass:   { strings: [28, 33, 38, 43],         gauges: [3.2, 2.7, 2.2, 1.8],          wound: 4, tuning: "E A D G" },
};

let fbInstrument = "guitar";
let fbLabels = false;
let fbPcTimer = 0;

const fbBoard = $("fb-board");
const fbInstrumentSeg = $("fb-instrument");
const fbLabelsBtn = $("fb-labels");
const fbReadoutNote = $("fb-readout-note");
const fbReadoutMeta = $("fb-readout-meta");

function fbName(midi) { return FB_NOTE_NAMES[((midi % 12) + 12) % 12]; }
function fbOctave(midi) { return Math.floor(midi / 12) - 1; }
function fbFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function fbOrdinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderFretboard() {
  const cfg = FB_TUNINGS[fbInstrument];
  const n = cfg.strings.length;
  fbBoard.style.setProperty("--fb-strings", String(n));

  let html = '<div class="fb-fretnums" aria-hidden="true"><span class="fb-fretnum">0</span>';
  for (let f = 1; f <= FB_FRETS; f++) {
    const mark = (FB_INLAYS.includes(f) || f === 12) ? " is-mark" : "";
    html += `<span class="fb-fretnum${mark}">${f}</span>`;
  }
  html += "</div><div class=\"fb-neck\"><div class=\"fb-inlays\" aria-hidden=\"true\"><span></span>";
  for (let f = 1; f <= FB_FRETS; f++) {
    if (f === 12) html += '<span class="fb-inlay fb-inlay--double"></span>';
    else if (FB_INLAYS.includes(f)) html += '<span class="fb-inlay"></span>';
    else html += "<span></span>";
  }
  html += '</div><div class="fb-strings">';
  // Render top → bottom as high string → low string, so the thickest (lowest)
  // string sits at the bottom — the player's-eye / tab view. `s` indexes the
  // physical string (0 = lowest), so gauge/wound/number stay tied to the string.
  for (let row = 0; row < n; row++) {
    const s = n - 1 - row;
    const open = cfg.strings[s];
    const stringNo = n - s; // 1 = highest-pitched (thinnest), n = lowest (thickest)
    const wound = s < cfg.wound ? " is-wound" : "";
    html += `<div class="fb-row${wound}" style="--g:${cfg.gauges[s]}px"><span class="fb-line" aria-hidden="true"></span>`;
    for (let f = 0; f <= FB_FRETS; f++) {
      const midi = open + f;
      const pc = ((midi % 12) + 12) % 12;
      const full = `${fbName(midi)}${fbOctave(midi)}`;
      const cls = "fb-cell" + (f === 0 ? " fb-open" : " fb-fret") + (f === 1 ? " fb-first" : "");
      html += `<button type="button" class="${cls}" data-midi="${midi}" data-pc="${pc}" `
        + `data-string="${stringNo}" data-fret="${f}" aria-label="${full}, ${fbOrdinal(stringNo)} string, `
        + `${f === 0 ? "open" : "fret " + f}"><span class="fb-dot"><span class="fb-dot-name">${fbName(midi)}</span></span></button>`;
    }
    html += "</div>";
  }
  html += "</div></div>";

  fbBoard.innerHTML = html;
  fbBoard.classList.toggle("show-labels", fbLabels);
  fbReadoutMeta.textContent = `Standard tuning · ${cfg.tuning}`;
}

// ----- Note playback: real recorded samples, with a synth fallback -----
// Each instrument bundles a handful of anchor recordings (CC-BY, see
// static/instruments/CREDITS.txt); the rest of the neck is reached by pitch-
// shifting the nearest anchor via playbackRate, kept within ~3 semitones so the
// timbre stays natural. Until a kit finishes decoding (or if it fails) we fall
// back to the Karplus-Strong synth so a click never produces silence.
const FB_SAMPLES = {
  guitar: { dir: "guitar", notes: { 40: "E2", 45: "A2", 50: "D3", 55: "G3", 60: "C4", 65: "F4", 70: "As4", 74: "D5" } },
  bass:   { dir: "bass",   notes: { 28: "E1", 34: "As1", 40: "E2", 46: "As2", 52: "E3", 55: "G3" } },
};
const fbSampleBase = (fbBoard && fbBoard.dataset.sampleBase) || "";
const fbBuffers = { guitar: {}, bass: {} };
// load state per instrument: undefined = untouched, Promise = loading,
// "ready" = at least one buffer decoded, "error" = nothing decoded.
const fbLoadState = {};

function fbLoadSamples(inst) {
  if (fbLoadState[inst] === "ready" || fbLoadState[inst] === "error") return;
  if (fbLoadState[inst]) return; // a load promise is already in flight
  ensureAudioGraph();
  if (!audioCtx || !fbSampleBase) { fbLoadState[inst] = "error"; return; }
  const spec = FB_SAMPLES[inst];
  const jobs = Object.entries(spec.notes).map(([midi, note]) =>
    fetch(`${fbSampleBase}/${spec.dir}/${note}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => audioCtx.decodeAudioData(ab))
      .then((buf) => { fbBuffers[inst][midi] = buf; })
      .catch(() => { /* skip this anchor; others may still load */ })
  );
  fbLoadState[inst] = Promise.all(jobs).then(() => {
    fbLoadState[inst] = Object.keys(fbBuffers[inst]).length ? "ready" : "error";
  });
}

function fbPluckSample(midi, inst) {
  const buffers = fbBuffers[inst];
  let bestMidi = null, bestDist = Infinity;
  for (const k in buffers) {
    const dist = Math.abs(midi - Number(k));
    if (dist < bestDist) { bestDist = dist; bestMidi = Number(k); }
  }
  if (bestMidi === null) { fbPluckSynth(midi); return; }
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buffers[bestMidi];
  src.playbackRate.value = Math.pow(2, (midi - bestMidi) / 12);
  const g = ctx.createGain();
  // tiny fade-in kills the start click; the sample's own tail does the decay.
  const peak = inst === "bass" ? 0.95 : 0.85;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
  src.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) { /* already gone */ } };
}

function fbPluck(midi) {
  ensureAudioGraph();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const inst = fbInstrument;
  if (fbLoadState[inst] === "ready") { fbPluckSample(midi, inst); return; }
  fbLoadSamples(inst); // kick off (or no-op if already loading/failed)
  fbPluckSynth(midi);  // cover this strike until the kit is decoded
}

// Plucked-string tone via Karplus-Strong: a short noise burst excites a tuned
// delay-line feedback loop with a damping lowpass; loop gain decays to silence
// so the note always terminates. Routed straight to destination (like the
// metronome/drone) so transpose and Memorize fades don't touch it.
function fbPluckSynth(midi) {
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const bass = fbInstrument === "bass";
  const freq = fbFreq(midi);

  const burstLen = Math.floor(ctx.sampleRate * 0.02);
  const buf = ctx.createBuffer(1, burstLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < burstLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / burstLen);
  const burst = ctx.createBufferSource();
  burst.buffer = buf;

  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = 1 / freq;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = bass ? 2400 : 5200;
  const loop = ctx.createGain();
  loop.gain.setValueAtTime(bass ? 0.97 : 0.95, now);
  loop.gain.setTargetAtTime(0.0001, now + 0.05, bass ? 1.4 : 0.9);
  delay.connect(damp);
  damp.connect(loop);
  loop.connect(delay);

  const body = ctx.createBiquadFilter();
  body.type = "lowpass";
  body.frequency.value = bass ? 3600 : 7200;
  const amp = ctx.createGain();
  amp.gain.value = bass ? 0.6 : 0.5;
  const dur = bass ? 3.6 : 2.8;
  amp.gain.setTargetAtTime(0.0001, now + dur * 0.6, 0.5);

  burst.connect(delay);
  delay.connect(body);
  body.connect(amp);
  amp.connect(ctx.destination);
  burst.start(now);
  burst.stop(now + 0.02);
  setTimeout(() => {
    [burst, delay, damp, loop, body, amp].forEach((node) => { try { node.disconnect(); } catch (e) { /* already gone */ } });
  }, (dur + 0.6) * 1000);
}

function fbClearPitch() {
  fbBoard.querySelectorAll(".fb-cell.is-pc").forEach((c) => c.classList.remove("is-pc"));
}

fbBoard.addEventListener("click", (e) => {
  const cell = e.target.closest(".fb-cell");
  if (!cell) return;
  const midi = Number(cell.dataset.midi);
  const pc = cell.dataset.pc;
  const fret = Number(cell.dataset.fret);
  const stringNo = Number(cell.dataset.string);

  fbPluck(midi);

  fbClearPitch();
  fbBoard.querySelectorAll(`.fb-cell[data-pc="${pc}"]`).forEach((c) => c.classList.add("is-pc"));
  cell.classList.remove("is-hit");
  void cell.offsetWidth; // restart the ripple animation
  cell.classList.add("is-hit");
  setTimeout(() => cell.classList.remove("is-hit"), 600);
  if (fbPcTimer) clearTimeout(fbPcTimer);
  fbPcTimer = setTimeout(fbClearPitch, 2400);

  fbReadoutNote.textContent = `${fbName(midi)}${fbOctave(midi)}`;
  fbReadoutMeta.textContent = `${fbOrdinal(stringNo)} string · ${fret === 0 ? "open string" : "fret " + fret}`;
});

fbInstrumentSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn || btn.dataset.inst === fbInstrument) return;
  fbInstrument = btn.dataset.inst;
  fbInstrumentSeg.querySelectorAll(".seg-btn").forEach((b) => {
    const on = b === btn;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  fbReadoutNote.textContent = "—";
  renderFretboard();
  saveFretboardPrefs();
  fbLoadSamples(fbInstrument); // warm the new kit before the user clicks
  // A bass neck has fewer (taller) rows, so the panel's natural height changes;
  // re-pin the shared section height if the strip is visible.
  if (sectionTabs && !sectionTabs.classList.contains("hidden")) syncSectionHeights();
});

fbLabelsBtn.addEventListener("click", () => {
  fbLabels = !fbLabels;
  fbLabelsBtn.classList.toggle("active", fbLabels);
  fbLabelsBtn.setAttribute("aria-pressed", fbLabels ? "true" : "false");
  fbBoard.classList.toggle("show-labels", fbLabels);
  saveFretboardPrefs();
});

function saveFretboardPrefs() {
  try {
    localStorage.setItem("loopretto.fretboard", JSON.stringify({ inst: fbInstrument, labels: fbLabels }));
  } catch (e) { /* storage unavailable; preferences just won't persist */ }
}

(function initFretboard() {
  try {
    const saved = JSON.parse(localStorage.getItem("loopretto.fretboard") || "{}");
    if (saved.inst === "bass" || saved.inst === "guitar") fbInstrument = saved.inst;
    fbLabels = !!saved.labels;
  } catch (e) { /* ignore malformed prefs */ }
  fbInstrumentSeg.querySelectorAll(".seg-btn").forEach((b) => {
    const on = b.dataset.inst === fbInstrument;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  fbLabelsBtn.classList.toggle("active", fbLabels);
  fbLabelsBtn.setAttribute("aria-pressed", fbLabels ? "true" : "false");
  renderFretboard();
})();

showFretboardButton.addEventListener("click", () => {
  selectSection(fretboardBody, showFretboardButton);
  // Decode the current kit on first open so the first pluck is already a sample.
  if (fretboardBody.classList.contains("show")) fbLoadSamples(fbInstrument);
});
