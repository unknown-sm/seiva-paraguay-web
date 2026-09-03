// Prueba local del Cerebro v4 (determinista + FSM). No toca producción.
const fs = require('fs');
const w = require('../seiva-agente-inventario-v4.json');
const brain = w.nodes.find(n => n.name === 'Cerebro').parameters.jsCode;

// Estado compartido entre mensajes (simula la tabla bot_sessions)
const sessionStore = {};
let nextId = 1000;
const prods = [
  { id: 188, nombre: 'Colostro Bovino 500mg 60 Caps', precio: 60000, stock: 6, activo: 1, marca: 'V7', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
  { id: 190, nombre: 'Creatina Monohidratada 300g', precio: 85000, stock: 3, activo: 1, marca: '', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
  { id: 192, nombre: 'Proteína Whey 2kg', precio: 300000, stock: 0, activo: 0, marca: '', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
  { id: 95, nombre: 'Ashwagandha Extracto 60 capsulas UE', precio: 60000, stock: 0, activo: 1, marca: '', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
  { id: 43, nombre: 'Ashwagandha Extracto 120 capsulas UE', precio: 85000, stock: 0, activo: 1, marca: '', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
  { id: 3, nombre: 'Aceite de Orégano 120 capsulas 6000mg Americano', precio: 170000, stock: 4, activo: 1, marca: '', categoria: 'suplementos', descripcion: '', descripcion_larga: '', seo_descripcion: '', sku: '', imagen: '' },
];

async function runMessage(text, opts = {}) {
  const photo = opts.photo || null;
  const triggerItem = { message: { chat: { id: 12345 }, text, photo: photo ? [null, null, { file_id: 'ph1' }] : undefined } };
  const calls = [];
  const myThis = {
    helpers: {
      httpRequest: async (o) => {
        calls.push({ method: o.method, url: o.url, body: o.body });
        const u = o.url;
        if (u.includes('openrouter.ai')) {
          // mock LLM: devolver "none" por defecto
          const content = o.body && o.body.messages ? o.body.messages[o.body.messages.length - 1].content : '';
          if (/colostro en 5/i.test(content)) return { choices: [{ message: { content: '{"accion":"ajustar_stock","id":188,"modo":"set","valor":5}' } }] };
          if (/sub[íi] 3|sum[aá] 3/i.test(content)) return { choices: [{ message: { content: '{"accion":"ajustar_stock","id":190,"modo":"sumar","valor":3}' } }] };
          if (/magnesio/i.test(content)) return { choices: [{ message: { content: '{"accion":"aclarar","accion_pendiente":"despublicar","candidatos":[{"id":188,"nombre":"Magnesio A","stock":5,"precio":50000},{"id":192,"nombre":"Magnesio B","stock":3,"precio":45000}],"respuesta":"¿Cuál magnesio querés despublicar?"}' } }] };
          if (/generar|ficha/i.test(o.body && o.body.messages && o.body.messages[0].content || '')) return { choices: [{ message: { content: '{"descripcion_corta":"Beneficios","descripcion_larga":"<p>ok</p>","meta_descripcion":"meta"}' } }] };
          return { choices: [{ message: { content: '{"accion":"none","respuesta":"respuesta IA"}' } }] };
        }
        if (u.includes('/bot-session/')) {
          const cid = '12345';
          if (o.method === 'GET') return sessionStore[cid] || {};
          if (o.method === 'PUT') { sessionStore[cid] = { state: o.body.state, draft: JSON.stringify(o.body.draft) }; return { ok: true }; }
          if (o.method === 'DELETE') { delete sessionStore[cid]; return { ok: true }; }
        }
        if (u.includes('/api/productos/all')) return prods;
        if (u.includes('/stock-batch')) { const up = o.body.updates[0]; const p = prods.find(x => x.id === up.id); if (p) p.stock = up.stock; return { ok: true }; }
        if (u.includes('/toggle')) { const id = parseInt(u.split('/')[6]); const p = prods.find(x => x.id === id); if (p) p.activo = p.activo ? 0 : 1; return { activo: !!p.activo }; }
        if (o.method === 'DELETE') { const id = parseInt(u.split('/').filter(Boolean).pop()); const i = prods.findIndex(x => x.id === id); if (i >= 0) prods.splice(i, 1); return { ok: true }; }
        if (o.method === 'POST' && u.includes('/api/productos')) { nextId++; prods.push(Object.assign({ id: nextId, activo: 1 }, o.body)); return { id: nextId }; }
        if (u.includes('/api/scrape-product')) {
          if (/magazineluiza/i.test((o.body && o.body.url) || '')) { throw new Error('Sitio bloqueó el acceso o no se pudo extraer el producto.'); }
          return { nombre: 'Scrapeado Test', precio: 7675, moneda: 'BRL', marca: 'V7 Energy', descripcion: '', descripcion_larga: '<p>x</p>', seo_descripcion: '', imagen: '/img/t.jpg', galeria: ['g1.jpg', 'g2.jpg'] };
        }
        if (u.includes('api.telegram.org')) return { ok: true, result: { file_path: 'photos/file_1.jpg' } };
        return {};
      }
    }
  };
  const $ = (n) => ({ item: { json: triggerItem } });
  const fn = new Function('$', 'return (async function(){' + brain + '}).call(this)');
  let result, err = null;
  try { result = await fn.call(myThis, $); } catch (e) { err = e; }
  if (err) { console.log('   [ERROR]', err.message); return []; }
  return result;
}

(async () => {
  const cases = [
    'ayuda',
    'lista',
    'stock 188 5',
    'poné el 188 en 5',
    'sumá 3 al 190',
    'restá 1 al 190',
    'publicá el 188',
    'ocultá el 192',
    'qué hay sin stock',
    'poné el colostro en 5',
    'precio 188 70000',
    'proveedor 188 45',
    'costo 190 45,50',
    'crear Omega X proveedor 33 precio 80000 stock 6',
    'restá 100 al 190',
    'eliminá el 190',
    'el 43 stock 1',
    'el 3 stock 2',
    'busca ashwagandha',
    'busca aceite de orégano',
    'cuánto stock de ashwagandha',
    'https://www.magazineluiza.com.br/x el precio es 85mil, precio proveedor 16 reales, stock 0',
    'crear Vitamina C precio 60000 stock 10',
    'https://www.magazineluiza.com.br/prod1 el precio es 90mil stock 5',
    'https://www.v7energy.com.br/colostro de ese producto 188, faltaron las fotos de la galeria',
    'https://www.v7energy.com.br/colostro',
    'hola',
  ];
  for (const c of cases) {
    const out = await runMessage(c);
    console.log('\n→', c);
    console.log('  ' + (out && out[0] && out[0].json.texto || '(vacío)').replace(/\n/g, ' | '));
  }

  // ---- Flujo secuencial (FSM de confirmación) ----
  console.log('\n\n========== FSM: crear + aprobar ==========');
  await runMessage('crear Omega 3 marca AP precio 120000 stock 5');
  console.log('  [crear]');
  const ap = await runMessage('APROBAR');
  console.log('  [APROBAR]', (ap && ap[0] && ap[0].json.texto || '(vacío)').replace(/\n/g, ' | '));

  console.log('\n========== FSM: eliminar + confirmar ==========');
  const el = await runMessage('eliminá el 190');
  console.log('  [eliminá]', (el && el[0] && el[0].json.texto || '(vacío)').replace(/\n/g, ' | '));
  const cf = await runMessage('CONFIRMAR');
  console.log('  [CONFIRMAR]', (cf && cf[0] && cf[0].json.texto || '(vacío)').replace(/\n/g, ' | '));
  console.log('\nProductos restantes:', prods.map(p => p.id + ':' + p.nombre).join(', '));

  // ---- Ambigüedad: selección por número → ejecuta la acción pendiente ----
  console.log('\n========== FSM: ambigüedad (despublicar por nombre) ==========');
  const amb = await runMessage('despublicá el magnesio');
  console.log('  [despublicá el magnesio]', (amb && amb[0] && amb[0].json.texto || '(vacío)').replace(/\n/g, ' | '));
  const pick = await runMessage('2');
  console.log('  [elegir "2"]', (pick && pick[0] && pick[0].json.texto || '(vacío)').replace(/\n/g, ' | '));
})();
