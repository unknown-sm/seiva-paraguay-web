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
  console.log("[Router] productWizard ->", r1 ? "handled" : "skip");
  if (r1) return r1;
  const r2 = await invoiceWizard.handleUpdate(update);
  console.log("[Router] invoiceWizard ->", r2 ? "handled" : "skip");
  if (r2) return r2;

  // No entendió nada: NO capturamos el mensaje. Devolvemos false para que
  // telegram-bot.js lo derive al MODO CONVERSACIÓN (IA con contexto de tienda).
  // (Un Promise es truthy: si mandáramos el help con `return tg.sendMessage`,
  //  el router reportaría "handled" y la IA nunca respondería. Por eso false.)
  return false;
}

module.exports = { init, handleUpdate };
