/* MusikBox local music scanner.
   Uses the native AetherMedia plugin to request READ_MEDIA_AUDIO at runtime and
   enumerate device AUDIO with real metadata (title/artist/album/duration) from
   Android MediaStore — including internal storage, the Download folder and the
   SD card, so music spread across folders is all found. Falls back gracefully
   in a browser. */
(function (global) {
  "use strict";

  function aetherMedia() {
    try {
      if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform &&
          Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.AetherMedia)
        return Capacitor.Plugins.AetherMedia;
    } catch (e) {}
    return null;
  }

  const Scan = {
    async permission() {
      const m = aetherMedia();
      if (!m) return { granted: true, unsupported: true };
      try {
        const r = await m.checkPermission();
        if (r.granted) return { granted: true };
        const req = await m.requestPermission();
        return { granted: !!req.granted, denied: req.granted === false };
      } catch (e) {
        return { granted: false, error: String(e) };
      }
    },

    async run(onProgress) {
      const m = aetherMedia();
      if (!m) return { items: [], unsupported: true };
      const perms = await this.permission();
      if (!perms.granted) return { items: [], denied: true };

      const items = [];
      try {
        const res = await m.getAudio({ limit: 5000 });
        if (res && res.denied) return { items: [], denied: true };
        (res.items || []).forEach(f => items.push(normalize(f)));
        if (onProgress) onProgress(items.length, res);
      } catch (e) {
        return { items, unsupported: false };
      }
      return { items, unsupported: false };
    },
  };

  function normalize(f) {
    const title = f.title || "Inconnu";
    const artist = f.artist || "Inconnu";
    const album = f.album || "";
    let uri = f.uri || f.fileUri || f.path || "";
    // content://media/... URIs are streamed by Capacitor through its local asset
    // server (convertFileSrc) once the read permission is granted.
    if (typeof window.convertFileSrc === "function" && uri && !/^(blob:|https?:)/i.test(uri)) {
      try { uri = window.convertFileSrc(uri); } catch (e) {}
    }
    return {
      key: f.key || ("loc-" + uri),
      title, artist, album,
      genre: f.genre || "",
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
