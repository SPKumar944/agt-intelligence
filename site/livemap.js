/* Interactive hexagon map on a real street map (Leaflet + CARTO / OpenStreetMap tiles).
   AGTLiveMap.create(el, D, { fill(c) -> css colour or "", tip(c) -> html, onPick(c), ring: true }) -> Promise<api>
   api: { map, paint(fillFn), highlight(pin), setBasemap(bool), setOpacity(0..1) }. Cells carry c.b = [[lat,lng]...] hexagon corners. */
(function () {
  const BASE = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  const ES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
  const TILES = { dark: ES + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", light: ES + "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" };
  const LABELS = { dark: ES + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", light: ES + "World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" };
  const ATTR = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  const dark = () => document.documentElement.dataset.theme !== "light";
  let loading = null;
  function load() {
    if (window.L && window.L.map) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BASE + "leaflet.min.css"; document.head.appendChild(l);
      const s = document.createElement("script"); s.src = BASE + "leaflet.min.js"; s.onload = res; s.onerror = () => { loading = null; rej(new Error("leaflet")); }; document.head.appendChild(s);
    });
    return loading;
  }

  async function create(el, D, o) {
    await load();
    const L = window.L, touch = L.Browser.mobile;
    el.classList.add("hexmap");
    const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, dragging: !touch, tap: false, zoomSnap: 1, minZoom: 9, maxZoom: 17, preferCanvas: false });
    map.attributionControl.setPrefix(false);
    const ctr = L.latLng(D.centre[0], D.centre[1]), ring = L.circle(ctr, { radius: D.radius_km * 1000, fill: false, weight: 1.2, dashArray: "4 6", color: dark() ? "#9a9aa0" : "#555", opacity: .75, interactive: false });
    const bnd = ctr.toBounds(D.radius_km * 2000);
    map.fitBounds(bnd, { padding: [4, 4] });
    map.setMaxBounds(bnd.pad(0.6));
    let tiles = L.tileLayer(dark() ? TILES.dark : TILES.light, { attribution: ATTR, maxNativeZoom: 16, maxZoom: 17 }).addTo(map), on = true;
    map.createPane("labels"); map.getPane("labels").style.zIndex = 450; map.getPane("labels").style.pointerEvents = "none";
    let labels = L.tileLayer(dark() ? LABELS.dark : LABELS.light, { pane: "labels", maxNativeZoom: 16, maxZoom: 17 }).addTo(map);
    ring.addTo(map);
    const polys = D.cells.map((c, i) => { const p = L.polygon(c.b, { weight: .5, color: "#000", opacity: .22, fillOpacity: 1, className: "c" }).addTo(map); p._i = i; return p; });
    L.circleMarker(ctr, { radius: 4, weight: 2, color: dark() ? "#fff" : "#111", fillColor: dark() ? "#111" : "#fff", fillOpacity: 1, interactive: false }).addTo(map);
    let hz = "", fillFn = o.fill;
    const style = () => { polys.forEach((p) => { const el2 = p.getElement(); if (!el2) return; const c = D.cells[p._i], f = fillFn(c); el2.style.fill = f || "transparent"; el2.classList.toggle("hz", !!hz && c.z === hz); }); };
    // one shared tooltip
    const tip = L.tooltip({ sticky: true, className: "hm-tip", direction: "auto", offset: [14, 14], opacity: 1 });
    polys.forEach((p) => {
      p.on("mouseover", (e) => { const h = o.tip && o.tip(D.cells[p._i]); if (!h) return; tip.setContent(h).setLatLng(e.latlng); map.openTooltip(tip); });
      p.on("mousemove", (e) => tip.setLatLng(e.latlng));
      p.on("mouseout", () => map.closeTooltip(tip));
      p.on("click", () => { if (o.onPick) o.onPick(D.cells[p._i]); });
    });
    // gestures: on touch screens the page scrolls until the map is tapped; on desktop wheel zoom switches on after the first click
    map.once("click", () => { map.dragging.enable(); map.scrollWheelZoom.enable(); });
    if (touch) el.setAttribute("data-hint", "Tap the map, then drag and pinch");
    // controls: basemap on/off and hexagon opacity
    const Ctl = L.Control.extend({ options: { position: "topright" }, onAdd() {
      const d = L.DomUtil.create("div", "hm-ctl leaflet-bar"); d.innerHTML = '<button type="button" class="hm-b" aria-pressed="true" title="Show or hide the street map">Street map</button><label class="hm-o">Hexagons<input type="range" min="25" max="100" value="80" aria-label="Hexagon opacity"></label>';
      L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
      d.querySelector("button").addEventListener("click", (e) => api.setBasemap(!on, e.currentTarget));
      d.querySelector("input").addEventListener("input", (e) => api.setOpacity(e.target.value / 100));
      return d; } });
    new Ctl().addTo(map);
    const api = {
      map, paint(f) { if (f) fillFn = f; style(); },
      highlight(pin) { hz = pin; style(); if (pin) polys.filter((p) => D.cells[p._i].z === pin).forEach((p) => p.bringToFront()); },
      setBasemap(v, btn) { on = !!v; if (on) { tiles.addTo(map); labels.addTo(map); } else { map.removeLayer(tiles); map.removeLayer(labels); } el.classList.toggle("nobase", !on); const b = btn || el.querySelector(".hm-b"); if (b) b.setAttribute("aria-pressed", on); },
      setOpacity(v) { el.style.setProperty("--hx", v); },
      resetView() { map.fitBounds(bnd, { padding: [4, 4] }); },
    };
    api.setOpacity(.8);
    new MutationObserver(() => { tiles.setUrl(dark() ? TILES.dark : TILES.light); labels.setUrl(dark() ? LABELS.dark : LABELS.light); ring.setStyle({ color: dark() ? "#9a9aa0" : "#555" }); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    let touched = false; map.on("zoomstart dragstart", () => { if (!touched && map._fit) return; touched = true; });
    map.on("click", () => { touched = true; });
    const refit = () => { map.invalidateSize(); style(); if (!touched) { map._fit = true; map.fitBounds(bnd, { padding: [4, 4], animate: false }); map._fit = false; } };
    if (window.ResizeObserver) new ResizeObserver(refit).observe(el);
    setTimeout(refit, 60); setTimeout(refit, 400);
    style(); setTimeout(style, 0); map.once("load", style);
    return api;
  }
  window.AGTLiveMap = { create };
})();
