/* Screen protection for accounts the super admin has marked as protected.
   Loaded by api.js only when /api/session says guard: true (never for super admins).
   A browser cannot block screenshots or screen sharing outright; this makes captures traceable
   (viewer watermark) and casual copying harder (blur when the window is not in focus,
   no printing, no right-click, copy or drag). */
(function () {
  if (window.__agtGuard) return;
  window.__agtGuard = true;

  const S = window.__agtGuardSession || {};
  const who = (S.email || "").toLowerCase();
  const code = "AGT-" + ((S.id || 0) * 7919 % 100000).toString(36).toUpperCase().padStart(4, "0");
  const root = document.documentElement;
  root.classList.add("agt-guarded");

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.id = "agt-guard-css";
  css.textContent = `
    .agt-guarded body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .agt-guarded input, .agt-guarded textarea, .agt-guarded select, .agt-guarded [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
    .agt-guarded img, .agt-guarded canvas, .agt-guarded svg { -webkit-user-drag: none; }
    #agt-wm { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; background-repeat: repeat; }
    #agt-shield { position: fixed; inset: 0; z-index: 2147483647; display: none; place-items: center; text-align: center; padding: 24px;
      background: rgba(0,0,0,.55); -webkit-backdrop-filter: blur(28px) saturate(.6); backdrop-filter: blur(28px) saturate(.6);
      color: #f5f5f7; font: 600 17px/1.45 -apple-system, BlinkMacSystemFont, Inter, "Helvetica Neue", Arial, sans-serif; }
    #agt-shield small { display: block; font-weight: 400; font-size: 14px; opacity: .75; margin-top: 6px; }
    .agt-hidden #agt-shield { display: grid; }
    @media print { body > *:not(#agt-print) { display: none !important; } #agt-print { display: block !important; } }
    #agt-print { display: none; font: 16px/1.5 Arial, sans-serif; padding: 48px; color: #000; }
  `;
  document.head.appendChild(css);

  /* ---------- watermark: viewer, time and code, tiled across the screen ---------- */
  function stamp() {
    const d = new Date();
    const t = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const dark = root.dataset.theme === "dark";
    const fill = dark ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.065)";
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><g transform="rotate(-24 210 110)" fill="${fill}" font-family="Arial, sans-serif" text-anchor="middle">` +
      `<text x="210" y="100" font-size="15" font-weight="700">${esc(who)}</text>` +
      `<text x="210" y="122" font-size="12">${esc(t)} · ${code} · Confidential</text></g></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }
  let wm, shield, pr;
  function mount() {
    if (!document.body) return;
    if (!wm || !wm.isConnected) { wm = document.createElement("div"); wm.id = "agt-wm"; wm.setAttribute("aria-hidden", "true"); document.body.appendChild(wm); }
    wm.style.backgroundImage = stamp();
    if (!shield || !shield.isConnected) {
      shield = document.createElement("div"); shield.id = "agt-shield"; shield.setAttribute("role", "status");
      shield.innerHTML = 'Content hidden while this window is not in focus<small>Click here to continue. This account is protected; captures are watermarked to ' + who.replace(/</g, "&lt;") + ".</small>";
      shield.addEventListener("click", () => show());
      document.body.appendChild(shield);
    }
    if (!pr || !pr.isConnected) { pr = document.createElement("div"); pr.id = "agt-print"; pr.textContent = "Printing is disabled for this account. Contact AGT Intelligence for an authorised copy."; document.body.appendChild(pr); }
    if (!css.isConnected) document.head.appendChild(css);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  setInterval(mount, 30000);
  new MutationObserver(() => { if (!wm || !wm.isConnected || !shield || !shield.isConnected || !css.isConnected) mount(); })
    .observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(() => { if (wm) wm.style.backgroundImage = stamp(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- hide content when the window is not in focus (screen share from another window, snipping tools) ---------- */
  const hide = () => root.classList.add("agt-hidden");
  const show = () => { if (document.hasFocus()) root.classList.remove("agt-hidden"); };
  window.addEventListener("blur", hide);
  window.addEventListener("focus", show);
  document.addEventListener("visibilitychange", () => (document.hidden ? hide() : show()));
  document.addEventListener("pointerdown", show, true);
  if (!document.hasFocus()) hide();

  /* ---------- audit trail ---------- */
  function log(kind) {
    try { window.AGT && AGT.api("/api/me/guard-event", { body: { kind, page: location.pathname.split("/").pop() + location.search } }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  /* ---------- block print, save, copy, right-click, drag ---------- */
  const editable = (el) => el && (el.closest("input, textarea, select, [contenteditable='true']"));
  document.addEventListener("contextmenu", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("copy", (e) => { if (!editable(e.target)) { e.preventDefault(); log("copy"); } }, true);
  document.addEventListener("cut", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("dragstart", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  window.addEventListener("beforeprint", () => log("print"));
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && (k === "p" || k === "s")) { e.preventDefault(); log(k === "p" ? "print" : "save"); return; }
    if (mod && e.shiftKey && (k === "s" || k === "3" || k === "4" || k === "5")) { hide(); log("screenshot_key"); }   // snipping / capture shortcuts the browser can see
    if (k === "printscreen") { hide(); log("printscreen"); }
  }, true);
  document.addEventListener("keyup", (e) => {
    if ((e.key || "").toLowerCase() === "printscreen") {
      hide();
      try { navigator.clipboard && navigator.clipboard.writeText(""); } catch (x) { /* not permitted */ }
      setTimeout(show, 1500);
    }
  }, true);
})();
