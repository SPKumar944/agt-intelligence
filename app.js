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
  streetScope: "all", hexMode: "landuse", hexModes: [], hexRange: {}, hexScope: "all", hexOpacity: 0.55,
  compScope: "direct", diningType: "all", kidsType: "all", eduType: "all", transitScope: "rail", poiCat: "all",
  walkType: "both", selected: null, selCandidate: null,
  on: { streets: true, stores: false, walkshed: false, rings: true, hexes: false, competitors: false, candidates: false,
        dining: false, kids: false, education: false, transit: false, techparks: false, offices: false, allpoints: false },
  openGroups: new Set(["foot"]),
};
let D = null, map = null, overlay = null, BIZ = null, REG = null, PLAN = null, BIZ_IDS = [];
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
/* House rule: Google Plus codes (e.g. "F25H+43X") are never shown in the dashboard; place names stay (e.g. "Gurugram, Haryana"). */
const PLUS_RE = /\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}\b[,\s]*/g;
const PLUS_KEEP = /^(plus_code|code|id|serial|candidate_id|site_id|business_id|key|ref)$/;
function noPlus(v, k) {
  if (typeof v === "string") { if (PLUS_KEEP.test(k || "") || !PLUS_RE.test(v)) { PLUS_RE.lastIndex = 0; return v; } PLUS_RE.lastIndex = 0; const o = v.replace(PLUS_RE, "").replace(/^[\s,—–-]+/, "").trim(); return o || "This location"; }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const x = v[i]; if (x && typeof x === "object" || typeof x === "string") v[i] = noPlus(x, k); } return v; }
  if (v && typeof v === "object") { for (const key of Object.keys(v)) { const x = v[key]; if (x && typeof x === "object" || typeof x === "string") v[key] = noPlus(x, key); } }
  return v;
}
async function getJSON(url) {   // data files come from the AGT server with the signed-in user's token
  const A = window.AGT, h = A && A.token() ? { Authorization: "Bearer " + A.token() } : {};
  const r = await fetch((A ? A.base : "") + "/" + String(url).replace(/^\//, ""), { cache: "no-store", headers: h });
  if (r.status === 401) { location.replace("login.html"); throw new Error("sign in"); }
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const j = await r.json(); return /(streets|hexes|pois)\.json/.test(String(url)) ? j : noPlus(j);
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
const RAMP = ["#ffffff", "#daeeff", "#aed8f5", "#74b8ec", "#3a93d9", "#1a6ab5", "#0d4a8a", "#053060", "#01193a"];   // one blue ramp for every sequential hexagon layer and the population graphs
// Crameri scientific colour maps (dominicroye.github.io/color-for-geoscience), low → high, one per hexagon metric
const lerpHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)), x = p(a), y = p(b); return "#" + x.map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, "0")).join(""); };
const ramp3 = (lo, mid, hi) => Array.from({ length: 9 }, (_, k) => k <= 4 ? lerpHex(lo, mid, k / 4) : lerpHex(mid, hi, (k - 4) / 4));
// one hue per factor family, light → dark: people & demography share the blue family; footfall is warm; indices are green; model outputs purple / red
const PAL = {
  blue: RAMP,
  pop: ramp3("#eaf3fb", "#3a93d9", "#053060"),
  daypop: ramp3("#e6f4f6", "#2a8aa8", "#0b3b4f"),
  kids: ramp3("#e8f4ee", "#3a9d8f", "#0f4a45"),
  youth: ramp3("#eaf0fb", "#4a6fd0", "#1c2f78"),
  seniors: ramp3("#efeaf8", "#7a5fb5", "#2e1f5e"),
  work: ramp3("#eef2f6", "#5b7690", "#1f3140"),
  foot: ramp3("#fff3d6", "#e9a04a", "#7a3a1c"),
  res: ramp3("#eef6e4", "#7fb24a", "#2f5a1e"),
  com: ramp3("#f3f0e0", "#b9a53f", "#5a4d15"),
  syn: ramp3("#e5f4ee", "#3fa37a", "#12513a"),
  net: ramp3("#f3e8f5", "#a64ca6", "#4a1450"),
  cann: ramp3("#fbe9e5", "#d9644a", "#6d1f12"),
};
const SUIT = [[75, "#053060", "Prime 75–100"], [60, "#1a6ab5", "High 60–74"], [45, "#74b8ec", "Moderate 45–59"], [0, "#daeeff", "Low <45"]];
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
  pop: { label: "Residents", kind: "seq", pal: "pop", field: "pop" },
  day_pop: { label: "Daytime population", kind: "seq", pal: "daypop", field: "day_pop" },
  k: { label: "Kids 0–14", kind: "seq", pal: "kids", field: "k" },
  y: { label: "Youth 15–24", kind: "seq", pal: "youth", field: "y" },
  s: { label: "Seniors 60+", kind: "seq", pal: "seniors", field: "s" },
  floating: { label: "Floating adults share", kind: "seq", pal: "work", calc: (i) => { const p = D.hexes.pop[i]; return p ? D.hexes.floating_adults[i] / p : 0; }, pct: true },
  com_workers: { label: "Daytime workforce", kind: "seq", pal: "work", field: "com_workers" },
  mean_daily_footfall: { label: "Street footfall (modelled)", kind: "seq", pal: "foot", field: "mean_daily_footfall" },
  res_idx: { label: "Residential index", kind: "idx", pal: "res", field: "res_idx" },
  com_idx: { label: "Commercial index", kind: "idx", pal: "com", field: "com_idx" },
  syn_idx: { label: "Retail synergy index", kind: "idx", pal: "syn", field: "syn_idx" },
  suit_score: { label: "New-store suitability", kind: "suit", field: "suit_score" },
  ci_net_units: { label: "Expected net volume (interaction model)", kind: "seq", pal: "net", field: "ci_net_units" },
  ci_cannibal_pct: { label: "Cannibalisation of own outlets (model)", kind: "seq", pal: "cann", field: "ci_cannibal_pct", pct: false },
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
let HSC = {};
const activeModes = () => (S.on.hexes ? (S.hexModes.length ? S.hexModes : [S.hexMode]) : []);
function hexValue(i, mk = S.hexMode) {
  const m = HEX_MODES[mk];
  if (m.calc) { try { return m.calc(i) || 0; } catch (e) { return 0; } }
  const c = D.hexes[m.field]; return c ? (c[i] ?? 0) : 0;
}
const hexAvail = (k) => { const m = HEX_MODES[k]; return m.kind === "cat" ? !!D.hexes.cls : m.calc ? !!D.hexes.floating_adults : !!D.hexes[m.field]; };
function buildHexScale() { HSC = {}; }
function scaleFor(mk) {
  if (HSC[mk]) return HSC[mk];
  const m = HEX_MODES[mk]; let s = null;
  if (m.kind === "seq") {
    const vals = D.hexes.all.map((i) => hexValue(i, mk)).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0;
    s = { breaks: [q(0.1), q(0.22), q(0.34), q(0.46), q(0.58), q(0.7), q(0.82), q(0.92)], min: vals[0] || 0, max: vals[vals.length - 1] || 0 };
  } else if (m.kind === "idx") s = { breaks: [11, 22, 33, 44, 56, 67, 78, 89], min: 0, max: 100 };
  return (HSC[mk] = s);
}
const hexRamp = (m) => PAL[m.pal] || RAMP;
const hexSpan = (mk) => { const m = HEX_MODES[mk], sc = scaleFor(mk); return m.kind === "idx" ? [0, 100] : [sc.min, sc.max]; };
function hexHidden(i, mk) { const r = S.hexRange[mk]; if (!r) return false; const v = hexValue(i, mk); return v < r[0] || v > r[1]; }
function hexColor(i, mk, level = 0) {
  if (S.hexRange[mk] && hexHidden(i, mk)) return [0, 0, 0, 0];
  const m = HEX_MODES[mk], a = Math.round(255 * S.hexOpacity) + (level ? 50 : 0), A = Math.min(255, a);
  if (m.kind === "cat") return [...hex2rgb(LANDUSE[dec(D.hexes.cls, i)] || "#e2e8f0"), A];
  const v = hexValue(i, mk);
  if (m.kind === "suit") { for (const [t, c] of SUIT) if (v >= t) return [...hex2rgb(c), A]; return [0, 0, 0, 0]; }
  if (!v) return level ? [0, 0, 0, 0] : [238, 238, 240, Math.round(A * 0.5)];
  const sc = scaleFor(mk); let k = 0; while (k < sc.breaks.length && v >= sc.breaks[k]) k++;
  return [...hex2rgb(hexRamp(m)[k]), A];
}
// several factors on at once: each is drawn as a smaller hexagon inside the previous one
function shrunk(i, f) {
  const hx = D.hexes, c = (hx._sh = hx._sh || {})[f] || (hx._sh[f] = new Array(hx.polys.length));
  if (c[i]) return c[i];
  const p = hx.polys[i], n = p.length - (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1] ? 1 : 0);
  let x = 0, y = 0; for (let k = 0; k < n; k++) { x += p[k][0]; y += p[k][1]; } x /= n; y /= n;
  return (c[i] = p.map(([a, b]) => [x + (a - x) * f, y + (b - y) * f]));
}

/* ----------------------------------------------------------------- deck layers */
function streetWidth(t) { return t >= 9 ? 5 : t >= 7 ? 3.8 : t >= 5 ? 2.8 : t >= 4 ? 1.9 : t >= 3 ? 1.2 : 0.8; }
function layers() {
  const L = [], st = D.streets, hx = D.hexes, site = D.site, [clng, clat] = site.centre;
  const trig = `${S.day}-${S.hour}`;

  { const modes = activeModes(), n = modes.length;
    modes.forEach((mk, lv) => {
      const f = (n - lv) / n;
      L.push(new deck.PolygonLayer({
        id: lv ? "hexes_" + lv : "hexes", data: D.hexes.all, getPolygon: f === 1 ? (i) => D.hexes.polys[i] : (i) => shrunk(i, f), getFillColor: (i) => hexColor(i, mk, lv),
        getLineColor: (i) => hexHidden(i, mk) ? [0, 0, 0, 0] : [90, 130, 180, 80], lineWidthUnits: "pixels", getLineWidth: 0.5, stroked: lv === 0, filled: true,
        pickable: true, autoHighlight: lv === n - 1, highlightColor: [15, 23, 42, 60],
        updateTriggers: { getFillColor: [mk, S.hexOpacity, n, String(S.hexRange[mk])], getLineColor: [String(S.hexRange[mk])], getPolygon: [f] },
      }));
    }); }
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
  switch (layer.id.replace(/^hexes_\d+$/, "hexes")) {
    case "streets": { const i = object; t = st.names[st.name[i]];
      s = `${st.highways[st.hw[i]]} · ${fmt(st.flow[i])}/hr ${S.streetMetric === "demand" ? "demand-weighted " : ""}at ${hh(S.hour)} · tier ${st.tier[i]}`; break; }
    case "hexes": { const i = object;
      t = dec(hx.locality, i) || "H3 cell";
      s = activeModes().map((mk) => { const m = HEX_MODES[mk], v = m.kind === "cat" ? dec(hx.cls, i) : hexValue(i, mk); return `${m.label}: ${m.pct ? fmt(v * 100, 1) + "%" : typeof v === "number" ? fmt(v, m.kind === "idx" || m.kind === "suit" ? 1 : 0) : v}`; }).join(" · ") + ` · ${fmt(hx.pop[i])} residents`; break; }
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

/* ----------------------------------------------------------------- clean-up layer: info popovers, folded sections, collapsed cards
   (added 2026-11-25; the previous dashboard is saved in backups/dashboard-before-cleanup-2026-11-25 with a REVERT.sh) */
const info = (text, cls = "") => `<button type="button" class="info ${cls}" data-info="${esc(String(text))}" aria-label="More information" title="More information">i</button>`;
const FOLD = {};
function tidy(root, opts = {}) {
  if (!root) return;
  root.querySelectorAll(".layer-desc").forEach((d) => {                       // layer descriptions → an i next to the layer name
    const t = d.textContent.trim(), nm = d.parentElement.querySelector(".layer-name");
    if (t && nm && !nm.querySelector(".info")) nm.insertAdjacentHTML("beforeend", info(t));
    d.remove();
  });
  root.querySelectorAll(".kpi .s").forEach((s) => {                           // KPI captions → an i beside the KPI title
    const k = s.closest(".kpi"), ey = k.querySelector(".eyebrow"), t = s.textContent.trim().replace(/\s+/g, " ");
    if (t && ey && !ey.querySelector(".info")) ey.insertAdjacentHTML("beforeend", info(t));
    s.remove();
  });
  root.querySelectorAll(".section-title span").forEach((sp) => {              // small text-only captions beside a section title → i
    const t = sp.textContent.trim(), h = sp.parentElement.querySelector("h4");
    if (t && !/\d/.test(t) && h && !sp.querySelector("*")) { h.insertAdjacentHTML("beforeend", info(t)); sp.remove(); }
  });
  root.querySelectorAll(".note").forEach((n) => {                             // long explanatory notes → an i beside the nearest heading
    if (n.id || n.hidden || n.dataset.keep != null || n.textContent.trim().length < 60) return;
    const host = n.closest(".section,.store-card,.layer,.cand,.lgroup-body,.tab-pane") || root;
    const h = host.querySelector(".section-title h4,.layer-name,.eyebrow,.eyebrow-row,h3,h4") || null;
    if (!h) return;
    h.insertAdjacentHTML("beforeend", info(n.textContent.trim().replace(/\s+/g, " ")));
    n.remove();
  });
  if (opts.fold) root.querySelectorAll(".section").forEach((sec) => {          // sections fold; the most useful stay open
    const t = sec.querySelector(":scope > .section-title"), key = t && (t.querySelector("h4") || t).textContent.trim();
    if (!t || !key) return;
    if (!(key in FOLD)) FOLD[key] = opts.keepOpen ? opts.keepOpen.test(key) : false;
    sec.classList.add("fold"); sec.classList.toggle("closed", !FOLD[key]);
    t.onclick = (e) => { if (e.target.closest(".info")) return; FOLD[key] = !FOLD[key]; sec.classList.toggle("closed", !FOLD[key]); };
  });
}
(function infoPopover() {
  const pop = document.createElement("div");
  pop.className = "info-pop hidden"; pop.setAttribute("role", "tooltip"); document.body.appendChild(pop);
  let cur = null;
  const close = () => { pop.classList.add("hidden"); cur = null; };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".info");
    if (b) {
      e.preventDefault(); e.stopPropagation();                               // an i inside a label/card must not toggle the layer or select the card
      if (cur === b) return close();
      cur = b; pop.innerHTML = `<div>${esc(b.dataset.info)}</div><a href="#" class="info-more">Learn more in Data &amp; method ›</a>`;
      pop.classList.remove("hidden");
      const r = b.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
      pop.style.top = (r.bottom + h + 12 > innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + "px";
      return;
    }
    if (e.target.closest(".info-more")) { e.preventDefault(); close(); const m = document.getElementById("methodBtn"); if (m) m.click(); return; }
    if (!e.target.closest(".info-pop")) close();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("resize", close);
})();
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
  switch (layer.id.replace(/^hexes_\d+$/, "hexes")) {
    case "streets": {
      const i = o, vals = [...Array(24).keys()].map((h) => segFlow(i, S.day, h));
      type = "Street segment · modelled footfall"; title = st.names[st.name[i]];
      body = grid([["Road class", st.highways[st.hw[i]]], ["Corridor tier", st.tiers[st.ct[i]]], [`Flow at ${hh(S.hour)}`, `${fmt(st.flow[i])} / hr`],
        ["Footfall tier", `${st.tier[i]} · ${D.site.tiers.find((t) => t.level === st.tier[i]).label}`], ["Weekday daily", fmt(st.wd[i])],
        ["Weekend daily", fmt(st.we[i])], ["Distance by road", km(st.nd[i])], ["Length", km(st.len[i])], ["Businesses ≤150 m", fmt(st.poi[i])],
        ["Locality", st.localities[st.loc[i]]]]) + `<div class="eyebrow" style="margin-top:10px">${DAYS[S.day]} · 24-hour profile</div>` + spark(vals, S.hour);
      break; }
    case "hexes": {
      const i = o, g = (k, d = 0, suf = "") => { const c = hx[k]; return c && c[i] != null ? fmt(c[i], d) + suf : null; };
      const pc = (k) => { const c = hx[k]; return c && c[i] != null ? fmt(c[i] * 100, 0) + "%" : null; };
      type = `H3 res ${hx.res} cell · all layers`; title = `${dec(hx.locality, i) || "Cell"}${dec(hx.ward, i) ? " · " + dec(hx.ward, i) : ""}`;
      const sc = hx.suit_score && hx.suit_score[i] != null ? `${fmt(hx.suit_score[i], 1)} · ${(SUIT.find(([t]) => hx.suit_score[i] >= t) || SUIT[3])[2].replace(/ [\d<–-].*$/, "")}` : null;
      const sec = (name, rows) => { const r = rows.filter((x) => x && x[1] != null && x[1] !== ""); return r.length ? `<div class="eyebrow" style="margin:12px 0 6px">${esc(name)}</div>` + grid(r) : ""; };
      const cust = (B().custom_layers || []).map((c) => [`${c.label} ≤1.5 km`, g(`custom_${c.id}_count`)]);
      body = (hx.h && hx.h[i] != null ? `<div class="insp-id" style="font-size:10.5px;color:var(--text-3);word-break:break-all">H3 index <b>${esc(String(typeof hx.h[i] === "number" ? hx.h[i].toString(16) : hx.h[i]))}</b></div>` : "")
        + sec("Suitability", [["Overall score", sc], ["Demographic", g("demographic_score", 1)], ["Commercial", g("commercial_score", 1)], ["Synergy", g("synergy_score", 1)],
            ["White space", g("white_space_score", 1)], ["Dist. to store", g("dist_km", 2, " km")], ["Golden band", hx.in_golden_band ? (hx.in_golden_band[i] ? "Yes — eligible" : "No") : null]])
        + sec("People", [["Land use", dec(hx.cls, i)], ["Residents", g("pop")], ["Daytime pop", g("day_pop")], ["Registered voters", g("voters_registered")], ["Floating adults", g("floating_adults")],
            ["IT intensity", pc("it_intensity")], ["Kids 0–14", g("k")], ["Youth 15–24", g("y")], ["Working 25–59", g("w")], ["Seniors 60+", g("s")], ["Workforce", g("com_workers")]])
        + sec("Built space & footfall", [["Office floor", g("off_m2", 0, " m²")], ["Commercial floor", g("com_m2", 0, " m²")], ["Residential floor", g("res_built_m2", 0, " m²")],
            ["Businesses", g("n_pois")], ["Street footfall / day", g("mean_daily_footfall")], ["Res / Com / Syn idx", hx.res_idx ? `${fmt(hx.res_idx[i], 0)} / ${fmt(hx.com_idx[i], 0)} / ${fmt(hx.syn_idx[i], 0)}` : null]])
        + sec("Around this cell · within 1.5 km", [["Residents", g("pop_15k")], ["Kids", g("kids_15k")], ["Youth", g("youth_15k")], ["Workforce", g("workforce_15k")],
            ["Target demand", g("target_demand_15k")], ["Floating adults", g("floating_15k")], ["Direct competitors", g("comp_count")], ["All competitors", g("comp_all_count")],
            ["Dining", g("dining_count")], ["Kids & family", g("kids_count")], ["Schools & colleges", g("education_count")], ["Rail / metro", g("transit_rail_count")],
            ["Bus stops", g("bus_stops_count")], ["Tech parks", g("techparks_count")], ["Offices", g("offices_count")], ...cust])
        + sec("If an outlet opened here", [[`Projected ${UNIT().toLowerCase()}`, g("proj_units") || g("proj_cups")], ["Projected ₹ L/month", g("proj_rev", 2)], ["Own-outlet loss", g("ci_cannibal_pct", 1, "%")],
            ["Share of demand captured", g("ci_capture_pct", 1, "%")]]);
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
        ["Address", p.address], ["Phone", p.phone], ["Google rating", p.google_rating ?? "not fetched"]]); break; }
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


/* Business mix as a treemap: ONE square, split into tiles whose area is each category's share (squarified layout, no gaps).
   Colours: Crameri "Batlow" (GeoPalettes, dominicroye.github.io/color-for-geoscience), perceptually uniform and colour-blind safe; the biggest share gets the deepest tone. */
const BATLOW = ["#031C5A", "#185562", "#577647", "#9A915B", "#CAAEAA", "#F8CAF6"];
function batlow(t) {
  const p = Math.min(0.9999, Math.max(0, t)) * (BATLOW.length - 1), i = Math.floor(p), f = p - i;
  const a = BATLOW[i].match(/\w\w/g).map((h) => parseInt(h, 16)), b = BATLOW[i + 1].match(/\w\w/g).map((h) => parseInt(h, 16));
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}
function squarify(vals, W, H) {
  const total = vals.reduce((s, v) => s + v, 0) || 1, areas = vals.map((v) => (v / total) * W * H), out = [];
  let x = 0, y = 0, w = W, h = H, row = [];
  const worst = (r, side) => { const s = r.reduce((p, q) => p + q, 0), mx = Math.max(...r), mn = Math.min(...r); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  const place = (r) => {
    const s = r.reduce((p, q) => p + q, 0);
    if (w >= h) { const rw = s / h; let yy = y; r.forEach((q) => { const rh = q / rw; out.push([x, yy, rw, rh]); yy += rh; }); x += rw; w -= rw; }
    else { const rh = s / w; let xx = x; r.forEach((q) => { const rw = q / rh; out.push([xx, y, rw, rh]); xx += rw; }); y += rh; h -= rh; }
  };
  areas.forEach((q) => { const side = Math.min(w, h); if (!row.length || worst([...row, q], side) <= worst(row, side)) row.push(q); else { place(row); row = [q]; } });
  if (row.length) place(row);
  return out;
}
function mixSquares(mix) {
  if (!mix.length) return "";
  const W = Math.max(240, (($("sitePanel") || {}).clientWidth || 340) - 28), rects = squarify(mix.map(([, v]) => v), W, W), n = mix.length;
  return `<div class="tm" style="width:${W}px;height:${W}px">${mix.map(([cat, v], i) => {
    const [x, y, w, h] = rects[i], c = batlow(n > 1 ? i / (n - 1) : 0), lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255, fg = lum > 0.55 ? "#14213d" : "#fff", name = cat.replace(/_/g, " ");
    const lines = h >= 66 ? 2 : 1, showName = w >= 44 && h >= 40, nf = Math.max(12, Math.min(20, Math.sqrt(w * h) / 6.2)).toFixed(1);
    return `<div class="tmc" style="left:${((x / W) * 100).toFixed(3)}%;top:${((y / W) * 100).toFixed(3)}%;width:${((w / W) * 100).toFixed(3)}%;height:${((h / W) * 100).toFixed(3)}%;background:rgb(${c});color:${fg}" title="${esc(name)} · ${fmt(v)} businesses">${showName ? `<b style="-webkit-line-clamp:${lines}">${esc(name)}</b>` : ""}${w >= 30 && h >= 20 ? `<span style="font-size:${nf}px">${compact(v)}</span>` : ""}</div>`;
  }).join("")}</div>`;
}


/* Population insights: the pyramid plus the numbers that explain it (all from the study's own model cells). Blue ramp matches the hexagon layers. */
function popInsights(s, pop, pyr, pmax) {
  const hx = D.hexes, n = hx.all.length, tot = pop.pop || 1;
  const kids = pop.k, youth = pop.y, work = pop.w, sen = pop.s;
  const sexRatio = pop.m ? Math.round((pop.f / pop.m) * 1000) : null, dep = (youth + work) ? Math.round(((kids + sen) / (youth + work)) * 100) : null;
  const under25 = ((kids + youth) / tot) * 100, dayChg = pop.pop ? ((pop.day_pop - pop.pop) / pop.pop) * 100 : 0;
  const cells = hx.all.map((i) => ({ i, p: hx.pop[i] || 0 })).sort((a, b) => b.p - a.p), topN = Math.max(1, Math.round(n * 0.1));
  const conc = (cells.slice(0, topN).reduce((t, c) => t + c.p, 0) / (cells.reduce((t, c) => t + c.p, 0) || 1)) * 100;
  const byLoc = {}; cells.forEach((c) => { const l = dec(hx.locality, c.i) || "Unnamed area"; byLoc[l] = (byLoc[l] || 0) + c.p; });
  const locs = Object.entries(byLoc).sort((a, b) => b[1] - a[1]).slice(0, 6), lmax = locs.length ? locs[0][1] : 1;
  const bands = [["Kids 0–14", kids, RAMP[3]], ["Youth 15–24", youth, RAMP[4]], ["Working 25–59", work, RAMP[6]], ["Seniors 60+", sen, RAMP[8]]];
  const tile = (v, l, tip) => `<div class="pi-tile"><b>${v}</b><span>${l}${tip ? info(tip) : ""}</span></div>`;
  return `<div class="section"><div class="section-title"><h4>Population insights${info("Who lives here and how they are spread. Male and female counts come from the age and sex shares applied to WorldPop 100 m counts. Dependency ratio is children plus seniors for every 100 people aged 15 to 59.")}</h4><span>${compact(tot)} residents</span></div>
    <div class="pi-tiles">${tile(sexRatio != null ? fmt(sexRatio) : "—", "females per 1,000 males", "Above 1,000 means more women than men.")}${tile(dep != null ? fmt(dep) : "—", "dependants per 100 adults", "Children under 15 plus seniors 60+, for every 100 people aged 15 to 59.")}
      ${tile(fmt(under25, 0) + "%", "under 25", "Share of residents aged 0 to 24. Higher means a younger area.")}${tile((dayChg >= 0 ? "+" : "") + fmt(dayChg, 0) + "%", "daytime vs night", "Daytime population compared with residents. Positive means more people are here by day (offices, colleges); negative means people leave to work elsewhere.")}</div>
    <div class="pi-sub">Age and sex</div>
    <div class="pyramid">${pyr.map(([l, m, f]) => `
      <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span class="pyr-val m">${compact(m)}</span><div class="pyr-bar m" style="width:${(m / pmax) * 100}%"></div></div>
      <div class="pyr-label">${l}</div>
      <div style="display:flex;align-items:center;gap:6px"><div class="pyr-bar f" style="width:${(f / pmax) * 100}%"></div><span class="pyr-val">${compact(f)}</span></div>`).join("")}</div>
    <div class="pi-legend"><span><i style="background:${RAMP[7]}"></i>Male</span><span><i style="background:${RAMP[4]}"></i>Female</span></div>
    <div class="pi-sub">Share of residents by age</div>
    <div class="pi-stack">${bands.map(([, v, c]) => `<div style="width:${(v / tot) * 100}%;background:${c}" title="${fmt((v / tot) * 100, 1)}%"></div>`).join("")}</div>
    <div class="pi-legend">${bands.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} ${fmt((v / tot) * 100, 0)}%</span>`).join("")}</div>
    <div class="pi-sub">Where people live${info("Residents summed over the map cells of each locality. The densest 10% of cells hold " + fmt(conc, 0) + "% of all residents.")}</div>
    ${locs.map(([l, v]) => `<div class="hbar"><span class="lbl">${esc(l)}</span><div class="track"><div class="fill" style="width:${(v / lmax) * 100}%;background:${RAMP[5]}"></div></div><span class="num">${compact(v)}</span></div>`).join("")}
    <div class="pi-note-row"><b>${fmt(conc, 0)}%</b> of residents live in the densest 10% of cells.</div></div>`;
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
      ${p.site_role === "area" ? `<div class="eyebrow">Search area · ${esc(String(s.radius_km))} km radius</div>
      <div class="note" style="margin-top:4px">${esc(B().format || "")}</div>` : `<div class="eyebrow">${esc(p.serial_no)} · ${esc(p.zone || "")} ZONE ${p.site_role !== "existing" ? '<span class="pass" style="background:var(--soft);color:var(--text-2)">PROSPECTIVE SITE</span>' : '<span class="pass">EXISTING OUTLET</span>'}</div>
      <div class="note" style="margin-top:4px">${esc(B().format || "")}</div>
      <div class="store-meta">
        <div>Locality<b>${esc(p.locality)}</b></div><div>Ward<b>${esc(p.ward)}</b></div>
        <div>Faces<b>${esc(p.corridor_name)}</b></div><div>Corridor<b>${esc((p.corridor_tier || "").replace("Designated ", ""))}</b></div>
        <div style="grid-column:1/3">Address<b>${esc(p.address || "—")}</b></div>
      </div>`}
    </div>
    ${p.site_assessment ? siteAssessment(p.site_assessment, p.site_role) : ""}
    <div class="kpi-grid">
      <div class="kpi"><div class="eyebrow">Residents · ${s.radius_km} km</div><div class="v">${compact(pop.pop)}</div><div class="s">${fmt(pop.pop / (Math.PI * s.radius_km ** 2))} per km²</div></div>
      <div class="kpi"><div class="eyebrow">Daytime population${info("Residents, minus people who commute out, plus people who work here.")}</div><div class="v">${compact(pop.day_pop)}</div><div class="s">${pop.pop ? (pop.day_pop >= pop.pop ? "+" : "−") + fmt(Math.abs(pop.day_pop / pop.pop - 1) * 100, 0) + "% vs residents" : ""}</div></div>
      ${p.site_role === "area" ? `
      <div class="kpi"><div class="eyebrow">Streets analysed</div><div class="v">${compact(D.streets.n)}</div><div class="s">modelled hour by hour</div></div>
      <div class="kpi"><div class="eyebrow">Suggested locations</div><div class="v">${fmt(ly.candidates.length)}</div><div class="s">busiest, spread apart</div></div>
      <div class="kpi"><div class="eyebrow">Direct competitors</div><div class="v">${fmt(direct.length)}</div><div class="s">in the whole area</div></div>
      <div class="kpi"><div class="eyebrow">Businesses mapped</div><div class="v">${compact(businesses)}</div><div class="s">in the whole area</div></div>` : `
      <div class="kpi"><div class="eyebrow">Walkshed footfall<span class="tag">MODEL</span></div><div class="v">${compact(rf.weekday_daily_footfall)}</div><div class="s">per street / weekday</div></div>
      <div class="kpi"><div class="eyebrow">Weekend surge<span class="tag">MODEL</span></div><div class="v">+${fmt(rf.weekend_surge_pct, 1)}%</div><div class="s">peak eve ${fmt(rf.peak_evening_hourly_flow)}/hr</div></div>
      <div class="kpi"><div class="eyebrow">Direct competitors</div><div class="v">${fmt(direct.length)}</div><div class="s">${direct15} within 1.5 km by road</div></div>
      <div class="kpi"><div class="eyebrow">Businesses mapped</div><div class="v">${compact(businesses)}</div><div class="s">F&amp;B share ${fmt(rf.f_and_b_share_pct, 1)}% in walkshed</div></div>`}
    </div>
    ${popInsights(s, pop, pyr, pmax)}
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
      ${mixSquares(mix)}
    <div class="note">Sources: OpenStreetMap, Overture Maps, ${pop.voters_registered ? "electoral-roll booth aggregates" : "WorldPop / Meta HRSL population"}, Overture buildings. Footfall, workforce and projections are modelled. Open “Data &amp; method” for details.</div>`;
  tidy($("sitePanel"), { fold: true, keepOpen: /corridor|competitor|assessment|benchmark|population insights/i });
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
function hmSwatch(m) { return m.kind === "cat" ? "linear-gradient(90deg," + Object.values(LANDUSE).slice(0, 7).join(",") + ")" : m.kind === "suit" ? "linear-gradient(90deg," + [...SUIT].reverse().map((s) => s[1]).join(",") + ")" : "linear-gradient(90deg," + hexRamp(m).join(",") + ")"; }
function hmRow(k, m) {
  const on = activeModes().includes(k);
  return `<div class="hmw"><button type="button" class="hm${on ? " on" : ""}" data-hm="${k}" aria-pressed="${on}"><span class="hm-sw" style="background:${hmSwatch(m)}"></span><span class="hm-l">${esc(m.label)}</span><span class="hm-t"></span></button><div class="hm-legend" data-hml="${k}"></div></div>`;
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
    <div class="layers-intro">Switch layers on as you need them.</div>
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
    <div class="hm-wrap" style="padding:2px 2px 4px"><div class="sub-label">Hexagon factors · switch on as many as you need</div><div class="hm-list">${Object.entries(HEX_MODES).filter(([k]) => hexAvail(k)).map(([k, m]) => hmRow(k, m)).join("")}</div>
       <div class="sub-label">Opacity</div><input type="range" min="15" max="90" value="${Math.round(S.hexOpacity * 100)}" data-range="hexOpacity" style="width:100%;accent-color:var(--text)"></div>
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
  tidy($("layersTab"));
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
  root.querySelectorAll("[data-hm]").forEach((b) => b.onclick = () => {
    const k = b.dataset.hm, ms = activeModes().slice(), at = ms.indexOf(k);
    if (at >= 0) ms.splice(at, 1); else ms.push(k);
    S.hexModes = ms; S.on.hexes = ms.length > 0; if (ms.length) S.hexMode = ms[ms.length - 1];
    renderHexLegend(); updateActiveCount(); updateGroupCounts(); redraw();
  });
  renderHexLegend();
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
  pane.innerHTML = weightsPanel(); bindWeights(); tidy(pane);
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
/* Report / PDF downloads are switched off everywhere (the server refuses them too). */
function paintPdf() {}
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
      <div class="cand-stats"><div>${UNIT()}<b>${fmt(c.projected_daily_units)}</b></div><div>₹ L/mo<b>${fmt(c.projected_monthly_revenue_lakhs, 1)}</b>${c.ci_rev_p10 != null ? `<small style="display:block;color:#6e6e73;font-weight:400">${fmt(c.ci_rev_p10, 1)}–${fmt(c.ci_rev_p90, 1)}</small>` : ""}</div>
        <div>Payback<b>${fmt(c.est_payback_months, 1)} mo</b></div><div>${c.ci_rev_p10 != null ? "Own-outlet loss" : "Risk"}<b>${fmt(c.cannibalization_risk_pct, 1)}%</b></div></div>
      <div class="cand-more"><div class="cand-bars">${[["DEMO", c.demographic_score], ["COMM", c.commercial_score], ["SYN", c.synergy_score], ["WHITE", c.white_space_score]].map(([l, v]) =>
        `<div class="cbar"><div class="l">${l} ${fmt(v, 0)}</div><div class="tr"><div style="width:${v}%;background-image:${scoreGradient(v)}"></div></div></div>`).join("")}</div>
      ${c.vs_site_pct != null ? `<div class="cand-persona" style="margin:2px 0 6px"><b style="color:${c.vs_site_pct >= 0 ? "#17653a" : "#b42318"}">${c.vs_site_pct >= 0 ? "+" : ""}${fmt(c.vs_site_pct, 0)}% vs your site</b> · ${c.dist_from_site_km} km away · ${fmt(c.footfall_vs_site, 1)}× its street footfall</div>` : ""}
      ${c.marginal_units != null ? `<div class="cand-persona" style="margin:2px 0 6px"><b>Pick #${c.plan_rank}</b> · adds ${fmt(c.marginal_units)} ${esc(UNIT())} to the network (total ${fmt(c.cumulative_units)})</div>` : ""}</div>
      <button type="button" class="cand-toggle" data-candtoggle aria-label="Show details">Details <i></i></button>
    </div>`).join("")}
    <div class="note"${["alternatives", "area"].includes(role) ? " hidden" : ""}>Candidates are restricted to the 10 busiest peak-hour shop fronts in the golden band (≥1.5 km apart; expressways and ramps excluded), then ranked by area score. Score = ${Math.round(w.demographic * 100)}% demographic + ${Math.round(w.commercial * 100)}% commercial + ${Math.round(w.synergy * 100)}% synergy + ${Math.round(w.white_space * 100)}% white space, each a percentile within the study area. ${esc(UNIT())} and revenue are heuristic projections from a baseline of ${fmt((B().economics || {}).baseline_daily_units)} ${esc((DEM().unit || "units"))}/day at ₹${fmt((B().economics || {}).avg_ticket_inr)} per bill; risk is the Huff-model share of the candidate’s 1.5 km demand pulled by the nearest existing outlet.</div>${(ly.candidates[0] || {}).ci_rev_lakhs != null ? ciNote() : ""}`;
  paintPdf();
  $("expansionTab").querySelectorAll("[data-cand]").forEach((el) => el.onclick = () => selectCandidate(el.dataset.cand, true));
  $("expansionTab").querySelectorAll("[data-candtoggle]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); b.closest(".cand").classList.toggle("open"); });
  tidy($("expansionTab"));
  $("expansionTab").querySelectorAll("[data-plan]").forEach((el) => el.onclick = () => openPlanPick(el.dataset.plan).catch(fail));
  $("showSuit").onclick = () => { S.hexMode = "suit_score"; S.hexModes = ["suit_score"]; S.on.hexes = true; S.hexOpacity = 0.7; S.openGroups.add("mesh"); buildHexScale(); renderLayersPanel(); renderHexLegend(); redraw(); };
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
document.addEventListener("input", (e) => {
  const box = e.target.closest && e.target.closest(".rng"); if (!box) return;
  const mk = box.dataset.rng, m = HEX_MODES[mk], [a, b] = hexSpan(mk);
  let lo = +box.querySelector(".lo").value, hi = +box.querySelector(".hi").value;
  if (lo > hi) { if (e.target.classList.contains("lo")) lo = hi; else hi = lo; }
  const val = (t) => a + (b - a) * t / 1000, full = lo <= 0 && hi >= 1000, f = (v) => m.pct ? fmt(v * 100, 0) + "%" : compact(v);
  S.hexRange[mk] = full ? null : [val(lo), val(hi)];
  document.querySelectorAll('.rng[data-rng="' + mk + '"]').forEach((bx) => { bx.querySelector(".lo").value = lo; bx.querySelector(".hi").value = hi; });
  document.querySelectorAll('[data-rv="' + mk + '"]').forEach((s) => { s.textContent = full ? "drag to filter" : "showing " + f(val(lo)) + " – " + f(val(hi)); });
  redraw();
});
function legendHtml(mk) {
  const m = HEX_MODES[mk];
  if (m.kind === "cat") return `<div class="eyebrow" style="margin-bottom:4px">${m.label}</div>` + Object.entries(LANDUSE).map(([k, c]) => `<span><i style="background:${c}"></i>${k.replace("_", " ")}</span>`).join("");
  if (m.kind === "suit") return `<div class="eyebrow" style="margin-bottom:4px">${m.label}</div>` + SUIT.map(([, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
  const sc = scaleFor(mk), b = sc.breaks, f = (v) => m.pct ? fmt(v * 100, 0) + "%" : compact(v);
  const [lo0, hi0] = hexSpan(mk), r = S.hexRange[mk] || [lo0, hi0], t = (v) => hi0 > lo0 ? Math.round(1000 * (v - lo0) / (hi0 - lo0)) : 0;
  return `<div class="legend-ramp"><div class="eyebrow" style="margin-bottom:4px">${m.label}</div><div class="ramp" style="background:linear-gradient(90deg,${hexRamp(m).join(",")})"></div>
    <div class="rng" data-rng="${mk}" title="Drag the handles to show only the hexagons in this range"><input type="range" class="lo" min="0" max="1000" value="${t(r[0])}" aria-label="Lowest value shown"><input type="range" class="hi" min="0" max="1000" value="${t(r[1])}" aria-label="Highest value shown"></div>
    <div class="ends"><span>${f(m.kind === "idx" ? 0 : sc.min)}</span><span class="rng-v" data-rv="${mk}">${S.hexRange[mk] ? "showing " + f(r[0]) + " – " + f(r[1]) : "drag to filter"}</span><span>${f(m.kind === "idx" ? 100 : sc.max)}</span></div></div>`;
}
function renderHexLegend() {
  const modes = activeModes(), el = $("hexLegend");
  document.querySelectorAll("[data-hm]").forEach((b) => { const on = modes.includes(b.dataset.hm); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  document.querySelectorAll("[data-hml]").forEach((d) => { const on = modes.includes(d.dataset.hml); d.innerHTML = on ? (() => { try { return legendHtml(d.dataset.hml); } catch (e) { return ""; } })() : ""; d.style.display = on ? "" : "none"; });
  el.innerHTML = modes.length ? modes.map((mk) => { try { return `<div class="hl-one">${legendHtml(mk)}</div>`; } catch (e) { return ""; } }).join("") : `<span style="color:var(--text-3)">Hexagon mesh hidden</span>`;
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
  const pv = D.site.provenance, src = pv.sources || {}, vm = pv.voter_model || {}, bz = B(), eco = bz.economics || {}, cp = bz.competitors || {}, rat = bz.rationale && (typeof bz.rationale === "string" ? bz.rationale.trim() : Object.keys(bz.rationale).length ? bz.rationale : null);
  const row = (a, b, c, tag) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td>${esc(c)}</td><td><span class="tag-m ${tag === "MODELLED" ? "mod" : "obs"}">${tag}</span></td></tr>`;
  const kv = (o) => Object.entries(o || {}).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ");
  $("methodBody").innerHTML = `<h2>${esc(bz.display_name || "Business")} · data &amp; method</h2>
    <div class="note">${esc(bz.format || "")}<br>Generated ${esc((pv.generated_at || "").slice(0, 16).replace("T", " "))} UTC · radius ${pv.radius_km} km</div>
    ${rat ? `<h3>Why the model is weighted this way</h3>${typeof rat === "string" ? `<div class="note" style="font-size:13px;line-height:1.5">${esc(rat)}</div>` : `<table>${Object.entries(rat).map(([k, v]) =>
      `<tr><td style="width:130px"><b>${esc(k.replace(/_/g, " "))}</b></td><td>${esc(typeof v === "string" ? v : JSON.stringify(v))}</td></tr>`).join("")}</table>`}` : ""}
    <h3>Read the full method</h3><div class="note" style="font-size:13px;line-height:1.7">Every step on this page is explained with diagrams in the <a href="whitepaper.html" target="_blank" rel="noopener"><b>white paper</b></a>:
      <a href="whitepaper.html#layers" target="_blank" rel="noopener">data layers</a> ·
      <a href="whitepaper.html#method" target="_blank" rel="noopener">methodology</a> ·
      <a href="whitepaper.html#revenue" target="_blank" rel="noopener">revenue calculator</a> ·
      <a href="whitepaper.html#uncertainty" target="_blank" rel="noopener">uncertainty</a></div>
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
  const on = new Set(["streets", "rings"]);   // global rule: only the footfall streets and the study rings load at start; every other layer is switched on by the user
  const cp = (site.business || {}).client_priorities;   // the customer's request-form answers: layers they scored 7+ (or listed brands for) start on
  if (false && cp) {   // client-priority auto-enable switched off by the global rule above
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
  // ---- icon rail: a full-height strip on the right edge; every major section is one icon, stacked top to bottom
  const TITLES = { layersTab: "Data layers", expansionTab: "Expansion", modelTab: "Model" };
  const SIC = [[/population/i, "apartment-complex"], [/corridor/i, "road"], [/competitor/i, "flag"], [/business mix/i, "shopping-bags"], [/assessment|benchmark/i, "star"], [/residents are counted|voters/i, "library"], [/./, "pin"]];
  const sIcon = (t) => (SIC.find(([r]) => r.test(t)) || [])[1];
  const svg = (n) => '<svg viewBox="0 0 16 16">' + ((typeof ICONS !== "undefined" && ICONS[n]) || "") + "</svg>";
  const rail = $("rail"), sp = $("sitePanel"), RP = $("rightPanel"), LP = $("leftPanel");
  rail.querySelectorAll("[data-ic]").forEach((s) => { s.setAttribute("viewBox", "0 0 16 16"); s.innerHTML = (typeof ICONS !== "undefined" && ICONS[s.dataset.ic]) || ""; });
  const head = document.querySelector("#rightPanel .panel-head .tabs");
  if (head && !$("rightTitle")) head.insertAdjacentHTML("beforebegin", '<div id="rightTitle">Data layers</div>');
  let cur = null;                                   // what the open panel shows: "site", a site-section key, or a right-panel tab id
  const secKey = (s) => { const h = s.querySelector(":scope > .section-title h4") || s.querySelector(":scope > .section-title"); if (!h) return ""; const c = h.cloneNode(true); c.querySelectorAll(".info").forEach((x) => x.remove()); return c.textContent.trim().replace(/\s*·.*$/, ""); };
  const buildSections = () => {
    rail.querySelectorAll("[data-sec]").forEach((b) => b.remove());
    const anchor = rail.querySelector('[data-rail="lg:foot"]');
    [...sp.querySelectorAll(":scope > .section")].forEach((s, i) => {
      const k = secKey(s); if (!k) return;
      s.dataset.sk = k;
      const b = document.createElement("button"); b.type = "button"; b.dataset.sec = k; b.dataset.rail = "sec"; b.title = k; b.setAttribute("aria-label", k); b.innerHTML = svg(sIcon(k));
      anchor.before(b); b.onclick = () => showRail("sec:" + k);
    });
    if (cur && cur.startsWith("sec:") && !sp.querySelector('[data-sk="' + CSS.escape(cur.slice(4)) + '"]')) showRail(null);
    railSync();
  };
  const GT = { foot: "Footfall & catchment", mesh: "Demand mesh", comp: "Competition, anchors & places", exp: "Expansion layers" };
  const showGroup = () => { const g = $("layersTab").dataset.solo; if (g) $("layersTab").querySelectorAll('details.lgroup[data-g="' + g + '"]').forEach((d) => { d.open = true; }); railSync(); };
  new MutationObserver(showGroup).observe($("layersTab"), { childList: true });
  const showRail = (k) => {
    cur = (k === cur) ? null : k;
    const left = cur === "site" || (cur || "").startsWith("sec:");
    if (!cur) { collapse("leftPanel", true); collapse("rightPanel", true); }
    else if (left) {
      collapse("rightPanel", true); collapse("leftPanel", false);
      const key = cur.slice(4);
      sp.dataset.solo = cur === "site" ? "overview" : "sec";
      sp.querySelectorAll(":scope > .section").forEach((s) => { const on = cur !== "site" && s.dataset.sk === key; s.classList.toggle("solo", on); if (on) s.classList.remove("closed"); });
      const ey = LP.querySelector(".eyebrow"); if (ey) ey.textContent = cur === "site" ? "SITE OVERVIEW" : key.toUpperCase();
      sp.scrollTop = 0;
    } else {
      collapse("leftPanel", true); collapse("rightPanel", false);
      const lg = cur.startsWith("lg:") ? cur.slice(3) : null, lt = $("layersTab");
      if (lg) { lt.dataset.solo = lg; showGroup(); } else delete lt.dataset.solo;
      const t = document.querySelector('.tab[data-tab="' + (lg ? "layersTab" : cur) + '"]'); if (t) t.click();
    }
    railSync();
  };
  function railSync() {
    rail.querySelectorAll("[data-rail],[data-sec]").forEach((b) => {
      const k = b.dataset.rail;
      b.classList.toggle("on", k === "site" ? cur === "site" : k === "sec" ? cur === "sec:" + b.dataset.sec : k === "legend" ? !$("legend").classList.contains("off") : k === "method" ? false : cur === k);
    });
    const tab = (document.querySelector(".tab.active") || {}).dataset?.tab;
    const lgk = $("layersTab").dataset.solo; if ($("rightTitle")) $("rightTitle").textContent = tab === "layersTab" && lgk ? GT[lgk] : TITLES[tab] || "Data layers";
    const mb = $("modelTabBtn"); if ($("railModel")) $("railModel").hidden = !mb || mb.style.display === "none";
    rail.querySelectorAll('[data-rail^="lg:"]').forEach((b) => { const em = $("layersTab").querySelector('[data-gcount="' + b.dataset.rail.slice(3) + '"]'), m = em && /^(\d+) of/.exec(em.textContent), sp = b.querySelector(".rail-n") || b.appendChild(Object.assign(document.createElement("span"), { className: "rail-n" })); sp.textContent = m && m[1] !== "0" ? m[1] : ""; });
  }
  window.railOpen = (tab) => { cur = null; showRail(tab); };
  rail.querySelectorAll("[data-rail]").forEach((b) => { const k = b.dataset.rail; if (k === "sec") return; b.onclick = () => {
    if (k === "legend") { $("legend").classList.toggle("off"); railSync(); }
    else if (k === "method") $("methodBtn").click();
    else showRail(k);
  }; });
  document.querySelectorAll("[data-collapse]").forEach((b) => b.addEventListener("click", () => { cur = null; railSync(); }));
  new MutationObserver(railSync).observe($("activeCount"), { childList: true, characterData: true, subtree: true });
  new MutationObserver(railSync).observe($("modelTabBtn"), { attributes: true, attributeFilter: ["style"] });
  new MutationObserver(() => { clearTimeout(window._rb); window._rb = setTimeout(buildSections, 60); }).observe(sp, { childList: true });
  collapse("leftPanel", true); collapse("rightPanel", true); buildSections();   // start with the map clear; the rail stays
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
      BIZ_IDS = biz.businesses.map((b) => b.id);
      const want = decodeURIComponent(location.hash.slice(1)).split("?")[0].split("/")[0];
      const bid = biz.businesses.some((b) => b.id === want) ? want : biz.businesses[biz.businesses.length - 1].id;
      await loadBusiness(bid);
      applyView(VIEW);
    } else {                                   // legacy single-business layout: data/sites.json
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
    if (bid && BIZ_IDS.includes(bid) && bid !== BIZ) { loadBusiness(bid).catch(fail); }
    else if (sid && sid !== S.siteId && [...$("siteSelect").options].some((o) => o.value === sid)) {
      $("siteSelect").value = sid; S.siteId = sid; loadSite(sid).catch(fail);
    }
  });
})();
function fail(e) { console.error(e); $("loaderText").innerHTML = `Could not load data: ${esc(e.message)}<br><small>Serve this folder over HTTP (see README) and run scripts/build_dashboard_data.py first.</small>`; }
