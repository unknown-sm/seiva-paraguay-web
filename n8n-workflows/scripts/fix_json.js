const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();
const WF = fs.readFileSync('v2_id.txt', 'utf8').trim();

function get(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: 'n8n.seiva.com.py', path, headers: { 'X-N8N-API-KEY': K } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

const SYS = [
  'You are a strict JSON API for SEIVA inventory management (Paraguay, currency Gs).',
  'Output ONLY a valid JSON object. Never output prose, markdown, apologies or explanations.',
  '',
  'Schema: {"accion":string,"id":number|null,"valor":number|null,"datos":object,"respuesta":string}',
  '',
  'accion values:',
  '- "ajustar_stock": change stock. id=real product id, valor=new absolute stock.',
  '- "publicar": id=real id.',
  '- "despublicar": id=real id.',
  '- "editar": id=real id, datos={field:value}.',
  '- "crear": datos=full product object.',
  '- "aclarar": ambiguous or missing data. Ask in respuesta.',
  '- "consultar": answer questions using inventory data.',
  '',
  'Rules:',
  '- Use ONLY the ids present in the INVENTORY list. Never invent ids.',
  '- If several products match, use accion "aclarar" and list them numbered with ids.',
  '- You do NOT execute anything. Just output the JSON.',
  '- Never claim success or use checkmarks.',
  '',
  'Examples:',
  'User: "pon el 188 en 5" => {"accion":"ajustar_stock","id":188,"valor":5,"datos":{},"respuesta":"Actualizando stock del producto 188 a 5 unidades."}',
  'User: "cuanto stock hay" => {"accion":"consultar","id":null,"valor":null,"datos":{},"respuesta":"<answer with real data>"}'
].join('\n');

(async () => {
  const live = await get('/api/v1/workflows/' + WF);
  const w = live.data ? live.data : live;

  // 1. Modelo con responseFormat json_object (obliga a JSON) + prompt en ingles, estricto
  const m = w.nodes.find(n => n.name === 'OpenRouter Chat Model');
  m.parameters.options = {
    systemMessage: SYS,
    responseFormat: 'json_object',
    temperature: 0.1,
    maxTokens: 800
  };
  console.log('modelo con responseFormat=json_object, temp 0.1');

  // 2. Quitar la memoria (hace que el modelo se ponga a charlar)
  const memIdx = w.nodes.findIndex(n => n.name === 'Memoria (chat)');
  if (memIdx >= 0) {
    w.nodes.splice(memIdx, 1);
    delete w.connections['Memoria (chat)'];
    console.log('memoria eliminada');
  }

  // 3. El texto de entrada, en ingles y claro
  const a = w.nodes.find(n => n.name === 'Agente Inventario');
  a.parameters.text = '={{ "USER MESSAGE: " + $json.mensaje + "\\n\\nINVENTORY (real ids):\\n" + $json.inventario }}';
  console.log('entrada del agente ajustada');

  const clean = {
    name: w.name, nodes: w.nodes, connections: w.connections,
    settings: w.settings || { executionOrder: 'v1' }, staticData: w.staticData || {}
  };
  const body = JSON.stringify(clean);
  const r = https.request({
    hostname: 'n8n.seiva.com.py', path: '/api/v1/workflows/' + WF, method: 'PUT',
    headers: { 'X-N8N-API-KEY': K, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let o = ''; res.on('data', c => o += c);
    res.on('end', () => console.log('PUT HTTP', res.statusCode, o.slice(0, 80)));
  });
  r.write(body); r.end();
})();
