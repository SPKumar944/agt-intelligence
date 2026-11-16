/* Coverage & rollout components. Data: site/coverage-data.js (cities + tier dates). Outline: site/india-map.js (official Survey of India boundary).
 *   [data-coverage="band"]   home: map by tier, schedule, city lists, "Which city should we upgrade first?" form
 *   [data-coverage="tiers"]  three-column tier comparison   (pricing, methodology)
 *   [data-coverage="strip"]  one-line reminder              (sign-in)
 *   <input id="city">        request-form city picker with a note on coverage + upgrade date
 * To change a city's tier or a date, edit coverage-data.js only. */
(function () {
  "use strict";
  const R = window.AGT_ROLLOUT || { live: "Bengaluru", tiers: [], cities: [] };
  const LIVE = R.live, TIERS_R = R.tiers, ALL = R.cities;
  const tierInfo = (n) => TIERS_R.find((t) => t.n === n);
  const norm = (s) => String(s || "").trim().toLowerCase();
  const findCity = (name) => ALL.find((c) => norm(c.n) === norm(name));
  const countIn = (n) => ALL.filter((c) => c.t === n).length;
  const span = TIERS_R.length ? `${TIERS_R[0].short} – ${TIERS_R[TIERS_R.length - 1].short}` : "";

  const TIERS = [
    { key: "high", name: "Premium intelligence", where: "Bengaluru", state: "Live",
      points: ["Street-level modelling at 65 m resolution", "Demand calibrated to the city's own patterns", "Competition and complementary-business model tuned locally"] },
    { key: "std", name: "Pan-India insights", where: "Every other city in India", state: "Available now",
      points: ["Footfall, competitors, demographics and expansion candidates in the same dashboard", "Wide, city-level insights for any location you send us", "Upgraded to premium automatically as your city's tier goes live"] },
    { key: "next", name: "Premium everywhere", where: span, state: "Tier by tier",
      points: TIERS_R.map((t) => `${t.name} — ${t.kind.toLowerCase()}: by ${t.by}`) },
  ];

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tierOf = (city) => (norm(city) === norm(LIVE) ? "high" : "std");
  function noteFor(city) {
    if (tierOf(city) === "high") return ["Premium intelligence", "Your report is built on our premium, high-precision Bengaluru data and models."];
    const c = findCity(city), t = c && tierInfo(c.t);
    const when = t ? ` ${c.n} is in ${t.name} — premium upgrade by ${t.by}, and your report upgrades with it.` : " Premium, Bengaluru-level precision is coming to every city between " + span + ".";
    return ["Pan-India insights", "We cover this city today with wide, city-level insights — footfall, competitors, demographics and expansion candidates." + when];
  }

  // ---------------------------------------------------------------- styles (self-contained, theme-aware)
  const css = `
  .cov-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:start}
  .cov-map{position:relative;max-width:470px;width:100%;margin:0 auto}
  .cov-map svg{width:100%;height:auto;display:block;overflow:visible}
  .cov-india{fill:color-mix(in srgb,var(--ink) 9%,var(--bg));stroke:color-mix(in srgb,var(--ink) 30%,var(--bg));stroke-width:1.1;stroke-linejoin:round}
  .cov-dot-live{fill:var(--ink)} .cov-pulse{fill:none;stroke:var(--ink);stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:covp 2.6s ease-out infinite}
  .cov-sel{fill:var(--bg);stroke:var(--ink);stroke-width:1.6;stroke-dasharray:3 2.4}
  .cov-oth{fill:var(--ink-3);opacity:.55}
  .cov-lab{font:600 10.5px/1 var(--sans,system-ui);fill:var(--ink);paint-order:stroke;stroke:color-mix(in srgb,var(--ink) 9%,var(--bg));stroke-width:2.4px;stroke-linejoin:round}
  @keyframes covp{0%{transform:scale(1);opacity:.7}100%{transform:scale(4.2);opacity:0}}
  @media (prefers-reduced-motion:reduce){.cov-pulse{animation:none;opacity:.25}}
  .cov-tabs{display:flex;gap:6px;justify-content:center;margin:0 0 14px;flex-wrap:wrap}
  .cov-tabs button{border:0;border-radius:980px;padding:7px 14px;background:var(--bg);color:var(--ink-2);font:600 12.5px/1 inherit;cursor:pointer;box-shadow:0 0 0 1px var(--line-2)} .cov-tabs button[aria-pressed="true"]{background:var(--ink);color:var(--bg);box-shadow:none}
  .cov-legend{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;margin:18px 0 0;font-size:12.5px;color:var(--ink-2)}
  .cov-legend span{display:inline-flex;align-items:center;gap:8px} .cov-legend i{width:11px;height:11px;border-radius:50%;display:inline-block;box-sizing:border-box}
  .cov-legend .a{background:var(--ink)} .cov-legend .b{border:1.6px dashed var(--ink)} .cov-legend .c{background:var(--ink-3);opacity:.6;width:7px;height:7px} .cov-legend .d{border-radius:3px;background:color-mix(in srgb,var(--ink) 14%,var(--bg));border:1px solid color-mix(in srgb,var(--ink) 30%,var(--bg))}
  .cov-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
  .cov-box{border:1px solid var(--line);border-radius:16px;padding:16px 18px;background:var(--bg)} .cov-box.prem{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-box .tg{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)} .cov-box.prem .tg{color:var(--ink)}
  .cov-box ul{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px} .cov-box li{font-size:13.5px;color:var(--ink-2);line-height:1.45;padding-left:14px;position:relative} .cov-box li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:1px;background:var(--ink-3)}
  .cov-sched{display:grid;margin-top:26px;border-top:1px solid var(--line)}
  .cov-acc{border-bottom:1px solid var(--line)}
  .cov-hd{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:1fr auto 22px;gap:2px 14px;padding:14px 10px;align-items:center;width:100%}
  .cov-hd:hover{background:var(--bg-2)} .cov-acc.sel .cov-hd{box-shadow:inset 3px 0 0 var(--ink)} .cov-hd:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
  .cov-hd b{font-size:15px;font-weight:600;color:var(--ink)} .cov-hd small{grid-column:1;font-size:13px;color:var(--ink-3)}
  .cov-hd .by{grid-column:2;grid-row:1/3;text-align:right;font-size:13px;color:var(--ink-2);line-height:1.4} .cov-hd .by strong{display:block;color:var(--ink);font-weight:600}
  .cov-hd .chev{grid-column:3;grid-row:1/3;width:10px;height:10px;border-right:1.6px solid var(--ink-2);border-bottom:1.6px solid var(--ink-2);transform:rotate(45deg) translate(-2px,-2px);transition:transform .3s;justify-self:center}
  .cov-acc.open .chev{transform:rotate(-135deg) translate(-2px,-2px)}
  .cov-pane{display:grid;grid-template-rows:0fr;transition:grid-template-rows .38s cubic-bezier(.2,.7,.2,1)} .cov-acc.open .cov-pane{grid-template-rows:1fr}
  .cov-pane-in{overflow:hidden;min-height:0} .cov-pane-pad{padding:6px 10px 22px} .cov-pane .sub{color:var(--ink-2);font-size:14px;margin:0 0 16px}
  @media (prefers-reduced-motion:reduce){.cov-pane,.cov-hd .chev{transition:none}}
  .cov-sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px 22px}
  .cov-sg h4{margin:0 0 7px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
  .cov-sg .cs{display:flex;flex-wrap:wrap;gap:6px} .cov-sg .cs span{font-size:13.5px;border:1px solid var(--line-2);border-radius:980px;padding:4px 12px;color:var(--ink);background:var(--bg)} .cov-sg .cs span.live{background:var(--ink);color:var(--bg);border-color:var(--ink)}
  @media (max-width:600px){.cov-two{grid-template-columns:1fr}}
  .cov-ask{margin-top:30px;border:1px solid var(--line);border-radius:18px;padding:22px 24px;background:var(--bg)}
  .cov-ask h3{margin:0 0 4px;font-size:18px;letter-spacing:-.01em} .cov-ask p{margin:0 0 14px;font-size:14.5px;color:var(--ink-2)}
  .cov-ask form{display:grid;grid-template-columns:minmax(150px,1fr) minmax(0,1.3fr) auto;gap:10px} .cov-ask .oth{grid-column:1/3}
  .cov-ask input,.cov-ask select{font:inherit;font-size:14.5px;border:1px solid var(--line-2);border-radius:12px;padding:11px 13px;background:var(--bg);color:var(--ink);min-width:0}
  .cov-ask button{border:0;border-radius:980px;padding:0 22px;background:var(--ink);color:var(--bg);font:600 14px/1 inherit;cursor:pointer;height:44px}
  .cov-ask button[disabled]{opacity:.5} .cov-msg{margin:10px 0 0 !important;font-size:13.5px !important;min-height:18px} .cov-msg.ok{color:#17653a !important} .cov-msg.err{color:#b42318 !important}
  :root[data-theme="dark"] .cov-msg.ok{color:#7fd6a2 !important} :root[data-theme="dark"] .cov-msg.err{color:#f0a39b !important}
  .cov-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .cov-tier{border:1px solid var(--line);border-radius:18px;padding:26px;background:var(--bg);display:flex;flex-direction:column;gap:10px} .cov-tier.high{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-tier .k{display:flex;justify-content:space-between;gap:8px 10px;align-items:center;flex-wrap:wrap} .cov-tier .nm{font-size:19px;font-weight:600;letter-spacing:-.01em}
  .cov-tier .st{font-size:12px;font-weight:600;border-radius:980px;padding:3px 11px;background:var(--bg-3);color:var(--ink-2)} .cov-tier.high .st{background:var(--ink);color:var(--bg)}
  .cov-tier .wh{font-size:14px;color:var(--ink-3);margin:0} .cov-tier ul{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:9px} .cov-tier li{font-size:14.5px;color:var(--ink-2);padding-left:18px;position:relative;line-height:1.5} .cov-tier li::before{content:"";position:absolute;left:0;top:9px;width:6px;height:1px;background:var(--ink-3)}
  .cov-strip{font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:10px;margin:18px 0 0} .cov-strip i{width:8px;height:8px;border-radius:50%;background:var(--ink);display:inline-block;flex:none}
  .stage .cov-strip{color:rgba(255,255,255,.78);margin-top:22px} .stage .cov-strip i{background:#fff}
  .cov-note{margin-top:8px;font-size:13.5px;color:var(--ink-2);border-radius:12px;background:var(--bg-2);padding:11px 14px;line-height:1.5} .cov-note b{color:var(--ink);display:block;margin-bottom:2px;font-size:13px}
  @media (max-width:900px){.cov-grid{grid-template-columns:1fr;gap:34px}.cov-tiers{grid-template-columns:1fr}.cov-ask form{grid-template-columns:1fr}.cov-ask .oth{grid-column:auto}.cov-ask button{height:46px}}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------------------------------------------------------------- map
  function placeLabels(cities, at) {
    const boxes = [], dots = cities.map((c) => at(c.x, c.y)), out = new Map();
    const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || dots.some(([dx, dy]) => dx > b[0] - 3 && dx < b[2] + 3 && dy > b[1] - 3 && dy < b[3] + 3);
    cities.forEach((c, i) => {
      const [x, y] = dots[i], w = c.n.length * 5.7 + 3, h = 11;
      const opts = [["start", x + 8, y + 3.6, [x + 7, y - 5.5, x + 9 + w, y + 5.5]], ["end", x - 8, y + 3.6, [x - 9 - w, y - 5.5, x - 7, y + 5.5]],
                    ["middle", x, y - 8, [x - w / 2, y - 18, x + w / 2, y - 7]], ["middle", x, y + 15, [x - w / 2, y + 6, x + w / 2, y + 17]]];
      for (const [anchor, tx, ty, box] of opts) if (!hit(box)) { boxes.push(box); out.set(c, [anchor, tx, ty]); break; }
    });
    return out;
  }
  function mapSvg(sel) {
    const M = window.AGT_INDIA_MAP; if (!M) return "";
    const q = M.proj, rad = Math.PI / 180;
    const at = (lon, lat) => { const r = Math.sqrt(q.C - 2 * q.n * Math.sin(lat * rad)) / q.n, th = q.n * (lon - q.lon0) * rad; return [(r * Math.sin(th) - q.minx) * q.sc, (q.maxy - (q.rho0 - r * Math.cos(th))) * q.sc]; };
    const f = (v) => v.toFixed(1), ti = tierInfo(sel);
    const chosen = ALL.filter((c) => c.t === sel), others = ALL.filter((c) => c.t !== sel && norm(c.n) !== norm(LIVE));
    const live = ALL.find((c) => norm(c.n) === norm(LIVE));
    const labelled = [live, ...chosen.filter((c) => c !== live)].filter(Boolean), pos = placeLabels(labelled, at);
    const tip = (c) => { const t = tierInfo(c.t); return `<title>${esc(c.n)}, ${esc(c.s)} · ${c === live ? "Premium · live" : esc(t.name) + " — upgrade by " + esc(t.by)}</title>`; };
    let g = others.map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="cov-oth" cx="${f(x)}" cy="${f(y)}" r="${c.t >= 3 ? 1.9 : 2.4}">${tip(c)}</circle>`; }).join("");
    g += chosen.filter((c) => c !== live).map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="cov-sel" cx="${f(x)}" cy="${f(y)}" r="4">${tip(c)}</circle>`; }).join("");
    if (live) { const [x, y] = at(live.x, live.y); g += `<circle class="cov-pulse" cx="${f(x)}" cy="${f(y)}" r="5"/><circle class="cov-dot-live" cx="${f(x)}" cy="${f(y)}" r="5.5">${tip(live)}</circle>`; }
    g += labelled.map((c) => { const p = pos.get(c); return p ? `<text class="cov-lab" x="${f(p[1])}" y="${f(p[2])}" text-anchor="${p[0]}">${esc(c.n)}</text>` : ""; }).join("");
    const [, , w, h] = M.viewBox.split(" ").map(Number);
    return `<svg viewBox="-14 -10 ${w + 28} ${h + 20}" role="img" aria-label="Map of India. All of India is covered with city-level insights. Bengaluru has premium intelligence. ${esc(ti.name)} cities, ${chosen.length} in all, are highlighted and upgrade to premium by ${esc(ti.by)}."><path class="cov-india" d="${M.path}"/>${g}</svg>`;
  }

  function statesPanel(sel) {
    const ti = tierInfo(sel), by = {};
    ALL.filter((c) => c.t === sel).forEach((c) => (by[c.s] = by[c.s] || []).push(c));
    const states = Object.keys(by).sort();
    return `<p class="sub">${countIn(sel)} cities across ${states.length} states and territories — premium upgrade by <b>${esc(ti.by)}</b>.</p>
      <div class="cov-sg">${states.map((s) => `<div><h4>${esc(s)}</h4><div class="cs">${by[s].map((c) => `<span class="${norm(c.n) === norm(LIVE) ? "live" : ""}">${esc(c.n)}${norm(c.n) === norm(LIVE) ? " · live" : ""}</span>`).join("")}</div></div>`).join("")}</div>`;
  }

  function optionGroups(skipLive) {
    return TIERS_R.map((t) => `<optgroup label="${esc(t.name)} · by ${esc(t.by)}">${ALL.filter((c) => c.t === t.n && !(skipLive && norm(c.n) === norm(LIVE))).sort((a, b) => a.n.localeCompare(b.n)).map((c) => `<option value="${esc(c.n)}">${esc(c.n)}${norm(c.n) === norm(LIVE) ? " (premium · live)" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  function band(el) {
    let sel = 1;
    el.innerHTML = `<div class="wrap"><div class="cov-grid">
      <div>
        <p class="eyebrow">Coverage</p>
        <h2 class="h2">All of India, today.<br /><span class="dim">Premium precision — starting with Bengaluru.</span></h2>
        <p class="lede" style="font-size:18px">We cover every Indian city right now with wide, city-level insights. Bengaluru runs at our premium, high-precision level — and every other city is being upgraded to the same standard, tier by tier, from ${esc(TIERS_R[0].short.replace(" 20", " 20"))} to ${esc(TIERS_R[TIERS_R.length - 1].short)}.</p>
        <div class="cov-two">
          <div class="cov-box prem"><span class="tg">Premium · Bengaluru</span><ul>${TIERS[0].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
          <div class="cov-box"><span class="tg">Pan-India · other cities</span><ul>${TIERS[1].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
        </div>
        <div class="cov-sched" id="covSched" role="group" aria-label="Upgrade schedule by tier. Select a tier to see its cities.">${TIERS_R.map((t) => `<div class="cov-acc" data-t="${t.n}"><button type="button" class="cov-hd" aria-expanded="false" aria-controls="covp${t.n}"><b>${esc(t.name)} · ${esc(t.kind)}</b><small>${countIn(t.n)} cities · tap to see them</small><span class="by">Premium by<strong>${esc(t.by)}</strong></span><i class="chev" aria-hidden="true"></i></button><div class="cov-pane" id="covp${t.n}" role="region"><div class="cov-pane-in"><div class="cov-pane-pad">${statesPanel(t.n)}</div></div></div></div>`).join("")}</div>
      </div>
      <div>
        <div class="cov-tabs" id="covTabs" role="group" aria-label="Show tier on map">${TIERS_R.map((t) => `<button type="button" data-t="${t.n}" aria-pressed="${t.n === sel}">${esc(t.name)}</button>`).join("")}</div>
        <div class="cov-map"><div id="covSvg"></div><div class="cov-legend"><span><i class="a"></i>Premium · live</span><span><i class="b"></i><span id="covLegSel"></span></span><span><i class="c"></i>Other tiers</span><span><i class="d"></i>Covered across India</span></div></div>
        <div class="cov-ask"><h3>Which city should we upgrade first?</h3><p>Tell us where you need premium, Bengaluru-level precision. It helps us decide the order within each tier — and we'll email you the moment it's ready.</p>
          <form id="covForm" novalidate>
            <select id="covCity" aria-label="City">${optionGroups(true)}<option value="__other">Another city…</option></select>
            <input id="covEmail" type="email" placeholder="Your email" autocomplete="email" aria-label="Your email" />
            <button type="submit" id="covGo">Notify me</button>
            <input id="covOther" class="oth" placeholder="City name" aria-label="City name" hidden />
          </form><p class="cov-msg" id="covMsg" role="status" aria-live="polite"></p></div>
      </div></div></div>`;
    let open = 0;
    const draw = () => {
      el.querySelector("#covSvg").innerHTML = mapSvg(sel);
      el.querySelector("#covLegSel").textContent = `${tierInfo(sel).name} · by ${tierInfo(sel).short}`;
      el.querySelectorAll("#covTabs [data-t]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.t === sel));
      el.querySelectorAll(".cov-acc").forEach((a) => { const n = +a.dataset.t, isOpen = n === open; a.classList.toggle("open", isOpen); a.classList.toggle("sel", n === sel); a.querySelector(".cov-hd").setAttribute("aria-expanded", isOpen); a.querySelector(".cov-hd small").textContent = `${countIn(n)} cities · ${isOpen ? "tap to hide" : "tap to see them"}`; });
    };
    // a schedule row selects the tier on the map and steps its city list down (tap again to fold it away)
    el.querySelectorAll(".cov-acc .cov-hd").forEach((b) => b.addEventListener("click", () => { const n = +b.closest(".cov-acc").dataset.t; open = open === n ? 0 : n; sel = n; draw(); }));
    // a tab above the map does the same, and brings the list into view
    el.querySelectorAll("#covTabs [data-t]").forEach((b) => b.addEventListener("click", () => {
      sel = open = +b.dataset.t; draw();
      const row = el.querySelector(`.cov-acc[data-t="${sel}"] .cov-hd`), r = row.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 40) row.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }));
    draw();
    const sl = el.querySelector("#covCity"), oth = el.querySelector("#covOther"), msg = el.querySelector("#covMsg");
    sl.addEventListener("change", () => { oth.hidden = sl.value !== "__other"; if (!oth.hidden) oth.focus(); });
    if (window.AGT && AGT.session) AGT.session().then((s) => { if (s && s.email && !el.querySelector("#covEmail").value) el.querySelector("#covEmail").value = s.email; }).catch(() => {});
    el.querySelector("#covForm").addEventListener("submit", async (e) => {
      e.preventDefault(); msg.className = "cov-msg"; msg.textContent = "";
      const city = sl.value === "__other" ? oth.value.trim() : sl.value, email = el.querySelector("#covEmail").value.trim(), btn = el.querySelector("#covGo");
      btn.disabled = true;
      try { const j = await AGT.api("/api/city-interest", { body: { city, email } }); msg.className = "cov-msg ok"; msg.textContent = j.message; }
      catch (x) { msg.className = "cov-msg err"; msg.textContent = x.message || "Something went wrong. Please try again."; }
      btn.disabled = false;
    });
  }

  function tiers(el) {
    el.innerHTML = `<div class="cov-tiers">${TIERS.map((t) => `<article class="cov-tier ${t.key}"><div class="k"><span class="nm">${esc(t.name)}</span><span class="st">${esc(t.state)}</span></div><p class="wh">${esc(t.where)}</p><ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></article>`).join("")}</div>`;
  }
  function strip(el) { el.innerHTML = `<div class="cov-strip"><i></i><span>Premium intelligence in Bengaluru · pan-India insights everywhere · every city upgrading ${esc(span)}</span></div>`; }

  // ---------------------------------------------------------------- request-form city picker
  function picker(inp) {
    const wrap = inp.parentNode, other = document.createElement("input"), note = document.createElement("div"), s2 = document.createElement("select");
    s2.id = "city"; s2.name = "city";
    s2.innerHTML = optionGroups(false) + `<option value="__other">Another city…</option>`; s2.value = LIVE;
    other.id = "cityOther"; other.placeholder = "City name"; other.hidden = true; other.style.marginTop = "8px"; other.maxLength = 60;
    note.className = "cov-note"; note.setAttribute("aria-live", "polite");
    inp.replaceWith(s2); wrap.append(other, note);
    const upd = () => { const v = s2.value === "__other" ? other.value : s2.value, n = noteFor(v); other.hidden = s2.value !== "__other"; note.innerHTML = `<b>${esc(n[0])}</b>${esc(n[1])}`; };
    s2.addEventListener("change", upd); other.addEventListener("input", upd); upd();
  }
  function cityValue() { const s = document.getElementById("city"); if (!s) return ""; return s.value === "__other" ? (document.getElementById("cityOther").value || "").trim() : s.value; }

  window.AGT_COVERAGE = { LIVE, tierOf, cityValue, findCity };
  function init() {
    document.querySelectorAll('[data-coverage="band"]').forEach(band);
    document.querySelectorAll('[data-coverage="tiers"]').forEach(tiers);
    document.querySelectorAll('[data-coverage="strip"]').forEach(strip);
    const c = document.getElementById("city"); if (c && c.tagName === "INPUT") picker(c);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
