// Router de proveedor de generación de textos (copy).
// COPY_PROVIDER: openrouter | custom | stub
// - openrouter: usa OPENROUTER_API_KEY + OPENROUTER_MODEL (ya config en el bot)
// - custom: vos implementás copy-provider.custom.js
// - stub: devuelve plantilla local (útil para dev/tests sin gastar tokens)

const provider = (process.env.COPY_PROVIDER || "openrouter").toLowerCase();

let mod;
if (provider === "custom") {
  mod = require("./copy-provider.custom");
} else if (provider === "stub") {
  mod = require("./copy-provider.stub");
} else {
  mod = require("./copy-provider.openrouter");
}

module.exports = {
  provider,
  generateCopy: mod.generateCopy,
};
