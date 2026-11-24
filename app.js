/* AGT Intelligence — Site Footfall Intelligence dashboard
 * MapLibre basemap + deck.gl overlay, data from scripts/build_dashboard_data.py */
"use strict";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DRIVERS = ["office", "leisure", "retail", "resident"];
const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";   // the base map is always the light Positron style, in light and dark UI

const S = {
  bizId: null, siteId: null, hour: 21, day: 5, streetMetric: "footfall", playing: false, timer: null,
  tierOn: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  streetScope: "all", hexMode: "landuse", hexScope: "all", hexOpacity: 0.55,
  compScope: "direct", diningType: "all", kidsType: "all", eduType: "all", transitScope: "rail", poiCat: "all",
  walkType: "both", selected: null, selCandidate: null,
  on: { streets: true, stores: true, walkshed: false, rings: false, hexes: false, competitors: false, candidates: false,
        dining: false, kids: false, education: false, transit: false, techparks: false, offices: false, allpoints: false },
  openGroups: new Set(["foot"]),
};
let D = null, map = null, overlay = null, BIZ = null, REG = null, PLAN = null;
const B = () => (D && D.site.business) || {};
const DEM = () => B().demand || {};
const PROP = () => (D && (D.site.propensity || D.site.dessert_propensity)) || new Array(24).fill(1);
const UNIT = () => DEM().unit_label || "Units/day";

/* ----------------------------------------------------------------- helpers */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => (n == null || Number.isNaN(+n) ? "—" : (+n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const compact = (n) => n == null ? "—" : n >= 1e7 ? (n / 1e7).toFixed(2) + " Cr" : n >= 1e5 ? (n / 1e5).toFixed(2) + " L" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : fmt(n);
const km = (m) => m == null ? "—" : m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hh = (h) => String(h).padStart(2, "0") + ":00";
const h12 = (h) => `(${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"})`;
const isWeekend = (d) => d >= 5;
async function getJSON(url) {   // data files come from the AGT server with the signed-in user's token
  const A = window.AGT, h = A && A.token() ? { Authorization: "Bearer " + A.token() } : {};
  const r = await fetch((A ? A.base : "") + "/" + String(url).replace(/^\//, ""), { cache: "no-store", headers: h });
  if (r.status === 401) { location.replace("login.html"); throw new Error("sign in"); }
  if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json();
}
const dec = (col, i) => (col && col.dict ? col.dict[col.v[i]] : col ? col[i] : null);

function dayFactor(day, h) {          // MODELLED day-of-week modifiers on the weekday / weekend curves
  if (day === 4) return h >= 17 ? 1.2 : 1.02;          // Friday evening surge
  if (day === 6) return h >= 11 && h <= 21 ? 1.04 : 0.95; // Sunday family peak
  return [0.96, 0.97, 1.0, 1.03, 1, 1, 1][day];
}
function phaseOf(h) {
  const pk = DEM().peak_hours;
  if (pk && h >= pk[0] && h <= pk[1]) return DEM().peak_label || "Peak";
  if (h < 6) return "Night quiet";
  if (h < 10) return "Morning transit";
  if (h < 12) return "Late morning";
  if (h < 15) return "Lunch rush";
  if (h < 17) return "Afternoon lull";
  if (h < 19) return "Evening transition";
  if (h < 23) return "Evening peak";
  return "Late-night spillover";
}

/* ----------------------------------------------------------------- colour scales */
// Hexagon colours: Crameri "La Jolla" (cream → ochre → brown), from the GeoPalettes collection (dominicroye.github.io/color-for-geoscience).
// Chosen because it is a perceptually uniform, colour-blind-safe sequential map, earth-toned for population / density data, and it stays
// clear of the blue-to-red footfall street scale it is drawn under. Land use (categorical) uses samples of Crameri "Batlow".
const LANDUSE = { residential: "#CAAEAA", commercial: "#185562", mixed: "#9A915B", industrial: "#8d8d93", open_space: "#577647" };
const RAMP = ["#FFFECA", "#F8DD81", "#ECAA5D", "#CF7C48", "#9D5735", "#5B391B", "#1C1B02"];
const SUIT = [[75, "#683F20", "Prime 75–100"], [60, "#B7633F", "High 60–74"], [45, "#E79452", "Moderate 45–59"], [0, "#F6D672", "Low <45"]];
const COMP_TIER = { "Artisanal/Premium": "#7c3aed", "Mass-Premium": "#db2777", "Classic Thick Shakes": "#ea580c",
                    "Sundaes/Heritage": "#b45309", "Mass": "#0891b2", "Independent / Local": "#64748b" };
const DINING = { "Family Vegetarian Dining": "#16a34a", "Youth Casual QSR": "#ef4444", "Microbreweries & Pubs": "#9333ea",
                 "Cafés & Bakeries": "#a16207", "Street Food & Snacks": "#f97316", "Casual & Family Dining": "#0ea5e9" };
const CAT_COLORS = { food_beverage: "#0ea5e9", desserts_sweets: "#db2777", retail_shopping: "#6366f1", grocery_daily_needs: "#22c55e",
  mall_department: "#e11d48", office_corporate: "#1e40af", education: "#0284c7", healthcare: "#14b8a6", entertainment_leisure: "#f59e0b",
  parks_open_space: "#65a30d", worship: "#a855f7", hospitality: "#c026d3", finance: "#64748b", automotive: "#78716c",
  services_craft: "#94a3b8", commercial_building_zone: "#cbd5e1", other_services: "#a3a3a3", transit: "#7c3aed" };

/* ----------------------------------------------------------------- line icons (IconMCP outline set, see icons.js) */
const ICON_CAT = { food_beverage: "utensils", desserts_sweets: "cake-slice", retail_shopping: "bag", grocery_daily_needs: "basket",
  mall_department: "shopping-bags", office_corporate: "briefcase", education: "graduation-cap", healthcare: "stethoscope",
  entertainment_leisure: "cinema-ticket", parks_open_space: "tree", worship: "hindu-temple", hospitality: "bed", finance: "bank",
  automotive: "car", services_craft: "scissors", commercial_building_zone: "building", other_services: "wrench", transit: "bus" };
const ICON_SUB = {
  // competitor types — chaat / North Indian
  "Chaat & golgappa specialist": "bowl", "Sweets & snacks chain (chaat counter)": "store", "North Indian street-food QSR": "food-truck",
  "North Indian meals": "plate", "North Indian restaurant": "chef-hat", "Lassi & chai bar": "tea", "Sweets & mithai shop": "wrapped-candy",
  // competitor types — desserts
  "Ice Cream & Gelato": "ice-cream", "Bakery & Patisserie": "croissant", "Chocolate & Candy": "chocolate-bar", "Dessert Café": "cake-slice",
  "Shakes & Waffles": "milkshake", "Indian Sweets & Confectionery": "candy",
  // dining
  "Cafés & Bakeries": "takeaway-coffee", "Casual & Family Dining": "utensils", "Family Vegetarian Dining": "leaf",
  "Microbreweries & Pubs": "beer", "Street Food & Snacks": "food-truck", "Youth Casual QSR": "burger",
  // kids & family
  "Bowling Alley": "bowling-pin", "Hobby & Craft Store": "palette", "Indoor Theme Park / Arcade": "gamepad", "Kids Activity Centre": "puzzle-piece",
  "Multiplex / Cinema": "clapperboard", "Play Park": "playground", "Preschool / Daycare": "baby", "Toy Store": "teddy-bear",
  "Trampoline Park": "trampoline", "Water Park": "swimming", "Zoo / Aquarium": "paw",
  // education
  "Coaching Institute": "chalkboard", "College": "graduation-cap", "Library": "library", "Other Education": "book",
  "Pre-University College": "school", "Preschool": "baby", "School": "school", "University": "museum",
  // transit
  "Bus Station": "bus", "Bus Stop": "bus-stop", "Metro Station / Entrance": "metro", "Railway Station": "train-station", "Transit Facility": "signpost" };
const ICON_LAYER = { streets: "walking", walkshed: "steps", rings: "radar", hexes: "hexagon", stores: "store", competitors: "store",
  dining: "utensils", kids: "teddy-bear", education: "graduation-cap", transit: "metro", techparks: "office-block", offices: "briefcase",
  allpoints: "pin", candidates: "map-pin-plus" };
const ICON_GUESS = [[/chaat|golgap|pani\s?puri|snack/i, "bowl"], [/ice\s?cream|gelato|kulfi/i, "ice-cream"], [/sweet|mithai|candy/i, "wrapped-candy"],
  [/bak|cake|patisser/i, "croissant"], [/caf|coffee/i, "takeaway-coffee"], [/tea|chai|lassi|juice/i, "tea"], [/pub|brew|bar\b|beer/i, "beer"],
  [/pizza/i, "pizza"], [/burger|qsr|fast\s?food/i, "burger"], [/street\s?food|cart|truck/i, "food-truck"], [/meal|thali/i, "plate"],
  [/restaurant|dining|dhaba|kitchen/i, "utensils"], [/pg|hostel|co-?living|dorm/i, "dormitory"], [/grocery|kirana|super\s?market|mart/i, "basket"],
  [/hospital|clinic|pharm|health/i, "stethoscope"], [/school/i, "school"], [/college|univ|campus/i, "graduation-cap"], [/coach|tuition/i, "chalkboard"],
  [/metro/i, "metro"], [/rail|train/i, "train-station"], [/bus/i, "bus"], [/office|corporate|cowork/i, "briefcase"], [/tech\s?park|it\s?park/i, "office-block"],
  [/mall|shopping/i, "shopping-bags"], [/cinema|movie|theat/i, "clapperboard"], [/park|garden/i, "tree"], [/temple|church|mosque|worship/i, "hindu-temple"],
  [/hotel|lodg/i, "bed"], [/bank|atm|finance/i, "bank"], [/car|auto|fuel|petrol/i, "car"], [/salon|barber|beauty/i, "haircut"], [/apartment|residen/i, "apartment-complex"]];
function iconFor(label, fallback = "pin") {
  if (!label) return fallback;
  const over = ((B().dashboard || {}).icons || {})[label];
  if (over && ICONS[over]) return over;
  if (ICON_SUB[label]) return ICON_SUB[label];
  if (ICON_CAT[label]) return ICON_CAT[label];
  for (const [rx, n] of ICON_GUESS) if (rx.test(label) && ICONS[n]) return n;
  return fallback;
}
const layerIcon = (key) => {
  if (key.startsWith("custom_")) { const c = (B().custom_layers || []).find((x) => "custom_" + x.id === key);
    return (c && c.icon && ICONS[c.icon]) ? c.icon : iconFor(c ? c.label : "", "pin"); }
  return ((B().dashboard || {}).icons || {})[key] || ICON_LAYER[key] || "pin";
};
const INK = "#111827";                       // icons are always drawn in black lines
const iconInner = (name) => (ICONS[name] || ICONS.pin).replace(/currentColor/g, INK);
/** Inline HTML line icon (black strokes). `ring` = optional colour of a thin circle around it (category / tier cue). */
function ico(name, _colour = null, size = 16, stroke = 1.3) {   // always plain black lines (colour arg kept for call-site compatibility)
  const svg = `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${stroke}"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.pin}</svg>`;
  return svg;
}
/** Map marker: the line icon on a white badge with a thin ring in the layer colour, rasterised for deck.gl's IconLayer. */
const _badgeCache = new Map();
function badge(name, color, opts = {}) {
  const key = `${name}|${color}|${opts.strong ? 1 : 0}`;
  let b = _badgeCache.get(key);
  if (b) return b;
  const sw = opts.strong ? 1.35 : 1.2, inner = iconInner(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g transform="translate(4 4) scale(3.5)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="#ffffff" stroke-width="${sw + 1.9}" stroke-opacity="0.95">${inner.replace(new RegExp(INK, "g"), "#ffffff")}</g>
      <g stroke="${INK}" stroke-width="${sw}">${inner}</g></g></svg>`;
  b = { id: key, url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), width: 64, height: 64, anchorY: 32, mask: false };
  _badgeCache.set(key, b);
  return b;
}
/** Cluster marker: white pill with the layer's black line icon and the count, ring in the layer colour. */
function clusterBadge(name, color, count) {
  const key = `cl|${name}|${color}|${count}`;
  let b = _badgeCache.get(key);
  if (b) return b;
  const txt = count >= 1000 ? (count / 1000).toFixed(count >= 10000 ? 0 : 1) + "k" : String(count), w = 70 + txt.length * 19;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="64" viewBox="0 0 ${w} 64">
    <rect x="2.5" y="2.5" width="${w - 5}" height="59" rx="29.5" fill="#ffffff" stroke="${color}" stroke-width="5"/>
    <g transform="translate(13 13) scale(2.375)" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${iconInner(name)}</g>
    <text x="58" y="43" font-family="Inter, -apple-system, Arial, sans-serif" font-size="30" font-weight="800" fill="${INK}">${txt}</text></svg>`;
  b = { id: key, url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), width: w, height: 64, anchorY: 32, mask: false };
  _badgeCache.set(key, b);
  return b;
}
const CLUSTER_COL = { competitors: "#ea580c", dining: "#0ea5e9", kids: "#d97706", education: "#0284c7", transit: "#7c3aed",
  techparks: "#1e40af", offices: "#475569", allpoints: "#6366f1" };
const clusterColor = (id) => CLUSTER_COL[id] || ((B().custom_layers || []).find((c) => "custom_" + c.id === id) || {}).color || "#1d1d1f";
/** Supercluster index per layer (rebuilt only when the layer's filter changes); returns clusters + single points for the current zoom. */
const _clusters = new Map();
function clustered(id, items, pos, fkey) {
  let e = _clusters.get(id);
  const k = `${D.site.site_id || D.site.profile.store_name}|${fkey}|${items.length}`;
  if (!e || e.k !== k) {
    const idx = new Supercluster({ radius: 58, maxZoom: 16, minPoints: 3 });
    idx.load(items.map((d) => ({ type: "Feature", properties: { d }, geometry: { type: "Point", coordinates: pos(d) } })));
    e = { k, idx }; _clusters.set(id, e);
  }
  const z = Math.floor(map ? map.getZoom() : 14);
  return e.idx.getClusters([-180, -85, 180, 85], z).map((f) => f.properties.cluster
    ? { cluster: true, cid: f.properties.cluster_id, count: f.properties.point_count, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        rep: e.idx.getLeaves(f.properties.cluster_id, 1)[0].properties.d }
    : f.properties.d);
}
const rgbHex = (c) => "#" + c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");

const HEX_MODES = {
  landuse: { label: "Land use class", kind: "cat" },
  pop: { label: "Residents", kind: "seq", field: "pop" },
  day_pop: { label: "Daytime population", kind: "seq", field: "day_pop" },
  k: { label: "Kids 0–14", kind: "seq", field: "k" },
  y: { label: "Youth 15–24", kind: "seq", field: "y" },
  s: { label: "Seniors 60+", kind: "seq", field: "s" },
  floating: { label: "Floating adults share", kind: "seq", calc: (i) => { const p = D.hexes.pop[i]; return p ? D.hexes.floating_adults[i] / p : 0; }, pct: true },
  com_workers: { label: "Daytime workforce", kind: "seq", field: "com_workers" },
  mean_daily_footfall: { label: "Street footfall (modelled)", kind: "seq", field: "mean_daily_footfall" },
  res_idx: { label: "Residential index", kind: "idx", field: "res_idx" },
  com_idx: { label: "Commercial index", kind: "idx", field: "com_idx" },
  syn_idx: { label: "Retail synergy index", kind: "idx", field: "syn_idx" },
  suit_score: { label: "New-store suitability", kind: "suit", field: "suit_score" },
  ci_net_units: { label: "Expected net volume (interaction model)", kind: "seq", field: "ci_net_units" },
  ci_cannibal_pct: { label: "Cannibalisation of own outlets (model)", kind: "seq", field: "ci_cannibal_pct", pct: false },
};

function compColor(tier) { const tc = (B().competitors || {}).tier_colors || COMP_TIER; return tc[tier] || COMP_TIER[tier] || "#64748b"; }
function compTiers() { return (B().competitors || {}).tier_colors || COMP_TIER; }
function tierOf(v) { const T = D.site.tiers; for (const t of T) if (v >= t.min) return t.level; return 0; }
function tierColor(level) { return D.tierRGB[level]; }

/* ----------------------------------------------------------------- data prep */
function prepStreets() {
  const st = D.streets, n = st.n;
  st.paths = st.path.map((f) => { const a = []; for (let i = 0; i < f.length; i += 2) a.push([f[i], f[i + 1]]); return a; });
  st.cwd = new Float32Array(n * 24); st.cwe = new Float32Array(n * 24);
  const cw = DRIVERS.map((d) => st.curves[d].wd), ce = DRIVERS.map((d) => st.curves[d].we);
  for (let s = 0; s < n; s++) {
    const sh = st.sh[s];
    for (let h = 0; h < 24; h++) {
      let a = 0, b = 0;
      for (let g = 0; g < 4; g++) { a += sh[g] * cw[g][h]; b += sh[g] * ce[g][h]; }
      st.cwd[s * 24 + h] = a; st.cwe[s * 24 + h] = b;
    }
  }
  st.flow = new Float32Array(n); st.tier = new Uint8Array(n);
  st.walk = []; st.all = [];
  for (let s = 0; s < n; s++) { st.all.push(s); if (st.nd[s] != null && st.nd[s] <= (D.site.walkshed_m || 350)) st.walk.push(s); }
}
function segFlow(s, day, h, metric = S.streetMetric) {
  const st = D.streets, we = isWeekend(day);
  const f = (we ? st.we[s] : st.wd[s]) * (we ? st.cwe : st.cwd)[s * 24 + h] * dayFactor(day, h);
  return metric === "demand" ? f * PROP()[h] : f;
}
function computeFlows() {
  const st = D.streets;
  for (let s = 0; s < st.n; s++) { const f = segFlow(s, S.day, S.hour); st.flow[s] = f; st.tier[s] = tierOf(f); }
}
function prepHexes() {
  const hx = D.hexes;
  hx.polys = hx.poly.map((f) => { const a = []; for (let i = 0; i < f.length; i += 2) a.push([f[i], f[i + 1]]); return a; });
  hx.all = [...Array(hx.n).keys()];
  hx.band = hx.all.filter((i) => hx.in_golden_band && hx.in_golden_band[i]);
}
function prepPois() {
  const p = D.pois; p.idx = [...Array(p.n).keys()];
}
function circle(lng, lat, rMeters, steps = 128) {
  const pts = [], R = 6371008.8, la = lat * Math.PI / 180, lo = lng * Math.PI / 180, d = rMeters / R;
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * 2 * Math.PI;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    pts.push([lo2 * 180 / Math.PI, la2 * 180 / Math.PI]);
  }
  return pts;
}

/* ----------------------------------------------------------------- hex colouring */
let hexScale = null;
function hexValue(i) {
  const m = HEX_MODES[S.hexMode];
  if (m.calc) return m.calc(i);
  return D.hexes[m.field][i] ?? 0;
}
function buildHexScale() {
  const m = HEX_MODES[S.hexMode];
  if (m.kind === "seq") {
    const vals = D.hexes.all.map(hexValue).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0;
    hexScale = { breaks: [q(0.15), q(0.3), q(0.45), q(0.6), q(0.75), q(0.9)], min: vals[0] || 0, max: vals[vals.length - 1] || 0 };
  } else if (m.kind === "idx") hexScale = { breaks: [15, 30, 45, 60, 75, 90], min: 0, max: 100 };
  else hexScale = null;
}
function hexColor(i) {
  const m = HEX_MODES[S.hexMode], a = Math.round(255 * S.hexOpacity);
  if (m.kind === "cat") return [...hex2rgb(LANDUSE[dec(D.hexes.cls, i)] || "#e2e8f0"), a];
  const v = hexValue(i);
  if (m.kind === "suit") { for (const [t, c] of SUIT) if (v >= t) return [...hex2rgb(c), a]; }
  if (!v) return [238, 238, 240, Math.round(a * 0.5)];
  let k = 0; while (k < hexScale.breaks.length && v >= hexScale.breaks[k]) k++;
  return [...hex2rgb(RAMP[k]), a];
}

/* ----------------------------------------------------------------- deck layers */
function streetWidth(t) { return t >= 9 ? 5 : t >= 7 ? 3.8 : t >= 5 ? 2.8 : t >= 4 ? 1.9 : t >= 3 ? 1.2 : 0.8; }
function layers() {
  const L = [], st = D.streets, hx = D.hexes, site = D.site, [clng, clat] = site.centre;
  const trig = `${S.day}-${S.hour}`;

  if (S.on.hexes) {
    const data = S.hexScope === "band" ? hx.band : hx.all;
    L.push(new deck.PolygonLayer({
      id: "hexes", data, getPolygon: (i) => hx.polys[i], getFillColor: hexColor,
      getLineColor: [255, 255, 255, 170], lineWidthUnits: "pixels", getLineWidth: 0.5, stroked: true, filled: true,
      pickable: true, autoHighlight: true, highlightColor: [15, 23, 42, 60],
      updateTriggers: { getFillColor: [S.hexMode, S.hexOpacity] },
    }));
  }
  if (S.on.rings) {
    const [b0, b1] = site.golden_band_km;
    L.push(new deck.PathLayer({
      id: "rings", data: [
        { p: circle(clng, clat, site.radius_km * 1000), c: [43, 58, 143, 150], w: 1.6 },
        { p: circle(clng, clat, b0 * 1000), c: [15, 118, 110, 170], w: 1.4 },
        { p: circle(clng, clat, b1 * 1000), c: [15, 118, 110, 120], w: 1.2 }],
      getPath: (d) => d.p, getColor: (d) => d.c, getWidth: (d) => d.w, widthUnits: "pixels" }));
  }
  if (S.on.walkshed) {
    const feats = site.walkshed.features.filter((f) => S.walkType === "both" || f.properties.walkshed_type === S.walkType);
    L.push(new deck.GeoJsonLayer({
      id: "walkshed", data: { type: "FeatureCollection", features: feats }, stroked: true, filled: true,
      getFillColor: (f) => f.properties.walkshed_type === "radial_buffer" ? [64, 87, 214, 18] : [15, 118, 110, 30],
      getLineColor: (f) => f.properties.walkshed_type === "radial_buffer" ? [64, 87, 214, 220] : [15, 118, 110, 220],
      getLineWidth: 2, lineWidthUnits: "pixels", pickable: true }));
  }
  if (S.on.streets) {
    const base = S.streetScope === "walk" ? st.walk : st.all;
    const data = S.tierOn.size === 11 ? base : base.filter((s) => S.tierOn.has(st.tier[s]));
    L.push(new deck.PathLayer({
      id: "streets", data, getPath: (s) => st.paths[s],
      getColor: (s) => { const t = st.tier[s]; return [...tierColor(t), t >= 6 ? 240 : t >= 4 ? 215 : t >= 3 ? 150 : 70]; },
      getWidth: (s) => streetWidth(st.tier[s]), widthUnits: "pixels", widthMinPixels: 0.8, capRounded: true, jointRounded: true,
      pickable: true, autoHighlight: true, highlightColor: [15, 23, 42, 255],
      updateTriggers: { getColor: trig, getWidth: trig } }));
  }
  // point markers: IconMCP line icons on small badges. `size` is the badge diameter in pixels at street zoom (~15);
  // shrinks smoothly when zoomed out but never below a legible size.
  const zoom = map ? map.getZoom() : 14, zf = Math.max(0.55, Math.min(1.1, Math.pow(2, (zoom - 15) * 0.35)));
  // clustered: nearby markers merge into a count pill and split apart one by one as you zoom in (all separate from zoom 17)
  const ic = (id, data, icon, color, size, fkey = "", pos = (d) => [d.lng, d.lat]) => {
    const iconOf = typeof icon === "function" ? icon : () => icon, colOf = typeof color === "function" ? color : () => color;
    const sizeOf = typeof size === "function" ? size : () => size, zk = Math.floor(zoom);
    return new deck.IconLayer({
      id, data: clustered(id, data, pos, fkey), getPosition: (d) => d.cluster ? [d.lng, d.lat] : pos(d),
      getIcon: (d) => badge(iconOf(d.cluster ? d.rep : d), INK),        // a group shows just one of its icons — no count
      getSize: (d) => sizeOf(d.cluster ? d.rep : d) * zf, sizeUnits: "pixels", sizeMinPixels: 10,
      updateTriggers: { getSize: zf.toFixed(2), getIcon: zk },
      pickable: true, autoHighlight: true, highlightColor: [43, 58, 143, 70] });
  };
  const ly = D.layers;
  if (S.on.allpoints) {
    const P = D.pois, cat = S.poiCat;
    const data = (cat === "all" ? P.idx : P.idx.filter((i) => P.categories[P.cat[i]] === cat));
    L.push(ic("allpoints", data, (i) => iconFor(P.categories[P.cat[i]]), (i) => CAT_COLORS[P.categories[P.cat[i]]] || "#94a3b8", 16, cat,
      (i) => [P.lng[i], P.lat[i]]));
  }
  if (S.on.offices) L.push(ic("offices", ly.offices, "briefcase", "#475569", 16));
  if (S.on.education) L.push(ic("education", S.eduType === "all" ? ly.education : ly.education.filter((d) => d.category === S.eduType),
    (d) => iconFor(d.category, "graduation-cap"), "#0284c7", 19, S.eduType));
  if (S.on.dining) L.push(ic("dining", S.diningType === "all" ? ly.dining : ly.dining.filter((d) => d.synergy_type === S.diningType),
    (d) => iconFor(d.synergy_type, "utensils"), (d) => DINING[d.synergy_type] || "#0ea5e9", 19, S.diningType));
  if (S.on.kids) L.push(ic("kids", S.kidsType === "all" ? ly.kids : ly.kids.filter((d) => d.category === S.kidsType),
    (d) => iconFor(d.category, "teddy-bear"), "#d97706", 21, S.kidsType));
  if (S.on.transit) {
    const data = S.transitScope === "rail" ? ly.transit.filter((d) => d.transit_type !== "Bus Stop") : ly.transit;
    L.push(ic("transit", data, (d) => iconFor(d.transit_type, "bus"), (d) => d.transit_type === "Bus Stop" ? "#64748b" : "#7c3aed",
      (d) => d.transit_type === "Bus Stop" ? 15 : 24, S.transitScope));
  }
  if (S.on.techparks) L.push(ic("techparks", ly.techparks, "office-block", "#1e40af", 27));
  for (const cl of B().custom_layers || []) {
    const key = "custom_" + cl.id, data = (ly.custom || {})[key] || [];
    if (S.on[key]) L.push(ic(key, data, layerIcon(key), cl.color || "#0d9488", 19));
  }
  if (S.on.stores) {
    const others = (D.site.existing_stores || []).filter((x) => Math.abs(x.lng - clng) + Math.abs(x.lat - clat) > 0.002);
    L.push(new deck.IconLayer({ id: "stores", data: others, getPosition: (d) => [d.lng, d.lat], getIcon: () => badge("store", "#1d1d1f", { strong: true }),
      getSize: 32, sizeUnits: "pixels", pickable: true }));
    L.push(new deck.TextLayer({ id: "stores-label", data: others, getPosition: (d) => [d.lng, d.lat], getText: (d) => d.store_name.replace(/^.*?—\s*/, ""),
      getSize: 11, getColor: [29, 29, 31, 255], getPixelOffset: [0, -25], fontWeight: 700, fontFamily: "Inter, -apple-system, sans-serif",
      background: true, getBackgroundColor: [255, 255, 255, 225], backgroundPadding: [4, 2] }));
  }
  if (S.on.competitors) {
    const data = ly.competitors.filter((d) => !d.is_client_store && (S.compScope === "all" || d.is_direct_competitor));
    L.push(ic("competitors", data, (d) => iconFor(d.competitor_type, "store"), (d) => compColor(d.category_tier),
      (d) => d.category_tier === "Independent / Local" ? 21 : 26, S.compScope));
  }
  if (S.on.candidates && ly.candidates.length) {
    const sel = ly.candidates.find((c) => c.candidate_id === S.selCandidate);
    if (sel) L.push(new deck.PathLayer({ id: "cand-ring", data: [circle(sel.lng, sel.lat, 1500)], getPath: (d) => d,
      getColor: [15, 118, 110, 220], getWidth: 2, widthUnits: "pixels" }));
    L.push(new deck.IconLayer({ id: "candidates", data: ly.candidates, getPosition: (d) => [d.lng, d.lat],
      getIcon: (d) => badge("map-pin-plus", d.candidate_id === S.selCandidate ? "#1d1d1f" : "#6e6e73", { strong: true }),
      getSize: 34, sizeUnits: "pixels", pickable: true, autoHighlight: true, highlightColor: [15, 118, 110, 60],
      updateTriggers: { getIcon: S.selCandidate } }));
    L.push(new deck.TextLayer({ id: "cand-label", data: ly.candidates, getPosition: (d) => [d.lng, d.lat], getText: (d) => "#" + d.rank,
      getSize: 11, getColor: [255, 255, 255, 255], fontWeight: 700, fontFamily: "JetBrains Mono, monospace", getTextAnchor: "start",
      getAlignmentBaseline: "center", getPixelOffset: [15, -14], background: true, backgroundPadding: [4, 2],
      getBackgroundColor: (d) => d.candidate_id === S.selCandidate ? [15, 23, 42, 255] : [15, 118, 110, 255], updateTriggers: { getBackgroundColor: S.selCandidate } }));
  }
  // the study site (always on top): store for an outlet, crosshair for a prospective site; an area search shows its area instead
  const role = D.site.profile.site_role, prospective = role !== "existing";
  if (role === "area") {
    const at = D.site.profile.area_tile || {};
    if (at.area_centre) L.push(new deck.PathLayer({ id: "search-area", data: [circle(at.area_centre[1], at.area_centre[0], at.area_radius_km * 1000)], getPath: (d) => d,
      getColor: [29, 29, 31, 200], getWidth: 2, widthUnits: "pixels", getDashArray: [6, 4], dashJustified: true }));
    if (PLAN) L.push(new deck.TextLayer({ id: "plan-other", data: PLAN.picks.filter((p) => p.site_id !== S.siteId), getPosition: (d) => [d.lng, d.lat], getText: (d) => "#" + d.pick_rank,
      getSize: 12, getColor: [255, 255, 255, 255], background: true, getBackgroundColor: [110, 110, 115, 230], backgroundPadding: [4, 2], fontWeight: 700,
      fontFamily: "Inter, -apple-system, sans-serif", pickable: false }));
    return L;
  }
  L.push(new deck.IconLayer({ id: "store", data: [{ lng: clng, lat: clat }], getPosition: (d) => [d.lng, d.lat],
    getIcon: () => badge(prospective ? "crosshair" : "store", "#1d1d1f", { strong: true }), getSize: 42, sizeUnits: "pixels", pickable: true }));
  L.push(new deck.TextLayer({ id: "store-label", data: [site.centre], getPosition: (d) => d, getText: () => D.site.profile.store_name + (role === "alternatives" ? " · your site" : prospective ? " · prospective" : ""),
    getSize: 12.5, getColor: [15, 23, 42, 255], getPixelOffset: [0, -40], fontWeight: 700, fontFamily: "Inter, -apple-system, sans-serif",
    background: true, getBackgroundColor: [255, 255, 255, 235], backgroundPadding: [6, 3], getBorderColor: [29, 29, 31, 255], getBorderWidth: 1.2 }));
  return L;
}
function redraw() { if (overlay && D) overlay.setProps({ layers: layers() }); updateActiveCount(); }

/* ----------------------------------------------------------------- tooltip & inspector */
function tooltip({ object, layer, index }) {
  if (!layer || (object == null && index < 0)) return null;
  if (object && object.cluster) return { html: `<div class="tt-t">${ico(layerIcon(layer.id), null, 14, 1.5)}${fmt(object.count)} ${esc(clusterName(layer.id))} here</div><div class="tt-s">Zoom in or click to see them all</div>`, className: "deck-tooltip" };
  const st = D.streets, hx = D.hexes, P = D.pois;
  let t = "", s = "";
  switch (layer.id) {
    case "streets": { const i = object; t = st.names[st.name[i]];
      s = `${st.highways[st.hw[i]]} · ${fmt(st.flow[i])}/hr ${S.streetMetric === "demand" ? "demand-weighted " : ""}at ${hh(S.hour)} · tier ${st.tier[i]}`; break; }
    case "hexes": { const i = object; const m = HEX_MODES[S.hexMode]; const v = m.kind === "cat" ? dec(hx.cls, i) : hexValue(i);
      t = dec(hx.locality, i) || "H3 cell"; s = `${m.label}: ${m.pct ? fmt(v * 100, 1) + "%" : typeof v === "number" ? fmt(v, m.kind === "idx" || m.kind === "suit" ? 1 : 0) : v} · ${fmt(hx.pop[i])} residents`; break; }
    case "allpoints": { const i = object; t = P.name[i] || "(unnamed)"; s = `${P.categories[P.cat[i]].replace(/_/g, " ")} · ${km(P.sd[i])}`; break; }
    case "competitors": t = object.store_name; s = `${object.brand} · ${object.category_tier} · ${km(object.network_dist_m)} by road`; break;
    case "candidates": t = `#${object.rank} ${object.name}`; s = `Score ${object.overall_suitability_score} · ${fmt(object.frontage_peak_hourly)}/hr at peak · ${object.corridor_type}`; break;
    case "walkshed": t = object.properties.walkshed_type === "radial_buffer" ? "350 m radial catchment" : "350 m walk along roads";
      s = `${fmt(object.properties.resident_population)} residents · ${fmt(object.properties.businesses)} businesses`; break;
    case "stores": t = object.store_name; s = "Existing outlet"; break;
    case "store": t = D.site.profile.store_name; s = `${D.site.profile.locality} · ${D.site.profile.corridor_name}`; break;
    default: t = object.name || object.store_name || "—"; s = [object.category || object.synergy_type || object.transit_type || object.kind, km(object.straight_dist_m)].filter(Boolean).join(" · ");
  }
  const [mi, mc] = markerIcon(layer.id, object);
  return { html: `<div class="tt-t">${mi ? ico(mi, mc, 14, 1.5) : ""}${esc(t)}</div><div class="tt-s">${esc(s)}</div>`, className: "deck-tooltip" };
}
/** [icon, colour] for a picked map object, shared by tooltip and inspector. */
function markerIcon(id, o) {
  const P = D.pois;
  switch (id) {
    case "allpoints": { const c = P.categories[P.cat[o]]; return [iconFor(c), CAT_COLORS[c] || "#94a3b8"]; }
    case "competitors": return [iconFor(o.competitor_type, "store"), compColor(o.category_tier)];
    case "dining": return [iconFor(o.synergy_type, "utensils"), DINING[o.synergy_type] || "#0ea5e9"];
    case "kids": return [iconFor(o.category, "teddy-bear"), "#d97706"];
    case "education": return [iconFor(o.category, "graduation-cap"), "#0284c7"];
    case "transit": return [iconFor(o.transit_type, "bus"), o.transit_type === "Bus Stop" ? "#64748b" : "#7c3aed"];
    case "techparks": return ["office-block", "#1e40af"];
    case "offices": return ["briefcase", "#475569"];
    case "candidates": return ["map-pin-plus", "#6e6e73"];
    case "stores": return ["store", "#1d1d1f"];
    case "store": return [D.site.profile.site_role !== "existing" ? "crosshair" : "store", "#1d1d1f"];
    case "streets": return ["road", "#1d1d1f"];
    case "hexes": return ["hexagon", "#3a3a3c"];
    case "walkshed": return ["steps", "#6e6e73"];
    default:
      if (id.startsWith("custom_")) { const c = (B().custom_layers || []).find((x) => "custom_" + x.id === id); return [layerIcon(id), (c && c.color) || "#0d9488"]; }
      return [null, null];
  }
}
function grid(rows) { return `<div class="insp-grid">${rows.filter((r) => r && r[1] != null && r[1] !== "").map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join("")}</div>`; }
function spark(values, now) {
  const mx = Math.max(...values, 1);
  return `<div class="insp-spark">${values.map((v, h) => `<div class="${h === now ? "now" : ""}" style="height:${Math.max(2, (v / mx) * 100)}%" title="${hh(h)} · ${fmt(v)}/hr"></div>`).join("")}</div>`;
}
const clusterName = (id) => ({ competitors: "competitors", dining: "dining places", kids: "kids & family places", education: "schools & colleges",
  transit: "transit stops", techparks: "tech parks", offices: "office buildings", allpoints: "businesses" })[id]
  || (((B().custom_layers || []).find((c) => "custom_" + c.id === id) || {}).label || "places");
function inspect(info) {
  if (!info || !info.layer || info.object == null) return;
  if (info.object.cluster) {                                  // zoom to where this group splits apart
    const e = _clusters.get(info.layer.id), z = e ? e.idx.getClusterExpansionZoom(info.object.cid) : map.getZoom() + 2;
    map.easeTo({ center: [info.object.lng, info.object.lat], zoom: Math.min(Math.max(z, map.getZoom() + 1) + 0.1, 18), duration: 700 });
    return;
  }
  const { object: o, layer } = info, st = D.streets, hx = D.hexes, P = D.pois;
  let type = "", title = "", body = "";
  switch (layer.id) {
    case "streets": {
      const i = o, vals = [...Array(24).keys()].map((h) => segFlow(i, S.day, h));
      type = "Street segment · modelled footfall"; title = st.names[st.name[i]];
      body = grid([["Road class", st.highways[st.hw[i]]], ["Corridor tier", st.tiers[st.ct[i]]], [`Flow at ${hh(S.hour)}`, `${fmt(st.flow[i])} / hr`],
        ["Footfall tier", `${st.tier[i]} · ${D.site.tiers.find((t) => t.level === st.tier[i]).label}`], ["Weekday daily", fmt(st.wd[i])],
        ["Weekend daily", fmt(st.we[i])], ["Distance by road", km(st.nd[i])], ["Length", km(st.len[i])], ["Businesses ≤150 m", fmt(st.poi[i])],
        ["Locality", st.localities[st.loc[i]]]]) + `<div class="eyebrow" style="margin-top:10px">${DAYS[S.day]} · 24-hour profile</div>` + spark(vals, S.hour);
      break; }
    case "hexes": {
      const i = o; type = `H3 res ${hx.res} cell`; title = `${dec(hx.locality, i) || "Cell"} · ${dec(hx.ward, i) || ""}`;
      body = grid([["Land use", dec(hx.cls, i)], ["Residents", fmt(hx.pop[i])], ["Daytime pop", fmt(hx.day_pop[i])], ["Registered voters", fmt(hx.voters_registered[i])],
        ["Floating adults", fmt(hx.floating_adults[i])], ["IT intensity", fmt((hx.it_intensity[i] || 0) * 100) + "%"], ["Kids 0–14", fmt(hx.k[i])],
        ["Youth 15–24", fmt(hx.y[i])], ["Working 25–59", fmt(hx.w[i])], ["Seniors 60+", fmt(hx.s[i])], ["Workforce", fmt(hx.com_workers[i])],
        ["Office floor", fmt(hx.off_m2[i]) + " m²"], ["Res / Com / Syn idx", `${fmt(hx.res_idx[i], 0)} / ${fmt(hx.com_idx[i], 0)} / ${fmt(hx.syn_idx[i], 0)}`],
        ["Suitability", `${fmt(hx.suit_score[i], 1)} · ${(SUIT.find(([t]) => hx.suit_score[i] >= t) || SUIT[3])[2].replace(/ [\d<–-].*$/, "")}`], ["Dist. to store", fmt(hx.dist_km[i], 2) + " km"],
        ["Golden band", hx.in_golden_band[i] ? "Yes — eligible" : "No"], ["Competitors ≤1.5 km", fmt(hx.comp_count[i])], ["Dining ≤1.5 km", fmt(hx.dining_count[i])],
        ["Target demand ≤1.5 km", fmt(hx.target_demand_15k && hx.target_demand_15k[i])], ["Floating adults ≤1.5 km", fmt(hx.floating_15k && hx.floating_15k[i])],
        ...(B().custom_layers || []).map((c) => [`${c.label} ≤1.5 km`, fmt((hx[`custom_${c.id}_count`] || [])[i])]),
        ["Tech parks ≤1.5 km", fmt((hx.techparks_count || [])[i])], [`Projected ${UNIT().toLowerCase()}`, fmt((hx.proj_units || hx.proj_cups || [])[i])], ["Projected ₹ L/month", fmt(hx.proj_rev[i], 2)]]);
      break; }
    case "allpoints": { const i = o; type = P.categories[P.cat[i]].replace(/_/g, " "); title = P.name[i] || "(unnamed)";
      body = grid([["Type", P.sub[i]], ["Straight", km(P.sd[i])], ["By road", km(P.nd[i])], ["Direction", P.dir[i]], ["Faces", P.street[i]],
        ["Street footfall/day", fmt(P.ff[i])], ["Locality", P.localities[P.loc[i]]], ["Phone", P.phone[i]], ["Website", P.web[i]], ["Source", P.src[i]], ["ID", P.id[i]]]); break; }
    case "competitors": type = "Competitor"; title = o.store_name;
      body = grid([["Brand", o.brand], ["Positioning", o.category_tier], ["Type", o.competitor_type], ["Direct", o.is_direct_competitor ? "Yes" : "No"],
        ["By road", km(o.network_dist_m)], ["Direction", o.direction], ["Faces", o.frontage_street], ["Locality", o.locality], ["Phone", o.phone], ["Website", o.website],
        ["Google rating", o.google_rating], ["Reviews", o.google_review_count], ["ID", o.store_id]]); break;
    case "candidates": selectCandidate(o.candidate_id, false); type = `Expansion candidate #${o.rank}`; title = o.name; body = candidateGrid(o); break;
    case "stores": type = "Existing outlet"; title = o.store_name; body = grid([["Serial", o.serial_no], ["Lat, Lng", `${o.lat.toFixed(5)}, ${o.lng.toFixed(5)}`]]); break;
    case "store": { const p = D.site.profile; type = p.site_role === "alternatives" ? "Your site" : p.site_role !== "existing" ? "Prospective site" : "Client store"; title = p.store_name;
      body = grid([["Serial", p.serial_no], ["Locality", p.locality], ["Ward", p.ward], ["Zone", p.zone], ["Corridor", p.corridor_name], ["Corridor tier", p.corridor_tier],
        ["Address", p.address], ["Phone", p.phone], ["Plus code", p.plus_code], ["Google rating", p.google_rating ?? "not fetched"]]); break; }
    case "walkshed": { const q = o.properties; type = "Catchment"; title = q.walkshed_type === "radial_buffer" ? "350 m radial catchment" : "350 m walk along roads";
      body = grid([["Area", fmt(q.area_m2 / 1e4, 1) + " ha"], ["Residents", fmt(q.resident_population)], ["Businesses", fmt(q.businesses)], ["Food & beverage", fmt(q.food_beverage)],
        ["Competitors", fmt(q.competitors)], ["Direct competitors", fmt(q.direct_competitors)], ["Street segments", fmt(q.street_segments)], ["Weekday footfall", fmt(q.daily_footfall)],
        ["Weekend footfall", fmt(q.weekend_daily_footfall)], ["Peak evening /hr", fmt(q.peak_evening_hourly_flow)]]); break; }
    default: type = layer.id; title = o.name || o.store_name || "—";
      body = grid(Object.entries(o).filter(([k]) => !["lat", "lng"].includes(k)).map(([k, v]) => [k.replace(/_/g, " "), typeof v === "number" ? fmt(v, 1) : v]));
  }
  const [mi, mc] = markerIcon(layer.id, o);
  $("inspectorBody").innerHTML = `<div class="insp-type">${mi ? ico(mi, mc, 14, 1.5) : ""}${esc(type)}</div><div class="insp-title">${esc(title)}</div>${body}`;
  $("inspector").classList.remove("hidden");
}
function candidateGrid(o) {
  return grid([["Persona", o.corridor_type], ["Shop front", `${o.frontage_street || o.corridor} (${o.frontage_road_type || "road"})`],
    [`Peak footfall ${o.peak_window || ""}`, `${fmt(o.frontage_peak_hourly)}/hr` + (["alternatives", "area"].includes(D.site.profile.site_role) ? "" : ` · #${o.peak_footfall_rank} of 10`)], ["Daily footfall", fmt(o.frontage_daily_footfall)], ["Corridor", o.corridor], ["Suitability", `${o.overall_suitability_score} · ${o.suitability_tier}`],
    ["Nearest store", `${o.min_distance_km} km`], ["Analog benchmark", o.analog_benchmark], ["Cannibalisation of own outlets", o.cannibalization_risk_pct + "%"],
    ...(o.ci_rev_lakhs != null ? [["Revenue range ₹ L/month (P10–P90)", `${fmt(o.ci_rev_p10, 1)} – ${fmt(o.ci_rev_p90, 1)}`], ["Share of nearby demand captured", fmt(o.ci_capture_pct, 1) + "%"], ["Beats a typical site", fmt(o.ci_p_beat_typical) + "% of scenarios"]] : []),
    [`Projected ${UNIT().toLowerCase()}`, fmt(o.projected_daily_units)], ["Target demand ≤1.5 km", fmt(o.target_demand_15k)], ["Customers/month", fmt(o.projected_monthly_customers)], ["Revenue ₹ L/month", fmt(o.projected_monthly_revenue_lakhs, 2)],
    ["Payback", o.est_payback_months + " months"], ["Residents ≤1.5 km", fmt(o.walkshed_pop_15k)], ["Kids ≤1.5 km", fmt(o.kids_cohort_15k)],
    ["Youth ≤1.5 km", fmt(o.youth_cohort_15k)], ["Workforce ≤1.5 km", fmt(o.workforce_15k)], ["Competitors ≤1.5 km", fmt(o.competitor_count_15k)],
    ["Floating adults ≤1.5 km", fmt(o.floating_15k)], ["All competitors ≤1.5 km", fmt(o.all_competitors_15k)],
    ["Tech parks ≤1.5 km", fmt(o.techparks_15k)], ["Stations ≤1.5 km", fmt(o.transit_rail_15k)],
    ...(B().custom_layers || []).map((c) => [`${c.label} ≤1.5 km`, fmt(o[`custom_${c.id}_15k`])]), ["Ward", o.ward]]);
}

/* ----------------------------------------------------------------- site panel */
function renderSite() {
  const s = D.site, p = s.profile, pop = s.population, rf = p.regional_footfall || {}, ly = D.layers;
  $("storeName").textContent = p.store_name;
  const direct = ly.competitors.filter((c) => c.is_direct_competitor && !c.is_client_store);
  const direct15 = direct.filter((c) => (c.network_dist_m ?? 1e9) <= 1500).length;
  const businesses = Object.entries(s.poi_counts).reduce((a, [, v]) => a + v, 0);
  const pyr = [["60+", pop.ms, pop.fs], ["25–59", pop.mw, pop.fw], ["15–24", pop.my, pop.fy], ["0–14", pop.mk, pop.fk]];
  const pmax = Math.max(...pyr.flat().filter((x) => typeof x === "number"));
  const children = pop.pop - (pop.voters_registered ? Math.round(pop.voters_registered / (s.provenance.roll_completeness || 1)) : 0) - (pop.floating_adults || 0);
  const comp = pop.voters_registered ? [
    ["Registered voters", pop.voters_registered, "#1d1d1f"],
    ["Roll-coverage gap", Math.round(pop.voters_registered / (s.provenance.roll_completeness || 1)) - pop.voters_registered, "#6f7fd6"],
    ["Floating adults", pop.floating_adults, "#f4b740"], ["Children 0–17", Math.max(0, children), "#e2739a"]] : [];
  const vb = s.voters_by_band || {}, vbmax = Math.max(1, ...Object.values(vb));
  const mix = Object.entries(s.poi_counts).sort((a, b) => b[1] - a[1]).slice(0, 10), mixmax = mix.length ? mix[0][1] : 1;

  $("sitePanel").innerHTML = `
    <div class="store-card">
      <div class="eyebrow">${p.site_role === "area" ? "SEARCH AREA · " + esc(String(s.radius_km)) + " KM RADIUS" : esc(p.serial_no) + " · " + esc(p.zone || "") + " ZONE"} ${p.site_role === "area" ? '<span class="pass" style="background:var(--soft);color:var(--text-2)">SEARCH AREA</span>' : p.site_role !== "existing" ? '<span class="pass" style="background:var(--soft);color:var(--text-2)">PROSPECTIVE SITE</span>' : '<span class="pass">EXISTING OUTLET</span>'}</div>
      <div class="note" style="margin-top:4px">${esc(B().format || "")}</div>
      <div class="store-meta">
        ${p.site_role === "area" ? `<div style="grid-column:1/3">Search area<b>${esc(p.store_name)} · ${esc(String(s.radius_km))} km around this point</b></div>
        <div>Map cells<b>${fmt(D.hexes.n)}</b></div><div>Streets analysed<b>${fmt(D.streets.n)}</b></div>` : `
        <div>Locality<b>${esc(p.locality)}</b></div><div>Ward<b>${esc(p.ward)}</b></div>
        <div>Faces<b>${esc(p.corridor_name)}</b></div><div>Corridor<b>${esc((p.corridor_tier || "").replace("Designated ", ""))}</b></div>
        <div style="grid-column:1/3">Address<b>${esc(p.address || "—")}</b></div>`}
      </div>
    </div>
    ${p.site_assessment ? siteAssessment(p.site_assessment, p.site_role) : ""}
    <div class="kpi-grid">
      <div class="kpi"><div class="eyebrow">Residents · ${s.radius_km} km</div><div class="v">${compact(pop.pop)}</div><div class="s">${fmt(pop.pop / (Math.PI * s.radius_km ** 2))} per km²</div></div>
      <div class="kpi"><div class="eyebrow">Daytime population</div><div class="v">${compact(pop.day_pop)}</div><div class="s">residents − commuters + workers</div></div>
      ${p.site_role === "area" ? `
      <div class="kpi"><div class="eyebrow">Streets analysed</div><div class="v">${compact(D.streets.n)}</div><div class="s">footfall modelled for every hour</div></div>
      <div class="kpi"><div class="eyebrow">Suggested locations</div><div class="v">${fmt(ly.candidates.length)}</div><div class="s">busiest shop fronts, spread out</div></div>
      <div class="kpi"><div class="eyebrow">Direct competitors</div><div class="v">${fmt(direct.length)}</div><div class="s">in the whole area</div></div>
      <div class="kpi"><div class="eyebrow">Businesses mapped</div><div class="v">${compact(businesses)}</div><div class="s">in the whole area</div></div>` : `
      <div class="kpi"><div class="eyebrow">Walkshed footfall<span class="tag">MODEL</span></div><div class="v">${compact(rf.weekday_daily_footfall)}</div><div class="s">per street / weekday</div></div>
      <div class="kpi"><div class="eyebrow">Weekend surge<span class="tag">MODEL</span></div><div class="v">+${fmt(rf.weekend_surge_pct, 1)}%</div><div class="s">peak eve ${fmt(rf.peak_evening_hourly_flow)}/hr</div></div>
      <div class="kpi"><div class="eyebrow">Direct competitors</div><div class="v">${fmt(direct.length)}</div><div class="s">${direct15} within 1.5 km by road</div></div>
      <div class="kpi"><div class="eyebrow">Businesses mapped</div><div class="v">${compact(businesses)}</div><div class="s">F&amp;B share ${fmt(rf.f_and_b_share_pct, 1)}% in walkshed</div></div>`}
    </div>
    <div class="section"><div class="section-title"><h4>Population pyramid</h4><span>male · female</span></div>
      <div class="pyramid">${pyr.map(([l, m, f]) => `
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span class="pyr-val m">${compact(m)}</span><div class="pyr-bar m" style="width:${(m / pmax) * 100}%"></div></div>
        <div class="pyr-label">${l}</div>
        <div style="display:flex;align-items:center;gap:6px"><div class="pyr-bar f" style="width:${(f / pmax) * 100}%"></div><span class="pyr-val">${compact(f)}</span></div>`).join("")}
      </div></div>
    ${comp.length ? `<div class="section"><div class="section-title"><h4>How residents are counted</h4><span>${compact(pop.pop)} total</span></div>
      <div class="stack">${comp.map(([, v, c]) => `<div style="width:${(v / pop.pop) * 100}%;background:${c}"></div>`).join("")}</div>
      <div class="stack-legend">${comp.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} ${compact(v)}</span>`).join("")}</div>
      <div class="note">Voter roll holds ~${Math.round((s.provenance.roll_completeness || 1) * 100)}% of the official electorate; floating adults rise in IT-hub cells; children are not on the roll and are modelled.</div></div>` : ""}
    ${Object.keys(vb).length ? `<div class="section"><div class="section-title"><h4>Registered voters by age</h4><span>from electoral roll</span></div>
      ${Object.entries(vb).map(([b, v]) => `<div class="hbar"><span class="lbl">${b.replace("_", "–").replace("60p", "60+")} yrs</span><div class="track"><div class="fill" style="width:${(v / vbmax) * 100}%"></div></div><span class="num">${compact(v)}</span></div>`).join("")}</div>` : ""}
    <div class="section"><div class="section-title"><h4>Top corridors near the store</h4><span>modelled peak / hr</span></div>
      <div class="list">${ly.corridors.slice(0, 8).map((c) => `<div class="list-row" data-corridor="${esc(c.street_name)}">
        <div><div class="t">${ico("road", tierHex(c.peak_hourly_footfall), 14, 1.5)}${esc(c.street_name)}</div><div class="st">${esc(c.corridor_tier)} · ${km(c.closest_network_dist_m)} away</div></div>
        <div class="r">${fmt(c.peak_hourly_footfall)}<small>${compact(c.daily_footfall)}/day</small></div></div>`).join("")}</div></div>
    <div class="section"><div class="section-title"><h4>Nearest direct competitors</h4><span>${esc((B().competitors || {}).label || "")}</span></div>
      <div class="list">${direct.slice().sort((a, b) => (a.network_dist_m ?? 1e9) - (b.network_dist_m ?? 1e9)).slice(0, 8).map((c) => `<div class="list-row" data-lng="${c.lng}" data-lat="${c.lat}">
        <div><div class="t">${ico(iconFor(c.competitor_type, "store"), compColor(c.category_tier), 14, 1.5)}${esc(c.store_name)}</div><div class="st">${esc(c.competitor_type || c.brand)} · ${esc(c.category_tier)}</div></div>
        <div class="r">${km(c.network_dist_m)}<small>${esc(c.direction || "")}</small></div></div>`).join("")}</div></div>
    <div class="section"><div class="section-title"><h4>Business mix · ${s.radius_km} km</h4><span>${fmt(businesses)} points</span></div>
      ${mix.map(([k, v]) => `<div class="hbar"><span class="lbl">${ico(iconFor(k), CAT_COLORS[k] || "#6366f1", 13, 1.5)}${k.replace(/_/g, " ")}</span><div class="track"><div class="fill" style="width:${(v / mixmax) * 100}%;background:${CAT_COLORS[k] || "#6366f1"}"></div></div><span class="num">${compact(v)}</span></div>`).join("")}</div>
    <div class="note">Sources: OpenStreetMap, Overture Maps, ${pop.voters_registered ? "electoral-roll booth aggregates" : "WorldPop / Meta HRSL population"}, Overture buildings. Footfall, workforce and projections are modelled. Open “Data &amp; method” for details.</div>`;
  $("sitePanel").querySelectorAll("[data-corridor]").forEach((el) => el.onclick = () => flyToCorridor(el.dataset.corridor));
  $("sitePanel").querySelectorAll("[data-lng]").forEach((el) => el.onclick = () => map.flyTo({ center: [+el.dataset.lng, +el.dataset.lat], zoom: 17 }));
}
function siteAssessment(a, role) {
  const col = a.suit_score >= 75 ? "#047857" : a.suit_score >= 60 ? "#10b981" : a.suit_score >= 45 ? "#d97706" : "#64748b";
  return `<div class="section" style="margin-top:12px"><div class="section-title"><h4>${role !== "existing" ? "Site assessment" : "Outlet location benchmark"}</h4>
      <span>top ${fmt(100 - a.percentile_in_area, 0)}% of ${fmt(a.cells_in_area)} cells</span></div>
    <div class="cand" style="cursor:default"><div class="cand-head"><div class="rank" style="background:${col}">${Math.round(a.suit_score)}</div>
      <div><div class="cand-name">${esc(a.tier)}</div><div class="cand-persona">rank ${fmt(a.rank_in_area)} / ${fmt(a.cells_in_area)} · ${a.nearest_other_outlet_km != null ? `${a.nearest_other_outlet_km} km to ${esc((a.nearest_other_outlet || "").replace(/^.*?—\s*/, ""))}` : "no other outlet"}</div></div>
      <div class="score" style="color:${col}">${fmt(a.suit_score, 1)}<small>/ 100</small></div></div>
      <div class="cand-bars">${[["DEMO", a.demographic_score], ["COMM", a.commercial_score], ["SYN", a.synergy_score], ["WHITE", a.white_space_score]].map(([l, v]) =>
        `<div class="cbar"><div class="l">${l} ${fmt(v, 0)}</div><div class="tr"><div style="width:${v}%;background:${col}"></div></div></div>`).join("")}</div>
      <div class="cand-stats"><div>${esc(UNIT())}<b>${fmt(a.projected_daily_units)}</b></div><div>₹ L/mo<b>${fmt(a.projected_monthly_revenue_lakhs, 1)}</b></div>
        <div>Direct comp.<b>${fmt(a.direct_competitors_15k)}</b></div><div>Floating ≤1.5k<b>${compact(a.floating_15k)}</b></div></div></div></div>`;
}
function tierHex(v) { const l = tierOf(v); const t = D.site.tiers.find((x) => x.level === l); return t ? t.color : "#94a3b8"; }
function flyToCorridor(name) {
  const st = D.streets, idx = st.names.indexOf(name); if (idx < 0) return;
  let b = [180, 90, -180, -90];
  for (let s = 0; s < st.n; s++) if (st.name[s] === idx && (st.nd[s] ?? 1e9) < 3000)
    for (const [x, y] of st.paths[s]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  if (b[0] < 180) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 160, maxZoom: 16.5 });
}

/* ----------------------------------------------------------------- layers panel */
function lbl(key, dflt) { return ((B().dashboard || {}).layer_labels || {})[key] || dflt; }
function layerCard(key, name, desc, swatch, sub = "") {
  const grad = swatch.startsWith("linear"), col = grad ? "#1d1d1f" : swatch;
  return `<div class="layer ${S.on[key] ? "on" : ""}" data-layer="${key}">
    <label class="layer-head"><input type="checkbox" ${S.on[key] ? "checked" : ""} data-toggle="${key}" />
      <div><div class="layer-name">${name}</div><div class="layer-desc">${desc}</div></div>
      <div class="layer-icon">${ico(layerIcon(key), null, 18, 1.4)}
        ${grad ? `<i style="background:${swatch}"></i>` : ""}</div></label>
    ${sub ? `<div class="layer-sub">${sub}</div>` : ""}</div>`;
}
const LGROUPS = {
  foot: ["Footfall & catchment", ["streets", "walkshed", "rings"]],
  mesh: ["Demand mesh", ["hexes"]],
  comp: ["Competition & synergy", null],
  exp: ["Expansion", ["candidates"]],
};
function groupOf(key) { for (const [g, [, keys]] of Object.entries(LGROUPS)) if (keys && keys.includes(key)) return g; return "comp"; }
function lgroup(id, title, body, keys) {
  return `<details class="lgroup" data-g="${id}" ${S.openGroups.has(id) ? "open" : ""}><summary><span>${title}</span><em data-gcount="${id}"></em></summary><div class="lgroup-body">${body}</div></details>`;
}
function updateGroupCounts() {
  document.querySelectorAll("[data-gcount]").forEach((el) => {
    const g = el.dataset.gcount, root = el.closest(".lgroup");
    const n = root.querySelectorAll(".layer.on").length, tot = root.querySelectorAll(".layer").length;
    el.textContent = n ? `${n} of ${tot} on` : `${tot} layer${tot === 1 ? "" : "s"}`; el.classList.toggle("on", n > 0);
  });
}
function iconKey(items, color = "#334155") {
  return `<div class="icon-key">${items.map(([i, l, c]) => `<span>${ico(i, c || color, 14, 1.4)}${esc(l)}</span>`).join("")}</div>`;
}
function seg(group, options, current, cls = "") {
  return `<div class="seg" data-seg="${group}">${options.map(([v, l]) => `<button class="${cls} ${v === current ? "active" : ""}" data-v="${v}">${l}</button>`).join("")}</div>`;
}
function select(group, options, current) {
  return `<select class="mini-select" data-select="${group}">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
}
function countBy(arr, key) { const m = {}; arr.forEach((d) => { m[d[key]] = (m[d[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }
function renderLayersPanel() {
  const ly = D.layers, st = D.streets, tiers = D.site.tiers;
  const ramp = `linear-gradient(90deg, ${tiers.slice().reverse().map((t) => t.color).join(",")})`;
  const P = D.pois, catCounts = {}; P.cat.forEach((c) => { catCounts[P.categories[c]] = (catCounts[P.categories[c]] || 0) + 1; });
  const direct = ly.competitors.filter((c) => c.is_direct_competitor && !c.is_client_store).length;
  const T = (s) => s;
  $("layersTab").innerHTML = `
    <div class="layers-intro">Choose what to show on the map. Open a group, then switch layers on as you need them.</div>
    <details class="lgroup" data-g="foot" ${S.openGroups.has("foot") ? "open" : ""}><summary><span>Footfall &amp; catchment</span><em data-gcount="foot"></em></summary><div class="lgroup-body">
    ${layerCard("streets", "Street footfall flow", `${fmt(st.n)} OSM road segments · 11-step index · live by hour`, ramp,
      `<div class="sub-label">Metric</div>${seg("streetMetric", [["footfall", "Footfall"], ["demand", `Business demand (× ${esc((DEM().propensity_label || "propensity").toLowerCase())})`]], S.streetMetric)}
       <div class="sub-label">Road scope</div>${seg("streetScope", [["all", `All roads (${fmt(st.n)})`], ["walk", `${D.site.walkshed_m || 350} m walkshed (${st.walk.length})`]], S.streetScope)}
       <div class="note">Click tiers in the legend to filter. Footfall is modelled from road class, nearby businesses, transit and residents.</div>`)}
    ${layerCard("walkshed", `${D.site.walkshed_m || 350} m store catchment`, "Radial buffer and along-road walking polygon", "#3a3a3c",
      seg("walkType", [["both", "Both"], ["radial_buffer", "Radial"], ["road_network_walk", "Along roads"]], S.walkType))}
    ${layerCard("rings", "Study rings", `${D.site.radius_km} km study area · ${D.site.golden_band_km.join("–")} km golden band`, "#6e6e73")}
    </div></details>
    <details class="lgroup" data-g="mesh" ${S.openGroups.has("mesh") ? "open" : ""}><summary><span>Demand mesh · H3 res ${D.hexes.res}</span><em data-gcount="mesh"></em></summary><div class="lgroup-body">
    ${layerCard("hexes", `Hexagon mesh (${fmt(D.hexes.n)})`, "Population, land use, indices and suitability per cell", "linear-gradient(90deg,#FFFECA,#E79452,#683F20)",
      `<div class="sub-label">Metric</div>${select("hexMode", Object.entries(HEX_MODES).map(([k, m]) => [k, m.label]), S.hexMode)}
       <div class="sub-label">Spatial scope</div>${seg("hexScope", [["all", `All cells (${fmt(D.hexes.n)})`], ["band", `Golden band (${fmt(D.hexes.band.length)})`]], S.hexScope, "green")}
       <div class="sub-label">Opacity</div><input type="range" min="15" max="90" value="${Math.round(S.hexOpacity * 100)}" data-range="hexOpacity" style="width:100%;accent-color:var(--text)">`)}
    </div></details>
    <details class="lgroup" data-g="comp" ${S.openGroups.has("comp") ? "open" : ""}><summary><span>Competition, anchors &amp; places</span><em data-gcount="comp"></em></summary><div class="lgroup-body">
    ${layerCard("stores", `${esc(B().brand || "Client")} outlets (${(D.site.existing_stores || []).length})`, "Existing outlets of the business", "#1d1d1f")}
    ${(B().custom_layers || []).map((c) => layerCard("custom_" + c.id, `${esc(c.label)} (${fmt(((ly.custom || {})["custom_" + c.id] || []).length)})`,
      esc(c.description || "Profile-defined layer"), c.color || "#0d9488")).join("")}
    ${layerCard("competitors", `${esc((B().competitors || {}).label || "Competitors")} (${direct})`, "Direct competitors by brand tier", `linear-gradient(90deg,${Object.values(compTiers()).join(",")})`,
      seg("compScope", [["direct", `Direct (${direct})`], ["all", `Direct + indirect (${ly.competitors.filter((c) => !c.is_client_store).length})`]], S.compScope) +
      `<div class="sub-label">Icon = type</div>${iconKey(countBy(ly.competitors.filter((c) => !c.is_client_store && (S.compScope === "all" || c.is_direct_competitor)), "competitor_type").map(([k]) => [iconFor(k, "store"), k]), "#334155")}`)}
    ${layerCard("dining", `${esc(lbl("dining", "Complementary dining"))} (${fmt(ly.dining.length)})`, "Restaurants & cafés by dining type", "#0ea5e9",
      select("diningType", [["all", "All dining types"], ...countBy(ly.dining, "synergy_type").map(([k, v]) => [k, `${k} (${v})`])], S.diningType) +
      iconKey(countBy(ly.dining, "synergy_type").map(([k]) => [iconFor(k, "utensils"), k, DINING[k]])))}
    ${layerCard("kids", `Kids & family magnets (${fmt(ly.kids.length)})`, "Play zones, cinemas, preschools, toy stores", "#f59e0b",
      select("kidsType", [["all", "All categories"], ...countBy(ly.kids, "category").map(([k, v]) => [k, `${k} (${v})`])], S.kidsType) +
      iconKey(countBy(ly.kids, "category").map(([k]) => [iconFor(k, "teddy-bear"), k]), "#d97706"))}
    ${layerCard("education", `${esc(lbl("education", "Schools, colleges & coaching"))} (${fmt(ly.education.length)})`, "Student footfall and exit windows", "#0284c7",
      select("eduType", [["all", "All institutions"], ...countBy(ly.education, "category").map(([k, v]) => [k, `${k} (${v})`])], S.eduType) +
      iconKey(countBy(ly.education, "category").map(([k]) => [iconFor(k, "graduation-cap"), k]), "#0284c7"))}
    ${layerCard("transit", `Transit (${fmt(ly.transit.length)})`, "Metro, rail and bus", "#7c3aed",
      seg("transitScope", [["rail", "Metro, rail & bus stations"], ["all", "+ bus stops"]], S.transitScope) +
      iconKey(countBy(ly.transit, "transit_type").map(([k]) => [iconFor(k, "bus"), k, k === "Bus Stop" ? "#64748b" : "#7c3aed"])))}
    ${layerCard("techparks", `Tech parks & campuses (${ly.techparks.length})`, "Corporate daytime demand", "#1e40af")}
    ${layerCard("offices", `Office buildings (${fmt(ly.offices.length)})`, "Office footprints from Overture buildings", "#475569")}
    ${layerCard("allpoints", `All businesses (${fmt(P.n)})`, "Every OSM + Overture point in the study area", "#6366f1",
      select("poiCat", [["all", "All categories"], ...Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, `${k.replace(/_/g, " ")} (${fmt(v)})`])], S.poiCat) +
      iconKey(Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k]) => [iconFor(k), k.replace(/_/g, " "), CAT_COLORS[k]])))}
    </div></details>
    <details class="lgroup" data-g="exp" ${S.openGroups.has("exp") ? "open" : ""}><summary><span>Expansion</span><em data-gcount="exp"></em></summary><div class="lgroup-body">
    ${layerCard("candidates", `Expansion candidates (${ly.candidates.length})`, "Top-10 peak-footfall shop fronts in the golden band, ranked by area score", "#6e6e73")}</div></details>`;
  updateGroupCounts();
  bindLayerControls($("layersTab"));
}
function bindLayerControls(root) {
  root.querySelectorAll("[data-toggle]").forEach((el) => el.onchange = () => {
    S.on[el.dataset.toggle] = el.checked; el.closest(".layer").classList.toggle("on", el.checked); redraw(); renderHexLegend(); updateGroupCounts();
  });
  root.querySelectorAll("details.lgroup").forEach((d) => d.addEventListener("toggle", () => { d.open ? S.openGroups.add(d.dataset.g) : S.openGroups.delete(d.dataset.g); }));
  root.querySelectorAll("[data-seg]").forEach((g) => g.querySelectorAll("button").forEach((b) => b.onclick = (e) => {
    e.preventDefault(); S[g.dataset.seg] = b.dataset.v; g.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b)); redraw();
    if (g.dataset.seg === "compScope") renderLayersPanel();
  }));
  root.querySelectorAll("[data-select]").forEach((el) => el.onchange = () => {
    S[el.dataset.select] = el.value; if (el.dataset.select === "hexMode") { buildHexScale(); renderHexLegend(); } redraw();
  });
  root.querySelectorAll("[data-range]").forEach((el) => el.oninput = () => { S[el.dataset.range] = el.value / 100; redraw(); });
}
function updateActiveCount() { $("activeCount").textContent = Object.values(S.on).filter(Boolean).length; }

/* ----------------------------------------------------------------- expansion tab */
/* score colours: red (weak) → amber → green (strong); each bar's gradient is stretched over the full track, so the colour at its tip shows the value */
const SCORE_STOPS = [[0, [214, 69, 65]], [40, [240, 150, 40]], [62, [196, 190, 50]], [80, [88, 168, 84]], [100, [28, 128, 88]]];
function scoreColor(v) {
  v = Math.max(0, Math.min(100, v)); let k = 0; while (k < SCORE_STOPS.length - 2 && v > SCORE_STOPS[k + 1][0]) k++;
  const [a, ca] = SCORE_STOPS[k], [b, cb] = SCORE_STOPS[k + 1], t = (v - a) / (b - a);
  return `rgb(${ca.map((x, i) => Math.round(x + (cb[i] - x) * t)).join(",")})`;
}
function scoreGradient(v) {
  const stops = SCORE_STOPS.map(([p, c]) => `rgb(${c.join(",")}) ${p}%`).join(",");
  return `linear-gradient(90deg,${stops})`.replace(/\)$/, ")") + `;background-size:${(10000 / Math.max(v, 8)).toFixed(0)}% 100%;background-repeat:no-repeat`;
}

/* ----------------------------------------------------------------- model weights (super admin + manager only) */
const WKEYS = [["demographic", "Demographic demand", "demographic_score"], ["commercial", "Commercial activity", "commercial_score"], ["synergy", "Co-tenant synergy", "synergy_score"], ["white_space", "White space", "white_space_score"]];
const WSTATE = { level: "client", canEdit: false, base: null, saved: null };
function applyWeights(w) {
  const tot = WKEYS.reduce((a, [k]) => a + (w[k] || 0), 0) || 1, n = {};
  WKEYS.forEach(([k]) => { n[k] = (w[k] || 0) / tot; });
  const hx = D.hexes;
  for (let i = 0; i < hx.n; i++) hx.suit_score[i] = Math.round(WKEYS.reduce((a, [k, , f]) => a + n[k] * (hx[f] ? hx[f][i] : 0), 0) * 10) / 10;
  const cs = D.layers.candidates;
  cs.forEach((c) => { c.overall_suitability_score = Math.round(WKEYS.reduce((a, [k, , f]) => a + n[k] * (c[f] || 0), 0) * 10) / 10; });
  if (!(cs.length && cs[0].ci_rev_lakhs != null)) cs.sort((a, b) => b.overall_suitability_score - a.overall_suitability_score).forEach((c, k) => { c.rank = k + 1; });   // with the interaction model, rank = expected net volume
  D.site.weights = n;
}
async function initWeights() {
  WSTATE.base = { ...D.site.weights }; WSTATE.saved = null; WSTATE.canEdit = false;
  try { const s = await AGT.session(); WSTATE.level = s.level || (s.role === "admin" ? "admin" : "client"); } catch (e) { /* default */ }
  if (!BIZ) return;
  try {
    const r = await AGT.api("/api/weights/" + encodeURIComponent(BIZ));
    WSTATE.canEdit = !!r.can_edit; WSTATE.saved = r.weights;
    if (r.weights) applyWeights(r.weights);
  } catch (e) { /* use pipeline defaults */ }
}
function renderModelTab() {
  const btn = $("modelTabBtn"), pane = $("modelTab");
  btn.style.display = WSTATE.canEdit ? "" : "none";
  if (!WSTATE.canEdit) { pane.innerHTML = ""; if (pane.classList.contains("active")) document.querySelector("[data-tab=layersTab]").click(); return; }
  pane.innerHTML = weightsPanel(); bindWeights();
}
function weightsPanel() {
  const w = D.site.weights;
  return `<div class="wpanel"><div class="section-title"><h4>Model weights</h4><span>${({ admin: "Super admin", partner: "Partner", analyst: "Analyst" })[WSTATE.level] || "Manager"}</span></div>
    <p class="note" style="margin:0 0 10px">Change how much each driver counts. Quick-score values, tiers and the suitability layer update live (candidates stay ranked by the interaction model’s expected volume); Save makes the new weights the ones every user of this report sees. Revenue and unit projections are not re-forecast.</p>
    ${WKEYS.map(([k, l]) => `<div class="wrow"><label for="w_${k}">${l}</label><input type="range" id="w_${k}" data-w="${k}" min="0" max="100" value="${Math.round(w[k] * 100)}"><output id="wo_${k}">${Math.round(w[k] * 100)}%</output></div>`).join("")}
    <div class="wfoot"><button class="ghost-btn" id="wReset" type="button">Reset to model default</button><button class="ghost-btn" id="wSave" type="button" style="font-weight:600">Save weights</button></div><div class="note" id="wMsg" aria-live="polite"></div></div>`;
}
function bindWeights() {
  const root = $("modelTab"); if (!WSTATE.canEdit) return;
  const read = () => Object.fromEntries(WKEYS.map(([k]) => [k, +root.querySelector(`[data-w=${k}]`).value]));
  const msg = (t) => { const m = $("wMsg"); if (m) m.textContent = t; };
  root.querySelectorAll("[data-w]").forEach((el) => el.oninput = () => {
    const v = read(), tot = Object.values(v).reduce((a, b) => a + b, 0) || 1;
    WKEYS.forEach(([k]) => { $("wo_" + k).textContent = Math.round((v[k] / tot) * 100) + "%"; });
    applyWeights(v); refreshAfterWeights();
  });
  $("wSave").onclick = async () => { try { const r = await AGT.api("/api/weights/" + encodeURIComponent(BIZ), { body: { weights: read() } }); WSTATE.saved = r.weights; msg("Saved. Everyone who opens this report now sees these weights."); } catch (e) { msg(e.message || "Could not save."); } };
  $("wReset").onclick = async () => { try { await AGT.api("/api/weights/" + encodeURIComponent(BIZ), { body: { reset: true } }); WSTATE.saved = null; applyWeights(WSTATE.base); renderModelTab(); refreshAfterWeights(); $("wMsg").textContent = "Back to the model's default weights."; } catch (e) { msg(e.message || "Could not reset."); } };
}
function refreshAfterWeights() {
  const sc = $("expansionTab").scrollTop;
  renderExpansion(); $("expansionTab").scrollTop = sc;
  if (S.hexMode === "suit_score") buildHexScale();
  if (typeof redraw === "function") redraw();
}
function ciNote() {
  const m = (D.site.profile || {}).interaction_model || {};
  return `<div class="note"><b>Revenue model — competitive interaction.</b> Each site’s expected volume comes from a Huff / MCI gravity model: every demand cell splits its custom between the candidate, ${fmt(m.rivals)} rival outlets and ${fmt(m.own_outlets)} of your own, in proportion to attraction ÷ distance<sup>${m.beta}</sup>. Attraction rises with complementary venues nearby (dining, transit, offices, education…) and falls with stronger rivals. Cannibalisation is the volume the candidate would take from your own outlets. Ranges are P10–P90 over ${m.draws} runs with the distance decay, complement strength, rival strength and outside option varied. Levels are anchored to the baseline of ${fmt(m.typical_site_units_per_day)}/day for a typical site until real sales data calibrate it; ranking between sites is what the model establishes. Ranked by expected net volume.</div>`;
}
function altHeader(a) {   // request type "site + N alternatives": the client's site as the benchmark
  const better = a.n_better != null ? `${a.n_better} of ${a.n_found} beat your site` : `${a.n_found} found`;
  return `<div class="section-title"><h4>Alternatives within ${a.search_km} km</h4><span>${better}</span></div>
    <div class="cand" style="cursor:default;border-style:dashed"><div class="cand-head"><div class="rank" style="background:#1d1d1f">★</div>
      <div><div class="cand-name">Your site · ${esc(D.site.profile.store_name)}</div><div class="cand-persona">${esc(a.frontage_street || "")} · ${fmt(a.frontage_daily_footfall)} passers-by a day</div></div></div>
      <div class="cand-stats"><div>${UNIT()}<b>${fmt(a.ci_net_units)}</b></div><div>₹ L/mo<b>${fmt(a.ci_rev_lakhs, 1)}</b>${a.ci_rev_p10 != null ? `<small style="display:block;color:#6e6e73;font-weight:400">${fmt(a.ci_rev_p10, 1)}–${fmt(a.ci_rev_p90, 1)}</small>` : ""}</div>
        <div>Own-outlet loss<b>${fmt(a.ci_cannibal_pct, 1)}%</b></div></div></div>
    <div class="note" style="margin:0 0 12px">Every shop front within ${a.search_km} km is checked, at least 300 m from your outlets. Only the busiest ${a.footfall_top_pct || 5}% by peak-hour footfall are considered, and the ${a.n_requested} busiest of those at least ${fmt(a.min_gap_m)} m apart are listed. Each is then scored with the same sales model as your site, so you can compare them directly; the sales figure is for information and does not decide the ranking.</div>`;
}
function planHeader() {   // request type "N new locations in an area": the whole plan across tiles
  if (!PLAN) return `<div class="section-title"><h4>Recommended new locations</h4></div>`;
  const P0 = PLAN.picks, mx = Math.max(1, ...P0.map((p) => p.marginal_units));
  return `<div class="section-title"><h4>Recommended new locations</h4><span>${P0.length} of ${PLAN.area.n} · ${esc(PLAN.area.label || "")} ${PLAN.area.radius_km} km</span></div>
    <div class="note" style="margin:0 0 10px">Footfall first, spread evenly: the area is split into ${PLAN.area.n} equal zones and each gets its busiest shop front by peak-hour footfall (top ${PLAN.footfall_top_pct || 5}% of the area). The picks are at least ${((PLAN.min_gap_m || 0) / 1000).toFixed(1)} km apart${PLAN.gap_target_m && PLAN.min_gap_m < PLAN.gap_target_m ? ` (the aim was ${(PLAN.gap_target_m / 1000).toFixed(0)} km; the area is too small to fit them further apart)` : ""}. The bars show the ${esc(PLAN.unit_label || "sales")} each store is expected to add after sharing customers with your outlets and the earlier picks; they are for information and do not decide the ranking.</div>
    ${P0.map((p) => `<button class="plan-row ${p.site_id === S.siteId ? "here" : ""}" data-plan="${p.pick_rank}" style="display:grid;grid-template-columns:28px 1fr 64px;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:6px 2px;cursor:pointer;color:inherit;font:inherit">
      <b>#${p.pick_rank}</b><span><span style="display:block;font-size:12.5px">${esc(p.name || "")}</span><span style="display:block;height:6px;border-radius:3px;background:currentColor;opacity:${p.site_id === S.siteId ? 1 : .45};width:${Math.max(4, p.marginal_units / mx * 100)}%;margin-top:4px"></span></span>
      <span style="text-align:right;font-size:12.5px">+${fmt(p.marginal_units)}<small style="display:block;color:#6e6e73">₹${fmt(p.ci_rev_lakhs, 1)} L/mo</small></span></button>`).join("")}
    <div class="note" style="margin:8px 0 14px">Network total: ${fmt((P0[P0.length - 1] || {}).cumulative_units)} ${esc(PLAN.unit_label || "")} across the ${P0.length} suggested locations.${(PLAN.incomplete_tiles || []).length ? ` Part of the area could not be analysed (${PLAN.incomplete_tiles.length} map tile${PLAN.incomplete_tiles.length === 1 ? "" : "s"}), so these picks do not cover all of it.` : ""}</div>`;
}
async function openPlanPick(rank) {
  const p = PLAN && PLAN.picks.find((x) => x.pick_rank === +rank);
  if (!p) return;
  if (p.site_id !== S.siteId) { S.siteId = p.site_id; $("siteSelect").value = p.site_id; location.hash = `${BIZ}/${S.siteId}`; await loadSite(S.siteId); }
  const c = D.layers.candidates.find((x) => x.plan_rank === p.pick_rank);
  if (c) selectCandidate(c.candidate_id, true);
}
/* PDF report of the recommended locations: approved partners and the super admin only (the server enforces it too). */
let USER_LEVEL = null;
if (window.AGT) AGT.session().then((s) => { USER_LEVEL = s.level || (s.role === "admin" ? "admin" : "client"); paintPdf(); }).catch(() => {});
function paintPdf() {
  const box = $("pdfBox");
  if (!box) return;
  if (!["partner", "admin"].includes(USER_LEVEL) || !D || !D.layers.candidates.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<button class="ghost-btn" id="pdfBtn" style="width:100%;margin-bottom:12px">Download PDF report · ${D.layers.candidates.length} location${D.layers.candidates.length === 1 ? "" : "s"}</button><div class="note" id="pdfMsg" style="margin:-6px 0 12px" hidden></div>`;
  $("pdfBtn").onclick = async () => {
    const b = $("pdfBtn"), m = $("pdfMsg"), old = b.textContent;
    b.disabled = true; b.textContent = "Preparing the PDF… (about 20 seconds)"; m.hidden = true;
    try {
      const r = await fetch(AGT.url(`/api/pdf/${encodeURIComponent(BIZ)}/${encodeURIComponent(S.siteId)}`), { headers: { Authorization: "Bearer " + AGT.token() } });
      if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) { /* not json */ } throw new Error(j.error || "The PDF could not be made."); }
      const blob = await r.blob(), name = ((r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/) || [])[1] || "recommended_locations.pdf";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { m.textContent = e.message && e.message !== "Failed to fetch" ? e.message : "We couldn’t reach the server. Please try again."; m.hidden = false; }
    b.disabled = false; b.textContent = old;
  };
}
function renderExpansion() {
  const hx = D.hexes, ly = D.layers, [b0, b1] = D.site.golden_band_km;
  const elig = hx.all.filter((i) => hx.eligible && hx.eligible[i]);
  const cnt = SUIT.map(([t], k) => elig.filter((i) => hx.suit_score[i] >= t && (k === 0 || hx.suit_score[i] < SUIT[k - 1][0])).length);
  const w = D.site.weights, role = D.site.profile.site_role, alt = D.site.profile.alternatives;
  const head = role === "alternatives" && alt ? altHeader(alt) : role === "area" ? planHeader() : `
    <div class="section-title"><h4>Golden band ${b0}–${b1} km</h4><span>${fmt(elig.length)} eligible cells</span></div>`;
  $("expansionTab").innerHTML = `<div id="pdfBox"></div>${head}
    <div class="tier-counts"${["alternatives", "area"].includes(role) ? ' style="display:none"' : ""}>${SUIT.map(([, c, l], k) => `<div class="tier-count" style="border-top:3px solid ${c}"><div class="n">${fmt(cnt[k])}</div><div class="l">${l}</div></div>`).join("")}</div>
    <button class="ghost-btn" id="showSuit" style="width:100%;margin-bottom:12px${["alternatives", "area"].includes(role) ? ";display:none" : ""}">Show suitability mesh on map</button>
    ${ly.candidates.map((c) => `<div class="cand ${c.candidate_id === S.selCandidate ? "sel" : ""}" data-cand="${c.candidate_id}">
      <div class="cand-head"><div class="rank">${c.rank}</div>
        <div><div class="cand-name">${esc(c.name)}</div><div class="cand-persona">${esc(c.corridor_type)} · ${c.min_distance_km} km <span class="pass">PASS</span></div>
          ${c.frontage_peak_hourly != null ? `<div class="cand-persona">${ico("walking", null, 12, 1.4)} ${fmt(c.frontage_peak_hourly)}/hr at peak ${esc(c.peak_window || "")} ${(D.site.profile.site_role || "existing") === "existing" || D.site.profile.site_role === "prospective" ? ` · footfall #${c.peak_footfall_rank} of 10` : ""}</div>` : ""}</div>
        <div class="score" style="color:${scoreColor(c.overall_suitability_score)}">${fmt(c.overall_suitability_score, 1)}<small>/ 100</small></div></div>
      <div class="cand-bars">${[["DEMO", c.demographic_score], ["COMM", c.commercial_score], ["SYN", c.synergy_score], ["WHITE", c.white_space_score]].map(([l, v]) =>
        `<div class="cbar"><div class="l">${l} ${fmt(v, 0)}</div><div class="tr"><div style="width:${v}%;background-image:${scoreGradient(v)}"></div></div></div>`).join("")}</div>
      ${c.vs_site_pct != null ? `<div class="cand-persona" style="margin:2px 0 6px"><b style="color:${c.vs_site_pct >= 0 ? "#17653a" : "#b42318"}">${c.vs_site_pct >= 0 ? "+" : ""}${fmt(c.vs_site_pct, 0)}% vs your site</b> · ${c.dist_from_site_km} km away · ${fmt(c.footfall_vs_site, 1)}× its street footfall</div>` : ""}
      ${c.marginal_units != null ? `<div class="cand-persona" style="margin:2px 0 6px"><b>Pick #${c.plan_rank}</b> · adds ${fmt(c.marginal_units)} ${esc(UNIT())} to the network (total ${fmt(c.cumulative_units)})</div>` : ""}
      <div class="cand-stats"><div>${UNIT()}<b>${fmt(c.projected_daily_units)}</b></div><div>₹ L/mo<b>${fmt(c.projected_monthly_revenue_lakhs, 1)}</b>${c.ci_rev_p10 != null ? `<small style="display:block;color:#6e6e73;font-weight:400">${fmt(c.ci_rev_p10, 1)}–${fmt(c.ci_rev_p90, 1)}</small>` : ""}</div>
        <div>Payback<b>${fmt(c.est_payback_months, 1)} mo</b></div><div>${c.ci_rev_p10 != null ? "Own-outlet loss" : "Risk"}<b>${fmt(c.cannibalization_risk_pct, 1)}%</b></div></div>
    </div>`).join("")}
    <div class="note"${["alternatives", "area"].includes(role) ? " hidden" : ""}>Candidates are restricted to the 10 busiest peak-hour shop fronts in the golden band (≥1.5 km apart; expressways and ramps excluded), then ranked by area score. Score = ${Math.round(w.demographic * 100)}% demographic + ${Math.round(w.commercial * 100)}% commercial + ${Math.round(w.synergy * 100)}% synergy + ${Math.round(w.white_space * 100)}% white space, each a percentile within the study area. ${esc(UNIT())} and revenue are heuristic projections from a baseline of ${fmt((B().economics || {}).baseline_daily_units)} ${esc((DEM().unit || "units"))}/day at ₹${fmt((B().economics || {}).avg_ticket_inr)} per bill; risk is the Huff-model share of the candidate’s 1.5 km demand pulled by the nearest existing outlet.</div>${(ly.candidates[0] || {}).ci_rev_lakhs != null ? ciNote() : ""}`;
  paintPdf();
  $("expansionTab").querySelectorAll("[data-cand]").forEach((el) => el.onclick = () => selectCandidate(el.dataset.cand, true));
  $("expansionTab").querySelectorAll("[data-plan]").forEach((el) => el.onclick = () => openPlanPick(el.dataset.plan).catch(fail));
  $("showSuit").onclick = () => { S.hexMode = "suit_score"; S.hexScope = "band"; S.on.hexes = true; S.hexOpacity = 0.7; S.openGroups.add("mesh"); buildHexScale(); renderLayersPanel(); renderHexLegend(); redraw(); };
}
function selectCandidate(id, fly) {
  S.selCandidate = id; S.on.candidates = true;
  { const cb = document.querySelector("[data-toggle=candidates]"); if (cb) { cb.checked = true; cb.closest(".layer").classList.add("on"); updateGroupCounts(); } }
  document.querySelectorAll("[data-cand]").forEach((el) => el.classList.toggle("sel", el.dataset.cand === id));
  const c = D.layers.candidates.find((x) => x.candidate_id === id);
  if (c && fly) { map.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 1200 }); inspectCandidate(c); }
  redraw();
}
function inspectCandidate(c) {
  $("inspectorBody").innerHTML = `<div class="insp-type">${ico("map-pin-plus", "#6e6e73", 14, 1.5)}Expansion candidate #${c.rank}</div><div class="insp-title">${esc(c.name)}</div>${candidateGrid(c)}`;
  $("inspector").classList.remove("hidden");
}

/* ----------------------------------------------------------------- legend & time */
function renderLegend() {
  const tiers = D.site.tiers.slice().sort((a, b) => a.level - b.level);
  $("tierRow").innerHTML = tiers.map((t) => `<button style="background:${t.color}" class="${S.tierOn.has(t.level) ? "" : "off"} ${t.level >= 6 && t.level <= 8 ? "light" : ""}"
    data-tier="${t.level}" title="${esc(t.label)} · ≥${fmt(t.min)}/hr">${t.level === 10 ? "10+" : t.level}</button>`).join("");
  $("tierRow").querySelectorAll("button").forEach((b) => b.onclick = () => {
    const l = +b.dataset.tier;
    if (S.tierOn.size === 11) S.tierOn = new Set([l]); else if (S.tierOn.has(l)) { S.tierOn.delete(l); if (!S.tierOn.size) S.tierOn = new Set(tiers.map((t) => t.level)); } else S.tierOn.add(l);
    $("tierFilterLabel").textContent = S.tierOn.size === 11 ? "all tiers" : `showing ${[...S.tierOn].sort((a, b) => a - b).join(", ")}`;
    renderLegend(); redraw();
  });
  renderHexLegend();
}
function renderHexLegend() {
  const el = $("hexLegend");
  if (!S.on.hexes) { el.innerHTML = `<span style="color:var(--text-3)">Hexagon mesh hidden</span>`; return; }
  const m = HEX_MODES[S.hexMode];
  if (m.kind === "cat") el.innerHTML = Object.entries(LANDUSE).map(([k, c]) => `<span><i style="background:${c}"></i>${k.replace("_", " ")}</span>`).join("");
  else if (m.kind === "suit") el.innerHTML = SUIT.map(([, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
  else { const b = hexScale.breaks, f = (v) => m.pct ? fmt(v * 100, 0) + "%" : compact(v);
    el.innerHTML = `<div class="legend-ramp"><div class="eyebrow" style="margin-bottom:4px">${m.label}</div><div class="ramp" style="background:linear-gradient(90deg,${RAMP.join(",")})"></div>
      <div class="ends"><span>${f(m.kind === "idx" ? 0 : hexScale.min)}</span><span>${f(b[2])}</span><span>${f(m.kind === "idx" ? 100 : hexScale.max)}</span></div></div>`; }
}
function updateTime() {
  computeFlows();
  const st = D.streets;
  $("tlHour").textContent = hh(S.hour); $("tlHour12").textContent = h12(S.hour); $("hourRange").value = S.hour;
  $("tlDay").textContent = DAYS[S.day]; $("tlPhase").textContent = `${phaseOf(S.hour)} · ${(DEM().propensity_label || "propensity").toLowerCase()} ${Math.round(PROP()[S.hour] * 100)}%`;
  $("legendTime").textContent = `${hh(S.hour)} ${DAY_SHORT[S.day]}`;
  // hourly walkshed series for the selected day
  const tot = new Array(24).fill(0), peak = new Array(24).fill(0);
  for (const s of st.walk) for (let h = 0; h < 24; h++) { const f = segFlow(s, S.day, h); tot[h] += f; peak[h] = Math.max(peak[h], f); }
  const mx = Math.max(...peak, 1);
  $("tlBars").innerHTML = peak.map((v, h) => `<div class="${h === S.hour ? "now" : ""}" data-h="${h}" style="height:${Math.max(6, (v / mx) * 100)}%;background:${tierHex(v)}" title="${hh(h)} · peak ${fmt(v)}/hr · walkshed ${fmt(tot[h])}/hr"></div>`).join("");
  $("tlBars").querySelectorAll("div").forEach((b) => b.onclick = () => setHour(+b.dataset.h));
  const lvl = tierOf(peak[S.hour]), t = D.site.tiers.find((x) => x.level === lvl);
  $("tlBadge").textContent = lvl === 10 ? "10+" : lvl; $("tlBadge").style.background = t.color;
  $("tlIndexVal").textContent = `${fmt(peak[S.hour])} / hr`; $("tlTotalVal").textContent = `${fmt(tot[S.hour])} / hr`;
  redraw();
}
function setHour(h) { S.hour = (h + 24) % 24; updateTime(); }
function togglePlay() {
  S.playing = !S.playing; $("playBtn").textContent = S.playing ? "❚❚" : "▶"; $("playBtn").classList.toggle("on", S.playing);
  clearInterval(S.timer); if (S.playing) S.timer = setInterval(() => setHour(S.hour + 1), 1100);
}

/* ----------------------------------------------------------------- method modal */
function renderMethod() {
  const pv = D.site.provenance, src = pv.sources || {}, vm = pv.voter_model || {}, bz = B(), eco = bz.economics || {}, cp = bz.competitors || {};
  const row = (a, b, c, tag) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td><td><span class="tag-m ${tag === "MODELLED" ? "mod" : "obs"}">${tag}</span></td></tr>`;
  const kv = (o) => Object.entries(o || {}).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ");
  $("methodBody").innerHTML = `<h2>${esc(bz.display_name || "Business")} · data &amp; method</h2>
    <div class="note">${esc(bz.format || "")}<br>Generated ${esc((pv.generated_at || "").slice(0, 16).replace("T", " "))} UTC · centre ${esc(pv.centre?.plus_code)} · radius ${pv.radius_km} km</div>
    ${bz.rationale && Object.keys(bz.rationale).length ? `<h3>Why the model is weighted this way</h3><table>${Object.entries(bz.rationale).map(([k, v]) =>
      `<tr><td style="width:130px"><b>${esc(k.replace(/_/g, " "))}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
    <h3>Business parameters</h3><table>
      <tr><td><b>Customer cohorts</b></td><td>${esc(kv((bz.demand || {}).cohort_weights))}</td></tr>
      <tr><td><b>Demand curve</b></td><td>${esc(bz.demand?.propensity_label || "")} · peak ${esc((bz.demand?.peak_hours || []).join("–"))}h (${esc(bz.demand?.peak_label || "")})</td></tr>
      <tr><td><b>Competitors</b></td><td>${esc(cp.label || "")}: ${(cp.types || []).map((t) => `${esc(t[1])}${t[2] ? " (direct)" : ""}`).join(", ")}; ${(cp.brands || []).length} named brands</td></tr>
      <tr><td><b>Synergy weights</b></td><td>${esc(kv((bz.synergy || {}).weights))}</td></tr>
      <tr><td><b>Street gravity</b></td><td>${esc(kv(bz.street_gravity))}</td></tr>
      <tr><td><b>Suitability</b></td><td>${esc(kv(D.site.weights))}</td></tr>
      <tr><td><b>Catchment</b></td><td>walkshed ${bz.catchment?.walkshed_m} m · scoring ${bz.catchment?.catchment_m} m · golden band ${esc((bz.catchment?.golden_band_km || []).join("–"))} km</td></tr>
      <tr><td><b>Economics</b></td><td>₹${fmt(eco.avg_ticket_inr)} per bill · baseline ${fmt(eco.baseline_daily_units)} ${esc(bz.demand?.unit || "units")}/day · capex ₹${eco.capex_lakhs} L · margin ${Math.round((eco.contribution_margin || 0) * 100)}%</td></tr>
    </table>
    <h3>Sources</h3><table><tr><th>LAYER</th><th>SOURCE</th><th>DATE / RESOLUTION</th><th>STATUS</th></tr>
    ${row("Roads", src.roads, `OSM snapshot ${String(pv.osm_snapshot_utc || "").slice(0, 10)}`, "OBSERVED")}
    ${row("Businesses", src.businesses, `Overture ${pv.overture_release} · ${fmt(pv.points_after_merge_in_radius)} points`, "OBSERVED")}
    ${row("Buildings", src.buildings, `${fmt(pv.overture_buildings_in_radius)} footprints · floors mostly assumed`, "OBSERVED")}
    ${row("Population", pv.population_counts_source, vm.booths_used ? `${fmt(vm.booths_used)} booths · roll coverage ${pv.roll_completeness}` : "", "OBSERVED")}
    ${row("Floating adults & children", "Population model", "5–50% unregistered adults by IT intensity; children from adults 25–44", "MODELLED")}
    ${row("Street footfall", "Gravity model", "Road class × business pull (profile weights) × transit × residents; 24 h curves", "MODELLED")}
    ${row("Business demand", "Profile demand curve", "Footfall × hourly propensity of the product", "MODELLED")}
    ${row("Day-of-week", "Dashboard modifiers", "Fri evening ×1.2, Sun family peak ×1.04", "MODELLED")}
    ${row("Suitability & projections", "Competitive interaction (Huff/MCI) + multi-criteria score", `Percentile scores; ${esc(bz.demand?.unit || "units")} from baseline ${fmt(eco.baseline_daily_units)}/day`, "MODELLED")}
    ${row("Google ratings", src.google, "Needs a Places API key", "OBSERVED")}</table>
    <h3>Privacy</h3><div class="note" style="font-size:12px">Only booth-level counts by age band and gender are read from the electoral roll. Names, EPIC numbers, relatives and addresses are never loaded or published.</div>`;
}

/* ----------------------------------------------------------------- boot */
function initMap(centre) {
  map = new maplibregl.Map({ container: "map", style: BASEMAP, center: centre, zoom: 14.2, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
  overlay = new deck.MapboxOverlay({ interleaved: false, layers: [], getTooltip: tooltip, onClick: inspect });
  map.addControl(overlay);
  new ResizeObserver(() => map.resize()).observe($("map"));   // container may be 0×0 at boot (hidden tab)
  const upd =(e) => { const c = e && e.lngLat ? e.lngLat : map.getCenter();
    $("coords").textContent = `LAT ${c.lat.toFixed(4)}°N  |  LON ${c.lng.toFixed(4)}°E  |  ZOOM ${map.getZoom().toFixed(1)}  |  ${hh(S.hour)} ${isWeekend(S.day) ? "weekend" : "weekday"}`; };
  map.on("mousemove", upd); map.on("moveend", upd);
  let lastZ = null; map.on("zoomend", () => { const z = Math.round(map.getZoom() * 2) / 2; if (z !== lastZ) { lastZ = z; redraw(); } });
}
const ALL_TOGGLES = ["streets", "walkshed", "rings", "hexes", "competitors", "candidates", "dining", "kids", "education", "transit",
  "techparks", "offices", "allpoints", "stores"];
function applyBusinessDefaults(site) {
  const db = (site.business || {}).dashboard || {};
  const on = new Set(["streets", "stores"]);   // calm by default: everything else is opt-in from the Data layers panel
  const cp = (site.business || {}).client_priorities;   // the customer's request-form answers: layers they scored 7+ (or listed brands for) start on
  if (cp) {
    const m = cp.minor || {}, hi = (k) => (m[k] || 0) >= 7;
    [["dining", "dining"], ["kidsvenues", "kids"], ["education", "education"], ["techparks", "techparks"], ["offices", "offices"]].forEach(([q, l]) => { if (hi(q)) on.add(l); });
    if (hi("rail") || hi("bus")) on.add("transit");
    if (((cp.brands || {}).competitors || []).length) on.add("competitors");
    ((site.business || {}).custom_layers || []).forEach((c) => {
      const key = /^client_malls$/.test(c.id) ? "malls" : /^client_parks$/.test(c.id) ? "parks" : /^client_supermarkets$/.test(c.id) ? "supermarkets" : /^client_societies$/.test(c.id) ? "societies" : null;
      if ((key && hi(key)) || /^cb_/.test(c.id) || (c.id === "client_other" && ((cp.other || {}).score || 0) >= 7)) on.add("custom_" + c.id);
    });
  }
  S.on = {};
  ALL_TOGGLES.forEach((k) => { S.on[k] = on.has(k); });
  ((site.business || {}).custom_layers || []).forEach((c) => { S.on["custom_" + c.id] = on.has("custom_" + c.id); });
  if (db.default_hour != null) S.hour = db.default_hour;
  if (db.default_day != null) { S.day = db.default_day; $("daySelect").value = String(S.day); }
  if (db.default_hex_mode && HEX_MODES[db.default_hex_mode]) S.hexMode = db.default_hex_mode;
}
async function loadSite(id, isNewBusiness = false) {
  $("loader").classList.remove("hidden"); $("loaderText").textContent = "Loading intelligence layers…";
  const base = BIZ ? `data/${BIZ}/${id}/` : `data/${id}/`;
  const [site, streets, hexes, pois, layersData] = await Promise.all(["site", "streets", "hexes", "pois", "layers"].map((f) => getJSON(base + f + ".json")));
  site.walkshed_m = ((site.business || {}).catchment || {}).walkshed_m || 350;
  D = { site, streets, hexes, pois, layers: layersData };
  if (isNewBusiness) applyBusinessDefaults(site);
  D.tierRGB = {}; site.tiers.forEach((t) => { D.tierRGB[t.level] = hex2rgb(t.color); });
  prepStreets(); prepHexes(); prepPois(); await initWeights(); buildHexScale();
  { // coverage tier badge (high-precision = locally calibrated city; otherwise standard coverage)
    const hi = /^Electoral roll/.test(site.provenance.population_counts_source || "");
    let cb = $("covBadge"); if (!cb) { cb = document.createElement("div"); cb.id = "covBadge"; cb.className = "badge"; $("snapshotBadge").before(cb); }
    cb.textContent = hi ? "Premium intelligence" : "Pan-India insights"; cb.title = hi ? "Built on our premium, high-precision, locally calibrated models for this city." : "Wide, city-level insights. This city is being upgraded to premium, Bengaluru-level precision between December 2026 and March 2027.";
    cb.style.fontWeight = "600"; if (hi) { cb.style.background = "var(--ink, #1d1d1f)"; cb.style.color = "var(--bg, #fff)"; }
  }
  $("snapshotBadge").textContent = `OSM ${String(site.provenance.osm_snapshot_utc || "").slice(0, 10)} · Overture ${site.provenance.overture_release || ""}`;
  document.querySelector(".brand-text span").textContent = (site.business || {}).display_name || "Site Footfall Intelligence";
  document.title = `AGT Intelligence · ${(site.business || {}).display_name || "Site intelligence"}`;
  const pk = DEM().peak_hours || [21, 22];
  document.querySelector(".tl-marks").innerHTML = [[3, "Night quiet"], [8, "Morning transit"], [13, "Lunch rush"], [16, "Afternoon"],
    [pk[0], DEM().peak_label || "Evening peak"]].map(([h, l]) => `<span>${hh(h)} ${esc(l)}</span>`).join("");
  renderSite(); renderLayersPanel(); renderExpansion(); renderModelTab(); renderLegend(); renderMethod(); updateTime();
  map.jumpTo({ center: site.centre, zoom: 14.2 });
  $("loader").classList.add("hidden");
}
async function loadBusiness(bid) {
  BIZ = bid;
  REG = await getJSON(`data/${bid}/sites.json`);
  PLAN = REG.sites.some((s) => s.role === "area") ? await getJSON(`data/${bid}/plan.json`).catch(() => null) : null;
  let n = 0, p = 0, a = 0;
  $("siteSelect").innerHTML = REG.sites.map((s) => {
    const tag = s.role === "area" ? "Whole area" : s.role !== "existing" ? `P${String(++p).padStart(2, "0")}` : `#${String(++n).padStart(2, "0")}`;
    return `<option value="${s.id}">${tag} ${esc(s.label)}${s.zone ? " · " + esc(s.zone) : ""}${s.rating ? ` (★ ${s.rating})` : ""}</option>`;
  }).join("");
  const want = decodeURIComponent(location.hash.slice(1)).split("?")[0].split("/")[1];
  S.siteId = REG.sites.some((s) => s.id === want) ? want : REG.sites[0].id;
  $("siteSelect").value = S.siteId;
  if (!map) initMap(REG.sites.find((s) => s.id === S.siteId).centre);
  location.hash = `${BIZ}/${S.siteId}`;
  await loadSite(S.siteId, true);
}
function bindUI() {
  $("daySelect").onchange = (e) => { S.day = +e.target.value; updateTime(); };
  $("siteSelect").onchange = (e) => { S.siteId = e.target.value; location.hash = `${BIZ}/${S.siteId}`; loadSite(S.siteId).catch(fail); };
  $("bizSelect").onchange = (e) => { location.hash = e.target.value; loadBusiness(e.target.value).catch(fail); };
  $("hourRange").oninput = (e) => setHour(+e.target.value);
  $("prevHour").onclick = () => setHour(S.hour - 1); $("nextHour").onclick = () => setHour(S.hour + 1); $("playBtn").onclick = togglePlay;
  document.querySelector(".timeline").addEventListener("wheel", (e) => { e.preventDefault(); setHour(S.hour + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  $("inspectorClose").onclick = () => $("inspector").classList.add("hidden");
  $("methodBtn").onclick = () => $("methodModal").classList.remove("hidden");
  document.querySelectorAll("[data-close]").forEach((b) => b.onclick = () => $(b.dataset.close).classList.add("hidden"));
  $("methodModal").onclick = (e) => { if (e.target.id === "methodModal") $("methodModal").classList.add("hidden"); };
  document.querySelectorAll(".tab").forEach((t) => t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === t.dataset.tab));
  });
  const collapse = (id, on) => {
    $(id).classList.toggle("collapsed", on);
    if (id === "leftPanel") { $("leftReopen").classList.toggle("show", on); $("inspector").classList.toggle("wide", on); $("coords").classList.toggle("wide", on); }
    else { $("rightReopen").classList.toggle("show", on); $("legend").classList.toggle("wide", on); }
  };
  document.querySelectorAll("[data-collapse]").forEach((b) => b.onclick = () => collapse(b.dataset.collapse, true));
  $("leftReopen").onclick = () => collapse("leftPanel", false); $("rightReopen").onclick = () => collapse("rightPanel", false);
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "ArrowRight") setHour(S.hour + 1); else if (e.key === "ArrowLeft") setHour(S.hour - 1);
    else if (e.key === " ") { e.preventDefault(); togglePlay(); } else if (e.key === "Escape") { $("inspector").classList.add("hidden"); $("methodModal").classList.add("hidden"); }
  });
  if (window.innerWidth < 1180) { collapse("leftPanel", true); }
}
// Shareable view: #business/site?h=19&d=1&c=12.96,77.58&z=15.5&on=streets,transit
const VIEW = (() => { const q = decodeURIComponent(location.hash.slice(1)).split("?")[1]; return q ? Object.fromEntries(new URLSearchParams(q)) : null; })();
function applyView(v) {
  if (!v) return;
  if (v.ui === "map") document.querySelectorAll("[data-collapse]").forEach((b) => b.click());
  if (v.on) { const on = new Set(v.on.split(",")); Object.keys(S.on).forEach((k) => { S.on[k] = on.has(k); }); renderLayersPanel(); }
  if (v.d != null) { S.day = +v.d; $("daySelect").value = String(S.day); }
  if (v.c) { const [la, ln] = v.c.split(",").map(Number); map.jumpTo({ center: [ln, la], zoom: v.z ? +v.z : map.getZoom() }); }
  else if (v.z) map.jumpTo({ zoom: +v.z });
  if (v.h != null) setHour(+v.h); else updateTime();
  redraw();
}
(async function boot() {
  try {
    bindUI();
    let biz;
    try { biz = await getJSON("data/businesses.json"); } catch { biz = null; }
    if (biz && biz.businesses.length) {
      $("bizSelect").innerHTML = biz.businesses.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
      const want = decodeURIComponent(location.hash.slice(1)).split("?")[0].split("/")[0];
      const bid = biz.businesses.some((b) => b.id === want) ? want : biz.businesses[biz.businesses.length - 1].id;
      $("bizSelect").value = bid;
      $("bizWrap").classList.toggle("hidden", biz.businesses.length < 2);
      await loadBusiness(bid);
      applyView(VIEW);
    } else {                                   // legacy single-business layout: data/sites.json
      $("bizWrap").classList.add("hidden");
      REG = await getJSON("data/sites.json");
      $("siteSelect").innerHTML = REG.sites.map((s, i) => `<option value="${s.id}">#${String(i + 1).padStart(2, "0")} ${esc(s.label)}</option>`).join("");
      S.siteId = REG.sites[0].id;
      initMap(REG.sites[0].centre);
      await loadSite(S.siteId);
    }
  } catch (e) { fail(e); }
  // Typing / pasting a #business/site link into an open tab switches to it.
  window.addEventListener("hashchange", () => {
    const [bid, sid] = decodeURIComponent(location.hash.slice(1)).split("?")[0].split("/");
    const opts = [...$("bizSelect").options].map((o) => o.value);
    if (bid && opts.includes(bid) && bid !== $("bizSelect").value) { $("bizSelect").value = bid; loadBusiness(bid).catch(fail); }
    else if (sid && sid !== S.siteId && [...$("siteSelect").options].some((o) => o.value === sid)) {
      $("siteSelect").value = sid; S.siteId = sid; loadSite(sid).catch(fail);
    }
  });
})();
function fail(e) { console.error(e); $("loaderText").innerHTML = `Could not load data: ${esc(e.message)}<br><small>Serve this folder over HTTP (see README) and run scripts/build_dashboard_data.py first.</small>`; }
