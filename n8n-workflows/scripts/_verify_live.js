// Verificación en vivo de las dependencias críticas del bot v4.
// 1) OpenRouter (mimo-v2.5) con json_object → ¿devuelve JSON válido de NLU?
// 2) Endpoint /api/scrape-product → ¿responde con el token?
// 3) Workflow v4 en n8n → ¿quedó bien desplegado (nodos/conexiones)?

const fs = require('fs');
const JWT = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim();
const N8N_LINES = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n').map(s => s.trim());
const N8N_KEY = N8N_LINES[1];
const OR_KEY = N8N_LINES[7];

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch (e) { j = text; }
  return { status: r.status, body: j };
}

(async () => {
  // ---- 1) LLM ----
  console.log('=== 1) OpenRouter mimo-v2.5 json_object ===');
  try {
    const res = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'xiaomi/mimo-v2.5',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Sos el intérprete de un bot de inventario. Devolvé SOLO json: {"accion":"...","id":num|null,"modo":"set|sumar|restar","valor":num|null,"campos":{}} . Acciones: ajustar_stock, publicar, despublicar, consultar, aclarar.' },
          { role: 'user', content: 'MENSAJE: poné el colostro en 5\n\nINVENTARIO:\nID 188 | Colostro Bovino 500mg 60 Caps | stock:6 | precio:60000' }
        ],
        temperature: 0.1, max_tokens: 400
      })
    });
    console.log('HTTP', res.status);
    const c = res.body && res.body.choices && res.body.choices[0] && res.body.choices[0].message;
    if (c) {
      console.log('content:', c.content);
    } else {
      console.log('respuesta cruda:', JSON.stringify(res.body).slice(0, 500));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // ---- 2) scrape ----
  console.log('\n=== 2) /api/scrape-product (https://example.com) ===');
  try {
    const res = await fetchJson('https://seiva.com.py/api/scrape-product', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    console.log('HTTP', res.status, '|', JSON.stringify(res.body).slice(0, 300));
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  // ---- 3) workflow v4 en n8n ----
  console.log('\n=== 3) Workflow v4 en n8n ===');
  try {
    const list = await fetchJson('https://n8n.seiva.com.py/api/v1/workflows?limit=100', { headers: { 'X-N8N-API-KEY': N8N_KEY } });
    const arr = list.body && list.body.data ? list.body.data : [];
    const v4 = arr.find(x => (x.name || '').includes('v4'));
    if (v4) {
      console.log('encontrado:', v4.name, '| id:', v4.id, '| active:', v4.active);
      const d = await fetchJson('https://n8n.seiva.com.py/api/v1/workflows/' + v4.id, { headers: { 'X-N8N-API-KEY': N8N_KEY } });
      const w = d.body && d.body.data ? d.body.data : d.body;
      const nodes = w.nodes || [];
      console.log('nodos:', nodes.map(n => n.name).join(' | '));
      console.log('conexiones:', JSON.stringify(w.connections || {}).slice(0, 300));
    } else {
      console.log('NO se encontró v4. Workflows:', arr.map(x => x.name).join(' | '));
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
})();
