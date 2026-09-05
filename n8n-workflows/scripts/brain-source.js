// ============================================================================
// SEIVA — Bot de inventario (Cerebro). Un único nodo Code, UNA salida.
// El LLM SOLO interpreta lenguaje natural y devuelve JSON. El Cerebro ejecuta
// de forma determinista y confirma SIEMPRE con el resultado real del backend.
//
// El script se ejecuta dentro de una IIFE para evitar `return` top-level,
// que rompe el syntax-check de motores tipo V8/Node y asusta a n8n en cache.
// ============================================================================

return await (async () => {

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
// Convierte HTML de descripciones a texto seguro para Telegram. El parse_mode
// HTML de Telegram NO soporta <br> (ni <p>/<ul>/<li>), así que acá pasamos
// <br> → \n y limpiamos el resto de tags. La BD guarda <br> para la web.
const tgSafe = s => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<li[^>]*>/gi, '\n• ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

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
  // La OR_KEY se inyecta en build-time en `const OR_KEY` (arriba), desde n8n.txt.
  // NOTA: antes se redeclaraba `let OR_KEY = ''` acá, lo que SOMBREADA la
  // constante inyectada y hacía que el LLM fallara SIEMPRE con "OR_KEY no
  // configurada" → descripciones genéricas. Usamos `key` para no sombrear.
  let key = OR_KEY;
  try { if ($secrets && $secrets.OR_KEY) key = $secrets.OR_KEY; } catch (e) {}
  if (!key) {
    try {
      const st = $getWorkflowStaticData('global');
      if (st && st.OR_KEY) key = st.OR_KEY;
    } catch (e) {}
  }
  if (!key && typeof process !== 'undefined' && process.env && process.env.OR_KEY) key = process.env.OR_KEY;
  if (!key) throw new Error('OR_KEY no configurada');
  const r = await _http({
    method: 'POST', url: OR_URL,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
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
  return r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : '';
}
function parseJSON(s) {
  s = String(s || '').trim();
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  const i = s.indexOf('{'), f = s.lastIndexOf('}');
  if (i >= 0 && f > i) { try { return JSON.parse(s.slice(i, f + 1)); } catch (e) { return null; } }
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ---- Log de cambios: tabla audit_log del backend ----
async function log(accion, id, detalle) {
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
    // Normalizar: quitar puntuación (ej "si}" → "si") para ser tolerante a typos.
    const tn = t.replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    // Si mandó un LINK o una FOTO (producto nuevo) estando en confirmación,
    // soltamos la confirmación vieja y lo procesamos como creación nueva.
    if (link || photo) {
      await clearSession();
      return null;
    }
    if (/^(aprobar|aprobado|confirmo|confirmar|sí|si|sip|dale|ok|crear|va|vamos|yes|claro)$/i.test(tn)) {
      try {
        // Diagnóstico: ver QUÉ se va a enviar al backend.
        const prod = draft.producto || {};
        console.log('[SEIVA-CREAR][APROBAR] nombre=' + prod.nombre + ' keys=' + Object.keys(prod).join(',') + ' desc=' + (prod.descripcion ? prod.descripcion.length + ' chars [' + prod.descripcion.slice(0, 50) + '...]' : 'VACIO') + ' desc_larga=' + (prod.descripcion_larga ? prod.descripcion_larga.length + ' chars' : 'VACIO') + ' seo=' + (prod.seo_descripcion ? prod.seo_descripcion.length + ' chars' : 'VACIO') + ' meta=' + (prod.meta_titulo ? prod.meta_titulo.length + ' chars' : 'VACIO'));
        const r = await http('POST', API_P, prod);
        console.log('[SEIVA-CREAR][APROBAR] respuesta POST: status=200 id=' + (r && r.id));
        await log('CREAR', r.id, prod);
        await clearSession();
        return out('✅ Producto creado: <b>#' + r.id + '</b> ' + prod.nombre + '\n💰 ' + fmt(prod.precio) + ' Gs · stock ' + (prod.stock || 0));
      } catch (e) {
        console.log('[SEIVA-CREAR][APROBAR][ERROR] ' + e.message);
        return out('❌ No pude crear: ' + e.message);
      }
    }
    if (/^(cancelar|cancela|no|abortar|salir|descartar)$/i.test(tn)) { await clearSession(); return out('❌ Creación cancelada.'); }
    // Edición de campos en el preview: "nombre: X" · "precio: X" · "marca: X" · "stock: X".
    const edNombre = t.match(/\bnombre\s*[:\=]\s*(.+?)(?=\s+(?:precio|stock|categoria|proveedor|costo|marca)\b|$)/i);
    const edPrecio = t.match(/\bprecio\s*(?:de\s*venta)?\s*[:\=]?\s*(\d+(?:[.,]\d+)?\s*(?:mil|k\b)?)/i);
    const edMarca = t.match(/\bmarca\s*[:\=]\s*(.+?)(?=\s+(?:precio|stock|categoria|proveedor|costo|nombre)\b|$)/i);
    const edStock = t.match(/\bstock\s*[:\=]?\s*(\d+)/i);
    if (edNombre || edPrecio || edMarca || edStock) {
      const p = Object.assign({}, draft.producto || {});
      const cambios = [];
      if (edNombre) { p.nombre = edNombre[1].trim(); cambios.push('nombre → ' + p.nombre); }
      if (edPrecio) {
        let v = parseFloat(String(edPrecio[1]).replace(',', '.'));
        if (/\d\s*(?:mil|k\b)/i.test(edPrecio[1])) v *= 1000;
        if (!isNaN(v)) { p.precio = v; cambios.push('precio → ' + fmt(v) + ' Gs'); }
      }
      if (edMarca) { p.marca = edMarca[1].trim(); cambios.push('marca → ' + p.marca); }
      if (edStock) { p.stock = parseInt(edStock[1]); cambios.push('stock → ' + p.stock); }
      await setSession('crear_confirm', { producto: p });
      return out('✅ Actualizado:\n' + cambios.map(c => '• ' + c).join('\n') + '\n\n¿Algo más? Escribí <code>nombre: X</code>, <code>precio: X</code>, <code>marca: X</code> o <code>stock: X</code>. Si está bien: <b>APROBAR</b>. Para descartar: <b>CANCELAR</b>.');
    }
    // Si mandó un comando nuevo (lista, stock, etc.), soltamos la confirmación y reprocesamos.
    if (/(\blista\b|\blistar\b|\bstock\b|\bbusca\b|\bbuscar\b|\bprecio\b|\belimin\b|\bnuevo\b|\bpublic\b|\bocult\b|\bayuda\b|\bhelp\b|\bmenu\b)/i.test(t)) {
      await clearSession(); return null;
    }
    // Typo o texto no reconocido: NO perdemos la sesión; recordamos qué responder.
    return out('🤔 No entendí. Respondé <b>APROBAR</b> para crearlo, o <b>CANCELAR</b> para descartarlo.');
  }

  if (state === 'eliminar_confirm') {
    const tn = t.replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (/^(confirmar|confirmo|sí|si|sip|ok|dale|eliminar|elimina|borrar|borra|yes)$/i.test(tn)) {
      try {
        await http('DELETE', API_P + '/' + draft.id);
        await log('ELIMINAR', draft.id, { nombre: draft.nombre });
        await clearSession();
        return out('🗑️ Producto <b>#' + draft.id + '</b> (' + draft.nombre + ') eliminado.');
      } catch (e) {
        return out('❌ No pude eliminar: ' + e.message);
      }
    }
    if (/^(cancelar|cancela|no|abortar|salir)$/i.test(tn)) { await clearSession(); return out('❌ Eliminación cancelada.'); }
    if (/(\blista\b|\blistar\b|\bstock\b|\bbusca\b|\bbuscar\b|\bprecio\b|\bcrear\b|\bnuevo\b|\bpublic\b|\bocult\b|\bayuda\b|\bhelp\b|\bmenu\b)/i.test(t)) {
      await clearSession(); return null;
    }
    return out('🤔 No entendí. Respondé <b>CONFIRMAR</b> para eliminar, o <b>CANCELAR</b>.');
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

  // Detecta si el link es una IMAGEN directa (jpg/png/webp/...) en vez de una
  // página de producto. Si es imagen, NO scrapeamos: usamos el link como imagen.
  const esImagen = /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic)([?#].*)?$/i.test(linkMsg || '');

  // link → scrape (solo si NO es una imagen directa)
  if (linkMsg && !d.nombre && !esImagen) {
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

  // imagen directa por URL (el usuario pasó un link a una foto, no a un producto)
  if (linkMsg && esImagen && !d.imagen) {
    d.imagen = linkMsg;
  }

  // foto → imagen principal (la primera) o galería (las siguientes)
  if (photoMsg) {
    const furl = await telegramFileUrl(photoMsg.file_id);
    if (furl) {
      if (!d.imagen) {
        d.imagen = furl;
      } else if (d.imagen !== furl) {
        d.galeria = Array.isArray(d.galeria) ? d.galeria : [];
        if (d.galeria.indexOf(furl) === -1) d.galeria.push(furl);
      }
    }
  }

  // datos del texto
  const t = textoMsg || '';

  // "sin marca" / "no tiene marca" → marca vacía (no re-preguntar)
  if (/(sin marca|no tiene marca|sinmarca|sin\s+marca|ninguna marca)/i.test(t)) d._marca_ok = true;
  // "listo" / "ya" / "no más fotos" → terminar la galería
  if (/^(listo|ya|ya esta|ya está|ok|finito|no mas|no más|no tengo mas|no tengo más)$/i.test(t.trim()) || /(no mas fotos|no más fotos|sin mas fotos|sin más fotos|ya no mas|ya no más|terminado)/i.test(t)) d._fotos_ok = true;

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
  // "80 reales" / "80 reais" (sin keyword "proveedor") → precio proveedor en R$.
  if (d.precio_proveedor === undefined) {
    const re = t.match(/(\d+(?:[.,]\d+)?)\s*(?:reales?|reais?)\b/i);
    if (re) d.precio_proveedor = num(re[1]);
  }

  let mm = (t.match(/\b(?:marca|brand)\s*(?:de\s+|es\s+)?[:\=]?\s*([^,;]+?)(?=\s+(?:precio|stock|categoria|proveedor|costo)\b|$)/i) || [])[1];
  if (mm) d.marca = mm.trim();
  // nombre explícito: "nombre: X" o "nombre X". Sobrescribe el nombre scrapeado
  // (que a veces da genérico como "Suplemento Nutricional").
  let nmEx = (t.match(/\bnombre\s*[:\=]\s*(.+?)(?=\s+(?:precio|stock|categoria|proveedor|costo|marca)\b|$)/i) || [])[1];
  if (nmEx) {
    nmEx = nmEx.replace(/https?:\/\/[^\s]+/gi, ' ').replace(/[:=,;|]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (nmEx && nmEx.length >= 2) d.nombre = nmEx;
  }
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

  // Si no se capturó marca explícita ("marca X"), intentamos extraerla del final
  // del nombre: "... - Unilife" o "... Unilife". Solo si el sufijo NO tiene dígitos
  // (para no agarrar "60 Cápsulas" ni "500mg" como marca).
  if (!d.marca && d.nombre) {
    const nm = d.nombre.match(/^(.*?)\s*[-–]\s*([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)$/);
    if (nm) {
      const posibleMarca = nm[2].trim();
      if (posibleMarca && !/\d/.test(posibleMarca) && posibleMarca.length >= 2 && posibleMarca.length <= 20) {
        d.marca = posibleMarca;
        d.nombre = nm[1].trim();
      }
    }
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
  if (!d.marca && !d._marca_ok) {
    return preguntar('marca', d, '¿Qué <b>marca</b> es? Escribí <code>marca Unilife</code>, o <code>sin marca</code> si no tiene.');
  }
  if (d.imagen && !d._fotos_ok) {
    return preguntar('fotos', d, '¿Tenés <b>más fotos</b> para la galería? Mandalas (una por mensaje) o escribí <code>listo</code>.');
  }
  if (d.stock === null || d.stock === undefined) { d.stock = 0; }

  // generar ficha (copy estandarizada) SIEMPRE, usando el scrape solo como contexto.
  // Si la IA falla, asignamos un fallback a d.* directamente para no quedarnos con descripciones malas.
  try {
    const ficha = await generarFicha(d);
    d.descripcion_corta = ficha.descripcion_corta || d.descripcion_corta || '';
    d.descripcion_larga = ficha.descripcion_larga || d.descripcion_larga || '';
    d.seo_descripcion = ficha.meta_descripcion || d.seo_descripcion || '';
    d.meta_titulo = d.meta_titulo || ficha.meta_titulo || '';
    // Título con el formato "Nombre presentación - Marca" (si el LLM lo devolvió).
    if (ficha.titulo) d.nombre = ficha.titulo;
    // Diagnóstico: logueamos qué entró y qué salió del LLM (solo para ver en consola n8n).
    console.log('[SEIVA-FICHA] nombre=' + (d.nombre || '?') + ' marca=' + (d.marca || '?') + ' corta=' + (d.descripcion_corta ? d.descripcion_corta.length + ' chars [' + d.descripcion_corta.slice(0, 60) + '...]' : 'VACIO') + ' larga=' + (d.descripcion_larga ? d.descripcion_larga.length + ' chars' : 'VACIO'));
  } catch (e) {
    console.log('[SEIVA-FICHA][ERROR] ' + (e && e.message ? e.message : String(e)) + ' → uso ficha específica / fallback.');
    // 1) Si hay plantilla específica para ESTE producto, la uso (mejor que genérica).
    let fichaPlantilla = null;
    try { fichaPlantilla = fichaEspecifica(d.nombre, d.marca); } catch (e2) {}
    if (fichaPlantilla) {
      console.log('[SEIVA-FICHA][ERROR] uso ficha específica para "' + d.nombre + '"');
      if (!d.descripcion_corta) d.descripcion_corta = fichaPlantilla.descripcion_corta;
      if (!d.descripcion_larga) d.descripcion_larga = fichaPlantilla.descripcion_larga;
      if (!d.meta_titulo) d.meta_titulo = fichaPlantilla.meta_titulo;
      if (!d.meta_descripcion) d.meta_descripcion = fichaPlantilla.meta_descripcion;
      if (!d.seo_descripcion) d.seo_descripcion = fichaPlantilla.meta_descripcion;
    } else {
      // 2) Fallback explícito: si la IA no responde nada útil y no hay plantilla,
      // garantizamos que el producto tenga descripción.
      if (!d.descripcion_corta) {
        d.descripcion_corta = 'Beneficios principales<br>⚡ Suplemento nutricional formulado con ingredientes de calidad.<br>💪 Aporta nutrientes esenciales para el día a día.<br>🔬 Calidad garantizada por ' + (d.marca || 'Seiva') + '.<br>✅ Sin gluten.';
      }
      if (!d.descripcion_larga) {
        const nombre = d.nombre || 'Este producto';
        const marcaTag = d.marca ? ' Marca ' + d.marca + '.' : '';
        d.descripcion_larga = '<p>' + nombre + ' es un suplemento nutricional formulado con ingredientes de calidad.' + marcaTag + ' Ideal como apoyo nutricional para adultos mayores de 18 años.</p>\n\n<h3>Ingredientes</h3>\n<p>Ingredientes seleccionados de calidad.</p>\n<p>✅ Sin gluten.</p>\n\n<h3>Modo de uso</h3>\n<p>Consumir según las indicaciones del envase o de un médico o nutricionista.</p>\n<p>Indicado para mayores de 18 años.</p>\n\n<h3>Importante</h3>\n<p>Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz.</p>';
      }
      if (!d.seo_descripcion) d.seo_descripcion = (d.nombre || 'Producto') + ' es un suplemento nutricional formulado con ingredientes de calidad, ideal como apoyo nutricional.';
      // meta_titulo / meta_descripcion (bug fix: el catch no las llenaba y quedaba "" en BD)
      if (!d.meta_titulo) d.meta_titulo = (d.nombre || 'Producto') + (d.marca ? ' - ' + d.marca : '') + ' | Seiva Paraguay';
      if (!d.meta_descripcion) d.meta_descripcion = (d.nombre || 'Producto') + ' - suplemento nutricional formulado con ingredientes de calidad.';
    }
  }

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
  // Diagnóstico: ver qué se guardaró en sesión (con descripciones).
  console.log('[SEIVA-CREAR] sesionOK corta=' + (producto.descripcion ? producto.descripcion.length + ' chars' : 'VACIO') + ' larga=' + (producto.descripcion_larga ? producto.descripcion_larga.length + ' chars' : 'VACIO'));

  let resumen = '🆕 <b>Producto a crear:</b>\n';
  resumen += 'Nombre: ' + producto.nombre + '\n';
  resumen += 'Precio venta: ' + fmt(producto.precio) + ' Gs\n';
  if (producto.precio_proveedor !== undefined) resumen += 'Proveedor: R$ ' + producto.precio_proveedor + '\n';
  resumen += 'Stock: ' + producto.stock + '\n';
  if (producto.marca) resumen += 'Marca: ' + producto.marca + '\n';
  if (producto.imagen) resumen += 'Imagen: ✅\n';
  if (producto.galeria.length) resumen += 'Galería: ' + producto.galeria.length + ' fotos\n';
  // Descripción corta (preview): si está vacía, avisamos en lugar de mostrar vacío.
  if (producto.descripcion) {
    const descTg = tgSafe(producto.descripcion);
    resumen += '\n📝 <b>Descripción corta:</b>\n' + descTg.slice(0, 250) + (descTg.length > 250 ? '…' : '') + '\n';
  }
  if (producto.descripcion_larga) {
    const larga = String(producto.descripcion_larga).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    resumen += '\n📄 <b>Descripción larga (preview):</b> ' + larga + '…\n';
  }
  resumen += '\n¿Querés cambiar algo? Escribí <code>nombre: X</code>, <code>precio: X</code>, <code>marca: X</code> o <code>stock: X</code>.\nSi está bien: <b>APROBAR</b>. Para descartar: <b>CANCELAR</b>.';
  return out(resumen);
}

function preguntar(campo, d, msg) {
  setSession('crear_parcial', d);
  return out('⚠️ ' + msg);
}

// ============================================================================
// PLANTILLAS ESPECÍFICAS POR TIPO DE PRODUCTO (inlineadas de _fichas_db.js).
// n8n Code node no permite require(), así que van directo acá.
// ============================================================================
const FICHAS = [
  {
    match: [/magnesio|magnesios|magnes\b/i],
    beneficios_cortos: [
      '⚡ Apoya la función muscular y reduce calambres.',
      '💪 Contribuye a huesos y dientes fuertes.',
      '😌 Favorece la relajación y un mejor descanso.',
      '❤️ Apoya el ritmo cardíaco y el sistema nervioso.',
      '🏋️ Favorece el rendimiento físico y la recuperación.'
    ],
    intro: 'Magnesio en alta biodisponibilidad, ideal para cubrir necesidades diarias y acompañar la rutina de entrenamiento, trabajo o estudio.',
    ingredientes: 'Bisglicinato/citrato/treonato de magnesio (según el producto), agentes de carga (celulosa microcristalina), cápsula de gelatina vegetal.',
    uso: 'Consumir 2 cápsulas al día, preferentemente con las comidas.',
    publico: 'adultos mayores de 18 años que buscan apoyo para músculos, sistema nervioso y descanso',
    meta_beneficio: 'músculos, descanso y energía'
  },
  {
    match: [/vitamina\s*c|vit\s*c/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '✨ Contribuye a la producción natural de colágeno.',
      '💪 Mejora la absorción del hierro de los alimentos.',
      '🧬 Potente antioxidante que protege las células.',
      '⚡ Apoya la energía y reduce el cansancio.'
    ],
    intro: 'Vitamina C esencial para defensas, piel y energía. Aporta el soporte diario que el cuerpo necesita para funcionar al máximo.',
    ingredientes: 'Ácido ascórbico (vitamina C), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan reforzar defensas y cuidar la piel',
    meta_beneficio: 'defensas, piel y energía'
  },
  {
    match: [/col[aá]geno/i],
    beneficios_cortos: [
      '✨ Mejora la elasticidad y firmeza de la piel.',
      '💅 Fortalece cabello y uñas.',
      '🦴 Apoya la salud de articulaciones y cartílagos.',
      '🧬 Contribuye a la regeneración natural del colágeno.',
      '⚡ Favorece la recuperación después del ejercicio.'
    ],
    intro: 'Colágeno hidrolizado de alta absorción para apoyar la piel, las articulaciones y la vitalidad desde adentro.',
    ingredientes: 'Colágeno hidrolizado, vitamina C (para mejorar la absorción), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con un vaso de agua, idealmente en ayunas.',
    publico: 'adultos mayores de 25 años preocupados por piel, cabello y articulaciones',
    meta_beneficio: 'piel, articulaciones y vitalidad'
  },
  {
    match: [/omega\s*3|omega\s*3-6-9/i],
    beneficios_cortos: [
      '❤️ Apoya la salud cardiovascular.',
      '🧠 Mejora la función cerebral y la memoria.',
      '🛡️ Reduce la inflamación en el cuerpo.',
      '✨ Beneficia la piel y el cabello.',
      '💪 Mantiene niveles saludables de triglicéridos.'
    ],
    intro: 'Omega 3 de calidad para cuidar el corazón, el cerebro y mantener una inflamación saludable.',
    ingredientes: 'Aceite de pescado rico en EPA y DHA (o fuente vegetal para veganos), cápsula de gelatina.',
    uso: 'Consumir 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan cuidar corazón, cerebro y piel',
    meta_beneficio: 'corazón, cerebro y piel'
  },
  {
    match: [/vitamina\s*d|vit\s*d|colecalciferol|d3/i],
    beneficios_cortos: [
      '🦴 Promueve la absorción de calcio para huesos fuertes.',
      '🛡️ Fortalece el sistema inmunológico.',
      '❤️ Apoya la salud cardiovascular y muscular.',
      '⚙️ Contribuye al metabolismo normal del calcio.',
      '🧠 Apoya la función muscular y mental.'
    ],
    intro: 'Vitamina D3 esencial para huesos, defensas y energía. Especialmente útil en climas donde la exposición solar es limitada.',
    ingredientes: 'Colecalciferol (vitamina D3), aceite portador (generalmente oliva o coco), cápsula de gelatina.',
    uso: 'Consumir 1 cápsula al día, preferentemente con una comida grasa para mejor absorción.',
    publico: 'adultos mayores de 18 años con baja exposición solar',
    meta_beneficio: 'huesos, defensas y energía'
  },
  {
    match: [/ashwagandha/i],
    beneficios_cortos: [
      '😌 Reduce el estrés y la ansiedad del día a día.',
      '😴 Mejora la calidad del sueño.',
      '⚡ Aumenta la energía y resistencia física.',
      '⚖️ Equilibra los niveles hormonales naturalmente.',
      '🧠 Apoya la claridad mental y la concentración.'
    ],
    intro: 'Ashwagandha, una de las plantas más estudiadas de la Ayurveda, ideal para manejar el estrés y recuperar energía.',
    ingredientes: 'Extracto de raíz de Ashwagandha (Withania somnifera), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con el desayuno o la cena.',
    publico: 'adultos mayores de 18 años bajo estrés o con cansancio persistente',
    meta_beneficio: 'estrés, energía y descanso'
  },
  {
    match: [/probio|intestinal|flora/i],
    beneficios_cortos: [
      '⚖️ Equilibra la flora intestinal.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🍽️ Mejora la digestión y reduce la hinchazón.',
      '💪 Favorece la absorción de nutrientes.',
      '🌿 Apoya la salud intestinal a largo plazo.'
    ],
    intro: 'Probióticos de alta potencia para restablecer y mantener una flora intestinal saludable.',
    ingredientes: 'Mezcla de cepas probióticas (Lactobacillus, Bifidobacterium), cápsula vegetal gastrorresistente.',
    uso: 'Consumir 1 cápsula al día en ayunas o antes de dormir.',
    publico: 'adultos mayores de 18 años con problemas digestivos o que tomaron antibióticos',
    meta_beneficio: 'digestión, defensas y flora'
  },
  {
    match: [/vitamina\s*b|complejo\s*b|tiamina|riboflavina|niacina|b12/i],
    beneficios_cortos: [
      '⚡ Apoya el metabolismo energético y reduce el cansancio.',
      '🧠 Contribuye al funcionamiento del sistema nervioso.',
      '❤️ Favorece la salud cardiovascular.',
      '✨ Mejora la piel, el cabello y las uñas.',
      '😌 Apoya el equilibrio emocional y reduce el estrés.'
    ],
    intro: 'Vitaminas del grupo B para transformar los alimentos en energía y cuidar el sistema nervioso.',
    ingredientes: 'Complejo B (B1, B2, B3, B5, B6, B7, B9, B12), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años con cansancio o estrés',
    meta_beneficio: 'energía, nervios y metabolismo'
  },
  {
    match: [/c[uú]rcuma|curcumina/i],
    beneficios_cortos: [
      '🛡️ Potente antiinflamatorio y antioxidante natural.',
      '🦴 Alivia molestias articulares y musculares.',
      '🍽️ Favorece la digestión y la función hepática.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Protege las células del estrés oxidativo.'
    ],
    intro: 'Cúrcuma con pimienta negra para una absorción hasta 20 veces mayor, una de las especias más estudiadas por sus beneficios.',
    ingredientes: 'Extracto de cúrcuma (95% curcuminoides), pimienta negra (piperina), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años con inflamación o molestias articulares',
    meta_beneficio: 'inflamación y articulaciones'
  },
  {
    match: [/calostro/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '💪 Favorece el crecimiento y la recuperación muscular.',
      '🍽️ Apoya la salud intestinal y la digestión.',
      '♻️ Contribuye a la reparación celular.',
      '⚡ Mejora el bienestar general y la vitalidad.'
    ],
    intro: 'Calostro bovino, el primer alimento de la naturaleza, rico en anticuerpos y factores de crecimiento.',
    ingredientes: 'Calostro bovino liofilizado, cápsula de gelatina.',
    uso: 'Consumir 2 cápsulas al día en ayunas.',
    publico: 'adultos mayores de 18 años que buscan reforzar defensas y recuperación',
    meta_beneficio: 'defensas y recuperación'
  },
  {
    match: [/ginkgo|ginko/i],
    beneficios_cortos: [
      '🧠 Mejora la memoria y la concentración.',
      '🩸 Estimula la circulación sanguínea.',
      '⚡ Potencia el rendimiento físico y mental.',
      '😌 Reduce el estrés y la fatiga.',
      '🛡️ Protege las células del daño oxidativo.'
    ],
    intro: 'Ginkgo Biloba, una de las plantas más antiguas del mundo, aliada de la claridad mental y la circulación.',
    ingredientes: 'Extracto de hojas de Ginkgo Biloba (24% flavonoids, 6% lactonas), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan foco y circulación',
    meta_beneficio: 'memoria y circulación'
  },
  {
    match: [/berberina/i],
    beneficios_cortos: [
      '🩸 Ayuda a regular los niveles de azúcar en sangre.',
      '❤️ Apoya la salud cardiovascular y el colesterol.',
      '⚖️ Contribuye al control del peso y el metabolismo.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🌿 Favorece la salud digestiva.'
    ],
    intro: 'Berberina, un alcaloide natural extraído de plantas, conocida por su efecto sobre el metabolismo y la glucosa.',
    ingredientes: 'Clorhidrato de berberina, cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día, una antes del almuerzo y otra antes de la cena.',
    publico: 'adultos mayores de 18 años que buscan regular el azúcar y el colesterol',
    meta_beneficio: 'azúcar, colesterol y metabolismo'
  },
  {
    match: [/resveratrol/i],
    beneficios_cortos: [
      '🛡️ Potente acción antioxidante contra el envejecimiento celular.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Promueve la longevidad celular.',
      '🧠 Favorece la salud cerebral y la función cognitiva.',
      '🩸 Mantiene niveles saludables de glucosa en sangre.'
    ],
    intro: 'Resveratrol, el antioxidante del vino tinto y la uva, para cuidar la salud cardiovascular y el envejecimiento.',
    ingredientes: 'Trans-Resveratrol (de Polygonum cuspidatum o uva), cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con una comida.',
    publico: 'adultos mayores de 18 años que buscan antioxidantes y salud cardiovascular',
    meta_beneficio: 'antioxidante y longevidad'
  },
  {
    match: [/creatina/i],
    beneficios_cortos: [
      '💪 Aumenta la fuerza y potencia muscular.',
      '🏋️ Mejora el rendimiento físico y la resistencia.',
      '♻️ Acelera la recuperación después del entrenamiento.',
      '🧠 Apoya la función cerebral bajo esfuerzo.',
      '✓ Recomendada por estudios científicos como segura y efectiva.'
    ],
    intro: 'Creatina monohidrato, el suplemento deportivo más estudiado del mundo, ideal para fuerza y rendimiento.',
    ingredientes: 'Creatina monohidrato micronizada (200 mesh).',
    uso: 'Consumir 3 a 5 g al día, preferentemente después del entrenamiento.',
    publico: 'adultos mayores de 18 años que entrenan fuerza o quieren mejorar rendimiento',
    meta_beneficio: 'fuerza y rendimiento'
  },
  {
    match: [/tongkat|tongkat\s*ali|eurycoma|shilajit/i],
    beneficios_cortos: [
      '⚡ Aumenta la energía y la vitalidad.',
      '💪 Favorece la fuerza muscular y la resistencia.',
      '⚖️ Equilibra las hormonas masculinas naturalmente.',
      '🧠 Apoya la concentración y el enfoque mental.',
      '❤️ Contribuye a la salud sexual y la libido.'
    ],
    intro: 'Tongkat Ali, una raíz tradicionalmente usada en Asia para mejorar energía, vitalidad y rendimiento físico.',
    ingredientes: 'Extracto de raíz de Eurycoma longifolia (100:1), cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan energía y vitalidad',
    meta_beneficio: 'energía, fuerza y vitalidad'
  },
  {
    match: [/nac|n[-\s]?acetilciste[ií]na/i],
    beneficios_cortos: [
      '🫁 Apoya la salud respiratoria y descongestiona.',
      '🛡️ Refuerza el sistema inmunológico.',
      '🧬 Aumenta los niveles de glutatión, antioxidante maestro.',
      '🍽️ Apoya la detoxificación del hígado.',
      '🧠 Protege la salud cerebral y cognitiva.'
    ],
    intro: 'NAC (N-Acetilcisteína), un precursor del glutatión, el antioxidante más importante del cuerpo.',
    ingredientes: 'N-Acetilcisteína, cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día, preferentemente en ayunas.',
    publico: 'adultos mayores de 18 años que buscan detox, defensas y pulmones',
    meta_beneficio: 'detox y antioxidantes'
  },
  {
    match: [/hongo|reishi|mushroom/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '😌 Reduce el estrés y favorece la relajación.',
      '😴 Mejora la calidad del sueño.',
      '♻️ Antioxidante natural que combate el envejecimiento.',
      '❤️ Apoya la salud cardiovascular.'
    ],
    intro: 'Hongos medicinales utilizados durante siglos por la medicina tradicional china por sus propiedades inmunoestimulantes.',
    ingredientes: 'Mezcla de extractos de hongos (Reishi, Maitake, Cordyceps según el producto), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años que buscan defensas y equilibrio',
    meta_beneficio: 'inmunidad y equilibrio'
  },
  {
    match: [/zinc|zn/i],
    beneficios_cortos: [
      '🛡️ Refuerza el sistema inmunológico.',
      '💅 Favorece la piel, el cabello y las uñas.',
      '♻️ Apoya la cicatrización y la recuperación.',
      '⚖️ Contribuye al equilibrio hormonal.',
      '🧬 Esencial para la síntesis de proteínas.'
    ],
    intro: 'Zinc, mineral esencial presente en más de 300 enzimas del cuerpo, vital para defensas, piel y hormonas.',
    ingredientes: 'Quelato de zinc o gluconato de zinc, cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con una comida.',
    publico: 'adultos mayores de 18 años con defensas bajas o piel/cabello deteriorado',
    meta_beneficio: 'defensas, piel y hormonas'
  },
  {
    match: [/potasio/i],
    beneficios_cortos: [
      '❤️ Promueve la salud cardiovascular.',
      '🩸 Regula la presión arterial.',
      '💪 Mejora la función muscular y evita calambres.',
      '⚡ Mantiene el equilibrio de electrolitos.',
      '🧠 Apoya la transmisión nerviosa.'
    ],
    intro: 'Potasio, mineral esencial para músculos, corazón y equilibrio de líquidos en el cuerpo.',
    ingredientes: 'Citrato de potasio o gluconato de potasio, cápsula vegetal.',
    uso: 'Consumir 1 a 2 cápsulas al día con las comidas.',
    publico: 'adultos mayores de 18 años con calambres o que consumen poco potasio',
    meta_beneficio: 'corazón y músculos'
  },
  {
    match: [/selenio/i],
    beneficios_cortos: [
      '🛡️ Potente antioxidante que protege las células.',
      '❤️ Apoya la salud cardiovascular.',
      '🧬 Contribuye a la función tiroidea.',
      '🛡️ Refuerza el sistema inmunológico.',
      '⚖️ Favorece el equilibrio hormonal.'
    ],
    intro: 'Selenio, mineral traza esencial para la tiroides y la defensa antioxidante del cuerpo.',
    ingredientes: 'Selenio quelado o selenometionina, cápsula vegetal.',
    uso: 'Consumir 1 cápsula al día con el desayuno.',
    publico: 'adultos mayores de 18 años que buscan antioxidantes y salud tiroidea',
    meta_beneficio: 'tiroides y antioxidantes'
  },
  {
    match: [/maca/i],
    beneficios_cortos: [
      '⚡ Aumenta la energía y la resistencia física.',
      '😌 Mejora el estado de ánimo.',
      '⚖️ Equilibra las hormonas naturalmente.',
      '❤️ Favorece la fertilidad y la libido.',
      '🧠 Estimula la función cognitiva.'
    ],
    intro: 'Maca peruana, raíz andina con siglos de uso tradicional para energía, equilibrio hormonal y vitalidad.',
    ingredientes: 'Extracto de raíz de maca (Lepidium meyenii), cápsula vegetal.',
    uso: 'Consumir 2 cápsulas al día con el desayuno.',
    publico: 'adultos mayores de 18 años con cansancio o desequilibrio hormonal',
    meta_beneficio: 'energía y equilibrio'
  }
];

// Función: detecta qué tipo de producto es según el nombre.
// Devuelve la primera ficha que matchea todas las regex de `match`.
function fichaPorNombre(nombre) {
  if (!nombre) return null;
  for (const f of FICHAS) {
    let all = true;
    for (const rx of f.match) {
      if (!rx.test(nombre)) { all = false; break; }
    }
    if (all) return f;
  }
  return null;
}

// Genera una ficha completa usando la plantilla específica del producto.
function fichaEspecifica(nombre, marca) {
  const plantilla = fichaPorNombre(nombre);
  if (!plantilla) return null;
  // Extraer un nombre amigable: "10 magnesios 120 capsulas 500mg UE - UniErvas"
  // → "10 Magnesios". Para títulos cortos, usamos una versión limpia.
  const nombreLimpio = (nombre || 'Este producto')
    .replace(/\s*[-–]\s*\d+\s*c[aá]psulas?.*$/i, '')
    .replace(/\s+\d+(capsulas|c[aá]psulas)(.*)?$/i, '')
    .replace(/\s+\d+\s*(mg|ml|g|gr|UI|ui|mcg|lb|kg)\b.*$/i, '')
    .replace(/\s+(UE|MX|UL|AP|FL|BIO|NB|RY|UN|CO|EX|PR|FNB|KT|SW|VC|AL|KN|VE|RX)\s*$/i, '')
    .replace(/\s+\d+\s*(lb|kg|g|ml)\b.*$/i, '')
    .replace(/\s*-\s*$/i, '')
    .trim() || 'Este producto';
  const nombreTitulo = (nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1));
  const marcaTxt = marca ? ' de ' + marca : '';
  const titulo = nombreTitulo + (marca ? ' - ' + marca : '');
  const ingredientes = plantilla.ingredientes || 'Ingredientes activos según el producto.';
  const descCorta = 'Beneficios principales<br>' + plantilla.beneficios_cortos.join('<br>');
  const descLarga = '<p>' + nombreTitulo + marcaTxt + '. ' + plantilla.intro + '</p>\n\n' +
    '<h3>Ingredientes</h3>\n<p>' + ingredientes + '</p>\n\n' +
    '<p>✅ Sin gluten.</p>\n\n' +
    '<h3>Modo de uso</h3>\n<p>' + plantilla.uso + '</p>\n<p>Indicado para ' + plantilla.publico + '.</p>\n\n' +
    '<h3>Importante</h3>\n<p>Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz.</p>';
  // meta_titulo: max 60 chars
  const cabeza = nombreTitulo.slice(0, 50);
  const metaTitulo = (cabeza + ' | ' + plantilla.meta_beneficio).slice(0, 70);
  // Primer beneficio, sin emoji al inicio
  const primerBen = plantilla.beneficios_cortos[0].replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+\s*/, '');
  const metaDesc = (nombreTitulo + ' con ' + ingredientes.split(',')[0].trim().toLowerCase() + '. ' + primerBen + ' Suplemento nutricional en Paraguay.').slice(0, 160);
  return {
    titulo: titulo,
    descripcion_corta: descCorta,
    descripcion_larga: descLarga,
    meta_titulo: metaTitulo,
    meta_descripcion: metaDesc
  };
}

async function generarFicha(d) {
  const sys = `Sos redactor de fichas de producto para Seiva, tienda de suplementos en Paraguay.
Devolvé SOLO un JSON válido (sin texto fuera del JSON) con exactamente estas claves:

{
  "titulo": "{Nombre} {presentacion} - {Marca}",
  "descripcion_corta": "Beneficios principales<br>⚡ ...<br>💪 ...<br>...",
  "descripcion_larga": "<p>intro</p><h3>Ingredientes</h3><p>...</p><p>✅ Sin gluten.</p><h3>Modo de uso</h3><p>...</p><h3>Importante</h3><p>texto legal</p>",
  "meta_titulo": "{Nombre} {presentacion} | {beneficio principal}",
  "meta_descripcion": "{Nombre} con {ingredientes}. {beneficios}. Suplemento nutricional en Paraguay."
}

FORMATO EXACTO:

titulo → 'Nombre {presentacion} - Marca' (ej: 'Colostro Bovino 500mg - 60 Cápsulas - V7 Energy'). Incluí presentación (mg/cápsulas/ml) si la sabés o la podés inferir del nombre.

descripcion_corta → empieza con la línea 'Beneficios principales' y luego UNA línea por beneficio, con emoji y punto final, máximo 5 beneficios. Usá SIEMPRE <br> para separar las líneas (NO uses \n). Ej:
⚡ Apoya la energía y el metabolismo energético.<br>💪 Contribuye al funcionamiento muscular.<br>🏋️ Apoya la síntesis de proteínas.<br>🛡️ Aporta acción antioxidante y ayuda a proteger las células frente al estrés oxidativo.

descripcion_larga → en HTML, en este orden exacto:
1) Párrafo introductorio: '<Nombre> es un suplemento nutricional formulado con <ingredientes principales>, nutrientes que <beneficios>. Ideal como apoyo nutricional para <público objetivo>.'
2) Encabezado 'Ingredientes' + lista de componentes separados por comas (usá los que te doy como contexto si los tenés).
3) '✅ Sin gluten.' como línea propia (en su propio <p>).
4) Encabezado 'Modo de uso': una <p> con 'Consumir N cápsulas al día, preferentemente según las indicaciones de un médico o nutricionista.' y otra <p> con 'Indicado para mayores de N años.'
5) Encabezado 'Importante': una <p> con 'Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz.'

Reglas de saltos de línea en descripcion_larga:
- Separá SIEMPRE los párrafos con saltos de línea reales (\\\\n) entre las etiquetas HTML <p>, <h3>, etc. Ejemplo válido literal:
<p>Intro.</p>
<h3>Ingredientes</h3>
<p>Componente A, Componente B.</p>
<p>✅ Sin gluten.</p>
<h3>Modo de uso</h3>
<p>Consumir 2 cápsulas al día.</p>
<p>Indicado para mayores de 18 años.</p>
<h3>Importante</h3>
<p>Texto legal completo.</p>

meta_titulo → 'Nombre {presentacion} | beneficio principal' (máx ~60 caracteres).
meta_descripcion → '<Nombre> con <ingredientes>. <beneficios>. Suplemento nutricional en Paraguay.' (máx 160 caracteres).

REGLAS:
- El bloque SEO (meta_titulo y meta_descripcion) NO va dentro de descripcion_larga; va aparte en sus claves.
- Español, tono cercano, sin inventar datos clínicos ni cantidades concretas que no tengas.
- Si la marca no se conoce, omití ' - Marca' en titulo y no inventes una.
- Devolvé SOLO el JSON, sin markdown, sin texto antes ni después de la primera {.`;
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
  // Normalizamos saltos de línea en descripcion_larga: la IA a veces devuelve un string JSON
  // donde los \n se escaparon como "\\n" en vez de "\n". Lo arreglamos acá.
  if (typeof f.descripcion_larga === 'string') {
    f.descripcion_larga = f.descripcion_larga
      .replace(/\\n/g, '\n')
      .replace(/\n{2,}/g, '\n');
  }
  // descripcion_corta: la web la renderiza como HTML (dangerouslySetInnerHTML sin
  // whitespace-pre-line), así que los saltos de línea TIENEN que ser <br>. Si la IA
  // usó \n (real o escapado), los convertimos a <br> para que no queden "todos agrupados".
  if (typeof f.descripcion_corta === 'string') {
    f.descripcion_corta = f.descripcion_corta
      .replace(/\\n/g, '<br>')  // literal "\n" (2 chars) → <br>
      .replace(/\n/g, '<br>');  // salto de línea real → <br>
  }
  // Plantilla específica del producto según keywords del nombre. Se evalúa
  // SIEMPRE — cuando la IA devuelve algo genérico (palabras como "suplemento
  // nutricional formulado con ingredientes de calidad"), se descarta y se
  // reemplaza por esta ficha con copywriting real.
  let fichaPlantilla = null;
  try { fichaPlantilla = fichaEspecifica(d.nombre, d.marca); } catch (e) {}

  function plantillaMerge(field, fallback) {
    if (!fichaPlantilla || !fichaPlantilla[field]) return fallback;
    // Si el campo de la IA es genérico o vacío, usamos la plantilla.
    if (!f[field]) return fichaPlantilla[field];
    if (typeof f[field] === 'string' && requierePlantilla(f[field])) {
      console.log('[SEIVA-FICHA][OUT][generico-' + field + '] descarte contenido IA, uso plantilla específica.');
      return fichaPlantilla[field];
    }
    return f[field];
  }

  function requierePlantilla(t) {
    if (!t || typeof t !== 'string') return true;
    if (t.length < 60) return true;
    const frases = [
      'suplemento nutricional formulado con ingredientes de calidad',
      'producto natural de alta calidad',
      'aporta nutrientes esenciales para el día a día',
      'calidad garantizada por',
      'apoyo nutricional para adultos mayores'
    ];
    const lower = t.toLowerCase();
    return frases.some(fr => lower.includes(fr));
  }

  // Limpieza: si la IA devolvió algo genérico, lo detectamos y reemplazamos
  // por la plantilla. Si la IA respondió bien, lo dejamos pero chequeamos
  // longitud mínima.
  f.descripcion_corta = plantillaMerge('descripcion_corta', f.descripcion_corta);
  f.descripcion_larga = plantillaMerge('descripcion_larga', f.descripcion_larga);
  f.meta_titulo = plantillaMerge('meta_titulo', f.meta_titulo);
  f.meta_descripcion = plantillaMerge('meta_descripcion', f.meta_descripcion);
  f.titulo = plantillaMerge('titulo', f.titulo);

  // Diagnóstico: logueamos el objeto final que devuelve generarFicha.
  console.log('[SEIVA-FICHA][OUT] titulo=' + (f.titulo || '?') + ' cortaLen=' + (f.descripcion_corta ? f.descripcion_corta.length : 0) + ' largaLen=' + (f.descripcion_larga ? f.descripcion_larga.length : 0) + ' plantilla=' + (fichaPlantilla ? 'USADA' : 'ninguna'));

  // Validación de longitud: si algo quedó corto (palabras como "producto natural
  // de alta calidad"), descartamos y forzamos la plantilla específica si existe.
  if (typeof f.descripcion_corta === 'string' && f.descripcion_corta.length < 60) {
    console.log('[SEIVA-FICHA][OUT][vacio-corta] era muy corta, vacío → uso plantilla.');
    f.descripcion_corta = fichaPlantilla ? fichaPlantilla.descripcion_corta : '';
  }
  if (typeof f.descripcion_larga === 'string' && f.descripcion_larga.length < 200) {
    console.log('[SEIVA-FICHA][OUT][vacio-larga] era muy corta, vacío → uso plantilla.');
    f.descripcion_larga = fichaPlantilla ? fichaPlantilla.descripcion_larga : '';
  }

  // Si TODO quedó vacío (no había plantilla específica tampoco), usamos el
  // fallback mínimo genérico para que el producto no quede sin descripciones.
  if (!f.descripcion_corta) f.descripcion_corta = 'Beneficios principales<br>⚡ Suplemento nutricional formulado con ingredientes de calidad.<br>💪 Aporta nutrientes esenciales para el día a día.<br>🔬 Calidad garantizada por ' + (d.marca || 'Seiva') + '.<br>✅ Sin gluten.';
  if (!f.descripcion_larga) {
    const nombre = d.nombre || 'Este producto';
    const marcaTag = d.marca ? ' Marca ' + d.marca + '.' : '';
    f.descripcion_larga = '<p>' + nombre + ' es un suplemento nutricional formulado con ingredientes de calidad.' + marcaTag + ' Ideal como apoyo nutricional para adultos mayores de 18 años.</p>\n\n<h3>Ingredientes</h3>\n<p>Ingredientes seleccionados de calidad.</p>\n<p>✅ Sin gluten.</p>\n\n<h3>Modo de uso</h3>\n<p>Consumir según las indicaciones del envase o de un médico o nutricionista.</p>\n<p>Indicado para mayores de 18 años.</p>\n\n<h3>Importante</h3>\n<p>Este producto es un suplemento alimenticio y no un medicamento. No exceder la cantidad recomendada. Mantener fuera del alcance de los niños y conservar en un lugar fresco, seco y protegido de la luz.</p>';
  }
  if (!f.meta_titulo) f.meta_titulo = (d.nombre || 'Producto') + ' | Suplemento nutricional';
  if (!f.meta_descripcion) f.meta_descripcion = (d.nombre || 'Producto') + ' es un suplemento nutricional formulado con ingredientes de calidad, ideal como apoyo nutricional. Suplemento nutricional en Paraguay.';
  if (!f.titulo) f.titulo = d.nombre || 'Producto';
  console.log('[SEIVA-FICHA][OUT][FIN] cortaLen=' + f.descripcion_corta.length + ' largaLen=' + f.descripcion_larga.length);
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

})().catch(e => {
  // Fallback seguro: si algo tiró excepción dentro de la IIFE, devolvemos un
  // mensaje de error visible en lugar de dejar que n8n explote con SyntaxError.
  return [{ json: { chatId: 0, texto: '❌ Error interno: ' + (e && e.message ? e.message : String(e)) } }];
});
