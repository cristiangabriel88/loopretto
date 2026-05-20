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
    if (!Array.isArray(d.sessions)) d.sessions = [];
    if (typeof d.goalMin !== "number" || !(d.goalMin > 0)) d.goalMin = 30;
    // --- Streak (Duolingo-style) state ---
    if (typeof d.bestStreak !== "number" || d.bestStreak < 0) d.bestStreak = 0;
    if (typeof d.freezes !== "number" || d.freezes < 0) d.freezes = 0;
    if (!d.frozen || typeof d.frozen !== "object") d.frozen = {};
    if (typeof d.freezeRewarded !== "number" || d.freezeRewarded < 0) d.freezeRewarded = 0;
    return d;
  }

  var SESSIONS_CAP = 100; // keep the most recent N completed sessions
  var EARN_EVERY = 5; // grant a freeze token every N streak days
  var MAX_FREEZES = 2; // cap on banked freeze tokens

  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  // A day "counts" toward the streak if it had practice or was bridged by a freeze.
  function dayCounts(d, key) {
    return (d.daily[key] && d.daily[key].ms > 0) || !!d.frozen[key];
  }

  // Compute the current streak: consecutive counting days ending today, anchored
  // on yesterday if today has none yet so it doesn't visibly reset mid-day.
  function computeStreak(d) {
    var cursor = new Date();
    if (!dayCounts(d, dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    var n = 0;
    while (dayCounts(d, dayKey(cursor))) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }

  // Most recent day (YYYY-MM-DD) with logged practice, or null.
  function lastActiveDay(d) {
    var keys = Object.keys(d.daily).filter(function (k) {
      return d.daily[k] && d.daily[k].ms > 0;
    });
    keys.sort();
    return keys.length ? keys[keys.length - 1] : null;
  }

  // Bridge a recent gap with freeze tokens. Only spends tokens if the whole gap
  // (the days after the last active day, up to yesterday) can be fully covered,
  // so we never waste a token on an already-broken streak. Never touches today.
  // All date math is in UTC to stay consistent with dayKey().
  function applyFreezes(d) {
    var la = lastActiveDay(d);
    if (!la) return;
    var yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    var yKey = dayKey(yesterday);
    var gap = [];
    var c = new Date(la + "T00:00:00Z");
    c.setUTCDate(c.getUTCDate() + 1);
    while (dayKey(c) <= yKey) {
      var k = dayKey(c);
      if (!dayCounts(d, k)) gap.push(k);
      c.setUTCDate(c.getUTCDate() + 1);
    }
    if (gap.length > 0 && d.freezes >= gap.length) {
      gap.forEach(function (k) {
        d.frozen[k] = true;
        d.freezes--;
      });
    }
  }

  // Grant freeze tokens for streak milestones not yet rewarded (capped).
  function rewardFreezes(d, cur) {
    var milestone = Math.floor(cur / EARN_EVERY) * EARN_EVERY;
    if (milestone > d.freezeRewarded) {
      var grant = (milestone - d.freezeRewarded) / EARN_EVERY;
      d.freezes = Math.min(MAX_FREEZES, d.freezes + grant);
      d.freezeRewarded = milestone;
    }
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

    // --- Daily goal (minutes) ---
    getGoal: function () {
      return read().goalMin;
    },
    setGoal: function (min) {
      min = Math.round(Number(min));
      if (!(min > 0)) return;
      var d = read();
      d.goalMin = min;
      write(d);
    },

    // Consecutive days (ending today) with any logged practice or a freeze. If
    // today has none yet, we anchor on yesterday so the streak doesn't visibly
    // reset partway through the day.
    streak: function () {
      return computeStreak(read());
    },

    // Reconcile freezes for any recent gap, recompute the streak, update the
    // best-streak record, and grant milestone freeze tokens. The single entry
    // point the UI calls; returns the current streak snapshot.
    refreshStreak: function () {
      var d = read();
      applyFreezes(d);
      var cur = computeStreak(d);
      if (cur > d.bestStreak) d.bestStreak = cur;
      rewardFreezes(d, cur);
      write(d);
      return { current: cur, best: d.bestStreak, freezes: d.freezes };
    },

    // Per-day status for the week-dots calendar.
    dayInfo: function (key) {
      var d = read();
      return { ms: (d.daily[key] && d.daily[key].ms) || 0, frozen: !!d.frozen[key] };
    },

    // Record a completed practice session (newest first, capped).
    addSession: function (entry) {
      if (!entry || !(entry.ms > 0)) return;
      var d = read();
      d.sessions.unshift({
        date: today(),
        start: entry.start || Date.now(),
        ms: entry.ms,
        songId: entry.songId || null,
        title: entry.title || "",
        note: entry.note || "",
        reps: entry.reps || 0,
        pomos: entry.pomos || 0,
      });
      if (d.sessions.length > SESSIONS_CAP) d.sessions.length = SESSIONS_CAP;
      write(d);
    },

    recentSessions: function (n) {
      var s = read().sessions;
      return n ? s.slice(0, n) : s.slice();
    },

    clearAll: function () {
      write({
        songs: {},
        daily: {},
        sessions: [],
        goalMin: 30,
        bestStreak: 0,
        freezes: 0,
        frozen: {},
        freezeRewarded: 0,
      });
    },
  };

  window.PracticeStore = PracticeStore;
})();
