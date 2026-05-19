// ====== Loopretto — app.js (redesign) ======

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

const speedDownButton = $("decrease-speed");
const speedUpButton = $("increase-speed");
const speedDisplay = $("speed-display");

const addNewAudioButton = $("addNewAudioButton");
const downloadAudioButton = $("downloadAudioButton");
const showPianoButton = $("showPianoButton");

const loadingZone = $("loading-zone");
const loadingIndicator = $("loading-indicator");
const loadAudioBtn = $("load-audio");
const loadAudioLabel = $("load-audio-label");
const urlForm = $("url-form");
const urlInput = $("youtube-url");

const thumbAndTitleZone = $("thumb-and-title-zone");
const videoTitle = $("video-title");
const videoThumbnail = $("video-thumbnail");
const durationPill = $("duration-pill");

const waveEmpty = $("wave-empty");
const currentTimeEl = $("current-time");
const durationTimeEl = $("duration-time");

const menuToggle = $("menuToggle");
const menuPanel = $("menuPanel");
const menuScrim = $("menuScrim");
const themeSwitcherButton = $("theme-switcher");
const themeName = $("themeName");
const zenButton = $("zen-mode");

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

// ----- Helpers -----
function fmt(secs) {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setControlsEnabled(enabled) {
  [speedDownButton, speedUpButton, playPauseButton, loopButton, zoomSlider, showPianoButton].forEach((el) => {
    if (el) el.disabled = !enabled;
  });
}

function updateZoomSlider(value) {
  zoomSlider.value = value;
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
  if (active) {
    loopButton.classList.add("active");
    loopLabel.textContent = "Looping";
    loopDot.style.display = "inline-block";
    loopTag.style.display = "inline-flex";
  } else {
    loopButton.classList.remove("active");
    loopLabel.textContent = "Loop section";
    loopDot.style.display = "none";
    loopTag.style.display = "none";
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

// ----- Theme cycling (Midnight / Daylight / Mono) -----
const THEMES = [
  { cls: "theme-midnight", label: "Midnight" },
  { cls: "theme-daylight", label: "Daylight" },
  { cls: "theme-mono", label: "Mono" },
];

function applyTheme(idx) {
  THEMES.forEach((t) => body.classList.remove(t.cls));
  const t = THEMES[idx % THEMES.length];
  body.classList.add(t.cls);
  themeName.textContent = t.label;
  try { localStorage.setItem("loopretto.themeIdx", String(idx)); } catch (e) {}
  reapplyWaveColors();
}

let themeIdx = 0;
try {
  const saved = parseInt(localStorage.getItem("loopretto.themeIdx") || "0", 10);
  if (!Number.isNaN(saved)) themeIdx = saved;
} catch (e) {}

themeSwitcherButton.addEventListener("click", (e) => {
  e.preventDefault();
  themeIdx = (themeIdx + 1) % THEMES.length;
  applyTheme(themeIdx);
  closeMenu();
});

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
zenButton.addEventListener("click", (e) => {
  e.preventDefault();
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
  document.activeElement && document.activeElement.blur();
});

// ----- WaveSurfer -----
function getWaveColors() {
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent").trim() || "#a586ff";
  const isDaylight = body.classList.contains("theme-daylight");
  const wave = isDaylight ? "oklch(0.72 0.03 280)" : "oklch(0.45 0.04 280)";
  return { waveColor: wave, progressColor: accent };
}

const initialColors = getWaveColors();
const wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: initialColors.waveColor,
  progressColor: initialColors.progressColor,
  cursorColor: getComputedStyle(document.documentElement).getPropertyValue("--text") || "#fff",
  cursorWidth: 2,
  height: 130,
  barWidth: 2,
  barRadius: 2,
  barGap: 1,
  responsive: true,
  backend: "MediaElement",
  autoCenter: false,
  plugins: [
    WaveSurfer.timeline.create({
      container: "#wave-timeline",
      timeInterval: 1,
      primaryLabelInterval: 10,
      secondaryLabelInterval: 5,
      primaryColor: "rgba(255,255,255,0.5)",
      secondaryColor: "rgba(255,255,255,0.3)",
      primaryFontColor: "rgba(255,255,255,0.6)",
      secondaryFontColor: "rgba(255,255,255,0.4)",
      fontSize: 9,
      height: 18,
    }),
    WaveSurfer.regions.create(),
  ],
});

function reapplyWaveColors() {
  const c = getWaveColors();
  try {
    wavesurfer.setWaveColor(c.waveColor);
    wavesurfer.setProgressColor(c.progressColor);
  } catch (e) {}
}

// Apply persisted theme after wavesurfer exists so colors track theme.
applyTheme(themeIdx);

wavesurfer.on("ready", () => {
  const dur = wavesurfer.getDuration();
  durationTimeEl.textContent = fmt(dur);
  durationPill.textContent = fmt(dur);
  currentTimeEl.textContent = fmt(0);
});

wavesurfer.on("audioprocess", (t) => {
  currentTimeEl.textContent = fmt(t);
});

wavesurfer.on("seek", (progress) => {
  const clickTime = wavesurfer.getDuration() * progress;
  masterClickTime = clickTime;
  loopStart = clickTime;
  currentTimeEl.textContent = fmt(clickTime);
});

wavesurfer.on("play", () => setPlayingUI(true));
wavesurfer.on("pause", () => setPlayingUI(false));
wavesurfer.on("finish", () => setPlayingUI(false));

wavesurfer.on("region-update-end", (region) => {
  if (loopRegion && region.id === loopRegion.id) {
    masterClickTime = region.start;
    loopStart = region.start;
    loopEnd = region.end;
    refreshLoopTag();
  }
});

// ----- Load audio (main backend: POST /get_audio -> /audio/<file>) -----
async function loadAudio() {
  if (loadAudioBtn.disabled) return;
  const youtubeUrl = urlInput.value.trim();
  if (!youtubeUrl) {
    alert("Paste a YouTube URL first.");
    return;
  }

  loadAudioBtn.disabled = true;
  loadingIndicator.style.display = "inline-block";
  loadAudioLabel.textContent = "Fetching";

  try {
    const response = await fetch("/get_audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: youtubeUrl }),
    });

    if (!response.ok) {
      let msg = "Failed to load audio";
      if (response.status === 429) {
        msg = "Rate limited — too many requests. Try again in a minute.";
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

    videoTitle.textContent = data.title || "Unknown";
    if (data.thumbnail) videoThumbnail.src = data.thumbnail;

    const audioResponse = await fetch(`/audio/${audioFile}`);
    if (!audioResponse.ok) throw new Error("Audio file fetch failed");
    const audioBlob = await audioResponse.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    wavesurfer.load(audioUrl);
    fileIsLoaded = true;

    loadingZone.classList.add("hidden");
    thumbAndTitleZone.classList.remove("hidden");
    waveEmpty.classList.add("hidden");

    window.currentAudioFile = audioFile;
    window.currentAudioTitle = data.title || "audio";

    setControlsEnabled(true);
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to load audio");
    fileIsLoaded = false;
    setControlsEnabled(false);
  } finally {
    loadingIndicator.style.display = "none";
    loadAudioLabel.textContent = "Load audio";
    loadAudioBtn.disabled = false;
  }
}

urlForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loadAudio();
});

document.querySelectorAll(".chip[data-url]").forEach((chip) => {
  chip.addEventListener("click", () => {
    urlInput.value = chip.dataset.url;
    urlInput.focus();
  });
});

addNewAudioButton.addEventListener("click", () => {
  wavesurfer.stop();
  if (loopRegion) {
    loopRegion.remove();
    loopRegion = null;
  }
  setLoopUI(false);
  setPlayingUI(false);
  thumbAndTitleZone.classList.add("hidden");
  loadingZone.classList.remove("hidden");
  waveEmpty.classList.remove("hidden");
  fileIsLoaded = false;
  setControlsEnabled(false);
  currentTimeEl.textContent = "0:00";
  durationTimeEl.textContent = "0:00";
  durationPill.textContent = "0:00";
});

// ----- Download (fetches local audio file from main backend) -----
downloadAudioButton.addEventListener("click", async () => {
  if (!audioFile) return;
  try {
    const resp = await fetch(`/audio/${audioFile}`);
    if (!resp.ok) throw new Error("Download failed");
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeTitle = (window.currentAudioTitle || "audio")
      .replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const ext = audioFile.split(".").pop();
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    console.error("download failed", e);
    alert("Download failed. The file may have already been cleaned up — load again.");
  }
});

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
    loopRegion = wavesurfer.addRegion({
      start: loopStart,
      end: loopEnd,
      color: "rgba(168, 130, 255, 0.18)",
      drag: true,
      resize: true,
      loop: true,
    });
    setLoopUI(true);
    refreshLoopTag();
  } else {
    alert("Click on the waveform to set a marker, then create a loop.");
  }
  document.activeElement && document.activeElement.blur();
});

// ----- Play/Pause -----
function togglePlayPause() {
  if (!fileIsLoaded) return;
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    setPlayingUI(false);
    if (loopStart !== null) {
      wavesurfer.seekTo(loopStart / wavesurfer.getDuration());
    }
  } else {
    if (loopRegion) {
      wavesurfer.play(loopStart);
    } else if (loopStart !== null) {
      wavesurfer.play(loopStart);
    } else {
      loopStart = 0;
      wavesurfer.play();
    }
    setPlayingUI(true);
  }
}

playPauseButton.addEventListener("click", () => {
  togglePlayPause();
  document.activeElement && document.activeElement.blur();
});

// ----- Keyboard shortcuts -----
document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

  if (e.code === "Space") {
    e.preventDefault();
    if (fileIsLoaded) togglePlayPause();
    return;
  }
  if (!fileIsLoaded) return;

  const currentTime = wavesurfer.getCurrentTime();
  const duration = wavesurfer.getDuration();
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    wavesurfer.setCurrentTime(Math.max(0, currentTime - 0.5));
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    wavesurfer.setCurrentTime(Math.min(duration, currentTime + 0.5));
  }
});

// ----- Speed -----
speedDownButton.addEventListener("click", () => {
  if (currentSpeed > 0.1) {
    currentSpeed = Math.max(0.1, Math.round((currentSpeed - 0.1) * 10) / 10);
    wavesurfer.setPlaybackRate(currentSpeed);
    updateSpeedDisplay();
  }
  document.activeElement && document.activeElement.blur();
});

speedUpButton.addEventListener("click", () => {
  if (currentSpeed < 2.0) {
    currentSpeed = Math.min(2.0, Math.round((currentSpeed + 0.1) * 10) / 10);
    wavesurfer.setPlaybackRate(currentSpeed);
    updateSpeedDisplay();
  }
  document.activeElement && document.activeElement.blur();
});

// ----- Zoom -----
$("waveform").addEventListener("wheel", (e) => {
  if (!fileIsLoaded) return;
  e.preventDefault();
  currentZoom = Math.max(0, Math.min(100, currentZoom + (e.deltaY < 0 ? 10 : -10)));
  wavesurfer.zoom(currentZoom * 5);
  updateZoomSlider(currentZoom);
}, { passive: false });

zoomSlider.addEventListener("input", (event) => {
  currentZoom = Math.max(0, Math.min(100, Number(event.target.value)));
  wavesurfer.zoom(currentZoom * 2.5);
  updateZoomSlider(currentZoom);
  document.activeElement && document.activeElement.blur();
});

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
  const pianoBody = $("piano-body");
  if (pianoBody.classList.contains("show")) {
    pianoBody.classList.remove("show");
    showPianoButton.classList.remove("active");
  } else {
    pianoBody.classList.add("show");
    showPianoButton.classList.add("active");
  }
  showPianoButton.blur();
});
