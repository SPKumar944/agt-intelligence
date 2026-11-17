/* City snapshots page: all-India map of every city in the rollout plan, tier lists, and a snapshot that opens under the map.
   Data: coverage-data.js (cities + tiers), snapshots-registry.js (which cities have data), city-<slug>.json (built by scripts/city_scan.py). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const N = (n, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
  const root = $("#sn"), R = window.AGT_ROLLOUT, SNAPS = window.AGT_SNAPSHOTS || [], MAP = window.AGT_INDIA_MAP;
  if (!R || !MAP) { root.innerHTML = `<div class="cp-loading"><span>Could not load the city list.</span></div>`; return; }
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const CITIES = R.cities.map((c) => ({ ...c, slug: slug(c.n) }));
  const byTier = (n) => CITIES.filter((c) => c.t === n), tier = (n) => R.tiers.find((t) => t.n === n);
  const snapOf = (sl) => SNAPS.find((s) => s.slug === sl), cityOf = (sl) => CITIES.find((c) => c.slug === sl);
  const DEFAULT = (window.AGT_SNAPSHOT_DEFAULT && cityOf(window.AGT_SNAPSHOT_DEFAULT)) ? window.AGT_SNAPSHOT_DEFAULT : (SNAPS[0] || {}).slug || CITIES[0].slug;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let sel = cityOf((location.hash || "").slice(1).toLowerCase()) ? location.hash.slice(1).toLowerCase() : DEFAULT, tierF = 0;
  const cache = {};

  // ---------------------------------------------------------------------------------------------------- skeleton
  const nSnap = SNAPS.length;
  root.innerHTML = `
  <section class="sn-hero"><div class="cp-wrap in">
    <div><span class="mono">City snapshots</span><h1>Every city,<br /><em>by the numbers.</em></h1></div>
    <div><p>Pick a city on the map or from the tier lists. A snapshot shows who lives there, what retail exists and where it is thin — compared like for like with a benchmark city. Cities without a snapshot yet are on the rollout plan.</p>
      <div class="sn-stats"><div><span class="mono">Cities</span><b>${CITIES.length}</b><small>across ${new Set(CITIES.map((c) => c.s)).size} states and territories</small></div><div><span class="mono">Tiers</span><b>${R.tiers.length}</b><small>${esc(R.tiers[0].short)} to ${esc(R.tiers[R.tiers.length - 1].short)}</small></div><div><span class="mono">Snapshots live</span><b>${nSnap}</b><small>${SNAPS.map((s) => esc(s.name)).join(", ")}</small></div></div>
      <p style="margin:26px 0 0;font-size:15px"><span class="mono" style="color:var(--hot)">New</span> &nbsp;<a href="event.html" style="color:var(--ink);text-decoration:underline;text-underline-offset:3px">Event brief — Bengaluru around Deepavali 2026: the calendar, the weather, the departure hubs →</a></p></div>
  </div></section>
  <section class="sn-mapsec"><div class="cp-wrap">
    <div class="sn-tools"><div class="sn-chips" id="snChips" role="group" aria-label="Highlight a tier on the map"></div>
      <input class="sn-find" id="snFind" list="snList" placeholder="Find a city" aria-label="Find a city" autocomplete="off" /><datalist id="snList">${CITIES.map((c) => `<option value="${esc(c.n)}"></option>`).join("")}</datalist></div>
    <div class="sn-map" id="snMap"><div id="snSvg"></div><div class="sn-tip" id="snTip" role="tooltip"></div>
      <div class="sn-legend"><span><i class="a"></i>Selected</span><span><i class="b"></i>Snapshot available</span><span><i class="c"></i>City · click to open</span></div></div>
    <div class="sn-panelwrap" id="snPanelWrap" style="scroll-margin-top:84px"><div class="sn-panelin"><div id="snPanel"></div></div></div>
  </div></section>
  <section class="sn-tiers"><div class="cp-wrap">
    <header><span class="n">All places — by tier</span><h2>${CITIES.length} cities, <em>four tiers</em></h2><p>Tier 1 goes premium first, by ${esc(R.tiers[0].by)}; Tier 4 follows by ${esc(R.tiers[R.tiers.length - 1].by)}. A dot marks cities whose snapshot is already available. Click any city to open it under the map.</p></header>
    <div class="sn-tcols" id="snTiers"></div>
  </div></section>`;

  // ---------------------------------------------------------------------------------------------------- map
  const q = MAP.proj, rad = Math.PI / 180;
  const at = (lon, lat) => { const r = Math.sqrt(q.C - 2 * q.n * Math.sin(lat * rad)) / q.n, th = q.n * (lon - q.lon0) * rad; return [(r * Math.sin(th) - q.minx) * q.sc, (q.maxy - (q.rho0 - r * Math.cos(th))) * q.sc]; };
  function placeLabels(list) {
    const boxes = [], dots = list.map((c) => at(c.x, c.y)), out = new Map();
    const hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) || dots.some(([dx, dy]) => dx > b[0] - 3 && dx < b[2] + 3 && dy > b[1] - 3 && dy < b[3] + 3);
    list.forEach((c, i) => {
      const [x, y] = dots[i], w = c.n.length * 5.7 + 3;
      const opts = [["start", x + 9, y + 3.6, [x + 8, y - 5.5, x + 10 + w, y + 5.5]], ["end", x - 9, y + 3.6, [x - 10 - w, y - 5.5, x - 8, y + 5.5]], ["middle", x, y - 9, [x - w / 2, y - 19, x + w / 2, y - 8]], ["middle", x, y + 16, [x - w / 2, y + 7, x + w / 2, y + 18]]];
      for (const [anchor, tx, ty, box] of opts) if (!hit(box)) { boxes.push(box); out.set(c, [anchor, tx, ty]); break; }
    });
    return out;
  }
  const f1 = (v) => v.toFixed(1), fade = { 1: .6, 2: .5, 3: .42, 4: .35 };
  function drawMap() {
    const selC = cityOf(sel), lab = new Set();
    SNAPS.forEach((s) => { const c = cityOf(s.slug); if (c) lab.add(c); });
    if (tierF) byTier(tierF).forEach((c) => lab.add(c));
    if (selC) lab.add(selC);
    const labelled = [selC, ...[...lab].filter((c) => c !== selC)].filter(Boolean), pos = placeLabels(labelled);
    let g = "";
    CITIES.forEach((c) => { const [x, y] = at(c.x, c.y), on = !tierF || c.t === tierF; g += `<circle class="sn-o" cx="${f1(x)}" cy="${f1(y)}" r="${tierF && c.t === tierF ? 2.6 : 1.7}" opacity="${on ? (tierF ? 1 : fade[c.t]) : .12}"/>`; });
    SNAPS.forEach((s) => { const c = cityOf(s.slug); if (!c || c.slug === sel) return; const [x, y] = at(c.x, c.y); g += `<circle class="sn-halo" cx="${f1(x)}" cy="${f1(y)}" r="8"/><circle class="sn-snap" cx="${f1(x)}" cy="${f1(y)}" r="5.6"/><circle class="sn-t" cx="${f1(x)}" cy="${f1(y)}" r="3"/>`; });
    if (selC) { const [x, y] = at(selC.x, selC.y); g += `<circle class="sn-halo" cx="${f1(x)}" cy="${f1(y)}" r="10" style="fill:var(--hot)"/><circle class="sn-selring" cx="${f1(x)}" cy="${f1(y)}" r="5"/><circle class="sn-sel" cx="${f1(x)}" cy="${f1(y)}" r="4.6"/>`; }
    g += labelled.map((c) => { const p = pos.get(c); return p ? `<text class="sn-lab${c.slug === sel ? " sl" : ""}" x="${f1(p[1])}" y="${f1(p[2])}" text-anchor="${p[0]}">${esc(c.n)}</text>` : ""; }).join("");
    g += CITIES.map((c) => { const [x, y] = at(c.x, c.y); return `<circle class="sn-pt" cx="${f1(x)}" cy="${f1(y)}" r="7.5" data-s="${c.slug}" tabindex="0" role="button" aria-label="${esc(c.n)}, ${esc(c.s)}. Tier ${c.t}.${snapOf(c.slug) ? " Snapshot available." : ""}"/>`; }).join("");
    const [, , w, h] = MAP.viewBox.split(" ").map(Number);
    $("#snSvg").innerHTML = `<svg viewBox="-14 -10 ${w + 28} ${h + 20}" role="group" aria-label="Map of India with ${CITIES.length} cities"><defs><linearGradient id="snLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--ink) var(--ca,4%),var(--bg))"/><stop offset="1" style="stop-color:color-mix(in srgb,var(--ink) var(--cb,11%),var(--bg))"/></linearGradient></defs><path class="sn-india" d="${MAP.path}"/>${g}</svg>`;
  }
  const chips = $("#snChips");
  const drawChips = () => { chips.innerHTML = `<button type="button" data-t="0" aria-pressed="${tierF === 0}">All<em>${CITIES.length}</em></button>` + R.tiers.map((t) => `<button type="button" data-t="${t.n}" aria-pressed="${tierF === t.n}">${esc(t.name)}<em>${byTier(t.n).length}</em></button>`).join(""); };
  chips.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { tierF = +b.dataset.t; drawChips(); drawMap(); } });
  const tip = $("#snTip"), box = $("#snMap");
  const showTip = (t) => {
    const c = cityOf(t.dataset.s), ti = tier(c.t), a = t.getBoundingClientRect(), m = box.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(c.n)}</b>${esc(c.s)}<em>${esc(ti.name)} · premium by ${esc(ti.by)}</em><em class="go">${snapOf(c.slug) ? "Snapshot available — click to open ↓" : "Click for its place in the rollout ↓"}</em>`;
    tip.style.left = (a.left + a.width / 2 - m.left) + "px"; tip.style.top = (a.top + a.height / 2 - m.top) + "px"; tip.classList.add("on");
  };
  box.addEventListener("pointerover", (e) => { const t = e.target.closest(".sn-pt"); if (t) showTip(t); });
  box.addEventListener("pointerout", (e) => { if (e.target.closest(".sn-pt")) tip.classList.remove("on"); });
  box.addEventListener("focusin", (e) => { const t = e.target.closest(".sn-pt"); if (t) showTip(t); });
  box.addEventListener("focusout", () => tip.classList.remove("on"));
  box.addEventListener("click", (e) => { const t = e.target.closest(".sn-pt"); if (t) choose(t.dataset.s, true); });
  box.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest(".sn-pt")) { e.preventDefault(); choose(e.target.closest(".sn-pt").dataset.s, true); } });
  $("#snFind").addEventListener("change", (e) => { const v = e.target.value.trim().toLowerCase(), c = CITIES.find((x) => x.n.toLowerCase() === v) || CITIES.find((x) => x.n.toLowerCase().startsWith(v)); if (c) { choose(c.slug, true); e.target.value = ""; } });

  // ---------------------------------------------------------------------------------------------------- tier lists
  function drawTiers() {
    $("#snTiers").innerHTML = R.tiers.map((t) => {
      const by = {}; byTier(t.n).forEach((c) => (by[c.s] = by[c.s] || []).push(c));
      const withSnap = byTier(t.n).filter((c) => snapOf(c.slug)).length;
      return `<div class="sn-tc"><div class="th"><span class="mono">${esc(t.name)}</span><b>${esc(t.kind)}</b><small>${byTier(t.n).length} cities · premium by <strong>${esc(t.by)}</strong>${withSnap ? ` · ${withSnap} snapshot${withSnap > 1 ? "s" : ""} live` : ""}</small></div>
        ${Object.keys(by).sort().map((s) => `<h4>${esc(s)}</h4><div class="sn-cc">${by[s].map((c) => `<button type="button" data-s="${c.slug}" class="${snapOf(c.slug) ? "has" : ""}" aria-pressed="${c.slug === sel}">${esc(c.n)}</button>`).join("")}</div>`).join("")}</div>`;
    }).join("");
  }
  $("#snTiers").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b) choose(b.dataset.s, true); });

  // ---------------------------------------------------------------------------------------------------- snapshot panel
  const mil = (n) => n >= 1e6 ? N(n / 1e6, 1) + "M" : n >= 1e3 ? N(n / 1e3, 0) + "k" : N(n);
  const vsChip = (k, b, nm) => { if (!b) return ""; const r = k / b; return r >= 1.1 ? `<span class="chip up">${r.toFixed(1)}× ${esc(nm)}</span>` : r <= 0.9 ? `<span class="chip dn">${Math.round((1 - r) * 100)}% below ${esc(nm)}</span>` : `<span class="chip">≈ ${esc(nm)}</span>`; };
  const shareOf = (X, keys) => keys.reduce((a, c) => a + ((X.categories[c] || { count: 0 }).count), 0) / X.places_total * 100;
  const MIX = [["Food & drink", ["food_beverage", "desserts_sweets"]], ["Shops & malls", ["retail_shopping", "mall_department"]], ["Daily needs & grocery", ["grocery_daily_needs"]], ["Healthcare", ["healthcare"]], ["Education", ["education"]], ["Banks & finance", ["finance"]], ["Offices", ["office_corporate"]], ["Hotels & stays", ["hospitality"]], ["Leisure", ["entertainment_leisure"]], ["Services & crafts", ["services_craft", "other_services"]]];
  const mixRows = (D) => MIX.map(([l, ks]) => { const k = shareOf(D.k, ks), b = shareOf(D.bench, ks); return { l, k, b, adj: b > 0 ? k / b * 100 : 100 }; }).sort((a, b) => a.adj - b.adj);

  function insights(D) {
    const E = D.editorial || {}; if ((E.takeaways || []).length) return E.takeaways.slice(0, 5);
    const K = D.k, B = D.bench, bn = B.name, out = [], mx = mixRows(D), thin = mx.filter((m) => m.adj <= 85).slice(0, 3), strong = mx.filter((m) => m.adj >= 115).slice(-3).reverse();
    const tot = D.chains.reduce((a, s) => a + s.brands.length, 0);
    out.push(`<b>Branded retail.</b> ${K.chains.per_lakh} chain outlets per lakh residents against ${B.chains.per_lakh} in ${esc(bn)}; ${K.chains.brands_present} of the ${tot} national brands we track have a mapped outlet.`);
    if (thin.length || strong.length) out.push(`<b>Mix.</b> ${strong.length ? `Stronger than ${esc(bn)} in ${strong.map((m) => `${m.l.toLowerCase()} (${N(m.k, 1)}% of places vs ${N(m.b, 1)}%)`).join(", ")}` : "No category is much stronger than " + esc(bn)}${thin.length ? `; thinner in ${thin.map((m) => `${m.l.toLowerCase()} (${N(m.k, 1)}% vs ${N(m.b, 1)}%)`).join(", ")}` : ""}.`);
    const gap = D.zones.filter((z) => z.role === "gap").sort((a, b) => b.residents - a.residents)[0], core = D.zones.filter((z) => z.role === "core").sort((a, b) => b.idx - a.idx)[0];
    if (gap) out.push(`<b>Under-served.</b> ${D.gap_zones} zone${D.gap_zones === 1 ? "" : "s"} hold ${D.gap_res_pct}% of residents with under 60% of the city's average retail depth. The largest, ${esc(gap.label)}, has about ${N(gap.residents, 0)} residents and ${N(gap.places)} mapped places.`);
    if (core) out.push(`<b>Commercial core.</b> ${esc(core.label)} lists ${N(core.places)} mapped places for ${N(core.residents)} residents (depth index ${core.idx}). ${D.conc.top10pct_cells_share}% of the city's commercial places sit in its busiest tenth (${esc(bn)}: ${D.bconc.top10pct_cells_share}%).`);
    const fm = [...D.formats].sort((a, b) => a.adj - b.adj).filter((f) => f.adj < 80).slice(0, 3);
    if (fm.length) out.push(`<b>Formats with room.</b> ${fm.map((f) => `${esc(f.label.toLowerCase())} (index ${f.adj})`).join(", ")} sit below ${esc(bn)}'s share of mapped places.`);
    return out;
  }

  function gapSvg(D) {
    const [lat0, lng0] = D.centre, kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.57, S = 42, R0 = D.radius_km * S, pad = 14;
    const P = ([la, lo]) => [((lo - lng0) * kx) * S, (-(la - lat0) * ky) * S];
    const fill = (g) => !g ? "color-mix(in srgb,var(--ink) 7%,transparent)" : g > 0 ? `color-mix(in srgb,var(--hot) ${Math.min(100, g * 1.05).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))` : `color-mix(in srgb,var(--cold) ${Math.min(100, -g * 1.05).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))`;
    const paths = D.cells.map((c) => `<path d="M${c.b.map(P).map((p) => p[0].toFixed(0) + "," + p[1].toFixed(0)).join("L")}Z" style="fill:${fill(c.g)}"/>`).join("");
    return `<svg viewBox="${-R0 - pad} ${-R0 - pad} ${2 * R0 + 2 * pad} ${2 * R0 + 2 * pad}" role="img" aria-label="Demand–supply gap map of ${esc(D.name)}">${paths}<circle cx="0" cy="0" r="${R0}" fill="none" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 5" opacity=".6"/></svg>`;
  }

  function mountGap(D) {
    const el = document.getElementById("snGapMap"); if (!el || !window.AGTLiveMap) return;
    const fill = (c) => { const g = c.g; if (!g) return ""; return `color-mix(in srgb,var(${g > 0 ? "--hot" : "--cold"}) ${Math.min(78, 14 + Math.abs(g) * .62).toFixed(0)}%,transparent)`; };
    const tip = (c) => { const z = D.zones.find((z) => z.pin === c.z); return `<b>${z ? esc(z.label) : "Outer area"}</b><div><span>Residents</span><span>${N(c.p)}</span></div><div><span>Retail places</span><span>${c.c}</span></div><div><span>Gap score</span><span>${c.g > 0 ? "+" : ""}${Math.round(c.g)}</span></div>`; };
    AGTLiveMap.create(el, D, { fill, tip }).catch(() => { el.innerHTML = "<p style='padding:18px;color:var(--ink-3)'>The interactive map could not load.</p>"; });
  }

  function snapshotHTML(c, sn, D) {
    const K = D.k, B = D.bench, bn = B.name, ti = tier(c.t), E = D.editorial || {};
    const fk = shareOf(K, ["food_beverage", "desserts_sweets"]), fb = shareOf(B, ["food_beverage", "desserts_sweets"]);
    const kp = [["Residents · " + D.radius_km + " km", mil(K.residents), `${N(K.density)} per km²<br>${vsChip(K.density, B.density, bn)}`], ["Mapped places", N(K.places_total), "shops, eateries, services, institutions"], ["Branded chains", K.chains.per_lakh, `per lakh residents<br>${vsChip(K.chains.per_lakh, B.chains.per_lakh, bn)}`],
      ["Food &amp; drink share", N(fk, 1) + "%", `of mapped places · ${esc(bn)} ${N(fb, 1)}%`], ["Thin-zone residents", D.gap_res_pct + "%", `${D.gap_zones} zone${D.gap_zones === 1 ? "" : "s"} under 60% of average depth`], ["Clustering", N(D.conc.top10pct_cells_share, 0) + "%", `of places in the busiest tenth · ${esc(bn)} ${N(D.bconc.top10pct_cells_share, 0)}%`]];
    const mx = mixRows(D), strong = mx.filter((m) => m.adj >= 105).slice(-4).reverse(), thin = mx.filter((m) => m.adj <= 95).slice(0, 4);
    const absent = []; D.chains.forEach((s) => s.brands.forEach((b) => { if (b.k === 0 && b.b > 0) absent.push(b); })); absent.sort((a, b) => b.b - a.b);
    const present = []; D.chains.forEach((s) => s.brands.forEach((b) => { if (b.k > 0) present.push(b); })); present.sort((a, b) => b.k - a.k);
    const zrow = (z) => `<div><b>${esc(z.label)}</b><span class="m">${N(z.residents)} residents · ${N(z.places)} places</span><span class="r">${z.idx}<small>depth index</small></span></div>`;
    const gaps = D.zones.filter((z) => z.role === "gap").sort((a, b) => b.residents - a.residents).slice(0, 3), cores = D.zones.filter((z) => z.role === "core").sort((a, b) => b.idx - a.idx).slice(0, 3);
    const mrow = (m, up) => `<div><b>${esc(m.l)}</b><span class="m">${N(m.k, 1)}% of places vs ${N(m.b, 1)}% in ${esc(bn)}</span><span class="r">${Math.round(m.adj)}<small>${up ? "stronger" : "thinner"}</small></span></div>`;
    return `<div class="sn-panel">
      <div class="sn-ph"><div><span class="mono">${esc(sn.state || c.s)} · ${esc(ti.name)} · ${esc(ti.kind)}</span><h2>${esc(c.n)}<em>.</em></h2>
        <div class="meta"><span class="cp-pill live"><i></i>Pan-India insights · live</span><span class="cp-pill"><i></i>Premium by ${esc(ti.by)}</span><span class="cp-pill">${D.radius_km} km core · vs ${esc(bn)} · ${esc(D.asof)}</span></div></div>
        <div class="acts">${sn.full ? `<a class="cp-btn" href="${sn.full}">Open the full brief →</a>` : ""}<a class="cp-btn ${sn.full ? "ghost" : ""}" href="request-report.html?city=${encodeURIComponent(c.n)}">Request a ${esc(c.n)} report →</a></div></div>
      <div class="sn-k">${kp.map(([l, v, s]) => `<div><span class="mono">${l}</span><b>${v}</b><small>${s}</small></div>`).join("")}</div>
      <div class="sn-cols"><div class="sn-sub" style="display:block;border:0;margin:0;padding:0"><h3>What stands out</h3><ul class="sn-ins">${insights(D).map((t) => `<li>${t}</li>`).join("")}</ul></div>
        <div><h3>Demand–supply gap</h3><div class="sn-gm" id="snGapMap" role="group" aria-label="Interactive demand–supply gap map of ${esc(D.name)}"></div><p class="ex-src" style="margin-top:8px">Drag and zoom. Amber: many residents, little retail. Blue: retail-rich. Map data © Esri, HERE, Garmin, OpenStreetMap contributors.</p><div class="sn-gmk"><span>retail-rich</span><i></i><span>under-served</span></div></div></div>
      <div class="sn-sub">
        <div><h3>Retail mix vs ${esc(bn)}</h3><div class="sn-rows">${strong.map((m) => mrow(m, true)).join("")}${thin.map((m) => mrow(m, false)).join("")}</div></div>
        <div><h3>Organised retail</h3><div class="sn-bp has">${present.slice(0, 8).map((b) => `<span>${esc(b.n)}<em>${b.k}</em></span>`).join("")}</div>
          <h3 style="margin-top:22px">No mapped outlet (present in ${esc(bn)})</h3><div class="sn-bp">${absent.slice(0, 8).map((b) => `<span>${esc(b.n)}</span>`).join("") || "<span>None</span>"}</div></div>
        <div><h3>Zones to watch</h3><div class="sn-rows">${gaps.map(zrow).join("")}${cores.map(zrow).join("")}</div></div></div>
      <p class="sn-note">Compared with ${esc(bn)} like for like. Raw counts per resident would flatter the better-mapped city, so mix is compared as a share of all mapped places. “No mapped outlet” can mean a brand trades under another listed name. Residents are modelled estimates (two public datasets averaged). Data: © OpenStreetMap contributors · Overture Maps Foundation · WorldPop · Meta Data for Good.</p></div>`;
  }

  function soonHTML(c) {
    const ti = tier(c.t), avail = SNAPS.map((s) => cityOf(s.slug)).filter(Boolean);
    return `<div class="sn-panel"><div class="sn-ph"><div><span class="mono">${esc(c.s)} · ${esc(ti.name)} · ${esc(ti.kind)}</span><h2>${esc(c.n)}<em>.</em></h2>
        <div class="meta"><span class="cp-pill live"><i></i>Pan-India insights · live</span><span class="cp-pill"><i></i>Premium by ${esc(ti.by)}</span><span class="cp-pill">Snapshot in preparation</span></div></div>
        <div class="acts"><a class="cp-btn" href="request-report.html?city=${encodeURIComponent(c.n)}">Request a ${esc(c.n)} report →</a></div></div>
      <div class="sn-soon" style="padding-top:28px"><div><span class="mono">What this snapshot will show</span><ul>
          <li><b>Scale</b>Residents, density and how much retail is mapped.</li><li><b>Mix</b>Which categories are strong or thin against the benchmark city.</li><li><b>Brands</b>Which national chains are present, and which have no mapped outlet.</li><li><b>Zones</b>The commercial cores and the under-served zones, by PIN code.</li></ul></div>
        <div><span class="mono">Be first</span><p style="color:var(--ink-2);font-size:15px;line-height:1.55;margin:12px 0 0">${esc(c.n)} is in ${esc(ti.name)}: premium intelligence by <b>${esc(ti.by)}</b>. Leave your email and we'll tell you when its snapshot goes live. A report is available today at pan-India depth, and it upgrades with the city.</p>
          <form id="soonForm" novalidate><input id="soonEmail" type="email" placeholder="Your email" autocomplete="email" aria-label="Your email" /><button class="cp-btn" type="submit">Notify me</button></form><div class="msg" id="soonMsg" role="status" aria-live="polite"></div>
          ${avail.length ? `<p style="margin:18px 0 0;font-size:14px;color:var(--ink-3)">See a finished snapshot: ${avail.map((a) => `<a href="#${a.slug}" data-s="${a.slug}" style="color:var(--ink);text-decoration:underline">${esc(a.n)}</a>`).join(" · ")}</p>` : ""}</div></div></div>`;
  }

  const wrap = $("#snPanelWrap"), panel = $("#snPanel");
  async function showPanel() {
    const c = cityOf(sel), sn = snapOf(sel); if (!c) return;
    const mine = sel;
    if (!sn) { panel.innerHTML = soonHTML(c); wireSoon(c); return; }
    panel.innerHTML = `<div class="sn-panel"><div class="cp-loading" style="min-height:240px"><span>Loading ${esc(c.n)}…</span></div></div>`;
    try {
      const D = cache[sel] || (cache[sel] = await fetch(sn.data + "?v=2").then((r) => { if (!r.ok) throw new Error("x"); return r.json(); }));
      if (mine !== sel) return;                                   // a different city was picked meanwhile
      panel.innerHTML = snapshotHTML(c, sn, D);
      mountGap(D);
    } catch (e) { panel.innerHTML = `<div class="sn-panel"><div class="cp-loading" style="min-height:200px"><span>Could not load the ${esc(c.n)} snapshot.</span></div></div>`; }
  }
  function wireSoon(c) {
    const f = $("#soonForm"); if (!f) return;
    if (window.AGT && AGT.session) AGT.session().then((s) => { if (s && s.email) $("#soonEmail").value = s.email; }).catch(() => {});
    f.addEventListener("submit", async (e) => { e.preventDefault(); const m = $("#soonMsg"); m.textContent = ""; try { const j = await AGT.api("/api/city-interest", { body: { city: c.n, email: $("#soonEmail").value.trim() } }); m.textContent = j.message; m.style.color = "var(--hot)"; } catch (x) { m.textContent = x.message || "Something went wrong."; } });
  }
  panel.addEventListener("click", (e) => { const a = e.target.closest("a[data-s]"); if (a) { e.preventDefault(); choose(a.dataset.s, true); } });

  // ---------------------------------------------------------------------------------------------------- selection
  function choose(sl, userAction) {
    if (!cityOf(sl)) return;
    sel = sl; try { history.replaceState(null, "", "#" + sl); } catch (e) { /* ignore */ }
    drawMap(); drawTiers(); wrap.classList.add("open"); showPanel();
    if (userAction) { const r = wrap.getBoundingClientRect(); if (r.top > innerHeight - 160 || r.top < 60) setTimeout(() => wrap.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" }), 60); }
  }
  addEventListener("hashchange", () => { const h = (location.hash || "").slice(1).toLowerCase(); if (h !== sel && cityOf(h)) choose(h, true); });

  drawChips(); drawMap(); drawTiers(); wrap.classList.add("open"); showPanel();
})();
