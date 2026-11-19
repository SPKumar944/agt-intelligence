/* Request form: "What matters to you" (0-10 sliders) and "Competitors and nearby brands" pickers.
 * Six main questions are always visible. The finer ones sit in dropdowns and are suggested from the main answers until the person
 * changes them. AGTPri.collect() returns everything for POST /api/me/requests → priorities (validated again by server/priorities.py). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const WORDS = ["Not needed", "Slightly", "Slightly", "Slightly", "Moderately", "Moderately", "Moderately", "Important", "Important", "Critical", "Critical"];

  const MAJOR = [
    ["footfall", "Heavy footfall on the street", "How much do you want lots of people walking past the door?"],
    ["residents", "Many people living nearby", "Homes and apartments close to the store."],
    ["workers", "People who work nearby", "Offices, tech parks and shops where people spend the day."],
    ["avoid_rivals", "Avoiding areas with many competitors", "0 = happy to be next to rivals. 10 = want few or none nearby."],
    ["anchors", "Businesses nearby that bring you customers", "Malls, cafés, schools, stations and similar places that bring people in."],
    ["avoid_cannibal", "Not taking sales from your own outlets", "Matters when you already have stores. 0 = don't mind, 10 = avoid strongly."],
  ];
  // Finer questions: key, label, hint, [how the suggestion is worked out from the main answers]
  const GROUPS = [
    { id: "customers", title: "Who your customers are", sub: "5 questions", items: [
      ["kids", "Children (0–14)", "", (m) => 0.7 * m.residents],
      ["youth", "Teens and young adults (15–24)", "", (m) => (m.footfall + m.residents) / 2],
      ["working", "Working adults (25–59)", "", (m) => (m.residents + m.workers) / 2],
      ["seniors", "Seniors (60+)", "", (m) => 0.6 * m.residents],
      ["visitors", "Visitors and people passing through", "", (m) => m.footfall],
    ] },
    { id: "places", title: "Places that bring you customers", sub: "12 questions", items: [
      ["dining", "Restaurants and cafés", "", (m) => m.anchors],
      ["kidsvenues", "Kids and family venues", "", (m) => 0.9 * (m.anchors + m.residents) / 2],
      ["education", "Schools, colleges and coaching", "", (m) => 0.8 * (m.residents + m.anchors) / 2],
      ["rail", "Metro and rail stations", "", (m) => (m.footfall + m.anchors) / 2],
      ["bus", "Bus stops", "", (m) => 0.5 * m.footfall],
      ["techparks", "Tech parks and campuses", "", (m) => 0.8 * m.workers],
      ["offices", "Office buildings", "", (m) => m.workers],
      ["malls", "Malls and cinemas", "", (m) => (m.footfall + m.anchors) / 2],
      ["parks", "Parks and open spaces", "", (m) => 0.5 * m.residents],
      ["supermarkets", "Supermarkets and high streets", "", (m) => 0.8 * (m.footfall + m.residents) / 2],
      ["societies", "Residential societies and apartments", "", (m) => m.residents],
    ], other: true },
    { id: "competition", title: "Competition", sub: "2 questions", items: [
      ["brand_vs_local", "Big branded rivals vs small local ones", "0 = local shops hurt you more. 10 = big brands hurt you more.", (m) => (m.avoid_rivals + 5) / 2],
      ["indirect", "Shops selling something similar (not the same)", "How much should they count as rivals? 0 = not at all, 10 = fully.", (m) => 0.6 * m.avoid_rivals],
    ] },
  ];

  const S = { major: {}, minor: {}, other: { label: "", score: null }, comp: { doms: new Set(), brands: new Map() }, nearby: { doms: new Set(), brands: new Map() } };
  const CAT = window.AGT_BRANDS || [];

  function slider(key, label, hint, opt = {}) {
    const d = document.createElement("div"); d.className = "q unset"; d.dataset.k = key;
    d.innerHTML = `<div class="q-top"><label class="q-l" for="s_${key}">${esc(label)}<span class="q-tag" hidden></span></label><output>${opt.noSure || "Not sure"}</output></div>
      ${hint ? `<div class="q-h">${esc(hint)}</div>` : ""}
      <input id="s_${key}" type="range" min="0" max="10" step="1" value="5" aria-label="${esc(label)}, 0 to 10" />
      <div class="q-s"><span>${esc(opt.lo || "Doesn't matter")}</span><span>${esc(opt.hi || "Critical")}</span></div>`;
    return d;
  }
  function paint(d, value, tag) {
    const o = $("output", d), inp = $("input", d), t = $(".q-tag", d);
    d.classList.toggle("unset", value == null);
    inp.value = value == null ? 5 : value; inp.style.setProperty("--p", ((value == null ? 5 : value) * 10) + "%");
    o.innerHTML = value == null ? "Not sure" : `${value} · ${WORDS[value]}`;
    if (value != null && !("noclear" in d.dataset)) {
      if (!$(".q-clear", d)) { const b = document.createElement("button"); b.type = "button"; b.className = "q-clear"; b.textContent = "Clear"; b.addEventListener("click", () => d.dispatchEvent(new CustomEvent("clear"))); o.after(b); }
    } else { const b = $(".q-clear", d); if (b) b.remove(); }
    t.hidden = !tag; t.textContent = tag === "edited" ? "Edited" : tag === "auto" ? "Suggested" : ""; t.classList.toggle("edited", tag === "edited");
  }
  function bindSlider(d, onSet, onClear) {
    const inp = $("input", d);
    const set = () => { inp.style.setProperty("--p", (parseInt(inp.value, 10) * 10) + "%"); onSet(parseInt(inp.value, 10)); };
    inp.addEventListener("input", set); inp.addEventListener("change", set);
    inp.addEventListener("pointerup", set); inp.addEventListener("keyup", (e) => { if (e.key === "Tab") return; set(); });
    d.addEventListener("clear", onClear);
  }

  // ---- main questions
  function buildMajor() {
    const box = $("#priMajor");
    MAJOR.forEach(([k, l, h]) => {
      const d = slider(k, l, h, k === "avoid_rivals" || k === "avoid_cannibal" ? { lo: "Don't mind", hi: k === "avoid_rivals" ? "Want none nearby" : "Avoid strongly" } : {});
      box.append(d);
      S.major[k] = null;
      bindSlider(d, (v) => { S.major[k] = v; paint(d, v); calibrate(); }, () => { S.major[k] = null; paint(d, null); calibrate(); });
    });
  }

  // ---- fine-tune dropdowns
  const minorEl = {};
  function buildMore() {
    const box = $("#priMore");
    GROUPS.forEach((g) => {
      const det = document.createElement("details"); det.className = "pri-more"; det.dataset.g = g.id;
      det.innerHTML = `<summary>${esc(g.title)}<em>${esc(g.sub)}</em></summary><div class="pri-body"><p class="pri-note"><span class="pri-state">Fill in the main questions above and these are suggested for you.</span><button type="button" class="pri-reset" hidden>Reset to suggested</button></p><div class="pri-list"></div></div>`;
      const list = $(".pri-list", det);
      g.items.forEach(([k, l, h, f]) => {
        const d = slider(k, l, h, k === "brand_vs_local" ? { lo: "Local hurt more", hi: "Branded hurt more" } : k === "indirect" ? { lo: "Not at all", hi: "Fully" } : {});
        d.dataset.noclear = "";
        list.append(d); minorEl[k] = d; S.minor[k] = { value: null, manual: false, fn: f };
        bindSlider(d, (v) => { const m = S.minor[k]; if (m.value === v) return; m.value = v; m.manual = true; paint(d, v, "edited"); updateReset(det); },
          () => { S.minor[k].manual = false; calibrate(); });
      });
      if (g.other) {
        const o = document.createElement("div"); o.className = "q-other";
        o.innerHTML = `<div class="q-top"><label class="q-l" for="o_label">Something else that brings you customers</label></div><div class="q-h">Type it in your own words, then score it. For example: temples, wedding halls, hospitals.</div>
          <div class="field" style="margin-bottom:10px"><input id="o_label" maxlength="60" placeholder="e.g. Hospitals" autocomplete="off" /></div>`;
        const od = slider("other", "How important is it?", "", {}); od.dataset.noclear = ""; od.style.marginTop = "4px";
        o.append(od); list.append(o);
        $("#o_label", o).addEventListener("input", (e) => { S.other.label = e.target.value.trim(); });
        bindSlider(od, (v) => { S.other.score = v; paint(od, v); }, () => { S.other.score = null; paint(od, null); });
      }
      $(".pri-reset", det).addEventListener("click", () => { g.items.forEach(([k]) => { S.minor[k].manual = false; }); calibrate(); });
      box.append(det);
    });
    // timing and money
    const det = document.createElement("details"); det.className = "pri-more";
    const hours = (a) => `<option value="">${a}</option>` + Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("");
    det.innerHTML = `<summary>Timing and money<em>4 optional answers</em></summary><div class="pri-body">
      <p class="pri-note"><span>These help calibrate the sales estimate. Skip any you don't know.</span></p>
      <div class="pri-two"><div class="field"><label for="i_from">Busiest hours: from</label><select id="i_from">${hours("Not sure")}</select></div>
        <div class="field"><label for="i_to">to</label><select id="i_to"><option value="">Not sure</option>${Array.from({ length: 24 }, (_, h) => `<option value="${h + 1}">${String(h + 1).padStart(2, "0")}:00</option>`).join("")}</select></div></div>
      <div class="pri-two"><div class="field"><label for="i_ticket">Average bill per customer (₹)</label><input id="i_ticket" type="number" min="1" inputmode="numeric" placeholder="e.g. 250" /></div>
        <div class="field"><label for="i_units">Bills a day at a typical outlet</label><input id="i_units" type="number" min="1" inputmode="numeric" placeholder="e.g. 300" /></div></div></div>`;
    box.append(det);
  }
  function updateReset(det) {
    const any = [...det.querySelectorAll(".q")].some((q) => S.minor[q.dataset.k] && S.minor[q.dataset.k].manual);
    $(".pri-reset", det).hidden = !any;
  }
  // Suggest the finer answers from the main ones, unless the person has changed them.
  function calibrate() {
    const have = Object.values(S.major).some((v) => v != null);
    const m = {}; Object.keys(S.major).forEach((k) => { m[k] = S.major[k] == null ? 5 : S.major[k]; });
    GROUPS.forEach((g) => {
      g.items.forEach(([k, , , f]) => {
        const s = S.minor[k]; if (s.manual) return;
        s.value = have ? Math.max(0, Math.min(10, Math.round(f(m)))) : null;
        paint(minorEl[k], s.value, s.value == null ? "" : "auto");
      });
      const det = $(`details[data-g="${g.id}"]`); updateReset(det);
      $(".pri-state", det).textContent = have ? "Suggested from your answers above. Change anything you like." : "Fill in the main questions above and these are suggested for you.";
    });
  }

  // ---- brand pickers
  const SHOW = 9;
  function picker(kind, title, hint) {
    const st = S[kind], card = document.createElement("div"); card.className = "bp-card";
    card.innerHTML = `<div><h4>${esc(title)}</h4><div class="q-h">${esc(hint)}</div></div>
      <div class="chips" data-doms>${CAT.map((d, i) => `<button type="button" class="chip" data-d="${d.id}" aria-pressed="false"${i >= SHOW ? " hidden data-extra" : ""}>${esc(d.label)}</button>`).join("")}</div>
      <button type="button" class="more-types">Show all ${CAT.length} types</button>
      <div data-blocks style="display:grid;gap:12px"></div>
      <div class="bp-add"><input placeholder="Add another brand" maxlength="50" aria-label="Add another brand" /><button type="button" class="btn btn-secondary btn-sm">Add</button></div>
      <div class="bp-sum" data-sum></div>`;
    const blocks = $("[data-blocks]", card), sum = $("[data-sum]", card);
    const moreBtn = $(".more-types", card);
    moreBtn.addEventListener("click", () => {
      const open = moreBtn.dataset.open !== "1"; moreBtn.dataset.open = open ? "1" : "0";
      card.querySelectorAll("[data-extra]").forEach((c) => { c.hidden = !open && c.getAttribute("aria-pressed") !== "true"; });
      moreBtn.textContent = open ? "Show fewer types" : `Show all ${CAT.length} types`;
    });
    const refresh = () => { const n = st.brands.size; sum.textContent = n ? `${n} brand${n === 1 ? "" : "s"} selected` : ""; };
    function block(dom) {
      let b = blocks.querySelector(`[data-b="${dom.id}"]`);
      if (!b) {
        b = document.createElement("div"); b.className = "bp-dom"; b.dataset.b = dom.id;
        b.innerHTML = `<div class="bp-dom-h"><b>${esc(dom.label)}</b><button type="button" data-all>Select all</button></div><div class="chips">${dom.brands.map((n) => `<button type="button" class="chip brand" data-n="${esc(n)}" aria-pressed="${st.brands.has(n)}">${esc(n)}</button>`).join("")}</div>`;
        $("[data-all]", b).addEventListener("click", (e) => {
          const all = dom.brands.every((n) => st.brands.has(n));
          dom.brands.forEach((n) => { all ? st.brands.delete(n) : st.brands.set(n, dom.id); });
          b.querySelectorAll(".chip.brand").forEach((c) => c.setAttribute("aria-pressed", String(!all))); e.target.textContent = all ? "Select all" : "Clear"; refresh();
        });
        b.addEventListener("click", (e) => { const c = e.target.closest(".chip.brand"); if (!c) return; const n = c.dataset.n, on = c.getAttribute("aria-pressed") !== "true"; c.setAttribute("aria-pressed", String(on)); on ? st.brands.set(n, dom.id) : st.brands.delete(n); refresh(); });
      }
      return b;
    }
    card.addEventListener("click", (e) => {
      const c = e.target.closest("[data-d]"); if (!c || !c.matches(".chips[data-doms] .chip")) return;
      const dom = CAT.find((d) => d.id === c.dataset.d), on = c.getAttribute("aria-pressed") !== "true";
      c.setAttribute("aria-pressed", String(on));
      if (!on && c.hasAttribute("data-extra") && moreBtn.dataset.open !== "1") c.hidden = true;
      if (on) { st.doms.add(dom.id); blocks.append(block(dom)); }
      else { st.doms.delete(dom.id); dom.brands.forEach((n) => st.brands.delete(n)); const b = blocks.querySelector(`[data-b="${dom.id}"]`); if (b) b.remove(); refresh(); }
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
    box.append(picker("comp", "Who do you compete with?", "Pick the kinds of business, then tick the brands that compete with you."));
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
  function mount() { if (!$("#priMajor")) return; buildMajor(); buildMore(); buildBrands(); calibrate(); }
  window.AGTPri = { collect };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
