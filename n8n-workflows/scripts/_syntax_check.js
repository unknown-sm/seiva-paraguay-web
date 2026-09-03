// Validación como n8n lo haría.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('E:/Pagina_seiva/n8n-workflows/seiva-agente-inventario-v4.json', 'utf8'));
const code = j.nodes.find(n => n.name === 'Cerebro').parameters.jsCode;
try {
  new Function('return (async () => { ' + code + ' })()');
  console.log('OK: sintaxis válida, longitud =', code.length);
} catch (e) {
  console.log('FAIL:', e.message);
  const m = (e.stack || '').match(/<anonymous>:(\d+):(\d+)/);
  if (m) {
    const ln = parseInt(m[1]) - 2;
    console.log('Línea aprox en brain-source.js:', ln);
    const lines = code.split('\n');
    for (let i = Math.max(0, ln - 4); i < Math.min(lines.length, ln + 4); i++) {
      const marker = (i === ln - 1) ? '>>>' : '   ';
      console.log(marker + ' ' + (i + 1) + ': ' + lines[i]);
    }
  }
}
