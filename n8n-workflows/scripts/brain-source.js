// ============================================================================
// SEIVA — Bot de inventario (Cerebro). Un único nodo Code, UNA salida.
// El LLM SOLO interpreta lenguaje natural y devuelve JSON. El Cerebro ejecuta
// de forma determinista y confirma SIEMPRE con el resultado real del backend.
// ============================================================================

const BASE = 'https://seiva.com.py/api';
const API_P = BASE + '/productos';
const TOKEN = '__TOKEN__';
const OR_KEY = '__OR_KEY__';
const TG_TOKEN = '__TG_TOKEN__';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'xiaomi/mimo-v2.5';
const _http = this.helpers.httpRequest;

// ---- HTTP genérico contra el backend (mismo token) ----
async function http(method, url, body) {
  const opts = { method, url, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, json: true };
  if (body !== undefined && body !== null) opts.body = body;
  return await _http(opts);
}

function out(texto) { return [{ json: { chatId: cid, texto } }]; }
const fmt = n => Number(n || 0).toLocaleString('es-PY');
const nums = t => (t.match(/\d+/g) || []).map(Number);

// ---- Mensaje entrante ----
const tg = $('Telegram Trigger').item.json;
const m = tg.message || (tg.callback_query && tg.callback_query.message);
if (!m || !m.chat) { return []; }
const cid = m.chat.id;
const text = String(m.text || m.caption || '').trim();
// Texto normalizado (sin acentos, minúsculas) para matchear con regex
const T = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const photo = m.photo ? m.photo[m.photo.length - 1] : null;
const doc = m.document || null;
const link = (text.match(/(https?:\/\/[^\s]+)/i) || [])[1] || null;

// ---- Inventario ----
let prods = [];
try {
  const r = await http('GET', API_P + '/all');
  prods = Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
} catch (e) { prods = []; }
prods = prods.filter(p => p && typeof p === 'object');
const inv = prods.map(p => 'ID ' + p.id + ' | ' + p.nombre + ' | stock:' + p.stock + ' | precio:' + p.precio + ' | marca:' + (p.marca || '') + ' | ' + (p.activo ? 'publicado' : 'oculto')).join('\n');

// ---- Sesión (FSM de confirmación) ----
async function getSession() {
  try { const r = await http('GET', BASE + '/bot-session/' + cid); return r || {}; } catch (e) { return {}; }
}
async function setSession(state, draft) {
  try { await http('PUT', BASE + '/bot-session/' + cid, { state, draft: draft || {} }); } catch (e) {}
}
async function clearSession() {
  try { await http('DELETE', BASE + '/bot-session/' + cid); } catch (e) {}
}
function parseDraft(s) { const d = s.draft || '{}'; if (typeof d === 'object') return d; try { return JSON.parse(d); } catch (e) { return {}; } }

// ---- LLM (interpreta o genera copy) ----
async function llm(system, user) {
  const r = await _http({
    method: 'POST', url: OR_URL,
    headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    json: true,
    body: {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.1, max_tokens: 1200
    }
  });
  const c = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : '';
  return c;
}
function parseJSON(s) {
  s = String(s || '').trim();
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  const i = s.indexOf('{'), f = s.lastIndexOf('}');
  if (i >= 0 && f > i) { try { return JSON.parse(s.slice(i, f + 1)); } catch (e) { return null; } }
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---- Log de cambios: console de n8n + tabla audit_log del backend ----
async function log(accion, id, detalle) {
  console.log('[SEIVA-BOT] ' + accion + ' producto=' + id + ' chat=' + cid + ' detalle=' + JSON.stringify(detalle || {}));
  try { await http('POST', BASE + '/audit', { accion: accion, producto_id: id, detalle: detalle || {}, chat_id: String(cid) }); } catch (e) {}
}

// ============================================================================
// HELP
// ============================================================================
const HELP = '🤖 <b>Inventario</b>\n' +
  '<code>stock 188 5</code> — cambiar stock\n' +
  '<code>el 43 stock 1</code> — también sirve\n' +
  '<code>publicar 188</code> · <code>ocultar 188</code>\n' +
  '<code>precio 188 70000</code> · <code>proveedor 188 45</code>\n' +
  '<code>crear Nombre precio 60000 stock 10</code>\n' +
  '<code>busca colostro</code> · <code>lista</code>\n' +
  '<code>eliminar 188</code> (te pido confirmar)\n' +
  'También: mandame un <b>link</b> o una <b>foto</b>.';

// ============================================================================
// SESSION CONTINUATION (confirmaciones / selección)
// ============================================================================
const sess = await getSession();
const state = sess.state || '';
const draft = parseDraft(sess);

async function handleConfirm() {
  const t = text.toLowerCase();

  if (state === 'crear_confirm') {
    if (/^(aprobar|sí|si|ok|confirmar|dale|crear)$/i.test(t)) {
      try {
        const r = await http('POST', API_P, draft.producto);
        await log('CREAR', r.id, draft.producto);
        await clearSession();
        return out('✅ Producto creado: <b>#' + r.id + '</b> ' + draft.producto.nombre + '\n💰 ' + fmt(draft.producto.precio) + ' Gs · stock ' + (draft.producto.stock || 0));
      } catch (e) {
        return out('❌ No pude crear: ' + e.message);
      }
    }
    if (/^(cancelar|no|abortar)$/i.test(t)) { await clearSession(); return out('❌ Creación cancelada.'); }
    await clearSession(); return null; // nueva intención: reprocesar
  }

  if (state === 'eliminar_confirm') {
    if (/^(confirmar|sí|si|ok|dale|eliminar|borrar)$/i.test(t)) {
      try {
        await http('DELETE', API_P + '/' + draft.id);
        await log('ELIMINAR', draft.id, { nombre: draft.nombre });
        await clearSession();
        return out('🗑️ Producto <b>#' + draft.id + '</b> (' + draft.nombre + ') eliminado.');
      } catch (e) {
        return out('❌ No pude eliminar: ' + e.message);
      }
    }
    if (/^(cancelar|no|abortar)$/i.test(t)) { await clearSession(); return out('❌ Eliminación cancelada.'); }
    await clearSession(); return null; // nueva intención: reprocesar
  }

  if (state === 'seleccion') {
    if (/^(cancelar|no|abortar)$/i.test(t)) { await clearSession(); return out('Cancelado.'); }
    // Si el usuario manda una ACCIÓN completa ("el 43 stock 1") y no solo un número,
    // anulamos la selección y reprocesamos como comando normal.
    if (/(stock|pon|public|ocult|desactiv|precio|proveedor|costo|elimin|borr|crear|nuevo|sum|rest)/i.test(t)) {
      await clearSession(); return null;
    }
    const n = nums(text);
    const pick = n.length ? n[0] : null;
    const cands = draft.candidatos || [];
    if (pick !== null && n.length === 1) {
      const sel = cands[pick - 1] || cands.find(c => c.id === pick) || cands.find(c => String(c.id) === String(pick));
      if (sel) {
        await clearSession();
        return executeAction({ accion: draft.accion, id: sel.id, modo: draft.modo, valor: draft.valor, campos: draft.campos }, sel);
      }
    }
    await clearSession(); return null; // nueva intención
  }

  // 'crear' parcial: falta un dato — seguimos recopilando
  if (state === 'crear_parcial') {
    return startCrear(draft, text, photo, link);
  }

  return null;
}

// ============================================================================
// EXECUTOR determinista (ejecuta la acción resuelta)
// ============================================================================
async function executeAction(a, sel) {
  const acc = a.accion;
  const id = a.id;
  const valor = a.valor;
  const campos = a.campos || {};
  const modo = a.modo || 'set';

  if (acc === 'consultar' || acc === 'aclarar' || acc === 'none') {
    const r = String(a.respuesta || '').trim();
    if (r.length > 250) return out(r.slice(0, 247) + '…');
    return out(r || '❓ No entendí. Probá "ayuda".');
  }

  // stock set / sumar / restar
  if (acc === 'ajustar_stock') {
    if (modo === 'sumar' || modo === 'restar') {
      const p = prods.find(x => x.id === id);
      if (!p) return out('❌ No encontré el producto #' + id + '.');
      const nuevo = modo === 'sumar' ? (Number(p.stock) + Number(valor)) : (Number(p.stock) - Number(valor));
      if (nuevo < 0) return out('❌ Stock quedaría negativo (' + nuevo + '). Producto #' + id + ' tiene ' + p.stock + '.');
      return doStock(id, nuevo, p);
    }
    if (valor < 0) return out('❌ El stock no puede ser negativo.');
    return doStock(id, valor, null);
  }

  if (acc === 'publicar' || acc === 'despublicar') {
    const p = prods.find(x => x.id === id);
    const actual = p ? !!p.activo : null;
    const quierePub = acc === 'publicar';
    if (actual !== null) {
      if (quierePub && actual) return out('ℹ️ <b>#' + id + '</b>' + (p ? ' (' + p.nombre + ')' : '') + ' ya está publicado.');
      if (!quierePub && !actual) return out('ℹ️ <b>#' + id + '</b>' + (p ? ' (' + p.nombre + ')' : '') + ' ya está oculto.');
    }
    try {
      const r = await http('PATCH', API_P + '/' + id + '/toggle');
      await log(acc, id, {});
      return out((r && r.activo ? '✅' : '⏸️') + ' Producto <b>#' + id + '</b> ahora está <b>' + (r && r.activo ? 'PUBLICADO' : 'OCULTO') + '</b>.');
    } catch (e) { return out('❌ No pude cambiar el estado: ' + e.message); }
  }

  if (acc === 'editar') {
    const p = prods.find(x => x.id === id);
    if (!p) return out('❌ No encontré el producto #' + id + '.');
    try {
      // PUT es full-overwrite: mandamos el producto completo con los campos cambiados.
      const body = Object.assign({}, p, campos);
      return await rPut(id, body, campos);
    } catch (e) { return out('❌ No pude editar: ' + e.message); }
  }

  if (acc === 'eliminar') {
    const p = prods.find(x => x.id === id);
    if (!p) return out('❌ No encontré el producto #' + id + '.');
    await setSession('eliminar_confirm', { id, nombre: p.nombre });
    return out('🗑️ Vas a eliminar <b>#' + id + '</b> (' + p.nombre + '). Respondé <b>CONFIRMAR</b> o <b>CANCELAR</b>.');
  }

  if (acc === 'crear') {
    return startCrear(campos, text, photo, link);
  }

  return out('❓ No entendí. Probá "ayuda".');
}

async function doStock(id, val, p) {
  try {
    await http('PATCH', API_P + '/stock-batch', { updates: [{ id, stock: val }] });
    await log('STOCK', id, { stock: val });
    return out('✅ #' + id + (p ? ' ' + p.nombre : '') + ' → stock <b>' + val + '</b>');
  } catch (e) { return out('❌ No pude: ' + e.message); }
}

// Editar: el backend PUT es full-overwrite; mandamos el objeto completo con campos cambiados.
async function rPut(id, full, cambios) {
  const r = await http('PUT', API_P + '/' + id, full);
  await log('EDITAR', id, cambios);
  const claves = Object.keys(cambios || {}).filter(k => cambios[k] !== undefined && cambios[k] !== null);
  const resumen = claves.length ? claves.map(k => k + '=' + cambios[k]).join(', ') : '';
  return out('✅ Producto <b>#' + id + '</b> editado.' + (resumen ? '\nCambios: ' + resumen : ''));
}

// ============================================================================
// CREAR (texto / link / foto) — recopila datos, genera ficha, pide APROBAR
// ============================================================================
async function startCrear(campos, textoMsg, photoMsg, linkMsg) {
  let d = Object.assign({}, campos || {});

  // link → scrape
  if (linkMsg && !d.nombre) {
    try {
      const s = await http('POST', BASE + '/scrape-product', { url: linkMsg });
      d.nombre = s.nombre;
      d.marca = s.marca || '';
      d.descripcion_corta = s.descripcion || '';
      d.descripcion_larga = s.descripcion_larga || '';
      d.seo_descripcion = s.seo_descripcion || '';
      d.sku = s.sku || '';
      d.imagen = s.imagen || '';
      d.galeria = Array.isArray(s.galeria) ? s.galeria : [];
      // Precio según moneda:
      //  - Extranjera (ej. R$ de sitios brasileños): es el PRECIO DE PROVEEDOR (costo interno),
      //    lo guardamos en precio_proveedor y NO lo usamos como precio de venta.
      //  - Guaraníes: es el precio de venta directamente.
      const esExtranjera = s.moneda && s.moneda !== 'PYG';
      if (s.precio) {
        if (esExtranjera) {
          d.precio_proveedor = s.precio;
          d.moneda_proveedor = s.moneda || '';
        } else {
          d.precio = s.precio;
        }
      }
      d._scrapeado = true;
    } catch (e) {
      // El link no se pudo scrapear (bloqueo, etc.). No abortamos: seguimos con
      // los datos que el usuario ya dio por texto y pedimos solo lo que falte.
      d._scrape_fallo = true;
    }
  }

  // foto → imagen principal
  if (photoMsg && !d.imagen) {
    d.imagen = await telegramFileUrl(photoMsg.file_id);
  }

  // datos del texto
  const t = textoMsg || '';

  // helper: entiende "85mil", "85 mil", "85k", "85.000", "16 reales" (ignora la unidad)
  function num(s) {
    if (s == null) return null;
    const m = String(s).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:mil|k\b)?/i);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (/\d\s*(?:mil|k\b)/i.test(String(s))) v *= 1000;
    return isNaN(v) ? null : v;
  }

  // precio de venta (Gs): "precio 85000" · "el precio es 85mil" · "85 mil"
  let pm = t.match(/\bprecio\s*(?:es|de|venta)?\s*[:\=]?\s*(\d+(?:[.,]\d+)?\s*(?:mil|k\b)?)/i);
  if (pm) d.precio = num(pm[1]);

  // stock: "stock 0" · "stock 10"
  const sm = t.match(/\bstock\s*[:\=]?\s*(\d+)/i);
  if (sm) d.stock = parseInt(sm[1]);

  // precio proveedor (interno, en R$): "proveedor 45" · "precio proovedor 16 reales" · "costo 45,50"
  // Tolerante a typos comunes: "proovedor" (doble o), "provedor", "fornecedor".
  let prM = t.match(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (prM) d.precio_proveedor = num(prM[1]);

  const mm = (t.match(/\bmarca\s*[:\=]?\s*([^,;]+?)(?=\s+(?:precio|stock|categoria|proveedor|costo)\b|$)/i) || [])[1];
  if (mm) d.marca = mm.trim();
  if (!d.nombre) {
    let n = t.replace(/^(?:crear|crea|nuevo|agregar|alta|cargar|subir)\s*(?:producto)?\s*[:\-]?\s*/i, '')
      .replace(/\bprecio\s*(?:es|de|venta)?\s*[:\=]?\s*\d+(?:[.,]\d+)?\s*(?:mil|k\b)?/i, ' ')
      .replace(/\bstock\s*[:\=]?\s*\d+/i, ' ')
      .replace(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*[\d.,]+\s*(?:reales?|reais?)?/i, ' ')
      .replace(/\bmarca\s*[:\=]?\s*[^,;]+/i, ' ').replace(/https?:\/\/[^\s]+/i, ' ')
      .replace(/[:=,;|]+/g, ' ');
    // quitar stopwords sobrantes ("el", "la", "es", etc.)
    n = n.split(/\s+/).filter(w => w && !/^(el|la|los|las|es|de|del|y|un|una|uno)$/i.test(w)).join(' ').trim();
    // Guard: si al "nombre" todavía le queda basura de precio/proveedor/moneda
    // (ej. un "proovedor" mal escrito que se escapó de la limpieza), no es un
    // nombre real → lo dejamos vacío para que continuarCrear pregunte el nombre.
    if (n && /\b(?:precio|proveedor|proovedor|provedor|fornecedor|costo|reales|reais)\b/i.test(n)) n = '';
    // si tras limpiar no quedó nada real, no lo usamos como nombre (se preguntará)
    if (n && n.length >= 2) d.nombre = n;
  }

  return continuarCrear(d, t, photoMsg, linkMsg);
}

async function continuarCrear(d, t, photoMsg, linkMsg) {
  // completar datos que faltan
  if (!d.nombre) {
    const nota = d._scrape_fallo ? 'El link no se pudo scrapear (sitio bloqueó el acceso).' : '';
    return preguntar('nombre', d, (nota ? nota + ' ' : '') + '¿Qué producto es? Decime el <b>nombre</b>.');
  }
  if (d.precio === null || d.precio === undefined) {
    const nota = (d.precio_proveedor !== undefined && d.precio_proveedor !== null)
      ? (' El costo proveedor es R$ ' + d.precio_proveedor + ' (eso lo guardo), pero el precio de venta en guaraníes lo ponés vos.')
      : '';
    return preguntar('precio', d, 'Falta el <b>precio de venta en guaraníes</b>. Escribí: <code>precio 60000</code>.' + nota);
  }
  if (d.stock === null || d.stock === undefined) { d.stock = 0; }

  // generar ficha (copy estandarizada) SIEMPRE, usando el scrape solo como contexto.
  try {
    const ficha = await generarFicha(d);
    d.descripcion_corta = ficha.descripcion_corta || d.descripcion_corta || '';
    d.descripcion_larga = ficha.descripcion_larga || d.descripcion_larga || '';
    d.seo_descripcion = ficha.meta_descripcion || d.seo_descripcion || '';
    d.meta_titulo = d.meta_titulo || ficha.meta_titulo || '';
    // Título con el formato "Nombre presentación - Marca" (si el LLM lo devolvió).
    if (ficha.titulo) d.nombre = ficha.titulo;
  } catch (e) { /* copia opcional */ }

  const producto = {
    nombre: d.nombre, precio: Number(d.precio), stock: Number(d.stock || 0),
    marca: d.marca || '', categoria: d.categoria || 'suplementos',
    descripcion: d.descripcion_corta || '', descripcion_larga: d.descripcion_larga || '',
    seo_descripcion: d.seo_descripcion || '', meta_titulo: d.meta_titulo || '',
    sku: d.sku || '', imagen: d.imagen || '',
    galeria: Array.isArray(d.galeria) ? d.galeria : []
  };
  if (d.precio_proveedor !== undefined && d.precio_proveedor !== null && d.precio_proveedor !== '') {
    producto.precio_proveedor = d.precio_proveedor;
  }

  await setSession('crear_confirm', { producto });

  let resumen = '🆕 <b>Producto a crear:</b>\n';
  resumen += 'Nombre: ' + producto.nombre + '\n';
  resumen += 'Precio venta: ' + fmt(producto.precio) + ' Gs\n';
  if (producto.precio_proveedor !== undefined) resumen += 'Proveedor: R$ ' + producto.precio_proveedor + '\n';
  resumen += 'Stock: ' + producto.stock + '\n';
  if (producto.marca) resumen += 'Marca: ' + producto.marca + '\n';
  if (producto.imagen) resumen += 'Imagen: ✅\n';
  if (producto.galeria.length) resumen += 'Galería: ' + producto.galeria.length + ' fotos\n';
  resumen += '\nRespondé <b>APROBAR</b> para crearlo, o <b>CANCELAR</b>.';
  return out(resumen);
}

function preguntar(campo, d, msg) {
  setSession('crear_parcial', d);
  return out('⚠️ ' + msg);
}

async function generarFicha(d) {
  const sys = [
    'Sos redactor de fichas de producto para Seiva, tienda de suplementos en Paraguay.',
    'Devolvé SOLO un JSON válido (sin texto fuera del JSON) con exactamente estas claves:',
    '{',
    '  "titulo": "{Nombre} {presentacion} - {Marca}",',
    '  "descripcion_corta": "Beneficios principales\\n⚡ ...\\n💪 ...\\n...",',
    '  "descripcion_larga": "<p>intro</p><h3>Ingredientes</h3><p>...</p><p>✅ Sin gluten.</p><h3>Modo de uso</h3><p>...</p><h3>Importante</h3><p>texto legal</p>",',
    '  "meta_titulo": "{Nombre} {presentacion} | {beneficio principal}",',
    '  "meta_descripcion": "{Nombre} con {ingredientes}. {beneficios}. Suplemento nutricional en Paraguay."',
    '}',
    '',
    'FORMATO EXACTO:',
    '',
    'titulo → "Nombre {presentacion} - Marca" (ej: "Colostro Bovino 500mg - 60 Cápsulas - V7 Energy"). Incluí presentación (mg/cápsulas/ml) si la sabés o la podés inferir del nombre.',
    '',
    'descripcion_corta → empieza con la línea "Beneficios principales" y luego UNA línea por beneficio, con emoji y punto final, máximo 5 beneficios. Ej:',
    '⚡ Apoya la energía y el metabolismo energético.',
    '💪 Contribuye al funcionamiento muscular.',
    '🏋️ Apoya la síntesis de proteínas.',
    '🛡️ Aporta acción antioxidante y ayuda a proteger las células frente al estrés oxidativo.',
    '',
    'descripcion_larga → en HTML, en este orden exacto:',
    '1) Párrafo introductorio: "{Nombre} es un suplemento nutricional formulado con {ingredientes principales}, nutrientes que {beneficios}. Ideal como apoyo nutricional para {público objetivo}."',
    '2) Encabezado "Ingredientes" + lista de componentes separados por comas (usá los que te doy como contexto si los tenés).',
    '3) "✅ Sin gluten." como línea propia.',
    '4) Encabezado "Modo de uso": "Consumir {N} cápsulas al día, preferentemente según las indicaciones de un médico o nutricionista." y "Indicado para mayores de {N} años."',
    '5) Encabezado "Importante": "Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz."',
    '',
    'meta_titulo → "Nombre {presentacion} | beneficio principal" (máx ~60 caracteres).',
    'meta_descripcion → "{Nombre} con {ingredientes}. {beneficios}. Suplemento nutricional en Paraguay." (máx 160 caracteres).',
    '',
    'REGLAS:',
    '- El bloque SEO (meta_titulo y meta_descripcion) NO va dentro de descripcion_larga; va aparte en sus claves.',
    '- Español, tono cercano, sin inventar datos clínicos ni cantidades concretas que no tengas. Usá los ingredientes/datos que te paso como contexto.',
    '- Si la marca no se conoce, omití "- Marca" en titulo y no inventes una.',
  ].join('\n');
  const user = 'Producto: ' + d.nombre + '\nMarca: ' + (d.marca || '(no especificada)') + '\nPrecio: ' + d.precio +
    (d.descripcion_larga ? '\n--- Contexto (ficha original/scrapeada, usala solo como fuente de ingredientes y datos reales) ---\n' + String(d.descripcion_larga).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200) : '') +
    (d.descripcion_corta ? '\nDescripción corta original: ' + String(d.descripcion_corta).slice(0, 300) : '');
  const raw = await llm(sys, user);
  const f = parseJSON(raw) || {};
  // El modelo a veces devuelve claves con typo o en plural; normalizamos a las canónicas.
  if (!f.meta_descripcion && f.meta_descriptions) f.meta_descripcion = f.meta_descriptions;
  if (!f.meta_titulo && f.meta_title) f.meta_titulo = f.meta_title;
  if (!f.descripcion_corta && f.descripcionCorta) f.descripcion_corta = f.descripcionCorta;
  if (!f.descripcion_larga && f.descripcionLarga) f.descripcion_larga = f.descripcionLarga;
  if (!f.titulo && f.title) f.titulo = f.title;
  return f;
}

async function telegramFileUrl(fileId) {
  try {
    const r = await _http({ method: 'POST', url: 'https://api.telegram.org/bot' + TG_TOKEN + '/getFile', json: true, body: { file_id: fileId } });
    if (r && r.ok && r.result && r.result.file_path) {
      return 'https://api.telegram.org/file/bot' + TG_TOKEN + '/' + r.result.file_path;
    }
  } catch (e) {}
  return '';
}

// Completa la galería de un producto EXISTENTE con las fotos scrapeadas de un link.
async function completarGaleria(id, linkMsg) {
  const p = prods.find(x => x.id === id);
  if (!p) return out('❌ No encontré el producto #' + id + '.');
  try {
    const s = await http('POST', BASE + '/scrape-product', { url: linkMsg });
    const nuevas = (Array.isArray(s.galeria) ? s.galeria : []).filter(Boolean);
    if (!nuevas.length) return out('⚠️ No pude extraer fotos de galería de ese link. Probá mandarme una foto directamente.');
    let actual = [];
    try { actual = Array.isArray(p.galeria) ? p.galeria : (JSON.parse(p.galeria || '[]') || []); } catch (e) { actual = []; }
    const merged = actual.concat(nuevas).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
    const body = Object.assign({}, p, { galeria: merged });
    delete body.price_tiers; delete body.marca_descuento;
    await http('PUT', API_P + '/' + id, body);
    await log('GALERIA', id, { agregadas: nuevas.length, total: merged.length });
    return out('🖼️ Agregué <b>' + nuevas.length + '</b> foto(s) a la galería de <b>#' + id + '</b> (' + p.nombre + '). Total: ' + merged.length + '.');
  } catch (e) {
    return out('❌ No pude completar la galería: ' + e.message);
  }
}

// ============================================================================
// MAIN
// ============================================================================
// 1) ¿Hay una sesión pendiente (confirmación/selección/crear parcial)?
const cont = await handleConfirm();
if (cont) return cont;

// 2) Link + referencia a producto EXISTENTE + pedido de galería/fotos → completar galería
if (link) {
  const idRef = T.match(/(?:producto|el|#|id)\s*(\d+)/i);
  const pideGaleria = /(galer[ií]a|fotos?|im[aá]genes?|faltaron)/i.test(T);
  if (idRef && pideGaleria) {
    const idP = Number(idRef[1]);
    if (prods.some(p => p.id === idP)) return completarGaleria(idP, link);
  }
}

// 2b) Foto o link sin otro comando → flujo de crear
if ((photo || link) && !/^(publicar|ocultar|eliminar|editar|stock|consultar|buscar|lista|precio)/i.test(T)) {
  return startCrear({}, text, photo, link);
}

// 3) Fast-path determinista (comandos comunes, sin gastar LLM)
if (/^\/start$|^\/debug$|^\/help$|^ayuda$|^help$|^menu$|^comandos?$/.test(T)) return out(HELP);

if (/^(lista|listar|listame|productos|inventario)$/.test(T) || /^(ver|mostrar)\s+(todo|productos|inventario)$/.test(T)) {
  if (!prods.length) return out('📦 No hay productos (o no pude leer el inventario).');
  const top = prods.slice(0, 40);
  let o = '📦 <b>Productos (' + top.length + ' de ' + prods.length + '):</b>\n';
  for (const p of top) o += (p.activo ? '✅' : '⏸️') + ' <b>#' + p.id + '</b> ' + p.nombre + '\n      💰 ' + fmt(p.precio) + ' Gs · stock: ' + p.stock + '\n';
  return out(o);
}

// stock bajo / sin stock
if (/(sin stock|stock bajo|agotado|que hay sin)/.test(T)) {
  const bajos = prods.filter(p => Number(p.stock) <= 5).sort((a, b) => a.stock - b.stock);
  if (!bajos.length) return out('✅ No hay productos con stock bajo (≤5).');
  let o = '⚠️ <b>Stock bajo / agotado:</b>\n';
  for (const p of bajos.slice(0, 15)) o += '🔴 <b>#' + p.id + '</b> ' + p.nombre + ' — stock <b>' + p.stock + '</b>\n';
  return out(o);
}

// buscar por texto: "busca X", "cuánto stock de X", "aceite de orégano"
if (/(busca|buscar|cu[aá]nto|stock de|ten[eé]s?|hay\b)/.test(T) && nums(T).length === 0) {
  const q = T.replace(/busca|buscar|cu[aá]nto|stock de|ten[eé]s|tienen|hay|de\b|la\b|el\b|me\b|los\b|las\b|producto\b|alg[uú]n\b/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && w.length >= 3 && !/^(que|como|para|del|una|uno|un|por|esto)$/.test(w));
  if (q.length) {
    const words = q;
    const hits = prods.filter(p => {
      const h = (p.nombre || '').toLowerCase();
      return words.some(w => h.includes(w));
    });
    if (!hits.length) return out('🔎 No encontré "' + words.join(' ') + '".');
    if (hits.length === 1) {
      const p = hits[0];
      return out('🔎 <b>#' + p.id + '</b> ' + p.nombre + '\n   ' + fmt(p.precio) + ' Gs · stock <b>' + p.stock + '</b>');
    }
    let o = '🔎 ' + hits.length + ' resultados:\n';
    for (const p of hits.slice(0, 8)) o += '<b>#' + p.id + '</b> ' + p.nombre + ' · stock ' + p.stock + '\n';
    return out(o);
  }
}

// crear (entrada determinista)
if (/^(crear|crea|nuevo producto|nuevo|agregar producto|agregar|alta|cargar producto|cargar|subir producto|subir)\b/.test(T)) {
  return startCrear({}, text, photo, link);
}

// eliminar (entrada determinista, con confirmación)
if (/(elimin|borr)/.test(T) && nums(T).length >= 1) {
  return executeAction({ accion: 'eliminar', id: nums(T)[0] });
}

// precio de venta (Gs): "precio 190 70000" | "cambiá el precio del 190 a 70000"
const pEdit = T.match(/\bprecio\b\D*?(\d+)\D+(\d+)/);
if (pEdit) return executeAction({ accion: 'editar', id: parseInt(pEdit[1]), campos: { precio: parseInt(pEdit[2]) } });

// precio proveedor (interno, en R$): "proveedor 188 45" | "costo 188 45,50"
const provEdit = T.match(/\b(?:proveedor|costo)\b\D*?(\d+)\D+(\d+(?:[.,]\d+)?)/);
if (provEdit) return executeAction({ accion: 'editar', id: parseInt(provEdit[1]), campos: { precio_proveedor: parseFloat(provEdit[2].replace(',', '.')) } });

// stock absoluto numérico (dos órdenes):
//   "stock 188 5" · "poné el 188 en 5" · "el 43 stock 1" · "el 3 stock 2"
const smAbs = T.match(/(?:\bstock\b|pon[eé]?|poner|dej[aá](?:r|me)?)\b[\s\S]*?(\d+)[^\d]+(\d+)/) ||
              T.match(/(?:el|producto|#)?\s*(\d+)\s*(?:stock|cantidad)\s*(?:en|a|=|:)?\s*(\d+)/i);
if (smAbs) {
  const idA = parseInt(smAbs[1]), valA = parseInt(smAbs[2]);
  return executeAction({ accion: 'ajustar_stock', id: idA, valor: valA, modo: 'set' });
}

// "sumá X al ID" / "restá X al ID" (por número)
const sDelta = T.match(/(sum|sub|agreg|aument)\w*\s*(\d+)\s*(?:al|a)\s*(?:el\s*)?(\d+)/);
if (sDelta) return executeAction({ accion: 'ajustar_stock', id: parseInt(sDelta[3]), valor: parseInt(sDelta[2]), modo: 'sumar' });
const rDelta = T.match(/(rest|quit|baj|sac|descont)\w*\s*(\d+)\s*(?:al|a|del)\s*(?:el\s*)?(\d+)/);
if (rDelta) return executeAction({ accion: 'ajustar_stock', id: parseInt(rDelta[3]), valor: parseInt(rDelta[2]), modo: 'restar' });

// publicar / ocultar numérico
const publ = T.match(/(public|activ|mostr)\w*\s*(?:el\s*|producto\s*)?(\d+)/);
if (publ) return executeAction({ accion: 'publicar', id: parseInt(publ[2]) });
const ocult = T.match(/(ocult|despublic|desactiv|inactiv|escond)\w*\s*(?:el\s*|producto\s*)?(\d+)/);
if (ocult) return executeAction({ accion: 'despublicar', id: parseInt(ocult[2]) });

// ============================================================================
// 4) Lenguaje natural por NOMBRE (determinista, SIN LLM → instantáneo)
//    "poné el colostro en 5" · "publicá el magnesio" · "precio del colostro a 90000"
// ============================================================================
const STOP = new Set(['el','la','los','las','un','una','uno','de','del','en','a','al','y','es','me','le','lo','que','cual','cuales','para','por','con','el']);

// quitar números, comandos y stopwords para aislar el "nombre" del producto
function extraerNombre(t) {
  return t
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:mil|k\b)?/g, ' ')
    .replace(/\b(stock|pon|poner|public|despublic|ocult|activ|inactiv|precio|proveedor|costo|sum|rest|sub|baj|busca|buscar|eliminar|borrar|cambiar|actualizar|cuanto|cantidad|cual|que)\w*\b/gi, ' ')
    .replace(/[^a-záéíóúñ\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w && w.length >= 3 && !STOP.has(w))
    .join(' ');
}

// devuelve matches por substring del nombre
function matchProds(frase) {
  const words = frase.split(/\s+/).filter(w => w.length >= 3);
  if (!words.length) return [];
  return prods.filter(p => {
    const h = (p.nombre || '').toLowerCase();
    return words.every(w => h.includes(w));
  });
}

// intenta resolver una acción por nombre (sin LLM)
function porNombre() {
  // extraer número de stock/precio del mensaje
  const valStock = T.match(/(?:stock|en|a)\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*(?:mil|k\b)?)/i);
  const valPrecio = T.match(/\bprecio\s*(?:a|de|es)?\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*(?:mil|k\b)?)/i);
  const nombre = extraerNombre(T);
  if (!nombre) return null;

  const matches = matchProds(nombre);

  // intención
  let accion = null, valor = null;
  if (/pon|stock|dej|cambiar/.test(T)) { accion = 'ajustar_stock'; valor = valStock; }
  else if (/public|activ|mostr/.test(T)) { accion = 'publicar'; }
  else if (/ocult|despublic|desactiv|inactiv|escond/.test(T)) { accion = 'despublicar'; }
  else if (/precio/.test(T)) { accion = 'editar'; valor = valPrecio; }
  if (!accion) return null;

  if (matches.length === 0) return out('🔎 No encontré "<b>' + nombre + '</b>". Probá "busca ' + nombre.split(' ')[0] + '" o "lista".');
  if (matches.length === 1) {
    const p = matches[0];
    if (accion === 'ajustar_stock') {
      if (!valor) return out('¿A cuánto pongo el stock de #' + p.id + '? Decime "stock ' + p.id + ' N".');
      const v = parseInt(valor[1].replace(',', '.').replace(/(mil|k)/i, '000'), 10);
      return executeAction({ accion: 'ajustar_stock', id: p.id, valor: v, modo: 'set' });
    }
    if (accion === 'editar') {
      if (!valor) return out('¿A cuánto el precio de #' + p.id + '? Decime "precio ' + p.id + ' N".');
      const v = parseInt(valor[1].replace(',', '.').replace(/(mil|k)/i, '000'), 10);
      return executeAction({ accion: 'editar', id: p.id, campos: { precio: v } });
    }
    return executeAction({ accion, id: p.id });
  }
  // varios: listar candidatos para que elija
  let o = 'Hay ' + matches.length + ' con "<b>' + nombre + '</b>":\n';
  matches.slice(0, 8).forEach(p => { o += '<b>#' + p.id + '</b> ' + p.nombre + ' · stock ' + p.stock + '\n'; });
  o += '\nDecime el ID (ej "stock 43 1").';
  return out(o);
}

const rn = porNombre();
if (rn) return rn;

return out('❓ No entendí. Probá "ayuda".');
