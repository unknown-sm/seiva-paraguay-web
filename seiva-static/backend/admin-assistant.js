// admin-assistant.js — Asistente de inventario por lenguaje natural para el admin.
// Interpreta comandos con OpenRouter (modelo rápido) y ejecuta acciones
// deterministas sobre la tabla productos. Reusa OPENROUTER_API_KEY/OPENROUTER_MODEL.
//
// No reemplaza al bot de Telegram/n8n: es una vía alternativa dentro del panel.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `Sos el asistente de inventario de Seiva Paraguay (tienda de suplementos).
Interpretá el comando del usuario y devolvé SOLO un JSON válido (sin markdown, sin texto fuera del JSON).

Acciones posibles (campo "accion"):
- "editar": modificar campos de un producto. { "accion":"editar", "id":<id o null>, "nombre":"<parte del nombre si no hay id>", "campos":{ "precio":<num>, "stock":<num>, "marca":"<str>", "nombre":"<str>", "categoria":"<str>" } }
- "stock": cambiar stock. { "accion":"stock", "id":<id>, "valor":<num>, "modo":"set"|"sumar"|"restar" }
- "publicar": { "accion":"publicar", "id":<id> }
- "despublicar": { "accion":"despublicar", "id":<id> }
- "eliminar": { "accion":"eliminar", "id":<id> }
- "buscar": { "accion":"buscar", "nombre":"<texto a buscar>" }
- "consultar": { "accion":"consultar", "id":<id> }
- "lista": { "accion":"lista" }
- "crear": { "accion":"crear", "campos":{ "nombre":"<str>", "precio":<num>, "stock":<num>, "marca":"<str>", "categoria":"<str>" } }
- "generar_descripcion": { "accion":"generar_descripcion", "id":<id> }
- "desconocido": { "accion":"desconocido" }

REGLAS:
- "id" es SIEMPRE un número entero. Si el usuario se refiere por nombre (ej "el magnesio", "la luteina"), usá el campo "nombre" con el texto exacto que dio, y dejá "id" en null.
- Precios en guaraníes: "120 mil" → 120000, "120.000" → 120000, "85k" → 85000.
- "sumale 5" → modo "sumar", "restale 3" → modo "restar", "poné el stock en 10" → modo "set".
- "publicá"/"activá" → "publicar"; "ocultá"/"desactivá"/"pausá" → "despublicar".
- Si el comando pide algo que no es una acción de inventario, devolvé "desconocido".
- Respondé SOLO el JSON.`;

function parseJSONLoose(s) {
  s = String(s || "").trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function callLLM(messages) {
  const body = { model: OPENROUTER_MODEL, messages, temperature: 0.1, max_tokens: 600, response_format: { type: "json_object" } };
  const res = await fetch(OR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}`, "HTTP-Referer": "https://seiva.com.py", "X-Title": "Seiva Admin Assistant" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) throw new Error(data.error?.message || "OpenRouter sin respuesta");
  return data.choices[0].message.content;
}

// Fallback determinista cuando no hay key o el LLM falla.
function ruleBased(texto) {
  const t = String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const num = n => { const m = String(n).replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(mil|k)?/i); if (!m) return null; let v = parseFloat(m[1]); if (m[2]) v *= 1000; return isNaN(v) ? null : v; };
  const ids = (t.match(/\d+/g) || []).map(Number);

  if (/^(lista|listar|productos|inventario)$/.test(t)) return { accion: "lista" };
  if (/^(publicar|publica|activar|activa)\b/.test(t)) return { accion: "publicar", id: ids[0] || null };
  if (/^(despublicar|ocultar|oculta|desactivar|desactiva|pausar)\b/.test(t)) return { accion: "despublicar", id: ids[0] || null };
  if (/^(eliminar|borrar|elimina|borra)\b/.test(t)) return { accion: "eliminar", id: ids[0] || null };
  if (/^(buscar|busca|buscame|busqueda)\b/.test(t)) {
    const nom = t.replace(/^(buscar|busca|buscame|busqueda)\s*(producto|el|la|los|las)?\s*/i, "").trim();
    return { accion: "buscar", nombre: nom || "" };
  }
  if (/sumale|suma|sumar|agregale|aumenta/i.test(t)) {
    const id = ids[0] || null;
    const val = ids[1] != null ? ids[1] : (t.match(/sumale?\s*(\d+)/i) || [])[1];
    return { accion: "stock", id, valor: Number(val) || null, modo: "sumar" };
  }
  if (/restale|resta|restar|quitarle|baja/i.test(t)) {
    const id = ids[0] || null;
    const val = ids[1] != null ? ids[1] : (t.match(/restale?\s*(\d+)/i) || [])[1];
    return { accion: "stock", id, valor: Number(val) || null, modo: "restar" };
  }
  // "stock 204 10" o "poné el stock de X en 10"
  if (/\bstock\b/.test(t)) {
    const id = ids[0] || null;
    const valor = (t.match(/\bstock\b[^0-9]*(\d+)/i) || [])[1];
    return { accion: "stock", id, valor: Number(valor) || null, modo: "set" };
  }
  // "precio 204 120000" o "cambiale el precio al 204 a 120 mil"
  if (/\bprecio\b/.test(t)) {
    const id = ids[0] || null;
    const m = t.match(/\bprecio\b[^0-9]*(\d+(?:[.,]\d+)?\s*(?:mil|k)?)/i);
    const valor = m ? num(m[1]) : null;
    return { accion: "editar", id, campos: { precio: valor } };
  }
  // "marca 204 Unilife"
  if (/\bmarca\b/.test(t)) {
    const id = ids[0] || null;
    const nom = t.replace(/\bmarca\b[^a-z]*/i, "").replace(/\d+/g, "").trim();
    return { accion: "editar", id, campos: { marca: nom || undefined } };
  }
  // "nombre 204 X" o "cambiale el nombre"
  if (/\bnombre\b/.test(t)) {
    const id = ids[0] || null;
    const nom = t.replace(/\bnombre\b[^a-z]*/i, "").replace(/^\d+\s*/, "").trim();
    return { accion: "editar", id, campos: { nombre: nom || undefined } };
  }
  return { accion: "desconocido" };
}

async function interpretCommand(texto, prods) {
  const text = String(texto || "").trim();
  if (!text) return { accion: "desconocido", respuesta: "Comando vacío." };

  // Lista compacta para que el LLM resuelva "el magnesio" → id real.
  const inv = (prods || []).map(p => `#${p.id} | ${p.nombre} | stock ${p.stock} | ${p.precio} | ${p.marca || ""}`).join("\n");

  if (OPENROUTER_API_KEY) {
    try {
      const user = "Inventario:\n" + inv + "\n\nComando del usuario: " + text;
      const content = await callLLM([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }]);
      const parsed = parseJSONLoose(content);
      if (parsed && parsed.accion) return parsed;
    } catch (e) {
      console.warn("[AdminAssistant] LLM falló, uso fallback determinista:", e.message);
    }
  }
  return ruleBased(text);
}

function fmt(n) { return Number(n || 0).toLocaleString("es-PY"); }

// Ejecuta la acción contra la BD. Devuelve { ok, mensaje, productos?, accion }.
async function executeAction(action, db) {
  const acc = (action && action.accion) || "desconocido";

  if (acc === "lista") {
    const rows = db.prepare("SELECT id, nombre, precio, stock, marca, activo FROM productos ORDER BY id DESC LIMIT 40").all();
    return { ok: true, mensaje: `Hay ${rows.length} productos (últimos 40).`, productos: rows };
  }

  if (acc === "buscar") {
    const q = String(action.nombre || "").trim();
    if (!q) return { ok: false, mensaje: "Decime qué buscar." };
    const rows = db.prepare("SELECT id, nombre, precio, stock, marca, activo FROM productos WHERE nombre LIKE ? ORDER BY id DESC LIMIT 20").all("%" + q + "%");
    if (!rows.length) return { ok: false, mensaje: `No encontré productos con "${q}".` };
    return { ok: true, mensaje: `${rows.length} coincidencia(s) para "${q}":`, productos: rows };
  }

  // Resolver id: si viene id lo usamos; si no, buscar por nombre.
  let id = action.id ? Number(action.id) : null;
  if (!id && action.nombre) {
    const q = String(action.nombre).trim();
    const rows = db.prepare("SELECT id, nombre FROM productos WHERE nombre LIKE ? ORDER BY id DESC LIMIT 10").all("%" + q + "%");
    if (rows.length === 1) id = rows[0].id;
    else if (rows.length > 1) return { ok: false, mensaje: `Hay ${rows.length} productos con "${q}". Aclarame cuál (ID):\n` + rows.map(r => `#${r.id} ${r.nombre}`).join("\n") };
    else return { ok: false, mensaje: `No encontré "${q}".` };
  }

  if (acc === "consultar") {
    if (!id) return { ok: false, mensaje: "¿Qué producto?" };
    const p = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    return { ok: true, mensaje: `#${p.id} ${p.nombre}\nPrecio: ${fmt(p.precio)} Gs · Stock: ${p.stock} · Marca: ${p.marca || "-"} · ${p.activo ? "✅ publicado" : "⏸️ oculto"}`, producto: p };
  }

  if (acc === "publicar" || acc === "despublicar") {
    if (!id) return { ok: false, mensaje: "¿Qué producto publicar/ocultar?" };
    const p = db.prepare("SELECT id, nombre, activo FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    const nuevo = acc === "publicar" ? 1 : 0;
    db.prepare("UPDATE productos SET activo = ? WHERE id = ?").run(nuevo, id);
    return { ok: true, mensaje: `${acc === "publicar" ? "✅" : "⏸️"} #${id} ${p.nombre} ahora está ${acc === "publicar" ? "PUBLICADO" : "OCULTO"}.` };
  }

  if (acc === "eliminar") {
    if (!id) return { ok: false, mensaje: "¿Qué producto eliminar?" };
    const p = db.prepare("SELECT id, nombre FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    db.prepare("DELETE FROM productos WHERE id = ?").run(id);
    return { ok: true, mensaje: `🗑️ #${id} ${p.nombre} eliminado.` };
  }

  if (acc === "stock") {
    if (!id) return { ok: false, mensaje: "¿Qué producto?" };
    const p = db.prepare("SELECT id, nombre, stock FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    const valor = Number(action.valor);
    if (isNaN(valor)) return { ok: false, mensaje: "Stock inválido." };
    let nuevo = valor;
    if (action.modo === "sumar") nuevo = Number(p.stock) + valor;
    if (action.modo === "restar") nuevo = Number(p.stock) - valor;
    if (nuevo < 0) return { ok: false, mensaje: `Stock quedaría negativo (${nuevo}). #${id} tiene ${p.stock}.` };
    db.prepare("UPDATE productos SET stock = ? WHERE id = ?").run(nuevo, id);
    return { ok: true, mensaje: `#${id} ${p.nombre} → stock ${nuevo}` };
  }

  if (acc === "editar") {
    if (!id) return { ok: false, mensaje: "¿Qué producto editar?" };
    const p = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    const campos = action.campos || {};
    const cambios = [];
    const sets = [];
    const params = [];
    if (campos.precio !== undefined && campos.precio !== null && !isNaN(Number(campos.precio))) {
      sets.push("precio = ?"); params.push(Number(campos.precio)); cambios.push("precio → " + fmt(campos.precio));
    }
    if (campos.stock !== undefined && campos.stock !== null && !isNaN(Number(campos.stock))) {
      sets.push("stock = ?"); params.push(Number(campos.stock)); cambios.push("stock → " + campos.stock);
    }
    if (campos.marca) {
      let marca = String(campos.marca).trim();
      const mRow = db.prepare("SELECT nombre FROM marcas WHERE LOWER(nombre) = LOWER(?) LIMIT 1").get(marca);
      if (mRow) marca = mRow.nombre;
      sets.push("marca = ?"); params.push(marca); cambios.push("marca → " + marca);
    }
    if (campos.nombre) {
      sets.push("nombre = ?"); params.push(String(campos.nombre).trim()); cambios.push("nombre → " + campos.nombre);
    }
    if (campos.categoria) {
      let catName = String(campos.categoria).trim();
      const catRow = db.prepare("SELECT id, nombre FROM categorias WHERE LOWER(nombre) = LOWER(?) AND activo = 1 LIMIT 1").get(catName);
      sets.push("categoria = ?"); params.push(catName); cambios.push("categoria → " + catName);
      if (catRow) { sets.push("categoria_id = ?"); params.push(catRow.id); }
    }
    if (!sets.length) return { ok: false, mensaje: "No entendí qué campo editar." };
    params.push(id);
    db.prepare("UPDATE productos SET " + sets.join(", ") + " WHERE id = ?").run(...params);
    return { ok: true, mensaje: `#${id} ${p.nombre} editado:\n` + cambios.map(c => "• " + c).join("\n") };
  }

  if (acc === "crear") {
    const c = action.campos || {};
    if (!c.nombre || !c.precio) return { ok: false, mensaje: "Para crear necesito al menos nombre y precio." };
    let marca = c.marca ? String(c.marca).trim() : "";
    if (marca) {
      const mRow = db.prepare("SELECT nombre FROM marcas WHERE LOWER(nombre) = LOWER(?) LIMIT 1").get(marca);
      if (mRow) marca = mRow.nombre;
    }
    let catName = c.categoria ? String(c.categoria).trim() : "suplementos";
    let cid = null;
    const catRow = db.prepare("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND activo = 1 LIMIT 1").get(catName);
    if (catRow) cid = catRow.id;
    const slug = String(c.nombre).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 100);
    const r = db.prepare("INSERT INTO productos (nombre, precio, stock, marca, categoria, categoria_id, slug, activo, etiquetas, galeria, descripcion, descripcion_larga) VALUES (?,?,?,?,?,?,?,1,'[]','[]','','')").run(
      String(c.nombre).trim(), Number(c.precio), Number(c.stock || 0), marca, catName, cid, slug
    );
    return { ok: true, mensaje: `✅ Producto creado: #${r.lastInsertRowid} ${c.nombre}` };
  }

  if (acc === "generar_descripcion") {
    if (!id) return { ok: false, mensaje: "¿A qué producto le genero descripción?" };
    const p = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
    if (!p) return { ok: false, mensaje: `No existe el producto #${id}.` };
    try {
      const { generateCopy } = require("./copy-provider.openrouter");
      const ficha = await generateCopy({ nombre: p.nombre, marca: p.marca, precio: p.precio, categoria: p.categoria });
      db.prepare("UPDATE productos SET descripcion = ?, descripcion_larga = ?, meta_titulo = ? WHERE id = ?").run(
        ficha.descripcion_corta, ficha.descripcion_larga, ficha.titulo, id
      );
      return { ok: true, mensaje: `✅ Descripción de #${id} ${p.nombre} regenerada con IA.` };
    } catch (e) {
      return { ok: false, mensaje: "No pude generar la descripción: " + e.message };
    }
  }

  return { ok: false, mensaje: "No entendí el comando. Probá: \"precio 204 120000\", \"stock 204 10\", \"publicar 204\", \"buscar magnesio\", \"lista\"." };
}

module.exports = { interpretCommand, executeAction };
