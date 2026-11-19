/* Screen protection for accounts the super admin has marked as protected.
   Loaded by api.js only on the dashboard (pages with <meta name="agt-guard">) and only when
   /api/session says guard: true (never for super admins).
   A web page cannot detect or block screen sharing or screenshots, so nothing here covers the screen.
   It blocks printing, saving, right-click, copy and drag, and logs those attempts for the admin. */
(function () {
  if (window.__agtGuard) return;
  window.__agtGuard = true;

  const root = document.documentElement;
  root.classList.add("agt-guarded");

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.id = "agt-guard-css";
  css.textContent = `
    .agt-guarded body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .agt-guarded input, .agt-guarded textarea, .agt-guarded select, .agt-guarded [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
    .agt-guarded img, .agt-guarded canvas, .agt-guarded svg { -webkit-user-drag: none; }
    @media print { body > *:not(#agt-print) { display: none !important; } #agt-print { display: block !important; } }
    #agt-print { display: none; font: 16px/1.5 Arial, sans-serif; padding: 48px; color: #000; }
  `;
  document.head.appendChild(css);

  let pr;
  function mount() {
    if (!document.body) return;
    if (!pr || !pr.isConnected) { pr = document.createElement("div"); pr.id = "agt-print"; pr.textContent = "Printing is disabled for this account. Contact AGT Intelligence for an authorised copy."; document.body.appendChild(pr); }
    if (!css.isConnected) document.head.appendChild(css);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  /* ---------- audit trail ---------- */
  function log(kind) {
    try { window.AGT && AGT.api("/api/me/guard-event", { body: { kind, page: location.pathname.split("/").pop() + location.search } }).catch(() => {}); } catch (e) { /* ignore */ }
  }
  log("active");   // one line per dashboard load, so the admin can confirm protection ran on that device

  /* ---------- block print, save, copy, right-click, drag ---------- */
  const editable = (el) => el && el.closest && el.closest("input, textarea, select, [contenteditable='true']");
  document.addEventListener("contextmenu", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("copy", (e) => { if (!editable(e.target)) { e.preventDefault(); log("copy"); } }, true);
  document.addEventListener("cut", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener("dragstart", (e) => { if (!editable(e.target)) e.preventDefault(); }, true);
  window.addEventListener("beforeprint", () => log("print"));
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && (k === "p" || k === "s")) { e.preventDefault(); log(k === "p" ? "print" : "save"); return; }
    if (mod && e.shiftKey && (k === "s" || k === "3" || k === "4" || k === "5")) log("screenshot_key");
    if (k === "printscreen") log("printscreen");
  }, true);
  document.addEventListener("keyup", (e) => {
    if ((e.key || "").toLowerCase() === "printscreen") {
      try { navigator.clipboard && navigator.clipboard.writeText(""); } catch (x) { /* not permitted */ }
    }
  }, true);
})();
