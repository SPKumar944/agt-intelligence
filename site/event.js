/* Event brief renderer. Data: site/event-<slug>.json (built by scripts/event_scan.py). Open as event.html?e=bengaluru-diwali-2026 */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const N = (n, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
  const slug = (new URLSearchParams(location.search).get("e") || "bengaluru-diwali-2026").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const root = $("#ev"), CELL_KM2 = 0.1053;
  fetch(`site/event-${slug}.json?v=1`).then((r) => { if (!r.ok) throw new Error("missing"); return r.json(); }).then(render).catch(() => {
    root.innerHTML = `<div class="cp-loading"><span>No event brief for “${esc(slug)}”. <a href="city-snapshots.html" style="color:var(--hot)">See city snapshots →</a></span></div>`;
  });
  const EV = (k, t) => `<span class="ev-ev ${k}"><i></i>${t}</span>`;
  const OBS = EV("obs", "Observed"), REP = EV("rep", "Reported"), IND = EV("ind", "Indicative"), STR = EV("str", "Structural"), BAS = EV("base", "Baseline"), GAP = EV("gap", "Not available");
  const src = (D, k) => { const s = D.sources[k]; return s ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>` : ""; };
  const km = (la1, lo1, la2, lo2) => { const R = 6371, r = Math.PI / 180, dp = (la2 - la1) * r, dl = (lo2 - lo1) * r, a = Math.sin(dp / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
  const longDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  function render(D) {
    document.title = `${D.city} · ${D.title} · Event brief · AGT Intelligence`;
    const R = D.retail, H = D.hubstats.main, days = D.days, rainBefore = days.filter((d) => d.off < 0 || d.off <= -1 || d.date <= "2026-11-08").reduce((a, d) => a + d.rain, 0), rainAfter = days.filter((d) => d.date >= "2026-11-09").reduce((a, d) => a + d.rain, 0);
    const wettest = [...days].sort((a, b) => b.rain - a.rain)[0], mainHubs = D.hubs.filter((h) => h.kind === "main"), c0 = R.centre;
    const hubKm = mainHubs.map((h) => ({ ...h, km: km(c0[0], c0[1], h.lat, h.lng) }));
    const maxHub = Math.ceil(Math.max(...hubKm.map((h) => h.km)));
    const topZ = R.zones, t8 = R.top8_share, t24 = R.top24_share;
    const dest = R.zones.filter((z) => z.per10k >= 100).sort((a, b) => b.per10k - a.per10k);

    const hero = `<section class="cp-hero"><div class="cp-wrap in">
      <div class="mono crumbs"><a href="city-snapshots.html">City snapshots</a><span>/</span><span>Event brief</span><span>/</span><span>${esc(D.city)}</span></div>
      <h1>${esc(D.city)}<em>.</em></h1>
      <p class="mono" style="margin:18px 0 0;font-size:13px;color:var(--ink-2)">${esc(D.title)} · 2 to 16 November 2026 · seven days either side</p>
      <p class="lead">A long weekend from Saturday 7 to Monday 9 November, <b style="font-weight:400">${N(D.ksrtc.buses)}</b> extra intercity buses, an evening-showers week — and a city whose three main bus hubs all lie within ${maxHub} km of the centre. <span>This brief shows what is known, what the map says, and what we cannot yet see.</span></p>
      <div class="cp-pills"><span class="cp-pill live"><i></i>Calendar &amp; operator plans · observed</span><span class="cp-pill"><i></i>Weather · indicative</span><span class="cp-pill"><i></i>Hubs &amp; retail · structural</span><span class="cp-pill" style="color:var(--hot);border-color:color-mix(in srgb,var(--hot) 55%,transparent)"><i></i>Road speeds · not available</span></div>
      <div class="acts"><a class="cp-btn" href="#c1">Read the brief →</a><a class="cp-btn ghost" href="contact.html">Ask for an event brief on your city</a></div>
      <div class="cp-ticker">
        <div><span class="mono">Extra intercity buses</span><b>${N(D.ksrtc.buses)}</b><small>KSRTC · out 6–8 Nov, back 10–11 Nov</small></div>
        <div><span class="mono">Residents near a hub</span><b>${N(H.w5, 0)}%</b><small>within 5 km of a main departure hub · ${N(H.gt8, 0)}% are over 8 km away</small></div>
        <div><span class="mono">Festival-retail places</span><b>${N(R.n)}</b><small>${esc(String(R.radius_km))} km core · 24 zones hold ${N(t24, 0)}%</small></div>
        <div><span class="mono">Everyday baseline</span><b>${N(D.baseline.congestion_pct, 1)}%</b><small>annual congestion level · TomTom 2025</small></div>
      </div></div></section>`;

    const rail = [["c1", "The window"], ["c2", "The leaving"], ["c3", "Shopping weeks"], ["c4", "Rain"], ["c5", "The roads"], ["c6", "Not yet seen"], ["c7", "What it means"]].map(([id, t], i) => `<a href="#${id}"><span>0${i + 1}</span>${t}</a>`).join("");
    const head = (id, n, t, deck) => `<header><span class="n">${n} — ${esc(id)}</span><h2>${t}</h2>${deck ? `<p>${deck}</p>` : ""}</header>`;

    // ---------------------------------------------------------------- 01 window
    const legend = `<div class="ev-legend">
      <div>${OBS}<br />Dated facts and published operator plans: the holiday calendar and KSRTC's bus schedule.</div>
      <div>${REP}<br />What news and traffic police said about earlier festivals. Context, not a measurement of this year.</div>
      <div>${IND}<br />Weather reanalysis (ERA5). Good for “was it wet”, not for exact city rainfall.</div>
      <div>${STR}<br />Our own scan of mapped places and modelled residents. Shows exposure, not flows.</div>
      <div>${BAS}<br />Published everyday congestion indices, to size a normal day.</div></div>`;
    const dayBtn = (d) => `<button type="button" class="d${d.off === 0 ? " zero" : ""}" data-i="${days.indexOf(d)}" aria-pressed="false" aria-label="${esc(longDate(d.date))}"></button>`;
    const col = (fn) => days.map(fn).join("");
    const tl = `<div class="tl-wrap"><div class="tl" id="tl" role="group" aria-label="Day by day, 2 to 16 November 2026">
        <div class="rl"> </div>${col((d) => `<button type="button" class="d hd${d.off === 0 ? " zero" : ""}" data-i="${days.indexOf(d)}" aria-pressed="false" aria-label="${esc(longDate(d.date))}"><span>${d.dow}</span><b>${d.dn}</b><em>${d.off === 0 ? "Day 0" : (d.off > 0 ? "+" : "−") + Math.abs(d.off)}</em></button>`)}
        <div class="rl">Calendar</div>${col((d) => `<button type="button" class="d" data-i="${days.indexOf(d)}" tabindex="-1" aria-hidden="true"><div class="ty ${d.type}">${d.type === "holiday" ? "Holiday" : d.type === "weekend" ? "Weekend" : ""}</div></button>`)}
        <div class="rl">KSRTC plan</div>${col((d) => `<button type="button" class="d" data-i="${days.indexOf(d)}" tabindex="-1" aria-hidden="true"><div class="bs">${d.ksrtc ? `<i class="${d.ksrtc === "back" ? "back" : ""}"></i>${(d.date === D.ksrtc.out[0] || d.date === D.ksrtc.back[0]) ? `<span class="${d.ksrtc === "back" ? "back" : ""}">${d.ksrtc === "out" ? "Out" : "Back"}</span>` : ""}` : ""}</div></button>`)}
        <div class="rl">Rain · mm</div>${col((d) => { const h = Math.round(d.rain / 16 * 70); return `<button type="button" class="d" data-i="${days.indexOf(d)}" tabindex="-1" aria-hidden="true"><div class="rn" style="--h:${h}px">${d.rain >= 0.5 ? `<b style="height:${h}px"></b><em>${N(d.rain, 1)}</em>` : ""}</div></button>`; })}
      </div></div>
      <div class="tl-detail" id="tlDetail"></div>`;
    const take1 = [
      `<b>The calendar set the shape.</b> Sunday 8 and Monday 9 November are Karnataka regional holidays, so the long weekend runs Saturday to Monday. KSRTC's outbound specials run Friday 6 to Sunday 8 and its return specials Tuesday 10 and Wednesday 11 ${OBS}. That points to a return spread across the working week instead of the Sunday-night pile-up of a normal long weekend — an inference from the plan, not an observation.`,
      `<b>The rain came before the exodus, not during the return.</b> About ${N(rainBefore, 0)} mm fell across 2–8 November and none from 9 November on ${IND}. The wettest day was ${esc(longDate(wettest.date))} (${N(wettest.rain, 1)} mm), mostly at 5 and 7 pm.`,
      `<b>The festival is a moving date.</b> KSRTC puts Naraka Chaturdashi on 8 November and Balipadyami on 10 November; Karnataka's holiday list shows 8 and 9; some North-Indian calendars put Lakshmi Puja on 8. We anchor Day 0 on Monday 9 November and show the sources' disagreement openly.`];
    const c1 = `<section class="cp-ch" id="c1">${head("The window", "01", "Fifteen days, <em>one long weekend</em>", `Seven days before and after Monday 9 November. Click any day. Everything below is tagged by how much weight it can bear.`)}
      ${legend}<ul class="cp-take">${take1.map((t, i) => `<li data-n="0${i + 1}"><span>${t}</span></li>`).join("")}</ul>${tl}</section>`;

    // ---------------------------------------------------------------- 02 leaving
    const hubRows = hubKm.map((h) => `<li><b>${esc(h.name)}</b><span class="m">${esc(h.dest)} · ${N(h.km, 1)} km from the centre</span><span class="r">${N(h.catch_share, 0)}%<small>nearest-hub share</small></span></li>`).join("");
    const c2 = `<section class="cp-ch" id="c2">${head("The leaving", "02", "Everyone has to reach a hub <em>first</em>", `KSRTC named three main departure points, plus BMTC reservation points. We measured how far Bengaluru's residents live from them. A bus is only part of an exodus — cars, trains and flights are not in this layer.`)}
      <div class="ev-sx"><div><span class="mono">Within 3 km of a main hub</span><b>${N(H.w3, 0)}%</b><p>${STR} Straight-line distance from modelled residents in the ${N(R.radius_km)} km core to the nearest of the three main hubs.</p></div>
        <div><span class="mono">Median distance</span><b>${N(H.median_km, 1)} km</b><p>${STR} Half of residents are further than this, before any road detour. With BMTC's reservation points added, ${N(D.hubstats.all.w5, 0)}% are within 5 km.</p></div>
        <div><span class="mono">More than 8 km away</span><b>${N(H.gt8, 0)}%</b><p>${STR} About ${N(Math.round(D.residents * H.gt8 / 100 / 1000) * 1000)} people, concentrated on the east and south-east edges. They travel across the city to a hub — or use a nearer BMTC point such as Electronic City or Attibele, which KSRTC also lists.</p></div></div>
      <div class="ex"><div>
        <div class="ex-tabs" id="mTabs" role="group" aria-label="Map layer"></div>
        <div class="ex-map" id="mMap"><div id="mSvg"></div><div class="ex-tip" id="mTip"></div></div>
        <div class="ex-legend" id="mLeg"></div><p class="ex-cap" id="mCap"></p></div>
        <aside class="ex-side"><h3>Main departure hubs · KSRTC</h3><ul class="hubs">${hubRows}</ul>
          <p class="ex-cap" style="margin-top:22px">${OBS} ${N(D.ksrtc.buses)} extra buses from Bengaluru on 6–8 November, from Kempegowda Bus Station, Mysuru Road and Shantinagar TTMC; return specials on 10 and 11 November. Discounts: ${esc(D.ksrtc.discounts)}. Source: ${src(D, "ksrtc")}.</p>
          <p class="ex-cap">Rough scale, assuming 40–50 seats a bus: on the order of 100,000 extra seats each way. That is our arithmetic, not a KSRTC figure.</p></aside></div></section>`;

    // ---------------------------------------------------------------- 03 shopping
    const ztype = (z) => z.per10k >= 100 ? ["Destination market", "core"] : z.residents >= 100000 ? ["Neighbourhood belt", ""] : ["Mixed", ""];
    const zrows = topZ.slice(0, 14).map((z) => `<tr><td class="nm"><b>${esc(z.label)}</b><span>PIN ${z.pin}</span></td><td class="n">${N(z.fest)}</td><td class="n">${N(z.share, 1)}%</td><td class="n">${N(z.residents)}</td><td class="n">${N(z.per10k, 0)}</td><td>${esc(Object.entries(z.types).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => R.labels[k]).join(" · "))}</td><td><span class="role ${ztype(z)[1]}">${ztype(z)[0]}</span></td></tr>`).join("");
    const take3 = [
      `<b>Festival shopping is concentrated.</b> Of ${N(R.n)} festival-retail places mapped in the core, the top 8 PIN-code zones hold ${N(t8, 0)}% and the top 24 hold ${N(t24, 0)}% ${STR}.`,
      `<b>Two different geographies.</b> ${dest.length ? `<b>Destination markets</b> such as ${dest.slice(0, 3).map((z) => esc(z.label)).join(", ")} have more than 100 festival-retail places per 10,000 residents — they pull trips from across the city. ` : ""}<b>Neighbourhood belts</b> such as ${esc(topZ.find((z) => z.residents >= 150000 && z.per10k < 40)?.label || "the large residential zones")} have many shops but even more residents, so demand is local.`,
      `<b>What is not in the data.</b> Pop-up stalls, pavement sellers and seasonal cracker shops are rarely mapped (only ${N(R.totals.crackers)} cracker shops are), so real festival density on the busiest streets is higher than shown.`];
    const c3 = `<section class="cp-ch" id="c3">${head("Shopping weeks", "03", "Where the <em>festival retail</em> is", `Sweets, jewellery, apparel, electronics, flowers and pooja items, gifts and provisions — the places people go in the weeks before Deepavali. This is where shopping trips, curb parking and local congestion are likely to concentrate.`)}
      <ul class="cp-take">${take3.map((t, i) => `<li data-n="0${i + 1}"><span>${t}</span></li>`).join("")}</ul>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zone</th><th class="n">Festival retail</th><th class="n">City share</th><th class="n">Residents</th><th class="n">Per 10,000</th><th>Strongest in</th><th>Geography</th></tr></thead><tbody>${zrows}</tbody></table></div>
      <p class="ex-cap" style="margin-top:20px">${STR} Seven festival-retail types: ${Object.values(R.labels).map(esc).join(", ")}. Counts are mapped businesses; zones are postal-code areas named from the streets in their addresses.</p></section>`;

    // ---------------------------------------------------------------- 04 rain
    const keyDays = days.filter((d) => ["2026-11-02", "2026-11-05", "2026-11-06", "2026-11-07"].includes(d.date));
    const hourBars = (d) => { const hrs = Array.from({ length: 24 }, (_, h) => (d.wet.find((w) => w[0] === h) || [h, 0])[1]); const mx = Math.max(5, ...hrs); return `<div class="hrs" role="img" aria-label="Hourly rain on ${esc(longDate(d.date))}">${hrs.map((v, h) => `<i class="${v >= 0.2 ? "w" : ""} ${h >= 16 && h <= 20 ? "pk" : ""}" style="height:${v >= 0.2 ? Math.max(8, v / mx * 100) : 6}%" title="${h}:00 — ${v} mm"></i>`).join("")}</div>`; };
    const take4 = [`<b>Rain hit the shopping evenings.</b> 2 November (${N(days[0].rain, 1)} mm) and 5 November (${N(days[3].rain, 1)} mm) were soaked in the 5 to 7 pm peak, when festival shoppers and commuters share the same roads ${IND}.`,
      `<b>The exodus evening was only lightly wet.</b> Friday 6 November saw showers of under 1 mm an hour between 3 and 6 pm. Heavy rain on an exodus evening is a known jam multiplier (${src(D, "dh4")}); this year it did not coincide, on the evidence of the reanalysis.`,
      `<b>Why we did not use air-quality models.</b> Modelled air-quality series use fixed typical emissions, so they cannot see a one-off exodus or fireworks; their swings in this window reflect weather alone. We left them out rather than present a proxy that would look data-rich and be wrong.`];
    const c4 = `<section class="cp-ch" id="c4">${head("Rain", "04", "Hour by hour, <em>when it was wet</em>", `Rainfall by hour on the four days that matter for evening movement. The shaded band is the 4 to 8 pm peak.`)}
      <ul class="cp-take">${take4.map((t, i) => `<li data-n="0${i + 1}"><span>${t}</span></li>`).join("")}</ul>
      <div class="rh-key"><span></span><span class="ax"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></span><span></span></div>
      <div class="rh">${keyDays.map((d) => `<div class="r"><b>${esc(longDate(d.date))}<small>${d.ksrtc ? "KSRTC outbound" : d.type}</small></b>${hourBars(d)}<div class="v">${N(d.rain, 1)}<small>mm in the day</small></div></div>`).join("")}</div>
      <p class="ex-cap" style="margin-top:20px">${IND} ERA5 reanalysis for central Bengaluru via ${src(D, "om")}. It is a model estimate on a coarse grid: treat it as “wet or dry”, not as a rain-gauge reading.</p></section>`;

    // ---------------------------------------------------------------- 05 roads
    const B = D.baseline;
    const pn = D.pinch.map((p) => `<div><b>${esc(p.where)}</b><p>${esc(p.what)} ${REP}</p><small>${esc(p.when)}<br />${src(D, p.src)}</small></div>`).join("");
    const c5 = `<section class="cp-ch" id="c5">${head("The roads", "05", "A normal day is already <em>heavy</em>", `We have no road-speed measurements for 2–16 November, so we do not claim any. What we can do is size a normal day and list where earlier festival returns broke.`)}
      <div class="ev-sx"><div><span class="mono">Congestion level, 2025</span><b>${N(B.congestion_pct, 1)}%</b><p>${BAS} ${esc(B.rank)}. ${src(D, "tt")}.</p></div>
        <div><span class="mono">A 10 km trip</span><b>${esc(B.min_per_10km.split(" ").slice(0, 2).join(" "))}</b><p>${BAS} Average over the year; ${esc(B.morning)} in the morning peak and ${esc(B.evening)} in the evening peak. ${src(D, "tt2")}.</p></div>
        <div><span class="mono">Time lost in rush hour</span><b>${B.hours_lost} h</b><p>${BAS} Per driver per year, about seven days. Traffic police dispute the numbers (${src(D, "btp")}): ${esc(B.dispute)}.</p></div></div>
      <h3 class="mono" style="margin:0 0 14px">Where earlier festival returns broke</h3><div class="pn">${pn}</div>
      <p class="ex-cap" style="margin-top:22px"><b>What 2026's calendar changes.</b> The recurring pinch points are the gateways: Tumakuru Road at Nelamangala, Old Madras Road, Hebbal, Mysuru Road and Hosur Road. In earlier years the worst came on the Sunday evening and Monday morning after a long weekend. This year KSRTC's own returns are scheduled for Tuesday and Wednesday, which should flatten that spike — but we cannot confirm it without speed data.</p></section>`;

    // ---------------------------------------------------------------- 06 ledger
    const led = [["Road speeds and congestion, 2–16 Nov", GAP, "No public historical source. Commercial traffic feeds (TomTom, HERE) sell it; we did not have access."],
      ["Namma Metro daily ridership", GAP, "No 2026 Deepavali figures found. BMRCL publishes occasional record notices, not a daily series."],
      ["Actual bus and train loads", GAP, "Only KSRTC's plan was published (observed), not how full buses ran."],
      ["Airport passengers", GAP, "No 2026 festival figures found."],
      ["Air quality and crackers", EV("gap", "Not used"), "Only modelled series exist for this window. They cannot see a one-off event, so using them would mislead."],
      ["Weather", IND, "Reanalysis, usable for wet or dry, not for exact rainfall."]].map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join("");
    const c6 = `<section class="cp-ch" id="c6">${head("Not yet seen", "06", "What we <em>could not</em> see", `A brief is only as honest as its gaps. This is the ledger.`)}
      <div class="ev-warn"><b>No observed congestion in this brief.</b> Every statement about roads is either a baseline, a report from an earlier festival, or a structural measure of exposure. None is a measurement of 2026's traffic.</div>
      <table class="lg"><thead><tr><th>Signal</th><th>Status</th><th>Why</th></tr></thead><tbody>${led}</tbody></table>
      <h3 class="mono" style="margin:36px 0 14px">How we close the gap</h3>
      <ul class="cp-take" style="max-width:1000px"><li data-n="01"><span><b>Licensed traffic history.</b> A TomTom or HERE traffic-statistics feed for 2–16 November gives corridor speeds by hour. That turns this brief from exposure into measured congestion in a day.</span></li>
        <li data-n="02"><span><b>FASTag toll counts.</b> Vehicle counts at Nelamangala, Hosur and Hoskote-side plazas show the exodus and return directly. Operators and the highway authority hold them.</span></li>
        <li data-n="03"><span><b>Operator loads.</b> Daily BMRCL ridership and KSRTC/BMTC load factors show how many people actually moved by public transport.</span></li></ul></section>`;

    // ---------------------------------------------------------------- 07 implications
    const c7 = `<section class="cp-ch" id="c7">${head("What it means", "07", "For retailers, <em>planners</em> and logistics", `Each point ties to a number above. Each is a hypothesis to test, not a forecast.`)}
      <ul class="cp-take" style="max-width:1000px">
        <li data-n="01"><span><b>Plan around destination markets and neighbourhood belts separately.</b> ${dest.length ? `${esc(dest[0].label)} and the other destination markets draw trips from the whole city and run short of curb space; ` : ""}the large residential belts need stock and staff for local, repeat visits. (${N(t24, 0)}% of festival retail sits in 24 zones.)</span></li>
        <li data-n="02"><span><b>Treat the evening peak as the weather risk.</b> Both soaked days (2 and 5 November) were wet at 5–7 pm. A festival-shopping plan that depends on evening footfall needs a wet-evening version.</span></li>
        <li data-n="03"><span><b>Keep deliveries off the hub corridors on the outbound days.</b> Three hubs within ${maxHub} km of the centre mean the Friday–Sunday movement converges inward first: Majestic, Satellite and Shantinagar are where roads fill before the highways do.</span></li>
        <li data-n="04"><span><b>Expect a staggered return.</b> With specials on 10 and 11 November and holidays on 8 and 9, offices and offices-led retail may restart over several days rather than one Monday. Test staffing on Tuesday–Wednesday, not only Monday.</span></li>
        <li data-n="05"><span><b>Do not read quiet days as lost demand.</b> The same calendar that empties office districts concentrates sweets, flowers and gifting in neighbourhoods. Compare festival-retail zones with office zones before judging a quiet week.</span></li></ul></section>`;

    const close = `<section class="cp-close"><div class="cp-wrap"><h2>The same method, <em>any city, any event</em>.</h2>
      <div class="cols"><div><span class="mono">What this brief combined</span><ul class="pr" style="margin-top:18px"><li><b>Calendar</b>Holidays and operator plans, dated and sourced.</li><li><b>Weather</b>Hourly rain for the window, with its limits stated.</li><li><b>Map</b>Residents, festival retail and distance to departure hubs, from our own scan.</li><li><b>Ledger</b>What is observed, reported, indicative, structural, baseline — and what is missing.</li></ul></div>
        <div class="nf"><span class="mono">Next</span><p>Give us a city and an event — a festival, a match, a long weekend, a metro opening — and we will build the same brief. Add a traffic feed and the “roads” chapter becomes measured congestion.</p><div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap"><a class="cp-btn" href="contact.html">Ask for an event brief →</a><a class="cp-btn ghost" href="city-snapshots.html">City snapshots</a></div></div></div>
      <div class="meth"><details><summary>Sources and method</summary><div class="txt"><ul>
        ${["ksrtc", "hol", "tt", "tt2", "btp", "dh1", "dh2", "dh3", "dh4", "hans", "om"].map((k) => `<li>${src(D, k)}</li>`).join("")}</ul>
        <p>Places: ${N(D.retail.city_places)} mapped businesses and services within ${D.retail.radius_km} km, merged from OpenStreetMap and Overture and classified by our taxonomy. Residents: modelled counts (two public datasets averaged). Hub distances are straight lines. Zone names are derived from the streets in addresses.</p>
        <p>Data: © OpenStreetMap contributors (ODbL) · Overture Maps Foundation · WorldPop · Meta Data for Good · Open-Meteo. Brief built ${esc(D.asof)}.</p></div></details></div></div></section>`;

    root.innerHTML = hero + `<div class="cp-wrap cp-layout"><nav class="cp-rail" aria-label="Chapters">${rail}</nav><div>${c1}${c2}${c3}${c4}${c5}${c6}${c7}</div></div>` + close;
    const links = $$(".cp-rail a"), io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-30% 0px -60% 0px" });
    $$(".cp-ch").forEach((s) => io.observe(s));
    initTimeline(D); initMap(D);
  }

  // ---------------------------------------------------------------------------------------------------- timeline
  function initTimeline(D) {
    const days = D.days, box = $("#tl"), det = $("#tlDetail");
    const show = (i) => {
      const d = days[i]; $$("#tl .d").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.i === i));
      const type = d.type === "holiday" ? "Karnataka regional holiday" : d.type === "weekend" ? "Weekend" : "Working day";
      det.innerHTML = `<div><span class="mono">${d.off === 0 ? "Day 0" : (d.off > 0 ? "Day +" : "Day −") + Math.abs(d.off)}</span><h3>${esc(longDate(d.date))}</h3></div>
        <div class="kv"><span>Day type</span><b>${type}</b><span>KSRTC plan</span><span>${d.ksrtc === "out" ? "<b>Extra outbound buses</b> from Bengaluru" : d.ksrtc === "back" ? "<b>Return specials</b> to Bengaluru" : "No special services listed"}</span>
        <span>Rain</span><span><b>${N(d.rain, 1)} mm</b>${d.wet.length ? " · wet hours: " + d.wet.map((w) => `${w[0]}:00 (${w[1]})`).join(", ") : " · dry"}</span>
        <span>Notes</span><span>${d.notes.length ? d.notes.map(esc).join(" ") : "Nothing specific recorded for this day."}</span></div>`;
    };
    box.addEventListener("click", (e) => { const b = e.target.closest(".d"); if (b) show(+b.dataset.i); });
    box.addEventListener("mouseover", (e) => { const b = e.target.closest(".d"); if (b && matchMedia("(hover:hover)").matches) show(+b.dataset.i); });
    show(days.findIndex((d) => d.off === 0));
  }

  // ---------------------------------------------------------------------------------------------------- map
  function initMap(D) {
    const R = D.retail, [lat0, lng0] = R.centre, kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.57, S = 42, R0 = R.radius_km * S, pad = 22;
    const P = ([la, lo]) => [((lo - lng0) * kx) * S, (-(la - lat0) * ky) * S];
    const paths = R.cells.map((c) => "M" + c.b.map(P).map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z");
    const q97 = (f) => { const v = R.cells.map(f).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.97)] || v[v.length - 1] : 1; };
    const LAY = {
      retail: { label: "Festival retail", f: (c) => c.f / CELL_KM2, unit: "places / km²", lo: "few", hi: "dense", cap: `<b>Where festival shopping concentrates.</b> Festival-retail places per square kilometre. The bright core runs through the old market districts and the central commercial streets; secondary clusters sit along the ring and radial roads.` },
      hub: { label: "Distance to hub", f: (c) => c.d, unit: "km", lo: "near a hub", hi: "far from a hub", cap: `<b>How far from a departure hub.</b> Straight-line distance from each hexagon to the nearest of the three main KSRTC hubs. The dark-blue core is within 2 km; the amber edges are the residents who must cross the city before a bus-led journey begins.`, rev: true },
      res: { label: "Residents", f: (c) => c.p / CELL_KM2, unit: "people / km²", lo: "sparse", hi: "dense", cap: `<b>Where people live.</b> Modelled residents per square kilometre, for reference against the other two layers.` },
    };
    let layer = "retail";
    const sc = { retail: q97(LAY.retail.f), res: q97(LAY.res.f) }, dmax = Math.max(...R.cells.map((c) => c.d), 1);
    const fill = (c) => { const L = LAY[layer];
      if (layer === "hub") { const t = Math.min(1, c.d / Math.min(dmax, 12)); return c.p <= 0 && c.f <= 0 ? "color-mix(in srgb,var(--ink) 4%,transparent)" : `color-mix(in srgb,var(--hot) ${(6 + t * 94).toFixed(0)}%,color-mix(in srgb,var(--cold) 70%,var(--bg)))`; }
      const v = L.f(c); if (v <= 0) return "color-mix(in srgb,var(--ink) 4%,transparent)"; const t = Math.min(1, Math.sqrt(v / sc[layer])); return `color-mix(in srgb,var(--hot) ${(8 + t * 92).toFixed(0)}%,color-mix(in srgb,var(--ink) 8%,transparent))`; };
    const hubs = D.hubs.map((h) => ({ ...h, p: P([h.lat, h.lng]) }));
    const short = (n) => n.replace(" (Majestic)", "").replace("Kempegowda Bus Station", "Majestic").replace(" Satellite Bus Station", " Satellite").replace(" TTMC", "");
    const svg = `<svg viewBox="${-R0 - pad} ${-R0 - pad} ${2 * R0 + 2 * pad} ${2 * R0 + 2 * pad}" role="img" aria-label="Hexagon map of ${esc(D.city)} with the departure hubs"><g id="mCells">${R.cells.map((c, i) => `<path class="c" data-i="${i}" d="${paths[i]}" style="fill:${fill(c)}"/>`).join("")}</g>
      <circle class="ring" cx="0" cy="0" r="${R0}"/>${hubs.map((h) => `<g class="hub ${h.kind === "booking" ? "bk" : ""}"><circle cx="${h.p[0].toFixed(1)}" cy="${h.p[1].toFixed(1)}" r="${h.kind === "booking" ? 4.5 : 6.5}"/>${h.kind === "main" ? `<text x="${(h.p[0] + 10).toFixed(1)}" y="${(h.p[1] + 4).toFixed(1)}">${esc(short(h.name))}</text>` : ""}</g>`).join("")}<text x="${R0 * 0.707 + 4}" y="${-R0 * 0.707 - 6}">${R.radius_km} km</text></svg>`;
    $("#mSvg").innerHTML = svg;
    const tabs = $("#mTabs"); tabs.innerHTML = Object.entries(LAY).map(([k, L]) => `<button type="button" data-l="${k}" aria-pressed="${k === layer}">${L.label}</button>`).join("");
    const paint = () => { $$("#mCells path").forEach((p) => { p.style.fill = fill(R.cells[+p.dataset.i]); }); $$("#mTabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === layer)); const L = LAY[layer];
      $("#mLeg").innerHTML = `<span>${L.lo}</span><i style="background:${layer === "hub" ? "linear-gradient(90deg,color-mix(in srgb,var(--cold) 70%,var(--bg)),var(--hot))" : "linear-gradient(90deg,color-mix(in srgb,var(--hot) 8%,color-mix(in srgb,var(--ink) 8%,transparent)),var(--hot))"}"></i><span>${L.hi} · ${L.unit}</span><span style="margin-left:auto">● main hub · ○ booking point</span>`; $("#mCap").innerHTML = L.cap; };
    tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-l]"); if (b) { layer = b.dataset.l; paint(); } });
    const tip = $("#mTip"), box = $("#mMap");
    box.addEventListener("pointermove", (e) => { const p = e.target.closest("path.c"); if (!p) { tip.classList.remove("on"); return; } const c = R.cells[+p.dataset.i], r = box.getBoundingClientRect();
      tip.innerHTML = `<b>Hexagon · about 0.1 km²</b><div><span>Residents</span><span>${N(c.p)}</span></div><div><span>Festival-retail places</span><span>${c.f}</span></div><div><span>Nearest main hub</span><span>${N(c.d, 1)} km</span></div>`;
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x > r.width - 200) x = e.clientX - r.left - 200; if (y > r.height - 120) y = e.clientY - r.top - 120; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.add("on"); });
    box.addEventListener("pointerleave", () => tip.classList.remove("on"));
    paint();
  }
})();
