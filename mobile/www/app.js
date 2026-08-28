"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("musikbox." + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem("musikbox." + k, JSON.stringify(v)); },
};
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast ok";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
function fmt(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  sec = Math.floor(sec);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
let favorites = LS.get("favs", []);
let library = LS.get("library", []);
let queue = [];
let current = null;
const audio = new Audio();
audio.preload = "metadata";
async function searchItunes(q) {
  const url = "https://itunes.apple.com/search?" + new URLSearchParams({
    term: q, media: "music", entity: "song", limit: "24", country: "fr",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Recherche indisponible");
  const data = await res.json();
  return (data.results || []).filter((r) => r.previewUrl).map((r) => ({
    key: "it-" + r.trackId,
    title: r.trackName,
    artist: r.artistName,
    thumb: (r.artworkUrl100 || "").replace("100x100", "300x300"),
    previewUrl: r.previewUrl,
    duration: Math.round((r.trackTimeMillis || 30000) / 1000),
  }));
}
function renderNav() {
  const lc = $("#lib-count"); const fc = $("#fav-count");
  if (lc) lc.textContent = library.length;
  if (fc) fc.textContent = favorites.length;
}
function playTrack(t, list) {
  current = t;
  if (list && list.length) queue = list;
  audio.src = t.previewUrl;
  audio.play().catch(() => toast("Lecture impossible"));
  const player = $("#player");
  if (player) player.hidden = false;
  $("#player-title").textContent = t.title;
  $("#player-sub").textContent = t.artist || "";
  $("#player-cover").src = t.thumb || "";
  $("#btn-play").textContent = "⏸";
  renderNav();
}
function trackRow(t, list) {
  const div = document.createElement("div");
  div.className = "row";
  div.innerHTML = '<img class="row-thumb" alt=""><div class="row-meta"><div class="row-title"></div><div class="row-sub"></div></div><button class="wood btn-wood sm row-play">▶</button><button class="icon-btn row-fav">♥</button><button class="icon-btn row-save">↓</button>';
  const img = div.querySelector(".row-thumb");
  img.src = t.thumb || "";
  img.onerror = () => { img.style.opacity = "0.3"; };
  div.querySelector(".row-title").textContent = t.title;
  div.querySelector(".row-sub").textContent = t.artist || "";
  div.querySelector(".row-play").onclick = () => playTrack(t, list);
  div.querySelector(".row-fav").onclick = () => {
    const i = favorites.findIndex((f) => f.key === t.key);
    if (i >= 0) favorites.splice(i, 1); else favorites.push(t);
    LS.set("favs", favorites); renderNav();
    toast(i >= 0 ? "Retiré des favoris" : "Ajouté aux favoris");
  };
  div.querySelector(".row-save").onclick = () => {
    if (!library.some((x) => x.key === t.key)) { library.unshift(t); LS.set("library", library); renderNav(); }
    toast("Enregistré dans la bibliothèque");
  };
  return div;
}
function renderHome(view) {
  view.innerHTML = '<h1 class="h1">MusikBox</h1><p class="muted">Recherchez un titre — extraits iTunes (30 s).</p><div class="chips"></div>';
  const chips = view.querySelector(".chips");
  ["Amapiano", "Afrobeats", "Gospel", "Hip-Hop", "Jazz", "Daft Punk"].forEach((g) => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = g;
    b.onclick = () => { location.hash = "#/recherche?q=" + encodeURIComponent(g); };
    chips.appendChild(b);
  });
}
async function renderSearch(view, q) {
  view.innerHTML = '<h1 class="h1">Recherche</h1><p class="muted"></p><div id="results"></div>';
  view.querySelector(".muted").textContent = q ? "Résultats pour « " + q + " »" : "Entrez un titre";
  if (!q) return;
  try {
    const items = await searchItunes(q);
    const box = $("#results", view);
    if (!items.length) box.innerHTML = "<p class='muted'>Aucun résultat</p>";
    items.forEach((t) => box.appendChild(trackRow(t, items)));
  } catch (e) {
    $("#results", view).innerHTML = "<p class='muted'>" + e.message + "</p>";
  }
}
function renderList(view, title, items) {
  view.innerHTML = '<h1 class="h1"></h1><div id="results"></div>';
  view.querySelector(".h1").textContent = title;
  const box = $("#results", view);
  if (!items.length) box.innerHTML = "<p class='muted'>Liste vide</p>";
  items.forEach((t) => box.appendChild(trackRow(t, items)));
}
function render() {
  const h = location.hash.replace(/^#\/?/, "") || "home";
  const [path, qs] = h.split("?");
  const params = new URLSearchParams(qs || "");
  const view = $("#view");
  $$(".side-nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === (path || "home")));
  view.innerHTML = "";
  if (path === "home" || !path) renderHome(view);
  else if (path === "recherche") renderSearch(view, params.get("q") || "");
  else if (path === "bibliotheque") renderList(view, "Bibliothèque", library);
  else if (path === "favoris") renderList(view, "Favoris", favorites);
  else if (path === "playlists") view.innerHTML = "<h1 class='h1'>Playlists</h1><p class='muted'>Ajoutez des favoris pour commencer.</p>";
  else if (path === "telechargements") view.innerHTML = "<h1 class='h1'>Téléchargements</h1><p class='muted'>Utilisez ↓ pour la bibliothèque locale.</p>";
  else location.hash = "#/";
  renderNav();
}
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#search-input").value.trim();
  if (q) location.hash = "#/recherche?q=" + encodeURIComponent(q);
});
$("#btn-play").onclick = () => {
  if (!current) return;
  if (audio.paused) { audio.play(); $("#btn-play").textContent = "⏸"; }
  else { audio.pause(); $("#btn-play").textContent = "▶"; }
};
$("#btn-next").onclick = () => {
  if (!queue.length || !current) return;
  const i = queue.findIndex((t) => t.key === current.key);
  const n = queue[(i + 1) % queue.length];
  if (n) playTrack(n, queue);
};
$("#btn-prev").onclick = () => {
  if (!queue.length || !current) return;
  const i = queue.findIndex((t) => t.key === current.key);
  const n = queue[(i - 1 + queue.length) % queue.length];
  if (n) playTrack(n, queue);
};
const vol = $("#volume");
if (vol) vol.oninput = (e) => { audio.volume = Number(e.target.value) / 100; };
audio.ontimeupdate = () => {
  const tc = $("#t-current"); const tt = $("#t-total"); const fill = $("#seek-fill");
  if (tc) tc.textContent = fmt(audio.currentTime);
  if (tt) tt.textContent = fmt(audio.duration || 0);
  if (fill) fill.style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + "%";
};
audio.onended = () => { const b = $("#btn-next"); if (b) b.click(); };
const seek = $("#seek-bar");
if (seek) seek.onclick = (e) => {
  if (!audio.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
};
const burger = $("#burger");
if (burger) burger.onclick = () => $("#sidebar").classList.toggle("open");
window.addEventListener("hashchange", render);
render();
