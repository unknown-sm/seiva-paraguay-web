// build_v3.js — "Seiva - Inventario v3 (determinista)".
// Un ÚNICO nodo Code con UNA salida (evita el error "Code doesn't return items
// properly" de n8n 2.36.8, que no soporta multi-salida en el nodo Code).
//   - Comandos deterministas (stock, publicar/ocultar, crear, lista, buscar,
//     ayuda) se resuelven con regex y escriben a la DB directo.
//   - El resto (charla libre) llama a OpenRouter directo desde el router.
//   - Respuesta SIEMPRE del resultado real; la IA jamás escribe en la DB.

const fs = require('fs');
const path = require('path');

let TOKEN = '';
try { TOKEN = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim(); } catch (e) {}

let OR_KEY = '';
try {
  // n8n.txt: línea 8 (índice 7) = openrouter key
  OR_KEY = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[7].trim();
} catch (e) {}

const CRED_TG = { telegramApi: { id: 'wtekAWcrcfSlrW67', name: 'SEIVA Bot' } };

const ROUTER_JS = `const tg = $('Telegram Trigger').item.json;
const m = tg.message || (tg.callback_query && tg.callback_query.message);
if (!m || !m.chat) { return []; }
const cid = m.chat.id;
const txt = String(m.text || m.caption || '').trim();

const API = 'https://seiva.com.py/api/productos';
const TOKEN = '${TOKEN}';
const OR_KEY = '${OR_KEY}';
const _http = this.helpers.httpRequest;

async function call(method, p, body) {
  const opts = { method: method, url: API + p, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, json: true };
  if (body !== undefined && body !== null) opts.body = body;
  return await _http(opts);
}

// Cargar inventario (mismo token verificado)
let prods = [];
try {
  const invRaw = await _http({ method: 'GET', url: API + '/all', headers: { Authorization: 'Bearer ' + TOKEN }, json: true });
  prods = Array.isArray(invRaw) ? invRaw : (invRaw && Array.isArray(invRaw.data) ? invRaw.data : []);
} catch (e) { prods = []; }
prods = prods.filter(p => p && typeof p === 'object');

const fmt = n => Number(n || 0).toLocaleString('es-PY');
const nums = t => (t.match(/\\d+/g) || []).map(Number);
const inv = prods.map(p => 'ID ' + p.id + ' | ' + p.nombre + ' | stock:' + p.stock + ' | precio:' + p.precio + ' | ' + (p.activo ? 'publicado' : 'oculto')).join('\\n');

// ÚNICA salida
function out(texto) { return [{ json: { chatId: cid, texto: texto } }]; }

const HELP = '🤖 <b>Seiva Bot — Inventario</b>\\n\\n' +
  '🆕 <b>Crear producto:</b>\\n<code>crear Nombre del producto precio 60000 stock 10</code>\\n\\n' +
  '📊 <b>Stock:</b>\\n<code>stock 188 5</code> → poner el producto 188 en 5\\n' +
  'También: "poné el 188 en 5", "stock del 188 a 10"\\n\\n' +
  '🌐 <b>Publicar / ocultar:</b>\\n<code>publicar 188</code> · <code>ocultar 188</code>\\n\\n' +
  '📦 <b>Listar:</b>\\n<code>lista</code> (los 40 últimos)\\n\\n' +
  '🔎 <b>Buscar:</b>\\n<code>buscar colostro</code> · "¿cuánto stock de creatina?"\\n\\n' +
  '💬 Cualquier otra cosa, escribime y te ayudo.';

// --- 0. Ayuda ---
if (/^\\/start$|^\\/debug$|^\\/help$|^ayuda$|^help$|^menu$|^comandos?$/i.test(txt)) {
  return out(HELP);
}

// --- 1. Listar ---
if (/^(lista|listar|listame|listá|productos|inventario)$/i.test(txt) || /^(ver|mostrar)\\s+(todo|productos|inventario)$/i.test(txt)) {
  if (!prods.length) return out('📦 No hay productos cargados (o no pude leer el inventario).');
  const top = prods.slice(0, 40);
  let o = '📦 <b>Productos (' + top.length + ' de ' + prods.length + '):</b>\\n';
  for (const p of top) {
    o += (p.activo ? '✅' : '⏸️') + ' <b>#' + p.id + '</b> ' + p.nombre + '\\n      💰 ' + fmt(p.precio) + ' Gs · stock: ' + p.stock + '\\n';
  }
  return out(o);
}

// --- 2. Crear producto ---
if (/^(?:crear|crea|nuevo\\s+producto|nuevo|agregar\\s+producto|agregar|alta|cargar\\s+producto|cargar)\\b/i.test(txt)) {
  let resto = txt.replace(/^(?:crear|crea|nuevo\\s+producto|nuevo|agregar\\s+producto|agregar|alta|cargar\\s+producto|cargar)\\b\\s*(?:producto)?\\s*[:\\-]?\\s*/i, '').trim();
  let precio = null, stock = 0, marca = '';
  const pm = resto.match(/\\bprecio\\s*[:\\=]?\\s*(\\d+)/i);
  if (pm) { precio = parseInt(pm[1]); resto = resto.replace(/\\bprecio\\s*[:\\=]?\\s*\\d+/i, ' '); }
  const sm = resto.match(/\\bstock\\s*[:\\=]?\\s*(\\d+)/i);
  if (sm) { stock = parseInt(sm[1]); resto = resto.replace(/\\bstock\\s*[:\\=]?\\s*\\d+/i, ' '); }
  const mm = resto.match(/\\bmarca\\s*[:\\=]?\\s*([^,;]+)/i);
  if (mm) { marca = mm[1].trim(); resto = resto.replace(/\\bmarca\\s*[:\\=]?\\s*[^,;]+/i, ' '); }
  const nombre = resto.replace(/[:\\=,;|]+/g, ' ').replace(/\\s+/g, ' ').trim();
  if (!nombre) return out('❌ Faltó el nombre. Formato: <code>crear Nombre del producto precio 60000 stock 10</code>');
  if (precio === null) return out('❌ Faltó el precio. Formato: <code>crear Nombre del producto precio 60000 stock 10</code>');
  try {
    const r = await call('POST', '', { nombre: nombre, precio: precio, stock: stock, marca: marca });
    return out('✅ Producto creado:\\n<b>#' + r.id + '</b> ' + nombre + '\\n💰 ' + fmt(precio) + ' Gs · stock ' + stock);
  } catch (e) {
    return out('❌ No pude crear el producto: ' + e.message);
  }
}

// --- 2b. Stock ---
if (/(?:\\bstock\\b|pon[eé]?|poner|dej[aá](?:r|me)?|cambiar)/i.test(txt) && nums(txt).length >= 2) {
  const n = nums(txt);
  const id = n[0];
  const val = n[n.length - 1];
  if (val < 0) return out('❌ El stock no puede ser negativo.');
  try {
    await call('PATCH', '/stock-batch', { updates: [{ id: id, stock: val }] });
    const p = prods.find(x => x.id === id);
    return out('✅ Stock de <b>#' + id + '</b>' + (p ? ' (' + p.nombre + ')' : '') + ' actualizado a <b>' + val + '</b> unidades.');
  } catch (e) {
    return out('❌ No pude actualizar el stock: ' + e.message);
  }
}

// --- 3. Publicar / ocultar ---
const publ = /public(?:o|a|ar)|activ(?:o|a|ar)|mostr(?:a|ar)/i.test(txt);
const ocult = /ocult(?:o|a|ar)|despublic(?:o|a|ar)|desactiv(?:o|a|ar)|inactiv(?:o|a|ar)|escond(?:e|er)/i.test(txt);
if ((publ || ocult) && nums(txt).length >= 1) {
  const id = nums(txt)[0];
  const p = prods.find(x => x.id === id);
  const actual = p ? !!p.activo : null;
  if (actual !== null) {
    if (publ && actual) return out('ℹ️ El producto <b>#' + id + '</b>' + (p ? ' (' + p.nombre + ')' : '') + ' ya está <b>PUBLICADO</b>.');
    if (ocult && !actual) return out('ℹ️ El producto <b>#' + id + '</b>' + (p ? ' (' + p.nombre + ')' : '') + ' ya está <b>OCULTO</b>.');
  }
  try {
    const r = await call('PATCH', '/' + id + '/toggle', undefined);
    return out((r && r.activo ? '✅' : '⏸️') + ' Producto <b>#' + id + '</b> ahora está <b>' + (r && r.activo ? 'PUBLICADO' : 'OCULTO') + '</b>.');
  } catch (e) {
    return out('❌ No pude cambiar el estado: ' + e.message);
  }
}

// --- 4. Buscar ---
if (/(?:busca[r]?|cu[aá]nto|cu[aá]l|qu[eé]\\s*stock|stock\\s+de)/i.test(txt)) {
  const q = txt.replace(/busca[r]?|cu[aá]nto|cu[aá]l|stock|hay|tienen|tenemos|ten[eé]s|de\\b|la\\b|el\\b/gi, ' ')
    .toLowerCase().replace(/[^a-záéíóúñ0-9\\s]/g, ' ').split(/\\s+/).filter(w => w.length >= 3).join(' ');
  if (!q) return out('🔎 Decime qué producto buscás, ej: <code>buscar colostro</code>');
  const words = q.split(' ');
  const hits = prods.filter(p => { const h = (p.nombre || '').toLowerCase(); return words.some(w => h.includes(w)); }).slice(0, 10);
  if (!hits.length) return out('🔎 No encontré nada con "' + q + '". Probá con <code>lista</code>.');
  let o = '🔎 Resultados:\\n';
  for (const p of hits) o += '✅ <b>#' + p.id + '</b> ' + p.nombre + ' · ' + fmt(p.precio) + ' Gs · stock <b>' + p.stock + '</b>\\n';
  return out(o);
}

// --- 5. Charla libre → OpenRouter (solo responde, NUNCA escribe) ---
try {
  const r = await _http({
    method: 'POST',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    json: true,
    body: {
      model: 'xiaomi/mimo-v2.5',
      messages: [
        { role: 'system', content: 'Sos el asistente de Telegram de Seiva Paraguay, tienda de suplementos (precios en guaraníes Gs). Respondé en español rioplatense, tono cercano y breve. Usá el INVENTARIO para dar datos reales (ID, stock, precio). NO afirmes haber hecho cambios en la base de datos: vos solo respondés, no modificás nada. Si el usuario pide cambiar stock o publicar/ocultar/crear, decile los comandos: "stock ID valor", "publicar ID", "ocultar ID", "crear Nombre precio N stock N", "lista", "buscar texto".' },
        { role: 'user', content: txt + '\\n\\nINVENTARIO (datos reales):\\n' + inv }
      ],
      temperature: 0.6,
      max_tokens: 500
    }
  });
  const reply = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : null;
  return out(reply || 'No pude responder ahora. Escribí "ayuda" para ver los comandos.');
} catch (e) {
  return out('💬 No pude procesar eso. Escribí "ayuda" para ver los comandos.');
}`;

const nodes = [
  {
    parameters: { updates: ['message', 'callback_query'], additionalFields: {} },
    id: 'tg', name: 'Telegram Trigger', type: 'n8n-nodes-base.telegramTrigger',
    typeVersion: 1.2, position: [-360, 300], credentials: CRED_TG,
    webhookId: 'seiva-agent-v3'
  },
  {
    parameters: { jsCode: ROUTER_JS },
    id: 'route', name: 'Router', type: 'n8n-nodes-base.code',
    typeVersion: 2, position: [-140, 300]
  },
  {
    parameters: {
      chatId: '={{ $json.chatId }}',
      text: '={{ $json.texto }}',
      additionalFields: { appendAttribution: false }
    },
    id: 'resp', name: 'Responder', type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2, position: [80, 300], credentials: CRED_TG
  }
];

const connections = {
  'Telegram Trigger': { main: [[{ node: 'Router', type: 'main', index: 0 }]] },
  'Router': { main: [[{ node: 'Responder', type: 'main', index: 0 }]] }
};

const workflow = {
  name: 'Seiva - Inventario v3 (determinista)',
  nodes, connections,
  settings: { executionOrder: 'v1' }
};

const OUT = path.join(__dirname, '..', 'seiva-agente-inventario-v3.json');
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('JSON generado:', OUT);

// ---- deploy idempotente ----
const K = (() => { try { return fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim(); } catch (e) { return ''; } })();
const https = require('https');
function req(method, path_, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const r = https.request({
      hostname: 'n8n.seiva.com.py', path: path_, method,
      headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ status: res.statusCode, body: o })); });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.write(data); r.end();
  });
}
function get(path_) {
  return new Promise((resolve) => {
    https.get({ hostname: 'n8n.seiva.com.py', path: path_, headers: { 'X-N8N-API-KEY': K } }, res => {
      let o = ''; res.on('data', c => o += c); res.on('end', () => { try { resolve(JSON.parse(o)); } catch (e) { resolve({}); } });
    }).on('error', () => resolve({}));
  });
}

(async () => {
  if (!process.argv.includes('--deploy')) {
    console.log('(sin --deploy: solo se generó el JSON. Para crear/actualizar en n8n: node build_v3.js --deploy)');
    return;
  }
  let existingId = null;
  try {
    const resp = await get('/api/v1/workflows?limit=100');
    const list = (resp && resp.data) || [];
    const found = list.find(x => x.name === workflow.name);
    if (found) existingId = found.id;
  } catch (e) {}
  if (existingId) {
    const r = await req('PUT', '/api/v1/workflows/' + existingId, workflow);
    console.log('UPDATE HTTP', r.status, 'id:', existingId);
    if (r.status < 300) fs.writeFileSync(path.join(__dirname, 'v3_id.txt'), existingId);
  } else {
    const r = await req('POST', '/api/v1/workflows', workflow);
    console.log('CREATE HTTP', r.status, r.body.slice(0, 120));
    if (r.status < 300) { try { const j = JSON.parse(r.body); fs.writeFileSync(path.join(__dirname, 'v3_id.txt'), j.id); console.log('id:', j.id); } catch (e) {} }
  }
})();
