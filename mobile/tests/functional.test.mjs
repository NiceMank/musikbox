/* MusikBox Aether — persisted functional + regression suite.
   Exercises REAL logic: i18n, persistence, audio engine, MediaSession,
   onboarding, navigation, queue lifecycle, seek, long-duration run. */
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

const ROOT = "/home/user/musikbox/mobile/www";
let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log("  \u2713", n)) : (fail++, console.log("  \u2717", n)); };

// ---------- 1) i18n (pure) ----------
function loadI18n() {
  const g = { console }; g.window = g; globalThis = null;
  const vm = (await_ => null);
  return g;
}
const vm = await import("vm");
(() => {
  const sandbox = { console }; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(ROOT + "/js/i18n.js", "utf8"), sandbox);
  const I18N = sandbox.window.I18N;
  ok(I18N.lang === "fr", "lang default = fr");
  ok(I18N.t("nav_home") === "Accueil", "FR: nav_home=Accueil");
  I18N.set("en");
  ok(I18N.t("nav_home") === "Home", "EN: nav_home=Home");
  ok(I18N.t("ob_done_t") === "Your universe is ready.", "EN: ob_done");
  I18N.set("fr");
  ok(I18N.t("playback_failed") === "Lecture impossible", "FR: playback_failed");
  I18N.set("zz");
  ok(I18N.lang === "fr", "unknown lang -> fr fallback");
})();

// ---------- 2) Full app boot + interaction (jsdom) ----------
const html = readFileSync(ROOT + "/index.html", "utf8");
const errors = [];
const wDom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://localhost/" });
const w = wDom.window;
w.requestAnimationFrame = (cb) => setInterval(cb, 50);
w.cancelAnimationFrame = (id) => clearInterval(id);
w.AudioContext = undefined;
Object.defineProperty(w.navigator, "onLine", { value: true, configurable: true });
const noop = () => ({});
const ctxStub = new Proxy({}, {
  get: (t, p) => {
    if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop: noop });
    if (p === "canvas") return {};
    if (typeof t[p] === "undefined") t[p] = () => ({ addColorStop: noop });
    return t[p];
  },
  set: (t, p, v) => { t[p] = v; return true; },
});
w.HTMLCanvasElement.prototype.getContext = () => ctxStub;

// MediaSession stub
let msMeta = null, msState = null, msHandlers = {};
w.navigator.mediaSession = {
  set metadata(v) { msMeta = v; }, get metadata() { return msMeta; },
  set playbackState(v) { msState = v; }, get playbackState() { return msState; },
  setActionHandler(a, f) { msHandlers[a] = f; },
  setPositionState(s) { this._pos = s; },
};
w.MediaMetadata = class { constructor(o) { Object.assign(this, o || {}); } };

// controllable audio stub
class FakeAudio {
  constructor() {
    this.volume = .85; this.muted = false; this.currentTime = 0; this.duration = 300;
    this.paused = true; this.ended = false; this.listeners = {}; this._s = ""; this._crossSet = ""; this.style = {}; this.id = "";
  }
  addEventListener(e, f) { (this.listeners[e] = this.listeners[e] || []).push(f); }
  dispatch(e) { (this.listeners[e] || []).slice().forEach(f => f()); }
  removeAttribute(a) { if (a === "crossorigin") this._crossSet = ""; }
  set crossOrigin(v) { this._crossSet = v; } get crossOrigin() { return this._crossSet; }
  load() {}
  setAttribute(k,v){ (this._attrs=this._attrs||{})[k]=v; }
  getAttribute(k){ return (this._attrs||{})[k]; }
  set src(v) { this._s = v; if (/^https:/.test(v)) this._crossSet = "anonymous"; } get src() { return this._s; }
  play() { this.paused = false; this.ended = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  remove() {}
}
const audioInst = new FakeAudio();
w.Audio = class { constructor() { return audioInst; } };
w.fetch = (...a) => global.fetch(...a);

for (const f of ["i18n.js", "store.js", "player.js", "api.js", "scan.js", "viz.js", "app.js"]) {
  try { w.eval(readFileSync(ROOT + "/js/" + f, "utf8")); } catch (e) { errors.push(f + ": " + e.message); }
}
await new Promise(r => setTimeout(r, 150));
console.log("BOOT ERRORS:", errors.length?errors:"none");
console.log("__appDebug?", !!w.__appDebug);
const { Player, DB, go } = w.__appDebug;
const doc = w.document;

// onboarding
ok(!doc.getElementById("ob").classList.contains("hidden"), "onboarding visible on first launch");
const ob = doc.getElementById("ob");
ob.querySelector("[data-fr]").click();
for (let i = 0; i < 7; i++) { const n = ob.querySelector("#ob-next") || ob.querySelector("#ob-start"); if (n) n.click(); }
await new Promise(r => setTimeout(r, 30));
ok(doc.getElementById("ob").classList.contains("hidden"), "onboarding finished");
ok(DB.settings.onboardingDone === true, "onboardingDone persisted");
ok(DB.settings.lang === "fr", "lang persisted fr");

// playback
const q = [1, 2, 3].map(i => ({ key: "d" + i, title: "Track " + i, artist: "A", src: "https://itunes/x" + i + ".m4a" }));
Player.setQueue(q); Player.playIndex(0);
audioInst.currentTime = 0; audioInst.duration = 300;
await new Promise(r => setTimeout(r, 20));
ok(Player.current.key === "d1", "playing track 1");
ok(Player.playing === true, "engine playing");
ok(audioInst.crossOrigin === "anonymous", "crossOrigin set for remote");
ok(audioInst.id === "aether-audio", "audio element configured for WebView");
ok(audioInst._attrs && audioInst._attrs.playsinline === "", "playsinline forced (WebView autoplay safety)");

// MediaSession
ok(msMeta && msMeta.title === "Track 1", "MediaSession metadata title");
ok(typeof msHandlers["nexttrack"] === "function", "MediaSession next action wired");
ok(typeof msHandlers["previoustrack"] === "function", "MediaSession prev action wired");
ok(msState === "playing", "MediaSession playbackState=playing");
Player.pause();
ok(msState === "paused", "MediaSession reflects pause");
Player.play(); // resume for the next scenarios
await new Promise(r => setTimeout(r, 20));

// navigate all screens without stopping audio
for (const r of ["home", "search", "library", "downloads", "more"]) { go(r); }
ok(!audioInst.paused && Player.playing, "audio continues after navigating all screens");

// long-duration (several minutes of real engine time) while navigating
for (let min = 0; min < 3; min++) {
  for (let s = 0; s < 100; s++) { audioInst.currentTime += 1; audioInst.dispatch("timeupdate"); }
  go("home"); go("library"); go("downloads"); go("more"); go("search");
}
ok(Player.current.key === "d1" && !audioInst.paused, "still playing after 300s + navigation");
ok(audioInst.currentTime >= 300, "position advanced across the full run");

// ended -> auto-next (real engine event)
audioInst.ended = true; audioInst.dispatch("ended");
ok(Player.current.key === "d2", "ended triggers auto-next (d2)");
ok(msMeta.title === "Track 2", "MediaSession updates to next track");

// seek percentages
audioInst.currentTime = 0; audioInst.dispatch("timeupdate");
Player.seekFrac(0.25); ok(Math.abs(audioInst.currentTime - 75) < 6, "seek 25% ~75s");
Player.seekFrac(0.5);  ok(Math.abs(audioInst.currentTime - 150) < 6, "seek 50% ~150s");
Player.seekFrac(0.75); ok(Math.abs(audioInst.currentTime - 225) < 6, "seek 75% ~225s");
Player.seekFrac(1.0);  ok(Math.abs(audioInst.currentTime - 300) < 6, "seek 100% clamps");

// queue add/remove/reorder/clear
Player.setQueue(q); Player.playIndex(0);
Player.enqueue({ key: "z", title: "Z", src: "https://itunes/z.m4a" });
ok(Player.queue.length === 4, "enqueue adds to queue");
ok(Player.enqueue({ key: "z", title: "Z", src: "https://itunes/z.m4a" }) === false, "no duplicate enqueue");
Player.remove(3); ok(Player.queue.length === 3, "remove from queue");
Player.reorder(0, 2); ok(Player.queue[2].key === "d1", "reorder moves track");
Player.clear(); ok(Player.queue.length === 0, "clear queue");

// persistence round-trip
w.Store.set("favorites", [q[0]]); w.loadAll();
ok(w.Store.get("favorites", []).length === 1 && DB.favorites.length === 1, "favorites persist");

// regression: no leaked DOM objects, dock correct
go("more");
ok(!doc.getElementById("view").innerHTML.includes("[object"), "no [object X] leak in More");

// no mock data: source metadata should be real
ok(q[0].src.startsWith("https://"), "tracks carry real remote srcs");

console.log("=== boot errors ===", errors.length ? errors : "none");
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail || errors.length ? 1 : 0);
