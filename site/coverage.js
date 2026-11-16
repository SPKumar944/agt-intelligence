/* Coverage & rollout: one source of truth for which cities are live, plus the components that show it. (No map is drawn on purpose.)
 *   [data-coverage="band"]   full section: map, what "high-precision" means, phases, "Which city next?" form  (home)
 *   [data-coverage="tiers"]  three-column tier comparison                                                      (pricing, methodology)
 *   [data-coverage="strip"]  one-line reminder                                                                 (sign-in)
 *   <select id="city">       request-form city picker with a note about the coverage tier                       (request form)
 * Edit CITIES / PHASES below to change what the site says — nothing else needs touching. */
(function () {
  "use strict";
  const LIVE = "Bengaluru";
  // phase: 1 live, 2 in build, 3 planned.
  const CITIES = [
    { name: "Bengaluru", phase: 1 },
    { name: "Hyderabad", phase: 2 },
    { name: "Chennai", phase: 2 },
    { name: "Pune", phase: 2 },
    { name: "Mumbai", phase: 3 },
    { name: "Delhi NCR", phase: 3 },
    { name: "Kolkata", phase: 3 },
    { name: "Ahmedabad", phase: 3 },
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

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tierOf = (city) => (String(city || "").trim().toLowerCase() === LIVE.toLowerCase() ? "high" : "std");
  const NOTE = {
    high: ["High-precision coverage", "Your report is built on our high-precision Bengaluru data and models."],
    std: ["Standard coverage", "We can analyse this city today on city-wide datasets. Local detail is coarser than in Bengaluru; high-precision coverage for more cities is being built in phases."],
  };

  // ---------------------------------------------------------------- styles (self-contained, theme-aware)
  const css = `
  .cov-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:center}
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
        <h2 class="h2">Built deep in Bengaluru.<br /><span class="dim">Expanding city by city.</span></h2>
        <p class="lede" style="font-size:18px">High-precision data and models for Bengaluru are live today. We are building the same depth for other Indian cities in phases — and reports for other cities are already available at standard coverage.</p>
        <ul class="cov-pts">${TIERS[0].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>
      <div>
        ${roll()}
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
