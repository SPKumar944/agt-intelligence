/* AGT Intelligence — tiny API client. A bearer token (kept in localStorage) authenticates every call, so the website can be
 * hosted anywhere (e.g. GitHub Pages) while the server runs elsewhere. */
(function () {
  "use strict";
  const base = (window.AGT_API || "").replace(/\/$/, "");
  const KEY = "agt.token";
  const token = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } };
  async function api(path, opt = {}) {
    const h = {}, t = token();
    if (t) h.Authorization = "Bearer " + t;
    const hasBody = opt.body !== undefined;
    if (hasBody) h["Content-Type"] = "application/json";
    let r;
    try { r = await fetch(base + path, { method: opt.method || (hasBody ? "POST" : "GET"), headers: h, body: hasBody ? JSON.stringify(opt.body) : undefined, cache: "no-store" }); }
    catch (e) { const x = new Error("We couldn’t reach the server. Please check your connection and try again."); x.status = 0; throw x; }
    let j = {}; try { j = await r.json(); } catch (e) { /* empty */ }
    if (!r.ok) { const x = new Error(j.error || "Something went wrong."); x.status = r.status; x.data = j; throw x; }
    return j;
  }
  window.AGT = {
    base, token, setToken, api,
    session: () => api("/api/session").catch(() => ({ role: "none" })),
    logout: async () => { try { await api("/api/logout", { body: {} }); } catch (e) { /* already out */ } setToken(""); },
    url: (p) => base + p,
  };
})();
