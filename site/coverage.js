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
  // Published city briefs (site/briefs.js). A city has one when its slug is listed.
  const briefSlugs = () => (Array.isArray(window.AGT_BRIEFS) ? window.AGT_BRIEFS.map((b) => b.slug) : (R.briefs || []));
  const slugOf = (c) => norm(c.n).replace(/\s+/g, "-");
  const hasBrief = (c) => briefSlugs().includes(slugOf(c));
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
  .cov-map{--ca:4%;--cb:11%} :root[data-theme="dark"] .cov-map{--ca:10%;--cb:20%}
  .cov-map svg{filter:drop-shadow(0 14px 22px rgba(0,0,0,.09))}
  .cov-india{fill:url(#covLand);stroke:color-mix(in srgb,var(--ink) 24%,var(--bg));stroke-width:.8;stroke-linejoin:round}
  .cov-o{fill:var(--ink);pointer-events:none} .cov-halo{fill:var(--ink);opacity:.12;pointer-events:none} .cov-s{fill:var(--ink);stroke:var(--bg);stroke-width:1.4;pointer-events:none} .cov-live{fill:var(--ink);stroke:var(--bg);stroke-width:1.8;pointer-events:none}
  .cov-pt{fill:transparent;cursor:pointer} .cov-pulse{fill:none;stroke:var(--ink);stroke-width:1;transform-box:fill-box;transform-origin:center;animation:covp 2.8s ease-out infinite;pointer-events:none}
  .cov-lab{font:500 10px/1 var(--sans,system-ui);letter-spacing:.01em;fill:var(--ink);paint-order:stroke;stroke:color-mix(in srgb,var(--ink) 7%,var(--bg));stroke-width:2.6px;stroke-linejoin:round;pointer-events:none} .cov-lab.lv{font-weight:700;font-size:11px}
  @keyframes covp{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.6);opacity:0}}
  @media (prefers-reduced-motion:reduce){.cov-pulse{animation:none;opacity:.2}}
  .cov-bring{fill:none;stroke:var(--ink);stroke-width:1.2;pointer-events:none} .cov-pt-brief{cursor:pointer} .cov-pt-brief:focus{outline:none} .cov-pt-brief:focus-visible{stroke:var(--ink);stroke-width:1.5;fill:color-mix(in srgb,var(--ink) 12%,transparent)}
  .cov-lab.bl{font-weight:700;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
  .cov-tip em.bf{opacity:1;margin-top:6px;padding-top:6px;border-top:1px solid color-mix(in srgb,var(--bg) 30%,transparent);font-weight:600}
  .cov-legend .e{background:transparent;border:1.4px solid var(--ink);width:11px;height:11px;box-shadow:inset 0 0 0 2.4px var(--bg),inset 0 0 0 6px var(--ink)}
  .cov-tip{position:absolute;z-index:3;pointer-events:none;background:var(--ink);color:var(--bg);border-radius:10px;padding:8px 12px;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.22);opacity:0;transform:translate(-50%,-100%) translateY(-8px);transition:opacity .15s;white-space:nowrap} .cov-tip.on{opacity:1} .cov-tip b{display:block;font-size:13px;font-weight:600} .cov-tip em{display:block;font-style:normal;opacity:.7;margin-top:2px}
  .cov-tabs{display:flex;gap:6px;justify-content:center;margin:0 0 14px;flex-wrap:wrap}
  .cov-tabs button{border:0;border-radius:980px;padding:7px 14px;background:var(--bg);color:var(--ink-2);font:600 12.5px/1 inherit;cursor:pointer;box-shadow:0 0 0 1px var(--line-2)} .cov-tabs button[aria-pressed="true"]{background:var(--ink);color:var(--bg);box-shadow:none}
  .cov-legend{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;margin:18px 0 0;font-size:12.5px;color:var(--ink-2)}
  .cov-legend span{display:inline-flex;align-items:center;gap:8px} .cov-legend i{width:11px;height:11px;border-radius:50%;display:inline-block;box-sizing:border-box}
  .cov-legend .a{background:var(--ink);box-shadow:0 0 0 3px color-mix(in srgb,var(--ink) 14%,transparent)} .cov-legend .b{background:var(--ink);width:8px;height:8px;box-shadow:0 0 0 3px color-mix(in srgb,var(--ink) 12%,transparent)} .cov-legend .c{background:var(--ink);opacity:.35;width:5px;height:5px} .cov-legend .d{border-radius:3px;background:color-mix(in srgb,var(--ink) 10%,var(--bg));border:1px solid color-mix(in srgb,var(--ink) 24%,var(--bg))}
  .cov-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
  .cov-box{border:1px solid var(--line);border-radius:16px;padding:16px 18px;background:var(--bg)} .cov-box.prem{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-box .tg{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)} .cov-box.prem .tg{color:var(--ink)}
  .cov-box ul{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px} .cov-box li{font-size:13.5px;color:var(--ink-2);line-height:1.45;padding-left:14px;position:relative} .cov-box li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:1px;background:var(--ink-3)}
  .cov-t4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:52px}
  .cov-tb{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:3px;padding:18px 20px;border:1px solid var(--line);border-radius:16px;background:var(--bg);position:relative;transition:border-color .2s,box-shadow .2s,transform .2s}
  .cov-tb:hover{border-color:var(--line-2);transform:translateY(-1px)} .cov-tb:focus-visible{outline:2px solid var(--ink);outline-offset:2px} .cov-tb.sel{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
  .cov-tb .n{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)} .cov-tb.sel .n{color:var(--ink)} .cov-tb b{font-size:16px;font-weight:600;color:var(--ink);letter-spacing:-.01em;padding-right:22px}
  .cov-tb small{font-size:13px;color:var(--ink-3)} .cov-tb .by{font-size:13px;color:var(--ink-2);margin-top:8px} .cov-tb .by strong{color:var(--ink);font-weight:600}
  .cov-tb .chev{position:absolute;right:18px;top:20px;width:9px;height:9px;border-right:1.6px solid var(--ink-2);border-bottom:1.6px solid var(--ink-2);transform:rotate(45deg);transition:transform .3s}
  .cov-tb.open .chev{transform:rotate(-135deg) translate(-2px,-2px)}
  .cov-drop{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.2,.7,.2,1)} .cov-drop.open{grid-template-rows:1fr}
  .cov-drop-in{overflow:hidden;min-height:0} .cov-drop-pad{margin-top:12px;border:1px solid var(--line);border-radius:18px;background:var(--bg-2);padding:26px 28px 30px}
  .cov-drop-pad .hd{display:flex;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;align-items:baseline;margin:0 0 22px} .cov-drop-pad .hd h3{margin:0;font-size:20px;letter-spacing:-.015em} .cov-drop-pad .hd span{font-size:14px;color:var(--ink-2)} .cov-drop-pad .hd strong{color:var(--ink)}
  @media (prefers-reduced-motion:reduce){.cov-drop,.cov-tb,.cov-tb .chev{transition:none}}
  @media (max-width:900px){.cov-t4{grid-template-columns:1fr 1fr}} @media (max-width:520px){.cov-t4{grid-template-columns:1fr}}
  .cov-sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:20px 26px}
  .cov-sg h4{margin:0 0 7px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
  .cov-sg .cs{display:flex;flex-wrap:wrap;gap:6px} .cov-sg .cs span{font-size:13.5px;border:1px solid var(--line-2);border-radius:980px;padding:4px 12px;color:var(--ink);background:var(--bg)} .cov-sg .cs a.brief{font-size:13.5px;border:1px solid var(--ink);border-radius:980px;padding:4px 12px;color:var(--ink);background:var(--bg);text-decoration:none;font-weight:600} .cov-sg .cs a.brief em{font-style:normal;font-weight:500;color:var(--ink-3);font-size:12px;margin-left:4px} .cov-sg .cs a.brief:hover{background:var(--ink);color:var(--bg)} .cov-sg .cs a.brief:hover em{color:inherit}
  .cov-sg .cs span.live{background:var(--ink);color:var(--bg);border-color:var(--ink)}
  @media (max-width:600px){.cov-two{grid-template-columns:1fr}}
  .cov-ask{margin-top:30px;border:1px solid var(--line);border-radius:18px;padding:24px 28px;background:var(--bg);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px 40px;align-items:center}
  .cov-ask h3{margin:0 0 6px;font-size:19px;letter-spacing:-.01em} .cov-ask p{margin:0;font-size:14.5px;color:var(--ink-2)} .cov-ask .fm{min-width:0} .cov-ask .fm .cov-msg{grid-column:auto}
  .cov-ask form{display:grid;grid-template-columns:minmax(140px,1fr) minmax(0,1.2fr) auto;gap:10px} .cov-ask .oth{grid-column:1/3}
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
  @media (max-width:900px){.cov-grid{grid-template-columns:1fr;gap:34px}.cov-tiers{grid-template-columns:1fr}.cov-ask{grid-template-columns:1fr}.cov-ask form{grid-template-columns:1fr}.cov-ask .oth{grid-column:auto}.cov-ask button{height:46px}}
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
    const chosen = ALL.filter((c) => c.t === sel && norm(c.n) !== norm(LIVE)), others = ALL.filter((c) => c.t !== sel && norm(c.n) !== norm(LIVE));
    const live = ALL.find((c) => norm(c.n) === norm(LIVE));
    const briefCities = ALL.filter((c) => hasBrief(c) && c !== live);
    const labelled = [live, ...chosen, ...briefCities.filter((c) => !chosen.includes(c))].filter(Boolean), pos = placeLabels(labelled, at);
    const idxOf = (c) => ALL.indexOf(c), hit = (c, x, y) => `<circle class="cov-pt" cx="${f(x)}" cy="${f(y)}" r="8" data-i="${idxOf(c)}"/>`;
    const fade = { 1: .5, 2: .42, 3: .34, 4: .28 };
    let g = others.map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="cov-o" cx="${f(x)}" cy="${f(y)}" r="1.5" opacity="${fade[c.t] || .3}"/>${hit(c, x, y)}`; }).join("");
    g += chosen.map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="cov-halo" cx="${f(x)}" cy="${f(y)}" r="6.5"/><circle class="cov-s" cx="${f(x)}" cy="${f(y)}" r="3"/>${hit(c, x, y)}`; }).join("");
    if (live) { const [x, y] = at(live.x, live.y); g += `<circle class="cov-halo" cx="${f(x)}" cy="${f(y)}" r="10"/><circle class="cov-pulse" cx="${f(x)}" cy="${f(y)}" r="5"/><circle class="cov-live" cx="${f(x)}" cy="${f(y)}" r="4.6"/>${hit(live, x, y)}`; }
    // cities with a published brief: always drawn as a ringed, clickable point on top, whichever tier is selected
    g += briefCities.map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="cov-halo" cx="${f(x)}" cy="${f(y)}" r="8"/><circle class="cov-bring" cx="${f(x)}" cy="${f(y)}" r="6"/><circle class="cov-s" cx="${f(x)}" cy="${f(y)}" r="3.2"/><circle class="cov-pt cov-pt-brief" cx="${f(x)}" cy="${f(y)}" r="10" data-i="${idxOf(c)}" data-brief="${slugOf(c)}" tabindex="0" role="link" aria-label="Open the ${esc(c.n)} city brief"/>`; }).join("");
    g += labelled.map((c) => { const p = pos.get(c); return p ? `<text class="cov-lab${c === live ? " lv" : ""}${hasBrief(c) ? " bl" : ""}" x="${f(p[1])}" y="${f(p[2])}" text-anchor="${p[0]}">${esc(c.n)}${hasBrief(c) ? " ↗" : ""}</text>` : ""; }).join("");
    const [, , w, h] = M.viewBox.split(" ").map(Number);
    return `<svg viewBox="-14 -10 ${w + 28} ${h + 20}" role="img" aria-label="Map of India. All of India is covered with city-level insights. Bengaluru has premium intelligence. ${esc(ti.name)} cities, ${chosen.length} in all, are highlighted and upgrade to premium by ${esc(ti.by)}."><defs><linearGradient id="covLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ink) var(--ca),var(--bg))"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ink) var(--cb),var(--bg))"/></linearGradient></defs><path class="cov-india" d="${M.path}"/>${g}</svg>`;
  }

  function statesPanel(sel) {
    const ti = tierInfo(sel), by = {};
    ALL.filter((c) => c.t === sel).forEach((c) => (by[c.s] = by[c.s] || []).push(c));
    const states = Object.keys(by).sort();
    return `<div class="hd"><h3>${esc(ti.name)} · ${esc(ti.kind)}</h3><span>${countIn(sel)} cities across ${states.length} states and territories · premium upgrade by <strong>${esc(ti.by)}</strong></span></div>
      <div class="cov-sg">${states.map((s) => `<div><h4>${esc(s)}</h4><div class="cs">${by[s].map((c) => `${hasBrief(c) ? `<a class="brief" href="city.html?c=${slugOf(c)}" title="Open the ${esc(c.n)} city brief">${esc(c.n)} <em>city brief ↗</em></a>` : `<span class="${norm(c.n) === norm(LIVE) ? "live" : ""}">${esc(c.n)}${norm(c.n) === norm(LIVE) ? " · live" : ""}</span>`}`).join("")}</div></div>`).join("")}</div>`;
  }


  function optionGroups(skipLive) {
    return TIERS_R.map((t) => `<optgroup label="${esc(t.name)} · by ${esc(t.by)}">${ALL.filter((c) => c.t === t.n && !(skipLive && norm(c.n) === norm(LIVE))).sort((a, b) => a.n.localeCompare(b.n)).map((c) => `<option value="${esc(c.n)}">${esc(c.n)}${norm(c.n) === norm(LIVE) ? " (premium · live)" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  function band(el) {
    let sel = 1, open = 0;
    el.innerHTML = `<div class="wrap">
      <div class="cov-grid">
        <div>
          <p class="eyebrow">Coverage</p>
          <h2 class="h2">All of India, today.<br /><span class="dim">Premium precision — starting with Bengaluru.</span></h2>
          <p class="lede" style="font-size:18px">We cover every Indian city right now with wide, city-level insights. Bengaluru runs at our premium, high-precision level — and every other city is being upgraded to the same standard, tier by tier, from ${esc(TIERS_R[0].short)} to ${esc(TIERS_R[TIERS_R.length - 1].short)}.</p>
          <div class="cov-two">
            <div class="cov-box prem"><span class="tg">Premium · Bengaluru</span><ul>${TIERS[0].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
            <div class="cov-box"><span class="tg">Pan-India · other cities</span><ul>${TIERS[1].points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
          </div>
        </div>
        <div>
          <div class="cov-tabs" id="covTabs" role="group" aria-label="Show tier on map">${TIERS_R.map((t) => `<button type="button" data-t="${t.n}" aria-pressed="${t.n === sel}">${esc(t.name)}</button>`).join("")}</div>
          <div class="cov-map"><div id="covSvg"></div><div class="cov-tip" id="covTip" role="tooltip"></div><div class="cov-legend"><span><i class="a"></i>Premium · live</span><span><i class="b"></i><span id="covLegSel"></span></span><span><i class="c"></i>Other tiers</span><span><i class="d"></i>Covered across India</span>${briefSlugs().length ? `<span><i class="e"></i>City brief · click</span>` : ""}</div></div>
        </div>
      </div>
      <div class="cov-t4" id="covTiers" role="group" aria-label="Upgrade schedule by tier. Select a tier to see its cities.">${TIERS_R.map((t) => `<button type="button" class="cov-tb" data-t="${t.n}" aria-expanded="false" aria-controls="covDrop"><span class="n">${esc(t.name)}</span><b>${esc(t.kind)}</b><small>${countIn(t.n)} cities</small><span class="by">Premium by <strong>${esc(t.by)}</strong></span><i class="chev" aria-hidden="true"></i></button>`).join("")}</div>
      <div class="cov-drop" id="covDrop" role="region" aria-label="Cities in the selected tier"><div class="cov-drop-in"><div class="cov-drop-pad" id="covDropBody"></div></div></div>
      <div class="cov-ask"><div><h3>Which city should we upgrade first?</h3><p>Tell us where you need premium, Bengaluru-level precision. It helps us decide the order within each tier — and we'll email you the moment it's ready.</p></div>
        <div class="fm"><form id="covForm" novalidate>
          <select id="covCity" aria-label="City">${optionGroups(true)}<option value="__other">Another city…</option></select>
          <input id="covEmail" type="email" placeholder="Your email" autocomplete="email" aria-label="Your email" />
          <button type="submit" id="covGo">Notify me</button>
          <input id="covOther" class="oth" placeholder="City name" aria-label="City name" hidden />
        </form><p class="cov-msg" id="covMsg" role="status" aria-live="polite"></p></div></div>
    </div>`;
    const drop = el.querySelector("#covDrop"), body = el.querySelector("#covDropBody"), tip = el.querySelector("#covTip"), mapBox = el.querySelector(".cov-map");
    const draw = () => {
      el.querySelector("#covSvg").innerHTML = mapSvg(sel);
      el.querySelector("#covLegSel").textContent = `${tierInfo(sel).name} · by ${tierInfo(sel).short}`;
      el.querySelectorAll("#covTabs [data-t]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.t === sel));
      el.querySelectorAll("#covTiers .cov-tb").forEach((b) => { const n = +b.dataset.t; b.classList.toggle("sel", n === sel); b.classList.toggle("open", n === open); b.setAttribute("aria-expanded", n === open); });
      drop.classList.toggle("open", !!open); if (open) body.innerHTML = statesPanel(open);
    };
    // a tier card selects the tier on the map and steps its full-width city list down (tap again to fold it away)
    el.querySelectorAll("#covTiers .cov-tb").forEach((b) => b.addEventListener("click", () => { const n = +b.dataset.t; open = open === n ? 0 : n; sel = n; draw(); }));
    // a tier button above the map does the same and brings the list into view
    el.querySelectorAll("#covTabs [data-t]").forEach((b) => b.addEventListener("click", () => {
      sel = open = +b.dataset.t; draw();
      const r = el.querySelector("#covTiers").getBoundingClientRect();
      if (r.top > innerHeight - 160 || r.top < 60) el.querySelector("#covTiers").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }));
    // hover / tap a point: elegant tooltip
    const showTip = (t) => {
      const c = ALL[+t.dataset.i], ti = tierInfo(c.t), a = t.getBoundingClientRect(), m = mapBox.getBoundingClientRect();
      tip.innerHTML = `<b>${esc(c.n)}</b>${esc(c.s)}<em>${norm(c.n) === norm(LIVE) ? "Premium · live" : esc(ti.name) + " · premium by " + esc(ti.by)}</em>${t.dataset.brief ? `<em class="bf">City brief available — click to open →</em>` : ""}`;
      tip.style.left = (a.left + a.width / 2 - m.left) + "px"; tip.style.top = (a.top + a.height / 2 - m.top) + "px"; tip.classList.add("on");
    };
    mapBox.addEventListener("pointerover", (e) => { const t = e.target.closest(".cov-pt"); if (t) showTip(t); });
    mapBox.addEventListener("pointerout", (e) => { if (e.target.closest(".cov-pt")) tip.classList.remove("on"); });
    // a city with a brief opens it on click (or Enter / Space when focused)
    const openBrief = (e) => { const t = e.target.closest(".cov-pt[data-brief]"); if (t) location.href = "city.html?c=" + t.dataset.brief; };
    mapBox.addEventListener("click", openBrief);
    mapBox.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBrief(e); } });
    mapBox.addEventListener("focusin", (e) => { const t = e.target.closest(".cov-pt[data-brief]"); if (t) showTip(t); });
    mapBox.addEventListener("focusout", () => tip.classList.remove("on"));
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
    const want = new URLSearchParams(location.search).get("city");
    if (want) { const o = [...s2.options].find((x) => norm(x.value) === norm(want)); if (o) s2.value = o.value; }
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
