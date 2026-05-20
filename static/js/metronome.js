// ====== Metronome ======
// Sample-based click scheduled on the Web Audio clock using the classic
// look-ahead scheduler (Chris Wilson, "A Tale of Two Clocks") for tight timing
// that doesn't drift with the JS event loop. Plays alongside the loaded track.
(function () {
  "use strict";

  function Metronome() {
    this.ctx = null;
    this.dest = null;
    this.buffer = null;
    this.sampleUrl = null;

    this.bpm = 100;
    this.beatsPerBar = 4;
    this.isRunning = false;

    this.lookahead = 25; // ms between scheduler ticks
    this.scheduleAhead = 0.1; // seconds of audio to schedule ahead
    this.nextNoteTime = 0;
    this.currentBeat = 0;
    this.timerId = null;

    this.tapTimes = [];
    this.onBeat = null; // callback(beatIndex, isDownbeat)
    this._pendingBeats = [];
    this._rafId = null;
  }

  // Wire up to a shared AudioContext + destination, and load the click sample.
  Metronome.prototype.attach = function (ctx, dest, sampleUrl) {
    this.ctx = ctx;
    this.dest = dest;
    if (sampleUrl) this.sampleUrl = sampleUrl;
    return this._loadSample();
  };

  Metronome.prototype._loadSample = function () {
    if (this.buffer || !this.ctx || !this.sampleUrl) return Promise.resolve();
    var self = this;
    return fetch(this.sampleUrl)
      .then(function (r) {
        return r.arrayBuffer();
      })
      .then(function (data) {
        return self.ctx.decodeAudioData(data);
      })
      .then(function (decoded) {
        self.buffer = decoded;
      })
      .catch(function (e) {
        console.error("Metronome sample failed to load", e);
      });
  };

  Metronome.prototype.setBpm = function (bpm) {
    this.bpm = Math.max(20, Math.min(300, Math.round(bpm)));
    return this.bpm;
  };

  Metronome.prototype.setBeatsPerBar = function (n) {
    this.beatsPerBar = Math.max(1, n | 0);
  };

  Metronome.prototype._scheduleClick = function (beat, time) {
    // With 1 beat per bar there's no bar to accent, so every click is plain.
    var isDownbeat = beat === 0 && this.beatsPerBar > 1;
    if (this.buffer) {
      var src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      // Accent the downbeat: a touch louder and slightly higher pitched.
      src.playbackRate.value = isDownbeat ? 1.5 : 1.0;
      var g = this.ctx.createGain();
      g.gain.value = isDownbeat ? 1.0 : 0.55;
      src.connect(g).connect(this.dest);
      src.start(time);
    }
    this._pendingBeats.push({ beat: beat, time: time, down: isDownbeat });
  };

  Metronome.prototype._scheduler = function () {
    var self = this;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      this._scheduleClick(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += 60.0 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
    if (this.isRunning) {
      this.timerId = setTimeout(function () {
        self._scheduler();
      }, this.lookahead);
    }
  };

  // Drive visual beat callbacks in sync with the audio clock.
  Metronome.prototype._visualLoop = function () {
    var self = this;
    var now = this.ctx.currentTime;
    while (this._pendingBeats.length && this._pendingBeats[0].time <= now) {
      var b = this._pendingBeats.shift();
      if (this.onBeat) this.onBeat(b.beat, b.down);
    }
    if (this.isRunning) {
      this._rafId = requestAnimationFrame(function () {
        self._visualLoop();
      });
    }
  };

  Metronome.prototype.start = function () {
    if (this.isRunning || !this.ctx) return;
    this.isRunning = true;
    this.currentBeat = 0;
    this._pendingBeats = [];
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this._scheduler();
    this._visualLoop();
  };

  Metronome.prototype.stop = function () {
    this.isRunning = false;
    if (this.timerId) clearTimeout(this.timerId);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.timerId = null;
    this._rafId = null;
    this._pendingBeats = [];
  };

  Metronome.prototype.toggle = function () {
    if (this.isRunning) this.stop();
    else this.start();
    return this.isRunning;
  };

  // Tap-tempo: call on each tap; returns the current BPM estimate.
  Metronome.prototype.tap = function () {
    var now = performance.now();
    var taps = this.tapTimes;
    if (taps.length && now - taps[taps.length - 1] > 2000) {
      // Long gap, start a fresh measurement.
      taps.length = 0;
    }
    taps.push(now);
    if (taps.length > 6) taps.shift();
    if (taps.length >= 2) {
      var sum = 0;
      for (var i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      var avgMs = sum / (taps.length - 1);
      this.setBpm(60000 / avgMs);
    }
    return this.bpm;
  };

  window.Metronome = Metronome;
})();
