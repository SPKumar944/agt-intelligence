/* City brief renderer. Data: site/city-<slug>.json (built by scripts/city_scan.py). Open as city.html?c=kanpur */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const N = (n, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
  const slug = (new URLSearchParams(location.search).get("c") || "kanpur").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const root = $("#cp");
  const CELL_KM2 = 0.1053;

  fetch(`site/city-${slug}.json?v=1`).then((r) => { if (!r.ok) throw new Error("missing"); return r.json(); }).then(render).catch(() => {
    root.innerHTML = `<div class="cp-loading"><span>No city brief for “${esc(slug)}” yet. <a href="home.html#coverage" style="color:var(--hot)">See the coverage plan →</a></span></div>`;
  });

  const vs = (k, b, unit = "") => {                                   // delta chip vs benchmark
    if (!b) return "";
    const r = k / b;
    return r >= 1.1 ? `<span class="chip up">${r.toFixed(1)}× ${esc(unit)}</span>` : r <= 0.9 ? `<span class="chip dn">${Math.round((1 - r) * 100)}% below ${esc(unit)}</span>` : `<span class="chip">≈ ${esc(unit)}</span>`;
  };
  const bars = (k, b, kn, bn, f = N) => { const m = Math.max(k, b) || 1; return `<div class="bars"><div class="bar k"><span>${esc(kn)}</span><i><b style="width:${(k / m * 100).toFixed(1)}%"></b></i><span>${f(k)}</span></div><div class="bar"><span>${esc(bn)}</span><i><b style="width:${(b / m * 100).toFixed(1)}%"></b></i><span>${f(b)}</span></div></div>`; };

  function render(D) {
    const E = D.editorial || {}, K = D.k, B = D.bench, bn = B.name, T = (window.AGT_ROLLOUT && AGT_ROLLOUT.cities.find((c) => c.n.toLowerCase() === D.name.toLowerCase())) || null;
    const tier = T && AGT_ROLLOUT.tiers.find((t) => t.n === T.t);
    document.title = `${D.name} · City brief · AGT Intelligence`;
    const conc = D.conc.top10pct_cells_share, bconc = D.bconc.top10pct_cells_share;
    const mil = (n) => n >= 1e6 ? N(n / 1e6, 1) + "M" : n >= 1e3 ? N(n / 1e3, 0) + "k" : N(n);
    const hero = `
    <section class="cp-hero"><div class="bgmap" id="bgmap" aria-hidden="true"></div><div class="cp-wrap in">
      <div class="mono crumbs"><a href="city-snapshots.html#${esc(D.slug)}">City snapshots</a><span>/</span><span>${esc(D.state)}</span><span>/</span><span>${tier ? esc(tier.name) : "City"} full brief</span></div>
      <h1>${esc(D.name)}<em>.</em></h1>
      <p class="lead">${E.thesis || ""}</p>
      <div class="cp-pills"><span class="cp-pill live"><i></i>Pan-India insights · live</span>${tier ? `<span class="cp-pill"><i></i>Premium by ${esc(tier.by)}</span>` : ""}<span class="cp-pill">${esc(D.radius_km)} km core · data ${esc(D.asof)}</span></div>
      <div class="acts"><a class="cp-btn" href="request-report.html?city=${encodeURIComponent(D.name)}">Request a ${esc(D.name)} report →</a><a class="cp-btn ghost" href="#notify">Notify me when premium goes live</a></div>
      <div class="cp-ticker">
        <div><span class="mono">Residents · ${D.radius_km} km core</span><b>${mil(K.residents)}</b><small>${N(K.density)} per km² · estimate</small></div>
        <div><span class="mono">Mapped places</span><b>${N(K.places_total)}</b><small>shops, eateries, services, institutions</small></div>
        <div><span class="mono">Branded chains per lakh</span><b>${K.chains.per_lakh}</b><small>${esc(bn)}: ${B.chains.per_lakh} · ${K.chains.brands_present} brands present</small></div>
        <div><span class="mono">Residents in thin zones</span><b>${D.gap_res_pct}%</b><small>${D.gap_zones} zones under 60% of average retail depth</small></div>
      </div></div></section>`;

    const takes = (E.takeaways || []).map((t, i) => `<li data-n="0${i + 1}"><span>${t}</span></li>`).join("");
    const ch = E.chapters || {};
    const head = (id, n, title, deck) => `<header><span class="n">${n} — ${esc(id)}</span><h2>${title}</h2>${deck ? `<p>${deck}</p>` : ""}</header>`;

    // ---- 01 numbers
    const shr = (X, cats) => cats.reduce((a, c) => a + ((X.categories[c] || { count: 0 }).count), 0) / X.places_total * 100;
    const fk = shr(K, ["food_beverage", "desserts_sweets"]), fb = shr(B, ["food_beverage", "desserts_sweets"]), ek = shr(K, ["education"]), eb = shr(B, ["education"]);
    const kp = [
      { l: "Residents", v: mil(K.residents), s: "", d: `Modelled estimate within ${D.radius_km} km. Two public population datasets disagree by up to ${Math.round((Math.max(K.pop_sources.worldpop, K.pop_sources.hrsl) / Math.min(K.pop_sources.worldpop, K.pop_sources.hrsl) - 1) * 100)}% here, so we use their average.`, bars: bars(K.residents, B.residents, D.name, bn, mil) },
      { l: "Density", v: N(K.density), s: "/km²", d: `${vs(K.density, B.density, bn)} People per square kilometre across the core.`, bars: bars(K.density, B.density, D.name, bn) },
      { l: "Mapped places", v: N(K.places_total), s: "", d: `${esc(bn)}'s core is mapped far more completely (${N(B.places_total)} places), so we compare <b>shares and mix</b>, not raw counts per resident.`, bars: "" },
      { l: "Branded chains", v: K.chains.per_lakh, s: "per lakh", d: `${vs(K.chains.per_lakh, B.chains.per_lakh, bn)} ${K.chains.brands_present} of ${D.chains.reduce((a, s) => a + s.brands.length, 0)} tracked national brands have a mapped outlet.`, bars: bars(K.chains.per_lakh, B.chains.per_lakh, D.name, bn, (x) => N(x, 1)) },
      { l: "Food &amp; drink share", v: N(fk, 1), s: "%", d: `Of all mapped places (${esc(bn)}: ${N(fb, 1)}%). ${fk < fb ? "Thinner" : "Stronger"} than Bengaluru's mix.`, bars: bars(fk, fb, D.name, bn, (x) => N(x, 1) + "%") },
      { l: "Education share", v: N(ek, 1), s: "%", d: `Of all mapped places (${esc(bn)}: ${N(eb, 1)}%). Schools, colleges and coaching make Kanpur a learning city.`, bars: bars(ek, eb, D.name, bn, (x) => N(x, 1) + "%") },
      { l: "Thin-zone residents", v: D.gap_res_pct, s: "%", d: `${D.gap_zones} zones hold this share of residents with under 60% of the city's average retail depth.`, bars: "" },
      { l: "Rail &amp; metro reach", v: N(K.transit.rail_metro_served_pct_1km, 0), s: "%", d: `Residents within 1 km of a mapped rail or metro stop (${esc(bn)}: ${N(B.transit.rail_metro_served_pct_1km, 0)}%). ${K.transit.rail_metro_stops} stops mapped.`, bars: bars(K.transit.rail_metro_served_pct_1km, B.transit.rail_metro_served_pct_1km, D.name, bn, (x) => N(x, 0) + "%") },
    ];
    const c1 = `<section class="cp-ch" id="c1">${head("In numbers", "01", (ch.numbers && ch.numbers.title) || "The city in <em>eight numbers</em>", (ch.numbers && ch.numbers.deck) || "")}
      ${takes ? `<ul class="cp-take">${takes}</ul>` : ""}
      <div class="kpis">${kp.map((k) => `<div class="kpi"><span class="mono">${k.l}</span><div class="v">${k.v}<small>${k.s}</small></div><div class="d">${k.d}</div>${k.bars}</div>`).join("")}</div></section>`;

    // ---- 02 map
    const c2 = `<section class="cp-ch" id="c2">${head("The map", "02", (ch.map && ch.map.title) || "Where people live, <em>where shops are</em>", (ch.map && ch.map.deck) || "")}
      <div class="ex"><div>
        <div class="ex-tabs" id="exTabs" role="group" aria-label="Map layer"></div>
        <div class="ex-map" id="exMap"><div id="exSvg"></div><div class="ex-tip" id="exTip"></div></div>
        <div class="ex-legend" id="exLeg"></div><p class="ex-cap" id="exCap"></p></div>
        <aside class="ex-side"><h3>Most under-served zones</h3><div class="zl" id="zlGap"></div><h3>Commercial cores</h3><div class="zl" id="zlCore"></div><div class="zcard" id="zcard"></div></aside></div></section>`;

    // ---- 03 zones
    const c3 = `<section class="cp-ch" id="c3">${head("Zones", "03", (ch.zones && ch.zones.title) || "Zone by zone, <em>by PIN code</em>", (ch.zones && ch.zones.deck) || `Each zone is a postal-code area. Residents are modelled counts; places are mapped businesses and services. “Retail depth” is places per 10,000 residents — the bar marks the ${esc(D.name)} average.`)}
      <div class="tbl-wrap"><table class="tbl" id="zt"><thead><tr><th data-k="label">Zone</th><th class="n" data-k="residents" aria-sort="descending">Residents</th><th class="n" data-k="places">Places</th><th data-k="per10k">Retail depth</th><th class="n" data-k="fnb">Food &amp; drink</th><th class="n" data-k="chains">Chains</th><th class="n" data-k="edu">Education</th><th data-k="role">Role</th></tr></thead><tbody></tbody></table></div></section>`;

    // ---- 04 mix
    const shareOf = (X, keys) => keys.reduce((a, c) => a + ((X.categories[c] || { count: 0 }).count), 0) / X.places_total * 100;
    const MIX = [["Food & drink", ["food_beverage", "desserts_sweets"], "Eateries, cafés, sweet shops"], ["Shops & malls", ["retail_shopping", "mall_department"], "Apparel, electronics, general retail"], ["Daily needs", ["grocery_daily_needs"], "Supermarkets and grocers"],
      ["Healthcare", ["healthcare"], "Clinics, hospitals, pharmacies"], ["Education", ["education"], "Schools, colleges, coaching"], ["Banks & finance", ["finance"], "Branches, ATMs, insurance"], ["Offices", ["office_corporate"], "Corporate and professional"],
      ["Hotels & stays", ["hospitality"], "Hotels and guest houses"], ["Leisure", ["entertainment_leisure"], "Cinemas, gyms, venues"], ["Services & crafts", ["services_craft", "other_services"], "Repairs, salons, workshops"]]
      .map(([l, ks, sub]) => { const k = shareOf(K, ks), b = shareOf(B, ks); return { l, sub, k, b, adj: k / Math.max(b, 0.01) * 100 }; }).sort((a, b) => a.adj - b.adj);
    const mixRow = (m) => { const x = Math.max(-2, Math.min(2, Math.log2(m.adj / 100))), w = Math.abs(x) / 2 * 50; return `<div class="row"><div class="l"><b>${m.l}</b><span>${m.sub}</span></div><div class="axis" role="img" aria-label="${m.l}: ${Math.round(m.adj)} on a scale where 100 matches ${esc(bn)}'s mix"><i class="${x < 0 ? "dn" : "up"}" style="width:${w}%"></i></div><div class="v">${Math.round(m.adj)}<small>${N(m.k, 1)}% vs ${N(m.b, 1)}% of places</small></div></div>`; };
    const c4 = `<section class="cp-ch" id="c4">${head("Retail mix", "04", (ch.mix && ch.mix.title) || `What the retail layer is <em>made of</em>`, (ch.mix && ch.mix.deck) || `Each category's share of all mapped places, relative to ${esc(bn)}'s. 100 means the same share; below 100 is thinner, above is stronger.`)}
      <div class="mix-key"><span>← thinner than Bengaluru's mix</span><span>100 = same share</span><span>stronger →</span></div>
      <div class="mix">${MIX.map(mixRow).join("")}</div>${(ch.mix && ch.mix.note) ? `<p class="ex-cap">${ch.mix.note}</p>` : ""}</section>`;

    // ---- 05 chains
    const totalBr = D.chains.reduce((a, s) => a + s.brands.length, 0);
    const chRows = D.chains.map((s) => `<div class="sec"><div class="h"><b>${esc(s.sector)}</b><span>${s.brands.filter((b) => b.k > 0).length} of ${s.brands.length} present · ${s.brands.reduce((a, b) => a + b.k, 0)} outlets</span></div><div class="bp">${s.brands.map((b) => b.k > 0 ? `<span class="has">${esc(b.n)}<em>${b.k}</em></span>` : `<span class="none">${esc(b.n)}</span>`).join("")}</div></div>`).join("");
    const c5 = `<section class="cp-ch" id="c5">${head("Organised retail", "05", (ch.chains && ch.chains.title) || `Who is mapped here, <em>and who is not</em>`, (ch.chains && ch.chains.deck) || `${K.chains.outlets} outlets of ${K.chains.brands_present} tracked national brands within ${D.radius_km} km — ${K.chains.per_lakh} per lakh residents against ${esc(bn)}'s ${B.chains.per_lakh}. Filled names have at least one mapped outlet (count shown); dashed names have none.`)}
      <div class="chn">${chRows}</div>${(ch.chains && ch.chains.note) ? `<p class="ex-cap">${ch.chains.note}</p>` : ""}</section>`;

    // ---- 06 formats
    const verdict = (a) => a >= 130 ? ["Over-indexed", "up"] : a >= 80 ? ["In line", ""] : a >= 50 ? ["Under-indexed", "dn"] : ["Thin", "dn"];
    const FM = [...D.formats].sort((a, b) => a.adj - b.adj);
    const fmRow = (f) => { const v = verdict(f.adj), notes = (E.formats || {})[f.key] || {}, zs = f.zones.map((z) => `<li><b>${esc(z.label)}</b> — ${N(z.rpo)} residents per outlet (city: ${N(f.city_rpo)})</li>`).join("");
      return `<details><summary><div class="t"><b>${esc(f.label)}</b><span>${f.kc} mapped outlets · ${N(f.ks, 1)}% of places (${esc(bn)}: ${N(f.bs, 1)}%)</span></div>
        <div class="ix"><div class="tr" role="img" aria-label="Index ${f.adj}"><b style="width:${Math.min(100, f.adj / 2)}%"></b><u></u></div><span>Index ${f.adj} · 100 = Bengaluru's share</span></div>
        <div class="vd"><span class="chip ${v[1]}">${v[0]}</span></div><i class="chev" aria-hidden="true"></i></summary>
        <div class="body"><div><h5>Read</h5><p>${notes.read || `${esc(f.label)} make up ${N(f.ks, 1)}% of mapped places in ${esc(D.name)} against ${N(f.bs, 1)}% in ${esc(bn)}.`}</p></div>
        <div><h5>Where to look</h5><ol>${zs}</ol></div>
        <div><h5>Watch-outs</h5><p>${notes.watch || `Demand cohort: ${N(f.ck, 0)}% of ${esc(D.name)} residents are in the age group that drives this format (${esc(bn)}: ${N(f.cb, 0)}%). Mapped counts under-record small independent outlets, so treat the index as direction, not a verdict.`}</p></div></div></details>`; };
    const c6 = `<section class="cp-ch" id="c6">${head("Formats", "06", (ch.formats && ch.formats.title) || `Which formats have <em>room</em>`, (ch.formats && ch.formats.deck) || `Nine formats, thinnest first. The index is each format's share of all mapped places relative to ${esc(bn)}'s: below 100 is thinner, above is stronger.`)}
      <div class="fb">${FM.map(fmRow).join("")}</div></section>`;

    // ---- 07 people
    const coh = [["k", "Under 15", "s1"], ["y", "15–24", "s2"], ["w", "25–59", "s3"], ["s", "60+", "s4"]];
    const stack = (c) => `<div class="stk">${coh.map(([k, l, cl]) => `<div class="${cl}" style="flex:${c[k]}">${c[k] >= 6 ? N(c[k], 0) + "%" : ""}</div>`).join("")}</div>`;
    const c7 = `<section class="cp-ch" id="c7">${head("People", "07", (ch.people && ch.people.title) || `Who the <em>customers</em> are`, (ch.people && ch.people.deck) || "")}
      <div class="ppl"><div class="rw"><span>${esc(D.name)}</span>${stack(K.cohorts)}</div><div class="rw"><span>${esc(bn)}</span>${stack(B.cohorts)}</div>
      <div class="stk-key">${coh.map(([k, l, cl]) => `<span><i class="${cl}" style="background:${{ s1: "color-mix(in srgb,var(--ink) 35%,var(--bg))", s2: "var(--hot)", s3: "var(--ink-2)", s4: "color-mix(in srgb,var(--ink) 20%,var(--bg))" }[cl]}"></i>${l}</span>`).join("")}</div></div>
      ${(ch.people && ch.people.note) ? `<p class="ex-cap" style="margin-top:28px">${ch.people.note}</p>` : ""}</section>`;

    // ---- close
    const close = `<section class="cp-close"><div class="cp-wrap"><h2>${E.closing || `Premium precision for ${esc(D.name)} is <em>on its way</em>.`}</h2>
      <div class="cols"><div><span class="mono">What premium adds to this brief</span><ul class="pr" style="margin-top:18px">
        <li><b>Footfall</b>Street-by-street, hour-by-hour pedestrian volumes instead of zone averages.</li><li><b>Catchments</b>Walk-in and drive-time trade areas for any address you give us.</li>
        <li><b>Revenue</b>A forecast range (P10–P90) for each site, with the drivers shown.</li><li><b>Competition</b>Direct and complementary brands chosen for your format.</li>
        <li><b>Cannibalisation</b>What a new outlet takes from your existing ones, in rupees.</li></ul></div>
        <div class="nf" id="notify"><span class="mono">Be first</span><p>${tier ? `${esc(D.name)} upgrades to premium by <b>${esc(tier.by)}</b>.` : ""} Leave your email and we'll tell you the day it goes live. You can also request a ${esc(D.name)} report today at pan-India depth — it upgrades with the city.</p>
          <form id="nfForm" novalidate><input id="nfEmail" type="email" placeholder="Your email" autocomplete="email" aria-label="Your email" /><button class="cp-btn" type="submit">Notify me</button></form><div class="msg" id="nfMsg" role="status" aria-live="polite"></div>
          <div style="margin-top:6px"><a class="cp-btn ghost" href="request-report.html?city=${encodeURIComponent(D.name)}">Request a ${esc(D.name)} report →</a></div></div></div>
      <div class="meth"><details><summary>How this brief was made, and its limits</summary><div class="txt">
        <p>This brief covers a ${D.radius_km} km circle around ${esc(D.name)}'s centre and the same ${D.radius_km} km circle around ${esc(bn)}'s, processed with identical rules so comparisons are like for like.</p>
        <ul><li><b>Places</b>: ${N(D.provenance.places_scanned)} mapped businesses and services in ${esc(D.name)} (${N(D.provenance.bench_places)} in ${esc(bn)}), merged and classified by our own taxonomy.</li>
        <li><b>Residents</b>: modelled counts per hexagon of about 0.1 km², from WorldPop 2025 and Meta's high-resolution settlement layer (which also supplies age and sex shares).</li>
        <li><b>Zones</b>: postal-code areas. A place belongs to its listed PIN; residents are assigned from each hexagon's nearest PIN-coded place, so ${D.pop_zoned_pct}% of residents sit in a named zone.</li>
        <li><b>Index</b>: a category's share of all mapped places in ${esc(D.name)} divided by its share in ${esc(bn)}. Shares are used instead of per-resident counts because ${esc(bn)}'s map is far more complete, which would otherwise make every ${esc(D.name)} category look thin.</li>
        <li><b>Residents</b>: where WorldPop and Meta's layer disagree (here ${N(K.pop_sources.worldpop)} vs ${N(K.pop_sources.hrsl)} within ${D.radius_km} km), we use their average.</li></ul>
        <p><b>Read with care.</b> Map data is never complete, and it is usually thinner for smaller cities and for small independent outlets. That is why we adjust for overall depth and call the result direction, not a verdict. Premium reports replace these estimates with checked, site-level numbers.</p>
        <p>Data: © OpenStreetMap contributors (ODbL) · Overture Maps Foundation · WorldPop · Meta Data for Good. Snapshot ${esc(D.asof)}.</p></div></details></div></div></section>`;

    const rail = [["c1", "In numbers"], ["c2", "The map"], ["c3", "Zones"], ["c4", "Retail mix"], ["c5", "Organised retail"], ["c6", "Formats"], ["c7", "People"]].map(([id, t], i) => `<a href="#${id}"><span>0${i + 1}</span>${t}</a>`).join("");
    root.innerHTML = hero + `<div class="cp-wrap cp-layout"><nav class="cp-rail" aria-label="Chapters">${rail}</nav><div>${c1}${c2}${c3}${c4}${c5}${c6}${c7}</div></div>` + close;

    // scroll-spy
    const links = $$(".cp-rail a"), io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-30% 0px -60% 0px" });
    $$(".cp-ch").forEach((s) => io.observe(s));

    initMap(D, E); initZones(D, E); initNotify(D);
  }

  // ------------------------------------------------------------------------------------------------------ map
  function project(D) {
    const [lat0, lng0] = D.centre, kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.57, S = 42;                // 42 units per km
    const P = ([la, lo]) => [((lo - lng0) * kx) * S, (-(la - lat0) * ky) * S];
    return { P, S };
  }
  function initMap(D, E) {
    const { P, S } = project(D);
    const paths = D.cells.map((c) => c.b.map(P));
    const xs = paths.flat().map((p) => p[0]), ys = paths.flat().map((p) => p[1]);
    const R = D.radius_km * S, pad = 22, vb = [-R - pad, -R - pad, 2 * R + 2 * pad, 2 * R + 2 * pad];
    const d = paths.map((pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z");
    const LAYERS = {
      residents: { label: "Residents", key: (c) => c.p / CELL_KM2, unit: "people / km²", cap: "residents", lo: "sparse", hi: "dense" },
      supply: { label: "Retail supply", key: (c) => c.c / CELL_KM2, unit: "places / km²", cap: "supply", lo: "few", hi: "many" },
      chains: { label: "Chains", key: (c) => c.h / CELL_KM2, unit: "chain outlets / km²", cap: "chains", lo: "none", hi: "clustered" },
      education: { label: "Education", key: (c) => c.e / CELL_KM2, unit: "institutions / km²", cap: "education", lo: "few", hi: "campuses" },
      gap: { label: "Demand–supply gap", key: (c) => c.g, unit: "gap score", cap: "gap", lo: "supply-rich", hi: "under-served", div: true },
    };
    const caps = { residents: `<b>Where people live.</b> Modelled residents per square kilometre.`, supply: `<b>Where the shops are.</b> Every mapped shop, eatery, clinic, bank and service, per square kilometre.`, chains: `<b>Where the brands are.</b> Branded retail and food outlets only; banks excluded.`, education: `<b>Where the campuses are.</b> Schools, colleges and coaching — a proxy for daytime youth traffic.`, gap: `<b>The gap.</b> Amber cells have many residents nearby but little retail; blue cells have far more retail than local residents explain — the commercial cores that draw people in from elsewhere.` };
    const capsE = ((E.chapters || {}).map || {}).captions || {};
    let layer = "residents", hz = "";
    const sorted = (f) => { const v = D.cells.map(f).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.97)] || v[v.length - 1] : 1; };
    const scale = {}; Object.entries(LAYERS).forEach(([k, L]) => { if (!L.div) scale[k] = sorted(L.key); });
    const fillOf = (c, k) => { const L = LAYERS[k]; if (L.div) { const g = c.g; if (!g) return "color-mix(in srgb,var(--ink) 7%,transparent)"; return g > 0 ? `color-mix(in srgb,var(--hot) ${Math.min(100, g * 1.05).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))` : `color-mix(in srgb,var(--cold) ${Math.min(100, -g * 1.05).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))`; }
      const v = L.key(c); if (v <= 0) return "color-mix(in srgb,var(--ink) 4%,transparent)"; const t = Math.min(1, Math.sqrt(v / scale[k])); return `color-mix(in srgb,var(--hot) ${(8 + t * 92).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))`; };
    const svg = `<svg viewBox="${vb.join(" ")}" role="img" aria-label="Hexagon map of ${esc(D.name)} within ${D.radius_km} km"><g id="exCells">${D.cells.map((c, i) => `<path class="c" data-i="${i}" d="${d[i]}" style="fill:${fillOf(c, layer)}"/>`).join("")}</g>
      <circle class="ring" cx="0" cy="0" r="${R}"/><circle class="ctr" cx="0" cy="0" r="3"/><text x="${R * 0.707 + 4}" y="${-R * 0.707 - 6}">${D.radius_km} km</text></svg>`;
    $("#exSvg").innerHTML = svg;
    const tabs = $("#exTabs"); tabs.innerHTML = Object.entries(LAYERS).map(([k, L]) => `<button type="button" data-l="${k}" aria-pressed="${k === layer}">${L.label}</button>`).join("");
    const legend = () => { const L = LAYERS[layer]; $("#exLeg").innerHTML = L.div ? `<span>blue · ${L.lo}</span><i style="background:linear-gradient(90deg,var(--cold),color-mix(in srgb,var(--ink) 10%,transparent),var(--hot))"></i><span>amber · ${L.hi}</span>` : `<span>${L.lo}</span><i style="background:linear-gradient(90deg,color-mix(in srgb,var(--hot) 8%,color-mix(in srgb,var(--ink) 8%,transparent)),var(--hot))"></i><span>${L.hi} · ${L.unit}</span>`; $("#exCap").innerHTML = capsE[layer] || caps[layer]; };
    const paint = () => { $$("#exCells path").forEach((p) => { const c = D.cells[+p.dataset.i]; p.style.fill = fillOf(c, layer); p.classList.toggle("hz", !!hz && c.z === hz); }); $$("#exTabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === layer)); legend(); };
    tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-l]"); if (b) { layer = b.dataset.l; paint(); } });
    // hover
    const tip = $("#exTip"), box = $("#exMap");
    box.addEventListener("pointermove", (e) => { const p = e.target.closest("path.c"); if (!p) { tip.classList.remove("on"); return; } const c = D.cells[+p.dataset.i], z = D.zones.find((z) => z.pin === c.z), r = box.getBoundingClientRect();
      tip.innerHTML = `<b>${z ? esc(z.label) : "Outer area"}</b><div><span>Residents</span><span>${N(c.p)}</span></div><div><span>Retail places</span><span>${c.c}</span></div><div><span>Food &amp; drink</span><span>${c.f}</span></div><div><span>Chain outlets</span><span>${c.h}</span></div><div><span>Education</span><span>${c.e}</span></div>`;
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x > r.width - 200) x = e.clientX - r.left - 200; if (y > r.height - 150) y = e.clientY - r.top - 150; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on"); });
    box.addEventListener("pointerleave", () => tip.classList.remove("on"));
    window.__cpMap = { setZone(pin) { hz = pin; paint(); }, getZone: () => hz };
    paint();
    // hero backdrop
    const bg = $("#bgmap"); if (bg) { const k = LAYERS.residents; bg.innerHTML = `<svg viewBox="${vb.join(" ")}" preserveAspectRatio="xMidYMid slice">${D.cells.map((c, i) => `<path d="${d[i]}" style="fill:${fillOf(c, "residents")}"/>`).join("")}</svg>`; }
  }

  // ------------------------------------------------------------------------------------------------------ zones
  function initZones(D, E) {
    const notes = (E.zones || {}), ROLE = { core: ["Commercial core", "core"], gap: ["Under-served", "gap"], education: ["Education hub", ""], health: ["Healthcare cluster", ""], balanced: ["Balanced", ""] };
    const mean = D.k.places_per10k;
    const item = (z, sub) => `<button type="button" data-z="${z.pin}" aria-pressed="false"><b>${esc(z.label)}</b><span class="m">PIN ${z.pin} · ${N(z.residents)} residents · ${z.places} places</span><span class="r">${z.per10k}<small>per 10k</small></span></button>`;
    const gap = D.zones.filter((z) => z.residents >= 90000).sort((a, b) => a.per10k - b.per10k).slice(0, 5), core = [...D.zones].sort((a, b) => b.per10k - a.per10k).slice(0, 3);
    $("#zlGap").innerHTML = gap.map((z) => item(z)).join(""); $("#zlCore").innerHTML = core.map((z) => item(z)).join("");
    const card = $("#zcard"), show = (pin) => {
      const z = D.zones.find((x) => x.pin === pin); const same = window.__cpMap.getZone() === pin; window.__cpMap.setZone(same ? "" : pin);
      $$(".zl button").forEach((b) => b.setAttribute("aria-pressed", !same && b.dataset.z === pin));
      if (same || !z) { card.classList.remove("on"); return; }
      card.innerHTML = `<h4>${esc(z.label)}</h4><span class="mono">PIN ${z.pin} · ${esc(ROLE[z.role][0])}</span><div class="g"><div><b>${N(z.residents)}</b><span>Residents</span></div><div><b>${z.places}</b><span>Places</span></div><div><b>${z.idx}</b><span>Depth index</span></div><div><b>${z.fnb}</b><span>Food &amp; drink</span></div><div><b>${z.chains}</b><span>Chains</span></div><div><b>${z.edu}</b><span>Education</span></div></div>${notes[z.pin] ? `<p>${notes[z.pin]}</p>` : ""}`;
      card.classList.add("on");
    };
    $("#c2").addEventListener("click", (e) => { const b = e.target.closest("[data-z]"); if (b) show(b.dataset.z); });
    // table
    let sort = { k: "residents", dir: -1 };
    const draw = () => { const rows = [...D.zones].sort((a, b) => (typeof a[sort.k] === "string" ? a[sort.k].localeCompare(b[sort.k]) : a[sort.k] - b[sort.k]) * sort.dir);
      $("#zt tbody").innerHTML = rows.map((z) => `<tr class="zr" data-z="${z.pin}"><td class="nm"><b>${esc(z.label)}</b><span>PIN ${z.pin}</span></td><td class="n">${N(z.residents)}</td><td class="n">${N(z.places)}</td>
        <td><span class="meter ${z.per10k < mean * 0.62 ? "low" : ""}"><b style="width:${Math.min(100, z.per10k / (mean * 2.2) * 100)}%"></b><u class="avg" style="left:${(mean / (mean * 2.2) * 100).toFixed(1)}%"></u></span>${z.per10k}</td><td class="n">${z.fnb}</td><td class="n">${z.chains}</td><td class="n">${z.edu}</td><td><span class="role ${ROLE[z.role][1]}">${esc(ROLE[z.role][0])}</span></td></tr>`).join("");
      $$("#zt th").forEach((h) => { if (h.dataset.k === sort.k) h.setAttribute("aria-sort", sort.dir < 0 ? "descending" : "ascending"); else h.removeAttribute("aria-sort"); }); };
    $("#zt thead").addEventListener("click", (e) => { const h = e.target.closest("th"); if (!h) return; const k = h.dataset.k === "edu" ? "edu" : h.dataset.k; sort = { k, dir: sort.k === k ? -sort.dir : (k === "label" || k === "role" ? 1 : -1) }; draw(); });
    $("#zt tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-z]"); if (!tr) return; show(tr.dataset.z); const m = $("#exMap").getBoundingClientRect(); if (m.top < 60 || m.bottom > innerHeight) $("#c2").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
    draw();
  }

  function initNotify(D) {
    const f = $("#nfForm"), msg = $("#nfMsg");
    if (window.AGT && AGT.session) AGT.session().then((s) => { if (s && s.email) $("#nfEmail").value = s.email; }).catch(() => {});
    f.addEventListener("submit", async (e) => { e.preventDefault(); msg.textContent = ""; try { const j = await AGT.api("/api/city-interest", { body: { city: D.name, email: $("#nfEmail").value.trim() } }); msg.textContent = j.message; msg.style.color = "var(--hot)"; } catch (x) { msg.textContent = x.message || "Something went wrong."; } });
  }
})();
