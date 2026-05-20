// ====== Setlists (saved practice playlists) ======
// localStorage-backed named lists of songs. Only URL-based songs can be saved
// (a dropped local file has no durable reference to reload from).
(function () {
  "use strict";

  var KEY = "loopretto.setlists";

  function read() {
    var d;
    try {
      d = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      d = null;
    }
    if (!d || typeof d !== "object") d = {};
    if (!d.lists || typeof d.lists !== "object") d.lists = {};
    return d;
  }

  function write(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      /* best-effort */
    }
  }

  var SetlistStore = {
    names: function () {
      return Object.keys(read().lists).sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
    },

    songs: function (name) {
      return read().lists[name] || [];
    },

    has: function (name, songId) {
      return this.songs(name).some(function (s) {
        return s.id === songId;
      });
    },

    create: function (name) {
      name = (name || "").trim();
      if (!name) return false;
      var d = read();
      if (!d.lists[name]) d.lists[name] = [];
      write(d);
      return true;
    },

    remove: function (name) {
      var d = read();
      delete d.lists[name];
      write(d);
    },

    addSong: function (name, song) {
      if (!song || !song.id || !song.url) return false;
      var d = read();
      var list = (d.lists[name] = d.lists[name] || []);
      if (list.some(function (s) { return s.id === song.id; })) return false;
      list.push({ id: song.id, title: song.title || song.url, url: song.url, sourceType: song.sourceType || "url" });
      write(d);
      return true;
    },

    removeSong: function (name, songId) {
      var d = read();
      if (!d.lists[name]) return;
      d.lists[name] = d.lists[name].filter(function (s) {
        return s.id !== songId;
      });
      write(d);
    },

    all: function () {
      var d = read();
      var self = this;
      return this.names().map(function (n) {
        return { name: n, songs: d.lists[n] };
      });
    },
  };

  window.SetlistStore = SetlistStore;
})();
