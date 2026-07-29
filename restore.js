// restore.js — Restaura backup a una instalación nueva de Seiva
// Uso: node restore.js backup-YYYY-MM-DD
// Debe ejecutarse DESDE el directorio seiva-static/backend/
// Requiere: carpeta backup-YYYY-MM-DD/ con los JSON + img/

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = process.argv[2];
if (!BACKUP_DIR || !fs.existsSync(BACKUP_DIR)) {
  console.error("Uso: node restore.js <carpeta-backup>");
  console.error("Ejemplo: node restore.js backup-2026-01-01");
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");
const DB_DIR = path.dirname(DB_PATH);
const IMG_DIR = process.env.IMG_DIR || path.join(__dirname, "img", "productos");

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

function readJSON(name) {
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function restore() {
  console.log("Restaurando desde: " + BACKUP_DIR + "\n");

  // 1. Contenido
  const contenido = readJSON("contenido.json");
  if (contenido) {
    console.log("1/11 Contenido (" + Object.keys(contenido).length + " keys)");
    const stmt = db.prepare("INSERT OR REPLACE INTO contenido (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(contenido)) {
      if (typeof value === "string") stmt.run(key, value);
    }
  }

  // 2. Categorías
  const categorias = readJSON("categorias.json");
  if (categorias && categorias.length) {
    console.log("2/11 Categorías (" + categorias.length + ")");
    const stmt = db.prepare("INSERT INTO categorias (id, nombre, slug, descripcion, activo) VALUES (?, ?, ?, ?, ?)");
    for (const c of categorias) stmt.run(c.id, c.nombre, c.slug, c.descripcion || "", c.activo ? 1 : 0);
  }

  // 3. Marcas
  const marcas = readJSON("marcas.json");
  if (marcas && marcas.length) {
    console.log("3/11 Marcas (" + marcas.length + ")");
    const stmt = db.prepare("INSERT INTO marcas (id, nombre, prioridad, activo) VALUES (?, ?, ?, ?)");
    for (const m of marcas) stmt.run(m.id, m.nombre, m.prioridad || 0, m.activo !== false ? 1 : 0);
  }

  // 4. Productos
  const productos = readJSON("productos.json");
  if (productos && productos.length) {
    console.log("4/11 Productos (" + productos.length + ")");
    const stmt = db.prepare(`INSERT INTO productos (id, nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell, slug, featured_order, precio_proveedor, delivery_gratis, presentaciones, galeria)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of productos) {
      stmt.run(
        p.id, p.nombre, p.precio, p.precio_anterior || null, p.categoria, p.subcategoria || "",
        p.descripcion || "", p.descripcion_larga || "",
        JSON.stringify(p.etiquetas || []), p.destacado ? 1 : 0,
        p.imagen || "", p.stock || 0, p.activo !== false ? 1 : 0,
        p.categoria_id || null, p.sku || "", p.marca || "", p.seo_descripcion || "",
        JSON.stringify(p.crosssell || []), JSON.stringify(p.upsell || []),
        p.slug || "", p.featured_order || 0, p.precio_proveedor || null,
        p.delivery_gratis ? 1 : 0,
        JSON.stringify(p.variantes || p.presentaciones || []),
        JSON.stringify(p.galeria || [])
      );
    }
  }

  // 5. Descuentos
  const descuentos = readJSON("descuentos.json");
  if (descuentos && descuentos.length) {
    console.log("5/11 Descuentos (" + descuentos.length + ")");
    const stmt = db.prepare("INSERT INTO descuentos_cantidad (producto_id, min_cantidad, max_cantidad, descuento, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const d of descuentos) {
      stmt.run(d.producto_id, d.min_cantidad, d.max_cantidad || null, d.descuento,
        d.audiencia || "todos", d.tipo_descuento || "monto_fijo",
        d.fecha_inicio || null, d.fecha_fin || null, d.etiqueta || "");
    }
  }

  // 6. Descuentos por marca
  const descMarca = readJSON("descuentos_marca.json");
  if (descMarca && descMarca.length) {
    console.log("6/11 Descuentos marca (" + descMarca.length + ")");
    const stmt = db.prepare("INSERT INTO descuentos_marca (marca_id, tipo_descuento, valor, min_cantidad, max_cantidad, exclusiones, inclusiones, fecha_inicio, fecha_fin, etiqueta, audiencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const d of descMarca) {
      stmt.run(d.marca_id, d.tipo_descuento || "monto_fijo", d.valor || 0,
        d.min_cantidad || 1, d.max_cantidad || null,
        JSON.stringify(d.exclusiones || []), JSON.stringify(d.inclusiones || []),
        d.fecha_inicio || null, d.fecha_fin || null, d.etiqueta || "", d.audiencia || "todos");
    }
  }

  // 7. Promos
  const promos = readJSON("promos.json");
  if (promos && promos.length) {
    console.log("7/11 Promos (" + promos.length + ")");
    const stmt = db.prepare("INSERT INTO promos (id, tipo, nombre, producto_id, marca_id, compra_min_cantidad, compra_min_monto, regala_cantidad, regala_producto_id, descuento_valor, descuento_tipo, cupon_codigo, cupon_usos_max, fecha_inicio, fecha_fin, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const p of promos) stmt.run(p.id, p.tipo, p.nombre, p.producto_id || null, p.marca_id || null,
      p.compra_min_cantidad || 1, p.compra_min_monto || 0, p.regala_cantidad || 0, p.regala_producto_id || null,
      p.descuento_valor || 0, p.descuento_tipo || "monto_fijo", p.cupon_codigo || null, p.cupon_usos_max || null,
      p.fecha_inicio || null, p.fecha_fin || null, p.activo !== false ? 1 : 0);
  }

  // 8. Bundles
  const bundles = readJSON("bundles.json");
  if (bundles && bundles.length) {
    console.log("8/11 Bundles (" + bundles.length + ")");
    const stmt = db.prepare("INSERT INTO bundles (id, nombre, productos, precio_bundle, descuento_porcentaje, activo) VALUES (?, ?, ?, ?, ?, ?)");
    for (const b of bundles) stmt.run(b.id, b.nombre, JSON.stringify(b.productos || []), b.precio_bundle || 0, b.descuento_porcentaje || 0, b.activo !== false ? 1 : 0);
  }

  // 9. Envíos
  const envios = readJSON("envios.json");
  if (envios && envios.length) {
    console.log("9/11 Envíos (" + envios.length + ")");
    const stmt = db.prepare("INSERT INTO envios (id, ciudad, departamento, costo, activo, tipo) VALUES (?, ?, ?, ?, ?, ?)");
    for (const e of envios) stmt.run(e.id, e.ciudad, e.departamento || "", e.costo || 0, e.activo !== false ? 1 : 0, e.tipo || "delivery");
  }

  // 10. Pedidos
  const pedidos = readJSON("pedidos.json");
  if (pedidos && pedidos.length) {
    console.log("10/11 Pedidos (" + pedidos.length + ")");
    const stmt = db.prepare("INSERT INTO pedidos (id, fecha, cliente, whatsapp, direccion, productos, total, metodo_pago, estado, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const p of pedidos) {
      stmt.run(p.id, p.fecha, p.cliente || "", p.whatsapp || "", p.direccion || "",
        JSON.stringify(p.productos || []), p.total || 0, p.metodo_pago || "whatsapp",
        p.estado || "pendiente", p.notas || "");
    }
  }

  // 11. Ventas
  const ventas = readJSON("ventas.json");
  if (ventas && ventas.length) {
    console.log("11/11 Ventas (" + ventas.length + ")");
    const stmt = db.prepare("INSERT INTO ventas (id, fecha, cliente, productos, total, metodo_pago, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const v of ventas) {
      stmt.run(v.id, v.fecha, v.cliente || "", JSON.stringify(v.productos || []),
        v.total || 0, v.metodo_pago || "efectivo", v.whatsapp || "");
    }
  }

  db.close();

  // Imágenes
  const srcImg = path.join(BACKUP_DIR, "img");
  if (fs.existsSync(srcImg)) {
    const files = fs.readdirSync(srcImg).filter(f => f !== "." && f !== "..");
    console.log("\nImágenes: " + files.length + " archivos");
    for (const f of files) {
      fs.copyFileSync(path.join(srcImg, f), path.join(IMG_DIR, f));
    }
    console.log("  Copiadas a " + IMG_DIR);
  }

  console.log("\n✅ Restauración completa!");
  console.log("Podés iniciar el servidor con: node server.js");
}

restore().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
