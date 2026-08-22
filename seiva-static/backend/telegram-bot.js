const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const productWizard = require("./product-wizard");
const invoiceWizard = require("./invoice-wizard");
const botRouter = require("./bot-router");

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || crypto.randomBytes(32).toString("hex");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";

// Bot state
let db = null;
let botInfo = null;

// Initialize bot with database reference
function init(database, shared = {}) {
  db = database;
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("[Telegram Bot] No TELEGRAM_BOT_TOKEN set - bot disabled");
    return;
  }
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
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        max_tokens: 500,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return simpleIntentMatch(message);
  } catch (e) {
    console.error("[Telegram Bot] AI error:", e.message);
    return simpleIntentMatch(message);
  }
}

// Simple keyword matching fallback
function simpleIntentMatch(message) {
  const msg = message.toLowerCase().trim();
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

// Handle incoming webhook
async function handleWebhook(update) {
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
  const text = update.message.text || "";
  const photo = update.message.photo;
  const document = update.message.document;

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

  // Understand intent with AI
  const intent = await understandIntent(text);

  if (intent.action === "help") {
    const helpText = `🤖 <b>Seiva Bot - Comandos</b>

📦 <b>Inventario:</b>
• listar productos
• ver producto [nombre/id]
• agregar producto [nombre] precio [X] stock [X]
• actualizar producto [id] campo valor
• eliminar producto [id/nombre]

📋 <b>Pedidos:</b>
• listar pedidos [estado]
• pedido [id]
• actualizar pedido [id] estado [nuevo estado]

📸 <b>Imágenes:</b>
• Enviá una foto para subir como imagen de producto

💡 <b>Ejemplos:</b>
• agregar vitamina c precio 50000 stock 100
• pedido 123
• actualizar pedido 123 estado confirmado
• listar pedidos pendientes`;
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
