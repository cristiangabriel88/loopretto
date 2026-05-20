// ====== Tempo (BPM) detection ======
// Offline estimate from a decoded AudioBuffer: build an energy-flux onset
// envelope, then autocorrelate it over lags that map to a musical BPM range so
// we lock onto one tempo (avoids the usual half/double-time ambiguity).
(function () {
  "use strict";

  function detect(buffer, opts) {
    opts = opts || {};
    const minBpm = opts.minBpm || 70;
    const maxBpm = opts.maxBpm || 190;
    const sr = buffer.sampleRate;

    // Mono mixdown of up to the first ~60s (plenty for a stable estimate).
    const maxSamples = Math.min(buffer.length, Math.floor(sr * 60));
    const chCount = buffer.numberOfChannels;
    const ch0 = buffer.getChannelData(0);
    const mono = new Float32Array(maxSamples);
    if (chCount > 1) {
      const ch1 = buffer.getChannelData(1);
      for (let i = 0; i < maxSamples; i++) mono[i] = 0.5 * (ch0[i] + ch1[i]);
    } else {
      mono.set(ch0.subarray(0, maxSamples));
    }

    // Energy-flux onset envelope (half-wave rectified frame-to-frame increase).
    const hop = 512;
    const win = 1024;
    const frameTime = hop / sr;
    const nFrames = Math.floor((maxSamples - win) / hop);
    if (nFrames < 16) return 0;

    const env = new Float32Array(nFrames);
    let prevEnergy = 0;
    let mean = 0;
    for (let i = 0; i < nFrames; i++) {
      const start = i * hop;
      let e = 0;
      for (let j = 0; j < win; j++) {
        const v = mono[start + j];
        e += v * v;
      }
      const flux = e > prevEnergy ? e - prevEnergy : 0;
      prevEnergy = e;
      env[i] = flux;
      mean += flux;
    }
    mean /= nFrames;
    // Mean-subtract so the autocorrelation reflects periodicity, not DC level.
    for (let i = 0; i < nFrames; i++) env[i] = Math.max(0, env[i] - mean);

    // Autocorrelate over the lag range for [minBpm, maxBpm].
    const minLag = Math.max(1, Math.floor(60 / maxBpm / frameTime));
    const maxLag = Math.ceil(60 / minBpm / frameTime);
    let bestLag = -1;
    let bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < nFrames; i++) sum += env[i] * env[i - lag];
      if (sum > bestScore) {
        bestScore = sum;
        bestLag = lag;
      }
    }
    if (bestLag <= 0 || bestScore <= 0) return 0;

    let bpm = 60 / (bestLag * frameTime);
    // The dominant periodicity is often the eighth-note pulse (e.g. 167 for an
    // ~83 BPM groove). Fold only clearly-too-fast results down one octave; real
    // beat tempos sit comfortably under ~160.
    if (bpm > 160) bpm /= 2;
    return Math.round(bpm);
  }

  window.TempoDetect = { detect: detect };
})();
