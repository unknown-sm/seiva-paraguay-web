const {DatabaseSync} = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = '/app/data/database.sqlite';
const db = new DatabaseSync(DB_PATH, {open:true});

console.log('=== stats_bar en contenido ===');
const row = db.prepare("SELECT value FROM contenido WHERE key = 'stats_bar'").get();
if (row && row.value) {
  try {
    const parsed = JSON.parse(row.value);
    console.log('Existen stats_bar con', parsed.length, 'items:');
    parsed.forEach((s, i) => console.log(' ' + (i+1) + '.', JSON.stringify(s)));
  } catch(e) {
    console.log('value presente pero no es JSON valido:', e.message);
    console.log('valor:', row.value.substring(0,200));
  }
} else {
  console.log('NO hay stats_bar en contenido (usa default del server)');
}

console.log('\n=== comparacion con contenidoDefault del server ===');
const serverJs = fs.readFileSync('/app/server.js', 'utf8');
const match = serverJs.match(/contenidoDefault\s*=\s*\{(.*?)\};/s);
if (match) {
  const defaultStats = match[1].match(/stats_bar:\s*JSON\.stringify\(\[(.*?)\]\)/s);
  if (defaultStats) {
    console.log('DEFAULT stats_bar del server (linea 482):');
    console.log('  iconos:', defaultStats[1].split(',').map(s=>s.trim()).join(', '));
    console.log('  Esto es lo que se restaura si se vuelve a seedear contenido.');
  }
}

console.log('\n=== todas las keys de contenido (para ver si se perdieron otras) ===');
const keys = db.prepare("SELECT key FROM contenido ORDER BY key").all();
console.log('Total keys:', keys.length);
keys.forEach(k => console.log('  -', k.key));

db.close();
