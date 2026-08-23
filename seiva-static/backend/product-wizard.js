// Asistente de carga rápida de productos para Telegram (panel de alta).
// Reutiliza: db (sqlite), image-service (processUploadImage), scrapeProductData,
// y los helpers de envío de telegram-bot.
//
// Estados (FSM):
//   AWAIT_SOURCE -> recolecta foto o link
//   COLLECT      -> (solo si el usuario elige Editar un campo a mano)
//   GALLERY      -> acepta fotos extra o "listo"
//   GENERATE     -> genera copy con copy-provider
//   PREVIEW      -> muestra ficha + foto y botones Publicar/Editar/Cancelar
//   EDIT_FIELD   -> edita un campo y vuelve a PREVIEW
//
// Mejoras (build alta-nl):
//   - Lenguaje natural: parsea precio/stock/marca/categoria del mensaje junto al link.
//   - Marca y categoría se matchean contra la DB y se CREAN automáticamente si no existen.
//   - Imagen robusta: usa el archivo que ya bajó el scrape; si es URL, reintenta con headers; nunca crashea.
//   - Después de scrape+NL va DIRECTO al PREVIEW (con foto) antes de publicar.

const fs = require("fs");
const path = require("path");
const copyProvider = require("./copy-provider");
const stubProvider = require("./copy-provider.stub");

let CTX = null;

function init(ctx) {
  CTX = ctx; // { db, imgPath, publicBase, tg, downloadImage, scrapeProductData, processUploadImage, generateSlug }
  CTX.db.exec(`CREATE TABLE IF NOT EXISTS bot_sessions (
    chat_id INTEGER PRIMARY KEY,
    state TEXT NOT NULL,
    draft TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
}

function load(chatId) {
  const row = CTX.db.prepare("SELECT state, draft, updated_at FROM bot_sessions WHERE chat_id = ?").get(chatId);
  if (!row) return null;
  // Expiración: sesión de más de 30 min se descarta (evita sesiones huérfanas trabando el chat).
  try {
    const ageMs = Date.now() - new Date(row.updated_at + "Z").getTime();
    if (ageMs > 30 * 60 * 1000) {
      clear(chatId);
      return null;
    }
  } catch (e) { /* updated_at inválido: no descartar */ }
  let draft = {};
  try { draft = JSON.parse(row.draft); } catch (e) {}
  return { state: row.state, draft };
}

function save(chatId, state, draft) {
  CTX.db.prepare(`INSERT INTO bot_sessions (chat_id, state, draft, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(chat_id) DO UPDATE SET state=excluded.state, draft=excluded.draft, updated_at=datetime('now')`).run(
    chatId, state, JSON.stringify(draft));
}

function clear(chatId) {
  CTX.db.prepare("DELETE FROM bot_sessions WHERE chat_id = ?").run(chatId);
}

function hasSession(chatId) {
  return !!load(chatId);
}

function newDraft() {
  return { imagenes: [], datos_tecnicos: {}, datos: {}, source: null, copy: {}, marca_id: null, categoria_id: null };
}

function startProduct(chatId) {
  const draft = newDraft();
  save(chatId, "AWAIT_SOURCE", draft);
  return CTX.tg.sendMessage(chatId,
    "📦 <b>Carga rápida de producto</b>\n\n" +
    "Envianos una <b>foto</b> del producto o un <b>link</b> (otra tienda, marketplace o red social).\n" +
    "Podés escribir junto al link los datos: <i>precio 60mil stock 5 marca V7 Energy categoria suplementos</i>.",
    { reply_markup: { inline_keyboard: [[
      { text: "📸 Mandar foto", callback_data: "wz_hint_photo" },
      { text: "🔗 Mandar link", callback_data: "wz_hint_link" },
    ]] } });
}

function imgUrl(filename) {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  return CTX.publicBase.replace(/\/$/, "") + "/img/productos/" + path.basename(filename);
}

const COPY_FIELDS = ["titulo", "descripcion_corta", "descripcion_larga"];
const BRL_RATE = parseInt(process.env.BRL_RATE, 10) || 1200;

async function handleUpdate(update) {
  try {
    if (update.message) return await onMessage(update.message);
    if (update.callback_query) return await onCallback(update.callback_query);
  } catch (e) {
    console.error("[Wizard] error:", e.message, "| stack:", (e.stack || "").split("\n").slice(0, 3).join(" <- "));
  }
  return false;
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || "";
  const session = load(chatId);

  if (CTX.allowedChats && CTX.allowedChats.length && !CTX.allowedChats.includes(chatId)) {
    return CTX.tg.sendMessage(chatId,
      "⛔ <b>No autorizado.</b> Tu chat ID es <code>" + chatId + "</code>.\n" +
      "Agregalo a <code>TELEGRAM_ALLOWED_CHATS</code> en Dokploy (separá varios con coma) y redeploy.\n" +
      "Si ya lo agregaste, verificá que sea el número exacto (sin @, sin espacios).");
  }

  if (text === "/cargar" || text === "/nuevo" || text === "/producto" || /^\s*preview\s*$/i.test(text)) {
    if (session && session.state === "PREVIEW") return renderPreview(chatId, session.draft);
    return startProduct(chatId);
  }

  if (!session) {
    // Lenguaje natural: "subir producto", "cargar un producto", "nuevo producto"
    if (/(subir|cargar|agregar|crear|publicar)\s+(un\s+|una\s+|el\s+|la\s+)?(nuevo\s+|nueva\s+)?producto|nuevo\s+producto|producto\s+nuevo/i.test(text)) {
      return startProduct(chatId);
    }
    // Sin comando: si manda foto o link, arrancamos el alta directo y vamos al preview.
    const url = extractUrl(text);
    if (msg.photo && msg.photo.length) {
      const draft = newDraft();
      save(chatId, "AWAIT_SOURCE", draft);
      try {
        return await receivePhoto(chatId, draft, msg);
      } catch (e) {
        console.error("[Wizard] receivePhoto crasheo:", e.message);
        return generateAndPreview(chatId, draft);
      }
    }
    if (url) {
      const draft = newDraft();
      save(chatId, "AWAIT_SOURCE", draft);
      try {
        return await receiveLink(chatId, draft, url, text);
      } catch (e) {
        console.error("[Wizard] receiveLink crasheo:", e.message);
        return generateAndPreview(chatId, draft);
      }
    }
    return false;
  }

  const { state, draft } = session;

  if (state === "AWAIT_SOURCE") {
    if (msg.photo && msg.photo.length) {
      try { return await receivePhoto(chatId, draft, msg); }
      catch (e) { console.error("[Wizard] receivePhoto crasheo:", e.message); return generateAndPreview(chatId, draft); }
    }
    const url = extractUrl(text);
    if (url) {
      try { return await receiveLink(chatId, draft, url, text); }
      catch (e) { console.error("[Wizard] receiveLink crasheo:", e.message); return generateAndPreview(chatId, draft); }
    }
    return CTX.tg.sendMessage(chatId, "No entendí. Envianos una foto 📸 o un link 🔗 del producto.");
  }

  if (state === "PREVIEW") {
    // Si manda otro link/foto estando en preview -> reemplaza el producto.
    if (msg.photo && msg.photo.length) {
      clear(chatId);
      const d = newDraft(); save(chatId, "AWAIT_SOURCE", d);
      try { return await receivePhoto(chatId, d, msg); }
      catch (e) { return generateAndPreview(chatId, d); }
    }
    const url = extractUrl(text);
    if (url) {
      clear(chatId);
      const d = newDraft(); save(chatId, "AWAIT_SOURCE", d);
      try { return await receiveLink(chatId, d, url, text); }
      catch (e) { return generateAndPreview(chatId, d); }
    }
    if (/^\s*(publicar|subir|confirmar|si|sí|yes)\s*$/i.test(text)) return await publish(chatId, draft);
    if (/^\s*(cancelar|borrar|eliminar|no)\s*$/i.test(text)) { clear(chatId); return CTX.tg.sendMessage(chatId, "🚫 Carga cancelada."); }
    if (/^\s*(editar|corregir|cambiar|modificar)\s*$/i.test(text)) return sendEditMenu(chatId, draft);
    return CTX.tg.sendMessage(chatId,
      "📋 Está en <b>vista previa</b>. Usá los botones ✅ Publicar / ✏️ Editar / ❌ Cancelar.\n" +
      "O mandame otro link/foto para reemplazar este producto.");
  }

  if (state === "COLLECT") return await receiveField(chatId, draft, text);

  if (state === "GALLERY") {
    if (msg.photo && msg.photo.length) {
      await receivePhoto(chatId, draft, msg, true);
      return CTX.tg.sendMessage(chatId, `✅ Foto agregada (${draft.imagenes.length} en total). Mandá más o escribí <b>LISTO</b>.`);
    }
    if (/^\s*listo\s*$/i.test(text)) return await generateAndPreview(chatId, draft);
    return CTX.tg.sendMessage(chatId, "Mandá más fotos o escribí <b>LISTO</b> para continuar.");
  }

  if (state === "EDIT_FIELD") {
    const field = draft._editField;
    if (COPY_FIELDS.includes(field)) draft.copy[field] = text.trim();
    else draft.datos[field] = text.trim();
    delete draft._editField;
    // Si editó marca/categoria, re-matchear contra DB.
    if (field === "marca") {
      const m = matchMarca(draft.datos.marca);
      draft.marca_id = m.id; draft.datos.marca = m.nombre;
    }
    if (field === "categoria") {
      const c = matchCategoria(draft.datos.categoria);
      draft.categoria_id = c.id; draft.datos.categoria = c.nombre;
    }
    save(chatId, "PREVIEW", draft);
    return renderPreview(chatId, draft);
  }

  return false;
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

// ---------- Parseo de lenguaje natural ----------
// Del mensaje del usuario extrae: precio (Gs), stock, marca, categoria, presentacion.
// Tolera palabras de relleno ("precio es 60 mil", "marca su precio...").
const STOPWORDS = new Set(["su", "el", "la", "los", "las", "mi", "tu", "otra", "uno", "una", "lo", "de", "es", "suya", "nuestra", "nuestro"]);

function parseMarca(text) {
  // Patrón A: "V7 energy es su marca" -> la marca es lo que antecede a "es su marca"
  let m = text.match(/([\w.éíóúñ\- ]+?)\s+es\s+su\s+marca/i);
  if (m) { const x = m[1].trim(); if (x && !STOPWORDS.has(x.toLowerCase())) return x; }
  // Patrón A2: "su marca es V7 energy"
  m = text.match(/su\s+marca\s+es\s+([\w.éíóúñ\- ]+)/i);
  if (m) { const x = m[1].trim(); if (x && !STOPWORDS.has(x.toLowerCase())) return x; }
  // Patrón B: "marca X" / "marca: X" (X corto, sin palabras de relleno)
  m = text.match(/(?:marca|brand)\s*:?\s+([\w.éíóúñ\-]+)/i);
  if (m) { const x = m[1].trim(); if (x && !STOPWORDS.has(x.toLowerCase())) return x; }
  return null;
}

function parseCategoria(text) {
  const m = text.match(/(?:categor[ií]a|category|cat)\w*\s*:?\s+([\w.éíóúñ\-]+)/i);
  if (m) { const x = m[1].trim(); if (x && !STOPWORDS.has(x.toLowerCase())) return x; }
  return null;
}

function parsePrecio(text) {
  // Buscar "precio" y, en los ~40 chars siguientes, un número (opcional "mil").
  const idx = text.toLowerCase().indexOf("precio");
  if (idx >= 0) {
    const after = text.slice(idx, idx + 40);
    const mm = after.match(/(\d[\d.]*)\s*mil|(\d[\d.]*)/i);
    if (mm) {
      let raw = (mm[1] || mm[2] || "").replace(/\./g, "").replace(/\s/g, "");
      if (/mil/i.test(mm[0])) raw = String(parseInt(raw, 10) * 1000);
      const n = parseInt(raw, 10);
      if (n > 0) return n;
    }
  }
  // "gs 60000" o "60000 gs"
  let m = text.match(/gs\.?\s*(\d[\d.]*)/i) || text.match(/(\d[\d.]*)\s*gs\b/i);
  if (m) { const n = parseInt(m[1].replace(/\./g, ""), 10); if (n > 0) return n; }
  return null;
}

function parseMessageForProduct(text) {
  const out = {};
  const t = " " + (text || "").toLowerCase() + " ";
  // precio público (Gs)
  const precio = parsePrecio(text);
  if (precio) out.precio = precio;
  // precio proveedor en reales: "proveedor 30 reales", "30 reales"
  const provRe = /prov[eé]edor\s+(\d[\d.,]*)\s*(?:reales?|r\$|\$)?|(\d[\d.,]*)\s*reales?/;
  const prm = t.match(provRe);
  if (prm) {
    const raw = (prm[1] || prm[2] || "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw);
    if (n > 0) out.precio_proveedor = Math.round(n * BRL_RATE);
  }
  // stock: "stock 5", "stock:5", "5 unidades"
  const stockRe = /stock\s*:?\s*(\d+)|(\d+)\s*unidades/;
  const sm = t.match(stockRe);
  if (sm) {
    const n = parseInt(sm[1] || sm[2], 10);
    if (n >= 0) out.stock = n;
  }
  const marca = parseMarca(text);
  if (marca) out.marca = marca;
  const cat = parseCategoria(text);
  if (cat) out.categoria = cat;
  return out;
}

function extractTech(text) {
  const out = {};
  const m = text.match(/(\d+\s?(?:mg|g|ml|lb|cápsulas|caps|comprimidos|capsulas))/gi);
  if (m) out.presentacion = m.slice(0, 3).join(", ");
  return out;
}

// ---------- Match / auto-creación de marca y categoría ----------
function matchMarca(text) {
  if (!text || !text.trim()) return { id: null, nombre: "" };
  const nombre = text.trim().replace(/\s+/g, " ");
  try {
    const row = CTX.db.prepare("SELECT id, nombre FROM marcas WHERE LOWER(nombre)=LOWER(?) AND activo=1").get(nombre);
    if (row) return { id: row.id, nombre: row.nombre };
    const like = CTX.db.prepare("SELECT id, nombre FROM marcas WHERE LOWER(?) LIKE '%'||LOWER(nombre)||'%' AND activo=1 LIMIT 1").get(nombre);
    if (like) return { id: like.id, nombre: like.nombre };
    CTX.db.prepare("INSERT OR IGNORE INTO marcas (nombre, prioridad, activo) VALUES (?,0,1)").run(nombre);
    const nr = CTX.db.prepare("SELECT id, nombre FROM marcas WHERE LOWER(nombre)=LOWER(?)").get(nombre);
    return { id: nr ? nr.id : null, nombre };
  } catch (e) { return { id: null, nombre }; }
}

function matchCategoria(text) {
  if (!text || !text.trim()) return { id: null, nombre: "suplementos" };
  const nombre = text.trim().replace(/\s+/g, " ");
  try {
    const row = CTX.db.prepare("SELECT id, nombre FROM categorias WHERE LOWER(nombre)=LOWER(?) AND activo=1").get(nombre);
    if (row) return { id: row.id, nombre: row.nombre };
    const like = CTX.db.prepare("SELECT id, nombre FROM categorias WHERE LOWER(?) LIKE '%'||LOWER(nombre)||'%' AND activo=1 LIMIT 1").get(nombre);
    if (like) return { id: like.id, nombre: like.nombre };
    const slug = (CTX.generateSlug ? CTX.generateSlug(nombre) : slugify(nombre)) || ("cat-" + Date.now());
    CTX.db.prepare("INSERT OR IGNORE INTO categorias (nombre, slug, descripcion, activo) VALUES (?,?,?,1)").run(nombre, slug, "");
    const nr = CTX.db.prepare("SELECT id, nombre FROM categorias WHERE LOWER(nombre)=LOWER(?)").get(nombre);
    return { id: nr ? nr.id : null, nombre };
  } catch (e) { return { id: null, nombre: "suplementos" }; }
}

// ---------- Recepción de foto ----------
async function receivePhoto(chatId, draft, msg, extra = false) {
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const file = await CTX.tg.getFile(fileId);
  if (!file.ok) return CTX.tg.sendMessage(chatId, "No pude leer la foto. Probá de nuevo.");
  const buf = await CTX.tg.downloadFile(file.result.file_path);
  const tmp = path.join(CTX.imgPath, "tmp-" + Date.now() + ".jpg");
  fs.writeFileSync(tmp, buf);
  const out = await CTX.processUploadImage(tmp);
  if (!out) return CTX.tg.sendMessage(chatId, "Error procesando la imagen.");
  draft.imagenes.push({ filename: out, principal: draft.imagenes.length === 0 });
  if (!extra) {
    draft.source = "foto";
    const vals = parseMessageForProduct(msg.caption || msg.text || "");
    if (vals.precio) draft.datos.precio = vals.precio;
    if (vals.stock !== undefined) draft.datos.stock = vals.stock;
    if (vals.precio_proveedor) draft.datos.precio_proveedor = vals.precio_proveedor;
    if (vals.marca) { const m = matchMarca(vals.marca); draft.marca_id = m.id; draft.datos.marca = m.nombre; }
    if (vals.categoria) { const c = matchCategoria(vals.categoria); draft.categoria_id = c.id; draft.datos.categoria = c.nombre; }
    return generateAndPreview(chatId, draft);
  }
  save(chatId, "GALLERY", draft);
}

// ---------- Recepción de link ----------
async function receiveLink(chatId, draft, url, text) {
  draft.source = "link";
  draft.url_origen = url;
  let data = null;
  try {
    data = await CTX.scrapeProductData(url);
  } catch (e) {
    console.warn("[Wizard] scrape falló, continuamos con NL:", e.message);
  }

  // Datos base del scrape (si lo hubo).
  const base = data || {};
  draft.datos = Object.assign({
    nombre: base.nombre || "",
    marca: base.marca || "",
    precio: "",
    presentacion: "",
    stock: 0,
    categoria: "suplementos",
  }, draft.datos);

  // Presentación automática desde el nombre scrapeado.
  const tech = extractTech((base.nombre || "") + " " + (base.descripcion || ""));
  if (tech.presentacion && !draft.datos.presentacion) draft.datos.presentacion = tech.presentacion;

  // Merge con lenguaje natural del mensaje del usuario (gana el usuario si lo dice).
  const vals = parseMessageForProduct(text || "");
  if (vals.precio) draft.datos.precio = vals.precio;
  if (vals.stock !== undefined) draft.datos.stock = vals.stock;
  if (vals.precio_proveedor) draft.datos.precio_proveedor = vals.precio_proveedor;
  if (vals.marca) { const m = matchMarca(vals.marca); draft.marca_id = m.id; draft.datos.marca = m.nombre; }
  if (vals.categoria) { const c = matchCategoria(vals.categoria); draft.categoria_id = c.id; draft.datos.categoria = c.nombre; }

  // Marca/categoría del scrape si el usuario no las dio.
  if (!draft.datos.marca && base.marca) { const m = matchMarca(base.marca); draft.marca_id = m.id; draft.datos.marca = m.nombre; }
  if ((!draft.datos.categoria || draft.datos.categoria === "suplementos") && base.categoria) {
    const c = matchCategoria(base.categoria); draft.categoria_id = c.id; draft.datos.categoria = c.nombre;
  }

  // Imagen: preferir el archivo local que ya bajó el scrape; si es URL, reintentar con headers.
  let imgFile = await resolveImage(base.imagen, url);
  if (imgFile) draft.imagenes.push({ filename: imgFile, principal: true });

  // Resumen de lo extraído.
  const auto = [];
  if (draft.datos.precio) auto.push("precio Gs. " + Number(draft.datos.precio).toLocaleString("es-PY"));
  if (draft.datos.precio_proveedor) auto.push("proveedor Gs. " + Number(draft.datos.precio_proveedor).toLocaleString("es-PY"));
  if (draft.datos.stock) auto.push("stock " + draft.datos.stock);
  const resumen = `🔎 <b>Extraje del link:</b>\n• Nombre: ${draft.datos.nombre || "—"}\n• Marca: ${draft.datos.marca || "—"}\n• Categoría: ${draft.datos.categoria || "—"}\n• Imagen: ${draft.imagenes.length ? "sí" : "no"}` +
    (auto.length ? "\n\n✅ Ya tengo: " + auto.join(" · ") : "\n\nLo que falte lo completás con Editar.");
  await CTX.tg.sendMessage(chatId, resumen);

  return generateAndPreview(chatId, draft);
}

// Devuelve un filename local servible en /img/productos, o null.
async function resolveImage(scrapedImagen, url) {
  // Caso 1: el scrape ya lo bajó a disco (downloadImage devolvió un nombre de archivo local).
  if (scrapedImagen && !/^https?:/i.test(scrapedImagen)) {
    // asegurar que el archivo exista en imgPath
    const p = path.join(CTX.imgPath, path.basename(scrapedImagen));
    if (fs.existsSync(p)) return path.basename(scrapedImagen);
  }
  // Caso 2: es una URL -> bajar con headers (referer = origin) para esquivar hotlink.
  if (scrapedImagen && /^https?:/i.test(scrapedImagen)) {
    try {
      const origin = new URL(scrapedImagen).origin;
      const r = await fetch(scrapedImagen, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": origin,
        },
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const tmp = path.join(CTX.imgPath, "tmp-" + Date.now() + ".jpg");
        fs.writeFileSync(tmp, buf);
        const processed = await CTX.processUploadImage(tmp);
        if (processed) return processed;
      }
    } catch (e) { console.warn("[Wizard] re-descarga de imagen falló:", e.message); }
  }
  return null;
}

const FIELD_ORDER = ["nombre", "marca", "presentacion", "precio", "stock"];
const FIELD_LABEL = {
  nombre: "el <b>nombre</b> del producto",
  marca: "la <b>marca</b>",
  presentacion: "la <b>presentación/cantidad</b> (ej: 2 lb, 60 cápsulas)",
  precio: "el <b>precio en guaraníes</b> (solo número, ej: 150000)",
  stock: "el <b>stock</b> disponible (número)",
};

function askNextField(chatId, draft) {
  const faltan = FIELD_ORDER.filter(f => !draft.datos[f] || (f === "precio" && !Number(draft.datos[f])));
  if (faltan.length === 0) return goGallery(chatId, draft);
  draft._next = faltan[0];
  save(chatId, "COLLECT", draft);
  return CTX.tg.sendMessage(chatId, `Escribime ${FIELD_LABEL[draft._next]}:`);
}

async function receiveField(chatId, draft, text) {
  const field = draft._next || FIELD_ORDER[0];
  let val = text.trim();
  if (field === "precio" || field === "stock") {
    val = parseInt(val.replace(/[^\d]/g, ""), 10) || 0;
  }
  draft.datos[field] = val;
  if (field === "marca") { const m = matchMarca(val); draft.marca_id = m.id; draft.datos.marca = m.nombre; }
  if (field === "categoria") { const c = matchCategoria(val); draft.categoria_id = c.id; draft.datos.categoria = c.nombre; }
  const faltan = FIELD_ORDER.filter(f => !draft.datos[f] || (f === "precio" && !Number(draft.datos[f])));
  if (faltan.length === 0) return goGallery(chatId, draft);
  draft._next = faltan[0];
  save(chatId, "COLLECT", draft);
  return CTX.tg.sendMessage(chatId, `✅ Guardado. Ahora escribime ${FIELD_LABEL[draft._next]}:`);
}

function goGallery(chatId, draft) {
  save(chatId, "GALLERY", draft);
  return CTX.tg.sendMessage(chatId,
    "🖼️ <b>Galería:</b> ya tengo " + draft.imagenes.length + " imagen(es). " +
    "Podés mandar más fotos o escribir <b>LISTO</b> para generar la descripción.");
}

async function generateAndPreview(chatId, draft) {
  await CTX.tg.sendMessage(chatId, "✍️ Generando descripción optimizada (SEO Paraguay)…");
  try {
    const copy = await copyProvider.generateCopy(draft.datos);
    draft.copy = copy;
    if (copy.seo_keywords && copy.seo_keywords.length) draft.datos.seo_keywords = copy.seo_keywords;
  } catch (e) {
    const copy = await stubProvider.generateCopy(draft.datos);
    draft.copy = copy;
    draft.copy._fallback = true;
    await CTX.tg.sendMessage(chatId,
      "⚠️ No pude generar la descripción con la IA (" + e.message + ").\n" +
      "Usé una plantilla básica — vas a poder editarla después desde el admin.\n" +
      "Para activar la IA: revisá OPENROUTER_API_KEY/OPENROUTER_MODEL en Dokploy, o poné COPY_PROVIDER=stub para no usar IA.");
  }
  save(chatId, "PREVIEW", draft);
  return renderPreview(chatId, draft);
}

function previewCaption(draft) {
  const c = draft.copy || {};
  const d = draft.datos;
  const precio = d.precio ? "Gs. " + Number(d.precio).toLocaleString("es-PY") : "—";
  return (
    "📋 <b>VISTA PREVIA</b>\n\n" +
    "<b>Título:</b> " + escapeHtml(c.titulo || d.nombre) + "\n" +
    "<b>Precio:</b> " + precio + "\n" +
    "<b>Marca:</b> " + escapeHtml(d.marca || "—") + (draft.marca_id ? " ✅(BD)" : "") + "\n" +
    "<b>Categoría:</b> " + escapeHtml(d.categoria || "—") + (draft.categoria_id ? " ✅(BD)" : "") + "\n" +
    "<b>Presentación:</b> " + escapeHtml(d.presentacion || "—") + "\n\n" +
    "<b>Descripción corta:</b>\n" + escapeHtml(c.descripcion_corta || "—") + "\n\n" +
    "<b>Descripción larga:</b>\n" + escapeHtml(stripTags(c.descripcion_larga || "—")) + "\n\n" +
    "<b>Galería:</b> " + draft.imagenes.length + " imagen(es)"
  );
}

async function renderPreview(chatId, draft) {
  const caption = previewCaption(draft);
  const keyboard = {
    inline_keyboard: [[
      { text: "✅ Publicar", callback_data: "wz_publish" },
      { text: "✏️ Editar", callback_data: "wz_edit" },
      { text: "❌ Cancelar", callback_data: "wz_cancel" },
    ]],
  };
  const principal = draft.imagenes.find(i => i.principal) || draft.imagenes[0];
  if (principal) {
    return CTX.tg.sendPhoto(chatId, imgUrl(principal.filename), caption, { reply_markup: keyboard });
  }
  return CTX.tg.sendMessage(chatId, caption, { reply_markup: keyboard });
}

async function onCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const session = load(chatId);
  if (!session) return false;
  await CTX.tg.answerCallback(cb.id);

  if (data === "wz_publish") return await publish(chatId, session.draft);
  if (data === "wz_cancel") { clear(chatId); return CTX.tg.sendMessage(chatId, "🚫 Carga cancelada."); }
  if (data === "wz_edit") return sendEditMenu(chatId, session.draft);
  if (data === "wz_back") { save(chatId, "PREVIEW", session.draft); return renderPreview(chatId, session.draft); }
  if (data.startsWith("wz_field_")) {
    const field = data.replace("wz_field_", "");
    session.draft._editField = field;
    save(chatId, "EDIT_FIELD", session.draft);
    const label = COPY_FIELDS.includes(field) ? "el <b>" + field + "</b>" : FIELD_LABEL[field];
    return CTX.tg.sendMessage(chatId, "Escribí el nuevo valor para " + label + ":");
  }
  if (data === "wz_hint_photo" || data === "wz_hint_link") {
    return CTX.tg.sendMessage(chatId, data === "wz_hint_photo"
      ? "📸 Mandame la foto del producto como adjunto."
      : "🔗 Pegá el link de la página del producto.");
  }
  return false;
}

function sendEditMenu(chatId, draft) {
  const kb = [
    [
      { text: "Título", callback_data: "wz_field_titulo" },
      { text: "Nombre", callback_data: "wz_field_nombre" },
    ],
    [
      { text: "Marca", callback_data: "wz_field_marca" },
      { text: "Precio", callback_data: "wz_field_precio" },
    ],
    [
      { text: "Stock", callback_data: "wz_field_stock" },
      { text: "Presentación", callback_data: "wz_field_presentacion" },
    ],
    [
      { text: "Categoría", callback_data: "wz_field_categoria" },
      { text: "Desc. corta", callback_data: "wz_field_descripcion_corta" },
    ],
    [
      { text: "Desc. larga", callback_data: "wz_field_descripcion_larga" },
    ],
    [{ text: "↩️ Volver a vista previa", callback_data: "wz_back" }],
  ];
  return CTX.tg.sendMessage(chatId, "¿Qué querés editar?", { reply_markup: { inline_keyboard: kb } });
}

async function publish(chatId, draft, messageId) {
  const d = draft.datos;
  const c = draft.copy || {};
  const galeria = draft.imagenes.map(i => imgUrl(i.filename));
  const principalFile = (draft.imagenes.find(i => i.principal) || draft.imagenes[0] || {}).filename || "";
  const imagenPath = principalFile ? "/img/productos/" + path.basename(principalFile) : "";
  const slug = (CTX.generateSlug ? CTX.generateSlug(d.nombre) : slugify(d.nombre));

  // Marca/categoría: usar las matcheadas (o crearlas si hace falta).
  const marca = matchMarca(d.marca);
  const cat = matchCategoria(d.categoria || "suplementos");

  try {
    const result = CTX.db.prepare(
      `INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, marca, seo_descripcion, slug, precio_proveedor, categoria_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      d.nombre || "Sin nombre",
      parseInt(d.precio) || 0,
      d.precio_anterior || null,
      cat.nombre || "suplementos",
      d.subcategoria || "",
      c.descripcion_corta || "",
      c.descripcion_larga || "",
      JSON.stringify(galeria),
      JSON.stringify(d.seo_keywords || []),
      0,
      imagenPath,
      parseInt(d.stock) || 0,
      1,
      marca.nombre || "",
      c.descripcion_corta || "",
      slug,
      d.precio_proveedor ? parseInt(d.precio_proveedor) : null,
      cat.id || null
    );
    const newId = result.lastInsertRowid;
    clear(chatId);
    return CTX.tg.sendMessage(chatId,
      "✅ <b>Producto publicado</b> (#" + newId + ")\n" +
      escapeHtml(c.titulo || d.nombre) + "\n" +
      (marca.nombre ? "🏷️ Marca: " + escapeHtml(marca.nombre) + "\n" : "") +
      (cat.nombre ? "📂 Categoría: " + escapeHtml(cat.nombre) + "\n" : "") +
      CTX.publicBase.replace(/\/$/, "") + "/producto/" + slug);
  } catch (e) {
    return CTX.tg.sendMessage(chatId, "⚠️ Error al publicar: " + e.message);
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

module.exports = { init, handleUpdate, hasSession };
