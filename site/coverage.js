/* Coverage & rollout: one source of truth for which cities are live, plus the components that show it.
 *   [data-coverage="band"]   full section: map, what "high-precision" means, phases, "Which city next?" form  (home)
 *   [data-coverage="tiers"]  three-column tier comparison                                                      (pricing, methodology)
 *   [data-coverage="strip"]  one-line reminder                                                                 (sign-in)
 *   <select id="city">       request-form city picker with a note about the coverage tier                       (request form)
 * Edit CITIES / PHASES below to change what the site says — nothing else needs touching. */
(function () {
  "use strict";
  const LIVE = "Bengaluru";
  // lon/lat are only used to place the dots on the map. label: which side the name sits on.
  const CITIES = [
    { name: "Bengaluru", lon: 77.59, lat: 12.97, phase: 1, label: "l" },
    { name: "Hyderabad", lon: 78.49, lat: 17.39, phase: 2, label: "r" },
    { name: "Chennai", lon: 80.27, lat: 13.08, phase: 2, label: "r" },
    { name: "Pune", lon: 73.86, lat: 18.52, phase: 2, label: "r" },
    { name: "Mumbai", lon: 72.88, lat: 19.08, phase: 3, label: "l" },
    { name: "Delhi NCR", lon: 77.21, lat: 28.61, phase: 3, label: "r" },
    { name: "Kolkata", lon: 88.36, lat: 22.57, phase: 3, label: "r" },
    { name: "Ahmedabad", lon: 72.57, lat: 23.02, phase: 3, label: "l" },
  ];
  const PHASES = [
    { n: 1, status: "Live", text: "Bengaluru — high-precision data and models." },
    { n: 2, status: "In build", text: "Hyderabad, Chennai and Pune." },
    { n: 3, status: "Planned", text: "Mumbai, Delhi NCR, Kolkata and Ahmedabad." },
  ];
  const TIERS = [
    { key: "high", name: "High-precision", where: "Bengaluru", state: "Live",
      points: ["Street-level modelling at 65 m resolution", "Demand calibrated to the city's own patterns", "Competition and complementary-business model tuned locally"] },
    { key: "std", name: "Standard coverage", where: "Any other Indian city", state: "Available now",
      points: ["Same platform, same dashboard and forecasts", "Built on city-wide datasets, so local detail is coarser", "Upgraded automatically when your city's phase goes live"] },
    { key: "next", name: "Next phases", where: "Hyderabad, Chennai, Pune and more", state: "In build",
      points: ["High-precision data and models being built city by city", "Order of cities follows demand", "Tell us which city you need next"] },
  ];

  // outline of India, simplified (lon, lat) — a silhouette, not a survey
  const OUTLINE = [[74.3,34.5],[75.5,36.9],[77.8,35.5],[79.5,32.5],[78.8,30.8],[81,30.2],[80.1,28.8],[84.2,27.4],[88,26.5],[88.2,27.9],[89.8,26.8],[92,27.8],[95,29.2],[96.2,28],[97.3,28.2],[95.6,26.6],[94.5,24.4],[93.4,22.9],[92.6,21.8],[92.1,23.7],[91.2,23.1],[91.6,24.1],[90.3,25.1],[88.9,26.2],[89,25.3],[88.2,25.8],[88.1,24.5],[88.9,22],[87,21.5],[86.9,20],[85.2,19.5],[84,18],[82.3,16.6],[80.3,15.5],[80.2,13.4],[79.8,11.2],[79.3,10.3],[78.4,9.2],[77.5,8.1],[76.5,8.9],[75,12],[74.7,13.9],[73.3,16],[72.8,19],[72.9,21.1],[72.5,21.9],[70.8,20.7],[69,22.3],[70.5,23.1],[68.2,23.7],[70,25.2],[71,24.4],[72,25],[70.5,28],[72.5,29.5],[74.5,31],[74.4,32.3],[73.8,33.5]];
  const K = 13.2, X = (lon) => ((lon - 67.5) * K).toFixed(1), Y = (lat) => ((37.5 - lat) * K * 1.07).toFixed(1);

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tierOf = (city) => (String(city || "").trim().toLowerCase() === LIVE.toLowerCase() ? "high" : "std");
  const NOTE = {
    high: ["High-precision coverage", "Your report is built on our high-precision Bengaluru data and models."],
    std: ["Standard coverage", "We can analyse this city today on city-wide datasets. Local detail is coarser than in Bengaluru; high-precision coverage for more cities is being built in phases."],
  };

  // ---------------------------------------------------------------- styles (self-contained, theme-aware)
  const css = `
  .cov-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:center}
  .cov-map{position:relative;max-width:440px;width:100%;margin:0 auto}
  .cov-map svg{width:100%;height:auto;display:block;overflow:visible}
  .cov-india{fill:var(--bg-2);stroke:var(--line-2);stroke-width:1.2;stroke-linejoin:round}
  .cov-dot-live{fill:var(--ink)} .cov-pulse{fill:none;stroke:var(--ink);stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:covp 2.6s ease-out infinite}
  .cov-dot-2{fill:var(--bg);stroke:var(--ink);stroke-width:1.6;stroke-dasharray:3 2.4} .cov-dot-3{fill:var(--bg);stroke:var(--ink-3);stroke-width:1.4;stroke-dasharray:2.4 2.4}
  .cov-lab{font:600 11px/1 var(--sans,system-ui);fill:var(--ink)} .cov-lab.dim{fill:var(--ink-3);font-weight:500}
  @keyframes covp{0%{transform:scale(1);opacity:.7}100%{transform:scale(4.2);opacity:0}}
  @media (prefers-reduced-motion:reduce){.cov-pulse{animation:none;opacity:.25}}
  .cov-legend{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;margin:20px 0 0;font-size:12.5px;color:var(--ink-2)}
  .cov-legend span{display:inline-flex;align-items:center;gap:8px} .cov-legend i{width:11px;height:11px;border-radius:50%;display:inline-block;box-sizing:border-box}
  .cov-legend .a{background:var(--ink)} .cov-legend .b{border:1.6px dashed var(--ink)} .cov-legend .c{border:1.4px dashed var(--ink-3)}
  .cov-phases{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:0;border-top:1px solid var(--line)}
  .cov-phases li{display:grid;grid-template-columns:86px 1fr auto;gap:16px;align-items:baseline;padding:15px 0;border-bottom:1px solid var(--line);font-size:15.5px;color:var(--ink-2)}
  .cov-phases b{color:var(--ink);font-weight:600} .cov-phases .st{font-size:12px;font-weight:600;border-radius:980px;padding:3px 11px;background:var(--bg-3);color:var(--ink-2);white-space:nowrap}
  .cov-phases li.live .st{background:var(--ink);color:var(--bg)}
  .cov-ask{margin-top:30px;border:1px solid var(--line);border-radius:18px;padding:22px 24px;background:var(--bg)}
  .cov-ask h3{margin:0 0 4px;font-size:18px;letter-spacing:-.01em} .cov-ask p{margin:0 0 14px;font-size:14.5px;color:var(--ink-2)}
  .cov-ask form{display:grid;grid-template-columns:minmax(150px,1fr) minmax(0,1.3fr) auto;gap:10px} .cov-ask .oth{grid-column:1/3}
  .cov-ask input,.cov-ask select{font:inherit;font-size:14.5px;border:1px solid var(--line-2);border-radius:12px;padding:11px 13px;background:var(--bg);color:var(--ink);min-width:0}
  .cov-ask button{border:0;border-radius:980px;padding:0 22px;background:var(--ink);color:var(--bg);font:600 14px/1 inherit;cursor:pointer;height:44px}
  .cov-ask button[disabled]{opacity:.5} .cov-msg{margin:10px 0 0 !important;font-size:13.5px !important;min-height:18px} .cov-msg.ok{color:#17653a !important} .cov-msg.err{color:#b42318 !important}
  :root[data-theme="dark"] .cov-msg.ok{color:#7fd6a2 !important} :root[data-theme="dark"] .cov-msg.err{color:#f0a39b !important}
  .cov-pts{margin:22px 0 0;padding:0;list-style:none;display:grid;gap:10px} .cov-pts li{display:flex;gap:12px;font-size:16px;color:var(--ink-2);line-height:1.5} .cov-pts li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ink);margin-top:9px;flex:none}
  .cov-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .cov-tier{border:1px solid var(--line);border-radius:18px;padding:26px;background:var(--bg);display:flex;flex-direction:column;gap:10px} .cov-tier.high{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-tier .k{display:flex;justify-content:space-between;gap:8px 10px;align-items:center;flex-wrap:wrap} .cov-tier .nm{font-size:19px;font-weight:600;letter-spacing:-.01em}
  .cov-tier .st{font-size:12px;font-weight:600;border-radius:980px;padding:3px 11px;background:var(--bg-3);color:var(--ink-2)} .cov-tier.high .st{background:var(--ink);color:var(--bg)}
  .cov-tier .wh{font-size:14px;color:var(--ink-3);margin:0} .cov-tier ul{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:9px} .cov-tier li{font-size:14.5px;color:var(--ink-2);padding-left:18px;position:relative;line-height:1.5} .cov-tier li::before{content:"";position:absolute;left:0;top:9px;width:6px;height:1px;background:var(--ink-3)}
  .cov-strip{font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:10px;margin:18px 0 0} .stage .cov-strip{color:rgba(255,255,255,.78);margin-top:22px} .stage .cov-strip i{background:#fff}
  .cov-strip i{width:8px;height:8px;border-radius:50%;background:var(--ink);display:inline-block;flex:none}
  .cov-note{margin-top:8px;font-size:13.5px;color:var(--ink-2);border-radius:12px;background:var(--bg-2);padding:11px 14px;line-height:1.5} .cov-note b{color:var(--ink);display:block;margin-bottom:2px;font-size:13px}
  @media (max-width:900px){.cov-grid{grid-template-columns:1fr;gap:34px}.cov-tiers{grid-template-columns:1fr}.cov-ask form{grid-template-columns:1fr}.cov-ask .oth{grid-column:auto}.cov-ask button{height:46px}.cov-phases li{grid-template-columns:72px 1fr}.cov-phases .st{grid-column:2;justify-self:start}}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------------------------------------------------------------- map
  function mapSvg() {
    const path = "M" + OUTLINE.map(([lo, la]) => X(lo) + "," + Y(la)).join("L") + "Z";
    const dots = CITIES.slice().sort((a, b) => b.phase - a.phase).map((c) => {
      const x = X(c.lon), y = Y(c.lat), left = c.label === "l", tx = left ? +x - 11 : +x + 11;
      const mark = c.phase === 1 ? `<circle class="cov-pulse" cx="${x}" cy="${y}" r="5"/><circle class="cov-dot-live" cx="${x}" cy="${y}" r="5.5"/>` : `<circle class="cov-dot-${c.phase}" cx="${x}" cy="${y}" r="5"/>`;
      return `<g>${mark}<text class="cov-lab ${c.phase === 1 ? "" : "dim"}" x="${tx}" y="${+y + 4}" text-anchor="${left ? "end" : "start"}">${esc(c.name)}</text></g>`;
    }).join("");
    return `<svg viewBox="-10 -6 430 430" role="img" aria-label="Map of India. Bengaluru is live with high-precision coverage; Hyderabad, Chennai and Pune are in build; Mumbai, Delhi NCR, Kolkata and Ahmedabad are planned."><path class="cov-india" d="${path}"/>${dots}</svg>`;
  }

  function band(el) {
    const others = CITIES.filter((c) => c.name !== LIVE).map((c) => c.name);
    el.innerHTML = `<div class="wrap"><div class="cov-grid">
      <div>
        <p class="eyebrow">Coverage</p>
        <h2 class="h2">Built deep in Bengaluru.<br /><span class="dim">Expanding city by city.</span></h2>
        <p class="lede" style="font-size:18px">High-precision data and models for Bengaluru are live today. We are building the same depth for other Indian cities in phases — and reports for other cities are already available at standard coverage.</p>
        <ul class="cov-pts">${TIERS[0].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        <ol class="cov-phases">${PHASES.map((p) => `<li class="${p.n === 1 ? "live" : ""}"><b>Phase ${p.n}</b><span>${esc(p.text)}</span><span class="st">${esc(p.status)}</span></li>`).join("")}</ol>
      </div>
      <div>
        <div class="cov-map">${mapSvg()}<div class="cov-legend"><span><i class="a"></i>High-precision · live</span><span><i class="b"></i>Next phase · in build</span><span><i class="c"></i>Planned</span></div></div>
        <div class="cov-ask"><h3>Which city should be next?</h3><p>Tell us where you need high-precision coverage. It helps us decide the order — and we'll email you when it's ready.</p>
          <form id="covForm" novalidate>
            <select id="covCity" aria-label="City">${others.map((c) => `<option>${esc(c)}</option>`).join("")}<option value="__other">Another city…</option></select>
            <input id="covEmail" type="email" placeholder="Your email" autocomplete="email" aria-label="Your email" />
            <button type="submit" id="covGo">Notify me</button>
            <input id="covOther" class="oth" placeholder="City name" aria-label="City name" hidden />
          </form><p class="cov-msg" id="covMsg" role="status" aria-live="polite"></p></div>
      </div></div></div>`;
    const sel = el.querySelector("#covCity"), oth = el.querySelector("#covOther"), msg = el.querySelector("#covMsg");
    sel.addEventListener("change", () => { oth.hidden = sel.value !== "__other"; if (!oth.hidden) oth.focus(); });
    if (window.AGT && AGT.session) AGT.session().then((s) => { if (s && s.email && !el.querySelector("#covEmail").value) el.querySelector("#covEmail").value = s.email; }).catch(() => {});
    el.querySelector("#covForm").addEventListener("submit", async (e) => {
      e.preventDefault(); msg.className = "cov-msg"; msg.textContent = "";
      const city = sel.value === "__other" ? oth.value.trim() : sel.value, email = el.querySelector("#covEmail").value.trim(), btn = el.querySelector("#covGo");
      btn.disabled = true;
      try { const j = await AGT.api("/api/city-interest", { body: { city, email } }); msg.className = "cov-msg ok"; msg.textContent = j.message; }
      catch (x) { msg.className = "cov-msg err"; msg.textContent = x.message || "Something went wrong. Please try again."; }
      btn.disabled = false;
    });
  }

  function tiers(el) {
    el.innerHTML = `<div class="cov-tiers">${TIERS.map((t) => `<article class="cov-tier ${t.key}"><div class="k"><span class="nm">${esc(t.name)}</span><span class="st">${esc(t.state)}</span></div><p class="wh">${esc(t.where)}</p><ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></article>`).join("")}</div>`;
  }
  function strip(el) { el.innerHTML = `<div class="cov-strip"><i></i><span>High-precision coverage in Bengaluru · more cities being added in phases</span></div>`; }

  // ---------------------------------------------------------------- request-form city picker
  function picker(sel) {
    const cur = sel.value || LIVE;
    const names = CITIES.map((c) => c.name);
    const wrap = sel.parentNode, other = document.createElement("input"), note = document.createElement("div");
    const s2 = document.createElement("select"); s2.id = "city"; s2.name = "city";
    s2.innerHTML = names.map((n) => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("") + `<option value="__other">Another city…</option>`;
    other.id = "cityOther"; other.placeholder = "City name"; other.hidden = true; other.style.marginTop = "8px"; other.maxLength = 60;
    note.className = "cov-note"; note.setAttribute("aria-live", "polite");
    sel.replaceWith(s2); wrap.append(other, note);
    const upd = () => { const t = tierOf(s2.value === "__other" ? other.value : s2.value); other.hidden = s2.value !== "__other"; note.innerHTML = `<b>${NOTE[t][0]}</b>${esc(NOTE[t][1])}`; };
    s2.addEventListener("change", upd); other.addEventListener("input", upd); upd();
  }
  function cityValue() { const s = document.getElementById("city"); if (!s) return ""; return s.value === "__other" ? (document.getElementById("cityOther").value || "").trim() : s.value; }

  window.AGT_COVERAGE = { LIVE, CITIES, PHASES, TIERS, tierOf, cityValue };
  function init() {
    document.querySelectorAll('[data-coverage="band"]').forEach(band);
    document.querySelectorAll('[data-coverage="tiers"]').forEach(tiers);
    document.querySelectorAll('[data-coverage="strip"]').forEach(strip);
    const c = document.getElementById("city"); if (c && c.tagName === "INPUT") picker(c);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
