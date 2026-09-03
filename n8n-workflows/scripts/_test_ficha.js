// Prueba en vivo del nuevo prompt de generarFicha contra OpenRouter (mimo-v2.5).
const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n').map(s => s.trim());
const OR_KEY = lines[7];

// Extrae el array `sys` del generarFicha real en brain-source.js
const src = fs.readFileSync(path.join(__dirname, 'brain-source.js'), 'utf8');
const m = src.match(/async function generarFicha\(d\) \{([\s\S]*?)\n  const user =/);
const fnBody = m[1];
const sysArr = fnBody.match(/const sys = \[([\s\S]*?)\n  \]\.join\('\\n'\);/);
const sys = sysArr[1]
  .split('\n')
  .map(l => l.replace(/^\s*'/, '').replace(/',?\s*$/, ''))
  .filter(l => l !== '')
  .join('\n');

const productos = [
  { nombre: 'Colostro Bovino 500mg 60 Capsulas', marca: 'V7 Energy', precio: 60000 },
  { nombre: 'Creatina Monohidratada 300g', marca: '', precio: 85000 },
];

(async () => {
  for (const p of productos) {
    const user = 'Producto: ' + p.nombre + '\nMarca: ' + (p.marca || '(no especificada)') + '\nPrecio: ' + p.precio;
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'xiaomi/mimo-v2.5',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        temperature: 0.1, max_tokens: 1200,
      }),
    });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('\n========== ' + p.nombre + ' ==========');
    console.log(content);
    try {
      const j = JSON.parse(content);
      const keys = ['titulo', 'descripcion_corta', 'descripcion_larga', 'meta_titulo', 'meta_descripcion'];
      const missing = keys.filter(k => !(k in j));
      console.log('JSON válido:', missing.length ? 'FALTAN: ' + missing.join(', ') : 'OK (5 claves)');
    } catch (e) {
      console.log('JSON inválido:', e.message);
    }
  }
})();
