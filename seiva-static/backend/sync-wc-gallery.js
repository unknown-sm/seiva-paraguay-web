const https = require("https");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "database.sqlite");
const IMG_DIR = path.join(__dirname, "img", "productos");
fs.mkdirSync(IMG_DIR, { recursive: true });

// WooCommerce credentials
const WC_KEY = "ck_99a6d8ff37953b954906c79e6263de62ff4d16b0";
const WC_SECRET = "cs_97b9d6f47e305f88b8fa19e91ee3e33dd6815296";
const WC_URL = "https://old.seiva.com.py/wp-json/wc/v3";
const AUTH = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64");

function fetchWC(endpoint, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const url = `${WC_URL}${endpoint}`;
    const req = https.get(url, {
      headers: {
        "Authorization": `Basic ${AUTH}`,
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
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

function downloadFile(url, dest, timeout = 30000) {
  return new Promise((resolve, reject) => {
    // Fix domain: WC returns seiva.com.py but images are on old.seiva.com.py
    if (url.includes("seiva.com.py") && !url.includes("old.seiva.com.py")) {
      url = url.replace("seiva.com.py", "old.seiva.com.py");
    }
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function main() {
  const db = new DatabaseSync(DB_PATH);
  const products = db.prepare(
    "SELECT id, nombre, slug, imagen FROM productos WHERE activo = 1 AND (galeria = '[]' OR galeria IS NULL OR galeria = '')"
  ).all();

  console.log(`Products without gallery: ${products.length}`);

  // Get all WooCommerce products
  console.log("Fetching from WooCommerce...");
  let wcProducts = [];
  try {
    wcProducts = await fetchWC("/products?per_page=100");
    if (wcProducts.length === 100) {
      const page2 = await fetchWC("/products?per_page=100&page=2");
      wcProducts = wcProducts.concat(page2);
    }
    console.log(`Got ${wcProducts.length} products`);
  } catch (e) {
    console.error("Failed to fetch WC products:", e.message);
    process.exit(1);
  }

  // Build slug -> WC product map
  const wcBySlug = {};
  wcProducts.forEach(p => { wcBySlug[p.slug] = p; });

  let updated = 0;
  let noImage = 0;

  // Clean up previously broken downloads
  const existingFiles = fs.readdirSync(IMG_DIR).filter(f => f.startsWith("wc-"));
  for (const f of existingFiles) {
    const fp = path.join(IMG_DIR, f);
    const stats = fs.statSync(fp);
    if (stats.size < 1000) { // Less than 1KB = probably broken
      fs.unlinkSync(fp);
    }
  }

  for (const prod of products) {
    const slug = prod.slug || prod.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const wcProd = wcBySlug[slug];

    if (!wcProd) {
      console.log(`  #${prod.id} ${prod.nombre}: no WC match`);
      noImage++;
      continue;
    }

    const galleryImages = [];

    // Download featured image
    if (wcProd.images && wcProd.images.length > 0) {
      for (let i = 0; i < wcProd.images.length; i++) {
        const img = wcProd.images[i];
        if (img.src) {
          try {
            const ext = path.extname(new URL(img.src).pathname) || ".jpg";
            const filename = `wc-${prod.id}-${i}${ext}`;
            const destPath = path.join(IMG_DIR, filename);
            await downloadFile(img.src, destPath);
            galleryImages.push(filename);
            console.log(`  #${prod.id} downloaded: ${filename}`);
          } catch (e) {
            console.log(`  #${prod.id} failed: ${e.message}`);
          }
        }
      }
    }

    if (galleryImages.length > 0) {
      db.prepare("UPDATE productos SET galeria = ? WHERE id = ?").run(JSON.stringify(galleryImages), prod.id);
      updated++;
    } else {
      noImage++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, No image: ${noImage}`);
  db.close();
}

main().catch(console.error);
