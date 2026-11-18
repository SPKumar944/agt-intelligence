/* Cities that have a published snapshot (data built by scripts/city_scan.py). Add an entry here and the city lights up on the
   City snapshots page, the coverage map and the menus. `full` is an optional long-form brief. Delhi is the default city. */
window.AGT_SNAPSHOTS = [
  { slug: "delhi", name: "Delhi", state: "Delhi (UT)", data: "site/city-delhi.json", full: "city.html?c=delhi" },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", data: "site/city-ahmedabad.json", full: "city.html?c=ahmedabad" },
  { slug: "bhopal", name: "Bhopal", state: "Madhya Pradesh", data: "site/city-bhopal.json", full: "city.html?c=bhopal" },
  { slug: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", data: "site/city-bhubaneswar.json", full: "city.html?c=bhubaneswar" },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", data: "site/city-chennai.json", full: "city.html?c=chennai" },
  { slug: "faridabad", name: "Faridabad", state: "Haryana", data: "site/city-faridabad.json", full: "city.html?c=faridabad" },
  { slug: "guwahati", name: "Guwahati", state: "Assam", data: "site/city-guwahati.json", full: "city.html?c=guwahati" },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", data: "site/city-hyderabad.json", full: "city.html?c=hyderabad" },
  { slug: "indore", name: "Indore", state: "Madhya Pradesh", data: "site/city-indore.json", full: "city.html?c=indore" },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", data: "site/city-jaipur.json", full: "city.html?c=jaipur" },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh", data: "site/city-kanpur.json", full: "city.html?c=kanpur" },
  { slug: "kochi", name: "Kochi", state: "Kerala", data: "site/city-kochi.json", full: "city.html?c=kochi" },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", data: "site/city-kolkata.json", full: "city.html?c=kolkata" },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", data: "site/city-lucknow.json", full: "city.html?c=lucknow" },
  { slug: "ludhiana", name: "Ludhiana", state: "Punjab", data: "site/city-ludhiana.json", full: "city.html?c=ludhiana" },
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", data: "site/city-mumbai.json", full: "city.html?c=mumbai" },
  { slug: "nagpur", name: "Nagpur", state: "Maharashtra", data: "site/city-nagpur.json", full: "city.html?c=nagpur" },
  { slug: "patna", name: "Patna", state: "Bihar", data: "site/city-patna.json", full: "city.html?c=patna" },
  { slug: "pune", name: "Pune", state: "Maharashtra", data: "site/city-pune.json", full: "city.html?c=pune" },
  { slug: "raipur", name: "Raipur", state: "Chhattisgarh", data: "site/city-raipur.json", full: "city.html?c=raipur" },
  { slug: "ranchi", name: "Ranchi", state: "Jharkhand", data: "site/city-ranchi.json", full: "city.html?c=ranchi" },
  { slug: "surat", name: "Surat", state: "Gujarat", data: "site/city-surat.json", full: "city.html?c=surat" },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala", data: "site/city-thiruvananthapuram.json", full: "city.html?c=thiruvananthapuram" },
  { slug: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", data: "site/city-visakhapatnam.json", full: "city.html?c=visakhapatnam" },
];
window.AGT_SNAPSHOT_DEFAULT = "delhi";
