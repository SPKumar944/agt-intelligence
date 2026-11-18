/* Cities that have a published snapshot (data built by scripts/city_scan.py). Add an entry here and the city lights up on the
   City snapshots page, the coverage map and the menus. `full` is an optional long-form brief. Delhi is the default city. */
window.AGT_SNAPSHOTS = [
  { slug: "delhi", name: "Delhi", state: "Delhi (UT)", data: "site/city-delhi.json", full: "city.html?c=delhi" },
  { slug: "bhopal", name: "Bhopal", state: "Madhya Pradesh", data: "site/city-bhopal.json", full: "city.html?c=bhopal" },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", data: "site/city-chennai.json", full: "city.html?c=chennai" },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", data: "site/city-hyderabad.json", full: "city.html?c=hyderabad" },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", data: "site/city-jaipur.json", full: "city.html?c=jaipur" },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh", data: "site/city-kanpur.json", full: "city.html?c=kanpur" },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", data: "site/city-kolkata.json", full: "city.html?c=kolkata" },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", data: "site/city-lucknow.json", full: "city.html?c=lucknow" },
  { slug: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", data: "site/city-visakhapatnam.json", full: "city.html?c=visakhapatnam" },
];
window.AGT_SNAPSHOT_DEFAULT = "delhi";
