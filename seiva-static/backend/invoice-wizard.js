// Asistente de carga de PRECIO DE PROVEEDOR vía factura (.txt o texto pegado).
// El bot lee líneas (descripción | cantidad | precio BRL), hace fuzzy match contra
// los productos de la web, convierte BRL -> Gs con una tasa (default 1200, editable)
// y actualiza precio_proveedor, proveedor_updated_at y factura_origen.
//
// Estados (FSM):
//   AWAIT_FILE   -> espera .txt adjunto o texto pegado
//   REVIEW       -> muestra resumen + botones Confirmar/Revisar/Cancelar/Cotización
//   RESOLVE      -> para ítems sin match claro: busca en catálogo o omite
//   SET_RATE     -> usuario escribe nueva tasa

const fs = require("fs");
const path = require("path");

let CTX = null;
const DEFAULT_RATE = parseInt(process.env.BRL_RATE, 10) || 1200;

function init(ctx) {
  CTX = ctx; // { db, tg, allowedChats }
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

function hasSession(chatId) {
  return !!load(chatId);
}

function clear(chatId) {
  CTX.db.prepare("DELETE FROM bot_sessions WHERE chat_id = ?").run(chatId);
}

async function handleUpdate(update) {
  try {
    if (update.message) return await onMessage(update.message);
    if (update.callback_query) return await onCallback(update.callback_query);
  } catch (e) {
    console.error("[InvoiceWizard] error:", e.message);
  }
}

// ---------- parsing ----------
function parseDocument(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const item = parseLine(line);
    if (item) items.push(item);
  }
  return items;
}

function parseLine(line) {
  // Si la línea viene de un documento de texto plano ya escaneado.
  const tokens = line.split(/\s+/).filter(Boolean);
  // tokens que son solo número / dinero (sin letras)
  const moneyIdx = [];
  tokens.forEach((t, i) => {
    if (/^R?\$?[\d.,]+$/.test(t)) moneyIdx.push(i);
  });
  let brl = null, qty = 1, descEnd = tokens.length;
  if (moneyIdx.length >= 1) {
    const priceTok = tokens[moneyIdx[moneyIdx.length - 1]];
    brl = toNumber(priceTok);
    descEnd = moneyIdx[moneyIdx.length - 1];
    if (moneyIdx.length >= 2) {
      const qtyTok = tokens[moneyIdx[moneyIdx.length - 2]];
      const q = parseInt(qtyTok.replace(/[^\d]/g, ""), 10);
      if (q > 0 && q < 100000) qty = q;
      descEnd = Math.min(descEnd, moneyIdx[moneyIdx.length - 2]);
    }
  }
  let desc = tokens.slice(0, descEnd).join(" ").trim();
  // fallback: si no hay tokens de precio, toda la línea es descripción
  if (brl === null && desc === "") desc = line;
  return { desc, qty, brl, matchId: null, matchName: "", score: 0, confidence: "n/a", action: "update" };
}

function toNumber(t) {
  let s = t.replace(/R?\$/g, "").trim();
  // brasileño: punto = miles, coma = decimal
  if (s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---------- fuzzy match ----------
function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function score(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const ta = na.split(" "), tb = nb.split(" ");
  const sa = new Set(ta), sb = new Set(tb);
  let inter = 0;
  sa.forEach(x => { if (sb.has(x)) inter++; });
  const union = sa.size + sb.size - inter;
  const jac = union ? inter / union : 0;
  const sub = subseq(na, nb);
  return Math.max(jac, sub);
}

function subseq(a, b) {
  let i = 0;
  for (let j = 0; j < b.length && i < a.length; j++) {
    if (a[i] === b[j]) i++;
  }
  return i / a.length;
}

function confidenceOf(s) {
  if (s >= 0.85) return "alto";
  if (s >= 0.6) return "medio";
  if (s >= 0.4) return "bajo";
  return "nulo";
}

function matchItems(items, products) {
  for (const it of items) {
    let best = null, bestScore = 0;
    for (const p of products) {
      const hay = (p.nombre || "") + " " + (p.marca || "");
      const s = score(it.desc, hay);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (best && bestScore >= 0.4) {
      it.matchId = best.id;
      it.matchName = best.nombre + (best.marca ? " (" + best.marca + ")" : "");
      it.score = bestScore;
      it.confidence = confidenceOf(bestScore);
      if (it.confidence === "bajo" || it.confidence === "nulo") it.action = "resolve";
    } else {
      it.matchId = null;
      it.matchName = "";
      it.score = bestScore;
      it.confidence = "nulo";
      it.action = "resolve";
    }
  }
}

// ---------- flujo ----------
async function handleAwaitFile(chatId, draft, msg) {
  const text = msg.text || "";
  let content = null;
  if (msg.document && /\.txt$/i.test(msg.document.file_name || "")) {
    const f = await CTX.tg.getFile(msg.document.file_id);
    if (f.ok) {
      const buf = await CTX.tg.downloadFile(f.result.file_path);
      content = buf.toString("utf8");
      draft.factura = msg.document.file_name || "factura.txt";
    }
  } else if (text) {
    content = text;
    draft.factura = "texto pegado";
  }
  if (!content) return CTX.tg.sendMessage(chatId, "No leí nada. Mandá un .txt o pegá el texto de la factura.");
  draft.items = parseDocument(content);
  if (!draft.items.length) return CTX.tg.sendMessage(chatId, "No pude extraer ítems del texto. Revisá el formato.");
  const products = CTX.db.prepare("SELECT id, nombre, marca, precio_proveedor FROM productos").all();
  matchItems(draft.items, products);
  draft.pendingIndex = null;
  save(chatId, "REVIEW", draft);
  return renderReview(chatId, draft);
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const session = load(chatId);

  if (CTX.allowedChats && CTX.allowedChats.length && !CTX.allowedChats.includes(chatId)) return false;

  if (text === "/factura" || text === "/precio" || text === "/proveedor") {
    const draft = { items: [], rate: DEFAULT_RATE, factura: "", pendingIndex: null, searchResults: [] };
    save(chatId, "AWAIT_FILE", draft);
    return CTX.tg.sendMessage(chatId,
      "🧾 <b>Carga de precio de proveedor</b>\n\n" +
      "Mandame el archivo <b>.txt</b> de la factura (o pegá el texto). Formato por línea:\n" +
      "<code>nombre producto  |  cantidad  |  precio BRL</code>\n\n" +
      "Ej: <code>Ozempic Nat 60cap 2000mg  1  12,50</code>");
  }

  if (!session) {
    // Sin comando: si es un .txt o texto con precios, arrancamos la carga de proveedor.
    const isFactura = (msg.document && /\.txt$/i.test(msg.document.file_name || "")) ||
      (text && /\d[\d.,]*\s*(?:R\$|\$)?\s*\d[\d.,]*|\d,\d{2}/.test(text) && text.split(/\r?\n/).filter(Boolean).length >= 1);
    if (isFactura) {
      const draft = { items: [], rate: DEFAULT_RATE, factura: "", pendingIndex: null, searchResults: [] };
      save(chatId, "AWAIT_FILE", draft);
      return await handleAwaitFile(chatId, draft, msg);
    }
    return false;
  }
  const { state, draft } = session;

  if (state === "AWAIT_FILE") {
    return await handleAwaitFile(chatId, draft, msg);
  }

  if (state === "SET_RATE") {
    const n = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!n || n <= 0) return CTX.tg.sendMessage(chatId, "Tasa inválida. Escribí solo números (ej: 1200).");
    draft.rate = n;
    save(chatId, "REVIEW", draft);
    return renderReview(chatId, draft);
  }

  if (state === "RESOLVE") {
    // usuario escribió búsqueda para el ítem pendiente
    const idx = draft.pendingIndex;
    if (idx === null || idx === undefined) return CTX.tg.sendMessage(chatId, "No hay ítem pendiente.");
    const q = text.trim();
    const rows = CTX.db.prepare(
      "SELECT id, nombre, marca FROM productos WHERE nombre LIKE ? OR marca LIKE ? LIMIT 8"
    ).all("%" + q + "%", "%" + q + "%");
    draft.searchResults = rows.map(r => ({ id: r.id, name: r.nombre + (r.marca ? " (" + r.marca + ")" : "") }));
    if (!rows.length) {
      return CTX.tg.sendMessage(chatId, "Sin resultados para \"" + q + "\". Probá otro término o escribí /omitir.");
    }
    const kb = rows.map(r => ([{ text: (r.nombre + (r.marca ? " " + r.marca : "")).slice(0, 40), callback_data: "inv_pick_" + r.id }]));
    kb.push([{ text: "❌ Omitir este ítem", callback_data: "inv_omit_" + idx }]);
    draft._resolveFor = idx;
    save(chatId, "RESOLVE", draft);
    return CTX.tg.sendMessage(chatId, "Resultados para \"" + q + "\":", { reply_markup: { inline_keyboard: kb } });
  }

  return false;
}

function renderReview(chatId, draft) {
  const lines = draft.items.map((it, i) => {
    const gss = it.brl !== null ? "Gs. " + Math.round(it.brl * draft.rate).toLocaleString("es-PY") : "sin precio";
    const conf = it.confidence === "nulo" ? "sin match" : it.confidence;
    const matchTxt = it.matchId ? it.matchName : "(pendiente)";
    return `${i + 1}. ${it.desc}\n   → ${matchTxt}\n   R$ ${it.brl !== null ? it.brl : "—"}  ⇒  ${gss}  ·  confianza: ${conf}`;
  }).join("\n\n");
  const toUpdate = draft.items.filter(it => it.action === "update" && it.matchId && it.brl !== null).length;
  const pendientes = draft.items.filter(it => it.action === "resolve" || !it.matchId).length;
  const caption =
    "🧾 <b>RESUMEN (tasa " + draft.rate + " Gs/BRL)</b>\n\n" + lines +
    "\n\n✅ A actualizar: " + toUpdate + "   ⚠️ Pendientes: " + pendientes;
  const keyboard = {
    inline_keyboard: [[
      { text: "✅ Confirmar (" + toUpdate + ")", callback_data: "inv_confirm" },
      { text: "💱 Cotización", callback_data: "inv_rate" },
    ], [
      { text: "❌ Cancelar", callback_data: "inv_cancel" },
    ]],
  };
  return CTX.tg.sendMessage(chatId, caption, { reply_markup: keyboard });
}

async function onCallback(cb) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const session = load(chatId);
  await CTX.tg.answerCallback(cb.id);
  if (!session) return false;
  const { state, draft } = session;

  if (data === "inv_cancel") { clear(chatId); return CTX.tg.sendMessage(chatId, "🚫 Carga cancelada."); }
  if (data === "inv_rate") {
    save(chatId, "SET_RATE", draft);
    return CTX.tg.sendMessage(chatId, "Escribí la nueva cotización en Gs por 1 BRL (actual: " + draft.rate + ").");
  }
  if (data === "inv_confirm") return applyUpdates(chatId, draft);

  if (data.startsWith("inv_resolve_")) {
    const idx = parseInt(data.replace("inv_resolve_", ""), 10);
    draft.pendingIndex = idx;
    draft._resolveFor = idx;
    save(chatId, "RESOLVE", draft);
    return CTX.tg.sendMessage(chatId, "Escribí el nombre del producto de tu catálogo para \"" + draft.items[idx].desc + "\".");
  }
  if (data.startsWith("inv_omit_")) {
    const idx = parseInt(data.replace("inv_omit_", ""), 10);
    draft.items[idx].action = "omit";
    draft.items[idx].matchId = null;
    save(chatId, "REVIEW", draft);
    return renderReview(chatId, draft);
  }
  if (data.startsWith("inv_pick_")) {
    const pid = parseInt(data.replace("inv_pick_", ""), 10);
    const idx = draft._resolveFor;
    if (idx === null || idx === undefined) return CTX.tg.sendMessage(chatId, "No hay ítem pendiente.");
    const p = CTX.db.prepare("SELECT nombre, marca FROM productos WHERE id = ?").get(pid);
    draft.items[idx].matchId = pid;
    draft.items[idx].matchName = p ? p.nombre + (p.marca ? " (" + p.marca + ")" : "") : "" + pid;
    draft.items[idx].action = "update";
    draft.items[idx].confidence = "manual";
    draft.pendingIndex = null;
    save(chatId, "REVIEW", draft);
    return renderReview(chatId, draft);
  }
  return false;
}

async function applyUpdates(chatId, draft) {
  const toUpdate = draft.items.filter(it => it.action === "update" && it.matchId && it.brl !== null);
  let updated = 0;
  const ts = new Date().toISOString();
  for (const it of toUpdate) {
    const gs = Math.round(it.brl * draft.rate);
    CTX.db.prepare(
      "UPDATE productos SET precio_proveedor = ?, proveedor_updated_at = ?, factura_origen = ? WHERE id = ?"
    ).run(gs, ts, draft.factura || "factura", it.matchId);
    updated++;
  }
  const omitidos = draft.items.length - toUpdate.length;
  clear(chatId);
  return CTX.tg.sendMessage(chatId,
    "✅ <b>Precio de proveedor actualizado</b> para " + updated + " producto(s).\n" +
    "Tasa usada: " + draft.rate + " Gs/BRL · Origen: " + (draft.factura || "—") + "\n" +
    (omitidos ? omitidos + " ítem(s) omitidos (sin match o sin precio)." : ""));
}

module.exports = { init, handleUpdate, hasSession };
