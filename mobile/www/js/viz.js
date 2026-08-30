/* MusikBox visualizations — AETHER: Sonic Core, constellation, Dream Mode.
   Audio-reactive via Player.getBands(); Mood maps to a color palette. */
(function (global) {
  "use strict";

  const MOODS = {
    emotion:    { a: "#ffba20", b: "#ff8a3c", name: "amber-gold" },
    electronic: { a: "#4fd6ff", b: "#9b7bff", name: "cyan-violet" },
    ambient:    { a: "#4fe0a6", b: "#3aa8c9", name: "emerald" },
    intense:    { a: "#ff5470", b: "#ff2e4d", name: "crimson" },
  };
  function moodColor() { return MOODS[(DB.settings && DB.settings.mood) || "emotion"]; }

  // ---------------- Sonic Core ----------------
  const core = {
    canvas: null, ctx: null, raf: null, last: 0,
    start(id) {
      const c = document.getElementById(id); if (!c) return;
      // Cancel any prior loop so re-renders never stack render loops.
      this.stop();
      this.canvas = c; const dpr = Math.min(2, window.devicePixelRatio || 1);
      const s = c.clientWidth || 300;
      c.width = s * dpr; c.height = s * dpr;
      this.ctx = c.getContext("2d"); this.dpr = dpr; this.size = s;
      if (!this.ctx) return; // canvas context unavailable (headless/unsupported) — no crash
      this.loop();
    },
    loop() {
      if (!this.canvas) return;
      const ctx = this.ctx; const s = this.canvas.width; const cx = s / 2, cy = s / 2;
      ctx.clearRect(0, 0, s, s);
      const b = (Player.playing || !Player.current) ? Player.getBands() : null;
      const mood = moodColor();
      const t = performance.now() / 1000;
      // When paused we calm the animation naturally instead of stopping or staying static.
      const energy = b ? (0.4 * b.bass + 0.3 * b.mid + 0.3 * b.level)
                       : (Player.playing ? 0.18 : 0.08 + 0.03 * Math.sin(t * 1.2));
      const pulse = 1 + energy * 0.22;

      // outer glow rings
      const layers = 3;
      for (let i = 0; i < layers; i++) {
        const r = (s / 2) * pulse * (1 - i * 0.05);
        const alpha = 0.10 + b ? 0.25 * energy * (1 - i * .2) : 0.12;
        const grad = ctx.createRadialGradient(cx, cy, r * .6, cx, cy, r);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, hexA(mood.a, alpha));
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
      // rotating plasma arcs
      const spokes = 8;
      for (let i = 0; i < spokes; i++) {
        const ang = (i / spokes) * Math.PI * 2 + t * 0.2;
        const rr = (s / 2) * pulse;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, ang, ang + 0.9);
        ctx.strokeStyle = hexA(i % 2 ? mood.b : mood.a, 0.5 + energy * 0.3);
        ctx.lineWidth = 2 + energy * 4;
        ctx.stroke();
      }
      // central droplet
      const coreR = (s / 2) * 0.42 * pulse;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      g.addColorStop(0, hexA(mood.b, 0.9));
      g.addColorStop(0.5, hexA(mood.a, 0.5));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

      this.raf = requestAnimationFrame(() => this.loop());
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.canvas = null; },
  };

  // ---------------- Constellation background ----------------
  const cons = {
    ctx: null, raf: null, parts: [],
    start() {
      this.stop();
      const c = document.getElementById("viz"); if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      this.ctx = c.getContext("2d"); this.w = innerWidth * dpr; this.h = innerHeight * dpr;
      if (!this.ctx) return;
      this.parts = Array.from({ length: 44 }, () => ({
        x: Math.random() * this.w, y: Math.random() * this.h,
        vx: (Math.random() - .5) * .2 * dpr, vy: (Math.random() - .5) * .2 * dpr,
        r: (Math.random() * 1.6 + .6) * dpr,
      }));
      this.loop();
    },
    loop() {
      const ctx = this.ctx; if (!ctx) return;
      ctx.clearRect(0, 0, this.w, this.h);
      const b = Player.getBands(); const mood = moodColor();
      const link = 90 * this.dpr;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = this.w; if (p.x > this.w) p.x = 0;
        if (p.y < 0) p.y = this.h; if (p.y > this.h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexA(mood.a, .5 + (b ? b.level : .15)); ctx.fill();
        for (let j = i + 1; j < this.parts.length; j++) {
          const q = this.parts[j]; const dx = p.x - q.x, dy = p.y - q.y; const d = Math.hypot(dx, dy);
          if (d < link) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = hexA(mood.a, .12 * (1 - d / link)); ctx.lineWidth = this.dpr * 0.5; ctx.stroke();
          }
        }
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
  };

  // ---------------- Dream Mode ----------------
  const dream = {
    raf: null, ctx: null, els: [],
    render(mood, bands) {
      return (el) => {
      };
    },
    start() {
      this.stop();
      let c = document.getElementById("dream-canvas");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      this.ctx = c.getContext("2d"); this.w = innerWidth * dpr; this.h = innerHeight * dpr;
      if (!this.ctx) return;
      this.els = Array.from({ length: 26 }, () => ({
        x: Math.random() * this.w, y: Math.random() * this.h,
        r: (Math.random() * 60 + 12) * dpr, vx: (Math.random() - .5) * .6 * dpr, vy: (Math.random() - .5) * .6 * dpr,
        hue: Math.random(),
      }));
      this.loop();
    },
    loop() {
      const ctx = this.ctx; if (!ctx) return;
      const mood = moodColor(); const b = (Player.playing || !Player.current) ? Player.getBands() : null;
      const ctx2 = this.ctx;
      ctx2.globalCompositeOperation = "source-over";
      ctx2.fillStyle = "rgba(0,0,0,0.14)"; ctx2.fillRect(0, 0, this.w, this.h);
      ctx2.globalCompositeOperation = "lighter";
      const t = performance.now() / 1000;
      const drift = b ? (0.5 * b.mid + 0.3 * b.level) : 0.2;
      for (const e of this.els) {
        e.x += e.vx + Math.cos(t + e.hue * 10) * drift * this.dpr;
        e.y += e.vy + Math.sin(t + e.hue * 10) * drift * this.dpr;
        if (e.x < -60) e.x = this.w + 60; if (e.x > this.w + 60) e.x = -60;
        if (e.y < -60) e.y = this.h + 60; if (e.y > this.h + 60) e.y = -60;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
        g.addColorStop(0, hexA(e.hue < .5 ? mood.a : mood.b, 0.35));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      }
      this.raf = requestAnimationFrame(() => this.loop());
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
  };

  function hexA(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  window.MOODS = MOODS;
  global.VIZ = { core, cons, dream, moodColor };
})(window);
