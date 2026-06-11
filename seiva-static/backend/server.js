const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "SeivaAdmin2026!";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "SeivaAdmin2026!";

app.use(cors());
app.use(express.json({ limit: "5mb" }));
let imgPath = path.join(__dirname, "public", "productos");
if (!fs.existsSync(imgPath)) {
  imgPath = path.join(__dirname, "img", "productos");
}
console.log("imgPath: " + imgPath + " exists: " + fs.existsSync(imgPath));
app.use("/img/productos", express.static(imgPath));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio INTEGER NOT NULL DEFAULT 0,
    precio_anterior INTEGER,
    categoria TEXT NOT NULL DEFAULT 'snacks',
    subcategoria TEXT NOT NULL DEFAULT '',
    descripcion TEXT DEFAULT '',
    etiquetas TEXT DEFAULT '[]',
    destacado INTEGER DEFAULT 0,
    imagen TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    cliente TEXT DEFAULT '',
    productos TEXT NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    metodo_pago TEXT DEFAULT 'efectivo',
    whatsapp TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contenido (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    cliente TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    direccion TEXT DEFAULT '',
    productos TEXT NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    metodo_pago TEXT DEFAULT 'whatsapp',
    estado TEXT DEFAULT 'pendiente',
    notas TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS paginas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    contenido TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    creado TEXT DEFAULT (datetime('now')),
    actualizado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    descripcion TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS envios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ciudad TEXT NOT NULL,
    departamento TEXT DEFAULT '',
    costo INTEGER NOT NULL DEFAULT 0,
    activo INTEGER DEFAULT 1,
    tipo TEXT DEFAULT 'delivery',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS descuentos_cantidad (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    min_cantidad INTEGER NOT NULL,
    max_cantidad INTEGER,
    descuento INTEGER NOT NULL DEFAULT 0,
    UNIQUE(producto_id, min_cantidad)
  );
`);

const contenidoDefault = {
  hero_titulo: "Frescura natural que se siente",
  hero_descripcion: "Almendras con chocolate, frutos secos premium, snacks saludables y suplementos. Directo a tu puerta. Sin vueltas.",
  whatsapp_numero: "595992120303",
  site_titulo: "Seiva Paraguay — Snacks Saludables y Suplementos Naturales",
  site_descripcion: "Almendras con chocolate, frutos secos, snacks saludables y suplementos naturales. Envios a todo Paraguay. Pedi por WhatsApp.",
  qr_activo: "",
  qr_imagen: "",
  qr_instrucciones: "Pagá con QR y envianos el comprobante por WhatsApp",
  envio_minimo_gratis: "150000",
  global_envios: `<p>Realizamos envíos a <strong>todo Paraguay</strong>.</p>
<ul>
  <li><strong>Asunción y Central:</strong> Delivery en 24-48h hábiles. Costo: Gs. 15.000</li>
  <li><strong>Interior:</strong> Encomienda por transportadora. Tiempo: 2-5 días hábiles según destino.</li>
  <li><strong>Envío gratis:</strong> Compras superiores a Gs. 150.000 en Asunción y Central.</li>
</ul>
<p>Coordinamos la entrega por WhatsApp para asegurar que recibas tu pedido sin demoras.</p>`,
  global_pagos: `<ul>
  <li><strong>Transferencia bancaria:</strong> Aceptamos transferencias de todos los bancos.</li>
  <li><strong>Pago QR:</strong> Escaneá y pagá desde cualquier app bancaria.</li>
  <li><strong>Efectivo contra entrega:</strong> Disponible en Asunción y Central.</li>
  <li><strong>Giros Tigo/Money:</strong> Rápido y sin costo adicional.</li>
</ul>
<p>Todos los pagos se coordinan por WhatsApp al <strong>0992 120 303</strong>.</p>`,
  global_garantia: `<ul>
  <li><strong>Productos sellados:</strong> Si el producto no fue abierto, aceptamos devolución dentro de 7 días.</li>
  <li><strong>Productos dañados:</strong> Si recibís un producto en mal estado, lo reemplazamos sin costo.</li>
  <li><strong>Calidad garantizada:</strong> Trabajamos con marcas premium. Todos nuestros productos tienen control de calidad.</li>
</ul>
<p>Tu satisfacción es nuestra prioridad. Cualquier inconveniente, escribinos por WhatsApp.</p>`,
};

const insertContenido = db.prepare("INSERT OR IGNORE INTO contenido (key, value) VALUES (?, ?)");
for (const [key, value] of Object.entries(contenidoDefault)) {
  insertContenido.run(key, value);
}

try { db.exec("ALTER TABLE productos ADD COLUMN categoria_id INTEGER DEFAULT NULL REFERENCES categorias(id)"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN descripcion_larga TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN galeria TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN sku TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN marca TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN seo_descripcion TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN crosssell TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN upsell TEXT DEFAULT '[]'"); } catch (e) {}

try { db.exec("ALTER TABLE pedidos ADD COLUMN envio_costo INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos ADD COLUMN envio_ciudad TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE envios ADD COLUMN tipo TEXT DEFAULT 'delivery'"); } catch (e) {}

// Migraciones descuentos_cantidad v2 — campos opcionales (Mavis)
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN audiencia TEXT DEFAULT 'todos'"); } catch (e) {}
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN tipo_descuento TEXT DEFAULT 'monto_fijo'"); } catch (e) {}
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN fecha_inicio TEXT DEFAULT NULL"); } catch (e) {}
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN fecha_fin TEXT DEFAULT NULL"); } catch (e) {}
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN etiqueta TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE descuentos_cantidad ADD COLUMN descripcion TEXT DEFAULT ''"); } catch (e) {}

// Seed descuentos_cantidad if empty
const dcCount = db.prepare("SELECT COUNT(*) as c FROM descuentos_cantidad").get();
if (dcCount.c === 0) {
  const descuentosSeed = [
    [2, 2, 10, 10000],
    [5, 2, 10, 10000],
    [9, 2, 10, 10000],
    [10, 2, 2, 10000],
    [10, 3, 4, 15000],
    [10, 5, null, 20000],
    [12, 2, 4, 10000],
    [12, 5, 12, 15000],
    [12, 12, 0, 20000],
    [14, 2, 10, 10000],
    [17, 2, 10, 10000],
    [22, 2, 10, 10000],
    [27, 2, 10, 10000],
    [36, 2, 10, 10000],
    [46, 2, 10, 10000],
    [60, 2, 10, 10000],
    [66, 2, 10, 10000],
    [79, 2, 10, 10000],
    [95, 2, 3, 2500],
    [95, 4, 10, 5000],
    [96, 2, 3, 2500],
    [96, 4, 10, 5000],
    [97, 2, 3, 2500],
    [97, 4, 10, 5000],
    [98, 2, 3, 2500],
    [98, 4, 10, 5000],
    [108, 2, 10, 10000],
    [111, 2, 10, 10000],
    [121, 2, 10, 10000],
    [125, 2, 10, 10000],
    [138, 2, 10, 10000],
    [139, 2, 10, 10000],
    [162, 2, 10, 10000],
    [165, 2, 10, 10000],
    [175, 2, 10, 10000],
  ];
  const insertDC = db.prepare("INSERT OR IGNORE INTO descuentos_cantidad (producto_id, min_cantidad, max_cantidad, descuento) VALUES (?, ?, ?, ?)");
  for (const d of descuentosSeed) {
    insertDC.run(d[0], d[1], d[2], d[3]);
  }
}

const envCount = db.prepare("SELECT COUNT(*) as c FROM envios").get();
if (envCount.c === 0) {
  const deliveryCiudades = [
    ["Asunción", "Capital", 15000],
    ["San Lorenzo", "Central", 15000],
    ["Fernando de la Mora", "Central", 15000],
    ["Lambaré", "Central", 15000],
    ["Luque", "Central", 15000],
    ["Mariano Roque Alonso", "Central", 15000],
    ["Ñemby", "Central", 15000],
    ["Capiatá", "Central", 15000],
    ["Itauguá", "Central", 20000],
    ["Villa Elisa", "Central", 15000],
    ["Limpio", "Central", 15000],
  ];
  const encomiendaCiudades = [
    ["Ciudad del Este", "Alto Paraná", 0],
    ["Encarnación", "Itapúa", 0],
    ["Coronel Oviedo", "Caaguazú", 0],
    ["Caaguazú", "Caaguazú", 0],
    ["Villarrica", "Guairá", 0],
    ["Pedro Juan Caballero", "Amambay", 0],
    ["Concepción", "Concepción", 0],
    ["Salto del Guairá", "Canindeyú", 0],
    ["Otra ciudad", "", 0],
  ];
  const insDelivery = db.prepare("INSERT INTO envios (ciudad, departamento, costo, tipo) VALUES (?, ?, ?, 'delivery')");
  for (const e of deliveryCiudades) insDelivery.run(e[0], e[1], e[2]);
  const insEncomienda = db.prepare("INSERT INTO envios (ciudad, departamento, costo, tipo) VALUES (?, ?, ?, 'encomienda')");
  for (const e of encomiendaCiudades) insEncomienda.run(e[0], e[1], e[2]);
}

const catCount = db.prepare("SELECT COUNT(*) as c FROM categorias").get();
if (catCount.c === 0) {
  const defCats = [["snacks","snacks","Snacks saludables"],["suplementos","suplementos","Suplementos"],["combos","combos","Combos"]];
  const ins = db.prepare("INSERT INTO categorias (nombre, slug, descripcion) VALUES (?, ?, ?)");
  for (const c of defCats) ins.run(c[0], c[1], c[2]);
  // Map existing category text to ID
  const prods = db.prepare("SELECT id, categoria FROM productos WHERE categoria_id IS NULL").all();
  const catMap = { snacks: 1, suplementos: 2, combos: 3 };
  const upd = db.prepare("UPDATE productos SET categoria_id = ? WHERE id = ?");
  for (const p of prods) {
    const cid = catMap[p.categoria];
    if (cid) upd.run(cid, p.id);
  }
}

function seedProductos() {
  const row = db.prepare("SELECT COUNT(*) as c FROM productos").get();
  if (row.c > 0) return;

  const seed = [
    ["Almendras con Chocolate Negro", 45000, null, "snacks", "chocolate", "Almendras seleccionadas cubiertas con chocolate negro 70% cacao.", '["nuevo","popular"]', 1, "product-4073.jpg", 1],
    ["Mix de Frutos Secos Premium", 55000, 65000, "snacks", "mix", "Combinacion de almendras, nueces, castanas, arandanos y pasas.", '["oferta"]', 1, "product-4079.jpg", 1],
    ["Almendras Naturales 500g", 58000, null, "snacks", "almendras", "Almendras crudas sin sal, empacadas al vacio.", '[]', 1, "product-2564.jpg", 1],
    ["Datiles Medjool 400g", 42000, null, "snacks", "frutas", "Datiles Medjool premium, naturalmente dulces.", '["nuevo"]', 0, "product-2505.jpg", 1],
    ["Nueces Pecanas 300g", 62000, null, "snacks", "nueces", "Nueces pecanas frescas, ricas en antioxidantes.", '[]', 0, "product-3116.jpg", 1],
    ["Barritas de Granola Artesanal", 12000, null, "snacks", "barras", "Barritas de granola caseras. Pack x3.", '["popular"]', 1, "product-2468.png", 1],
    ["Aceite de Oregano 120 Capsulas", 75000, 90000, "suplementos", "aceites", "Aceite de oregano 500mg. Refuerzo inmune.", '["oferta"]', 0, "aceite-de-ajo-mix-nutri-3.webp", 2],
    ["Magnesio Quelato 120 Capsulas", 85000, null, "suplementos", "magnesios", "Magnesio quelato de alta absorcion.", '["popular"]', 1, "magnesio-quelato-bio-120-paraguay.jpg", 2],
    ["Omega 3 Puro 1000mg", 95000, 120000, "suplementos", "omega3", "Omega 3 puro con EPA y DHA. 120 capsulas.", '["oferta"]', 1, "product-3995.jpg", 2],
    ["Creatina Monohidratada 300g", 78000, null, "suplementos", "gym", "Creatina monohidratada micronizada. 300g.", '[]', 0, "creatina-unilife-paraguay1.jpg", 2],
    ["Colageno Hidrolizado 500g", 120000, 145000, "suplementos", "colagenos", "Colageno tipo I y III para piel y articulaciones.", '["oferta"]', 0, "colageno-hidrolisado-rei-terra-120-500mg.webp", 2],
    ["Curcuma con Pimienta Negra", 65000, null, "suplementos", "naturales", "Curcuma organica con pimienta negra.", '[]', 0, "curcuma.png", 2],
    ["Combo Omega 3 + Magnesio Citrato", 150000, 205000, "combos", "combos", "Omega 3 Puro + Magnesio Citrato. Combo bienestar.", '["oferta","popular"]', 1, "combo-ome.jpeg", 3]
  ];

  const insert = db.prepare("INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, etiquetas, destacado, imagen, stock, activo, categoria_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 50, 1, ?)");
  for (const p of seed) insert.run(...p);
}

seedProductos();

// ---------- AUTH ----------
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!password || !bcrypt.compareSync(password, ADMIN_HASH)) {
    return res.status(401).json({ error: "Contrasena incorrecta" });
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token });
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token requerido" });
  try {
    const decoded = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
    if (decoded.role !== "admin") throw new Error();
    next();
  } catch {
    res.status(401).json({ error: "Token invalido" });
  }
}

function parseProducto(row) {
  const price_tiers = db.prepare("SELECT min_cantidad, max_cantidad, descuento FROM descuentos_cantidad WHERE producto_id = ? ORDER BY min_cantidad").all(row.id);
  return {
    ...row,
    etiquetas: JSON.parse(row.etiquetas || "[]"),
    galeria: JSON.parse(row.galeria || "[]"),
    crosssell: JSON.parse(row.crosssell || "[]"),
    upsell: JSON.parse(row.upsell || "[]"),
    destacado: !!row.destacado,
    activo: !!row.activo,
    precio_anterior: row.precio_anterior || null,
    price_tiers: price_tiers.length > 0 ? price_tiers : undefined
  };
}

// ---------- PRODUCTOS ----------
app.get("/api/productos", (req, res) => {
  const rows = db.prepare("SELECT * FROM productos ORDER BY CASE WHEN stock > 0 THEN 0 ELSE 1 END, destacado DESC, id DESC").all();
  res.json(rows.map(parseProducto));
});

app.get("/api/productos/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM productos ORDER BY id DESC").all();
  res.json(rows.map(parseProducto));
});

app.post("/api/productos", auth, (req, res) => {
  const { nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell } = req.body;
  if (!nombre || !precio) return res.status(400).json({ error: "Nombre y precio requeridos" });
  const cid = categoria_id || null;
  const catName = categoria || (cid ? db.prepare("SELECT nombre FROM categorias WHERE id=?").get(cid)?.nombre : "snacks") || "snacks";
  const result = db.prepare("INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    nombre, precio, precio_anterior || null, catName, subcategoria || "", descripcion || "", descripcion_larga || "", JSON.stringify(galeria || []), JSON.stringify(etiquetas || []), destacado ? 1 : 0, imagen || "", stock || 0, activo !== false ? 1 : 0, cid, sku || "", marca || "", seo_descripcion || "", JSON.stringify(crosssell || []), JSON.stringify(upsell || [])
  );
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/productos/:id", auth, (req, res) => {
  const { nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell } = req.body;
  const cid = categoria_id !== undefined ? categoria_id : null;
  const catName = categoria || (cid ? db.prepare("SELECT nombre FROM categorias WHERE id=?").get(cid)?.nombre : "snacks") || "snacks";
  db.prepare("UPDATE productos SET nombre=?, precio=?, precio_anterior=?, categoria=?, subcategoria=?, descripcion=?, descripcion_larga=?, galeria=?, etiquetas=?, destacado=?, imagen=?, stock=?, activo=?, categoria_id=?, sku=?, marca=?, seo_descripcion=?, crosssell=?, upsell=? WHERE id=?").run(
    nombre, precio, precio_anterior || null, catName, subcategoria, descripcion || "", descripcion_larga || "", JSON.stringify(galeria || []), JSON.stringify(etiquetas || []), destacado ? 1 : 0, imagen || "", stock || 0, activo !== false ? 1 : 0, cid, sku || "", marca || "", seo_descripcion || "", JSON.stringify(crosssell || []), JSON.stringify(upsell || []), req.params.id
  );
  res.json({ ok: true });
});

app.patch("/api/productos/:id/toggle", auth, (req, res) => {
  const row = db.prepare("SELECT activo FROM productos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  const nuevo = row.activo ? 0 : 1;
  db.prepare("UPDATE productos SET activo = ? WHERE id = ?").run(nuevo, req.params.id);
  res.json({ activo: !!nuevo });
});

// Batch stock update
app.patch("/api/productos/stock-batch", auth, (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: "updates debe ser un array" });
  
  const updateStmt = db.prepare("UPDATE productos SET stock = ? WHERE id = ?");
  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.stock, item.id);
    }
  });
  transaction(updates);
  res.json({ ok: true, updated: updates.length });
});

app.delete("/api/productos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM productos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- SCRAPE PRODUCTO ----------
function formatDescription(rawText) {
  if (!rawText) return '';
  
  // Si ya es HTML con estructura válida, preservar
  if (/<(ul|li|strong|b|em|h[1-6])[\s>]/i.test(rawText) && /<\/(ul|li|strong|b|em|h[1-6])>/i.test(rawText)) {
    return rawText;
  }
  
  // Limpiar HTML tags pero preservar saltos de linea
  let clean = rawText.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n');
  clean = clean.replace(/<[^>]*>/g, '').trim();
  if (!clean) return '';
  
  // Dividir en lineas y limpiar
  let lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  
  // Formatear como HTML
  let html = '';
  for (let line of lines) {
    if (/^[-•●◦▪]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      let itemText = line.replace(/^[-•●◦▪]\s*/, '').replace(/^\d+[.)]\s*/, '');
      html += '<li>' + itemText + '</li>';
    } else {
      html += '<p>' + line + '</p>';
    }
  }
  
  // Envolver items de lista en <ul>
  html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => '<ul>' + match + '</ul>');
  return html;
}

function formatDescriptionLarga(rawText) {
  if (!rawText) return '';
  let clean = rawText.trim();
  
  // Si tiene tags HTML, limpiar pero preservar estructura
  if (/<[a-z][\s\S]*>/i.test(clean)) {
    const $ = cheerio.load('<div id="__sw__">' + clean + '</div>');
    const wrapper = $('#__sw__');
    
    wrapper.find('script, style, noscript, meta, link, nav, svg, button, iframe, form, input, select, textarea').remove();
    wrapper.find('ol, [itemscope], [hidden]').remove();
    wrapper.find('.breadcrumb, [class*="breadcrumb"], [class*="nav-"], [class*="schema"]').remove();
    
    wrapper.find('*').each(function() {
      const el = $(this);
      const attrs = el.attr();
      for (const key of Object.keys(attrs)) {
        if (key !== 'href' && key !== 'src' && key !== 'alt') el.removeAttr(key);
      }
    });
    
    clean = wrapper.html() || '';
    
    if (/<(p|strong|ul|li|h[1-6])[\s>]/i.test(clean) && clean.length > 50) {
      return clean;
    }
    
    clean = clean.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<[^>]*>/g, '');
  }
  
  let lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  
  let html = '';
  for (const line of lines) {
    if (line.length < 60 && /:\s*$/.test(line)) {
      html += '<strong>' + line.replace(/:\s*$/, '') + '</strong><br>';
    } else if (/^[-*]\s/.test(line)) {
      html += '<li>' + line.replace(/^[-*]\s*/, '') + '</li>';
    } else {
      html += '<p>' + line + '</p>';
    }
  }
  html = html.replace(/(<li>.*?<\/li>)+/gs, m => '<ul>' + m + '</ul>');
  return html;
}

async function downloadImage(imgUrl, nombre) {
  try {
    const response = await fetch(imgUrl);
    if (!response.ok) throw new Error('No se pudo descargar imagen');
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    
    // Nombre unico: producto-TIMESTAMP.ext
    const fileName = 'producto-' + Date.now() + '.' + ext;
    
    // Guardar en el directorio de imagenes
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(imgPath, fileName), buffer);
    
    return fileName;
  } catch (error) {
    console.error('Error descargando imagen:', error);
    return null;
  }
}

async function scrapeProductData(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extraer titulo
    let nombre = $('meta[property="og:title"]').attr('content') || 
                 $('meta[name="twitter:title"]').attr('content') || 
                 $('h1').first().text().trim() || 
                 $('title').text().trim() || 
                 'Producto sin nombre';

    // Extraer marca
    let marca = $('meta[property="product:brand"]').attr('content') ||
                $('meta[itemprop="brand"]').attr('content') ||
                $('[itemprop="brand"]').text().trim() ||
                $('.brand, .marca, [class*="brand"], [class*="marca"]').first().text().trim() ||
                '';
    // Limpiar marca si es muy larga (probablemente basura)
    if (marca.length > 50) marca = '';

    // === DESCRIPCION CORTA ===
    let descCorta = '';
    
    // Excluir nav, footer, header, menu
    const excludeSelectors = 'nav, footer, header, [class*="nav"], [class*="menu"], [class*="footer"], [class*="header"], [class*="sidebar"], [class*="widget"], [id*="nav"], [id*="menu"], [id*="footer"], [id*="header"]';
    
    // 1. Buscar <li> DENTRO del area del producto
    const productArea = $('[class*="product"], [class*="detail"], [class*="info"], article, .main-content, main, [role="main"]').first();
    const searchArea = productArea.length ? productArea : $('body');
    
    const allItems = [];
    searchArea.find('li').each(function() {
      const parent = $(this).parent(excludeSelectors);
      if (parent.length) return; // saltar si esta dentro de nav/footer
      const text = $(this).text().trim();
      if (text.length > 5 && text.length < 300) {
        allItems.push(text);
      }
    });
    
    if (allItems.length > 0) {
      descCorta = '<ul>' + allItems.slice(0, 10).map(item => '<li>' + item + '</li>').join('') + '</ul>';
    } else {
      // 2. Buscar <strong> con ":" (specs)
      const strongItems = [];
      searchArea.find('strong, b').each(function() {
        const parent = $(this).closest(excludeSelectors);
        if (parent.length) return;
        const text = $(this).text().trim();
        if (text.length > 3 && text.length < 100 && /:/.test(text)) {
          strongItems.push(text);
        }
      });
      if (strongItems.length > 0) {
        descCorta = '<ul>' + strongItems.slice(0, 8).map(item => '<li>' + item + '</li>').join('') + '</ul>';
      } else {
        // 3. Fallback: meta description
        descCorta = $('meta[property="og:description"]').attr('content') || 
                    $('meta[name="description"]').attr('content') || 
                    $('meta[name="twitter:description"]').attr('content') || 
                    '';
      }
    }

    // === DESCRIPCION LARGA ===
    let descLarga = '';
    
    // 1. Buscar contenedores de descripcion
    const descSelectors = [
      '[class*="description"]', '[class*="descripcion"]',
      '[class*="detail"]', '[class*="detalle"]',
      '[class*="content"]', '[class*="contenido"]',
      '[class*="product-info"]', '[class*="product-details"]',
      '[class*="product-desc"]', '[class*="prod-desc"]',
      'article', '.product-info', '.product-details',
      '[itemprop="description"]', '[itemprop="description"]'
    ];
    
    for (const sel of descSelectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 30) {
        const htmlContent = el.html();
        if (htmlContent && htmlContent.length > 30) {
          descLarga = htmlContent;
          break;
        }
      }
    }
    
    // 2. Si no encontro nada, tomar todos los parrafos del body
    if (!descLarga || descLarga.length < 30) {
      const paragraphs = [];
      $('p').each(function(i) {
        if (i < 10) {
          const text = $(this).text().trim();
          if (text.length > 15) {
            paragraphs.push('<p>' + text + '</p>');
          }
        }
      });
      if (paragraphs.length > 0) {
        descLarga = paragraphs.join('\n');
      }
    }
    
    // 3. Fallback final: tomar todo el texto del body (limpiado)
    if (!descLarga || descLarga.length < 30) {
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      if (bodyText.length > 30) {
        descLarga = '<p>' + bodyText.substring(0, 1000) + '</p>';
      }
    }

    // Extraer precio
    let precio = null;
    const precioSelectors = [
      '[class*="price"] [class*="current"], [class*="precio"] [class*="actual"]',
      '[class*="price"], [class*="precio"], [class*="costo"], [class*="monto"]',
      '.price, .precio, .costo, .monto',
      '[data-price]', '[itemprop="price"]'
    ];
    for (const sel of precioSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const precioText = el.text() || el.attr('content') || '';
        const match = precioText.match(/[\d.,]+/);
        if (match) {
          precio = parseInt(match[0].replace(/[^\d]/g, ''));
          if (precio > 0) break;
        }
      }
    }
    // Fallback: buscar en todo el body
    if (!precio) {
      const bodyText = $('body').text();
      const precioMatch = bodyText.match(/Gs\.?\s*([\d.,]+)/i) || 
                         bodyText.match(/PYG\s*([\d.,]+)/i) ||
                         bodyText.match(/\$\s*([\d.,]+)/i);
      if (precioMatch) {
        precio = parseInt(precioMatch[1].replace(/[^\d]/g, ''));
      }
    }

    // Extraer imagen principal
    let imagenUrl = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') || 
                    $('img[class*="product"], img[class*="main"], img[class*="hero"]').first().attr('src') ||
                    $('img').first().attr('src') ||
                    '';

    // Si la imagen es relativa, hacerla absoluta
    if (imagenUrl && imagenUrl.startsWith('/')) {
      const urlObj = new URL(url);
      imagenUrl = urlObj.origin + imagenUrl;
    }

    // Descargar imagen al servidor
    let imagenLocal = '';
    if (imagenUrl && imagenUrl.startsWith('http')) {
      imagenLocal = await downloadImage(imagenUrl, nombre);
    }

    // Formatear descripciones
    if (!descCorta.includes('<ul>') && !descCorta.includes('<li>')) {
      descCorta = formatDescription(descCorta);
    }
    descLarga = formatDescriptionLarga(descLarga);

    return {
      nombre: nombre.substring(0, 200),
      marca: marca,
      descripcion: descCorta,
      descripcion_larga: descLarga,
      precio: precio,
      imagen: imagenLocal || imagenUrl,
      url_origen: url
    };
  } catch (error) {
    console.error('Error scraping:', error);
    throw error;
  }
}

app.post("/api/scrape-product", auth, async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "URL requerida" });
  }

  try {
    const data = await scrapeProductData(url);
    res.json(data);
  } catch (error) {
    console.error('Error en scrape-product:', error);
    res.status(500).json({ error: "Error al scrapear la URL", details: error.message });
  }
});

// ---------- DESCUENTOS POR CANTIDAD ----------
app.get("/api/descuentos", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, p.nombre as producto_nombre, p.precio as producto_precio, p.imagen as producto_imagen
    FROM descuentos_cantidad d
    JOIN productos p ON d.producto_id = p.id
    ORDER BY p.nombre, d.min_cantidad
  `).all();
  res.json(rows);
});

app.get("/api/descuentos/producto/:producto_id", (req, res) => {
  const rows = db.prepare("SELECT * FROM descuentos_cantidad WHERE producto_id = ? ORDER BY min_cantidad").all(req.params.producto_id);
  res.json(rows);
});

app.post("/api/descuentos", auth, (req, res) => {
  const { producto_id, min_cantidad, max_cantidad, descuento, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta, descripcion } = req.body;
  if (!producto_id || !min_cantidad || !descuento) {
    return res.status(400).json({ error: "producto_id, min_cantidad y descuento son requeridos" });
  }
  const result = db.prepare(`
    INSERT INTO descuentos_cantidad
      (producto_id, min_cantidad, max_cantidad, descuento, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta, descripcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    producto_id, min_cantidad, max_cantidad || null, descuento,
    audiencia || 'todos',
    tipo_descuento || 'monto_fijo',
    fecha_inicio || null,
    fecha_fin || null,
    etiqueta || '',
    descripcion || ''
  );
  res.json({ id: result.lastInsertRowid });
});

app.post("/api/descuentos/lote", auth, (req, res) => {
  const { producto_id, tiers, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta, descripcion } = req.body;
  if (!producto_id || !tiers || !tiers.length) {
    return res.status(400).json({ error: "producto_id y tiers son requeridos" });
  }
  const deleteStmt = db.prepare("DELETE FROM descuentos_cantidad WHERE producto_id = ?");
  const insertStmt = db.prepare(`
    INSERT INTO descuentos_cantidad
      (producto_id, min_cantidad, max_cantidad, descuento, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta, descripcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    deleteStmt.run(producto_id);
    for (const tier of tiers) {
      insertStmt.run(
        producto_id, tier.min_cantidad, tier.max_cantidad || null, tier.descuento,
        audiencia || 'todos',
        tipo_descuento || 'monto_fijo',
        fecha_inicio || null,
        fecha_fin || null,
        etiqueta || '',
        descripcion || ''
      );
    }
  });
  transaction();
  res.json({ ok: true, producto_id, tiers_count: tiers.length });
});

app.put("/api/descuentos/:id", auth, (req, res) => {
  const { min_cantidad, max_cantidad, descuento, audiencia, tipo_descuento, fecha_inicio, fecha_fin, etiqueta, descripcion } = req.body;
  db.prepare(`
    UPDATE descuentos_cantidad
    SET min_cantidad = ?, max_cantidad = ?, descuento = ?,
        audiencia = ?, tipo_descuento = ?, fecha_inicio = ?, fecha_fin = ?,
        etiqueta = ?, descripcion = ?
    WHERE id = ?
  `).run(
    min_cantidad, max_cantidad || null, descuento,
    audiencia || 'todos', tipo_descuento || 'monto_fijo',
    fecha_inicio || null, fecha_fin || null,
    etiqueta || '', descripcion || '',
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/descuentos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM descuentos_cantidad WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/descuentos/producto/:producto_id", auth, (req, res) => {
  db.prepare("DELETE FROM descuentos_cantidad WHERE producto_id = ?").run(req.params.producto_id);
  res.json({ ok: true });
});

// ---------- VENTAS ----------
app.get("/api/ventas", auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const rows = db.prepare("SELECT * FROM ventas ORDER BY fecha DESC LIMIT ?").all(limit);
  res.json(rows.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") })));
});

app.post("/api/ventas", auth, (req, res) => {
  const { cliente, productos, total, metodo_pago, whatsapp, fecha } = req.body;
  if (!productos || !productos.length) return res.status(400).json({ error: "Productos requeridos" });
  const result = db.prepare("INSERT INTO ventas (fecha, cliente, productos, total, metodo_pago, whatsapp) VALUES (?,?,?,?,?,?)").run(
    fecha || new Date().toISOString(), cliente || "", JSON.stringify(productos), total || 0, metodo_pago || "efectivo", whatsapp || ""
  );
  res.json({ id: result.lastInsertRowid });
});

// ---------- STATS ----------
app.get("/api/stats", auth, (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const semanaInicio = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const mesInicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const ventasHoy = db.prepare("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad FROM ventas WHERE fecha >= ?").get(hoy);
  const ventasSemana = db.prepare("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad FROM ventas WHERE fecha >= ?").get(semanaInicio);
  const ventasMes = db.prepare("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad FROM ventas WHERE fecha >= ?").get(mesInicio);
  const productosCount = db.prepare("SELECT COUNT(*) as c FROM productos WHERE activo = 1").get();
  const ultimasVentas = db.prepare("SELECT * FROM ventas ORDER BY fecha DESC LIMIT 10").all();

  res.json({
    hoy: ventasHoy,
    semana: ventasSemana,
    mes: ventasMes,
    productos_activos: productosCount.c,
    ultimas_ventas: ultimasVentas.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") }))
  });
});

app.get("/api/stats/top-productos", auth, (req, res) => {
  const mesInicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const ventas = db.prepare("SELECT productos FROM ventas WHERE fecha >= ?").all(mesInicio);
  const conteo = {};
  for (const v of ventas) {
    const prods = JSON.parse(v.productos || "[]");
    for (const p of prods) {
      const nombre = p.nombre || "";
      if (nombre) conteo[nombre] = (conteo[nombre] || 0) + (p.cantidad || 1);
    }
  }
  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nombre, cantidad]) => ({ nombre, cantidad }));
  res.json(sorted);
});

// ---------- CONTENIDO ----------
app.get("/api/contenido", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM contenido").all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.put("/api/contenido", auth, (req, res) => {
  const update = db.prepare("INSERT OR REPLACE INTO contenido (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(req.body)) {
    update.run(key, String(value));
  }
  res.json({ ok: true });
});

// ---------- PAGINAS (publico: obtener por slug) ----------
app.get("/api/paginas", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM paginas ORDER BY titulo").all();
  res.json(rows);
});

app.get("/api/paginas/:slug", (req, res) => {
  const row = db.prepare("SELECT * FROM paginas WHERE slug = ? AND activo = 1").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Pagina no encontrada" });
  res.json(row);
});

app.post("/api/paginas", auth, (req, res) => {
  const { titulo, slug, contenido } = req.body;
  if (!titulo) return res.status(400).json({ error: "Titulo requerido" });
  const genSlug = slug || titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const result = db.prepare("INSERT INTO paginas (titulo, slug, contenido) VALUES (?, ?, ?)").run(titulo, genSlug, contenido || "");
  res.json({ id: result.lastInsertRowid, slug: genSlug });
});

app.put("/api/paginas/:id", auth, (req, res) => {
  const { titulo, slug, contenido, activo } = req.body;
  const genSlug = slug || titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  db.prepare("UPDATE paginas SET titulo=?, slug=?, contenido=?, activo=?, actualizado=datetime('now') WHERE id=?").run(
    titulo, genSlug, contenido || "", activo !== undefined ? (activo ? 1 : 0) : 1, req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/paginas/:id", auth, (req, res) => {
  db.prepare("DELETE FROM paginas WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- CATEGORIAS (admin) ----------
app.get("/api/categorias", (req, res) => {
  const rows = db.prepare("SELECT * FROM categorias ORDER BY nombre").all();
  res.json(rows);
});

app.post("/api/categorias", auth, (req, res) => {
  const { nombre, slug, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  const genSlug = slug || nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const result = db.prepare("INSERT INTO categorias (nombre, slug, descripcion) VALUES (?, ?, ?)").run(nombre, genSlug, descripcion || "");
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/categorias/:id", auth, (req, res) => {
  const { nombre, slug, descripcion, activo } = req.body;
  const genSlug = slug || nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  db.prepare("UPDATE categorias SET nombre=?, slug=?, descripcion=?, activo=? WHERE id=?").run(nombre, genSlug, descripcion || "", activo !== undefined ? (activo ? 1 : 0) : 1, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/categorias/:id", auth, (req, res) => {
  db.prepare("UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?").run(req.params.id);
  db.prepare("DELETE FROM categorias WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- ENVIOS ----------
app.get("/api/envios", (req, res) => {
  const rows = db.prepare("SELECT * FROM envios WHERE activo = 1 ORDER BY tipo, ciudad").all();
  res.json(rows);
});

app.get("/api/envios/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM envios ORDER BY tipo, ciudad").all();
  res.json(rows);
});

app.post("/api/envios", auth, (req, res) => {
  const { ciudad, departamento, costo, tipo } = req.body;
  if (!ciudad) return res.status(400).json({ error: "Ciudad requerida" });
  const result = db.prepare("INSERT INTO envios (ciudad, departamento, costo, tipo) VALUES (?, ?, ?, ?)").run(ciudad, departamento || "", parseInt(costo) || 0, tipo || (departamento === 'Central' ? 'delivery' : 'encomienda'));
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/envios/:id", auth, (req, res) => {
  const { ciudad, departamento, costo, activo, tipo } = req.body;
  db.prepare("UPDATE envios SET ciudad=?, departamento=?, costo=?, activo=?, tipo=? WHERE id=?").run(ciudad, departamento || "", parseInt(costo) || 0, activo !== undefined ? (activo ? 1 : 0) : 1, tipo || 'delivery', req.params.id);
  res.json({ ok: true });
});

app.delete("/api/envios/:id", auth, (req, res) => {
  db.prepare("DELETE FROM envios WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- PEDIDOS (publico: crear) ----------
app.post("/api/pedidos", (req, res) => {
  const { cliente, whatsapp, direccion, productos, total, metodo_pago, notas } = req.body;
  if (!cliente || !whatsapp || !productos || !productos.length) {
    return res.status(400).json({ error: "Cliente, whatsapp y productos requeridos" });
  }
  const result = db.prepare(
    "INSERT INTO pedidos (cliente, whatsapp, direccion, productos, total, metodo_pago, notas) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    cliente, whatsapp, direccion || "", JSON.stringify(productos), total || 0, metodo_pago || "whatsapp", notas || ""
  );
  res.json({ id: result.lastInsertRowid, estado: "pendiente" });
});

// ---------- PEDIDOS (auth: gestionar) ----------
app.get("/api/pedidos", auth, (req, res) => {
  const estado = req.query.estado;
  let sql = "SELECT * FROM pedidos";
  const params = [];
  if (estado) { sql += " WHERE estado = ?"; params.push(estado); }
  sql += " ORDER BY fecha DESC";
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") })));
});

app.get("/api/pedidos/:id", auth, (req, res) => {
  const row = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json({ ...row, productos: JSON.parse(row.productos || "[]") });
});

app.patch("/api/pedidos/:id/estado", auth, (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ["pendiente", "confirmado", "enviado", "entregado", "cancelado"];
  if (!estadosValidos.includes(estado)) return res.status(400).json({ error: "Estado invalido" });

  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "No encontrado" });

  if (estado === "confirmado" && pedido.estado !== "confirmado") {
    const prods = JSON.parse(pedido.productos || "[]");
    for (const p of prods) {
      if (p.id && p.cantidad) {
        db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?").run(p.cantidad, p.id, p.cantidad);
      }
    }
  }
  if (estado === "cancelado" && pedido.estado === "confirmado") {
    const prods = JSON.parse(pedido.productos || "[]");
    for (const p of prods) {
      if (p.id && p.cantidad) {
        db.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?").run(p.cantidad, p.id);
      }
    }
  }

  db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(estado, req.params.id);
  res.json({ ok: true, estado });
});

app.delete("/api/pedidos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM pedidos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- STOCK ALERTAS ----------
app.get("/api/stock-alertas", auth, (req, res) => {
  const limite = parseInt(req.query.limite) || 10;
  const rows = db.prepare("SELECT id, nombre, stock FROM productos WHERE stock <= ? AND activo = 1 ORDER BY stock ASC").all(limite);
  res.json(rows);
});

// Force UTF-8 charset for HTML files
app.use(function(req, res, next) {
  var orig = res.setHeader.bind(res);
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'content-type' && typeof value === 'string' && value.indexOf('text/html') !== -1 && value.indexOf('charset') === -1) {
      value += '; charset=utf-8';
    }
    return orig(name, value);
  };
  next();
});

// ---------- SERVE STATIC ----------
let adminPath = path.join(__dirname, "admin");
if (!fs.existsSync(adminPath)) {
  adminPath = path.join(__dirname, "..", "admin");
}
console.log("adminPath: " + adminPath + " exists: " + fs.existsSync(adminPath));
app.use("/admin", express.static(adminPath));

let distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  // New deployment: serve React SPA + API-only backend
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/admin")) {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
  console.log("Serving React SPA from dist/");
} else {
  // Old deployment: serve static files from parent
  const sitePath = path.join(__dirname, "..");
  app.use(express.static(sitePath));
  console.log("Serving static files from " + sitePath);
}

app.listen(PORT, () => {
  console.log("Seiva backend running on http://localhost:" + PORT);
  console.log("Admin: http://localhost:" + PORT + "/admin");
});
