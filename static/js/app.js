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
const zoomTag = $("zoom-tag");
const zoomToLoopBtn = $("zoom-to-loop");
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

const repsTag = $("reps-tag");
const repsTagNum = $("reps-tag-num");

const pitchDownButton = $("pitch-down");
const pitchUpButton = $("pitch-up");
const pitchDisplay = $("pitch-display");

const noteTag = $("note-tag");
const noteRootEl = $("note-root");

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
let sessionMs = 0; // active-playback time this page session (all songs)
let playStartTs = null; // performance.now() at the current play start, else null
let sessionTickId = null;
let loopReps = 0; // reps for the current loop (resettable)
let memorizeOn = false;
let memorizeStep = 0;
let droneOn = false;
let droneNodes = null;

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
    speedDownButton, speedUpButton, playPauseButton, loopButton, zoomSlider,
    showPianoButton, showNotesButton, showMetronomeButton, showPracticeButton,
    showFxButton, pitchDownButton, pitchUpButton,
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
    _hintWraps = [document.querySelector(".transport"), document.querySelector(".right-cluster")]
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
  zoomTag.textContent = `${value}% zoom`;
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
  if (zoomToLoopBtn) zoomToLoopBtn.disabled = !active; // only meaningful with a loop
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

function applyAccent(value) {
  document.documentElement.style.setProperty("--accent-raw", value);
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
let savedAccent = DEFAULT_ACCENT;
let savedBg = "default";
let savedSurface = "default";
try {
  savedTheme = localStorage.getItem("loopretto.theme") || DEFAULT_THEME;
  savedAccent = localStorage.getItem("loopretto.accent") || DEFAULT_ACCENT;
  savedBg = localStorage.getItem("loopretto.bg") || "default";
  savedSurface = localStorage.getItem("loopretto.surface") || "default";
} catch (e) {}
// Drop a stale/old-palette accent so the current swatches always apply.
const validAccents = [...accentRow.querySelectorAll(".accent-dot")].map((d) => d.dataset.accent);
if (!validAccents.includes(savedAccent)) savedAccent = DEFAULT_ACCENT;
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
  { keys: ["z", "x", "c", "v", "b", "n", "m"], desc: "Piano: natural keys (C–B)" },
  { keys: ["s", "d", "g", "h", "j"], desc: "Piano: sharp/flat keys" },
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

wavesurfer.on("play", () => {
  setPlayingUI(true);
  startPlayClock();
});
wavesurfer.on("pause", () => {
  setPlayingUI(false);
  stopPlayClock();
});
wavesurfer.on("finish", () => {
  setPlayingUI(false);
  stopPlayClock();
});

// Loop: when the playhead leaves the loop region, jump back to its start.
wsRegions.on("region-out", (region) => {
  if (loopRegion && region.id === loopRegion.id) {
    wavesurfer.setTime(region.start);
    onLoopRestart();
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
  waveEmpty.classList.add("hidden");
  fileIsLoaded = true;
  setControlsEnabled(true);
  window.currentAudioTitle = title || "audio";
  updateSaveSetlistButton();
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
    // Don't clobber a URL the user is mid-way through typing/pasting; only fill
    // an empty input.
    if (urlInput.value.trim()) {
      urlInput.focus();
      return;
    }
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
  stopPlayClock();
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
  closeSetlistPopover();
  thumbAndTitleZone.classList.add("hidden");
  waveformCard.classList.add("hidden");
  controlsRow.classList.add("hidden");
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
    const safeTitle = (window.currentAudioTitle || "audio")
      .replace(/[^a-z0-9]/gi, "_").toLowerCase();
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
      if (SetlistStore.has(n, song.id)) SetlistStore.removeSong(n, song.id);
      else SetlistStore.addSong(n, song);
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
  if (song) SetlistStore.addSong(name, song);
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

// Zoom so the looped region fills the waveform, then scroll it into view.
function zoomToLoop() {
  if (!loopRegion) { toast("Create a loop first, then zoom to it."); return; }
  const dur = loopRegion.end - loopRegion.start;
  if (dur <= 0) return;
  const width = waveformEl.clientWidth || 600;
  const pxPerSec = Math.max(1, (width / dur) * 0.9); // 10% breathing room
  try {
    wavesurfer.zoom(pxPerSec);
    // Put the loop start near the left edge (small margin), defeating autoCenter.
    // Defer a frame so the scroll container has resized to the new zoom first.
    const target = Math.max(0, loopRegion.start * pxPerSec - width * 0.05);
    requestAnimationFrame(() => { try { wavesurfer.setScroll(target); } catch (e) {} });
  } catch (e) { console.error(e); }
  // Reflect the new zoom on the slider (clamped to its 0–250 px/s range).
  currentZoom = Math.max(0, Math.min(100, Math.round(pxPerSec / 2.5)));
  updateZoomSlider(currentZoom);
}
zoomToLoopBtn.addEventListener("click", zoomToLoop);

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
const spotlightToggle = $("spotlight-toggle");
const spotlightFreq = $("spotlight-freq");
const spotlightQ = $("spotlight-q");
const spotlightFreqLabel = $("spotlight-freq-label");
const punchToggle = $("punch-toggle");

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
  punchToggle.classList.remove("active");
  punchToggle.setAttribute("aria-pressed", "false");
  punchToggle.textContent = "Off";
  applyEqPreset("off");
  rebuildFxChain();
}

eqPresetSel.addEventListener("change", () => setEqPreset(eqPresetSel.value));
spotlightToggle.addEventListener("click", () => setSpotlight(!spotlightOn));
punchToggle.addEventListener("click", () => setPunch(!punchOn));
spotlightFreq.addEventListener("input", () => {
  updateSpotlightFreqLabel();
  if (bandpassNode && audioCtx) {
    bandpassNode.frequency.setTargetAtTime(spotlightFreqFromSlider(), audioCtx.currentTime, 0.02);
  }
});
spotlightQ.addEventListener("input", () => {
  if (bandpassNode && audioCtx) {
    bandpassNode.Q.setTargetAtTime(spotlightQFromSlider(), audioCtx.currentTime, 0.02);
  }
});
updateSpotlightFreqLabel();
showFxButton.addEventListener("click", () => { togglePanel(fxBody, showFxButton); });

// ----- Panel toggles (Metronome / Piano) -----
const pianoBody = $("piano-body");
function openPanel(panel, btn) { panel.classList.add("show"); btn.classList.add("active"); btn.setAttribute("aria-pressed", "true"); }
function closePanel(panel, btn) { panel.classList.remove("show"); btn.classList.remove("active"); btn.setAttribute("aria-pressed", "false"); }
function togglePanel(panel, btn) {
  if (panel.classList.contains("show")) closePanel(panel, btn);
  else openPanel(panel, btn);
}

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
  noteTag.style.display = on ? "inline-flex" : "none";
  if (on) {
    ensureAudioGraph();
    pcWeights.fill(0);
    noteRootEl.textContent = "-";
    if (!noteRafId) detectLoop();
  } else if (noteRafId) {
    cancelAnimationFrame(noteRafId);
    noteRafId = null;
    noteRootEl.textContent = "-";
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
showMetronomeButton.addEventListener("click", () => { togglePanel(metroBody, showMetronomeButton); });

renderBeatDots();
updateBpmDisplay();
updatePitchDisplay();

// ----- Practice tools (session/journal, reps, memorize, drone, export) -----
const practiceBody = $("practice-body");
const psSession = $("ps-session");
const psSong = $("ps-song");
const psToday = $("ps-today");
const psTodayReps = $("ps-today-reps");
const journalToggle = $("journal-toggle");
const journalEl = $("journal");
const repCount = $("rep-count");
const repReset = $("rep-reset");
const memorizeToggle = $("memorize-toggle");
const memorizeLevel = $("memorize-level");
const droneToggle = $("drone-toggle");
const droneNote = $("drone-note");
const droneOctave = $("drone-octave");
const droneOctaveDown = $("drone-octave-down");
const droneVol = $("drone-vol");
const exportBtn = $("export-loop");

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
  flushPlayTime(); // bank time from any previous song first
  currentSongId = songId;
  window.currentAudioTitle = title || window.currentAudioTitle;
  loopReps = 0;
  updateRepDisplay();
  resetMemorizeLevel();
  updatePracticeDisplay();
}

// --- Session timer ---
function startPlayClock() {
  playStartTs = performance.now();
  if (!sessionTickId) sessionTickId = setInterval(updatePracticeDisplay, 1000);
  updatePracticeDisplay();
}
function stopPlayClock() {
  flushPlayTime();
  if (sessionTickId) { clearInterval(sessionTickId); sessionTickId = null; }
  updatePracticeDisplay();
}
function flushPlayTime() {
  if (playStartTs == null) return;
  const ms = performance.now() - playStartTs;
  playStartTs = null;
  sessionMs += ms;
  if (currentSongId) PracticeStore.addTime(currentSongId, window.currentAudioTitle, ms);
}
function updatePracticeDisplay() {
  const live = playStartTs != null ? performance.now() - playStartTs : 0;
  const songTotal = (currentSongId ? PracticeStore.song(currentSongId).totalMs : 0) + live;
  psSession.textContent = fmtClock(sessionMs + live);
  psSong.textContent = fmtClock(songTotal);
  const t = PracticeStore.today();
  psToday.textContent = fmtClock(t.ms + live);
  psTodayReps.textContent = String(t.reps);
  if (practiceTime) practiceTime.textContent = fmtClock(songTotal);
}
window.addEventListener("beforeunload", flushPlayTime);

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

// --- Drone: sustained reference pitch, bypasses masterGain ---
const NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function droneFreq() {
  const octave = parseInt(droneOctave.value, 10);
  const midi = (octave + 1) * 12 + (NOTE_INDEX[droneNote.value] || 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function startDroneNodes() {
  ensureAudioGraph();
  if (!audioCtx) return;
  stopDroneNodes(true);
  const out = audioCtx.createGain();
  out.gain.value = 0;
  out.connect(audioCtx.destination); // bypass masterGain (memorize fade must not touch the reference)
  const lp = audioCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  lp.connect(out);
  const f = droneFreq();
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = f;
  osc.connect(lp);
  osc.start();
  let oscOct = null;
  if (droneOctaveDown.checked) {
    oscOct = audioCtx.createOscillator();
    oscOct.type = "sine";
    oscOct.frequency.value = f / 2;
    const og = audioCtx.createGain();
    og.gain.value = 0.7;
    oscOct.connect(og).connect(lp);
    oscOct.start();
  }
  out.gain.setTargetAtTime(Number(droneVol.value) / 100, audioCtx.currentTime, 0.04);
  droneNodes = { osc, oscOct, out };
}
function stopDroneNodes(immediate) {
  if (!droneNodes) return;
  const n = droneNodes;
  droneNodes = null;
  try { n.out.gain.setTargetAtTime(0, audioCtx.currentTime, 0.04); } catch (e) {}
  const stop = () => {
    try { n.osc.stop(); } catch (e) {}
    try { if (n.oscOct) n.oscOct.stop(); } catch (e) {}
  };
  if (immediate) stop();
  else setTimeout(stop, 150);
}
function setDrone(on) {
  droneOn = on;
  droneToggle.classList.toggle("active", on);
  droneToggle.setAttribute("aria-pressed", on ? "true" : "false");
  droneToggle.textContent = on ? "On" : "Off";
  if (on) startDroneNodes();
  else stopDroneNodes(false);
}
droneToggle.addEventListener("click", () => { setDrone(!droneOn); });
droneVol.addEventListener("input", () => {
  if (droneNodes && audioCtx) {
    droneNodes.out.gain.setTargetAtTime(Number(droneVol.value) / 100, audioCtx.currentTime, 0.02);
  }
});
[droneNote, droneOctave, droneOctaveDown].forEach((el) => {
  el.addEventListener("change", () => { if (droneOn) startDroneNodes(); });
});

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
}
journalToggle.addEventListener("click", () => {
  if (journalEl.style.display === "none") {
    renderJournal();
    journalEl.style.display = "";
    journalToggle.textContent = "Hide journal";
  } else {
    journalEl.style.display = "none";
    journalToggle.textContent = "Show journal";
  }
});

// Fetch + decode the current source into an AudioBuffer (used by loop export
// and metronome tempo sync). The result is memoized per track so doing both
// Sync and Export on one song decodes only once; the cache is invalidated when
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

// --- Export loop region as WAV ---
async function exportLoop() {
  if (!loopRegion) {
    toast("Create a loop first, then export it.");
    return;
  }
  const original = exportBtn.textContent;
  exportBtn.disabled = true;
  exportBtn.textContent = "Rendering…";
  try {
    const buf = await decodeCurrentSource();
    const blob = AudioExport.encodeWav(buf, loopRegion.start, loopRegion.end);
    const safe = (window.currentAudioTitle || "loop").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}_loop.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    console.error("Loop export failed", e);
    toast("Could not export the loop.", "error");
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = original;
  }
}
exportBtn.addEventListener("click", exportLoop);

showPracticeButton.addEventListener("click", () => {
  updatePracticeDisplay();
  if (journalEl.style.display !== "none") renderJournal();
  togglePanel(practiceBody, showPracticeButton);
});

updateRepDisplay();
updateMemorizeDisplay();
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
  togglePanel(pianoBody, showPianoButton);
});
