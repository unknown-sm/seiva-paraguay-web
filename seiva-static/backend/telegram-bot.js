const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const productWizard = require("./product-wizard");
const invoiceWizard = require("./invoice-wizard");
const botRouter = require("./bot-router");

// Marcador de versión: visible en /debug para saber qué código corre el server.
const BUILD_TAG = "bot-2026-08-22-conversa1";

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || crypto.randomBytes(32).toString("hex");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

// Bot state
let db = null;
let botInfo = null;
let ALLOWED_CHATS = [];

// Initialize bot with database reference
function init(database, shared = {}) {
  db = database;
  ALLOWED_CHATS = shared.allowedChats || [];
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram Bot] No TELEGRAM_BOT_TOKEN set - bot disabled");
    return;
  }
  console.log("[Telegram Bot] Build: " + BUILD_TAG);
  // Inicializar asistente de carga rápida de productos
  productWizard.init({
    db: database,
    imgPath: shared.imgPath,
    publicBase: shared.publicBase || "https://seiva.com.py",
    allowedChats: shared.allowedChats || [],
    tg: {
      sendMessage,
      sendPhoto,
      getFile,
      downloadFile,
      answerCallback: (id) => telegramAPI("answerCallbackQuery", { callback_query_id: id }),
    },
    downloadImage: shared.downloadImage,
    scrapeProductData: shared.scrapeProductData,
    processUploadImage: shared.processUploadImage,
    generateSlug: shared.generateSlug,
  });
  // Asistente de precio de proveedor (facturas)
  invoiceWizard.init({
    db: database,
    allowedChats: shared.allowedChats || [],
    tg: {
      sendMessage,
      sendPhoto,
      getFile,
      downloadFile,
      answerCallback: (id) => telegramAPI("answerCallbackQuery", { callback_query_id: id }),
    },
  });
  // Inicializar el router de intención con los helpers de envío (evita require circular).
  botRouter.init({ tg: { sendMessage } });
  console.log("[Telegram Bot] Initialized");
}

// Telegram API helper
async function telegramAPI(method, body = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) console.error(`[Telegram API Error] ${method}:`, data.description);
  return data;
}

// Set webhook
async function setWebhook(webhookUrl) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const result = await telegramAPI("setWebhook", {
    url: webhookUrl,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  if (result.ok) {
    console.log("[Telegram Bot] Webhook set to:", webhookUrl);
    // Get bot info
    const me = await telegramAPI("getMe");
    if (me.ok) botInfo = me.result;
  }
  return result;
}

// Send message
async function sendMessage(chatId, text, options = {}) {
  return telegramAPI("sendMessage", {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    ...options,
  });
}

// Send photo
async function sendPhoto(chatId, photo, caption = "", options = {}) {
  return telegramAPI("sendPhoto", {
    chat_id: chatId,
    photo: photo,
    caption: caption,
    parse_mode: "HTML",
    ...options,
  });
}

// Get file from Telegram
async function getFile(fileId) {
  return telegramAPI("getFile", { file_id: fileId });
}

// Download file from Telegram
async function downloadFile(filePath) {
  const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  return res.buffer();
}

// AI Integration - understand user intent
async function understandIntent(message) {
  if (!OPENROUTER_API_KEY) {
    // Fallback to simple keyword matching
    return simpleIntentMatch(message);
  }

  const systemPrompt = `You are an AI assistant for Seiva Paraguay e-commerce. Understand the user's intent from their message and respond with JSON only.

Available actions:
- list_products: list all products
- add_product: add a new product (extract: nombre, precio, stock, marca, categoria, descripcion)
- update_product: update existing product (extract: id or nombre, fields to update)
- delete_product: delete a product (extract: id or nombre)
- get_product: get product details (extract: id or nombre)
- list_orders: list orders (extract optional: estado filter)
- update_order: update order status (extract: id, estado)
- get_order: get order details (extract: id)
- help: show available commands
- unknown: cannot understand

Product estados: activo, inactivo
Order estados: pendiente, confirmado, enviado, entregado, cancelado

Respond with JSON: {"action": "...", "params": {}, "response": "human readable response"}

Examples:
"agregar producto vitamina c 500mg precio 50000 stock 100" -> {"action":"add_product","params":{"nombre":"vitamina c 500mg","precio":50000,"stock":100},"response":"Producto agregado"}
"ver pedidos pendientes" -> {"action":"list_orders","params":{"estado":"pendiente"},"response":"Pedidos pendientes"}
"pedido 123" -> {"action":"get_order","params":{"id":123},"response":"Detalle del pedido"}
"actualizar stock de vitamina c a 50" -> {"action":"update_product","params":{"nombre":"vitamina c","stock":50},"response":"Stock actualizado"}
"eliminar producto 5" -> {"action":"delete_product","params":{"id":5},"response":"Producto eliminado"}
"listar productos" -> {"action":"list_products","params":{},"response":"Lista de productos"}`;

  try {
    // Intento 1: system + user separados
    let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    let data = await res.json();
    if (!data.ok && !data.choices) {
      // Intento 2: fusionar system en user (modelos free que no aceptan rol system)
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "user", content: systemPrompt + "\n\nMensaje del usuario: " + message },
          ],
          temperature: 0.3,
          max_tokens: 900,
        }),
      });
      data = await res.json();
    }

    const content = data.choices?.[0]?.message?.content || "";
    // Parse JSON from response — tolerante a modelos que cortan el JSON
    // (ej: laguna-xs free devuelve {"action":"list_products","params":{"estado":"pendi
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // JSON cortado: intentar reparar extrayendo campos clave con regex
        const repaired = {};
        const actionM = content.match(/"action"\s*:\s*"([^"]+)"/);
        if (actionM) repaired.action = actionM[1];
        const idM = content.match(/"id"\s*:\s*(\d+)/);
        if (idM) repaired.params = Object.assign(repaired.params || {}, { id: parseInt(idM[1], 10) });
        const estadoM = content.match(/"estado"\s*:\s*"([^"]*)/);
        if (estadoM) repaired.params = Object.assign(repaired.params || {}, { estado: estadoM[1] });
        const nombreM = content.match(/"nombre"\s*:\s*"([^"]*)/);
        if (nombreM) repaired.params = Object.assign(repaired.params || {}, { nombre: nombreM[1] });
        if (repaired.action) {
          console.log("[Telegram Bot] IA devolvió JSON cortado, reparado:", JSON.stringify(repaired));
          return repaired;
        }
        return simpleIntentMatch(message);
      }
    }
    return simpleIntentMatch(message);
  } catch (e) {
    console.error("[Telegram Bot] AI error:", e.message);
    return simpleIntentMatch(message);
  }
}

// ---------- MODO CONVERSACIÓN ----------
// Memoria corta por chat: últimos 10 turnos para que la IA tenga contexto.
const chatMemory = new Map();

// Busca productos que coincidan con palabras clave de la pregunta del usuario.
// Ej: "cuáles creatinas tenemos?" -> busca LIKE '%creatin%' y devuelve matches reales.
function searchProductsForContext(userText) {
  if (!db || !userText) return [];
  try {
    // Palabras relevantes: sustantivos de 4+ letras (descarta "cuales", "tenemos", etc.)
    const stop = new Set(["cuales", "cual", "tienen", "tenemos", "disponibles", "disponible", "hay", "stock", "precio", "precios", "productos", "producto", "tienda", "cuanto", "cuantos", "cuantas", "donde", "como", "para", "sobre", "tienen", "tenes", "sos", "bot", "hola", "buenas", "gracias", "quiero", "puedo", "nuestro", "nuestra"]);
    const words = userText.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length >= 4 && !stop.has(w));
    if (!words.length) return [];
    const rows = db.prepare("SELECT nombre, marca, precio, stock, activo FROM productos WHERE activo=1 LIMIT 500").all();
    const scored = [];
    for (const p of rows) {
      const hay = (p.nombre + " " + (p.marca || "")).toLowerCase();
      let hits = 0;
      for (const w of words) if (hay.includes(w.slice(0, Math.max(4, w.length - 1)))) hits++;
      if (hits > 0) scored.push({ p, hits });
    }
    scored.sort((a, b) => b.hits - a.hits);
    return scored.slice(0, 10).map(s => s.p);
  } catch (e) {
    return [];
  }
}

function buildStoreContext(userText) {
  if (!db) return "";
  try {
    const total = db.prepare("SELECT COUNT(*) c FROM productos WHERE activo=1").get().c;
    const stockBajo = db.prepare("SELECT nombre, stock FROM productos WHERE activo=1 AND stock <= 5 ORDER BY stock ASC LIMIT 5").all();
    const pedidosPend = db.prepare("SELECT COUNT(*) c FROM pedidos WHERE estado='pendiente'").get().c;
    let ctx = `Tienda: Seiva Paraguay (seiva.com.py), suplementos, precios en guaraníes (Gs).\n`;
    ctx += `Productos activos: ${total}. Pedidos pendientes: ${pedidosPend}.\n`;
    // Búsqueda dirigida: si la pregunta menciona productos, traer los matches reales.
    const matches = searchProductsForContext(userText);
    if (matches.length) {
      ctx += `Productos que coinciden con tu consulta:\n` + matches.map(p => `- ${p.nombre}${p.marca ? " (" + p.marca + ")" : ""} | Gs. ${Number(p.precio).toLocaleString("es-PY")} | stock ${p.stock}`).join("\n") + "\n";
    }
    const topProductos = db.prepare("SELECT nombre, precio, stock FROM productos WHERE activo=1 ORDER BY id DESC LIMIT 8").all();
    if (topProductos.length && !matches.length) {
      ctx += `Últimos productos cargados:\n` + topProductos.map(p => `- ${p.nombre} | Gs. ${Number(p.precio).toLocaleString("es-PY")} | stock ${p.stock}`).join("\n") + "\n";
    }
    if (stockBajo.length) {
      ctx += `Stock bajo (≤5): ` + stockBajo.map(p => `${p.nombre} (${p.stock})`).join(", ") + "\n";
    }
    return ctx;
  } catch (e) {
    return "";
  }
}

async function chatWithAI(chatId, userText) {
  await sendMessage(chatId, "💭 Pensando…");
  if (!OPENROUTER_API_KEY) {
    return sendMessage(chatId, "No tengo IA configurada (falta OPENROUTER_API_KEY en el server). Mientras tanto: mandame un link o foto de producto y lo subo, o un .txt de factura y actualizo precios.");
  }
  const system = `Sos el asistente de Telegram de Seiva Paraguay, una tienda de suplementos en Paraguay. El dueño (Luis) te escribe para conversar y consultarte sobre su tienda.

Reglas:
- Respondé en español, tono cercano, usando "vos" (español rioplatense/paraguayo).
- Usá los datos reales de la tienda que te paso como contexto. Si no sabés algo, decilo.
- Precios en guaraníes (Gs.) con separador de miles.
- No prometas funciones que no tenés. Lo que PODÉS hacer además de conversar: subir productos (te mandan link o foto), actualizar precio de proveedor (factura .txt con precios en reales), listar productos/pedidos, y actualizar pedidos.
- Si el usuario pide alguna de esas acciones, indicale cómo pedirla (ej: "mandame el link del producto y lo subo").
- Sé breve y útil. Máximo un par de párrafos.

Contexto actual de la tienda:
${buildStoreContext(userText)}`;

  // Memoria: últimos 10 turnos
  const mem = chatMemory.get(chatId) || [];
  mem.push({ role: "user", content: userText });
  while (mem.length > 10) mem.shift();
  chatMemory.set(chatId, mem);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: system },
          ...mem.map(m => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) {
      mem.push({ role: "assistant", content: reply });
      while (mem.length > 10) mem.shift();
      chatMemory.set(chatId, mem);
      return sendMessage(chatId, reply);
    }
    return sendMessage(chatId, "La IA no respondió (modelo ocupado o sin créditos). Probá de nuevo en un rato o mandame un link/foto para subir un producto.");
  } catch (e) {
    console.error("[Telegram Bot] chatWithAI error:", e.message);
    return sendMessage(chatId, "Error hablando con la IA: " + e.message);
  }
}

// Simple keyword matching fallback
function simpleIntentMatch(message) {  const msg = message.toLowerCase().trim();
  const result = { action: "unknown", params: {}, response: "" };

  if (msg.startsWith("/start") || msg === "ayuda" || msg === "help") {
    result.action = "help";
    result.response = "Comandos disponibles";
  } else if (msg.includes("agregar producto") || msg.includes("nuevo producto") || msg.includes("add product")) {
    result.action = "add_product";
    result.params = extractProductParams(message);
    result.response = "Producto agregado";
  } else if (msg.includes("actualizar") || msg.includes("update")) {
    if (msg.includes("pedido") || msg.includes("orden")) {
      result.action = "update_order";
      result.params = extractOrderParams(message);
      result.response = "Pedido actualizado";
    } else {
      result.action = "update_product";
      result.params = extractProductParams(message);
      result.response = "Producto actualizado";
    }
  } else if (msg.includes("eliminar") || msg.includes("borrar") || msg.includes("delete")) {
    result.action = "delete_product";
    result.params = extractProductParams(message);
    result.response = "Producto eliminado";
  } else if (msg.includes("listar productos") || msg.includes("ver productos") || msg.includes("productos")) {
    result.action = "list_products";
    result.response = "Lista de productos";
  } else if (msg.includes("pedido") || msg.includes("orden") || msg.includes("order")) {
    const num = message.match(/\d+/);
    if (num) {
      result.action = "get_order";
      result.params = { id: parseInt(num[0]) };
      result.response = "Detalle del pedido";
    } else {
      result.action = "list_orders";
      result.response = "Lista de pedidos";
    }
  } else if (msg.includes("ver producto") || msg.includes("buscar")) {
    result.action = "get_product";
    result.params = { nombre: message.replace(/ver producto|buscar/gi, "").trim() };
    result.response = "Detalle del producto";
  }

  return result;
}

// Extract product params from message
function extractProductParams(message) {
  const params = {};
  const precioMatch = message.match(/(?:precio|price)\s*:?\s*(\d+)/i);
  const stockMatch = message.match(/(?:stock|cantidad)\s*:?\s*(\d+)/i);
  const nombreMatch = message.match(/(?:nombre|producto|name)\s*:?\s*([^\n,]+)/i);
  const marcaMatch = message.match(/(?:marca|brand)\s*:?\s*([^\n,]+)/i);
  const catMatch = message.match(/(?:categoría|categoria|category)\s*:?\s*([^\n,]+)/i);
  const descMatch = message.match(/(?:descripci[oó]n|descripcion|desc)\s*:?\s*([^\n]+)/i);

  if (precioMatch) params.precio = parseInt(precioMatch[1]);
  if (stockMatch) params.stock = parseInt(stockMatch[1]);
  if (nombreMatch) params.nombre = nombreMatch[1].trim();
  if (marcaMatch) params.marca = marcaMatch[1].trim();
  if (catMatch) params.categoria = catMatch[1].trim();
  if (descMatch) params.descripcion = descMatch[1].trim();

  return params;
}

// Extract order params from message
function extractOrderParams(message) {
  const params = {};
  const idMatch = message.match(/(?:pedido|orden|order)\s*:?\s*(\d+)/i);
  const estadoMatch = message.match(/(?:estado|a|to)\s*:?\s*(\w+)/i);

  if (idMatch) params.id = parseInt(idMatch[1]);
  if (estadoMatch) params.estado = estadoMatch[1].toLowerCase();

  return params;
}

// Execute action
async function executeAction(action, params) {
  if (!db) return { success: false, message: "Database not initialized" };

  try {
    switch (action) {
      case "list_products": {
        const products = db.prepare("SELECT id, nombre, precio, stock, marca, activo FROM productos ORDER BY id DESC LIMIT 20").all();
        return { success: true, data: products, type: "product_list" };
      }

      case "get_product": {
        let product;
        if (params.id) {
          product = db.prepare("SELECT * FROM productos WHERE id = ?").get(params.id);
        } else if (params.nombre) {
          product = db.prepare("SELECT * FROM productos WHERE nombre LIKE ?").get(`%${params.nombre}%`);
        }
        return { success: !!product, data: product, type: "product_detail" };
      }

      case "add_product": {
        if (!params.nombre) return { success: false, message: "Falta el nombre del producto" };
        const stmt = db.prepare(`INSERT INTO productos (nombre, precio, stock, marca, categoria, descripcion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)`);
        const result = stmt.run(
          params.nombre,
          params.precio || 0,
          params.stock || 0,
          params.marca || "",
          params.categoria || "suplementos",
          params.descripcion || ""
        );
        return { success: true, data: { id: result.lastInsertRowid }, type: "product_added" };
      }

      case "update_product": {
        const updates = [];
        const values = [];
        if (params.precio !== undefined) { updates.push("precio = ?"); values.push(params.precio); }
        if (params.stock !== undefined) { updates.push("stock = ?"); values.push(params.stock); }
        if (params.nombre) { updates.push("nombre = ?"); values.push(params.nombre); }
        if (params.marca) { updates.push("marca = ?"); values.push(params.marca); }
        if (params.categoria) { updates.push("categoria = ?"); values.push(params.categoria); }
        if (params.descripcion) { updates.push("descripcion = ?"); values.push(params.descripcion); }
        if (params.activo !== undefined) { updates.push("activo = ?"); values.push(params.activo ? 1 : 0); }

        if (updates.length === 0) return { success: false, message: "Nada que actualizar" };

        let whereClause;
        if (params.id) {
          whereClause = "WHERE id = ?";
          values.push(params.id);
        } else if (params.nombre) {
          whereClause = "WHERE nombre LIKE ?";
          values.push(`%${params.nombre}%`);
        } else {
          return { success: false, message: "Especificá ID o nombre del producto" };
        }

        db.prepare(`UPDATE productos SET ${updates.join(", ")} ${whereClause}`).run(...values);
        return { success: true, type: "product_updated" };
      }

      case "delete_product": {
        if (params.id) {
          db.prepare("DELETE FROM productos WHERE id = ?").run(params.id);
        } else if (params.nombre) {
          db.prepare("DELETE FROM productos WHERE nombre LIKE ?").run(`%${params.nombre}%`);
        } else {
          return { success: false, message: "Especificá ID o nombre" };
        }
        return { success: true, type: "product_deleted" };
      }

      case "list_orders": {
        let orders;
        if (params.estado) {
          orders = db.prepare("SELECT * FROM pedidos WHERE estado = ? ORDER BY id DESC LIMIT 20").all(params.estado);
        } else {
          orders = db.prepare("SELECT * FROM pedidos ORDER BY id DESC LIMIT 20").all();
        }
        return { success: true, data: orders, type: "order_list" };
      }

      case "get_order": {
        const order = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(params.id);
        return { success: !!order, data: order, type: "order_detail" };
      }

      case "update_order": {
        if (!params.id) return { success: false, message: "Falta ID del pedido" };
        if (params.estado) {
          db.prepare("UPDATE pedidos SET estado = ? WHERE id = ?").run(params.estado, params.id);
        }
        return { success: true, type: "order_updated" };
      }

      default:
        return { success: false, message: "Acción no reconocida" };
    }
  } catch (e) {
    console.error("[Telegram Bot] Action error:", e.message);
    return { success: false, message: e.message };
  }
}

// Format response for Telegram
function formatResponse(action, result) {
  if (!result.success) {
    return `❌ ${result.message || "Error"}`;
  }

  switch (result.type) {
    case "product_list": {
      if (!result.data.length) return "📦 No hay productos.";
      let text = "📦 <b>Productos:</b>\n\n";
      result.data.forEach(p => {
        const status = p.activo ? "✅" : "⏸️";
        text += `${status} <b>#${p.id}</b> ${p.nombre}\n   💰 ${Number(p.precio).toLocaleString("es-PY")} | Stock: ${p.stock}\n`;
      });
      return text;
    }

    case "product_detail": {
      if (!result.data) return "❌ Producto no encontrado.";
      const p = result.data;
      return `📦 <b>${p.nombre}</b> (#${p.id})
💰 Precio: ${Number(p.precio).toLocaleString("es-PY")}
📊 Stock: ${p.stock}
🏷️ Marca: ${p.marca || "—"}
📂 Categoría: ${p.categoria || "—"}
📝 ${p.descripcion || "Sin descripción"}
${p.activo ? "✅ Activo" : "⏸️ Inactivo"}`;
    }

    case "product_added":
      return `✅ Producto agregado (ID: ${result.data.id})`;

    case "product_updated":
      return `✅ Producto actualizado`;

    case "product_deleted":
      return `✅ Producto eliminado`;

    case "order_list": {
      if (!result.data.length) return "📋 No hay pedidos.";
      let text = "📋 <b>Pedidos:</b>\n\n";
      result.data.forEach(o => {
        const statusEmoji = { pendiente: "⏳", confirmado: "✅", enviado: "🚚", entregado: "📦", cancelado: "❌" }[o.estado] || "❓";
        text += `${statusEmoji} <b>#${o.id}</b> ${o.cliente}\n   💰 ${Number(o.total).toLocaleString("es-PY")} | ${o.estado}\n`;
      });
      return text;
    }

    case "order_detail": {
      if (!result.data) return "❌ Pedido no encontrado.";
      const o = result.data;
      let text = `📋 <b>Pedido #${o.id}</b>\n`;
      text += `👤 Cliente: ${o.cliente}\n`;
      text += `📱 WhatsApp: ${o.whatsapp || "—"}\n`;
      text += `📍 Dirección: ${o.direccion || "—"}\n`;
      text += `💰 Total: ${Number(o.total).toLocaleString("es-PY")}\n`;
      text += `📦 Estado: ${o.estado}\n`;
      text += `💳 Pago: ${o.metodo_pago}\n`;
      if (o.notas) text += `📝 Notas: ${o.notas}`;
      return text;
    }

    case "order_updated":
      return `✅ Pedido actualizado`;

    default:
      return result.message || "✅ Listo";
  }
}

// Detecta si el texto es un comando de acción (no conversación).
// Si NO matchea, el mensaje se deriva al MODO CONVERSACIÓN (IA).
function isExplicitCommand(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return false;
  if (t.startsWith("/")) return true; // /start, /debug, /cargar, /factura...
  // Palabras que indican una acción sobre la DB, no una pregunta.
  const accion = /(^|\b)(agregar producto|nuevo producto|add product|actualizar|modificar|eliminar|borrar|delete|listar|ver producto|producto\s+\d+|pedido\s+\d+|listar pedidos|actualizar pedido|cargar producto|subir producto|factura|crear pedido)/i;
  if (accion.test(t)) return true;
  return false;
}

// Handle incoming webhook
async function handleWebhook(update) {
  // Log de diagnóstico: ver exactamente qué llega de Telegram.
  try {
    if (update.message) {
      const m = update.message;
      console.log("[TG-IN] chat=" + m.chat.id + " text=" + JSON.stringify((m.text || "").slice(0, 120)) +
        " caption=" + JSON.stringify((m.caption || "").slice(0, 80)) +
        " photo=" + (m.photo ? m.photo.length : 0) + " doc=" + (m.document ? m.document.file_name : "-"));
    } else if (update.callback_query) {
      console.log("[TG-IN] cb chat=" + update.callback_query.message.chat.id + " data=" + update.callback_query.data);
    }
  } catch (e) { /* no romper el flujo por logging */ }

  // Diagnóstico: /debug responde qué código corre el server + config + chat id.
  if (update.message && update.message.text && update.message.text.trim() === "/debug") {
    const cid = update.message.chat.id;
    return sendMessage(cid,
      "🔧 <b>Debug del bot</b>\n" +
      "Build: <code>" + BUILD_TAG + "</code>\n" +
      "Tu chat ID: <code>" + cid + "</code>\n" +
      "Chats permitidos: " + (ALLOWED_CHATS.length ? ALLOWED_CHATS.join(", ") : "(todos)") + "\n" +
      "IA: " + (OPENROUTER_API_KEY ? "OpenRouter" : "sin key") + " · modelo: " + OPENROUTER_MODEL + " · COPY_PROVIDER=" + (process.env.COPY_PROVIDER || "openrouter") + "\n" +
      "Router: activo · Sesión alta: " + (productWizard.hasSession(cid) ? "sí" : "no") + " · Sesión factura: " + (invoiceWizard.hasSession(cid) ? "sí" : "no"));
  }

  // Router de intención: link/foto -> producto, .txt factura -> precio proveedor.
  const handled = await botRouter.handleUpdate(update);
  if (handled) return;

  // Handle callback queries (inline keyboard buttons)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;

    await telegramAPI("answerCallbackQuery", { callback_query_id: cb.id });

    if (data.startsWith("order_")) {
      const orderId = parseInt(data.replace("order_", ""));
      const result = await executeAction("get_order", { id: orderId });
      const text = formatResponse("get_order", result);
      await sendMessage(chatId, text);
    } else if (data.startsWith("order_status_")) {
      const [_, orderId, estado] = data.split("_");
      const result = await executeAction("update_order", { id: parseInt(orderId), estado });
      const text = formatResponse("update_order", result);
      await sendMessage(chatId, text);
    }
    return;
  }

  // Handle messages
  if (!update.message) return;

  const chatId = update.message.chat.id;
  const text = update.message.text || update.message.caption || "";
  const photo = update.message.photo;
  const document = update.message.document;

  // RED DE SEGURIDAD: si el mensaje tiene link o foto y llegó hasta acá,
  // significa que el router no lo capturó (no debería pasar). Lo mandamos
  // directo al wizard de alta en vez de clasificarlo con la IA.
  if (/https?:\/\//i.test(text) || (photo && photo.length)) {
    console.warn("[TG-IN] link/foto llegó al flujo viejo — redirigiendo al wizard de alta");
    const rescued = await productWizard.handleUpdate(update);
    if (rescued) return;
  }

  // Handle photo upload (product image)
  if (photo && photo.length > 0) {
    const largestPhoto = photo[photo.length - 1];
    const fileResult = await getFile(largestPhoto.file_id);
    if (fileResult.ok) {
      const fileBuffer = await downloadFile(fileResult.result.file_path);
      const filename = `telegram-${Date.now()}.jpg`;
      const imgPath = path.join(__dirname, "..", "img", "productos", filename);
      fs.writeFileSync(imgPath, fileBuffer);
      await sendMessage(chatId, `📸 Imagen recibida: /img/productos/${filename}\nUsala con: agregar producto nombre precio stock imagen:/img/productos/${filename}`);
    }
    return;
  }

  // Handle document upload
  if (document && document.mime_type?.startsWith("image/")) {
    const fileResult = await getFile(document.file_id);
    if (fileResult.ok) {
      const fileBuffer = await downloadFile(fileResult.result.file_path);
      const filename = `telegram-${Date.now()}-${document.file_name}`;
      const imgPath = path.join(__dirname, "..", "img", "productos", filename);
      fs.writeFileSync(imgPath, fileBuffer);
      await sendMessage(chatId, `📸 Imagen recibida: /img/productos/${filename}`);
    }
    return;
  }

  // Handle text commands
  if (!text) return;

  // MODO CONVERSACIÓN: cualquier texto que NO sea un comando explícito
  // (link/foto/.txt ya fueron capturados por el router/seguridad arriba)
  // va a la IA para que el dueño pueda preguntar y charlar con la tienda.
  if (!isExplicitCommand(text)) {
    return chatWithAI(chatId, text);
  }

  // Comando explícito: clasificar y ejecutar acción de DB.
  const intent = await understandIntent(text);

  // Si no se entendió la intención: MODO CONVERSACIÓN con IA + contexto de la tienda.
  if (!intent || !intent.action || intent.action === "unknown") {
    return chatWithAI(chatId, text);
  }

  if (intent.action === "help") {
    const helpText = `🤖 <b>Seiva Bot</b> <code>${BUILD_TAG}</code>

🚀 <b>Lo más fácil:</b>
• Pegame un <b>link</b> de producto (podés sumar "precio 60mil stock 5") → lo subo a la web
• Mandame una <b>foto</b> → subo el producto
• Mandame un <b>.txt</b> de factura → actualizo precios de proveedor
• Escribí "subir producto" para empezar

📦 <b>Inventario (lenguaje natural):</b>
• listar productos / ver producto [nombre]
• actualizar producto [id] campo valor

📋 <b>Pedidos:</b>
• listar pedidos [estado] / pedido [id]
• actualizar pedido [id] estado [nuevo]

🔧 /debug → diagnóstico del bot`;
    await sendMessage(chatId, helpText);
    return;
  }

  // Execute action
  const result = await executeAction(intent.action, intent.params);
  const responseText = formatResponse(intent.action, result);

  // Add inline keyboard for orders
  if (intent.action === "list_orders" && result.success && result.data.length > 0) {
    const keyboard = {
      inline_keyboard: result.data.slice(0, 10).map(o => [
        { text: `#${o.id} ${o.cliente} (${o.estado})`, callback_data: `order_${o.id}` },
      ]),
    };
    await sendMessage(chatId, responseText, { reply_markup: keyboard });
  } else {
    await sendMessage(chatId, responseText);
  }
}

module.exports = {
  init,
  setWebhook,
  handleWebhook,
  sendMessage,
  telegramAPI,
};
