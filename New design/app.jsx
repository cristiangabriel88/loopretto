const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* =========================================================
   Tweakable defaults
   ========================================================= */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "midnight",
  "accent": "purple",
  "waveStyle": "bars",
  "compact": false
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  purple: { l: 0.72, c: 0.17, h: 290, ink: "oklch(0.18 0.05 290)" },
  coral:  { l: 0.74, c: 0.15, h: 25,  ink: "oklch(0.18 0.05 25)"  },
  cyan:   { l: 0.78, c: 0.12, h: 210, ink: "oklch(0.18 0.05 210)" },
  lime:   { l: 0.86, c: 0.16, h: 130, ink: "oklch(0.18 0.05 130)" },
};

const SUGGESTED = [
  { label: "Bach — Cello Suite No. 1", url: "https://youtube.com/watch?v=mGQLXRTl3Z0", duration: "2:42", artist: "Yo-Yo Ma" },
  { label: "Wonderwall (Acoustic)", url: "https://youtube.com/watch?v=bx1Bh8ZvH84", duration: "4:18", artist: "Oasis" },
  { label: "Autumn Leaves — Jam Track", url: "https://youtube.com/watch?v=gCARYHv6sdY", duration: "3:34", artist: "Backing Band" },
];

/* =========================================================
   Icons
   ========================================================= */
const Icon = {
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h12"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 8 5.5z"/>
    </svg>
  ),
  Pause: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="7" y="5" width="4" height="14" rx="1.2"/>
      <rect x="13" y="5" width="4" height="14" rx="1.2"/>
    </svg>
  ),
  Skip: ({back}) => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ transform: back ? "scaleX(-1)" : "" }}>
      <path d="M5 5.5v13a1 1 0 0 0 1.55.83L14 14.4V18a1 1 0 0 0 1.55.83l5-3.25a1 1 0 0 0 0-1.66l-5-3.25A1 1 0 0 0 14 11.5v3.6L6.55 9.67A1 1 0 0 0 5 5.5z" opacity="0.5"/>
      <path d="M14 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 14 5.5z" transform="translate(-9,0)"/>
    </svg>
  ),
  Loop: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l3 3-3 3"/>
      <path d="M20 6H9a5 5 0 0 0 0 10h1"/>
      <path d="M7 21l-3-3 3-3"/>
      <path d="M4 18h11a5 5 0 0 0 0-10h-1"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v12"/>
      <path d="M7 11l5 5 5-5"/>
      <path d="M5 20h14"/>
    </svg>
  ),
  Piano: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M8 5v9M12 5v9M16 5v9" />
      <rect x="6.6" y="5" width="2.2" height="6" rx="0.5" fill="currentColor"/>
      <rect x="10.9" y="5" width="2.2" height="6" rx="0.5" fill="currentColor"/>
      <rect x="15.2" y="5" width="2.2" height="6" rx="0.5" fill="currentColor"/>
    </svg>
  ),
  YouTube: () => (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="3.5" fill="currentColor" opacity="0.12"/>
      <path d="M10 9.2v5.6l4.8-2.8L10 9.2z" fill="currentColor"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
    </svg>
  ),
  Wave: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2M21 12h0"/>
    </svg>
  ),
  Fullscreen: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  ),
};

/* =========================================================
   Deterministic fake waveform
   ========================================================= */
function generateWave(seed, bars) {
  const out = new Array(bars);
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    // Mix of envelopes + noise to feel song-like
    const envelope = Math.sin(t * Math.PI) * 0.7 + 0.3;
    const beat = Math.abs(Math.sin(t * 50)) * 0.35;
    const noise = rand() * 0.4;
    out[i] = Math.max(0.06, Math.min(1, envelope * (0.55 + noise) + beat));
  }
  return out;
}

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* =========================================================
   Top bar
   ========================================================= */
function TopBar({ onOpenMenu, menuOpen, onCloseMenu, theme, onCycleTheme }) {
  return (
    <div className="topbar">
      <a className="brand" href="#">
        <img className="brand-inline" src="assets/logo-inline.png" alt="Loopretto" />
        <img className="brand-icon" src="assets/icon.png" alt="" />
        <span className="brand-wordmark">Loopretto</span>
      </a>
      <div className="top-actions">
        <div className="kbd-hint">
          <kbd>Space</kbd> play
          <span style={{ opacity: 0.5 }}>·</span>
          <kbd>←</kbd><kbd>→</kbd> nudge
        </div>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={onOpenMenu} aria-label="Menu">
            <Icon.Menu />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onCloseMenu} />
              <div className="menu-panel open">
                <div className="menu-item" onClick={() => { onCloseMenu(); document.documentElement.requestFullscreen?.(); }}>
                  Focus mode <span className="meta">F</span>
                </div>
                <div className="menu-item" onClick={() => { onCycleTheme(); onCloseMenu(); }}>
                  Background <span className="meta" style={{ textTransform: "capitalize" }}>{theme}</span>
                </div>
                <div className="menu-sep" />
                <div className="menu-item" onClick={onCloseMenu}>How to use</div>
                <div className="menu-item" onClick={onCloseMenu}>About Loopretto</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Loading zone (URL input)
   ========================================================= */
function LoadingZone({ url, setUrl, onLoad, loading, hidden }) {
  if (hidden) return null;
  return (
    <div className="loading-zone">
      <span className="eyebrow">Practice · Loop · Learn by ear</span>
      <h1 className="tagline">
        Drop a YouTube link — loop any phrase, slow it down, and learn it <em>by feel</em>.
      </h1>
      <form className="url-form" onSubmit={(e) => { e.preventDefault(); onLoad(); }}>
        <span className="yt-icon"><Icon.YouTube /></span>
        <input
          className="url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          spellCheck={false}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? <><span className="spinner" /> Fetching</> : <>Load audio</>}
        </button>
      </form>
      <div className="suggested">
        <span style={{ color: "var(--text-dim)", fontSize: 12, marginRight: 4, alignSelf: "center" }}>Try:</span>
        {SUGGESTED.map((s) => (
          <button key={s.url} className="chip" onClick={() => setUrl(s.url)}>
            <span className="dot" /> {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   Thumb + title zone
   ========================================================= */
function ThumbZone({ track, onChange, onDownload, hidden }) {
  if (hidden) return null;
  return (
    <div className="thumb-zone">
      <div className="thumb-left">
        <div className="thumb">
          {/* fake thumbnail since we can't fetch real ones */}
          <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="thumbg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.45 0.16 290)"/>
                <stop offset="60%" stopColor="oklch(0.32 0.12 280)"/>
                <stop offset="100%" stopColor="oklch(0.2 0.05 260)"/>
              </linearGradient>
            </defs>
            <rect width="160" height="90" fill="url(#thumbg)"/>
            {Array.from({ length: 28 }, (_, i) => (
              <rect key={i}
                x={6 + i * 5.4}
                y={45 - 4 - 25 * Math.abs(Math.sin(i * 0.6))}
                width="3"
                height={8 + 50 * Math.abs(Math.sin(i * 0.6))}
                rx="1.5"
                fill="oklch(1 0 0 / 0.85)"
                opacity={0.7}
              />
            ))}
            <circle cx="80" cy="46" r="14" fill="oklch(0 0 0 / 0.4)"/>
            <path d="M75 39 L75 53 L88 46 Z" fill="oklch(1 0 0 / 0.95)"/>
          </svg>
        </div>
        <div className="thumb-meta">
          <h2 className="video-title">{track?.title || "Untitled Track"}</h2>
          <div className="video-sub">
            <span className="pill live"><span className="dot" /> ready</span>
            <span className="pill">{track?.duration || "0:00"}</span>
            <span>{track?.artist || "Unknown"}</span>
          </div>
        </div>
      </div>
      <div className="thumb-actions">
        <button className="ghost-btn" onClick={onChange} title="Load a different song">
          <Icon.Refresh /> Change
        </button>
        <button className="ghost-btn" onClick={onDownload} title="Download audio">
          <Icon.Download /> Download
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Waveform
   ========================================================= */
/* =========================================================
   Smooth waveform (SVG path)
   ========================================================= */
function SmoothWave({ data, playedPct, loopRange }) {
  const n = data.length;
  const w = 1000;
  const h = 160;
  const pts = (sign) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 + sign * (data[i] * h * 0.46);
      out.push([x, y]);
    }
    return out;
  };
  const toPath = (points) => {
    let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const xc = (x0 + x1) / 2;
      const yc = (y0 + y1) / 2;
      d += ` Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
    return d;
  };
  const top = pts(-1);
  const bot = pts(1).reverse();
  const fullPath = `${toPath(top)} L ${bot[0][0].toFixed(1)} ${bot[0][1].toFixed(1)} ${toPath(bot)} Z`;
  return (
    <svg
      style={{ position: "absolute", inset: "24px 14px 24px 14px", width: "calc(100% - 28px)", height: "calc(100% - 48px)" }}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id="played-clip">
          <rect x="0" y="0" width={(playedPct / 100) * w} height={h} />
        </clipPath>
        {loopRange && (
          <clipPath id="loop-clip">
            <rect x={loopRange[0] * w} y="0" width={(loopRange[1] - loopRange[0]) * w} height={h} />
          </clipPath>
        )}
      </defs>
      <path d={fullPath} fill="var(--bar-color, oklch(0.45 0.04 280))" opacity="0.6" />
      <path d={fullPath} fill="var(--accent)" clipPath="url(#played-clip)" />
      {loopRange && (
        <path d={fullPath} fill="var(--accent)" opacity="0.55" clipPath="url(#loop-clip)" />
      )}
    </svg>
  );
}

function Waveform({ loaded, waveData, currentTime, duration, loopStart, loopEnd, loopActive, onSeek, onSetLoop, zoom, style }) {
  const stageRef = useRef(null);
  const [drag, setDrag] = useState(null); // { kind: 'start'|'end'|'move', startX, origStart, origEnd }

  const bars = waveData.length;
  const totalWidth = 100 + zoom * 4; // percent of stage

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = (e) => {
    if (!loaded || drag) return;
    const rect = stageRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, pct)) * duration);
  };

  // bar coloring
  const loopRange = loopActive && loopStart != null && loopEnd != null
    ? [loopStart / duration, loopEnd / duration]
    : null;

  return (
    <div className="waveform-card">
      <div className="wave-toolbar">
        <div className="left">
          <span className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span className="muted"> / {formatTime(duration)}</span>
          </span>
          {loopActive && loopStart != null && loopEnd != null && (
            <span className="tag" style={{ color: "var(--accent)", borderColor: "var(--accent-line)" }}>
              <Icon.Loop /> {formatTime(loopStart)} – {formatTime(loopEnd)}
            </span>
          )}
        </div>
        <div className="right">
          <span className="tag">{loaded ? `${bars} samples` : "no audio"}</span>
          <span className="tag">{Math.round(zoom)}% zoom</span>
        </div>
      </div>

      <div
        className="waveform-stage"
        ref={stageRef}
        onClick={handleClick}
      >
        <div className="wave-grid" />
        {!loaded && (
          <div className="wave-empty">
            <div>
              <Icon.Wave />
              <div>Load a YouTube link to see the waveform</div>
            </div>
          </div>
        )}
        {loaded && (
          <>
            {style === "smooth" ? (
              <SmoothWave
                data={waveData}
                playedPct={playedPct}
                loopRange={loopRange}
              />
            ) : (
              <div className="wave-canvas">
                {waveData.map((v, i) => {
                  const t = (i + 0.5) / bars;
                  const played = t * 100 <= playedPct;
                  const inLoop = loopRange && t >= loopRange[0] && t <= loopRange[1];
                  let cls = "wave-bar";
                  if (inLoop) cls += " in-loop";
                  if (played) cls += " played";
                  return (
                    <div
                      key={i}
                      className={cls}
                      style={{
                        height: `${Math.max(4, v * 100)}%`,
                        opacity: inLoop ? 1 : (played ? 1 : 0.7),
                      }}
                    />
                  );
                })}
              </div>
            )}
            {loopActive && loopStart != null && loopEnd != null && duration > 0 && (
              <div
                className="wave-loop"
                style={{
                  left: `${(loopStart / duration) * 100}%`,
                  width: `${((loopEnd - loopStart) / duration) * 100}%`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const rect = stageRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  setDrag({ kind: "move", startX: x, origStart: loopStart, origEnd: loopEnd });
                }}
              >
                <span className="wave-loop-label">LOOP</span>
              </div>
            )}
            <div
              className="wave-playhead"
              style={{ left: `${playedPct}%` }}
            />
            <div className="timeline">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i}>{formatTime((i / 5) * duration)}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Controls row
   ========================================================= */
function Controls({
  loaded, playing, onTogglePlay,
  loopActive, onToggleLoop,
  speed, onSpeedDown, onSpeedUp,
  zoom, onZoomChange,
  pianoOpen, onTogglePiano,
}) {
  return (
    <div className="controls-row">
      <div className="transport">
        <button className="play-btn" disabled={!loaded} onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Icon.Pause /> : <Icon.Play />}
        </button>
        <button
          className={`loop-btn ${loopActive ? "active" : ""}`}
          disabled={!loaded}
          onClick={onToggleLoop}
        >
          <Icon.Loop />
          {loopActive ? (
            <>
              <span className="loop-dot" /> Looping
            </>
          ) : (
            <>Loop section</>
          )}
        </button>
      </div>

      <div className="controls-middle">
        <div className="control-group" title="Playback speed">
          <span className="label">Speed</span>
          <button className="stepper-btn" disabled={!loaded} onClick={onSpeedDown}>−</button>
          <span className="stepper-value">{Math.round(speed * 100)}%</span>
          <button className="stepper-btn" disabled={!loaded} onClick={onSpeedUp}>+</button>
        </div>
        <div className="control-group" title="Waveform zoom">
          <span className="label">Zoom</span>
          <div className="zoom-range-wrap">
            <input
              className="zoom-range"
              type="range" min="0" max="100" step="10"
              value={zoom}
              disabled={!loaded}
              onChange={(e) => onZoomChange(Number(e.target.value))}
            />
            <span className="stepper-value" style={{ minWidth: 38 }}>{zoom}%</span>
          </div>
        </div>
      </div>

      <div className="right-cluster">
        <button
          className={`piano-toggle ${pianoOpen ? "active" : ""}`}
          disabled={!loaded}
          onClick={onTogglePiano}
        >
          <Icon.Piano /> Piano
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Piano
   ========================================================= */
const WHITE_NOTES = [
  { note: "C", key: "z" },
  { note: "D", key: "x" },
  { note: "E", key: "c" },
  { note: "F", key: "v" },
  { note: "G", key: "b" },
  { note: "A", key: "n" },
  { note: "B", key: "m" },
];
const BLACK_NOTES = [
  { note: "Db", key: "s", afterIndex: 0 },
  { note: "Eb", key: "d", afterIndex: 1 },
  { note: "Gb", key: "g", afterIndex: 3 },
  { note: "Ab", key: "h", afterIndex: 4 },
  { note: "Bb", key: "j", afterIndex: 5 },
];

function Piano({ show, activeNotes, onPlayNote }) {
  if (!show) return null;
  const keysRef = useRef(null);
  return (
    <div className="piano-card show">
      <div className="piano-head">
        <h3>Reference piano</h3>
        <p>Click keys or press the highlighted letters · use C–B / sharps as s d g h j</p>
      </div>
      <div className="piano-keys" ref={keysRef}>
        <div style={{ position: "relative", display: "flex" }}>
          {WHITE_NOTES.map((w, i) => (
            <div
              key={w.note}
              className={`key white ${activeNotes.has(w.note) ? "active" : ""}`}
              onMouseDown={() => onPlayNote(w.note)}
            >
              <span className="note-label">{w.note}</span>
              <span className="kbd-label">{w.key}</span>
            </div>
          ))}
          {BLACK_NOTES.map((b) => {
            const whiteWidth = 64 + 4;
            const left = whiteWidth * (b.afterIndex + 1) - 19;
            return (
              <div
                key={b.note}
                className={`key black ${activeNotes.has(b.note) ? "active" : ""}`}
                style={{ left }}
                onMouseDown={() => onPlayNote(b.note)}
              >
                <span className="kbd-label">{b.key}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Tweaks
   ========================================================= */
function LoopretttoTweaks({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Look & feel">
        <TweakRadio
          label="Theme"
          options={[
            { value: "midnight", label: "Midnight" },
            { value: "daylight", label: "Daylight" },
            { value: "mono", label: "Mono" },
          ]}
          value={t.theme}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakColor
          label="Accent"
          options={["#8b6ef0", "#e87a5d", "#5fb8e8", "#b8e85f"]}
          value={({ purple: "#8b6ef0", coral: "#e87a5d", cyan: "#5fb8e8", lime: "#b8e85f" })[t.accent]}
          onChange={(v) => {
            const map = { "#8b6ef0": "purple", "#e87a5d": "coral", "#5fb8e8": "cyan", "#b8e85f": "lime" };
            setTweak("accent", map[v] || "purple");
          }}
        />
      </TweakSection>
      <TweakSection label="Waveform">
        <TweakRadio
          label="Style"
          options={[
            { value: "bars", label: "Bars" },
            { value: "smooth", label: "Smooth" },
          ]}
          value={t.waveStyle}
          onChange={(v) => setTweak("waveStyle", v)}
        />
        <TweakToggle label="Compact" value={t.compact} onChange={(v) => setTweak("compact", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

/* =========================================================
   App
   ========================================================= */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme class on body
  useEffect(() => {
    const cls = `theme-${t.theme}`;
    document.body.classList.remove("theme-midnight", "theme-daylight", "theme-mono");
    document.body.classList.add(cls);
    document.body.classList.toggle("compact", !!t.compact);
  }, [t.theme, t.compact]);

  // Apply accent CSS vars
  useEffect(() => {
    const a = ACCENT_MAP[t.accent] || ACCENT_MAP.purple;
    const root = document.documentElement.style;
    root.setProperty("--accent", `oklch(${a.l} ${a.c} ${a.h})`);
    root.setProperty("--accent-soft", `oklch(${a.l} ${a.c} ${a.h} / 0.18)`);
    root.setProperty("--accent-line", `oklch(${a.l} ${a.c} ${a.h} / 0.5)`);
    root.setProperty("--accent-ink", a.ink);
  }, [t.accent]);

  // State
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=gCARYHv6sdY");
  const [loading, setLoading] = useState(false);
  const [track, setTrack] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(0);
  const [loopActive, setLoopActive] = useState(false);
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const [pianoOpen, setPianoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNotes, setActiveNotes] = useState(new Set());

  // Seed waveform per track
  const waveData = useMemo(() => {
    if (!track) return [];
    const seed = (track.title || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return generateWave(seed, 220);
  }, [track]);

  const loaded = track != null;

  // Mock load
  const handleLoad = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const found = SUGGESTED.find((s) => s.url === url) || SUGGESTED[2];
      const [m, s] = (found.duration || "3:34").split(":").map(Number);
      setTrack({
        title: found.label,
        artist: found.artist,
        duration: found.duration,
        url,
      });
      setDuration(m * 60 + s);
      setCurrentTime(0);
      setPlaying(false);
      setLoopActive(false);
      setLoopStart(null);
      setLoopEnd(null);
      setLoading(false);
    }, 900);
  }, [url]);

  const handleChange = () => {
    setTrack(null);
    setPlaying(false);
  };

  // Tick "playback"
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf;
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        let nt = t + dt * speed;
        if (loopActive && loopStart != null && loopEnd != null && nt >= loopEnd) {
          nt = loopStart;
        }
        if (nt >= duration) {
          nt = 0;
          setPlaying(false);
        }
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, loopActive, loopStart, loopEnd, duration]);

  // Space / arrow / piano keys
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!loaded) return;
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!loaded) return;
        setCurrentTime((t) => Math.max(0, t - 0.5));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!loaded) return;
        setCurrentTime((t) => Math.min(duration, t + 0.5));
      }
      const allKeys = { z: "C", x: "D", c: "E", v: "F", b: "G", n: "A", m: "B", s: "Db", d: "Eb", g: "Gb", h: "Ab", j: "Bb" };
      if (loaded && pianoOpen && allKeys[e.key]) {
        playNote(allKeys[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loaded, duration, pianoOpen]);

  const playNote = useCallback((note) => {
    setActiveNotes((s) => new Set(s).add(note));
    setTimeout(() => {
      setActiveNotes((s) => {
        const next = new Set(s);
        next.delete(note);
        return next;
      });
    }, 280);
  }, []);

  const handleSeek = (t) => {
    setCurrentTime(t);
    if (!loopActive) setLoopStart(t);
  };

  const handleToggleLoop = () => {
    if (loopActive) {
      setLoopActive(false);
      setLoopStart(null);
      setLoopEnd(null);
      return;
    }
    // create a loop based on currentTime (acts as cursor) — default 5s
    const start = currentTime || 0;
    const end = Math.min(duration, start + Math.max(5, duration * 0.12));
    setLoopStart(start);
    setLoopEnd(end);
    setLoopActive(true);
  };

  return (
    <div className="app-shell">
      <TopBar
        onOpenMenu={() => setMenuOpen((o) => !o)}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        theme={t.theme}
        onCycleTheme={() => {
          const order = ["midnight", "daylight", "mono"];
          const next = order[(order.indexOf(t.theme) + 1) % order.length];
          setTweak("theme", next);
        }}
      />

      <LoadingZone
        url={url}
        setUrl={setUrl}
        onLoad={handleLoad}
        loading={loading}
        hidden={loaded}
      />

      <ThumbZone
        track={track}
        hidden={!loaded}
        onChange={handleChange}
        onDownload={() => alert("Downloading audio…")}
      />

      <Waveform
        loaded={loaded}
        waveData={waveData}
        currentTime={currentTime}
        duration={duration}
        loopStart={loopStart}
        loopEnd={loopEnd}
        loopActive={loopActive}
        onSeek={handleSeek}
        onSetLoop={(s, e) => { setLoopStart(s); setLoopEnd(e); }}
        zoom={zoom}
        style={t.waveStyle}
      />

      <Controls
        loaded={loaded}
        playing={playing}
        onTogglePlay={() => setPlaying((p) => !p)}
        loopActive={loopActive}
        onToggleLoop={handleToggleLoop}
        speed={speed}
        onSpeedDown={() => setSpeed((s) => Math.max(0.1, Math.round((s - 0.1) * 10) / 10))}
        onSpeedUp={() => setSpeed((s) => Math.min(2, Math.round((s + 0.1) * 10) / 10))}
        zoom={zoom}
        onZoomChange={setZoom}
        pianoOpen={pianoOpen}
        onTogglePiano={() => setPianoOpen((p) => !p)}
      />

      <Piano
        show={pianoOpen}
        activeNotes={activeNotes}
        onPlayNote={playNote}
      />

      <div className="footer">
        <span>Loopretto · v2 redesign</span>
        <div className="right">
          <a href="#">How to use</a>
          <a href="#">About</a>
          <a className="kofi-btn" href="https://ko-fi.com/" target="_blank">
            <span className="heart">♥</span> Support
          </a>
        </div>
      </div>

      <LoopretttoTweaks t={t} setTweak={setTweak} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
