const fs = require('fs');
const https = require('https');
const K = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n')[1].trim();
const OUT = 'E:/Pagina_seiva/n8n-workflows/';

function get(path) {
  return new Promise((res, rej) => {
    https.get({ hostname: 'n8n.seiva.com.py', path, headers: { 'X-N8N-API-KEY': K } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  // 1. Exportar el workflow v2 (el que corre)
  const live = await get('/api/v1/workflows/cLctBPDSRXliimrV');
  const w = live.data ? live.data : live;
  fs.writeFileSync(OUT + 'seiva-agente-inventario-v2.json', JSON.stringify(w, null, 2));
  console.log('guardado: seiva-agente-inventario-v2.json');

  // 2. Exportar tambien el agente viejo (backup, por si acaso)
  try {
    const old = await get('/api/v1/workflows/ylnX2JybaoH4wykM');
    const ow = old.data ? old.data : old;
    fs.writeFileSync(OUT + 'seiva-agente-inventario-v1-BACKUP.json', JSON.stringify(ow, null, 2));
    console.log('guardado: seiva-agente-inventario-v1-BACKUP.json');
  } catch (e) { console.log('no se pudo respaldar el v1'); }

  // 3. Listar todos los workflows como inventario
  const all = await get('/api/v1/workflows?limit=100');
  const lista = (all.data || []).map(x => ({
    id: x.id, name: x.name, active: x.active, updatedAt: x.updatedAt
  }));
  fs.writeFileSync(OUT + 'inventario-workflows.json', JSON.stringify(lista, null, 2));
  console.log('guardado: inventario-workflows.json (' + lista.length + ' workflows)');
})();
