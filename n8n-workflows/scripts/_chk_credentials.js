const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();

function get(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: 'n8n.seiva.com.py', path, headers: { 'X-N8N-API-KEY': K } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => {
        try { res({ status: r.statusCode, json: JSON.parse(d) }); } catch (e) { res({ status: r.statusCode, text: d.slice(0, 300) }); }
      });
    }).on('error', rej);
  });
}

(async () => {
  const r = await get('/api/v1/credentials?limit=100');
  console.log('HTTP', r.status);
  if (r.json) {
    const list = r.json.data || [];
    console.log('total credenciales:', list.length);
    for (const c of list) {
      console.log('-', c.id, '|', c.name, '|', c.type);
    }
    // intentar traer la credencial httpHeaderAuth (puede venir encriptada)
    const hh = list.find(c => c.name.toLowerCase().includes('backend') || c.type === 'httpHeaderAuth');
    if (hh) {
      const d = await get('/api/v1/credentials/' + hh.id);
      console.log('\ncredential detail HTTP', d.status, JSON.stringify(d.json || d.text).slice(0, 600));
    }
  } else {
    console.log('respuesta:', r.text);
  }
})();
