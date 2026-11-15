/* AGT Intelligence — "city film": real street geometry with modelled Saturday footfall, animated hour by hour.
 * Data: login-preview.json (scripts/build_login_preview.py). Used by login.html and home.html.
 *
 *   AGTCity.mount(canvas, { onTick: (hourFloat) => {}, dayMs: 40000, startHour: 19, wide: {cx:.6, cy:.34, zoom:1.95},
 *                           narrow: {cx:.5, cy:.4, zoom:1.5}, dataUrl: "login-preview.json" })
 */
(function () {
  const RAMP = [[38, 42, 107], [70, 74, 210], [91, 95, 240], [164, 99, 242], [240, 96, 158], [255, 154, 77], [255, 226, 184]];
  const B = 28;
  const colour = (v) => {
    const x = v * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i;
    const c = RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  const COL = Array.from({ length: B }, (_, b) => colour((b + .5) / B));
  // light theme: quiet slate → deep navy, no bloom
  const LRAMP = [[200, 210, 236], [150, 170, 222], [98, 122, 200], [52, 78, 166], [31, 58, 138], [16, 36, 96]];
  const lcolour = (v) => { const x = v * (LRAMP.length - 1), i = Math.min(LRAMP.length - 2, Math.floor(x)), f = x - i;
    const c = LRAMP[i].map((a, k) => Math.round(a + (LRAMP[i + 1][k] - a) * f)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  const LCOL = Array.from({ length: B }, (_, b) => lcolour((b + .5) / B));
  // mono theme: architectural-model greys (light) or silver on black (dark)
  const rampCol = (R) => (v) => { const x = v * (R.length - 1), i = Math.min(R.length - 2, Math.floor(x)), f = x - i;
    const c = R[i].map((a, k) => Math.round(a + (R[i + 1][k] - a) * f)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  const MCOL_L = Array.from({ length: B }, (_, b) => rampCol([[178, 178, 182], [128, 128, 133], [80, 80, 84], [40, 40, 43], [18, 18, 20]])((b + .5) / B));
  const MCOL_D = Array.from({ length: B }, (_, b) => rampCol([[80, 80, 84], [130, 130, 135], [190, 190, 195], [235, 235, 238], [255, 255, 255]])((b + .5) / B));
  const WIDTH = [.7, 1.1, 1.9];
  const PHASES = [[0, "Night quiet"], [6, "Morning commute"], [10, "Late morning"], [12, "Lunch rush"], [15, "Afternoon lull"],
    [17, "Evening build-up"], [19, "Evening peak"], [22, "Late night"]];
  const phase = (h) => PHASES.filter((p) => h >= p[0]).pop()[1];
  const dec = (s, T) => { const b = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new T(b.buffer); };
  let dataP = null;
  const load = (url) => (dataP = dataP || fetch(url).then((r) => r.json()).then((j) => ({
    n: j.n, radius: j.radius, len: dec(j.len, Uint8Array), xy: dec(j.xy, Int16Array), cls: dec(j.cls, Uint8Array), h24: dec(j.h24, Uint8Array),
  })));
  const path = (c, p) => { c.moveTo(p[0], p[1]); for (let j = 2; j < p.length; j += 2) c.lineTo(p[j], p[j + 1]); };

  function mount(cv, opt = {}) {
    const o = Object.assign({ dayMs: 40000, startHour: 19, dataUrl: "login-preview.json", onTick: null,
      wide: { cx: .6, cy: .34, zoom: 1.95 }, narrow: { cx: .5, cy: .4, zoom: 1.5 }, threshold: .42, theme: "dark" }, opt);
    const mono = o.theme === "mono", light = o.theme === "light" || (mono && !o.dark);
    const PAL = mono ? (o.dark ? MCOL_D : MCOL_L) : light ? LCOL : COL;
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let D = null, W = 0, H = 0, dpr = 1, base = null, segs = null, visible = true, t0 = 0, last = 0, fixed = null;

    function layout() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
      if (!W || !H || !D) return;
      cv.width = W; cv.height = H;
      const nw = r.width < 900 && r.width < r.height * 1.2, f = nw ? o.narrow : o.wide;
      const s = Math.max(W, H) / (D.radius * f.zoom), cx = W * f.cx, cy = H * f.cy;
      segs = [];
      let off = 0;
      for (let i = 0; i < D.n; i++) {
        const k = D.len[i], pts = new Float32Array(k * 2);
        let inside = false;
        for (let j = 0; j < k; j++) {
          const x = cx + D.xy[off + j * 2] * s, y = cy + D.xy[off + j * 2 + 1] * s;
          pts[j * 2] = x; pts[j * 2 + 1] = y;
          if (x > -20 && x < W + 20 && y > -20 && y < H + 20) inside = true;
        }
        off += k * 2;
        if (inside) segs.push({ i, pts, cls: D.cls[i] });
      }
      base = document.createElement("canvas"); base.width = W; base.height = H;
      const b = base.getContext("2d");
      b.lineCap = "round"; b.lineJoin = "round";
      for (const [c, w, a] of [[0, .55, .09], [1, .8, .13], [2, 1.3, .18]]) {
        b.beginPath();
        for (const sg of segs) if (sg.cls === c) path(b, sg.pts);
        b.strokeStyle = mono ? (o.dark ? `rgba(255,255,255,${a * .8})` : `rgba(0,0,0,${a * .85})`) : light ? `rgba(15,23,40,${a * .75})` : `rgba(255,255,255,${a})`; b.lineWidth = w * dpr; b.stroke();
      }
    }

    function draw(hf) {
      if (!segs) return;
      const h0 = Math.floor(hf) % 24, h1 = (h0 + 1) % 24, f = hf - Math.floor(hf), th = o.threshold;
      const bins = Array.from({ length: B * 3 }, () => []), hot = [];
      for (const sg of segs) {
        const v = (D.h24[sg.i * 24 + h0] * (1 - f) + D.h24[sg.i * 24 + h1] * f) / 255;
        if (v < th) continue;
        const t = (v - th) / (1 - th), b = Math.min(B - 1, Math.floor(t * B));
        bins[sg.cls * B + b].push(sg);
        if (t > .62) hot.push(sg);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0);
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (!light && o.bloom !== false) for (let c = 0; c < 3; c++) for (let b = Math.floor(B * .45); b < B; b++) {          // bloom
        const L = bins[c * B + b]; if (!L.length) continue;
        ctx.beginPath(); for (const sg of L) path(ctx, sg.pts);
        ctx.strokeStyle = PAL[b]; ctx.globalAlpha = .1 + .12 * (b / B); ctx.lineWidth = (WIDTH[c] * 5 + 3) * dpr; ctx.stroke();
      }
      for (let c = 0; c < 3; c++) for (let b = 0; b < B; b++) {                              // core lines
        const L = bins[c * B + b]; if (!L.length) continue;
        ctx.beginPath(); for (const sg of L) path(ctx, sg.pts);
        if (mono && !o.dark && b > B * .45) { ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 5 * dpr; ctx.shadowOffsetY = 2 * dpr; }
        ctx.strokeStyle = PAL[b]; ctx.globalAlpha = light || mono ? .55 + .45 * (b / B) : .35 + .65 * (b / B); ctx.lineWidth = WIDTH[c] * (1 + b / B) * (mono ? 1.15 : 1) * dpr; ctx.stroke();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }
      if (hot.length && !reduce) {                                                          // people moving on the busiest streets
        ctx.setLineDash([2.5 * dpr, 16 * dpr]);
        ctx.lineDashOffset = -(performance.now() / 1000) * 14 * dpr;
        ctx.beginPath(); for (const sg of hot) path(ctx, sg.pts);
        ctx.strokeStyle = mono ? (o.dark ? "#000000" : "#ffffff") : light ? "#ffffff" : "#fff6e8"; ctx.globalAlpha = light || mono ? .9 : .55; ctx.lineWidth = (light ? 1.1 : 1.4) * dpr; ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    const hourNow = (now) => (fixed != null ? fixed : (o.startHour + ((now - t0) % o.dayMs) / o.dayMs * 24) % 24);
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden || now - last < 33) return;
      last = now;
      const hf = hourNow(now);
      draw(hf); if (o.onTick) o.onTick(hf);
    }

    // pause when scrolled out of view
    if ("IntersectionObserver" in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv);

    load(o.dataUrl).then((d) => {
      D = d; layout();
      if (reduce) { fixed = 19; draw(19); if (o.onTick) o.onTick(19); return; }
      t0 = performance.now();
      requestAnimationFrame(frame);
    }).catch((e) => console.warn("city film unavailable", e));

    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); draw(hourNow(performance.now())); }, 120); });

    return {
      /** Pin the film to an hour (number) or release it to play (null). */
      setHour(h) { fixed = h; if (D && h != null) { draw(h); if (o.onTick) o.onTick(h); } },
    };
  }

  const clock = (hf) => {
    const h = Math.floor(hf) % 24, m = Math.floor((hf % 1) * 6) * 10;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  };
  window.AGTCity = { mount, phase, clock };
})();
