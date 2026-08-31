/* MusikBox audio engine — real playback + WebAudio analyser for Sonic Core.
   Sources: local (file:// via convertFileSrc / blob), remote (backend proxy or http).
   Emits events: 'track', 'state', 'time', 'ended', 'error', 'analyser'. */
(function (global) {
  "use strict";

  const doc = (typeof document !== "undefined") ? document : null;
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 0.85;
  // Attach the element to the DOM and force inline playback so Android WebViews /
  // mobile browsers don't gate or auto-stop it, and so it survives re-renders.
  if (doc && doc.body) {
    try {
      audio.id = "aether-audio";
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
      audio.style.display = "none";
      if (!doc.getElementById("aether-audio")) doc.body.appendChild(audio);
    } catch (e) { /* non-DOM audio (headless) — playback still works */ }
  }

  // True cause of "stops after a few seconds": routing a cross-origin media element
  // through a WebAudio graph (analyser) REQUIRES the media to be fetched in CORS mode.
  // Without crossOrigin="anonymous", the spec silently drops the audio data, so the
  // element plays ~1s of buffer then goes silent/errors. We set it only for remote
  // http(s) sources (which here send Access-Control-Allow-Origin: *); local blob/file
  // sources are same-origin/native and must NOT have crossOrigin set.
  audio.setSource = function (src) {
    // Capacitor serves the app AND local media on the same origin (https://localhost).
    // Its own asset paths (/_capacitor_content_/, /_capacitor_file_/) are same-origin
    // — they must NOT get crossOrigin, or the CORS check can taint/block the stream and
    // local songs fail with 'Lecture impossible'. Only genuinely cross-origin http(s)
    // streams (iTunes previews, Archive MP3s, backend proxy) need crossOrigin.
    const s = String(src || "");
    const isCapLocal = /\/_capacitor_(content|file)_\//.test(s);
    const remote = /^https?:\/\//i.test(s) && !isCapLocal;
    if (remote !== audio._crossSet) {
      try {
        if (remote) { audio.crossOrigin = "anonymous"; }
        else { audio.removeAttribute("crossorigin"); }
        audio._crossSet = remote;
      } catch (e) {}
    }
    audio.src = s;
  };

  let audioCtx = null;
  let analyser = null;
  let srcNode = null;
  let freqData = null;
  let raf = null;

  function safePersist(fn) {
    if (typeof fn === "function") { try { fn(); } catch (e) {} }
  }

  /* ---- Real Android media controls: MediaSession + media notification.
     Works in the Capacitor WebView foreground: exposes artwork/title/artist and
     play/pause/prev/next/seek on the system media output & lock screen. All state
     is driven by the REAL engine events (never simulated). ---- */
  const ms = (typeof navigator !== "undefined" && navigator.mediaSession) ? navigator.mediaSession : null;
  let lastArtwork = "";
  function updateMediaSession(t) {
    if (!ms || !t) return;
    try {
      ms.metadata = new MediaMetadata({
        title: t.title || "",
        artist: t.artist || "",
        album: t.album || "",
        artwork: (t.artwork || t.thumb) ? [{
          src: t.artwork || t.thumb, sizes: "512x512", type: "image/jpeg",
        }] : [],
      });
      lastArtwork = t.artwork || t.thumb || "";
    } catch (e) {}
  }
  function updatePlaybackState(playing) {
    if (!ms) return;
    try { ms.playbackState = playing ? "playing" : "paused"; } catch (e) {}
  }

  /* ---- Native media notification + foreground behaviour (Capacitor plugin).
     This shows a REAL Android media notification (artwork/title/artist + prev/play/
     next) and routes its button presses back to the engine. In a browser (no
     Capacitor) it is a harmless no-op; every call is guarded so it can never break
     playback. The persistent background service itself is provided by the native
     plugin (verified at build time); final on-device behaviour is the last gate. */
  const hasCap = (typeof Capacitor !== "undefined");
  const MC = () => { try { return hasCap && Capacitor.Plugins && Capacitor.Plugins.MusicControls ? Capacitor.Plugins.MusicControls : null; } catch (e) { return null; } };
  let mcCreated = false, mcLastElapsed = 0;
  function mcCreate(t) {
    const c = MC(); if (!c) return;
    try {
      c.create({
        track: t.title || "",
        artist: t.artist || "",
        album: t.album || "",
        cover: t.artwork || t.thumb || "",
        duration: Math.round(t.duration || 0),
        elapsed: 0,
        isPlaying: Player.playing,
        hasPrev: true, hasNext: true, hasScrubbing: false,
        ticker: (t.title || "") + " - " + (t.artist || ""),
      }).catch(() => {});
      mcCreated = true;
    } catch (e) {}
  }
  function mcUpdatePlaying(p) {
    const c = MC(); if (!c || !mcCreated) return;
    try { c.updateIsPlaying({ isPlaying: !!p }); } catch (e) {}
  }
  function mcUpdateElapsed(elapsed) {
    const c = MC(); if (!c || !mcCreated) return;
    if (elapsed - mcLastElapsed < 1) return; // throttle to ~1/s
    mcLastElapsed = elapsed;
    try { c.updateElapsed({ elapsed: Math.round(elapsed || 0), isPlaying: Player.playing }); } catch (e) {}
  }
  function mcDestroy() {
    const c = MC(); if (!c || !mcCreated) return;
    try { c.destroy().catch(() => {}); } catch (e) {}
    mcCreated = false;
  }
  function setupMusicControls() {
    const c = MC(); if (!c) return;
    try {
      // Route native notification buttons -> engine (real controls).
      c.addListener("controlsNotification", (info) => {
        const m = info && (info.message || info);
        if (m === "music-controls-next") Player.next();
        else if (m === "music-controls-previous") Player.prev();
        else if (m === "music-controls-play") Player.play();
        else if (m === "music-controls-pause") Player.pause();
        else if (m === "music-controls-toggle-play-pause") Player.toggle();
      }).catch(() => {});
    } catch (e) {}
  }
  function setupMediaSession() {
    if (!ms) return;
    try {
      ms.setActionHandler("play", () => Player.play());
      ms.setActionHandler("pause", () => Player.pause());
      ms.setActionHandler("previoustrack", () => Player.prev());
      ms.setActionHandler("nexttrack", () => Player.next());
      if (ms.setPositionState) {
        try { ms.setPositionState({ duration: 0, playbackRate: 1, position: 0 }); } catch (e) {}
      }
    } catch (e) {}
  }
  // Update position metadata at ~1Hz while playing; adds scrubber/lock-screen time.
  function positionPump() {
    if (!ms || !ms.setPositionState) return;
    const playing = audio.paused === false && audio.duration > 0;
    if (!playing) return;
    try {
      ms.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate || 1,
        position: audio.currentTime || 0,
      });
    } catch (e) {}
  }
  if (typeof setInterval !== "undefined") setInterval(positionPump, 1000);

  const Player = {
    current: null,     // track object
    queue: [],         // array of track objects
    qi: -1,            // index of current in queue
    playing: false,
    _listeners: {},

    on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    emit(ev, ...a) { (this._listeners[ev] || []).forEach(fn => { try { fn(...a); } catch (e) {} }); },

    init() {
      audio.addEventListener("timeupdate", () => {
        this.currentTime = audio.currentTime;
        mcUpdateElapsed(this.currentTime);
        this.emit("time", this.currentTime, this.duration());
      });
      audio.addEventListener("durationchange", () => { this.emit("time", audio.currentTime, this.duration()); });
      audio.addEventListener("progress", () => this.emit("progress"));
      audio.addEventListener("waiting", () => this.emit("loading", true));
      audio.addEventListener("playing", () => { this.emit("loading", false); });
      audio.addEventListener("stalled", () => this.emit("loading", true));
      audio.addEventListener("canplay", () => this.emit("loading", false));
      // Reflect the real engine state — never trust a UI flag.
      audio.addEventListener("play", () => { this.playing = true; this.emit("state", true); });
      audio.addEventListener("pause", () => { if (!audio.ended) { this.playing = false; this.emit("state", false); } });
      audio.addEventListener("error", () => {
        if (audio.src) this.emit("error", audio.error || { message: "audio-error" });
      });
      audio.addEventListener("ended", () => this._onEnded());
      setupMediaSession();
      setupMusicControls();
    },

    _ensureCtx() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          try {
            audioCtx = new AC();
            srcNode = audioCtx.createMediaElementSource(audio);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.75;
            srcNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            freqData = new Uint8Array(analyser.frequencyBinCount);
          } catch (e) {
            // If the graph can't be built (e.g. element already routed), fall back
            // to plain playback (no analyser) rather than silent audio.
            audioCtx = null; analyser = null; freqData = null; srcNode = null;
          }
        }
      }
      return !!analyser;
    },
    _ctx() {
      if (audioCtx && audioCtx.state === "suspended") {
        return audioCtx.resume().catch(() => {});
      }
      return Promise.resolve();
    },

    _pump() {
      const tick = () => {
        if (analyser && !Player.dreamPaused) {
          analyser.getByteFrequencyData(freqData);
          Player.emit("analyser", freqData, analyser.frequencyBinCount);
        }
        raf = requestAnimationFrame(tick);
      };
      if (!raf) tick();
    },

    // -------- track resolution --------
    _srcFor(t) {
      if (t && t.uri) return t.uri;                       // local file uri (file:// / blob / capacitors)
      if (t && t.src) return t.src;                       // remote http url (backend proxy or direct)
      if (t && t.previewUrl) return t.previewUrl;
      return null;
    },

    setTrack(t) {
      const src = this._srcFor(t);
      if (!src) { this.emit("error", { message: "no-src" }); return; }
      this.current = t;
      audio.setSource(src);
      this.playing = false;
      updateMediaSession(t);
      mcCreate(t);
      this.emit("track", t);
      this.emit("state", false);
    },

    play(t) {
      if (t) this.setTrack(t);
      if (!this.current) return;
      this._ensureCtx();
      this._pump();
      // resume the AudioContext inside the user gesture so the analyser graph works
      this._ctx().catch(() => {});
      audio.play().then(() => {
        this.playing = true;
        updatePlaybackState(true);
        mcUpdatePlaying(true);
        this.emit("state", true);
      }).catch((e) => this.emit("error", e));
    },

    pause() {
      try { audio.pause(); } catch (e) {}
      this.playing = false;
      updatePlaybackState(false);
      mcUpdatePlaying(false);
      this.emit("state", false);
    },
    toggle() { if (audio.paused || !this.playing) this.play(); else this.pause(); },
    retry() { if (this.current) this.play(this.current); },

    duration() { return (audio.duration && isFinite(audio.duration)) ? audio.duration : 0; },
    seek(sec) {
      sec = Math.max(0, Math.min(sec, this.duration() || sec));
      if (isFinite(sec)) { try { audio.currentTime = sec; } catch (e) {} }
      positionPump();
      this.emit("time", audio.currentTime, this.duration());
    },
    seekFrac(f) { if (this.duration()) this.seek(f * this.duration()); },
    setVolume(v) { audio.volume = Math.max(0, Math.min(1, Number(v))); this.emit("volume", audio.volume); },
    getVolume() { return audio.volume; },
    mute() { audio.muted = !audio.muted; this.emit("volume", audio.volume); this.emit("muted", audio.muted); },

    // -------- queue --------
    _syncQ() { if (typeof DB !== "undefined") { DB.queue = this.queue.slice(); safePersist(typeof persistQueue !== "undefined" && persistQueue); } },
    setQueue(list) { this.queue = (list || []).slice(); this.qi = -1; this._syncQ(); this.emit("queue"); },
    enqueue(t, playNext) {
      if (t && t.key && this.queue.some(x => x.key === t.key)) return false;
      if (playNext && this.qi >= -1) { this.queue.splice(this.qi + 1, 0, t); this.qi++; }
      else this.queue.push(t);
      this._syncQ(); this.emit("queue");
      return true;
    },
    indexOf() {
      if (!this.current) return -1;
      const k = this.current.key;
      return this.queue.findIndex(x => x.key === k);
    },
    playIndex(i) {
      if (i < 0 || i >= this.queue.length) return false;
      this.qi = i;
      this.current = this.queue[i];
      this._recordHistory();
      this.play(this.queue[i]);
      this.emit("track", this.current);
      return true;
    },
    next() {
      if (!this.queue.length) return false;
      const i = this.indexOf();
      let n = i + 1;
      if (i < 0) n = 0;
      if (n >= this.queue.length) {
        if (DB.settings.repeat === "all") n = 0;
        else { this._recordHistory(); this.stop(); return false; }
      }
      return this.playIndex(n);
    },
    prev() {
      if (!this.queue.length) return false;
      const i = this.indexOf();
      if (audio.currentTime > 3) { this.seek(0); return true; }
      let n = i - 1; if (i < 0) n = 0; if (n < 0) n = this.queue.length - 1;
      return this.playIndex(n);
    },
    remove(i) { if (i >= 0 && this.queue.length) { this.queue.splice(i, 1); this._syncQ(); this.emit("queue"); } },
    clear() { this.queue = []; this.qi = -1; this._syncQ(); this.emit("queue"); },
    reorder(fr, to) {
      if (fr < 0 || fr >= this.queue.length || to < 0 || to >= this.queue.length) return;
      const [it] = this.queue.splice(fr, 1);
      this.queue.splice(to, 0, it); this._syncQ(); this.emit("queue");
    },
    _onEnded() {
      const m = DB.settings.repeat;
      if (m === "one") { this.seek(0); this.play(); }
      else if (!this.next()) this.emit("ended");
    },

    _recordHistory() {
      if (!this.current || typeof DB === "undefined") return;
      DB.history = (DB.history || []).filter(x => x.key !== this.current.key);
      DB.history.unshift(Object.assign({ at: Date.now() }, this.current));
      if (DB.history.length > 120) DB.history.length = 120;
      safePersist(typeof persistHistory !== "undefined" && persistHistory);
      this.emit("history");
    },

    // -------- analysis for Sonic Core / Dream / mood --------
    getBands() {
      if (!freqData || !analyser) return null;
      const n = freqData.length;
      const b = { bass: 0, mid: 0, high: 0, level: 0 };
      let sum = 0;
      for (let i = 0; i < n; i++) { const v = freqData[i]; sum += v; if (i < n * .3) b.bass += v; else if (i < n * .7) b.mid += v; else b.high += v; }
      const max = 255 * n;
      b.bass /= max; b.mid /= max; b.high /= max;
      b.level = Math.min(1, sum / (max));
      // normalize each band to 0..1 relative to its max
      b.bass = Math.min(1, b.bass * 4); b.mid = Math.min(1, b.mid * 4); b.high = Math.min(1, b.high * 4);
      return b;
    },

    stop() { audio.pause(); audio.removeAttribute("src"); try { audio.load(); } catch (e) {} this.playing = false; this.emit("state", false); },
    toggleDream() { DB.settings.dream = !DB.settings.dream; persistSettings(); this.emit("dream", DB.settings.dream); return DB.settings.dream; },
  };

  Player.init();
  global.Player = Player;
})(window);
