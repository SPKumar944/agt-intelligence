/* Inbox of feature / dataset requests for the super admin and managers: read, reply by email, mark closed.
   AGTInbox.mount(el) — needs AGT.api (site/api.js). */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KIND = { feature: "Feature", dataset: "Dataset", city: "City", other: "Other" };
  const when = (t) => new Date(t * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  let styled = false;
  function css() {
    if (styled) return; styled = true;
    const s = document.createElement("style");
    s.textContent = `.fi{max-width:860px;margin:0 auto;padding:8px 0 60px}.fi-bar{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
    .fi-bar button{font:500 11px/1 var(--mono,monospace);letter-spacing:.05em;text-transform:uppercase;padding:9px 12px;border-radius:14px;border:1px solid var(--rule,#333);background:none;color:var(--ink-3,#999);cursor:pointer}
    .fi-bar button[aria-pressed=true]{background:var(--ink,#fff);color:var(--bg,#000);border-color:var(--ink,#fff)}
    .fi-c{border:1px solid var(--rule,#333);border-radius:8px;padding:16px 18px;margin:0 0 12px;background:color-mix(in srgb,var(--ink,#fff) 3%,var(--bg,#000))}
    .fi-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--ink-3,#999)}.fi-h b{color:var(--ink,#fff);font-weight:600}
    .fi-p{font:500 10px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border-radius:10px;border:1px solid var(--rule,#333);color:var(--ink-2,#ccc)}
    .fi-p.new{color:var(--hot,#e8a33d);border-color:var(--hot,#e8a33d)}
    .fi-m{margin:10px 0 0;white-space:pre-wrap;line-height:1.5;font-size:14px;color:var(--ink,#fff)}
    .fi-rp{margin:12px 0 0;padding:10px 12px;border-left:2px solid var(--rule,#333);font-size:13px;color:var(--ink-2,#ccc);white-space:pre-wrap}
    .fi-f{display:grid;gap:8px;margin:12px 0 0}.fi-f textarea{width:100%;box-sizing:border-box;min-height:74px;font:400 14px/1.45 inherit;font-family:inherit;color:var(--ink,#fff);background:var(--bg,#000);border:1px solid var(--rule,#333);border-radius:6px;padding:9px;resize:vertical}
    .fi-a{display:flex;gap:10px;align-items:center;justify-content:flex-end}.fi-a .t{margin-right:auto;font-size:12px;color:var(--ink-3,#999)}
    .fi-a button{font:500 11px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;padding:10px 14px;border-radius:6px;border:1px solid var(--rule,#333);background:none;color:var(--ink,#fff);cursor:pointer}
    .fi-a .go{background:var(--ink,#fff);color:var(--bg,#000);border-color:var(--ink,#fff)}.fi-a button:disabled{opacity:.5}.fi-e{padding:40px 0;text-align:center;color:var(--ink-3,#999)}`;
    document.head.appendChild(s);
  }
  function mount(el) {
    css();
    let items = [], counts = {}, filter = "new", err = "";
    const draw = () => {
      const shown = items.filter((r) => filter === "all" || r.status === filter);
      el.innerHTML = `<div class="fi"><div class="fi-bar">${[["new", "New"], ["replied", "Replied"], ["closed", "Closed"], ["all", "All"]].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}${k !== "all" ? " · " + (counts[k] || 0) : " · " + items.length}</button>`).join("")}</div>
        ${err ? `<div class="fi-e">${esc(err)}</div>` : shown.length ? shown.map((r) => `<div class="fi-c" data-id="${r.id}">
          <div class="fi-h"><span class="fi-p ${r.status}">${esc(r.status)}</span><span class="fi-p">${KIND[r.kind] || "Other"}</span><b>${r.email ? esc(r.email) : "No email left"}</b><span>${when(r.created_at)}${r.page ? " · from " + esc(r.page) : ""}</span></div>
          <div class="fi-m">${esc(r.message)}</div>
          ${r.reply ? `<div class="fi-rp"><b>${esc(r.replied_by || "Team")}</b> replied ${r.replied_at ? when(r.replied_at) : ""}:\n${esc(r.reply)}</div>` : ""}
          ${r.email ? `<div class="fi-f"><textarea placeholder="${r.reply ? "Send a further reply" : "Write a reply. It is emailed to " + esc(r.email)}" aria-label="Reply"></textarea><div class="fi-a"><span class="t"></span>${r.status !== "closed" ? '<button type="button" data-a="close">Mark closed</button>' : '<button type="button" data-a="reopen">Reopen</button>'}<button type="button" class="go" data-a="send">Send reply</button></div></div>`
            : `<div class="fi-a" style="margin-top:12px"><span class="t">No email address, so no reply is possible.</span>${r.status !== "closed" ? '<button type="button" data-a="close">Mark closed</button>' : '<button type="button" data-a="reopen">Reopen</button>'}</div>`}
        </div>`).join("") : `<div class="fi-e">No requests here yet.</div>`}</div>`;
    };
    async function load() { try { const j = await AGT.api("/api/staff/feedback"); items = j.items; counts = j.counts; err = ""; } catch (e) { err = e.message; } draw(); }
    el.addEventListener("click", async (e) => {
      const f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f; draw(); return; }
      const b = e.target.closest("[data-a]"); if (!b) return;
      const card = b.closest(".fi-c"), id = card.dataset.id, note = card.querySelector(".t"); b.disabled = true;
      try {
        if (b.dataset.a === "send") { const ta = card.querySelector("textarea"); await AGT.api(`/api/staff/feedback/${id}/reply`, { body: { text: ta.value } }); }
        else await AGT.api(`/api/staff/feedback/${id}/status`, { body: { status: b.dataset.a === "close" ? "closed" : "new" } });
        await load();
      } catch (x) { note.textContent = x.message; note.style.color = "var(--hot,#e8a33d)"; b.disabled = false; }
    });
    load();
    return { reload: load };
  }
  window.AGTInbox = { mount };
})();
