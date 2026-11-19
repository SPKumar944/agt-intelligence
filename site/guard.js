/* Screen protection for accounts the super admin has marked as protected.
   Loaded by api.js only on the dashboard (pages with <meta name="agt-guard">) and only when
   /api/session says guard: true (never for super admins). A browser cannot block screenshots or
   screen sharing outright; this makes casual capture and copying harder: content is covered when
   the window is not in focus, and printing, right-click, copy and drag are blocked. */
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
    #agt-shield { position: fixed; inset: 0; z-index: 2147483647; display: none; place-items: center; text-align: center; padding: 24px;
      background: rgba(0,0,0,.55); -webkit-backdrop-filter: blur(28px) saturate(.6); backdrop-filter: blur(28px) saturate(.6);
      color: #f5f5f7; font: 600 17px/1.45 -apple-system, BlinkMacSystemFont, Inter, "Helvetica Neue", Arial, sans-serif; }
    #agt-shield small { display: block; font-weight: 400; font-size: 14px; opacity: .75; margin-top: 6px; }
    .agt-hidden #agt-shield { display: grid; }
    @media print { body > *:not(#agt-print) { display: none !important; } #agt-print { display: block !important; } }
    #agt-print { display: none; font: 16px/1.5 Arial, sans-serif; padding: 48px; color: #000; }
  `;
  document.head.appendChild(css);

  let shield, pr;
  function mount() {
    if (!document.body) return;
    if (!shield || !shield.isConnected) {
      shield = document.createElement("div"); shield.id = "agt-shield"; shield.setAttribute("role", "status");
      shield.innerHTML = "Content hidden while this window is not in focus<small>Click here to continue. Screen capture and sharing of this dashboard are not permitted for this account.</small>";
      shield.addEventListener("click", () => show());
      document.body.appendChild(shield);
    }
    if (!pr || !pr.isConnected) { pr = document.createElement("div"); pr.id = "agt-print"; pr.textContent = "Printing is disabled for this account. Contact AGT Intelligence for an authorised copy."; document.body.appendChild(pr); }
    if (!css.isConnected) document.head.appendChild(css);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  new MutationObserver(() => { if (!shield || !shield.isConnected || !css.isConnected) mount(); })
    .observe(document.documentElement, { childList: true, subtree: true });

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
