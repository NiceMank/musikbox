/* MusikBox audio engine — real playback + WebAudio analyser for Sonic Core.
   Sources: local (file:// via convertFileSrc / blob), remote (backend proxy or http).
   Emits events: 'track', 'state', 'time', 'ended', 'error', 'analyser'. */
(function (global) {
  "use strict";

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 0.85;

  let audioCtx = null;
  let analyser = null;
  let srcNode = null;
  let freqData = null;
  let raf = null;

  function safePersist(fn) {
    if (typeof fn === "function") { try { fn(); } catch (e) {} }
  }

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
        this.emit("time", this.currentTime, this.duration());
      });
      audio.addEventListener("progress", () => this.emit("progress"));
      audio.addEventListener("error", () => {
        if (audio.src) this.emit("error", audio.error);
      });
      audio.addEventListener("ended", () => this._onEnded());
    },

    _ensureCtx() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          audioCtx = new AC();
          srcNode = audioCtx.createMediaElementSource(audio);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          srcNode.connect(analyser);
          analyser.connect(audioCtx.destination);
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
      }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return !!analyser;
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
      audio.src = src;
      this.playing = false;
      this.emit("track", t);
      this.emit("state", false);
    },

    play(t) {
      if (t) this.setTrack(t);
      if (!this.current) return;
      this._ensureCtx();
      this._pump();
      audio.play().then(() => {
        this.playing = true;
        this.emit("state", true);
      }).catch((e) => this.emit("error", e));
    },

    pause() { audio.pause(); this.playing = false; this.emit("state", false); },
    toggle() { if (audio.paused || !this.playing) this.play(); else this.pause(); },

    duration() { return (audio.duration && isFinite(audio.duration)) ? audio.duration : 0; },
    seek(sec) {
      sec = Math.max(0, Math.min(sec, this.duration() || sec));
      if (isFinite(sec)) { try { audio.currentTime = sec; } catch (e) {} }
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
