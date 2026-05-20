// ====== Audio export (loop region -> WAV) ======
// Encodes a slice of a decoded AudioBuffer to a 16-bit PCM WAV Blob. WAV keeps
// this dependency-free (no lamejs); an 8-bar loop is small enough that file
// size doesn't matter for a local practice tool.
(function () {
  "use strict";

  function encodeWav(buffer, startSec, endSec) {
    var sr = buffer.sampleRate;
    var numCh = buffer.numberOfChannels;
    var startF = Math.max(0, Math.floor(startSec * sr));
    var endF = Math.min(buffer.length, Math.floor(endSec * sr));
    var frames = Math.max(0, endF - startF);

    var chans = [];
    for (var c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));

    var bytesPerSample = 2;
    var blockAlign = numCh * bytesPerSample;
    var dataSize = frames * blockAlign;
    var ab = new ArrayBuffer(44 + dataSize);
    var view = new DataView(ab);

    function writeStr(off, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    }

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format = PCM
    view.setUint16(22, numCh, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    var off = 44;
    for (var f = startF; f < endF; f++) {
      for (var ch = 0; ch < numCh; ch++) {
        var s = Math.max(-1, Math.min(1, chans[ch][f]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }

    return new Blob([ab], { type: "audio/wav" });
  }

  window.AudioExport = { encodeWav: encodeWav };
})();
