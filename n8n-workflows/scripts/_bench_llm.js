// Mide latencia del LLM (openrouter mimo-v2.5).
const fs = require('fs');
const n8nLines = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n').map(s => s.trim());
const OR_KEY = n8nLines[7];

async function bench(label, body) {
  const t0 = Date.now();
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const txt = await r.text();
    console.log(label.padEnd(22), 'HTTP', r.status, '|', (Date.now() - t0) + 'ms', '|', txt.slice(0, 120).replace(/\n/g, ' '));
  } catch (e) {
    console.log(label.padEnd(22), 'ERROR', (Date.now() - t0) + 'ms', e.message);
  }
}

(async () => {
  console.log('=== latencia LLM ===');
  await bench('mimo corto', {
    model: 'xiaomi/mimo-v2.5',
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'Devolvé SOLO json: {"accion":"consultar"}' }, { role: 'user', content: 'cuanto stock hay' }],
    temperature: 0.1, max_tokens: 400
  });
  await bench('mimo con inventario', {
    model: 'xiaomi/mimo-v2.5',
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: 'Devolvé SOLO json con accion' }, { role: 'user', content: 'MENSAJE: poné el colostro en 5\n\nINVENTARIO (187 productos):\n' + 'ID 1 | x | stock:1\n'.repeat(187) }],
    temperature: 0.1, max_tokens: 800
  });
})();
