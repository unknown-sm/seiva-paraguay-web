// Redacta los secretos reales del JSON generado, devolviéndolos a placeholders.
// build_v4.js inyecta los valores reales (desde n8n.txt y jwt.txt) al generar el
// JSON para el deploy; este script revierte eso para que el JSON sea seguro de
// commitear (GitHub bloquea pushes con sk-or-v1-...).
const fs = require('fs');
const path = require('path');

let TOKEN = '';
try { TOKEN = fs.readFileSync('C:/Users/salaz/AppData/Local/Temp/jwt.txt', 'utf8').trim(); } catch (e) {}
let OR_KEY = '', TG_TOKEN = '';
try {
  const lines = fs.readFileSync('C:/Users/salaz/OneDrive/Escritorio/n8n.txt', 'utf8').split('\n').map(s => s.trim());
  TG_TOKEN = lines[4] || '';
  OR_KEY = lines[7] || '';
} catch (e) {}

const jsonPath = path.join(__dirname, '..', 'seiva-agente-inventario-v4.json');
let s = fs.readFileSync(jsonPath, 'utf8');

// Reemplazar solo los valores exactos (de más largo a más corto para evitar
// coincidencias parciales). Cada secret es único y largo.
const secrets = [
  [TOKEN, '__TOKEN__'],
  [OR_KEY, '__OR_KEY__'],
  [TG_TOKEN, '__TG_TOKEN__']
].filter(([val]) => val && val.length > 10);

let n = 0;
for (const [val, ph] of secrets) {
  const before = s.length;
  s = s.split(val).join(ph);
  if (s.length !== before) n++;
}

fs.writeFileSync(jsonPath, s);
console.log('Redactado. Secrets reemplazados:', n, '| longitud:', s.length);
console.log('Queda sk-or-v1-?', s.includes('sk-or-v1-'));
console.log('Queda __OR_KEY__?', s.includes('__OR_KEY__'));
console.log('Queda __TOKEN__?', s.includes('__TOKEN__'));
console.log('Queda __TG_TOKEN__?', s.includes('__TG_TOKEN__'));
