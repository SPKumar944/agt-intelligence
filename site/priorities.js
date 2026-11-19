/* Request form: "What matters to you" (0-10 sliders) and "Competitors and nearby brands" pickers.
 * Six main questions are always visible. Each has its own closed "Fine-tune" dropdown directly under it, holding the related finer questions.
 * Those are suggested from the main answer until the person changes them. AGTPri.collect() returns everything for
 * POST /api/me/requests -> priorities (validated again by server/priorities.py). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["Not needed", "Slightly", "Slightly", "Slightly", "Moderately", "Moderately", "Moderately", "Important", "Important", "Critical", "Critical"];

  // key, label, one-line help, scale labels, and the finer questions that belong under it
  const MAJOR = [
    ["footfall", "Heavy footfall on the street", "How much do you want lots of people walking past the door?", null, ["visitors", "rail", "bus"]],
    ["residents", "Many people living nearby", "Homes and apartments close to the store.", null, ["kids", "youth", "seniors", "societies", "parks"]],
    ["workers", "People who work nearby", "Offices, tech parks and shops where people spend the day.", null, ["working", "offices", "techparks"]],
    ["avoid_rivals", "Avoiding areas with many competitors", "0 = happy to be next to rivals. 10 = want few or none nearby.", ["Don't mind", "Want none nearby"], ["brand_vs_local", "indirect"]],
    ["anchors", "Businesses nearby that bring you customers", "Malls, cafés, schools, stations and similar places that bring people in.", null, ["dining", "kidsvenues", "education", "malls", "supermarkets"]],
    ["avoid_cannibal", "Not taking sales from your own outlets", "Only matters if you already have stores. 0 = don't mind, 10 = avoid strongly.", ["Don't mind", "Avoid strongly"], []],
  ];
  // finer questions: label, hint, scale labels, and how the suggestion is worked out from the main answers (m)
  const MINOR = {
    visitors: ["Visitors and people passing through", "", null, (m) => m.footfall],
    rail: ["Metro and rail stations", "", null, (m) => (m.footfall + m.anchors) / 2],
    bus: ["Bus stops", "", null, (m) => 0.5 * m.footfall],
    kids: ["Children (0–14) as customers", "", null, (m) => 0.7 * m.residents],
    youth: ["Teens and young adults (15–24)", "", null, (m) => (m.footfall + m.residents) / 2],
    seniors: ["Seniors (60+)", "", null, (m) => 0.6 * m.residents],
    societies: ["Residential societies and apartments", "", null, (m) => m.residents],
    parks: ["Parks and open spaces", "", null, (m) => 0.5 * m.residents],
    working: ["Working adults (25–59)", "", null, (m) => (m.residents + m.workers) / 2],
    offices: ["Office buildings", "", null, (m) => m.workers],
    techparks: ["Tech parks and campuses", "", null, (m) => 0.8 * m.workers],
    brand_vs_local: ["Big branded rivals vs small local ones", "0 = local shops hurt you more. 10 = big brands hurt you more.", ["Local hurt more", "Branded hurt more"], (m) => (m.avoid_rivals + 5) / 2],
    indirect: ["Shops selling something similar (not the same)", "How much should they count as rivals?", ["Not at all", "Fully"], (m) => 0.6 * m.avoid_rivals],
    dining: ["Restaurants and cafés", "", null, (m) => m.anchors],
    kidsvenues: ["Kids and family venues", "", null, (m) => 0.9 * (m.anchors + m.residents) / 2],
    education: ["Schools, colleges and coaching", "", null, (m) => 0.8 * (m.residents + m.anchors) / 2],
    malls: ["Malls and cinemas", "", null, (m) => (m.footfall + m.anchors) / 2],
    supermarkets: ["Supermarkets and high streets", "", null, (m) => 0.8 * (m.footfall + m.residents) / 2],
  };

  const S = { major: {}, minor: {}, other: { label: "", score: null }, comp: { doms: new Set(), brands: new Map() }, nearby: { doms: new Set(), brands: new Map() } };
  const CAT = window.AGT_BRANDS || [];
  const el = {}, subOf = {};

  function slider(key, label, hint, scale) {
    const d = document.createElement("div"); d.className = "q unset"; d.dataset.k = key;
    d.innerHTML = `<div class="q-top"><label class="q-l" for="s_${key}">${esc(label)}<span class="q-tag" hidden></span></label><span class="q-val"><output>Not sure</output></span></div>
      ${hint ? `<div class="q-h">${esc(hint)}</div>` : ""}
      <input id="s_${key}" type="range" min="0" max="10" step="1" value="5" aria-label="${esc(label)}, 0 to 10" />
      <div class="q-s"><span>${esc((scale || [])[0] || "Doesn't matter")}</span><span>${esc((scale || [])[1] || "Critical")}</span></div>`;
    return d;
  }
  function paint(d, value, tag, clearable) {
    const o = $("output", d), inp = $("input", d), t = $(".q-tag", d), val = $(".q-val", d);
    d.classList.toggle("unset", value == null);
    inp.value = value == null ? 5 : value; inp.style.setProperty("--p", ((value == null ? 5 : value) * 10) + "%");
    o.textContent = value == null ? "Not sure" : `${value} · ${WORDS[value]}`;
    const b = $(".q-clear", d);
    if (value != null && clearable) {
      if (!b) { const x = document.createElement("button"); x.type = "button"; x.className = "q-clear"; x.textContent = "Clear"; x.addEventListener("click", () => d.dispatchEvent(new CustomEvent("clear"))); val.append(x); }
    } else if (b) b.remove();
    t.hidden = !tag; t.textContent = tag === "edited" ? "Edited" : tag === "auto" ? "Suggested" : ""; t.classList.toggle("edited", tag === "edited");
  }
  function bindSlider(d, onSet, onClear) {
    const inp = $("input", d);
    const set = () => { inp.style.setProperty("--p", (parseInt(inp.value, 10) * 10) + "%"); onSet(parseInt(inp.value, 10)); };
    inp.addEventListener("input", set); inp.addEventListener("change", set); inp.addEventListener("pointerup", set);
    d.addEventListener("clear", onClear);
  }

  // ---- main questions, each with its own closed fine-tune dropdown
  function buildMajor() {
    const box = $("#priMajor");
    MAJOR.forEach(([k, label, hint, scale, subs]) => {
      const g = document.createElement("div"); g.className = "qgroup"; g.dataset.g = k;
      const d = slider(k, label, hint, scale); d.classList.add("major");
      g.append(d); el[k] = d; S.major[k] = null;
      bindSlider(d, (v) => { S.major[k] = v; paint(d, v, "", true); calibrate(); summary(); }, () => { S.major[k] = null; paint(d, null, "", false); calibrate(); summary(); });
      if (subs.length) {
        const det = document.createElement("details"); det.className = "sub"; det.dataset.sub = k;
        det.innerHTML = `<summary><span>Fine-tune</span><em class="sub-n"></em></summary><div class="sub-body"><p class="sub-note"><span class="sub-state"></span><button type="button" class="sub-reset" hidden>Reset to suggested</button></p><div class="sub-list"></div></div>`;
        const list = $(".sub-list", det);
        subs.forEach((m) => {
          const [l, h, sc] = MINOR[m];
          const q = slider(m, l, h, sc); q.classList.add("minor");
          list.append(q); el[m] = q; subOf[m] = k; S.minor[m] = { value: null, manual: false };
          bindSlider(q, (v) => { const s = S.minor[m]; if (s.value === v) return; s.value = v; s.manual = true; paint(q, v, "edited", false); subState(k); },
            () => { S.minor[m].manual = false; calibrate(); });
        });
        if (k === "anchors") {
          const o = document.createElement("div"); o.className = "q-other";
          o.innerHTML = `<div class="q-top"><label class="q-l" for="o_label">Something else that brings you customers</label></div>
            <div class="q-h">In your own words, for example: temples, wedding halls, hospitals. Then score it.</div>
            <div class="field" style="margin:2px 0 12px"><input id="o_label" maxlength="60" placeholder="e.g. Hospitals" autocomplete="off" /></div>`;
          const od = slider("other", "How important is it?", "", null); od.classList.add("minor"); o.append(od); list.append(o);
          $("#o_label", o).addEventListener("input", (e) => { S.other.label = e.target.value.trim(); });
          bindSlider(od, (v) => { S.other.score = v; paint(od, v, "", false); }, () => { S.other.score = null; paint(od, null, "", false); });
        }
        $(".sub-reset", det).addEventListener("click", () => { subs.forEach((m) => { S.minor[m].manual = false; }); calibrate(); });
        g.append(det);
      }
      box.append(g);
    });
    // timing and money
    const det = document.createElement("details"); det.className = "sub standalone";
    const hours = (a) => `<option value="">${a}</option>` + Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("");
    det.innerHTML = `<summary><span>About your sales</span><em>busy hours, average bill · optional</em></summary><div class="sub-body">
      <p class="sub-note"><span>Helps us calibrate the sales estimate. Skip any you don't know.</span></p>
      <div class="pri-two"><div class="field"><label for="i_from">Busiest hours: from</label><select id="i_from">${hours("Not sure")}</select></div>
        <div class="field"><label for="i_to">to</label><select id="i_to"><option value="">Not sure</option>${Array.from({ length: 24 }, (_, h) => `<option value="${h + 1}">${String(h + 1).padStart(2, "0")}:00</option>`).join("")}</select></div></div>
      <div class="pri-two"><div class="field"><label for="i_ticket">Average bill per customer (₹)</label><input id="i_ticket" type="number" min="1" inputmode="numeric" placeholder="e.g. 250" /></div>
        <div class="field"><label for="i_units">Bills a day at a typical outlet</label><input id="i_units" type="number" min="1" inputmode="numeric" placeholder="e.g. 300" /></div></div></div>`;
    box.append(det);
  }
  function subState(k) {
    const det = $(`details[data-sub="${k}"]`); if (!det) return;
    const keys = Object.keys(subOf).filter((m) => subOf[m] === k), ed = keys.filter((m) => S.minor[m].manual).length;
    $(".sub-reset", det).hidden = !ed;
    $(".sub-n", det).textContent = ed ? `${ed} edited` : S.major[k] == null ? `${keys.length}${k === "anchors" ? "+" : ""} questions` : "suggested for you";
    $(".sub-state", det).textContent = S.major[k] == null ? "Answer the question above and these are suggested for you." : "Suggested from your answer above. Change anything you like.";
  }
  // Suggest the finer answers from the main ones, unless the person has changed them.
  function calibrate() {
    const have = Object.values(S.major).some((v) => v != null);
    const m = {}; Object.keys(S.major).forEach((k) => { m[k] = S.major[k] == null ? 5 : S.major[k]; });
    Object.keys(MINOR).forEach((k) => {
      const s = S.minor[k]; if (!s || s.manual) return;
      s.value = have ? Math.max(0, Math.min(10, Math.round(MINOR[k][3](m)))) : null;
      paint(el[k], s.value, s.value == null ? "" : "auto", false);
    });
    MAJOR.forEach(([k]) => subState(k));
  }
  function summary() {
    const n = Object.values(S.major).filter((v) => v != null).length, b = S.comp.brands.size + S.nearby.brands.size;
    const box = $("#priSummary"); if (!box) return;
    box.textContent = n || b ? `${n} of 6 priorities answered${b ? ` · ${b} brand${b === 1 ? "" : "s"} chosen` : ""}` : "Optional. Answer what you can.";
  }

  // ---- brand pickers
  const SHOW = 9;
  function picker(kind, title, hint) {
    const st = S[kind], card = document.createElement("div"); card.className = "bp-card";
    card.innerHTML = `<div><h4>${esc(title)}</h4><div class="bp-h">${esc(hint)}</div></div>
      <div class="chips" data-doms>${CAT.map((d, i) => `<button type="button" class="chip" data-d="${d.id}" aria-pressed="false"${i >= SHOW ? " hidden data-extra" : ""}>${esc(d.label)}</button>`).join("")}</div>
      <button type="button" class="more-types">Show all ${CAT.length} types</button>
      <div data-blocks style="display:grid;gap:12px"></div>
      <div class="bp-add"><input placeholder="Add another brand" maxlength="50" aria-label="Add another brand" /><button type="button" class="btn btn-secondary btn-sm">Add</button></div>
      <div class="bp-sum" data-sum></div>`;
    const blocks = $("[data-blocks]", card), sum = $("[data-sum]", card), moreBtn = $(".more-types", card);
    const refresh = () => { const n = st.brands.size; sum.textContent = n ? `${n} brand${n === 1 ? "" : "s"} selected` : ""; summary(); };
    moreBtn.addEventListener("click", () => {
      const open = moreBtn.dataset.open !== "1"; moreBtn.dataset.open = open ? "1" : "0";
      card.querySelectorAll("[data-extra]").forEach((c) => { c.hidden = !open && c.getAttribute("aria-pressed") !== "true"; });
      moreBtn.textContent = open ? "Show fewer types" : `Show all ${CAT.length} types`;
    });
    const PAGE = 24;
    function block(dom) {
      let b = blocks.querySelector(`[data-b="${dom.id}"]`);
      if (b) return b;
      b = document.createElement("div"); b.className = "bp-dom"; b.dataset.b = dom.id;
      const n = dom.brands.length, many = n > PAGE;
      b.innerHTML = `<div class="bp-dom-h"><b>${esc(dom.label)}</b><span>${n} brand${n === 1 ? "" : "s"} in our database</span><button type="button" data-clear hidden>Clear</button></div>
        ${many ? `<input class="bp-search" type="search" placeholder="Search ${n} brands" aria-label="Search ${esc(dom.label)} brands" autocomplete="off" />` : ""}
        <div class="chips" data-list></div><button type="button" class="more-types" data-more hidden></button><div class="bp-none" hidden>No brand matches. Use “Add another brand” below.</div>`;
      let shown = PAGE, q = "";
      const list = $("[data-list]", b), more = $("[data-more]", b), none = $(".bp-none", b), clr = $("[data-clear]", b);
      const render = () => {
        const ql = q.trim().toLowerCase();
        const match = dom.brands.filter((x) => !ql || x.name.toLowerCase().includes(ql));
        const vis = ql ? match : match.slice(0, shown);
        const extra = ql ? [] : match.slice(shown).filter((x) => st.brands.has(x.name));     // a chosen brand never hides behind "Show more"
        list.innerHTML = [...vis, ...extra].map((x) => `<button type="button" class="chip brand" data-n="${esc(x.name)}" title="Found in ${x.c} cit${x.c === 1 ? "y" : "ies"}" aria-pressed="${st.brands.has(x.name)}">${esc(x.name)}</button>`).join("");
        const left = ql ? 0 : match.length - shown;
        more.hidden = left <= 0; more.textContent = `Show ${Math.min(PAGE, left)} more (${left} left)`;
        none.hidden = match.length > 0;
        clr.hidden = !dom.brands.some((x) => st.brands.get(x.name) === dom.id);
      };
      more.addEventListener("click", () => { shown += PAGE; render(); });
      clr.addEventListener("click", () => { dom.brands.forEach((x) => { if (st.brands.get(x.name) === dom.id) st.brands.delete(x.name); }); render(); refresh(); });
      const search = $(".bp-search", b); if (search) search.addEventListener("input", (e) => { q = e.target.value; render(); });
      list.addEventListener("click", (e) => {
        const c = e.target.closest(".chip.brand"); if (!c) return;
        const nm = c.dataset.n, on = c.getAttribute("aria-pressed") !== "true"; c.setAttribute("aria-pressed", String(on));
        on ? st.brands.set(nm, dom.id) : st.brands.delete(nm); clr.hidden = !dom.brands.some((x) => st.brands.get(x.name) === dom.id); refresh();
      });
      render();
      return b;
    }
    card.addEventListener("click", (e) => {
      const c = e.target.closest("[data-d]"); if (!c || !c.matches(".chips[data-doms] .chip")) return;
      const dom = CAT.find((d) => d.id === c.dataset.d), on = c.getAttribute("aria-pressed") !== "true";
      c.setAttribute("aria-pressed", String(on));
      if (!on && c.hasAttribute("data-extra") && moreBtn.dataset.open !== "1") c.hidden = true;
      if (on) { st.doms.add(dom.id); blocks.append(block(dom)); }
      else { st.doms.delete(dom.id); dom.brands.forEach((x) => st.brands.delete(x.name)); const b = blocks.querySelector(`[data-b="${dom.id}"]`); if (b) b.remove(); refresh(); }
    });
    const inp = $(".bp-add input", card), add = () => {
      const n = inp.value.replace(/\s+/g, " ").trim(); if (n.length < 2) return;
      if (!st.brands.has(n)) st.brands.set(n, "other");
      let b = blocks.querySelector('[data-b="other"]');
      if (!b) { b = document.createElement("div"); b.className = "bp-dom"; b.dataset.b = "other"; b.innerHTML = `<div class="bp-dom-h"><b>Added by you</b></div><div class="chips"></div>`; blocks.append(b); b.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; st.brands.delete(c.dataset.n); c.remove(); refresh(); }); }
      if (![...b.querySelectorAll(".chip")].some((c) => c.dataset.n === n)) { const c = document.createElement("button"); c.type = "button"; c.className = "chip brand"; c.dataset.n = n; c.setAttribute("aria-pressed", "true"); c.title = "Click to remove"; c.textContent = n; b.querySelector(".chips").append(c); }
      inp.value = ""; refresh();
    };
    $(".bp-add button", card).addEventListener("click", add);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    return card;
  }
  function buildBrands() {
    const box = $("#brandBox");
    box.append(picker("comp", "Who do you compete with?", "Pick the kind of business, then tick the brands that compete with you."));
    box.append(picker("nearby", "Which brands bring you customers?", "Brands you'd like to be near: malls, cinemas, cafés, schools and so on."));
  }

  function collect() {
    const num = (id) => { const v = $(id).value; return v === "" ? null : Number(v); };
    const minor = {}; Object.entries(S.minor).forEach(([k, m]) => { minor[k] = { value: m.value, manual: m.manual }; });
    const brands = (st) => [...st.brands.entries()].map(([name, domain]) => ({ name, domain }));
    return { major: { ...S.major }, minor, other: { ...S.other },
      inputs: { peak_from: num("#i_from"), peak_to: num("#i_to"), avg_ticket: num("#i_ticket"), baseline_units: num("#i_units") },
      brands: { competitors: brands(S.comp), complementary: brands(S.nearby) } };
  }
  function mount() { if (!$("#priMajor")) return; buildMajor(); buildBrands(); calibrate(); summary(); }
  window.AGTPri = { collect };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
