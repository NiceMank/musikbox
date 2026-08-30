/* MusikBox — Aether app logic. Router + views + player wiring + onboarding. */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- icons ----
  const I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V5l12-2v15"/><path d="M16 5l4-1v15"/><path d="M4 20h16"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 21h16"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9.5 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l10.5-7z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.7-9.6-9.3C.8 8.4 2.8 4.5 6.6 4.1c2-.2 3.9.8 5.4 2.6 1.5-1.8 3.4-2.8 5.4-2.6 3.8.4 5.8 4.3 4.2 7.6C19.5 16.3 12 21 12 21z"/></svg>',
    queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h10M4 17h13"/></svg>',
    vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.8A8 8 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 100 18c1.5 0 2-.9 2-2v-1c0-1.1.9-2 2-2h1.5c1.9 0 3.5-1.6 3.5-3.5C21 8 17 3 12 3z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V6l12-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9m0 0l-4.5 4.5M12 9l4.5 4.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 21h16"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
    drag: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>',
    lang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h8M8 3v2M12 5c0 4-2 8-6 10"/><path d="M6 9a12 12 0 0012 8"/></svg>',
    playRepeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2l3 3-3 3"/><path d="M3 9V6a2 2 0 012-2h15"/><path d="M7 22l-3-3 3-3"/><path d="M21 15v3a2 2 0 01-2 2H4"/></svg>',
  };

  const fmt = (sec) => { sec = Math.floor(sec || 0); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  const safeFilename = (title) => String(title || "sound").replace(/[^\w\u00C0-\u017F .-]+/g, "_").slice(0, 80) + ".mp3";
  const fmtSize = (b) => { if (!b) return "0"; const u = ["B","KB","MB","GB"]; let i=0; while(b>=1024&&i<3){b/=1024;i++;} return b.toFixed(1)+" "+u[i]; };
  function toast(msg, err) {
    const el = document.createElement("div"); el.className = "toast" + (err ? " err" : "");
    el.textContent = msg; $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  function isFav(key) { return DB.favorites.some(t => t.key === key); }
  function isDl(key) { return DB.downloaded.some(t => t.key === key); }

  // ---- global wiring (player) ----
  function whenTrack(t) {
    const mini = $("#mini");
    if (!t) { return; }
    mini.classList.remove("hidden");
    $("#mini-title").textContent = t.title;
    $("#mini-sub").textContent = (t.artist || "") + (t.duration ? " · " + fmt(t.duration) : "");
    const cover = $("#mini-cover"), ico = $("#mini-ico");
    const art = t.thumb || t.artwork;
    if (art) { cover.src = art; cover.style.display = ""; ico.style.display = "none"; }
    else { ico.style.display = ""; cover.style.display = "none"; }
    renderPlayerFace();
    renderDyn();
  }
  function renderPlayerFace() { const p = $("#mini-play"); if (p) p.innerHTML = Player.playing ? I.pause : I.play; }
  function renderDyn() { // re-render just the player-dependent bits
    if (route === "home") renderHome();
  }
  Player.on("track", whenTrack);
  Player.on("state", (p) => { renderPlayerFace(); renderDyn(); });
  Player.on("time", () => {
    const d = Player.duration();
    const fill = $("#mini-prog"); if (fill) fill.style.width = (d ? (Player.currentTime / d) * 100 : 0) + "%";
  });
  let playError = null;
  Player.on("error", (e) => {
    playError = e; toast(I18N.t("playback_failed"), true);
    renderDyn();
  });
  Player.on("state", (p) => { if (p) playError = null; });
  Player.on("queue", () => persistQueue());
  // persistent queue restore happens after loadAll() in init()

  // ---- bottom nav ----
  const NAV = [
    { id: "home", ico: I.home },
    { id: "search", ico: I.search },
    { id: "library", ico: I.library },
    { id: "downloads", ico: I.dl },
    { id: "more", ico: I.more },
  ];
  function renderDock() {
    const d = $("#dock"); d.innerHTML = "";
    NAV.forEach(n => {
      const b = document.createElement("button"); b.className = "nav" + (route === n.id ? " on" : "");
      b.innerHTML = n.ico + "<span>" + esc(I18N.t("nav_" + n.id)) + "</span>";
      b.onclick = () => go(n.id);
      d.appendChild(b);
    });
  }

  // ---- router ----
  let route = "home";
  function go(r) { route = r; render(); }
  function render() {
    renderDock();
    const v = $("#view");
    v.innerHTML = "";
    if (route === "home") renderHome();
    else if (route === "search") renderSearch();
    else if (route === "library") renderLibrary();
    else if (route === "downloads") renderDownloads();
    else if (route === "more") renderMore();
    v.scrollTop = 0;
  }

  // ---- track row builder ----
  function trackRow(t, list, opts) {
    opts = opts || {};
    const row = document.createElement("div");
    row.className = "track" + (Player.current && Player.current.key === t.key ? " on" : "");
    const playing = Player.current && Player.current.key === t.key && Player.playing;
    row.innerHTML =
      '<div class="t-cover">' + (t.thumb || t.artwork ? '<img alt="">' : I.note) + '</div>' +
      '<div class="t-meta"><div class="t-title"></div><div class="t-sub"><span class="t-artist"></span><span class="t-dur"></span></div></div>' +
      '<div class="t-act"><span class="t-eq" style="' + (playing ? "" : "display:none") + '"><i></i><i></i><i></i></span>' +
      '<button class="gbtn sm" data-act="fav">' + I.heart + '</button>' +
      '<button class="gbtn sm" data-act="menu">' + I.more + '</button></div>';
    const cover = row.querySelector("img");
    if (cover) { cover.src = t.thumb || t.artwork; cover.onerror = () => { cover.style.display = "none"; }; }
    row.querySelector(".t-title").textContent = t.title;
    const srcTxt = t.source === "local" ? " · " + I18N.t("local")
      : t.full ? " · ∞ " + I18N.t("full")
      : t.web ? " · ◌ " + I18N.t("discover") : "";
    row.querySelector(".t-artist").textContent = (t.artist || I18N.t("unknown")) + srcTxt;
    row.querySelector(".t-dur").textContent = t.duration ? " " + fmt(t.duration) : "";
    row.querySelector(".t-artist").style.color = t.full ? "var(--emerald)" : (t.web ? "var(--text-2)" : "");
    row.querySelector(".t-cover").style.color = isFav(t.key) ? "#ffb8c4" : "";
    row.querySelector(".t-cover").style.opacity = t.web && !t.full ? ".75" : "1";
    row.onclick = async () => {
      // Directory items (web) have no direct stream — resolve to a real playable
      // full-length track first (never fake / never silent).
      let playable = t;
      if (t.web && !t.src) {
        toast(I18N.t("search_loading"));
        playable = await API.resolvePlayable(t, API) || t;
      }
      if (!playable.src) {
        // Honest: the directory lists the title but no free full-length source exists.
        toast(I18N.t("no_full_free"), true);
        return;
      }
      const nl = list || [playable];
      Player.setQueue(nl);
      const i = nl.findIndex(x => x.key === playable.key);
      if (i >= 0) Player.playIndex(i);
    };
    row.querySelector('[data-act="fav"]').onclick = (e) => {
      e.stopPropagation(); toggleFav(t);
    };
    row.querySelector('[data-act="menu"]').onclick = (e) => { e.stopPropagation(); openTrackMenu(t, list); };
    return row;
  }
  function toggleFav(t) {
    const i = DB.favorites.findIndex(x => x.key === t.key);
    if (i >= 0) DB.favorites.splice(i, 1);
    else DB.favorites.unshift(Object.assign({}, t));
    persistFavorites();
    toast(i >= 0 ? I18N.t("fav_removed") : I18N.t("fav_added"));
    renderDyn(); render();
  }

  // ---- HOME / SONIC CORE ----
  let homeTrend = null, homeHist = [], homeChips = ["afro", "amapiano", "gospel", "chill", "dance", "top hits"];
  async function renderHome() {
    const v = $("#view");
    const cur = Player.current, m = DB.settings.mood;
    v.innerHTML =
      '<div class="mx-top"><h1 class="mx-title">' + esc(I18N.t("app_name")) + ' <b>Aether</b></h1>' +
      '<span class="mx-chip">' + esc(I18N.t("home_tag")) + '</span></div>' +
      '<div class="np">' + renderNowPlaying() + '</div>' +
      '<div class="section-h">' + esc(I18N.t("home_quick")) + '</div>' +
      '<div class="mx-chips">' + homeChips.map(c => '<button class="mx-chipbtn" data-q="' + esc(c) + '">' + esc(c) + '</button>').join("") + '</div>' +
      '<div class="section-h">' + esc(I18N.t("home_history")) + '</div><div id="home-hist"></div>' +
      '<div class="section-h">' + esc(I18N.t("home_trending")) + '</div><div id="home-trend"></div>';

    v.querySelectorAll(".mx-chipbtn").forEach(b => b.onclick = () => { route = "search"; window._preQ = b.dataset.q; render(); });

    if (cur) {
      v.querySelector(".np").appendChild(buildNowPlayingExtra());
    }

    historyList = DB.history.map(h => h.key);
    const hh = $("#home-hist");
    (DB.history.slice(0, 6)).forEach(t => hh.appendChild(trackRow(t, DB.history)));
    if (!DB.history.length) hh.innerHTML = '<div class="st-block st-sub">' + esc(I18N.t("lib_no_hist")) + '</div>';

    // trending (online, real)
    const th = $("#home-trend");
    th.innerHTML = homeTrend ? null : '<div class="st-block st-sub">' + esc(I18N.t("search_loading")) + '</div>';
    if (!homeTrend) {
      API.topOnline(12).then(items => { homeTrend = items; const el = $("#home-trend"); if (!el) return; el.innerHTML = ""; (homeTrend || []).forEach(t => el.appendChild(trackRow(t, homeTrend))); })
        .catch(() => { const el = $("#home-trend"); if (el) el.innerHTML = '<div class="st-block"><div class="st-sub">' + esc(I18N.t("search_error_sub")) + '</div></div>'; });
    } else {
      homeTrend.forEach(t => th.appendChild(trackRow(t, homeTrend)));
    }

    bindNowPlayingControls();
    if ($("#np-core")) VIZ.core.start("np-core");
  }
  let historyList = [];
  function renderNowPlaying() {
    const t = Player.current;
    const mood = VIZ.moodColor();
    if (!t) {
      return '<div class="np-art"><canvas id="np-core" class="sonic-core"></canvas>' +
        '<div class="art-img"><div class="noimg">' + I.note + '</div></div></div>' +
        '<div class="np-meta"><div class="np-tag">' + esc(I18N.t("np_now")) + '</div>' +
        '<p class="np-title" style="font-weight:300;color:var(--text-2)">' + esc(I18N.t("home_nothing")) + '</p></div>';
    }
    return '<div class="np-art"><canvas id="np-core" class="sonic-core"></canvas>' +
      '<div class="art-img">' + (t.thumb || t.artwork ? '<img id="np-img" alt="">' : '<div class="noimg">' + I.note + '</div>') + '</div></div>' +
      '<div class="np-meta"><div class="np-tag">' + esc(I18N.t("np_now")) + '</div>' +
      '<h1 class="np-title" id="np-title">' + esc(t.title) + '</h1>' +
      '<div class="np-artist" id="np-artist">' + esc(t.artist || "") + '</div></div>' +
      '<div class="np-tl"><span class="tt" id="np-cur">0:00</span>' +
      '<div id="np-seek"><div class="rail"><i id="np-fill"></i></div><div class="knob" id="np-knob"></div></div>' +
      '<span class="tt r" id="np-tot">0:00</span></div>' +
      '<div class="np-ctls"><button class="gbtn side" id="np-prev">' + I.prev + '</button>' +
      '<button class="bigplay" id="np-play">' + (Player.playing ? I.pause : I.play) + '</button>' +
      '<button class="gbtn side" id="np-next">' + I.next + '</button></div>' +
      '<div class="np-row">' +
        '<button class="gbtn" id="np-fav">' + I.heart + '</button>' +
        '<button class="gbtn" id="np-queue">' + I.queue + '</button>' +
        '<button class="gbtn" id="np-dl">' + I.down + '</button>' +
        '<button class="gbtn" id="np-dream">' + I.moon + '</button>' +
      '</div>' +
      '<div class="vol-wrap" style="justify-content:center;margin-top:16px">' + I.vol +
      '<input type="range" class="vol" id="np-volume" min="0" max="100" value="' + Math.round(Player.getVolume() * 100) + '"></div>' +
      (playError ? '<div class="st-block" style="padding:14px"><div class="st-sub">' +
        esc(I18N.t("search_error_title")) + '</div><button class="btn solid st-btn" id="np-retry">' +
        esc(I18N.t("search_retry")) + '</button></div>' : '');
  }
  function buildNowPlayingExtra() {
    const d = document.createElement("div");
    return d;
  }
  function bindNowPlayingControls() {
    if (!Player.current) return;
    const el = $("#np-play"); if (!el) return;
    $("#np-play").onclick = () => Player.toggle();
    if ($("#np-prev")) $("#np-prev").onclick = () => Player.prev();
    if ($("#np-next")) $("#np-next").onclick = () => Player.next();
    if ($("#np-fav")) $("#np-fav").onclick = () => toggleFav(Player.current);
    if ($("#np-queue")) $("#np-queue").onclick = () => openQueue();
    if ($("#np-dl")) $("#np-dl").onclick = () => startDownload(Player.current);
    if ($("#np-dream")) $("#np-dream").onclick = () => toggleDream();
    if ($("#np-volume")) $("#np-volume").oninput = (e) => Player.setVolume(e.target.value / 100);
    if ($("#np-retry")) $("#np-retry").onclick = () => Player.retry();
    const seek = $("#np-seek");
    if (seek) seek.onclick = (e) => { const r = seek.getBoundingClientRect(); Player.seekFrac((e.clientX - r.left) / r.width); };
    // periodic time update for NP — only ticks while the Home/Now-Playing view is visible
    if (!bindNowPlayingControls._t) {
      bindNowPlayingControls._t = setInterval(() => {
        if (route !== "home") return;
        const cur = Player.currentTime, d = Player.duration();
        const c = $("#np-cur"), to = $("#np-tot"), f = $("#np-fill"), k = $("#np-knob");
        if (c) c.textContent = fmt(cur);
        if (to) to.textContent = fmt(d);
        if (f && d) { const p = cur / d * 100; f.style.width = p + "%"; if (k) k.style.left = "calc(" + p + "% - 7px)"; }
      }, 500);
    }
  }

  // ---- SEARCH ----
  let searchSource = "all", searchQ = "";
  function renderSearch() {
    const v = $("#view");
    v.innerHTML =
      '<div class="mx-top"><h1 class="mx-title">' + esc(I18N.t("search_title")) + '</h1></div>' +
      '<div class="mx-search" id="sbar"><span>' + I.search + '</span>' +
      '<input id="sinput" type="search" placeholder="' + esc(I18N.t("search_placeholder")) + '" autocomplete="off" value="' + esc(searchQ) + '">' +
      '<button class="gbtn sm hidden" id="sclear">✕</button></div>' +
      '<div class="mx-seg mgr">' +
      '<button data-s="all" class="' + (searchSource === "all" ? "on" : "") + '">' + esc(I18N.t("search_source_all")) + '</button>' +
      '<button data-s="local" class="' + (searchSource === "local" ? "on" : "") + '">' + esc(I18N.t("search_source_local")) + '</button>' +
      '<button data-s="online" class="' + (searchSource === "online" ? "on" : "") + '">' + esc(I18N.t("search_source_online")) + '</button>' +
      '</div><div id="sresults"></div>';

    v.querySelectorAll(".mx-seg button").forEach(b => b.onclick = () => { searchSource = b.dataset.s; render(); });
    const input = $("#sinput");
    input.oninput = () => { searchQ = input.value; clearTimeout(window._sd); window._sd = setTimeout(doSearch, 350); };
    input.onkeydown = (e) => { if (e.key === "Enter") { clearTimeout(window._sd); doSearch(); } };
    $("#sclear").onclick = () => { searchQ = ""; input.value = ""; $$("#sresults").forEach(x => x.innerHTML = ""); };
    if (window._preQ) { searchQ = window._preQ; input.value = window._preQ; window._preQ = null; render(); doSearch(); }
    else if (searchQ) doSearch();
    else renderEmptySearch();
  }
  function renderEmptySearch() {
    const r = $("#sresults");
    r.innerHTML = '<div class="st-block st-title">' + esc(I18N.t("search_empty_title")) + '</div>' +
      '<div class="st-block st-sub">' + esc(I18N.t("search_empty_sub")) + '</div>';
  }
  let _searchSeq = 0;
  async function doSearch() {
    const r = $("#sresults"); if (!r) return;
    const q = searchQ.trim(); const seq = ++_searchSeq;
    if (!q) { renderEmptySearch(); return; }
    r.innerHTML = '<div class="st-block st-sub">' + esc(I18N.t("search_loading")) + '</div>';
    let online = [], local = [], full = [], web = [];
    local = API.searchLocal(q);
    if (searchSource !== "local") {
      // 1) Working online directory (houseofcosmetics) — real titles/artists/artwork.
      try { web = await API.searchWeb(q, 14); } catch (e) {}
      // 2) Full-length streamable tracks (Internet Archive).
      try { full = await API.searchArchive(q, 10); } catch (e) {}
      // 3) iTunes previews (30s) as a last fallback for niche titles.
      let previews = [];
      try { previews = await API.searchOnline(q, 8); } catch (e) {}
      // Merge: Archive full tracks first (playable), then unique titles from the
      // directory (real metadata; play resolves to a playable source), then previews.
      online = API.combine(API.combine(full, web), previews);
      // web duplicates by title: prefer the playable Archive version
      const seenTitle = new Set();
      online = online.filter(t => {
        const key = (t.full ? t.title : t.web ? t.title : t.title).toLowerCase();
        if (t.full && seenTitle.has(key)) return false;
        seenTitle.add(key);
        return true;
      });
    }
    if (seq !== _searchSeq) return;
    let items;
    if (searchSource === "online") items = online;
    else if (searchSource === "local") items = local;
    else items = API.combine(online, local);
    if (!items.length) {
      r.innerHTML = '<div class="st-block"><div class="st-orb">' + I.search + '</div><div class="st-title">' + esc(I18N.t("search_noresult_title")) + '</div>' +
        '<div class="st-sub">' + esc(I18N.t("search_noresult_sub")) + '</div></div>';
      return;
    }
    r.innerHTML = "";
    items.forEach(t => r.appendChild(trackRow(t, items)));
  }

  // ---- LIBRARY ----
  let libTab = "songs";
  function renderLibrary() {
    const v = $("#view");
    const tabs = ["songs", "albums", "artists", "genres", "favs", "history"];
    v.innerHTML =
      '<div class="mx-top"><h1 class="mx-title">' + esc(I18N.t("library_title")) + '</h1></div>' +
      '<div class="lib-grid">' +
      '<div class="lib-tile membrane"><div class="n">' + Object.keys(DB.localIndex).length + '</div><div class="l">' + esc(I18N.t("lib_songs")) + '</div></div>' +
      '<div class="lib-tile membrane"><div class="n">' + DB.favorites.length + '</div><div class="l">' + esc(I18N.t("lib_favs")) + '</div></div>' +
      '<div class="lib-tile membrane"><div class="n">' + DB.history.length + '</div><div class="l">' + esc(I18N.t("lib_history")) + '</div></div>' +
      '<div class="lib-tile membrane" id="scan-tile"><div class="n">' + I.up + '</div><div class="l">' + esc(I18N.t("lib_scan")) + '</div></div>' +
      '</div>' +
      '<div class="mx-seg">' + tabs.map(t => '<button data-t="' + t + '" class="' + (libTab === t ? "on" : "") + '">' + esc(I18N.t("lib_" + t)) + '</button>').join("") + '</div>' +
      '<div id="libr"></div><div class="section-h" style="margin-top:18px">' + esc(I18N.t("playlists")) + '</div><div id="libpl"></div>';

    v.querySelectorAll(".mx-seg button").forEach(b => b.onclick = () => { libTab = b.dataset.t; render(); });
    $("#scan-tile").onclick = async () => { await scanLocal(); render(); };
    renderLibraryBody();
    renderPlaylistList($("#libpl"));
  }
  function renderLibraryBody() {
    const r = $("#libr"); r.innerHTML = "";
    const localSongs = Object.values(DB.localIndex);
    if (libTab === "songs") {
      if (!localSongs.length) { r.innerHTML = emptyLib(); return; }
      localSongs.forEach(t => r.appendChild(trackRow(t, localSongs)));
    } else if (libTab === "favs") {
      if (!DB.favorites.length) { r.innerHTML = '<div class="st-block st-sub">' + esc(I18N.t("lib_no_fav")) + '</div>'; return; }
      DB.favorites.forEach(t => r.appendChild(trackRow(t, DB.favorites)));
    } else if (libTab === "history") {
      if (!DB.history.length) { r.innerHTML = '<div class="st-block st-sub">' + esc(I18N.t("lib_no_hist")) + '</div>'; return; }
      DB.history.forEach(t => r.appendChild(trackRow(t, DB.history)));
    } else if (libTab === "albums" || libTab === "artists" || libTab === "genres") {
      renderGroups(r, libTab);
    }
  }
  function emptyLib() {
    return '<div class="st-block"><div class="st-title">' + esc(I18N.t("lib_no_music_title")) + '</div><div class="st-sub">' + esc(I18N.t("lib_no_music_sub")) + '</div></div>';
  }
  function renderGroups(r, kind) {
    const map = {};
    Object.values(DB.localIndex).forEach(t => {
      const k = (t[kind] || I18N.t("unknown")).trim().toLowerCase();
      (map[k] = map[k] || []).push(t);
    });
    const keys = Object.keys(map);
    if (!keys.length) { r.innerHTML = emptyLib(); return; }
    keys.sort().forEach(k => {
      const g = document.createElement("div"); g.className = "membrane pad"; g.style.marginBottom = "10px";
      g.innerHTML = '<div class="section-h" style="margin:0 0 8px">' + esc(map[k][0][kind] || I18N.t("unknown")) + ' <span style="color:var(--muted)">(' + map[k].length + ')</span></div>';
      g.onclick = () => { const list = map[k]; Player.setQueue(list); Player.playIndex(0); };
      r.appendChild(g);
    });
  }
  function renderPlaylistList(container) {
    container.innerHTML = "";
    if (!container) return;
    if (!DB.playlists.length) { container.innerHTML = '<div class="st-block st-sub">' + esc(I18N.t("lib_no_fav")) + '</div>'; return; }
    DB.playlists.forEach(pl => {
      const t = document.createElement("div"); t.className = "pl-tile membrane"; t.style.cursor = "pointer";
      t.innerHTML = '<div class="ico">' + I.queue + '</div><div class="t-meta"><div class="t-title">' + esc(pl.name) + '</div><div class="t-sub">' + pl.tracks.length + ' ' + esc(I18N.t("songs_count")) + '</div></div><button class="gbtn sm" data-del> ' + I.trash + '</button>';
      t.onclick = () => {
        const items = pl.tracks.map(k => (DB.localIndex[k] || DB.favorites.find(x => x.key === k))).filter(Boolean);
        if (items.length) { Player.setQueue(items); Player.playIndex(0); }
      };
      const del = t.querySelector("[data-del]");
      del.onclick = (e) => { e.stopPropagation(); deletePlaylist(pl.id); };
      container.appendChild(t);
    });
  }

  // ---- DOWNLOADS ----
  function renderDownloads() {
    const v = $("#view");
    const local = DB.downloaded;
    v.innerHTML =
      '<div class="mx-top"><h1 class="mx-title">' + esc(I18N.t("downloads_title")) + '</h1></div>' +
      '<div class="section-h">' + esc(I18N.t("download_offline")) + '</div>' +
      '<div id="dl-list"></div>';
    const dl = $("#dl-list");
    if (!local.length) dl.innerHTML = '<div class="st-block"><div class="st-orb">' + I.dl + '</div><div class="st-title">' + esc(I18N.t("download_title")) + '</div><div class="st-sub">' + esc(I18N.t("download_none")) + '</div></div>';
    else local.forEach(t => dl.appendChild(trackRow(t, local)));
  }

  // ---- MORE ----
  function renderMore() {
    const v = $("#view");
    // Build with DOM nodes (menuRow returns an element — never stringify it!).
    const shell = document.createElement("div");
    shell.className = "membrane";
    shell.appendChild(menuRow("more_queue", I.queue, openQueue));
    shell.appendChild(menuRow("more_mood", I.palette, openMood));
    shell.appendChild(menuRow("more_dream", I.moon, toggleDream));
    shell.appendChild(menuRow("more_settings", I.gear, openSettings));
    shell.appendChild(menuRow("more_onboarding", I.playRepeat, () => { openOnboarding(true); }));
    v.innerHTML = '<div class="mx-top"><h1 class="mx-title">' + esc(I18N.t("more_title")) + '</h1></div>';
    v.appendChild(shell);
  }
  function menuRow(label, ico, onClick) {
    const d = document.createElement("div"); d.className = "set-row"; d.style.cursor = "pointer";
    d.innerHTML = '<div style="display:flex;align-items:center;gap:12px">' + ico + '<span class="set-label">' + esc(I18N.t(label)) + '</span></div><span style="color:var(--muted)">›</span>';
    d.onclick = onClick;
    return d;
  }

  // ---- settings ----
  function openSettings() {
    openSheet(
      '<div class="section-h" style="margin:0 0 8px">' + esc(I18N.t("settings_title")) + '</div>' +
      '<div class="set-row"><div><div class="set-label">' + esc(I18N.t("set_language")) + '</div><div class="set-sub">' + (I18N.lang.toUpperCase()) + '</div></div><div class="mx-seg" style="margin:0;padding:3px;width:140px">' +
      '<button data-lang="fr" class="' + (I18N.lang === "fr" ? "on" : "") + '">FR</button><button data-lang="en" class="' + (I18N.lang === "en" ? "on" : "") + '">EN</button></div></div>' +
      '<div class="set-row" id="set-scan"><div><div class="set-label">' + esc(I18N.t("set_local")) + '</div><div class="set-sub">' + Object.keys(DB.localIndex).length + ' ' + esc(I18N.t("songs_count")) + '</div></div><button class="btn" >' + esc(I18N.t("set_scan")) + '</button></div>' +
      '<div class="set-row" id="set-replay"><div><div class="set-label">' + esc(I18N.t("set_replay_intro")) + '</div></div><span style="color:var(--muted)">›</span></div>' +
      '<div class="set-row" id="set-about"><div><div class="set-label">' + esc(I18N.t("set_about")) + '</div><div class="set-sub">' + esc(I18N.t("set_about_body")) + '</div></div></div>'
    );
    $$("#sheet [data-lang]").forEach(b => b.onclick = () => { setLanguage(b.dataset.lang); });
    const scanB = $("#sheet #set-scan button"); if (scanB) scanB.onclick = async () => { await scanLocal(); toast(I18N.t("lib_scanning")); closeSheet(); };
    const replay = $("#sheet #set-replay"); if (replay) replay.onclick = () => { closeSheet(); openOnboarding(true); };
    const about = $("#sheet #set-about"); if (about) about.onclick = () => { toast(I18N.t("set_about_body")); };
  }
  function setLanguage(lang) { I18N.set(lang); DB.settings.lang = lang; persistSettings(); document.documentElement.lang = lang; render(); }

  // ---- queue sheet ----
  function openQueue() {
    const list = Player.queue;
    const items = list.map((t, i) =>
      '<div class="q-row' + (Player.current && Player.current.key === t.key ? " on" : "") + '" data-i="' + i + '">' +
      '<button class="gbtn sm" data-drag style="cursor:grab">' + I.drag + '</button>' +
      '<div class="t-meta" style="flex:1"><div class="t-title">' + esc(t.title) + '</div><div class="t-sub">' + esc(t.artist || "") + '</div></div>' +
      '<button class="gbtn sm" data-remove>' + I.trash + '</button></div>').join("");
    openSheet(
      '<div class="section-h" style="margin:0 0 8px">' + esc(I18N.t("queue_title")) + ' (' + list.length + ')</div>' +
      (list.length && '<button class="btn" id="q-clear" style="margin-bottom:10px">' + I.trash + ' ' + esc(I18N.t("queue_clear")) + '</button>') +
      (items || '<div class="st-block st-sub">' + esc(I18N.t("queue_empty")) + '</div>')
    );
    $$(".q-row").forEach(r => {
      const i = +r.dataset.i;
      r.onclick = () => { Player.playIndex(i); closeSheet(); };
      r.querySelector("[data-remove]").onclick = (e) => { e.stopPropagation(); Player.remove(i); openQueue(); };
      r.querySelector("[data-drag]").onclick = (e) => e.stopPropagation();
    });
    const cl = $("#q-clear"); if (cl) cl.onclick = () => { Player.clear(); closeSheet(); toast(I18N.t("queue_clear")); };
  }

  // ---- track menu (multi-action) ----
  function openTrackMenu(t, list) {
    openSheet(
      '<div class="section-h" style="margin:0 0 4px">' + esc(t.title) + '</div>' +
      '<div class="set-sub" style="margin-bottom:10px">' + esc(t.artist || "") + '</div>' +
      '<button class="btn solid" id="tm-play" style="width:100%">' + I.play + ' ' + esc(I18N.t("np_now")) + '</button>' +
      '<div class="set-row" id="tm-next"><div class="set-label">' + esc(I18N.t("play_next")) + '</div><span style="color:var(--muted)">›</span></div>' +
      '<div class="set-row" id="tm-q"><div class="set-label">' + esc(I18N.t("add_queue")) + '</div></div>' +
      '<div class="set-row" id="tm-fav"><div class="set-label">' + esc(I18N.t("favs_title")) + '</div>' + (isFav(t.key) ? '<span style="color:#ffb8c4">♥</span>' : "") + '</div>' +
      '<div class="set-row" id="tm-pl"><div class="set-label">' + esc(I18N.t("add_playlist")) + '</div><span style="color:var(--muted)">›</span></div>' +
      '<div class="set-row" id="tm-dl"><div class="set-label">' + esc(I18N.t("download_it")) + '</div>' + (isDl(t.key) ? '<span style="color:var(--emerald)">✓</span>' : "") + '</div>'
    );
    const play = e => { e.stopPropagation(); Player.setQueue(list || [t]); Player.playIndex(0); closeSheet(); };
    $("#tm-play").onclick = play;
    $("#tm-next").onclick = (e) => { e.stopPropagation(); Player.enqueue(t, true); persistQueue(); toast(I18N.t("play_next")); closeSheet(); };
    $("#tm-q").onclick = (e) => { e.stopPropagation(); Player.enqueue(t, false); persistQueue(); toast(I18N.t("np_queue_added")); closeSheet(); };
    $("#tm-fav").onclick = (e) => { e.stopPropagation(); toggleFav(t); closeSheet(); };
    $("#tm-pl").onclick = (e) => { e.stopPropagation(); closeSheet(); openPlaylistPicker(t); };
    $("#tm-dl").onclick = (e) => { e.stopPropagation(); startDownload(t); closeSheet(); };
  }

  function openPlaylistPicker(t) {
    openSheet(
      '<div class="section-h" style="margin:0 0 8px">' + esc(I18N.t("add_playlist")) + '</div>' +
      '<button class="btn solid" id="pl-new" style="width:100%;margin-bottom:10px">' + I.plus + ' ' + esc(I18N.t("created")) + '</button>' +
      DB.playlists.map(pl => '<div class="set-row" data-pl="' + pl.id + '"><div class="set-label">' + esc(pl.name) + '</div><span style="color:var(--muted)">›</span></div>').join("")
    );
    $("#pl-new").onclick = () => { createPlaylist(t); };
    $$("#sheet [data-pl]").forEach(r => r.onclick = () => { addToPlaylist(r.dataset.pl, t); });
  }

  // ---- playlists ----
  function createPlaylist(t) {
    closeSheet();
    const id = "pl-" + Date.now();
    DB.playlists.push({ id, name: (t ? t.title : I18N.t("playlists")).slice(0, 24), tracks: t ? [t.key] : [] });
    persistPlaylists(); toast(I18N.t("created"));
    render();
  }
  function addToPlaylist(id, t) {
    const pl = DB.playlists.find(x => x.id === id);
    if (pl && !pl.tracks.includes(t.key)) { pl.tracks.push(t.key); persistPlaylists(); toast(I18N.t("added_playlist")); }
    closeSheet();
  }
  function deletePlaylist(id) { DB.playlists = DB.playlists.filter(x => x.id !== id); persistPlaylists(); toast(I18N.t("deleted")); render(); }

  // ---- downloads ----
  let dlJobs = {}; // key -> {status, progress}
  function capFS() {
    try { if (typeof Capacitor !== "undefined" && Capacitor.Plugins && Capacitor.Plugins.Filesystem) return Capacitor.Plugins.Filesystem; }
    catch (e) {}
    return null;
  }
  async function persistFile(blob, name) {
    // Real durable download onto device storage via Capacitor Filesystem.
    const FS = capFS();
    if (!FS || typeof blob.arrayBuffer !== "function") return null;
    try {
      const data = await blob.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      const base = await FS.getDirectory({ path: "MusikBox", directory: "DOCUMENTS", create: true }).catch(() => ({}));
      const dir = "MusikBox/";
      await FS.writeFile({ path: dir + name, data: b64, directory: "DOCUMENTS", recursive: true });
      const uri = await FS.getUri({ path: dir + name, directory: "DOCUMENTS" }).then(r => r.uri).catch(() => "");
      return uri || ("file://" + dir + name);
    } catch (e) { return null; }
  }
  async function startDownload(t) {
    if (isDl(t.key)) { toast(I18N.t("download_exists")); return; }
    if (t.source === "local") { DB.downloaded.unshift(Object.assign({}, t)); persistDownloaded(); toast(I18N.t("download_offline")); render(); return; }
    // Real download of a playable audio URL (works when t.src/previewUrl is a real http file)
    const url = t.src || t.previewUrl;
    if (!url) { toast(I18N.t("download_failed"), true); return; }
    if (!window.isOnline) { toast(I18N.t("search_error_title"), true); return; }
    dlJobs[t.key] = { status: "downloading", progress: 0 };
    toast(I18N.t("download_added"));
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const total = +resp.headers.get("content-length") || 0;
      const reader = resp.body.getReader(); const chunks = []; let done = 0;
      while (true) {
        const { value, done: dv } = await reader.read();
        if (dv) break;
        chunks.push(value); done += value.length;
        if (total && dlJobs[t.key]) dlJobs[t.key].progress = Math.min(99, Math.round(done / total * 100));
      }
      const blob = new Blob(chunks, { type: t.mime || "audio/mpeg" });
      // Prefer durable on-device storage (survives app restart); fall back to blob URL.
      const safe = safeFilename(t.title);
      const fileUri = await persistFile(blob, safe);
      const uri = fileUri || URL.createObjectURL(blob);
      const rec = Object.assign({}, t, { uri, downloadedUri: uri, size: blob.size, saved: true,
        persist: !!fileUri });
      DB.downloaded.unshift(rec); persistDownloaded();
      dlJobs[t.key] = { status: "done", progress: 100 };
      toast(I18N.t("download_offline"));
      // register in local index so library exposes it as a local track
      DB.localIndex[rec.key] = rec; persistLocal();
      render();
    } catch (e) {
      dlJobs[t.key] = { status: "error", error: String(e) };
      toast(I18N.t("download_failed"), true);
    }
  }

  // ---- dream mode ----
  function toggleDream() {
    const on = Player.toggleDream();
    if (on) { $("#dream").classList.remove("hidden"); VIZ.dream.start(); VIZ.core.stop(); bindDream(); }
    else { $("#dream").classList.add("hidden"); VIZ.dream.stop(); if (route === "home") VIZ.core.start("np-core"); }
    toast(on ? I18N.t("more_dream") : I18N.t("dream_exit"));
  }
  function bindDream() {
    $("#dream-prev").innerHTML = I.prev; $("#dream-next").innerHTML = I.next;
    $("#dream-play").innerHTML = Player.playing ? I.pause : I.play;
    $("#dream-exit").textContent = I18N.t("dream_exit");
    $("#dream-prev").onclick = () => Player.prev();
    $("#dream-next").onclick = () => Player.next();
    $("#dream-play").onclick = () => Player.toggle();
    $("#dream-exit").onclick = () => toggleDream();
  }
  Player.on("state", (p) => { const b = $("#dream-play"); if (b) b.innerHTML = p ? I.pause : I.play; });
  Player.on("track", (t) => { const a = $("#dream-title"), s = $("#dream-sub"); if (a) a.textContent = t.title; if (s) s.textContent = t.artist || ""; });

  // ---- mood ----
  function openMood() {
    const moods = [
      ["emotion", "emotion", "mood_emotion"],
      ["electronic", "elec", "mood_electronic"],
      ["ambient", "ambient", "mood_ambient"],
      ["intense", "intense", "mood_intense"],
    ];
    openSheet(
      '<div class="section-h" style="margin:0 0 4px">' + esc(I18N.t("mood_title")) + '</div>' +
      '<div class="set-sub" style="margin-bottom:12px">' + esc(I18N.t("mood_sub")) + '</div>' +
      '<div class="mood-grid">' + moods.map(m =>
        '<div class="mood-card' + (DB.settings.mood === m[0] ? " on" : "") + '" data-m="' + m[0] + '" style="--mc:' +
        ({emotion:"#e79a1c",electronic:"#4fd6ff",ambient:"#4fe0a6",intense:"#ff5470"})[m[0]] + '">' +
        '<div class="sw"></div><div class="nm">' + esc(I18N.t(m[2])) + '</div></div>').join("") + '</div>'
    );
    $$("#sheet .mood-card").forEach(c => c.onclick = () => {
      DB.settings.mood = c.dataset.m; persistSettings(); closeSheet(); renderDyn();
    });
  }

  // ---- sheet ----
  function openSheet(html) {
    $("#sheet").innerHTML = html; $("#sheet").classList.remove("hidden"); $("#sheet-backdrop").classList.remove("hidden");
  }
  function closeSheet() { $("#sheet").classList.add("hidden"); $("#sheet-backdrop").classList.add("hidden"); }
  $("#sheet-backdrop").onclick = closeSheet;

  // ---- local scan ----
  let scanning = false;
  async function scanLocal() {
    if (scanning) return; scanning = true;
    toast(I18N.t("lib_scanning"));
    try {
      const res = await Scan.run((n) => toast(I18N.t("lib_scanning") + " — " + n));
      if (res.unsupported) { toast(I18N.t("lib_no_music_title"), true); return; }
      if (res.denied) { toast(I18N.t("lib_permission_title"), true); return; }
      const map = {};
      res.items.forEach(t => { map[t.key] = t; });
      DB.localIndex = map; persistLocal();
      toast(res.items.length + " " + I18N.t("songs_count"));
    } finally { scanning = false; }
  }

  // ---- onboarding ----
  const OB_STEPS = {
    lang: { t: () => I18N.t("ob_lang"), s: () => I18N.t("ob_lang_sub") },
    1: { t: () => I18N.t("ob_1_t"), s: () => I18N.t("ob_1_s") },
    2: { t: () => I18N.t("ob_2_t"), s: () => I18N.t("ob_2_s") },
    3: { t: () => I18N.t("ob_3_t"), s: () => I18N.t("ob_3_s") },
    4: { t: () => I18N.t("ob_4_t"), s: () => I18N.t("ob_4_s") },
    5: { t: () => I18N.t("ob_5_t"), s: () => I18N.t("ob_5_s") },
  };
  let obStep = 0;
  function openOnboarding(force) {
    const ob = $("#ob"); ob.classList.remove("hidden");
    obStep = 0; renderOb();
    if (!force) { /* first run */ }
  }
  function renderOb() {
    const ob = $("#ob");
    if (obStep === 0) {
      const fr = document.createElement("div");
      fr.innerHTML =
        '<div class="ob-art" style="border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(255,186,32,.7), rgba(155,123,255,.2) 60%, transparent);border:1px solid rgba(255,186,32,.3);box-shadow:var(--shadow-amber)"></div>' +
        '<div class="ob-dot">AETHER · SONIC CORE</div>' +
        '<h1 class="ob-title">' + esc(I18N.t("ob_lang")) + '</h1>' +
        '<div class="ob-sub">' + esc(I18N.t("ob_lang_sub")) + '</div>' +
        '<div class="ob-dots"><i class="on"></i></div>' +
        '<div class="ob-foot"><button class="btn solid" style="flex:1" data-fr>Français</button><button class="btn solid" style="flex:1" data-en>English</button></div>';
      ob.innerHTML = fr.innerHTML;
      ob.querySelector("[data-fr]").onclick = () => { setLanguage("fr"); obStep = 1; renderOb(); };
      ob.querySelector("[data-en]").onclick = () => { setLanguage("en"); obStep = 1; renderOb(); };
      return;
    }
    if (obStep === 6) {
      ob.innerHTML =
        '<div class="ob-art" style="border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(255,186,32,.9), rgba(255,186,32,.2) 65%, transparent);border:1px solid rgba(255,186,32,.4);box-shadow:var(--shadow-amber)"></div>' +
        '<div class="ob-dot">AETHER</div>' +
        '<h1 class="ob-title">' + esc(I18N.t("ob_done_t")) + '</h1>' +
        '<div class="ob-sub">' + esc(I18N.t("ob_done_s")) + '</div>' +
        '<div class="ob-dots">' + [1,2,3,4,5,6].map((_, i) => '<i class="' + (i === 5 ? "on" : "") + '"></i>').join("") + '</div>' +
        '<div class="ob-foot"><button class="btn solid" style="flex:1" id="ob-start">' + esc(I18N.t("ob_start")) + '</button></div>';
      ob.querySelector("#ob-start").onclick = finishOb;
      return;
    }
    const step = OB_STEPS[obStep];
    ob.innerHTML =
      '<div class="ob-art" style="border-radius:50%;background:radial-gradient(circle at 35% 30%, rgba(255,186,32,' + (obStep === 3 ? '.85' : '.45') + '), rgba(155,123,255,.18) 60%, transparent);border:1px solid rgba(255,186,32,.3);box-shadow:var(--shadow-amber);display:grid;place-items:center;color:var(--amber-soft)">' + (obStep === 3 ? I.moon : I.note) + '</div>' +
      '<div class="ob-dot">AETHER</div>' +
      '<h1 class="ob-title">' + esc(step.t()) + '</h1>' +
      '<div class="ob-sub">' + esc(step.s()) + '</div>' +
      '<div class="ob-dots">' + [1,2,3,4,5,6].map((_, i) => '<i class="' + (i === obStep - 1 ? "on" : "") + '"></i>').join("") + '</div>' +
      '<div class="ob-foot"><button class="skip" id="ob-skip">' + esc(I18N.t("ob_skip")) + '</button><button class="btn solid" style="flex:1" id="ob-next">' + esc(I18N.t("ob_next")) + '</button></div>';
    ob.querySelector("#ob-next").onclick = () => { obStep++; renderOb(); };
    ob.querySelector("#ob-skip").onclick = finishOb;
  }
  function finishOb() {
    DB.settings.onboardingDone = true; persistSettings();
    $("#ob").classList.add("hidden");
  }

  // ---- init ----
  async function init() {
    loadAll();
    await Store.hydrate();
    loadAll();
    document.documentElement.lang = I18N.lang;
    // restore persisted queue
    if (DB.queue && DB.queue.length) Player.setQueue(DB.queue);
    VIZ.cons.start();
    // mini player controls — tap body to open Now Playing; playback never resets.
    $("#mini-play").onclick = (e) => { e.stopPropagation(); Player.toggle(); };
    $("#mini-close").onclick = (e) => { e.stopPropagation(); $("#mini").classList.add("hidden"); Player.pause(); };
    $("#mini").addEventListener("click", () => go("home"));
    // loading state on the mini play button
    Player.on("loading", (on) => { if (on) { const p = $("#mini-prog"); if (p) p.style.opacity = ".6"; } else { const p = $("#mini-prog"); if (p) p.style.opacity = "1"; } });
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.setActionHandler("play", () => Player.play());
        navigator.mediaSession.setActionHandler("pause", () => Player.pause());
      }
    } catch (e) {}
    if (!DB.settings.onboardingDone) openOnboarding(false);
    else { /* ensure lang applied */ }
    render();
    // keep dock above mini
    const dock = $("#dock");
    if (dock) dock.style.marginBottom = "0";
  }
  window.addEventListener("hashchange", () => {});
  document.addEventListener("visibilitychange", () => { if (document.hidden) { } else { renderPlayerFace(); } });

  init();
  window.__appDebug = { Player, DB, go, scanLocal, toggleDream };
})();
