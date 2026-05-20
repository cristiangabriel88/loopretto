// ====== Practice log (session timer + journal + daily reps) ======
// Persists per-song practice time and rep counts in localStorage. Single-user,
// local-only, no accounts, no sync.
(function () {
  "use strict";

  var KEY = "loopretto.practice";

  function today() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function read() {
    var d;
    try {
      d = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      d = null;
    }
    if (!d || typeof d !== "object") d = {};
    if (!d.songs) d.songs = {};
    if (!d.daily) d.daily = {};
    return d;
  }

  function write(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      /* storage full / disabled, practice tracking is best-effort */
    }
  }

  function songRecord(d, songId, title) {
    var s = d.songs[songId] || { title: title || "", totalMs: 0, reps: 0, last: null };
    if (title) s.title = title;
    d.songs[songId] = s;
    return s;
  }

  function dailyRecord(d) {
    var t = today();
    d.daily[t] = d.daily[t] || { ms: 0, reps: 0 };
    return d.daily[t];
  }

  var PracticeStore = {
    addTime: function (songId, title, ms) {
      if (!songId || !(ms > 0)) return;
      var d = read();
      var s = songRecord(d, songId, title);
      s.totalMs += ms;
      s.last = today();
      dailyRecord(d).ms += ms;
      write(d);
    },

    addRep: function (songId, title, n) {
      n = n || 1;
      var d = read();
      var s = songRecord(d, songId, title);
      s.reps += n;
      s.last = today();
      dailyRecord(d).reps += n;
      write(d);
    },

    song: function (songId) {
      var d = read();
      return d.songs[songId] || { title: "", totalMs: 0, reps: 0, last: null };
    },

    today: function () {
      var d = read();
      return d.daily[today()] || { ms: 0, reps: 0 };
    },

    songs: function () {
      var d = read();
      return Object.keys(d.songs)
        .map(function (k) {
          var s = d.songs[k];
          return { id: k, title: s.title, totalMs: s.totalMs, reps: s.reps, last: s.last };
        })
        .sort(function (a, b) {
          return (b.last || "").localeCompare(a.last || "") || b.totalMs - a.totalMs;
        });
    },

    clearAll: function () {
      write({ songs: {}, daily: {} });
    },
  };

  window.PracticeStore = PracticeStore;
})();
