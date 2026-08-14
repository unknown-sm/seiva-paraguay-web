const https = require("https");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "database.sqlite");

// WooCommerce credentials
const WC_KEY = "ck_99a6d8ff37953b954906c79e6263de62ff4d16b0";
const WC_SECRET = "cs_97b9d6f47e305f88b8fa19e91ee3e33dd6815296";
const WC_URL = "https://old.seiva.com.py/wp-json/wc/v3";
const AUTH = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64");

function fetchWC(endpoint, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = `${WC_URL}${endpoint}`;
    const req = https.get(url, {
      headers: { "Authorization": `Basic ${AUTH}`, "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    }, (res) => {
      if (res.statusCode !== 200) {
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`)));
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function normalize(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const db = new DatabaseSync(DB_PATH);

  // Get products with empty or short descriptions
  const products = db.prepare(
    "SELECT id, nombre, slug, descripcion, descripcion_larga FROM productos WHERE activo = 1"
  ).all();

  console.log(`Total products: ${products.length}`);

  // Fetch all WC products
  console.log("Fetching from WooCommerce...");
  let wcProducts = [];
  let page = 1;
  while (true) {
    const batch = await fetchWC(`/products?per_page=10&page=${page}`);
    if (batch.length === 0) break;
    wcProducts = wcProducts.concat(batch);
    page++;
    if (page > 20) break; // Max 200 products
  }
  console.log(`Got ${wcProducts.length} WC products`);

  // Build name -> WC map
  const wcByName = {};
  wcProducts.forEach(p => {
    const key = normalize(p.name);
    wcByName[key] = p;
  });

  let updated = 0;

  for (const prod of products) {
    const key = normalize(prod.nombre);
    const wcProd = wcByName[key];

    if (!wcProd) {
      console.log(`  #${prod.id} ${prod.nombre}: no WC match`);
      continue;
    }

    const shortDesc = wcProd.short_description || "";
    const longDesc = wcProd.description || "";

    // Update if WC has descriptions and ours is empty/short
    const currentDesc = prod.descripcion || "";
    const currentLongDesc = prod.descripcion_larga || "";

    if ((shortDesc && shortDesc !== currentDesc) || (longDesc && longDesc !== currentLongDesc)) {
      db.prepare("UPDATE productos SET descripcion = ?, descripcion_larga = ? WHERE id = ?")
        .run(shortDesc, longDesc, prod.id);
      updated++;
      console.log(`  #${prod.id} ${prod.nombre}: description updated`);
    }
  }

  console.log(`\nDone! Updated: ${updated}`);
  db.close();
}

main().catch(console.error);
