/* Internal data-coverage dashboard (super admin only): what has been extracted and processed so far, and where.
   CovDash.mount(el) — data comes from /api/admin/coverage (built by scripts/build_coverage.py). Needs AGT.api and Leaflet (AGTLiveMap.load). */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const N = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-IN"));
  const F = (n, d = 1) => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const dt = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const SIZE = (m) => (m >= 1024 ? F(m / 1024, 2) + " GB" : F(m, m < 10 ? 1 : 0) + " MB");
  const dark = () => document.documentElement.dataset.theme !== "light";
  const ES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
  const TILE = { dark: ES + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", light: ES + "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" };
  const LAB = { dark: ES + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", light: ES + "World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" };
  const LAYER = { osm_places: "OSM places", overture_place: "Overture places", overture_building: "Overture buildings", hrsl: "Meta HRSL population", worldpop_ind: "WorldPop India population", osm_graph: "OSM road networks", osm_areas: "OSM wards and localities", overpass_query: "OSM free-form queries" };
  const HOT = "#e8a33d", COLD = "#5b9bd5";

  const CSS = `
  .cv{max-width:1500px;margin:0 auto;padding:26px 24px 80px;color:var(--ink)}
  .cv h1{margin:0;font-size:28px;letter-spacing:-.03em;font-weight:700}.cv .sub{color:var(--ink-3);font-size:13.5px;margin-top:6px;max-width:760px;line-height:1.5}
  .cv-top{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;align-items:flex-end;margin-bottom:22px}
  .cv-btn{font:500 12px/1 inherit;font-family:inherit;padding:10px 14px;border-radius:980px;border:1px solid var(--line-2,#ccc);background:var(--bg);color:var(--ink);cursor:pointer}.cv-btn:disabled{opacity:.55;cursor:default}
  .cv-kp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:26px}
  .cv-k{background:var(--bg);border-radius:14px;box-shadow:0 0 0 1px var(--line);padding:16px 18px}
  .cv-k .l{font:500 10.5px/1.2 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
  .cv-k .v{font-size:30px;letter-spacing:-.03em;font-weight:600;margin:8px 0 4px;line-height:1}.cv-k .d{font-size:12.5px;color:var(--ink-3);line-height:1.4}
  .cv-sec{margin:0 0 30px}.cv-sec>h2{font:600 12px/1 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin:0 0 6px}
  .cv-sec>p{margin:0 0 14px;color:var(--ink-3);font-size:13px;max-width:820px;line-height:1.5}
  .cv-map{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:stretch}
  .cv-mapbox{position:relative;border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--line);min-height:560px;background:var(--bg-3)}
  #cvMap{position:absolute;inset:0}
  .cv-bar{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px;align-items:center}
  .cv-bar .g{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-right:14px}.cv-bar .gl{font:500 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-right:2px}
  .cv-ch{border:0;border-radius:980px;padding:7px 12px;background:var(--bg);color:var(--ink-2);font-size:12.5px;cursor:pointer;box-shadow:0 0 0 1px var(--line);font-family:inherit}
  .cv-ch[aria-pressed=true]{background:var(--ink);color:var(--bg);box-shadow:none}
  .cv-side{background:var(--bg);border-radius:14px;box-shadow:0 0 0 1px var(--line);padding:16px 16px 14px;overflow:auto;max-height:560px}
  .cv-side h3{margin:0 0 8px;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
  .cv-j{display:grid;gap:6px;margin-bottom:16px}.cv-j button{display:flex;justify-content:space-between;gap:8px;text-align:left;border:0;background:var(--bg-2);border-radius:10px;padding:9px 11px;font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
  .cv-j button:hover{background:var(--bg-3)}.cv-j small{color:var(--ink-3);font-size:11.5px;white-space:nowrap}
  .cv-hx{font-size:13px;line-height:1.55;color:var(--ink-2)}.cv-hx b{color:var(--ink)}.cv-hx ul{margin:6px 0 0;padding-left:18px}
  .cv-leg{position:absolute;left:12px;bottom:12px;z-index:500;background:color-mix(in srgb,var(--bg) 88%,transparent);border-radius:10px;padding:9px 12px;font-size:11.5px;color:var(--ink-2);box-shadow:0 0 0 1px var(--line);line-height:1.7}
  .cv-leg i{display:inline-block;width:18px;height:10px;border-radius:2px;margin-right:7px;vertical-align:-1px}
  .cv-leg .r{display:inline-block;width:16px;height:16px;border-radius:50%;margin-right:7px;vertical-align:-4px;box-sizing:border-box}
  table.cv-t{width:100%;border-collapse:collapse;font-size:13px;background:var(--bg);border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}
  .cv-t th{font:600 10.5px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
  .cv-t td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top}.cv-t tr:last-child td{border-bottom:0}.cv-t td.n,.cv-t th.n{text-align:right;font-variant-numeric:tabular-nums}
  .cv-t .mut{color:var(--ink-3)}.cv-t small{display:block;color:var(--ink-3);font-size:11.5px;margin-top:2px;line-height:1.4}
  .cv-p{display:inline-block;border-radius:980px;padding:2px 9px;font-size:11px;font-weight:600;background:var(--bg-3);color:var(--ink-2);white-space:nowrap}
  .cv-p.hot{background:color-mix(in srgb,${HOT} 22%,transparent);color:color-mix(in srgb,${HOT} 80%,var(--ink))}
  .cv-bars{display:grid;gap:7px}.cv-bars div{display:grid;grid-template-columns:96px 1fr 150px;gap:12px;align-items:center;font-size:12.5px;color:var(--ink-2)}
  .cv-bars span.b{display:flex;gap:2px;height:14px}.cv-bars span.b i{display:block;height:100%;border-radius:2px}
  .cv-cov{height:6px;border-radius:3px;background:var(--bg-3);min-width:70px;overflow:hidden}.cv-cov i{display:block;height:100%;background:var(--ink)}
  .cv-fold summary{cursor:pointer;font-size:13px;color:var(--ink-2);padding:10px 2px}
  .cv-note{font-size:12.5px;color:var(--ink-3);line-height:1.6;margin:0;padding-left:18px}
  .cv-split{display:flex;height:12px;border-radius:3px;overflow:hidden;background:var(--bg-3)}.cv-split i{display:block;height:100%}
  .cv-keyline{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--ink-3);margin:10px 2px 0}.cv-keyline i{display:inline-block;width:12px;height:8px;border-radius:2px;margin-right:6px}
  .cv .cv-h3{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:24px 0 10px}
  .cv-empty{padding:60px 0;text-align:center;color:var(--ink-3)}
  .cv .leaflet-tooltip.cv-tip{background:var(--ink);color:var(--bg);border:0;border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.3)}.cv .leaflet-tooltip.cv-tip::before{display:none}
  .cv .leaflet-container{background:var(--bg-3);font-family:inherit}.cv-pinq{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;width:190px}.cv-pinq:focus{outline:2px solid var(--ink-3);outline-offset:1px}.cv-pst{margin-top:6px;color:var(--ink-3);font-size:12px}.cv .leaflet-bar a{background:var(--bg);color:var(--ink);border-color:var(--line)}
  .cv .leaflet-control-attribution{background:color-mix(in srgb,var(--bg) 78%,transparent);color:var(--ink-3);font-size:10px}.cv .leaflet-control-attribution a{color:var(--ink-2)}
  @media (max-width:1100px){.cv-kp{grid-template-columns:repeat(3,minmax(0,1fr))}.cv-map{grid-template-columns:1fr}.cv-side{max-height:none}}
  @media (max-width:640px){.cv{padding:18px 16px 60px}.cv-kp{grid-template-columns:repeat(2,minmax(0,1fr))}.cv-mapbox{min-height:420px}.cv-bars div{grid-template-columns:70px 1fr}.cv-bars div span:last-child{display:none}.cv-t{display:block;overflow-x:auto}}`;
  let styled = false;

  function ensureLeaflet() { return window.AGTLiveMap && AGTLiveMap.load ? AGTLiveMap.load() : Promise.reject(new Error("map library missing")); }

  function mount(el) {
    if (!styled) { const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); styled = true; }
    el.innerHTML = '<div class="cv"><div class="cv-empty">Loading the coverage inventory…</div></div>';
    let poll = null;
    const load = async () => {
      let D;
      try { D = await AGT.api("/api/admin/coverage"); } catch (e) { el.innerHTML = `<div class="cv"><div class="cv-empty">${esc(e.message)}</div></div>`; return; }
      if (D.empty) {
        el.innerHTML = `<div class="cv"><div class="cv-empty">No inventory has been built yet.<br><br><button class="cv-btn" id="cvGo" ${D.building ? "disabled" : ""}>${D.building ? "Building…" : "Build the inventory"}</button>${D.error ? `<p>${esc(D.error)}</p>` : ""}</div></div>`;
        const b = el.querySelector("#cvGo"); b.onclick = () => refresh(b); if (D.building) wait(); return;
      }
      render(D);
      if (D.building) wait();
    };
    const wait = () => { clearTimeout(poll); poll = setTimeout(load, 4000); };
    async function refresh(btn) { btn.disabled = true; btn.textContent = "Rebuilding…"; try { await AGT.api("/api/admin/coverage/refresh", { body: {} }); } catch (e) { btn.textContent = e.message; return; } wait(); }

    function render(D) {
      const K = D.kpis, live = D.studies.filter((s) => !s.duplicate);
      const sl = {}; live.forEach((s) => { sl["c:" + s.id] = `${s.client_label}${s.locality ? " · " + s.locality : ""}`; }); D.cities.forEach((c) => { sl["s:" + c.slug] = `${c.name} city scan`; });
      const kp = [
        ["Area covered", `${N(K.covered_km2)} km²`, `${K.covered_pct}% of India's land area. Overlaps counted once.`],
        ["States and UTs", `${K.states_covered} of ${K.states_total}`, "with at least one study or city scan"],
        ["City scans", N(K.city_scans), "10 km circles, same method everywhere"],
        ["Client studies", N(K.studies), `for ${K.clients} clients, 5 km around each site${K.area_studies ? `; plus ${K.area_studies} standalone area study` : ""}${K.duplicate_studies ? `; ${K.duplicate_studies} duplicate folder ignored` : ""}`],
        ["Unique mapped places", N(K.unique_places), `${N(K.records_places)} records before removing overlaps`],
        ["Held on disk", `${F(K.disk_gb, 2)} GB`, `${N(K.raw_files)} raw files plus outputs`],
      ];
      const covered = D.states.filter((r) => r.covered_km2 > 0), uncovered = D.states.filter((r) => !r.covered_km2);
      const maxArea = Math.max(...covered.map((r) => r.pct), 1);
      const tl = D.timeline, maxT = Math.max(...tl.map((t) => t.studies + t.cities), 1);
      const jumps = [];
      const byCity = {}; live.forEach((s) => { const k = s.city; (byCity[k] = byCity[k] || { lat: s.lat, lng: s.lng, st: 0, sc: 0 }).st++; });
      D.cities.forEach((c) => { (byCity[c.name] = byCity[c.name] || { lat: c.lat, lng: c.lng, st: 0, sc: 0 }).sc = 1; });
      Object.entries(byCity).forEach(([n, v]) => jumps.push({ n, ...v }));
      jumps.sort((a, b) => b.st - a.st || a.n.localeCompare(b.n));

      el.innerHTML = `<div class="cv">
      <div class="cv-top"><div><h1>Data coverage</h1><div class="sub">Everything we have extracted and processed so far, and where it sits on the Indian map. For internal planning only: it names clients and is never published.</div></div>
        <div style="text-align:right"><div class="sub" style="margin:0 0 8px">Rebuilt ${esc(D.generated_at)}${D.building ? " · rebuilding now…" : ""}</div><button class="cv-btn" id="cvRe" ${D.building ? "disabled" : ""}>${D.building ? "Rebuilding…" : "Refresh inventory"}</button></div></div>
      <div class="cv-kp">${kp.map((k) => `<div class="cv-k"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="d">${k[2]}</div></div>`).join("")}</div>

      <div class="cv-sec"><h2>Where we have been</h2><p>Every circle is drawn to its true size on the ground, so at country level a 10 km city scan is a speck; zoom in to see it grow. From city level, hexagons of about 0.7 km² show how much we hold. Switch on PIN code areas to see India Post boundaries and what we hold inside each.</p>
        <div class="cv-bar"><div class="g"><span class="gl">Show</span>
          <button class="cv-ch" data-ly="hex" aria-pressed="true">Hexagons</button><button class="cv-ch" data-ly="city" aria-pressed="true">City scans</button><button class="cv-ch" data-ly="study" aria-pressed="true">Client studies</button><button class="cv-ch" data-ly="tiles" aria-pressed="false">Stored tiles</button><button class="cv-ch" data-ly="raw" aria-pressed="false">Raw downloads</button><button class="cv-ch" data-ly="pin" aria-pressed="false" title="Official India Post PIN-code areas">PIN code areas</button></div>
          <div class="g"><span class="gl">Colour hexagons by</span><button class="cv-ch" data-hm="depth" aria-pressed="true">Overlapping runs</button><button class="cv-ch" data-hm="n" aria-pressed="false">Mapped places</button><button class="cv-ch" data-hm="p" aria-pressed="false">Residents</button></div><div class="g"><span class="gl">Colour PIN areas by</span><button class="cv-ch" data-pm="cov" aria-pressed="true">Covered or not</button><button class="cv-ch" data-pm="n" aria-pressed="false">Mapped places</button><button class="cv-ch" data-pm="r" aria-pressed="false">Residents</button><input class="cv-pinq" id="cvPinQ" inputmode="numeric" maxlength="6" placeholder="Find a PIN, e.g. 560001" aria-label="Find a PIN code" /></div></div>
        <div class="cv-map"><div class="cv-mapbox"><div id="cvMap"></div><div class="cv-leg" id="cvLeg"></div></div>
          <aside class="cv-side"><h3>Jump to</h3><div class="cv-j">${jumps.map((j, i) => `<button type="button" data-j="${i}"><span>${esc(j.n)}</span><small>${j.st ? j.st + (j.st === 1 ? " study" : " studies") : ""}${j.st && j.sc ? " · " : ""}${j.sc ? "scan" : ""}</small></button>`).join("")}<button type="button" data-j="all"><span>All India</span><small>reset</small></button></div>
            <h3>Selected hexagon</h3><div class="cv-hx" id="cvHx">Click a hexagon to see which runs reach it.</div><h3>Selected PIN area</h3><div class="cv-hx" id="cvPin">Switch on “PIN code areas”, zoom in and click an area. Zoomed out you see the 3-digit PIN regions.</div></aside></div></div>

      <div class="cv-sec"><h2>Country and state view</h2><p>Share of each state's land area inside a study or scan footprint. States with no work yet are listed underneath.</p>
        <table class="cv-t"><tr><th>State / UT</th><th>Covered by</th><th class="n">Area covered</th><th class="n">Share of state</th><th style="width:140px"></th><th class="n">Mapped places</th><th>Last run</th></tr>
        ${covered.map((r) => `<tr><td><b>${esc(r.state)}</b></td><td>${r.cities.length ? r.cities.map(esc).join(", ") : ""}${r.studies ? `${r.cities.length ? "<br>" : ""}<span class="mut">${r.studies} client ${r.studies === 1 ? "study" : "studies"} · ${r.clients} ${r.clients === 1 ? "client" : "clients"}</span>` : ""}</td><td class="n">${F(r.covered_km2)} km²</td><td class="n">${r.pct < 0.1 ? "<0.1" : F(r.pct, r.pct < 10 ? 2 : 1)}%</td><td><div class="cv-cov"><i style="width:${Math.max(3, (r.pct / maxArea) * 100)}%"></i></div></td><td class="n">${N(r.pois)}</td><td>${dt(r.last)}</td></tr>`).join("")}
        <tr><td><b>India</b></td><td class="mut">${K.states_covered} of ${K.states_total} states and UTs</td><td class="n"><b>${F(K.covered_km2)} km²</b></td><td class="n"><b>${K.covered_pct}%</b></td><td></td><td class="n"><b>${N(K.unique_places)}</b></td><td></td></tr></table>
        <details class="cv-fold"><summary>Not yet covered (${uncovered.length} states and UTs)</summary><div style="font-size:13px;color:var(--ink-2);line-height:1.8">${uncovered.map((r) => esc(r.state)).join(" · ")}</div></details></div>

      <div class="cv-sec"><h2>Data held</h2><p>Counts per kind of data across every run. Overlapping runs repeat the same ground, so the unique figure on top is the one to quote.</p>
        <table class="cv-t"><tr><th>Measure</th><th class="n">Count</th><th>Note</th></tr>
        <tr><td>Unique mapped places</td><td class="n"><b>${N(K.unique_places)}</b></td><td class="mut">Each coverage hexagon keeps its larger count, not the sum of runs.</td></tr>
        <tr><td>Residents inside covered hexagons</td><td class="n"><b>${N(K.unique_population)}</b></td><td class="mut">Modelled counts (WorldPop, HRSL shares, and booth aggregates in Bengaluru).</td></tr>
        <tr><td>Place records across all runs</td><td class="n">${N(K.records_places)}</td><td class="mut">Study and city-scan places, before removing overlaps.</td></tr>
        <tr><td>Building footprints (client studies)</td><td class="n">${N(K.records_buildings)}</td><td class="mut">Bengaluru only; overlapping studies repeat buildings.</td></tr>
        <tr><td>Street segments (client studies)</td><td class="n">${N(K.records_roads)}</td><td class="mut">Each carries a modelled footfall figure.</td></tr>
        <tr><td>Data versions kept</td><td class="n">${N(D.store.versions_kept)}</td><td class="mut">${N(D.store.tiles_total)} stored tiles; ${N(D.store.stale_tiles)} due for refresh (older than ${D.store.fresh_days} days). Old versions are never deleted.</td></tr>
        <tr><td>Coverage hexagons (res 8)</td><td class="n">${N(K.hexagons)}</td><td class="mut">About 0.7 km² each.</td></tr></table></div>


      <div class="cv-sec"><h2>Data versions and freshness</h2><p>Data is stored in tiles of about 5 km, one version per download, and old versions are kept. A request for a place reuses tiles younger than <b>${D.store.fresh_days} days</b> and refreshes older or missing ones on the spot, then uses the newest version. Each report records which versions it used.</p>
        <table class="cv-t"><tr><th>Layer</th><th class="n">Tiles</th><th class="n">Fresh</th><th class="n">Due for refresh</th><th class="n">Versions kept</th><th>Current versions from</th><th class="n">Size</th></tr>
        ${D.store.layers.map((l) => `<tr><td><b>${esc(LAYER[l.layer] || l.layer)}</b><small>${esc(l.layer)}${l.tiles ? "" : " · whole-area files, not tiled"}</small></td><td class="n">${l.tiles ? N(l.tiles) : N(l.files) + "<small>files</small>"}</td><td class="n">${N(l.fresh)}</td><td class="n">${l.stale ? `<span class="cv-p hot">${N(l.stale)}</span>` : "0"}</td><td class="n">${N(l.versions + (l.archived || 0))}${l.archived ? `<small>${N(l.archived)} archived</small>` : ""}</td><td>${l.oldest ? (l.oldest === l.newest ? dt(l.oldest) : dt(l.oldest) + " to " + dt(l.newest)) : "—"}</td><td class="n">${SIZE(l.mb)}</td></tr>`).join("")}</table></div>

      <div class="cv-sec"><h2>Updates and activity</h2><p>Every study or city scan run since the store was introduced, and how much of its data was reused, downloaded for the first time, or refreshed because it was older than ${D.store.fresh_days} days.</p>
        ${D.store.runs.length ? `<table class="cv-t"><tr><th>Run</th><th>Finished</th><th class="n">Tiles used</th><th style="width:200px">Where the data came from</th><th class="n">Reused</th><th class="n">New</th><th class="n">Refreshed</th><th class="n">Took</th></tr>
        ${D.store.runs.map((r) => { const t = Math.max(r.tiles, 1); return `<tr><td><b>${esc(r.label)}</b>${r.fell_back ? ` <span class="cv-p hot">${r.fell_back} older used</span>` : ""}</td><td>${esc(r.at)}</td><td class="n">${N(r.tiles)}</td><td><span class="cv-split"><i style="background:${COLD};width:${(r.reused / t) * 100}%"></i><i style="background:var(--ink);width:${(r.fetched / t) * 100}%"></i><i style="background:${HOT};width:${(r.refreshed / t) * 100}%"></i></span></td><td class="n">${N(r.reused)}</td><td class="n">${N(r.fetched)}</td><td class="n">${N(r.refreshed)}</td><td class="n">${r.seconds >= 90 ? F(r.seconds / 60, 1) + " min" : N(r.seconds) + " s"}</td></tr>`; }).join("")}</table>
        <div class="cv-keyline"><span><i style="background:${COLD}"></i>reused as stored</span><span><i style="background:var(--ink)"></i>downloaded, new area</span><span><i style="background:${HOT}"></i>refreshed, older than the window</span></div>`
          : `<div class="cv-empty" style="padding:26px 0;text-align:left">No run has gone through the store yet. Each new study or city scan will appear here with how much of its data was reused.</div>`}
        <h3 class="cv-h3">Recent changes to the stored data</h3>
        <table class="cv-t"><tr><th>Date</th><th>Layer</th><th>What happened</th><th class="n">Tiles</th><th>Source version</th></tr>
        ${D.store.events.length ? D.store.events.map((e) => `<tr><td>${dt(e.date)}</td><td><b>${esc(LAYER[e.layer] || e.layer)}</b></td><td>${esc(e.what)}</td><td class="n">${N(e.tiles)}</td><td class="mut">${esc(e.version || "—")}</td></tr>`).join("") : '<tr><td colspan="5" class="mut">Nothing in the last 30 days.</td></tr>'}</table></div>

      <div class="cv-sec"><h2>How data is reused and refreshed</h2>
        <table class="cv-t"><tr><th>Rule</th><th>Setting</th></tr>
        <tr><td><b>Freshness window</b><small>A stored tile younger than this is reused. Older or missing tiles are downloaded during the request, then used.</small></td><td>${D.store.rules.fresh_days} days${Object.keys(D.store.rules.layer_overrides).length ? "<small>Overrides: " + Object.entries(D.store.rules.layer_overrides).map(([k, v]) => esc(LAYER[k] || k) + " " + v + " days").join(", ") + "</small>" : "<small>Same for every layer</small>"}</td></tr>
        <tr><td><b>Storage unit</b><small>Places, buildings and population are stored per tile, so nearby requests share data instead of downloading the same ground again.</small></td><td>${D.store.rules.tile_deg}° tiles, about 5 km</td></tr>
        <tr><td><b>Old versions</b><small>Every download is a new version. Nothing is deleted; what to do with old versions is decided later.</small></td><td>${D.store.rules.keep_old_versions ? "All kept" : "Pruned"}</td></tr>
        <tr><td><b>If a refresh fails</b><small>The run uses the older version, says so in its log, and records it as "older used".</small></td><td>Fall back to the old version</td></tr>
        <tr><td><b>Forced refresh</b><small>Re-download everything, ignoring the window.</small></td><td>${D.store.rules.force_refresh ? "On" : "Off"}<small>Switch on with the refresh flag on a run or AGT_FORCE_REFRESH=1</small></td></tr>
        <tr><td><b>Not yet shared across nearby requests</b><small>Road networks and ward and locality boundaries are kept as whole-area files. They are versioned and archived when replaced, but a centre a few hundred metres away downloads them again.</small></td><td>Whole-area files</td></tr>
        <tr><td><b>Traceability</b><small>Each new study records which data versions it used in its provenance file.</small></td><td>On</td></tr></table></div>
      <div class="cv-sec"><h2>By client</h2><p>Names are the business ids recorded in the system.</p>
        <table class="cv-t"><tr><th>Client</th><th class="n">Studies</th><th>Sites</th><th class="n">Area</th><th class="n">Mapped places</th><th class="n">Street segments</th><th class="n">On disk</th><th>Last run</th></tr>
        ${D.clients.map((c) => `<tr><td><b>${esc(c.label)}</b><small>${esc(c.client)}</small></td><td class="n">${c.studies}</td><td>${c.sites.map(esc).join("<br>")}</td><td class="n">${F(c.area_km2)} km²</td><td class="n">${N(c.pois)}</td><td class="n">${N(c.roads)}</td><td class="n">${SIZE(c.size_mb)}</td><td>${dt(c.last)}</td></tr>`).join("")}</table></div>

      <div class="cv-sec"><h2>Client studies</h2>
        <table class="cv-t"><tr><th>Study</th><th>Role</th><th>Centre</th><th class="n">Radius</th><th class="n">Places</th><th class="n">Buildings</th><th class="n">Segments</th><th class="n">Residents</th><th>Sources</th><th>Run</th></tr>
        ${D.studies.map((s) => `<tr${s.duplicate ? ' style="opacity:.55"' : ""}><td><b>${esc(s.client_label)}</b>${s.duplicate ? ' <span class="cv-p">duplicate folder</span>' : ""}<small>${esc(s.locality || s.site || s.id)}</small></td><td>${esc(s.role)}</td><td class="mut">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</td><td class="n">${s.radius_km} km</td><td class="n">${N(s.pois)}</td><td class="n">${N(s.buildings)}</td><td class="n">${N(s.roads)}</td><td class="n">${N(s.population)}</td><td class="mut">${s.osm_snapshot ? "OSM " + esc(s.osm_snapshot) : ""}${s.overture_release ? "<br>Overture " + esc(s.overture_release) : ""}</td><td>${dt(s.generated)}</td></tr>`).join("")}</table></div>

      <div class="cv-sec"><h2>City scans</h2>
        <table class="cv-t"><tr><th>City</th><th>State</th><th class="n">Radius</th><th class="n">Places</th><th class="n">Residents</th><th class="n">Chain outlets</th><th class="n">Hexagons</th><th>Download</th><th>Scanned</th></tr>
        ${D.cities.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.state)}</td><td class="n">${c.radius_km} km</td><td class="n">${N(c.places)}</td><td class="n">${N(c.residents)}</td><td class="n">${c.chains ? N(c.chains) : "—"}</td><td class="n">${N(c.cells)}</td><td>${c.tiles ? c.tiles * c.tiles + " tiles" : "single"}${c.built ? "" : ' <span class="cv-p">benchmark only</span>'}</td><td>${dt(c.scanned)}</td></tr>`).join("")}</table></div>

      <div class="cv-sec"><h2>Datasets we hold</h2><p>Every raw and processed source on disk. “Modelled” means an estimate built from a model, not a measurement.</p>
        <table class="cv-t"><tr><th>Dataset</th><th>Scope</th><th>Covers</th><th class="n">Records</th><th class="n">Files</th><th class="n">Size</th><th>Updated</th><th>Basis</th></tr>
        ${D.datasets.map((d) => `<tr><td><b>${esc(d.name)}</b><small>${esc(d.source)}${d.note ? " · " + esc(d.note) : ""}</small></td><td>${esc(d.scope)}</td><td>${d.scope === "National" ? "All India" : d.states && d.states.length ? esc(d.states.join(", ")) : "—"}</td><td class="n">${N(d.records)}<small>${esc(d.records_label)}</small></td><td class="n">${N(d.files)}</td><td class="n">${SIZE(d.size_mb)}</td><td>${dt(d.updated)}</td><td><span class="cv-p ${/Modelled/.test(d.status) ? "hot" : ""}">${esc(d.status)}</span></td></tr>`).join("")}</table></div>

      <div class="cv-sec"><h2>When work was run</h2><div class="cv-bars">${tl.map((t) => `<div><span>${dt(t.date)}</span><span class="b">${'<i style="background:' + COLD + ";width:" + (t.studies / maxT) * 100 + '%"></i>'}${'<i style="background:' + HOT + ";width:" + (t.cities / maxT) * 100 + '%"></i>'}</span><span>${t.studies ? t.studies + " study run" + (t.studies > 1 ? "s" : "") : ""}${t.studies && t.cities ? " · " : ""}${t.cities ? t.cities + " city scan" + (t.cities > 1 ? "s" : "") : ""}</span></div>`).join("")}</div></div>

      <div class="cv-sec"><h2>Read this first</h2><ul class="cv-note">${D.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div></div>`;
      el.querySelector("#cvRe").onclick = (e) => refresh(e.currentTarget);
      buildMap(D, live, sl, jumps);
    }

    function buildMap(D, live, sl, jumps) {
      const box = el.querySelector("#cvMap"), hxBox = el.querySelector("#cvHx"), leg = el.querySelector("#cvLeg");
      ensureLeaflet().then(() => {
        const L = window.L;
        if (el._map) { el._map.remove(); }
        const map = L.map(box, { zoomControl: true, attributionControl: true, minZoom: 4, maxZoom: 16, zoomSnap: 1, scrollWheelZoom: false, preferCanvas: true, worldCopyJump: false });
        el._map = map; map.attributionControl.setPrefix(false);
        const india = L.latLngBounds([[6, 68], [36.8, 98]]);
        map.fitBounds(india); map.setMaxBounds(L.latLngBounds([[-2, 55], [44, 110]]));
        let tiles = L.tileLayer(dark() ? TILE.dark : TILE.light, { maxNativeZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
        map.createPane("lab"); map.getPane("lab").style.zIndex = 650; map.getPane("lab").style.pointerEvents = "none";
        let labs = L.tileLayer(dark() ? LAB.dark : LAB.light, { pane: "lab", maxNativeZoom: 16 }).addTo(map);
        new MutationObserver(() => { tiles.setUrl(dark() ? TILE.dark : TILE.light); labs.setUrl(dark() ? LAB.dark : LAB.light); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        map.once("click", () => map.scrollWheelZoom.enable());

        const tip = (h) => ({ className: "cv-tip", sticky: true, direction: "auto", opacity: 1, offset: [12, 12] });
        const tileL = L.layerGroup(), hexL = L.layerGroup(), cityL = L.layerGroup(), studyL = L.layerGroup(), rawL = L.layerGroup(), dotL = L.layerGroup();
        let mode = "depth", sel = null;
        const on = { hex: true, city: true, study: true, tiles: false, raw: false, pin: false };
        const maxN = Math.max(...D.hexes.map((h) => h.n), 1), maxP = Math.max(...D.hexes.map((h) => h.p), 1);
        const hexStyle = (h) => {
          let a, c = HOT;
          if (mode === "depth") { const d = h.s.length; a = d >= 3 ? 0.78 : d === 2 ? 0.55 : 0.3; c = d >= 2 ? HOT : COLD; if (d === 1) a = 0.34; }
          else { const v = mode === "n" ? h.n / maxN : h.p / maxP; a = 0.08 + Math.pow(v, 0.5) * 0.72; c = mode === "n" ? HOT : COLD; }
          return { color: dark() ? "#000" : "#fff", weight: 0.4, opacity: 0.35, fillColor: c, fillOpacity: a };
        };
        const polys = D.hexes.map((h) => {
          const p = L.polygon(h.b, hexStyle(h)); p._h = h;
          p.bindTooltip(() => `<b>${N(h.n)}</b> mapped places · <b>${N(h.p)}</b> residents<br>${h.s.length} ${h.s.length === 1 ? "run" : "runs"} reach this hexagon`, tip());
          p.on("click", () => {
            if (sel) sel.setStyle({ weight: 0.4, color: dark() ? "#000" : "#fff" }); sel = p; p.setStyle({ weight: 2, color: dark() ? "#fff" : "#111", opacity: 1 }); p.bringToFront();
            hxBox.innerHTML = `<b>${N(h.n)}</b> mapped places<br><b>${N(h.p)}</b> residents (modelled)<br><br>Reached by ${h.s.length} ${h.s.length === 1 ? "run" : "runs"}:<ul>${h.s.map((x) => `<li>${esc(sl[x] || x)}</li>`).join("")}</ul>`;
          });
          hexL.addLayer(p); return p;
        });
        const paintHex = () => polys.forEach((p) => p.setStyle(hexStyle(p._h)));
        live.forEach((s) => {
          const c = L.circle([s.lat, s.lng], { radius: s.radius_km * 1000, color: COLD, weight: 1.4, fillColor: COLD, fillOpacity: 0.14 });
          c.bindTooltip(`<b>${esc(s.client_label)}</b><br>${esc(s.locality || s.site)} · ${esc(s.role)}<br>${s.radius_km} km · ${N(s.pois)} places · ${dt(s.generated)}`, tip()); studyL.addLayer(c);
          const m = L.circleMarker([s.lat, s.lng], { radius: 9, stroke: false, fillOpacity: 0, fill: true, fillColor: COLD });
          m.bindTooltip(`<b>${esc(s.client_label)}</b><br>${esc(s.locality || s.site)}`, tip()); dotL.addLayer(m);
        });
        D.cities.forEach((c) => {
          const r = L.circle([c.lat, c.lng], { radius: c.radius_km * 1000, color: HOT, weight: 1.4, fillColor: HOT, fillOpacity: 0.14 });
          r.bindTooltip(`<b>${esc(c.name)} city scan</b><br>${c.radius_km} km · ${N(c.places)} places · ${N(c.residents)} residents<br>${dt(c.scanned)}`, tip()); cityL.addLayer(r);
          const m = L.circleMarker([c.lat, c.lng], { radius: 9, stroke: false, fillOpacity: 0, fill: true, fillColor: HOT });
          m.bindTooltip(`<b>${esc(c.name)} city scan</b><br>${N(c.places)} places`, tip()); dotL.addLayer(m);
        });
        D.store.tiles.forEach((t) => {
          const col = t.stale ? HOT : COLD;
          L.rectangle([[t.b[0], t.b[1]], [t.b[2], t.b[3]]], { color: col, weight: 1, dashArray: "1 3", fillColor: col, fillOpacity: 0.07 })
            .bindTooltip(`<b>${t.stale ? "Due for refresh" : "Up to date"}</b> · oldest layer ${F(t.age, 0)} days old<br>${t.layers.map((x) => esc(LAYER[x] || x)).join(", ")}<br>${t.versions} ${t.versions === 1 ? "version" : "versions"} kept`, tip()).addTo(tileL);
        });
        D.raw.forEach((r) => {
          const b = r.bbox; if (!b) return;
          L.rectangle([[b[0], b[1]], [b[2], b[3]]], { color: dark() ? "#9a9aa0" : "#666", weight: 1, dashArray: "2 4", fill: false, interactive: true })
            .bindTooltip(`<b>${esc(r.label)}</b><br>${N(r.rows)} rows · ${SIZE(r.size_mb)} · ${dt(r.updated)}`, tip()).addTo(rawL);
        });

        // ---- PIN-code areas (internal; /api/admin/pin/*). Coarse 3-digit regions when zoomed out, real PIN polygons from city level.
        let pinIdx = null, pinMode = "cov", pinSel = null, pinLook = null, pinStatus = "";
        const pinFine = new Map(), pinPolys = [], pinCoarse = [];
        map.createPane("pin"); map.getPane("pin").style.zIndex = 450;
        const pinR = L.canvas({ pane: "pin", padding: 0.3 });
        const pinCoarseL = L.layerGroup(), pinFineL = L.layerGroup();
        const pinCol = () => dark() ? "#d9d9de" : "#222";
        const pinStyle = (o) => {
          let a;
          if (pinMode === "cov") a = o.h > 0 ? 0.34 : 0.03;
          else { const mx = pinMode === "n" ? (pinIdx.max_n || 1) : (pinIdx.max_r || 1), v = pinMode === "n" ? o.n : o.r; a = v > 0 ? 0.12 + Math.pow(v / mx, 0.45) * 0.68 : 0.02; }
          return { renderer: pinR, pane: "pin", color: pinCol(), weight: 0.7, opacity: 0.55, fillColor: pinMode === "r" ? COLD : HOT, fillOpacity: a };
        };
        const pinTip = (o) => `<b>PIN ${esc(o.p)}</b> · ${esc(o.o)}<br>${esc(o.d)}, ${esc(o.s)}<br>${o.h ? `<b>${N(o.n)}</b> mapped places · <b>${N(o.r)}</b> residents (modelled)` : "No coverage here yet"}`;
        const pinShow = (o) => {
          el.querySelector("#cvPin").innerHTML = `<b>PIN ${esc(o.p)}</b><br>${esc(o.o)} <span class="mut">(${esc(o.t || "")})</span><br>${esc(o.d)}, ${esc(o.s)}<br><span class="mut">${esc(o.v || "")}</span><br><br>${o.h ? `<b>${N(o.n)}</b> mapped places<br><b>${N(o.r)}</b> residents (modelled)<br><span class="mut">across ${N(o.h)} coverage ${o.h === 1 ? "hexagon" : "hexagons"} whose centre lies inside</span>` : "<b>Not covered yet</b><br>No city scan or client study reaches this PIN area."}`;
        };
        const pinSelect = (poly) => {
          if (pinSel) pinSel.setStyle({ weight: 0.7, opacity: 0.55, color: pinCol() });
          pinSel = poly; poly.setStyle({ weight: 2.4, opacity: 1, color: dark() ? "#fff" : "#000" }); poly.bringToFront(); pinShow(poly._o);
        };
        const addFine = (list) => list.forEach((o) => {
          const poly = L.polygon(o.b, pinStyle(o)); poly._o = o;
          poly.bindTooltip(() => pinTip(o), tip());
          poly.on("click", () => pinSelect(poly));
          poly.on("mouseover", () => { if (poly !== pinSel) poly.setStyle({ weight: 1.8, opacity: 0.95 }); });
          poly.on("mouseout", () => { if (poly !== pinSel) poly.setStyle({ weight: 0.7, opacity: 0.55 }); });
          pinFineL.addLayer(poly); pinPolys.push(poly);
        });
        const pinFetch = async (name) => AGT.api("/api/admin/pin/" + name);
        const pinNeed = async () => {
          if (!on.pin) return;
          const z = map.getZoom();
          if (!pinIdx) { pinIdx = await pinFetch("index"); if (pinIdx.empty) { pinStatus = "PIN layer not built yet (run scripts/build_pin_layer.py)."; legend(); return; } }
          if (!pinCoarse.length && z < 9) {
            pinStatus = "Loading PIN regions…"; legend();
            const co = await pinFetch("coarse");
            co.forEach((o) => { const poly = L.polygon(o.b, { renderer: pinR, pane: "pin", color: pinCol(), weight: 0.8, opacity: 0.6, fillColor: HOT, fillOpacity: o.h ? 0.3 : 0.04 }); poly._o = o;
              poly.bindTooltip(`<b>PIN region ${esc(o.k)}xxx</b><br>${esc(o.d)}, ${esc(o.s)}<br>${N(o.c)} PIN areas · ${o.h ? `<b>${N(o.n)}</b> mapped places · <b>${N(o.r)}</b> residents` : "not covered yet"}<br><span style="opacity:.7">Zoom in for individual PIN areas</span>`, tip());
              poly.on("click", () => map.fitBounds(poly.getBounds(), { maxZoom: 10 })); pinCoarseL.addLayer(poly); pinCoarse.push(poly); });
            pinStatus = "";
          }
          if (z >= 9) {
            const b = map.getBounds(), want = [];
            for (let la = Math.floor(b.getSouth()); la <= Math.floor(b.getNorth()); la++) for (let lo = Math.floor(b.getWest()); lo <= Math.floor(b.getEast()); lo++) { const k = `t_${la}_${lo}`; if (pinIdx.chunks.includes(k) && !pinFine.has(k)) want.push(k); }
            if (want.length) { pinStatus = `Loading ${want.length} PIN ${want.length === 1 ? "tile" : "tiles"}…`; legend(); await Promise.all(want.map(async (k) => { pinFine.set(k, 1); try { addFine(await pinFetch(k)); } catch (e) { pinFine.delete(k); } })); pinStatus = ""; }
          }
          legend();
        };
        const pinSync = () => {
          const z = map.getZoom(), w = (l, v) => { if (v && !map.hasLayer(l)) map.addLayer(l); if (!v && map.hasLayer(l)) map.removeLayer(l); };
          w(pinCoarseL, on.pin && z < 9); w(pinFineL, on.pin && z >= 9);
          pinNeed().catch((e) => { pinStatus = "Could not load PIN areas: " + e.message; legend(); });
        };
        const pinLegend = () => `<div style="margin-top:6px;border-top:1px solid var(--line);padding-top:6px"><div><i style="background:${pinMode === "r" ? COLD : HOT};opacity:.5"></i>${pinMode === "cov" ? "PIN area with coverage" : pinMode === "n" ? "few → many mapped places" : "few → many residents"}</div><div><span class="r" style="border:1px solid ${pinCol()};border-radius:2px"></span>${map.getZoom() >= 9 ? "PIN area" : "3-digit PIN region"} · click for detail</div>${pinStatus ? `<div class="cv-pst">${esc(pinStatus)}</div>` : ""}</div>`;
        const pinRepaint = () => { pinPolys.forEach((p) => p.setStyle(pinStyle(p._o))); if (pinSel) pinSel.setStyle({ weight: 2.4, opacity: 1, color: dark() ? "#fff" : "#000" }); };
        const pinFind = async (q) => {
          if (!/^\d{6}$/.test(q)) return;
          try { if (!pinLook) pinLook = await pinFetch("lookup"); } catch (e) { return; }
          const c = pinLook[q]; const box = el.querySelector("#cvPinQ");
          if (!c) { box.setCustomValidity("Not found"); box.reportValidity(); box.setCustomValidity(""); return; }
          if (!on.pin) { on.pin = true; el.querySelector('[data-ly="pin"]').setAttribute("aria-pressed", "true"); }
          map.flyTo(c, 12, { duration: 0.8 });
          map.once("moveend", async () => { await pinNeed(); const hit = pinPolys.find((p) => p._o.p === q); if (hit) pinSelect(hit); });
        };
        map.on("moveend", () => { if (on.pin) pinSync(); });
        const sync = () => {
          const z = map.getZoom(), close = z >= 9;
          const want = (l, v) => { if (v && !map.hasLayer(l)) map.addLayer(l); if (!v && map.hasLayer(l)) map.removeLayer(l); };
          want(hexL, on.hex && z >= 10); want(cityL, on.city); want(studyL, on.study); want(rawL, on.raw); want(tileL, on.tiles && z >= 8);
          want(dotL, (on.city || on.study) && !close);
          pinSync();
          legend();
        };
        const legend = () => {
          const z = map.getZoom(), pals = mode === "depth" ? `<div><i style="background:${COLD};opacity:.4"></i>one run</div><div><i style="background:${HOT};opacity:.55"></i>two runs</div><div><i style="background:${HOT};opacity:.8"></i>three or more</div>`
            : `<div><i style="background:linear-gradient(90deg,color-mix(in srgb,${mode === "n" ? HOT : COLD} 12%,transparent),${mode === "n" ? HOT : COLD})"></i>${mode === "n" ? "few → many places" : "few → many residents"}</div>`;
          leg.innerHTML = `${z >= 10 ? pals : '<div style="color:var(--ink-3)">Zoom in to city level for hexagons</div>'}<div><span class="r" style="border:2px solid ${HOT};background:color-mix(in srgb,${HOT} 18%,transparent)"></span>city scan, 10 km radius</div><div><span class="r" style="border:2px solid ${COLD};background:color-mix(in srgb,${COLD} 18%,transparent)"></span>client study, 5 km radius</div><div style="color:var(--ink-3)">Circles are drawn to true scale, so they are small until you zoom in.</div>${on.pin ? pinLegend() : ""}${on.raw ? `<div><span class="r" style="border-radius:2px;border:1px dashed #888"></span>raw download area</div>` : ""}${on.tiles ? `<div><span class="r" style="border-radius:2px;border:1px dotted ${COLD}"></span>stored tile, up to date</div><div><span class="r" style="border-radius:2px;border:1px dotted ${HOT}"></span>stored tile, due for refresh</div>` : ""}`;
        };
        map.on("zoomend", sync); sync();
        el.querySelectorAll("[data-ly]").forEach((b) => b.onclick = () => { on[b.dataset.ly] = !on[b.dataset.ly]; b.setAttribute("aria-pressed", on[b.dataset.ly]);
          if (b.dataset.ly === "pin" && on.pin && on.hex) { on.hex = false; el.querySelector('[data-ly="hex"]').setAttribute("aria-pressed", "false"); } sync(); });
        el.querySelectorAll("[data-pm]").forEach((b) => b.onclick = () => { pinMode = b.dataset.pm; el.querySelectorAll("[data-pm]").forEach((x) => x.setAttribute("aria-pressed", x === b)); pinRepaint(); legend(); });
        el.querySelector("#cvPinQ").addEventListener("keydown", (e) => { if (e.key === "Enter") pinFind(e.target.value.trim()); });
        el.querySelectorAll("[data-hm]").forEach((b) => b.onclick = () => { mode = b.dataset.hm; el.querySelectorAll("[data-hm]").forEach((x) => x.setAttribute("aria-pressed", x === b)); paintHex(); legend(); });
        el.querySelectorAll("[data-j]").forEach((b) => b.onclick = () => { if (b.dataset.j === "all") { map.fitBounds(india); return; } const j = jumps[+b.dataset.j]; map.flyTo([j.lat, j.lng], 11, { duration: 0.8 }); });
        setTimeout(() => map.invalidateSize(), 200);
        if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe(box);
      }).catch(() => { box.innerHTML = '<p style="padding:24px;color:var(--ink-3)">The map library could not load. Check the connection and reload.</p>'; });
    }
    load();
  }
  window.CovDash = { mount };
})();
