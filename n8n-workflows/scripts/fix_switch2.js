const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();
const WF = fs.readFileSync('v2_id.txt', 'utf8').trim();
const JWT = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim();

function get(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: 'n8n.seiva.com.py', path, headers: { 'X-N8N-API-KEY': K } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

const CODE = [
  "const d = $input.first().json;",
  "const acc = d.accion;",
  "const id = d.id;",
  "const valor = d.valor;",
  "const datos = d.datos || {};",
  "const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer " + JWT + "' };",
  "const API = 'https://seiva.com.py/api/productos';",
  "",
  "// Acciones que solo responden (no tocan el backend)",
  "if (acc === 'consultar' || acc === 'aclarar' || acc === 'error') {",
  "  return [{ json: { chatId: d.chatId, texto: d.respuesta } }];",
  "}",
  "",
  "let url = '', method = 'GET', body = null;",
  "if (acc === 'ajustar_stock') { url = API + '/' + id; method = 'PUT'; body = { stock: Number(valor) }; }",
  "else if (acc === 'editar') { url = API + '/' + id; method = 'PUT'; body = datos; }",
  "else if (acc === 'publicar' || acc === 'despublicar') { url = API + '/' + id + '/toggle'; method = 'PATCH'; }",
  "else if (acc === 'crear') { url = API; method = 'POST'; body = datos; }",
  "else { return [{ json: { chatId: d.chatId, texto: d.respuesta || 'No entendi la accion.' } }]; }",
  "",
  "let ok = false, detalle = '';",
  "try {",
  "  const opts = { method: method, url: url, headers: H };",
  "  if (body) opts.body = body;",
  "  const r = await this.helpers.httpRequest(opts);",
  "  ok = true;",
  "  detalle = typeof r === 'string' ? r : JSON.stringify(r);",
  "} catch (e) { ok = false; detalle = 'ERROR: ' + e.message; }",
  "",
  "let msg = '';",
  "if (ok) {",
  "  if (acc === 'ajustar_stock') msg = 'Stock actualizado correctamente.';",
  "  else if (acc === 'editar') msg = 'Producto editado correctamente.';",
  "  else if (acc === 'publicar' || acc === 'despublicar') msg = 'Estado actualizado correctamente.';",
  "  else if (acc === 'crear') msg = 'Producto creado correctamente.';",
  "} else {",
  "  msg = 'No pude completar la accion. ' + detalle;",
  "}",
  "return [{ json: { chatId: d.chatId, texto: msg } }];"
].join('\n');

(async () => {
  const live = await get('/api/v1/workflows/' + WF);
  const w = live.data ? live.data : live;

  // Borrar Switch, los 5 HTTP Request y Armar respuesta
  const borrar = ['Switch', 'PUT stock', 'PATCH publicar', 'PATCH despublicar', 'PUT editar', 'POST crear', 'Armar respuesta'];
  w.nodes = w.nodes.filter(n => !borrar.includes(n.name));
  borrar.forEach(n => { delete w.connections[n]; });
  console.log('nodos viejos eliminados');

  // Agregar nodo Code unico que ejecuta
  w.nodes.push({
    parameters: { jsCode: CODE },
    id: 'exec', name: 'Ejecutar accion', type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, 300]
  });
  console.log('nodo Ejecutar accion agregado');

  // Recablear: Parsear accion -> Ejecutar accion -> Responder
  w.connections['Parsear accion'] = { main: [[{ node: 'Ejecutar accion', type: 'main', index: 0 }]] };
  w.connections['Ejecutar accion'] = { main: [[{ node: 'Responder', type: 'main', index: 0 }]] };
  console.log('flujo: Parsear -> Ejecutar -> Responder');

  const clean = {
    name: w.name, nodes: w.nodes, connections: w.connections,
    settings: w.settings || { executionOrder: 'v1' }, staticData: w.staticData || {}
  };
  const body2 = JSON.stringify(clean);
  const r = https.request({
    hostname: 'n8n.seiva.com.py', path: '/api/v1/workflows/' + WF, method: 'PUT',
    headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body2) }
  }, res => {
    let o = ''; res.on('data', c => o += c);
    res.on('end', () => console.log('PUT HTTP', res.statusCode, o.slice(0, 80)));
  });
  r.write(body2); r.end();
})();
