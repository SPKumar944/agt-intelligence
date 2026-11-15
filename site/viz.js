/* AGT Intelligence website — interactive illustrations. Each module runs only if its element is on the page.
 * Figures come from small, internally consistent models and are labelled "Illustrative". */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const dark = () => document.documentElement.dataset.theme === "dark";
  const pct = (v) => Math.round(v * 100) + "%";
  const inr = (cr) => (cr >= 1 ? "₹" + cr.toFixed(2) + " Cr" : "₹" + Math.round(cr * 100) + " L");
  const fmt = (n) => n.toLocaleString("en-IN");
  const onVisible = (el, fn, th = .3) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { fn(); o.disconnect(); } }, { threshold: th }).observe(el);
  const onResize = (fn) => { let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fn, 150); }); };
  const setRange = (el) => el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%");

  // ---------------------------------------------------------------- drawing helpers
  function fitCanvas(cv, aw, an) {
    const w = Math.round(cv.parentElement.clientWidth), narrow = w < 560, h = Math.round(w * (narrow ? an : aw));
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.height = h + "px"; cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, narrow };
  }
  function hexCells(w, h, s) {
    const out = [], dx = Math.sqrt(3) * s, dy = 1.5 * s;
    for (let r = -1; r * dy < h + s; r++) for (let c = -1; c * dx < w + dx; c++) out.push({ x: c * dx + (r & 1 ? dx / 2 : 0), y: r * dy });
    return out;
  }
  function hex(ctx, x, y, s) {
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6; i ? ctx.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)) : ctx.moveTo(x + s * Math.cos(a), y + s * Math.sin(a)); }
    ctx.closePath();
  }
  const rampOf = (stops) => (t) => {
    t = Math.max(0, Math.min(1, t)); const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f)); return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  const SEQ_L = rampOf([[238, 238, 240], [208, 208, 212], [166, 166, 171], [116, 116, 121], [62, 62, 66], [24, 24, 26]]);
  const SEQ_D = rampOf([[28, 28, 30], [58, 58, 62], [104, 104, 109], [160, 160, 165], [225, 225, 230]]);
  const seq = (t) => (dark() ? SEQ_D : SEQ_L)(t);
  const noise = (x, y) => (Math.sin(x * 1.3 + 1.3) * Math.cos(y * 1.7 + .4) + Math.sin((x + y) * .9 + 2.1) + Math.sin(x * 3.1 - y * 2.3)) / 6 + .5;
  function overlay(cv) {
    let l = cv.parentElement.querySelector(".pins");
    if (!l) { l = document.createElement("div"); l.className = "pins"; cv.parentElement.appendChild(l); }
    l.innerHTML = ""; return l;
  }
  function pin(layer, x, y, icon, label, cls = "") {
    const d = document.createElement("div"); d.className = "map-pin " + cls; d.style.left = x + "px"; d.style.top = y + "px";
    d.innerHTML = `<span class="mp-ico"><svg data-icon="${icon}"></svg></span>${label ? `<span class="mp-lbl">${label}</span>` : ""}`;
    layer.appendChild(d); if (window.agtIcon) agtIcon(d.querySelector("svg"));
  }
  const font = (w = 500, s = 12) => `${w} ${s}px Inter, -apple-system, sans-serif`;

  // ================================================================ HERO CITY FILM
  (function heroFilm() {
    const cv = $("#city"); if (!cv || !window.AGTCity) return;
    const $t = $("#clockTime"), $p = $("#clockPhase"), $b = $("#clockBar");
    AGTCity.mount(cv, {
      theme: "mono", dark: dark(), bloom: false, startHour: 17, dayMs: 52000, threshold: .5,
      wide: { cx: .66, cy: .42, zoom: 2.05 }, narrow: { cx: .5, cy: .3, zoom: 1.45 },
      onTick(hf) { if ($t) $t.textContent = AGTCity.clock(hf); if ($p) $p.textContent = AGTCity.phase(Math.floor(hf)); if ($b) $b.style.width = (hf / 24 * 100).toFixed(2) + "%"; },
    });
  })();

  // ================================================================ DYNAMIC CATCHMENT
  (function catchment() {
    const cv = $("#catchCanvas"); if (!cv) return;
    let t = 1, anim = null, G = null;
    function model() {
      const { ctx, w, h, narrow } = fitCanvas(cv, .6, .95);
      const u = Math.min(w, h) / (narrow ? 8.5 : 8.2), sx = w * (narrow ? .5 : .56), sy = h * .5;
      const riverX = (y) => sx + 1.55 * u + .4 * u * Math.sin(y / u * .9 + .6), bridgeY = sy - 2.6 * u;
      const metroY = (x) => sy + (sx - x) * .16;
      const lake = { x: sx - 1.1 * u, y: sy + 1.75 * u, rx: 1.35 * u, ry: .8 * u };
      const s = Math.max(6, u / 4.2), cells = hexCells(w, h, s);
      let max = 0;
      for (const c of cells) {
        const kx = (c.x - sx) / u, ky = (c.y - sy) / u, beyond = c.x > riverX(c.y);
        let d = Math.hypot(kx, ky);
        if (beyond) d = Math.hypot((c.x - riverX(bridgeY)) / u, (c.y - bridgeY) / u) + Math.hypot((riverX(bridgeY) - sx) / u, (bridgeY - sy) / u) + .8;
        let v = Math.exp(-Math.pow(d / 2.5, 2));
        if (c.x < sx) { const dm = Math.abs(c.y - metroY(c.x)) / u, along = (sx - c.x) / u; v += 1.05 * Math.exp(-Math.pow(dm / .6, 2)) * Math.exp(-along / 14); }
        const inLake = Math.pow((c.x - lake.x) / lake.rx, 2) + Math.pow((c.y - lake.y) / lake.ry, 2) < 1;
        v *= inLake ? 0 : (.45 + .75 * noise(kx, ky)); if (beyond) v *= .3;
        Object.assign(c, { v, inRing: Math.hypot(kx, ky) <= 3, corr: c.x < sx - .6 * u && Math.abs(c.y - metroY(c.x)) / u < .7, lake: inLake });
        max = Math.max(max, v);
      }
      const tot = cells.reduce((a, c) => a + c.v, 0), sorted = [...cells].sort((a, b) => b.v - a.v);
      let acc = 0; for (const c of sorted) { c.ta = acc < tot * .8; acc += c.v; }
      const inRing = cells.filter((c) => c.inRing);
      G = { ctx, w, h, u, s, sx, sy, riverX, bridgeY, metroY, lake, cells, max };
      $("#cs1").textContent = pct(inRing.reduce((a, c) => a + c.v, 0) / tot);
      $("#cs2").textContent = pct(inRing.filter((c) => c.v < max * .06).length / inRing.length);
      $("#cs3").textContent = pct(cells.filter((c) => c.corr).reduce((a, c) => a + c.v, 0) / tot);
      pin(overlay(cv), sx, sy, "store", "Site");
    }
    function draw() {
      if (!G) return;
      const { ctx, w, h, u, s, sx, sy, riverX, bridgeY, metroY, lake, cells, max } = G, ink = css("--ink"), ink3 = css("--ink-3"), line = css("--line");
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        if (c.lake) continue;
        const a = c.ta ? t : 0, b = c.inRing ? 1 - t : 0;
        ctx.beginPath(); hex(ctx, c.x, c.y, s * .9);
        if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = seq(.15 + .85 * Math.min(1, c.v / max * 1.2)); ctx.fill(); }
        if (b > 0) { ctx.globalAlpha = b * .9; ctx.fillStyle = dark() ? "#2c2c2e" : "#e8e8ea"; ctx.fill(); }
        ctx.globalAlpha = 1; if (a + b < .2) { ctx.strokeStyle = line; ctx.lineWidth = .7; ctx.stroke(); }
      }
      ctx.beginPath(); ctx.ellipse(lake.x, lake.y, lake.rx, lake.ry, -.2, 0, Math.PI * 2); ctx.fillStyle = dark() ? "#1f2326" : "#e3e6e9"; ctx.fill();
      ctx.lineCap = "round"; ctx.strokeStyle = dark() ? "#4a5056" : "#c9ced4"; ctx.lineWidth = Math.max(6, u * .22);
      ctx.beginPath(); for (let y = -10; y <= h + 10; y += 6) { const x = riverX(y); y < -9 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(riverX(bridgeY) - u * .35, bridgeY); ctx.lineTo(riverX(bridgeY) + u * .35, bridgeY); ctx.stroke();
      ctx.setLineDash([9, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(-10, metroY(-10)); ctx.stroke(); ctx.setLineDash([]);
      for (let k = 1.4; sx - k * u > 10; k += 1.6) { const x = sx - k * u, y = metroY(x); ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8); ctx.fillStyle = css("--bg"); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = ink3; ctx.beginPath(); ctx.arc(sx, sy, 3 * u, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = font(500, 12); ctx.fillStyle = ink3;
      ctx.fillText("3 km radius", sx - 3 * u * .78 - 70, sy - 3 * u * .62 - 6);
      ctx.fillText("River", riverX(h * .82) + 10, h * .82); ctx.fillText("Bridge", riverX(bridgeY) + u * .5, bridgeY + 4);
      ctx.fillText("Lake", lake.x - 12, lake.y + 4); ctx.fillText("Metro line", 14, metroY(14) - 16);
    }
    function setMode(m) {
      $$("[data-catch]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.catch === m));
      const from = t, to = m === "real" ? 1 : 0, t0 = performance.now(); cancelAnimationFrame(anim);
      const step = (now) => { const p = reduce ? 1 : Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - p, 3); t = from + (to - from) * e; draw(); if (p < 1) anim = requestAnimationFrame(step); };
      anim = requestAnimationFrame(step);
    }
    $$("[data-catch]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.catch)));
    model(); t = 0; draw(); onVisible(cv, () => setMode("real"), .35);
    onResize(() => { model(); draw(); });
  })();

  // ================================================================ FORECAST: true waterfall, hover/click evidence, live weights
  (function forecast() {
    const wf = $("#waterfall"); if (!wf) return;
    const BASE = 2.90, AX0 = 2.4, AX1 = 4.6;
    const D = [
      { label: "Daytime footfall", w: 24, s: 98, v: .62, value: "41,800 / day", pct: "98th", note: "Workers and shoppers passing within a ten-minute walk during trading hours." },
      { label: "Co-tenant synergy", w: 18, s: 96, v: .41, value: "38 anchors", pct: "96th", note: "A supermarket, a cinema and two bank branches within 300 m draw the same customers." },
      { label: "Household income", w: 16, s: 94, v: .33, value: "₹1.6 L / month", pct: "94th", note: "Median household income across the trade area, from population aggregates." },
      { label: "Catchment population", w: 16, s: 86, v: .10, value: "1.9 L residents", pct: "86th", note: "Residents inside the dynamic trade area — solid, not exceptional." },
      { label: "Access & visibility", w: 14, s: 92, v: .18, value: "Corner · 32 m front", pct: "92nd", note: "Metro exit 240 m away; the frontage is visible to traffic in both directions." },
      { label: "Competitive pressure", w: 12, s: 80, v: -.32, value: "6 direct rivals", pct: "80th", note: "Six same-category stores share the trade area; two are within 500 m. Pressure subtracts from the baseline." },
    ];
    const W0 = D.map((d) => d.w), W = [...W0], sum = (a) => a.reduce((x, y) => x + y, 0);
    const X = (v) => (Math.max(0, Math.min(1, (v - AX0) / (AX1 - AX0))) * 100).toFixed(2) + "%";
    const phi = (i) => D[i].v * ((W[i] / Math.max(1, sum(W))) / (W0[i] / sum(W0)));      // contribution scales with normalised weight
    const total = () => D.reduce((a, _, i) => a + phi(i), BASE);
    const detail = $("#fcDetail"); let cur = 0;
    const side = $(".fc-score");
    if (side && !side.querySelector(".fc-key")) side.insertAdjacentHTML("beforeend", `<div class="fc-key"><span class="kicker">How to read it</span>
      <ul><li><i class="k0"></i>Baseline: an average store of this format</li><li><i class="k1"></i>Driver that adds revenue</li><li><i class="k2"></i>Driver that takes revenue away</li><li><i class="k3"></i>Forecast: baseline plus every driver</li></ul>
      <p>Each bar starts where the one above ended, so the last bar is the sum of all of them.</p></div>`);
    const ticks = [2.5, 3, 3.5, 4, 4.5];

    function render(animate) {
      let cum = BASE, html = `<div class="wf-axis" aria-hidden="true">${ticks.map((t) => `<span style="left:${X(t)}">₹${t.toFixed(1)}</span>`).join("")}</div>`;
      const row = (cls, label, sub, from, to, bar, val, cumTxt, i, vcls) => {
        const lo = Math.min(from, to), hi = Math.max(from, to);
        return `<button type="button" class="wf-row ${cls}" ${i != null ? `data-i="${i}" aria-pressed="${i === cur}"` : 'tabindex="-1"'}>
          <span class="wf-top"><span class="lbl">${label}<small>${sub}</small></span><span class="val ${vcls || ""}">${val}<small>${cumTxt}</small></span></span>
          <span class="wf-track">${ticks.map((t) => `<i class="gl" style="left:${X(t)}"></i>`).join("")}<span class="wf-bar ${bar}" style="left:${X(lo)};width:calc(${X(hi)} - ${X(lo)})"></span>${i != null ? `<i class="wf-conn" style="left:${X(to)}"></i>` : ""}</span></button>`;
      };
      html += row("static", "Format baseline", "Expected for an average store of this format", AX0, BASE, "base", "₹" + BASE.toFixed(2), "start", null);
      D.forEach((d, i) => { const v = phi(i), from = cum; cum += v;
        html += row("", d.label, `Weight ${Math.round(W[i] / Math.max(1, sum(W)) * 100)}% · score ${d.s}`, from, cum, v >= 0 ? "pos" : "neg", (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2), "= ₹" + cum.toFixed(2), i, v < 0 ? "neg" : ""); });
      html += row("static total", "P50 forecast", "₹ crore per year", AX0, cum, "total", "₹" + cum.toFixed(2), "P10 ₹" + (cum * .853).toFixed(1) + " · P90 ₹" + (cum * 1.161).toFixed(1), null);
      wf.innerHTML = html;
      if (!animate) $$(".wf-bar", wf).forEach((b) => { b.style.transition = "none"; });
      const t = total(); const fb = $(".fc-rev b"), fs = $(".fc-rev small");
      if (fb) fb.textContent = "₹" + t.toFixed(2) + " Cr"; if (fs) fs.textContent = `per year · P10–P90 ₹${(t * .853).toFixed(1)}–${(t * 1.161).toFixed(1)} Cr`;
      pick(cur, true);
    }
    function pick(i, quiet) {
      cur = i; const d = D[i], share = W[i] / Math.max(1, sum(W)), v = phi(i);
      $$(".wf-row[data-i]", wf).forEach((r) => r.setAttribute("aria-pressed", +r.dataset.i === i));
      detail.innerHTML = `<div class="fc-d-head"><b>${d.label}</b><span>${v >= 0 ? "adds" : "subtracts"} ₹${Math.abs(v).toFixed(2)} Cr</span></div>
        <div class="fc-d-grid"><div><b>${Math.round(share * 100)}%</b><span>weight in the score</span></div><div><b>${d.value}</b><span>measured value</span></div><div><b>${d.pct}</b><span>percentile in the market</span></div></div>
        <div class="fc-d-gauge" aria-hidden="true"><span>Market percentile</span><i><u style="width:${d.s}%"></u></i></div>
        <p>${d.note}</p>`;
    }
    wf.addEventListener("click", (e) => { const r = e.target.closest(".wf-row[data-i]"); if (r) pick(+r.dataset.i); });
    wf.addEventListener("pointerover", (e) => { const r = e.target.closest(".wf-row[data-i]"); if (r && +r.dataset.i !== cur) pick(+r.dataset.i); });

    // score ring + weights
    const fc = $(".fc"), arc = $("#ringArc"), num = $("#scoreNum"), C = 2 * Math.PI * 70;
    const score = () => D.reduce((a, d, i) => a + W[i] * d.s, 0) / Math.max(1, sum(W));
    let shown = 0;
    function setScore(target, animate) {
      arc.style.strokeDashoffset = (C * (1 - target / 100)).toFixed(2);
      if (!animate || reduce) { num.textContent = Math.round(target); shown = target; return; }
      const from = shown, t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - p, 3); shown = from + (target - from) * e; num.textContent = Math.round(shown); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    const wbox = $("#weights");
    if (wbox) {
      wbox.innerHTML = `<p class="wt-intro">Move a slider to change how much a driver counts. The score and the revenue forecast update — and the breakdown tab redraws with the new contributions.</p>
        <div class="wt wt-head"><span>Driver</span><span></span><span style="text-align:right">Weight</span><span style="text-align:right">Score</span></div>` +
        D.map((d, i) => `<label class="wt"><span>${d.label}</span><input type="range" min="0" max="40" step="1" value="${d.w}" data-w="${i}" aria-label="Weight for ${d.label}"/><b id="wv${i}">${d.w}%</b><em>${d.s}</em></label>`).join("") +
        `<div class="wt-foot"><span id="wSum"></span><button type="button" class="btn btn-secondary btn-sm" id="wReset">Reset weights</button></div>`;
      const ins = $$("input[data-w]", wbox);
      const upd = () => {
        ins.forEach((el, i) => { W[i] = +el.value; setRange(el); $("#wv" + i).textContent = Math.round(W[i] / Math.max(1, sum(W)) * 100) + "%"; });
        $("#wSum").textContent = `Score ${score().toFixed(0)} · forecast ₹${total().toFixed(2)} Cr`; setScore(score(), true); render(false);
      };
      ins.forEach((el) => el.addEventListener("input", upd));
      $("#wReset").addEventListener("click", () => { ins.forEach((el, i) => { el.value = W0[i]; }); upd(); });
      ins.forEach(setRange); $("#wSum").textContent = `Score ${score().toFixed(0)} · forecast ₹${total().toFixed(2)} Cr`;
    }
    $$("[data-fctab]").forEach((b) => b.addEventListener("click", () => {
      $$("[data-fctab]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      $$("[data-fcpane]").forEach((p) => { p.hidden = p.dataset.fcpane !== b.dataset.fctab; });
    }));
    render(true);
    $$(".wf-bar", wf).forEach((b) => { b.style.transform = "scaleX(0)"; });
    onVisible(fc, () => { $$(".wf-bar", wf).forEach((b, i) => { b.style.transition = `transform .8s cubic-bezier(.28,.11,.32,1) ${i * .07}s`; b.style.transform = "scaleX(1)"; }); setScore(score(), true); }, .3);
  })();

  // ================================================================ CANNIBALISATION
  (function cannibalisation() {
    const cv = $("#cannCanvas"), dist = $("#cnDist"), attr = $("#cnAttr"); if (!cv) return;
    let G = null;
    function layout() {
      const { ctx, w, h, narrow } = fitCanvas(cv, .5, .85);
      const u = w / (narrow ? 9 : 13), s = Math.max(5, u / 4.8), cells = hexCells(w, h, s);
      for (const c of cells) c.d = .55 + .65 * noise(c.x / u, c.y / u);
      G = { ctx, w, h, u, s, cells };
    }
    function run() {
      const { ctx, w, h, u, s, cells } = G, km = +dist.value, A = attr ? +attr.value : 1;
      setRange(dist); $("#cnDistOut").textContent = km.toFixed(1) + " km";
      if (attr) { setRange(attr); $("#cnAttrOut").textContent = A.toFixed(1) + "×"; }
      const ax = w / 2 - km / 2 * u, bx = w / 2 + km / 2 * u, cy = h / 2, OUT = 1 / (2.2 * 2.2);
      const util = (x, y, px, k) => k / (Math.pow((x - px) / u, 2) + Math.pow((y - cy) / u, 2) + .09);
      const C1 = css("--viz-a"), C2 = css("--viz-b"), C3 = css("--viz-ab"), line = css("--line");
      let sA0 = 0, sA1 = 0, sB = 0, aCells = 0, shared = 0;
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        const ua = util(c.x, c.y, ax, 1), ub = util(c.x, c.y, bx, A);
        const pa0 = ua / (ua + OUT), pa1 = ua / (ua + ub + OUT), pb = ub / (ua + ub + OUT);
        sA0 += c.d * pa0; sA1 += c.d * pa1; sB += c.d * pb;
        const inA = pa0 >= .3, inB = ub / (ub + OUT) >= .3; if (inA) { aCells++; if (inB) shared++; }
        ctx.beginPath(); hex(ctx, c.x, c.y, s * .9);
        let col = null, al = 0;
        if (inA && inB) { col = C3; al = .35 + .6 * Math.min(pa1, pb) * 2; } else if (inA) { col = C1; al = .12 + .7 * pa0; } else if (inB) { col = C2; al = .12 + .7 * (ub / (ub + OUT)); }
        if (col) { ctx.globalAlpha = Math.min(1, al) * (.55 + .45 * c.d); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
        else { ctx.strokeStyle = line; ctx.lineWidth = .7; ctx.stroke(); }
      }
      const k = 4.0 / sA0, transfer = (sA0 - sA1) * k, net = sB * k - transfer;
      $("#cn1").textContent = pct(shared / Math.max(1, aCells));
      $("#cn2").textContent = inr(transfer);
      $("#cn2l").textContent = `moves from the existing store each year — ${pct(transfer / 4)} of its sales`;
      $("#cn3").textContent = inr(net);
      $("#cn4") && ($("#cn4").textContent = pct(net / (sB * k)));
      const l = overlay(cv); pin(l, ax, cy, "store", "Existing · ₹4.0 Cr", "left"); pin(l, bx, cy, "map-pin-plus", "Proposed");
    }
    layout(); run();
    dist.addEventListener("input", run); attr && attr.addEventListener("input", run);
    onResize(() => { layout(); run(); });
  })();

  // ================================================================ WHITESPACE SCAN
  (function whitespace() {
    const cv = $("#wsCanvas"); if (!cv) return;
    const SEG = {
      young: { hh: 1.0, c: [[.68, .42, 2.8, 1], [.55, .55, 2.2, .8], [.78, .62, 2.4, .9], [.36, .3, 2, .55]] },
      family: { hh: .8, c: [[.3, .7, 3, 1], [.72, .78, 2.6, .85], [.25, .32, 2.5, .7], [.6, .25, 2.2, .6]] },
      value: { hh: 1.3, c: [[.42, .5, 3.2, 1], [.2, .55, 2.6, .85], [.5, .8, 2.4, .8], [.82, .4, 2.2, .6]] },
    };
    const STORES = [[.47, .47], [.52, .38], [.58, .5], [.44, .58], [.62, .62], [.35, .45], [.7, .45], [.5, .66], [.4, .36], [.66, .32], [.3, .6], [.56, .74]];
    let seg = "young", G = null, sweep = 1, anim = null;
    const thr = $("#wsThr");
    function layout() {
      const { ctx, w, h } = fitCanvas(cv, .62, 1);
      const AX = w > h * 1.1 ? Math.min(1.45, w / h * .85) : 1, R = Math.min(h * .44, w / AX * .44), cx = w / 2, cy = h / 2, u = 2 * R / 26, s = Math.max(4.2, u * .4);
      const shape = (x, y) => { const a = Math.atan2(y - cy, x - cx), r = R * (1 + .16 * Math.sin(3 * a + 1) + .09 * Math.sin(5 * a + 2) + .05 * Math.cos(7 * a)); return Math.hypot((x - cx) / AX, y - cy) < r; };
      const P = (fx, fy) => ({ x: cx + (fx - .5) * 2 * R * AX * .9, y: cy + (fy - .5) * 2 * R * .9 });
      G = { ctx, w, h, u, s, P, cells: hexCells(w, h, s).filter((c) => shape(c.x, c.y)) };
      G.stores = STORES.map(([a, b]) => P(a, b)).filter((p) => shape(p.x, p.y));
      score();
    }
    function score() {
      const { cells, u, P } = G, S = SEG[seg], minO = thr ? +thr.value / 100 : .35;
      let maxD = 0, maxO = 0;
      for (const c of cells) {
        let d = 0; for (const [fx, fy, sp, wt] of S.c) { const p = P(fx, fy); d += wt * Math.exp(-(Math.pow(c.x - p.x, 2) + Math.pow(c.y - p.y, 2)) / Math.pow(sp * u, 2)); }
        d *= .7 + .5 * noise(c.x / u * .6, c.y / u * .6);
        let cov = 0, near = 1e9; for (const p of G.stores) { const dd = Math.hypot(c.x - p.x, c.y - p.y) / u; near = Math.min(near, dd); cov = Math.max(cov, Math.exp(-Math.pow(dd / 2.2, 2))); }
        Object.assign(c, { d, o: d * (1 - cov), near }); maxD = Math.max(maxD, d); maxO = Math.max(maxO, c.o);
      }
      cells.forEach((c) => { c.dn = c.d / maxD; c.on = c.o / maxO; });
      const pk = [];
      for (const c of [...cells].sort((a, b) => b.o - a.o)) { if (c.on < minO) break; if (c.near > 2.5 && pk.every((p) => Math.hypot(p.x - c.x, p.y - c.y) / u > 4)) pk.push(c); if (pk.length === 5) break; }
      G.minO = minO;
      G.pockets = pk.map((p) => ({ x: p.x, y: p.y, near: p.near, hh: cells.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) / u < 2).reduce((a, c) => a + c.d, 0) / maxD * 2600 * S.hh }));
      $("#ws1").textContent = fmt(cells.length); $("#ws2").textContent = G.pockets.length;
      $("#wsPockets").innerHTML = G.pockets.map((p) => `<li><b>${(p.hh / 100000).toFixed(1)} L target households</b><span>within 2 km · nearest store ${p.near.toFixed(1)} km</span></li>`).join("");
      if (thr) { setRange(thr); $("#wsThrOut").textContent = thr.value + "%"; }
    }
    function draw() {
      const { ctx, w, h, s, cells, pockets, stores, minO } = G, sx = sweep * (w + 40) - 20, C3 = css("--viz-pocket"), ink = css("--ink"), bg = css("--bg");
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) { ctx.beginPath(); hex(ctx, c.x, c.y, s * .9); ctx.fillStyle = seq(.04 + .5 * c.dn); ctx.fill(); }
      for (const c of cells) if (c.x < sx && c.on >= minO && c.near > 1.8) { ctx.beginPath(); hex(ctx, c.x, c.y, s * .9); ctx.globalAlpha = Math.min(1, .35 + (c.on - minO) / .35); ctx.fillStyle = C3; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
      for (const p of stores) { ctx.fillStyle = bg; ctx.fillRect(p.x - 5, p.y - 5, 10, 10); ctx.strokeRect(p.x - 5, p.y - 5, 10, 10); }
      if (sweep < 1) { ctx.fillStyle = ink; ctx.globalAlpha = .6; ctx.fillRect(sx, 0, 1, h); ctx.globalAlpha = 1; }
      ctx.font = font(700, 11); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      pockets.forEach((p, i) => {
        if (p.x > sx) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 3.4, 0, Math.PI * 2); ctx.strokeStyle = C3; ctx.lineWidth = 1.6; ctx.stroke();
        const bx = p.x + s * 3.4 * .72, by = p.y - s * 3.4 * .72;
        ctx.fillStyle = bg; ctx.fillRect(bx - 10, by - 10, 20, 20); ctx.strokeRect(bx - 10, by - 10, 20, 20);
        ctx.fillStyle = ink; ctx.fillText(String.fromCharCode(65 + i), bx, by + .5);
      });
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    }
    function scan() {
      cancelAnimationFrame(anim); if (reduce) { sweep = 1; draw(); return; }
      const t0 = performance.now(); const step = (now) => { sweep = Math.min(1, (now - t0) / 1500); draw(); if (sweep < 1) anim = requestAnimationFrame(step); };
      anim = requestAnimationFrame(step);
    }
    $$("[data-ws]").forEach((b) => b.addEventListener("click", () => { seg = b.dataset.ws; $$("[data-ws]").forEach((x) => x.setAttribute("aria-pressed", x === b)); score(); scan(); }));
    thr && thr.addEventListener("input", () => { score(); sweep = 1; draw(); });
    layout(); sweep = 0; draw(); onVisible(cv, scan, .35);
    onResize(() => { layout(); sweep = 1; draw(); });
  })();

  // ================================================================ STREET RHYTHMS
  const CURVES = {"office":{"wd":[0.21,0.1,0.1,0.1,0.1,0.31,1.03,3.09,7.72,9.27,7.21,6.18,8.75,7.72,5.66,5.15,5.66,7.72,8.75,6.69,4.12,2.57,1.24,0.52],"we":[0.37,0.12,0.12,0.12,0.12,0.25,0.61,1.23,2.46,3.69,4.91,6.14,7.99,7.99,6.76,6.14,6.76,7.99,9.21,9.21,7.99,5.53,3.07,1.23]},"leisure":{"wd":[1.5,0.6,0.3,0.1,0.1,0.2,0.8,2.0,3.0,3.5,4.0,5.0,6.99,7.49,5.0,4.0,4.5,5.99,7.99,9.49,9.99,8.49,5.99,3.0],"we":[2.17,1.04,0.43,0.17,0.09,0.17,0.52,1.3,2.17,3.04,3.9,5.2,6.5,6.94,5.64,4.77,5.2,6.5,7.81,9.11,9.54,8.24,6.07,3.47]},"retail":{"wd":[0.29,0.1,0.1,0.1,0.1,0.29,0.97,2.42,3.87,4.84,6.29,7.26,7.74,6.78,5.81,5.32,6.29,7.74,8.71,8.71,7.74,5.32,2.42,0.77],"we":[0.46,0.18,0.09,0.09,0.09,0.18,0.55,1.38,2.75,4.13,5.96,7.34,7.8,7.34,6.42,5.96,6.88,7.8,8.72,8.72,7.8,5.51,2.75,1.1]},"resident":{"wd":[0.81,0.4,0.2,0.2,0.4,1.52,4.54,7.58,8.08,6.06,4.54,4.04,4.54,4.04,3.53,4.04,5.56,7.07,8.08,8.08,7.07,5.05,3.03,1.52],"we":[1.15,0.58,0.29,0.19,0.29,0.77,2.4,4.32,5.76,6.24,6.24,6.24,6.24,5.76,4.8,4.8,5.76,6.72,7.68,7.68,6.72,4.8,2.88,1.73]}};
  const hh = (h) => String(h).padStart(2, "0") + ":00";
  (function rhythm() {
    const svg = $("#rhythmSvg"), box = $("#rhythm"), tip = $("#rhythmTip"), NS = "http://www.w3.org/2000/svg"; if (!svg) return;
    const SERIES = [{ k: "office", label: "Office corridor", note: "lunch and commute", c: "--ink", dash: "" }, { k: "leisure", label: "Leisure strip", note: "late evening", c: "--ink", dash: "7 5" },
      { k: "retail", label: "Shopping street", note: "afternoon to evening", c: "--ink-3", dash: "" }, { k: "resident", label: "Residential lane", note: "morning and dusk", c: "--ink-3", dash: "2 4" }];
    let W = 1000, H = 320, day = "wd", focus = null, lines, peaks, hover, dots;
    const L = 40, R = 10, T = 18, Bm = 30, X = (h) => L + h * (W - L - R) / 23, Y = (v) => T + (1 - v / 11) * (H - T - Bm);
    const el = (n, a = {}, p = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const smooth = (pts) => { let d = `M${pts[0][0]},${pts[0][1]}`; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`; } return d; };
    function build() {
      W = Math.max(300, Math.round(box.clientWidth - 36 || 1000)); H = W < 560 ? 230 : 320;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = "";
      const g = el("g", { class: "grid" }), ax = el("g", { class: "axis" });
      for (const v of [0, 2.5, 5, 7.5, 10]) { el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gl" }, g); el("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, ax).textContent = v ? v + "%" : "0"; }
      for (const h of (W < 560 ? [0, 6, 12, 18, 23] : [0, 3, 6, 9, 12, 15, 18, 21, 23])) el("text", { x: X(h), y: H - 6, "text-anchor": h === 0 ? "start" : h === 23 ? "end" : "middle" }, ax).textContent = hh(h);
      lines = SERIES.map((s) => el("path", { class: "ln", stroke: css(s.c), "data-dash": s.dash }));
      peaks = SERIES.map((s) => el("text", { fill: css(s.c), "text-anchor": "middle" }));
      hover = el("line", { class: "hover-line", y1: T, y2: H - Bm, opacity: 0 });
      dots = SERIES.map((s) => el("circle", { r: 4, fill: css("--bg"), stroke: css(s.c), "stroke-width": 2, opacity: 0 }));
      lines.forEach((l, j) => l.classList.toggle("on", j === focus));
    }
    function draw(animate) {
      SERIES.forEach((s, i) => {
        const v = CURVES[s.k][day]; lines[i].setAttribute("d", smooth(v.map((y, h) => [X(h), Y(y)])));
        const pk = v.indexOf(Math.max(...v)); peaks[i].setAttribute("x", X(pk)); peaks[i].setAttribute("y", Y(v[pk]) - 9); peaks[i].textContent = hh(pk);
        lines[i].style.strokeDasharray = SERIES[i].dash || "none"; lines[i].style.strokeDashoffset = 0; lines[i].style.transition = "opacity .2s";
      });
      peaks.forEach((p, i) => p.setAttribute("opacity", focus === i || (focus == null && W >= 560) ? 1 : 0));
    }
    function setFocus(i) { focus = i; box.classList.toggle("focus", i != null); lines.forEach((l, j) => l.classList.toggle("on", j === i)); $$("#rhythmLegend button").forEach((b, j) => b.setAttribute("aria-pressed", j === i)); draw(false); }
    SERIES.forEach((s, i) => { const li = document.createElement("li");
      li.innerHTML = `<button type="button" aria-pressed="false"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="${css(s.c)}" stroke-width="2" stroke-dasharray="${s.dash || "none"}"/></svg>${s.label} <small>${s.note}</small></button>`;
      const b = li.firstChild; b.addEventListener("mouseenter", () => setFocus(i)); b.addEventListener("mouseleave", () => setFocus(null)); b.addEventListener("click", () => setFocus(focus === i ? null : i));
      $("#rhythmLegend").appendChild(li); });
    $$("[data-day]").forEach((b) => b.addEventListener("click", () => { day = b.dataset.day; $$("[data-day]").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(true); }));
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect(), h = Math.max(0, Math.min(23, Math.round(((e.clientX - r.left) / r.width * W - L) / (W - L - R) * 23)));
      hover.setAttribute("x1", X(h)); hover.setAttribute("x2", X(h)); hover.setAttribute("opacity", 1);
      SERIES.forEach((s, i) => { dots[i].setAttribute("cx", X(h)); dots[i].setAttribute("cy", Y(CURVES[s.k][day][h])); dots[i].setAttribute("opacity", focus == null || focus === i ? 1 : .25); });
      tip.innerHTML = `<b>${hh(h)} · ${day === "wd" ? "Weekday" : "Weekend"}</b>` + SERIES.map((s) => `<div><span>${s.label}</span><span>${CURVES[s.k][day][h].toFixed(1)}%</span></div>`).join("");
      tip.style.left = Math.max(100, Math.min(r.width - 80, X(h) / W * r.width + 18)) + "px"; tip.classList.add("show");
    });
    svg.addEventListener("pointerleave", () => { hover.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); tip.classList.remove("show"); });
    build(); draw(false); onVisible(svg, () => draw(true), .35);
    let lastW = W; onResize(() => { if (Math.abs(box.clientWidth - 36 - lastW) > 4) { build(); draw(false); lastW = W; } });
  })();

  // ================================================================ DISTANCE-DECAY EXPLORER (Huff)
  (function decay() {
    const svg = $("#decaySvg"), beta = $("#beta"), attrB = $("#attrB"); if (!svg) return;
    const NS = "http://www.w3.org/2000/svg", W = 720, H = 300, L = 44, R = 14, T = 16, Bm = 34, MAXD = 6;
    const X = (d) => L + d / MAXD * (W - L - R), Y = (p) => T + (1 - p) * (H - T - Bm);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    for (const p of [0, .25, .5, .75, 1]) { el("line", { x1: L, x2: W - R, y1: Y(p), y2: Y(p), class: "gl" }); el("text", { x: L - 8, y: Y(p) + 4, "text-anchor": "end" }).textContent = Math.round(p * 100) + "%"; }
    for (let d = 0; d <= MAXD; d++) el("text", { x: X(d), y: H - 10, "text-anchor": "middle" }).textContent = d + " km";
    const pA = el("path", { fill: "none", stroke: css("--c1"), "stroke-width": 2.2 }), pB = el("path", { fill: "none", stroke: css("--c2"), "stroke-width": 2.2, "stroke-dasharray": "6 4" });
    const lA = el("text", { fill: css("--c1") }), lB = el("text", { fill: css("--c2") });
    // a customer between store A (at 0 km) and store B (at 6 km) — probability of choosing each
    function run() {
      const b = +beta.value, aB = attrB ? +attrB.value : 1; setRange(beta); attrB && setRange(attrB);
      $("#betaOut").textContent = b.toFixed(1); attrB && ($("#attrBOut").textContent = aB.toFixed(1) + "×");
      let dA = "", dB = "";
      for (let i = 0; i <= 120; i++) {
        const d = .05 + i / 120 * (MAXD - .1), ua = 1 / Math.pow(d, b), ub = aB / Math.pow(MAXD - d, b), pa = ua / (ua + ub);
        dA += (i ? "L" : "M") + X(d).toFixed(1) + "," + Y(pa).toFixed(1); dB += (i ? "L" : "M") + X(d).toFixed(1) + "," + Y(1 - pa).toFixed(1);
      }
      pA.setAttribute("d", dA); pB.setAttribute("d", dB);
      lA.setAttribute("x", X(.15)); lA.setAttribute("y", Y(.55)); lA.textContent = "Store A";
      lB.setAttribute("x", X(MAXD - .15)); lB.setAttribute("y", Y(.55)); lB.setAttribute("text-anchor", "end"); lB.textContent = "Store B";
      // break-even point
      let lo = .05, hi = MAXD - .05; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, ua = 1 / Math.pow(m, b), ub = aB / Math.pow(MAXD - m, b); if (ua > ub) lo = m; else hi = m; }
      $("#breakEven").textContent = lo.toFixed(1) + " km";
    }
    beta.addEventListener("input", run); attrB && attrB.addEventListener("input", run); run();
  })();

  // ================================================================ FORECAST RANGE (P10–P90 fan)
  (function fan() {
    const svg = $("#fanSvg"); if (!svg) return;
    const NS = "http://www.w3.org/2000/svg", W = 720, H = 280, L = 52, R = 14, T = 16, Bm = 34;
    const months = 24, P50 = [], P10 = [], P90 = [];
    for (let m = 0; m <= months; m++) { const ramp = 1 - Math.exp(-m / 4.5), base = 4.22 * ramp, spread = .1 + .06 * Math.sqrt(m); P50.push(base); P10.push(base * (1 - spread * .9)); P90.push(base * (1 + spread * .8)); }
    const MAXY = 5.6, X = (m) => L + m / months * (W - L - R), Y = (v) => T + (1 - v / MAXY) * (H - T - Bm);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    for (const v of [0, 1, 2, 3, 4, 5]) { el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "gl" }); el("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end" }).textContent = "₹" + v; }
    for (const m of [0, 6, 12, 18, 24]) el("text", { x: X(m), y: H - 10, "text-anchor": "middle" }).textContent = "M" + m;
    const band = P90.map((v, m) => `${X(m)},${Y(v)}`).join(" L") + " L" + P10.map((v, m) => `${X(m)},${Y(v)}`).reverse().join(" L");
    el("path", { d: "M" + band + " Z", fill: css("--accent"), opacity: .12 });
    el("path", { d: "M" + P90.map((v, m) => `${X(m)},${Y(v)}`).join(" L"), fill: "none", stroke: css("--accent"), "stroke-width": 1, "stroke-dasharray": "3 3", opacity: .7 });
    el("path", { d: "M" + P10.map((v, m) => `${X(m)},${Y(v)}`).join(" L"), fill: "none", stroke: css("--accent"), "stroke-width": 1, "stroke-dasharray": "3 3", opacity: .7 });
    el("path", { d: "M" + P50.map((v, m) => `${X(m)},${Y(v)}`).join(" L"), fill: "none", stroke: css("--ink"), "stroke-width": 2 });
    [["P90", P90], ["P50", P50], ["P10", P10]].forEach(([n, a]) => { const t = el("text", { x: X(months) - 4, y: Y(a[months]) - 6, "text-anchor": "end", fill: css("--ink-2") }); t.textContent = `${n} ₹${a[months].toFixed(1)} Cr`; });
  })();
})();
