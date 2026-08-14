const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "database.sqlite");
const IMG_DIR = path.join(__dirname, "img", "productos");

fs.mkdirSync(IMG_DIR, { recursive: true });

function fetchJson(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
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
    if (url.includes("seiva.com.py/wp-content") && !url.includes("old.seiva.com.py")) {
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

  // Get all WP products with embedded media
  console.log("Fetching from WordPress...");
  let wpProducts = [];
  try {
    wpProducts = await fetchJson("https://old.seiva.com.py/wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia");
    console.log(`Got ${wpProducts.length} products`);
  } catch (e) {
    console.error("Failed to fetch WP products:", e.message);
    process.exit(1);
  }

  const wpBySlug = {};
  wpProducts.forEach(p => { wpBySlug[p.slug] = p; });

  let updated = 0;
  let noImage = 0;

  for (const prod of products) {
    const slug = prod.slug || prod.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const wpProd = wpBySlug[slug];

    if (!wpProd) {
      console.log(`  #${prod.id} ${prod.nombre}: no WP match`);
      noImage++;
      continue;
    }

    const galleryImages = [];

    // Download featured image
    if (wpProd.featured_media && wpProd._embedded && wpProd._embedded["wp:featuredmedia"]) {
      for (const media of wpProd._embedded["wp:featuredmedia"]) {
        if (media.source_url) {
          try {
            const ext = path.extname(new URL(media.source_url).pathname) || ".jpg";
            const filename = `wp-${prod.id}-${galleryImages.length}${ext}`;
            const destPath = path.join(IMG_DIR, filename);
            await downloadFile(media.source_url, destPath);
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
