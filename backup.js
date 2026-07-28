// backup.js — Descarga toda la data del server antes de borrarlo
// Uso: node backup.js
// Genera carpeta backup-YYYY-MM-DD/ con toda la data en JSON + imágenes

const fs = require("fs");
const path = require("path");
const https = require("https");

const BASE = "https://server-seiva-web-latest.zwpkae.easypanel.host";
const API = BASE + "/api";
const ADMIN_PASSWORD = process.argv[2] || "SeivaAguacate2026!";

const BACKUP_DIR = "backup-" + new Date().toISOString().slice(0, 10);
fs.mkdirSync(path.join(BACKUP_DIR, "img"), { recursive: true });

let TOKEN = "";

async function fetchAPI(endpoint, method, body) {
  const opts = {
    method: method || "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (TOKEN) opts.headers["Authorization"] = "Bearer " + TOKEN;
  if (body) opts.body = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const url = new URL(API + endpoint);
    const req = https.request(url, opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function saveJSON(filename, data) {
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(data, null, 2));
  console.log("  " + filename + " (" + (Array.isArray(data) ? data.length + " items" : "OK") + ")");
}

async function downloadImage(imgUrl, filename) {
  if (!imgUrl || imgUrl.startsWith("data:")) return;
  const url = imgUrl.startsWith("http") ? imgUrl : BASE + "/img/productos/" + imgUrl;
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      https.get(u, (res) => {
        if (res.statusCode !== 200) return resolve();
        const file = fs.createWriteStream(path.join(BACKUP_DIR, "img", filename));
        res.pipe(file);
        file.on("finish", () => resolve());
      }).on("error", () => resolve());
    } catch {
      resolve();
    }
  });
}

async function backup() {
  console.log("Conectando a " + BASE + "...\n");

  // Login
  const auth = await fetchAPI("/auth/login", "POST", { password: ADMIN_PASSWORD });
  if (!auth.token) {
    console.error("ERROR: No se pudo autenticar. Revisá la contraseña.");
    process.exit(1);
  }
  TOKEN = auth.token;
  console.log(" Autenticado OK\n");

  // Productos
  console.log("Productos...");
  const productos = await fetchAPI("/productos/all");
  saveJSON("productos.json", productos);

  // Pedidos
  console.log("Pedidos...");
  const pedidos = await fetchAPI("/pedidos");
  saveJSON("pedidos.json", pedidos);

  // Ventas
  console.log("Ventas...");
  const ventas = await fetchAPI("/ventas?limit=9999");
  saveJSON("ventas.json", ventas);

  // Marcas
  console.log("Marcas...");
  const marcas = await fetchAPI("/marcas/all");
  saveJSON("marcas.json", marcas);

  // Descuentos
  console.log("Descuentos...");
  const descuentos = await fetchAPI("/descuentos");
  saveJSON("descuentos.json", descuentos);

  // Descuentos por marca
  console.log("Descuentos por marca...");
  const descMarca = await fetchAPI("/descuentos-marca");
  saveJSON("descuentos_marca.json", descMarca);

  // Promos
  console.log("Promos...");
  const promos = await fetchAPI("/promos/all");
  saveJSON("promos.json", promos);

  // Bundles
  console.log("Bundles...");
  const bundles = await fetchAPI("/bundles/all");
  saveJSON("bundles.json", bundles);

  // Categorías
  console.log("Categorías...");
  const categorias = await fetchAPI("/categorias");
  saveJSON("categorias.json", categorias);

  // Envíos
  console.log("Envíos...");
  const envios = await fetchAPI("/envios/all");
  saveJSON("envios.json", envios);

  // Contenido
  console.log("Contenido...");
  const contenido = await fetchAPI("/contenido");
  saveJSON("contenido.json", contenido);

  // Páginas
  console.log("Páginas...");
  const paginas = await fetchAPI("/paginas");
  saveJSON("paginas.json", paginas);

  // Carritos
  console.log("Carritos...");
  const carritos = await fetchAPI("/carritos");
  saveJSON("carritos.json", carritos);

  // Imágenes de productos
  console.log("\nImágenes (" + productos.length + " productos)...");
  let imgCount = 0;
  for (const p of productos) {
    if (p.imagen) {
      const filename = p.imagen.split("/").pop() || ("producto-" + p.id + ".jpg");
      await downloadImage(p.imagen, filename);
      imgCount++;
      if (imgCount % 20 === 0) console.log("  " + imgCount + "/" + productos.length);
    }
  }
  console.log("  " + imgCount + " imágenes descargadas");

  // Resumen
  const summary = {
    fecha: new Date().toISOString(),
    servidor: BASE,
    productos: productos.length,
    pedidos: pedidos.length,
    ventas: ventas.length,
    marcas: marcas.length,
    promos: promos.length,
    bundles: bundles.length,
    imagenes: imgCount,
  };
  saveJSON("summary.json", summary);

  console.log("\n Backup completo en: " + BACKUP_DIR);
  console.log("Subí esta carpeta a Google Drive, Mega o GitHub privado.");
}

backup().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
