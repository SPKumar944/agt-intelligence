/* In-dashboard reports: an executive summary of the recommended locations and a detailed report for the top-ranked one.
   View only (no download, printing is switched off in CSS). Everything is computed from the study already loaded in the dashboard. */
(function () {
  "use strict";
  const E = (s) => esc(s == null ? "" : String(s));
  const hav = (a, b, c, d) => { const R = 6371008.8, r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r, x = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const km = (m) => (m / 1000).toFixed(1) + " km";
  const area = () => { const p = D.site.profile || {}; return (PLAN && PLAN.area && PLAN.area.label) || p.store_name || "the study area"; };
  const cands = () => (D.layers.candidates || []).slice().sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const dim = [["demographic_score", "Demographics"], ["commercial_score", "Commercial activity"], ["synergy_score", "Nearby demand drivers"], ["white_space_score", "White space"]];

  /* ---------- small graphics ---------- */
  const bars = (rows, f = compact) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return `<div class="rp-bars">${rows.map(([l, v]) => `<div class="rp-b"><span>${E(l)}</span><div><i style="width:${Math.max(2, v / mx * 100)}%"></i></div><b>${f(v)}</b></div>`).join("")}</div>`; };
  const score = (rows) => `<div class="rp-bars">${rows.map(([l, v]) => `<div class="rp-b"><span>${E(l)}</span><div><i style="width:${Math.max(2, v)}%"></i></div><b>${fmt(v, 0)}</b></div>`).join("")}</div>`;
  const kpi = (l, v, s) => `<div class="rp-k"><span>${E(l)}</span><b>${v}</b>${s ? `<em>${s}</em>` : ""}</div>`;
  const cols = (vals, hi) => { const mx = Math.max(1, ...vals); return `<div class="rp-cols">${vals.map((v, i) => `<i style="height:${Math.max(6, v / mx * 100)}%" class="${i === hi ? "pk" : ""}" title="${hh(i)}"></i>`).join("")}</div><div class="rp-ax"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>`; };

  /* ---------- executive report ---------- */
  function executive() {
    const C = cands(), s = D.site, pop = s.population, eco = B().economics || {}, unit = UNIT();
    const direct = (D.layers.competitors || []).filter((c) => c.is_direct_competitor && !c.is_client_store).length;
    const biz = Object.values(s.poi_counts || {}).reduce((a, v) => a + v, 0);
    const totUnits = C.reduce((a, c) => a + (c.marginal_units != null ? c.marginal_units : c.projected_daily_units || 0), 0);
    const totRev = C.reduce((a, c) => a + (c.projected_monthly_revenue_lakhs || 0), 0);
    const pay = C.map((c) => c.est_payback_months).filter((x) => x != null).sort((a, b) => a - b), medPay = pay.length ? pay[Math.floor(pay.length / 2)] : null;
    const top = C[0], fast = C.slice().sort((a, b) => (a.est_payback_months || 1e9) - (b.est_payback_months || 1e9))[0], big = C.slice().sort((a, b) => (b.projected_daily_units || 0) - (a.projected_daily_units || 0))[0];
    const hrs = ffHours(S.day), pk = hrs.indexOf(Math.max(...hrs));
    const mix = Object.entries(s.poi_counts || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), v]);
    if (!C.length) return `<p class="rp-p">No recommended locations are available for this study yet.</p>`;
    return `
    <div class="rp-hd"><div class="rp-eb">Executive report</div><h2>${E(B().display_name || "Site intelligence")} · ${E(area())}</h2>
      <div class="rp-meta">${E(B().format || "")} · ${E(s.radius_km)} km study area · generated ${E((s.provenance.generated_at || "").slice(0, 10))}</div></div>
    <div class="rp-kg">
      ${kpi("Recommended locations", fmt(C.length))}
      ${kpi("Expected sales", fmt(totUnits), E(unit) + " across the network")}
      ${kpi("Expected revenue", "₹" + fmt(totRev, 1) + " L", "per month, central estimate")}
      ${kpi("Typical payback", medPay != null ? fmt(medPay, 0) + " months" : "–", "median across locations")}
    </div>
    <h3>Summary</h3>
    <ul class="rp-ul">
      <li>We analysed <b>${E(area())}</b> within ${E(s.radius_km)} km: <b>${compact(pop.pop)}</b> residents, <b>${compact(pop.day_pop)}</b> daytime population, <b>${fmt(direct)}</b> direct competitors and <b>${compact(biz)}</b> mapped businesses.</li>
      <li><b>${fmt(C.length)} new locations</b> are recommended. Together they are expected to add about <b>${fmt(totUnits)} ${E(unit)}</b> and <b>₹${fmt(totRev, 1)} lakh a month</b>, after allowing for customers shared with each other and with your existing outlets.</li>
      <li>The leading pick is <b>${E(top.name)}</b>: ${fmt(top.frontage_peak_hourly)} people an hour at peak, suitability ${fmt(top.overall_suitability_score, 0)} out of 100, payback about ${fmt(top.est_payback_months, 0)} months.</li>
      ${big && big !== top ? `<li>The highest expected sales are at <b>${E(big.name)}</b> (${fmt(big.projected_daily_units)} ${E(unit)}).</li>` : ""}
      ${fast && fast !== top ? `<li>The fastest payback is at <b>${E(fast.name)}</b> (${fmt(fast.est_payback_months, 0)} months).</li>` : ""}
    </ul>
    <h3>Recommended locations</h3>
    <div class="rp-tw"><table class="rp-t"><thead><tr><th>#</th><th>Location</th><th>Type</th><th class="n">Peak footfall / hr</th><th class="n">${E(unit)}</th><th class="n">Revenue ₹ L / mo</th><th class="n">Payback (mo)</th><th class="n">Suitability</th></tr></thead><tbody>
      ${C.map((c) => `<tr class="${c.rank === 1 ? "top" : ""}"><td>${c.rank}</td><td><b>${E(c.name)}</b></td><td>${E(c.corridor_type)}</td><td class="n">${fmt(c.frontage_peak_hourly)}</td><td class="n">${fmt(c.projected_daily_units)}</td><td class="n">${fmt(c.projected_monthly_revenue_lakhs, 1)}</td><td class="n">${fmt(c.est_payback_months, 0)}</td><td class="n">${fmt(c.overall_suitability_score, 0)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="rp-note">Locations are ordered by peak-hour footfall. Expected sales also depend on local demand and nearby competitors, so a lower-ranked location can sell more. Revenue assumes ₹${fmt(eco.avg_ticket_inr)} per bill.</p>
    <div class="rp-two">
      <div><h3>Footfall through the day</h3><div class="rp-sub">Average street, ${E(DAYS[S.day])}. Busiest at ${hh(pk)}.</div>${cols(hrs, pk)}</div>
      <div><h3>What is on the ground</h3><div class="rp-sub">Mapped businesses by category</div>${bars(mix)}</div>
    </div>
    <h3>How to read this report</h3>
    <p class="rp-p">Footfall, demand, sales and revenue are modelled estimates, not measurements. Each recommended location also has a range (shown in its detailed report) because inputs such as customer spend and competitor strength are uncertain. Use the ranking to shortlist, then confirm with on-ground pedestrian counts at the peak hours before committing. The sources and assumptions are listed under Data &amp; method.</p>`;
  }

  /* ---------- detailed report for the top location ---------- */
  function detailed() {
    const C = cands(), c = C[0]; if (!c) return `<p class="rp-p">No recommended location is available yet.</p>`;
    const unit = UNIT(), eco = B().economics || {}, L = D.layers, near = (arr, r) => (arr || []).filter((x) => x.lat != null && hav(c.lat, c.lng, x.lat, x.lng) <= r);
    const drivers = [["Restaurants and cafes", "dining"], ["Kids and family venues", "kids"], ["Schools and colleges", "education"], ["Transit stops", "transit"], ["Offices", "offices"], ["Tech parks", "techparks"]].map(([l, k]) => [l, near(L[k], 1000).length]).filter((r) => r[1] > 0);
    const rivals = (L.competitors || []).filter((x) => x.is_direct_competitor && !x.is_client_store && x.lat != null).map((x) => ({ n: x.brand || x.store_name || "Competitor", d: hav(c.lat, c.lng, x.lat, x.lng) })).sort((a, b) => a.d - b.d);
    const r15 = rivals.filter((x) => x.d <= 1500).length, r3 = rivals.filter((x) => x.d <= 3000).length;
    const cor = (L.corridors || []).find((x) => x.street_name === c.frontage_street);
    const rank = (key) => 1 + C.filter((o) => (o[key] || 0) > (c[key] || 0)).length;
    const strengths = [], watch = [];
    if (rank("frontage_peak_hourly") === 1) strengths.push(`The busiest peak-hour frontage of the ${C.length} shortlisted (${fmt(c.frontage_peak_hourly)} people an hour, ${E(c.peak_window || "evening")}).`);
    dim.forEach(([k, l]) => { if ((c[k] || 0) >= 80) strengths.push(`${l} score is high at ${fmt(c[k], 0)} out of 100${rank(k) === 1 ? ", the best of the shortlist" : ""}.`); else if ((c[k] || 0) < 40) watch.push(`${l} score is low at ${fmt(c[k], 0)} out of 100.`); });
    if (c.projected_daily_units && c.projected_daily_units === Math.max(...C.map((o) => o.projected_daily_units || 0))) strengths.push(`Highest expected sales of the shortlist (${fmt(c.projected_daily_units)} ${E(unit)}).`);
    if ((c.est_payback_months || 0) > 24) watch.push(`Payback is long at ${fmt(c.est_payback_months, 0)} months.`);
    if ((c.cannibalization_risk_pct || 0) >= 5) watch.push(`It would take about ${fmt(c.cannibalization_risk_pct, 1)}% of sales from your existing outlets.`);
    if (r15 >= 3) watch.push(`${fmt(r15)} direct competitors are within 1.5 km.`);
    if (!strengths.length) strengths.push("A balanced profile across demand, activity and competition.");
    if (!watch.length) watch.push("No major concerns in the modelled data. Confirm on the ground.");
    const lo = c.ci_rev_p10, hi = c.ci_rev_p90;
    return `
    <div class="rp-hd"><div class="rp-eb">Detailed report · top-ranked location</div><h2>${E(c.name)}</h2>
      <div class="rp-meta">${E(c.corridor_type)} · ${km((c.min_distance_km || 0) * 1000)} from your nearest outlet · ${E(area())}</div></div>
    <div class="rp-kg">
      ${kpi("Peak footfall", fmt(c.frontage_peak_hourly) + "<u> / hr</u>", E(c.peak_window || ""))}
      ${kpi("Expected sales", fmt(c.projected_daily_units), E(unit))}
      ${kpi("Revenue", "₹" + fmt(c.projected_monthly_revenue_lakhs, 1) + " L", lo != null ? "range ₹" + fmt(lo, 1) + "–" + fmt(hi, 1) + " L / mo" : "per month")}
      ${kpi("Payback", fmt(c.est_payback_months, 0) + "<u> months</u>", eco.capex_lakhs ? "on a ₹" + fmt(eco.capex_lakhs) + " L set-up" : "")}
    </div>
    <div class="rp-two">
      <div class="rp-card"><h3>Why it ranks first</h3><ul class="rp-ul">${strengths.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <div class="rp-card"><h3>Points to watch</h3><ul class="rp-ul">${watch.map((x) => `<li>${x}</li>`).join("")}</ul></div>
    </div>
    <div class="rp-two">
      <div><h3>Score breakdown</h3><div class="rp-sub">Overall suitability ${fmt(c.overall_suitability_score, 0)} out of 100. Each part is a percentile within the study area.</div>${score(dim.map(([k, l]) => [l, c[k] || 0]))}</div>
      <div><h3>Street footfall</h3><div class="rp-sub">${E(c.frontage_street || "Frontage street")}</div>
        <div class="rp-mini">${cor ? `<div><span>Per day</span><b>${compact(cor.daily_footfall)}</b></div><div><span>Weekend day</span><b>${compact(cor.weekend_daily_footfall)}</b></div><div><span>Peak hour</span><b>${fmt(cor.peak_hourly_footfall)}</b></div>` : `<div><span>Peak hour</span><b>${fmt(c.frontage_peak_hourly)}</b></div><div><span>Per day</span><b>${compact(c.frontage_daily_footfall)}</b></div>`}</div>
      </div>
    </div>
    <div class="rp-two">
      <div><h3>Demand drivers within 1 km</h3><div class="rp-sub">Places that bring people to the area</div>${drivers.length ? bars(drivers) : `<p class="rp-p">None mapped within 1 km.</p>`}</div>
      <div><h3>Competition</h3><div class="rp-sub">${fmt(r15)} direct competitors within 1.5 km, ${fmt(r3)} within 3 km</div>
        ${rivals.slice(0, 5).map((x) => `<div class="rp-rv"><span>${E(x.n)}</span><b>${km(x.d)}</b></div>`).join("") || `<p class="rp-p">No direct competitors mapped nearby.</p>`}</div>
    </div>
    <h3>Next steps</h3>
    <ul class="rp-ul"><li>Count pedestrians on the frontage during the peak window (${E(c.peak_window || "evening")}) on a weekday and a weekend day.</li><li>Check available units, frontage width, visibility and rent against the ₹${fmt(eco.avg_ticket_inr)} average bill and expected ${fmt(c.projected_daily_units)} ${E(unit)}.</li><li>Walk the 400 m around the site to confirm the competitors and demand drivers listed above.</li></ul>
    <p class="rp-note">${c.marginal_units != null ? `This pick adds ${fmt(c.marginal_units)} ${E(unit)} to the network. ` : ""}Figures are modelled estimates. See Data &amp; method for sources and assumptions.</p>
    <button class="rp-go" id="rpShow">Show this location on the map</button>`;
  }

  /* ---------- viewer: the designed report pages, shown inside the dashboard (no file is offered) ---------- */
  const PAGE_W = 1587;                                   // A3 landscape at 96 dpi: the width the report pages are designed for
  let modal = null, cur = "exec", gen = 0;
  const locs = () => cands().map((c) => ({ n: c.plan_rank || c.rank, c }));
  const tabs = () => [{ k: "exec", l: "Executive report" }, ...locs().map(({ n, c }) => ({ k: String(n), l: `Location ${n}`, t: c.name }))];
  async function load(kind) {
    const url = AGT.url(`/api/report/${encodeURIComponent(BIZ)}/${encodeURIComponent(S.siteId)}/${kind === "exec" ? "exec" : "loc/" + kind}`), tok = AGT.token();
    const r = await fetch(url, { headers: tok ? { Authorization: "Bearer " + tok } : {}, cache: "no-store" });
    if (!r.ok) throw new Error("report " + r.status);
    return r.text();
  }
  function fit(frame, box) {
    const doc = frame.contentDocument; if (!doc || !doc.body) return;
    frame.style.height = "200px"; const h = Math.max(200, doc.body.scrollHeight + 40);       // measure the pages themselves, not the frame
    frame.style.height = h + "px";
    const k = Math.min(1, (box.clientWidth - 2) / PAGE_W);
    frame.style.transform = `scale(${k})`; box.style.height = Math.ceil(h * k) + "px";
  }
  async function paint() {
    const my = ++gen, body = modal.querySelector(".rp-body"), list = tabs();
    modal.querySelector(".rp-tabs").innerHTML = list.map((x) => `<button data-k="${x.k}" class="${x.k === cur ? "on" : ""}" ${x.t ? `title="${E(x.t)}"` : ""}>${E(x.l)}</button>`).join("");
    modal.querySelectorAll(".rp-tabs button").forEach((b) => b.onclick = () => { cur = b.dataset.k; if (window.AGTTrack) window.AGTTrack("report.view", cur); paint(); });
    const meta = cur === "exec" ? "All recommended locations" : (locs().find((x) => String(x.n) === cur) || { c: {} }).c.name || "";
    body.innerHTML = `<div class="rp-vh"><b>${cur === "exec" ? "Executive report" : "Detailed report · location " + E(cur)}</b><span>${E(meta)}</span></div><div class="rp-vb"><div class="rp-load">Preparing the report…</div></div>`;
    try {
      const html = await load(cur); if (my !== gen) return;
      const box = body.querySelector(".rp-vb"); box.innerHTML = "";
      const fr = document.createElement("iframe"); fr.setAttribute("sandbox", "allow-same-origin"); fr.setAttribute("title", "Report"); fr.className = "rp-fr"; fr.style.width = PAGE_W + "px";
      fr.onload = () => { fit(fr, box); try { new ResizeObserver(() => fit(fr, box)).observe(box); } catch (e) { addEventListener("resize", () => fit(fr, box)); } };
      fr.srcdoc = html; box.appendChild(fr); body.scrollTop = 0;
    } catch (e) {
      if (my !== gen) return;
      body.querySelector(".rp-vb").innerHTML = `<div class="rp-load">This report could not be loaded just now. Please try again in a moment.</div>`;
    }
  }
  window.openReports = (which) => {
    if (!D) return;
    if (!modal) {
      modal = document.createElement("div"); modal.className = "modal hidden rp-modal"; modal.id = "reportModal";
      modal.innerHTML = `<div class="modal-card rp"><button class="icon-btn close" aria-label="Close">✕</button><div class="rp-tabs"></div><div class="rp-body"></div></div>`;
      document.body.appendChild(modal);
      modal.querySelector(".close").onclick = () => modal.classList.add("hidden");
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.add("hidden"); });
    }
    cur = which && which !== "det" ? String(which) : "exec";
    modal.classList.remove("hidden"); paint();
  };
})();
