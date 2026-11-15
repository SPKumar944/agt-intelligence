/* AGT Intelligence — interactive platform architecture (technology.html).
 * Click a component for its role, technologies and design choices; trace a workflow end to end; see how chunked storage reads only what a query needs. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $("#archStage"); if (!stage) return;

  const COLS = [
    { id: "src", t: "Sources" }, { id: "prep", t: "Ingest & prepare" }, { id: "lake", t: "Spatial lake" }, { id: "model", t: "Model engine" }, { id: "out", t: "Delivery" },
  ];
  const N = {
    // ---- sources
    mob: { col: "src", icon: "walking", t: "Mobility signals", s: "Aggregated visits and flows",
      d: "Anonymised device observations, aggregated to hexagons and time windows before they reach us. They tell us where a site's visitors spend the night and the working day, and how flows change by hour.",
      tech: ["Aggregated visit counts by hexagon × hour", "Origin–destination flows", "Minimum-count thresholds per cell"],
      why: ["Real trade areas instead of rings", "Hour-of-week footfall calibration", "No individual traces ever handled"] },
    demo: { col: "src", icon: "user-group", t: "Demographics", s: "Census and population aggregates",
      d: "Population by age band, gender and household type, joined to small areas and reallocated to hexagons so every layer shares one grid.",
      tech: ["Small-area aggregates", "Dasymetric reallocation to H3", "Daytime population estimates"], why: ["Target-customer concentration", "Spending power and household mix", "Whitespace demand side"] },
    places: { col: "src", icon: "store", t: "Places & brands", s: "Overture Maps, OpenStreetMap",
      d: "Businesses, brands and anchors classified into a retail taxonomy, de-duplicated across sources and matched to brand tiers.",
      tech: ["Overture Maps places", "OpenStreetMap points of interest", "Brand and category matching"], why: ["Competition and co-tenancy", "Footfall generators", "Whitespace supply side"] },
    net: { col: "src", icon: "road", t: "Road & transit networks", s: "Roads, footpaths, metro, bus",
      d: "The routable network: road classes, footpaths and public-transport lines and stops, used for travel times and for barriers people rarely cross.",
      tech: ["OpenStreetMap road and path graph", "Transit lines and stops", "Speed profiles by road class"], why: ["Drive and walk-time isochrones", "Barrier-aware catchments", "Transit reach"] },
    eo: { col: "src", icon: "map", t: "Satellite & terrain", s: "Imagery, land cover, elevation",
      d: "Earth-observation layers — built-up density, land cover, night lights and terrain — that describe places where other data is thin.",
      tech: ["Multispectral imagery", "Land-cover classifications", "Elevation models"], why: ["Built-environment features", "Growth corridors", "Gaps in other sources"] },
    client: { col: "src", icon: "briefcase", t: "Client data", s: "Stores, sales, formats",
      d: "Your store list, formats, opening dates and — when available — store-level sales. This is what turns scores into calibrated revenue forecasts.",
      tech: ["Store master and attributes", "Sales by store and period", "Handled under client agreement"], why: ["Model training and back-testing", "Cannibalisation baselines", "Network context"] },
    // ---- ingest & prepare
    gee: { col: "prep", icon: "layers", t: "Google Earth Engine", s: "Planetary-scale preprocessing",
      d: "Imagery and terrain are composited, cloud-masked and summarised in Earth Engine once, then exported as analysis-ready rasters.",
      tech: ["Server-side compositing", "Zonal statistics per hexagon", "Export to cloud-optimised rasters"], why: ["Prepare once, reuse everywhere", "No raw imagery handled locally", "Reproducible recipes"] },
    clean: { col: "prep", icon: "shield", t: "Validation & cleaning", s: "Schemas, de-duplication, QA rules",
      d: "Every source passes schema checks, range checks and de-duplication; anything suspicious is quarantined rather than silently dropped.",
      tech: ["Typed schemas per source", "Fuzzy de-duplication of places", "Provenance stamped on each record"], why: ["Errors caught before modelling", "Every number traceable", "Repeatable runs"] },
    h3: { col: "prep", icon: "hexagon", t: "H3 indexing", s: "Hexagons at 65 m and coarser",
      d: "Points, lines and rasters are assigned to Uber's H3 hexagonal grid, so any two layers join on a cell ID instead of an expensive spatial join.",
      tech: ["Resolution 10 (≈65 m) for scoring", "Coarser parents for metro scans", "Polyfill for areas, k-rings for neighbourhoods"], why: ["Uniform neighbours, no edge bias", "Fast joins at any scale", "Consistent across cities"] },
    graph: { col: "prep", icon: "signpost", t: "Network builder", s: "Routable multimodal graph",
      d: "Builds a routable graph from roads, paths and transit, with travel speeds by mode and time of day.",
      tech: ["Contracted road graph", "Walk + transit transfers", "Time-of-day speed profiles"], why: ["Isochrones in milliseconds", "Real barriers respected", "Same graph for every model"] },
    // ---- lake
    gpq: { col: "lake", icon: "database", t: "GeoParquet", s: "Columnar vector store",
      d: "Points, roads and trade-area polygons stored as columnar GeoParquet, partitioned by region and sorted spatially so queries skip what they don't need.",
      tech: ["Row groups with bounding-box statistics", "Predicate and column pushdown", "Readable from Python, SQL and GIS tools"], why: ["Read a city, not a country", "Cheap object storage", "Open standard, no lock-in"] },
    zarr: { col: "lake", icon: "layers", t: "Zarr", s: "Chunked arrays & time-series",
      d: "Rasters and hour-by-hour mobility cubes stored as compressed chunks, so a 5 km catchment over one week reads a handful of chunks, not the whole archive.",
      tech: ["Chunks by space × time", "Parallel, cloud-native reads", "Compression per chunk"], why: ["Mobility time-series at scale", "Fast slicing by place and hour", "Works with xarray and Dask"] },
    feat: { col: "lake", icon: "table", t: "Feature store", s: "Per-hexagon model features",
      d: "Hundreds of features per hexagon — footfall by daypart, demographics, competition, access — computed once and versioned for every model to use.",
      tech: ["Versioned feature tables", "Point-in-time correctness", "Shared by scoring and forecasting"], why: ["Same inputs everywhere", "Reproducible forecasts", "Fast scoring of any site"] },
    cat: { col: "lake", icon: "file-text", t: "Catalogue & provenance", s: "Sources, dates, licences",
      d: "A catalogue records every dataset's source, date, licence and transformation, and travels with each output into reports.",
      tech: ["Dataset lineage", "Licence and refresh tracking", "Provenance on every output"], why: ["Committees see where numbers come from", "Licences respected", "Audit trail"] },
    // ---- model engine
    catch: { col: "model", icon: "map", t: "Catchment engine", s: "Isochrones and visitor origins",
      d: "Builds trade areas from travel time on the network and from where visitors come from, then splits them into primary and secondary zones.",
      tech: ["Drive, walk and transit isochrones", "Origin-weighted trade areas", "Primary / secondary capture contours"], why: ["Trade areas that follow reality", "Barrier-aware", "Comparable across sites"] },
    huff: { col: "model", icon: "radar", t: "Gravity & Huff models", s: "Store choice and sales transfer",
      d: "Spatial-interaction models estimate how customers in each hexagon choose between stores, before and after a new opening.",
      tech: ["Huff probability with distance decay", "Attractiveness from size and brand", "Calibrated decay per format"], why: ["Cannibalisation in rupees", "Network optimisation", "Explainable by design"] },
    torch: { col: "model", icon: "cpu", t: "Revenue models (PyTorch)", s: "Custom forecasting networks",
      d: "Forecasting networks trained on store performance and the feature store, producing P10/P50/P90 revenue for any candidate site.",
      tech: ["Tabular + spatial-context networks", "Quantile outputs for ranges", "Back-tested on held-out stores"], why: ["Revenue, not just a score", "Honest uncertainty", "Improves as the network grows"] },
    mlx: { col: "model", icon: "laptop", t: "Apple MLX", s: "Local iteration on Apple Silicon",
      d: "Model prototyping runs locally on high-memory Apple Silicon with MLX, using unified memory to iterate on large feature sets before training at scale.",
      tech: ["Unified memory for large batches", "Fast experiment loops", "Models exported for cloud inference"], why: ["Faster research cycles", "Lower experimentation cost", "Same code path to production"] },
    xai: { col: "model", icon: "sparkles", t: "Explainability", s: "Driver attribution per prediction",
      d: "Every score and forecast is decomposed into its drivers — with weights, values and percentiles — so a committee can see why.",
      tech: ["Additive attribution per prediction", "Driver percentiles vs the market", "What-if re-weighting"], why: ["No black-box decisions", "Assumptions debated openly", "Trust that survives scrutiny"] },
    // ---- delivery
    rep: { col: "out", icon: "file-text", t: "Site reports", s: "Committee-ready, on demand",
      d: "A complete pack per site — trade area, forecast with range, drivers, cannibalisation and risks — generated from the same engine as the platform.",
      tech: ["Consistent structure per site", "Sources and assumptions listed", "Export to PDF"], why: ["Decision-ready", "Comparable across candidates", "Fast turnaround"] },
    app: { col: "out", icon: "map", t: "Interactive platform", s: "Maps, scores, scenarios",
      d: "A secure web platform to explore sites, hours, layers and scenarios, and to share an exact view with colleagues.",
      tech: ["Sign-in and access control", "Scenario comparison", "Shareable views"], why: ["Self-serve exploration", "One version of the truth", "Faster alignment"] },
    api: { col: "out", icon: "share", t: "Exports & API", s: "CSV, GeoJSON, GeoParquet",
      d: "Every layer behind the map is available as files or through an API for your GIS, BI and finance models.",
      tech: ["CSV, GeoJSON, GeoParquet", "Programmatic access", "Versioned deliveries"], why: ["Your data stays yours", "Fits existing tools", "Repeatable analysis"] },
    // ---- bands
    qgis: { col: "band", icon: "crosshair", t: "Human verification (QGIS)", s: "Spatial sanity checks before release",
      d: "Analysts review outputs in QGIS — trade-area shapes, competitor matches, outliers — before anything reaches a committee.",
      tech: ["Visual QA of every site", "Spot checks of matched places", "Sign-off before release"], why: ["Automation with accountability", "Errors caught by people who know the city", "Confidence in every pack"] },
    gov: { col: "band", icon: "lock", t: "Privacy & governance", s: "Aggregation, access, licences",
      d: "Privacy and governance rules apply across the stack: aggregate-only people data, access control, licence compliance and provenance.",
      tech: ["Aggregate-only population and mobility", "Role-based access", "Licence and retention policies"], why: ["No individual is identifiable", "Client data isolated", "Defensible data use"] },
  };
  const E = [
    ["mob", "clean"], ["mob", "h3"], ["demo", "clean"], ["demo", "h3"], ["places", "clean"], ["net", "graph"], ["eo", "gee"], ["client", "clean"],
    ["gee", "zarr"], ["clean", "gpq"], ["clean", "cat"], ["h3", "feat"], ["h3", "zarr"], ["h3", "gpq"], ["graph", "gpq"],
    ["gpq", "catch"], ["gpq", "huff"], ["zarr", "catch"], ["zarr", "feat"], ["feat", "torch"], ["feat", "mlx"], ["feat", "huff"], ["cat", "rep"],
    ["mlx", "torch"], ["torch", "xai"], ["huff", "xai"], ["catch", "huff"],
    ["catch", "app"], ["xai", "rep"], ["xai", "app"], ["huff", "rep"], ["torch", "api"], ["catch", "rep"], ["xai", "api"],
  ];
  const TRACES = {
    report: { t: "Generate a site report", steps: [
      ["client", "You add a candidate address; it is geocoded and indexed to its <b>H3 cell</b>."],
      ["h3", "The site's neighbourhood is expanded into hexagon rings — the unit every layer joins on."],
      ["gpq", "<b>GeoParquet</b> returns only the row groups whose bounding boxes touch the area: roads, places, competitors."],
      ["zarr", "<b>Zarr</b> returns the mobility chunks for those cells and the hours that matter to the format."],
      ["catch", "The <b>catchment engine</b> builds the travel-time trade area and the visitor-origin footprint."],
      ["huff", "<b>Huff models</b> estimate overlap and sales transfer against every existing store."],
      ["torch", "The <b>revenue model</b> scores the site from the feature store and returns P10 / P50 / P90."],
      ["xai", "<b>Explainability</b> decomposes the score and forecast into weighted drivers."],
      ["qgis", "An analyst checks the trade area and matches in <b>QGIS</b>."],
      ["rep", "The <b>site report</b> is generated with sources, assumptions and ranges."] ] },
    whitespace: { t: "Run a metro whitespace scan", steps: [
      ["demo", "Target-customer counts are taken from <b>population aggregates</b> for the chosen segment."],
      ["places", "Existing category stores and competitors are pulled from <b>places data</b>."],
      ["h3", "Both are rolled up to <b>H3 cells</b> across the whole metro area."],
      ["feat", "The <b>feature store</b> adds access and footfall context per cell."],
      ["huff", "Supply coverage is modelled with <b>gravity</b> decay from each store."],
      ["xai", "Demand minus coverage gives an opportunity score; pockets are clustered and explained."],
      ["app", "Pockets appear on the <b>platform</b>, ready to shortlist sites inside them."] ] },
    retrain: { t: "Retrain the forecast model", steps: [
      ["client", "New monthly <b>store sales</b> arrive under the client agreement."],
      ["clean", "They are validated and stamped with provenance."],
      ["feat", "Point-in-time features are joined from the <b>feature store</b> — no leakage from the future."],
      ["mlx", "Candidate architectures are iterated locally with <b>MLX</b> on Apple Silicon."],
      ["torch", "The chosen model is trained in <b>PyTorch</b> and back-tested on held-out stores."],
      ["xai", "Driver attributions are checked for sense before release."],
      ["api", "The new model version is published; forecasts and <b>exports</b> carry its version."] ] },
  };

  // ---------------------------------------------------------------- render
  const grid = $("#archGrid"), bands = $("#archBands");
  grid.innerHTML = COLS.map((c, i) => `<div class="arch-col"><h5><i>0${i + 1}</i>${c.t}</h5><div class="nodes">` +
    Object.entries(N).filter(([, n]) => n.col === c.id).map(([id, n]) =>
      `<button type="button" class="anode" data-n="${id}"><svg class="ico" data-icon="${n.icon}"></svg><b>${n.t}</b><span>${n.s}</span></button>`).join("") + `</div></div>`).join("");
  bands.innerHTML = ["qgis", "gov"].map((id) => `<button type="button" class="anode" data-n="${id}"><svg class="ico" data-icon="${N[id].icon}"></svg><b>${N[id].t}</b><span>${N[id].s}</span></button>`).join("");
  $$("svg[data-icon]", stage).forEach((s) => window.agtIcon && agtIcon(s));

  const svg = $("#archSvg"), NS = "http://www.w3.org/2000/svg";
  let paths = [];
  function drawEdges() {
    svg.innerHTML = ""; paths = [];
    if (getComputedStyle(svg).display === "none") return;
    const sr = stage.getBoundingClientRect();
    for (const [a, b] of E) {
      const A = $(`.anode[data-n="${a}"]`, stage).getBoundingClientRect(), B = $(`.anode[data-n="${b}"]`, stage).getBoundingClientRect();
      let x1, y1, x2, y2, d;
      if (Math.abs(A.left - B.left) < 4) {                      // same column: vertical hop on the right edge
        x1 = A.right - sr.left; y1 = A.top + A.height / 2 - sr.top; x2 = B.right - sr.left; y2 = B.top + B.height / 2 - sr.top;
        d = `M${x1},${y1} C${x1 + 22},${y1} ${x2 + 22},${y2} ${x2},${y2}`;
      } else {
        x1 = A.right - sr.left; y1 = A.top + A.height / 2 - sr.top; x2 = B.left - sr.left; y2 = B.top + B.height / 2 - sr.top;
        const mx = (x1 + x2) / 2; d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      }
      const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.dataset.a = a; p.dataset.b = b; svg.appendChild(p); paths.push(p);
    }
  }

  // ---------------------------------------------------------------- selection + detail
  const detail = $("#archDetail");
  function show(id) {
    const n = N[id]; if (!n) return;
    detail.innerHTML = `<div><span class="kicker">${n.col === "band" ? "Across the stack" : COLS.find((c) => c.id === n.col).t}</span><h4>${n.t}</h4><p>${n.d}</p></div>
      <div><h6>How it works</h6><ul>${n.tech.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <div><h6>Why it matters</h6><ul>${n.why.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
  }
  function select(id, { trace = false } = {}) {
    $$(".anode", stage).forEach((b) => b.classList.remove("sel", "lit"));
    paths.forEach((p) => p.classList.remove("lit"));
    if (!id) { stage.classList.remove("dim"); return; }
    stage.classList.add("dim");
    const me = $(`.anode[data-n="${id}"]`, stage); me && me.classList.add("sel");
    if (!trace) {
      E.forEach(([a, b]) => { if (a === id || b === id) { $(`.anode[data-n="${a === id ? b : a}"]`, stage).classList.add("lit"); } });
      paths.forEach((p) => { if (p.dataset.a === id || p.dataset.b === id) p.classList.add("lit"); });
    }
    show(id);
  }
  stage.addEventListener("click", (e) => { const b = e.target.closest(".anode"); if (b) { stopTrace(); select(b.dataset.n); } });

  // ---------------------------------------------------------------- traces
  const tbar = $("#traceBar"); let tr = null, ti = 0, timer = null;
  function stopTrace() { clearInterval(timer); timer = null; tr = null; tbar.classList.remove("on"); $$("[data-trace]").forEach((b) => b.setAttribute("aria-pressed", "false")); }
  function step(i) {
    const S = TRACES[tr].steps; ti = Math.max(0, Math.min(S.length - 1, i));
    const seen = S.slice(0, ti + 1).map((s) => s[0]);
    select(S[ti][0], { trace: true });
    seen.forEach((id) => { const n = $(`.anode[data-n="${id}"]`, stage); n && id !== S[ti][0] && n.classList.add("lit"); });
    for (let k = 1; k <= ti; k++) paths.forEach((p) => { if ((p.dataset.a === S[k - 1][0] && p.dataset.b === S[k][0]) || (p.dataset.b === S[k - 1][0] && p.dataset.a === S[k][0])) p.classList.add("lit"); });
    $("#traceNum").textContent = `Step ${ti + 1} of ${S.length}`; $("#traceText").innerHTML = S[ti][1];
    $("#tracePrev").disabled = ti === 0; $("#traceNext").textContent = ti === S.length - 1 ? "Restart" : "Next";
  }
  $$("[data-trace]").forEach((b) => b.addEventListener("click", () => {
    stopTrace(); tr = b.dataset.trace; b.setAttribute("aria-pressed", "true"); tbar.classList.add("on"); step(0);
    timer = setInterval(() => { if (ti >= TRACES[tr].steps.length - 1) { clearInterval(timer); timer = null; return; } step(ti + 1); }, 2600);
  }));
  $("#tracePrev").addEventListener("click", () => { clearInterval(timer); timer = null; step(ti - 1); });
  $("#traceNext").addEventListener("click", () => { clearInterval(timer); timer = null; step(ti >= TRACES[tr].steps.length - 1 ? 0 : ti + 1); });
  $("#traceStop").addEventListener("click", () => { stopTrace(); select(null); show("gpq"); });

  drawEdges(); show("gpq");
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { drawEdges(); if (tr) step(ti); }, 150); });
  if (document.fonts) document.fonts.ready.then(drawEdges);

  // ================================================================ chunked-read demo
  (function chunks() {
    const box = $("#chunks"); if (!box) return;
    const COLSN = 28, ROWS = 16, total = COLSN * ROWS;
    box.style.gridTemplateColumns = `repeat(${COLSN}, 1fr)`;
    box.innerHTML = Array.from({ length: total }, () => "<i></i>").join("");
    const cells = [...box.children], ring = $("#chunkRing"), rad = $("#chunkRad");
    let cx = .5, cy = .5;
    function run() {
      const r = box.getBoundingClientRect(), pad = 18, cw = (r.width - pad * 2) / COLSN, R = +rad.value / 100 * (r.width - pad * 2) / 2;
      rad.style.setProperty("--p", ((rad.value - rad.min) / (rad.max - rad.min) * 100) + "%");
      const px = pad + cx * (r.width - pad * 2), py = pad + cy * (r.height - pad * 2);
      ring.style.left = px + "px"; ring.style.top = py + "px"; ring.style.width = ring.style.height = R * 2 + "px";
      let hit = 0;
      cells.forEach((c, i) => {
        const col = i % COLSN, row = Math.floor(i / COLSN), x0 = pad + col * cw, y0 = pad + row * ((r.height - pad * 2) / ROWS), ch = (r.height - pad * 2) / ROWS;
        const nx = Math.max(x0, Math.min(px, x0 + cw)), ny = Math.max(y0, Math.min(py, y0 + ch));
        const on = Math.hypot(nx - px, ny - py) <= R; c.classList.toggle("hit", on); hit += on;
      });
      $("#chunkHit").textContent = hit; $("#chunkPct").textContent = (hit / total * 100).toFixed(1) + "%";
      $("#chunkTot").textContent = total;
    }
    const move = (e) => { const r = box.getBoundingClientRect(); cx = Math.max(0, Math.min(1, (e.clientX - r.left - 18) / (r.width - 36))); cy = Math.max(0, Math.min(1, (e.clientY - r.top - 18) / (r.height - 36))); run(); };
    box.addEventListener("pointermove", move); box.addEventListener("pointerdown", move);
    rad.addEventListener("input", run); addEventListener("resize", run); run();
  })();
})();
