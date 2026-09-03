// Prueba local de la lógica del Router v3 (single output). No toca producción.
const fs = require('fs');
const w = require('../seiva-agente-inventario-v3.json');
const router = w.nodes.find(n => n.name === 'Router');
const code = router.parameters.jsCode;

const prods = [
  { id: 188, nombre: 'Colostro Bovino 500mg 60 Caps', precio: 60000, stock: 6, activo: 1 },
  { id: 190, nombre: 'Creatina Monohidratada 300g', precio: 85000, stock: 3, activo: 1 },
  { id: 192, nombre: 'Proteína Whey 2kg', precio: 300000, stock: 0, activo: 0 },
];

const cases = [
  'stock 188 5',
  'poné el 188 en 7',
  'publicar 190',
  'ocultar 188',
  'ocultar 192',
  'lista',
  'buscar colostro',
  'cuánto stock de creatina',
  'crear Vitamina C 500mg precio 60000 stock 10',
  'crear Omega 3 marca AP precio 120000 stock 5',
  'ayuda',
  'hola, cómo andás?',
];

(async () => {
  for (const c of cases) {
    const triggerItem = { message: { chat: { id: 12345 }, text: c } };
    const calls = [];
    const myThis = {
      helpers: {
        httpRequest: async (opts) => {
          calls.push({ method: opts.method, url: opts.url, body: opts.body });
          if (opts.method === 'GET') return prods;
          if (opts.url.includes('openrouter.ai')) return { choices: [{ message: { content: 'Hola! Soy el asistente de Seiva. Probá "ayuda".' } }] };
          if (opts.url.includes('/stock-batch')) return { ok: true, updated: 1 };
          if (opts.url.includes('/toggle')) return { activo: true };
          return { id: 999, slug: 'creado' };
        }
      }
    };
    const $ = (name) => ({ item: { json: triggerItem } });

    const fn = new Function('$', 'return (async function(){' + code + '}).call(this)');
    try {
      const result = await fn.call(myThis, $);
      const txtOut = result && result[0] ? result[0].json.texto : null;
      console.log('\n→', JSON.stringify(c));
      console.log('  RESPUESTA:', txtOut ? txtOut.replace(/\n/g, ' | ') : '(vacío)');
      const writes = calls.filter(x => x.method !== 'GET' && !x.url.includes('openrouter.ai'));
      if (writes.length) console.log('  HTTP:', writes.map(x => x.method + ' ' + x.url.replace('https://seiva.com.py/api/productos', '') + ' ' + JSON.stringify(x.body)).join(' ; '));
    } catch (e) {
      console.log('\n→', JSON.stringify(c), 'ERROR:', e.message);
    }
  }
})();
