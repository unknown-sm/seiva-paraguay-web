// sync-stock.js — Sincroniza stock desde WooCommerce a Seiva
// Uso: node sync-stock.js <wc_consumer_key> <wc_consumer_secret>
// Opcional: node sync-stock.js <wc_consumer_key> <wc_consumer_secret> --dry-run

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const WC_URL = "https://seiva.com.py/wp-json/wc/v3";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");

const [,,consumerKey, consumerSecret, dryFlag] = process.argv;
const dryRun = dryFlag === "--dry-run";

if (!consumerKey || !consumerSecret) {
  console.error("Uso: node sync-stock.js <wc_consumer_key> <wc_consumer_secret> [--dry-run]");
  console.error("Obtené las claves en: WordPress Admin → WooCommerce → Settings → Advanced → REST API");
  process.exit(1);
}

const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

async function fetchAllProducts() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${WC_URL}/products?per_page=100&page=${page}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Claves inválidas (401)");
      throw new Error(`Error ${res.status}`);
    }
    const data = await res.json();
    if (!data.length) break;
    all.push(...data);
    page++;
    console.log(`  Pagina ${page - 1}: ${data.length} productos`);
  }
  return all;
}

function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function sync() {
  console.log("Conectando a WooCommerce...");
  const wcProducts = await fetchAllProducts();
  console.log(`Total WC: ${wcProducts.length} productos`);

  const db = new DatabaseSync(DB_PATH);
  const ourProducts = db.prepare("SELECT id, nombre, slug, stock FROM productos WHERE activo = 1").all();
  console.log(`Total Seiva: ${ourProducts.length} productos\n`);

  if (dryRun) console.log("=== DRY RUN (sin cambios) ===\n");

  let matched = 0;
  let updated = 0;
  let noMatch = [];

  for (const wc of wcProducts) {
    const wcName = normalize(wc.name);
    const wcStock = wc.stock_quantity || 0;

    // Match by slug first
    let match = ourProducts.find(p => p.slug && normalize(p.slug) === normalize(wc.slug));

    // Then by name
    if (!match) {
      match = ourProducts.find(p => {
        const pn = normalize(p.nombre);
        return pn === wcName || pn.includes(wcName.substring(0, 20)) || wcName.includes(pn.substring(0, 20));
      });
    }

    if (match) {
      matched++;
      if (match.stock !== wcStock) {
        console.log(`  ${match.stock} → ${wcStock} | ${match.nombre.substring(0, 50)}`);
        if (!dryRun) {
          db.prepare("UPDATE productos SET stock = ? WHERE id = ?").run(wcStock, match.id);
        }
        updated++;
      }
    } else {
      noMatch.push(wc.name);
    }
  }

  console.log(`\nResultados:`);
  console.log(`  Coincidencias: ${matched}`);
  console.log(`  Stocks actualizados: ${updated}`);
  console.log(`  Sin coincidencia en Seiva: ${noMatch.length}`);
  if (noMatch.length > 0 && noMatch.length <= 20) {
    console.log("  Productos sin match:");
    noMatch.forEach(n => console.log(`    - ${n}`));
  }

  db.close();
}

sync().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
