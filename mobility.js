/* Mobility layer: Calendar-Conditioned Spatial Interaction Model (CCSIM).
   Reads data/<business>/<site>/mobility.json (written by the pipeline; shown to admins until the data licences are cleared for clients).
   Adds a "Mobility" tab + rail button, and map layers (origin areas shaded by daily visitors, arcs into the site). */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v) => Math.round(v).toLocaleString("en-IN");
  const pct = (v, d = 0) => (v >= 0 ? "+" : "") + (v * 100).toFixed(d) + "%";
  const M = { d: null, dir: "in", day: "weekday", fest: null, show: true };
  const RAMP = [[255, 244, 214], [254, 214, 140], [253, 164, 87], [236, 100, 56], [178, 36, 40]];
  const ramp = (t) => { t = Math.max(0, Math.min(.9999, t)); const x = t * 4, i = Math.floor(x), f = x - i; return [0, 1, 2].map((k) => Math.round(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f)); };
  const dateTxt = (s) => { const d = new Date(s + "T00:00:00Z"); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };

  const cur = () => (M.dir === "in" ? M.d.inbound : M.d.outbound)[M.day];
  const adj = () => (M.fest ? 1 + M.fest.effect : 1);       // the selected festival scales the day's numbers

  function render() {
    const el = $("mobilityTab"); if (!el || !M.d) return;
    const d = M.d, s = d.site, c = cur(), a = adj(), inb = d.inbound[M.day], mx = Math.max(1, ...c.top.map((t) => t.people));
    const fests = d.festivals.filter((f) => f.material);
    el.innerHTML = `
      <div class="mb-head"><div class="mb-eyebrow">MOBILITY</div><div class="mb-model">${esc(d.model.name)}</div>
        <div class="mb-sub">Where visitors to ${esc(s.name)} come from, and how festivals change it. Modelled estimates.</div></div>
      <div class="mb-seg" id="mbDir"><button data-v="in" class="${M.dir === "in" ? "on" : ""}">Visitors coming in</button><button data-v="out" class="${M.dir === "out" ? "on" : ""}">Residents going out</button></div>
      <div class="mb-seg" id="mbDay"><button data-v="weekday" class="${M.day === "weekday" ? "on" : ""}">Weekday</button><button data-v="weekend" class="${M.day === "weekend" ? "on" : ""}">Weekend</button></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="mb-l">${M.dir === "in" ? "VISITORS / DAY" : "PEOPLE LEAVING / DAY"}</div><div class="v">${fmt(c.total * a)}</div><div class="s">${M.fest ? esc(M.fest.name) + " " + pct(M.fest.effect) : "normal day"}</div></div>
        <div class="kpi"><div class="mb-l">${M.dir === "in" ? "FROM OWN AREA" : "RESIDENTS"}</div><div class="v">${M.dir === "in" ? fmt(inb.from_own_area * a) : fmt(s.residents)}</div><div class="s">${M.dir === "in" ? "same pincode area" : esc(s.name)}</div></div>
        <div class="kpi"><div class="mb-l">LEAVE HOME</div><div class="v">${(s.leave_home_share[M.day] * 100).toFixed(0)}%</div><div class="s">of residents, per day</div></div>
        <div class="kpi"><div class="mb-l">TRIP REACH</div><div class="v">${s.decay_km[M.day].toFixed(1)} km</div><div class="s">distance decay</div></div>
      </div>
      <div class="section"><div class="section-title"><h4>${M.dir === "in" ? "Where visitors come from" : "Where residents go"}</h4><span>people / day</span></div>
        ${c.top.slice(0, 12).map((t, i) => `<div class="mb-row" title="${esc(t.district)}"><span class="mb-n">${i + 1}</span><span class="mb-nm">${esc(t.name)}</span><span class="mb-v">${fmt(t.people * a)}</span><span class="mb-km">${t.km.toFixed(1)} km</span><i style="width:${(t.people / mx * 100).toFixed(0)}%"></i></div>`).join("")}</div>
      ${M.dir === "in" ? `<div class="section"><div class="section-title"><h4>Visitors by distance</h4><span>share of inbound</span></div>
        <div class="mb-bands">${inb.bands.map((b, i) => `<div style="flex:${Math.max(b.share, .01)};background:${`rgb(${ramp(i / 4).join(",")})`}" title="${esc(b.label)} · ${fmt(b.people)}"></div>`).join("")}</div>
        <div class="mb-bl">${inb.bands.map((b) => `<span>${esc(b.label)} <b>${(b.share * 100).toFixed(0)}%</b></span>`).join("")}</div></div>` : ""}
      <div class="section"><div class="section-title"><h4>Festival &amp; holiday effect</h4><span>${esc(s.state)} · 90% range</span></div>
        <div class="mb-fest ${M.fest ? "" : "on"}" data-f=""><span>Normal day</span><em>baseline</em></div>
        ${fests.map((f) => `<div class="mb-fest ${M.fest && M.fest.id === f.id ? "on" : ""}" data-f="${esc(f.id)}"><span>${esc(f.name)}<small>${esc(dateTxt(f.date))}${f.past ? " · earlier this year" : ""}</small></span><em class="${f.effect < 0 ? "neg" : "pos"}">${pct(f.effect)}<small>${pct(f.low)} to ${pct(f.high)}</small></em></div>`).join("") || `<div class="mb-sub">No festival moves this state's movement beyond normal day-to-day variation.</div>`}
        <div class="mb-sub" style="margin-top:6px">Select a festival to see the numbers above on that day. Dates are estimates to be confirmed against the official holiday list.</div></div>
      <label class="mb-chk"><input type="checkbox" id="mbShow" ${M.show ? "checked" : ""}/> Show flows on the map (hides the other map layers while this panel is open)</label>
      <div class="mb-note">${esc(d.model.basis)} Built from proprietary mobility, population and places datasets. ${esc(d.model.caveats[0])}</div>`;
    $("mbDir").onclick = (e) => { const v = e.target.dataset.v; if (v) { M.dir = v; render(); (typeof redraw === "function" && redraw()); } };
    $("mbDay").onclick = (e) => { const v = e.target.dataset.v; if (v) { M.day = v; render(); (typeof redraw === "function" && redraw()); } };
    el.querySelectorAll(".mb-fest").forEach((r) => { r.onclick = () => { M.fest = d.festivals.find((f) => f.id === r.dataset.f) || null; render(); }; });
    $("mbShow").onchange = (e) => { M.show = e.target.checked; (typeof redraw === "function" && redraw()); };
  }

  function layers() {
    if (!M.d || !M.show || !active()) return [];
    const c = cur(), by = {}; c.top.forEach((t) => { by[t.pin] = t; });
    const mx = Math.max(1, ...c.top.map((t) => t.people)), site = M.d.site, to = D.site.centre, a = adj();
    const feats = M.d.geometry.features;
    return [
      new deck.GeoJsonLayer({ id: "mob-areas", data: feats, pickable: true, stroked: true, filled: true, lineWidthUnits: "pixels", getLineColor: (f) => (f.properties.site ? [29, 29, 31, 255] : [255, 255, 255, 190]),
        getLineWidth: (f) => (f.properties.site ? 2.5 : 0.8), getFillColor: (f) => { const t = by[f.properties.pin]; return f.properties.site ? [29, 29, 31, 40] : t ? [...ramp(Math.sqrt(t.people / mx)), 120] : [200, 200, 205, 40]; },
        updateTriggers: { getFillColor: [M.dir, M.day, M.fest && M.fest.id] }, autoHighlight: true, highlightColor: [255, 255, 255, 70] }),
      new deck.ArcLayer({ id: "mob-arcs", data: c.top.slice(0, 12), getSourcePosition: (t) => (M.dir === "in" ? [t.lng, t.lat] : to), getTargetPosition: (t) => (M.dir === "in" ? to : [t.lng, t.lat]),
        getSourceColor: [29, 29, 31, 200], getTargetColor: [236, 100, 56, 235], getWidth: (t) => 1 + 4 * Math.sqrt(t.people / mx), widthUnits: "pixels", getHeight: 0.35,
        updateTriggers: { getSourcePosition: [M.dir], getTargetPosition: [M.dir] } })];
  }

  async function load(base) {
    M.d = null; M.fest = null;
    try { M.d = await getJSON(base + "mobility.json"); } catch (e) { M.d = null; }
    const on = !!M.d;
    ["mobilityTabBtn", "railMobility"].forEach((id) => { const b = $(id); if (b) b.style.display = on ? "" : "none"; });
    if (on) render();
  }
  const active = () => { const t = document.querySelector(".tab.active"); return !!t && t.dataset.tab === "mobilityTab"; };
  const bounds = () => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const w = (c) => { if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(w); };
    M.d.geometry.features.forEach((f) => w(f.geometry.coordinates)); return [[x0, y0], [x1, y1]]; };
  let wasOn = false;
  document.addEventListener("click", (e) => { if (M.d && e.target.closest && e.target.closest(".tab, [data-rail]")) setTimeout(() => {
    const on = active();
    if (on && !wasOn && typeof map !== "undefined" && map) { M.prev = { center: map.getCenter(), zoom: map.getZoom() }; try { map.fitBounds(bounds(), { padding: { top: 70, bottom: 190, left: 60, right: 440 }, maxZoom: 12.5, duration: 700 }); } catch (err) { /* keep the view */ } }
    else if (!on && wasOn && M.prev && typeof map !== "undefined" && map) { map.easeTo({ center: M.prev.center, zoom: M.prev.zoom, duration: 600 }); }
    wasOn = on; if (typeof redraw === "function") redraw(); }, 90); });
  window.AGTMobility = { load, layers, render, refresh: () => { if (M.d) { render(); } } };
})();
