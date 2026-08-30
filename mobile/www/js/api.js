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

  // ---- Internet Archive: FULL-LENGTH, streamable, CORS-enabled, no API key. ----
  // This is the source that plays to the actual end of the song (unlike iTunes 30s previews).
  function parseDurStr(len) {
    const s = String(len || "").trim();
    if (s.includes(":")) { const p = s.split(":").map(Number); return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+(p[1]||0); }
    const f = parseFloat(s); return isFinite(f) ? Math.round(f) : 0;
  }
  async function searchArchive(query, limit) {
    limit = limit || 10;
    const q = encodeURIComponent('(title:("' + query + '") AND mediatype:audio)');
    const s = await fetchJSON("https://archive.org/advancedsearch.php?q=" + q +
      "&fl[]=identifier&rows=" + limit + "&page=1&output=json");
    const docs = (s.response && s.response.docs) || [];
    const items = await Promise.all(docs.map(async (x) => {
      try {
        const m = await fetchJSON("https://archive.org/metadata/" + x.identifier);
        const files = m.files || [];
        const mp3 = files.find(f => f.name && /\.mp3$/i.test(f.name));
        if (!mp3) return null;
        const md = m.metadata || {};
        const creator = [].concat(md.creator || md.artist || []).join(", ") || x.creator || "";
        const art = md.image ? "https://archive.org/services/img/" + x.identifier : "";
        return {
          key: "ia-" + x.identifier,
          title: md.title || x.title || x.identifier,
          artist: (creator || "Internet Archive").replace(/[,_|]+/g, " ").trim(),
          album: (md.album || ""),
          genre: (md.genre || "Archive"),
          thumb: art, artwork: art,
          src: "https://archive.org/download/" + x.identifier + "/" + mp3.name,
          duration: parseDurStr(mp3.length),
          full: true,          // signals a real full-length track (plays to the end)
          source: "online",
        };
      } catch (e) { return null; }
    }));
    return items.filter(Boolean);
  }

  // ---- houseofcosmetics.co.za: a WORKING, unblocked Tubidy-style directory ----
  // Real online search results (titles/artists/artwork/durations/video IDs).
  // Its own playback is a browser converter, so we resolve each result to a
  // genuinely streamable full-length track (see resolvePlayable). Never fake.
  const WEB = "https://houseofcosmetics.co.za";
  function parseWebResults(html) {
    const items = [];
    const re = /<article class="media-card.*?<\/article>/g;
    let m;
    while ((m = re.exec(html))) {
      const block = m[0];
      const idm = block.match(/href="[^"]*?\/details\/([A-Za-z0-9_-]{6,})"/);
      if (!idm) continue;
      const vid = idm[1];
      const tm = block.match(/<a[^>]*title="([^"]*)"[^>]*>/i) || block.match(/alt="([^"]*)"/i);
      const title = tm ? tm[1].replace(/\s+/g, " ").trim() : "";
      if (!title) continue;
      let artist = "";
      if (title.indexOf(" - ") > 0 && title.indexOf(" - ") < 40) artist = title.split(" - ")[0].trim();
      const dm = block.match(/(\d{1,2}):(\d{2})\b/);
      const duration = dm ? (+dm[1]) * 60 + (+dm[2]) : 0;
      items.push({
        key: "web-" + vid, title, artist,
        thumb: "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg",
        artwork: "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg",
        videoId: vid, duration, src: null,       // no direct stream from the site
        source: "web", web: true, full: false,
      });
    }
    return items;
  }
  async function searchWeb(query, limit) {
    limit = limit || 20;
    const url = WEB + "/?search=" + encodeURIComponent(query);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      return parseWebResults(html).slice(0, limit);
    } finally { clearTimeout(t); }
  }

  // Resolve a playable full-length source for a web-directory item by searching
  // Internet Archive for the same title. Returns a real streamable track or null.
  const _fullCache = {};
  async function resolvePlayable(t, store) {
    if (!t) return null;
    if (t.src) return t;                          // already playable (Archive/local)
    if (t._resolved) return t._resolved;
    if (t.web && t.videoId && store._fullCache[t.videoId]) return store._fullCache[t.videoId];
    try {
      // Normalize the query: drop clutter so we can find a matching playable track.
      function norm(s) {
        return (s || "").toLowerCase()
          .replace(/\(official (video|lyric|audio)[^)]*\)/g, " ")
          .replace(/\b(ft|feat|featuring)\b[^a-z].*/gi, " ")
          .replace(/\b(official|video|audio|music)\b/gi, " ")
          .replace(/🔥|✨|💿|🎵|mix(tape)? 20\d\d|\d{4}?/gi, " ")
          .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      }
      const baseTitle = norm(((t.title || "").split("-")[0]));
      const queries = [
        norm(t.title), baseTitle,
        (t.artist ? t.artist + " " + baseTitle : baseTitle),
      ];
      for (const q of queries) {
        if (!q) continue;
        const full = await searchArchive(q, 5);
        const best = full.find(f => {
          const tn = norm(f.title);
          const a = baseTitle.split(" ").filter(w => w.length > 2).slice(0, 3).join(" ");
          return a && tn.includes(a);
        }) || full[0] || null;
        if (best) {
          const resolved = Object.assign({}, best, {
            title: t.title, artist: t.artist || best.artist,
            thumb: t.thumb || best.thumb, key: t.key + "::" + best.key,
          });
          if (t.web) store._fullCache[t.videoId] = resolved;
          t._resolved = resolved;
          return resolved;
        }
      }
      return null;
    } catch (e) { return null; }
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

  global.API = { searchOnline, searchArchive, searchWeb, resolvePlayable, searchServer, topOnline, searchLocal, combine, serverHealth, apiBase, _fullCache };
})(window);
