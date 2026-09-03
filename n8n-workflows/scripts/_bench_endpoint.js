// Mide latencia del endpoint /api/productos/all en producción.
const fs = require('fs');
const JWT = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim();

async function timeit(label, url, opts) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, opts);
    let n = 0;
    try { const j = await r.json(); n = Array.isArray(j) ? j.length : (j && typeof j === 'object' ? Object.keys(j).length : 0); } catch (e) {}
    console.log(label.padEnd(28), 'HTTP', r.status, '|', (Date.now() - t0) + 'ms', '| items:', n);
  } catch (e) {
    console.log(label.padEnd(28), 'ERROR', (Date.now() - t0) + 'ms', e.message);
  }
}

(async () => {
  console.log('=== latencia endpoints producción ===');
  await timeit('/api/productos/all', 'https://seiva.com.py/api/productos/all', { headers: { Authorization: 'Bearer ' + JWT } });
  await timeit('/api/productos/all (2da)', 'https://seiva.com.py/api/productos/all', { headers: { Authorization: 'Bearer ' + JWT } });
  await timeit('/api/ping', 'https://seiva.com.py/api/ping');
  await timeit('/api/productos (público)', 'https://seiva.com.py/api/productos');
})();
