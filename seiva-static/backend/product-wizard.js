// Asistente de carga rápida de productos para Telegram (panel de alta).
// Reutiliza: db (sqlite), image-service (processUploadImage), scrapeProductData,
// y los helpers de envío de telegram-bot.
//
// Estados (FSM):
//   AWAIT_SOURCE -> recolecta foto o link
//   COLLECT      -> pregunta campos faltantes uno a uno (nombre, marca, presentacion, precio, stock)
//   GALLERY      -> acepta fotos extra o "listo"
//   GENERATE     -> genera copy con copy-provider
//   PREVIEW      -> muestra ficha y botones Publicar/Editar/Cancelar
//   EDIT_FIELD   -> edita un campo y vuelve a PREVIEW

const fs = require("fs");
const path = require("path");
const copyProvider = require("./copy-provider");

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
  const row = CTX.db.prepare("SELECT state, draft FROM bot_sessions WHERE chat_id = ?").get(chatId);
  if (!row) return null;
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

function imgUrl(filename) {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  return CTX.publicBase.replace(/\/$/, "") + "/img/productos/" + path.basename(filename);
}

const COPY_FIELDS = ["titulo", "descripcion_corta", "descripcion_larga"];

async function handleUpdate(update) {
  try {
    if (update.message) return await onMessage(update.message);
    if (update.callback_query) return await onCallback(update.callback_query);
  } catch (e) {
    console.error("[Wizard] error:", e.message);
  }
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const session = load(chatId);

  if (CTX.allowedChats && CTX.allowedChats.length && !CTX.allowedChats.includes(chatId)) {
    return false;
  }

  if (text === "/cargar" || text === "/nuevo" || text === "/producto") {
    const draft = { imagenes: [], datos_tecnicos: {}, datos: {}, source: null, copy: {} };
    save(chatId, "AWAIT_SOURCE", draft);
    return CTX.tg.sendMessage(chatId,
      "📦 <b>Carga rápida de producto</b>\n\n" +
      "Envianos una <b>foto</b> del producto o un <b>link</b> (otra tienda, marketplace o red social).",
      { reply_markup: { inline_keyboard: [[
        { text: "📸 Mandar foto", callback_data: "wz_hint_photo" },
        { text: "🔗 Mandar link", callback_data: "wz_hint_link" },
      ]] } });
  }

  if (!session) return false;
  const { state, draft } = session;

  if (state === "AWAIT_SOURCE") {
    if (msg.photo && msg.photo.length) return await receivePhoto(chatId, draft, msg);
    const url = extractUrl(text);
    if (url) return await receiveLink(chatId, draft, url);
    return CTX.tg.sendMessage(chatId, "No entendí. Envianos una foto 📸 o un link 🔗 del producto.");
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
    save(chatId, "PREVIEW", draft);
    return renderPreview(chatId, draft);
  }

  return false;
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

async function receivePhoto(chatId, draft, msg, extra = false) {
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const file = await CTX.tg.getFile(fileId);
  if (!file.ok) return CTX.tg.sendMessage(chatId, "No pude leer la foto. Probá de nuevo.");
  const buf = await CTX.tg.downloadFile(file.result.file_path);
  const tmp = path.join(CTX.imgPath, "tmp-" + Date.now() + ".jpg");
  fs.writeFileSync(tmp, buf);
  const out = await CTX.processUploadImage(tmp);
  fs.unlinkSync(tmp);
  if (!out) return CTX.tg.sendMessage(chatId, "Error procesando la imagen.");
  draft.imagenes.push({ filename: out, principal: draft.imagenes.length === 0 });
  if (!extra) {
    draft.source = "foto";
    save(chatId, "COLLECT", draft);
    return askNextField(chatId, draft);
  }
  save(chatId, "GALLERY", draft);
}

async function receiveLink(chatId, draft, url) {
  draft.source = "link";
  draft.url_origen = url;
  try {
    const data = await CTX.scrapeProductData(url);
    draft.datos = Object.assign({
      nombre: data.nombre || "",
      marca: data.marca || "",
      precio: data.precio || "",
      presentacion: "",
      stock: 0,
      categoria: "suplementos",
    }, draft.datos);
    draft.datos_tecnicos = extractTech(data.descripcion || data.descripcion_larga || "");
    if (data.imagen) draft.imagenes.push({ filename: data.imagen, principal: true });
    const resumen = `🔎 <b>Extraje del link:</b>\n• Nombre: ${draft.datos.nombre || "—"}\n• Marca: ${draft.datos.marca || "—"}\n• Precio: ${draft.datos.precio ? "Gs. " + Number(draft.datos.precio).toLocaleString("es-PY") : "—"}\n• Imagen: ${draft.imagenes.length ? "sí" : "no"}`;
    await CTX.tg.sendMessage(chatId, resumen);
  } catch (e) {
    await CTX.tg.sendMessage(chatId, "⚠️ No pude scrapear el link (JS pesado o bloqueado). Completemos a mano.");
  }
  save(chatId, "COLLECT", draft);
  return askNextField(chatId, draft);
}

function extractTech(text) {
  const out = {};
  const m = text.match(/(\d+\s?(?:mg|g|ml|lb|cápsulas|caps|comprimidos))/gi);
  if (m) out.presentacion = m.slice(0, 3).join(", ");
  return out;
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
    return CTX.tg.sendMessage(chatId, "⚠️ No pude generar el texto con la IA: " + e.message + ". Revisá las keys de OpenRouter o usá COPY_PROVIDER=stub.");
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
    "<b>Marca:</b> " + escapeHtml(d.marca || "—") + "  ·  <b>Presentación:</b> " + escapeHtml(d.presentacion || "—") + "\n\n" +
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

  if (data === "wz_publish") return await publish(chatId, session.draft, cb.message.message_id);
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
      { text: "Desc. corta", callback_data: "wz_field_descripcion_corta" },
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
  try {
    const result = CTX.db.prepare(
      `INSERT INTO productos (nombre, precio, precio_anterior, categoria, subcategoria, descripcion, descripcion_larga, galeria, etiquetas, destacado, imagen, stock, activo, marca, seo_descripcion, slug)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      d.nombre || "Sin nombre",
      parseInt(d.precio) || 0,
      d.precio_anterior || null,
      d.categoria || "suplementos",
      d.subcategoria || "",
      c.descripcion_corta || "",
      c.descripcion_larga || "",
      JSON.stringify(galeria),
      JSON.stringify(d.seo_keywords || []),
      0,
      imagenPath,
      parseInt(d.stock) || 0,
      1,
      d.marca || "",
      c.descripcion_corta || "",
      slug
    );
    const newId = result.lastInsertRowid;
    clear(chatId);
    return CTX.tg.sendMessage(chatId,
      "✅ <b>Producto publicado</b> (#" + newId + ")\n" +
      escapeHtml(c.titulo || d.nombre) + "\n" +
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

module.exports = { init, handleUpdate };
