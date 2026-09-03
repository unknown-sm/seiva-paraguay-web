// build_v4.js — arma y despliega "Seiva - Inventario v4 (Cerebro)".
// Un único nodo Code (el Cerebro) con UNA salida. El LLM solo interpreta;
// el Cerebro ejecuta determinista y confirma con el resultado real del backend.

const fs = require('fs');
const path = require('path');

let TOKEN = '';
try { TOKEN = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim(); } catch (e) {}

let n8nLines = [];
let OR_KEY = '';
let TG_TOKEN = '';
let N8N_KEY = '';
try {
  n8nLines = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n').map(s => s.trim());
  N8N_KEY = n8nLines[1] || '';
  TG_TOKEN = n8nLines[4] || '';
  OR_KEY = n8nLines[7] || '';
} catch (e) {}

const brainSrc = fs.readFileSync(path.join(__dirname, 'brain-source.js'), 'utf8');
const brain = brainSrc
  .replace(/__TOKEN__/g, TOKEN)
  .replace(/__OR_KEY__/g, OR_KEY)
  .replace(/__TG_TOKEN__/g, TG_TOKEN);

const CRED_TG = { telegramApi: { id: 'wtekAWcrcfSlrW67', name: 'SEIVA Bot' } };

const nodes = [
  {
    parameters: { updates: ['message', 'callback_query'], additionalFields: {} },
    id: 'tg', name: 'Telegram Trigger', type: 'n8n-nodes-base.telegramTrigger',
    typeVersion: 1.2, position: [-360, 300], credentials: CRED_TG,
    webhookId: 'seiva-agent-v4'
  },
  {
    parameters: { jsCode: brain },
    id: 'brain', name: 'Cerebro', type: 'n8n-nodes-base.code',
    typeVersion: 2, position: [-140, 300]
  },
  {
    parameters: {
      chatId: '={{ $json.chatId }}',
      text: '={{ $json.texto }}',
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' }
    },
    id: 'resp', name: 'Responder', type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2, position: [80, 300], credentials: CRED_TG
  }
];

const connections = {
  'Telegram Trigger': { main: [[{ node: 'Cerebro', type: 'main', index: 0 }]] },
  'Cerebro': { main: [[{ node: 'Responder', type: 'main', index: 0 }]] }
};

const workflow = {
  name: 'Seiva - Inventario v4 (Cerebro)',
  nodes, connections,
  settings: { executionOrder: 'v1' }
};

const OUT = path.join(__dirname, '..', 'seiva-agente-inventario-v4.json');
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('JSON generado:', OUT, '| brain chars:', brain.length);

// ---- deploy idempotente ----
const https = require('https');
function req(method, path_, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const r = https.request({
      hostname: 'n8n.seiva.com.py', path: path_, method,
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ status: res.statusCode, body: o })); });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    r.write(data); r.end();
  });
}
function get(path_) {
  return new Promise((resolve) => {
    https.get({ hostname: 'n8n.seiva.com.py', path: path_, headers: { 'X-N8N-API-KEY': N8N_KEY } }, res => {
      let o = ''; res.on('data', c => o += c); res.on('end', () => { try { resolve(JSON.parse(o)); } catch (e) { resolve({}); } });
    }).on('error', () => resolve({}));
  });
}

(async () => {
  if (!process.argv.includes('--deploy')) {
    console.log('(sin --deploy: solo se generó el JSON. Para desplegar: node build_v4.js --deploy)');
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
  } else {
    const r = await req('POST', '/api/v1/workflows', workflow);
    console.log('CREATE HTTP', r.status, r.body.slice(0, 120));
    if (r.status < 300) { try { const j = JSON.parse(r.body); console.log('id:', j.id); } catch (e) {} }
  }
})();
