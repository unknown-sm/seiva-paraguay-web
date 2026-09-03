const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();
const AGENT_ID = 'ylnX2JybaoH4wykM';
const JWT = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim();

function get(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: 'n8n.seiva.com.py', path, headers: { 'X-N8N-API-KEY': K } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  const live = await get('/api/v1/workflows/' + AGENT_ID);
  const w = live.data ? live.data : live;

  // 1. Agregar nodo HTTP Request (normal) que trae el inventario
  if (!w.nodes.find(n => n.name === 'Cargar inventario')) {
    w.nodes.push({
      parameters: {
        url: 'https://seiva.com.py/api/productos/all',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {}
      },
      id: 'h_inv', name: 'Cargar inventario',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [700, 300],
      credentials: { httpHeaderAuth: { id: '07NLMVgZ0MQtdNGA', name: 'SEIVA Backend API' } }
    });
    console.log('nodo Cargar inventario agregado');
  }

  // 2. Modificar Preparar entrada para inyectar el inventario en el texto
  const pe = w.nodes.find(n => n.name === 'Preparar entrada');
  if (pe) {
    pe.parameters.jsCode = [
      "const m = $('Telegram Trigger').item.json.message;",
      "const cid = m.chat.id;",
      "const sd = $getWorkflowStaticData('global');",
      "const foto = sd['foto_' + cid] || '';",
      "let txt = m.text || m.caption || '';",
      "if (foto) txt += '\\n\\n[IMAGEN DISPONIBLE]: ' + foto;",
      "// Inventario cargado por el nodo HTTP Request",
      "let inv = '';",
      "try {",
      "  const prods = $items('Cargar inventario');",
      "  const arr = Array.isArray(prods) ? prods : [];",
      "  const lineas = arr.map(p => {",
      "    const j = p.json || p;",
      "    return 'ID ' + j.id + ' | ' + j.nombre + ' | stock:' + j.stock + ' | precio:' + j.precio + ' | ' + (j.activo ? 'publicado' : 'oculto');",
      "  });",
      "  inv = lineas.join('\\n');",
      "} catch (e) { inv = '(no disponible)'; }",
      "const ctx = 'INVENTARIO ACTUAL (usa estos IDs reales, no los inventes):\\n' + inv;",
      "return [{ json: { chatId: cid, sessionId: cid, texto: txt, foto: foto, inventario: ctx } }];"
    ].join('\n');
    console.log('Preparar entrada actualizado (inyecta inventario)');
  }

  // 3. Conectar: Telegram Trigger -> Cargar inventario -> Preparar entrada
  w.connections['Telegram Trigger'] = { main: [[{ node: 'Cargar inventario', type: 'main', index: 0 }]] };
  w.connections['Cargar inventario'] = { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] };
  console.log('flujo: Trigger -> Cargar inventario -> Preparar entrada');

  // 4. El agente debe leer el inventario del contexto
  const a = w.nodes.find(n => n.name === 'Agente Inventario');
  if (a.parameters.options && a.parameters.options.systemMessage) {
    a.parameters.options.systemMessage += [

      '',
      'INVENTARIO EN CONTEXTO:',
      '- En cada mensaje recibis el inventario completo en el campo "inventario", con los IDs reales de los productos.',
      '- USA esos IDs directamente. NO llames herramientas para buscar IDs. No los inventes.',
      '- Si el inventario dice "(no disponible)", avisa que no podes consultar y pedi el ID al usuario.'
    ].join('\n');
    console.log('system prompt: usa IDs del contexto');
  }

  // 5. Actualizar el texto que recibe el agente
  if (a.parameters.text) a.parameters.text = '={{ $json.texto + "\\n\\n" + $json.inventario }}';

  const clean = {
    name: w.name, nodes: w.nodes, connections: w.connections,
    settings: w.settings || { executionOrder: 'v1' }, staticData: w.staticData || {}
  };
  const body = JSON.stringify(clean);
  const r = https.request({
    hostname: 'n8n.seiva.com.py', path: '/api/v1/workflows/' + AGENT_ID, method: 'PUT',
    headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let o = ''; res.on('data', c => o += c);
    res.on('end', () => console.log('PUT HTTP', res.statusCode, o.slice(0, 80)));
  });
  r.write(body); r.end();
})();
