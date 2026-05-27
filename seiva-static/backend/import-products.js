const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const DB_PATH = process.env.DB_PATH || "/app/data/database.sqlite";
const IMAGES_DIR = process.env.IMAGES_DIR || "/app/public/productos";
const db = new DatabaseSync(DB_PATH);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadImage(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) { resolve(true); return; }
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(dest); resolve(false); return; }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(true); });
    }).on("error", () => { file.close(); if (fs.existsSync(dest)) fs.unlinkSync(dest); resolve(false); });
  });
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
}

function inferSubcategory(title) {
  const t = title.toLowerCase();
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

const raw = fs.readFileSync(process.env.PRODUCTS_JSON || "/tmp/products.json", "utf8");
const products = JSON.parse(raw);

ensureDir(IMAGES_DIR);

const insert = db.prepare(`
  INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, etiquetas, destacado, imagen, stock, activo, creado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const existing = db.prepare("SELECT nombre FROM productos").all();
const existingNames = new Set(existing.map(r => r.nombre));

let imported = 0;
let skipped = 0;

(async () => {
  for (const p of products) {
    if (existingNames.has(p.post_title)) { skipped++; continue; }
    
    const subcat = inferSubcategory(p.post_title);
    const imagenFile = p.image_guid ? slugify(p.post_title) + ".webp" : "";
    const imagenPath = imagenFile ? path.join(IMAGES_DIR, imagenFile) : "";
    
    if (p.image_guid && imagenPath) {
      await downloadImage(p.image_guid, imagenPath);
    }
    
    const precio = parseInt(p.price) || 0;
    const precioAnterior = (p.sale_price && parseInt(p.sale_price) !== precio) ? parseInt(p.sale_price) : null;
    const etiquetas = precioAnterior ? JSON.stringify(["oferta"]) : JSON.stringify([]);
    
    insert.run(
      p.post_title,
      precio,
      precioAnterior,
      "suplementos",
      subcat,
      p.description || "",
      etiquetas,
      0, // not destacado by default
      imagenFile,
      50,
      1
    );
    imported++;
  }
  
  console.log(`Importado: ${imported}, Saltado (duplicado): ${skipped}, Total en DB: ${existing.length + imported}`);
})();
