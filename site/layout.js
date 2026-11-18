/* AGT Intelligence website — shared header, footer, menus, reveals and icons.
 * Each page sets <body data-page="..."> and includes <div id="site-header"></div> … <div id="site-footer"></div>. */
(function () {
  "use strict";
  /** Where contact requests go. Leave empty until decided: the form then copies the request instead. */
  window.AGT_CONTACT_EMAIL = "";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = document.body.dataset.page || "";

  const PLATFORM = [
    { href: "catchments.html", id: "catchments", icon: "map", t: "Dynamic catchments", d: "Trade areas from where customers actually live and work" },
    { href: "forecasting.html", id: "forecasting", icon: "line-chart", t: "Revenue forecasting", d: "Scores and forecasts you can open, driver by driver" },
    { href: "cannibalisation.html", id: "cannibalisation", icon: "layers", t: "Cannibalisation", d: "Overlap and sales transfer with your existing stores" },
    { href: "whitespace.html", id: "whitespace", icon: "target", t: "Whitespace", d: "Metro-wide scan for under-served pockets" },
  ];
  const NAV = [
    { href: "technology.html", id: "technology", t: "Technology" },
    { href: "methodology.html", id: "methodology", t: "Methodology" },
    { href: "industries.html", id: "industries", t: "Industries" },
    { href: "city-snapshots.html", id: "snapshots", t: "City snapshots" },
    { href: "pricing.html", id: "pricing", t: "Pricing" },
    { href: "trust.html", id: "trust", t: "Trust & data" },
  ];
  const LOGO = `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12 L10 4 L18 12 L10 20 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 12 L24 4 L32 12 L24 20 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" opacity=".5"/><circle cx="35.5" cy="12" r="2.4" fill="currentColor"/></svg>`;
  const onPlatform = page === "platform" || PLATFORM.some((p) => p.id === page);

  const head = $("#site-header");
  if (head) head.outerHTML = `
  <header class="site-header" id="siteHeader">
    <div class="wrap">
      <a class="logo" href="home.html">${LOGO}AGT Intelligence</a>
      <ul class="mainnav">
        <li class="has-menu" id="platMenu">
          <button type="button" aria-expanded="false" aria-haspopup="true" class="${onPlatform ? "active" : ""}">Platform
            <svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5 5 6.5 8 3.5"/></svg></button>
          <div class="mega" role="menu">
            ${PLATFORM.map((p) => `<a href="${p.href}" role="menuitem"><svg class="ico" data-icon="${p.icon}"></svg><b>${p.t}</b><span>${p.d}</span></a>`).join("")}
            <div class="mega-foot"><span>One engine, four questions, every answer explained.</span><a href="platform.html">Platform overview →</a></div>
          </div>
        </li>
        ${NAV.map((n) => `<li><a href="${n.href}" class="${page === n.id ? "active" : ""}">${n.t}</a></li>`).join("")}
        <li class="menu-cta"><a class="btn btn-primary" href="request-report.html">Request a report</a></li>
      </ul>
      <div class="head-cta">
        <button class="theme-btn" id="themeBtn" type="button" aria-label="Switch to dark mode" title="Light / dark"></button>
        <a class="signin" id="signinLink" href="login.html">Sign in</a>
        <a class="btn btn-primary btn-sm" href="request-report.html">Request a report</a>
        <button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h14M3 10h14M3 14h14"/></svg></button>
      </div>
    </div>
  </header>`;

  const foot = $("#site-footer");
  if (foot) foot.outerHTML = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="foot-grid">
        <div><a class="logo" href="home.html">${LOGO}AGT Intelligence</a>
          <p>Location intelligence for retail: trade areas, forecasts, cannibalisation and whitespace — each with the evidence behind it.</p></div>
        <div><h5>Platform</h5><ul><li><a href="platform.html">Overview</a></li>${PLATFORM.map((p) => `<li><a href="${p.href}">${p.t}</a></li>`).join("")}</ul></div>
        <div><h5>Company</h5><ul>${NAV.map((n) => `<li><a href="${n.href}">${n.t}</a></li>`).join("")}</ul></div>
        <div><h5>Get started</h5><ul><li><a href="request-report.html">Request a report</a></li><li><a href="pricing.html">Pricing &amp; credits</a></li><li><a href="account.html">My account</a></li><li><a href="contact.html">Book a demo</a></li></ul></div>
      </div>
      <div class="foot-note">
        <span>Interactive examples on this website are illustrative and do not represent any client. In client work, forecasts, trade areas and footfall are model estimates published with ranges and sources, and should be verified on the ground before commercial commitments. Map data © OpenStreetMap contributors; places data © Overture Maps Foundation.</span>
        <div class="row"><span>© ${new Date().getFullYear()} AGT Intelligence. All rights reserved.</span><span>Bengaluru, India</span></div>
      </div>
    </div>
  </footer>`;

  // ---------------------------------------------------------------- icons (IconMCP outline set)
  window.agtIcon = function (s) {
    s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.15"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true"); s.innerHTML = (typeof ICONS !== "undefined" && ICONS[s.dataset.icon]) || "";
  };
  $$("svg[data-icon]").forEach(window.agtIcon);

  // ---------------------------------------------------------------- light / dark (default light)
  const SUN = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="10" cy="10" r="3.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 11.6A6.6 6.6 0 0 1 8.4 3.5a6.6 6.6 0 1 0 8.1 8.1Z"/></svg>';
  const tb = $("#themeBtn");
  if (tb) {
    const paint = () => { const d = document.documentElement.dataset.theme === "dark"; tb.innerHTML = d ? SUN : MOON; tb.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); };
    paint();
    tb.addEventListener("click", () => {
      const d = document.documentElement.dataset.theme === "dark";
      try { localStorage.setItem("agt.theme", d ? "light" : "dark"); } catch (e) { /* ignore */ }
      if (d) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = "dark";
      location.reload();          // canvases and charts redraw in the new theme
    });
  }

  // ---------------------------------------------------------------- who is signed in
  if (window.AGT) AGT.session().then((u) => {
    const a = document.getElementById("signinLink"); if (!a) return;
    if (u.role === "user") { a.textContent = "My account"; a.href = "account.html"; }
    else if (u.role === "admin") { a.textContent = "Admin"; a.href = "admin.html"; }
  });

  // ---------------------------------------------------------------- menus
  const hdr = $("#siteHeader"), menus = $$(".has-menu");
  menus.forEach((m) => {                                   // Platform and City briefs share the same dropdown behaviour
    const btn = m.querySelector("button");
    const set = (o) => {
      if (o) menus.forEach((x) => { if (x !== m) { x.classList.remove("open"); x.querySelector("button").setAttribute("aria-expanded", false); } });
      m.classList.toggle("open", o); btn.setAttribute("aria-expanded", o);
    };
    let t;
    m.addEventListener("mouseenter", () => { if (innerWidth > 960) { clearTimeout(t); set(true); } });
    m.addEventListener("mouseleave", () => { if (innerWidth > 960) t = setTimeout(() => set(false), 120); });
    btn.addEventListener("click", () => set(!m.classList.contains("open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", (e) => { if (!m.contains(e.target)) set(false); });
  });
  const mb = $("#menuBtn");
  if (mb) mb.addEventListener("click", () => {
    const o = !hdr.classList.contains("open"); hdr.classList.toggle("open", o);
    mb.setAttribute("aria-expanded", o); mb.setAttribute("aria-label", o ? "Close menu" : "Open menu");
  });

  // ---------------------------------------------------------------- reveal
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { threshold: .1, rootMargin: "0px 0px -5% 0px" });
  $$(".rv").forEach((el) => io.observe(el));

  // ---------------------------------------------------------------- in-page subnav highlight
  const sublinks = $$(".subnav a[href^='#']");
  if (sublinks.length) {
    const secs = sublinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const upd = () => {
      let cur = secs[0];
      for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * .35) cur = s;
      sublinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + cur.id));
    };
    addEventListener("scroll", upd, { passive: true }); upd();
  }

  // ---------------------------------------------------------------- contact form (contact.html)
  const form = $("#contactForm");
  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = $("#formNote"), f = Object.fromEntries(new FormData(form));
    if (!String(f.name || "").trim()) { note.textContent = "Please add your name."; form.elements.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email || "").trim())) { note.textContent = "Please add a work email we can reply to."; form.elements.email.focus(); return; }
    const body = Object.entries(f).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
    const to = window.AGT_CONTACT_EMAIL;
    if (to) {
      location.href = `mailto:${to}?subject=${encodeURIComponent("Demo request — " + (f.company || f.name))}&body=${encodeURIComponent(body)}`;
      note.textContent = "Your email app should open with the request ready to send.";
    } else {
      try { await navigator.clipboard.writeText(body); note.textContent = "Request copied. Our contact address is being set up — please paste it into an email to your AGT contact."; }
      catch { note.textContent = "Our contact address is being set up — please reach your AGT contact directly."; }
    }
  });
})();
(function(){ if (!document.querySelector('script[src^="site/feedback.js"]')) { var f=document.createElement("script"); f.src="site/feedback.js?v=1"; document.body.appendChild(f); } })();
