/* Floating "Request a feature or dataset" button on every page. Posts to /api/feedback, which stores it and emails the team. */
(function () {
  "use strict";
  if (document.getElementById("fbBtn")) return;
  const base = (window.AGT_API || "").replace(/\/$/, "");
  const css = `
  #fbBtn{position:fixed;right:18px;bottom:18px;z-index:900;display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--rule,var(--border-strong,#333));background:var(--bg,#000);color:var(--ink,var(--text,#fff));font:500 12px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.28)}
  #fbBtn svg{width:20px;height:20px;flex:none} #fbBtn:hover{background:color-mix(in srgb,var(--ink,var(--text,#fff)) 8%,var(--bg,#000))}
  #fbBtn span{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s} #fbBtn:hover span,#fbBtn:focus-visible span{max-width:170px}
  @media (max-width:640px){#fbBtn{right:12px;bottom:12px}}
  #fbDlg{border:1px solid var(--rule,var(--border-strong,#333));border-radius:10px;background:var(--bg,#000);color:var(--ink,var(--text,#fff));padding:0;width:min(480px,calc(100vw - 32px));font-family:inherit}
  #fbDlg::backdrop{background:rgba(0,0,0,.55)} #fbDlg form{padding:22px;display:grid;gap:14px}
  #fbDlg h2{margin:0;font:400 26px/1.1 var(--serif,'Instrument Serif',serif)} #fbDlg p{margin:0;font-size:13px;color:var(--ink-3,var(--text-3,#999))}
  #fbDlg .fb-k{display:flex;flex-wrap:wrap;gap:6px} #fbDlg .fb-k button{font:500 11px/1 var(--mono,monospace);letter-spacing:.05em;text-transform:uppercase;padding:8px 10px;border-radius:14px;border:1px solid var(--rule,var(--border-strong,#333));background:none;color:var(--ink-3,var(--text-3,#999));cursor:pointer}
  #fbDlg .fb-k button[aria-pressed=true]{color:var(--bg,#000);background:var(--ink,var(--text,#fff));border-color:var(--ink,var(--text,#fff))}
  #fbDlg textarea,#fbDlg input[type=email]{width:100%;box-sizing:border-box;font:400 14px/1.45 inherit;font-family:inherit;color:var(--ink,var(--text,#fff));background:color-mix(in srgb,var(--ink,var(--text,#fff)) 5%,var(--bg,#000));border:1px solid var(--rule,var(--border-strong,#333));border-radius:6px;padding:10px}
  #fbDlg textarea{min-height:110px;resize:vertical} #fbDlg .fb-r{display:flex;gap:10px;justify-content:flex-end;align-items:center}
  #fbDlg .fb-go{font:500 12px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;padding:11px 16px;border-radius:6px;border:0;background:var(--ink,var(--text,#fff));color:var(--bg,#000);cursor:pointer} #fbDlg .fb-x{background:none;border:0;color:var(--ink-3,var(--text-3,#999));cursor:pointer;font-size:13px}
  #fbDlg .fb-m{min-height:18px;font-size:13px} #fbDlg .fb-hp{position:absolute;left:-9999px;opacity:0}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement("button");
  btn.id = "fbBtn"; btn.type = "button"; btn.setAttribute("aria-label", "Request a feature or dataset");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M12 8.5v7M8.5 12h7"/></svg><span>Request a feature</span>';
  document.body.appendChild(btn);
  if (document.getElementById("rail")) btn.style.display = "none";   // the dashboard has its own button in the side rail
  const dlg = document.createElement("dialog"); dlg.id = "fbDlg"; dlg.setAttribute("aria-labelledby", "fbT");
  dlg.innerHTML = `<form method="dialog" novalidate><div><h2 id="fbT">What should we build or add?</h2><p>Tell us a feature, a dataset or a city you need. It goes straight to our team.</p></div>
    <div class="fb-k" role="group" aria-label="Type of request"><button type="button" data-k="feature" aria-pressed="true">Feature</button><button type="button" data-k="dataset" aria-pressed="false">Dataset</button><button type="button" data-k="city" aria-pressed="false">City</button><button type="button" data-k="other" aria-pressed="false">Other</button></div>
    <textarea id="fbMsg" maxlength="2000" placeholder="Describe what you need and what you would use it for" aria-label="Your request" required></textarea>
    <input type="email" id="fbEm" maxlength="120" placeholder="Your email (optional, only if you want a reply)" autocomplete="email" aria-label="Your email, optional">
    <input class="fb-hp" id="fbHp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="fb-m" id="fbM" role="status" aria-live="polite"></div>
    <div class="fb-r"><button type="button" class="fb-x" id="fbX">Close</button><button type="submit" class="fb-go" id="fbGo">Send request</button></div></form>`;
  document.body.appendChild(dlg);
  const $ = (s) => dlg.querySelector(s);
  let kind = "feature";
  const openForm = (k) => { if (k) { kind = k; dlg.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === k)); } $("#fbM").textContent = ""; if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); $("#fbMsg").focus(); };
  window.AGTFeedback = { open: openForm };
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-feedback]"); if (t) { e.preventDefault(); openForm(t.dataset.feedback); } });
    btn.addEventListener("click", () => openForm());
  $("#fbX").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $(".fb-k").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; kind = b.dataset.k; dlg.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#fbM"), go = $("#fbGo"); m.style.color = ""; m.textContent = ""; go.disabled = true;
    try {
      const r = await fetch(base + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ kind, message: $("#fbMsg").value, email: $("#fbEm").value, website: $("#fbHp").value, page: location.pathname.split("/").pop() + location.search }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      m.textContent = j.message; m.style.color = "var(--hot,#e8a33d)"; $("#fbMsg").value = ""; setTimeout(() => dlg.close(), 2200);
    } catch (x) { m.textContent = x.message && x.message !== "Failed to fetch" ? x.message : "We couldn’t reach the server. Please try again shortly."; }
    go.disabled = false;
  });
})();
