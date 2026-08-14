const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "database.sqlite");
const IMG_DIR = path.join(__dirname, "..", "img", "productos");
const WP_API = "https://old.seiva.com.py/wp-json/wp/v2";

// Fetch URL helper
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON from " + url)); }
      });
    }).on("error", reject);
  });
}

// Download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

async function main() {
  const db = new DatabaseSync(DB_PATH);

  // Get products without gallery
  const products = db.prepare(
    "SELECT id, nombre, slug, imagen FROM productos WHERE activo = 1 AND (galeria = '[]' OR galeria IS NULL OR galeria = '')"
  ).all();

  console.log(`Products without gallery: ${products.length}`);

  // Get all WP products
  console.log("Fetching products from WordPress...");
  let wpProducts = [];
  try {
    wpProducts = await fetchJson(`${WP_API}/product?per_page=100&_embed=true`);
    if (wpProducts.length === 100) {
      const page2 = await fetchJson(`${WP_API}/product?per_page=100&page=2&_embed=true`);
      wpProducts = wpProducts.concat(page2);
    }
  } catch (e) {
    console.error("Failed to fetch WP products:", e.message);
    process.exit(1);
  }
  console.log(`WordPress products: ${wpProducts.length}`);

  // Build slug -> WP product map
  const wpBySlug = {};
  wpProducts.forEach(p => { wpBySlug[p.slug] = p; });

  let updated = 0;
  let errors = 0;
  let noMatch = 0;

  for (const prod of products) {
    try {
      const slug = prod.slug || prod.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const wpProd = wpBySlug[slug];

      if (!wpProd) {
        noMatch++;
        continue;
      }

      const galleryImages = [];

      // Get featured image
      if (wpProd.featured_media && wpProd._embedded && wpProd._embedded["wp:featuredmedia"]) {
        for (const media of wpProd._embedded["wp:featuredmedia"]) {
          if (media.source_url) {
            try {
              const ext = path.extname(new URL(media.source_url).pathname) || ".jpg";
              const filename = `wp-${prod.id}-${galleryImages.length}${ext}`;
              const destPath = path.join(IMG_DIR, filename);
              await downloadFile(media.source_url, destPath);
              galleryImages.push(filename);
            } catch (e) {
              console.log(`  Failed to download featured: ${e.message}`);
            }
          }
        }
      }

      // Get gallery images from WP meta or additional media
      if (wpProd.meta) {
        const galleryMeta = wpProd.meta.find(m => m.key === "_product_image_gallery");
        if (galleryMeta && galleryMeta.value) {
          const galleryIds = galleryMeta.value.split(",").map(s => s.trim()).filter(Boolean);
          for (const mediaId of galleryIds) {
            try {
              const media = await fetchJson(`${WP_API}/media/${mediaId}`);
              if (media.source_url) {
                const ext = path.extname(new URL(media.source_url).pathname) || ".jpg";
                const filename = `wp-${prod.id}-gallery-${galleryImages.length}${ext}`;
                const destPath = path.join(IMG_DIR, filename);
                await downloadFile(media.source_url, destPath);
                galleryImages.push(filename);
              }
            } catch (e) {
              // Skip failed gallery images
            }
          }
        }
      }

      if (galleryImages.length > 0) {
        db.prepare("UPDATE productos SET galeria = ? WHERE id = ?").run(JSON.stringify(galleryImages), prod.id);
        updated++;
        console.log(`  #${prod.id} ${prod.nombre}: ${galleryImages.length} images from WP`);
      } else {
        noMatch++;
      }
    } catch (e) {
      errors++;
      console.log(`  #${prod.id} ${prod.nombre}: ERROR - ${e.message}`);
    }

    // Small delay
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone! Updated: ${updated}, No match: ${noMatch}, Errors: ${errors}`);
  db.close();
}

main().catch(console.error);
