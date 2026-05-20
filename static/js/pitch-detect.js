// ====== Pitch / note detection ======
// Time-domain autocorrelation (ACF) pitch detector. Works best on monophonic
// material; returns -1 when the signal is too quiet or too noisy to be sure.
// Adapted from Chris Wilson's public-domain PitchDetect autoCorrelate().
(function () {
  "use strict";

  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  function autoCorrelate(buf, sampleRate) {
    var SIZE = buf.length;
    var rms = 0;
    for (var i = 0; i < SIZE; i++) {
      var val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // too quiet

    var r1 = 0;
    var r2 = SIZE - 1;
    var threshold = 0.2;
    for (var j = 0; j < SIZE / 2; j++) {
      if (Math.abs(buf[j]) < threshold) {
        r1 = j;
        break;
      }
    }
    for (var k = 1; k < SIZE / 2; k++) {
      if (Math.abs(buf[SIZE - k]) < threshold) {
        r2 = SIZE - k;
        break;
      }
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    var c = new Array(SIZE).fill(0);
    for (var a = 0; a < SIZE; a++) {
      for (var b = 0; b < SIZE - a; b++) {
        c[a] = c[a] + buf[b] * buf[b + a];
      }
    }

    var d = 0;
    while (c[d] > c[d + 1]) d++;
    var maxval = -1;
    var maxpos = -1;
    for (var m = d; m < SIZE; m++) {
      if (c[m] > maxval) {
        maxval = c[m];
        maxpos = m;
      }
    }
    var T0 = maxpos;

    // Parabolic interpolation for sub-sample accuracy.
    var x1 = c[T0 - 1];
    var x2 = c[T0];
    var x3 = c[T0 + 1];
    var aa = (x1 + x3 - 2 * x2) / 2;
    var bb = (x3 - x1) / 2;
    if (aa) T0 = T0 - bb / (2 * aa);

    if (!T0) return -1;
    return sampleRate / T0;
  }

  function freqToNote(freq) {
    // MIDI note number (A4 = 440 Hz = MIDI 69).
    var midi = 69 + 12 * Math.log2(freq / 440);
    var rounded = Math.round(midi);
    var name = NOTE_NAMES[(rounded % 12 + 12) % 12];
    var octave = Math.floor(rounded / 12) - 1;
    var cents = Math.round((midi - rounded) * 100);
    return { name: name, octave: octave, cents: cents, midi: rounded };
  }

  window.PitchDetect = {
    autoCorrelate: autoCorrelate,
    freqToNote: freqToNote,
    NOTE_NAMES: NOTE_NAMES,
  };
})();
