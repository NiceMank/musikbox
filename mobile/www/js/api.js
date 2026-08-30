/* MusikBox data layer — REAL online search via iTunes Search API (verified working,
   30s previews + artwork + metadata), plus an optional MusikBox server (server.py)
   used for health/stream proxy. Config uses window.MUSIKBOX_API or localStorage. */
(function (global) {
  "use strict";

  function apiBase() {
    const env = (window.MUSIKBOX_API || localStorage.getItem("musikbox.api") || "");
    if (env) return env.replace(/\/+$/, "");
    return ""; // when empty, online uses iTunes only
  }

  async function fetchJSON(url, opts) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  // ---- Online (iTunes) ----
  async function searchOnline(q, limit) {
    const url = "https://itunes.apple.com/search?" + new URLSearchParams({
      term: q, media: "music", entity: "song", limit: String(limit || 28),
      country: "fr", lang: "fr_fr",
    });
    const data = await fetchJSON(url);
    return (data.results || []).filter(r => r.previewUrl).map(r => ({
      key: "it-" + r.trackId,
      title: r.trackName, artist: r.artistName, album: r.collectionName || "",
      genre: r.primaryGenreName || "",
      thumb: (r.artworkUrl100 || "").replace("100x100", "400x400"),
      artwork: (r.artworkUrl100 || "").replace("100x100", "600x600"),
      previewUrl: r.previewUrl,
      duration: Math.round((r.trackTimeMillis || 30000) / 1000),
      source: "online",
    }));
  }

  async function topOnline(limit) {
    // A "trending" list for the home screen — curated query against iTunes.
    const q = ["top hits", "afro", "amapiano", "gospel", "dance"][Math.floor(Math.random() * 5)];
    return searchOnline(q, limit || 12);
  }

  // ---- Optional MusikBox server ----
  async function serverHealth() {
    const base = apiBase();
    if (!base) return { ok: false, reason: "no-server" };
    try { const d = await fetchJSON(base + "/api/health"); return { ok: !!d.ok, data: d }; }
    catch (e) { return { ok: false, reason: "unreachable", error: String(e) }; }
  }

  // Backend search (works only if the target site isn't behind an anti-bot wall) —
  // attempted when a server is configured; iTunes remains the dependable source.
  async function searchServer(q) {
    const base = apiBase();
    if (!base) return [];
    const d = await fetchJSON(base + "/api/search?q=" + encodeURIComponent(q));
    return (d.items || []).map(it => ({
      key: "srv-" + (it.url || it.title), title: it.title, artist: "",
      thumb: it.thumb || "", previewUrl: null, duration: it.duration || 0,
      src: (it.url && base + "/stream?u=" + btoa(it.url).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")),
      serverUrl: it.url, source: "online",
    }));
  }

  // Combine local search + online for the "All" source.
  function searchLocal(query) {
    const q = (query || "").toLowerCase();
    return Object.values(DB.localIndex)
      .filter(t => !q || (t.title + " " + t.artist + " " + t.album + " " + t.genre).toLowerCase().includes(q))
      .map(t => Object.assign({}, t, { source: "local" }));
  }

  function combine(online, local) {
    const keys = new Set();
    const out = [];
    (local || []).forEach(t => { keys.add(t.key); out.push(t); });
    (online || []).forEach(t => { if (!keys.has(t.key)) out.push(t); keys.add(t.key); });
    return out;
  }

  window.isOnline = navigator.onLine;
  window.addEventListener("online", () => { window.isOnline = true; });
  window.addEventListener("offline", () => { window.isOnline = false; });

  global.API = { searchOnline, searchServer, topOnline, searchLocal, combine, serverHealth, apiBase };
})(window);
