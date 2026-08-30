/* MusikBox local music scanner.
   Uses the Capacitor Media plugin (@capacitor-community/media) when available to
   enumerate device audio with real metadata. Falls back gracefully in a browser. */
(function (global) {
  "use strict";

  function capMedia() {
    try {
      if (typeof Capacitor !== "undefined" && Capacitor.Plugins && Capacitor.Plugins.Media)
        return Capacitor.Plugins.Media;
    } catch (e) {}
    return null;
  }

  const Scan = {
    async permission() {
      const m = capMedia();
      if (!m) return { granted: true, unsupported: true };
      try { return await m.requestPermissions(); }
      catch (e) { return { granted: false, error: String(e) }; }
    },

    async run(onProgress) {
      const m = capMedia();
      if (!m) { return { items: [], unsupported: true }; }
      const perms = await this.permission();
      if (!perms.granted) return { items: [], denied: true };

      const items = [];
      let n = 0;
      // The Media plugin reports files in batches; loop with a cursor.
      try {
        for (let cursor = 0; ; cursor += 200) {
          const start = Date.now();
          const res = await m.getMediaFiles({ limit: 200, cursor });
          const files = (res.files || res.media || []);
          files.forEach(f => items.push(normalize(f)));
          n += files.length;
          if (onProgress) onProgress(n, res);
          if (files.length < 200) break;
          // avoid busy loop if the plugin ignores the cursor
          if (Date.now() - start < 5 && files.length) break;
        }
      } catch (e) {
        // Try the simpler Media.getMedias? fallback: single batch
        try {
          const res = await m.getMediaFiles({ limit: 2000 });
          (res.files || res.media || []).forEach(f => items.push(normalize(f)));
        } catch (e2) { /* leave what we have */ }
      }
      return { items, unsupported: false };
    },
  };

  function normalize(f) {
    const title = f.title || f.displayName || f.name || "Inconnu";
    const artist = f.artist || "Inconnu";
    const album = f.album || "";
    const genre = f.genre || "";
    let uri = f.uri || f.fileUri || f.path || "";
    // In a Capacitor WebView, native file:// URIs need conversion to be playable.
    if (typeof window.convertFileSrc === "function" && uri && !/^(blob:|https?:)/.test(uri)) {
      try { uri = window.convertFileSrc(uri); } catch (e) {}
    }
    return {
      key: "loc-" + (uri || (title + artist + album)),
      title, artist, album, genre,
      duration: Math.round((f.duration || 0) / 1000),
      uri,
      size: f.size || 0,
      mime: f.mimeType || "audio/mpeg",
      source: "local",
      local: true,
    };
  }

  global.Scan = Scan;
})(window);
