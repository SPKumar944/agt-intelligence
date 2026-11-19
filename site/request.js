/* Report-request form (signed-in users): Plus-code rows with live validation and a live credit counter, then POST /api/me/requests. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const form = $("#reqForm"), locs = $("#locs");
  const PLUS = /^\s*[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s+.{2,60})?\s*$/i;
  let MAX = 10, BAL = null, ADMIN = false, MODE = "sites";
  const NOPTS = Array.from({ length: 18 }, (_, i) => i + 3);          // 3..20 suggestions

  function filled() { return [...locs.children].filter((r) => $(".c", r).value.trim()); }
  function cost() {
    if (MODE === "area") return 2 + parseInt($("#aN").value, 10);
    return filled().reduce((s, r) => s + 1 + ($(".r", r).value === "alternatives" ? Math.ceil(parseInt($(".n", r).value, 10) / 2) : 0), 0);
  }
  function credits() {
    const n = cost(); $("#cCost").textContent = n;
    if (BAL == null) return;
    $("#cLeft").textContent = BAL - n;
    const w = $("#cWarn");
    if (n > BAL) { w.innerHTML = `You need ${n - BAL} more credit${n - BAL === 1 ? "" : "s"} for this request. <a href="account.html#credits">Buy credits</a>`; w.classList.add("on"); } else w.classList.remove("on");
  }
  function row(code = "", label = "", role = "prospective") {
    const d = document.createElement("div"); d.className = "loc";
    if (MODE === "area") role = "existing";
    d.innerHTML = `<div class="field code"><input class="c" placeholder="e.g. WHHJ+JM Bengaluru" aria-label="Google Plus code" value="${code.replace(/"/g, "&quot;")}" spellcheck="false" autocapitalize="characters" /><i></i></div>
      <div class="field"><input class="l" placeholder="Name (optional)" aria-label="Location name" value="${label.replace(/"/g, "&quot;")}" /></div>
      <div class="field"><select class="r" aria-label="Location type"><option value="existing"${role === "existing" ? " selected" : ""}>Existing outlet</option><option value="prospective"${role === "prospective" ? " selected" : ""}>Site to evaluate</option><option value="alternatives"${role === "alternatives" ? " selected" : ""}>Site + suggest alternatives</option></select></div>
      <button type="button" class="rm" aria-label="Remove location">×</button>
      <div class="alt"${role === "alternatives" ? "" : " hidden"}>Suggest <select class="n" aria-label="How many alternatives">${NOPTS.map((n) => `<option${n === 5 ? " selected" : ""}>${n}</option>`).join("")}</select> better locations within
        <select class="k" aria-label="Search distance"><option value="1">1 km</option><option value="2" selected>2 km</option><option value="3">3 km</option><option value="5">5 km</option></select> of this site</div>`;
    const rsel = $(".r", d);
    rsel.disabled = MODE === "area";
    rsel.addEventListener("change", () => { $(".alt", d).hidden = rsel.value !== "alternatives"; credits(); });
    $(".n", d).addEventListener("change", credits);
    const c = $(".c", d), mark = $("i", d);
    const check = () => { const v = c.value.trim(); mark.className = v ? (PLUS.test(v) ? "ok" : "bad") : ""; mark.textContent = v ? (PLUS.test(v) ? "✓" : "✕") : ""; d.querySelector(".field.code").classList.remove("bad"); credits(); };
    c.addEventListener("input", check); check();
    $(".rm", d).addEventListener("click", () => { d.remove(); sync(); credits(); });
    locs.appendChild(d); sync(); return d;
  }
  function sync() {
    const n = locs.children.length;
    locs.querySelectorAll(".rm").forEach((b) => (b.disabled = n <= 1 && MODE !== "area"));
    $("#addLoc").disabled = n >= MAX; $("#locCount").textContent = n >= MAX ? `${n} of ${MAX} — need more? See enterprise` : `${n} of ${MAX}`;
  }
  $("#addLoc").addEventListener("click", () => { const r = row(); $(".c", r).focus(); });
  $("#pasteToggle").addEventListener("click", () => $("#paste").classList.toggle("on"));
  $("#pasteAdd").addEventListener("click", () => {
    const lines = $("#pasteBox").value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    [...locs.children].forEach((r) => { if (!$(".c", r).value.trim() && lines.length) { $(".c", r).value = lines.shift(); $(".c", r).dispatchEvent(new Event("input")); } });
    lines.forEach((l) => { if (locs.children.length < MAX) row(l); });
    $("#pasteBox").value = ""; $("#paste").classList.remove("on");
  });
  $("#description").addEventListener("input", (e) => { $("#dcount").textContent = e.target.value.trim().length; });

  const banner = $("#banner");
  function fail(msg, field, extra) {
    banner.innerHTML = ""; banner.append(document.createTextNode(msg));
    if (extra) { const a = document.createElement("a"); a.href = extra.href; a.textContent = " " + extra.text; banner.append(a); }
    banner.classList.add("on");
    document.querySelectorAll(".field.bad").forEach((f) => f.classList.remove("bad"));
    const el = field && ($("#" + field) || (field === "locations" ? locs : null));
    if (el) { const f = el.closest ? el.closest(".field") : null; if (f) f.classList.add("bad"); if (el.focus) el.focus(); }
    banner.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); banner.classList.remove("on");
    const v = (id) => $("#" + id).value.trim();
    if (v("name").length < 2) return fail("Please enter your name.", "name");
    if (v("company").length < 2) return fail("Please enter your company or brand.", "company");
    if (v("description").length < 40) return fail("Please describe your business in a few sentences (at least 40 characters).", "description");
    const L = [...locs.children].map((r) => ({ code: $(".c", r).value.trim(), label: $(".l", r).value.trim(), role: MODE === "area" ? "existing" : $(".r", r).value,
      n_suggest: parseInt($(".n", r).value, 10), search_km: parseFloat($(".k", r).value) })).filter((x) => x.code);
    const area = MODE === "area" ? { centre: v("aCentre"), radius_km: parseFloat($("#aRadius").value), n: parseInt($("#aN").value, 10) } : null;
    if (area && area.centre.length < 3) return fail("Enter the centre of the area: a Plus code or a place name.", "aCentre");
    if (!area && !L.length) return fail("Add at least one location as a Google Plus code.", "locations");
    const badRow = [...locs.children].find((r) => $(".c", r).value.trim() && !PLUS.test($(".c", r).value));
    if (badRow) { badRow.querySelector(".field.code").classList.add("bad"); $(".c", badRow).focus(); return fail("One of the Plus codes isn't valid. It looks like WHHJ+JM Bengaluru (letters and digits, a “+”, then a place name)."); }
    if (!ADMIN && BAL != null && cost() > BAL) return fail(`This request needs ${cost()} credits and you have ${BAL}.`, null, { href: "account.html#credits", text: "Buy credits" });
    if (!ADMIN && !$("#consent").checked) return fail("Please tick the box to confirm you agree to us using these details to respond.", "consent");
    const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Sending…";
    try {
      const j = await AGT.api(ADMIN ? "/api/admin/requests" : "/api/me/requests", { body: { email: v("email"), name: v("name"), phone: v("phone"), role: $("#role").value, company: v("company"), website: v("website"), format: $("#format").value,
        city: (window.AGT_COVERAGE ? AGT_COVERAGE.cityValue() : v("city")), description: v("description"), locations: L, mode: MODE, area, priorities: window.AGTPri ? AGTPri.collect() : null, consent: true } });
      $("#refOut").textContent = "Reference " + j.ref; if (ADMIN) $("#done").querySelector(".hero-cta").innerHTML = '<a class="btn btn-primary" href="admin.html#' + j.ref + '">Open in admin</a><a class="btn btn-secondary" href="request-report.html">File another</a>'; $("#emailOut").textContent = v("email");
      $("#formCard").hidden = true; $("#done").style.display = "block"; window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      btn.disabled = false; btn.textContent = "Submit request";
      if (x.status === 401) return location.replace("login.html?next=request-report.html");
      const d = x.data || {};
      fail(x.message, d.field, d.need ? { href: "account.html#credits", text: "Buy credits" } : d.enterprise ? { href: "account.html#enterprise", text: "Send an enterprise enquiry" } : null);
    }
  });

  // request type: rate locations / find new locations in an area
  $("#aN").innerHTML = NOPTS.map((n) => `<option${n === 5 ? " selected" : ""}>${n}</option>`).join("");
  $("#aN").addEventListener("change", credits);
  function setMode(m) {
    MODE = m;
    document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
    $("#areaBox").hidden = m !== "area";
    $("#locHint").innerHTML = m === "area" ? "<b>Your existing outlets</b> (optional). One Google Plus code per outlet. They cost nothing; we use them so the new locations don't take their sales."
      : "One Google Plus code per location. An existing outlet or a site to evaluate uses 1 credit. <b>Site + suggest alternatives</b> also finds better spots near the site, at 1 more credit per 2 suggestions. Up to 10 per request; more than that is an <a href=\"pricing.html\">enterprise report</a>.";
    $("#addLoc").textContent = m === "area" ? "Add an existing outlet" : "Add a location";
    [...locs.children].forEach((r) => { const s = $(".r", r); if (m === "area") { s.value = "existing"; $(".alt", r).hidden = true; } s.disabled = m === "area"; });
    sync(); credits();
  }
  document.querySelectorAll("#modes button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  // gate: only signed-in users can fill the form
  AGT.session().then(async (s) => {
    if (s.role === "admin") {      // super admin: files a request for a client (or the studio) — no credits, no consent box
      ADMIN = true; MAX = 100;
      $("#formCard").hidden = false; $("#creditCard").hidden = true; $("#consent").closest(".checkrow").hidden = true;
      const em = $("#email"); em.readOnly = false; em.required = true; em.placeholder = "client@gmail.com"; em.value = "";
      em.closest(".field").querySelector("label").innerHTML = "Client's email <span class=\"opt\">(they get the sign-in link)</span>";
      $("#name").value = "";
      const nb = document.createElement("div"); nb.className = "callout"; nb.style.marginBottom = "18px";
      nb.innerHTML = "<span><b>Super-admin request.</b> No credits are used and the client is not emailed until you approve it in the admin page.</span>"; form.prepend(nb);
      row(); row(); credits(); return;
    }
    if (s.role !== "user") { $("#gate").hidden = false; return; }
    try { const c = await AGT.api("/api/config"); MAX = c.pricing.standard_max_locations; } catch (e) { /* default */ }
    BAL = s.credits; $("#cBal").textContent = BAL; $("#creditCard").hidden = false;
    $("#formCard").hidden = false; $("#name").value = s.name || ""; $("#email").value = s.email;
    row(); row(); credits();
  });
})();
