const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const cheerio = require("cheerio");
const webpush = require("web-push");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const multer = require("multer");
const imageService = require("./image-service");
const compression = require("compression");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const crypto = require("crypto");

// Secrets: definidos abajo, luego de asegurar el directorio de datos (ver DB_PATH).

// VAPID keys for web push
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BOeFF0Sfcc8j7xHiQHZCdnNzWB2ib6Co7dLWJMf109QC7VwZTbxeKi4LbEt2vGhDgLUv1Jca1pd6T1CX1fZ5HVU";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "KwUPAzxdOnuWlWP-A7cIff1-j5sMZdY1ehMA8zfEQXE";
let webpushEnabled = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails("mailto:admin@seiva.com.py", VAPID_PUBLIC, VAPID_PRIVATE);
    webpushEnabled = true;
    console.log("Push notifications enabled");
  } catch (e) {
    console.warn("WARN: Invalid VAPID keys, push notifications disabled");
  }
} else {
  console.warn("WARN: VAPID keys not set, push notifications disabled");
}

// Enviar push a todos los suscriptores
function sendPushNotification(title, body, url) {
  if (!webpushEnabled) return;
  const subs = db.prepare("SELECT * FROM push_subs").all();
  const payload = JSON.stringify({ title, body, url });
  for (const sub of subs) {
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    webpush.sendNotification(pushSub, payload).catch(err => {
      // Limpiar suscripción inválida
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(sub.endpoint);
      }
    });
  }
}

// ---------- SSE (eventos en vivo para el admin) ----------
const sseClients = new Set();
function broadcastEvent(type, data) {
  const payload = "event: " + type + "\ndata: " + JSON.stringify(data || {}) + "\n\n";
  for (const c of sseClients) { try { c.write(payload); } catch (e) {} }
}

app.use(cors({
  origin: function(origin, cb) {
    const allowed = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["https://seiva.com.py", "https://www.seiva.com.py", "https://old.seiva.com.py", "https://webseiva-seiva-web20-af1lyl-48df1d-85-239-246-177.sslip.io", "http://localhost:3000", "http://127.0.0.1:3000"];
    if (!origin || allowed.indexOf(origin) !== -1) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true
}));
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://static.cloudflareinsights.com", "https://www.googletagmanager.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'", "https://old.seiva.com.py", "https://static.cloudflareinsights.com", "https://www.google-analytics.com", "https://www.google.com", "https://region1.google-analytics.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://www.googletagmanager.com"],
    }
  }
}));

// Compresión gzip/brotli de respuestas (HTML/CSS/JS) en origen
app.use(compression({ brotli: true, threshold: 1024 }));

// Rate limiter for login - progressive delay
const loginAttempts = new Map();
function getLoginDelay(ip) {
  const attempts = loginAttempts.get(ip) || 0;
  return Math.min(30 * 1000 * Math.pow(1.5, attempts), 300 * 1000); // Max 5 min
}
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: function(req, res) {
    const ip = req.ip || "unknown";
    const attempts = (loginAttempts.get(ip) || 0) + 1;
    loginAttempts.set(ip, attempts);
    const delay = getLoginDelay(ip);
    return { error: "Contraseña incorrecta", retryAfter: Math.ceil(delay / 1000) };
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip) || "unknown",
});

// Rate limiters para endpoints públicos de escritura
const pedidoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: { error: "Demasiados pedidos. Esperá un momento." },
   keyGenerator: (req) => ipKeyGenerator(req.ip) + ":" + (req.body?.whatsapp || "anon"),
});
const carritoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Demasiadas actualizaciones. Esperá un momento." },
});

// Error log — persisted in SQLite
function logError(level, message, details) {
  try {
    db.prepare("INSERT INTO error_logs (level, message, details) VALUES (?, ?, ?)").run(level, message, details || null);
    // Keep only last 1000 entries
    db.prepare("DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT 1000)").run();
  } catch (e) {
    console.error("[LOG-ERROR]", e.message);
  }
}
// Capture uncaught errors
process.on("uncaughtException", (err) => { console.error("[FATAL]", err); logError("fatal", err.message, err.stack); });
process.on("unhandledRejection", (err) => { console.error("[UNHANDLED]", err); logError("error", String(err)); });
// Serve images from both build images and uploads volume
var imgBuildPath = path.join(__dirname, "img-build");
var imgPath = path.join(__dirname, "img", "productos");
if (!fs.existsSync(imgPath)) {
  fs.mkdirSync(imgPath, { recursive: true });
}
console.log("imgPath: " + imgPath + " exists: " + fs.existsSync(imgPath));
console.log("imgBuildPath: " + imgBuildPath + " exists: " + fs.existsSync(imgBuildPath));
// Custom static middleware: check build first, then uploads
app.use("/img/productos", async function(req, res, next) {
  var relPath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
  var buildFile = path.join(imgBuildPath, relPath);
  var uploadFile = path.join(imgPath, relPath);
  var setCache = function() { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); };
  if (fs.existsSync(buildFile)) {
    setCache();
    return res.sendFile(buildFile);
  }
  if (fs.existsSync(uploadFile)) {
    setCache();
    return res.sendFile(uploadFile);
  }
  // On-demand generation of responsive WebP variants (self-healing)
  try {
    var generated = await imageService.ensureVariantForRequest(relPath);
    if (generated) {
      setCache();
      return res.sendFile(generated);
    }
  } catch (e) { /* fall through to fallback */ }
  // Fallback: serve the original image so it is never broken
  try {
    var original = imageService.findOriginalForVariant(relPath);
    if (original) {
      setCache();
      return res.sendFile(original);
    }
  } catch (e) { /* fall through to next */ }
  next();
});

const qrUpload = multer({
  storage: multer.diskStorage({
    destination: imgPath,
    filename: (req, file, cb) => cb(null, "qr-" + Date.now() + "." + (file.originalname.split(".").pop() || "png"))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

const heroUpload = multer({
  storage: multer.diskStorage({
    destination: imgPath,
    filename: (req, file, cb) => cb(null, "tmp-" + Date.now() + "." + (file.originalname.split(".").pop() || "png"))
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

const soundExt = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/wave": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/mp4": "m4a",
  "audio/aac": "aac", "audio/x-m4a": "m4a"
};
const soundUpload = multer({
  storage: multer.diskStorage({
    destination: imgPath,
    filename: (req, file, cb) => {
      const ext = soundExt[file.mimetype] || "mp3";
      cb(null, "sound-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex") + "." + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("audio/"))
});

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "database.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ---------- SECRETS ----------
// Si hay env vars, se usan. Si no, JWT_SECRET se genera UNA vez y se persiste
// en archivo dentro del volumen de datos para que las sesiones de admin
// sobrevivan a reinicios del proceso (sin exponer el password en logs).
const SECRET_FILE = process.env.JWT_SECRET_FILE || path.join(path.dirname(DB_PATH), ".jwt_secret");
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try { if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, "utf8").trim(); } catch (e) {}
  var gen = "sva-jwt-" + crypto.randomBytes(24).toString("hex");
  try { fs.writeFileSync(SECRET_FILE, gen, { mode: 0o600 }); } catch (e) {}
  return gen;
}
const JWT_SECRET = loadJwtSecret();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sva-admin-" + crypto.randomBytes(12).toString("hex");
if (!process.env.JWT_SECRET) console.warn("WARN: JWT_SECRET no configurado; se usa valor persistido en " + SECRET_FILE + ". Setealo en env para producción.");
if (!process.env.ADMIN_PASSWORD) console.warn("WARN: ADMIN_PASSWORD no configurado; se generó uno aleatorio (no se muestra). Setealo en env para poder loguearte tras reinicios.");

// Daily auto-backup (once every 24h, keep last 2)
const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backups");
function dailyBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".sqlite")).sort().reverse();
    if (files.length > 0) {
      const lastDate = files[0].substring(7, 17);
      const today = new Date().toISOString().substring(0, 10);
      if (lastDate === today) return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const bk = path.join(BACKUP_DIR, `backup-${ts}.sqlite`);
    fs.copyFileSync(DB_PATH, bk);
    const all = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".sqlite")).sort();
    while (all.length > 2) { fs.unlinkSync(path.join(BACKUP_DIR, all.shift())); }
    console.log("[Backup] " + bk);
  } catch(e) { console.warn("[Backup] skip:", e.message); }
}
dailyBackup();
// Backup again every 24h
setInterval(dailyBackup, 24 * 60 * 60 * 1000);

const db = new DatabaseSync(DB_PATH);

// Initialize Telegram Bot
// [MIGRATION] Bot moved to n8n (2026-08-23). init() disabled so the webhook
// stops handling updates; n8n now owns the Telegram webhook. Re-enable by
// uncommenting. DB + image API remain here for n8n to call.
const telegramBot = require("./telegram-bot");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://seiva.com.py";
const TELEGRAM_ALLOWED_CHATS = (process.env.TELEGRAM_ALLOWED_CHATS || "")
  .split(",").map(s => parseInt(s.trim(), 10)).filter(Boolean);
// telegramBot.init(db, {
//   imgPath,
//   publicBase: PUBLIC_BASE_URL,
//   allowedChats: TELEGRAM_ALLOWED_CHATS,
//   downloadImage,
//   scrapeProductData,
//   processUploadImage: imageService.processUploadImage,
//   generateSlug,
// });

//db.exec("PRAGMA journal_mode = WAL"); // Desactivado: WAL se corrompe en este VPS
db.exec("PRAGMA journal_mode = DELETE");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio INTEGER NOT NULL DEFAULT 0,
    precio_anterior INTEGER,
    categoria TEXT NOT NULL DEFAULT 'suplementos',
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

  CREATE TABLE IF NOT EXISTS marcas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    prioridad INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    logo TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS descuentos_marca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca_id INTEGER NOT NULL REFERENCES marcas(id),
    tipo_descuento TEXT DEFAULT 'monto_fijo',
    valor INTEGER NOT NULL DEFAULT 0,
    min_cantidad INTEGER NOT NULL DEFAULT 1,
    max_cantidad INTEGER,
    exclusiones TEXT DEFAULT '[]',
    inclusiones TEXT DEFAULT '[]',
    fecha_inicio TEXT DEFAULT NULL,
    fecha_fin TEXT DEFAULT NULL,
    etiqueta TEXT DEFAULT '',
    audiencia TEXT DEFAULT 'todos',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS carritos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT NOT NULL,
    productos TEXT NOT NULL DEFAULT '[]',
    whatsapp TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now')),
    notificado INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS push_subs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'bogo',
    nombre TEXT NOT NULL,
    producto_id INTEGER,
    marca_id INTEGER,
    compra_min_cantidad INTEGER DEFAULT 1,
    compra_min_monto INTEGER DEFAULT 0,
    regala_cantidad INTEGER DEFAULT 0,
    regala_producto_id INTEGER,
    descuento_valor INTEGER DEFAULT 0,
    descuento_tipo TEXT DEFAULT 'monto_fijo',
    cupon_codigo TEXT,
    cupon_usos_max INTEGER,
    cupon_usos_actuales INTEGER DEFAULT 0,
    fecha_inicio TEXT,
    fecha_fin TEXT,
    activo INTEGER DEFAULT 1,
    prioridad INTEGER DEFAULT 0,
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    productos TEXT NOT NULL DEFAULT '[]',
    precio_bundle INTEGER NOT NULL DEFAULT 0,
    descuento_porcentaje INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    imagen TEXT DEFAULT '',
    creado TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nombre TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    creado TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT DEFAULT NULL,
    ts TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accion TEXT NOT NULL,
    producto_id INTEGER,
    detalle TEXT DEFAULT '',
    chat_id TEXT DEFAULT '',
    ts TEXT DEFAULT (datetime('now'))
  );
`);

// Los NUEVOS pedidos arrancan en id 1000, sin renumerar los existentes.
// Solo empuja el contador AUTOINCREMENT; los pedidos actuales conservan su id.
try {
  const _p = db.prepare("SELECT MAX(id) AS mx, (SELECT seq FROM sqlite_sequence WHERE name='pedidos') AS seq FROM pedidos").get();
  const _target = Math.max(999, _p.mx || 0, _p.seq || 0);
  db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name='pedidos'").run(_target);
  if (db.prepare("SELECT changes() c").get().c === 0) {
    db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('pedidos', ?)").run(_target);
  }
} catch (e) { /* sqlite_sequence no existe aun si nunca hubo inserts */ }

// Columna para saber si el stock ya fue reservado al crear el pedido
try { db.exec("ALTER TABLE pedidos ADD COLUMN stock_reservado INTEGER DEFAULT 0"); } catch (e) {}

const contenidoDefault = {
   hero_titulo: "Suplementos Premium para tu Salud y Rendimiento",
   hero_descripcion: "Las mejores marcas de suplementos, vitaminas y proteinas. Envio rapido a todo Paraguay.",
   hero_imagen: "/img/logo/seiva-logo.png",
   hero_imagenes: "",
   stats_bar: JSON.stringify([
     { icon: "Star", value: "4.9", label: "Valoracion", fill: true },
     { icon: "Truck", value: "Envio Gratis", label: "En pedidos +Gs.150000", fill: false },
     { icon: "ShieldCheck", value: "Garantia", label: "30 dias de devolucion", fill: false },
     { icon: "Leaf", value: "Calidad", label: "Marcas certificadas", fill: false }
   ]),
   whatsapp_numero: "595992120303",
   whatsapp_mensaje: "Hola! Hice un pedido en la web y quiero confirmar mi compra.",
    site_titulo: "Seiva Paraguay — Suplementos, Vitaminas y Bienestar",
    site_descripcion: "Seiva Paraguay: suplementos, vitaminas, proteinas y productos para el bienestar. Envios a todo Paraguay. Pedi por WhatsApp.",
    site_logo: "/logo.png",
    site_favicon: "/favicon.svg",
   logo_height: "32",
   logo_fit: "contain",
  qr_activo: "",
  qr_imagen: "",
   transferencia_instrucciones: `<p><strong>Datos para transferencia:</strong></p>
<ul>
  <li><strong>Banco:</strong> [Tu banco]</li>
  <li><strong>Número de cuenta:</strong> [Tu número]</li>
  <li><strong>Titular:</strong> [Tu nombre/empresa]</li>
  <li><strong>RUC:</strong> [Tu RUC]</li>
</ul>
<p>Enviar comprobante por WhatsApp al <strong>0992 120 303</strong></p>`,
   efectivo_instrucciones: `<p><strong>Pago contra entrega:</strong></p>
<ul>
  <li>Pagás cuando recibís el producto</li>
  <li>Ten el monto exacto listo</li>
  <li>Verificá el pedido antes de pagar</li>
</ul>`,
   notification_sound: "",
   envio_minimo_gratis: "150000",
   pagos_instrucciones: `<p>Realizamos envíos a <strong>todo Paraguay</strong>.</p>
<p>Coordinamos el pago por WhatsApp al <strong>0992 120 303</strong>.</p>`,
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
try { db.exec("ALTER TABLE productos ADD COLUMN slug TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN featured_order INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN precio_proveedor INTEGER DEFAULT NULL"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN proveedor_updated_at TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN factura_origen TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN delivery_gratis INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE productos ADD COLUMN presentaciones TEXT DEFAULT '[]'"); } catch (e) {}

// Configurar búsqueda FTS5
const searchService = require("./search-service");
searchService.setupFts(db);

try { db.exec("ALTER TABLE pedidos ADD COLUMN envio_costo INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos ADD COLUMN envio_ciudad TEXT DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE envios ADD COLUMN tipo TEXT DEFAULT 'delivery'"); } catch (e) {}

// Normalizar marcas desde productos.marca
function normalizarMarcas() {
  try {
  const marcasExistentes = db.prepare("SELECT nombre FROM marcas").all().map(r => r.nombre.toLowerCase());
  const prods = db.prepare("SELECT DISTINCT marca FROM productos WHERE marca != '' AND marca IS NOT NULL").all();
  const insertMarca = db.prepare("INSERT OR IGNORE INTO marcas (nombre) VALUES (?)");
  for (const p of prods) {
    const nombre = p.marca.trim();
    if (nombre && marcasExistentes.indexOf(nombre.toLowerCase()) === -1) {
      insertMarca.run(nombre);
      marcasExistentes.push(nombre.toLowerCase());
    }
  }
  // Uniervas default prioridad=100 si existe
  db.prepare("UPDATE marcas SET prioridad = 1 WHERE LOWER(nombre) = 'uniervas' AND prioridad = 0").run();
  } catch(e) { console.warn("[normalizarMarcas] skip:", e.message); }
}
try { db.exec("ALTER TABLE marcas ADD COLUMN logo TEXT DEFAULT ''"); } catch (e) {}
normalizarMarcas();

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
  const checkProd = db.prepare("SELECT id FROM productos WHERE id = ?");
  for (const d of descuentosSeed) {
    try { if (checkProd.get(d[0])) insertDC.run(d[0], d[1], d[2], d[3]); } catch(e) {}
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
     ["Neuland", "Chaco", 0],
     ["Fuerte Olimpo", "Chaco", 0],
     ["Lolita", "Chaco", 0],
     ["Otra ciudad", "", 0],
  ];
  const insDelivery = db.prepare("INSERT INTO envios (ciudad, departamento, costo, tipo) VALUES (?, ?, ?, 'delivery')");
  for (const e of deliveryCiudades) insDelivery.run(e[0], e[1], e[2]);
  const insEncomienda = db.prepare("INSERT INTO envios (ciudad, departamento, costo, tipo) VALUES (?, ?, ?, 'encomienda')");
  for (const e of encomiendaCiudades) insEncomienda.run(e[0], e[1], e[2]);
}

const catCount = db.prepare("SELECT COUNT(*) as c FROM categorias").get();
if (catCount.c === 0) {
  const defCats = [["suplementos","suplementos","Suplementos"],["combos","combos","Combos"]];
  const ins = db.prepare("INSERT INTO categorias (nombre, slug, descripcion) VALUES (?, ?, ?)");
  for (const c of defCats) ins.run(c[0], c[1], c[2]);
  // Map existing category text to ID
  const prods = db.prepare("SELECT id, categoria FROM productos WHERE categoria_id IS NULL").all();
  const catMap = { suplementos: 1, combos: 2 };
  const upd = db.prepare("UPDATE productos SET categoria_id = ? WHERE id = ?");
  for (const p of prods) {
    const cid = catMap[p.categoria] || catMap["suplementos"];
    upd.run(cid, p.id);
  }
}

// Migration: move snacks products to suplementos
try {
  const snacksCount = db.prepare("SELECT COUNT(*) as c FROM productos WHERE categoria = 'snacks'").get();
  if (snacksCount.c > 0) {
    const supId = db.prepare("SELECT id FROM categorias WHERE nombre = 'suplementos'").get();
    if (supId) {
      db.prepare("UPDATE productos SET categoria = 'suplementos', categoria_id = ? WHERE categoria = 'snacks'").run(supId.id);
    } else {
      db.prepare("UPDATE productos SET categoria = 'suplementos' WHERE categoria = 'snacks'").run();
    }
    console.log("[Migration] " + snacksCount.c + " productos snacks movidos a suplementos");
  }
  db.prepare("DELETE FROM categorias WHERE nombre = 'snacks'").run();
} catch(e) { console.warn("[Migration] snacks skip:", e.message); }

// Migration: fix brands — maps product name suffix codes to real brand names
const brandMap = {
  "UE": "UniErvas", "UNIERVAS": "UniErvas",
  "RY": "Rei Terra", "REI": "Rei Terra",
  "UL": "Unilife", "UN": "Unilife",
  "AP": "ApisNutri",
  "NG": "NaturalGreen",
  "MX": "MixNutri", "MIX": "MixNutri",
  "V7": "Videira7",
  "BIO": "Bionutri",
  "FL": "Flora Nativa do Brasil", "FNB": "Flora Nativa do Brasil",
  "KT": "Katigua",
  "BA": "Balincer",
  "AB": "American Builders", "Americano": "American Builders",
  "ONE": "ONE FIT",
  "NB": "Naturalis Brasil",
  "AN": "Anil",
  "AD": "ADA Nutraceuticos",
  "SM": "Smart Nutrition",
  "DN": "Denature",
  "SW": "Copra"
};
function extractBrand(name) {
  const parts = name.trim().split(" ");
  const last = parts[parts.length - 1].replace(/[^a-zA-Z]/g, "");
  if (last.length <= 4 && brandMap[last]) return brandMap[last];
  const upper = last.toUpperCase();
  if (brandMap[upper]) return brandMap[upper];
  for (const kw of Object.keys(brandMap)) {
    if (kw.length > 3 && name.toLowerCase().includes(kw.toLowerCase())) return brandMap[kw];
  }
  return "";
}
// Fix all products with wrong/empty brands (runs every startup, idempotent)
try {
  const fixable = db.prepare("SELECT COUNT(*) as c FROM productos WHERE marca IS NULL OR marca = '' OR marca IN ('Magnesios','Gym','Vitaminas','Aceites','Naturales','Inmune','Cognitivo','Minerales','Omega3','Colagenos','Adaptogenos','Control-peso','Probióticos','Antioxidantes','General','Combos')").get().c;
  if (fixable > 0) {
    console.log("[Migration] Fixing " + fixable + " product brands...");
    const prods = db.prepare("SELECT id, nombre, marca FROM productos").all();
    const upd = db.prepare("UPDATE productos SET marca = ? WHERE id = ?");
    let fixed = 0;
    for (const p of prods) {
      const realBrand = extractBrand(p.nombre);
      if (realBrand && realBrand !== p.marca) {
        upd.run(realBrand, p.id);
        fixed++;
      }
    }
    console.log("[Migration] Fixed " + fixed + " brands");
    // Rebuild marcas with correct names + UniErvas priority
    try { normalizarMarcas(); } catch(e) {}
    // Clean up old category-as-brand entries
    db.prepare("DELETE FROM marcas WHERE nombre IN ('Magnesios','Gym','Vitaminas','Aceites','Naturales','Inmune','Cognitivo','Minerales','Omega3','Colagenos','Adaptogenos','Control-peso','Probióticos','Antioxidantes','General','Combos','')").run();
  }
} catch(e) { console.warn("[Migration] brand fix skip:", e.message); }

function stripHtml(html) { if (!html) return ""; return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
// Convierte un texto de precio ("R$ 76,75", "76.75", "1.234,56") a número con decimales.
function parsePrecio(s) {
  if (!s) return null;
  let t = String(s).trim();
  // millares con punto + decimales con coma (formato latino)
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
function slugify(text) { return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").substring(0, 60); }
function inferSubcat(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes("magnesio")) return "magnesios"; if (t.includes("omega")) return "omega3";
  if (t.includes("colageno") || t.includes("colágeno")) return "colagenos";
  if (t.includes("vitamina")) return "vitaminas"; if (t.includes("creatina")) return "gym";
  if (t.includes("curcuma") || t.includes("cúrcuma")) return "naturales";
  if (t.includes("oregano") || t.includes("orégano")) return "aceites";
  if (t.includes("potasio") || t.includes("zinc") || t.includes("selenio") || t.includes("cromo")) return "minerales";
  if (t.includes("resveratrol")) return "antioxidantes"; if (t.includes("probioticos")) return "probióticos";
  if (t.includes("ashwagandha") || t.includes("shilajit") || t.includes("maca")) return "adaptogenos";
  if (t.includes("testosterona") || t.includes("bcaa") || t.includes("carnitina")) return "gym";
  if (t.includes("ginkgo") || t.includes("nac") || t.includes("neumax")) return "cognitivo";
  if (t.includes("ozempic") || t.includes("berberina")) return "control-peso";
  if (t.includes("calostro") || t.includes("reishi")) return "inmune";
  if (t.includes("combo")) return "combos";
  return "general";
}

async function importFromWooCommerce() {
  let existing = db.prepare("SELECT COUNT(*) as c FROM productos").get().c;
  // Detect seed data — delete if only placeholder products
  const seedCheck = db.prepare("SELECT COUNT(*) as c FROM productos WHERE nombre IN ('Almendras con Chocolate Negro','Mix de Frutos Secos Premium','Datiles Medjool 400g')").get().c;
  if (existing > 0 && existing < 20 && seedCheck > 0) {
    console.log("[Import] Seed data detected — cleaning " + existing + " products...");
    db.prepare("DELETE FROM productos").run();
    existing = 0;
  }
  if (existing > 10) { console.log("[Import] DB has " + existing + " products, skipping"); return; }

  console.log("[Import] Fetching from WooCommerce...");
  const WC_URL = process.env.WC_URL || "https://seiva.com.py/wp-json/wc/v3";
  const WC_KEY = process.env.WC_KEY || "";
  const WC_SECRET = process.env.WC_SECRET || "";
  if (!WC_KEY || !WC_SECRET) {
    console.warn("[Import] WC_KEY/WC_SECRET not set in env vars. Skipping WooCommerce import.");
    return;
  }
  const auth = Buffer.from(WC_KEY + ":" + WC_SECRET).toString("base64");

  let products = [];
  let page = 1;
  while (true) {
    try {
      const res = await fetch(`${WC_URL}/products?per_page=100&page=${page}`, { headers: { Authorization: `Basic ${auth}` } });
      if (!res.ok) { console.warn("[Import] WC error:", res.status); break; }
      const data = await res.json();
      if (!data.length) break;
      products = products.concat(data);
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
      if (page >= totalPages) break;
      page++;
    } catch (e) { console.warn("[Import] fetch error:", e.message); break; }
  }
  console.log("[Import] Fetched " + products.length + " products");

  const https = require("https"), http = require("http");
  function downloadImg(url, dest) {
    return new Promise(resolve => {
      if (fs.existsSync(dest)) return resolve(true);
      const c = url.startsWith("https") ? https : http;
      c.get(url, { headers: { "User-Agent": "Seiva/1.0" } }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) return downloadImg(res.headers.location, dest).then(resolve);
        if (res.statusCode !== 200) return resolve(true);
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on("finish", () => { f.close(); resolve(true); });
      }).on("error", () => { try { fs.unlinkSync(dest); } catch(e) {} resolve(true); });
    });
  }

  const insert = db.prepare("INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, etiquetas, destacado, imagen, stock, activo, marca, slug, sku) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?)");

  let imported = 0;
  for (const wc of products) {
    const nombre = wc.name.trim();
    if (!nombre) continue;
    try {
      const precio = parseInt(wc.price) || 0;
      const reg = parseInt(wc.regular_price) || 0;
      const sale = parseInt(wc.sale_price) || 0;
      const pa = (sale && sale < reg) ? reg : null;
      const cat = nombre.toLowerCase().includes("combo") ? "combos" : "suplementos";
      const subcat = inferSubcat(nombre);
      const desc = stripHtml(wc.description || "");
      const tags = []; if (pa) tags.push("oferta"); if (wc.featured) tags.push("popular");
      const slug = slugify(nombre);
      const marca = extractBrand(nombre);
      let img = "";
      if (wc.images && wc.images.length > 0) {
        const ext = wc.images[0].src.split(".").pop().split("?")[0] || "jpg";
        img = slug + "." + ext;
        const dest = path.join(imgPath, img);
        await downloadImg(wc.images[0].src, dest);
      }
      insert.run(nombre, precio, pa, cat, subcat, desc, JSON.stringify(tags), wc.featured ? 1 : 0, img, wc.stock_quantity || 50, marca, slug, wc.sku || "");
      imported++;
    } catch(e) { console.warn("[Import] skip:", nombre, e.message); }
  }
  // Create brand entries
  if (imported > 0) {
    try { normalizarMarcas(); } catch(e) { console.warn("[Import] marcas error:", e.message); }
  }
  console.log("[Import] Done — imported " + imported + " products");
}

// Launch import async — only if explicitly requested via env var or DB is empty
if (process.env.IMPORT_FROM_WC === "true") {
  importFromWooCommerce().catch(e => console.warn("[Import] failed:", e.message));
} else {
  const _prodCount = db.prepare("SELECT COUNT(*) as c FROM productos").get();
  if (_prodCount.c === 0) {
    console.log("[Import] DB empty, importing from WooCommerce...");
    importFromWooCommerce().catch(e => console.warn("[Import] failed:", e.message));
  } else {
    console.log("[Import] Skipped (set IMPORT_FROM_WC=true to force import)");
  }
}

// Seed default admin user
const userCount = db.prepare("SELECT COUNT(*) as c FROM usuarios").get();
if (userCount.c === 0) {
  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO usuarios (username, password_hash, nombre) VALUES (?, ?, ?)").run("admin", adminHash, "Administrador");
  console.log("Default admin user created (username: admin)");
}

// ---------- AUTH ----------
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;
  
  if (username) {
    const user = db.prepare("SELECT * FROM usuarios WHERE username = ? AND activo = 1").get(username);
    if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrecta" });
    }
    const token = jwt.sign({ role: "admin", username: user.username, userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, username: user.username });
  }

  // Backward compat: login sin username (usa ADMIN_PASSWORD directo)
  if (!password || !bcrypt.compareSync(password, ADMIN_HASH)) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token });
});

// ---------- PUSH NOTIFICATIONS ----------
app.get("/api/push/vapid-public-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post("/api/push/subscribe", (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: "Datos de suscripción incompletos" });
  }
  db.prepare("INSERT OR REPLACE INTO push_subs (endpoint, p256dh, auth) VALUES (?, ?, ?)").run(
    endpoint, keys.p256dh, keys.auth
  );
  res.json({ ok: true });
});

app.delete("/api/push/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint || "");
  res.json({ ok: true });
});

app.post("/api/push/test", auth, (req, res) => {
  sendPushNotification(
    "Seiva Admin - Prueba",
    "Si ves esto, las notificaciones funcionan!",
    "/admin?tab=pedidos"
  );
  res.json({ ok: true, subscribers: db.prepare("SELECT COUNT(*) as c FROM push_subs").get().c });
});

// ---------- USUARIOS ----------
app.get("/api/usuarios", auth, (req, res) => {
  const rows = db.prepare("SELECT id, username, nombre, activo, creado FROM usuarios ORDER BY id").all();
  res.json(rows);
});

app.post("/api/usuarios", auth, (req, res) => {
  const { username, password, nombre } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username y password requeridos" });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare("INSERT INTO usuarios (username, password_hash, nombre) VALUES (?, ?, ?)").run(username, hash, nombre || "");
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: "El usuario ya existe" });
  }
});

app.put("/api/usuarios/:id", auth, (req, res) => {
  const { username, password, nombre, activo } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE usuarios SET username=?, password_hash=?, nombre=?, activo=? WHERE id=?").run(username, hash, nombre || "", activo !== false ? 1 : 0, req.params.id);
  } else {
    db.prepare("UPDATE usuarios SET username=?, nombre=?, activo=? WHERE id=?").run(username, nombre || "", activo !== false ? 1 : 0, req.params.id);
  }
  res.json({ ok: true });
});

app.delete("/api/usuarios/:id", auth, (req, res) => {
  db.prepare("DELETE FROM usuarios WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token requerido" });
  try {
    const decoded = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
    if (decoded.role !== "admin") throw new Error();
    next();
  } catch {
    logError("warn", "Auth failed: invalid token from " + (req.ip || "unknown"));
    res.status(401).json({ error: "Token invalido" });
  }
}

// [MIGRATION] Bot session store for n8n wizard FSM (replaces in-memory state).
db.exec(`CREATE TABLE IF NOT EXISTS bot_sessions (
  chat_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT '',
  draft TEXT NOT NULL DEFAULT '{}',
  updated TEXT NOT NULL DEFAULT (datetime('now'))
)`);
app.get("/api/bot-session/:chatId", auth, (req, res) => {
  const r = db.prepare("SELECT * FROM bot_sessions WHERE chat_id=?").get(req.params.chatId);
  res.json(r || {});
});
app.put("/api/bot-session/:chatId", auth, (req, res) => {
  try {
    const { state = "", draft = "{}" } = req.body || {};
    // production table may use updated_at instead of updated — detect once
    const cols = db.prepare("PRAGMA table_info(bot_sessions)").all().map(c => c.name);
    const updCol = cols.includes("updated") ? "updated" : "updated_at";
    db.prepare(`INSERT INTO bot_sessions (chat_id, state, draft, ${updCol})
      VALUES (?,?,?,datetime('now'))
      ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state, draft=excluded.draft, ${updCol}=datetime('now')`)
      .run(req.params.chatId, state, JSON.stringify(draft));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/bot-session/:chatId", auth, (req, res) => {
  db.prepare("DELETE FROM bot_sessions WHERE chat_id=?").run(req.params.chatId);
  res.json({ ok: true });
});

function parseVariantes(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    // Si es array de strings viejos, convertir a objetos
    return parsed.map(v => typeof v === "string" ? { nombre: v } : v);
  } catch { return []; }
}

function parseProducto(row, ctx) {
  let price_tiers;
  let marca = null;
  let marcaDescuentos = [];
  if (ctx) {
    // Datos precargados en lote (evita N+1 en listados de productos)
    price_tiers = (ctx.byProduct.get(row.id) || []).map(t => ({
      min_cantidad: t.min_cantidad, max_cantidad: t.max_cantidad, descuento: t.descuento
    }));
    if (row.marca != null) {
      const marcaId = ctx.marcaMap.get(String(row.marca).toLowerCase());
      if (marcaId != null) { marca = { id: marcaId }; marcaDescuentos = ctx.mdByMarca.get(marcaId) || []; }
    }
  } else {
    price_tiers = db.prepare("SELECT min_cantidad, max_cantidad, descuento FROM descuentos_cantidad WHERE producto_id = ? ORDER BY min_cantidad").all(row.id);
    if (row.marca) {
      marca = db.prepare("SELECT id FROM marcas WHERE LOWER(nombre) = LOWER(?) AND activo = 1").get(row.marca);
      if (marca) {
        const now = new Date().toISOString();
        marcaDescuentos = db.prepare(`
          SELECT * FROM descuentos_marca
          WHERE marca_id = ?
          AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
          AND (fecha_fin IS NULL OR fecha_fin >= ?)
          ORDER BY min_cantidad
        `).all(marca.id, now, now);
      }
    }
  }

  // Buscar descuentos por marca
  let marca_descuento = undefined;
  if (marca) {
    for (const md of marcaDescuentos) {
        const exclusiones = JSON.parse(md.exclusiones || "[]");
        const inclusiones = JSON.parse(md.inclusiones || "[]");
        // Si producto está en exclusiones, saltar
        if (exclusiones.indexOf(row.id) !== -1) continue;
        // Si hay inclusiones y producto no está, saltar
        if (inclusiones.length > 0 && inclusiones.indexOf(row.id) === -1) continue;

        // Guardar config cruda para que el carrito calcule cross-producto
        marca_descuento = {
          marca_id: marca.id,
          marca_nombre: row.marca,
          min_cantidad: md.min_cantidad,
          max_cantidad: md.max_cantidad,
          tipo_descuento: md.tipo_descuento,
          valor: md.valor,
          exclusiones: exclusiones,
          inclusiones: inclusiones,
          etiqueta: md.etiqueta || ""
        };

        let descuento = md.valor;
        if (md.tipo_descuento === "porcentaje") {
          descuento = Math.round(row.precio * md.valor / 100);
        }

        // Revisar si ya existe un tier para este rango — el mejor descuento gana
        const existingIdx = price_tiers.findIndex(t => t.min_cantidad === md.min_cantidad);
        if (existingIdx !== -1) {
          if (descuento > price_tiers[existingIdx].descuento) {
            price_tiers[existingIdx] = {
              min_cantidad: md.min_cantidad,
              max_cantidad: md.max_cantidad,
              descuento: descuento
            };
          }
        } else {
          price_tiers.push({
            min_cantidad: md.min_cantidad,
            max_cantidad: md.max_cantidad,
            descuento: descuento
});
        }
    }
    // Re-sort
    price_tiers.sort((a, b) => a.min_cantidad - b.min_cantidad);
  }

  return {
    ...row,
    etiquetas: JSON.parse(row.etiquetas || "[]"),
    galeria: JSON.parse(row.galeria || "[]"),
    variantes: parseVariantes(row.presentaciones),
    crosssell: JSON.parse(row.crosssell || "[]"),
    upsell: JSON.parse(row.upsell || "[]"),
    destacado: !!row.destacado,
    activo: !!row.activo,
    precio_anterior: row.precio_anterior || null,
    price_tiers: price_tiers.length > 0 ? price_tiers : undefined,
    marca_descuento: marca_descuento
  };
}

// Carga en una sola pasada los descuentos de cantidad, el mapa de marcas
// activas y los descuentos de marca para todo un lote de productos.
// Evita el patrón N+1 de parseProducto (antes: 2-3 queries por producto).
function loadDiscountBatches(rows) {
  const ctx = { byProduct: new Map(), marcaMap: new Map(), mdByMarca: new Map() };
  if (!rows || !rows.length) return ctx;
  const ids = rows.map(r => r.id);
  const ph = ids.map(() => "?").join(",");
  const descs = db.prepare(`SELECT producto_id, min_cantidad, max_cantidad, descuento FROM descuentos_cantidad WHERE producto_id IN (${ph}) ORDER BY min_cantidad`).all(...ids);
  for (const d of descs) {
    if (!ctx.byProduct.has(d.producto_id)) ctx.byProduct.set(d.producto_id, []);
    ctx.byProduct.get(d.producto_id).push({ min_cantidad: d.min_cantidad, max_cantidad: d.max_cantidad, descuento: d.descuento });
  }
  const marcas = db.prepare("SELECT id, LOWER(nombre) AS ln FROM marcas WHERE activo = 1").all();
  for (const m of marcas) if (!ctx.marcaMap.has(m.ln)) ctx.marcaMap.set(m.ln, m.id);
  const marcaIds = new Set();
  for (const r of rows) {
    if (r.marca != null) {
      const mid = ctx.marcaMap.get(String(r.marca).toLowerCase());
      if (mid != null) marcaIds.add(mid);
    }
  }
  if (marcaIds.size) {
    const mph = [...marcaIds].map(() => "?").join(",");
    const now = new Date().toISOString();
    const mds = db.prepare(`SELECT * FROM descuentos_marca WHERE marca_id IN (${mph}) AND (fecha_inicio IS NULL OR fecha_inicio <= ?) AND (fecha_fin IS NULL OR fecha_fin >= ?)`).all(...marcaIds, now, now);
    for (const md of mds) {
      if (!ctx.mdByMarca.has(md.marca_id)) ctx.mdByMarca.set(md.marca_id, []);
      ctx.mdByMarca.get(md.marca_id).push(md);
    }
  }
  return ctx;
}

// Versión batch de parseProducto: precarga los descuentos una vez.
function parseProductos(rows) {
  const ctx = loadDiscountBatches(rows);
  return rows.map(r => parseProducto(r, ctx));
}

// Generar slug único desde nombre
function generateSlug(nombre, excludeId = null) {
  let base = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
  
  if (!base) base = 'producto';
  
  let slug = base;
  let counter = 1;
  while (true) {
    const existing = db.prepare("SELECT id FROM productos WHERE slug = ? AND id != ?").get(slug, excludeId || 0);
    if (!existing) break;
    counter++;
    slug = base + '-' + counter;
  }
  return slug;
}

// Backfill slugs para productos existentes
function backfillSlugs() {
  const productos = db.prepare("SELECT id, nombre FROM productos WHERE slug = '' OR slug IS NULL").all();
  for (const p of productos) {
    const slug = generateSlug(p.nombre, p.id);
    db.prepare("UPDATE productos SET slug = ? WHERE id = ?").run(slug, p.id);
  }
  if (productos.length > 0) {
    console.log(`[Backfill] ${productos.length} slugs generados`);
  }
}

// ---------- UPLOADS ----------
app.get("/api/ping", (req, res) => res.json({ pong: true, ts: Date.now() }));

// Canal SSE para notificar al admin en tiempo real (suena la notificación
// aunque el usuario no haya autorizado el push). Token por query param.
app.get("/api/admin-events", (req, res) => {
  try {
    const decoded = jwt.verify(req.query.token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(401).end();
  } catch (e) {
    return res.status(401).end();
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write("retry: 5000\n\n");
  sseClients.add(res);
  const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 20000);
  req.on("close", () => { clearInterval(ping); sseClients.delete(res); });
});
app.post("/api/upload-qr", auth, qrUpload.single("qr"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se subió imagen" });
  try {
    const url = await imageService.processQrImage(req.file.path);
    res.json({ url });
  } catch (err) {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(err.status || 400).json({ error: err.message || "Error al procesar imagen" });
  }
}, (err, req, res, next) => {
  // Multer error handler for QR upload
  const msg = err.code === 'LIMIT_FILE_SIZE' ? "Imagen muy grande (max 5MB)" :
              err.message?.startsWith("FormFileError") || err.message?.includes("image") ? "Formato no permitido" :
              "Error al subir imagen";
  res.status(400).json({ error: msg });
});

app.post("/api/upload-sound", auth, soundUpload.single("sound"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se subió audio" });
  res.json({ url: "/img/productos/" + req.file.filename });
}, (err, req, res, next) => {
  const msg = err.code === 'LIMIT_FILE_SIZE' ? "Audio muy grande (max 5MB)" :
              (err.message && err.message.includes("audio")) ? "Formato no permitido" :
              "Error al subir audio";
  res.status(400).json({ error: msg });
});

app.post("/api/upload-hero", auth, heroUpload.single("hero"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió imagen" });
    const url = await imageService.processUploadImage(req.file.path);
    res.json({ url, variants: imageService.SIZES });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Error al procesar imagen" });
  }
}, (err, req, res, next) => {
  // Multer error handler for hero upload
  const msg = err.code === 'LIMIT_FILE_SIZE' ? "Imagen muy grande (max 10MB)" :
              err.message?.startsWith("FormFileError") || err.message?.includes("image") ? "Formato no permitido" :
              "Error al subir imagen";
  res.status(400).json({ error: msg });
});

// [MIGRATION] Endpoint for n8n to store Telegram product photos.
const productUpload = multer({
  storage: multer.diskStorage({
    destination: imgPath,
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^\w.-]/g, "_"))
  }),
  limits: { fileSize: 12 * 1024 * 1024 }
});
app.post("/api/product-image", auth, productUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se subió imagen" });
    const url = await imageService.processUploadImage(req.file.path);
    res.json({ path: url });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Error al procesar imagen" });
  }
}, (err, req, res, next) => {
  const msg = err.code === 'LIMIT_FILE_SIZE' ? "Imagen muy grande (max 12MB)" :
              err.message?.startsWith("FormFileError") || err.message?.includes("image") ? "Formato no permitido" :
              "Error al subir imagen";
  res.status(400).json({ error: msg });
});

// Descarga una imagen externa, la guarda temporalmente y la procesa con
// imageService (genera WebP + variantes). Devuelve el path local tipo
// /img/productos/hero-...webp o null si falla.
async function downloadAndProcessImage(imgUrl) {
  if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const origin = new URL(imgUrl).origin;
    const response = await fetch(imgUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*",
        "Referer": origin,
      },
      redirect: "follow",
    });
    if (!response.ok) { console.warn("[downloadImage] HTTP", response.status, imgUrl); return null; }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length < 500) { console.warn("[downloadImage] imagen vacía", imgUrl); return null; }
    const sig = buf.slice(0, 4).toString("hex");
    const isImg = sig.startsWith("89504e47") || sig.startsWith("ffd8ff") || (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP");
    if (!isImg) { console.warn("[downloadImage] no es imagen", imgUrl, sig); return null; }
    const tmp = path.join(__dirname, "img", "productos", "tmp-dl-" + crypto.randomBytes(6).toString("hex") + ".jpg");
    fs.writeFileSync(tmp, buf);
    try {
      const localPath = await imageService.processUploadImage(tmp);
      return localPath;
    } finally {
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    }
  } catch (e) {
    console.warn("[downloadImage] error", imgUrl, e.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- PRODUCTOS ----------
app.get("/api/productos", (req, res) => {
  res.set("Cache-Control", "public, max-age=0, s-maxage=30");
  const rows = db.prepare(`
    SELECT p.*, COALESCE(m.prioridad, 0) as marca_prioridad
    FROM productos p
    LEFT JOIN marcas m ON LOWER(p.marca) = LOWER(m.nombre) AND m.activo = 1
    WHERE p.activo = 1
    ORDER BY
      CASE WHEN p.stock > 0 THEN 0 ELSE 1 END,
      marca_prioridad ASC,
      p.destacado DESC,
      p.id DESC
  `).all();
  const result = parseProductos(rows);
  result.forEach(r => { delete r.precio_proveedor; delete r.marca_prioridad; });
  res.json(result);
});

app.get("/api/productos/destacados", (req, res) => {
  const rows = db.prepare("SELECT * FROM productos WHERE featured_order > 0 AND activo = 1 ORDER BY featured_order ASC LIMIT 8").all();
  const result = parseProductos(rows);
  result.forEach(r => { delete r.precio_proveedor; delete r.marca_prioridad; });
  res.json(result);
});

app.get("/api/productos/combos", (req, res) => {
  const rows = db.prepare("SELECT * FROM productos WHERE activo = 1 ORDER BY id DESC").all();
  const combos = rows.filter(r => {
    const tags = JSON.parse(r.etiquetas || "[]");
    return tags.includes("combo");
  });
  res.json(parseProductos(combos));
});

app.get("/api/productos/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM productos ORDER BY id DESC").all();
  res.json(parseProductos(rows));
});

app.post("/api/productos", auth, async (req, res) => {
  try {
    let { nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell, slug, featured_order, precio_proveedor, delivery_gratis, variantes, presentaciones } = req.body;
    const variantesData = variantes || presentaciones || [];
    if (!nombre || !precio) return res.status(400).json({ error: "Nombre y precio requeridos" });

    // Descargar imagen principal si es URL externa
    if (imagen && /^https?:\/\//i.test(imagen)) {
      const local = await downloadAndProcessImage(imagen);
      imagen = local || "";
    }

    // Descargar galería si contiene URLs externas
    const rawGaleria = Array.isArray(galeria) ? galeria : [];
    const processedGaleria = [];
    for (const img of rawGaleria) {
      if (img && /^https?:\/\//i.test(img)) {
        const local = await downloadAndProcessImage(img);
        if (local) processedGaleria.push(local);
      } else if (img) {
        processedGaleria.push(img);
      }
    }

    const cid = categoria_id || null;
    const catName = categoria || (cid ? db.prepare("SELECT nombre FROM categorias WHERE id=?").get(cid)?.nombre : "suplementos") || "suplementos";
    const finalSlug = slug || generateSlug(nombre);
    const fo = parseInt(featured_order) || 0;
    const pp = (precio_proveedor !== undefined && precio_proveedor !== null && precio_proveedor !== '') ? parseFloat(precio_proveedor) : null;
    const result = db.prepare("INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell, slug, featured_order, precio_proveedor, delivery_gratis, presentaciones) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      nombre, precio, precio_anterior || null, catName, subcategoria || "", descripcion || "", descripcion_larga || "", JSON.stringify(processedGaleria), JSON.stringify(etiquetas || []), destacado ? 1 : 0, imagen || "", stock || 0, activo !== false ? 1 : 0, cid, sku || "", marca || "", seo_descripcion || "", JSON.stringify(crosssell || []), JSON.stringify(upsell || []), finalSlug, fo, pp, delivery_gratis ? 1 : 0, JSON.stringify(variantesData)
    );
    res.json({ id: result.lastInsertRowid, slug: finalSlug });
  } catch (err) {
    logError("error", "POST /api/productos", err.message);
    res.status(500).json({ error: "Error al crear: " + err.message });
  }
});

app.put("/api/productos/:id", auth, (req, res) => {
  try {
    const { nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, categoria_id, sku, marca, seo_descripcion, crosssell, upsell, slug, featured_order, precio_proveedor, delivery_gratis, variantes } = req.body;
    const cid = categoria_id !== undefined ? categoria_id : null;
    const catName = categoria || (cid ? db.prepare("SELECT nombre FROM categorias WHERE id=?").get(cid)?.nombre : "suplementos") || "suplementos";
    const finalSlug = slug || (nombre ? generateSlug(nombre, req.params.id) : undefined);
    const fo = parseInt(featured_order) || 0;
    const pp = precio_proveedor !== undefined ? (precio_proveedor !== null && precio_proveedor !== '' ? parseFloat(precio_proveedor) : null) : undefined;
    
    if (finalSlug) {
      const sql = "UPDATE productos SET nombre=?, precio=?, precio_anterior=?, categoria=?, subcategoria=?, descripcion=?, descripcion_larga=?, galeria=?, etiquetas=?, destacado=?, imagen=?, stock=?, activo=?, categoria_id=?, sku=?, marca=?, seo_descripcion=?, crosssell=?, upsell=?, slug=?, featured_order=?" + (pp !== undefined ? ", precio_proveedor=?" : "") + " WHERE id=?";
      const params = [nombre, precio, precio_anterior || null, catName, subcategoria, descripcion || "", descripcion_larga || "", JSON.stringify(galeria || []), JSON.stringify(etiquetas || []), destacado ? 1 : 0, imagen || "", stock || 0, activo !== false ? 1 : 0, cid, sku || "", marca || "", seo_descripcion || "", JSON.stringify(crosssell || []), JSON.stringify(upsell || []), finalSlug, fo];
      if (pp !== undefined) params.push(pp);
      params.push(req.params.id);
      db.prepare(sql).run(...params);
    } else {
      const sql = "UPDATE productos SET nombre=?, precio=?, precio_anterior=?, categoria=?, subcategoria=?, descripcion=?, descripcion_larga=?, galeria=?, etiquetas=?, destacado=?, imagen=?, stock=?, activo=?, categoria_id=?, sku=?, marca=?, seo_descripcion=?, crosssell=?, upsell=?, featured_order=?" + (pp !== undefined ? ", precio_proveedor=?" : "") + " WHERE id=?";
      const params = [nombre, precio, precio_anterior || null, catName, subcategoria, descripcion || "", descripcion_larga || "", JSON.stringify(galeria || []), JSON.stringify(etiquetas || []), destacado ? 1 : 0, imagen || "", stock || 0, activo !== false ? 1 : 0, cid, sku || "", marca || "", seo_descripcion || "", JSON.stringify(crosssell || []), JSON.stringify(upsell || []), fo];
      if (pp !== undefined) params.push(pp);
      params.push(req.params.id);
      db.prepare(sql).run(...params);
    }
    if (delivery_gratis !== undefined) {
      db.prepare("UPDATE productos SET delivery_gratis = ? WHERE id = ?").run(delivery_gratis ? 1 : 0, req.params.id);
    }
    if (variantes !== undefined) {
      db.prepare("UPDATE productos SET presentaciones = ? WHERE id = ?").run(JSON.stringify(variantes || []), req.params.id);
    }
    res.json({ ok: true, slug: finalSlug });
  } catch (err) {
    logError("error", "PUT /api/productos/" + req.params.id, err.message);
    res.status(500).json({ error: "Error al guardar: " + err.message });
  }
});

app.patch("/api/productos/:id/toggle", auth, (req, res) => {
  const row = db.prepare("SELECT activo FROM productos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  const nuevo = row.activo ? 0 : 1;
  db.prepare("UPDATE productos SET activo = ? WHERE id = ?").run(nuevo, req.params.id);
  res.json({ activo: !!nuevo });
});

app.patch("/api/productos/:id/featured", auth, (req, res) => {
  const { featured_order } = req.body;
  db.prepare("UPDATE productos SET featured_order = ? WHERE id = ?").run(parseInt(featured_order) || 0, req.params.id);
  res.json({ ok: true });
});

// Batch stock update
app.patch("/api/productos/stock-batch", auth, (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: "updates debe ser un array" });
  
  const updateStmt = db.prepare("UPDATE productos SET stock = ? WHERE id = ?");
  for (const item of updates) {
    updateStmt.run(item.stock, item.id);
  }
  res.json({ ok: true, updated: updates.length });
});

app.delete("/api/productos/:id", auth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });

    // Verificar si productos_fts existe (puede no existir en versiones antiguas)
    const ftsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='productos_fts'").get();

    // Transacción manual (node:sqlite no tiene db.transaction)
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM descuentos_cantidad WHERE producto_id = ?").run(id);
      db.prepare("DELETE FROM promos WHERE producto_id = ?").run(id);
      db.prepare("DELETE FROM promos WHERE regala_producto_id = ?").run(id);
      db.prepare("DELETE FROM contenido WHERE key = 'hero_producto_id' AND value = ?").run(String(id));
      if (ftsExists) {
        db.prepare("DELETE FROM productos_fts WHERE rowid = ?").run(id);
      }
      db.prepare("DELETE FROM productos WHERE id = ?").run(id);
      db.exec("COMMIT");
    } catch (innerErr) {
      db.exec("ROLLBACK");
      throw innerErr;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE producto]", e.message);
    res.status(500).json({ error: "Error al eliminar producto: " + e.message });
  }
});

// ---------- MARCAS ----------
app.get("/api/marcas", (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, COUNT(p.id) as total_productos
    FROM marcas m
    LEFT JOIN productos p ON LOWER(p.marca) = LOWER(m.nombre)
    WHERE m.activo = 1
    GROUP BY m.id
    ORDER BY m.prioridad ASC, m.nombre ASC
  `).all();
  res.json(rows);
});

app.get("/api/marcas/all", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, COUNT(p.id) as total_productos
    FROM marcas m
    LEFT JOIN productos p ON LOWER(p.marca) = LOWER(m.nombre)
    GROUP BY m.id
    ORDER BY m.nombre ASC
  `).all();
  res.json(rows);
});

app.put("/api/marcas/:id", auth, (req, res) => {
  const { prioridad, activo, logo } = req.body;
  const updates = [];
  const params = [];
  if (prioridad !== undefined) { updates.push("prioridad = ?"); params.push(prioridad); }
  if (activo !== undefined) { updates.push("activo = ?"); params.push(activo ? 1 : 0); }
  if (logo !== undefined) { updates.push("logo = ?"); params.push(logo); }
  if (updates.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
  params.push(req.params.id);
  db.prepare("UPDATE marcas SET " + updates.join(", ") + " WHERE id = ?").run(...params);
  res.json({ ok: true });
});

app.post("/api/marcas", auth, (req, res) => {
  const { nombre, prioridad, logo } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  const result = db.prepare("INSERT INTO marcas (nombre, prioridad, logo) VALUES (?, ?, ?)").run(
    nombre, parseInt(prioridad) || 0, logo || ""
  );
  res.json({ id: result.lastInsertRowid });
});

app.delete("/api/marcas/:id", auth, (req, res) => {
  db.prepare("DELETE FROM marcas WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/marcas/normalizar", auth, (req, res) => {
  normalizarMarcas();
  res.json({ ok: true });
});

// ---------- SCRAPE PRODUCTO ----------
function sanitizeHtml(html) {
  if (!html) return '';
  // Remove event handlers and javascript: URLs
  return html
    .replace(/\s(on\w+)=["'][^"']*["']/gi, '')
    .replace(/\s(on\w+)=[^\s>]*/gi, '')
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src=["']javascript:[^"']*["']/gi, 'src=""');
}

function formatDescription(rawText) {
  if (!rawText) return '';
  
  // Si ya es HTML con estructura válida, sanitizar
  if (/<(ul|li|strong|b|em|h[1-6])[\s>]/i.test(rawText) && /<\/(ul|li|strong|b|em|h[1-6])>/i.test(rawText)) {
    return sanitizeHtml(rawText);
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

function isValidScrapeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return false;
    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.') || host.startsWith('169.254.')) return false;
    return true;
  } catch { return false; }
}

async function downloadImage(imgUrl, nombre) {
  if (!isValidScrapeUrl(imgUrl)) throw new Error('URL no permitida');
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
    logError("warn", "Image download failed: " + imgUrl, error.message);
    return null;
  }
}

async function scrapeProductData(url) {
   try {
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
     const response = await fetch(url, {
       headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
       },
       signal: controller.signal
     });
     clearTimeout(timeout);
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
    // Limpiar etiqueta "Marca:"/"Brand:" y espacios sobrantes
    marca = String(marca).replace(/^(marca|brand)\s*:?\s*/i, '').replace(/\s+/g, ' ').trim();
    if (marca.length > 50 || /^(sin marca|-|n\/a)$/i.test(marca)) marca = '';

    // Extraer SKU
    let sku = $('meta[property="product:sku"]').attr('content') ||
              $('meta[itemprop="sku"]').attr('content') ||
              $('[itemprop="sku"]').text().trim() ||
              $('.sku, .referencia, [class*="sku"], [class*="referencia"]').first().text().trim() ||
              '';
    // Limpiar SKU
    if (sku.length > 50) sku = '';

    // Extraer SEO descripción
    let seo_descripcion = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') ||
                          '';
    // Limitar a 160 chars
    if (seo_descripcion.length > 160) seo_descripcion = seo_descripcion.substring(0, 157) + '...';

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

    // Extraer precio (conserva decimales: "76,75" -> 76.75)
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
          precio = parsePrecio(match[0]);
          if (precio > 0) break;
        }
      }
    }
    // Fallback: buscar en todo el body
    if (!precio) {
      const bodyText = $('body').text();
      const precioMatch = bodyText.match(/Gs\.?\s*([\d.,]+)/i) || 
                         bodyText.match(/PYG\s*([\d.,]+)/i) ||
                         bodyText.match(/\$\s*([\d.,]+)/i) ||
                         bodyText.match(/R\$\s*([\d.,]+)/i);
      if (precioMatch) {
        precio = parsePrecio(precioMatch[1]);
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

    // === GALERÍA: extraer múltiples imágenes del producto ===
    const galeria = [];
    try {
      const seen = new Set();
      const imgSrcs = [];
      $('img').each(function () {
        let src = $(this).attr('src') || $(this).attr('data-src') || $(this).attr('data-original') || '';
        if (!src) return;
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('/')) src = new URL(url).origin + src;
        if (!/^https?:\/\//.test(src)) return;
        if (/logo|placeholder|avatar|icon|favicon|spinner|loader/i.test(src)) return;
        if (/\.(svg|gif|ico)\b/i.test(src)) return;
        imgSrcs.push(src);
      });
      for (const s of imgSrcs) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (galeria.length >= 8) break;
        // no repetir la imagen principal
        if (s === imagenUrl) continue;
        try {
          const local = await downloadImage(s, nombre + '-gal');
          if (local) galeria.push(local);
        } catch (e) { /* seguir con la siguiente */ }
      }
    } catch (e) { /* galería opcional */ }

    // === Moneda del precio (sitio brasileño devuelve R$, no Gs) ===
    let moneda = '';
    try {
      const bodyTxt = $('body').text();
      if (/R\$\s?\d/i.test(bodyTxt)) moneda = 'BRL';
      else if (/Gs\.?\s?\d|PYG/i.test(bodyTxt)) moneda = 'PYG';
      else if (/U\$S?\s?\d/i.test(bodyTxt)) moneda = 'USD';
      else if (/\u20ac\s?\d/i.test(bodyTxt)) moneda = 'EUR';
    } catch (e) {}

    // Formatear descripciones
    if (!descCorta.includes('<ul>') && !descCorta.includes('<li>')) {
      descCorta = formatDescription(descCorta);
    }
    descLarga = formatDescriptionLarga(descLarga);

    return {
      nombre: nombre.substring(0, 200),
      marca: marca,
      sku: sku,
      seo_descripcion: seo_descripcion,
      descripcion: descCorta,
      descripcion_larga: descLarga,
      precio: precio,
      moneda: moneda,
      imagen: imagenLocal || imagenUrl,
      galeria: galeria,
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

  if (!isValidScrapeUrl(url)) {
    return res.status(400).json({ error: "URL no permitida. Solo URLs públicas HTTP/HTTPS." });
  }

  try {
    const data = await scrapeProductData(url);
    res.json(data);
  } catch (error) {
    console.error('Error en scrape-product:', error);
    logError("error", "Scrape failed: " + url, error.message);
    res.status(500).json({ error: "Error al scrapear la URL", details: error.message });
  }
});

// ---------- DESCUENTOS POR CANTIDAD ----------
app.get("/api/descuentos", (req, res) => {
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

// ---------- DESCUENTOS POR MARCA ----------
app.get("/api/descuentos-marca", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT dm.*, m.nombre as marca_nombre
    FROM descuentos_marca dm
    JOIN marcas m ON dm.marca_id = m.id
    ORDER BY m.nombre
  `).all();
  res.json(rows.map(r => ({
    ...r,
    exclusiones: JSON.parse(r.exclusiones || "[]"),
    inclusiones: JSON.parse(r.inclusiones || "[]")
  })));
});

app.post("/api/descuentos-marca", auth, (req, res) => {
  const { marca_id, tipo_descuento, valor, min_cantidad, max_cantidad, exclusiones, inclusiones, fecha_inicio, fecha_fin, etiqueta, audiencia } = req.body;
  if (!marca_id) return res.status(400).json({ error: "marca_id requerido" });
  const result = db.prepare("INSERT INTO descuentos_marca (marca_id, tipo_descuento, valor, min_cantidad, max_cantidad, exclusiones, inclusiones, fecha_inicio, fecha_fin, etiqueta, audiencia) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    marca_id,
    tipo_descuento || "monto_fijo",
    parseInt(valor) || 0,
    parseInt(min_cantidad) || 1,
    max_cantidad ? parseInt(max_cantidad) : null,
    JSON.stringify(exclusiones || []),
    JSON.stringify(inclusiones || []),
    fecha_inicio || null,
    fecha_fin || null,
    etiqueta || "",
    audiencia || "todos"
  );
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/descuentos-marca/:id", auth, (req, res) => {
  const { marca_id, tipo_descuento, valor, min_cantidad, max_cantidad, exclusiones, inclusiones, fecha_inicio, fecha_fin, etiqueta, audiencia } = req.body;
  db.prepare("UPDATE descuentos_marca SET marca_id=?, tipo_descuento=?, valor=?, min_cantidad=?, max_cantidad=?, exclusiones=?, inclusiones=?, fecha_inicio=?, fecha_fin=?, etiqueta=?, audiencia=? WHERE id=?").run(
    marca_id,
    tipo_descuento || "monto_fijo",
    parseInt(valor) || 0,
    parseInt(min_cantidad) || 1,
    max_cantidad ? parseInt(max_cantidad) : null,
    JSON.stringify(exclusiones || []),
    JSON.stringify(inclusiones || []),
    fecha_inicio || null,
    fecha_fin || null,
    etiqueta || "",
    audiencia || "todos",
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/descuentos-marca/:id", auth, (req, res) => {
  db.prepare("DELETE FROM descuentos_marca WHERE id = ?").run(req.params.id);
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
  const noms = productos.map(p => p.cantidad + "x " + p.nombre).join(", ");
  sendPushNotification(
    "Venta registrada #" + result.lastInsertRowid,
    (cliente || "Cliente") + " — Gs." + (total || 0).toLocaleString("es-PY") + " — " + noms,
    "/admin?tab=historico"
  );
  broadcastEvent("new-venta", { id: result.lastInsertRowid, cliente: cliente, total: total || 0 });
});

// ---------- STATS ----------
app.get("/api/stats", auth, (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const semanaInicio = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const mesInicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Las ventas reales = ventas manuales (tabla ventas) + pedidos del sitio (no cancelados)
  const salesSum = (since) => {
    const v = db.prepare("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad FROM ventas WHERE fecha >= ?").get(since);
    const p = db.prepare("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad FROM pedidos WHERE fecha >= ? AND estado != 'cancelado'").get(since);
    return { total: v.total + p.total, cantidad: v.cantidad + p.cantidad };
  };
  const ventasHoy = salesSum(hoy);
  const ventasSemana = salesSum(semanaInicio);
  const ventasMes = salesSum(mesInicio);
  const productosCount = db.prepare("SELECT COUNT(*) as c FROM productos WHERE activo = 1").get();

  const ultimasVentas = db.prepare("SELECT id, fecha, cliente, productos, total, metodo_pago, whatsapp, 'venta' as origen FROM ventas ORDER BY fecha DESC LIMIT 10").all();
  const ultimasPedidos = db.prepare("SELECT id, fecha, cliente, productos, total, metodo_pago, whatsapp, 'pedido' as origen FROM pedidos WHERE estado != 'cancelado' ORDER BY fecha DESC LIMIT 10").all();
  const ultimas_ventas = ultimasVentas.concat(ultimasPedidos)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .slice(0, 10)
    .map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") }));

  // Calcular ganancias estimadas 30 días (ventas + pedidos)
  const todasMesV = db.prepare("SELECT productos, total FROM ventas WHERE fecha >= ?").all(mesInicio);
  const todasMesP = db.prepare("SELECT productos, total FROM pedidos WHERE fecha >= ? AND estado != 'cancelado'").all(mesInicio);
  const todasMes = todasMesV.concat(todasMesP);
  let gananciasMes = 0;
  let costoTotalMes = 0;
  let ventasConCosto = 0;
  for (const v of todasMes) {
    const prods = JSON.parse(v.productos || "[]");
    let costoVenta = 0;
    for (const p of prods) {
      if (p.precio_proveedor) {
        costoVenta += p.precio_proveedor * (p.cantidad || 1);
      }
    }
    costoTotalMes += costoVenta;
    if (costoVenta > 0) {
      gananciasMes += (v.total - costoVenta);
      ventasConCosto++;
    }
  }
  // Valor inventario (productos activos con precio proveedor)
  const inventario = db.prepare("SELECT COALESCE(SUM(stock * precio_proveedor), 0) as total FROM productos WHERE activo = 1 AND stock > 0 AND precio_proveedor IS NOT NULL AND precio_proveedor > 0").get();

  res.json({
    hoy: ventasHoy,
    semana: ventasSemana,
    mes: ventasMes,
    productos_activos: productosCount.c,
    ganancias_mes: gananciasMes,
    costo_mes: costoTotalMes,
    ventas_con_costo: ventasConCosto,
    valor_inventario: inventario.total,
    ultimas_ventas: ultimas_ventas
  });
});

app.get("/api/stats/top-productos", auth, (req, res) => {
  const mesInicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const ventas = db.prepare("SELECT productos FROM ventas WHERE fecha >= ?").all(mesInicio);
  const pedidos = db.prepare("SELECT productos FROM pedidos WHERE fecha >= ? AND estado != 'cancelado'").all(mesInicio);
  const conteo = {};
  for (const v of ventas.concat(pedidos)) {
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
app.get("/api/contenido", (req, res) => {
  // No cache: el contenido cambia con cada edición del admin (logo, favicon, hero).
  // Si Cloudflare hace edge-cache de esta ruta, los cambios tardan horas en verse.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
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

// ---------- HERO PRODUCT (ProductFeatured) ----------
app.get("/api/hero-producto", (req, res) => {
  const row = db.prepare("SELECT value FROM contenido WHERE key = ?").get("hero_producto_id");
  if (!row || !row.value) return res.json(null);
  const prod = db.prepare("SELECT * FROM productos WHERE id = ? AND activo = 1").get(parseInt(row.value));
  if (!prod) return res.json(null);
  res.json(parseProducto(prod));
});

// Búsqueda en el panel admin (productos para hero, destacados, etc.)
// Usa FTS5 + fuzzy matching.
app.get("/api/hero-producto/search", auth, (req, res) => {
  const q = req.query.q || "";
  if (q.length < 2) return res.json([]);
  const rows = searchService.search(db, q, 20);
  res.json(rows);
});

// Búsqueda pública en la tienda (sin auth)
app.get("/api/search", (req, res) => {
  const q = req.query.q || "";
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (q.length < 2) return res.json({ query: q, results: [], count: 0 });
  const results = searchService.search(db, q, limit);
  res.json({ query: q, results, count: results.length });
});

// Sugerencias para typeahead (rápido, sin fuzzy)
app.get("/api/search/suggest", (req, res) => {
  const q = req.query.q || "";
  if (q.length < 2) return res.json({ query: q, suggestions: [] });
  const suggestions = searchService.suggest(db, q, 5);
  res.json({ query: q, suggestions });
});

app.put("/api/hero-producto", auth, (req, res) => {
  const { producto_id } = req.body;
  const update = db.prepare("INSERT OR REPLACE INTO contenido (key, value) VALUES (?, ?)");
  update.run("hero_producto_id", String(producto_id || ""));
  res.json({ ok: true });
});

// ---------- STATS BAR ----------
app.get("/api/stats-bar", (req, res) => {
  const row = db.prepare("SELECT value FROM contenido WHERE key = ?").get("stats_bar");
  if (row?.value) {
    try { res.json(JSON.parse(row.value)); }
    catch { res.json([]); }
  } else {
    res.json([]);
  }
});
app.put("/api/stats-bar", auth, (req, res) => {
  const upd = db.prepare("INSERT OR REPLACE INTO contenido (key, value) VALUES (?, ?)");
  upd.run("stats_bar", JSON.stringify(req.body.stats || []));
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
  db.prepare("UPDATE productos SET categoria_id = NULL, activo = 0 WHERE categoria_id = ?").run(req.params.id);
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
app.post("/api/pedidos", pedidoLimiter, (req, res) => {
  const { cliente, whatsapp, direccion, productos, total, metodo_pago, notas } = req.body;
  if (!cliente || !whatsapp || !productos || !productos.length) {
    return res.status(400).json({ error: "Cliente, whatsapp y productos requeridos" });
  }
  const result = db.prepare(
    "INSERT INTO pedidos (cliente, whatsapp, direccion, productos, total, metodo_pago, notas) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    cliente, whatsapp, direccion || "", JSON.stringify(productos), total || 0, metodo_pago || "whatsapp", notas || ""
  );
  // Reservar stock al crear el pedido: el producto pasa a "agotado" si llega a 0
  for (const p of productos) {
    if (p.id && p.cantidad) {
      db.prepare("UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?").run(p.cantidad, p.id);
    }
  }
  db.prepare("UPDATE pedidos SET stock_reservado = 1 WHERE id = ?").run(result.lastInsertRowid);
  res.json({ id: result.lastInsertRowid, estado: "pendiente" });
  // Notificación push
  const prodNames = productos.map(p => p.cantidad + "x " + p.nombre).join(", ");
  sendPushNotification(
    "Nuevo pedido #" + result.lastInsertRowid,
    cliente + " — Gs." + (total || 0).toLocaleString("es-PY") + " — " + prodNames,
    "/admin?tab=pedidos"
  );
  broadcastEvent("new-pedido", { id: result.lastInsertRowid, cliente: cliente, total: total || 0 });
});

// ---------- CARRITOS ABANDONADOS ----------
// Generar token de sesión único
function generateToken() {
  return 'cart_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

app.post("/api/carritos", carritoLimiter, (req, res) => {
  const { session_token, productos, whatsapp } = req.body;
  if (!productos || !productos.length) return res.status(400).json({ error: "Productos requeridos" });

  var phone = (whatsapp || '').toString().trim();
  // Solo registrar en el panel si hay número de teléfono (para poder recuperar el carrito)
  if (!phone) {
    return res.json({ token: session_token || generateToken(), saved: false, reason: "no_phone" });
  }

  var token = session_token || generateToken();

  // Actualizar si ya existe este token
  var existing = db.prepare("SELECT id FROM carritos WHERE session_token = ?").get(token);
  if (existing) {
    db.prepare("UPDATE carritos SET productos = ?, whatsapp = ?, creado = datetime('now'), notificado = 0 WHERE id = ?").run(
      JSON.stringify(productos),
      phone,
      existing.id
    );
  } else {
    db.prepare("INSERT INTO carritos (session_token, productos, whatsapp) VALUES (?, ?, ?)").run(
      token,
      JSON.stringify(productos),
      phone
    );
  }

  res.json({ token, saved: true });
});

app.get("/api/carritos", auth, (req, res) => {
  var rows = db.prepare(`
    SELECT * FROM carritos
    WHERE creado > datetime('now', '-7 days')
    ORDER BY creado DESC
  `).all();
  res.json(rows.map(function(r) {
    return { ...r, productos: JSON.parse(r.productos || "[]") };
  }));
});

app.delete("/api/carritos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM carritos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- PROMOS ----------
app.get("/api/promos", (req, res) => {
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT * FROM promos
    WHERE activo = 1
    AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
    AND (fecha_fin IS NULL OR fecha_fin >= ?)
    ORDER BY prioridad ASC, id DESC
  `).all(now, now);
  res.json(rows);
});

app.get("/api/promos/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM promos ORDER BY activo DESC, id DESC").all();
  res.json(rows);
});

app.post("/api/promos", auth, (req, res) => {
  const { tipo, nombre, producto_id, marca_id, compra_min_cantidad, compra_min_monto, regala_cantidad, regala_producto_id, descuento_valor, descuento_tipo, cupon_codigo, cupon_usos_max, fecha_inicio, fecha_fin } = req.body;
  if (!tipo || !nombre) return res.status(400).json({ error: "Tipo y nombre requeridos" });
  const result = db.prepare(`
    INSERT INTO promos (tipo, nombre, producto_id, marca_id, compra_min_cantidad, compra_min_monto, regala_cantidad, regala_producto_id, descuento_valor, descuento_tipo, cupon_codigo, cupon_usos_max, fecha_inicio, fecha_fin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    tipo, nombre,
    producto_id || null, marca_id || null,
    compra_min_cantidad || 1, compra_min_monto || 0,
    regala_cantidad || 0, regala_producto_id || null,
    descuento_valor || 0, descuento_tipo || 'monto_fijo',
    cupon_codigo || null, cupon_usos_max || null,
    fecha_inicio || null, fecha_fin || null
  );
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/promos/:id", auth, (req, res) => {
  const { tipo, nombre, producto_id, marca_id, compra_min_cantidad, compra_min_monto, regala_cantidad, regala_producto_id, descuento_valor, descuento_tipo, cupon_codigo, cupon_usos_max, fecha_inicio, fecha_fin, activo } = req.body;
  db.prepare(`
    UPDATE promos SET tipo=?, nombre=?, producto_id=?, marca_id=?, compra_min_cantidad=?, compra_min_monto=?, regala_cantidad=?, regala_producto_id=?, descuento_valor=?, descuento_tipo=?, cupon_codigo=?, cupon_usos_max=?, fecha_inicio=?, fecha_fin=?, activo=? WHERE id=?
  `).run(
    tipo, nombre,
    producto_id || null, marca_id || null,
    compra_min_cantidad || 1, compra_min_monto || 0,
    regala_cantidad || 0, regala_producto_id || null,
    descuento_valor || 0, descuento_tipo || 'monto_fijo',
    cupon_codigo || null, cupon_usos_max || null,
    fecha_inicio || null, fecha_fin || null,
    activo !== undefined ? (activo ? 1 : 0) : 1,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/promos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM promos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.patch("/api/promos/:id/toggle", auth, (req, res) => {
  const row = db.prepare("SELECT activo FROM promos WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrada" });
  const nuevo = row.activo ? 0 : 1;
  db.prepare("UPDATE promos SET activo = ? WHERE id = ?").run(nuevo, req.params.id);
  res.json({ activo: !!nuevo });
});

app.post("/api/cupones/validar", (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ error: "Código requerido" });
  const now = new Date().toISOString();
  const cupon = db.prepare(`
    SELECT * FROM promos WHERE cupon_codigo = ? AND activo = 1
    AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
    AND (fecha_fin IS NULL OR fecha_fin >= ?)
    AND (cupon_usos_max IS NULL OR cupon_usos_actuales < cupon_usos_max)
  `).get(codigo, now, now);
  if (!cupon) return res.status(404).json({ error: "Cupón inválido o expirado" });
  res.json({ 
    id: cupon.id,
    descuento_valor: cupon.descuento_valor,
    descuento_tipo: cupon.descuento_tipo,
    minimo_compra: cupon.compra_min_monto
  });
});

// ---------- BUNDLES ----------
app.get("/api/bundles", (req, res) => {
  const rows = db.prepare("SELECT * FROM bundles WHERE activo = 1 ORDER BY id DESC").all();
  res.json(rows.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") })));
});

app.get("/api/bundles/all", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM bundles ORDER BY id DESC").all();
  res.json(rows.map(r => ({ ...r, productos: JSON.parse(r.productos || "[]") })));
});

app.post("/api/bundles", auth, (req, res) => {
  const { nombre, productos, precio_bundle, descuento_porcentaje, imagen } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  const result = db.prepare("INSERT INTO bundles (nombre, productos, precio_bundle, descuento_porcentaje, imagen) VALUES (?,?,?,?,?)").run(
    nombre, JSON.stringify(productos || []), precio_bundle || 0, descuento_porcentaje || 0, imagen || ""
  );
  res.json({ id: result.lastInsertRowid });
});

app.put("/api/bundles/:id", auth, (req, res) => {
  const { nombre, productos, precio_bundle, descuento_porcentaje, imagen, activo } = req.body;
  db.prepare("UPDATE bundles SET nombre=?, productos=?, precio_bundle=?, descuento_porcentaje=?, imagen=?, activo=? WHERE id=?").run(
    nombre, JSON.stringify(productos || []), precio_bundle || 0, descuento_porcentaje || 0, imagen || "",
    activo !== undefined ? (activo ? 1 : 0) : 1,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/bundles/:id", auth, (req, res) => {
  db.prepare("DELETE FROM bundles WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.patch("/api/bundles/:id/toggle", auth, (req, res) => {
  const row = db.prepare("SELECT activo FROM bundles WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  const nuevo = row.activo ? 0 : 1;
  db.prepare("UPDATE bundles SET activo = ? WHERE id = ?").run(nuevo, req.params.id);
  res.json({ activo: !!nuevo });
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

  const prods = JSON.parse(pedido.productos || "[]");
  const reservado = pedido.stock_reservado;

  // Cancelar: reponer stock si estaba reservado (modelo nuevo) o era confirmado (modelo viejo)
  if (estado === "cancelado" && pedido.estado !== "cancelado") {
    if (reservado || pedido.estado === "confirmado") {
      for (const p of prods) {
        if (p.id && p.cantidad) {
          db.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?").run(p.cantidad, p.id);
        }
      }
    }
    db.prepare("UPDATE pedidos SET estado = ?, stock_reservado = 0 WHERE id = ?").run(estado, req.params.id);
  } else {
    // Confirmar/enviar/entregar ya no mueve el stock (se reservó al crear el pedido)
    db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(estado, req.params.id);
  }
  res.json({ ok: true, estado });
});

app.delete("/api/pedidos/:id", auth, (req, res) => {
  db.prepare("DELETE FROM pedidos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- STOCK ALERTAS ----------
app.get("/api/stock-alertas", auth, (req, res) => {
  const limite = parseInt(req.query.limite) || 10;
  const rows = db.prepare("SELECT id, nombre, stock, marca FROM productos WHERE stock <= ? AND activo = 1 ORDER BY stock ASC").all(limite);
  res.json(rows);
});

// ---------- ERROR LOG ----------
app.get("/api/error-logs", auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.prepare("SELECT * FROM error_logs ORDER BY id DESC LIMIT ?").all(limit);
  res.json(logs);
});
app.delete("/api/error-logs", auth, (req, res) => {
  db.prepare("DELETE FROM error_logs").run();
  res.json({ ok: true });
});

// ---------- AUDIT LOG (registro de cambios del bot de inventario) ----------
app.post("/api/audit", auth, (req, res) => {
  try {
    const { accion, producto_id, detalle, chat_id } = req.body || {};
    if (!accion) return res.status(400).json({ error: "accion requerida" });
    db.prepare("INSERT INTO audit_log (accion, producto_id, detalle, chat_id) VALUES (?,?,?,?)")
      .run(accion, producto_id || null, JSON.stringify(detalle || {}), chat_id || "");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/audit", auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit);
  res.json(rows);
});

// ---------- TELEGRAM BOT WEBHOOK ----------
app.post("/api/telegram/webhook", (req, res) => {
  // Verify secret token. If TELEGRAM_WEBHOOK_SECRET is not set, reject always
  // (undefined !== undefined would otherwise let anyone post without a token).
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  telegramBot.handleWebhook(req.body);
  res.json({ ok: true });
});

// Request error logger
app.use(function(err, req, res, next) {
  console.error("[ERROR]", req.method, req.url, err.message);
  logError("error", req.method + " " + req.url + " — " + err.message, err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
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
// No cachear el SW ni el JS del admin: un SW obsoleto (que fetched recursos
// externos) no debe quedar cacheado en el edge (Cloudflare lo guardaba 4h).
app.use("/bd-backpanel", express.static(adminPath, {
  maxAge: 0,
  setHeaders: function (res, filePath) {
    if (/[\\/](sw\.js|pwa\.js|admin\.js)$/.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

let distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  // New deployment: serve React SPA + API-only backend
  // Cache de HTML en el edge: las rutas sin extensión (documentos) llevan
  // s-maxage para que Cloudflare las sirva desde el edge y no golpee el origen.
  app.use((req, res, next) => {
    if (req.method === "GET" &&
        !req.path.startsWith("/api") && !req.path.startsWith("/admin") &&
        !req.path.startsWith("/bd-backpanel") &&
        !path.extname(req.path)) {
      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    }
    next();
  });
  app.use(express.static(distPath, { maxAge: "1y", immutable: true }));

  // Server-side Open Graph injection for product pages.
  // Link crawlers (WhatsApp, Facebook, etc.) don't execute JS, so the SPA's
  // client-side meta tags are never seen — they only get the static index.html
  // (which ships the store logo). We inject product-specific OG tags into the
  // raw HTML for /producto/:slug so shared links preview the actual product image.
  var indexHtmlCache = null;
  function getIndexHtml() {
    if (indexHtmlCache === null) {
      try { indexHtmlCache = fs.readFileSync(path.join(distPath, "index.html"), "utf8"); }
      catch (e) { indexHtmlCache = ""; }
    }
    return indexHtmlCache;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function stripHtml(s) {
    return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  var OG_BASE = "https://seiva.com.py";

  app.get(/^\/producto\/([^/]+)\/?$/, function (req, res) {
    var slug = req.params[0];
    var product = null;
    try {
      product = db.prepare(
        "SELECT nombre, precio, descripcion, seo_descripcion, imagen FROM productos WHERE activo = 1 AND (slug = ? OR id = ?) LIMIT 1"
      ).get(slug, Number(slug) || -1);
    } catch (e) { product = null; }

    var html = getIndexHtml();
    if (!html) { return res.sendFile(path.join(distPath, "index.html")); }

    var img = OG_BASE + "/logo.png";
    if (product && product.imagen) {
      img = product.imagen.indexOf("http") === 0 ? product.imagen : OG_BASE + product.imagen;
    }
    var title = (product ? product.nombre : "Seiva Paraguay") + " - Seiva Paraguay";
    var desc = product
      ? (product.seo_descripcion || stripHtml(product.descripcion).substring(0, 160) || "")
      : "Snacks saludables y suplementos naturales. Envíos a todo Paraguay.";
    var url = OG_BASE + (req.path.charAt(req.path.length - 1) === "/" ? req.path.slice(0, -1) : req.path);

    var og = [
      "<title>" + escapeHtml(title) + "</title>",
      '<meta name="description" content="' + escapeHtml(desc) + '" />',
      '<meta property="og:title" content="' + escapeHtml(title) + '" />',
      '<meta property="og:description" content="' + escapeHtml(desc) + '" />',
      '<meta property="og:image" content="' + escapeHtml(img) + '" />',
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta property="og:url" content="' + escapeHtml(url) + '" />',
      '<meta property="og:type" content="' + (product ? "product" : "website") + '" />',
      product ? '<meta property="product:price:amount" content="' + escapeHtml(product.precio) + '" />' : "",
      product ? '<meta property="product:price:currency" content="PYG" />' : "",
      '<meta name="twitter:card" content="summary_large_image" />',
      '<meta name="twitter:title" content="' + escapeHtml(title) + '" />',
      '<meta name="twitter:description" content="' + escapeHtml(desc) + '" />',
      '<meta name="twitter:image" content="' + escapeHtml(img) + '" />'
    ].join("\n    ");

    var out = html
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name="description"[^>]*>/gi, "")
      .replace(/<meta\s+property="og:[^>]*>/gi, "")
      .replace(/<meta\s+property="product:[^>]*>/gi, "")
      .replace(/<meta\s+name="twitter:[^>]*>/gi, "");
    out = out.replace(/(<head[^>]*>)/i, "$1\n    " + og + "\n  ");

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(out);
  });

  // Dynamic XML sitemap (homepage + all active products) for search engines.
  app.get("/sitemap.xml", function (req, res) {
    var base = "https://seiva.com.py";
    var urls = [base + "/"];
    try {
      var rows = db.prepare(
        "SELECT slug FROM productos WHERE activo = 1 AND slug IS NOT NULL AND slug != ''"
      ).all();
      rows.forEach(function (r) {
        urls.push(base + "/producto/" + encodeURIComponent(r.slug));
      });
    } catch (e) { /* ignore */ }
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(function (u) {
      xml += "  <url><loc>" + escapeHtml(u) + "</loc></url>\n";
    });
    xml += "</urlset>\n";
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  });

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

// Backfill slugs al iniciar
backfillSlugs();

app.listen(PORT, () => {
  console.log("Seiva backend running on http://localhost:" + PORT);
  console.log("Admin: http://localhost:" + PORT + "/admin");

  // Setup Telegram webhook if configured
  // [SEIVA] Webhook lo gestiona n8n (bot de carga de productos). Comentado para
  // evitar que el backend pise el webhook de n8n cada vez que reinicia.
  // if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_URL) {
  //   telegramBot.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
  // }
});
