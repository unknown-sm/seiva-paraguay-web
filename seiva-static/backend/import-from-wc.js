// import-from-wc.js — Importa TODOS los productos desde WooCommerce (imagen + marca + precio + stock)
// Uso: node import-from-wc.js <wc_consumer_key> <wc_consumer_secret>
// Flags: --dry-run, --skip-images

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const WC_URL = "https://seiva.com.py/wp-json/wc/v3";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");
const IMAGES_DIR = process.env.IMAGES_DIR || path.join(__dirname, "img", "productos");

const [,, consumerKey, consumerSecret, ...flags] = process.argv;
const dryRun = flags.includes("--dry-run");
const skipImages = flags.includes("--skip-images");

if (!consumerKey || !consumerSecret) {
  console.error("Uso: node import-from-wc.js <consumer_key> <consumer_secret> [--dry-run] [--skip-images]");
  console.error("Claves en: WordPress Admin → WooCommerce → Settings → Advanced → REST API");
  process.exit(1);
}

const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

function downloadImage(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) { resolve(true); return; }
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "SeivaImport/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, dest).then(resolve);
      }
      if (res.statusCode !== 200) { resolve(false); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(true); });
    }).on("error", () => resolve(false));
  });
}

function slugify(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 60);
}

function inferSubcategoria(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes("magnesio")) return "magnesios";
  if (t.includes("omega")) return "omega3";
  if (t.includes("colageno") || t.includes("colágeno")) return "colagenos";
  if (t.includes("vitamina")) return "vitaminas";
  if (t.includes("creatina")) return "gym";
  if (t.includes("curcuma") || t.includes("cúrcuma")) return "naturales";
  if (t.includes("oregano") || t.includes("orégano")) return "aceites";
  if (t.includes("potasio")) return "minerales";
  if (t.includes("zinc")) return "minerales";
  if (t.includes("selenio")) return "minerales";
  if (t.includes("cromo")) return "minerales";
  if (t.includes("resveratrol")) return "antioxidantes";
  if (t.includes("probioticos")) return "probióticos";
  if (t.includes("ashwagandha")) return "adaptogenos";
  if (t.includes("shilajit") || t.includes("maca")) return "adaptogenos";
  if (t.includes("testosterona")) return "gym";
  if (t.includes("bcaa") || t.includes("carnitina")) return "gym";
  if (t.includes("ginkgo")) return "cognitivo";
  if (t.includes("nac") || t.includes("acetilcisteina")) return "cognitivo";
  if (t.includes("neumax")) return "cognitivo";
  if (t.includes("ozempic")) return "control-peso";
  if (t.includes("berberina")) return "control-peso";
  if (t.includes("calostro")) return "inmune";
  if (t.includes("reishi")) return "inmune";
  if (t.includes("combo")) return "combos";
  return "general";
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchAllWC(endpoint) {
  const all = [];
  let page = 1;
  while (true) {
    console.log(`  Fetching ${endpoint} page ${page}...`);
    const res = await fetch(`${WC_URL}/${endpoint}?per_page=100&page=${page}`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("API keys inválidas (401). Verificá las claves en WooCommerce.");
      throw new Error(`Error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    if (!data.length) break;
    all.push(...data);
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
    console.log(`    → ${data.length} items (total pages: ${totalPages})`);
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function main() {
  console.log("=== Importación WooCommerce → Seiva ===\n");

  console.log("1. Fetching WooCommerce products...");
  const wcProducts = await fetchAllWC("products");
  console.log(`   Found ${wcProducts.length} products\n`);

  console.log("2. Connecting to DB...");
  const db = new DatabaseSync(DB_PATH);
  const existing = db.prepare("SELECT COUNT(*) as c FROM productos").get().c;
  console.log(`   Existing products in DB: ${existing}\n`);

  if (dryRun) console.log("=== DRY RUN (sin cambios) ===\n");

  if (!skipImages) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  // Ensure columns exist
  const cols = [
    "categoria_id", "descripcion_larga", "galeria", "sku", "marca",
    "seo_descripcion", "crosssell", "upsell", "slug", "featured_order",
    "precio_proveedor", "delivery_gratis", "presentaciones"
  ];
  for (const col of cols) {
    try { db.exec(`ALTER TABLE productos ADD COLUMN ${col} ${col === 'galeria' || col === 'crosssell' || col === 'upsell' || col === 'presentaciones' ? "TEXT DEFAULT '[]'" : col === 'featured_order' || col === 'precio_proveedor' || col === 'delivery_gratis' ? "INTEGER DEFAULT 0" : "TEXT DEFAULT ''"}`); } catch (e) {}
  }

  const insertSQL = `INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, etiquetas, destacado, imagen, stock, activo, marca, slug, sku, created_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))`;
  // Simplified — use what we actually have
  const insertSimple = `INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, etiquetas, destacado, imagen, stock, activo, marca, slug, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`;

  const existingNames = new Set(
    db.prepare("SELECT nombre FROM productos").all().map(r => r.nombre)
  );

  console.log("3. Importing products...");
  let imported = 0, updated = 0, imagesOk = 0, imagesFail = 0;

  for (const wc of wcProducts) {
    const nombre = wc.name.trim();
    if (!nombre) continue;

    const precio = parseInt(wc.price) || 0;
    const precioRegular = parseInt(wc.regular_price) || 0;
    const precioSale = parseInt(wc.sale_price) || 0;
    const precioAnterior = (precioSale && precioSale < precioRegular) ? precioRegular : null;
    const stock = wc.stock_quantity || 0;
    const categoria = nombre.toLowerCase().includes("combo") ? "combos" : "suplementos";
    const subcategoria = inferSubcategoria(nombre);
    const descripcion = stripHtml(wc.description || "");
    const etiquetas = [];
    if (precioAnterior) etiquetas.push("oferta");
    if (wc.featured) etiquetas.push("popular");
    const slug = slugify(nombre);
    const sku = wc.sku || "";

    // Brand from first category
    let marca = "";
    if (wc.categories && wc.categories.length > 0) {
      const catName = wc.categories[0].name;
      if (catName && !catName.toLowerCase().includes("suplemento") && !catName.toLowerCase().includes("todos")) {
        marca = catName;
      }
    }

    // Image
    let imagenFile = "";
    if (wc.images && wc.images.length > 0) {
      const imgUrl = wc.images[0].src;
      const ext = imgUrl.split(".").pop().split("?")[0] || "jpg";
      imagenFile = slug + "." + ext;

      if (!skipImages && imagenFile) {
        const dest = path.join(IMAGES_DIR, imagenFile);
        if (!dryRun) {
          const ok = await downloadImage(imgUrl, dest);
          if (ok) imagesOk++;
          else { imagesFail++; imagenFile = ""; }
        } else {
          imagesOk++;
        }
      }
    }

    if (existingNames.has(nombre)) {
      // Update
      if (!dryRun) {
        db.prepare(`UPDATE productos SET precio=?, precio_anterior=?, stock=?, imagen=?, marca=?, slug=?, descripcion=?, subcategoria=? WHERE nombre=?`)
          .run(precio, precioAnterior, stock, imagenFile, marca, slug, descripcion, subcategoria, nombre);
      }
      updated++;
      continue;
    }

    // Insert
    if (!dryRun) {
      try {
        db.prepare(insertSimple).run(
          nombre, precio, precioAnterior, categoria, subcategoria,
          descripcion, JSON.stringify(etiquetas), wc.featured ? 1 : 0,
          imagenFile, stock, marca, slug, sku
        );
      } catch (e) {
        console.warn(`   Error: "${nombre}": ${e.message}`);
        continue;
      }
    }
    imported++;
    existingNames.add(nombre);
  }

  // Create brands from marca field
  console.log("4. Creating brands...");
  let brandsCreated = 0;
  if (!dryRun) {
    const products = db.prepare("SELECT DISTINCT marca FROM productos WHERE marca != '' AND marca IS NOT NULL").all();
    for (const p of products) {
      const existing = db.prepare("SELECT id FROM marcas WHERE nombre = ?").get(p.marca);
      if (!existing) {
        try {
          db.prepare("INSERT INTO marcas (nombre, logo) VALUES (?, ?)").run(p.marca, "");
          brandsCreated++;
        } catch (e) {}
      }
    }
  }

  console.log(`\n=== Resultados ===`);
  console.log(`  Importados: ${imported}`);
  console.log(`  Actualizados: ${updated}`);
  console.log(`  Imágenes OK: ${imagesOk}`);
  console.log(`  Imágenes fallidas: ${imagesFail}`);
  console.log(`  Marcas creadas: ${brandsCreated}`);
  console.log(`  Total en DB: ${existing + imported}`);

  const marcas = db.prepare("SELECT COUNT(*) as c FROM marcas").get().c;
  console.log(`  Marcas totales: ${marcas}`);

  db.close();
  console.log("\n¡Listo! Reiniciá el server.");
}

main().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
