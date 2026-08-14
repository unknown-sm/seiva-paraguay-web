const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("node:sqlite3");

const DB_PATH = path.join(__dirname, "data", "database.sqlite");
const IMG_DIR = path.join(__dirname, "..", "img", "productos");
const OLD_SITE = "https://old.seiva.com.py";

// Fetch URL helper
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
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
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
}

// Extract image URLs from HTML
function extractImages(html) {
  const images = [];
  // Look for product gallery images
  const galleryRegex = /<img[^>]+src=["']([^"']+(?:\.jpg|\.jpeg|\.png|\.webp)[^"']*)["'][^>]*>/gi;
  let match;
  while ((match = galleryRegex.exec(html)) !== null) {
    let img = match[1];
    if (img.startsWith("//")) img = "https:" + img;
    if (img.startsWith("/")) img = OLD_SITE + img;
    if (!img.includes("logo") && !img.includes("placeholder") && !img.includes("avatar")) {
      images.push(img);
    }
  }
  return [...new Set(images)];
}

async function main() {
  const db = new sqlite3.DatabaseSync(DB_PATH);
  const products = db.prepare(
    "SELECT id, nombre, slug, imagen FROM productos WHERE activo = 1 AND (galeria = '[]' OR galeria IS NULL OR galeria = '')"
  ).all();

  console.log(`Products without gallery: ${products.length}`);

  let updated = 0;
  let errors = 0;

  for (const prod of products) {
    try {
      // Try to find product page on old site
      const slug = prod.slug || prod.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const urlsToTry = [
        `${OLD_SITE}/producto/${slug}/`,
        `${OLD_SITE}/${slug}/`,
        `https://old.seiva.com.py/?s=${encodeURIComponent(prod.nombre)}&post_type=product`,
      ];

      let galleryImages = [];

      for (const url of urlsToTry) {
        try {
          const html = await fetchUrl(url);
          const images = extractImages(html);
          if (images.length > 0) {
            galleryImages = images.slice(0, 5); // Max 5 images
            break;
          }
        } catch (e) {
          // Try next URL
        }
      }

      if (galleryImages.length === 0) {
        // If no gallery found, use main image as gallery
        if (prod.imagen) {
          const imgPath = path.join(IMG_DIR, prod.imagen);
          if (fs.existsSync(imgPath)) {
            db.prepare("UPDATE productos SET galeria = ? WHERE id = ?").run(JSON.stringify([prod.imagen]), prod.id);
            updated++;
            console.log(`  #${prod.id} ${prod.nombre}: using main image as gallery`);
            continue;
          }
        }
        console.log(`  #${prod.id} ${prod.nombre}: no images found`);
        continue;
      }

      // Download and save gallery images
      const savedImages = [];
      for (let i = 0; i < galleryImages.length; i++) {
        const imgUrl = galleryImages[i];
        const ext = path.extname(new URL(imgUrl).pathname) || ".jpg";
        const filename = `gallery-${prod.id}-${i}${ext}`;
        const destPath = path.join(IMG_DIR, filename);

        try {
          await downloadFile(imgUrl, destPath);
          savedImages.push(filename);
        } catch (e) {
          console.log(`    Failed to download: ${imgUrl} - ${e.message}`);
        }
      }

      if (savedImages.length > 0) {
        db.prepare("UPDATE productos SET galeria = ? WHERE id = ?").run(JSON.stringify(savedImages), prod.id);
        updated++;
        console.log(`  #${prod.id} ${prod.nombre}: ${savedImages.length} gallery images added`);
      }
    } catch (e) {
      errors++;
      console.log(`  #${prod.id} ${prod.nombre}: ERROR - ${e.message}`);
    }

    // Small delay to not overwhelm the server
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);
  db.close();
}

main().catch(console.error);
