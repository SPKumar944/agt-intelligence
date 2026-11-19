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
      shield.innerHTML = '<div style="max-width:520px"><span class="agt-m">Dashboard hidden while this window is not in focus</span><small>Tap or click anywhere to continue. Screen capture and sharing of this dashboard are not permitted for this account.</small></div>';
      document.body.appendChild(shield);
    }
    if (!pr || !pr.isConnected) { pr = document.createElement("div"); pr.id = "agt-print"; pr.textContent = "Printing is disabled for this account. Contact AGT Intelligence for an authorised copy."; document.body.appendChild(pr); }
    if (!css.isConnected) document.head.appendChild(css);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  new MutationObserver(() => { if (!shield || !shield.isConnected || !css.isConnected) mount(); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- cover the content when nobody is actively using it ----------
     A web page cannot see screen sharing (Meet, Zoom, iPad screen broadcast), so the cover goes up whenever
     the dashboard is not being actively used: window not in focus, app in the background, or no touch,
     click, scroll or key for IDLE_MS. One tap or click brings it back. */
  const IDLE_MS = 20000;
  let idleTimer = 0;
  const setMsg = (why) => {
    if (!shield) return;
    shield.querySelector(".agt-m").textContent = why === "idle" ? "Dashboard hidden after 20 seconds without activity" : "Dashboard hidden while this window is not in focus";
  };
  const hide = (why) => { setMsg(why); root.classList.add("agt-hidden"); };
  const show = () => { root.classList.remove("agt-hidden"); arm(); };
  function arm() { clearTimeout(idleTimer); idleTimer = setTimeout(() => hide("idle"), IDLE_MS); }
  function activity() { if (!root.classList.contains("agt-hidden")) arm(); }
  ["pointermove", "wheel", "keydown", "touchmove", "scroll"].forEach((ev) => document.addEventListener(ev, activity, { capture: true, passive: true }));
  document.addEventListener("pointerdown", (e) => { if (root.classList.contains("agt-hidden")) { e.preventDefault(); e.stopPropagation(); show(); } else arm(); }, true);
  window.addEventListener("blur", () => hide("focus"));
  window.addEventListener("pagehide", () => hide("focus"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) hide("focus"); });
  if (!document.hasFocus()) hide("focus"); else arm();

  /* ---------- audit trail ---------- */
  function log(kind) {
    try { window.AGT && AGT.api("/api/me/guard-event", { body: { kind, page: location.pathname.split("/").pop() + location.search } }).catch(() => {}); } catch (e) { /* ignore */ }
  }

  log("active");   // one line per dashboard load, so the admin can confirm protection ran on that device

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
