/* Cities that have a published snapshot (data built by scripts/city_scan.py). Add an entry here and the city lights up on the
   City snapshots page, the coverage map and the menus. `full` is an optional long-form brief. Delhi is the default city. */
window.AGT_SNAPSHOTS = [
  { slug: "delhi", name: "Delhi", state: "Delhi (UT)", data: "site/city-delhi.json" },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", data: "site/city-lucknow.json" },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh", data: "site/city-kanpur.json", full: "city.html?c=kanpur" },
];
window.AGT_SNAPSHOT_DEFAULT = "delhi";
