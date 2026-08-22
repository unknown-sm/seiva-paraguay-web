// Router de intención para el bot de Telegram.
// Sin comandos: link/foto -> alta de producto; .txt de factura -> precio proveedor.
// Si hay una sesión activa de alguno de los wizards, va a ese.

const productWizard = require("./product-wizard");
const invoiceWizard = require("./invoice-wizard");

// Inyectado por telegram-bot.init() para evitar dependencia circular.
let tg = {
  sendMessage: (cid, text) => Promise.resolve({ ok: false, error: "tg no inicializado" }),
};

function init(ctx) {
  if (ctx && ctx.tg) tg = ctx.tg;
}

function chatIdOf(update) {
  if (update.message) return update.message.chat.id;
  if (update.callback_query) return update.callback_query.message.chat.id;
  return null;
}

async function handleUpdate(update) {
  const cid = chatIdOf(update);

  // Si hay sesión activa, la respetamos (el usuario está a mitad de un flujo).
  if (cid) {
    if (productWizard.hasSession(cid)) return productWizard.handleUpdate(update);
    if (invoiceWizard.hasSession(cid)) return invoiceWizard.handleUpdate(update);
  }

  // Sin sesión: cada wizard detecta su propia intención y arranca solo.
  const r1 = await productWizard.handleUpdate(update);
  if (r1) return r1;
  const r2 = await invoiceWizard.handleUpdate(update);
  if (r2) return r2;

  // No entendió nada: preguntar, no tirar error.
  if (cid) {
    return tg.sendMessage(cid,
      "No capté qué querés hacer. Podés:\n" +
      "• Pegarme un <b>link</b> o mandar una <b>foto</b> de un producto para subirlo a la web.\n" +
      "• Mandarme un <b>.txt</b> de factura (con precios en reales) para cargar precio de proveedor.\n" +
      "También podés usar /cargar o /factura si preferís.");
  }
  return false;
}

module.exports = { init, handleUpdate };
