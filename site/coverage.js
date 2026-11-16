/* Coverage & rollout: one source of truth for which cities are live, plus the components that show it. The India outline lives in site/india-map.js (official Survey of India boundary).
 *   [data-coverage="band"]   full section: map, what "high-precision" means, phases, "Which city next?" form  (home)
 *   [data-coverage="tiers"]  three-column tier comparison                                                      (pricing, methodology)
 *   [data-coverage="strip"]  one-line reminder                                                                 (sign-in)
 *   <select id="city">       request-form city picker with a note about the coverage tier                       (request form)
 * Edit CITIES / PHASES below to change what the site says — nothing else needs touching. */
(function () {
  "use strict";
  const LIVE = "Bengaluru";
  // phase: 1 live, 2 in build, 3 planned. lon/lat only place the dot on the map; label = side the name sits on.
  const CITIES = [
    { name: "Bengaluru", lon: 77.59, lat: 12.97, label: "l", phase: 1 },
    { name: "Hyderabad", lon: 78.49, lat: 17.39, label: "r", phase: 2 },
    { name: "Chennai", lon: 80.27, lat: 13.08, label: "r", phase: 2 },
    { name: "Pune", lon: 73.86, lat: 18.52, label: "r", phase: 2 },
    { name: "Mumbai", lon: 72.88, lat: 19.08, label: "l", phase: 3 },
    { name: "Delhi NCR", lon: 77.21, lat: 28.61, label: "r", phase: 3 },
    { name: "Kolkata", lon: 88.36, lat: 22.57, label: "r", phase: 3 },
    { name: "Ahmedabad", lon: 72.57, lat: 23.02, label: "l", phase: 3 },
  ];
  const PHASES = [
    { n: 1, status: "Premium · live", text: "Bengaluru — premium, high-precision intelligence." },
    { n: 2, status: "Upgrading soon", text: "Hyderabad, Chennai and Pune." },
    { n: 3, status: "Upgrading next", text: "Mumbai, Delhi NCR, Kolkata and Ahmedabad." },
  ];
  const TIERS = [
    { key: "high", name: "Premium intelligence", where: "Bengaluru", state: "Live",
      points: ["Street-level modelling at 65 m resolution", "Demand calibrated to the city's own patterns", "Competition and complementary-business model tuned locally"] },
    { key: "std", name: "Pan-India insights", where: "Every other city in India", state: "Available now",
      points: ["Footfall, competitors, demographics and expansion candidates in the same dashboard", "Wide, city-level insights for any location you send us", "Upgraded to premium automatically as your city goes live"] },
    { key: "next", name: "Premium everywhere", where: "All cities, city by city", state: "Coming very soon",
      points: ["Every city is being brought up to the Bengaluru standard", "Order of cities follows demand", "Tell us which city to upgrade first"] },
  ];

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tierOf = (city) => (String(city || "").trim().toLowerCase() === LIVE.toLowerCase() ? "high" : "std");
  const NOTE = {
    high: ["Premium intelligence", "Your report is built on our premium, high-precision Bengaluru data and models."],
    std: ["Pan-India insights", "We cover this city today with wide, city-level insights — footfall, competitors, demographics and expansion candidates. Premium, Bengaluru-level precision is coming to every city very soon, and your report upgrades with it."],
  };

  // ---------------------------------------------------------------- styles (self-contained, theme-aware)
  const css = `
  .cov-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:center}
  .cov-map{position:relative;max-width:440px;width:100%;margin:0 auto}
  .cov-map svg{width:100%;height:auto;display:block;overflow:visible}
  .cov-india{fill:color-mix(in srgb,var(--ink) 9%,var(--bg));stroke:color-mix(in srgb,var(--ink) 30%,var(--bg));stroke-width:1.1;stroke-linejoin:round}
  .cov-dot-live{fill:var(--ink)} .cov-pulse{fill:none;stroke:var(--ink);stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:covp 2.6s ease-out infinite}
  .cov-dot-2{fill:var(--bg);stroke:var(--ink);stroke-width:1.6;stroke-dasharray:3 2.4} .cov-dot-3{fill:var(--bg);stroke:var(--ink);stroke-width:1.6;stroke-dasharray:3 2.4}
  .cov-lab{font:600 11px/1 var(--sans,system-ui);fill:var(--ink)} .cov-lab.dim{fill:var(--ink-2);font-weight:500}
  @keyframes covp{0%{transform:scale(1);opacity:.7}100%{transform:scale(4.2);opacity:0}}
  @media (prefers-reduced-motion:reduce){.cov-pulse{animation:none;opacity:.25}}
  .cov-legend{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;margin:20px 0 0;font-size:12.5px;color:var(--ink-2)}
  .cov-legend span{display:inline-flex;align-items:center;gap:8px} .cov-legend i{width:11px;height:11px;border-radius:50%;display:inline-block;box-sizing:border-box}
  .cov-legend .a{background:var(--ink)} .cov-legend .b{border:1.6px dashed var(--ink)} .cov-legend .c{border:1.4px dashed var(--ink-3)} .cov-legend .d{border-radius:3px;background:color-mix(in srgb,var(--ink) 14%,var(--bg));border:1px solid color-mix(in srgb,var(--ink) 30%,var(--bg))}
  .cov-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
  .cov-box{border:1px solid var(--line);border-radius:16px;padding:16px 18px;background:var(--bg)} .cov-box.prem{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-box .tg{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)} .cov-box.prem .tg{color:var(--ink)}
  .cov-box ul{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px} .cov-box li{font-size:13.5px;color:var(--ink-2);line-height:1.45;padding-left:14px;position:relative} .cov-box li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:1px;background:var(--ink-3)}
  @media (max-width:600px){.cov-two{grid-template-columns:1fr}}
  .cov-roll{display:grid;border-top:1px solid var(--line)}
  .cov-row{padding:20px 0;border-bottom:1px solid var(--line);display:grid;gap:12px}
  .cov-row .rh{display:flex;justify-content:space-between;align-items:center;gap:10px} .cov-row .rh b{font-size:15px;font-weight:600;color:var(--ink)}
  .cov-row .st{font-size:12px;font-weight:600;border-radius:980px;padding:3px 11px;background:var(--bg-3);color:var(--ink-2);white-space:nowrap} .cov-row.live .st{background:var(--ink);color:var(--bg)}
  .chipsr{display:flex;flex-wrap:wrap;gap:8px}
  .cchip{font-size:14px;font-weight:500;border-radius:980px;padding:7px 15px;border:1px solid var(--line-2);color:var(--ink-2);background:var(--bg)}
  .cchip.p1{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600;font-size:15px;padding:9px 18px} .cchip.p2{border-style:dashed;border-color:var(--ink);color:var(--ink)} .cchip.p3{border-style:dashed;color:var(--ink-3)}
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
  @media (max-width:900px){.cov-grid{grid-template-columns:1fr;gap:34px}.cov-tiers{grid-template-columns:1fr}.cov-ask form{grid-template-columns:1fr}.cov-ask .oth{grid-column:auto}.cov-ask button{height:46px}}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------------------------------------------------------------- map (official boundary from site/india-map.js; Albers equal-area)
  function mapSvg() {
    const M = window.AGT_INDIA_MAP; if (!M) return "";
    const q = M.proj, rad = Math.PI / 180;
    const at = (lon, lat) => { const r = Math.sqrt(q.C - 2 * q.n * Math.sin(lat * rad)) / q.n, th = q.n * (lon - q.lon0) * rad; return [((r * Math.sin(th) - q.minx) * q.sc).toFixed(1), ((q.maxy - (q.rho0 - r * Math.cos(th))) * q.sc).toFixed(1)]; };
    const dots = CITIES.slice().sort((a, b) => b.phase - a.phase).map((c) => {
      const [x, y] = at(c.lon, c.lat), left = c.label === "l", tx = left ? +x - 11 : +x + 11;
      const mark = c.phase === 1 ? `<circle class="cov-pulse" cx="${x}" cy="${y}" r="5"/><circle class="cov-dot-live" cx="${x}" cy="${y}" r="5.5"/>` : `<circle class="cov-dot-${c.phase}" cx="${x}" cy="${y}" r="5"/>`;
      return `<g>${mark}<text class="cov-lab ${c.phase === 1 ? "" : "dim"}" x="${tx}" y="${+y + 4}" text-anchor="${left ? "end" : "start"}">${esc(c.name)}</text></g>`;
    }).join("");
    return `<svg viewBox="-12 -8 ${M.viewBox.split(" ")[2] * 1 + 24} ${M.viewBox.split(" ")[3] * 1 + 16}" role="img" aria-label="Map of India. All of India is covered with city-level insights. Bengaluru has premium, high-precision intelligence; Hyderabad, Chennai, Pune, Mumbai, Delhi NCR, Kolkata and Ahmedabad are being upgraded to premium."><path class="cov-india" d="${M.path}"/>${dots}</svg>`;
  }

  // ---------------------------------------------------------------- rollout (deliberately no map: no geography is drawn)
  function roll() {
    const cityOf = (n) => CITIES.filter((c) => c.phase === n);
    return `<div class="cov-roll">${PHASES.map((p) => `<div class="cov-row ${p.n === 1 ? "live" : ""}"><div class="rh"><b>Phase ${p.n}</b><span class="st">${esc(p.status)}</span></div>
      <div class="chipsr">${cityOf(p.n).map((c) => `<span class="cchip p${p.n}">${esc(c.name)}</span>`).join("")}</div></div>`).join("")}</div>`;
  }

  function band(el) {
    const others = CITIES.filter((c) => c.name !== LIVE).map((c) => c.name);
    el.innerHTML = `<div class="wrap"><div class="cov-grid">
      <div>
        <p class="eyebrow">Coverage</p>
        <h2 class="h2">All of India, today.<br /><span class="dim">Premium precision — starting with Bengaluru.</span></h2>
        <p class="lede" style="font-size:18px">We cover every Indian city right now with wide, city-level insights. Bengaluru runs at our premium, high-precision level — and every other city is being upgraded to the same standard, very soon.</p>
        <div class="cov-two">
          <div class="cov-box prem"><span class="tg">Premium · Bengaluru</span><ul>${TIERS[0].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
          <div class="cov-box"><span class="tg">Pan-India · other cities</span><ul>${TIERS[1].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
        </div>
        <div style="margin-top:26px">${roll()}</div>
      </div>
      <div>
        <div class="cov-map">${mapSvg()}<div class="cov-legend"><span><i class="a"></i>Premium · live</span><span><i class="b"></i>Upgrading to premium</span><span><i class="d"></i>Available across India</span></div></div>
        <div class="cov-ask"><h3>Which city should we upgrade first?</h3><p>Tell us where you need premium, Bengaluru-level precision. It helps us decide the order — and we'll email you the moment it's ready.</p>
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
  function strip(el) { el.innerHTML = `<div class="cov-strip"><i></i><span>Premium intelligence in Bengaluru · pan-India insights everywhere · every city being upgraded soon</span></div>`; }

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
